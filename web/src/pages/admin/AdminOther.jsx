import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad, useApp, Spinner, Empty, PageTitle, Badge, Tabs, eur, num, dt, dtt, useToast, Field, Modal, Stat } from '../../ui.jsx';
import { api } from '../../api.js';

const SAL_TONE = { previsto: 'gray', richiesto: 'amber', approvato: 'green', pagato: 'navy', contestato: 'red' };

export function AdminContracts() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/admin/contracts');
  if (loading) return <Spinner />;
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  const all = data.flatMap((k) => k.sal || []);
  const sum = (f) => all.filter(f).reduce((s, x) => s + x.fee, 0);
  return (
    <>
      <PageTitle title="Contratti, SAL e fee" sub="L'impresa chiede il SAL con foto, il cliente approva. La fee matura all'approvazione; qui segni fatturazione e incasso." />
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Contratti" value={data.length} sub={eur(data.reduce((s, k) => s + Number(k.value), 0)) + ' di lavori'} />
        <Stat label="Fee maturate" value={eur(sum((s) => ['approvato', 'pagato'].includes(s.status)))} />
        <Stat label="Fee fatturate non incassate" value={eur(sum((s) => s.fee_invoiced_at && !s.fee_paid_at))} />
        <Stat label="Fee incassate" value={eur(sum((s) => s.fee_paid_at))} tone="brand" />
      </div>
      {!data.length ? <div className="card"><Empty title="Nessun contratto">Si crea aggiudicando un'offerta dalla scheda della richiesta.</Empty></div> : data.map((k) => (
        <div key={k.id} className="card p-5 mb-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div><Link to={`/admin/richieste/${k.request_id}`} className="font-bold hover:text-brand">{k.code} · {k.title}</Link><div className="text-xs text-ink-mute">{k.company_name} · {k.payment_mode === 'escrow' ? 'escrow' : 'fattura diretta + fee a SAL'} · firmato {dt(k.signed_at)}</div></div>
            <div className="flex items-center gap-2"><div className="text-right"><div className="font-extrabold">{eur(k.value)}</div><div className="text-xs text-ink-mute">fee {eur(k.fee_total)}</div></div>
              <select className="input w-auto py-1.5" value={k.status} onChange={(e) => act(() => api.patch('/admin/contracts/' + k.id, { status: e.target.value }), 'Contratto aggiornato')}><option value="attivo">Attivo</option><option value="concluso">Concluso</option><option value="annullato">Annullato</option></select>
            </div>
          </div>
          <table className="w-full text-sm mt-3"><tbody className="divide-y divide-line">{(k.sal || []).map((s) => (
            <tr key={s.id}><td className="py-2 w-6 font-bold">{s.n}</td><td className="py-2">{s.name}{s.photos?.length ? <span className="text-xs text-ink-mute"> · {s.photos.length} foto</span> : ''}{s.note && <div className="text-xs text-ink-soft">{s.note}</div>}</td><td className="py-2 text-right">{eur(s.amount)}</td><td className="py-2 text-right text-ink-soft">fee {eur(s.fee)}</td><td className="py-2 pl-2"><Badge tone={SAL_TONE[s.status]}>{s.status}</Badge></td>
              <td className="py-2 text-right whitespace-nowrap">
                {s.photos?.length > 0 && <a className="btn-ghost btn-sm" href={`/api/files/${s.photos[0]}`} target="_blank" rel="noreferrer">Foto</a>}
                {s.status === 'richiesto' && <button className="btn-soft btn-sm ml-1" onClick={() => act(() => api.patch('/admin/sal/' + s.id, { action: 'approva' }), 'Approvato per conto del cliente')}>Approva</button>}
                {['approvato'].includes(s.status) && <button className="btn-ghost btn-sm ml-1" onClick={() => act(() => api.patch('/admin/sal/' + s.id, { action: 'pagato' }), 'Segnato pagato')}>Pagato</button>}
                {['approvato', 'pagato'].includes(s.status) && !s.fee_invoiced_at && <button className="btn-ghost btn-sm ml-1" onClick={() => act(() => api.patch('/admin/sal/' + s.id, { action: 'fattura_fee' }), 'Fee fatturata')}>Fattura fee</button>}
                {s.fee_invoiced_at && !s.fee_paid_at && <button className="btn-primary btn-sm ml-1" onClick={() => act(() => api.patch('/admin/sal/' + s.id, { action: 'fee_incassata' }), 'Fee incassata')}>Fee incassata</button>}
                {s.fee_paid_at && <span className="text-xs text-ok ml-2">fee incassata {dt(s.fee_paid_at)}</span>}
              </td></tr>
          ))}</tbody></table>
        </div>
      ))}
    </>
  );
}

const ART = [['da_chiamare', 'Da chiamare'], ['da_richiamare', 'Da richiamare'], ['interessato', 'Interessato'], ['convenzionato', 'Convenzionato'], ['non_interessato', 'Non interessato'], ['numero_errato', 'Numero errato'], ['escluso', 'Escluso']];
export function AdminArtisans() {
  const toast = useToast();
  const [st, setSt] = useState('');
  const [q, setQ] = useState('');
  const [qq, setQq] = useState('');
  const { data, loading, reload } = useLoad(`/admin/artisans?status=${st}&q=${encodeURIComponent(qq)}`, [st, qq]);
  const [imp, setImp] = useState(false);
  const [file, setFile] = useState(null);
  const [nw, setNw] = useState(null);
  const act = async (fn, msg) => { try { const r = await fn(); toast(msg); reload(); return r; } catch (e) { toast(e.message, 'err'); } };
  const cnt = (s) => data?.counts.find((c) => c.status === s)?.n || 0;
  return (
    <>
      <PageTitle title="Rubrica artigiani" sub="Il call center per portare nuove imprese nella rete. Chiama, segna l'esito; quando accettano, crea la scheda impresa con un clic." actions={<><button className="btn-ghost" onClick={() => setImp(true)}>Importa da Excel</button><button className="btn-primary" onClick={() => setNw({})}>Nuovo contatto</button></>} />
      <Tabs value={st} onChange={setSt} items={[['', 'Tutti', data?.counts.reduce((s, c) => s + c.n, 0)], ...ART.map(([k, l]) => [k, l, cnt(k)])]} />
      <form onSubmit={(e) => { e.preventDefault(); setQq(q); }} className="flex gap-2 my-4"><input className="input w-72" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, ditta, mestiere, zona, numero" /><button className="btn-dark">Cerca</button></form>
      {loading ? <Spinner /> : !data.rows.length ? <div className="card"><Empty title="Nessun contatto">Importa il file Excel della rubrica (foglio «Contatti»).</Empty></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]"><thead className="bg-paper"><tr><th className="th">Contatto</th><th className="th">Mestiere</th><th className="th">Telefono</th><th className="th">Zona</th><th className="th">Esito</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-line">{data.rows.map((a) => (
              <tr key={a.id}>
                <td className="td"><div className="font-semibold">{a.name}</div><div className="text-xs text-ink-mute">{a.company_name || ''}{a.vat ? ` · P.IVA ${a.vat}` : ''}</div>{a.notes && <div className="text-xs text-ink-soft max-w-xs">{a.notes}</div>}</td>
                <td className="td text-sm">{a.trade || '—'}</td>
                <td className="td text-sm whitespace-nowrap">{a.phone ? <a className="text-brand" href={`tel:${a.phone}`}>{a.phone}</a> : '—'}</td>
                <td className="td text-sm">{a.zone || '—'}</td>
                <td className="td"><select className="input py-1.5 w-40" value={a.status} onChange={(e) => act(() => api.patch('/admin/artisans/' + a.id, { status: e.target.value }), 'Esito salvato')}>{ART.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><div className="text-[11px] text-ink-mute mt-0.5">{a.last_contact ? `ultimo contatto ${dtt(a.last_contact)}` : 'mai contattato'}</div></td>
                <td className="td whitespace-nowrap">
                  <button className="btn-ghost btn-sm" onClick={() => { const n = prompt('Nota', a.notes || ''); if (n != null) act(() => api.patch('/admin/artisans/' + a.id, { notes: n }), 'Nota salvata'); }}>Nota</button>
                  {a.company_id ? <Link to={`/admin/imprese/${a.company_id}`} className="btn-soft btn-sm ml-1">Scheda</Link> : <button className="btn-soft btn-sm ml-1" onClick={() => act(() => api.post(`/admin/artisans/${a.id}/to-company`), 'Scheda impresa creata')}>Crea impresa</button>}
                </td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      <Modal open={imp} onClose={() => setImp(false)} title="Importa la rubrica">
        <p className="text-sm text-ink-soft">Excel con le colonne della rubrica EdilMen (Nome contatto, Ditta, Categoria EdilMen, Cellulare, Email, Sede / Zona, P.IVA, Note, Stato contatto) o un CSV equivalente. I numeri già presenti vengono saltati.</p>
        <input type="file" accept=".xlsx,.csv" className="mt-4" onChange={(e) => setFile(e.target.files[0])} />
        <button className="btn-primary w-full mt-4" disabled={!file} onClick={() => { const fd = new FormData(); fd.append('file', file); act(() => api.form('/admin/artisans/import', fd), 'Rubrica importata').then((r) => { if (r) toast(`${r.imported} importati, ${r.duplicates} doppi`); setImp(false); }); }}>Importa</button>
      </Modal>
      <Modal open={!!nw} onClose={() => setNw(null)} title="Nuovo contatto">
        {nw && <div className="grid gap-3">{[['name', 'Nome'], ['company_name', 'Ditta'], ['trade', 'Mestiere'], ['phone', 'Telefono'], ['email', 'Email'], ['zone', 'Zona'], ['vat', 'P.IVA'], ['notes', 'Note']].map(([k, l]) => <Field key={k} label={l}><input className="input" value={nw[k] || ''} onChange={(e) => setNw({ ...nw, [k]: e.target.value })} /></Field>)}<button className="btn-primary" onClick={() => act(() => api.post('/admin/artisans', nw), 'Contatto aggiunto').then(() => setNw(null))}>Aggiungi</button></div>}
      </Modal>
    </>
  );
}

export function AdminReviews() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/admin/reviews');
  if (loading) return <Spinner />;
  const act = async (id, status) => { try { await api.patch('/admin/reviews/' + id, { status }); toast('Aggiornata'); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <PageTitle title="Recensioni" sub="Solo da clienti con un contratto concluso tramite EdilMen. Si rifiuta solo se il lavoro non è verificabile o se contiene insulti o dati personali: mai perché è negativa." />
      {!data.length ? <div className="card"><Empty title="Nessuna recensione" /></div> : (
        <div className="card divide-y divide-line">{data.map((r) => (
          <div key={r.id} className="p-4 flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]"><div className="font-semibold">{r.company_name} <span className="text-xs text-ink-mute">· {r.code} · {dt(r.created_at)}</span></div><div className="text-xs text-ink-soft mt-1">{Object.entries(r.scores).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>{r.text && <p className="text-sm mt-1">«{r.text}»</p>}</div>
            <Badge tone={r.status === 'pubblicata' ? 'green' : r.status === 'rifiutata' ? 'red' : 'amber'}>{r.status}</Badge>
            {r.status !== 'pubblicata' && <button className="btn-primary btn-sm" onClick={() => act(r.id, 'pubblicata')}>Pubblica</button>}
            {r.status !== 'rifiutata' && <button className="btn-ghost btn-sm" onClick={() => act(r.id, 'rifiutata')}>Rifiuta</button>}
          </div>
        ))}</div>
      )}
    </>
  );
}

export function AdminReports() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/admin/reports');
  if (loading) return <Spinner />;
  return (
    <>
      <PageTitle title="Segnalazioni di errori" sub="Dal pulsante «Segnala un errore» delle schede pubbliche." />
      {!data.length ? <div className="card"><Empty title="Nessuna segnalazione" /></div> : (
        <div className="card divide-y divide-line">{data.map((r) => (
          <div key={r.id} className="p-4 flex flex-wrap gap-3 items-start text-sm">
            <div className="flex-1"><Link to={`/imprese/${r.slug}`} target="_blank" className="font-semibold hover:text-brand">{r.company_name}</Link> <span className="text-xs text-ink-mute">· {dtt(r.created_at)} {r.email ? `· ${r.email}` : ''}</span><p className="mt-1">{r.text}</p></div>
            <Badge tone={r.status === 'aperta' ? 'amber' : 'gray'}>{r.status}</Badge>
            {r.status === 'aperta' && <button className="btn-ghost btn-sm" onClick={async () => { await api.patch('/admin/reports/' + r.id, { status: 'chiusa' }); toast('Chiusa'); reload(); }}>Chiudi</button>}
          </div>
        ))}</div>
      )}
    </>
  );
}

export function AdminUsers() {
  const toast = useToast();
  const { user } = useApp();
  const { data, loading, error, reload } = useLoad('/admin/users');
  const [nw, setNw] = useState(null);
  const [f, setF] = useState('');
  if (user.role !== 'admin') return <Empty title="Solo gli amministratori gestiscono gli utenti" />;
  if (loading) return <Spinner />;
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  const rows = data.filter((u) => !f || u.role === f);
  return (
    <>
      <PageTitle title="Utenti" sub="Clienti, agenzie, investitori, imprese e staff EdilMen." actions={<button className="btn-primary" onClick={() => setNw({ role: 'operatore' })}>Nuovo operatore / admin</button>} />
      <Tabs value={f} onChange={setF} items={[['', 'Tutti', data.length], ...['admin', 'operatore', 'cliente', 'agenzia', 'investitore', 'impresa'].map((r) => [r, r, data.filter((u) => u.role === r).length])]} />
      <div className="card overflow-x-auto mt-4">
        <table className="w-full min-w-[760px]"><thead className="bg-paper"><tr><th className="th">Utente</th><th className="th">Ruolo</th><th className="th">Organizzazione</th><th className="th">Ultimo accesso</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((u) => (
            <tr key={u.id}><td className="td"><div className="font-semibold">{u.email}</div><div className="text-xs text-ink-mute">{u.name || ''} · dal {dt(u.created_at)}</div></td><td className="td"><Badge tone={['admin', 'operatore'].includes(u.role) ? 'navy' : 'gray'}>{u.role}</Badge></td><td className="td text-sm">{u.company_name || u.agency_name || '—'}</td><td className="td text-sm">{dtt(u.last_login_at)}</td>
              <td className="td whitespace-nowrap text-right"><button className="btn-ghost btn-sm" onClick={() => { const p = prompt('Nuova password (min 8 caratteri)'); if (p) act(() => api.patch('/admin/users/' + u.id, { password: p }), 'Password cambiata'); }}>Reimposta password</button><button className={`btn-sm ml-1 ${u.active ? 'btn-danger' : 'btn-soft'}`} onClick={() => act(() => api.patch('/admin/users/' + u.id, { active: !u.active }), u.active ? 'Disattivato' : 'Riattivato')}>{u.active ? 'Disattiva' : 'Riattiva'}</button></td></tr>
          ))}</tbody></table>
      </div>
      <Modal open={!!nw} onClose={() => setNw(null)} title="Nuovo membro dello staff">
        {nw && <div className="grid gap-3">
          <Field label="Ruolo"><select className="input" value={nw.role} onChange={(e) => setNw({ ...nw, role: e.target.value })}><option value="operatore">Operatore (richieste, imprese, rubrica)</option><option value="admin">Amministratore (tutto)</option></select></Field>
          {[['email', 'Email'], ['name', 'Nome'], ['password', 'Password provvisoria']].map(([k, l]) => <Field key={k} label={l}><input className="input" value={nw[k] || ''} onChange={(e) => setNw({ ...nw, [k]: e.target.value })} /></Field>)}
          <button className="btn-primary" onClick={() => act(() => api.post('/admin/users', nw), 'Utente creato').then(() => setNw(null))}>Crea</button>
        </div>}
      </Modal>
    </>
  );
}

export function AdminAudit() {
  const { data, loading } = useLoad('/admin/audit');
  if (loading) return <Spinner />;
  return (
    <>
      <PageTitle title="Registro attività" sub="Chi ha cambiato cosa: listino, imprese, prezzi, utenti, impostazioni. Utile per la due diligence." />
      <div className="card overflow-x-auto"><table className="w-full min-w-[700px]"><thead className="bg-paper"><tr><th className="th">Quando</th><th className="th">Chi</th><th className="th">Azione</th><th className="th">Oggetto</th><th className="th">Dettagli</th></tr></thead>
        <tbody className="divide-y divide-line">{data.map((a) => <tr key={a.id}><td className="td text-sm whitespace-nowrap">{dtt(a.at)}</td><td className="td text-sm">{a.email || '—'}</td><td className="td text-sm font-semibold">{a.action.replace(/_/g, ' ')}</td><td className="td text-sm">{a.entity} {a.entity_id}</td><td className="td text-xs text-ink-mute max-w-md truncate">{a.data ? JSON.stringify(a.data) : ''}</td></tr>)}</tbody></table></div>
    </>
  );
}
