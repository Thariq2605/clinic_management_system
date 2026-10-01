const API_BASE_URL = "http://127.0.0.1:8000";

requireLogin();

const doctorId = localStorage.getItem("doctor_id");

const appointmentTableBody =
    document.getElementById("appointmentTableBody");

const loadingMessage =
    document.getElementById("loadingMessage");

const errorMessage =
    document.getElementById("errorMessage");

const emptyMessage =
    document.getElementById("emptyMessage");

const tableContainer =
    document.getElementById("tableContainer");

const appointmentCount =
    document.getElementById("appointmentCount");

const searchInput =
    document.getElementById("searchInput");


/* ============================= */
/* LOAD APPOINTMENTS              */
/* ============================= */

async function loadAppointments() {

    if (!doctorId) {
        window.location.href = "login.html";
        return;
    }

    showLoading();

    const accessToken = getAccessToken();

    try {

        const response = await fetch(
            `${API_BASE_URL}/doctor/appointments/${doctorId}/`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );


        /* TOKEN EXPIRED */

        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();

            if (refreshed) {
                return loadAppointments();
            }

            logout();
            return;
        }


        /* NOT AUTHORIZED */

        if (response.status === 403) {

            throw new Error(
                "You are not authorized to view these appointments."
            );
        }


        if (!response.ok) {

            throw new Error(
                `Unable to load appointments. Status: ${response.status}`
            );
        }


        const appointments =
            await response.json();

        console.log(
            "Appointments response:",
            appointments
        );


        displayAppointments(appointments);

    }

    catch (error) {

        console.error(
            "Appointment error:",
            error
        );

        showError(error.message);
    }
}


/* ============================= */
/* DISPLAY APPOINTMENTS           */
/* ============================= */

function displayAppointments(appointments) {

    loadingMessage.style.display = "none";

    errorMessage.style.display = "none";


    /* DATE */

    const today = new Date();

    document.getElementById("todayDate").textContent =
        today.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );


    /* NO APPOINTMENTS */

    if (
        !Array.isArray(appointments) ||
        appointments.length === 0
    ) {

        tableContainer.style.display = "none";

        emptyMessage.style.display = "block";

        appointmentCount.textContent =
            "0 appointments";

        updateStatistics([]);

        return;
    }


    /* SHOW TABLE */

    emptyMessage.style.display = "none";

    tableContainer.style.display = "block";


    appointmentCount.textContent =
        `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`;


    updateStatistics(appointments);


    appointmentTableBody.innerHTML = "";


    appointments.forEach(
        appointment => {

            const row =
                document.createElement("tr");


            const status =
                (appointment.status || "unknown")
                .toLowerCase();


            const time =
                formatTime(
                    appointment.appointment_time
                );


            row.innerHTML = `

                <td>
                    <span class="token-number">
                        ${escapeHtml(
                            appointment.token_number
                        )}
                    </span>
                </td>

                <td>
                    <span class="patient-id">
                        #${escapeHtml(
                            appointment.patient
                        )}
                    </span>
                </td>

                <td>${escapeHtml(appointment.patient_name || "-")}</td>

                <td>
                    ${escapeHtml(time)}
                </td>

                <td>
                    ${escapeHtml(
                        appointment.reason || "-"
                    )}
                </td>

                <td>
                    <span class="
                        status-badge
                        status-${escapeHtml(status)}
                    ">
                        ${escapeHtml(status)}
                    </span>
                </td>

                <td>
                    <button
                        class="view-btn"
                        onclick="viewPatient(
                            ${appointment.appointment_id}
                        )"
                    >
                        View Patient
                    </button>
                    <button class="view-btn" onclick="openConsultation(${Number(appointment.appointment_id)})">Start Consultation</button>
                </td>

            `;

            appointmentTableBody.appendChild(row);
        }
    );
}


/* ============================= */
/* STATISTICS                    */
/* ============================= */

function updateStatistics(appointments) {

    const total =
        appointments.length;

    const scheduled =
        appointments.filter(
            appointment =>
                appointment.status?.toLowerCase()
                === "scheduled"
        ).length;

    const confirmed =
        appointments.filter(
            appointment =>
                appointment.status?.toLowerCase()
                === "confirmed"
        ).length;

    const completed =
        appointments.filter(
            appointment =>
                appointment.status?.toLowerCase()
                === "completed"
        ).length;


    document.getElementById(
        "totalAppointments"
    ).textContent = total;

    document.getElementById(
        "scheduledAppointments"
    ).textContent = scheduled;

    document.getElementById(
        "confirmedAppointments"
    ).textContent = confirmed;

    document.getElementById(
        "completedAppointments"
    ).textContent = completed;
}


/* ============================= */
/* VIEW PATIENT                  */
/* ============================= */

function viewPatient(appointmentId) {

    if (!appointmentId ||
        appointmentId === "null" ||
        appointmentId === "undefined") {

        showError(
            "This appointment does not have a valid appointment ID."
        );

        return;
    }

    localStorage.setItem("current_appointment_id", String(appointmentId));

    window.location.href =
        `patient.html?appointment_id=${appointmentId}&from=appointments`;
}

function openConsultation(appointmentId) {
    if (!appointmentId || appointmentId === "null" || appointmentId === "undefined") {
        showError("This appointment does not have a valid appointment ID.");
        return;
    }
    localStorage.setItem("current_appointment_id", String(appointmentId));
    window.location.href = `consultation.html?appointment_id=${encodeURIComponent(appointmentId)}`;
}


/* ============================= */
/* SEARCH                        */
/* ============================= */

searchInput.addEventListener(
    "input",
    function () {

        const searchValue =
            this.value
                .trim()
                .toLowerCase();


        const rows =
            appointmentTableBody.querySelectorAll("tr");


        rows.forEach(row => {

            const text =
                row.textContent.toLowerCase();


            if (text.includes(searchValue)) {
                row.style.display = "";
            }
            else {
                row.style.display = "none";
            }

        });

    }
);


/* ============================= */
/* FORMAT TIME                   */
/* ============================= */

function formatTime(time) {

    if (!time) {
        return "-";
    }

    const parts =
        time.split(":");

    let hour =
        parseInt(parts[0]);

    const minute =
        parts[1];

    const ampm =
        hour >= 12 ? "PM" : "AM";

    hour =
        hour % 12 || 12;

    return `${hour}:${minute} ${ampm}`;
}


/* ============================= */
/* ESCAPE HTML                   */
/* ============================= */

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {

        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================= */
/* UI STATES                     */
/* ============================= */

function showLoading() {

    loadingMessage.style.display = "block";

    tableContainer.style.display = "none";

    emptyMessage.style.display = "none";

    errorMessage.style.display = "none";
}


function showError(message) {

    loadingMessage.style.display = "none";

    tableContainer.style.display = "none";

    emptyMessage.style.display = "none";

    errorMessage.style.display = "block";

    errorMessage.textContent = message;
}


/* ============================= */
/* TOKEN REFRESH                 */
/* ============================= */

async function refreshAccessToken() {

    const refreshToken =
        getRefreshToken();

    if (!refreshToken) {
        return false;
    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/doctor/token/refresh/`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        refresh:
                            refreshToken
                    })
                }
            );


        if (!response.ok) {
            return false;
        }


        const data =
            await response.json();


        const rememberMe =
            localStorage.getItem(
                "refresh_token"
            ) !== null;


        saveTokens(
            data.access,
            refreshToken,
            rememberMe
        );


        return true;

    }

    catch (error) {

        console.error(
            "Token refresh failed:",
            error
        );

        return false;
    }
}


/* ============================= */
/* DOCTOR NAME                   */
/* ============================= */

const doctorName =
    localStorage.getItem("doctor_name");

if (doctorName) {

    document.getElementById(
        "doctorName"
    ).textContent = doctorName;
}


/* ============================= */
/* INITIAL LOAD                  */
/* ============================= */

loadAppointments();
