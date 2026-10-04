# RECEPTIONIST MODULE IMPLEMENTATION PLAN

**Generated:** 2026-09-30  
**Repository Working Directory:** `E:\clinic_management_system-reception-new`  
**Current Branch:** `reception-new`  
**Reference Develop Source:** `E:\clinic_management_system-develop`  
**Scope:** Phase 0 & Phase 1 Analysis, Safety Guidelines, and Phased Roadmap

---

## 1. Current Project State

- **Branch:** `reception-new` tracking `origin/reception-new`.
- **Merge State:** An in-progress merge from `origin/main` (commit `c548bd3`) exists in the working tree, leaving 4 files with unmerged paths:
  - `clinic_mg_proj/clinic_mg_proj/settings.py`
  - `clinic_mg_proj/doctorapp/admin.py`
  - `clinic_mg_proj/lab_technicianapp/admin.py`
  - `clinic_mg_proj/pharmacistapp/admin.py`
- **Django System Check:** Passes cleanly (`python manage.py check` reports 0 issues).
- **Core Models:** 20 models consolidated in `core/models.py`. Models `DoctorAvailability` and `DoctorDailyTokenLimit` are **absent** from `core` in `origin/main` and `reception-new`.
- **URLs:** Root `clinic_mg_proj/urls.py` only mounts `admin/` and `doctor/`. The `receptionistapp.urls` are completely unmounted in the running application.

---

## 2. Existing Receptionist Functionality

The following functionality is already implemented within `clinic_mg_proj/receptionistapp/` and validated by its internal test suite (`receptionistapp/tests.py`):
1. **Authentication & Session Management:**
   - Login endpoint (`POST /login/`) verifying credentials, active User, active Staff, and active Receptionist record with role `receptionist`.
   - Logout endpoint (`POST /logout/`) flushing session.
   - CSRF token exposure (`GET /csrf/`) and CSRF enforcement on session requests.
   - Custom session authentication (`ReceptionistSessionAuthentication`) and permission enforcement (`IsReceptionistSession`).
2. **Patient Management:**
   - Patient registration (`POST /patients/`) with full validation of name, dob (must be in past), gender, phone, email, address, blood group, emergency contact.
   - Patient search (`GET /patients/`) by exact integer `patient_id` or partial match on `full_name`, `mobile_number`, or `email`.
   - Simultaneous phone + email duplicate detection.
3. **Department & Doctor Lookup:**
   - Department listing (`GET /departments/`) filtering active departments.
   - Doctor listing (`GET /doctors/`) filtering active doctors, with optional department filter (`?department=<id>`).
   - Doctor availability stub endpoint (`GET /doctors/<id>/availability/`) returning explicit status that doctor schedule is not currently configured.
4. **Appointment Booking & Token Allocation:**
   - Atomic appointment and bill creation (`POST /appointments/`) with row-level locking on doctor.
   - Sequential token generation (`1`, `2`, `3`...) per doctor per date.
   - Cancelled appointments do not reuse token numbers.
   - Department-doctor consistency validation.
   - Date and time validation (rejecting dates in the past, rejecting past times today).
5. **Billing & Payments:**
   - Consultation fee copied into initial `Bill` upon appointment creation.
   - Appointment listing (`GET /appointments/`) filtered by date and scoped to logged-in receptionist.
   - Appointment cancellation (`PATCH /appointments/<id>/`) restricted to `scheduled`/`confirmed` status; deactivates bills and prevents cancellation if payments exist.
   - Payment recording (`POST /appointments/<id>/payments/`) supporting partial and full payments, preventing overpayment, and updating bill and appointment statuses.

---

## 3. Missing Receptionist Functionality

Based on project requirements and the audit:
1. **Root Integration:** `receptionistapp.urls` is missing from `clinic_mg_proj/urls.py` under the prefix `api/receptionist/`.
2. **Public Endpoint Protection:** `csrf_token` and `receptionist_login` views lack `@authentication_classes([])` and `@permission_classes([AllowAny])`, leaving them vulnerable to interception by the global JWT authenticator if an invalid Bearer token is provided in headers.
3. **Patient Edit/Update:** No `PUT` or `PATCH` endpoint exists to modify patient details.
4. **Patient Deactivation/Activation:** No endpoint exists to toggle `is_active` on a patient record without deletion.
5. **Single Appointment Details:** No `GET /appointments/<id>/` endpoint exists to view an appointment's full details.
6. **Appointment Search:** No text search (`?search=`) exists on the appointments list.
7. **Appointment Multi-Field Filters:** Appointments can only be filtered by date, but not by doctor, department, or status.
8. **Payment History:** No `GET /appointments/<id>/payments/` endpoint exists to view transaction history.
9. **Same-Time Appointment Conflict Prevention:** No application-level validation prevents booking the same doctor or same patient at the exact same minute on the same date.
10. **Doctor Schedule & Availability (Schema-Blocked):** Doctor working days and shift hours cannot be queried or enforced because `DoctorAvailability` is not in `core/models.py`.
11. **Doctor Daily Token Cap (Schema-Blocked):** Maximum daily tokens per doctor cannot be enforced because `DoctorDailyTokenLimit` is not in `core/models.py`.

---

## 4. Existing Doctor Functionality (Must Be Preserved)

The Doctor module (`doctorapp`) is functional and must not be altered:
- **Authentication:** JWT-based using `rest_framework_simplejwt`. Login endpoint returns `access` and `refresh` tokens with `user_id`, `doctor_id`, and `role` claims.
- **Custom Authenticator:** `doctorapp.authentication.CustomJWTAuthentication` verifies `User` is active and resolves `user_id`.
- **Permission:** `doctorapp.permission.IsDoctor` enforces active doctor status and doctor ownership of routes with `doctor_id`.
- **Endpoints:**
  - `POST /doctor/login/`
  - `POST /doctor/token/refresh/`
  - `GET /doctor/dashboard/<doctor_id>/`
  - `GET /doctor/appointments/<doctor_id>/`
  - `GET /doctor/appointments/<doctor_id>/<appointment_id>/patient/`
  - `POST /doctor/appointments/<doctor_id>/<appointment_id>/consultation/`
  - `POST /doctor/consultations/<doctor_id>/<consultation_id>/prescription/`
  - `POST /doctor/consultations/<doctor_id>/<consultation_id>/lab-test/`
  - `GET /doctor/patients/<doctor_id>/<patient_id>/history/`
  - `POST /doctor/consultations/<doctor_id>/<consultation_id>/medical-record/`

---

## 5. Authentication Architecture

| Domain | Mechanism | Token/Cookie Storage | CSRF Protection | Intended Scope |
|---|---|---|---|---|
| **Doctor** | JWT (SimpleJWT) | Bearer Token in `Authorization` header | Stateless (No CSRF) | Doctor APIs (`/doctor/*`) |
| **Receptionist** | Django Session | Session cookie (`sessionid`) | Enforced (`csrftoken` cookie / header) | Receptionist APIs (`/api/receptionist/*`) |

### Resolution of Mismatch:
- In `clinic_mg_proj/settings.py`, `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']` defaults to `CustomJWTAuthentication`.
- To allow Receptionist session endpoints to operate smoothly without conflicting with JWT:
  1. All protected Receptionist endpoints explicitly declare `@authentication_classes([ReceptionistSessionAuthentication])`.
  2. Public Receptionist endpoints (`csrf_token` and `receptionist_login`) must explicitly declare `@authentication_classes([])` and `@permission_classes([AllowAny])` so they are not rejected by the global JWT authenticator.
  3. No changes to the Doctor JWT architecture will be made.

---

## 6. Existing Merge Conflicts Resolution Strategy

| Conflict File | Stage 2 (Ours - `reception-new`) | Stage 3 (Theirs - `origin/main`) | Safe Resolution Strategy |
|---|---|---|---|
| `clinic_mg_proj/settings.py` | Basic settings without `corsheaders` or JWT. | Added `corsheaders`, `timedelta`, `REST_FRAMEWORK` (CustomJWT), and `SIMPLE_JWT`. | **Accept Stage 3 additions**, as they are strictly required by `doctorapp`. The working tree already contains these merged changes. |
| `doctorapp/admin.py` | `from django.contrib import admin` | `"""Shared models are registered by adminapp."""` | Keep docstring and standard import. Neither registers models, avoiding duplicate registration errors. |
| `lab_technicianapp/admin.py` | `from django.contrib import admin` | `"""Shared models are registered by adminapp."""` | Keep docstring and standard import without model registrations. |
| `pharmacistapp/admin.py` | `from django.contrib import admin` | `"""Shared models are registered by adminapp."""` | Keep docstring and standard import without model registrations. |

---

## 7. Files That Need Modification

### Phase A: Conflict Resolution & Project Wiring (Zero Schema Impact)
1. `clinic_mg_proj/clinic_mg_proj/settings.py`: Mark conflict resolved.
2. `clinic_mg_proj/doctorapp/admin.py`: Mark conflict resolved.
3. `clinic_mg_proj/lab_technicianapp/admin.py`: Mark conflict resolved.
4. `clinic_mg_proj/pharmacistapp/admin.py`: Mark conflict resolved.
5. `clinic_mg_proj/clinic_mg_proj/urls.py`: Add `path('api/receptionist/', include('receptionistapp.urls'))`.

### Phase B: Receptionist App Improvements (Zero Schema Impact)
6. `clinic_mg_proj/receptionistapp/views.py`:
   - Add `@authentication_classes([])` and `@permission_classes([AllowAny])` to `csrf_token` and `receptionist_login`.
   - Add patient update view (`PUT`/`PATCH /patients/<id>/`).
   - Add patient status toggle view (`PATCH /patients/<id>/status/`).
   - Add appointment detail view (`GET /appointments/<id>/`).
   - Add search and multi-field filters (`doctor`, `department`, `status`, `search`) to `appointments` list view.
   - Add payment history view (`GET /appointments/<id>/payments/`).
7. `clinic_mg_proj/receptionistapp/serializers.py`:
   - Add `PatientUpdateSerializer`.
   - Add `AppointmentDetailSerializer`.
   - Add `PaymentHistorySerializer`.
8. `clinic_mg_proj/receptionistapp/services.py`:
   - Add application-level check in `create_appointment` to prevent same-time booking conflicts for doctor and patient.
9. `clinic_mg_proj/receptionistapp/urls.py`:
   - Register routes for patient update, status toggle, appointment detail, and payment history.
10. `clinic_mg_proj/receptionistapp/tests.py`:
    - Add tests for new endpoints (patient update, status toggle, appointment detail, payment history, conflict prevention).

---

## 8. Files That Must NOT Be Modified

1. `clinic_mg_proj/doctorapp/*` (`views.py`, `serializer.py`, `permission.py`, `authentication.py`, `urls.py`)
2. `clinic_mg_proj/pharmacistapp/*`
3. `clinic_mg_proj/lab_technicianapp/*`
4. `clinic_mg_proj/adminapp/*`
5. `clinic_mg_proj/core/migrations/0001_initial.py`
6. `.env` and database configuration

---

## 9. Database & Schema Changes (Status & Plan)

- **Immediate Policy:** NO database schema changes, migrations, or DDL operations will be executed.
- **Doctor Availability & Token Limits:**
  - Models `DoctorAvailability` and `DoctorDailyTokenLimit` previously existed in the develop branch but were omitted when `core` was refactored on `origin/main`.
  - Introducing them requires modifying `core/models.py` and running migrations against the database.
  - Per Phase 0 safety rules, these models will remain documented as schema-blocked until the project team formally approves a core schema migration.
  - The existing endpoint `GET /doctors/<id>/availability/` will continue returning clear, structured JSON indicating that schedule tracking is awaiting core schema migration.
- **Appointment Conflict Prevention:**
  - Handled at the application service level inside `create_appointment` (using transactional checks) without modifying database constraints.

---

## 10. Testing Plan

1. **Safety First:** Never run `manage.py test` against the remote Aiven MySQL database.
2. **Local Static Validation:** Run `python manage.py check` after every modification to confirm zero syntax, import, or URL configuration errors.
3. **Isolated Test Execution:** For automated testing, execute tests using an in-memory SQLite database runner or test settings override to verify Receptionist and Doctor endpoints without remote database dependencies.
4. **Endpoint Test Coverage:**
   - Receptionist session login/logout and CSRF handling.
   - Public endpoint accessibility without JWT interference.
   - Patient registration, search, update, and status toggle.
   - Department and doctor filtering.
   - Appointment booking, sequential token generation, and conflict rejection.
   - Appointment detail view, search, and filtering.
   - Appointment cancellation and payment recording.
   - Payment history retrieval.
   - Isolation between receptionists.
   - Preserved functionality of Doctor JWT endpoints.

---

## 11. Potential Risks & Mitigation

| Risk | Consequence | Mitigation |
|---|---|---|
| Global JWT Interception | `receptionist_login` returns 401 if request has random or expired Authorization header | Explicitly decorate unauthenticated endpoints with `@authentication_classes([])` and `@permission_classes([AllowAny])`. |
| Admin Collision | Double registration of shared models causes startup failure (`AlreadyRegistered`) | Keep `receptionistapp/admin.py` free of duplicate registrations; let `adminapp/admin.py` handle shared core models. |
| Remote DB Contamination | Test runs execute DDL or modify tables on Aiven MySQL | Prohibit test commands connecting to remote DB; use in-memory SQLite for test runs. |
| Breaking Teammate Code | Changes to Doctor, Pharmacist, or Lab Tech apps cause merge friction | Strictly limit edits to `receptionistapp/` and root `urls.py`. |
