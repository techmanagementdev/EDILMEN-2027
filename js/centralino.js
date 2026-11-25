/* Centralino EdilMen (centralino.html): la postazione dei centralinisti che chiamano le imprese del catalogo.
   Accesso con email e password (Supabase Auth, ruolo "operatore" o "admin"). L'operatore vede solo la sua coda, tramite le funzioni
   del database in supabase/migrations/0012_centralino.sql: niente accesso a richieste dei clienti o altre tabelle.
   Pensata per il cellulare: un tocco sul numero chiama, un tocco sull'esito lo registra. */
(function () {
'use strict';
const C = window.EM_CONFIG, L = window.EM_LISTINO;
const sb = window.supabase.createClient(C.supabaseUrl, C.supabasePublishableKey, { auth: { persistSession: true, detectSessionInUrl: true } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(v));
const SITO = 'https://www.edilmen.it';
const app = $('#app');
let utente = null, profilo = null, coda = [], oggi = null, param = null, vista = 'coda';

function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }

const STATO = { da_chiamare: 'Da chiamare', richiamare: 'Da richiamare', interessata: 'Interessata' };
const CAT = { '1.1': 'Nuove costruzioni', '1.2': 'Ristrutturazioni', '1.3': 'Efficientamento', '2.1': 'Fotovoltaico', '2.2': 'Impianti' };
const ESITI = [
  ['non_risponde', 'Non risponde', 'no'], ['richiamare', 'Richiamare', 'no'],
  ['interessata', 'Interessata', 'ok'], ['start', 'Aderisce a Start', 'ok'],
  ['pro', 'Vuole il Pro', 'ok'], ['premium', 'Vuole il Premium', 'ok'],
  ['non_interessata', 'Non interessata', 'no'], ['numero_errato', 'Numero sbagliato', 'no'],
  ['non_chiamare', 'Non chiamare più', 'stop'],
];

/* ---------- accesso ---------- */
function formAccesso(msg) {
  app.innerHTML = `<div class="box" style="max-width:420px;margin:30px auto"><h1 style="font-size:1.6rem">Centralino EdilMen</h1>
    <p class="muted" style="margin-top:6px">Entra con la tua email e la tua password.</p>
    <form id="f" style="display:grid;gap:12px;margin-top:16px" novalidate>
      <label class="fld"><span>Email</span><input class="inp" type="email" id="m" autocomplete="username" required></label>
      <label class="fld"><span>Password</span><input class="inp" type="password" id="p" autocomplete="current-password" required></label>
      <p class="msg" id="e" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
      <button class="btn btn-blue">Entra</button><button class="btn btn-ghost" type="button" id="r">Password dimenticata?</button></form></div>`;
  const err = t => { const e = $('#e'); e.textContent = t; e.hidden = false; };
  $('#f').onsubmit = async ev => {
    ev.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $('#m').value.trim(), password: $('#p').value });
    if (error) return err('Email o password non corrette.');
    avvia();
  };
  $('#r').onclick = async () => {
    const email = $('#m').value.trim(); if (!email) return err('Scrivi prima la tua email.');
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    err('Se l\'email è registrata, ti arriva un link per scegliere una nuova password.');
  };
}
function formPassword() {
  app.innerHTML = `<div class="box" style="max-width:420px;margin:30px auto"><h1 style="font-size:1.6rem">Scegli la tua password</h1>
    <p class="muted" style="margin-top:6px">Almeno 10 caratteri.</p>
    <form id="f" style="display:grid;gap:12px;margin-top:16px" novalidate>
      <label class="fld"><span>Nuova password</span><input class="inp" type="password" id="p" autocomplete="new-password" required></label>
      <label class="fld"><span>Ripeti la password</span><input class="inp" type="password" id="q" autocomplete="new-password" required></label>
      <p class="msg" id="e" hidden></p><button class="btn btn-blue">Salva e entra</button></form></div>`;
  $('#f').onsubmit = async ev => {
    ev.preventDefault();
    const a = $('#p').value, b = $('#q').value, err = t => { const e = $('#e'); e.textContent = t; e.hidden = false; };
    if (a.length < 10) return err('La password deve avere almeno 10 caratteri.');
    if (a !== b) return err('Le due password non coincidono.');
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return err('Non sono riuscito a salvare la password.');
    history.replaceState(null, '', location.pathname); avvia();
  };
}

async function avvia() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return formAccesso();
  utente = session.user;
  const { data } = await sb.from('profili').select('nome,ruolo').eq('id', utente.id).maybeSingle();
  profilo = data;
  if (!profilo || !['operatore', 'admin'].includes(profilo.ruolo)) { await sb.auth.signOut(); return formAccesso('Questo account non ha accesso al centralino.'); }
  $('#chi').textContent = profilo.nome || utente.email; $('#esci').hidden = false;
  const p = await sb.rpc('centralino_parametri'); param = p.data || null;
  await aggiorna();
}
$('#esci').onclick = async () => { await sb.auth.signOut(); location.reload(); };

async function aggiorna() {
  const [c, o] = await Promise.all([sb.rpc('centralino_coda', { n: 20 }), sb.rpc('centralino_oggi')]);
  if (c.error) { app.innerHTML = `<div class="box"><b>Il centralino non è ancora pronto nel database.</b><p class="muted" style="margin-top:6px">Va caricata la migrazione 0012_centralino.sql. Avvisa l'amministrazione.</p></div>`; console.error(c.error); return; }
  coda = c.data || []; oggi = (o.data || [])[0] || null;
  disegna();
}

/* ---------- elenco ---------- */
const cifre = t => String(t || '').replace(/[^\d+]/g, '');
const cellulare = t => /^(\+?39)?3\d{8,9}$/.test(cifre(t).replace(/^\+/, ''));
const quando = iso => iso ? new Date(iso).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

function disegna() {
  const o = oggi || { chiamate: 0, interessate: 0, iscritte: 0, in_coda: coda.length };
  app.innerHTML = `<div class="oggi"><div><b>${o.chiamate}</b><span>Chiamate oggi</span></div><div><b>${o.interessate}</b><span>Interessate oggi</span></div>
      <div><b>${o.iscritte}</b><span>Adesioni oggi</span></div><div><b>${o.in_coda}</b><span>Nella tua coda</span></div></div>
    <div class="tabs" role="group"><button data-v="coda" aria-pressed="${vista === 'coda'}">Da chiamare</button><button data-v="copione" aria-pressed="${vista === 'copione'}">Copione</button><button data-v="sim" aria-pressed="${vista === 'sim'}">Simulatore</button></div>
    <div id="vista"></div>`;
  $$('[data-v]').forEach(b => b.onclick = () => { vista = b.dataset.v; disegna(); });
  const v = $('#vista');
  if (vista === 'copione') { v.innerHTML = copione(); return; }
  if (vista === 'sim') { v.innerHTML = '<div class="box" id="simbox"></div>'; simulatore($('#simbox'), {}); return; }
  v.innerHTML = coda.length ? `<div class="lista">${coda.map((a, i) => `<button class="riga" data-i="${i}"><span class="sp"><b>${esc(a.nome)}</b>
      <small>${esc(a.comune || '')}${a.provincia ? ' (' + esc(a.provincia) + ')' : ''}${a.tentativi ? `, ${a.tentativi} ${a.tentativi === 1 ? 'tentativo' : 'tentativi'}` : ''}${a.richiamare_il ? ', richiamare ' + quando(a.richiamare_il) : ''}</small>
      <span class="tel ${a.telefono ? '' : 'no'}">${a.telefono ? esc(a.telefono) : 'Numero da cercare'}</span></span><span class="pill ${a.stato}">${STATO[a.stato] || a.stato}</span></button>`).join('')}</div>
      <p style="margin-top:14px"><button class="btn btn-ghost" id="altre">Aggiorna la coda</button></p>`
    : `<div class="box"><b>Coda vuota.</b><p class="muted" style="margin-top:6px">Non ci sono imprese da chiamare adesso. Le imprese da richiamare tornano qui all'ora fissata.</p><button class="btn btn-ghost" id="altre" style="margin-top:12px">Aggiorna</button></div>`;
  $$('[data-i]').forEach(b => b.onclick = () => apri(coda[+b.dataset.i]));
  $('#altre').onclick = aggiorna;
}

/* ---------- scheda dell'impresa ---------- */
function messaggio(a) {
  const firma = (profilo && profilo.nome) || 'Il team EdilMen';
  return `Buongiorno, come d'accordo al telefono le mando il link per confermare gratis la scheda di ${a.nome} su EdilMen: ${SITO}/rivendica?piva=${a.piva || ''}\n\nLa scheda di oggi: ${SITO}/imprese/${a.slug}\n\nCon la conferma scegliete lavori e zone e iniziate a ricevere le richieste compatibili. Per qualsiasi dubbio rispondete pure qui.\n\n${firma}, EdilMen`;
}
function apri(a) {
  const d = document.createElement('div'); d.className = 'scheda'; d.setAttribute('role', 'dialog');
  const google = 'https://www.google.com/search?q=' + encodeURIComponent(`${a.nome} ${a.comune || ''} telefono`);
  const cats = (a.categorie || []).map(c => CAT[c]).filter(Boolean).join(', ');
  const domani = new Date(Date.now() + 86400000); domani.setHours(10, 0, 0, 0);
  const locale = x => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  d.innerHTML = `<div class="top"><button class="btn btn-ghost btn-sm" data-chiudi>Indietro</button><h2>${esc(a.nome)}</h2></div>
  <div class="wrap" style="padding-top:12px;padding-bottom:40px">
    <div class="box"><p><b>${esc(a.comune || '')}${a.provincia ? ' (' + esc(a.provincia) + ')' : ''}</b>${cats ? ` · <span class="muted">${esc(cats)}</span>` : ''}</p>
      <p class="small muted" style="margin-top:4px">${a.soa ? 'Attestazione SOA: ' + esc(a.soa) + '. ' : ''}${a.white_list ? 'Iscritta nella white list antimafia della Prefettura. ' : ''}${a.piva ? 'P.IVA ' + esc(a.piva) : ''}</p>
      ${a.ultima_chiamata ? `<p class="small" style="margin-top:6px">Ultima chiamata: ${quando(a.ultima_chiamata)}${a.referente ? ', con ' + esc(a.referente) : ''}${a.note ? '. Nota: ' + esc(a.note) : ''}</p>` : ''}
      <div class="chiama">${a.telefono ? `<a class="btn btn-go" href="tel:${esc(cifre(a.telefono))}">Chiama ${esc(a.telefono)}</a>` : `<a class="btn btn-blue" href="${google}" target="_blank" rel="noopener">Cerca il numero su Google</a>`}
        <a class="btn btn-ghost" href="${SITO}/imprese/${esc(a.slug)}" target="_blank" rel="noopener">Scheda sul sito</a>${a.sito ? `<a class="btn btn-ghost" href="${esc(/^https?:/.test(a.sito) ? a.sito : 'https://' + a.sito)}" target="_blank" rel="noopener">Sito</a>` : ''}</div>
      ${a.telefono ? '' : `<label class="fld" style="margin-top:10px"><span>Numero trovato (fisso o centralino dell'impresa, mai cellulari personali)</span><input class="inp" id="nt" type="tel" inputmode="tel"></label>`}
      <p class="avviso" style="margin-top:10px">Alla prima chiamata di' chi sei e da dove viene il numero (registri pubblici, scheda Google dell'impresa). Se chiedono di non essere richiamati, tocca <b>Non chiamare più</b>.</p></div>

    <div class="box blocco"><h3>Com'è andata?</h3>
      <div class="grid2" style="margin-top:10px"><label class="fld"><span>Con chi hai parlato</span><input class="inp" id="ref" value="${esc(a.referente || '')}" placeholder="es. Mario, titolare"></label>
        <label class="fld"><span>Email per mandare il link</span><input class="inp" id="em" type="email" value="${esc(a.email || '')}"></label></div>
      <label class="fld" style="margin-top:10px"><span>Nota</span><textarea class="inp" id="nota" rows="2" placeholder="es. richiamare dopo le 17, interessati ai bagni">${esc(a.note || '')}</textarea></label>
      <label class="fld" style="margin-top:10px"><span>Quando richiamare (per "Richiamare" e "Interessata")</span><input class="inp" id="quando" type="datetime-local" value="${locale(domani)}"></label>
      <div class="esiti">${ESITI.map(([k, l, c]) => `<button class="btn ${c}" data-esito="${k}">${l}</button>`).join('')}</div></div>

    <div class="box blocco"><h3>Manda il link per confermare la scheda</h3><p class="small muted" style="margin-top:4px">Dopo il sì al telefono: parte dal tuo telefono, con la partita IVA già scritta.</p>
      <div class="chiama">${a.telefono && cellulare(a.telefono) ? `<a class="btn btn-ghost" id="wa" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a class="btn btn-ghost" id="mail">Email</a><button class="btn btn-ghost" id="copia">Copia il messaggio</button></div></div>

    <details class="blocco"><summary>Copione della chiamata</summary>${copione(true, a)}</details>
    <details><summary>Quanto può portargli EdilMen</summary><div id="simbox" style="margin-top:10px"></div></details>
  </div>`;
  document.body.appendChild(d); document.body.style.overflow = 'hidden';
  const chiudi = () => { d.remove(); document.body.style.overflow = ''; };
  $('[data-chiudi]', d).onclick = chiudi;
  simulatore($('#simbox', d), a);
  const testo = () => messaggio(a);
  const wa = $('#wa', d); if (wa) wa.href = `https://wa.me/${cifre(a.telefono).replace(/^\+?(39)?/, '39')}?text=${encodeURIComponent(testo())}`;
  $('#mail', d).onclick = () => { const to = $('#em', d).value.trim(); location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('La scheda di ' + a.nome + ' su EdilMen')}&body=${encodeURIComponent(testo())}`; };
  $('#copia', d).onclick = async () => { try { await navigator.clipboard.writeText(testo()); toast('Messaggio copiato'); } catch (e) { toast('Non riesco a copiare'); } };
  $$('[data-esito]', d).forEach(b => b.onclick = async () => {
    const esito = b.dataset.esito;
    if (esito === 'non_chiamare' && !confirm('Confermi? Questa impresa non verrà più chiamata.')) return;
    const q = $('#quando', d).value;
    const { data, error } = await sb.rpc('centralino_esito', { p_azienda: a.azienda_id, p_esito: esito, p_nota: $('#nota', d).value, p_richiamare: q && ['richiamare', 'interessata'].includes(esito) ? new Date(q).toISOString() : null,
      p_referente: $('#ref', d).value, p_telefono: $('#nt', d) ? $('#nt', d).value : null, p_email: $('#em', d).value });
    if (error) { console.error(error); return toast('Non sono riuscito a salvare: ' + (error.message || 'riprova')); }
    toast('Segnato: ' + b.textContent.toLowerCase()); chiudi(); aggiorna();
    if (data === 'non_risponde') setTimeout(() => toast('5 tentativi senza risposta: tolta dalla coda'), 2700);
  });
}

/* ---------- copione ---------- */
function copione(dentro, a) {
  const p = (param && param.prezzo_mese) || { pro: 240, premium: 400 };
  // i due ganci con i numeri della loro zona (dal simulatore: stima, non garanzia)
  const prov = (a && a.provincia) || 'TN', lav = a ? lavoroTipico(a) : 'R01';
  const s = stima('start', prov, lav), sp = stima('pro', prov, lav), sq = stima('premium', prov, lav);
  const nomeLav = ((L && L.pacchetti.find(x => x.c === lav)) || {}).nome || 'ristrutturazioni';
  const num = s && s.valore ? `circa <b>${Math.round(s.rich)} richieste di preventivo all'anno</b> per lavori come ${esc(nomeLav.toLowerCase())} in provincia di ${esc(prov)}: se ne prendete una su ${Math.round(1 / param.chiusura)} sono <b>${String(Math.round(s.contratti * 10) / 10).replace('.', ',')} lavori</b>, cioè circa <b>${eur(s.fatturato)} di fatturato in più</b>` : 'diverse richieste di preventivo ogni mese per la vostra zona';
  const corpo = `<div class="cop">
    <p class="gancio"><b>I due ganci da usare sempre</b><br>
    1. <b>Quanto possiamo portarvi in più.</b> "Con il piano gratuito stimiamo ${num}. Lo calcoliamo con il nostro listino della vostra provincia."<br>
    2. <b>Vi pubblicizziamo noi.</b> "La vostra impresa è già online su EdilMen, con la sua scheda nell'elenco della provincia di ${esc(prov)}. I clienti li portiamo noi con le guide prezzi per ogni provincia e le campagne su Google: a voi arrivano le richieste di preventivo già spiegate, con un prezzo indicativo che il cliente ha già visto."${sp ? ` Con Pro la scheda va in evidenza e le richieste stimate salgono a circa ${Math.round(sp.rich)} all'anno, con Premium a circa ${Math.round(sq.rich)}.` : ''}<br>
    <span class="small muted">I numeri sono stime${param && param.confermati ? '' : ' con ipotesi ancora da confermare'}: dillo sempre ("è una stima, non una garanzia").</span></p>
    <ol>
    <li><b>Presentati.</b> "Buongiorno, sono ${esc((profilo && profilo.nome) || '...')} di EdilMen, la rete di imprese edili con il rating di Trentino-Alto Adige, Veneto e Friuli. Parlo con il titolare o con chi segue i nuovi lavori?"</li>
    <li><b>Da dove viene il numero (obbligatorio alla prima chiamata).</b> "Il vostro numero l'abbiamo preso da fonti pubbliche, come i registri e la scheda Google dell'impresa. Se preferite non essere più contattati, lo segno subito."</li>
    <li><b>Gancio 1: quanto possiamo portarvi.</b> "Vi chiamo per una cosa concreta: ${num}." Apri "Quanto può portargli EdilMen" se vogliono vedere i conti.</li>
    <li><b>Gancio 2: la pubblicità la facciamo noi.</b> "La vostra scheda è già online: gliela mando adesso così la vede. Noi facciamo la pubblicità, voi ricevete solo le richieste di preventivo della vostra zona e del vostro lavoro, e scegliete quali accettare."</li>
    <li><b>Proponi Start, gratis.</b> "Si parte gratis: confermate la scheda, scegliete lavori e zone e ricevete fino a 5 richieste al mese. Nessun costo fisso e nessun vincolo: solo se un lavoro va in porto riconoscete a EdilMen una piccola percentuale."</li>
    <li><b>Chiudi.</b> "Le mando adesso il link per confermare la scheda: ci vogliono 5 minuti e la partita IVA." Poi tocca WhatsApp o Email.</li>
    <li><b>Dopo, quando sono già in Start:</b> torna sui due ganci con i numeri del piano superiore: <b>Pro</b> (${eur(p.pro)} al mese: in evidenza nell'elenco, 6 foto, descrizione completa) o <b>Premium</b> (${eur(p.premium)} al mese: in cima all'elenco, "Consigliata da EdilMen", in home, 20 foto e video). "Più siete visibili, più richieste vi giriamo."</li></ol>
    <p style="margin-top:10px"><b>Obiezioni frequenti</b></p><ul>
    <li><b>"Abbiamo già troppo lavoro."</b> "Allora scegliete voi quali richieste accettare: Start non obbliga a niente, e intanto la vostra scheda resta pubblicizzata e confermata, con il rating che vi rende più credibili."</li>
    <li><b>"Quanto costa?"</b> "Start è gratis. Pagate solo una percentuale sui lavori che prendete grazie a noi: la pubblicità la paghiamo noi."</li>
    <li><b>"Non mi fido dei portali, le richieste sono sempre a vuoto."</b> "Da noi il cliente ha già visto un prezzo realistico del listino della sua zona prima di chiedere il preventivo, e il sopralluogo lo fissa EdilMen."</li>
    <li><b>"Mandatemi una mail."</b> "Certo, gliela mando adesso con il link e la vostra scheda." Poi segna "Interessata" e fissa quando richiamare.</li>
    <li><b>"Chi siete?"</b> "EdilMen è una business unit di European Management Institute di Trento. Trova tutto su edilmen.it."</li>
    <li><b>"Come fate il rating?"</b> "Con le recensioni dei clienti dei lavori fatti tramite EdilMen e con i documenti verificati: visura, DURC, assicurazione. Il metodo è pubblico su edilmen.it/rating."</li></ul></div>`;
  return dentro ? corpo : `<div class="box">${corpo}</div>`;
}

/* ---------- simulatore: quanto può portare EdilMen all'impresa ---------- */
const LAVORI = ['R01', 'R03', 'R04', 'R05', 'R06', 'R07', 'R10', 'R13', 'R16', 'R17', 'R31', 'N01'];
const PROV = ['TN', 'BZ', 'VR', 'VI', 'PD', 'TV', 'VE', 'BL', 'RO', 'UD', 'PN', 'GO', 'TS'];
function lavoroTipico(a) {
  const n = a.nome || '', c = a.categorie || [];
  const r = [[/idraul|termoidraul/i, 'R03'], [/elettric/i, 'R07'], [/infiss|serrament|finestr/i, 'R10'], [/fotovolt|solar/i, 'R31'], [/cappott|isolament/i, 'R16'],
    [/tett|copertur|lattoner/i, 'R17'], [/imbianc|pittor|tinteg/i, 'R06'], [/piastrell|pavim/i, 'R05']].find(([re]) => re.test(n));
  if (r) return r[1];
  if (c.includes('2.1')) return 'R31';
  if (c.includes('1.3') && !c.includes('1.2')) return 'R16';
  if (c.includes('1.1') && !c.includes('1.2')) return 'N01';
  return 'R01';
}
function valoreLavoro(cod, prov) {
  const p = L && L.pacchetti.find(x => x.c === cod); if (!p) return 0;
  const t = L.parametri.territorio, k = t[prov] ?? (['UD', 'PN', 'GO', 'TS'].includes(prov) ? t.fvg : 1);
  return p.p[1] * (1 + p.acc) * k * p.qrif;
}
function stima(piano, prov, lav) {
  if (!param) return null;
  const P = param, rich = P.richieste_mese[piano] * 12, contratti = rich * P.chiusura, valore = valoreLavoro(lav, prov);
  const fatturato = contratti * valore, fee = fatturato * P.fee, costo = P.prezzo_mese[piano] * 12;
  return { rich, contratti, valore, fatturato, fee, costo };
}
function simulatore(box, a) {
  if (!param) { box.innerHTML = '<p class="muted">Parametri non disponibili.</p>'; return; }
  const P = param, nomi = Object.fromEntries((L ? L.pacchetti : []).map(p => [p.c, p.nome]));
  box.innerHTML = `<div class="sim">
    ${P.confermati ? '' : '<p class="avviso">Ipotesi EdilMen ancora da confermare: usa questi numeri come esempio e di\' sempre che sono una stima.</p>'}
    <div class="grid2"><label class="fld"><span>Provincia</span><select class="inp" id="s-prov">${PROV.map(s => `<option ${s === (a.provincia || 'TN') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="fld"><span>Lavoro tipico</span><select class="inp" id="s-lav">${LAVORI.map(c => `<option value="${c}" ${c === lavoroTipico(a) ? 'selected' : ''}>${esc(nomi[c] || c)}</option>`).join('')}</select></label></div>
    <label class="fld"><span>Piano</span><select class="inp" id="s-piano"><option value="start">Start (gratis)</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
    <div class="ris" id="s-ris"></div><p class="small muted" id="s-nota"></p></div>`;
  const calcola = () => {
    const prov = $('#s-prov', box).value, lav = $('#s-lav', box).value, piano = $('#s-piano', box).value;
    const { rich, contratti, valore, fatturato, fee, costo } = stima(piano, prov, lav);
    $('#s-ris', box).innerHTML = `<div><b>${Math.round(rich)}</b><span>Richieste in un anno</span></div><div><b>${contratti.toFixed(contratti < 10 ? 1 : 0).replace('.', ',')}</b><span>Lavori presi in un anno</span></div>
      <div><b>${eur(valore)}</b><span>Valore di un lavoro tipico (listino, ${esc(prov)})</span></div><div><b>${eur(fatturato)}</b><span>Fatturato in più in un anno</span></div>
      <div><b>${eur(fee + costo)}</b><span>Costo EdilMen in un anno (${Math.round(P.fee * 100)}% sui lavori${costo ? ' + abbonamento' : ''})</span></div><div><b>${eur(fatturato - fee - costo)}</b><span>Resta all'impresa</span></div>`;
    $('#s-nota', box).textContent = `Stima: ${P.richieste_mese[piano]} richieste al mese con il piano ${piano === 'start' ? 'Start' : piano === 'pro' ? 'Pro' : 'Premium'}, ${Math.round(P.chiusura * 100)}% di lavori presi dopo il sopralluogo, prezzo intermedio del listino EdilMen IVA esclusa. Non è una garanzia.`;
  };
  $$('select', box).forEach(s => s.onchange = calcola); calcola();
}

/* ---------- avvio ---------- */
if (/type=(invite|recovery)/.test(location.hash)) {
  sb.auth.onAuthStateChange((ev, s) => { if (s && (ev === 'SIGNED_IN' || ev === 'PASSWORD_RECOVERY')) formPassword(); });
  setTimeout(async () => { const { data: { session } } = await sb.auth.getSession(); if (session) formPassword(); }, 600);
} else avvia();
})();
