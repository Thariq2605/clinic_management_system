/**
 * CLINIC MANAGEMENT SYSTEM - DASHBOARD MODULE
 * Fetches appointments dynamically using existing appointments API,
 * calculates statistics on the client-side, and renders today's queue.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

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
    tbody.appendChild(tr);
  });
}
