import { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import { appointmentService } from '../services/appointmentService';

export default function LabAssignment() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [technician, setTechnician] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setError('');
    try { setData(await appointmentService.labRequests()); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  async function assign(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await appointmentService.assignLabRequests({
        prescription_lab_test_ids: selected,
        technician_id: Number(technician),
        priority,
      });
      setSelected([]); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (!data && !error) return <Loading label="Loading laboratory requests..." />;
  return <><PageHeader title="Laboratory assignment" description="Assign requested tests to an active laboratory technician." />
    {error && <ErrorState message={error} onRetry={load} />}
    {data && <form className="panel" onSubmit={assign}>
      <div className="panel-heading"><div><h2>Unassigned requests</h2><p>Selected requests must belong to one patient appointment.</p></div></div>
      {!data.requests.length && <p className="muted-copy">No unassigned laboratory requests.</p>}
      {data.requests.map(row => <label className="field" key={row.request_id}>
        <span><input type="checkbox" checked={selected.includes(row.request_id)} onChange={event => setSelected(current => event.target.checked ? [...current, row.request_id] : current.filter(id => id !== row.request_id))} />
          #{row.request_id} · {row.patient_name} · {row.test_name} · appointment #{row.appointment_id} · Dr. {row.doctor_name}</span>
      </label>)}
      <label className="field"><span>Technician</span><select required value={technician} onChange={event => setTechnician(event.target.value)}><option value="">Choose technician</option>{data.technicians.map(row => <option key={row.technician_id} value={row.technician_id}>{row.name}</option>)}</select></label>
      <label className="field"><span>Priority</span><select required value={priority} onChange={event => setPriority(event.target.value)}><option value="">Choose priority</option><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>
      <button className="button button-primary" disabled={busy || !selected.length || !technician || !priority}>{busy ? 'Assigning...' : 'Assign selected requests'}</button>
    </form>}
  </>;
}
