/**
 * CLINIC MANAGEMENT SYSTEM - UNIFIED PATIENTS MODULE
 * Section 1: MEDICARE Receptionist Patients Registry & Registration
 * Section 2: ClinixOne Admin Patient Management
 */

// =========================================================
// SECTION 1: MEDICARE RECEPTIONIST PATIENTS MODULE
// =========================================================
(function initReceptionistPatientsModule() {
  let addPatientModal = null;

  document.addEventListener("DOMContentLoaded", () => {
    const isReceptionistPatientsPage =
      document.getElementById("addPatientModal") ||
      document.getElementById("patient-search-input") ||
      document.getElementById("patients-table-tbody");
    if (!isReceptionistPatientsPage) return;

    if (typeof checkAuth === "function" && !checkAuth(true)) return;

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

  // Restrict mobile and emergency contact inputs to exactly 10 digits
  const mobileInput = document.getElementById("patient-mobile");
  if (mobileInput) {
    mobileInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  const emergencyInput = document.getElementById("patient-emergency");
  if (emergencyInput) {
    emergencyInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
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

  // Full Name validation
  const nameRegex = /^[a-zA-Z\s\.\'\-]+$/;
  if (!payload.full_name || payload.full_name.length < 2 || !nameRegex.test(payload.full_name) || !/[a-zA-Z]/.test(payload.full_name)) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid patient name.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-fullname").focus();
    return;
  }

  // Gender validation
  if (!payload.gender || !["Male", "Female", "Other"].includes(payload.gender)) {
    if (errorBox) {
      errorBox.textContent = "Please select a valid gender.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-gender").focus();
    return;
  }

  // Blood group validation
  const validBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  if (!payload.blood_group || !validBloodGroups.includes(payload.blood_group)) {
    if (errorBox) {
      errorBox.textContent = "Please select a valid blood group.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-bloodgroup").focus();
    return;
  }

  // DOB validation: not in future
  if (!payload.dob) {
    if (errorBox) {
      errorBox.textContent = "Please select date of birth.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-dob").focus();
    return;
  }
  const dobDate = new Date(payload.dob);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  if (dobDate > now) {
    if (errorBox) {
      errorBox.textContent = "Date of birth cannot be in the future.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-dob").focus();
    return;
  }

  // Mobile number: exactly 10 digits
  if (!/^[0-9]{10}$/.test(payload.mobile_number)) {
    if (errorBox) {
      errorBox.textContent = "Phone number must contain exactly 10 digits.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-mobile").focus();
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.email || !emailRegex.test(payload.email)) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid email address.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-email").focus();
    return;
  }

  // Emergency contact: exactly 10 digits
  if (!/^[0-9]{10}$/.test(payload.emergency_contact)) {
    if (errorBox) {
      errorBox.textContent = "Emergency contact must contain exactly 10 digits.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-emergency").focus();
    return;
  }

  // Residential address: cannot be empty or only spaces
  if (!payload.address) {
    if (errorBox) {
      errorBox.textContent = "Please enter a valid residential address.";
      errorBox.classList.remove("d-none");
    }
    document.getElementById("patient-address").focus();
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
})();

// =========================================================
// SECTION 2: CLINIXONE ADMIN PATIENT MANAGEMENT
// =========================================================
(function initAdminPatientsModule() {
  let allPatients = [];
  let editingPatientId = null;

  document.addEventListener("DOMContentLoaded", async function () {
    const isAdminPatientsPage =
      document.getElementById("patientsTableBody") ||
      document.getElementById("patientModal");
    if (!isAdminPatientsPage) return;

    await loadPatients();
    setupPatientEvents();
  });

async function loadPatients() {
    const tableBody = document.getElementById("patientsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-loading">
                <span class="spinner"></span> Loading patient registry...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("patientSearch");
        const genderFilter = document.getElementById("genderFilter");
        const bloodFilter = document.getElementById("bloodFilter");
        const statusFilter = document.getElementById("statusFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (genderFilter && genderFilter.value) params.gender = genderFilter.value;
        if (bloodFilter && bloodFilter.value) params.blood_group = bloodFilter.value;
        if (statusFilter && statusFilter.value) params.status = statusFilter.value;

        allPatients = await api.get("/api/admin/patients/", params);
        renderPatientsTable(allPatients);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load patients: ${err.message}
                </td>
            </tr>
        `;
    }
}

function renderPatientsTable(patients) {
    const tableBody = document.getElementById("patientsTableBody");
    const countEl = document.getElementById("patientCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${patients.length} patients`;
    }

    if (!tableBody) return;

    if (!patients || patients.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    <div class="table-empty-icon">♡</div>
                    No patients found in clinical records.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    patients.forEach(p => {
        const row = document.createElement("tr");
        const initials = p.full_name ? p.full_name.slice(0, 2).toUpperCase() : "PT";

        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: var(--primary);">#PAT-${p.patient_id}</span>
            </td>
            <td>
                <div class="user-name">
                    <span class="user-avatar" style="background: var(--green-bg); color: var(--green);">${initials}</span>
                    <div>
                        <strong>${escapeHtml(p.full_name)}</strong>
                        <div style="font-size: 7px; color: var(--text-light);">${escapeHtml(p.email || "")}</div>
                    </div>
                </div>
            </td>
            <td>${p.age ? p.age + " yrs" : "-"}</td>
            <td>${escapeHtml(p.gender || "-")}</td>
            <td>${escapeHtml(p.mobile_number || "-")}</td>
            <td>
                <span class="status ${p.blood_group ? 'checked-in' : ''}">
                    ${escapeHtml(p.blood_group || "-")}
                </span>
            </td>
            <td>
                <span class="status ${p.is_active ? 'active' : 'inactive'}">
                    ${p.is_active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" data-id="${p.patient_id}">View</button>
                    <button class="action-btn edit-btn" data-id="${p.patient_id}">Edit</button>
                    <button class="action-btn ${p.is_active ? 'delete-btn' : 'status-btn'}" data-id="${p.patient_id}" data-action="toggle-status">
                        ${p.is_active ? "Deactivate" : "Activate"}
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function setupPatientEvents() {
    const searchInput = document.getElementById("patientSearch");
    const genderFilter = document.getElementById("genderFilter");
    const bloodFilter = document.getElementById("bloodFilter");
    const statusFilter = document.getElementById("statusFilter");
    const addPatientBtn = document.getElementById("addPatientBtn");
    const patientForm = document.getElementById("patientForm");
    const tableBody = document.getElementById("patientsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadPatients, 300);
        });
    }

    if (genderFilter) genderFilter.addEventListener("change", loadPatients);
    if (bloodFilter) bloodFilter.addEventListener("change", loadPatients);
    if (statusFilter) statusFilter.addEventListener("change", loadPatients);

    if (addPatientBtn) {
        addPatientBtn.addEventListener("click", function () {
            editingPatientId = null;
            document.getElementById("patientModalTitle").textContent = "Register New Patient";
            document.getElementById("patientForm").reset();
            document.getElementById("patActive").checked = true;
            openModal("patientModal");
        });
    }

    // Restrict mobile and emergency contact inputs to numbers and 10 digits
    const patMobileInput = document.getElementById("patMobile");
    if (patMobileInput) {
        patMobileInput.addEventListener("input", function (e) {
            e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
        });
    }

    const patEmergencyInput = document.getElementById("patEmergencyContact");
    if (patEmergencyInput) {
        patEmergencyInput.addEventListener("input", function (e) {
            e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
        });
    }

    const patDobInput = document.getElementById("patDob");
    if (patDobInput) {
        patDobInput.setAttribute("max", new Date().toISOString().split("T")[0]);
    }

    if (patientForm) {
        patientForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("savePatientBtn");
            const errorEl = document.getElementById("patientFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const fullName = document.getElementById("patFullName").value.trim();
            const dob = document.getElementById("patDob").value;
            const gender = document.getElementById("patGender").value;
            const mobile = document.getElementById("patMobile").value.trim();
            const email = document.getElementById("patEmail").value.trim();
            const address = document.getElementById("patAddress").value.trim();
            const bloodGroup = document.getElementById("patBloodGroup").value;
            const emergencyContact = document.getElementById("patEmergencyContact").value.trim();
            const isActive = document.getElementById("patActive").checked;

            const nameRegex = /^[a-zA-Z\s\.\'\-]+$/;
            if (!fullName || fullName.length < 2 || !nameRegex.test(fullName) || !/[a-zA-Z]/.test(fullName)) {
                errorEl.textContent = "Please enter a valid patient name.";
                errorEl.classList.add("active");
                return;
            }

            if (!dob) {
                errorEl.textContent = "Date of birth is required.";
                errorEl.classList.add("active");
                return;
            }
            const dobDate = new Date(dob);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (dobDate > today) {
                errorEl.textContent = "Date of birth cannot be in the future.";
                errorEl.classList.add("active");
                return;
            }

            if (!gender || !["Male", "Female", "Other"].includes(gender)) {
                errorEl.textContent = "Please select a valid gender.";
                errorEl.classList.add("active");
                return;
            }

            const validBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
            if (bloodGroup && !validBloodGroups.includes(bloodGroup)) {
                errorEl.textContent = "Please select a valid blood group.";
                errorEl.classList.add("active");
                return;
            }

            if (!/^[0-9]{10}$/.test(mobile)) {
                errorEl.textContent = "Phone number must contain exactly 10 digits.";
                errorEl.classList.add("active");
                return;
            }

            if (emergencyContact && !/^[0-9]{10}$/.test(emergencyContact)) {
                errorEl.textContent = "Emergency contact must contain exactly 10 digits.";
                errorEl.classList.add("active");
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (email && !emailRegex.test(email)) {
                errorEl.textContent = "Please enter a valid email address.";
                errorEl.classList.add("active");
                return;
            }

            const payload = {
                full_name: fullName,
                dob,
                gender,
                mobile_number: mobile,
                email,
                address,
                blood_group: bloodGroup,
                emergency_contact: emergencyContact,
                is_active: isActive
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingPatientId) {
                    await api.patch(`/api/admin/patients/${editingPatientId}/`, payload);
                    showToast("Patient record updated successfully!", "success");
                } else {
                    await api.post("/api/admin/patients/", payload);
                    showToast("Patient registered successfully!", "success");
                }

                closeModal("patientModal");
                await loadPatients();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save patient.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Patient";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;
            const patientId = btn.getAttribute("data-id");
            if (!patientId) return;

            if (btn.classList.contains("view-btn")) {
                viewPatientProfile(patientId);
            } else if (btn.classList.contains("edit-btn")) {
                openEditPatientModal(patientId);
            } else if (btn.getAttribute("data-action") === "toggle-status") {
                togglePatientStatus(patientId);
            }
        });
    }
}

async function viewPatientProfile(patientId) {
    try {
        const profile = await api.get(`/api/admin/patients/${patientId}/profile/`);
        const p = profile.patient;
        const detailsBody = document.getElementById("viewProfileBody");

        if (detailsBody) {
            const initials = p.full_name ? p.full_name.slice(0, 2).toUpperCase() : "PT";

            let appointmentsHtml = "";
            if (profile.appointments && profile.appointments.length > 0) {
                appointmentsHtml = profile.appointments.map(a => `
                    <div style="padding: 8px 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; font-size: 8px;">
                        <div style="display: flex; justify-content: space-between; font-weight: 700;">
                            <span>${a.appointment_date} · ${a.appointment_time || ''}</span>
                            <span class="status ${a.status === 'completed' ? 'active' : 'waiting'}">${a.status}</span>
                        </div>
                        <div style="color: var(--text-light); margin-top: 3px;">
                            Dr. ${escapeHtml(a.doctor_name)} (${escapeHtml(a.department_name || 'General')}) · Reason: ${escapeHtml(a.reason || 'Consultation')}
                        </div>
                    </div>
                `).join("");
            } else {
                appointmentsHtml = `<div style="color: var(--text-light); font-size: 8px;">No appointments recorded for this patient.</div>`;
            }

            let prescriptionsHtml = "";
            if (profile.prescriptions && profile.prescriptions.length > 0) {
                prescriptionsHtml = profile.prescriptions.map(pr => `
                    <div style="padding: 8px 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; font-size: 8px;">
                        <div style="font-weight: 700; color: var(--primary);">Prescription #${pr.prescription_id} · ${pr.date} (Dr. ${escapeHtml(pr.doctor_name)})</div>
                        <ul style="margin: 4px 0 0 16px;">
                            ${pr.items.map(it => `<li><strong>${escapeHtml(it.medicine)}</strong>: ${it.dosage} (${it.frequency}) for ${it.duration} days - ${escapeHtml(it.instructions || '')}</li>`).join("")}
                        </ul>
                    </div>
                `).join("");
            } else {
                prescriptionsHtml = `<div style="color: var(--text-light); font-size: 8px;">No active prescriptions on file.</div>`;
            }

            let billsHtml = "";
            if (profile.bills && profile.bills.length > 0) {
                billsHtml = profile.bills.map(b => `
                    <div style="padding: 8px 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; font-size: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>Bill #${b.bill_id}</strong> · ${b.bill_date}
                            <div style="color: var(--text-light);">Total: $${parseFloat(b.total_amount).toFixed(2)} | Balance: $${parseFloat(b.balance_amount).toFixed(2)}</div>
                        </div>
                        <span class="status ${b.payment_status === 'paid' ? 'active' : 'pending'}">${b.payment_status}</span>
                    </div>
                `).join("");
            } else {
                billsHtml = `<div style="color: var(--text-light); font-size: 8px;">No billing history available.</div>`;
            }

            detailsBody.innerHTML = `
                <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border);">
                    <div class="user-avatar" style="width: 48px; height: 48px; font-size: 16px; background: var(--green-bg); color: var(--green);">
                        ${initials}
                    </div>
                    <div>
                        <h3 style="font-size: 15px; color: var(--text);">${escapeHtml(p.full_name)}</h3>
                        <div style="font-size: 8px; color: var(--text-light); margin-top: 2px;">
                            ${p.gender} · ${p.age} years · Blood Group: <strong style="color: var(--primary);">${escapeHtml(p.blood_group || 'N/A')}</strong>
                        </div>
                    </div>
                </div>

                <div class="form-grid-2" style="margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border);">
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block;">CONTACT MOBILE</strong>
                        <div style="font-size: 9px; font-weight: 600;">${escapeHtml(p.mobile_number || "N/A")}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block;">EMAIL</strong>
                        <div style="font-size: 9px;">${escapeHtml(p.email || "N/A")}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block;">EMERGENCY CONTACT</strong>
                        <div style="font-size: 9px; font-weight: 600;">${escapeHtml(p.emergency_contact || "N/A")}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block;">RESIDENTIAL ADDRESS</strong>
                        <div style="font-size: 9px;">${escapeHtml(p.address || "N/A")}</div>
                    </div>
                </div>

                <div style="margin-bottom: 14px;">
                    <h4 style="font-size: 10px; color: var(--text); margin-bottom: 8px;">Recent Appointments</h4>
                    ${appointmentsHtml}
                </div>

                <div style="margin-bottom: 14px;">
                    <h4 style="font-size: 10px; color: var(--text); margin-bottom: 8px;">Prescriptions & Medications</h4>
                    ${prescriptionsHtml}
                </div>

                <div>
                    <h4 style="font-size: 10px; color: var(--text); margin-bottom: 8px;">Billing & Invoices</h4>
                    ${billsHtml}
                </div>
            `;

            openModal("viewProfileModal");
        }
    } catch (err) {
        showToast("Failed to load patient profile: " + err.message, "error");
    }
}

async function openEditPatientModal(patientId) {
    editingPatientId = patientId;
    try {
        const p = await api.get(`/api/admin/patients/${patientId}/`);
        document.getElementById("patientModalTitle").textContent = `Edit Patient - ${p.full_name}`;
        document.getElementById("patFullName").value = p.full_name;
        document.getElementById("patDob").value = p.dob;
        document.getElementById("patGender").value = p.gender;
        document.getElementById("patMobile").value = p.mobile_number;
        document.getElementById("patEmail").value = p.email || "";
        document.getElementById("patAddress").value = p.address || "";
        document.getElementById("patBloodGroup").value = p.blood_group || "";
        document.getElementById("patEmergencyContact").value = p.emergency_contact || "";
        document.getElementById("patActive").checked = p.is_active;

        openModal("patientModal");
    } catch (err) {
        showToast("Failed to fetch patient details: " + err.message, "error");
    }
}

async function togglePatientStatus(patientId) {
    const p = allPatients.find(item => item.patient_id === parseInt(patientId, 10));
    if (!p) return;

    const newStatus = !p.is_active;
    const action = newStatus ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${action} patient "${p.full_name}"?`)) return;

    try {
        await api.patch(`/api/admin/patients/${patientId}/`, { is_active: newStatus });
        showToast(`Patient "${p.full_name}" ${action}d.`, "success");
        await loadPatients();
    } catch (err) {
        showToast(`Failed to update status: ${err.message}`, "error");
    }
}
})();
