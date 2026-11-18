import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { computeQuote, LEVELS } from '@shared/pricing.js';
import { linesFromAnswers } from '@shared/lavori.js';
import { useApp } from '../../ui.jsx';
import { api } from '../../api.js';
import './home.css';

const eur = (v) => String(Math.round(v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';

// Le frasi del titolo: ognuna è un lavoro vero del listino.
const JOBS = [
  { id: 'bagno', say: 'Rifare il bagno', mq: false },
  { id: 'cucina', say: 'Rifare la cucina', mq: false },
  { id: 'completa', say: 'Ristrutturare casa', mq: true, def: 85 },
  { id: 'rinnovo', say: 'Rinfrescare casa', mq: true, def: 85 },
  { id: 'finestre', say: 'Cambiare le finestre', mq: false },
  { id: 'tetto', say: 'Rifare il tetto', mq: true, def: 110 },
  { id: 'cappotto', say: 'Fare il cappotto', mq: true, def: 120 },
  { id: 'fv', say: 'Il fotovoltaico', mq: false },
  { id: 'pdc', say: 'La pompa di calore', mq: false },
  { id: 'pavimenti', say: 'I pavimenti nuovi', mq: true, def: 70 },
  { id: 'pitture', say: 'Imbiancare casa', mq: true, def: 85 },
];
const EXAMPLES = ['bagno e cucina, 80 mq a Rovereto', 'cappotto e tetto per una villetta', 'fotovoltaico con batteria', 'cambiare le finestre in alluminio'];

function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll('.em .rv:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}

function useCount(value) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, b = value, t0 = performance.now();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(b); from.current = b; return undefined; }
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value]);
  return shown;
}

function JobMenu({ job, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="slot" aria-haspopup="listbox" aria-expanded={open} aria-label={`Lavoro: ${job.say}. Cambia lavoro`} onClick={() => setOpen(!open)}>
        {job.say}<span aria-hidden="true" style={{ fontSize: '.4em', verticalAlign: '.55em', marginLeft: '.2em' }}>▼</span>
      </button>
      {open && (
        <span className="em-sugg" role="listbox" aria-label="Scegli il lavoro" style={{ left: 0, top: '100%', fontSize: '1.0625rem', letterSpacing: 'normal', lineHeight: 1.4, fontWeight: 500 }}>
          {JOBS.map((j) => (
            <button key={j.id} role="option" aria-selected={j.id === job.id} type="button" onClick={() => { onPick(j); setOpen(false); }} style={{ fontWeight: j.id === job.id ? 700 : 500 }}>{j.say}</button>
          ))}
        </span>
      )}
    </span>
  );
}

function ComuneChip({ value, onChange }) {
  const [text, setText] = useState(value.nome);
  const [list, setList] = useState([]);
  const t = useRef();
  useEffect(() => setText(value.nome), [value.nome]);
  const search = (s) => {
    setText(s);
    clearTimeout(t.current);
    if (s.length < 2) { setList([]); return; }
    t.current = setTimeout(() => api.get('/public/comuni?q=' + encodeURIComponent(s)).then(setList).catch(() => {}), 140);
  };
  return (
    <label className="em-chip" data-ui style={{ position: 'relative' }}>
      <span>Dove</span>
      <input type="text" value={text} onChange={(e) => search(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => setTimeout(() => { setList([]); setText(value.nome); }, 180)} aria-label="Comune dell'immobile" autoComplete="off" />
      {list.length > 0 && (
        <span className="em-sugg" style={{ left: 0, top: '100%' }}>
          {list.slice(0, 6).map((c) => <button type="button" key={c.nome + c.sigla} onMouseDown={() => { onChange(c); setList([]); }}>{c.nome} ({c.sigla})</button>)}
        </span>
      )}
    </label>
  );
}

export default function Home() {
  const { boot } = useApp();
  const cat = boot?.catalog;
  useReveal(!!cat);
  const brackets = boot?.fee?.brackets || [{ upTo: 50000, rate: 0.08 }, { upTo: 3000000, rate: 0.06 }, { upTo: null, rate: 0.04 }];
  const [job, setJob] = useState(JOBS[0]);
  const [mq, setMq] = useState(85);
  const [com, setCom] = useState({ nome: 'Trento', sigla: 'TN' });
  const [lvl, setLvl] = useState(1);
  const [abitata, setAbitata] = useState(false);

  const q = (lavori, m, extra = {}) => {
    if (!cat) return null;
    try { return computeQuote(cat, { level: 1, province: com.sigla, lines: linesFromAnswers({ lavori, mq: m || 90, piani: 1 }), iva: 'nessuna', ...extra }); } catch { return null; }
  };
  const quote = useMemo(() => q([job.id], job.mq ? mq : 90, { level: lvl, flags: abitata ? ['abitata'] : [], lines: linesFromAnswers({ lavori: [job.id], mq: job.mq ? mq : 90, piani: ['cappotto', 'tetto'].includes(job.id) ? 2 : 1 }) }),
    [cat, job.id, mq, com.sigla, lvl, abitata]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useCount(quote ? quote.prudent.imponibile : 0);
  const mainPkg = quote && cat ? cat.packages.find((p) => p.code === quote.lines[0]?.pkg) : null;
  const quoteHref = `/quota?lavori=${job.id}${job.mq ? `&mq=${mq}` : ''}`;
  const months = quote?.lines[0]?.duration || 'Il cantiere';
  const sal = cat?.params?.sal || [];

  // "Scrivilo come lo diresti"
  const [text, setText] = useState(EXAMPLES[0]);
  const [parsed, setParsed] = useState(null);
  const tt = useRef();
  useEffect(() => {
    clearTimeout(tt.current);
    if (text.trim().length < 5) { setParsed(null); return undefined; }
    tt.current = setTimeout(() => api.post('/public/describe', { text }).then(setParsed).catch(() => setParsed(null)), 350);
    return () => clearTimeout(tt.current);
  }, [text]);
  const typedQuote = useMemo(() => (parsed?.lavori?.length ? q(parsed.lavori, parsed.mq) : null), [cat, parsed, com.sigla]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frammento del report per le agenzie
  const report = useMemo(() => {
    if (!cat) return null;
    try { return computeQuote(cat, { level: 1, province: 'TN', lines: linesFromAnswers({ lavori: ['completa', 'finestre'], mq: 85 }) }); } catch { return null; }
  }, [cat]);

  return (
    <div className="em">
      {/* La frase col prezzo dentro */}
      <section className="em-hero wrap" aria-labelledby="h-hero">
        <h1 id="h-hero">
          <span className="line"><span><JobMenu job={job} onPick={(j) => { setJob(j); if (j.mq) setMq(j.def); }} /></span></span>
          <span className="line"><span>costa <span className="price" aria-live="polite">{quote ? eur(shown) : '…'}</span></span></span>
        </h1>
        <div className="em-chips act-fade" role="group" aria-label="Dettagli del lavoro">
          <ComuneChip value={com} onChange={setCom} />
          <div className="em-chip" data-ui>
            <span>Materiali</span>
            <div className="seg">{LEVELS.map((l, i) => <button key={l} type="button" aria-pressed={lvl === i} onClick={() => setLvl(i)}>{l}</button>)}</div>
          </div>
          {job.mq ? (
            <div className="em-chip" data-ui>
              <span>Superficie</span>
              <div className="seg" style={{ alignItems: 'center' }}>
                <button type="button" aria-label="Meno metri quadri" onClick={() => setMq(Math.max(20, mq - 10))}>−</button>
                <b style={{ minWidth: '4.5ch', textAlign: 'center' }}>{mq} m²</b>
                <button type="button" aria-label="Più metri quadri" onClick={() => setMq(Math.min(600, mq + 10))}>+</button>
              </div>
            </div>
          ) : null}
          <div className="em-chip" data-ui>
            <span>Durante i lavori</span>
            <button type="button" className="sw" aria-pressed={abitata} onClick={() => setAbitata(!abitata)}><i aria-hidden="true" />{abitata ? 'Ci abito' : 'Casa libera'}</button>
          </div>
        </div>
        <p className="sub act-fade">EdilMen calcola il prezzo dei lavori in casa voce per voce e lo mette in gara tra imprese verificate. È il massimo: al sopralluogo può solo scendere.</p>
        <div className="act act-fade">
          <Link to={quoteHref} className="btn-em">Ricevi le offerte reali</Link>
          <a href="#dentro" className="lnk">Cosa c'è dentro questo prezzo</a>
        </div>
      </section>

      {/* Il problema */}
      <section className="em-wait sec" aria-labelledby="h-wait" style={{ paddingTop: 'clamp(72px, 8vw, 140px)' }}>
        <div className="wrap grid12">
          <div className="head">
            <h2 id="h-wait" className="rv">Il preventivo arriva lunedì. Forse.</h2>
            <p className="rv d1">Mandi foto e misure, l'impresa dice «stasera te lo mando», e passa una settimana. A volte due mesi. Succede in quasi ogni lavoro in casa. Per questo da noi il prezzo c'è prima della telefonata, scritto voce per voce.</p>
          </div>
          <div className="calls">
            <figure className="rv d1"><img src="/img/cliente-attesa.jpg" alt="Un cliente al telefono chiede se il preventivo è pronto" loading="lazy" /><figcaption>«È pronto il preventivo?»</figcaption></figure>
            <figure className="rv d2"><img src="/img/muratore-telefono.jpg" alt="Un muratore in cantiere promette il preventivo per la sera" loading="lazy" /><figcaption>«Te lo mando stasera!»</figcaption></figure>
          </div>
        </div>
        <div className="wrap">
          <div className="strip rv"><img src="/img/settimana.jpg" alt="Lo stesso cliente in attesa del preventivo, da lunedì a domenica" loading="lazy" /></div>
          <div className="days" aria-hidden="true"><span>Lunedì</span><span>Martedì</span><span>Mercoledì</span><span>Giovedì</span><span>Venerdì</span><span>Sabato</span><span>Domenica</span></div>
        </div>
      </section>

      {/* Da qui al cantiere */}
      <section className="em-bar sec wrap" aria-labelledby="h-bar" style={{ paddingTop: 0 }}>
        <h2 id="h-bar" className="rv">Da qui al cantiere</h2>
        <div className="bar" data-ui>
          <div className="seg s1 rv"><strong>Due minuti</strong></div>
          <div className="seg s2 rv d1"><strong>Due giorni</strong></div>
          <div className="seg s3 rv d2"><strong>Una settimana</strong></div>
          <div className="seg s4 rv d3"><strong>{months}</strong></div>
        </div>
        <div className="cap">
          <p>Vedi il prezzo, qui sopra.</p>
          <p>Arrivano le offerte vere delle imprese della zona.</p>
          <p>Sopralluogo gratuito: il prezzo può solo scendere. Poi firmi.</p>
          <p>Il cantiere, che paghi a tappe, solo a lavoro fatto e fotografato.</p>
        </div>
        <div className="salhead">
          <h3 className="rv">Paghi a lavoro fatto</h3>
          <p className="rv d1">Ogni tappa la chiede l'impresa con le foto, tu la approvi, poi paghi. Nessun extra senza una variante scritta e firmata prima.</p>
        </div>
        <div className="sal" data-ui>
          {sal.map((s, i) => <div key={s.name} className={`rv d${i % 3}`} style={{ flex: s.share * 100 }}><b>{Math.round(s.share * 100)}%</b>{s.name}</div>)}
        </div>
      </section>

      {/* Scrivilo come lo diresti */}
      <section className="em-type sec wrap" aria-labelledby="h-type">
        <h2 id="h-type" className="rv">Scrivilo come lo diresti</h2>
        <label className="rv d1">
          <span className="sr-only">Descrivi il lavoro</span>
          <span className="field" data-ui><input className="big" value={text} onChange={(e) => setText(e.target.value)} spellCheck="false" /></span>
        </label>
        <div className="ex">{EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setText(e)}>{e}</button>)}</div>
        <div className="answer" aria-live="polite">
          <div className="rows" data-ui>
            {!typedQuote ? <div className="row" style={{ color: 'var(--muted)' }}>Scrivi un lavoro: bagno, tetto, finestre, cappotto…</div> : (
              <>
                {typedQuote.lines.slice(0, 5).map((l, i) => <div className="row" key={i}><span>{l.name}</span><span>{eur(l.totPrudent)}</span></div>)}
                <div className="tot"><span>Prezzi di {com.nome}, materiali intermedi</span><span>{eur(typedQuote.prudent.imponibile)}</span></div>
              </>
            )}
          </div>
          <div className="side">
            <p>Leggiamo la frase, la traduciamo nei pacchetti del listino e ti diamo il prezzo. Poi solo le domande che servono, una alla volta.</p>
            <Link className="btn-em" style={{ marginTop: 24 }} to={`/quota?${new URLSearchParams({ lavori: (parsed?.lavori || []).join(','), desc: text, ...(parsed?.mq ? { mq: parsed.mq } : {}) })}`}>Continua da qui</Link>
          </div>
        </div>
      </section>

      {/* Il cartello di cantiere */}
      <section className="em-sign wrap" aria-labelledby="h-sign">
        <div className="head">
          <h2 id="h-sign" className="rv">Il cartello di cantiere, prima del cantiere</h2>
          <p className="rv d1">Ogni cantiere in Italia espone un cartello con lavori, importo e tempi. Noi te lo diamo prima di cominciare: è quello che hai scelto in cima alla pagina, scritto come sarà.</p>
        </div>
        <div className="card rv" data-ui>
          <h3>Cartello di cantiere</h3>
          <div className="sub">Comune di {com.nome} · provincia di {com.sigla}</div>
          <dl>
            <dt>Lavori</dt><dd>{mainPkg?.name || job.say}</dd>
            <dt>Materiali</dt><dd>Livello {LEVELS[lvl].toLowerCase()}</dd>
            <dt>Titolo abilitativo</dt><dd>{quote?.lines[0]?.permit || '—'}</dd>
            <dt>Durata prevista</dt><dd>{quote?.lines[0]?.duration || '—'}</dd>
            <dt>Impresa esecutrice</dt><dd>scelta da te tra le offerte</dd>
            <dt>Coordinamento</dt><dd>EdilMen</dd>
          </dl>
          <div className="imp"><span>Importo massimo dei lavori</span><b>{eur(quote?.prudent.imponibile)}</b></div>
          <div className="salrow">{sal.map((s) => <span key={s.name} style={{ flex: s.share * 100 }}>{Math.round(s.share * 100)}%</span>)}</div>
          <p style={{ fontSize: 14, marginTop: 18, color: '#6b5254' }}>Minimo, se il sopralluogo non trova imprevisti: {eur(quote?.fixed.imponibile)}. IVA esclusa.</p>
        </div>
      </section>

      {/* Cosa c'è dentro */}
      <section id="dentro" className="em-inside sec wrap" aria-labelledby="h-inside">
        <h2 id="h-inside" className="rv">Cosa c'è dentro {quote ? `i ${eur(quote.prudent.imponibile)}` : 'il prezzo'}</h2>
        <div className="body grid12">
          <div className="pic rv"><img src="/img/muratore-telefono.jpg" alt="Un muratore al lavoro in un cantiere di ristrutturazione" loading="lazy" /><p>Le stesse voci per tutte le imprese: cambia il prezzo, non il lavoro.</p></div>
          <div className="word">Capitolato</div>
          <div className="table rv d1">
            {mainPkg ? (
              <>
                <div className="grp">Incluso nel prezzo</div>
                {mainPkg.checklist.filter((c) => c.state === 'incluso').slice(0, 8).map((c, i) => <div className="r" key={i}><span>{c.title}<small>{c.levels?.[lvl]}</small></span><span>Sì</span></div>)}
                {mainPkg.variables?.length > 0 && <div className="grp">Solo se serve, a misura</div>}
                {(mainPkg.variables || []).slice(0, 3).map((v) => <div className="r" key={v.code}><span>{v.name}<small>{v.when}</small></span><span>{eur(v.prices[lvl])}/{v.unit}</span></div>)}
                {mainPkg.checklist.some((c) => c.state === 'escluso') && <div className="grp">Escluso</div>}
                {mainPkg.checklist.filter((c) => c.state === 'escluso').slice(0, 3).map((c, i) => <div className="r" key={'x' + i}><span>{c.title}</span><span>—</span></div>)}
                <Link to={`/prezzi/${mainPkg.code}`} className="lnk" style={{ display: 'inline-block', marginTop: 28 }}>Tutte le voci del pacchetto</Link>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Agenzie, investitori, condomini */}
      <section className="em-pro sec wrap" aria-labelledby="h-pro" style={{ paddingTop: 0 }}>
        <div className="grid12">
          <div className="txt">
            <h2 id="h-pro" className="rv">I lavori stimati prima del rogito</h2>
            <p className="rv d1">Per le agenzie immobiliari, un report dei lavori per ogni immobile, con il nome dell'agenzia, da dare all'acquirente. Per chi investe, il margine dell'operazione prima dell'offerta. Per condomini e palazzine, la gara tra imprese su computo, voce per voce.</p>
            <ul className="rv d2">
              <li><Link className="lnk" to="/agenzie">Area agenzie e investitori</Link></li>
              <li><Link className="lnk" to="/grandi-operazioni">Gara su computo per grandi lavori</Link></li>
            </ul>
          </div>
          <div className="frag rv d1" data-ui aria-label="Esempio di report lavori per un immobile">
            <div style={{ fontSize: 13, color: '#7a4a4e' }}>Report lavori · esempio per un'agenzia</div>
            <div className="t">Trilocale in centro a Trento · 85 m²</div>
            <div className="k">
              <div>Prezzo richiesto<b>250.000 €</b></div>
              <div className="d">Lavori, IVA inclusa<b>{report ? eur(report.prudent.totale) : '—'}</b></div>
              <div>Stima dopo i lavori<b>345.000 €</b></div>
            </div>
            <div style={{ marginTop: 16 }}>
              {report?.lines.map((l, i) => <div className="ln" key={i}><span>{l.name}</span><b>{eur(l.totPrudent)}</b></div>)}
              {report ? <div className="ln"><span>Sicurezza e spese tecniche</span><b>{eur(report.prudent.sicurezza + report.prudent.tecniche)}</b></div> : null}
              {report ? <div className="ln"><span>Margine stimato dell'operazione</span><b>{eur(345000 - 250000 - report.prudent.totale)}</b></div> : null}
            </div>
            <p style={{ fontSize: 13, color: '#7a4a4e', marginTop: 14 }}>Stessa base di prezzo del calcolo per i privati. Il report porta il logo dell'agenzia.</p>
          </div>
        </div>
      </section>

      {/* Per le imprese, in una frase */}
      <section className="em-plan sec wrap" aria-labelledby="h-plan">
        <p className="lead rv">Per le imprese e gli artigiani della rete</p>
        <h2 id="h-plan" className="rv d1">Entri gratis. Paghi <span className="pct">{Math.round(brackets[0].rate * 100)}%</span> se firmi.</h2>
        <div className="foot">
          <p className="rv d1">La fee si paga a ogni stato di avanzamento, solo sui lavori che arrivano da EdilMen: {brackets.map((b) => `${Math.round(b.rate * 100)}%${b.upTo ? ` fino a ${eur(b.upTo)}` : ' oltre'}`).join(', ')}. Il contratto lo firmi tu, fatturi tu, il cliente resta tuo.</p>
          <div className="cta rv d2">
            <Link to="/per-le-imprese" className="btn-em on-field">Entra nella rete</Link>
            <Link to="/software-imprese" className="lnk">Il gestionale per l'impresa, da 30 € al mese</Link>
          </div>
        </div>
      </section>

      {/* Domande */}
      <section className="em-faq sec wrap" aria-labelledby="h-faq">
        <div className="q" style={{ marginBottom: 80 }}><h2 id="h-faq">Le domande vere</h2></div>
        {[
          ['Perché il prezzo può solo scendere?', 'Il prezzo che vedi è la parte fissa del pacchetto più un accantonamento per gli imprevisti tipici. Al sopralluogo, se non ci sono, l\'accantonamento sparisce. Sale solo se aggiungi lavori, o per un imprevisto fotografato e approvato da te per iscritto.'],
          ['Chi sono le imprese?', 'Imprese della zona con visura, DURC, assicurazione e patente a crediti controllati. Il rating nasce dalle recensioni di lavori fatti tramite EdilMen, e nessuno può comprarlo.'],
          ['Quanto mi costa?', 'Niente. Ci paga l\'impresa, solo sui lavori che firmi con lei, a ogni tappa di pagamento.'],
          ['Le imprese avranno il mio telefono?', 'Solo quella che scegli, e solo se lo autorizzi. Alle altre passiamo la descrizione del lavoro e il comune.'],
          ['E se nella mia zona non c\'è nessuno?', 'Te lo diciamo. Vedi comunque il prezzo di riferimento, e invitiamo noi le imprese verificate più vicine.'],
        ].map(([qq, a]) => <div className="q rv" key={qq}><h3>{qq}</h3><p>{a}</p></div>)}
      </section>

      {/* Chiusura */}
      <section className="em-close" aria-labelledby="h-close">
        <div className="cta wrap">
          <h2 id="h-close" className="rv">Prima il prezzo.<br />Poi il cantiere.</h2>
          <div className="row">
            <p>Tre minuti per sapere quanto costa davvero il tuo lavoro, e chi può farlo vicino a te.</p>
            <Link to={quoteHref} className="btn-em on-field">Calcola il tuo prezzo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
