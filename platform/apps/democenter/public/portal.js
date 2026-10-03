/* =========================================================
   AZENK Demo Center — customer portal
   Server-side checks protect everything; this page only displays
   what the API allows. The countdown uses the SERVER time offset.
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  const S = { config: null, me: null, csrf: "", offset: 0, products: [], timer: null, poll: null, ended: null, warned: {} };

  const MARK = `<svg class="brand__mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1dfae"/><stop offset=".55" stop-color="#c9a45c"/><stop offset="1" stop-color="#9c7b3e"/></linearGradient></defs><path d="M24 2.5 45.5 24 24 45.5 2.5 24Z" fill="none" stroke="url(#g)" stroke-width="1.6"/><path d="M15.5 33 24 13.5 32.5 33" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 26.5h10" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  const brand = `<a class="brand" href="#/">${MARK}<span class="brand__txt"><b>AZENK</b><small>Demo Center</small></span></a>`;

  /* ---------- API ---------- */
  class ApiError extends Error { constructor(status, data) { super((data && data.error && data.error.message) || `خطأ ${status}`); this.status = status; this.code = data && data.error && data.error.code; this.fields = data && data.error && data.error.fields; this.data = data || {}; } }
  async function api(method, path, body) {
    const headers = { Accept: "application/json" };
    if (method !== "GET") { headers["Content-Type"] = "application/json"; if (S.csrf) headers["X-CSRF-Token"] = S.csrf; }
    let res;
    try { res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin" }); }
    catch (e) { throw new ApiError(0, { error: { message: "تعذّر الاتصال بـ Demo Center" } }); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data);
    if (data.csrf) S.csrf = data.csrf;
    return data;
  }

  let toastT;
  const toast = (msg) => { let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4000); };
  const fieldErrors = (form, err) => {
    form.querySelectorAll(".fld").forEach((f) => { f.classList.remove("is-err"); const e = $(".err", f); if (e) { e.hidden = true; e.textContent = ""; } });
    const box = $(".form-err", form);
    if (box) { box.hidden = true; box.textContent = ""; }
    if (!err) return;
    let shown = false;
    for (const [k, m] of Object.entries(err.fields || {})) {
      const f = form.querySelector(`.fld[data-f="${k}"]`);
      if (!f) continue;
      f.classList.add("is-err");
      const e = $(".err", f); if (e) { e.textContent = m; e.hidden = false; }
      shown = true;
    }
    if (box) { box.textContent = shown ? `${err.message} — راجع الحقول المحددة.` : err.message; box.hidden = false; }
  };
  const fld = (name, label, input, req) => `<div class="fld" data-f="${name}"><label for="f-${name}">${esc(label)}${req ? " <em>*</em>" : ""}</label>${input}<small class="err" hidden></small></div>`;

  /* ---------- time (server is the source of truth) ---------- */
  const serverNow = () => Date.now() + S.offset;
  const remaining = () => (S.me && S.me.expires_at ? Math.max(0, Date.parse(S.me.expires_at) - serverNow()) : 0);
  const hms = (ms) => { let s = Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); s %= 60; return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":"); };
  const syncTime = (iso) => { if (iso) S.offset = Date.parse(iso) - Date.now(); };

  /* ---------- WhatsApp (number comes from the server config) ---------- */
  const productNames = (ids) => ids.map((id) => ((S.config && S.config.products.find((p) => p.id === id)) || { name: id }).name);
  function waLink(kind, acc) {
    const n = S.config && S.config.whatsapp;
    if (!n) return null;
    const names = acc ? productNames(acc.products || []).join("، ") : "";
    const text = kind === "subscribe"
      ? ["السلام عليكم،", "انتهت تجربتي في نظام AZENK وأرغب في معرفة تفاصيل الاشتراك.", "", `النظام: ${names}`, `الاسم: ${acc ? acc.customer_name || "" : ""}`, `المنشأة: ${acc ? acc.company_name || "" : ""}`, `الجوال: ${acc ? acc.phone || "" : ""}`].join("\n")
      : ["السلام عليكم،", "أرغب في التواصل مع AZENK بخصوص تجربة Demo Center.", "", `الاسم: ${acc ? acc.customer_name || "" : ""}`].join("\n");
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  }

  /* ---------- routing ---------- */
  const route = () => {
    const [path, q] = location.hash.replace(/^#\/?/, "").split("?");
    const params = new URLSearchParams(q || "");
    stopTimers();
    if (path === "request") return viewRequest(params);
    if (path === "forgot") return viewForgot();
    if (path === "login") return viewLogin();
    if (path === "expired") return S.ended ? viewEnded(S.ended) : loadCenter(params, "expired");
    return loadCenter(params, path);
  };
  window.addEventListener("hashchange", route);
  const stopTimers = () => { clearInterval(S.timer); clearInterval(S.poll); S.timer = S.poll = null; };

  /* ---------- login ---------- */
  function viewLogin(msg) {
    document.title = "تسجيل الدخول | AZENK Demo Center";
    app.innerHTML = `<main class="auth"><form class="auth__card" novalidate>
      ${brand}
      <h1>تسجيل الدخول إلى Demo Center</h1>
      <p class="lead">استخدم بيانات الدخول التي أرسلها لك فريق AZENK. مدة التجربة 24 ساعة تبدأ من أول تسجيل دخول.</p>
      ${msg ? `<p class="note">${esc(msg)}</p>` : ""}
      ${fld("username", "اسم المستخدم", `<input id="f-username" name="username" autocomplete="username" dir="ltr" required>`, true)}
      ${fld("password", "كلمة المرور", `<input id="f-password" name="password" type="password" autocomplete="current-password" dir="ltr" required>`, true)}
      <p class="form-err" role="alert" hidden></p>
      <button class="btn btn--gold btn--block" type="submit">دخول</button>
      <div class="auth__links"><a href="#/forgot">نسيت كلمة المرور؟</a><a href="#/request">ليس لديك حساب؟ اطلب Demo عبر WhatsApp</a></div>
      <p class="auth__foot">AZENK · Digital · Technology · Creative</p>
    </form></main>`;
    const form = $("form", app);
    $("#f-username").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = $("button[type=submit]", form);
      b.disabled = true;
      try {
        fieldErrors(form, null);
        const r = await api("POST", "/api/demo/login", { username: form.elements.username.value, password: form.elements.password.value });
        S.me = r.account; syncTime(r.account.server_now);
        if (location.hash === "#/") route(); else location.hash = "#/";
      } catch (err) {
        if (err.code === "EXPIRED" || err.code === "SUSPENDED") { S.ended = { code: err.code, account: err.data.account }; return viewEnded(S.ended); }
        fieldErrors(form, err);
      } finally { b.disabled = false; }
    });
  }

  /* ---------- center ---------- */
  async function loadCenter(params, path) {
    app.innerHTML = '<p class="boot">جارٍ التحميل…</p>';
    try {
      if (!S.config) S.config = await api("GET", "/api/demo/config");
      const me = await api("GET", "/api/demo/me");
      S.me = me.account; syncTime(me.account.server_now);
      const p = await api("GET", "/api/demo/products");
      S.products = p.products; syncTime(p.server_now);
      viewCenter(path === "no-access");
    } catch (err) {
      if (err.code === "EXPIRED" || err.code === "SUSPENDED") { S.ended = { code: err.code, account: err.data.account || (S.me && { ...S.me, products: S.products.map((x) => x.id) }) }; return viewEnded(S.ended); }
      if (err.status === 401) return viewLogin(path === "expired" ? "انتهت فترة التجربة أو الجلسة. سجّل الدخول لمعرفة الحالة." : null);
      app.innerHTML = `<main class="auth"><div class="auth__card">${brand}<h1>تعذّر التحميل</h1><p class="lead">${esc(err.message)}</p><button class="btn btn--ghost btn--block" type="button" id="retry">إعادة المحاولة</button></div></main>`;
      $("#retry").addEventListener("click", route);
    }
  }

  function viewCenter(noAccess) {
    const me = S.me;
    document.title = "تجاربك | AZENK Demo Center";
    app.innerHTML = `
      <header class="top">${brand}
        <div class="top__end">
          <div class="who"><b>${esc(me.customer_name)}</b><small>${esc(me.company_name || "")}</small></div>
          <span class="clock" id="clock" title="الوقت المتبقي في تجربتك">⏱ <span id="clock-t">--:--:--</span></span>
          <button class="btn btn--ghost btn--sm" type="button" id="logout">خروج</button>
        </div>
      </header>
      <main class="wrap">
        <section class="hello"><h1>مرحبًا ${esc(me.customer_name)}</h1><p>تجاربك الحالية في أنظمة AZENK — تنتهي التجربة في ${esc(new Date(me.expires_at).toLocaleString("ar-SA-u-nu-latn-ca-gregory", { dateStyle: "medium", timeStyle: "short" }))}.</p></section>
        ${noAccess ? '<div class="alert alert--err" role="alert">هذا النظام غير مفعّل في تجربتك. تواصل مع AZENK لإضافته.</div>' : ""}
        <div id="alert" aria-live="polite"></div>
        <h2 class="section-title">الأنظمة المفعّلة لك</h2>
        ${S.products.length ? `<div class="cards">${S.products.map((p) => `
          <article class="pcard">
            <h3>${esc(p.name)}</h3>
            <p class="pcard__tag">${esc(p.tagline)}</p>
            <dl class="pcard__meta"><dt>الحالة</dt><dd><span class="dot" aria-hidden="true"></span>نشط</dd><dt>متبقي</dt><dd><span class="tnum" data-left>--:--:--</span></dd></dl>
            <p class="pcard__tech">${esc(p.tech)}</p>
            <a class="btn btn--gold" href="${esc(p.url)}">فتح النظام</a>
          </article>`).join("")}</div>` : '<div class="empty">لا توجد أنظمة مفعّلة في تجربتك حاليًا. تواصل مع AZENK.</div>'}
      </main>`;
    $("#logout").addEventListener("click", logout);
    stopTimers();
    const tick = () => {
      if (!$("#clock-t")) return stopTimers(); // view changed
      const r = remaining();
      if (r <= 0) { stopTimers(); S.ended = { code: "EXPIRED", account: { ...me, products: S.products.map((x) => x.id) } }; return viewEnded(S.ended); }
      const t = hms(r);
      $("#clock-t").textContent = t;
      document.querySelectorAll("[data-left]").forEach((el) => (el.textContent = t));
      const clock = $("#clock");
      clock.className = "clock" + (r <= 30 * 60000 ? " clock--err" : r <= 2 * 3600000 ? " clock--warn" : "");
      const level = r <= 30 * 60000 ? "30m" : r <= 2 * 3600000 ? "2h" : null;
      const box = $("#alert");
      if (level === "30m") box.innerHTML = '<div class="alert alert--err">تبقى 30 دقيقة على انتهاء تجربتك.</div>';
      else if (level === "2h") box.innerHTML = '<div class="alert alert--warn">تنتهي تجربتك خلال ساعتين.</div>';
      else box.innerHTML = "";
      if (level && !S.warned[level]) { S.warned[level] = true; toast(level === "30m" ? "تبقى 30 دقيقة على انتهاء تجربتك." : "تنتهي تجربتك خلال ساعتين."); }
    };
    tick();
    S.timer = setInterval(tick, 1000);
    // Re-sync with the server (suspension, extension, revoked products, expiry).
    S.poll = setInterval(async () => {
      try { const s = await api("GET", "/api/demo/status"); S.me.expires_at = s.expires_at; syncTime(s.server_now); }
      catch (err) {
        if (err.code === "EXPIRED" || err.code === "SUSPENDED") { stopTimers(); S.ended = { code: err.code, account: err.data.account }; viewEnded(S.ended); }
        else if (err.status === 401) { stopTimers(); viewLogin("انتهت جلستك. سجّل الدخول من جديد."); }
      }
    }, 30000);
  }

  async function logout() {
    try { await api("POST", "/api/demo/logout", {}); } catch (e) { /* ignore */ }
    S.me = null; S.csrf = ""; S.ended = null; S.warned = {};
    location.hash = "#/login";
  }

  /* ---------- expired / suspended ---------- */
  async function viewEnded({ code, account }) {
    if (!S.config) { try { S.config = await api("GET", "/api/demo/config"); } catch (e) { /* offline */ } }
    const expired = code === "EXPIRED";
    document.title = (expired ? "انتهت فترة التجربة" : "الحساب موقوف") + " | AZENK Demo Center";
    const sub = waLink("subscribe", account), contact = waLink("contact", account);
    app.innerHTML = `<main class="auth"><div class="auth__card end">
      ${brand}
      <div class="end__icon" aria-hidden="true">${expired ? "⏳" : "⏸"}</div>
      <h1>${expired ? "انتهت فترة التجربة" : "تم إيقاف حسابك التجريبي"}</h1>
      <p class="lead">${expired ? "شكرًا لتجربتك أنظمة AZENK. يسعدنا مساعدتك في اختيار الباقة المناسبة وتفعيل النظام لمنشأتك." : "تواصل مع فريق AZENK لمعرفة التفاصيل."}</p>
      ${account && account.products && account.products.length ? `<p class="note">الأنظمة في تجربتك: ${esc(productNames(account.products).join("، "))}</p>` : ""}
      <div class="end__actions">
        ${sub ? `<a class="btn btn--gold" href="${sub}" target="_blank" rel="noopener noreferrer">طلب النظام</a>` : ""}
        ${contact ? `<a class="btn btn--wa" href="${contact}" target="_blank" rel="noopener noreferrer">التواصل مع AZENK عبر واتساب</a>` : ""}
        <button class="btn btn--ghost" type="button" id="back">العودة لتسجيل الدخول</button>
      </div></div></main>`;
    $("#back").addEventListener("click", async () => { try { await api("POST", "/api/demo/logout", {}); } catch (e) { /* ignore */ } S.ended = null; location.hash = "#/login"; viewLogin(); });
  }

  /* ---------- request a demo (plain WhatsApp, no API/bot) ---------- */
  // The request goes to AZENK's regular WhatsApp with a ready message; staff then create the
  // account manually in the admin panel and send the credentials back.
  const demoRequestText = (names) => ["السلام عليكم،", names.length > 1 ? `أرغب في تجربة الأنظمة: ${names.join("، ")}.` : `أرغب في تجربة نظام ${names[0] || "AZENK"}.`, "", "الاسم:", "اسم المنشأة:", "عدد المستخدمين:", "ملاحظات:"].join("\n");
  async function viewRequest(params) {
    document.title = "اطلب Demo | AZENK Demo Center";
    if (!S.config) { try { S.config = await api("GET", "/api/demo/config"); } catch (e) { app.innerHTML = `<p class="boot">${esc(e.message)}</p>`; return; } }
    const pre = (params.get("product") || "").split(",");
    const n = S.config.whatsapp;
    app.innerHTML = `<main class="auth"><form class="auth__card auth__card--wide" novalidate>
      ${brand}
      <h1>اطلب تجربة Demo</h1>
      <p class="lead">اختر النظام وأرسل الطلب عبر WhatsApp. يجهّز لك فريق AZENK حسابًا خاصًا ويرسل لك بيانات الدخول. مدة التجربة 24 ساعة تبدأ من أول تسجيل دخول.</p>
      <fieldset class="fld fld--set" data-f="products"><legend>النظام المطلوب <em>*</em></legend>
        <div class="checks">${S.config.products.map((p) => `<label class="check"><input type="checkbox" name="products" value="${esc(p.id)}"${pre.includes(p.id) ? " checked" : ""}><span><b dir="ltr">${esc(p.name)}</b><small>${esc(p.tagline)}</small></span></label>`).join("")}</div>
        <small class="err" hidden></small></fieldset>
      ${n ? '<button class="btn btn--wa btn--block" type="submit">إرسال الطلب عبر WhatsApp</button>' : '<p class="form-err">رقم WhatsApp غير مهيأ.</p>'}
      <div class="auth__links"><a href="#/login">لديك حساب؟ تسجيل الدخول</a></div>
    </form></main>`;
    const form = $("form", app);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ids = [...form.querySelectorAll("input[name=products]:checked")].map((x) => x.value);
      if (!ids.length) return fieldErrors(form, { fields: { products: "اختر نظامًا واحدًا على الأقل" } });
      fieldErrors(form, null);
      window.open(`https://wa.me/${n}?text=${encodeURIComponent(demoRequestText(productNames(ids)))}`, "_blank", "noopener");
    });
  }

  /* ---------- forgot password ---------- */
  function viewForgot() {
    document.title = "نسيت كلمة المرور | AZENK Demo Center";
    app.innerHTML = `<main class="auth"><form class="auth__card" novalidate>
      ${brand}
      <h1>نسيت كلمة المرور</h1>
      <p class="lead">أدخل اسم المستخدم ورقم الجوال المسجل. يتحقق فريق AZENK ويرسل لك كلمة مرور جديدة.</p>
      ${fld("username", "اسم المستخدم", `<input id="f-username" name="username" dir="ltr" required>`, true)}
      ${fld("phone", "رقم الجوال", `<input id="f-phone" name="phone" type="tel" dir="ltr" placeholder="05XXXXXXXX" required>`, true)}
      <p class="form-err" role="alert" hidden></p>
      <button class="btn btn--gold btn--block" type="submit">إرسال</button>
      <div class="auth__links"><a href="#/login">العودة لتسجيل الدخول</a></div>
    </form></main>`;
    const form = $("form", app);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        fieldErrors(form, null);
        await api("POST", "/api/demo/forgot", { username: form.elements.username.value, phone: form.elements.phone.value });
        app.innerHTML = `<main class="auth"><div class="auth__card end">${brand}<div class="end__icon" aria-hidden="true">✓</div><h1>تم استلام طلبك</h1>
          <p class="lead">إذا كانت البيانات مطابقة لحساب تجريبي، سيتواصل معك فريق AZENK بكلمة مرور جديدة.</p><div class="end__actions"><a class="btn btn--ghost" href="#/login">العودة لتسجيل الدخول</a></div></div></main>`;
      } catch (err) { fieldErrors(form, err); }
    });
  }

  route();
})();
