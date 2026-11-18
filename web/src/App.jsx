import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AppProvider, ToastProvider, useApp, Logo, Spinner } from './ui.jsx';

import Home from './pages/public/Home.jsx';
import Wizard from './pages/public/Wizard.jsx';
import RequestStatus from './pages/public/RequestStatus.jsx';
import { Directory, CompanyPage } from './pages/public/Companies.jsx';
import { PricesList, PricePage } from './pages/public/Prices.jsx';
import { RatingPage, ForCompanies, ClaimPage, JoinPage, AgenciesLanding, BigLanding, Legal } from './pages/public/Info.jsx';
import VoicePage from './pages/public/Voice.jsx';
import { Login, Register } from './pages/public/Auth.jsx';
import Report from './pages/public/Report.jsx';

import { MyRequests, MyRequestDetail, Properties, PropertyDetail, ComputoNew, Profile } from './pages/area/Area.jsx';
import { ImpresaHome, ImpresaProfile, ImpresaPrices, ImpresaOpportunities, ImpresaSites, ImpresaDocs, ImpresaFees } from './pages/impresa/Impresa.jsx';
import { AdminDashboard, AdminRequests, AdminRequest } from './pages/admin/AdminRequests.jsx';
import { AdminCompanies, AdminCompany, AdminPrices, AdminClaims } from './pages/admin/AdminCompanies.jsx';
import { AdminCatalog, AdminSettings } from './pages/admin/AdminCatalog.jsx';
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
  const links = [['/quota', 'Calcola il prezzo'], ['/imprese', 'Imprese'], ['/prezzi', 'Prezzi'], ['/rating', 'Il rating'], ['/agenzie', 'Agenzie e investitori'], ['/grandi-operazioni', 'Grandi operazioni'], ['/per-le-imprese', 'Per le imprese']];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
          <Link to="/" aria-label="EdilMen, home"><Logo /></Link>
          <nav className="hidden lg:flex items-center gap-1 text-sm">
            {links.slice(1).map(([to, l]) => <NavLink key={to} to={to} className={({ isActive }) => `px-3 py-2 rounded-lg font-medium ${isActive ? 'text-brand' : 'text-ink-soft hover:text-ink'}`}>{l}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to={homeFor(user)} className="hidden sm:inline-flex btn-ghost">{user ? 'La mia area' : 'Accedi'}</Link>
            <Link to="/quota" className="btn-primary">Calcola il prezzo</Link>
            <button className="lg:hidden btn-ghost px-3" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden border-t border-line bg-white px-4 py-3 grid gap-1" onClick={() => setOpen(false)}>
            {links.map(([to, l]) => <Link key={to} to={to} className="py-2 font-medium">{l}</Link>)}
            <Link to={homeFor(user)} className="py-2 font-semibold text-brand">{user ? 'La mia area' : 'Accedi'}</Link>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-navy text-white/80 mt-16 no-print">
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-4 text-sm">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-3 text-white/60">Il digital contractor: definiamo il lavoro, mettiamo in gara imprese verificate e seguiamo il cantiere fino all'ultimo SAL.</p>
        </div>
        <div>
          <div className="font-semibold text-white mb-3">Per chi deve costruire</div>
          <ul className="space-y-2">
            <li><Link to="/quota">Calcola il prezzo</Link></li><li><Link to="/prezzi">Prezzi dei lavori</Link></li>
            <li><Link to="/imprese">Elenco imprese</Link></li><li><Link to="/vocale">Mandaci un vocale</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white mb-3">Professionisti</div>
          <ul className="space-y-2">
            <li><Link to="/agenzie">Agenzie immobiliari e investitori</Link></li><li><Link to="/grandi-operazioni">Grandi operazioni e condomini</Link></li>
            <li><Link to="/per-le-imprese">Imprese e artigiani</Link></li><li><Link to="/rivendica">Rivendica la scheda</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white mb-3">Trasparenza</div>
          <ul className="space-y-2">
            <li><Link to="/rating">Come calcoliamo il rating</Link></li><li><Link to="/privacy">Privacy</Link></li><li><Link to="/termini">Termini</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 text-xs text-white/50">
        <div className="max-w-7xl mx-auto px-4 py-4">EdilMen è un servizio di European Management Institute S.r.l. · Trento</div>
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
        <div className="p-4 sm:p-8 max-w-7xl"><Outlet /></div>
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
  { section: 'Regole' },
  { to: '/admin/listino', label: 'Listino EdilMen' },
  { to: '/admin/impostazioni', label: 'Fee, piani e matching' },
  { to: '/admin/utenti', label: 'Utenti' },
  { to: '/admin/registro', label: 'Registro attività' },
];
const IMPRESA_NAV = [
  { to: '/impresa', label: 'Panoramica', end: true },
  { to: '/impresa/opportunita', label: 'Opportunità' },
  { to: '/impresa/cantieri', label: 'Cantieri e SAL' },
  { to: '/impresa/listino', label: 'Il mio listino' },
  { to: '/impresa/profilo', label: 'Profilo pubblico' },
  { to: '/impresa/documenti', label: 'Documenti' },
  { to: '/impresa/fee', label: 'Fee EdilMen' },
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
              <Route path="/accedi" element={<Login />} />
              <Route path="/registrati" element={<Register />} />
              <Route path="/privacy" element={<Legal kind="privacy" />} />
              <Route path="/termini" element={<Legal kind="termini" />} />
            </Route>
            <Route path="/report/:token" element={<Report />} />
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
