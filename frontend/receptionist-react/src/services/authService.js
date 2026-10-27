import { clearApiSession, getCsrfToken, receptionistApi } from './api';
import { clearReceptionistAuth } from './authStorage.js';

const USER_KEY = 'receptionist_user';
export const getStoredUser = () => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};

// Validate the Django session before using any browser-stored identity. The
// departments endpoint is read-only and protected by receptionist session and
// role permissions, so a successful response proves authorization server-side.
export async function validateSession() {
  await receptionistApi.get('/departments/');
  return getStoredUser() || { name: 'Receptionist' };
}

export async function login(username, password) {
  await getCsrfToken();
  const user = await receptionistApi.post('/login/', { username, password });
  const identity = { user_id: user.user_id, receptionist_id: user.receptionist_id, name: user.name };
  sessionStorage.setItem(USER_KEY, JSON.stringify(identity));
  return identity;
}

export async function logout() {
  try { await receptionistApi.post('/logout/', {}); }
  finally { clearLocalAuth(); }
}

export function clearLocalAuth() {
  clearReceptionistAuth(sessionStorage, clearApiSession);
}
