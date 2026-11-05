const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}
function errorMessage(data, status) {
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;
  if (data && typeof data === 'object') {
    const fields = Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : JSON.stringify(value)}`);
    if (fields.length) return fields.join(' · ');
  }
  return `Request failed (${status})`;
}
export async function request(path, options = {}) {
  const token = localStorage.getItem('pharmacist_access_token');
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response;
  try { response = await fetch(`${base}${path}`, { ...options, headers }); }
  catch (err) { throw new ApiError(`Cannot connect to Django at ${base}. Check that the API server is running and CORS allows http://127.0.0.1:5503.`, 0, null); }
  let data = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { detail: text }; } }
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) window.dispatchEvent(new Event('pharmacist:unauthorized'));
    throw new ApiError(errorMessage(data, response.status), response.status, data);
  }
  return data;
}
export const apiBaseUrl = base;
export const rows = data => Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
