const API = 'http://127.0.0.1:8000/pharmacist';
const LOW = 20, PER = 8;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const S = {
  user: json('user', null),
  meds: [],
  items: [],
  rx: [],
  bills: [],
  payments: [],
  view: 'Dashboard',
  page: 1,
  q: '',
  st: '',
  iq: '',
  ist: '',
  pq: '',
  tab: 'Profile',
  loading: true,
  err: '',
  d: null,
  log: json('log', []),
  prefs: json('prefs', { lowStock: true, expiry: true, theme: 'light' })
};
let authRedirecting = false;

const NAV = [
  { id: 'Dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
  { id: 'Prescriptions', label: 'Prescriptions', icon: 'bi-file-earmark-medical' },
  { id: 'Medicines', label: 'Medicines', icon: 'bi-capsule' },
  { id: 'Inventory', label: 'Inventory', icon: 'bi-boxes' },
  { id: 'Dispensing', label: 'Dispensing', icon: 'bi-prescription2' },
  { id: 'Payment', label: 'Payments', icon: 'bi-cash-coin' },
  { id: 'Profile', label: 'Profile', icon: 'bi-person-circle' },
  { id: 'Settings', label: 'Settings', icon: 'bi-gear' }
];

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = localStorage.getItem('pharmacist_access_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + path, { ...opts, headers });
  let j = null; try { j = await r.json() } catch { }
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) redirectToLogin(true);
    throw new Error(j?.detail || 'Request failed (' + r.status + ')');
  }
  return j;
}
function redirectToLogin(expired = false) {
  localStorage.removeItem('pharmacist_access_token');
  localStorage.removeItem('user');
  S.user = null;
  if (authRedirecting) return;
  authRedirecting = true;
  window.location.replace(expired ? '../login.html?expired=1' : '../login.html');
}
const list = j => Array.isArray(j) ? j : j.results || [];
const today = () => new Date().toISOString().slice(0, 10);
const money = v => '₹' + Number(v).toFixed(2);
function toast(m) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(t.t);
  t.t = setTimeout(() => t.classList.remove('show'), 2800);
}
function stock(m) {
  if (m.expiry_date < today()) return 'Expired';
  if (m.quantity < 1) return 'Out of Stock';
  return m.quantity <= LOW ? 'Low Stock' : 'Available';
}
const badge = s => `<span class="badge b-${s.split(' ')[0]}">${esc(s)}</span>`;

// Prescriptions are grouped from prescription-medicines, then enriched with
// patient/doctor/date pulled from the /prescriptions/ endpoint (S.rx).
function rxs() {
  const g = {};
  S.items.forEach(i => (g[i.prescription] ??= []).push(i));
  return Object.entries(g).map(([id, items]) => {
    const meta = S.rx.find(r => r.prescription_id === +id) || {};
    return {
      id: +id,
      items,
      meta,
      status: S.d?.busy === +id ? 'Processing' : items.some(i => i.is_active) ? 'Pending' : 'Dispensed'
    };
  }).sort((a, b) => b.id - a.id);
}
const medOf = i => S.meds.find(m => m.medicine_id === i.medicine);
const logAct = t => {
  S.log.unshift({ t, at: new Date().toISOString() });
  S.log = S.log.slice(0, 30);
  localStorage.setItem('log', JSON.stringify(S.log));
};

async function load() {
  S.loading = true;
  S.err = '';
  render();
  try {
    [S.meds, S.items, S.rx, S.bills, S.payments] = (await Promise.all([
      api('/medicines/'),
      api('/prescription-medicines/'),
      api('/prescriptions/'),
      api('/bills/'),
      api('/payments/')
    ])).map(list);
  } catch (e) {
    S.err = e.message === 'Failed to fetch'
      ? 'Cannot reach the server at ' + API + '. Check that Django is running and CORS is enabled.'
      : e.message;
  }
  S.loading = false;
  render();
}

/* ---------- views ---------- */
const state = (t, extra = '') => `<div class="card state"><h3>${t}</h3>${extra}</div>`;
const table = (heads, rows) => `<div class="tbl"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

function pager(total) {
  const pages = Math.max(1, Math.ceil(total / PER));
  return `<div class="pager"><span class="muted">${total} result${total === 1 ? '' : 's'} · Page ${S.page} of ${pages}</span>
   <span><button class="btn sm" data-a="pg" data-n="${S.page - 1}" ${S.page <= 1 ? 'disabled' : ''}>Previous</button>
   <button class="btn sm" data-a="pg" data-n="${S.page + 1}" ${S.page >= pages ? 'disabled' : ''}>Next</button></span></div>`;
}

function dashboard() {
  const r = rxs(), c = { Available: 0, 'Low Stock': 0, Expired: 0, 'Out of Stock': 0 };
  S.meds.forEach(m => c[stock(m)]++);
  const col = { Available: '#10b981', 'Low Stock': '#f59e0b', Expired: '#ef4444', 'Out of Stock': '#94a3b8' };
  const total = S.meds.length || 1;
  const alerts = S.meds.filter(m => stock(m) !== 'Available').slice(0, 6);
  const day = S.log.filter(l => l.at.slice(0, 10) === today() && l.t.startsWith('Dispensed')).length;
  const st = (l, v, k = '', icon = 'bi-activity') => `
    <div class="card stat ${k}">
      <div class="stat-content">
        <span class="stat-label">${l}</span>
        <b class="stat-val">${v}</b>
      </div>
      <div class="stat-icon"><i class="bi ${icon}"></i></div>
    </div>
  `;
  return `<div class="grid stats">
    ${st('Pending Prescriptions', r.filter(x => x.status === 'Pending').length, 'pri', 'bi-hourglass-split')}
    ${st('Dispensed Prescriptions', r.filter(x => x.status === 'Dispensed').length, '', 'bi-check2-circle')}
    ${st('Low Stock Medicines', c['Low Stock'], 'warn', 'bi-exclamation-triangle')}
    ${st('Expired Medicines', c.Expired, 'bad', 'bi-x-octagon')}
    ${st("Today's Dispensing", day, '', 'bi-calendar-check')}
  </div>
  <div class="grid two">
    <div class="card">
      <h3>Inventory Statistics</h3>
      <div class="bar" role="img" aria-label="Stock status breakdown">
        ${Object.keys(c).map(k => `<i style="width:${c[k] / total * 100}%;background:${col[k]}"></i>`).join('')}
      </div>
      <div class="legend">
        ${Object.keys(c).map(k => `<span>${k}: <b>${c[k]}</b></span>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Stock Alerts</h3>
      ${alerts.length ? `<ul class="list">${alerts.map(m => `<li><span>${esc(m.medicine_name)}</span>${badge(stock(m))}</li>`).join('')}</ul>` : '<p class="muted">No stock alerts. Inventory looks healthy.</p>'}
    </div>
    <div class="card" style="grid-column: 1 / -1;">
      <h3>Recent Dispensing Activity</h3>
      ${S.log.length ? `<ul class="list">${S.log.slice(0, 6).map(l => `<li><span>${esc(l.t)}</span><span class="muted">${new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>`).join('')}</ul>` : '<p class="muted">Dispensed prescriptions will appear here.</p>'}
    </div>
  </div>`;
}

function prescriptions() {
  let r = rxs().filter(x => (!S.st || x.status === S.st) && (!S.q || String(x.id).includes(S.q.replace('#', ''))));
  const rows = r.slice((S.page - 1) * PER, S.page * PER).map(x => `<tr><td>#${x.id}</td><td>${esc(x.meta.patient_name || '—')}</td><td>${esc(x.meta.doctor_name || '—')}</td><td>${esc(x.meta.prescription_date || '—')}</td><td>${badge(x.status)}</td>
   <td><button class="btn sm" data-a="rx" data-id="${x.id}"><i class="bi bi-eye me-1"></i>View</button>${x.status === 'Pending' ? `<button class="btn sm pri" data-a="dstart" data-id="${x.id}"><i class="bi bi-box-arrow-up-right me-1"></i>Dispense</button>` : ''}</td></tr>`);
  return `<div class="bar-tools"><input id="q" type="search" placeholder="Search by prescription ID" value="${esc(S.q)}" aria-label="Search prescriptions">
   <select id="st" aria-label="Filter by status"><option value="">All statuses</option>${['Pending', 'Processing', 'Dispensed', 'Cancelled'].map(s => `<option ${S.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
   <div class="card">${rows.length ? table(['Prescription ID', 'Patient', 'Doctor', 'Date', 'Status', 'Actions'], rows) + pager(r.length) : state('No prescriptions found', '<p>Try clearing the search or status filter.</p>')}</div>`;
}

function medicines() {
  const rows = S.meds.map(m => `<tr><td>${m.medicine_id}</td><td><b>${esc(m.medicine_name)}</b></td><td>${esc(m.manufacturer)}</td><td>${money(m.unit_price)}</td><td>${m.quantity}</td><td>${m.expiry_date}</td>
   <td><button class="btn sm" data-a="medit" data-id="${m.medicine_id}"><i class="bi bi-pencil me-1"></i>Edit</button><button class="btn sm bad" data-a="mdel" data-id="${m.medicine_id}"><i class="bi bi-trash me-1"></i>Delete</button></td></tr>`);
  return `<div class="bar-tools"><button class="btn pri" data-a="medit"><i class="bi bi-plus-lg me-1"></i>Add medicine</button></div>
   <div class="card">${rows.length ? table(['ID', 'Name', 'Manufacturer', 'Price per tablet / unit', 'Tablets / units in stock', 'Expiry', 'Actions'], rows) : state('No medicines yet', '<p>Add your first medicine to start tracking stock.</p>')}</div>`;
}

function inventory() {
  const f = S.meds.filter(m => (!S.ist || stock(m) === S.ist) && (!S.iq || (m.medicine_name + m.manufacturer).toLowerCase().includes(S.iq.toLowerCase())));
  const rows = f.map(m => `<tr><td>${m.medicine_id}</td><td><b>${esc(m.medicine_name)}</b></td><td>${esc(m.manufacturer)}</td><td>${money(m.unit_price)}</td><td>${m.quantity}</td><td>${m.expiry_date}</td><td>${badge(stock(m))}</td></tr>`);
  return `<div class="bar-tools"><input id="iq" type="search" placeholder="Search medicine or manufacturer" value="${esc(S.iq)}" aria-label="Search inventory">
   <select id="ist" aria-label="Filter by stock status"><option value="">All stock states</option>${['Available', 'Low Stock', 'Expired', 'Out of Stock'].map(s => `<option ${S.ist === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
   <div class="card">${rows.length ? table(['Medicine ID', 'Medicine Name', 'Manufacturer', 'Price per tablet / unit', 'Tablets / units in stock', 'Expiry Date', 'Stock Status'], rows) : state('No medicines match', '<p>Change the filters to see more.</p>')}</div>`;
}

const STEPS = ['Open prescription', 'Check availability', 'Enter quantities', 'Confirm', 'Billing and payment'];

function payments() {
  const rows = S.bills.filter(b => !S.pq || String(b.bill_id).includes(S.pq) || (b.patient_name || '').toLowerCase().includes(S.pq.toLowerCase()))
    .map(b => {
      const payment = S.payments.find(p => Number(p.bill) === Number(b.bill_id));
      const method = payment ? payment.payment_method.toUpperCase() : '—';
      return `<tr><td>#${b.bill_id}</td><td>${esc(b.patient_name || '—')}</td><td>${money(b.total_amount)}</td><td>${b.bill_date}</td>
      <td>${badge(b.payment_status === 'paid' ? 'Paid' : 'Pending')}</td>
      <td>${esc(method)}</td>
      <td>${b.payment_status !== 'paid'
        ? `<button class="btn sm pri" data-a="paynow" data-id="${b.bill_id}"><i class="bi bi-cash me-1"></i>Collect payment</button>`
        : `<button class="btn sm" data-a="receipt" data-id="${b.bill_id}"><i class="bi bi-printer me-1"></i>Print receipt</button>`}</td></tr>`;
    });
  return `<div class="bar-tools"><input id="pq" type="search" placeholder="Search by bill ID or patient" value="${esc(S.pq)}" aria-label="Search bills"></div>
   <div class="card">${rows.length ? table(['Bill ID', 'Patient', 'Amount', 'Date', 'Status', 'Method', 'Action'], rows) : state('No medicine bills yet', '<p>Bills appear here once a prescription has been dispensed.</p>')}</div>`;
}

function dispensing() {
  const d = S.d, steps = `<ol class="steps">${STEPS.map((s, i) => `<li class="${i + 1 === (d?.step || 1) ? 'on' : i + 1 < (d?.step || 1) ? 'done' : ''}">${s}</li>`).join('')}</ol>`;
  if (!d) {
    const p = rxs().filter(x => x.status === 'Pending');
    return steps + `<div class="card"><h3>Choose a prescription</h3>${p.length ? `<ul class="list">${p.map(x => `<li><span>Prescription #${x.id} · ${x.items.filter(i => i.is_active).length} medicine(s)</span><button class="btn sm pri" data-a="dstart" data-id="${x.id}"><i class="bi bi-box-arrow-up-right me-1"></i>Open</button></li>`).join('')}</ul>` : '<p class="muted">Nothing is waiting to be dispensed.</p>'}</div>`;
  }
  const items = d.rx.items, rows = items.map(i => {
    const m = medOf(i), s = m ? stock(m) : 'Out of Stock', ok = i.is_active && s !== 'Expired' && s !== 'Out of Stock';
    return { i, m, s, ok };
  });
  const dispatchStatus = d.fail.length
    ? d.done > 0 ? 'Partial' : 'Not Dispensed'
    : d.step === 5 ? 'Dispensed' : 'Processing';
  const head = `<div class="kv"><div><span>Prescription</span>#${d.rx.id}</div><div><span>Patient</span>${esc(d.rx.meta.patient_name || '—')} (#${esc(d.rx.meta.patient_id || '—')})</div><div><span>Prescriber</span>${esc(d.rx.meta.doctor_name || '—')} (#${esc(d.rx.meta.doctor_id || '—')})</div><div><span>Prescription date</span>${esc(d.rx.meta.prescription_date || '—')}</div><div><span>Status</span>${badge(dispatchStatus)}</div></div>`;
  let body = '';
  if (d.step === 2) body = table(['Medicine', 'In stock', 'Availability'], rows.map(r => `<tr><td>${esc(r.i.medicine_details)}</td><td>${r.m?.quantity ?? 0}</td><td>${r.i.is_active ? badge(r.s) : badge('Dispensed')}</td></tr>`));
  else if (d.step === 3 || d.step === 4) {
    const activeRows = rows.filter(r => r.i.is_active);
    const lineTotal = r => {
      const quantity = Number(d.quantities[r.i.item_id]);
      return r.ok && Number.isInteger(quantity) && quantity > 0 && r.m
        ? quantity * Number(r.m.unit_price)
        : 0;
    };
    const total = activeRows.reduce((sum, r) => sum + lineTotal(r), 0);
    const quantityRows = activeRows.map(r => `<tr>
      <td>${esc(r.i.medicine_details)}</td>
      <td>${d.step === 3
        ? r.ok
          ? `<input type="number" min="1" max="${r.m.quantity}" value="${esc(d.quantities[r.i.item_id] ?? '')}" data-qty-item="${r.i.item_id}" aria-label="Quantity to dispense for ${esc(r.i.medicine_details)}" required>`
          : '<span class="muted">Unavailable</span>'
        : r.ok ? esc(d.quantities[r.i.item_id]) : '<span class="muted">Unavailable</span>'}</td>
      <td>${money(r.m?.unit_price || 0)} / unit</td>
      <td data-line-total="${r.i.item_id}">${money(lineTotal(r))}</td>
      <td>${esc(r.i.dosage)}</td><td>${esc(r.i.frequency)}</td><td>${r.i.duration} days</td><td>${esc(r.i.instructions)}</td>
    </tr>`);
    body = `${table(['Medicine', 'Quantity', 'Price per unit', 'Line total', 'Dosage', 'Frequency', 'Duration', 'Instructions'], quantityRows)}
      <div class="receipt-total"><span>Estimated total</span><strong id="dispense-total">${money(total)}</strong></div>
      <p class="muted">Enter the number of individual tablets/units actually handed to the patient. Stock is reduced by this quantity; the final bill is calculated by the server. Unavailable items cannot be billed as dispensed, and an incomplete prescription will not produce a bill.</p>`;
  }
  else if (d.step === 5) {
    body = d.fail.length
      ? `${d.done > 0
        ? `<div class="alert warn">${d.done} medicine(s) dispensed; ${d.fail.length} could not be dispensed. This prescription is incomplete.</div>`
        : '<div class="alert warn">No medicines were dispensed. Resolve the stock issue before trying again.</div>'}
        <div class="alert bad">Not dispensed: ${esc(d.fail.join('; '))}</div>`
      : `<div class="alert ok">${d.done} medicine(s) dispensed successfully.</div>`;
    if (d.bill) {
      const billLines = (d.bill.items || []).map(item => `<tr>
        <td>${esc(item.medicine_name)}</td><td>${item.quantity}</td>
        <td>${money(item.unit_price)}</td><td>${money(item.line_total)}</td>
      </tr>`);
      body += `<div class="card" style="margin-top:12px"><h3>Medicine bill</h3>
        ${billLines.length ? table(['Medicine', 'Quantity', 'Price per unit', 'Line total'], billLines) : '<p class="muted">No item details are available for this older bill.</p>'}
        <div class="receipt-total"><span>Total due</span><strong>${money(d.bill.total_amount)}</strong></div>
        <div class="kv"><div><span>Payment status</span>${badge(d.bill.payment_status === 'paid' ? 'Paid' : 'Pending')}</div></div>
        ${d.bill.payment_status !== 'paid' ? `<form id="dispensing-payment-form" data-id="${d.bill.bill_id}">
          <h3>Record payment in this dispensing screen</h3>
          <label>Payment method<select name="payment_method" data-payment-method="dispensing" required>
            <option value="cash">Cash</option><option value="card">Card</option>
            <option value="upi">UPI</option><option value="online">Online transfer</option>
          </select></label>
          <label id="dispensing-reference-label" hidden>Transaction reference
            <input name="transaction_reference" maxlength="100" autocomplete="off">
          </label>
          <label class="check-label"><input name="payment_received" type="checkbox" required>
            I confirm the patient has paid the full amount shown above.
          </label>
          <p class="alert warn">Only record payment after receiving cash or verifying the transaction through the clinic's approved terminal/provider. If not paid now, leave the bill pending. The app does not process electronic payments.</p>
          <div class="actions"><button class="btn pri">Record payment received</button></div>
        </form>` : `<p class="alert ok">Payment recorded.</p><button class="btn" data-a="receipt" data-id="${d.bill.bill_id}"><i class="bi bi-printer me-1"></i>Print receipt</button>`}
      </div>`;
    } else if (d.billError) {
      body += `<div class="alert warn">Bill not created: ${esc(d.billError)}</div>`;
    }
  }
  const blocked = rows.some(r => r.i.is_active && !r.ok);
  const noDispensableItems = d.step === 2 && !rows.some(r => r.ok);
  const warn = d.step === 2 && blocked
    ? noDispensableItems
      ? '<div class="alert warn">No prescribed medicines are currently available. Contact the inventory manager and restock before dispensing.</div>'
      : '<div class="alert warn">Some medicines are unavailable. You can dispense only the available items; the prescription will remain incomplete until every item is resolved.</div>'
    : '';
  const nav = d.step < 5 ? `<div class="actions"><button class="btn" data-a="dcancel">Cancel</button>
    ${d.step === 4 ? `<button class="btn pri" data-a="dconfirm" ${d.busyNow ? 'disabled' : ''}>${d.busyNow ? 'Dispensing…' : 'Confirm quantities and dispense'}</button>` : `<button class="btn pri" data-a="dnext" ${noDispensableItems ? 'disabled' : ''}>Continue</button>`}</div>`
    : `<div class="actions"><button class="btn pri" data-a="dcancel">Done</button></div>`;
  return steps + `<div class="card">${head}${warn}${body}${nav}</div>`;
}

function profile() {
  const u = S.user;
  const displayName = u.name || u.username;
  return `<div class="card"><div class="kv"><div><span>Name</span>${esc(displayName)}</div><div><span>Username</span>${esc(u.username)}</div><div><span>User ID</span>${u.user_id}</div><div><span>Role</span>${esc(u.role || 'Pharmacist')}</div>
   <div><span>Department</span>Pharmacy</div><div><span>Account status</span>${badge('Available').replace('Available', 'Active')}</div></div></div>`;
}

function settings() {
  const tabs = ['Profile', 'Password', 'Notifications'];
  let b = '';
  if (S.tab === 'Profile') b = profile().replace('class="card"', '');
  if (S.tab === 'Password') b = `<form id="pw"><label>Current password<input type="password" required></label><label>New password<input type="password" minlength="8" required></label><button class="btn pri">Update password</button></form>`;
  if (S.tab === 'Notifications') b = [['lowStock', 'Low stock alerts'], ['expiry', 'Expiry alerts']].map(([k, l]) => `<div class="row"><span>${l}</span><input type="checkbox" data-pref="${k}" ${S.prefs[k] ? 'checked' : ''} aria-label="${l}"></div>`).join('');
  return `<div class="tabs" role="tablist">${tabs.map(t => `<button class="btn" role="tab" aria-selected="${S.tab === t}" data-a="tab" data-id="${t}">${t}</button>`).join('')}</div><div class="card">${b}</div>`;
}

const VIEWS = { Dashboard: dashboard, Prescriptions: prescriptions, Medicines: medicines, Inventory: inventory, Dispensing: dispensing, Payment: payments, Profile: profile, Settings: settings };

function render() {
  if (!S.user) {
    if (!authRedirecting) window.location.replace('../login.html');
    return;
  }

  const displayName = S.user.name || S.user.username || 'Pharmacist';
  const whoEl = $('#who');
  if (whoEl) whoEl.textContent = displayName;
  const avatarEl = $('#userAvatar');
  if (avatarEl) avatarEl.textContent = (displayName[0] || 'P').toUpperCase();

  const navEl = $('#nav');
  if (navEl) {
    navEl.innerHTML = NAV.map(n => `
      <button data-a="nav" data-id="${n.id}" class="nav-link ${n.id === S.view ? 'active' : ''}" ${n.id === S.view ? 'aria-current="page"' : ''}>
        <i class="bi ${n.icon}"></i>
        <span>${n.label}</span>
      </button>
    `).join('');
  }

  const titleEl = $('#title');
  if (titleEl) titleEl.textContent = S.view;

  const needsData = !['Profile', 'Settings'].includes(S.view);
  const mainEl = $('#main');
  if (mainEl) {
    mainEl.innerHTML = !needsData ? VIEWS[S.view]()
      : S.loading ? '<div class="card"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>'
        : S.err ? `<div class="alert bad" role="alert">${esc(S.err)} <button class="btn sm" data-a="retry">Try again</button></div>`
          : VIEWS[S.view]();
  }
}

/* ---------- modal ---------- */
const modal = h => { const m = $('#modal'); m.innerHTML = h; m.showModal() };
function rxModal(id) {
  const x = rxs().find(r => r.id === id);
  modal(`<h3>Prescription #${id}</h3><div class="kv" style="margin-top:14px"><div><span>Patient</span>${esc(x.meta.patient_name || '—')} (#${esc(x.meta.patient_id || '—')})</div><div><span>Prescriber</span>${esc(x.meta.doctor_name || '—')} (#${esc(x.meta.doctor_id || '—')})</div><div><span>Prescription date</span>${esc(x.meta.prescription_date || '—')}</div><div><span>Status</span>${badge(x.status)}</div></div>
   ${table(['Medicine Name', 'Dosage', 'Frequency / timing', 'Duration', 'Food / other instructions'], x.items.map(i => `<tr><td>${esc(i.medicine_details)}</td><td>${esc(i.dosage)}</td><td>${esc(i.frequency)}</td><td>${i.duration} days</td><td>${esc(i.instructions)}</td></tr>`))}
   <div class="actions"><button class="btn" data-a="close">Close</button></div>`);
}
function medModal(id) {
  const m = S.meds.find(x => x.medicine_id === id) || {};
  const f = (n, l, t = 'text', ex = '') => `<label>${l}<input name="${n}" type="${t}" value="${esc(m[n] ?? '')}" required ${ex}></label>`;
  modal(`<h3>${id ? 'Edit' : 'Add'} medicine</h3><form id="medForm" data-id="${id || ''}" style="margin-top:14px">${f('medicine_name', 'Medicine name')}${f('manufacturer', 'Manufacturer')}
   ${f('unit_price', 'Price per tablet / unit', 'number', 'step="0.01" min="0"')}${f('quantity', 'Tablets / units in stock', 'number', 'min="0"')}${f('expiry_date', 'Expiry date', 'date')}
   <div class="actions"><button type="button" class="btn" data-a="close">Cancel</button><button class="btn pri">Save medicine</button></div></form>`);
}

function paymentModal(billId) {
  const bill = S.bills.find(item => Number(item.bill_id) === Number(billId));
  if (!bill) {
    toast('Bill was not found. Refresh the page and try again.');
    return;
  }
  const billLines = (bill.items || []).map(item => `<tr>
    <td>${esc(item.medicine_name)}</td><td>${item.quantity}</td>
    <td>${money(item.unit_price)}</td><td>${money(item.line_total)}</td>
  </tr>`);
  modal(`<h3>Collect payment for bill #${bill.bill_id}</h3>
    <p class="muted">${esc(bill.patient_name || 'Patient')} · Amount due: <strong>${money(bill.total_amount)}</strong></p>
    ${billLines.length
      ? table(['Medicine', 'Quantity', 'Price per unit', 'Line total'], billLines)
      : '<p class="alert warn">This older bill has no saved dispense-quantity details. Verify the amount against the original dispensing record before collecting payment.</p>'}
    <form id="payment-form" data-id="${bill.bill_id}" style="margin-top:14px">
      <label>Payment method
        <select name="payment_method" required>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="online">Online transfer</option>
        </select>
      </label>
      <label id="payment-reference-label" hidden>Transaction reference
        <input name="transaction_reference" maxlength="100" autocomplete="off">
      </label>
      <label class="check-label"><input name="amount_verified" type="checkbox" required>
        I verified this bill against the actual quantity dispensed.
      </label>
      <p class="alert warn">For card or electronic payments, first verify payment using the clinic's approved terminal/provider. This app records the payment; it does not process or verify electronic transactions. “Credit” remains unpaid and is not recorded as a completed payment.</p>
      <div class="actions"><button type="button" class="btn" data-a="close">Cancel</button><button class="btn pri">Confirm payment received</button></div>
    </form>`);
  const form = $('#payment-form');
  const method = form.elements.payment_method;
  const referenceLabel = $('#payment-reference-label');
  const referenceInput = form.elements.transaction_reference;
  const updateReference = () => {
    const needsReference = method.value !== 'cash';
    referenceLabel.hidden = !needsReference;
    referenceInput.required = needsReference;
  };
  method.addEventListener('change', updateReference);
  updateReference();
}

function showReceipt(billId) {
  const bill = S.bills.find(item => Number(item.bill_id) === Number(billId));
  const payment = S.payments.find(item => Number(item.bill) === Number(billId));
  if (!bill || bill.payment_status !== 'paid' || !payment) {
    toast('A completed payment receipt is not available for this bill.');
    return;
  }
  const printArea = $('#print-area');
  const billLines = (bill.items || []).map(item => `<tr>
    <td>${esc(item.medicine_name)}</td><td>${item.quantity}</td>
    <td>${money(item.unit_price)}</td><td>${money(item.line_total)}</td>
  </tr>`).join('');
  printArea.innerHTML = `<article class="receipt">
    <header><h1>MEDICARE</h1><p>Clinic Pharmacy · Payment receipt</p></header>
    <h2>PAYMENT RECEIPT</h2>
    <p class="receipt-note">Payment record; not a tax invoice.</p>
    <dl>
      <div><dt>Bill number</dt><dd>#${esc(bill.bill_id)}</dd></div>
      <div><dt>Patient</dt><dd>${esc(bill.patient_name || '—')}</dd></div>
      <div><dt>Appointment</dt><dd>#${esc(bill.appointment)}</dd></div>
      <div><dt>Bill date</dt><dd>${esc(bill.bill_date)}</dd></div>
      <div><dt>Payment date</dt><dd>${esc(payment.payment_date || '—')}</dd></div>
      <div><dt>Payment method</dt><dd>${esc(String(payment.payment_method || '').toUpperCase())}</dd></div>
      ${payment.transaction_reference ? `<div><dt>Transaction reference</dt><dd>${esc(payment.transaction_reference)}</dd></div>` : ''}
    </dl>
    ${billLines ? `<h3>Items dispensed</h3>${table(['Medicine', 'Quantity', 'Unit price', 'Line total'], [billLines])}` : ''}
    <div class="receipt-total"><span>Bill total</span><strong>${money(bill.total_amount)}</strong></div>
    <div class="receipt-total"><span>Amount received</span><strong>${money(payment.amount)}</strong></div>
    <p class="receipt-note">Medicine charge recorded by the clinic pharmacy. Please retain this receipt.</p>
  </article>`;
  printArea.hidden = false;
  window.print();
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  if (a === 'menu') { $('#side').classList.toggle('open'); $('.scrim').classList.toggle('open') }
  if (a === 'nav') { S.view = id; S.page = 1; $('#side').classList.remove('open'); $('.scrim').classList.remove('open'); render(); $('#main').focus() }
  if (a === 'close') $('#modal').close();
  if (a === 'close-print') {
    $('#modal').close();
    $('#print-area').hidden = true;
    $('#print-area').innerHTML = '';
  }
  if (a === 'retry') load();
  if (a === 'pg') { S.page = +el.dataset.n; render() }
  if (a === 'tab') { S.tab = id; render() }
  if (a === 'rx') rxModal(+id);
  if (a === 'medit') medModal(id ? +id : 0);
  if (a === 'logout') {
    redirectToLogin();
    return;
  }
  if (a === 'mdel' && confirm('Deactivate this medicine? It will be removed from active inventory but kept in historical records.')) {
    try { await api(`/medicines/${id}/`, { method: 'DELETE' }); toast('Medicine deactivated'); load() } catch (x) { toast(x.message) }
  }
  if (a === 'dstart') {
    const rx = rxs().find(r => r.id === +id);
    S.d = {
      rx,
      step: 2,
      done: 0,
      fail: [],
      quantities: Object.fromEntries(rx.items.map(item => [item.item_id, ''])),
    };
    S.d.busy = +id;
    S.view = 'Dispensing';
    $('#modal').open && $('#modal').close();
    render();
  }
  if (a === 'dnext') {
    if (S.d.step === 3) {
      const invalid = S.d.rx.items.filter(item => item.is_active && medOf(item) && stock(medOf(item)) !== 'Expired' && medOf(item).quantity > 0).find(item => {
        const quantity = Number(S.d.quantities[item.item_id]);
        const medicine = medOf(item);
        return !Number.isInteger(quantity) || quantity < 1 || !medicine ||
          quantity > medicine.quantity || stock(medicine) === 'Expired';
      });
      if (invalid) {
        toast(`Enter a valid quantity in stock for ${invalid.medicine_details}.`);
        return;
      }
    }
    S.d.step++;
    render();
  }
  if (a === 'dcancel') { S.d = null; render() }
  if (a === 'dconfirm') {
    S.d.busyNow = true; render();
    for (const i of S.d.rx.items.filter(i => i.is_active)) {
      const medicine = medOf(i);
      if (!medicine || stock(medicine) === 'Expired' || medicine.quantity < 1) {
        S.d.fail.push(`${i.medicine_details}: unavailable; not dispensed`);
        continue;
      }
      try {
        await api(`/prescription-medicines/${i.item_id}/dispense/`, {
          method: 'POST',
          body: JSON.stringify({ quantity: Number(S.d.quantities[i.item_id]) }),
        });
        S.d.done++;
        logAct(`Dispensed ${S.d.quantities[i.item_id]} unit(s) of ${i.medicine_details} (Rx #${S.d.rx.id})`);
      }
      catch (x) { S.d.fail.push(i.medicine_details + ': ' + x.message) }
    }
    try { S.d.bill = await api(`/prescriptions/${S.d.rx.id}/bill/`, { method: 'POST' }); }
    catch (x) { S.d.billError = x.message; }
    S.d.busyNow = false; S.d.step = 5; S.d.busy = null; render(); load();
  }
  if (a === 'paynow') {
    paymentModal(id);
    return;
  }
  if (a === 'receipt') {
    showReceipt(id);
    return;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.qtyItem && S.d) {
    const itemId = Number(t.dataset.qtyItem);
    S.d.quantities[itemId] = t.value;
    const item = S.d.rx.items.find(row => Number(row.item_id) === itemId);
    const medicine = item && medOf(item);
    const quantity = Number(t.value);
    const lineTotal = medicine && Number.isInteger(quantity) && quantity > 0
      ? quantity * Number(medicine.unit_price)
      : 0;
    const lineElement = $(`[data-line-total="${itemId}"]`);
    if (lineElement) lineElement.textContent = money(lineTotal);
    const total = S.d.rx.items.filter(row => row.is_active).reduce((sum, row) => {
      const rowMedicine = medOf(row);
      const rowQuantity = Number(S.d.quantities[row.item_id]);
      return rowMedicine && rowMedicine.quantity > 0 && stock(rowMedicine) !== 'Expired' &&
        Number.isInteger(rowQuantity) && rowQuantity > 0
        ? sum + rowQuantity * Number(rowMedicine.unit_price)
        : sum;
    }, 0);
    const totalElement = $('#dispense-total');
    if (totalElement) totalElement.textContent = money(total);
  }
  if (t.id === 'q') { S.q = t.value; S.page = 1; render(); $('#q').focus(); $('#q').setSelectionRange(99, 99) }
  if (t.id === 'iq') { S.iq = t.value; render(); $('#iq').focus(); $('#iq').setSelectionRange(99, 99) }
  if (t.id === 'pq') { S.pq = t.value; render(); $('#pq').focus(); $('#pq').setSelectionRange(99, 99) }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.paymentMethod === 'dispensing') {
    const label = $('#dispensing-reference-label');
    const input = label?.querySelector('input');
    if (label && input) {
      const needsReference = t.value !== 'cash';
      label.hidden = !needsReference;
      input.required = needsReference;
    }
  }
  if (t.id === 'st') { S.st = t.value; S.page = 1; render() }
  if (t.id === 'ist') { S.ist = t.value; render() }
  if (t.dataset.pref) { S.prefs[t.dataset.pref] = t.type === 'checkbox' ? t.checked : t.value; localStorage.setItem('prefs', JSON.stringify(S.prefs)); render(); toast('Preference saved') }
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'payment-form' || f.id === 'dispensing-payment-form') {
    const billId = f.dataset.id;
    const formData = new FormData(f);
    const body = Object.fromEntries(formData);
    const integratedPayment = f.id === 'dispensing-payment-form';
    body.amount_verified = integratedPayment
      ? f.elements.payment_received.checked
      : f.elements.amount_verified.checked;
    delete body.payment_received;
    if (!body.transaction_reference) delete body.transaction_reference;
    const submitButton = f.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) submitButton.disabled = true;
    try {
      const paidBill = await api(`/bills/${billId}/pay/`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      S.bills = S.bills.map(bill => Number(bill.bill_id) === Number(billId) ? paidBill : bill);
      if (S.d?.bill && Number(S.d.bill.bill_id) === Number(billId)) S.d.bill = paidBill;
      let paymentDetailsError = '';
      try {
        const payments = await api(`/payments/?bill=${billId}`);
        S.payments = [...S.payments.filter(payment => Number(payment.bill) !== Number(billId)), ...list(payments)];
      } catch (error) {
        paymentDetailsError = error.message;
      }
      if (integratedPayment) {
        toast(!paymentDetailsError
          ? 'Payment recorded in the dispensing workflow.'
          : `Payment recorded, but receipt details could not be refreshed: ${paymentDetailsError}. Reload before printing.`);
      } else {
        $('#modal').close();
        toast(!paymentDetailsError
          ? 'Payment recorded. Print the receipt for the patient.'
          : `Payment recorded, but receipt details could not be refreshed: ${paymentDetailsError}. Reload before printing.`);
        if (!paymentDetailsError) showReceipt(billId);
      }
      render();
    } catch (x) {
      if (submitButton) submitButton.disabled = false;
      toast(x.message);
    }
  }
  if (f.id === 'medForm') {
    const id = f.dataset.id, body = { ...Object.fromEntries(new FormData(f)), is_active: true };
    try { await api(id ? `/medicines/${id}/` : '/medicines/', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); $('#modal').close(); toast('Medicine saved'); load() }
    catch (x) { toast(x.message) }
  }
  if (f.id === 'pw') toast('Password change needs a backend endpoint first');
});

window.addEventListener('afterprint', () => {
  const printArea = $('#print-area');
  if (printArea) {
    printArea.hidden = true;
    printArea.innerHTML = '';
  }
});

// Auth Guard & Initialization
if (!S.user || !localStorage.getItem('pharmacist_access_token')) {
  redirectToLogin();
} else {
  load();
}
