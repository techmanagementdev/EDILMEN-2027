/* Dati veri nelle pagine dell'amministrazione (12/10/2026, richiesta dell'utente).
   L'area riservata nasce come demo: ogni pagina legge l'oggetto `db` (aziende, richieste, pacchetti) che nella demo sta nel browser.
   Con l'accesso vero (email e password, ruolo admin) qui si costruisce lo stesso `db` dal database e ogni salvataggio delle pagine
   (stati, impresa incaricata, importo, SAL, fee, piano) torna nel database. La demo per clienti e investitori resta su app#/demo
   con i dati d'esempio nel browser, separati.
   Mappatura: richieste <- tabella lead (+ colonna gestione), aziende <- tabella aziende (+ colonna gestione), pacchetti: per ora
   nessuno (i prezzi veri delle imprese sono in "Listini e pacchetti"). */
(function () {
'use strict';
const A = () => window.EM_APP, G = () => window.EM_GEST;
let attivo = false, foto = {};

// la demo conosce solo alcune città (mappa e distanze): il comune vero resta in `comune`, `city` è la città nota più vicina
const CAPOLUOGO = { TN: 'Trento', BZ: 'Bolzano', VR: 'Verona', VI: 'Vicenza', PD: 'Padova', TV: 'Treviso', BL: 'Belluno', VE: 'Venezia', RO: 'Padova',
  UD: 'Udine', PN: 'Pordenone', GO: 'Trieste', TS: 'Trieste' };
const PER_REGIONE = { taa: 'Trento', ven: 'Padova', fvg: 'Udine' };
const citta = (comune, prov, reg) => (comune && A().CITIES[comune] ? comune : CAPOLUOGO[prov] || PER_REGIONE[reg] || 'Trento');
const COLORI = ['#0A6FA3', '#0F37B8', '#E9711C', '#16A34A', '#7C3AED', '#0891B2', '#DB2777', '#CA8A04', '#5B6BD6', '#059669'];
const colore = id => COLORI[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORI.length];

// stato della richiesta: quello della pagina (più dettagliato) sta in gestione.stato, la colonna lead.stato resta coerente
const DA_LEAD = { nuova: 'nuova', contattata: 'videocall', appuntamento: 'videocall', preventivo: 'scelta', aggiudicata: 'aggiudicata', persa: 'persa', chiusa: 'conclusa' };
const A_LEAD = { nuova: 'nuova', videocall: 'appuntamento', scelta: 'preventivo', aggiudicata: 'aggiudicata', cantiere: 'aggiudicata', conclusa: 'chiusa', persa: 'persa' };

// tipologia di lavoro della demo dalla richiesta del sito (stessa regola del preventivo)
function tipologia(l) {
  const v = l.lavoro || {};
  if (v.intervento === 'completa') return '1.2.a';
  if (v.intervento === 'nuova') return '1.1.a';
  if (v.intervento === 'parziale') return { bagno: '1.2.f', cucina: '1.2.c', pavimenti: '1.2.h', infissi: '1.2.i', elettrico: '1.2.d', idraulico: '1.2.e', tinteggiatura: '1.2.g' }[(v.ambienti || [])[0]] || '1.2.c';
  if (v.intervento === 'eff') return { tetto: '1.3.a', finestre: '1.3.c', cappotto: '1.3.a', fv: v.accumulo ? '2.1.c' : '2.1.b', pdc: '1.3.b' }[(v.eff || [])[0]] || '1.3.a';
  return '1.2.a';
}

function richiesta(l) {
  const g = l.gestione || {}, v = l.lavoro || {}, ap = l.appuntamento;
  const r = {
    id: l.codice, _id: l.id, data: String(l.creato_il).slice(0, 10),
    cliente: { nome: [l.nome, l.cognome].filter(Boolean).join(' ') || (l.canale_contatto === 'email' ? l.email : 'Cliente dal sito'), tel: l.telefono || l.email || '' },
    tip: tipologia(l), q: v.mq || 1, citta: citta(l.comune, null, l.regione), comune: l.comune || '', fin: ['base', 'media', 'alta'][v.livello] || 'media', when: '',
    stato: g.stato || DA_LEAD[l.stato] || 'nuova',
    videocall: g.videocall || (ap ? [ap.modalita === 'sopralluogo' ? 'Sopralluogo' : 'Videochiamata', ap.giorno, ap.ora && 'alle ' + ap.ora].filter(Boolean).join(' ') : ''),
    disp: g.disp || [], fonte: 'sito', voci: [v.pacchetto || (l.tipo === 'vocale' ? 'Richiesta con un vocale' : 'Da capire con il cliente')],
    scelta: l.impresa_scelta || '', stima: (l.quotazione && l.quotazione.offerta) || 0,
  };
  for (const k of ['az', 'importo', 'sal', 'feePct', 'feePaid']) if (g[k] != null) r[k] = g[k];
  return r;
}

function azienda(a) {
  const g = a.gestione || {}, rd = a.rating_dettaglio || {};
  const cat = (a.categorie || []).filter(c => /^\d\.\d$/.test(c));
  return {
    id: a.id, _origine: a.origine, name: a.nome, city: citta(a.comune, a.provincia, a.regione), comune: a.comune || '',
    rating: a.rating || 0, reviews: (rd.componenti && rd.componenti.recensioni && rd.componenti.recensioni.n) || 0,
    tips: A().tipsFor(cat.length ? cat : ['1.2']), f: 1, fee: g.fee || 5, color: g.colore || colore(a.id),
    // "catalogo" = scheda pubblica dai registri, non ancora nella rete EdilMen
    status: a.stato === 'attiva' ? 'attiva' : a.stato === 'sospesa' ? 'sospesa' : a.origine === 'catalogo' && a.pubblicata ? 'catalogo' : 'verifica',
    verified: a.stato === 'attiva', piva: a.piva || '', raggio: g.raggio || 50, since: String(a.creato_il).slice(0, 10), desc: g.desc || '',
    plan: a.piano || 'start',
  };
}

async function tutte(tabella, campi, filtro = q => q) {
  const out = [];
  for (let da = 0; da < 50000; da += 1000) {
    const { data, error } = await filtro(G().sb.from(tabella).select(campi)).range(da, da + 999);
    if (error) throw error;
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}

async function attiva() {
  const [lead, aziende] = await Promise.all([
    tutte('lead', 'id,codice,tipo,stato,nome,cognome,telefono,email,canale_contatto,comune,regione,lavoro,quotazione,impresa_scelta,appuntamento,gestione,creato_il', q => q.order('creato_il', { ascending: false })),
    // le schede dei registri non pubblicate e con partita IVA cessata restano fuori: si gestiscono in Richieste dal sito, Aziende
    tutte('aziende', 'id,nome,comune,provincia,regione,categorie,rating,rating_dettaglio,stato,stato_scheda,origine,pubblicata,piva,piano,note,gestione,creato_il',
      q => q.or('origine.neq.catalogo,pubblicata.eq.true,stato.neq.verifica').order('nome')),
  ]);
  let impostazioni = { feeDefault: 5, guide: false };
  try { impostazioni = { ...impostazioni, ...JSON.parse(localStorage.getItem('edilmen-impostazioni-reali') || '{}') }; } catch (e) {}
  const db = { v: 1, reale: true, settings: impostazioni, aziende: aziende.map(azienda), pacchetti: [], richieste: lead.map(richiesta), imported: [], seq: 1, log: [] };
  foto = {};
  db.richieste.forEach(r => { foto['r' + r._id] = JSON.stringify(r); });
  db.aziende.forEach(a => { foto['a' + a.id] = JSON.stringify(a); });
  attivo = true;
  return db;
}

// salvataggio: solo quello che è cambiato dall'ultima lettura
async function salva(db) {
  try { localStorage.setItem('edilmen-impostazioni-reali', JSON.stringify(db.settings)); } catch (e) {}
  const lavori = [];
  for (const r of db.richieste) {
    if (!r._id) continue;
    const s = JSON.stringify(r); if (foto['r' + r._id] === s) continue;
    foto['r' + r._id] = s;
    const gestione = { stato: r.stato, az: r.az || null, importo: r.importo || null, sal: r.sal || null, feePct: r.feePct || null, feePaid: !!r.feePaid, videocall: r.videocall || '', disp: r.disp || [] };
    lavori.push(G().sb.from('lead').update({ stato: A_LEAD[r.stato] || 'nuova', gestione }).eq('id', r._id));
  }
  for (const a of db.aziende) {
    if (!/^[0-9a-f-]{36}$/.test(a.id)) continue;
    const s = JSON.stringify(a); if (foto['a' + a.id] === s) continue;
    foto['a' + a.id] = s;
    const agg = { gestione: { fee: a.fee, raggio: a.raggio, colore: a.color, desc: a.desc || '' } };
    if (['attiva', 'sospesa', 'verifica'].includes(a.status)) agg.stato = a.status;
    if (['start', 'pro', 'premium'].includes(a.plan)) agg.piano = a.plan;
    if (a.status === 'attiva' && a._origine === 'catalogo') agg.pubblicata = true;
    lavori.push(G().sb.from('aziende').update(agg).eq('id', a.id));
  }
  if (!lavori.length) return;
  const esiti = await Promise.all(lavori);
  const err = esiti.find(e => e.error);
  if (err) { console.error(err.error); A().toast('Attenzione: una modifica non è stata salvata nel database'); }
}

window.EM_REALE = { attiva, salva, attivo: () => attivo, disattiva: () => { attivo = false; } };
// la pagina può aver già provato a disegnarsi prima che questo file fosse pronto: si ridisegna
if (window.EM_APP && window.EM_APP.render) window.EM_APP.render();
})();
