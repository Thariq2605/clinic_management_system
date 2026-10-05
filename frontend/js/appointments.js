/**
 * CLINIC MANAGEMENT SYSTEM - APPOINTMENTS MODULE
 * Handles appointment listing with multi-field filtering,
 * dynamic booking modal (patient, department, doctor chaining),
 * quick payment recording, and cancellation.
 */

let bookAppointmentModal = null;
let recordPaymentModal = null;
let activePaymentAppointmentId = null;
let activePaymentBalance = 0;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

  const bookModalEl = document.getElementById("bookAppointmentModal");
  if (bookModalEl) {
    bookAppointmentModal = new bootstrap.Modal(bookModalEl);
  }

  const payModalEl = document.getElementById("quickPaymentModal");
  if (payModalEl) {
    recordPaymentModal = new bootstrap.Modal(payModalEl);
  }

  // Load department and doctor filter dropdowns
  initFilterDropdowns();

  // Load initial appointments
  loadAppointments();

  // Attach filter events
  const filterForm = document.getElementById("appointments-filter-form");
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loadAppointments();
    });
  }

  const resetFiltersBtn = document.getElementById("reset-filters-btn");
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      filterForm.reset();
      loadAppointments();
    });
  }

  // Initialize booking modal components
  initBookingModal();

  // Attach booking form submit
  const bookForm = document.getElementById("book-appointment-form");
  if (bookForm) {
    bookForm.addEventListener("submit", handleBookAppointmentSubmit);
  }

  // Attach payment form submit
  const payForm = document.getElementById("quick-payment-form");
  if (payForm) {
    payForm.addEventListener("submit", handleQuickPaymentSubmit);
  }

  // Check URL query parameters (e.g. ?action=new&patient_id=1)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "new") {
    const prefillPatientId = urlParams.get("patient_id");
    openBookingModal(prefillPatientId);
  }
});

/**
 * Initialize departments and doctors in filter dropdowns
 */
async function initFilterDropdowns() {
  const deptSelect = document.getElementById("filter-department");
  const docSelect = document.getElementById("filter-doctor");

  try {
    const departments = await apiGet("/departments/");
    if (deptSelect && Array.isArray(departments)) {
      departments.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.department_id;
        opt.textContent = d.department_name;
        deptSelect.appendChild(opt);
      });
    }

    const doctors = await apiGet("/doctors/");
    if (docSelect && Array.isArray(doctors)) {
      doctors.forEach((doc) => {
        const opt = document.createElement("option");
        opt.value = doc.doctor_id;
        opt.textContent = `${doc.doctor_name} (${doc.department_name})`;
        docSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn("Unable to populate filter dropdowns:", err);
  }
}

/**
 * Fetch and render appointments matching selected filters
 */
async function loadAppointments() {
  const tbody = document.getElementById("appointments-tbody");
  const spinner = document.getElementById("appointments-loading-spinner");
  const emptyState = document.getElementById("appointments-empty-state");

  if (spinner) spinner.classList.remove("d-none");
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  // Collect filter values
  const dateVal = document.getElementById("filter-date")?.value;
  const docVal = document.getElementById("filter-doctor")?.value;
  const deptVal = document.getElementById("filter-department")?.value;
  const statusVal = document.getElementById("filter-status")?.value;
  const searchVal = document.getElementById("filter-search")?.value.trim();

  const queryParams = new URLSearchParams();
  if (dateVal) queryParams.append("date", dateVal);
  if (docVal) queryParams.append("doctor", docVal);
  if (deptVal) queryParams.append("department", deptVal);
  if (statusVal) queryParams.append("status", statusVal);
  if (searchVal) queryParams.append("search", searchVal);

  const endpoint = `/appointments/${queryParams.toString() ? "?" + queryParams.toString() : ""}`;

  try {
    const appointments = await apiGet(endpoint);

    if (!Array.isArray(appointments) || appointments.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      renderAppointmentsTable(appointments, tbody);
    }
  } catch (error) {
    console.error("Appointments fetch error:", error);
    if (emptyState) emptyState.classList.remove("d-none");
    showToast(error.message || "Failed to load appointments.", "danger");
  } finally {
    if (spinner) spinner.classList.add("d-none");
  }
}

/**
 * Render appointments table rows
 * Columns: Appointment ID, Token, Patient, Doctor, Department, Date, Time, Consultation Fee, Status, Payment Status, Action
 */
function renderAppointmentsTable(appointments, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  appointments.forEach((apt) => {
    const tr = document.createElement("tr");
    const isCancelled = (apt.status || "").toLowerCase() === "cancelled";
    const isPaid = (apt.payment_status || "").toLowerCase() === "paid";

    tr.innerHTML = `
      <td class="fw-bold text-dark">#${escapeHtml(apt.appointment_id)}</td>
      <td class="fw-bold text-primary">#${escapeHtml(apt.token_number || "-")}</td>
      <td>
        <div class="fw-semibold text-dark">${escapeHtml(apt.patient_name || "Patient #" + apt.patient)}</div>
        <small class="text-muted"><a href="patient-details.html?id=${apt.patient}" class="text-decoration-none">ID: #${apt.patient}</a></small>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(apt.doctor_name || "Doctor #" + apt.doctor)}</div>
      </td>
      <td>
        <span class="badge bg-light text-dark border">${escapeHtml(apt.department_name || "-")}</span>
      </td>
      <td>${formatDate(apt.appointment_date)}</td>
      <td>${formatTime(apt.appointment_time)}</td>
      <td>
        <span class="fw-bold text-dark">${formatCurrency(apt.consultation_fee)}</span>
      </td>
      <td>${getStatusBadge(apt.status)}</td>
      <td>${getPaymentStatusBadge(apt.payment_status)}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <a href="appointment-details.html?id=${apt.appointment_id}" class="btn btn-outline-primary" title="View Full Details">
            <i class="bi bi-eye"></i> Details
          </a>
          ${
            !isPaid && !isCancelled
              ? `<button class="btn btn-outline-success btn-record-pay" data-id="${apt.appointment_id}" data-fee="${apt.consultation_fee}" title="Record Payment">
                  <i class="bi bi-cash"></i> Pay
                </button>`
              : ""
          }
          ${
            !isCancelled
              ? `<button class="btn btn-outline-danger btn-cancel-apt" data-id="${apt.appointment_id}" data-token="${apt.token_number}" title="Cancel Appointment">
                  <i class="bi bi-x-circle"></i>
                </button>`
              : ""
          }
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach action button event listeners
  tbody.querySelectorAll(".btn-record-pay").forEach((btn) => {
    btn.addEventListener("click", () => {
      openQuickPaymentModal(btn.dataset.id, btn.dataset.fee);
    });
  });

  tbody.querySelectorAll(".btn-cancel-apt").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleCancelAppointment(btn.dataset.id, btn.dataset.token);
    });
  });
}

/**
 * Initialize Booking Modal dynamic cascading dropdowns
 */
async function initBookingModal() {
  const deptSelect = document.getElementById("book-department");
  const docSelect = document.getElementById("book-doctor");
  const dateInput = document.getElementById("book-date");

  // Min appointment date = today
  if (dateInput) {
    const todayStr = new Date().toISOString().split("T")[0];
    dateInput.setAttribute("min", todayStr);
    dateInput.value = todayStr;
  }

  // Load Departments
  try {
    const departments = await apiGet("/departments/");
    if (deptSelect && Array.isArray(departments)) {
      deptSelect.innerHTML = `<option value="" disabled selected>Select Department</option>`;
      departments.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.department_id;
        opt.textContent = d.department_name;
        deptSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Booking modal departments fetch error:", err);
  }

  // On Department change, load Doctors for that Department
  if (deptSelect && docSelect) {
    deptSelect.addEventListener("change", async () => {
      const deptId = deptSelect.value;
      docSelect.disabled = true;
      docSelect.innerHTML = `<option value="" disabled selected>Loading doctors...</option>`;
      document.getElementById("book-consultation-fee-badge").classList.add("d-none");

      try {
        const doctors = await apiGet(`/doctors/?department=${deptId}`);
        docSelect.innerHTML = `<option value="" disabled selected>Select Doctor</option>`;
        if (Array.isArray(doctors) && doctors.length > 0) {
          doctors.forEach((doc) => {
            const opt = document.createElement("option");
            opt.value = doc.doctor_id;
            opt.dataset.fee = doc.consultation_fee;
            opt.textContent = `${doc.doctor_name} (Fee: ₹${doc.consultation_fee})`;
            docSelect.appendChild(opt);
          });
          docSelect.disabled = false;
        } else {
          docSelect.innerHTML = `<option value="" disabled>No active doctors in this department</option>`;
        }
      } catch (err) {
        docSelect.innerHTML = `<option value="" disabled>Error loading doctors</option>`;
        console.error(err);
      }
    });
  }

  // When Doctor is selected, update fee display badge
  if (docSelect) {
    docSelect.addEventListener("change", () => {
      const selected = docSelect.options[docSelect.selectedIndex];
      const fee = selected?.dataset?.fee;
      const feeBadge = document.getElementById("book-consultation-fee-badge");
      if (fee && feeBadge) {
        feeBadge.textContent = `Consultation Fee: ₹${fee}`;
        feeBadge.classList.remove("d-none");
      }
    });
  }

  // Patient search in modal
  const patientSearchInput = document.getElementById("book-patient-search");
  const patientSearchResults = document.getElementById("book-patient-results");
  let searchTimeout = null;

  if (patientSearchInput && patientSearchResults) {
    patientSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      const query = patientSearchInput.value.trim();

      if (query.length === 0) {
        patientSearchResults.classList.add("d-none");
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const endpoint = /^\d+$/.test(query)
            ? `/patients/?patient_id=${encodeURIComponent(query)}`
            : `/patients/?search=${encodeURIComponent(query)}`;

          const patients = await apiGet(endpoint);
          patientSearchResults.innerHTML = "";

          if (Array.isArray(patients) && patients.length > 0) {
            patients.slice(0, 8).forEach((p) => {
              const item = document.createElement("a");
              item.className = "list-group-item list-group-item-action py-2";
              item.href = "#";
              item.innerHTML = `
                <div class="fw-semibold">${escapeHtml(p.full_name)} <span class="badge bg-secondary-subtle text-secondary ms-1">#${p.patient_id}</span></div>
                <small class="text-muted">Phone: ${escapeHtml(p.mobile_number)} | Gender: ${escapeHtml(p.gender || "-")}</small>
              `;
              item.addEventListener("click", (e) => {
                e.preventDefault();
                selectPatientForBooking(p);
                patientSearchResults.classList.add("d-none");
              });
              patientSearchResults.appendChild(item);
            });
            patientSearchResults.classList.remove("d-none");
          } else {
            patientSearchResults.innerHTML = `<div class="list-group-item text-muted small py-2">No patients found.</div>`;
            patientSearchResults.classList.remove("d-none");
          }
        } catch (err) {
          console.error(err);
        }
      }, 300);
    });
  }
}

/**
 * Select patient for appointment booking
 */
function selectPatientForBooking(patient) {
  document.getElementById("book-selected-patient-id").value = patient.patient_id;
  document.getElementById("book-patient-search").value = `${patient.full_name} (#${patient.patient_id})`;
  const card = document.getElementById("book-selected-patient-card");
  if (card) {
    card.innerHTML = `
      <div class="alert alert-info py-2 px-3 small d-flex justify-content-between align-items-center mb-0">
        <div>
          <strong>${escapeHtml(patient.full_name)}</strong> (ID: #${patient.patient_id})
          <span class="text-muted ms-2">Mobile: ${escapeHtml(patient.mobile_number)}</span>
        </div>
        <button type="button" class="btn btn-sm btn-link text-danger p-0 text-decoration-none" onclick="clearSelectedPatientForBooking()">Change</button>
      </div>
    `;
    card.classList.remove("d-none");
  }
}

function clearSelectedPatientForBooking() {
  document.getElementById("book-selected-patient-id").value = "";
  document.getElementById("book-patient-search").value = "";
  const card = document.getElementById("book-selected-patient-card");
  if (card) card.classList.add("d-none");
}

/**
 * Open Booking Modal with optional prefilled patient
 */
async function openBookingModal(prefillPatientId) {
  if (prefillPatientId) {
    try {
      const patient = await apiGet(`/patients/${prefillPatientId}/`);
      selectPatientForBooking(patient);
    } catch (e) {
      console.warn("Could not prefill patient:", e);
    }
  }
  if (bookAppointmentModal) bookAppointmentModal.show();
}

/**
 * Handle Book Appointment Form Submission
 */
async function handleBookAppointmentSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("book-appointment-submit-btn");
  const errorBox = document.getElementById("book-appointment-error");

  if (errorBox) {
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
  }

  const patientId = document.getElementById("book-selected-patient-id").value;
  const departmentId = document.getElementById("book-department").value;
  const doctorId = document.getElementById("book-doctor").value;
  const appointmentDate = document.getElementById("book-date").value;
  let appointmentTime = document.getElementById("book-time").value;
  const reason = document.getElementById("book-reason").value.trim() || "Regular consultation";

  if (!patientId) {
    if (errorBox) {
      errorBox.textContent = "Please search and select a registered patient.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  if (!departmentId || !doctorId || !appointmentDate || !appointmentTime) {
    if (errorBox) {
      errorBox.textContent = "Please fill in all required appointment fields.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  // Format time to HH:MM:SS if HH:MM
  if (appointmentTime.split(":").length === 2) {
    appointmentTime += ":00";
  }

  const payload = {
    patient_id: parseInt(patientId, 10),
    department_id: parseInt(departmentId, 10),
    doctor_id: parseInt(doctorId, 10),
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    reason: reason,
  };

  setButtonLoading(submitBtn, true, "Scheduling...");

  try {
    const created = await apiPost("/appointments/", payload);

    showToast(
      `Appointment scheduled successfully! Token #${created.token_number} | Consultation Fee: ₹${created.consultation_fee} (ID: #${created.appointment_id})`,
      "success"
    );

    if (bookAppointmentModal) bookAppointmentModal.hide();
    document.getElementById("book-appointment-form").reset();
    clearSelectedPatientForBooking();

    // Reload appointments
    loadAppointments();
  } catch (error) {
    console.error("Booking error:", error);
    if (errorBox) {
      errorBox.textContent = error.message || "Failed to schedule appointment.";
      errorBox.classList.remove("d-none");
    } else {
      showToast(error.message || "Unable to schedule appointment.", "danger");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle Appointment Cancellation (PATCH /appointments/<id>/)
 */
function handleCancelAppointment(appointmentId, tokenNumber) {
  showConfirmModal({
    title: "Cancel Appointment",
    message: `Are you sure you want to cancel Appointment <strong>#${escapeHtml(appointmentId)}</strong> (Token #${escapeHtml(tokenNumber)})?<br><small class="text-muted">Note: Appointments with recorded payments cannot be cancelled.</small>`,
    confirmBtnText: "Yes, Cancel Appointment",
    confirmBtnClass: "btn-danger",
    onConfirm: async () => {
      await apiPatch(`/appointments/${appointmentId}/`, {});

      showToast(`Appointment #${appointmentId} has been cancelled successfully.`, "success");
      loadAppointments();
    },
  });
}

/**
 * Open Quick Payment Modal for appointment
 */
async function openQuickPaymentModal(appointmentId, fee) {
  activePaymentAppointmentId = appointmentId;
  const amountInput = document.getElementById("pay-amount");
  const modalAptId = document.getElementById("pay-modal-apt-id");
  const feeDisplay = document.getElementById("pay-modal-fee");
  const errorBox = document.getElementById("quick-payment-error");

  if (errorBox) errorBox.classList.add("d-none");
  if (modalAptId) modalAptId.textContent = `#${appointmentId}`;

  // Fetch full appointment details to calculate exact outstanding balance
  try {
    const detail = await apiGet(`/appointments/${appointmentId}/`);
    const bill = detail.billing_details;
    const balance = bill ? parseFloat(bill.outstanding_balance) : parseFloat(fee || 0);
    activePaymentBalance = balance;

    if (feeDisplay) {
      feeDisplay.textContent = `Outstanding Balance: ₹${balance.toFixed(2)}`;
    }
    if (amountInput) {
      amountInput.value = balance > 0 ? balance.toFixed(2) : "";
      amountInput.max = balance;
    }

    if (recordPaymentModal) recordPaymentModal.show();
  } catch (err) {
    showToast("Failed to fetch appointment billing details.", "danger");
  }
}

/**
 * Handle Quick Payment Submit (POST /appointments/<id>/payments/)
 */
async function handleQuickPaymentSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("quick-payment-submit-btn");
  const errorBox = document.getElementById("quick-payment-error");
  const amountVal = parseFloat(document.getElementById("pay-amount").value);
  const methodVal = document.getElementById("pay-method").value;
  const refVal = document.getElementById("pay-reference")?.value.trim() || null;

  if (errorBox) errorBox.classList.add("d-none");

  if (isNaN(amountVal) || amountVal <= 0) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid payment amount greater than zero.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  if (amountVal > activePaymentBalance) {
    if (errorBox) {
      errorBox.textContent = `Amount cannot exceed outstanding balance of ₹${activePaymentBalance.toFixed(2)}.`;
      errorBox.classList.remove("d-none");
    }
    return;
  }

  const payload = {
    amount: amountVal.toFixed(2),
    payment_method: methodVal,
  };
  if (refVal) payload.transaction_reference = refVal;

  setButtonLoading(submitBtn, true, "Processing Payment...");

  try {
    const payment = await apiPost(`/appointments/${activePaymentAppointmentId}/payments/`, payload);

    showToast(
      `Payment of ₹${payment.paid_total} recorded! (Bill #${payment.bill_id} status: ${payment.bill_payment_status})`,
      "success"
    );

    if (recordPaymentModal) recordPaymentModal.hide();
    document.getElementById("quick-payment-form").reset();
    loadAppointments();
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
