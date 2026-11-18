import crypto from 'node:crypto';
import { one, q } from './db.js';
import { computeQuote } from '../../shared/pricing.js';
import { linesFromAnswers, LAVORI } from '../../shared/lavori.js';
import { findComune, getCatalog } from './data.js';
import { matchRequest } from './network.js';

export const token = () => crypto.randomBytes(18).toString('base64url');

// Dalle risposte del quotatore alla specifica di calcolo (ricalcolata sempre sul server).
export async function buildQuote(answers) {
  const cat = await getCatalog();
  const com = findComune(answers.comune, answers.provincia);
  const flags = (answers.flags || []).filter((f) => ['abitata', 'noasc', 'ztl', 'montagna'].includes(f));
  const lines = linesFromAnswers(answers);
  const spec = {
    level: [0, 1, 2].includes(Number(answers.level)) ? Number(answers.level) : 1,
    province: com?.sigla || answers.provincia || null,
    montagna: flags.includes('montagna'),
    flags,
    tecnico: answers.tecnico === 'aiuto',
    iva: answers.iva || null,
    lines,
  };
  const quote = computeQuote(cat, spec);
  const labels = (answers.lavori || []).map((id) => LAVORI.find((l) => l.id === id)?.label).filter(Boolean);
  return { spec, quote, com, title: labels.slice(0, 3).join(' + ') + (labels.length > 3 ? ` + altri ${labels.length - 3}` : '') };
}

export async function nextCode() {
  const r = await one("SELECT nextval(pg_get_serial_sequence('requests','id')) AS n");
  return { id: Number(r.n), code: 'EM27-' + String(r.n).padStart(6, '0') };
}

export async function createRequest({ answers = {}, kind = 'casa', source = 'sito', status = 'nuova', userId = null, agencyId = null, propertyId = null, contact = {}, consents = {}, description = null, items = null, voiceFile = null, deadline = null, title = null, runMatching = true, actor = null }) {
  let spec = {}, quote = null, com = findComune(answers.comune, answers.provincia), t = title;
  if (kind === 'casa' && answers.lavori?.length) {
    const b = await buildQuote(answers);
    spec = b.spec; quote = b.quote; com = b.com; t = t || b.title;
  }
  const { id, code } = await nextCode();
  const share = token();
  await q(
    `INSERT INTO requests(id, code, kind, source, status, user_id, agency_id, property_id, contact_name, contact_email, contact_phone, contact_channel,
       title, description, answers, spec, quote, items, total_ref, comune, provincia, regione, lat, lon, consents, voice_file, share_token, deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
    [id, code, kind, source, status, userId, agencyId, propertyId, contact.name || null, contact.email || null, contact.phone || null, contact.channel || null,
      t || (kind === 'computo' ? 'Richiesta d\'offerta su computo' : kind === 'vocale' ? 'Richiesta con messaggio vocale' : 'Richiesta'),
      description, JSON.stringify(answers), JSON.stringify(spec), quote ? JSON.stringify(quote) : null, items ? JSON.stringify(items) : null,
      quote ? quote.prudent.imponibile : null, com?.nome || answers.comune || null, com?.sigla || answers.provincia || null, com?.regione || null, com?.lat ?? null, com?.lon ?? null,
      JSON.stringify(consents), voiceFile, share, deadline]);
  await q("INSERT INTO request_events(request_id, user_id, type, data) VALUES ($1,$2,'creata',$3)", [id, actor || userId, JSON.stringify({ source, kind })]);
  const row = await one('SELECT * FROM requests WHERE id=$1', [id]);
  let match = { auto: 0, invited: 0 };
  if (runMatching && kind === 'casa' && source !== 'stima') match = await matchRequest(row, actor);
  return { ...row, match };
}

export async function logEvent(requestId, userId, type, data = {}) {
  await q('INSERT INTO request_events(request_id, user_id, type, data) VALUES ($1,$2,$3,$4)', [requestId, userId || null, type, JSON.stringify(data)]);
}
