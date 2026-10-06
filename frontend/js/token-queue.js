/**
 * MEDICARE CLINIC MANAGEMENT SYSTEM - PATIENT TOKEN QUEUE
 * Manages today's consultation patient queue:
 * - Now Serving active consultation
 * - Waiting Queue list and next token in line
 * - Completed Today list
 * - Call Next and Complete actions
 * - Configurable auto-refresh polling
 */

// Configuration
const QUEUE_AUTO_REFRESH_INTERVAL_MS = 30000; // 30 seconds auto-refresh

let currentServingAppointmentId = null;
let queueRefreshTimer = null;
let isCallingNext = false;
let isCompleting = false;

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth(true)) return;

  initQueuePage();
});

/**
 * Initialize Queue Page and listeners
 */
async function initQueuePage() {
  loadDoctorFilterOptions();
  loadTokenQueue();

  // Refresh button
  const refreshBtn = document.getElementById("btn-refresh-queue");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadTokenQueue();
    });
  }

  // Doctor filter change
  const doctorSelect = document.getElementById("queue-doctor-filter");
  if (doctorSelect) {
    doctorSelect.addEventListener("change", () => {
      loadTokenQueue();
    });
  }

  // Call Next buttons
  const topCallBtn = document.getElementById("btn-top-call-next");
  if (topCallBtn) {
    topCallBtn.addEventListener("click", () => handleCallNext());
  }

  const emptyCallBtn = document.getElementById("btn-empty-call-next");
  if (emptyCallBtn) {
    emptyCallBtn.addEventListener("click", () => handleCallNext());
  }

  const servingCallBtn = document.getElementById("btn-serving-call-next");
  if (servingCallBtn) {
    servingCallBtn.addEventListener("click", () => handleCallNext());
  }

  // Complete button
  const completeBtn = document.getElementById("btn-serving-complete");
  if (completeBtn) {
    completeBtn.addEventListener("click", () => handleCompleteCurrent());
  }

  // Start auto-refresh polling
  startQueuePolling();
}

/**
 * Start queue auto-refresh polling
 */
function startQueuePolling() {
  if (queueRefreshTimer) clearInterval(queueRefreshTimer);
  queueRefreshTimer = setInterval(() => {
    // Only refresh if tab is active to avoid unnecessary server load
    if (!document.hidden) {
      loadTokenQueue(true); // silent refresh
    }
  }, QUEUE_AUTO_REFRESH_INTERVAL_MS);
}

/**
 * Load Doctors into filter dropdown
 */
async function loadDoctorFilterOptions() {
  const select = document.getElementById("queue-doctor-filter");
  if (!select) return;

  try {
    const doctors = await apiGet("/doctors/");
    if (Array.isArray(doctors)) {
      doctors.forEach((doc) => {
        const opt = document.createElement("option");
        opt.value = doc.doctor_id;
        opt.textContent = `${doc.doctor_name || doc.staff_name || "Dr. #" + doc.doctor_id} (${doc.department_name || "General"})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn("Failed to load doctor options for queue filter:", err);
  }
}

/**
 * Fetch and render the entire token queue state for today
 */
async function loadTokenQueue(isSilent = false) {
  const refreshBtn = document.getElementById("btn-refresh-queue");
  if (!isSilent && refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Refreshing...`;
  }

  const doctorId = document.getElementById("queue-doctor-filter")?.value || "";

  try {
    let url = "/token-queue/today/";
    if (doctorId) url += `?doctor=${encodeURIComponent(doctorId)}`;

    const data = await apiGet(url);

    // Update Date Header
    const dateEl = document.getElementById("queue-today-date");
    if (dateEl) {
      dateEl.textContent = formatDate(data.date || new Date().toISOString().split("T")[0]);
    }

    // Update Summary Metrics
    const waitingMetric = document.getElementById("metric-waiting-count");
    const waitingBadge = document.getElementById("badge-waiting-count");
    const nextTokenMetric = document.getElementById("metric-next-token");
    const totalTodayMetric = document.getElementById("metric-total-today");
    const completedBadge = document.getElementById("badge-completed-count");

    if (waitingMetric) waitingMetric.textContent = data.waiting_count || 0;
    if (waitingBadge) waitingBadge.textContent = data.waiting_count || 0;
    if (nextTokenMetric) nextTokenMetric.textContent = data.next_token ? `#${data.next_token}` : "--";
    if (totalTodayMetric) totalTodayMetric.textContent = data.total_today || 0;
    if (completedBadge) completedBadge.textContent = data.completed_today?.length || 0;

    // Render Section 1: Now Serving
    renderNowServing(data.now_serving);

    // Render Section 3: Waiting Queue
    renderWaitingQueue(data.waiting_queue || []);

    // Render Section 4: Completed Today
    renderCompletedToday(data.completed_today || []);
  } catch (error) {
    console.error("Token queue fetch error:", error);
    if (!isSilent) {
      showToast(error.message || "Failed to load token queue.", "danger");
    }
  } finally {
    if (!isSilent && refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = `<i class="bi bi-arrow-clockwise me-1"></i> Refresh`;
    }
  }
}

/**
 * Render Section 1: Now Serving Card
 */
function renderNowServing(servingData) {
  const activeView = document.getElementById("serving-active-view");
  const emptyView = document.getElementById("serving-empty-view");

  if (!servingData) {
    currentServingAppointmentId = null;
    if (activeView) activeView.classList.add("d-none");
    if (emptyView) emptyView.classList.remove("d-none");
    return;
  }

  currentServingAppointmentId = servingData.appointment_id;

  const tokenEl = document.getElementById("serving-token-number");
  const nameEl = document.getElementById("serving-patient-name");
  const metaEl = document.getElementById("serving-patient-meta");
  const docNameEl = document.getElementById("serving-doctor-name");
  const docDeptEl = document.getElementById("serving-doctor-dept");
  const timeEl = document.getElementById("serving-time");
  const statusEl = document.getElementById("serving-queue-status");

  if (tokenEl) tokenEl.textContent = servingData.token_display || servingData.token_number;
  if (nameEl) nameEl.textContent = servingData.patient_name || "--";
  if (metaEl) {
    metaEl.textContent = `Patient ID: #${servingData.patient_id} • Gender: ${servingData.patient_gender || "N/A"}`;
  }
  if (docNameEl) docNameEl.textContent = `Dr. ${servingData.doctor_name || "--"}`;
  if (docDeptEl) docDeptEl.textContent = `(${servingData.department_name || "General"})`;
  if (timeEl) timeEl.textContent = formatTime(servingData.appointment_time);
  if (statusEl) statusEl.textContent = servingData.queue_status || "Serving";

  if (activeView) activeView.classList.remove("d-none");
  if (emptyView) emptyView.classList.add("d-none");
}

/**
 * Render Section 3: Waiting Queue Table
 */
function renderWaitingQueue(queueItems) {
  const tbody = document.getElementById("waiting-queue-tbody");
  const emptyState = document.getElementById("waiting-queue-empty");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(queueItems) || queueItems.length === 0) {
    if (emptyState) emptyState.classList.remove("d-none");
    return;
  }

  if (emptyState) emptyState.classList.add("d-none");

  queueItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="token-badge-mini font-monospace">#${escapeHtml(item.token_display || item.token_number)}</span>
      </td>
      <td>
        <div class="fw-bold text-dark">${escapeHtml(item.patient_name || "--")}</div>
        <small class="text-muted">ID: #${escapeHtml(item.patient_id || "-")} • ${escapeHtml(item.patient_gender || "")}</small>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(item.doctor_name || "--")}</div>
        <small class="text-muted">${escapeHtml(item.department_name || "--")}</small>
      </td>
      <td>
        <span class="fw-semibold text-dark"><i class="bi bi-clock me-1 text-muted"></i>${formatTime(item.appointment_time)}</span>
      </td>
      <td>
        <span class="badge-status badge-scheduled"><i class="bi bi-hourglass-split"></i> Waiting</span>
        ${(item.payment_status || "").toLowerCase() === "paid" 
          ? `<span class="badge bg-success-subtle text-success border border-success-subtle ms-1" style="font-size:0.75rem;"><i class="bi bi-check-circle"></i> Paid</span>`
          : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle ms-1" style="font-size:0.75rem;"><i class="bi bi-clock-history"></i> Payment Pending</span>`
        }
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary btn-call-specific" data-id="${item.appointment_id}" data-token="${item.token_number}" title="Call this patient">
          <i class="bi bi-megaphone me-1"></i> Call
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-call-specific").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleCallNext();
    });
  });
}

/**
 * Render Section 4: Completed Today Table
 */
function renderCompletedToday(completedItems) {
  const tbody = document.getElementById("completed-today-tbody");
  const emptyState = document.getElementById("completed-today-empty");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(completedItems) || completedItems.length === 0) {
    if (emptyState) emptyState.classList.remove("d-none");
    return;
  }

  if (emptyState) emptyState.classList.add("d-none");

  completedItems.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="token-badge-mini token-badge-success font-monospace">#${escapeHtml(item.token_display || item.token_number)}</span>
      </td>
      <td>
        <div class="fw-bold text-dark">${escapeHtml(item.patient_name || "--")}</div>
        <small class="text-muted">ID: #${escapeHtml(item.patient_id || "-")}</small>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(item.doctor_name || "--")}</div>
        <small class="text-muted">${escapeHtml(item.department_name || "--")}</small>
      </td>
      <td>
        <span class="text-muted"><i class="bi bi-check2 text-success me-1"></i>${formatTime(item.appointment_time)}</span>
      </td>
      <td>
        <span class="badge-status badge-completed"><i class="bi bi-check2-all"></i> Completed</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Handle "Call Next" Button Click
 * Validates active serving state, calls next waiting token from backend,
 * and updates Now Serving section.
 */
async function handleCallNext() {
  if (isCallingNext) return;

  const doctorId = document.getElementById("queue-doctor-filter")?.value || null;

  isCallingNext = true;

  try {
    const payload = {};
    if (doctorId) payload.doctor_id = parseInt(doctorId, 10);

    const response = await apiPost("/token-queue/call-next/", payload);

    if (response.now_serving) {
      showToast(
        `Now Serving Token #${response.now_serving.token_number} - ${response.now_serving.patient_name} with Dr. ${response.now_serving.doctor_name}`,
        "success"
      );
      loadTokenQueue();
    } else {
      showToast(response.message || "No patients waiting.", "info");
      loadTokenQueue();
    }
  } catch (error) {
    console.error("Call next error:", error);
    showToast(error.message || "Unable to call next patient.", "danger");
  } finally {
    isCallingNext = false;
  }
}

/**
 * Handle "Complete" Button Click
 * Marks currently serving consultation as completed, moves it to Completed Today,
 * and clears Now Serving.
 */
async function handleCompleteCurrent() {
  if (!currentServingAppointmentId) {
    showToast("No patient is currently being served.", "warning");
    return;
  }

  if (isCompleting) return;
  isCompleting = true;

  const completeBtn = document.getElementById("btn-serving-complete");
  if (completeBtn) setButtonLoading(completeBtn, true, "Completing...");

  try {
    const response = await apiPost(`/token-queue/${currentServingAppointmentId}/complete/`, {});

    showToast(
      response.message || "Consultation marked as completed successfully!",
      "success"
    );

    currentServingAppointmentId = null;
    loadTokenQueue();
  } catch (error) {
    console.error("Complete token error:", error);
    showToast(error.message || "Failed to complete consultation.", "danger");
  } finally {
    isCompleting = false;
    if (completeBtn) setButtonLoading(completeBtn, false);
  }
}
