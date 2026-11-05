import { useCallback, useEffect, useState } from 'react';
import { clearTechnicianAuth } from './auth.js';
import { resolveSharedLoginUrl } from './sharedLogin.js';

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const loginUrl = resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV);
const tokenKey = 'lab_technician_access_token';

async function request(path, token, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.detail || data?.error || data?.result || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [orders, setOrders] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState({});
  const technicianName = localStorage.getItem('lab_technician_name') || 'Laboratory Technician';

  const loadOrders = useCallback(async () => {
    if (!token) { setStatus('anonymous'); return; }
    setStatus('loading'); setError('');
    try {
      const data = await request('/api/lab-technician/orders/', token);
      const rows = Array.isArray(data) ? data : [];
      setOrders(rows);
      setDrafts(Object.fromEntries(rows.map(row => [row.item_id, row.result || ''])));
      setStatus('ready');
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        clearTechnicianAuth(localStorage); setToken(null); window.location.replace(loginUrl);
      } else { setError(err.message); setStatus('error'); }
    }
  }, [token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function saveResult(itemId) {
    const value = String(drafts[itemId] || '').trim();
    if (!value) { setError('Enter a text result before saving.'); return; }
    setSaving(current => ({ ...current, [itemId]: true })); setError('');
    try {
      const updated = await request(`/api/lab-technician/items/${itemId}/result/`, token, {
        method: 'PATCH', body: JSON.stringify({ result: value }),
      });
      setOrders(current => current.map(row => row.item_id === itemId ? updated : row));
      setDrafts(current => ({ ...current, [itemId]: updated.result }));
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        clearTechnicianAuth(localStorage); setToken(null); window.location.replace(loginUrl);
      } else { setError(err.message); }
    }
    finally { setSaving(current => ({ ...current, [itemId]: false })); }
  }

  function logout() {
    clearTechnicianAuth(localStorage);
    setToken(null);
    setStatus('anonymous');
    window.location.replace(loginUrl);
  }

  if (status === 'anonymous') return <main className="auth-state"><section className="empty-card"><span className="brand-mark">MC</span><p className="eyebrow">LABORATORY WORKSPACE</p><h1>Sign in to continue</h1><p>Use the clinic shared login to access laboratory orders assigned to your account.</p><a className="button primary" href={loginUrl}>Open clinic login</a></section></main>;

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Laboratory workspace home"><span className="brand-mark">MC</span><span>MEDICARE <small>LABORATORY</small></span></a><div className="user-menu"><span>{technicianName}</span><button className="button subtle" onClick={logout}>Sign out</button></div></header>
    <section className="page-heading"><div><p className="eyebrow">ASSIGNED WORK</p><h1>Laboratory orders</h1><p>Review your assigned tests and enter one text result for each test item.</p></div><button className="button subtle" onClick={loadOrders} disabled={status === 'loading'}>Refresh</button></section>
    {error && <div className="alert" role="alert">{error}</div>}
    {status === 'loading' && <section className="empty-card">Loading assigned orders…</section>}
    {status === 'error' && <section className="empty-card"><h2>Could not load orders</h2><p>{error}</p><button className="button primary" onClick={loadOrders}>Try again</button></section>}
    {status === 'ready' && !orders.length && <section className="empty-card"><h2>No assigned laboratory tests</h2><p>New work assigned by the clinic team will appear here.</p></section>}
    {status === 'ready' && orders.length > 0 && <section className="order-list" aria-label="Assigned laboratory test items">{orders.map(row => <article className="order-card" key={row.item_id}>
      <div className="order-summary"><div><p className="eyebrow">ORDER #{row.order_id} · ITEM #{row.item_id}</p><h2>{row.test_name}</h2></div><span className={`status ${row.status}`}>{row.status}</span></div>
      <dl className="patient-details"><div><dt>Patient</dt><dd>{row.patient_name} <small>#{row.patient_id}</small></dd></div><div><dt>Appointment</dt><dd>#{row.appointment_id}</dd></div><div><dt>Doctor</dt><dd>#{row.doctor_id}</dd></div></dl>
      <label className="result-label" htmlFor={`result-${row.item_id}`}>Text result</label><textarea id={`result-${row.item_id}`} value={drafts[row.item_id] ?? ''} maxLength={10000} rows={4} onChange={event => setDrafts(current => ({ ...current, [row.item_id]: event.target.value }))} placeholder="Enter the laboratory result" />
      <div className="card-footer"><span>{drafts[row.item_id]?.trim().length || 0}/10000 characters</span><button className="button primary" onClick={() => saveResult(row.item_id)} disabled={saving[row.item_id] || !drafts[row.item_id]?.trim()}>{saving[row.item_id] ? 'Saving…' : row.result ? 'Update result' : 'Save result'}</button></div>
    </article>)}</section>}
    <footer className="page-footer">Results can be saved only for laboratory items assigned to your account.</footer>
  </main>;
}
