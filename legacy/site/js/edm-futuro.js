/* EdilMen · strato "futuro" (26/11/2026): portale al neon con vortice, comparse, luce sulle schede, barra di avanzamento.
   Leggero: un solo canvas per pagina, 30 fps, si ferma quando non è visibile o con "riduci movimento". */
(function () {
  'use strict';
  var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var d = document;

  function pronto(fn) { if (d.readyState !== 'loading') fn(); else d.addEventListener('DOMContentLoaded', fn); }

  /* ---------- portale: anello al neon + vortice ---------- */
  function portale(box, opz) {
    var c = d.createElement('canvas'); c.className = 'fx-canvas'; c.setAttribute('aria-hidden', 'true');
    box.insertBefore(c, box.firstChild);
    var x = c.getContext('2d'), w = 0, h = 0, dpr = Math.min(1.5, window.devicePixelRatio || 1), t0 = performance.now(), vis = true, ultimo = 0;
    function misura() { var r = box.getBoundingClientRect(); w = r.width; h = r.height; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); x.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function disegna(ora) {
      var t = (ora - t0) / 1000;
      x.clearRect(0, 0, w, h);
      var mobile = w < 900;
      var cx = mobile ? w * 0.5 : w * (opz.x || 0.72), cy = mobile ? h * 0.78 : h * (opz.y || 0.5);
      var R = Math.min(mobile ? w * 0.62 : h * (opz.r || 0.4), mobile ? 320 : 360);
      // vortice: spirali che ruotano
      x.save(); x.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 7; k++) {
        var a0 = t * (0.18 + k * 0.03) + k * 0.9;
        x.beginPath();
        for (var i = 0; i <= 120; i++) {
          var p = i / 120, ang = a0 + p * 5.2, rr = R * 0.92 * (1 - p * 0.85);
          var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.92;
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        var g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        g.addColorStop(0, 'rgba(0,150,214,' + (0.10 + k * 0.012) + ')'); g.addColorStop(1, 'rgba(41,160,78,' + (0.07 + k * 0.01) + ')');
        x.strokeStyle = g; x.lineWidth = 10 + k * 3; x.lineCap = 'round'; x.stroke();
      }
      // nucleo luminoso
      var n = x.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
      n.addColorStop(0, 'rgba(51,198,244,.22)'); n.addColorStop(0.55, 'rgba(0,90,200,.10)'); n.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = n; x.beginPath(); x.arc(cx, cy, R * 0.95, 0, Math.PI * 2); x.fill();
      x.restore();
      // anello al neon che respira
      var pul = 1 + Math.sin(t * 1.6) * 0.012;
      var ring = x.createLinearGradient(cx - R, cy, cx + R, cy);
      ring.addColorStop(0, '#33C6F4'); ring.addColorStop(0.5, '#BFF3FF'); ring.addColorStop(1, '#4FD88A');
      x.save(); x.globalCompositeOperation = 'lighter';
      [[26, 0.25, 10], [12, 0.55, 5], [0, 1, 2.6]].forEach(function (s) {
        x.shadowBlur = s[0]; x.shadowColor = '#1AA7FF'; x.globalAlpha = s[1]; x.strokeStyle = ring; x.lineWidth = s[2];
        x.beginPath(); x.arc(cx, cy, R * pul, 0, Math.PI * 2); x.stroke();
      });
      // scintilla che corre sull'anello
      var sa = t * 0.9, sx = cx + Math.cos(sa) * R * pul, sy = cy + Math.sin(sa) * R * pul;
      x.globalAlpha = 1; x.shadowBlur = 24; x.shadowColor = '#BFF3FF'; x.fillStyle = '#fff'; x.beginPath(); x.arc(sx, sy, 3.2, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    function ciclo(ora) {
      if (vis && ora - ultimo > 33) { ultimo = ora; disegna(ora); }
      if (!calmo) requestAnimationFrame(ciclo);
    }
    misura(); disegna(performance.now());
    window.addEventListener('resize', function () { misura(); disegna(performance.now()); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(box);
    if (!calmo) requestAnimationFrame(ciclo);
  }


  /* ---------- villa in costruzione: progetto che si disegna, vetrate che si accendono, gru che lavora ---------- */
  var VILLA = '<svg class="fx-villa" viewBox="0 0 440 270" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="fxg" x1="0" x2="1"><stop offset="0" stop-color="#33C6F4"/><stop offset="1" stop-color="#4FD88A"/></linearGradient>' +
    '<pattern id="fxp" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(120,190,255,.10)" stroke-width="1"/></pattern></defs>' +
    '<rect x="0" y="0" width="440" height="270" fill="url(#fxp)"/>' +
    // terreno e quote
    '<path class="d d1" pathLength="1" d="M10 232H430"/>' +
    '<path class="d d1 q" pathLength="1" d="M40 250H300M40 245V255M300 245V255"/>' +
    '<text class="t" x="150" y="264">12,40 m</text>' +
    // fondazioni
    '<path class="d d2" pathLength="1" d="M36 232V222H304V232"/>' +
    // piano terra
    '<path class="d d3" pathLength="1" d="M44 222V140H296V222"/>' +
    // piano a sbalzo
    '<path class="d d4" pathLength="1" d="M120 140V78H340V140H296"/>' +
    // tetto piano con aggetto
    '<path class="d d5" pathLength="1" d="M108 78H352M30 140H120"/>' +
    // vetrate
    '<rect class="w w1" x="60" y="156" width="70" height="56" rx="2"/><rect class="w w2" x="142" y="156" width="40" height="66" rx="2"/>' +
    '<rect class="w w3" x="198" y="156" width="82" height="56" rx="2"/><rect class="w w4" x="140" y="92" width="120" height="36" rx="2"/><rect class="w w5" x="272" y="92" width="54" height="36" rx="2"/>' +
    // rivestimento in legno
    '<path class="d d6" pathLength="1" d="M44 150H120M44 160H120M44 170H120"/>' +
    // alberi
    '<path class="d d6" pathLength="1" d="M392 232V196M392 180l-14 22h28zM392 166l-11 18h22z"/>' +
    // gru
    '<g class="gru"><path class="d d1" pathLength="1" d="M370 232V22M362 232h16M370 30H230M370 30h44M370 22l-30 8M370 22l40 8"/>' +
    '<rect class="cw" x="404" y="30" width="12" height="12"/>' +
    '<g class="gancio"><path class="cavo" d="M262 30V70"/><rect class="pacco" x="250" y="70" width="24" height="14" rx="2"/></g></g>' +
    '</svg>';

  function villa(box) {
    if (box.querySelector('.fx-villa')) return;
    box.insertAdjacentHTML('afterbegin', VILLA);
    box.classList.add('fx-cantiere');
  }

  pronto(function () {
    // barra di avanzamento
    var bar = d.createElement('div'); bar.className = 'fx-progress'; d.body.appendChild(bar);
    function avanza() { var m = d.documentElement.scrollHeight - innerHeight; bar.style.transform = 'scaleX(' + (m > 0 ? scrollY / m : 0) + ')'; }
    addEventListener('scroll', avanza, { passive: true }); avanza();

    // portale nella home
    var hero = d.querySelector('.hero');
    if (hero) { hero.classList.add('fx-casa'); }
    else {
      // nelle altre pagine: l'apertura con il titolo diventa un piccolo portale (solo se è un blocco corto)
      var h1 = location.pathname.indexOf('/blog') === 0 ? null : d.querySelector('main h1, h1');
      if (h1) {
        var b = h1.parentElement;
        while (b && b.parentElement && b.parentElement.tagName !== 'MAIN' && b.parentElement !== d.body && b.offsetHeight < 140) b = b.parentElement;
        if (b && b.tagName !== 'MAIN' && b.offsetHeight > 120 && b.offsetHeight < 560 && b.querySelectorAll('form,table,input').length === 0 && b.querySelectorAll('button').length < 3 && b.querySelectorAll('img,picture,video').length === 0 && getComputedStyle(b).backgroundImage === 'none') {
          b.classList.add('fx-apertura'); villa(b);
        }
      }
    }

    // comparse
    var sel = 'main section, main .sec, .lav, .socio, .punto, .numeri>div, .vt-col, .trust>*, .passi4>*, .tiles>*, .card, .post, .posts>*, .company, .faq details';
    var els = [].slice.call(d.querySelectorAll(sel)).filter(function (e) { return !e.closest('.hero') && !e.closest('.fx-apertura') && e.getBoundingClientRect().top > innerHeight * 0.9; });
    if (!calmo && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('fx-on'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (e, i) { e.classList.add('fx-in'); e.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(e); });
    }

    // luce che segue il puntatore sulle schede
    var spot = d.querySelectorAll('.lav, .socio, .punto, .numeri>div, .pick-cat button, .pm, .vt-card, .tile, .card, .company, .boqrow, .opt');
    [].forEach.call(spot, function (e) {
      e.classList.add('fx-spot');
      e.addEventListener('pointermove', function (ev) { var r = e.getBoundingClientRect(); e.style.setProperty('--mx', (ev.clientX - r.left) + 'px'); e.style.setProperty('--my', (ev.clientY - r.top) + 'px'); });
    });

    // scelta iniziale: "Procedura guidata" evidenzia le schede del lavoro
    var gui = d.getElementById('pm-gui');
    if (gui) gui.addEventListener('click', function () {
      var pk = d.getElementById('picker'); if (pk) pk.classList.add('fx-aperto');
      var cat = d.getElementById('pick-cat'); if (!cat) return;
      cat.classList.remove('fx-guida'); void cat.offsetWidth; cat.classList.add('fx-guida');
      var b1 = cat.querySelector('button'); if (b1) b1.focus({ preventScroll: true });
    });
  });
})();
