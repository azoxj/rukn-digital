// Test harness: boots an app on an in-memory DB + random port and gives a
// cookie-aware client that handles CSRF like the browser frontend does.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.SCRYPT_LOG_N = process.env.SCRYPT_LOG_N || "10"; // fast hashing in tests only
process.env.API_RATE_LIMIT = process.env.API_RATE_LIMIT || "100000";

const { createPlatformApp } = await import("../core/app.js");
const { listen } = await import("../core/http.js");
const { hashPassword } = await import("../core/security.js");

export const PASSWORD = "Test-pass-2026";

export async function boot(def) {
  const dataDir = mkdtempSync(join(tmpdir(), `azk-${def.name}-`));
  const app = createPlatformApp(def, { dbFile: ":memory:", dataDir, log: { error() {} } });
  const server = await listen(app.handler, 0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const hash = await hashPassword(PASSWORD);

  const db = app.db;
  const org = (name = "Org", slug = "org-" + Math.random().toString(36).slice(2, 8)) =>
    Number(db.prepare("INSERT INTO organizations (name, slug) VALUES (?, ?)").run(name, slug).lastInsertRowid);
  const user = (orgId, role, email, { mustChange = false, name } = {}) =>
    Number(db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,?)")
      .run(orgId, email, name || `${role} ${email.split("@")[0]}`, role, hash, mustChange ? 1 : 0).lastInsertRowid);

  return {
    app, db, base, org, user, dataDir,
    client: (email, password = PASSWORD) => client(base, email, password),
    anon: () => client(base),
    async close() { await new Promise((r) => server.close(r)); app.close(); rmSync(dataDir, { recursive: true, force: true }); },
  };
}

function client(base, email, password) {
  let cookie = "";
  let csrf = "";
  const c = {
    async req(method, path, body, { headers = {}, raw = false } = {}) {
      const h = { ...headers };
      if (cookie) h.cookie = cookie;
      if (csrf && method !== "GET") h["x-csrf-token"] = csrf;
      let payload;
      if (body !== undefined && !raw) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
      else if (raw) payload = body;
      const res = await fetch(base + path, { method, headers: h, body: payload, redirect: "manual" });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : Buffer.from(await res.arrayBuffer());
      if (data && data.csrf) csrf = data.csrf;
      return { status: res.status, data, headers: res.headers };
    },
    get: (p, o) => c.req("GET", p, undefined, o),
    post: (p, b, o) => c.req("POST", p, b ?? {}, o),
    patch: (p, b, o) => c.req("PATCH", p, b ?? {}, o),
    put: (p, b, o) => c.req("PUT", p, b, o),
    del: (p, o) => c.req("DELETE", p, undefined, o),
    setCsrf: (v) => { csrf = v; },
    get csrf() { return csrf; },
    async login() {
      const r = await c.post("/api/auth/login", { email, password });
      if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
      return c;
    },
  };
  return c;
}
