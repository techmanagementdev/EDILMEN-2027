import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad, useApp, Spinner, ErrorBox, Empty, PageTitle, Stat, Badge, StatusBadge, eur, num, dt, useToast, Field, ComuneInput, RatingBox, DocsBadges, DOC_LABEL, Modal } from '../../ui.jsx';
import { api } from '../../api.js';

const LV = ['Standard', 'Intermedio', 'Premium'];

export function ImpresaHome() {
  const { data, loading } = useLoad('/impresa/overview');
  if (loading) return <Spinner />;
  const { company: c, counts, rating, claim } = data;
  const todo = [];
  if (claim?.status === 'da_approvare') todo.push(['La rivendicazione della scheda è in verifica dal team EdilMen.', null]);
  if (c.status !== 'attiva') todo.push(['Carica visura, DURC e assicurazione: dopo la verifica la scheda diventa attiva.', '/impresa/documenti']);
  if (!counts.prezzi) todo.push(['Prezza i pacchetti EdilMen: le offerte partiranno da sole con il tuo prezzo.', '/impresa/listino']);
  if (!c.receive_requests) todo.push(['Attiva «Ricevo richieste» nel profilo e indica le province in cui lavori.', '/impresa/profilo']);
  if (!c.description) todo.push(['Scrivi due righe su chi siete: compaiono nella scheda pubblica.', '/impresa/profilo']);
  return (
    <>
      <PageTitle title={c.name} sub={`${c.comune || ''}${c.provincia ? ` (${c.provincia})` : ''} · ${c.network ? 'Impresa della rete EdilMen' : c.status === 'attiva' ? 'Scheda attiva' : 'Scheda in verifica'}`} actions={<Link to={`/imprese/${c.slug}`} className="btn-ghost" target="_blank">Vedi la scheda pubblica</Link>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Inviti da quotare" value={counts.inviti} tone="brand" />
        <Stat label="Clienti che ti hanno scelto" value={counts.scelte} />
        <Stat label="Cantieri attivi" value={counts.cantieri} />
        <Stat label="Fee da saldare" value={eur(counts.fee_aperte)} sub="su SAL approvati" />
      </div>
      {todo.length > 0 && (
        <div className="card p-5 mt-6"><div className="font-bold mb-3">Da fare per ricevere lavori</div>
          <ul className="space-y-2">{todo.map(([t, to]) => <li key={t} className="flex items-start gap-2 text-sm"><span className="text-warn">●</span><span className="flex-1">{t}</span>{to && <Link to={to} className="text-brand font-semibold">Vai</Link>}</li>)}</ul>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5"><div className="font-bold mb-3">Il tuo rating</div><RatingBox rating={rating} /><div className="mt-3"><DocsBadges docs={rating.docs} /></div></div>
        <div className="card p-5"><div className="font-bold mb-2">Come guadagni con EdilMen</div><p className="text-sm text-ink-soft">Entrare è gratis. La fee si paga solo sui lavori firmati, a ogni SAL approvato:</p>
          <div className="flex gap-2 mt-3">{data.fee.brackets.map((b, i) => <div key={i} className="rounded-xl bg-paper px-3 py-2 text-center text-xs"><div className="text-lg font-extrabold text-brand">{num(b.rate * 100)}%</div>{b.upTo ? `fino a ${eur(b.upTo)}` : 'oltre'}</div>)}</div>
        </div>
      </div>
    </>
  );
}

const CATS = ['Ristrutturazioni', 'Nuove costruzioni', 'Impianti elettrici', 'Impianti idraulici', 'Riscaldamento e clima', 'Fotovoltaico', 'Serramenti', 'Coperture', 'Cappotti e facciate', 'Pavimenti e rivestimenti', 'Cartongesso', 'Pitture', 'Domotica', 'Pulizie e sgomberi'];
const PROVS = ['TN', 'BZ', 'VR', 'VI', 'PD', 'TV', 'VE', 'BL', 'RO', 'UD', 'PN', 'GO', 'TS', 'BS', 'MI', 'BG'];

export function ImpresaProfile() {
  const toast = useToast();
  const { data, loading } = useLoad('/impresa/overview');
  const [v, setV] = useState(null);
  if (loading) return <Spinner />;
  const c = v || { ...data.company, comuneObj: data.company.comune ? { nome: data.company.comune, sigla: data.company.provincia } : null };
  const set = (k, val) => setV({ ...c, [k]: val });
  const toggle = (k, x) => set(k, c[k].includes(x) ? c[k].filter((y) => y !== x) : [...c[k], x]);
  const save = async () => { try { await api.put('/impresa/profile', { ...c, comune: c.comuneObj?.nome }); toast('Profilo salvato'); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <PageTitle title="Profilo pubblico" sub="Quello che scrivi qui compare nella scheda pubblica e serve per proporti i lavori giusti." actions={<button className="btn-primary" onClick={save}>Salva</button>} />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <Field label="Chi siete, da quanti anni lavorate, cosa sapete fare meglio"><textarea className="input" rows={5} value={c.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Sito web"><input className="input" value={c.website || ''} onChange={(e) => set('website', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Indirizzo della sede"><input className="input" value={c.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Comune della sede"><ComuneInput value={c.comuneObj} onChange={(x) => set('comuneObj', x)} /></Field>
            <Field label="Anni di attività"><input className="input" type="number" value={c.years_active || ''} onChange={(e) => set('years_active', e.target.value)} /></Field>
            <Field label="Addetti"><input className="input" type="number" value={c.employees || ''} onChange={(e) => set('employees', e.target.value)} /></Field>
          </div>
          <Field label="Certificazioni e abilitazioni (le mostriamo come «dichiarate» finché non carichi il documento)"><input className="input" value={(c.certs_declared || []).join(', ')} onChange={(e) => set('certs_declared', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="SOA OG1 II, ISO 9001, FER…" /></Field>
        </div>
        <div className="card p-5 space-y-4">
          <div><span className="label">Lavori che fate</span><div className="flex flex-wrap gap-1.5">{CATS.map((x) => <button key={x} type="button" onClick={() => toggle('categories', x)} className={`chip border ${c.categories.includes(x) ? 'bg-navy text-white border-navy' : 'bg-white border-line'}`}>{x}</button>)}</div></div>
          <div><span className="label">Province in cui lavorate</span><div className="flex flex-wrap gap-1.5">{PROVS.map((x) => <button key={x} type="button" onClick={() => toggle('provinces_served', x)} className={`chip border ${c.provinces_served.includes(x) ? 'bg-navy text-white border-navy' : 'bg-white border-line'}`}>{x}</button>)}</div></div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Raggio (km)"><input className="input" type="number" value={c.radius_km || 50} onChange={(e) => set('radius_km', e.target.value)} /></Field>
            <Field label="Lavori da (€)"><input className="input" type="number" value={c.min_job || ''} onChange={(e) => set('min_job', e.target.value)} /></Field>
            <Field label="Fino a (€)"><input className="input" type="number" value={c.max_job || ''} onChange={(e) => set('max_job', e.target.value)} /></Field>
          </div>
          <Field label="Quando potete iniziare un nuovo lavoro"><select className="input" value={c.availability || ''} onChange={(e) => set('availability', e.target.value)}><option value="">Non lo indico</option><option>Subito</option><option>Entro 30 giorni</option><option>Entro 60 giorni</option><option>Oltre 60 giorni</option></select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referente per EdilMen"><input className="input" value={c.contact_name || ''} onChange={(e) => set('contact_name', e.target.value)} /></Field>
            <Field label="Telefono"><input className="input" value={c.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} /></Field>
            <Field label="Email per le richieste" className="col-span-2"><input className="input" value={c.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} /></Field>
          </div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!c.receive_requests} onChange={(e) => set('receive_requests', e.target.checked)} /> <span><b>Ricevo richieste</b> di lavori compatibili nella mia zona</span></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!c.publish_prices} onChange={(e) => set('publish_prices', e.target.checked)} /> <span>Mostra i miei prezzi sui pacchetti nella scheda pubblica (altrimenti li usiamo solo per le offerte, anonime)</span></label>
          <p className="text-xs text-ink-mute">I contatti non sono mostrati ai clienti: i clienti parlano con EdilMen fino al sopralluogo.</p>
        </div>
      </div>
    </>
  );
}

export function ImpresaPrices() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/impresa/prices');
  const [edit, setEdit] = useState({});
  const [fam, setFam] = useState('');
  const mine = useMemo(() => { const m = {}; for (const r of data?.mine || []) m[`${r.pkg}|${r.level}`] = r; return m; }, [data]);
  if (loading) return <Spinner />;
  const fams = [...new Set(data.packages.map((p) => p.family))];
  const save = async () => {
    const prices = Object.entries(edit).map(([k, price]) => { const [pkg, level] = k.split('|'); return { pkg, level: Number(level), price }; });
    if (!prices.length) return;
    try { const r = await api.put('/impresa/prices', { prices }); toast(`${r.saved} prezzi salvati${r.toCheck ? `, ${r.toCheck} da controllare` : ''}`); setEdit({}); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <PageTitle title="Il mio listino sui pacchetti EdilMen" sub="Stesso contenuto per tutte le imprese: voi cambiate il prezzo, non le voci. Indicate il prezzo della parte fissa per unità, IVA esclusa, posa inclusa. Il cliente vede il vostro prezzo + l'accantonamento imprevisti del pacchetto." actions={<button className="btn-primary" onClick={save} disabled={!Object.keys(edit).length}>Salva {Object.keys(edit).length || ''} prezzi</button>} />
      <div className="flex gap-2 mb-3"><select className="input w-auto" value={fam} onChange={(e) => setFam(e.target.value)}><option value="">Tutte le famiglie</option>{fams.map((f) => <option key={f}>{f}</option>)}</select></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="bg-paper"><tr><th className="th">Pacchetto</th><th className="th">Unità</th>{LV.map((l) => <th key={l} className="th">{l}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {data.packages.filter((p) => !fam || p.family === fam).map((p) => (
              <tr key={p.code}>
                <td className="td"><Link to={`/prezzi/${p.code}`} target="_blank" className="font-semibold hover:text-brand">{p.name}</Link><div className="text-xs text-ink-mute">{p.code} · {p.family}</div></td>
                <td className="td text-sm text-ink-soft">{p.unit}</td>
                {[0, 1, 2].map((l) => {
                  const k = `${p.code}|${l}`; const m = mine[k]; const val = edit[k] ?? (m ? m.price : '');
                  const d = val ? Number(val) / p.prices[l] - 1 : null;
                  return (
                    <td key={l} className="td">
                      <input className="input py-1.5 w-28" type="number" value={val} placeholder={num(p.prices[l])} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
                      <div className="text-[11px] mt-0.5">
                        {d != null && <span className={d > 0.15 ? 'text-warn' : d < -0.25 ? 'text-bad' : 'text-ok'}>{d > 0 ? '+' : ''}{num(d * 100)}% sul rif.</span>}
                        {m && <span className="ml-1 text-ink-mute">{m.status === 'approvato' ? '· attivo' : m.status === 'da_controllare' ? '· in controllo' : '· rifiutato'}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-mute mt-3">Sotto il −25% rispetto al riferimento il prezzo è anomalo: resta in controllo finché il team EdilMen non lo verifica con voi. Il riferimento in grigio è il prezzo EdilMen base Trento.</p>
    </>
  );
}

export function ImpresaOpportunities() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/impresa/opportunities');
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({ amount: '', start_days: '', note: '', items: {} });
  if (loading) return <Spinner />;
  const respond = async (body) => { try { await api.post(`/impresa/opportunities/${sel.id}/respond`, body); toast(body.decline ? 'Invito rifiutato' : 'Offerta inviata'); setSel(null); reload(); } catch (e) { toast(e.message, 'err'); } };
  const label = { invitata: ['Da quotare', 'amber'], inviata: ['Offerta inviata', 'blue'], scelta: ['Il cliente ti ha scelto', 'green'], rifiutata: ['Rifiutata', 'gray'], scartata: ['Non aggiudicata', 'gray'] };
  return (
    <>
      <PageTitle title="Opportunità" sub="Richieste compatibili con la tua zona e i tuoi lavori. I contatti del cliente arrivano quando ti sceglie, se lo ha autorizzato." />
      {!data.length ? <div className="card"><Empty title="Nessuna opportunità per ora">Completa profilo e listino: le richieste compatibili arrivano qui.</Empty></div> : (
        <div className="space-y-3">
          {data.map((o) => (
            <div key={o.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[240px]">
                  <div className="font-bold">{o.title}</div>
                  <div className="text-xs text-ink-mute">{o.code} · {o.comune} ({o.provincia}) · {dt(o.created_at)}{o.deadline ? ` · scadenza ${dt(o.deadline)}` : ''}</div>
                  {o.description && <p className="text-sm text-ink-soft mt-2">{o.description}</p>}
                  {o.quote?.lines && <ul className="text-sm mt-2 text-ink-soft">{o.quote.lines.map((l, i) => <li key={i}>• {l.name} — {num(l.qty, 1)} {l.unit}</li>)}</ul>}
                  {o.contact_name && <div className="rounded-xl bg-ok-soft p-3 text-sm mt-3"><b>Cliente:</b> {o.contact_name} {o.contact_phone && `· ${o.contact_phone}`} {o.contact_email && `· ${o.contact_email}`}{o.appointment ? ` · preferisce ${o.appointment.mode}${o.appointment.slot ? ', ' + o.appointment.slot : ''}` : ''}</div>}
                </div>
                <div className="text-right">
                  <Badge tone={label[o.status][1]}>{label[o.status][0]}</Badge>
                  {o.amount && <div className="font-extrabold text-lg mt-1">{eur(o.amount)}</div>}
                  {o.total_ref && o.kind === 'casa' && <div className="text-xs text-ink-mute">riferimento EdilMen {eur(o.total_ref)}</div>}
                  {['invitata', 'inviata'].includes(o.status) && <button className="btn-primary btn-sm mt-2" onClick={() => { setSel(o); setF({ amount: o.amount || '', start_days: o.start_days || '', note: o.note || '', items: {} }); }}>{o.status === 'invitata' ? 'Quota' : 'Modifica offerta'}</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `Offerta per ${sel.code}` : ''} wide={sel?.kind === 'computo'}>
        {sel && sel.kind === 'computo' ? (
          <>
            <table className="w-full text-sm"><thead><tr><th className="th">Voce</th><th className="th text-right">Q.tà</th><th className="th">Prezzo unitario €</th></tr></thead>
              <tbody className="divide-y divide-line">{(sel.items || []).map((it) => <tr key={it.n}><td className="td">{it.n}. {it.desc}</td><td className="td text-right whitespace-nowrap">{num(it.qty)} {it.unit}</td><td className="td"><input className="input py-1.5" type="number" value={f.items[it.n] || ''} onChange={(e) => setF({ ...f, items: { ...f.items, [it.n]: e.target.value } })} /></td></tr>)}</tbody></table>
            <div className="text-right font-bold mt-2">Totale {eur((sel.items || []).reduce((s, it) => s + it.qty * (Number(f.items[it.n]) || 0), 0))}</div>
            <button className="btn-primary w-full mt-4" onClick={() => respond({ items: Object.entries(f.items).map(([n, price]) => ({ n: Number(n), price })), note: f.note })}>Invia i prezzi</button>
          </>
        ) : sel && (
          <div className="space-y-3">
            <button className="btn-soft w-full" onClick={() => respond({ useListino: true, start_days: f.start_days, note: f.note })}>Usa il mio listino sui pacchetti</button>
            <div className="text-center text-xs text-ink-mute">oppure un importo a corpo</div>
            <Field label="Importo, IVA esclusa (€)"><input className="input" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Inizio lavori entro (giorni)"><input className="input" type="number" value={f.start_days} onChange={(e) => setF({ ...f, start_days: e.target.value })} /></Field>
            <Field label="Nota per il cliente"><textarea className="input" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <div className="flex gap-2"><button className="btn-primary flex-1" onClick={() => respond({ amount: f.amount, start_days: f.start_days, note: f.note })}>Invia offerta</button><button className="btn-danger" onClick={() => respond({ decline: true, note: f.note })}>Non mi interessa</button></div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function ImpresaSites() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/impresa/contracts');
  const [up, setUp] = useState(null);
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  if (loading) return <Spinner />;
  const send = async () => {
    const fd = new FormData();
    for (const f of files) fd.append('photos', f);
    fd.append('note', note);
    try { await api.form(`/impresa/sal/${up.id}/request`, fd); toast('SAL inviato al cliente'); setUp(null); setFiles([]); setNote(''); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <PageTitle title="Cantieri e SAL" sub="Per ogni tappa carica le foto del lavoro fatto: il cliente approva e paga." />
      {!data.length ? <div className="card"><Empty title="Nessun cantiere">Quando un cliente firma con te, il cantiere e il piano SAL compaiono qui.</Empty></div> : data.map((k) => (
        <div key={k.id} className="card p-5 mb-4">
          <div className="flex flex-wrap justify-between gap-2"><div><div className="font-bold">{k.title}</div><div className="text-xs text-ink-mute">{k.code} · {k.comune} · cliente {k.contact_name || '—'} {k.contact_phone || ''}</div></div><div className="text-right"><div className="font-extrabold">{eur(k.value)}</div><div className="text-xs text-ink-mute">fee EdilMen {eur(k.fee_total)}</div></div></div>
          <div className="divide-y divide-line mt-3">
            {(k.sal || []).map((s) => (
              <div key={s.id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold w-6">{s.n}</span><span className="flex-1 min-w-[180px]">{s.name} · {num(s.share * 100)}%<span className="block text-xs text-ink-mute">{s.document}</span></span>
                <span className="font-semibold">{eur(s.amount)}</span>
                <Badge tone={{ previsto: 'gray', richiesto: 'amber', approvato: 'green', pagato: 'navy', contestato: 'red' }[s.status]}>{s.status}</Badge>
                {['previsto', 'contestato'].includes(s.status) && <button className="btn-primary btn-sm" onClick={() => setUp(s)}>Chiedi SAL</button>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Modal open={!!up} onClose={() => setUp(null)} title={up ? `SAL ${up.n}: ${up.name}` : ''}>
        <p className="text-sm text-ink-soft mb-3">Documento richiesto: {up?.document}</p>
        <Field label="Foto del lavoro (fino a 10)"><input type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} /></Field>
        <Field label="Nota" className="mt-3"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button className="btn-primary w-full mt-4" onClick={send}>Invia al cliente</button>
      </Modal>
    </>
  );
}

export function ImpresaDocs() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/impresa/docs');
  const [v, setV] = useState({ kind: 'visura', valid_until: '', file: null });
  if (loading) return <Spinner />;
  const send = async () => {
    if (!v.file) return toast('Scegli il file', 'err');
    const fd = new FormData(); fd.append('kind', v.kind); fd.append('valid_until', v.valid_until); fd.append('file', v.file);
    try { await api.form('/impresa/docs', fd); toast('Documento caricato: lo verifichiamo'); setV({ kind: 'visura', valid_until: '', file: null }); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <PageTitle title="Documenti" sub="Visura, DURC, assicurazione e patente a crediti valgono il 25% del rating. Ogni documento conta solo se verificato e non scaduto." />
      <div className="card p-5 grid sm:grid-cols-4 gap-3 items-end">
        <Field label="Tipo"><select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{Object.entries(DOC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Valido fino al"><input className="input" type="date" value={v.valid_until} onChange={(e) => setV({ ...v, valid_until: e.target.value })} /></Field>
        <Field label="File (PDF o foto)"><input type="file" accept=".pdf,image/*" onChange={(e) => setV({ ...v, file: e.target.files[0] })} /></Field>
        <button className="btn-primary" onClick={send}>Carica</button>
      </div>
      <div className="card mt-4 divide-y divide-line">
        {!data.length && <Empty title="Nessun documento caricato" />}
        {data.map((d) => <div key={d.id} className="p-4 flex justify-between text-sm"><span className="font-semibold">{DOC_LABEL[d.kind]}</span><span className="text-ink-soft">{d.valid_until ? `scade il ${dt(d.valid_until)}` : ''}</span><Badge tone={d.status === 'verificato' ? 'green' : d.status === 'rifiutato' ? 'red' : 'amber'}>{d.status}</Badge></div>)}
      </div>
    </>
  );
}

export function ImpresaFees() {
  const { data, loading } = useLoad('/impresa/fees');
  if (loading) return <Spinner />;
  const tot = (f) => data.rows.filter(f).reduce((s, r) => s + r.fee, 0);
  return (
    <>
      <PageTitle title="Fee EdilMen" sub="La fee matura quando il cliente approva un SAL. Nessun costo sui lavori non firmati." />
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Fee maturate" value={eur(tot((r) => ['approvato', 'pagato'].includes(r.status)))} />
        <Stat label="Già saldate" value={eur(tot((r) => r.fee_paid_at))} />
        <Stat label="Previste sui cantieri" value={eur(tot((r) => ['previsto', 'richiesto'].includes(r.status)))} />
      </div>
      <div className="card p-5 mt-4 text-sm"><div className="font-bold mb-2">Le tue regole</div>{data.rules.brackets.map((b, i) => <span key={i} className="mr-4">{num(b.rate * 100)}% {b.upTo ? `fino a ${eur(b.upTo)}` : 'oltre'}</span>)}<div className="text-xs text-ink-mute mt-2">Esempi: {data.example.map((e) => `${eur(e.value)} → ${eur(e.fee)}`).join(' · ')}</div></div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full"><thead className="bg-paper"><tr><th className="th">Lavoro</th><th className="th">SAL</th><th className="th text-right">Importo</th><th className="th text-right">Fee</th><th className="th">Stato</th></tr></thead>
          <tbody className="divide-y divide-line">{data.rows.map((r) => <tr key={r.id}><td className="td">{r.code} · {r.title}</td><td className="td">{r.n}. {r.name}</td><td className="td text-right">{eur(r.amount)}</td><td className="td text-right font-semibold">{eur(r.fee)}</td><td className="td text-sm">{r.fee_paid_at ? 'saldata' : r.fee_invoiced_at ? 'fatturata' : ['approvato', 'pagato'].includes(r.status) ? 'maturata' : 'prevista'}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}
