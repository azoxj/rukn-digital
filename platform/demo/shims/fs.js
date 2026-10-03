// In-memory file system: migration files are baked in at build time, uploads live in memory.
import { Buffer } from "buffer";
import VFS from "../vfs.generated.js";
const files = new Map(Object.entries(VFS).map(([k, v]) => [k, Buffer.from(v, "utf8")]));
const norm = (p) => String(p).replace(/\/+/g, "/").replace(/\/$/, "");
const enoent = (p) => Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" });

export function readdirSync(dir) {
  const d = norm(dir) + "/";
  return [...new Set([...files.keys()].filter((k) => k.startsWith(d)).map((k) => k.slice(d.length).split("/")[0]))];
}
export function readFileSync(p, enc) {
  const b = files.get(norm(p));
  if (!b) throw enoent(p);
  return enc ? b.toString(enc) : b;
}
export function writeFileSync(p, data, opts) {
  const k = norm(p);
  if (opts && opts.flag === "wx" && files.has(k)) throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
  files.set(k, Buffer.from(data));
}
export function existsSync(p) { return files.has(norm(p)); }
export function unlinkSync(p) { if (!files.delete(norm(p))) throw enoent(p); }
export function mkdirSync() {}
export function statSync() { throw enoent("stat"); }
export default { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, statSync };
