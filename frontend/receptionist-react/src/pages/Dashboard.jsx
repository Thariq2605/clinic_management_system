import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRequest } from '../hooks/useRequest';
import { appointmentService } from '../services/appointmentService';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';

const dateKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const time = (value) => value ? new Date(`1970-01-01T${value}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
export default function Dashboard() {
  const { user } = useAuth(); const load = useCallback(() => appointmentService.list({ date: dateKey() }), []); const { data, loading, error, reload } = useRequest(load, []); const appointments = Array.isArray(data) ? data : [];
  const columns = [{ key: 'token_number', label: 'Token', render: (r) => <strong className="token-badge-mini token-cell">#{r.token_number || '—'}</strong> }, { key: 'patient_name', label: 'Patient', render: (r) => <Link to={`/patients/${r.patient}`}>{r.patient_name || `Patient #${r.patient}`}</Link> }, { key: 'doctor_name', label: 'Doctor' }, { key: 'appointment_time', label: 'Time', render: (r) => time(r.appointment_time) }, { key: 'status', label: 'Visit', render: (r) => <StatusBadge value={r.status} /> }, { key: 'payment_status', label: 'Payment', render: (r) => <StatusBadge value={r.payment_status} /> }, { key: 'open', label: '', render: (r) => <Link className="table-action" to={`/appointments/${r.appointment_id}`}>Details →</Link> }];
  return <><PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${(user?.name || 'Receptionist').split(' ')[0]}`} description={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} action={<button className="button button-secondary" onClick={reload}>↻ <span className="button-text">Refresh</span></button>} /><div className="quick-actions"><Link className="button button-soft" to="/patients?new=1">＋ Register patient</Link><Link className="button button-primary" to="/appointments/new">＋ Book appointment</Link></div>
    {loading ? <Loading label="Loading today’s schedule…" /> : error ? <ErrorState message={error} onRetry={reload} /> : <>
      <div className="stat-grid"><article className="stat-card"><span className="stat-symbol blue">▦</span><div><small>TODAY’S APPOINTMENTS</small><strong>{appointments.length}</strong></div><span className="stat-foot">Scheduled for today</span></article><article className="stat-card"><span className="stat-symbol amber">◷</span><div><small>UPCOMING</small><strong>{appointments.filter((a) => ['scheduled', 'confirmed'].includes((a.status || '').toLowerCase())).length}</strong></div><span className="stat-foot">Scheduled or confirmed</span></article><article className="stat-card"><span className="stat-symbol green">✓</span><div><small>COMPLETED</small><strong>{appointments.filter((a) => (a.status || '').toLowerCase() === 'completed').length}</strong></div><span className="stat-foot">Visits completed today</span></article><article className="stat-card"><span className="stat-symbol teal">₹</span><div><small>PAID VISITS</small><strong>{appointments.filter((a) => (a.payment_status || '').toLowerCase() === 'paid').length}</strong></div><span className="stat-foot">Payments completed</span></article></div>
      <section className="panel"><div className="panel-heading"><div><h2>Today’s schedule</h2><p>Appointments linked to your reception account</p></div><Link to="/appointments" className="table-action">All appointments →</Link></div><DataTable columns={columns} rows={appointments} rowKey="appointment_id" empty="No appointments scheduled for today." /></section>
    </>}</>;
}
