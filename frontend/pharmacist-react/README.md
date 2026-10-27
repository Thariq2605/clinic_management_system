# Pharmacist React

Standalone React + Vite frontend for the Pharmacy module. It uses the existing Django Pharmacist APIs and does not share source code with the other React applications.

## Run locally

From `frontend/pharmacist-react/`:

```sh
npm install
npm run dev
```

Vite binds to `127.0.0.1:5503`. Copy `.env.example` to `.env.local` to configure `VITE_API_BASE_URL` and `VITE_SHARED_LOGIN_URL`. The development defaults are `http://127.0.0.1:8000` and `http://127.0.0.1:5504/`. Restart Vite after changing these values.

Run `npm test` for API and route contract checks, and `npm run build` for a production build.

## Authentication

The app signs in through `POST /pharmacist/login/`. Django verifies the supplied password and issues a signed SimpleJWT access token. The app stores it under a Pharmacist-specific localStorage key and validates every startup with `GET /pharmacist/me/`. Resource requests use `Authorization: Bearer <access token>`. Django checks the authenticated active user and active Pharmacist role on each Pharmacist API request. A 401/403 clears the Pharmacist credentials. Network errors show a retry action; expired access tokens require signing in again because this project has no JWT refresh endpoint configured.

The React Shared Login on port `5504` authenticates the Pharmacist role and opens this app's secure handoff at port `5503`. Sign out and expired credentials clear this app's auth state and return to `VITE_SHARED_LOGIN_URL`. Set that variable to the deployment's central login URL in production.

## Current limitations

- Dashboard statistics are derived from the live medicine, prescription, and prescription-medicine APIs. The API does not provide persistent dispensing history.
- The existing UI's low-stock threshold is 20; no server-side threshold or configuration endpoint exists.
- No stock-adjustment, profile editing, password-change, or persistent notification-preference API exists.
- Prescription and prescription-medicine data arrive as separate API results and are joined by prescription ID.
- Dispensing is an individual POST for each active item. Do not retry automatically after a network timeout; refresh the prescription state first.
- The API does not reject expired medicines during dispensing. The legacy UI marks them unavailable, but its backend endpoint does not enforce that check. Resolve this business-rule mismatch before treating expiry as a server-enforced dispensing restriction.

## Backend changes in this task

Pharmacist APIs now require an authenticated active Pharmacist and the dedicated login returns signed JWT credentials. `GET /pharmacist/me/` supplies server-validated profile information. The known fallback-password acceptance was removed from the shared and dedicated login views. Dispensing keeps the existing one-unit decrement but locks the item and stock row in one transaction to prevent concurrent double-dispensing of the same item.
