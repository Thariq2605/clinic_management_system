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

    window.location.href = "login.html";
}


// Check whether user is logged in
function isLoggedIn() {

    return getAccessToken() !== null;
}


// Protect pages
function requireLogin() {

    if (!isLoggedIn()) {
        window.location.href = "login.html";
    }
}