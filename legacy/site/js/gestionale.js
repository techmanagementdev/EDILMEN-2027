/* Gestionale EdilMen: accesso reale dell'amministrazione e richieste dal sito, letti da Supabase.
   Il resto dell'area riservata (pacchetti, aziende, contratti...) è ancora dimostrativo e usa dati nel browser.
   La sicurezza la fa il database: le tabelle rispondono solo a chi ha profili.ruolo = 'admin'. */
(function () {
'use strict';
const A = window.EM_APP;
if (!A || !window.supabase || !window.EM_CONFIG) return;
const { $, $$, esc, ic, pill, openDrawer, closeDrawer, toast, go, refresh, render, paintIcons } = A;
const sb = window.supabase.createClient(EM_CONFIG.supabaseUrl, EM_CONFIG.supabasePublishableKey, { auth: { persistSession: true, detectSessionInUrl: true, storageKey: 'edilmen-gestionale' } });

let sessione = null, profilo = null, pronto = false, sceltaPassword = false;
let lead = [], aziende = [], segnalazioni = [], vocaliOggi = 0, caricato = false, filtro = 'tutte', timer = null;

const STATI = { nuova: ['Nuova', 'blue'], contattata: ['Contattata', 'violet'], appuntamento: ['Appuntamento', 'amber'], preventivo: ['Preventivo inviato', 'orange'],
  aggiudicata: ['Aggiudicata', 'green'], persa: ['Persa', 'gray'], chiusa: ['Chiusa', 'gray'] };
const REG = { pie: 'Piemonte', vda: "Valle d'Aosta", lom: 'Lombardia', taa: 'Trentino-Alto Adige', ven: 'Veneto', fvg: 'Friuli-Venezia Giulia', lig: 'Liguria',
  emr: 'Emilia-Romagna', tos: 'Toscana', umb: 'Umbria', mar: 'Marche', laz: 'Lazio', abr: 'Abruzzo', mol: 'Molise', cam: 'Campania', pug: 'Puglia',
  bas: 'Basilicata', cal: 'Calabria', sic: 'Sicilia', sar: 'Sardegna' };
const STATI_AZ = { verifica: ['Da verificare', 'amber'], attiva: ['Attiva', 'green'], sospesa: ['Rifiutata o sospesa', 'gray'] };
const ATTIVITA = { '1.1': 'Nuove costruzioni', '1.2': 'Ristrutturazioni', '1.3': 'Efficienza energetica', '2.1': 'Fotovoltaico', '2.2': 'Solare termico', '3.1': 'Domotica', '3.2': 'Sicurezza', '3.3': 'Robotica', '4.1': 'Pulizie' };
const STATI_SCHEDA = { non_rivendicata: ['Non rivendicata', 'gray'], in_verifica: ['Rivendicazione da approvare', 'amber'], rivendicata: ['Confermata dall\'impresa', 'green'] };
const STATI_ABB = { proposto: ['Proposta', 'blue'], inviato: ['Inoltrata', 'violet'], accettato: ['Accettata', 'green'], rifiutato: ['Rifiutata', 'gray'],
  sopralluogo_fatto: ['Sopralluogo fatto', 'green'], sopralluogo_mancato: ['Sopralluogo mancato', 'orange'], aggiudicato: ['Aggiudicata', 'green'], perso: ['Persa', 'gray'] };
const DOCUMENTI = { visura: 'Visura camerale', durc: 'DURC', assicurazione_rc: 'Assicurazione RC', patente_crediti: 'Patente a crediti', soa: 'Attestazione SOA', iso_9001: 'ISO 9001', altro: 'Altro' };
const VOTI = { qualita: 'Qualità del lavoro', puntualita: 'Puntualità', rispetto_preventivo: 'Rispetto del preventivo', pulizia: 'Pulizia del cantiere', comunicazione: 'Comunicazione' };
const daVerificare = a => a.stato === 'verifica' && (a.origine !== 'catalogo' || !a.pubblicata) || a.stato_scheda === 'in_verifica';
let filtroAz = { regione: '', stato: 'verifica', q: '' };
const CONSENSI = { privacy: 'Privacy', condivisione_imprese: 'Condivisione con le imprese', marketing: 'Marketing' };
const euro = n => n == null ? '' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const quando = iso => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const durata = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';

/* ---------- accesso ---------- */
// a pagine da 1000 (limite del database per singola lettura)
async function tutteLeAziende() {
  const out = [];
  for (let da = 0; da < 20000; da += 1000) {
    const { data, error } = await sb.from('aziende').select('*')
      .or('origine.eq.iscrizione,stato_scheda.neq.non_rivendicata,stato.eq.attiva,and(origine.eq.catalogo,stato.eq.verifica)')
      .order('nome', { ascending: true }).range(da, da + 999);
    if (error) { console.error(error); break; }
    out.push(...data); if (data.length < 1000) break;
  }
  return { data: out };
}

// Il modulo di accesso si affianca alla scelta dei profili dimostrativi, senza cancellarla
function boxAccesso(html) {
  $('#shell').hidden = true; $('#login').hidden = false;
  const orig = $('#login > .login-box:not(.gs-login)'); if (orig) orig.hidden = true;
  let box = $('#login > .gs-login');
  if (!box) { box = document.createElement('div'); box.className = 'login-box gs-login'; $('#login').appendChild(box); }
  box.innerHTML = `<div class="login-head"><img src="img/mascotte.jpg" alt=""><div>${html}</div></div>`;
  paintIcons(box);
}
addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/admin')) return;
  $('#login > .gs-login')?.remove();
  const orig = $('#login > .login-box'); if (orig) orig.hidden = false;
});
function formAccesso(msg) {
  boxAccesso(`<h1>Amministrazione EdilMen</h1><p class="sub">Entra con la tua email e la tua password.</p>
    <form id="gs-form" class="gs-form" novalidate>
      <label class="fld"><span>Email</span><input class="inp" type="email" id="gs-mail" autocomplete="username" required></label>
      <label class="fld"><span>Password</span><input class="inp" type="password" id="gs-pw" autocomplete="current-password" required></label>
      <p class="gs-msg" id="gs-msg" role="alert" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
      <button class="btn btn-blue" type="submit">Entra</button>
      <button class="btn btn-ghost" type="button" id="gs-reset">Password dimenticata?</button>
      <a class="link gs-demo" href="#/demo">Profili dimostrativi (azienda e cliente)</a>
    </form>`);
  const m = t => { const e = $('#gs-msg'); e.textContent = t; e.hidden = false; };
  $('#gs-mail').focus();
  $('#gs-form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $('#gs-mail').value.trim(), password: $('#gs-pw').value });
    if (error) return m('Email o password non corrette.');
    await caricaProfilo();
    if (!profilo || profilo.ruolo !== 'admin') { await sb.auth.signOut(); return m('Questo account non ha accesso all\'amministrazione.'); }
    go('#/admin/sito');
  };
  $('#gs-reset').onclick = async () => {
    const email = $('#gs-mail').value.trim();
    if (!email) return m('Scrivi prima la tua email, poi premi di nuovo.');
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    m('Se l\'email è registrata, ti arriva un link per scegliere una nuova password.');
  };
}
function formNuovaPassword() {
  boxAccesso(`<h1>Scegli la tua password</h1><p class="sub">Almeno 10 caratteri. La userai per entrare nell'amministrazione.</p>
    <form id="gs-form" class="gs-form" novalidate>
      <label class="fld"><span>Nuova password</span><input class="inp" type="password" id="gs-pw" autocomplete="new-password" minlength="10" required></label>
      <label class="fld"><span>Ripeti la password</span><input class="inp" type="password" id="gs-pw2" autocomplete="new-password" required></label>
      <p class="gs-msg" id="gs-msg" role="alert" hidden></p>
      <button class="btn btn-blue" type="submit">Salva e entra</button>
    </form>`);
  $('#gs-pw').focus();
  $('#gs-form').onsubmit = async e => {
    e.preventDefault();
    const a = $('#gs-pw').value, b = $('#gs-pw2').value, m = t => { const x = $('#gs-msg'); x.textContent = t; x.hidden = false; };
    if (a.length < 10) return m('La password deve avere almeno 10 caratteri.');
    if (a !== b) return m('Le due password non coincidono.');
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return m('Non sono riuscito a salvare la password: ' + error.message);
    sceltaPassword = false; toast('Password salvata');
    await caricaProfilo(); go('#/admin/sito');
  };
}

async function caricaProfilo() {
  const { data: { session } } = await sb.auth.getSession();
  sessione = session;
  profilo = null;
  if (!session) return;
  const { data } = await sb.from('profili').select('nome,ruolo').eq('id', session.user.id).maybeSingle();
  profilo = data;
}

async function esci() {
  await sb.auth.signOut(); sessione = null; profilo = null; lead = []; caricato = false;
  location.hash = '#/admin';
}

/* ---------- dati ---------- */
async function carica() {
  const [{ data, error }, oggi, az] = await Promise.all([
    sb.from('lead').select('*, vocali(*), consensi(accettato, registrato_il, testi_consenso(tipo, versione)), abbinamenti(id, azienda_id, posizione, punteggio, motivi, stato, inviato_il, aziende(nome, slug, piano))')
      .order('priorita', { ascending: true }).order('creato_il', { ascending: false }).limit(300),
    sb.from('vocali_oggi').select('ricevuti').maybeSingle(),
    // qui le aziende con cui c'è un rapporto (iscritte, rivendicate o attive) e quelle importate dai registri ancora da verificare
    tutteLeAziende(),
  ]);
  const sg = await sb.from('segnalazioni').select('*, aziende(nome, slug)').order('creata_il', { ascending: false }).limit(200);
  segnalazioni = sg.data || [];
  if (error) { toast('Non riesco a leggere le richieste'); console.error(error); return false; }
  lead = data || []; aziende = (az && az.data) || []; vocaliOggi = (oggi.data && oggi.data.ricevuti) || 0; caricato = true;
  return true;
}

/* ---------- pagina: richieste dal sito ---------- */
function riga(l) {
  const v = l.vocali && l.vocali[0];
  const lavoro = l.tipo === 'vocale' ? `Vocale ${v && v.durata_s ? durata(v.durata_s) : ''}${v && v.testo ? '<br><small class="muted">' + esc(v.testo.slice(0, 70)) + '</small>' : ''}`
    : l.lavoro && l.lavoro.non_sa_cosa_fare ? '<span class="muted">Non sa ancora cosa serve</span>' : esc((l.lavoro && l.lavoro.pacchetto) || '');
  const valore = l.quotazione && l.quotazione.offerta ? euro(l.quotazione.offerta) + (l.impresa_scelta ? `<br><small class="muted">${esc(l.impresa_scelta)}</small>` : '') : '<span class="muted">da quotare</span>';
  return `<tr class="clickable" data-gs="${l.id}"><td><b>${esc(l.codice)}</b>${l.tipo === 'vocale' ? ' <span class="pill orange">Vocale</span>' : ''}<br><small class="muted">${quando(l.creato_il)}</small></td>
    <td>${esc([l.nome, l.cognome].filter(Boolean).join(' ') || 'Senza nome')}<br><small class="muted">${l.canale_contatto === 'email' ? 'Email ' + esc(l.email || '') : (l.canale_contatto === 'whatsapp' ? 'WhatsApp ' : 'Telefono ') + esc(l.telefono || '')}</small></td>
    <td>${lavoro}</td><td>${esc(l.comune || '')}<br><small class="muted">${esc(REG[l.regione] || '')}</small></td><td class="num">${valore}</td><td>${pill(l.stato, STATI)}</td></tr>`;
}

async function pagina(el) {
  if (location.hash.endsWith('/aziende')) filtro = 'aziende';   // link diretto all'elenco delle aziende
  el.innerHTML = `<div class="ph"><div><h1>Richieste dal sito</h1><p>Quotazioni, vocali e aziende che vogliono entrare nella rete, arrivati davvero dal sito. I vocali sono in cima: il cliente aspetta una risposta in giornata.</p></div>
    <div class="gs-azioni"><button class="btn btn-ghost" id="gs-aggiorna">Aggiorna</button><button class="btn btn-ghost" id="gs-esci">${ic('logout')}Esci</button></div></div>
    <div id="gs-corpo"><div class="card"><div class="card-b muted">Carico le richieste...</div></div></div>`;
  $('#gs-esci').onclick = esci;
  $('#gs-aggiorna').onclick = async () => { await carica(); disegnaElenco(); toast('Richieste aggiornate'); };
  if (!caricato) await carica();
  disegnaElenco();
  clearInterval(timer);
  timer = setInterval(async () => { if (location.hash.startsWith('#/admin/sito') && !document.hidden) { await carica(); disegnaElenco(); } else clearInterval(timer); }, 60000);
}

function disegnaElenco() {
  const box = $('#gs-corpo'); if (!box) return;
  const nuoveVocali = lead.filter(l => l.tipo === 'vocale' && l.stato === 'nuova').length;
  const tabs = [['tutte', 'Tutte', lead.length], ['vocale', 'Vocali', lead.filter(l => l.tipo === 'vocale').length], ['procedura', 'Quotazioni', lead.filter(l => l.tipo !== 'vocale').length],
    ...Object.entries(STATI).map(([k, v]) => [k, v[0], lead.filter(l => l.stato === k).length]), ['aziende', 'Aziende', aziende.filter(daVerificare).length], ['segnalazioni', 'Segnalazioni', segnalazioni.filter(x => x.stato === 'aperta').length]];
  const lista = lead.filter(l => filtro === 'tutte' || l.tipo === filtro || (filtro === 'procedura' && l.tipo === 'stima') || l.stato === filtro);
  box.innerHTML = `<div class="kpis"><div class="kpi"><span class="ico">${ic('video')}</span><div><b class="num">${vocaliOggi}</b><span>Vocali ricevuti oggi</span></div></div>
      <div class="kpi"><span class="ico">${ic('clock')}</span><div><b class="num">${nuoveVocali}</b><span>Vocali da richiamare</span></div></div>
      <div class="kpi"><span class="ico">${ic('doc')}</span><div><b class="num">${lead.filter(l => l.stato === 'nuova').length}</b><span>Richieste nuove</span></div></div>
      <div class="kpi"><span class="ico">${ic('users')}</span><div><b class="num">${aziende.filter(daVerificare).length}</b><span>Aziende da verificare</span></div></div></div>
    <div class="card" style="margin-top:18px"><div class="tabs" style="padding:0 10px">${tabs.map(([k, l, n]) => `<button class="${k === filtro ? 'on' : ''}" data-gtab="${k}">${l}<span class="c">${n}</span></button>`).join('')}</div>
    <div class="tw"><table class="t"><thead><tr><th>Richiesta</th><th>Cliente</th><th>Lavoro</th><th>Zona</th><th>Valore</th><th>Stato</th></tr></thead><tbody>
    ${lista.map(riga).join('') || `<tr><td colspan="6" class="muted" style="padding:24px">${lead.length ? 'Nessuna richiesta in questo filtro.' : 'Nessuna richiesta arrivata dal sito, per ora.'}</td></tr>`}
    </tbody></table></div></div>`;
  paintIcons(box);
  $$('[data-gtab]', box).forEach(b => b.onclick = () => { filtro = b.dataset.gtab; disegnaElenco(); });
  $$('[data-gs]', box).forEach(tr => tr.onclick = () => dettaglio(tr.dataset.gs));
  if (filtro === 'aziende') elencoAziende();
  if (filtro === 'segnalazioni') elencoSegnalazioni();
}

/* ---------- segnalazioni di errori sulle schede pubbliche ---------- */
function elencoSegnalazioni() {
  const tw = $('#gs-corpo .tw'); if (!tw) return;
  tw.innerHTML = `<table class="t"><thead><tr><th>Quando</th><th>Impresa</th><th>Segnalazione</th><th>Email</th><th>Stato</th><th></th></tr></thead><tbody>
    ${segnalazioni.map(x => `<tr><td><small class="muted">${quando(x.creata_il)}</small></td>
      <td>${x.aziende ? `<a class="link" href="/imprese/${esc(x.aziende.slug)}" target="_blank" rel="noopener">${esc(x.aziende.nome)}</a>` : ''}</td>
      <td style="white-space:pre-line">${esc(x.testo)}</td><td>${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : '<span class="muted">nessuna</span>'}</td>
      <td>${pill(x.stato, { aperta: ['Aperta', 'amber'], corretta: ['Corretta', 'green'], respinta: ['Respinta', 'gray'] })}</td>
      <td>${x.stato === 'aperta' ? `<button class="btn btn-ghost" data-sg="${x.id}" data-v="corretta">Corretta</button> <button class="btn btn-ghost" data-sg="${x.id}" data-v="respinta">Respingi</button>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="6" class="muted" style="padding:24px">Nessuna segnalazione.</td></tr>'}</tbody></table>`;
  $$('[data-sg]', tw).forEach(b => b.onclick = async () => {
    const { error } = await sb.from('segnalazioni').update({ stato: b.dataset.v }).eq('id', b.dataset.sg);
    if (error) return toast('Non sono riuscito a salvare');
    segnalazioni.find(x => x.id === b.dataset.sg).stato = b.dataset.v; toast('Segnalazione aggiornata'); disegnaElenco();
  });
}

/* ---------- aziende che vogliono entrare nella rete ---------- */
function elencoAziende() {
  const tw = $('#gs-corpo .tw'); if (!tw) return;
  const F = filtroAz;
  const regioni = [...new Set(aziende.map(a => a.regione).filter(Boolean))].sort((x, y) => (REG[x] || x).localeCompare(REG[y] || y));
  const perStato = a => F.stato === 'verifica' ? daVerificare(a) : F.stato === 'attiva' ? a.stato === 'attiva' : F.stato === 'pubblicate' ? a.pubblicata : F.stato === 'sospesa' ? a.stato === 'sospesa' : true;
  const testo = F.q.trim().toLowerCase();
  const lista = aziende.filter(a => (!F.regione || a.regione === F.regione) && perStato(a)
    && (!testo || [a.nome, a.piva, a.comune, a.provincia].join(' ').toLowerCase().includes(testo)))
    .sort((a, b) => (daVerificare(a) ? 0 : 1) - (daVerificare(b) ? 0 : 1) || String(a.nome).localeCompare(b.nome));
  const conta = r => aziende.filter(a => (!r || a.regione === r) && perStato(a)).length;
  const MOSTRA = 300;
  tw.innerHTML = `<div class="filters" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <label class="fld"><span>Regione</span><select class="sel" id="az-reg"><option value="">Tutte le regioni (${conta('')})</option>${regioni.map(r => `<option value="${r}" ${F.regione === r ? 'selected' : ''}>${esc(REG[r] || r)} (${conta(r)})</option>`).join('')}</select></label>
      <label class="fld"><span>Stato</span><select class="sel" id="az-st">${[['verifica', 'Da verificare'], ['pubblicate', 'Pubblicate sul sito'], ['attiva', 'Nella rete EdilMen'], ['sospesa', 'Rifiutate o sospese'], ['', 'Tutte']].map(([k, l]) => `<option value="${k}" ${F.stato === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld" style="flex:1;min-width:180px"><span>Cerca</span><input class="inp" id="az-q" value="${esc(F.q)}" placeholder="Nome, partita IVA, comune o provincia"></label>
      <span class="muted" style="padding-bottom:10px">${lista.length} aziende${lista.length > MOSTRA ? `, mostrate le prime ${MOSTRA}: usa i filtri` : ''}</span>
      <button class="btn btn-blue" id="az-auto" style="margin-left:auto">Pubblica le verificate${F.regione ? ' (' + esc(REG[F.regione] || F.regione) + ')' : ''}</button></div>
    <table class="t"><thead><tr><th>Azienda</th><th>Sede</th><th>Attività</th><th>Contatti</th><th>Origine</th><th>Stato</th></tr></thead><tbody>
    ${lista.slice(0, MOSTRA).map(a => `<tr class="clickable" data-az="${a.id}"><td><b>${esc(a.nome)}</b><br><small class="muted">P. IVA ${esc(a.piva || '')}</small></td>
      <td>${esc([a.comune, a.provincia].filter(Boolean).join(' ') || '')}<br><small class="muted">${esc(REG[a.regione] || '')}</small></td><td>${esc((a.categorie || []).map(c => ATTIVITA[c] || c).join(', '))}</td>
      <td>${esc(a.email || '')}<br><small class="muted">${esc(a.telefono || '')}</small></td><td>${a.origine === 'catalogo' ? 'Registro pubblico' : 'Iscrizione o rete'}<br><small class="muted">${a.pubblicata ? 'Pubblicata' : 'Non pubblicata'}</small></td><td>${pill(a.stato, STATI_AZ)}<br>${pill(a.stato_scheda, STATI_SCHEDA)}</td></tr>`).join('')
      || '<tr><td colspan="6" class="muted" style="padding:24px">Nessuna azienda con questi filtri.</td></tr>'}</tbody></table>`;
  $('#az-reg', tw).onchange = e => { F.regione = e.target.value; elencoAziende(); };
  $('#az-st', tw).onchange = e => { F.stato = e.target.value; elencoAziende(); };
  let t0; $('#az-q', tw).oninput = e => { clearTimeout(t0); t0 = setTimeout(() => { F.q = e.target.value; elencoAziende(); const i = $('#az-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  $$('[data-az]', tw).forEach(tr => tr.onclick = () => dettaglioAzienda(tr.dataset.az));
  $('#az-auto', tw).onclick = pubblicaVerificate;
}

/* ---------- verifica automatica: pubblica in blocco le schede dei registri che passano i controlli ---------- */
// Controlli (tutti obbligatori): partita IVA attiva nel VIES, attestazione SOA valida e non scaduta, comune della sede noto,
// nessun avviso nelle note (es. partita IVA cessata). La white list antimafia è un segnale in più, non obbligatorio.
async function verificheCatalogo() {
  const out = [];
  for (let da = 0; da < 50000; da += 1000) {
    const { data, error } = await sb.from('verifiche_azienda').select('azienda_id,tipo,esito,scadenza,note').in('tipo', ['soa', 'altro']).range(da, da + 999);
    if (error) { console.error(error); break; }
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}
async function pubblicaVerificate() {
  const b = $('#az-auto'); b.disabled = true; b.textContent = 'Controllo le verifiche...';
  const ver = await verificheCatalogo(), oggi = new Date().toISOString().slice(0, 10);
  const per = {}; ver.forEach(v => (per[v.azienda_id] = per[v.azienda_id] || []).push(v));
  const ok = (id, f) => (per[id] || []).some(f);
  const candidate = aziende.filter(a => a.origine === 'catalogo' && a.stato === 'verifica' && !a.pubblicata && (!filtroAz.regione || a.regione === filtroAz.regione));
  const esito = candidate.map(a => {
    const manca = [];
    if (!ok(a.id, v => v.tipo === 'altro' && v.esito === 'valido' && /VIES/.test(v.note || ''))) manca.push('partita IVA attiva (VIES)');
    if (!ok(a.id, v => v.tipo === 'soa' && v.esito === 'valido' && (!v.scadenza || v.scadenza >= oggi))) manca.push('SOA valida');
    if (!a.comune) manca.push('comune');
    if (/ATTENZIONE/.test(a.note || '')) manca.push('avviso nelle note');
    return { a, manca, wl: ok(a.id, v => /white list/i.test(v.note || '')) };
  });
  const pronte = esito.filter(x => !x.manca.length), conta = k => esito.filter(x => x.manca.includes(k)).length;
  b.disabled = false; b.textContent = 'Pubblica le verificate';
  openDrawer(`<div class="dr-h"><div><h2>Pubblica le verificate</h2><small class="muted">${esc(filtroAz.regione ? REG[filtroAz.regione] : 'Tutte le regioni')}, schede dei registri non ancora pubblicate</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b"><div class="kpis"><div class="kpi"><div><b class="num">${pronte.length}</b><span>Passano tutti i controlli</span></div></div><div class="kpi"><div><b class="num">${pronte.filter(x => x.wl).length}</b><span>Di cui nella white list antimafia</span></div></div></div>
    <p style="margin-top:14px">Controlli automatici: partita IVA attiva nel VIES, attestazione SOA valida, comune della sede noto, nessun avviso nelle note.</p>
    <p class="muted" style="margin-top:8px">Restano da controllare a mano ${esito.length - pronte.length} schede: ${conta('partita IVA attiva (VIES)')} senza VIES valido, ${conta('SOA valida')} con SOA scaduta, ${conta('comune')} senza comune, ${conta('avviso nelle note')} con un avviso.</p>
    <p class="muted" style="margin-top:8px">Le schede pubblicate compaiono su /imprese come "Profilo non ancora verificato dall'azienda", senza contatti. Si possono togliere una per una.</p></div>
  <div class="dr-f"><button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-blue" id="pv-vai" ${pronte.length ? '' : 'disabled'}>Pubblica ${pronte.length} schede</button></div>`, d => {
    $('#pv-vai', d).onclick = async () => {
      const go = $('#pv-vai', d); go.disabled = true;
      const ids = pronte.map(x => x.a.id);
      for (let i = 0; i < ids.length; i += 200) {
        go.textContent = `Pubblico... ${Math.min(i + 200, ids.length)} di ${ids.length}`;
        const { error } = await sb.from('aziende').update({ pubblicata: true }).in('id', ids.slice(i, i + 200));
        if (error) { console.error(error); toast('Interrotto: ' + (error.message || 'errore')); break; }
        ids.slice(i, i + 200).forEach(id => { const a = aziende.find(x => x.id === id); if (a) a.pubblicata = true; });
      }
      closeDrawer(); toast(`Pubblicate ${pronte.length} schede`); disegnaElenco();
    };
  });
}

async function dettaglioAzienda(id) {
  const a = aziende.find(x => x.id === id); if (!a) return;
  const dd = (k, v) => v ? `<dt>${esc(k)}</dt><dd>${v}</dd>` : '';
  const r = a.rating_dettaglio, comp = r && r.componenti;
  openDrawer(`<div class="dr-h"><div><h2>${esc(a.nome)}</h2><small class="muted">${a.origine === 'catalogo' ? 'Dal catalogo pubblico' : 'Iscritta dal sito il ' + quando(a.creato_il)}</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b">
  <p>${pill(a.stato, STATI_AZ)} ${pill(a.stato_scheda, STATI_SCHEDA)} ${a.slug ? `<a class="link" href="/imprese/${esc(a.slug)}" target="_blank" rel="noopener">Apri la scheda pubblica</a>` : ''}</p>
  ${a.stato_scheda === 'in_verifica' ? `<div class="sect" style="background:#FFF4E5;border-radius:10px;padding:12px"><b>Rivendicazione da approvare.</b> <span id="az-riv" class="muted">Carico...</span>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-blue" data-riv="approvata">Approva: è l'impresa</button><button class="btn btn-ghost" data-riv="respinta">Respingi</button></div></div>` : ''}
  <dl class="kv" style="margin-top:12px">
    ${dd('Partita IVA', esc(a.piva || ''))}${dd('Sede', esc([a.indirizzo, a.comune, a.provincia, REG[a.regione]].filter(Boolean).join(', ')))}
    ${dd('ATECO', esc(a.ateco || ''))}${dd('Sito', a.sito ? esc(a.sito) : '')}
    ${dd('Email', a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : '')}${dd('Telefono', a.telefono ? `<a href="tel:${esc(a.telefono)}">${esc(a.telefono)}</a>` : '')}
    ${dd('Attività', esc((a.categorie || []).map(c => ATTIVITA[c] || c).join(', ')))}${dd('Province servite', esc((a.province_servite || []).join(', ')))}
    ${dd('Importi accettati', a.importo_min != null || a.importo_max != null ? esc(`${euro(a.importo_min) || '0'} – ${euro(a.importo_max) || 'senza limite'}`) : '')}
    ${dd('Riceve richieste', a.accetta_richieste ? 'Sì' : 'No')}${dd('Piano', esc(a.piano))}
    ${dd('Condizioni di adesione', a.consenso_il ? 'Accettate il ' + quando(a.consenso_il) : '')}
    ${dd('Fonte', esc(Object.values(a.utm || {}).join(' / ') || ''))}
  </dl>
  <div class="sect"><h4>Rating</h4>${r ? `<p>${r.valore != null ? `<b class="num" style="font-size:1.3rem">${String(r.valore).replace('.', ',')}</b> su 5` : 'In costruzione: mancano ' + esc((r.mancano || []).join(', '))}</p>
    <p class="muted" style="margin-top:4px">Recensioni ${comp.recensioni.n} (media ${comp.recensioni.media ?? '-'}), documenti ${comp.documenti.verificati.length}/4, comportamento ${comp.operativo.punteggio ?? 'non ancora misurabile'}. Calcolato ${quando(a.rating_aggiornato_il)}.</p>`
    : '<p class="muted">Ancora nessun dato: si calcola quando si apre la scheda pubblica, se ci sono verifiche, recensioni o richieste.</p>'}</div>
  <div class="sect"><h4>Documenti verificati</h4><div id="az-doc" class="muted">Carico...</div>
    <div class="grid2b" style="gap:8px;margin-top:10px">
      <label class="fld"><span>Documento</span><select class="sel" id="doc-tipo">${Object.entries(DOCUMENTI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="fld"><span>Esito</span><select class="sel" id="doc-esito"><option value="valido">Valido</option><option value="scaduto">Scaduto</option><option value="non_presente">Non presente</option></select></label>
      <label class="fld"><span>Scadenza</span><input class="inp" type="date" id="doc-scad"></label>
      <label class="fld"><span>Note</span><input class="inp" id="doc-note"></label>
    </div><button class="btn btn-ghost" id="doc-add" style="margin-top:8px">Registra la verifica</button></div>
  <label class="fld" style="margin-top:14px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="az-pub" ${a.pubblicata ? 'checked' : ''}> <span>Scheda pubblicata sul sito</span></label>
  <label class="fld" style="margin-top:14px"><span>Note interne (documenti controllati, referenze...)</span><textarea class="inp" id="az-note" rows="3">${esc(a.note || '')}</textarea></label>
  </div>
  <div class="dr-f"><button class="btn btn-ghost" data-az-stato="sospesa">Rifiuta o sospendi</button><button class="btn btn-ghost" data-az-stato="">Salva</button>${a.origine === 'catalogo' && a.stato !== 'attiva' ? '<button class="btn btn-ghost" data-az-stato="pubblica">Pubblica la scheda</button>' : ''}<button class="btn btn-blue" data-az-stato="attiva">Attiva nella rete</button></div>`, async d => {
    $$('[data-az-stato]', d).forEach(b => b.onclick = async () => {
      const agg = { note: $('#az-note', d).value.trim() || null, pubblicata: $('#az-pub', d).checked };
      // impresa dal registro pubblico: verificata, la scheda va online (non diventa "della rete")
      if (b.dataset.azStato === 'pubblica') agg.pubblicata = true;
      else if (b.dataset.azStato) agg.stato = b.dataset.azStato;
      if (agg.stato === 'sospesa') agg.pubblicata = false;
      // attivare un'azienda iscritta dal sito vuol dire averla verificata: la scheda diventa confermata e pubblica
      if (agg.stato === 'attiva' && a.origine === 'iscrizione' && a.stato_scheda !== 'rivendicata') Object.assign(agg, { stato_scheda: 'rivendicata', rivendicata_il: new Date().toISOString(), pubblicata: true });
      const { error } = await sb.from('aziende').update(agg).eq('id', a.id);
      if (error) return toast('Non sono riuscito a salvare');
      Object.assign(a, agg); closeDrawer(); toast(agg.stato === 'attiva' ? 'Azienda attivata' : agg.stato ? 'Azienda rifiutata o sospesa' : b.dataset.azStato === 'pubblica' ? 'Scheda pubblicata' : 'Salvato'); disegnaElenco();
    });
    // rivendicazione in attesa
    if (a.stato_scheda === 'in_verifica') {
      const { data: riv } = await sb.from('rivendicazioni').select('id,email,verificata_il').eq('azienda_id', a.id).eq('esito', 'da_approvare').order('creata_il', { ascending: false }).limit(1);
      const x = riv && riv[0]; const el = $('#az-riv', d);
      if (el) el.textContent = x ? `Email usata: ${x.email}, confermata con il codice il ${quando(x.verificata_il)}. Non è sul dominio del sito dell'impresa: verifica per telefono prima di approvare.` : 'Nessuna richiesta trovata.';
      $$('[data-riv]', d).forEach(b => b.onclick = async () => {
        const ok = b.dataset.riv === 'approvata';
        const agg = ok ? { stato_scheda: 'rivendicata', rivendicata_il: new Date().toISOString() } : { stato_scheda: 'non_rivendicata' };
        const e1 = await sb.from('aziende').update(agg).eq('id', a.id);
        if (x) await sb.from('rivendicazioni').update({ esito: b.dataset.riv }).eq('id', x.id);
        if (e1.error) return toast('Non sono riuscito a salvare');
        Object.assign(a, agg); closeDrawer(); toast(ok ? 'Scheda confermata' : 'Rivendicazione respinta'); disegnaElenco();
      });
    }
    // documenti
    const disegnaDoc = async () => {
      const { data } = await sb.from('verifiche_azienda').select('*').eq('azienda_id', a.id).order('controllato_il', { ascending: false });
      const el = $('#az-doc', d); if (!el) return;
      el.className = ''; el.innerHTML = (data || []).length ? `<table class="t"><tbody>${data.map(v => `<tr><td>${esc(DOCUMENTI[v.tipo] || v.tipo)}</td><td>${pill(v.esito, { valido: ['Valido', 'green'], scaduto: ['Scaduto', 'orange'], non_presente: ['Non presente', 'gray'] })}</td>
        <td class="muted">${v.scadenza ? 'scade ' + esc(v.scadenza) : ''}</td><td class="muted">${quando(v.controllato_il)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nessun documento verificato.</p>';
    };
    disegnaDoc();
    $('#doc-add', d).onclick = async () => {
      const riga = { azienda_id: a.id, tipo: $('#doc-tipo', d).value, esito: $('#doc-esito', d).value, scadenza: $('#doc-scad', d).value || null,
        note: $('#doc-note', d).value.trim() || null, controllato_da: sessione && sessione.user.id };
      const { error } = await sb.from('verifiche_azienda').insert(riga);
      if (error) return toast('Non sono riuscito a registrare la verifica');
      toast('Verifica registrata: il rating si aggiorna alla prossima apertura della scheda'); $('#doc-scad', d).value = ''; $('#doc-note', d).value = ''; disegnaDoc();
    };
  });
}

/* ---------- dettaglio ---------- */
async function linkFile(bucket, percorso) {
  const { data } = await sb.storage.from(bucket).createSignedUrl(percorso, 3600);
  return data && data.signedUrl;
}

async function dettaglio(id) {
  const l = lead.find(x => x.id === id); if (!l) return;
  const v = l.vocali && l.vocali[0], lav = l.lavoro || {}, q = l.quotazione, app = l.appuntamento, utm = l.utm || {};
  const dd = (k, val) => val ? `<dt>${esc(k)}</dt><dd>${val}</dd>` : '';
  const ipotesi = (lav.ipotesi || []).map(i => `<span>${esc(i.id)}: ${esc(String(i.valore ?? ''))}</span>`).join('');
  const consensi = (l.consensi || []).map(c => `<tr><td>${esc(CONSENSI[c.testi_consenso?.tipo] || c.testi_consenso?.tipo)}</td><td>${c.accettato ? '<span class="pill green">Sì</span>' : '<span class="pill gray">No</span>'}</td><td class="muted">${esc(c.testi_consenso?.versione || '')}</td><td class="muted">${quando(c.registrato_il)}</td></tr>`).join('');
  openDrawer(`<div class="dr-h"><div><h2>${esc(l.codice)} ${l.tipo === 'vocale' ? '<span class="pill orange">Vocale</span>' : ''}</h2><small class="muted">Ricevuta ${quando(l.creato_il)}</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b">
    <dl class="kv">
      ${dd('Cliente', esc([l.nome, l.cognome].filter(Boolean).join(' ') || 'Senza nome'))}
      ${dd('Contatto preferito', l.canale_contatto === 'email' ? `Email <a href="mailto:${esc(l.email || '')}">${esc(l.email || '')}</a>`
        : `${l.canale_contatto === 'whatsapp' ? 'WhatsApp' : 'Telefono'} <a href="${l.canale_contatto === 'whatsapp' ? 'https://wa.me/' + esc((l.telefono || '').replace(/\D/g, '').replace(/^(?!39)/, '39')) : 'tel:' + esc(l.telefono || '')}" target="_blank" rel="noopener">${esc(l.telefono || '')}</a>`)}
      ${dd('Email', l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '')}
      ${dd('Zona', esc([l.comune, REG[l.regione], l.indirizzo].filter(Boolean).join(', ')))}
      ${dd('Lavoro', esc(lav.pacchetto || (lav.non_sa_cosa_fare ? 'Non sa ancora cosa serve' : '')))}
      ${dd('Superficie', lav.mq ? esc(lav.mq + ' m²') : '')}
      ${dd('Quotazione vista', q ? `${euro(q.min)} – ${euro(q.max)}, media ${euro(q.media)}<br>Offerta scelta: <b>${euro(q.offerta)}</b> ${esc(l.impresa_scelta || '')}` : '')}
      ${dd('Appuntamento', app ? esc(`${app.modalita === 'sopralluogo' ? 'Sopralluogo' : 'Chiamata'}${app.giorno ? ` il ${app.giorno} alle ${app.ora}` : ', giorno e ora da fissare'}`) : '')}
      ${dd('Fonte', esc([utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean).join(' / ') || (l.referrer ? 'da ' + l.referrer : 'diretta')))}
    </dl>
    ${v ? `<div class="sect"><h4>Vocale ${durata(v.durata_s)}</h4>${v.percorso_file ? '<audio controls preload="none" id="gs-audio" style="width:100%"></audio>' : '<p class="muted">Audio cancellato ' + (v.cancellato_il ? quando(v.cancellato_il) : '') + '.</p>'}
      ${v.testo ? `<p style="margin-top:10px">${esc(v.testo)}</p>` : ''}${v.foto && v.foto.length ? `<div class="gs-foto" id="gs-foto"></div>` : ''}</div>` : ''}
    ${ipotesi ? `<div class="sect"><h4>Risposte "Non lo so ancora" (valori tipici usati)</h4><div class="tagl">${ipotesi}</div></div>` : ''}
    <div class="sect"><h4>Imprese proposte</h4>${(l.abbinamenti || []).length ? `<p class="muted" style="margin-bottom:8px">Scelte in automatico per lavoro, zona, importo e disponibilità. Il cliente le vede come Impresa A, B, C.</p>
      <div class="tw"><table class="t"><tbody>${[...l.abbinamenti].sort((x, y) => x.posizione - y.posizione).map(ab => `<tr><td><b>Impresa ${'ABCDE'[ab.posizione - 1] || ab.posizione}</b><br>
        ${ab.aziende ? `<a class="link" href="/imprese/${esc(ab.aziende.slug)}" target="_blank" rel="noopener">${esc(ab.aziende.nome)}</a> <small class="muted">${esc(ab.aziende.piano)}</small>` : ''}
        <br><small class="muted">${esc((ab.motivi || []).join(', '))}</small></td>
        <td><select class="sel" data-ab="${ab.id}">${Object.entries(STATI_ABB).map(([k, v]) => `<option value="${k}" ${k === ab.stato ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <details style="margin-top:10px"><summary class="link">Registra la recensione del cliente</summary>
        <div class="grid2b" style="gap:8px;margin-top:10px">
          <label class="fld" style="grid-column:1/-1"><span>Impresa</span><select class="sel" id="rc-az">${l.abbinamenti.map(ab => `<option value="${ab.azienda_id}">${esc(ab.aziende ? ab.aziende.nome : ab.azienda_id)}</option>`).join('')}</select></label>
          ${Object.entries(VOTI).map(([k, v]) => `<label class="fld"><span>${v}</span><select class="sel" data-voto="${k}">${[5, 4, 3, 2, 1].map(n => `<option>${n}</option>`).join('')}</select></label>`).join('')}
          <label class="fld" style="grid-column:1/-1"><span>Commento del cliente</span><textarea class="inp" id="rc-testo" rows="2"></textarea></label>
          <label class="fld" style="grid-column:1/-1;display:flex;gap:8px;align-items:center"><input type="checkbox" id="rc-pub"> <span>Lavoro verificato: pubblica la recensione</span></label>
        </div><button class="btn btn-ghost" id="rc-salva" style="margin-top:8px">Salva la recensione</button></details>`
      : '<p class="muted">Nessuna impresa compatibile trovata in automatico (servono imprese attive che ricevono richieste in questa zona).</p>'}</div>
    <div class="sect"><h4>Consensi registrati</h4><div class="tw"><table class="t"><tbody>${consensi || '<tr><td class="muted">Nessun consenso registrato</td></tr>'}</tbody></table></div></div>
    <div class="grid2b" style="gap:12px;margin-top:14px">
      <label class="fld"><span>Stato</span><select class="sel" id="gs-stato">${Object.entries(STATI).map(([k, s]) => `<option value="${k}" ${k === l.stato ? 'selected' : ''}>${s[0]}</option>`).join('')}</select></label>
      <label class="fld" style="grid-column:1/-1"><span>Note interne</span><textarea class="inp" id="gs-note" rows="3">${esc(l.note || '')}</textarea></label>
    </div>
  </div>
  <div class="dr-f"><button class="btn btn-ghost" data-close>Chiudi</button><button class="btn btn-blue" id="gs-salva">Salva</button></div>`, async d => {
    $('#gs-salva', d).onclick = async () => {
      const agg = { stato: $('#gs-stato', d).value, note: $('#gs-note', d).value.trim() || null };
      const { error } = await sb.from('lead').update(agg).eq('id', l.id);
      if (error) return toast('Non sono riuscito a salvare');
      Object.assign(l, agg); closeDrawer(); toast('Richiesta aggiornata'); disegnaElenco();
    };
    $$('[data-ab]', d).forEach(sel => sel.onchange = async () => {
      const ab = l.abbinamenti.find(x => x.id === sel.dataset.ab), agg = { stato: sel.value };
      if (sel.value === 'inviato' && !ab.inviato_il) agg.inviato_il = new Date().toISOString();
      if (ab.stato === 'inviato' && ['accettato', 'rifiutato'].includes(sel.value)) agg.risposta_il = new Date().toISOString(); // tempo di risposta per il rating
      const { error } = await sb.from('abbinamenti').update(agg).eq('id', ab.id);
      if (error) { sel.value = ab.stato; return toast('Non sono riuscito a salvare'); }
      Object.assign(ab, agg); toast('Stato aggiornato');
    });
    const rc = $('#rc-salva', d);
    if (rc) rc.onclick = async () => {
      const riga = { azienda_id: $('#rc-az', d).value, lead_id: l.id, testo: $('#rc-testo', d).value.trim() || null, stato: $('#rc-pub', d).checked ? 'pubblicata' : 'da_controllare' };
      $$('[data-voto]', d).forEach(x => { riga[x.dataset.voto] = +x.value; });
      const { error } = await sb.from('recensioni').upsert(riga, { onConflict: 'azienda_id,lead_id' });
      if (error) return toast('Non sono riuscito a salvare la recensione');
      toast('Recensione salvata: il rating si aggiorna alla prossima apertura della scheda');
    };
    if (v && v.percorso_file) { const u = await linkFile('vocali', v.percorso_file); const a = $('#gs-audio', d); if (a && u) a.src = u; }
    if (v && v.foto && v.foto.length) {
      const box = $('#gs-foto', d);
      const urls = await Promise.all(v.foto.map(p => linkFile('foto', p)));
      if (box) box.innerHTML = urls.filter(Boolean).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto allegata"></a>`).join('');
    }
  });
}

/* ---------- dashboard: riquadro con i dati veri ---------- */
function riquadroDashboard(el) {
  const box = document.createElement('div');
  box.className = 'card gs-dash';
  box.innerHTML = `<div class="card-h"><h2>Dal sito, dati veri</h2><a class="link" href="#/admin/sito">Apri le richieste</a></div><div class="card-b muted">Carico...</div>`;
  const ph = $('.ph', el); ph ? ph.after(box) : el.prepend(box);
  (caricato ? Promise.resolve() : carica()).then(() => {
    const nuove = lead.filter(l => l.stato === 'nuova').length, voc = lead.filter(l => l.tipo === 'vocale' && l.stato === 'nuova').length;
    box.querySelector('.card-b').outerHTML = `<div class="card-b gs-dash-b"><span><b class="num">${vocaliOggi}</b> vocali ricevuti oggi</span><span><b class="num">${voc}</b> vocali da richiamare</span><span><b class="num">${nuove}</b> richieste nuove</span><span><b class="num">${aziende.filter(daVerificare).length}</b> aziende da verificare</span>
      <small class="muted">Il resto di questa pagina mostra ancora dati di esempio.</small></div>`;
  });
}

/* ---------- aggancio all'area riservata ---------- */
A.ROUTES['admin/sito'] = el => { pagina(el); };
const dashboard = A.ROUTES['admin'];
// nella demo (app#/demo) niente riquadro con i dati veri
A.ROUTES['admin'] = el => { dashboard(el); if (!(A.modoDemo && A.modoDemo())) riquadroDashboard(el); };

window.EM_GEST = {
  sb, // client già autenticato, usato anche da js/artigiani.js
  autenticato: () => pronto && !sceltaPassword && !!sessione && !!profilo && profilo.ruolo === 'admin',
  chiediAccesso: () => { if (!pronto) return; sceltaPassword ? formNuovaPassword() : formAccesso(sessione && profilo && profilo.ruolo !== 'admin' ? 'Questo account non ha accesso all\'amministrazione.' : ''); },
  esci,
  utente: () => (sessione && sessione.user.email) || '',
  // nel numerino del menu solo le novità vere (iscrizioni e rivendicazioni), non le migliaia di schede importate dai registri
  nuove: () => lead.filter(l => l.stato === 'nuova').length + aziende.filter(a => daVerificare(a) && a.origine !== 'catalogo').length,
};

// Link dell'invito o del recupero password: si sceglie la password prima di entrare
const hashIniziale = location.hash;
sceltaPassword = /type=(invite|recovery)/.test(hashIniziale);
sb.auth.onAuthStateChange((evento, s) => { sessione = s; if (evento === 'PASSWORD_RECOVERY') { sceltaPassword = true; formNuovaPassword(); } });
caricaProfilo().then(() => {
  pronto = true;
  if (sceltaPassword && sessione) { history.replaceState(null, '', location.pathname + '#/admin'); formNuovaPassword(); return; }
  if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/admin');
  render();
});

/* stile del login e dei dettagli */
const st = document.createElement('style');
st.textContent = `.gs-form{display:grid;gap:12px;margin-top:18px;max-width:380px}.gs-form .fld span{font-weight:600}.gs-msg{background:#FDECE5;color:#B42318;border-radius:10px;padding:10px 12px;font-weight:600}
.gs-demo{margin-top:6px}.gs-azioni{display:flex;gap:8px;flex-wrap:wrap}.gs-foto{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:12px}
.gs-foto img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid var(--line)}.gs-dash{margin:0 0 18px}.gs-dash-b{display:flex;gap:26px;flex-wrap:wrap;align-items:baseline}
.gs-dash-b b{font-size:1.5rem;margin-right:4px}`;
document.head.appendChild(st);
})();
