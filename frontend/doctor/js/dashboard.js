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

    const accessToken = getAccessToken();


    if (!accessToken) {

        logout();

        return;
    }


    try {

        const response = await fetch(
            `${API_BASE_URL}/doctor/dashboard/${doctorId}/`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );


        // ==================================
        // TOKEN EXPIRED
        // ==================================

        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();

            if (refreshed) {

                // Try dashboard again
                await loadDashboard();

                return;

            } else {

                logout();

                return;
            }
        }


        if (response.status === 403) {

            showDashboardError(
                "You are not authorized to access this dashboard."
            );

            return;
        }


        if (!response.ok) {

            throw new Error(
                "Unable to load dashboard."
            );
        }


        const data = await response.json();


        console.log("Dashboard response:", data);


        // Display API data
        displayDashboardData(data);


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        showDashboardError(
            "Unable to connect to the server."
        );

    }

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

    const appointments =
        data.appointments ||
        data.today_appointments ||
        data.data?.appointments ||
        [];


    const appointmentCount =
        Array.isArray(appointments)
            ? appointments.length
            : (
                data.appointment_count ||
                data.today_appointments_count ||
                0
            );


    document.getElementById(
        "todayAppointments"
    ).textContent = appointmentCount;


    document.getElementById(
        "appointmentBadge"
    ).textContent = appointmentCount;


    // --------------------------------------
    // Completed
    // --------------------------------------

    const completed =
        data.completed ||
        data.completed_appointments ||
        data.data?.completed ||
        0;


    document.getElementById(
        "completedAppointments"
    ).textContent = completed;


    // --------------------------------------
    // Pending
    // --------------------------------------

    const pending =
        data.pending ||
        data.pending_appointments ||
        data.data?.pending ||
        0;


    document.getElementById(
        "pendingAppointments"
    ).textContent = pending;


    // --------------------------------------
    // Patients
    // --------------------------------------

    const patients =
        data.patients_seen ||
        data.total_patients ||
        data.data?.patients_seen ||
        0;


    document.getElementById(
        "patientsSeen"
    ).textContent = patients;


    // --------------------------------------
    // Appointment table
    // --------------------------------------

    if (Array.isArray(appointments)) {

        displayAppointments(appointments);

    }


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
                appointment.patient_id ||
                appointment.patient?.patient_id ||
                "";


            const type =
                appointment.appointment_type ||
                appointment.type ||
                "General consultation";


            const payment =
                appointment.payment_status ||
                appointment.payment ||
                "Pending";


            const status =
                appointment.status ||
                "Waiting";


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
        <span class="status-badge status-pending">
            Pending
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

    window.location.href =
        `patient.html?appointment_id=${appointmentId}`;
}


function openConsultation(appointmentId) {

    window.location.href =
        `consultation.html?appointment_id=${appointmentId}`;
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