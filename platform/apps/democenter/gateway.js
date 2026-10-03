// Demo Center access gateway: every request under /demo-target/<product>/…
// (pages, assets and APIs) is checked server-side BEFORE anything is served:
//   demo session valid → account ACTIVE → expires_at > server clock → product granted.
// Then it is served by the product adapter:
//   server  → forwarded to the account's isolated instance of the real app
//   browser → the app's static files, with a small injected script (__demo.js)
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { parseCookies, sendJson } from "../../core/http.js";
import { sha256 } from "../../core/security.js";
import { productById } from "./products.js";
import { SERVER_APPS } from "./instances.js";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};
// Browser products were built for static hosting and use inline scripts + Google Fonts.
const BROWSER_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const BASE_HEADERS = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };

export const TARGET = "/demo-target";
export const DEMO_COOKIE = "azk_demo_sid";

export function createGateway({ getService, instances, siteRoot, centerUrl = "/", log = console }) {
  const isApi = (sub) => sub.startsWith("api/");
  const deny = (res, sub, status, code, message) => {
    if (isApi(sub)) return sendJson(res, status, { error: { message, code } }, BASE_HEADERS);
    // Pages: send the visitor back to Demo Center, which explains the state (login / expired / no access).
    res.writeHead(302, { ...BASE_HEADERS, Location: `${centerUrl}#/${code === "EXPIRED" ? "expired" : code === "NO_ACCESS" ? "no-access" : "login"}` });
    res.end();
  };

  async function serveFile(res, file, headers = {}) {
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) return false;
    const data = await readFile(file);
    res.writeHead(200, { ...BASE_HEADERS, "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream", ...headers });
    res.end(data);
    return true;
  }
  const safeJoin = (root, rel) => {
    const r = resolve(root);
    const f = resolve(join(r, normalize(rel)));
    return f === r || f.startsWith(r + sep) ? f : null;
  };

  /** Per-account bootstrap script injected first into every product page. */
  function demoScript(account, product, inst) {
    const owner = sha256(`${account.id}:${account.data_version}:${product.id}`).slice(0, 24);
    const cfg = {
      product: product.id, name: product.name, kind: product.kind, owner,
      prefixes: product.storagePrefixes || [], expiresAt: account.expires_at, serverNow: new Date(getService().now()).toISOString(),
      center: centerUrl, status: "/api/demo/status",
      apiBase: product.kind === "server" ? `${TARGET}/${product.id}` : null,
      sso: inst ? inst.roles : null,
    };
    return `/* AZENK Demo Center bootstrap (generated per session) */
(function () {
  var D = ${JSON.stringify(cfg)};
  window.AZ_DEMO_CENTER = D;
  if (D.kind === "server") { window.AZ_API_BASE = D.apiBase; window.AZ_DEMO_SSO = D.sso; }
  // Browser products keep data in localStorage: clear it when another demo account (or a reset) uses this browser.
  try {
    var k = "azenk-demo-owner:" + D.product;
    if (localStorage.getItem(k) !== D.owner) {
      Object.keys(localStorage).forEach(function (x) { if (D.prefixes.some(function (p) { return x.indexOf(p) === 0; })) localStorage.removeItem(x); });
      localStorage.setItem(k, D.owner);
    }
  } catch (e) { /* storage blocked */ }
  var offset = Date.parse(D.serverNow) - Date.now(), exp = D.expiresAt ? Date.parse(D.expiresAt) : null;
  function remaining() { return exp == null ? 0 : Math.max(0, exp - (Date.now() + offset)); }
  function fmt(ms) { var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s = s % 60; return [h, m, s].map(function (n) { return String(n).padStart(2, "0"); }).join(":"); }
  function back() { location.href = D.center; }
  function bar() {
    var b = document.createElement("div"); b.setAttribute("role", "status"); b.id = "azenk-demo-bar";
    Object.assign(b.style, { position: "fixed", insetInline: "0", bottom: "0", zIndex: "2147483000", display: "flex", gap: "12px", alignItems: "center", justifyContent: "center", flexWrap: "wrap",
      padding: "7px 12px", background: "#0a1324", color: "#e7d29e", borderTop: "1px solid rgba(201,164,92,.5)", font: "500 13px/1.4 Tahoma, 'Segoe UI', sans-serif", direction: "rtl" });
    var t = document.createElement("span"), a = document.createElement("button");
    a.type = "button"; a.textContent = "العودة إلى Demo Center"; a.onclick = back;
    Object.assign(a.style, { background: "transparent", color: "#f6f4ef", border: "1px solid rgba(201,164,92,.6)", borderRadius: "999px", padding: "3px 12px", cursor: "pointer", font: "inherit" });
    b.appendChild(t); b.appendChild(a); document.body.appendChild(b);
    document.body.style.paddingBottom = "44px";
    function tick() {
      var r = remaining();
      if (r <= 0) { back(); return; }
      var warn = r <= 30 * 60000 ? "تبقى 30 دقيقة على انتهاء تجربتك — " : r <= 2 * 3600000 ? "تنتهي تجربتك خلال ساعتين — " : "";
      t.textContent = "Demo · " + D.name + " · " + warn + "متبقي " + fmt(r);
      b.style.background = r <= 30 * 60000 ? "#4a1d1d" : r <= 2 * 3600000 ? "#3a2c10" : "#0a1324";
    }
    tick(); setInterval(tick, 1000);
    // The server stays the source of truth (suspension / extension / expiry).
    setInterval(function () {
      fetch(D.status, { credentials: "same-origin" }).then(function (r) { if (r.status === 401 || r.status === 403) back(); return r.ok ? r.json() : null; })
        .then(function (s) { if (s && s.expires_at) { exp = Date.parse(s.expires_at); offset = Date.parse(s.server_now) - Date.now(); } }).catch(function () {});
    }, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bar); else bar();
})();
`;
  }

  const inject = (html) => html.replace(/<head([^>]*)>/i, (m) => `${m}\n  <script src="__demo.js"></script>`);

  return async function gate(req, res) {
    const url = new URL(req.url, "http://local");
    const rest = url.pathname.slice(TARGET.length).replace(/^\/+/, "");
    const [pid, ...parts] = rest.split("/");
    const sub = parts.join("/");

    // Shared public site assets referenced as ../assets/… by browser products.
    if (pid === "assets") {
      const f = safeJoin(join(siteRoot, "assets"), decodeURIComponent(sub));
      if (f && (await serveFile(res, f, { "Cache-Control": "public, max-age=3600" }))) return;
      res.writeHead(404, BASE_HEADERS); res.end(); return;
    }
    const product = productById(pid);
    if (!product) { res.writeHead(302, { ...BASE_HEADERS, Location: centerUrl }); res.end(); return; }
    if (!parts.length) { res.writeHead(302, { ...BASE_HEADERS, Location: `${TARGET}/${pid}/` }); res.end(); return; }

    // ---- server-side access checks (session, status, expiry, grant) ----
    const service = getService();
    let account;
    try {
      ({ account } = service.authenticate(parseCookies(req.headers.cookie)[DEMO_COOKIE]));
      service.requireProduct(account, product.id);
    } catch (e) {
      if (e.code) return deny(res, sub, e.status, e.code, e.message);
      throw e;
    }

    try {
      if (product.kind === "browser") {
        if (sub === "__demo.js") { res.writeHead(200, { ...BASE_HEADERS, "Content-Type": MIME[".js"] }); res.end(demoScript(account, product, null)); return; }
        const rel = decodeURIComponent(sub || "index.html").replace(/\/$/, "/index.html");
        const f = safeJoin(join(siteRoot, product.dir), rel);
        if (!f) { res.writeHead(404, BASE_HEADERS); res.end(); return; }
        if (f.endsWith(".html")) {
          const html = await readFile(f, "utf8").catch(() => null);
          if (html == null) { res.writeHead(404, BASE_HEADERS); res.end(); return; }
          res.writeHead(200, { ...BASE_HEADERS, "Content-Type": MIME[".html"], "Content-Security-Policy": BROWSER_CSP });
          res.end(inject(html));
          return;
        }
        if (!(await serveFile(res, f))) { res.writeHead(404, BASE_HEADERS); res.end(); }
        return;
      }

      // server product: the account's isolated instance
      const inst = await instances.get(account.id, account.data_version, product.app);
      if (sub === "__demo.js") { res.writeHead(200, { ...BASE_HEADERS, "Content-Type": MIME[".js"] }); res.end(demoScript(account, product, inst)); return; }
      if (sub === "" || sub === "index.html") {
        const raw = await readFile(join(SERVER_APPS[product.app].def.publicDir, "index.html"), "utf8");
        // Root-absolute asset paths become relative to /demo-target/<product>/.
        const html = inject(raw.replace(/(href|src)="\/(?!\/)/g, '$1="'));
        res.writeHead(200, { ...BASE_HEADERS, "Content-Type": MIME[".html"],
          "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
        res.end(html);
        return;
      }
      // Product cookies are scoped to this product's path.
      const scoped = Object.create(res);
      scoped.setHeader = (k, v) => res.setHeader(k, String(k).toLowerCase() === "set-cookie" ? String(v).replace("Path=/;", `Path=${TARGET}/${product.id}/;`) : v);
      scoped.writeHead = (...a) => res.writeHead(...a);
      scoped.end = (...a) => res.end(...a);
      scoped.destroy = (...a) => res.destroy(...a);
      Object.defineProperty(scoped, "headersSent", { get: () => res.headersSent });
      Object.defineProperty(scoped, "writableEnded", { get: () => res.writableEnded });

      if (sub === "api/demo-sso" && req.method === "POST") return demoSso(req, scoped, account, product, inst);
      req.url = "/" + sub + url.search;
      return inst.app.handler(req, scoped);
    } catch (e) {
      log.error("[demo gateway]", e);
      if (!res.headersSent) sendJson(res, 500, { error: { message: "حدث خطأ غير متوقع" } }, BASE_HEADERS);
    }
  };

  /** Sign the demo customer into their isolated instance as one of the seeded roles. */
  async function demoSso(req, res, account, product, inst) {
    const origin = req.headers.origin;
    if (origin) { let h = ""; try { h = new URL(origin).host; } catch { /* invalid */ } if (h !== req.headers.host) return sendJson(res, 403, { error: { message: "مصدر الطلب غير مسموح" } }, BASE_HEADERS); }
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return sendJson(res, 415, { error: { message: "JSON مطلوب" } }, BASE_HEADERS);
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > 2048) return sendJson(res, 413, { error: { message: "طلب كبير" } }, BASE_HEADERS); chunks.push(c); }
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return sendJson(res, 400, { error: { message: "JSON غير صالح" } }, BASE_HEADERS); }
    const user = instances.userForRole(inst, String(body.role || ""));
    if (!user) return sendJson(res, 422, { error: { message: "دور غير متاح في هذا النظام" } }, BASE_HEADERS);
    const ctx = { req, res, ip: req.socket?.remoteAddress || "demo" };
    const csrf = await inst.app.auth.issueSession(ctx, user);
    getService().audit.log({ org_id: account.org_id, user_id: null, ip: ctx.ip }, "demo.product_opened", "demo_account", account.id, { product: product.id, role: user.role });
    sendJson(res, 200, { ok: true, csrf }, BASE_HEADERS);
  }
}
