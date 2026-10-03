// Isolated per-account instances of the SERVER products.
// Each demo account gets its own SQLite database + file directory per product,
// seeded with fake demo data. Nothing is shared between accounts, with staff,
// or with any production database.
import { join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import { createPlatformApp } from "../../core/app.js";
import { hashPassword, randomToken } from "../../core/security.js";
import { tx } from "../../core/db.js";
import { callcenterApp } from "../callcenter/app.js";
import { seedDemo as seedCallcenter } from "../callcenter/seed.js";
import { graduationApp } from "../graduation/app.js";
import { seedDemo as seedGraduation } from "../graduation/seed.js";
import { requestsApp } from "../requests/app.js";
import { seedDemo as seedRequests } from "../requests/seed.js";

export const SERVER_APPS = {
  callcenter: { def: callcenterApp, seed: seedCallcenter, roleLabels: { ADMIN: "مدير النظام", SUPERVISOR: "مشرف", AGENT: "موظف خدمة العملاء" } },
  graduation: { def: graduationApp, seed: seedGraduation, roleLabels: { ADMIN: "مدير النظام", SUPERVISOR: "مشرف أكاديمي", STUDENT: "طالب" } },
  requests: { def: requestsApp, seed: seedRequests, roleLabels: { ADMIN: "مدير النظام", MANAGER: "مدير", EMPLOYEE: "موظف" } },
};

export function createInstances({ dataRoot, log = console }) {
  const live = new Map(); // `${accountId}:${version}:${app}` → { app, roles }
  const dirOf = (accountId) => join(dataRoot, "demo-instances", `acc-${Number(accountId)}`);

  const pending = new Map();
  function get(accountId, version, appName) {
    const key = `${accountId}:${version}:${appName}`;
    if (live.has(key)) return Promise.resolve(live.get(key));
    if (!pending.has(key)) pending.set(key, create(accountId, version, appName, key).finally(() => pending.delete(key)));
    return pending.get(key);
  }

  async function create(accountId, version, appName, key) {
    const spec = SERVER_APPS[appName];
    if (!spec) throw new Error(`unknown server app ${appName}`);
    const dir = join(dirOf(accountId), `v${version}`);
    mkdirSync(dir, { recursive: true });
    const app = createPlatformApp(spec.def, { dbFile: join(dir, `${appName}.db`), dataDir: join(dir, `${appName}-files`), log });
    if (!app.db.prepare("SELECT COUNT(*) AS n FROM users").get().n) {
      // Seed users get a random, never-revealed password: entry is only through Demo Center SSO.
      const hash = await hashPassword(randomToken(24));
      tx(app.db, () => spec.seed(app.db, hash));
    }
    const roles = [];
    for (const [role, label] of Object.entries(spec.roleLabels)) {
      const u = app.db.prepare("SELECT id FROM users WHERE role = ? AND is_active = 1 ORDER BY id LIMIT 1").get(role);
      if (u) roles.push({ role, label });
    }
    const inst = { app, roles, appName };
    live.set(key, inst);
    return inst;
  }

  function userForRole(inst, role) {
    if (!inst.roles.some((r) => r.role === role)) return null;
    return inst.app.db.prepare("SELECT * FROM users WHERE role = ? AND is_active = 1 ORDER BY id LIMIT 1").get(role) || null;
  }

  /** Close all open instances of an account (expiry, suspension, reset). */
  function close(accountId) {
    for (const [k, inst] of live) if (k.startsWith(`${accountId}:`)) { try { inst.app.close(); } catch { /* already closed */ } live.delete(k); }
  }

  /** Delete all instance data of an account (Reset Demo Data). Next access re-seeds. */
  function wipe(accountId) {
    close(accountId);
    rmSync(dirOf(accountId), { recursive: true, force: true });
  }

  const closeAll = () => { for (const inst of live.values()) { try { inst.app.close(); } catch { /* ignore */ } } live.clear(); };
  return { get, userForRole, close, wipe, closeAll, size: () => live.size };
}
