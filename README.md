# Tutorsala

Tuition-center management: CRM and leads, batches and auto-scheduled classes, attendance,
tests, homework, billing, parent communication, a family portal, an AI assistant and a
public marketplace of centers.

Plain HTML, CSS and JavaScript in the browser (no build step), with a Node server and
PostgreSQL (Neon) behind it. Deployed on Vercel.

## Two ways to run

| Mode | When | Data |
|------|------|------|
| **Server mode** | `DATABASE_URL`, `JWT_SECRET` and `JWT_REFRESH_SECRET` are set | PostgreSQL. Sign-in, permissions and API keys are handled on the server. |
| **Browser-only demo** | Any of those is missing | Saved in the browser (localStorage) with built-in demo logins. AI is rule-based and WhatsApp messages are simulated. Nothing is shared between browsers. |

`GET /api/health` says which one is active: `{ "db": true, "auth": true }` means server mode.

## Getting started

Needs Node 22 (see `.nvmrc`).

```bash
npm install
cp .env.example .env      # then fill in the values (see below)
npm run migrate           # create or update the database tables
npm run seed:demo         # optional: demo center and logins
npm start                 # http://127.0.0.1:8888
```

> **`npm start` also runs migrations** against whatever `DATABASE_URL` points to. Point `.env`
> at a development database, not production, when working locally.

### Settings (`.env` locally, Vercel → Settings → Environment Variables in production)

| Variable | Needed | What it does |
|----------|--------|--------------|
| `DATABASE_URL` | Server mode | Neon / PostgreSQL connection string |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Server mode | Sign the sign-in tokens. Generate each with `node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"` |
| `SECRETS_ENCRYPTION_KEY` | To save OpenAI / WhatsApp keys | Encrypts center API keys. 32 random bytes, base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Losing it makes saved keys unreadable**; centers then re-enter them. |
| `APP_URL` | Production | Public address used in password-reset links, e.g. `https://www.tutorsala.com` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Production | Sends password-reset emails through [Resend](https://resend.com). Without it, no reset email is sent, so new logins (which start without a password) can't sign in. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional | Platform-wide OpenAI key for centers that haven't added their own. Model defaults to `gpt-4o-mini`. |
| `ENABLE_DEMO_SEED` | Optional | Demo seeding and demo shortcuts. On by default locally, off in production. |
| `ALLOWED_ORIGINS` | Optional | Other sites allowed to call the API (comma-separated). Same-site needs nothing. |
| `TEST_DATABASE_URL` | Optional | Database for `npm run test:db`; defaults to `DATABASE_URL`. |

The server refuses to start in production without `DATABASE_URL` and both JWT secrets.

## Roles and what they can see

Enforced on the server (`js/sync-rules.js`, `server/services/access.js`); the browser only
receives what the role may see.

| Role | Sees | Can change |
|------|------|------------|
| **Platform owner** | All centers with counts; opens any center as its admin | Center status (suspend / activate). Everything they change inside a center is written to `audit_log`. |
| **Center admin** | Everything in their center | Everything in their center, logins for their center, API keys |
| **Teacher** | Their batches, those batches' students, attendance, tests, homework | Attendance, tests, homework, lesson plans and feedback for their batches; session status and notes on their batches |
| **Parent / family / student** | Their own children only. Attendance and marks are reduced to their children. | Homework submissions for their children, notification preferences, messages to their children's teacher |

## Deploying

Pushing to `main` deploys to Vercel production. When a release adds a migration
(`server/migrations/`), run `npm run migrate` against the production database right after
the deploy finishes.

## How it fits together

```
index.html, start-page.html   App shell and the Meta-ads landing page
js/                            Browser code (no build step)
  store.js                     Data layer: localStorage, or /api/bootstrap + /api/sync
  sync-rules.js                Collections and the per-role rules (shared with the server)
  auth.js, api-client.js       Sign-in, tokens, API calls
api/index.js                   The single Vercel function; vercel.json routes /api/* to it
server/
  router.js                    Every /api route
  index.js                     Local Express server (same router, plus static files)
  services/                    bootstrap, sync, access rules, users, integrations, inquiries
  db/                          centers and records tables
  migrations/                  Applied in order by npm run migrate
test/                          npm test (no database) and test/db (npm run test:db)
```

Data lives in `centers` and `records` (one row per student, batch, lead and so on, per
center). The browser loads `/api/bootstrap` after sign-in and sends only the records it
changed to `/api/sync`. Each change is checked against the role rules and a version number,
so two people editing the same record get a conflict instead of silently overwriting each
other.

### API

| Route | Who |
|-------|-----|
| `POST /api/auth/login`, `logout`, `refresh`, `register-center`, `forgot-password`, `reset-password`; `GET /api/auth/me`, `reset-password-info` | Sign-in and accounts |
| `GET /api/bootstrap`, `POST /api/sync` | Signed in |
| `POST /api/users`, `PATCH /api/users/:id` | Center admins |
| `PUT /api/settings/secrets`, `POST /api/api-keys`, `DELETE /api/api-keys/:id` | Center admins |
| `POST /api/ai/chat`, `POST /api/whatsapp/send` | Signed in (families may only message their children's teacher) |
| `GET /api/public/centers`, `POST /api/public/centers/:id/inquiries` | Anyone (inquiries are rate-limited) |
| `POST /api/leads` | Anyone: demo requests from `start-page.html` |
| `GET`, `PATCH /api/leads` | Platform owner |

`test/route-auth.test.js` fails if a new route forgets its sign-in check.

## Tests

```bash
npm run lint
npm test          # no database needed; runs in CI
npm run test:db   # database tests, each in a throwaway schema that is dropped afterwards
```

## Meta ads landing page

`start-page.html` is the funnel page for tuition-center owners coming from ads. Use it as the
ad destination with UTM tags:

```text
https://www.tutorsala.com/start-page.html?utm_source=Meta+Ads&utm_campaign=...
```

Each submission is saved through `POST /api/leads`, and the UTM tags are kept with it. The
platform owner sees the requests under **Demo requests**.

## Center features

- **Batches and schedule:** pick days and times, add topics (one class each) and
  **Auto-Generate Schedule** creates dated classes with Meet / Zoom / Teams links.
- **WhatsApp:** a center admin adds the Meta WhatsApp Business **API Access Token** and
  **Phone Number ID** under **Settings**. Without them, messages are simulated and logged.
  **Open in WhatsApp Web** works without an API account.
- **AI assistant:** rule-based out of the box. With an OpenAI key (the center's own in
  **Settings**, or the platform's `OPENAI_API_KEY`) it answers with GPT, on the server, using
  only data the asking user may see.
