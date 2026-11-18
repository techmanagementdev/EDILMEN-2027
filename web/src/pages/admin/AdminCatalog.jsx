import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { feeFor } from '@shared/pricing.js';
import { useLoad, useApp, Spinner, PageTitle, Badge, eur, num, dt, useToast, Field, Modal } from '../../ui.jsx';
import { api } from '../../api.js';

export function AdminCatalog() {
  const toast = useToast();
  const { user } = useApp();
  const { data, loading, reload } = useLoad('/admin/catalog');
  const [fam, setFam] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [imp, setImp] = useState(false);
  const [file, setFile] = useState(null);
  const [params, setParams] = useState(null);
  if (loading) return <Spinner />;
  const cat = data.catalog;
  const P = params || cat.params;
  const fams = [...new Set(cat.packages.map((p) => p.family))];
  const list = cat.packages.filter((p) => (!fam || p.family === fam) && (!q || (p.name + p.code).toLowerCase().includes(q.toLowerCase())));
  const isAdmin = user.role === 'admin';
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); window.dispatchEvent(new Event('catalog-changed')); } catch (e) { toast(e.message, 'err'); } };
  const doImport = () => { const fd = new FormData(); fd.append('file', file); return act(() => api.form('/admin/catalog/import', fd), 'Listino importato e attivato').then(() => setImp(false)); };
  return (
    <>
      <PageTitle title={`Listino EdilMen v${cat.version}`} sub={`${cat.packages.length} pacchetti, ${cat.variants.length} varianti. Prezzi base Trento, IVA esclusa, posa inclusa. Il sito usa il prezzo prudente: parte fissa + accantonamento.`} actions={isAdmin && <button className="btn-primary" onClick={() => setImp(true)}>Importa nuova versione da Excel</button>} />
      <div className="flex flex-wrap gap-2 mb-3"><input className="input w-64" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome o codice" /><select className="input w-auto" value={fam} onChange={(e) => setFam(e.target.value)}><option value="">Tutte le famiglie</option>{fams.map((f) => <option key={f}>{f}</option>)}</select></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px]"><thead className="bg-paper"><tr><th className="th">Pacchetto</th><th className="th">Unità</th><th className="th text-right">Standard</th><th className="th text-right">Intermedio</th><th className="th text-right">Premium</th><th className="th text-right">Accant.</th><th className="th text-right">Prudente Int.</th><th className="th">Durata</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">{list.map((p) => (
            <tr key={p.code}><td className="td"><Link to={`/prezzi/${p.code}`} target="_blank" className="font-semibold hover:text-brand">{p.name}</Link><div className="text-xs text-ink-mute">{p.code} · {p.family} · {p.checklist?.length || 0} voci</div></td><td className="td text-sm">{p.unit}</td>{p.prices.map((x, i) => <td key={i} className="td text-right">{eur(x)}</td>)}<td className="td text-right">{num(p.acc * 100)}%</td><td className="td text-right font-semibold">{eur(p.prices[1] * (1 + p.acc))}</td><td className="td text-sm text-ink-soft">{p.duration}</td><td className="td">{isAdmin && <button className="btn-ghost btn-sm" onClick={() => setEdit({ code: p.code, name: p.name, prices: [...p.prices], acc: p.acc })}>Modifica</button>}</td></tr>
          ))}</tbody></table>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <div className="font-bold mb-3">Coefficienti di zona</div>
          <div className="grid grid-cols-3 gap-2">{Object.entries(P.territorio).map(([k, v]) => <Field key={k} label={k.replace('_', ' ')}><input className="input py-1.5" type="number" step="0.01" value={v} disabled={!isAdmin} onChange={(e) => setParams({ ...P, territorio: { ...P.territorio, [k]: Number(e.target.value) } })} /></Field>)}</div>
          <div className="font-bold mt-5 mb-3">Coefficienti di cantiere</div>
          <div className="grid grid-cols-2 gap-2">{Object.entries(P.logistica).map(([k, v]) => <Field key={k} label={{ abitata: 'Casa abitata', noasc: 'Senza ascensore', ztl: 'Centro storico / accesso', montagna: 'Oltre 1.000 m' }[k] || k}><input className="input py-1.5" type="number" step="0.01" value={v} disabled={!isAdmin} onChange={(e) => setParams({ ...P, logistica: { ...P.logistica, [k]: Number(e.target.value) } })} /></Field>)}</div>
        </div>
        <div className="card p-5">
          <div className="font-bold mb-3">Percentuali</div>
          <div className="grid grid-cols-2 gap-2">
            {[['sicurezza', 'Oneri sicurezza'], ['tecniche', 'Spese tecniche'], ['ivaRistrutturazione', 'IVA ristrutturazione'], ['ivaPrimaCasaNuova', 'IVA prima casa nuova'], ['ivaOrdinaria', 'IVA ordinaria'], ['ribassoVariabili', 'Ribasso voci a misura']].map(([k, l]) => <Field key={k} label={`${l} (%)`}><input className="input py-1.5" type="number" step="0.1" value={Math.round(P[k] * 1000) / 10} disabled={!isAdmin} onChange={(e) => setParams({ ...P, [k]: Number(e.target.value) / 100 })} /></Field>)}
          </div>
          <div className="font-bold mt-5 mb-2">Piano SAL</div>
          {P.sal.map((s, i) => <div key={i} className="flex gap-2 items-center text-sm mb-1.5"><input className="input py-1.5 flex-1" value={s.name} disabled={!isAdmin} onChange={(e) => setParams({ ...P, sal: P.sal.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /><input className="input py-1.5 w-20" type="number" value={Math.round(s.share * 100)} disabled={!isAdmin} onChange={(e) => setParams({ ...P, sal: P.sal.map((x, j) => (j === i ? { ...x, share: Number(e.target.value) / 100 } : x)) })} />%</div>)}
          <div className={`text-xs ${Math.round(P.sal.reduce((s, x) => s + x.share, 0) * 100) === 100 ? 'text-ok' : 'text-bad'}`}>Totale {Math.round(P.sal.reduce((s, x) => s + x.share, 0) * 100)}% (deve essere 100%)</div>
          {isAdmin && params && <button className="btn-primary mt-4" onClick={() => act(() => api.put('/admin/catalog/params', params), 'Parametri salvati in una nuova versione').then(() => setParams(null))}>Salva parametri</button>}
        </div>
      </div>

      <div className="card p-5 mt-6"><div className="font-bold mb-2">Versioni</div>
        <table className="w-full text-sm"><tbody className="divide-y divide-line">{data.versions.map((v) => <tr key={v.id}><td className="py-1.5">#{v.id} · v{v.version}</td><td className="py-1.5 text-ink-soft">{v.note}</td><td className="py-1.5">{dt(v.created_at)}</td><td className="py-1.5 text-right">{v.active ? <Badge tone="green">attiva</Badge> : isAdmin && <button className="btn-ghost btn-sm" onClick={() => act(() => api.post('/admin/catalog/activate/' + v.id), 'Versione riattivata')}>Riattiva</button>}</td></tr>)}</tbody></table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.code} · ${edit.name}` : ''}>
        {edit && <div className="space-y-3">
          <Field label="Nome"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">{['Standard', 'Intermedio', 'Premium'].map((l, i) => <Field key={l} label={`${l} €`}><input className="input" type="number" value={edit.prices[i]} onChange={(e) => setEdit({ ...edit, prices: edit.prices.map((x, j) => (j === i ? Number(e.target.value) : x)) })} /></Field>)}</div>
          <Field label="Accantonamento variabili (%)"><input className="input" type="number" value={Math.round(edit.acc * 100)} onChange={(e) => setEdit({ ...edit, acc: Number(e.target.value) / 100 })} /></Field>
          <p className="text-xs text-ink-mute">Ogni modifica crea una nuova versione del listino: le richieste già fatte restano con il prezzo calcolato allora.</p>
          <button className="btn-primary w-full" onClick={() => act(() => api.put('/admin/catalog/packages/' + edit.code, edit), 'Pacchetto aggiornato').then(() => setEdit(null))}>Salva</button>
        </div>}
      </Modal>
      <Modal open={imp} onClose={() => setImp(false)} title="Importa il listino da Excel">
        <p className="text-sm text-ink-soft">Il file deve avere i fogli del listino EdilMen: CATALOGO_PACCHETTI, CHECKLIST_UTENTE, VARIANTI, COMPONENTI_VARIABILI, PARAMETRI. Diventa subito la versione attiva; puoi tornare indietro dalle versioni.</p>
        <input type="file" accept=".xlsx" className="mt-4" onChange={(e) => setFile(e.target.files[0])} />
        <button className="btn-primary w-full mt-4" disabled={!file} onClick={doImport}>Importa e attiva</button>
      </Modal>
    </>
  );
}

export function AdminSettings() {
  const toast = useToast();
  const { user } = useApp();
  const { data, loading, reload } = useLoad('/admin/settings');
  const [s, setS] = useState(null);
  if (loading) return <Spinner />;
  const v = s || data;
  const isAdmin = user.role === 'admin';
  const save = async (key) => { try { await api.put('/admin/settings/' + key, { value: v[key] }); toast('Salvato'); reload(); } catch (e) { toast(e.message, 'err'); } };
  const fr = v.fee_rules;
  const setFr = (x) => setS({ ...v, fee_rules: x });
  return (
    <>
      <PageTitle title="Fee, piani e matching" sub="Un'unica fonte delle regole economiche: la leggono sito, contratti, report e area imprese." />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold">Fee sui lavori aggiudicati (pagata dall'impresa a ogni SAL)</div>
          <div className="space-y-2 mt-3">
            {fr.brackets.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <input className="input w-20 py-1.5" type="number" step="0.5" value={Math.round(b.rate * 1000) / 10} disabled={!isAdmin} onChange={(e) => setFr({ ...fr, brackets: fr.brackets.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) / 100 } : x)) })} />%
                <span>{b.upTo != null ? 'fino a' : 'oltre'}</span>
                {b.upTo != null && <input className="input w-36 py-1.5" type="number" value={b.upTo} disabled={!isAdmin} onChange={(e) => setFr({ ...fr, brackets: fr.brackets.map((x, j) => (j === i ? { ...x, upTo: Number(e.target.value) } : x)) })} />}
                {b.upTo != null && <span>€</span>}
              </div>
            ))}
          </div>
          <Field label="Come si applica" className="mt-3"><select className="input" value={fr.mode} disabled={!isAdmin} onChange={(e) => setFr({ ...fr, mode: e.target.value })}><option value="flat">Aliquota dello scaglione in cui cade l'intero contratto</option><option value="progressive">A scaglioni marginali (come l'IRPEF)</option></select></Field>
          <div className="text-xs text-ink-mute mt-2">Esempi: {[20000, 50000, 120000, 3500000].map((x) => `${eur(x)} → ${eur(feeFor(x, fr).fee)}`).join(' · ')}</div>
          {isAdmin && <button className="btn-primary mt-4" onClick={() => save('fee_rules')}>Salva fee</button>}
        </div>
        <div className="card p-5">
          <div className="font-bold">Matching delle richieste</div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[['radiusKm', 'Raggio minimo (km)', 1], ['maxOffers', 'Offerte mostrate al cliente', 1], ['inviteTop', 'Imprese invitate in automatico', 1], ['priceHigh', 'Soglia prezzo alto (%)', 100], ['priceAnomalous', 'Soglia prezzo anomalo (%)', 100]].map(([k, l, m]) => <Field key={k} label={l}><input className="input" type="number" value={Math.round(v.matching[k] * m * 10) / 10} disabled={!isAdmin} onChange={(e) => setS({ ...v, matching: { ...v.matching, [k]: Number(e.target.value) / m } })} /></Field>)}
          </div>
          {isAdmin && <button className="btn-primary mt-4" onClick={() => save('matching')}>Salva matching</button>}
        </div>
        <div className="card p-5 lg:col-span-2">
          <div className="font-bold">Piani per le imprese</div>
          <div className="grid md:grid-cols-3 gap-3 mt-3">
            {v.plans.map((p, i) => (
              <div key={p.id} className="rounded-xl border border-line p-3 space-y-2">
                <Field label="Nome"><input className="input py-1.5" value={p.name} disabled={!isAdmin} onChange={(e) => setS({ ...v, plans: v.plans.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></Field>
                <Field label="€ al mese"><input className="input py-1.5" type="number" value={p.price} disabled={!isAdmin} onChange={(e) => setS({ ...v, plans: v.plans.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })} /></Field>
                <Field label="Cosa include (una riga per voce)"><textarea className="input" rows={4} value={p.features.join('\n')} disabled={!isAdmin} onChange={(e) => setS({ ...v, plans: v.plans.map((x, j) => (j === i ? { ...x, features: e.target.value.split('\n') } : x)) })} /></Field>
              </div>
            ))}
          </div>
          {isAdmin && <button className="btn-primary mt-4" onClick={() => save('plans')}>Salva piani</button>}
        </div>
        <div className="card p-5">
          <div className="font-bold">Consensi e contatti</div>
          <Field label="Versione dell'informativa (registrata a ogni consenso)" className="mt-3"><input className="input" value={v.consent_version} disabled={!isAdmin} onChange={(e) => setS({ ...v, consent_version: e.target.value })} /></Field>
          {isAdmin && <button className="btn-ghost mt-2" onClick={() => save('consent_version')}>Salva versione</button>}
          <div className="grid grid-cols-3 gap-2 mt-4">{['phone', 'email', 'whatsapp'].map((k) => <Field key={k} label={k}><input className="input py-1.5" value={v.contacts[k] || ''} disabled={!isAdmin} onChange={(e) => setS({ ...v, contacts: { ...v.contacts, [k]: e.target.value } })} /></Field>)}</div>
          {isAdmin && <button className="btn-ghost mt-2" onClick={() => save('contacts')}>Salva contatti</button>}
        </div>
        <div className="card p-5">
          <div className="font-bold">Modalità di incasso predefinita</div>
          <p className="text-sm text-ink-soft mt-1">Decisione aperta D-C: fattura diretta dell'impresa con fee a SAL, oppure escrow presso un istituto di pagamento autorizzato. Si sceglie contratto per contratto.</p>
          <select className="input mt-3" value={v.payment_mode_default} disabled={!isAdmin} onChange={(e) => setS({ ...v, payment_mode_default: e.target.value })}><option value="diretto">Fattura diretta + fee a SAL</option><option value="escrow">Escrow</option></select>
          {isAdmin && <button className="btn-ghost mt-2" onClick={() => save('payment_mode_default')}>Salva</button>}
        </div>
      </div>
    </>
  );
}
