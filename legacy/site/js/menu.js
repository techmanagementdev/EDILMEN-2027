/* Menu del telefono (15/10/2026): quando le voci in alto sono nascoste per mancanza di spazio,
   compare il pulsante con le tre righe che le apre in un pannello sotto l'intestazione. Vale per tutte le pagine pubbliche. */
(function () {
  var hdr = document.querySelector('.hdr'), nav = hdr && hdr.querySelector('nav');
  if (!hdr || !nav) return;
  var css = document.createElement('style');
  css.textContent = '.mn-btn{display:none;width:44px;height:44px;flex:none;border:1px solid #E1E6F1;border-radius:12px;background:#fff;color:#10204A;cursor:pointer;align-items:center;justify-content:center;margin-left:8px}' +
    '.mn-btn svg{width:22px;height:22px}.mn-btn.si{display:inline-flex}' +
    '.hdr.mn-aperto nav{display:flex!important;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:0;margin:0;padding:8px 16px 16px;background:#fff;border-bottom:1px solid #E1E6F1;box-shadow:0 18px 30px -18px rgba(16,32,74,.45);z-index:50}' +
    '.hdr.mn-aperto nav a{display:block;padding:13px 4px;border-bottom:1px solid #EEF1F7;font-size:1.02rem;font-weight:600;color:#10204A;text-decoration:none}' +
    '.hdr.mn-aperto nav a:last-child{border-bottom:0}';
  document.head.appendChild(css);
  // "Accedi" (nascosto sul telefono nella home) entra nel menu
  var accedi = hdr.querySelector('.hdr-r a.l');
  if (accedi && !nav.querySelector('[data-mn-accedi]')) { var a = accedi.cloneNode(true); a.className = 'mn-solo'; a.setAttribute('data-mn-accedi', ''); nav.appendChild(a); }
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'mn-btn'; b.setAttribute('aria-label', 'Apri il menu'); b.setAttribute('aria-expanded', 'false');
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  (hdr.querySelector('.wrap') || hdr).appendChild(b);
  var chiudi = function () { hdr.classList.remove('mn-aperto'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Apri il menu'); };
  b.addEventListener('click', function () {
    var aperto = hdr.classList.toggle('mn-aperto');
    b.setAttribute('aria-expanded', String(aperto)); b.setAttribute('aria-label', aperto ? 'Chiudi il menu' : 'Apri il menu');
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) chiudi(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') chiudi(); });
  document.addEventListener('click', function (e) { if (!hdr.contains(e.target)) chiudi(); });
  // il pulsante compare solo quando le voci sono nascoste dalla pagina (ogni pagina ha la sua larghezza limite)
  var controlla = function () {
    var era = hdr.classList.contains('mn-aperto');
    hdr.classList.remove('mn-aperto');
    var nascosto = getComputedStyle(nav).display === 'none';
    b.classList.toggle('si', nascosto);
    if (era && nascosto) hdr.classList.add('mn-aperto');
    if (!nascosto) chiudi();
    // "Accedi" doppione solo nel menu del telefono
    var dop = nav.querySelector('[data-mn-accedi]'); if (dop) dop.hidden = !nascosto;
  };
  controlla(); addEventListener('resize', controlla);
})();
