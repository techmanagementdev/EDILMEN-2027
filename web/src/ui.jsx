import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';

export const eur = (v, d = 0) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(v) || 0);
export const num = (v, d = 0) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: d }).format(Number(v) || 0);
export const pct = (v, d = 0) => `${num((Number(v) || 0) * 100, d)}%`;
export const dt = (v) => (v ? new Date(v).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dtt = (v) => (v ? new Date(v).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// ---------- Sessione e dati di avvio ----------
const AppCtx = createContext(null);
export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [boot, setBoot] = useState(null);
  const refreshUser = useCallback(async () => {
    try { const r = await api.get('/auth/me'); setUser(r.user); return r.user; } catch { setUser(null); return null; }
  }, []);
  useEffect(() => {
    refreshUser();
    api.get('/public/bootstrap').then(setBoot).catch(() => setBoot({ error: true }));
  }, [refreshUser]);
  const logout = async () => { await api.post('/auth/logout'); setUser(null); };
  return <AppCtx.Provider value={{ user, setUser, refreshUser, logout, boot }}>{children}</AppCtx.Provider>;
}
export const useApp = () => useContext(AppCtx);

// ---------- Notifiche ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 no-print">
        {items.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lift ${t.kind === 'err' ? 'bg-bad text-white' : 'bg-navy text-white'}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Hook dati ----------
export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await api.get(path), loading: false, error: null }); }
    catch (e) { setState({ data: null, loading: false, error: e.message }); }
  }, [path]); // eslint-disable-line
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

// ---------- Componenti ----------
export function Logo({ light = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight text-xl ${light ? 'text-white' : 'text-ink'} ${className}`}>
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={light ? '#1F5EFF' : '#0B1F3A'} />
        <path d="M20 42h25a9 9 0 0 0 1-18 12 12 0 0 0-23-3 9 9 0 0 0-3 21z" fill="#fff" />
      </svg>
      edilmen
    </span>
  );
}

export const Spinner = ({ label = 'Caricamento…' }) => (
  <div className="flex items-center gap-3 py-10 justify-center text-ink-soft text-sm">
    <span className="h-5 w-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />{label}
  </div>
);
export const ErrorBox = ({ children }) => (children ? <div className="rounded-xl bg-bad-soft text-bad px-4 py-3 text-sm font-medium">{children}</div> : null);
export const Empty = ({ title, children, action }) => (
  <div className="text-center py-12 px-6">
    <div className="text-base font-semibold">{title}</div>
    {children && <div className="text-sm text-ink-soft mt-1 max-w-md mx-auto">{children}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-ink-mute mt-1">{hint}</span>}
    </label>
  );
}

export function Badge({ tone = 'gray', children }) {
  const m = { gray: 'bg-slate-100 text-slate-700', blue: 'bg-brand-soft text-brand', green: 'bg-ok-soft text-ok', amber: 'bg-warn-soft text-warn', red: 'bg-bad-soft text-bad', navy: 'bg-navy text-white' };
  return <span className={`chip ${m[tone] || m.gray}`}>{children}</span>;
}

export const STATUS = {
  nuova: ['Nuova', 'blue'], contattata: ['Contattata', 'amber'], sopralluogo: ['Sopralluogo', 'amber'], offerte: ['Offerte inviate', 'amber'],
  aggiudicata: ['Aggiudicata', 'green'], in_cantiere: ['In cantiere', 'green'], conclusa: ['Conclusa', 'navy'], persa: ['Persa', 'red'],
};
export const StatusBadge = ({ s }) => { const [l, t] = STATUS[s] || [s, 'gray']; return <Badge tone={t}>{l}</Badge>; };

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} p-6 mt-8`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="text-ink-mute hover:text-ink text-xl leading-none" onClick={onClose} aria-label="Chiudi">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-ink-mute uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tone === 'brand' ? 'text-brand' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-ink-soft mt-0.5">{sub}</div>}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([k, l, n]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${value === k ? 'bg-navy text-white border-navy' : 'bg-white text-ink-soft border-line hover:border-ink-mute'}`}>
          {l}{n != null && <span className={`ml-1.5 ${value === k ? 'text-white/70' : 'text-ink-mute'}`}>{n}</span>}
        </button>
      ))}
    </div>
  );
}

// Autocompletamento del comune (regione e provincia dedotte).
export function ComuneInput({ value, onChange, placeholder = 'Es. Trento', autoFocus }) {
  const [text, setText] = useState(value?.nome || '');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const t = useRef();
  useEffect(() => { setText(value?.nome ? `${value.nome} (${value.sigla})` : ''); }, [value?.nome, value?.sigla]);
  const search = (s) => {
    setText(s); setOpen(true);
    clearTimeout(t.current);
    if (s.length < 2) return setList([]);
    t.current = setTimeout(() => api.get('/public/comuni?q=' + encodeURIComponent(s)).then(setList).catch(() => {}), 150);
  };
  return (
    <div className="relative">
      <input className="input" value={text} autoFocus={autoFocus} placeholder={placeholder} onChange={(e) => search(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full card p-1 max-h-72 overflow-auto">
          {list.map((c) => (
            <button key={c.nome + c.sigla} type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-paper text-sm" onMouseDown={() => { onChange(c); setOpen(false); }}>
              <span className="font-semibold">{c.nome}</span> <span className="text-ink-mute">({c.sigla}) · {c.regione}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-white">
      <button type="button" className="px-4 py-2.5 text-lg font-bold text-ink-soft disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="w-12 text-center font-bold text-lg">{value}</span>
      <button type="button" className="px-4 py-2.5 text-lg font-bold text-ink-soft disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function Choice({ active, onClick, title, sub, icon, right }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition ${active ? 'border-brand shadow-lift' : 'border-line hover:border-slate-300'}`}>
      {icon && <span className="text-2xl w-9 text-center shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{title}</span>
        {sub && <span className="block text-sm text-ink-soft">{sub}</span>}
      </span>
      {right && <span className="text-sm font-bold text-brand whitespace-nowrap">{right}</span>}
      <span className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] text-white ${active ? 'bg-brand border-brand' : 'border-line'}`}>{active ? '✓' : ''}</span>
    </button>
  );
}

export function RatingBox({ rating, compact = false }) {
  if (!rating) return null;
  if (!rating.published) {
    return (
      <div className={compact ? 'text-xs text-ink-soft' : 'rounded-xl bg-paper border border-line p-3 text-sm'}>
        <span className="font-semibold text-ink">Rating in costruzione</span>
        {!compact && rating.missing?.length > 0 && <div className="text-ink-soft mt-1">Manca: {rating.missing.join(' · ')}</div>}
      </div>
    );
  }
  return (
    <div className={compact ? 'text-sm' : 'rounded-xl bg-ok-soft p-3'}>
      <span className="font-extrabold text-ok text-lg">{num(rating.value, 1)}</span>
      <span className="text-amber-500 ml-1">{'★'.repeat(Math.round(rating.value))}<span className="text-slate-300">{'★'.repeat(5 - Math.round(rating.value))}</span></span>
      <span className="text-xs text-ink-soft ml-2">{rating.reviews} recensioni verificate</span>
    </div>
  );
}

export const DOC_LABEL = { visura: 'Visura camerale', durc: 'DURC', rc: 'Assicurazione RC', patente: 'Patente a crediti', soa: 'Attestazione SOA', iso: 'ISO 9001' };
export function DocsBadges({ docs }) {
  if (!docs) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(DOC_LABEL).filter(([k]) => ['visura', 'durc', 'rc', 'patente'].includes(k) || docs[k]).map(([k, l]) => (
        <Badge key={k} tone={docs[k] ? 'green' : 'gray'}>{docs[k] ? '✓' : '○'} {l}</Badge>
      ))}
    </div>
  );
}

export function useFormState(init) {
  const [v, setV] = useState(init);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  return [v, setV, set];
}

export function PageTitle({ title, sub, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">{title}</h1>
        {sub && <p className="text-ink-soft mt-1 text-sm max-w-3xl">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const A = ({ to, children, className = '' }) => <Link to={to} className={`text-brand font-semibold hover:underline ${className}`}>{children}</Link>;
export { useMemo };
