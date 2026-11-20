/* Flusso della quotazione digitale (versione 2, 20/11/2026).
   Prezzo subito solo per i lavori che si quotano bene a pacchetto: ristrutturazione completa, rifacimento bagno,
   nuova costruzione. Tutto il resto passa dalla "vecchia scuola" (messaggio scritto o vocale, con foto).
   Ogni domanda cambia il prezzo con una voce o una variante del listino EdilMen, oppure serve all'impresa per il sopralluogo.
   Nessuna grafica e nessun testo visibile (quelli stanno in js/testi.js): così si può testare in Node.
   Scrive solo i campi dello stato che usa js/calcolo.js. */
(function (root) {
'use strict';
const C = typeof module !== 'undefined' && module.exports ? require('./calcolo.js') : root.EdilCalcolo;

const NON_SO = 'nonso';
const nonSo = (S, id) => S.risposte[id] === NON_SO;

/* Lavori con prezzo subito; "vecchia" apre la modalità vecchia scuola */
const LAVORI = ['completa', 'bagno', 'nuova', 'vecchia'];

/* Superficie tipica quando non la sai */
function mqTipici(S) {
  if (S.intervento === 'nuova') return { singola: 140, condo: 800, legno: 120, luxury: 350 }[S.nuovaTipo] || 140;
  return { app: 90, casa: 150, neg: 80, condo: 900 }[S.immobile] || 100;
}

/* Regione dal comune o dal CAP scritto (evita "Trento (Friuli-Venezia Giulia)") */
function regioneDaComune(testo) {
  const t = String(testo || '').toLowerCase().trim();
  if (!t) return null;
  if (/^3[34]\d{3}$/.test(t) || /udine|trieste|pordenone|gorizia|lignano|monfalcone|cividale|tolmezzo/.test(t)) return 'fvg';
  if (/^3[0-7]\d{3}$/.test(t) || /verona|vicenza|padova|treviso|belluno|venezia|rovigo|mestre|bassano|jesolo|chioggia|cortina/.test(t)) return 'ven';
  if (/^39\d{3}$/.test(t) || /^38\d{3}$/.test(t) || /trento|rovereto|bolzano|pergine|merano|bressanone|riva del garda|arco|mezzolombardo|brunico|cles|levico/.test(t)) return 'taa';
  return null;
}

const cpl = S => S.intervento === 'completa';
const conImpianti = S => cpl(S) && S.impianti !== false;   // R01: con impianti; R02: rinnovo senza impianti
const bagno = S => S.intervento === 'bagno';
const nuova = S => S.intervento === 'nuova';
const lusso = S => nuova(S) && S.nuovaTipo === 'luxury';
const unita = S => S.immobile === 'condo' ? Math.max(2, Math.round(S.mq / 70)) : 1;

/* Domanda a scelta su un dettaglio del lavoro (campo dett.<nome>) */
const dett = (id, se, opzioni, tipico) => ({ id, tipo: 'scelta', campo: 'dett.' + id, se, opzioni: () => opzioni, nonSo: S => { S.dett[id] = tipico; } });

/* Tutte le domande possibili, in ordine. `se` dice quando si fanno, `nonSo` cosa si ipotizza (sempre l'ipotesi prudente). */
const DOMANDE = [
  { id: 'intervento', tipo: 'scelta', campo: 'intervento', opzioni: () => LAVORI, nonSo: S => { S.aiuto = true; } },
  // Nuova costruzione
  { id: 'nuovaTipo', tipo: 'scelta', campo: 'nuovaTipo', se: nuova, opzioni: () => C.NUOVA.map(n => n[0]), nonSo: S => { S.nuovaTipo = 'singola'; } },
  { id: 'terreno', tipo: 'scelta', campo: 'terreno', se: nuova, opzioni: () => ['si', 'no'], nonSo: S => { S.terreno = null; } },
  // Ristrutturazione completa: tipo di immobile (il bagno si quota uguale in casa o appartamento)
  { id: 'immobile', tipo: 'scelta', campo: 'immobile', se: cpl, opzioni: () => C.IMMOBILI.map(i => i[0]), nonSo: S => { S.immobile = 'app'; } },
  { id: 'luogo', tipo: 'luogo', nonSo: S => { S.regione = S.regione || 'taa'; } },
  { id: 'mq', tipo: 'numero', campo: 'mq', min: 20, max: 20000, predefinito: mqTipici, nonSo: S => { S.mq = mqTipici(S); }, se: S => cpl(S) || nuova(S) },
  // Rifacimento bagno
  { id: 'q_bagno', tipo: 'numero', campo: 'q.bagno', min: 1, max: 50, se: bagno, predefinito: () => 1, nonSo: S => { S.q.bagno = 1; } },
  dett('bagnoDim', bagno, ['piccolo', 'medio', 'grande'], 'medio'),
  dett('bagnoDoccia', bagno, ['doccia', 'vasca', 'entrambe'], 'doccia'),
  dett('bagnoSanitari', bagno, ['stessi', 'spostati'], 'spostati'),
  // Ristrutturazione completa: con o senza impianti (cambia pacchetto: R01 o R02)
  { id: 'impianti', tipo: 'scelta', campo: 'impianti', se: cpl, opzioni: () => [true, false], nonSo: S => { S.impianti = true; } },
  dett('pavVecchi', S => cpl(S) && S.impianti === false, ['demolisci', 'sovrapponi'], 'demolisci'),
  { id: 'bagni', tipo: 'numero', campo: 'bagni', min: 1, max: 200, se: conImpianti,
    predefinito: S => S.immobile === 'condo' ? Math.max(2, Math.round(S.mq / 70)) : S.mq <= 100 ? 1 : 2,
    nonSo: S => { S.bagni = S.immobile === 'condo' ? Math.max(2, Math.round(S.mq / 70)) : S.mq <= 100 ? 1 : 2; } },
  { id: 'bagniRifare', tipo: 'numero', campo: 'bagniRifare', min: 0, max: 200, se: S => cpl(S) && S.impianti === false,
    predefinito: () => 1, nonSo: S => { S.bagniRifare = 1; } },
  { id: 'stanze', tipo: 'numero', campo: 'cucine', min: 2, max: 200, se: S => cpl(S) && S.immobile === 'condo',
    predefinito: S => Math.max(2, Math.round(S.mq / 70)), nonSo: S => { S.cucine = Math.max(2, Math.round(S.mq / 70)); } },
  // Nuova costruzione: forma e parti in più
  { id: 'nUnita', tipo: 'numero', campo: 'nUnita', min: 2, max: 500, se: S => nuova(S) && S.nuovaTipo === 'condo',
    predefinito: S => Math.max(2, Math.round(S.mq / 80)), nonSo: S => { S.nUnita = Math.max(2, Math.round(S.mq / 80)); } },
  { id: 'pianiNuova', tipo: 'scelta', campo: 'pianiNuova', opzioni: () => [1, 2, 3], se: S => nuova(S) && S.nuovaTipo !== 'condo', nonSo: S => { S.pianiNuova = 2; } },
  { id: 'interrato', tipo: 'scelta', campo: 'interrato', opzioni: () => ['no', 'garage', 'interrato'], se: nuova, nonSo: S => { S.interrato = 'no'; } },
  { id: 'struttura', tipo: 'scelta', campo: 'struttura', opzioni: () => ['telaio', 'xlam'], se: S => nuova(S) && S.nuovaTipo === 'legno', nonSo: S => { S.struttura = 'telaio'; } },
  { id: 'classe', tipo: 'scelta', campo: 'classe', opzioni: () => ['a', 'a4'], se: S => nuova(S) && !lusso(S), nonSo: S => { S.classe = 'a'; } },
  { id: 'finLuxury', tipo: 'scelta', campo: 'finLuxury', opzioni: () => [0, 1, 2], se: lusso, nonSo: S => { S.finLuxury = 0; } },
  { id: 'piscina', tipo: 'scelta', campo: 'piscina', opzioni: () => [true, false], se: lusso, nonSo: S => { S.piscina = false; } },
  // Livello di finiture (per il lusso c'è finLuxury)
  { id: 'livello', tipo: 'scelta', campo: 'livello', opzioni: () => [0, 1, 2], se: S => cpl(S) || bagno(S) || (nuova(S) && !lusso(S)), nonSo: S => { S.livello = 1; } },
  // Ristrutturazione completa: dettagli che cambiano il prezzo
  dett('pavMateriale', conImpianti, ['gres', 'parquet'], 'parquet'),
  { id: 'cplFinestre', tipo: 'scelta', campo: 'comp.cpl_infissi', opzioni: () => [true, false], se: cpl, nonSo: S => { S.comp.cpl_infissi = true; } },
  dett('infMateriale', S => cpl(S) && S.comp.cpl_infissi !== false, ['pvc', 'alluminio', 'legnoalluminio'], 'pvc'),
  { id: 'risc', tipo: 'scelta', campo: 'risc', opzioni: () => ['tengo', 'caldaia', 'pdc', 'ibrido'], se: cpl, nonSo: S => { S.risc = 'caldaia'; } },
  { id: 'extra', tipo: 'multi', campo: 'extra', minimo: 0, se: cpl, opzioni: () => ['blindato', 'clima', 'vmc', 'domotica'], nonSo: S => { S.extra = []; } },
  { id: 'esterni', tipo: 'scelta', campo: 'esterni', opzioni: () => [true, false], se: nuova, nonSo: S => { S.esterni = true; } },
  // Per tutti
  { id: 'part', tipo: 'multi', campo: 'part', minimo: 0, nonSo: S => { S.part = []; },
    opzioni: S => C.PART.map(p => p[0]).filter(p =>
      (p !== 'soffittialti' || cpl(S)) &&
      (p !== 'noasc' || (!nuova(S) && S.immobile !== 'casa')) &&
      (p !== 'abitata' || !nuova(S))) },
  { id: 'tecnico', tipo: 'scelta', campo: 'tecnico', opzioni: () => ['tutto', 'permessi', 'aiuto'], nonSo: S => { S.tecnico = 'aiuto'; } },
  { id: 'incentivi', tipo: 'scelta', campo: 'incentivi', opzioni: () => ['si', 'no'], nonSo: S => { S.incentivi = 'si'; } },
];
const PER_ID = Object.fromEntries(DOMANDE.map(d => [d.id, d]));

/* Schermate finali, dopo le domande */
const FINALI = ['quotazioni', 'prenota', 'contatto'];

function statoIniziale() {
  const S = C.statoIniziale();
  S.risposte = {};      // id domanda -> valore scelto oppure 'nonso'
  S.pos = 'intervento'; // schermata corrente
  S.aiuto = false;      // true se non sa cosa fare o sceglie un altro lavoro: si passa alla vecchia scuola
  S.canale = null;
  S.impianti = true; S.bagniRifare = 1; S.risc = 'tengo'; S.extra = []; S.pianiNuova = 2; S.interrato = 'no'; S.esterni = false;
  S.consensi = { privacy: false, condivisione_imprese: false, marketing: false };
  return S;
}

/* Domande da fare, in ordine, per lo stato attuale */
function domande(S) {
  return DOMANDE.filter(d => !d.se || d.se(S)).map(d => d.id);
}
/* Schermate in ordine: le domande, poi quotazioni, prenotazione e contatto.
   Se il lavoro non ha un prezzo subito (o il cliente non lo sa), dopo la prima domanda c'è la vecchia scuola. */
function percorso(S) {
  if (S.aiuto) return ['intervento', 'vecchia'];
  return [...domande(S), ...FINALI];
}

function leggi(S, campo) { return campo.startsWith('q.') ? S.q[campo.slice(2)] : campo.startsWith('dett.') ? S.dett[campo.slice(5)] : campo.startsWith('comp.') ? S.comp[campo.slice(5)] : S[campo]; }
function scrivi(S, campo, v) { if (campo.startsWith('q.')) S.q[campo.slice(2)] = v; else if (campo.startsWith('dett.')) S.dett[campo.slice(5)] = v; else if (campo.startsWith('comp.')) S.comp[campo.slice(5)] = v; else S[campo] = v; }

/* Risponde a una domanda. Restituisce l'id della schermata successiva. */
function rispondi(S, id, valore) {
  const d = PER_ID[id];
  if (!d) throw new Error('domanda sconosciuta: ' + id);
  if (valore === NON_SO) {
    S.risposte[id] = NON_SO;
    d.nonSo(S);
  } else {
    S.risposte[id] = valore;
    if (d.tipo === 'luogo') {
      S.comune = String(valore.comune || '').trim().slice(0, 120);
      S.regione = regioneDaComune(S.comune) || valore.regione || S.regione;
    } else if (d.tipo === 'numero') {
      const n = Math.round(Number(valore));
      scrivi(S, d.campo, Math.min(d.max, Math.max(d.min, Number.isFinite(n) ? n : d.predefinito(S))));
    } else {
      scrivi(S, d.campo, valore);
    }
  }
  if (id === 'intervento') {
    S.aiuto = valore === NON_SO || valore === 'vecchia';
    if (valore === 'bagno') { S.q.bagno = S.q.bagno || 1; S.ambienti = ['bagno']; }
  }
  // Finché la superficie non è stata chiesta, la stima usa quella tipica per l'immobile scelto
  if (S.risposte.mq === undefined && ['intervento', 'immobile', 'nuovaTipo'].includes(id)) S.mq = mqTipici(S);
  if (id === 'immobile' || id === 'mq') S.cucine = Math.max(S.cucine || 1, unita(S));
  return avanti(S);
}

function valida(S, id, valore) {
  const d = PER_ID[id];
  if (valore === NON_SO) return true;
  if (d.tipo === 'multi') return Array.isArray(valore) && valore.length >= d.minimo && valore.every(v => d.opzioni(S).includes(v));
  if (d.tipo === 'luogo') return !!(valore && (valore.regione || regioneDaComune(valore.comune)));
  if (d.tipo === 'numero') return Number.isFinite(Number(valore)) && Number(valore) >= d.min;
  return d.opzioni(S).includes(valore);
}

function avanti(S) {
  const p = percorso(S), i = p.indexOf(S.pos);
  S.pos = p[Math.min(p.length - 1, i + 1)];
  return S.pos;
}
function indietro(S) {
  const p = percorso(S), i = p.indexOf(S.pos);
  if (i > 0) S.pos = p[i - 1];
  return S.pos;
}
function avanzamento(S) {
  const p = percorso(S), i = Math.max(0, p.indexOf(S.pos));
  return { passo: i + 1, totale: p.length, quota: (i + 1) / p.length };
}

/* Ipotesi fatte con "Non lo so ancora", da mostrare al cliente e salvare nella richiesta */
function ipotesi(S) {
  return Object.keys(S.risposte).filter(id => nonSo(S, id) && PER_ID[id]).map(id => {
    const d = PER_ID[id];
    return { id, valore: d.tipo === 'luogo' ? S.regione : d.campo ? leggi(S, d.campo) : null };
  });
}

/* Stima orientativa durante la procedura (sempre come forchetta) */
function stimaOrientativa(S) {
  if (!S.intervento || S.aiuto || !['completa', 'bagno', 'nuova'].includes(S.intervento)) return null;
  const f = C.forchetta(S);
  if (!(f.media > 0)) return null;
  return { min: Math.round(f.min / 100) * 100, max: Math.round(f.max / 100) * 100 };
}

/* Salvataggio della sessione: niente dati personali, che restano solo nel browser fino all'invio */
const PERSONALI = ['nome', 'cognome', 'tel', 'mail', 'indirizzo', 'canale', 'consensi', 'done'];
const VERSIONE = 2;
function serializza(S) {
  const o = {};
  for (const [k, v] of Object.entries(S)) if (!PERSONALI.includes(k) && k !== 't0') o[k] = v;
  o.versione = VERSIONE;
  return o;
}
function ripristina(dati) {
  const S = statoIniziale();
  if (!dati || typeof dati !== 'object' || dati.versione !== VERSIONE) return S;
  for (const k of Object.keys(S)) if (k in dati && !PERSONALI.includes(k)) S[k] = dati[k];
  if (!S.dett || typeof S.dett !== 'object') S.dett = {};
  if (!percorso(S).includes(S.pos)) S.pos = 'intervento';
  return S;
}

const api = { NON_SO, LAVORI, DOMANDE, PER_ID, FINALI, statoIniziale, domande, percorso, rispondi, valida, avanti, indietro,
  avanzamento, ipotesi, stimaOrientativa, serializza, ripristina, regioneDaComune, mqTipici, leggi };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EdilFlusso = api;
})(this);
