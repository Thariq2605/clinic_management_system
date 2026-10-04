/* =========================================================
   CLINIXONE - CENTRALIZED API CLIENT
   ========================================================= */

const API_BASE_URL = window.API_BASE_URL || "http://127.0.0.1:8000";

function getToken() {
    return localStorage.getItem("access_token");
}

function setToken(token) {
    if (token) {
        localStorage.setItem("access_token", token);
    } else {
        localStorage.removeItem("access_token");
    }
}

function removeToken() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_user");
}

/* Toast notifications */
function showToast(message, type = "info") {
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "ℹ";
    if (type === "success") icon = "✓";
    else if (type === "error") icon = "⚠";
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

/* Modal Helpers */
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
        // Reset any form inside
        const form = modal.querySelector("form");
        if (form) form.reset();
        // Clear errors
        modal.querySelectorAll(".form-error").forEach(el => {
            el.textContent = "";
            el.classList.remove("active");
        });
    }
}

/* Centralized API Request */
async function apiRequest(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Token ${token}`;
    }

    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // 401 Unauthorized: token expired or missing
        if (response.status === 401) {
            removeToken();
            const currentPath = window.location.pathname;
            if (!currentPath.includes("login.html")) {
                showToast("Session expired. Please log in again.", "warning");
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1000);
            }
            throw new Error("Unauthorized");
        }

        // 403 Forbidden
        if (response.status === 403) {
            showToast("Access denied: Administrator permissions required.", "error");
            throw new Error("Forbidden");
        }

        // 204 No Content (DELETE success)
        if (response.status === 204) {
            return { success: true };
        }

        const data = await response.json().catch(() => ({}));

        // Not OK responses
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

/* Format backend validation error dictionaries */
function formatBackendErrors(data) {
    if (!data) return "An unexpected error occurred.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.non_field_errors) return data.non_field_errors.join(", ");

    const messages = [];
    for (const [key, value] of Object.entries(data)) {
        const fieldName = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        if (Array.isArray(value)) {
            messages.push(`${fieldName}: ${value.join(", ")}`);
        } else if (typeof value === "object") {
            messages.push(`${fieldName}: ${formatBackendErrors(value)}`);
        } else {
            messages.push(`${fieldName}: ${value}`);
        }
    }
    return messages.length > 0 ? messages.join(" | ") : "Validation failed.";
}

/* Convenience HTTP methods */
const api = {
    get: (endpoint, params = {}) => {
        let qs = "";
        const filteredParams = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "");
        if (filteredParams.length > 0) {
            qs = "?" + new URLSearchParams(filteredParams).toString();
        }
        return apiRequest(`${endpoint}${qs}`, { method: "GET" });
    },

    post: (endpoint, data) => apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(data)
    }),

    put: (endpoint, data) => apiRequest(endpoint, {
        method: "PUT",
        body: JSON.stringify(data)
    }),

    patch: (endpoint, data) => apiRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify(data)
    }),

    delete: (endpoint) => apiRequest(endpoint, {
        method: "DELETE"
    })
};
