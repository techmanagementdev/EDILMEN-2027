// Classificazione della descrizione libera ("rifare bagno e cucina, 80 mq a Trento")
// nei lavori del quotatore. Con ANTHROPIC_API_KEY usa Claude; altrimenti parole chiave.
import { LAVORI } from '../../shared/lavori.js';

const KEYWORDS = {
  completa: ['ristrutturazione completa', 'tutta la casa', 'ristrutturare casa', 'rifare casa', 'da rifare tutta'],
  rinnovo: ['rinfrescare', 'rinnovo', 'lifting', 'senza impianti'],
  distribuzione: ['muro', 'muri', 'tramezz', 'abbattere', 'spostare pareti'],
  sgombero: ['sgombero', 'svuotare', 'strip'],
  bagno: ['bagno', 'bagni', 'doccia', 'vasca', 'sanitari'],
  cucina: ['cucina'],
  pavimenti: ['pavimento', 'pavimenti', 'parquet', 'piastrelle'],
  pitture: ['pittura', 'pitture', 'tinteggi', 'imbiancare', 'pareti'],
  cartongesso: ['cartongesso', 'controsoffitt'],
  porte: ['porte interne', 'porta interna', 'porte'],
  finestre: ['finestre', 'serramenti', 'infissi'],
  blindato: ['blindat', 'portoncino'],
  elettrico: ['elettric', 'prese', 'quadro'],
  idraulico: ['idraulic', 'tubi', 'scarichi'],
  clima: ['condizionator', 'clima', 'split', 'aria condizionata'],
  caldaia: ['caldaia'],
  wallbox: ['wallbox', 'ricarica auto', 'colonnina'],
  domotica: ['domotic', 'smart home', 'casa smart'],
  pdc: ['pompa di calore', 'pdc'],
  fv: ['fotovoltaic', 'pannelli solari', 'pannelli'],
  cappotto: ['cappotto', 'isolamento esterno', 'isolare la casa'],
  sottotetto: ['sottotetto', 'soffitta'],
  vmc: ['vmc', 'ventilazione'],
  boiler: ['scaldacqua', 'boiler'],
  tetto: ['tetto', 'copertura', 'tegole'],
  facciata: ['facciata', 'facciate'],
  terrazzo: ['terrazz', 'balcon', 'infiltrazion'],
  giardino: ['giardino', 'cortile', 'vialett', 'esterni'],
  casanuova: ['casa nuova', 'costruire casa', 'nuova costruzione', 'villetta'],
  rustico: ['rustico', 'grezzo'],
  ampliamento: ['ampliamento', 'ampliare', 'sopraelev'],
  garage: ['garage', 'interrato', 'cantina'],
  demolizione: ['demolire', 'demolizione'],
};

function byKeywords(text) {
  const t = String(text || '').toLowerCase();
  let ids = Object.entries(KEYWORDS).filter(([, ks]) => ks.some((k) => t.includes(k))).map(([id]) => id);
  if (ids.includes('completa')) ids = ids.filter((i) => !['bagno', 'pavimenti', 'pitture', 'elettrico', 'idraulico', 'porte', 'rinnovo'].includes(i));
  const mq = t.match(/(\d{2,4})\s*(m2|mq|m²|metri)/);
  return { lavori: ids, mq: mq ? Number(mq[1]) : null, engine: 'parole chiave' };
}

export async function classify(text) {
  const base = byKeywords(text);
  if (!process.env.ANTHROPIC_API_KEY) return base;
  try {
    const catalog = LAVORI.map((l) => `${l.id}: ${l.label} — ${l.sub}`).join('\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
        max_tokens: 300,
        system: 'Classifichi richieste di lavori edili in italiano. Rispondi SOLO con JSON {"lavori":[id...],"mq":numero|null,"comune":stringa|null}. Usa solo id dalla lista. Non inventare.',
        messages: [{ role: 'user', content: `Lavori disponibili:\n${catalog}\n\nRichiesta del cliente:\n${String(text).slice(0, 2000)}` }],
      }),
    });
    if (!r.ok) return base;
    const j = await r.json();
    const m = (j.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    if (!m) return base;
    const p = JSON.parse(m[0]);
    const ids = (p.lavori || []).filter((id) => LAVORI.some((l) => l.id === id));
    return { lavori: ids.length ? ids : base.lavori, mq: p.mq || base.mq, comune: p.comune || null, engine: 'Claude' };
  } catch {
    return base;
  }
}
