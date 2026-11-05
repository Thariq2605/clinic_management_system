import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';

const nav = [['/', 'Overview'], ['/prescriptions', 'Prescriptions'], ['/medicines', 'Medicines'], ['/inventory', 'Inventory'], ['/dispensing', 'Dispensing'], ['/profile', 'Profile'], ['/settings', 'Settings']];
export default function AppLayout() {
  const { user, logout } = useAuth();
  return <div className="shell"><aside className="sidebar"><a className="brand" href="/">MEDICARE <small>PHARMACY</small></a><nav>{nav.map(([to, label]) => <NavLink end={to === '/'} key={to} to={to}>{label}</NavLink>)}</nav><button className="logout" onClick={logout}>Sign out</button></aside><div className="workspace"><header className="topbar"><div><span className="eyebrow">CLINIC MANAGEMENT</span><h1>Pharmacy</h1></div><div className="user-chip"><span className="avatar">{(user?.name || 'P')[0].toUpperCase()}</span><span><b>{user?.name || user?.username}</b><small>Pharmacist</small></span></div></header><main className="page"><Outlet /></main></div></div>;
}
