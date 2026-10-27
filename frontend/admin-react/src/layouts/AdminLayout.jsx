import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../app/AuthContext.jsx';

const groups = [
  { label: 'Schedules', links: [['/doctor-availability', 'Doctor availability', 'S']] },
  { label: 'Overview', links: [['/', 'Dashboard', '◫']] },
  { label: 'People', links: [['/users', 'Users', '♙'], ['/roles', 'Roles', '♧'], ['/doctors', 'Doctors', '✚'], ['/receptionists', 'Receptionists', '♧'], ['/patients', 'Patients', '♡']] },
  { label: 'Clinic setup', links: [['/departments', 'Departments', '▦'], ['/specializations', 'Specializations', '✧'], ['/medicines', 'Medicines', '＋'], ['/lab-tests', 'Lab tests', '⌁']] },
  { label: 'Operations', links: [['/appointments', 'Appointments', '▣'], ['/billing', 'Billing', '▤'], ['/payments', 'Payments', '◈']] },
  { label: 'Insights', links: [['/reports', 'Reports', '▥'], ['/settings', 'Settings', '⚙']] },
];

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  return <div className="app-shell">
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">+</div><div><strong>CLINIC SYSTEM</strong><small>ADMINISTRATION</small></div></div>
      <nav aria-label="Main navigation">{groups.map((g) => <div className="nav-group" key={g.label}><span className="nav-label">{g.label}</span>{g.links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</div>)}</nav>
      <div className="sidebar-footer"><span className="online-dot"/> Administrator access verified</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation">☰</button><div className="breadcrumb">Clinic management <span>/</span> Administration</div><div className="header-actions"><div className="user-pill"><span className="avatar">{(user?.full_name || user?.username || 'A').slice(0, 1).toUpperCase()}</span><div><strong>{user?.full_name || user?.username || 'Administrator'}</strong><small>{user?.role || 'Administrator'}</small></div></div><button className="button signout" onClick={logout}>Sign out</button></div></header>
      <main className="main-content"><Outlet /></main>
    </div>
  </div>;
}
