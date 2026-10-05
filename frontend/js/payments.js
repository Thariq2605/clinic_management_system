/* =========================================================
   CLINIXONE - PAYMENTS MANAGEMENT
   ========================================================= */

let allPayments = [];
let allBills = [];
let editingPaymentId = null;

document.addEventListener("DOMContentLoaded", async function () {
    await loadBills();
    await loadPayments();
    setupPaymentEvents();
});

/* Load Reference Data */
async function loadBills() {
    try {
        const params = { payment_status: 'pending' }; // Only show pending/partial bills for new payments by default? Actually just load all.
        allBills = await api.get("/api/admin/bills/");
        const select = document.getElementById("paymentBillId");
        if (select) {
            select.innerHTML = `<option value="">Select bill...</option>`;
            allBills.forEach(b => {
                const pendingAmt = parseFloat(b.balance_amount || (b.total_amount - (b.paid_amount || 0))).toFixed(2);
                select.innerHTML += `<option value="${b.bill_id}">INV-${b.bill_id} - ${escapeHtml(b.patient_name)} (Pending: ₹${pendingAmt})</option>`;
            });
        }
    } catch (err) {
        console.error("Failed to load bills:", err);
    }
}

/* Load Payments */
async function loadPayments() {
    const tableBody = document.getElementById("paymentsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="table-loading">
                <span class="spinner"></span> Loading payments...
            </td>
        </tr>
    `;

    try {
        const searchInput = document.getElementById("paymentSearch");
        const methodFilter = document.getElementById("paymentMethodFilter");
        const statusFilter = document.getElementById("paymentStatusFilter");
        const dateInput = document.getElementById("paymentDate");

        const params = {};
        if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
        if (methodFilter && methodFilter.value && methodFilter.value !== "all") params.payment_method = methodFilter.value;

        allPayments = await api.get("/api/admin/payments/", params);
        
        let filtered = allPayments;
        if (dateInput && dateInput.value) {
            filtered = filtered.filter(p => p.payment_date && p.payment_date.startsWith(dateInput.value));
        }
        // Since there is no transaction_status in backend, "success" is assumed for all records.
        if (statusFilter && statusFilter.value && statusFilter.value !== "all") {
            if (statusFilter.value === "success") {
                filtered = filtered; 
            } else {
                filtered = []; // No failed/pending payments in DB by design
            }
        }
        
        renderPaymentsTable(filtered);
    } catch (err) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty" style="color: var(--red);">
                    <div class="table-empty-icon">⚠</div>
                    Failed to load payments: ${err.message}
                </td>
            </tr>
        `;
    }
}

/* Render Table */
function renderPaymentsTable(payments) {
    const tableBody = document.getElementById("paymentsTableBody");
    const countEl = document.getElementById("resultCount");

    if (countEl) {
        countEl.textContent = `Showing ${payments ? payments.length : 0} payments`;
    }

    let totalCollected = 0;

    if (payments && payments.length > 0) {
        payments.forEach(pay => {
            totalCollected += parseFloat(pay.amount || 0);
        });
    }

    const totalPaymentsEl = document.getElementById("totalPayments");
    const totalCollectedEl = document.getElementById("totalCollected");
    const pendingEl = document.getElementById("totalPending");
    const failedEl = document.getElementById("totalFailed");

    if (totalPaymentsEl) totalPaymentsEl.textContent = payments ? payments.length : 0;
    if (totalCollectedEl) totalCollectedEl.textContent = `₹${totalCollected.toFixed(2)}`;
    if (pendingEl) pendingEl.textContent = `₹0.00`;
    if (failedEl) failedEl.textContent = `₹0.00`;

    if (!tableBody) return;

    if (!payments || payments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty">
                    <div class="table-empty-icon">◉</div>
                    No payments found.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    payments.forEach(pay => {
        const row = document.createElement("tr");
        
        let methodBadge = '';
        const methodLower = (pay.payment_method || '').toLowerCase();
        if (methodLower === "cash") {
            methodBadge = `<span class="method-badge cash">Cash</span>`;
        } else if (methodLower === "card") {
            methodBadge = `<span class="method-badge card">Card</span>`;
        } else if (methodLower === "upi" || methodLower === "online") {
            methodBadge = `<span class="method-badge upi">UPI / Online</span>`;
        } else {
            methodBadge = `<span class="method-badge">${escapeHtml(pay.payment_method)}</span>`;
        }
        
        row.innerHTML = `
            <td>
                <span class="payment-id">#PAY-${pay.payment_id}</span>
                <div style="font-size: 7px; color: #718096; margin-top: 2px;">INV-${pay.bill_id}</div>
            </td>
            <td>
                <div class="person-name">${escapeHtml(pay.patient_name)}</div>
            </td>
            <td>
                <div class="payment-date">${pay.payment_date}</div>
            </td>
            <td>
                ${methodBadge}
            </td>
            <td>
                <span class="amount">₹${parseFloat(pay.amount).toFixed(2)}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${pay.payment_id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${pay.payment_id}">Delete</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/* Events */
function setupPaymentEvents() {
    const searchInput = document.getElementById("paymentSearch");
    const methodFilter = document.getElementById("paymentMethodFilter");
    const statusFilter = document.getElementById("paymentStatusFilter");
    const dateInput = document.getElementById("paymentDate");
    const addBtn = document.querySelector(".add-payment-btn");
    const form = document.getElementById("paymentForm");
    const tableBody = document.getElementById("paymentsTableBody");

    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadPayments, 300);
        });
    }

    if (methodFilter) methodFilter.addEventListener("change", loadPayments);
    if (statusFilter) statusFilter.addEventListener("change", loadPayments);
    if (dateInput) dateInput.addEventListener("change", loadPayments);

    if (addBtn) {
        addBtn.addEventListener("click", function () {
            editingPaymentId = null;
            document.getElementById("paymentModalTitle").textContent = "Record Payment";
            form.reset();
            document.getElementById("paymentDateInput").valueAsDate = new Date();
            openModal("paymentModal");
        });
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const submitBtn = document.getElementById("savePaymentBtn");
            const errorEl = document.getElementById("paymentFormError");

            errorEl.classList.remove("active");
            errorEl.textContent = "";

            const payload = {
                bill_id: document.getElementById("paymentBillId").value,
                amount: document.getElementById("paymentAmount").value,
                payment_method: document.getElementById("paymentMethod").value,
                payment_date: document.getElementById("paymentDateInput").value,
                transaction_reference: document.getElementById("paymentRef").value,
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

            try {
                if (editingPaymentId) {
                    await api.patch(`/api/admin/payments/${editingPaymentId}/`, payload);
                    showToast("Payment updated successfully.", "success");
                } else {
                    await api.post("/api/admin/payments/", payload);
                    showToast("Payment recorded successfully.", "success");
                }
                closeModal("paymentModal");
                loadPayments();
            } catch (err) {
                errorEl.textContent = err.message || "Failed to record payment.";
                errorEl.classList.add("active");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Payment";
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener("click", async function (e) {
            const editBtn = e.target.closest(".edit-btn");
            const deleteBtn = e.target.closest(".delete-btn");

            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                const pay = allPayments.find(p => p.payment_id === id);
                if (pay) {
                    editingPaymentId = id;
                    document.getElementById("paymentModalTitle").textContent = "Edit Payment";
                    
                    document.getElementById("paymentBillId").value = pay.bill_id;
                    document.getElementById("paymentAmount").value = pay.amount;
                    document.getElementById("paymentMethod").value = pay.payment_method.toLowerCase();
                    document.getElementById("paymentDateInput").value = pay.payment_date.split("T")[0];
                    document.getElementById("paymentRef").value = pay.transaction_reference || "";

                    openModal("paymentModal");
                }
            } else if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm("Are you sure you want to delete this payment record?")) {
                    try {
                        await api.delete(`/api/admin/payments/${id}/`);
                        showToast("Payment deleted.", "info");
                        loadPayments();
                    } catch (err) {
                        showToast(err.message || "Failed to delete payment.", "error");
                    }
                }
            }
        });
    }
}
