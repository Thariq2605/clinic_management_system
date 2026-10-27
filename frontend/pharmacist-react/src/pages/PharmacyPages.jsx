import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { Badge, Empty, ErrorState, Loading } from '../components/States.jsx';
import { deleteMedicine, dispenseItem, getPharmacyData, saveMedicine } from '../services/pharmacy.js';

const today = () => new Date().toISOString().slice(0, 10);
const stockState = m => m.expiry_date && m.expiry_date < today() ? 'Expired' : Number(m.quantity) < 1 ? 'Out of Stock' : Number(m.quantity) <= 20 ? 'Low Stock' : 'Available';
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));
function useData() {
  const [data, setData] = useState({ medicines: [], items: [], prescriptions: [] }); const [state, setState] = useState('loading'); const [error, setError] = useState('');
  const reload = useCallback(async () => { setState('loading'); setError(''); try { const [medicines, items, prescriptions] = await getPharmacyData(); setData({ medicines, items, prescriptions }); setState('ready'); } catch (err) { setError(err.message); setState('error'); } }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...data, state, error, reload };
}
function DataState({ data, children }) { if (data.state === 'loading') return <Loading />; if (data.state === 'error') return <ErrorState message={data.error} retry={data.reload} />; return children; }
function PageTitle({ title, subtitle, action }) { return <div className="page-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
function Table({ columns, children }) { return <div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function groupPrescriptions(items, prescriptions) {
  const groups = new Map();
  items.forEach(item => { const id = Number(item.prescription); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(item); });
  return [...groups].map(([id, medicines]) => ({ id, items: medicines, meta: prescriptions.find(p => Number(p.prescription_id) === id), status: medicines.some(item => item.is_active) ? 'Pending' : 'Dispensed' })).sort((a, b) => b.id - a.id);
}

export function DashboardPage() {
  const data = useData();
  return <DataState data={data}><PageTitle title="Overview" subtitle="Live pharmacy data from the backend." /><div className="stats"><Stat title="Medicines" value={data.medicines.length} /><Stat title="Low stock" value={data.medicines.filter(m => stockState(m) === 'Low Stock').length} /><Stat title="Expired" value={data.medicines.filter(m => stockState(m) === 'Expired').length} /><Stat title="Pending prescriptions" value={groupPrescriptions(data.items, data.prescriptions).filter(p => p.status === 'Pending').length} /></div><div className="panel"><h3>Stock alerts</h3><MedicineTable medicines={data.medicines.filter(m => stockState(m) !== 'Available').slice(0, 8)} compact /></div><div className="notice">Recent dispensing history is unavailable: the backend does not provide a dispensing activity endpoint.</div></DataState>;
}
function Stat({ title, value }) { return <article className="stat"><span>{title}</span><strong>{value}</strong><small>Current API result</small></article>; }

function MedicineTable({ medicines, compact = false, actions }) {
  if (!medicines.length) return <Empty>No medicines to display.</Empty>;
  return <Table columns={['Name', 'Manufacturer', 'Unit price', 'Quantity', 'Expiry', 'Status', ...(!compact && actions ? ['Actions'] : [])]}>{medicines.map(m => <tr key={m.medicine_id}><td><b>{m.medicine_name}</b></td><td>{m.manufacturer}</td><td>{money(m.unit_price)}</td><td>{m.quantity}</td><td>{m.expiry_date}</td><td><Badge>{stockState(m)}</Badge></td>{!compact && actions && <td>{actions(m)}</td>}</tr>)}</Table>;
}

export function MedicinesPage() {
  const data = useData(); const [query, setQuery] = useState(''); const [editing, setEditing] = useState(null); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const medicines = data.medicines.filter(m => `${m.medicine_name} ${m.manufacturer}`.toLowerCase().includes(query.toLowerCase()));
  async function remove(m) { if (!window.confirm(`Delete ${m.medicine_name}? This cannot be undone.`)) return; try { await deleteMedicine(m.medicine_id); setMessage('Medicine deleted.'); await data.reload(); } catch (err) { setMessage(err.message); } }
  async function submit(e) { e.preventDefault(); setBusy(true); setMessage(''); const raw = Object.fromEntries(new FormData(e.currentTarget)); const fields = ['medicine_name', 'manufacturer', 'unit_price', 'quantity', 'expiry_date']; const body = Object.fromEntries(fields.map(key => [key, raw[key]])); try { await saveMedicine(editing?.medicine_id, body); setEditing(null); setMessage('Medicine saved.'); await data.reload(); } catch (err) { setMessage(err.message); } finally { setBusy(false); } }
  return <DataState data={data}><PageTitle title="Medicines" subtitle="Manage the medicine catalogue." action={<button className="button primary" onClick={() => setEditing({})}>Add medicine</button>} />{message && <div className="notice" role="status">{message}</div>}<div className="toolbar"><input aria-label="Search medicines" placeholder="Search name or manufacturer" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="panel"><MedicineTable medicines={medicines} actions={m => <span className="row-actions"><button className="button small" onClick={() => setEditing(m)}>Edit</button><button className="button small danger" onClick={() => remove(m)}>Delete</button></span>} /></div>{editing !== null && <div className="modal-backdrop"><form className="dialog" onSubmit={submit}><h3>{editing.medicine_id ? 'Edit medicine' : 'Add medicine'}</h3>{message && <div className="notice error" role="alert">{message}</div>}<label>Medicine name<input name="medicine_name" defaultValue={editing.medicine_name || ''} required maxLength="100" /></label><label>Manufacturer<input name="manufacturer" defaultValue={editing.manufacturer || ''} required maxLength="100" /></label><label>Unit price<input name="unit_price" type="number" min="0" step="0.01" defaultValue={editing.unit_price || ''} required /></label><label>Quantity<input name="quantity" type="number" step="1" defaultValue={editing.quantity ?? 0} required /></label><label>Expiry date<input name="expiry_date" type="date" defaultValue={editing.expiry_date || ''} required /></label><div className="dialog-actions"><button type="button" className="button" onClick={() => { setEditing(null); setMessage(''); }}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save medicine'}</button></div></form></div>}</DataState>;
}

export function InventoryPage() {
  const data = useData(); const [query, setQuery] = useState(''); const [filter, setFilter] = useState('');
  const filtered = data.medicines.filter(m => `${m.medicine_name} ${m.manufacturer}`.toLowerCase().includes(query.toLowerCase()) && (!filter || stockState(m) === filter));
  return <DataState data={data}><PageTitle title="Inventory" subtitle="Availability and expiry are derived from current medicine records." /><div className="toolbar"><input aria-label="Search inventory" placeholder="Search medicine or manufacturer" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter stock status" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All stock states</option>{['Available', 'Low Stock', 'Expired', 'Out of Stock'].map(s => <option key={s}>{s}</option>)}</select></div><div className="panel"><MedicineTable medicines={filtered} /></div><p className="muted">The current legacy interface uses 20 units as its low-stock threshold. No stock adjustment endpoint is available.</p></DataState>;
}

export function PrescriptionsPage() {
  const data = useData(); const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [detail, setDetail] = useState(null); const [page, setPage] = useState(1);
  const prescriptions = useMemo(() => groupPrescriptions(data.items, data.prescriptions).filter(p => (!status || p.status === status) && (!query || String(p.id).includes(query.replace('#', '')))), [data.items, data.prescriptions, query, status]);
  const pages = Math.max(1, Math.ceil(prescriptions.length / 8));
  return <DataState data={data}><PageTitle title="Prescriptions" subtitle="Prescription records are joined to their medicine items from separate API responses." /><div className="toolbar"><input placeholder="Search prescription ID" aria-label="Search prescriptions" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /><select aria-label="Filter prescription status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option>Pending</option><option>Dispensed</option></select></div><div className="panel">{prescriptions.length ? <><Table columns={['Prescription', 'Patient', 'Doctor', 'Date', 'Status', 'Items']} >{prescriptions.slice((page - 1) * 8, page * 8).map(p => <tr key={p.id}><td>#{p.id}</td><td>{p.meta?.patient_name || '—'}</td><td>{p.meta?.doctor_name || '—'}</td><td>{p.meta?.prescription_date || '—'}</td><td><Badge>{p.status}</Badge></td><td><button className="button small" onClick={() => setDetail(p)}>View details</button></td></tr>)}</Table><div className="pager"><span className="muted">{prescriptions.length} results · Page {page} of {pages}</span><span><button className="button small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> <button className="button small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></span></div></> : <Empty>No prescriptions found.</Empty>}</div>{detail && <div className="modal-backdrop"><section className="dialog wide"><div className="page-title"><h3>Prescription #{detail.id}</h3><button className="button" onClick={() => setDetail(null)}>Close</button></div><p>{detail.meta?.patient_name || 'Patient not provided'} · {detail.meta?.doctor_name || 'Doctor not provided'} · {detail.meta?.prescription_date || 'Date not provided'}</p><Table columns={['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions', 'Status']}>{detail.items.map(i => <tr key={i.item_id}><td>{i.medicine_details}</td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration} days</td><td>{i.instructions}</td><td><Badge>{i.is_active ? 'Pending' : 'Dispensed'}</Badge></td></tr>)}</Table></section></div>}</DataState>;
}

export function DispensingPage() {
  const data = useData(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [selected, setSelected] = useState(null);
  const prescriptions = groupPrescriptions(data.items, data.prescriptions).filter(p => p.status === 'Pending');
  const medicineFor = item => data.medicines.find(m => Number(m.medicine_id) === Number(item.medicine));
  async function confirmDispense() {
    if (!selected || busy) return; setBusy(true); setMessage(''); const failures = []; let succeeded = 0;
    for (const item of selected.items.filter(i => i.is_active)) {
      try { await dispenseItem(item.item_id); succeeded++; }
      catch (err) { failures.push(`${item.medicine_details}: ${err.message}`); }
    }
    setMessage(`${succeeded} item(s) dispensed.${failures.length ? ` Not dispensed: ${failures.join('; ')}` : ''}`); setSelected(null); setBusy(false); await data.reload();
  }
  return <DataState data={data}><PageTitle title="Dispensing" subtitle="Each active prescription item is dispensed through its own backend transaction." />{message && <div className="notice" role="status">{message}</div>}<div className="panel">{prescriptions.length ? <Table columns={['Prescription', 'Patient', 'Active items', 'Action']}>{prescriptions.map(p => <tr key={p.id}><td>#{p.id}</td><td>{p.meta?.patient_name || '—'}</td><td>{p.items.filter(i => i.is_active).length}</td><td><button className="button primary small" onClick={() => setSelected(p)}>Review</button></td></tr>)}</Table> : <Empty>Nothing is waiting to be dispensed.</Empty>}</div>{selected && <div className="modal-backdrop"><section className="dialog wide"><h3>Review prescription #{selected.id}</h3><p>{selected.meta?.patient_name || 'Patient not provided'} · {selected.meta?.prescription_date || 'Date not provided'}</p><Table columns={['Medicine', 'Available stock', 'Expiry', 'Dosage', 'Frequency', 'Duration', 'Status']}>{selected.items.map(i => { const m = medicineFor(i); return <tr key={i.item_id}><td>{i.medicine_details}</td><td>{m?.quantity ?? 'Unknown'}</td><td>{m?.expiry_date || 'Unknown'}</td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration} days</td><td><Badge>{!i.is_active ? 'Dispensed' : m ? stockState(m) : 'Unknown stock'}</Badge></td></tr>; })}</Table><p className="muted">The server validates availability and decrements stock once per active item. A network timeout can leave the result uncertain; inspect the refreshed prescription before retrying.</p><div className="dialog-actions"><button className="button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button><button className="button primary" disabled={busy || selected.items.filter(i => i.is_active).length === 0} onClick={confirmDispense}>{busy ? 'Dispensing…' : 'Confirm dispensing'}</button></div></section></div>}</DataState>;
}

export function ProfilePage() { const { user } = useAuth(); return <><PageTitle title="Profile" subtitle="Identity validated against the Pharmacist API." /><div className="panel profile-grid"><div><span>Name</span><b>{user?.name || '—'}</b></div><div><span>Username</span><b>{user?.username || '—'}</b></div><div><span>User ID</span><b>{user?.user_id ?? '—'}</b></div><div><span>Role</span><b>{user?.role || 'Pharmacist'}</b></div></div></>; }
export function SettingsPage() { return <><PageTitle title="Settings" subtitle="Only settings supported by the backend are available." /><div className="panel"><h3>Settings unavailable</h3><p>There are no Pharmacist profile-editing, password-change, notification-preference, or low-stock-configuration endpoints. This page does not store pretend settings.</p></div></>; }
