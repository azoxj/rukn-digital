# AZENK platform — server products

Three full-stack products and the demo gateway, built on one shared core:

| Product | Roles | Default port |
|---|---|---|
| **AZENK Call Center** (`apps/callcenter`) | SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT | 4100 |
| **AZENK Graduation** (`apps/graduation`) | ADMIN, SUPERVISOR, STUDENT | 4200 |
| **AZENK Requests** (`apps/requests`) | ADMIN, MANAGER, EMPLOYEE | 4300 |
| **AZENK Demo Center** (`apps/democenter`) | staff: SUPER_ADMIN, ADMIN · customers: per-request demo accounts | 4400 |

No third-party runtime dependencies: Node.js built-ins (`node:http`, `node:crypto`,
`node:sqlite`) only. Requires **Node.js 22.13+**. (Dev dependencies are used only for the optional offline browser-preview build.)

```
platform/
  core/              shared server + UI kit
    db.js            SQLite (node:sqlite), migrations runner, transactions
    http.js          router, body limits, security headers, CSRF/origin checks, static files
    auth.js          sessions, login/logout/me/password, login rate limits, RBAC check
    common-routes.js users, organisations, notifications, audit log
    validate.js      request validation (Arabic field messages)
    security.js      scrypt hashing, tokens, rate limiter
    clock.js         injectable clock (system clock in production, fake clock in tests)
    files.js         validated uploads (allow-list + magic bytes), attachment downloads
    migrations/      core schema (organisations, users, sessions, notifications, audit_log)
    public/          ui.js + ui.css (API client, shell, router, forms, tables, charts)
  apps/<app>/        app.js (permissions + routes), migrations/, public/, seed.js, server.js
  scripts/           bootstrap, seed-demo, check
  tests/             node:test API tests (94) + tests/e2e/ browser flows
```

## Run locally

```bash
cd platform
npm test                                   # 94 API tests (in-memory DBs)

# Try it with fictional demo data (refuses to touch a non-empty DB):
DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app callcenter
npm run callcenter                         # http://127.0.0.1:4100

DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app graduation
npm run graduation                         # http://127.0.0.1:4200

DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app requests
npm run requests                           # http://127.0.0.1:4300

DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app democenter   # staff accounts only
npm run democenter                         # http://127.0.0.1:4400  (staff: /admin/)
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

## AZENK Demo Center (`apps/democenter`)

This is the only way customers try AZENK products. Each customer gets their own demo account.
There are no shared or public demo logins.

### Lifecycle (current phase: manual, regular WhatsApp)

There is no WhatsApp Business API, bot, automatic message reading or paid provider. WhatsApp is
only a `wa.me` link with a ready message.

```
website «اطلب Demo» ─► regular WhatsApp (966507192393 from config.js) with a ready message:
                       "السلام عليكم،\nأرغب في تجربة نظام <النظام>.\n\nالاسم:\nاسم المنشأة:\nعدد المستخدمين:\nملاحظات:"
staff read it on their phone ─► /admin/ «+ حساب تجريبي»: name, phone, e-mail (optional), company,
                 one or more systems ─► random username + strong random password (shown once)
                 card: name · systems · username · password · first login · end of 24 h · status
                 «نسخ بيانات الدخول» ─► paste into the customer's WhatsApp chat by hand
customer logs in ─► first successful login: activated_at = now, expires_at = now + 24 h  (ACTIVE)
Demo Center ─► a card per granted product ─► /demo-target/<product>/ (gate checks every request)
expires_at passes ─► EXPIRED: «انتهت فترة التجربة» + «طلب النظام» / «التواصل مع AZENK» (WhatsApp)
```

- **One open account per customer.** An account that is not started, active or suspended blocks
  a second one for the same phone (any format: `05…`, `9665…`, `+9665…`) or e-mail. The API
  answers `409 DEMO_EXISTS` with that account. The admin UI then offers to add the new systems to
  it; the password and the 24 h window stay the same. After expiry, a new trial can be created.
- **The optional web request form** (`POST /api/demo/requests`, staff «طلبات Demo») still works.
  Approving a request for a customer with an open account takes `add_to_account`. Nothing links
  to the form: the portal's «اطلب Demo» page also opens WhatsApp.
- **When the 24 hours start:** at the first successful login, not at account creation. Until then,
  `activated_at` and `expires_at` are `NULL`. Later logins never move `expires_at`.
- **Warnings:**
  - at 2 h: «تنتهي تجربتك خلال ساعتين.»
  - at 30 min: «تبقى 30 دقيقة على انتهاء تجربتك.»
- **Countdown:** computed from the server time returned by `/api/demo/status`, kept as an offset
  from the device clock. It is display only.
- **Staff actions:**
  - suspend and re-activate an account;
  - extend by 24 h (from the later of now and the current expiry);
  - extend by a custom number of hours (SUPER_ADMIN only);
  - expire an account now;
  - grant and revoke products;
  - reset the password (this ends all sessions);
  - reset demo data (staff only, never the customer).

### Architecture

```
apps/democenter/
  migrations/001_democenter.sql  demo_requests, demo_accounts, demo_sessions,
                                 demo_account_products, demo_password_requests
  service.js     account lifecycle: create, login (+activation), authenticate, grant/revoke,
                 suspend/activate, extend, expire, reset password, sweep — all on an injected clock
  app.js         routes: public (/api/demo/config|catalog|requests|forgot), customer (/api/demo/*),
                 staff (/api/admin/*) + core users / audit / notifications
  gateway.js     /demo-target/<product>/… — access gate in front of every product page, asset and API
  instances.js   isolated, freshly seeded server-product instance per demo account
  products.js    product catalogue + configurable links
  center.js      assembles app + gateway + instances + expiry sweep
  public/        customer portal (index.html, portal.js, portal.css) and staff UI (admin/)
```

Demo Center has two separate identities:

- **Staff** are core `users`. They use the cookie `azk_democenter_sid` and the roles SUPER_ADMIN
  and ADMIN.
- **Customers** are `demo_accounts` with their own sessions and the cookie `azk_demo_sid`.

A demo session can never call `/api/admin/*`, and a staff session is not a demo session.

### Schema (summary)

| Table | Key columns |
|---|---|
| `demo_requests` | customer_name, phone, email, company_name, products (JSON), users_count, notes, status `PENDING/APPROVED/REJECTED/COMPLETED/CANCELLED`, demo_account_id, decided_by/at |
| `demo_accounts` | username (unique), password_hash (scrypt), customer data, status `PENDING/ACTIVE/EXPIRED/SUSPENDED`, created_at, activated_at, expires_at, last_login_at, data_version |
| `demo_sessions` | id = SHA-256 of the cookie token, demo_account_id, csrf_token, ip, user_agent |
| `demo_account_products` | demo_account_id, product_id, granted_at/by, revoked_at/by (one active grant per product) |
| `demo_password_requests` | «نسيت كلمة المرور» requests for staff to handle (generic answer to the customer) |

Every action is written to the core append-only `audit_log`:

- account events: `demo_request.created`, `demo.created`, `demo.activated`, `demo.expired`,
  `demo.expired_by_admin`, `demo.extended`, `demo.suspended`, `demo.reactivated`;
- session events: `demo.login`, `demo.login_failed`, `demo.logout`;
- product events: `demo.product_granted`, `demo.product_revoked`, `demo.product_opened`;
- password and data events: `demo.password_reset`, `demo.password_reset_requested`,
  `demo.data_reset`.

Passwords are never logged.

### Enforcement (server side, every sensitive request)

Each request must pass four checks:

1. a valid demo session (cookie → SHA-256 lookup);
2. account status ACTIVE;
3. `expires_at` compared with the server clock;
4. an active grant for the product.

These checks run in `/api/demo/*` and in the gateway, for every page, static file and API call under
`/demo-target/<product>/`. When a check fails:

- pages redirect to `#/expired`, `#/no-access` or `#/login`;
- APIs answer `401 NO_SESSION`, `403 EXPIRED`, `403 SUSPENDED` or `403 NO_ACCESS`.

Changing the device clock does not change the result.

### Product access

| Product | Kind | How the demo runs |
|---|---|---|
| AZENK Call Center, AZENK Graduation, AZENK Requests | **Server** | Runs the real app code. Each demo account gets its own SQLite instance, seeded with fictional data, under `data/democenter-files/demo-instances/acc-<id>/v<data_version>/`. Seeded users have random passwords that nobody knows. The customer picks a role, and the gateway opens a product session for that role's user (`POST /demo-target/<p>/api/demo-sso`). Product cookies are scoped to `/demo-target/<p>/`. |
| AZENK HR, FleetPro, ClinicFlow, AZENK Presentations | **Browser** (honestly labelled) | The existing static apps, served only through the gate. A demo bar shows the countdown and a link back to Demo Center, and re-checks `/api/demo/status`. Their data still lives in the visitor's browser (localStorage), so they are not server SaaS. Local data is cleared when the account or its data version changes. Server editions are on the gap-analysis roadmap. |

Product links are set in configuration only (`products.js`):

- The default link is `/demo-target/<id>/`.
- Override one product with `DEMO_PRODUCT_URL_<ID>` (e.g. `DEMO_PRODUCT_URL_CALL_CENTER`).
- Override all products at once with `DEMO_PRODUCT_URLS` (JSON).
- Move the base with `DEMO_TARGET_BASE`, e.g. for future sub-domains such as
  `https://hr.demo.azenk.sa/`.

A product moved to its own sub-domain must enforce the same checks, for example by calling
`/api/demo/access/<product>`.

### API

Customer endpoints:

- `POST /api/demo/login`, `POST /api/demo/logout`
- `GET /api/demo/me`, `GET /api/demo/status`
- `GET /api/demo/products`, `GET /api/demo/access/:product`
- `POST /api/demo/requests`, `POST /api/demo/forgot`
- `GET /api/demo/config`, `GET /api/demo/catalog`

Staff endpoints:

- `GET /api/admin/stats`
- `GET /api/admin/demo-requests[/:id]`
- `POST /api/admin/demo-requests/:id/approve|reject|cancel`
- `GET|POST /api/admin/demos`
- `GET /api/admin/demos/:id`
- `POST /api/admin/demos/:id/suspend|activate|expire|extend|products|reset-password|reset`
- `GET /api/admin/password-requests`, `POST /api/admin/password-requests/:id/close`
- `GET /api/search`
- plus the core `/api/users`, `/api/audit`, `/api/notifications`

### Security controls

- **Passwords and credentials:** scrypt password hashes and generated one-time passwords.
  Credentials never appear in URLs or query strings, the frontend, or the repo.
- **Cookies and requests:**
  - HttpOnly and SameSite=Strict cookies (Secure with `COOKIE_SECURE=1`);
  - the demo cookie's lifetime is capped at the account's expiry;
  - a CSRF token and a same-origin check on every mutation;
  - JSON-only bodies.
- **Rate limits** (in memory; use a shared store if you run several instances):
  - login: 5 per 15 min per username and IP (`DEMO_LOGIN_MAX`), plus 30 per IP;
  - demo requests: 5 per hour per IP (`DEMO_REQUEST_MAX`), plus a honeypot field;
  - forgot-password: 5 per hour;
  - staff APIs: 120 per 10 min per user (`DEMO_ADMIN_MAX`).
- **No IDOR:** customer routes never take an account id; their own session identifies them.
  Staff routes are RBAC-checked. Demo Center itself is single-organisation (AZENK staff).
- **Isolation:**
  - one instance per account and one cookie path per product;
  - no production data — instances only ever contain seeded fictional data.
- **WhatsApp number:** read from the site's `config.js` (`AZENK_WHATSAPP` overrides it) and not
  copied into Demo Center files.

### Local development and tests

```bash
DEMO_PASSWORD='Choose-a-pass-2026' npm run seed:demo -- --app democenter
npm run democenter                       # portal http://127.0.0.1:4400/  staff /admin/
node --test tests/democenter.test.js     # 26 API tests with a fake clock (T+1h, T+23h, T+24h, T+25h)
NODE_PATH_PW=$(npm root -g)/playwright node --disable-warning=ExperimentalWarning tests/e2e/democenter.e2e.mjs
```

The E2E test runs the full flow in Chromium against an in-process server with a fake clock:

1. the customer's «اطلب Demo» opens WhatsApp with the ready message;
2. staff create the account by hand, copy the credentials, and add a system to the same account
   instead of creating a duplicate;
3. the customer logs in;
4. product A (browser) opens;
5. product B (server, role SSO) opens;
6. logout and login again keep the same expiry;
7. the 2 h and 30 min warnings show;
8. after expiry, the portal, product pages and product APIs are blocked;
9. staff extend the account and the customer can log in again.

### Deployment (not done — needs approval)

Demo Center is a Node server, so it cannot run on GitHub Pages. It needs:

- Node 22.13+;
- persistent disk for `data/`;
- an HTTPS reverse proxy, with `COOKIE_SECURE=1` and `TRUST_PROXY=1`;
- `npm run bootstrap -- --app democenter …` to create the first SUPER_ADMIN;
- the repo checked out next to it (browser products and the WhatsApp number are read from the
  site files);
- backups.

Then set `DEMO_CENTER_URL` in the site's `config.js` to show «تسجيل الدخول إلى Demo Center».
«اطلب Demo» stays on WhatsApp.

### Offline browser previews (not published)

`npm run build:demo` still bundles the server apps to run entirely in a browser (sql.js +
@noble/hashes) into `../demos/`, for offline sales previews. Its output is git-ignored and excluded
from GitHub Pages, because these previews use a shared demo login and customer demos must not.

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
- E-mail/SMS delivery is not implemented: notifications are in-app (all products). Demo Center
  credentials are shown once to staff, who send them to the customer themselves.
- Hosting is not configured. These apps need a Node.js host with persistent disk (they cannot run
  on GitHub Pages). Put them behind HTTPS (reverse proxy) with `COOKIE_SECURE=1` and
  `TRUST_PROXY=1`, and back up the `data/` directory.
