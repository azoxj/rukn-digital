// Sessions (HttpOnly cookie, hashed token at rest), login/logout/me,
// password change, login rate limiting and role-based permission checks.
import { parseCookies, created } from "./http.js";
import { HttpError } from "./errors.js";
import { hashPassword, verifyPassword, burnPasswordTime, passwordProblem, randomToken, sha256, RateLimiter } from "./security.js";
import { parse, schema, v } from "./validate.js";
import { nowIso } from "./db.js";

const IDLE_MS = 12 * 60 * 60 * 1000; // 12h idle
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days max

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, org_id: u.org_id, email: u.email, name: u.name, phone: u.phone, role: u.role, is_active: !!u.is_active, must_change_password: !!u.must_change_password, last_login_at: u.last_login_at, created_at: u.created_at };
}

export function createAuth({ db, app, audit }) {
  const cookieName = `azk_${app.name}_sid`;
  const secure = process.env.COOKIE_SECURE === "1";
  const loginLimiter = new RateLimiter(Number(process.env.LOGIN_MAX_ATTEMPTS || 5), 15 * 60 * 1000);
  const ipLimiter = new RateLimiter(Number(process.env.LOGIN_MAX_PER_IP || 30), 15 * 60 * 1000);
  const perms = new Map(Object.entries(app.permissions).map(([role, list]) => [role, new Set(list)]));

  const can = (user, perm) => !!user && !!perms.get(user.role)?.has(perm);

  const cookie = (value, maxAgeSec) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}; Max-Age=${maxAgeSec}`;

  const q = {
    session: db.prepare(`SELECT s.*, u.id AS uid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`),
    user: db.prepare(`SELECT u.* FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.id = ? AND u.is_active = 1 AND o.is_active = 1`),
    touch: db.prepare(`UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?`),
    del: db.prepare(`DELETE FROM sessions WHERE id = ?`),
    delUser: db.prepare(`DELETE FROM sessions WHERE user_id = ?`),
    delUserExcept: db.prepare(`DELETE FROM sessions WHERE user_id = ? AND id <> ?`),
    byEmail: db.prepare(`SELECT u.*, o.is_active AS org_active FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = ?`),
    insert: db.prepare(`INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?,?)`),
    lastLogin: db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`),
    setPw: db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`),
    expired: db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),
  };

  async function resolveSession(req) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (!token || token.length > 100) return null;
    const id = sha256(token);
    const s = q.session.get(id);
    if (!s) return null;
    const now = Date.now();
    if (Date.parse(s.expires_at) < now || Date.parse(s.created_at) + ABSOLUTE_MS < now) { q.del.run(id); return null; }
    const user = q.user.get(s.user_id);
    if (!user) { q.del.run(id); return null; }
    // Sliding idle expiry, written at most once a minute.
    if (now - Date.parse(s.last_seen_at) > 60_000) q.touch.run(new Date(now).toISOString(), new Date(now + IDLE_MS).toISOString(), id);
    return { session: s, user };
  }

  async function startSession(ctx, user) {
    const token = randomToken(32);
    const csrf = randomToken(24);
    const now = new Date();
    q.insert.run(sha256(token), user.id, csrf, now.toISOString(), now.toISOString(), new Date(now.getTime() + IDLE_MS).toISOString(), ctx.ip, String(ctx.req.headers["user-agent"] || "").slice(0, 200));
    ctx.res.setHeader("Set-Cookie", cookie(token, Math.floor(ABSOLUTE_MS / 1000)));
    return csrf;
  }

  const loginSchema = schema({ email: v.email(), password: v.string({ min: 1, max: 200, trim: false }) });
  const pwSchema = schema({ current_password: v.string({ min: 1, max: 200, trim: false }), new_password: v.string({ min: 1, max: 200, trim: false }) });

  function routes(router) {
    router.post("/api/auth/login", { auth: false }, async (ctx) => {
      const { email, password } = parse(loginSchema, ctx.body);
      const key = `${email}|${ctx.ip}`;
      const wait = Math.max(loginLimiter.blocked(key), ipLimiter.blocked(ctx.ip));
      if (wait) throw Object.assign(new HttpError(429, "محاولات دخول كثيرة. حاول مرة أخرى بعد قليل."), { retryAfter: Math.ceil(wait / 1000) });
      const u = q.byEmail.get(email);
      const valid = u ? await verifyPassword(password, u.password_hash) : (await burnPasswordTime(password), false);
      if (!valid || !u.is_active || !u.org_active) {
        loginLimiter.hit(key);
        ipLimiter.hit(ctx.ip);
        audit.log({ org_id: u ? u.org_id : null, user_id: u ? u.id : null, ip: ctx.ip }, "auth.login_failed", "user", u ? u.id : null, { email });
        throw new HttpError(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة");
      }
      loginLimiter.reset(key);
      if (ctx.session) q.del.run(ctx.session.id); // rotate
      const csrf = await startSession(ctx, u);
      q.lastLogin.run(nowIso(), u.id);
      audit.log({ org_id: u.org_id, user_id: u.id, ip: ctx.ip }, "auth.login", "user", u.id);
      return { user: publicUser(u), csrf, permissions: [...(perms.get(u.role) || [])] };
    });

    router.post("/api/auth/logout", { auth: false }, async (ctx) => {
      if (ctx.session) {
        q.del.run(ctx.session.id);
        audit.log(ctx, "auth.logout", "user", ctx.user.id);
      }
      ctx.res.setHeader("Set-Cookie", cookie("", 0));
      return { ok: true };
    });

    router.get("/api/auth/me", { auth: false }, async (ctx) => {
      if (!ctx.user) return { user: null, app: { name: app.name, title: app.title } };
      return { user: publicUser(ctx.user), csrf: ctx.session.csrf_token, permissions: [...(perms.get(ctx.user.role) || [])], app: { name: app.name, title: app.title } };
    });

    router.post("/api/auth/password", { allowPasswordChange: true }, async (ctx) => {
      const b = parse(pwSchema, ctx.body);
      if (!(await verifyPassword(b.current_password, ctx.user.password_hash))) throw new HttpError(422, "بيانات غير صالحة", { current_password: "كلمة المرور الحالية غير صحيحة" });
      const problem = passwordProblem(b.new_password);
      if (problem) throw new HttpError(422, "بيانات غير صالحة", { new_password: problem });
      if (b.new_password === b.current_password) throw new HttpError(422, "بيانات غير صالحة", { new_password: "اختر كلمة مرور مختلفة عن الحالية" });
      q.setPw.run(await hashPassword(b.new_password), nowIso(), ctx.user.id);
      q.delUserExcept.run(ctx.user.id, ctx.session.id); // sign out other devices
      audit.log(ctx, "auth.password_changed", "user", ctx.user.id);
      return { ok: true };
    });
  }

  return {
    can,
    routes,
    resolve: resolveSession,
    revokeUser: (userId) => q.delUser.run(userId),
    cleanup: () => q.expired.run(nowIso()),
    permissionsOf: (role) => [...(perms.get(role) || [])],
    /** Open a session for `user` (used by trusted server-side flows such as Demo Center SSO). */
    issueSession: (ctx, user) => startSession(ctx, user),
    cookieName,
    resetLimiters: () => { loginLimiter.clear(); ipLimiter.clear(); },
    created,
  };
}
