// Product registry for AZENK Demo Center — the ONLY place product links live.
//
// kind "server"  → a real server app (platform/apps/<app>). Demo Center runs one
//                  isolated instance per demo account (own SQLite file, fake seed data).
// kind "browser" → a client-side app (static files in the site repo). Demo Center serves
//                  it only through its access gate; the app itself has no server or
//                  server-side authentication and keeps its sample data in the browser.
//
// URLs: default `${DEMO_TARGET_BASE}/<id>/` (DEMO_TARGET_BASE defaults to /demo-target).
// Override one product with DEMO_PRODUCT_URL_<ID> (id upper-cased, "-" → "_"), e.g.
//   DEMO_PRODUCT_URL_HR=https://hr.azenk.sa/
// or all at once with DEMO_PRODUCT_URLS='{"hr":"https://hr.azenk.sa/", ...}'.
// NOTE: a product moved to its own host must validate the Demo Center session itself
// (shared cookie domain + GET /api/demo/access/:product). See platform/README.md.

export const PRODUCTS = [
  { id: "hr", name: "AZENK HR", tagline: "إدارة الموارد البشرية", kind: "browser", dir: "easyhr", storagePrefixes: ["easyhr:"],
    tech: "يعمل في المتصفح ببيانات تجريبية؛ لا يملك خادمًا خاصًا بعد." },
  { id: "fleet", name: "FleetPro", tagline: "إدارة الأسطول", kind: "browser", dir: "fleetpro", storagePrefixes: ["fleetpro-"],
    tech: "يعمل في المتصفح ببيانات تجريبية تُولَّد عند الفتح." },
  { id: "clinic", name: "ClinicFlow", tagline: "إدارة العيادات", kind: "browser", dir: "clinicflow", storagePrefixes: ["clinicflow-"],
    tech: "يعمل في المتصفح ببيانات تجريبية تُولَّد عند الفتح." },
  { id: "call-center", name: "AZENK Call Center", tagline: "مركز الاتصال وخدمة العملاء", kind: "server", app: "callcenter",
    tech: "نظام بخادم وقاعدة بيانات؛ لكل تجربة نسخة معزولة." },
  { id: "graduation", name: "AZENK Graduation", tagline: "إدارة مشاريع التخرج", kind: "server", app: "graduation",
    tech: "نظام بخادم وقاعدة بيانات؛ لكل تجربة نسخة معزولة." },
  { id: "presentations", name: "AZENK Presentations", tagline: "إنشاء العروض وتصديرها PowerPoint", kind: "browser", dir: "presentations", storagePrefixes: ["azenk-pres:"],
    tech: "أداة تعمل في المتصفح؛ العروض تُحفظ على جهازك." },
  { id: "requests", name: "AZENK Requests", tagline: "الطلبات الداخلية والموافقات", kind: "server", app: "requests",
    tech: "نظام بخادم وقاعدة بيانات؛ لكل تجربة نسخة معزولة." },
];

export const PRODUCT_IDS = PRODUCTS.map((p) => p.id);
export const productById = (id) => PRODUCTS.find((p) => p.id === id) || null;

export function productUrl(id, env = process.env) {
  let map = {};
  try { map = env.DEMO_PRODUCT_URLS ? JSON.parse(env.DEMO_PRODUCT_URLS) : {}; } catch { map = {}; }
  const own = env[`DEMO_PRODUCT_URL_${id.toUpperCase().replace(/-/g, "_")}`];
  if (own) return own;
  if (map[id]) return map[id];
  const base = (env.DEMO_TARGET_BASE || "/demo-target").replace(/\/$/, "");
  return `${base}/${id}/`;
}

/** Public view of a product for the portal / request form. */
export const publicProduct = (p, env) => ({ id: p.id, name: p.name, tagline: p.tagline, kind: p.kind, tech: p.tech, url: productUrl(p.id, env) });
