# Admin React application

Standalone Vite + React Router application for the clinic Admin module.

## Local development

1. Install this app's declared dependencies with `npm install` from `frontend/admin-react/`.
2. Copy `.env.example` to `.env.local`. `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`; `VITE_SHARED_LOGIN_URL` defaults to the central login app at `http://127.0.0.1:5504/`.
4. Start the app with `npm run dev` (Vite uses port `5502`).

The Admin guard validates the stored Admin token against `GET /api/admin/me/` before rendering protected routes. Sign out and invalid Admin credentials clear Admin auth state and use the configured Shared Login URL; local development falls back to port `5504`. The legacy login page and its existing Admin redirect (`pages/admin_dashboard.html`) remain available as a rollback path. Set `VITE_SHARED_LOGIN_URL` to the deployed central login URL in production.

For deployment, configure the Admin app and Shared Login with the deployment's central login URL and route the existing `/pages/admin_dashboard.html` handoff to the React Admin app as required by the host.

## Implemented API areas

The app uses Admin APIs under `/api/admin/`. Appointment, bill, and payment endpoints are read-only on the server as well as in the UI; Receptionist operations remain the supported booking and payment mutation workflows because they apply the clinic's validation and transactional rules.

Build with `npm run build`; output is written to `dist/`.
