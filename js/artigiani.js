/* Gestionale EdilMen: "Artigiani da contattare".
   Rubrica privata degli operatori (tabella artigiani, solo amministrazione): chi chiamare, com'è andata, e quando un artigiano
   accetta si crea la sua scheda in "aziende" (in verifica, non pubblicata). L'elenco si importa da Excel direttamente da qui. */
(function () {
'use strict';
const A = window.EM_APP, G = window.EM_GEST;
if (!A || !G || !G.sb) return;
const { $, $$, esc, ic, pill, openDrawer, closeDrawer, toast } = A;
const sb = G.sb;

const STATI = {
  da_chiamare: ['Da chiamare', 'blue'], richiamare: ['Da richiamare', 'amber'], interessato: ['Interessato', 'violet'],
  convenzionato: ['Convenzionato', 'green'], non_interessato: ['Non interessato', 'gray'], numero_errato: ['Numero errato', 'gray'], escluso: ['Escluso', 'gray'] };
const CATEGORIE = ['Edilizia generale', 'Impianti idraulici', 'Impianti elettrici', 'Serramenti / Infissi', 'Impermeabilizzazioni', 'Cartongesso',
  'Pavimenti / Rivestimenti', 'Ponteggi', 'Tinteggiature', 'Termoidraulica', 'Fotovoltaico', 'Altro'];
const ATTIVITA = { '1.1': 'Nuove costruzioni', '1.2': 'Ristrutturazioni', '1.3': 'Efficienza energetica', '2.1': 'Fotovoltaico', '2.2': 'Solare termico', '3.1': 'Domotica', '3.2': 'Sicurezza', '3.3': 'Robotica', '4.1': 'Pulizie' };
const REGIONE = { TN: 'taa', BZ: 'taa', VR: 'ven', VI: 'ven', PD: 'ven', TV: 'ven', BL: 'ven', VE: 'ven', RO: 'ven', UD: 'fvg', GO: 'fvg', TS: 'fvg', PN: 'fvg' };
const ESITI_RAPIDI = [['richiamare', 'Non risponde'], ['interessato', 'Interessato'], ['non_interessato', 'Non interessato'], ['numero_errato', 'Numero errato']];

let artigiani = [], caricato = false, filtro = 'aperti', cerca = '', categoria = '';

const quando = iso => iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const cifre = t => String(t || '').replace(/\D/g, '').replace(/^0039/, '').replace(/^39(?=3\d{8,9}$)/, '');
const nomeVis = a => a.ditta || [a.nome, a.cognome].filter(Boolean).join(' ') || a.nome_rubrica;
const aperto = a => ['da_chiamare', 'richiamare', 'interessato'].includes(a.stato);

// partita IVA italiana: 11 cifre con cifra di controllo
function pivaValida(p) {
  p = String(p || '').replace(/\s/g, '').replace(/^IT/i, '');
  if (!/^\d{11}$/.test(p)) return false;
  let s = 0;
  for (let i = 0; i < 10; i++) { let n = +p[i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; }
  return (10 - s % 10) % 10 === +p[10];
}
// "Via Zanella 10/1, 38122 Trento (TN)" -> comune Trento, provincia TN
// se manca l'indirizzo completo, riconosce le città della zona scritte da sole ("Mattarello, Trento") e il prefisso di Trento
const CITTA = { Trento: 'TN', Rovereto: 'TN', Pergine: 'TN', Arco: 'TN', Riva: 'TN', Bolzano: 'BZ', Merano: 'BZ', Verona: 'VR', Vicenza: 'VI', Gambellara: 'VI',
  Padova: 'PD', Treviso: 'TV', Belluno: 'BL', Venezia: 'VE', Mestre: 'VE', Rovigo: 'RO', Udine: 'UD', Trieste: 'TS', Pordenone: 'PN', Gorizia: 'GO' };
function daSede(...testi) {
  const t = testi.filter(Boolean).join(' ');
  let prov = (t.match(/\(([A-Z]{2})\)/) || [])[1] || '';
  let com = ((t.match(/\b\d{5}\s+([^,(]+?)\s*(?:\(|,|$)/) || [])[1] || '').trim();
  if (!com) { const c = Object.keys(CITTA).find(x => new RegExp('\\b' + x + '\\b', 'i').test(t)); if (c) { com = c; prov = prov || CITTA[c]; } }
  if (!prov && /\b0461\b/.test(t)) prov = 'TN';
  return { provincia: prov, comune: com };
}

async function carica() {
  const { data, error } = await sb.from('artigiani').select('*').order('numero', { ascending: true, nullsFirst: false }).order('creato_il', { ascending: true });
  if (error) { console.error(error); return error; }
  artigiani = data || []; caricato = true; return null;
}

/* ---------- pagina ---------- */
async function pagina(el) {
  el.innerHTML = `<div class="ph"><div><h1>Artigiani da contattare</h1><p>La rubrica privata per portare nuove imprese nella rete. Chiama, segna com'è andata e, quando un artigiano accetta, crea la sua scheda impresa.</p></div>
    <div class="gs-azioni"><button class="btn btn-ghost" id="ar-importa">${ic('file')}Importa da Excel</button><button class="btn btn-ghost" id="ar-aggiorna">Aggiorna</button></div></div>
    <div id="ar-corpo"><div class="card"><div class="card-b muted">Carico la rubrica...</div></div></div>`;
  A.paintIcons(el);
  $('#ar-importa').onclick = apriImportazione;
  $('#ar-aggiorna').onclick = async () => { await carica(); disegna(); toast('Rubrica aggiornata'); };
  const err = caricato ? null : await carica();
  if (err) {
    $('#ar-corpo').innerHTML = `<div class="card"><div class="card-b"><b>La rubrica non è ancora pronta nel database.</b>
      <p class="muted" style="margin-top:6px">Va caricata una volta la migrazione <code>supabase/migrations/0007_artigiani.sql</code> dall'SQL Editor di Supabase, poi premi Aggiorna.</p></div></div>`;
    return;
  }
  disegna();
}

function disegna() {
  const box = $('#ar-corpo'); if (!box) return;
  const conta = k => artigiani.filter(a => a.stato === k).length;
  const tabs = [['aperti', 'Da lavorare', artigiani.filter(aperto).length], ['tutti', 'Tutti', artigiani.length], ...Object.entries(STATI).map(([k, v]) => [k, v[0], conta(k)])];
  const q = cerca.toLowerCase();
  const lista = artigiani.filter(a => (filtro === 'tutti' || (filtro === 'aperti' ? aperto(a) : a.stato === filtro))
    && (!categoria || a.categoria === categoria)
    && (!q || [a.nome_rubrica, a.nome, a.cognome, a.ditta, a.specializzazione, a.sede, a.comune, a.cellulare].join(' ').toLowerCase().includes(q)));
  const cats = [...new Set(artigiani.map(a => a.categoria).filter(Boolean))].sort();
  box.innerHTML = `<div class="kpis">
      <div class="kpi"><span class="ico">${ic('users')}</span><div><b class="num">${artigiani.length}</b><span>Contatti in rubrica</span></div></div>
      <div class="kpi"><span class="ico">${ic('clock')}</span><div><b class="num">${conta('da_chiamare') + conta('richiamare')}</b><span>Da chiamare o richiamare</span></div></div>
      <div class="kpi"><span class="ico">${ic('star')}</span><div><b class="num">${conta('interessato')}</b><span>Interessati</span></div></div>
      <div class="kpi"><span class="ico">${ic('check')}</span><div><b class="num">${conta('convenzionato')}</b><span>Convenzionati</span></div></div></div>
    <div class="card" style="margin-top:18px">
      <div class="tabs" style="padding:0 10px">${tabs.map(([k, l, n]) => `<button class="${k === filtro ? 'on' : ''}" data-artab="${k}">${l}<span class="c">${n}</span></button>`).join('')}</div>
      <div class="filters"><label class="fld" style="flex:1"><span>Cerca</span><input class="inp" id="ar-q" value="${esc(cerca)}" placeholder="Nome, ditta, zona o numero"></label>
        <label class="fld"><span>Mestiere</span><select class="sel" id="ar-cat"><option value="">Tutti</option>${cats.map(c => `<option ${c === categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
      <div class="tw"><table class="t"><thead><tr><th>Contatto</th><th>Mestiere</th><th>Telefono</th><th>Zona</th><th>Identità</th><th>Stato</th></tr></thead><tbody>
      ${lista.map(riga).join('') || `<tr><td colspan="6" class="muted" style="padding:24px">${artigiani.length ? 'Nessun contatto con questi filtri.' : 'La rubrica è vuota: premi "Importa da Excel" per caricare l\'elenco.'}</td></tr>`}
      </tbody></table></div></div>`;
  A.paintIcons(box);
  $$('[data-artab]', box).forEach(b => b.onclick = () => { filtro = b.dataset.artab; disegna(); });
  $('#ar-q').oninput = e => { cerca = e.target.value; clearTimeout(disegna.t); disegna.t = setTimeout(() => { disegna(); const i = $('#ar-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $('#ar-cat').onchange = e => { categoria = e.target.value; disegna(); };
  $$('[data-ar]', box).forEach(tr => tr.onclick = e => { if (!e.target.closest('a')) dettaglio(tr.dataset.ar); });
}

function linkTelefono(n) {
  if (!n) return '';
  const d = cifre(n);
  return `<a href="tel:+39${esc(d)}">${esc(n)}</a>${/^3/.test(d) ? ` <a class="link" href="https://wa.me/39${esc(d)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}`;
}
function riga(a) {
  const id = { Confermato: 'green', Probabile: 'blue', 'Da verificare': 'amber' }[a.corrispondenza_web];
  return `<tr class="clickable" data-ar="${a.id}"><td><b>${esc(nomeVis(a))}</b>${a.azienda_id ? ' <span class="pill green">Scheda creata</span>' : ''}<br><small class="muted">${esc(a.nome_rubrica)}${a.numero ? ' · n. ' + a.numero : ''}</small></td>
    <td>${esc(a.categoria || '')}<br><small class="muted">${esc(a.specializzazione && a.specializzazione !== a.categoria ? a.specializzazione : '')}</small></td>
    <td>${linkTelefono(a.cellulare)}${a.telefono_fisso ? `<br><small>${linkTelefono(a.telefono_fisso)}</small>` : ''}</td>
    <td>${esc(a.comune || a.sede || '')}${a.provincia ? ` <small class="muted">(${esc(a.provincia)})</small>` : ''}</td>
    <td>${id ? pill(a.corrispondenza_web, { [a.corrispondenza_web]: [a.corrispondenza_web, id] }) : `<small class="muted">${esc(a.corrispondenza_web || '')}</small>`}</td>
    <td>${pill(a.stato, STATI)}${a.ultimo_contatto ? `<br><small class="muted">${quando(a.ultimo_contatto)}</small>` : ''}</td></tr>`;
}

/* ---------- scheda del contatto ---------- */
function dettaglio(id) {
  const a = artigiani.find(x => x.id === id); if (!a) return;
  const campo = (k, l, tipo = 'text', extra = '') => `<label class="fld"><span>${l}</span><input class="inp" type="${tipo}" data-k="${k}" value="${esc(a[k] || '')}" ${extra}></label>`;
  openDrawer(`<div class="dr-h"><div><h2>${esc(nomeVis(a))}</h2><small class="muted">In rubrica come "${esc(a.nome_rubrica)}"${a.fonte ? ' · dati da ' + esc(a.fonte) : ''}</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b">
    <div class="sect"><h4>Chiama</h4><p style="font-size:1.1rem">${linkTelefono(a.cellulare) || '<span class="muted">Nessun cellulare</span>'}${a.telefono_fisso ? '<br>' + linkTelefono(a.telefono_fisso) : ''}</p>
      <p class="muted" style="margin-top:6px">Com'è andata? Un tocco aggiorna lo stato e scrive la data nel diario.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${ESITI_RAPIDI.map(([k, l]) => `<button class="btn btn-ghost" data-rapido="${k}">${l}</button>`).join('')}</div></div>
    <div class="grid2b" style="gap:12px;margin-top:6px">
      <label class="fld"><span>Stato</span><select class="sel" data-k="stato">${Object.entries(STATI).map(([k, v]) => `<option value="${k}" ${k === a.stato ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <label class="fld"><span>Mestiere</span><select class="sel" data-k="categoria"><option value="">Da definire</option>${[...new Set([...CATEGORIE, a.categoria].filter(Boolean))].map(c => `<option ${c === a.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${campo('nome', 'Nome')}${campo('cognome', 'Cognome')}
      ${campo('ditta', 'Ditta / ragione sociale')}${campo('piva', 'Partita IVA', 'text', 'inputmode="numeric" maxlength="13"')}
      ${campo('comune', 'Comune')}${campo('provincia', 'Provincia (sigla)', 'text', 'maxlength="2" style="text-transform:uppercase"')}
      ${campo('cellulare', 'Cellulare', 'tel')}${campo('telefono_fisso', 'Telefono fisso', 'tel')}
      ${campo('email', 'Email', 'email')}${campo('sito', 'Sito web', 'url')}
      <label class="fld" style="grid-column:1/-1"><span>Diario delle chiamate</span><textarea class="inp" data-k="esito" rows="4" placeholder="es. 5 ott: interessato, richiamare lunedì dopo le 17">${esc(a.esito || '')}</textarea></label>
      <label class="fld" style="grid-column:1/-1"><span>Note</span><textarea class="inp" data-k="note" rows="2">${esc(a.note || '')}</textarea></label>
    </div>
    <p class="muted" id="ar-piva-msg" style="margin-top:8px"></p>
    <div class="sect" style="margin-top:14px"><h4>Scheda impresa</h4>${a.azienda_id
      ? `<p>Scheda già creata: la trovi in <a class="link" href="#/admin/sito">Richieste dal sito</a>, scheda "Aziende", da verificare e attivare.</p>`
      : `<p class="muted">Quando l'artigiano accetta di entrare nella rete servono ditta, partita IVA e comune. La scheda nasce in verifica e non è pubblica finché non la attivi dopo i controlli sui documenti.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">${Object.entries(ATTIVITA).slice(0, 4).map(([k, v]) => `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-att="${k}" ${k === '1.2' ? 'checked' : ''}> ${v}</label>`).join('')}</div>
        <button class="btn btn-blue" id="ar-scheda" style="margin-top:10px">Crea la scheda impresa</button>`}</div>
  </div>
  <div class="dr-f"><button class="btn btn-ghost" data-close>Chiudi</button><button class="btn btn-blue" id="ar-salva">Salva</button></div>`, d => {
    const leggi = () => { const o = {}; $$('[data-k]', d).forEach(i => { let v = i.value.trim(); if (i.dataset.k === 'provincia') v = v.toUpperCase(); o[i.dataset.k] = v || null; }); o.stato = o.stato || 'da_chiamare'; return o; };
    const msgPiva = () => { const p = $('[data-k="piva"]', d).value.trim(), m = $('#ar-piva-msg', d); m.textContent = p && !pivaValida(p) ? 'Attenzione: la partita IVA non è valida (11 cifre con cifra di controllo).' : ''; m.style.color = 'var(--red, #B42318)'; };
    $('[data-k="piva"]', d).oninput = msgPiva; msgPiva();
    const salva = async (agg, msg) => {
      if (agg.stato !== a.stato) agg.ultimo_contatto = new Date().toISOString();
      const { error } = await sb.from('artigiani').update(agg).eq('id', a.id);
      if (error) { toast(/artigiani_cellulare/.test(error.message) ? 'Questo cellulare è già in rubrica' : 'Non sono riuscito a salvare'); return false; }
      Object.assign(a, agg); toast(msg || 'Contatto aggiornato'); disegna(); return true;
    };
    $('#ar-salva', d).onclick = async () => { if (await salva(leggi())) closeDrawer(); };
    $$('[data-rapido]', d).forEach(b => b.onclick = async () => {
      const agg = leggi(), oggi = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
      agg.stato = b.dataset.rapido; agg.ultimo_contatto = new Date().toISOString();
      agg.esito = `${oggi}: ${b.textContent.toLowerCase()}${agg.esito ? '\n' + agg.esito : ''}`;
      if (await salva(agg, 'Segnato: ' + b.textContent.toLowerCase())) closeDrawer();
    });
    const bs = $('#ar-scheda', d);
    if (bs) bs.onclick = async () => {
      const f = leggi();
      if (!f.ditta) return toast('Scrivi prima la ragione sociale della ditta');
      if (!pivaValida(f.piva)) return toast('Serve una partita IVA valida');
      if (!f.comune) return toast('Scrivi il comune della sede');
      const piva = f.piva.replace(/\s/g, '').replace(/^IT/i, '');
      const categorie = $$('[data-att]:checked', d).map(c => c.dataset.att);
      if (!categorie.length) return toast('Scegli almeno un\'attività');
      // se l'impresa c'è già (catalogo o iscrizione) la colleghiamo invece di duplicarla
      const { data: esiste } = await sb.from('aziende').select('id,nome').eq('piva', piva).limit(1);
      let aziendaId = esiste && esiste[0] && esiste[0].id;
      if (!aziendaId) {
        const nuova = { nome: f.ditta, piva, comune: f.comune, provincia: f.provincia, regione: REGIONE[f.provincia] || null, telefono: f.cellulare || f.telefono_fisso,
          email: f.email, sito: f.sito, categorie, province_servite: f.provincia ? [f.provincia] : [], origine: 'iscrizione', stato: 'verifica',
          referente: [f.nome, f.cognome].filter(Boolean).join(' ') || null, note: `Dalla rubrica artigiani ("${a.nome_rubrica}"). ${f.esito ? 'Diario: ' + f.esito.split('\n')[0] : ''}`.trim() };
        const { data, error } = await sb.from('aziende').insert(nuova).select('id').single();
        if (error) { console.error(error); return toast('Non sono riuscito a creare la scheda'); }
        aziendaId = data.id;
      }
      f.azienda_id = aziendaId; if (f.stato === 'da_chiamare' || f.stato === 'richiamare') f.stato = 'interessato';
      if (await salva(f, esiste && esiste[0] ? `Collegato a ${esiste[0].nome}, già presente` : 'Scheda impresa creata: ora è da verificare in "Aziende"')) closeDrawer();
    };
  });
}

/* ---------- importazione da Excel ---------- */
function caricaLibreria() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
}
// trova la colonna anche se l'intestazione cambia un po' ("Ditta / Ragione sociale", "Ragione sociale"...)
// prima cerca il nome esatto ("Nome" non deve prendere "Nome contatto (rubrica)"), poi uno che lo contiene
function colonna(r, ...nomi) {
  const norm = c => c.toLowerCase().replace(/[^a-z]/g, ''), chiavi = Object.keys(r);
  let k;
  for (const n of nomi) { k = chiavi.find(c => norm(c) === n); if (k) break; }
  if (!k) for (const n of nomi) { k = chiavi.find(c => norm(c).includes(n)); if (k) break; }
  const v = k ? r[k] : null; return v == null || String(v).trim() === '' ? null : String(v).trim();
}
function mappa(r) {
  const cat = colonna(r, 'categoriaedilmen', 'categoria'), tipoX = (colonna(r, 'tipo') || '').toLowerCase();
  const statoX = (colonna(r, 'statocontatto', 'stato') || '').toLowerCase();
  const interno = /interno/.test(tipoX) || /interno|escludere/i.test(cat || '');
  const sede = colonna(r, 'sedezona', 'sede', 'indirizzo'), { comune, provincia } = daSede(sede, colonna(r, 'nomecontattorubrica', 'rubrica'), colonna(r, 'ditta', 'ragionesociale'));
  const stato = interno ? 'escluso' : /convenz/.test(statoX) ? 'convenzionato' : /non interess/.test(statoX) ? 'non_interessato' : /interess/.test(statoX) ? 'interessato'
    : /errat/.test(statoX) ? 'numero_errato' : /richiam/.test(statoX) ? 'richiamare' : 'da_chiamare';
  // la partita IVA a volte ha un commento attaccato, es. "02529540227 (ditta individuale risulta cessata)": il commento va nelle note
  const pivaX = colonna(r, 'piva', 'partitaiva') || '', piva = (pivaX.replace(/\s/g, '').match(/\d{11}/) || [])[0] || null;
  const pivaNota = pivaX.replace(/\s*\d[\d\s]{9,}\d\s*/, ' ').replace(/^[\s(]+|[\s)]+$/g, '').trim();
  const kNum = Object.keys(r).find(c => ['n', 'numero', 'nr'].includes(c.toLowerCase().replace(/[^a-z]/g, '')));
  const num = parseInt(kNum ? r[kNum] : '', 10);
  return {
    numero: Number.isFinite(num) ? num : null, nome_rubrica: colonna(r, 'nomecontattorubrica', 'rubrica') || [colonna(r, 'nome'), colonna(r, 'cognome')].filter(Boolean).join(' '),
    nome: colonna(r, 'nome'), cognome: colonna(r, 'cognome'), ditta: colonna(r, 'ditta', 'ragionesociale'),
    tipo: interno ? 'interno' : /ditta/.test(tipoX) ? 'ditta' : 'persona', specializzazione: (s => s && !/da definire/i.test(s) ? s : null)(colonna(r, 'specializzazione', 'mestiere')),
    categoria: cat && !/da definire|interno/i.test(cat) ? cat : null, cellulare: colonna(r, 'cellulare'), telefono_fisso: colonna(r, 'telefonofisso', 'fisso'),
    email: colonna(r, 'email', 'mail'), sito: colonna(r, 'sitoweb', 'sito'), sede, comune: comune || null, provincia: provincia || null,
    piva, corrispondenza_web: colonna(r, 'corrispondenzaweb'), fonte: colonna(r, 'fonte'),
    note: [colonna(r, 'note'), pivaNota && 'Partita IVA: ' + pivaNota].filter(Boolean).join('\n') || null, esito: colonna(r, 'esito', 'commenti'), stato,
  };
}
function apriImportazione() {
  openDrawer(`<div class="dr-h"><div><h2>Importa da Excel</h2><small class="muted">File .xlsx o .csv con una riga per contatto</small></div><button class="ib" data-close aria-label="Chiudi">${ic('x')}</button></div>
  <div class="dr-b"><p>Usa il foglio "Contatti" del file degli operatori (colonne come Nome contatto, Ditta, Categoria EdilMen, Cellulare, Sede, P.IVA, Stato contatto). Le colonne mancanti restano vuote.</p>
    <p class="muted" style="margin-top:8px">I contatti già in rubrica con lo stesso cellulare vengono saltati, quindi puoi reimportare un file aggiornato senza creare doppioni. Il file non viene caricato da nessuna parte: lo legge il browser e salva solo le righe nel database.</p>
    <label class="fld" style="margin-top:14px"><span>Scegli il file</span><input class="inp" type="file" id="im-file" accept=".xlsx,.xls,.csv"></label>
    <div id="im-anteprima" style="margin-top:14px"></div></div>
  <div class="dr-f"><button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-blue" id="im-vai" disabled>Importa</button></div>`, d => {
    let nuovi = [];
    $('#im-file', d).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const out = $('#im-anteprima', d); out.innerHTML = '<p class="muted">Leggo il file...</p>';
      try { await caricaLibreria(); } catch (x) { out.innerHTML = '<p>Non riesco a caricare il lettore di Excel: controlla la connessione e riprova.</p>'; return; }
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const foglio = wb.Sheets[wb.SheetNames.find(n => /contatt/i.test(n)) || wb.SheetNames[0]];
      const righe = XLSX.utils.sheet_to_json(foglio, { defval: null }).map(mappa).filter(r => r.nome_rubrica || r.cellulare);
      if (!caricato) await carica();
      // doppione = stesso cellulare, o stesso fisso, o (senza numeri) stesso nome in rubrica
      const chiavi = a => [cifre(a.cellulare), cifre(a.telefono_fisso), !a.cellulare && !a.telefono_fisso ? 'n:' + (a.nome_rubrica || '').toLowerCase() : ''].filter(Boolean);
      const presenti = new Set(artigiani.flatMap(chiavi));
      nuovi = []; let doppi = 0;
      for (const r of righe) {
        r.nome_rubrica = r.nome_rubrica || r.ditta || 'Senza nome';
        const k = chiavi(r);
        if (k.some(x => presenti.has(x))) { doppi++; continue; }
        k.forEach(x => presenti.add(x)); nuovi.push(r);
      }
      const esclusi = nuovi.filter(r => r.stato === 'escluso').length, piva = nuovi.filter(r => r.piva).length, pivaOk = nuovi.filter(r => pivaValida(r.piva)).length;
      out.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(2,1fr)">
        <div class="kpi"><div><b class="num">${nuovi.length}</b><span>Contatti nuovi da importare</span></div></div>
        <div class="kpi"><div><b class="num">${doppi}</b><span>Già in rubrica (saltati)</span></div></div></div>
        <p class="muted" style="margin-top:10px">${nuovi.filter(r => r.ditta).length} con il nome della ditta, ${piva} con partita IVA (${pivaOk} valide), ${nuovi.filter(r => r.categoria).length} con il mestiere. ${esclusi ? esclusi + ' segnati come interni: entrano come "Escluso".' : ''}</p>
        <div class="tw" style="margin-top:10px;max-height:260px;overflow:auto"><table class="t"><tbody>${nuovi.slice(0, 50).map(r => `<tr><td>${esc(r.nome_rubrica)}</td><td class="muted">${esc(r.categoria || '')}</td><td>${pill(r.stato, STATI)}</td></tr>`).join('')}</tbody></table></div>`;
      $('#im-vai', d).disabled = !nuovi.length; $('#im-vai', d).textContent = nuovi.length ? `Importa ${nuovi.length} contatti` : 'Niente da importare';
    };
    $('#im-vai', d).onclick = async () => {
      const b = $('#im-vai', d); b.disabled = true; b.textContent = 'Importo...';
      for (let i = 0; i < nuovi.length; i += 100) {
        const { error } = await sb.from('artigiani').insert(nuovi.slice(i, i + 100));
        if (error) { console.error(error); toast('Importazione interrotta: ' + (error.message || 'errore')); b.disabled = false; b.textContent = 'Riprova'; await carica(); disegna(); return; }
      }
      await carica(); closeDrawer(); filtro = 'aperti'; disegna(); toast(`Importati ${nuovi.length} contatti`);
    };
  });
}

/* ---------- aggancio all'area riservata ---------- */
A.ROUTES['admin/artigiani'] = el => { pagina(el); };
window.EM_ART = { daChiamare: () => artigiani.filter(a => a.stato === 'da_chiamare' || a.stato === 'richiamare').length, pivaValida };
})();
