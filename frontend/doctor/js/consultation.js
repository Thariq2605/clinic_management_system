const API_BASE_URL = "http://127.0.0.1:8000";

requireLogin();


/* -----------------------------
   GET URL PARAMETERS
----------------------------- */

const params =
    new URLSearchParams(window.location.search);

const appointmentId =
    params.get("appointment_id");
const requestedConsultationId = params.get("consultation_id");
const pageMode = params.get("mode");

const doctorId =
    localStorage.getItem("doctor_id");

const listView =
    document.getElementById("consultationListView");
const homeView = document.getElementById("consultationHomeView");

const createView =
    document.getElementById("consultationCreateView");


/* -----------------------------
   ELEMENTS
----------------------------- */

const consultationForm =
    document.getElementById("consultationForm");

const errorMessage =
    document.getElementById("errorMessage");

const doctorName =
    localStorage.getItem("doctor_name");

const pageSearch = document.querySelector(".topbar .search-box input");
let searchableList = null;

if (pageSearch) {
    pageSearch.addEventListener("input", applyConsultationSearch);
}

function setConsultationSearchList(list) {
    searchableList = list;
    applyConsultationSearch();
}

function applyConsultationSearch() {
    if (!searchableList || !pageSearch) return;

    const query = pageSearch.value.trim().toLocaleLowerCase();
    const rows = Array.from(searchableList.children).filter(row =>
        row.classList.contains("consultation-row")
    );
    let visibleRows = 0;

    rows.forEach(row => {
        const matches = !query || row.textContent.toLocaleLowerCase().includes(query);
        row.style.display = matches ? "" : "none";
        if (matches) visibleRows += 1;
    });

    let noMatches = searchableList.querySelector(":scope > .search-empty-state");
    if (query && rows.length && !visibleRows) {
        if (!noMatches) {
            noMatches = document.createElement("div");
            noMatches.className = "empty-state search-empty-state";
            noMatches.textContent = "No matching consultations found.";
            searchableList.appendChild(noMatches);
        }
    } else if (noMatches) {
        noMatches.remove();
    }
}


/* -----------------------------
   DOCTOR NAME
----------------------------- */

if (doctorName) {

    document.getElementById(
        "doctorName"
    ).textContent = doctorName;

}


/* -----------------------------
   CHECK INFORMATION
----------------------------- */

if (!doctorId) {

    showError(
        "Doctor information is missing."
    );

} else if (appointmentId) {

    // Create Consultation mode
    showCreateMode();

} else if (pageMode === "history" || (pageMode === "view" && requestedConsultationId)) {

    // Consultation History mode
    showListMode();

} else {
    showHomeMode();

}


/* -----------------------------
   LOAD PATIENT INFORMATION
----------------------------- */
function showCreateMode() {

    if (appointmentId) localStorage.setItem("current_appointment_id", appointmentId);

    if (listView) {
        listView.style.display = "none";
    }

    if (createView) {
        createView.style.display = "block";
    }

    loadPatientInfo();
}

function showListMode() {

    if (homeView) homeView.style.display = "none";

    if (createView) {
        createView.style.display = "none";
    }

    if (listView) {
        listView.style.display = "block";
    }

    if (pageMode === "history") {
        setConsultationSearchList(document.getElementById("consultationList"));
    }

    loadConsultations();
}

function showHomeMode() {
    if (createView) createView.style.display = "none";
    if (listView) listView.style.display = "none";
    if (homeView) homeView.style.display = "block";
    setConsultationSearchList(document.getElementById("availableAppointments"));
    loadAvailableAppointments();
}

async function loadAvailableAppointments() {
    const target = document.getElementById("availableAppointments");
    try {
        const headers = { Authorization: `Bearer ${getAccessToken()}` };
        let response = await fetch(`${API_BASE_URL}/doctor/appointments/${doctorId}/`, { headers });
        if (response.status === 401 && await refreshAccessToken()) return loadAvailableAppointments();
        if (!response.ok) throw new Error(`Unable to load today's appointments (${response.status}).`);
        const appointments = await response.json();
        response = await fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (response.status === 401 && await refreshAccessToken()) return loadAvailableAppointments();
        if (!response.ok) throw new Error(`Unable to check existing consultations (${response.status}).`);
        const consultations = await response.json();
        if (!appointments.length) {
            target.innerHTML = `<div class="empty-state"><h3>No appointments today</h3><p>There are no appointments scheduled for you today.</p></div>`;
            return;
        }
        const consultationByAppointment = new Map(consultations.map(item => [String(item.appointment), item]));
        target.innerHTML = appointments.map(item => {
            const existing = consultationByAppointment.get(String(item.appointment_id));
            const action = existing
                ? `<button class="secondary-btn" onclick="openExistingConsultation(${existing.consultation_id})">Open Consultation</button>`
                : `<button class="primary-btn" onclick="startAppointmentConsultation(${item.appointment_id})">Start Consultation</button>`;
            return `<div class="consultation-row"><div class="consultation-patient"><div class="patient-info"><h3>${escapeHtml(item.patient_name || "Patient")}</h3><span>Patient ID: ${escapeHtml(item.patient)} · Token: ${escapeHtml(item.token_number)}</span></div></div><div class="consultation-column"><span class="column-label">Appointment</span><strong>#${item.appointment_id}</strong></div><div class="consultation-column"><span class="column-label">Time</span><strong>${escapeHtml(item.appointment_time)}</strong></div>${action}</div>`;
        }).join("");
        applyConsultationSearch();
    } catch (error) {
        console.error("Available appointments error:", error);
        target.innerHTML = `<div class="error-message">${escapeHtml(error.message || "Unable to load appointments.")}</div>`;
    }
}

function startAppointmentConsultation(id) {
    if (!id) return;
    localStorage.setItem("current_appointment_id", String(id));
    window.location.href = `consultation.html?appointment_id=${encodeURIComponent(id)}`;
}

function openExistingConsultation(id) {
    if (id) {
        localStorage.removeItem("current_appointment_id");
        window.location.href = `consultation.html?consultation_id=${encodeURIComponent(id)}&mode=view`;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}
async function loadConsultations() {

    const accessToken =
        getAccessToken();

    const consultationList =
        document.getElementById(
            "consultationList"
        );

    if (!consultationList) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/doctor/consultations/${doctorId}/`,
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


        /* TOKEN EXPIRED */

        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();

            if (refreshed) {
                return loadConsultations();
            }

            logout();

            return;
        }


        if (!response.ok) {

            throw new Error(
                "Unable to load consultations."
            );

        }


        const consultations =
            await response.json();


        if (pageMode === "view" && requestedConsultationId) {
            displayConsultationDetail(consultations.find(item => String(item.consultation_id) === requestedConsultationId));
        } else {
            displayConsultations(consultations);
            applyConsultationSearch();
        }


    } catch (error) {

        console.error(
            "Consultation list error:",
            error
        );

        consultationList.innerHTML = `
            <div class="error-message">
                ${error.message}
            </div>
        `;
    }
}
async function loadPatientInfo() {

    if (!doctorId || !appointmentId) {
        return;
    }

    const accessToken =
        getAccessToken();

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/doctor/appointments/${doctorId}/${appointmentId}/patient/`,
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


        /* TOKEN EXPIRED */

        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();

            if (refreshed) {

                return loadPatientInfo();

            }

            logout();

            return;
        }


        /* PAYMENT NOT COMPLETED */

        if (response.status === 403) {

            const data =
                await response.json();

            showError(
                data.error ||
                "Payment has not been completed."
            );

            return;
        }


        /* OTHER ERROR */

        if (!response.ok) {

            throw new Error(
                "Unable to load patient information."
            );

        }


        const data =
            await response.json();


        console.log(
            "Patient information:",
            data
        );


        displayPatient(data);


    } catch (error) {

        console.error(error);

        showError(
            error.message
        );

    }

}

function displayConsultations(consultations) {

    const consultationList =
        document.getElementById("consultationList");

    if (!consultationList) {
        return;
    }

    if (!consultations || consultations.length === 0) {

        consultationList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🩺</div>
                <h3>No consultations found</h3>
                <p>
                    You don't have any consultation records yet.
                </p>
            </div>
        `;

        return;
    }

    consultationList.innerHTML = consultations.map(function (consultation) {

        const patient =
            consultation.patientdetails || {};

        const patientName =
            patient.full_name || "Unknown Patient";

        const patientId =
            patient.patient_id ?? "-";

        const initial =
            getInitial(patientName);

        const consultationId =
            consultation.consultation_id ?? "-";

        const consultationDate =
            consultation.consultation_date || "-";
        const appointmentNumber = consultation.appointment ?? "-";

        const diagnosis =
            consultation.diagnosis || "No diagnosis";

        return `
            <div class="consultation-row">

                <!-- Patient -->
                <div class="consultation-patient">

                    <div class="patient-avatar">
                        ${initial}
                    </div>

                    <div class="patient-info">
                        <h3>${patientName}</h3>
                        <span>
                            Patient ID: ${patientId}
                        </span>
                    </div>

                </div>


                <!-- Consultation ID -->
                <div class="consultation-column">
                    <span class="column-label">
                        Consultation ID
                    </span>

                    <strong>
                        #${consultationId}
                    </strong>
                </div>

                <div class="consultation-column">
                    <span class="column-label">Appointment ID</span>
                    <strong>#${appointmentNumber}</strong>
                </div>


                <!-- Date -->
                <div class="consultation-column">
                    <span class="column-label">
                        Date
                    </span>

                    <strong>
                        ${formatDate(consultationDate)}
                    </strong>
                </div>


                <!-- Diagnosis -->
                <div class="consultation-column diagnosis-column">

                    <span class="column-label">
                        Diagnosis
                    </span>

                    <strong>
                        ${diagnosis}
                    </strong>

                </div>


                <!-- Action -->
                <div class="consultation-action">

                    <button
                        class="view-button"
                        onclick="viewConsultation(${consultationId})">
                        View
                    </button>

                </div>

            </div>
        `;

    }).join("");
}

function formatDate(dateString) {

    if (!dateString || dateString === "-") {
        return "-";
    }

    const date = new Date(dateString);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function viewConsultation(
    consultationId
) {

    localStorage.removeItem("current_appointment_id");

    window.location.href =
        `consultation.html?consultation_id=${consultationId}&mode=view`;
}

function displayConsultationDetail(consultation) {
    const container = document.getElementById("consultationList");
    if (!consultation) {
        container.innerHTML = `<div class="error-message">Consultation not found.</div>`;
        return;
    }
    const patient = consultation.patientdetails || {};
    const safe = value => String(value ?? "-").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
    container.innerHTML = `<button class="secondary-btn" onclick="window.location.href='consultation.html'">Back to Consultation History</button>
      <div class="content-card"><h2>Consultation #${safe(consultation.consultation_id)}</h2>
      <p>Appointment #${safe(consultation.appointment)} · Patient: ${safe(patient.full_name)} (#${safe(patient.patient_id)})</p>
      <p>Date: ${safe(formatDate(consultation.consultation_date))}</p>
      <h3>Symptoms</h3><p>${safe(consultation.symptoms)}</p><h3>Diagnosis</h3><p>${safe(consultation.diagnosis)}</p>
      <h3>Notes</h3><p>${safe(consultation.notes)}</p>
      <button class="primary-btn" onclick="window.location.href='prescription.html?consultation_id=${encodeURIComponent(consultation.consultation_id)}'">Create Prescription</button></div>`;
}

/* -----------------------------
   DISPLAY PATIENT
----------------------------- */

function displayPatient(data) {

    const patient =
        data.patient || {};


    document.getElementById(
        "patientName"
    ).textContent =
        patient.full_name || "-";


    document.getElementById(
        "patientId"
    ).textContent =
        patient.patient_id ?? "-";


    document.getElementById(
        "patientInitial"
    ).textContent =
        getInitial(patient.full_name);


    document.getElementById(
        "tokenNumber"
    ).textContent =
        data.token_number ?? "-";

}


/* -----------------------------
   SAVE CONSULTATION
----------------------------- */

consultationForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        if (!doctorId || !appointmentId) {

            showError(
                "Invalid appointment information."
            );

            return;
        }


        const symptoms =
            document.getElementById(
                "symptoms"
            ).value.trim();


        const diagnosis =
            document.getElementById(
                "diagnosis"
            ).value.trim();


        const notes =
            document.getElementById(
                "notes"
            ).value.trim();


        if (!symptoms || !diagnosis) {

            showError(
                "Please enter symptoms and diagnosis."
            );

            return;
        }


        const saveButton =
            document.getElementById(
                "saveButton"
            );


        saveButton.disabled = true;

        saveButton.textContent =
            "Saving...";


        const accessToken =
            getAccessToken();


        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/doctor/appointments/${doctorId}/${appointmentId}/consultation/`,
                    {
                        method: "POST",

                        headers: {
                            "Authorization":
                                `Bearer ${accessToken}`,

                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            symptoms: symptoms,

                            diagnosis: diagnosis,

                            notes: notes

                        })
                    }
                );


            /* TOKEN EXPIRED */

            if (response.status === 401) {

                const refreshed =
                    await refreshAccessToken();

                if (refreshed) {

                    saveButton.disabled = false;

                    saveButton.textContent =
                        "Save Consultation";

                    return consultationForm.requestSubmit();

                }

                logout();

                return;
            }


            const data =
                await response.json();


            console.log(
                "Consultation response:",
                data
            );


            if (!response.ok) {

                showError(
                    data.error ||
                    data.detail ||
                    "Unable to save consultation."
                );

                return;
            }


            /* SUCCESS */

            alert(
                "Consultation saved successfully."
            );


            /*
                Backend should return consultation_id.
                We use it to open the next page.
            */

            const consultationId =
                data.consultation_id ||
                data.id;


            if (consultationId) {

                localStorage.removeItem("current_appointment_id");

                window.location.href =
                    `prescription.html?consultation_id=${consultationId}`;

            } else {

                window.location.href =
                    "appointment.html";

            }


        } catch (error) {

            console.error(
                "Consultation error:",
                error
            );

            showError(
                error.message
            );

        } finally {

            saveButton.disabled = false;

            saveButton.textContent =
                "Save Consultation";

        }

    }
);


/* -----------------------------
   ERROR
----------------------------- */

function showError(message) {

    errorMessage.style.display =
        "block";

    errorMessage.textContent =
        message;

}


/* -----------------------------
   BACK
----------------------------- */

function goBack() {
    window.location.href = appointmentId
        ? `patient.html?appointment_id=${encodeURIComponent(appointmentId)}&from=appointments`
        : "consultation.html";
}


/* -----------------------------
   INITIAL LOAD
----------------------------- */
