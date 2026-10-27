import { useState } from 'react';
import { adminApi } from '../services/api.js';
import { ErrorState, Loading } from '../components/Feedback.jsx';

const today = new Date();
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const since = new Date(today); since.setDate(today.getDate() - 30);
const amount = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReportsPage() {
  const [start, setStart] = useState(iso(since)), [end, setEnd] = useState(iso(today)), [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(false), [formError, setFormError] = useState('');
  const generate = async (e) => { e.preventDefault(); setFormError(''); if (!start || !end || start > end) { setFormError('Choose a valid date range with the start date on or before the end date.'); return; } setLoading(true); setError(null); setData(null); try { setData(await adminApi.get('/api/admin/reports/', { start_date: start, end_date: end })); } catch (err) { setError(err); } finally { setLoading(false); } };
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">ANALYTICS</span><h1>Reports</h1><p>Generate reports from clinic records for a selected date range.</p></div></div>
    <form className="panel report-filter" onSubmit={generate}><label className="form-field"><span>Start date</span><input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} required /></label><label className="form-field"><span>End date</span><input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required /></label><button className="button primary" disabled={loading}>{loading ? 'Generating…' : 'Generate report'}</button>{formError && <p className="form-error wide">{formError}</p>}</form>
    {loading && <div className="panel"><Loading label="Retrieving report data…" /></div>}{error && <ErrorState error={error} onRetry={generate} />}
    {data && <><div className="report-meta">Report period: <strong>{data.date_range?.start_date || '—'} to {data.date_range?.end_date || '—'}</strong></div><div className="report-grid">
      <ReportGroup title="Appointments" items={[["Total", data.appointments?.total], ["Completed", data.appointments?.completed], ["Scheduled", data.appointments?.scheduled], ["Cancelled", data.appointments?.cancelled]]} />
      <ReportGroup title="Financial (amounts as returned by API)" items={[["Total billed", amount(data.financial?.total_billed)], ["Collected", amount(data.financial?.total_collected)], ["Pending", amount(data.financial?.total_pending)]]} />
      <ReportGroup title="Patients" items={[["Active patients", data.patients?.total]]} /><ReportGroup title="Medicines" items={[["Active medicines", data.medicines?.total], ["Low stock", data.medicines?.low_stock], ["Expired", data.medicines?.expired], ["Inventory value", amount(data.medicines?.inventory_value)]]} />
      <ReportGroup title="Laboratory" items={[["Active tests", data.lab?.total_tests], ["Orders", data.lab?.total_orders], ["Completed orders", data.lab?.completed_orders]]} />
      <section className="panel"><div className="panel-heading"><h2>Patient gender</h2></div>{data.patients?.gender_stats?.length ? <ul className="key-value-list">{data.patients.gender_stats.map((x) => <li key={x.gender}><span>{x.gender || 'Not specified'}</span><strong>{x.count}</strong></li>)}</ul> : <p className="muted">No gender statistics returned.</p>}</section>
      <section className="panel span-two"><div className="panel-heading"><h2>Department performance</h2></div>{data.department_performance?.length ? <div className="table-wrap"><table><thead><tr><th>Department</th><th>Appointments</th></tr></thead><tbody>{data.department_performance.map((d) => <tr key={d.department}><td>{d.department}</td><td>{d.appointments}</td></tr>)}</tbody></table></div> : <p className="muted">No department performance data returned.</p>}</section>
    </div></>}
    {!loading && !error && !data && <div className="panel empty-state"><span className="empty-icon">▥</span><strong>Choose a date range and generate a report.</strong></div>}
  </section>;
}
function ReportGroup({ title, items }) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2></div><ul className="key-value-list">{items.map(([label, value]) => <li key={label}><span>{label}</span><strong>{value ?? '—'}</strong></li>)}</ul></section>; }
