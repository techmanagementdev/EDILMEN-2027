import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLoad, useApp, Spinner, ErrorBox, Empty, PageTitle, StatusBadge, Badge, eur, num, dt, useToast, Field, ComuneInput, Modal, Choice, A } from '../../ui.jsx';
import { api } from '../../api.js';
import Wizard, { QuoteBreakdown } from '../public/Wizard.jsx';
import { OffersList, AppointmentForm } from '../public/RequestStatus.jsx';

export function MyRequests() {
  const { user } = useApp();
  const { data, loading } = useLoad('/me/requests');
  if (loading) return <Spinner />;
  return (
    <>
      <PageTitle title="Le mie richieste" sub="Stime salvate, offerte delle imprese, cantieri in corso." actions={<Link to="/quota" className="btn-primary">Nuova quotazione</Link>} />
      {!data.length ? <div className="card"><Empty title="Ancora nessuna richiesta" action={<Link to="/quota" className="btn-primary">Calcola il prezzo</Link>}>Fai la prima quotazione: ci vogliono pochi minuti.</Empty></div> : (
        <div className="card divide-y divide-line">
          {data.map((r) => (
            <Link key={r.id} to={`/area/richiesta/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-paper">
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold">{r.title}</div>
                <div className="text-xs text-ink-mute">{r.code} · {dt(r.created_at)} · {r.comune || '—'}</div>
              </div>
              {r.source === 'stima' ? <Badge>Solo stima</Badge> : <StatusBadge s={r.status} />}
              <div className="text-sm text-ink-soft w-28 text-right">{r.offers ? `${r.offers} offerte` : r.kind === 'computo' ? 'su computo' : '—'}</div>
              <div className="font-bold w-28 text-right">{r.total_ref ? eur(r.total_ref) : ''}</div>
            </Link>
          ))}
        </div>
      )}
      {user?.role === 'cliente' && <p className="text-xs text-ink-mute mt-4">Sei un'agenzia o un investitore? Scrivici e abilitiamo l'area professionale sul tuo account.</p>}
    </>
  );
}

export function MyRequestDetail() {
  const { id } = useParams();
  const { boot } = useApp();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad('/me/requests/' + id);
  const [choosing, setChoosing] = useState(undefined);
  const [review, setReview] = useState({ open: false, scores: {}, text: '' });
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const { request: r, offers, contract, sal, comparison } = data;
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <Link to="/area" className="text-sm text-ink-soft">← Le mie richieste</Link>
      <PageTitle title={r.title} sub={`${r.code} · ${dt(r.created_at)} · ${r.comune || 'zona da definire'}`} actions={r.source === 'stima' ? <button className="btn-primary" onClick={() => act(() => api.post(`/me/requests/${r.id}/ask-offers`), 'Richiesta inviata alle imprese della zona')}>Chiedi offerte reali</button> : <StatusBadge s={r.status} />} />

      {r.kind === 'computo' && comparison && (
        <div className="card overflow-x-auto mb-6">
          <div className="p-4 font-bold">Confronto voce per voce</div>
          <table className="w-full min-w-[640px]"><thead className="bg-paper"><tr><th className="th">Voce</th><th className="th text-right">Q.tà</th>{comparison.offers.map((o) => <th key={o.id} className="th text-right">Impresa {o.letter}</th>)}<th className="th text-right">Mediana</th></tr></thead>
            <tbody className="divide-y divide-line">
              {comparison.items.map((it) => <tr key={it.n}><td className="td">{it.n}. {it.desc}</td><td className="td text-right whitespace-nowrap">{num(it.qty)} {it.unit}</td>{it.prices.map((p, i) => <td key={i} className={`td text-right ${it.flags[i] === 'alto' ? 'text-warn font-semibold' : it.flags[i] === 'anomalo' ? 'text-bad font-semibold' : ''}`}>{p ? eur(p, 2) : '—'}</td>)}<td className="td text-right text-ink-soft">{it.median ? eur(it.median, 2) : '—'}</td></tr>)}
              <tr className="font-bold bg-paper"><td className="td" colSpan={2}>Totale</td>{comparison.offers.map((o) => <td key={o.id} className="td text-right">{eur(o.amount)}</td>)}<td /></tr>
            </tbody></table>
          <p className="text-xs text-ink-mute p-4">In arancio i prezzi oltre il 15% sopra la mediana, in rosso quelli sotto il 25%: vanno spiegati prima di aggiudicare.</p>
        </div>
      )}

      {r.kind === 'casa' && r.source !== 'stima' && !contract && (
        <>
          <h2 className="text-xl font-extrabold mb-3">Offerte delle imprese</h2>
          <OffersList offers={offers} pendingInvites={data.pendingInvites} refPrice={r.total_ref} onChoose={(o) => setChoosing(o)} />
          {choosing !== undefined && <AppointmentForm offer={choosing} onCancel={() => setChoosing(undefined)} onSubmit={(b) => act(() => api.post(`/me/requests/${r.id}/choose`, b), 'Richiesta di appuntamento inviata').then(() => setChoosing(undefined))} />}
          {r.appointment && <div className="rounded-xl bg-brand-soft p-3 text-sm mt-3">Appuntamento richiesto: {r.appointment.mode}{r.appointment.slot ? `, ${r.appointment.slot}` : ''}. Ti contattiamo per confermare.</div>}
        </>
      )}

      {contract && (
        <div className="card p-5 mb-6">
          <div className="flex flex-wrap justify-between gap-2"><div className="font-bold text-lg">Contratto con {offers.find((o) => o.status === 'scelta')?.company?.name || 'l\'impresa'}</div><div className="font-extrabold text-lg">{eur(contract.value)} <span className="text-xs text-ink-mute font-normal">IVA esclusa</span></div></div>
          <p className="text-sm text-ink-soft">Paghi a stato di avanzamento: l'impresa chiede il SAL con le foto, tu controlli e approvi.</p>
          <div className="mt-4 divide-y divide-line">
            {sal.map((s) => (
              <div key={s.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center font-bold text-sm">{s.n}</div>
                <div className="flex-1 min-w-[200px]"><div className="font-semibold">{s.name} · {num(s.share * 100)}%</div><div className="text-xs text-ink-mute">{s.document}</div>{s.note && <div className="text-xs text-ink-soft mt-1">Nota: {s.note}</div>}
                  {s.photos?.length > 0 && <div className="flex gap-1.5 mt-2">{s.photos.map((f) => <a key={f} href={`/api/files/${f}`} target="_blank" rel="noreferrer"><img src={`/api/files/${f}`} alt="Foto SAL" className="h-14 w-14 object-cover rounded-lg border border-line" /></a>)}</div>}
                </div>
                <div className="font-bold">{eur(s.amount)}</div>
                <Badge tone={{ previsto: 'gray', richiesto: 'amber', approvato: 'green', pagato: 'navy', contestato: 'red' }[s.status]}>{s.status}</Badge>
                {s.status === 'richiesto' && <div className="flex gap-1.5"><button className="btn-primary btn-sm" onClick={() => act(() => api.post(`/me/contracts/${contract.id}/sal/${s.id}`, { action: 'approva' }), 'SAL approvato')}>Approva</button><button className="btn-danger btn-sm" onClick={() => { const note = prompt('Cosa non va?'); if (note) act(() => api.post(`/me/contracts/${contract.id}/sal/${s.id}`, { action: 'contesta', note }), 'Contestazione inviata'); }}>Contesta</button></div>}
              </div>
            ))}
          </div>
          {!data.review && sal.filter((s) => ['approvato', 'pagato'].includes(s.status)).length >= sal.length - 1 && <button className="btn-soft mt-4" onClick={() => setReview({ ...review, open: true })}>Lascia la recensione</button>}
          {data.review && <p className="text-sm text-ok mt-3">Grazie per la recensione ({data.review.status === 'pubblicata' ? 'pubblicata' : 'in verifica'}).</p>}
        </div>
      )}

      {r.quote && (<><h2 className="text-xl font-extrabold mt-8 mb-3">Prezzo di riferimento EdilMen</h2><QuoteBreakdown quote={r.quote} catalog={boot?.catalog} /></>)}

      <Modal open={review.open} onClose={() => setReview({ ...review, open: false })} title="Com'è andato il lavoro?">
        {Object.entries({ qualita: 'Qualità del lavoro', puntualita: 'Puntualità', preventivo: 'Rispetto del preventivo', pulizia: 'Pulizia del cantiere', comunicazione: 'Comunicazione' }).map(([k, l]) => (
          <div key={k} className="flex items-center justify-between py-1.5"><span className="text-sm">{l}</span><div>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setReview({ ...review, scores: { ...review.scores, [k]: n } })} className={`text-2xl ${review.scores[k] >= n ? 'text-amber-500' : 'text-slate-300'}`}>★</button>)}</div></div>
        ))}
        <textarea className="input mt-3" rows={3} value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} placeholder="Racconta in due righe" />
        <button className="btn-primary w-full mt-3" onClick={() => act(() => api.post(`/me/contracts/${contract.id}/review`, { scores: review.scores, text: review.text }), 'Recensione inviata: la verifichiamo e la pubblichiamo').then(() => setReview({ open: false, scores: {}, text: '' }))}>Invia</button>
      </Modal>
    </>
  );
}

const emptyProp = { title: '', address: '', comune: null, tipo: 'appartamento', mq: '', piani: 1, units: 1, price_ask: '', value_after: '', notes: '' };
function PropertyForm({ initial, onSaved }) {
  const [v, setV] = useState(initial ? { ...initial, comune: initial.comune ? { nome: initial.comune, sigla: initial.provincia } : null } : emptyProp);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setErr(null);
    try { const body = { ...v, comune: v.comune?.nome }; const r = initial ? await api.put('/me/properties/' + initial.id, body) : await api.post('/me/properties', body); onSaved(r); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Nome dell'immobile" className="sm:col-span-2"><input className="input" value={v.title} onChange={set('title')} placeholder="Es. Trilocale via Manci 12" /></Field>
      <Field label="Indirizzo"><input className="input" value={v.address || ''} onChange={set('address')} /></Field>
      <Field label="Comune"><ComuneInput value={v.comune} onChange={(c) => setV({ ...v, comune: c })} /></Field>
      <Field label="Tipo"><select className="input" value={v.tipo || ''} onChange={set('tipo')}><option value="appartamento">Appartamento</option><option value="casa">Casa indipendente</option><option value="negozio">Negozio o ufficio</option><option value="edificio">Intero edificio</option><option value="terreno">Terreno</option></select></Field>
      <Field label="Metri quadri"><input className="input" type="number" value={v.mq || ''} onChange={set('mq')} /></Field>
      <Field label="Piani"><input className="input" type="number" value={v.piani || 1} onChange={set('piani')} /></Field>
      <Field label="Unità (per operazioni)"><input className="input" type="number" value={v.units || 1} onChange={set('units')} /></Field>
      <Field label="Prezzo richiesto / d'acquisto (€)"><input className="input" type="number" value={v.price_ask || ''} onChange={set('price_ask')} /></Field>
      <Field label="Valore stimato a fine lavori (€)"><input className="input" type="number" value={v.value_after || ''} onChange={set('value_after')} /></Field>
      <Field label="Note" className="sm:col-span-2"><textarea className="input" rows={2} value={v.notes || ''} onChange={set('notes')} /></Field>
      <div className="sm:col-span-2"><ErrorBox>{err}</ErrorBox><button className="btn-primary mt-2" onClick={save}>Salva</button></div>
    </div>
  );
}

export function Properties() {
  const { user } = useApp();
  const nav = useNavigate();
  const { data, loading, reload } = useLoad('/me/properties');
  const [open, setOpen] = useState(false);
  if (loading) return <Spinner />;
  return (
    <>
      <PageTitle title={user.role === 'agenzia' ? 'Immobili in portafoglio' : 'Operazioni e immobili'} sub="Per ogni immobile: stima dei lavori, report da condividere, offerte reali quando servono." actions={<button className="btn-primary" onClick={() => setOpen(true)}>Aggiungi immobile</button>} />
      {!data.length ? <div className="card"><Empty title="Nessun immobile" action={<button className="btn-primary" onClick={() => setOpen(true)}>Aggiungi il primo</button>}>Inserisci un immobile e calcola in due minuti quanto costano i lavori.</Empty></div> : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.map((p) => {
            const last = p.quotes?.[0];
            return (
              <Link key={p.id} to={`/area/immobili/${p.id}`} className="card p-5 hover:shadow-lift">
                <div className="font-bold">{p.title}</div>
                <div className="text-sm text-ink-soft">{[p.comune, p.mq && `${num(p.mq)} m²`, p.units > 1 && `${p.units} unità`].filter(Boolean).join(' · ')}</div>
                <div className="flex justify-between mt-3 text-sm"><span className="text-ink-soft">{p.quotes?.length || 0} stime</span><span className="font-bold">{last?.total_ref ? `lavori ${eur(last.total_ref)}` : 'nessuna stima'}</span></div>
              </Link>
            );
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nuovo immobile" wide><PropertyForm onSaved={(p) => { setOpen(false); reload(); nav('/area/immobili/' + p.id); }} /></Modal>
    </>
  );
}

export function PropertyDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, reload } = useLoad('/me/properties');
  const [mode, setMode] = useState(null);
  if (loading) return <Spinner />;
  const p = data.find((x) => String(x.id) === id);
  if (!p) return <ErrorBox>Immobile non trovato</ErrorBox>;
  const quotes = p.quotes || [];
  const last = quotes[0];
  const lavoriIva = last?.total_ref ? last.total_ref * 1.1 : null;
  const margin = p.value_after && p.price_ask && lavoriIva ? Number(p.value_after) - Number(p.price_ask) - lavoriIva : null;
  const copy = (t) => { const url = `${window.location.origin}/report/${t}`; navigator.clipboard?.writeText(url); toast('Link del report copiato'); };
  return (
    <>
      <Link to="/area/immobili" className="text-sm text-ink-soft">← Immobili</Link>
      <PageTitle title={p.title} sub={[p.address, p.comune, p.mq && `${num(p.mq)} m²`].filter(Boolean).join(' · ')} actions={<><button className="btn-ghost" onClick={() => setMode('edit')}>Modifica</button><button className="btn-primary" onClick={() => setMode('quote')}>Nuova stima lavori</button></>} />
      {(p.price_ask || p.value_after) && (
        <div className="grid sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4"><div className="text-xs text-ink-mute font-semibold">Prezzo d'acquisto</div><div className="text-xl font-extrabold">{p.price_ask ? eur(p.price_ask) : '—'}</div></div>
          <div className="card p-4"><div className="text-xs text-ink-mute font-semibold">Lavori (ultima stima, IVA 10%)</div><div className="text-xl font-extrabold">{lavoriIva ? eur(lavoriIva) : '—'}</div></div>
          <div className="card p-4"><div className="text-xs text-ink-mute font-semibold">Valore a fine lavori</div><div className="text-xl font-extrabold">{p.value_after ? eur(p.value_after) : '—'}</div></div>
          <div className={`card p-4 ${margin != null ? (margin >= 0 ? 'bg-ok-soft' : 'bg-bad-soft') : ''}`}><div className="text-xs text-ink-mute font-semibold">Margine lordo dell'operazione</div><div className="text-xl font-extrabold">{margin != null ? eur(margin) : '—'}</div>{margin != null && p.price_ask && <div className="text-xs text-ink-soft">{num((margin / (Number(p.price_ask) + lavoriIva)) * 100, 1)}% sull'investimento · prima di imposte, notaio e oneri</div>}</div>
        </div>
      )}
      {mode === 'quote' && <div className="card p-6 mb-6"><Wizard mode="estimate" property={p} onSaved={() => { setMode(null); reload(); }} /></div>}
      <div className="card divide-y divide-line">
        <div className="p-4 font-bold">Stime e richieste</div>
        {!quotes.length && <Empty title="Nessuna stima">Calcola quanto costano i lavori per questo immobile.</Empty>}
        {quotes.map((q) => (
          <div key={q.id} className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]"><Link to={`/area/richiesta/${q.id}`} className="font-semibold hover:text-brand">{q.title}</Link><div className="text-xs text-ink-mute">{q.code} · {dt(q.created_at)}</div></div>
            {q.source === 'stima' ? <Badge>Stima</Badge> : <StatusBadge s={q.status} />}
            <div className="font-bold w-28 text-right">{q.total_ref ? eur(q.total_ref) : '—'}</div>
            <button className="btn-ghost btn-sm" onClick={() => copy(q.share_token)}>Copia link report</button>
            <a className="btn-ghost btn-sm" href={`/report/${q.share_token}`} target="_blank" rel="noreferrer">Apri report</a>
          </div>
        ))}
      </div>
      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title="Modifica immobile" wide><PropertyForm initial={p} onSaved={() => { setMode(null); reload(); }} /></Modal>
    </>
  );
}

export function ComputoNew() {
  const nav = useNavigate();
  const [v, setV] = useState({ title: '', comune: null, description: '', deadline: '', items: [{ desc: '', unit: 'm²', qty: '' }] });
  const [err, setErr] = useState(null);
  const [paste, setPaste] = useState('');
  const setItem = (i, k, val) => setV({ ...v, items: v.items.map((x, j) => (j === i ? { ...x, [k]: val } : x)) });
  const fromPaste = () => {
    const rows = paste.split('\n').map((l) => l.split(/\t|;/)).filter((r) => r[0]?.trim());
    const items = rows.map((r) => ({ desc: r[0].trim(), unit: (r[1] || '').trim(), qty: String(r[2] || '').replace(',', '.').trim() }));
    if (items.length) setV({ ...v, items });
  };
  const save = async () => {
    setErr(null);
    try { const r = await api.post('/me/computo', { ...v, comune: v.comune?.nome }); nav('/area/richiesta/' + r.id); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <PageTitle title="Richiesta d'offerta su computo" sub="Per condomini, palazzine, capannoni e operazioni grandi: le imprese invitate prezzano le stesse voci." />
      <div className="card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Titolo" className="sm:col-span-2"><input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Es. Condominio Aurora: cappotto e tetto" /></Field>
          <Field label="Comune"><ComuneInput value={v.comune} onChange={(c) => setV({ ...v, comune: c })} /></Field>
          <Field label="Scadenza per le offerte"><input className="input" type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} /></Field>
          <Field label="Descrizione e requisiti (SOA, tempi, vincoli)" className="sm:col-span-2"><textarea className="input" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        </div>
        <div>
          <div className="font-semibold mb-2">Voci del computo</div>
          <div className="space-y-2">
            {v.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input className="input col-span-7" value={it.desc} onChange={(e) => setItem(i, 'desc', e.target.value)} placeholder={`Voce ${i + 1}`} />
                <input className="input col-span-2" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} placeholder="U.M." />
                <input className="input col-span-2" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} placeholder="Q.tà" inputMode="decimal" />
                <button className="btn-ghost col-span-1 px-0" onClick={() => setV({ ...v, items: v.items.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
          </div>
          <button className="btn-soft btn-sm mt-2" onClick={() => setV({ ...v, items: [...v.items, { desc: '', unit: 'm²', qty: '' }] })}>+ Aggiungi voce</button>
          <details className="mt-3"><summary className="text-sm text-brand font-semibold cursor-pointer">Incolla da Excel (descrizione · unità · quantità)</summary><textarea className="input mt-2" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} /><button className="btn-ghost btn-sm mt-2" onClick={fromPaste}>Usa queste righe</button></details>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary btn-lg" onClick={save}>Invia a EdilMen</button>
        <p className="text-xs text-ink-mute">Un referente EdilMen controlla il computo e invita le imprese della rete con i requisiti adatti. Le offerte compaiono nella richiesta.</p>
      </div>
    </>
  );
}

export function Profile() {
  const { user, refreshUser } = useApp();
  const toast = useToast();
  const [v, setV] = useState({ name: user.name || '', phone: user.phone || '', orgName: user.agency?.name || '' });
  const [pw, setPw] = useState({ old: '', password: '' });
  return (
    <>
      <PageTitle title="Profilo" />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-6 space-y-3">
          <Field label="Email"><input className="input" value={user.email} disabled /></Field>
          <Field label="Nome"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Telefono"><input className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          {user.agency && <Field label="Nome dell'organizzazione"><input className="input" value={v.orgName} onChange={(e) => setV({ ...v, orgName: e.target.value })} /></Field>}
          <button className="btn-primary" onClick={async () => { try { await api.put('/me/profile', v); await refreshUser(); toast('Salvato'); } catch (e) { toast(e.message, 'err'); } }}>Salva</button>
        </div>
        <div className="card p-6 space-y-3">
          <div className="font-bold">Cambia password</div>
          <Field label="Password attuale"><input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
          <Field label="Nuova password"><input className="input" type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
          <button className="btn-dark" onClick={async () => { try { await api.post('/auth/password', pw); setPw({ old: '', password: '' }); toast('Password aggiornata'); } catch (e) { toast(e.message, 'err'); } }}>Aggiorna</button>
        </div>
      </div>
    </>
  );
}
