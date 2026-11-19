// Simula tutti i percorsi della quotazione (logica di js/flusso.js + js/calcolo.js + testi di js/testi.js) e segnala incongruenze.
const path = require('path'), vm = require('vm'), fs = require('fs');
const SITE = path.join(__dirname, '..', 'site', 'js');
global.window = global; // testi.js scrive window.EM_TESTI
for (const f of ['listino.js', 'territorio.js', 'calcolo.js', 'flusso.js', 'testi.js']) vm.runInThisContext(fs.readFileSync(path.join(SITE, f), 'utf8'), { filename: f });
const C = global.EdilCalcolo, F = global.EdilFlusso;
const T = global.EM_TESTI;

const problemi = new Map();
const segnala = (tipo, msg, scen) => { const k = tipo + ' | ' + msg; if (!problemi.has(k)) problemi.set(k, { tipo, msg, n: 0, es: scen }); problemi.get(k).n++; };
let percorsi = 0;

const etichetta = (id, v) => { const d = T.domande[id]; if (!d) return null; if (!d.opzioni) return ''; const o = d.opzioni[String(v)]; return o === undefined ? null : o; };

function verificaSchermata(S, id, scen) {
  const d = F.PER_ID[id];
  const t = T.domande[id];
  if (!t) return segnala('testo', `manca il testo della domanda "${id}"`, scen);
  if (!t.titolo) segnala('testo', `domanda "${id}" senza titolo`, scen);
  if (d.tipo === 'scelta' || d.tipo === 'multi') for (const v of d.opzioni(S)) if (etichetta(id, v) == null) segnala('testo', `domanda "${id}": opzione "${v}" senza etichetta`, scen);
  if (d.tipo === 'scelta' || d.tipo === 'multi') { const n = d.opzioni(S).length; if (d.tipo === 'scelta' && n < 2) segnala('flusso', `domanda "${id}" con meno di 2 risposte`, scen); if (d.tipo === 'multi' && n === 0) segnala('flusso', `domanda "${id}" senza opzioni`, scen); }
  if (d.tipo === 'numero') { const p = d.predefinito(S); if (!Number.isFinite(p) || p < d.min || p > d.max) segnala('numero', `domanda "${id}": valore proposto ${p} fuori da ${d.min}-${d.max}`, scen); }
}

function verificaFine(S, scen) {
  const voci = C.voci(S), f = C.forchetta(S);
  if (!voci.length) segnala('prezzo', 'quotazione senza nessuna voce di lavoro', scen);
  for (const v of voci) {
    if (!Number.isFinite(v.tot) || v.tot <= 0) segnala('prezzo', `voce "${v.n}" con importo ${v.tot}`, scen);
    if (!v.qta || v.qta <= 0) segnala('prezzo', `voce "${v.n}" con quantità ${v.qta}`, scen);
  }
  if (!Number.isFinite(f.media) || f.media <= 0) segnala('prezzo', `prezzo medio ${f.media}`, scen);
  const ip = F.ipotesi(S);
  for (const i of ip) if (T.ipotesi.voci[i.id] === undefined) segnala('testo', `ipotesi "${i.id}" senza testo`, scen);
  const pk = C.pacchetto(S); if (!pk || /undefined/.test(pk)) segnala('testo', `pacchetto "${pk}"`, scen);
  // quantità ragionevoli
  for (const v of voci) if (v.tot > 5e6 && S.intervento !== 'nuova') segnala('prezzo', `voce "${v.n}" oltre 5 M€ (${Math.round(v.tot)})`, scen);
  // prezzo al m² della casa intera
  if (S.intervento === 'completa') { const mq = f.media / S.mq; if (mq < 400 || mq > 3500) segnala('prezzo', `completa a ${Math.round(mq)} €/m²`, scen); }
}

// Risposta tipo per ogni domanda: 'prima', 'ultima', 'nonso'
function scegli(S, id, modo) {
  const d = F.PER_ID[id];
  if (modo === 'nonso' && id !== 'part') return F.NON_SO;
  if (d.tipo === 'luogo') return { regione: modo === 'ultima' ? 'ven' : 'taa', comune: modo === 'ultima' ? 'Padova' : 'Trento' };
  if (d.tipo === 'numero') return d.predefinito(S);
  const o = d.opzioni(S);
  if (d.tipo === 'multi') return id === 'part' ? (modo === 'ultima' ? o : []) : modo === 'ultima' ? o : o.slice(0, 1);
  return modo === 'ultima' ? o[o.length - 1] : o[0];
}

function percorri(setup, modo, scen) {
  const S = F.statoIniziale();
  setup(S);
  let guardia = 0;
  while (!F.FINALI.includes(S.pos) && S.pos !== 'aiuto') {
    if (++guardia > 80) { segnala('flusso', 'percorso infinito', scen); return; }
    const id = S.pos;
    verificaSchermata(S, id, scen);
    const v = scegli(S, id, modo);
    if (!F.valida(S, id, v)) { segnala('flusso', `risposta proposta non valida in "${id}": ${JSON.stringify(v)}`, scen); return; }
    const prima = S.pos;
    F.rispondi(S, id, v);
    if (S.pos === prima) { segnala('flusso', `bloccato su "${id}"`, scen); return; }
  }
  percorsi++;
  if (S.pos === 'quotazioni') verificaFine(S, scen);
  return S;
}

const sottoinsiemi = a => a.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]).filter(s => s.length);
const AMB = C.AMBIENTI.map(a => a[0]), EFF = C.EFF.map(e => e[0]), IMM = C.IMMOBILI.map(i => i[0]), NUO = C.NUOVA.map(n => n[0]);
const MODI = ['prima', 'ultima', 'nonso'];

// 1. Dalla procedura, rispondendo a tutto
for (const modo of MODI) {
  percorri(S => {}, modo, `diretto, risposte "${modo}"`);
}
// 2. Ristrutturazione completa per ogni immobile
for (const imm of IMM) for (const modo of MODI) percorri(S => { F.rispondi(S, 'intervento', 'completa'); F.rispondi(S, 'immobile', imm); }, modo, `completa, ${imm}, ${modo}`);
// 3. Parziale: ogni combinazione di lavori × immobile
for (const amb of sottoinsiemi(AMB)) for (const imm of IMM) for (const modo of MODI)
  percorri(S => { F.rispondi(S, 'intervento', 'parziale'); F.rispondi(S, 'ambienti', amb); F.rispondi(S, 'immobile', imm); }, modo, `parziale [${amb}], ${imm}, ${modo}`);
// 4. Nuova costruzione per ogni tipo
for (const t of NUO) for (const modo of MODI) percorri(S => { F.rispondi(S, 'intervento', 'nuova'); F.rispondi(S, 'nuovaTipo', t); }, modo, `nuova ${t}, ${modo}`);
// 5. Efficientamento: ogni immobile × ogni kit
for (const imm of IMM) for (const kit of sottoinsiemi(EFF)) for (const modo of MODI)
  percorri(S => { F.rispondi(S, 'intervento', 'eff'); F.rispondi(S, 'immobile', imm); if (S.pos === 'kit') { const k = kit.filter(e => F.kitDisponibile(S).includes(e)); if (!k.length) return; F.rispondi(S, 'kit', k); } }, modo, `eff ${imm} [${kit}], ${modo}`);
// 6. Partenze dalla home (preset come in preventivo.js applicaPreset)
const preset = (S, job, reg) => { const [k, sub] = job.split(':'); S.regione = reg; if (k === 'eff' && sub) S.eff = [sub]; F.rispondi(S, 'intervento', k); if (k === 'eff' && sub) S.kitFisso = true; if (k === 'parziale' && sub) F.rispondi(S, 'ambienti', [sub]); if (k === 'nuova' && sub) F.rispondi(S, 'nuovaTipo', sub); };
const JOBS = ['completa', 'nuova', 'eff', 'parziale', ...AMB.map(a => 'parziale:' + a), ...NUO.map(n => 'nuova:' + n), ...EFF.map(e => 'eff:' + e)];
for (const job of JOBS) for (const imm of IMM) for (const modo of ['prima', 'ultima'])
  percorri(S => { preset(S, job, 'taa'); if (S.pos === 'immobile') F.rispondi(S, 'immobile', imm); }, modo, `home "${job}", immobile ${imm}, ${modo}`);

console.log(`Percorsi completati: ${percorsi}`);
console.log(`Problemi distinti: ${problemi.size}`);
for (const p of [...problemi.values()].sort((a, b) => a.tipo.localeCompare(b.tipo))) console.log(`- [${p.tipo}] ${p.msg} (×${p.n}) es.: ${p.es}`);

// Controlli di senso (19/11/2026): ciò che il cliente esclude non deve entrare nel prezzo
function controllo(nome, ok) { if (!ok) { console.log('ERRORE: ' + nome); process.exitCode = 1; } else console.log('ok: ' + nome); }
{ const S = F.statoIniziale(); F.rispondi(S, 'intervento', 'completa'); S.comp.cpl_infissi = false; S.comp.cpl_riscaldamento = false;
  const pk = C.voci(S).map(v => v.pk); controllo('completa senza finestre e pompa di calore', !pk.includes('R10') && !pk.includes('R13')); }
{ const S = F.statoIniziale(); S.eff = ['tetto']; F.rispondi(S, 'intervento', 'eff'); S.kitFisso = true; F.rispondi(S, 'immobile', 'app');
  controllo('tetto dalla home + appartamento: si chiedono gli interventi', S.pos === 'kit' && S.eff.length > 0); }
{ const S = F.statoIniziale(); F.rispondi(S, 'intervento', 'eff'); S.eff = ['fv']; S.bolletta = 150; S.accumulo = false; S.immobile = 'casa';
  controllo('fotovoltaico: 150 € ogni due mesi = 3 kWp', C.voci(S)[0].n.includes('3 kWp')); }
{ const S = F.statoIniziale(); F.rispondi(S, 'intervento', 'nuova'); F.rispondi(S, 'nuovaTipo', 'singola');
  controllo('nuova costruzione: si chiede il livello di finiture', F.domande(S).includes('livello')); }
{ const S = F.statoIniziale(); F.rispondi(S, 'intervento', 'nuova'); controllo('nuova costruzione: niente "piano alto senza ascensore" né "ci abito"', !F.PER_ID.part.opzioni(S).some(p => p === 'noasc' || p === 'abitata')); }
{ const S = F.statoIniziale(); F.rispondi(S, 'intervento', 'completa'); F.rispondi(S, 'immobile', 'app'); const base = C.stima(S); S.part = ['abitata'];
  controllo('ci abito durante i lavori: maggiorazione del listino', C.stima(S) > base); }
