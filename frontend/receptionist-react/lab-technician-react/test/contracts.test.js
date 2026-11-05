import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');
const [app, vite, html, handoffHtml, handoff, auth] = await Promise.all([
  read('src/App.jsx'),
  read('vite.config.js'),
  read('index.html'),
  read('public/auth-handoff.html'),
  read('public/auth-handoff.js'),
  read('src/auth.js'),
]);
assert.match(app, /\/api\/lab-technician\/orders\//);
assert.match(app, /\/api\/lab-technician\/items\/\$\{itemId\}\/result\//);
assert.match(app, /lab_technician_access_token/);
assert.match(app, /window\.location\.replace\(loginUrl\)/);
assert.match(app, /clearTechnicianAuth\(localStorage\)/);
assert.match(auth, /lab_technician_refresh_token/);
const { clearTechnicianAuth } = await import('../src/auth.js');
globalThis.window = { location: { origin: 'http://127.0.0.1:5505', href: 'http://127.0.0.1:5505/' } };
const { resolveSharedLoginUrl } = await import('../src/sharedLogin.js');
const technicianStorage = new Map([['lab_technician_access_token', 'token'], ['lab_technician_name', 'Tech'], ['other_role_token', 'preserve']]);
clearTechnicianAuth({ removeItem: key => technicianStorage.delete(key) });
assert.deepEqual([...technicianStorage.keys()], ['other_role_token']);
assert.equal(resolveSharedLoginUrl('', true), 'http://127.0.0.1:5504/');
assert.equal(resolveSharedLoginUrl('javascript:alert(1)', true), 'http://127.0.0.1:5504/');
assert.equal(resolveSharedLoginUrl('https://clinic.example/login/', false), 'https://clinic.example/login/');
assert.match(vite, /port: 5505/);
assert.match(html, /src="\/src\/main\.jsx"/);
assert.match(handoffHtml, /src="\/auth-handoff\.js"/);
assert.match(handoff, /const ROLE = 'lab_technician'/);
assert.match(handoff, /window\.location\.port === '5505'/);
assert.match(handoff, /event\.source !== window\.opener/);

function createHandoff({ search = '?role=lab_technician', port = '5505', fetchResponse } = {}) {
  const posted = [];
  const stored = new Map();
  const fetchCalls = [];
  let listener;
  let redirected = '';
  const opener = { postMessage: message => posted.push(message) };
  const status = { textContent: '', classList: { toggle() {} } };
  const fakeWindow = {
    opener,
    location: {
      search,
      port,
      pathname: '/auth-handoff.html',
      replace: value => { redirected = value; },
    },
    addEventListener: (type, callback) => {
      if (type === 'message') listener = callback;
    },
  };
  const context = {
    window: fakeWindow,
    document: { getElementById: () => status },
    URLSearchParams,
    URL,
    Set,
    Number,
    Object,
    Error,
    fetch: async (url, options) => {
      fetchCalls.push({ url, options });
      return fetchResponse || { ok: true, json: async () => [] };
    },
    localStorage: { setItem: (key, value) => stored.set(key, value) },
  };
  vm.runInNewContext(handoff, context);
  return { fakeWindow, opener, posted, stored, fetchCalls, status, listener, get redirected() { return redirected; } };
}

const technicianPayload = {
  access: 'test-access-token',
  refresh: 'test-refresh-token',
  technician_id: 5,
  user_id: 8,
  username: 'labtech',
  name: 'Technician',
};
const successful = createHandoff();
assert.equal(typeof successful.listener, 'function', 'Technician Vite destination exposes a runnable handoff page');
assert.ok(successful.posted.some(message => message.type === 'CLINIC_AUTH_READY' && message.role === 'lab_technician'));
await successful.listener({
  origin: 'https://untrusted.example',
  source: successful.opener,
  data: { type: 'CLINIC_AUTH_PAYLOAD', role: 'lab_technician', payload: technicianPayload },
});
assert.equal(successful.fetchCalls.length, 0, 'untrusted origins are ignored');
await successful.listener({
  origin: 'http://127.0.0.1:5504',
  source: {},
  data: { type: 'CLINIC_AUTH_PAYLOAD', role: 'lab_technician', payload: technicianPayload },
});
assert.equal(successful.fetchCalls.length, 0, 'messages from a different window are ignored');
await successful.listener({
  origin: 'http://127.0.0.1:5504',
  source: successful.opener,
  data: {
    type: 'CLINIC_AUTH_PAYLOAD',
    role: 'lab_technician',
    apiBase: 'http://127.0.0.1:8000',
    payload: technicianPayload,
  },
});
assert.equal(successful.fetchCalls[0].url, 'http://127.0.0.1:8000/api/lab-technician/orders/');
assert.equal(successful.fetchCalls[0].options.headers.Authorization, 'Bearer ' + technicianPayload.access);
assert.equal(successful.stored.get('lab_technician_access_token'), technicianPayload.access);
assert.equal(successful.stored.get('lab_technician_refresh_token'), technicianPayload.refresh);
assert.equal(successful.stored.get('lab_technician_id'), '5');
assert.equal(successful.redirected, '/');
assert.ok(successful.posted.some(message => message.type === 'CLINIC_AUTH_COMPLETE'));

const wrongRole = createHandoff();
await wrongRole.listener({
  origin: 'http://127.0.0.1:5504',
  source: wrongRole.opener,
  data: {
    type: 'CLINIC_AUTH_PAYLOAD',
    role: 'administrator',
    apiBase: 'http://127.0.0.1:8000',
    payload: technicianPayload,
  },
});
assert.equal(wrongRole.fetchCalls.length, 0, 'other roles are rejected before API validation');
assert.equal(wrongRole.stored.size, 0, 'other roles cannot populate Technician storage');
assert.ok(wrongRole.posted.some(message => message.type === 'CLINIC_AUTH_ERROR'));

const unauthorized = createHandoff({
  fetchResponse: { ok: false, json: async () => ({ detail: 'Forbidden' }) },
});
await unauthorized.listener({
  origin: 'http://127.0.0.1:5504',
  source: unauthorized.opener,
  data: {
    type: 'CLINIC_AUTH_PAYLOAD',
    role: 'lab_technician',
    apiBase: 'http://127.0.0.1:8000',
    payload: technicianPayload,
  },
});
assert.equal(unauthorized.stored.size, 0, 'unauthorized credentials are never stored');
assert.ok(unauthorized.posted.some(message => message.type === 'CLINIC_AUTH_ERROR'));
assert.equal(unauthorized.status.textContent.includes(technicianPayload.access), false, 'tokens are not exposed in UI errors');

const wrongDestination = createHandoff({ port: '5504' });
assert.equal(wrongDestination.listener, undefined, 'handoff cannot run on another module destination');
assert.equal(wrongDestination.posted.length, 0);
console.log('Laboratory Technician handoff and UI contracts passed.');
