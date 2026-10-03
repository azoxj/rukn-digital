# AZENK — Platform Audit (Phase 1)

Date: 2026-10-03 · Branch: `claude/rukn-digital-portfolio-xrel59` · Scope: whole repository + `origin/claude/easy-fleet-sprint-1-hvdll0` (read-only)

## 1. Current architecture
- **Marketing site**: static HTML/CSS/vanilla JS (no build step, no package.json) served by GitHub Pages from this branch
  (`https://azoxj.github.io/rukn-digital/`; target domain `azenk.sa`, no CNAME yet).
  `config.js` (contact/brand) → `data.js` (services/products/work) → `i18n.js` (EN) → `script.js` (rendering, WhatsApp, i18n).
- **Product apps**: three folders served as static pages: `easyhr/`, `fleetpro/`, `clinicflow/`.
- **No backend, no database, no API, no server-side auth** anywhere on this branch.
- `easy-fleet/` exists only on the other branch: a real full-stack Sprint 1 (React + Express + PostgreSQL + Drizzle, 92 tests).

## 2. Existing products
| Product | Reality | Data | Auth |
|---|---|---|---|
| Easy HR (`easyhr/`) | Large, fully clickable HRMS: employees, org/departments, positions, recruitment, onboarding, attendance + shifts, leave, contracts, payroll, advances, benefits, performance, training, documents, assets, disciplinary, requests, travel, transfers, offboarding, reports, notifications, calendar, settings, RBAC (9 roles), approval engine, audit log | browser `localStorage` | demo role picker — **not real security** |
| FleetPro (`fleetpro/`) | Vehicles, drivers, maintenance, fuel, insurance, accidents, violations, reports, settings, CSV export | `localStorage` | none |
| ClinicFlow (`clinicflow/`) | Patients, appointments, doctors, clinics, invoices, notifications, reports, settings, CSV export | `localStorage` | none |
| Easy Fleet (other branch) | Sprint 1 foundation only (auth, users, vehicles, projects, assignments, audit) — no hosted demo | PostgreSQL | real |

## 3. Working features
- Site: bilingual AR/EN, RTL/LTR, WhatsApp ordering from `config.js`, product modal + deep links, contact form → WhatsApp, SEO (canonical, sitemap, JSON-LD), fail-safe reveal, cache-busting.
- Easy HR / FleetPro / ClinicFlow: every navigation view renders without JS errors (automated crawl); add/edit/status actions and CSV exports work.

## 4. Broken / inconsistent
- FleetPro, ClinicFlow and Easy HR still say "العودة إلى Rukn Digital"; Easy HR canonical/og:url point to the old GitHub URL.
- Site lists **Easy Fleet** ("قيد التطوير") although nothing is reachable — must be removed.
- `404.html` home link `/` is wrong on the GitHub project sub-path (fine once azenk.sa is connected).
- FleetPro loads an external resource that fails certificate validation in the sandbox (Google Fonts via proxy — not a code bug).

## 5. Missing features
- Header/IA of a *platform* (الأنظمة، الحلول، ابنِ نظامك), quick paths, guided solution finder, build-your-system page.
- Product cards lack "problem it solves".
- Demo apps: no server persistence, no real authentication (by design of a static demo).

## 6. Missing products (requested)
- AZENK Call Center, AZENK Graduation, AZENK Presentations — **no code exists**.

## 7. Database status
- None on this branch. Easy Fleet uses PostgreSQL with Drizzle migrations (other branch, untouched).
- Decision: new server products use **SQLite via Node's built-in `node:sqlite`** (zero third-party runtime dependencies), with numbered SQL migrations and a `schema_migrations` table. No existing data is touched.

## 8. Security issues
- Demo apps keep data and "logins" in `localStorage`: acceptable only as a **browser demo**; must never be presented as secure production auth.
- No secrets found in the repository (scan for keys/tokens/passwords: clean; WhatsApp number/email are public contact data by design).
- New server apps must implement: scrypt password hashing, HttpOnly SameSite session cookies, CSRF token, rate-limiting on login, input validation, RBAC on every route, per-organization tenant isolation, append-only audit log, no secrets in frontend (env vars only).

## 9. Deployment status
- GitHub Pages: last deployment `e44bcee` succeeded. Pages can only host static files → it can host the site, AZENK HR, FleetPro, ClinicFlow and AZENK Presentations (pure client-side), **not** Call Center or Graduation (they need a Node server).
- No server hosting is configured. Server products run locally (`node server.js`) until a host is chosen (requires your approval).

## 10. Recommended implementation order
1. Platform IA: header, hero, "ماذا تريد أن تنجز؟", products-as-systems, الحلول (guided finder), ابنِ نظامك (process + form).
2. Remove Easy Fleet from site/data/SEO.
3. Rename Easy HR → **AZENK HR** (texts, title, canonical) without touching its data key.
4. FleetPro / ClinicFlow: rebrand links, keep features.
5. **AZENK Presentations** (static, real `.pptx` export with pptxgenjs vendored locally).
6. Shared server core (`platform/core`) + **AZENK Call Center** (full-stack MVP + tests).
7. **AZENK Graduation** (full-stack MVP on the same core + tests).
8. Product gap analysis (`docs/PRODUCT-GAP-ANALYSIS.md`).
9. Tests, security review, mobile (320–1440), SEO.

Nothing is pushed, merged or deployed without explicit approval.

---

## Implementation status (development environment only)

| Item | Status | Verified by |
|---|---|---|
| Platform IA: header (7 links + «اطلب حلًا»), hero, 4 paths, systems, finder, services, process | Done | `tests/site.e2e.js` (265 checks incl. 320–1440 px, AR/EN) |
| الحلول — rule-based solution finder (labelled "not AI") | Done | site E2E |
| ابنِ نظامك — 8 stages + request form → WhatsApp / e-mail (no fake backend) | Done | site E2E |
| Easy Fleet removed from site, data, SEO, sitemap | Done (other branch untouched) | site E2E text scan |
| Easy HR → AZENK HR (texts, title, canonical; data key unchanged) | Done | 28-view crawl, no errors |
| FleetPro / ClinicFlow brand links fixed | Done | view crawl |
| AZENK Presentations with real .pptx export | Done | 27 UI checks + python-pptx file check |
| AZENK Call Center (server, SQLite, RBAC, tenants) | MVP done | 33 API tests (+ core) + 23 UI E2E |
| AZENK Graduation (server, uploads, reviews, rubric) | MVP done | 15 API tests + UI E2E |
| Product gap analysis | Done | `docs/PRODUCT-GAP-ANALYSIS.md` |

Not done / needs your decision:
- Hosting for Call Center and Graduation (they cannot run on GitHub Pages). Until then the site offers «اطلب Demo» for them, shown live on request.
- AZENK HR, FleetPro and ClinicFlow remain browser demos (labelled as such); server editions are planned in the gap analysis.
- Nothing pushed, merged or deployed.
