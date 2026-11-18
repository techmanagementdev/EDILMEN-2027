/* "Carica la tua quotazione" (/prezzi/condividi): file facoltativo con link monouso, poi invio a /api/prezzi-reali */
(function () {
  var f = document.getElementById('pz-form');
  if (!f) return;
  var err = document.getElementById('pz-err'), sel = f.pacchetto, udm = document.getElementById('pz-udm');
  var ERR = { pacchetto: 'Scegli il lavoro.', quantita: 'Scrivi la quantità.', importo: "Scrivi l'importo (almeno 50 €).", anno: "Scrivi l'anno.", comune: 'Scrivi il comune.',
    email: "L'email non sembra valida.", privacy: "Serve la presa visione dell'informativa.", troppe_richieste: "Hai inviato molte quotazioni in poco tempo. Riprova tra un'ora.",
    tipo_file: 'Il file deve essere una foto o un PDF.', dimensione_file: 'Il file supera 10 MB.' };
  var lav = new URLSearchParams(location.search).get('lavoro');
  if (lav && sel.querySelector('option[value="' + lav.replace(/[^A-Z0-9]/g, '') + '"]')) sel.value = lav;
  function aggiorna() {
    var o = sel.selectedOptions[0];
    udm.textContent = o && o.dataset.udm ? '(' + o.dataset.udm + ')' : '';
    if (o && o.dataset.q && !f.quantita.value) f.quantita.placeholder = 'Es. ' + o.dataset.q;
  }
  sel.addEventListener('change', aggiorna); aggiorna();
  function mostra(t) { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  async function api(dati) {
    var r = await fetch('/api/prezzi-reali', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw j;
    return j;
  }
  f.addEventListener('submit', async function (e) {
    e.preventDefault(); err.hidden = true;
    var b = f.querySelector('button[type=submit]'), file = f.file.files[0], id = null;
    var dati = { azione: 'invia', pacchetto: sel.value, quantita: Number(f.quantita.value), importo: Number(f.importo.value), iva: f.iva.value, livello: f.livello.value,
      tipo: (f.querySelector('input[name=tipo]:checked') || {}).value, anno: Number(f.anno.value), comune: f.comune.value, note: f.note.value, email: f.email.value,
      privacy: f.privacy.checked, sito_web: f.sito_web.value };
    b.disabled = true; b.textContent = 'Invio in corso...';
    try {
      if (file) {
        var p = await api({ azione: 'prepara', file: { tipo: file.type, byte: file.size } });
        var up = await fetch(p.link, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!up.ok) throw { errore: 'caricamento' };
        id = p.id;
      }
      dati.id = id;
      await api(dati);
      f.hidden = true; document.getElementById('pz-grazie').hidden = false; scrollTo({ top: 0, behavior: 'smooth' });
    } catch (x) {
      var c = (x && x.campi) || [];
      mostra(c.length ? c.map(function (k) { return ERR[k] || k; }).join(' ') : ERR[x && x.errore] || 'Non siamo riusciti a inviare la quotazione. Riprova tra un attimo.');
    } finally { b.disabled = false; b.textContent = 'Invia la quotazione'; }
  });
})();
