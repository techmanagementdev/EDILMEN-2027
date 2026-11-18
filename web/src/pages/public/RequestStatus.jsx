import React, { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useLoad, Spinner, ErrorBox, eur, num, RatingBox, DocsBadges, Choice, Field, useToast, useApp, dt } from '../../ui.jsx';
import { api } from '../../api.js';
import { QuoteBreakdown } from './Wizard.jsx';

export function OffersList({ offers, pendingInvites, refPrice, onChoose, chosenId }) {
  if (!offers.length) {
    return (
      <div className="card p-6">
        <div className="font-bold text-lg">Le offerte delle imprese stanno arrivando</div>
        <p className="text-sm text-ink-soft mt-1">
          {pendingInvites > 0 ? `Abbiamo invitato ${pendingInvites} impres${pendingInvites > 1 ? 'e' : 'a'} verificat${pendingInvites > 1 ? 'e' : 'a'} della tua zona a quotare. Di solito rispondono entro 48 ore.` : 'In questa zona la rete EdilMen sta crescendo: un referente EdilMen ti contatta e invita le imprese verificate più vicine.'}
          {' '}Nel frattempo il riferimento è il prezzo prudente EdilMen{refPrice ? `: ${eur(refPrice)} IVA esclusa` : ''}.
        </p>
        <p className="text-xs text-ink-mute mt-3">Non mostriamo mai offerte inventate: quando ci sono, le vedi qui.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {offers.map((o) => {
        const diff = refPrice ? o.amount / refPrice - 1 : null;
        return (
          <div key={o.id} className={`card p-5 ${chosenId === o.id ? 'ring-2 ring-brand' : ''}`}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-navy text-white flex items-center justify-center text-xl font-extrabold">{o.letter}</div>
              <div className="flex-1 min-w-[220px]">
                <div className="font-bold">{o.company?.name || `Impresa ${o.letter}`} <span className="text-ink-mute font-normal text-sm">· {o.company?.comune || ''} {o.company?.provincia ? `(${o.company.provincia})` : ''}</span></div>
                <div className="text-xs text-ink-soft mt-0.5">{o.source === 'listino' ? 'Prezzo dal listino dell\'impresa, sulle stesse voci del pacchetto EdilMen' : 'Offerta inviata dall\'impresa per la tua richiesta'}{o.start_days ? ` · inizio lavori entro ${o.start_days} giorni` : ''}</div>
                <div className="mt-2"><RatingBox rating={o.rating} compact /></div>
                <div className="mt-2"><DocsBadges docs={o.rating?.docs} /></div>
                {o.note && <p className="text-sm text-ink-soft mt-2">«{o.note}»</p>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold">{eur(o.amount)}</div>
                <div className="text-xs text-ink-mute">IVA esclusa · prezzo prudente</div>
                {diff != null && <div className={`text-xs font-semibold mt-1 ${diff <= 0 ? 'text-ok' : 'text-warn'}`}>{diff <= 0 ? '' : '+'}{num(diff * 100, 1)}% sul riferimento EdilMen</div>}
                {onChoose && <button className="btn-primary btn-sm mt-3" onClick={() => onChoose(o)}>Prenota il sopralluogo</button>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AppointmentForm({ offer, onSubmit, onCancel }) {
  const [mode, setMode] = useState('sopralluogo');
  const [slot, setSlot] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="card p-5 mt-4">
      <div className="font-bold text-lg">{offer ? `Sopralluogo con l'impresa ${offer.letter}` : 'Parla con un referente EdilMen'}</div>
      <div className="grid sm:grid-cols-3 gap-2 mt-3">
        <Choice title="Sopralluogo" sub="Gratuito, sul posto" active={mode === 'sopralluogo'} onClick={() => setMode('sopralluogo')} />
        <Choice title="Videochiamata" sub="30 minuti" active={mode === 'video'} onClick={() => setMode('video')} />
        <Choice title="Telefonata" sub="Ti chiamiamo noi" active={mode === 'chiamata'} onClick={() => setMode('chiamata')} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Field label="Quando preferisci?"><input className="input" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Es. martedì mattina, dopo le 17…" /></Field>
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Citofono, accesso, animali…" /></Field>
      </div>
      <p className="text-xs text-ink-mute mt-2">Giorno e ora li confermiamo insieme. Puoi spostare o disdire quando vuoi, senza costi.</p>
      <div className="flex gap-2 mt-4"><button className="btn-primary" onClick={() => onSubmit({ offerId: offer?.id || null, mode, slot, note })}>Conferma</button>{onCancel && <button className="btn-ghost" onClick={onCancel}>Annulla</button>}</div>
    </div>
  );
}

export default function RequestStatus() {
  const { token } = useParams();
  const { state } = useLocation();
  const { boot, user } = useApp();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad('/public/requests/' + token);
  const [choosing, setChoosing] = useState(undefined);
  if (loading) return <Spinner />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-12"><ErrorBox>{error}</ErrorBox></div>;
  const r = data.request;
  const submit = async (b) => {
    try { await api.post(`/public/requests/${token}/choose`, b); toast('Richiesta di appuntamento inviata'); setChoosing(undefined); reload(); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {state?.fresh && (
        <div className="rounded-2xl bg-ok-soft p-5 mb-6">
          <div className="font-bold text-ok text-lg">Richiesta {r.code} ricevuta ✓</div>
          <p className="text-sm mt-1">Salva questa pagina tra i preferiti: qui trovi le offerte appena arrivano. {!user && <>Oppure <Link className="text-brand font-semibold underline" to={`/registrati?r=${token}`}>crea un account</Link> per ritrovarle sempre.</>}</p>
        </div>
      )}
      <div className="text-xs text-ink-mute">Richiesta {r.code} · {dt(r.created_at)}</div>
      <h1 className="text-3xl font-extrabold mt-1">{r.title}</h1>
      <p className="text-ink-soft">{r.comune ? `${r.comune} (${r.provincia})` : 'Zona da definire'}{r.appointment ? ` · appuntamento richiesto (${r.appointment.mode}${r.appointment.slot ? ', ' + r.appointment.slot : ''})` : ''}</p>

      <h2 className="text-xl font-extrabold mt-8 mb-3">Offerte delle imprese</h2>
      <OffersList offers={data.offers} pendingInvites={data.pendingInvites} refPrice={r.quote?.prudent?.imponibile} onChoose={(o) => setChoosing(o)} />
      {choosing !== undefined ? <AppointmentForm offer={choosing} onSubmit={submit} onCancel={() => setChoosing(undefined)} /> : !r.appointment && <button className="btn-ghost mt-4" onClick={() => setChoosing(null)}>Preferisco parlare prima con un referente EdilMen</button>}

      {r.quote && (
        <>
          <h2 className="text-xl font-extrabold mt-10 mb-3">Il prezzo di riferimento EdilMen</h2>
          <QuoteBreakdown quote={r.quote} catalog={boot?.catalog} />
        </>
      )}
    </div>
  );
}
