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
  const typeVal = document.getElementById("filter-type")?.value;
  const searchVal = document.getElementById("filter-search")?.value.trim();

  const queryParams = new URLSearchParams();
  if (dateVal) queryParams.append("date", dateVal);
  if (docVal) queryParams.append("doctor", docVal);
  if (deptVal) queryParams.append("department", deptVal);
  if (statusVal) queryParams.append("status", statusVal);
  if (typeVal) queryParams.append("appointment_type", typeVal);
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
    const isWalkIn = (apt.appointment_type || "").toLowerCase() === "walk_in";
    const typeBadge = isWalkIn
      ? `<span class="badge" style="background-color: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;"><i class="bi bi-person-walking me-1"></i>Walk-In</span>`
      : `<span class="badge" style="background-color: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd;"><i class="bi bi-calendar2-event me-1"></i>Pre-Booking</span>`;

    tr.innerHTML = `
      <td class="fw-bold text-dark">#${escapeHtml(apt.appointment_id)}</td>
      <td class="fw-bold text-primary">#${escapeHtml(apt.token_number || "-")}</td>
      <td>${typeBadge}</td>
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
/**
 * Local date helper to produce YYYY-MM-DD based on browser's local timezone
 */
function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Local time helper to produce HH:MM based on browser's local time
 */
function getLocalCurrentTimeHHMM() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Initialize Booking Modal components and dynamic type switching
 */
async function initBookingModal() {
  const deptSelect = document.getElementById("book-department");
  const docSelect = document.getElementById("book-doctor");
  const dateInput = document.getElementById("book-date");
  const timeInput = document.getElementById("book-time");
  const timeHint = document.getElementById("book-time-hint");
  const hint = document.getElementById("book-type-hint");
  const feeBadge = document.getElementById("book-consultation-fee-badge");
  const hoursBadge = document.getElementById("book-doctor-hours-badge");

  function updateTimeInputConstraints() {
    if (!timeInput) return;
    const isWalkIn = document.getElementById("type-walk-in")?.checked;
    const selected = docSelect && docSelect.selectedIndex >= 0 ? docSelect.options[docSelect.selectedIndex] : null;
    const hasDoc = selected && selected.value;
    const docStart = selected?.dataset?.startTime || "08:00";
    const docEnd = selected?.dataset?.endTime || "20:00";
    const docHoursDisplay = selected?.dataset?.hoursDisplay || "08:00 AM - 08:00 PM";
    const currentHHMM = getLocalCurrentTimeHHMM();

    if (timeHint) {
      if (hasDoc) {
        timeHint.innerHTML = `<i class="bi bi-clock me-1 text-primary"></i>Working Hours: <strong>${docHoursDisplay}</strong>`;
      } else {
        timeHint.textContent = "";
      }
    }

    if (isWalkIn) {
      // Walk-In: must be >= current time AND >= docStart, and <= docEnd
      const minTime = (hasDoc && currentHHMM < docStart) ? docStart : currentHHMM;
      timeInput.min = minTime;
      timeInput.max = docEnd;
      if (!timeInput.value || timeInput.value < minTime || timeInput.value > docEnd) {
        timeInput.value = minTime;
      }
    } else {
      // Pre-Booking: must be >= docStart and <= docEnd
      timeInput.min = docStart;
      timeInput.max = docEnd;
      if (!timeInput.value || timeInput.value < docStart || timeInput.value > docEnd) {
        timeInput.value = docStart;
      }
    }
  }

  function updateBookingTypeUI() {
    const isWalkIn = document.getElementById("type-walk-in")?.checked;
    const now = new Date();
    const todayStr = getLocalDateString(now);

    if (isWalkIn) {
      if (dateInput) {
        dateInput.value = todayStr;
        dateInput.min = todayStr;
        dateInput.max = todayStr;
        dateInput.readOnly = true;
        dateInput.disabled = true;
        dateInput.classList.add("bg-light");
      }
      if (hint) {
        hint.innerHTML = `<i class="bi bi-info-circle me-1 text-primary"></i><strong>Walk-In appointments are available for today only.</strong>`;
      }
    } else {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
      const tomorrowStr = getLocalDateString(tomorrow);
      const maxDateStr = getLocalDateString(maxDate);

      if (dateInput) {
        dateInput.disabled = false;
        dateInput.readOnly = false;
        dateInput.min = tomorrowStr;
        dateInput.max = maxDateStr;
        dateInput.classList.remove("bg-light");
        if (!dateInput.value || dateInput.value < tomorrowStr || dateInput.value > maxDateStr) {
          dateInput.value = tomorrowStr;
        }
      }
      if (hint) {
        hint.innerHTML = `<i class="bi bi-info-circle me-1"></i>Pre-Booking is available from tomorrow up to 10 days in advance.`;
      }
    }
    updateTimeInputConstraints();
  }

  document.querySelectorAll('input[name="book-appointment-type"]').forEach((radio) => {
    radio.addEventListener("change", updateBookingTypeUI);
  });
  updateBookingTypeUI();

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
      if (feeBadge) feeBadge.classList.add("d-none");
      if (hoursBadge) hoursBadge.classList.add("d-none");
      if (timeHint) timeHint.textContent = "";

      try {
        const doctors = await apiGet(`/doctors/?department=${deptId}`);
        docSelect.innerHTML = `<option value="" disabled selected>Select Doctor</option>`;
        if (Array.isArray(doctors) && doctors.length > 0) {
          doctors.forEach((doc) => {
            const opt = document.createElement("option");
            opt.value = doc.doctor_id;
            opt.dataset.fee = doc.consultation_fee;
            opt.dataset.doctorName = doc.doctor_name || "";
            opt.dataset.startTime = doc.working_hours_start || "08:00";
            opt.dataset.endTime = doc.working_hours_end || "20:00";
            opt.dataset.hoursDisplay = doc.working_hours_display || "08:00 AM - 08:00 PM";
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

  // When Doctor is selected, update fee and hours display badges
  if (docSelect) {
    docSelect.addEventListener("change", () => {
      const selected = docSelect.options[docSelect.selectedIndex];
      const fee = selected?.dataset?.fee;
      if (fee && feeBadge) {
        feeBadge.textContent = `Consultation Fee: ₹${fee}`;
        feeBadge.classList.remove("d-none");
      }
      const hoursDisplay = selected?.dataset?.hoursDisplay;
      if (hoursDisplay && hoursBadge) {
        hoursBadge.innerHTML = `<i class="bi bi-clock me-1"></i>Hours: ${hoursDisplay}`;
        hoursBadge.classList.remove("d-none");
      } else if (hoursBadge) {
        hoursBadge.classList.add("d-none");
      }
      updateTimeInputConstraints();
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
  if (typeof updateBookingTypeUI === "function") updateBookingTypeUI();
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

  const appointmentType = document.querySelector('input[name="book-appointment-type"]:checked')?.value || "pre_booking";
  const now = new Date();
  const todayStr = getLocalDateString(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
  const tomorrowStr = getLocalDateString(tomorrow);
  const maxDateStr = getLocalDateString(maxDate);
  const currentHHMM = getLocalCurrentTimeHHMM();

  const finalAppointmentDate = (appointmentType === "walk_in") ? todayStr : appointmentDate;

  // Retrieve selected doctor's working hours
  const docSelectEl = document.getElementById("book-doctor");
  const selectedDocOpt = docSelectEl && docSelectEl.selectedIndex >= 0 ? docSelectEl.options[docSelectEl.selectedIndex] : null;
  const docStartTime = selectedDocOpt?.dataset?.startTime;
  const docEndTime = selectedDocOpt?.dataset?.endTime;
  const docHoursDisplay = selectedDocOpt?.dataset?.hoursDisplay || "08:00 AM - 08:00 PM";
  let docDisplayName = selectedDocOpt?.dataset?.doctorName || "the doctor";
  if (!docDisplayName.toLowerCase().startsWith("dr.") && !docDisplayName.toLowerCase().startsWith("dr ")) {
    docDisplayName = `Dr. ${docDisplayName}`;
  }

  const enteredTimeHHMM = appointmentTime.slice(0, 5);

  // Validate against Doctor's configured working hours (inclusive)
  if (docStartTime && docEndTime) {
    if (enteredTimeHHMM < docStartTime || enteredTimeHHMM > docEndTime) {
      if (errorBox) {
        errorBox.textContent = `Appointment time must be within ${docDisplayName}'s working hours (${docHoursDisplay}).`;
        errorBox.classList.remove("d-none");
      }
      return;
    }
  }

  if (appointmentType === "walk_in") {
    if (finalAppointmentDate !== todayStr) {
      if (errorBox) {
        errorBox.textContent = "Walk-In appointments can only be booked for today.";
        errorBox.classList.remove("d-none");
      }
      return;
    }
    if (enteredTimeHHMM < currentHHMM) {
      if (errorBox) {
        errorBox.textContent = "Walk-In appointment time cannot be in the past.";
        errorBox.classList.remove("d-none");
      }
      return;
    }
  } else if (appointmentType === "pre_booking") {
    if (finalAppointmentDate === todayStr || finalAppointmentDate < tomorrowStr) {
      if (errorBox) {
        errorBox.textContent = "Pre-Booking is only available from tomorrow onwards. Please use Walk-In for today's appointments.";
        errorBox.classList.remove("d-none");
      }
      return;
    }
    if (finalAppointmentDate > maxDateStr) {
      if (errorBox) {
        errorBox.textContent = "Pre-Booking appointments can only be made up to 10 days in advance.";
        errorBox.classList.remove("d-none");
      }
      return;
    }
  }

  const payload = {
    patient_id: parseInt(patientId, 10),
    department_id: parseInt(departmentId, 10),
    doctor_id: parseInt(doctorId, 10),
    appointment_date: finalAppointmentDate,
    appointment_time: appointmentTime,
    appointment_type: appointmentType,
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
    if (typeof updateBookingTypeUI === "function") updateBookingTypeUI();

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

// =========================================================
// SECTION 2: CLINIXONE ADMIN APPOINTMENTS
// =========================================================
(function initAdminAppointmentsModule() {
  let allAppointments = [];
  let allPatients = [];
  let allDoctors = [];
  let editingAppointmentId = null;

  document.addEventListener("DOMContentLoaded", async function () {
    const isAdminApptPage =
      document.getElementById("appointmentTableBody") ||
      document.getElementById("appointmentModal");
    if (!isAdminApptPage) return;

    await Promise.all([
      loadPatients(),
      loadDoctors()
    ]);
    await loadAppointments();
    setupAppointmentEvents();
  });

/* Load Reference Data */
async function loadPatients() {
    try {
        allPatients = await api.get("/api/admin/patients/");
        populatePatientDropdown();
    } catch (err) {
        console.error("Failed to load patients:", err);
    }
}

async function loadDoctors() {
    try {
        allDoctors = await api.get("/api/admin/doctors/");
        populateDoctorDropdown();
    } catch (err) {
        console.error("Failed to load doctors:", err);
    }
}

function populatePatientDropdown() {
    const select = document.getElementById("appointmentPatient");
    if (!select) return;
    select.innerHTML = `<option value="">Select patient...</option>`;
    allPatients.forEach(p => {
        select.innerHTML += `<option value="${p.patient_id}">${escapeHtml(p.full_name)}</option>`;
    });
}

function populateDoctorDropdown() {
    const select = document.getElementById("appointmentDoctor");
    if (!select) return;
    select.innerHTML = `<option value="">Select doctor...</option>`;
    allDoctors.forEach(d => {
        select.innerHTML += `<option value="${d.doctor_id}">Dr. ${escapeHtml(d.full_name)} (${escapeHtml(d.specialization)})</option>`;
    });
}

/* Load Appointments */
async function loadAppointments() {
    const tableBody = document.getElementById("appointmentsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-loading">
                <span class="spinner"></span> Loading appointments...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("appointmentSearch");
        const dateInput = document.getElementById("appointmentDate");
        const statusFilter = document.getElementById("statusFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (dateInput && dateInput.value) params.date = dateInput.value;
        if (statusFilter && statusFilter.value && statusFilter.value !== "all") params.status = statusFilter.value;

        allAppointments = await api.get("/api/admin/appointments/", params);
        renderAppointmentsTable(allAppointments);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load appointments: ${err.message}
                </td>
            </tr>
        `;
    }
}

/* Render Table */
function renderAppointmentsTable(appointments) {
    const tableBody = document.getElementById("appointmentsTableBody");
    const countEl = document.getElementById("resultCount");

    if (countEl) {
        countEl.textContent = `Showing ${appointments.length} appointments`;
    }

    if (!tableBody) return;

    if (!appointments || appointments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    <div class="table-empty-icon">□</div>
                    No appointments found matching the current criteria.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    appointments.forEach(apt => {
        const row = document.createElement("tr");
        
        const statusClass = getStatusClass(apt.status);
        const statusDisplay = apt.status.charAt(0).toUpperCase() + apt.status.slice(1);
        
        row.innerHTML = `
            <td>
                <span class="appointment-id">${escapeHtml(apt.token_number || '#APT-'+apt.appointment_id)}</span>
            </td>
            <td>
                <div class="person-name">${escapeHtml(apt.patient_name)}</div>
                <div class="person-subtext">${escapeHtml(apt.patient_mobile)}</div>
            </td>
            <td>
                <div class="person-name">Dr. ${escapeHtml(apt.doctor_name)}</div>
                <div class="person-subtext">${escapeHtml(apt.department_name)}</div>
            </td>
            <td>
                <span class="department-text">${escapeHtml(apt.department_name)}</span>
            </td>
            <td>
                <div class="appointment-date-text">${apt.appointment_date}</div>
                <div class="appointment-time">${apt.appointment_time}</div>
            </td>
            <td>
                <span class="${statusClass}">${statusDisplay}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${apt.appointment_id}" title="Edit">Edit</button>
                    <button class="action-btn delete-btn" data-id="${apt.appointment_id}" title="Delete">Delete</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function getStatusClass(status) {
    status = status.toLowerCase();
    if (status === "scheduled" || status === "confirmed") return "scheduled-badge";
    if (status === "completed") return "completed-badge";
    if (status === "cancelled") return "cancelled-badge";
    return "pending-badge";
}

/* Events */
function setupAppointmentEvents() {
    const searchInput = document.getElementById("appointmentSearch");
    const dateInput = document.getElementById("appointmentDate");
    const statusFilter = document.getElementById("statusFilter");
    const addBtn = document.querySelector(".add-appointment-btn");
    const form = document.getElementById("appointmentForm");
    const tableBody = document.getElementById("appointmentsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadAppointments, 300);
        });
    }

    if (dateInput) dateInput.addEventListener("change", loadAppointments);
    if (statusFilter) statusFilter.addEventListener("change", loadAppointments);

    if (addBtn) {
        addBtn.addEventListener("click", function () {
            editingAppointmentId = null;
            document.getElementById("appointmentModalTitle").textContent = "New Appointment";
            openModal("appointmentModal");
        });
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveAppointmentBtn");
            const errorEl = document.getElementById("appointmentFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const payload = {
                patient: document.getElementById("appointmentPatient").value,
                doctor: document.getElementById("appointmentDoctor").value,
                appointment_date: document.getElementById("appointmentDateInput").value,
                appointment_time: document.getElementById("appointmentTimeInput").value,
                reason: document.getElementById("appointmentReason").value,
                status: document.getElementById("appointmentStatus").value,
                payment_status: document.getElementById("appointmentPaymentStatus").value,
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingAppointmentId) {
                    await api.patch(`/api/admin/appointments/${editingAppointmentId}/`, payload);
                    showToast("Appointment updated successfully.", "success");
                } else {
                    await api.post("/api/admin/appointments/", payload);
                    showToast("Appointment created successfully.", "success");
                }
                closeModal("appointmentModal");
                loadAppointments();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save appointment.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Appointment";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            const editBtn = e.target.closest(".edit-btn");
            const deleteBtn = e.target.closest(".delete-btn");

            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                const apt = allAppointments.find(a => a.appointment_id === id);
                if (apt) {
                    editingAppointmentId = id;
                    document.getElementById("appointmentModalTitle").textContent = "Edit Appointment";
                    
                    document.getElementById("appointmentPatient").value = apt.patient;
                    document.getElementById("appointmentDoctor").value = apt.doctor;
                    document.getElementById("appointmentDateInput").value = apt.appointment_date;
                    document.getElementById("appointmentTimeInput").value = apt.appointment_time;
                    document.getElementById("appointmentReason").value = apt.reason || "";
                    document.getElementById("appointmentStatus").value = apt.status.toLowerCase();
                    document.getElementById("appointmentPaymentStatus").value = apt.payment_status;

                    openModal("appointmentModal");
                }
            } else if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm("Are you sure you want to delete this appointment? This action cannot be undone.")) {
                    try {
                        await api.delete(`/api/admin/appointments/${id}/`);
                        showToast("Appointment deleted.", "info");
                        loadAppointments();
                    } catch (err) {
                        showToast(err.message || "Failed to delete appointment.", "error");
                    }
                }
            }
        });
    }
}
})();
