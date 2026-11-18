/* Gestionale EdilMen: listino dei pacchetti standard (js/listino.js), prezzi delle imprese a confronto (tabella listini_azienda),
   prezzi dalla community (quotazioni_utenti) e abbonamenti Pro/Premium (campi piano e abbonamento_* di aziende, aggiornati da Stripe o a mano). */
(function () {
'use strict';
const A = window.EM_APP, G = window.EM_GEST, L = window.EM_LISTINO;
if (!A || !G || !G.sb || !L) return;
const { $, $$, esc, ic, pill, openDrawer, closeDrawer, toast } = A;
const sb = G.sb;

const LIV = L.livelli, CAMPI = ['prezzo_std', 'prezzo_int', 'prezzo_prem'];
const PIANI = { start: ['Start', 'gray'], pro: ['Pro', 'blue'], premium: ['Premium', 'violet'] };
const PREZZO_PIANO = { pro: 240, premium: 400 };
const ABB = { nessuno: ['Nessuno', 'gray'], attivo: ['Attivo', 'green'], in_ritardo: ['Pagamento non riuscito', 'amber'], annullato: ['Disdetto', 'gray'] };
const STATO_PREZZO = { da_controllare: ['Da controllare', 'amber'], approvato: ['Approvato', 'green'], anomalo: ['Anomalo', 'red'] };
const PK = c => L.pacchetti.find(p => p.c === c);
const eur = n => (n == null ? '' : Math.round(n).toLocaleString('it-IT') + ' €');
const scarto = (v, rif) => (v == null ? null : v / rif - 1);
const scartoHtml = s => (s == null ? '' : `<small style="color:${s < -0.25 ? 'var(--red,#B42318)' : s > 0.15 ? '#8A5A00' : 'var(--muted,#63719A)'}">${s > 0 ? '+' : ''}${Math.round(s * 100)}%</small>`);
const data = iso => (iso ? new Date(iso).toLocaleDateString('it-IT') : '');
const erroreMigrazione = el => { el.innerHTML = `<div class="card"><div class="card-b"><b>Le tabelle dei listini non sono ancora nel database.</b>
  <p class="muted" style="margin-top:6px">Va caricata una volta la migrazione <code>supabase/migrations/0008_listini_abbonamenti.sql</code> dall'SQL Editor di Supabase.</p></div></div>`; };

/* ---------- Listino EdilMen ---------- */
let fam = '', q = '';
function listino(el) {
  const famiglie = [...new Set(L.pacchetti.map(p => p.fam))];
  el.innerHTML = `<div class="ph"><div><h1>Listino EdilMen</h1><p>${L.pacchetti.length} pacchetti standard, versione ${esc(L.versione)}. ${esc(L.base)}. Il preventivo sul sito usa il prezzo prudente: parte fissa più l'accantonamento per le componenti variabili.</p></div></div>
    <div class="card"><div class="filters"><label class="fld" style="flex:1"><span>Cerca</span><input class="inp" id="li-q" value="${esc(q)}" placeholder="Nome o codice del pacchetto"></label>
      <label class="fld"><span>Famiglia</span><select class="sel" id="li-fam"><option value="">Tutte</option>${famiglie.map(f => `<option ${f === fam ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label></div>
    <div class="tw"><table class="t"><thead><tr><th>Pacchetto</th><th>Unità</th>${LIV.map(l => `<th style="text-align:right">${l}</th>`).join('')}<th style="text-align:right">Prudente (Int.)</th><th>Durata</th></tr></thead><tbody id="li-righe"></tbody></table></div></div>`;
  const righe = () => {
    const s = q.toLowerCase();
    $('#li-righe').innerHTML = L.pacchetti.filter(p => (!fam || p.fam === fam) && (!s || (p.c + ' ' + p.nome).toLowerCase().includes(s))).map(p => `<tr class="clickable" data-pk="${p.c}">
      <td><b>${esc(p.nome)}</b><br><small class="muted">${esc(p.c)}, ${esc(p.fam)}</small></td><td><small>${esc(p.udm)}</small></td>
      ${p.p.map(x => `<td style="text-align:right">${eur(x)}</td>`).join('')}<td style="text-align:right"><b>${eur(p.p[1] * (1 + p.acc))}</b><br><small class="muted">+${Math.round(p.acc * 100)}%</small></td>
      <td><small>${esc(p.durata || '')}</small></td></tr>`).join('') || '<tr><td colspan="7" class="muted" style="padding:24px">Nessun pacchetto.</td></tr>';
    $$('[data-pk]', el).forEach(tr => tr.onclick = () => schedaPacchetto(tr.dataset.pk));
  };
  $('#li-q').oninput = e => { q = e.target.value; righe(); };
  $('#li-fam').onchange = e => { fam = e.target.value; righe(); };
  righe(); A.paintIcons(el);
}

function schedaPacchetto(c) {
  const p = PK(c), voci = L.checklist[c] || [], vars = L.variabili[c] || [], varianti = L.varianti.filter(v => v.pk === c), fv = L.fv[c];
  const blocco = (s, titolo) => { const v = voci.filter(x => x.s === s); return v.length ? `<div class="sect"><h4>${titolo}</h4><ul style="margin:6px 0 0;padding-left:18px">${v.map(x => `<li style="margin-bottom:6px"><b>${esc(x.t)}</b><br><small class="muted">${esc(x.d)}</small>${x.m ? `<br><small>${x.m.map((m, i) => `${LIV[i]}: ${esc(m)}`).join(' · ')}</small>` : ''}</li>`).join('')}</ul></div>` : ''; };
  openDrawer(`<div class="dr-h"><div><h2>${esc(p.nome)}</h2><small class="muted">${esc(p.c)}, ${esc(p.fam)}, prezzo per ${esc(p.udm)}</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b">
    <p>${esc(p.risolve)}.</p><p class="muted" style="margin-top:4px">Scenario medio: ${esc(p.scenario)} (${esc(p.qrif)} ${esc(p.udm)}).</p>
    <div class="tw" style="margin-top:12px"><table class="t"><thead><tr><th></th>${LIV.map(l => `<th style="text-align:right">${l}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Parte fissa per ${esc(p.udm)}</td>${p.p.map(x => `<td style="text-align:right">${eur(x)}</td>`).join('')}</tr>
      <tr><td>Prezzo prudente (+${Math.round(p.acc * 100)}%)</td>${p.p.map(x => `<td style="text-align:right"><b>${eur(x * (1 + p.acc))}</b></td>`).join('')}</tr>
      <tr><td>Scenario medio, prudente</td>${p.p.map(x => `<td style="text-align:right">${eur(x * (1 + p.acc) * p.qrif)}</td>`).join('')}</tr></tbody></table></div>
    <p class="muted" style="margin-top:8px">Durata indicativa: ${esc(p.durata || '')}. Titolo abilitativo tipico: ${esc(p.titolo || '')}.${p.note ? ' ' + esc(p.note) : ''}</p>
    ${fv ? `<p style="margin-top:8px">Fotovoltaico: beneficio di circa ${eur(fv.beneficio)} all'anno, rientro in ${String(fv.rientro).replace('.', ',')} anni, ${Math.round(fv.coperti * 100)}% dei consumi coperti.</p>` : ''}
    ${blocco('i', 'Compreso')}${blocco('v', 'A parte, solo se serve (a misura, con variante scritta)')}${blocco('e', 'Escluso')}
    ${vars.length ? `<div class="sect"><h4>Componenti variabili</h4><div class="tw"><table class="t"><tbody>${vars.map(v => `<tr><td>${esc(v.nome)}<br><small class="muted">${esc(v.quando)}</small></td><td><small>${v.p.map((x, i) => `${LIV[i]} ${eur(x)}/${esc(v.udm)}`).join('<br>')}</small></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${varianti.length ? `<div class="sect"><h4>Varianti</h4><ul style="margin:6px 0 0;padding-left:18px">${varianti.map(v => `<li><b>${esc(v.nome)}</b> (${v.delta > 0 ? '+' : ''}${Math.round(v.delta * 100)}%): ${esc(v.cosa)}. <small class="muted">Livelli: ${v.livelli.map(i => LIV[i]).join(', ')}</small></li>`).join('')}</ul></div>` : ''}
  </div><div class="dr-f"><button class="btn btn-ghost" data-close>Chiudi</button><a class="btn btn-blue" href="#/admin/offerte/${p.c}">Prezzi delle imprese</a></div>`, d => { $$('a[href^="#/admin/offerte"]', d).forEach(a => a.onclick = () => closeDrawer()); });
}

/* ---------- Prezzi delle imprese ---------- */
let offerte = null, sceltoPk = '';
async function caricaOfferte() {
  const { data, error } = await sb.from('listini_azienda').select('*, aziende(nome,comune,provincia,piano,stato_scheda,slug)').order('aggiornato_il', { ascending: false });
  if (error) { console.error(error); return error; }
  offerte = data || []; return null;
}
async function prezziImprese(el, p) {
  if (p && PK(p)) sceltoPk = p;
  el.innerHTML = `<div class="ph"><div><h1>Prezzi delle imprese</h1><p>Le imprese prezzano i pacchetti standard dal questionario della scheda. Stesso contenuto per tutte: si confronta solo il prezzo della parte fissa. Oltre +15% sul riferimento il prezzo è alto; sotto −25% è anomalo e non si pubblica finché non lo approvi.</p></div>
    <div class="gs-azioni"><button class="btn btn-ghost" id="of-aggiorna">Aggiorna</button></div></div><div id="of-corpo"><div class="card"><div class="card-b muted">Carico i prezzi...</div></div></div>`;
  $('#of-aggiorna').onclick = async () => { await caricaOfferte(); disegnaOfferte(); toast('Prezzi aggiornati'); };
  if ((offerte === null && await caricaOfferte())) return erroreMigrazione($('#of-corpo'));
  disegnaOfferte();
}
function disegnaOfferte() {
  const box = $('#of-corpo'); if (!box) return;
  const perPk = {}; offerte.forEach(o => (perPk[o.pacchetto] = perPk[o.pacchetto] || []).push(o));
  const conta = s => offerte.filter(o => o.stato === s).length;
  const codici = Object.keys(perPk).sort();
  if (!sceltoPk || !perPk[sceltoPk]) sceltoPk = codici[0] || '';
  const pk = PK(sceltoPk), lista = perPk[sceltoPk] || [];
  const migliore = CAMPI.map(k => Math.min(...lista.map(o => o[k]).filter(v => v != null)));
  box.innerHTML = `<div class="kpis">
      <div class="kpi"><span class="ico">${ic('build')}</span><div><b class="num">${new Set(offerte.map(o => o.azienda_id)).size}</b><span>Imprese con listino</span></div></div>
      <div class="kpi"><span class="ico">${ic('box')}</span><div><b class="num">${codici.length}</b><span>Pacchetti prezzati</span></div></div>
      <div class="kpi"><span class="ico">${ic('clock')}</span><div><b class="num">${conta('da_controllare')}</b><span>Prezzi da controllare</span></div></div>
      <div class="kpi"><span class="ico">${ic('bell')}</span><div><b class="num">${conta('anomalo')}</b><span>Anomali</span></div></div></div>
    <div class="card" style="margin-top:18px">${!codici.length ? '<div class="card-b muted">Nessuna impresa ha ancora prezzato i pacchetti. I prezzi arrivano dal questionario della pagina "Rivendica la scheda".</div>' : `
      <div class="filters"><label class="fld" style="flex:1"><span>Pacchetto</span><select class="sel" id="of-pk">${codici.map(c => `<option value="${c}" ${c === sceltoPk ? 'selected' : ''}>${esc(c)} ${esc(PK(c) ? PK(c).nome : '')} (${perPk[c].length})</option>`).join('')}</select></label></div>
      <div class="card-b" style="padding-top:0"><small class="muted">Riferimento EdilMen per ${esc(pk.udm)}: ${pk.p.map((x, i) => `${LIV[i]} ${eur(x)}`).join(', ')}. Prezzi IVA esclusa, parte fissa.</small></div>
      <div class="tw"><table class="t"><thead><tr><th>Impresa</th><th>Piano</th>${LIV.map(l => `<th style="text-align:right">${l}</th>`).join('')}<th>Sulla scheda</th><th>Stato</th><th></th></tr></thead><tbody>
      ${lista.map(o => `<tr><td><b>${esc(o.aziende ? o.aziende.nome : '')}</b><br><small class="muted">${esc(o.aziende ? [o.aziende.comune, o.aziende.provincia].filter(Boolean).join(', ') : '')}</small></td>
        <td>${pill(o.aziende && o.aziende.piano || 'start', PIANI)}</td>
        ${CAMPI.map((k, i) => `<td style="text-align:right">${o[k] != null ? `${o[k] === migliore[i] && lista.length > 1 ? '<b>' + eur(o[k]) + '</b>' : eur(o[k])}<br>${scartoHtml(scarto(o[k], pk.p[i]))}` : '<small class="muted">no</small>'}</td>`).join('')}
        <td><small>${o.visibilita === 'pubblico' ? 'Prezzi pubblici' : 'Solo EdilMen'}</small></td><td>${pill(o.stato, STATO_PREZZO)}</td>
        <td style="white-space:nowrap">${o.stato !== 'approvato' ? `<button class="btn btn-ghost" data-ok="${o.id}">Approva</button>` : ''}${o.stato !== 'anomalo' ? ` <button class="btn btn-ghost" data-ko="${o.id}">Anomalo</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`}</div>`;
  A.paintIcons(box);
  const sel = $('#of-pk'); if (sel) sel.onchange = e => { sceltoPk = e.target.value; disegnaOfferte(); };
  const cambia = async (id, stato) => {
    const { error } = await sb.from('listini_azienda').update({ stato }).eq('id', id);
    if (error) return toast('Non sono riuscito a salvare');
    offerte.find(o => o.id === id).stato = stato; toast(stato === 'approvato' ? 'Prezzo approvato' : 'Segnato come anomalo: non si pubblica'); disegnaOfferte();
  };
  $$('[data-ok]', box).forEach(b => b.onclick = () => cambia(b.dataset.ok, 'approvato'));
  $$('[data-ko]', box).forEach(b => b.onclick = () => cambia(b.dataset.ko, 'anomalo'));
}

/* ---------- Abbonamenti ---------- */
let imprese = null;
async function caricaImprese() {
  const { data, error } = await sb.from('aziende').select('id,nome,comune,provincia,slug,piano,piano_richiesto,abbonamento_stato,abbonamento_fino,stripe_cliente,stato_scheda')
    .or('piano.neq.start,piano_richiesto.in.(pro,premium),abbonamento_stato.neq.nessuno').order('nome');
  if (error) { console.error(error); return error; }
  imprese = data || []; return null;
}
async function abbonamenti(el) {
  el.innerHTML = `<div class="ph"><div><h1>Abbonamenti</h1><p>Piani Pro (240 € al mese) e Premium (400 € al mese). Con il pagamento con carta il piano si aggiorna da solo; per un bonifico lo imposti tu da qui.</p></div>
    <div class="gs-azioni"><button class="btn btn-ghost" id="ab-aggiorna">Aggiorna</button></div></div><div id="ab-corpo"><div class="card"><div class="card-b muted">Carico gli abbonamenti...</div></div></div>`;
  $('#ab-aggiorna').onclick = async () => { await caricaImprese(); disegnaAbbonamenti(); toast('Abbonamenti aggiornati'); };
  if ((imprese === null && await caricaImprese())) return erroreMigrazione($('#ab-corpo'));
  disegnaAbbonamenti();
}
function disegnaAbbonamenti() {
  const box = $('#ab-corpo'); if (!box) return;
  const attivi = p => imprese.filter(a => a.piano === p && a.abbonamento_stato !== 'annullato').length;
  const mensile = attivi('pro') * PREZZO_PIANO.pro + attivi('premium') * PREZZO_PIANO.premium;
  box.innerHTML = `<div class="kpis">
      <div class="kpi"><span class="ico">${ic('star')}</span><div><b class="num">${attivi('premium')}</b><span>Premium</span></div></div>
      <div class="kpi"><span class="ico">${ic('check')}</span><div><b class="num">${attivi('pro')}</b><span>Pro</span></div></div>
      <div class="kpi"><span class="ico">${ic('euro')}</span><div><b class="num">${mensile.toLocaleString('it-IT')} €</b><span>Al mese, IVA esclusa</span></div></div>
      <div class="kpi"><span class="ico">${ic('bell')}</span><div><b class="num">${imprese.filter(a => a.abbonamento_stato === 'in_ritardo').length}</b><span>Pagamenti non riusciti</span></div></div></div>
    <div class="card" style="margin-top:18px"><div class="tw"><table class="t"><thead><tr><th>Impresa</th><th>Piano</th><th>Richiesto</th><th>Abbonamento</th><th>Rinnovo</th></tr></thead><tbody>
    ${imprese.map(a => `<tr class="clickable" data-ab="${a.id}"><td><b>${esc(a.nome)}</b><br><small class="muted">${esc([a.comune, a.provincia].filter(Boolean).join(', '))}</small></td>
      <td>${pill(a.piano, PIANI)}</td><td>${a.piano_richiesto && a.piano_richiesto !== a.piano ? pill(a.piano_richiesto, PIANI) : ''}</td>
      <td>${pill(a.abbonamento_stato, ABB)}${a.stripe_cliente ? '<br><small class="muted">carta (Stripe)</small>' : ''}</td><td><small>${data(a.abbonamento_fino)}</small></td></tr>`).join('')
      || '<tr><td colspan="5" class="muted" style="padding:24px">Nessuna impresa ha ancora chiesto Pro o Premium.</td></tr>'}
    </tbody></table></div></div>`;
  A.paintIcons(box);
  $$('[data-ab]', box).forEach(tr => tr.onclick = () => schedaAbbonamento(tr.dataset.ab));
}
function schedaAbbonamento(id) {
  const a = imprese.find(x => x.id === id); if (!a) return;
  openDrawer(`<div class="dr-h"><div><h2>${esc(a.nome)}</h2><small class="muted">${esc([a.comune, a.provincia].filter(Boolean).join(', '))}</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b">
    <p>Piano attuale ${pill(a.piano, PIANI)}, abbonamento ${pill(a.abbonamento_stato, ABB)}${a.abbonamento_fino ? `, rinnovo il ${data(a.abbonamento_fino)}` : ''}.</p>
    ${a.stripe_cliente ? `<p style="margin-top:8px">Pagamento con carta: le modifiche si fanno dal <a class="link" href="https://dashboard.stripe.com/customers/${esc(a.stripe_cliente)}" target="_blank" rel="noopener">pannello Stripe</a> e arrivano qui da sole.</p>` : ''}
    <div class="grid2b" style="gap:12px;margin-top:14px">
      <label class="fld"><span>Piano</span><select class="sel" id="ab-piano">${Object.entries(PIANI).map(([k, v]) => `<option value="${k}" ${k === a.piano ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <label class="fld"><span>Pagato fino al</span><input class="inp" type="date" id="ab-fino" value="${a.abbonamento_fino ? a.abbonamento_fino.slice(0, 10) : ''}"></label></div>
    <p class="muted" style="margin-top:8px">Usalo per i pagamenti con bonifico o per periodi di prova. Con Start l'abbonamento torna a "Nessuno".</p>
    <p style="margin-top:12px"><a class="link" href="/imprese/${esc(a.slug)}" target="_blank" rel="noopener">Apri la scheda pubblica</a></p>
  </div><div class="dr-f"><button class="btn btn-ghost" data-close>Chiudi</button><button class="btn btn-blue" id="ab-salva">Salva</button></div>`, d => {
    $('#ab-salva', d).onclick = async () => {
      const piano = $('#ab-piano', d).value, fino = $('#ab-fino', d).value;
      const agg = { piano, abbonamento_fino: fino ? new Date(fino + 'T23:59:00').toISOString() : null,
        abbonamento_stato: piano === 'start' ? 'nessuno' : (a.stripe_cliente ? a.abbonamento_stato : 'attivo') };
      const { error } = await sb.from('aziende').update(agg).eq('id', a.id);
      if (error) return toast('Non sono riuscito a salvare');
      Object.assign(a, agg); toast('Piano aggiornato'); closeDrawer(); disegnaAbbonamenti();
    };
  });
}

/* ---------- Prezzi dalla community (tabella quotazioni_utenti, /prezzi/condividi) ---------- */
const STATO_Q = { in_verifica: ['Da controllare', 'amber'], approvata: ['Approvata', 'green'], rifiutata: ['Rifiutata', 'gray'] };
const IVA_Q = { esclusa: 'IVA esclusa', 10: 'IVA 10% inclusa', 22: 'IVA 22% inclusa', non_so: 'IVA non indicata' };
let quotazioni = null, filtroQ = 'in_verifica';
async function caricaQuotazioni() {
  const { data, error } = await sb.from('quotazioni_utenti').select('*').order('creato_il', { ascending: false }).limit(500);
  if (error) { console.error(error); return error; }
  quotazioni = data || []; return null;
}
async function community(el) {
  el.innerHTML = `<div class="ph"><div><h1>Prezzi dalla community</h1><p>Quotazioni caricate dalle persone nelle guide prezzi. Solo quelle approvate entrano nelle medie pubbliche, e solo da 3 per lavoro in su: mai la singola riga, il comune, l'email o il file.</p></div>
    <div class="gs-azioni"><button class="btn btn-ghost" id="qc-aggiorna">Aggiorna</button></div></div><div id="qc-corpo"><div class="card"><div class="card-b muted">Carico le quotazioni...</div></div></div>`;
  $('#qc-aggiorna').onclick = async () => { await caricaQuotazioni(); disegnaCommunity(); toast('Quotazioni aggiornate'); };
  if (quotazioni === null && await caricaQuotazioni()) {
    $('#qc-corpo').innerHTML = `<div class="card"><div class="card-b"><b>La tabella delle quotazioni non è ancora nel database.</b><p class="muted" style="margin-top:6px">Va caricata una volta la migrazione <code>supabase/migrations/0011_prezzi_community.sql</code> dall'SQL Editor di Supabase.</p></div></div>`;
    return;
  }
  disegnaCommunity();
}
function disegnaCommunity() {
  const box = $('#qc-corpo'); if (!box) return;
  const lista = quotazioni.filter(x => !filtroQ || x.stato === filtroQ);
  box.innerHTML = `<div class="card"><div class="filters"><label class="fld"><span>Stato</span><select class="sel" id="qc-stato"><option value="">Tutte</option>${Object.entries(STATO_Q).map(([k, v]) => `<option value="${k}" ${k === filtroQ ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label></div>
    <div class="tw"><table class="t"><thead><tr><th>Lavoro</th><th>Importo</th><th style="text-align:right">Prezzo unitario</th><th style="text-align:right">Listino (Int.)</th><th>Dove e quando</th><th>Stato</th></tr></thead><tbody>
    ${lista.map(x => { const p = PK(x.pacchetto), rif = p ? p.p[1] * (1 + p.acc) : null; return `<tr class="clickable" data-qc="${x.id}">
      <td><b>${esc(p ? p.nome : x.pacchetto)}</b><br><small class="muted">${esc(x.pacchetto)}, ${x.tipo === 'lavoro_concluso' ? 'lavoro concluso' : 'preventivo'}${x.livello != null ? ', ' + LIV[x.livello] : ''}</small></td>
      <td>${eur(x.importo)}<br><small class="muted">${esc(IVA_Q[x.iva] || x.iva)}, ${esc(String(x.quantita))} ${esc(p ? p.udm : '')}</small></td>
      <td style="text-align:right">${x.prezzo_unitario != null ? `<b>${eur(x.prezzo_unitario)}</b><br>${scartoHtml(rif ? scarto(x.prezzo_unitario, rif) : null)}` : '<small class="muted">IVA non nota</small>'}${x.fuori_scala ? '<br><small style="color:#B42318">fuori scala</small>' : ''}</td>
      <td style="text-align:right">${rif ? eur(rif) : ''}</td>
      <td><small>${esc([x.comune, x.provincia].filter(Boolean).join(', '))}<br>${esc(String(x.anno || ''))}, inviata il ${data(x.creato_il)}</small></td>
      <td>${pill(x.stato, STATO_Q)}${x.allegato ? '<br><small class="muted">con file</small>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted" style="padding:24px">Nessuna quotazione in questo filtro.</td></tr>'}
    </tbody></table></div></div>`;
  A.paintIcons(box);
  $('#qc-stato').onchange = e => { filtroQ = e.target.value; disegnaCommunity(); };
  $$('[data-qc]', box).forEach(tr => tr.onclick = () => schedaQuotazione(tr.dataset.qc));
}
function schedaQuotazione(id) {
  const x = quotazioni.find(r => r.id === id); if (!x) return;
  const p = PK(x.pacchetto);
  openDrawer(`<div class="dr-h"><div><h2>${esc(p ? p.nome : x.pacchetto)}</h2><small class="muted">${x.tipo === 'lavoro_concluso' ? 'Lavoro concluso' : 'Preventivo ricevuto'}, inviata il ${data(x.creato_il)}</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b">
    <p>Importo <b>${eur(x.importo)}</b> (${esc(IVA_Q[x.iva] || x.iva)}) per ${esc(String(x.quantita))} ${esc(p ? p.udm : '')}${x.prezzo_unitario != null ? `: <b>${eur(x.prezzo_unitario)}</b> per ${esc(p ? p.udm : 'unità')} IVA esclusa` : ''}.</p>
    ${p ? `<p class="muted" style="margin-top:6px">Listino EdilMen, prezzo prudente: ${p.p.map((v, i) => `${LIV[i]} ${eur(v * (1 + p.acc))}`).join(', ')} per ${esc(p.udm)}.</p>` : ''}
    <p style="margin-top:8px">Livello: ${x.livello != null ? LIV[x.livello] : 'non indicato'}. Anno ${esc(String(x.anno || ''))}. ${esc([x.comune, x.provincia].filter(Boolean).join(', '))}.</p>
    ${x.note ? `<p style="margin-top:8px"><b>Note:</b> ${esc(x.note)}</p>` : ''}
    ${x.email ? `<p style="margin-top:8px">Email per chiarimenti: <a class="link" href="mailto:${esc(x.email)}">${esc(x.email)}</a></p>` : ''}
    ${x.allegato ? '<p style="margin-top:8px"><button class="btn btn-ghost" id="qc-file">Apri il preventivo caricato</button></p>' : '<p class="muted" style="margin-top:8px">Nessun file caricato.</p>'}
    ${x.fuori_scala ? '<p style="margin-top:8px;color:#B42318">Prezzo molto lontano dal listino (meno di metà dello Standard o più del doppio del Premium): controlla bene prima di approvare.</p>' : ''}
    <label class="fld" style="margin-top:12px"><span>Nota interna</span><input class="inp" id="qc-nota" value="${esc(x.nota_admin || '')}"></label>
  </div><div class="dr-f"><button class="btn btn-ghost" data-close>Chiudi</button><button class="btn btn-ghost" id="qc-no">Rifiuta</button><button class="btn btn-blue" id="qc-ok">Approva</button></div>`, d => {
    const f = $('#qc-file', d);
    if (f) f.onclick = async () => { const { data: s, error } = await sb.storage.from('quotazioni').createSignedUrl(x.allegato, 300); if (error) return toast('Non riesco ad aprire il file'); window.open(s.signedUrl, '_blank', 'noopener'); };
    const cambia = async stato => {
      const agg = { stato, verificata_il: new Date().toISOString(), nota_admin: $('#qc-nota', d).value || null };
      const { error } = await sb.from('quotazioni_utenti').update(agg).eq('id', x.id);
      if (error) return toast('Non sono riuscito a salvare');
      Object.assign(x, agg); toast(stato === 'approvata' ? 'Approvata: entra nelle medie pubbliche' : 'Rifiutata'); closeDrawer(); disegnaCommunity();
    };
    $('#qc-ok', d).onclick = () => cambia('approvata'); $('#qc-no', d).onclick = () => cambia('rifiutata');
  });
}

window.EM_LIST = { daControllare: () => (offerte ? offerte.filter(o => o.stato !== 'approvato').length : 0), quotazioni: () => (quotazioni ? quotazioni.filter(x => x.stato === 'in_verifica').length : 0) };

A.ROUTES['admin/listino'] = el => { listino(el); };
A.ROUTES['admin/offerte'] = (el, codice) => { prezziImprese(el, codice); };
A.ROUTES['admin/abbonamenti'] = el => { abbonamenti(el); };
A.ROUTES['admin/community'] = el => { community(el); };
})();
