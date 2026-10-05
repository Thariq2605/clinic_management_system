/* =========================================================
   CLINIXONE - USER MANAGEMENT
   ========================================================= */

let allUsers = [];
let allRoles = [];
let editingUserId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await loadRoles();
    await loadUsers();
    setupUserEvents();
});

/* Load Roles for dropdowns */
async function loadRoles() {
    try {
        allRoles = await api.get("/api/admin/roles/");
        populateRoleFiltersAndSelects();
    } catch (err) {
        console.error("Failed to load roles:", err);
    }
}

function populateRoleFiltersAndSelects() {
    // Filter dropdown
    const roleFilter = document.getElementById("roleFilter");
    if (roleFilter) {
        const currentVal = roleFilter.value;
        roleFilter.innerHTML = `<option value="">All roles</option>`;
        allRoles.forEach(r => {
            roleFilter.innerHTML += `<option value="${r.role_name}">${r.role_name}</option>`;
        });
        roleFilter.value = currentVal;
    }

    // Modal role select
    const userRoleSelect = document.getElementById("userRole");
    if (userRoleSelect) {
        userRoleSelect.innerHTML = `<option value="">Select role...</option>`;
        allRoles.forEach(r => {
            userRoleSelect.innerHTML += `<option value="${r.role_id}">${r.role_name}</option>`;
        });
    }
}

/* Load Users from Backend */
async function loadUsers() {
    const tableBody = document.getElementById("usersTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="table-loading">
                <span class="spinner"></span> Loading users from server...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("userSearch");
        const roleFilter = document.getElementById("roleFilter");
        const statusFilter = document.getElementById("statusFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (roleFilter && roleFilter.value) params.role = roleFilter.value;
        if (statusFilter && statusFilter.value) params.status = statusFilter.value;

        allUsers = await api.get("/api/admin/users/", params);
        renderUsersTable(allUsers);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load users: ${err.message}. Please verify your connection.
                </td>
            </tr>
        `;
    }
}

/* Render Users Table */
function renderUsersTable(users) {
    const tableBody = document.getElementById("usersTableBody");
    const countEl = document.getElementById("userCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${users.length} users`;
    }

    if (!tableBody) return;

    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">
                    <div class="table-empty-icon">♙</div>
                    No users found matching the current criteria.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    users.forEach(user => {
        const row = document.createElement("tr");
        const initials = user.username.slice(0, 2).toUpperCase();
        const roleDisplay = user.role_name || (allRoles.find(r => r.role_id === user.role)?.role_name) || "User";

        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: var(--primary);">#USR-${user.user_id}</span>
            </td>
            <td>
                <div class="user-name">
                    <span class="user-avatar">${initials}</span>
                    <strong>${escapeHtml(user.username)}</strong>
                </div>
            </td>
            <td>
                <span class="status ${roleDisplay.toLowerCase() === 'administrator' ? 'confirmed' : 'checked-in'}">
                    ${escapeHtml(roleDisplay)}
                </span>
            </td>
            <td>
                <span class="status ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? "Active" : "Inactive"}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" data-id="${user.user_id}" title="View details">View</button>
                    <button class="action-btn edit-btn" data-id="${user.user_id}" title="Edit user">Edit</button>
                    <button class="action-btn ${user.is_active ? 'delete-btn' : 'status-btn'}" data-id="${user.user_id}" data-action="toggle-status" title="${user.is_active ? 'Deactivate user' : 'Activate user'}">
                        ${user.is_active ? "Deactivate" : "Activate"}
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

/* Setup Event Listeners */
function setupUserEvents() {
    const searchInput = document.getElementById("userSearch");
    const roleFilter = document.getElementById("roleFilter");
    const statusFilter = document.getElementById("statusFilter");
    const addUserBtn = document.getElementById("addUserBtn");
    const userForm = document.getElementById("userForm");
    const tableBody = document.getElementById("usersTableBody");

    // Dynamic Filter & Search
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadUsers, 300);
        });
    }

    if (roleFilter) roleFilter.addEventListener("change", loadUsers);
    if (statusFilter) statusFilter.addEventListener("change", loadUsers);

    // Open Add User Modal
    if (addUserBtn) {
        addUserBtn.addEventListener("click", function () {
            editingUserId = null;
            document.getElementById("userModalTitle").textContent = "Add New User";
            document.getElementById("userPasswordGroup").style.display = "flex";
            document.getElementById("userPassword").required = true;
            document.getElementById("userPasswordHelp").textContent = "Minimum 8 characters recommended.";
            openModal("userModal");
        });
    }

    // Submit User Form (Add / Edit)
    if (userForm) {
        userForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveUserBtn");
            const errorEl = document.getElementById("userFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const username = document.getElementById("userNameInput").value.trim();
            const role = document.getElementById("userRole").value;
            const password = document.getElementById("userPassword").value;
            const isActive = document.getElementById("userActive").checked;

            if (!username) {
                showFieldError("userNameInput", "Username is required.");
                return;
            }

            if (!role) {
                showFieldError("userRole", "Please select a role.");
                return;
            }

            if (!editingUserId && !password) {
                showFieldError("userPassword", "Password is required for new users.");
                return;
            }

            const payload = {
                username,
                role: parseInt(role, 10),
                is_active: isActive
            };

            if (password) {
                payload.password = password;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingUserId) {
                    await api.patch(`/api/admin/users/${editingUserId}/`, payload);
                    showToast("User updated successfully!", "success");
                } else {
                    await api.post("/api/admin/users/", payload);
                    showToast("User created successfully!", "success");
                }

                closeModal("userModal");
                await loadUsers();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save user.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save User";
            }
        });
    }

    // Table action buttons delegation
    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;

            const userId = btn.getAttribute("data-id");
            if (!userId) return;

            if (btn.classList.contains("view-btn")) {
                viewUserDetails(userId);
            } else if (btn.classList.contains("edit-btn")) {
                openEditUserModal(userId);
            } else if (btn.getAttribute("data-action") === "toggle-status") {
                toggleUserStatus(userId);
            }
        });
    }
}

/* View User Details */
async function viewUserDetails(userId) {
    try {
        const user = await api.get(`/api/admin/users/${userId}/`);
        const detailsBody = document.getElementById("viewUserDetailsBody");
        const roleDisplay = user.role_name || (allRoles.find(r => r.role_id === user.role)?.role_name) || "User";

        if (detailsBody) {
            detailsBody.innerHTML = `
                <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border);">
                    <div class="user-avatar" style="width: 44px; height: 44px; font-size: 14px;">
                        ${user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h4 style="font-size: 13px; color: var(--text);">${escapeHtml(user.username)}</h4>
                        <div style="margin-top: 4px;">
                            <span class="status ${user.is_active ? 'active' : 'inactive'}">
                                ${user.is_active ? "Active Account" : "Inactive / Suspended"}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="form-grid-2">
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">USER ID</strong>
                        <div style="font-size: 10px; font-weight: 600;">#USR-${user.user_id}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">ROLE</strong>
                        <div style="font-size: 10px; font-weight: 600;">${escapeHtml(roleDisplay)}</div>
                    </div>
                    <div>
                        <strong style="color: var(--text-light); font-size: 7px; display: block; margin-bottom: 2px;">STATUS</strong>
                        <div style="font-size: 10px; font-weight: 600;">${user.is_active ? "Active" : "Inactive"}</div>
                    </div>
                </div>
            `;
            openModal("viewUserModal");
        }
    } catch (err) {
        showToast("Failed to load user details: " + err.message, "error");
    }
}

/* Edit User Modal */
async function openEditUserModal(userId) {
    editingUserId = userId;
    try {
        const user = await api.get(`/api/admin/users/${userId}/`);
        document.getElementById("userModalTitle").textContent = "Edit User";
        document.getElementById("userNameInput").value = user.username;
        document.getElementById("userRole").value = user.role;
        document.getElementById("userActive").checked = user.is_active;

        document.getElementById("userPassword").value = "";
        document.getElementById("userPassword").required = false;
        document.getElementById("userPasswordHelp").textContent = "Leave blank to keep existing password.";

        openModal("userModal");
    } catch (err) {
        showToast("Failed to fetch user for editing: " + err.message, "error");
    }
}

/* Toggle User Active Status */
async function toggleUserStatus(userId) {
    const user = allUsers.find(u => u.user_id === parseInt(userId, 10));
    if (!user) return;

    const newStatus = !user.is_active;
    const actionWord = newStatus ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${actionWord} user "${user.username}"?`)) {
        return;
    }

    try {
        await api.patch(`/api/admin/users/${userId}/`, { is_active: newStatus });
        showToast(`User "${user.username}" ${actionWord}d successfully.`, "success");
        await loadUsers();
    } catch (err) {
        showToast(`Failed to ${actionWord} user: ${err.message}`, "error");
    }
}

function showFieldError(fieldId, msg) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.focus();
    const errorEl = field.parentElement.querySelector(".form-error");
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.add("active");
    }
}


