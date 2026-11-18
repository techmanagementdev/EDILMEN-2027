// Area riservata delle imprese: profilo, documenti, listino sui pacchetti, opportunità, cantieri e fee.
import express from 'express';
import multer from 'multer';
import { many, one, q, audit } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { getCatalog, getSetting, findComune } from '../lib/data.js';
import { ratingFor } from '../lib/network.js';
import { logEvent } from '../lib/requests.js';
import { computeQuote, feeFor } from '../../shared/pricing.js';
import { planOf, can } from '../lib/saas.js';
import { hash } from '../lib/auth.js';
import crypto from 'node:crypto';

const r = express.Router();
const upload = multer({ limits: { fileSize: 12 * 1024 * 1024, files: 10 } });
r.use(requireAuth('impresa'));
r.use((req, res, next) => (req.user.company_id ? next() : res.status(400).json({ error: 'Il tuo account non è collegato a un\'impresa' })));
const cid = (req) => req.user.company_id;

r.get('/overview', async (req, res) => {
  const c = await one('SELECT * FROM companies WHERE id=$1', [cid(req)]);
  const claim = await one('SELECT status FROM claims WHERE company_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 1', [c.id, req.user.id]);
  const counts = await one(
    `SELECT (SELECT count(*) FROM offers WHERE company_id=$1 AND status='invitata')::int AS inviti,
            (SELECT count(*) FROM offers WHERE company_id=$1 AND status='scelta')::int AS scelte,
            (SELECT count(*) FROM contracts WHERE company_id=$1 AND status='attivo')::int AS cantieri,
            (SELECT count(*) FROM company_prices WHERE company_id=$1)::int AS prezzi,
            (SELECT coalesce(sum(fee),0) FROM sal s JOIN contracts k ON k.id=s.contract_id WHERE k.company_id=$1 AND s.status IN ('approvato','pagato') AND s.fee_paid_at IS NULL) AS fee_aperte`, [c.id]);
  res.json({ company: c, claim, rating: await ratingFor(c.id), counts, plan: await planOf(c), plans: await getSetting('plans'), fee: c.fee_rules || (await getSetting('fee_rules')) });
});

r.put('/profile', async (req, res) => {
  const b = req.body || {};
  const com = b.comune ? findComune(b.comune) : null;
  const arr = (x) => (Array.isArray(x) ? x.map(String).slice(0, 40) : []);
  await q(
    `UPDATE companies SET description=$1, website=$2, address=$3, comune=COALESCE($4,comune), provincia=COALESCE($5,provincia), regione=COALESCE($6,regione), lat=COALESCE($7,lat), lon=COALESCE($8,lon),
       categories=$9, provinces_served=$10, radius_km=$11, min_job=$12, max_job=$13, availability=$14, employees=$15, years_active=$16, certs_declared=$17,
       contact_name=$18, contact_email=$19, contact_phone=$20, publish_prices=$21, receive_requests=$22, updated_at=now() WHERE id=$23`,
    [b.description || null, b.website || null, b.address || null, com?.nome || null, com?.sigla || null, com?.regione || null, com?.lat ?? null, com?.lon ?? null,
      arr(b.categories), arr(b.provinces_served), Number(b.radius_km) || 50, b.min_job || null, b.max_job || null, b.availability || null, b.employees || null, b.years_active || null,
      arr(b.certs_declared), b.contact_name || null, b.contact_email || null, b.contact_phone || null, !!b.publish_prices, !!b.receive_requests, cid(req)]);
  await audit(req.user.id, 'profilo_impresa', 'company', cid(req));
  res.json({ ok: true });
});

// ---- Documenti (visura, DURC, RC, patente a crediti, SOA, ISO)
r.get('/docs', async (req, res) => res.json(await many('SELECT id, kind, valid_until, status, note, created_at, file_id FROM company_docs WHERE company_id=$1 ORDER BY created_at DESC', [cid(req)])));
r.post('/docs', upload.single('file'), async (req, res) => {
  const kind = req.body?.kind;
  if (!['visura', 'durc', 'rc', 'patente', 'soa', 'iso'].includes(kind) || !req.file) return res.status(400).json({ error: 'Scegli il tipo di documento e il file' });
  const f = await one("INSERT INTO files(owner_user, kind, mime, name, size, data) VALUES ($1,'documento',$2,$3,$4,$5) RETURNING id", [req.user.id, req.file.mimetype, req.file.originalname, req.file.size, req.file.buffer]);
  await q('INSERT INTO company_docs(company_id, kind, valid_until, file_id) VALUES ($1,$2,$3,$4)', [cid(req), kind, req.body.valid_until || null, f.id]);
  res.json({ ok: true });
});

// ---- Listino dell'impresa sui pacchetti EdilMen (prezzo della parte fissa per unità)
r.get('/prices', async (req, res) => {
  const cat = await getCatalog();
  const mine = await many('SELECT pkg, level, price, status, ref_price FROM company_prices WHERE company_id=$1', [cid(req)]);
  res.json({ packages: cat.packages.map((p) => ({ code: p.code, family: p.family, name: p.name, unit: p.unit, prices: p.prices, acc: p.acc })), mine });
});
r.put('/prices', async (req, res) => {
  const M = await getSetting('matching');
  const cat = await getCatalog();
  const list = Array.isArray(req.body?.prices) ? req.body.prices : [];
  let saved = 0, toCheck = 0;
  for (const x of list) {
    const p = cat.packages.find((y) => y.code === x.pkg);
    const lvl = Number(x.level);
    if (!p || ![0, 1, 2].includes(lvl)) continue;
    if (x.price === '' || x.price == null) { await q('DELETE FROM company_prices WHERE company_id=$1 AND pkg=$2 AND level=$3', [cid(req), x.pkg, lvl]); continue; }
    const price = Number(x.price);
    if (!(price > 0)) continue;
    const ref = p.prices[lvl];
    const delta = price / ref - 1;
    // Sotto −25% il prezzo è anomalo: resta in attesa finché EdilMen non lo controlla.
    const status = delta < (M.priceAnomalous ?? -0.25) ? 'da_controllare' : 'approvato';
    if (status === 'da_controllare') toCheck++;
    await q(`INSERT INTO company_prices(company_id, pkg, level, price, ref_price, status) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (company_id, pkg, level) DO UPDATE SET price=$4, ref_price=$5, status=$6, updated_at=now()`, [cid(req), x.pkg, lvl, price, ref, status]);
    saved++;
  }
  await audit(req.user.id, 'listino_impresa', 'company', cid(req), { saved, toCheck });
  res.json({ saved, toCheck });
});

// ---- Opportunità: inviti a quotare e offerte automatiche dal listino
r.get('/opportunities', async (req, res) => {
  const rows = await many(
    `SELECT o.id, o.status, o.source, o.amount, o.start_days, o.note, o.invited_at, o.responded_at, o.quote AS my_quote,
            r.id AS request_id, r.code, r.kind, r.title, r.description, r.comune, r.provincia, r.spec, r.quote, r.items, r.deadline, r.total_ref, r.appointment, r.status AS request_status, r.created_at,
            CASE WHEN o.status='scelta' THEN r.contact_name END AS contact_name,
            CASE WHEN o.status='scelta' AND (r.consents->'condivisione'->>'granted')::boolean THEN r.contact_phone END AS contact_phone,
            CASE WHEN o.status='scelta' AND (r.consents->'condivisione'->>'granted')::boolean THEN r.contact_email END AS contact_email
       FROM offers o JOIN requests r ON r.id=o.request_id
      WHERE o.company_id=$1 ORDER BY (o.status='invitata') DESC, o.invited_at DESC`, [cid(req)]);
  res.json(rows);
});

r.post('/opportunities/:id/respond', async (req, res) => {
  const o = await one('SELECT o.*, r.kind, r.spec, r.items, r.id AS rid FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.id=$1 AND o.company_id=$2', [req.params.id, cid(req)]);
  if (!o) return res.status(404).json({ error: 'Opportunità non trovata' });
  if (!['invitata', 'inviata'].includes(o.status)) return res.status(400).json({ error: 'Questa opportunità è chiusa' });
  const b = req.body || {};
  if (b.decline) {
    await q("UPDATE offers SET status='rifiutata', note=$2, responded_at=now() WHERE id=$1", [o.id, String(b.note || '').slice(0, 500)]);
    await logEvent(o.rid, req.user.id, 'invito_rifiutato', { company: cid(req) });
    return res.json({ ok: true });
  }
  let amount, quote;
  if (o.kind === 'computo') {
    const items = (o.items || []).map((it) => ({ n: it.n, price: Number(b.items?.find((x) => Number(x.n) === it.n)?.price) || null }));
    if (items.some((i) => !i.price)) return res.status(400).json({ error: 'Indica il prezzo unitario di tutte le voci' });
    amount = Math.round((o.items || []).reduce((s, it) => s + it.qty * items.find((x) => x.n === it.n).price, 0) * 100) / 100;
    quote = { items };
  } else if (b.useListino) {
    const cat = await getCatalog();
    const mine = await many("SELECT pkg, level, price FROM company_prices WHERE company_id=$1 AND status='approvato'", [cid(req)]);
    const ov = {};
    for (const m of mine) { ov[m.pkg] ??= [null, null, null]; ov[m.pkg][m.level] = Number(m.price); }
    quote = computeQuote(cat, o.spec, ov);
    if (quote.missing.length) return res.status(400).json({ error: `Nel tuo listino mancano: ${quote.missing.join(', ')}. Indica un importo a corpo oppure completa il listino.` });
    amount = quote.prudent.imponibile;
  } else {
    amount = Number(b.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Indica l\'importo dell\'offerta, IVA esclusa' });
    quote = { manual: true };
  }
  await q("UPDATE offers SET status='inviata', amount=$2, quote=$3, start_days=$4, note=$5, responded_at=now() WHERE id=$1", [o.id, amount, JSON.stringify(quote), Number(b.start_days) || null, String(b.note || '').slice(0, 1000)]);
  await logEvent(o.rid, req.user.id, 'offerta_inviata', { company: cid(req), amount });
  res.json({ ok: true, amount });
});

// ---- Cantieri e SAL
r.get('/contracts', async (req, res) => {
  const rows = await many(`SELECT k.*, r.code, r.title, r.comune, r.provincia, r.contact_name, r.contact_phone, r.contact_email,
      (SELECT json_agg(s ORDER BY s.n) FROM sal s WHERE s.contract_id=k.id) AS sal
     FROM contracts k JOIN requests r ON r.id=k.request_id WHERE k.company_id=$1 ORDER BY k.created_at DESC`, [cid(req)]);
  res.json(rows);
});
r.post('/sal/:id/request', upload.array('photos', 10), async (req, res) => {
  const s = await one("SELECT s.*, k.request_id FROM sal s JOIN contracts k ON k.id=s.contract_id WHERE s.id=$1 AND k.company_id=$2", [req.params.id, cid(req)]);
  if (!s) return res.status(404).json({ error: 'SAL non trovato' });
  if (!['previsto', 'contestato'].includes(s.status)) return res.status(400).json({ error: 'SAL già richiesto' });
  const ids = [];
  for (const f of req.files || []) {
    if (!/^image\//.test(f.mimetype)) continue;
    const x = await one("INSERT INTO files(owner_user, kind, mime, name, size, data) VALUES ($1,'foto_sal',$2,$3,$4,$5) RETURNING id", [req.user.id, f.mimetype, f.originalname, f.size, f.buffer]);
    ids.push(x.id);
  }
  if (!ids.length && !s.photos.length) return res.status(400).json({ error: 'Allega almeno una foto del lavoro fatto' });
  await q("UPDATE sal SET status='richiesto', requested_at=now(), photos=photos || $2::int[], note=$3 WHERE id=$1", [s.id, ids, String(req.body?.note || '').slice(0, 1000)]);
  await logEvent(s.request_id, req.user.id, 'sal_richiesto', { sal: s.n, foto: ids.length });
  res.json({ ok: true });
});

r.get('/fees', async (req, res) => {
  const rows = await many(`SELECT s.id, s.n, s.name, s.amount, s.fee, s.status, s.approved_at, s.fee_invoiced_at, s.fee_paid_at, r.code, r.title
     FROM sal s JOIN contracts k ON k.id=s.contract_id JOIN requests r ON r.id=k.request_id WHERE k.company_id=$1 ORDER BY r.code, s.n`, [cid(req)]);
  const c = await one('SELECT fee_rules FROM companies WHERE id=$1', [cid(req)]);
  const rules = c.fee_rules || (await getSetting('fee_rules'));
  res.json({ rows, rules, example: [30000, 100000, 500000].map((v) => ({ value: v, ...feeFor(v, rules) })) });
});


// ---- Abbonamento (SaaS)
r.get('/subscription', async (req, res) => {
  const c = await one('SELECT * FROM companies WHERE id=$1', [cid(req)]);
  res.json({
    plan: await planOf(c), plans: await getSetting('plans'), billing: await getSetting('billing'),
    payments: await many('SELECT plan, amount, months, method, period_start, period_end, created_at FROM payments WHERE company_id=$1 ORDER BY created_at DESC', [c.id]),
    requested: c.subscription_status === 'richiesto' ? c.plan : null,
  });
});
r.post('/subscription/request', async (req, res) => {
  const plans = await getSetting('plans');
  const p = plans.find((x) => x.id === req.body?.plan);
  if (!p || p.id === 'free') return res.status(400).json({ error: 'Piano non valido' });
  const c = await one('SELECT subscription_status FROM companies WHERE id=$1', [cid(req)]);
  if (c.subscription_status === 'attivo') await q('UPDATE companies SET plan=$1 WHERE id=$2', [p.id, cid(req)]);
  else await q("UPDATE companies SET plan=$1, subscription_status='richiesto' WHERE id=$2", [p.id, cid(req)]);
  await audit(req.user.id, 'richiesta_abbonamento', 'company', cid(req), { plan: p.id, months: req.body?.months || 1 });
  res.json({ ok: true });
});

// ---- Team: più utenti per impresa, secondo il piano
r.get('/team', async (req, res) => {
  const c = await one('SELECT * FROM companies WHERE id=$1', [cid(req)]);
  const plan = await planOf(c);
  res.json({ max: plan.caps.team || 1, users: await many('SELECT id, email, name, phone, org_role, active, last_login_at, created_at FROM users WHERE company_id=$1 ORDER BY created_at', [cid(req)]) });
});
r.post('/team', async (req, res) => {
  const me = await one('SELECT org_role FROM users WHERE id=$1', [req.user.id]);
  if (me.org_role !== 'titolare') return res.status(403).json({ error: 'Solo il titolare aggiunge colleghi' });
  const c = await one('SELECT * FROM companies WHERE id=$1', [cid(req)]);
  const plan = await planOf(c);
  const n = await one('SELECT count(*)::int AS n FROM users WHERE company_id=$1 AND active', [cid(req)]);
  if (n.n >= (plan.caps.team || 1)) return res.status(402).json({ error: `Il piano ${plan.name} include ${plan.caps.team || 1} utent${(plan.caps.team || 1) > 1 ? 'i' : 'e'}: passa a un piano superiore per aggiungerne altri`, upgrade: true });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email non valida' });
  if (await one('SELECT id FROM users WHERE email=$1', [email])) return res.status(409).json({ error: 'Questa email ha già un account' });
  const temp = crypto.randomBytes(6).toString('base64url');
  await q("INSERT INTO users(email, password_hash, name, phone, role, company_id, org_role, must_change_password) VALUES ($1,$2,$3,$4,'impresa',$5,'collaboratore',true)", [email, await hash(temp), req.body?.name || null, req.body?.phone || null, cid(req)]);
  await audit(req.user.id, 'aggiunto_collega', 'company', cid(req), { email });
  res.json({ ok: true, tempPassword: temp });
});
r.delete('/team/:id', async (req, res) => {
  const me = await one('SELECT org_role FROM users WHERE id=$1', [req.user.id]);
  if (me.org_role !== 'titolare' || Number(req.params.id) === req.user.id) return res.status(403).json({ error: 'Non consentito' });
  await q('UPDATE users SET active=false WHERE id=$1 AND company_id=$2', [req.params.id, cid(req)]);
  res.json({ ok: true });
});

// ---- Statistiche della scheda pubblica (piano Base o superiore)
r.get('/stats', async (req, res) => {
  const c = await one('SELECT * FROM companies WHERE id=$1', [cid(req)]);
  const ok = await can(c, 'report');
  const months = await many(`SELECT to_char(date_trunc('month', day),'YYYY-MM') AS mese, sum(views)::int AS visite, sum(in_quotes)::int AS quotazioni
     FROM profile_stats WHERE company_id=$1 AND day > current_date - interval '12 months' GROUP BY 1 ORDER BY 1`, [c.id]);
  const off = await one(`SELECT count(*)::int AS offerte, count(*) FILTER (WHERE status='scelta')::int AS scelte, count(*) FILTER (WHERE status='invitata')::int AS inviti FROM offers WHERE company_id=$1`, [c.id]);
  const tot = months.reduce((s, m) => ({ visite: s.visite + m.visite, quotazioni: s.quotazioni + m.quotazioni }), { visite: 0, quotazioni: 0 });
  res.json({ locked: !ok, totals: tot, offers: off, months: ok ? months : [] });
});

export default r;
