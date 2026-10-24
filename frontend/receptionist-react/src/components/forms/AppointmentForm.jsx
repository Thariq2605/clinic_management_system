import { useEffect, useState } from 'react';
import { appointmentService } from '../../services/appointmentService';
import { patientService } from '../../services/patientService';
import Loading from '../common/Loading';

const toDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => toDateInput(new Date());
const shiftDate = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return toDateInput(date); };
export default function AppointmentForm({ onSubmit, onCancel, saving = false }) {
  const [departments, setDepartments] = useState([]); const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]); const [patientSearch, setPatientSearch] = useState('');
  const [form, setForm] = useState({ patient_id: '', department_id: '', doctor_id: '', appointment_date: '', appointment_time: '', appointment_type: 'pre_booking', reason: 'Regular consultation' });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { appointmentService.departments().then(setDepartments).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!form.department_id) { setDoctors([]); return; } appointmentService.doctors(form.department_id).then(setDoctors).catch((err) => setError(err.message)); }, [form.department_id]);
  useEffect(() => { let active = true; const timer = setTimeout(() => { if (patientSearch.trim().length >= 1) patientService.search(patientSearch.trim()).then((rows) => active && setPatients(rows)).catch((err) => active && setError(err.message)); else setPatients([]); }, 250); return () => { active = false; clearTimeout(timer); }; }, [patientSearch]);
  function change(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value, ...(event.target.name === 'department_id' ? { doctor_id: '' } : {}) })); }
  async function submit(event) { event.preventDefault(); setError(''); if (!form.patient_id || !form.department_id || !form.doctor_id || !form.appointment_date || !form.appointment_time) { setError('Complete all required fields.'); return; } try { await onSubmit({ ...form, patient_id: Number(form.patient_id), department_id: Number(form.department_id), doctor_id: Number(form.doctor_id) }); } catch (err) { setError(err.message); } }
  if (loading) return <Loading label="Loading departments…" />;
  return <form onSubmit={submit}><div className="form-grid">
    <label className="field field-full"><span>Find patient *</span><input value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setForm((f) => ({ ...f, patient_id: '' })); }} placeholder="Search by name, phone, email or ID" required={!form.patient_id} /><select value={form.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))} required><option value="">Choose a matching patient</option>{patients.map((p) => <option key={p.patient_id} value={p.patient_id}>#{p.patient_id} · {p.full_name} · {p.mobile_number}</option>)}</select><small>Patients must be registered and active before booking.</small></label>
    <label className="field"><span>Department *</span><select name="department_id" value={form.department_id} onChange={change} required><option value="">Choose department</option>{departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}</select></label>
    <label className="field"><span>Doctor *</span><select name="doctor_id" value={form.doctor_id} onChange={change} required disabled={!form.department_id}><option value="">Choose doctor</option>{doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{d.doctor_name} · {d.working_hours_display} · ₹{d.consultation_fee}</option>)}</select></label>
    <label className="field"><span>Appointment type *</span><select name="appointment_type" value={form.appointment_type} onChange={change}><option value="pre_booking">Pre-booking</option><option value="walk_in">Walk-in</option></select></label>
    <label className="field"><span>Appointment date *</span><input type="date" name="appointment_date" min={form.appointment_type === 'walk_in' ? today() : shiftDate(1)} max={form.appointment_type === 'walk_in' ? today() : shiftDate(10)} value={form.appointment_date} onChange={change} required /></label>
    <label className="field"><span>Appointment time *</span><input type="time" name="appointment_time" value={form.appointment_time} onChange={change} required /></label>
    <label className="field field-full"><span>Reason</span><input name="reason" maxLength="255" value={form.reason} onChange={change} /></label>
  </div>{error && <div className="inline-error">{error}</div>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Booking…' : 'Book appointment'}</button></div></form>;
}
