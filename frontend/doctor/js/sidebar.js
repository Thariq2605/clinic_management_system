document.addEventListener("DOMContentLoaded", function () {

    const sidebar = document.getElementById("sidebar");

    if (!sidebar) {
        return;
    }

    const currentPage =
        window.location.pathname.split("/").pop() || "dashboard.html";
    const pageParams = new URLSearchParams(window.location.search);
    const patientOrigin = pageParams.get("from");
    const isPatientFromAppointments = currentPage === "patient.html" && patientOrigin === "appointments";
    const currentAppointmentId = localStorage.getItem("current_appointment_id");

    const navItems = [
        {
            page: "dashboard.html",
            icon: "▣",
            text: "Dashboard"
        },
        {
            page: "appointment.html",
            icon: "▤",
            text: "Today's Appointments"
        },
        {
            page: "patients.html",
            icon: "♙",
            text: "Patients"
        },
        {
            page: "medicalhistory.html",
            icon: "◫",
            text: "Medical History"
        },
        {
            page: "consultation.html",
            icon: "♧",
            text: "Consultation"
        },
        {
            page: "prescription.html",
            icon: "⌕",
            text: "Prescriptions"
        },
        {
            page: "labtest.html",
            icon: "♧",
            text: "Lab Tests"
        },
        {
            page: "medicalrecord.html",
            icon: "▱",
            text: "Medical Records"
        },
        {
            page: "#",
            icon: "◎",
            text: "Profile"
        },
        {
            page: "#",
            icon: "⚙",
            text: "Settings"
        }
    ];

    let navigationHTML = "";

    navItems.forEach(function (item) {

        const isActive =
            (currentPage === item.page && !isPatientFromAppointments) ||
            (currentPage === "patient.html" && item.page === (isPatientFromAppointments ? "appointment.html" : "patients.html"));
        const targetPage = item.page === "consultation.html" && currentAppointmentId
            ? `consultation.html?appointment_id=${encodeURIComponent(currentAppointmentId)}`
            : item.page;

        navigationHTML += `
            <a href="${targetPage}"
               class="nav-item ${isActive ? "active" : ""}">
                <span class="nav-icon">${item.icon}</span>
                <span>${item.text}</span>
            </a>
        `;
    });

    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <img src="../assets/logo-white.svg" alt="MEDICARE" style="height: 38px; display: block; max-width: 100%;">
        </div>

        <nav class="sidebar-nav">
            ${navigationHTML}
        </nav>

        <div class="sidebar-help">

            <div class="help-icon">?</div>

            <div>
                <strong>Need help?</strong>
                <p>Contact clinic support for system assistance.</p>
            </div>

        </div>

        <div class="sidebar-bottom">

            <a href="#"
               class="nav-item"
               onclick="logout(); return false;">

                <span class="nav-icon">↪</span>
                <span>Logout</span>

            </a>

        </div>
    `;
});
