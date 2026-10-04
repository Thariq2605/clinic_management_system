/* =========================================================
   CLINIXONE - PATIENT MANAGEMENT
   ========================================================= */

let allPatients = [];
let editingPatientId = null;

document.addEventListener("DOMContentLoaded", async function () {
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

            if (!fullName || !dob || !gender || !mobile) {
                errorEl.textContent = "Please fill in all mandatory fields.";
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


