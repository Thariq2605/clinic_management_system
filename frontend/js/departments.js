/* =========================================================
   CLINIXONE - DEPARTMENTS MANAGEMENT
   ========================================================= */

let allDepartments = [];
let editingDeptId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await loadDepartments();
    setupDepartmentEvents();
});

async function loadDepartments() {
    const tableBody = document.getElementById("departmentsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="table-loading">
                <span class="spinner"></span> Loading departments...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("departmentSearch");
        const statusFilter = document.getElementById("departmentStatusFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (statusFilter && statusFilter.value) params.status = statusFilter.value;

        allDepartments = await api.get("/api/admin/departments/", params);
        renderDepartmentsTable(allDepartments);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load departments: ${err.message}
                </td>
            </tr>
        `;
    }
}

function renderDepartmentsTable(depts) {
    const tableBody = document.getElementById("departmentsTableBody");
    const countEl = document.getElementById("departmentCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${depts.length} departments`;
    }

    if (!tableBody) return;

    if (!depts || depts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">
                    <div class="table-empty-icon">▦</div>
                    No departments found.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    depts.forEach(d => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: var(--primary);">#DEP-${d.department_id}</span>
            </td>
            <td>
                <strong>${escapeHtml(d.department_name)}</strong>
            </td>
            <td style="max-width: 280px; white-space: normal; color: var(--text-light);">
                ${escapeHtml(d.description || "-")}
            </td>
            <td>
                <span style="font-weight: 700; color: var(--text);">${d.doctor_count || 0} Doctors</span>
            </td>
            <td>
                <span class="status ${d.is_active ? 'active' : 'inactive'}">
                    ${d.is_active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${d.department_id}">Edit</button>
                    <button class="action-btn ${d.is_active ? 'delete-btn' : 'status-btn'}" data-id="${d.department_id}" data-action="toggle-status">
                        ${d.is_active ? "Deactivate" : "Activate"}
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function setupDepartmentEvents() {
    const searchInput = document.getElementById("departmentSearch");
    const statusFilter = document.getElementById("departmentStatusFilter");
    const addDeptBtn = document.getElementById("addDepartmentBtn");
    const deptForm = document.getElementById("departmentForm");
    const tableBody = document.getElementById("departmentsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadDepartments, 300);
        });
    }

    if (statusFilter) statusFilter.addEventListener("change", loadDepartments);

    if (addDeptBtn) {
        addDeptBtn.addEventListener("click", function () {
            editingDeptId = null;
            document.getElementById("deptModalTitle").textContent = "Add Department";
            document.getElementById("departmentForm").reset();
            document.getElementById("deptActive").checked = true;
            openModal("departmentModal");
        });
    }

    if (deptForm) {
        deptForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveDeptBtn");
            const errorEl = document.getElementById("deptFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const name = document.getElementById("deptNameInput").value.trim();
            const desc = document.getElementById("deptDescInput").value.trim();
            const isActive = document.getElementById("deptActive").checked;

            if (!name) {
                errorEl.textContent = "Department name is required.";
                errorEl.classList.add("active");
                return;
            }

            const payload = {
                department_name: name,
                description: desc,
                is_active: isActive
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingDeptId) {
                    await api.patch(`/api/admin/departments/${editingDeptId}/`, payload);
                    showToast("Department updated successfully!", "success");
                } else {
                    await api.post("/api/admin/departments/", payload);
                    showToast("Department created successfully!", "success");
                }

                closeModal("departmentModal");
                await loadDepartments();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save department.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Department";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;
            const deptId = btn.getAttribute("data-id");
            if (!deptId) return;

            if (btn.classList.contains("edit-btn")) {
                openEditDeptModal(deptId);
            } else if (btn.getAttribute("data-action") === "toggle-status") {
                toggleDeptStatus(deptId);
            }
        });
    }
}

async function openEditDeptModal(deptId) {
    editingDeptId = deptId;
    try {
        const d = await api.get(`/api/admin/departments/${deptId}/`);
        document.getElementById("deptModalTitle").textContent = "Edit Department";
        document.getElementById("deptNameInput").value = d.department_name;
        document.getElementById("deptDescInput").value = d.description || "";
        document.getElementById("deptActive").checked = d.is_active;
        openModal("departmentModal");
    } catch (err) {
        showToast("Failed to fetch department: " + err.message, "error");
    }
}

async function toggleDeptStatus(deptId) {
    const d = allDepartments.find(item => item.department_id === parseInt(deptId, 10));
    if (!d) return;

    const newStatus = !d.is_active;
    const action = newStatus ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${action} "${d.department_name}"?`)) return;

    try {
        await api.patch(`/api/admin/departments/${deptId}/`, { is_active: newStatus });
        showToast(`Department "${d.department_name}" ${action}d.`, "success");
        await loadDepartments();
    } catch (err) {
        showToast(`Failed to update department: ${err.message}`, "error");
    }
}


