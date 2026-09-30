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


const prescriptionId =
    params.get("prescription_id");


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

            test_name:
                testName,

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


    const accessToken =
        getAccessToken();


    saveLabTestButton.disabled =
        true;


    saveLabTestButton.textContent =
        "Saving...";


    try {

        const response =
            await fetch(

                `${API_BASE_URL}/doctor/consultations/${doctorId}/${consultationId}/lab-test/`,

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

                            tests:
                                labTests

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

                saveLabTestButton.disabled =
                    false;

                saveLabTestButton.textContent =
                    "Save Lab Test Request";


                return saveLabTests();

            }


            logout();

            return;

        }


        const data =
            await response.json();


        console.log(
            "Lab test response:",
            data
        );


        if (!response.ok) {

            showError(

                data.error ||

                data.detail ||

                "Unable to save laboratory test request."

            );

            return;

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

    window.location.href =
        `consultation.html?appointment_id=${localStorage.getItem("appointment_id") || ""}`;

}