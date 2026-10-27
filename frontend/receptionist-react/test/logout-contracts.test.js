import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const values = new Map([['receptionist_user', '{"name":"R"}'], ['reception_csrf', 'csrf'], ['unrelated', 'keep']]);
globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
globalThis.window = { location: { origin: 'http://127.0.0.1:5500', href: 'http://127.0.0.1:5500/', replace: value => { globalThis.redirected = value; } } };
const { clearReceptionistAuth } = await import('../src/services/authStorage.js');
const { resolveSharedLoginUrl } = await import('../src/services/sharedLogin.js');
const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('Receptionist cleanup clears the session identity and CSRF cache only', () => {
  clearReceptionistAuth(sessionStorage, () => values.delete('reception_csrf'));
  assert.equal(values.has('receptionist_user'), false);
  assert.equal(values.has('reception_csrf'), false);
  assert.equal(values.get('unrelated'), 'keep');
});

test('Receptionist logout and session expiry perform full-page navigation to Shared Login', async () => {
  const [layout, context, authService] = await Promise.all([read('../src/layouts/ReceptionistLayout.jsx'), read('../src/context/AuthContext.jsx'), read('../src/services/authService.js')]);
  assert.match(layout, /await signOut\(\); \} finally \{ window\.location\.replace\(resolveSharedLoginUrl\(import\.meta\.env\.VITE_SHARED_LOGIN_URL, import\.meta\.env\.DEV\)\)/);
  assert.match(authService, /receptionistApi\.post\('\/logout\/'/);
  assert.match(authService, /clearReceptionistAuth\(sessionStorage, clearApiSession\)/);
  assert.match(context, /window\.location\.replace\(resolveSharedLoginUrl\(import\.meta\.env\.VITE_SHARED_LOGIN_URL, import\.meta\.env\.DEV\)\)/);
  assert.equal(resolveSharedLoginUrl('', true), 'http://127.0.0.1:5504/');
  assert.equal(resolveSharedLoginUrl('javascript:alert(1)', true), 'http://127.0.0.1:5504/');
  assert.equal(resolveSharedLoginUrl('https://clinic.example/login/', false), 'https://clinic.example/login/');
});
