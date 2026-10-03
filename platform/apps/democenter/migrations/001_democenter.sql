-- AZENK Demo Center schema.
-- Staff (SUPER_ADMIN / ADMIN) use the core `users` table and core sessions.
-- Demo customers are a separate identity with their own accounts and sessions.

-- A request submitted from the website (public form).
CREATE TABLE demo_requests (
  id               INTEGER PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id),
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  company_name     TEXT,
  products         TEXT NOT NULL,            -- JSON array of product ids
  users_count      TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','COMPLETED','CANCELLED')),
  demo_account_id  INTEGER REFERENCES demo_accounts(id),
  decided_by       INTEGER REFERENCES users(id),
  decided_at       TEXT,
  decision_note    TEXT,
  ip               TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX demo_requests_status_idx ON demo_requests(org_id, status, created_at);

-- One account per approved request. The 24h window starts at the FIRST successful
-- login: until then activated_at and expires_at stay NULL.
CREATE TABLE demo_accounts (
  id              INTEGER PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id),
  username        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash   TEXT NOT NULL,
  customer_name   TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  company_name    TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','EXPIRED','SUSPENDED')),
  suspended_from  TEXT,                       -- status before suspension (to restore on activate)
  request_id      INTEGER REFERENCES demo_requests(id),
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL,
  activated_at    TEXT,
  expires_at      TEXT,
  last_login_at   TEXT,
  data_version    INTEGER NOT NULL DEFAULT 1, -- bumped by "Reset Demo Data"
  updated_at      TEXT NOT NULL
);
CREATE INDEX demo_accounts_status_idx ON demo_accounts(org_id, status, expires_at);

-- Only the SHA-256 of the session token is stored.
CREATE TABLE demo_sessions (
  id               TEXT PRIMARY KEY,
  demo_account_id  INTEGER NOT NULL REFERENCES demo_accounts(id),
  csrf_token       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  last_seen_at     TEXT NOT NULL,
  ip               TEXT,
  user_agent       TEXT
);
CREATE INDEX demo_sessions_account_idx ON demo_sessions(demo_account_id);

-- Product grants (history kept: a revoked grant keeps its row).
CREATE TABLE demo_account_products (
  id               INTEGER PRIMARY KEY,
  demo_account_id  INTEGER NOT NULL REFERENCES demo_accounts(id),
  product_id       TEXT NOT NULL,
  granted_at       TEXT NOT NULL,
  granted_by       INTEGER REFERENCES users(id),
  revoked_at       TEXT,
  revoked_by       INTEGER REFERENCES users(id)
);
CREATE UNIQUE INDEX demo_account_products_active_idx ON demo_account_products(demo_account_id, product_id) WHERE revoked_at IS NULL;

-- "Forgot password" requests: handled by staff (no e-mail delivery yet).
CREATE TABLE demo_password_requests (
  id               INTEGER PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id),
  username         TEXT NOT NULL,
  phone            TEXT,
  demo_account_id  INTEGER REFERENCES demo_accounts(id),
  status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE','DISMISSED')),
  ip               TEXT,
  created_at       TEXT NOT NULL,
  handled_by       INTEGER REFERENCES users(id),
  handled_at       TEXT
);
