# Deployment Guide

MediCare ships as a single Vercel project: the React app builds to static assets and the Express API runs as serverless functions behind `/api/*` rewrites. Data lives in [Turso](https://turso.tech) — hosted libSQL (SQLite-compatible) with a generous free tier — because Vercel's filesystem is ephemeral and cannot persist a local database file.

## 1. Create the Turso database

Install the CLI ([docs](https://docs.turso.tech/cli/introduction)), then:

```bash
turso db create medicare
turso db show medicare --url        # → TURSO_DATABASE_URL
turso db tokens create medicare     # → TURSO_AUTH_TOKEN
```

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "feat: initial release"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 3. Import into Vercel

1. Open [vercel.com/new](https://vercel.com/new) and import the repository.
2. Framework preset: **Other** (auto-detected from `vercel.json`).
3. Add environment variables:

| Variable | Value | Notes |
|---|---|---|
| `TURSO_DATABASE_URL` | `libsql://medicare-<you>.turso.io` | from step 1 |
| `TURSO_AUTH_TOKEN` | *(token from step 1)* | mark as sensitive |
| `JWT_SECRET` | long random string | required in production |
| `ALLOWED_ORIGIN` | `https://<your-app>.vercel.app` | optional CORS allow-list |

4. Deploy.

On the first request the API creates the full schema and seeds demo data automatically. Sign in as `admin@hospital.com` / `Admin@123` and **change every demo password immediately** via *Staff Accounts*.

## Local development

No cloud account needed. Without `TURSO_DATABASE_URL` set, the server uses `server/data/hospital.db` on disk:

```bash
cd server && npm install && npm run dev   # API :4000
cd client && npm install && npm run dev   # UI  :3000
```

## Production notes

- **Secrets**: `JWT_SECRET` signs 12-hour sessions; rotate it to force global re-login.
- **Rate limiting** is per-serverless-instance; add Upstash Redis for strict global limits.
- **Reset the local DB**: stop the server, delete `server/data/`, restart.
- **CI**: GitHub Actions validates server syntax and builds the client on every push.
