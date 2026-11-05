/**
 * CLINIC MANAGEMENT SYSTEM - APPOINTMENT DETAILS MODULE
 * Handles viewing appointment info, billing details, payment history,
 * recording payments, and appointment cancellation.
 */

let appointmentId = null;
let currentAppointmentData = null;
let recordPaymentModal = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

  const urlParams = new URLSearchParams(window.location.search);
  appointmentId = urlParams.get("id");

  if (!appointmentId) {
    showToast("No appointment ID specified.", "warning");
    setTimeout(() => { window.location.href = "appointments.html"; }, 1500);
    return;
  }

  const modalEl = document.getElementById("recordPaymentModal");
  if (modalEl) {
    recordPaymentModal = new bootstrap.Modal(modalEl);
  }

  // Load appointment information & payments
  loadAppointmentDetails(appointmentId);

  // Bind Payment Form Submission
  const paymentForm = document.getElementById("record-payment-form");
  if (paymentForm) {
    paymentForm.addEventListener("submit", handleRecordPaymentSubmit);
  }

  // Bind Cancel Appointment Button
  const cancelBtn = document.getElementById("cancel-appointment-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", handleCancelAppointmentAction);
  }
});

/**
 * Fetch and render complete appointment details
 */
async function loadAppointmentDetails(id) {
  const loadingSpinner = document.getElementById("apt-details-loading");
  const contentWrapper = document.getElementById("apt-details-content");

  if (loadingSpinner) loadingSpinner.classList.remove("d-none");
  if (contentWrapper) contentWrapper.classList.add("d-none");

  try {
    const apt = await apiGet(`/appointments/${id}/`);
    currentAppointmentData = apt;

    // Header info
    document.getElementById("apt-header-id").textContent = `#${apt.appointment_id}`;
    document.getElementById("apt-header-token").textContent = `#${apt.token_number || "-"}`;
    document.getElementById("apt-header-status-badge").innerHTML = getStatusBadge(apt.status);
    document.getElementById("apt-header-pay-badge").innerHTML = getPaymentStatusBadge(apt.payment_status);

    // Consultation Info
    document.getElementById("apt-val-date").textContent = formatDate(apt.appointment_date);
    document.getElementById("apt-val-time").textContent = formatTime(apt.appointment_time);
    document.getElementById("apt-val-token").textContent = apt.token_number || "-";
    document.getElementById("apt-val-reason").textContent = apt.reason || "General Consultation";
    document.getElementById("apt-val-receptionist").textContent = apt.receptionist_name || "Reception Desk";
    document.getElementById("apt-val-created").textContent = formatDate(apt.created_at);

    // Patient Info Card
    document.getElementById("apt-patient-name").textContent = apt.patient_name;
    document.getElementById("apt-patient-id").textContent = apt.patient;
    document.getElementById("apt-patient-phone").textContent = apt.patient_mobile || "-";
    document.getElementById("apt-patient-email").textContent = apt.patient_email || "-";
    document.getElementById("apt-patient-dob").textContent = formatDate(apt.patient_dob);
    document.getElementById("apt-patient-gender").textContent = apt.patient_gender || "-";
    document.getElementById("apt-patient-blood").textContent = apt.patient_blood_group || "-";

    const patientProfileLink = document.getElementById("apt-patient-profile-link");
    if (patientProfileLink) {
      patientProfileLink.href = `patient-details.html?id=${apt.patient}`;
    }

    // Doctor & Department Info Card
    document.getElementById("apt-doctor-name").textContent = apt.doctor_name;
    document.getElementById("apt-doctor-qual").textContent = apt.doctor_qualification || "-";
    document.getElementById("apt-doctor-dept").textContent = apt.department_name || "-";
    document.getElementById("apt-doctor-fee").textContent = formatCurrency(apt.consultation_fee);

    // Billing Summary
    const bill = apt.billing_details;
    const totalFee = bill ? parseFloat(bill.total_amount) : parseFloat(apt.consultation_fee || 0);
    const paidAmount = bill ? parseFloat(bill.paid_amount) : 0;
    const balance = bill ? parseFloat(bill.outstanding_balance) : totalFee;

    document.getElementById("bill-val-id").textContent = bill ? `#${bill.bill_id}` : "Not Billed";
    document.getElementById("bill-val-total").textContent = formatCurrency(totalFee);
    document.getElementById("bill-val-paid").textContent = formatCurrency(paidAmount);
    document.getElementById("bill-val-balance").textContent = formatCurrency(balance);
    document.getElementById("bill-val-status").innerHTML = getPaymentStatusBadge(bill ? bill.bill_payment_status : "Pending");

    // Action button states
    const cancelBtn = document.getElementById("cancel-appointment-btn");
    const recordPayBtn = document.getElementById("open-payment-modal-btn");

    const isCancelled = (apt.status || "").toLowerCase() === "cancelled";
    const isPaid = (apt.payment_status || "").toLowerCase() === "paid";

    if (cancelBtn) {
      cancelBtn.disabled = isCancelled || paidAmount > 0;
      if (paidAmount > 0) {
        cancelBtn.title = "Appointments with recorded payments cannot be cancelled.";
      }
    }

    if (recordPayBtn) {
      recordPayBtn.disabled = isCancelled || isPaid || balance <= 0;
    }

    // Load Payment Transactions History
    loadPaymentHistory(id);

    if (contentWrapper) contentWrapper.classList.remove("d-none");
  } catch (error) {
    console.error("Error loading appointment details:", error);
    showToast(error.message || "Unable to fetch appointment details.", "danger");
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add("d-none");
  }
}

/**
 * Fetch and render payments history table
 */
async function loadPaymentHistory(id) {
  const tbody = document.getElementById("payment-history-tbody");
  const emptyState = document.getElementById("payment-history-empty");

  if (!tbody) return;
  tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  try {
    const payments = await apiGet(`/appointments/${id}/payments/`);

    if (!Array.isArray(payments) || payments.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }

    payments.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="fw-semibold text-primary">#${escapeHtml(p.payment_id)}</td>
        <td class="fw-bold text-success">${formatCurrency(p.amount)}</td>
        <td>
          <span class="badge bg-light text-dark border text-uppercase" style="font-size: 0.75rem;">
            ${escapeHtml(p.payment_method)}
          </span>
        </td>
        <td>
          <div>${formatDate(p.payment_date)}</div>
          <small class="text-muted">${formatTime(p.payment_date.split("T")[1]?.substring(0, 8))}</small>
        </td>
        <td>
          <small class="text-muted">${escapeHtml(p.transaction_reference || "N/A")}</small>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.warn("Unable to fetch payment history:", err);
  }
}

/**
 * Open Record Payment Modal
 */
function openRecordPaymentModal() {
  if (!currentAppointmentData) return;

  const bill = currentAppointmentData.billing_details;
  const total = bill ? parseFloat(bill.total_amount) : parseFloat(currentAppointmentData.consultation_fee || 0);
  const paid = bill ? parseFloat(bill.paid_amount) : 0;
  const balance = bill ? parseFloat(bill.outstanding_balance) : total - paid;

  document.getElementById("modal-bill-total").textContent = formatCurrency(total);
  document.getElementById("modal-bill-paid").textContent = formatCurrency(paid);
  document.getElementById("modal-bill-balance").textContent = formatCurrency(balance);

  const amountInput = document.getElementById("modal-pay-amount");
  amountInput.value = balance > 0 ? balance.toFixed(2) : "";
  amountInput.max = balance;
  amountInput.dataset.maxBalance = balance;

  const errorBox = document.getElementById("record-payment-error");
  if (errorBox) errorBox.classList.add("d-none");

  if (recordPaymentModal) recordPaymentModal.show();
}

/**
 * Submit Payment
 */
async function handleRecordPaymentSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("record-payment-submit-btn");
  const errorBox = document.getElementById("record-payment-error");
  const amountInput = document.getElementById("modal-pay-amount");
  const amountVal = parseFloat(amountInput.value);
  const maxBalance = parseFloat(amountInput.dataset.maxBalance || "0");
  const methodVal = document.getElementById("modal-pay-method").value;
  const refVal = document.getElementById("modal-pay-reference").value.trim() || null;

  if (errorBox) errorBox.classList.add("d-none");

  if (isNaN(amountVal) || amountVal <= 0) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid amount greater than zero.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  if (amountVal > maxBalance) {
    if (errorBox) {
      errorBox.textContent = `Amount cannot exceed the outstanding balance of ₹${maxBalance.toFixed(2)}.`;
      errorBox.classList.remove("d-none");
    }
    return;
  }

  const payload = {
    amount: amountVal.toFixed(2),
    payment_method: methodVal,
  };
  if (refVal) payload.transaction_reference = refVal;

  setButtonLoading(submitBtn, true, "Saving Payment...");

  try {
    const payment = await apiPost(`/appointments/${appointmentId}/payments/`, payload);

    showToast(
      `Payment of ₹${payment.paid_total} recorded successfully! (Status: ${payment.bill_payment_status})`,
      "success"
    );

    if (recordPaymentModal) recordPaymentModal.hide();
    document.getElementById("record-payment-form").reset();

    // Reload full details
    loadAppointmentDetails(appointmentId);
  } catch (error) {
    console.error("Payment error:", error);
    if (errorBox) {
      errorBox.textContent = error.message || "Failed to record payment.";
      errorBox.classList.remove("d-none");
    } else {
      showToast(error.message || "Payment recording failed.", "danger");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Cancel Appointment Action
 */
function handleCancelAppointmentAction() {
  if (!currentAppointmentData) return;

  showConfirmModal({
    title: "Cancel Appointment",
    message: "Are you sure you want to cancel this appointment?<br><small class='text-muted'>This action will mark the appointment status as cancelled and invalidate any active unpaid bills.</small>",
    confirmBtnText: "Yes, Cancel Appointment",
    confirmBtnClass: "btn-danger",
    onConfirm: async () => {
      await apiPatch(`/appointments/${appointmentId}/`, {});

      showToast("Appointment has been cancelled successfully.", "success");
      loadAppointmentDetails(appointmentId);
    },
  });
}
