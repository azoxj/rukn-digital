# AZENK platform — server products

Three full-stack products built on one shared core:

| Product | Roles | Default port |
|---|---|---|
| **AZENK Call Center** (`apps/callcenter`) | SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT | 4100 |
| **AZENK Graduation** (`apps/graduation`) | ADMIN, SUPERVISOR, STUDENT | 4200 |
| **AZENK Requests** (`apps/requests`) | ADMIN, MANAGER, EMPLOYEE | 4300 |

No third-party runtime dependencies: Node.js built-ins (`node:http`, `node:crypto`,
`node:sqlite`) only. Requires **Node.js 22.13+**. (Dev dependencies are used only to build the browser demos.)

```
platform/
  core/              shared server + UI kit
    db.js            SQLite (node:sqlite), migrations runner, transactions
    http.js          router, body limits, security headers, CSRF/origin checks, static files
    auth.js          sessions, login/logout/me/password, login rate limits, RBAC check
    common-routes.js users, organisations, notifications, audit log
    validate.js      request validation (Arabic field messages)
    security.js      scrypt hashing, tokens, rate limiter
    files.js         validated uploads (allow-list + magic bytes), attachment downloads
    migrations/      core schema (organisations, users, sessions, notifications, audit_log)
    public/          ui.js + ui.css (API client, shell, router, forms, tables, charts)
  apps/<app>/        app.js (permissions + routes), migrations/, public/, seed.js, server.js
  scripts/           bootstrap, seed-demo, check
  tests/             node:test API tests (68)
```

## Run locally

```bash
cd platform
npm test                                   # 68 API tests (in-memory DBs)

# Try it with fictional demo data (refuses to touch a non-empty DB):
DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app callcenter
npm run callcenter                         # http://127.0.0.1:4100

DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app graduation
npm run graduation                         # http://127.0.0.1:4200

DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app requests
npm run requests                           # http://127.0.0.1:4300
```

### AZENK Requests in short
- Admins define **request types**: fields (text, long text, number, date, list, checkbox) and an ordered
  **approval path** where each step is the requester's direct manager, any user with a role, or a named
  user, plus a response time (SLA) per step. Four starter types can be installed with one click.
- Requests keep a snapshot of their type, so editing a type never changes submitted requests.
- Approvers approve, reject or return for changes (comment required for reject/return); the requester
  edits and resubmits. Nobody can approve their own request (it is routed to another admin instead).
- Managers are set per employee (with cycle protection) and used to route "direct manager" steps.

Demo accounts use `example.com` e-mails (e.g. `admin@example.com`, `supervisor@example.com`,
`agent1@example.com` / `student1@example.com`). Without `DEMO_PASSWORD` a random password is
generated and printed once.

## Public browser demos (GitHub Pages)

```bash
npm install          # dev dependencies for the demo build only (esbuild, sql.js, @noble/hashes, buffer)
npm run build:demo   # writes ../demos/<app>/ — commit the output
```

Each demo bundles the **same** app definition, routes, validation, RBAC, audit and seed code and runs it
in the visitor's browser: `node:sqlite` is replaced by sql.js (SQLite in WebAssembly), `node:crypto` by
Web Crypto + @noble/hashes, and the frontend's `fetch("/api/...")` calls are answered in-page by the
same request handler (`demo/runtime.js`, shims in `demo/shims/`). Every visitor gets a private,
freshly seeded database with quick-login buttons for each role; nothing leaves the browser and a page
reload resets it. Demo-only differences: scrypt cost 2^10 instead of 2^15, uploads kept in memory.
Real installations still run on the Node server below.

## Start a real installation

```bash
npm run bootstrap -- --app callcenter --org "Company name" --slug company --name "Admin name" --email admin@company.sa
```

Creates the first organisation and its top-level account (SUPER_ADMIN for Call Center, ADMIN
for Graduation) on an empty database and prints a one-time temporary password that must be
changed at first sign-in. Every other account is created inside the app; new users get a
temporary password shown once to the admin.

Configuration is through environment variables only — see `.env.example`. Never commit `.env`
or database files (`data/` is git-ignored).

## Security model

- Passwords: scrypt (N=2^15, per-hash salt and parameters), policy 10+ chars with letters and digits.
- Sessions: random 256-bit token in an `HttpOnly; SameSite=Strict` cookie (`Secure` when
  `COOKIE_SECURE=1`); only its SHA-256 is stored. 12 h idle / 7 day absolute expiry; sessions are
  revoked on password change, role change and deactivation.
- CSRF: per-session token required in `X-CSRF-Token` for every mutation, plus same-origin check
  and JSON-only bodies.
- Rate limits: 5 failed logins per account+IP / 15 min, 30 per IP, 600 API requests/min per IP
  (in-memory — use a shared store if you run several instances).
- RBAC on every route; tenant isolation: every query is scoped by the user's `org_id`, and
  records of other organisations answer 404.
- Audit log: append-only (SQLite triggers block UPDATE/DELETE).
- Uploads (Graduation): extension allow-list + magic-byte check, 15 MB limit, stored under random
  keys outside the web root, served only through an authorised download route as attachments.
- Headers: strict CSP (no inline scripts/styles), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, HSTS when `COOKIE_SECURE=1`.
- CSV exports neutralise spreadsheet formulas.

## Honest scope (what is NOT included)

- Call Center: calls are **logged** by agents (with an in-app timer). There is no telephony/VoIP,
  call recording, WhatsApp, SMS, CRM or AI integration. The `calls.provider`, `provider_ref` and
  `recording_url` columns are reserved for a future integration and stay empty.
- E-mail/SMS delivery is not implemented: notifications are in-app (all three products).
- Hosting is not configured. These apps need a Node.js host with persistent disk (they cannot run
  on GitHub Pages). Put them behind HTTPS (reverse proxy) with `COOKIE_SECURE=1` and
  `TRUST_PROXY=1`, and back up the `data/` directory.
