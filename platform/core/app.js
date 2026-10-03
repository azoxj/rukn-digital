// Assemble a product server from an app definition:
//   { name, title, roles, permissions, manageRoles, tenants, migrationsDir, publicDir, routes(router, services) }
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, migrate } from "./db.js";
import { Router, createHandler, listen } from "./http.js";
import { createAuth } from "./auth.js";
import { createAudit, createNotifier } from "./services.js";
import { commonRoutes } from "./common-routes.js";

const CORE_PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "public");

export function createPlatformApp(def, { dbFile, dataDir, log = console } = {}) {
  const db = openDb(dbFile);
  migrate(db, def.name, def.migrationsDir);
  const audit = createAudit(db);
  const notify = createNotifier(db);
  const auth = createAuth({ db, app: def, audit });
  const router = new Router();

  router.get("/api/health", { auth: false }, () => ({ ok: true, app: def.name }));
  auth.routes(router);
  commonRoutes(router, { db, app: def, auth, audit });
  const services = { db, audit, notify, auth, can: auth.can, dataDir: dataDir || (dbFile === ":memory:" ? null : dirname(dbFile)) };
  def.routes(router, services);

  const handler = createHandler({
    router,
    auth,
    staticDirs: [["/core/", CORE_PUBLIC], ["/", def.publicDir]],
    trustProxy: process.env.TRUST_PROXY === "1",
    log,
  });
  const cleanup = setInterval(() => auth.cleanup(), 60 * 60 * 1000);
  cleanup.unref?.();
  return { db, handler, router, auth, audit, notify, services, close: () => { clearInterval(cleanup); db.close(); } };
}

export async function startServer(def, { port, host, dbFile, dataDir }) {
  const app = createPlatformApp(def, { dbFile, dataDir });
  const server = await listen(app.handler, port, host);
  const addr = server.address();
  console.log(`${def.title} running on http://${addr.address}:${addr.port}  (db: ${dbFile})`);
  const stop = () => { server.close(); app.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return { app, server };
}
