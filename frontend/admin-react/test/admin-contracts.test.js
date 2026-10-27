import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clearAdminAuthFromStorage, classifyAdminAuthResult, formatApiErrorData, getAdminTokenFromStorage, resolveApiOrigin, resolveSharedLoginUrl } from '../src/services/apiCore.js';
import { buildResourcePayload } from '../src/services/resourcePayload.js';
import { normalizeResourceValues, validateResource, validateResourceField } from '../src/services/resourceValidation.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}

test('API origin uses documented development default and trims trailing slash', () => {
  assert.equal(resolveApiOrigin(''), 'http://127.0.0.1:8000');
  assert.equal(resolveApiOrigin('https://clinic.example/'), 'https://clinic.example');
});

test('shared login uses the central development app, honors valid overrides, and safely handles invalid configuration', () => {
  assert.equal(resolveSharedLoginUrl({ development: true, origin: 'http://127.0.0.1:5502' }), 'http://127.0.0.1:5504/');
  assert.equal(resolveSharedLoginUrl({ configured: 'https://clinic.example/login.html', development: true, origin: 'http://localhost:5502' }), 'https://clinic.example/login.html');
  assert.equal(resolveSharedLoginUrl({ configured: 'javascript:alert(1)', development: true, origin: 'http://127.0.0.1:5502' }), 'http://127.0.0.1:5504/');
});

test('Admin sign out clears Admin credentials before leaving the React app', async () => {
  const layout = await readFile(new URL('../src/layouts/AdminLayout.jsx', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/app/AuthContext.jsx', import.meta.url), 'utf8');
  assert.match(layout, /onClick=\{logout\}/);
  assert.match(auth, /clearAdminAuth\(\);\s*setState\(\{ status: 'checking', user: null, error: '' \}\);\s*window\.location\.replace\(sharedLoginUrl\(\)\)/);
  assert.match(auth, /VITE_SHARED_LOGIN_URL/);
});

test('Admin token selection does not mistake another role token for an Admin credential', () => {
  assert.equal(getAdminTokenFromStorage(storage({ access_token: 'doctor-token', current_user: JSON.stringify({ role: 'Doctor' }) })), null);
  assert.equal(getAdminTokenFromStorage(storage({ access_token: 'admin-token', current_user: JSON.stringify({ role: 'Administrator' }) })), 'admin-token');
  assert.equal(getAdminTokenFromStorage(storage({ admin_token: 'explicit-admin', access_token: 'explicit-admin' })), 'explicit-admin');
});

test('invalid Admin auth clears Admin credentials without clearing unrelated access tokens', () => {
  const doctorStorage = storage({ access_token: 'doctor-token', current_user: JSON.stringify({ role: 'Doctor' }) });
  clearAdminAuthFromStorage(doctorStorage);
  assert.equal(doctorStorage.getItem('access_token'), 'doctor-token');
  const adminStorage = storage({ admin_token: 'admin-token', access_token: 'admin-token', current_user: JSON.stringify({ role: 'Administrator' }) });
  clearAdminAuthFromStorage(adminStorage);
  assert.equal(adminStorage.getItem('admin_token'), null);
  assert.equal(adminStorage.getItem('access_token'), null);
});

test('Admin route guard decisions distinguish authorized, unauthorized, and retryable outcomes', () => {
  assert.equal(classifyAdminAuthResult({ status: 200, role: 'Administrator' }), 'authorized');
  assert.equal(classifyAdminAuthResult({ status: 200, role: 'Pharmacist' }), 'redirect');
  assert.equal(classifyAdminAuthResult({ status: 401 }), 'redirect');
  assert.equal(classifyAdminAuthResult({ status: 403 }), 'redirect');
  assert.equal(classifyAdminAuthResult({ status: 0 }), 'retry');
  assert.equal(classifyAdminAuthResult({ status: 503 }), 'retry');
});

test('DRF field and non-field errors retain useful messages', () => {
  assert.equal(formatApiErrorData({ full_name: ['Enter a valid name.'], mobile_number: ['Already used.'] }), 'full name: Enter a valid name. · mobile number: Already used.');
  assert.equal(formatApiErrorData({ detail: 'Not found.' }), 'Not found.');
  assert.equal(formatApiErrorData({ non_field_errors: ['Invalid data.'] }), 'non field errors: Invalid data.');
});

test('resource payload conversion retains existing field names and numeric types', () => {
  const fields = [{ name: 'role' }, { name: 'quantity', type: 'number' }, { name: 'password', omitEmpty: true }, { name: 'username', omitOnEdit: true }];
  assert.deepEqual(buildResourcePayload(fields, { role: '3', quantity: '12', password: '', username: 'admin' }, 'edit'), { role: '3', quantity: 12 });
  assert.deepEqual(buildResourcePayload(fields, { role: '3', quantity: '12', password: '', username: 'staff' }, 'create'), { role: '3', quantity: 12, username: 'staff' });
});

test('resource validation enforces mobile, email, dates, amounts, integers, and availability', () => {
  const mobile = { name: 'mobile_number', label: 'Mobile number', required: true, validation: 'mobile' };
  for (const value of ['6123456789', '7123456789', '8123456789', '9123456789']) assert.equal(validateResourceField(mobile, value), '');
  for (const value of ['123456789', '61234567890', '5123456789', '61234a6789', '61234 6789', '61234-6789']) assert.ok(validateResourceField(mobile, value));
  assert.match(validateResourceField({ name: 'email', label: 'Email', required: true, type: 'email' }, 'not-an-email'), /valid email/i);
  assert.match(validateResourceField({ name: 'dob', label: 'Date of birth', required: true, validation: 'date-of-birth' }, 'not-a-date'), /valid date/i);
  const future = new Date(); future.setDate(future.getDate() + 1);
  const futureDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  assert.match(validateResourceField({ name: 'dob', label: 'Date of birth', required: true, validation: 'date-of-birth' }, futureDate), /future/i);
  assert.match(validateResourceField({ name: 'fee', label: 'Fee', required: true, type: 'number' }, '-1'), /negative/i);
  assert.match(validateResourceField({ name: 'slot', label: 'Appointment slot duration', required: true, type: 'number', min: 1, integer: true }, '0'), /at least 1/i);
  assert.match(validateResourceField({ name: 'quantity', label: 'Quantity', required: true, type: 'number', integer: true }, '1.5'), /whole number/i);
  const values = { start_time: '14:00', end_time: '13:00' };
  assert.match(validateResourceField({ name: 'end_time', label: 'End time', required: true, type: 'time' }, values.end_time, values), /later/i);
});

test('resource validation catches required fields and normalizes names before submission', () => {
  const fields = [{ name: 'full_name', label: 'Full name', required: true }, { name: 'department', label: 'Department', required: true }];
  assert.deepEqual(validateResource(fields, { full_name: '  ', department: '' }), { full_name: 'Full name is required.', department: 'Department is required.' });
  assert.deepEqual(normalizeResourceValues(fields, { full_name: '  Ada Lovelace-O’Connor  ', department: ' 4 ' }), { full_name: 'Ada Lovelace-O’Connor', department: '4' });
  assert.match(validateResourceField({ name: 'password', label: 'Password', required: true, type: 'password' }, ''), /required/i);
  assert.equal(validateResourceField({ name: 'password', label: 'New password', required: false, type: 'password' }, ''), '');
  assert.match(validateResourceField({ name: 'password', label: 'Password', required: true, type: 'password', minLength: 8 }, 'short'), /at least 8/i);
  assert.match(validateResourceField({ name: 'password', label: 'Password', required: false, type: 'password', minLength: 8 }, '        '), /whitespace/i);
});

test('doctor availability uses the supported endpoint, numeric Monday-zero weekdays, validation, and editable row actions', async () => {
  const resources = await readFile(new URL('../src/services/resources.jsx', import.meta.url), 'utf8');
  const pages = await readFile(new URL('../src/pages/ResourcePages.jsx', import.meta.url), 'utf8');
  const resourcePage = await readFile(new URL('../src/components/ResourcePage.jsx', import.meta.url), 'utf8');
  assert.match(resources, /endpoint: '\/api\/admin\/doctor-availability\/'/);
  for (const field of ['doctor', 'weekday', 'start_time', 'end_time', 'is_active']) assert.ok(resources.includes(`'${field}'`));
  assert.match(resources, /value: 0, label: 'Monday'.*[\s\S]*value: 6, label: 'Sunday'/);
  assert.match(resources, /validation: 'weekday', coerce: 'number'/);
  assert.match(pages, /resources\.doctorAvailability\} allowDelete=\{false\}/);
  assert.match(resourcePage, /actions=\{rowActions \?/);
  assert.match(resourcePage, /allowDelete &&/);
  assert.match(resourcePage, /toggleStatus\(row\)/);
  assert.equal(validateResourceField({ name: 'weekday', label: 'Weekday', required: true, validation: 'weekday' }, '6'), '');
  for (const value of ['-1', '7', '1.5']) assert.match(validateResourceField({ name: 'weekday', label: 'Weekday', required: true, validation: 'weekday' }, value), /weekday/i);
  assert.deepEqual(buildResourcePayload([{ name: 'weekday', coerce: 'number' }], { weekday: '4' }, 'create'), { weekday: 4 });
  const timeFields = [{ name: 'start_time', label: 'Start time', required: true, type: 'time' }, { name: 'end_time', label: 'End time', required: true, type: 'time' }];
  assert.match(validateResource(timeFields, { start_time: '17:00', end_time: '09:00' }).end_time, /later/i);
});

test('Doctor administration creates linked accounts and clearly routes contact editing to Staff', async () => {
  const resources = await readFile(new URL('../src/services/resources.jsx', import.meta.url), 'utf8');
  const pages = await readFile(new URL('../src/pages/ResourcePages.jsx', import.meta.url), 'utf8');
  const profile = await readFile(new URL('../src/pages/DoctorProfilePanel.jsx', import.meta.url), 'utf8');
  assert.match(resources, /doctors:\s*\{/);
  for (const field of ['full_name', 'username', 'password', 'gender', 'dob', 'account_email', 'account_mobile_number', 'department', 'specialization', 'consultation_fee', 'qualification', 'experience_years', 'license_number']) assert.ok(resources.includes(`'${field}'`));
  assert.match(resources, /type: 'password', minLength: 8, validation: 'password'/);
  assert.match(resources, /effective_access_active/);
  assert.match(pages, /ambiguousCreateMessage/);
  assert.match(pages, /detailRenderer=\{\(row, onSaved\) => <DoctorProfilePanel row=\{row\} onSaved=\{onSaved\} \/>\}/);
  assert.match(profile, /\/api\/admin\/staff\/\$\{row\.staff_id\}\//);
  assert.match(profile, /Save Staff contact/);
  assert.match(profile, /Doctor, Staff, User, and Role status are independent/);
  assert.match(profile, /User and Doctor status were not changed/);
});

test('Vite preserves shared login assets and the Auth Handoff contract', async () => {
  const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const handoff = await readFile(new URL('../public/auth-handoff.js', import.meta.url), 'utf8');
  const legacyLogin = await readFile(new URL('../../login.html', import.meta.url), 'utf8');
  assert.match(vite, /\['\/login\.html', path\.join\(frontendRoot, 'login\.html'\)\]/);
  for (const asset of ['/js/api.js', '/js/common.js', '/js/auth.js', '/css/style.css', '/css/login.css']) assert.ok(vite.includes(asset));
  assert.match(readme, /pages\/admin_dashboard\.html/);
  assert.match(handoff, /CLINIC_AUTH_READY/);
  assert.match(handoff, /CLINIC_AUTH_PAYLOAD/);
  assert.match(handoff, /api\/admin\/me/);
  assert.match(legacyLogin, /login\.html|login-form/);
});

test('React router declares each requested Admin route', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const route of ['users', 'roles', 'doctors', 'receptionists', 'patients', 'departments', 'specializations', 'medicines', 'lab-tests', 'appointments', 'billing', 'payments', 'reports', 'settings']) {
    assert.ok(app.includes(`path="${route}"`), `missing route: ${route}`);
  }
  assert.match(app, /index element=\{<DashboardPage \/>\}/);
  assert.ok(app.includes('path="pages/admin_dashboard.html"'), 'legacy shared-login redirect must open the React dashboard');
});
