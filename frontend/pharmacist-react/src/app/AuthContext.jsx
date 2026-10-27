import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '../services/api.js';
import { resolveSharedLoginUrl } from '../services/sharedLogin.js';
import { clearPharmacistAuth } from '../services/authStorage.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const clear = useCallback(() => { clearPharmacistAuth(localStorage); setUser(null); }, []);
  const validate = useCallback(async () => {
    if (!localStorage.getItem('pharmacist_access_token')) { clear(); setStatus('anonymous'); return; }
    setStatus('checking'); setError('');
    try {
      const profile = await request('/pharmacist/me/');
      if (String(profile.role).toLowerCase() !== 'pharmacist') throw Object.assign(new Error('This account is not authorized for Pharmacy.'), { status: 403 });
      localStorage.setItem('pharmacist_profile', JSON.stringify(profile)); setUser(profile); setStatus('authenticated');
    } catch (err) {
      if (err.status === 401 || err.status === 403) { clear(); setStatus('anonymous'); window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); }
      else { setError(err.message); setStatus('error'); }
    }
  }, [clear]);
  useEffect(() => { validate(); }, [validate]);
  useEffect(() => {
    const onUnauthorized = () => { clear(); setStatus('anonymous'); window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); };
    window.addEventListener('pharmacist:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pharmacist:unauthorized', onUnauthorized);
  }, [clear]);
  const login = useCallback(async (username, password) => {
    const data = await request('/pharmacist/login/', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (!data.access || String(data.role).toLowerCase() !== 'pharmacist') throw new Error('The login response did not contain valid Pharmacist credentials.');
    localStorage.setItem('pharmacist_access_token', data.access);
    await validate();
  }, [validate]);
  const value = useMemo(() => ({ user, status, error, login, logout: () => { clear(); setStatus('anonymous'); window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); }, retry: validate }), [user, status, error, login, clear, validate]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
