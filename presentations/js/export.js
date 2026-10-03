/* =========================================================
   AZENK Presentations — real PowerPoint (.pptx) export
   Uses PptxGenJS (MIT, vendored in ../vendor) which builds an
   Office Open XML file in the browser. The library is loaded
   only when the user exports.
   ========================================================= */
(function () {
  "use strict";
  const P = window.AZP;
  let loading = null;

  P.loadPptx = () => {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/pptxgen.bundle.js?v=20261003.3";
      s.onload = () => (window.PptxGenJS ? resolve(window.PptxGenJS) : reject(new Error("تعذّر تحميل مكتبة التصدير.")));
      s.onerror = () => { loading = null; reject(new Error("تعذّر تحميل مكتبة التصدير. تحقق من الاتصال ثم أعد المحاولة.")); };
      document.head.appendChild(s);
    });
    return loading;
  };

  P.fileName = (title) => (String(title || "presentation").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim().slice(0, 80) || "presentation") + ".pptx";

  /* Save a Blob as a file (the object URL is kept long enough for slow saves). */
  P.download = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };

  /* Build the PptxGenJS document (exposed for tests). */
  P.buildPptx = (PptxGenJS, deck) => {
    const t = P.template(deck.template);
    const rtl = deck.dir === "rtl";
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
    pptx.title = deck.title;
    pptx.author = "AZENK Presentations";
    pptx.company = "";
    if (rtl) pptx.rtlMode = true;

    deck.slides.forEach((slide, index) => {
      const s = pptx.addSlide();
      s.background = { color: t.bg };
      const L = P.LAYOUTS[slide.layout] || P.LAYOUTS.bullets;
      L.boxes.forEach((raw) => {
        const b = P.place(raw, deck.dir);
        const geo = { x: b.x, y: b.y, w: b.w, h: b.h };
        if (raw.kind === "accent" || raw.kind === "panel") {
          s.addShape(pptx.ShapeType.rect, Object.assign({}, geo, { fill: { color: t.accent }, line: { color: t.accent, width: 0 } }));
          return;
        }
        if (raw.kind === "image") {
          if (slide.image && slide.image.src) {
            const f = P.fitContain(b, slide.image);
            s.addImage({ data: slide.image.src, x: f.x, y: f.y, w: f.w, h: f.h });
          }
          return;
        }
        const align = raw.align || (rtl ? "right" : "left");
        const color = raw.color === "muted" ? t.muted : raw.kind === "title" ? t.title : t.text;
        const common = Object.assign({}, geo, {
          fontFace: "Arial", fontSize: raw.size, bold: !!raw.bold, color, align, valign: "top",
          margin: 0, lineSpacingMultiple: 1.2, fit: "shrink",
        });
        if (raw.kind === "bullets") {
          const items = (slide.bullets || []).filter((x) => x.trim());
          if (!items.length) return;
          s.addText(
            items.map((x) => ({ text: x, options: { bullet: { indent: 18 }, breakLine: true, rtlMode: P.isArabic(x), color } })),
            Object.assign(common, { paraSpaceAfter: 8, rtlMode: rtl })
          );
          return;
        }
        const txt = P.textOf(slide, raw.kind);
        if (!txt) return;
        s.addText(txt, Object.assign(common, { rtlMode: P.isArabic(txt) || rtl, lang: P.isArabic(txt) ? "ar-SA" : "en-US" }));
      });
      if (deck.showNumbers && slide.layout !== "cover") {
        const nb = P.place({ x: 12.0, y: 6.95, w: 1.0, h: 0.4 }, deck.dir);
        s.addText(String(index + 1), { x: nb.x, y: nb.y, w: nb.w, h: nb.h, fontFace: "Arial", fontSize: 11, color: t.muted, align: "center", margin: 0 });
      }
      if (slide.notes && slide.notes.trim()) s.addNotes(slide.notes);
    });
    return pptx;
  };

  /* Export the deck and trigger a real file download. */
  P.exportPptx = async (deck) => {
    if (!deck || !deck.slides.length) throw new Error("لا توجد شرائح للتصدير.");
    const PptxGenJS = await P.loadPptx();
    const pptx = P.buildPptx(PptxGenJS, deck);
    const name = P.fileName(deck.title);
    const blob = await pptx.write({ outputType: "blob" });
    P.download(blob, name);
    return name;
  };
})();
