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

if (!doctorId || !consultationId) {

    showError(
        "Invalid consultation information."
    );

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