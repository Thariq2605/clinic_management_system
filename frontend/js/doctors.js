/**
 * CLINIC MANAGEMENT SYSTEM - DOCTORS & DEPARTMENTS MODULE
 * Handles active department list, doctor directory, department filtering,
 * and checking doctor consultation fees & availability stub.
 */

let availabilityModalInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

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
