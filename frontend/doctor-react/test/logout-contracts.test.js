import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}

globalThis.window = { location: { origin: 'http://127.0.0.1:5501', href: 'http://127.0.0.1:5501/' , replace: value => { globalThis.redirected = value; } } };
globalThis.localStorage = memoryStorage({ access_token: 'doctor', doctor_id: '4', doctor_name: 'Doctor', careflow_compact: 'yes' });
globalThis.sessionStorage = memoryStorage({ refresh_token: 'refresh', current_appointment_id: '5', unrelated: 'keep' });
const { clearLogin, logoutDoctor } = await import('../src/utils/auth.js');
const { resolveSharedLoginUrl } = await import('../src/utils/sharedLogin.js');
const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('Doctor logout clears only Doctor session keys and fully navigates to Shared Login', () => {
  logoutDoctor('http://127.0.0.1:5504/');
  assert.equal(globalThis.redirected, 'http://127.0.0.1:5504/');
  assert.equal(localStorage.getItem('access_token'), null);
  assert.equal(localStorage.getItem('doctor_id'), null);
  assert.equal(sessionStorage.getItem('refresh_token'), null);
  assert.equal(sessionStorage.getItem('current_appointment_id'), null);
  assert.equal(localStorage.getItem('careflow_compact'), 'yes');
  assert.equal(sessionStorage.getItem('unrelated'), 'keep');
});

test('Doctor Shared Login URL honors safe configuration and uses a safe development fallback', () => {
  assert.equal(resolveSharedLoginUrl('https://clinic.example/login/', false), 'https://clinic.example/login/');
  assert.equal(resolveSharedLoginUrl('javascript:alert(1)', true), 'http://127.0.0.1:5504/');
});

test('Doctor expiry and logout handlers use full-page Shared Login navigation', async () => {
  const [layout, pages, api] = await Promise.all([read('../src/components/Layout.jsx'), read('../src/pages/Pages.jsx'), read('../src/services/api.js')]);
  assert.match(layout, /onClick=\{\(\) => logoutDoctor\(\)\}/);
  assert.match(pages, /onClick=\{\(\) => logoutDoctor\(\)\}/);
  assert.doesNotMatch(pages, /clearLogin\(\).*location\.(?:assign|replace)\(['"]\/login/);
  assert.match(api, /window\.location\.replace\(resolveSharedLoginUrl\(import\.meta\.env\.VITE_SHARED_LOGIN_URL, import\.meta\.env\.DEV\)\)/);
  assert.doesNotMatch(api, /window\.location\.(?:assign|href)\s*=\s*['"]\/login/);
});
