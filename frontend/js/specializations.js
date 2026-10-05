/* =========================================================
   CLINIXONE - SPECIALIZATIONS MANAGEMENT
   ========================================================= */

let allSpecializations = [];
let editingSpecId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await loadSpecializations();
    setupSpecializationEvents();
});

async function loadSpecializations() {
    const tableBody = document.getElementById("specializationsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="table-loading">
                <span class="spinner"></span> Loading specializations...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("specializationSearch");
        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();

        allSpecializations = await api.get("/api/admin/specializations/", params);
        renderSpecializationsTable(allSpecializations);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load specializations: ${err.message}
                </td>
            </tr>
        `;
    }
}

function renderSpecializationsTable(specs) {
    const tableBody = document.getElementById("specializationsTableBody");
    const countEl = document.getElementById("specCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${specs.length} specializations`;
    }

    if (!tableBody) return;

    if (!specs || specs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">
                    <div class="table-empty-icon">✦</div>
                    No specializations found.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    specs.forEach(s => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: var(--primary);">#SPEC-${s.specialization_id}</span>
            </td>
            <td>
                <strong>${escapeHtml(s.specialization_name)}</strong>
            </td>
            <td>
                <span style="font-weight: 700; color: var(--text);">${s.doctor_count || 0} Physicians</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${s.specialization_id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${s.specialization_id}">Delete</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function setupSpecializationEvents() {
    const searchInput = document.getElementById("specializationSearch");
    const addSpecBtn = document.getElementById("addSpecializationBtn");
    const specForm = document.getElementById("specializationForm");
    const tableBody = document.getElementById("specializationsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadSpecializations, 300);
        });
    }

    if (addSpecBtn) {
        addSpecBtn.addEventListener("click", function () {
            editingSpecId = null;
            document.getElementById("specModalTitle").textContent = "Add Specialization";
            document.getElementById("specializationForm").reset();
            openModal("specializationModal");
        });
    }

    if (specForm) {
        specForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveSpecBtn");
            const errorEl = document.getElementById("specFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const name = document.getElementById("specNameInput").value.trim();

            if (!name) {
                errorEl.textContent = "Specialization name is required.";
                errorEl.classList.add("active");
                return;
            }

            const payload = { specialization_name: name };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingSpecId) {
                    await api.patch(`/api/admin/specializations/${editingSpecId}/`, payload);
                    showToast("Specialization updated successfully!", "success");
                } else {
                    await api.post("/api/admin/specializations/", payload);
                    showToast("Specialization created successfully!", "success");
                }

                closeModal("specializationModal");
                await loadSpecializations();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save specialization.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Specialization";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;
            const specId = btn.getAttribute("data-id");
            if (!specId) return;

            if (btn.classList.contains("edit-btn")) {
                openEditSpecModal(specId);
            } else if (btn.classList.contains("delete-btn")) {
                deleteSpecialization(specId);
            }
        });
    }
}

async function openEditSpecModal(specId) {
    editingSpecId = specId;
    try {
        const s = await api.get(`/api/admin/specializations/${specId}/`);
        document.getElementById("specModalTitle").textContent = "Edit Specialization";
        document.getElementById("specNameInput").value = s.specialization_name;
        openModal("specializationModal");
    } catch (err) {
        showToast("Failed to fetch specialization: " + err.message, "error");
    }
}

async function deleteSpecialization(specId) {
    const s = allSpecializations.find(item => item.specialization_id === parseInt(specId, 10));
    if (!s) return;

    if (!confirm(`Are you sure you want to delete specialization "${s.specialization_name}"?`)) return;

    try {
        await api.delete(`/api/admin/specializations/${specId}/`);
        showToast(`Specialization "${s.specialization_name}" removed.`, "success");
        await loadSpecializations();
    } catch (err) {
        showToast(`Failed to delete: ${err.message}`, "error");
    }
}


