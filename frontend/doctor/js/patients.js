const API_BASE_URL = "http://127.0.0.1:8000";

requireLogin();

const doctorId = localStorage.getItem("doctor_id");

const searchInput = document.getElementById("patientSearch");

const loadingMessage =
    document.getElementById("loadingMessage");

const errorMessage =
    document.getElementById("errorMessage");

const resultsCard =
    document.getElementById("resultsCard");

const resultsContainer =
    document.getElementById("resultsContainer");

const resultText =
    document.getElementById("resultText");

const noResults =
    document.getElementById("noResults");


// ---------------------------------------------
// SEARCH PATIENTS
// ---------------------------------------------

async function searchPatients() {

    const searchValue =
        searchInput.value.trim();

    if (!searchValue) {

        showError(
            "Please enter Patient ID, name or phone number."
        );

        return;
    }


    if (!doctorId) {

        showError(
            "Doctor information is missing. Please login again."
        );

        return;
    }


    loadingMessage.style.display = "block";

    errorMessage.style.display = "none";

    resultsCard.style.display = "none";

    noResults.style.display = "none";


    const accessToken = getAccessToken();


    try {

        const response = await fetch(
            `${API_BASE_URL}/doctor/patients/${doctorId}/search/?search=${encodeURIComponent(searchValue)}`,
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


        // ACCESS TOKEN EXPIRED
        if (response.status === 401) {

            const refreshed =
                await refreshAccessToken();

            if (refreshed) {

                return searchPatients();

            }

            logout();

            return;
        }


        const data = await response.json();


        if (response.status === 403) {

            showError(
                data.error ||
                "You are not authorized to search patients."
            );

            return;
        }


        if (!response.ok) {

            showError(
                data.error ||
                "Unable to search patients."
            );

            return;
        }


        const results =
            data.results || [];


        if (results.length === 0) {

            noResults.style.display = "block";

            return;
        }


        displayResults(results);

    }

    catch (error) {

        console.error(
            "Patient search error:",
            error
        );

        showError(
            "Unable to connect to the server."
        );

    }

    finally {

        loadingMessage.style.display = "none";

    }

}


// ---------------------------------------------
// DISPLAY RESULTS
// ---------------------------------------------

function displayResults(results) {

    resultsCard.style.display = "block";

    noResults.style.display = "none";

    resultsContainer.innerHTML = "";


    resultText.textContent =
        `${results.length} patient${results.length !== 1 ? "s" : ""} found`;


    results.forEach(patient => {

        const row =
            document.createElement("div");


        row.style.cssText = `
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:18px 20px;
            border-top:1px solid #edf1f6;
        `;


        row.innerHTML = `

            <div style="
                display:flex;
                align-items:center;
                gap:15px;
            ">

                <div style="
                    width:45px;
                    height:45px;
                    border-radius:50%;
                    background:#eaf1ff;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:#2563eb;
                    font-weight:600;
                ">
                    ${getInitial(patient.full_name)}
                </div>


                <div>

                    <strong>
                        ${patient.full_name}
                    </strong>

                    <div style="
                        margin-top:5px;
                        font-size:13px;
                        color:#718096;
                    ">

                        Patient ID:
                        ${patient.patient_id}

                    </div>


                    <div style="
                        margin-top:3px;
                        font-size:13px;
                        color:#718096;
                    ">

                        Phone:
                        ${patient.mobile_number || "-"}

                    </div>

                </div>

            </div>


            <button
                class="primary-btn"
                onclick="viewPatient(${patient.appointment_id})"
            >
                View Patient
            </button>

        `;


        resultsContainer.appendChild(row);

    });

}


// ---------------------------------------------
// VIEW PATIENT DETAILS
// ---------------------------------------------

function viewPatient(appointmentId) {

    if (!appointmentId ||
        appointmentId === "null" ||
        appointmentId === "undefined") {

        showError(
            "This patient does not have a valid appointment."
        );

        return;
    }

    localStorage.setItem("current_appointment_id", String(appointmentId));

    window.location.href =
        `patient.html?appointment_id=${appointmentId}&from=patients`;

}


// ---------------------------------------------
// ENTER KEY SEARCH
// ---------------------------------------------

searchInput.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {

            searchPatients();

        }

    }
);


// ---------------------------------------------
// ERROR
// ---------------------------------------------

function showError(message) {

    loadingMessage.style.display = "none";

    resultsCard.style.display = "none";

    noResults.style.display = "none";

    errorMessage.style.display = "block";

    errorMessage.textContent = message;

}
