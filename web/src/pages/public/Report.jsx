import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLoad, Spinner, ErrorBox, eur, dt, num, Logo, useApp } from '../../ui.jsx';
import { QuoteBreakdown } from './Wizard.jsx';

export default function Report() {
  const { token } = useParams();
  const { boot } = useApp();
  const { data, loading, error } = useLoad('/public/report/' + token);
  if (loading) return <Spinner />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-12"><ErrorBox>{error}</ErrorBox></div>;
  const q = data.quote;
  const p = data.property;
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-white min-h-screen">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div><div className="text-xs text-ink-mute">Stima dei lavori preparata da</div><div className="text-xl font-extrabold">{data.agency.name}</div><div className="text-sm text-ink-soft">{[data.agency.phone, data.agency.email].filter(Boolean).join(' · ')}</div></div>
        <div className="text-right"><Logo /><div className="text-xs text-ink-mute mt-1">Prezzi a pacchetti EdilMen</div></div>
      </div>
      <h1 className="text-3xl font-extrabold mt-6">{p.title || data.title}</h1>
      <p className="text-ink-soft">{[p.address, data.comune && `${data.comune} (${data.provincia})`, p.mq && `${num(p.mq)} m²`].filter(Boolean).join(' · ')} · stima del {dt(data.created_at)} · {data.code}</p>
      {q && (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-ok-soft p-4"><div className="text-xs font-bold text-ok">Lavori · minimo</div><div className="text-2xl font-extrabold">{eur(q.fixed.imponibile)}</div></div>
            <div className="rounded-2xl bg-navy text-white p-4"><div className="text-xs font-bold text-[#d2a9ac]">Lavori · prezzo prudente</div><div className="text-2xl font-extrabold">{eur(q.prudent.imponibile)}</div></div>
            {p.price_ask ? <div className="rounded-2xl bg-paper border border-line p-4"><div className="text-xs font-bold text-ink-soft">Prezzo richiesto + lavori</div><div className="text-2xl font-extrabold">{eur(Number(p.price_ask) + q.prudent.totale)}</div><div className="text-[11px] text-ink-mute">lavori IVA inclusa</div></div> : null}
          </div>
          <div className="mt-6"><QuoteBreakdown quote={q} catalog={boot?.catalog} compact /></div>
        </>
      )}
      {data.offers?.length > 0 && <p className="text-sm mt-4"><b>{data.offers.length} offerte reali</b> di imprese della rete EdilMen per questi lavori, da {eur(data.offers[0].amount)} IVA esclusa.</p>}
      <div className="text-xs text-ink-mute mt-8 border-t border-line pt-4">
        Prezzi IVA esclusa, livello {q?.levelName?.toLowerCase()}, calcolati con il listino a pacchetti EdilMen ({q?.territory?.label}). Il prezzo prudente comprende gli imprevisti tipici e al sopralluogo può solo scendere. Non è un'offerta vincolante di un'impresa.
      </div>
      <div className="flex gap-2 mt-6 no-print"><button className="btn-dark" onClick={() => window.print()}>Stampa o salva in PDF</button><Link to="/quota" className="btn-ghost">Calcola un altro lavoro</Link></div>
    </div>
  );
}
