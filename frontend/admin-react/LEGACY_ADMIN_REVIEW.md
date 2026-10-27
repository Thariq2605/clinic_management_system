# Legacy Admin and React Admin integration review

## Current entry and authentication flow

- The React Admin app is served by Vite on port `5502`. Its routes include `/` and `/pages/admin_dashboard.html`; both render the React dashboard.
- The React Shared Login app maps Administrator and Admin roles to port `5502`. It calls Django `/api/login/`, opens `/auth-handoff.html?role=admin`, and sends the short-lived login result with the `CLINIC_AUTH_READY`, `CLINIC_AUTH_PAYLOAD`, and `CLINIC_AUTH_COMPLETE` postMessage contract.
- Admin's `public/auth-handoff.js` validates the received token against `/api/admin/me/`, then stores `admin_token`, `access_token`, and `current_user`. `AuthContext` revalidates that credential before showing protected routes.
- React Admin logout clears its Admin credentials and returns to the configured Shared Login URL. Invalid or non-Admin credentials use the same destination.
- The legacy `frontend/login.html` path remains available. Admin Vite's `existingSharedLogin` plugin serves that file and its shared `/js/api.js`, `/js/common.js`, `/js/auth.js`, `/css/style.css`, `/css/login.css`, and favicon assets. Legacy `frontend/js/auth.js` sends legacy Admin login to `pages/admin_dashboard.html` and implements the legacy logout redirect to `login.html`.

## Legacy files still used or retained for fallback

- `frontend/login.html`, `frontend/js/auth.js`, `frontend/js/api.js`, `frontend/js/common.js`, and `frontend/css/style.css` are shared login or legacy authentication assets; Vite explicitly serves several of these paths.
- `frontend/pages/admin_dashboard.html` and the pages under `frontend/pages/` are the legacy Admin interface. Their HTML references `../css/admin.css`, `../js/api.js`, `../js/auth.js`, and `../js/admin.js`; the dashboard also loads `../js/dashboard.js`.
- `frontend/pages/login.html` is a redirect shim to the shared `frontend/login.html` path and remains a compatibility entry.
- `frontend/admin-react/public/auth-handoff.html` and `.js` are runtime assets for React login handoff. Equivalent role-specific handoff assets are also present in the other React apps.
- The Admin README documents the legacy dashboard URL as a rollback/host-routing path. Deployment routing must be configured by the host; this repository review does not establish live deployment behavior.

## Cleanup candidates

No legacy file in the reviewed Admin login, dashboard, or shared asset paths was confidently identified as unused: the React Vite config, React Router, legacy HTML script/link references, and README all establish active runtime or fallback dependencies. Keep the files in place. A future cleanup can remove a candidate only after checking deployed host routes and the rollback window.

## Verification limits

This is a source-level dependency review. It does not verify browser navigation, popup permissions, cross-origin messaging in a deployed environment, or the host's handling of `/pages/admin_dashboard.html`.
