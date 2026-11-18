import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, eur, num, Field, ErrorBox, ComuneInput, Choice, useToast } from '../../ui.jsx';
import { api } from '../../api.js';

const Hero = ({ eyebrow, title, sub, children }) => (
  <section className="hero-field bg-brand text-[#ecebea]">
    <div className="max-w-6xl mx-auto px-4 py-16 lg:py-28">
      <div className="text-lg text-[#d2a9ac]">{eyebrow}</div>
      <h1 className="text-4xl sm:text-6xl font-semibold mt-4 max-w-4xl" style={{ letterSpacing: '-0.04em', lineHeight: 1 }}>{title}</h1>
      {sub && <p className="text-[#ecebea]/85 text-xl mt-6 max-w-3xl">{sub}</p>}
      {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
    </div>
  </section>
);

export function RatingPage() {
  return (
    <div>
      <Hero eyebrow="Metodologia pubblica" title="Come calcoliamo il rating delle imprese" sub="Da 1 a 5, solo su fatti verificabili. Nessuna impresa può pagare per alzarlo: il piano a pagamento dà visibilità e strumenti, mai punteggio." />
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="card overflow-hidden">
          <table className="w-full"><thead className="bg-paper"><tr><th className="th">Cosa misuriamo</th><th className="th">Peso</th><th className="th">Da dove arriva</th></tr></thead>
            <tbody className="divide-y divide-line text-sm">
              <tr><td className="td font-semibold">Recensioni dei clienti</td><td className="td">60%</td><td className="td">Solo da chi ha fatto un lavoro con l'impresa tramite EdilMen, a fine lavori. Cinque voti: qualità, puntualità, rispetto del preventivo, pulizia, comunicazione. Ultimi 3 anni, l'ultimo anno pesa il doppio.</td></tr>
              <tr><td className="td font-semibold">Documenti verificati</td><td className="td">25%</td><td className="td">Visura camerale, DURC, assicurazione RC, patente a crediti. Ognuno vale un quarto, solo se valido e non scaduto.</td></tr>
              <tr><td className="td font-semibold">Comportamento</td><td className="td">15%</td><td className="td">Quanto spesso l'impresa risponde entro 24 ore agli inviti. Conta da 3 casi in su; prima il peso si ridistribuisce.</td></tr>
            </tbody></table>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5"><div className="font-bold">Quando si pubblica</div><p className="text-sm text-ink-soft mt-1">Con almeno 3 recensioni di lavori conclusi, controllate dal team, e la visura verificata. Prima la scheda mostra «Rating in costruzione» e cosa manca.</p></div>
          <div className="card p-5"><div className="font-bold">Cosa non conta</div><p className="text-sm text-ink-soft mt-1">Il piano a pagamento, le recensioni di altri siti, la grandezza o il fatturato. Non togliamo recensioni perché negative: solo se il lavoro non è verificabile o contengono insulti o dati personali.</p></div>
          <div className="card p-5"><div className="font-bold">Da dove vengono i dati</div><p className="text-sm text-ink-soft mt-1">Le schede partono da dati societari pubblici (ragione sociale, partita IVA, sede, ATECO), con fonte e data. L'impresa conferma la scheda gratis e aggiunge lavorazioni, zone e prezzi.</p></div>
          <div className="card p-5"><div className="font-bold">Errori</div><p className="text-sm text-ink-soft mt-1">Su ogni scheda c'è «Segnala un errore». Correggiamo e teniamo lo storico delle modifiche.</p></div>
        </div>
        <p className="text-xs text-ink-mute">EdilMen pubblica valutazioni basate su fatti verificati da EdilMen; non è un'agenzia di rating del credito né rilascia certificazioni.</p>
      </div>
    </div>
  );
}

export function ForCompanies() {
  const { boot } = useApp();
  const fee = boot?.fee;
  return (
    <div>
      <Hero eyebrow="Imprese e artigiani" title="Lavori completi nella tua zona. Paghi solo quando lavori." sub="EdilMen non si mette tra te e il cliente: definisce il lavoro, porta clienti verificati, presidia contratto e SAL. Firmi e fatturi tu.">
        <Link to="/rivendica" className="btn-primary btn-lg">Rivendica la tua scheda</Link>
        <Link to="/iscrizione-impresa" className="btn bg-white/10 text-white hover:bg-white/20 btn-lg">Non sei nell'elenco? Iscriviti</Link>
      </Hero>
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['Lavori già definiti', 'Il cliente arriva con il pacchetto scelto, le quantità e il livello. Niente sopralluoghi a vuoto.'],
            ['Il tuo listino lavora per te', 'Prezzi i pacchetti EdilMen una volta: quando arriva una richiesta compatibile l\'offerta parte da sola, con il tuo prezzo.'],
            ['Clienti verificati, pagamenti a SAL', 'Piano dei pagamenti scritto nel contratto, SAL approvati con foto: meno contestazioni, incassi regolari.'],
          ].map(([t, d]) => <div key={t} className="card p-6"><div className="font-bold text-lg">{t}</div><p className="text-sm text-ink-soft mt-2">{d}</p></div>)}
        </div>
        <div className="card p-6">
          <div className="font-bold text-xl">Quanto costa</div>
          <p className="text-ink-soft text-sm mt-1">Entrare nella rete è gratuito. EdilMen trattiene una fee solo sui lavori firmati, maturata a ogni SAL approvato.</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {(fee?.brackets || []).map((b, i) => <div key={i} className="rounded-2xl bg-paper p-4 text-center"><div className="text-3xl font-extrabold text-brand">{num(b.rate * 100)}%</div><div className="text-sm text-ink-soft">{b.upTo ? `contratti fino a ${eur(b.upTo)}` : 'oltre'}</div></div>)}
          </div>
          <p className="text-xs text-ink-mute mt-3">Esempio: bagno da 10.000 € → fee {eur(10000 * (fee?.brackets?.[0]?.rate || 0.08))}, divisa sulle 5 tappe di pagamento.</p>
        </div>
        <div>
          <div className="font-bold text-xl mb-3">Piani facoltativi</div>
          <div className="grid md:grid-cols-3 gap-4">
            {(boot?.plans || []).map((p) => <div key={p.id} className="card p-6"><div className="font-bold">{p.name}</div><div className="text-3xl font-extrabold mt-1">{p.price ? `${eur(p.price)}` : 'Gratis'}<span className="text-sm text-ink-soft font-medium">{p.price ? ' /mese' : ''}</span></div><ul className="text-sm text-ink-soft mt-3 space-y-1">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul></div>)}
          </div>
          <p className="text-xs text-ink-mute mt-2">I piani danno visibilità e strumenti. Non cambiano il rating.</p>
        </div>
      </div>
    </div>
  );
}

export function ClaimPage() {
  const nav = useNavigate();
  const { refreshUser } = useApp();
  const [s, setS] = useState({ step: 1, vat: '', email: '', code: '', password: '', name: '', phone: '' });
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const start = async () => {
    setErr(null);
    try { const r = await api.post('/public/claim/start', { vat: s.vat, email: s.email }); setInfo(r); setS({ ...s, step: 2 }); }
    catch (e) { setErr(e.message); if (e.data?.notFound) setInfo({ notFound: true }); }
  };
  const verify = async () => {
    setErr(null);
    try { await api.post('/public/claim/verify', { claimId: info.claimId, code: s.code, password: s.password, name: s.name, phone: s.phone }); await refreshUser(); nav('/impresa'); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="eyebrow">Gratis</div>
      <h1 className="text-3xl font-extrabold mt-1">Rivendica la scheda della tua impresa</h1>
      <p className="text-ink-soft mt-2">Confermi che sei tu, poi decidi cosa mostrare: lavorazioni, zone, prezzi. Se vuoi, ricevi richieste compatibili.</p>
      <div className="card p-6 mt-6 space-y-4">
        {s.step === 1 && (
          <>
            <Field label="Partita IVA dell'impresa"><input className="input" value={s.vat} onChange={set('vat')} inputMode="numeric" maxLength={13} /></Field>
            <Field label="Email aziendale" hint="Con un'email sul dominio del sito dell'impresa (es. info@nomeimpresa.it) la scheda si conferma subito; altrimenti la controlla il nostro team."><input className="input" type="email" value={s.email} onChange={set('email')} /></Field>
            <ErrorBox>{err}</ErrorBox>
            {info?.notFound && <Link to="/iscrizione-impresa" className="btn-soft w-full">Iscrivi la tua impresa</Link>}
            <button className="btn-primary w-full" onClick={start}>Mandami il codice</button>
          </>
        )}
        {s.step === 2 && (
          <>
            <div className="rounded-xl bg-brand-soft p-3 text-sm">
              Scheda: <b>{info.company}</b>. {info.mailSent ? `Ti abbiamo mandato un codice di 6 cifre a ${s.email}: vale 15 minuti.` : 'L\'invio automatico delle email non è ancora attivo: un operatore EdilMen ti comunica il codice per telefono o email entro la giornata lavorativa.'}
            </div>
            <Field label="Codice"><input className="input text-lg tracking-widest" value={s.code} onChange={set('code')} inputMode="numeric" maxLength={6} /></Field>
            <Field label="Il tuo nome"><input className="input" value={s.name} onChange={set('name')} /></Field>
            <Field label="Telefono"><input className="input" value={s.phone} onChange={set('phone')} /></Field>
            <Field label="Scegli una password"><input className="input" type="password" value={s.password} onChange={set('password')} placeholder="Almeno 8 caratteri" /></Field>
            {!info.domainMatch && <p className="text-xs text-ink-mute">L'email non è sul dominio del sito dell'impresa: salviamo i dati e li pubblichiamo dopo un controllo del team (di solito entro 2 giorni lavorativi).</p>}
            <ErrorBox>{err}</ErrorBox>
            <button className="btn-primary w-full" onClick={verify}>Conferma e entra</button>
          </>
        )}
      </div>
    </div>
  );
}

export function JoinPage() {
  const nav = useNavigate();
  const { refreshUser } = useApp();
  const [v, setV] = useState({ name: '', vat: '', comune: null, contactName: '', email: '', phone: '', password: '', categories: [], privacy: false });
  const [err, setErr] = useState(null);
  const CATS = ['Ristrutturazioni', 'Nuove costruzioni', 'Impianti elettrici', 'Impianti idraulici', 'Riscaldamento e clima', 'Fotovoltaico', 'Serramenti', 'Coperture', 'Cappotti e facciate', 'Pavimenti e rivestimenti', 'Cartongesso', 'Pitture', 'Domotica', 'Pulizie e sgomberi'];
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const go = async () => {
    setErr(null);
    if (!v.privacy) return setErr('Serve la presa visione dell\'informativa privacy');
    try { await api.post('/public/join', { ...v, comune: v.comune?.nome }); await refreshUser(); nav('/impresa'); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold">Iscrivi la tua impresa</h1>
      <p className="text-ink-soft mt-2">Gratis. Verifichiamo visura, DURC e assicurazione, poi attiviamo la scheda. Da lì prezzi i pacchetti e ricevi richieste.</p>
      <div className="card p-6 mt-6 grid sm:grid-cols-2 gap-4">
        <Field label="Ragione sociale" className="sm:col-span-2"><input className="input" value={v.name} onChange={set('name')} /></Field>
        <Field label="Partita IVA"><input className="input" value={v.vat} onChange={set('vat')} /></Field>
        <Field label="Sede (comune)"><ComuneInput value={v.comune} onChange={(c) => setV({ ...v, comune: c })} /></Field>
        <div className="sm:col-span-2"><span className="label">Cosa fate</span><div className="flex flex-wrap gap-1.5">{CATS.map((c) => { const on = v.categories.includes(c); return <button type="button" key={c} onClick={() => setV({ ...v, categories: on ? v.categories.filter((x) => x !== c) : [...v.categories, c] })} className={`chip border ${on ? 'bg-navy text-white border-navy' : 'bg-white border-line'}`}>{c}</button>; })}</div></div>
        <Field label="Referente"><input className="input" value={v.contactName} onChange={set('contactName')} /></Field>
        <Field label="Telefono"><input className="input" value={v.phone} onChange={set('phone')} /></Field>
        <Field label="Email (sarà il tuo accesso)"><input className="input" type="email" value={v.email} onChange={set('email')} /></Field>
        <Field label="Password"><input className="input" type="password" value={v.password} onChange={set('password')} placeholder="Almeno 8 caratteri" /></Field>
        <label className="sm:col-span-2 flex gap-2 text-sm"><input type="checkbox" checked={v.privacy} onChange={(e) => setV({ ...v, privacy: e.target.checked })} /> Ho letto l'<Link to="/privacy" className="text-brand underline">informativa privacy</Link> e i <Link to="/termini" className="text-brand underline">termini</Link>.</label>
        <div className="sm:col-span-2"><ErrorBox>{err}</ErrorBox></div>
        <button className="btn-primary btn-lg sm:col-span-2" onClick={go}>Iscrivi l'impresa</button>
      </div>
    </div>
  );
}

export function AgenciesLanding() {
  const { user } = useApp();
  return (
    <div>
      <Hero eyebrow="Agenzie immobiliari e investitori" title="Il costo dei lavori, prima della trattativa." sub="Per ogni immobile in portafoglio: stima dei lavori a pacchetti, report da consegnare all'acquirente con il tuo nome, offerte reali di imprese quando il cliente è pronto.">
        <Link to={user ? '/area/immobili' : '/registrati?ruolo=agenzia'} className="btn-primary btn-lg">Apri l'area agenzia</Link>
        <Link to={user ? '/area/immobili' : '/registrati?ruolo=investitore'} className="btn bg-white/10 text-white hover:bg-white/20 btn-lg">Sono un investitore</Link>
      </Hero>
      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['🏷️', 'Vendi più velocemente', 'L\'acquirente vede subito quanto costa sistemare la casa: meno trattative al buio, meno ribassi «a sensazione».'],
          ['📄', 'Report col tuo nome', 'Link condivisibile e stampabile in PDF, con voci, livelli di materiali e prezzo prudente.'],
          ['📊', 'Operazioni su più unità', 'Per immobiliaristi: costo al m², confronto tra livelli, prezzo d\'acquisto + lavori vs valore a fine lavori.'],
          ['🤝', 'Offerte vere quando servono', 'Un clic trasforma la stima in richiesta alle imprese della rete. Gare su computo per le operazioni grandi.'],
        ].map(([ic, t, d]) => <div key={t} className="card p-6"><div className="text-3xl">{ic}</div><div className="font-bold mt-3">{t}</div><p className="text-sm text-ink-soft mt-2">{d}</p></div>)}
      </div>
    </div>
  );
}

export function BigLanding() {
  const { user } = useApp();
  return (
    <div>
      <Hero eyebrow="Condomini, palazzine, grandi operazioni" title="Gara tra imprese su computo metrico, voce per voce." sub="Carichi le voci (descrizione, unità, quantità), invitiamo imprese della rete con i requisiti giusti, ricevi prezzi unitari confrontabili con le anomalie evidenziate.">
        <Link to={user ? '/area/computo' : '/registrati?ruolo=investitore'} className="btn-primary btn-lg">Crea una richiesta su computo</Link>
      </Hero>
      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-4">
        {[
          ['Stesso computo per tutti', 'Le imprese prezzano le stesse voci: il confronto è diretto, senza preventivi «a corpo» incomparabili.'],
          ['Anomalie in evidenza', 'Ogni prezzo è confrontato con la mediana: oltre +15% è alto, sotto −25% è anomalo e va spiegato.'],
          ['Dal contratto ai SAL', 'Aggiudicazione, piano SAL, documenti e foto di avanzamento nello stesso posto. Per la PA, imprese in ATI.'],
        ].map(([t, d]) => <div key={t} className="card p-6"><div className="font-bold text-lg">{t}</div><p className="text-sm text-ink-soft mt-2">{d}</p></div>)}
      </div>
    </div>
  );
}

export function Legal({ kind }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose">
      {kind === 'privacy' ? (
        <>
          <h1 className="text-3xl font-extrabold">Informativa privacy</h1>
          <p className="text-sm text-warn font-semibold mt-2">Bozza tecnica da far validare dal legale/DPO prima della pubblicazione.</p>
          <div className="space-y-4 text-sm text-ink-soft mt-6">
            <p><b>Titolare:</b> European Management Institute S.r.l., Trento (business unit EdilMen).</p>
            <p><b>Dati trattati:</b> dati di contatto (nome, telefono, email), descrizione del lavoro, comune dell'immobile, eventuali foto e vocali che ci invii.</p>
            <p><b>Finalità e basi giuridiche:</b> rispondere alla tua richiesta e organizzare sopralluoghi e offerte (misure precontrattuali); con il tuo consenso, passare nome e contatto all'impresa che scegli; con un consenso separato e facoltativo, inviarti novità su bonus e incentivi.</p>
            <p><b>Imprese:</b> ricevono la descrizione del lavoro e il comune. Il tuo contatto arriva solo all'impresa che scegli, se lo autorizzi.</p>
            <p><b>Conservazione:</b> per il tempo necessario alla richiesta e agli obblighi di legge; i consensi sono registrati con versione e data.</p>
            <p><b>Diritti:</b> accesso, rettifica, cancellazione, limitazione, opposizione, portabilità, reclamo al Garante.</p>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">Termini e condizioni</h1>
          <p className="text-sm text-warn font-semibold mt-2">Bozza tecnica da far validare dal legale prima della pubblicazione.</p>
          <div className="space-y-4 text-sm text-ink-soft mt-6">
            <p>EdilMen mette in contatto chi deve eseguire lavori edili con imprese della propria rete, fornisce prezzi di riferimento a pacchetti e strumenti per contratti e stati di avanzamento lavori.</p>
            <p>I prezzi mostrati sono prezzi prudenti di riferimento, IVA esclusa, che al sopralluogo possono solo diminuire salvo modifiche richieste dal cliente o imprevisti documentati con variante scritta.</p>
            <p>Il contratto d'appalto è stipulato direttamente tra cliente e impresa. EdilMen è remunerata dall'impresa con una fee sui lavori aggiudicati.</p>
          </div>
        </>
      )}
    </div>
  );
}
