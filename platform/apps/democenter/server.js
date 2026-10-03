// Start AZENK Demo Center:  npm run democenter   (see platform/README.md)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listen } from "../../core/http.js";
import { createDemoCenter } from "./center.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const center = createDemoCenter({
  dbFile: process.env.DB_FILE || join(ROOT, "data", "democenter.db"),
  dataDir: process.env.DATA_DIR || join(ROOT, "data", "democenter-files"),
});
const server = await listen(center.handler, Number(process.env.PORT || 4400), process.env.HOST || "127.0.0.1");
const a = server.address();
console.log(`AZENK Demo Center running on http://${a.address}:${a.port}`);
const stop = () => { server.close(); center.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
