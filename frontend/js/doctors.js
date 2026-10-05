/**
 * CLINIC MANAGEMENT SYSTEM - UNIFIED DOCTORS MODULE
 * Section 1: MEDICARE Receptionist Doctors & Departments Directory
 * Section 2: ClinixOne Admin Doctor Management
 */

// =========================================================
// SECTION 1: MEDICARE RECEPTIONIST DOCTORS MODULE
// =========================================================
(function initReceptionistDoctorsModule() {
  let availabilityModalInstance = null;

  document.addEventListener("DOMContentLoaded", () => {
    const isReceptionistDoctorsPage =
      document.getElementById("doctorAvailabilityModal") ||
      document.getElementById("departments-container") ||
      document.getElementById("doctors-dept-filter");
    if (!isReceptionistDoctorsPage) return;

    if (typeof checkAuth === "function" && !checkAuth(true)) return;

  const modalEl = document.getElementById("doctorAvailabilityModal");
  if (modalEl) {
    availabilityModalInstance = new bootstrap.Modal(modalEl);
  }

  // Load departments and doctors
  loadDepartments();
  loadDoctors();

  // Attach department filter change listener
  const deptSelect = document.getElementById("doctors-dept-filter");
  if (deptSelect) {
    deptSelect.addEventListener("change", () => {
      loadDoctors(deptSelect.value);
    });
  }
});

/**
 * Fetch and render departments cards/list
 */
async function loadDepartments() {
  const container = document.getElementById("departments-container");
  const filterSelect = document.getElementById("doctors-dept-filter");

  if (!container) return;

  try {
    const departments = await apiGet("/departments/");

    container.innerHTML = "";
    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">All Clinical Departments</option>`;
    }

    if (Array.isArray(departments) && departments.length > 0) {
      departments.forEach((d) => {
        const col = document.createElement("div");
        col.className = "col-6 col-md-4 col-xl-2";
        col.innerHTML = `
          <div class="card-custom p-3 text-center h-100 cursor-pointer dept-card" data-id="${d.department_id}">
            <div class="icon-box teal mx-auto mb-2" style="width: 44px; height: 44px; font-size: 1.25rem;">
              <i class="bi bi-hospital"></i>
            </div>
            <div class="fw-bold text-dark small text-truncate" title="${escapeHtml(d.department_name)}">
              ${escapeHtml(d.department_name)}
            </div>
          </div>
        `;
        col.addEventListener("click", () => {
          if (filterSelect) {
            filterSelect.value = d.department_id;
            loadDoctors(d.department_id);
          }
        });
        container.appendChild(col);

        if (filterSelect) {
          const opt = document.createElement("option");
          opt.value = d.department_id;
          opt.textContent = d.department_name;
          filterSelect.appendChild(opt);
        }
      });
    }
  } catch (err) {
    console.error("Departments error:", err);
  }
}

/**
 * Fetch and render doctors list with optional department filter
 */
async function loadDoctors(departmentId = "") {
  const tbody = document.getElementById("doctors-tbody");
  const spinner = document.getElementById("doctors-loading-spinner");
  const emptyState = document.getElementById("doctors-empty-state");

  if (spinner) spinner.classList.remove("d-none");
  if (tbody) tbody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  const endpoint = departmentId ? `/doctors/?department=${encodeURIComponent(departmentId)}` : "/doctors/";

  try {
    const doctors = await apiGet(endpoint);

    if (!Array.isArray(doctors) || doctors.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      renderDoctorsTable(doctors, tbody);
    }
  } catch (error) {
    console.error("Doctors fetch error:", error);
    if (emptyState) emptyState.classList.remove("d-none");
    showToast(error.message || "Failed to load doctors list.", "danger");
  } finally {
    if (spinner) spinner.classList.add("d-none");
  }
}

/**
 * Render Doctors Table rows
 */
function renderDoctorsTable(doctors, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  doctors.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold text-primary">#${escapeHtml(doc.doctor_id)}</td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="user-avatar" style="width: 34px; height: 34px; font-size: 0.85rem;">Dr</div>
          <div>
            <div class="fw-bold text-dark">${escapeHtml(doc.doctor_name || "Doctor #" + doc.doctor_id)}</div>
            <small class="text-muted">License / ID: #${escapeHtml(doc.doctor_id)}</small>
          </div>
        </div>
      </td>
      <td>
        <span class="badge bg-info-subtle text-info border">
          <i class="bi bi-tag me-1"></i>${escapeHtml(doc.department_name || "-")}
        </span>
      </td>
      <td>
        <span class="fw-bold text-success fs-6">${formatCurrency(doc.consultation_fee)}</span>
      </td>
      <td>
        <span class="badge-status badge-active"><i class="bi bi-check-circle-fill"></i> Active</span>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary btn-check-avail" data-id="${doc.doctor_id}" data-name="${escapeHtml(doc.doctor_name)}" title="Check Schedule & Fee">
            <i class="bi bi-calendar-check me-1"></i> Availability
          </button>
          <a href="appointments.html?action=new" class="btn btn-teal" title="Book Appointment">
            <i class="bi bi-calendar-plus"></i> Book
          </a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach availability click listeners
  tbody.querySelectorAll(".btn-check-avail").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAvailabilityModal(btn.dataset.id, btn.dataset.name);
    });
  });
}

/**
 * Check and show doctor availability
 * Explicitly displays backend response: doctor_id, consultation_fee,
 * availability_supported (false), availability (null), and message.
 */
async function openAvailabilityModal(doctorId, doctorName) {
  const modalDoctorName = document.getElementById("avail-doctor-name");
  const modalDoctorId = document.getElementById("avail-doctor-id");
  const modalFee = document.getElementById("avail-consultation-fee");
  const modalSupport = document.getElementById("avail-support-status");
  const modalSchedule = document.getElementById("avail-schedule-value");
  const modalMessage = document.getElementById("avail-backend-message");

  if (modalDoctorName) modalDoctorName.textContent = doctorName || `Doctor #${doctorId}`;
  if (modalDoctorId) modalDoctorId.textContent = `#${doctorId}`;
  if (modalFee) modalFee.textContent = "Loading...";
  if (modalSupport) modalSupport.textContent = "Checking...";
  if (modalSchedule) modalSchedule.textContent = "Checking...";
  if (modalMessage) modalMessage.textContent = "";

  if (availabilityModalInstance) availabilityModalInstance.show();

  try {
    const data = await apiGet(`/doctors/${doctorId}/availability/`);

    if (modalDoctorId) modalDoctorId.textContent = `#${data.doctor_id}`;
    if (modalFee) modalFee.textContent = formatCurrency(data.consultation_fee);
    if (modalSupport) {
      modalSupport.innerHTML = data.availability_supported
        ? `<span class="badge bg-success-subtle text-success">Supported (True)</span>`
        : `<span class="badge bg-warning-subtle text-warning">Not Supported (False)</span>`;
    }
    if (modalSchedule) {
      modalSchedule.textContent = data.availability === null ? "None (null)" : JSON.stringify(data.availability);
    }
    if (modalMessage) {
      modalMessage.textContent = data.message || "No doctor schedule model exists in this project.";
    }
  } catch (err) {
    console.error("Availability fetch error:", err);
    if (modalMessage) modalMessage.textContent = "Unable to fetch doctor schedule.";
  }
}
})();

// =========================================================
// SECTION 2: CLINIXONE ADMIN DOCTOR MANAGEMENT
// =========================================================
(function initAdminDoctorsModule() {
  let allDoctors = [];
  let allStaff = [];
  let allDepartments = [];
  let allSpecializations = [];
  let editingDoctorId = null;

  document.addEventListener("DOMContentLoaded", async function () {
    const isAdminDoctorsPage =
      document.getElementById("doctorTableBody") ||
      document.getElementById("doctorModal");
    if (!isAdminDoctorsPage) return;

    await Promise.all([
      loadStaffList(),
      loadDepartmentsList(),
      loadSpecializationsList()
    ]);
    await loadDoctors();
    setupDoctorEvents();
  });

/* Load Reference Data */
async function loadStaffList() {
    try {
        allStaff = await api.get("/api/admin/staff/");
        populateStaffDropdown();
    } catch (err) {
        console.error("Failed to load staff:", err);
    }
}

async function loadDepartmentsList() {
    try {
        allDepartments = await api.get("/api/admin/departments/");
        populateDepartmentDropdowns();
    } catch (err) {
        console.error("Failed to load departments:", err);
    }
}

async function loadSpecializationsList() {
    try {
        allSpecializations = await api.get("/api/admin/specializations/");
        populateSpecializationDropdowns();
    } catch (err) {
        console.error("Failed to load specializations:", err);
    }
}

function populateStaffDropdown() {
    const staffSelect = document.getElementById("doctorStaff");
    if (!staffSelect) return;
    staffSelect.innerHTML = `<option value="">Select staff member...</option>`;
    allStaff.forEach(s => {
        staffSelect.innerHTML += `<option value="${s.staff_id}">${escapeHtml(s.full_name)} (${escapeHtml(s.role_name || "Staff")})</option>`;
    });
}

function populateDepartmentDropdowns() {
    // Filter
    const deptFilter = document.getElementById("departmentFilter");
    if (deptFilter) {
        deptFilter.innerHTML = `<option value="">All departments</option>`;
        allDepartments.forEach(d => {
            deptFilter.innerHTML += `<option value="${d.department_id}">${escapeHtml(d.department_name)}</option>`;
        });
    }

    // Modal
    const deptSelect = document.getElementById("doctorDepartment");
    if (deptSelect) {
        deptSelect.innerHTML = `<option value="">Select department...</option>`;
        allDepartments.forEach(d => {
            deptSelect.innerHTML += `<option value="${d.department_id}">${escapeHtml(d.department_name)}</option>`;
        });
    }
}

function populateSpecializationDropdowns() {
    const specSelect = document.getElementById("doctorSpecialization");
    if (specSelect) {
        specSelect.innerHTML = `<option value="">Select specialization...</option>`;
        allSpecializations.forEach(s => {
            specSelect.innerHTML += `<option value="${s.specialization_id}">${escapeHtml(s.specialization_name)}</option>`;
        });
    }
}

/* Load Doctors from Backend */
async function loadDoctors() {
    const tableBody = document.getElementById("doctorsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="10" class="table-loading">
                <span class="spinner"></span> Loading doctors from database...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("doctorSearch");
        const deptFilter = document.getElementById("departmentFilter");
        const statusFilter = document.getElementById("statusFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (deptFilter && deptFilter.value) params.department = deptFilter.value;
        if (statusFilter && statusFilter.value) params.status = statusFilter.value;

        allDoctors = await api.get("/api/admin/doctors/", params);
        renderDoctorsTable(allDoctors);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load doctors: ${err.message}. Please verify your connection.
                </td>
            </tr>
        `;
    }
}

/* Render Doctors Table */
function renderDoctorsTable(doctors) {
    const tableBody = document.getElementById("doctorsTableBody");
    const countEl = document.getElementById("doctorCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${doctors.length} doctors`;
    }

    if (!tableBody) return;

    if (!doctors || doctors.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="table-empty">
                    <div class="table-empty-icon">♙</div>
                    No doctors found matching the current filters.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    doctors.forEach(doc => {
        const row = document.createElement("tr");
        const name = doc.doctor_name || "Doctor";
        const initials = name.replace(/Dr\.\s*/i, "").slice(0, 2).toUpperCase() || "DR";

        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: var(--primary);">#DOC-${doc.doctor_id}</span>
            </td>
            <td>
                <div class="doctor-name">
                    <span class="user-avatar">${initials}</span>
                    <div>
                        <strong>${escapeHtml(name)}</strong>
                        <div style="font-size: 7px; color: var(--text-light);">${escapeHtml(doc.email || "")}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(doc.department_name || "-")}</td>
            <td>${escapeHtml(doc.specialization_name || "-")}</td>
            <td>${escapeHtml(doc.qualification || "-")}</td>
            <td>${doc.experience_years ? doc.experience_years + " yrs" : "-"}</td>
            <td><code>${escapeHtml(doc.license_number || "-")}</code></td>
            <td><strong style="color: var(--text);">$${parseFloat(doc.consultation_fee || 0).toFixed(2)}</strong></td>
            <td>
                <span class="status ${doc.is_active ? 'active' : 'inactive'}">
                    ${doc.is_active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" data-id="${doc.doctor_id}" title="View details">View</button>
                    <button class="action-btn edit-btn" data-id="${doc.doctor_id}" title="Edit doctor">Edit</button>
                    <button class="action-btn ${doc.is_active ? 'delete-btn' : 'status-btn'}" data-id="${doc.doctor_id}" data-action="toggle-status" title="${doc.is_active ? 'Deactivate doctor' : 'Activate doctor'}">
                        ${doc.is_active ? "Deactivate" : "Activate"}
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

/* Setup Events */
function setupDoctorEvents() {
    const searchInput = document.getElementById("doctorSearch");
    const deptFilter = document.getElementById("departmentFilter");
    const statusFilter = document.getElementById("statusFilter");
    const addDoctorBtn = document.getElementById("addDoctorBtn");
    const doctorForm = document.getElementById("doctorForm");
    const tableBody = document.getElementById("doctorsTableBody");

    // Debounced search
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadDoctors, 300);
        });
    }

    if (deptFilter) deptFilter.addEventListener("change", loadDoctors);
    if (statusFilter) statusFilter.addEventListener("change", loadDoctors);

    // Open Add Doctor Modal
    if (addDoctorBtn) {
        addDoctorBtn.addEventListener("click", function () {
            editingDoctorId = null;
            document.getElementById("doctorModalTitle").textContent = "Add New Doctor";
            document.getElementById("doctorForm").reset();
            document.getElementById("doctorStaffGroup").style.display = "block";
            openModal("doctorModal");
        });
    }

    // Submit Doctor Form
    if (doctorForm) {
        doctorForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveDoctorBtn");
            const errorEl = document.getElementById("doctorFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const staffId = document.getElementById("doctorStaff").value;
            const departmentId = document.getElementById("doctorDepartment").value;
            const specializationId = document.getElementById("doctorSpecialization").value;
            const qualification = document.getElementById("doctorQualification").value.trim();
            const experienceYears = document.getElementById("doctorExperience").value;
            const licenseNumber = document.getElementById("doctorLicense").value.trim();
            const consultationFee = document.getElementById("doctorFee").value;
            const isActive = document.getElementById("doctorActive").checked;

            if (!editingDoctorId && !staffId) {
                errorEl.textContent = "Please select a staff member for the doctor profile.";
                errorEl.classList.add("active");
                return;
            }

            if (!departmentId || !specializationId) {
                errorEl.textContent = "Please select both department and specialization.";
                errorEl.classList.add("active");
                return;
            }

            const payload = {
                department: parseInt(departmentId, 10),
                specialization: parseInt(specializationId, 10),
                qualification,
                experience_years: parseInt(experienceYears || 0, 10),
                license_number: licenseNumber,
                consultation_fee: parseFloat(consultationFee || 0).toFixed(2),
                is_active: isActive
            };

            if (!editingDoctorId) {
                payload.staff = parseInt(staffId, 10);
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingDoctorId) {
                    await api.patch(`/api/admin/doctors/${editingDoctorId}/`, payload);
                    showToast("Doctor updated successfully!", "success");
                } else {
                    await api.post("/api/admin/doctors/", payload);
                    showToast("Doctor created successfully!", "success");
                }

                closeModal("doctorModal");
                await loadDoctors();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save doctor.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Doctor";
            }
        });
    }

    // Actions delegation
    if (tableBody) {
        tableBody.addEventListener("click", function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;

            const docId = btn.getAttribute("data-id");
            if (!docId) return;

            if (btn.classList.contains("view-btn")) {
                viewDoctorDetails(docId);
            } else if (btn.classList.contains("edit-btn")) {
                openEditDoctorModal(docId);
            } else if (btn.getAttribute("data-action") === "toggle-status") {
                toggleDoctorStatus(docId);
            }
        });
    }
}

/* View Doctor Details */
async function viewDoctorDetails(docId) {
    try {
        const doc = await api.get(`/api/admin/doctors/${docId}/`);
        const detailsBody = document.getElementById("viewDoctorDetailsBody");

        if (detailsBody) {
            const initials = (doc.doctor_name || "DR").replace(/Dr\.\s*/i, "").slice(0, 2).toUpperCase();

            detailsBody.innerHTML = `
                <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border);">
                    <div class="user-avatar" style="width: 46px; height: 46px; font-size: 15px;">
                        ${initials}
                    </div>
                    <div>
                        <h4 style="font-size: 14px; color: var(--text);">${escapeHtml(doc.doctor_name)}</h4>
                        <div style="font-size: 8px; color: var(--primary); font-weight: 600; margin: 2px 0;">
                            ${escapeHtml(doc.specialization_name || "Specialist")} · ${escapeHtml(doc.department_name || "")}
                        </div>
                        <span class="status ${doc.is_active ? 'active' : 'inactive'}">
                            ${doc.is_active ? "Active Doctor" : "Inactive"}
                        </span>
                    </div>
                </div>

                <div class="form-grid-2">
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">DOCTOR ID</strong>
                        <div style="font-size: 10px; font-weight: 600;">#DOC-${doc.doctor_id}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">CONSULTATION FEE</strong>
                        <div style="font-size: 10px; font-weight: 700; color: var(--primary);">$${parseFloat(doc.consultation_fee).toFixed(2)}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">QUALIFICATION</strong>
                        <div style="font-size: 9px; font-weight: 600;">${escapeHtml(doc.qualification || "N/A")}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">EXPERIENCE</strong>
                        <div style="font-size: 9px; font-weight: 600;">${doc.experience_years} years</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">LICENSE NUMBER</strong>
                        <div style="font-size: 9px; font-family: monospace;">${escapeHtml(doc.license_number || "N/A")}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">CONTACT EMAIL</strong>
                        <div style="font-size: 9px;">${escapeHtml(doc.email || "N/A")}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">MOBILE NUMBER</strong>
                        <div style="font-size: 9px;">${escapeHtml(doc.mobile_number || "N/A")}</div>
                    </div>
                </div>
            `;
            openModal("viewDoctorModal");
        }
    } catch (err) {
        showToast("Failed to load doctor details: " + err.message, "error");
    }
}

/* Edit Doctor Modal */
async function openEditDoctorModal(docId) {
    editingDoctorId = docId;
    try {
        const doc = await api.get(`/api/admin/doctors/${docId}/`);
        document.getElementById("doctorModalTitle").textContent = `Edit Doctor - ${doc.doctor_name}`;
        
        // Hide staff select on edit (tied to existing staff record)
        document.getElementById("doctorStaffGroup").style.display = "none";
        
        document.getElementById("doctorDepartment").value = doc.department;
        document.getElementById("doctorSpecialization").value = doc.specialization;
        document.getElementById("doctorQualification").value = doc.qualification || "";
        document.getElementById("doctorExperience").value = doc.experience_years || "";
        document.getElementById("doctorLicense").value = doc.license_number || "";
        document.getElementById("doctorFee").value = doc.consultation_fee || "";
        document.getElementById("doctorActive").checked = doc.is_active;

        openModal("doctorModal");
    } catch (err) {
        showToast("Failed to fetch doctor details: " + err.message, "error");
    }
}

/* Toggle Doctor Status */
async function toggleDoctorStatus(docId) {
    const doc = allDoctors.find(d => d.doctor_id === parseInt(docId, 10));
    if (!doc) return;

    const newStatus = !doc.is_active;
    const actionWord = newStatus ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${actionWord} "${doc.doctor_name}"?`)) {
        return;
    }

    try {
        await api.patch(`/api/admin/doctors/${docId}/`, { is_active: newStatus });
        showToast(`Doctor "${doc.doctor_name}" ${actionWord}d successfully.`, "success");
        await loadDoctors();
    } catch (err) {
        showToast(`Failed to ${actionWord} doctor: ${err.message}`, "error");
    }
}
})();
