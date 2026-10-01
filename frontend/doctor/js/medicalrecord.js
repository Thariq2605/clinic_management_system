const API_BASE_URL =
    "http://127.0.0.1:8000";


requireLogin();


/* ==============================
   URL PARAMETERS
============================== */

const params =
    new URLSearchParams(
        window.location.search
    );


const consultationId =
    params.get("consultation_id");


const doctorId =
    localStorage.getItem(
        "doctor_id"
    );


/* ==============================
   ELEMENTS
============================== */

const medicalRecordForm =
    document.getElementById(
        "medicalRecordForm"
    );


const errorMessage =
    document.getElementById(
        "errorMessage"
    );


const saveRecordButton =
    document.getElementById(
        "saveRecordButton"
    );
const recordHistory = document.getElementById("recordHistory");
const recordHistoryList = document.getElementById("recordHistoryList");


/* ==============================
   DOCTOR NAME
============================== */

const doctorName =
    localStorage.getItem(
        "doctor_name"
    );


if (doctorName) {

    document.getElementById(
        "doctorName"
    ).textContent =
        doctorName;

}


/* ==============================
   CONSULTATION ID
============================== */

if (consultationId) {

    document.getElementById(
        "consultationId"
    ).textContent =
        consultationId;

}


/* ==============================
   CHECK INFORMATION
============================== */

if (!doctorId) {
    showError("Doctor information is missing. Please log in again.");
} else if (!consultationId) {
    document.querySelector(".record-patient-card").style.display = "none";
    document.querySelector(".page-header p").textContent = "Previous medical records";
    document.querySelector(".content-card:not(#recordHistory)").style.display = "none";
    recordHistory.style.display = "block";
    loadMedicalRecords();
} else {
    loadConsultationContext();
}

async function authenticatedJson(url, retry) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.status === 401 && await refreshAccessToken()) return authenticatedJson(url, retry);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return response.json();
}

async function loadMedicalRecords() {
    try {
        const records = await authenticatedJson(`${API_BASE_URL}/doctor/medical-records/${doctorId}/`);
        if (!records.length) {
            recordHistoryList.textContent = "No medical records found.";
            return;
        }
        recordHistoryList.innerHTML = records.map(record => `<div class="history-item"><strong>Record #${record.record_id}</strong> · Patient ${record.patient_name || `#${record.patient}`} · Consultation #${record.consultation}<p>${record.diagnosis || "No diagnosis"}</p><p>${record.medical_notes || "No notes"}</p><small>${record.created_at ? new Date(record.created_at).toLocaleDateString("en-IN") : "-"}</small></div>`).join("");
    } catch (error) { showError(error.message); }
}

async function loadConsultationContext() {
    try {
        const consultations = await authenticatedJson(`${API_BASE_URL}/doctor/consultations/${doctorId}/`);
        const consultation = consultations.find(item => String(item.consultation_id) === String(consultationId));
        if (!consultation) return;
        const patient = consultation.patientdetails || {};
        document.getElementById("patientName").textContent = patient.full_name || "Patient";
        document.getElementById("patientId").textContent = patient.patient_id ?? "-";
        document.getElementById("patientInitial").textContent = getInitial(patient.full_name);
    } catch (error) { showError(error.message); }
}


/* ==============================
   SAVE MEDICAL RECORD
============================== */

medicalRecordForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        if (!doctorId || !consultationId) {

            showError(
                "Invalid consultation information."
            );

            return;

        }


        const medicalCondition =
            document.getElementById(
                "medicalCondition"
            ).value.trim();


        const recordNotes =
            document.getElementById(
                "recordNotes"
            ).value.trim();


        if (!medicalCondition) {

            showError(
                "Please enter the medical condition."
            );

            return;

        }


        const accessToken =
            getAccessToken();


        saveRecordButton.disabled =
            true;


        saveRecordButton.textContent =
            "Saving...";


        try {

            const response =
                await fetch(

                    `${API_BASE_URL}/doctor/consultations/${doctorId}/${consultationId}/medical-record/`,

                    {

                        method: "POST",

                        headers: {

                            "Authorization":
                                `Bearer ${accessToken}`,

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                medical_condition:
                                    medicalCondition,

                                notes:
                                    recordNotes

                            })

                    }

                );


            /* ==========================
               TOKEN EXPIRED
            ========================== */

            if (response.status === 401) {

                const refreshed =
                    await refreshAccessToken();


                if (refreshed) {

                    saveRecordButton.disabled =
                        false;

                    saveRecordButton.textContent =
                        "Save Medical Record";


                    return medicalRecordForm.requestSubmit();

                }


                logout();

                return;

            }


            const data =
                await response.json();


            console.log(
                "Medical record response:",
                data
            );


            if (!response.ok) {

                showError(

                    data.error ||

                    data.detail ||

                    "Unable to save medical record."

                );

                return;

            }


            /* ==========================
               SUCCESS
            ========================== */

            alert(
                "Medical record saved successfully."
            );


            window.location.href =
                "appointment.html";

        }


        catch (error) {

            console.error(
                "Medical record error:",
                error
            );


            showError(
                error.message
            );

        }


        finally {

            saveRecordButton.disabled =
                false;


            saveRecordButton.textContent =
                "Save Medical Record";

        }

    }
);


/* ==============================
   ERROR
============================== */

function showError(message) {

    errorMessage.style.display =
        "block";


    errorMessage.textContent =
        message;

}


/* ==============================
   BACK
============================== */

function goBack() {

    window.location.href =
        "appointment.html";

}
