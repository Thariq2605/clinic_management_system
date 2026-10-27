import { useEffect, useState } from 'react';
import { adminApi } from '../services/api.js';
import { ErrorState, Loading } from '../components/Feedback.jsx';

export default function PatientProfilePanel({ id }) {
  const [data, setData] = useState(null), [error, setError] = useState(null);
  useEffect(() => { let live = true; adminApi.get(`/api/admin/patients/${id}/profile/`).then((value) => live && setData(value)).catch((e) => live && setError(e)); return () => { live = false; }; }, [id]);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading patient profile…" />;
  const p = data.patient;
  return <div className="profile-panel"><div className="profile-summary"><span className="avatar large">{p.full_name?.slice(0, 1)}</span><div><h3>{p.full_name}</h3><span>Patient #{p.patient_id} · {p.age ?? 'Age unavailable'}</span></div></div>
    <div className="profile-grid">{[['Mobile', p.mobile_number], ['Email', p.email], ['Gender', p.gender], ['Blood group', p.blood_group], ['Date of birth', p.dob], ['Address', p.address]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div>
    <h3 className="section-title">Appointments <span>{data.appointments?.length || 0}</span></h3>{data.appointments?.length ? <ul className="detail-list">{data.appointments.map((a) => <li key={a.appointment_id}>#{a.appointment_id} · {a.appointment_date} · {a.doctor_name} · {a.status}</li>)}</ul> : <p className="muted">No appointment records.</p>}
    <h3 className="section-title">Prescriptions <span>{data.prescriptions?.length || 0}</span></h3>{data.prescriptions?.length ? <ul className="detail-list">{data.prescriptions.map((x) => <li key={x.prescription_id}>#{x.prescription_id} · {x.date} · {x.doctor_name} · {x.items?.length || 0} medicine items</li>)}</ul> : <p className="muted">No prescription records.</p>}
    <h3 className="section-title">Medical records <span>{data.medical_records?.length || 0}</span></h3>{data.medical_records?.length ? <ul className="detail-list">{data.medical_records.map((r) => <li key={r.record_id}>#{r.record_id} · {r.date} · {r.diagnosis}</li>)}</ul> : <p className="muted">No medical records.</p>}
    <h3 className="section-title">Bills <span>{data.bills?.length || 0}</span></h3>{data.bills?.length ? <ul className="detail-list">{data.bills.map((b) => <li key={b.bill_id}>BILL-{String(b.bill_id).padStart(4, '0')} · {b.bill_date} · {b.total_amount} · {b.payment_status}</li>)}</ul> : <p className="muted">No bills.</p>}
  </div>;
}
