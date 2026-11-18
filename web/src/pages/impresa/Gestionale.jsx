import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLoad, useApp, Spinner, ErrorBox, Empty, PageTitle, Stat, Badge, Tabs, eur, num, dt, dtt, useToast, Field, Modal } from '../../ui.jsx';
import { api } from '../../api.js';

// Quando il piano non include la funzione, le API rispondono 402: mostriamo cosa si sblocca.
export function UpgradeWall({ title = 'Il gestionale è incluso nel piano Plus' }) {
  return (
    <div className="card p-8 text-center max-w-2xl mx-auto">
      <div className="text-4xl">🔒</div>
      <h2 className="text-2xl font-extrabold mt-3">{title}</h2>
      <p className="text-ink-soft mt-2">Clienti, preventivi con accettazione online, cantieri con diario fotografico, scadenze e fino a 5 utenti. Tutto collegato alle richieste che ricevi da EdilMen.</p>
      <Link to="/impresa/abbonamento" className="btn-primary btn-lg mt-6">Vedi i piani</Link>
    </div>
  );
}
function useG(path, deps) {
  const s = useLoad(path, deps);
  return { ...s, locked: s.error && /Plus/.test(s.error) };
}

const STAGES = [['contatto', 'Primo contatto'], ['sopralluogo', 'Sopralluogo'], ['preventivo', 'Preventivo'], ['cliente', 'Cliente'], ['perso', 'Perso']];
const QST = { bozza: ['Bozza', 'gray'], inviato: ['Inviato', 'blue'], accettato: ['Accettato', 'green'], rifiutato: ['Rifiutato', 'red'], scaduto: ['Scaduto', 'amber'] };
const JST = { pianificato: ['Pianificato', 'gray'], in_corso: ['In corso', 'blue'], sospeso: ['Sospeso', 'amber'], concluso: ['Concluso', 'green'] };

export function GDashboard() {
  const { data, loading, locked } = useG('/impresa/g/dashboard');
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  const k = data.k;
  return (
    <>
      <PageTitle title="Gestionale" sub="Il tuo lavoro di ogni giorno: clienti, preventivi, cantieri e scadenze." actions={<><Link to="/impresa/preventivi/nuovo" className="btn-primary">Nuovo preventivo</Link><Link to="/impresa/clienti" className="btn-ghost">Clienti</Link></>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Preventivi in attesa" value={k.preventivi_aperti} sub={eur(k.valore_aperto)} tone="brand" />
        <Stat label="Accettato quest'anno" value={eur(k.accettato_anno)} sub={k.decisi ? `${num((k.accettati / k.decisi) * 100)}% di preventivi accettati` : 'nessuna risposta ancora'} />
        <Stat label="Cantieri in corso" value={k.cantieri} />
        <Stat label="Scadenze passate" value={k.scadute} sub={k.scadute ? 'da sistemare' : 'tutto in ordine'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5"><div className="font-bold mb-3">Clienti per fase</div>
          <div className="grid grid-cols-5 gap-2 text-center">{STAGES.map(([s, l]) => <Link key={s} to={`/impresa/clienti?fase=${s}`} className="rounded-xl bg-paper p-2 hover:bg-brand-soft"><div className="text-xl font-extrabold">{data.pipeline.find((x) => x.stage === s)?.n || 0}</div><div className="text-[11px] text-ink-soft">{l}</div></Link>)}</div>
        </div>
        <div className="card p-5"><div className="flex justify-between mb-3"><div className="font-bold">Prossime scadenze</div><Link to="/impresa/scadenze" className="text-sm text-brand font-semibold">Tutte</Link></div>
          {!data.next.length ? <p className="text-sm text-ink-soft">Nessuna scadenza.</p> : <ul className="divide-y divide-line">{data.next.map((d) => <li key={d.id} className="py-2 flex justify-between text-sm"><span>{d.title}{d.job_title ? <span className="text-ink-mute"> · {d.job_title}</span> : ''}</span><span className={new Date(d.due) < new Date() ? 'text-bad font-semibold' : 'text-ink-soft'}>{dt(d.due)}{d.amount ? ` · ${eur(d.amount)}` : ''}</span></li>)}</ul>}
        </div>
      </div>
    </>
  );
}

function ClientForm({ initial = {}, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState({ stage: 'contatto', ...initial });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => { try { const r = initial.id ? await api.put('/impresa/g/clients/' + initial.id, v) : await api.post('/impresa/g/clients', v); onSaved(r); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Nome o ragione sociale" className="sm:col-span-2"><input className="input" value={v.name || ''} onChange={set('name')} /></Field>
      <Field label="Telefono"><input className="input" value={v.phone || ''} onChange={set('phone')} /></Field>
      <Field label="Email"><input className="input" value={v.email || ''} onChange={set('email')} /></Field>
      <Field label="Indirizzo"><input className="input" value={v.address || ''} onChange={set('address')} /></Field>
      <Field label="Comune"><input className="input" value={v.comune || ''} onChange={set('comune')} /></Field>
      <Field label="P.IVA / C.F."><input className="input" value={v.vat || ''} onChange={set('vat')} /></Field>
      <Field label="Fase"><select className="input" value={v.stage} onChange={set('stage')}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Da dove arriva"><input className="input" value={v.source || ''} onChange={set('source')} placeholder="Passaparola, EdilMen, sito…" /></Field>
      <Field label="Note" className="sm:col-span-2"><textarea className="input" rows={3} value={v.notes || ''} onChange={set('notes')} /></Field>
      <button className="btn-primary sm:col-span-2" onClick={save}>Salva</button>
    </div>
  );
}

export function GClients() {
  const nav = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [stage, setStage] = useState(params.get('fase') || '');
  const [q, setQ] = useState('');
  const [qq, setQq] = useState('');
  const [open, setOpen] = useState(false);
  const { data, loading, locked, reload } = useG('/impresa/g/clients?q=' + encodeURIComponent(qq), [qq]);
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  const rows = data.filter((c) => !stage || c.stage === stage);
  return (
    <>
      <PageTitle title="Clienti" actions={<button className="btn-primary" onClick={() => setOpen(true)}>Nuovo cliente</button>} />
      <Tabs value={stage} onChange={setStage} items={[['', 'Tutti', data.length], ...STAGES.map(([k, l]) => [k, l, data.filter((c) => c.stage === k).length])]} />
      <form onSubmit={(e) => { e.preventDefault(); setQq(q); }} className="flex gap-2 my-4"><input className="input w-72" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefono, email, comune" /><button className="btn-dark">Cerca</button></form>
      {!rows.length ? <div className="card"><Empty title="Nessun cliente">Aggiungi i tuoi clienti o importali dalle richieste EdilMen che ti hanno scelto.</Empty></div> : (
        <div className="card divide-y divide-line">{rows.map((c) => (
          <Link key={c.id} to={`/impresa/clienti/${c.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-paper">
            <div className="flex-1 min-w-[200px]"><div className="font-semibold">{c.name}</div><div className="text-xs text-ink-mute">{[c.phone, c.email, c.comune].filter(Boolean).join(' · ')}</div></div>
            {c.source === 'EdilMen' && <Badge tone="blue">da EdilMen</Badge>}
            <Badge>{STAGES.find((s) => s[0] === c.stage)?.[1]}</Badge>
            <span className="text-sm text-ink-soft w-24 text-right">{c.preventivi} preventivi</span>
          </Link>
        ))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nuovo cliente" wide><ClientForm onSaved={(c) => { setOpen(false); reload(); nav('/impresa/clienti/' + c.id); }} /></Modal>
    </>
  );
}

export function GClient() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, locked, reload } = useG('/impresa/g/clients/' + id);
  const [edit, setEdit] = useState(false);
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  const c = data.client;
  return (
    <>
      <Link to="/impresa/clienti" className="text-sm text-ink-soft">← Clienti</Link>
      <PageTitle title={c.name} sub={[c.phone, c.email, [c.address, c.comune].filter(Boolean).join(', ')].filter(Boolean).join(' · ')} actions={<>
        <button className="btn-ghost" onClick={() => setEdit(true)}>Modifica</button>
        <Link to={`/impresa/preventivi/nuovo?cliente=${c.id}`} className="btn-primary">Nuovo preventivo</Link>
        <button className="btn-danger" onClick={async () => { if (confirm('Eliminare il cliente?')) { await api.del('/impresa/g/clients/' + c.id); toast('Eliminato'); nav('/impresa/clienti'); } }}>Elimina</button>
      </>} />
      {c.notes && <div className="card p-4 mb-4 text-sm whitespace-pre-line">{c.notes}</div>}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5"><div className="font-bold mb-2">Preventivi</div>{!data.quotes.length ? <p className="text-sm text-ink-soft">Nessuno.</p> : <ul className="divide-y divide-line">{data.quotes.map((x) => <li key={x.id}><Link to={`/impresa/preventivi/${x.id}`} className="py-2 flex justify-between text-sm hover:text-brand"><span>n. {x.number} · {x.title}</span><span>{eur(x.total)} <Badge tone={QST[x.status][1]}>{QST[x.status][0]}</Badge></span></Link></li>)}</ul>}</div>
        <div className="card p-5"><div className="font-bold mb-2">Cantieri</div>{!data.jobs.length ? <p className="text-sm text-ink-soft">Nessuno.</p> : <ul className="divide-y divide-line">{data.jobs.map((j) => <li key={j.id}><Link to={`/impresa/cantieri-gestionale/${j.id}`} className="py-2 flex justify-between text-sm hover:text-brand"><span>{j.title}</span><Badge tone={JST[j.status][1]}>{JST[j.status][0]}</Badge></Link></li>)}</ul>}</div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Modifica cliente" wide><ClientForm initial={c} onSaved={() => { setEdit(false); reload(); }} /></Modal>
    </>
  );
}

export function GQuotes() {
  const [st, setSt] = useState('');
  const { data, loading, locked } = useG('/impresa/g/quotes');
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  const rows = data.filter((x) => !st || x.status === st);
  return (
    <>
      <PageTitle title="Preventivi" sub="Partono dai pacchetti EdilMen con i tuoi prezzi o da voci libere. Il cliente li apre da un link e accetta online." actions={<Link to="/impresa/preventivi/nuovo" className="btn-primary">Nuovo preventivo</Link>} />
      <Tabs value={st} onChange={setSt} items={[['', 'Tutti', data.length], ...Object.entries(QST).map(([k, [l]]) => [k, l, data.filter((x) => x.status === k).length])]} />
      {!rows.length ? <div className="card mt-4"><Empty title="Nessun preventivo" action={<Link to="/impresa/preventivi/nuovo" className="btn-primary">Crea il primo</Link>} /></div> : (
        <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="bg-paper"><tr><th className="th">N.</th><th className="th">Titolo</th><th className="th">Cliente</th><th className="th">Data</th><th className="th text-right">Totale</th><th className="th">Stato</th></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((x) => <tr key={x.id} className="hover:bg-paper"><td className="td font-mono text-sm">{x.number}</td><td className="td"><Link to={`/impresa/preventivi/${x.id}`} className="font-semibold hover:text-brand">{x.title}</Link></td><td className="td text-sm">{x.client_name || '—'}</td><td className="td text-sm">{dt(x.created_at)}</td><td className="td text-right font-semibold">{eur(x.total)}</td><td className="td"><Badge tone={QST[x.status][1]}>{QST[x.status][0]}</Badge></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}

export function GQuoteEditor() {
  const { id } = useParams();
  const isNew = id === 'nuovo';
  const nav = useNavigate();
  const toast = useToast();
  const qs = new URLSearchParams(window.location.search);
  const existing = useLoad(isNew ? null : '/impresa/g/quotes/' + id);
  const clients = useG('/impresa/g/clients');
  const cat = useLoad('/impresa/g/catalog');
  const [v, setV] = useState(null);
  const [pick, setPick] = useState(false);
  const [lvl, setLvl] = useState(1);
  const [fq, setFq] = useState('');
  const init = useMemo(() => {
    if (isNew) return { title: '', client_id: qs.get('cliente') || '', items: [], discount: 0, vat_rate: 0.1, notes: '', conditions: 'Pagamenti a stato di avanzamento lavori: 10% alla firma, 30% avvio, 30% metà opere, 20% fine opere, 10% collaudo.\nVariazioni solo con variante scritta e firmata prima dell\'esecuzione.', valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) };
    if (existing.data) return { ...existing.data.quote, client_id: existing.data.quote.client_id || '' };
    return null;
  }, [existing.data]); // eslint-disable-line
  const q = v || init;
  if (clients.locked) return <UpgradeWall />;
  if (!q || clients.loading || cat.loading) return <Spinner />;
  const set = (k, val) => setV({ ...q, [k]: val });
  const setItem = (i, k, val) => set('items', q.items.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  const sub = q.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const net = sub * (1 - (Number(q.discount) || 0));
  const quote = !isNew ? existing.data.quote : null;
  const save = async () => {
    try {
      const body = { ...q, client_id: q.client_id || null };
      const r = isNew ? await api.post('/impresa/g/quotes', body) : await api.put('/impresa/g/quotes/' + id, body);
      toast('Preventivo salvato'); setV(null);
      if (isNew) nav('/impresa/preventivi/' + r.id, { replace: true }); else existing.reload();
      return r;
    } catch (e) { toast(e.message, 'err'); return null; }
  };
  const send = async () => {
    const saved = await save(); if (!saved) return;
    const r = await api.post(`/impresa/g/quotes/${saved.id}/send`);
    const url = `${window.location.origin}/preventivo/${r.token}`;
    navigator.clipboard?.writeText(url);
    toast('Link del preventivo copiato: mandalo al cliente su WhatsApp o email');
    if (!isNew) existing.reload(); else nav('/impresa/preventivi/' + saved.id, { replace: true });
  };
  const addPkg = (p) => {
    const price = p.mine?.[lvl] ?? p.ref[lvl];
    set('items', [...q.items, { desc: `${p.name} — livello ${['Standard', 'Intermedio', 'Premium'][lvl].toLowerCase()}. Comprende: ${p.included.slice(0, 8).join('; ')}${p.included.length > 8 ? '…' : ''}`, unit: p.unit, qty: 1, price: Math.round(price * 100) / 100, pkg: p.code }]);
    setPick(false);
  };
  return (
    <>
      <Link to="/impresa/preventivi" className="text-sm text-ink-soft">← Preventivi</Link>
      <PageTitle title={isNew ? 'Nuovo preventivo' : `Preventivo n. ${quote.number}`} sub={quote ? <>Stato: <Badge tone={QST[quote.status][1]}>{QST[quote.status][0]}</Badge>{quote.answer_note ? ` · nota del cliente: «${quote.answer_note}»` : ''}</> : null}
        actions={<>
          <button className="btn-ghost" onClick={save}>Salva</button>
          <button className="btn-primary" onClick={send}>{quote?.share_token ? 'Copia il link per il cliente' : 'Salva e invia al cliente'}</button>
          {quote?.share_token && <a className="btn-ghost" href={`/preventivo/${quote.share_token}`} target="_blank" rel="noreferrer">Anteprima / PDF</a>}
          {quote && <button className="btn-ghost" onClick={async () => { const r = await api.post(`/impresa/g/quotes/${quote.id}/duplicate`); nav('/impresa/preventivi/' + r.id); }}>Duplica</button>}
          {quote?.status === 'accettato' && <button className="btn-soft" onClick={async () => { const j = await api.post(`/impresa/g/quotes/${quote.id}/to-job`); nav('/impresa/cantieri-gestionale/' + j.id); }}>Apri il cantiere</button>}
        </>} />
      <div className="card p-5 grid sm:grid-cols-3 gap-3">
        <Field label="Titolo" className="sm:col-span-2"><input className="input" value={q.title} onChange={(e) => set('title', e.target.value)} placeholder="Es. Rifacimento bagno via Roma 3" /></Field>
        <Field label="Cliente"><select className="input" value={q.client_id || ''} onChange={(e) => set('client_id', e.target.value)}><option value="">—</option>{clients.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px]"><thead className="bg-paper"><tr><th className="th w-1/2">Descrizione</th><th className="th">U.M.</th><th className="th">Q.tà</th><th className="th">Prezzo €</th><th className="th text-right">Importo</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">
            {q.items.map((it, i) => (
              <tr key={i}>
                <td className="td"><textarea className="input py-1.5" rows={2} value={it.desc} onChange={(e) => setItem(i, 'desc', e.target.value)} />{it.pkg && <div className="text-[11px] text-ink-mute mt-0.5">Pacchetto EdilMen {it.pkg}</div>}</td>
                <td className="td"><input className="input py-1.5 w-20" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} /></td>
                <td className="td"><input className="input py-1.5 w-20" type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                <td className="td"><input className="input py-1.5 w-28" type="number" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} /></td>
                <td className="td text-right font-semibold whitespace-nowrap">{eur((Number(it.qty) || 0) * (Number(it.price) || 0), 2)}</td>
                <td className="td"><button className="btn-ghost btn-sm" onClick={() => set('items', q.items.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 flex flex-wrap gap-2 border-t border-line">
          <button className="btn-soft btn-sm" onClick={() => setPick(true)}>+ Da pacchetto EdilMen</button>
          <button className="btn-ghost btn-sm" onClick={() => set('items', [...q.items, { desc: '', unit: 'cad', qty: 1, price: 0 }])}>+ Voce libera</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5 lg:col-span-2 grid gap-3">
          <Field label="Note per il cliente"><textarea className="input" rows={3} value={q.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          <Field label="Condizioni"><textarea className="input" rows={4} value={q.conditions || ''} onChange={(e) => set('conditions', e.target.value)} /></Field>
        </div>
        <div className="card p-5 space-y-3 text-sm">
          <div className="flex justify-between"><span>Subtotale</span><b>{eur(sub, 2)}</b></div>
          <div className="flex justify-between items-center"><span>Sconto %</span><input className="input py-1.5 w-20" type="number" value={Math.round((q.discount || 0) * 1000) / 10} onChange={(e) => set('discount', Number(e.target.value) / 100)} /></div>
          <div className="flex justify-between text-base"><span className="font-bold">Totale IVA esclusa</span><b>{eur(net, 2)}</b></div>
          <div className="flex justify-between items-center"><span>IVA</span><select className="input py-1.5 w-28" value={q.vat_rate} onChange={(e) => set('vat_rate', Number(e.target.value))}><option value={0.1}>10%</option><option value={0.22}>22%</option><option value={0.04}>4%</option><option value={0}>esente</option></select></div>
          <div className="flex justify-between"><span>Totale IVA inclusa</span><b>{eur(net * (1 + Number(q.vat_rate)), 2)}</b></div>
          <Field label="Valido fino al"><input className="input" type="date" value={q.valid_until || ''} onChange={(e) => set('valid_until', e.target.value)} /></Field>
          {quote && ['inviato'].includes(quote.status) && <div className="flex gap-2 pt-2"><button className="btn-soft btn-sm" onClick={async () => { await api.post(`/impresa/g/quotes/${quote.id}/status`, { status: 'accettato' }); existing.reload(); }}>Segna accettato</button><button className="btn-ghost btn-sm" onClick={async () => { await api.post(`/impresa/g/quotes/${quote.id}/status`, { status: 'rifiutato' }); existing.reload(); }}>Segna rifiutato</button></div>}
        </div>
      </div>
      <Modal open={pick} onClose={() => setPick(false)} title="Aggiungi un pacchetto EdilMen" wide>
        <div className="flex gap-2 mb-3"><input className="input" value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Cerca: bagno, cappotto, fotovoltaico…" />{['Std', 'Int', 'Prem'].map((l, i) => <button key={l} className={`btn-sm ${lvl === i ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setLvl(i)}>{l}</button>)}</div>
        <div className="max-h-96 overflow-auto divide-y divide-line">
          {cat.data.filter((p) => !fq || (p.name + p.family).toLowerCase().includes(fq.toLowerCase())).map((p) => (
            <button key={p.code} className="w-full text-left py-2.5 px-2 hover:bg-paper flex justify-between gap-3" onClick={() => addPkg(p)}>
              <span><span className="font-semibold">{p.name}</span><span className="block text-xs text-ink-mute">{p.family} · {p.unit}</span></span>
              <span className="text-sm text-right whitespace-nowrap">{p.mine?.[lvl] != null ? <><b>{eur(p.mine[lvl])}</b><span className="block text-[11px] text-ok">tuo prezzo</span></> : <><b>{eur(p.ref[lvl])}</b><span className="block text-[11px] text-ink-mute">rif. EdilMen</span></>}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export function GJobs() {
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, locked } = useG('/impresa/g/jobs');
  const [nw, setNw] = useState(null);
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  return (
    <>
      <PageTitle title="Cantieri" sub="I tuoi cantieri, anche quelli che non arrivano da EdilMen: avanzamento, diario con foto e ore, scadenze." actions={<button className="btn-primary" onClick={() => setNw({ title: '' })}>Nuovo cantiere</button>} />
      {!data.length ? <div className="card"><Empty title="Nessun cantiere">Si crea da un preventivo accettato o a mano.</Empty></div> : (
        <div className="grid md:grid-cols-2 gap-3">{data.map((j) => (
          <Link key={j.id} to={`/impresa/cantieri-gestionale/${j.id}`} className="card p-5 hover:shadow-lift">
            <div className="flex justify-between gap-2"><div className="font-bold">{j.title}</div><Badge tone={JST[j.status][1]}>{JST[j.status][0]}</Badge></div>
            <div className="text-xs text-ink-mute mt-1">{[j.client_name, j.address].filter(Boolean).join(' · ')}</div>
            <div className="h-2 rounded-full bg-line mt-3 overflow-hidden"><div className="h-full bg-brand" style={{ width: `${j.progress}%` }} /></div>
            <div className="flex justify-between text-xs text-ink-soft mt-1"><span>{j.progress}% · {j.voci_diario} voci di diario</span><span>{j.value ? eur(j.value) : ''}</span></div>
          </Link>
        ))}</div>
      )}
      <Modal open={!!nw} onClose={() => setNw(null)} title="Nuovo cantiere">
        {nw && <div className="grid gap-3"><Field label="Nome"><input className="input" value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} /></Field><Field label="Indirizzo"><input className="input" value={nw.address || ''} onChange={(e) => setNw({ ...nw, address: e.target.value })} /></Field><Field label="Inizio"><input className="input" type="date" value={nw.start_date || ''} onChange={(e) => setNw({ ...nw, start_date: e.target.value })} /></Field><Field label="Valore (€)"><input className="input" type="number" value={nw.value || ''} onChange={(e) => setNw({ ...nw, value: e.target.value })} /></Field>
          <button className="btn-primary" onClick={async () => { try { const j = await api.post('/impresa/g/jobs', nw); nav('/impresa/cantieri-gestionale/' + j.id); } catch (e) { toast(e.message, 'err'); } }}>Crea</button></div>}
      </Modal>
    </>
  );
}

export function GJob() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, locked, reload } = useG('/impresa/g/jobs/' + id);
  const [v, setV] = useState(null);
  const [log, setLog] = useState({ text: '', hours: '', files: [] });
  const [dl, setDl] = useState({ title: '', due: '', amount: '' });
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  const j = v || data.job;
  const set = (k, val) => setV({ ...j, [k]: val });
  const save = async () => { try { await api.put('/impresa/g/jobs/' + id, j); toast('Cantiere salvato'); setV(null); reload(); } catch (e) { toast(e.message, 'err'); } };
  const addLog = async () => {
    const fd = new FormData(); fd.append('text', log.text); fd.append('hours', log.hours); for (const f of log.files) fd.append('photos', f);
    try { await api.form(`/impresa/g/jobs/${id}/logs`, fd); setLog({ text: '', hours: '', files: [] }); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const hours = data.logs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  return (
    <>
      <Link to="/impresa/cantieri-gestionale" className="text-sm text-ink-soft">← Cantieri</Link>
      <PageTitle title={j.title} sub={[data.client?.name, j.address].filter(Boolean).join(' · ')} actions={<><button className="btn-primary" onClick={save} disabled={!v}>Salva</button><button className="btn-danger" onClick={async () => { if (confirm('Eliminare il cantiere?')) { await api.del('/impresa/g/jobs/' + id); nav('/impresa/cantieri-gestionale'); } }}>Elimina</button></>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="font-bold mb-3">Diario di cantiere</div>
            <div className="grid sm:grid-cols-4 gap-2">
              <textarea className="input sm:col-span-4" rows={2} value={log.text} onChange={(e) => setLog({ ...log, text: e.target.value })} placeholder="Cosa è stato fatto oggi, chi c'era, problemi…" />
              <input className="input" type="number" value={log.hours} onChange={(e) => setLog({ ...log, hours: e.target.value })} placeholder="Ore" />
              <input type="file" accept="image/*" multiple className="sm:col-span-2 text-sm" onChange={(e) => setLog({ ...log, files: [...e.target.files] })} />
              <button className="btn-primary" onClick={addLog}>Aggiungi</button>
            </div>
            <ul className="mt-4 divide-y divide-line">{data.logs.map((l) => (
              <li key={l.id} className="py-3 text-sm"><div className="text-xs text-ink-mute">{dtt(l.at)} · {l.user_name || l.user_email}{l.hours ? ` · ${num(l.hours, 1)} h` : ''}</div>{l.text && <p className="mt-1 whitespace-pre-line">{l.text}</p>}
                {l.photos?.length > 0 && <div className="flex gap-1.5 mt-2 flex-wrap">{l.photos.map((f) => <a key={f} href={`/api/files/${f}`} target="_blank" rel="noreferrer"><img src={`/api/files/${f}`} alt="Foto di cantiere" className="h-20 w-20 object-cover rounded-lg border border-line" /></a>)}</div>}
              </li>
            ))}</ul>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <Field label="Stato"><select className="input" value={j.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(JST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label={`Avanzamento ${j.progress}%`}><input type="range" min="0" max="100" step="5" value={j.progress} onChange={(e) => set('progress', Number(e.target.value))} className="w-full" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Inizio"><input className="input" type="date" value={j.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></Field><Field label="Fine prevista"><input className="input" type="date" value={j.end_date || ''} onChange={(e) => set('end_date', e.target.value)} /></Field></div>
            <Field label="Valore (€)"><input className="input" type="number" value={j.value || ''} onChange={(e) => set('value', e.target.value)} /></Field>
            <Field label="Indirizzo"><input className="input" value={j.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Note"><textarea className="input" rows={3} value={j.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
            <div className="text-xs text-ink-mute">{num(hours, 1)} ore registrate nel diario</div>
          </div>
          <div className="card p-5">
            <div className="font-bold mb-2">Scadenze del cantiere</div>
            <ul className="divide-y divide-line text-sm mb-3">{data.deadlines.map((d) => <li key={d.id} className="py-1.5 flex justify-between gap-2"><label className="flex gap-2"><input type="checkbox" checked={d.done} onChange={async () => { await api.patch('/impresa/g/deadlines/' + d.id, { done: !d.done }); reload(); }} /><span className={d.done ? 'line-through text-ink-mute' : ''}>{d.title}</span></label><span className="text-ink-soft">{dt(d.due)}{d.amount ? ` · ${eur(d.amount)}` : ''}</span></li>)}</ul>
            <div className="grid gap-2"><input className="input py-1.5" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} placeholder="Es. Incasso SAL 2, consegna materiali" /><div className="flex gap-2"><input className="input py-1.5" type="date" value={dl.due} onChange={(e) => setDl({ ...dl, due: e.target.value })} /><input className="input py-1.5 w-28" type="number" value={dl.amount} onChange={(e) => setDl({ ...dl, amount: e.target.value })} placeholder="€" /></div>
              <button className="btn-soft btn-sm" onClick={async () => { try { await api.post('/impresa/g/deadlines', { ...dl, job_id: id }); setDl({ title: '', due: '', amount: '' }); reload(); } catch (e) { toast(e.message, 'err'); } }}>Aggiungi scadenza</button></div>
          </div>
        </div>
      </div>
    </>
  );
}

export function GDeadlines() {
  const toast = useToast();
  const { data, loading, locked, reload } = useG('/impresa/g/deadlines');
  const [dl, setDl] = useState({ title: '', due: '', amount: '', kind: 'attivita' });
  if (loading) return <Spinner />;
  if (locked) return <UpgradeWall />;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageTitle title="Scadenze" sub="Incassi, pagamenti, rinnovi di DURC e assicurazioni, consegne." actions={<button className="btn-ghost" onClick={async () => { const r = await api.post('/impresa/g/deadlines/sync-docs'); toast(`${r.added} scadenze dai documenti`); reload(); }}>Importa scadenze dai documenti</button>} />
      <div className="card p-4 grid sm:grid-cols-5 gap-2 mb-4">
        <input className="input sm:col-span-2" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} placeholder="Cosa scade" />
        <input className="input" type="date" value={dl.due} onChange={(e) => setDl({ ...dl, due: e.target.value })} />
        <select className="input" value={dl.kind} onChange={(e) => setDl({ ...dl, kind: e.target.value })}><option value="attivita">Attività</option><option value="incasso">Incasso</option><option value="pagamento">Pagamento</option><option value="documento">Documento</option></select>
        <button className="btn-primary" onClick={async () => { try { await api.post('/impresa/g/deadlines', dl); setDl({ title: '', due: '', amount: '', kind: 'attivita' }); reload(); } catch (e) { toast(e.message, 'err'); } }}>Aggiungi</button>
      </div>
      {!data.length ? <div className="card"><Empty title="Nessuna scadenza" /></div> : (
        <div className="card divide-y divide-line">{data.map((d) => (
          <div key={d.id} className="p-3 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={d.done} onChange={async () => { await api.patch('/impresa/g/deadlines/' + d.id, { done: !d.done }); reload(); }} />
            <span className={`flex-1 ${d.done ? 'line-through text-ink-mute' : ''}`}>{d.title}{d.job_title ? <span className="text-ink-mute"> · {d.job_title}</span> : ''}</span>
            <Badge>{d.kind}</Badge>
            {d.amount && <span>{eur(d.amount)}</span>}
            <span className={!d.done && d.due < today ? 'text-bad font-semibold' : 'text-ink-soft'}>{dt(d.due)}</span>
            <button className="text-ink-mute hover:text-bad" onClick={async () => { await api.del('/impresa/g/deadlines/' + d.id); reload(); }}>×</button>
          </div>
        ))}</div>
      )}
    </>
  );
}

export function Subscription() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/impresa/subscription');
  if (loading) return <Spinner />;
  const p = data.plan;
  const b = data.billing || {};
  return (
    <>
      <PageTitle title="Abbonamento" sub="I piani danno strumenti e visibilità. Non cambiano il rating, e la fee sui lavori resta la stessa." />
      <div className="card p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1"><div className="text-sm text-ink-soft">Piano attivo</div><div className="text-2xl font-extrabold">{p.name}</div>
          <div className="text-sm text-ink-soft">{p.source === 'prova' ? `Prova gratuita fino al ${dt(p.trial_until)}` : p.source === 'abbonamento' ? `Rinnovo entro il ${dt(p.plan_until)}` : 'Gratuito'}</div></div>
        {data.requested && <Badge tone="amber">Hai chiesto il piano {data.plans.find((x) => x.id === data.requested)?.name}: in attesa del pagamento</Badge>}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {data.plans.map((pl) => (
          <div key={pl.id} className={`card p-6 ${p.id === pl.id ? 'ring-2 ring-brand' : ''}`}>
            <div className="font-bold">{pl.name}</div>
            <div className="text-3xl font-extrabold mt-1">{pl.price ? eur(pl.price) : 'Gratis'}<span className="text-sm font-medium text-ink-soft">{pl.price ? ' /mese + IVA' : ''}</span></div>
            <ul className="text-sm text-ink-soft mt-3 space-y-1">{pl.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            {pl.price > 0 && p.id !== pl.id && <button className="btn-primary w-full mt-4" onClick={async () => { await api.post('/impresa/subscription/request', { plan: pl.id }); toast('Richiesta registrata: trovi sotto i dati per il pagamento'); reload(); }}>Scegli {pl.name}</button>}
            {p.id === pl.id && <div className="text-center text-sm text-ok font-semibold mt-4">Il tuo piano</div>}
          </div>
        ))}
      </div>
      <div className="card p-5 mt-6 text-sm">
        <div className="font-bold mb-2">Come si paga</div>
        <p>Bonifico a <b>{b.intestatario}</b>{b.iban ? <> · IBAN <span className="font-mono">{b.iban}</span></> : ' (l\'IBAN te lo comunica il referente EdilMen)'}. Causale: {String(b.causale || '').replace('{piano}', data.requested || p.id).replace('{impresa}', 'nome impresa')}.</p>
        <p className="text-ink-soft mt-1">{b.note}</p>
      </div>
      {data.payments.length > 0 && <div className="card p-5 mt-4"><div className="font-bold mb-2">Pagamenti</div><table className="w-full text-sm"><tbody className="divide-y divide-line">{data.payments.map((x, i) => <tr key={i}><td className="py-1.5">{dt(x.created_at)}</td><td>{x.plan}</td><td>{x.months} mesi</td><td>{dt(x.period_start)} → {dt(x.period_end)}</td><td className="text-right font-semibold">{eur(x.amount)}</td></tr>)}</tbody></table></div>}
    </>
  );
}

export function Team() {
  const toast = useToast();
  const { user } = useApp();
  const { data, loading, reload } = useLoad('/impresa/team');
  const [v, setV] = useState({ email: '', name: '' });
  const [temp, setTemp] = useState(null);
  const [pw, setPw] = useState({ old: '', password: '' });
  const { refreshUser } = useApp();
  if (loading) return <Spinner />;
  const active = data.users.filter((u) => u.active);
  return (
    <>
      <PageTitle title="Team" sub={`${active.length} di ${data.max} utenti inclusi nel piano. Ogni collega ha il suo accesso: vedete gli stessi clienti, preventivi e cantieri.`} />
      <div className="card divide-y divide-line">{data.users.map((u) => (
        <div key={u.id} className="p-4 flex items-center gap-3 text-sm"><div className="flex-1"><div className="font-semibold">{u.name || u.email}</div><div className="text-xs text-ink-mute">{u.email} · ultimo accesso {dtt(u.last_login_at)}</div></div><Badge tone={u.org_role === 'titolare' ? 'navy' : 'gray'}>{u.org_role}</Badge>{!u.active && <Badge tone="red">disattivato</Badge>}
          {user.org_role === 'titolare' && u.id !== user.id && u.active && <button className="btn-danger btn-sm" onClick={async () => { await api.del('/impresa/team/' + u.id); reload(); }}>Disattiva</button>}</div>
      ))}</div>
      {user.org_role === 'titolare' && (
        <div className="card p-5 mt-4 grid sm:grid-cols-3 gap-2 items-end">
          <Field label="Email del collega"><input className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Nome"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <button className="btn-primary" onClick={async () => { try { const r = await api.post('/impresa/team', v); setTemp({ email: v.email, pw: r.tempPassword }); setV({ email: '', name: '' }); reload(); } catch (e) { toast(e.message, 'err'); } }}>Aggiungi collega</button>
        </div>
      )}
      <div className="card p-5 mt-4 grid sm:grid-cols-3 gap-2 items-end">
        <div className="sm:col-span-3 font-bold">La mia password</div>
        <Field label="Password attuale"><input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
        <Field label="Nuova password"><input className="input" type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} placeholder="Almeno 8 caratteri" /></Field>
        <button className="btn-dark" onClick={async () => { try { await api.post('/auth/password', pw); setPw({ old: '', password: '' }); await refreshUser(); toast('Password aggiornata'); } catch (e) { toast(e.message, 'err'); } }}>Cambia password</button>
      </div>
      <Modal open={!!temp} onClose={() => setTemp(null)} title="Collega aggiunto">
        {temp && <div className="text-sm space-y-2"><p>Comunica al collega questi dati di accesso. Al primo accesso gli chiederemo di cambiare la password.</p><div className="rounded-xl bg-paper p-3 font-mono">{temp.email}<br />{temp.pw}</div><p className="text-xs text-ink-mute">La password provvisoria non sarà più mostrata.</p></div>}
      </Modal>
    </>
  );
}

export function Stats() {
  const { data, loading } = useLoad('/impresa/stats');
  if (loading) return <Spinner />;
  const max = Math.max(1, ...data.months.map((m) => m.visite));
  return (
    <>
      <PageTitle title="Statistiche della scheda" sub="Quante persone guardano la tua scheda e quante volte compari nelle quotazioni." />
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Visite alla scheda (12 mesi)" value={num(data.totals.visite)} tone="brand" />
        <Stat label="Comparse nelle quotazioni" value={num(data.totals.quotazioni)} />
        <Stat label="Offerte inviate" value={data.offers.offerte} sub={`${data.offers.inviti} inviti aperti`} />
        <Stat label="Clienti che ti hanno scelto" value={data.offers.scelte} />
      </div>
      {data.locked ? <div className="card p-6 mt-6 text-center"><div className="font-bold">Il dettaglio mese per mese è nei piani Base e Plus</div><Link to="/impresa/abbonamento" className="btn-primary mt-3">Vedi i piani</Link></div> : (
        <div className="card p-5 mt-6"><div className="font-bold mb-4">Mese per mese</div>
          {!data.months.length ? <p className="text-sm text-ink-soft">Ancora nessuna visita registrata.</p> : (
            <div className="flex items-end gap-2 h-48">{data.months.map((m) => <div key={m.mese} className="flex-1 flex flex-col items-center justify-end h-full"><div className="text-xs font-semibold mb-1">{m.visite}</div><div className="w-full bg-brand rounded-t-md" style={{ height: `${(m.visite / max) * 80}%`, minHeight: 4 }} /><div className="text-[10px] text-ink-mute mt-1">{m.mese.slice(5)}/{m.mese.slice(2, 4)}</div></div>)}</div>
          )}
        </div>
      )}
    </>
  );
}
