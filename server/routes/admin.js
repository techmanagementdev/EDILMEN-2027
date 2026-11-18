// Amministrazione EdilMen: richieste, rete imprese, listino, contratti e SAL, regole economiche.
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { many, one, q, tx, audit } from '../lib/db.js';
import { requireAuth, hash } from '../lib/auth.js';
import { getCatalog, getSetting, setSetting, activateCatalog, findComune, slugify, DEFAULT_SETTINGS } from '../lib/data.js';
import { importListino } from '../lib/import-listino.js';
import { matchRequest, ratingFor, candidates } from '../lib/network.js';
import { createRequest, logEvent } from '../lib/requests.js';
import { computoComparison } from './account.js';
import { readTable, pick } from '../lib/sheets.js';
import { computeQuote, salPlan, feeFor } from '../../shared/pricing.js';

const r = express.Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
r.use(requireAuth('admin', 'operatore'));
const adminOnly = requireAuth('admin');

// ---------------- Dashboard: solo dati veri ----------------
r.get('/dashboard', async (_req, res) => {
  const k = await one(`SELECT
    (SELECT count(*) FROM requests WHERE status='nuova' AND source<>'stima')::int AS nuove,
    (SELECT count(*) FROM requests WHERE kind='vocale' AND status='nuova')::int AS vocali,
    (SELECT count(*) FROM requests WHERE created_at > now() - interval '7 days' AND source<>'stima')::int AS settimana,
    (SELECT count(*) FROM requests WHERE source='stima')::int AS stime,
    (SELECT count(*) FROM companies)::int AS imprese,
    (SELECT count(*) FROM companies WHERE status='attiva' AND network)::int AS rete,
    (SELECT count(*) FROM companies WHERE status='da_verificare')::int AS da_verificare,
    (SELECT count(*) FROM claims WHERE status='da_approvare')::int AS claim_da_approvare,
    (SELECT count(*) FROM company_prices WHERE status='da_controllare')::int AS prezzi_da_controllare,
    (SELECT count(*) FROM offers WHERE status='invitata')::int AS inviti_aperti,
    (SELECT count(*) FROM reviews WHERE status='da_verificare')::int AS recensioni,
    (SELECT count(*) FROM reports WHERE status='aperta')::int AS segnalazioni,
    (SELECT count(*) FROM sal WHERE status='richiesto')::int AS sal_da_approvare,
    (SELECT coalesce(sum(value),0) FROM contracts WHERE status<>'annullato') AS gmv,
    (SELECT coalesce(sum(fee_total),0) FROM contracts WHERE status<>'annullato') AS fee_totali,
    (SELECT coalesce(sum(fee),0) FROM sal WHERE status IN ('approvato','pagato')) AS fee_maturate,
    (SELECT coalesce(sum(fee),0) FROM sal WHERE fee_paid_at IS NOT NULL) AS fee_incassate`);
  const pipeline = await many("SELECT status, count(*)::int AS n, coalesce(sum(total_ref),0) AS valore FROM requests WHERE source<>'stima' GROUP BY status");
  const ultime = await many("SELECT id, code, title, kind, source, status, comune, provincia, total_ref, contact_name, created_at FROM requests WHERE source<>'stima' ORDER BY created_at DESC LIMIT 8");
  const perMese = await many("SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS mese, count(*)::int AS n, coalesce(sum(total_ref),0) AS valore FROM requests WHERE source<>'stima' GROUP BY 1 ORDER BY 1 DESC LIMIT 12");
  res.json({ k, pipeline, ultime, perMese });
});

// ---------------- Richieste ----------------
r.get('/requests', async (req, res) => {
  const { status, kind, source, qtext } = { ...req.query, qtext: req.query.q };
  const w = ['1=1'], p = [];
  if (status) { p.push(status); w.push(`r.status=$${p.length}`); }
  if (kind) { p.push(kind); w.push(`r.kind=$${p.length}`); }
  if (source) { p.push(source); w.push(`r.source=$${p.length}`); } else w.push("r.source<>'stima'");
  if (qtext) { p.push('%' + qtext + '%'); w.push(`(r.code ILIKE $${p.length} OR r.title ILIKE $${p.length} OR r.comune ILIKE $${p.length} OR r.contact_name ILIKE $${p.length} OR r.contact_email ILIKE $${p.length} OR r.contact_phone ILIKE $${p.length})`); }
  const rows = await many(`SELECT r.id, r.code, r.kind, r.source, r.status, r.title, r.comune, r.provincia, r.total_ref, r.contact_name, r.contact_phone, r.contact_email, r.contact_channel, r.created_at, r.appointment,
      a.name AS agency_name,
      (SELECT count(*)::int FROM offers o WHERE o.request_id=r.id AND o.status IN ('inviata','scelta')) AS offerte,
      (SELECT count(*)::int FROM offers o WHERE o.request_id=r.id AND o.status='invitata') AS inviti
    FROM requests r LEFT JOIN agencies a ON a.id=r.agency_id WHERE ${w.join(' AND ')} ORDER BY r.created_at DESC LIMIT 500`, p);
  const counts = await many("SELECT status, count(*)::int AS n FROM requests WHERE source<>'stima' GROUP BY status");
  res.json({ rows, counts });
});

r.get('/requests/:id', async (req, res) => {
  const row = await one('SELECT r.*, a.name AS agency_name, a.kind AS agency_kind, u.email AS user_email, p.title AS property_title FROM requests r LEFT JOIN agencies a ON a.id=r.agency_id LEFT JOIN users u ON u.id=r.user_id LEFT JOIN properties p ON p.id=r.property_id WHERE r.id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Richiesta non trovata' });
  const offers = await many('SELECT o.*, c.name AS company_name, c.slug, c.comune AS company_comune, c.provincia AS company_provincia FROM offers o JOIN companies c ON c.id=o.company_id WHERE o.request_id=$1 ORDER BY o.amount NULLS LAST', [row.id]);
  const events = await many('SELECT e.*, u.email AS user_email FROM request_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.request_id=$1 ORDER BY e.at DESC', [row.id]);
  const contract = await one('SELECT * FROM contracts WHERE request_id=$1 ORDER BY id DESC LIMIT 1', [row.id]);
  const sal = contract ? await many('SELECT * FROM sal WHERE contract_id=$1 ORDER BY n', [contract.id]) : [];
  const cand = row.kind !== 'vocale' ? (await candidates(row)).map((c) => ({ id: c.id, name: c.name, comune: c.comune, provincia: c.provincia, km: c.km })) : [];
  const staff = await many("SELECT id, name, email FROM users WHERE role IN ('admin','operatore') AND active");
  res.json({ request: row, offers, events, contract, sal, candidates: cand, staff, comparison: row.kind === 'computo' ? await computoComparison(row) : null });
});

r.patch('/requests/:id', async (req, res) => {
  const b = req.body || {};
  const cur = await one('SELECT * FROM requests WHERE id=$1', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Richiesta non trovata' });
  const fields = { status: b.status, notes: b.notes, assigned_to: b.assigned_to, appointment: b.appointment ? JSON.stringify(b.appointment) : undefined, contact_name: b.contact_name, contact_phone: b.contact_phone, contact_email: b.contact_email, title: b.title };
  const sets = [], p = [];
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) { p.push(v === '' ? null : v); sets.push(`${k}=$${p.length}`); }
  if (!sets.length) return res.json({ ok: true });
  p.push(cur.id);
  await q(`UPDATE requests SET ${sets.join(', ')}, updated_at=now() WHERE id=$${p.length}`, p);
  if (b.status && b.status !== cur.status) await logEvent(cur.id, req.user.id, 'stato', { da: cur.status, a: b.status });
  if (b.notes !== undefined && b.notes !== cur.notes) await logEvent(cur.id, req.user.id, 'nota', {});
  res.json({ ok: true });
});

r.delete('/requests/:id', adminOnly, async (req, res) => {
  await q('DELETE FROM requests WHERE id=$1', [req.params.id]);
  await audit(req.user.id, 'elimina_richiesta', 'request', req.params.id);
  res.json({ ok: true });
});

r.post('/requests', async (req, res) => {
  const b = req.body || {};
  const row = await createRequest({ answers: b.answers || {}, kind: b.kind || 'casa', source: 'admin', contact: b.contact || {}, description: b.description || null, items: b.items || null, title: b.title || null, consents: { privacy: { granted: true, version: 'raccolto da operatore', at: new Date().toISOString() } }, actor: req.user.id, runMatching: b.kind !== 'computo' });
  res.json({ id: row.id, code: row.code, match: row.match });
});

r.post('/requests/:id/match', async (req, res) => {
  const row = await one('SELECT * FROM requests WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Richiesta non trovata' });
  res.json(await matchRequest(row, req.user.id));
});

r.post('/requests/:id/invite', async (req, res) => {
  const ids = (req.body?.companyIds || [req.body?.companyId]).filter(Boolean).map(Number);
  let n = 0;
  for (const id of ids) n += (await q("INSERT INTO offers(request_id, company_id, source, status) VALUES ($1,$2,'invito','invitata') ON CONFLICT DO NOTHING", [req.params.id, id])).rowCount;
  await logEvent(req.params.id, req.user.id, 'inviti', { imprese: ids });
  res.json({ invited: n });
});

r.post('/requests/:id/offers', async (req, res) => {
  const b = req.body || {};
  if (!b.companyId || !(Number(b.amount) > 0)) return res.status(400).json({ error: 'Servono impresa e importo' });
  await q(`INSERT INTO offers(request_id, company_id, source, status, amount, quote, start_days, note, responded_at) VALUES ($1,$2,'manuale','inviata',$3,'{"manual":true}',$4,$5,now())
           ON CONFLICT (request_id, company_id) DO UPDATE SET status='inviata', amount=$3, start_days=$4, note=$5, responded_at=now()`,
    [req.params.id, b.companyId, Number(b.amount), Number(b.start_days) || null, b.note || null]);
  await logEvent(req.params.id, req.user.id, 'offerta_manuale', { company: b.companyId, amount: b.amount });
  res.json({ ok: true });
});

r.patch('/offers/:id', async (req, res) => {
  const st = req.body?.status;
  if (!['invitata', 'inviata', 'rifiutata', 'scelta', 'scartata'].includes(st)) return res.status(400).json({ error: 'Stato non valido' });
  const o = await one('UPDATE offers SET status=$1 WHERE id=$2 RETURNING request_id', [st, req.params.id]);
  if (o) await logEvent(o.request_id, req.user.id, 'offerta_' + st, { offer: req.params.id });
  res.json({ ok: true });
});

// Aggiudicazione: contratto + piano SAL + fee a scaglioni.
r.post('/requests/:id/contract', async (req, res) => {
  const b = req.body || {};
  const row = await one('SELECT * FROM requests WHERE id=$1', [req.params.id]);
  const off = await one('SELECT * FROM offers WHERE id=$1 AND request_id=$2', [b.offerId, req.params.id]);
  if (!row || !off) return res.status(400).json({ error: 'Scegli l\'offerta aggiudicata' });
  const value = Number(b.value) || Number(off.amount);
  if (!(value > 0)) return res.status(400).json({ error: 'Valore del contratto mancante' });
  const comp = await one('SELECT fee_rules FROM companies WHERE id=$1', [off.company_id]);
  const rules = comp.fee_rules || (await getSetting('fee_rules'));
  const cat = await getCatalog();
  const plan = salPlan(value, cat.params.sal, rules);
  const { fee } = feeFor(value, rules);
  const id = await tx(async (c) => {
    const k = (await c.query(`INSERT INTO contracts(request_id, offer_id, company_id, client_user, value, fee_rules, fee_total, payment_mode, signed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [row.id, off.id, off.company_id, row.user_id, value, JSON.stringify(rules), fee, b.payment_mode === 'escrow' ? 'escrow' : 'diretto', b.signed_at || null])).rows[0].id;
    for (const s of plan) await c.query('INSERT INTO sal(contract_id, n, name, document, share, amount, fee) VALUES ($1,$2,$3,$4,$5,$6,$7)', [k, s.n, s.name, s.document, s.share, s.amount, s.fee]);
    await c.query("UPDATE offers SET status=CASE WHEN id=$1 THEN 'scelta' ELSE (CASE WHEN status IN ('inviata','invitata') THEN 'scartata' ELSE status END) END WHERE request_id=$2", [off.id, row.id]);
    await c.query("UPDATE requests SET status='aggiudicata', updated_at=now() WHERE id=$1", [row.id]);
    return k;
  });
  await logEvent(row.id, req.user.id, 'aggiudicata', { contract: id, value, fee });
  res.json({ id, fee });
});

// ---------------- Contratti e SAL ----------------
r.get('/contracts', async (_req, res) => {
  res.json(await many(`SELECT k.*, r.code, r.title, c.name AS company_name,
     (SELECT json_agg(s ORDER BY s.n) FROM sal s WHERE s.contract_id=k.id) AS sal
     FROM contracts k JOIN requests r ON r.id=k.request_id JOIN companies c ON c.id=k.company_id ORDER BY k.created_at DESC`));
});
r.patch('/contracts/:id', async (req, res) => {
  const b = req.body || {};
  await q('UPDATE contracts SET status=COALESCE($1,status), payment_mode=COALESCE($2,payment_mode), signed_at=COALESCE($3,signed_at) WHERE id=$4', [b.status || null, b.payment_mode || null, b.signed_at || null, req.params.id]);
  if (b.status === 'concluso') {
    const k = await one('SELECT request_id FROM contracts WHERE id=$1', [req.params.id]);
    await q("UPDATE requests SET status='conclusa' WHERE id=$1", [k.request_id]);
  } else if (b.status === 'attivo') {
    const k = await one('SELECT request_id FROM contracts WHERE id=$1', [req.params.id]);
    await q("UPDATE requests SET status='in_cantiere' WHERE id=$1 AND status='aggiudicata'", [k.request_id]);
  }
  res.json({ ok: true });
});
r.patch('/sal/:id', async (req, res) => {
  const a = req.body?.action;
  const map = {
    approva: "status='approvato', approved_at=now()",
    pagato: "status='pagato', paid_at=now(), approved_at=COALESCE(approved_at, now())",
    fattura_fee: 'fee_invoiced_at=now()',
    fee_incassata: 'fee_paid_at=now(), fee_invoiced_at=COALESCE(fee_invoiced_at, now())',
    riapri: "status='previsto', requested_at=NULL, approved_at=NULL, paid_at=NULL",
  };
  if (!map[a]) return res.status(400).json({ error: 'Azione non valida' });
  const s = await one(`UPDATE sal SET ${map[a]} WHERE id=$1 RETURNING contract_id, n`, [req.params.id]);
  if (s) { const k = await one('SELECT request_id FROM contracts WHERE id=$1', [s.contract_id]); await logEvent(k.request_id, req.user.id, 'sal_' + a, { sal: s.n }); }
  res.json({ ok: true });
});

// ---------------- Imprese ----------------
r.get('/companies', async (req, res) => {
  const { status, network, regione, provincia, qtext, page = 1 } = { ...req.query, qtext: req.query.q };
  const w = ['1=1'], p = [];
  if (status) { p.push(status); w.push(`status=$${p.length}`); }
  if (network === 'true') w.push('network');
  if (regione) { p.push(regione); w.push(`regione=$${p.length}`); }
  if (provincia) { p.push(provincia); w.push(`provincia=$${p.length}`); }
  if (qtext) { p.push('%' + qtext + '%'); w.push(`(name ILIKE $${p.length} OR comune ILIKE $${p.length} OR vat ILIKE $${p.length})`); }
  const lim = 50, off = (Math.max(1, Number(page)) - 1) * lim;
  const rows = await many(`SELECT id, slug, name, vat, comune, provincia, regione, status, network, plan, categories, claimed_at, contact_email, contact_phone, receive_requests,
      (SELECT count(*)::int FROM company_prices cp WHERE cp.company_id=companies.id) AS prezzi,
      (SELECT count(*)::int FROM company_docs d WHERE d.company_id=companies.id AND d.status='verificato') AS documenti
    FROM companies WHERE ${w.join(' AND ')} ORDER BY network DESC, updated_at DESC LIMIT ${lim} OFFSET ${off}`, p);
  const tot = await one(`SELECT count(*)::int AS n FROM companies WHERE ${w.join(' AND ')}`, p);
  const counts = await one("SELECT count(*)::int AS tutte, count(*) FILTER (WHERE status='attiva' AND network)::int AS rete, count(*) FILTER (WHERE status='da_verificare')::int AS da_verificare, count(*) FILTER (WHERE status='catalogo')::int AS catalogo, count(*) FILTER (WHERE status='sospesa')::int AS sospese FROM companies");
  res.json({ rows, total: tot.n, pageSize: lim, counts });
});

r.get('/companies/:id', async (req, res) => {
  const c = await one('SELECT * FROM companies WHERE id=$1', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Impresa non trovata' });
  res.json({
    company: c,
    rating: await ratingFor(c.id),
    docs: await many('SELECT * FROM company_docs WHERE company_id=$1 ORDER BY created_at DESC', [c.id]),
    prices: await many('SELECT * FROM company_prices WHERE company_id=$1 ORDER BY pkg, level', [c.id]),
    users: await many('SELECT id, email, name, phone, active, last_login_at FROM users WHERE company_id=$1', [c.id]),
    claims: await many('SELECT id, email, status, domain_match, code_plain, expires_at, created_at FROM claims WHERE company_id=$1 ORDER BY id DESC LIMIT 10', [c.id]),
    offers: await many('SELECT o.id, o.status, o.source, o.amount, o.invited_at, o.responded_at, r.code, r.title, r.id AS request_id FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.company_id=$1 ORDER BY o.invited_at DESC LIMIT 50', [c.id]),
    contracts: await many('SELECT k.id, k.value, k.fee_total, k.status, r.code FROM contracts k JOIN requests r ON r.id=k.request_id WHERE k.company_id=$1', [c.id]),
  });
});

const COMPANY_FIELDS = ['name', 'vat', 'legal_form', 'ateco', 'address', 'website', 'description', 'categories', 'provinces_served', 'radius_km', 'min_job', 'max_job', 'availability', 'employees', 'years_active', 'certs_declared', 'status', 'network', 'plan', 'fee_rules', 'publish_prices', 'contact_name', 'contact_email', 'contact_phone', 'contact_kind', 'receive_requests', 'source', 'source_url'];
async function saveCompany(id, b, userId) {
  const com = b.comune ? findComune(b.comune, b.provincia) : null;
  const vals = {};
  for (const k of COMPANY_FIELDS) if (b[k] !== undefined) vals[k] = k === 'fee_rules' && b[k] ? JSON.stringify(b[k]) : b[k] === '' ? null : b[k];
  if (b.vat !== undefined) vals.vat = String(b.vat || '').replace(/\D/g, '') || null;
  if (com) Object.assign(vals, { comune: com.nome, provincia: com.sigla, regione: com.regione, lat: com.lat, lon: com.lon });
  else if (b.comune) Object.assign(vals, { comune: b.comune, provincia: b.provincia || null });
  if (b.network === true) vals.convention_signed_at = b.convention_signed_at || new Date().toISOString();
  if (!id) {
    vals.slug = slugify(b.name || 'impresa') + '-' + crypto.randomBytes(2).toString('hex');
    vals.checked_at = new Date().toISOString();
    vals.source = vals.source || 'inserita da EdilMen';
    const keys = Object.keys(vals);
    const row = await one(`INSERT INTO companies(${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, Object.values(vals));
    await audit(userId, 'crea_impresa', 'company', row.id);
    return row.id;
  }
  const keys = Object.keys(vals);
  if (keys.length) await q(`UPDATE companies SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_at=now() WHERE id=$${keys.length + 1}`, [...Object.values(vals), id]);
  await audit(userId, 'modifica_impresa', 'company', id, Object.keys(vals));
  return id;
}
r.post('/companies', async (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'Ragione sociale obbligatoria' });
  try { res.json({ id: await saveCompany(null, req.body, req.user.id) }); } catch (e) { res.status(400).json({ error: e.code === '23505' ? 'Partita IVA già presente' : e.message }); }
});
r.put('/companies/:id', async (req, res) => {
  try { await saveCompany(Number(req.params.id), req.body || {}, req.user.id); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.code === '23505' ? 'Partita IVA già presente' : e.message }); }
});
r.delete('/companies/:id', adminOnly, async (req, res) => {
  const used = await one('SELECT count(*)::int AS n FROM contracts WHERE company_id=$1', [req.params.id]);
  if (used.n) return res.status(400).json({ error: 'L\'impresa ha contratti: sospendila invece di eliminarla' });
  await q('DELETE FROM companies WHERE id=$1', [req.params.id]);
  await audit(req.user.id, 'elimina_impresa', 'company', req.params.id);
  res.json({ ok: true });
});
r.post('/companies/:id/user', async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!email || String(b.password || '').length < 8) return res.status(400).json({ error: 'Email e password di almeno 8 caratteri' });
  if (await one('SELECT id FROM users WHERE email=$1', [email])) return res.status(409).json({ error: 'Email già usata' });
  await q("INSERT INTO users(email, password_hash, name, phone, role, company_id) VALUES ($1,$2,$3,$4,'impresa',$5)", [email, await hash(b.password), b.name || null, b.phone || null, req.params.id]);
  await audit(req.user.id, 'crea_utente_impresa', 'company', req.params.id, { email });
  res.json({ ok: true });
});

// Import CSV/Excel di imprese (anagrafica di base, con fonte e data).
r.post('/companies/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica un file CSV o Excel' });
  const rows = await readTable(req.file, { mustHave: [] });
  const source = req.body?.source || req.file.originalname;
  let created = 0, updated = 0, skipped = 0;
  for (const x of rows) {
    const name = pick(x, 'ragione sociale', 'denominazione', 'name', 'impresa', 'ditta');
    if (!name) { skipped++; continue; }
    const vat = (pick(x, 'partita iva', 'p.iva', 'piva', 'vat', 'codice fiscale') || '').replace(/\D/g, '') || null;
    const b = {
      name, vat, comune: pick(x, 'comune', 'città', 'citta', 'sede'), provincia: (pick(x, 'provincia', 'prov', 'sigla') || '').toUpperCase().slice(0, 2) || null,
      website: pick(x, 'sito', 'website', 'web'), ateco: pick(x, 'ateco'), legal_form: pick(x, 'forma giuridica'),
      contact_phone: pick(x, 'telefono', 'tel', 'phone'), contact_email: pick(x, 'email', 'e-mail', 'mail'),
      categories: (pick(x, 'categorie', 'categoria', 'lavorazioni') || '').split(/[,;|]/).map((s) => s.trim()).filter(Boolean),
      source, source_url: pick(x, 'fonte url', 'source_url'),
    };
    try {
      const ex = vat ? await one('SELECT id FROM companies WHERE vat=$1', [vat]) : await one('SELECT id FROM companies WHERE lower(name)=lower($1) AND coalesce(comune,\'\')=coalesce($2,\'\')', [name, b.comune]);
      if (ex) { await saveCompany(ex.id, Object.fromEntries(Object.entries(b).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length))), req.user.id); updated++; }
      else { await saveCompany(null, b, req.user.id); created++; }
      await q('UPDATE companies SET checked_at=now() WHERE vat=$1 OR (vat IS NULL AND name=$2)', [vat, name]);
    } catch { skipped++; }
  }
  res.json({ created, updated, skipped, rows: rows.length });
});

r.patch('/docs/:id', async (req, res) => {
  const st = req.body?.status;
  if (!['verificato', 'rifiutato', 'caricato'].includes(st)) return res.status(400).json({ error: 'Stato non valido' });
  await q('UPDATE company_docs SET status=$1, valid_until=COALESCE($2, valid_until), note=$3, verified_at=now(), verified_by=$4 WHERE id=$5', [st, req.body?.valid_until || null, req.body?.note || null, req.user.id, req.params.id]);
  res.json({ ok: true });
});
r.post('/companies/:id/docs', async (req, res) => {
  const b = req.body || {};
  if (!['visura', 'durc', 'rc', 'patente', 'soa', 'iso'].includes(b.kind)) return res.status(400).json({ error: 'Tipo non valido' });
  await q("INSERT INTO company_docs(company_id, kind, valid_until, status, verified_at, verified_by, note) VALUES ($1,$2,$3,'verificato',now(),$4,$5)", [req.params.id, b.kind, b.valid_until || null, req.user.id, b.note || 'Verificato da EdilMen']);
  res.json({ ok: true });
});

r.get('/prices/pending', async (_req, res) => {
  res.json(await many("SELECT cp.*, c.name AS company_name FROM company_prices cp JOIN companies c ON c.id=cp.company_id WHERE cp.status='da_controllare' ORDER BY cp.updated_at DESC"));
});
r.get('/prices/overview', async (_req, res) => {
  res.json(await many(`SELECT cp.pkg, cp.level, count(*)::int AS n, min(cp.price) AS min, max(cp.price) AS max, avg(cp.price) AS avg, max(cp.ref_price) AS ref
    FROM company_prices cp WHERE cp.status='approvato' GROUP BY cp.pkg, cp.level ORDER BY cp.pkg, cp.level`));
});
r.patch('/prices', async (req, res) => {
  const { company_id, pkg, level, status } = req.body || {};
  if (!['approvato', 'rifiutato', 'da_controllare'].includes(status)) return res.status(400).json({ error: 'Stato non valido' });
  await q('UPDATE company_prices SET status=$1 WHERE company_id=$2 AND pkg=$3 AND level=$4', [status, company_id, pkg, level]);
  await audit(req.user.id, 'prezzo_' + status, 'company', company_id, { pkg, level });
  res.json({ ok: true });
});

r.get('/claims', async (_req, res) => {
  res.json(await many("SELECT cl.*, c.name AS company_name, c.website FROM claims cl JOIN companies c ON c.id=cl.company_id WHERE cl.status IN ('in_attesa','da_approvare') ORDER BY cl.created_at DESC LIMIT 100"));
});
r.patch('/claims/:id', async (req, res) => {
  const st = req.body?.status;
  if (!['approvato', 'rifiutato'].includes(st)) return res.status(400).json({ error: 'Stato non valido' });
  const cl = await one('UPDATE claims SET status=$1 WHERE id=$2 RETURNING *', [st, req.params.id]);
  if (cl && st === 'approvato') await q('UPDATE companies SET claimed_at=now(), contact_email=COALESCE(contact_email,$1) WHERE id=$2', [cl.email, cl.company_id]);
  if (cl && st === 'rifiutato' && cl.user_id) await q('UPDATE users SET company_id=NULL WHERE id=$1 AND company_id=$2', [cl.user_id, cl.company_id]);
  await audit(req.user.id, 'claim_' + st, 'company', cl?.company_id);
  res.json({ ok: true });
});

// ---------------- Listino EdilMen ----------------
r.get('/catalog', async (_req, res) => {
  const cat = await getCatalog();
  const versions = await many('SELECT id, version, note, active, created_at FROM catalog_versions ORDER BY id DESC LIMIT 20');
  res.json({ catalog: cat, versions });
});
r.post('/catalog/import', adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica il file Excel del listino' });
  try {
    const data = await importListino(req.file.buffer);
    if (req.body?.version) data.version = req.body.version;
    const id = await activateCatalog(data, req.body?.note || req.file.originalname, req.user.id);
    await audit(req.user.id, 'import_listino', 'catalog', id, { pacchetti: data.packages.length });
    res.json({ id, packages: data.packages.length, variants: data.variants.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
r.put('/catalog/params', adminOnly, async (req, res) => {
  const cat = await getCatalog();
  const { id, version, ...data } = cat;
  const p = req.body || {};
  data.params = { ...data.params, ...(p.territorio ? { territorio: { ...data.params.territorio, ...p.territorio } } : {}), ...(p.logistica ? { logistica: { ...data.params.logistica, ...p.logistica } } : {}) };
  for (const k of ['sicurezza', 'tecniche', 'ivaRistrutturazione', 'ivaPrimaCasaNuova', 'ivaOrdinaria', 'ribassoVariabili']) if (p[k] != null) data.params[k] = Number(p[k]);
  if (Array.isArray(p.sal)) data.params.sal = p.sal;
  const nid = await activateCatalog({ ...data, version }, 'Parametri modificati da admin', req.user.id);
  await audit(req.user.id, 'parametri_listino', 'catalog', nid);
  res.json({ id: nid });
});
r.put('/catalog/packages/:code', adminOnly, async (req, res) => {
  const cat = await getCatalog();
  const { id, version, ...data } = cat;
  const pkg = data.packages.find((x) => x.code === req.params.code);
  if (!pkg) return res.status(404).json({ error: 'Pacchetto non trovato' });
  const b = req.body || {};
  if (Array.isArray(b.prices) && b.prices.length === 3 && b.prices.every((x) => Number(x) > 0)) pkg.prices = b.prices.map(Number);
  if (b.acc != null) pkg.acc = Number(b.acc);
  if (b.name) pkg.name = b.name;
  const nid = await activateCatalog({ ...data, version }, `Modificato ${pkg.code}`, req.user.id);
  await audit(req.user.id, 'modifica_pacchetto', 'catalog', nid, { code: pkg.code });
  res.json({ id: nid });
});
r.post('/catalog/activate/:id', adminOnly, async (req, res) => {
  const v = await one('SELECT data FROM catalog_versions WHERE id=$1', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Versione non trovata' });
  await q('UPDATE catalog_versions SET active=(id=$1)', [req.params.id]);
  const { invalidateCatalog } = await import('../lib/data.js');
  invalidateCatalog();
  res.json({ ok: true });
});

// ---------------- Regole economiche e impostazioni ----------------
r.get('/settings', async (_req, res) => {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = await getSetting(k);
  res.json(out);
});
r.put('/settings/:key', adminOnly, async (req, res) => {
  if (!(req.params.key in DEFAULT_SETTINGS)) return res.status(400).json({ error: 'Impostazione sconosciuta' });
  const v = req.body?.value;
  if (req.params.key === 'fee_rules') {
    if (!Array.isArray(v?.brackets) || !v.brackets.length || v.brackets.some((b) => !(b.rate >= 0 && b.rate < 0.5))) return res.status(400).json({ error: 'Scaglioni non validi' });
  }
  await setSetting(req.params.key, v, req.user.id);
  await audit(req.user.id, 'impostazione', 'settings', req.params.key, v);
  res.json({ ok: true });
});

// ---------------- Recensioni, segnalazioni ----------------
r.get('/reviews', async (_req, res) => res.json(await many('SELECT v.*, c.name AS company_name, r.code FROM reviews v JOIN companies c ON c.id=v.company_id JOIN contracts k ON k.id=v.contract_id JOIN requests r ON r.id=k.request_id ORDER BY v.created_at DESC LIMIT 200')));
r.patch('/reviews/:id', async (req, res) => {
  const st = req.body?.status;
  if (!['pubblicata', 'rifiutata', 'da_verificare'].includes(st)) return res.status(400).json({ error: 'Stato non valido' });
  await q('UPDATE reviews SET status=$1 WHERE id=$2', [st, req.params.id]);
  await audit(req.user.id, 'recensione_' + st, 'review', req.params.id);
  res.json({ ok: true });
});
r.get('/reports', async (_req, res) => res.json(await many('SELECT s.*, c.name AS company_name, c.slug FROM reports s LEFT JOIN companies c ON c.id=s.company_id ORDER BY s.created_at DESC LIMIT 200')));
r.patch('/reports/:id', async (req, res) => { await q('UPDATE reports SET status=$1 WHERE id=$2', [req.body?.status || 'chiusa', req.params.id]); res.json({ ok: true }); });

// ---------------- Rubrica artigiani (call center) ----------------
const ART_STATES = ['da_chiamare', 'da_richiamare', 'interessato', 'convenzionato', 'non_interessato', 'numero_errato', 'escluso'];
r.get('/artisans', async (req, res) => {
  const w = ['1=1'], p = [];
  if (req.query.status) { p.push(req.query.status); w.push(`status=$${p.length}`); }
  if (req.query.q) { p.push('%' + req.query.q + '%'); w.push(`(name ILIKE $${p.length} OR company_name ILIKE $${p.length} OR zone ILIKE $${p.length} OR phone ILIKE $${p.length} OR trade ILIKE $${p.length})`); }
  const rows = await many(`SELECT * FROM artisans WHERE ${w.join(' AND ')} ORDER BY (status IN ('da_chiamare','da_richiamare')) DESC, last_contact NULLS FIRST, id LIMIT 1000`, p);
  const counts = await many('SELECT status, count(*)::int AS n FROM artisans GROUP BY status');
  res.json({ rows, counts, states: ART_STATES });
});
r.post('/artisans', async (req, res) => {
  const b = req.body || {};
  const x = await one('INSERT INTO artisans(name, company_name, trade, phone, email, zone, vat, notes, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'inserito a mano\') RETURNING id', [b.name || null, b.company_name || null, b.trade || null, b.phone || null, b.email || null, b.zone || null, b.vat || null, b.notes || null]);
  res.json(x);
});
r.patch('/artisans/:id', async (req, res) => {
  const b = req.body || {};
  if (b.status && !ART_STATES.includes(b.status)) return res.status(400).json({ error: 'Stato non valido' });
  await q(`UPDATE artisans SET status=COALESCE($1,status), outcome=COALESCE($2,outcome), notes=COALESCE($3,notes), trade=COALESCE($4,trade), zone=COALESCE($5,zone), company_name=COALESCE($6,company_name), email=COALESCE($7,email),
     last_contact=CASE WHEN $1 IS NOT NULL OR $2 IS NOT NULL THEN now() ELSE last_contact END WHERE id=$8`, [b.status || null, b.outcome || null, b.notes ?? null, b.trade || null, b.zone || null, b.company_name || null, b.email || null, req.params.id]);
  res.json({ ok: true });
});
r.post('/artisans/:id/to-company', async (req, res) => {
  const a = await one('SELECT * FROM artisans WHERE id=$1', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Contatto non trovato' });
  const id = await saveCompany(null, { name: a.company_name || a.name, vat: a.vat, comune: (a.zone || '').split(/[,(]/)[0].trim() || null, contact_name: a.name, contact_phone: a.phone, contact_email: a.email, contact_kind: 'personal', status: 'da_verificare', source: 'rubrica artigiani', categories: a.trade ? [a.trade] : [] }, req.user.id);
  await q("UPDATE artisans SET company_id=$1, status='convenzionato' WHERE id=$2", [id, a.id]);
  res.json({ companyId: id });
});
r.post('/artisans/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica il file' });
  const rows = await readTable(req.file, { sheet: 'Contatti', mustHave: ['cellulare'] }).catch(() => readTable(req.file, {}));
  let n = 0, dup = 0;
  const stateOf = (s) => { const t = String(s || '').toLowerCase(); return t.includes('richiam') ? 'da_richiamare' : t.includes('non interess') ? 'non_interessato' : t.includes('interess') ? 'interessato' : t.includes('convenzion') ? 'convenzionato' : t.includes('errat') ? 'numero_errato' : 'da_chiamare'; };
  for (const x of rows) {
    const phone = pick(x, 'cellulare', 'telefono', 'tel');
    const name = [pick(x, 'nome contatto', 'nome'), ''].join('').trim() || pick(x, 'ditta');
    if (!phone && !name) continue;
    if (phone && (await one('SELECT id FROM artisans WHERE phone=$1', [phone]))) { dup++; continue; }
    await q('INSERT INTO artisans(name, company_name, trade, phone, email, zone, vat, notes, status, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
      name, pick(x, 'ditta / ragione sociale', 'ditta', 'ragione sociale'), pick(x, 'categoria edilmen', 'specializzazione', 'mestiere'), phone,
      pick(x, 'email'), pick(x, 'sede / zona', 'zona', 'sede'), pick(x, 'p.iva', 'partita iva'), pick(x, 'note'), stateOf(pick(x, 'stato contatto', 'stato')), req.file.originalname]);
    n++;
  }
  await audit(req.user.id, 'import_rubrica', 'artisans', null, { n, dup });
  res.json({ imported: n, duplicates: dup });
});

// ---------------- Utenti ----------------
r.get('/users', adminOnly, async (req, res) => {
  res.json(await many(`SELECT u.id, u.email, u.name, u.phone, u.role, u.active, u.created_at, u.last_login_at, c.name AS company_name, a.name AS agency_name
     FROM users u LEFT JOIN companies c ON c.id=u.company_id LEFT JOIN agencies a ON a.id=u.agency_id ORDER BY u.created_at DESC LIMIT 1000`));
});
r.post('/users', adminOnly, async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!['admin', 'operatore'].includes(b.role) || !email || String(b.password || '').length < 8) return res.status(400).json({ error: 'Ruolo admin/operatore, email e password di almeno 8 caratteri' });
  if (await one('SELECT id FROM users WHERE email=$1', [email])) return res.status(409).json({ error: 'Email già usata' });
  await q('INSERT INTO users(email, password_hash, name, role) VALUES ($1,$2,$3,$4)', [email, await hash(b.password), b.name || null, b.role]);
  await audit(req.user.id, 'crea_utente', 'user', email, { role: b.role });
  res.json({ ok: true });
});
r.patch('/users/:id', adminOnly, async (req, res) => {
  const b = req.body || {};
  if (Number(req.params.id) === req.user.id && b.active === false) return res.status(400).json({ error: 'Non puoi disattivare te stesso' });
  if (b.password) { if (String(b.password).length < 8) return res.status(400).json({ error: 'Almeno 8 caratteri' }); await q('UPDATE users SET password_hash=$1 WHERE id=$2', [await hash(b.password), req.params.id]); }
  if (b.active !== undefined) await q('UPDATE users SET active=$1 WHERE id=$2', [!!b.active, req.params.id]);
  if (b.role && ['admin', 'operatore', 'cliente', 'agenzia', 'investitore', 'impresa'].includes(b.role)) await q('UPDATE users SET role=$1 WHERE id=$2', [b.role, req.params.id]);
  await audit(req.user.id, 'modifica_utente', 'user', req.params.id, { ...b, password: b.password ? '***' : undefined });
  res.json({ ok: true });
});

r.get('/audit', adminOnly, async (_req, res) => res.json(await many('SELECT a.*, u.email FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.at DESC LIMIT 300')));

// Anteprima prezzo dall'admin (per richieste telefoniche): stesso motore del sito.
r.post('/quote', async (req, res) => {
  const cat = await getCatalog();
  res.json(computeQuote(cat, req.body?.spec || {}));
});

export default r;
