requireLogin();

const profileName = localStorage.getItem("doctor_name") || "Doctor";
const profileDoctorId = localStorage.getItem("doctor_id") || "Not available";
const profileUserId = localStorage.getItem("user_id") || "Not available";
const profileUsername = localStorage.getItem("username") || "Not available";
const profileInitials = profileName
    .replace(/^Dr\.\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "DR";

document.getElementById("profileHeaderName").textContent = profileName;
document.getElementById("profileHeaderAvatar").textContent = profileInitials;
document.getElementById("profileInitials").textContent = profileInitials;
document.getElementById("profileDoctorName").textContent = profileName;
document.getElementById("profileDoctorId").textContent = profileDoctorId;
document.getElementById("profileUserId").textContent = profileUserId;
document.getElementById("profileUsername").textContent = profileUsername;
