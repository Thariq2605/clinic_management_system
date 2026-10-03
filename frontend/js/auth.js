/**
 * CLINIC MANAGEMENT SYSTEM - AUTHENTICATION MODULE
 * Handles Receptionist session login, logout, and route protection.
 */

/**
 * Check if the receptionist session is active.
 * Redirects if unauthorized.
 * @param {boolean} requireAuth - True if page requires active session
 */
function checkAuth(requireAuth = true) {
  const user = sessionStorage.getItem("clinic_user");
  const isLoginPage = window.location.pathname.toLowerCase().endsWith("login.html");

  if (requireAuth && !user) {
    if (!isLoginPage) {
      window.location.href = "login.html";
    }
    return false;
  }

  if (!requireAuth && user && isLoginPage) {
    window.location.href = "dashboard.html";
    return true;
  }

  return true;
}

/**
 * Perform login request
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
    // 1. Obtain CSRF token
    await fetchCsrfToken();

    // 2. Perform Login POST with credentials: "include"
    const response = await apiPost("/login/", { username, password });

    if (response && response.receptionist_id) {
      // 3. Store user metadata only (never save password!)
      const userData = {
        user_id: response.user_id,
        receptionist_id: response.receptionist_id,
        name: response.name || "Receptionist",
      };
      sessionStorage.setItem("clinic_user", JSON.stringify(userData));

      showToast("Receptionist login successful! Redirecting...", "success");

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);
    } else {
      throw new Error(response.error || "Login response format unrecognized.");
    }
  } catch (error) {
    console.error("Login failed:", error);
    let displayMessage = error.message;

    if (error.status === 401) {
      displayMessage = "Invalid username or password.";
    } else if (error.status === 403) {
      displayMessage = error.message || "This account is not authorized as a receptionist.";
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
