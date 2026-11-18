import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { computeQuote, LEVELS } from '@shared/pricing.js';
import { LAVORI, GROUPS, IMMOBILI, linesFromAnswers, defaultFor } from '@shared/lavori.js';
import { useApp, eur, num, Choice, ComuneInput, Stepper, ErrorBox, Spinner, useToast, Field } from '../../ui.jsx';
import { api } from '../../api.js';

const STORE = 'em27-quota';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* storage non disponibile */ } };

export function QuoteBreakdown({ quote, catalog, compact = false }) {
  const [openPkg, setOpenPkg] = useState(null);
  if (!quote) return null;
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-paper"><tr><th className="th">Lavoro</th><th className="th text-right">Quantità</th><th className="th text-right hidden sm:table-cell">Prezzo unitario</th><th className="th text-right">Importo</th></tr></thead>
          <tbody className="divide-y divide-line">
            {quote.lines.map((l, i) => {
              const pkg = catalog?.packages.find((p) => p.code === l.pkg);
              return (
                <React.Fragment key={i}>
                  <tr>
                    <td className="td">
                      <div className="font-semibold">{l.name}</div>
                      <div className="text-xs text-ink-mute">{l.pkg} · {l.duration}{l.permit ? ` · ${l.permit}` : ''}</div>
                      {!compact && pkg?.checklist?.length > 0 && <button className="text-xs text-brand font-semibold mt-1" onClick={() => setOpenPkg(openPkg === i ? null : i)}>{openPkg === i ? 'Chiudi' : 'Cosa è incluso'}</button>}
                    </td>
                    <td className="td text-right whitespace-nowrap">{num(l.qty, 1)} {l.unit}</td>
                    <td className="td text-right whitespace-nowrap hidden sm:table-cell">{eur(l.unitPrudent)}</td>
                    <td className="td text-right font-semibold whitespace-nowrap">{eur(l.totPrudent)}</td>
                  </tr>
                  {openPkg === i && pkg && (
                    <tr><td colSpan={4} className="bg-paper px-4 py-4"><Checklist pkg={pkg} level={quote.level} /></td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="text-sm">
            <tr className="border-t border-line"><td className="td" colSpan={3}>Lavori (prezzo prudente)</td><td className="td text-right">{eur(quote.prudent.lavori)}</td></tr>
            <tr><td className="td" colSpan={3}>Oneri della sicurezza</td><td className="td text-right">{eur(quote.prudent.sicurezza)}</td></tr>
            {quote.prudent.tecniche > 0 && <tr><td className="td" colSpan={3}>Progetto, direzione lavori e pratiche</td><td className="td text-right">{eur(quote.prudent.tecniche)}</td></tr>}
            <tr className="font-bold"><td className="td" colSpan={3}>Totale IVA esclusa</td><td className="td text-right">{eur(quote.prudent.imponibile)}</td></tr>
            <tr className="text-ink-soft"><td className="td" colSpan={3}>IVA {num(quote.prudent.ivaRate * 100)}% (da verificare sul tuo caso)</td><td className="td text-right">{eur(quote.prudent.iva)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="text-xs text-ink-mute space-y-1">
        <p>Zona: {quote.territory.label} (coefficiente {num(quote.territory.coef, 2)}){quote.logistics.applied.length ? ` · ${quote.logistics.applied.map((a) => a.label).join(', ')}` : ''}.</p>
        {!quote.territory.calibrated && <p className="text-warn font-semibold">In questa provincia il listino non è ancora tarato sui prezzi locali: usa la stima come ordine di grandezza.</p>}
      </div>
    </div>
  );
}

export function Checklist({ pkg, level = 1 }) {
  const groups = { incluso: ['✓ Incluso nel prezzo', 'text-ok'], a_parte: ['± A parte, solo se serve (a misura, con variante scritta)', 'text-warn'], escluso: ['✕ Escluso', 'text-bad'] };
  return (
    <div className="grid md:grid-cols-3 gap-4 text-sm">
      {Object.entries(groups).map(([k, [title, cls]]) => {
        const items = k === 'a_parte' && pkg.variables?.length ? [] : pkg.checklist.filter((c) => c.state === k);
        if (!items.length && k !== 'a_parte') return null;
        return (
          <div key={k}>
            <div className={`font-semibold mb-2 ${cls}`}>{title}</div>
            <ul className="space-y-1.5">
              {items.map((c, i) => <li key={i} title={c.detail}><span className="font-medium">{c.title}</span>{c.levels?.[level] && k === 'incluso' && <span className="block text-xs text-ink-mute">{c.levels[level]}</span>}</li>)}
              {k === 'a_parte' && pkg.variables?.map((v) => <li key={v.code}><span className="font-medium">{v.name}</span><span className="block text-xs text-ink-mute">{v.when} · {eur(v.prices[level])}/{v.unit}</span></li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function Wizard({ mode = 'public', property = null, onSaved }) {
  const { boot, user } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const catalog = boot?.catalog;
  const initial = useMemo(() => {
    const fromUrl = sp.get('lavori');
    const saved = mode === 'public' && !fromUrl ? load() : null;
    if (saved?.a?.lavori?.length) return saved;
    return {
      i: fromUrl && !sp.get('desc') ? 1 : 0,
      a: {
        lavori: fromUrl ? fromUrl.split(',').filter((id) => LAVORI.some((l) => l.id === id)) : [],
        comune: property?.comune || '', provincia: property?.provincia || '', regione: '',
        immobile: property?.tipo || null, mq: Number(sp.get('mq')) || Number(property?.mq) || 90, piani: Number(property?.piani) || 1,
        level: 1, flags: [], tecnico: null, dett: {}, desc: sp.get('desc') || '',
      },
    };
  }, []); // eslint-disable-line
  const [i, setI] = useState(initial.i);
  const [a, setA] = useState(initial.a);
  const [contact, setContact] = useState({ name: user?.name || '', phone: user?.phone || '', email: user?.email || '', channel: 'telefono', privacy: false, condivisione: true, marketing: false, password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setA((s) => ({ ...s, [k]: v }));
  const setD = (job, k, v) => setA((s) => ({ ...s, dett: { ...s.dett, [job]: { ...(s.dett[job] || {}), [k]: v } } }));

  const jobs = a.lavori.map((id) => LAVORI.find((l) => l.id === id)).filter(Boolean);
  const steps = useMemo(() => {
    const s = ['lavori', 'dove', 'immobile'];
    for (const j of jobs) if (j.ask.length) s.push('job:' + j.id);
    s.push('livello', 'cantiere', 'risultato');
    if (mode === 'public') s.push('contatto');
    return s;
  }, [a.lavori.join(','), mode]); // eslint-disable-line
  const step = steps[Math.min(i, steps.length - 1)];
  useEffect(() => { if (mode === 'public') save({ i, a }); }, [i, a, mode]);

  const quoteFor = (lvl) => {
    if (!catalog || !a.lavori.length) return null;
    try { return computeQuote(catalog, { level: lvl, province: a.provincia || null, flags: a.flags, montagna: a.flags.includes('montagna'), tecnico: a.tecnico === 'aiuto', lines: linesFromAnswers(a) }); } catch { return null; }
  };
  const quote = useMemo(() => quoteFor(a.level), [catalog, a]); // eslint-disable-line
  const next = () => { setErr(null); setI((x) => Math.min(x + 1, steps.length - 1)); };
  const back = () => setI((x) => Math.max(0, x - 1));

  if (!catalog) return <Spinner />;

  const submit = async () => {
    setErr(null);
    if (!contact.phone && !contact.email) return setErr('Lasciaci un telefono o un\'email');
    if (!contact.privacy) return setErr('Serve la presa visione dell\'informativa privacy');
    setBusy(true);
    try {
      const r = await api.post('/public/requests', {
        answers: a,
        contact: { name: contact.name, phone: contact.phone, email: contact.email, channel: contact.channel },
        consents: { privacy: contact.privacy, condivisione: contact.condivisione, marketing: contact.marketing },
        account: contact.password ? { password: contact.password } : undefined,
      });
      save(null);
      nav(`/richiesta/${r.token}`, { state: { fresh: true, code: r.code } });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveEstimate = async (requestOffers) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.post('/me/estimates', { answers: a, propertyId: property?.id || null, requestOffers });
      toast(requestOffers ? `Richiesta ${r.code} inviata alle imprese` : `Stima ${r.code} salvata`);
      onSaved?.(r);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const progress = Math.round(((i + 1) / steps.length) * 100);
  const Head = ({ title, sub }) => (<div className="mb-6"><h2 className="text-2xl sm:text-3xl font-extrabold">{title}</h2>{sub && <p className="text-ink-soft mt-1">{sub}</p>}</div>);
  const Next = ({ disabled, label = 'Avanti' }) => <button className="btn-primary btn-lg w-full mt-6" disabled={disabled} onClick={next}>{label} →</button>;

  let body = null;
  if (step === 'lavori') {
    body = (
      <>
        <Head title="Cosa devi fare?" sub="Scegli uno o più lavori. Ti faremo solo le domande che servono." />
        {a.desc && <div className="rounded-xl bg-brand-soft text-sm p-3 mb-4"><b>Hai scritto:</b> «{a.desc}». Abbiamo preselezionato i lavori: controlla e correggi.</div>}
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <div className="text-sm font-bold text-ink-soft mb-2">{g.icon} {g.label}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {LAVORI.filter((l) => l.group === g.id).map((l) => {
                  const on = a.lavori.includes(l.id);
                  return <Choice key={l.id} icon={l.icon} title={l.label} sub={l.sub} active={on} onClick={() => set('lavori', on ? a.lavori.filter((x) => x !== l.id) : [...a.lavori, l.id])} />;
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 bg-paper/95 backdrop-blur pt-2 pb-3">
          <Next disabled={!a.lavori.length} label={a.lavori.length ? `Continua con ${a.lavori.length} lavor${a.lavori.length > 1 ? 'i' : 'o'}` : 'Scegli almeno un lavoro'} />
          <p className="text-center text-sm mt-3 text-ink-soft">Non trovi il tuo caso? <Link to="/vocale" className="text-brand font-semibold">Mandaci un vocale</Link>{mode === 'public' && <> o <Link to="/grandi-operazioni" className="text-brand font-semibold">chiedi offerte su computo</Link></>}</p>
        </div>
      </>
    );
  } else if (step === 'dove') {
    body = (
      <>
        <Head title="Dove si trova l'immobile?" sub="Scrivi il comune: provincia e regione le capiamo noi. Servono per il listino giusto e per le imprese vicine." />
        <ComuneInput autoFocus value={a.comune ? { nome: a.comune, sigla: a.provincia } : null} onChange={(c) => setA((s) => ({ ...s, comune: c.nome, provincia: c.sigla, regione: c.regione }))} />
        <button className="text-sm text-ink-soft mt-3 underline" onClick={() => { setA((s) => ({ ...s, comune: '', provincia: '' })); next(); }}>Non lo so ancora di preciso</button>
        <Next disabled={!a.comune} />
      </>
    );
  } else if (step === 'immobile') {
    const needsSize = jobs.some((j) => ['completa', 'rinnovo', 'pitture', 'pavimenti', 'elettrico', 'domotica', 'sgombero', 'casanuova', 'rustico', 'cappotto', 'tetto', 'facciata', 'sottotetto'].includes(j.id));
    body = (
      <>
        <Head title="Com'è l'immobile?" sub="A occhio va benissimo: i metri esatti li misura il tecnico al sopralluogo." />
        <div className="grid sm:grid-cols-2 gap-2">
          {IMMOBILI.map(([k, t, s, ic]) => <Choice key={k} icon={ic} title={t} sub={s} active={a.immobile === k} onClick={() => set('immobile', k)} />)}
        </div>
        {needsSize && (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <Field label={a.lavori.some((x) => ['casanuova', 'rustico'].includes(x)) ? 'Metri quadri da costruire' : 'Metri quadri calpestabili'} hint="Li trovi sulla planimetria o sull'atto di acquisto.">
              <div className="flex items-center gap-2">
                <input type="number" min="10" max="5000" className="input text-lg font-bold" value={a.mq} onChange={(e) => set('mq', Number(e.target.value))} />
                <span className="text-ink-soft">m²</span>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">{[['Bilocale', 55], ['Trilocale', 85], ['4 locali', 110], ['Villetta', 150]].map(([l, v]) => <button type="button" key={l} onClick={() => set('mq', v)} className="chip bg-white border border-line">{l} ~{v}</button>)}</div>
            </Field>
            <Field label="Quanti piani?"><Stepper value={a.piani} min={1} max={12} onChange={(v) => set('piani', v)} /></Field>
          </div>
        )}
        <Next disabled={!a.immobile} />
      </>
    );
  } else if (step.startsWith('job:')) {
    const L = LAVORI.find((l) => l.id === step.slice(4));
    const casa = { mq: a.mq, piani: a.piani };
    const val = (q) => a.dett[L.id]?.[q.id] ?? defaultFor(q, casa);
    body = (
      <>
        <Head title={`${L.icon} ${L.label}`} sub="Due dettagli e il prezzo diventa preciso." />
        <div className="space-y-6">
          {L.ask.map((q) => (
            <div key={q.id}>
              <div className="font-semibold mb-2">{q.label}</div>
              {q.type === 'count' && <Stepper value={Number(val(q)) || q.min || 1} min={q.min} max={q.max} onChange={(v) => setD(L.id, q.id, v)} />}
              {q.type === 'number' && (
                <div className="flex items-center gap-2 max-w-xs">
                  <input type="number" className="input text-lg font-bold" value={val(q) ?? ''} onChange={(e) => setD(L.id, q.id, Number(e.target.value))} />
                  <span className="text-ink-soft">{q.unit}</span>
                </div>
              )}
              {q.type === 'choice' && <div className="grid sm:grid-cols-2 gap-2">{q.options.map(([k, l]) => <Choice key={k} title={l} active={val(q) === k} onClick={() => setD(L.id, q.id, k)} />)}</div>}
              {q.hint && <p className="text-xs text-ink-mute mt-1.5">{q.hint}</p>}
            </div>
          ))}
        </div>
        <Next />
      </>
    );
  } else if (step === 'livello') {
    const qs = [0, 1, 2].map(quoteFor);
    const desc = ['Materiali di buona qualità, scelte essenziali', 'Il miglior rapporto qualità/prezzo: la scelta più comune', 'Materiali e finiture di pregio'];
    body = (
      <>
        <Head title="Che livello di materiali?" sub="Cambiano solo i materiali, mai le lavorazioni. Potrai cambiare idea anche dopo." />
        <div className="space-y-2">
          {LEVELS.map((l, k) => <Choice key={l} title={l + (k === 1 ? ' · consigliato' : '')} sub={desc[k]} right={qs[k] ? `da ${eur(qs[k].fixed.imponibile)}` : ''} active={a.level === k} onClick={() => set('level', k)} />)}
        </div>
        <Next />
      </>
    );
  } else if (step === 'cantiere') {
    const F = [['abitata', 'Ci vivrai durante i lavori', '🛋️'], ['noasc', 'Piano alto senza ascensore', '🪜'], ['ztl', 'Centro storico, vincoli o accesso difficile', '🏛️'], ['montagna', 'Località sopra i 1.000 m', '⛰️']];
    body = (
      <>
        <Head title="Qualcosa di particolare?" sub="Segna solo quello che vale per te: cambia il prezzo in modo trasparente." />
        <div className="grid sm:grid-cols-2 gap-2">
          {F.map(([k, l, ic]) => { const on = a.flags.includes(k); return <Choice key={k} icon={ic} title={l} active={on} onClick={() => set('flags', on ? a.flags.filter((x) => x !== k) : [...a.flags, k])} />; })}
        </div>
        <div className="font-semibold mt-8 mb-2">Hai già un tecnico per progetto e pratiche?</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Choice title="Sì, ho già tutto" active={a.tecnico === 'ho'} onClick={() => set('tecnico', 'ho')} />
          <Choice title="No, includetelo nel prezzo" sub={`+${num((catalog.params.tecniche || 0) * 100)}% per progetto, DL e pratiche`} active={a.tecnico === 'aiuto'} onClick={() => set('tecnico', 'aiuto')} />
          <Choice title="Non serve / non so" active={a.tecnico === 'no'} onClick={() => set('tecnico', 'no')} />
        </div>
        <Next label="Vedi il prezzo" />
      </>
    );
  } else if (step === 'risultato' && quote) {
    body = (
      <>
        <Head title="Ecco quanto costa" sub={`${a.comune ? a.comune + ' · ' : ''}livello ${LEVELS[a.level].toLowerCase()} · IVA esclusa`} />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-ok-soft p-5"><div className="text-sm text-ok font-bold">Minimo · parte fissa</div><div className="text-3xl font-extrabold mt-1">{eur(quote.fixed.imponibile)}</div><div className="text-xs text-ink-soft mt-1">se al sopralluogo non emerge nessun imprevisto</div></div>
          <div className="rounded-2xl bg-navy text-white p-5"><div className="text-sm text-[#d2a9ac] font-bold">Prezzo prudente · massimo</div><div className="text-3xl font-extrabold mt-1">{eur(quote.prudent.imponibile)}</div><div className="text-xs text-white/70 mt-1">comprende gli imprevisti tipici: al sopralluogo può solo scendere</div></div>
        </div>
        <div className="flex gap-1.5 my-4">{LEVELS.map((l, k) => <button key={l} onClick={() => set('level', k)} className={`btn-sm ${a.level === k ? 'btn-dark' : 'btn-ghost'}`}>{l}</button>)}</div>
        <QuoteBreakdown quote={quote} catalog={catalog} />
        <div className="card p-5 mt-4">
          <div className="font-bold">Come si paga: a stato di avanzamento lavori</div>
          <div className="grid grid-cols-5 gap-2 mt-3 text-center text-xs">
            {catalog.params.sal.map((s) => <div key={s.name} className="rounded-xl bg-paper p-2"><div className="font-extrabold text-base">{num(s.share * 100)}%</div><div className="text-ink-soft leading-tight mt-1">{s.name}</div></div>)}
          </div>
        </div>
        {mode === 'public' ? (
          <div className="card p-5 mt-4 bg-brand-soft border-blue-200">
            <div className="font-bold text-lg">Vuoi le offerte delle imprese?</div>
            <p className="text-sm text-ink-soft mt-1">Mandiamo la richiesta alle imprese verificate della tua zona: vedi solo offerte reali, fino a tre, anonime fino al sopralluogo. Gratis e senza impegno.</p>
            <button className="btn-primary btn-lg w-full mt-4" onClick={next}>Ricevi le offerte →</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2 mt-4">
            <button className="btn-ghost btn-lg" disabled={busy} onClick={() => saveEstimate(false)}>Salva la stima</button>
            <button className="btn-primary btn-lg" disabled={busy} onClick={() => saveEstimate(true)}>Salva e chiedi offerte reali</button>
          </div>
        )}
        <ErrorBox>{err}</ErrorBox>
      </>
    );
  } else if (step === 'contatto') {
    const c = contact, sc = (k) => (e) => setContact((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    body = (
      <>
        <Head title="Come ti ricontattiamo?" sub="Solo così, e solo per questa richiesta." />
        <div className="grid sm:grid-cols-3 gap-2 mb-4">
          {[['telefono', '📞 Chiamata'], ['whatsapp', '💬 WhatsApp'], ['email', '✉️ Email']].map(([k, l]) => <Choice key={k} title={l} active={c.channel === k} onClick={() => setContact((s) => ({ ...s, channel: k }))} />)}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome"><input className="input" value={c.name} onChange={sc('name')} autoComplete="name" /></Field>
          <Field label={c.channel === 'email' ? 'Telefono (facoltativo)' : 'Telefono'}><input className="input" value={c.phone} onChange={sc('phone')} autoComplete="tel" inputMode="tel" /></Field>
          <Field label={c.channel === 'email' ? 'Email' : 'Email (facoltativa)'} className="sm:col-span-2"><input className="input" type="email" value={c.email} onChange={sc('email')} autoComplete="email" /></Field>
          {!user && c.email && (
            <Field label="Crea una password per seguire la richiesta online (facoltativo)" hint="Con l'account vedi le offerte, prenoti il sopralluogo e approvi i SAL." className="sm:col-span-2">
              <input className="input" type="password" value={c.password} onChange={sc('password')} autoComplete="new-password" placeholder="Almeno 8 caratteri" />
            </Field>
          )}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex gap-2 items-start"><input type="checkbox" className="mt-1" checked={c.privacy} onChange={sc('privacy')} /><span>Ho letto l'<Link to="/privacy" className="text-brand underline" target="_blank">informativa privacy</Link>. Usate i miei dati solo per rispondere a questa richiesta.</span></label>
          <label className="flex gap-2 items-start"><input type="checkbox" className="mt-1" checked={c.condivisione} onChange={sc('condivisione')} /><span>Quando scelgo un'impresa, può ricevere il mio nome e il mio contatto per organizzare il sopralluogo. Alle altre imprese passa solo la descrizione del lavoro e il comune.</span></label>
          <label className="flex gap-2 items-start"><input type="checkbox" className="mt-1" checked={c.marketing} onChange={sc('marketing')} /><span>Voglio ricevere novità su bonus e incentivi (facoltativo).</span></label>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary btn-lg w-full mt-6" disabled={busy} onClick={submit}>{busy ? 'Invio…' : 'Invia la richiesta'}</button>
      </>
    );
  }

  return (
    <div className={mode === 'public' ? 'max-w-3xl mx-auto px-4 py-8' : ''}>
      <div className="flex items-center gap-3 mb-6">
        {i > 0 && <button className="btn-ghost btn-sm" onClick={back}>← Indietro</button>}
        <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: progress + '%' }} /></div>
        <span className="text-xs text-ink-mute whitespace-nowrap">{i + 1} di {steps.length}</span>
      </div>
      {quote && !['risultato', 'contatto', 'lavori'].includes(step) && (
        <div className="rounded-2xl bg-white border border-line px-4 py-3 mb-6 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Stima in tempo reale, IVA esclusa</span>
          <span className="font-extrabold">{eur(quote.fixed.imponibile)} – {eur(quote.prudent.imponibile)}</span>
        </div>
      )}
      {body}
    </div>
  );
}
