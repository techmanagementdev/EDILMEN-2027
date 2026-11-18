import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { many, one, q, audit } from '../lib/db.js';
import { getCatalog, publicCatalog, getSetting, searchComuni, findComune, slugify } from '../lib/data.js';
import { createRequest, logEvent, buildQuote } from '../lib/requests.js';
import { clientOffers, ratingFor } from '../lib/network.js';
import { classify } from '../lib/ai.js';
import { sendMail, mailEnabled } from '../lib/mail.js';
import { hash, setSession } from '../lib/auth.js';
import { startTrial, trackView } from '../lib/saas.js';

const r = express.Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });
const writeLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

r.get('/bootstrap', async (_req, res) => {
  const cat = await getCatalog();
  const stats = await one(
    `SELECT (SELECT count(*) FROM companies WHERE status='attiva' AND network)::int AS network,
            (SELECT count(*) FROM companies)::int AS catalog,
            (SELECT count(*) FROM reviews WHERE status='pubblicata')::int AS reviews,
            (SELECT count(*) FROM contracts)::int AS contracts`);
  const byRegion = await many("SELECT regione, count(*)::int AS n, count(*) FILTER (WHERE network AND status='attiva')::int AS rete FROM companies WHERE regione IS NOT NULL GROUP BY regione ORDER BY n DESC");
  res.json({
    catalog: publicCatalog(cat),
    plans: await getSetting('plans'),
    fee: await getSetting('fee_rules'),
    contacts: await getSetting('contacts'),
    consentVersion: await getSetting('consent_version'),
    stats: { ...stats, byRegion },
  });
});

r.get('/comuni', (req, res) => res.json(searchComuni(req.query.q, 8)));

r.post('/describe', writeLimit, async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 3000);
  if (text.length < 5) return res.status(400).json({ error: 'Scrivi almeno due parole sul lavoro' });
  res.json(await classify(text));
});

// Anteprima calcolata dal server (stessa funzione del browser): usata dalle agenzie e come controllo.
r.post('/quote', async (req, res) => {
  try {
    const b = await buildQuote(req.body?.answers || {});
    res.json({ quote: b.quote, comune: b.com, title: b.title });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.post('/requests', writeLimit, async (req, res) => {
  const { answers = {}, contact = {}, consents = {}, account } = req.body || {};
  if (!answers.lavori?.length) return res.status(400).json({ error: 'Scegli almeno un lavoro' });
  if (!contact.phone && !isEmail(contact.email)) return res.status(400).json({ error: 'Lasciaci un telefono o un\'email per ricontattarti' });
  if (!consents.privacy) return res.status(400).json({ error: 'Serve la presa visione dell\'informativa privacy' });
  const version = await getSetting('consent_version');
  const now = new Date().toISOString();
  const cons = {
    privacy: { granted: true, version, at: now },
    condivisione: { granted: !!consents.condivisione, version, at: now },
    marketing: { granted: !!consents.marketing, version, at: now },
  };
  let userId = req.user?.id || null;
  if (!userId && account?.password && isEmail(contact.email)) {
    if (String(account.password).length < 8) return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
    const exists = await one('SELECT id FROM users WHERE email=$1', [contact.email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'Esiste già un account con questa email: accedi e poi invia la richiesta' });
    const u = await one("INSERT INTO users(email, password_hash, name, phone, role) VALUES ($1,$2,$3,$4,'cliente') RETURNING id, role", [contact.email.toLowerCase(), await hash(account.password), contact.name || null, contact.phone || null]);
    userId = u.id;
    setSession(res, u);
  }
  try {
    const row = await createRequest({ answers, contact, consents: cons, userId, source: answers.source === 'agenzia' ? 'agenzia' : 'sito' });
    res.json({ code: row.code, token: row.share_token, match: row.match });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

const requestByToken = (t) => one('SELECT * FROM requests WHERE share_token=$1', [t]);

r.get('/requests/:token', async (req, res) => {
  const row = await requestByToken(req.params.token);
  if (!row) return res.status(404).json({ error: 'Richiesta non trovata' });
  const offers = await clientOffers(row.id);
  const pending = await one("SELECT count(*)::int AS n FROM offers WHERE request_id=$1 AND status='invitata'", [row.id]);
  res.json({
    request: { code: row.code, title: row.title, status: row.status, comune: row.comune, provincia: row.provincia, created_at: row.created_at, quote: row.quote, answers: row.answers, appointment: row.appointment, kind: row.kind },
    offers, pendingInvites: pending.n,
  });
});

r.post('/requests/:token/choose', writeLimit, async (req, res) => {
  const row = await requestByToken(req.params.token);
  if (!row) return res.status(404).json({ error: 'Richiesta non trovata' });
  const { offerId, mode, slot, note } = req.body || {};
  if (offerId) {
    const o = await one("SELECT id FROM offers WHERE id=$1 AND request_id=$2 AND status IN ('inviata','scelta')", [offerId, row.id]);
    if (!o) return res.status(400).json({ error: 'Offerta non valida' });
  }
  const appointment = { mode: mode === 'chiamata' ? 'chiamata' : mode === 'video' ? 'video' : 'sopralluogo', slot: slot || null, note: String(note || '').slice(0, 500), offerId: offerId || null, at: new Date().toISOString() };
  await q("UPDATE requests SET appointment=$1, status=CASE WHEN status='nuova' THEN 'contattata' ELSE status END, updated_at=now() WHERE id=$2", [JSON.stringify(appointment), row.id]);
  await logEvent(row.id, req.user?.id, 'appuntamento_richiesto', appointment);
  res.json({ ok: true });
});

r.post('/voice', writeLimit, upload.single('audio'), async (req, res) => {
  const { phone, email, name, comune, privacy } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'Registra o carica un vocale' });
  if (!phone && !isEmail(email)) return res.status(400).json({ error: 'Lasciaci un telefono o un\'email' });
  if (privacy !== 'true' && privacy !== true) return res.status(400).json({ error: 'Serve la presa visione dell\'informativa privacy' });
  const f = await one('INSERT INTO files(owner_user, kind, mime, name, size, data) VALUES ($1,\'vocale\',$2,$3,$4,$5) RETURNING id', [req.user?.id || null, req.file.mimetype, req.file.originalname, req.file.size, req.file.buffer]);
  const version = await getSetting('consent_version');
  const row = await createRequest({ kind: 'vocale', source: 'vocale', answers: { comune }, contact: { name, phone, email, channel: phone ? 'telefono' : 'email' }, consents: { privacy: { granted: true, version, at: new Date().toISOString() } }, voiceFile: f.id, userId: req.user?.id || null, runMatching: false });
  res.json({ code: row.code });
});

// ---------------- Directory imprese ----------------
r.get('/companies', async (req, res) => {
  const { regione, provincia, cat, qtext, page = 1 } = { ...req.query, qtext: req.query.q };
  const where = ["status <> 'sospesa'"], p = [];
  if (regione) { p.push(regione); where.push(`regione = $${p.length}`); }
  if (provincia) { p.push(provincia); where.push(`provincia = $${p.length}`); }
  if (cat) { p.push(cat); where.push(`$${p.length} = ANY(categories)`); }
  if (qtext) { p.push('%' + qtext + '%'); where.push(`(name ILIKE $${p.length} OR comune ILIKE $${p.length})`); }
  const lim = 24, off = (Math.max(1, Number(page)) - 1) * lim;
  const rows = await many(`SELECT id, slug, name, comune, provincia, regione, categories, network, status, claimed_at FROM companies WHERE ${where.join(' AND ')} ORDER BY network DESC, (status='attiva') DESC, name ASC LIMIT ${lim} OFFSET ${off}`, p);
  const tot = await one(`SELECT count(*)::int AS n FROM companies WHERE ${where.join(' AND ')}`, p);
  const out = [];
  for (const c of rows) out.push({ ...c, rating: c.network ? await ratingFor(c.id) : null });
  res.json({ total: tot.n, page: Number(page), pageSize: lim, items: out });
});

r.get('/companies/:slug', async (req, res) => {
  const c = await one('SELECT * FROM companies WHERE slug=$1', [req.params.slug]);
  if (!c || c.status === 'sospesa') return res.status(404).json({ error: 'Impresa non trovata' });
  trackView(c.id).catch(() => {});
  const rating = await ratingFor(c.id);
  const reviews = await many("SELECT scores, text, created_at FROM reviews WHERE company_id=$1 AND status='pubblicata' ORDER BY created_at DESC LIMIT 20", [c.id]);
  const docs = await many("SELECT kind, valid_until, verified_at FROM company_docs WHERE company_id=$1 AND status='verificato' AND (valid_until IS NULL OR valid_until >= current_date)", [c.id]);
  const prices = c.publish_prices ? await many("SELECT pkg, level, price FROM company_prices WHERE company_id=$1 AND status='approvato'", [c.id]) : [];
  res.json({
    company: {
      slug: c.slug, name: c.name, comune: c.comune, provincia: c.provincia, regione: c.regione, website: c.website, description: c.description, categories: c.categories,
      provinces_served: c.provinces_served, years_active: c.years_active, employees: c.employees, certs_declared: c.certs_declared, network: c.network, status: c.status,
      claimed: !!c.claimed_at, source: c.source, checked_at: c.checked_at, availability: c.availability, min_job: c.min_job, max_job: c.max_job,
    },
    rating, reviews, docs, prices,
  });
});

r.post('/companies/:slug/report', writeLimit, async (req, res) => {
  const c = await one('SELECT id FROM companies WHERE slug=$1', [req.params.slug]);
  const text = String(req.body?.text || '').trim().slice(0, 2000);
  if (!c || text.length < 5) return res.status(400).json({ error: 'Descrivi l\'errore' });
  await q('INSERT INTO reports(company_id, email, text) VALUES ($1,$2,$3)', [c.id, isEmail(req.body?.email) ? req.body.email : null, text]);
  res.json({ ok: true });
});

// ---------------- Rivendicazione della scheda ----------------
const vatNorm = (v) => String(v || '').replace(/\D/g, '');
const domainOf = (u) => { try { return new URL(/^https?:/.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch { return null; } };

r.post('/claim/start', writeLimit, async (req, res) => {
  const vat = vatNorm(req.body?.vat), email = String(req.body?.email || '').trim().toLowerCase();
  if (vat.length !== 11) return res.status(400).json({ error: 'La partita IVA ha 11 cifre' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Email non valida' });
  const c = await one('SELECT id, name, website, claimed_at FROM companies WHERE vat=$1', [vat]);
  if (!c) return res.status(404).json({ error: 'Non troviamo questa partita IVA nell\'elenco: puoi iscriverti come nuova impresa', notFound: true });
  const d = domainOf(c.website);
  const domainMatch = !!d && email.endsWith('@' + d);
  const code = String(crypto.randomInt(100000, 999999));
  const cl = await one("INSERT INTO claims(company_id, email, code_hash, code_plain, domain_match, expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '15 minutes') RETURNING id",
    [c.id, email, crypto.createHash('sha256').update(code).digest('hex'), mailEnabled() ? null : code, domainMatch]);
  const m = await sendMail({ to: email, subject: 'Il tuo codice EdilMen', text: `Il codice per confermare la scheda di ${c.name} è ${code}. Vale 15 minuti.` });
  res.json({ claimId: cl.id, company: c.name, domainMatch, mailSent: m.sent });
});

r.post('/claim/verify', writeLimit, async (req, res) => {
  const { claimId, code, password, name, phone } = req.body || {};
  const cl = await one("SELECT * FROM claims WHERE id=$1 AND status='in_attesa'", [claimId]);
  if (!cl) return res.status(400).json({ error: 'Richiesta scaduta: ricomincia' });
  const okCode = cl.expires_at > new Date() && crypto.createHash('sha256').update(String(code || '')).digest('hex') === cl.code_hash;
  // Senza email configurata il codice resta visibile all'admin, che lo comunica all'impresa.
  if (!okCode) return res.status(400).json({ error: 'Codice errato o scaduto' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
  let u = await one('SELECT * FROM users WHERE email=$1', [cl.email]);
  if (u && u.role !== 'impresa') return res.status(409).json({ error: 'Questa email è già usata da un altro tipo di account' });
  if (!u) u = await one("INSERT INTO users(email, password_hash, name, phone, role, company_id) VALUES ($1,$2,$3,$4,'impresa',$5) RETURNING *", [cl.email, await hash(password), name || null, phone || null, cl.company_id]);
  else await q('UPDATE users SET company_id=$1 WHERE id=$2', [cl.company_id, u.id]);
  const status = cl.domain_match ? 'approvato' : 'da_approvare';
  await q('UPDATE claims SET status=$1, verified_at=now(), user_id=$2 WHERE id=$3', [status, u.id, cl.id]);
  if (cl.domain_match) await q('UPDATE companies SET claimed_at=now(), contact_email=COALESCE(contact_email,$1) WHERE id=$2', [cl.email, cl.company_id]);
  await startTrial(cl.company_id);
  await audit(u.id, 'claim', 'company', cl.company_id, { status });
  setSession(res, u);
  res.json({ ok: true, approved: cl.domain_match });
});

// Iscrizione di un'impresa non presente nell'elenco.
r.post('/join', writeLimit, async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!b.name || !isEmail(email) || String(b.password || '').length < 8) return res.status(400).json({ error: 'Servono ragione sociale, email e una password di almeno 8 caratteri' });
  if (await one('SELECT id FROM users WHERE email=$1', [email])) return res.status(409).json({ error: 'Email già registrata: accedi' });
  const vat = vatNorm(b.vat) || null;
  if (vat && (await one('SELECT id FROM companies WHERE vat=$1', [vat]))) return res.status(409).json({ error: 'Questa impresa è già nell\'elenco: usa "Rivendica la scheda"' });
  const com = findComune(b.comune);
  const slug = slugify(b.name) + '-' + crypto.randomBytes(2).toString('hex');
  const c = await one(
    `INSERT INTO companies(slug, name, vat, comune, provincia, regione, lat, lon, categories, status, source, contact_name, contact_email, contact_phone, claimed_at, checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'da_verificare','iscrizione',$10,$11,$12,now(),now()) RETURNING id`,
    [slug, b.name, vat, com?.nome || b.comune || null, com?.sigla || null, com?.regione || null, com?.lat ?? null, com?.lon ?? null, Array.isArray(b.categories) ? b.categories : [], b.contactName || null, email, b.phone || null]);
  const u = await one("INSERT INTO users(email, password_hash, name, phone, role, company_id) VALUES ($1,$2,$3,$4,'impresa',$5) RETURNING *", [email, await hash(b.password), b.contactName || null, b.phone || null, c.id]);
  await startTrial(c.id);
  await audit(u.id, 'iscrizione_impresa', 'company', c.id);
  setSession(res, u);
  res.json({ ok: true });
});

// Report pubblico condiviso dalle agenzie (stima lavori per un immobile).
r.get('/report/:token', async (req, res) => {
  const row = await one('SELECT r.*, p.title AS p_title, p.address AS p_address, p.mq AS p_mq, p.price_ask, a.name AS agency_name, a.phone AS agency_phone, a.email AS agency_email FROM requests r LEFT JOIN properties p ON p.id=r.property_id LEFT JOIN agencies a ON a.id=r.agency_id WHERE r.share_token=$1', [req.params.token]);
  if (!row || !row.agency_id) return res.status(404).json({ error: 'Report non trovato' });
  res.json({
    code: row.code, title: row.title, comune: row.comune, provincia: row.provincia, created_at: row.created_at, quote: row.quote, answers: row.answers,
    property: { title: row.p_title, address: row.p_address, mq: row.p_mq, price_ask: row.price_ask },
    agency: { name: row.agency_name, phone: row.agency_phone, email: row.agency_email },
    offers: await clientOffers(row.id),
  });
});


// ---------------- Preventivo dell'impresa (gestionale) consultabile e accettabile online ----------------
r.get('/preventivo/:token', async (req, res) => {
  const x = await one(`SELECT x.*, c.name AS company_name, c.vat AS company_vat, c.address AS company_address, c.comune AS company_comune, c.provincia AS company_provincia,
      c.contact_phone AS company_phone, c.contact_email AS company_email, c.website AS company_website, c.slug AS company_slug, c.network,
      cl.name AS client_name, cl.address AS client_address, cl.comune AS client_comune
    FROM crm_quotes x JOIN companies c ON c.id=x.company_id LEFT JOIN crm_clients cl ON cl.id=x.client_id WHERE x.share_token=$1`, [req.params.token]);
  if (!x) return res.status(404).json({ error: 'Preventivo non trovato' });
  res.json(x);
});
r.post('/preventivo/:token/answer', writeLimit, async (req, res) => {
  const x = await one('SELECT id, status, client_id FROM crm_quotes WHERE share_token=$1', [req.params.token]);
  if (!x) return res.status(404).json({ error: 'Preventivo non trovato' });
  if (x.status !== 'inviato') return res.status(400).json({ error: 'Questo preventivo ha già una risposta' });
  const st = req.body?.accept ? 'accettato' : 'rifiutato';
  await q('UPDATE crm_quotes SET status=$1, answered_at=now(), answer_note=$2 WHERE id=$3', [st, String(req.body?.note || '').slice(0, 1000), x.id]);
  if (st === 'accettato' && x.client_id) await q("UPDATE crm_clients SET stage='cliente', updated_at=now() WHERE id=$1", [x.client_id]);
  res.json({ ok: true, status: st });
});

// ---------------- Prezzi dalla community ----------------
r.post('/community-prices', writeLimit, upload.single('file'), async (req, res) => {
  const b = req.body || {};
  const cat = await getCatalog();
  const p = cat.packages.find((x) => x.code === b.pkg);
  const amount = Number(b.amount), qty = Number(b.qty) || 1, year = Number(b.year) || new Date().getFullYear();
  if (!p || !(amount > 0)) return res.status(400).json({ error: 'Scegli il lavoro e indica l\'importo' });
  if (year < 2018 || year > new Date().getFullYear()) return res.status(400).json({ error: 'Anno non valido' });
  const com = findComune(b.comune);
  let fileId = null;
  if (req.file) fileId = (await one("INSERT INTO files(kind, mime, name, size, data) VALUES ('preventivo_community',$1,$2,$3,$4) RETURNING id", [req.file.mimetype, req.file.originalname, req.file.size, req.file.buffer])).id;
  await q('INSERT INTO price_reports(pkg, level, comune, provincia, amount, qty, year, description, email, file_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [p.code, b.level !== undefined && b.level !== '' ? Number(b.level) : null, com?.nome || null, com?.sigla || null, amount, qty, year, String(b.description || '').slice(0, 1000), isEmail(b.email) ? b.email : null, fileId]);
  res.json({ ok: true });
});
r.get('/community-prices/:pkg', async (req, res) => {
  const rows = await many("SELECT amount / NULLIF(qty,0) AS unit, provincia, year FROM price_reports WHERE pkg=$1 AND status='approvata' AND year >= extract(year from now())::int - 3", [req.params.pkg]);
  const u = rows.map((x) => Number(x.unit)).filter((x) => x > 0).sort((a, b) => a - b);
  if (u.length < 3) return res.json({ n: u.length, published: false });
  const pick = (f) => u[Math.min(u.length - 1, Math.floor(f * (u.length - 1)))];
  res.json({ n: u.length, published: true, p25: pick(0.25), median: pick(0.5), p75: pick(0.75) });
});

r.get('/comune', (req, res) => res.json(findComune(req.query.nome, req.query.sigla)));

export default r;
