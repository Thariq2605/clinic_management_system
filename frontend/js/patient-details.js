/**
 * CLINIC MANAGEMENT SYSTEM - PATIENT DETAILS MODULE
 * Handles full patient profile view, edit, status toggle, and appointment history.
 */

let currentPatientId = null;
let currentPatientData = null;
let editModalInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

  const urlParams = new URLSearchParams(window.location.search);
  currentPatientId = urlParams.get("id");

  if (!currentPatientId) {
    showToast("No patient ID provided in URL.", "warning");
    setTimeout(() => { window.location.href = "patients.html"; }, 1500);
    return;
  }

  const editModalEl = document.getElementById("editPatientModal");
  if (editModalEl) {
    editModalInstance = new bootstrap.Modal(editModalEl);
  }

  loadPatientProfile(currentPatientId);

  // Edit patient form submission
  const editForm = document.getElementById("edit-patient-form");
  if (editForm) {
    editForm.addEventListener("submit", handlePatientUpdate);
  }

  // Status toggle button
  const statusToggleBtn = document.getElementById("toggle-patient-status-btn");
  if (statusToggleBtn) {
    statusToggleBtn.addEventListener("click", handleStatusToggle);
  }

  // Restrict mobile and emergency contact inputs to numbers and 10 digits
  const editMobileInput = document.getElementById("edit-patient-mobile");
  if (editMobileInput) {
    editMobileInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  const editEmergencyInput = document.getElementById("edit-patient-emergency");
  if (editEmergencyInput) {
    editEmergencyInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  // Restrict DOB input maximum date to today
  const editDob = document.getElementById("edit-patient-dob");
  if (editDob) {
    editDob.setAttribute("max", new Date().toISOString().split("T")[0]);
  }
});

/**
 * Fetch patient profile and related appointments
 */
async function loadPatientProfile(patientId) {
  const loadingContainer = document.getElementById("patient-detail-loading");
  const contentContainer = document.getElementById("patient-detail-content");

  if (loadingContainer) loadingContainer.classList.remove("d-none");
  if (contentContainer) contentContainer.classList.add("d-none");

  try {
    const patient = await apiGet(`/patients/${patientId}/`);
    currentPatientData = patient;

    // Populate Detail Fields
    document.getElementById("p-header-name").textContent = patient.full_name;
    document.getElementById("p-header-id").textContent = `#${patient.patient_id}`;
    document.getElementById("p-val-name").textContent = patient.full_name;
    document.getElementById("p-val-id").textContent = patient.patient_id;
    document.getElementById("p-val-dob").textContent = formatDate(patient.dob);
    document.getElementById("p-val-gender").textContent = patient.gender || "Not specified";
    document.getElementById("p-val-bloodgroup").textContent = patient.blood_group || "Unknown";
    document.getElementById("p-val-mobile").textContent = patient.mobile_number || "-";
    document.getElementById("p-val-email").textContent = patient.email || "-";
    document.getElementById("p-val-address").textContent = patient.address || "-";
    document.getElementById("p-val-emergency").textContent = patient.emergency_contact || "-";

    // Set Book Appointment Link (pre-selects patient)
    const bookBtn = document.getElementById("patient-book-apt-btn");
    if (bookBtn) {
      bookBtn.href = `appointments.html?action=new&patient_id=${patient.patient_id}`;
    }

    // Active status display
    const statusContainer = document.getElementById("p-status-badge");
    const toggleBtn = document.getElementById("toggle-patient-status-btn");
    if (statusContainer) {
      statusContainer.innerHTML = getActiveStatusBadge(patient.is_active);
    }
    if (toggleBtn) {
      if (patient.is_active) {
        toggleBtn.innerHTML = `<i class="bi bi-person-x me-1"></i> Deactivate Patient`;
        toggleBtn.className = "btn btn-outline-danger btn-sm";
      } else {
        toggleBtn.innerHTML = `<i class="bi bi-person-check me-1"></i> Activate Patient`;
        toggleBtn.className = "btn btn-outline-success btn-sm";
      }
    }

    // Populate Edit Form fields in modal
    populateEditModal(patient);

    // Fetch this patient's appointments
    loadPatientAppointments(patientId);

    if (contentContainer) contentContainer.classList.remove("d-none");
  } catch (error) {
    console.error("Failed to load patient detail:", error);
    showToast(error.message || "Failed to load patient details.", "danger");
  } finally {
    if (loadingContainer) loadingContainer.classList.add("d-none");
  }
}

/**
 * Populate edit modal with current patient values
 */
function populateEditModal(p) {
  document.getElementById("edit-patient-id").value = p.patient_id;
  document.getElementById("edit-patient-fullname").value = p.full_name || "";
  document.getElementById("edit-patient-dob").value = p.dob || "";
  document.getElementById("edit-patient-gender").value = p.gender || "Other";
  document.getElementById("edit-patient-bloodgroup").value = p.blood_group || "O+";
  document.getElementById("edit-patient-mobile").value = p.mobile_number || "";
  document.getElementById("edit-patient-email").value = p.email || "";
  document.getElementById("edit-patient-emergency").value = p.emergency_contact || "";
  document.getElementById("edit-patient-address").value = p.address || "";
}

/**
 * Handle Patient Update (PATCH /patients/<id>/)
 */
async function handlePatientUpdate(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("edit-patient-submit-btn");
  const errorBox = document.getElementById("edit-patient-error");

  if (errorBox) {
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
  }

  const payload = {
    full_name: document.getElementById("edit-patient-fullname").value.trim(),
    dob: document.getElementById("edit-patient-dob").value,
    gender: document.getElementById("edit-patient-gender").value,
    blood_group: document.getElementById("edit-patient-bloodgroup").value,
    mobile_number: document.getElementById("edit-patient-mobile").value.trim(),
    email: document.getElementById("edit-patient-email").value.trim(),
    emergency_contact: document.getElementById("edit-patient-emergency").value.trim(),
    address: document.getElementById("edit-patient-address").value.trim(),
  };

  // Full name validation
  const nameRegex = /^[a-zA-Z\s\.\'\-]+$/;
  if (!payload.full_name || payload.full_name.length < 2 || !nameRegex.test(payload.full_name) || !/[a-zA-Z]/.test(payload.full_name)) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid patient name.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-fullname").focus();
    return;
  }

  // DOB validation
  if (payload.dob) {
    const dobDate = new Date(payload.dob);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    if (dobDate > now) {
      if (errorBox) {
        errorBox.textContent = "Date of birth cannot be in the future.";
        errorBox.classList.remove("d-none");
      }
      document.getElementById("edit-patient-dob").focus();
      return;
    }
  }

  // Gender validation
  if (payload.gender && !["Male", "Female", "Other"].includes(payload.gender)) {
    if (errorBox) {
      errorBox.textContent = "Please select a valid gender.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-gender").focus();
    return;
  }

  // Blood group validation
  const validBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  if (payload.blood_group && !validBloodGroups.includes(payload.blood_group)) {
    if (errorBox) {
      errorBox.textContent = "Please select a valid blood group.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-bloodgroup").focus();
    return;
  }

  // Mobile phone: exactly 10 digits
  if (!/^[0-9]{10}$/.test(payload.mobile_number)) {
    if (errorBox) {
      errorBox.textContent = "Phone number must contain exactly 10 digits.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-mobile").focus();
    return;
  }

  // Email validation: if entered, must be valid
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (payload.email && !emailRegex.test(payload.email)) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid email address.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-email").focus();
    return;
  }

  // Emergency contact: if entered, exactly 10 digits
  if (payload.emergency_contact && !/^[0-9]{10}$/.test(payload.emergency_contact)) {
    if (errorBox) {
      errorBox.textContent = "Emergency contact must contain exactly 10 digits.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-emergency").focus();
    return;
  }

  // Address: if entered, cannot be only spaces
  if (document.getElementById("edit-patient-address").value !== "" && !payload.address) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid residential address.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("edit-patient-address").focus();
    return;
  }

  setButtonLoading(submitBtn, true, "Saving Changes...");

  try {
    await apiPatch(`/patients/${currentPatientId}/`, payload);

    showToast("Patient information updated successfully!", "success");
    if (editModalInstance) editModalInstance.hide();

    // Reload page details
    loadPatientProfile(currentPatientId);
  } catch (error) {
    console.error("Patient update error:", error);
    if (errorBox) {
      errorBox.textContent = error.message || "Failed to update patient details.";
      errorBox.classList.remove("d-none");
    } else {
      showToast(error.message || "Failed to update patient.", "danger");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle Patient Activation/Deactivation (PATCH /patients/<id>/status/)
 */
async function handleStatusToggle() {
  if (!currentPatientData) return;

  const willActivate = !currentPatientData.is_active;
  const actionText = willActivate ? "activate" : "deactivate";

  showConfirmModal({
    title: willActivate ? "Activate Patient" : "Deactivate Patient",
    message: `Are you sure you want to <strong>${actionText}</strong> patient <strong>${escapeHtml(currentPatientData.full_name)}</strong>?`,
    confirmBtnText: willActivate ? "Yes, Activate" : "Yes, Deactivate",
    confirmBtnClass: willActivate ? "btn-success" : "btn-danger",
    onConfirm: async () => {
      const response = await apiPatch(`/patients/${currentPatientId}/status/`, {
        is_active: willActivate,
      });

      showToast(response.message || `Patient status updated to ${willActivate ? "active" : "inactive"}.`, "success");
      loadPatientProfile(currentPatientId);
    },
  });
}

/**
 * Load Appointments associated with this patient
 */
async function loadPatientAppointments(patientId) {
  const tbody = document.getElementById("patient-apts-tbody");
  const emptyState = document.getElementById("patient-apts-empty");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  try {
    const allAppointments = await apiGet(`/appointments/`);
    const patientAppointments = allAppointments.filter((a) => String(a.patient) === String(patientId));

    if (patientAppointments.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }

    patientAppointments.forEach((apt) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="fw-semibold text-primary">#${escapeHtml(apt.token_number || "-")}</td>
        <td>
          <div class="fw-medium">${formatDate(apt.appointment_date)}</div>
          <small class="text-muted"><i class="bi bi-clock me-1"></i>${formatTime(apt.appointment_time)}</small>
        </td>
        <td>
          <div class="fw-medium">${escapeHtml(apt.doctor_name || "Doctor #" + apt.doctor)}</div>
          <small class="text-muted">${escapeHtml(apt.department_name || "-")}</small>
        </td>
        <td>${escapeHtml(apt.reason || "General Consultation")}</td>
        <td>${getStatusBadge(apt.status)}</td>
        <td>${getPaymentStatusBadge(apt.payment_status)}</td>
        <td class="text-end">
          <a href="appointment-details.html?id=${apt.appointment_id}" class="btn btn-sm btn-outline-primary">
            <i class="bi bi-eye"></i> View
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.warn("Unable to load patient appointments history:", err);
  }
}
