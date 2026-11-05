import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { user, signIn } = useAuth(); const navigate = useNavigate(); const notify = useToast();
  const [form, setForm] = useState({ username: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event) { event.preventDefault(); setError(''); if (!form.username.trim() || !form.password) { setError('Enter your username and password.'); return; } setBusy(true); try { await signIn(form.username.trim(), form.password); notify('Welcome to the reception desk.'); navigate('/', { replace: true }); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="login-screen"><div className="login-brand"><img src="/assets/logo.svg" alt="MEDICARE" /><span>CLINIC MANAGEMENT SYSTEM</span></div><section className="login-card"><div className="login-icon">✚</div><div className="eyebrow">RECEPTION TEAM</div><h1>Welcome back</h1><p>Sign in to manage today’s clinic operations.</p>{error && <div role="alert" className="inline-error">{error}</div>}<form onSubmit={submit}><label className="field"><span>Username</span><input autoComplete="username" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Enter your username" /></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" /></label><button className="button button-primary button-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}<span>→</span></button></form><div className="login-footnote">Access is protected by your clinic account.</div></section><small className="login-copyright">© {new Date().getFullYear()} MEDICARE Care Operations</small></div>;
}
