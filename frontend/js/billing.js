/**
 * MEDICARE CLINIC MANAGEMENT SYSTEM - BILLING & PAYMENTS MODULE
 * Handles recording consultation payments, frontend + backend validation,
 * payment history viewing, and printable billing receipts.
 */

let recordPaymentModal = null;
let historyModal = null;
let currentBillId = null;
let currentAppointmentId = null;
let currentBalance = 0;
let currentBillData = null;

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

  // Payment method selection change handler for dynamic validation indication
  const methodSelect = document.getElementById("billing-pay-method");
  if (methodSelect) {
    methodSelect.addEventListener("change", handlePaymentMethodChange);
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
 * Handle dynamic changes to payment mode to show/hide transaction reference requirements
 */
function handlePaymentMethodChange() {
  const method = document.getElementById("billing-pay-method")?.value.toLowerCase();
  const reqIndicator = document.getElementById("ref-required-indicator");
  const helpText = document.getElementById("ref-help-text");
  const refInput = document.getElementById("billing-pay-reference");

  if (["card", "upi", "online"].includes(method)) {
    if (reqIndicator) reqIndicator.classList.remove("d-none");
    const label = method === "upi" ? "UPI" : method.charAt(0).toUpperCase() + method.slice(1);
    if (helpText) helpText.textContent = `Transaction ID is required for ${label} payments.`;
    if (refInput) refInput.placeholder = `Enter ${label} Transaction / Reference ID`;
  } else {
    if (reqIndicator) reqIndicator.classList.add("d-none");
    if (helpText) helpText.textContent = "Optional for Cash, required for Card, UPI, and Online.";
    if (refInput) refInput.placeholder = "Enter reference / receipt number (optional)";
  }
}

/**
 * Fetch and render billing table using the dedicated /bills/ endpoint
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
    let url = "/bills/";
    const params = [];
    if (statusFilter && statusFilter !== "all") params.push(`status=${encodeURIComponent(statusFilter)}`);
    if (searchFilter) params.push(`search=${encodeURIComponent(searchFilter)}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const bills = await apiGet(url);

    if (!Array.isArray(bills) || bills.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      renderBillingTable(bills, tbody);
    }
  } catch (error) {
    console.error("Billing fetch error:", error);
    // Fallback to /appointments/ if needed
    try {
      const appointments = await apiGet("/appointments/");
      const transformed = appointments.map((apt) => ({
        bill_id: apt.billing_details?.bill_id || apt.appointment_id,
        bill_number: `BILL-${String(apt.billing_details?.bill_id || apt.appointment_id).padStart(4, "0")}`,
        patient_id: apt.patient,
        patient_name: apt.patient_name,
        patient_mobile: apt.patient_mobile,
        appointment_id: apt.appointment_id,
        doctor_name: apt.doctor_name,
        department_name: apt.department_name,
        bill_type: "Consultation Fee",
        total_amount: apt.billing_details?.total_amount || apt.consultation_fee,
        paid_amount: apt.billing_details?.paid_amount || "0.00",
        outstanding_balance: apt.billing_details?.outstanding_balance || apt.consultation_fee,
        payment_status: apt.billing_details?.bill_payment_status || apt.payment_status?.toLowerCase() || "pending",
        token_number: apt.token_number,
      }));
      if (transformed.length === 0) {
        if (emptyState) emptyState.classList.remove("d-none");
      } else {
        renderBillingTable(transformed, tbody);
      }
    } catch (fallbackErr) {
      if (emptyState) emptyState.classList.remove("d-none");
      showToast(error.message || "Failed to load billing records.", "danger");
    }
  } finally {
    if (spinner) spinner.classList.add("d-none");
  }
}

/**
 * Render Billing Table rows
 * Columns: Bill Number, Patient, Doctor, Bill Type, Total Amount, Paid Amount, Balance, Payment Status, Action
 */
function renderBillingTable(bills, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  bills.forEach((bill) => {
    const tr = document.createElement("tr");
    const total = parseFloat(bill.total_amount || 0);
    const paid = parseFloat(bill.paid_amount || 0);
    const balance = parseFloat(bill.outstanding_balance !== undefined ? bill.outstanding_balance : (total - paid));
    const isPaid = (bill.payment_status || "").toLowerCase() === "paid" || balance <= 0;

    const billNumber = bill.bill_number || `BILL-${String(bill.bill_id).padStart(4, "0")}`;
    const billType = bill.bill_type || "Consultation Fee";

    tr.innerHTML = `
      <td>
        <span class="fw-bold text-dark font-monospace">${escapeHtml(billNumber)}</span>
        <small class="text-muted d-block" style="font-size: 0.725rem;">Appt #${escapeHtml(bill.appointment_id || "-")}</small>
      </td>
      <td>
        <div class="fw-bold text-dark">${escapeHtml(bill.patient_name || "Patient #" + bill.patient_id)}</div>
        <small class="text-muted">ID: #${escapeHtml(bill.patient_id || "-")} ${bill.patient_mobile ? "• " + escapeHtml(bill.patient_mobile) : ""}</small>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(bill.doctor_name || "-")}</div>
        <small class="text-muted">${escapeHtml(bill.department_name || "-")}</small>
      </td>
      <td>
        <span class="badge bg-light text-primary border">${escapeHtml(billType)}</span>
      </td>
      <td>
        <span class="fw-bold text-dark">${formatCurrency(total)}</span>
      </td>
      <td>
        <span class="fw-semibold text-success">${formatCurrency(paid)}</span>
      </td>
      <td>
        <span class="fw-bold ${balance > 0 ? "text-danger" : "text-success"}">${formatCurrency(balance)}</span>
      </td>
      <td>${getPaymentStatusBadge(bill.payment_status)}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          ${
            balance > 0
              ? `<button class="btn btn-outline-success btn-record-pay" data-bill-id="${bill.bill_id}" data-apt-id="${bill.appointment_id}" title="Record Payment">
                  <i class="bi bi-cash-stack me-1"></i> Record Payment
                </button>`
              : ""
          }
          <button class="btn btn-outline-primary btn-print-bill" data-bill-id="${bill.bill_id}" title="Print Bill / Receipt">
            <i class="bi bi-printer me-1"></i> Print Bill
          </button>
          <button class="btn btn-outline-secondary btn-view-history" data-bill-id="${bill.bill_id}" data-apt-id="${bill.appointment_id}" title="Payment History">
            <i class="bi bi-clock-history"></i> History
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach action event listeners
  tbody.querySelectorAll(".btn-record-pay").forEach((btn) => {
    btn.addEventListener("click", () => {
      openBillingPaymentModal(btn.dataset.billId, btn.dataset.aptId);
    });
  });

  tbody.querySelectorAll(".btn-print-bill").forEach((btn) => {
    btn.addEventListener("click", () => {
      printBillingReceipt(btn.dataset.billId);
    });
  });

  tbody.querySelectorAll(".btn-view-history").forEach((btn) => {
    btn.addEventListener("click", () => {
      openPaymentHistoryModal(btn.dataset.billId, btn.dataset.aptId);
    });
  });
}

/**
 * Open Record Payment Modal
 * Populates Bill Number, Patient Name, Bill Type, and Amount Due
 */
async function openBillingPaymentModal(billId, aptId) {
  currentBillId = billId;
  currentAppointmentId = aptId;

  const errorBox = document.getElementById("billing-pay-error");
  const modalBillNum = document.getElementById("billing-modal-bill-num");
  const modalPatientName = document.getElementById("billing-modal-patient-name");
  const modalBillType = document.getElementById("billing-modal-bill-type");
  const modalTotal = document.getElementById("billing-modal-total");
  const modalPaid = document.getElementById("billing-modal-paid");
  const modalBalance = document.getElementById("billing-modal-balance");
  const amountInput = document.getElementById("billing-pay-amount");
  const methodSelect = document.getElementById("billing-pay-method");
  const refInput = document.getElementById("billing-pay-reference");

  if (errorBox) errorBox.classList.add("d-none");
  if (methodSelect) methodSelect.value = "";
  if (refInput) refInput.value = "";
  handlePaymentMethodChange();

  try {
    const bill = await apiGet(`/bills/${billId}/`);
    currentBillData = bill;

    const total = parseFloat(bill.total_amount || 0);
    const paid = parseFloat(bill.paid_amount || 0);
    const balance = parseFloat(bill.outstanding_balance !== undefined ? bill.outstanding_balance : (total - paid));
    currentBalance = balance;

    if (modalBillNum) modalBillNum.textContent = bill.bill_number || `BILL-${String(bill.bill_id).padStart(4, "0")}`;
    if (modalPatientName) modalPatientName.textContent = bill.patient_name || "--";
    if (modalBillType) modalBillType.textContent = bill.bill_type || "Consultation Fee";
    if (modalTotal) modalTotal.textContent = formatCurrency(total);
    if (modalPaid) modalPaid.textContent = formatCurrency(paid);
    if (modalBalance) modalBalance.textContent = formatCurrency(balance);

    if (amountInput) {
      amountInput.value = balance > 0 ? balance.toFixed(2) : "";
      amountInput.max = balance;
    }

    if (recordPaymentModal) recordPaymentModal.show();
  } catch (err) {
    showToast("Failed to load bill details for payment.", "danger");
  }
}

/**
 * Handle Billing Payment Submission
 * Implements strict frontend validation:
 * 1. Payment mode is required.
 * 2. Payment amount must be valid.
 * 3. Payment amount must be greater than 0.
 * 4. Payment amount must not exceed the amount due.
 * 5. Reference/Transaction ID required for Card, UPI, Online; optional for Cash.
 * 6. Duplicate prevention.
 */
async function handleBillingPaymentSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("billing-pay-submit-btn");
  const errorBox = document.getElementById("billing-pay-error");
  const amountInput = document.getElementById("billing-pay-amount");
  const methodSelect = document.getElementById("billing-pay-method");
  const refInput = document.getElementById("billing-pay-reference");

  const amountVal = parseFloat(amountInput.value);
  const methodVal = methodSelect.value.trim().toLowerCase();
  const refVal = refInput.value.trim();

  function showValidationError(message) {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.remove("d-none");
    } else {
      showToast(message, "danger");
    }
  }

  if (errorBox) errorBox.classList.add("d-none");

  // 1. Payment mode is required
  if (!methodVal) {
    showValidationError("Please select a payment mode.");
    methodSelect.focus();
    return;
  }

  // 2. Payment amount must be valid number
  if (isNaN(amountVal) || amountInput.value.trim() === "") {
    showValidationError("Please enter a valid payment amount.");
    amountInput.focus();
    return;
  }

  // 3. Payment amount must be greater than 0
  if (amountVal <= 0) {
    showValidationError("Payment amount must be greater than 0.");
    amountInput.focus();
    return;
  }

  // 4. Payment amount must not exceed the amount due
  if (amountVal > currentBalance) {
    showValidationError("Payment amount cannot exceed the amount due.");
    amountInput.focus();
    return;
  }

  // 5. Reference/Transaction ID required for Card, UPI, and Online
  if (["card", "upi", "online"].includes(methodVal)) {
    if (!refVal) {
      const modeLabel = methodVal === "upi" ? "UPI" : methodVal.charAt(0).toUpperCase() + methodVal.slice(1);
      showValidationError(`Transaction ID is required for ${modeLabel} payments.`);
      refInput.focus();
      return;
    }
  }

  const payload = {
    amount: amountVal.toFixed(2),
    payment_method: methodVal,
  };
  if (refVal) {
    payload.transaction_reference = refVal;
  }

  // 6. Prevent duplicate submission while request is processing
  setButtonLoading(submitBtn, true, "Confirming Payment...");

  try {
    // Attempt payment via direct bill endpoint, with fallback to appointment payments endpoint
    let response;
    try {
      response = await apiPost(`/bills/${currentBillId}/payments/`, payload);
    } catch (postErr) {
      if (currentAppointmentId) {
        response = await apiPost(`/appointments/${currentAppointmentId}/payments/`, payload);
      } else {
        throw postErr;
      }
    }

    showToast(
      `Payment confirmed! Bill ${response.bill_number || "#" + response.bill_id} status updated to ${response.bill_payment_status?.toUpperCase() || "PAID"}.`,
      "success"
    );

    if (recordPaymentModal) recordPaymentModal.hide();
    document.getElementById("billing-payment-form").reset();
    loadBillingRecords();
  } catch (error) {
    console.error("Payment submission error:", error);
    const msg = error.message || error.error || error.amount || "Failed to record payment.";
    showValidationError(msg);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Open Payment History Modal
 * Displays: Payment ID, Bill ID, Amount, Payment Method, Payment Date, Transaction Reference
 */
async function openPaymentHistoryModal(billId, aptId) {
  const tbody = document.getElementById("modal-history-tbody");
  const emptyState = document.getElementById("modal-history-empty");
  const modalAptTitle = document.getElementById("modal-history-apt-id");

  if (modalAptTitle) modalAptTitle.textContent = `Bill #${billId}`;
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  if (historyModal) historyModal.show();

  try {
    let payments = [];
    try {
      payments = await apiGet(`/bills/${billId}/payments/`);
    } catch {
      if (aptId) {
        payments = await apiGet(`/appointments/${aptId}/payments/`);
      }
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }

    payments.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="fw-semibold text-primary font-monospace">#${escapeHtml(p.payment_id)}</td>
        <td class="text-muted font-monospace">#${escapeHtml(p.bill || billId)}</td>
        <td class="fw-bold text-success">${formatCurrency(p.amount)}</td>
        <td><span class="badge bg-light text-dark border text-uppercase">${escapeHtml(p.payment_method)}</span></td>
        <td>${formatDate(p.payment_date)} <small class="text-muted">${formatTime(p.payment_date?.split("T")[1]?.substring(0, 8))}</small></td>
        <td><small class="text-muted font-monospace">${escapeHtml(p.transaction_reference || "N/A")}</small></td>
        <td>${getActiveStatusBadge(p.is_active)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load payment history:", err);
    if (emptyState) emptyState.classList.remove("d-none");
  }
}

/**
 * FEATURE 2 — PRINT BILLING / RECEIPT
 * Generates a clean printable billing document containing:
 * - MEDICARE CLINIC MANAGEMENT SYSTEM
 * - Clinic information
 * - Bill Number, Patient Name, Patient ID, Date, Bill Type
 * - BILL DETAILS (Description, Amount)
 * - Subtotal, Discount, Tax, Total, Paid, Balance, Payment Status
 * - PAYMENT DETAILS (Mode, Transaction ID, Payment Date)
 * - Thank you for visiting MEDICARE
 * and invokes window.print()
 */
async function printBillingReceipt(billId) {
  try {
    const bill = await apiGet(`/bills/${billId}/`);
    const printContainer = document.getElementById("printable-receipt-container");
    if (!printContainer) return;

    const total = parseFloat(bill.total_amount || 0);
    const paid = parseFloat(bill.paid_amount || 0);
    const balance = parseFloat(bill.outstanding_balance !== undefined ? bill.outstanding_balance : (total - paid));
    const billNumber = bill.bill_number || `BILL-${String(bill.bill_id).padStart(4, "0")}`;
    const billType = bill.bill_type || "Consultation Fee";

    // Most recent payment details if existing
    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    const latestPayment = payments.length > 0 ? payments[0] : null;

    printContainer.innerHTML = `
      <div class="print-header d-flex justify-content-between align-items-center">
        <div>
          <div class="print-brand">MEDICARE</div>
          <div class="print-subtitle">CLINIC MANAGEMENT SYSTEM</div>
          ${bill.department_name ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 4px;">Department of ${escapeHtml(bill.department_name)}</div>` : ""}
        </div>
        <div class="text-end">
          <div style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">TAX INVOICE / RECEIPT</div>
          <div style="font-size: 0.85rem; color: #475569;">Date: ${formatDate(bill.bill_date || new Date().toISOString())}</div>
          <div class="font-monospace fw-bold" style="font-size: 0.95rem; color: #0f172a;">${escapeHtml(billNumber)}</div>
        </div>
      </div>

      <!-- Bill & Patient Metadata -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 0.9rem;">
        <div>
          <div style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Patient Details</div>
          <div style="font-weight: 700; font-size: 1.05rem; color: #0f172a;">${escapeHtml(bill.patient_name || "--")}</div>
          <div>Patient ID: <span class="font-monospace">#${escapeHtml(bill.patient_id || "--")}</span></div>
          ${bill.patient_mobile ? `<div>Mobile: ${escapeHtml(bill.patient_mobile)}</div>` : ""}
        </div>
        <div style="text-align: right;">
          <div style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Consulting Doctor</div>
          <div style="font-weight: 700; font-size: 1.05rem; color: #0f172a;">${escapeHtml(bill.doctor_name || "--")}</div>
          <div>Bill Type: <span style="font-weight: 600;">${escapeHtml(billType)}</span></div>
          ${bill.token_number ? `<div>Token Number: <span class="font-monospace fw-bold">#${escapeHtml(bill.token_number)}</span></div>` : ""}
        </div>
      </div>

      <!-- Bill Details Table -->
      <div class="print-section-title">BILL DETAILS</div>
      <table class="print-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="width: 140px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight: 600; color: #0f172a;">${escapeHtml(billType)}</div>
              <small style="color: #64748b;">Consultation with ${escapeHtml(bill.doctor_name || "Doctor")}</small>
            </td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Financial Summary Table -->
      <div style="margin-left: auto; width: 320px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 0.9rem;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600;">${formatCurrency(total)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Total:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; font-size: 1rem; color: #0f172a;">${formatCurrency(total)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #15803d;">Paid Amount:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #15803d;">${formatCurrency(paid)}</td>
          </tr>
          <tr style="border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a;">
            <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">Balance Due:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 800; font-size: 1.1rem; color: ${balance > 0 ? "#b91c1c" : "#15803d"};">
              ${formatCurrency(balance)}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Payment Status:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; text-transform: uppercase;">
              ${escapeHtml(bill.payment_status || "PENDING")}
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment Details Section -->
      ${
        latestPayment
          ? `
          <div class="print-section-title">PAYMENT DETAILS</div>
          <table class="print-table">
            <thead>
              <tr>
                <th>Payment Mode</th>
                <th>Transaction ID</th>
                <th>Payment Date</th>
                <th style="text-align: right;">Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              ${payments
                .map(
                  (p) => `
                <tr>
                  <td style="text-transform: uppercase; font-weight: 600;">${escapeHtml(p.payment_method)}</td>
                  <td class="font-monospace">${escapeHtml(p.transaction_reference || "N/A")}</td>
                  <td>${formatDate(p.payment_date)} ${formatTime(p.payment_date?.split("T")[1]?.substring(0, 8))}</td>
                  <td style="text-align: right; font-weight: 700; color: #15803d;">${formatCurrency(p.amount)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          `
          : `
          <div class="print-section-title">PAYMENT DETAILS</div>
          <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 16px;">No payments recorded yet. Amount due is ${formatCurrency(balance)}.</div>
          `
      }

      <div class="print-footer">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Thank you for visiting MEDICARE</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">This is a computer-generated receipt from MEDICARE Clinic Management System.</div>
      </div>
    `;

    // Trigger browser print dialog
    window.print();
  } catch (err) {
    console.error("Print receipt error:", err);
    showToast("Failed to load invoice for printing.", "danger");
  }
}
