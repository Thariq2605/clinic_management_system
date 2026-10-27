const loginOrigins = new Set(['http://127.0.0.1:5504', 'http://localhost:5504']);
const apiBaseDefault = 'http://127.0.0.1:8000';
const role = new URLSearchParams(window.location.search).get('role');
const status = document.getElementById('handoff-status');
const roleNames = { admin: 'Administrator', pharmacist: 'Pharmacist', receptionist: 'Receptionist', doctor: 'Doctor' };

function show(message, failed = false) {
  status.textContent = message;
  status.classList.toggle('failed', failed);
}

async function getJson(url, { headers = {}, credentials = 'omit' } = {}) {
  let response;
  try { response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, credentials }); }
  catch { throw new Error('Could not reach the clinic server to validate your role.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || data?.error || 'The server rejected this account for the selected workspace.');
  return data;
}

async function validateAndStore(message) {
  if (!roleNames[role] || message.role !== role || !message.payload) throw new Error('The sign-in handoff did not match this application.');
  const apiBase = new URL(message.apiBase || apiBaseDefault);
  if (!['http:', 'https:'].includes(apiBase.protocol) || apiBase.username || apiBase.password) throw new Error('The configured clinic API URL is invalid.');
  const base = apiBase.origin;
  const p = message.payload;
  if (role === 'admin') {
    if (!p.token) throw new Error('No administrator credential was received.');
    const user = await getJson(`${base}/api/admin/me/`, { headers: { Authorization: `Token ${p.token}` } });
    if (String(user.role).toLowerCase() !== 'administrator') throw new Error('The server did not confirm Administrator access.');
    localStorage.setItem('admin_token', p.token);
    localStorage.setItem('access_token', p.token);
    localStorage.setItem('current_user', JSON.stringify(user));
  } else if (role === 'pharmacist') {
    if (!p.access) throw new Error('No Pharmacist credential was received.');
    const user = await getJson(`${base}/pharmacist/me/`, { headers: { Authorization: `Bearer ${p.access}` } });
    if (String(user.role).toLowerCase() !== 'pharmacist') throw new Error('The server did not confirm Pharmacist access.');
    localStorage.setItem('pharmacist_access_token', p.access);
    localStorage.setItem('pharmacist_user', JSON.stringify(user));
  } else if (role === 'receptionist') {
    if (!p.user_id || !p.receptionist_id) throw new Error('No Receptionist session identity was received.');
    await getJson(`${base}/api/receptionist/departments/`, { credentials: 'include' });
    sessionStorage.setItem('receptionist_user', JSON.stringify(p));
  } else {
    if (!p.access || !p.refresh || !p.doctor_id || !p.user_id) throw new Error('No Doctor credential was received.');
    await getJson(`${base}/doctor/dashboard/${encodeURIComponent(p.doctor_id)}/`, { headers: { Authorization: `Bearer ${p.access}` } });
    for (const [key, value] of Object.entries({ access_token: p.access, refresh_token: p.refresh, doctor_id: p.doctor_id, doctor_name: p.doctor_name || '', user_id: p.user_id, username: p.username || '' })) localStorage.setItem(key, String(value));
  }
}

if (!window.opener || !roleNames[role]) {
  show('Open this page from the MEDICARE login page to continue.', true);
} else {
  for (const origin of loginOrigins) window.opener.postMessage({ type: 'CLINIC_AUTH_READY', role }, origin);
  let handled = false;
  window.addEventListener('message', async event => {
    if (handled || !loginOrigins.has(event.origin) || event.source !== window.opener || event.data?.type !== 'CLINIC_AUTH_PAYLOAD') return;
    handled = true;
    try {
      await validateAndStore(event.data);
      window.opener.postMessage({ type: 'CLINIC_AUTH_COMPLETE', role }, event.origin);
      show('Role verified. Opening your workspace…');
      window.location.replace('/');
    } catch (error) {
      show(error.message || 'Secure sign-in could not be completed.', true);
      window.opener.postMessage({ type: 'CLINIC_AUTH_ERROR', role, message: error.message }, event.origin);
    }
  });
}
