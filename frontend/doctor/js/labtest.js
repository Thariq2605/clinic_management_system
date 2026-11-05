const API_BASE_URL =
    "http://127.0.0.1:8000";

async function loadLabTests() {

    const testSelect = document.getElementById("testName");

    if (!testSelect) {
        return;
    }

    const accessToken = getAccessToken();

    if (!accessToken) {
        window.location.href = "../login.html";
        return;
    }

    try {

        const response = await fetch(
            `${API_BASE_URL}/doctor/lab-tests/`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (response.status === 401) {
            if (await refreshAccessToken()) return loadLabTests();
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load laboratory tests");
        }

        const tests = await response.json();

        console.log("Lab Tests API Response:", tests);

        testSelect.innerHTML =
            `<option value="">Select laboratory test</option>`;

        tests.forEach(function (test) {

            const option = document.createElement("option");

            option.value = test.test_id;

            option.textContent = test.test_name;

            testSelect.appendChild(option);
        });

    } catch (error) {

        console.error(
            "Lab test loading error:",
            error
        );
    }
}

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


const prescriptionId =
    params.get("prescription_id");
const requestedLabTestId = params.get("lab_test_id");


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


const testNameInput =
    document.getElementById(
        "testName"
    );


const priorityInput =
    document.getElementById(
        "priority"
    );


const instructionsInput =
    document.getElementById(
        "testInstructions"
    );


const labTestList =
    document.getElementById(
        "labTestList"
    );


const addTestButton =
    document.getElementById(
        "addTestButton"
    );


const saveLabTestButton =
    document.getElementById(
        "saveLabTestButton"
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

if (!doctorId) {
    showError("Doctor information is missing. Please log in again.");
} else if (params.get("mode") === "history" || params.get("mode") === "view" || (requestedLabTestId && !consultationId)) {
    document.querySelector(".lab-patient-card").style.display = "none";
    document.querySelector(".page-header p").textContent = "Previously requested laboratory tests";
    document.getElementById("labTestHome").style.display = "none";
    document.getElementById("labTestFormCard").style.display = "none";
    document.getElementById("labTestHistory").style.display = "block";
    loadLabTestHistory();
} else if (!consultationId) {
    document.querySelector(".lab-patient-card").style.display = "none";
    document.querySelector(".page-header p").textContent = "Select a prescription to create a lab test request";
    document.getElementById("labTestFormCard").style.display = "none";
    document.getElementById("labTestHome").style.display = "block";
    loadLabPrescriptionOptions();
} else {
    loadConsultationContext();
}

async function loadLabPrescriptionOptions() {
    const target = document.getElementById("prescriptionOptions");
    try {
        const response = await fetch(`${API_BASE_URL}/doctor/prescriptions/${doctorId}/`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (response.status === 401 && await refreshAccessToken()) return loadLabPrescriptionOptions();
        if (!response.ok) throw new Error(`Unable to load prescriptions (${response.status}).`);
        const prescriptions = await response.json();
        if (!prescriptions.length) { target.innerHTML = `<div class="empty-state"><h3>No prescriptions available</h3><p>Create a prescription from a consultation before requesting lab tests.</p></div>`; return; }
        target.innerHTML = prescriptions.map(item => `<div class="consultation-row"><div class="consultation-patient"><div class="patient-info"><h3>${escapeHtml(item.patient_name || `Patient #${item.patient}`)}</h3><span>Consultation #${item.consultation} · Prescription #${item.prescription_id}</span></div></div><div class="consultation-column"><span class="column-label">Date</span><strong>${escapeHtml(item.prescription_date)}</strong></div><button class="primary-btn" onclick="createLabRequest(${item.consultation}, ${item.prescription_id})">Request Lab Tests</button></div>`).join("");
    } catch (error) { target.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
}

function createLabRequest(consultation, prescription) {
    window.location.href = `labtest.html?consultation_id=${encodeURIComponent(consultation)}&prescription_id=${encodeURIComponent(prescription)}`;
}

function escapeHtml(value) { return String(value ?? "-").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])); }

async function loadLabTestHistory() {
    const target = document.getElementById("labTestHistoryList");
    try {
        const response = await fetch(`${API_BASE_URL}/doctor/lab-test-requests/${doctorId}/`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (response.status === 401 && await refreshAccessToken()) return loadLabTestHistory();
        if (!response.ok) throw new Error(`Unable to load lab test requests (${response.status}).`);
        const list = await response.json();
        if (!list.length) { target.textContent = "No lab test requests found."; return; }
        const selected = requestedLabTestId
            ? list.filter(item => String(item.prescription_lab_test_id) === requestedLabTestId)
            : consultationId
                ? list.filter(item => String(item.consultation_id) === String(consultationId))
                : prescriptionId
                    ? list.filter(item => String(item.prescription) === String(prescriptionId))
                    : list;
        if (requestedLabTestId && !selected.length) { target.textContent = "Lab test request not found."; return; }
        target.innerHTML = selected.map(item => `<div class="history-item"><strong>${item.test_name || `Test #${item.test}`}</strong> · Patient ${item.patient_name || `#${item.patient_id}`} · Consultation #${item.consultation_id}<p>${item.instructions || "No instructions"}</p>${!requestedLabTestId ? `<button class="view-button" onclick="window.location.href='labtest.html?lab_test_id=${encodeURIComponent(item.prescription_lab_test_id)}&mode=view'">View</button>` : ""}</div>`).join("");
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
   CONSULTATION ID
============================== */

if (consultationId) {

    document.getElementById(
        "consultationId"
    ).textContent =
        consultationId;

}


/* ==============================
   LAB TEST ARRAY
============================== */

let labTests = [];


/* ==============================
   ADD TEST
============================== */

addTestButton.addEventListener(
    "click",
    function () {

        const testName =
            testNameInput
                .value
                .trim();


        const priority =
            priorityInput
                .value;


        const instructions =
            instructionsInput
                .value
                .trim();


        if (!testName) {

            showError(
                "Please enter the test name."
            );

            return;

        }


        const test = {
            test: Number(testName),
            test_name: testNameInput.selectedOptions[0]?.textContent || testName,

            priority:
                priority,

            instructions:
                instructions

        };


        labTests.push(
            test
        );


        displayLabTests();


        testNameInput.value = "";

        priorityInput.value =
            "Normal";

        instructionsInput.value =
            "";


        clearError();

    }
);


/* ==============================
   DISPLAY TESTS
============================== */

function displayLabTests() {

    labTestList.innerHTML = "";


    if (labTests.length === 0) {

        labTestList.innerHTML = `

            <div class="empty-lab-test">

                No laboratory tests added yet.

            </div>

        `;

        return;

    }


    labTests.forEach(
        function (test, index) {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "lab-test-item";


            element.innerHTML = `

                <div class="lab-test-info">

                    <div class="lab-test-name">

                        ${test.test_name}

                    </div>

                    <div class="lab-test-details">

                        <strong>
                            Priority:
                        </strong>

                        ${test.priority}

                        <br>

                        <strong>
                            Instructions:
                        </strong>

                        ${test.instructions || "-"}

                    </div>

                </div>


                <button
                    type="button"
                    class="remove-test"
                    onclick="removeLabTest(${index})"
                >

                    Remove

                </button>

            `;


            labTestList.appendChild(
                element
            );

        }
    );

}


/* ==============================
   REMOVE TEST
============================== */

function removeLabTest(index) {

    labTests.splice(
        index,
        1
    );


    displayLabTests();

}


/* ==============================
   SAVE
============================== */

saveLabTestButton.addEventListener(
    "click",
    saveLabTests
);


async function saveLabTests() {

    if (!doctorId ||
        !consultationId) {

        showError(
            "Invalid consultation information."
        );

        return;

    }


    if (labTests.length === 0) {

        showError(
            "Please add at least one laboratory test."
        );

        return;

    }


    saveLabTestButton.disabled =
        true;


    saveLabTestButton.textContent =
        "Saving...";


    try {

        for (const labTest of labTests) {
            let response = await fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/${consultationId}/lab-test/`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" },
                body: JSON.stringify({ test: labTest.test, instructions: labTest.instructions })
            });
            if (response.status === 401 && await refreshAccessToken()) {
                response = await fetch(`${API_BASE_URL}/doctor/consultations/${doctorId}/${consultationId}/lab-test/`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ test: labTest.test, instructions: labTest.instructions })
                });
            }
            if (response.status === 401) { logout(); return; }
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.detail || `Unable to save laboratory test request (${response.status}).`);
        }


        alert(
            "Lab test request saved successfully."
        );


        /*
           After lab test:

           go to Medical History
        */

        window.location.href =
            `medicalhistory.html?consultation_id=${consultationId}`;

    }


    catch (error) {

        console.error(
            "Lab test error:",
            error
        );


        showError(
            error.message
        );

    }


    finally {

        saveLabTestButton.disabled =
            false;


        saveLabTestButton.textContent =
            "Save Lab Test Request";

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
    if (consultationId) loadLabTests();
});
