// Password hashing (scrypt), tokens, and an in-memory rate limiter.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";

const KEYLEN = 64, R = 8, P = 1;
const LOG_N = Number(process.env.SCRYPT_LOG_N || 15);

function scrypt(password, salt, logN, r, p) {
  const N = 2 ** logN;
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => (err ? reject(err) : resolve(key))));
}

/** Format: scrypt$<logN>$<r>$<p>$<salt>$<hash> (parameters kept with each hash). */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, LOG_N, R, P);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const logN = Number(n);
  if (!Number.isInteger(logN) || logN < 10 || logN > 20) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), logN, Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A fixed dummy hash so unknown e-mails cost the same time as wrong passwords.
let dummy = null;
export async function burnPasswordTime(password) {
  if (!dummy) dummy = await hashPassword("dummy-password-for-timing");
  await verifyPassword(password, dummy);
}

/** Password policy: 10+ chars with letters and digits. Returns an error message or null. */
export function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 10) return "كلمة المرور يجب ألا تقل عن 10 أحرف";
  if (pw.length > 200) return "كلمة المرور طويلة جدًا";
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return "كلمة المرور يجب أن تحتوي على حروف وأرقام";
  return null;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Generate a readable random password that satisfies the policy. */
export function generatePassword() {
  const alpha = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const b = randomBytes(14);
  let s = "";
  for (let i = 0; i < 12; i++) s += alpha[b[i] % alpha.length];
  return s + digits[b[12] % digits.length] + digits[b[13] % digits.length];
}

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Fixed-window rate limiter (single instance). */
export class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
    const t = setInterval(() => this.sweep(), Math.min(windowMs, 60_000));
    t.unref();
  }
  /** Record a hit; returns ms until reset when over the limit, else 0. */
  hit(key, now = Date.now()) {
    const e = this.hits.get(key);
    if (!e || e.resetAt <= now) { this.hits.set(key, { count: 1, resetAt: now + this.windowMs }); return 0; }
    e.count += 1;
    return e.count > this.limit ? e.resetAt - now : 0;
  }
  blocked(key, now = Date.now()) {
    const e = this.hits.get(key);
    if (!e || e.resetAt <= now) return 0;
    return e.count >= this.limit ? e.resetAt - now : 0;
  }
  reset(key) { this.hits.delete(key); }
  clear() { this.hits.clear(); }
  sweep(now = Date.now()) { for (const [k, e] of this.hits) if (e.resetAt <= now) this.hits.delete(k); }
}
