// Assemble AZENK Demo Center: core app (portal + admin APIs) + access gateway
// for /demo-target/* + isolated product instances + periodic expiry sweep.
import { join } from "node:path";
import { createPlatformApp } from "../../core/app.js";
import { systemClock } from "../../core/clock.js";
import { makeDemoCenterApp, SITE_ROOT } from "./app.js";
import { createGateway, TARGET } from "./gateway.js";
import { createInstances } from "./instances.js";

export function createDemoCenter({ dbFile, dataDir, clock = systemClock, env = process.env, log = console, siteRoot = SITE_ROOT, sweepMs = 60_000 } = {}) {
  const instances = createInstances({ dataRoot: dataDir, log });
  const holder = {};
  const def = makeDemoCenterApp({ holder, instances, env });
  const app = createPlatformApp(def, { dbFile, dataDir, clock, log });
  const gate = createGateway({ getService: () => holder.service, instances, siteRoot, centerUrl: env.DEMO_CENTER_PATH || "/", log });

  const handler = (req, res) => {
    const path = new URL(req.url, "http://local").pathname;
    if (path === TARGET || path.startsWith(`${TARGET}/`)) return gate(req, res);
    return app.handler(req, res);
  };

  // Expiry is enforced on every request; the sweep only tidies up (status + open instances).
  const sweep = () => { for (const id of holder.service.sweep()) instances.close(id); };
  const timer = sweepMs ? setInterval(sweep, sweepMs) : null;
  timer?.unref?.();

  return { app, handler, service: holder.service, limits: holder.limits, instances, sweep, def,
    close() { if (timer) clearInterval(timer); instances.closeAll(); app.close(); } };
}
