import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad, useApp, Spinner, Empty, PageTitle, Badge, Tabs, Stat, eur, num, dt, dtt, useToast, Field, Modal } from '../../ui.jsx';
import { api } from '../../api.js';

export function AdminSubscriptions() {
  const toast = useToast();
  const { boot } = useApp();
  const { data, loading, reload } = useLoad('/admin/subscriptions');
  const [pay, setPay] = useState(null);
  if (loading) return <Spinner />;
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <PageTitle title="Abbonamenti" sub="Prove gratuite, richieste di piano, pagamenti e ricavi ricorrenti delle imprese. I pagamenti con bonifico si registrano qui." />
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Ricavo ricorrente mensile" value={eur(data.mrr)} sub={`${eur(data.mrr * 12)} l'anno`} tone="brand" />
        <Stat label="Imprese paganti" value={data.counts.paganti} />
        <Stat label="In prova" value={data.counts.prova} />
        <Stat label="Richieste da attivare" value={data.counts.richieste} sub={`${data.counts.scaduti} scaduti`} />
      </div>
      {!data.rows.length ? <div className="card"><Empty title="Ancora nessun abbonamento">Le imprese che si iscrivono o rivendicano la scheda partono con 30 giorni di prova Plus.</Empty></div> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="bg-paper"><tr><th className="th">Impresa</th><th className="th">Piano effettivo</th><th className="th">Stato</th><th className="th">Prova fino al</th><th className="th">Pagato fino al</th><th className="th text-center">Utenti</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">{data.rows.map((c) => (
            <tr key={c.id}>
              <td className="td"><Link to={`/admin/imprese/${c.id}`} className="font-semibold hover:text-brand">{c.name}</Link><div className="text-xs text-ink-mute">{c.comune || ''}{c.network ? ' · rete' : ''}</div></td>
              <td className="td"><Badge tone={c.effective.id === 'plus' ? 'blue' : c.effective.id === 'base' ? 'green' : 'gray'}>{c.effective.name}</Badge> <span className="text-xs text-ink-mute">{c.effective.source}</span></td>
              <td className="td text-sm">{c.subscription_status === 'richiesto' ? <Badge tone="amber">chiede {c.plan}</Badge> : c.subscription_status}</td>
              <td className="td text-sm">{dt(c.trial_until)}</td>
              <td className="td text-sm">{dt(c.plan_until)}</td>
              <td className="td text-center text-sm">{c.utenti}</td>
              <td className="td whitespace-nowrap text-right">
                <button className="btn-primary btn-sm" onClick={() => setPay({ id: c.id, name: c.name, plan: c.plan !== 'free' ? c.plan : 'plus', months: 12, method: 'bonifico' })}>Registra pagamento</button>
                <button className="btn-ghost btn-sm ml-1" onClick={() => act(() => api.patch(`/admin/subscriptions/${c.id}`, { action: 'prova', days: 30 }), 'Prova estesa di 30 giorni')}>+30 gg prova</button>
                {c.subscription_status === 'attivo' && <button className="btn-danger btn-sm ml-1" onClick={() => { if (confirm('Annullare l\'abbonamento?')) act(() => api.patch(`/admin/subscriptions/${c.id}`, { action: 'annulla' }), 'Annullato'); }}>Annulla</button>}
              </td>
            </tr>
          ))}</tbody></table></div>
      )}
      <div className="card p-5 mt-6"><div className="font-bold mb-2">Ultimi pagamenti</div>{!data.payments.length ? <p className="text-sm text-ink-soft">Nessun pagamento registrato.</p> : <table className="w-full text-sm"><tbody className="divide-y divide-line">{data.payments.map((p) => <tr key={p.id}><td className="py-1.5">{dt(p.created_at)}</td><td>{p.company_name}</td><td>{p.plan} · {p.months} mesi · {p.method}</td><td>{dt(p.period_start)} → {dt(p.period_end)}</td><td className="text-right font-semibold">{eur(p.amount)}</td></tr>)}</tbody></table>}</div>
      <Modal open={!!pay} onClose={() => setPay(null)} title={pay ? `Pagamento di ${pay.name}` : ''}>
        {pay && <div className="grid gap-3">
          <Field label="Piano"><select className="input" value={pay.plan} onChange={(e) => setPay({ ...pay, plan: e.target.value })}>{(boot?.plans || []).filter((p) => p.price > 0).map((p) => <option key={p.id} value={p.id}>{p.name} · {eur(p.price)}/mese</option>)}</select></Field>
          <Field label="Mesi pagati"><input className="input" type="number" value={pay.months} onChange={(e) => setPay({ ...pay, months: e.target.value })} /></Field>
          <Field label="Importo (€)" hint="Vuoto = prezzo del piano × mesi"><input className="input" type="number" value={pay.amount || ''} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label="Metodo"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="bonifico">Bonifico</option><option value="carta">Carta</option><option value="compensazione">Compensazione con fee</option><option value="omaggio">Omaggio / promozione</option></select></Field>
          <Field label="Nota"><input className="input" value={pay.note || ''} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
          <button className="btn-primary" onClick={() => act(() => api.post(`/admin/subscriptions/${pay.id}/payment`, pay), 'Pagamento registrato, piano attivo').then(() => setPay(null))}>Registra e attiva</button>
        </div>}
      </Modal>
    </>
  );
}

export function AdminCommunity() {
  const toast = useToast();
  const { boot } = useApp();
  const [st, setSt] = useState('da_controllare');
  const { data, loading, reload } = useLoad('/admin/community-prices?status=' + st, [st]);
  const pkg = (c) => boot?.catalog?.packages.find((p) => p.code === c);
  const act = async (id, status) => { try { await api.patch('/admin/community-prices/' + id, { status }); toast('Aggiornata'); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <>
      <PageTitle title="Prezzi dalla community" sub="Quotazioni reali caricate dalle persone. Approvate entrano nelle medie pubbliche (da 3 in su), mai come singola riga. Controlla che importo e quantità siano coerenti con il pacchetto." />
      <Tabs value={st} onChange={setSt} items={[['da_controllare', 'Da controllare'], ['approvata', 'Approvate'], ['rifiutata', 'Rifiutate'], ['tutte', 'Tutte']]} />
      {loading ? <Spinner /> : !data.length ? <div className="card mt-4"><Empty title="Niente in questo filtro" /></div> : (
        <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[820px]"><thead className="bg-paper"><tr><th className="th">Lavoro</th><th className="th text-right">Importo</th><th className="th text-right">Unitario</th><th className="th text-right">Listino Int.</th><th className="th">Dove e quando</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">{data.map((r) => { const p = pkg(r.pkg); const u = r.amount / (r.qty || 1); const ref = p ? p.prices[1] * (1 + p.acc) : null; return (
            <tr key={r.id}><td className="td"><div className="font-semibold">{p?.name || r.pkg}</div>{r.description && <div className="text-xs text-ink-soft max-w-sm">{r.description}</div>}</td><td className="td text-right">{eur(r.amount)}</td><td className="td text-right">{eur(u)} / {p?.unit}<div className={`text-[11px] ${ref && Math.abs(u / ref - 1) > 0.5 ? 'text-bad' : 'text-ink-mute'}`}>{ref ? `${num((u / ref - 1) * 100)}% sul listino` : ''}</div></td><td className="td text-right text-ink-soft">{ref ? eur(ref) : '—'}</td><td className="td text-sm">{r.comune || '—'} · {r.year}<div className="text-xs text-ink-mute">{dtt(r.created_at)}</div>{r.file_id && <a className="text-xs text-brand" href={`/api/files/${r.file_id}`} target="_blank" rel="noreferrer">Apri il file</a>}</td>
              <td className="td whitespace-nowrap">{r.status !== 'approvata' && <button className="btn-primary btn-sm" onClick={() => act(r.id, 'approvata')}>Approva</button>}{r.status !== 'rifiutata' && <button className="btn-ghost btn-sm ml-1" onClick={() => act(r.id, 'rifiutata')}>Rifiuta</button>}</td></tr>
          ); })}</tbody></table></div>
      )}
    </>
  );
}
