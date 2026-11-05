const LOGIN_ORIGINS = new Set([
  'http://127.0.0.1:5504',
  'http://localhost:5504',
]);
const ROLE = 'lab_technician';
const API_BASE_DEFAULT = 'http://127.0.0.1:8000';
const status = document.getElementById('handoff-status');
const params = new URLSearchParams(window.location.search);
const role = params.get('role');
const expectedDestination =
  window.location.port === '5505' &&
  window.location.pathname === '/auth-handoff.html';

function show(message, failed = false) {
  status.textContent = message;
  status.classList.toggle('failed', failed);
}

function notifyLogin(type, message, origin) {
  window.opener.postMessage({ type, role: ROLE, message }, origin);
}

function validIdentity(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function validPayload(payload) {
  return payload && typeof payload === 'object' &&
    typeof payload.access === 'string' && payload.access.length > 0 &&
    typeof payload.refresh === 'string' && payload.refresh.length > 0 &&
    validIdentity(payload.technician_id) && validIdentity(payload.user_id);
}

function trustedApiOrigin(value) {
  let api;
  try {
    api = new URL(value || API_BASE_DEFAULT);
  } catch {
    throw new Error('The clinic API address is invalid.');
  }
  if (!['http:', 'https:'].includes(api.protocol) ||
      api.username || api.password || api.search || api.hash ||
      api.pathname !== '/') {
    throw new Error('The clinic API address is invalid.');
  }
  return api.origin;
}

async function verifyTechnician(access, apiOrigin) {
  let response;
  try {
    response = await fetch(apiOrigin + '/api/lab-technician/orders/', {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + access,
      },
      credentials: 'omit',
    });
  } catch {
    throw new Error('Could not verify Laboratory Technician access with the clinic server.');
  }

  if (!response.ok) {
    throw new Error('The clinic server did not authorize Laboratory Technician access.');
  }
  const orders = await response.json().catch(() => null);
  if (!Array.isArray(orders)) {
    throw new Error('The clinic server returned an invalid Laboratory Technician response.');
  }
}

if (!expectedDestination) {
  show('This verification page must be opened by the Laboratory Technician application.', true);
} else if (!window.opener || role !== ROLE) {
  show('Open this page from Shared Login for a Laboratory Technician account.', true);
} else {
  for (const origin of LOGIN_ORIGINS) {
    window.opener.postMessage({ type: 'CLINIC_AUTH_READY', role: ROLE }, origin);
  }

  let handled = false;
  window.addEventListener('message', async event => {
    if (handled || !LOGIN_ORIGINS.has(event.origin) ||
        event.source !== window.opener ||
        event.data?.type !== 'CLINIC_AUTH_PAYLOAD') {
      return;
    }

    handled = true;
    try {
      if (event.data.role !== ROLE || !validPayload(event.data.payload)) {
        throw new Error('The sign-in response is not for a Laboratory Technician account.');
      }

      const apiOrigin = trustedApiOrigin(event.data.apiBase);
      await verifyTechnician(event.data.payload.access, apiOrigin);

      const payload = event.data.payload;
      for (const [key, value] of Object.entries({
        lab_technician_access_token: payload.access,
        lab_technician_refresh_token: payload.refresh,
        lab_technician_id: payload.technician_id,
        lab_technician_user_id: payload.user_id,
        lab_technician_username: payload.username || '',
        lab_technician_name: payload.name || '',
      })) {
        localStorage.setItem(key, String(value));
      }

      notifyLogin('CLINIC_AUTH_COMPLETE', undefined, event.origin);
      show('Laboratory Technician access verified. Opening your workspace?');
      window.location.replace('/');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Laboratory Technician sign-in could not be verified.';
      show(message, true);
      notifyLogin('CLINIC_AUTH_ERROR', message, event.origin);
    }
  });
}
