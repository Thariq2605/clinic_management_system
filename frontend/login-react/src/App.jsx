import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getTrustedTarget, signIn } from './services/auth.js';

function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ username: '', password: '' });
  const handoffRef = useRef(null);

  useEffect(() => {
    function onMessage(event) {
      const handoff = handoffRef.current;
      if (!handoff || event.source !== handoff.popup || event.origin !== handoff.origin) return;
      if (event.data?.type === 'CLINIC_AUTH_READY' && event.data.role === handoff.role) {
        event.source.postMessage({ type: 'CLINIC_AUTH_PAYLOAD', role: handoff.role, apiBase: handoff.apiBase, payload: handoff.payload }, handoff.origin);
      }
      if (event.data?.type === 'CLINIC_AUTH_COMPLETE' && event.data.role === handoff.role) {
        handoffRef.current = null;
        setBusy(false);
        setNotice('Signed in. Your role-specific workspace is open in the new tab.');
      }
      if (event.data?.type === 'CLINIC_AUTH_ERROR') {
        handoffRef.current = null;
        handoff.popup.close();
        setBusy(false);
        setError(event.data.message || 'The application could not validate your session.');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    const username = form.username.trim();
    if (!username || !form.password) { setError('Enter your username and password.'); return; }
    // Open synchronously from the form action so browser popup blockers do
    // not prevent the cross-origin, exact-origin credential handoff.
    const popup = window.open('about:blank', '_blank');
    if (!popup) { setError('Allow pop-ups for this clinic login page, then try again.'); return; }
    setBusy(true);
    try {
      const result = await signIn(username, form.password);
      setForm(current => ({ ...current, password: '' }));
      const origin = getTrustedTarget(result.port);
      handoffRef.current = { popup, origin, role: result.role, payload: result.payload, apiBase: result.apiBase };
      popup.location.replace(`${origin}/auth-handoff.html?role=${encodeURIComponent(result.role)}`);
      setNotice('Verifying your account and opening your workspace…');
      window.setTimeout(() => {
        if (handoffRef.current?.popup === popup) {
          handoffRef.current = null;
          if (!popup.closed) popup.close();
          setBusy(false);
          setError('The role application did not complete secure sign-in. Start again and make sure its Vite server is running.');
        }
      }, 20000);
    } catch (err) {
      if (!popup.closed) popup.close();
      setBusy(false);
      setError(err.message || 'Sign-in failed. Please try again.');
    }
  }

  return <main className="login-shell"><section className="brand-panel"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✚</span><span>MEDICARE</span></div><div className="brand-copy"><span className="eyebrow">CLINIC MANAGEMENT SYSTEM</span><h1>Care moves forward when every team is connected.</h1><p>One secure entrance for your clinic’s administration, pharmacy, front desk, and clinical care teams.</p><ul><li><b>01</b> Verified role-based access</li><li><b>02</b> Protected clinic workflows</li><li><b>03</b> One account, the right workspace</li></ul></div><small className="brand-footer">© 2026 MEDICARE Health Systems</small></section><section className="form-panel"><form className="login-card" onSubmit={submit} noValidate><div className="mobile-brand"><span className="brand-mark" aria-hidden="true">✚</span> MEDICARE</div><span className="eyebrow">SECURE STAFF ACCESS</span><h2>Welcome back</h2><p className="intro">Sign in with your clinic username to continue.</p>{error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert notice" role="status">{notice}</div>}<label htmlFor="username">Username</label><input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required aria-invalid={Boolean(error && !form.username.trim())} /><label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /><button type="button" className="show-password" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button></div><button className="submit" type="submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}</button><div className="security-note"><span aria-hidden="true">◇</span> Your role is verified by the clinic server.</div></form><footer className="form-footer">Need access? Contact your clinic administrator.</footer></section></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<LoginPage />} /><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
