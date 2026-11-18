import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLoad, useApp, Spinner, ErrorBox, eur, num, dt, Logo, useToast, Field } from '../../ui.jsx';
import { api } from '../../api.js';

// Preventivo dell'impresa, aperto dal cliente con il link: stampabile e accettabile online.
export function PreventivoPage() {
  const { token } = useParams();
  const toast = useToast();
  const { data: x, loading, error, reload } = useLoad('/public/preventivo/' + token);
  const [note, setNote] = useState('');
  if (loading) return <Spinner />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-12"><ErrorBox>{error}</ErrorBox></div>;
  const items = x.items || [];
  const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
  const net = sub * (1 - Number(x.discount || 0));
  const answer = async (accept) => { try { await api.post(`/public/preventivo/${token}/answer`, { accept, note }); toast(accept ? 'Preventivo accettato: l\'impresa ti contatta per il contratto' : 'Risposta inviata'); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="min-h-screen bg-paper py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white card p-8">
        <div className="flex flex-wrap justify-between gap-4 border-b border-line pb-5">
          <div><div className="text-2xl font-extrabold">{x.company_name}</div><div className="text-sm text-ink-soft">{[x.company_address, x.company_comune && `${x.company_comune} (${x.company_provincia})`].filter(Boolean).join(', ')}</div><div className="text-sm text-ink-soft">{[x.company_vat && `P.IVA ${x.company_vat}`, x.company_phone, x.company_email].filter(Boolean).join(' · ')}</div></div>
          <div className="text-right"><div className="text-xs text-ink-mute uppercase font-semibold">Preventivo</div><div className="text-2xl font-extrabold">n. {x.number}</div><div className="text-sm text-ink-soft">{dt(x.sent_at || x.created_at)}{x.valid_until ? ` · valido fino al ${dt(x.valid_until)}` : ''}</div></div>
        </div>
        {x.client_name && <div className="mt-5 text-sm"><span className="text-ink-mute">Spett.le</span> <b>{x.client_name}</b>{x.client_address ? ` · ${x.client_address}` : ''}{x.client_comune ? `, ${x.client_comune}` : ''}</div>}
        <h1 className="text-2xl font-extrabold mt-4">{x.title}</h1>
        <table className="w-full mt-5 text-sm"><thead className="bg-paper"><tr><th className="th">Descrizione</th><th className="th">U.M.</th><th className="th text-right">Q.tà</th><th className="th text-right">Prezzo</th><th className="th text-right">Importo</th></tr></thead>
          <tbody className="divide-y divide-line">{items.map((i, k) => <tr key={k}><td className="td whitespace-pre-line">{i.desc}</td><td className="td">{i.unit}</td><td className="td text-right">{num(i.qty, 2)}</td><td className="td text-right whitespace-nowrap">{eur(i.price, 2)}</td><td className="td text-right whitespace-nowrap font-semibold">{eur(i.qty * i.price, 2)}</td></tr>)}</tbody></table>
        <div className="flex justify-end mt-4"><div className="w-72 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotale</span><span>{eur(sub, 2)}</span></div>
          {Number(x.discount) > 0 && <div className="flex justify-between"><span>Sconto {num(x.discount * 100, 1)}%</span><span>−{eur(sub - net, 2)}</span></div>}
          <div className="flex justify-between font-bold text-base"><span>Totale IVA esclusa</span><span>{eur(net, 2)}</span></div>
          <div className="flex justify-between text-ink-soft"><span>IVA {num(x.vat_rate * 100)}%</span><span>{eur(net * x.vat_rate, 2)}</span></div>
          <div className="flex justify-between font-extrabold text-lg border-t border-line pt-1"><span>Totale</span><span>{eur(net * (1 + Number(x.vat_rate)), 2)}</span></div>
        </div></div>
        {x.notes && <div className="mt-6 text-sm whitespace-pre-line"><b>Note</b><br />{x.notes}</div>}
        {x.conditions && <div className="mt-4 text-sm whitespace-pre-line text-ink-soft"><b className="text-ink">Condizioni</b><br />{x.conditions}</div>}
        <div className="mt-8 no-print">
          {x.status === 'inviato' ? (
            <div className="rounded-2xl bg-brand-soft p-5">
              <div className="font-bold">La tua risposta</div>
              <Field label="Nota per l'impresa (facoltativa)" className="mt-2"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="flex gap-2 mt-3"><button className="btn-primary" onClick={() => answer(true)}>Accetto il preventivo</button><button className="btn-ghost" onClick={() => answer(false)}>Non mi interessa</button></div>
              <p className="text-xs text-ink-mute mt-2">L'accettazione online non sostituisce il contratto: l'impresa ti contatta per firmarlo.</p>
            </div>
          ) : <div className={`rounded-2xl p-4 font-semibold ${x.status === 'accettato' ? 'bg-ok-soft text-ok' : 'bg-paper text-ink-soft'}`}>Preventivo {x.status}{x.answered_at ? ` il ${dt(x.answered_at)}` : ''}.</div>}
          <div className="flex gap-2 mt-4"><button className="btn-dark" onClick={() => window.print()}>Stampa o salva in PDF</button></div>
        </div>
        <div className="mt-8 pt-4 border-t border-line flex items-center justify-between text-xs text-ink-mute"><span>Preventivo creato con il gestionale EdilMen{x.network ? ' · impresa della rete EdilMen' : ''}</span><Logo className="!text-sm" /></div>
      </div>
    </div>
  );
}

export function SoftwareLanding() {
  const { boot } = useApp();
  return (
    <div>
      <section className="hero-field bg-brand text-[#ecebea]"><div className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-lg text-[#d2a9ac]">Software per imprese edili e artigiani</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-3 leading-tight">Preventivi in 5 minuti. Cantieri sotto controllo. Lavori nuovi da EdilMen.</h1>
          <p className="text-white/75 text-lg mt-4">Il gestionale pensato per chi è in furgone, non in ufficio: clienti, preventivi dai pacchetti con i tuoi prezzi, accettazione online, diario di cantiere con foto, scadenze di DURC e incassi. Collegato alle richieste della rete EdilMen.</p>
          <div className="flex flex-wrap gap-3 mt-8"><Link to="/iscrizione-impresa" className="btn-primary btn-lg">Prova gratis 30 giorni</Link><Link to="/rivendica" className="btn bg-white/10 hover:bg-white/20 text-white btn-lg">Sei già nell'elenco? Rivendica</Link></div>
          <p className="text-xs text-white/50 mt-3">Nessuna carta richiesta. Alla fine della prova resti sul piano gratuito se non scegli un piano.</p>
        </div>
        <div className="bg-white text-ink rounded-3xl p-6 shadow-lift">
          <div className="text-xs font-semibold text-ink-mute uppercase">Preventivo n. 12 · Bagno via Roma 3</div>
          <div className="mt-3 space-y-2 text-sm">{[['Bagno chiavi in mano — intermedio', 8200], ['Spostamento colonna di scarico', 800], ['Porta interna', 580]].map(([d, v]) => <div key={d} className="flex justify-between border-b border-line pb-2"><span>{d}</span><b>{eur(v)}</b></div>)}</div>
          <div className="flex justify-between mt-3 font-extrabold text-lg"><span>Totale</span><span>{eur(9580)}</span></div>
          <div className="mt-4 rounded-xl bg-ok-soft text-ok text-sm font-semibold p-3">✓ Accettato online dal cliente · cantiere aperto</div>
        </div>
      </div></section>
      <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-3 gap-4">
        {[
          ['🧾', 'Preventivi dai pacchetti', 'Scegli il pacchetto EdilMen, metti il tuo prezzo, il cliente vede cosa è incluso ed escluso. Link da mandare su WhatsApp, PDF, accettazione online.'],
          ['👷', 'Diario di cantiere', 'Foto, ore e note dal telefono. Avanzamento in percentuale. Tutto pronto per i SAL e per le contestazioni che non arriveranno.'],
          ['⏰', 'Scadenze', 'Incassi, pagamenti, rinnovi di DURC e assicurazione: le scadenze dei documenti caricati entrano da sole.'],
          ['👥', 'Clienti', 'Dal primo contatto al cliente fidelizzato. I clienti EdilMen che ti scelgono entrano con un clic.'],
          ['📈', 'Statistiche della scheda', 'Quante persone guardano la tua scheda e quante volte compari nelle quotazioni, mese per mese.'],
          ['🤝', 'Lavori dalla rete', 'Il tuo listino lavora nel quotatore EdilMen: quando arriva una richiesta compatibile l\'offerta parte da sola.'],
        ].map(([ic, t, d]) => <div key={t} className="card p-6"><div className="text-3xl">{ic}</div><div className="font-bold mt-3">{t}</div><p className="text-sm text-ink-soft mt-2">{d}</p></div>)}
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <h2 className="text-3xl font-extrabold">Piani</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {(boot?.plans || []).map((p) => <div key={p.id} className={`card p-6 ${p.id === 'plus' ? 'ring-2 ring-brand' : ''}`}>{p.id === 'plus' && <div className="chip bg-brand text-white mb-2">Consigliato</div>}<div className="font-bold">{p.name}</div><div className="text-3xl font-extrabold mt-1">{p.price ? eur(p.price) : 'Gratis'}<span className="text-sm text-ink-soft font-medium">{p.price ? ' /mese + IVA' : ''}</span></div><ul className="text-sm text-ink-soft mt-3 space-y-1">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul></div>)}
        </div>
        <p className="text-sm text-ink-soft mt-4">In più, solo sui lavori che arrivano da EdilMen e che firmi: fee {(boot?.fee?.brackets || []).map((b) => `${num(b.rate * 100)}%${b.upTo ? ' fino a ' + eur(b.upTo) : ' oltre'}`).join(', ')}, a ogni SAL. Il piano non cambia mai il rating.</p>
      </div>
    </div>
  );
}

// Box sulle pagine prezzi: mediana dei prezzi reali caricati dalle persone + modulo di invio.
export function CommunityBox({ pkg, unit }) {
  const toast = useToast();
  const { data } = useLoad('/public/community-prices/' + pkg.code);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: '', qty: '', year: String(new Date().getFullYear()), comune: '', description: '', email: '', file: null });
  const send = async () => {
    const fd = new FormData();
    fd.append('pkg', pkg.code);
    for (const k of ['amount', 'qty', 'year', 'comune', 'description', 'email']) fd.append(k, v[k]);
    if (v.file) fd.append('file', v.file);
    try { await api.form('/public/community-prices', fd); toast('Grazie! Controlliamo la quotazione e la aggiungiamo alle medie'); setOpen(false); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="card p-5 mt-4">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <div className="font-bold text-lg">Prezzi reali dalla community</div>
          {data?.published ? <p className="text-sm mt-1">Da <b>{data.n}</b> quotazioni reali degli ultimi 3 anni: metà dei lavori tra <b>{eur(data.p25)}</b> e <b>{eur(data.p75)}</b> per {unit}, mediana <b>{eur(data.median)}</b>.</p>
            : <p className="text-sm text-ink-soft mt-1">Pubblichiamo le medie da 3 quotazioni controllate in su: mai la singola riga, il comune, l'email o il file. {data?.n ? `Finora ${data.n}.` : ''}</p>}
        </div>
        <button className="btn-soft" onClick={() => setOpen(!open)}>Condividi il prezzo che hai pagato</button>
      </div>
      {open && (
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <Field label="Importo pagato o preventivato (€, IVA esclusa)"><input className="input" type="number" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
          <Field label={`Quantità (${unit})`}><input className="input" type="number" value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value })} /></Field>
          <Field label="Anno"><input className="input" type="number" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} /></Field>
          <Field label="Comune"><input className="input" value={v.comune} onChange={(e) => setV({ ...v, comune: e.target.value })} /></Field>
          <Field label="Email (facoltativa)"><input className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Preventivo (facoltativo, resta privato)"><input type="file" accept=".pdf,image/*" onChange={(e) => setV({ ...v, file: e.target.files[0] })} /></Field>
          <Field label="Cosa comprendeva" className="sm:col-span-3"><textarea className="input" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <button className="btn-primary sm:col-span-3" onClick={send}>Invia</button>
        </div>
      )}
    </div>
  );
}
