// Gestionale dell'impresa (piano Plus o prova): clienti, preventivi, cantieri, diario, scadenze.
import express from 'express';
import multer from 'multer';
import { many, one, q, audit } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { requireCap } from '../lib/saas.js';
import { token } from '../lib/requests.js';
import { getCatalog } from '../lib/data.js';

const r = express.Router();
const upload = multer({ limits: { fileSize: 12 * 1024 * 1024, files: 10 } });
r.use(requireAuth('impresa'));
r.use(requireCap('crm'));
const cid = (req) => req.user.company_id;
const r2 = (x) => Math.round(x * 100) / 100;
const own = (table, id, req) => one(`SELECT * FROM ${table} WHERE id=$1 AND company_id=$2`, [id, cid(req)]);

r.get('/dashboard', async (req, res) => {
  const k = await one(`SELECT
    (SELECT count(*) FROM crm_clients WHERE company_id=$1)::int AS clienti,
    (SELECT count(*) FROM crm_quotes WHERE company_id=$1 AND status='inviato')::int AS preventivi_aperti,
    (SELECT coalesce(sum(total),0) FROM crm_quotes WHERE company_id=$1 AND status='inviato') AS valore_aperto,
    (SELECT coalesce(sum(total),0) FROM crm_quotes WHERE company_id=$1 AND status='accettato' AND answered_at > date_trunc('year', now())) AS accettato_anno,
    (SELECT count(*) FROM crm_quotes WHERE company_id=$1 AND status IN ('accettato','rifiutato'))::int AS decisi,
    (SELECT count(*) FROM crm_quotes WHERE company_id=$1 AND status='accettato')::int AS accettati,
    (SELECT count(*) FROM crm_jobs WHERE company_id=$1 AND status='in_corso')::int AS cantieri,
    (SELECT count(*) FROM crm_deadlines WHERE company_id=$1 AND NOT done AND due < current_date)::int AS scadute`, [cid(req)]);
  const next = await many('SELECT d.*, j.title AS job_title FROM crm_deadlines d LEFT JOIN crm_jobs j ON j.id=d.job_id WHERE d.company_id=$1 AND NOT d.done ORDER BY d.due LIMIT 8', [cid(req)]);
  const pipeline = await many('SELECT stage, count(*)::int AS n FROM crm_clients WHERE company_id=$1 GROUP BY stage', [cid(req)]);
  res.json({ k, next, pipeline });
});

// ---------------- Clienti ----------------
r.get('/clients', async (req, res) => {
  const p = [cid(req)], w = ['company_id=$1'];
  if (req.query.q) { p.push('%' + req.query.q + '%'); w.push(`(name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR comune ILIKE $2)`); }
  res.json(await many(`SELECT c.*, (SELECT count(*)::int FROM crm_quotes x WHERE x.client_id=c.id) AS preventivi FROM crm_clients c WHERE ${w.join(' AND ')} ORDER BY updated_at DESC LIMIT 500`, p));
});
r.get('/clients/:id', async (req, res) => {
  const c = await own('crm_clients', req.params.id, req);
  if (!c) return res.status(404).json({ error: 'Cliente non trovato' });
  res.json({
    client: c,
    quotes: await many('SELECT id, number, title, status, total, created_at FROM crm_quotes WHERE client_id=$1 ORDER BY created_at DESC', [c.id]),
    jobs: await many('SELECT id, title, status, value, start_date FROM crm_jobs WHERE client_id=$1 ORDER BY created_at DESC', [c.id]),
  });
});
const CF = ['name', 'email', 'phone', 'address', 'comune', 'vat', 'stage', 'source', 'notes'];
r.post('/clients', async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Il nome è obbligatorio' });
  const x = await one(`INSERT INTO crm_clients(company_id, ${CF.join(',')}) VALUES ($1, ${CF.map((_, i) => '$' + (i + 2)).join(',')}) RETURNING *`, [cid(req), ...CF.map((k) => (k === 'stage' ? b[k] || 'contatto' : b[k] || null))]);
  res.json(x);
});
r.put('/clients/:id', async (req, res) => {
  const b = req.body || {};
  const x = await one(`UPDATE crm_clients SET ${CF.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_at=now() WHERE id=$${CF.length + 1} AND company_id=$${CF.length + 2} RETURNING *`, [...CF.map((k) => (k === 'stage' ? b[k] || 'contatto' : b[k] || null)), req.params.id, cid(req)]);
  if (!x) return res.status(404).json({ error: 'Cliente non trovato' });
  res.json(x);
});
r.delete('/clients/:id', async (req, res) => { await q('DELETE FROM crm_clients WHERE id=$1 AND company_id=$2', [req.params.id, cid(req)]); res.json({ ok: true }); });

// Porta nel gestionale il cliente di una richiesta EdilMen che ti ha scelto (solo se ha dato il consenso).
r.post('/clients/from-offer/:offerId', async (req, res) => {
  const o = await one(`SELECT r.id, r.contact_name, r.contact_email, r.contact_phone, r.comune, r.title, r.consents FROM offers o JOIN requests r ON r.id=o.request_id
     WHERE o.id=$1 AND o.company_id=$2 AND o.status='scelta'`, [req.params.offerId, cid(req)]);
  if (!o) return res.status(404).json({ error: 'Il cliente non ti ha ancora scelto' });
  if (!o.consents?.condivisione?.granted) return res.status(403).json({ error: 'Il cliente non ha autorizzato la condivisione dei contatti' });
  const ex = await one('SELECT id FROM crm_clients WHERE company_id=$1 AND request_id=$2', [cid(req), o.id]);
  if (ex) return res.json(ex);
  res.json(await one("INSERT INTO crm_clients(company_id, name, email, phone, comune, stage, source, request_id, notes) VALUES ($1,$2,$3,$4,$5,'sopralluogo','EdilMen',$6,$7) RETURNING *",
    [cid(req), o.contact_name || 'Cliente EdilMen', o.contact_email, o.contact_phone, o.comune, o.id, o.title]));
});

// ---------------- Preventivi ----------------
function totals(items, discount, vat) {
  const lines = (items || []).map((i) => ({ desc: String(i.desc || '').slice(0, 400), unit: String(i.unit || '').slice(0, 20), qty: Number(i.qty) || 0, price: Number(i.price) || 0, pkg: i.pkg || null, section: i.section || null }));
  const sub = lines.reduce((s, i) => s + i.qty * i.price, 0);
  const net = sub * (1 - (Number(discount) || 0));
  return { lines, sub: r2(sub), net: r2(net), vat: r2(net * (Number(vat) || 0)), total: r2(net) };
}
r.get('/quotes', async (req, res) => {
  res.json(await many('SELECT x.*, c.name AS client_name FROM crm_quotes x LEFT JOIN crm_clients c ON c.id=x.client_id WHERE x.company_id=$1 ORDER BY x.created_at DESC LIMIT 500', [cid(req)]));
});
r.get('/quotes/:id', async (req, res) => {
  const x = await own('crm_quotes', req.params.id, req);
  if (!x) return res.status(404).json({ error: 'Preventivo non trovato' });
  const client = x.client_id ? await one('SELECT * FROM crm_clients WHERE id=$1', [x.client_id]) : null;
  res.json({ quote: x, client });
});
async function saveQuote(req, id) {
  const b = req.body || {};
  const t = totals(b.items, b.discount, b.vat_rate ?? 0.1);
  if (!b.title) throw Object.assign(new Error('Dai un titolo al preventivo'), { status: 400 });
  if (b.client_id && !(await own('crm_clients', b.client_id, req))) throw Object.assign(new Error('Cliente non valido'), { status: 400 });
  const vals = [b.client_id || null, b.title, JSON.stringify(t.lines), Number(b.discount) || 0, b.vat_rate ?? 0.1, b.notes || null, b.conditions || null, b.valid_until || null, t.total];
  if (id) {
    return one(`UPDATE crm_quotes SET client_id=$1, title=$2, items=$3, discount=$4, vat_rate=$5, notes=$6, conditions=$7, valid_until=$8, total=$9, updated_at=now()
      WHERE id=$10 AND company_id=$11 RETURNING *`, [...vals, id, cid(req)]);
  }
  const n = await one('SELECT coalesce(max(number),0)+1 AS n FROM crm_quotes WHERE company_id=$1', [cid(req)]);
  return one(`INSERT INTO crm_quotes(company_id, number, client_id, title, items, discount, vat_rate, notes, conditions, valid_until, total, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [cid(req), n.n, ...vals, req.user.id]);
}
r.post('/quotes', async (req, res) => { try { res.json(await saveQuote(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
r.put('/quotes/:id', async (req, res) => {
  try { const x = await saveQuote(req, req.params.id); if (!x) return res.status(404).json({ error: 'Preventivo non trovato' }); res.json(x); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
r.post('/quotes/:id/send', async (req, res) => {
  const x = await own('crm_quotes', req.params.id, req);
  if (!x) return res.status(404).json({ error: 'Preventivo non trovato' });
  const t = x.share_token || token();
  await q("UPDATE crm_quotes SET share_token=$1, status=CASE WHEN status='bozza' THEN 'inviato' ELSE status END, sent_at=COALESCE(sent_at, now()) WHERE id=$2", [t, x.id]);
  if (x.client_id) await q("UPDATE crm_clients SET stage=CASE WHEN stage IN ('contatto','sopralluogo') THEN 'preventivo' ELSE stage END, updated_at=now() WHERE id=$1", [x.client_id]);
  res.json({ token: t });
});
r.post('/quotes/:id/status', async (req, res) => {
  const st = req.body?.status;
  if (!['bozza', 'inviato', 'accettato', 'rifiutato', 'scaduto'].includes(st)) return res.status(400).json({ error: 'Stato non valido' });
  const x = await one('UPDATE crm_quotes SET status=$1, answered_at=CASE WHEN $1 IN (\'accettato\',\'rifiutato\') THEN now() ELSE answered_at END WHERE id=$2 AND company_id=$3 RETURNING *', [st, req.params.id, cid(req)]);
  if (x && st === 'accettato' && x.client_id) await q("UPDATE crm_clients SET stage='cliente' WHERE id=$1", [x.client_id]);
  res.json({ ok: true });
});
r.post('/quotes/:id/duplicate', async (req, res) => {
  const x = await own('crm_quotes', req.params.id, req);
  if (!x) return res.status(404).json({ error: 'Preventivo non trovato' });
  const n = await one('SELECT coalesce(max(number),0)+1 AS n FROM crm_quotes WHERE company_id=$1', [cid(req)]);
  res.json(await one(`INSERT INTO crm_quotes(company_id, number, client_id, title, items, discount, vat_rate, notes, conditions, total, created_by) SELECT company_id, $2, client_id, title || ' (copia)', items, discount, vat_rate, notes, conditions, total, $3 FROM crm_quotes WHERE id=$1 RETURNING *`, [x.id, n.n, req.user.id]));
});
r.delete('/quotes/:id', async (req, res) => { await q('DELETE FROM crm_quotes WHERE id=$1 AND company_id=$2', [req.params.id, cid(req)]); res.json({ ok: true }); });

// Voci pronte dai pacchetti EdilMen, con il prezzo dell'impresa se l'ha inserito.
r.get('/catalog', async (req, res) => {
  const cat = await getCatalog();
  const mine = await many('SELECT pkg, level, price FROM company_prices WHERE company_id=$1', [cid(req)]);
  const m = {}; for (const x of mine) { m[x.pkg] ??= [null, null, null]; m[x.pkg][x.level] = Number(x.price); }
  res.json(cat.packages.map((p) => ({ code: p.code, family: p.family, name: p.name, unit: p.unit, ref: p.prices, mine: m[p.code] || null, acc: p.acc, included: p.checklist.filter((c) => c.state === 'incluso').map((c) => c.title), excluded: p.checklist.filter((c) => c.state === 'escluso').map((c) => c.title) })));
});

// Dal preventivo accettato al cantiere.
r.post('/quotes/:id/to-job', async (req, res) => {
  const x = await own('crm_quotes', req.params.id, req);
  if (!x) return res.status(404).json({ error: 'Preventivo non trovato' });
  const c = x.client_id ? await one('SELECT address, comune FROM crm_clients WHERE id=$1', [x.client_id]) : null;
  const j = await one("INSERT INTO crm_jobs(company_id, client_id, quote_id, title, address, value, status) VALUES ($1,$2,$3,$4,$5,$6,'pianificato') RETURNING *", [cid(req), x.client_id, x.id, x.title, [c?.address, c?.comune].filter(Boolean).join(', ') || null, x.total]);
  res.json(j);
});

// ---------------- Cantieri ----------------
r.get('/jobs', async (req, res) => {
  res.json(await many(`SELECT j.*, c.name AS client_name, (SELECT count(*)::int FROM crm_job_logs l WHERE l.job_id=j.id) AS voci_diario
    FROM crm_jobs j LEFT JOIN crm_clients c ON c.id=j.client_id WHERE j.company_id=$1 ORDER BY (j.status='in_corso') DESC, j.start_date NULLS LAST, j.created_at DESC`, [cid(req)]));
});
r.get('/jobs/:id', async (req, res) => {
  const j = await own('crm_jobs', req.params.id, req);
  if (!j) return res.status(404).json({ error: 'Cantiere non trovato' });
  res.json({
    job: j,
    client: j.client_id ? await one('SELECT * FROM crm_clients WHERE id=$1', [j.client_id]) : null,
    logs: await many('SELECT l.*, u.name AS user_name, u.email AS user_email FROM crm_job_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.job_id=$1 ORDER BY l.at DESC', [j.id]),
    deadlines: await many('SELECT * FROM crm_deadlines WHERE job_id=$1 ORDER BY due', [j.id]),
  });
});
const JF = ['client_id', 'title', 'address', 'status', 'start_date', 'end_date', 'value', 'progress', 'notes'];
r.post('/jobs', async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Dai un nome al cantiere' });
  res.json(await one(`INSERT INTO crm_jobs(company_id, ${JF.join(',')}) VALUES ($1, ${JF.map((_, i) => '$' + (i + 2)).join(',')}) RETURNING *`, [cid(req), ...JF.map((k) => (k === 'status' ? b[k] || 'pianificato' : k === 'progress' ? Number(b[k]) || 0 : b[k] || null))]));
});
r.put('/jobs/:id', async (req, res) => {
  const b = req.body || {};
  const j = await one(`UPDATE crm_jobs SET ${JF.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${JF.length + 1} AND company_id=$${JF.length + 2} RETURNING *`, [...JF.map((k) => (k === 'status' ? b[k] || 'pianificato' : k === 'progress' ? Math.max(0, Math.min(100, Number(b[k]) || 0)) : b[k] || null)), req.params.id, cid(req)]);
  if (!j) return res.status(404).json({ error: 'Cantiere non trovato' });
  res.json(j);
});
r.delete('/jobs/:id', async (req, res) => { await q('DELETE FROM crm_jobs WHERE id=$1 AND company_id=$2', [req.params.id, cid(req)]); res.json({ ok: true }); });
r.post('/jobs/:id/logs', upload.array('photos', 10), async (req, res) => {
  const j = await own('crm_jobs', req.params.id, req);
  if (!j) return res.status(404).json({ error: 'Cantiere non trovato' });
  const ids = [];
  for (const f of req.files || []) {
    if (!/^image\//.test(f.mimetype)) continue;
    const x = await one("INSERT INTO files(owner_user, kind, mime, name, size, data) VALUES ($1,'diario',$2,$3,$4,$5) RETURNING id", [req.user.id, f.mimetype, f.originalname, f.size, f.buffer]);
    ids.push(x.id);
  }
  if (!req.body?.text && !ids.length) return res.status(400).json({ error: 'Scrivi una nota o allega una foto' });
  await q('INSERT INTO crm_job_logs(job_id, user_id, text, hours, photos) VALUES ($1,$2,$3,$4,$5)', [j.id, req.user.id, req.body?.text || null, Number(req.body?.hours) || null, ids]);
  if (j.status === 'pianificato') await q("UPDATE crm_jobs SET status='in_corso', start_date=COALESCE(start_date, current_date) WHERE id=$1", [j.id]);
  res.json({ ok: true });
});

// ---------------- Scadenze ----------------
r.get('/deadlines', async (req, res) => {
  res.json(await many('SELECT d.*, j.title AS job_title FROM crm_deadlines d LEFT JOIN crm_jobs j ON j.id=d.job_id WHERE d.company_id=$1 ORDER BY d.done, d.due', [cid(req)]));
});
r.post('/deadlines', async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.due) return res.status(400).json({ error: 'Servono titolo e data' });
  if (b.job_id && !(await own('crm_jobs', b.job_id, req))) return res.status(400).json({ error: 'Cantiere non valido' });
  res.json(await one('INSERT INTO crm_deadlines(company_id, job_id, title, kind, due, amount) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [cid(req), b.job_id || null, b.title, b.kind || 'attivita', b.due, b.amount || null]));
});
r.patch('/deadlines/:id', async (req, res) => {
  await q('UPDATE crm_deadlines SET done=$1 WHERE id=$2 AND company_id=$3', [!!req.body?.done, req.params.id, cid(req)]);
  res.json({ ok: true });
});
r.delete('/deadlines/:id', async (req, res) => { await q('DELETE FROM crm_deadlines WHERE id=$1 AND company_id=$2', [req.params.id, cid(req)]); res.json({ ok: true }); });

// Le scadenze dei documenti caricati su EdilMen entrano da sole nello scadenziario.
r.post('/deadlines/sync-docs', async (req, res) => {
  const docs = await many("SELECT kind, valid_until FROM company_docs WHERE company_id=$1 AND valid_until IS NOT NULL AND status<>'rifiutato'", [cid(req)]);
  let n = 0;
  const L = { visura: 'Visura camerale', durc: 'DURC', rc: 'Assicurazione RC', patente: 'Patente a crediti', soa: 'Attestazione SOA', iso: 'ISO 9001' };
  for (const d of docs) {
    const title = `Rinnovo ${L[d.kind] || d.kind}`;
    const ex = await one('SELECT id FROM crm_deadlines WHERE company_id=$1 AND title=$2 AND due=$3', [cid(req), title, d.valid_until]);
    if (!ex) { await q("INSERT INTO crm_deadlines(company_id, title, kind, due) VALUES ($1,$2,'documento',$3)", [cid(req), title, d.valid_until]); n++; }
  }
  res.json({ added: n });
});

export default r;
