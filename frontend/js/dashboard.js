/**
 * CLINIC MANAGEMENT SYSTEM - UNIFIED DASHBOARD MODULE
 * Section 1: MEDICARE Receptionist Dashboard
 * Section 2: ClinixOne Admin Dashboard
 */

// =========================================================
// SECTION 1: MEDICARE RECEPTIONIST DASHBOARD
// =========================================================
(function initReceptionistDashboardModule() {
  document.addEventListener("DOMContentLoaded", () => {
    const isReceptionistDashboard =
      document.getElementById("today-appointments-tbody") ||
      document.getElementById("dashboard-welcome-heading") ||
      document.getElementById("refresh-dashboard-btn");
    if (!isReceptionistDashboard) return;

    if (typeof checkAuth === "function" && !checkAuth(true)) return;

  loadDashboardData();

  const refreshBtn = document.getElementById("refresh-dashboard-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadDashboardData();
    });
  }
});

async function loadDashboardData() {
  const loadingSpinner = document.getElementById("dashboard-table-spinner");
  const tableBody = document.getElementById("today-appointments-tbody");
  const emptyState = document.getElementById("today-empty-state");

  if (loadingSpinner) loadingSpinner.classList.remove("d-none");
  if (tableBody) tableBody.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");

  // Format today's date YYYY-MM-DD
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const todayDisplayEl = document.getElementById("dashboard-today-display");
  if (todayDisplayEl) {
    todayDisplayEl.textContent = today.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Update Welcome message with receptionist's name if available
  const storedUser = sessionStorage.getItem("clinic_user");
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      const welcomeEl = document.getElementById("dashboard-welcome-heading");
      if (welcomeEl && u.name) {
        welcomeEl.textContent = `Welcome, ${u.name}`;
      }
    } catch {}
  }

  try {
    // Fetch Today's Appointments using existing endpoint:
    // GET /api/receptionist/appointments/?date=YYYY-MM-DD
    const todayAppointments = await apiGet(`/appointments/?date=${todayStr}`);

    // Calculate the 4 required stats strictly from appointment data
    let totalToday = 0;
    let scheduledCount = 0;
    let completedCount = 0;
    let paidConsultationsCount = 0;

    if (Array.isArray(todayAppointments)) {
      totalToday = todayAppointments.length;
      todayAppointments.forEach((apt) => {
        const status = (apt.status || "").toLowerCase();
        const payStatus = (apt.payment_status || "").toLowerCase();

        if (status === "scheduled" || status === "confirmed") {
          scheduledCount++;
        }
        if (status === "completed") {
          completedCount++;
        }
        if (payStatus === "paid") {
          paidConsultationsCount++;
        }
      });
    }

    // Update Counter Badges
    document.getElementById("stat-today-appointments").textContent = totalToday;
    document.getElementById("stat-scheduled-appointments").textContent = scheduledCount;
    document.getElementById("stat-completed-appointments").textContent = completedCount;
    document.getElementById("stat-paid-consultations").textContent = paidConsultationsCount;

    // Render Today's Appointments Table
    if (!Array.isArray(todayAppointments) || todayAppointments.length === 0) {
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      renderTodayTable(todayAppointments, tableBody);
    }
  } catch (error) {
    console.error("Dashboard error:", error);
    showToast(error.message || "Failed to load dashboard data.", "danger");
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add("d-none");
  }
}

function renderTodayTable(appointments, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  appointments.forEach((apt) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold text-primary">#${escapeHtml(apt.token_number || "-")}</td>
      <td>
        <div class="fw-semibold text-dark">${escapeHtml(apt.patient_name || "Patient #" + apt.patient)}</div>
        <small class="text-muted"><a href="patient-details.html?id=${apt.patient}" class="text-decoration-none">ID: #${apt.patient}</a></small>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(apt.doctor_name || "Doctor #" + apt.doctor)}</div>
      </td>
      <td>
        <span class="badge bg-light text-dark border">${escapeHtml(apt.department_name || "-")}</span>
      </td>
      <td>
        <span class="badge bg-light text-dark border">
          <i class="bi bi-clock me-1 text-primary"></i>${formatTime(apt.appointment_time)}
        </span>
      </td>
      <td>${getStatusBadge(apt.status)}</td>
      <td>${getPaymentStatusBadge(apt.payment_status)}</td>
      <td class="text-end">
        <a href="appointment-details.html?id=${apt.appointment_id}" class="btn btn-sm btn-outline-primary" title="View Details">
          <i class="bi bi-eye me-1"></i> View Details
        </a>
      </td>
    `;
  });
}
})();

// =========================================================
// SECTION 2: CLINIXONE ADMIN DASHBOARD
// =========================================================
(function initAdminDashboardModule() {
  document.addEventListener("DOMContentLoaded", function () {
    const isAdminDashboard =
      document.getElementById("statDoctors") ||
      document.getElementById("appointmentBarChart") ||
      document.getElementById("recentActivitiesList");
    if (!isAdminDashboard) return;

    loadDashboardData();
  });


/* =====================================================
   MAIN DATA LOADER
   ===================================================== */
async function loadDashboardData() {

    // Show loading state
    setLoadingState(true);

    try {
        const data = await api.get("/api/admin/dashboard/");
        populateGreeting();
        populateStatCards(data);
        populateAppointmentChart(data.weekly_appointments);
        populatePaymentOverview(data.payment_stats, data.pending_payments);
        populateRecentAppointments(data.recent_appointments);
        populateRecentActivities(data.recent_activities);
    } catch (error) {
        console.error("Dashboard load failed:", error);
        if (error.message !== "Unauthorized" && error.message !== "Forbidden") {
            showToast("Failed to load dashboard data. Please refresh.", "error");
        }
    } finally {
        setLoadingState(false);
    }
}


/* =====================================================
   GREETING (from cached user profile)
   ===================================================== */
function populateGreeting() {
    const greetingEl = document.getElementById("dashboardGreeting");
    const subtitleEl = document.getElementById("dashboardSubtitle");
    if (!greetingEl) return;

    let firstName = "Admin";
    try {
        const user = JSON.parse(localStorage.getItem("current_user"));
        if (user && user.full_name) {
            firstName = user.full_name.split(" ")[0];
        } else if (user && user.username) {
            firstName = user.username;
        }
    } catch (_) { /* ignore parse errors */ }

    const hour = new Date().getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17) greeting = "Good evening";

    greetingEl.textContent = `${greeting}, ${firstName}`;

    if (subtitleEl) {
        const today = new Date();
        const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
        subtitleEl.textContent = `Here's what's happening across your clinic today — ${today.toLocaleDateString("en-US", options)}.`;
    }
}


/* =====================================================
   STATISTICS CARDS
   ===================================================== */
function populateStatCards(data) {
    setStatValue("statDoctors", formatNumber(data.total_doctors));
    setStatValue("statReceptionists", formatNumber(data.total_receptionists));
    setStatValue("statPatients", formatNumber(data.total_patients));
    setStatValue("statAppointments", formatNumber(data.todays_appointments));
    setStatValue("statPendingPayments", "$" + formatNumber(data.pending_payments));
    setStatValue("statLabOrders", formatNumber(data.pending_lab_orders));
    setStatValue("statPrescriptions", formatNumber(data.active_prescriptions));
}

function setStatValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}


/* =====================================================
   APPOINTMENT BAR CHART
   ===================================================== */
function populateAppointmentChart(weeklyData) {
    const chartContainer = document.getElementById("appointmentBarChart");
    const chartSubtitle = document.getElementById("appointmentChartSubtitle");
    if (!chartContainer || !weeklyData || weeklyData.length === 0) return;

    const totalWeekly = weeklyData.reduce((sum, d) => sum + d.count, 0);
    const maxCount = Math.max(...weeklyData.map(d => d.count), 1);

    if (chartSubtitle) {
        chartSubtitle.textContent = `This week · ${formatNumber(totalWeekly)} total`;
    }

    chartContainer.innerHTML = "";

    weeklyData.forEach(day => {
        const heightPct = Math.max((day.count / maxCount) * 100, 4); // min 4% for visibility
        const wrapper = document.createElement("div");
        wrapper.className = "bar-wrapper";

        const bar = document.createElement("div");
        bar.className = "bar" + (day.is_today ? " active-bar" : "");
        bar.style.height = heightPct + "%";
        bar.title = `${day.day}: ${day.count} appointments`;

        const label = document.createElement("span");
        label.textContent = day.day;

        wrapper.appendChild(bar);
        wrapper.appendChild(label);
        chartContainer.appendChild(wrapper);
    });
}


/* =====================================================
   PAYMENT DONUT CHART
   ===================================================== */
function populatePaymentOverview(paymentStats, pendingAmount) {
    const paymentSubtitle = document.getElementById("paymentSubtitle");
    const donutChart = document.getElementById("paymentDonut");
    const paidPctEl = document.getElementById("paidPct");
    const pendingPctEl = document.getElementById("pendingPct");
    const overduePctEl = document.getElementById("overduePct");

    if (!paymentStats) return;

    const paidPct = paymentStats.paid_pct || 0;
    const pendingPct = paymentStats.pending_pct || 0;
    const overduePct = paymentStats.overdue_pct || 0;

    if (paymentSubtitle) {
        paymentSubtitle.textContent =
            `${formatNumber(paymentStats.total_bills)} total bills · $${formatNumber(pendingAmount)} pending`;
    }

    // Update donut via CSS conic-gradient
    if (donutChart) {
        const paidEnd = paidPct;
        const pendingEnd = paidEnd + pendingPct;
        donutChart.style.background = `conic-gradient(
            #2e7d6f 0% ${paidEnd}%,
            #f0a944 ${paidEnd}% ${pendingEnd}%,
            #e05c5c ${pendingEnd}% 100%
        )`;
    }

    if (paidPctEl) paidPctEl.textContent = paidPct + "%";
    if (pendingPctEl) pendingPctEl.textContent = pendingPct + "%";
    if (overduePctEl) overduePctEl.textContent = overduePct + "%";
}


/* =====================================================
   RECENT APPOINTMENTS TABLE
   ===================================================== */
function populateRecentAppointments(appointments) {
    const tbody = document.getElementById("recentAppointmentsBody");
    const subtitleEl = document.getElementById("appointmentsTableSubtitle");
    if (!tbody) return;

    if (!appointments || appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-light);">
                    No recent appointments found.
                </td>
            </tr>
        `;
        if (subtitleEl) subtitleEl.textContent = "No scheduled visits";
        return;
    }

    if (subtitleEl) {
        subtitleEl.textContent = `Latest ${appointments.length} scheduled visits`;
    }

    tbody.innerHTML = appointments.map(appt => {
        const statusClass = getStatusClass(appt.status);
        const statusLabel = capitalizeFirst(appt.status);
        const tokenId = `A-${String(appt.appointment_id).padStart(3, "0")}`;

        return `
            <tr>
                <td class="link-text">${tokenId}</td>
                <td>${escapeHtml(appt.patient_name)}</td>
                <td>Dr. ${escapeHtml(appt.doctor_name)}</td>
                <td>${appt.appointment_time || "—"}</td>
                <td>
                    <span class="status ${statusClass}">
                        ● ${statusLabel}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}


/* =====================================================
   RECENT ACTIVITIES FEED
   ===================================================== */
function populateRecentActivities(activities) {
    const listEl = document.getElementById("recentActivitiesList");
    if (!listEl) return;

    if (!activities || activities.length === 0) {
        listEl.innerHTML = `
            <div class="activity-item" style="justify-content: center; color: var(--text-light);">
                No recent activities.
            </div>
        `;
        return;
    }

    listEl.innerHTML = activities.map(act => {
        const timeAgo = getTimeAgo(act.timestamp);
        return `
            <div class="activity-item">
                <div class="activity-icon">
                    ${act.icon || "●"}
                </div>
                <div>
                    <strong>${escapeHtml(act.title)}</strong>
                    <p>${escapeHtml(act.subtitle)} · ${timeAgo}</p>
                </div>
            </div>
        `;
    }).join("");
}


/* =====================================================
   UTILITY HELPERS
   ===================================================== */
function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return Number(num).toLocaleString("en-US");
}

function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}



function getStatusClass(status) {
    if (!status) return "";
    const s = status.toLowerCase();
    const map = {
        "confirmed": "confirmed",
        "scheduled": "confirmed",
        "waiting": "waiting",
        "checked_in": "checked-in",
        "checked-in": "checked-in",
        "in_progress": "checked-in",
        "completed": "completed",
        "cancelled": "cancelled",
        "no_show": "cancelled",
    };
    return map[s] || "";
}

function getTimeAgo(timestamp) {
    if (!timestamp) return "";
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr} hr ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
}

function setLoadingState(loading) {
    const statValues = document.querySelectorAll(
        "#statDoctors, #statReceptionists, #statPatients, " +
        "#statAppointments, #statPendingPayments, #statLabOrders, #statPrescriptions"
    );

    if (loading) {
        statValues.forEach(el => {
            el.dataset.originalText = el.textContent;
            el.textContent = "—";
            el.style.opacity = "0.4";
        });
    } else {
        statValues.forEach(el => {
            el.style.opacity = "1";
        });
    }
}


/* =====================================================
   DASHBOARD BUTTONS AND INTERACTIONS
   ===================================================== */
document.addEventListener("DOMContentLoaded", function () {
    const newAppointmentBtn = document.getElementById("newAppointmentBtn");
    if (newAppointmentBtn) {
        newAppointmentBtn.addEventListener("click", () => {
            window.location.href = "appointments.html";
        });
    }

    const registerPatientBtn = document.getElementById("registerPatientBtn");
    if (registerPatientBtn) {
        registerPatientBtn.addEventListener("click", () => {
            window.location.href = "patients.html";
        });
    }

    const createBillBtn = document.getElementById("createBillBtn");
    if (createBillBtn) {
        createBillBtn.addEventListener("click", () => {
            window.location.href = "billing.html";
        });
    }

    const profileDropdownBtn = document.getElementById("profileDropdownBtn");
    const profileDropdownMenu = document.getElementById("profileDropdownMenu");
    
    if (profileDropdownBtn && profileDropdownMenu) {
        profileDropdownBtn.addEventListener("click", (e) => {
            // Toggle
            if (profileDropdownMenu.style.display === "none") {
                profileDropdownMenu.style.display = "block";
            } else {
                profileDropdownMenu.style.display = "none";
            }
        });
        
        // Hide if click outside
        document.addEventListener("click", (e) => {
            if (!profileDropdownBtn.contains(e.target)) {
                profileDropdownMenu.style.display = "none";
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof removeToken === "function") {
                removeToken();
            } else {
                localStorage.removeItem("access_token");
                localStorage.removeItem("current_user");
            }
            window.location.href = "login.html";
        });
    }
    
    const notifBtn = document.getElementById("notifBtn");
    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            showToast("No new notifications", "info");
        });
    }
});
})();
