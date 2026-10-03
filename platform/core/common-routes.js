// Routes every app shares: users, organisations (tenants), notifications, audit log.
import { created } from "./http.js";
import { HttpError, notFound, forbidden } from "./errors.js";
import { hashPassword, generatePassword } from "./security.js";
import { parse, schema, v } from "./validate.js";
import { publicUser } from "./auth.js";
import { paging, likeTerm } from "./services.js";
import { nowIso } from "./db.js";

export function commonRoutes(router, { db, app, auth, audit }) {
  const manageable = (role) => app.manageRoles[role] || [];
  const userCreate = schema({
    name: v.string({ min: 2, max: 120 }),
    email: v.email(),
    phone: v.phone({ optional: true, nullable: true }),
    role: v.enum(app.roles),
  });
  const userPatch = schema({
    name: v.string({ min: 2, max: 120 }),
    phone: v.phone({ optional: true, nullable: true }),
    role: v.enum(app.roles),
    is_active: v.bool(),
  });

  const getUser = (ctx, id) => {
    const u = db.prepare("SELECT * FROM users WHERE id = ? AND org_id = ?").get(Number(id), ctx.user.org_id);
    if (!u) throw notFound("المستخدم");
    return u;
  };

  /* ---------- Users ---------- */
  router.get("/api/users", { perm: "users.view" }, (ctx) => {
    const where = ["org_id = ?"], args = [ctx.user.org_id];
    if (ctx.query.role && app.roles.includes(ctx.query.role)) { where.push("role = ?"); args.push(ctx.query.role); }
    if (ctx.query.active === "1" || ctx.query.active === "0") { where.push("is_active = ?"); args.push(Number(ctx.query.active)); }
    if (ctx.query.q) { where.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')"); args.push(likeTerm(ctx.query.q), likeTerm(ctx.query.q)); }
    const rows = db.prepare(`SELECT * FROM users WHERE ${where.join(" AND ")} ORDER BY is_active DESC, name LIMIT 500`).all(...args);
    return { items: rows.map(publicUser), manageable_roles: manageable(ctx.user.role) };
  });

  // Minimal directory (id, name, role) for pickers — every signed-in role.
  router.get("/api/users/directory", (ctx) => {
    const rows = db.prepare("SELECT id, name, role FROM users WHERE org_id = ? AND is_active = 1 ORDER BY name").all(ctx.user.org_id);
    return { items: rows };
  });

  router.post("/api/users", { perm: "users.manage" }, async (ctx) => {
    const b = parse(userCreate, ctx.body);
    if (!manageable(ctx.user.role).includes(b.role)) throw forbidden();
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(b.email)) throw new HttpError(409, "البريد الإلكتروني مستخدم مسبقًا", { email: "مستخدم مسبقًا" });
    const temp = generatePassword();
    const r = db.prepare("INSERT INTO users (org_id, email, name, phone, role, password_hash, must_change_password) VALUES (?,?,?,?,?,?,1)")
      .run(ctx.user.org_id, b.email, b.name, b.phone ?? null, b.role, await hashPassword(temp));
    audit.log(ctx, "user.create", "user", r.lastInsertRowid, { email: b.email, role: b.role });
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(r.lastInsertRowid);
    // The temporary password is returned once so the admin can hand it over; it is never stored in clear.
    return created({ user: publicUser(u), temporary_password: temp });
  });

  router.patch("/api/users/:id", { perm: "users.manage" }, (ctx) => {
    const u = getUser(ctx, ctx.params.id);
    const b = parse(userPatch, ctx.body, { partial: true });
    if (!manageable(ctx.user.role).includes(u.role)) throw forbidden();
    if (b.role && !manageable(ctx.user.role).includes(b.role)) throw forbidden();
    if (u.id === ctx.user.id && (b.role !== undefined || b.is_active === false)) throw new HttpError(422, "لا يمكنك تغيير دورك أو تعطيل حسابك");
    const cols = [], vals = [];
    for (const k of ["name", "phone", "role"]) if (b[k] !== undefined) { cols.push(`${k} = ?`); vals.push(b[k]); }
    if (b.is_active !== undefined) { cols.push("is_active = ?"); vals.push(b.is_active ? 1 : 0); }
    if (!cols.length) return { user: publicUser(u) };
    db.prepare(`UPDATE users SET ${cols.join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), u.id);
    if (b.is_active === false || (b.role && b.role !== u.role)) auth.revokeUser(u.id);
    audit.log(ctx, "user.update", "user", u.id, b);
    return { user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(u.id)) };
  });

  router.post("/api/users/:id/reset-password", { perm: "users.manage" }, async (ctx) => {
    const u = getUser(ctx, ctx.params.id);
    if (!manageable(ctx.user.role).includes(u.role) || u.id === ctx.user.id) throw forbidden();
    const temp = generatePassword();
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?").run(await hashPassword(temp), nowIso(), u.id);
    auth.revokeUser(u.id);
    audit.log(ctx, "user.reset_password", "user", u.id);
    return { temporary_password: temp };
  });

  /* ---------- Organisations (tenants) ---------- */
  if (app.tenants) {
    const orgCreate = schema({
      name: v.string({ min: 2, max: 120 }),
      slug: v.string({ min: 2, max: 40, pattern: /^[a-z0-9-]+$/, message: "حروف إنجليزية صغيرة وأرقام و - فقط" }),
      admin_name: v.string({ min: 2, max: 120 }),
      admin_email: v.email(),
    });
    router.get("/api/orgs", { perm: "orgs.manage" }, () => ({
      items: db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) AS users FROM organizations o ORDER BY o.id`).all(),
    }));
    router.post("/api/orgs", { perm: "orgs.manage" }, async (ctx) => {
      const b = parse(orgCreate, ctx.body);
      if (db.prepare("SELECT 1 FROM organizations WHERE slug = ?").get(b.slug)) throw new HttpError(409, "المعرّف مستخدم", { slug: "مستخدم مسبقًا" });
      if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(b.admin_email)) throw new HttpError(409, "البريد مستخدم", { admin_email: "مستخدم مسبقًا" });
      const temp = generatePassword();
      const hash = await hashPassword(temp);
      db.exec("BEGIN IMMEDIATE");
      let orgId;
      try {
        orgId = db.prepare("INSERT INTO organizations (name, slug) VALUES (?, ?)").run(b.name, b.slug).lastInsertRowid;
        db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,1)").run(orgId, b.admin_email, b.admin_name, "ADMIN", hash);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
      audit.log(ctx, "org.create", "organization", orgId, { slug: b.slug });
      return created({ organization: db.prepare("SELECT * FROM organizations WHERE id = ?").get(orgId), admin_email: b.admin_email, temporary_password: temp });
    });
    router.patch("/api/orgs/:id", { perm: "orgs.manage" }, (ctx) => {
      const b = parse(schema({ name: v.string({ min: 2, max: 120 }), is_active: v.bool() }), ctx.body, { partial: true });
      const o = db.prepare("SELECT * FROM organizations WHERE id = ?").get(Number(ctx.params.id));
      if (!o) throw notFound("المنشأة");
      if (o.id === ctx.user.org_id && b.is_active === false) throw new HttpError(422, "لا يمكن تعطيل منشأتك الحالية");
      if (b.name !== undefined) db.prepare("UPDATE organizations SET name = ? WHERE id = ?").run(b.name, o.id);
      if (b.is_active !== undefined) db.prepare("UPDATE organizations SET is_active = ? WHERE id = ?").run(b.is_active ? 1 : 0, o.id);
      audit.log(ctx, "org.update", "organization", o.id, b);
      return { organization: db.prepare("SELECT * FROM organizations WHERE id = ?").get(o.id) };
    });
  }

  /* ---------- Notifications (own only) ---------- */
  router.get("/api/notifications", (ctx) => {
    const { size, offset } = paging(ctx.query, 30, 100);
    const unreadOnly = ctx.query.unread === "1";
    const items = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ${unreadOnly ? "AND read_at IS NULL" : ""} ORDER BY id DESC LIMIT ? OFFSET ?`).all(ctx.user.id, size, offset);
    const unread = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(ctx.user.id).n;
    return { items, unread };
  });
  router.post("/api/notifications/:id/read", (ctx) => {
    const r = db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL").run(nowIso(), Number(ctx.params.id), ctx.user.id);
    return { updated: r.changes };
  });
  router.post("/api/notifications/read-all", (ctx) => {
    const r = db.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(nowIso(), ctx.user.id);
    return { updated: r.changes };
  });

  /* ---------- Audit log ---------- */
  router.get("/api/audit", { perm: "audit.view" }, (ctx) => {
    const { size, offset, page } = paging(ctx.query, 50, 200);
    const where = ["a.org_id = ?"], args = [ctx.user.org_id];
    if (ctx.query.action) { where.push("a.action LIKE ? ESCAPE '\\'"); args.push(likeTerm(ctx.query.action)); }
    if (ctx.query.entity) { where.push("a.entity = ?"); args.push(String(ctx.query.entity)); }
    if (ctx.query.user_id) { where.push("a.user_id = ?"); args.push(Number(ctx.query.user_id)); }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log a WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`).all(...args, size, offset);
    return { items, total, page, size };
  });
}
