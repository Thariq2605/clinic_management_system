const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const apiRoot = `${apiOrigin}/api/receptionist`;
let csrfToken = sessionStorage.getItem('reception_csrf') || '';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function errorMessage(data, status) {
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat(Infinity).find((value) => typeof value === 'string');
    if (first) return first;
  }
  return status === 401 || status === 403 ? 'Your receptionist session has expired. Please sign in again.' : `Request failed (${status}).`;
}

export async function getCsrfToken() {
  const response = await fetch(`${apiRoot}/csrf/`, { credentials: 'include', headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.csrfToken) throw new ApiError(errorMessage(data, response.status), response.status, data);
  csrfToken = data.csrfToken;
  sessionStorage.setItem('reception_csrf', csrfToken);
  return csrfToken;
}

export async function apiRequest(path, { method = 'GET', body, headers = {}, retryCsrf = true } = {}) {
  const verb = method.toUpperCase();
  if (verb !== 'GET' && !csrfToken) await getCsrfToken();
  const response = await fetch(`${apiRoot}${path.startsWith('/') ? path : `/${path}`}`, {
    method: verb,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(verb !== 'GET' && csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 403 && retryCsrf && verb !== 'GET') {
    await getCsrfToken();
    return apiRequest(path, { method: verb, body, headers, retryCsrf: false });
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) window.dispatchEvent(new CustomEvent('reception:unauthorized'));
    throw new ApiError(errorMessage(data, response.status), response.status, data);
  }
  return data;
}

export const receptionistApi = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
};

export function clearApiSession() {
  csrfToken = '';
  sessionStorage.removeItem('reception_csrf');
}
