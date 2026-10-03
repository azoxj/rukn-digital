/* =========================================================
   AZENK Demo Center — staff administration
   ========================================================= */
(function () {
  "use strict";
  const AZ = window.AZ;
  const { esc, fmt, $ } = AZ;
  const L = {
    role: { SUPER_ADMIN: "مدير عام", ADMIN: "مدير" },
    acc: { PENDING: "لم يبدأ", ACTIVE: "نشط", EXPIRED: "منتهٍ", SUSPENDED: "موقوف" },
    accTone: { PENDING: "info", ACTIVE: "ok", EXPIRED: "", SUSPENDED: "err" },
    req: { PENDING: "جديد", APPROVED: "تمت الموافقة", REJECTED: "مرفوض", COMPLETED: "مكتمل (دخل العميل)", CANCELLED: "ملغى" },
    reqTone: { PENDING: "warn", APPROVED: "info", REJECTED: "err", COMPLETED: "ok", CANCELLED: "" },
    action: {
      "demo_request.created": "طلب Demo جديد", "demo_request.approved": "الموافقة على الطلب", "demo_request.rejected": "رفض الطلب", "demo_request.cancelled": "إلغاء الطلب",
      "demo.created": "إنشاء الحساب", "demo.activated": "أول دخول — بدء التجربة", "demo.login": "تسجيل دخول", "demo.login_failed": "محاولة دخول فاشلة", "demo.logout": "تسجيل خروج",
      "demo.product_granted": "منح نظام", "demo.product_revoked": "سحب نظام", "demo.product_opened": "فتح نظام", "demo.extended": "تمديد", "demo.suspended": "إيقاف",
      "demo.reactivated": "إعادة تفعيل", "demo.expired": "انتهاء تلقائي", "demo.expired_by_admin": "إنهاء بواسطة الإدارة", "demo.password_reset": "إعادة تعيين كلمة المرور",
      "demo.password_reset_requested": "طلب استعادة كلمة المرور", "demo.data_reset": "إعادة ضبط البيانات التجريبية",
    },
  };
  let catalog = null;
  const products = async () => (catalog ||= (await AZ.get("/api/demo/catalog")).products);
  const pname = (id) => ((catalog || []).find((p) => p.id === id) || { name: id }).name;
  const head = (title, sub, actions = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
  const left = (a) => (a.status === "ACTIVE" && a.remaining_ms != null ? fmt.duration(Math.floor(a.remaining_ms / 1000)) : "—");
  const productChecks = (all, selected = []) => `<div class="check-grid">${all.map((p) => `<label class="chk"><input type="checkbox" name="p_${p.id}"${selected.includes(p.id) ? " checked" : ""}> ${esc(p.name)}</label>`).join("")}</div>`;
  const readChecks = (v, all) => all.filter((p) => v["p_" + p.id]).map((p) => p.id);

  /** Show the one-time credentials with a copy-ready message (never put them in a URL). */
  const showCredentials = (title, c) => {
    const msg = ["بيانات الدخول إلى AZENK Demo Center", `الرابط: ${location.origin}/`, `اسم المستخدم: ${c.username}`, `كلمة المرور: ${c.password}`, "مدة التجربة 24 ساعة تبدأ من أول تسجيل دخول."].join("\n");
    AZ.modal({
      title, cancel: "تم",
      body: `<p>سلّم هذه البيانات للعميل. <b>لن تظهر كلمة المرور مرة أخرى</b> ولا تُحفظ إلا مشفّرة.</p>
        <div class="secret"><code dir="ltr">${esc(c.username)}</code></div><div class="secret"><code dir="ltr">${esc(c.password)}</code></div>
        <button type="button" class="btn btn--primary btn--sm" data-copy>نسخ رسالة جاهزة للإرسال</button>
        <p class="hint">انسخ الرسالة والصقها في محادثة العميل. لا ترسل كلمة المرور داخل رابط.</p>`,
      onOpen: (f) => $("[data-copy]", f).addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText(msg).then(() => AZ.toast("تم نسخ الرسالة"))),
    });
  };

  /* ================= Dashboard ================= */
  const dashboard = async (main) => {
    const [s] = await Promise.all([AZ.get("/api/admin/stats"), products()]);
    const max = Math.max(1, ...s.popular.map((p) => p.requests));
    main.innerHTML = `${head("لوحة Demo Center", "طلبات التجربة والحسابات التجريبية", '<a class="btn btn--primary" href="#/requests?status=PENDING">مراجعة الطلبات الجديدة</a>')}
      <div class="stats">
        ${AZ.stat("إجمالي الطلبات", fmt.num(s.requests.total), { href: "#/requests" })}
        ${AZ.stat("طلبات جديدة", fmt.num(s.requests.pending), { tone: s.requests.pending ? "warn" : "", href: "#/requests?status=PENDING" })}
        ${AZ.stat("Demos نشطة", fmt.num(s.accounts.active), { tone: "ok", href: "#/demos?status=ACTIVE" })}
        ${AZ.stat("تنتهي خلال 3 ساعات", fmt.num(s.accounts.expiring_soon), { tone: s.accounts.expiring_soon ? "warn" : "" })}
        ${AZ.stat("Demos منتهية", fmt.num(s.accounts.expired), { href: "#/demos?status=EXPIRED" })}
        ${AZ.stat("لم تبدأ بعد", fmt.num(s.accounts.not_started), { href: "#/demos?status=PENDING" })}
        ${AZ.stat("المستخدمون التجريبيون", fmt.num(s.accounts.total), { href: "#/demos" })}
        ${AZ.stat("طلبات استعادة كلمة المرور", fmt.num(s.open_password_requests), { tone: s.open_password_requests ? "warn" : "", href: "#/password-requests" })}
      </div>
      <div class="cols cols--2">
        <section class="card"><h2>الأنظمة الأكثر طلبًا</h2><div class="bars-h">${s.popular.map((p) => `<div><span>${esc(p.name)}</span>${AZ.progress((p.requests / max) * 100, p.name)}<b>${p.requests}</b></div>`).join("")}</div></section>
        <section class="card"><h2>تنتهي قريبًا</h2>${s.expiring.length ? `<ul class="timeline">${s.expiring.map((a) => `<li><a href="#/demos/${a.id}"><b>${esc(a.customer_name)}</b></a><small>${esc(a.company_name || "")} · متبقي ${left(a)}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد تجارب تنتهي خلال 3 ساعات.</div>'}</section>
      </div>`;
  };

  /* ================= Requests ================= */
  const requests = async (main, _a, params) => {
    await products();
    const state = { status: params.status || "", q: "", page: 1 };
    main.innerHTML = `${head("طلبات Demo", "طلبات التجربة الواردة من الموقع")}
      <form class="filters">${AZ.field({ name: "status", label: "الحالة", type: "select", options: [["", "الكل"], ...Object.entries(L.req)], value: state.status })}${AZ.field({ name: "q", label: "بحث", type: "search" })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/admin/demo-requests" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "#", key: "id", cls: "num" },
        { label: "العميل", html: (x) => `<b>${esc(x.customer_name)}</b><br><small class="muted">${esc(x.company_name || "")}</small>` },
        { label: "التواصل", html: (x) => `<span dir="ltr">${esc(x.phone)}</span>${x.email ? `<br><small dir="ltr">${esc(x.email)}</small>` : ""}` },
        { label: "الأنظمة", html: (x) => esc(x.products.map(pname).join("، ")) },
        { label: "المستخدمون", html: (x) => esc(x.users_count || "—") },
        { label: "التاريخ", html: (x) => esc(fmt.dateTime(x.created_at)) },
        { label: "الحالة", html: (x) => AZ.badge(L.req[x.status], L.reqTone[x.status]) },
        { label: "", html: (x) => x.status === "PENDING" ? `<button class="btn btn--primary btn--sm" data-review="${x.id}">مراجعة</button>` : x.demo_account_id ? `<a class="btn btn--ghost btn--sm" href="#/demos/${x.demo_account_id}">الحساب</a>` : "" },
      ], r.items, { empty: "لا توجد طلبات." }) + AZ.pager(r.total, r.page, r.size);
      main._items = r.items;
    };
    const f = $(".filters", main);
    f.addEventListener("input", () => { Object.assign(state, AZ.formValues(f), { page: 1 }); render().catch(AZ.fail); });
    main.addEventListener("click", async (e) => {
      const p = e.target.closest("[data-page]"); if (p && !p.disabled) { state.page = Number(p.dataset.page); return render(); }
      const b = e.target.closest("[data-review]"); if (!b) return;
      const x = main._items.find((i) => String(i.id) === b.dataset.review);
      const all = await products();
      AZ.modal({
        title: `مراجعة طلب ${x.customer_name}`, submit: "موافقة وإنشاء الحساب", wide: true,
        body: `<dl class="dl"><dt>المنشأة</dt><dd>${esc(x.company_name || "—")}</dd><dt>الجوال</dt><dd dir="ltr">${esc(x.phone)}</dd><dt>البريد</dt><dd dir="ltr">${esc(x.email || "—")}</dd><dt>عدد المستخدمين</dt><dd>${esc(x.users_count || "—")}</dd><dt>ملاحظات</dt><dd class="pre">${esc(x.notes || "—")}</dd></dl>
          <h3 class="mt">الأنظمة التي ستُفعَّل</h3>${productChecks(all, x.products)}
          ${AZ.field({ name: "note", label: "ملاحظة داخلية (اختياري)", max: 500 })}
          <div class="actions mt"><button type="button" class="btn btn--ghost btn--sm" data-reject>رفض الطلب</button><button type="button" class="btn btn--ghost btn--sm" data-cancel>إلغاء الطلب</button></div>`,
        onOpen: (form, close) => {
          const act = async (kind) => { try { await AZ.post(`/api/admin/demo-requests/${x.id}/${kind}`, { note: form.elements.note.value }); close(); AZ.toast(kind === "reject" ? "تم رفض الطلب" : "تم إلغاء الطلب"); AZ.reload(); } catch (err) { AZ.showErrors(form, err); } };
          $("[data-reject]", form).addEventListener("click", () => act("reject"));
          $("[data-cancel]", form).addEventListener("click", () => act("cancel"));
        },
        onSubmit: async (v) => {
          const sel = readChecks(v, all);
          if (!sel.length) throw new AZ.ApiError(422, "اختر نظامًا واحدًا على الأقل");
          const r = await AZ.post(`/api/admin/demo-requests/${x.id}/approve`, { products: sel, note: v.note });
          AZ.reload();
          showCredentials("تم إنشاء الحساب التجريبي", r.credentials);
        },
      });
    });
    await render();
  };

  /* ================= Demo accounts ================= */
  const demos = async (main, _a, params) => {
    await products();
    const state = { status: params.status || "", q: "", page: 1 };
    main.innerHTML = `${head("الحسابات التجريبية", "حساب منفصل لكل عميل — 24 ساعة تبدأ من أول دخول", '<button class="btn btn--primary" data-new>+ حساب تجريبي</button>')}
      <form class="filters">${AZ.field({ name: "status", label: "الحالة", type: "select", options: [["", "الكل"], ...Object.entries(L.acc)], value: state.status })}${AZ.field({ name: "q", label: "بحث (الاسم، المنشأة، اسم المستخدم، الجوال)", type: "search" })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/admin/demos" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "العميل", html: (a) => `<a href="#/demos/${a.id}"><b>${esc(a.customer_name)}</b></a><br><small class="muted">${esc(a.company_name || "")}</small>` },
        { label: "اسم المستخدم", html: (a) => `<code dir="ltr">${esc(a.username)}</code>` },
        { label: "الأنظمة", html: (a) => esc(a.products.map(pname).join("، ") || "—") },
        { label: "الحالة", html: (a) => AZ.badge(L.acc[a.status], L.accTone[a.status]) },
        { label: "أول دخول", html: (a) => esc(a.activated_at ? fmt.dateTime(a.activated_at) : "—") },
        { label: "ينتهي", html: (a) => esc(a.expires_at ? fmt.dateTime(a.expires_at) : "عند أول دخول + 24 ساعة") },
        { label: "متبقي", html: (a) => `<span dir="ltr">${left(a)}</span>` },
      ], r.items, { empty: "لا توجد حسابات." }) + AZ.pager(r.total, r.page, r.size);
    };
    const f = $(".filters", main);
    f.addEventListener("input", () => { Object.assign(state, AZ.formValues(f), { page: 1 }); render().catch(AZ.fail); });
    main.addEventListener("click", (e) => { const p = e.target.closest("[data-page]"); if (p && !p.disabled) { state.page = Number(p.dataset.page); render(); } });
    $("[data-new]", main).addEventListener("click", async () => {
      const all = await products();
      AZ.modal({
        title: "حساب تجريبي جديد", submit: "إنشاء", wide: true,
        body: `<div class="grid2">${AZ.field({ name: "customer_name", label: "اسم العميل", required: true })}${AZ.field({ name: "company_name", label: "المنشأة" })}${AZ.field({ name: "phone", label: "الجوال", type: "tel", dir: "ltr" })}${AZ.field({ name: "email", label: "البريد", type: "email", dir: "ltr" })}</div>
          <h3>الأنظمة</h3><div class="fld" data-field="products">${productChecks(all)}<small class="err" hidden></small></div>`,
        onSubmit: async (v) => {
          const r = await AZ.post("/api/admin/demos", { customer_name: v.customer_name, company_name: v.company_name, phone: v.phone, email: v.email, products: readChecks(v, all) });
          AZ.go(`#/demos/${r.account.id}`);
          showCredentials("تم إنشاء الحساب التجريبي", r.credentials);
        },
      });
    });
    await render();
  };

  const demoView = async (main, [id]) => {
    const [d, all] = await Promise.all([AZ.get(`/api/admin/demos/${id}`), products()]);
    const a = d.account;
    const active = new Set(a.products);
    main.innerHTML = `${head(a.customer_name, `${a.company_name || ""} · ${a.username}`, AZ.badge(L.acc[a.status], L.accTone[a.status]))}
      <div class="cols cols--main">
        <div>
          <section class="card"><h2>بيانات التجربة</h2><dl class="dl">
            <dt>اسم المستخدم</dt><dd><code dir="ltr">${esc(a.username)}</code></dd><dt>البريد</dt><dd dir="ltr">${esc(a.email || "—")}</dd><dt>الجوال</dt><dd dir="ltr">${esc(a.phone || "—")}</dd>
            <dt>أُنشئ</dt><dd>${esc(fmt.dateTime(a.created_at))}</dd><dt>أول دخول</dt><dd>${esc(a.activated_at ? fmt.dateTime(a.activated_at) : "لم يدخل بعد")}</dd>
            <dt>ينتهي</dt><dd>${esc(a.expires_at ? fmt.dateTime(a.expires_at) : "بعد 24 ساعة من أول دخول")}</dd><dt>متبقي</dt><dd dir="ltr">${left(a)}</dd>
            <dt>آخر دخول</dt><dd>${esc(a.last_login_at ? fmt.dateTime(a.last_login_at) : "—")}</dd><dt>جلسات مفتوحة</dt><dd>${d.sessions}</dd>
            ${d.request ? `<dt>الطلب</dt><dd>#${d.request.id} · ${esc(fmt.dateTime(d.request.created_at))}</dd>` : ""}</dl></section>
          <section class="card"><h2>النشاط</h2>${d.activity.length ? `<ul class="timeline">${d.activity.map((x) => `<li><b>${esc(L.action[x.action] || x.action)}</b>${x.user_name ? ` <small class="muted">بواسطة ${esc(x.user_name)}</small>` : ""}<small>${esc(fmt.dateTime(x.created_at))}${x.meta ? ` · <span dir="ltr">${esc(x.meta.slice(0, 120))}</span>` : ""}</small></li>`).join("")}</ul>` : '<p class="muted">لا يوجد نشاط.</p>'}</section>
        </div>
        <aside>
          <section class="card"><h2>الإجراءات</h2><div class="actions">
            ${a.status === "SUSPENDED" ? '<button class="btn btn--primary btn--sm" data-act="activate">تفعيل</button>' : '<button class="btn btn--ghost btn--sm" data-act="suspend">إيقاف</button>'}
            <button class="btn btn--ghost btn--sm" data-act="extend"${a.activated_at ? "" : " disabled"}>تمديد 24 ساعة</button>
            ${d.can_extend_custom ? `<button class="btn btn--ghost btn--sm" data-act="extend-custom"${a.activated_at ? "" : " disabled"}>تمديد بمدة مخصصة</button>` : ""}
            ${a.status !== "EXPIRED" ? '<button class="btn btn--ghost btn--sm" data-act="expire">إنهاء الآن</button>' : ""}
            <button class="btn btn--ghost btn--sm" data-act="reset-password">كلمة مرور جديدة</button>
            <button class="btn btn--ghost btn--sm" data-act="reset">إعادة ضبط البيانات التجريبية</button>
          </div>${a.activated_at ? "" : '<p class="hint">التمديد متاح بعد أول دخول (لم تبدأ مدة التجربة بعد).</p>'}</section>
          <section class="card"><h2>الأنظمة</h2><form data-products>${productChecks(all, [...active])}<button class="btn btn--primary btn--sm mt" type="submit">حفظ الأنظمة</button></form></section>
          <section class="card"><h2>سجل المنح</h2><ul class="timeline">${d.grants.map((g) => `<li><b>${esc(pname(g.product_id))}</b> ${g.revoked_at ? AZ.badge("مسحوب", "err") : AZ.badge("مفعّل", "ok")}<small>منح ${esc(fmt.dateTime(g.granted_at))}${g.granted_by_name ? ` · ${esc(g.granted_by_name)}` : ""}${g.revoked_at ? ` — سُحب ${esc(fmt.dateTime(g.revoked_at))}` : ""}</small></li>`).join("")}</ul></section>
        </aside>
      </div>`;
    const confirmText = { suspend: ["إيقاف الحساب", "سيتم إنهاء جلسات العميل ومنع الدخول حتى إعادة التفعيل."], expire: ["إنهاء التجربة", "تنتهي التجربة فورًا وتُحفظ البيانات."], reset: ["إعادة ضبط البيانات", "تُحذف بيانات العميل التجريبية في الأنظمة وتعود لحالتها الأصلية."], "reset-password": ["كلمة مرور جديدة", "تتوقف كلمة المرور الحالية وتُغلق جلسات العميل."] };
    main.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      try {
        if (act === "extend-custom") {
          return AZ.modal({ title: "تمديد بمدة مخصصة", submit: "تمديد", body: AZ.field({ name: "hours", label: "عدد الساعات", type: "number", min: 1, value: 48, required: true }),
            onSubmit: async (v) => { await AZ.post(`/api/admin/demos/${a.id}/extend`, { hours: Number(v.hours) }); AZ.toast("تم التمديد"); AZ.reload(); } });
        }
        if (confirmText[act] && !(await AZ.confirm(confirmText[act][0], confirmText[act][1], { submit: "تأكيد" }))) return;
        const r = await AZ.post(`/api/admin/demos/${a.id}/${act}`, {});
        if (act === "reset-password") { AZ.reload(); return showCredentials("كلمة المرور الجديدة", r.credentials); }
        AZ.toast("تم"); AZ.reload();
      } catch (err) { AZ.fail(err); }
    });
    const pf = $("[data-products]", main);
    pf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sel = new Set(readChecks(AZ.formValues(pf), all));
      const grant = [...sel].filter((x) => !active.has(x)), revoke = [...active].filter((x) => !sel.has(x));
      if (!grant.length && !revoke.length) return AZ.toast("لا تغييرات");
      try { await AZ.post(`/api/admin/demos/${a.id}/products`, { grant, revoke }); AZ.toast("تم حفظ الأنظمة"); AZ.reload(); } catch (err) { AZ.fail(err); }
    });
  };

  /* ================= Password requests, users, audit ================= */
  const passwordRequests = async (main) => {
    const r = await AZ.get("/api/admin/password-requests");
    main.innerHTML = `${head("طلبات استعادة كلمة المرور", "تحقّق من هوية العميل ثم أنشئ كلمة مرور جديدة من صفحة حسابه")}
      ${AZ.table([{ label: "التاريخ", html: (x) => esc(fmt.dateTime(x.created_at)) }, { label: "اسم المستخدم المُدخل", html: (x) => `<code dir="ltr">${esc(x.username)}</code>` }, { label: "الجوال المُدخل", html: (x) => `<span dir="ltr">${esc(x.phone || "")}</span>` },
        { label: "مطابق لحساب", html: (x) => x.demo_account_id ? `<a href="#/demos/${x.demo_account_id}">${esc(x.customer_name)}</a>` : '<span class="muted">لا يوجد تطابق</span>' },
        { label: "الحالة", html: (x) => x.status === "OPEN" ? AZ.badge("مفتوح", "warn") : AZ.badge("مغلق") }, { label: "", html: (x) => x.status === "OPEN" ? `<button class="btn btn--ghost btn--sm" data-close="${x.id}">إغلاق</button>` : "" }], r.items, { empty: "لا توجد طلبات." })}`;
    main.addEventListener("click", async (e) => { const b = e.target.closest("[data-close]"); if (!b) return; try { await AZ.post(`/api/admin/password-requests/${b.dataset.close}/close`); AZ.reload(); } catch (err) { AZ.fail(err); } });
  };

  const users = async (main) => {
    const r = await AZ.get("/api/users");
    const manage = AZ.can("users.manage");
    main.innerHTML = `${head("فريق Demo Center", "حسابات موظفي AZENK فقط — منفصلة تمامًا عن حسابات العملاء التجريبية", manage ? '<button class="btn btn--primary" data-new>+ مستخدم</button>' : "")}
      ${AZ.table([{ label: "الاسم", key: "name" }, { label: "البريد", html: (u) => `<span dir="ltr">${esc(u.email)}</span>` }, { label: "الدور", html: (u) => esc(L.role[u.role]) }, { label: "الحالة", html: (u) => u.is_active ? AZ.badge("نشط", "ok") : AZ.badge("معطّل", "err") }], r.items)}`;
    const nb = $("[data-new]", main);
    if (nb) nb.addEventListener("click", () => AZ.modal({ title: "مستخدم جديد", submit: "إنشاء", body: `${AZ.field({ name: "name", label: "الاسم", required: true })}${AZ.field({ name: "email", label: "البريد", type: "email", required: true, dir: "ltr" })}${AZ.field({ name: "role", label: "الدور", type: "select", options: r.manageable_roles.map((x) => [x, L.role[x]]) })}`,
      onSubmit: async (v) => { const x = await AZ.post("/api/users", v); AZ.reload(); AZ.showSecret("تم إنشاء المستخدم", `كلمة المرور المؤقتة لـ ${x.user.email}:`, x.temporary_password); } }));
  };

  const auditView = async (main) => {
    const state = { action: "", page: 1 };
    main.innerHTML = `${head("سجل التدقيق", "كل العمليات مسجلة ولا يمكن تعديلها أو حذفها")}<form class="filters">${AZ.field({ name: "action", label: "الإجراء", type: "search", placeholder: "مثال: demo.extended" })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/audit" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([{ label: "الوقت", html: (x) => esc(fmt.dateTime(x.created_at)) }, { label: "المستخدم", html: (x) => esc(x.user_name || "العميل / النظام") },
        { label: "الإجراء", html: (x) => `${esc(L.action[x.action] || "")} <code dir="ltr">${esc(x.action)}</code>` }, { label: "الكيان", html: (x) => esc(x.entity ? `${x.entity} #${x.entity_id ?? ""}` : "—") },
        { label: "تفاصيل", html: (x) => `<small class="muted" dir="ltr">${esc((x.meta || "").slice(0, 140))}</small>` }, { label: "IP", html: (x) => `<small dir="ltr">${esc(x.ip || "")}</small>` }], r.items) + AZ.pager(r.total, r.page, r.size);
    };
    const f = $(".filters", main);
    f.addEventListener("input", () => { Object.assign(state, AZ.formValues(f), { page: 1 }); render().catch(AZ.fail); });
    main.addEventListener("click", (e) => { const p = e.target.closest("[data-page]"); if (p && !p.disabled) { state.page = Number(p.dataset.page); render(); } });
    await render();
  };

  const search = async (q) => {
    const r = await AZ.get("/api/search" + AZ.qs({ q }));
    if (!r.accounts.length && !r.requests.length) return '<p class="pad muted">لا توجد نتائج.</p>';
    return `${r.accounts.length ? `<p class="search-group">الحسابات</p><ul class="search-list">${r.accounts.map((a) => `<li><a href="#/demos/${a.id}"><b>${esc(a.customer_name)}</b><small>${esc(a.username)} · ${esc(L.acc[a.status])}</small></a></li>`).join("")}</ul>` : ""}
      ${r.requests.length ? `<p class="search-group">الطلبات</p><ul class="search-list">${r.requests.map((x) => `<li><a href="#/requests"><b>${esc(x.customer_name)}</b><small>${esc(x.company_name || "")} · ${esc(L.req[x.status])}</small></a></li>`).join("")}</ul>` : ""}`;
  };

  AZ.start({
    app: "democenter",
    title: "AZENK Demo Center",
    tagline: "إدارة التجارب",
    home: "dashboard",
    roleLabels: L.role,
    search,
    searchPlaceholder: "ابحث عن عميل أو اسم مستخدم…",
    nav: [
      { route: "dashboard", label: "لوحة التحكم", icon: "◧", perm: "demos.view" },
      { route: "requests", label: "طلبات Demo", icon: "✉", perm: "requests.manage" },
      { route: "demos", label: "الحسابات التجريبية", icon: "⚇", perm: "demos.view" },
      { route: "password-requests", label: "استعادة كلمات المرور", icon: "⚿", perm: "demos.manage" },
      { route: "users", label: "فريق الإدارة", icon: "☺", perm: "users.view" },
      { route: "audit", label: "سجل التدقيق", icon: "⎙", perm: "audit.view" },
    ],
    routes: { dashboard, requests, demos, "demos/:id": demoView, "password-requests": passwordRequests, users, audit: auditView },
  });
})();
