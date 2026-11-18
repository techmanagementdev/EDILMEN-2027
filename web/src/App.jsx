import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AppProvider, ToastProvider, useApp, Logo, Spinner } from './ui.jsx';

import Home from './pages/public/Home.jsx';
import './pages/public/home.css';
import Wizard from './pages/public/Wizard.jsx';
import RequestStatus from './pages/public/RequestStatus.jsx';
import { Directory, CompanyPage } from './pages/public/Companies.jsx';
import { PricesList, PricePage } from './pages/public/Prices.jsx';
import { RatingPage, ForCompanies, ClaimPage, JoinPage, AgenciesLanding, BigLanding, Legal } from './pages/public/Info.jsx';
import VoicePage from './pages/public/Voice.jsx';
import { Login, Register } from './pages/public/Auth.jsx';
import Report from './pages/public/Report.jsx';
import { PreventivoPage, SoftwareLanding } from './pages/public/SaasPages.jsx';

import { MyRequests, MyRequestDetail, Properties, PropertyDetail, ComputoNew, Profile } from './pages/area/Area.jsx';
import { ImpresaHome, ImpresaProfile, ImpresaPrices, ImpresaOpportunities, ImpresaSites, ImpresaDocs, ImpresaFees } from './pages/impresa/Impresa.jsx';
import { AdminDashboard, AdminRequests, AdminRequest } from './pages/admin/AdminRequests.jsx';
import { AdminCompanies, AdminCompany, AdminPrices, AdminClaims } from './pages/admin/AdminCompanies.jsx';
import { AdminCatalog, AdminSettings } from './pages/admin/AdminCatalog.jsx';
import { GDashboard, GClients, GClient, GQuotes, GQuoteEditor, GJobs, GJob, GDeadlines, Subscription, Team, Stats } from './pages/impresa/Gestionale.jsx';
import { AdminSubscriptions, AdminCommunity } from './pages/admin/AdminSaas.jsx';
import { AdminContracts, AdminArtisans, AdminReviews, AdminReports, AdminUsers, AdminAudit } from './pages/admin/AdminOther.jsx';

function KeyedWizard() {
  const { search } = useLocation();
  return <Wizard key={search} />;
}

function ScrollTop() {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const homeFor = (u) => (!u ? '/accedi' : ['admin', 'operatore'].includes(u.role) ? '/admin' : u.role === 'impresa' ? '/impresa' : '/area');

function PublicLayout() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const links = [['/prezzi', 'Prezzi'], ['/imprese', 'Imprese'], ['/agenzie', 'Agenzie e investitori'], ['/grandi-operazioni', 'Grandi lavori'], ['/per-le-imprese', 'Per le imprese']];
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#e2e2e2' }}>
      <header className="em-nav no-print">
        <div className="in" style={{ paddingLeft: 'clamp(20px, 3.2vw, 48px)', paddingRight: 'clamp(20px, 3.2vw, 48px)' }}>
          <Link to="/" className="wm" aria-label="EdilMen, home"><img src="/favicon.svg" alt="" width="22" height="22" />EdilMen</Link>
          <nav className="links" aria-label="Principale">
            {links.map(([to, l]) => <NavLink key={to} to={to}>{l}</NavLink>)}
          </nav>
          <div className="right">
            <Link to={homeFor(user)} className="acc" style={{ color: '#3a1a1d', textDecoration: 'none' }}>{user ? 'La mia area' : 'Accedi'}</Link>
            <Link to="/quota" className="go">Calcola il prezzo</Link>
            <button className="burger" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">{open ? 'Chiudi' : 'Menu'}</button>
          </div>
        </div>
        {open && (
          <nav className="mob" onClick={() => setOpen(false)} aria-label="Menu mobile">
            {links.map(([to, l]) => <Link key={to} to={to}>{l}</Link>)}
            <Link to="/software-imprese">Gestionale imprese</Link>
            <Link to={homeFor(user)}>{user ? 'La mia area' : 'Accedi'}</Link>
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="em em-foot wrap no-print">
      <div className="top">
        <div className="notes">
          <div>EdilMen è un servizio di European Management Institute S.r.l., Via dei Solteri 74, 38121 Trento.</div>
          <div><Link to="/quota">Calcola il prezzo</Link><br /><Link to="/prezzi">Prezzi dei lavori</Link><br /><Link to="/imprese">Elenco imprese</Link><br /><Link to="/rating">Come nasce il rating</Link></div>
          <div><Link to="/agenzie">Agenzie e investitori</Link><br /><Link to="/grandi-operazioni">Condomini e grandi lavori</Link><br /><Link to="/per-le-imprese">Imprese e artigiani</Link><br /><Link to="/software-imprese">Gestionale per imprese</Link></div>
        </div>
        <a href="#top" className="up" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Torna su</a>
      </div>
      <Link to="/vocale" className="big">Mandaci un vocale.</Link>
      <div className="meta">
        <nav aria-label="Note legali"><Link to="/privacy">Privacy</Link><Link to="/termini">Termini</Link><Link to="/rivendica">Rivendica la scheda</Link></nav>
        <span className="c">Trentino-Alto Adige e Veneto</span>
        <span className="r">© {new Date().getFullYear()} EdilMen</span>
      </div>
    </footer>
  );
}

function SideLayout({ title, nav, roles }) {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (user === undefined) return <Spinner />;
  if (!user) return <Navigate to="/accedi" replace state={{ from: window.location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  const Side = (
    <aside className="bg-navy text-white w-64 shrink-0 flex flex-col min-h-screen">
      <div className="px-5 py-5"><Link to="/"><Logo light /></Link><div className="text-xs text-white/50 mt-1">{title}</div></div>
      <nav className="flex-1 px-3 space-y-0.5 text-sm">
        {nav.map((n) => (n.section ? <div key={n.section} className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-white/40 font-semibold">{n.section}</div> : (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center justify-between rounded-lg px-3 py-2 ${isActive ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10'}`}>
            <span>{n.label}</span>{n.badge ? <span className="text-[10px] bg-white/15 rounded-full px-1.5">{n.badge}</span> : null}
          </NavLink>
        )))}
      </nav>
      <div className="p-4 border-t border-white/10 text-xs">
        <div className="font-semibold truncate">{user.name || user.email}</div>
        <div className="text-white/50 truncate">{user.company?.name || user.agency?.name || user.role}</div>
        <button className="mt-3 text-white/70 hover:text-white" onClick={async () => { await logout(); navigate('/'); }}>Esci</button>
      </div>
    </aside>
  );
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block no-print">{Side}</div>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><div onClick={() => setOpen(false)} className="absolute inset-0 bg-navy/50" /><div className="relative">{Side}</div></div>}
      <div className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-line px-4 h-14 flex items-center justify-between no-print">
          <button className="btn-ghost px-3" onClick={() => setOpen(true)}>☰</button><Logo /><span className="w-10" />
        </div>
        <div className="p-4 sm:p-8 max-w-7xl">
          {user.must_change_password && <div className="rounded-xl bg-warn-soft text-warn text-sm font-semibold p-3 mb-4 no-print">Stai usando una password provvisoria: cambiala da {user.role === 'impresa' ? '«Team»' : '«Profilo»'}.</div>}
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const ADMIN_NAV = [
  { to: '/admin', label: 'Cruscotto', end: true },
  { section: 'Domanda' },
  { to: '/admin/richieste', label: 'Richieste e offerte' },
  { to: '/admin/contratti', label: 'Contratti, SAL e fee' },
  { section: 'Rete' },
  { to: '/admin/imprese', label: 'Imprese' },
  { to: '/admin/rivendicazioni', label: 'Rivendicazioni' },
  { to: '/admin/prezzi-imprese', label: 'Prezzi delle imprese' },
  { to: '/admin/rubrica', label: 'Rubrica artigiani' },
  { to: '/admin/recensioni', label: 'Recensioni' },
  { to: '/admin/segnalazioni', label: 'Segnalazioni' },
  { to: '/admin/prezzi-community', label: 'Prezzi community' },
  { section: 'SaaS' },
  { to: '/admin/abbonamenti', label: 'Abbonamenti e MRR' },
  { section: 'Regole' },
  { to: '/admin/listino', label: 'Listino EdilMen' },
  { to: '/admin/impostazioni', label: 'Fee, piani e matching' },
  { to: '/admin/utenti', label: 'Utenti' },
  { to: '/admin/registro', label: 'Registro attività' },
];
const IMPRESA_NAV = [
  { to: '/impresa', label: 'Panoramica', end: true },
  { section: 'Lavori da EdilMen' },
  { to: '/impresa/opportunita', label: 'Opportunità' },
  { to: '/impresa/cantieri', label: 'Contratti EdilMen e SAL' },
  { to: '/impresa/listino', label: 'Il mio listino' },
  { to: '/impresa/fee', label: 'Fee EdilMen' },
  { section: 'Gestionale' },
  { to: '/impresa/gestionale', label: 'Cruscotto' },
  { to: '/impresa/clienti', label: 'Clienti' },
  { to: '/impresa/preventivi', label: 'Preventivi' },
  { to: '/impresa/cantieri-gestionale', label: 'Cantieri' },
  { to: '/impresa/scadenze', label: 'Scadenze' },
  { section: 'Impresa' },
  { to: '/impresa/profilo', label: 'Profilo pubblico' },
  { to: '/impresa/documenti', label: 'Documenti' },
  { to: '/impresa/statistiche', label: 'Statistiche scheda' },
  { to: '/impresa/team', label: 'Team' },
  { to: '/impresa/abbonamento', label: 'Abbonamento' },
];
function areaNav(u) {
  const base = [{ to: '/area', label: 'Le mie richieste', end: true }];
  if (u && (u.role === 'agenzia' || u.role === 'investitore')) base.push({ to: '/area/immobili', label: u.role === 'agenzia' ? 'Immobili in portafoglio' : 'Operazioni e immobili' }, { to: '/area/computo', label: 'Richiesta su computo' });
  base.push({ to: '/quota', label: 'Nuova quotazione' }, { to: '/area/profilo', label: 'Profilo' });
  return base;
}
function AreaShell() {
  const { user } = useApp();
  return <SideLayout title={user?.role === 'agenzia' ? 'Area agenzia' : user?.role === 'investitore' ? 'Area investitore' : 'Area cliente'} nav={areaNav(user)} roles={['cliente', 'agenzia', 'investitore']} />;
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollTop />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/quota" element={<KeyedWizard />} />
              <Route path="/richiesta/:token" element={<RequestStatus />} />
              <Route path="/imprese" element={<Directory />} />
              <Route path="/imprese/:slug" element={<CompanyPage />} />
              <Route path="/prezzi" element={<PricesList />} />
              <Route path="/prezzi/:code" element={<PricePage />} />
              <Route path="/rating" element={<RatingPage />} />
              <Route path="/per-le-imprese" element={<ForCompanies />} />
              <Route path="/rivendica" element={<ClaimPage />} />
              <Route path="/iscrizione-impresa" element={<JoinPage />} />
              <Route path="/agenzie" element={<AgenciesLanding />} />
              <Route path="/grandi-operazioni" element={<BigLanding />} />
              <Route path="/vocale" element={<VoicePage />} />
              <Route path="/software-imprese" element={<SoftwareLanding />} />
              <Route path="/accedi" element={<Login />} />
              <Route path="/registrati" element={<Register />} />
              <Route path="/privacy" element={<Legal kind="privacy" />} />
              <Route path="/termini" element={<Legal kind="termini" />} />
            </Route>
            <Route path="/report/:token" element={<Report />} />
            <Route path="/preventivo/:token" element={<PreventivoPage />} />
            <Route path="/area" element={<AreaShell />}>
              <Route index element={<MyRequests />} />
              <Route path="richiesta/:id" element={<MyRequestDetail />} />
              <Route path="immobili" element={<Properties />} />
              <Route path="immobili/:id" element={<PropertyDetail />} />
              <Route path="computo" element={<ComputoNew />} />
              <Route path="profilo" element={<Profile />} />
            </Route>
            <Route path="/impresa" element={<SideLayout title="Area impresa" nav={IMPRESA_NAV} roles={['impresa']} />}>
              <Route index element={<ImpresaHome />} />
              <Route path="opportunita" element={<ImpresaOpportunities />} />
              <Route path="cantieri" element={<ImpresaSites />} />
              <Route path="listino" element={<ImpresaPrices />} />
              <Route path="profilo" element={<ImpresaProfile />} />
              <Route path="documenti" element={<ImpresaDocs />} />
              <Route path="fee" element={<ImpresaFees />} />
              <Route path="gestionale" element={<GDashboard />} />
              <Route path="clienti" element={<GClients />} />
              <Route path="clienti/:id" element={<GClient />} />
              <Route path="preventivi" element={<GQuotes />} />
              <Route path="preventivi/:id" element={<GQuoteEditor />} />
              <Route path="cantieri-gestionale" element={<GJobs />} />
              <Route path="cantieri-gestionale/:id" element={<GJob />} />
              <Route path="scadenze" element={<GDeadlines />} />
              <Route path="statistiche" element={<Stats />} />
              <Route path="team" element={<Team />} />
              <Route path="abbonamento" element={<Subscription />} />
            </Route>
            <Route path="/admin" element={<SideLayout title="Amministrazione" nav={ADMIN_NAV} roles={['admin', 'operatore']} />}>
              <Route index element={<AdminDashboard />} />
              <Route path="richieste" element={<AdminRequests />} />
              <Route path="richieste/:id" element={<AdminRequest />} />
              <Route path="contratti" element={<AdminContracts />} />
              <Route path="imprese" element={<AdminCompanies />} />
              <Route path="imprese/:id" element={<AdminCompany />} />
              <Route path="rivendicazioni" element={<AdminClaims />} />
              <Route path="prezzi-imprese" element={<AdminPrices />} />
              <Route path="rubrica" element={<AdminArtisans />} />
              <Route path="recensioni" element={<AdminReviews />} />
              <Route path="segnalazioni" element={<AdminReports />} />
              <Route path="listino" element={<AdminCatalog />} />
              <Route path="impostazioni" element={<AdminSettings />} />
              <Route path="utenti" element={<AdminUsers />} />
              <Route path="registro" element={<AdminAudit />} />
              <Route path="abbonamenti" element={<AdminSubscriptions />} />
              <Route path="prezzi-community" element={<AdminCommunity />} />
            </Route>
            <Route path="*" element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}

function NotFound() {
  return <div className="max-w-xl mx-auto px-4 py-24 text-center"><h1 className="text-3xl font-extrabold">Pagina non trovata</h1><p className="text-ink-soft mt-2">Il link potrebbe essere vecchio.</p><Link to="/" className="btn-primary mt-6">Torna alla home</Link></div>;
}
