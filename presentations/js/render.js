/* =========================================================
   AZENK Presentations — slide renderer (HTML)
   Uses the same geometry as the PPTX exporter so what you see
   on screen matches the exported file.
   ========================================================= */
(function () {
  "use strict";
  const P = window.AZP;
  const W = P.SLIDE_W, H = P.SLIDE_H;

  P.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Mirror a box horizontally for right-to-left decks. */
  P.place = (box, dir) => (dir === "rtl" ? Object.assign({}, box, { x: W - box.x - box.w }) : box);

  /* Fit an image inside a box keeping its aspect ratio (contain). */
  P.fitContain = (box, img) => {
    const r = (img && img.w && img.h) ? img.w / img.h : 16 / 9;
    let w = box.w, h = box.w / r;
    if (h > box.h) { h = box.h; w = box.h * r; }
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
  };

  const pct = (v, total) => ((v / total) * 100).toFixed(3) + "%";
  const posStyle = (b) => `left:${pct(b.x, W)};top:${pct(b.y, H)};width:${pct(b.w, W)};height:${pct(b.h, H)}`;
  // 1pt on a 13.333in-wide slide, expressed in container-query width units.
  const fs = (pt) => `font-size:${((pt / (W * 72)) * 100).toFixed(4)}cqw`;

  P.textOf = (slide, kind) => {
    if (kind === "title") return slide.title;
    if (kind === "subtitle") return slide.subtitle;
    if (kind === "body") return slide.body;
    if (kind === "caption") return slide.caption;
    return "";
  };

  P.placeholderText = { title: "انقر لإضافة عنوان", subtitle: "عنوان فرعي", body: "أضف النص هنا", caption: "وصف الصورة", bullets: "أضف النقاط" };

  /* Render one slide to an HTML string.
     opts.editable → show placeholders for empty fields. */
  P.renderSlide = (deck, slide, index, opts) => {
    const o = opts || {};
    const t = P.template(deck.template);
    const L = P.LAYOUTS[slide.layout] || P.LAYOUTS.bullets;
    const dir = deck.dir;
    const parts = L.boxes.map((raw) => {
      const b = P.place(raw, dir);
      const align = raw.align || (dir === "rtl" ? "right" : "left");
      if (raw.kind === "accent") return `<i class="s-deco" style="${posStyle(b)};background:#${t.accent}"></i>`;
      if (raw.kind === "panel") return `<i class="s-deco" style="${posStyle(b)};background:#${t.accent}"></i>`;
      if (raw.kind === "image") {
        if (slide.image && slide.image.src) {
          const f = P.fitContain(b, slide.image);
          return `<img class="s-img" alt="" src="${slide.image.src}" style="${posStyle(f)}">`;
        }
        return o.editable ? `<div class="s-imgph" style="${posStyle(b)};border-color:#${t.muted}55;color:#${t.muted}">لا توجد صورة — أضفها من لوحة التحرير</div>` : "";
      }
      const color = raw.color === "muted" ? t.muted : raw.kind === "title" ? t.title : t.text;
      const base = `${posStyle(b)};${fs(raw.size)};color:#${color};text-align:${align};font-weight:${raw.bold ? 700 : 400}`;
      if (raw.kind === "bullets") {
        const items = (slide.bullets || []).filter((x) => x.trim());
        if (!items.length) return o.editable ? `<div class="s-text s-ph" style="${base}">${P.placeholderText.bullets}</div>` : "";
        return `<ul class="s-list" dir="${dir}" style="${base};--dot:#${t.accent}">${items.map((x) => `<li dir="auto">${P.esc(x)}</li>`).join("")}</ul>`;
      }
      const txt = P.textOf(slide, raw.kind);
      if (!txt) return o.editable ? `<div class="s-text s-ph" style="${base}">${P.placeholderText[raw.kind] || ""}</div>` : "";
      return `<div class="s-text${raw.kind === "body" ? " s-body" : ""}" dir="auto" style="${base}">${P.esc(txt)}</div>`;
    });
    if (deck.showNumbers && index != null && slide.layout !== "cover") {
      const nb = P.place({ x: 12.0, y: 6.95, w: 1.0, h: 0.4 }, dir);
      parts.push(`<div class="s-text" style="${posStyle(nb)};${fs(11)};color:#${t.muted};text-align:center">${index + 1}</div>`);
    }
    return `<div class="slide" style="background:#${t.bg}" dir="${dir}">${parts.join("")}</div>`;
  };
})();
