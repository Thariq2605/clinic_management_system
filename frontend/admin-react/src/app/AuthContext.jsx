import { createContext, useContext, useEffect, useState } from 'react';
import { clearAdminAuth, getAdminToken, request } from '../services/api.js';
import { classifyAdminAuthResult, resolveSharedLoginUrl } from '../services/apiCore.js';

const AuthContext = createContext(null);
const sharedLoginUrl = () => resolveSharedLoginUrl({ configured: import.meta.env.VITE_SHARED_LOGIN_URL, development: import.meta.env.DEV, origin: window.location.origin, href: window.location.href });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const token = getAdminToken();
    if (!token) {
      clearAdminAuth();
      window.location.replace(sharedLoginUrl());
      return () => { active = false; };
    }
    setState({ status: 'checking', user: null, error: '' });
    request('/api/admin/me/').then((user) => {
      if (!active) return;
      if (classifyAdminAuthResult({ status: 200, role: user?.role }) === 'redirect') {
        clearAdminAuth();
        window.location.replace(sharedLoginUrl());
        return;
      }
      localStorage.setItem('current_user', JSON.stringify(user));
      setState({ status: 'ready', user, error: '' });
    }).catch((error) => {
      if (!active) return;
      if (classifyAdminAuthResult({ status: error.status }) === 'redirect') {
        clearAdminAuth();
        window.location.replace(sharedLoginUrl());
        return;
      }
      setState({ status: 'error', user: null, error: error.message || 'Could not validate administrator access.' });
    });
    return () => { active = false; };
  }, [attempt]);
  const retry = () => setAttempt((v) => v + 1);
  const logout = () => {
    clearAdminAuth();
    setState({ status: 'checking', user: null, error: '' });
    window.location.replace(sharedLoginUrl());
  };
  return <AuthContext.Provider value={{ ...state, retry, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function AuthGate({ children }) {
  const auth = useAuth();
  if (auth.status === 'checking') return <main className="auth-state"><div className="spinner"/><h1>Checking administrator access</h1><p>Verifying your account with the clinic server…</p></main>;
  if (auth.status === 'error') return <main className="auth-state"><div className="state-icon error">!</div><h1>Unable to validate access</h1><p>{auth.error}</p><button className="button primary" onClick={auth.retry}>Retry</button></main>;
  return children;
}
