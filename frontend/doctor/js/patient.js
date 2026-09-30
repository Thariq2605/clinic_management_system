const API_BASE_URL = "http://127.0.0.1:8000";

requireLogin();


/* ============================= */
/* GET IDS FROM URL               */
/* ============================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const appointmentId =
    params.get("appointment_id");

const doctorId =
    localStorage.getItem("doctor_id");


/* ============================= */
/* ELEMENTS                      */
/* ============================= */

const loadingMessage =
    document.getElementById("loadingMessage");

const patientContent =
    document.getElementById("patientContent");

const restrictedMessage =
    document.getElementById("restrictedMessage");

const restrictedText =
    document.getElementById("restrictedText");

const errorMessage =
    document.getElementById("errorMessage");


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
/* LOAD PATIENT                   */
/* ============================= */

async function loadPatient() {

    if (!doctorId || !appointmentId) {

        showError(
            "Invalid appointment information."
        );

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


        /* ============================= */
        /* ACCESS TOKEN EXPIRED           */
        /* ============================= */

        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();

            if (refreshed) {

                return loadPatient();

            }

            logout();

            return;
        }


        /* ============================= */
        /* PAYMENT NOT COMPLETED          */
        /* ============================= */

        if (response.status === 403) {

            const data =
                await response.json();

            showRestricted(
                data.error ||
                "Payment has not been completed for this appointment."
            );

            return;
        }


        /* ============================= */
        /* NOT FOUND                      */
        /* ============================= */

        if (response.status === 404) {

            const data =
                await response.json();

            showError(
                data.error ||
                "Appointment not found."
            );

            return;
        }


        /* ============================= */
        /* OTHER ERRORS                   */
        /* ============================= */

        if (!response.ok) {

            throw new Error(
                `Unable to load patient details. Status: ${response.status}`
            );
        }


        const data =
            await response.json();


        console.log(
            "Patient details response:",
            data
        );


        displayPatient(data);

    }

    catch (error) {

        console.error(
            "Patient details error:",
            error
        );

        showError(
            error.message
        );
    }
}


/* ============================= */
/* DISPLAY PATIENT               */
/* ============================= */

function displayPatient(data) {

    loadingMessage.style.display =
        "none";

    restrictedMessage.style.display =
        "none";

    errorMessage.style.display =
        "none";

    patientContent.style.display =
        "block";


    const patient =
        data.patient || {};


    /* ============================= */
    /* PATIENT HEADER                */
    /* ============================= */

    document.getElementById(
        "patientId"
    ).textContent =
        patient.patient_id ?? "-";


    document.getElementById(
        "patientName"
    ).textContent =
        patient.full_name || "-";


    document.getElementById(
        "patientInitial"
    ).textContent =
        getInitial(
            patient.full_name
        );


    document.getElementById(
        "tokenNumber"
    ).textContent =
        data.token_number ?? "-";


    /* ============================= */
    /* BASIC DETAILS                 */
    /* ============================= */

    document.getElementById(
        "detailName"
    ).textContent =
        patient.full_name || "-";


    document.getElementById(
        "detailAge"
    ).textContent =
        patient.age !== undefined
            ? `${patient.age} years`
            : "-";


    document.getElementById(
        "detailGender"
    ).textContent =
        patient.gender || "-";


    document.getElementById(
        "detailBloodGroup"
    ).textContent =
        patient.blood_group || "-";


    /* ============================= */
    /* CONTACT                       */
    /* ============================= */

    document.getElementById(
        "detailMobile"
    ).textContent =
        patient.mobile_number || "-";


    document.getElementById(
        "detailEmail"
    ).textContent =
        patient.email || "-";


    document.getElementById(
        "detailAddress"
    ).textContent =
        patient.address || "-";


    /* ============================= */
    /* EMERGENCY                     */
    /* ============================= */

    document.getElementById(
        "detailEmergency"
    ).textContent =
        patient.emergency_contact || "-";


    document.getElementById(
        "detailEmergencyPhone"
    ).textContent =
        patient.emergency_phone || "-";

}


/* ============================= */
/* PAYMENT RESTRICTED            */
/* ============================= */

function showRestricted(message) {

    loadingMessage.style.display =
        "none";

    patientContent.style.display =
        "none";

    errorMessage.style.display =
        "none";

    restrictedMessage.style.display =
        "block";

    restrictedText.textContent =
        message;
}


/* ============================= */
/* ERROR                         */
/* ============================= */

function showError(message) {

    loadingMessage.style.display =
        "none";

    patientContent.style.display =
        "none";

    restrictedMessage.style.display =
        "none";

    errorMessage.style.display =
        "block";

    errorMessage.textContent =
        message;
}


/* ============================= */
/* BACK                          */
/* ============================= */

function goBack() {

    window.location.href =
        "appointment.html";
}


/* ============================= */
/* CONSULTATION                  */
/* ============================= */

function startConsultation() {

    window.location.href =
        `consultation.html?appointment_id=${appointmentId}`;
}


/* ============================= */
/* INITIAL                       */
/* ============================= */

loadPatient();