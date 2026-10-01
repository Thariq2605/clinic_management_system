const API_BASE_URL =
    "http://127.0.0.1:8000";

async function loadMedicines() {

    const medicineSelect = document.getElementById("medicineId");

    if (!medicineSelect) {
        return;
    }

    const token = getAccessToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {

        const response = await fetch(
            `${API_BASE_URL}/doctor/medicines/`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (response.status === 401) {
            if (await refreshAccessToken()) return loadMedicines();
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load medicines");
        }

        const medicines = await response.json();

        medicineSelect.innerHTML =
            `<option value="">Select medicine</option>`;

        medicines.forEach(function (medicine) {

            const option = document.createElement("option");

            option.value = medicine.medicine_id;

            option.textContent =
                `${medicine.medicine_name} - ${medicine.manufacturer}`;

            if (medicine.quantity <= 0) {
                option.disabled = true;
                option.textContent += " - Out of stock";
            }

            medicineSelect.appendChild(option);
        });

    } catch (error) {

        console.error(
            "Medicine loading error:",
            error
        );

    }
}


requireLogin();


/* ==============================
   GET PARAMETERS
============================== */

const params =
    new URLSearchParams(
        window.location.search
    );


const consultationId =
    params.get("consultation_id");
const pageMode = params.get("mode");
const requestedPrescriptionId = params.get("prescription_id");


const doctorId =
    localStorage.getItem(
        "doctor_id"
    );


/* ==============================
   ELEMENTS
============================== */

const errorMessage =
    document.getElementById(
        "errorMessage"
    );


const medicineForm =
    document.getElementById(
        "medicineForm"
    );


const medicineList =
    document.getElementById(
        "medicineList"
    );


const addMedicineButton =
    document.getElementById(
        "addMedicineButton"
    );


const savePrescriptionButton =
    document.getElementById(
        "savePrescriptionButton"
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
   MEDICINES ARRAY
============================== */

let medicines = [];


/* ==============================
   CHECK URL
============================== */

if (!doctorId) {
    showError("Doctor information is missing. Please log in again.");
} else if ((pageMode === "history" && !consultationId) || pageMode === "view" || (requestedPrescriptionId && !consultationId)) {
    document.querySelector(".prescription-patient-card").style.display = "none";
    document.querySelector(".page-header p").textContent = "Previously created prescriptions";
    document.getElementById("prescriptionFormCard").style.display = "none";
    document.getElementById("prescriptionHistory").style.display = "block";
    loadPrescriptionHistory();
} else if (!consultationId) {
    document.querySelector(".prescription-patient-card").style.display = "none";
    document.getElementById("prescriptionFormCard").style.display = "none";
    document.getElementById("prescriptionHome").style.display = "block";
    loadPrescriptionOptions();
} else {
    loadConsultationContext();
}

async function loadPrescriptionOptions() {
    const target = document.getElementById("consultationOptions");
    try {
        const headers = { Authorization: `Bearer ${getAccessToken()}` };
        let [consultationResponse, prescriptionResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/`, { headers }),
            fetch(`${API_BASE_URL}/doctor/prescriptions/${doctorId}/`, { headers })
        ]);
        if ((consultationResponse.status === 401 || prescriptionResponse.status === 401) && await refreshAccessToken()) return loadPrescriptionOptions();
        if (!consultationResponse.ok || !prescriptionResponse.ok) throw new Error("Unable to load consultation information.");
        const [consultations, prescriptions] = await Promise.all([consultationResponse.json(), prescriptionResponse.json()]);
        const existing = new Set(prescriptions.map(item => String(item.consultation)));
        const available = consultations.filter(item => !existing.has(String(item.consultation_id)));
        if (!available.length) { target.innerHTML = `<div class="empty-state"><h3>No consultations need a prescription</h3><p>All consultations have a prescription, or none have been recorded yet.</p></div>`; return; }
        target.innerHTML = available.map(item => { const patient = item.patientdetails || {}; return `<div class="consultation-row"><div class="consultation-patient"><div class="patient-info"><h3>${escapeHtml(patient.full_name || "Patient")}</h3><span>Patient ID: ${escapeHtml(patient.patient_id)} · Consultation #${item.consultation_id}</span></div></div><div class="consultation-column"><span class="column-label">Date</span><strong>${escapeHtml(item.consultation_date)}</strong></div><div class="consultation-column diagnosis-column"><span class="column-label">Diagnosis</span><strong>${escapeHtml(item.diagnosis)}</strong></div><button class="primary-btn" onclick="createPrescriptionFor(${item.consultation_id})">Create Prescription</button></div>`; }).join("");
    } catch (error) { target.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
}

function createPrescriptionFor(id) { window.location.href = `prescription.html?consultation_id=${encodeURIComponent(id)}`; }
function escapeHtml(value) { return String(value ?? "-").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])); }

async function loadPrescriptionHistory() {
    const target = document.getElementById("prescriptionHistoryList");
    try {
        const response = await fetch(`${API_BASE_URL}/doctor/prescriptions/${doctorId}/`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (response.status === 401 && await refreshAccessToken()) return loadPrescriptionHistory();
        if (!response.ok) throw new Error(`Unable to load prescriptions (${response.status}).`);
        const list = await response.json();
        if (!list.length) { target.textContent = "No prescriptions found."; return; }
        const selected = requestedPrescriptionId
            ? list.filter(item => String(item.prescription_id) === requestedPrescriptionId)
            : consultationId
                ? list.filter(item => String(item.consultation) === String(consultationId))
                : list;
        if (requestedPrescriptionId && !selected.length) { target.textContent = "Prescription not found."; return; }
        target.innerHTML = selected.map(item => `<div class="history-item"><strong>Prescription #${item.prescription_id}</strong> · Patient ${item.patient_name || `#${item.patient}`} · Consultation #${item.consultation} · ${item.prescription_date}<ul>${(item.medicines || []).map(m => `<li>${m.medicine_name || `Medicine #${m.medicine}`} — ${m.dosage}; ${m.frequency}; ${m.duration} days</li>`).join("")}</ul>${!requestedPrescriptionId ? `<button class="view-button" onclick="window.location.href='prescription.html?prescription_id=${encodeURIComponent(item.prescription_id)}&mode=view'">View</button>` : ""}</div>`).join("");
    } catch (error) { showError(error.message); }
}

async function loadConsultationContext() {
    try {
        const response = await fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (response.status === 401 && await refreshAccessToken()) return loadConsultationContext();
        if (!response.ok) return;
        const list = await response.json();
        const item = list.find(row => String(row.consultation_id) === String(consultationId));
        if (!item) return;
        const patient = item.patientdetails || {};
        document.getElementById("patientName").textContent = patient.full_name || "Patient";
        document.getElementById("patientId").textContent = patient.patient_id ?? "-";
        document.getElementById("patientInitial").textContent = getInitial(patient.full_name);
    } catch (error) { console.error("Consultation context error:", error); }
}


/* ==============================
   ADD MEDICINE
============================== */

addMedicineButton.addEventListener(
    "click",
    function () {

        const medicineId =
            document.getElementById(
                "medicineId"
            ).value.trim();


        const dosage =
            document.getElementById(
                "dosage"
            ).value.trim();


        const frequency =
            document.getElementById(
                "frequency"
            ).value.trim();


        const duration =
            document.getElementById(
                "duration"
            ).value.trim();


        const instructions =
            document.getElementById(
                "instructions"
            ).value.trim();


        if (
            !medicineId ||
            !dosage ||
            !frequency ||
            !duration
        ) {

            showError(
                "Please fill all required medicine fields."
            );

            return;

        }


        const medicine = {

            medicine:
                Number(medicineId),

            medicine_name:
                document.getElementById("medicineId").selectedOptions[0]?.textContent || `Medicine #${medicineId}`,

            dosage:
                dosage,

            frequency:
                frequency,

            duration:
                Number(duration),

            instructions:
                instructions

        };


        medicines.push(
            medicine
        );


        displayMedicines();


        medicineForm.reset();


        clearError();

    }
);


/* ==============================
   DISPLAY MEDICINES
============================== */

function displayMedicines() {

    medicineList.innerHTML = "";


    if (medicines.length === 0) {

        medicineList.innerHTML = `

            <div class="empty-medicine">

                No medicines added yet.

            </div>

        `;

        return;

    }


    medicines.forEach(
        function (medicine, index) {

            const medicineElement =
                document.createElement(
                    "div"
                );


            medicineElement.className =
                "medicine-item";


            medicineElement.innerHTML = `

                <div class="medicine-info">

                    <div class="medicine-name">

                        ${medicine.medicine_name || `Medicine #${medicine.medicine}`}

                    </div>

                    <div class="medicine-details">

                        <strong>Dosage:</strong>
                        ${medicine.dosage}

                        <br>

                        <strong>Frequency:</strong>
                        ${medicine.frequency}

                        <br>

                        <strong>Duration:</strong>
                        ${medicine.duration} days

                        <br>

                        <strong>Instructions:</strong>
                        ${medicine.instructions || "-"}

                    </div>

                </div>


                <button
                    type="button"
                    class="remove-medicine"
                    onclick="removeMedicine(${index})"
                >

                    Remove

                </button>

            `;


            medicineList.appendChild(
                medicineElement
            );

        }
    );

}


/* ==============================
   REMOVE MEDICINE
============================== */

function removeMedicine(index) {

    medicines.splice(
        index,
        1
    );


    displayMedicines();

}


/* ==============================
   SAVE PRESCRIPTION
============================== */

savePrescriptionButton.addEventListener(
    "click",
    savePrescription
);


async function savePrescription() {

    if (!doctorId || !consultationId) {

        showError(
            "Invalid consultation information."
        );

        return;

    }


    if (medicines.length === 0) {

        showError(
            "Please add at least one medicine."
        );

        return;

    }


    const accessToken =
        getAccessToken();


    savePrescriptionButton.disabled =
        true;


    savePrescriptionButton.textContent =
        "Saving...";


    try {

        const response =
            await fetch(

                `${API_BASE_URL}/doctor/consultations/${doctorId}/${consultationId}/prescription/`,

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

                            medicines:
                                medicines

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

                savePrescriptionButton.disabled =
                    false;

                savePrescriptionButton.textContent =
                    "Save Prescription";


                return savePrescription();

            }


            logout();

            return;

        }


        const data =
            await response.json();


        console.log(
            "Prescription response:",
            data
        );


        if (!response.ok) {

            showError(

                data.error ||

                data.detail ||

                "Unable to save prescription."

            );

            return;

        }


        /* ==========================
           SUCCESS
        ========================== */

        alert(
            "Prescription saved successfully."
        );


        /*
           Move to Lab Test page.
        */

        const prescriptionId =
            data.prescription_id ||
            data.id;


        if (prescriptionId) {

            window.location.href =
                `labtest.html?consultation_id=${consultationId}&prescription_id=${prescriptionId}`;

        } else {

            window.location.href =
                `labtest.html?consultation_id=${consultationId}`;

        }


    }

    catch (error) {

        console.error(
            "Prescription error:",
            error
        );


        showError(
            error.message
        );

    }

    finally {

        savePrescriptionButton.disabled =
            false;


        savePrescriptionButton.textContent =
            "Save Prescription";

    }

}


/* ==============================
   ERROR
============================== */

function showError(message) {

    errorMessage.style.display =
        "block";


    errorMessage.textContent =
        message;

}


function clearError() {

    errorMessage.style.display =
        "none";

}


/* ==============================
   BACK
============================== */

function goBack() {
    window.location.href = consultationId ? `consultation.html?consultation_id=${consultationId}&mode=view` : "consultation.html";
}

document.addEventListener("DOMContentLoaded", function () {
    if (consultationId) loadMedicines();
});
