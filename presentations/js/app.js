/* =========================================================
   AZENK Presentations — application (library, editor,
   slideshow, import/export). Data stays in this browser.
   ========================================================= */
(function () {
  "use strict";
  const P = window.AZP;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = P.esc;
  const app = $("#app");

  let decks = P.store.load();
  let current = null; // deck being edited
  let sel = 0; // selected slide index
  let saveTimer = null;

  /* ---------------- Feedback ---------------- */
  let toastTimer = null;
  const toast = (msg, kind) => {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (kind ? " toast--" + kind : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3800);
  };

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; }
  };

  /* ---------------- Modal ---------------- */
  const modal = ({ title, body, submit, cancel = "إلغاء", danger, onSubmit, wide }) => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="modal__box${wide ? " modal__box--wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <form class="modal__form" novalidate>
        <h2 id="mdl-t">${esc(title)}</h2>
        <div class="modal__body">${body || ""}</div>
        <p class="form-err" role="alert" hidden></p>
        <div class="modal__actions">
          <button type="submit" class="btn ${danger ? "btn--danger" : "btn--gold"}">${esc(submit)}</button>
          <button type="button" class="btn btn--ghost" data-close>${esc(cancel)}</button>
        </div>
      </form></div>`;
    const prev = document.activeElement;
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
    const form = $("form", wrap);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = $(".form-err", wrap);
      try {
        const r = onSubmit ? onSubmit(form) : true;
        if (r === false) return;
        close();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
    document.body.appendChild(wrap);
    const first = $("input, select, textarea, button", form);
    if (first) first.focus();
    return wrap;
  };

  /* ---------------- Persistence ---------------- */
  const status = (txt, kind) => { const el = $("#save-state"); if (el) { el.textContent = txt; el.dataset.kind = kind || ""; } };
  const persist = () => {
    try { P.store.save(decks); status("تم الحفظ في المتصفح", "ok"); return true; }
    catch (e) { status("لم يتم الحفظ", "err"); toast(e.message, "err"); return false; }
  };
  const touch = () => {
    if (current) current.updatedAt = P.now();
    status("جارٍ الحفظ…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 350);
  };
  const flush = () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; persist(); } };
  window.addEventListener("beforeunload", flush);

  /* ---------------- Router ---------------- */
  const route = () => {
    flush();
    const m = location.hash.match(/^#\/d\/([\w-]+)$/);
    if (m) {
      const d = decks.find((x) => x.id === m[1]);
      if (!d) { toast("العرض غير موجود في هذا المتصفح.", "err"); location.hash = "#/"; return; }
      if (current !== d) { current = d; sel = 0; }
      renderEditor();
    } else {
      current = null;
      renderLibrary();
    }
  };
  window.addEventListener("hashchange", route);

  /* =========================================================
     Library
     ========================================================= */
  const thumb = (deck, slide, i) => `<div class="thumb">${P.renderSlide(deck, slide, i)}</div>`;

  const renderLibrary = () => {
    document.title = "AZENK Presentations | إنشاء عروض PowerPoint وتصديرها";
    const sorted = decks.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    app.innerHTML = `
      <section class="lib">
        <div class="lib__head">
          <div>
            <h1>عروضك التقديمية</h1>
            <p class="muted">أنشئ عرضًا من قالب، حرّر الشرائح، ثم صدّره كملف PowerPoint ‎(.pptx). تُحفظ العروض في هذا المتصفح فقط — صدّر نسخة JSON للاحتفاظ بها أو نقلها.</p>
          </div>
          <div class="lib__actions">
            <button class="btn btn--gold" data-act="new">+ عرض جديد</button>
            <label class="btn btn--ghost">استيراد JSON<input type="file" accept="application/json,.json" data-act="import" hidden></label>
          </div>
        </div>
        ${sorted.length ? `<ul class="decks">${sorted.map((d) => `
          <li class="deck" data-id="${d.id}">
            <a class="deck__open" href="#/d/${d.id}" aria-label="فتح ${esc(d.title)}">${d.slides[0] ? thumb(d, d.slides[0], 0) : ""}</a>
            <div class="deck__meta">
              <h2><a href="#/d/${d.id}">${esc(d.title)}</a></h2>
              <p class="muted">${esc((P.TYPES[d.type] || P.TYPES.blank).name)} · ${d.slides.length} شريحة · ${esc(fmtDate(d.updatedAt))}</p>
              <div class="deck__acts">
                <a class="btn btn--sm btn--ghost" href="#/d/${d.id}">فتح</a>
                <button class="btn btn--sm btn--ghost" data-act="dup">تكرار</button>
                <button class="btn btn--sm btn--ghost btn--warn" data-act="del">حذف</button>
              </div>
            </div>
          </li>`).join("")}</ul>`
        : `<div class="empty"><h2>لا توجد عروض بعد</h2><p class="muted">ابدأ بعرض جديد واختر نوعه وقالبه، وستحصل على شرائح أولية جاهزة للتعديل.</p><button class="btn btn--gold" data-act="new">+ إنشاء أول عرض</button></div>`}
      </section>`;
  };

  const newDeckDialog = () => {
    modal({
      title: "عرض جديد",
      submit: "إنشاء العرض",
      wide: true,
      body: `
        <label class="fld"><span>عنوان العرض <em>*</em></span><input name="title" maxlength="${P.LIMITS.deckTitle}" required placeholder="مثال: نظام إدارة المكتبة"></label>
        <div class="grid2">
          <label class="fld"><span>نوع العرض</span><select name="type">${Object.entries(P.TYPES).map(([k, v]) => `<option value="${k}"${k === "project" ? " selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label>
          <label class="fld"><span>اتجاه المحتوى</span><select name="dir"><option value="rtl">عربي (من اليمين)</option><option value="ltr">English (left to right)</option></select></label>
        </div>
        <fieldset class="fld"><legend>القالب</legend><div class="tpls">${P.TEMPLATES.map((t, i) => `
          <label class="tpl"><input type="radio" name="template" value="${t.id}"${i === 0 ? " checked" : ""}>
            <span class="tpl__sw" style="background:#${t.bg}"><i style="background:#${t.accent}"></i><b style="color:#${t.title}">Aa</b></span>
            <span class="tpl__n">${esc(t.name)}</span></label>`).join("")}</div></fieldset>`,
      onSubmit: (f) => {
        const title = f.title.value.trim();
        if (!title) { f.title.focus(); throw new Error("اكتب عنوان العرض."); }
        const deck = P.newDeck({ title, type: f.type.value, template: f.template.value, dir: f.dir.value });
        decks.push(deck);
        if (!persist()) { decks.pop(); return false; }
        location.hash = `#/d/${deck.id}`;
      },
    });
  };

  const importJSON = (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast("حجم الملف كبير جدًا (الحد 25MB).", "err"); return; }
    const r = new FileReader();
    r.onload = () => {
      try {
        const deck = P.sanitizeDeck(JSON.parse(r.result));
        decks.push(deck);
        if (!persist()) { decks.pop(); return; }
        toast(`تم استيراد «${deck.title}»`);
        location.hash = `#/d/${deck.id}`;
      } catch (e) { toast(e instanceof SyntaxError ? "الملف ليس JSON صالحًا." : e.message, "err"); }
    };
    r.onerror = () => toast("تعذّرت قراءة الملف.", "err");
    r.readAsText(file);
  };

  const downloadJSON = (deck) => {
    const blob = new Blob([JSON.stringify(Object.assign({ app: "azenk-presentations", v: 1 }, deck), null, 1)], { type: "application/json" });
    P.download(blob, P.fileName(deck.title).replace(/\.pptx$/, ".json"));
  };

  /* =========================================================
     Editor
     ========================================================= */
  const slide = () => current.slides[sel];

  const renderEditor = () => {
    const d = current;
    if (sel >= d.slides.length) sel = d.slides.length - 1;
    if (sel < 0) sel = 0;
    document.title = `${d.title} | AZENK Presentations`;
    app.innerHTML = `
      <section class="ed">
        <div class="ed__bar">
          <a class="btn btn--ghost btn--sm" href="#/">→ كل العروض</a>
          <label class="ed__title"><span class="sr">عنوان العرض</span><input id="deck-title" value="${esc(d.title)}" maxlength="${P.LIMITS.deckTitle}" aria-label="عنوان العرض"></label>
          <span id="save-state" class="save-state" aria-live="polite">محفوظ</span>
          <div class="ed__tools">
            <label class="mini"><span>القالب</span><select id="deck-tpl">${P.TEMPLATES.map((t) => `<option value="${t.id}"${t.id === d.template ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
            <label class="mini"><span>الاتجاه</span><select id="deck-dir"><option value="rtl"${d.dir === "rtl" ? " selected" : ""}>RTL</option><option value="ltr"${d.dir === "ltr" ? " selected" : ""}>LTR</option></select></label>
            <label class="chk"><input type="checkbox" id="deck-num"${d.showNumbers ? " checked" : ""}> ترقيم</label>
            <button class="btn btn--ghost btn--sm" data-act="play">▶ عرض</button>
            <button class="btn btn--ghost btn--sm" data-act="json">حفظ JSON</button>
            <button class="btn btn--gold btn--sm" data-act="export">تصدير PPTX</button>
          </div>
        </div>
        <div class="ed__body">
          <aside class="rail" aria-label="الشرائح">
            <ol class="rail__list" id="rail">${d.slides.map((s, i) => railItem(s, i)).join("")}</ol>
            <div class="rail__add">
              <label class="sr" for="add-layout">تخطيط الشريحة الجديدة</label>
              <select id="add-layout">${P.LAYOUT_ORDER.map((k) => `<option value="${k}"${k === "bullets" ? " selected" : ""}>${esc(P.LAYOUTS[k].name)}</option>`).join("")}</select>
              <button class="btn btn--gold btn--sm" data-act="add">+ شريحة</button>
            </div>
          </aside>
          <div class="stage"><div class="stage__frame" id="stage">${P.renderSlide(d, slide(), sel, { editable: true })}</div>
            <p class="muted stage__hint">الشريحة ${sel + 1} من ${d.slides.length} · ${esc(P.LAYOUTS[slide().layout].name)}</p></div>
          <aside class="insp" id="insp" aria-label="تحرير الشريحة">${inspector()}</aside>
        </div>
      </section>`;
  };

  const railItem = (s, i) => `
    <li class="rail__item${i === sel ? " is-sel" : ""}" draggable="true" data-i="${i}">
      <button class="rail__btn" data-act="select" data-i="${i}" aria-label="الشريحة ${i + 1}: ${esc(s.title || P.LAYOUTS[s.layout].name)}"${i === sel ? ' aria-current="true"' : ""}>
        <span class="rail__n">${i + 1}</span>${thumb(current, s, i)}
      </button>
    </li>`;

  const inspector = () => {
    const s = slide();
    const L = P.LAYOUTS[s.layout];
    const has = (f) => L.fields.includes(f);
    const n = current.slides.length;
    return `
      <div class="insp__acts" role="group" aria-label="إجراءات الشريحة">
        <button class="btn btn--sm btn--ghost" data-act="up"${sel === 0 ? " disabled" : ""} aria-label="تحريك للأعلى">↑</button>
        <button class="btn btn--sm btn--ghost" data-act="down"${sel === n - 1 ? " disabled" : ""} aria-label="تحريك للأسفل">↓</button>
        <button class="btn btn--sm btn--ghost" data-act="dupslide">تكرار</button>
        <button class="btn btn--sm btn--ghost btn--warn" data-act="delslide"${n === 1 ? " disabled" : ""}>حذف</button>
      </div>
      <label class="fld"><span>التخطيط</span><select data-f="layout">${P.LAYOUT_ORDER.map((k) => `<option value="${k}"${k === s.layout ? " selected" : ""}>${esc(P.LAYOUTS[k].name)}</option>`).join("")}</select></label>
      ${has("title") ? `<label class="fld"><span>العنوان</span><input data-f="title" value="${esc(s.title)}" maxlength="${P.LIMITS.title}"></label>` : ""}
      ${has("subtitle") ? `<label class="fld"><span>العنوان الفرعي</span><input data-f="subtitle" value="${esc(s.subtitle)}" maxlength="${P.LIMITS.subtitle}"></label>` : ""}
      ${has("body") ? `<label class="fld"><span>النص</span><textarea data-f="body" rows="6" maxlength="${P.LIMITS.body}">${esc(s.body)}</textarea></label>` : ""}
      ${has("bullets") ? `<label class="fld"><span>النقاط <small class="muted">(نقطة في كل سطر، حتى ${P.LIMITS.bullets})</small></span><textarea data-f="bullets" rows="6">${esc(s.bullets.join("\n"))}</textarea></label>` : ""}
      ${has("image") ? `<div class="fld"><span>الصورة</span>
        <div class="imgfld">${s.image ? `<img src="${s.image.src}" alt="معاينة الصورة">` : '<p class="muted">لا توجد صورة.</p>'}
          <label class="btn btn--sm btn--ghost">${s.image ? "تغيير الصورة" : "رفع صورة"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-act="img" hidden></label>
          ${s.image ? '<button class="btn btn--sm btn--ghost btn--warn" data-act="noimg">إزالة</button>' : ""}</div>
        <small class="muted">PNG / JPG / WEBP / GIF حتى 8MB — تُصغَّر تلقائيًا لحفظها في المتصفح.</small></div>` : ""}
      ${has("caption") ? `<label class="fld"><span>وصف الصورة</span><input data-f="caption" value="${esc(s.caption)}" maxlength="${P.LIMITS.subtitle}"></label>` : ""}
      <label class="fld"><span>ملاحظات المتحدث <small class="muted">(تُصدَّر مع الملف)</small></span><textarea data-f="notes" rows="3" maxlength="${P.LIMITS.notes}">${esc(s.notes)}</textarea></label>`;
  };

  /* Refresh stage + the selected thumbnail without rebuilding inputs (keeps focus). */
  const refreshPreview = () => {
    $("#stage").innerHTML = P.renderSlide(current, slide(), sel, { editable: true });
    const li = $(`#rail .rail__item[data-i="${sel}"] .thumb`);
    if (li) li.innerHTML = P.renderSlide(current, slide(), sel);
  };
  const refreshAllThumbs = () => { $("#rail").innerHTML = current.slides.map((s, i) => railItem(s, i)).join(""); };

  const select = (i) => { sel = Math.max(0, Math.min(current.slides.length - 1, i)); renderEditor(); const b = $(`#rail [data-i="${sel}"] .rail__btn`) || $(`#rail .rail__btn[data-i="${sel}"]`); if (b) b.focus(); };

  const move = (from, to) => {
    const arr = current.slides;
    if (to < 0 || to >= arr.length || from === to) return;
    const [s] = arr.splice(from, 1);
    arr.splice(to, 0, s);
    sel = to;
    touch();
    renderEditor();
  };

  /* ---------------- Images ---------------- */
  const readImage = (file) => new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error("نوع الملف غير مدعوم. استخدم PNG أو JPG أو WEBP أو GIF."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("حجم الصورة أكبر من 8MB."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      const png = file.type === "image/png" && file.size < 700 * 1024;
      if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ src: c.toDataURL(png ? "image/png" : "image/jpeg", 0.85), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّرت قراءة الصورة.")); };
    img.src = url;
  });

  /* ---------------- Slideshow ---------------- */
  const play = (start) => {
    let i = start || 0;
    const ov = document.createElement("div");
    ov.className = "show";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-label", "عرض الشرائح");
    ov.tabIndex = -1;
    const draw = () => {
      ov.innerHTML = `<div class="show__frame">${P.renderSlide(current, current.slides[i], i)}</div>
        <div class="show__ctl"><button class="btn btn--sm btn--ghost" data-s="prev" aria-label="السابقة"${i === 0 ? " disabled" : ""}>›</button>
        <span>${i + 1} / ${current.slides.length}</span>
        <button class="btn btn--sm btn--ghost" data-s="next" aria-label="التالية"${i === current.slides.length - 1 ? " disabled" : ""}>‹</button>
        <button class="btn btn--sm btn--ghost" data-s="close">إغلاق (Esc)</button></div>`;
    };
    const go = (d) => { const n = i + d; if (n >= 0 && n < current.slides.length) { i = n; draw(); } };
    const close = () => { document.removeEventListener("keydown", onKey); ov.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); sel = i; renderEditor(); };
    const back = current.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    const fwd = current.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === fwd || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === back || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") { i = 0; draw(); }
      else if (e.key === "End") { i = current.slides.length - 1; draw(); }
    };
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-s]");
      if (b) { const s = b.dataset.s; if (s === "close") close(); else go(s === "next" ? 1 : -1); return; }
      if (e.target.closest(".show__frame")) go(1);
    });
    document.addEventListener("keydown", onKey);
    draw();
    document.body.appendChild(ov);
    ov.focus();
    if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {});
  };

  /* ---------------- Events ---------------- */
  app.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    const card = b.closest(".deck");
    if (act === "new") return newDeckDialog();
    if (act === "dup" && card) {
      const src = decks.find((x) => x.id === card.dataset.id);
      const copy = Object.assign(JSON.parse(JSON.stringify(src)), { id: P.uid(), title: (src.title + " (نسخة)").slice(0, P.LIMITS.deckTitle), createdAt: P.now(), updatedAt: P.now() });
      copy.slides.forEach((s) => (s.id = P.uid()));
      decks.push(copy);
      if (persist()) { toast("تم تكرار العرض"); renderLibrary(); } else decks.pop();
      return;
    }
    if (act === "del" && card) {
      const d = decks.find((x) => x.id === card.dataset.id);
      return modal({
        title: "حذف العرض", submit: "حذف نهائي", danger: true,
        body: `<p>سيتم حذف «${esc(d.title)}» من هذا المتصفح نهائيًا. لا يمكن التراجع.</p>`,
        onSubmit: () => { decks = decks.filter((x) => x !== d); persist(); toast("تم حذف العرض"); renderLibrary(); },
      });
    }
    if (!current) return;
    if (act === "select") return select(+b.dataset.i);
    if (act === "add") {
      if (current.slides.length >= P.LIMITS.slides) return toast(`الحد الأقصى ${P.LIMITS.slides} شريحة.`, "err");
      const layout = $("#add-layout").value;
      current.slides.splice(sel + 1, 0, P.newSlide(layout, { title: "" }));
      sel += 1; touch(); renderEditor();
      const f = $('#insp [data-f="title"]'); if (f) f.focus();
      return;
    }
    if (act === "up") return move(sel, sel - 1);
    if (act === "down") return move(sel, sel + 1);
    if (act === "dupslide") {
      if (current.slides.length >= P.LIMITS.slides) return toast(`الحد الأقصى ${P.LIMITS.slides} شريحة.`, "err");
      current.slides.splice(sel + 1, 0, P.duplicateSlide(slide()));
      sel += 1; touch(); renderEditor(); toast("تم تكرار الشريحة"); return;
    }
    if (act === "delslide") {
      if (current.slides.length === 1) return;
      return modal({
        title: "حذف الشريحة", submit: "حذف", danger: true, body: `<p>حذف الشريحة ${sel + 1}؟</p>`,
        onSubmit: () => { current.slides.splice(sel, 1); sel = Math.min(sel, current.slides.length - 1); touch(); renderEditor(); toast("تم حذف الشريحة"); },
      });
    }
    if (act === "noimg") { slide().image = null; touch(); renderEditor(); return; }
    if (act === "play") return play(sel);
    if (act === "json") { flush(); downloadJSON(current); toast("تم تنزيل نسخة JSON"); return; }
    if (act === "export") {
      flush();
      b.disabled = true;
      const label = b.textContent;
      b.textContent = "جارٍ التصدير…";
      try { const name = await P.exportPptx(current); toast(`تم تصدير ${name}`); }
      catch (ex) { toast(ex.message || "تعذّر التصدير.", "err"); }
      finally { b.disabled = false; b.textContent = label; }
    }
  });

  app.addEventListener("input", (e) => {
    if (!current) return;
    const el = e.target;
    if (el.id === "deck-title") {
      const v = el.value.trim();
      if (!v) { status("العنوان مطلوب", "err"); return; }
      current.title = v.slice(0, P.LIMITS.deckTitle);
      document.title = `${current.title} | AZENK Presentations`;
      return touch();
    }
    const f = el.dataset.f;
    if (!f || f === "layout") return;
    if (f === "bullets") {
      const lines = el.value.split("\n");
      if (lines.length > P.LIMITS.bullets) toast(`الحد الأقصى ${P.LIMITS.bullets} نقطة في الشريحة.`, "err");
      slide().bullets = lines.slice(0, P.LIMITS.bullets).map((x) => x.slice(0, P.LIMITS.bullet));
    } else slide()[f] = el.value;
    touch();
    refreshPreview();
  });

  app.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset.act === "import") { importJSON(el.files[0]); el.value = ""; return; }
    if (!current) return;
    if (el.id === "deck-title" && !el.value.trim()) { el.value = current.title; status("محفوظ", "ok"); return; }
    if (el.id === "deck-tpl") { current.template = P.template(el.value).id; touch(); renderEditor(); return; }
    if (el.id === "deck-dir") { current.dir = el.value === "ltr" ? "ltr" : "rtl"; touch(); renderEditor(); return; }
    if (el.id === "deck-num") { current.showNumbers = el.checked; touch(); refreshAllThumbs(); refreshPreview(); return; }
    if (el.dataset.f === "layout") { slide().layout = el.value; touch(); renderEditor(); return; }
    if (el.dataset.act === "img" && el.files[0]) {
      try { slide().image = await readImage(el.files[0]); touch(); renderEditor(); toast("تمت إضافة الصورة"); }
      catch (ex) { toast(ex.message, "err"); }
    }
  });

  /* Drag & drop reordering in the slide rail */
  let dragFrom = null;
  app.addEventListener("dragstart", (e) => {
    const li = e.target.closest && e.target.closest(".rail__item");
    if (!li) return;
    dragFrom = +li.dataset.i;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(dragFrom)); } catch (x) { /* ignore */ }
  });
  app.addEventListener("dragover", (e) => { if (dragFrom != null && e.target.closest(".rail__item")) e.preventDefault(); });
  app.addEventListener("drop", (e) => {
    const li = e.target.closest(".rail__item");
    if (dragFrom == null || !li) return;
    e.preventDefault();
    const to = +li.dataset.i;
    const from = dragFrom;
    dragFrom = null;
    move(from, to);
  });
  app.addEventListener("dragend", () => (dragFrom = null));

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && current) { e.preventDefault(); clearTimeout(saveTimer); saveTimer = null; if (persist()) toast("تم الحفظ"); }
  });

  route();
})();
