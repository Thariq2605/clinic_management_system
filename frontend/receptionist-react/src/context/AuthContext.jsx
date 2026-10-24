import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearLocalAuth, getStoredUser, login as loginRequest, logout as logoutRequest } from '../services/authService';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  useEffect(() => {
    const unauthorized = () => { clearLocalAuth(); setUser(null); };
    window.addEventListener('reception:unauthorized', unauthorized);
    return () => window.removeEventListener('reception:unauthorized', unauthorized);
  }, []);
  const value = useMemo(() => ({
    user,
    signIn: async (username, password) => { const next = await loginRequest(username, password); setUser(next); return next; },
    signOut: async () => { try { await logoutRequest(); } finally { setUser(null); } },
    clearUser: () => setUser(null),
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
