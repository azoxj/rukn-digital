// Shared helpers for CLI scripts.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function args() {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    out[k] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return out;
}

export async function loadApp(name) {
  if (name === "callcenter") return (await import("../apps/callcenter/app.js")).callcenterApp;
  if (name === "graduation") return (await import("../apps/graduation/app.js")).graduationApp;
  if (name === "requests") return (await import("../apps/requests/app.js")).requestsApp;
  if (name === "democenter") return (await import("../apps/democenter/app.js")).makeDemoCenterApp({ holder: {}, instances: null });
  throw new Error(`Unknown app "${name}". Use --app callcenter|graduation|requests|democenter`);
}

export const dbFileFor = (name) => process.env.DB_FILE || join(ROOT, "data", `${name}.db`);
