import { clearApiSession, getCsrfToken, receptionistApi } from './api';

const USER_KEY = 'receptionist_user';
export const getStoredUser = () => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};

export async function login(username, password) {
  await getCsrfToken();
  const user = await receptionistApi.post('/login/', { username, password });
  const identity = { user_id: user.user_id, receptionist_id: user.receptionist_id, name: user.name };
  sessionStorage.setItem(USER_KEY, JSON.stringify(identity));
  return identity;
}

export async function logout() {
  try { await receptionistApi.post('/logout/', {}); }
  finally {
    sessionStorage.removeItem(USER_KEY);
    clearApiSession();
  }
}

export function clearLocalAuth() {
  sessionStorage.removeItem(USER_KEY);
  clearApiSession();
}
