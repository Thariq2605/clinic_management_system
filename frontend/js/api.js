/**
 * CLINIC MANAGEMENT SYSTEM - UNIFIED API CLIENT MODULE
 * Supports:
 * 1. Receptionist session authentication (Django session cookies + CSRF tokens)
 *    via apiGet, apiPost, apiPut, apiPatch, apiDelete
 * 2. Admin Token authentication (DRF TokenAuthentication)
 *    via api.get, api.post, api.put, api.patch, api.delete
 */

const API_BASE = "http://127.0.0.1:8000/api/receptionist";
const API_BASE_URL = window.API_BASE_URL || "http://127.0.0.1:8000";
const COMMON_API_BASE = "http://127.0.0.1:8000/api";

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let cachedCsrfToken = null;

/**
 * Fetch a fresh CSRF token from Django
 * GET /api/csrf/ (with fallback to /api/receptionist/csrf/)
 */
async function fetchCsrfToken(customUrl = null) {
  const targetUrl = customUrl || `${COMMON_API_BASE}/csrf/`;
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (!customUrl) {
        return await fetchCsrfToken(`${API_BASE}/csrf/`);
      }
      throw new Error(`Failed to fetch CSRF token (${response.status})`);
    }

    const data = await response.json();
    if (data && data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
      sessionStorage.setItem("clinic_csrf_token", cachedCsrfToken);
      return cachedCsrfToken;
    }
    throw new Error("CSRF token missing in response");
  } catch (err) {
    console.error("CSRF Fetch Error:", err);
    throw err;
  }
}

/* =========================================================
   ADMIN TOKEN MANAGEMENT
   ========================================================= */

function getToken() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token");
}

function setToken(token) {
  if (token) {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("access_token", token);
  } else {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("access_token");
  }
}

function removeToken() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("current_user");
}

/* =========================================================
   UI HELPERS (TOAST, MODALS, ERROR FORMATTING)
   ========================================================= */

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = "1100";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const adminType = (type === "danger") ? "error" : type;
  toast.className = `toast ${adminType} show`;

  let icon = "ℹ";
  if (type === "success") icon = "✓";
  else if (type === "error" || type === "danger") icon = "⚠";
  else if (type === "warning") icon = "!";

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    const firstInput = modal.querySelector("input, select, textarea");
    if (firstInput) firstInput.focus();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    const form = modal.querySelector("form");
    if (form) form.reset();
    modal.querySelectorAll(".form-error").forEach((el) => {
      el.textContent = "";
      el.classList.remove("active");
    });
  }
}

function formatBackendErrors(data) {
  if (!data) return "An unexpected error occurred.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.non_field_errors) return data.non_field_errors.join(", ");

  const messages = [];
  for (const [key, value] of Object.entries(data)) {
    const fieldName = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(value)) {
      messages.push(`${fieldName}: ${value.join(", ")}`);
    } else if (typeof value === "object" && value !== null) {
      messages.push(`${fieldName}: ${formatBackendErrors(value)}`);
    } else {
      messages.push(`${fieldName}: ${value}`);
    }
  }
  return messages.length > 0 ? messages.join(" | ") : "Validation failed.";
}

function extractErrorMessage(data, status) {
  if (!data) return `Request failed with status code ${status}.`;
  if (typeof data === "string") return data;
  if (data.error && typeof data.error === "string") return data.error;
  if (data.detail && typeof data.detail === "string") return data.detail;
  if (data.message && typeof data.message === "string") return data.message;

  const fieldErrors = [];
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      fieldErrors.push(`${key}: ${val.join(", ")}`);
    } else if (typeof val === "string") {
      fieldErrors.push(`${key}: ${val}`);
    } else if (typeof val === "object" && val !== null) {
      fieldErrors.push(`${key}: ${JSON.stringify(val)}`);
    }
  }

  if (fieldErrors.length > 0) {
    return fieldErrors.join(" | ");
  }

  return `Request failed with status code ${status}.`;
}

/* =========================================================
   CORE API REQUEST ENGINES
   ========================================================= */

async function adminApiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      removeToken();
      const currentPath = window.location.pathname;
      if (!currentPath.includes("login.html")) {
        showToast("Session expired. Please log in again.", "warning");
        setTimeout(() => {
          const loginTarget = window.location.pathname.includes("/pages/") ? "../login.html" : "login.html";
          window.location.href = loginTarget;
        }, 1000);
      }
      throw new Error("Unauthorized");
    }

    if (response.status === 403) {
      showToast("Access denied: Administrator permissions required.", "error");
      throw new Error("Forbidden");
    }

    if (response.status === 204) {
      return { success: true };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = formatBackendErrors(data) || `Request failed (${response.status})`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.message !== "Unauthorized" && error.message !== "Forbidden") {
      console.error("API Request Error:", error);
    }
    throw error;
  }
}

async function receptionistApiRequest(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = {
    "Accept": "application/json",
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    let csrfToken = cachedCsrfToken || sessionStorage.getItem("clinic_csrf_token");
    if (!csrfToken) {
      try {
        csrfToken = await fetchCsrfToken();
      } catch (e) {
        console.warn("Could not retrieve fresh CSRF token:", e);
      }
    }
    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }
  }

  const fetchOptions = {
    ...options,
    method,
    headers,
    credentials: "include",
  };

  try {
    const response = await fetch(url, fetchOptions);

    let responseData = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      const text = await response.text();
      responseData = text ? { detail: text } : null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        const currentPath = window.location.pathname.toLowerCase();
        const onLoginPage = currentPath.endsWith("login.html");

        if (!onLoginPage) {
          sessionStorage.removeItem("clinic_user");
          sessionStorage.removeItem("clinic_csrf_token");
          cachedCsrfToken = null;
          const loginTarget = window.location.pathname.includes("/pages/") ? "../login.html" : "login.html";
          window.location.href = `${loginTarget}?expired=1`;
        }
        const errMsg = extractErrorMessage(responseData, 401) || "Invalid username or password.";
        throw new ApiError(errMsg, 401, responseData);
      }

      if (response.status === 403) {
        let msg = extractErrorMessage(responseData, 403) || "Access denied.";
        throw new ApiError(msg, 403, responseData);
      }

      if (response.status === 404) {
        throw new ApiError("Requested resource was not found.", 404, responseData);
      }

      const errMsg = extractErrorMessage(responseData, response.status) || `Request failed (${response.status})`;
      throw new ApiError(errMsg, response.status, responseData);
    }

    return responseData;
  } catch (error) {
    if (error.name !== "ApiError") {
      throw new ApiError(error.message || "Network request failed", 0, null);
    }
    throw error;
  }
}

async function apiRequest(endpoint, options = {}) {
  const ep = String(endpoint || "");
  if (ep.startsWith("/api/admin") || ep.includes("/api/admin") || options.isAdmin) {
    return adminApiRequest(endpoint, options);
  }
  return receptionistApiRequest(endpoint, options);
}

/* =========================================================
   RECEPTIONIST HTTP SHORTCUTS
   ========================================================= */

function apiGet(url, params = {}) {
  let queryString = "";
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        searchParams.append(key, value);
      }
    }
    const qs = searchParams.toString();
    if (qs) queryString = `?${qs}`;
  }
  return apiRequest(`${url}${queryString}`, { method: "GET" });
}

function apiPost(url, data) {
  return apiRequest(url, { method: "POST", body: data });
}

function apiPatch(url, data) {
  return apiRequest(url, { method: "PATCH", body: data });
}

function apiPut(url, data) {
  return apiRequest(url, { method: "PUT", body: data });
}

function apiDelete(url) {
  return apiRequest(url, { method: "DELETE" });
}

/* =========================================================
   ADMIN HTTP SHORTCUTS
   ========================================================= */

const api = {
  get: (endpoint, params = {}) => {
    let qs = "";
    const filteredParams = Object.entries(params).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ""
    );
    if (filteredParams.length > 0) {
      qs = "?" + new URLSearchParams(filteredParams).toString();
    }
    return adminApiRequest(`${endpoint}${qs}`, { method: "GET" });
  },

  post: (endpoint, data) =>
    adminApiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: (endpoint, data) =>
    adminApiRequest(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  patch: (endpoint, data) =>
    adminApiRequest(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (endpoint) =>
    adminApiRequest(endpoint, {
      method: "DELETE",
    }),
};
