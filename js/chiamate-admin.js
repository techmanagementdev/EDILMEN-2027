/* Gestionale EdilMen: "Centralino" (#/admin/chiamate).
   Controllo della campagna di chiamate alle imprese: quante in coda, esiti, lavoro di ogni centralinista, imprese interessate e iscritte,
   previsione delle adesioni (Start, Pro, Premium) e dei lavori che le imprese chiuderanno grazie alle schede. I parametri della previsione
   stanno in impostazioni.previsione e li usa anche il simulatore di centralino.html. Tabelle in supabase/migrations/0012_centralino.sql. */
(function () {
'use strict';
const A = window.EM_APP, G = window.EM_GEST, L = window.EM_LISTINO;
if (!A || !G || !G.sb) return;
const { $, $$, esc, ic, toast } = A;
const sb = G.sb;

const STATI = { da_chiamare: ['Da chiamare', 'blue'], richiamare: ['Da richiamare', 'amber'], interessata: ['Interessata', 'violet'], start: ['Start', 'green'],
  pro: ['Pro', 'green'], premium: ['Premium', 'green'], non_interessata: ['Non interessata', 'gray'], non_risponde: ['Non risponde (5 tentativi)', 'gray'],
  numero_errato: ['Numero sbagliato', 'gray'], non_chiamare: ['Non chiamare più', 'red'] };
const REG = { taa: 'Trentino-Alto Adige', ven: 'Veneto', fvg: 'Friuli-Venezia Giulia' };
const eur = n => Math.round(n || 0).toLocaleString('it-IT') + ' €';
const num = n => Math.round(n || 0).toLocaleString('it-IT');
const quando = iso => (iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

async function tutte(tabella, campi, filtro = q => q) {
  const out = [];
  for (let da = 0; da < 50000; da += 1000) {
    const { data, error } = await filtro(sb.from(tabella).select(campi)).range(da, da + 999);
    if (error) throw error;
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}

async function pagina(el) {
  el.innerHTML = `<div class="ph"><div><h1>Centralino</h1><p>Le chiamate alle imprese del catalogo per portarle nella rete: si parte da Start gratuito, poi Pro e Premium. I centralinisti lavorano da <a class="link" href="/centralino" target="_blank" rel="noopener">edilmen.it/centralino</a>.</p></div>
    <div class="gs-azioni"><button class="btn btn-ghost" id="ch-agg">Aggiorna</button></div></div><div id="ch-corpo"><div class="card"><div class="card-b muted">Carico...</div></div></div>`;
  $('#ch-agg').onclick = () => pagina(el);
  let righe, diario, operatori, param;
  try {
    [righe, diario, operatori, param] = await Promise.all([
      tutte('chiamate_imprese', 'azienda_id,stato,operatore,tentativi,ultima_chiamata,richiamare_il,referente,note,aziende(nome,comune,provincia,regione,telefono,slug)'),
      tutte('chiamate_diario', 'esito,operatore,creato_il', q => q.gte('creato_il', new Date(Date.now() - 30 * 86400000).toISOString()).order('creato_il', { ascending: false })),
      sb.from('profili').select('id,nome,ruolo').in('ruolo', ['operatore', 'admin']).then(r => r.data || []),
      sb.from('impostazioni').select('valore').eq('chiave', 'previsione').maybeSingle().then(r => (r.data && r.data.valore) || null),
    ]);
  } catch (e) {
    console.error(e);
    $('#ch-corpo').innerHTML = `<div class="card"><div class="card-b"><b>Il centralino non è ancora nel database.</b><p class="muted" style="margin-top:6px">Va caricata una volta la migrazione <code>supabase/migrations/0012_centralino.sql</code> dall'SQL Editor di Supabase.</p></div></div>`;
    return;
  }
  const conta = k => righe.filter(r => r.stato === k).length;
  const nomeOp = id => (operatori.find(o => o.id === id) || {}).nome || 'Senza nome';
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const sett = new Date(Date.now() - 7 * 86400000);
  const perOp = {};
  diario.filter(d => d.esito !== 'nota').forEach(d => {
    const o = perOp[d.operatore] = perOp[d.operatore] || { oggi: 0, sett: 0, mese: 0, interessate: 0, adesioni: 0 };
    const t = new Date(d.creato_il);
    o.mese++; if (t >= sett) o.sett++; if (t >= oggi) o.oggi++;
    if (d.esito === 'interessata') o.interessate++; if (['start', 'pro', 'premium'].includes(d.esito)) o.adesioni++;
  });
  const conTel = righe.filter(r => r.aziende && r.aziende.telefono).length;
  const regioni = Object.keys(REG).map(k => [k, righe.filter(r => r.aziende && r.aziende.regione === k).length]);
  const calde = righe.filter(r => ['interessata', 'start', 'pro', 'premium'].includes(r.stato)).sort((a, b) => String(b.ultima_chiamata).localeCompare(String(a.ultima_chiamata)));

  $('#ch-corpo').innerHTML = `<div class="kpis">
      <div class="kpi"><span class="ico">${ic('users')}</span><div><b class="num">${num(conta('da_chiamare') + conta('richiamare'))}</b><span>Imprese da chiamare (${num(conTel)} con telefono)</span></div></div>
      <div class="kpi"><span class="ico">${ic('clock')}</span><div><b class="num">${num(diario.filter(d => d.esito !== 'nota' && new Date(d.creato_il) >= oggi).length)}</b><span>Chiamate oggi</span></div></div>
      <div class="kpi"><span class="ico">${ic('star')}</span><div><b class="num">${conta('interessata')}</b><span>Interessate</span></div></div>
      <div class="kpi"><span class="ico">${ic('check')}</span><div><b class="num">${conta('start') + conta('pro') + conta('premium')}</b><span>Adesioni (${conta('pro')} Pro, ${conta('premium')} Premium)</span></div></div></div>

    <div class="card" style="margin-top:18px"><div class="card-h"><h2>Esiti</h2></div><div class="card-b" style="display:flex;gap:10px;flex-wrap:wrap">
      ${Object.entries(STATI).map(([k, [l, c]]) => `<span class="pill ${c}">${l}: ${num(conta(k))}</span>`).join('')}</div>
      <div class="card-b" style="border-top:1px solid var(--line)"><b>In coda per regione:</b> ${regioni.map(([k, n]) => `${REG[k]} ${num(n)}`).join(', ')}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${Object.entries(REG).map(([k, l]) => `<button class="btn btn-ghost" data-reg="${k}">Metti in coda: ${l}</button>`).join('')}</div>
        <p class="muted" style="margin-top:8px">Entrano le schede pubblicate non ancora nella rete. Prima quelle con telefono, poi le iscritte nella white list, poi con SOA. Chi ha chiesto di non essere chiamato non rientra mai.</p></div></div>

    <div class="card" style="margin-top:18px"><div class="card-h"><h2>Centralinisti</h2></div><div class="tw"><table class="t"><thead><tr><th>Operatore</th><th>Oggi</th><th>7 giorni</th><th>30 giorni</th><th>Interessate</th><th>Adesioni</th><th>Coda</th></tr></thead><tbody>
      ${Object.keys(perOp).length || righe.some(r => r.operatore) || operatori.some(o => o.ruolo === 'operatore') ? [...new Set([...operatori.filter(o => o.ruolo === 'operatore').map(o => o.id), ...Object.keys(perOp), ...righe.map(r => r.operatore).filter(Boolean)])].map(id => { const o = perOp[id] || {};
        return `<tr><td><b>${esc(nomeOp(id))}</b></td><td>${o.oggi || 0}</td><td>${o.sett || 0}</td><td>${o.mese || 0}</td><td>${o.interessate || 0}</td><td>${o.adesioni || 0}</td><td>${righe.filter(r => r.operatore === id && ['da_chiamare', 'richiamare', 'interessata'].includes(r.stato)).length}${righe.some(r => r.operatore === id && r.stato === 'da_chiamare') ? ` <button class="btn btn-ghost" style="padding:4px 10px;font-size:.85rem" data-libera="${id}">Rimetti in coda le non chiamate</button>` : ''}</td></tr>`; }).join('')
        : '<tr><td colspan="7" class="muted" style="padding:20px">Nessun centralinista ancora. Si crea invitandolo da Supabase (Authentication, Invite) con la riga in profili e ruolo "operatore".</td></tr>'}
      </tbody></table></div></div>

    <div class="card" style="margin-top:18px"><div class="card-h"><h2>Imprese interessate e iscritte</h2></div><div class="tw"><table class="t"><thead><tr><th>Impresa</th><th>Stato</th><th>Referente</th><th>Operatore</th><th>Ultima chiamata</th><th>Nota</th></tr></thead><tbody>
      ${calde.slice(0, 200).map(r => `<tr><td><b>${esc(r.aziende ? r.aziende.nome : '')}</b><br><small class="muted">${esc(r.aziende ? (r.aziende.comune || '') + (r.aziende.provincia ? ' (' + r.aziende.provincia + ')' : '') : '')}${r.aziende && r.aziende.telefono ? ', ' + esc(r.aziende.telefono) : ''}</small></td>
        <td><span class="pill ${STATI[r.stato][1]}">${STATI[r.stato][0]}</span>${r.richiamare_il ? `<br><small class="muted">richiamare ${quando(r.richiamare_il)}</small>` : ''}</td><td>${esc(r.referente || '')}</td><td>${esc(r.operatore ? nomeOp(r.operatore) : '')}</td>
        <td><small>${quando(r.ultima_chiamata)}</small></td><td><small>${esc(r.note || '')}</small></td></tr>`).join('') || '<tr><td colspan="6" class="muted" style="padding:20px">Ancora nessuna.</td></tr>'}
      </tbody></table></div></div>

    <div class="card" style="margin-top:18px" id="ch-prev"></div>`;
  A.paintIcons($('#ch-corpo'));
  $$('[data-reg]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data, error } = await sb.rpc('centralino_aggiungi', { p_regione: b.dataset.reg });
    if (error) { console.error(error); b.disabled = false; return toast('Non sono riuscito a mettere in coda'); }
    toast(`${data} imprese messe in coda`); pagina(el);
  });
  // le imprese assegnate e mai chiamate tornano libere per gli altri centralinisti (es. dopo una prova dell'amministrazione)
  $$('[data-libera]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { error } = await sb.from('chiamate_imprese').update({ operatore: null }).eq('operatore', b.dataset.libera).eq('stato', 'da_chiamare');
    if (error) { console.error(error); b.disabled = false; return toast('Non sono riuscito a rimetterle in coda'); }
    toast('Imprese rimesse in coda'); pagina(el);
  });
  previsione($('#ch-prev'), param, conta('da_chiamare') + conta('richiamare'), conta('start') + conta('pro') + conta('premium'));
}

/* ---------- previsione ---------- */
// valore medio di un lavoro: media dei 12 lavori più cercati, scenario tipico, prezzo intermedio prudente, base Trento
function valoreMedio() {
  if (!L) return 0;
  const cod = ['R01', 'R03', 'R04', 'R05', 'R06', 'R07', 'R10', 'R13', 'R16', 'R17', 'R31', 'N01'];
  const v = cod.map(c => L.pacchetti.find(p => p.c === c)).filter(Boolean).map(p => p.p[1] * (1 + p.acc) * p.qrif);
  return v.reduce((s, x) => s + x, 0) / (v.length || 1);
}
const CAMPI = [
  ['risposta', 'Imprese che rispondono', '%'], ['interesse', 'Interessate tra chi risponde', '%'], ['start_su_interessate', 'Aderiscono a Start tra le interessate', '%'],
  ['pro_su_start', 'Passano a Pro tra le Start', '%'], ['premium_su_start', 'Passano a Premium tra le Start', '%'], ['chiusura', 'Lavori presi dopo il sopralluogo', '%'],
  ['fee', 'Fee EdilMen sui lavori', '%'], ['rm_start', 'Richieste al mese, Start', 'n'], ['rm_pro', 'Richieste al mese, Pro', 'n'], ['rm_premium', 'Richieste al mese, Premium', 'n'],
];
// giorni lavorativi (lun-ven, senza le feste nazionali) tra due date
const FESTE = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];
function lavorativi(da, a) {
  let n = 0; const d = new Date(da);
  while (d < a) { const g = d.getDay(), k = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (g && g < 6 && !FESTE.includes(k)) n++; d.setDate(d.getDate() + 1); }
  return n;
}
// mese per mese dall'inizio delle chiamate: imprese chiamate, adesioni, abbonamenti (Pro e Premium dal mese dopo l'adesione a Start), lavori e fee
function calendario(P, inCoda, aderenti, vm) {
  const inizio = new Date((P.inizio || '2026-10-20') + 'T00:00:00'), perGiorno = (P.operatori || 2) * (P.chiamate_giorno || 50) / Math.max(1, P.tentativi_medi || 2);
  const mesi = []; let resta = inCoda, startCum = aderenti;
  for (let i = 0; i < 6; i++) {
    const da = i ? new Date(inizio.getFullYear(), inizio.getMonth() + i, 1) : inizio, a = new Date(inizio.getFullYear(), inizio.getMonth() + i + 1, 1);
    const giorni = lavorativi(da, a), chiamate = Math.min(resta, perGiorno * giorni); resta -= chiamate;
    const prima = startCum, nuove = chiamate * P.risposta * P.interesse * P.start_su_interessate; startCum += nuove;
    const pro = prima * P.pro_su_start, prem = prima * P.premium_su_start, base = startCum - pro - prem;
    const lavori = (base * P.richieste_mese.start + pro * P.richieste_mese.pro + prem * P.richieste_mese.premium) * P.chiusura * (i ? 1 : 0.5);
    mesi.push({ mese: da.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), giorni, chiamate, nuove, startCum, pro, prem,
      mrr: pro * P.prezzo_mese.pro + prem * P.prezzo_mese.premium, lavori, fee: lavori * vm * P.fee });
  }
  const fine = perGiorno > 0 ? (() => { let n = Math.ceil(inCoda / perGiorno); const d = new Date(inizio); while (n > 0) { d.setDate(d.getDate() + 1); if (lavorativi(new Date(d.getTime() - 86400000), d)) n--; } return d; })() : null;
  return { mesi, perGiorno, fine };
}
function previsione(box, P, inCoda, aderenti) {
  if (!P) { box.innerHTML = '<div class="card-b muted">Parametri della previsione non trovati.</div>'; return; }
  P.inizio = P.inizio || '2026-10-20'; P.operatori = P.operatori || 2; P.chiamate_giorno = P.chiamate_giorno || 50; P.tentativi_medi = P.tentativi_medi || 2;
  const val = k => k.startsWith('rm_') ? P.richieste_mese[k.slice(3)] : P[k];
  const disegna = () => {
    const risp = inCoda * P.risposta, inter = risp * P.interesse, start = inter * P.start_su_interessate + aderenti;
    const pro = start * P.pro_su_start, prem = start * P.premium_su_start, base = start - pro - prem;
    const mrr = pro * P.prezzo_mese.pro + prem * P.prezzo_mese.premium;
    const lavori = (base * P.richieste_mese.start + pro * P.richieste_mese.pro + prem * P.richieste_mese.premium) * 12 * P.chiusura;
    const vm = valoreMedio(), giro = lavori * vm, fee = giro * P.fee;
    $('#pv-ris', box).innerHTML = `<div class="kpis">
      <div class="kpi"><div><b class="num">${num(start)}</b><span>Imprese in Start a fine campagna</span></div></div>
      <div class="kpi"><div><b class="num">${num(pro)} + ${num(prem)}</b><span>Abbonamenti Pro + Premium</span></div></div>
      <div class="kpi"><div><b class="num">${eur(mrr)}</b><span>Abbonamenti al mese (${eur(mrr * 12)} l'anno)</span></div></div>
      <div class="kpi"><div><b class="num">${num(lavori)}</b><span>Lavori chiusi dalle imprese in un anno grazie alle schede</span></div></div>
      <div class="kpi"><div><b class="num">${eur(giro)}</b><span>Valore di quei lavori (media ${eur(vm)} a lavoro)</span></div></div>
      <div class="kpi"><div><b class="num">${eur(fee)}</b><span>Fee EdilMen in un anno</span></div></div></div>
      ${(() => { const c = calendario(P, inCoda, aderenti, vm); return `<h3 style="margin-top:18px">Mese per mese, dal ${new Date(P.inizio + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
      <p class="muted" style="margin-top:4px">${P.operatori} centralinisti, ${P.chiamate_giorno} chiamate al giorno a testa, in media ${P.tentativi_medi} chiamate per impresa: circa ${num(c.perGiorno)} imprese al giorno. Le ${num(inCoda)} imprese in coda sono finite verso il <b>${c.fine ? c.fine.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '-'}</b>.</p>
      <div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th>Mese</th><th>Giorni</th><th>Imprese chiamate</th><th>Nuove Start</th><th>Start totali</th><th>Pro + Premium</th><th>Abbonamenti al mese</th><th>Lavori chiusi dalle imprese</th><th>Fee EdilMen</th></tr></thead><tbody>
      ${c.mesi.map(m => `<tr><td>${m.mese}</td><td>${m.giorni}</td><td>${num(m.chiamate)}</td><td>${num(m.nuove)}</td><td>${num(m.startCum)}</td><td>${num(m.pro)} + ${num(m.prem)}</td><td>${eur(m.mrr)}</td><td>${num(m.lavori)}</td><td>${eur(m.fee)}</td></tr>`).join('')}
      <tr><td><b>Totale 6 mesi</b></td><td></td><td><b>${num(c.mesi.reduce((x, m) => x + m.chiamate, 0))}</b></td><td><b>${num(c.mesi.reduce((x, m) => x + m.nuove, 0))}</b></td><td></td><td></td><td><b>${eur(c.mesi.reduce((x, m) => x + m.mrr, 0))}</b></td><td><b>${num(c.mesi.reduce((x, m) => x + m.lavori, 0))}</b></td><td><b>${eur(c.mesi.reduce((x, m) => x + m.fee, 0))}</b></td></tr>
      </tbody></table></div>
      <p class="muted" style="margin-top:6px">Pro e Premium contano dal mese dopo l'adesione a Start. Nel primo mese i lavori sono dimezzati (le imprese hanno appena aderito). Solo le imprese già in coda: aggiungendo Veneto e Friuli i numeri salgono.</p>`; })()}
      <p class="muted" style="margin-top:10px">Su ${num(inCoda)} imprese ancora da chiamare: ${num(risp)} rispondono, ${num(inter)} interessate. Le ${num(aderenti)} adesioni già fatte sono incluse. Valore del lavoro dal listino EdilMen (prezzo intermedio, base Trento, IVA esclusa).</p>`;
  };
  box.innerHTML = `<div class="card-h"><h2>Previsione</h2></div><div class="card-b">
    ${P.confermati ? '' : '<p class="muted" style="background:#FFF3DC;color:#6B4200;padding:10px 12px;border-radius:10px">Ipotesi iniziali da confermare: cambiale qui sotto con i numeri veri appena li avete, poi spunta "Confermati". Gli stessi parametri li usa il simulatore dei centralinisti.</p>'}
    <div id="pv-ris" style="margin-top:12px"></div>
    <details style="margin-top:14px"><summary><b>Parametri</b></summary>
      <div class="grid2b" style="gap:10px;margin-top:10px">${CAMPI.map(([k, l, t]) => `<label class="fld"><span>${l}${t === '%' ? ' (%)' : ''}</span><input class="inp" type="number" step="${t === '%' ? '1' : '0.5'}" min="0" data-pv="${k}" value="${t === '%' ? Math.round(val(k) * 1000) / 10 : val(k)}"></label>`).join('')}
        <label class="fld"><span>Inizio delle chiamate</span><input class="inp" type="date" data-cal="inizio" value="${P.inizio}"></label>
        <label class="fld"><span>Centralinisti</span><input class="inp" type="number" min="1" data-cal="operatori" value="${P.operatori}"></label>
        <label class="fld"><span>Chiamate al giorno per centralinista</span><input class="inp" type="number" min="1" data-cal="chiamate_giorno" value="${P.chiamate_giorno}"></label>
        <label class="fld"><span>Chiamate in media per impresa</span><input class="inp" type="number" min="1" step="0.5" data-cal="tentativi_medi" value="${P.tentativi_medi}"></label>
        <label class="fld"><span>Prezzo Pro al mese (€)</span><input class="inp" type="number" data-pz="pro" value="${P.prezzo_mese.pro}"></label>
        <label class="fld"><span>Prezzo Premium al mese (€)</span><input class="inp" type="number" data-pz="premium" value="${P.prezzo_mese.premium}"></label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pv-conf" ${P.confermati ? 'checked' : ''}> Confermati dal cliente</label></div>
      <button class="btn btn-blue" id="pv-salva" style="margin-top:12px">Salva i parametri</button></details></div>`;
  const leggi = () => {
    $$('[data-pv]', box).forEach(i => { const k = i.dataset.pv, t = CAMPI.find(c => c[0] === k)[2], v = Math.max(0, parseFloat(i.value) || 0);
      if (k.startsWith('rm_')) P.richieste_mese[k.slice(3)] = v; else P[k] = t === '%' ? v / 100 : v; });
    $$('[data-pz]', box).forEach(i => { P.prezzo_mese[i.dataset.pz] = Math.max(0, parseFloat(i.value) || 0); });
    $$('[data-cal]', box).forEach(i => { const k = i.dataset.cal; P[k] = k === 'inizio' ? (i.value || '2026-10-20') : Math.max(1, parseFloat(i.value) || 1); });
    P.confermati = $('#pv-conf', box).checked;
  };
  $$('input', box).forEach(i => i.oninput = () => { leggi(); disegna(); });
  $('#pv-salva', box).onclick = async () => {
    leggi();
    const { error } = await sb.from('impostazioni').update({ valore: P }).eq('chiave', 'previsione');
    toast(error ? 'Non sono riuscito a salvare' : 'Parametri salvati');
  };
  disegna();
}

A.ROUTES['admin/chiamate'] = el => { pagina(el); };
})();
