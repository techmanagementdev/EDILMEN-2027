// Accesso, registrazione e area riservata di clienti, agenzie e investitori.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { many, one, q, audit } from '../lib/db.js';
import { hash, check, setSession, clearSession, requireAuth } from '../lib/auth.js';
import { createRequest, logEvent, buildQuote, token } from '../lib/requests.js';
import { clientOffers, matchRequest } from '../lib/network.js';
import { findComune, getSetting } from '../lib/data.js';

export const auth = express.Router();
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

auth.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const u = { ...req.user };
  if (u.company_id) u.company = await one('SELECT id, slug, name, status, network, claimed_at FROM companies WHERE id=$1', [u.company_id]);
  if (u.agency_id) u.agency = await one('SELECT id, kind, name FROM agencies WHERE id=$1', [u.agency_id]);
  res.json({ user: u });
});

auth.post('/login', limit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const u = await one('SELECT * FROM users WHERE email=$1', [email]);
  if (!u || !u.active || !(await check(String(req.body?.password || ''), u.password_hash))) return res.status(401).json({ error: 'Email o password non corrette' });
  await q('UPDATE users SET last_login_at=now() WHERE id=$1', [u.id]);
  setSession(res, u);
  res.json({ ok: true, role: u.role });
});

auth.post('/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

auth.post('/register', limit, async (req, res) => {
  const b = req.body || {};
  const role = ['cliente', 'agenzia', 'investitore'].includes(b.role) ? b.role : 'cliente';
  const email = String(b.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Email non valida' });
  if (String(b.password || '').length < 8) return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
  if (!b.privacy) return res.status(400).json({ error: 'Serve la presa visione dell\'informativa privacy' });
  if (await one('SELECT id FROM users WHERE email=$1', [email])) return res.status(409).json({ error: 'Esiste già un account con questa email' });
  let agencyId = null;
  if (role !== 'cliente') {
    if (!b.orgName) return res.status(400).json({ error: role === 'agenzia' ? 'Indica il nome dell\'agenzia' : 'Indica il nome (o la società) dell\'investitore' });
    const com = findComune(b.comune);
    const a = await one('INSERT INTO agencies(kind, name, vat, comune, provincia, phone, email) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [role, b.orgName, b.vat || null, com?.nome || b.comune || null, com?.sigla || null, b.phone || null, email]);
    agencyId = a.id;
  }
  const u = await one('INSERT INTO users(email, password_hash, name, phone, role, agency_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [email, await hash(b.password), b.name || null, b.phone || null, role, agencyId]);
  // collega le richieste fatte prima di registrarsi con la stessa email
  await q('UPDATE requests SET user_id=$1 WHERE user_id IS NULL AND lower(contact_email)=$2', [u.id, email]);
  if (b.requestToken) await q('UPDATE requests SET user_id=$1 WHERE share_token=$2 AND user_id IS NULL', [u.id, b.requestToken]);
  await audit(u.id, 'registrazione', 'user', u.id, { role });
  setSession(res, u);
  res.json({ ok: true, role });
});

auth.post('/password', requireAuth(), async (req, res) => {
  const u = await one('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await check(String(req.body?.old || ''), u.password_hash))) return res.status(400).json({ error: 'La password attuale non è corretta' });
  if (String(req.body?.password || '').length < 8) return res.status(400).json({ error: 'Almeno 8 caratteri' });
  await q('UPDATE users SET password_hash=$1, must_change_password=false WHERE id=$2', [await hash(req.body.password), req.user.id]);
  res.json({ ok: true });
});

// ======================= Area cliente / agenzia / investitore =======================
export const me = express.Router();
me.use(requireAuth('cliente', 'agenzia', 'investitore', 'admin', 'operatore'));

const ownerWhere = (u) => (u.agency_id ? ['(r.user_id=$1 OR r.agency_id=$2)', [u.id, u.agency_id]] : ['r.user_id=$1', [u.id]]);
async function myRequest(req, id) {
  const [w, p] = ownerWhere(req.user);
  return one(`SELECT r.* FROM requests r WHERE r.id=$${p.length + 1} AND ${w}`, [...p, id]);
}

me.get('/requests', async (req, res) => {
  const [w, p] = ownerWhere(req.user);
  const rows = await many(
    `SELECT r.id, r.code, r.title, r.kind, r.source, r.status, r.comune, r.provincia, r.total_ref, r.created_at, r.property_id, r.share_token,
            (SELECT count(*)::int FROM offers o WHERE o.request_id=r.id AND o.status IN ('inviata','scelta') AND o.amount IS NOT NULL) AS offers
       FROM requests r WHERE ${w} ORDER BY r.created_at DESC`, p);
  res.json(rows);
});

me.get('/requests/:id', async (req, res) => {
  const r = await myRequest(req, req.params.id);
  if (!r) return res.status(404).json({ error: 'Richiesta non trovata' });
  const contract = await one('SELECT * FROM contracts WHERE request_id=$1 ORDER BY id DESC LIMIT 1', [r.id]);
  const sal = contract ? await many('SELECT * FROM sal WHERE contract_id=$1 ORDER BY n', [contract.id]) : [];
  const review = contract ? await one('SELECT id, status FROM reviews WHERE contract_id=$1', [contract.id]) : null;
  const pending = await one("SELECT count(*)::int AS n FROM offers WHERE request_id=$1 AND status='invitata'", [r.id]);
  const items = r.kind === 'computo' ? await computoComparison(r) : null;
  res.json({ request: r, offers: await clientOffers(r.id, !!contract), pendingInvites: pending.n, contract, sal, review, comparison: items });
});

me.post('/requests/:id/choose', async (req, res) => {
  const r = await myRequest(req, req.params.id);
  if (!r) return res.status(404).json({ error: 'Richiesta non trovata' });
  const { offerId, mode, slot, note } = req.body || {};
  const appointment = { mode: ['chiamata', 'video'].includes(mode) ? mode : 'sopralluogo', slot: slot || null, note: String(note || '').slice(0, 500), offerId: offerId || null, at: new Date().toISOString() };
  await q("UPDATE requests SET appointment=$1, status=CASE WHEN status='nuova' THEN 'contattata' ELSE status END, updated_at=now() WHERE id=$2", [JSON.stringify(appointment), r.id]);
  await logEvent(r.id, req.user.id, 'appuntamento_richiesto', appointment);
  res.json({ ok: true });
});

// Stima rapida (agenzie, investitori, clienti) salvata; "Chiedi offerte" la trasforma in richiesta vera.
me.post('/estimates', async (req, res) => {
  const { answers = {}, propertyId = null, requestOffers = false, contact = {} } = req.body || {};
  if (!answers.lavori?.length) return res.status(400).json({ error: 'Scegli almeno un lavoro' });
  if (propertyId) {
    const p = await one('SELECT id FROM properties WHERE id=$1 AND (agency_id=$2 OR created_by=$3)', [propertyId, req.user.agency_id || -1, req.user.id]);
    if (!p) return res.status(404).json({ error: 'Immobile non trovato' });
  }
  const version = await getSetting('consent_version');
  const row = await createRequest({
    answers, userId: req.user.id, agencyId: req.user.agency_id || null, propertyId,
    source: requestOffers ? (req.user.agency_id ? 'agenzia' : 'sito') : 'stima',
    contact: { name: contact.name || req.user.name, email: contact.email || req.user.email, phone: contact.phone || req.user.phone, channel: contact.channel || 'email' },
    consents: { privacy: { granted: true, version, at: new Date().toISOString() }, condivisione: { granted: true, version, at: new Date().toISOString() } },
    runMatching: requestOffers, actor: req.user.id,
  });
  res.json({ id: row.id, code: row.code, token: row.share_token, match: row.match });
});

me.post('/requests/:id/ask-offers', async (req, res) => {
  const r = await myRequest(req, req.params.id);
  if (!r) return res.status(404).json({ error: 'Richiesta non trovata' });
  await q("UPDATE requests SET source=CASE WHEN agency_id IS NOT NULL THEN 'agenzia' ELSE 'sito' END, updated_at=now() WHERE id=$1", [r.id]);
  const m = await matchRequest({ ...r, source: 'sito' }, req.user.id);
  await logEvent(r.id, req.user.id, 'offerte_richieste', m);
  res.json(m);
});

me.post('/requests/:id/share', async (req, res) => {
  const r = await myRequest(req, req.params.id);
  if (!r) return res.status(404).json({ error: 'Richiesta non trovata' });
  let t = r.share_token;
  if (req.body?.regenerate) { t = token(); await q('UPDATE requests SET share_token=$1 WHERE id=$2', [t, r.id]); }
  res.json({ token: t });
});

// ---- Immobili (agenzie e investitori)
me.get('/properties', async (req, res) => {
  const rows = await many(
    `SELECT p.*, (SELECT json_agg(json_build_object('id',r.id,'code',r.code,'title',r.title,'total_ref',r.total_ref,'source',r.source,'status',r.status,'created_at',r.created_at,'share_token',r.share_token) ORDER BY r.created_at DESC)
        FROM requests r WHERE r.property_id=p.id) AS quotes
       FROM properties p WHERE p.agency_id=$1 OR p.created_by=$2 ORDER BY p.created_at DESC`, [req.user.agency_id || -1, req.user.id]);
  res.json(rows);
});
me.post('/properties', async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Dai un nome all\'immobile' });
  const com = findComune(b.comune);
  const p = await one('INSERT INTO properties(agency_id, created_by, title, address, comune, provincia, tipo, mq, piani, units, price_ask, value_after, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
    [req.user.agency_id, req.user.id, b.title, b.address || null, com?.nome || b.comune || null, com?.sigla || null, b.tipo || null, b.mq || null, b.piani || 1, b.units || 1, b.price_ask || null, b.value_after || null, b.notes || null]);
  res.json(p);
});
me.put('/properties/:id', async (req, res) => {
  const b = req.body || {};
  const com = findComune(b.comune);
  const p = await one(`UPDATE properties SET title=$1, address=$2, comune=$3, provincia=$4, tipo=$5, mq=$6, piani=$7, units=$8, price_ask=$9, value_after=$10, notes=$11
    WHERE id=$12 AND (agency_id=$13 OR created_by=$14) RETURNING *`,
    [b.title, b.address || null, com?.nome || b.comune || null, com?.sigla || null, b.tipo || null, b.mq || null, b.piani || 1, b.units || 1, b.price_ask || null, b.value_after || null, b.notes || null, req.params.id, req.user.agency_id || -1, req.user.id]);
  if (!p) return res.status(404).json({ error: 'Immobile non trovato' });
  res.json(p);
});
me.delete('/properties/:id', async (req, res) => {
  await q('DELETE FROM properties WHERE id=$1 AND (agency_id=$2 OR created_by=$3)', [req.params.id, req.user.agency_id || -1, req.user.id]);
  res.json({ ok: true });
});

// ---- Grandi operazioni: richiesta d'offerta su computo metrico
me.post('/computo', async (req, res) => {
  const b = req.body || {};
  const items = (b.items || []).map((i, n) => ({ n: n + 1, desc: String(i.desc || '').slice(0, 300), unit: String(i.unit || '').slice(0, 12), qty: Number(i.qty) || 0 })).filter((i) => i.desc && i.qty > 0);
  if (!b.title || items.length < 1) return res.status(400).json({ error: 'Servono un titolo e almeno una voce con quantità' });
  const version = await getSetting('consent_version');
  const row = await createRequest({
    kind: 'computo', source: 'grande', title: b.title, description: b.description || null, items, deadline: b.deadline || null,
    answers: { comune: b.comune }, userId: req.user.id, agencyId: req.user.agency_id || null, propertyId: b.propertyId || null,
    contact: { name: req.user.name, email: req.user.email, phone: req.user.phone, channel: 'email' },
    consents: { privacy: { granted: true, version, at: new Date().toISOString() }, condivisione: { granted: true, version, at: new Date().toISOString() } },
    runMatching: false, actor: req.user.id,
  });
  res.json({ id: row.id, code: row.code });
});

export async function computoComparison(r) {
  const M = await getSetting('matching');
  const offers = await many("SELECT o.id, o.status, o.quote, o.amount, c.name FROM offers o JOIN companies c ON c.id=o.company_id WHERE o.request_id=$1 AND o.status IN ('inviata','scelta')", [r.id]);
  const items = (r.items || []).map((it) => {
    const prices = offers.map((o) => Number(o.quote?.items?.find((x) => x.n === it.n)?.price) || null);
    const valid = prices.filter((x) => x);
    const med = valid.length ? [...valid].sort((a, b) => a - b)[Math.floor(valid.length / 2)] : null;
    return { ...it, prices, median: med, flags: prices.map((p) => (p && med ? (p / med - 1 > M.priceHigh ? 'alto' : p / med - 1 < M.priceAnomalous ? 'anomalo' : null) : null)) };
  });
  return { offers: offers.map((o, i) => ({ id: o.id, letter: String.fromCharCode(65 + i), status: o.status, amount: o.amount })), items };
}

// ---- Contratto e SAL lato cliente
async function myContract(req, id) {
  return one('SELECT c.* FROM contracts c JOIN requests r ON r.id=c.request_id WHERE c.id=$1 AND (c.client_user=$2 OR r.user_id=$2)', [id, req.user.id]);
}
me.post('/contracts/:id/sal/:salId', async (req, res) => {
  const c = await myContract(req, req.params.id);
  if (!c) return res.status(404).json({ error: 'Contratto non trovato' });
  const action = req.body?.action;
  const s = await one('SELECT * FROM sal WHERE id=$1 AND contract_id=$2', [req.params.salId, c.id]);
  if (!s || s.status !== 'richiesto') return res.status(400).json({ error: 'Questo SAL non è in attesa di approvazione' });
  if (action === 'approva') await q("UPDATE sal SET status='approvato', approved_at=now(), note=COALESCE($2,note) WHERE id=$1", [s.id, req.body?.note || null]);
  else if (action === 'contesta') await q("UPDATE sal SET status='contestato', note=$2 WHERE id=$1", [s.id, String(req.body?.note || 'Contestato dal cliente').slice(0, 1000)]);
  else return res.status(400).json({ error: 'Azione non valida' });
  await logEvent(c.request_id, req.user.id, 'sal_' + action, { sal: s.n });
  res.json({ ok: true });
});
me.post('/contracts/:id/review', async (req, res) => {
  const c = await myContract(req, req.params.id);
  if (!c) return res.status(404).json({ error: 'Contratto non trovato' });
  const done = await one("SELECT count(*) FILTER (WHERE status IN ('approvato','pagato'))::int AS ok, count(*)::int AS n FROM sal WHERE contract_id=$1", [c.id]);
  if (done.ok < Math.max(1, done.n - 1) && c.status !== 'concluso') return res.status(400).json({ error: 'La recensione si lascia a fine lavori' });
  const s = req.body?.scores || {};
  const scores = {};
  for (const k of ['qualita', 'puntualita', 'preventivo', 'pulizia', 'comunicazione']) { const v = Number(s[k]); if (v >= 1 && v <= 5) scores[k] = v; }
  if (Object.keys(scores).length < 5) return res.status(400).json({ error: 'Dai un voto da 1 a 5 a tutte e cinque le voci' });
  await q('INSERT INTO reviews(contract_id, company_id, user_id, scores, text) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (contract_id) DO UPDATE SET scores=$4, text=$5, status=\'da_verificare\'', [c.id, c.company_id, req.user.id, JSON.stringify(scores), String(req.body?.text || '').slice(0, 3000)]);
  res.json({ ok: true });
});

me.put('/profile', async (req, res) => {
  const b = req.body || {};
  await q('UPDATE users SET name=$1, phone=$2 WHERE id=$3', [b.name || null, b.phone || null, req.user.id]);
  if (req.user.agency_id && b.orgName) await q('UPDATE agencies SET name=$1, vat=$2, phone=$3 WHERE id=$4', [b.orgName, b.vat || null, b.orgPhone || null, req.user.agency_id]);
  res.json({ ok: true });
});
