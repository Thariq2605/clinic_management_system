const API_BASE_URL =
    "http://127.0.0.1:8000";


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

if (!doctorId || !consultationId) {

    showError(
        "Invalid consultation information."
    );

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

            medicine_id:
                Number(medicineId),

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

                        Medicine ID:
                        ${medicine.medicine_id}

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

    window.location.href =
        `consultation.html?appointment_id=${localStorage.getItem("appointment_id") || ""}`;

}