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


const patientId =
    params.get("patient_id");


const doctorId =
    localStorage.getItem(
        "doctor_id"
    );


/* ==============================
   ELEMENTS
============================== */

const loadingMessage =
    document.getElementById(
        "loadingMessage"
    );


const historyContent =
    document.getElementById(
        "historyContent"
    );


const errorMessage =
    document.getElementById(
        "errorMessage"
    );


const doctorName =
    localStorage.getItem(
        "doctor_name"
    );


/* ==============================
   DOCTOR NAME
============================== */

if (doctorName) {

    document.getElementById(
        "doctorName"
    ).textContent =
        doctorName;

}


/* ==============================
   CHECK PATIENT
============================== */

if (!doctorId || !patientId) {

    showError(
        "Invalid patient information."
    );

} else {

    loadMedicalHistory();

}


/* ==============================
   LOAD HISTORY
============================== */

async function loadMedicalHistory() {

    const accessToken =
        getAccessToken();


    try {

        const response =
            await fetch(

                `${API_BASE_URL}/doctor/patients/${doctorId}/${patientId}/history/`,

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


        /* ==========================
           TOKEN EXPIRED
        ========================== */

        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();


            if (refreshed) {

                return loadMedicalHistory();

            }


            logout();

            return;

        }


        /* ==========================
           OTHER ERROR
        ========================== */

        if (!response.ok) {

            const data =
                await response.json();

            throw new Error(

                data.error ||

                data.detail ||

                "Unable to load medical history."

            );

        }


        const data =
            await response.json();


        console.log(
            "Medical history response:",
            data
        );


        displayHistory(data);

    }


    catch (error) {

        console.error(
            "Medical history error:",
            error
        );


        showError(
            error.message
        );

    }

}


/* ==============================
   DISPLAY HISTORY
============================== */

function displayHistory(data) {

    loadingMessage.style.display =
        "none";


    historyContent.style.display =
        "block";


    /*
       The exact response structure
       will be confirmed from your
       Django API.

       These mappings support common
       response structures.
    */

    const patient =
        data.patient || {};


    const consultations =
        data.consultations ||
        data.consultation_history ||
        data.history ||
        [];


    const prescriptions =
        data.prescriptions ||
        data.prescription_history ||
        [];


    /* ==========================
       PATIENT
    ========================== */

    document.getElementById(
        "patientName"
    ).textContent =
        patient.full_name ||
        data.patient_name ||
        "-";


    document.getElementById(
        "patientId"
    ).textContent =
        patient.patient_id ||
        patientId;


    document.getElementById(
        "patientInitial"
    ).textContent =
        getInitial(
            patient.full_name ||
            data.patient_name
        );


    /* ==========================
       CONSULTATIONS
    ========================== */

    displayConsultations(
        consultations
    );


    /* ==========================
       PRESCRIPTIONS
    ========================== */

    displayPrescriptions(
        prescriptions
    );

}


/* ==============================
   CONSULTATIONS
============================== */

function displayConsultations(
    consultations
) {

    const container =
        document.getElementById(
            "consultationHistory"
        );


    container.innerHTML = "";


    if (!Array.isArray(consultations) ||
        consultations.length === 0) {

        container.innerHTML = `

            <div class="history-empty">

                No previous consultations found.

            </div>

        `;

        return;

    }


    consultations.forEach(
        function (consultation) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "history-item";


            const date =
                consultation.consultation_date ||
                consultation.date ||
                consultation.created_at ||
                "-";


            const diagnosis =
                consultation.diagnosis ||
                "-";


            const symptoms =
                consultation.symptoms ||
                "-";


            const notes =
                consultation.notes ||
                "-";


            item.innerHTML = `

                <div class="history-item-header">

                    <strong>
                        Consultation
                    </strong>

                    <span class="history-date">

                        ${formatDate(date)}

                    </span>

                </div>


                <div class="history-label">

                    Symptoms

                </div>

                <div class="history-value">

                    ${symptoms}

                </div>


                <div class="history-label">

                    Diagnosis

                </div>

                <div class="history-value">

                    ${diagnosis}

                </div>


                <div class="history-label">

                    Notes

                </div>

                <div class="history-value">

                    ${notes}

                </div>

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* ==============================
   PRESCRIPTIONS
============================== */

function displayPrescriptions(
    prescriptions
) {

    const container =
        document.getElementById(
            "prescriptionHistory"
        );


    container.innerHTML = "";


    if (!Array.isArray(prescriptions) ||
        prescriptions.length === 0) {

        container.innerHTML = `

            <div class="history-empty">

                No previous prescriptions found.

            </div>

        `;

        return;

    }


    prescriptions.forEach(
        function (prescription) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "prescription-history-item";


            const prescriptionId =
                prescription.prescription_id ||
                prescription.id ||
                "-";


            const date =
                prescription.prescription_date ||
                prescription.date ||
                "-";


            const medicines =
                prescription.medicines ||
                prescription.prescription_medicines ||
                [];


            let medicineHTML = "";


            if (Array.isArray(medicines) &&
                medicines.length > 0) {

                medicines.forEach(
                    function (medicine) {

                        medicineHTML += `

                            <div class="medicine-history-row">

                                <strong>

                                    ${medicine.medicine_name ||
                                      medicine.medicine ||
                                      "Medicine"}

                                </strong>

                                <br>

                                Dosage:
                                ${medicine.dosage || "-"}

                                <br>

                                Frequency:
                                ${medicine.frequency || "-"}

                                <br>

                                Duration:
                                ${medicine.duration || "-"}
                                days

                                <br>

                                Instructions:
                                ${medicine.instructions || "-"}

                            </div>

                        `;

                    }
                );

            } else {

                medicineHTML = `

                    <div class="history-empty">

                        No medicine details available.

                    </div>

                `;

            }


            item.innerHTML = `

                <div class="prescription-history-header">

                    <span class="prescription-id">

                        Prescription #${prescriptionId}

                    </span>


                    <span class="history-date">

                        ${formatDate(date)}

                    </span>

                </div>


                ${medicineHTML}

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* ==============================
   DATE FORMAT
============================== */

function formatDate(date) {

    if (!date ||
        date === "-") {

        return "-";

    }


    const parsed =
        new Date(date);


    if (isNaN(parsed)) {

        return date;

    }


    return parsed.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* ==============================
   ERROR
============================== */

function showError(message) {

    loadingMessage.style.display =
        "none";


    historyContent.style.display =
        "none";


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