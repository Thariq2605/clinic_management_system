// ==========================================
// CAREFLOW DOCTOR DASHBOARD
// ==========================================


// Django backend
const API_BASE_URL = "http://127.0.0.1:8000";


// ==========================================
// CHECK LOGIN
// ==========================================

requireLogin();


// ==========================================
// GET DOCTOR INFORMATION
// ==========================================

const doctorId = localStorage.getItem("doctor_id");

const storedDoctorName =
    localStorage.getItem("doctor_name");


// If there is no doctor ID,
// send the user back to login.

if (!doctorId) {

    logout();

}


// ==========================================
// DISPLAY DOCTOR NAME
// ==========================================

if (storedDoctorName) {

    document.getElementById("doctorName").textContent =
        storedDoctorName;

    // Create initials

    const nameParts =
        storedDoctorName
            .replace("Dr.", "")
            .trim()
            .split(" ");

    let initials = "";

    if (nameParts.length >= 2) {

        initials =
            nameParts[0].charAt(0) +
            nameParts[1].charAt(0);

    } else {

        initials =
            nameParts[0].substring(0, 2);

    }

    document.getElementById("doctorAvatar").textContent =
        initials.toUpperCase();


    document.getElementById("greeting").textContent =
        `Good morning, ${storedDoctorName}`;

}


// ==========================================
// CURRENT DATE
// ==========================================

function displayCurrentDate() {

    const date = new Date();

    const options = {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    };

    let formattedDate =
        date.toLocaleDateString("en-GB", options);

    formattedDate =
        formattedDate.toUpperCase();

    document.getElementById("currentDate").textContent =
        formattedDate;
}


displayCurrentDate();


// ==========================================
// GET DASHBOARD DATA
// ==========================================

async function loadDashboard() {
    if (!doctorId || !getAccessToken()) {
        logout();
        return;
    }

    let dashboardData = null;

    // This endpoint supplies supplemental dashboard values (not the table data).
    // Failure here must not prevent the working appointments endpoint from loading.
    try {
        let response = await fetch(
            `${API_BASE_URL}/doctor/dashboard/${doctorId}/`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${getAccessToken()}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (response.status === 401 && await refreshAccessToken()) {
            response = await fetch(
                `${API_BASE_URL}/doctor/dashboard/${doctorId}/`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${getAccessToken()}`,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        if (response.status === 401) {
            logout();
            return;
        }

        if (response.ok) {
            dashboardData = await response.json();
            displayDashboardData(dashboardData);
        } else {
            console.error("Dashboard summary request failed:", response.status);
        }
    } catch (error) {
        console.error("Dashboard summary error:", error);
    }

    await loadDashboardAppointments(dashboardData);
}


// ==========================================
// DISPLAY DASHBOARD DATA
// ==========================================

function displayDashboardData(data) {

    /*
        The exact field names depend on the
        JSON returned by your Django
        doctor_dashboard API.

        This function supports several
        common field names so we can easily
        adjust it after seeing your response.
    */


    // --------------------------------------
    // Appointment count
    // --------------------------------------

    const appointments = data.appointments || {};


    const appointmentCount = Array.isArray(appointments)
        ? appointments.length
        : (appointments.total ?? data.appointment_count ?? 0);


    document.getElementById(
        "todayAppointments"
    ).textContent = appointmentCount;


    // --------------------------------------
    // Completed
    // --------------------------------------

    const completed = appointments.completed ?? data.completed ?? 0;


    document.getElementById(
        "completedAppointments"
    ).textContent = completed;


    // --------------------------------------
    // Pending
    // --------------------------------------

    const pending = (appointments.scheduled ?? 0) + (appointments.confirmed ?? 0);


    document.getElementById(
        "pendingAppointments"
    ).textContent = pending;


    // --------------------------------------
    // Patients
    // --------------------------------------

    const patients = data.patients_seen ?? data.total_patients ?? 0;


    document.getElementById(
        "patientsSeen"
    ).textContent = patients;

    const appointmentChange = data.appointment_change ?? 0;
    document.getElementById("appointmentChange").textContent =
        `${appointmentChange > 0 ? "+" : ""}${appointmentChange} appointments vs yesterday`;
    const completedPercentage = appointmentCount
        ? Math.round((completed / appointmentCount) * 100)
        : 0;
    document.getElementById("completedPercentage").textContent = `${completedPercentage}%`;


    // --------------------------------------
    // Appointment table
    // --------------------------------------

    // --------------------------------------
    // Summary
    // --------------------------------------

    document.getElementById(
        "appointmentSummary"
    ).textContent =
        `${appointmentCount} appointments scheduled`;


    document.getElementById(
        "showingText"
    ).textContent =
        `Showing ${appointmentCount} appointments`;

}

async function loadDashboardAppointments(dashboardData = null) {
    try {
        let response = await fetch(`${API_BASE_URL}/doctor/appointments/${doctorId}/`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${getAccessToken()}`,
                "Content-Type": "application/json"
            }
        });
        if (response.status === 401 && await refreshAccessToken()) {
            response = await fetch(`${API_BASE_URL}/doctor/appointments/${doctorId}/`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    "Content-Type": "application/json"
                }
            });
        }
        if (response.status === 401) {
            logout();
            return;
        }
        if (response.status === 403) {
            throw new Error("You are not authorized to view these appointments.");
        }
        if (!response.ok) throw new Error(`Unable to load today's appointments (${response.status}).`);
        const appointments = await response.json();

        if (!Array.isArray(appointments)) {
            throw new Error("The appointments response was not a list.");
        }

        // Keep the existing View/Open actions informed when a consultation exists.
        // This is supplemental: consultation lookup errors do not hide appointment rows.
        try {
            let consultationsResponse = await fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    "Content-Type": "application/json"
                }
            });
            if (consultationsResponse.status === 401 && await refreshAccessToken()) {
                consultationsResponse = await fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${getAccessToken()}`,
                        "Content-Type": "application/json"
                    }
                });
            }
            if (consultationsResponse.ok) {
                const consultations = await consultationsResponse.json();
                if (Array.isArray(consultations)) {
                    const consultationByAppointment = new Map(
                        consultations.map(item => [String(item.appointment), item])
                    );
                    appointments.forEach(item => {
                        const consultation = consultationByAppointment.get(String(item.appointment_id));
                        if (consultation) item.consultation_id = consultation.consultation_id;
                    });
                }
            } else {
                console.error("Dashboard consultation lookup failed:", consultationsResponse.status);
            }
        } catch (error) {
            console.error("Dashboard consultation lookup error:", error);
        }

        displayAppointments(appointments);
        const statusOf = item => String(item.status || "").trim().toLowerCase();
        const completedCount = appointments.filter(item => statusOf(item) === "completed").length;
        const pendingCount = appointments.filter(item => ["scheduled", "confirmed"].includes(statusOf(item))).length;
        const seenPatients = new Set(
            appointments
                .filter(item => item.consultation_id)
                .map(item => String(item.patient))
        );

        document.getElementById("todayAppointments").textContent = appointments.length;
        document.getElementById("completedAppointments").textContent = completedCount;
        document.getElementById("completedPercentage").textContent = appointments.length ? `${Math.round(completedCount * 100 / appointments.length)}%` : "0%";
        document.getElementById("pendingAppointments").textContent = pendingCount;
        if (dashboardData && dashboardData.patients_seen !== undefined) {
            document.getElementById("patientsSeen").textContent = dashboardData.patients_seen;
        } else {
            document.getElementById("patientsSeen").textContent = seenPatients.size;
        }
        document.getElementById("appointmentSummary").textContent = `${appointments.length} appointments scheduled`;
        document.getElementById("showingText").textContent = `Showing ${appointments.length} appointments`;
        const now = new Date();
        const upcoming = appointments
            .filter(item => ["scheduled", "confirmed"].includes(String(item.status || "").toLowerCase()))
            .map(item => item.appointment_time)
            .filter(time => time && time > now.toTimeString().slice(0, 8))
            .sort()[0];
        document.getElementById("nextPatientTime").textContent = upcoming ? formatTime(upcoming) : "None";
    } catch (error) {
        console.error("Dashboard appointments error:", error);
        showDashboardError(error.message || "Unable to load today's appointments.");
    }
}


// ==========================================
// DISPLAY APPOINTMENTS
// ==========================================

function displayAppointments(appointments) {

    const tableBody =
        document.getElementById(
            "appointmentsTableBody"
        );


    tableBody.innerHTML = "";


    if (appointments.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">
                    No appointments scheduled for today.
                </td>
            </tr>
        `;

        return;
    }


    appointments
        .slice(0, 5)
        .forEach(function (appointment) {

            const row =
                document.createElement("tr");


            const token =
                appointment.token_number ||
                appointment.token ||
                "--";


            const time =
                appointment.appointment_time ||
                appointment.time ||
                "--";


            const patient =
                appointment.patient_name ||
                appointment.patient?.name ||
                "Unknown Patient";


            const patientId =
                appointment.patient ||
                appointment.patient_id ||
                appointment.patient?.patient_id ||
                "";


            const type =
                appointment.reason ||
                appointment.appointment_type ||
                appointment.type ||
                "General consultation";


            const payment =
                appointment.payment_status ||
                appointment.payment ||
                "Pending";


            const status = appointment.status || "Waiting";


            row.innerHTML = `

                <td>
                    ${token}
                </td>


                <td>
                    ${formatTime(time)}
                </td>


                <td>

                    <span class="patient-name">
                        ${patient}
                    </span>

                    <span class="patient-id">
                        ${patientId}
                    </span>

                </td>


                <td>
                    ${type}
                </td>


                <td>
                    ${createPaymentBadge(payment)}
                </td>


                <td>
                    ${createStatusBadge(status)}
                </td>


                <td>
                    ${createActionButtons(appointment)}
                </td>

            `;


            tableBody.appendChild(row);

        });

}


// ==========================================
// PAYMENT BADGE
// ==========================================

function createPaymentBadge(payment) {

    const value =
        String(payment).toLowerCase();


    if (value === "paid") {

        return `
            <span class="status-badge status-paid">
                Paid
            </span>
        `;

    }


    return `
        <span class="status-badge status-pending" title="Payment Pending: Patient must complete payment at reception first.">
            Payment Pending
        </span>
    `;
}


// ==========================================
// STATUS BADGE
// ==========================================

function createStatusBadge(status) {

    const value =
        String(status).toLowerCase();


    if (value.includes("completed")) {

        return `
            <span class="status-badge status-completed">
                Completed
            </span>
        `;
    }


    if (
        value.includes("progress") ||
        value.includes("in progress")
    ) {

        return `
            <span class="status-badge status-progress">
                In progress
            </span>
        `;
    }


    if (value.includes("pending")) {

        return `
            <span class="status-badge status-pending">
                Pending
            </span>
        `;
    }


    if (value.includes("scheduled")) {

        return `
            <span class="status-badge status-scheduled">
                Scheduled
            </span>
        `;
    }


    return `
        <span class="status-badge status-waiting">
            ${status}
        </span>
    `;
}


// ==========================================
// ACTION BUTTONS
// ==========================================

function createActionButtons(appointment) {

    const appointmentId =
        appointment.appointment_id ||
        appointment.id;

    const isPaid = (appointment.payment_status || appointment.payment || "").toLowerCase() === "paid";

    if (!isPaid) {
        return `
            <button
                class="table-action disabled"
                disabled
                title="Payment is pending. Doctor access will be available after payment is completed."
            >
                Locked
            </button>
        `;
    }

    if (appointment.consultation_id) {
        return `<button class="table-action" onclick="viewPatient(${appointmentId})">View</button>
            <button class="table-action primary" onclick="openExistingConsultation(${appointment.consultation_id})">Open</button>`;
    }

    const status =
        String(
            appointment.status || ""
        ).toLowerCase();

    let startButton = "";


    if (status.includes("completed")) {

        startButton = `
            <button class="table-action primary">
                Record
            </button>
        `;

    } else if (
        status.includes("progress")
    ) {

        startButton = `
            <button
                class="table-action primary"
                onclick="openConsultation(${appointmentId})"
            >
                Continue
            </button>
        `;

    } else {

        startButton = `
            <button
                class="table-action primary"
                onclick="openConsultation(${appointmentId})"
            >
                Start
            </button>
        `;
    }


    return `
        <button
            class="table-action"
            onclick="viewPatient(${appointmentId})"
        >
            View
        </button>

        ${startButton}
    `;
}


// ==========================================
// FORMAT TIME
// ==========================================

function formatTime(time) {

    if (!time || time === "--") {

        return "--";
    }


    try {

        const parts =
            String(time).split(":");


        let hour =
            parseInt(parts[0]);


        const minute =
            parts[1];


        const ampm =
            hour >= 12
                ? "PM"
                : "AM";


        hour =
            hour % 12 || 12;


        return `${hour}:${minute} ${ampm}`;

    } catch {

        return time;
    }
}


// ==========================================
// REFRESH JWT TOKEN
// ==========================================

async function refreshAccessToken() {

    const refreshToken =
        getRefreshToken();


    if (!refreshToken) {

        return false;
    }


    try {

        const response = await fetch(
            `${API_BASE_URL}/doctor/token/refresh/`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    refresh: refreshToken
                })
            }
        );


        if (!response.ok) {

            return false;
        }


        const data =
            await response.json();


        const newAccessToken =
            data.access;


        if (!newAccessToken) {

            return false;
        }


        const rememberMe =
            localStorage.getItem(
                "access_token"
            ) !== null;


        saveTokens(
            newAccessToken,
            refreshToken,
            rememberMe
        );


        return true;


    } catch (error) {

        console.error(
            "Token refresh error:",
            error
        );

        return false;
    }

}


// ==========================================
// BUTTON FUNCTIONS
// ==========================================

function goToPatients() {

    window.location.href =
        "patient.html";
}


function startConsultation() {

    window.location.href =
        "consultation.html";
}


function viewPatient(appointmentId) {

    if (appointmentId) localStorage.setItem("current_appointment_id", String(appointmentId));

    window.location.href =
        `patient.html?appointment_id=${appointmentId}`;
}


function openConsultation(appointmentId) {

    if (appointmentId) localStorage.setItem("current_appointment_id", String(appointmentId));

    window.location.href =
        `consultation.html?appointment_id=${appointmentId}`;
}

function openExistingConsultation(consultationId) {
    localStorage.removeItem("current_appointment_id");
    window.location.href = `consultation.html?consultation_id=${encodeURIComponent(consultationId)}&mode=view`;
}


// ==========================================
// ERROR
// ==========================================

function showDashboardError(message) {

    const tableBody =
        document.getElementById(
            "appointmentsTableBody"
        );


    tableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="loading-cell"
            >
                ${message}
            </td>
        </tr>
    `;
}


// ==========================================
// LOAD DASHBOARD
// ==========================================

loadDashboard();
