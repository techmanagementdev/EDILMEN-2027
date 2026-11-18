import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { one, q } from './db.js';
import { DEFAULT_FEE_RULES } from '../../shared/pricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', f), 'utf8'));

// ---------------- Comuni (ISTAT + coordinate) ----------------
const C = seed('comuni.json');
export const REGIONI = Object.fromEntries(Object.entries(C.regioni).map(([k, v]) => [k, v.split('/')[0]]));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const COMUNI = C.comuni.map(([nome, sigla, reg, lat, lon, pop]) => ({ nome, sigla, regione: REGIONI[reg], lat, lon, pop, k: norm(nome) }));
const byKey = new Map();
for (const c of COMUNI) {
  byKey.set(c.k + '|' + c.sigla, c);
  if (!byKey.has(c.k)) byKey.set(c.k, c);
}
export function searchComuni(term, limit = 8) {
  const t = norm(term);
  if (t.length < 2) return [];
  const starts = [], contains = [];
  for (const c of COMUNI) {
    if (c.k.startsWith(t)) starts.push(c);
    else if (c.k.includes(t)) contains.push(c);
  }
  const sort = (a, b) => (b.pop || 0) - (a.pop || 0);
  return [...starts.sort(sort), ...contains.sort(sort)].slice(0, limit).map(({ k, ...c }) => c);
}
export function findComune(nome, sigla) {
  if (!nome) return null;
  const c = (sigla && byKey.get(norm(nome) + '|' + sigla)) || byKey.get(norm(nome));
  if (!c) return null;
  const { k, ...rest } = c;
  return rest;
}
export const PROVINCE = [...new Set(COMUNI.map((c) => c.sigla))].sort();

// ---------------- Impostazioni ----------------
const cache = new Map();
export const DEFAULT_SETTINGS = {
  fee_rules: DEFAULT_FEE_RULES,
  plans: [
    { id: 'free', name: 'Scheda gratuita', price: 0, caps: { listino: false, report: false, crm: false, team: 1 }, features: ['Scheda pubblica e rivendicazione', 'Inviti a quotare le richieste compatibili', 'Fee solo sui lavori firmati'] },
    { id: 'base', name: 'Base', price: 30, caps: { listino: true, report: true, crm: false, team: 2 }, features: ['Il tuo listino nel quotatore: le offerte partono da sole', 'Report mensile di visite alla scheda', 'Più visibilità nell\'elenco', '2 utenti'] },
    { id: 'plus', name: 'Plus', price: 50, caps: { listino: true, report: true, crm: true, team: 5 }, features: ['Tutto di Base', 'Gestionale: clienti, preventivi, cantieri, scadenze', 'Preventivi con accettazione online', '5 utenti'] },
  ],
  trial_days: 30,
  matching: { listinoRequiresPlan: true, radiusKm: 60, maxOffers: 3, inviteTop: 3, priceHigh: 0.15, priceAnomalous: -0.25 },
  payment_mode_default: 'diretto',
  billing: { intestatario: 'European Management Institute S.r.l.', iban: '', causale: 'Abbonamento EdilMen {piano} — {impresa}', note: 'Dopo il bonifico attiviamo il piano entro un giorno lavorativo.' },
  consent_version: '2027-01',
  contacts: { phone: '', email: '', whatsapp: '' },
};
export async function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const r = await one('SELECT value FROM settings WHERE key=$1', [key]);
  const v = r ? r.value : DEFAULT_SETTINGS[key];
  cache.set(key, v);
  return v;
}
export async function setSetting(key, value, userId) {
  await q('INSERT INTO settings(key, value, updated_by) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now(), updated_by=$3', [key, JSON.stringify(value), userId || null]);
  cache.set(key, value);
}

// ---------------- Catalogo pacchetti ----------------
let catalogCache = null;
export async function getCatalog() {
  if (catalogCache) return catalogCache;
  let r = await one('SELECT id, version, data FROM catalog_versions WHERE active ORDER BY id DESC LIMIT 1');
  if (!r) {
    const data = seed('catalogo.json');
    r = await one("INSERT INTO catalog_versions(version, data, note, active) VALUES ($1,$2,'Listino EdilMen v1.1 (seed iniziale)', true) RETURNING id, version, data", [data.version || '1.1', JSON.stringify(data)]);
  }
  catalogCache = { ...r.data, id: r.id, version: r.version };
  return catalogCache;
}
export async function activateCatalog(data, note, userId) {
  await q('UPDATE catalog_versions SET active=false WHERE active');
  const r = await one('INSERT INTO catalog_versions(version, data, note, active, created_by) VALUES ($1,$2,$3,true,$4) RETURNING id', [data.version || 'nuova', JSON.stringify(data), note || null, userId || null]);
  catalogCache = null;
  return r.id;
}
export function invalidateCatalog() { catalogCache = null; }

// Versione pubblica del catalogo (senza note interne).
export function publicCatalog(cat) {
  return {
    version: cat.version,
    params: { sicurezza: cat.params.sicurezza, tecniche: cat.params.tecniche, ivaRistrutturazione: cat.params.ivaRistrutturazione, ivaPrimaCasaNuova: cat.params.ivaPrimaCasaNuova, ivaOrdinaria: cat.params.ivaOrdinaria, ribassoVariabili: cat.params.ribassoVariabili, logistica: cat.params.logistica, territorio: cat.params.territorio, sal: cat.params.sal },
    variants: cat.variants,
    packages: cat.packages.map(({ notes, ...p }) => p),
  };
}

export const slugify = (s) => norm(s).replace(/ /g, '-').slice(0, 60);
export { norm };
