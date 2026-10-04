/* =========================================================
   CLINIXONE - AUTHENTICATION & ACCESS CONTROL
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
    const isLoginPage = window.location.pathname.endsWith("login.html");
    const token = getToken();

    if (isLoginPage) {
        // If already logged in, check token validity and redirect to dashboard
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
        // Protected page
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        // Validate and populate user profile
        try {
            const user = await api.get("/api/admin/me/");
            updateHeaderProfile(user);
        } catch (err) {
            console.error("Auth check failed:", err);
            removeToken();
            window.location.href = "login.html";
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
                body: JSON.stringify({ username, password })
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
        ? displayName.split(" ").map(w => w[0]).join("")
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
    showToast("Signed out successfully.", "info");
    setTimeout(() => {
        window.location.href = "login.html";
    }, 400);
}
