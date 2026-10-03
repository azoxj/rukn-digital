// Start the graduation server:  npm run graduation   (see platform/README.md)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../core/app.js";
import { graduationApp } from "./app.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
startServer(graduationApp, {
  port: Number(process.env.PORT || 4200),
  host: process.env.HOST || "127.0.0.1",
  dbFile: process.env.DB_FILE || join(ROOT, "data", "graduation.db"),
  dataDir: process.env.DATA_DIR || join(ROOT, "data", "graduation-files"),
});
