/**
 * CLINIC MANAGEMENT SYSTEM - COMMON UI UTILITIES
 * Toast notifications, sidebar controller, modals, and formatters.
 */

// Global Toast Container Initialization
function initToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container position-fixed top-0 end-0 p-3";
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a Bootstrap Toast notification
 * @param {string} message - Message text
 * @param {'success'|'danger'|'warning'|'info'} type - Toast type
 * @param {string} [title] - Optional toast header
 */
function showToast(message, type = "success", title = "") {
  const container = initToastContainer();

  const typeConfig = {
    success: { icon: "bi-check-circle-fill", header: "Success", bg: "text-bg-success" },
    danger: { icon: "bi-exclamation-triangle-fill", header: "Error", bg: "text-bg-danger" },
    warning: { icon: "bi-exclamation-circle-fill", header: "Warning", bg: "text-bg-warning" },
    info: { icon: "bi-info-circle-fill", header: "Information", bg: "text-bg-primary" },
  };

  const config = typeConfig[type] || typeConfig.info;
  const headerText = title || config.header;

  const toastEl = document.createElement("div");
  toastEl.className = "toast border-0 shadow";
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  toastEl.innerHTML = `
    <div class="toast-header ${config.bg} text-white">
      <i class="bi ${config.icon} me-2"></i>
      <strong class="me-auto">${escapeHtml(headerText)}</strong>
      <small class="text-white-50">Just now</small>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body bg-white text-dark">
      ${escapeHtml(message)}
    </div>
  `;

  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 4500 });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => {
    toastEl.remove();
  });
}

/**
 * HTML Escape Helper
 */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Set loading state on a button
 */
function setButtonLoading(button, isLoading, text = "Loading...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>${escapeHtml(text)}</span>
    `;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }
}

/**
 * Reusable Confirmation Modal
 */
let confirmModalInstance = null;
function showConfirmModal({ title = "Confirm Action", message, confirmBtnText = "Confirm", confirmBtnClass = "btn-danger", onConfirm }) {
  let modalEl = document.getElementById("globalConfirmModal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "globalConfirmModal";
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="globalConfirmModalTitle">Confirm</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="globalConfirmModalBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn" id="globalConfirmModalActionBtn">Confirm</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  document.getElementById("globalConfirmModalTitle").textContent = title;
  document.getElementById("globalConfirmModalBody").innerHTML = message;
  const actionBtn = document.getElementById("globalConfirmModalActionBtn");
  actionBtn.textContent = confirmBtnText;
  actionBtn.className = `btn ${confirmBtnClass}`;

  // Clean old listeners
  const newActionBtn = actionBtn.cloneNode(true);
  actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

  confirmModalInstance = new bootstrap.Modal(modalEl);

  newActionBtn.addEventListener("click", async () => {
    if (onConfirm) {
      setButtonLoading(newActionBtn, true, "Processing...");
      try {
        await onConfirm();
        confirmModalInstance.hide();
      } catch (err) {
        showToast(err.message || "Action failed.", "danger");
      } finally {
        setButtonLoading(newActionBtn, false);
      }
    } else {
      confirmModalInstance.hide();
    }
  });

  confirmModalInstance.show();
}

/**
 * Format ISO date string to friendly readable format (e.g. 15 Oct 2026)
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateString;
  }
}

/**
 * Format time string (e.g. 14:30:00 -> 02:30 PM)
 */
function formatTime(timeString) {
  if (!timeString) return "N/A";
  try {
    const parts = timeString.split(":");
    if (parts.length >= 2) {
      const d = new Date();
      d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10));
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    return timeString;
  } catch {
    return timeString;
  }
}

/**
 * Format currency amount with 2 decimal places
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === "") return "₹0.00";
  const num = parseFloat(amount);
  if (isNaN(num)) return "₹0.00";
  return `₹${num.toFixed(2)}`;
}

/**
 * Badge for Appointment Status
 */
function getStatusBadge(status) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "scheduled":
      return `<span class="badge-status badge-scheduled"><i class="bi bi-clock"></i> Scheduled</span>`;
    case "confirmed":
      return `<span class="badge-status badge-confirmed"><i class="bi bi-check-circle"></i> Confirmed</span>`;
    case "completed":
      return `<span class="badge-status badge-completed"><i class="bi bi-check2-all"></i> Completed</span>`;
    case "cancelled":
      return `<span class="badge-status badge-cancelled"><i class="bi bi-x-circle"></i> Cancelled</span>`;
    default:
      return `<span class="badge-status badge-pending">${escapeHtml(status || "Unknown")}</span>`;
  }
}

/**
 * Badge for Payment Status
 */
function getPaymentStatusBadge(status) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "paid":
      return `<span class="badge-status badge-paid"><i class="bi bi-cash-coin"></i> Paid</span>`;
    case "partial":
      return `<span class="badge-status badge-partial"><i class="bi bi-pie-chart"></i> Partial</span>`;
    case "pending":
    case "unpaid":
      return `<span class="badge-status badge-pending"><i class="bi bi-hourglass-split"></i> Pending</span>`;
    default:
      return `<span class="badge-status badge-pending">${escapeHtml(status || "Pending")}</span>`;
  }
}

/**
 * Badge for Active/Inactive Status
 */
function getActiveStatusBadge(isActive) {
  return isActive
    ? `<span class="badge-status badge-active"><i class="bi bi-check-circle-fill"></i> Active</span>`
    : `<span class="badge-status badge-inactive"><i class="bi bi-dash-circle-fill"></i> Inactive</span>`;
}

/**
 * Initialize Layout Components (Sidebar toggle, active links, user info)
 */
function setupLayout() {
  // Ensure sidebar brand displays MEDICARE logo consistently
  const sidebarBrand = document.querySelector("#sidebar .sidebar-brand");
  if (sidebarBrand && (!sidebarBrand.querySelector("img") || !sidebarBrand.querySelector("img").src.includes("logo-white.svg"))) {
    sidebarBrand.innerHTML = `<img src="assets/logo-white.svg" alt="MEDICARE" height="38" width="182" style="height: 38px; width: auto; max-width: 100%; display: block;">`;
  }

  // Populate logged-in user in navbar
  const storedUser = sessionStorage.getItem("clinic_user");
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      const nameEl = document.getElementById("navbar-user-name");
      const avatarEl = document.getElementById("navbar-user-avatar");
      if (nameEl) nameEl.textContent = user.name || "Receptionist";
      if (avatarEl) {
        const initial = (user.name || "R").charAt(0).toUpperCase();
        avatarEl.textContent = initial;
      }
    } catch {
      // Ignored
    }
  }

  // Unify user role subtitle in navbar
  const userRoleEls = document.querySelectorAll(".top-navbar .user-badge small");
  userRoleEls.forEach((el) => {
    el.textContent = "Reception Desk";
  });

  // Highlight active sidebar navigation link (including detail views)
  const currentPath = window.location.pathname.toLowerCase().split("/").pop() || "dashboard.html";
  let targetNav = currentPath;
  if (currentPath === "patient-details.html") targetNav = "patients.html";
  if (currentPath === "appointment-details.html") targetNav = "appointments.html";

  const navLinks = document.querySelectorAll("#sidebar .nav-link");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && (href === targetNav || (targetNav === "" && href === "dashboard.html"))) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Mobile sidebar toggle
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("show");
      if (backdrop) backdrop.classList.toggle("show");
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("show");
      backdrop.classList.remove("show");
    });
  }
}

// Run layout setup on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  setupLayout();
});
