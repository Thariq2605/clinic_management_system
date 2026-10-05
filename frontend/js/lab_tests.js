/* =========================================================
   CLINIXONE - LAB TESTS MANAGEMENT
   ========================================================= */

let allLabTests = [];
let editingLabTestId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await loadLabTests();
    setupLabTestEvents();
});

/* Load Lab Tests */
async function loadLabTests() {
    const tableBody = document.getElementById("labTestsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="table-loading">
                <span class="spinner"></span> Loading lab tests...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("labSearch");
        const categoryFilter = document.getElementById("categoryFilter");
        const statusFilter = document.getElementById("statusFilter");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (categoryFilter && categoryFilter.value && categoryFilter.value !== "all") params.test_type = categoryFilter.value;
        if (statusFilter && statusFilter.value && statusFilter.value !== "all") params.status = statusFilter.value;

        allLabTests = await api.get("/api/admin/lab-tests/", params);
        renderLabTestsTable(allLabTests);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load lab tests: ${err.message}
                </td>
            </tr>
        `;
    }
}

/* Render Table */
function renderLabTestsTable(tests) {
    const tableBody = document.getElementById("labTestsTableBody");
    const countEl = document.getElementById("resultCount");

    if (countEl) {
        countEl.textContent = `Showing ${tests.length} lab tests`;
    }

    if (!tableBody) return;

    if (!tests || tests.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty">
                    <div class="table-empty-icon">⚗</div>
                    No lab tests found.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    tests.forEach(test => {
        const row = document.createElement("tr");
        
        row.innerHTML = `
            <td>
                <span class="appointment-id">#TEST-${test.test_id}</span>
            </td>
            <td>
                <strong>${escapeHtml(test.test_name)}</strong>
                ${test.description ? `<br><small style="color: #718096; font-size: 7px;">${escapeHtml(test.description)}</small>` : ''}
            </td>
            <td>
                <span class="category-text">${escapeHtml(test.test_type)}</span>
            </td>
            <td>
                <span class="price">₹${parseFloat(test.test_fee).toFixed(2)}</span>
            </td>
            <td>
                <span class="${test.is_active ? 'active-badge' : 'inactive-badge'}">
                    ${test.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${test.test_id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${test.test_id}">Delete</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/* Events */
function setupLabTestEvents() {
    const searchInput = document.getElementById("labSearch");
    const categoryFilter = document.getElementById("categoryFilter");
    const statusFilter = document.getElementById("statusFilter");
    const addBtn = document.querySelector(".add-lab-btn");
    const form = document.getElementById("labTestForm");
    const tableBody = document.getElementById("labTestsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadLabTests, 300);
        });
    }

    if (categoryFilter) categoryFilter.addEventListener("change", loadLabTests);
    if (statusFilter) statusFilter.addEventListener("change", loadLabTests);

    if (addBtn) {
        addBtn.addEventListener("click", function () {
            editingLabTestId = null;
            document.getElementById("labTestModalTitle").textContent = "New Lab Test";
            form.reset();
            document.getElementById("labTestActive").checked = true;
            openModal("labTestModal");
        });
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveLabTestBtn");
            const errorEl = document.getElementById("labTestFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const payload = {
                test_name: document.getElementById("labTestName").value.trim(),
                test_type: document.getElementById("labTestType").value,
                description: document.getElementById("labTestDesc").value.trim(),
                test_fee: document.getElementById("labTestFee").value,
                normal_range: document.getElementById("labTestRange").value.trim(),
                is_active: document.getElementById("labTestActive").checked
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingLabTestId) {
                    await api.patch(`/api/admin/lab-tests/${editingLabTestId}/`, payload);
                    showToast("Lab test updated successfully.", "success");
                } else {
                    await api.post("/api/admin/lab-tests/", payload);
                    showToast("Lab test created successfully.", "success");
                }
                closeModal("labTestModal");
                loadLabTests();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save lab test.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Lab Test";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            const editBtn = e.target.closest(".edit-btn");
            const deleteBtn = e.target.closest(".delete-btn");

            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                const test = allLabTests.find(t => t.test_id === id);
                if (test) {
                    editingLabTestId = id;
                    document.getElementById("labTestModalTitle").textContent = "Edit Lab Test";
                    
                    document.getElementById("labTestName").value = test.test_name;
                    document.getElementById("labTestType").value = test.test_type;
                    document.getElementById("labTestDesc").value = test.description || "";
                    document.getElementById("labTestFee").value = test.test_fee;
                    document.getElementById("labTestRange").value = test.normal_range || "";
                    document.getElementById("labTestActive").checked = test.is_active;

                    openModal("labTestModal");
                }
            } else if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm("Are you sure you want to delete this lab test?")) {
                    try {
                        await api.delete(`/api/admin/lab-tests/${id}/`);
                        showToast("Lab test deleted.", "info");
                        loadLabTests();
                    } catch (err) {
                        showToast(err.message || "Failed to delete lab test.", "error");
                    }
                }
            }
        });
    }
}
