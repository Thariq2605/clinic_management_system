import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearLocalAuth, login as loginRequest, logout as logoutRequest, validateSession } from '../services/authService';
import { resolveSharedLoginUrl } from '../services/sharedLogin.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    setChecking(true);
    setSessionError('');
    validateSession()
      .then((sessionUser) => { if (active) setUser(sessionUser); })
      .catch((error) => {
        if (!active) return;
        clearLocalAuth();
        setUser(null);
        if (error?.status === 401 || error?.status === 403) {
          window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV));
        } else {
          setSessionError('Unable to verify your receptionist session. Check the backend connection and try again.');
        }
      })
      .finally(() => { if (active) setChecking(false); });
    const unauthorized = () => { clearLocalAuth(); setUser(null); window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); };
    window.addEventListener('reception:unauthorized', unauthorized);
    return () => { active = false; window.removeEventListener('reception:unauthorized', unauthorized); };
  }, [retryCount]);
  const value = useMemo(() => ({
    user,
    checking,
    sessionError,
    retrySession: () => setRetryCount((count) => count + 1),
    signIn: async (username, password) => { const next = await loginRequest(username, password); setUser(next); return next; },
    signOut: async () => { try { await logoutRequest(); } finally { setUser(null); } },
    clearUser: () => setUser(null),
  }), [user, checking, sessionError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
