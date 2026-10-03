/* =========================================================
   AZENK Presentations — data model
   Templates, slide layouts (shared geometry used by BOTH the
   on-screen renderer and the PPTX exporter), presentation
   types and browser storage.
   Geometry is in inches on a 13.333 × 7.5 (16:9) slide.
   ========================================================= */
(function () {
  "use strict";
  const P = (window.AZP = window.AZP || {});

  P.SLIDE_W = 13.333;
  P.SLIDE_H = 7.5;
  P.LIMITS = { title: 200, subtitle: 300, body: 2000, bullet: 300, bullets: 12, notes: 3000, slides: 80, deckTitle: 120 };

  /* ---------------- Templates (colour themes) ---------------- */
  P.TEMPLATES = [
    { id: "midnight", name: "Midnight Gold", bg: "0A1324", title: "F6F4EF", text: "E9E7E1", accent: "C9A45C", muted: "A3A8B5", panel: "13213D" },
    { id: "ivory", name: "Ivory", bg: "F6F4EF", title: "0A1324", text: "1F2937", accent: "9C7B3E", muted: "6B7280", panel: "E9E4D8" },
    { id: "ocean", name: "Ocean", bg: "0B2540", title: "FFFFFF", text: "DCE8F5", accent: "38BDF8", muted: "93A9C2", panel: "123559" },
    { id: "emerald", name: "Emerald", bg: "FFFFFF", title: "064E3B", text: "1F2937", accent: "10B981", muted: "6B7280", panel: "ECFDF5" },
    { id: "graphite", name: "Graphite", bg: "16181D", title: "FFFFFF", text: "E5E7EB", accent: "F97316", muted: "9CA3AF", panel: "23262D" },
  ];
  P.template = (id) => P.TEMPLATES.find((t) => t.id === id) || P.TEMPLATES[0];

  /* ---------------- Layouts ----------------
     Boxes are defined for a left-to-right deck; for RTL decks
     the x position is mirrored. size = font size in points. */
  P.LAYOUTS = {
    cover: {
      name: "غلاف",
      fields: ["title", "subtitle"],
      boxes: [
        { kind: "accent", x: 0.9, y: 2.15, w: 1.6, h: 0.09 },
        { kind: "title", x: 0.9, y: 2.45, w: 11.5, h: 1.6, size: 44, bold: true },
        { kind: "subtitle", x: 0.9, y: 4.15, w: 11.5, h: 1.0, size: 22, color: "muted" },
      ],
    },
    section: {
      name: "فاصل قسم",
      fields: ["title", "subtitle"],
      boxes: [
        { kind: "panel", x: 0, y: 0, w: 0.35, h: 7.5 },
        { kind: "title", x: 0.9, y: 2.9, w: 11.5, h: 1.4, size: 40, bold: true },
        { kind: "subtitle", x: 0.9, y: 4.3, w: 11.5, h: 0.9, size: 20, color: "muted" },
      ],
    },
    bullets: {
      name: "عنوان ونقاط",
      fields: ["title", "bullets"],
      boxes: [
        { kind: "accent", x: 0.8, y: 0.45, w: 1.1, h: 0.07 },
        { kind: "title", x: 0.8, y: 0.6, w: 11.7, h: 1.0, size: 32, bold: true },
        { kind: "bullets", x: 0.8, y: 1.8, w: 11.7, h: 5.0, size: 22 },
      ],
    },
    text: {
      name: "عنوان ونص",
      fields: ["title", "body"],
      boxes: [
        { kind: "accent", x: 0.8, y: 0.45, w: 1.1, h: 0.07 },
        { kind: "title", x: 0.8, y: 0.6, w: 11.7, h: 1.0, size: 32, bold: true },
        { kind: "body", x: 0.8, y: 1.8, w: 11.7, h: 5.0, size: 20 },
      ],
    },
    twocol: {
      name: "نقاط وصورة",
      fields: ["title", "bullets", "image"],
      boxes: [
        { kind: "accent", x: 0.8, y: 0.45, w: 1.1, h: 0.07 },
        { kind: "title", x: 0.8, y: 0.6, w: 11.7, h: 1.0, size: 30, bold: true },
        { kind: "bullets", x: 0.8, y: 1.8, w: 6.3, h: 5.0, size: 20 },
        { kind: "image", x: 7.5, y: 1.8, w: 5.0, h: 5.0 },
      ],
    },
    image: {
      name: "صورة كبيرة",
      fields: ["title", "image", "caption"],
      boxes: [
        { kind: "title", x: 0.8, y: 0.4, w: 11.7, h: 0.9, size: 28, bold: true },
        { kind: "image", x: 0.8, y: 1.45, w: 11.7, h: 5.05 },
        { kind: "caption", x: 0.8, y: 6.6, w: 11.7, h: 0.55, size: 15, color: "muted" },
      ],
    },
    closing: {
      name: "خاتمة",
      fields: ["title", "subtitle"],
      boxes: [
        { kind: "title", x: 0.9, y: 2.7, w: 11.5, h: 1.5, size: 44, bold: true, align: "center" },
        { kind: "accent", x: 5.87, y: 4.3, w: 1.6, h: 0.09 },
        { kind: "subtitle", x: 0.9, y: 4.6, w: 11.5, h: 1.0, size: 22, color: "muted", align: "center" },
      ],
    },
  };
  P.LAYOUT_ORDER = ["cover", "section", "bullets", "text", "twocol", "image", "closing"];

  /* ---------------- Presentation types (starting outlines) ---------------- */
  const S = (layout, title, extra) => Object.assign({ layout, title }, extra || {});
  P.TYPES = {
    blank: { name: "عرض فارغ", outline: () => [S("cover", "", { subtitle: "" })] },
    company: {
      name: "تعريف شركة",
      outline: (t) => [
        S("cover", t, { subtitle: "ملف تعريفي" }),
        S("text", "من نحن", { body: "نبذة مختصرة عن الشركة ورسالتها." }),
        S("bullets", "خدماتنا", { bullets: ["الخدمة الأولى", "الخدمة الثانية", "الخدمة الثالثة"] }),
        S("bullets", "لماذا نحن؟", { bullets: ["ميزة واضحة", "ميزة ثانية", "ميزة ثالثة"] }),
        S("closing", "شكرًا لكم", { subtitle: "للتواصل: ..." }),
      ],
    },
    project: {
      name: "عرض مشروع",
      outline: (t) => [
        S("cover", t, { subtitle: "عرض المشروع" }),
        S("text", "المشكلة", { body: "ما المشكلة التي يعالجها المشروع؟" }),
        S("bullets", "الحل", { bullets: ["فكرة الحل", "كيف يعمل", "القيمة المضافة"] }),
        S("bullets", "الخطة الزمنية", { bullets: ["المرحلة الأولى", "المرحلة الثانية", "الإطلاق"] }),
        S("closing", "شكرًا لكم", { subtitle: "" }),
      ],
    },
    graduation: {
      name: "مشروع تخرج",
      outline: (t) => [
        S("cover", t, { subtitle: "مشروع تخرج — اسم الطالب / الفريق" }),
        S("text", "المقدمة", { body: "تعريف بالمشروع وخلفيته." }),
        S("text", "المشكلة", { body: "وصف المشكلة وأهميتها." }),
        S("bullets", "الأهداف", { bullets: ["الهدف الأول", "الهدف الثاني", "الهدف الثالث"] }),
        S("bullets", "المنهجية", { bullets: ["جمع المتطلبات", "التحليل والتصميم", "التطوير والاختبار"] }),
        S("twocol", "تصميم النظام", { bullets: ["المكونات الرئيسية", "قاعدة البيانات", "الواجهات"] }),
        S("bullets", "النتائج", { bullets: ["نتيجة أولى", "نتيجة ثانية"] }),
        S("text", "الخاتمة والتوصيات", { body: "ملخص ما تم إنجازه والتوصيات المستقبلية." }),
        S("closing", "شكرًا لحسن استماعكم", { subtitle: "الأسئلة والنقاش" }),
      ],
    },
    sales: {
      name: "عرض مبيعات",
      outline: (t) => [
        S("cover", t, { subtitle: "عرض مقدَّم إلى ..." }),
        S("text", "التحدي", { body: "التحدي الذي يواجهه العميل." }),
        S("bullets", "ما نقدمه", { bullets: ["العنصر الأول", "العنصر الثاني", "العنصر الثالث"] }),
        S("bullets", "الخطوات التالية", { bullets: ["اجتماع تفصيلي", "عرض سعر", "بدء التنفيذ"] }),
        S("closing", "شكرًا لكم", { subtitle: "" }),
      ],
    },
  };

  /* ---------------- Helpers ---------------- */
  P.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  P.now = () => new Date().toISOString();
  P.isArabic = (s) => /[؀-ۿ]/.test(s || "");

  P.newSlide = (layout, data) => {
    const d = data || {};
    return {
      id: P.uid(),
      layout: P.LAYOUTS[layout] ? layout : "bullets",
      title: d.title || "",
      subtitle: d.subtitle || "",
      body: d.body || "",
      bullets: Array.isArray(d.bullets) ? d.bullets.slice(0, P.LIMITS.bullets) : [],
      caption: d.caption || "",
      image: d.image || null, // { src: dataURL, w, h }
      notes: d.notes || "",
    };
  };

  P.newDeck = ({ title, type, template, dir }) => {
    const t = P.TYPES[type] ? type : "blank";
    const slides = P.TYPES[t].outline(title).map((s) => P.newSlide(s.layout, s));
    return { id: P.uid(), title, type: t, template: P.template(template).id, dir: dir === "ltr" ? "ltr" : "rtl", showNumbers: true, slides, createdAt: P.now(), updatedAt: P.now() };
  };

  P.duplicateSlide = (s) => Object.assign(JSON.parse(JSON.stringify(s)), { id: P.uid() });

  /* Validate an object loaded from JSON (import / storage) and
     return a clean deck, or throw an Error with an Arabic message. */
  P.sanitizeDeck = (raw) => {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.slides)) throw new Error("الملف لا يحتوي على عرض صالح.");
    const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
    const title = str(raw.title, P.LIMITS.deckTitle).trim() || "عرض بدون عنوان";
    const slides = raw.slides.slice(0, P.LIMITS.slides).map((s) => {
      const img = s && s.image && typeof s.image.src === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(s.image.src)
        ? { src: s.image.src, w: +s.image.w || 1600, h: +s.image.h || 900 } : null;
      return P.newSlide(s && P.LAYOUTS[s.layout] ? s.layout : "bullets", {
        title: str(s && s.title, P.LIMITS.title), subtitle: str(s && s.subtitle, P.LIMITS.subtitle), body: str(s && s.body, P.LIMITS.body),
        caption: str(s && s.caption, P.LIMITS.subtitle), notes: str(s && s.notes, P.LIMITS.notes),
        bullets: Array.isArray(s && s.bullets) ? s.bullets.map((b) => str(b, P.LIMITS.bullet)).filter(Boolean) : [], image: img,
      });
    });
    if (!slides.length) throw new Error("العرض لا يحتوي على شرائح.");
    return { id: P.uid(), title, type: P.TYPES[raw.type] ? raw.type : "blank", template: P.template(raw.template).id, dir: raw.dir === "ltr" ? "ltr" : "rtl", showNumbers: raw.showNumbers !== false, slides, createdAt: P.now(), updatedAt: P.now() };
  };

  /* ---------------- Storage (this browser only) ---------------- */
  const KEY = "azenk-pres:v1";
  P.store = {
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || "null");
        return raw && Array.isArray(raw.decks) ? raw.decks : [];
      } catch (e) { return []; }
    },
    /* Returns true, or throws an Error with a readable message. */
    save(decks) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: 1, decks }));
        return true;
      } catch (e) {
        const quota = e && (e.name === "QuotaExceededError" || e.code === 22);
        throw new Error(quota ? "مساحة التخزين في المتصفح ممتلئة. احذف صورًا أو عروضًا قديمة، أو احفظ نسخة JSON." : "تعذّر الحفظ في المتصفح.");
      }
    },
  };
})();
