# Pharmacist Frontend

The current Pharmacist UI is the HTML/CSS/JavaScript app in `frontend/pharmacist/`. This Vite project serves that UI on the port expected by the shared login (`5503`).

## Run locally

From `frontend/pharmacist-react/`:

```sh
npm run dev
```

Start Django on `127.0.0.1:8000` and the shared React login from `frontend/login-react/` on `127.0.0.1:5504` in separate terminals. Vite binds the Pharmacist UI to `127.0.0.1:5503`. Copy `.env.example` to `.env.local` to configure `VITE_API_BASE_URL` and `VITE_SHARED_LOGIN_URL`; restart Vite after changing these values.

Run `npm test` for the Pharmacist API and shared-login handoff contract checks, and `npm run build` for a production build.

## Authentication

The shared login verifies the account role and obtains a Pharmacist JWT from `POST /pharmacist/login/`. It sends the credential through an origin-checked popup handoff. The Pharmacist app validates it with `GET /pharmacist/me/` before storing the Pharmacist-specific session. Resource requests use the same token; a 401/403 clears the session and returns to shared login.

Set `VITE_SHARED_LOGIN_URL` to the deployed central login URL outside local development.

## Current limitations

The Pharmacist dashboard uses the existing Django endpoints. Password changes and persistent notification preferences require backend endpoints that are not currently available.
