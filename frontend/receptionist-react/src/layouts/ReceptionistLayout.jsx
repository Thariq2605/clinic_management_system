import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resolveSharedLoginUrl } from '../services/sharedLogin.js';

const items = [
  ['/', 'Overview', '◫'], ['/patients', 'Patients', '♧'], ['/appointments', 'Appointments', '▦'],
  ['/queue', 'Token queue', '☷'], ['/billing', 'Billing', '▤'], ['/doctors', 'Doctors', '✚'],
  ['/lab-assignment', 'Lab assignment', 'L'],
];
export default function ReceptionistLayout() {
  const { user, signOut } = useAuth(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  async function logout() { if (!window.confirm('Sign out of the receptionist session?')) return; setBusy(true); try { await signOut(); } finally { window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); } }
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Receptionist';
  return <div className="app-shell">
    {open && <button className="mobile-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src="/assets/logo-white.svg" alt="MEDICARE" /><span>CARE OPERATIONS</span></div>
      <div className="nav-caption">WORKSPACE</div><nav>{items.map(([to, label, icon]) => <NavLink end={to === '/'} key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="support-card"><div className="support-mark">+</div><div><strong>Need assistance?</strong><small>Contact clinic support</small></div></div><button className="nav-link logout-link" onClick={logout} disabled={busy}><span className="nav-icon">↪</span>{busy ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <section className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Open navigation">☰</button><div className="topbar-context"><span>CLINIC WORKSPACE</span><strong>Reception desk</strong></div><div className="topbar-right"><span className="live-indicator">Clinic operations</span><div className="user-chip"><div className="avatar">{firstName.slice(0, 1).toUpperCase()}</div><div><strong>{user?.name || 'Receptionist'}</strong><small>Receptionist</small></div></div></div></header><main className="main-area"><Outlet /></main><footer className="app-footer">MEDICARE <span>·</span> Reception operations</footer></section>
  </div>;
}
