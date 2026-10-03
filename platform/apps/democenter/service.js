// Demo Center domain logic (no HTTP). Every time decision uses the injected
// server clock — never the client's device time.
import { hashPassword, verifyPassword, burnPasswordTime, generatePassword, randomToken, sha256 } from "../../core/security.js";
import { tx } from "../../core/db.js";
import { HttpError, notFound, conflict } from "../../core/errors.js";
import { HOUR, iso } from "../../core/clock.js";
import { PRODUCT_IDS } from "./products.js";

export const DEMO_HOURS = 24;
export const STATUSES = ["PENDING", "ACTIVE", "EXPIRED", "SUSPENDED"];

/** Error codes the portal understands. */
export const demoError = (status, code, message, details) => Object.assign(new HttpError(status, message), { code, details });

export function createDemoService({ db, clock, audit }) {
  const now = () => clock.now();
  const nowIso = () => iso(now());

  const q = {
    account: db.prepare("SELECT * FROM demo_accounts WHERE id = ?"),
    byUsername: db.prepare("SELECT * FROM demo_accounts WHERE username = ?"),
    grants: db.prepare("SELECT product_id, granted_at FROM demo_account_products WHERE demo_account_id = ? AND revoked_at IS NULL ORDER BY id"),
    session: db.prepare("SELECT * FROM demo_sessions WHERE id = ?"),
  };

  /** Status as of now; persists ACTIVE → EXPIRED transitions (audited once). */
  function refresh(acc) {
    if (!acc) return acc;
    if (acc.status === "ACTIVE" && acc.expires_at && Date.parse(acc.expires_at) <= now()) {
      const r = db.prepare("UPDATE demo_accounts SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'ACTIVE'").run(nowIso(), acc.id);
      if (r.changes) {
        // Sessions are kept so the customer sees "انتهت فترة التجربة"; every request re-checks status.
        audit.log({ org_id: acc.org_id, user_id: null }, "demo.expired", "demo_account", acc.id, { expires_at: acc.expires_at });
      }
      return q.account.get(acc.id);
    }
    return acc;
  }
  const get = (id) => refresh(q.account.get(Number(id)));

  const remainingMs = (acc) => (acc.status === "ACTIVE" && acc.expires_at ? Math.max(0, Date.parse(acc.expires_at) - now()) : null);
  const products = (accId) => q.grants.all(accId).map((g) => g.product_id);

  function publicAccount(acc) {
    return {
      id: acc.id, username: acc.username, customer_name: acc.customer_name, company_name: acc.company_name, phone: acc.phone, email: acc.email,
      status: acc.status, created_at: acc.created_at, activated_at: acc.activated_at, expires_at: acc.expires_at, last_login_at: acc.last_login_at,
      remaining_ms: remainingMs(acc), server_now: nowIso(),
    };
  }

  /** Minimal details for the expired/suspended screen (only after valid credentials or session). */
  const summary = (acc) => ({ customer_name: acc.customer_name, company_name: acc.company_name, phone: acc.phone, products: products(acc.id), expires_at: acc.expires_at });

  /* ---------- creation & grants ---------- */
  function uniqueUsername() {
    const alpha = "abcdefghjkmnpqrstuvwxyz23456789";
    for (let i = 0; i < 20; i++) {
      const b = randomToken(8);
      let u = "demo-";
      for (let j = 0; j < 6; j++) u += alpha[b.charCodeAt(j) % alpha.length];
      if (!q.byUsername.get(u)) return u;
    }
    throw new Error("could not allocate a username");
  }

  function validateProducts(list) {
    const ids = [...new Set((list || []).map(String))];
    if (!ids.length) throw new HttpError(422, "بيانات غير صالحة", { products: "اختر نظامًا واحدًا على الأقل" });
    const bad = ids.filter((x) => !PRODUCT_IDS.includes(x));
    if (bad.length) throw new HttpError(422, "بيانات غير صالحة", { products: `نظام غير معروف: ${bad.join(", ")}` });
    return ids;
  }

  /** Create an account (status PENDING; the clock starts at first login). Returns the one-time password. */
  async function createAccount({ org_id, customer_name, phone, email, company_name, products: prods, request_id = null }, byUser) {
    const ids = validateProducts(prods);
    const password = generatePassword();
    const hash = await hashPassword(password);
    const id = tx(db, () => {
      const t = nowIso();
      const accId = db.prepare(`INSERT INTO demo_accounts (org_id, username, password_hash, customer_name, phone, email, company_name, status, request_id, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?, 'PENDING', ?,?,?,?)`).run(org_id, uniqueUsername(), hash, customer_name, phone ?? null, email ?? null, company_name ?? null, request_id, byUser?.id ?? null, t, t).lastInsertRowid;
      for (const p of ids) db.prepare("INSERT INTO demo_account_products (demo_account_id, product_id, granted_at, granted_by) VALUES (?,?,?,?)").run(accId, p, t, byUser?.id ?? null);
      return accId;
    });
    audit.log(byUser ? { user: byUser } : { org_id }, "demo.created", "demo_account", id, { products: ids, request_id });
    for (const p of ids) audit.log(byUser ? { user: byUser } : { org_id }, "demo.product_granted", "demo_account", id, { product: p });
    return { account: q.account.get(id), password };
  }

  function grant(acc, productIds, byUser) {
    const ids = validateProducts(productIds);
    const active = new Set(products(acc.id));
    for (const p of ids) {
      if (active.has(p)) continue;
      db.prepare("INSERT INTO demo_account_products (demo_account_id, product_id, granted_at, granted_by) VALUES (?,?,?,?)").run(acc.id, p, nowIso(), byUser.id);
      audit.log({ user: byUser }, "demo.product_granted", "demo_account", acc.id, { product: p });
    }
  }
  function revoke(acc, productIds, byUser) {
    for (const p of validateProducts(productIds)) {
      const r = db.prepare("UPDATE demo_account_products SET revoked_at = ?, revoked_by = ? WHERE demo_account_id = ? AND product_id = ? AND revoked_at IS NULL").run(nowIso(), byUser.id, acc.id, p);
      if (r.changes) audit.log({ user: byUser }, "demo.product_revoked", "demo_account", acc.id, { product: p });
    }
  }

  /* ---------- customer authentication ---------- */
  /**
   * Verify credentials and open a session. First successful login starts the
   * 24h window; later logins keep the original expiry.
   */
  async function login(username, password, { ip, userAgent }) {
    const found = q.byUsername.get(String(username || "").trim());
    const ok = found ? await verifyPassword(password, found.password_hash) : (await burnPasswordTime(password), false);
    if (!ok) {
      audit.log({ org_id: found?.org_id ?? null, user_id: null, ip }, "demo.login_failed", "demo_account", found?.id ?? null, { username: String(username || "").slice(0, 60) });
      throw demoError(401, "INVALID", "اسم المستخدم أو كلمة المرور غير صحيحة");
    }
    let acc = refresh(found);
    if (acc.status === "SUSPENDED") throw demoError(403, "SUSPENDED", "تم إيقاف هذا الحساب التجريبي. تواصل مع AZENK.", summary(acc));
    if (acc.status === "EXPIRED") throw demoError(403, "EXPIRED", "انتهت فترة التجربة", summary(acc));
    const t = now();
    if (!acc.activated_at) {
      // First successful login: start the clock (guarded so concurrent logins cannot restart it).
      db.prepare("UPDATE demo_accounts SET status = 'ACTIVE', activated_at = ?, expires_at = ?, updated_at = ? WHERE id = ? AND activated_at IS NULL")
        .run(iso(t), iso(t + DEMO_HOURS * HOUR), iso(t), acc.id);
      db.prepare("UPDATE demo_requests SET status = 'COMPLETED' WHERE demo_account_id = ? AND status = 'APPROVED'").run(acc.id);
      audit.log({ org_id: acc.org_id, user_id: null, ip }, "demo.activated", "demo_account", acc.id, { expires_at: iso(t + DEMO_HOURS * HOUR) });
    }
    db.prepare("UPDATE demo_accounts SET last_login_at = ?, updated_at = ? WHERE id = ?").run(iso(t), iso(t), acc.id);
    acc = q.account.get(acc.id);
    const token = randomToken(32);
    const csrf = randomToken(24);
    db.prepare("INSERT INTO demo_sessions (id, demo_account_id, csrf_token, created_at, last_seen_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)")
      .run(sha256(token), acc.id, csrf, iso(t), iso(t), ip ?? null, String(userAgent || "").slice(0, 200));
    audit.log({ org_id: acc.org_id, user_id: null, ip }, "demo.login", "demo_account", acc.id);
    return { account: acc, token, csrf };
  }

  /**
   * Resolve a session token and enforce status + expiry. Throws demo errors:
   * NO_SESSION (401), EXPIRED / SUSPENDED (403).
   */
  function authenticate(token) {
    if (!token || token.length > 100) throw demoError(401, "NO_SESSION", "يجب تسجيل الدخول إلى Demo Center");
    const s = q.session.get(sha256(token));
    if (!s) throw demoError(401, "NO_SESSION", "انتهت الجلسة، سجّل الدخول من جديد");
    const acc = get(s.demo_account_id);
    if (!acc) throw demoError(401, "NO_SESSION", "انتهت الجلسة");
    if (acc.status === "SUSPENDED") throw demoError(403, "SUSPENDED", "تم إيقاف هذا الحساب التجريبي", summary(acc));
    if (acc.status === "EXPIRED") throw demoError(403, "EXPIRED", "انتهت فترة التجربة", summary(acc));
    if (acc.status !== "ACTIVE") throw demoError(401, "NO_SESSION", "يجب تسجيل الدخول");
    if (now() - Date.parse(s.last_seen_at) > 60_000) db.prepare("UPDATE demo_sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), s.id);
    return { account: acc, session: s };
  }

  /** Product access check (after authenticate). */
  function requireProduct(acc, productId) {
    if (!products(acc.id).includes(productId)) throw demoError(403, "NO_ACCESS", "هذا النظام غير مفعّل في تجربتك");
  }

  function logout(token) { if (token) db.prepare("DELETE FROM demo_sessions WHERE id = ?").run(sha256(token)); }

  /* ---------- admin lifecycle actions ---------- */
  function suspend(acc, byUser) {
    if (acc.status === "SUSPENDED") throw conflict("الحساب موقوف مسبقًا");
    db.prepare("UPDATE demo_accounts SET suspended_from = status, status = 'SUSPENDED', updated_at = ? WHERE id = ?").run(nowIso(), acc.id);
    db.prepare("DELETE FROM demo_sessions WHERE demo_account_id = ?").run(acc.id);
    audit.log({ user: byUser }, "demo.suspended", "demo_account", acc.id);
  }
  function activate(acc, byUser) {
    if (acc.status !== "SUSPENDED") throw conflict("يمكن التفعيل فقط لحساب موقوف");
    let next = acc.activated_at ? "ACTIVE" : "PENDING";
    if (next === "ACTIVE" && Date.parse(acc.expires_at) <= now()) next = "EXPIRED";
    db.prepare("UPDATE demo_accounts SET status = ?, suspended_from = NULL, updated_at = ? WHERE id = ?").run(next, nowIso(), acc.id);
    audit.log({ user: byUser }, "demo.reactivated", "demo_account", acc.id, { status: next });
  }
  /** Extend by `hours` from max(expires_at, now). */
  function extend(acc, hours, byUser) {
    if (!acc.activated_at) throw conflict("لم تبدأ التجربة بعد؛ تبدأ مدة 24 ساعة عند أول دخول");
    if (acc.status === "SUSPENDED") throw conflict("فعّل الحساب أولًا");
    const from = Math.max(Date.parse(acc.expires_at), now());
    const until = iso(from + hours * HOUR);
    db.prepare("UPDATE demo_accounts SET status = 'ACTIVE', expires_at = ?, updated_at = ? WHERE id = ?").run(until, nowIso(), acc.id);
    audit.log({ user: byUser }, "demo.extended", "demo_account", acc.id, { hours, expires_at: until });
  }
  function expireNow(acc, byUser) {
    if (acc.status === "EXPIRED") throw conflict("الحساب منتهٍ مسبقًا");
    const t = nowIso();
    db.prepare("UPDATE demo_accounts SET status = 'EXPIRED', expires_at = CASE WHEN expires_at IS NOT NULL AND expires_at < ? THEN expires_at ELSE ? END, updated_at = ? WHERE id = ?").run(t, t, t, acc.id);
    db.prepare("DELETE FROM demo_sessions WHERE demo_account_id = ?").run(acc.id);
    audit.log({ user: byUser }, "demo.expired_by_admin", "demo_account", acc.id);
  }
  async function resetPassword(acc, byUser) {
    const password = generatePassword();
    db.prepare("UPDATE demo_accounts SET password_hash = ?, updated_at = ? WHERE id = ?").run(await hashPassword(password), nowIso(), acc.id);
    db.prepare("DELETE FROM demo_sessions WHERE demo_account_id = ?").run(acc.id);
    audit.log({ user: byUser }, "demo.password_reset", "demo_account", acc.id); // the password itself is never logged
    return password;
  }

  /** Mark all overdue ACTIVE accounts as EXPIRED (periodic sweep). Returns their ids. */
  function sweep() {
    const due = db.prepare("SELECT * FROM demo_accounts WHERE status = 'ACTIVE' AND expires_at <= ?").all(nowIso());
    for (const a of due) refresh(a);
    return due.map((a) => a.id);
  }

  return { audit, now, nowIso, get, refresh, publicAccount, products, remainingMs, createAccount, grant, revoke, login, authenticate, requireProduct, logout, suspend, activate, extend, expireNow, resetPassword, sweep, validateProducts };
}

export const notFoundAccount = () => notFound("الحساب التجريبي");
