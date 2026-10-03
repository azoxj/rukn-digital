// Start the callcenter server:  npm run callcenter   (see platform/README.md)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../core/app.js";
import { callcenterApp } from "./app.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
startServer(callcenterApp, {
  port: Number(process.env.PORT || 4100),
  host: process.env.HOST || "127.0.0.1",
  dbFile: process.env.DB_FILE || join(ROOT, "data", "callcenter.db"),
  dataDir: process.env.DATA_DIR || join(ROOT, "data", "callcenter-files"),
});
