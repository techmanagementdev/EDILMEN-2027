import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useApp, Field, ErrorBox, Choice, ComuneInput } from '../../ui.jsx';
import { api } from '../../api.js';

const dest = (role) => (['admin', 'operatore'].includes(role) ? '/admin' : role === 'impresa' ? '/impresa' : '/area');

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { refreshUser } = useApp();
  const [v, setV] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null);
  const go = async (e) => {
    e.preventDefault(); setErr(null);
    try { const r = await api.post('/auth/login', v); await refreshUser(); nav(loc.state?.from && loc.state.from !== '/accedi' ? loc.state.from : dest(r.role)); } catch (e2) { setErr(e2.message); }
  };
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-extrabold">Accedi</h1>
      <form onSubmit={go} className="card p-6 mt-6 space-y-4">
        <Field label="Email"><input className="input" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary w-full">Entra</button>
        <p className="text-sm text-ink-soft text-center">Non hai un account? <Link to="/registrati" className="text-brand font-semibold">Registrati</Link> · Sei un'impresa? <Link to="/rivendica" className="text-brand font-semibold">Rivendica la scheda</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { refreshUser } = useApp();
  const [v, setV] = useState({ role: sp.get('ruolo') || 'cliente', name: '', email: '', phone: '', password: '', orgName: '', vat: '', comune: null, privacy: false });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const go = async (e) => {
    e.preventDefault(); setErr(null);
    try { await api.post('/auth/register', { ...v, comune: v.comune?.nome, requestToken: sp.get('r') || undefined }); await refreshUser(); nav(v.role === 'cliente' ? '/area' : '/area/immobili'); } catch (e2) { setErr(e2.message); }
  };
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold">Crea il tuo account</h1>
      <form onSubmit={go} className="card p-6 mt-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <Choice title="Privato" sub="La mia casa" active={v.role === 'cliente'} onClick={() => setV({ ...v, role: 'cliente' })} />
          <Choice title="Agenzia" sub="Immobiliare" active={v.role === 'agenzia'} onClick={() => setV({ ...v, role: 'agenzia' })} />
          <Choice title="Investitore" sub="Operazioni" active={v.role === 'investitore'} onClick={() => setV({ ...v, role: 'investitore' })} />
        </div>
        <p className="text-xs text-ink-mute">Sei un'impresa edile o un artigiano? <Link to="/rivendica" className="text-brand font-semibold">Rivendica la scheda</Link> o <Link to="/iscrizione-impresa" className="text-brand font-semibold">iscriviti qui</Link>.</p>
        {v.role !== 'cliente' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={v.role === 'agenzia' ? 'Nome dell\'agenzia' : 'Nome o società'}><input className="input" value={v.orgName} onChange={set('orgName')} /></Field>
            <Field label="Partita IVA (facoltativa)"><input className="input" value={v.vat} onChange={set('vat')} /></Field>
            <Field label="Comune" className="sm:col-span-2"><ComuneInput value={v.comune} onChange={(c) => setV({ ...v, comune: c })} /></Field>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome e cognome"><input className="input" value={v.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label="Telefono"><input className="input" value={v.phone} onChange={set('phone')} autoComplete="tel" /></Field>
          <Field label="Email"><input className="input" type="email" value={v.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Password"><input className="input" type="password" value={v.password} onChange={set('password')} placeholder="Almeno 8 caratteri" autoComplete="new-password" /></Field>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={v.privacy} onChange={(e) => setV({ ...v, privacy: e.target.checked })} /> Ho letto l'<Link to="/privacy" className="text-brand underline">informativa privacy</Link> e i <Link to="/termini" className="text-brand underline">termini</Link>.</label>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary w-full btn-lg">Crea l'account</button>
        <p className="text-sm text-ink-soft text-center">Hai già un account? <Link to="/accedi" className="text-brand font-semibold">Accedi</Link></p>
      </form>
    </div>
  );
}
