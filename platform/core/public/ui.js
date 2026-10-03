/* =========================================================
   AZENK platform — shared frontend kit (no dependencies)
   API client (session cookie + CSRF), auth screens, app shell,
   router, forms, tables, modals, toasts and simple SVG charts.
   Content-Security-Policy friendly: no inline scripts/styles.
   ========================================================= */
(function () {
  "use strict";
  const AZ = (window.AZ = window.AZ || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  AZ.$ = $; AZ.$$ = $$;

  const esc = (AZ.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  /* ---------------- formatting ---------------- */
  const LOC = "ar-SA-u-nu-latn-ca-gregory";
  AZ.fmt = {
    date: (iso) => (iso ? new Date(iso).toLocaleDateString(LOC, { year: "numeric", month: "short", day: "numeric" }) : "—"),
    dateTime: (iso) => (iso ? new Date(iso).toLocaleString(LOC, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"),
    time: (iso) => (iso ? new Date(iso).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }) : "—"),
    duration: (sec) => { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); },
    num: (n) => Number(n || 0).toLocaleString("en-US"),
    rel: (iso) => {
      if (!iso) return "—";
      const d = (Date.parse(iso) - Date.now()) / 1000, a = Math.abs(d);
      const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
      if (a < 60) return rtf.format(Math.round(d), "second");
      if (a < 3600) return rtf.format(Math.round(d / 60), "minute");
      if (a < 86400) return rtf.format(Math.round(d / 3600), "hour");
      return rtf.format(Math.round(d / 86400), "day");
    },
  };
  /* <input type="datetime-local"> value <-> ISO */
  AZ.toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  AZ.fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
  AZ.today = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  AZ.addDays = (day, n) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

  /* ---------------- API ---------------- */
  AZ.state = { user: null, csrf: "", perms: new Set(), app: null };
  AZ.can = (p) => AZ.state.perms.has(p);

  class ApiError extends Error {
    constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || null; }
  }
  AZ.ApiError = ApiError;

  AZ.api = async (method, path, body, opts = {}) => {
    const headers = { Accept: "application/json" };
    if (method !== "GET" && AZ.state.csrf) headers["X-CSRF-Token"] = AZ.state.csrf;
    let payload;
    if (opts.raw) { payload = body; if (opts.type) headers["Content-Type"] = opts.type; }
    else if (body !== undefined && method !== "GET") { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, { method, headers, body: payload, credentials: "same-origin" }); }
    catch (e) { throw new ApiError(0, "تعذّر الاتصال بالخادم. تحقق من الاتصال وأن الخادم يعمل."); }
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : null;
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `خطأ ${res.status}`;
      if (res.status === 401 && !opts.noAuthRedirect) { AZ.state.user = null; AZ.renderLogin(); }
      throw new ApiError(res.status, msg, data && data.error && data.error.fields);
    }
    if (data && data.csrf) AZ.state.csrf = data.csrf;
    return data;
  };
  AZ.get = (p) => AZ.api("GET", p);
  AZ.post = (p, b) => AZ.api("POST", p, b ?? {});
  AZ.patch = (p, b) => AZ.api("PATCH", p, b ?? {});
  AZ.del = (p) => AZ.api("DELETE", p);
  AZ.qs = (o) => { const s = new URLSearchParams(); for (const [k, v] of Object.entries(o || {})) if (v !== "" && v != null) s.set(k, v); const q = s.toString(); return q ? "?" + q : ""; };

  /** Download a file from an authenticated GET endpoint. */
  AZ.download = async (path, fallbackName) => {
    const res = await fetch(path, { credentials: "same-origin" });
    if (!res.ok) { let m = "تعذّر التنزيل"; try { m = (await res.json()).error.message; } catch (e) { /* ignore */ } throw new ApiError(res.status, m); }
    const cd = res.headers.get("content-disposition") || "";
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : fallbackName;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  /* ---------------- feedback ---------------- */
  let toastTimer;
  AZ.toast = (msg, kind) => {
    let t = $("#az-toast");
    if (!t) { t = document.createElement("div"); t.id = "az-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = "toast is-on" + (kind ? " toast--" + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 4200);
  };
  AZ.fail = (e) => AZ.toast(e && e.message ? e.message : "حدث خطأ", "err");

  /* ---------------- forms ----------------
     field: { name, label, type, value, required, options:[[v,l]], placeholder, hint, rows, max, min, full } */
  AZ.field = (f) => {
    const id = "f-" + f.name + "-" + Math.random().toString(36).slice(2, 6);
    const req = f.required ? " required" : "";
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
    const val = f.value == null ? "" : f.value;
    let input;
    if (f.type === "select") input = `<select id="${id}" name="${f.name}"${req}>${(f.options || []).map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    else if (f.type === "textarea") input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${f.max ? ` maxlength="${f.max}"` : ""}${req}${ph}>${esc(val)}</textarea>`;
    else if (f.type === "checkbox") return `<label class="chk"><input type="checkbox" name="${f.name}"${val ? " checked" : ""}> ${esc(f.label)}</label>`;
    else input = `<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(val)}"${f.max ? ` maxlength="${f.max}"` : ""}${f.min != null ? ` min="${f.min}"` : ""}${f.step ? ` step="${f.step}"` : ""}${f.dir ? ` dir="${f.dir}"` : ""}${req}${ph}${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ""}>`;
    return `<div class="fld${f.full ? " fld--full" : ""}" data-field="${f.name}"><label for="${id}">${esc(f.label)}${f.required ? ' <em aria-hidden="true">*</em>' : ""}</label>${input}${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ""}<small class="err" hidden></small></div>`;
  };
  AZ.formValues = (form) => {
    const out = {};
    for (const el of form.elements) {
      if (!el.name || el.disabled) continue;
      if (el.type === "checkbox") out[el.name] = el.checked;
      else out[el.name] = el.value;
    }
    return out;
  };
  AZ.showErrors = (form, err) => {
    $$(".fld .err", form).forEach((e) => { e.hidden = true; e.textContent = ""; });
    $$(".fld.is-err", form).forEach((e) => e.classList.remove("is-err"));
    const box = $(".form-err", form);
    if (box) { box.hidden = true; box.textContent = ""; }
    if (!err) return;
    let shown = false;
    if (err.fields) {
      for (const [k, msg] of Object.entries(err.fields)) {
        const f = $(`.fld[data-field="${k}"]`, form);
        if (!f) continue;
        const e = $(".err", f);
        e.textContent = typeof msg === "string" ? msg : "قيمة غير صالحة";
        e.hidden = false;
        f.classList.add("is-err");
        if (!shown) { const i = $("input,select,textarea", f); if (i) i.focus(); }
        shown = true;
      }
    }
    if (!box) { if (!shown) AZ.toast(err.message, "err"); return; }
    if (!shown || !err.fields) { box.textContent = err.message; box.hidden = false; }
    else if (shown) { box.textContent = err.message + " — راجع الحقول المحددة."; box.hidden = false; }
  };

  /* ---------------- modal ---------------- */
  AZ.modal = ({ title, body, submit, cancel = "إلغاء", danger, wide, onSubmit, onOpen }) => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="modal__box${wide ? " modal__box--wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="mdl-title">
      <form class="modal__form" novalidate>
        <div class="modal__head"><h2 id="mdl-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="إغلاق">✕</button></div>
        <div class="modal__body">${body || ""}</div>
        <p class="form-err" role="alert" hidden></p>
        <div class="modal__foot">${submit ? `<button type="submit" class="btn ${danger ? "btn--danger" : "btn--primary"}">${esc(submit)}</button>` : ""}<button type="button" class="btn btn--ghost" data-close>${esc(cancel)}</button></div>
      </form></div>`;
    const prev = document.activeElement;
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
    const form = $("form", wrap);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!onSubmit) return close();
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        AZ.showErrors(form, null);
        const r = await onSubmit(AZ.formValues(form), form);
        if (r !== false) close();
      } catch (err) { AZ.showErrors(form, err); }
      finally { btn.disabled = false; }
    });
    document.body.appendChild(wrap);
    if (onOpen) onOpen(form, close);
    const first = $(".modal__body input:not([type=hidden]), .modal__body select, .modal__body textarea", wrap) || $("button[type=submit]", wrap);
    if (first) first.focus();
    return { el: wrap, form, close };
  };
  AZ.confirm = (title, text, { submit = "تأكيد", danger = true } = {}) => new Promise((resolve) => {
    let ok = false;
    const m = AZ.modal({ title, body: `<p>${esc(text)}</p>`, submit, danger, onSubmit: () => { ok = true; } });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); resolve(ok); } });
    obs.observe(document.body, { childList: true });
  });
  /** Show a one-time secret (e.g. temporary password) with a copy button. */
  AZ.showSecret = (title, label, secret) => AZ.modal({
    title, cancel: "تم",
    body: `<p>${esc(label)}</p><div class="secret"><code dir="ltr">${esc(secret)}</code><button type="button" class="btn btn--ghost btn--sm" data-copy>نسخ</button></div><p class="hint">لن تظهر كلمة المرور مرة أخرى. سيُطلب من المستخدم تغييرها عند أول دخول.</p>`,
    onOpen: (form) => $("[data-copy]", form).addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText(secret).then(() => AZ.toast("تم النسخ")); }),
  });

  /* ---------------- tables & widgets ---------------- */
  AZ.table = (cols, rows, { empty = "لا توجد بيانات.", rowAttr } = {}) => {
    if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th scope="col"${c.cls ? ` class="${c.cls}"` : ""}>${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr${rowAttr ? " " + rowAttr(r) : ""}>${cols.map((c) => `<td${c.cls ? ` class="${c.cls}"` : ""} data-label="${esc(c.label)}">${c.html ? c.html(r) : esc(r[c.key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  };
  AZ.pager = (total, page, size) => {
    const pages = Math.max(1, Math.ceil(total / size));
    if (pages <= 1) return `<p class="muted pager-info">${AZ.fmt.num(total)} نتيجة</p>`;
    return `<nav class="pager" aria-label="الصفحات"><button class="btn btn--ghost btn--sm" data-page="${page - 1}"${page <= 1 ? " disabled" : ""}>السابق</button>
      <span>صفحة ${page} من ${pages} · ${AZ.fmt.num(total)} نتيجة</span>
      <button class="btn btn--ghost btn--sm" data-page="${page + 1}"${page >= pages ? " disabled" : ""}>التالي</button></nav>`;
  };
  AZ.stat = (label, value, { tone, sub, href } = {}) => {
    const inner = `<span class="stat__label">${esc(label)}</span><b class="stat__value">${esc(value)}</b>${sub ? `<span class="stat__sub">${esc(sub)}</span>` : ""}`;
    return href ? `<a class="stat${tone ? " stat--" + tone : ""}" href="${href}">${inner}</a>` : `<div class="stat${tone ? " stat--" + tone : ""}">${inner}</div>`;
  };
  AZ.badge = (text, tone) => `<span class="badge${tone ? " badge--" + tone : ""}">${esc(text)}</span>`;
  AZ.progress = (pct, label) => `<progress class="prog" max="100" value="${Math.max(0, Math.min(100, Math.round(pct || 0)))}" aria-label="${esc(label || "التقدم")}"></progress>`;

  /** Simple bar chart (SVG bars + HTML labels): series = [{label, value, value2?}] */
  AZ.bars = (series, { height = 140, legend } = {}) => {
    if (!series.length) return `<div class="empty">لا توجد بيانات في هذه الفترة.</div>`;
    const max = Math.max(1, ...series.map((s) => Math.max(s.value || 0, s.value2 || 0)));
    const two = series[0].value2 != null;
    const w = 100 / series.length;
    const bw = two ? w * 0.34 : w * 0.6;
    const rects = series.map((s, i) => {
      const x = i * w + (w - (two ? bw * 2 + 0.6 : bw)) / 2;
      const h1 = ((s.value || 0) / max) * (height - 4);
      const h2 = two ? ((s.value2 || 0) / max) * (height - 4) : 0;
      return `<g><title>${esc(s.label)}: ${s.value}${two ? " / " + s.value2 : ""}</title><rect class="bar1" x="${x.toFixed(2)}" y="${(height - h1).toFixed(2)}" width="${bw.toFixed(2)}" height="${h1.toFixed(2)}"></rect>${two ? `<rect class="bar2" x="${(x + bw + 0.6).toFixed(2)}" y="${(height - h2).toFixed(2)}" width="${bw.toFixed(2)}" height="${h2.toFixed(2)}"></rect>` : ""}</g>`;
    }).join("");
    const table = `<table class="sr"><thead><tr><th>البند</th><th>القيمة</th>${two ? "<th>القيمة 2</th>" : ""}</tr></thead><tbody>${series.map((s) => `<tr><td>${esc(s.label)}</td><td>${s.value}</td>${two ? `<td>${s.value2}</td>` : ""}</tr>`).join("")}</tbody></table>`;
    return `<figure class="chart"><svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" class="chart__svg" aria-hidden="true" focusable="false">${rects}</svg>
      <div class="chart__labels" aria-hidden="true">${series.map((s) => `<span title="${esc(s.label)}: ${s.value}${two ? " / " + s.value2 : ""}"><b>${AZ.fmt.num(s.value)}${two ? " / " + AZ.fmt.num(s.value2) : ""}</b>${esc(s.label)}</span>`).join("")}</div>
      ${table}${legend ? `<figcaption class="chart__legend">${legend}</figcaption>` : ""}</figure>`;
  };

  /* ---------------- auth screens ---------------- */
  AZ.renderLogin = () => {
    const cfg = AZ.config;
    document.body.className = "is-auth";
    $("#root").innerHTML = `<main class="auth" id="main">
      <form class="auth__card" novalidate>
        <div class="auth__brand"><span class="mark" aria-hidden="true">A</span><div><b>${esc(cfg.title)}</b><small>${esc(cfg.tagline || "")}</small></div></div>
        <h1>تسجيل الدخول</h1>
        ${AZ.field({ name: "email", label: "البريد الإلكتروني", type: "email", required: true, dir: "ltr", autocomplete: "username" })}
        ${AZ.field({ name: "password", label: "كلمة المرور", type: "password", required: true, dir: "ltr", autocomplete: "current-password" })}
        <p class="form-err" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">دخول</button>
        <p class="hint">الحسابات يُنشئها مدير النظام. لا يوجد تسجيل ذاتي.</p>
      </form></main>`;
    const form = $(".auth__card");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = $("button[type=submit]", form);
      b.disabled = true;
      try {
        AZ.showErrors(form, null);
        const v = AZ.formValues(form);
        const r = await AZ.api("POST", "/api/auth/login", { email: v.email, password: v.password }, { noAuthRedirect: true });
        setSession(r);
        boot();
      } catch (err) { AZ.showErrors(form, err); }
      finally { b.disabled = false; }
    });
    const em = $("input[name=email]", form); if (em) em.focus();
  };

  const renderChangePassword = (forced) => {
    const body = `${forced ? '<p class="note">هذه كلمة مرور مؤقتة. اختر كلمة مرور جديدة للمتابعة.</p>' : ""}
      ${AZ.field({ name: "current_password", label: "كلمة المرور الحالية", type: "password", required: true, dir: "ltr", autocomplete: "current-password" })}
      ${AZ.field({ name: "new_password", label: "كلمة المرور الجديدة", type: "password", required: true, dir: "ltr", autocomplete: "new-password", hint: "10 أحرف على الأقل وتحتوي على حروف وأرقام" })}
      ${AZ.field({ name: "confirm", label: "تأكيد كلمة المرور", type: "password", required: true, dir: "ltr", autocomplete: "new-password" })}`;
    const submit = async (v) => {
      if (v.new_password !== v.confirm) throw new ApiError(422, "بيانات غير صالحة", { confirm: "كلمتا المرور غير متطابقتين" });
      await AZ.post("/api/auth/password", { current_password: v.current_password, new_password: v.new_password });
      AZ.toast("تم تغيير كلمة المرور");
      if (forced) { AZ.state.user.must_change_password = false; boot(); }
    };
    if (!forced) return AZ.modal({ title: "تغيير كلمة المرور", body, submit: "حفظ", onSubmit: submit });
    document.body.className = "is-auth";
    $("#root").innerHTML = `<main class="auth" id="main"><form class="auth__card" novalidate><h1>تغيير كلمة المرور</h1>${body}<p class="form-err" role="alert" hidden></p>
      <button class="btn btn--primary btn--block" type="submit">حفظ والمتابعة</button><button class="btn btn--ghost btn--block" type="button" data-logout>تسجيل الخروج</button></form></main>`;
    const form = $(".auth__card");
    form.addEventListener("submit", async (e) => { e.preventDefault(); try { AZ.showErrors(form, null); await submit(AZ.formValues(form)); } catch (err) { AZ.showErrors(form, err); } });
    $("[data-logout]", form).addEventListener("click", logout);
  };

  const setSession = (r) => {
    AZ.state.user = r.user;
    AZ.state.csrf = r.csrf || AZ.state.csrf;
    AZ.state.perms = new Set(r.permissions || []);
  };
  const logout = async () => {
    try { await AZ.api("POST", "/api/auth/logout", {}, { noAuthRedirect: true }); } catch (e) { /* ignore */ }
    AZ.state = { user: null, csrf: "", perms: new Set(), app: null };
    location.hash = "";
    AZ.renderLogin();
  };
  AZ.logout = logout;

  /* ---------------- shell ---------------- */
  const ROLE_LABELS = () => AZ.config.roleLabels || {};
  AZ.roleLabel = (r) => ROLE_LABELS()[r] || r;

  const renderShell = () => {
    const cfg = AZ.config;
    const u = AZ.state.user;
    document.body.className = "is-app";
    const nav = cfg.nav.filter((n) => !n.perm || [].concat(n.perm).some(AZ.can));
    $("#root").innerHTML = `
      <a class="skip" href="#main">تخطَّ إلى المحتوى</a>
      <aside class="side" id="side" aria-label="القائمة الرئيسية">
        <div class="side__brand"><span class="mark" aria-hidden="true">A</span><div><b>${esc(cfg.title)}</b><small>${esc(cfg.tagline || "")}</small></div></div>
        <nav class="side__nav">${nav.map((n) => `<a href="#/${n.route}" data-route="${n.route}"><span aria-hidden="true">${n.icon || "•"}</span>${esc(n.label)}</a>`).join("")}</nav>
        <div class="side__foot"><small>${esc(u.name)}</small><small class="muted">${esc(AZ.roleLabel(u.role))}</small></div>
      </aside>
      <div class="side-scrim" data-close-side hidden></div>
      <div class="main">
        <header class="top">
          <button class="icon-btn top__menu" data-toggle-side aria-label="القائمة" aria-controls="side" aria-expanded="false">☰</button>
          ${cfg.search ? `<form class="top__search" role="search"><label class="sr" for="gsearch">بحث</label><input id="gsearch" type="search" placeholder="${esc(cfg.searchPlaceholder || "بحث…")}" autocomplete="off"><div class="search-pop" hidden></div></form>` : '<span class="grow"></span>'}
          <div class="top__end">
            <div class="pop-wrap"><button class="icon-btn" data-notif aria-label="الإشعارات" aria-haspopup="true" aria-expanded="false">🔔<span class="dot" hidden></span></button><div class="pop notif-pop" hidden></div></div>
            <div class="pop-wrap"><button class="user-btn" data-user aria-haspopup="true" aria-expanded="false"><span class="avatar" aria-hidden="true">${esc((u.name || "?").trim().charAt(0))}</span><span class="user-btn__name">${esc(u.name)}</span></button>
              <div class="pop user-pop" hidden><p><b>${esc(u.name)}</b><br><small class="muted" dir="ltr">${esc(u.email)}</small><br><small>${esc(AZ.roleLabel(u.role))}</small></p>
                <button class="pop__item" data-chpw>تغيير كلمة المرور</button><button class="pop__item" data-signout>تسجيل الخروج</button></div></div>
          </div>
        </header>
        <main class="content" id="main" tabindex="-1"></main>
      </div>`;
    bindShell();
    refreshNotifCount();
  };

  let notifTimer = null;
  const refreshNotifCount = async () => {
    try {
      const r = await AZ.get("/api/notifications?unread=1&size=1");
      const dot = $(".top [data-notif] .dot");
      if (dot) { dot.hidden = !r.unread; dot.textContent = r.unread > 99 ? "99+" : String(r.unread || ""); }
    } catch (e) { /* ignore */ }
  };
  AZ.refreshNotifCount = refreshNotifCount;

  const closePops = (except) => $$(".pop").forEach((p) => { if (p !== except) { p.hidden = true; const b = p.previousElementSibling; if (b) b.setAttribute("aria-expanded", "false"); } });

  const bindShell = () => {
    const side = $("#side"), scrim = $(".side-scrim"), tog = $("[data-toggle-side]");
    const setSide = (open) => { side.classList.toggle("is-open", open); scrim.hidden = !open; tog.setAttribute("aria-expanded", String(open)); };
    tog.addEventListener("click", () => setSide(!side.classList.contains("is-open")));
    scrim.addEventListener("click", () => setSide(false));
    side.addEventListener("click", (e) => { if (e.target.closest("a")) setSide(false); });

    $("[data-user]").addEventListener("click", (e) => { const p = e.currentTarget.nextElementSibling; const open = p.hidden; closePops(); p.hidden = !open; e.currentTarget.setAttribute("aria-expanded", String(open)); });
    $("[data-signout]").addEventListener("click", logout);
    $("[data-chpw]").addEventListener("click", () => { closePops(); renderChangePassword(false); });
    $("[data-notif]").addEventListener("click", async (e) => {
      const btn = e.currentTarget, p = btn.nextElementSibling;
      if (!p.hidden) { closePops(); return; }
      closePops();
      p.hidden = false; btn.setAttribute("aria-expanded", "true");
      p.innerHTML = '<p class="muted pad">جارٍ التحميل…</p>';
      try {
        const r = await AZ.get("/api/notifications?size=15");
        p.innerHTML = `<div class="pop__head"><b>الإشعارات</b>${r.unread ? '<button class="link" data-readall>تحديد الكل كمقروء</button>' : ""}</div>
          ${r.items.length ? `<ul class="notif-list">${r.items.map((n) => `<li class="${n.read_at ? "" : "is-unread"}"><a href="${esc(n.link || "#/")}" data-nid="${n.id}"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<small>${esc(AZ.fmt.rel(n.created_at))}</small></a></li>`).join("")}</ul>` : '<p class="muted pad">لا توجد إشعارات.</p>'}`;
      } catch (err) { p.innerHTML = `<p class="pad">${esc(err.message)}</p>`; }
    });
    $(".notif-pop").addEventListener("click", async (e) => {
      const ra = e.target.closest("[data-readall]");
      if (ra) { e.preventDefault(); await AZ.post("/api/notifications/read-all").catch(AZ.fail); closePops(); refreshNotifCount(); return; }
      const a = e.target.closest("[data-nid]");
      if (a) { AZ.post(`/api/notifications/${a.dataset.nid}/read`).then(refreshNotifCount).catch(() => {}); closePops(); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".pop-wrap") && !e.target.closest(".top__search")) { closePops(); const sp = $(".search-pop"); if (sp) sp.hidden = true; } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePops(); setSide(false); const sp = $(".search-pop"); if (sp) sp.hidden = true; } });

    const sf = $(".top__search");
    if (sf) {
      const input = $("input", sf), pop = $(".search-pop", sf);
      let timer;
      const run = async () => {
        const q = input.value.trim();
        if (q.length < 2) { pop.hidden = true; return; }
        try { pop.innerHTML = await AZ.config.search(q); pop.hidden = false; } catch (err) { pop.innerHTML = `<p class="pad">${esc(err.message)}</p>`; pop.hidden = false; }
      };
      input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
      sf.addEventListener("submit", (e) => { e.preventDefault(); run(); });
      pop.addEventListener("click", (e) => { if (e.target.closest("a")) { pop.hidden = true; input.value = ""; } });
    }
    clearInterval(notifTimer);
    notifTimer = setInterval(refreshNotifCount, 60000);
  };

  /* ---------------- router ---------------- */
  const route = async () => {
    if (!AZ.state.user) return;
    const cfg = AZ.config;
    const hash = location.hash.replace(/^#\/?/, "") || cfg.home;
    const [path, query] = hash.split("?");
    const parts = path.split("/");
    const params = Object.fromEntries(new URLSearchParams(query || ""));
    let view = null, args = [];
    for (const [pattern, fn] of Object.entries(cfg.routes)) {
      const pp = pattern.split("/");
      if (pp.length !== parts.length) continue;
      const a = [];
      if (pp.every((seg, i) => (seg.startsWith(":") ? (a.push(decodeURIComponent(parts[i])), true) : seg === parts[i]))) { view = fn; args = a; break; }
    }
    $$(".side__nav a").forEach((a) => { const on = a.dataset.route === parts[0]; a.classList.toggle("is-active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    // Fresh <main> per render so view-level event listeners never accumulate.
    const old = $("#main");
    const main = old.cloneNode(false);
    old.replaceWith(main);
    if (!view) { main.innerHTML = `<div class="empty"><h1>الصفحة غير موجودة</h1><a class="btn btn--ghost" href="#/${cfg.home}">العودة للرئيسية</a></div>`; return; }
    main.innerHTML = '<div class="loading" aria-busy="true">جارٍ التحميل…</div>';
    try {
      const out = await view(main, args, params);
      if (typeof out === "string") main.innerHTML = out;
      const h1 = $("h1", main);
      document.title = `${h1 ? h1.textContent + " | " : ""}${cfg.title}`;
      main.focus({ preventScroll: true });
    } catch (err) {
      if (err.status === 401) return;
      main.innerHTML = `<div class="empty"><h1>${err.status === 403 ? "لا تملك صلاحية" : err.status === 404 ? "غير موجود" : "حدث خطأ"}</h1><p>${esc(err.message)}</p><a class="btn btn--ghost" href="#/${cfg.home}">العودة للرئيسية</a></div>`;
    }
  };
  AZ.reload = route;
  AZ.go = (h) => { if (location.hash === h) route(); else location.hash = h; };

  /* ---------------- boot ---------------- */
  const boot = () => {
    if (!AZ.state.user) return AZ.renderLogin();
    if (AZ.state.user.must_change_password) return renderChangePassword(true);
    renderShell();
    route();
  };

  AZ.start = async (config) => {
    AZ.config = config;
    window.addEventListener("hashchange", route);
    try {
      const r = await AZ.api("GET", "/api/auth/me", undefined, { noAuthRedirect: true });
      if (r.user) setSession(r);
    } catch (e) {
      $("#root").innerHTML = `<main class="auth"><div class="auth__card"><h1>${esc(config.title)}</h1><p>${esc(e.message)}</p><p class="hint">هذا النظام يعمل على خادم Node.js. شغّله محليًا عبر <code dir="ltr">npm run ${esc(config.app)}</code> داخل مجلد platform.</p></div></main>`;
      return;
    }
    boot();
  };
})();
