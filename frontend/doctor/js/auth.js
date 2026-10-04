// ==========================================
// CAREFLOW AUTHENTICATION
// ==========================================


// Save JWT tokens
function saveTokens(accessToken, refreshToken, rememberMe = false) {

    const storage = rememberMe
        ? localStorage
        : sessionStorage;

    storage.setItem("access_token", accessToken);
    storage.setItem("refresh_token", refreshToken);
}


// Get access token
function getAccessToken() {

    return (
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token")
    );
}


// Get refresh token
function getRefreshToken() {

    return (
        localStorage.getItem("refresh_token") ||
        sessionStorage.getItem("refresh_token")
    );
}


// Remove tokens
function logout() {

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");

    localStorage.removeItem("doctor_id");
    localStorage.removeItem("doctor_name");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("current_appointment_id");

    window.location.href = "../login.html";
}


// Check whether user is logged in
function isLoggedIn() {

    return getAccessToken() !== null;
}


// Protect pages
function requireLogin() {

    if (!isLoggedIn()) {
        window.location.href = "../login.html";
    }
}

function getInitial(name) {

    if (!name) {
        return "P";
    }

    return name
        .trim()
        .charAt(0)
        .toUpperCase();
}

// Use the existing SimpleJWT refresh endpoint for protected API requests.
async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
        const response = await fetch("http://127.0.0.1:8000/doctor/doctor/token/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken })
        });
        if (!response.ok) return false;
        const data = await response.json();
        if (!data.access) return false;
        const rememberMe = localStorage.getItem("refresh_token") !== null;
        saveTokens(data.access, refreshToken, rememberMe);
        return true;
    } catch (error) {
        console.error("Token refresh failed:", error);
        return false;
    }
}
