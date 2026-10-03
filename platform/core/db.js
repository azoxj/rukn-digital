// SQLite access via Node's built-in node:sqlite (no third-party driver).
// Migrations are plain numbered .sql files applied once, in order, inside a
// transaction, and recorded in schema_migrations. Applied files are never
// edited: schema changes always go in a new numbered file.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CORE_MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export function openDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

/** Run fn inside a transaction (nested calls reuse the outer one). */
export function tx(db, fn) {
  if (db.isTransaction) return fn();
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function listSql(dir) {
  return readdirSync(dir).filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();
}

/**
 * Apply pending migrations. Core migrations are namespaced "core/..." and the
 * app's own as "<app>/...", so each app DB carries both sets.
 * Returns the list of newly applied migration ids.
 */
export function migrate(db, appName, appDir) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  const done = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((r) => r.id));
  const sets = [["core", CORE_MIGRATIONS], [appName, appDir]];
  const applied = [];
  for (const [ns, dir] of sets) {
    if (!dir) continue;
    for (const f of listSql(dir)) {
      const id = `${ns}/${f}`;
      if (done.has(id)) continue;
      const sql = readFileSync(join(dir, f), "utf8");
      tx(db, () => {
        db.exec(sql);
        db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(id);
      });
      applied.push(id);
    }
  }
  return applied;
}

export const nowIso = () => new Date().toISOString();
