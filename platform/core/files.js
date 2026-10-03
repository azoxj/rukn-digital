// Shared file uploads: extension allow-list + magic-byte check, storage under
// random keys outside the web root, and attachment-only downloads.
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { HttpError, notFound } from "./errors.js";

const ZIP = (b) => b[0] === 0x50 && b[1] === 0x4b;
export const FILE_TYPES = {
  pdf: { mime: "application/pdf", ok: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  png: { mime: "image/png", ok: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG" },
  jpg: { mime: "image/jpeg", ok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: "image/jpeg", ok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ok: ZIP },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ok: ZIP },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ok: ZIP },
  zip: { mime: "application/zip", ok: ZIP },
  txt: { mime: "text/plain", ok: (b) => !b.includes(0) },
  md: { mime: "text/markdown", ok: (b) => !b.includes(0) },
};
export const MAX_FILE = 15 * 1024 * 1024;

export function createFileStore(dataDir) {
  const root = () => {
    if (!dataDir) throw new HttpError(500, "مجلد الملفات غير مهيأ");
    return join(dataDir, "files");
  };
  return {
    /** Validate and store an upload. Returns metadata to insert in the DB. */
    save(orgId, rawName, buf) {
      const name = String(rawName || "").normalize("NFC").replace(/[\\/\u0000-\u001f<>:"|?*]+/g, "_").trim().slice(0, 150);
      const ext = (name.match(/\.([a-z0-9]{1,5})$/i) || [])[1]?.toLowerCase();
      if (!name || !ext || !FILE_TYPES[ext]) throw new HttpError(415, "نوع الملف غير مسموح. المسموح: PDF، Word، PowerPoint، Excel، ZIP، صور PNG/JPG، نص");
      if (!buf || !buf.length) throw new HttpError(422, "الملف فارغ");
      if (!FILE_TYPES[ext].ok(buf)) throw new HttpError(415, "محتوى الملف لا يطابق امتداده");
      const key = `${orgId}/${randomBytes(16).toString("hex")}`;
      mkdirSync(join(root(), String(orgId)), { recursive: true });
      writeFileSync(join(root(), key), buf, { flag: "wx" });
      return { name, mime: FILE_TYPES[ext].mime, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), key };
    },
    remove(key) { try { unlinkSync(join(root(), key)); } catch { /* already gone */ } },
    /** Stream a stored file as an attachment. */
    send(res, { storage_key, original_name, mime }) {
      const path = join(root(), storage_key);
      if (!existsSync(path)) throw notFound("محتوى الملف");
      const data = readFileSync(path);
      const ascii = original_name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": data.length,
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(original_name)}`,
        "Cache-Control": "private, no-store",
      });
      res.end(data);
    },
  };
}
