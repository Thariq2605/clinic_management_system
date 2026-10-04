/* =========================================================
   CLINIXONE - BILLING MANAGEMENT
   ========================================================= */

let allBills = [];
let allPatients = [];
let allAppointments = [];
let editingBillId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await Promise.all([
        loadPatients(),
        loadAppointments()
    ]);
    await loadBills();
    setupBillEvents();
});

/* Load Reference Data */
async function loadPatients() {
    try {
        allPatients = await api.get("/api/admin/patients/");
        const select = document.getElementById("billPatient");
        if (select) {
            select.innerHTML = `<option value="">Select patient...</option>`;
            allPatients.forEach(p => {
                select.innerHTML += `<option value="${p.patient_id}">${escapeHtml(p.full_name)}</option>`;
            });
        }
    } catch (err) {
        console.error("Failed to load patients:", err);
    }
}

async function loadAppointments() {
    try {
        allAppointments = await api.get("/api/admin/appointments/");
        const select = document.getElementById("billAppointment");
        if (select) {
            select.innerHTML = `<option value="">Select appointment (optional)...</option>`;
            allAppointments.forEach(a => {
                select.innerHTML += `<option value="${a.appointment_id}">APT-${a.appointment_id} - ${escapeHtml(a.patient_name)}</option>`;
            });
        }
    } catch (err) {
        console.error("Failed to load appointments:", err);
    }
}

/* Load Bills */
async function loadBills() {
    const tableBody = document.getElementById("billsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-loading">
                <span class="spinner"></span> Loading bills...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("billingSearch");
        const statusFilter = document.getElementById("paymentStatusFilter");
        const dateInput = document.getElementById("billingDate");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (statusFilter && statusFilter.value && statusFilter.value !== "all") params.payment_status = statusFilter.value;
        if (dateInput && dateInput.value) params.date = dateInput.value;

        allBills = await api.get("/api/admin/bills/", params);
        renderBillsTable(allBills);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load bills: ${err.message}
                </td>
            </tr>
        `;
    }
}

/* Render Table */
function renderBillsTable(bills) {
    const tableBody = document.getElementById("billsTableBody");
    const countEl = document.getElementById("resultCount");

    if (countEl) {
        countEl.textContent = `Showing ${bills ? bills.length : 0} bills`;
    }

    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    if (bills && bills.length > 0) {
        bills.forEach(bill => {
            totalBilled += parseFloat(bill.total_amount || 0);
            totalPaid += parseFloat(bill.paid_amount || 0);
            totalOutstanding += parseFloat(bill.balance_amount || 0);
        });
    }

    const billsCountEl = document.getElementById("totalBills");
    const billedEl = document.getElementById("totalBilled");
    const paidEl = document.getElementById("totalPaid");
    const outstandingEl = document.getElementById("totalOutstanding");

    if (billsCountEl) billsCountEl.textContent = bills ? bills.length : 0;
    if (billedEl) billedEl.textContent = `₹${totalBilled.toFixed(2)}`;
    if (paidEl) paidEl.textContent = `₹${totalPaid.toFixed(2)}`;
    if (outstandingEl) outstandingEl.textContent = `₹${totalOutstanding.toFixed(2)}`;

    if (!tableBody) return;

    if (!bills || bills.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    <div class="table-empty-icon">▤</div>
                    No bills found.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    bills.forEach(bill => {
        const row = document.createElement("tr");
        
        let statusBadge = '';
        if (bill.payment_status === "paid") {
            statusBadge = `<span class="paid-badge">Paid</span>`;
        } else if (bill.payment_status === "partial") {
            statusBadge = `<span class="partial-badge" style="background: #eaf2ff; color: #1769e8; padding: 4px 8px; border-radius: 12px; font-size: 7px; font-weight: 700;">Partial</span>`;
        } else {
            statusBadge = `<span class="unpaid-badge" style="background: #fdebee; color: #df5366; padding: 4px 8px; border-radius: 12px; font-size: 7px; font-weight: 700;">Pending</span>`;
        }
        
        row.innerHTML = `
            <td>
                <span class="invoice-id">#INV-${bill.bill_id}</span>
            </td>
            <td>
                <div class="person-name">${escapeHtml(bill.patient_name)}</div>
                <div class="person-subtext">Date: ${bill.bill_date}</div>
            </td>
            <td>
                <span class="appointment-ref">${bill.appointment ? '#APT-'+bill.appointment : 'N/A'}</span>
            </td>
            <td>
                <div class="person-name">Dr. ${escapeHtml(bill.doctor_name)}</div>
            </td>
            <td>
                <span class="amount">₹${parseFloat(bill.total_amount).toFixed(2)}</span>
            </td>
            <td>
                ${statusBadge}
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${bill.bill_id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${bill.bill_id}">Delete</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/* Events */
function setupBillEvents() {
    const searchInput = document.getElementById("billingSearch");
    const statusFilter = document.getElementById("paymentStatusFilter");
    const dateInput = document.getElementById("billingDate");
    const addBtn = document.querySelector(".add-bill-btn");
    const form = document.getElementById("billForm");
    const tableBody = document.getElementById("billsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadBills, 300);
        });
    }

    if (statusFilter) statusFilter.addEventListener("change", loadBills);
    if (dateInput) dateInput.addEventListener("change", loadBills);

    if (addBtn) {
        addBtn.addEventListener("click", function () {
            editingBillId = null;
            document.getElementById("billModalTitle").textContent = "Create New Bill";
            form.reset();
            document.getElementById("billDateInput").valueAsDate = new Date();
            openModal("billModal");
        });
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("saveBillBtn");
            const errorEl = document.getElementById("billFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const payload = {
                patient: document.getElementById("billPatient").value,
                appointment: document.getElementById("billAppointment").value,
                total_amount: document.getElementById("billTotalAmount").value,
                bill_date: document.getElementById("billDateInput").value,
                payment_status: document.getElementById("billPaymentStatus").value,
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingBillId) {
                    await api.patch(`/api/admin/bills/${editingBillId}/`, payload);
                    showToast("Bill updated successfully.", "success");
                } else {
                    await api.post("/api/admin/bills/", payload);
                    showToast("Bill created successfully.", "success");
                }
                closeModal("billModal");
                loadBills();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to save bill.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Bill";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            const editBtn = e.target.closest(".edit-btn");
            const deleteBtn = e.target.closest(".delete-btn");

            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                const bill = allBills.find(b => b.bill_id === id);
                if (bill) {
                    editingBillId = id;
                    document.getElementById("billModalTitle").textContent = "Edit Bill";
                    
                    document.getElementById("billPatient").value = bill.patient;
                    document.getElementById("billAppointment").value = bill.appointment || "";
                    document.getElementById("billTotalAmount").value = bill.total_amount;
                    document.getElementById("billDateInput").value = bill.bill_date;
                    document.getElementById("billPaymentStatus").value = bill.payment_status.toLowerCase();

                    openModal("billModal");
                }
            } else if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm("Are you sure you want to delete this bill?")) {
                    try {
                        await api.delete(`/api/admin/bills/${id}/`);
                        showToast("Bill deleted.", "info");
                        loadBills();
                    } catch (err) {
                        showToast(err.message || "Failed to delete bill.", "error");
                    }
                }
            }
        });
    }
}
