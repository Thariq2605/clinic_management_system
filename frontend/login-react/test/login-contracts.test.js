import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

globalThis.window = { location: { origin: 'http://127.0.0.1:5504' } };
const { signIn } = await import('../src/services/auth.js');
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [authSource, app, main, handoff, vite, html] = await Promise.all([
  read('src/services/auth.js'), read('src/App.jsx'), read('src/main.jsx'), read('public/auth-handoff.js'), read('vite.config.js'), read('index.html'),
]);

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
async function withFetch(responses, run) {
  const original = globalThis.fetch; const calls = []; const queue = [...responses];
  globalThis.fetch = async (url, options = {}) => { calls.push({ url, options }); const next = queue.shift(); if (next instanceof Error) throw next; return next; };
  try { return await run(calls); } finally { globalThis.fetch = original; }
}

await withFetch([response({ csrfToken: 'csrf' }), response({ role: 'administrator', token: 'admin-secret', user: { role: 'Administrator' } })], async calls => {
  const result = await signIn('admin', 'pw');
  assert.equal(result.role, 'admin'); assert.equal(result.port, '5502'); assert.equal(result.payload.token, 'admin-secret');
  assert.deepEqual(JSON.parse(calls[1].options.body), { username: 'admin', password: 'pw' });
  assert.equal(calls[1].options.headers['X-CSRFToken'], 'csrf'); assert.equal(calls[1].options.credentials, 'include');
});
await withFetch([response({ csrfToken: 'csrf' }), response({ role: 'pharmacist', user_id: 9 }), response({ role: 'Pharmacist', access: 'pharma-secret' })], async () => {
  const result = await signIn('pharma', 'pw'); assert.equal(result.port, '5503'); assert.equal(result.payload.access, 'pharma-secret');
});
await withFetch([response({ csrfToken: 'csrf' }), response({ role: 'receptionist', user_id: 4, receptionist_id: 6, name: 'R' })], async calls => {
  const result = await signIn('reception', 'pw'); assert.equal(result.port, '5500'); assert.equal(result.payload.receptionist_id, 6); assert.equal(calls[0].options.credentials, 'include');
});
await withFetch([response({ csrfToken: 'csrf' }), response({ role: 'doctor', access: 'a', refresh: 'r', doctor_id: 2, user_id: 8, username: 'doc' })], async () => {
  const result = await signIn('doctor', 'pw'); assert.equal(result.port, '5501'); assert.equal(result.payload.refresh, 'r');
});
await withFetch([response({ csrfToken: 'csrf' }), response({ role: 'lab_technician', access: 'a', refresh: 'r', technician_id: 5, user_id: 8, username: 'tech', name: 'Technician' })], async () => {
  const result = await signIn('technician', 'pw'); assert.equal(result.role, 'lab_technician'); assert.equal(result.port, '5505'); assert.equal(result.payload.technician_id, 5);
});
await withFetch([response({ csrfToken: 'csrf' }), response({ error: 'Invalid username or password.' }, 401)], async () => {
  await assert.rejects(signIn('bad', 'pw'), error => error.status === 401 && /Invalid username/.test(error.message));
});
await withFetch([response({ csrfToken: 'csrf' }), response({ role: 'doctor', access: 'only-access' })], async () => {
  await assert.rejects(signIn('doctor', 'pw'), /incomplete Doctor login/);
});
await withFetch([new Error('offline')], async () => {
  await assert.rejects(signIn('doc', 'pw'), /Cannot connect to Django/);
});

async function runHandoff(role, payload, validationResponse, expectedKey, messageRole = role) {
  const messages = []; const stored = new Map(); let listener; let redirect = '';
  const opener = { postMessage: message => messages.push(message) };
  const fakeWindow = { opener, location: { search: `?role=${role}`, replace: path => { redirect = path; } }, addEventListener: (type, fn) => { if (type === 'message') listener = fn; } };
  const status = { textContent: '', classList: { toggle() {} } };
  const responseForFetch = { ok: validationResponse.ok, json: async () => validationResponse.data };
  const storage = { setItem: (key, value) => stored.set(key, value) };
  const context = { window: fakeWindow, document: { getElementById: () => status }, URLSearchParams, URL, Set, fetch: async () => responseForFetch, localStorage: storage, sessionStorage: storage, encodeURIComponent };
  vm.runInNewContext(handoff, context);
  await listener({ origin: 'http://127.0.0.1:5504', source: opener, data: { type: 'CLINIC_AUTH_PAYLOAD', role: messageRole, payload, apiBase: 'http://127.0.0.1:8000' } });
  if (expectedKey) { assert.ok(stored.has(expectedKey)); assert.equal(redirect, '/'); assert.ok(messages.some(m => m.type === 'CLINIC_AUTH_COMPLETE')); }
  else { assert.equal(stored.size, 0); assert.ok(messages.some(m => m.type === 'CLINIC_AUTH_ERROR')); }
}
await runHandoff('admin', { token: 't' }, { ok: true, data: { role: 'Administrator' } }, 'admin_token');
await runHandoff('pharmacist', { access: 't' }, { ok: true, data: { role: 'Pharmacist' } }, 'pharmacist_access_token');
await runHandoff('receptionist', { user_id: 1, receptionist_id: 2 }, { ok: true, data: [] }, 'receptionist_user');
await runHandoff('doctor', { access: 'a', refresh: 'r', doctor_id: 2, user_id: 8 }, { ok: true, data: {} }, 'access_token');
await runHandoff('lab_technician', { access: 'a', refresh: 'r', technician_id: 5, user_id: 8 }, { ok: true, data: [] }, 'lab_technician_access_token');
await runHandoff('admin', { token: 'bad' }, { ok: false, data: { detail: 'Forbidden' } }, null);
await runHandoff('admin', { access: 'pharma-token' }, { ok: true, data: { role: 'Pharmacist' } }, null, 'pharmacist');

assert.match(authSource, /\/api\/csrf\//); assert.match(authSource, /\/api\/login\//); assert.match(authSource, /credentials: 'include'/);
assert.match(app, /window\.open\('about:blank'/); assert.match(app, /event\.source !== handoff\.popup/); assert.match(app, /event\.origin !== handoff\.origin/);
assert.doesNotMatch(app, /popupRef/);
assert.match(app, /<Route path="\/login"/); assert.match(main, /BrowserRouter/);
assert.match(app, /<Route path="\/" element=\{<LoginPage \/>\}/);
assert.doesNotMatch(app, /window\.location\.(?:assign|replace)|localStorage\.setItem|sessionStorage\.setItem/);
assert.match(handoff, /loginOrigins\.has\(event\.origin\)/); assert.match(vite, /port: 5504/); assert.match(vite, /host: '127\.0\.0\.1'/); assert.match(html, /\/src\/main\.jsx/);
assert.match(handoff, /api\/lab-technician\/orders\//); assert.match(handoff, /lab_technician_access_token/);
console.log('Shared login behavior checks passed for all five roles, invalid credentials, malformed login data, network failure, and rejected cross-role access.');
