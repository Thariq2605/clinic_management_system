/* =========================================================
   CLINIXONE - APPOINTMENTS MANAGEMENT
   ========================================================= */

let allAppointments = [];
let allPatients = [];
let allDoctors = [];
let editingAppointmentId = null;

document.addEventListener("DOMContentLoaded", async function () {
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
        select.innerHTML += `<option value="${d.doctor_id}">${escapeHtml(d.doctor_name)} (${escapeHtml(d.department_name)})</option>`;
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
