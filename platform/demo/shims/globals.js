// Injected first into the demo bundle: Node globals the server code expects.
import { Buffer } from "buffer";
globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.process = globalThis.process || { env: {} };
// Demo only: low scrypt cost so in-browser sign-in stays fast. Real servers use the default (2^15).
globalThis.process.env.SCRYPT_LOG_N = "10";
globalThis.process.env.API_RATE_LIMIT = "100000";
// buffer@6 lacks "base64url" (used for session tokens): add it.
const toString = Buffer.prototype.toString;
Buffer.prototype.toString = function (enc, ...rest) {
  if (enc === "base64url") return toString.call(this, "base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return toString.call(this, enc, ...rest);
};
