/* =========================================================
   CLINIXONE - RECEPTIONISTS MANAGEMENT
   ========================================================= */

let allReceptionists = [];
let allDepartments = [];
let receptionistRoleId = null;
let editingStaffId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await Promise.all([
        loadDepartmentsList(),
        findReceptionistRole()
    ]);
    await loadReceptionists();
    setupReceptionistEvents();
});

async function loadDepartmentsList() {
    try {
        allDepartments = await api.get("/api/admin/departments/");
        const deptSelect = document.getElementById("recDepartment");
        if (deptSelect) {
            deptSelect.innerHTML = `<option value="">Select department...</option>`;
            allDepartments.forEach(d => {
                deptSelect.innerHTML += `<option value="${d.department_id}">${escapeHtml(d.department_name)}</option>`;
            });
        }
    } catch (err) {
        console.error("Failed to load departments:", err);
    }
}

async function findReceptionistRole() {
    try {
        const roles = await api.get("/api/admin/roles/");
        const recRole = roles.find(r => r.role_name.toLowerCase() === "receptionist");
        if (recRole) {
            receptionistRoleId = recRole.role_id;
        }
    } catch (err) {
        console.error("Failed to find receptionist role:", err);
    }
}

async function loadReceptionists() {
    const tableBody = document.getElementById("receptionistsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-loading">
                <span class="spinner"></span> Loading receptionists from database...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("receptionistSearch");
        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();

        allReceptionists = await api.get("/api/admin/receptionists/", params);
        renderReceptionistsTable(allReceptionists);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load receptionists: ${err.message}
                </td>
            </tr>
        `;
    }
}

function renderReceptionistsTable(recs) {
    const tableBody = document.getElementById("receptionistsTableBody");
    const countEl = document.getElementById("receptionistCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${recs.length} receptionists`;
    }

    if (!tableBody) return;

    if (!recs || recs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    <div class="table-empty-icon">♙</div>
                    No receptionists found in system records.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    recs.forEach(r => {
        const row = document.createElement("tr");
        const initials = r.full_name ? r.full_name.slice(0, 2).toUpperCase() : "RC";

        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: var(--primary);">#REC-${r.receptionist_id}</span>
            </td>
            <td>
                <div class="user-name">
                    <span class="user-avatar">${initials}</span>
                    <strong>${escapeHtml(r.full_name)}</strong>
                </div>
            </td>
            <td>${escapeHtml(r.department_name || "General Desk")}</td>
            <td>${escapeHtml(r.email || "-")}</td>
            <td>${escapeHtml(r.mobile_number || "-")}</td>
            <td>
                <span class="status ${r.is_active ? 'active' : 'inactive'}">
                    ${r.is_active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-staff-id="${r.staff}" data-id="${r.receptionist_id}">Edit</button>
                    <button class="action-btn ${r.is_active ? 'delete-btn' : 'status-btn'}" data-staff-id="${r.staff}" data-id="${r.receptionist_id}" data-action="toggle-status">
                        ${r.is_active ? "Deactivate" : "Activate"}
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function setupReceptionistEvents() {
    const searchInput = document.getElementById("receptionistSearch");
    const addBtn = document.getElementById("addReceptionistBtn");
    const recForm = document.getElementById("receptionistForm");
    const tableBody = document.getElementById("receptionistsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadReceptionists, 300);
        });
    }

    if (addBtn) {
        addBtn.addEventListener("click", function () {
            editingStaffId = null;
            document.getElementById("recModalTitle").textContent = "Add New Receptionist";
            document.getElementById("receptionistForm").reset();
            document.getElementById("recUserCredentialsGroup").style.display = "grid";
            document.getElementById("recUsername").required = true;
            document.getElementById("recPassword").required = true;
            document.getElementById("recActive").checked = true;
            openModal("receptionistModal");
        });
    }

    if (recForm) {
        recForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveRecBtn");
            const errorEl = document.getElementById("recFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const fullName = document.getElementById("recFullName").value.trim();
            const email = document.getElementById("recEmail").value.trim();
            const mobile = document.getElementById("recMobile").value.trim();
            const gender = document.getElementById("recGender").value;
            const dob = document.getElementById("recDob").value;
            const department = document.getElementById("recDepartment").value;
            const isActive = document.getElementById("recActive").checked;

            const payload = {
                full_name: fullName,
                email,
                mobile_number: mobile,
                gender,
                dob,
                department: parseInt(department, 10),
                is_active: isActive
            };

            if (!editingStaffId) {
                const username = document.getElementById("recUsername").value.trim();
                const password = document.getElementById("recPassword").value;
                if (!username || !password) {
                    errorEl.textContent = "Username and password are required for the new staff account.";
                    errorEl.classList.add("active");
                    return;
                }
                payload.username = username;
                payload.password = password;
                if (receptionistRoleId) {
                    payload.role = receptionistRoleId;
                }
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingStaffId) {
                    await api.patch(`/api/admin/staff/${editingStaffId}/`, payload);
                    showToast("Receptionist profile updated!", "success");
                } else {
                    await api.post("/api/admin/staff/", payload);
                    showToast("Receptionist created successfully!", "success");
                }

                closeModal("receptionistModal");
                await loadReceptionists();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save receptionist.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Receptionist";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;
            const staffId = btn.getAttribute("data-staff-id");
            const recId = btn.getAttribute("data-id");

            if (btn.classList.contains("edit-btn")) {
                openEditRecModal(staffId);
            } else if (btn.getAttribute("data-action") === "toggle-status") {
                toggleRecStatus(staffId, recId);
            }
        });
    }
}

async function openEditRecModal(staffId) {
    editingStaffId = staffId;
    try {
        const staff = await api.get(`/api/admin/staff/${staffId}/`);
        document.getElementById("recModalTitle").textContent = `Edit Receptionist - ${staff.full_name}`;
        document.getElementById("recFullName").value = staff.full_name;
        document.getElementById("recEmail").value = staff.email;
        document.getElementById("recMobile").value = staff.mobile_number;
        document.getElementById("recGender").value = staff.gender;
        document.getElementById("recDob").value = staff.dob;
        document.getElementById("recDepartment").value = staff.department;
        document.getElementById("recActive").checked = staff.is_active;

        document.getElementById("recUserCredentialsGroup").style.display = "none";
        document.getElementById("recUsername").required = false;
        document.getElementById("recPassword").required = false;

        openModal("receptionistModal");
    } catch (err) {
        showToast("Failed to fetch staff record: " + err.message, "error");
    }
}

async function toggleRecStatus(staffId, recId) {
    const rec = allReceptionists.find(r => r.receptionist_id === parseInt(recId, 10));
    if (!rec) return;

    const newStatus = !rec.is_active;
    const action = newStatus ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${action} receptionist "${rec.full_name}"?`)) return;

    try {
        await api.patch(`/api/admin/staff/${staffId}/`, { is_active: newStatus });
        await api.patch(`/api/admin/receptionists/${recId}/`, { is_active: newStatus });
        showToast(`Receptionist "${rec.full_name}" ${action}d.`, "success");
        await loadReceptionists();
    } catch (err) {
        showToast(`Failed to update status: ${err.message}`, "error");
    }
}


