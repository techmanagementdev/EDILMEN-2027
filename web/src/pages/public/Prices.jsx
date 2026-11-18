import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { territoryCoef } from '@shared/pricing.js';
import { LAVORI } from '@shared/lavori.js';
import { useApp, Spinner, eur, num, Badge } from '../../ui.jsx';
import { Checklist } from './Wizard.jsx';
import { CommunityBox } from './SaasPages.jsx';

const PROV = [['TN', 'Trento'], ['BZ', 'Bolzano'], ['VR', 'Verona'], ['VI', 'Vicenza'], ['PD', 'Padova'], ['TV', 'Treviso'], ['VE', 'Venezia'], ['BL', 'Belluno'], ['RO', 'Rovigo'], ['UD', 'Udine'], ['PN', 'Pordenone'], ['GO', 'Gorizia'], ['TS', 'Trieste']];

function ProvSelect({ value, onChange }) {
  return <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>{PROV.map(([s, n]) => <option key={s} value={s}>Provincia di {n}</option>)}</select>;
}

export function PricesList() {
  const { boot } = useApp();
  const [prov, setProv] = useState('TN');
  const [fam, setFam] = useState('');
  const cat = boot?.catalog;
  const fams = useMemo(() => (cat ? [...new Set(cat.packages.map((p) => p.family))] : []), [cat]);
  if (!cat) return <Spinner />;
  const coef = territoryCoef(cat.params, prov).coef;
  const list = cat.packages.filter((p) => !fam || p.family === fam);
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="eyebrow">Prezzi dei lavori · listino EdilMen {cat.version}</div>
      <h1 className="text-3xl sm:text-4xl font-extrabold mt-2">Quanto costano davvero i lavori in casa</h1>
      <p className="text-ink-soft mt-2 max-w-3xl">{cat.packages.length} lavori a pacchetto: voci e quantità fisse, uguali per tutte le imprese. Tre livelli di materiali, IVA esclusa, posa inclusa. Prezzo prudente: comprende gli imprevisti tipici, al sopralluogo può solo scendere.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <ProvSelect value={prov} onChange={setProv} />
        <select className="input w-auto" value={fam} onChange={(e) => setFam(e.target.value)}><option value="">Tutte le famiglie</option>{fams.map((f) => <option key={f}>{f}</option>)}</select>
      </div>
      <div className="card overflow-x-auto mt-6">
        <table className="w-full min-w-[720px]">
          <thead className="bg-paper"><tr><th className="th">Lavoro</th><th className="th">Unità</th><th className="th text-right">Standard</th><th className="th text-right">Intermedio</th><th className="th text-right">Premium</th><th className="th">Durata</th></tr></thead>
          <tbody className="divide-y divide-line">
            {list.map((p) => (
              <tr key={p.code} className="hover:bg-paper">
                <td className="td"><Link to={`/prezzi/${p.code}?prov=${prov}`} className="font-semibold text-ink hover:text-brand">{p.name}</Link><div className="text-xs text-ink-mute">{p.family} · {p.code}</div></td>
                <td className="td text-sm text-ink-soft">{p.unit}</td>
                {p.prices.map((x, i) => <td key={i} className="td text-right whitespace-nowrap">{eur(x * (1 + p.acc) * coef)}</td>)}
                <td className="td text-sm text-ink-soft whitespace-nowrap">{p.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-mute mt-3">Prezzi per unità, prudenti, coefficiente di zona {num(coef, 2)}. Fonti: elenco prezzi PAT 2026, prezzario Regione Veneto 2026, prezzi PA Bolzano 2026, listini delle imprese convenzionate.</p>
    </div>
  );
}

export function PricePage() {
  const { code } = useParams();
  const { boot } = useApp();
  const qsProv = new URLSearchParams(window.location.search).get('prov') || 'TN';
  const [prov, setProv] = useState(qsProv);
  const [lvl, setLvl] = useState(1);
  const cat = boot?.catalog;
  if (!cat) return <Spinner />;
  const p = cat.packages.find((x) => x.code === code);
  if (!p) return <div className="max-w-3xl mx-auto px-4 py-12">Lavoro non trovato. <Link to="/prezzi" className="text-brand">Torna ai prezzi</Link></div>;
  const coef = territoryCoef(cat.params, prov).coef;
  const vars = cat.variants.filter((v) => v.pkg === code);
  const job = LAVORI.find((l) => { try { return l.lines({}, { mq: 90, piani: 1 }).some((x) => x.pkg === code); } catch { return false; } });
  const ref = p.refQty || 1;
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link to="/prezzi" className="text-sm text-ink-soft">← Tutti i prezzi</Link>
      <div className="eyebrow mt-4">{p.family} · {p.code}</div>
      <h1 className="text-3xl sm:text-4xl font-extrabold mt-1">{p.name}: quanto costa</h1>
      <p className="text-ink-soft mt-2">{p.solves}. Scenario di riferimento: {p.scenario}.</p>
      <div className="flex flex-wrap gap-2 mt-5"><ProvSelect value={prov} onChange={setProv} />{['Standard', 'Intermedio', 'Premium'].map((l, i) => <button key={l} onClick={() => setLvl(i)} className={`btn-sm ${lvl === i ? 'btn-dark' : 'btn-ghost'}`}>{l}</button>)}</div>
      <div className="grid sm:grid-cols-3 gap-3 mt-5">
        <div className="card p-5"><div className="text-xs text-ink-mute font-semibold uppercase">Parte fissa</div><div className="text-2xl font-extrabold mt-1">{eur(p.prices[lvl] * coef)}<span className="text-sm text-ink-soft font-medium"> / {p.unit}</span></div></div>
        <div className="card p-5 bg-navy text-white border-navy"><div className="text-xs text-blue-200 font-semibold uppercase">Prezzo prudente</div><div className="text-2xl font-extrabold mt-1">{eur(p.prices[lvl] * (1 + p.acc) * coef)}<span className="text-sm text-white/70 font-medium"> / {p.unit}</span></div><div className="text-xs text-white/60">accantonamento imprevisti {num(p.acc * 100)}%</div></div>
        <div className="card p-5"><div className="text-xs text-ink-mute font-semibold uppercase">Esempio: {num(ref)} {p.unit}</div><div className="text-2xl font-extrabold mt-1">{eur(p.prices[lvl] * (1 + p.acc) * coef * ref)}</div><div className="text-xs text-ink-soft">{p.duration} · {p.permit}</div></div>
      </div>
      <div className="card p-5 mt-6"><div className="font-bold text-lg mb-4">Cosa c'è nel pacchetto</div><Checklist pkg={p} level={lvl} /></div>
      {vars.length > 0 && (
        <div className="card p-5 mt-4"><div className="font-bold text-lg mb-3">Varianti: cambiano il prezzo, non il pacchetto</div>
          <ul className="space-y-2 text-sm">{vars.map((v) => <li key={v.code} className="flex justify-between gap-4"><span><b>{v.name}</b> <span className="text-ink-soft">— {v.what}</span></span><Badge tone={v.delta > 0 ? 'amber' : 'green'}>{v.delta > 0 ? '+' : ''}{num(v.delta * 100)}%</Badge></li>)}</ul>
        </div>
      )}
      <CommunityBox pkg={p} unit={p.unit} />
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to={job ? `/quota?lavori=${job.id}` : '/quota'} className="btn-primary btn-lg">Calcola il prezzo per casa tua</Link>
      </div>
    </div>
  );
}
