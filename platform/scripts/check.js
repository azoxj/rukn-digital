// Syntax-check every JS file of the platform (no dependencies).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib.js";

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { if (f === "node_modules" || f === "data") continue; const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p); } };
walk(ROOT);
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { bad++; console.error(String(e.stderr)); } }
console.log(`${files.length - bad}/${files.length} files OK`);
process.exit(bad ? 1 : 0);
