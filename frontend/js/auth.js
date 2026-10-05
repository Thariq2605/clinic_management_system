/**
 * CLINIC MANAGEMENT SYSTEM - UNIFIED AUTHENTICATION MODULE
 * Supports:
 * 1. Receptionist session login, session validation, route protection, and logout
 * 2. Doctor JWT authentication state
 * 3. Pharmacist user authentication state
 * 4. Administrator token authentication, profile management, and route protection
 */

/* =========================================================
   RECEPTIONIST / COMMON AUTHENTICATION (HEAD)
   ========================================================= */

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
  const adminToken = localStorage.getItem("admin_token") || localStorage.getItem("access_token");
  const adminUser = localStorage.getItem("current_user");
  const isLoginPage = window.location.pathname.toLowerCase().endsWith("login.html") && !window.location.pathname.toLowerCase().includes("pages/");

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
    if (adminToken && adminUser) {
      window.location.href = "pages/admin_dashboard.html";
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

  if (typeof setButtonLoading === "function") {
    setButtonLoading(submitBtn, true, "Signing In...");
  } else if (submitBtn) {
    submitBtn.disabled = true;
  }

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
    localStorage.removeItem("admin_token");
    localStorage.removeItem("current_user");

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

    } else if (role === "administrator" || role === "admin") {
      const token = response.token;
      if (typeof setToken === "function") {
        setToken(token);
      }
      localStorage.setItem("admin_token", token);
      localStorage.setItem("access_token", token);

      const adminUser = response.user || {
        user_id: response.user_id,
        username: response.username || username,
        role: "Administrator",
        full_name: response.name || response.username || "Administrator",
        department: "",
        is_active: true,
      };
      localStorage.setItem("current_user", JSON.stringify(adminUser));

      showToast("Administrator login successful! Welcome back.", "success");

      setTimeout(() => {
        window.location.href = response.redirect || "pages/admin_dashboard.html";
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
    if (typeof setButtonLoading === "function") {
      setButtonLoading(submitBtn, false);
    } else if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

/**
 * Perform receptionist logout request
 */
async function handleLogout() {
  const doLogout = async () => {
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
  };

  if (typeof showConfirmModal === "function") {
    showConfirmModal({
      title: "Sign Out",
      message: "Are you sure you want to end your current receptionist session?",
      confirmBtnText: "Sign Out",
      confirmBtnClass: "btn-danger",
      onConfirm: doLogout,
    });
  } else {
    if (confirm("Are you sure you want to end your current receptionist session?")) {
      doLogout();
    }
  }
}

// Bind global logout triggers for receptionist interface
document.addEventListener("DOMContentLoaded", () => {
  const logoutButtons = document.querySelectorAll(".btn-logout-trigger");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
});

/* =========================================================
   CLINIXONE - ADMIN AUTHENTICATION & ACCESS CONTROL (INCOMING)
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
  const isAdminPage =
    window.location.pathname.includes("/pages/") ||
    document.querySelector(".admin-layout") !== null ||
    document.getElementById("loginForm") !== null;

  if (!isAdminPage) return;

  const isLoginPage = window.location.pathname.endsWith("login.html");
  const token = getToken();

  if (isLoginPage) {
    if (token) {
      try {
        const user = await api.get("/api/admin/me/");
        if (user && user.role && user.role.toLowerCase() === "administrator") {
          window.location.href = "admin_dashboard.html";
          return;
        }
      } catch (err) {
        removeToken();
      }
    }
    setupLoginForm();
  } else {
    // Protected admin page
    const loginTarget = window.location.pathname.includes("/pages/") ? "../login.html" : "login.html";
    if (!token) {
      window.location.href = loginTarget;
      return;
    }

    try {
      const user = await api.get("/api/admin/me/");
      updateHeaderProfile(user);
    } catch (err) {
      console.error("Admin auth check failed:", err);
      removeToken();
      window.location.href = loginTarget;
    }
  }
});

function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const submitBtn = document.getElementById("loginSubmitBtn");
    const errorAlert = document.getElementById("loginErrorAlert");

    if (errorAlert) {
      errorAlert.textContent = "";
      errorAlert.style.display = "none";
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showLoginError("Please enter both username and password.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Signing in...`;
    }

    try {
      // POST /api/token/
      const tokenResponse = await fetch(`${API_BASE_URL}/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        const msg = tokenData.non_field_errors
          ? tokenData.non_field_errors.join(" ")
          : "Invalid username or password.";
        throw new Error(msg);
      }

      // Save token
      setToken(tokenData.token);

      // Verify administrator privileges
      const user = await api.get("/api/admin/me/");

      if (!user.role || user.role.toLowerCase() !== "administrator") {
        removeToken();
        throw new Error("Access restricted: Administrator role required to access ClinixOne.");
      }

      localStorage.setItem("current_user", JSON.stringify(user));
      showToast("Login successful! Welcome back.", "success");

      setTimeout(() => {
        window.location.href = "admin_dashboard.html";
      }, 600);

    } catch (error) {
      console.error("Login failed:", error);
      showLoginError(error.message || "Failed to sign in. Check backend connection.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    }
  });
}

function showLoginError(msg) {
  const errorAlert = document.getElementById("loginErrorAlert");
  if (errorAlert) {
    errorAlert.textContent = msg;
    errorAlert.style.display = "block";
  } else {
    showToast(msg, "error");
  }
}

function updateHeaderProfile(user) {
  if (!user) return;

  const profileNameEl = document.querySelector(".profile-name");
  const profileAvatarEl = document.querySelector(".profile-avatar");
  const profileContainer = document.querySelector(".profile");

  const displayName = user.full_name || user.username || "Admin";
  const initials = (displayName.includes(" ")
    ? displayName.split(" ").map((w) => w[0]).join("")
    : displayName.slice(0, 2)
  ).toUpperCase();

  if (profileNameEl) {
    profileNameEl.textContent = displayName;
  }
  if (profileAvatarEl) {
    profileAvatarEl.textContent = initials;
  }

  if (profileContainer && !profileContainer.querySelector(".profile-dropdown")) {
    profileContainer.classList.add("profile-menu");

    const dropdown = document.createElement("div");
    dropdown.className = "profile-dropdown";
    dropdown.innerHTML = `
      <div style="padding: 10px 14px; border-bottom: 1px solid var(--border);">
        <div style="font-weight: 700; color: var(--text);">${displayName}</div>
        <div style="color: var(--text-light); font-size: 7px;">${user.role} · ${user.username}</div>
      </div>
      <a href="settings.html" class="profile-dropdown-item">
        <span>⚙</span> Settings
      </a>
      <button type="button" class="profile-dropdown-item logout" id="logoutBtn">
        <span>✕</span> Sign Out
      </button>
    `;
    profileContainer.appendChild(dropdown);

    profileContainer.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("active");
    });

    document.addEventListener("click", function () {
      dropdown.classList.remove("active");
    });

    const logoutBtn = dropdown.querySelector("#logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }
  }
}

function logout() {
  removeToken();
  localStorage.removeItem("admin_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("current_user");
  showToast("Signed out successfully.", "info");
  const loginTarget = window.location.pathname.includes("/pages/") ? "../login.html" : "login.html";
  setTimeout(() => {
    window.location.href = loginTarget;
  }, 400);
}
