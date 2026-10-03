/**
 * CLINIC MANAGEMENT SYSTEM - API CLIENT MODULE
 * Handles fetch() requests with session credentials, automatic CSRF token retrieval,
 * JSON serialization, and centralized error handling.
 */

const API_BASE = "http://127.0.0.1:8000/api/receptionist";
const API_BASE_URL = API_BASE;

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
 * GET /api/receptionist/csrf/
 */
async function fetchCsrfToken() {
  try {
    const response = await fetch(`${API_BASE}/csrf/`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
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

/**
 * Central API Request Engine
 * @param {string} endpoint - Path relative to API_BASE (e.g. '/patients/')
 * @param {object} options - fetch options (method, headers, body, etc.)
 */
async function apiRequest(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = {
    "Accept": "application/json",
    ...(options.headers || {}),
  };

  // Attach Content-Type if body is an object and not FormData
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  // Before every state-changing request (POST, PUT, PATCH, DELETE),
  // obtain the CSRF token and set X-CSRFToken header with the raw token value.
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
      headers["X-CSRFToken"] = csrfToken; // only the actual token as header value!
    }
  }

  const fetchOptions = {
    ...options,
    method,
    headers,
    credentials: "include", // Required for Django session cookies!
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
      // 401 Unauthorized: session expired
      if (response.status === 401) {
        sessionStorage.removeItem("clinic_user");
        sessionStorage.removeItem("clinic_csrf_token");
        cachedCsrfToken = null;

        const currentPath = window.location.pathname.toLowerCase();
        if (!currentPath.endsWith("login.html")) {
          window.location.href = "login.html?expired=1";
        }
        throw new ApiError("Session expired. Please login again.", 401, responseData);
      }

      // 403 Forbidden
      if (response.status === 403) {
        let msg = extractErrorMessage(responseData, 403) || "Access denied.";
        throw new ApiError(msg, 403, responseData);
      }

      // 404 Not Found
      if (response.status === 404) {
        throw new ApiError("Requested resource was not found.", 404, responseData);
      }

      // 409 Conflict & 400 Bad Request & other errors
      let errorMsg = extractErrorMessage(responseData, response.status);
      throw new ApiError(errorMsg, response.status, responseData);
    }

    return responseData;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      "Unable to connect to clinic server. Please ensure the Django backend is running at http://127.0.0.1:8000.",
      0,
      null
    );
  }
}

/**
 * Standard CRUD API Helper functions
 */
function apiGet(url) {
  return apiRequest(url, { method: "GET" });
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

/**
 * Extracts friendly error text from various DRF error formats
 */
function extractErrorMessage(data, status) {
  if (!data) return `Request failed with status code ${status}.`;

  if (typeof data === "string") return data;
  if (data.error && typeof data.error === "string") return data.error;
  if (data.detail && typeof data.detail === "string") return data.detail;
  if (data.message && typeof data.message === "string") return data.message;

  // Field validation dictionary: { field: ["msg"], ... }
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
