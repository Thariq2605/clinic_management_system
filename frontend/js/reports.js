/* =========================================================
   CLINIXONE - REPORTS MANAGEMENT
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
    // Set default date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    if (startInput) startInput.value = formatDate(thirtyDaysAgo);
    if (endInput) endInput.value = formatDate(today);

    await loadReports();
    setupReportEvents();
});

function formatDate(d) {
    return d.toISOString().split("T")[0];
}

function getDateRangeForPeriod(period) {
    const today = new Date();
    let start = new Date(today);

    if (period === "week") {
        start.setDate(today.getDate() - 7);
    } else if (period === "month") {
        start.setDate(today.getDate() - 30);
    } else if (period === "quarter") {
        start.setDate(today.getDate() - 90);
    } else if (period === "year") {
        start.setDate(today.getDate() - 365);
    } else {
        start.setDate(today.getDate() - 30);
    }

    return { start: formatDate(start), end: formatDate(today) };
}

async function loadReports() {
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const periodSelect = document.getElementById("reportPeriod");

    let startDate, endDate;

    if (startInput && startInput.value) {
        startDate = startInput.value;
    } else if (periodSelect) {
        startDate = getDateRangeForPeriod(periodSelect.value).start;
    }

    if (endInput && endInput.value) {
        endDate = endInput.value;
    } else {
        endDate = formatDate(new Date());
    }

    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    try {
        const data = await api.get("/api/admin/reports/", params);
        renderReport(data);
    } catch (err) {
        console.error("Failed to load reports:", err);
        showToast("Failed to load report data.", "error");
    }
}

function renderReport(data) {
    // ===== TOP STAT CARDS =====
    const financial = data.financial || {};
    const appointments = data.appointments || {};
    const patients = data.patients || {};
    const medicines = data.medicines || {};
    const lab = data.lab || {};
    const dateRange = data.date_range || {};

    updateEl("statTotalRevenue", `₹${(financial.total_billed || 0).toFixed(2)}`);
    updateEl("statTotalAppointments", appointments.total || 0);
    updateEl("statTotalPatients", patients.total || 0);
    updateEl("statPendingPayments", `₹${(financial.total_pending || 0).toFixed(2)}`);

    // ===== APPOINTMENT STATISTICS =====
    const aptTotal = appointments.total || 0;
    const aptCompleted = appointments.completed || 0;
    const aptScheduled = appointments.scheduled || 0;
    const aptPending = aptTotal - aptCompleted - aptScheduled - (appointments.cancelled || 0);
    const aptCancelled = appointments.cancelled || 0;

    updateEl("aptTotalLabel", `${aptTotal} total`);
    updateEl("aptCompleted", aptCompleted);
    updateEl("aptScheduled", aptScheduled);
    updateEl("aptPending", Math.max(0, aptPending));
    updateEl("aptCancelled", aptCancelled);

    // Progress bars (percentage of total)
    if (aptTotal > 0) {
        setBarWidth("aptCompletedBar", (aptCompleted / aptTotal) * 100);
        setBarWidth("aptScheduledBar", (aptScheduled / aptTotal) * 100);
        setBarWidth("aptPendingBar", (Math.max(0, aptPending) / aptTotal) * 100);
        setBarWidth("aptCancelledBar", (aptCancelled / aptTotal) * 100);
    }

    // ===== PATIENT STATISTICS =====
    const genderStats = patients.gender_stats || [];
    updateEl("patTotal", patients.total || 0);
    updateEl("patMale", genderStats.find(g => g.gender === "Male")?.count || 0);
    updateEl("patFemale", genderStats.find(g => g.gender === "Female")?.count || 0);
    updateEl("patOther", genderStats.find(g => g.gender === "Other" || g.gender === "other")?.count || 0);

    // ===== MEDICINE & LAB STATISTICS =====
    updateEl("medTotal", medicines.total || 0);
    updateEl("medLowStock", medicines.low_stock || 0);
    updateEl("medExpired", medicines.expired || 0);
    updateEl("medInvValue", `₹${(medicines.inventory_value || 0).toFixed(2)}`);

    // ===== REVENUE / PAYMENT OVERVIEW =====
    const totalBilled = financial.total_billed || 0;
    const totalCollected = financial.total_collected || 0;
    const totalPending = financial.total_pending || 0;
    const pct = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    updateEl("payOverviewTotal", `₹${totalBilled.toFixed(2)}`);
    updateEl("payCollectedPct", `${pct}%`);
    updateEl("payCollectedAmt", `₹${totalCollected.toFixed(2)}`);
    updateEl("payPendingAmt", `₹${totalPending.toFixed(2)}`);

    // ===== REVENUE CHART =====
    const revenueChart = document.querySelector(".revenue-chart");
    if (revenueChart) {
        // Single-period bar pair representing the selected date range
        const maxVal = totalBilled > 0 ? totalBilled : 1;
        const billedPct = Math.min(100, (totalBilled / maxVal) * 90);
        const collectedPct = totalBilled > 0 ? Math.min(90, (totalCollected / totalBilled) * billedPct) : 0;

        // Replace static columns with two bars representing the period
        revenueChart.innerHTML = `
            <div class="revenue-column" style="flex:2;gap:12px;">
                <div class="revenue-bar total" style="height:${billedPct}%;min-height:4px;" title="Billed: ₹${totalBilled.toFixed(2)}"></div>
                <div class="revenue-bar paid" style="height:${collectedPct}%;min-height:4px;" title="Collected: ₹${totalCollected.toFixed(2)}"></div>
            </div>
        `;
    }

    // Update month-labels to show the period
    const monthLabels = document.querySelector(".month-labels");
    if (monthLabels && dateRange.start_date && dateRange.end_date) {
        monthLabels.innerHTML = `
            <span>${dateRange.start_date}</span>
            <span style="color:#1769e8">▶</span>
            <span>${dateRange.end_date}</span>
        `;
    }

    // ===== PERIOD SUMMARY TABLE =====
    if (dateRange.start_date) {
        updateEl("summaryPeriodLabel", `${dateRange.start_date} to ${dateRange.end_date}`);
    }

    // ===== DEPARTMENT PERFORMANCE =====
    renderDepartmentPerformance(data.department_performance || [], appointments.total || 0);

    const summaryBody = document.getElementById("summaryTableBody");
    if (summaryBody) {
        summaryBody.innerHTML = `
            <tr>
                <td><strong>Total Appointments</strong></td>
                <td>${aptTotal}</td>
                <td>${aptCompleted} completed, ${aptCancelled} cancelled</td>
            </tr>
            <tr>
                <td><strong>Total Patients</strong></td>
                <td>${patients.total || 0}</td>
                <td>${genderStats.map(g => `${g.gender}: ${g.count}`).join(", ") || "No gender data"}</td>
            </tr>
            <tr>
                <td><strong>Revenue Billed</strong></td>
                <td>₹${totalBilled.toFixed(2)}</td>
                <td>From bills in period</td>
            </tr>
            <tr>
                <td><strong>Revenue Collected</strong></td>
                <td>₹${totalCollected.toFixed(2)}</td>
                <td>${pct}% collection rate</td>
            </tr>
            <tr>
                <td><strong>Pending Amount</strong></td>
                <td>₹${totalPending.toFixed(2)}</td>
                <td>Billed but not yet collected</td>
            </tr>
            <tr>
                <td><strong>Medicines in Stock</strong></td>
                <td>${medicines.total || 0}</td>
                <td>${medicines.low_stock || 0} low stock, ${medicines.expired || 0} expired</td>
            </tr>
            <tr>
                <td><strong>Lab Tests Available</strong></td>
                <td>${lab.total_tests || 0}</td>
                <td>${lab.total_orders || 0} orders, ${lab.completed_orders || 0} completed</td>
            </tr>
        `;
    }
}

function updateEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
}

function renderDepartmentPerformance(deptData, totalAppointments) {
    const tbody = document.getElementById("deptPerfTableBody");
    const label = document.getElementById("deptPerfLabel");
    if (!tbody) return;

    if (!deptData || deptData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center;color:#718096;padding:24px;">
                    <div style="font-size:9px;">No department data for the selected period.</div>
                </td>
            </tr>
        `;
        if (label) label.textContent = "No data";
        return;
    }

    if (label) label.textContent = `${deptData.length} department${deptData.length !== 1 ? "s" : ""}`;

    const total = totalAppointments || deptData.reduce((sum, d) => sum + d.appointments, 0);

    tbody.innerHTML = deptData.map(dept => {
        const sharePct = total > 0 ? ((dept.appointments / total) * 100).toFixed(1) : "0.0";
        const deptName = dept.department
            ? dept.department.charAt(0).toUpperCase() + dept.department.slice(1)
            : "Unknown";
        return `
            <tr>
                <td><strong>${escapeHtml(deptName)}</strong></td>
                <td>${dept.appointments}</td>
                <td>
                    <span class="department-status">${sharePct}%</span>
                </td>
            </tr>
        `;
    }).join("");
}

function setupReportEvents() {
    const periodSelect = document.getElementById("reportPeriod");
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const generateBtn = document.getElementById("generateReport");
    const applyBtn = document.getElementById("applyDateFilterBtn");
    const printBtn = document.querySelector(".print-report-btn");
    const exportBtn = document.querySelector(".export-report-btn");

    // Period dropdown auto-updates the date inputs then reloads
    if (periodSelect) {
        periodSelect.addEventListener("change", function () {
            const range = getDateRangeForPeriod(this.value);
            if (startInput) startInput.value = range.start;
            if (endInput) endInput.value = range.end;
            loadReports();
        });
    }

    // Apply filter button (if present)
    if (applyBtn) {
        applyBtn.addEventListener("click", loadReports);
    }

    // Generate Report button — refreshes the report using current filters
    // (no PDF/CSV endpoint exists on the backend; this re-fetches live data)
    if (generateBtn) {
        generateBtn.addEventListener("click", async function () {
            generateBtn.disabled = true;
            generateBtn.textContent = "Generating...";
            try {
                await loadReports();
                showToast("Report refreshed with current filters.", "success");
            } catch (err) {
                showToast("Failed to generate report.", "error");
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = "Generate Report";
            }
        });
    }

    if (printBtn) {
        printBtn.addEventListener("click", () => { window.print(); });
    }

    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            showToast("Export is not supported by the current backend.", "info");
        });
    }
}
