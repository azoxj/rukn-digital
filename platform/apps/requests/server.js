// Start the requests server:  npm run requests   (see platform/README.md)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../core/app.js";
import { requestsApp } from "./app.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
startServer(requestsApp, {
  port: Number(process.env.PORT || 4300),
  host: process.env.HOST || "127.0.0.1",
  dbFile: process.env.DB_FILE || join(ROOT, "data", "requests.db"),
  dataDir: process.env.DATA_DIR || join(ROOT, "data", "requests-files"),
});
