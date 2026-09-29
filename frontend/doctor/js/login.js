// ==========================================
// CAREFLOW DOCTOR LOGIN
// ==========================================


// Django backend URL
const API_BASE_URL = "http://127.0.0.1:8000";


// Get elements
const loginForm = document.getElementById("loginForm");

const usernameInput = document.getElementById("username");

const passwordInput = document.getElementById("password");

const rememberMe = document.getElementById("rememberMe");

const loginButton = document.getElementById("loginButton");

const loginButtonText = document.getElementById("loginButtonText");

const loginLoader = document.getElementById("loginLoader");

const loginError = document.getElementById("loginError");

const togglePassword = document.getElementById("togglePassword");


// ==========================================
// PASSWORD SHOW / HIDE
// ==========================================

togglePassword.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

    } else {

        passwordInput.type = "password";

    }

});


// ==========================================
// LOGIN FORM
// ==========================================

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();


    // Get values
    const username = usernameInput.value.trim();

    const password = passwordInput.value;


    // Clear previous error
    loginError.classList.remove("show");


    // Basic validation
    if (username === "" || password === "") {

        loginError.textContent =
            "Please enter your username and password.";

        loginError.classList.add("show");

        return;
    }


    // Loading state
    loginButton.disabled = true;

    loginButtonText.textContent = "Signing in...";

    loginLoader.classList.add("show");


    try {

        // Send login request
        const response = await fetch(
            `${API_BASE_URL}/doctor/login/`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: username,
                    password: password
                })
            }
        );


        const data = await response.json();


        // Login failed
        if (!response.ok) {

            throw new Error(
                data.detail ||
                data.message ||
                "Invalid username or password."
            );
        }


        // ==========================================
        // LOGIN SUCCESSFUL
        // ==========================================

        saveTokens(
            data.access,
            data.refresh,
            rememberMe.checked
        );


        // Save doctor information
        localStorage.setItem(
            "doctor_id",
            data.doctor_id
        );

        localStorage.setItem(
            "doctor_name",
            data.doctor_name
        );

        localStorage.setItem(
            "user_id",
            data.user_id
        );

        localStorage.setItem(
            "username",
            data.username
        );


        // Go to dashboard
        window.location.href = "dashboard.html";


    } catch (error) {

        console.error("Login error:", error);


        loginError.textContent =
            error.message ||
            "Unable to login. Please try again.";

        loginError.classList.add("show");


    } finally {

        // Reset loading
        loginButton.disabled = false;

        loginButtonText.textContent = "Sign In";

        loginLoader.classList.remove("show");

    }

});