// Minimal POSIX path helpers.
export const sep = "/";
export function normalize(p) {
  const abs = p.startsWith("/"), out = [];
  for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
  return (abs ? "/" : "") + out.join("/");
}
export const join = (...a) => normalize(a.filter(Boolean).join("/"));
export const resolve = (...a) => { let p = ""; for (const x of a) p = x.startsWith("/") ? x : p + "/" + x; return normalize(p.startsWith("/") ? p : "/" + p); };
export const dirname = (p) => { const n = normalize(p); const i = n.lastIndexOf("/"); return i <= 0 ? "/" : n.slice(0, i); };
export const extname = (p) => { const m = /\.[^./]*$/.exec(p); return m ? m[0] : ""; };
export default { sep, normalize, join, resolve, dirname, extname };
