-- AZENK Graduation domain schema. Every row is scoped by org_id.

CREATE TABLE projects (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id),
  title          TEXT NOT NULL,
  description    TEXT,
  department     TEXT,
  academic_year  TEXT,
  status         TEXT NOT NULL DEFAULT 'proposal' CHECK (status IN ('proposal','approved','in_progress','submitted','completed','rejected')),
  supervisor_id  INTEGER REFERENCES users(id),
  start_date     TEXT,
  due_date       TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX projects_org_idx ON projects(org_id, status);
CREATE INDEX projects_supervisor_idx ON projects(org_id, supervisor_id);

-- The project team.
CREATE TABLE project_members (
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  org_id      INTEGER NOT NULL REFERENCES organizations(id),
  team_role   TEXT NOT NULL DEFAULT 'member' CHECK (team_role IN ('leader','member')),
  added_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user_idx ON project_members(user_id);

CREATE TABLE milestones (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id),
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      TEXT,
  weight        INTEGER NOT NULL DEFAULT 10 CHECK (weight BETWEEN 1 AND 100),
  position      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','needs_changes')),
  submitted_at  TEXT,
  reviewed_at   TEXT,
  reviewed_by   INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX milestones_project_idx ON milestones(project_id, position);

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id),
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id  INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  assignee_id   INTEGER REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  due_date      TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX tasks_project_idx ON tasks(project_id, status);
CREATE INDEX tasks_assignee_idx ON tasks(assignee_id, status);

-- Uploaded documents. Bytes live on disk under DATA_DIR; only metadata here.
CREATE TABLE files (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id),
  project_id     INTEGER NOT NULL REFERENCES projects(id),
  milestone_id   INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  uploader_id    INTEGER NOT NULL REFERENCES users(id),
  original_name  TEXT NOT NULL,
  mime           TEXT NOT NULL,
  size           INTEGER NOT NULL,
  sha256         TEXT NOT NULL,
  storage_key    TEXT NOT NULL UNIQUE,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX files_project_idx ON files(project_id);

CREATE TABLE feedback (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id),
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id  INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  author_id     INTEGER NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','approved','needs_changes')),
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX feedback_project_idx ON feedback(project_id);

-- Rubric-based evaluations; criteria is a JSON array of {name, max, score}.
CREATE TABLE evaluations (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id),
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  evaluator_id  INTEGER NOT NULL REFERENCES users(id),
  criteria      TEXT NOT NULL,
  total         REAL NOT NULL,
  max_total     REAL NOT NULL,
  comments      TEXT,
  is_final      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX evaluations_project_idx ON evaluations(project_id);
