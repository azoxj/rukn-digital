-- AZENK Requests / Approvals domain schema. Every row is scoped by org_id.

-- Manager and department per user (used to route "direct manager" steps).
CREATE TABLE user_profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id),
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  manager_id  INTEGER REFERENCES users(id),
  department  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX user_profiles_manager_idx ON user_profiles(org_id, manager_id);

-- Request types defined by admins: custom fields + an ordered approval path.
--   fields: JSON [{key, label, type, required, options?, max?}]
--   steps:  JSON [{name, approver}]  approver = "manager" | "role:ADMIN" | "user:<id>"
CREATE TABLE request_types (
  id           INTEGER PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id),
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  fields       TEXT NOT NULL,
  steps        TEXT NOT NULL,
  sla_hours    INTEGER NOT NULL DEFAULT 48 CHECK (sla_hours BETWEEN 1 AND 720),
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (org_id, name)
);

-- A request keeps a snapshot of its type's fields and steps, so later edits
-- to the type never change requests already submitted.
CREATE TABLE requests (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id),
  number         INTEGER NOT NULL,
  type_id        INTEGER NOT NULL REFERENCES request_types(id),
  type_name      TEXT NOT NULL,
  fields         TEXT NOT NULL,
  steps          TEXT NOT NULL,
  requester_id   INTEGER NOT NULL REFERENCES users(id),
  title          TEXT NOT NULL,
  data           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','returned','approved','rejected','cancelled')),
  current_step   INTEGER NOT NULL DEFAULT 0,
  sla_hours      INTEGER NOT NULL,
  step_due_at    TEXT,
  decided_at     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (org_id, number)
);
CREATE INDEX requests_org_status_idx ON requests(org_id, status);
CREATE INDEX requests_requester_idx ON requests(requester_id, status);

-- One row per approval step instance (a returned request gets a fresh row
-- for the same step when resubmitted).
CREATE TABLE approval_steps (
  id                INTEGER PRIMARY KEY,
  org_id            INTEGER NOT NULL REFERENCES organizations(id),
  request_id        INTEGER NOT NULL REFERENCES requests(id),
  step_index        INTEGER NOT NULL,
  name              TEXT NOT NULL,
  approver_user_id  INTEGER REFERENCES users(id),
  approver_role     TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','returned','cancelled')),
  comment           TEXT,
  decided_by        INTEGER REFERENCES users(id),
  decided_at        TEXT,
  due_at            TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (approver_user_id IS NOT NULL OR approver_role IS NOT NULL)
);
CREATE INDEX approval_steps_request_idx ON approval_steps(request_id, step_index);
CREATE INDEX approval_steps_inbox_idx ON approval_steps(org_id, status, approver_user_id, approver_role);

CREATE TABLE request_comments (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  request_id  INTEGER NOT NULL REFERENCES requests(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX request_comments_idx ON request_comments(request_id);

CREATE TABLE request_files (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id),
  request_id     INTEGER NOT NULL REFERENCES requests(id),
  uploader_id    INTEGER NOT NULL REFERENCES users(id),
  original_name  TEXT NOT NULL,
  mime           TEXT NOT NULL,
  size           INTEGER NOT NULL,
  sha256         TEXT NOT NULL,
  storage_key    TEXT NOT NULL UNIQUE,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX request_files_idx ON request_files(request_id);
