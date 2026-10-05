requireLogin();

const settingsDoctorName = localStorage.getItem("doctor_name") || "Doctor";
const settingsInitials = settingsDoctorName
    .replace(/^Dr\.\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "DR";

document.getElementById("settingsHeaderName").textContent = settingsDoctorName;
document.getElementById("settingsHeaderAvatar").textContent = settingsInitials;
