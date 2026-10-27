# Clinic Management System — Project Audit Report

**Audit date:** 2026-10-26  
**Scope:** Source/configuration review, live read-only checks, existing tests, and in-memory frontend builds.  
**Change boundary:** No application source, settings, dependencies, tests, or database contents were changed. Backend tests used an isolated in-memory SQLite database. Frontend builds used Vite write=false mode. This report is the only requested file to create.

## 1. Executive Summary

**Status: Partially runnable, functionally incomplete, and not production-ready.**

Django responded on 127.0.0.1:8000. GET /api/csrf/ returned 200; unauthenticated GET /api/admin/me/ returned the expected 401. The configured MySQL database was reachable, its migration plan showed all listed migrations applied, and a read-only status query reported TLS active.

None of the five configured frontend ports was listening during the audit. All five React apps compiled using in-memory Vite builds. Admin, shared Login, and Pharmacist frontend contract tests passed. The Django suite ran 121 tests on isolated in-memory SQLite: 120 passed and one failed because a non-Pharmacist test tries to log an Administrator in through the Pharmacist-only endpoint and asserts success.

The Admin 5502-to-5504 redirect was caused by the development fallback in frontend/admin-react/src/services/apiCore.js explicitly changing the port to 5504. Current source now redirects to /login.html on the current origin and its test expects port 5502. Port 5504 is the separate React shared-login app, not the API. The Admin README still documents the old behavior.

Highest-priority findings: development-grade Django security settings; write-capable Admin appointment/bill/payment APIs that bypass or inconsistently apply business workflows despite read-only UI screens; and an absent Laboratory Technician API/UI workflow. Doctor scheduling is also explicitly unsupported by persistent schedule data.

## 2. Project Architecture

### Technologies

| Area | Findings |
|---|---|
| Backend | Python 3.14.2, Django 5.2.17, Django REST Framework 3.18.1 |
| Authentication | Django sessions, DRF tokens, SimpleJWT 5.5.1 |
| Database | MySQL through mysqlclient 2.2.8; configured TLS is active |
| CORS | django-cors-headers 4.9.0 |
| Frontend | Five standalone React 18.3.1 / React Router 6.28.1 / Vite 6.x apps; installed Vite 6.4.5 |
| Other UI | Legacy static HTML/CSS/JavaScript for admin/reception, doctor, pharmacist |
| Runtime/tools | Node 24.19.0, npm 11.17.0 |
| Jobs/integrations | No task queue, scheduler, or background-worker configuration found |

### Directory overview

| Path | Purpose |
|---|---|
| clinic_mg_proj/clinic_mg_proj | Django settings, root URL configuration, ASGI/WSGI |
| clinic_mg_proj/core | Shared role/user, patient, appointment, clinical, pharmacy, lab, billing and payment models; common login |
| clinic_mg_proj/adminapp | Admin API, dashboard, reports, settings and permission |
| clinic_mg_proj/receptionistapp | Session-protected patients, appointments, queue, billing and payment services |
| clinic_mg_proj/doctorapp | Doctor JWT login, clinical and patient APIs |
| clinic_mg_proj/pharmacistapp | Pharmacist JWT login, medicine/prescription APIs, dispensing |
| clinic_mg_proj/lab_technicianapp | App boilerplate only; no URLs or operational views found |
| frontend/admin-react | Admin React/Vite app and existing shared-login middleware |
| frontend/receptionist-react | Receptionist React/Vite app |
| frontend/doctor-react | Doctor React/Vite app |
| frontend/pharmacist-react | Pharmacist React/Vite app |
| frontend/login-react | Shared role-detecting React login and credential handoff |
| frontend/js, css, pages, doctor, pharmacist | Legacy page scripts/styles and HTML |
| frontend/assets, frontend/assests | Static images/logos and a misspelled duplicate-looking directory |
| myvenv | Python virtual environment |

There are 47 HTML files including legacy pages and app entry documents. There is no single root frontend runner or root setup guide. Each React app starts separately. Role-app APIs call Django on 8000. Shared React login posts credentials to common login APIs, then sends role credentials through an origin-checked postMessage handoff. Admin uses a DRF token; Doctor and Pharmacist use JWT; Receptionist uses Django session plus CSRF.

## 3. Application Runtime Status

| Component | Expected location | Status | Evidence | Issues |
|---|---|---|---|---|
| Django API | 127.0.0.1:8000 | PASS — responding | Listener; /api/csrf/ 200; /api/admin/me/ 401 unauthenticated | / root returns 404; root route is not configured |
| Configured MySQL | DB_HOST:DB_PORT | PASS — read-only verified | TCP reachable; showmigrations connected; migrations applied; TLS status active | No patient/business rows were queried |
| Local MySQL | Port 3306 | Not configured target | Local listener exists; Django uses environment host/port | Do not confuse local listener with configured database |
| Receptionist React | 127.0.0.1:5500 | NOT RUNNING | No listener | Browser flow not tested |
| Doctor React | 127.0.0.1:5501 | NOT RUNNING | No listener | Browser flow not tested |
| Admin React | 127.0.0.1:5502 | NOT RUNNING | No listener | In-memory build passed; no browser test |
| Pharmacist React | 127.0.0.1:5503 | NOT RUNNING | No listener | Browser flow not tested |
| Shared Login React | 127.0.0.1:5504 | NOT RUNNING | No listener | Handoff covered only by contract tests |
| Legacy frontend | Static files | NOT TESTED | No static server observed | Requires a browser/static host |

These listener results are a point-in-time observation.

## 4. Module-by-Module Status

| Module | Frontend | Backend/API | Database | Auth | Tests | Overall |
|---|---|---|---|---|---|---|
| Admin dashboard/reports/settings | React routes/pages | Corresponding Admin endpoints | Shared core | Admin permission/token guard | Contract tests pass; backend role coverage | PARTIAL; no live authenticated browser flow |
| User/role/staff management | Admin resource CRUD | Admin CRUD APIs | User/Role/Staff core models | Admin-only | Partial | PARTIAL; no live CRUD; review direct writes |
| Patient management | Admin, Receptionist React and legacy pages | Admin/Receptionist APIs | Patient model | Admin token or Receptionist session | Receptionist validation/search/update coverage | PARTIAL |
| Doctor management | Admin/Doctor/Receptionist pages | Admin and Doctor APIs | Doctor/Staff/Department/Specialization | Role-specific | Partial | PARTIAL |
| Appointment scheduling/status | Receptionist UI supports booking; Admin UI read-only | Receptionist business service and generic Admin CRUD | Appointment and Bill | Receptionist/Admin | Many receptionist tests | PARTIAL; Admin API write gap; no live workflow |
| Token queue | Receptionist queue and legacy UI | Transactional call-next/complete APIs | Appointment status/token | Receptionist session | Queue tests exist | PARTIAL; no live UI test |
| Consultations/records | Doctor React and legacy pages | Protected Doctor APIs | Consultation/MedicalRecord | Doctor JWT and doctor ownership | Payment-gated tests | PARTIAL |
| Prescriptions | Doctor authoring, Pharmacist viewing | Doctor create, Pharmacist read/dispense | Prescription relationships | Doctor/Pharmacist | Partial | PARTIAL |
| Pharmacy | Pharmacist React and legacy UI | JWT catalog/dispensing APIs | Medicine/PrescriptionMedicine | Active Pharmacist role | Frontend contracts pass; one backend test setup failure | PARTIAL |
| Laboratory | Admin catalog and Doctor requests; no technician app | Doctor request/catalog and Admin catalog only | Lab/order/technician models | Doctor/Admin for found APIs | No lab-tech workflow tests | INCOMPLETE |
| Billing/payment | Receptionist operations; Admin view-only pages | Receptionist transactions; Admin generic writes | Bill/Payment | Receptionist/Admin | Receptionist payment tests | PARTIAL; direct Admin API consistency gap |
| Notifications/profile/preferences | No complete persistent feature found | No supporting API found | No notification model found | N/A | None found | NOT IMPLEMENTED or not evidenced |

Source presence is not treated as proof of functionality. Browser interactions and authenticated live workflows remain unverified.

## 5. Bugs and Errors

### AUD-SEC-001 — Development-grade Django security configuration

- **Severity:** P1 — High; unsafe for internet-facing deployment.
- **Files:** clinic_mg_proj/clinic_mg_proj/settings.py lines 27, 30, 32, 67–96.
- **Evidence:** A development-prefixed signing key is hardcoded, DEBUG is True, and ALLOWED_HOSTS includes a wildcard. manage.py check --deploy reports six security findings including missing HSTS/HTTPS redirect and non-secure session/CSRF cookies.
- **Expected/actual:** Production values should be environment-managed and hardened; current checked settings are development defaults.
- **Recommended:** Rotate the key without putting it in source, separate production configuration, disable debug, restrict hosts, and configure HTTPS/HSTS and secure cookies at Django or a trusted proxy.

### AUD-API-001 — Admin write APIs bypass safer appointment/payment workflow

- **Severity:** P1 — High data-integrity risk.
- **Files:** clinic_mg_proj/adminapp/views.py lines 48–59 and 404–493; adminapp/serializers.py lines 378–449 and 464–573; frontend/admin-react/src/pages/ResourcePages.jsx.
- **Evidence:** Appointment/Bill/Payment list endpoints inherit ListCreateAPIView and detail endpoints inherit RetrieveUpdateDestroyAPIView. React hides mutations, but authorized Admin callers can still write directly. Appointment serializer generates tokens by counting and does not call the Receptionist service or create its paired bill. Payment serializer recalculates status only on create; generic update/delete paths do not recalculate related records.
- **Expected/actual:** Every API mutation should enforce appointment, bill, payment and queue invariants. Current API allows generic writes that differ from the safer Receptionist workflow.
- **Recommended:** Make unsupported Admin operations read-only server-side, or use shared validated transactions; test invalid/duplicate bookings and payment consistency.

### AUD-MOD-001 — Laboratory Technician workflow absent

- **Severity:** P2 — Medium; models do not provide an operational role module.
- **Files:** clinic_mg_proj/lab_technicianapp has no urls.py; views.py is boilerplate; no lab-tech frontend found.
- **Evidence:** LabOrder, LabTechnician and LabOrderItem models exist in core, but root URL config includes no technician routes and operational views were not found.
- **Expected/actual:** Technicians need permission-checked order/result lifecycle; only catalog and Doctor request flows are exposed.
- **Recommended:** Define order/result states, implement protected API/UI and tests.

### AUD-REC-001 — Doctor schedules are not persisted or supported

- **Severity:** P2 — Medium; booking availability may not reflect clinic configuration.
- **Files:** receptionistapp/views.py lines 175–193; receptionistapp/services.py lines 10–31 and 80–100; core/models.py.
- **Evidence:** Availability returns availability_supported=false. Hours come from in-memory constants for two doctor IDs or a default 08:00–20:00; no DoctorAvailability model/migration found.
- **Expected/actual:** Availability and validation should use durable doctor schedules. Current values are hardcoded and unavailable through the availability API.
- **Recommended:** Add persisted schedule support and use it for both availability and booking validation.

### AUD-TST-001 — Pharmacist authorization test fails before exercising boundary

- **Severity:** P2 — Medium; test suite is red and intended assertions never run.
- **File:** pharmacistapp/tests.py lines 21–27 and 52–59.
- **Evidence:** test_non_pharmacist_cannot_access_pharmacist_endpoints calls login_as(self.admin); helper expects /pharmacist/login/ to return 200, but endpoint correctly returns 403 to an Administrator.
- **Expected/actual:** Authenticate the Admin through a valid Admin login path, then assert Pharmacist endpoints reject that identity. Actual setup asserts 200 and fails on 403.
- **Recommended:** Repair test setup without weakening the Pharmacist role check.

### AUD-DOC-001 — Admin README describes old 5504 redirect

- **Severity:** P3 — Low; setup/debugging documentation is misleading.
- **File:** frontend/admin-react/README.md line 12.
- **Evidence:** README says Admin guard sends users to login at 5504. Current apiCore resolver and test use /login.html at 5502; .env.example also points to 5502.
- **Recommended:** Reconcile documentation when source changes are authorized.

### AUD-LOGIN-001 — Historical 5502-to-5504 redirect root cause and current status

- **Severity:** P2 historically; current resolver no longer contains the redirect.
- **Files:** frontend/admin-react/src/services/apiCore.js and test/admin-contracts.test.js.
- **Evidence:** Previous development fallback explicitly changed login.port to 5504 and path to /. AuthContext used this helper on missing/invalid Admin auth and logout. Current code resolves /login.html on current origin; contract test expects 127.0.0.1:5502/login.html. Vite still binds 127.0.0.1:5502 with strictPort.
- **Conclusion:** 5504 belongs to login-react, not Django. Current source contract is correct; browser flow was unavailable. A locally configured VITE_SHARED_LOGIN_URL can still override the fallback.

## 6. Missing and Incomplete Features

- No Technician assignment/result/order-status workflow despite core laboratory models.
- Doctor availability is explicitly unsupported and schedule values are hardcoded.
- Admin React appointment, bill, and payment screens are view-only; corresponding backend methods are still writable (AUD-API-001).
- No complete persistent notifications, audit log, profile/password-management, or notification-preference APIs were found.
- Legacy and React implementations overlap with differing login/session behavior; deployment routing and rollback need an explicit plan.
- No browser E2E suite found. Frontend tests are source-contract checks, not complete user journeys.
- postMessage handoff is contract-tested but popup, browser storage, CSRF cookie, and authenticated live API behavior are untested.
- No payment-provider integration was evidenced; payment appears to record clinic-side entries only.
- DRF global pagination is not configured; large-list behavior needs review.

## 7. API Integration Report

Root routes connect /api/login/, /api/csrf/, /doctor/, /api/receptionist/, /pharmacist/, /api/admin/ and /api/token/.

- Admin API service uses VITE_API_BASE_URL, default 127.0.0.1:8000, and /api/admin paths. Source routes correspond. Live anonymous /me returned expected 401; authenticated calls were not made.
- Shared login calls GET /api/csrf/ and POST /api/login/. Pharmacist additionally calls /pharmacist/login/. Live CSRF returned 200; no real credentials were used.
- Receptionist frontend paths align with /api/receptionist routes. Browser cross-origin cookie/CSRF behavior was not tested.
- Doctor frontend paths align with /doctor routes for dashboard, appointments, consultations, prescriptions, records, history, catalog and JWT refresh. No live JWT request was made.
- Pharmacist frontend paths align with router paths for medicines, prescriptions, prescription medicines and dispensing. No authenticated live request was made.
- No Laboratory Technician API routes were found.
- Port 5504 is the Shared Login React Vite app. Backend is separately configured on 8000. No API base URL targeting 5504 was found.
- Development CORS/CSRF origin lists include local ports 5500–5504 and 8000; production origins require configuration.
- Main integration issue is Admin API mutation mismatch. Authenticated payload/response compatibility is otherwise not fully verified without live role sessions.

## 8. Database Report

- Django uses custom core.User and MySQL configured from DB_NAME, DB_USER, DB_PASSWORD, DB_HOST and DB_PORT. Values are omitted.
- Read-only checks reached the configured DB; migration inspection connected, and MySQL status reported TLS active.
- Displayed migrations were applied: auth/admin/contenttypes/sessions, core.0001–0003, doctorapp.0001.
- Admin, Receptionist, Pharmacist and Lab Technician use shared core models and have no separate migrations in the inspected tree.
- Foreign keys and deletion protections are defined. Receptionist payment/queue operations use atomic blocks and row locks.
- Receptionist appointment token allocation locks a Doctor row and applies its business service. Admin has a separate count-based serializer path without the same service and does not create a paired bill.
- No patient rows or sensitive records were queried. Test suite used SQLite, so MySQL-specific application behavior is not covered by that run.

## 9. Authentication and Security Report

**Verified from source/tests:** common login determines role server-side; Receptionist uses session/CSRF; Admin uses IsAdministrator; Doctor uses JWT and doctor ownership checks; Pharmacist uses IsPharmacist; Doctor access is payment-gated in view logic and tests. Handoff validates origin/source and checks credentials against role APIs. Anonymous Admin /me returns 401.

**Risks:** production security settings in AUD-SEC-001; sensitive Admin write operations in AUD-API-001; development handoff origin/port allowlists need exact HTTPS deployment origins. LocalStorage bearer tokens make XSS prevention and CSP important. No XSS exploit or authenticated live role-boundary test was performed. No dependency vulnerability scanner was run. No secrets or patient records are disclosed here.

## 10. Test and Build Results

| Command/check | Result | Scope |
|---|---|---|
| Admin npm test | PASS — 8/8 | API origin, same-origin URL, storage, auth result, errors, payloads, routes |
| Login React npm test | PASS | Contract script covers four roles, malformed/invalid/network cases and cross-role rejection |
| Pharmacist React npm test | PASS | API and route contracts |
| Doctor/Receptionist frontend tests | NOT AVAILABLE | No test script in package.json |
| Vite in-memory build Admin | PASS — 46 modules | build.write=false; no dist writes |
| Vite in-memory build Doctor | PASS — 93 modules | Same |
| Vite in-memory build Login | PASS — 32 modules | Same |
| Vite in-memory build Pharmacist | PASS — 38 modules | Same |
| Vite in-memory build Receptionist | PASS — 60 modules | Same |
| python manage.py check | PASS | No system-check issues |
| python manage.py check --deploy | WARN — 6 findings | HSTS, SSL redirect, signing key, secure session/CSRF cookies, DEBUG |
| Django tests with DATABASES overridden to memory SQLite | FAIL — 120 passed, 1 failed, 121 total | AUD-TST-001; configured DB untouched |
| python manage.py showmigrations --plan | PASS | All displayed migrations applied |
| GET /api/csrf/ | PASS — 200 | Live API check |
| GET /api/admin/me/ without auth | PASS — 401 expected | Live protected endpoint check |
| GET / | 404 | No root URL; not evidence of API failure |
| Frontend ports 5500–5504 | NOT RUNNING | No listener at audit time |
| Browser console/network workflow | NOT TESTED | No browser automation configured |

All frontend source builds were performed using Vite API with build.write=false, so dist was not overwritten. No dependencies were installed. A disk-writing build was not run to preserve the audit-only file boundary.

## 11. Code Quality and Performance

- Legacy and React implementations overlap, increasing the risk of inconsistent entrypoints, auth storage and redirects.
- No root package workspace/runner starts all role apps.
- Contract coverage exists for three frontends; Doctor and Receptionist lack npm test scripts; no E2E suite exists.
- Admin dashboard performs several counts and computes some sums in Python; profile at realistic volumes.
- DRF pagination is not configured; list endpoints may grow unbounded.
- No task worker, monitoring, deployment orchestration, or dedicated health endpoint was found.
- Receptionist hours are process-local constants; Admin README is stale.

## 12. Required Environment and Startup Instructions

### Backend

Conventional command inferred from manage.py and API origin: from clinic_mg_proj, run ..\myvenv\Scripts\python.exe manage.py runserver 127.0.0.1:8000. Required root environment variable names are DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT. SECRET_KEY is currently hardcoded; production must use a separately managed secret. Do not copy secret values into docs/source.

### Frontends

Run npm run dev independently in each directory:

| Directory | Port |
|---|---:|
| frontend/receptionist-react | 5500 |
| frontend/doctor-react | 5501 |
| frontend/admin-react | 5502 |
| frontend/pharmacist-react | 5503 |
| frontend/login-react | 5504 |

Frontend API variable: VITE_API_BASE_URL. Admin additionally supports VITE_SHARED_LOGIN_URL. .env.example files exist; no app .env.local file was found. No install command was run. Legacy HTML needs a static server/web host; no root launch command was found.

## 13. Prioritized Action Plan

| Phase / priority | Task | Affected areas | Dependency | Effort | Acceptance criteria |
|---|---|---|---|---|---|
| A / P1 | Add separate production Django config; rotate secret; disable DEBUG; restrict hosts; secure HTTPS/cookies | settings and deployment | Production host/proxy plan | Medium | check --deploy has no applicable warnings; secret absent from tracked source |
| A / P1 | Restrict Admin appointment/bill/payment write methods or use shared validated transactions | adminapp views/serializers, receptionist services | Decide supported Admin mutations | Large | Tests reject invalid/duplicate booking and preserve bill/payment/appointment state under concurrent changes |
| B / P2 | Repair Pharmacist role-boundary test setup | pharmacistapp/tests.py | None | Small | Non-Pharmacist authenticated through valid path; forbidden endpoint assertions execute; suite green |
| B / P2 | Define and implement Laboratory Technician order/result workflow | lab app, core, root URLs, frontend | Product workflow/schema | Large | Technician can access permitted orders and record results; other roles denied; integration tests pass |
| B / P2 | Persist doctor schedules and use for availability plus booking | receptionist service/views, core models/migrations, UI | Clinic schedule requirements | Large | All doctors have durable schedule rules; boundary/inactive schedule tests pass |
| C / P2 | Align Admin UI scope and backend API capabilities | Admin React and Admin API | Supported mutation decision | Medium | Every control is functional or clearly disabled; API denies unsupported writes |
| C / P2 | Implement notifications, audit log, profiles/preferences only if required | core and role apps | Product requirements | Large | Explicit acceptance criteria and permission tests |
| D / P1 | Review object-level data access and XSS exposure for patient records | role permissions, medical APIs, UI | Threat model | Medium | Cross-role/object tests deny access; security review signs off |
| D / P2 | Replace development handoff origins with exact HTTPS origins | handoff scripts, login, CORS/CSRF | Deployment domains | Medium | E2E login succeeds across deployed origins and rejects untrusted origins |
| E / P2 | Add Doctor/Receptionist frontend tests and browser E2E | frontend suites, backend test setup | Test environment | Large | CI covers login, CRUD, empty/error state, redirects and role isolation |
| E / P2 | Add health checks and repeatable startup orchestration | root docs/scripts, all apps | Runtime design | Medium | Documented command starts/checks every required service |
| F / P2 | Add pagination and profile dashboard query behavior | DRF settings/list/dashboard APIs, tables | Expected clinic volume | Medium | Pagination contracts and query/load checks pass |
| F / P3 | Reconcile stale docs and legacy/React entrypoint/rollback instructions | Admin/Login/Pharmacist docs | Choose supported entrypoints | Small | Documentation matches current ports and redirect flow |

## 14. Final Verdict

1. **Frontend starts?** Not verified at runtime; no dev server listened. All five React source bundles compiled in memory.
2. **Backend starts?** Already responding on port 8000; Django check passed.
3. **Database accessible?** Yes; migrations read successfully and MySQL TLS reported active.
4. **Frontend/backend communication?** Partially evidenced: URLs align and CSRF responded; no browser-authenticated API call was tested.
5. **Authentication works?** Source/contracts and most backend tests cover flows; live credentialed login/logout was not performed.
6. **Role permissions enforced?** Permission classes and tests exist; no live role tests. One Pharmacist boundary test setup is invalid.
7. **Verified modules?** API reachability/CSRF, database access/TLS/migrations, all React source builds, passing frontend contracts and 120 Django tests.
8. **Partially working modules?** Admin, Receptionist, Doctor, Pharmacist, queue, consultations, prescriptions, billing, reports and settings; browser/live business flows remain unverified. Admin operations are read-only in the UI.
9. **Broken modules?** Laboratory Technician workflow is absent. One test fails in setup. No other module was shown broken by live workflow testing.
10. **Untested modules/behaviors?** Browser journeys; live login/logout and credential handoff; authenticated CRUD; live payload integration; production deployment; technician workflow; dependency vulnerability status.
11. **Five issues first:** insecure production settings; Admin mutation/business-integrity gap; absent lab technician lifecycle; unsupported hardcoded schedules; failing Pharmacist test setup.
12. **Production readiness needs:** secure production config and secret rotation, consistent API mutations, lab/schedule requirements, deployment-specific CORS/CSRF/handoff settings, browser E2E and role/object authorization tests, backup/monitoring/logging and repeatable deployment procedures, and green CI on the production database engine.

No database contents, credentials, secrets, or patient records are included in this report.

---

# Remediation Update — 2026-10-26

This section records changes made after the original audit. The findings above remain intact as the initial audit record; statuses below reflect the source and checks after remediation. Existing uncommitted work was inspected and preserved.

## Confirmed findings and remediation status

| Finding | Verified cause | Remediation/status |
|---|---|---|
| AUD-API-001 — Admin appointment, bill, and payment writes | The Admin UI was view-only, but its list/detail APIs inherited create/update/delete handlers. Those paths bypassed Receptionist booking and payment services. | Fixed server-side: Admin appointment/bill/payment list and detail endpoints are read-only. Receptionist booking remains the supported mutation workflow; it uses an atomic transaction, doctor-row locking on databases that support it, and creates the paired consultation-fee bill. Tests verify Admin reads, rejected writes, permissions, successful booking/payment, and rollback if bill creation fails. |
| AUD-TST-001 — Pharmacist role test setup | The test sent an Administrator to the Pharmacist-only login route and expected 200. | Fixed test setup: the Administrator now authenticates through `/api/login/`, uses the returned Admin token, and is then rejected by Pharmacist endpoints. Authorization behavior was not weakened. |
| AUD-SEC-001 — Development Django settings used as production defaults | The source had a committed signing key, `DEBUG=True`, wildcard host acceptance, and no production HTTPS/cookie/HSTS policy. | Mitigated in settings: development uses localhost/testserver hosts and a per-process development signing key; production requires `DJANGO_SECRET_KEY` and explicit `DJANGO_ALLOWED_HOSTS`, and defaults to HTTPS redirect, secure session/CSRF cookies, and HSTS. CORS/CSRF origins and the database CA path are environment-configurable. Local HTTP defaults remain enabled. No live key was rotated. |
| AUD-DOC-001 — Admin redirect documentation | The Admin README incorrectly said the guard navigated to the React login app on port 5504. | Fixed README: normal Admin auth redirects use same-origin `/login.html` at port 5502; the separate shared-login React app remains available on 5504. The backend API remains on 8000. |
| AUD-LOGIN-001 — Historical 5502 to 5504 navigation | The prior development resolver explicitly changed the login URL port to 5504. Current `apiCore.js` already resolves the shared legacy login path on the current origin, and its contract test expects 5502. | Current implementation confirmed and contract test passes; no frontend behavior change was required in this remediation. Browser-level redirect testing remains outstanding because no browser was run. |
| AUD-REC-001 — Persistent doctor schedules | Current docs explicitly describe weekly weekday/start/end schedule data as absent/schema-blocked. Booking still uses legacy hardcoded hours. | Not implemented yet. The available docs suggest a recurring weekly interval, but do not define multiple shifts, breaks, closures/holidays, or how schedule edits interact with existing bookings. A schema/API behavior choice was requested before adding a migration. |
| AUD-MOD-001 — Laboratory Technician workflow | The shared models contain lab orders/items, status choices, and a technician relation; operational Technician routes/UI and a result field/workflow are absent. Doctor requests currently create `PrescriptionLabTest` records, with no confirmed lifecycle that turns them into lab orders/items. | Not implemented yet. The minimum result format and assignment/update rules, and the conversion from Doctor requests to lab work, need confirmation before adding schema or exposing patient results. Clarification was requested. |

## Files changed in this remediation

- `clinic_mg_proj/adminapp/views.py` — appointment, bill, and payment Admin collection/detail views now expose reads only.
- `clinic_mg_proj/adminapp/tests.py` — added Admin read, denied-write, and role-permission API tests.
- `clinic_mg_proj/pharmacistapp/tests.py` — fixed Administrator authentication setup for the cross-role denial test. This file already had uncommitted security tests at baseline; those changes were retained.
- `clinic_mg_proj/receptionistapp/tests.py` — added booking/bill rollback verification and a MySQL-capability-gated concurrent token allocation test.
- `clinic_mg_proj/clinic_mg_proj/settings.py` — made secret, debug, allowed hosts, CORS/CSRF origins, TLS cookie/redirect/HSTS values and DB CA path environment-driven, with safe local HTTP defaults. Earlier uncommitted local-origin changes were retained.
- `clinic_mg_proj/.env.production.example` — added a placeholder-only deployment environment template; it contains no real credentials.
- `frontend/admin-react/README.md` — corrected the port 5502/5504 redirect description and documented that the billing/appointment Admin APIs are read-only.

No migration was created or applied. `makemigrations --check --dry-run` reported no model drift at this stage. The configured MySQL database and its data were not changed.

For backend tests, an inline Django `DiscoverRunner` invocation replaced `DATABASES['default']` with `sqlite3 :memory:` before `django.setup()` and ran the full test discovery from `clinic_mg_proj`; this kept test writes isolated from the configured MySQL database. The setting itself was not changed on disk.

## Remediation verification

| Check | Result |
|---|---|
| Admin, Pharmacist, Receptionist targeted backend suites, isolated SQLite | PASS — 92 tests, 0 failures |
| Full Django suite, isolated in-memory SQLite | PASS - 126 tests: 125 passed, 1 skipped, 0 failures |
| Conditional concurrent-token test, isolated SQLite | SKIPPED as expected - SQLite lacks `SELECT FOR UPDATE`; run on isolated MySQL test DB to verify locking |
| Django `check` with development defaults | PASS — no issues; DEBUG remains enabled for local use, allowed hosts are localhost/testserver, HTTP cookies remain usable |
| Django `check --deploy` with test-only production environment values | PASS — no deployment warnings |
| `makemigrations --check --dry-run` | PASS — no model changes detected |
| Admin React contract tests | PASS — 8/8 |
| Shared Login React contract tests | PASS |
| Pharmacist React contract tests | PASS |
| Vite in-memory production builds | PASS — Admin (46 modules), Doctor (93), Login (32), Pharmacist (38), Receptionist (60); no `dist` output written |
| `git diff --check` | PASS — no whitespace errors; Git emitted only a line-ending conversion warning for the pre-existing modified Pharmacist test file |

The backend suites ran with an in-memory SQLite override, so the configured MySQL server was not used for test writes. The original audit's MySQL reachability/migration evidence remains point-in-time evidence only. No frontend dev server or browser was started; login/logout, cross-origin handoff, live role API calls, and visible redirect behavior still need browser testing.

## Remaining work and database operations

1. Confirm the weekly schedule semantics (or the desired alternative), then add a model, migration, API integration, booking validation, and schedule tests. Review and apply the generated migration manually using `python manage.py makemigrations core` followed by `python manage.py migrate`; do not run `migrate` against the existing database before review and backup.
2. Confirm Lab Technician assignment and status transitions, result format/validation, order creation from doctor requests, and Doctor result visibility. Then implement the agreed API/UI and any required reviewed migration. No patient information should be returned outside the treating Doctor's authorized scope.
3. Run the conditional concurrency test on a disposable/isolated MySQL test database with `python manage.py test receptionistapp.tests.ConcurrentAppointmentTokenTests`. SQLite cannot validate row locks.
4. Configure production environment values from `clinic_mg_proj/.env.production.example` in the deployment secret store, use real HTTPS origins/hosts, and verify reverse-proxy TLS behavior before deployment. The example values are placeholders, not deployable credentials/domains.
5. For stable local JWT signing across backend restarts, set a private local `DJANGO_SECRET_KEY`; otherwise the intentionally ephemeral development key invalidates existing JWTs when Django restarts.
6. Manually test in a browser: Admin startup at `http://127.0.0.1:5502`, unauthenticated redirect/logout staying at 5502, shared login handoff, API access on 8000, receptionist booking/payment, and cross-role denial. No browser workflow is claimed as verified here.

The full suite ran after adding the database-feature-gated concurrency test; 125 tests passed and that test correctly skipped on SQLite. If tests change further, repeat the full suite before release.

---

# Follow-up Remediation — 2026-10-26

This addendum follows the user-confirmed rules for recurring weekday doctor schedules and laboratory result ownership. The original audit and prior remediation sections above are retained as historical records; this addendum supersedes their “not implemented yet” status for AUD-REC-001 and AUD-MOD-001.

## Verified findings and changes

| Finding | Current source evidence | Remediation/status |
|---|---|---|
| AUD-REC-001 — hardcoded doctor hours | `receptionistapp/services.py` had a hardcoded registry and default interval. The availability endpoint explicitly said persisted schedules were unsupported. | Replaced the fallback with persisted `DoctorAvailability` rows. Multiple active intervals can be recorded for one doctor/day; `is_active=false` disables an interval. Booking validation and the transactional booking service both enforce the requested date's weekday and an inclusive interval boundary. A day with no active interval rejects booking. Existing exact-time doctor/patient conflict checks and the doctor-row lock remain in the service. Receptionist availability now returns weekly intervals, date-specific intervals and existing booked appointment times. Added an Administrator-only list/create/update API and Admin screen to manage intervals, with overlap validation. No schedule data is backfilled; after reviewed migrations are applied, doctors have no bookable times until their recurring schedules are configured. |
| AUD-MOD-001 — lab order/result workflow | Doctor requests are represented by `PrescriptionLabTest -> Prescription -> Consultation -> Appointment`; the operational order tables were disconnected. `LabOrderItem` had a required technician but no request reference/result field. | Added receptionist assignment from existing Doctor requests to one technician, preserving the request, test, patient, doctor and appointment links. The endpoint validates that selected requests belong to the same appointment/patient/doctor, rejects duplicate assignment, and requires an explicit existing `normal` or `urgent` priority. Added an active Technician role permission, JWT-issued Technician login in common login, assigned-work listing and create/update text-result endpoint. Only the assigned active Technician can mutate an item; blank and oversized results and cancelled work are rejected. Order/item status is updated when results are complete. Doctors can list completed results only for their own orders. Added a Receptionist assignment page and a Doctor results page. |
| MySQL appointment concurrency | Existing booking service locks the Doctor row before date/time conflict checks, token allocation, appointment creation and paired Bill creation. | Added a conflicting same-time concurrent test asserting exactly one appointment and bill, in addition to distinct-token coverage. Both tests passed on a separately named MySQL test database. They are skipped by the final SQLite suite. |
| AUD-TST-001 — Pharmacist role test setup | The original failure authenticated an Administrator through the Pharmacist-only login route. | Prior remediation remains: the test authenticates through common login and verifies that the Pharmacist endpoint denies the Administrator. The full test suite is green; role enforcement was not weakened. |

### Schema migrations generated for review only

Two unapplied migration files were generated:

| Migration | Effect on existing data |
|---|---|
| `core/migrations/0004_laborderitem_prescription_lab_test_and_more.py` | Creates `doctor_availability` with doctor FK, weekday, start/end times, active flag and a start-before-end constraint. Adds nullable `LabOrderItem.prescription_lab_test_id` using `PROTECT`, plus `LabOrderItem.result` as text defaulting to empty. Existing lab items remain with a null request link and empty result; no assignment or result is fabricated. New schedule table starts empty. |
| `core/migrations/0005_doctoravailability_doctor_availability_weekday_range.py` | Adds a database check that weekday is 0–6. Does not alter existing records. |

No migration was applied to the configured application database. Django applied migrations to temporary test databases only. Before applying either migration in an operational environment, review the migration files, back up the database, apply them to a disposable clone first, and configure every doctor's recurring availability. No historical appointment or lab rows are rewritten by these migrations.

Suggested reviewed application sequence, to be run later by the database operator after backup/approval:

```text
python manage.py migrate core 0004_laborderitem_prescription_lab_test_and_more
python manage.py migrate core 0005_doctoravailability_doctor_availability_weekday_range
```

These commands were not run against the existing application database.

## Follow-up files changed

- `clinic_mg_proj/core/models.py`, `core/views.py`, and `core/migrations/0004_...py`, `0005_...py` — schedule schema, lab item result/request association, and Technician token issuance.
- `clinic_mg_proj/adminapp/serializers.py`, `views.py`, `urls.py`, `tests.py` — Administrator schedule maintenance API, interval overlap validation, and role tests.
- `frontend/admin-react/src/App.jsx`, `layouts/AdminLayout.jsx`, `pages/ResourcePages.jsx`, `services/resources.jsx` — Doctor availability management screen.
- `clinic_mg_proj/receptionistapp/services.py`, `serializers.py`, `views.py`, `urls.py`, `tests.py` — persistent weekly availability validation, availability response, request assignment API, and schedule/concurrency tests.
- `clinic_mg_proj/lab_technicianapp/permissions.py`, `urls.py`, `views.py`, `tests.py` — role-scoped assigned orders and result editing tests.
- `clinic_mg_proj/doctorapp/views.py`, `urls.py` — treating-Doctor-only completed result endpoint.
- `clinic_mg_proj/clinic_mg_proj/urls.py` — Technician API route.
- `frontend/receptionist-react/src/App.jsx`, `components/forms/AppointmentForm.jsx`, `layouts/ReceptionistLayout.jsx`, `services/appointmentService.js`, `pages/LabAssignment.jsx` — availability display and receptionist request assignment UI.
- `frontend/doctor-react/src/App.jsx`, `components/Layout.jsx`, `pages/Pages.jsx`, `services/api.js` — completed-result route, display and API client.
- `PROJECT_AUDIT_REPORT.md` — this follow-up status and evidence.

## Final verification results

| Check | Result |
|---|---|
| Full Django suite, explicitly isolated in-memory SQLite settings | PASS — 134 tests, 0 failures, 2 skipped (the MySQL row-lock tests). Test-only MD5 password hasher was set in the ephemeral test process; project settings were not changed. |
| Lab Technician and assignment tests, explicitly isolated SQLite settings | PASS — 5 tests, including common-login Technician JWT, assignment relationship preservation, duplicate assignment rejection, result create/update, blank result rejection, and role/assignment denial. |
| Administrator schedule API tests, explicitly isolated SQLite settings | PASS — 2 tests for nonoverlapping recurring interval creation, overlap rejection, and non-Administrator denial; these are included in the full suite count above. |
| Appointment concurrency tests, isolated MySQL test database `cms_remediation_isolated_20261026` | PASS — 2 tests: concurrent distinct tokens and conflicting same-time bookings produce one appointment/one bill. Django created, migrated and destroyed this dedicated test database. |
| Earlier full Django run, Django-created MySQL `test_defaultdb` test database | PASS — 131 tests. The standard test runner used the separate `test_` database, not the application database. A later interrupted targeted test invocation left `test_defaultdb` present; a subsequent runner refused to recreate it. It was not deleted or modified under the no-delete rule. Inspect/clean it only with explicit database-operator approval. |
| `python manage.py check` | PASS — no system-check issues. |
| `python manage.py makemigrations --check --dry-run` | PASS — no model changes pending beyond generated migrations. |
| `git diff --check` | PASS — no whitespace errors; Git displayed only line-ending normalization notices. |
| Vite in-memory production builds | PASS — Admin 46 modules, Receptionist 61, Doctor 93, Pharmacist 38, Shared Login 32. `build.write=false`; no `dist` files were written. |
| Frontend contract tests | PASS — Admin 8/8; Pharmacist and Shared Login contract suites passed. Receptionist and Doctor have no existing contract-test script. |
| Browser workflows | NOT TESTED — no browser automation tool or Playwright/Cypress project configuration is available. No live role login/logout or UI network workflow is claimed. |

## Remaining limitations and manual verification

1. Migrations are review-only and the configured application database is unchanged. Existing installations must review and apply migrations before using the new schedule/lab fields. Do not attempt booking until active weekly intervals are configured; there is deliberately no default schedule or historical-data backfill.
2. **Historical at this report revision; resolved below:** the Technician API existed without a shared-login target or dedicated UI. The follow-up section documents the new shared-login handoff and Technician React workspace; browser testing is still outstanding.
3. The Administrator schedule-management API and React screen are implemented, but were API-tested/build-checked, not browser-tested. Configure recurring schedules after migration and before enabling receptionist booking. **The stale Receptionist Doctors directory message has since been corrected below;** the date-specific schedule display still requires browser verification.
4. Browser checks still required after applying the migrations to a disposable test installation: Admin start at `http://127.0.0.1:5502`; invalid-session/login/logout redirects remain on 5502; confirm 5504 is used only for shared login handoff; exercise each currently supported role; receptionist schedule display, booking/out-of-hours/conflict behavior and assignment; Doctor result visibility; assigned Technician update; and cross-role API denial.
5. The `test_defaultdb` database noted above needs operator review before cleanup. Do not use it as an application database. It was left untouched because database deletion was explicitly prohibited.
6. MySQL concurrency is verified only for the dedicated test database named above. Repeat after any changes to appointment lock scope, database engine/configuration, or booking transaction behavior.

## Follow-up remediation status — 2026-10-26

This section records the latest verified changes and supersedes earlier follow-up statements that the Technician login target/UI were missing and that the Receptionist Doctors directory still described persisted availability as unsupported. Existing working-tree edits were preserved; no database was modified during this follow-up.

### Confirmed and resolved findings

| Finding | Current evidence and status |
|---|---|
| Technician shared login target was missing | `core.views.common_login` already issued the Technician JWT, but Shared Login had no `lab_technician` destination and would have handled the role through its Pharmacist fallback. Shared Login now validates the Technician payload, targets the dedicated app at `127.0.0.1:5505`, and the handoff verifies the JWT against `/api/lab-technician/orders/` before storing it. The Login React contract test covers the Technician route and credential handoff. |
| Dedicated Technician UI was missing | Added a standalone React/Vite workspace at `frontend/receptionist-react/lab-technician-react/`. It displays only API-returned assigned test items, supports one text result per item, and supports creating/updating results. The backend permission and item-assignment filters remain authoritative; the existing API tests cover unassigned Technician and other-role denial. Logout clears the Technician credentials and returns to Shared Login on port 5504. |
| Receptionist schedule message was stale | The React Doctors directory now describes persisted recurring weekly hours and uses the date-specific availability endpoint to display that date’s interval and booked appointment times. The legacy Doctors page no longer claims that no schedule model exists. The endpoint reports working intervals and booked times; it does not generate discrete appointment slots. |
| AUD-API-001 Admin write exposure | Verified current Admin appointment, bill, and payment endpoints use list/retrieve-only views. `AdminFinancialReadOnlyTests` asserts POST/PUT/PATCH/DELETE are rejected and non-Admins are denied. This closes the previously identified direct-write path while preserving the Admin read-only screens. |
| AUD-TST-001 Pharmacist test setup | `login_admin()` now authenticates through `/api/login/` and uses the Admin token scheme; the test asserts Pharmacist endpoints return 403. The Pharmacist permission checks were not weakened. The relevant suite passed. |
| Shared Login error-path popup reference | Removed an undefined `popupRef` assignment from the secure-handoff error handler; the existing `handoffRef` already owns and closes that popup. Added a contract assertion against the undefined reference. |

### Files added or changed in this follow-up

- `frontend/login-react/src/services/auth.js`, `public/auth-handoff.js`, `test/login-contracts.test.js`, and `README.md` — route the backend-verified Technician role to port 5505, verify/store its JWT, and document the additional role.
- `frontend/login-react/src/App.jsx` — remove the undefined popup reference on failed handoff.
- `frontend/receptionist-react/lab-technician-react/` — new standalone Vite application, assigned-order/result UI, contract test, and startup documentation. It reuses the project’s existing React/Vite dependency versions; no packages were installed or upgraded.
- `clinic_mg_proj/clinic_mg_proj/settings.py` and `.env.production.example` — allow the new local Technician origin on port 5505 and include an example exact HTTPS Laboratory origin for production CORS/CSRF configuration. The existing 5500–5504 origins and local development settings remain in place.
- `frontend/receptionist-react/src/pages/Doctors.jsx`, `frontend/js/doctors.js`, and `frontend/doctors.html` — display the current persisted schedule/availability contract instead of the former unsupported-schedule message.
- `PROJECT_AUDIT_REPORT.md` — this verified follow-up record.

### Verification after these changes

| Command/check | Result | Database/runtime scope |
|---|---|---|
| Focused Django suite: `lab_technicianapp`, `pharmacistapp`, `AdminFinancialReadOnlyTests` | PASS — 15 tests, 0 failures, 0 skipped | Explicit in-memory SQLite test database. It did not connect to or modify configured MySQL. |
| Full Django suite and concurrency checks | Previous isolated MySQL result remains PASS — 134 tests, 0 failures, 0 skipped; both appointment concurrency/row-lock tests passed. | `cms_test_20261026_cmsverify1` was created after a read-only absence check, used by Django, and cleaned up. A read-only post-run check confirmed it was absent; `test_defaultdb` remained untouched. This MySQL run was not repeated here because subsequent changes were limited to frontend code and the local allowed-origin list, not booking logic or schema. |
| `python manage.py check` | PASS — no system-check issues | Configuration check only. |
| `python manage.py check --deploy` | WARN — 5 expected production warnings in the current local environment: HSTS disabled, SSL redirect disabled, session/CSRF secure-cookie flags disabled, and DEBUG enabled. | These are local development defaults, not evidence that production is safe. No deployment configuration was changed in this follow-up. |
| Frontend contract tests | PASS — Admin 8/8; Shared Login passed including Technician handoff; Pharmacist passed; Technician UI contract passed. | Node contract tests; no browser workflow. Doctor and Receptionist have no configured contract-test scripts. |
| Vite `build({ build: { write: false } })` | PASS — Admin 46 modules, Receptionist 61, Doctor 93, Pharmacist 38, Shared Login 32, Technician 27. | All builds were no-write; no `dist` output was overwritten. |
| `git diff --check` | PASS — no whitespace errors; Git displayed line-ending normalization notices for existing modified files. | Read-only working-tree validation. |
| Browser automation availability | NOT AVAILABLE | No configured browser automation tool was exposed; Playwright/Puppeteer/Cypress is not installed in the inspected Admin dependency tree. Login/logout and live browser network behavior remain unverified. |

### Admin redirect and role-boundary status

The Admin resolver still sends unauthenticated/unauthorized development users to `/login.html` on the current origin; its contract test asserts `http://127.0.0.1:5502/login.html`. Admin logout uses the same resolver. The new Technician destination is 5505; 5504 remains the Shared Login Vite app and is not used as the Admin fallback. These are source/contract findings, not browser observations. Backend role boundaries were covered by the focused tests and prior full MySQL suite; live cross-role browser/API checks with actual user accounts remain unperformed.

### Production security review and recommendations

Current settings no longer contain a hardcoded development signing key: local development generates a process-local key, while `DJANGO_DEBUG=false` requires `DJANGO_SECRET_KEY`. Production `ALLOWED_HOSTS` must be explicitly supplied. The existing `.env.production.example` shows environment-managed secret, host, database, exact HTTPS CORS/CSRF origins, SSL redirect, secure cookies, and HSTS settings. The five `check --deploy` warnings above occur because this audit command ran with local DEBUG/HTTP defaults.

Before deployment, set `DJANGO_DEBUG=false`, provide a strong secret through the protected runtime environment, restrict `DJANGO_ALLOWED_HOSTS`, configure only the deployed HTTPS origins in CORS/CSRF, and enable HTTPS redirect, secure cookies, and HSTS only after TLS termination and proxy behavior are confirmed. If TLS is terminated at a reverse proxy, validate trusted proxy headers to avoid redirect loops. Do not copy example secrets into source control or use local HTTP settings in production.

### Remaining work and manual browser checks

1. Apply migrations `core.0004_laborderitem_prescription_lab_test_and_more` and `core.0005_doctoravailability_doctor_availability_weekday_range` only after review, backup, and explicit database-operator approval. Neither the development MySQL database nor another persistent database was migrated here. Configure active recurring schedules before enabling booking against a migrated installation.
2. Start Django at `127.0.0.1:8000`, Shared Login at `127.0.0.1:5504`, and the role apps at Receptionist `5500`, Doctor `5501`, Admin `5502`, Pharmacist `5503`, and Technician `5505`. Using an authorized test account for each role, sign in through Shared Login and verify the correct destination, refresh persistence, sign-out behavior, and denial of a different role’s protected API. For Technician, also verify assigned-order loading and result save/update; test an unassigned item and expect denial/not found. These browser workflows remain unverified.
3. For Admin, open `http://127.0.0.1:5502/` without an Admin token, sign in, sign out, and visit a protected route with an invalid token. Confirm all Admin login/logout/unauthorized navigation remains on port 5502 and does not switch to 5504. Port 5504 should be visited only when intentionally opening Shared Login.
4. With a Receptionist test account and migrated/configured schedule rows, open the Doctors directory, compare weekly intervals with Admin schedule data, query a date, then verify booking within hours and rejection outside hours/conflicting times. This is still a manual UI check; API tests are not a browser substitute.
5. Production readiness still requires deployment-specific security configuration, migration approval/application, browser end-to-end testing, and confirmation of the installed reverse-proxy/TLS setup. No action against the persistent database is authorized by this report.
