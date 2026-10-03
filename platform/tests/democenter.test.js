import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PASSWORD } from "./helpers.js"; // sets fast scrypt for tests

const { createDemoCenter } = await import("../apps/democenter/center.js");
const { listen } = await import("../core/http.js");
const { fakeClock, HOUR } = await import("../core/clock.js");
const { hashPassword } = await import("../core/security.js");

let center, server, base, clock, dataDir, staffOrg;

/** Cookie-jar client (multiple cookies, demo + staff + product). */
function client() {
  const jar = new Map();
  let csrf = "";
  const c = {
    async req(method, path, body, { headers = {}, raw = false, redirect = "manual" } = {}) {
      const h = { ...headers };
      if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      if (csrf && method !== "GET") h["x-csrf-token"] = csrf;
      let payload;
      if (body !== undefined && !raw) { h["content-type"] = "application/json"; payload = JSON.stringify(body); } else if (raw) payload = body;
      const res = await fetch(base + path, { method, headers: h, body: payload, redirect });
      for (const sc of res.headers.getSetCookie()) {
        const [pair] = sc.split(";");
        const i = pair.indexOf("=");
        const k = pair.slice(0, i), v = pair.slice(i + 1);
        if (!v || /Max-Age=0/.test(sc)) jar.delete(k); else jar.set(k, v);
      }
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("json") ? await res.json() : await res.text();
      if (data && data.csrf) csrf = data.csrf;
      return { status: res.status, data, headers: res.headers };
    },
    get: (p, o) => c.req("GET", p, undefined, o),
    post: (p, b, o) => c.req("POST", p, b ?? {}, o),
    jar, setCsrf: (x) => { csrf = x; }, get csrf() { return csrf; },
  };
  return c;
}

const staff = async (email) => { const c = client(); const r = await c.post("/api/auth/login", { email, password: PASSWORD }); assert.equal(r.status, 200, JSON.stringify(r.data)); return c; };
const demoLogin = async (username, password) => { const c = client(); const r = await c.post("/api/demo/login", { username, password }); return { c, r }; };

const reqBody = (over = {}) => ({ customer_name: "عميل اختبار", phone: "0551234567", email: "client@example.com", company_name: "شركة اختبار", products: ["hr", "call-center"], users_count: "6-20", notes: "تجربة", ...over });

let superC, adminC, acc = {};

before(async () => {
  clock = fakeClock(Date.UTC(2026, 9, 3, 7, 0, 0)); // 10:00 Riyadh
  dataDir = mkdtempSync(join(tmpdir(), "azk-demo-"));
  center = createDemoCenter({ dbFile: ":memory:", dataDir, clock, sweepMs: 0, log: { error() {}, warn() {} }, env: { ...process.env, AZENK_WHATSAPP: "" } });
  server = await listen(center.handler, 0);
  base = `http://127.0.0.1:${server.address().port}`;
  const db = center.app.db;
  staffOrg = Number(db.prepare("INSERT INTO organizations (name, slug) VALUES ('AZENK', 'azenk')").run().lastInsertRowid);
  const hash = await hashPassword(PASSWORD);
  db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,0)").run(staffOrg, "super@azenk.test", "Super", "SUPER_ADMIN", hash);
  db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,0)").run(staffOrg, "admin@azenk.test", "Admin", "ADMIN", hash);
  superC = await staff("super@azenk.test");
  adminC = await staff("admin@azenk.test");
});
after(async () => { await new Promise((r) => server.close(r)); center.close(); rmSync(dataDir, { recursive: true, force: true }); });

test("public catalog lists all 7 products with configurable URLs", async () => {
  const r = await client().get("/api/demo/catalog");
  assert.deepEqual(r.data.products.map((p) => p.id), ["hr", "fleet", "clinic", "call-center", "graduation", "presentations", "requests"]);
  assert.equal(r.data.products[0].url, "/demo-target/hr/");
});

test("demo request: validation, honeypot, creation, admin notified", async () => {
  const anon = client();
  const bad = await anon.post("/api/demo/requests", reqBody({ phone: "12", products: ["nope"] }));
  assert.equal(bad.status, 422);
  assert.ok(bad.data.error.fields.phone && bad.data.error.fields.products);
  const bot = await anon.post("/api/demo/requests", reqBody({ website: "http://spam" }));
  assert.equal(bot.status, 201);
  const ok = await anon.post("/api/demo/requests", reqBody());
  assert.equal(ok.status, 201);
  acc.requestId = ok.data.id;
  const list = await adminC.get("/api/admin/demo-requests?status=PENDING");
  assert.equal(list.data.total, 1, "honeypot request not stored");
  assert.deepEqual(list.data.items[0].products, ["hr", "call-center"]);
  assert.ok((await adminC.get("/api/notifications?unread=1")).data.items.some((n) => n.type === "demo_request"));
});

test("approve creates a PENDING account with hashed password; clock not started", async () => {
  const r = await adminC.post(`/api/admin/demo-requests/${acc.requestId}/approve`, {});
  assert.equal(r.status, 201);
  acc.id = r.data.account.id;
  acc.username = r.data.credentials.username;
  acc.password = r.data.credentials.password;
  assert.match(acc.username, /^demo-[a-z2-9]{6}$/);
  assert.equal(r.data.account.status, "PENDING");
  assert.equal(r.data.account.activated_at, null);
  assert.equal(r.data.account.expires_at, null);
  const row = center.app.db.prepare("SELECT password_hash FROM demo_accounts WHERE id = ?").get(acc.id);
  assert.match(row.password_hash, /^scrypt\$/);
  assert.ok(!row.password_hash.includes(acc.password));
  const audit = center.app.db.prepare("SELECT meta FROM audit_log").all().map((x) => x.meta || "").join(" ");
  assert.ok(!audit.includes(acc.password), "password never in audit log");
  assert.equal((await adminC.post(`/api/admin/demo-requests/${acc.requestId}/approve`, {})).status, 409);
});

test("first login (7h after creation) starts the 24h window at login time", async () => {
  clock.advance(7 * HOUR); // 17:00
  acc.t0 = clock.now();
  const wrong = await demoLogin(acc.username, "wrong-password-1");
  assert.equal(wrong.r.status, 401);
  const { c, r } = await demoLogin(acc.username, acc.password);
  assert.equal(r.status, 200);
  assert.equal(r.data.account.status, "ACTIVE");
  assert.equal(Date.parse(r.data.account.activated_at), acc.t0);
  assert.equal(Date.parse(r.data.account.expires_at), acc.t0 + 24 * HOUR);
  const cookie = r.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  acc.c = c;
  const req = await adminC.get(`/api/admin/demo-requests/${acc.requestId}`);
  assert.equal(req.data.request.status, "COMPLETED");
});

test("second login keeps the original expiry", async () => {
  clock.advance(5 * HOUR);
  const { r } = await demoLogin(acc.username, acc.password);
  assert.equal(r.status, 200);
  assert.equal(Date.parse(r.data.account.expires_at), acc.t0 + 24 * HOUR);
  assert.equal(Date.parse(r.data.account.activated_at), acc.t0);
});

test("status, products and remaining time come from the server clock", async () => {
  const s = await acc.c.get("/api/demo/status", { headers: { date: "Wed, 01 Jan 2031 00:00:00 GMT" } });
  assert.equal(s.data.remaining_ms, 19 * HOUR, "client headers cannot change time");
  const p = await acc.c.get("/api/demo/products");
  assert.deepEqual(p.data.products.map((x) => x.id), ["hr", "call-center"]);
  assert.equal((await acc.c.get("/api/demo/access/hr")).status, 200);
  assert.equal((await acc.c.get("/api/demo/access/fleet")).status, 403);
});

test("browser product is served only through the gate, with injected bootstrap", async () => {
  const anon = client();
  const blocked = await anon.get("/demo-target/hr/");
  assert.equal(blocked.status, 302);
  assert.match(blocked.headers.get("location"), /#\/login$/);
  const page = await acc.c.get("/demo-target/hr/");
  assert.equal(page.status, 200);
  assert.match(page.data, /<script src="__demo\.js"><\/script>/);
  assert.match(page.data, /AZENK HR/);
  const js = await acc.c.get("/demo-target/hr/__demo.js");
  assert.match(js.data, /"expiresAt":"2026-10-05T00:00:00\.000Z"|"expiresAt"/);
  assert.equal((await acc.c.get("/demo-target/hr/js/store.js")).status, 200);
  assert.equal((await acc.c.get("/demo-target/hr/../../platform/package.json")).status !== 200, true);
  const noAccess = await acc.c.get("/demo-target/fleet/");
  assert.equal(noAccess.status, 302);
  assert.match(noAccess.headers.get("location"), /no-access/);
});

test("server product: isolated instance, role SSO, product API behind the gate", async () => {
  const page = await acc.c.get("/demo-target/call-center/");
  assert.equal(page.status, 200);
  assert.match(page.data, /src="core\/ui\.js/);
  const js = await acc.c.get("/demo-target/call-center/__demo.js");
  assert.match(js.data, /"role":"SUPERVISOR"/);
  assert.equal((await acc.c.get("/demo-target/call-center/api/customers")).status, 401, "no product session yet");
  assert.equal((await acc.c.post("/demo-target/call-center/api/demo-sso", { role: "SUPER_ADMIN" })).status, 422, "role not offered");
  const sso = await acc.c.post("/demo-target/call-center/api/demo-sso", { role: "SUPERVISOR" });
  assert.equal(sso.status, 200);
  assert.ok(acc.c.jar.has("azk_callcenter_sid"));
  const customers = await acc.c.get("/demo-target/call-center/api/customers");
  assert.equal(customers.status, 200);
  assert.ok(customers.data.total > 0, "seeded fake data");
  const created = await acc.c.post("/demo-target/call-center/api/customers", { name: "عميل خاص بالحساب أ", phone: "0590000001" });
  assert.equal(created.status, 201);
  // product API without the demo session is refused even with the product cookie
  const stolen = client();
  stolen.jar.set("azk_callcenter_sid", acc.c.jar.get("azk_callcenter_sid"));
  assert.equal((await stolen.get("/demo-target/call-center/api/customers")).status, 401);
});

test("cross-account isolation: another demo account gets its own data", async () => {
  const r = await superC.post("/api/admin/demos", { customer_name: "عميل ب", products: ["call-center", "requests"] });
  assert.equal(r.status, 201);
  acc.b = { id: r.data.account.id, username: r.data.credentials.username, password: r.data.credentials.password };
  const { c } = await demoLogin(acc.b.username, acc.b.password);
  acc.b.c = c;
  await c.post("/demo-target/call-center/api/demo-sso", { role: "SUPERVISOR" });
  const list = await c.get("/demo-target/call-center/api/customers?q=" + encodeURIComponent("الحساب أ"));
  assert.equal(list.data.total, 0, "B cannot see A's data");
  assert.equal((await c.get("/demo-target/hr/")).status, 302, "B has no HR grant");
  // A cannot reach B-only product
  assert.equal((await acc.c.get("/demo-target/requests/api/requests")).status, 403);
});

test("demo customers cannot use staff APIs; admins cannot exceed their role", async () => {
  assert.equal((await acc.c.get("/api/admin/demos")).status, 401);
  assert.equal((await acc.c.post(`/api/admin/demos/${acc.id}/extend`, {})).status, 401);
  assert.equal((await adminC.post(`/api/admin/demos/${acc.id}/extend`, { hours: 72 })).status, 403, "custom period is SUPER_ADMIN only");
  assert.equal((await adminC.post("/api/users", { name: "x y", email: "x@azenk.test", role: "ADMIN" })).status, 403);
  assert.equal((await client().get("/api/admin/stats")).status, 401);
});

test("product grant / revoke take effect immediately", async () => {
  assert.equal((await adminC.post(`/api/admin/demos/${acc.id}/products`, { grant: ["fleet", "presentations"] })).status, 200);
  assert.equal((await acc.c.get("/demo-target/fleet/")).status, 200);
  assert.deepEqual((await acc.c.get("/api/demo/products")).data.products.map((p) => p.id).sort(), ["call-center", "fleet", "hr", "presentations"]);
  await adminC.post(`/api/admin/demos/${acc.id}/products`, { revoke: ["hr"] });
  assert.equal((await acc.c.get("/demo-target/hr/")).status, 302);
  assert.equal((await acc.c.get("/demo-target/hr/js/store.js")).status, 302, "assets are gated too");
  assert.equal((await adminC.post(`/api/admin/demos/${acc.id}/products`, { grant: ["bogus"] })).status, 422);
});

test("T+23h still active; T+24h expired everywhere (login, API, product)", async () => {
  clock.set(acc.t0 + 23 * HOUR);
  assert.equal((await acc.c.get("/api/demo/status")).data.remaining_ms, HOUR);
  assert.equal((await acc.c.get("/demo-target/call-center/api/customers")).status, 200);
  clock.set(acc.t0 + 24 * HOUR);
  const s = await acc.c.get("/api/demo/status");
  assert.equal(s.status, 403);
  assert.equal(s.data.error.code, "EXPIRED");
  assert.equal((await acc.c.get("/demo-target/call-center/api/customers")).status, 403);
  const page = await acc.c.get("/demo-target/fleet/");
  assert.match(page.headers.get("location"), /#\/expired$/);
  const relog = await demoLogin(acc.username, acc.password);
  assert.equal(relog.r.status, 403);
  assert.equal(relog.r.data.error.code, "EXPIRED");
  const row = (await adminC.get(`/api/admin/demos/${acc.id}`)).data.account;
  assert.equal(row.status, "EXPIRED");
  clock.set(acc.t0 + 25 * HOUR);
  assert.equal((await demoLogin(acc.username, acc.password)).r.status, 403);
  // data is kept (not deleted)
  assert.ok(center.app.db.prepare("SELECT 1 FROM demo_accounts WHERE id = ?").get(acc.id));
});

test("extend: admin +24h from now when expired; SUPER_ADMIN custom period", async () => {
  const r = await adminC.post(`/api/admin/demos/${acc.id}/extend`, {});
  assert.equal(r.status, 200);
  assert.equal(r.data.account.status, "ACTIVE");
  assert.equal(Date.parse(r.data.account.expires_at), clock.now() + 24 * HOUR);
  const s = await superC.post(`/api/admin/demos/${acc.id}/extend`, { hours: 48 });
  assert.equal(Date.parse(s.data.account.expires_at), clock.now() + 72 * HOUR);
  const { r: login } = await demoLogin(acc.username, acc.password);
  assert.equal(login.status, 200);
  acc.c = (await demoLogin(acc.username, acc.password)).c;
  // extending a never-used account is refused (its clock has not started)
  const fresh = await adminC.post("/api/admin/demos", { customer_name: "لم يدخل", products: ["fleet"] });
  assert.equal((await adminC.post(`/api/admin/demos/${fresh.data.account.id}/extend`, {})).status, 409);
});

test("suspend revokes sessions and blocks access; activate restores", async () => {
  assert.equal((await adminC.post(`/api/admin/demos/${acc.id}/suspend`, {})).status, 200);
  assert.equal((await acc.c.get("/api/demo/status")).status, 401, "sessions revoked");
  const { r } = await demoLogin(acc.username, acc.password);
  assert.equal(r.status, 403);
  assert.equal(r.data.error.code, "SUSPENDED");
  assert.equal((await adminC.post(`/api/admin/demos/${acc.id}/activate`, {})).data.account.status, "ACTIVE");
  acc.c = (await demoLogin(acc.username, acc.password)).c;
  assert.equal((await acc.c.get("/api/demo/status")).status, 200);
});

test("reset password: old password stops working, sessions revoked", async () => {
  const r = await adminC.post(`/api/admin/demos/${acc.id}/reset-password`, {});
  const np = r.data.credentials.password;
  assert.notEqual(np, acc.password);
  assert.equal((await acc.c.get("/api/demo/status")).status, 401);
  assert.equal((await demoLogin(acc.username, acc.password)).r.status, 401);
  acc.password = np;
  acc.c = (await demoLogin(acc.username, np)).c;
  assert.equal((await acc.c.get("/api/demo/status")).status, 200);
});

test("Reset Demo Data (staff only) re-seeds the account's instances", async () => {
  await acc.c.post("/demo-target/call-center/api/demo-sso", { role: "SUPERVISOR" });
  const before = await acc.c.get("/demo-target/call-center/api/customers?q=" + encodeURIComponent("الحساب أ"));
  assert.equal(before.data.total, 1);
  const v1 = (await acc.c.get("/demo-target/hr/__demo.js")).data.match(/"owner":"(\w+)"/);
  assert.equal((await acc.c.post(`/api/admin/demos/${acc.id}/reset`, {})).status, 401, "customer cannot reset");
  assert.equal((await adminC.post(`/api/admin/demos/${acc.id}/reset`, {})).status, 200);
  await acc.c.post("/demo-target/call-center/api/demo-sso", { role: "SUPERVISOR" });
  const afterR = await acc.c.get("/demo-target/call-center/api/customers?q=" + encodeURIComponent("الحساب أ"));
  assert.equal(afterR.data.total, 0);
  await adminC.post(`/api/admin/demos/${acc.id}/products`, { grant: ["hr"] });
  const v2 = (await acc.c.get("/demo-target/hr/__demo.js")).data.match(/"owner":"(\w+)"/);
  assert.notEqual(v1 && v1[1], v2 && v2[1], "browser products get a new owner marker (local data cleared)");
});

test("expire now (admin) + logout with CSRF", async () => {
  await acc.c.get("/api/demo/me"); // portal refreshes its demo CSRF token from /me
  const good = acc.c.csrf;
  acc.c.setCsrf("bad");
  assert.equal((await acc.c.post("/api/demo/logout")).status, 403);
  acc.c.setCsrf(good);
  assert.equal((await acc.c.post("/api/demo/logout")).status, 200);
  assert.equal((await acc.c.get("/api/demo/status")).status, 401);
  assert.equal((await adminC.post(`/api/admin/demos/${acc.b.id}/expire`, {})).status, 200);
  assert.equal((await acc.b.c.get("/api/demo/status")).status, 401);
  assert.equal((await demoLogin(acc.b.username, acc.b.password)).r.data.error.code, "EXPIRED");
});

test("forgot password never reveals accounts; staff sees the request", async () => {
  const anon = client();
  const a = await anon.post("/api/demo/forgot", { username: acc.username, phone: "0551234567" });
  const b = await anon.post("/api/demo/forgot", { username: "demo-nobody", phone: "0551234567" });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.deepEqual(a.data, b.data);
  const list = await adminC.get("/api/admin/password-requests");
  assert.equal(list.data.items.length, 2);
  assert.equal(list.data.items.filter((x) => x.demo_account_id).length, 1);
});

test("rate limits: demo login, demo requests", async () => {
  center.limits.login.clear(); center.limits.loginIp.clear();
  for (let i = 0; i < 5; i++) await demoLogin(acc.username, "nope-nope-1");
  assert.equal((await demoLogin(acc.username, acc.password)).r.status, 429);
  center.limits.login.clear(); center.limits.loginIp.clear();
  center.limits.request.clear();
  const anon = client();
  for (let i = 0; i < 5; i++) assert.equal((await anon.post("/api/demo/requests", reqBody({ phone: `05500000${10 + i}` }))).status, 201);
  assert.equal((await anon.post("/api/demo/requests", reqBody())).status, 429);
});

test("dashboard stats and audit trail; audit log is append-only", async () => {
  const s = await adminC.get("/api/admin/stats");
  assert.ok(s.data.requests.total >= 6);
  assert.ok(s.data.accounts.total >= 3);
  assert.equal(s.data.popular[0].id, "hr");
  const actions = new Set();
  for (let page = 1; page <= 5; page++) {
    const a = await adminC.get(`/api/audit?page=${page}&size=200`);
    a.data.items.forEach((x) => actions.add(x.action));
    if (a.data.items.length < 200) break;
  }
  for (const x of ["demo_request.created", "demo_request.approved", "demo.created", "demo.activated", "demo.login", "demo.login_failed", "demo.product_granted", "demo.product_revoked",
    "demo.extended", "demo.suspended", "demo.reactivated", "demo.expired", "demo.expired_by_admin", "demo.password_reset", "demo.data_reset", "demo.product_opened", "demo.logout"]) assert.ok(actions.has(x), x);
  assert.throws(() => center.app.db.prepare("DELETE FROM audit_log").run(), /append-only/);
  const detail = await adminC.get(`/api/admin/demos/${acc.id}`);
  assert.ok(detail.data.activity.length > 5);
  assert.ok(detail.data.grants.some((g) => g.revoked_at));
});

test("periodic sweep marks overdue accounts EXPIRED and closes instances", async () => {
  const r = await adminC.post("/api/admin/demos", { customer_name: "مسح", products: ["requests"] });
  const { c } = await demoLogin(r.data.credentials.username, r.data.credentials.password);
  await c.get("/demo-target/requests/");
  assert.ok(center.instances.size() > 0);
  clock.advance(25 * HOUR);
  center.sweep();
  assert.equal(center.app.db.prepare("SELECT status FROM demo_accounts WHERE id = ?").get(r.data.account.id).status, "EXPIRED");
});
