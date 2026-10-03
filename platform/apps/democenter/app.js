// AZENK Demo Center — app definition and API routes.
//   Public:   catalog, demo request, forgot-password request
//   Customer: /api/demo/*  (own demo session cookie, separate from staff)
//   Staff:    /api/admin/* (core staff session + RBAC)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { created, parseCookies, sendJson } from "../../core/http.js";
import { HttpError, notFound, forbidden, conflict } from "../../core/errors.js";
import { parse, schema, v } from "../../core/validate.js";
import { RateLimiter, safeEqual } from "../../core/security.js";
import { paging, likeTerm } from "../../core/services.js";
import { HOUR } from "../../core/clock.js";
import { PRODUCTS, PRODUCT_IDS, productById, publicProduct } from "./products.js";
import { createDemoService, demoError, DEMO_HOURS } from "./service.js";
import { DEMO_COOKIE } from "./gateway.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// Public + demo-customer routes never use (or require CSRF of) a staff session.
const PUBLIC = { auth: false, skipSession: true };
export const SITE_ROOT = join(HERE, "..", "..", "..");

const ADMIN = ["dashboard.view", "search", "demos.view", "demos.manage", "requests.manage", "users.view", "audit.view"];
const SUPER_ADMIN = [...ADMIN, "demos.extend_custom", "users.manage"];

/** WhatsApp number: single source of truth is the website's config.js (env override allowed). */
export function whatsappNumber(env = process.env) {
  if (env.AZENK_WHATSAPP && /^\d{8,15}$/.test(env.AZENK_WHATSAPP)) return env.AZENK_WHATSAPP;
  try {
    const m = /WHATSAPP_NUMBER:\s*"(\d{8,15})"/.exec(readFileSync(join(SITE_ROOT, "config.js"), "utf8"));
    return m ? m[1] : "";
  } catch { return ""; }
}

/**
 * Build the app definition. `holder.service` is filled when routes are registered,
 * so the gateway (outside the router) can share the same service instance.
 */
export function makeDemoCenterApp({ holder, instances, env = process.env }) {
  return {
    name: "democenter",
    title: "AZENK Demo Center",
    roles: ["SUPER_ADMIN", "ADMIN"],
    permissions: { SUPER_ADMIN, ADMIN },
    manageRoles: { SUPER_ADMIN: ["ADMIN"] },
    tenants: false,
    migrationsDir: join(HERE, "migrations"),
    publicDir: join(HERE, "public"),
    routes: (router, services) => routes(router, services, { holder, instances, env }),
  };
}

function routes(router, { db, audit, clock, can }, { holder, instances, env }) {
  const svc = createDemoService({ db, clock, audit });
  holder.service = svc;
  const secure = env.COOKIE_SECURE === "1";
  const wa = whatsappNumber(env);
  const defaultOrg = () => {
    const o = db.prepare("SELECT id FROM organizations ORDER BY id LIMIT 1").get();
    if (!o) throw new HttpError(503, "Demo Center غير مهيأ بعد");
    return o.id;
  };

  // Rate limits (per IP / per account / per staff user).
  const limits = {
    login: new RateLimiter(Number(env.DEMO_LOGIN_MAX || 5), 15 * 60 * 1000),
    loginIp: new RateLimiter(30, 15 * 60 * 1000),
    request: new RateLimiter(Number(env.DEMO_REQUEST_MAX || 5), HOUR),
    forgot: new RateLimiter(5, HOUR),
    admin: new RateLimiter(Number(env.DEMO_ADMIN_MAX || 120), 10 * 60 * 1000),
  };
  holder.limits = limits;
  const limit = (limiter, key, msg = "طلبات كثيرة، حاول لاحقًا") => {
    const wait = limiter.hit(key);
    if (wait) throw Object.assign(new HttpError(429, msg), { retryAfter: Math.ceil(wait / 1000) });
  };
  const adminLimit = (ctx) => limit(limits.admin, `u${ctx.user.id}`);

  const demoCookie = (value, maxAgeSec) => `${DEMO_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}; Max-Age=${maxAgeSec}`;
  const tokenOf = (ctx) => parseCookies(ctx.req.headers.cookie)[DEMO_COOKIE];
  /** Authenticated demo customer (throws 401/403 with a code the portal understands). */
  const demo = (ctx) => svc.authenticate(tokenOf(ctx));
  const demoCsrf = (ctx, session) => {
    const t = ctx.req.headers["x-csrf-token"];
    if (!t || !safeEqual(t, session.csrf_token)) throw new HttpError(403, "رمز الحماية (CSRF) غير صالح، أعد تحميل الصفحة");
  };
  // Expiry/suspension responses carry a code + WhatsApp details for the portal.
  const wrap = (fn) => async (ctx) => {
    try { return await fn(ctx); } catch (e) {
      if (e.code) {
        const ended = e.code === "EXPIRED" || e.code === "SUSPENDED";
        sendJson(ctx.res, e.status, { error: { message: e.message, code: e.code }, whatsapp: ended ? wa : undefined, account: ended ? e.details : undefined });
        return;
      }
      throw e;
    }
  };

  /* ===================== Public ===================== */
  router.get("/api/demo/config", PUBLIC, () => ({ whatsapp: wa, demo_hours: DEMO_HOURS, products: PRODUCTS.map((p) => publicProduct(p, env)) }));
  router.get("/api/demo/catalog", PUBLIC, () => ({ products: PRODUCTS.map((p) => publicProduct(p, env)) }));

  const requestSchema = schema({
    customer_name: v.string({ min: 2, max: 120 }),
    phone: v.phone(),
    email: v.email({ optional: true, nullable: true }),
    company_name: v.string({ min: 2, max: 160 }),
    products: v.array(v.enum(PRODUCT_IDS), { min: 1, max: PRODUCT_IDS.length }),
    users_count: v.enum(["1-5", "6-20", "21-100", "100+"], { optional: true, nullable: true }),
    notes: v.string({ max: 2000, optional: true, nullable: true }),
    website: v.string({ max: 200, optional: true, nullable: true }), // honeypot: must stay empty
  });
  router.post("/api/demo/requests", PUBLIC, (ctx) => {
    limit(limits.request, `ip:${ctx.ip}`, "تم استلام عدة طلبات من جهازك، حاول بعد ساعة");
    const b = parse(requestSchema, ctx.body);
    if (b.website) return created({ ok: true }); // silently drop bots
    const id = db.prepare(`INSERT INTO demo_requests (org_id, customer_name, phone, email, company_name, products, users_count, notes, ip, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(defaultOrg(), b.customer_name, b.phone, b.email ?? null, b.company_name, JSON.stringify([...new Set(b.products)]), b.users_count ?? null, b.notes ?? null, ctx.ip, svc.nowIso()).lastInsertRowid;
    audit.log({ org_id: defaultOrg(), user_id: null, ip: ctx.ip }, "demo_request.created", "demo_request", id, { products: b.products });
    for (const u of db.prepare("SELECT id, org_id FROM users WHERE is_active = 1").all()) {
      db.prepare("INSERT INTO notifications (org_id, user_id, type, title, body, link) VALUES (?,?,?,?,?,?)").run(u.org_id, u.id, "demo_request", "طلب Demo جديد", `${b.customer_name} — ${b.company_name}`, `#/requests/${id}`);
    }
    return created({ ok: true, id });
  });

  // "Forgot password": never reveals whether the account exists; staff resets the password.
  router.post("/api/demo/forgot", PUBLIC, (ctx) => {
    limit(limits.forgot, `ip:${ctx.ip}`);
    const b = parse(schema({ username: v.string({ min: 3, max: 60 }), phone: v.phone() }), ctx.body);
    const acc = db.prepare("SELECT id, phone FROM demo_accounts WHERE username = ?").get(b.username);
    const match = acc && acc.phone && acc.phone.replace(/\D/g, "").endsWith(b.phone.replace(/\D/g, "").slice(-9)) ? acc.id : null;
    db.prepare("INSERT INTO demo_password_requests (org_id, username, phone, demo_account_id, ip, created_at) VALUES (?,?,?,?,?,?)").run(defaultOrg(), b.username, b.phone, match, ctx.ip, svc.nowIso());
    audit.log({ org_id: defaultOrg(), user_id: null, ip: ctx.ip }, "demo.password_reset_requested", "demo_account", match, { matched: !!match });
    return { ok: true };
  });

  /* ===================== Demo customer ===================== */
  router.post("/api/demo/login", PUBLIC, wrap(async (ctx) => {
    const b = parse(schema({ username: v.string({ min: 1, max: 60 }), password: v.string({ min: 1, max: 200, trim: false }) }), ctx.body);
    const key = `${b.username.toLowerCase()}|${ctx.ip}`;
    const wait = Math.max(limits.login.blocked(key), limits.loginIp.blocked(ctx.ip));
    if (wait) throw Object.assign(new HttpError(429, "محاولات دخول كثيرة. حاول بعد قليل."), { retryAfter: Math.ceil(wait / 1000) });
    let r;
    try { r = await svc.login(b.username, b.password, { ip: ctx.ip, userAgent: ctx.req.headers["user-agent"] }); }
    catch (e) { if (e.code === "INVALID") { limits.login.hit(key); limits.loginIp.hit(ctx.ip); } throw e; }
    limits.login.reset(key);
    const maxAge = Math.max(60, Math.floor((Date.parse(r.account.expires_at) - svc.now()) / 1000));
    ctx.res.setHeader("Set-Cookie", demoCookie(r.token, maxAge));
    return { account: svc.publicAccount(r.account), csrf: r.csrf };
  }));

  router.post("/api/demo/logout", PUBLIC, (ctx) => {
    const token = tokenOf(ctx);
    if (token) {
      try { const { session, account } = demo(ctx); demoCsrf(ctx, session); audit.log({ org_id: account.org_id, user_id: null, ip: ctx.ip }, "demo.logout", "demo_account", account.id); }
      catch (e) { if (e.status === 403 && !e.code) throw e; }
      svc.logout(token);
    }
    ctx.res.setHeader("Set-Cookie", demoCookie("", 0));
    return { ok: true };
  });

  router.get("/api/demo/me", PUBLIC, wrap((ctx) => {
    const { account, session } = demo(ctx);
    return { account: svc.publicAccount(account), csrf: session.csrf_token };
  }));
  router.get("/api/demo/status", PUBLIC, wrap((ctx) => {
    const { account } = demo(ctx);
    return { status: account.status, server_now: svc.nowIso(), expires_at: account.expires_at, remaining_ms: svc.remainingMs(account) };
  }));
  router.get("/api/demo/products", PUBLIC, wrap((ctx) => {
    const { account } = demo(ctx);
    return { products: svc.products(account.id).map((id) => productById(id)).filter(Boolean).map((p) => publicProduct(p, env)), server_now: svc.nowIso(), expires_at: account.expires_at };
  }));
  // For product hosts (e.g. future subdomains): 204 when the current demo session may use :product.
  router.get("/api/demo/access/:product", PUBLIC, wrap((ctx) => {
    const { account } = demo(ctx);
    if (!productById(ctx.params.product)) throw notFound("النظام");
    svc.requireProduct(account, ctx.params.product);
    return { ok: true, account_id: account.id, expires_at: account.expires_at };
  }));

  /* ===================== Staff (admin) ===================== */
  const accountOf = (ctx, id) => {
    const acc = svc.get(id);
    if (!acc || acc.org_id !== ctx.user.org_id) throw notFound("الحساب التجريبي");
    return acc;
  };
  const accountRow = (a) => ({ ...svc.publicAccount(a), products: svc.products(a.id), request_id: a.request_id });

  router.get("/api/admin/stats", { perm: "demos.view" }, (ctx) => {
    svc.sweep();
    const o = ctx.user.org_id, now = svc.nowIso(), soon = new Date(svc.now() + 3 * HOUR).toISOString();
    const req = db.prepare("SELECT COUNT(*) AS total, SUM(status = 'PENDING') AS pending FROM demo_requests WHERE org_id = ?").get(o);
    const acc = db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'ACTIVE') AS active, SUM(status = 'EXPIRED') AS expired, SUM(status = 'PENDING') AS not_started,
      SUM(status = 'SUSPENDED') AS suspended, SUM(status = 'ACTIVE' AND expires_at <= ?) AS expiring_soon FROM demo_accounts WHERE org_id = ?`).get(soon, o);
    const popular = {};
    for (const r of db.prepare("SELECT products FROM demo_requests WHERE org_id = ?").all(o)) for (const p of JSON.parse(r.products)) popular[p] = (popular[p] || 0) + 1;
    const z = (x) => Object.fromEntries(Object.entries(x).map(([k, val]) => [k, val ?? 0]));
    const expiring = db.prepare("SELECT * FROM demo_accounts WHERE org_id = ? AND status = 'ACTIVE' AND expires_at <= ? ORDER BY expires_at").all(o, soon).map(accountRow);
    return { now, requests: z(req), accounts: z(acc), popular: PRODUCTS.map((p) => ({ id: p.id, name: p.name, requests: popular[p.id] || 0 })).sort((a, b) => b.requests - a.requests), expiring,
      open_password_requests: db.prepare("SELECT COUNT(*) AS n FROM demo_password_requests WHERE org_id = ? AND status = 'OPEN'").get(o).n };
  });

  /* ---- requests ---- */
  const requestOf = (ctx, id) => {
    const r = db.prepare("SELECT * FROM demo_requests WHERE id = ? AND org_id = ?").get(Number(id), ctx.user.org_id);
    if (!r) throw notFound("الطلب");
    return { ...r, products: JSON.parse(r.products) };
  };
  router.get("/api/admin/demo-requests", { perm: "requests.manage" }, (ctx) => {
    const { size, offset, page } = paging(ctx.query);
    const where = ["org_id = ?"], args = [ctx.user.org_id];
    if (["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"].includes(ctx.query.status)) { where.push("status = ?"); args.push(ctx.query.status); }
    if (ctx.query.q) { const t = likeTerm(ctx.query.q); where.push("(customer_name LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')"); args.push(t, t, t, t); }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM demo_requests WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT * FROM demo_requests WHERE ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, offset).map((r) => ({ ...r, products: JSON.parse(r.products) }));
    return { items, total, page, size };
  });
  router.get("/api/admin/demo-requests/:id", { perm: "requests.manage" }, (ctx) => ({ request: requestOf(ctx, ctx.params.id) }));

  router.post("/api/admin/demo-requests/:id/approve", { perm: "requests.manage" }, async (ctx) => {
    adminLimit(ctx);
    const r = requestOf(ctx, ctx.params.id);
    if (r.status !== "PENDING") throw conflict("تمت معالجة هذا الطلب مسبقًا");
    const b = parse(schema({ products: v.array(v.enum(PRODUCT_IDS), { min: 1, max: PRODUCT_IDS.length, optional: true }), note: v.string({ max: 500, optional: true, nullable: true }) }), ctx.body);
    const { account, password } = await svc.createAccount({ org_id: ctx.user.org_id, customer_name: r.customer_name, phone: r.phone, email: r.email, company_name: r.company_name, products: b.products || r.products, request_id: r.id }, ctx.user);
    const upd = db.prepare("UPDATE demo_requests SET status = 'APPROVED', demo_account_id = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ? AND status = 'PENDING'").run(account.id, ctx.user.id, svc.nowIso(), b.note ?? null, r.id);
    if (!upd.changes) throw conflict("تمت معالجة هذا الطلب للتو");
    audit.log(ctx, "demo_request.approved", "demo_request", r.id, { demo_account_id: account.id });
    // The password is returned ONCE to the admin and never stored in clear or logged.
    return created({ account: accountRow(account), credentials: { username: account.username, password } });
  });
  for (const [action, status, evt] of [["reject", "REJECTED", "demo_request.rejected"], ["cancel", "CANCELLED", "demo_request.cancelled"]]) {
    router.post(`/api/admin/demo-requests/:id/${action}`, { perm: "requests.manage" }, (ctx) => {
      adminLimit(ctx);
      const r = requestOf(ctx, ctx.params.id);
      if (r.status !== "PENDING") throw conflict("تمت معالجة هذا الطلب مسبقًا");
      const b = parse(schema({ note: v.string({ max: 500, optional: true, nullable: true }) }), ctx.body);
      db.prepare("UPDATE demo_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?").run(status, ctx.user.id, svc.nowIso(), b.note ?? null, r.id);
      audit.log(ctx, evt, "demo_request", r.id, { note: b.note });
      return { ok: true };
    });
  }

  /* ---- demo accounts ---- */
  router.get("/api/admin/demos", { perm: "demos.view" }, (ctx) => {
    svc.sweep();
    const { size, offset, page } = paging(ctx.query);
    const where = ["org_id = ?"], args = [ctx.user.org_id];
    if (["PENDING", "ACTIVE", "EXPIRED", "SUSPENDED"].includes(ctx.query.status)) { where.push("status = ?"); args.push(ctx.query.status); }
    if (ctx.query.q) { const t = likeTerm(ctx.query.q); where.push("(customer_name LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')"); args.push(t, t, t, t, t); }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM demo_accounts WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT * FROM demo_accounts WHERE ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, offset).map(accountRow);
    return { items, total, page, size, server_now: svc.nowIso() };
  });

  router.get("/api/admin/demos/:id", { perm: "demos.view" }, (ctx) => {
    const a = accountOf(ctx, ctx.params.id);
    return {
      account: accountRow(a),
      grants: db.prepare(`SELECT g.*, gu.name AS granted_by_name, ru.name AS revoked_by_name FROM demo_account_products g LEFT JOIN users gu ON gu.id = g.granted_by LEFT JOIN users ru ON ru.id = g.revoked_by WHERE g.demo_account_id = ? ORDER BY g.id`).all(a.id),
      activity: db.prepare(`SELECT al.id, al.action, al.meta, al.ip, al.created_at, u.name AS user_name FROM audit_log al LEFT JOIN users u ON u.id = al.user_id WHERE al.entity = 'demo_account' AND al.entity_id = ? ORDER BY al.id DESC LIMIT 200`).all(String(a.id)),
      request: a.request_id ? requestOf(ctx, a.request_id) : null,
      sessions: db.prepare("SELECT COUNT(*) AS n FROM demo_sessions WHERE demo_account_id = ?").get(a.id).n,
      can_extend_custom: can(ctx.user, "demos.extend_custom"),
    };
  });

  const createSchema = schema({
    customer_name: v.string({ min: 2, max: 120 }), phone: v.phone({ optional: true, nullable: true }), email: v.email({ optional: true, nullable: true }),
    company_name: v.string({ max: 160, optional: true, nullable: true }), products: v.array(v.enum(PRODUCT_IDS), { min: 1, max: PRODUCT_IDS.length }),
  });
  router.post("/api/admin/demos", { perm: "demos.manage" }, async (ctx) => {
    adminLimit(ctx);
    const b = parse(createSchema, ctx.body);
    const { account, password } = await svc.createAccount({ org_id: ctx.user.org_id, ...b }, ctx.user);
    return created({ account: accountRow(account), credentials: { username: account.username, password } });
  });

  const action = (name, fn) => router.post(`/api/admin/demos/:id/${name}`, { perm: "demos.manage" }, async (ctx) => {
    adminLimit(ctx);
    const a = accountOf(ctx, ctx.params.id);
    const out = await fn(ctx, a);
    return out || { account: accountRow(svc.get(a.id)) };
  });
  action("suspend", (ctx, a) => { svc.suspend(a, ctx.user); instances.close(a.id); });
  action("activate", (ctx, a) => svc.activate(a, ctx.user));
  action("expire", (ctx, a) => { svc.expireNow(a, ctx.user); instances.close(a.id); });
  action("extend", (ctx, a) => {
    const b = parse(schema({ hours: v.int({ min: 1, max: 24 * 30, optional: true }) }), ctx.body);
    const hours = b.hours ?? 24;
    if (hours !== DEMO_HOURS && !can(ctx.user, "demos.extend_custom")) throw forbidden(); // custom periods: SUPER_ADMIN only
    svc.extend(a, hours, ctx.user);
  });
  action("products", (ctx, a) => {
    const b = parse(schema({ grant: v.array(v.enum(PRODUCT_IDS), { max: PRODUCT_IDS.length, optional: true }), revoke: v.array(v.enum(PRODUCT_IDS), { max: PRODUCT_IDS.length, optional: true }) }), ctx.body);
    if (!(b.grant?.length || b.revoke?.length)) throw new HttpError(422, "بيانات غير صالحة", { grant: "حدد نظامًا للمنح أو السحب" });
    if (b.grant?.length) svc.grant(a, b.grant, ctx.user);
    if (b.revoke?.length) svc.revoke(a, b.revoke, ctx.user);
  });
  action("reset-password", async (ctx, a) => ({ account: accountRow(svc.get(a.id)), credentials: { username: a.username, password: await svc.resetPassword(a, ctx.user) } }));
  // Reset Demo Data (staff only): server products are wiped and re-seeded on next open;
  // browser products clear their local data on next open (data_version bump).
  action("reset", (ctx, a) => {
    instances.wipe(a.id);
    db.prepare("UPDATE demo_accounts SET data_version = data_version + 1, updated_at = ? WHERE id = ?").run(svc.nowIso(), a.id);
    audit.log(ctx, "demo.data_reset", "demo_account", a.id);
  });

  /* ---- forgot-password requests ---- */
  router.get("/api/admin/password-requests", { perm: "demos.manage" }, (ctx) => ({
    items: db.prepare(`SELECT p.*, a.customer_name, a.username AS account_username FROM demo_password_requests p LEFT JOIN demo_accounts a ON a.id = p.demo_account_id
      WHERE p.org_id = ? ORDER BY p.status = 'OPEN' DESC, p.id DESC LIMIT 200`).all(ctx.user.org_id),
  }));
  router.post("/api/admin/password-requests/:id/close", { perm: "demos.manage" }, (ctx) => {
    const r = db.prepare("UPDATE demo_password_requests SET status = 'DONE', handled_by = ?, handled_at = ? WHERE id = ? AND org_id = ? AND status = 'OPEN'").run(ctx.user.id, svc.nowIso(), Number(ctx.params.id), ctx.user.org_id);
    if (!r.changes) throw notFound("الطلب");
    audit.log(ctx, "demo.password_request_closed", "demo_password_request", ctx.params.id);
    return { ok: true };
  });

  router.get("/api/search", { perm: "search" }, (ctx) => {
    const raw = String(ctx.query.q || "").trim().slice(0, 100);
    if (raw.length < 2) return { accounts: [], requests: [] };
    const t = likeTerm(raw), o = ctx.user.org_id;
    return {
      accounts: db.prepare("SELECT id, username, customer_name, company_name, status FROM demo_accounts WHERE org_id = ? AND (customer_name LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 8").all(o, t, t, t, t),
      requests: db.prepare("SELECT id, customer_name, company_name, status FROM demo_requests WHERE org_id = ? AND (customer_name LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 8").all(o, t, t, t),
    };
  });
}
