const API_BASE_URL = "http://127.0.0.1:8000";

requireLogin();


/* -----------------------------
   GET URL PARAMETERS
----------------------------- */

const params =
    new URLSearchParams(window.location.search);

const appointmentId =
    params.get("appointment_id");

const doctorId =
    localStorage.getItem("doctor_id");


/* -----------------------------
   ELEMENTS
----------------------------- */

const consultationForm =
    document.getElementById("consultationForm");

const errorMessage =
    document.getElementById("errorMessage");

const doctorName =
    localStorage.getItem("doctor_name");


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

if (!doctorId || !appointmentId) {

    showError(
        "Invalid appointment information."
    );

}


/* -----------------------------
   LOAD PATIENT INFORMATION
----------------------------- */

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

    window.location.href =
        `patient.html?appointment_id=${appointmentId}`;

}


/* -----------------------------
   INITIAL LOAD
----------------------------- */

loadPatientInfo();