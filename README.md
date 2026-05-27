# Nana App — Backend

Express + Supabase backend API for Nana, a child pain communication and tracking app.

## Project Information

| Item | Details |
|---|---|
| Product | Nana |
| Purpose | Store child profiles, uploaded child images, and pain reports |
| Backend stack | Node.js, Express, Supabase |
| Database | Supabase Postgres |
| Storage | Supabase Storage bucket `child-photos` |
| Deployment | Render |
| Production API | https://nanaappbackend.onrender.com |

## Setup

### Requirements

- Node.js 18+
- npm
- Supabase project
- Supabase service role key

### Install

```bash
npm install
```

### Environment Variables

Create `.env` in the backend root:

```env
PORT=3001
FRONTEND_URL=https://nana-app-frontend.vercel.app

SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Run locally

```bash
npm run dev
```

### Run production

```bash
npm start
```

### Health Check

```http
GET /health
```

Expected response:

```json
{ "status": "ok" }
```

## API Overview

Base URL:

```text
https://nanaappbackend.onrender.com
```

## Endpoints

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Confirms backend is running |

### Authentication

The final assignment says no authentication is required for grading. Nana still includes auth endpoints, but the app also supports a skip/testing flow so graders can access the product.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user profile |

### Children

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/children` | List children |
| POST | `/api/children` | Add a child |
| GET | `/api/children/:id` | Get one child |
| PATCH | `/api/children/:id` | Update child profile |
| DELETE | `/api/children/:id` | Delete child profile |

Example child payload:

```json
{
  "name": "Sunny",
  "age": 4,
  "photo_url": "https://..."
}
```

### Uploads

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/uploads/child-photo` | Upload child profile image to Supabase Storage |

Example upload payload:

```json
{
  "data_url": "data:image/png;base64,..."
}
```

Example response:

```json
{
  "url": "https://your-project.supabase.co/storage/v1/object/public/child-photos/example.png"
}
```

### Pain Logs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pain-logs?child_id=...` | List pain logs for a child |
| POST | `/api/pain-logs` | Save pain report |
| GET | `/api/pain-logs/:id` | Get one pain report |
| DELETE | `/api/pain-logs/:id` | Delete pain report |

Example pain log payload:

```json
{
  "child_id": "uuid",
  "pain_type": "sharp",
  "when_did_it_start": "2026-05-26T10:00:00.000Z",
  "pain_scale": 8,
  "notes": "Pain after playing football",
  "zones": [
    {
      "zone_id": "left-knee",
      "side": "front",
      "pain_level": 1
    }
  ]
}
```

## Database Schema

Use this schema in Supabase / drawSQL.

### `profiles`

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, references auth.users |
| role | text | parent or doctor |
| full_name | text | User display name |
| created_at | timestamptz | Created timestamp |

### `children`

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| parent_id | uuid | References profiles.id |
| name | text | Child name |
| age | smallint | 1 to 18 |
| photo_url | text | Public child image URL |
| created_at | timestamptz | Created timestamp |

### `pain_logs`

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| child_id | uuid | References children.id |
| parent_id | uuid | References profiles.id |
| pain_type | text | Pain type |
| when_did_it_start | timestamptz | Start time |
| pain_scale | smallint | 1 to 10 |
| notes | text | Optional notes |
| created_at | timestamptz | Created timestamp |

### `pain_zones`

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| pain_log_id | uuid | References pain_logs.id |
| zone_id | text | Body part identifier |
| side | text | front or back |
| pain_level | smallint | selected pain zone level |

## Database Relationship Summary

```text
auth.users
   ↓
profiles
   ↓
children
   ↓
pain_logs
   ↓
pain_zones
```

## Storage

Bucket:

```text
child-photos
```

Purpose:

```text
Stores uploaded child profile photos.
```

## Submission Checks

Before submitting:

```bash
git status
npm install
npm start
```

Make sure:

- backend is deployed online
- `/health` returns `{ "status": "ok" }`
- README includes API info, setup, endpoints, and database schema
- main, staging, and develop are synced
