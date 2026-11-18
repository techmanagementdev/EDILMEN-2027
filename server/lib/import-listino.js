// Legge il file Excel "EdilMen — Pacchetti edili standardizzati" (v1.1 e successive)
// e restituisce il catalogo usato dal motore prezzi (shared/pricing.js).
// Prende solo ciò che serve al cliente e al calcolo: pacchetti, varianti, componenti
// variabili, checklist (incluso / a parte / escluso), parametri e coefficienti.
// Le voci elementari, la composizione interna e gli scostamenti EPPAT restano nel file.
import ExcelJS from 'exceljs';

const val = (c) => {
  if (c == null) return null;
  if (typeof c === 'object') {
    if ('result' in c) return c.result ?? null;
    if ('richText' in c) return c.richText.map((t) => t.text).join('');
    if ('text' in c) return c.text;
  }
  return c;
};
const rows = (ws) => {
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = val(cell.value); });
    out.push(arr);
  });
  return out;
};
const num = (x) => (typeof x === 'number' ? x : x == null || x === '' ? null : Number(String(x).replace(',', '.')));
const round2 = (x) => Math.round(x * 100) / 100;

const LEVELS_MAP = (s) => {
  const t = String(s || 'Tutti').toLowerCase();
  if (t.includes('tutti')) return [0, 1, 2];
  const l = [];
  if (t.includes('standard')) l.push(0);
  if (t.includes('intermedio')) l.push(1);
  if (t.includes('premium')) l.push(2);
  return l.length ? l : [0, 1, 2];
};

export async function importListino(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = (n) => {
    const ws = wb.getWorksheet(n);
    if (!ws) throw new Error(`Nel file manca il foglio ${n}`);
    return rows(ws);
  };

  // ---- Pacchetti
  const cat = sheet('CATALOGO_PACCHETTI');
  const hIdx = cat.findIndex((r) => r && r[0] === 'Codice');
  if (hIdx < 0) throw new Error('CATALOGO_PACCHETTI: intestazione "Codice" non trovata');
  const H = cat[hIdx].map((h) => String(h || '').trim());
  const col = (name) => H.findIndex((h) => h.toLowerCase().startsWith(name.toLowerCase()));
  const C = {
    code: col('Codice'), chapter: col('Capitolo'), family: col('Famiglia'), name: col('Pacchetto'), solves: col('Cosa risolve'),
    unit: col('UdM'), refQty: col('Q.tà rif'), scenario: col('Scenario medio di riferimento'), std: col('STANDARD €'), int: col('INTERMEDIO €'),
    prem: col('PREMIUM €'), acc: col('Accanton'), items: col('N° voci'), duration: col('Durata'), permit: col('Titolo abilitativo'), notes: col('Note'),
  };
  const packages = [];
  for (const r of cat.slice(hIdx + 1)) {
    if (!r || !/^[RN]\d+/.test(String(r[C.code] || ''))) continue;
    const prices = [num(r[C.std]), num(r[C.int]), num(r[C.prem])];
    if (prices.some((p) => p == null || Number.isNaN(p))) continue;
    packages.push({
      code: String(r[C.code]).trim(),
      chapter: String(r[C.chapter] || '').replace(/^\d+\s*-\s*/, ''),
      family: r[C.family] || '',
      name: r[C.name] || '',
      solves: r[C.solves] || '',
      unit: r[C.unit] || '',
      refQty: num(r[C.refQty]) || 1,
      scenario: r[C.scenario] || '',
      prices: prices.map(round2),
      acc: num(r[C.acc]) || 0,
      items: num(r[C.items]) || null,
      duration: r[C.duration] || '',
      permit: r[C.permit] || '',
      notes: C.notes >= 0 ? r[C.notes] || '' : '',
      checklist: [],
      variables: [],
    });
  }
  const byCode = Object.fromEntries(packages.map((p) => [p.code, p]));

  // ---- Checklist cliente
  for (const r of sheet('CHECKLIST_UTENTE')) {
    const p = r && byCode[r[0]];
    if (!p || typeof r[1] !== 'number') continue;
    const s = String(r[2] || '');
    const state = s.includes('✔') ? 'incluso' : s.includes('±') ? 'a_parte' : s.includes('✖') ? 'escluso' : 'incluso';
    p.checklist.push({ state, title: r[3] || '', detail: r[4] || '', levels: [r[5] || '', r[6] || '', r[7] || ''] });
  }

  // ---- Varianti
  const variants = [];
  for (const r of sheet('VARIANTI')) {
    if (!r || !/^VA\d+/.test(String(r[0] || ''))) continue;
    variants.push({ code: r[0], pkg: r[1], name: r[3] || '', what: r[4] || '', delta: num(r[5]) || 0, levels: LEVELS_MAP(r[6]) });
  }

  // ---- Componenti variabili (fuori pacchetto, a misura con ribasso)
  for (const r of sheet('COMPONENTI_VARIABILI')) {
    const p = r && byCode[r[0]];
    if (!p || !r[2]) continue;
    p.variables.push({ code: r[2], name: r[3] || '', when: r[4] || '', unit: r[5] || '', prices: [num(r[6]), num(r[7]), num(r[8])] });
  }

  // ---- Parametri
  const par = sheet('PARAMETRI');
  const find = (label) => {
    const r = par.find((x) => x && String(x[0] || '').toLowerCase().startsWith(label.toLowerCase()));
    return r ? num(r[1]) : null;
  };
  const params = {
    sicurezza: find('Oneri della sicurezza') ?? 0.025,
    tecniche: find('Spese tecniche') ?? 0.08,
    ivaRistrutturazione: find('IVA ristrutturazione') ?? 0.1,
    ivaPrimaCasaNuova: find('IVA nuova costruzione') ?? 0.04,
    ivaOrdinaria: find('IVA ordinaria') ?? 0.22,
    ribassoVariabili: find('Ribasso contrattuale') ?? 0.1,
    franchigia: find('Franchigia') ?? 0.05,
    oraSpecializzato: find('Operaio specializzato') ?? 42,
    oraQualificato: find('Operaio qualificato') ?? 38,
    oraComune: find('Operaio comune') ?? 33,
    maggiorazioneMateriali: find('Maggiorazione materiali') ?? 0.15,
    logistica: {
      abitata: find('Casa abitata') ?? 1.08,
      noasc: find('Piano alto') ?? 1.05,
      ztl: find('Centro storico') ?? 1.05,
      montagna: find('Località di montagna') ?? 1.06,
    },
    territorio: {
      TN: find('Trento (base') ?? 1,
      TN_montagna: find('Provincia di Trento – zone') ?? 1.06,
      BZ: find('Bolzano') ?? 1.1,
      VR: find('Verona') ?? 0.96,
      VI: find('Vicenza') ?? 0.95,
      PD: find('Padova') ?? 0.95,
      TV: find('Treviso') ?? 0.95,
      VE: find('Venezia') ?? 1.02,
      BL: find('Belluno') ?? 0.98,
      RO: 0.95,
      FVG: find('Friuli') ?? 0.96,
    },
    sal: [],
  };
  const salStart = par.findIndex((r) => r && String(r[0] || '').startsWith('PIANO PAGAMENTI'));
  if (salStart >= 0) {
    for (const r of par.slice(salStart + 2)) {
      if (!r || !r[0] || String(r[0]).startsWith('Totale')) break;
      params.sal.push({ name: r[0], share: num(r[1]) || 0, document: r[2] || '' });
    }
  }
  if (!params.sal.length) {
    params.sal = [
      { name: 'Ordine / firma contratto', share: 0.1, document: 'Contratto + checklist firmata' },
      { name: 'Avvio cantiere', share: 0.3, document: 'Verbale di consegna + foto' },
      { name: 'Metà opere', share: 0.3, document: 'SAL con foto e voci completate' },
      { name: 'Fine opere', share: 0.2, document: 'Verbale fine lavori' },
      { name: 'Collaudo e consegna documenti', share: 0.1, document: 'DiCo, FIR, garanzie' },
    ];
  }

  if (packages.length < 5) throw new Error(`Trovati solo ${packages.length} pacchetti: il file non sembra il listino EdilMen`);
  return { version: '1.1', importedAt: new Date().toISOString(), packages, variants, params };
}
