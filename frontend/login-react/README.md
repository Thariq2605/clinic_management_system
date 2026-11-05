# MEDICARE Shared Login (React)

This standalone Vite application provides a common, role-detecting login for Admin, Pharmacist, Receptionist, Doctor, and Laboratory Technician accounts. It does not replace or delete the legacy login files.

## Development

```sh
cd frontend/login-react
npm install
npm run dev
```

Open `http://127.0.0.1:5504/`. The backend defaults to `http://127.0.0.1:8000`; copy `.env.example` to `.env.local` to set `VITE_API_BASE_URL`. Use the same API base in the login and all role apps, and keep a consistent hostname (`127.0.0.1` or `localhost`) across login, role apps, and API so the Receptionist session cookie is available to its app. Start the selected role app on its configured port before signing in.

## Authentication contracts

The React login fetches a CSRF token from `GET /api/csrf/`, then posts `{ username, password }` to the existing `POST /api/login/`. The backend checks the active account and determines its role; the client has no role selector.

| Role | Login contract | Credential and handoff validation | Development destination |
| --- | --- | --- | --- |
| Admin | `POST /api/login/`; response includes `role`, `token`, and `user` | DRF token is sent over origin-checked `postMessage`; destination verifies it with `GET /api/admin/me/` | `http://127.0.0.1:5502/` |
| Pharmacist | Shared login identifies the role; `POST /pharmacist/login/` then returns Pharmacist JWT `access` | JWT is sent over `postMessage`; destination verifies `GET /pharmacist/me/` | `http://127.0.0.1:5503/` |
| Receptionist | `POST /api/login/` establishes Django session and returns `user_id`, `receptionist_id`, and `name` | Host-scoped session cookie is sent with credentials; destination validates via `GET /api/receptionist/departments/` | `http://127.0.0.1:5500/` |
| Doctor | `POST /api/login/`; response includes `access`, `refresh`, `doctor_id`, `user_id`, and identity fields | JWT is sent over `postMessage`; destination verifies it via `GET /doctor/dashboard/{doctor_id}/`; existing refresh behavior remains in Doctor app | `http://127.0.0.1:5501/` |
| Laboratory Technician | `POST /api/login/`; response includes `access`, `refresh`, `technician_id`, and `user_id` | JWT is sent over `postMessage`; destination verifies it with `GET /api/lab-technician/orders/`, which returns only items assigned to that technician | `http://127.0.0.1:5505/` |

Development ports: Receptionist `5500`, Doctor `5501`, Admin `5502`, Pharmacist `5503`, Shared Login `5504`, and Laboratory Technician `5505`. The Technician Vite project and its startup instructions are in `frontend/receptionist-react/lab-technician-react/`.

Because each development app has a different origin, storage is not shared. The login opens a role app in a new tab and performs an exact-origin, `event.source`-checked `postMessage` handshake. Credentials never appear in a URL. The destination checks the credential with its role-protected backend endpoint before storing it and loading its app. Popup access is required. If the browser blocks the tab, allow pop-ups for the login origin and retry.

The Pharmacist common-login response does not contain a JWT, so the login calls the dedicated Pharmacist endpoint after the shared endpoint confirms that role. Receptionist authentication remains a Django session and is validated by the existing React guard. Admin and Pharmacist guards continue to make their existing `/me/` checks. Doctor server permissions validate its JWT on the dashboard and all subsequent APIs. Technician API permissions validate its JWT and active Technician role on every request; result changes are restricted to assigned items.

## Tests and production integration

Run `npm test` for source contract checks and `npm run build` for the production build. These do not exercise a live Django server.

The static `public/auth-handoff.html` and `public/auth-handoff.js` adapters are included in each React app so the verified credential can move between origins without a query-string secret. Production deployment must replace the development origin allowlist in those adapters and the fixed destination-port mapping with exact HTTPS origins, configure Django CORS/CSRF trusted origins for the login, and serve the handoff assets with each app. Keep the old shared login available until that deployment is verified; it remains a rollback path.

## Legacy login status

`frontend/login.html`, its CSS, `frontend/js/auth.js`, and `frontend/js/api.js` are not changed. To switch the shared entrypoint later, update the existing web server routing so its login URL serves the built React app after all role apps are deployed and the end-to-end checks pass. Keep the legacy files until the rollback window closes.
