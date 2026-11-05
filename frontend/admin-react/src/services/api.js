import { clearAdminAuthFromStorage, formatApiErrorData, getAdminTokenFromStorage } from './apiCore.js';
import { API_ORIGIN } from './apiConfig.js';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, network = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.network = network;
  }
}

export function getAdminToken() {
  return getAdminTokenFromStorage(localStorage);
}

export function clearAdminAuth() {
  clearAdminAuthFromStorage(localStorage);
}

export function getErrorMessage(error) {
  if (error instanceof ApiError) {
    const data = error.data;
    if (data) return formatApiErrorData(data, error.status) || error.message;
    return error.message;
  }
  return error?.message || 'The request failed. Please try again.';
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const token = getAdminToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      method, headers, signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(`Cannot reach the backend at ${API_ORIGIN}. Check the server and API URL.`, { network: true });
  }
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (response.status !== 204) {
    if (contentType.includes('application/json')) data = await response.json().catch(() => null);
    else {
      const text = await response.text().catch(() => '');
      data = text ? { detail: text } : null;
    }
  }
  if (!response.ok) {
    throw new ApiError(getErrorMessage(new ApiError(`Request failed (${response.status}).`, { status: response.status, data })), { status: response.status, data });
  }
  return data;
}

export const adminApi = {
  get: (path, params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    return request(`${path}${query.size ? `?${query}` : ''}`);
  },
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export const API_ORIGIN_FOR_DOCS = API_ORIGIN;
