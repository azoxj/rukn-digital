import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, PASSWORD } from "./helpers.js";
import { callcenterApp } from "../apps/callcenter/app.js";

let t, orgA, orgB;
before(async () => {
  t = await boot(callcenterApp);
  orgA = t.org("Org A", "org-a");
  orgB = t.org("Org B", "org-b");
  t.user(orgA, "SUPER_ADMIN", "root@a.test");
  t.user(orgA, "ADMIN", "admin@a.test");
  t.user(orgA, "AGENT", "agent@a.test");
  t.user(orgA, "AGENT", "temp@a.test", { mustChange: true });
  t.user(orgB, "ADMIN", "admin@b.test");
});
after(() => t.close());

test("health is public, API requires auth", async () => {
  assert.equal((await t.anon().get("/api/health")).status, 200);
  assert.equal((await t.anon().get("/api/customers")).status, 401);
});

test("security headers are set", async () => {
  const r = await t.anon().get("/api/health");
  assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("login with wrong password is rejected with a generic message", async () => {
  const r = await t.anon().post("/api/auth/login", { email: "admin@a.test", password: "wrong-password-1" });
  assert.equal(r.status, 401);
  const u = await t.anon().post("/api/auth/login", { email: "nobody@a.test", password: "wrong-password-1" });
  assert.equal(u.status, 401);
  assert.equal(r.data.error.message, u.data.error.message);
});

test("login validation errors are field-level", async () => {
  const r = await t.anon().post("/api/auth/login", { email: "not-an-email" });
  assert.equal(r.status, 422);
  assert.ok(r.data.error.fields.email);
  assert.ok(r.data.error.fields.password);
});

test("login → me → logout lifecycle with HttpOnly SameSite cookie", async () => {
  const c = t.client("admin@a.test");
  const r = await c.post("/api/auth/login", { email: "admin@a.test", password: PASSWORD });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.ok(r.data.csrf);
  assert.equal(r.data.user.role, "ADMIN");
  assert.equal(r.data.user.password_hash, undefined);
  const me = await c.get("/api/auth/me");
  assert.equal(me.data.user.email, "admin@a.test");
  assert.equal((await c.post("/api/auth/logout")).status, 200);
  assert.equal((await c.get("/api/customers")).status, 401);
});

test("mutations without a valid CSRF token are refused", async () => {
  const c = await t.client("agent@a.test").login();
  const good = c.csrf;
  c.setCsrf("bad-token");
  const r = await c.post("/api/customers", { name: "Test", phone: "0500000001" });
  assert.equal(r.status, 403);
  c.setCsrf(good);
  assert.equal((await c.post("/api/customers", { name: "Test", phone: "0500000001" })).status, 201);
});

test("cross-origin mutations are refused", async () => {
  const c = await t.client("agent@a.test").login();
  const r = await c.post("/api/customers", { name: "X", phone: "0500000002" }, { headers: { origin: "https://evil.example" } });
  assert.equal(r.status, 403);
});

test("non-JSON bodies are refused (blocks form CSRF)", async () => {
  const c = await t.client("agent@a.test").login();
  const r = await c.req("POST", "/api/customers", "name=x", { raw: true, headers: { "content-type": "application/x-www-form-urlencoded" } });
  assert.equal(r.status, 415);
});

test("temporary password must be changed before using the API", async () => {
  const c = await t.client("temp@a.test").login();
  assert.equal((await c.get("/api/customers")).status, 403);
  const weak = await c.post("/api/auth/password", { current_password: PASSWORD, new_password: "short" });
  assert.equal(weak.status, 422);
  const ok = await c.post("/api/auth/password", { current_password: PASSWORD, new_password: "Brand-new-pass-77" });
  assert.equal(ok.status, 200);
  assert.equal((await c.get("/api/customers")).status, 200);
});

test("users: admin creates an agent with a one-time temporary password", async () => {
  const admin = await t.client("admin@a.test").login();
  const r = await admin.post("/api/users", { name: "New Agent", email: "new.agent@a.test", role: "AGENT" });
  assert.equal(r.status, 201);
  assert.ok(r.data.temporary_password.length >= 10);
  const stored = t.db.prepare("SELECT password_hash FROM users WHERE email = ?").get("new.agent@a.test").password_hash;
  assert.ok(!stored.includes(r.data.temporary_password));
  // the new user can sign in with it and is forced to change it
  const c = await t.client("new.agent@a.test", r.data.temporary_password).login();
  assert.equal((await c.get("/api/auth/me")).data.user.must_change_password, true);
});

test("users: role escalation is blocked", async () => {
  const admin = await t.client("admin@a.test").login();
  assert.equal((await admin.post("/api/users", { name: "Evil", email: "evil@a.test", role: "SUPER_ADMIN" })).status, 403);
  assert.equal((await admin.post("/api/users", { name: "Evil", email: "evil2@a.test", role: "ADMIN" })).status, 403);
  const agent = await t.client("agent@a.test").login();
  assert.equal((await agent.post("/api/users", { name: "X", email: "x@a.test", role: "AGENT" })).status, 403);
  assert.equal((await agent.get("/api/users")).status, 403);
});

test("users: deactivation revokes sessions immediately", async () => {
  const admin = await t.client("admin@a.test").login();
  const created = await admin.post("/api/users", { name: "Short Lived", email: "short@a.test", role: "AGENT" });
  const pw = created.data.temporary_password;
  const c = await t.client("short@a.test", pw).login();
  await c.post("/api/auth/password", { current_password: pw, new_password: "Another-pass-55" });
  assert.equal((await c.get("/api/customers")).status, 200);
  await admin.patch(`/api/users/${created.data.user.id}`, { is_active: false });
  assert.equal((await c.get("/api/customers")).status, 401);
  const relog = await t.client("short@a.test", "Another-pass-55").post("/api/auth/login", { email: "short@a.test", password: "Another-pass-55" });
  assert.equal(relog.status, 401);
});

test("tenant isolation: users of org B cannot see org A users", async () => {
  const b = await t.client("admin@b.test").login();
  const list = await b.get("/api/users");
  assert.ok(list.data.items.every((u) => u.org_id === orgB));
  const aUser = t.db.prepare("SELECT id FROM users WHERE email = 'agent@a.test'").get().id;
  assert.equal((await b.patch(`/api/users/${aUser}`, { name: "Hacked" })).status, 404);
});

test("super admin manages organisations; admins cannot", async () => {
  const root = await t.client("root@a.test").login();
  const r = await root.post("/api/orgs", { name: "Org C", slug: "org-c", admin_name: "C Admin", admin_email: "admin@c.test" });
  assert.equal(r.status, 201);
  assert.ok(r.data.temporary_password);
  assert.equal((await root.post("/api/orgs", { name: "Dup", slug: "org-c", admin_name: "Dup Admin", admin_email: "d@c.test" })).status, 409);
  const admin = await t.client("admin@a.test").login();
  assert.equal((await admin.get("/api/orgs")).status, 403);
});

test("login is rate limited per account", async () => {
  t.app.auth.resetLimiters();
  const c = t.anon();
  for (let i = 0; i < 5; i++) await c.post("/api/auth/login", { email: "agent@a.test", password: "bad-password-9" });
  const r = await c.post("/api/auth/login", { email: "agent@a.test", password: PASSWORD });
  assert.equal(r.status, 429);
  assert.ok(r.headers.get("retry-after"));
  t.app.auth.resetLimiters();
});

test("audit log records logins and is append-only", async () => {
  const admin = await t.client("admin@a.test").login();
  const r = await admin.get("/api/audit?action=auth.login");
  assert.equal(r.status, 200);
  assert.ok(r.data.items.length > 0);
  assert.ok(r.data.items.every((x) => x.org_id === orgA));
  assert.throws(() => t.db.prepare("DELETE FROM audit_log").run(), /append-only/);
  assert.throws(() => t.db.prepare("UPDATE audit_log SET action = 'x'").run(), /append-only/);
  const agent = await t.client("agent@a.test").login();
  assert.equal((await agent.get("/api/audit")).status, 403);
});

test("static files are served and path traversal is blocked", async () => {
  const r = await fetch(t.base + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  const bad = await fetch(t.base + "/..%2f..%2fpackage.json");
  assert.notEqual(bad.status, 200);
  const core = await fetch(t.base + "/core/ui.js");
  assert.equal(core.status, 200);
});

test("oversized bodies are refused", async () => {
  const c = await t.client("agent@a.test").login();
  const r = await c.post("/api/customers", { name: "x".repeat(2 * 1024 * 1024), phone: "0500000009" });
  assert.equal(r.status, 413);
});
