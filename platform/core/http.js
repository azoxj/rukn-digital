// Minimal HTTP layer on node:http: routing, JSON/raw bodies with size limits,
// security headers, CSRF + same-origin checks, auth + RBAC gate, static files
// and uniform JSON errors.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { HttpError, unauthorized, forbidden } from "./errors.js";
import { RateLimiter, safeEqual } from "./security.js";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export class Router {
  constructor() { this.routes = []; }
  add(method, path, opts, handler) {
    if (typeof opts === "function") { handler = opts; opts = {}; }
    const keys = [];
    const rx = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    this.routes.push({ method, rx, keys, opts: { auth: true, ...opts }, handler });
  }
  get(p, o, h) { this.add("GET", p, o, h); }
  post(p, o, h) { this.add("POST", p, o, h); }
  patch(p, o, h) { this.add("PATCH", p, o, h); }
  put(p, o, h) { this.add("PUT", p, o, h); }
  delete(p, o, h) { this.add("DELETE", p, o, h); }
  match(method, path) {
    let allowed = false;
    for (const r of this.routes) {
      const m = r.rx.exec(path);
      if (!m) continue;
      allowed = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return allowed ? { methodNotAllowed: true } : null;
  }
}

function readBody(req, max) {
  return new Promise((resolveBody, reject) => {
    const len = Number(req.headers["content-length"] || 0);
    if (len > max) { reject(new HttpError(413, "حجم الطلب أكبر من المسموح")); req.resume(); return; }
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) { reject(new HttpError(413, "حجم الطلب أكبر من المسموح")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders });
  res.end(body);
}

const clientIp = (req, trustProxy) => {
  if (trustProxy) {
    const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || "unknown";
};

/**
 * Build a request handler.
 * opts: { router, auth (session resolver), staticDirs: [[urlPrefix, dir]], trustProxy, log }
 */
export function createHandler({ router, auth, staticDirs = [], trustProxy = false, log = console }) {
  const apiLimiter = new RateLimiter(Number(process.env.API_RATE_LIMIT || 600), 60_000);

  async function serveStatic(req, res, pathname) {
    for (const [prefix, dir] of staticDirs) {
      if (!pathname.startsWith(prefix)) continue;
      let rel = pathname.slice(prefix.length) || "index.html";
      if (rel.endsWith("/")) rel += "index.html";
      const root = resolve(dir);
      const file = resolve(join(root, normalize(rel)));
      if (file !== root && !file.startsWith(root + sep)) return false;
      try {
        const st = await stat(file);
        if (!st.isFile()) continue;
        const data = await readFile(file);
        const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": type.startsWith("text/html") ? "no-cache" : "public, max-age=300" });
        res.end(req.method === "HEAD" ? undefined : data);
        return true;
      } catch { /* try next dir */ }
    }
    return false;
  }

  return async function handle(req, res) {
    for (const [k, val] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, val);
    if (process.env.COOKIE_SECURE === "1") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    const url = new URL(req.url, "http://local");
    const pathname = url.pathname;
    const ip = clientIp(req, trustProxy);
    const ctx = { req, res, ip, query: Object.fromEntries(url.searchParams), params: {}, body: undefined, user: null, session: null };

    try {
      if (!pathname.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed");
        if (await serveStatic(req, res, pathname)) return;
        throw new HttpError(404, "الصفحة غير موجودة");
      }

      const wait = apiLimiter.hit(ip);
      if (wait) throw Object.assign(new HttpError(429, "طلبات كثيرة، حاول بعد قليل"), { retryAfter: Math.ceil(wait / 1000) });

      const m = router.match(req.method, pathname);
      if (!m) throw new HttpError(404, "المسار غير موجود");
      if (m.methodNotAllowed) throw new HttpError(405, "الطريقة غير مسموحة");
      const { route, params } = m;
      ctx.params = params;

      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating) {
        // Same-origin check: browsers send Origin on cross-site POSTs.
        const origin = req.headers.origin;
        if (origin) {
          const host = req.headers["x-forwarded-host"] && trustProxy ? req.headers["x-forwarded-host"] : req.headers.host;
          let oh = "";
          try { oh = new URL(origin).host; } catch { /* invalid */ }
          if (oh !== host) throw new HttpError(403, "مصدر الطلب غير مسموح");
        }
      }

      const session = route.opts.skipSession ? null : await auth.resolve(req, ctx);
      if (session) { ctx.session = session.session; ctx.user = session.user; }
      if (route.opts.auth && !ctx.user) throw unauthorized();
      if (ctx.user && ctx.user.must_change_password && route.opts.auth && !route.opts.allowPasswordChange) {
        throw new HttpError(403, "يجب تغيير كلمة المرور المؤقتة أولًا");
      }

      if (mutating && ctx.session) {
        const token = req.headers["x-csrf-token"];
        if (!token || !safeEqual(token, ctx.session.csrf_token)) throw new HttpError(403, "رمز الحماية (CSRF) غير صالح، أعد تحميل الصفحة");
      }

      if (route.opts.perm) {
        const perms = Array.isArray(route.opts.perm) ? route.opts.perm : [route.opts.perm];
        if (!perms.some((p) => auth.can(ctx.user, p))) throw forbidden();
      }

      if (mutating || route.opts.raw) {
        if (route.opts.raw) {
          ctx.body = await readBody(req, route.opts.maxBytes || 10 * 1024 * 1024);
        } else {
          const buf = await readBody(req, route.opts.maxBytes || 1024 * 1024);
          if (buf.length) {
            const ct = String(req.headers["content-type"] || "");
            if (!ct.startsWith("application/json")) throw new HttpError(415, "يجب إرسال البيانات بصيغة JSON");
            try { ctx.body = JSON.parse(buf.toString("utf8")); } catch { throw new HttpError(400, "JSON غير صالح"); }
          } else ctx.body = {};
        }
      }

      const out = await route.handler(ctx);
      if (res.headersSent || res.writableEnded) return;
      if (out && out.__status) sendJson(res, out.__status, out.body);
      else sendJson(res, 200, out === undefined ? { ok: true } : out);
    } catch (err) {
      if (res.headersSent) { res.destroy(); return; }
      if (err instanceof HttpError) {
        const headers = err.retryAfter ? { "Retry-After": String(err.retryAfter) } : {};
        if (!pathname.startsWith("/api/") && err.status === 404) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("404 — الصفحة غير موجودة");
          return;
        }
        sendJson(res, err.status, { error: { message: err.message, fields: err.fields || undefined, code: err.code || undefined, details: err.details || undefined } }, headers);
        return;
      }
      if (err && /UNIQUE constraint failed/.test(err.message)) {
        sendJson(res, 409, { error: { message: "القيمة مستخدمة مسبقًا" } });
        return;
      }
      log.error("[server error]", req.method, pathname, err);
      sendJson(res, 500, { error: { message: "حدث خطأ غير متوقع في الخادم" } });
    }
  };
}

export const created = (body) => ({ __status: 201, body });

export function listen(handler, port, host = "127.0.0.1") {
  const server = createServer(handler);
  server.headersTimeout = 20_000;
  server.requestTimeout = 60_000;
  return new Promise((r) => server.listen(port, host, () => r(server)));
}
