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
  while (!F.FINALI.includes(S.pos) && S.pos !== 'aiuto' && S.pos !== 'vecchia') {
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

const sottoinsiemi = a => a.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]);
const IMM = C.IMMOBILI.map(i => i[0]), NUO = C.NUOVA.map(n => n[0]);
const MODI = ['prima', 'ultima', 'nonso'];
const fissa = (S, id, v) => { if (S.pos === id) F.rispondi(S, id, v); };

// 1. Dalla prima schermata, rispondendo sempre allo stesso modo
for (const modo of MODI) percorri(S => {}, modo, `diretto, risposte "${modo}"`);
// 2. Ristrutturazione completa: immobile × impianti × riscaldamento × aggiunte
for (const imm of IMM) for (const imp of [true, false]) for (const risc of ['tengo', 'caldaia', 'pdc', 'ibrido']) for (const ex of sottoinsiemi(['blindato', 'clima', 'vmc', 'domotica'])) for (const modo of MODI)
  percorri(S => { F.rispondi(S, 'intervento', 'completa'); F.rispondi(S, 'immobile', imm); S.impianti = imp; S.risc = risc; S.extra = ex; }, modo, `completa ${imm}, impianti ${imp}, ${risc}, [${ex}], ${modo}`);
// 3. Rifacimento bagno: dimensione × doccia × sanitari
for (const dim of ['piccolo', 'medio', 'grande']) for (const doc of ['doccia', 'vasca', 'entrambe']) for (const san of ['stessi', 'spostati']) for (const modo of MODI)
  percorri(S => { F.rispondi(S, 'intervento', 'bagno'); S.dett.bagnoDim = dim; S.dett.bagnoDoccia = doc; S.dett.bagnoSanitari = san; }, modo, `bagno ${dim} ${doc} ${san}, ${modo}`);
// 4. Nuova costruzione: tipo × piani × interrato × esterni
for (const t of NUO) for (const pn of [1, 2, 3]) for (const intr of ['no', 'garage', 'interrato']) for (const est of [true, false]) for (const modo of MODI)
  percorri(S => { F.rispondi(S, 'intervento', 'nuova'); F.rispondi(S, 'nuovaTipo', t); S.pianiNuova = pn; S.interrato = intr; S.esterni = est; }, modo, `nuova ${t}, ${pn} piani, ${intr}, esterni ${est}, ${modo}`);

console.log(`Percorsi completati: ${percorsi}`);
console.log(`Problemi distinti: ${problemi.size}`);
for (const p of [...problemi.values()].sort((a, b) => a.tipo.localeCompare(b.tipo))) console.log(`- [${p.tipo}] ${p.msg} (×${p.n}) es.: ${p.es}`);

// Controlli di senso: ogni risposta che dice di cambiare il prezzo lo cambia davvero
function controllo(nome, ok) { if (!ok) { console.log('ERRORE: ' + nome); process.exitCode = 1; } else console.log('ok: ' + nome); }
const base = (lav, f) => { const S = F.statoIniziale(); F.rispondi(S, 'intervento', lav); if (lav === 'completa') F.rispondi(S, 'immobile', 'app'); S.regione = 'taa'; f && f(S); return S; };
const pk = S => C.voci(S).map(v => v.pk);
controllo('un altro lavoro va alla vecchia scuola', (() => { const S = F.statoIniziale(); F.rispondi(S, 'intervento', 'vecchia'); return S.pos === 'vecchia'; })());
controllo('"non so cosa fare" va alla vecchia scuola', (() => { const S = F.statoIniziale(); F.rispondi(S, 'intervento', F.NON_SO); return S.pos === 'vecchia'; })());
controllo('completa senza impianti usa il pacchetto R02', pk(base('completa', S => { S.impianti = false; })).includes('R02') && !pk(base('completa', S => { S.impianti = false; })).includes('R01'));
controllo('completa senza impianti costa meno che con', C.stima(base('completa', S => { S.impianti = false; })) < C.stima(base('completa')));
controllo('pavimenti posati sopra costano meno che demoliti', C.stima(base('completa', S => { S.impianti = false; S.dett.pavVecchi = 'sovrapponi'; })) < C.stima(base('completa', S => { S.impianti = false; S.dett.pavVecchi = 'demolisci'; })));
controllo('riscaldamento: tengo < caldaia < ibrido < pompa di calore', (() => { const v = ['tengo', 'caldaia', 'ibrido', 'pdc'].map(r => C.stima(base('completa', S => { S.risc = r; }))); return v[0] < v[1] && v[1] < v[2] && v[2] < v[3]; })());
controllo('finestre: senza costa meno', C.stima(base('completa', S => { S.comp.cpl_infissi = false; })) < C.stima(base('completa')));
controllo('aggiunte: ognuna aumenta il prezzo', ['blindato', 'clima', 'vmc', 'domotica'].every(e => C.stima(base('completa', S => { S.extra = [e]; })) > C.stima(base('completa'))));
controllo('bagno: piccolo < medio < grande', (() => { const v = ['piccolo', 'medio', 'grande'].map(d => C.stima(base('bagno', S => { S.dett.bagnoDim = d; }))); return v[0] < v[1] && v[1] < v[2]; })());
controllo('bagno: la vasca costa più della doccia', C.stima(base('bagno', S => { S.dett.bagnoDoccia = 'vasca'; })) > C.stima(base('bagno', S => { S.dett.bagnoDoccia = 'doccia'; })));
controllo('bagno: sanitari spostati aggiungono lo spostamento dello scarico', pk(base('bagno', S => { S.dett.bagnoSanitari = 'spostati'; })).includes('X02') && !pk(base('bagno', S => { S.dett.bagnoSanitari = 'stessi'; })).includes('X02'));
controllo('bagno: due bagni costano il doppio di uno', Math.abs(C.stima(base('bagno', S => { S.q.bagno = 2; })) / C.stima(base('bagno')) - 2) < 0.01);
controllo('nuova: su un piano costa più al m² che su due', C.stima(base('nuova', S => { S.pianiNuova = 1; })) > C.stima(base('nuova', S => { S.pianiNuova = 2; })));
controllo('nuova: garage e interrato aumentano il prezzo', C.stima(base('nuova', S => { S.interrato = 'garage'; })) > C.stima(base('nuova')) && C.stima(base('nuova', S => { S.interrato = 'interrato'; })) > C.stima(base('nuova', S => { S.interrato = 'garage'; })));
controllo('nuova: giardino aggiunge le sistemazioni esterne', pk(base('nuova', S => { S.esterni = true; })).includes('N12'));
controllo('nuova costruzione: niente "piano alto senza ascensore" né "ci abito"', !F.PER_ID.part.opzioni(base('nuova')).some(p => p === 'noasc' || p === 'abitata'));
controllo('ci abito durante i lavori: maggiorazione del listino', (() => { const S = base('completa'); const b = C.stima(S); S.part = ['abitata']; return C.stima(S) > b; })());
controllo('il bagno non chiede la superficie della casa', !F.domande(base('bagno')).includes('mq'));
controllo('nessuna domanda ripetuta nello stesso percorso', ['completa', 'bagno', 'nuova'].every(l => { const d = F.domande(base(l)); return new Set(d).size === d.length; }));
