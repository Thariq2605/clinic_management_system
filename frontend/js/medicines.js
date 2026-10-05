/* =========================================================
   CLINIXONE - MEDICINES / PHARMACY MANAGEMENT
   ========================================================= */

let allMedicines = [];
let editingMedId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await loadMedicines();
    setupMedicineEvents();
});

async function loadMedicines() {
    const tableBody = document.getElementById("medicinesTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-loading">
                <span class="spinner"></span> Loading pharmacy inventory...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("medicineSearch");
        const statusFilter = document.getElementById("medicineStockFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (statusFilter && statusFilter.value) params.stock_status = statusFilter.value;

        allMedicines = await api.get("/api/admin/medicines/", params);
        renderMedicinesTable(allMedicines);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load medicines: ${err.message}
                </td>
            </tr>
        `;
    }
}

function calculateStockStatus(quantity, expiryDateStr) {
    if (!expiryDateStr) return { status: "Available", class: "available" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);

    if (expiry <= today) {
        return { status: "Expired", class: "expired" };
    }
    if (quantity <= 15) {
        return { status: "Low Stock", class: "low-stock" };
    }
    return { status: "Available", class: "available" };
}

function renderMedicinesTable(meds) {
    const tableBody = document.getElementById("medicinesTableBody");
    const countEl = document.getElementById("medicineCountDisplay");

    if (countEl) {
        countEl.textContent = `Showing ${meds.length} medicines`;
    }

    if (!tableBody) return;

    if (!meds || meds.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    <div class="table-empty-icon">▱</div>
                    No medicines found in the pharmacy catalog.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    meds.forEach(m => {
        const row = document.createElement("tr");
        const stockInfo = calculateStockStatus(m.quantity, m.expiry_date);

        row.innerHTML = `
            <td>
                <div>
                    <strong>${escapeHtml(m.medicine_name)}</strong>
                    <div style="font-size: 7px; color: var(--text-light);">#MED-${m.medicine_id}</div>
                </div>
            </td>
            <td>${escapeHtml(m.manufacturer || "-")}</td>
            <td><strong style="color: var(--text);">$${parseFloat(m.unit_price || 0).toFixed(2)}</strong></td>
            <td>
                <strong style="color: ${m.quantity <= 15 ? 'var(--orange)' : 'var(--text)'};">
                    ${m.quantity} units
                </strong>
            </td>
            <td>
                <span style="color: ${stockInfo.status === 'Expired' ? 'var(--red)' : 'inherit'};">
                    ${m.expiry_date || "-"}
                </span>
            </td>
            <td>
                <span class="status ${stockInfo.class}">
                    ${stockInfo.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${m.medicine_id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${m.medicine_id}">Delete</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function setupMedicineEvents() {
    const searchInput = document.getElementById("medicineSearch");
    const stockFilter = document.getElementById("medicineStockFilter");
    const addMedBtn = document.getElementById("addMedicineBtn");
    const medForm = document.getElementById("medicineForm");
    const tableBody = document.getElementById("medicinesTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadMedicines, 300);
        });
    }

    if (stockFilter) stockFilter.addEventListener("change", loadMedicines);

    if (addMedBtn) {
        addMedBtn.addEventListener("click", function () {
            editingMedId = null;
            document.getElementById("medModalTitle").textContent = "Add Medicine";
            document.getElementById("medicineForm").reset();
            document.getElementById("medActive").checked = true;
            openModal("medicineModal");
        });
    }

    if (medForm) {
        medForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveMedBtn");
            const errorEl = document.getElementById("medFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const name = document.getElementById("medNameInput").value.trim();
            const manufacturer = document.getElementById("medMfgInput").value.trim();
            const price = document.getElementById("medPriceInput").value;
            const quantity = document.getElementById("medQtyInput").value;
            const expiry = document.getElementById("medExpiryInput").value;
            const isActive = document.getElementById("medActive").checked;

            if (!name || !manufacturer || !price || !quantity || !expiry) {
                errorEl.textContent = "Please fill in all required fields.";
                errorEl.classList.add("active");
                return;
            }

            const payload = {
                medicine_name: name,
                manufacturer,
                unit_price: parseFloat(price).toFixed(2),
                quantity: parseInt(quantity, 10),
                expiry_date: expiry,
                is_active: isActive
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingMedId) {
                    await api.patch(`/api/admin/medicines/${editingMedId}/`, payload);
                    showToast("Medicine updated successfully!", "success");
                } else {
                    await api.post("/api/admin/medicines/", payload);
                    showToast("Medicine added to inventory!", "success");
                }

                closeModal("medicineModal");
                await loadMedicines();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save medicine.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Medicine";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", function (e) {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;
            const medId = btn.getAttribute("data-id");
            if (!medId) return;

            if (btn.classList.contains("edit-btn")) {
                openEditMedModal(medId);
            } else if (btn.classList.contains("delete-btn")) {
                deleteMedicine(medId);
            }
        });
    }
}

async function openEditMedModal(medId) {
    editingMedId = medId;
    try {
        const m = await api.get(`/api/admin/medicines/${medId}/`);
        document.getElementById("medModalTitle").textContent = "Edit Medicine";
        document.getElementById("medNameInput").value = m.medicine_name;
        document.getElementById("medMfgInput").value = m.manufacturer;
        document.getElementById("medPriceInput").value = m.unit_price;
        document.getElementById("medQtyInput").value = m.quantity;
        document.getElementById("medExpiryInput").value = m.expiry_date;
        document.getElementById("medActive").checked = m.is_active;
        openModal("medicineModal");
    } catch (err) {
        showToast("Failed to fetch medicine details: " + err.message, "error");
    }
}

async function deleteMedicine(medId) {
    const m = allMedicines.find(item => item.medicine_id === parseInt(medId, 10));
    if (!m) return;

    if (!confirm(`Are you sure you want to delete "${m.medicine_name}"?`)) return;

    try {
        await api.delete(`/api/admin/medicines/${medId}/`);
        showToast(`Medicine "${m.medicine_name}" deleted.`, "success");
        await loadMedicines();
    } catch (err) {
        showToast(`Failed to delete: ${err.message}`, "error");
    }
}


