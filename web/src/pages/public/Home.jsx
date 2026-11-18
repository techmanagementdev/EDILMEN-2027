import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, num, eur } from '../../ui.jsx';
import { api } from '../../api.js';

const QUICK = [
  ['bagno', '🛁', 'Rifare il bagno'], ['completa', '🏠', 'Ristrutturare casa'], ['finestre', '🪟', 'Finestre'], ['fv', '☀️', 'Fotovoltaico'],
  ['pdc', '🌡️', 'Pompa di calore'], ['tetto', '🏚️', 'Tetto'], ['cappotto', '🧥', 'Cappotto'], ['casanuova', '🏡', 'Casa nuova'],
];

export default function Home() {
  const { boot } = useApp();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const s = boot?.stats;
  const describe = async (e) => {
    e.preventDefault();
    if (text.trim().length < 5) return;
    setBusy(true);
    try {
      const r = await api.post('/public/describe', { text });
      const p = new URLSearchParams();
      if (r.lavori?.length) p.set('lavori', r.lavori.join(','));
      if (r.mq) p.set('mq', r.mq);
      p.set('desc', text.slice(0, 500));
      nav('/quota?' + p.toString());
    } catch { nav('/quota'); }
  };
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="eyebrow text-blue-300">Il digital contractor</div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mt-3 leading-[1.05]">Sai quanto costa prima di firmare. <span className="text-blue-300">E il prezzo può solo scendere.</span></h1>
            <p className="mt-5 text-lg text-white/75 max-w-2xl">Lavori descritti voce per voce, uguali per tutte le imprese. Offerte reali di imprese verificate della tua zona. Paghi a stato di avanzamento lavori, con le foto del cantiere.</p>
            <form onSubmit={describe} className="mt-8 bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-lift max-w-2xl">
              <input className="flex-1 px-4 py-3 text-ink outline-none rounded-xl" value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi cosa ti serve: «rifare bagno e cucina, 80 mq a Trento»" />
              <button className="btn-primary btn-lg" disabled={busy}>{busy ? 'Leggo…' : 'Calcola il prezzo'}</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK.map(([id, ic, l]) => <Link key={id} to={`/quota?lavori=${id}`} className="rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm">{ic} {l}</Link>)}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-white text-ink rounded-3xl p-6 shadow-lift">
              <div className="text-xs font-semibold text-ink-mute uppercase tracking-wide">Esempio reale di calcolo</div>
              <div className="mt-1 font-bold text-lg">Bagno chiavi in mano, livello intermedio · Rovereto</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-ok-soft p-4"><div className="text-xs text-ok font-semibold">Parte fissa</div><div className="text-2xl font-extrabold">{eur(8546 * 1.025)}</div><div className="text-[11px] text-ink-soft">il minimo, a sopralluogo pulito</div></div>
                <div className="rounded-2xl bg-brand-soft p-4"><div className="text-xs text-brand font-semibold">Prezzo prudente</div><div className="text-2xl font-extrabold">{eur(8546 * 1.1 * 1.025)}</div><div className="text-[11px] text-ink-soft">il massimo: comprende gli imprevisti</div></div>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
                <li>✓ Voci incluse ed escluse scritte, uguali per tutte le imprese</li>
                <li>✓ Imprevisti solo con verbale fotografico e variante firmata</li>
                <li>✓ Prezzi IVA esclusa, oneri della sicurezza compresi</li>
              </ul>
              <Link to="/prezzi/R03" className="btn-ghost w-full mt-4">Guarda cosa c'è dentro il pacchetto</Link>
            </div>
          </div>
        </div>
      </section>

      {/* PERCORSI */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="eyebrow">Per chi è EdilMen</div>
        <h2 className="text-3xl font-extrabold mt-2">Dal bagno alla palazzina, la stessa regola: prezzo chiaro, impresa giusta.</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[
            ['🏠', 'Famiglie', 'Ristrutturi casa, rifai il bagno, metti il fotovoltaico. Prezzo subito, offerte reali, sopralluogo gratuito.', '/quota', 'Calcola il prezzo'],
            ['🔑', 'Agenzie immobiliari', 'Stima dei lavori per ogni immobile in portafoglio, report da dare all\'acquirente, offerte vere quando serve.', '/agenzie', 'Area agenzie'],
            ['📈', 'Immobiliaristi e investitori', 'Costo lavori al m² prima dell\'acquisto, operazioni su più unità, gara tra imprese su computo.', '/agenzie', 'Area investitori'],
            ['🏢', 'Condomini e grandi operazioni', 'Richiesta d\'offerta su computo metrico, confronto voce per voce, anomalie evidenziate.', '/grandi-operazioni', 'Richiedi offerte'],
          ].map(([ic, t, d, to, cta]) => (
            <Link key={t} to={to} className="card p-6 hover:shadow-lift transition group">
              <div className="text-3xl">{ic}</div>
              <div className="font-bold text-lg mt-3">{t}</div>
              <p className="text-sm text-ink-soft mt-2">{d}</p>
              <div className="text-brand font-semibold text-sm mt-4 group-hover:underline">{cta} →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section className="bg-white border-y border-line">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="eyebrow">Come funziona</div>
          <h2 className="text-3xl font-extrabold mt-2">Il cantiere, senza sorprese.</h2>
          <ol className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
            {[
              ['Descrivi', 'Poche domande, una per schermata. O un vocale.'],
              ['Vedi il prezzo', 'Dal listino a pacchetti della tua provincia: parte fissa e prezzo prudente.'],
              ['Ricevi offerte vere', 'Fino a 3 imprese della rete con listino approvato o che hanno risposto all\'invito.'],
              ['Sopralluogo', 'Gratuito, sul posto o in videochiamata. Il prezzo può solo scendere.'],
              ['Contratto', 'Firmi con l\'impresa. Piano di pagamento a SAL già scritto.'],
              ['Cantiere a SAL', 'Ogni tappa con foto: approvi tu, poi paghi. A fine lavori recensisci.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-paper p-5">
                <div className="h-8 w-8 rounded-full bg-navy text-white font-bold flex items-center justify-center text-sm">{i + 1}</div>
                <div className="font-bold mt-3">{t}</div>
                <p className="text-sm text-ink-soft mt-1">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FIDUCIA */}
      <section className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10">
        <div>
          <div className="eyebrow">Le nostre regole</div>
          <h2 className="text-3xl font-extrabold mt-2">La fiducia si costruisce con i fatti, non con le stelline.</h2>
          <p className="text-ink-soft mt-3">Un'impresa edile non si sceglie come un hotel: il lavoro è irreversibile e costa caro. Per questo EdilMen ha regole scritte nel codice della piattaforma.</p>
          <Link to="/rating" className="btn-ghost mt-6">Leggi come calcoliamo il rating</Link>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {[
            ['Nessuna offerta inventata', 'Vedi solo prezzi di imprese reali. Se non ci sono ancora, te lo diciamo e ti mostriamo il prezzo di riferimento EdilMen.'],
            ['Il voto non si compra', 'Il rating nasce da recensioni di lavori fatti, documenti verificati e puntualità. Il piano a pagamento non lo cambia.'],
            ['Stesse voci per tutti', 'Le imprese cambiano il prezzo, non il contenuto del pacchetto. Così il confronto è vero.'],
            ['Paghi a lavoro fatto', 'Piano SAL 10·30·30·20·10 con foto. Nessun extra senza variante scritta.'],
          ].map(([t, d]) => (
            <li key={t} className="card p-5"><div className="font-bold">✓ {t}</div><p className="text-sm text-ink-soft mt-1">{d}</p></li>
          ))}
        </ul>
      </section>

      {/* NUMERI VERI */}
      <section className="bg-white border-y border-line">
        <div className="max-w-7xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div><div className="text-3xl font-extrabold">{s ? num(s.network) : '—'}</div><div className="text-sm text-ink-soft">imprese nella rete EdilMen</div></div>
          <div><div className="text-3xl font-extrabold">{s ? num(s.catalog) : '—'}</div><div className="text-sm text-ink-soft">schede di imprese nell'elenco</div></div>
          <div><div className="text-3xl font-extrabold">{boot?.catalog ? boot.catalog.packages.length : '—'}</div><div className="text-sm text-ink-soft">lavori a pacchetto con prezzo</div></div>
          <div><div className="text-3xl font-extrabold">{s ? num(s.reviews) : '—'}</div><div className="text-sm text-ink-soft">recensioni verificate di lavori conclusi</div></div>
          <p className="sm:col-span-2 lg:col-span-4 text-xs text-ink-mute">Numeri letti in tempo reale dal database: non arrotondati, non inventati.</p>
        </div>
      </section>

      {/* IMPRESE */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="card p-8 lg:p-12 grid lg:grid-cols-3 gap-8 items-center bg-gradient-to-br from-white to-brand-soft">
          <div className="lg:col-span-2">
            <div className="eyebrow">Imprese e artigiani</div>
            <h2 className="text-3xl font-extrabold mt-2">Lavori completi nella tua zona, clienti verificati, nessun costo d'ingresso.</h2>
            <p className="text-ink-soft mt-3">EdilMen si paga solo sui lavori che firmi, a ogni SAL: {boot?.fee ? boot.fee.brackets.map((b) => `${num(b.rate * 100)}%${b.upTo ? ' fino a ' + eur(b.upTo) : ' oltre'}`).join(', ') : '8% fino a 50.000 €, 6% fino a 3 M€, 4% oltre'}. Non ti interponiamo tra te e il cliente: firmi e fatturi tu.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/per-le-imprese" className="btn-primary btn-lg">Entra nella rete</Link>
            <Link to="/rivendica" className="btn-ghost btn-lg">Rivendica la tua scheda</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <h2 className="text-3xl font-extrabold">Domande frequenti</h2>
        <div className="mt-6 divide-y divide-line card">
          {[
            ['Il prezzo che vedo è vincolante?', 'È il prezzo prudente del pacchetto: comprende un accantonamento per gli imprevisti tipici. Al sopralluogo può solo scendere, fino alla parte fissa. Aumenta solo se aggiungi lavori o se emerge un imprevisto documentato con foto e variante firmata da te.'],
            ['Quanto costa il servizio?', 'Per chi chiede i preventivi è gratuito. EdilMen è pagata dall\'impresa, solo sui lavori firmati, a ogni stato di avanzamento.'],
            ['Vedo i nomi delle imprese?', 'Vedi prezzo, tempi, documenti verificati e rating. Il nome lo scopri quando prenoti il sopralluogo: così il confronto resta sul merito.'],
            ['Le imprese ricevono il mio telefono?', 'Solo se lo autorizzi e solo l\'impresa che scegli. Alle altre passiamo la descrizione del lavoro e il comune.'],
            ['E se non ci sono imprese nella mia zona?', 'Te lo diciamo chiaramente. Vedi il prezzo di riferimento EdilMen e invitiamo noi le imprese verificate più vicine.'],
          ].map(([qq, a]) => (
            <details key={qq} className="p-5 group"><summary className="font-semibold cursor-pointer list-none flex justify-between">{qq}<span className="text-ink-mute group-open:rotate-45 transition">+</span></summary><p className="text-sm text-ink-soft mt-2">{a}</p></details>
          ))}
        </div>
      </section>
    </div>
  );
}
