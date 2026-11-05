const apiBase = (import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export const LOGIN_ORIGIN = window.location.origin;
const targets = {
  administrator: { port: '5502', appRole: 'admin' },
  admin: { port: '5502', appRole: 'admin' },
  pharmacist: { port: '5503', appRole: 'pharmacist' },
  receptionist: { port: '5500', appRole: 'receptionist' },
  doctor: { port: '5501', appRole: 'doctor' },
  lab_technician: { port: '5505', appRole: 'lab_technician' },
};

export class LoginError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

async function jsonResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail || data?.error || data?.message;
    if (typeof detail === 'string') throw new LoginError(detail, response.status);
    const fields = data && typeof data === 'object' ? Object.entries(data).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : String(val)}`).join(' · ') : '';
    throw new LoginError(fields || `Sign-in failed (${response.status}).`, response.status);
  }
  if (!data || typeof data !== 'object') throw new LoginError('The server returned an invalid sign-in response.');
  return data;
}

export async function signIn(username, password) {
  let csrfResponse;
  try {
    csrfResponse = await fetch(`${apiBase}/api/csrf/`, { credentials: 'include', headers: { Accept: 'application/json' } });
  } catch { throw new LoginError(`Cannot connect to Django at ${apiBase}. Check the backend and API URL.`); }
  const csrf = await jsonResponse(csrfResponse);
  if (typeof csrf.csrfToken !== 'string' || !csrf.csrfToken) throw new LoginError('The server did not provide a CSRF token.');

  let loginResponse;
  try {
    loginResponse = await fetch(`${apiBase}/api/login/`, {
      method: 'POST', credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrf.csrfToken },
      body: JSON.stringify({ username, password }),
    });
  } catch { throw new LoginError(`Cannot connect to Django at ${apiBase}. Check the backend and API URL.`); }
  const data = await jsonResponse(loginResponse);
  const role = String(data.role || '').trim().toLowerCase();
  const target = targets[role];
  if (!target) throw new LoginError('This account has an unsupported role.');

  let payload;
  if (target.appRole === 'admin') {
    if (!data.token || !data.user || String(data.user.role).toLowerCase() !== 'administrator') throw new LoginError('The server returned an incomplete administrator login.');
    payload = { token: data.token };
  } else if (target.appRole === 'doctor') {
    if (!data.access || !data.refresh || !data.doctor_id || !data.user_id) throw new LoginError('The server returned an incomplete Doctor login.');
    payload = { access: data.access, refresh: data.refresh, doctor_id: data.doctor_id, doctor_name: data.doctor_name, user_id: data.user_id, username: data.username };
  } else if (target.appRole === 'receptionist') {
    if (!data.user_id || !data.receptionist_id) throw new LoginError('The server returned an incomplete Receptionist session.');
    payload = { user_id: data.user_id, receptionist_id: data.receptionist_id, name: data.name || 'Receptionist' };
  } else if (target.appRole === 'pharmacist') {
    // The shared login confirms the role; its legacy Pharmacist contract does
    // not issue a JWT, so obtain the Pharmacist app's own server-issued token.
    let pharmacistResponse;
    try {
      pharmacistResponse = await fetch(`${apiBase}/pharmacist/login/`, {
        method: 'POST', credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch { throw new LoginError(`Cannot connect to Django at ${apiBase}. Check the backend and API URL.`); }
    const pharmacist = await jsonResponse(pharmacistResponse);
    if (!pharmacist.access || String(pharmacist.role).toLowerCase() !== 'pharmacist') throw new LoginError('The server returned an incomplete Pharmacist login.');
    payload = { access: pharmacist.access };
  } else {
    if (!data.access || !data.refresh || !data.technician_id || !data.user_id) throw new LoginError('The server returned an incomplete Laboratory Technician login.');
    payload = { access: data.access, refresh: data.refresh, technician_id: data.technician_id, user_id: data.user_id, username: data.username, name: data.name };
  }
  return { role: target.appRole, port: target.port, apiBase, payload };
}

export function getTrustedTarget(port) {
  const url = new URL(window.location.origin);
  url.port = port;
  return url.origin;
}
