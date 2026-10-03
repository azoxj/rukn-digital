// node:crypto subset used by the platform core, on Web Crypto + @noble/hashes.
import { Buffer } from "buffer";
import { scryptAsync } from "@noble/hashes/scrypt";
import { sha256 } from "@noble/hashes/sha256";

export function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Buffer.from(b);
}
export function scrypt(password, salt, keylen, opts, cb) {
  scryptAsync(new TextEncoder().encode(password), new Uint8Array(salt), { N: opts.N, r: opts.r, p: opts.p, dkLen: keylen })
    .then((k) => cb(null, Buffer.from(k)), (e) => cb(e));
}
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) throw new RangeError("Input buffers must have the same byte length");
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
export function createHash(alg) {
  if (alg !== "sha256") throw new Error("Only sha256 is available in the demo");
  const parts = [];
  const h = {
    update(x) { parts.push(typeof x === "string" ? new TextEncoder().encode(x) : new Uint8Array(x)); return h; },
    digest(enc) {
      const len = parts.reduce((s, p) => s + p.length, 0), all = new Uint8Array(len);
      let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      const out = Buffer.from(sha256(all));
      return enc ? out.toString(enc) : out;
    },
  };
  return h;
}
export default { randomBytes, scrypt, timingSafeEqual, createHash };
