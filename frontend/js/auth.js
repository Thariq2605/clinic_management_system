/**
 * CLINIC MANAGEMENT SYSTEM - AUTHENTICATION MODULE
 * Handles Receptionist session login, logout, and route protection.
 */

/**
 * Check if a session or token is active.
 * Redirects if unauthorized or if already logged in on login.html.
 * @param {boolean} requireAuth - True if page requires active receptionist session
 */
function checkAuth(requireAuth = true) {
  const receptionistUser = sessionStorage.getItem("clinic_user");
  const doctorToken = localStorage.getItem("access_token");
  const doctorId = localStorage.getItem("doctor_id");
  const pharmacistUser = localStorage.getItem("user");
  const isLoginPage = window.location.pathname.toLowerCase().endsWith("login.html");

  if (requireAuth && !receptionistUser) {
    if (!isLoginPage) {
      window.location.href = "login.html";
    }
    return false;
  }

  if (!requireAuth && isLoginPage) {
    if (receptionistUser) {
      window.location.href = "dashboard.html";
      return true;
    }
    if (doctorToken && doctorId) {
      window.location.href = "doctor/dashboard.html";
      return true;
    }
    if (pharmacistUser) {
      window.location.href = "pharmacist/index.html";
      return true;
    }
  }

  return true;
}

/**
 * Perform common login request
 * Automatically detects role (receptionist, doctor, pharmacist) and routes accordingly.
 * @param {string} username
 * @param {string} password
 * @param {HTMLElement} submitBtn
 * @param {HTMLElement} errorBox
 */
async function handleLogin(username, password, submitBtn, errorBox) {
  if (errorBox) {
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
  }

  if (!username || !password) {
    if (errorBox) {
      errorBox.textContent = "Please enter both username and password.";
      errorBox.classList.remove("d-none");
    }
    return;
  }

  setButtonLoading(submitBtn, true, "Signing In...");

  try {
    // 1. Obtain fresh CSRF token
    await fetchCsrfToken("http://127.0.0.1:8000/api/csrf/");

    // 2. Perform Common Login POST with credentials: "include" (no role sent)
    const response = await apiPost("http://127.0.0.1:8000/api/login/", {
      username: username,
      password: password,
    });

    if (!response || !response.role) {
      throw new Error(response?.error || "Login response format unrecognized.");
    }

    const role = String(response.role).toLowerCase();

    // Clear any prior credentials from other roles to prevent cross-role contamination
    sessionStorage.removeItem("clinic_user");
    sessionStorage.removeItem("clinic_csrf_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("doctor_id");
    localStorage.removeItem("doctor_name");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("current_appointment_id");
    localStorage.removeItem("user");

    // 3. Role-specific session/token storage and redirection
    if (role === "receptionist") {
      const userData = {
        user_id: response.user_id,
        receptionist_id: response.receptionist_id,
        name: response.name || "Receptionist",
      };
      sessionStorage.setItem("clinic_user", JSON.stringify(userData));

      showToast("Receptionist login successful! Redirecting...", "success");

      setTimeout(() => {
        window.location.href = response.redirect || "dashboard.html";
      }, 400);

    } else if (role === "doctor") {
      // Store exact keys required by doctor dashboard and doctor API clients
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("refresh_token", response.refresh);
      localStorage.setItem("doctor_id", String(response.doctor_id));
      localStorage.setItem("doctor_name", response.doctor_name || "");
      localStorage.setItem("user_id", String(response.user_id));
      localStorage.setItem("username", response.username || username);

      showToast("Doctor login successful! Redirecting...", "success");

      setTimeout(() => {
        window.location.href = response.redirect || "doctor/dashboard.html";
      }, 400);

    } else if (role === "pharmacist") {
      // Store exact structure expected by pharmacist app.js
      const pharmacistData = {
        user_id: response.user_id,
        username: response.username || username,
        role: "Pharmacist",
        name: response.name || response.username || "Pharmacist",
      };
      localStorage.setItem("user", JSON.stringify(pharmacistData));

      showToast("Pharmacist login successful! Redirecting...", "success");

      setTimeout(() => {
        window.location.href = response.redirect || "pharmacist/index.html";
      }, 400);

    } else {
      throw new Error(`Unsupported role: ${response.role}`);
    }

  } catch (error) {
    console.error("Login failed:", error);
    let displayMessage = error.message;

    if (error.status === 401) {
      displayMessage = "Invalid username or password.";
    } else if (error.status === 403) {
      displayMessage =
        (error.data && error.data.error) ||
        error.message ||
        "This account is not authorized to access the clinic system.";
    } else if (error.data && error.data.error) {
      displayMessage = error.data.error;
    }

    if (errorBox) {
      errorBox.textContent = displayMessage;
      errorBox.classList.remove("d-none");
    } else {
      showToast(displayMessage, "danger");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Perform logout request
 */
async function handleLogout() {
  showConfirmModal({
    title: "Sign Out",
    message: "Are you sure you want to end your current receptionist session?",
    confirmBtnText: "Sign Out",
    confirmBtnClass: "btn-danger",
    onConfirm: async () => {
      try {
        await apiPost("/logout/", {});
      } catch (err) {
        console.warn("Server logout notification failed:", err);
      } finally {
        sessionStorage.removeItem("clinic_user");
        sessionStorage.removeItem("clinic_csrf_token");
        cachedCsrfToken = null;
        window.location.href = "login.html";
      }
    },
  });
}

// Bind global logout triggers
document.addEventListener("DOMContentLoaded", () => {
  const logoutButtons = document.querySelectorAll(".btn-logout-trigger");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
});
