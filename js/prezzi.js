/* Guide prezzi: medie anonime delle quotazioni reali (/api/prezzi-reali), mostrate solo da 3 quotazioni controllate in su */
(function () {
  var box = document.getElementById('pz-reali');
  if (!box || !window.fetch) return;
  var eur = function (n) { return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(n)) + ' €'; };
  var REG = { taa: 'Trentino-Alto Adige', ven: 'Veneto', fvg: 'Friuli-Venezia Giulia' };
  var u = box.dataset.udm;
  fetch('/api/prezzi-reali?pacchetto=' + encodeURIComponent(box.dataset.pacchetto)).then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
    if (!a) return;
    if (!a.pubblica) {
      if (a.n > 0) box.innerHTML = '<p class="muted">Abbiamo già ' + a.n + (a.n === 1 ? ' quotazione controllata' : ' quotazioni controllate') + ' per questo lavoro: la media compare da 3 in su. Aggiungi la tua.</p>';
      return;
    }
    var diff = a.rispetto_listino, testoDiff = diff === 0 ? 'in linea con il listino EdilMen' : (diff > 0 ? '+' : '') + diff + '% rispetto al listino EdilMen';
    box.innerHTML = '<p>Basati su <b>' + a.n + ' quotazioni reali</b> caricate dalle persone e controllate da EdilMen' + (a.anni && a.anni[0] < 9999 ? ' (' + (a.anni[0] === a.anni[1] ? a.anni[0] : a.anni[0] + '-' + a.anni[1]) + ')' : '') + ', IVA esclusa.</p>' +
      '<div class="pz-reali-n"><div><span>Prezzo reale mediano</span><b>' + eur(a.mediana) + '</b><small>per ' + u + ', ' + testoDiff + '</small></div>' +
      '<div><span>La metà centrale paga tra</span><b>' + eur(a.p25) + ' e ' + eur(a.p75) + '</b><small>per ' + u + '</small></div>' +
      '<div><span>Sullo scenario tipico</span><b>' + eur(a.scenario) + '</b><small>' + a.qrif + ' ' + u + '</small></div>' +
      Object.keys(a.regioni || {}).map(function (k) { return '<div><span>' + REG[k] + '</span><b>' + eur(a.regioni[k].mediana) + '</b><small>per ' + u + ', ' + a.regioni[k].n + ' quotazioni</small></div>'; }).join('') + '</div>';
  }).catch(function () {});
})();

/* scheda attiva in base alla sezione che si sta leggendo */
(function () {
  var tabs = [].slice.call(document.querySelectorAll('.pz-tabs a'));
  if (!tabs.length || !('IntersectionObserver' in window)) return;
  var segna = function (id) { tabs.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); };
  segna('panoramica');
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) segna(e.target.id); }); }, { rootMargin: '-140px 0px -60% 0px' });
  tabs.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
})();
