// Browser demo runtime: runs the REAL server code (routes, validation, RBAC,
// audit…) inside the page on an in-memory SQLite (sql.js). The frontend's
// fetch("/api/...") calls are answered by the same request handler the Node
// server uses. Data lives only in this tab and is re-seeded on reload.
import initSqlJs from "sql.js";
import { Buffer } from "buffer";
import { createPlatformApp } from "../core/app.js";
import { hashPassword } from "../core/security.js";
import { tx } from "../core/db.js";

export const DEMO_PASSWORD = "Demo-azenk-2026";

export function startDemo(def, seedDemo, { wasmUrl = "sql-wasm.wasm" } = {}) {
  const realFetch = globalThis.fetch.bind(globalThis);
  const jar = new Map(); // cookie name → value (session cookie of this tab)

  const ready = (async () => {
    globalThis.__SQLJS = await initSqlJs({ locateFile: () => wasmUrl });
    const app = createPlatformApp(def, { dbFile: ":memory:", dataDir: "/demo-data", log: { error: (...a) => console.warn("[demo]", ...a) } });
    const hash = await hashPassword(DEMO_PASSWORD);
    const accounts = tx(app.db, () => seedDemo(app.db, hash));
    window.AZ_DEMO = { password: DEMO_PASSWORD, accounts: accounts.map(([role, email]) => ({ role, email })) };
    return app;
  })();
  window.AZ_DEMO_READY = ready;

  const toBytes = async (body) => {
    if (body == null) return new Uint8Array(0);
    if (typeof body === "string") return new TextEncoder().encode(body);
    if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    return new TextEncoder().encode(String(body));
  };

  async function handle(url, init) {
    const app = await ready;
    const method = (init.method || "GET").toUpperCase();
    const bytes = await toBytes(init.body);
    const headers = { host: "demo.local", "content-length": String(bytes.length) };
    for (const [k, v] of Object.entries(init.headers || {})) headers[k.toLowerCase()] = String(v);
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

    // Minimal IncomingMessage: the body is emitted once the reader subscribes.
    const listeners = {};
    const req = {
      method, url: url.pathname + url.search, headers, socket: { remoteAddress: "demo" },
      on(ev, cb) {
        listeners[ev] = cb;
        if (ev === "end") setTimeout(() => { if (bytes.length && listeners.data) listeners.data(Buffer.from(bytes)); listeners.end(); }, 0);
        return req;
      },
      resume() {}, destroy() {},
    };
    return new Promise((resolve) => {
      const out = { status: 200, headers: {} };
      const res = {
        headersSent: false, writableEnded: false,
        setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
        getHeader(k) { return out.headers[k.toLowerCase()]; },
        writeHead(status, h = {}) { out.status = status; for (const [k, v] of Object.entries(h)) out.headers[k.toLowerCase()] = v; res.headersSent = true; },
        end(data) {
          res.writableEnded = true;
          const sc = out.headers["set-cookie"];
          if (sc) {
            const [pair] = String(sc).split(";");
            const i = pair.indexOf("=");
            const name = pair.slice(0, i), value = pair.slice(i + 1);
            if (!value || /Max-Age=0/i.test(sc)) jar.delete(name); else jar.set(name, value);
            delete out.headers["set-cookie"];
          }
          const h = new Headers();
          for (const [k, v] of Object.entries(out.headers)) h.set(k, String(v));
          resolve(new Response(data == null ? null : data instanceof Uint8Array ? data : String(data), { status: out.status, headers: h }));
        },
        destroy() { resolve(new Response(null, { status: 500 })); },
      };
      app.handler(req, res);
    });
  }

  globalThis.fetch = (input, init = {}) => {
    const raw = typeof input === "string" ? input : input.url;
    const url = new URL(raw, location.href);
    if (url.origin === location.origin && /\/api\//.test(url.pathname) && raw.startsWith("/api/")) return handle(url, init);
    return realFetch(input, init);
  };
}
