# AZENK — Product Gap Analysis

Date: 2026-10-03. Rule: an idea becomes an "AZENK product" on the site only once it is programmed and tested.
Nothing in this document is shown on the website.

Size: S ≈ 1–2 weeks · M ≈ 3–6 weeks · L ≈ 2+ months (one developer).
Reuse: **core** = `platform/core` (auth, sessions, CSRF, RBAC, tenants, audit, notifications, UI kit); **CC** = Call Center modules (customers, tickets, tasks); **GR** = Graduation modules (projects, milestones, files, evaluation).

| # | Idea | Problem | Target customer | Core features | Reusable code | Size | Priority | Product? |
|---|---|---|---|---|---|---|---|---|
| 1 | **AZENK HR — server edition** | The HR demo stores data in the browser; companies need real accounts and a shared DB | SMEs already interested in AZENK HR | Port employees, attendance, leave, approvals and payroll to the server; keep the existing UI | core + all `easyhr/` UI and business rules (`engine.js`) | L | **1** | Yes — upgrades an existing product |
| 2 | **AZENK Requests / Approvals** — ✅ built | Internal requests (purchase, leave, IT, maintenance) handled on paper or chat | Any organisation, government suppliers | Request types with custom fields, multi-step approvals, SLA, attachments, reports | core + CC tickets/history + GR files | M | **2** | Yes — small, high value, mostly reuse |
| 3 | **AZENK Appointments** | Booking by phone with conflicts and no reminders | Clinics, salons, consultants, training centres | Services, staff calendars, conflict checks, public booking page, reminders (in-app/e-mail) | core + ClinicFlow scheduling rules | M | 3 | Yes |
| 4 | **AZENK Fleet (server)** | FleetPro is browser-only | Transport & contracting companies | FleetPro modules on core; Easy Fleet branch is a reference for schema | core + FleetPro UI + Easy Fleet schema (other branch) | L | 4 | Yes, after #1 |
| 5 | **AZENK Forms & Surveys** | Paper forms, scattered Google Forms | Schools, HR teams, events | Form builder, validation, responses table, CSV export, access control | core + validate.js | S–M | 5 | Optional — good add-on, low differentiation |
| 6 | **AZENK Quotes & Invoices** | Quotes in Word/Excel, no follow-up | Freelancers, small contractors | Customers, items, quotes → invoices, PDF, status | core + CC customers | M | 6 | Only as **non-tax** quotes. Real e-invoicing needs ZATCA (Fatoora) compliance — L-size, not to be claimed until certified |
| 7 | **AZENK Inventory / POS** | Stock tracked manually | Small shops | Items, stock movements, sales, reports | core | L | 7 | Not now — crowded market, hardware and tax requirements |
| 8 | **VoIP / WhatsApp / SMS for Call Center** | Calls logged manually | Call Center customers | Provider webhooks into `calls.provider*` columns, click-to-call, recordings | CC schema already reserves the columns | M per provider | On demand | Integration project per customer, never shown as built-in until delivered |
| 9 | **AI assistant (ticket summaries, finder)** | — | — | Would need a real model API, data-handling policy and costs | — | M | Later | Not until implemented; the current solution finder is rule-based and says so |

## Built in this round
- AZENK Presentations, AZENK Call Center, AZENK Graduation (see `platform/README.md` and `presentations/`).
- **#2 AZENK Requests** built afterwards on the shared core (types builder, multi-step approvals, attachments, reports; 15 API tests + UI E2E). Recommended next: **#1 AZENK HR server edition**.

## Large items — architecture notes (plan only)
- **HR server edition**: new `apps/hr` on core; migrations mirroring `easyhr/js/store.js` collections; move `engine.js` (pure rules) to shared code used by server and UI; geofence check stays client-side with the server re-validating coordinates and time window; payroll runs as server transactions with audit.
- **E-invoicing**: separate service implementing ZATCA phase 2 (XML UBL, cryptographic stamp, clearance/reporting APIs); requires onboarding with ZATCA and certified testing before any public claim.
- **Hosting for server products**: one Node 22 host (VPS or container) per product or one per customer, HTTPS reverse proxy, daily DB/file backups, `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
