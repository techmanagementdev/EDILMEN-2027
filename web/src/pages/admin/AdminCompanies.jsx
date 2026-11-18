import React, { useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLoad, useApp, Spinner, ErrorBox, Empty, PageTitle, Badge, Tabs, eur, num, dt, dtt, useToast, Field, Modal, RatingBox, DOC_LABEL } from '../../ui.jsx';
import { api } from '../../api.js';

const ST = { catalogo: ['Nel catalogo', 'gray'], da_verificare: ['Da verificare', 'amber'], attiva: ['Attiva', 'green'], sospesa: ['Sospesa', 'red'] };

export function AdminCompanies() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState(sp.get('q') || '');
  const [modal, setModal] = useState(null);
  const [nv, setNv] = useState({ name: '', vat: '', comune: '', website: '', contact_email: '', contact_phone: '' });
  const [file, setFile] = useState(null);
  const qs = new URLSearchParams(); for (const k of ['status', 'network', 'q', 'page', 'regione']) if (sp.get(k)) qs.set(k, sp.get(k));
  const { data, loading, reload } = useLoad('/admin/companies?' + qs, [sp.toString()]);
  const setP = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); n.delete('page'); setSp(n); };
  const tab = sp.get('network') === 'true' ? 'rete' : sp.get('status') || '';
  const create = async () => { try { const r = await api.post('/admin/companies', nv); nav('/admin/imprese/' + r.id); } catch (e) { toast(e.message, 'err'); } };
  const importFile = async () => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { const r = await api.form('/admin/companies/import', fd); toast(`Importate: ${r.created} nuove, ${r.updated} aggiornate, ${r.skipped} saltate`); setModal(null); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <PageTitle title="Imprese" sub="Catalogo, verifiche e rete convenzionata. La rete è fatta di imprese attive, con convenzione e «riceve richieste»." actions={<><button className="btn-ghost" onClick={() => setModal('import')}>Importa CSV / Excel</button><button className="btn-primary" onClick={() => setModal('new')}>Nuova impresa</button></>} />
      {data && <Tabs value={tab} onChange={(v) => { const n = new URLSearchParams(); if (v === 'rete') n.set('network', 'true'); else if (v) n.set('status', v); setSp(n); }} items={[['', 'Tutte', data.counts.tutte], ['rete', 'Nella rete', data.counts.rete], ['da_verificare', 'Da verificare', data.counts.da_verificare], ['catalogo', 'Solo catalogo', data.counts.catalogo], ['sospesa', 'Sospese', data.counts.sospese]]} />}
      <form onSubmit={(e) => { e.preventDefault(); setP('q', q); }} className="flex gap-2 my-4"><input className="input w-72" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, comune o partita IVA" /><button className="btn-dark">Cerca</button></form>
      {loading ? <Spinner /> : !data.rows.length ? <div className="card"><Empty title="Nessuna impresa">Importa un elenco o crea la prima impresa.</Empty></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px]"><thead className="bg-paper"><tr><th className="th">Impresa</th><th className="th">Zona</th><th className="th">Categorie</th><th className="th text-center">Listino</th><th className="th text-center">Documenti</th><th className="th">Stato</th></tr></thead>
            <tbody className="divide-y divide-line">{data.rows.map((c) => (
              <tr key={c.id} className="hover:bg-paper">
                <td className="td"><Link to={`/admin/imprese/${c.id}`} className="font-semibold hover:text-brand">{c.name}</Link><div className="text-xs text-ink-mute">{c.vat ? `P.IVA ${c.vat}` : 'P.IVA mancante'}{c.claimed_at ? ' · scheda rivendicata' : ''}</div></td>
                <td className="td text-sm">{c.comune ? `${c.comune} (${c.provincia})` : '—'}</td>
                <td className="td text-xs text-ink-soft">{(c.categories || []).slice(0, 3).join(', ')}</td>
                <td className="td text-center text-sm">{c.prezzi || '—'}</td>
                <td className="td text-center text-sm">{c.documenti}/4</td>
                <td className="td"><Badge tone={ST[c.status][1]}>{ST[c.status][0]}</Badge> {c.network && <Badge tone="blue">Rete</Badge>} {c.network && !c.receive_requests && <Badge tone="amber">non riceve</Badge>}</td>
              </tr>
            ))}</tbody></table>
          <div className="flex justify-between items-center p-3 text-sm text-ink-soft"><span>{data.total} imprese</span><span className="flex gap-2">{Number(sp.get('page') || 1) > 1 && <button className="btn-ghost btn-sm" onClick={() => { const n = new URLSearchParams(sp); n.set('page', Number(sp.get('page')) - 1); setSp(n); }}>←</button>}{Number(sp.get('page') || 1) * data.pageSize < data.total && <button className="btn-ghost btn-sm" onClick={() => { const n = new URLSearchParams(sp); n.set('page', Number(sp.get('page') || 1) + 1); setSp(n); }}>→</button>}</span></div>
        </div>
      )}
      <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Nuova impresa">
        <div className="grid gap-3">
          {[['name', 'Ragione sociale'], ['vat', 'Partita IVA'], ['comune', 'Comune della sede'], ['website', 'Sito web'], ['contact_email', 'Email aziendale'], ['contact_phone', 'Telefono aziendale']].map(([k, l]) => <Field key={k} label={l}><input className="input" value={nv[k]} onChange={(e) => setNv({ ...nv, [k]: e.target.value })} /></Field>)}
          <button className="btn-primary" onClick={create}>Crea e apri la scheda</button>
        </div>
      </Modal>
      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Importa imprese da CSV o Excel">
        <p className="text-sm text-ink-soft">Colonne riconosciute: ragione sociale / denominazione, partita iva, comune, provincia, sito, telefono, email, categorie, ateco, fonte. Le imprese con la stessa partita IVA vengono aggiornate. Fonte e data di controllo sono registrate per ogni riga.</p>
        <p className="text-xs text-warn mt-2">Usa solo fonti di cui puoi riutilizzare i dati (registro imprese, open data). Le email nominative sono dati personali: non usarle per campagne senza base giuridica.</p>
        <input type="file" accept=".csv,.xlsx" className="mt-4" onChange={(e) => setFile(e.target.files[0])} />
        <button className="btn-primary w-full mt-4" onClick={importFile} disabled={!file}>Importa</button>
      </Modal>
    </>
  );
}

export function AdminCompany() {
  const { id } = useParams();
  const { boot, user } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad('/admin/companies/' + id);
  const [v, setV] = useState(null);
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({});
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const c = v || data.company;
  const set = (k, val) => setV({ ...c, [k]: val });
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  const save = () => act(async () => { await api.put('/admin/companies/' + id, { ...c, fee_rules: c.fee_rules || null }); setV(null); }, 'Impresa salvata');
  const pkgName = (code) => boot?.catalog?.packages.find((p) => p.code === code)?.name || code;
  const feeCustom = !!c.fee_rules;
  return (
    <>
      <Link to="/admin/imprese" className="text-sm text-ink-soft">← Imprese</Link>
      <PageTitle title={c.name} sub={`${c.comune || '—'}${c.provincia ? ` (${c.provincia})` : ''} · fonte ${c.source || '—'} · controllata ${dt(c.checked_at)}`} actions={<>
        <a href={`/imprese/${c.slug}`} target="_blank" rel="noreferrer" className="btn-ghost">Scheda pubblica ↗</a>
        {user.role === 'admin' && <button className="btn-danger" onClick={() => { if (confirm('Eliminare l\'impresa?')) act(() => api.del('/admin/companies/' + id), 'Eliminata').then(() => nav('/admin/imprese')); }}>Elimina</button>}
        <button className="btn-primary" onClick={save} disabled={!v}>Salva modifiche</button>
      </>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="font-bold mb-3">Stato nella rete</div>
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <Field label="Stato"><select className="input" value={c.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <label className="flex gap-2 text-sm py-2.5"><input type="checkbox" checked={c.network} onChange={(e) => set('network', e.target.checked)} /> Convenzionata (rete)</label>
              <label className="flex gap-2 text-sm py-2.5"><input type="checkbox" checked={c.receive_requests} onChange={(e) => set('receive_requests', e.target.checked)} /> Riceve richieste</label>
              <Field label="Piano"><select className="input" value={c.plan} onChange={(e) => set('plan', e.target.value)}>{(boot?.plans || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            </div>
            <div className="mt-3 text-xs text-ink-mute">{c.convention_signed_at ? `Convenzione dal ${dt(c.convention_signed_at)}` : 'Convenzione non registrata'} · per ricevere richieste serve: stato attiva + rete + riceve richieste + comune o province servite.</div>
            <div className="mt-4">
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={feeCustom} onChange={(e) => set('fee_rules', e.target.checked ? JSON.parse(JSON.stringify(boot.fee)) : null)} /> Fee personalizzata per questa impresa</label>
              {feeCustom && <div className="flex flex-wrap gap-3 mt-2">{c.fee_rules.brackets.map((b, i) => <div key={i} className="flex items-center gap-1 text-sm"><input className="input w-20 py-1.5" type="number" step="0.5" value={b.rate * 100} onChange={(e) => { const fr = JSON.parse(JSON.stringify(c.fee_rules)); fr.brackets[i].rate = Number(e.target.value) / 100; set('fee_rules', fr); }} />% {b.upTo ? `fino a ${eur(b.upTo)}` : 'oltre'}</div>)}</div>}
            </div>
          </div>
          <div className="card p-5 grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 font-bold">Anagrafica e contatti</div>
            {[['name', 'Ragione sociale'], ['vat', 'Partita IVA'], ['legal_form', 'Forma giuridica'], ['ateco', 'ATECO'], ['address', 'Indirizzo'], ['comune', 'Comune'], ['website', 'Sito web'], ['contact_name', 'Referente'], ['contact_phone', 'Telefono'], ['contact_email', 'Email'], ['source', 'Fonte dei dati'], ['source_url', 'URL fonte']].map(([k, l]) => <Field key={k} label={l}><input className="input" value={c[k] || ''} onChange={(e) => set(k, e.target.value)} /></Field>)}
            <Field label="Tipo di contatto"><select className="input" value={c.contact_kind} onChange={(e) => set('contact_kind', e.target.value)}><option value="corporate">Aziendale (centralino, info@)</option><option value="personal">Personale (dato personale GDPR)</option></select></Field>
            <Field label="Categorie (separate da virgola)"><input className="input" value={(c.categories || []).join(', ')} onChange={(e) => set('categories', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></Field>
            <Field label="Province servite"><input className="input" value={(c.provinces_served || []).join(', ')} onChange={(e) => set('provinces_served', e.target.value.toUpperCase().split(/[ ,]+/).filter(Boolean))} /></Field>
            <Field label="Raggio km"><input className="input" type="number" value={c.radius_km} onChange={(e) => set('radius_km', Number(e.target.value))} /></Field>
            <Field label="Descrizione" className="sm:col-span-2"><textarea className="input" rows={3} value={c.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
          </div>
          <div className="card p-5"><div className="font-bold mb-2">Listino dell'impresa</div>
            {!data.prices.length ? <p className="text-sm text-ink-soft">Nessun prezzo inserito.</p> : <table className="w-full text-sm"><tbody className="divide-y divide-line">{data.prices.map((p) => { const d = p.ref_price ? p.price / p.ref_price - 1 : null; return <tr key={p.pkg + p.level}><td className="py-1.5">{pkgName(p.pkg)} <span className="text-ink-mute">· {['Std', 'Int', 'Prem'][p.level]}</span></td><td className="py-1.5 text-right font-semibold">{eur(p.price)}</td><td className={`py-1.5 text-right text-xs ${d > 0.15 ? 'text-warn' : d < -0.25 ? 'text-bad' : 'text-ok'}`}>{d != null ? `${d > 0 ? '+' : ''}${num(d * 100)}%` : ''}</td><td className="py-1.5 text-right"><Badge tone={p.status === 'approvato' ? 'green' : p.status === 'rifiutato' ? 'red' : 'amber'}>{p.status}</Badge></td><td className="py-1.5 text-right whitespace-nowrap">{p.status !== 'approvato' && <button className="btn-soft btn-sm" onClick={() => act(() => api.patch('/admin/prices', { company_id: c.id, pkg: p.pkg, level: p.level, status: 'approvato' }), 'Approvato')}>Approva</button>}{p.status !== 'rifiutato' && <button className="btn-ghost btn-sm ml-1" onClick={() => act(() => api.patch('/admin/prices', { company_id: c.id, pkg: p.pkg, level: p.level, status: 'rifiutato' }), 'Rifiutato')}>Rifiuta</button>}</td></tr>; })}</tbody></table>}
          </div>
          <div className="card p-5"><div className="font-bold mb-2">Opportunità e contratti</div>
            {!data.offers.length ? <p className="text-sm text-ink-soft">Nessuna.</p> : <ul className="text-sm divide-y divide-line">{data.offers.map((o) => <li key={o.id} className="py-1.5 flex justify-between gap-2"><Link to={`/admin/richieste/${o.request_id}`} className="hover:text-brand">{o.code} · {o.title}</Link><span>{o.amount ? eur(o.amount) : ''} <Badge>{o.status}</Badge></span></li>)}</ul>}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5"><div className="font-bold mb-2">Rating</div><RatingBox rating={data.rating} /></div>
          <div className="card p-5"><div className="flex justify-between items-center mb-2"><div className="font-bold">Documenti</div><button className="btn-soft btn-sm" onClick={() => { setF({ kind: 'visura' }); setModal('doc'); }}>Registra verifica</button></div>
            {!data.docs.length ? <p className="text-sm text-ink-soft">Nessun documento.</p> : data.docs.map((d) => (
              <div key={d.id} className="py-2 border-b border-line last:border-0 text-sm">
                <div className="flex justify-between"><span className="font-semibold">{DOC_LABEL[d.kind]}</span><Badge tone={d.status === 'verificato' ? 'green' : d.status === 'rifiutato' ? 'red' : 'amber'}>{d.status}</Badge></div>
                <div className="text-xs text-ink-mute">{d.valid_until ? `scade ${dt(d.valid_until)}` : 'senza scadenza'}{d.note ? ` · ${d.note}` : ''}</div>
                <div className="flex gap-1.5 mt-1">{d.file_id && <a className="btn-ghost btn-sm" href={`/api/files/${d.file_id}`} target="_blank" rel="noreferrer">Apri</a>}{d.status !== 'verificato' && <button className="btn-soft btn-sm" onClick={() => act(() => api.patch('/admin/docs/' + d.id, { status: 'verificato' }), 'Verificato')}>Verifica</button>}{d.status !== 'rifiutato' && <button className="btn-ghost btn-sm" onClick={() => act(() => api.patch('/admin/docs/' + d.id, { status: 'rifiutato', note: prompt('Motivo?') || '' }), 'Rifiutato')}>Rifiuta</button>}</div>
              </div>
            ))}
          </div>
          <div className="card p-5"><div className="flex justify-between items-center mb-2"><div className="font-bold">Accessi</div><button className="btn-soft btn-sm" onClick={() => { setF({}); setModal('user'); }}>Crea accesso</button></div>
            {!data.users.length ? <p className="text-sm text-ink-soft">Nessun utente collegato.</p> : data.users.map((u) => <div key={u.id} className="text-sm py-1">{u.email} <span className="text-xs text-ink-mute">· ultimo accesso {dtt(u.last_login_at)}</span></div>)}
            {data.claims.length > 0 && <div className="mt-3 pt-3 border-t border-line"><div className="text-xs font-semibold mb-1">Rivendicazioni</div>{data.claims.map((cl) => <div key={cl.id} className="text-xs py-0.5">{cl.email} · {cl.status}{cl.code_plain && cl.status === 'in_attesa' ? <> · codice <b className="font-mono">{cl.code_plain}</b> (comunicalo all'impresa)</> : ''}</div>)}</div>}
          </div>
        </div>
      </div>
      <Modal open={modal === 'doc'} onClose={() => setModal(null)} title="Registra un documento verificato">
        <div className="space-y-3">
          <Field label="Documento"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(DOC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Valido fino al"><input className="input" type="date" value={f.valid_until || ''} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Field>
          <Field label="Nota (es. protocollo, fonte della verifica)"><input className="input" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={() => act(() => api.post(`/admin/companies/${id}/docs`, f), 'Registrato').then(() => setModal(null))}>Registra</button>
        </div>
      </Modal>
      <Modal open={modal === 'user'} onClose={() => setModal(null)} title="Crea l'accesso per l'impresa">
        <div className="space-y-3">
          <Field label="Email"><input className="input" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Nome"><input className="input" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Password provvisoria" hint="Comunicala all'impresa: potrà cambiarla dal profilo."><input className="input" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={() => act(() => api.post(`/admin/companies/${id}/user`, f), 'Accesso creato').then(() => setModal(null))}>Crea</button>
        </div>
      </Modal>
    </>
  );
}

export function AdminPrices() {
  const { boot } = useApp();
  const toast = useToast();
  const pend = useLoad('/admin/prices/pending');
  const over = useLoad('/admin/prices/overview');
  const pkgName = (code) => boot?.catalog?.packages.find((p) => p.code === code)?.name || code;
  const act = async (b) => { try { await api.patch('/admin/prices', b); toast('Aggiornato'); pend.reload(); over.reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <PageTitle title="Prezzi delle imprese" sub="Le imprese prezzano la parte fissa dei pacchetti. Sotto −25% sul riferimento il prezzo è anomalo e non entra nelle offerte finché non lo approvi." />
      <div className="card p-5 mb-4"><div className="font-bold mb-2">Da controllare</div>
        {pend.loading ? <Spinner /> : !pend.data.length ? <p className="text-sm text-ink-soft">Niente da controllare.</p> : (
          <table className="w-full text-sm"><tbody className="divide-y divide-line">{pend.data.map((p) => <tr key={p.company_id + p.pkg + p.level}><td className="py-2"><Link to={`/admin/imprese/${p.company_id}`} className="font-semibold hover:text-brand">{p.company_name}</Link><div className="text-xs text-ink-mute">{pkgName(p.pkg)} · {['Standard', 'Intermedio', 'Premium'][p.level]}</div></td><td className="py-2 text-right">{eur(p.price)} <span className="text-xs text-bad">({num((p.price / p.ref_price - 1) * 100)}%)</span></td><td className="py-2 text-right"><button className="btn-soft btn-sm" onClick={() => act({ ...p, status: 'approvato' })}>Approva</button><button className="btn-ghost btn-sm ml-1" onClick={() => act({ ...p, status: 'rifiutato' })}>Rifiuta</button></td></tr>)}</tbody></table>
        )}
      </div>
      <div className="card overflow-x-auto"><div className="p-4 font-bold">Prezzi reali della rete vs listino EdilMen</div>
        {over.loading ? <Spinner /> : !over.data.length ? <Empty title="Ancora nessun prezzo approvato" /> : (
          <table className="w-full min-w-[640px]"><thead className="bg-paper"><tr><th className="th">Pacchetto</th><th className="th">Livello</th><th className="th text-right">Imprese</th><th className="th text-right">Min</th><th className="th text-right">Media</th><th className="th text-right">Max</th><th className="th text-right">Rif. EdilMen</th><th className="th text-right">Media vs rif.</th></tr></thead>
            <tbody className="divide-y divide-line">{over.data.map((p) => <tr key={p.pkg + p.level}><td className="td">{pkgName(p.pkg)}</td><td className="td">{['Std', 'Int', 'Prem'][p.level]}</td><td className="td text-right">{p.n}</td><td className="td text-right">{eur(p.min)}</td><td className="td text-right font-semibold">{eur(p.avg)}</td><td className="td text-right">{eur(p.max)}</td><td className="td text-right text-ink-soft">{eur(p.ref)}</td><td className="td text-right">{p.ref ? `${num((p.avg / p.ref - 1) * 100, 1)}%` : ''}</td></tr>)}</tbody></table>
        )}
        <p className="text-xs text-ink-mute p-4">Questi dati servono a tarare il listino EdilMen (leva «maggiorazione commessa privata» e coefficienti di zona).</p>
      </div>
    </>
  );
}

export function AdminClaims() {
  const toast = useToast();
  const { data, loading, reload } = useLoad('/admin/claims');
  if (loading) return <Spinner />;
  const act = async (id, status) => { try { await api.patch('/admin/claims/' + id, { status }); toast('Aggiornato'); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <PageTitle title="Rivendicazioni delle schede" sub="Se l'email è sul dominio del sito dell'impresa la scheda si conferma da sola. Le altre le controlli qui. Finché l'invio email non è attivo, il codice di conferma è visibile qui: comunicalo all'impresa dopo averla riconosciuta." />
      {!data.length ? <div className="card"><Empty title="Nessuna rivendicazione in attesa" /></div> : (
        <div className="card divide-y divide-line">{data.map((c) => (
          <div key={c.id} className="p-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1 min-w-[220px]"><Link to={`/admin/imprese/${c.company_id}`} className="font-semibold hover:text-brand">{c.company_name}</Link><div className="text-xs text-ink-mute">{c.email} · sito {c.website || '—'} · {dtt(c.created_at)}</div></div>
            {c.status === 'in_attesa' && c.code_plain && <span className="font-mono bg-paper rounded px-2 py-1">codice {c.code_plain}</span>}
            <Badge tone={c.status === 'da_approvare' ? 'amber' : 'gray'}>{c.status === 'da_approvare' ? 'confermato, da approvare' : 'in attesa del codice'}</Badge>
            {c.status === 'da_approvare' && <><button className="btn-primary btn-sm" onClick={() => act(c.id, 'approvato')}>Approva</button><button className="btn-ghost btn-sm" onClick={() => act(c.id, 'rifiutato')}>Rifiuta</button></>}
          </div>
        ))}</div>
      )}
    </>
  );
}
