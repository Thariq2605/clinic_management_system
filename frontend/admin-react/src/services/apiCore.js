export function resolveApiOrigin(value) {
  return String(value || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

export function resolveSharedLoginUrl({ configured, development, origin, href }) {
  if (configured) {
    try {
      const login = new URL(configured, origin);
      if (login.protocol === 'http:' || login.protocol === 'https:') return login.toString();
    } catch { /* Fall back to the environment-specific default. */ }
  }
  if (development) return 'http://127.0.0.1:5504/';
  // Production deployments should set VITE_SHARED_LOGIN_URL to their central
  // login origin. Retain the legacy same-host page as a safe missing-config fallback.
  return new URL('../login.html', href).toString();
}

export function getAdminTokenFromStorage(storage) {
  const adminToken = storage.getItem('admin_token');
  if (adminToken) return adminToken;
  try {
    const user = JSON.parse(storage.getItem('current_user') || 'null');
    if (['admin', 'administrator'].includes(String(user?.role || '').toLowerCase())) return storage.getItem('access_token');
  } catch { /* Ignore malformed legacy profile data. */ }
  return null;
}

export function clearAdminAuthFromStorage(storage) {
  const adminToken = storage.getItem('admin_token');
  let currentUser = null;
  try { currentUser = JSON.parse(storage.getItem('current_user') || 'null'); } catch { /* Ignore malformed profile data. */ }
  storage.removeItem('admin_token');
  if ((adminToken && storage.getItem('access_token') === adminToken) || ['admin', 'administrator'].includes(String(currentUser?.role || '').toLowerCase())) storage.removeItem('access_token');
  storage.removeItem('current_user');
}

export function formatApiErrorData(data, status = 0) {
  if (!data) return `Request failed (${status || 'network'}).`;
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  if (data.error) return String(data.error);
  const format = (value) => Array.isArray(value) ? value.map(String).join(' ') : value && typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${format(item)}`).join(' · ') : String(value ?? '');
  return Object.entries(data).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${format(value)}`).join(' · ') || `Request failed (${status}).`;
}

export function classifyAdminAuthResult({ status, role }) {
  if (status === 401 || status === 403) return 'redirect';
  if (status !== 200) return 'retry';
  return ['admin', 'administrator'].includes(String(role || '').toLowerCase()) ? 'authorized' : 'redirect';
}
