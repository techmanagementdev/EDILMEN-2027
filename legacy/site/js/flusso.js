/* Flusso della quotazione istantanea: quali domande fare, in che ordine, e cosa ipotizzare con "Non lo so ancora".
   Nessuna grafica e nessun testo visibile (quelli stanno in js/testi.js): così si può testare in Node.
   Scrive solo i campi dello stato che usa js/calcolo.js, senza cambiarne il calcolo. */
(function (root) {
'use strict';
const C = typeof module !== 'undefined' && module.exports ? require('./calcolo.js') : root.EdilCalcolo;

const NON_SO = 'nonso';
const val = (S, id) => S.risposte[id];
const nonSo = (S, id) => S.risposte[id] === NON_SO;

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

const fa = (S, a) => S.intervento === 'parziale' && S.ambienti.includes(a);
const effHa = (S, e) => S.intervento === 'eff' && S.eff.includes(e);
/* La superficie della casa serve solo dove entra nel calcolo: casa intera, nuova costruzione, tinteggiatura,
   tetto, cappotto e pompa di calore. Per un bagno o una cucina non si chiede. */
function serveMq(S) {
  if (S.intervento === 'parziale') return S.ambienti.includes('tinteggiatura');
  if (S.intervento === 'eff') return S.eff.some(e => ['tetto', 'cappotto', 'pdc'].includes(e));
  return true;
}
/* Il tecnico (pratiche, progetto) si chiede solo dove serve: casa intera, nuova costruzione, bagno, cucina, tetto, cappotto, fotovoltaico.
   Per pavimenti, tinteggiatura, infissi e impianti da soli non si chiede (edilizia libera). */
function serveTecnico(S) {
  if (S.intervento === 'parziale') return S.ambienti.some(a => ['bagno', 'cucina'].includes(a));
  if (S.intervento === 'eff') return S.eff.some(e => ['tetto', 'cappotto', 'fv'].includes(e));
  return true;
}
/* Domanda a scelta su un dettaglio del lavoro (campo dett.<nome>) */
const dett = (id, se, opzioni, tipico) => ({ id, tipo: 'scelta', campo: 'dett.' + id, se, opzioni: () => opzioni, nonSo: S => { S.dett[id] = tipico; } });
const SPECIFICHE = [
  // Bagno
  dett('bagnoDim', S => fa(S, 'bagno'), ['piccolo', 'medio', 'grande'], 'medio'),
  dett('bagnoDoccia', S => fa(S, 'bagno'), ['doccia', 'vasca', 'entrambe'], 'doccia'),
  dett('bagnoSanitari', S => fa(S, 'bagno'), ['stessi', 'spostati'], 'stessi'),
  // Cucina
  dett('cucinaLavello', S => fa(S, 'cucina'), ['stessa', 'altra'], 'stessa'),
  dett('cucinaMobili', S => fa(S, 'cucina'), ['no', 'si'], 'no'),
  // Pavimenti (anche nella ristrutturazione completa)
  dett('pavMateriale', S => fa(S, 'pavimenti') || S.intervento === 'completa', ['gres', 'parquet'], 'gres'),
  // Infissi e finestre
  dett('infMateriale', S => fa(S, 'infissi') || effHa(S, 'finestre') || S.intervento === 'completa', ['pvc', 'alluminio', 'legnoalluminio'], 'pvc'),
  // Impianto elettrico
  dett('elContatore', S => fa(S, 'elettrico'), ['no', 'si'], 'no'),
  // Impianto idraulico
  dett('idrScarichi', S => fa(S, 'idraulico'), ['stessi', 'spostati'], 'stessi'),
  // Tinteggiatura
  dett('tintPareti', S => fa(S, 'tinteggiatura'), ['buone', 'irregolari', 'muffa'], 'buone'),
  // Tetto
  dett('amianto', S => effHa(S, 'tetto'), ['no', 'si'], 'no'),
  // Cappotto
  dett('isolante', S => effHa(S, 'cappotto'), ['eps', 'roccia', 'legno', 'interno'], 'eps'),
  // Pompa di calore
  dett('pdcTipo', S => effHa(S, 'pdc'), ['sola', 'ibrido'], 'sola'),
];

/* Tutte le domande possibili. `se` dice quando si fanno, `nonSo` cosa si ipotizza e scrive nello stato. */
const DOMANDE = [
  { id: 'intervento', tipo: 'scelta', campo: 'intervento', opzioni: () => C.INTERVENTI.map(i => i[0]),
    nonSo: S => { S.aiuto = true; } },
  { id: 'ambienti', tipo: 'multi', campo: 'ambienti', se: S => S.intervento === 'parziale',
    opzioni: () => C.AMBIENTI.map(a => a[0]), minimo: 1, nonSo: S => { S.aiuto = true; } },
  { id: 'nuovaTipo', tipo: 'scelta', campo: 'nuovaTipo', se: S => S.intervento === 'nuova',
    opzioni: () => C.NUOVA.map(n => n[0]), nonSo: S => { S.nuovaTipo = 'singola'; } },
  { id: 'terreno', tipo: 'scelta', campo: 'terreno', se: S => S.intervento === 'nuova', opzioni: () => ['si', 'no'],
    nonSo: S => { S.terreno = null; } },
  { id: 'immobile', tipo: 'scelta', campo: 'immobile', se: S => S.intervento !== 'nuova',
    opzioni: () => C.IMMOBILI.map(i => i[0]), nonSo: S => { S.immobile = S.intervento === 'eff' ? 'casa' : 'app'; } },
  { id: 'kit', tipo: 'multi', campo: 'eff', se: S => S.intervento === 'eff' && !S.kitFisso, opzioni: S => kitDisponibile(S), minimo: 1,
    nonSo: S => { S.eff = kitDisponibile(S); } },
  { id: 'luogo', tipo: 'luogo', nonSo: S => { S.regione = S.regione || 'taa'; } },
  { id: 'mq', tipo: 'numero', campo: 'mq', min: 20, max: 20000, predefinito: mqTipici, nonSo: S => { S.mq = mqTipici(S); }, se: serveMq },
  { id: 'bagni', tipo: 'numero', campo: 'bagni', min: 1, max: 200, se: S => S.intervento === 'completa',
    predefinito: S => S.immobile === 'condo' ? Math.max(2, Math.round(S.mq / 70)) : S.mq <= 100 ? 1 : 2,
    nonSo: S => { S.bagni = S.immobile === 'condo' ? Math.max(2, Math.round(S.mq / 70)) : S.mq <= 100 ? 1 : 2; } },
  { id: 'stanze', tipo: 'numero', campo: 'cucine', min: 1, max: 200, se: S => S.intervento === 'completa' && S.immobile === 'condo',
    predefinito: S => Math.max(2, Math.round(S.mq / 70)), nonSo: S => { S.cucine = Math.max(2, Math.round(S.mq / 70)); } },
  { id: 'livello', tipo: 'scelta', campo: 'livello', opzioni: () => [0, 1, 2],
    se: S => S.intervento === 'completa' || (S.intervento === 'parziale' && S.ambienti.some(a => ['bagno', 'cucina', 'pavimenti', 'infissi', 'tinteggiatura'].includes(a))),
    nonSo: S => { S.livello = 1; } },
  // Ristrutturazione parziale: una quantità per ogni lavoro scelto
  ...['bagno', 'cucina', 'pavimenti', 'infissi', 'elettrico', 'idraulico', 'tinteggiatura'].map(a => ({
    id: 'q_' + a, tipo: 'numero', campo: 'q.' + a, se: S => S.intervento === 'parziale' && S.ambienti.includes(a),
    min: 1, max: 5000,
    predefinito: S => ({ bagno: 1, cucina: 1, pavimenti: Math.round(S.mq * 0.8), infissi: 6, elettrico: S.mq, idraulico: 1, tinteggiatura: Math.round(S.mq * 3.2) })[a],
    nonSo: S => { S.q[a] = ({ bagno: 1, cucina: 1, pavimenti: Math.round(S.mq * 0.8), infissi: 6, elettrico: S.mq, idraulico: 1, tinteggiatura: Math.round(S.mq * 3.2) })[a]; },
  })),
  { id: 'soffittiAlti', tipo: 'scelta', campo: 'soffittiAlti', opzioni: () => [true, false],
    se: S => S.intervento === 'parziale' && S.ambienti.includes('tinteggiatura'), nonSo: S => { S.soffittiAlti = false; } },
  // Domande specifiche del lavoro scelto (dal 19/10/2026): le risposte con una variante del listino cambiano il prezzo,
  // le altre sono informazioni per il referente e l'impresa (il prezzo prudente comprende già l'accantonamento per gli imprevisti)
  ...SPECIFICHE,
  // Nuova costruzione
  { id: 'nUnita', tipo: 'numero', campo: 'nUnita', min: 2, max: 500, se: S => S.intervento === 'nuova' && S.nuovaTipo === 'condo',
    predefinito: S => Math.max(2, Math.round(S.mq / 80)), nonSo: S => { S.nUnita = Math.max(2, Math.round(S.mq / 80)); } },
  { id: 'struttura', tipo: 'scelta', campo: 'struttura', opzioni: () => ['telaio', 'xlam'],
    se: S => S.intervento === 'nuova' && S.nuovaTipo === 'legno', nonSo: S => { S.struttura = 'telaio'; } },
  { id: 'classe', tipo: 'scelta', campo: 'classe', opzioni: () => ['a', 'a4'],
    se: S => S.intervento === 'nuova' && S.nuovaTipo !== 'luxury', nonSo: S => { S.classe = 'a'; } },
  { id: 'finLuxury', tipo: 'scelta', campo: 'finLuxury', opzioni: () => [0, 1, 2],
    se: S => S.intervento === 'nuova' && S.nuovaTipo === 'luxury', nonSo: S => { S.finLuxury = 0; } },
  { id: 'piscina', tipo: 'scelta', campo: 'piscina', opzioni: () => [true, false],
    se: S => S.intervento === 'nuova' && S.nuovaTipo === 'luxury', nonSo: S => { S.piscina = false; } },
  // Efficientamento
  { id: 'piani', tipo: 'scelta', campo: 'piani', opzioni: () => [1, 2, 3, 4],
    se: S => S.intervento === 'eff' && S.eff.some(e => e === 'tetto' || e === 'cappotto'), nonSo: S => { S.piani = 2; } },
  { id: 'tettoTipo', tipo: 'scelta', campo: 'tettoTipo', opzioni: () => ['tegole', 'lamiera', 'piano'],
    se: S => S.intervento === 'eff' && S.eff.includes('tetto'), nonSo: S => { S.tettoTipo = 'tegole'; } },
  { id: 'finestre', tipo: 'numero', campo: 'finestre', min: 1, max: 500, predefinito: () => 8,
    se: S => S.intervento === 'eff' && S.eff.includes('finestre'), nonSo: S => { S.finestre = 8; } },
  { id: 'bolletta', tipo: 'numero', campo: 'bolletta', min: 40, max: 400, passo: 10, predefinito: () => 150,
    se: S => S.intervento === 'eff' && S.eff.includes('fv'), nonSo: S => { S.bolletta = 150; } },
  { id: 'accumulo', tipo: 'scelta', campo: 'accumulo', opzioni: () => [true, false],
    se: S => S.intervento === 'eff' && S.eff.includes('fv'), nonSo: S => { S.accumulo = false; } },
  // Per tutti
  { id: 'part', tipo: 'multi', campo: 'part', minimo: 0, nonSo: S => { S.part = []; },
    opzioni: S => C.PART.map(p => p[0]).filter(p => p !== 'soffittialti' || S.intervento === 'completa') },
  { id: 'tecnico', tipo: 'scelta', campo: 'tecnico', opzioni: () => ['permessi', 'aiuto'], nonSo: S => { S.tecnico = 'aiuto'; }, se: serveTecnico },
  { id: 'incentivi', tipo: 'scelta', campo: 'incentivi', opzioni: () => ['si', 'no'], nonSo: S => { S.incentivi = 'si'; } },
];
const PER_ID = Object.fromEntries(DOMANDE.map(d => [d.id, d]));

/* Schermate finali, dopo le domande */
const FINALI = ['quotazioni', 'prenota', 'contatto'];

function kitDisponibile(S) {
  const soloUnita = S.immobile === 'app' || S.immobile === 'neg';
  return C.EFF.map(e => e[0]).filter(e => !soloUnita || ['finestre', 'fv', 'pdc'].includes(e));
}

function statoIniziale() {
  const S = C.statoIniziale();
  S.risposte = {};      // id domanda -> valore scelto oppure 'nonso'
  S.pos = 'intervento'; // schermata corrente
  S.kitFisso = false;   // true se il lavoro di efficientamento arriva già scelto dalla home
  S.aiuto = false;      // true se non sa cosa fare: si propone il contatto (poi il vocale)
  S.canale = null;
  S.consensi = { privacy: false, condivisione_imprese: false, marketing: false };
  return S;
}

/* Domande da fare, in ordine, per lo stato attuale */
function domande(S) {
  return DOMANDE.filter(d => !d.se || d.se(S)).map(d => d.id);
}
/* Schermate in ordine: le domande, poi quotazioni, prenotazione e contatto.
   Se il cliente non sa cosa deve fare, dopo quella domanda c'è la schermata "aiuto" (contatto, poi il vocale). */
function percorso(S) {
  const d = domande(S);
  if (S.aiuto) return [...d.slice(0, d.indexOf(primaNonSo(S)) + 1), 'aiuto'];
  return [...d, ...FINALI];
}
function primaNonSo(S) {
  return ['intervento', 'ambienti'].find(id => nonSo(S, id)) || 'intervento';
}

function leggi(S, campo) { return campo.startsWith('q.') ? S.q[campo.slice(2)] : campo.startsWith('dett.') ? S.dett[campo.slice(5)] : S[campo]; }
function scrivi(S, campo, v) { if (campo.startsWith('q.')) S.q[campo.slice(2)] = v; else if (campo.startsWith('dett.')) S.dett[campo.slice(5)] = v; else S[campo] = v; }

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
    if (id === 'intervento' || id === 'ambienti') S.aiuto = false;
  }
  // Finché la superficie non è stata chiesta, la stima usa quella tipica per l'immobile scelto
  if (S.risposte.mq === undefined && ['intervento', 'immobile', 'nuovaTipo'].includes(id)) S.mq = mqTipici(S);
  if (id === 'immobile' && S.intervento === 'eff') S.eff = S.eff.filter(e => kitDisponibile(S).includes(e));
  return avanti(S);
}

function valida(S, id, valore) {
  const d = PER_ID[id];
  if (valore === NON_SO) return true;
  if (d.tipo === 'multi') return Array.isArray(valore) && valore.length >= d.minimo;
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
  if (!S.intervento || S.aiuto) return null;
  if (S.intervento === 'parziale' && !S.ambienti.length) return null;
  const f = C.forchetta(S);
  if (!(f.media > 0)) return null;
  return { min: Math.round(f.min / 100) * 100, max: Math.round(f.max / 100) * 100 };
}

/* Salvataggio della sessione: niente dati personali, che restano solo nel browser fino all'invio */
const PERSONALI = ['nome', 'cognome', 'tel', 'mail', 'indirizzo', 'canale', 'consensi', 'done'];
function serializza(S) {
  const o = {};
  for (const [k, v] of Object.entries(S)) if (!PERSONALI.includes(k) && k !== 't0') o[k] = v;
  o.versione = 1;
  return o;
}
function ripristina(dati) {
  const S = statoIniziale();
  if (!dati || typeof dati !== 'object' || dati.versione !== 1) return S;
  for (const k of Object.keys(S)) if (k in dati && !PERSONALI.includes(k)) S[k] = dati[k];
  if (!S.dett || typeof S.dett !== 'object') S.dett = {};
  if (!percorso(S).includes(S.pos)) S.pos = 'intervento';
  return S;
}

const api = { NON_SO, DOMANDE, PER_ID, FINALI, statoIniziale, domande, percorso, rispondi, valida, avanti, indietro,
  avanzamento, ipotesi, stimaOrientativa, serializza, ripristina, regioneDaComune, kitDisponibile, mqTipici, leggi, serveMq, serveTecnico };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EdilFlusso = api;
})(this);
