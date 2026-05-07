# Nana App — Backend

Express + Supabase REST API for the Nana child pain-tracking app.

---

## What this backend provides

| Route | What it does |
|---|---|
| `POST /api/auth/register` | Create a parent or doctor account |
| `POST /api/auth/login` | Sign in, get JWT tokens |
| `POST /api/auth/logout` | Sign out |
| `GET  /api/auth/me` | Get the signed-in user's profile |
| `GET  /api/children` | List the parent's children |
| `POST /api/children` | Add a child (name, age, optional photo) |
| `GET  /api/children/:id` | Get a single child |
| `PATCH /api/children/:id` | Update a child |
| `DELETE /api/children/:id` | Remove a child |
| `GET  /api/pain-logs?child_id=X` | List pain logs for a child |
| `POST /api/pain-logs` | Save a body-map session |
| `GET  /api/pain-logs/:id` | Get a single pain log with zones |
| `DELETE /api/pain-logs/:id` | Delete a pain log |
| `POST /api/uploads/child-photo` | Upload a child photo (base64 → Supabase Storage) |
| `GET  /health` | Health check |

---

## Local development

### 1 · Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project

### 2 · Clone and install

```bash
cd nana-backend
npm install
```

### 3 · Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role (secret) |
| `SUPABASE_ANON_KEY` | Project Settings → API → anon public |
| `FRONTEND_URL` | Your Vercel deployment URL, e.g. `https://nana-app.vercel.app` |
| `PORT` | Default `3001` |

### 4 · Run the Supabase migration

1. Open the Supabase Dashboard → **SQL Editor** → **New query**
2. Paste the contents of `supabase/001_initial_schema.sql`
3. Click **Run**

This creates the `profiles`, `children`, `pain_logs`, and `pain_zones` tables, sets up Row Level Security policies, and creates the `child-photos` storage bucket.

### 5 · Start the server

```bash
npm run dev
```

The server starts at `http://localhost:3001`.

Test it:

```bash
curl http://localhost:3001/health
# → {"status":"ok"}
```

---

## Deploy to Railway (recommended — free tier available)

Railway auto-detects Node.js and sets `PORT` for you.

1. Push your `nana-backend` folder to a GitHub repo.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select the repo.
4. Click **Variables** and add all the values from your `.env` file.
5. Railway builds and deploys automatically. Copy the public URL (e.g. `https://nana-backend.up.railway.app`).

Alternatively, **Render** works identically — create a Web Service, connect your repo, set the env vars, set the start command to `npm start`.

---

## Connect the frontend

### Step 1 — Add the API client

Copy `frontend-api-client/api.js` into your front-end `src/` folder.

```
nana-app-front-end/
└── src/
    ├── api.js   ← paste here
    ├── main.js
    └── ...
```

### Step 2 — Add an environment variable to Vercel

In the Vercel dashboard for your front-end project:

1. Go to **Settings** → **Environment Variables**
2. Add:
   - **Name:** `VITE_API_URL`
   - **Value:** your Railway/Render backend URL, e.g. `https://nana-backend.up.railway.app`
   - **Environment:** Production (and Preview if you want)
3. Click **Save**, then **Redeploy** your Vercel project.

> During local development, `VITE_API_URL` defaults to `http://localhost:3001` so you don't need to set it.

### Step 3 — Use the API in your screens

**Register + login flow** (wire into `selectRoleScreen.js`):

```js
import { api } from "../api.js";

// When the user picks a role and taps Continue, show a register form, then:
const { access_token, user } = await api.auth.login({ email, password });
// Tokens are stored in localStorage automatically by api.auth.login
```

**Add Child overlay** (wire the Save button in `addChildOverlay.js` or the screens):

```js
import { api } from "../api.js";

// Inside the save-child-button click handler:
const child = await api.children.create({ name, age: Number(selectedAge) });
// Then navigate to #child-added
```

**Load children on the homepage** (wire into `homepageNewUserScreen.js`):

```js
import { api } from "../api.js";

const children = await api.children.list();
// Render child cards dynamically instead of hardcoding "Sunny" and "Leny"
```

**Submit body map data** (wire the Continue button in `ShowpainScreen.js`):

```js
import { api } from "../api.js";

// Collect the tapped zones from the body map's internal state:
// zones = [{ zone_id: "head", side: "front", pain_level: 2 }, ...]

await api.painLogs.create({
  child_id: currentChild.id,
  zones,
  // The following are filled in on subsequent screens:
  pain_type: null,
  when_did_it_start: null,
  pain_scale: null,
});
```

**Upload a child photo** (wire the "+ Add image from Gallery" button in `addChildOverlay.js`):

```js
import { api } from "../api.js";

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/*";
fileInput.click();
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const { url } = await api.uploads.childPhoto(file);
  // Store url, pass it to api.children.create({ ..., photo_url: url })
});
```

---

## Database schema (summary)

```
profiles       id · role · full_name · created_at
children       id · parent_id · name · age · photo_url · created_at
pain_logs      id · child_id · parent_id · pain_type · when_did_it_start · pain_scale · notes · created_at
pain_zones     id · pain_log_id · zone_id · side · pain_level
```

`pain_zones.pain_level` maps to the 5 colour states in `ShowpainScreen.js`:
- `0` = untouched (grey)
- `1` = yellow
- `2` = orange
- `3` = red
- `4` = dark red

---

## Project structure

```
nana-backend/
├── src/
│   ├── index.js                  Express app entry point
│   ├── lib/
│   │   └── supabase.js           Supabase service-role client singleton
│   ├── middleware/
│   │   └── auth.js               JWT verification middleware
│   └── routes/
│       ├── auth.js               /api/auth/*
│       ├── children.js           /api/children/*
│       ├── painLogs.js           /api/pain-logs/*
│       └── uploads.js            /api/uploads/*
├── supabase/
│   └── 001_initial_schema.sql    Run once in Supabase SQL Editor
├── frontend-api-client/
│   └── api.js                    Drop this into the front-end src/
├── .env.example
└── package.json
```
