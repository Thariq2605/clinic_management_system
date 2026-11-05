import { useState } from 'react';

const empty = { full_name: '', dob: '', gender: '', mobile_number: '', email: '', address: '', blood_group: '', emergency_contact: '' };
export default function PatientForm({ initial = empty, onSubmit, onCancel, saving = false, submitLabel = 'Save patient' }) {
  const [form, setForm] = useState({ ...empty, ...initial, dob: initial.dob || '' });
  const [errors, setErrors] = useState({});
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (form.full_name.trim().length < 2 || !/^[a-zA-Z\s.'-]+$/.test(form.full_name.trim())) next.full_name = 'Enter a valid name.';
    if (!form.dob) next.dob = 'Date of birth is required.';
    if (!/^[0-9]{10}$/.test(form.mobile_number)) next.mobile_number = 'Use exactly 10 digits.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email.';
    if (!form.address.trim()) next.address = 'Address is required.';
    if (!form.gender) next.gender = 'Select a gender.';
    if (!form.blood_group) next.blood_group = 'Select a blood group.';
    if (!/^[0-9]{10}$/.test(form.emergency_contact)) next.emergency_contact = 'Use exactly 10 digits.';
    setErrors(next);
    if (!Object.keys(next).length) await onSubmit({ ...form, full_name: form.full_name.trim(), address: form.address.trim(), email: form.email.trim(), mobile_number: form.mobile_number.trim(), emergency_contact: form.emergency_contact.trim() });
  }
  const field = (name, label, type = 'text', required = false, options = null) => <label className="field" key={name}><span>{label}{required && <b> *</b>}</span>{options ? <select name={name} value={form[name]} onChange={change} required={required}><option value="">Choose {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input name={name} type={type} value={form[name]} onChange={change} required={required} max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined} />}{errors[name] && <small className="field-error">{errors[name]}</small>}</label>;
  return <form onSubmit={submit} noValidate><div className="form-grid">{field('full_name', 'Full name', 'text', true)}{field('dob', 'Date of birth', 'date', true)}{field('gender', 'Gender', 'select', true, ['Male', 'Female', 'Other'])}{field('mobile_number', 'Mobile number', 'tel', true)}{field('email', 'Email address', 'email', true)}{field('blood_group', 'Blood group', 'select', true, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])}{field('emergency_contact', 'Emergency contact', 'tel', true)}{field('address', 'Residential address', 'text', true)}</div><div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button></div></form>;
}
