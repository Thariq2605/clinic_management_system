const loginOrigins = new Set(['http://127.0.0.1:5504', 'http://localhost:5504']);
const role = new URLSearchParams(window.location.search).get('role');
const status = document.getElementById('handoff-status');

function show(message, failed = false) {
  status.textContent = message;
  status.classList.toggle('failed', failed);
}

async function getJson(url, token) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
    });
  } catch {
    throw new Error('Could not reach the clinic server to validate your Pharmacist role.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || data?.error || 'The server rejected this Pharmacist session.');
  if (!data || typeof data !== 'object') throw new Error('The server returned an invalid Pharmacist profile.');
  return data;
}

async function validateAndStore(message) {
  if (role !== 'pharmacist' || message.role !== role || !message.payload?.access) {
    throw new Error('The sign-in handoff did not match this Pharmacist application.');
  }

  const apiBase = new URL(message.apiBase || 'http://127.0.0.1:8000');
  if (!['http:', 'https:'].includes(apiBase.protocol) || apiBase.username || apiBase.password) {
    throw new Error('The configured clinic API URL is invalid.');
  }

  const profile = await getJson(`${apiBase.origin}/pharmacist/me/`, message.payload.access);
  if (String(profile.role).toLowerCase() !== 'pharmacist') {
    throw new Error('The server did not confirm Pharmacist access.');
  }

  localStorage.setItem('pharmacist_access_token', message.payload.access);
  localStorage.setItem('pharmacist_user', JSON.stringify(profile));
  localStorage.setItem('pharmacist_profile', JSON.stringify(profile));
}

if (!window.opener || role !== 'pharmacist') {
  show('Open this page from the MEDICARE login page to continue.', true);
} else {
  for (const origin of loginOrigins) {
    window.opener.postMessage({ type: 'CLINIC_AUTH_READY', role }, origin);
  }

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
      const message = error instanceof Error ? error.message : 'Secure sign-in could not be completed.';
      show(message, true);
      window.opener.postMessage({ type: 'CLINIC_AUTH_ERROR', role, message }, event.origin);
    }
  });
}
