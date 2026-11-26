/* Vecchia scuola (20/11/2026; prima "Raccontacelo a voce"): il cliente scrive due righe O registra un vocale, aggiunge le foto,
   e un referente gli prepara la quotazione su misura. Vale per tutti i lavori, anche quelli che hanno il prezzo subito.
   Con il vocale: come prima. Solo testo: le foto passano dallo stesso archivio privato se il servizio lo accetta,
   altrimenti la richiesta parte da /api/lead con la descrizione e la nota delle foto da chiedere.
   Percorso originale: quotazione su misura con un vocale. Si carica solo quando serve.
   Registra dal browser (MediaRecorder) o carica un file, poi: /api/vocale prepara i link monouso,
   il browser carica i file direttamente nell'archivio privato, /api/vocale invia crea la richiesta prioritaria. */
(function () {
'use strict';
const T = window.EM_TESTI, V = T.vocale, K = T.contatto, F = window.EdilFlusso, EM = window.EM || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX_S = 180, MAX_BYTE = 10 * 1024 * 1024, MAX_FOTO = 5;
const TIPI_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav'];

let box, D, rec = null, flusso = null, timer = null, invio = false;
const nuovo = o => ({ passo: 1, audio: null, durata: null, url: null, regione: o.regione || null, comune: o.comune || '', testo: '', foto: [], tipo: o.tipo || null,
  canale: null, nome: '', cognome: '', tel: '', mail: '', consensi: { privacy: false, condivisione_imprese: false, marketing: false }, origine: o.origine || 'sito',
  errore: '', fatto: null });

function traccia(nome, dati = {}) { try { window.dispatchEvent(new CustomEvent('em:evento', { detail: { nome, dati } })); } catch (e) {} }
const tipoBase = m => String(m || '').split(';')[0].trim().toLowerCase();

/* ---------- registrazione ---------- */
function formatoRegistrazione() {
  if (!window.MediaRecorder) return null;
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
}
async function avviaRegistrazione() {
  const formato = formatoRegistrazione();
  if (formato === null || !navigator.mediaDevices) return errore(V.microfonoNo);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return errore(V.microfonoNo); }
  const pezzi = [], inizio = Date.now();
  const mr = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);
  rec = { mr, inizio, secondi: 0 };
  mr.ondataavailable = e => { if (e.data.size) pezzi.push(e.data); };
  mr.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    clearInterval(timer);
    const blob = new Blob(pezzi, { type: tipoBase(mr.mimeType || formato || 'audio/webm') });
    impostaAudio(blob, Math.min(MAX_S, (Date.now() - inizio) / 1000));
    rec = null; disegna();
  };
  mr.start(1000);
  timer = setInterval(() => {
    rec.secondi = (Date.now() - inizio) / 1000;
    const t = $('#vc-tempo'); if (t) t.textContent = V.tempo(rec.secondi, MAX_S);
    if (rec.secondi >= MAX_S) mr.stop();
  }, 250);
  D.errore = ''; disegna();
}
function impostaAudio(blob, durata) {
  if (D.url) URL.revokeObjectURL(D.url);
  D.audio = blob; D.durata = durata; D.url = URL.createObjectURL(blob);
}

/* file caricato: controllo formato, peso e durata */
function caricaFile(file) {
  const tipo = tipoBase(file.type) || ({ mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', wav: 'audio/wav', aac: 'audio/aac' })[file.name.split('.').pop().toLowerCase()];
  if (!TIPI_AUDIO.includes(tipo) || file.size > MAX_BYTE) return errore(V.fileNo);
  const blob = tipo === file.type ? file : new Blob([file], { type: tipo });
  const a = new Audio(); a.preload = 'metadata';
  const url = URL.createObjectURL(blob);
  a.onloadedmetadata = () => {
    URL.revokeObjectURL(url);
    const d = Number.isFinite(a.duration) ? a.duration : null; // alcuni webm non dichiarano la durata
    if (d !== null && d > MAX_S + 2) return errore(V.fileNo);
    impostaAudio(blob, d); D.errore = ''; disegna();
  };
  a.onerror = () => { URL.revokeObjectURL(url); impostaAudio(blob, null); D.errore = ''; disegna(); };
  a.src = url;
}

/* ---------- schermate ---------- */
const campo = (id, etich, html) => `<div class="fld"><label for="${id}">${etich}</label>${html}</div>`;

function sezioneAudio() {
  if (rec) return `<div class="vc-rec"><button type="button" class="vc-mic on" data-az="ferma" aria-label="${esc(V.ferma)}"><span class="vc-quad" aria-hidden="true"></span></button>
    <p class="vc-stato"><b>${esc(V.ferma)}</b><span id="vc-tempo" aria-live="off">${V.tempo(rec.secondi, MAX_S)}</span></p></div>`;
  if (D.audio) return `<div class="vc-pronto"><p><b>${esc(V.pronto)}</b>${D.durata ? ` (${V.tempo(D.durata, MAX_S).split(' ')[0]})` : ''}</p><audio controls src="${D.url}"></audio>
    <div class="vc-riga"><button type="button" class="btn btn-line" data-az="rifai">${esc(V.rifai)}</button><button type="button" class="pv-link" data-az="togli">${esc(V.togli)}</button></div></div>`;
  return `<div class="vc-rec"><button type="button" class="vc-mic" data-az="registra" aria-label="${esc(V.registra)}"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
    <p class="vc-stato"><b>${esc(V.registra)}</b><span>${esc(V.durataMax)}</span></p></div>
    <p class="vc-oppure">${esc(V.oppure)}</p>
    <label class="btn btn-line vc-file">${esc(V.carica)}<input type="file" accept="audio/*,.m4a,.opus,.ogg,.mp3,.wav,.webm,.aac" data-file="audio" class="vc-nascosto"></label>
    <p class="small vc-centro">${esc(V.caricaNota)}</p>`;
}

function consensiHtml() {
  return K.privacyHtml(window.EM_CONSENSI || T.consensiRiserva, D.consensi.marketing, esc);
}

const PROMESSA = 'Entro 60 minuti ti mandiamo la quotazione, al più tardi entro 5 giorni. Se manca qualche informazione, te la chiediamo.';
const CANALI2 = { whatsapp: ['💬', 'WhatsApp', 'ti scriviamo su WhatsApp'], telefono: ['📞', 'Telefono', 'ti chiamiamo noi'] };

function testa(passo) {
  return `<div class="vcx-top"><span>🎙️ Mandaci un vocale · Richiesta gratuita</span><button type="button" class="vcx-chiudi" data-az="indietro" aria-label="Chiudi">✕ Chiudi</button></div>
    ${passo ? `<div class="vcx-passo"><span>Passo ${passo} di 2</span><div class="vcx-barra"><i style="width:${passo * 50}%"></i></div></div>` : ''}`;
}

function disegna() {
  if (!box || box.dataset.modo !== 'vocale') return; // il contenitore è tornato alla quotazione
  if (D.fatto) {
    box.innerHTML = `<div class="vcx"><div class="vcx-card">${testa(0)}<div class="vcx-corpo vcx-fatto">
      <div class="vcx-ok" aria-hidden="true">✅</div><h1 id="pv-h" tabindex="-1">Vocale ricevuto, grazie!</h1>
      <p class="vcx-sub">Il codice della tua richiesta è <b>${esc(D.fatto.codice)}</b>.</p>
      <p class="vcx-promessa">⏱ ${esc(PROMESSA)}</p>
      <p class="vcx-sub">Ti ${D.canale === 'whatsapp' ? 'scriviamo su WhatsApp' : 'chiamiamo'} al numero <b>${esc(D.tel)}</b>.</p>
      <div class="vcx-az"><button type="button" class="vcx-go" data-az="home">Torna alla home</button></div></div></div></div>`;
    $('#pv-h').focus(); scrollTo({ top: 0 }); return;
  }
  const passo = D.passo || 1;
  let corpo;
  if (passo === 1) {
    corpo = `<h1 id="pv-h" tabindex="-1">Raccontaci il lavoro a voce</h1>
      <p class="vcx-sub">Dove si trova, che cosa vuoi fare, quanto è grande. Come lo spiegheresti a un geometra. Massimo 3 minuti.</p>
      <section class="vcx-rec" aria-label="${esc(V.parla)}">${sezioneAudio()}</section>
      <details class="vcx-alt"${D.testo ? ' open' : ''}><summary>✍️ Preferisci scrivere?</summary>
        <textarea id="vc-testo" class="vcx-in vcx-area" data-bind="testo" maxlength="2000" rows="4" placeholder="${esc(V.testoEsempio)}">${esc(D.testo)}</textarea></details>
      <p class="vcx-promessa">⏱ ${esc(PROMESSA)}</p>`;
  } else {
    corpo = `<h1 id="pv-h" tabindex="-1">Come ti contattiamo?</h1>
      <p class="vcx-sub">Ti mandiamo la quotazione qui. Niente pubblicità.</p>
      <div class="vcx-canali" role="radiogroup" aria-label="Metodo di contatto">${Object.entries(CANALI2).map(([k, [e, t, s]]) =>
        `<button type="button" role="radio" aria-checked="${D.canale === k}" class="vcx-canale${D.canale === k ? ' on' : ''}" data-canale="${k}"><span class="e" aria-hidden="true">${e}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></button>`).join('')}</div>
      <div class="vcx-campi"><div class="fld"><label for="vc-nome">👤 Nome</label><input type="text" id="vc-nome" class="vcx-in" data-bind="nome" value="${esc(D.nome)}" autocomplete="given-name"></div>
      <div class="fld"><label for="vc-recapito">📱 Numero di telefono</label><input type="tel" id="vc-recapito" class="vcx-in" data-bind="tel" value="${esc(D.tel)}" placeholder="+39" autocomplete="tel" inputmode="tel"></div></div>
      <input type="text" id="vc-trappola" tabindex="-1" autocomplete="off" class="pv-trappola" aria-hidden="true">
      <div class="vcx-privacy">${consensiHtml()}</div>`;
  }
  box.innerHTML = `<div class="vcx"><div class="vcx-card">${testa(passo)}<div class="vcx-corpo">${corpo}
      <p class="pv-errore vcx-err" id="vc-errore" role="alert" ${D.errore ? '' : 'hidden'}>${esc(D.errore)}</p></div>
    <div class="vcx-az"><button type="button" class="vcx-back" data-az="${passo === 1 ? 'indietro' : 'passo1'}">← Indietro</button>
      ${passo === 1 ? '<button type="button" class="vcx-go" data-az="passo2">Continua →</button>' : `<button type="button" class="vcx-go" data-az="invia" ${invio ? 'aria-disabled="true"' : ''}>Invia il vocale →</button>`}</div>
    <p class="vcx-guida">Preferisci rispondere a qualche domanda? <button type="button" class="pv-link" data-az="digitale">Usa la procedura guidata</button></p></div></div>`;
}

function errore(msg) {
  D.errore = msg;
  const e = $('#vc-errore');
  if (e) { e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else disegna();
}

function mancaAudio() { return !D.audio && D.testo.trim().length < 10 ? V.manca.audio : ''; }
function manca() {
  if (mancaAudio()) return mancaAudio();
  const M = K.manca;
  if (!D.nome.trim()) return 'Scrivi il tuo nome.';
  if (!D.canale) return M.canale;
  if (D.canale === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(D.mail.trim()) ? '' : M.email;
  return D.tel.replace(/\D/g, '').length < 6 ? M.telefono : '';
}

/* caricamento con avanzamento: il file va direttamente nell'archivio privato con un link monouso */
function carica(link, blob, nome, avanz) {
  return new Promise((ok, ko) => {
    const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', blob, nome);
    const x = new XMLHttpRequest();
    x.open('PUT', link);
    x.setRequestHeader('x-upsert', 'false');
    if (window.EM_CONFIG) x.setRequestHeader('apikey', window.EM_CONFIG.supabasePublishableKey);
    x.upload.onprogress = e => { if (e.lengthComputable) avanz(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : ko(new Error('upload ' + x.status)));
    x.onerror = () => ko(new Error('rete'));
    x.timeout = 120000; x.ontimeout = () => ko(new Error('timeout'));
    x.send(fd);
  });
}

/* Testo da salvare: il tipo di lavoro scelto davanti alla descrizione */
const testoCompleto = () => [D.tipo ? 'Lavoro: ' + V.tipi[D.tipo] + '.' : '', D.testo.trim()].filter(Boolean).join(' ');

/* Solo testo, senza vocale: richiesta da /api/lead come la vecchia "non so cosa fare", con la descrizione */
async function inviaTesto(notaFoto) {
  let u = {}; try { u = JSON.parse(sessionStorage.getItem('edilmen-utm') || '{}'); } catch (e) {}
  const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    tipo: 'procedura', nome: D.nome, cognome: D.cognome, telefono: D.canale === 'email' ? '' : D.tel, email: D.canale === 'email' ? D.mail : '', canale_contatto: D.canale,
    comune: D.comune, regione: D.regione,
    lavoro: { modalita: 'vecchia_scuola', tipo_lavoro: D.tipo, descrizione: testoCompleto() + (notaFoto ? ' [Il cliente ha ' + D.foto.length + ' foto da inviare: chiederle su WhatsApp]' : ''), non_sa_cosa_fare: true, origine: D.origine },
    quotazione: null, impresa_scelta: null, appuntamento: null,
    utm: u.utm || {}, referrer: u.referrer || '', pagina_ingresso: u.ingresso || '',
    consensi: { privacy: true, condivisione_imprese: true, marketing: D.consensi.marketing === true }, sito_web: $('#vc-trappola')?.value || '',
    meta_ads: window.EM_META ? EM_META.dati() : null }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.errore || r.status);
  return j;
}

async function invia() {
  if (invio) return;
  const m = manca(); if (m) return errore(m);
  invio = true; D.errore = '';
  const btn = $('[data-az="invia"]'); btn.setAttribute('aria-disabled', 'true');
  if (!D.audio && !D.foto.length) {
    try { const j = await inviaTesto(false); D.fatto = { codice: j.codice, entro: j.entro }; traccia('vecchia_scuola_inviata', { codice: j.codice, tipo: D.tipo, mezzo: 'testo' }); invio = false; return disegna(); }
    catch (e) { invio = false; errore(e.message === 'troppe_richieste' ? "Hai inviato molte richieste in poco tempo. Riprova tra un'ora." : V.errore); btn.removeAttribute('aria-disabled'); return; }
  }
  const meta = { audio: D.audio ? { mime: tipoBase(D.audio.type), byte: D.audio.size, durata: D.durata } : null, foto: D.foto.map(f => ({ mime: tipoBase(f.type), byte: f.size })) };
  try {
    const r1 = await fetch('/api/vocale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'prepara', ...meta }) });
    const p = await r1.json().catch(() => ({}));
    if (!r1.ok || (D.foto.length && !Array.isArray(p.foto))) {
      if (D.audio) throw new Error(p.errore || r1.status);
      // il servizio vuole sempre un vocale: la richiesta parte col testo e la nota delle foto
      const j = await inviaTesto(true); D.fatto = { codice: j.codice, entro: j.entro }; traccia('vecchia_scuola_inviata', { codice: j.codice, tipo: D.tipo, mezzo: 'testo' }); invio = false; return disegna();
    }
    const file = [...(D.audio ? [[p.audio, D.audio, 'vocale']] : []), ...D.foto.map((f, i) => [p.foto[i], f, f.name])];
    const pesi = file.map(x => x[1].size), tot = pesi.reduce((a, b) => a + b, 0) || 1, fatti = pesi.map(() => 0);
    const avanz = i => q => { fatti[i] = q * pesi[i]; btn.textContent = V.invio(Math.round(fatti.reduce((a, b) => a + b, 0) / tot * 100)); };
    await Promise.all(file.map(([link, blob, nome], i) => carica(link, blob, nome, avanz(i))));
    let u = {}; try { u = JSON.parse(sessionStorage.getItem('edilmen-utm') || '{}'); } catch (e) {}
    const r2 = await fetch('/api/vocale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'invia', id: p.id, ...meta,
      testo: testoCompleto(), tipo_lavoro: D.tipo, nome: D.nome, cognome: D.cognome, telefono: D.canale === 'email' ? '' : D.tel, email: D.canale === 'email' ? D.mail : '', canale_contatto: D.canale, comune: D.comune, regione: D.regione,
      consensi: { privacy: true, condivisione_imprese: true, marketing: D.consensi.marketing === true }, origine: D.origine, utm: u.utm || {}, referrer: u.referrer || '', pagina_ingresso: u.ingresso || '', sito_web: $('#vc-trappola')?.value || '', meta_ads: window.EM_META ? EM_META.dati() : null }) });
    const j = await r2.json(); if (!r2.ok || !j.ok) throw new Error(j.errore || r2.status);
    D.fatto = { codice: j.codice, entro: j.entro };
    traccia('vecchia_scuola_inviata', { codice: j.codice, origine: D.origine, tipo: D.tipo, mezzo: D.audio ? 'vocale' : 'testo', durata: D.durata });
    invio = false; disegna();
    if (EM.say) EM.say('Grazie! La tua richiesta è arrivata: ci pensiamo noi.');
  } catch (e) {
    invio = false; errore(e.message === 'troppe_richieste' ? "Hai inviato molte richieste in poco tempo. Riprova tra un'ora." : V.errore); btn.textContent = V.invia; btn.removeAttribute('aria-disabled');
  }
}

/* ---------- eventi ---------- */
function clic(e) {
  if (box.dataset.modo !== 'vocale') return;
  const t = e.target.closest('button'); if (!t) return;
  const az = t.dataset.az;
  if (az === 'registra') return avviaRegistrazione();
  if (az === 'ferma' && rec) return rec.mr.stop();
  if (az === 'rifai') { D.audio = null; return avviaRegistrazione(); }
  if (az === 'togli') { if (D.url) URL.revokeObjectURL(D.url); D.audio = null; D.url = null; D.durata = null; return disegna(); }
  if (az === 'passo2') { if (rec) return errore('Ferma la registrazione prima di continuare.'); const m = mancaAudio(); if (m) return errore(m); D.passo = 2; D.errore = ''; disegna(); $('#pv-h').focus(); return scrollTo({ top: 0 }); }
  if (az === 'passo1') { D.passo = 1; D.errore = ''; disegna(); return scrollTo({ top: 0 }); }
  if (az === 'invia') return invia();
  if (az === 'digitale') { if (rec) rec.mr.stop(); return EM.apriPreventivo ? EM.apriPreventivo({ regione: D.regione }) : EM.show && EM.show('home'); }
  if (t.dataset.tipo) { D.tipo = D.tipo === t.dataset.tipo ? null : t.dataset.tipo; return disegna(); }
  if (az === 'indietro' || az === 'home') { if (rec) rec.mr.stop(); return EM.torna ? EM.torna() : EM.show && EM.show('home'); }
  if (t.dataset.reg) { D.regione = t.dataset.reg; return disegna(); }
  if (t.dataset.canale) { D.canale = t.dataset.canale; return disegna(); }
  if (t.dataset.togliFoto !== undefined) { D.foto.splice(Number(t.dataset.togliFoto), 1); return disegna(); }
}
function input(e) {
  if (box.dataset.modo !== 'vocale') return;
  const t = e.target;
  if (t.dataset.file && e.type !== 'change') return; // i file arrivano solo con l'evento change
  if (t.dataset.bind) {
    D[t.dataset.bind] = t.value;
    if (t.dataset.bind === 'comune' && F) { const r = F.regioneDaComune(t.value); if (r && r !== D.regione) { D.regione = r; $$('[data-reg]', box).forEach(b => { const on = b.dataset.reg === r; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); } }
  }
  if (t.dataset.consenso) D.consensi[t.dataset.consenso] = t.checked;
  if (t.dataset.file === 'audio' && t.files[0]) caricaFile(t.files[0]);
  if (t.dataset.file === 'foto') {
    const nuove = [...t.files].filter(f => f.type.startsWith('image/') && f.size <= MAX_BYTE);
    if (D.foto.length + nuove.length > MAX_FOTO || nuove.length < t.files.length) D.errore = V.fotoTroppe; else D.errore = '';
    D.foto = [...D.foto, ...nuove].slice(0, MAX_FOTO); disegna();
  }
}

async function caricaConsensi() {
  if (window.EM_CONSENSI) return;
  try { const r = await fetch('/api/testi-consenso'); if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) window.EM_CONSENSI = j; } } catch (e) {}
}

window.EM_VOCALE = {
  // spegne il microfono se si esce dal vocale mentre si registra
  ferma() { if (rec) rec.mr.stop(); },
  apri(contenitore, opzioni = {}) {
    if (box && box !== contenitore) { box.removeEventListener('click', clic); box.removeEventListener('input', input); box.removeEventListener('change', input); }
    box = contenitore; box.dataset.modo = 'vocale'; D = nuovo(opzioni); invio = false;
    box.addEventListener('click', clic); box.addEventListener('input', input); box.addEventListener('change', input);
    disegna(); $('#pv-h').focus(); scrollTo({ top: 0 });
    traccia('vocale_aperto', { origine: D.origine });
    caricaConsensi().then(() => { if (!D.fatto && !rec) { const aperto = $('.vc-extra', box)?.open; disegna(); if (aperto) $('.vc-extra', box).open = true; } });
  },
};
})();
