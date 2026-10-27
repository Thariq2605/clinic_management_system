# Laboratory Technician React workspace

Standalone Vite interface for a Laboratory Technician to view assigned test items and create or update one text result per item. The API checks the active Technician role and item assignment for every request.

```powershell
cd frontend/receptionist-react/lab-technician-react
npm run dev
```

Open `http://127.0.0.1:5505/`. Start Django on `http://127.0.0.1:8000/` and Shared Login on `http://127.0.0.1:5504/`. Sign in through Shared Login using an active Laboratory Technician account; the browser opens this workspace in a new tab. Sign out to clear the local Technician tokens and return to Shared Login.

Optional `.env.local` values are `VITE_API_BASE_URL` and `VITE_SHARED_LOGIN_URL`. The defaults are `http://127.0.0.1:8000` and `http://127.0.0.1:5504/`.

Run `npm test` for frontend contract checks and `npm run build` for the production bundle. These checks do not replace browser verification against Django.
