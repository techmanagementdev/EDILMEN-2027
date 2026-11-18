import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLoad, Spinner, ErrorBox, Badge, RatingBox, DocsBadges, eur, dt, useToast, Empty } from '../../ui.jsx';
import { api } from '../../api.js';
import { useApp } from '../../ui.jsx';

const REG = ['Trentino-Alto Adige', 'Veneto', 'Friuli-Venezia Giulia', 'Lombardia', 'Emilia-Romagna'];

export function Directory() {
  const [sp, setSp] = useSearchParams();
  const [qText, setQ] = useState(sp.get('q') || '');
  const qs = new URLSearchParams();
  for (const k of ['regione', 'q', 'page']) if (sp.get(k)) qs.set(k, sp.get(k));
  const { data, loading } = useLoad('/public/companies?' + qs.toString(), [sp.toString()]);
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); n.delete('page'); setSp(n); };
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="eyebrow">Elenco imprese</div>
      <h1 className="text-3xl sm:text-4xl font-extrabold mt-2">Le imprese edili, con i fatti in chiaro</h1>
      <p className="text-ink-soft mt-2 max-w-3xl">Prima le imprese della rete EdilMen, poi tutte le altre. Ogni scheda dice da dove vengono i dati, quali documenti abbiamo verificato e cosa manca al rating.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', qText); }} className="flex gap-2"><input className="input w-64" value={qText} onChange={(e) => setQ(e.target.value)} placeholder="Nome o comune" /><button className="btn-dark">Cerca</button></form>
        <select className="input w-auto" value={sp.get('regione') || ''} onChange={(e) => setParam('regione', e.target.value)}>
          <option value="">Tutte le regioni</option>{REG.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      {loading ? <Spinner /> : !data.items.length ? <Empty title="Nessuna impresa con questi filtri">L'elenco cresce ogni settimana. Sei un'impresa? <Link to="/iscrizione-impresa" className="text-brand font-semibold">Iscriviti gratis</Link>.</Empty> : (
        <>
          <div className="text-sm text-ink-soft mt-6">{data.total} imprese</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {data.items.map((c) => (
              <Link key={c.id} to={`/imprese/${c.slug}`} className="card p-5 hover:shadow-lift transition">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-paper border border-line flex items-center justify-center font-bold text-ink-soft">{c.name.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{c.name}</div>
                    <div className="text-xs text-ink-soft">{c.comune ? `${c.comune} (${c.provincia})` : c.regione}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.network ? <Badge tone="blue">Rete EdilMen</Badge> : c.claimed_at ? <Badge tone="green">Scheda confermata</Badge> : <Badge>Dati da registri pubblici</Badge>}
                  {(c.categories || []).slice(0, 2).map((x) => <Badge key={x}>{x}</Badge>)}
                </div>
                {c.rating && <div className="mt-3"><RatingBox rating={c.rating} compact /></div>}
              </Link>
            ))}
          </div>
          <div className="flex gap-2 justify-center mt-8">
            {Number(sp.get('page') || 1) > 1 && <button className="btn-ghost" onClick={() => { const n = new URLSearchParams(sp); n.set('page', Number(sp.get('page')) - 1); setSp(n); }}>← Precedenti</button>}
            {data.page * data.pageSize < data.total && <button className="btn-ghost" onClick={() => { const n = new URLSearchParams(sp); n.set('page', (Number(sp.get('page')) || 1) + 1); setSp(n); }}>Successive →</button>}
          </div>
        </>
      )}
    </div>
  );
}

export function CompanyPage() {
  const { slug } = useParams();
  const { boot } = useApp();
  const toast = useToast();
  const { data, loading, error } = useLoad('/public/companies/' + slug);
  const [rep, setRep] = useState({ open: false, text: '', email: '' });
  if (loading) return <Spinner />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-12"><ErrorBox>{error}</ErrorBox></div>;
  const c = data.company;
  const pkgName = (code) => boot?.catalog?.packages.find((p) => p.code === code)?.name || code;
  const send = async () => {
    try { await api.post(`/public/companies/${slug}/report`, { text: rep.text, email: rep.email }); toast('Grazie: controlliamo e correggiamo'); setRep({ open: false, text: '', email: '' }); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link to="/imprese" className="text-sm text-ink-soft">← Elenco imprese</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mt-3">
        <div>
          <h1 className="text-3xl font-extrabold">{c.name}</h1>
          <div className="text-ink-soft">{[c.comune && `${c.comune} (${c.provincia})`, c.regione].filter(Boolean).join(' · ')}</div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {c.network ? <Badge tone="blue">Impresa della rete EdilMen</Badge> : c.claimed ? <Badge tone="green">Scheda confermata dall'impresa</Badge> : <Badge>Profilo non ancora confermato dall'impresa</Badge>}
            {c.categories.map((x) => <Badge key={x}>{x}</Badge>)}
          </div>
        </div>
        <Link to="/quota" className="btn-primary">Calcola il prezzo del tuo lavoro</Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-8">
        <div className="lg:col-span-2 space-y-4">
          {c.description && <div className="card p-5"><div className="font-bold mb-2">Chi è</div><p className="text-sm text-ink-soft whitespace-pre-line">{c.description}</p></div>}
          <div className="card p-5">
            <div className="font-bold mb-3">Rating EdilMen</div>
            <RatingBox rating={data.rating} />
            {data.rating.published && data.rating.dims && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-center text-xs">
                {Object.entries({ qualita: 'Qualità', puntualita: 'Puntualità', preventivo: 'Rispetto del preventivo', pulizia: 'Pulizia', comunicazione: 'Comunicazione' }).map(([k, l]) => <div key={k} className="rounded-xl bg-paper p-2"><div className="font-extrabold text-base">{data.rating.dims[k] ?? '—'}</div>{l}</div>)}
              </div>
            )}
            <Link to="/rating" className="text-xs text-brand font-semibold mt-3 inline-block">Come calcoliamo il rating</Link>
          </div>
          {data.reviews.length > 0 && (
            <div className="card p-5"><div className="font-bold mb-3">Recensioni di lavori verificati</div>
              <div className="space-y-3">{data.reviews.map((r, i) => <div key={i} className="border-b border-line pb-3 last:border-0"><div className="text-amber-500">{'★'.repeat(Math.round(Object.values(r.scores).reduce((a, b) => a + b, 0) / 5))}</div><p className="text-sm">{r.text}</p><div className="text-xs text-ink-mute">{dt(r.created_at)}</div></div>)}</div>
            </div>
          )}
          {data.prices.length > 0 && (
            <div className="card p-5"><div className="font-bold mb-3">Prezzi dell'impresa sui pacchetti EdilMen</div>
              <table className="w-full text-sm"><tbody className="divide-y divide-line">{data.prices.map((p) => <tr key={p.pkg + p.level}><td className="py-2">{pkgName(p.pkg)}</td><td className="py-2 text-ink-soft">{['Standard', 'Intermedio', 'Premium'][p.level]}</td><td className="py-2 text-right font-semibold">{eur(p.price)}</td></tr>)}</tbody></table>
              <p className="text-xs text-ink-mute mt-2">Parte fissa per unità, IVA esclusa, posa inclusa.</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5"><div className="font-bold mb-3">Documenti verificati da EdilMen</div><DocsBadges docs={data.rating.docs} /><p className="text-xs text-ink-mute mt-3">Un documento scaduto sparisce finché non viene rinnovato.</p></div>
          <div className="card p-5 text-sm space-y-2">
            <div className="font-bold">Dati dell'impresa</div>
            {c.years_active && <div>Attiva da {c.years_active} anni</div>}
            {c.employees && <div>{c.employees} addetti</div>}
            {c.provinces_served?.length > 0 && <div>Lavora in: {c.provinces_served.join(', ')}</div>}
            {(c.min_job || c.max_job) && <div>Lavori da {c.min_job ? eur(c.min_job) : '—'} a {c.max_job ? eur(c.max_job) : '—'}</div>}
            {c.certs_declared?.length > 0 && <div>Certificazioni dichiarate: {c.certs_declared.join(', ')}</div>}
            <div className="text-xs text-ink-mute pt-2 border-t border-line">Fonte: {c.source || 'EdilMen'}{c.checked_at ? ` · aggiornato il ${dt(c.checked_at)}` : ''}. I contatti diretti non sono pubblicati: per un lavoro passa da EdilMen.</div>
          </div>
          {!c.claimed && <Link to="/rivendica" className="btn-ghost w-full">Sei questa impresa? Rivendica la scheda</Link>}
          <button className="btn-ghost w-full" onClick={() => setRep({ ...rep, open: !rep.open })}>Segnala un errore</button>
          {rep.open && (
            <div className="card p-4 space-y-2">
              <textarea className="input" rows={3} value={rep.text} onChange={(e) => setRep({ ...rep, text: e.target.value })} placeholder="Cosa è sbagliato?" />
              <input className="input" value={rep.email} onChange={(e) => setRep({ ...rep, email: e.target.value })} placeholder="La tua email (facoltativa)" />
              <button className="btn-dark w-full" onClick={send}>Invia la segnalazione</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
