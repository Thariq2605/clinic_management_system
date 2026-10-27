import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [app, auth, api, pharmacy, pages, vite, html] = await Promise.all([
  read('src/App.jsx'), read('src/app/AuthContext.jsx'), read('src/services/api.js'),
  read('src/services/pharmacy.js'), read('src/pages/PharmacyPages.jsx'), read('vite.config.js'), read('index.html'),
]);
const { clearPharmacistAuth } = await import('../src/services/authStorage.js');
globalThis.window = { location: { origin: 'http://127.0.0.1:5503', href: 'http://127.0.0.1:5503/' } };
const { resolveSharedLoginUrl } = await import('../src/services/sharedLogin.js');
assert.match(app, /path="prescriptions"/); assert.match(app, /path="dispensing"/); assert.match(app, /element={<Guard\s*\/>}/);
assert.match(auth, /\/pharmacist\/me\//); assert.match(auth, /pharmacist_access_token/); assert.match(auth, /setStatus\('error'\)/);
assert.match(api, /VITE_API_BASE_URL/); assert.match(api, /Authorization.*Bearer/); assert.match(api, /data, response\.status/); assert.match(api, /pharmacist:unauthorized/);
assert.match(auth, /resolveSharedLoginUrl\(import\.meta\.env\.VITE_SHARED_LOGIN_URL, import\.meta\.env\.DEV\)/); assert.match(auth, /pharmacist_profile/); assert.match(auth, /window\.location\.replace/);
const pharmacistStorageValues = new Map([['pharmacist_access_token', 'token'], ['pharmacist_user', '{"role":"Pharmacist"}'], ['pharmacist_profile', '{}'], ['undefined', '{"role":"Pharmacist"}'], ['unrelated', 'keep']]);
clearPharmacistAuth({ getItem: key => pharmacistStorageValues.get(key) ?? null, removeItem: key => pharmacistStorageValues.delete(key) });
assert.deepEqual([...pharmacistStorageValues.keys()], ['unrelated']);
assert.equal(resolveSharedLoginUrl('', true), 'http://127.0.0.1:5504/');
assert.equal(resolveSharedLoginUrl('javascript:alert(1)', true), 'http://127.0.0.1:5504/');
assert.equal(resolveSharedLoginUrl('https://clinic.example/login/', false), 'https://clinic.example/login/');
assert.match(pharmacy, /POST/); assert.match(pharmacy, /prescription-medicines/); assert.match(pages, /window\.confirm/);
assert.match(pages, /setBusy\(true\)/); assert.match(pages, /medicine_name/); assert.match(pages, /unit_price/);
assert.match(vite, /port: 5503/); assert.match(vite, /host: '127\.0\.0\.1'/); assert.match(html, /\/src\/main\.jsx/);
console.log('Pharmacist frontend contract checks passed.');
