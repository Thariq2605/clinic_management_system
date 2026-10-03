/**
 * CLINIC MANAGEMENT SYSTEM - BILLING & PAYMENTS MODULE
 * Uses appointments as the source for billing information.
 * Handles recording consultation payments, pre-payment balance checks,
 * and viewing complete payment history.
 */

let recordPaymentModal = null;
let historyModal = null;
let currentAppointmentId = null;
let currentBalance = 0;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

  const payModalEl = document.getElementById("billingPaymentModal");
  if (payModalEl) {
    recordPaymentModal = new bootstrap.Modal(payModalEl);
  }

  const histModalEl = document.getElementById("billingHistoryModal");
  if (histModalEl) {
    historyModal = new bootstrap.Modal(histModalEl);
  }

  loadBillingRecords();

  const statusFilter = document.getElementById("billing-status-filter");
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      loadBillingRecords();
    });
  }

  const searchInput = document.getElementById("billing-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      loadBillingRecords();
    }, 300));
  }

  const payForm = document.getElementById("billing-payment-form");
  if (payForm) {
    payForm.addEventListener("submit", handleBillingPaymentSubmit);
  }
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Fetch and render billing table using appointments as the source
 */
async function loadBillingRecords() {
  const tbody = document.getElementById("billing-tbody");
  const spinner = document.getElementById("billing-loading-spinner");
  const emptyState = document.getElementById("billing-empty-state");

  if (spinner) spinner.classList.remove("d-none");
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  const statusFilter = document.getElementById("billing-status-filter")?.value || "";
  const searchFilter = document.getElementById("billing-search-input")?.value.trim() || "";

  try {
    const appointments = await apiGet("/appointments/");

    // Filter appointments
    let filtered = appointments.filter((apt) => {
      if ((apt.status || "").toLowerCase() === "cancelled") return false;

      const payStatus = (apt.payment_status || "Pending").toLowerCase();
      if (statusFilter && statusFilter !== "all") {
        if (payStatus !== statusFilter.toLowerCase()) return false;
      }

      if (searchFilter) {
        const query = searchFilter.toLowerCase();
        const pName = (apt.patient_name || "").toLowerCase();
        const dName = (apt.doctor_name || "").toLowerCase();
        const token = (apt.token_number || "").toLowerCase();
        const id = String(apt.appointment_id);
        if (!pName.includes(query) && !dName.includes(query) && !token.includes(query) && !id.includes(query)) {
          return false;
        }
      }

      return true;
    });

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      renderBillingTable(filtered, tbody);
    }
  } catch (error) {
    console.error("Billing fetch error:", error);
    if (emptyState) emptyState.classList.remove("d-none");
    showToast(error.message || "Failed to load billing records.", "danger");
  } finally {
    if (spinner) spinner.classList.add("d-none");
  }
}

/**
 * Render Billing Table rows
 * Columns: Appointment ID, Patient, Doctor, Consultation Fee, Payment Status, Paid amount, Balance, Action
 */
function renderBillingTable(appointments, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  appointments.forEach((apt) => {
    const tr = document.createElement("tr");
    const isPaid = (apt.payment_status || "").toLowerCase() === "paid";
    const fee = parseFloat(apt.consultation_fee || 0);

    // Initial estimation or detail placeholder
    const paidAmount = isPaid ? fee : 0;
    const balance = isPaid ? 0 : fee;

    tr.innerHTML = `
      <td class="fw-bold text-dark">#${escapeHtml(apt.appointment_id)}</td>
      <td>
        <div class="fw-bold text-dark">${escapeHtml(apt.patient_name || "Patient #" + apt.patient)}</div>
        <small class="text-muted">Token: #${escapeHtml(apt.token_number || "-")}</small>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(apt.doctor_name || "-")}</div>
        <small class="text-muted">${escapeHtml(apt.department_name || "-")}</small>
      </td>
      <td>
        <span class="fw-bold text-dark">${formatCurrency(fee)}</span>
      </td>
      <td>${getPaymentStatusBadge(apt.payment_status)}</td>
      <td id="row-paid-${apt.appointment_id}">
        <span class="fw-semibold ${isPaid ? "text-success" : "text-muted"}">${isPaid ? formatCurrency(fee) : "Calculated..."}</span>
      </td>
      <td id="row-balance-${apt.appointment_id}">
        <span class="fw-bold ${isPaid ? "text-success" : "text-danger"}">${isPaid ? "₹0.00" : formatCurrency(fee)}</span>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          ${
            !isPaid
              ? `<button class="btn btn-outline-success btn-record-pay" data-id="${apt.appointment_id}" data-fee="${apt.consultation_fee}" title="Record Payment">
                  <i class="bi bi-cash me-1"></i> Pay
                </button>`
              : ""
          }
          <button class="btn btn-outline-secondary btn-view-history" data-id="${apt.appointment_id}" title="Payment History">
            <i class="bi bi-clock-history"></i> History
          </button>
          <a href="appointment-details.html?id=${apt.appointment_id}" class="btn btn-outline-primary" title="Details">
            <i class="bi bi-eye"></i>
          </a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Fetch payments asynchronously to accurately populate Paid amount and Balance
    if (!isPaid) {
      apiGet(`/appointments/${apt.appointment_id}/payments/`).then((payments) => {
        let paid = 0;
        if (Array.isArray(payments)) {
          paid = payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
        }
        const bal = Math.max(0, fee - paid);
        const paidCell = document.getElementById(`row-paid-${apt.appointment_id}`);
        const balCell = document.getElementById(`row-balance-${apt.appointment_id}`);
        if (paidCell) paidCell.innerHTML = `<span class="fw-semibold text-success">${formatCurrency(paid)}</span>`;
        if (balCell) balCell.innerHTML = `<span class="fw-bold text-danger">${formatCurrency(bal)}</span>`;
      }).catch(() => {});
    }
  });

  tbody.querySelectorAll(".btn-record-pay").forEach((btn) => {
    btn.addEventListener("click", () => {
      openBillingPaymentModal(btn.dataset.id, btn.dataset.fee);
    });
  });

  tbody.querySelectorAll(".btn-view-history").forEach((btn) => {
    btn.addEventListener("click", () => {
      openPaymentHistoryModal(btn.dataset.id);
    });
  });
}

/**
 * Open Record Payment Modal
 * Before payment: Calls GET /api/receptionist/appointments/<id>/payments/
 * to calculate existing payments and exact outstanding balance.
 */
async function openBillingPaymentModal(aptId, fee) {
  currentAppointmentId = aptId;
  const modalApt = document.getElementById("billing-modal-apt-id");
  const modalTotal = document.getElementById("billing-modal-total");
  const modalPaid = document.getElementById("billing-modal-paid");
  const modalBalance = document.getElementById("billing-modal-balance");
  const amountInput = document.getElementById("billing-pay-amount");
  const errorBox = document.getElementById("billing-pay-error");

  if (errorBox) errorBox.classList.add("d-none");
  if (modalApt) modalApt.textContent = `#${aptId}`;

  try {
    // 1. Fetch appointment details for total fee
    const aptDetail = await apiGet(`/appointments/${aptId}/`);
    const totalFee = parseFloat(aptDetail.consultation_fee || fee || 0);

    // 2. Fetch payments to calculate existing payments
    const payments = await apiGet(`/appointments/${aptId}/payments/`);
    let paidTotal = 0;
    if (Array.isArray(payments)) {
      paidTotal = payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
    }

    const balance = Math.max(0, totalFee - paidTotal);
    currentBalance = balance;

    if (modalTotal) modalTotal.textContent = formatCurrency(totalFee);
    if (modalPaid) modalPaid.textContent = formatCurrency(paidTotal);
    if (modalBalance) modalBalance.textContent = formatCurrency(balance);

    if (amountInput) {
      amountInput.value = balance > 0 ? balance.toFixed(2) : "";
      amountInput.max = balance;
    }

    if (recordPaymentModal) recordPaymentModal.show();
  } catch (err) {
    showToast("Failed to load appointment details.", "danger");
  }
}

/**
 * Handle Billing Payment Submission (POST /appointments/<id>/payments/)
 * Validates amount > 0 and amount <= outstanding balance
 */
async function handleBillingPaymentSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("billing-pay-submit-btn");
  const errorBox = document.getElementById("billing-pay-error");
  const amountInput = document.getElementById("billing-pay-amount");
  const amountVal = parseFloat(amountInput.value);
  const methodVal = document.getElementById("billing-pay-method").value;
  const refVal = document.getElementById("billing-pay-reference").value.trim() || null;

  if (errorBox) errorBox.classList.add("d-none");

  // Validate amount > 0
  if (isNaN(amountVal) || amountVal <= 0) {
    if (errorBox) {
      errorBox.textContent = "Payment amount must be greater than zero.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  // Validate amount <= outstanding balance
  if (amountVal > currentBalance) {
    if (errorBox) {
      errorBox.textContent = `Payment exceeds outstanding balance of ₹${currentBalance.toFixed(2)}.`;
      errorBox.classList.remove("d-none");
    }
    return;
  }

  const payload = {
    amount: amountVal.toFixed(2),
    payment_method: methodVal,
  };
  if (refVal) payload.transaction_reference = refVal;

  setButtonLoading(submitBtn, true, "Processing...");

  try {
    const response = await apiPost(`/appointments/${currentAppointmentId}/payments/`, payload);

    showToast(
      `Payment recorded! ID: #${response.payment_id} | Bill #${response.bill_id} | Status: ${response.bill_payment_status} | Paid: ₹${response.paid_total} | Balance: ₹${response.balance}`,
      "success"
    );

    if (recordPaymentModal) recordPaymentModal.hide();
    document.getElementById("billing-payment-form").reset();
    loadBillingRecords();
  } catch (error) {
    console.error("Payment error:", error);
    if (errorBox) {
      errorBox.textContent = error.message || "Failed to record payment.";
      errorBox.classList.remove("d-none");
    } else {
      showToast(error.message || "Unable to record payment.", "danger");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Open Payment History Modal (GET /appointments/<id>/payments/)
 * Displays: Payment ID, Bill ID, Amount, Payment method, Payment date, Transaction reference, Active status
 */
async function openPaymentHistoryModal(aptId) {
  const tbody = document.getElementById("modal-history-tbody");
  const emptyState = document.getElementById("modal-history-empty");
  const modalAptTitle = document.getElementById("modal-history-apt-id");

  if (modalAptTitle) modalAptTitle.textContent = `#${aptId}`;
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  if (historyModal) historyModal.show();

  try {
    const payments = await apiGet(`/appointments/${aptId}/payments/`);

    if (!Array.isArray(payments) || payments.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }

    payments.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="fw-semibold text-primary">#${escapeHtml(p.payment_id)}</td>
        <td class="text-muted">#${escapeHtml(p.bill || "-")}</td>
        <td class="fw-bold text-success">${formatCurrency(p.amount)}</td>
        <td><span class="badge bg-light text-dark border text-uppercase">${escapeHtml(p.payment_method)}</span></td>
        <td>${formatDate(p.payment_date)} <small class="text-muted">${formatTime(p.payment_date.split("T")[1]?.substring(0, 8))}</small></td>
        <td><small class="text-muted">${escapeHtml(p.transaction_reference || "N/A")}</small></td>
        <td>${getActiveStatusBadge(p.is_active)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load payment history:", err);
    if (emptyState) emptyState.classList.remove("d-none");
  }
}
