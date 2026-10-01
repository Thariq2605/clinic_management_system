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

if (!doctorId) {
    showError("Doctor information is missing. Please log in again.");
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

                `${API_BASE_URL}/doctor/history/${doctorId}/${patientId ? `?patient_id=${encodeURIComponent(patientId)}` : ""}`,

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

    const records = data.medical_history || [];
    const consultations = data.consultations || [];
    const prescriptions = data.prescriptions || [];
    const labTests = data.lab_tests || [];
    const patient = records[0] || consultations[0]?.patientdetails || prescriptions[0] || labTests[0] || {};


    /* ==========================
       PATIENT
    ========================== */

    document.getElementById(
        "patientName"
    ).textContent =
        patient.patient_name || patient.full_name || (patientId ? "Patient Medical History" : "All Patient Histories");


    document.getElementById(
        "patientId"
    ).textContent =
        patient.patient ?? patient.patient_id ?? patientId ?? "-";


    document.getElementById(
        "patientInitial"
    ).textContent =
        getInitial(
            patient.patient_name || patient.full_name
        );


    /* ==========================
       CONSULTATIONS
    ========================== */

    displayConsultations(consultations);


    /* ==========================
       PRESCRIPTIONS
    ========================== */

    displayMedicalRecords(records);
    displayPrescriptions(prescriptions);
    displayLabTests(labTests);

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


            const date = consultation.consultation_date || "-";


            const diagnosis =
                consultation.diagnosis ||
                "-";


            const symptoms = consultation.symptoms || "-";


            const notes =
                consultation.notes ||
                "-";


            item.innerHTML = `

                <div class="history-item-header">

                    <strong>
                        Consultation #${consultation.consultation_id ?? "-"} · ${consultation.patientdetails?.full_name || "Patient"} (#${consultation.patientdetails?.patient_id ?? "-"})
                    </strong>

                    <span class="history-date">

                        ${formatDate(date)}

                    </span>

                </div>


                <div class="history-label">

                    Consultation

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


function displayMedicalRecords(records) {
    const container = document.getElementById("medicalRecordHistory");
    container.innerHTML = "";
    if (!records.length) {
        container.innerHTML = `<div class="history-empty">No separate medical records have been saved.</div>`;
        return;
    }
    records.forEach(record => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `<div class="history-item-header"><strong>Record #${record.record_id} · ${record.patient_name || `Patient #${record.patient}`}</strong><span class="history-date">${formatDate(record.created_at)}</span></div><div class="history-label">Consultation #${record.consultation}</div><div class="history-label">Diagnosis</div><div class="history-value">${record.diagnosis || "-"}</div><div class="history-label">Notes</div><div class="history-value">${record.medical_notes || "-"}</div>`;
        container.appendChild(item);
    });
}

function displayLabTests(requests) {
    const container = document.getElementById("labTestHistory");
    container.innerHTML = "";
    if (!requests.length) {
        container.innerHTML = `<div class="history-empty">No lab tests have been requested.</div>`;
        return;
    }
    requests.forEach(request => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `<div class="history-item-header"><strong>${request.test_name || `Test #${request.test}`} · ${request.patient_name || `Patient #${request.patient_id}`}</strong><span>Consultation #${request.consultation_id}</span></div><div class="history-value">${request.instructions || "No instructions"}</div>`;
        container.appendChild(item);
    });
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

                <div>Patient: ${prescription.patient_name || `#${prescription.patient}`} · Consultation #${prescription.consultation}</div>


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

async function loadPrescriptionHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/doctor/prescriptions/${doctorId}/`, {
            headers: { Authorization: `Bearer ${getAccessToken()}` }
        });
        if (response.status === 401 && await refreshAccessToken()) return loadPrescriptionHistory();
        if (!response.ok) throw new Error("Unable to load prescription history.");
        let prescriptions = await response.json();
        if (patientId) prescriptions = prescriptions.filter(item => String(item.patient) === String(patientId));
        displayPrescriptions(prescriptions);
    } catch (error) {
        console.error("Prescription history error:", error);
        displayPrescriptions([]);
    }
}
