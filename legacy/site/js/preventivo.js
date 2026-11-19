/* Quotazione istantanea: le schermate. Si carica solo quando il cliente avvia la quotazione.
   Logica in js/flusso.js, calcolo in js/calcolo.js, testi in js/testi.js. */
(function () {
'use strict';
const F = window.EdilFlusso, C = window.EdilCalcolo, T = window.EM_TESTI, EM = window.EM || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = T.comuni.euro;
const CHIAVE = 'edilmen-preventivo', CHIAVE_ID = 'edilmen-sessione-id';

let S = F.statoIniziale();
let bozza = null;        // valore in corso per domande multi, numero e luogo
let testiConsenso = null;
let inviato = null;      // { codice } dopo l'invio
let visti = new Set();   // schermate già viste (per gli eventi e Nuvo)
const app = () => $('#wz-app');

/* ---------- eventi per il tracciamento (collegati al passo 6) ---------- */
function traccia(nome, dati = {}) {
  try { window.dispatchEvent(new CustomEvent('em:evento', { detail: { nome, dati } })); } catch (e) {}
}

/* ---------- salvataggio ---------- */
let timerServer = null;
function salva() {
  try { localStorage.setItem(CHIAVE, JSON.stringify(F.serializza(S))); } catch (e) {}
  if (!S.intervento || inviato) return;
  clearTimeout(timerServer);
  timerServer = setTimeout(salvaServer, 1500);
}
async function salvaServer() {
  let id = null;
  try { id = localStorage.getItem(CHIAVE_ID); } catch (e) {}
  try {
    const r = await fetch('/api/sessione', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stato: F.serializza(S), utm: utm() }) });
    if (!r.ok) return null;
    const { id: nuovo } = await r.json();
    try { localStorage.setItem(CHIAVE_ID, nuovo); } catch (e) {}
    return nuovo;
  } catch (e) { return null; }
}
function dimentica() {
  try { localStorage.removeItem(CHIAVE); localStorage.removeItem(CHIAVE_ID); } catch (e) {}
}
function utm() {
  try { return JSON.parse(sessionStorage.getItem('edilmen-utm') || '{}'); } catch (e) { return {}; }
}

/* ---------- componenti ---------- */
const etichetta = (id, v) => { const o = T.domande[id].opzioni[String(v)]; return Array.isArray(o) ? o : [o, '']; };
const titolo = (id) => { const t = T.domande[id].titolo; return typeof t === 'function' ? t(S) : t; };
const sotto = (id) => { const t = T.domande[id].sotto; return typeof t === 'function' ? t(S) : t || ''; };
const testa = (h, s) => `<h1 id="pv-h" tabindex="-1">${h}</h1>${s ? `<p class="sub">${s}</p>` : ''}`;
const emo = (id, v) => { const e = (T.domande[id].emoji || {})[String(v)]; return e ? `<span class="emo" aria-hidden="true">${e}</span>` : ''; };
const conferma = (ok) => `<button type="button" class="btn btn-blue pv-conferma" data-azione="avanti" aria-disabled="${!ok}">${esc(T.comuni.conferma)}</button>`;
const nonSoBtn = (id) => `<button type="button" class="pv-nonso" data-nonso="${id}">${esc(T.domande[id]?.nonSo || T.comuni.nonSo)}</button>`;

function schermoScelta(d) {
  const cur = S.risposte[d.id];
  return testa(esc(titolo(d.id)), esc(sotto(d.id))) +
    `<div class="pv-opts" role="radiogroup" aria-labelledby="pv-h">${d.opzioni(S).map(v => {
      const [t, s] = etichetta(d.id, v);
      return `<button type="button" role="radio" aria-checked="${cur === v}" class="pv-opt${cur === v ? ' on' : ''}" data-val='${esc(JSON.stringify(v))}'>${emo(d.id, v)}<span class="t">${esc(t)}</span>${s ? `<span class="d">${esc(s)}</span>` : ''}</button>`;
    }).join('')}</div>${nonSoBtn(d.id)}${d.id === 'intervento' ? `<button type="button" class="vc-invito" data-azione="vocale">${esc(T.vocale.invitoBreve)}</button>` : ''}`;
}

function schermoMulti(d) {
  if (!bozza) bozza = [...(F.leggi(S, d.campo) || [])];
  const nota = d.id === 'kit' && F.kitDisponibile(S).length < C.EFF.length ? `<p class="pv-nota">${esc(T.domande.kit.nota)}</p>` : '';
  return testa(esc(titolo(d.id)), esc(sotto(d.id))) +
    `<div class="pv-opts pv-multi" role="group" aria-labelledby="pv-h">${d.opzioni(S).map(v => {
      const on = bozza.includes(v);
      return `<button type="button" aria-pressed="${on}" class="pv-opt${on ? ' on' : ''}" data-tog="${esc(v)}">${emo(d.id, v)}<span class="t">${esc(etichetta(d.id, v)[0])}</span><span class="chk" aria-hidden="true">${on ? '✓' : ''}</span></button>`;
    }).join('')}</div>${nota}${conferma(F.valida(S, d.id, bozza))}${d.id === 'part' ? `<button type="button" class="pv-nonso" data-nessuna="1">${esc(T.domande.part.nessuna)}</button>` : nonSoBtn(d.id)}`;
}

function schermoNumero(d) {
  if (bozza === null) bozza = S.risposte[d.id] !== undefined && S.risposte[d.id] !== F.NON_SO ? F.leggi(S, d.campo) : d.predefinito(S);
  const u = T.domande[d.id].unita || '';
  const passo = d.passo || (d.max > 1000 ? 5 : 1);
  const cifre = String(d.max).length;
  const contatore = `<div class="pv-num"><button type="button" class="pv-step" data-passo="-${passo}" aria-label="Meno">−</button>
       <span class="pv-val"><input type="number" id="pv-num" inputmode="numeric" min="${d.min}" max="${d.max}" step="${passo}" value="${bozza}" aria-labelledby="pv-h" style="width:${Math.max(2, String(bozza).length) + 0.6}ch" data-cifre="${cifre}">${u ? `<span class="u">${esc(u)}</span>` : ''}</span>
       <button type="button" class="pv-step" data-passo="${passo}" aria-label="Più">+</button></div>`;
  if (d.id === 'bolletta') return testa(esc(titolo(d.id)), esc(sotto(d.id))) + `<div class="pv-chips">${valoriRapidi(d).map(n => `<button type="button" class="pv-chip${n === bozza ? ' on' : ''}" data-num="${n}">${eur(n)}</button>`).join('')}</div>`
    + `<input type="range" id="pv-num" min="${d.min}" max="${d.max}" step="${passo}" value="${bozza}" aria-labelledby="pv-h"><output class="pv-out" for="pv-num">${eur(bozza)}</output>` + conferma(true) + nonSoBtn(d.id);
  // superfici (m², ml...): una barra da trascinare al posto dei valori proposti (richiesta dell'utente del 09/10/2026)
  if (d.predefinito(S) > 5) {
    const fino = Math.min(d.max, Math.max(500, Math.ceil(d.predefinito(S) * 3 / 50) * 50, bozza));
    return testa(esc(titolo(d.id)), esc(sotto(d.id))) + contatore
      + `<input type="range" class="pv-barra" id="pv-barra" min="${d.min}" max="${fino}" step="${passo}" value="${Math.min(bozza, fino)}" aria-label="${esc(titolo(d.id))}" style="--p:${(Math.min(bozza, fino) - d.min) / (fino - d.min) * 100}%">`
      + `<div class="pv-barra-l" aria-hidden="true"><span>${d.min}${u ? ' ' + esc(u) : ''}</span><span>${fino}${u ? ' ' + esc(u) : ''}</span></div>` + conferma(true) + nonSoBtn(d.id);
  }
  const rapide = valoriRapidi(d).map(n => `<button type="button" class="pv-chip${n === bozza ? ' on' : ''}" data-num="${n}">${n + (u ? ' ' + esc(u) : '')}</button>`).join('');
  return testa(esc(titolo(d.id)), esc(sotto(d.id))) + `<div class="pv-chips pv-centro">${rapide}</div><p class="pv-lbl pv-centro">${esc(T.comuni.altroValore)}</p>` + contatore + conferma(true) + nonSoBtn(d.id);
}

/* Valori proposti da toccare: con un tocco si va avanti, senza scrivere niente */
function valoriRapidi(d) {
  const p = d.predefinito(S);
  if (d.id === 'bolletta') return [80, 120, 150, 200, 300];
  if (p <= 3) return [1, 2, 3, 4, 5].filter(n => n >= d.min && n <= d.max);
  const tondo = n => n < 30 ? Math.round(n) : n < 300 ? Math.round(n / 5) * 5 : n < 3000 ? Math.round(n / 50) * 50 : Math.round(n / 500) * 500;
  return [...new Set([0.5, 0.75, 1, 1.5, 2].map(f => Math.min(d.max, Math.max(d.min, tondo(p * f)))))];
}

function schermoLuogo() {
  const L = T.domande.luogo;
  if (!bozza) bozza = { regione: S.regione, comune: S.comune };
  return testa(esc(L.titolo), esc(L.sotto)) +
    `<label class="pv-lbl" for="pv-comune">${esc(L.comune)}</label>
    <input type="text" id="pv-comune" class="pv-in" value="${esc(bozza.comune)}" placeholder="${esc(L.comuneEsempio)}" autocomplete="address-level2" enterkeyhint="go">
    <div class="pv-opts pv-reg" role="radiogroup" aria-labelledby="pv-h">${Object.entries(L.regioni).map(([k, n]) =>
      `<button type="button" role="radio" aria-checked="${bozza.regione === k}" class="pv-opt${bozza.regione === k ? ' on' : ''}" data-reg="${k}">${emo('luogo', k)}<span class="t">${esc(n)}</span></button>`).join('')}</div>
    <p class="pv-nota" id="pv-fuori" hidden>${esc(L.fuoriZona)}</p>${nonSoBtn('luogo')}`;
}

function recap() {
  const Q = T.quotazioni;
  const im = S.intervento === 'nuova' ? C.NUOVA.find(i => i[0] === S.nuovaTipo) : C.IMMOBILI.find(i => i[0] === S.immobile);
  const reg = T.domande.luogo.regioni[S.regione];
  const dettagli = F.domande(S).filter(id => F.PER_ID[id].campo && F.PER_ID[id].campo.startsWith('dett.') && S.risposte[id] !== undefined && S.risposte[id] !== F.NON_SO)
    .map(id => (T.domande[id].breve || {})[S.risposte[id]] || etichetta(id, S.risposte[id])[0]).join(', ');
  const dett = dettagli ? dettagli.charAt(0).toUpperCase() + dettagli.slice(1) : '';
  const righe = [C.pacchetto(S), [im && im[1], [S.comune, reg].filter(Boolean).join(', '), F.serveMq(S) ? S.mq + ' m²' : ''].filter(Boolean).join(', '), dett].filter(Boolean);
  const servizi = [Q.servizi[S.tecnico], S.incentivi === 'si' ? Q.servizi.incentivi : null].filter(Boolean);
  return `<section class="pv-riep" aria-label="${esc(Q.riepilogo)}"><h2>${esc(Q.riepilogo)}</h2><ul>${righe.map(r => `<li><span class="ok" aria-hidden="true">✓</span>${esc(r)}</li>`).join('')}
    ${servizi.map(r => `<li class="srv">${esc(r)}</li>`).join('')}</ul></section>`;
}

function boxIpotesi() {
  const ip = F.ipotesi(S);
  if (!ip.length) return '';
  const V = T.ipotesi.voci;
  return `<div class="pv-ipotesi"><p>${esc(T.ipotesi.titolo)}</p><ul>${ip.map(i => {
    const v = V[i.id]; return `<li>${esc(typeof v === 'function' ? v(i.valore) : v || i.id)}</li>`;
  }).join('')}</ul><p class="small">${esc(T.ipotesi.nota)}</p></div>`;
}

/* Cosa comprende il prezzo: solo le voci che il calcolo usa davvero (nessuna promessa contestabile) */
function inclusi() {
  const Q = T.quotazioni;
  const voci = C.voci(S).map(v => [v.n, '']);
  if (!voci.length) return '';
  if (S.tecnico === 'aiuto' && S.intervento !== 'nuova') voci.push([Q.tecniche, '']);
  voci.push([Q.sicurezza, '']);
  return `<details class="pv-incl"><summary>${esc(Q.incluso)}</summary><ul class="pv-voci">${voci.map(([n, d]) =>
    `<li><span class="ok" aria-hidden="true">✓</span><span><b>${esc(n)}</b>${d ? `<small>${esc(d)}</small>` : ''}</span></li>`).join('')}</ul><p class="small">${esc(Q.inclusoNota)}</p></details>`;
}

function schermoQuotazioni() {
  const Q = T.quotazioni, f = C.forchetta(S), off = C.offerte(S);
  const lux = S.intervento === 'nuova' && S.nuovaTipo === 'luxury';
  const tiers = lux || F.domande(S).includes('livello')
    ? `<p class="pv-lbl">${esc(Q.finiture)}</p><div class="tiers">${(lux ? C.LUX_LIVELLI : C.LIVELLI).map((l, i) => { const k = lux ? 'finLuxury' : 'livello'; return `<button type="button" class="tier${S[k] === i ? ' on' : ''}" aria-pressed="${S[k] === i}" data-tier="${k}:${i}"><b>${esc(l)}</b></button>`; }).join('')}</div>` : '';
  return recap() + testa(esc(Q.titolo), '') + boxIpotesi() + tiers +
    `<div class="range3" aria-live="polite"><div class="lo"><small>${esc(Q.basso)}</small><b>${eur(f.min)}</b></div><div class="mid"><small>${esc(Q.media)}</small><b>${eur(f.media)}</b></div><div class="hi"><small>${esc(Q.alto)}</small><b>${eur(f.max)}</b></div></div>
    <p class="pv-nota">${esc(Q.indicative)}</p><div role="radiogroup" aria-label="${esc(Q.scegli)}">${off.map((o, i) => `<button type="button" role="radio" aria-checked="${S.scelta === i}" class="imp${i === 0 ? ' best' : ''}${S.scelta === i ? ' on' : ''}" data-scelta="${i}">
      ${i === 0 ? `<span class="bdg">${esc(Q.miglior)}</span>` : ''}<span class="av">${o.lettera}</span>
      <span><span class="nm">${esc(Q.impresa(o.lettera))}</span><span class="meta" style="display:block">${esc(Q.verificata)}</span></span>
      <span class="pr">${eur(o.prezzo)}<small class="${o.scarto < 0 ? 'dn' : o.scarto > 0 ? 'up' : ''}">${esc(Q.scarto(o.scarto))}</small></span></button>`).join('')}</div>
    ${inclusi()}<div class="reassure"><span>${Q.rassicura}</span></div>`;
}

/* Incontro (semplificato il 09/10/2026): sopralluogo o chiamata, un tocco e si va avanti. Giorno e ora li fissa il referente quando ricontatta. */
function schermoPrenota() {
  const P = T.prenota;
  return testa(esc(P.titolo), esc(P.sotto)) +
    `<div class="pv-opts" role="radiogroup" aria-labelledby="pv-h">${Object.entries(P.modi).map(([k, [e, t, d]]) =>
      `<button type="button" role="radio" aria-checked="${S.mod === k}" class="pv-opt${S.mod === k ? ' on' : ''}" data-mod="${k}"><span class="emo" aria-hidden="true">${e}</span><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></button>`).join('')}</div>
    <p class="pv-nota">${esc(P.nota)}</p>`;
}

function campo(id, etich, html) { return `<div class="fld"><label for="${id}">${etich}</label>${html}</div>`; }
function schermoContatto(aiuto) {
  const K = T.contatto;
  const intro = aiuto
    ? testa(esc(T.aiuto.titolo), esc(T.aiuto.testo)) + `<button type="button" class="btn btn-go vc-grande" data-azione="vocale">${esc(T.vocale.titolo)}</button><p class="small vc-centro">${esc(T.vocale.promessa.oggi)}</p><h2 class="wz-h2">${esc(K.titolo)}</h2><p class="sub">${esc(K.sotto)}</p>`
    : testa(esc(K.titolo), esc(K.sotto));
  const c = S.canale;
  const input = c === 'email'
    ? `<input id="pv-recapito" type="email" data-bind="mail" value="${esc(S.mail)}" autocomplete="email" inputmode="email" enterkeyhint="send">`
    : `<input id="pv-recapito" type="tel" data-bind="tel" value="${esc(S.tel)}" placeholder="+39" autocomplete="tel" inputmode="tel" enterkeyhint="send">`;
  return intro +
    `<div class="tabs2 tabs3" role="radiogroup" aria-label="${esc(K.titolo)}">${Object.entries(K.canali).map(([k, [e, t, s]]) =>
      `<button type="button" role="radio" aria-checked="${c === k}" class="${c === k ? 'on' : ''}" data-canale="${k}"><span class="emo" aria-hidden="true">${e}</span>${esc(t)}<small>${esc(s)}</small></button>`).join('')}</div>
    ${c ? campo('pv-recapito', esc(K.campo[c]), input) : ''}
    <input type="text" name="sito_web" id="pv-trappola" tabindex="-1" autocomplete="off" class="pv-trappola" aria-hidden="true">
    ${K.privacyHtml(testiConsenso || T.consensiRiserva, S.consensi.marketing, esc)}<p class="pv-errore" id="pv-errore" role="alert" hidden></p>`;
}

function schermoFatto() {
  const Fa = T.fatto;
  if (S.aiuto) return `<div class="done">${testa(esc(Fa.aiutoTitolo), Fa.aiutoTesto(esc(inviato.codice), S.canale))}</div>${bottoniFine()}`;
  return `<div class="done">${testa(esc(Fa.titolo), Fa.testo(esc(inviato.codice), S.canale))}<div class="card" style="text-align:left"><b>${esc(Fa.passiTitolo)}</b><ol>${Fa.passi(S.mod).map(p => `<li>${esc(p)}</li>`).join('')}</ol></div></div>${bottoniFine()}`;
}
const bottoniFine = () => `<div class="pv-fine"><button type="button" class="btn btn-line" data-azione="nuova">${esc(T.fatto.nuova)}</button><button type="button" class="btn btn-blue" data-azione="home">${esc(T.fatto.home)}</button></div>`;

/* ---------- validazione delle schermate finali ---------- */
function mancaPrenota() { return S.mod ? '' : T.prenota.manca; }
function mancaContatto() {
  const M = T.contatto.manca;
  if (!S.canale) return M.canale;
  if (S.canale === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.mail.trim()) ? '' : M.email;
  return S.tel.replace(/\D/g, '').length < 6 ? M.telefono : '';
}

/* ---------- disegno ---------- */
function corpo() {
  if (inviato) return schermoFatto();
  const d = F.PER_ID[S.pos];
  if (d) return d.tipo === 'scelta' ? schermoScelta(d) : d.tipo === 'multi' ? schermoMulti(d) : d.tipo === 'numero' ? schermoNumero(d) : schermoLuogo();
  if (S.pos === 'quotazioni') return schermoQuotazioni();
  if (S.pos === 'prenota') return schermoPrenota();
  if (S.pos === 'contatto') return schermoContatto(false);
  if (S.pos === 'aiuto') return schermoContatto(true);
  return '';
}

function pulsanteAvanti() {
  if (inviato) return null;
  const d = F.PER_ID[S.pos];
  if (d || S.pos === 'prenota') return null; // si va avanti toccando una risposta (multi e numeri: Conferma nella schermata)
  if (S.pos === 'quotazioni') return { testo: T.quotazioni.avanti, ok: S.scelta !== null };
  if (S.pos === 'contatto' || S.pos === 'aiuto') return { testo: T.contatto.invia, ok: true };
  return null;
}

/* Freccia avanti: rimanda la risposta già data (o il valore sulla schermata) senza ritoccare niente */
function puoAvanzare() {
  if (inviato || S.pos === 'contatto' || S.pos === 'aiuto') return null;
  const d = F.PER_ID[S.pos];
  if (d) return d.tipo === 'scelta' ? S.risposte[d.id] !== undefined : d.tipo === 'numero' ? true : F.valida(S, d.id, bozza);
  if (S.pos === 'quotazioni') return S.scelta !== null;
  if (S.pos === 'prenota') return !!S.mod;
  return null;
}
function avanza() {
  const d = F.PER_ID[S.pos];
  if (!puoAvanzare()) { if (EM.say) EM.say(S.pos === 'quotazioni' ? T.quotazioni.scegli : S.pos === 'prenota' ? T.prenota.manca : T.nuvo.fermo); return; }
  if (d) return rispondi(d.tipo === 'scelta' ? S.risposte[d.id] : d.tipo === 'numero' ? Number($('#pv-num').value) : d.tipo === 'luogo' ? { ...bozza } : bozza);
  return vai(F.avanti(S));
}
const freccia = (lato, az, ok, etich) => `<button type="button" class="pv-freccia ${lato}" data-azione="${az}" aria-label="${esc(etich)}" aria-disabled="${!ok}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${lato === 'sx' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg></button>`;

function disegna(focus = true) {
  app().dataset.modo = 'preventivo';
  const html = corpo(); // prima il corpo: prepara il valore in corso che serve al pulsante Avanti
  const a = F.avanzamento(S), st = F.PER_ID[S.pos] ? F.stimaOrientativa(S) : null, av = pulsanteAvanti();
  app().innerHTML = `<div class="pv${av ? ' pv-con-avanti' : ''}">
    ${inviato ? '' : `<div class="pv-top"><div class="pv-riga"><span>${esc(T.comuni.passo(a.passo, a.totale))}</span>
      ${st ? `<span class="pv-stima" aria-live="polite"><small>${esc(T.comuni.stima)}</small> <b>${T.comuni.forchetta(st.min, st.max, eur)}</b></span>` : ''}</div>
      <div class="wz-bar"><i style="width:${Math.round(a.quota * 100)}%"></i></div></div>`}
    <div class="pv-corpo" id="pv-corpo">${html}</div>
    ${inviato ? '' : `<div class="pv-frecce">${freccia('sx', 'indietro', true, T.comuni.indietro)}${puoAvanzare() !== null ? freccia('dx', 'avanza', puoAvanzare(), T.comuni.avanti || 'Avanti') : ''}</div>`}
    ${inviato ? '' : `<div class="wz-foot pv-piede"><div class="in">
      <button type="button" class="btn btn-line pv-indietro" data-azione="indietro">${esc(T.comuni.indietro)}</button>
      ${S.intervento && !['contatto', 'aiuto'].includes(S.pos) ? `<button type="button" class="pv-link" data-azione="salva">${esc(T.comuni.salvaLink)}</button>` : '<span></span>'}
      ${av ? `<button type="button" class="btn btn-blue" data-azione="avanti" aria-disabled="${!av.ok}">${esc(av.testo)}</button>` : '<span></span>'}
    </div></div>`}
  </div>`;
  if (focus) { const h = $('#pv-h'); if (h) h.focus({ preventScroll: true }); scrollTo({ top: 0 }); }
  if (!visti.has(S.pos)) {
    visti.add(S.pos);
    if (S.pos === 'quotazioni') traccia('quotazione_mostrata', { tipo: 'reale' });
  }
}

/* Prima delle offerte: qualche secondo di attesa con la nuvola EdilMen che gira, la barra che si riempie e il conto alla rovescia
   (richiesta dell'utente del 20/10/2026). Solo la prima volta; con "movimenti ridotti" dura meno. */
let preparato = false;
function attesaPreventivo(poi) {
  const lenta = !matchMedia('(prefers-reduced-motion: reduce)').matches, durata = lenta ? 6000 : 1500, P = T.attesa;
  const sig = window.EM_TERRITORIO && S.comune ? EM_TERRITORIO.provinciaDa(S.comune) : null, prov = sig && EM_TERRITORIO.PROVINCE[sig] ? EM_TERRITORIO.PROVINCE[sig].nome : '';
  const passi = P.passi(prov, T.domande.luogo.regioni[S.regione] || '');
  app().innerHTML = `<div class="pv pv-attesa" role="status" aria-live="polite"><div class="pa-nuvola" aria-hidden="true"><svg viewBox="0 0 26 18"><path d="M6.5 18A6.5 6.5 0 0 1 5.3 5.1 7.5 7.5 0 0 1 19.6 4a7 7 0 0 1-.1 14z"/></svg></div>
    <h1 id="pv-h" tabindex="-1">${esc(P.titolo)}</h1><div class="pa-barra"><i></i></div><p class="pa-conto"></p>
    <ul class="pa-passi">${passi.map(t => `<li><span class="ok" aria-hidden="true">✓</span>${esc(t)}</li>`).join('')}</ul></div>`;
  scrollTo({ top: 0 });
  const t0 = performance.now(), barra = $('.pa-barra i', app()), conto = $('.pa-conto', app()), li = $$('.pa-passi li', app());
  const giro = () => {
    if (!$('.pv-attesa', app())) return;
    const p = Math.min(1, (performance.now() - t0) / durata);
    barra.style.width = (p * 100).toFixed(1) + '%';
    conto.textContent = p < 1 ? P.conto(Math.ceil((1 - p) * durata / 1000)) : P.pronto;
    li.forEach((l, i) => l.classList.toggle('on', p >= (i + 0.6) / (li.length + 0.4)));
    if (p < 1) requestAnimationFrame(giro); else setTimeout(poi, 350);
  };
  requestAnimationFrame(giro);
}

function vai(prossima) {
  const prima = S.pos;
  bozza = null;
  if (prossima === 'quotazioni' && !preparato && !visti.has('quotazioni')) {
    preparato = true;
    traccia('step_completato', { step: F.percorso(S).indexOf('quotazioni'), schermata: 'domande' });
    salva();
    return attesaPreventivo(() => disegna());
  }
  if (prossima && prossima !== prima) {
    const i = F.percorso(S).indexOf(prima);
    traccia('step_completato', { step: i + 1, schermata: prima });
  }
  salva();
  disegna();
}

/* ---------- azioni ---------- */
let attesa = null;
function rispondi(valore, pausa = 0) {
  const id = S.pos;
  if (!F.valida(S, id, valore)) { if (EM.say) EM.say(T.nuvo.fermo); return; }
  if (attesa) return;
  if (!pausa) return vai(F.rispondi(S, id, valore));
  attesa = setTimeout(() => { attesa = null; if (S.pos === id) vai(F.rispondi(S, id, valore)); }, pausa);
}
const PAUSA = 280;
function evidenzia(t) {
  $$('.pv-opt.on,.pv-chip.on', app()).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
  t.classList.add('on'); if (t.getAttribute('role') === 'radio') t.setAttribute('aria-checked', 'true');
}

async function invia() {
  const aiuto = S.pos === 'aiuto';
  const manca = mancaContatto();
  const err = $('#pv-errore');
  if (manca) { err.textContent = manca; err.hidden = false; err.focus?.(); return; }
  const btn = $('[data-azione="avanti"]');
  btn.textContent = T.contatto.invio; btn.setAttribute('aria-disabled', 'true');
  const f = C.forchetta(S), off = C.offerte(S), scelta = S.scelta ?? 0;
  const u = utm();
  const dati = {
    tipo: 'procedura', nome: S.nome, cognome: S.cognome, telefono: S.canale === 'email' ? '' : S.tel, email: S.canale === 'email' ? S.mail : '', canale_contatto: S.canale,
    comune: S.comune, regione: S.regione,
    lavoro: { ...F.serializza(S), pacchetto: aiuto ? null : C.pacchetto(S), ipotesi: F.ipotesi(S), non_sa_cosa_fare: aiuto },
    quotazione: aiuto ? null : { tipo: 'reale', min: Math.round(f.min), media: Math.round(f.media), max: Math.round(f.max), offerta: Math.round(off[scelta].prezzo) },
    impresa_scelta: aiuto ? null : 'Impresa ' + off[scelta].lettera,
    appuntamento: aiuto ? null : { modalita: S.mod, giorno: null, ora: null, da_fissare: true },
    utm: u.utm || {}, referrer: u.referrer || '', pagina_ingresso: u.ingresso || '',
    // privacy e condivisione sono informazioni mostrate prima dell'invio: inviando, il cliente ne ha preso visione
    consensi: { privacy: true, condivisione_imprese: true, marketing: S.consensi.marketing === true }, sito_web: $('#pv-trappola')?.value || '',
    meta_ads: window.EM_META ? EM_META.dati() : null, // solo con il consenso ai cookie di marketing
  };
  try {
    const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.errore || r.status);
    inviato = { codice: j.codice };
    copiaNelGestionaleDemo(j.codice, dati);
    traccia(aiuto ? 'contatto_inviato' : 'appuntamento_prenotato', { codice: j.codice });
    dimentica();
    disegna();
    if (EM.say) EM.say(T.fatto.saluto);
  } catch (e) {
    err.textContent = e.message === 'troppe_richieste' ? "Hai inviato molte richieste in poco tempo. Riprova tra un'ora." : T.contatto.errore; err.hidden = false;
    btn.textContent = T.contatto.invia; btn.setAttribute('aria-disabled', 'false');
  }
}

/* Finché il gestionale non legge dal database, la richiesta compare anche nell'area riservata dimostrativa di questo browser */
function copiaNelGestionaleDemo(codice, d) {
  try {
    const tip = { completa: '1.2.a', parziale: { bagno: '1.2.f', cucina: '1.2.c', pavimenti: '1.2.h', infissi: '1.2.i', elettrico: '1.2.d', idraulico: '1.2.e', tinteggiatura: '1.2.g' }[S.ambienti[0]] || '1.2.c', nuova: '1.1.a', eff: { tetto: '1.3.a', finestre: '1.3.c', cappotto: '1.3.a', fv: S.accumulo ? '2.1.c' : '2.1.b', pdc: '1.3.b' }[S.eff[0]] || '1.3.a' }[S.intervento] || '1.2.c';
    const citta = { taa: 'Trento', ven: 'Padova', fvg: 'Udine' }[S.regione] || 'Trento';
    const ib = JSON.parse(localStorage.getItem('edilmen-inbox') || '[]');
    ib.unshift({ id: codice, data: new Date().toISOString(), fonte: 'sito', cliente: { nome: (S.nome + ' ' + S.cognome).trim(), tel: S.tel, mail: S.mail, canale: { whatsapp: 'WhatsApp', email: 'Email' }[S.canale] || 'Telefono' },
      tip, q: S.mq, citta, fin: C.LIVELLI[S.livello].toLowerCase(), when: '', voci: [d.lavoro.pacchetto || 'Da capire con il cliente', 'Comune: ' + S.comune, 'Contatto preferito: ' + ({ whatsapp: 'WhatsApp', email: 'Email' }[S.canale] || 'Telefono'), ...C.voci(S).map(x => x.n)],
      scelta: d.impresa_scelta || '', stima: d.quotazione ? d.quotazione.offerta : 0, videocall: d.appuntamento ? (S.mod === 'sopralluogo' ? 'Sopralluogo' : 'Chiamata') + ' da fissare' : '' });
    localStorage.setItem('edilmen-inbox', JSON.stringify(ib.slice(0, 50)));
  } catch (e) {}
}

async function linkPerDopo() {
  clearTimeout(timerServer);
  const id = await salvaServer();
  const link = id ? `${location.origin}${location.pathname}?s=${id}#preventivo` : null;
  if (!link) { if (EM.say) EM.say(T.contatto.errore); return; }
  let copiato = false;
  try { await navigator.clipboard.writeText(link); copiato = true; } catch (e) {}
  if (EM.say) EM.say(copiato ? T.comuni.linkCopiato : `${T.comuni.linkPronto}<br><a href="${esc(link)}">${esc(link)}</a>`);
}

function clic(e) {
  const t = e.target.closest('button,[data-azione],summary'); if (!t || !app().contains(t)) return;
  const d = F.PER_ID[S.pos];
  if (t.dataset.nonso) return rispondi(F.NON_SO);
  if (t.dataset.val !== undefined) { evidenzia(t); return rispondi(JSON.parse(t.dataset.val), PAUSA); }
  if (t.dataset.num !== undefined) { evidenzia(t); return rispondi(Number(t.dataset.num), PAUSA); }
  if (t.dataset.nessuna) return rispondi([]);
  if (t.dataset.tog !== undefined) { const v = t.dataset.tog, i = bozza.indexOf(v); i < 0 ? bozza.push(v) : bozza.splice(i, 1); return disegna(false); }
  if (t.dataset.reg) { bozza.regione = t.dataset.reg; evidenzia(t); return rispondi({ ...bozza }, PAUSA); }
  if (t.dataset.passo) { const inp = $('#pv-num'); bozza = Math.min(d.max, Math.max(d.min, (Number(inp.value) || 0) + Number(t.dataset.passo))); inp.value = bozza; allinea(); return aggiornaAvanti(); }
  if (t.dataset.tier) { const [k, v] = t.dataset.tier.split(':'); S[k] = Number(v); salva(); return disegna(false); }
  if (t.dataset.scelta !== undefined) { S.scelta = Number(t.dataset.scelta); salva(); return disegna(false); }
  if (t.dataset.comp) { S.comp[t.dataset.comp] = S.comp[t.dataset.comp] === false; salva(); const aperto = $('.pv-incl')?.open; disegna(false); if (aperto) $('.pv-incl').open = true; return; }
  if (t.dataset.mod) { S.mod = t.dataset.mod; S.giorno = null; S.slot = null; evidenzia(t); salva(); clearTimeout(attesa); attesa = setTimeout(() => { attesa = null; if (S.pos === 'prenota') vai(F.avanti(S)); }, PAUSA); return; }
  if (t.dataset.canale) { S.canale = t.dataset.canale; disegna(false); $('#pv-recapito')?.focus(); return; }
  const az = t.dataset.azione;
  if (az === 'indietro') { clearTimeout(attesa); attesa = null; if (S.pos === 'intervento' || inviato) return EM.show && EM.show('home'); bozza = null; F.indietro(S); salva(); return disegna(); }
  if (az === 'avanza') return avanza();
  if (az === 'salva') return linkPerDopo();
  if (az === 'vocale') return EM.apriVocale && EM.apriVocale({ regione: S.regione, comune: S.comune, origine: 'procedura-' + S.pos, daPreventivo: true });
  if (az === 'nuova') { inviato = null; S = F.statoIniziale(); visti = new Set(); dimentica(); traccia('procedura_avviata', { da: 'nuova' }); return disegna(); }
  if (az === 'home') return EM.show && EM.show('home');
  if (az === 'avanti') {
    if (t.getAttribute('aria-disabled') === 'true') { if (S.pos === 'quotazioni' && EM.say) EM.say(T.quotazioni.scegli); else if (EM.say && d) EM.say(T.nuvo.fermo); return; }
    if (d) return rispondi(d.tipo === 'numero' ? Number($('#pv-num').value) : d.tipo === 'luogo' ? { ...bozza } : bozza);
    if (S.pos === 'prenota') { const m = mancaPrenota(); if (m) { if (EM.say) EM.say(m); return; } }
    if (S.pos === 'contatto' || S.pos === 'aiuto') return invia();
    return vai(F.avanti(S));
  }
}

/* larghezza del numero e posizione della barra seguono il valore */
function allinea() {
  const n = $('#pv-num'), b = $('#pv-barra');
  if (n && n.type === 'number') n.style.width = (Math.max(2, String(n.value).length) + 0.6) + 'ch';
  if (b && document.activeElement !== b) b.value = Math.min(Number(b.max), Math.max(Number(b.min), bozza));
  if (b) b.style.setProperty('--p', (Number(b.value) - Number(b.min)) / (Number(b.max) - Number(b.min)) * 100 + '%');
}

function aggiornaAvanti() {
  const b = $('[data-azione="avanti"]'), d = F.PER_ID[S.pos], av = pulsanteAvanti();
  const ok = d ? F.valida(S, d.id, d.tipo === 'numero' ? bozza : bozza) : av && av.ok;
  if (b) b.setAttribute('aria-disabled', String(!ok));
  const fr = $('.pv-freccia.dx'); if (fr) fr.setAttribute('aria-disabled', String(!puoAvanzare()));
  if (d && d.tipo === 'numero') $$('.pv-chip', app()).forEach(c => c.classList.toggle('on', Number(c.dataset.num) === bozza));
}

function input(e) {
  const t = e.target;
  if (t.id === 'pv-num') { bozza = Number(t.value); const o = $('.pv-out'); if (o) o.textContent = eur(bozza); allinea(); return aggiornaAvanti(); }
  if (t.id === 'pv-barra') { bozza = Number(t.value); $('#pv-num').value = bozza; allinea(); return aggiornaAvanti(); }
  if (t.id === 'pv-comune') {
    bozza.comune = t.value;
    const r = F.regioneDaComune(t.value);
    if (r && r !== bozza.regione) { bozza.regione = r; $$('[data-reg]').forEach(b => { const on = b.dataset.reg === r; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
    return aggiornaAvanti();
  }
  if (t.dataset.bind) { S[t.dataset.bind] = t.value; return; }
  if (t.dataset.consenso) { S.consensi[t.dataset.consenso] = t.checked; }
}

function tasti(e) {
  if (e.key === 'Enter' && e.target.id === 'pv-recapito') { e.preventDefault(); $('[data-azione="avanti"]')?.click(); return; }
  if (e.key === 'Enter' && e.target.id === 'pv-num') { e.preventDefault(); $('[data-azione="avanti"]')?.click(); }
  if (e.key === 'Enter' && e.target.id === 'pv-comune') { e.preventDefault(); if (bozza && bozza.regione) rispondi({ ...bozza }); }
}

async function caricaConsensi() {
  if (testiConsenso) return;
  try { const r = await fetch('/api/testi-consenso'); if (r.ok) testiConsenso = await r.json(); } catch (e) {}
  if (!Array.isArray(testiConsenso) || !testiConsenso.length) testiConsenso = T.consensiRiserva;
}

/* ---------- avvio ---------- */
function applicaPreset(p) {
  if (!p || !p.job) return;
  const [k, sub] = p.job.split(':');
  if (p.regione) S.regione = p.regione;
  if (p.comune) { S.comune = p.comune; S.regione = F.regioneDaComune(p.comune) || S.regione; }
  if (k === 'eff' && sub) S.eff = [sub];
  F.rispondi(S, 'intervento', k);
  if (k === 'eff' && sub) S.kitFisso = true;   // lavoro già scelto dalla home: niente domanda sugli interventi
  if (k === 'parziale' && sub) F.rispondi(S, 'ambienti', [sub]);
  if (k === 'nuova' && sub) F.rispondi(S, 'nuovaTipo', sub);
}

async function ripresaDaLink() {
  const id = new URLSearchParams(location.search).get('s');
  if (!id) return null;
  try { history.replaceState(null, '', location.pathname + '#preventivo'); } catch (e) {}
  try {
    const r = await fetch('/api/sessione?id=' + encodeURIComponent(id));
    if (!r.ok) return null;
    const { stato } = await r.json();
    try { localStorage.setItem(CHIAVE_ID, id); } catch (e) {}
    return F.ripristina(stato);
  } catch (e) { return null; }
}

function salvataLocale() {
  try { const s = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); return s ? F.ripristina(s) : null; } catch (e) { return null; }
}

async function avvia(preset) {
  inviato = null; bozza = null; visti = new Set();
  const daLink = await ripresaDaLink();
  if (daLink) { S = daLink; }
  else if (preset && preset.job) { S = F.statoIniziale(); try { localStorage.removeItem(CHIAVE_ID); } catch (e) {} applicaPreset(preset); }
  else {
    const loc = salvataLocale();
    if (loc && loc.pos !== 'intervento') {
      app().dataset.modo = 'preventivo';
      app().innerHTML = `<div class="pv"><div class="pv-corpo">${testa(esc(T.comuni.riprendi), '')}<div class="pv-fine"><button type="button" class="btn btn-blue" id="pv-si">${esc(T.comuni.riprendiSi)}</button><button type="button" class="btn btn-line" id="pv-no">${esc(T.comuni.riprendiNo)}</button></div></div></div>`;
      $('#pv-h').focus();
      $('#pv-si').onclick = () => { S = loc; disegna(); };
      $('#pv-no').onclick = () => { S = F.statoIniziale(); dimentica(); disegna(); };
      traccia('procedura_avviata', { da: 'ripresa' });
      caricaConsensi();
      return;
    }
    S = F.statoIniziale();
    if (preset && preset.regione) S.regione = preset.regione;
  }
  traccia('procedura_avviata', { da: daLink ? 'link' : preset && preset.job ? 'home' : 'diretto' });
  disegna();
  caricaConsensi();
}

/* Abbandono: se chiude la pagina a metà (collegato al passo 5 e 6) */
addEventListener('pagehide', () => { if (S.intervento && !inviato && document.body.classList.contains('wz-open')) traccia('procedura_abbandonata', { schermata: S.pos }); });

// Il contenitore è condiviso con il vocale: rispondiamo solo quando è mostrata la quotazione
const mio = e => app() && app().dataset.modo === 'preventivo' && app().contains(e.target);
document.addEventListener('click', e => { if (mio(e)) clic(e); });
document.addEventListener('input', e => { if (mio(e)) input(e); });
document.addEventListener('change', e => { if (mio(e) && e.target.dataset.consenso) input(e); });
document.addEventListener('keydown', e => { if (mio(e)) tasti(e); });

window.EM_PREVENTIVO = {
  avvia,
  // Cliente fermo su una schermata: Nuvo propone "Non lo so ancora" e il vocale
  suggerimento: () => (inviato ? null : F.PER_ID[S.pos] || S.pos === 'aiuto' ? { testo: T.nuvo.fermo + ' ' + T.nuvo.fermoVocale, vocale: true }
    : S.pos === 'quotazioni' && S.scelta === null ? { testo: T.quotazioni.scegli } : null),
  ridisegna: () => disegna(),
  stato: () => S,
};
})();
