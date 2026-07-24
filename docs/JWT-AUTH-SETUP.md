# JWT Auth Setup (Option A)

EduOS supports **server-side JWT auth** when Neon + secrets are configured. Without them, the app keeps **local demo auth** (passwords in browser storage).

## Enable auth

1. Set in `.env` (local) or **Vercel → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Signs short-lived access tokens (~15 min) |
| `JWT_REFRESH_SECRET` | Used with refresh token rotation (stored hashed in DB) |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

Run twice — one value per secret.

2. Apply schema + migrate users:

```bash
npm run migrate
```

3. Start the server:

```bash
npm start
```

4. Check health:

```bash
curl http://127.0.0.1:8888/api/health
```

Expect: `{ "ok": true, "db": true, "auth": true }`

## How it works

| Piece | Behavior |
|-------|----------|
| **Login** | `POST /api/auth/login` → access token (JSON) + refresh cookie (`eduos_refresh`, httpOnly) |
| **Refresh** | `POST /api/auth/refresh` → new access token |
| **API data** | `GET/PUT/DELETE /api/state` requires `Authorization: Bearer <token>` when auth enabled |
| **Passwords** | Stored as scrypt hashes in `auth_users` — stripped from JSON blob on save |
| **Demo sync** | First login runs migration from legacy `users[].password` in app_state → `auth_users` |

## Vercel

- Add the three env vars for **Production** (and Preview if needed).
- Redeploy after saving variables.
- Auth routes live under `/api/auth/*` (serverless handlers).

## Local-only mode

If `JWT_SECRET` / `JWT_REFRESH_SECRET` are missing, `/api/health` returns `"auth": false` and the UI uses the existing client-side login.
