/* =========================================================
   AZENK Call Center — frontend views
   ========================================================= */
(function () {
  "use strict";
  const AZ = window.AZ;
  const { esc, fmt, $, $$ } = AZ;

  const L = {
    role: { SUPER_ADMIN: "مدير المنصة", ADMIN: "مدير النظام", SUPERVISOR: "مشرف", AGENT: "موظف خدمة عملاء" },
    status: { open: "مفتوحة", in_progress: "قيد المعالجة", pending: "بانتظار العميل", resolved: "تم الحل", closed: "مغلقة" },
    statusTone: { open: "info", in_progress: "gold", pending: "warn", resolved: "ok", closed: "" },
    priority: { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" },
    priorityTone: { low: "", medium: "info", high: "warn", urgent: "err" },
    category: { general: "عام", inquiry: "استفسار", complaint: "شكوى", technical: "دعم فني", billing: "فواتير ومدفوعات", sales: "مبيعات" },
    dir: { inbound: "واردة", outbound: "صادرة" },
    callStatus: { answered: "تم الرد", missed: "فائتة", no_answer: "لم يتم الرد", busy: "مشغول", voicemail: "بريد صوتي" },
    callTone: { answered: "ok", missed: "err", no_answer: "warn", busy: "warn", voicemail: "info" },
    taskStatus: { open: "مفتوحة", done: "منجزة", cancelled: "ملغاة" },
    taskType: { followup: "متابعة", task: "مهمة" },
    field: { status: "الحالة", priority: "الأولوية", category: "التصنيف", due_at: "الاستحقاق", assignee_id: "المسؤول" },
  };
  const opts = (map, withAll) => [...(withAll ? [["", withAll]] : []), ...Object.entries(map)];
  const badge = (map, tones, v) => AZ.badge(map[v] || v, tones[v]);
  let directory = null;
  const staff = async () => (directory ||= (await AZ.get("/api/users/directory")).items);
  const staffOpts = async (first) => [...(first ? [["", first]] : []), ...(await staff()).filter((u) => u.role !== "SUPER_ADMIN").map((u) => [u.id, `${u.name} — ${L.role[u.role] || u.role}`])];

  const head = (title, sub, actions = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
  const overdue = (iso, done) => iso && !done && Date.parse(iso) < Date.now();

  /* Re-render a list view whenever its filter form changes. */
  const bindFilters = (root, state, render) => {
    const f = $(".filters", root);
    if (f) {
      let timer;
      const apply = () => { Object.assign(state, AZ.formValues(f), { page: 1 }); render(); };
      f.addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(apply, e.target.type === "search" ? 300 : 0); });
      f.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
    }
    root.addEventListener("click", (e) => { const p = e.target.closest("[data-page]"); if (p && !p.disabled) { state.page = Number(p.dataset.page); render(); } });
  };

  /* ================= Dashboard ================= */
  const dashboard = async (main) => {
    const d = await AZ.get("/api/dashboard");
    const org = d.scope === "org";
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const day = AZ.addDays(d.today, -i);
      const row = d.week.find((w) => w.day === day) || { total: 0, answered: 0 };
      week.push({ label: day.slice(5), value: row.total, value2: row.answered });
    }
    main.innerHTML = `${head("لوحة التحكم", org ? "نظرة عامة على المنشأة اليوم" : "نشاطك اليوم", `<a class="btn btn--primary" href="#/calls/new">📞 تسجيل مكالمة</a><button class="btn btn--ghost" data-new-ticket>+ تذكرة</button>`)}
      <div class="stats">
        ${AZ.stat("مكالمات اليوم", fmt.num(d.calls.total), { sub: `واردة ${d.calls.inbound} · صادرة ${d.calls.outbound}`, href: "#/calls" })}
        ${AZ.stat("تم الرد", fmt.num(d.calls.answered), { tone: "ok", sub: `متوسط المدة ${fmt.duration(d.calls.avg_duration)}` })}
        ${AZ.stat("فائتة / بلا رد", fmt.num(d.calls.missed), { tone: d.calls.missed ? "err" : "" })}
        ${AZ.stat("تذاكر مفتوحة", fmt.num(d.tickets.open), { href: "#/tickets?status=active", sub: `عاجلة ${d.tickets.urgent}` })}
        ${AZ.stat("تذاكر متأخرة", fmt.num(d.tickets.overdue), { tone: d.tickets.overdue ? "err" : "", href: "#/tickets?overdue=1" })}
        ${org ? AZ.stat("بدون مسؤول", fmt.num(d.tickets.unassigned), { tone: d.tickets.unassigned ? "warn" : "", href: "#/tickets?assignee=none&status=active" }) : AZ.stat("تم حلها اليوم", fmt.num(d.tickets.resolved_today), { tone: "ok" })}
        ${AZ.stat("متابعاتي اليوم", fmt.num(d.tasks.due_today), { href: "#/tasks?due=today" })}
        ${AZ.stat("متابعات متأخرة", fmt.num(d.tasks.overdue), { tone: d.tasks.overdue ? "err" : "", href: "#/tasks?due=overdue" })}
      </div>
      <div class="cols cols--main">
        <section class="card"><div class="card__head"><h2>المكالمات آخر 7 أيام</h2></div>
          ${AZ.bars(week, { legend: '<span class="legend-dot"></span>الإجمالي<span class="legend-dot legend-dot--2"></span>تم الرد' })}</section>
        <section class="card"><div class="card__head"><h2>متابعاتي القادمة</h2><a href="#/tasks">الكل</a></div>
          ${d.my_tasks.length ? `<ul class="timeline">${d.my_tasks.map((t) => `<li><b>${esc(t.title)}</b><small class="${overdue(t.due_at) ? "badge badge--err" : ""}">${esc(fmt.dateTime(t.due_at))}</small>${t.customer_name ? `<small>${esc(t.customer_name)}</small>` : ""}</li>`).join("")}</ul>` : '<div class="empty">لا توجد متابعات مفتوحة.</div>'}</section>
      </div>
      <section class="card"><div class="card__head"><h2>تذاكر تحتاج انتباهًا</h2><a href="#/tickets?status=active&sort=priority">كل التذاكر المفتوحة</a></div>
        ${AZ.table([
          { label: "رقم", html: (t) => `<a href="#/tickets/${t.id}">#${t.number}</a>` },
          { label: "الموضوع", html: (t) => `<a href="#/tickets/${t.id}">${esc(t.subject)}</a>` },
          { label: "العميل", key: "customer_name" },
          { label: "الأولوية", html: (t) => badge(L.priority, L.priorityTone, t.priority) },
          { label: "الحالة", html: (t) => badge(L.status, L.statusTone, t.status) },
          { label: "المسؤول", html: (t) => esc(t.assignee_name || "—") },
        ], d.recent_tickets, { empty: "لا توجد تذاكر مفتوحة." })}</section>
      ${d.agents ? `<section class="card"><div class="card__head"><h2>أداء الفريق</h2>${AZ.can("reports.view") ? '<a href="#/reports">التقارير</a>' : ""}</div>
        ${AZ.table([{ label: "الموظف", key: "name" }, { label: "الدور", html: (u) => esc(L.role[u.role]) }, { label: "مكالمات اليوم", key: "calls_today", cls: "num" }, { label: "تذاكر مفتوحة", key: "open_tickets", cls: "num" }, { label: "حُلّت (7 أيام)", key: "resolved_7d", cls: "num" }], d.agents, { empty: "لا يوجد موظفون." })}</section>` : ""}`;
    $("[data-new-ticket]", main).addEventListener("click", () => ticketDialog());
  };

  /* ================= Customers ================= */
  const customerForm = (c = {}) => `<div class="grid2">
    ${AZ.field({ name: "name", label: "اسم العميل", required: true, value: c.name, max: 120 })}
    ${AZ.field({ name: "phone", label: "رقم الجوال", required: true, value: c.phone, dir: "ltr", type: "tel", placeholder: "05XXXXXXXX" })}
    ${AZ.field({ name: "email", label: "البريد الإلكتروني", type: "email", value: c.email, dir: "ltr" })}
    ${AZ.field({ name: "company", label: "الجهة / الشركة", value: c.company, max: 120 })}
    ${AZ.field({ name: "city", label: "المدينة", value: c.city, max: 80 })}
    ${AZ.field({ name: "notes", label: "ملاحظات", type: "textarea", value: c.notes, rows: 3, max: 2000, full: true })}</div>`;

  const customerDialog = (c, onDone) => AZ.modal({
    title: c && c.id ? "تعديل بيانات العميل" : "عميل جديد", submit: "حفظ", wide: true, body: customerForm(c || {}),
    onSubmit: async (v) => {
      const edit = !!(c && c.id);
      const r = edit ? await AZ.patch(`/api/customers/${c.id}`, v) : await AZ.post("/api/customers", v);
      AZ.toast(edit ? "تم حفظ التعديلات" : "تمت إضافة العميل");
      if (onDone) onDone(r.customer); else AZ.go(`#/customers/${r.customer.id}`);
    },
  });

  const customers = async (main, _a, params) => {
    const state = { q: params.q || "", page: 1 };
    main.innerHTML = `${head("العملاء", "سجل العملاء وتاريخ تواصلهم", AZ.can("customers.manage") ? '<button class="btn btn--primary" data-new>+ عميل جديد</button>' : "")}
      <form class="filters" role="search">${AZ.field({ name: "q", label: "بحث بالاسم أو الجوال أو البريد أو الجهة", type: "search", value: state.q })}</form><div data-list></div>`;
    $(".filters .fld", main).classList.add("fld--q");
    const render = async () => {
      const r = await AZ.get("/api/customers" + AZ.qs({ q: state.q, page: state.page }));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "العميل", html: (c) => `<a href="#/customers/${c.id}">${esc(c.name)}</a>${c.company ? `<br><small class="muted">${esc(c.company)}</small>` : ""}` },
        { label: "الجوال", html: (c) => `<span dir="ltr">${esc(c.phone)}</span>` },
        { label: "المدينة", html: (c) => esc(c.city || "—") },
        { label: "تذاكر مفتوحة", key: "open_tickets", cls: "num" },
        { label: "آخر مكالمة", html: (c) => esc(c.last_call_at ? fmt.rel(c.last_call_at) : "—") },
      ], r.items, { empty: state.q ? "لا توجد نتائج مطابقة." : "لا يوجد عملاء بعد." }) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    const nb = $("[data-new]", main); if (nb) nb.addEventListener("click", () => customerDialog());
    await render();
  };

  const customerView = async (main, [id]) => {
    const d = await AZ.get(`/api/customers/${id}`);
    const c = d.customer;
    main.innerHTML = `${head(c.name, c.company || "", `<a class="btn btn--primary" href="#/calls/new?customer=${c.id}">📞 تسجيل مكالمة</a>
        <button class="btn btn--ghost" data-ticket>+ تذكرة</button><button class="btn btn--ghost" data-task>+ متابعة</button>
        ${AZ.can("customers.manage") ? '<button class="btn btn--ghost" data-edit>تعديل</button>' : ""}${AZ.can("customers.delete") ? '<button class="btn btn--ghost" data-del>حذف</button>' : ""}`)}
      <div class="cols cols--main">
        <div>
          <section class="card"><div class="card__head"><h2>التذاكر</h2></div>${AZ.table([
            { label: "رقم", html: (t) => `<a href="#/tickets/${t.id}">#${t.number}</a>` }, { label: "الموضوع", html: (t) => `<a href="#/tickets/${t.id}">${esc(t.subject)}</a>` },
            { label: "الحالة", html: (t) => badge(L.status, L.statusTone, t.status) }, { label: "الأولوية", html: (t) => badge(L.priority, L.priorityTone, t.priority) },
            { label: "التاريخ", html: (t) => esc(fmt.date(t.created_at)) }], d.tickets, { empty: "لا توجد تذاكر لهذا العميل." })}</section>
          <section class="card"><div class="card__head"><h2>سجل المكالمات</h2></div>${callTable(d.calls, { customer: false })}</section>
        </div>
        <div>
          <section class="card"><h2>بيانات العميل</h2><dl class="dl">
            <dt>الجوال</dt><dd dir="ltr">${esc(c.phone)}</dd><dt>البريد</dt><dd dir="ltr">${esc(c.email || "—")}</dd>
            <dt>المدينة</dt><dd>${esc(c.city || "—")}</dd><dt>أُضيف</dt><dd>${esc(fmt.date(c.created_at))}</dd></dl>
            ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ""}</section>
          <section class="card"><h2>المتابعات</h2>${d.tasks.length ? `<ul class="timeline">${d.tasks.map((t) => `<li><b>${esc(t.title)}</b> ${badge(L.taskStatus, { done: "ok", cancelled: "", open: overdue(t.due_at) ? "err" : "info" }, t.status)}<small>${esc(fmt.dateTime(t.due_at))} · ${esc(t.assignee_name)}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد متابعات.</div>'}</section>
        </div>
      </div>`;
    const on = (sel, fn) => { const b = $(sel, main); if (b) b.addEventListener("click", fn); };
    on("[data-edit]", () => customerDialog(c, () => AZ.reload()));
    on("[data-ticket]", () => ticketDialog({ customer: c }));
    on("[data-task]", () => taskDialog({ customer: c, onDone: () => AZ.reload() }));
    on("[data-del]", async () => {
      if (!(await AZ.confirm("حذف العميل", `حذف «${c.name}» نهائيًا؟ لا يمكن حذف عميل لديه سجل مكالمات أو تذاكر.`, { submit: "حذف" }))) return;
      try { await AZ.del(`/api/customers/${c.id}`); AZ.toast("تم حذف العميل"); AZ.go("#/customers"); } catch (e) { AZ.fail(e); }
    });
  };

  /* ================= Calls ================= */
  const callTable = (rows, { customer = true } = {}) => AZ.table([
    { label: "الوقت", html: (k) => esc(fmt.dateTime(k.started_at)) },
    ...(customer ? [{ label: "العميل", html: (k) => `<a href="#/customers/${k.customer_id}">${esc(k.customer_name)}</a><br><small class="muted" dir="ltr">${esc(k.customer_phone)}</small>` }] : []),
    { label: "الاتجاه", html: (k) => esc(L.dir[k.direction]) },
    { label: "الحالة", html: (k) => badge(L.callStatus, L.callTone, k.status) },
    { label: "المدة", html: (k) => `<span dir="ltr">${fmt.duration(k.duration_sec)}</span>`, cls: "num" },
    { label: "الموظف", html: (k) => esc(k.agent_name) },
    { label: "النتيجة / ملاحظات", html: (k) => `${k.outcome ? `<b>${esc(k.outcome)}</b><br>` : ""}<small class="muted">${esc((k.notes || "").slice(0, 140) || "—")}</small>${k.ticket_number ? `<br><a href="#/tickets/${k.ticket_id}">#${k.ticket_number}</a>` : ""}` },
  ], rows, { empty: "لا توجد مكالمات." });

  const calls = async (main, _a, params) => {
    const all = AZ.can("calls.view_all");
    const state = { q: "", direction: "", status: "", agent_id: "", from: params.from || "", to: params.to || "", page: 1 };
    main.innerHTML = `${head("المكالمات", all ? "كل مكالمات المنشأة" : "مكالماتك المسجلة", '<a class="btn btn--primary" href="#/calls/new">📞 تسجيل مكالمة</a>')}
      <p class="note">تُسجَّل المكالمات من داخل النظام (يدويًا أو بمؤقت المكالمة). لا يوجد ربط مع مزود اتصال حاليًا.</p>
      <form class="filters">${AZ.field({ name: "q", label: "بحث", type: "search" })}
        ${AZ.field({ name: "direction", label: "الاتجاه", type: "select", options: opts(L.dir, "الكل") })}
        ${AZ.field({ name: "status", label: "الحالة", type: "select", options: opts(L.callStatus, "الكل") })}
        ${all ? AZ.field({ name: "agent_id", label: "الموظف", type: "select", options: await staffOpts("الكل") }) : ""}
        ${AZ.field({ name: "from", label: "من", type: "date", value: state.from })}${AZ.field({ name: "to", label: "إلى", type: "date", value: state.to })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/calls" + AZ.qs(state));
      $("[data-list]", main).innerHTML = callTable(r.items) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    await render();
  };

  /* Live call console: find/create the customer, run a timer, log outcome. */
  const callNew = async (main, _a, params) => {
    let customer = params.customer ? (await AZ.get(`/api/customers/${params.customer}`)).customer : null;
    let started = null, timer = null, elapsed = 0;
    const render = () => {
      main.innerHTML = `${head("تسجيل مكالمة", "ابحث عن العميل برقم الجوال، شغّل المؤقت أثناء المكالمة، ثم احفظ النتيجة.")}
        <div class="cols cols--main">
          <form class="card" data-call novalidate>
            <h2>1. العميل</h2>
            ${customer ? `<div class="note"><b>${esc(customer.name)}</b> · <span dir="ltr">${esc(customer.phone)}</span> <button type="button" class="link" data-change>تغيير</button></div>`
              : `<div class="grid2">${AZ.field({ name: "lookup", label: "رقم جوال العميل", type: "tel", dir: "ltr", placeholder: "05XXXXXXXX" })}</div>
                 <div class="actions"><button type="button" class="btn btn--ghost" data-find>بحث</button>${AZ.can("customers.manage") ? '<button type="button" class="btn btn--ghost" data-newc>عميل جديد</button>' : ""}</div><div data-found></div>`}
            <h2 class="mt">2. المكالمة</h2>
            <div class="grid2">${AZ.field({ name: "direction", label: "الاتجاه", type: "select", options: opts(L.dir), value: "inbound" })}
              ${AZ.field({ name: "status", label: "الحالة", type: "select", options: opts(L.callStatus), value: "answered" })}
              ${AZ.field({ name: "duration_min", label: "المدة (دقائق) — أو استخدم المؤقت", type: "number", min: 0, step: "0.01", value: elapsed ? (elapsed / 60).toFixed(2) : "" })}
              ${AZ.field({ name: "outcome", label: "النتيجة", max: 200, placeholder: "مثال: تم حل الاستفسار" })}
              ${AZ.field({ name: "notes", label: "ملاحظات المكالمة", type: "textarea", rows: 4, max: 4000, full: true })}</div>
            <h2>3. متابعة (اختياري)</h2>
            <div class="grid2">${AZ.field({ name: "followup_title", label: "عنوان المتابعة", max: 200, placeholder: "مثال: الاتصال بالعميل لتأكيد الحل" })}
              ${AZ.field({ name: "followup_due", label: "موعد المتابعة", type: "datetime-local" })}</div>
            <p class="form-err" role="alert" hidden></p>
            <button class="btn btn--primary" type="submit"${customer ? "" : " disabled"}>حفظ المكالمة</button>
          </form>
          <aside class="card"><h2>مؤقت المكالمة</h2><p class="timer" data-timer>${fmt.duration(elapsed)}</p>
            <div class="actions"><button type="button" class="btn btn--primary btn--block" data-start>${started ? "إيقاف المؤقت" : elapsed ? "استئناف" : "بدء المكالمة"}</button></div>
            <p class="hint">المؤقت يحسب المدة في المتصفح ويملأ حقل المدة تلقائيًا عند الإيقاف.</p></aside>
        </div>`;
      bind();
    };
    const tick = () => { const t = $("[data-timer]", main); if (t) t.textContent = fmt.duration(elapsed + (started ? (Date.now() - started) / 1000 : 0)); };
    const bind = () => {
      const form = $("[data-call]", main);
      const on = (sel, fn) => { const b = $(sel, main); if (b) b.addEventListener("click", fn); };
      on("[data-change]", () => { customer = null; render(); });
      on("[data-newc]", () => customerDialog(null, (c) => { customer = c; render(); }));
      on("[data-find]", async () => {
        const phone = $("input[name=lookup]", form).value.trim();
        const box = $("[data-found]", main);
        if (!phone) { box.innerHTML = '<p class="err-text">أدخل رقم الجوال.</p>'; return; }
        try {
          const r = await AZ.get("/api/customers/lookup" + AZ.qs({ phone }));
          if (r.customer) { customer = r.customer; render(); }
          else {
            const s = await AZ.get("/api/customers" + AZ.qs({ q: phone, size: 5 }));
            box.innerHTML = s.items.length ? `<ul class="search-list">${s.items.map((c) => `<li><a href="#" data-pick="${c.id}">${esc(c.name)} <small dir="ltr">${esc(c.phone)}</small></a></li>`).join("")}</ul>`
              : `<p class="note">لا يوجد عميل بهذا الرقم.${AZ.can("customers.manage") ? ' <button type="button" class="link" data-newc2>إضافته كعميل جديد</button>' : ""}</p>`;
            box.addEventListener("click", async (e) => {
              const p = e.target.closest("[data-pick]");
              if (p) { e.preventDefault(); customer = s.items.find((x) => String(x.id) === p.dataset.pick); render(); }
              if (e.target.closest("[data-newc2]")) customerDialog({ phone }, (c) => { customer = c; render(); });
            }, { once: true });
          }
        } catch (e) { AZ.fail(e); }
      });
      on("[data-start]", () => {
        if (started) { elapsed += (Date.now() - started) / 1000; started = null; clearInterval(timer); const f = $("input[name=duration_min]", form); f.value = f.dataset.auto = (elapsed / 60).toFixed(2); }
        else { started = Date.now(); timer = setInterval(tick, 500); }
        $("[data-start]", main).textContent = started ? "إيقاف المؤقت" : "استئناف";
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!customer) return;
        const v = AZ.formValues(form);
        if (started) { elapsed += (Date.now() - started) / 1000; started = null; clearInterval(timer); }
        const auto = $("input[name=duration_min]", form).dataset.auto;
        const dur = v.duration_min !== "" && v.duration_min !== auto ? Math.round(Number(v.duration_min) * 60) : Math.round(elapsed);
        const body = { customer_id: customer.id, direction: v.direction, status: v.status, duration_sec: Number.isFinite(dur) ? dur : 0, outcome: v.outcome, notes: v.notes };
        if (v.followup_title || v.followup_due) {
          if (!v.followup_title || !v.followup_due) { AZ.showErrors(form, new AZ.ApiError(422, "أكمل بيانات المتابعة", { [v.followup_title ? "followup_due" : "followup_title"]: "مطلوب عند إضافة متابعة" })); return; }
          body.followup = { title: v.followup_title, due_at: AZ.fromLocalInput(v.followup_due) };
        }
        const btn = $("button[type=submit]", form);
        btn.disabled = true;
        try {
          AZ.showErrors(form, null);
          await AZ.post("/api/calls", body);
          AZ.toast(body.followup ? "تم حفظ المكالمة وإنشاء المتابعة" : "تم حفظ المكالمة");
          AZ.go(`#/customers/${customer.id}`);
        } catch (err) {
          if (err.fields && err.fields.duration_sec) err.fields.duration_min = err.fields.duration_sec;
          AZ.showErrors(form, err);
        } finally { btn.disabled = false; }
      });
    };
    render();
    window.addEventListener("hashchange", () => clearInterval(timer), { once: true });
  };

  /* ================= Tickets ================= */
  const ticketDialog = async ({ customer } = {}) => {
    const canAssign = AZ.can("tickets.assign");
    const body = `${customer ? `<p class="note">العميل: <b>${esc(customer.name)}</b></p>` : `<div class="fld" data-field="customer_id"><label for="tk-cust">العميل <em>*</em></label>
        <input id="tk-cust" type="search" placeholder="ابحث بالاسم أو الجوال…" autocomplete="off" data-cust-q><input type="hidden" name="customer_id"><div class="search-list" data-cust-res></div><small class="err" hidden></small></div>`}
      ${AZ.field({ name: "subject", label: "الموضوع", required: true, max: 200 })}
      <div class="grid2">${AZ.field({ name: "category", label: "التصنيف", type: "select", options: opts(L.category), value: "general" })}
        ${AZ.field({ name: "priority", label: "الأولوية", type: "select", options: opts(L.priority), value: "medium" })}
        ${AZ.field({ name: "due_at", label: "موعد الاستحقاق", type: "datetime-local" })}
        ${canAssign ? AZ.field({ name: "assignee_id", label: "المسؤول", type: "select", options: await staffOpts("بدون مسؤول (لاحقًا)") }) : ""}</div>
      ${AZ.field({ name: "description", label: "الوصف", type: "textarea", rows: 4, max: 5000 })}`;
    AZ.modal({
      title: "تذكرة جديدة", submit: "إنشاء التذكرة", wide: true, body,
      onOpen: (form) => {
        const q = $("[data-cust-q]", form);
        if (!q) return;
        let timer;
        q.addEventListener("input", () => {
          clearTimeout(timer);
          $("input[name=customer_id]", form).value = "";
          timer = setTimeout(async () => {
            const res = $("[data-cust-res]", form);
            if (q.value.trim().length < 2) { res.innerHTML = ""; return; }
            const r = await AZ.get("/api/customers" + AZ.qs({ q: q.value.trim(), size: 6 })).catch(() => ({ items: [] }));
            res.innerHTML = r.items.length ? `<ul class="search-list">${r.items.map((c) => `<li><a href="#" data-cid="${c.id}" data-cname="${esc(c.name)}">${esc(c.name)} <small dir="ltr">${esc(c.phone)}</small></a></li>`).join("")}</ul>` : '<p class="hint">لا توجد نتائج. أضف العميل من صفحة العملاء أولًا.</p>';
          }, 250);
        });
        $("[data-cust-res]", form).addEventListener("click", (e) => {
          const a = e.target.closest("[data-cid]");
          if (!a) return;
          e.preventDefault();
          $("input[name=customer_id]", form).value = a.dataset.cid;
          q.value = a.dataset.cname;
          $("[data-cust-res]", form).innerHTML = "";
        });
      },
      onSubmit: async (v) => {
        const body = { customer_id: customer ? customer.id : Number(v.customer_id) || undefined, subject: v.subject, category: v.category, priority: v.priority, description: v.description, due_at: AZ.fromLocalInput(v.due_at) || undefined };
        if (canAssign) body.assignee_id = v.assignee_id ? Number(v.assignee_id) : null;
        const r = await AZ.post("/api/tickets", body);
        AZ.toast(`تم إنشاء التذكرة #${r.ticket.number}`);
        AZ.go(`#/tickets/${r.ticket.id}`);
      },
    });
  };

  const tickets = async (main, _a, params) => {
    const all = AZ.can("tickets.view_all");
    const state = { q: "", status: params.status || "", priority: "", category: "", assignee: params.assignee || "", overdue: params.overdue || "", sort: params.sort || "", page: 1 };
    const assignees = all ? [["", "الكل"], ["me", "المسندة إليّ"], ["none", "بدون مسؤول"], ...(await staffOpts()).map(([id, n]) => [id, n])] : [["", "تذاكري (المسندة أو التي أنشأتها)"], ["me", "المسندة إليّ فقط"]];
    main.innerHTML = `${head("التذاكر", all ? "كل تذاكر المنشأة" : "التذاكر المسندة إليك أو التي أنشأتها", '<button class="btn btn--primary" data-new>+ تذكرة جديدة</button>')}
      <form class="filters">${AZ.field({ name: "q", label: "بحث (رقم أو موضوع أو عميل)", type: "search" })}
        ${AZ.field({ name: "status", label: "الحالة", type: "select", options: [["", "الكل"], ["active", "المفتوحة (كل الحالات النشطة)"], ...Object.entries(L.status)], value: state.status })}
        ${AZ.field({ name: "priority", label: "الأولوية", type: "select", options: opts(L.priority, "الكل") })}
        ${AZ.field({ name: "category", label: "التصنيف", type: "select", options: opts(L.category, "الكل") })}
        ${AZ.field({ name: "assignee", label: "المسؤول", type: "select", options: assignees, value: state.assignee })}
        ${AZ.field({ name: "sort", label: "الترتيب", type: "select", options: [["", "آخر تحديث"], ["priority", "الأولوية"], ["due", "الاستحقاق"]], value: state.sort })}
        ${AZ.field({ name: "overdue", label: "التأخير", type: "select", options: [["", "الكل"], ["1", "المتأخرة فقط"]], value: state.overdue })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/tickets" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "رقم", html: (t) => `<a href="#/tickets/${t.id}">#${t.number}</a>` },
        { label: "الموضوع", html: (t) => `<a href="#/tickets/${t.id}">${esc(t.subject)}</a><br><small class="muted">${esc(L.category[t.category])}</small>` },
        { label: "العميل", html: (t) => `${esc(t.customer_name)}<br><small class="muted" dir="ltr">${esc(t.customer_phone)}</small>` },
        { label: "الأولوية", html: (t) => badge(L.priority, L.priorityTone, t.priority) },
        { label: "الحالة", html: (t) => badge(L.status, L.statusTone, t.status) },
        { label: "المسؤول", html: (t) => esc(t.assignee_name || "—") },
        { label: "الاستحقاق", html: (t) => t.due_at ? `<span class="${overdue(t.due_at, ["resolved", "closed"].includes(t.status)) ? "badge badge--err" : ""}">${esc(fmt.dateTime(t.due_at))}</span>` : "—" },
      ], r.items, { empty: "لا توجد تذاكر مطابقة." }) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    $("[data-new]", main).addEventListener("click", () => ticketDialog());
    await render();
  };

  const ticketView = async (main, [id]) => {
    const d = await AZ.get(`/api/tickets/${id}`);
    const t = d.ticket;
    const fv = (f, v) => f === "status" ? L.status[v] : f === "priority" ? L.priority[v] : f === "category" ? L.category[v] : f === "due_at" ? fmt.dateTime(v) : f === "assignee_id" ? ((directory || []).find((u) => String(u.id) === String(v)) || {}).name || (v ? "#" + v : "—") : v;
    await staff().catch(() => {});
    const timeline = [
      ...d.comments.map((c) => ({ at: c.created_at, html: `<b>${esc(c.user_name)}</b> أضاف ملاحظة<small>${esc(fmt.dateTime(c.created_at))}</small><p>${esc(c.body)}</p>` })),
      ...d.history.map((h) => ({ at: h.created_at, html: `<b>${esc(h.user_name)}</b> غيّر ${esc(L.field[h.field] || h.field)}: ${esc(fv(h.field, h.from_value) || "—")} ← ${esc(fv(h.field, h.to_value) || "—")}<small>${esc(fmt.dateTime(h.created_at))}</small>` })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    main.innerHTML = `${head(`#${t.number} · ${t.subject}`, `${L.category[t.category]} · أنشأها ${t.creator_name} ${fmt.rel(t.created_at)}`, `<a class="btn btn--ghost" href="#/calls/new?customer=${t.customer_id}">📞 اتصال بالعميل</a><button class="btn btn--ghost" data-task>+ متابعة</button>`)}
      <div class="cols cols--main">
        <div>
          ${t.description ? `<section class="card"><h2>الوصف</h2><p class="pre">${esc(t.description)}</p></section>` : ""}
          <section class="card"><h2>السجل والملاحظات</h2>${timeline.length ? `<ul class="timeline">${timeline.map((x) => `<li>${x.html}</li>`).join("")}</ul>` : '<p class="muted">لا يوجد نشاط بعد.</p>'}
            ${AZ.can("tickets.comment") ? `<form class="mt" data-comment novalidate>${AZ.field({ name: "body", label: "ملاحظة داخلية", type: "textarea", rows: 3, max: 4000, required: true })}<p class="form-err" hidden></p><button class="btn btn--primary btn--sm" type="submit">إضافة الملاحظة</button></form>` : ""}</section>
          <section class="card"><h2>المكالمات المرتبطة</h2>${callTable(d.calls, { customer: false })}</section>
        </div>
        <div>
          <section class="card"><h2>التفاصيل</h2>
            ${d.can_edit ? `<form data-edit novalidate>
              ${AZ.field({ name: "status", label: "الحالة", type: "select", options: opts(L.status), value: t.status })}
              ${AZ.field({ name: "priority", label: "الأولوية", type: "select", options: opts(L.priority), value: t.priority })}
              ${AZ.field({ name: "category", label: "التصنيف", type: "select", options: opts(L.category), value: t.category })}
              ${AZ.field({ name: "due_at", label: "الاستحقاق", type: "datetime-local", value: AZ.toLocalInput(t.due_at) })}
              <p class="form-err" hidden></p><button class="btn btn--primary btn--sm" type="submit">حفظ</button></form>`
              : `<dl class="dl"><dt>الحالة</dt><dd>${badge(L.status, L.statusTone, t.status)}</dd><dt>الأولوية</dt><dd>${badge(L.priority, L.priorityTone, t.priority)}</dd><dt>الاستحقاق</dt><dd>${esc(fmt.dateTime(t.due_at))}</dd></dl>`}
            <hr class="sep"><dl class="dl"><dt>العميل</dt><dd><a href="#/customers/${t.customer_id}">${esc(t.customer_name)}</a><br><small dir="ltr">${esc(t.customer_phone)}</small></dd>
              <dt>المسؤول</dt><dd>${esc(t.assignee_name || "بدون مسؤول")}</dd>${t.resolved_at ? `<dt>تاريخ الحل</dt><dd>${esc(fmt.dateTime(t.resolved_at))}</dd>` : ""}</dl>
            ${d.can_assign ? `<form class="mt" data-assign>${AZ.field({ name: "assignee_id", label: "إسناد إلى", type: "select", options: await staffOpts("بدون مسؤول"), value: t.assignee_id || "" })}<button class="btn btn--ghost btn--sm" type="submit">إسناد</button></form>` : ""}</section>
          <section class="card"><h2>المتابعات</h2>${d.tasks.length ? `<ul class="timeline">${d.tasks.map((k) => `<li><b>${esc(k.title)}</b> ${badge(L.taskStatus, { open: "info", done: "ok" }, k.status)}<small>${esc(fmt.dateTime(k.due_at))} · ${esc(k.assignee_name)}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد متابعات.</div>'}</section>
        </div>
      </div>`;
    const ef = $("[data-edit]", main);
    if (ef) ef.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = AZ.formValues(ef);
      try { AZ.showErrors(ef, null); await AZ.patch(`/api/tickets/${t.id}`, { status: v.status, priority: v.priority, category: v.category, due_at: AZ.fromLocalInput(v.due_at) }); AZ.toast("تم حفظ التذكرة"); AZ.reload(); } catch (err) { AZ.showErrors(ef, err); }
    });
    const af = $("[data-assign]", main);
    if (af) af.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = AZ.formValues(af);
      try { await AZ.post(`/api/tickets/${t.id}/assign`, { assignee_id: v.assignee_id ? Number(v.assignee_id) : null }); AZ.toast("تم الإسناد"); AZ.reload(); } catch (err) { AZ.fail(err); }
    });
    const cf = $("[data-comment]", main);
    if (cf) cf.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { AZ.showErrors(cf, null); await AZ.post(`/api/tickets/${t.id}/comments`, { body: AZ.formValues(cf).body }); AZ.toast("تمت إضافة الملاحظة"); AZ.reload(); } catch (err) { AZ.showErrors(cf, err); }
    });
    $("[data-task]", main).addEventListener("click", () => taskDialog({ ticket: t, onDone: () => AZ.reload() }));
  };

  /* ================= Tasks ================= */
  const taskDialog = async ({ task, customer, ticket, onDone } = {}) => {
    const canAssign = AZ.can("tasks.assign");
    const due = task ? task.due_at : new Date(Date.now() + 86400000).toISOString();
    AZ.modal({
      title: task ? "تعديل المتابعة" : "متابعة / مهمة جديدة", submit: "حفظ", wide: true,
      body: `${customer || ticket ? `<p class="note">${customer ? `العميل: <b>${esc(customer.name)}</b>` : ""}${ticket ? ` التذكرة: <b>#${ticket.number}</b>` : ""}</p>` : ""}
        ${AZ.field({ name: "title", label: "العنوان", required: true, value: task && task.title, max: 200 })}
        <div class="grid2">${task ? "" : AZ.field({ name: "type", label: "النوع", type: "select", options: opts(L.taskType), value: "followup" })}
          ${AZ.field({ name: "priority", label: "الأولوية", type: "select", options: opts(L.priority), value: task ? task.priority : "medium" })}
          ${AZ.field({ name: "due_at", label: "الموعد", type: "datetime-local", required: true, value: AZ.toLocalInput(due) })}
          ${canAssign ? AZ.field({ name: "assignee_id", label: "المسؤول", type: "select", options: await staffOpts(), value: task ? task.assignee_id : AZ.state.user.id }) : ""}</div>
        ${AZ.field({ name: "description", label: "التفاصيل", type: "textarea", rows: 3, max: 2000, value: task && task.description })}`,
      onSubmit: async (v) => {
        const body = { title: v.title, priority: v.priority, due_at: AZ.fromLocalInput(v.due_at), description: v.description };
        if (!body.due_at) throw new AZ.ApiError(422, "بيانات غير صالحة", { due_at: "الموعد مطلوب" });
        if (canAssign && v.assignee_id) body.assignee_id = Number(v.assignee_id);
        if (task) await AZ.patch(`/api/tasks/${task.id}`, body);
        else await AZ.post("/api/tasks", { ...body, type: v.type, customer_id: customer ? customer.id : (ticket ? ticket.customer_id : undefined), ticket_id: ticket ? ticket.id : undefined });
        AZ.toast("تم الحفظ");
        if (onDone) onDone();
      },
    });
  };

  const tasks = async (main, _a, params) => {
    const all = AZ.can("tasks.view_all");
    const state = { status: params.status || "open", due: params.due || "", type: "", mine: all ? "" : "1", assignee_id: "", page: 1 };
    main.innerHTML = `${head("المتابعات والمهام", "متابعات العملاء والمهام المسندة", '<button class="btn btn--primary" data-new>+ متابعة</button>')}
      <form class="filters">${AZ.field({ name: "status", label: "الحالة", type: "select", options: opts(L.taskStatus, "الكل"), value: state.status })}
        ${AZ.field({ name: "due", label: "الموعد", type: "select", options: [["", "الكل"], ["today", "اليوم"], ["overdue", "متأخرة"], ["upcoming", "القادمة"]], value: state.due })}
        ${AZ.field({ name: "type", label: "النوع", type: "select", options: opts(L.taskType, "الكل") })}
        ${all ? AZ.field({ name: "assignee_id", label: "المسؤول", type: "select", options: await staffOpts("الكل") }) : ""}</form><div data-list></div>`;
    let rows = [];
    const render = async () => {
      const r = await AZ.get("/api/tasks" + AZ.qs(state));
      rows = r.items;
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "المتابعة", html: (k) => `<b>${esc(k.title)}</b>${k.description ? `<br><small class="muted">${esc(k.description.slice(0, 120))}</small>` : ""}` },
        { label: "النوع", html: (k) => esc(L.taskType[k.type]) },
        { label: "مرتبطة بـ", html: (k) => `${k.customer_name ? `<a href="#/customers/${k.customer_id}">${esc(k.customer_name)}</a>` : ""}${k.ticket_number ? ` <a href="#/tickets/${k.ticket_id}">#${k.ticket_number}</a>` : ""}` || "—" },
        { label: "الموعد", html: (k) => `<span class="${overdue(k.due_at, k.status !== "open") ? "badge badge--err" : ""}">${esc(fmt.dateTime(k.due_at))}</span>` },
        { label: "الأولوية", html: (k) => badge(L.priority, L.priorityTone, k.priority) },
        { label: "المسؤول", key: "assignee_name" },
        { label: "الحالة", html: (k) => badge(L.taskStatus, { open: "info", done: "ok", cancelled: "" }, k.status) },
        { label: "إجراء", html: (k) => k.status === "open" ? `<div class="actions"><button class="btn btn--ghost btn--sm" data-done="${k.id}">إنجاز</button><button class="btn btn--ghost btn--sm" data-edit="${k.id}">تعديل</button></div>` : `<button class="btn btn--ghost btn--sm" data-reopen="${k.id}">إعادة فتح</button>` },
      ], rows, { empty: "لا توجد متابعات مطابقة." }) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    main.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-done],[data-reopen],[data-edit]");
      if (!b) return;
      const id = b.dataset.done || b.dataset.reopen || b.dataset.edit;
      if (b.dataset.edit) return taskDialog({ task: rows.find((x) => String(x.id) === id), onDone: () => render() });
      try { await AZ.patch(`/api/tasks/${id}`, { status: b.dataset.done ? "done" : "open" }); AZ.toast(b.dataset.done ? "تم إنجاز المتابعة" : "أعيد فتح المتابعة"); render(); } catch (err) { AZ.fail(err); }
    });
    $("[data-new]", main).addEventListener("click", () => taskDialog({ onDone: () => render() }));
    await render();
  };

  /* ================= Reports ================= */
  const reports = async (main) => {
    const state = { from: AZ.addDays(AZ.today(), -29), to: AZ.today() };
    main.innerHTML = `${head("التقارير", "أداء المكالمات والتذاكر والفريق للفترة المحددة")}
      <form class="filters">${AZ.field({ name: "from", label: "من", type: "date", value: state.from })}${AZ.field({ name: "to", label: "إلى", type: "date", value: state.to })}
        <div class="actions"><button class="btn btn--ghost" type="button" data-csv="calls">تصدير المكالمات CSV</button><button class="btn btn--ghost" type="button" data-csv="tickets">تصدير التذاكر CSV</button></div></form><div data-rep></div>`;
    const render = async () => {
      const r = await AZ.get("/api/reports/summary" + AZ.qs(state));
      const days = [];
      for (let d = r.range.from; d <= r.range.to; d = AZ.addDays(d, 1)) { const x = r.calls.by_day.find((y) => y.day === d) || { total: 0, answered: 0 }; days.push({ label: d.slice(5), value: x.total, value2: x.answered }); }
      const hbars = (rows, map, key) => { const m = Math.max(1, ...rows.map((x) => x.n)); return rows.length ? `<div class="bars-h">${rows.map((x) => `<div><span>${esc(map[x[key]] || x[key])}</span>${AZ.progress((x.n / m) * 100, map[x[key]])}<b>${x.n}</b></div>`).join("")}</div>` : '<div class="empty">لا توجد بيانات.</div>'; };
      const answerRate = r.calls.total ? Math.round((r.calls.answered / r.calls.total) * 100) : 0;
      $("[data-rep]", main).innerHTML = `<div class="stats">
          ${AZ.stat("إجمالي المكالمات", fmt.num(r.calls.total))}${AZ.stat("نسبة الرد", answerRate + "%", { tone: answerRate >= 80 ? "ok" : "warn" })}
          ${AZ.stat("متوسط مدة المكالمة", fmt.duration(r.calls.avg_sec))}${AZ.stat("إجمالي وقت المحادثة", fmt.duration(r.calls.talk_sec))}
          ${AZ.stat("تذاكر جديدة", fmt.num(r.tickets.created))}${AZ.stat("تذاكر محلولة", fmt.num(r.tickets.resolved), { tone: "ok" })}
          ${AZ.stat("متوسط زمن الحل", r.tickets.avg_resolution_hours != null ? r.tickets.avg_resolution_hours + " ساعة" : "—")}</div>
        <section class="card"><h2>المكالمات يوميًا</h2>${days.length <= 45 ? AZ.bars(days, { legend: '<span class="legend-dot"></span>الإجمالي<span class="legend-dot legend-dot--2"></span>تم الرد' }) : '<p class="muted">اختر فترة 45 يومًا أو أقل لعرض الرسم اليومي.</p>'}</section>
        <div class="cols cols--2">
          <section class="card"><h2>حالات المكالمات</h2>${hbars(r.calls.by_status, L.callStatus, "status")}</section>
          <section class="card"><h2>التذاكر حسب الأولوية</h2>${hbars(r.tickets.by_priority, L.priority, "priority")}</section>
          <section class="card"><h2>التذاكر حسب التصنيف</h2>${hbars(r.tickets.by_category, L.category, "category")}</section>
          <section class="card"><h2>كل التذاكر حسب الحالة الحالية</h2>${hbars(r.tickets.by_status, L.status, "status")}</section>
        </div>
        <section class="card"><h2>أداء الموظفين</h2>${AZ.table([{ label: "الموظف", key: "name" }, { label: "الدور", html: (u) => esc(L.role[u.role]) }, { label: "المكالمات", key: "calls", cls: "num" },
          { label: "وقت المحادثة", html: (u) => `<span dir="ltr">${fmt.duration(u.talk_sec)}</span>`, cls: "num" }, { label: "تذاكر محلولة", key: "resolved", cls: "num" }, { label: "متابعات منجزة", key: "tasks_done", cls: "num" }], r.agents)}</section>`;
    };
    const f = $(".filters", main);
    f.addEventListener("change", () => { Object.assign(state, AZ.formValues(f)); render().catch(AZ.fail); });
    f.addEventListener("click", (e) => { const b = e.target.closest("[data-csv]"); if (b) AZ.download("/api/reports/export" + AZ.qs({ ...state, type: b.dataset.csv }), `${b.dataset.csv}.csv`).catch(AZ.fail); });
    await render();
  };

  /* ================= Users / orgs / audit ================= */
  const users = async (main) => {
    const r = await AZ.get("/api/users");
    const manage = AZ.can("users.manage");
    main.innerHTML = `${head("المستخدمون", "حسابات فريق العمل وأدوارهم", manage ? '<button class="btn btn--primary" data-new>+ مستخدم</button>' : "")}
      ${AZ.table([{ label: "الاسم", key: "name" }, { label: "البريد", html: (u) => `<span dir="ltr">${esc(u.email)}</span>` }, { label: "الدور", html: (u) => esc(L.role[u.role]) },
        { label: "الحالة", html: (u) => u.is_active ? AZ.badge("نشط", "ok") : AZ.badge("معطّل", "err") }, { label: "آخر دخول", html: (u) => esc(u.last_login_at ? fmt.rel(u.last_login_at) : "لم يدخل بعد") },
        ...(manage ? [{ label: "إجراءات", html: (u) => r.manageable_roles.includes(u.role) && u.id !== AZ.state.user.id ? `<div class="actions"><button class="btn btn--ghost btn--sm" data-edit="${u.id}">تعديل</button><button class="btn btn--ghost btn--sm" data-reset="${u.id}">كلمة مرور مؤقتة</button></div>` : "—" }] : [])], r.items)}`;
    const roleOpts = r.manageable_roles.map((x) => [x, L.role[x]]);
    const nb = $("[data-new]", main);
    if (nb) nb.addEventListener("click", () => AZ.modal({
      title: "مستخدم جديد", submit: "إنشاء", body: `${AZ.field({ name: "name", label: "الاسم", required: true })}${AZ.field({ name: "email", label: "البريد الإلكتروني", type: "email", required: true, dir: "ltr" })}${AZ.field({ name: "phone", label: "الجوال", type: "tel", dir: "ltr" })}${AZ.field({ name: "role", label: "الدور", type: "select", options: roleOpts })}`,
      onSubmit: async (v) => { const x = await AZ.post("/api/users", v); directory = null; AZ.reload(); AZ.showSecret("تم إنشاء المستخدم", `كلمة المرور المؤقتة لـ ${x.user.email}:`, x.temporary_password); },
    }));
    main.addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]"), rs = e.target.closest("[data-reset]");
      if (ed) {
        const u = r.items.find((x) => String(x.id) === ed.dataset.edit);
        AZ.modal({ title: "تعديل المستخدم", submit: "حفظ", body: `${AZ.field({ name: "name", label: "الاسم", required: true, value: u.name })}${AZ.field({ name: "phone", label: "الجوال", type: "tel", dir: "ltr", value: u.phone })}${AZ.field({ name: "role", label: "الدور", type: "select", options: roleOpts, value: u.role })}${AZ.field({ name: "is_active", label: "الحساب نشط", type: "checkbox", value: u.is_active })}`,
          onSubmit: async (v) => { await AZ.patch(`/api/users/${u.id}`, v); directory = null; AZ.toast("تم الحفظ"); AZ.reload(); } });
      }
      if (rs) {
        const u = r.items.find((x) => String(x.id) === rs.dataset.reset);
        if (!(await AZ.confirm("كلمة مرور مؤقتة", `إنشاء كلمة مرور مؤقتة جديدة لـ ${u.name}؟ سيتم تسجيل خروجه من كل الأجهزة.`, { submit: "إنشاء", danger: false }))) return;
        try { const x = await AZ.post(`/api/users/${u.id}/reset-password`); AZ.showSecret("كلمة مرور مؤقتة", `كلمة المرور المؤقتة الجديدة لـ ${u.email}:`, x.temporary_password); } catch (err) { AZ.fail(err); }
      }
    });
  };

  const orgs = async (main) => {
    const r = await AZ.get("/api/orgs");
    main.innerHTML = `${head("المنشآت", "كل منشأة معزولة ببياناتها ومستخدميها", '<button class="btn btn--primary" data-new>+ منشأة</button>')}
      ${AZ.table([{ label: "المنشأة", key: "name" }, { label: "المعرّف", html: (o) => `<code dir="ltr">${esc(o.slug)}</code>` }, { label: "المستخدمون", key: "users", cls: "num" },
        { label: "الحالة", html: (o) => o.is_active ? AZ.badge("نشطة", "ok") : AZ.badge("موقوفة", "err") }, { label: "أُنشئت", html: (o) => esc(fmt.date(o.created_at)) },
        { label: "إجراء", html: (o) => o.id === AZ.state.user.org_id ? '<small class="muted">منشأتك</small>' : `<button class="btn btn--ghost btn--sm" data-toggle="${o.id}" data-active="${o.is_active}">${o.is_active ? "إيقاف" : "تفعيل"}</button>` }], r.items)}`;
    $("[data-new]", main).addEventListener("click", () => AZ.modal({
      title: "منشأة جديدة", submit: "إنشاء", body: `${AZ.field({ name: "name", label: "اسم المنشأة", required: true })}${AZ.field({ name: "slug", label: "المعرّف (إنجليزي)", required: true, dir: "ltr", placeholder: "my-company" })}${AZ.field({ name: "admin_name", label: "اسم مدير المنشأة", required: true })}${AZ.field({ name: "admin_email", label: "بريد مدير المنشأة", type: "email", required: true, dir: "ltr" })}`,
      onSubmit: async (v) => { const x = await AZ.post("/api/orgs", v); AZ.reload(); AZ.showSecret("تم إنشاء المنشأة", `كلمة المرور المؤقتة لمدير المنشأة ${x.admin_email}:`, x.temporary_password); },
    }));
    main.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-toggle]");
      if (!b) return;
      try { await AZ.patch(`/api/orgs/${b.dataset.toggle}`, { is_active: b.dataset.active !== "1" }); AZ.reload(); } catch (err) { AZ.fail(err); }
    });
  };

  const auditView = async (main) => {
    const state = { action: "", entity: "", page: 1 };
    main.innerHTML = `${head("سجل التدقيق", "كل العمليات الحساسة مسجلة ولا يمكن تعديلها أو حذفها")}
      <form class="filters">${AZ.field({ name: "action", label: "الإجراء", type: "search", placeholder: "مثال: ticket أو auth.login" })}
        ${AZ.field({ name: "entity", label: "الكيان", type: "select", options: [["", "الكل"], ["user", "مستخدم"], ["customer", "عميل"], ["call", "مكالمة"], ["ticket", "تذكرة"], ["task", "مهمة"], ["organization", "منشأة"], ["report", "تقرير"]] })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/audit" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([{ label: "الوقت", html: (a) => esc(fmt.dateTime(a.created_at)) }, { label: "المستخدم", html: (a) => esc(a.user_name || "—") },
        { label: "الإجراء", html: (a) => `<code dir="ltr">${esc(a.action)}</code>` }, { label: "الكيان", html: (a) => esc(a.entity ? `${a.entity} #${a.entity_id}` : "—") },
        { label: "تفاصيل", html: (a) => `<small class="muted" dir="ltr">${esc((a.meta || "").slice(0, 160))}</small>` }, { label: "IP", html: (a) => `<small dir="ltr">${esc(a.ip || "")}</small>` }], r.items) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    await render();
  };

  /* ================= Global search ================= */
  const search = async (q) => {
    const r = await AZ.get("/api/search" + AZ.qs({ q }));
    if (!r.customers.length && !r.tickets.length) return '<p class="pad muted">لا توجد نتائج.</p>';
    return `${r.customers.length ? `<p class="search-group">العملاء</p><ul class="search-list">${r.customers.map((c) => `<li><a href="#/customers/${c.id}"><b>${esc(c.name)}</b><small dir="ltr">${esc(c.phone)}</small></a></li>`).join("")}</ul>` : ""}
      ${r.tickets.length ? `<p class="search-group">التذاكر</p><ul class="search-list">${r.tickets.map((t) => `<li><a href="#/tickets/${t.id}"><b>#${t.number} ${esc(t.subject)}</b><small>${esc(t.customer_name)} · ${esc(L.status[t.status])}</small></a></li>`).join("")}</ul>` : ""}`;
  };

  AZ.start({
    app: "callcenter",
    title: "AZENK Call Center",
    tagline: "إدارة مركز الاتصال وخدمة العملاء",
    home: "dashboard",
    roleLabels: L.role,
    search,
    searchPlaceholder: "ابحث عن عميل أو رقم جوال أو تذكرة…",
    nav: [
      { route: "dashboard", label: "لوحة التحكم", icon: "◧", perm: "dashboard.view" },
      { route: "calls", label: "المكالمات", icon: "☎", perm: ["calls.view_all", "calls.view_own"] },
      { route: "tickets", label: "التذاكر", icon: "▤", perm: ["tickets.view_all", "tickets.view_own"] },
      { route: "customers", label: "العملاء", icon: "☺", perm: "customers.view" },
      { route: "tasks", label: "المتابعات", icon: "✓", perm: ["tasks.view_all", "tasks.view_own"] },
      { route: "reports", label: "التقارير", icon: "▦", perm: "reports.view" },
      { route: "users", label: "المستخدمون", icon: "⚇", perm: "users.view" },
      { route: "orgs", label: "المنشآت", icon: "⌂", perm: "orgs.manage" },
      { route: "audit", label: "سجل التدقيق", icon: "⎙", perm: "audit.view" },
    ],
    routes: {
      dashboard, customers, "customers/:id": customerView, calls, "calls/new": callNew,
      tickets, "tickets/:id": ticketView, tasks, reports, users, orgs, audit: auditView,
    },
  });
})();
