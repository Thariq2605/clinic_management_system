import { useState } from 'react';
import { adminApi, getErrorMessage } from '../services/api.js';

export default function DoctorProfilePanel({ row, onSaved }) {
  const [staffActive, setStaffActive] = useState(row.staff_active);
  const [values, setValues] = useState({
    full_name: row.staff_name || row.doctor_name || '',
    email: row.email || '',
    mobile_number: row.mobile_number || '',
  });
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const effectiveAccessActive = Boolean(row.is_active && staffActive && row.user_active && row.role_active);

  const update = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const saved = await adminApi.patch(`/api/admin/staff/${row.staff_id}/`, values);
      setValues({ full_name: saved.full_name, email: saved.email, mobile_number: saved.mobile_number });
      setMessage('Linked Staff identity updated.');
      onSaved?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const updateStaffStatus = async () => {
    setStatusBusy(true);
    setMessage('');
    setError('');
    try {
      await adminApi.patch(`/api/admin/staff/${row.staff_id}/`, { is_active: !staffActive });
      setStaffActive(!staffActive);
      setMessage(`Linked Staff account ${staffActive ? 'deactivated' : 'activated'}. User and Doctor status were not changed.`);
      onSaved?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setStatusBusy(false);
    }
  };

  return <div className="profile-panel">
    <dl className="profile-grid">
      <div><dt>Doctor profile</dt><dd>{row.is_active ? 'Active' : 'Inactive'}</dd></div>
      <div><dt>Effective sign in</dt><dd>{effectiveAccessActive ? 'Allowed' : 'Blocked'}</dd></div>
      <div><dt>Linked username</dt><dd>{row.username_display || 'Unavailable'}</dd></div>
      <div><dt>Staff record</dt><dd>#{row.staff_id}</dd></div>
      <div><dt>User record</dt><dd>#{row.user_id}</dd></div>
      <div><dt>Staff status</dt><dd>{staffActive ? 'Active' : 'Inactive'}</dd></div>
      <div><dt>User status</dt><dd>{row.user_active ? 'Active' : 'Inactive'}</dd></div>
      <div><dt>Role status</dt><dd>{row.role_active ? 'Active' : 'Inactive'}</dd></div>
      <div><dt>Department</dt><dd>{row.department_name}</dd></div>
      <div><dt>Specialization</dt><dd>{row.specialization_name}</dd></div>
    </dl>
    <h3>Linked Staff identity and contact</h3>
    <p>Doctor, Staff, User, and Role status are independent. Doctor login requires all four to be active. Changing one status never activates another. User status is managed on the Users page; role status is managed on Roles.</p>
    <div className="dialog-actions"><button type="button" className="button" onClick={updateStaffStatus} disabled={statusBusy}>{statusBusy ? 'Updating…' : staffActive ? 'Deactivate Staff account' : 'Activate Staff account'}</button><a className="button" href="/users">Manage User account</a><a className="button" href="/roles">Manage Doctor role</a></div>
    <p>These identity and contact fields belong to Staff. The linked User owns the username and password.</p>
    <form onSubmit={update} noValidate>
      <div className="form-grid">
        <label className="form-field" htmlFor="staff-full-name"><span>Full name</span><input id="staff-full-name" required maxLength={100} value={values.full_name} onChange={(e) => setValues({ ...values, full_name: e.target.value })} /></label>
        <label className="form-field" htmlFor="staff-email"><span>Email</span><input id="staff-email" type="email" required maxLength={100} value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
        <label className="form-field" htmlFor="staff-mobile"><span>Phone number</span><input id="staff-mobile" type="tel" required maxLength={10} pattern="[6-9][0-9]{9}" value={values.mobile_number} onChange={(e) => setValues({ ...values, mobile_number: e.target.value })} /></label>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}
      <div className="dialog-actions"><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save Staff contact'}</button></div>
    </form>
  </div>;
}
