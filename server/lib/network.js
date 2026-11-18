// Rete delle imprese: rating calcolato dai fatti e matching richiesta ↔ imprese.
import { many, one, q } from './db.js';
import { computeQuote, km } from '../../shared/pricing.js';
import { getCatalog, getSetting } from './data.js';

const DOCS = ['visura', 'durc', 'rc', 'patente'];

// Metodologia pubblica (pagina /rating): recensioni 60%, documenti 25%, comportamento 15%.
export async function ratingFor(companyId) {
  const reviews = await many("SELECT scores, created_at FROM reviews WHERE company_id=$1 AND status='pubblicata' AND created_at > now() - interval '3 years'", [companyId]);
  const docs = await many("SELECT kind, valid_until FROM company_docs WHERE company_id=$1 AND status='verificato' AND (valid_until IS NULL OR valid_until >= current_date)", [companyId]);
  const beh = await one(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE status <> 'invitata' AND responded_at IS NOT NULL AND responded_at - invited_at <= interval '24 hours')::int AS fast
       FROM offers WHERE company_id=$1 AND source='invito'`, [companyId]);

  let wsum = 0, ssum = 0;
  const yearAgo = Date.now() - 365 * 86400000;
  const dims = { qualita: 0, puntualita: 0, preventivo: 0, pulizia: 0, comunicazione: 0 };
  for (const r of reviews) {
    const vals = Object.values(r.scores).map(Number).filter((x) => x >= 1 && x <= 5);
    if (!vals.length) continue;
    const w = new Date(r.created_at).getTime() > yearAgo ? 2 : 1;
    wsum += w; ssum += w * (vals.reduce((a, b) => a + b, 0) / vals.length);
    for (const k of Object.keys(dims)) if (r.scores[k]) dims[k] += w * Number(r.scores[k]);
  }
  const revScore = wsum ? ssum / wsum : null;
  for (const k of Object.keys(dims)) dims[k] = wsum ? Math.round((dims[k] / wsum) * 10) / 10 : null;
  const verified = new Set(docs.map((d) => d.kind));
  const docScore = (DOCS.filter((d) => verified.has(d)).length / 4) * 5;
  const behScore = beh.n >= 3 ? (beh.fast / beh.n) * 5 : null;

  let value = null;
  if (revScore != null) {
    const parts = [[revScore, 0.6], [docScore, 0.25]];
    if (behScore != null) parts.push([behScore, 0.15]);
    const wt = parts.reduce((s, p) => s + p[1], 0);
    value = Math.round((parts.reduce((s, p) => s + p[0] * p[1], 0) / wt) * 10) / 10;
  }
  const missing = [];
  if (reviews.length < 3) missing.push(`${3 - reviews.length} recensioni verificate di lavori conclusi`);
  if (!verified.has('visura')) missing.push('visura camerale verificata');
  const published = reviews.length >= 3 && verified.has('visura');
  return {
    published,
    value: published ? value : null,
    reviews: reviews.length,
    dims: published ? dims : null,
    docs: Object.fromEntries(['visura', 'durc', 'rc', 'patente', 'soa', 'iso'].map((k) => [k, verified.has(k)])),
    behavior: behScore != null ? { cases: beh.n, fast: beh.fast } : null,
    missing,
  };
}

async function approvedPrices(companyIds) {
  if (!companyIds.length) return {};
  const rows = await many("SELECT company_id, pkg, level, price FROM company_prices WHERE status='approvato' AND company_id = ANY($1)", [companyIds]);
  const out = {};
  for (const r of rows) {
    out[r.company_id] ??= {};
    out[r.company_id][r.pkg] ??= [null, null, null];
    out[r.company_id][r.pkg][r.level] = Number(r.price);
  }
  return out;
}

// Imprese della rete compatibili con la zona della richiesta, ordinate per distanza.
export async function candidates(reqRow) {
  const M = await getSetting('matching');
  const rows = await many("SELECT * FROM companies WHERE status='attiva' AND network AND receive_requests");
  const here = reqRow.lat != null ? { lat: reqRow.lat, lon: reqRow.lon } : null;
  const out = [];
  for (const c of rows) {
    const d = here && c.lat != null ? km(here, { lat: c.lat, lon: c.lon }) : null;
    const inProv = reqRow.provincia && (c.provinces_served.includes(reqRow.provincia) || c.provincia === reqRow.provincia);
    const inRadius = d != null && d <= Math.max(c.radius_km || 0, M.radiusKm || 60);
    const value = Number(reqRow.total_ref) || 0;
    const tooSmall = c.min_job && value && value < Number(c.min_job) * 0.8;
    const tooBig = c.max_job && value && value > Number(c.max_job) * 1.2;
    if ((inProv || inRadius) && !tooSmall && !tooBig) out.push({ ...c, km: d });
  }
  return out.sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
}

// Crea le offerte automatiche dai listini approvati e invita le altre imprese della zona.
export async function matchRequest(reqRow, userId = null) {
  if (reqRow.kind !== 'casa' || !reqRow.spec?.lines?.length) return { auto: 0, invited: 0 };
  const M = await getSetting('matching');
  const cat = await getCatalog();
  const list = await candidates(reqRow);
  const prices = await approvedPrices(list.map((c) => c.id));
  let auto = 0, invited = 0;
  const withoutPrices = [];
  for (const c of list) {
    const ov = prices[c.id];
    if (ov) {
      const quote = computeQuote(cat, reqRow.spec, ov);
      if (!quote.missing.length && quote.lines.length) {
        await q(
          `INSERT INTO offers(request_id, company_id, source, status, amount, quote, responded_at)
           VALUES ($1,$2,'listino','inviata',$3,$4,now())
           ON CONFLICT (request_id, company_id) DO NOTHING`,
          [reqRow.id, c.id, quote.prudent.imponibile, JSON.stringify(quote)]);
        auto++;
        continue;
      }
    }
    withoutPrices.push(c);
  }
  const room = Math.max(0, (M.inviteTop ?? 3) - auto);
  for (const c of withoutPrices.slice(0, room)) {
    const r = await q("INSERT INTO offers(request_id, company_id, source, status) VALUES ($1,$2,'invito','invitata') ON CONFLICT DO NOTHING", [reqRow.id, c.id]);
    invited += r.rowCount;
  }
  if (auto || invited) {
    await q("INSERT INTO request_events(request_id, user_id, type, data) VALUES ($1,$2,'matching',$3)", [reqRow.id, userId, JSON.stringify({ auto, invited })]);
  }
  return { auto, invited };
}

// Offerte da mostrare al cliente: solo reali, anonime fino all'appuntamento, al massimo N.
export async function clientOffers(requestId, reveal = false) {
  const M = await getSetting('matching');
  const rows = await many(
    `SELECT o.id, o.amount, o.start_days, o.note, o.status, o.quote, o.source, c.id AS company_id, c.name, c.comune, c.provincia, c.years_active, c.employees, c.slug
       FROM offers o JOIN companies c ON c.id=o.company_id
      WHERE o.request_id=$1 AND o.status IN ('inviata','scelta') AND o.amount IS NOT NULL
      ORDER BY o.amount ASC`, [requestId]);
  const out = [];
  let i = 0;
  for (const r of rows.slice(0, M.maxOffers || 3)) {
    const rating = await ratingFor(r.company_id);
    out.push({
      id: r.id,
      letter: String.fromCharCode(65 + i++),
      amount: r.amount,
      start_days: r.start_days,
      note: r.note,
      status: r.status,
      source: r.source,
      lines: r.quote?.lines || null,
      rating,
      company: reveal || r.status === 'scelta' ? { name: r.name, comune: r.comune, provincia: r.provincia, slug: r.slug } : { comune: null, provincia: r.provincia },
      years_active: r.years_active,
      employees: r.employees,
    });
  }
  return out;
}
