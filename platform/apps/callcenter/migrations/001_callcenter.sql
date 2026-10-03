-- AZENK Call Center domain schema. Every row is scoped by org_id.

CREATE TABLE customers (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  company     TEXT,
  city        TEXT,
  notes       TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (org_id, phone)
);
CREATE INDEX customers_org_name_idx ON customers(org_id, name);

CREATE TABLE tickets (
  id           INTEGER PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id),
  number       INTEGER NOT NULL,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  subject      TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'general',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','pending','resolved','closed')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assignee_id  INTEGER REFERENCES users(id),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  due_at       TEXT,
  resolved_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (org_id, number)
);
CREATE INDEX tickets_org_status_idx ON tickets(org_id, status, priority);
CREATE INDEX tickets_assignee_idx ON tickets(org_id, assignee_id);
CREATE INDEX tickets_customer_idx ON tickets(customer_id);

CREATE TABLE ticket_comments (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ticket_comments_ticket_idx ON ticket_comments(ticket_id);

-- Field-level history (status, priority, assignee) for the ticket timeline.
CREATE TABLE ticket_history (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  field       TEXT NOT NULL,
  from_value  TEXT,
  to_value    TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ticket_history_ticket_idx ON ticket_history(ticket_id);

-- Calls are logged by agents (manually or with the in-app call timer).
-- No telephony provider is connected; provider/recording columns are
-- reserved for a future VoIP integration and stay NULL.
CREATE TABLE calls (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id),
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  agent_id      INTEGER NOT NULL REFERENCES users(id),
  ticket_id     INTEGER REFERENCES tickets(id),
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  status        TEXT NOT NULL CHECK (status IN ('answered','missed','no_answer','busy','voicemail')),
  started_at    TEXT NOT NULL,
  duration_sec  INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  outcome       TEXT,
  notes         TEXT,
  provider      TEXT,
  provider_ref  TEXT,
  recording_url TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX calls_org_started_idx ON calls(org_id, started_at);
CREATE INDEX calls_agent_idx ON calls(org_id, agent_id);
CREATE INDEX calls_customer_idx ON calls(customer_id);

-- Follow-ups and general tasks.
CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id),
  type          TEXT NOT NULL DEFAULT 'followup' CHECK (type IN ('followup','task')),
  title         TEXT NOT NULL,
  description   TEXT,
  customer_id   INTEGER REFERENCES customers(id),
  ticket_id     INTEGER REFERENCES tickets(id),
  assignee_id   INTEGER NOT NULL REFERENCES users(id),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  due_at        TEXT NOT NULL,
  completed_at  TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX tasks_assignee_idx ON tasks(org_id, assignee_id, status, due_at);
