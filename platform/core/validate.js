// Tiny declarative validator. Every request body and query is parsed through
// a schema; unknown keys are dropped, and failures become a 422 with
// per-field Arabic messages.
import { HttpError } from "./errors.js";

const fail = (msg) => ({ error: msg });
const ok = (value) => ({ value });

const make = (check, opts = {}) => ({ check, optional: !!opts.optional, nullable: !!opts.nullable, def: opts.default });

export const v = {
  string: (o = {}) => make((x) => {
    if (typeof x !== "string") return fail("قيمة نصية مطلوبة");
    const s = o.trim === false ? x : x.trim();
    if (s.length < (o.min ?? 0)) return fail(o.min > 1 ? `الحد الأدنى ${o.min} أحرف` : "هذا الحقل مطلوب");
    if (s.length > (o.max ?? 500)) return fail(`الحد الأقصى ${o.max ?? 500} حرف`);
    if (o.pattern && !o.pattern.test(s)) return fail(o.message || "صيغة غير صحيحة");
    return ok(s);
  }, o),
  email: (o = {}) => make((x) => {
    if (typeof x !== "string") return fail("البريد الإلكتروني مطلوب");
    const s = x.trim().toLowerCase();
    if (s.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return fail("بريد إلكتروني غير صحيح");
    return ok(s);
  }, o),
  phone: (o = {}) => make((x) => {
    if (typeof x !== "string") return fail("رقم الجوال مطلوب");
    const s = x.replace(/[\s()-]/g, "");
    if (!/^\+?\d{7,15}$/.test(s)) return fail("رقم جوال غير صحيح");
    return ok(s);
  }, o),
  int: (o = {}) => make((x) => {
    const n = typeof x === "string" && x.trim() !== "" ? Number(x) : x;
    if (!Number.isInteger(n)) return fail("رقم صحيح مطلوب");
    if (o.min != null && n < o.min) return fail(`الحد الأدنى ${o.min}`);
    if (o.max != null && n > o.max) return fail(`الحد الأقصى ${o.max}`);
    return ok(n);
  }, o),
  bool: (o = {}) => make((x) => (typeof x === "boolean" ? ok(x) : x === "true" || x === "1" ? ok(true) : x === "false" || x === "0" ? ok(false) : fail("قيمة منطقية مطلوبة")), o),
  enum: (values, o = {}) => make((x) => (values.includes(x) ? ok(x) : fail("قيمة غير مسموحة")), o),
  date: (o = {}) => make((x) => {
    if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x) || Number.isNaN(Date.parse(x + "T00:00:00Z"))) return fail("تاريخ غير صحيح (YYYY-MM-DD)");
    return ok(x);
  }, o),
  datetime: (o = {}) => make((x) => {
    if (typeof x !== "string" || Number.isNaN(Date.parse(x))) return fail("تاريخ ووقت غير صحيح");
    return ok(new Date(x).toISOString());
  }, o),
  array: (item, o = {}) => make((x) => {
    if (!Array.isArray(x)) return fail("قائمة مطلوبة");
    if (x.length > (o.max ?? 50)) return fail(`الحد الأقصى ${o.max ?? 50} عنصر`);
    const out = [];
    for (const [i, el] of x.entries()) {
      const r = run(item, el);
      if (r.error) return fail(`العنصر ${i + 1}: ${typeof r.error === "string" ? r.error : "غير صالح"}`);
      out.push(r.value);
    }
    if (o.min && out.length < o.min) return fail(`أضف ${o.min} عنصرًا على الأقل`);
    return ok(out);
  }, o),
  object: (shape, o = {}) => make((x) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return fail("كائن مطلوب");
    const out = {};
    const errors = {};
    for (const [k, rule] of Object.entries(shape)) {
      const r = run(rule, x[k]);
      if (r.error) errors[k] = r.error;
      else if (r.value !== undefined) out[k] = r.value;
    }
    return Object.keys(errors).length ? { error: errors } : ok(out);
  }, o),
};

function run(rule, x) {
  if (x === undefined || x === "") {
    if (rule.def !== undefined) return ok(rule.def);
    if (rule.optional) return ok(x === "" && rule.nullable ? null : undefined);
    return fail("هذا الحقل مطلوب");
  }
  if (x === null) {
    if (rule.nullable) return ok(null);
    if (rule.optional) return ok(undefined);
    return fail("هذا الحقل مطلوب");
  }
  return rule.check(x);
}

/** Parse input with an object schema or throw 422. Partial = all optional (PATCH). */
export function parse(schema, input, { partial = false } = {}) {
  const rule = partial
    ? v.object(Object.fromEntries(Object.entries(schemaShape(schema)).map(([k, r]) => [k, { ...r, optional: true, def: undefined }])))
    : schema;
  const r = run(rule, input ?? {});
  if (r.error) throw new HttpError(422, "بيانات غير صالحة", typeof r.error === "object" ? r.error : { _: r.error });
  return r.value;
}

const SHAPES = new WeakMap();
/** Create an object schema whose shape can be reused for partial updates. */
export function schema(shape) {
  const s = v.object(shape);
  SHAPES.set(s, shape);
  return s;
}
function schemaShape(s) {
  const shape = SHAPES.get(s);
  if (!shape) throw new Error("partial parse needs a schema() created schema");
  return shape;
}
