// EdilMen 2027 — motore prezzi.
// Funzioni pure, identiche nel browser e nel server.
//
// Regole (dal listino "Pacchetti edili standardizzati" v1.1):
//  - parte fissa  = prezzo del livello × (1 + Σ varianti ammesse)
//  - prudente     = parte fissa × (1 + accantonamento per componenti variabili)
//    → al sopralluogo il prezzo può solo scendere, fino alla parte fissa.
//  - coefficiente di zona (provincia) × coefficienti logistici del cantiere
//  - oneri della sicurezza, spese tecniche se richieste, IVA.

export const LEVELS = ['Standard', 'Intermedio', 'Premium'];

const FVG = ['UD', 'GO', 'TS', 'PN'];
const VENETO = ['VR', 'VI', 'PD', 'TV', 'VE', 'BL', 'RO'];

export function territoryCoef(params, sigla, montagna = false) {
  const T = params.territorio || {};
  if (!sigla) return { coef: 1, calibrated: false, label: 'Zona non indicata: base Trento' };
  if (sigla === 'TN') return montagna && T.TN_montagna ? { coef: T.TN_montagna, calibrated: true, label: 'Trentino, zona turistica/montana' } : { coef: T.TN ?? 1, calibrated: true, label: 'Trento, base EPPAT' };
  if (T[sigla] != null) return { coef: T[sigla], calibrated: true, label: `Provincia di ${sigla}` };
  if (FVG.includes(sigla)) return { coef: T.FVG ?? 0.96, calibrated: true, label: 'Friuli-Venezia Giulia' };
  if (VENETO.includes(sigla)) return { coef: 0.96, calibrated: true, label: 'Veneto' };
  return { coef: 1, calibrated: false, label: `Provincia di ${sigla}: prezzo base Trento, listino regionale non ancora tarato` };
}

export function logisticsCoef(params, flags = []) {
  const g = params.logistica || {};
  let c = 1;
  const applied = [];
  const map = { abitata: 'Casa abitata durante i lavori', noasc: 'Piano alto senza ascensore', ztl: 'Centro storico / accesso difficile', montagna: 'Località oltre 1.000 m' };
  for (const f of new Set(flags)) {
    if (g[f]) { c *= g[f]; applied.push({ flag: f, label: map[f] || f, coef: g[f] }); }
  }
  return { coef: c, applied };
}

export function findPackage(catalog, code) {
  return catalog.packages.find((p) => p.code === code);
}

// Prezzo unitario di un pacchetto per livello, con varianti, partendo dal listino EdilMen
// o da un listino d'impresa (override: { R03: [std, int, prem] }).
export function unitPrice(catalog, code, level, variantCodes = [], override = null) {
  const p = findPackage(catalog, code);
  if (!p) throw new Error(`Pacchetto ${code} non trovato`);
  const base = override && override[code] && override[code][level] != null ? Number(override[code][level]) : p.prices[level];
  let factor = 1;
  const used = [];
  for (const vc of variantCodes || []) {
    const v = catalog.variants.find((x) => x.code === vc && x.pkg === code);
    if (v && v.levels.includes(level)) { factor *= 1 + v.delta; used.push(v); }
  }
  const fixed = base * factor;
  return { fixed, prudent: fixed * (1 + (p.acc || 0)), acc: p.acc || 0, variants: used, pkg: p };
}

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * spec = {
 *   level: 0|1|2,
 *   province: 'TN', montagna: false,
 *   flags: ['abitata','noasc','ztl','montagna'],
 *   tecnico: false,          // spese tecniche richieste
 *   iva: 'ristrutturazione' | 'primaCasaNuova' | 'ordinaria' | 'nessuna',
 *   lines: [{ pkg:'R03', qty:1, variants:['VA05'], label? }]
 * }
 */
export function computeQuote(catalog, spec, override = null) {
  const P = catalog.params;
  const level = spec.level ?? 1;
  const terr = territoryCoef(P, spec.province, spec.montagna);
  const logi = logisticsCoef(P, spec.flags || []);
  const coef = terr.coef * logi.coef;
  const lines = [];
  const missing = [];
  for (const l of spec.lines || []) {
    if (!l || !l.qty || l.qty <= 0) continue;
    if (override && !(override[l.pkg] && override[l.pkg][level] != null)) { missing.push(l.pkg); continue; }
    const u = unitPrice(catalog, l.pkg, level, l.variants, override);
    const qty = Number(l.qty);
    lines.push({
      pkg: l.pkg,
      name: l.label || u.pkg.name + (u.variants.length ? ', ' + u.variants.map((v) => v.name.charAt(0).toLowerCase() + v.name.slice(1)).join(', ') : ''),
      family: u.pkg.family,
      unit: l.unitLabel || u.pkg.unit,
      qty: r2(qty),
      unitFixed: r2(u.fixed * coef * (l.unitFactor || 1)),
      unitPrudent: r2(u.prudent * coef * (l.unitFactor || 1)),
      totFixed: r2(u.fixed * coef * qty * (l.unitFactor || 1)),
      totPrudent: r2(u.prudent * coef * qty * (l.unitFactor || 1)),
      acc: u.acc,
      duration: u.pkg.duration,
      permit: u.pkg.permit,
    });
  }
  const sum = (k) => lines.reduce((s, x) => s + x[k], 0);
  const build = (lavori) => {
    const sicurezza = lavori * (P.sicurezza || 0);
    const hasNew = lines.some((l) => l.pkg.startsWith('N'));
    const tecniche = spec.tecnico ? (lavori + sicurezza) * (P.tecniche || 0) : 0;
    const imponibile = lavori + sicurezza + tecniche;
    const ivaRate = spec.iva === 'nessuna' ? 0 : spec.iva === 'ordinaria' ? P.ivaOrdinaria : spec.iva === 'primaCasaNuova' ? P.ivaPrimaCasaNuova : hasNew && spec.iva == null ? P.ivaOrdinaria : P.ivaRistrutturazione;
    const iva = imponibile * (ivaRate || 0);
    return { lavori: r2(lavori), sicurezza: r2(sicurezza), tecniche: r2(tecniche), imponibile: r2(imponibile), ivaRate, iva: r2(iva), totale: r2(imponibile + iva) };
  };
  const prudent = build(sum('totPrudent'));
  const fixed = build(sum('totFixed'));
  return {
    level, levelName: LEVELS[level],
    territory: terr, logistics: logi, coef: r2(coef * 10000) / 10000,
    lines, missing,
    prudent, fixed,
    // il range onesto: dal prezzo della sola parte fissa (minimo) al prudente (massimo)
    range: { min: fixed.imponibile, max: prudent.imponibile },
  };
}

// Fee EdilMen a scaglioni sul valore del contratto (IVA esclusa).
// rules.brackets = [{ upTo: 50000, rate: 0.08 }, { upTo: 3000000, rate: 0.06 }, { upTo: null, rate: 0.04 }]
// rules.mode = 'flat' (aliquota dello scaglione in cui cade l'intero importo) | 'progressive' (a scaglioni marginali)
export const DEFAULT_FEE_RULES = {
  mode: 'flat',
  brackets: [
    { upTo: 50000, rate: 0.08 },
    { upTo: 3000000, rate: 0.06 },
    { upTo: null, rate: 0.04 },
  ],
};

export function feeFor(value, rules = DEFAULT_FEE_RULES) {
  const v = Math.max(0, Number(value) || 0);
  const b = [...rules.brackets].sort((a, c) => (a.upTo ?? Infinity) - (c.upTo ?? Infinity));
  if (rules.mode === 'progressive') {
    let prev = 0, fee = 0;
    for (const x of b) {
      const top = x.upTo ?? Infinity;
      if (v > prev) fee += (Math.min(v, top) - prev) * x.rate;
      prev = top;
    }
    return { fee: r2(fee), rate: v ? fee / v : 0 };
  }
  const x = b.find((y) => v <= (y.upTo ?? Infinity)) || b[b.length - 1];
  return { fee: r2(v * x.rate), rate: x.rate };
}

// Piano SAL: divide il contratto e la fee per milestone.
export function salPlan(value, sal, rules = DEFAULT_FEE_RULES) {
  const { fee, rate } = feeFor(value, rules);
  return sal.map((s, i) => ({ n: i + 1, name: s.name, document: s.document, share: s.share, amount: r2(value * s.share), fee: r2(fee * s.share), rate }));
}

// Distanza in km tra due coordinate.
export function km(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, d = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * d) / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(((b.lon - a.lon) * d) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

export const eur = (v, dec = 0) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(v) || 0);
