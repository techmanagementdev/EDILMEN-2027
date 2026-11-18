/* Banner dei cookie e preferenze (linee guida del Garante privacy, 10/06/2021).
   - Senza una scelta non parte niente oltre ai cookie tecnici: le statistiche (Google Analytics 4) si caricano solo dopo "Accetta".
   - "Rifiuta" e la X hanno lo stesso peso di "Accetta"; la scelta vale 6 mesi, poi si richiede.
   - Il link "Preferenze cookie" (attributo data-cookie) riapre il pannello da qualsiasi pagina.
   Per attivare le statistiche basta scrivere l'ID di misurazione GA4 in GA_ID.
   Marketing (Meta Pixel): compare nel banner e parte solo se META_PIXEL_ID è scritto qui sotto E l'utente accetta il marketing.
   Prima di attivarlo aggiornare cookie.html (sezione marketing) e privacy.html. */
(function () {
'use strict';
var GA_ID = 'G-VYB0GXZWQZ';         // proprietà "EdilMen - www.edilmen.it" (account Analytics "EdilMen", creato il 12/10/2026)
var META_PIXEL_ID = '';                // ID del dataset/pixel Meta di EdilMen: vuoto = marketing spento e non proposto
var CHIAVE = 'edilmen-consenso', VERSIONE = 1, DURATA = 182 * 24 * 3600 * 1000;

function leggi() {
  try { var c = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (c && c.v === VERSIONE && Date.now() - c.t < DURATA) return c; } catch (e) {}
  return null;
}
function salva(statistiche, marketing) {
  var c = { v: VERSIONE, t: Date.now(), statistiche: !!statistiche, marketing: !!(marketing && META_PIXEL_ID) };
  try { localStorage.setItem(CHIAVE, JSON.stringify(c)); } catch (e) {}
  applica(c); chiudi();
  if ((!statistiche && window.EM_GA_CARICATO) || (!c.marketing && window.EM_META_CARICATO)) location.reload(); // revoca: si ricarica senza
}
// Meta Pixel (solo con consenso marketing): visita della pagina e richieste inviate (Lead, con lo stesso codice usato dal server per non contarle due volte)
function applicaMarketing(c) {
  if (!c || !c.marketing || !META_PIXEL_ID || window.EM_META_CARICATO) return;
  window.EM_META_CARICATO = true;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
}
function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
function applica(c) {
  applicaMarketing(c);
  if (!c || !c.statistiche || !GA_ID || window.EM_GA_CARICATO) return;
  window.EM_GA_CARICATO = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);
}

var CSS = '#em-ck{position:fixed;z-index:2147483000;left:16px;bottom:16px;max-width:440px;background:#fff;color:#10204A;border:1px solid #E1E7F5;border-radius:16px;box-shadow:0 20px 50px -20px rgba(16,32,74,.45);padding:18px 18px 16px;font:15px/1.5 Figtree,system-ui,sans-serif}' +
  '#em-ck h2{font:600 1.15rem/1.2 Newsreader,Georgia,serif;margin:0 28px 6px 0}#em-ck p{margin:0 0 12px;color:#3A4A73;font-size:.9rem}#em-ck a{color:#1447E6}' +
  '#em-ck .x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;background:none;font-size:22px;line-height:1;color:#63719A;cursor:pointer;border-radius:8px}' +
  '#em-ck .b{display:flex;gap:8px;flex-wrap:wrap}#em-ck button.k{flex:1;min-width:110px;min-height:42px;border-radius:10px;font:600 .92rem Figtree,system-ui,sans-serif;cursor:pointer;border:1.5px solid #1447E6;background:#fff;color:#1447E6;padding:8px 12px}' +
  '#em-ck button.k.p{background:#1447E6;color:#fff}#em-ck label{display:flex;gap:10px;align-items:flex-start;margin:0 0 10px;font-size:.9rem}#em-ck label input{margin-top:4px;width:auto}#em-ck label small{display:block;color:#63719A}' +
  '@media (max-width:520px){#em-ck{left:8px;right:8px;bottom:8px;max-width:none}}';

function apri(dettaglio) {
  chiudi();
  if (!document.getElementById('em-ck-css')) { var st = document.createElement('style'); st.id = 'em-ck-css'; st.textContent = CSS; document.head.appendChild(st); }
  var c = leggi(), d = document.createElement('div');
  d.id = 'em-ck'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'em-ck-t');
  d.innerHTML = '<button type="button" class="x" data-ck="rifiuta" aria-label="Chiudi e rifiuta i cookie non necessari">×</button>' +
    '<h2 id="em-ck-t">Cookie e privacy</h2>' +
    (dettaglio
      ? '<label><input type="checkbox" checked disabled> <span><b>Tecnici</b><small>Servono a far funzionare il sito e a ricordare le tue scelte. Sempre attivi.</small></span></label>' +
        '<label><input type="checkbox" id="em-ck-s"' + (c && c.statistiche ? ' checked' : '') + '> <span><b>Statistiche</b><small>Google Analytics, per capire quali pagine sono utili. Dati aggregati.</small></span></label>' +
        (META_PIXEL_ID ? '<label><input type="checkbox" id="em-ck-m"' + (c && c.marketing ? ' checked' : '') + '> <span><b>Marketing</b><small>Meta (Facebook e Instagram), per misurare le nostre pubblicità e mostrarle a chi è interessato.</small></span></label>' : '') +
        '<div class="b"><button type="button" class="k" data-ck="rifiuta">Rifiuta tutti</button><button type="button" class="k p" data-ck="salva">Salva le scelte</button></div>'
      : '<p>Usiamo cookie tecnici, necessari al sito, e, solo se accetti, cookie statistici per migliorare le pagine' + (META_PIXEL_ID ? ' e di marketing per misurare le nostre pubblicità su Facebook e Instagram' : '. Niente pubblicità') + '. Dettagli nella <a href="/cookie">cookie policy</a> e nell\'<a href="/privacy">informativa privacy</a>.</p>' +
        '<div class="b"><button type="button" class="k" data-ck="rifiuta">Rifiuta</button><button type="button" class="k" data-ck="dettaglio">Personalizza</button><button type="button" class="k p" data-ck="accetta">Accetta</button></div>');
  d.addEventListener('click', function (e) {
    var a = e.target.closest('[data-ck]'); if (!a) return;
    var k = a.getAttribute('data-ck');
    if (k === 'accetta') salva(true, true); else if (k === 'rifiuta') salva(false, false); else if (k === 'dettaglio') apri(true);
    else if (k === 'salva') { var m = document.getElementById('em-ck-m'); salva(document.getElementById('em-ck-s').checked, m && m.checked); }
  });
  document.body.appendChild(d);
  var f = d.querySelector('button.k.p'); if (f && dettaglio) f.focus();
}
function chiudi() { var d = document.getElementById('em-ck'); if (d) d.remove(); }

window.EM_COOKIE = { apri: function () { apri(true); }, consenso: leggi };
// dati per l'invio lato server a Meta (Conversions API): solo con consenso marketing; mai nome, telefono o email
window.EM_META = { dati: function () { var c = leggi(); if (!c || !c.marketing || !META_PIXEL_ID) return null; return { fbp: cookie('_fbp'), fbc: cookie('_fbc'), url: location.href.split('#')[0] }; } };
// Eventi del sito (quotazione, incontro prenotato, vocale...) verso Google Analytics, solo se l'utente ha accettato le statistiche.
// I contatti del cliente non partono mai: solo nome dell'evento, passo e codice richiesta.
var CONVERSIONI = { appuntamento_prenotato: 1, contatto_inviato: 1, vocale_inviato: 1 };
window.addEventListener('em:evento', function (e) {
  if (window.EM_META_CARICATO && window.fbq && e.detail && CONVERSIONI[e.detail.nome]) {
    var cod = e.detail.dati && e.detail.dati.codice;
    window.fbq('track', 'Lead', { content_name: e.detail.nome }, cod ? { eventID: String(cod) } : undefined);
  }
  if (!window.EM_GA_CARICATO || !window.gtag || !e.detail) return;
  var d = e.detail, p = {};
  ['step', 'schermata', 'da', 'tipo', 'origine'].forEach(function (k) { if (d.dati && d.dati[k] != null) p[k] = d.dati[k]; });
  window.gtag('event', d.nome, p);
  if (CONVERSIONI[d.nome]) window.gtag('event', 'generate_lead', { metodo: d.nome });
});
document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-cookie]'); if (a) { e.preventDefault(); apri(true); } });
function avvia() { var c = leggi(); if (c) applica(c); else apri(false); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
