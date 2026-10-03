/**
 * CLINIC MANAGEMENT SYSTEM - PATIENTS MODULE
 * Handles patient search, registration, and quick navigation.
 */

let addPatientModal = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

  const modalEl = document.getElementById("addPatientModal");
  if (modalEl) {
    addPatientModal = new bootstrap.Modal(modalEl);
  }

  // Check URL query parameters (e.g. ?action=new)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "new") {
    if (addPatientModal) addPatientModal.show();
  }

  // Load initial patients
  loadPatients("");

  // Attach search listeners
  const searchInput = document.getElementById("patient-search-input");
  const searchBtn = document.getElementById("patient-search-btn");
  const clearBtn = document.getElementById("patient-search-clear");

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadPatients(searchInput.value.trim());
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadPatients(searchInput.value.trim());
      }
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      loadPatients("");
    });
  }

  // Attach Add Patient Form Submit
  const addForm = document.getElementById("add-patient-form");
  if (addForm) {
    addForm.addEventListener("submit", handleAddPatientSubmit);
  }

  // Restrict DOB input maximum date to today
  const dobInput = document.getElementById("patient-dob");
  if (dobInput) {
    const todayStr = new Date().toISOString().split("T")[0];
    dobInput.setAttribute("max", todayStr);
  }
});

/**
 * Fetch and render patients matching query
 */
async function loadPatients(query) {
  const tbody = document.getElementById("patients-tbody");
  const spinner = document.getElementById("patients-loading-spinner");
  const emptyState = document.getElementById("patients-empty-state");

  if (spinner) spinner.classList.remove("d-none");
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  try {
    let endpoint = "/patients/";
    const trimmed = (query || "").trim();

    // If numeric query, search by patient_id or search query
    if (/^\d+$/.test(trimmed)) {
      endpoint = `/patients/?patient_id=${encodeURIComponent(trimmed)}`;
    } else if (trimmed.length > 0) {
      endpoint = `/patients/?search=${encodeURIComponent(trimmed)}`;
    } else {
      // Default query to load recent patients (backend requires a search query or id)
      endpoint = `/patients/?search=a`;
    }

    const patients = await apiGet(endpoint);

    if (!Array.isArray(patients) || patients.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      renderPatientsTable(patients, tbody);
    }
  } catch (error) {
    console.error("Patients fetch error:", error);
    if (emptyState) {
      emptyState.classList.remove("d-none");
      const title = emptyState.querySelector("h4");
      if (title) title.textContent = "No patients found";
    }
    showToast(error.message || "Failed to load patient records.", "danger");
  } finally {
    if (spinner) spinner.classList.add("d-none");
  }
}

/**
 * Render table rows
 * Columns: Patient ID, Name, Gender, DOB, Mobile, Email, Status, Action
 */
function renderPatientsTable(patients, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  patients.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold text-primary">#${escapeHtml(p.patient_id)}</td>
      <td class="fw-semibold text-dark">${escapeHtml(p.full_name)}</td>
      <td>${escapeHtml(p.gender || "-")}</td>
      <td>${formatDate(p.dob)}</td>
      <td>${escapeHtml(p.mobile_number || "-")}</td>
      <td class="text-truncate" style="max-width: 180px;">${escapeHtml(p.email || "-")}</td>
      <td><span class="badge-status badge-active"><i class="bi bi-check-circle-fill"></i> Active</span></td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <a href="patient-details.html?id=${p.patient_id}" class="btn btn-outline-primary" title="View Profile">
            <i class="bi bi-person-lines-fill me-1"></i> View
          </a>
          <a href="appointments.html?action=new&patient_id=${p.patient_id}" class="btn btn-teal" title="Book Appointment">
            <i class="bi bi-calendar-plus me-1"></i> Book
          </a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Handle Add Patient Form Submission
 */
async function handleAddPatientSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById("add-patient-submit-btn");
  const errorBox = document.getElementById("add-patient-error");

  if (errorBox) {
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
  }

  // Extract form values
  const payload = {
    full_name: document.getElementById("patient-fullname").value.trim(),
    gender: document.getElementById("patient-gender").value,
    dob: document.getElementById("patient-dob").value,
    mobile_number: document.getElementById("patient-mobile").value.trim(),
    email: document.getElementById("patient-email").value.trim(),
    address: document.getElementById("patient-address").value.trim(),
    blood_group: document.getElementById("patient-bloodgroup").value,
    emergency_contact: document.getElementById("patient-emergency").value.trim(),
  };

  // Client-side validations
  if (!payload.full_name || !payload.dob || !payload.gender || !payload.mobile_number || !payload.email || !payload.address || !payload.blood_group || !payload.emergency_contact) {
    if (errorBox) {
      errorBox.textContent = "Please fill in all required patient fields.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  // Validate DOB not in future
  const dobDate = new Date(payload.dob);
  const now = new Date();
  if (dobDate >= now) {
    if (errorBox) {
      errorBox.textContent = "Date of birth must be in the past.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  setButtonLoading(submitBtn, true, "Saving Patient...");

  try {
    const createdPatient = await apiPost("/patients/", payload);

    showToast(`Patient "${createdPatient.full_name}" registered successfully! (ID: #${createdPatient.patient_id})`, "success");

    // Close modal and reset form
    if (addPatientModal) addPatientModal.hide();
    form.reset();

    // Reload patients list searching for newly created patient
    const searchInput = document.getElementById("patient-search-input");
    if (searchInput) searchInput.value = createdPatient.mobile_number;
    loadPatients(createdPatient.mobile_number);
  } catch (error) {
    console.error("Patient creation failed:", error);
    if (errorBox) {
      errorBox.textContent = error.message || "Failed to create patient. Please check input values.";
      errorBox.classList.remove("d-none");
    } else {
      showToast(error.message || "Unable to create patient.", "danger");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
