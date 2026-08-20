# Nana backend and manager handover

## purpose

The backend is the trusted API between the Nana frontend, Supabase, and the private backend manager. The manager is for the owner/team to inspect profiles, child profiles, and pain logs without manually opening Supabase tables.

## production urls

- Backend API: https://nanaappbackend.onrender.com
- Backend manager: https://nanabackendmanager.vercel.app

## required render environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL` set to the frontend Vercel URL or a comma-separated list of frontend URLs
- `MANAGER_URL=https://nanabackendmanager.vercel.app`
- `ADMIN_MANAGER_TOKEN` set to a long private value

## required manager environment variable

- `MANAGER_URL=https://nanaappbackend.onrender.com`

In the manager UI, paste only the private admin token. The backend URL is locked to the Render backend.

## important api routes

- `GET /health` backend status
- `POST /api/auth/register` create user
- `POST /api/auth/login` login
- `GET /api/children` list current user's children
- `POST /api/children` create child
- `POST /api/pain-logs` save report
- `GET /api/admin/overview` private manager overview
- `GET /api/admin/profiles` private manager profile list
- `GET /api/admin/children` private manager child list
- `GET /api/admin/pain-logs` private manager pain-report list

## security notes

The service role key must never be placed in the frontend. The frontend talks only to the Express API. Admin manager routes require `ADMIN_MANAGER_TOKEN`. Normal app routes require a signed-in bearer token where user-specific records are involved.

## common deployment checks

1. Open `https://nanaappbackend.onrender.com/health` and confirm `{ "status": "ok" }`.
2. Confirm Render has `MANAGER_URL` set to the manager URL.
3. Confirm Vercel manager has `MANAGER_URL` set to the backend URL.
4. Confirm the manager admin token exactly matches Render's `ADMIN_MANAGER_TOKEN`.
5. If the manager fails from the browser, check backend logs for CORS, token, or Supabase errors.
