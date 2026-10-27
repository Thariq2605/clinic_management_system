import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
export default function LoginPage() {
  const { status, login } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (status === 'authenticated') return <Navigate to="/" replace />;
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); const form = new FormData(e.currentTarget); try { await login(form.get('username'), form.get('password')); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}><span className="eyebrow">MEDICARE · PHARMACY</span><h1>Pharmacist sign in</h1><p>Sign in with your clinic account.</p>{error && <div className="notice error" role="alert">{error}</div>}<label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></main>;
}
