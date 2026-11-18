/* L'omino EdilMen ogni tanto attraversa lo schermo in volo, orizzontale come Superman (dal 15/10/2026, richiesta dell'utente:
   "deve volare come Superman, non in verticale"; prima camminava sul fondo o sbucava in piedi da un lato).
   - Parte solo dopo che il visitatore ha scorso un bel pezzo di pagina, al massimo ogni 25 secondi e 3 volte per pagina, con un po' di caso.
   - Vola da un lato all'altro a un'altezza a caso, con una leggera onda; guarda sempre nella direzione in cui va.
   - Toccandolo si apre il preventivo. Niente animazioni per chi ha chiesto movimenti ridotti. */
(function () {
'use strict';
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
var IMG = '/img/omino-volo.webp', MAX = 3, PAUSA = 25000, SCROLL = 900;
var fatti = 0, ultimo = Date.now(), scorso = 0, yPrima = window.scrollY, attivo = false;
var FRASI = ['Ti serve un prezzo? Toccami!', 'Il sopralluogo è gratis!', 'Prezzi veri, imprese verificate.', 'Ci penso io a trovare l\'impresa giusta.'];

var CSS = '.nv-p{position:fixed;left:0;z-index:2147482000;width:clamp(150px,17vw,240px);cursor:pointer;border:0;padding:0;background:none;will-change:transform}' +
  '.nv-p .nv-c{display:block}.nv-p img{width:100%;height:auto;display:block;filter:drop-shadow(0 18px 16px rgba(16,32,74,.22));animation:nv-onda 1.6s ease-in-out infinite alternate}' +
  '@keyframes nv-onda{from{transform:translateY(-6px) rotate(-2deg)}to{transform:translateY(6px) rotate(2deg)}}' +
  '.nv-p .nv-f{position:absolute;bottom:88%;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;color:#10204A;border:1px solid #E1E7F5;border-radius:12px;padding:6px 10px;font:600 13px/1.3 Figtree,system-ui,sans-serif;box-shadow:0 10px 24px -14px rgba(16,32,74,.5);opacity:0;transition:opacity .3s}' +
  '.nv-p.parla .nv-f{opacity:1}';

function prepara() {
  if (document.getElementById('nv-css')) return;
  var s = document.createElement('style'); s.id = 'nv-css'; s.textContent = CSS; document.head.appendChild(s);
  var p = new Image(); p.src = IMG;
}
function crea() {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'nv-p'; b.setAttribute('aria-label', 'EdilMen: calcola il prezzo del tuo lavoro');
  b.innerHTML = '<span class="nv-f">' + FRASI[Math.floor(Math.random() * FRASI.length)] + '</span><span class="nv-c"><img src="' + IMG + '" alt=""></span>';
  b.addEventListener('click', function () {
    var s = document.querySelector('[data-start]');   // in home apre il preventivo senza cambiare pagina
    if (s) s.click(); else location.href = '/#preventivo';
  });
  document.body.appendChild(b);
  return b;
}

// vola da un lato all'altro, con una leggera salita e discesa
function vola() {
  var b = crea(), daSx = Math.random() < 0.5, w = window.innerWidth, h = window.innerHeight;
  var y = Math.round(h * (0.18 + Math.random() * 0.42)), fuori = 280;
  b.style.top = y + 'px';
  if (!daSx) b.querySelector('.nv-c').style.transform = 'scaleX(-1)';   // l'immagine guarda a destra: girata se va a sinistra
  var da = daSx ? -fuori : w + 20, a = daSx ? w + 20 : -fuori, su = -Math.round(h * 0.06);
  setTimeout(function () { b.classList.add('parla'); }, 1300);
  setTimeout(function () { b.classList.remove('parla'); }, 3900);
  var anim = b.animate([
    { transform: 'translate(' + da + 'px,0)' },
    { transform: 'translate(' + (da + (a - da) * 0.5) + 'px,' + su + 'px)', offset: 0.5 },
    { transform: 'translate(' + a + 'px,0)' }
  ], { duration: Math.max(5200, w * 4.5), easing: 'ease-in-out' });
  anim.onfinish = function () { b.remove(); attivo = false; };
}

window.addEventListener('scroll', function () {
  var y = window.scrollY; scorso += Math.abs(y - yPrima); yPrima = y;
  if (attivo || fatti >= MAX || scorso < SCROLL || Date.now() - ultimo < PAUSA) return;
  if (document.querySelector('#em-ck, dialog[open], body.wz-open')) return;   // non disturba banner cookie, finestre e preventivo
  if (Math.random() > 0.35) { scorso = SCROLL * 0.6; return; }                   // un po' di caso
  attivo = true; fatti++; ultimo = Date.now(); scorso = 0; prepara();
  vola();
}, { passive: true });
})();
