import React, { useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLoad, useApp, Spinner, ErrorBox, Empty, PageTitle, Stat, Badge, StatusBadge, STATUS, Tabs, eur, num, dt, dtt, useToast, Field, Modal } from '../../ui.jsx';
import { api } from '../../api.js';
import { QuoteBreakdown } from '../public/Wizard.jsx';

export function AdminDashboard() {
  const { data, loading } = useLoad('/admin/dashboard');
  if (loading) return <Spinner />;
  const k = data.k;
  const todo = [
    [k.nuove, 'richieste nuove da contattare', '/admin/richieste?status=nuova'],
    [k.vocali, 'vocali da ascoltare', '/admin/richieste?kind=vocale'],
    [k.sal_da_approvare, 'SAL in attesa del cliente', '/admin/contratti'],
    [k.claim_da_approvare, 'rivendicazioni da approvare', '/admin/rivendicazioni'],
    [k.da_verificare, 'imprese da verificare', '/admin/imprese?status=da_verificare'],
    [k.prezzi_da_controllare, 'prezzi anomali da controllare', '/admin/prezzi-imprese'],
    [k.recensioni, 'recensioni da verificare', '/admin/recensioni'],
    [k.segnalazioni, 'segnalazioni di errori', '/admin/segnalazioni'],
    [k.community, 'prezzi community da controllare', '/admin/prezzi-community'],
    [k.abbonamenti_richiesti, 'imprese che chiedono un piano', '/admin/abbonamenti'],
  ].filter(([n]) => n > 0);
  return (
    <>
      <PageTitle title="Cruscotto" sub={`Oggi, ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}. Tutti i numeri sono letti dal database.`} actions={<Link to="/admin/richieste" className="btn-primary">Vai alle richieste</Link>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Richieste ultimi 7 giorni" value={k.settimana} sub={`${k.nuove} nuove da lavorare`} tone="brand" />
        <Stat label="Imprese nella rete" value={k.rete} sub={`${num(k.imprese)} schede in elenco`} />
        <Stat label="Valore aggiudicato (GMV)" value={eur(k.gmv)} sub={`fee previste ${eur(k.fee_totali)}`} />
        <Stat label="Fee maturate / incassate" value={`${eur(k.fee_maturate)}`} sub={`incassate ${eur(k.fee_incassate)}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="card p-5 lg:col-span-1">
          <div className="font-bold mb-3">Da fare</div>
          {!todo.length ? <p className="text-sm text-ink-soft">Niente in sospeso.</p> : <ul className="space-y-2">{todo.map(([n, l, to]) => <li key={l}><Link to={to} className="flex justify-between text-sm hover:text-brand"><span>{l}</span><span className="font-bold">{n}</span></Link></li>)}</ul>}
          <div className="text-xs text-ink-mute mt-4">{k.stime} stime salvate da agenzie e investitori · {k.inviti_aperti} inviti in attesa di risposta</div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <div className="font-bold mb-3">Pipeline</div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
            {Object.entries(STATUS).map(([s, [l]]) => { const p = data.pipeline.find((x) => x.status === s); return <Link key={s} to={`/admin/richieste?status=${s}`} className="rounded-xl bg-paper p-2 hover:bg-brand-soft"><div className="text-xl font-extrabold">{p?.n || 0}</div><div className="text-[11px] text-ink-soft leading-tight">{l}</div></Link>; })}
          </div>
          <div className="font-bold mt-6 mb-2">Ultime richieste</div>
          {!data.ultime.length ? <p className="text-sm text-ink-soft">Ancora nessuna richiesta.</p> : (
            <div className="divide-y divide-line">{data.ultime.map((r) => <Link key={r.id} to={`/admin/richieste/${r.id}`} className="flex flex-wrap gap-3 py-2 text-sm hover:text-brand"><span className="font-mono text-xs text-ink-mute w-24">{r.code}</span><span className="flex-1 min-w-[160px]">{r.title}</span><span className="text-ink-soft">{r.comune || '—'}</span><span className="w-24 text-right font-semibold">{r.total_ref ? eur(r.total_ref) : ''}</span><StatusBadge s={r.status} /></Link>)}</div>
          )}
        </div>
      </div>
    </>
  );
}

export function AdminRequests() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [newOpen, setNewOpen] = useState(false);
  const qs = new URLSearchParams();
  for (const k of ['status', 'kind', 'source', 'q']) if (sp.get(k)) qs.set(k, sp.get(k));
  const { data, loading } = useLoad('/admin/requests?' + qs, [sp.toString()]);
  const setP = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); };
  const cnt = (s) => data?.counts.find((c) => c.status === s)?.n || 0;
  return (
    <>
      <PageTitle title="Richieste e offerte" sub="Dal sito, dai vocali, dalle agenzie e dalle grandi operazioni. Le stime salvate dalle agenzie sono in un filtro a parte." actions={<button className="btn-primary" onClick={() => setNewOpen(true)}>Nuova richiesta da telefono</button>} />
      <div className="flex flex-wrap gap-2 mb-3">
        <Tabs value={sp.get('status') || ''} onChange={(v) => setP('status', v)} items={[['', 'Tutte', data?.counts.reduce((s, c) => s + c.n, 0)], ...Object.entries(STATUS).map(([k, [l]]) => [k, l, cnt(k)])]} />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setP('q', q); }} className="flex gap-2"><input className="input w-64" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Codice, nome, telefono, comune" /><button className="btn-dark">Cerca</button></form>
        <select className="input w-auto" value={sp.get('kind') || ''} onChange={(e) => setP('kind', e.target.value)}><option value="">Tutti i tipi</option><option value="casa">Quotazioni</option><option value="vocale">Vocali</option><option value="computo">Su computo</option></select>
        <select className="input w-auto" value={sp.get('source') || ''} onChange={(e) => setP('source', e.target.value)}><option value="">Tutte le fonti</option><option value="sito">Sito</option><option value="agenzia">Agenzie</option><option value="grande">Grandi operazioni</option><option value="vocale">Vocale</option><option value="admin">Telefono</option><option value="stima">Solo stime (agenzie)</option></select>
      </div>
      {loading ? <Spinner /> : !data.rows.length ? <div className="card"><Empty title="Nessuna richiesta con questi filtri" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-paper"><tr><th className="th">Richiesta</th><th className="th">Cliente</th><th className="th">Lavoro</th><th className="th text-right">Riferimento</th><th className="th text-center">Offerte</th><th className="th">Stato</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-paper">
                  <td className="td"><Link to={`/admin/richieste/${r.id}`} className="font-mono text-xs font-semibold text-brand">{r.code}</Link><div className="text-xs text-ink-mute">{dtt(r.created_at)}</div><div className="text-[11px] text-ink-mute">{r.source}{r.agency_name ? ` · ${r.agency_name}` : ''}</div></td>
                  <td className="td"><div className="font-semibold">{r.contact_name || 'Senza nome'}</div><div className="text-xs text-ink-soft">{r.contact_channel ? `${r.contact_channel}: ` : ''}{r.contact_phone || r.contact_email || '—'}</div></td>
                  <td className="td"><div>{r.title}</div><div className="text-xs text-ink-mute">{r.comune ? `${r.comune} (${r.provincia})` : '—'}{r.appointment ? ` · 📅 ${r.appointment.mode}` : ''}</div></td>
                  <td className="td text-right font-semibold">{r.total_ref ? eur(r.total_ref) : '—'}</td>
                  <td className="td text-center text-sm">{r.offerte}{r.inviti ? <span className="text-ink-mute"> +{r.inviti} inviti</span> : ''}</td>
                  <td className="td"><StatusBadge s={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewRequestModal open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

function NewRequestModal({ open, onClose }) {
  const nav = useNavigate();
  const [v, setV] = useState({ name: '', phone: '', email: '', description: '', comune: '' });
  const [err, setErr] = useState(null);
  const save = async () => {
    setErr(null);
    try { const r = await api.post('/admin/requests', { kind: 'casa', contact: { name: v.name, phone: v.phone, email: v.email, channel: 'telefono' }, description: v.description, title: v.description.slice(0, 80) || 'Richiesta telefonica', answers: { comune: v.comune } }); onClose(); nav('/admin/richieste/' + r.id); } catch (e) { setErr(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nuova richiesta raccolta al telefono">
      <div className="grid gap-3">
        <Field label="Nome"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Telefono"><input className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field><Field label="Email"><input className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field></div>
        <Field label="Comune"><input className="input" value={v.comune} onChange={(e) => setV({ ...v, comune: e.target.value })} /></Field>
        <Field label="Cosa serve"><textarea className="input" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <p className="text-xs text-ink-mute">Consenso privacy raccolto a voce dall'operatore: viene registrato come tale. Per il prezzo, usa il quotatore dal sito e incolla il link nelle note.</p>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary" onClick={save}>Crea richiesta</button>
      </div>
    </Modal>
  );
}

export function AdminRequest() {
  const { id } = useParams();
  const { boot } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad('/admin/requests/' + id);
  const [notes, setNotes] = useState(null);
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({});
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const { request: r, offers, events, contract, sal, candidates, staff, comparison } = data;
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  const offerTone = { invitata: 'amber', inviata: 'blue', scelta: 'green', rifiutata: 'gray', scartata: 'gray' };
  const invitedIds = new Set(offers.map((o) => o.company_id));
  return (
    <>
      <Link to="/admin/richieste" className="text-sm text-ink-soft">← Richieste</Link>
      <PageTitle title={`${r.code} · ${r.title}`} sub={`${dtt(r.created_at)} · fonte ${r.source}${r.agency_name ? ` (${r.agency_kind} ${r.agency_name})` : ''}${r.property_title ? ` · immobile ${r.property_title}` : ''}`}
        actions={<>
          <select className="input w-auto" value={r.status} onChange={(e) => act(() => api.patch('/admin/requests/' + r.id, { status: e.target.value }), 'Stato aggiornato')}>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="btn-danger" onClick={() => { if (confirm('Eliminare definitivamente la richiesta?')) act(() => api.del('/admin/requests/' + r.id), 'Eliminata').then(() => nav('/admin/richieste')); }}>Elimina</button>
        </>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* OFFERTE */}
          <div className="card p-5">
            <div className="flex flex-wrap justify-between gap-2 mb-3"><div className="font-bold">Imprese e offerte</div>
              <div className="flex gap-2">{r.kind === 'casa' && <button className="btn-soft btn-sm" onClick={() => act(() => api.post(`/admin/requests/${r.id}/match`), 'Matching eseguito')}>Rifai il matching</button>}<button className="btn-ghost btn-sm" onClick={() => setModal('invite')}>Invita imprese</button><button className="btn-ghost btn-sm" onClick={() => { setF({}); setModal('offer'); }}>Offerta manuale</button></div>
            </div>
            {!offers.length ? <p className="text-sm text-ink-soft">Nessuna impresa coinvolta. {candidates.length ? `${candidates.length} imprese della rete sono compatibili con la zona.` : 'Nessuna impresa della rete in zona: invitane una dall\'elenco o convenziona nuove imprese.'}</p> : (
              <table className="w-full text-sm"><tbody className="divide-y divide-line">
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2"><Link to={`/admin/imprese/${o.company_id}`} className="font-semibold hover:text-brand">{o.company_name}</Link><div className="text-xs text-ink-mute">{o.company_comune} · {o.source} · invitata {dt(o.invited_at)}{o.responded_at ? ` · risposta ${dtt(o.responded_at)}` : ''}</div>{o.note && <div className="text-xs text-ink-soft">«{o.note}»</div>}</td>
                    <td className="py-2 text-right font-bold">{o.amount ? eur(o.amount) : '—'}</td>
                    <td className="py-2 pl-3"><Badge tone={offerTone[o.status]}>{o.status}</Badge></td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      {!contract && o.status === 'inviata' && <button className="btn-primary btn-sm" onClick={() => { setF({ offerId: o.id, value: o.amount, payment_mode: 'diretto' }); setModal('contract'); }}>Aggiudica</button>}
                      {['invitata', 'inviata'].includes(o.status) && <button className="btn-ghost btn-sm ml-1" onClick={() => act(() => api.patch('/admin/offers/' + o.id, { status: 'scartata' }), 'Offerta scartata')}>Scarta</button>}
                    </td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>

          {r.kind === 'computo' && comparison && (
            <div className="card p-5 overflow-x-auto"><div className="font-bold mb-2">Computo · confronto voce per voce</div>
              <table className="w-full text-sm min-w-[560px]"><thead><tr><th className="th">Voce</th><th className="th text-right">Q.tà</th>{comparison.offers.map((o) => <th key={o.id} className="th text-right">{o.letter}</th>)}<th className="th text-right">Mediana</th></tr></thead>
                <tbody className="divide-y divide-line">{comparison.items.map((it) => <tr key={it.n}><td className="td">{it.n}. {it.desc}</td><td className="td text-right">{num(it.qty)} {it.unit}</td>{it.prices.map((p, i) => <td key={i} className={`td text-right ${it.flags[i] === 'alto' ? 'text-warn' : it.flags[i] === 'anomalo' ? 'text-bad' : ''}`}>{p ? eur(p, 2) : '—'}</td>)}<td className="td text-right text-ink-soft">{it.median ? eur(it.median, 2) : '—'}</td></tr>)}</tbody></table>
              {!comparison.offers.length && <p className="text-sm text-ink-soft mt-2">{(r.items || []).length} voci. Invita le imprese per ricevere i prezzi.</p>}
            </div>
          )}

          {contract && (
            <div className="card p-5"><div className="flex justify-between"><div className="font-bold">Contratto #{contract.id} · {contract.payment_mode === 'escrow' ? 'escrow' : 'fattura diretta + fee a SAL'}</div><div className="font-extrabold">{eur(contract.value)} · fee {eur(contract.fee_total)}</div></div>
              <div className="divide-y divide-line mt-2">{sal.map((s) => <div key={s.id} className="py-2 flex flex-wrap gap-3 text-sm items-center"><span className="w-6 font-bold">{s.n}</span><span className="flex-1">{s.name}</span><span>{eur(s.amount)}</span><span className="text-ink-soft">fee {eur(s.fee)}</span><Badge tone={{ previsto: 'gray', richiesto: 'amber', approvato: 'green', pagato: 'navy', contestato: 'red' }[s.status]}>{s.status}</Badge></div>)}</div>
              <Link to="/admin/contratti" className="text-sm text-brand font-semibold mt-2 inline-block">Gestisci SAL e fee →</Link>
            </div>
          )}

          {r.quote && <div><div className="font-bold mb-2">Prezzo di riferimento calcolato</div><QuoteBreakdown quote={r.quote} catalog={boot?.catalog} /></div>}
          {r.description && <div className="card p-5"><div className="font-bold mb-1">Descrizione</div><p className="text-sm whitespace-pre-line">{r.description}</p></div>}
          {r.voice_file && <div className="card p-5"><div className="font-bold mb-2">Vocale</div><audio controls src={`/api/files/${r.voice_file}`} className="w-full" /></div>}
        </div>

        <div className="space-y-4">
          <div className="card p-5 text-sm space-y-1.5">
            <div className="font-bold mb-1">Cliente</div>
            <div>{r.contact_name || 'Senza nome'}{r.user_email ? <Badge tone="blue">ha un account</Badge> : null}</div>
            {r.contact_phone && <div>📞 <a href={`tel:${r.contact_phone}`} className="text-brand">{r.contact_phone}</a> {r.contact_channel === 'whatsapp' && <a className="text-brand ml-2" target="_blank" rel="noreferrer" href={`https://wa.me/${r.contact_phone.replace(/\D/g, '').replace(/^3/, '393')}`}>WhatsApp</a>}</div>}
            {r.contact_email && <div>✉️ <a href={`mailto:${r.contact_email}`} className="text-brand">{r.contact_email}</a></div>}
            <div className="text-ink-soft">Preferisce: {r.contact_channel || '—'}</div>
            <div className="text-ink-soft">Zona: {r.comune ? `${r.comune} (${r.provincia}), ${r.regione || ''}` : '—'}</div>
            {r.appointment && <div className="rounded-xl bg-brand-soft p-2 mt-2">📅 {r.appointment.mode}{r.appointment.slot ? ` · ${r.appointment.slot}` : ''}{r.appointment.note ? ` · ${r.appointment.note}` : ''}</div>}
            <div className="pt-2 border-t border-line mt-2"><div className="font-semibold mb-1">Consensi</div>{Object.entries(r.consents || {}).map(([k, c]) => <div key={k} className="text-xs">{k}: {c.granted ? 'sì' : 'no'} · {c.version} · {dtt(c.at)}</div>)}</div>
            <a href={`/richiesta/${r.share_token}`} target="_blank" rel="noreferrer" className="text-xs text-brand font-semibold block pt-2">Pagina del cliente ↗</a>
          </div>
          <div className="card p-5">
            <Field label="Assegnata a"><select className="input" value={r.assigned_to || ''} onChange={(e) => act(() => api.patch('/admin/requests/' + r.id, { assigned_to: e.target.value || '' }), 'Assegnata')}><option value="">Nessuno</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}</select></Field>
            <Field label="Note interne" className="mt-3"><textarea className="input" rows={4} value={notes ?? r.notes ?? ''} onChange={(e) => setNotes(e.target.value)} /></Field>
            <button className="btn-dark btn-sm mt-2" onClick={() => act(() => api.patch('/admin/requests/' + r.id, { notes }), 'Note salvate')}>Salva note</button>
          </div>
          <div className="card p-5"><div className="font-bold mb-2">Storico</div><ul className="space-y-1.5 text-xs">{events.map((e) => <li key={e.id}><span className="text-ink-mute">{dtt(e.at)}</span> · <b>{e.type.replace(/_/g, ' ')}</b>{e.user_email ? ` · ${e.user_email}` : ''}{e.data && Object.keys(e.data).length ? <span className="text-ink-mute"> {JSON.stringify(e.data)}</span> : ''}</li>)}</ul></div>
        </div>
      </div>

      <Modal open={modal === 'invite'} onClose={() => setModal(null)} title="Invita imprese a quotare">
        {!candidates.length ? <p className="text-sm text-ink-soft">Nessuna impresa della rete compatibile con la zona. Attiva imprese in rete dalla sezione Imprese (stato attiva, rete, «riceve richieste», comune o province servite).</p> : (
          <div className="space-y-2">{candidates.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={invitedIds.has(c.id)} checked={invitedIds.has(c.id) || !!f['c' + c.id]} onChange={(e) => setF({ ...f, ['c' + c.id]: e.target.checked })} />{c.name} <span className="text-ink-mute">· {c.comune} {c.km != null ? `· ${c.km} km` : ''}</span></label>)}
            <button className="btn-primary w-full mt-3" onClick={() => act(() => api.post(`/admin/requests/${r.id}/invite`, { companyIds: candidates.filter((c) => f['c' + c.id]).map((c) => c.id) }), 'Inviti inviati').then(() => setModal(null))}>Invita</button>
          </div>
        )}
      </Modal>
      <Modal open={modal === 'offer'} onClose={() => setModal(null)} title="Offerta raccolta da EdilMen">
        <div className="space-y-3">
          <Field label="ID impresa (dalla scheda impresa)"><input className="input" value={f.companyId || ''} onChange={(e) => setF({ ...f, companyId: e.target.value })} /></Field>
          {candidates.length > 0 && <select className="input" onChange={(e) => setF({ ...f, companyId: e.target.value })} value={f.companyId || ''}><option value="">…o scegli tra le imprese in zona</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          <Field label="Importo IVA esclusa (€)"><input className="input" type="number" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Inizio entro (giorni)"><input className="input" type="number" value={f.start_days || ''} onChange={(e) => setF({ ...f, start_days: e.target.value })} /></Field>
          <Field label="Nota"><input className="input" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={() => act(() => api.post(`/admin/requests/${r.id}/offers`, f), 'Offerta registrata').then(() => setModal(null))}>Registra</button>
        </div>
      </Modal>
      <Modal open={modal === 'contract'} onClose={() => setModal(null)} title="Aggiudica e crea il contratto">
        <div className="space-y-3">
          <Field label="Valore del contratto, IVA esclusa (€)" hint="Dopo il sopralluogo: può essere solo uguale o più basso del prudente, salvo lavori aggiunti."><input className="input" type="number" value={f.value || ''} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="Modalità di incasso"><select className="input" value={f.payment_mode} onChange={(e) => setF({ ...f, payment_mode: e.target.value })}><option value="diretto">Fattura diretta dell'impresa + fee a SAL</option><option value="escrow">Escrow presso istituto di pagamento</option></select></Field>
          <Field label="Data firma"><input className="input" type="date" value={f.signed_at || ''} onChange={(e) => setF({ ...f, signed_at: e.target.value })} /></Field>
          <p className="text-xs text-ink-mute">Si crea il piano SAL dal listino e la fee a scaglioni (regole dell'impresa o generali). Le altre offerte vengono chiuse.</p>
          <button className="btn-primary w-full" onClick={() => act(() => api.post(`/admin/requests/${r.id}/contract`, f), 'Contratto creato').then(() => setModal(null))}>Crea contratto</button>
        </div>
      </Modal>
    </>
  );
}
