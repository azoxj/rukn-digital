/* =========================================================
   Easy HR — leave: requests (approval workflow), balances,
   team calendar, leave types & policy (all configurable)
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const E = EHR.engine;
  const { $, esc, icon } = U;

  let tab = "requests";
  let calMonth = null;

  const auth = () => EHR.auth;
  const me = () => EHR.auth.me();
  const typeName = (id) => (EHR.L.leaveType(id) || {}).name || "—";
  const typeColor = (id) => (EHR.L.leaveType(id) || {}).color || "var(--brand)";
  const canOnBehalf = () => auth().can("leave.manage");
  const LEAVE_ST = { ...H.S.approval, cancelled: { label: "ملغاة", tone: "gray" } };

  /* ---------- Request form (live days + balance preview) ---------- */
  const leaveFields = () => {
    const L = EHR.L;
    const emp = me();
    const f = [];
    if (canOnBehalf()) {
      f.push({ name: "employeeId", label: "الموظف", type: "select", required: true, options: L.inCompany(EHR.db.employees).filter((e) => ["active", "probation"].includes(e.status)).map((e) => [e.id, `${e.nameAr} — ${e.id}`]) });
    }
    const types = emp ? EHR.api.leave.typesFor(emp) : EHR.db.leaveTypes.filter((t) => t.companyId === auth().companyId() && t.active);
    f.push(
      { name: "typeId", label: "نوع الإجازة", type: "select", required: true, options: types.map((t) => [t.id, `${t.name}${t.paid ? "" : " (بدون راتب)"}`]) },
      { name: "from", label: "من تاريخ", type: "date", required: true },
      { name: "to", label: "إلى تاريخ", type: "date", required: true, validate: (v, all) => (all.from && v < all.from ? "تاريخ النهاية قبل البداية" : "") },
      { name: "reason", label: "السبب / ملاحظات", type: "textarea", full: true },
      { name: "attachment", label: "مرفق", type: "file", full: true, accept: ".pdf,image/*", placeholder: "مطلوب لبعض الأنواع (مثل الإجازة المرضية) حسب السياسة" }
    );
    return f;
  };
  const updatePreview = (form) => {
    const out = $("[data-leave-calc]", form);
    if (!out) return;
    const v = (n) => ($(`[name="${n}"]`, form) || {}).value;
    const empId = v("employeeId") || (me() || {}).id;
    const emp = EHR.L.emp(empId);
    const typeId = v("typeId");
    if (!emp || !typeId) return (out.innerHTML = "");
    const s = EHR.db.settings[emp.companyId];
    const bal = EHR.api.leave.balance(emp.id, typeId);
    const days = v("from") && v("to") && v("to") >= v("from") ? E.leaveDays(s, v("from"), v("to")) : 0;
    const after = bal.remaining - days;
    out.innerHTML = `<div class="leave-calc">
      <div><small>الرصيد المتاح</small><b>${bal.remaining}</b></div>
      <div><small>أيام الطلب</small><b>${days}</b></div>
      <div class="${after < 0 ? "is-bad" : ""}"><small>المتبقي بعد الطلب</small><b>${after}</b></div>
    </div><small class="muted">${s.leave.countWeekends ? "تُحتسب عطلة نهاية الأسبوع ضمن الأيام وفق سياسة الشركة." : "لا تُحتسب عطلة نهاية الأسبوع والعطل الرسمية وفق سياسة الشركة."}${bal.pending ? ` يوجد ${bal.pending} أيام قيد الاعتماد.` : ""}</small>`;
  };

  const openLeaveForm = () => {
    const emp = me();
    if (!emp && !canOnBehalf()) return UI.toast("طلب الإجازة متاح للموظفين", "error");
    const types = emp ? EHR.api.leave.typesFor(emp) : [];
    UI.formModal({
      title: "طلب إجازة جديد", subtitle: "يمر الطلب على مسار الاعتماد المحدد في الإعدادات (افتراضيًا: المدير المباشر ← الموارد البشرية).", size: "md",
      fields: leaveFields(),
      values: { employeeId: emp ? emp.id : "", typeId: (types.find((t) => t.key === "annual") || types[0] || {}).id, from: U.addDays(U.today(), 7), to: U.addDays(U.today(), 9) },
      submitLabel: "إرسال الطلب",
      onMount(form) {
        form.insertAdjacentHTML("beforeend", '<div class="full" data-leave-calc aria-live="polite"></div>');
        form.addEventListener("input", () => updatePreview(form));
        form.addEventListener("change", () => updatePreview(form));
        updatePreview(form);
      },
      async onSubmit(v) {
        const target = EHR.L.emp(v.employeeId || (emp || {}).id);
        const type = EHR.L.leaveType(v.typeId);
        const s = EHR.db.settings[target.companyId];
        if (type.requiresAttachment && s.leave.requireAttachmentForSick && !v.attachment) throw UI.fieldError({ attachment: "هذا النوع يتطلب إرفاق مستند حسب السياسة" });
        const err = EHR.api.leave.validate(target, v);
        if (err) throw UI.fieldError({ to: err }, err);
        const rec = await EHR.api.leave.request(target, { typeId: v.typeId, from: v.from, to: v.to, reason: v.reason, attachment: v.attachment ? v.attachment.name : null });
        UI.toast(rec.status === "approved" ? "تم اعتماد الإجازة" : `تم إرسال الطلب ${rec.id} للاعتماد`, "success");
        EHR.app.refresh();
        return true;
      },
    });
  };

  /* ---------- Requests (crud) ---------- */
  const requestsCrud = () =>
    EHR.crud({
      key: "leaves", title: "طلبات الإجازة", embedded: true, noCreateButton: true, icon: "palm",
      api: EHR.api.leave, statuses: LEAVE_ST, approvalCollection: "leaves",
      tabs: [
        ["all", "الكل"],
        ["mine", "بانتظار موافقتي", (r) => EHR.api.approvals.canAct(r)],
        ["pending", "قيد الاعتماد", (r) => r.status === "pending"],
        ["approved", "معتمدة", (r) => r.status === "approved"],
        ["rejected", "مرفوضة", (r) => r.status === "rejected"],
      ],
      canCreate: () => (!!me() && auth().can("leave.request")) || canOnBehalf(),
      createLabel: "طلب إجازة",
      columns: [
        { key: "emp", label: "الموظف", render: (r) => H.emp(r.employeeId), sort: (r) => EHR.L.empName(r.employeeId) },
        { key: "type", label: "النوع", render: (r) => `<span class="dot-label" style="--c:${typeColor(r.typeId)}">${esc(typeName(r.typeId))}</span>` },
        { key: "from", label: "الفترة", render: (r) => `${U.fmtShort(r.from)} – ${U.fmtShort(r.to)}<small class="block muted">${U.relDays(r.from)}</small>`, sort: (r) => r.from },
        { key: "days", label: "الأيام", render: (r) => `<span class="num">${r.days}</span>`, sort: (r) => r.days },
        { key: "step", label: "المرحلة", render: (r) => { const st = EHR.api.approvals.currentStep(r); return st ? esc(EHR.api.approvals.STEP_LABEL[st.role]) : "—"; } },
        { key: "status", label: "الحالة", render: (r) => UI.status(LEAVE_ST, r.status), sort: (r) => r.status },
      ],
      filters: [
        { key: "type", label: "كل الأنواع", options: () => EHR.db.leaveTypes.filter((t) => t.companyId === auth().companyId()).map((t) => [t.key, t.name]), test: (r, v) => (EHR.L.leaveType(r.typeId) || {}).key === v },
        { key: "dept", label: "كل الإدارات", options: () => EHR.L.inCompany(EHR.db.departments).map((d) => [d.id, d.name]), test: (r, v) => (EHR.L.emp(r.employeeId) || {}).departmentId === v },
      ],
      search: (r) => `${EHR.L.empName(r.employeeId)} ${r.id} ${typeName(r.typeId)}`,
      searchPlaceholder: "ابحث بالاسم أو رقم الطلب…",
      defaultSort: { key: "from", dir: -1 },
      exportName: "leaves",
      exportColumns: [["رقم الطلب", (r) => r.id], ["الموظف", (r) => EHR.L.empName(r.employeeId)], ["النوع", (r) => typeName(r.typeId)], ["من", (r) => r.from], ["إلى", (r) => r.to], ["الأيام", (r) => r.days], ["الحالة", (r) => LEAVE_ST[r.status].label]],
      detailTitle: (r) => `${esc(typeName(r.typeId))} — ${esc(EHR.L.empName(r.employeeId))}`,
      detailSubtitle: (r) => `${r.id} · قُدّم ${U.ago(r.createdAt)}`,
      detailBody: (r) => {
        const bal = EHR.api.leave.balance(r.employeeId, r.typeId);
        const overlap = EHR.db.leaves.filter((l) => l.id !== r.id && l.status === "approved" && l.from <= r.to && l.to >= r.from && (EHR.L.emp(l.employeeId) || {}).departmentId === (EHR.L.emp(r.employeeId) || {}).departmentId);
        return `<div class="info-grid">${UI.info("من", U.fmtLong(r.from))}${UI.info("إلى", U.fmtLong(r.to))}${UI.info("عدد الأيام", r.days)}${UI.info("مدفوعة", (EHR.L.leaveType(r.typeId) || {}).paid ? "نعم" : "لا")}${UI.info("الرصيد الافتتاحي", bal.opening)}${UI.info("المتبقي حاليًا", bal.remaining)}${UI.info("المرفق", r.attachment ? `${icon("file")} ${esc(r.attachment)}` : "—")}</div>
          ${r.reason ? UI.section("السبب", `<p>${esc(r.reason)}</p>`, "note") : ""}
          ${overlap.length && auth().canAny(["leave.approve", "leave.view"]) ? UI.notice(`في نفس الفترة: ${overlap.map((l) => esc(EHR.L.empName(l.employeeId))).join("، ")} في إجازة من نفس الإدارة.`, "warning", "users") : ""}`;
      },
      detailActions: () => [
        {
          label: "إلغاء الطلب", icon: "x", cls: "btn--danger-ghost", danger: true, confirm: "هل تريد إلغاء طلب الإجازة؟",
          when: (r) => me() && r.employeeId === me().id && r.status === "pending",
          run: (r) => EHR.api.leave.update(r.id, (x) => { x.status = "cancelled"; x.approval.current = -1; }, "الإجازات", "إلغاء"),
          success: "تم إلغاء الطلب",
        },
      ],
      printable: (r) => `<div class="head"><h1>طلب إجازة</h1><p>${r.id}</p></div><div class="grid"><p><b>الموظف:</b> ${esc(EHR.L.empName(r.employeeId))}</p><p><b>النوع:</b> ${esc(typeName(r.typeId))}</p><p><b>من:</b> ${U.fmtDate(r.from)}</p><p><b>إلى:</b> ${U.fmtDate(r.to)}</p><p><b>الأيام:</b> ${r.days}</p><p><b>الحالة:</b> ${LEAVE_ST[r.status].label}</p></div>${UI.approvalTimeline(r.approval)}`,
    });

  /* ---------- Balances ---------- */
  const renderBalances = (el) => {
    const L = EHR.L;
    const sc = auth().scope("leave");
    if (sc === "self") {
      const emp = me();
      el.innerHTML = `<div class="cards-grid cards-grid--sm">${EHR.api.leave.typesFor(emp)
        .map((t) => {
          const b = EHR.api.leave.balance(emp.id, t.id);
          return `<article class="card bal-card" style="--c:${t.color}"><header><b>${esc(t.name)}</b>${t.paid ? "" : UI.badge("بدون راتب", "gray")}</header>
            ${UI.chart.ring(b.opening ? ((b.opening - b.remaining) / b.opening) * 100 : 0, "مستخدم", "brand", 84)}
            <div class="bal-card__nums"><span><small>الرصيد</small><b>${b.opening}</b></span><span><small>المستخدم</small><b>${b.used}</b></span><span><small>قيد الاعتماد</small><b>${b.pending}</b></span><span><small>المتبقي</small><b class="tone-brand">${b.remaining}</b></span></div></article>`;
        })
        .join("")}</div>`;
      return;
    }
    const ids = sc === "all" ? L.inCompany(EHR.db.employees).filter((e) => e.status !== "archived").map((e) => e.id) : auth().team();
    const types = EHR.db.leaveTypes.filter((t) => t.companyId === auth().companyId() && ["annual", "sick", "emergency"].includes(t.key));
    el.innerHTML = '<div class="card card--flush"><div data-bal></div></div>';
    UI.table($("[data-bal]", el), {
      id: "leave-bal",
      rows: () => ids.map((id) => L.emp(id)),
      search: (e) => `${e.nameAr} ${e.id}`,
      searchPlaceholder: "ابحث عن موظف…",
      filters: [{ key: "dept", label: "كل الإدارات", options: () => L.inCompany(EHR.db.departments).map((d) => [d.id, d.name]), test: (e, v) => e.departmentId === v }],
      columns: [
        { key: "emp", label: "الموظف", render: (e) => H.emp(e.id), sort: (e) => e.nameAr },
        ...types.map((t) => ({
          key: t.key, label: t.name,
          render: (e) => { const b = EHR.api.leave.balance(e.id, t.id); return `<b class="num">${b.remaining}</b><small class="muted"> / ${b.opening}</small>${b.pending ? `<small class="block tone-warning">${b.pending} قيد الاعتماد</small>` : ""}`; },
          sort: (e) => EHR.api.leave.balance(e.id, t.id).remaining,
        })),
      ],
      exportName: "leave-balances",
      exportColumns: [["الرقم", (e) => e.id], ["الموظف", (e) => e.nameAr], ...types.flatMap((t) => [[`${t.name} — الرصيد`, (e) => EHR.api.leave.balance(e.id, t.id).opening], [`${t.name} — المتبقي`, (e) => EHR.api.leave.balance(e.id, t.id).remaining]])],
    });
  };

  /* ---------- Calendar ---------- */
  const renderCalendar = (el) => {
    if (!calMonth) calMonth = U.monthKey(U.today());
    const list = EHR.api.leave.visible().filter((l) => ["approved", "pending"].includes(l.status));
    const events = [];
    const first = `${calMonth}-01`;
    const last = U.addDays(U.addMonths(first, 1), -1);
    list.forEach((l) => {
      for (let d = l.from < first ? first : l.from; d <= (l.to > last ? last : l.to); d = U.addDays(d, 1)) {
        events.push({ date: d, title: `${EHR.L.empName(l.employeeId).split(" ")[0]} — ${typeName(l.typeId)}`, tone: l.status === "pending" ? "warning" : "info", link: `#/leave?open=${l.id}` });
      }
    });
    const away = list.filter((l) => l.status === "approved" && l.from <= U.today() && l.to >= U.today());
    el.innerHTML = `
      <div class="toolbar-row"><div class="btn-group"><button type="button" class="icon-btn" data-cal-nav="-1" aria-label="الشهر السابق">${icon("chevron-right")}</button><b>${U.fmtMonth(calMonth)}</b><button type="button" class="icon-btn" data-cal-nav="1" aria-label="الشهر التالي">${icon("chevron-left")}</button><button type="button" class="btn btn--ghost btn--sm" data-cal-nav="0">اليوم</button></div>
      ${UI.chart.legend([{ label: "معتمدة", color: "var(--info)" }, { label: "قيد الاعتماد", color: "var(--warning)" }])}</div>
      <div class="grid-main">
        <section class="card">${UI.calendar({ view: "month", date: first, events })}</section>
        <section class="card"><header class="card__head"><h3>${icon("palm")}في إجازة اليوم</h3><em class="count">${away.length}</em></header>
          ${away.length ? `<ul class="list list--compact">${away.map((l) => `<li class="list__item" data-go="#/leave?open=${l.id}" role="link" tabindex="0">${UI.avatar(EHR.L.empName(l.employeeId), "sm")}<div class="list__body"><b>${esc(EHR.L.empName(l.employeeId))}</b><small>${esc(typeName(l.typeId))} · حتى ${U.fmtShort(l.to)}</small></div></li>`).join("")}</ul>` : UI.empty({ icon: "check-circle", title: "لا أحد في إجازة اليوم" })}
        </section>
      </div>`;
  };

  /* ---------- Types & policy ---------- */
  const openTypeForm = (t = null) =>
    UI.formModal({
      title: t ? `تعديل نوع الإجازة — ${t.name}` : "إضافة نوع إجازة",
      fields: [
        { name: "name", label: "الاسم", required: true },
        { name: "defaultDays", label: "الرصيد السنوي الافتراضي (يوم)", type: "number", min: 0, max: 365, required: true, hint: "القيمة حسب سياسة الشركة والأنظمة المعتمدة لديها" },
        { name: "color", label: "اللون", type: "color" },
        { name: "paid", label: "إجازة مدفوعة", type: "checkbox" },
        { name: "requiresAttachment", label: "تتطلب مرفقًا", type: "checkbox" },
        { name: "active", label: "مفعّلة", type: "checkbox" },
      ],
      values: t || { defaultDays: 5, color: "#2451d6", paid: true, active: true },
      async onSubmit(v) {
        const data = { ...v, defaultDays: Number(v.defaultDays) };
        if (t) await EHR.api.records("leaveTypes").update(t.id, data, "أنواع الإجازات");
        else await EHR.api.records("leaveTypes").create({ id: `${auth().companyId()}-${U.uid("LT").toLowerCase()}`, key: U.uid("custom"), ...data }, "أنواع الإجازات");
        UI.toast("تم الحفظ", "success");
        EHR.app.refresh();
        return true;
      },
    });
  EHR.openLeavePolicy = () =>
    UI.formModal({
      title: "سياسة الإجازات", subtitle: "كل القيم قابلة للتعديل ولا توجد قواعد نظامية مثبتة داخل النظام.",
      fields: [
        { name: "countWeekends", label: "احتساب عطلة نهاية الأسبوع ضمن أيام الإجازة", type: "checkbox", full: true },
        { name: "allowNegative", label: "السماح بالرصيد السالب", type: "checkbox", full: true },
        { name: "requireAttachmentForSick", label: "إلزام المرفق للأنواع التي تتطلبه", type: "checkbox", full: true },
        { name: "carryOverMax", label: "الحد الأقصى للترحيل للسنة التالية (يوم)", type: "number", min: 0, max: 365 },
      ],
      values: EHR.L.settings().leave,
      async onSubmit(v) {
        await EHR.api.call(() => {
          Object.assign(EHR.L.settings().leave, { ...v, carryOverMax: Number(v.carryOverMax) || 0 });
          EHR.api.audit.log("تعديل السياسة", "سياسة الإجازات", "leave");
        });
        UI.toast("تم حفظ سياسة الإجازات", "success");
        EHR.app.refresh();
        return true;
      },
    });
  const renderTypes = (el) => {
    const s = EHR.L.settings().leave;
    const types = EHR.db.leaveTypes.filter((t) => t.companyId === auth().companyId());
    el.innerHTML = `
      <div class="grid-main">
        <section class="card card--flush"><header class="card__head card__head--pad"><h3>${icon("palm")}أنواع الإجازات</h3><button type="button" class="btn btn--primary btn--sm" data-lt-new>${icon("plus")}إضافة نوع</button></header>
          <div class="tbl-wrap"><table class="tbl tbl--stack"><thead><tr><th>النوع</th><th>الرصيد الافتراضي</th><th>مدفوعة</th><th>مرفق</th><th>الحالة</th><th></th></tr></thead><tbody>${types
            .map((t) => `<tr><td data-label="النوع"><span class="dot-label" style="--c:${t.color}">${esc(t.name)}</span></td><td data-label="الرصيد الافتراضي"><span class="num">${t.defaultDays}</span> يوم</td><td data-label="مدفوعة">${t.paid ? "نعم" : "لا"}</td><td data-label="مرفق">${t.requiresAttachment ? "مطلوب" : "—"}</td><td data-label="الحالة">${t.active ? UI.badge("مفعّلة", "success") : UI.badge("معطلة", "gray")}</td><td class="cell-actions"><button type="button" class="icon-btn icon-btn--sm" data-lt-edit="${t.id}" aria-label="تعديل ${esc(t.name)}">${icon("edit")}</button></td></tr>`)
            .join("")}</tbody></table></div></section>
        <section class="card"><header class="card__head"><h3>${icon("settings")}السياسة</h3><button type="button" class="btn btn--ghost btn--sm" data-lt-policy>${icon("edit")}تعديل</button></header>
          <div class="info-grid info-grid--1">${UI.info("احتساب نهاية الأسبوع", s.countWeekends ? "نعم" : "لا")}${UI.info("الرصيد السالب", s.allowNegative ? "مسموح" : "غير مسموح")}${UI.info("الترحيل", `حتى ${s.carryOverMax} يوم`)}${UI.info("المرفقات", s.requireAttachmentForSick ? "إلزامية للأنواع المحددة" : "اختيارية")}</div>
          ${UI.notice("القيم الافتراضية أمثلة قابلة للتعديل. راجع الأنظمة واللوائح المعتمدة لدى منشأتك قبل الاعتماد.", "info", "info")}
        </section>
      </div>`;
  };

  /* ---------- Page ---------- */
  EHR.view("leave", {
    title: "الإجازات",
    render(ctx) {
      const q = ctx.query;
      const tabs = [["requests", "الطلبات"], ["calendar", "التقويم"], ["balances", "الأرصدة"]];
      if (auth().can("leave.manage")) tabs.push(["types", "الأنواع والسياسة"]);
      let crudQuery = {};
      if (q.tab === "approvals") {
        tab = "requests";
        crudQuery = { tab: "mine" };
      } else if (q.tab && tabs.some((t) => t[0] === q.tab)) tab = q.tab;
      if (q.open) {
        tab = "requests";
        crudQuery = { open: q.open };
      }
      if (!tabs.some((t) => t[0] === tab)) tab = "requests";
      const emp = me();
      const pendingMine = EHR.api.approvals.pendingForMe().filter((p) => p.def.collection === "leaves").length;
      const annual = emp ? EHR.api.leave.typesFor(emp).find((t) => t.key === "annual") : null;
      const bal = annual ? EHR.api.leave.balance(emp.id, annual.id) : null;
      const vis = EHR.api.leave.visible();
      const today = U.today();
      ctx.el.innerHTML = `
        ${H.pageHead("الإجازات", "طلب الإجازات واعتمادها ومتابعة الأرصدة والتقويم", "palm", (emp && auth().can("leave.request")) || canOnBehalf() ? `<button type="button" class="btn btn--primary" data-leave-new>${icon("plus")}طلب إجازة</button>` : "")}
        <div class="kpis kpis--sm">
          ${bal ? UI.kpi({ label: "رصيدي السنوي المتبقي", value: bal.remaining, unit: " يوم", iconName: "palm", sub: `من ${bal.opening} يوم` }) : ""}
          ${UI.kpi({ label: "بانتظار موافقتي", value: pendingMine, iconName: "bell", tone: "warning", attrs: 'data-go="#/leave?tab=approvals"' })}
          ${UI.kpi({ label: "في إجازة اليوم", value: vis.filter((l) => l.status === "approved" && l.from <= today && l.to >= today).length, iconName: "users", tone: "info" })}
          ${UI.kpi({ label: "إجازات قادمة (30 يومًا)", value: vis.filter((l) => l.status === "approved" && l.from > today && l.from <= U.addDays(today, 30)).length, iconName: "calendar", tone: "success" })}
        </div>
        ${UI.tabs("lv", tabs, tab)}
        <div data-lv-body></div>`;
      const body = $("[data-lv-body]", ctx.el);
      if (tab === "requests") requestsCrud().render({ el: body, query: crudQuery, view: "leave" });
      else if (tab === "calendar") renderCalendar(body);
      else if (tab === "balances") renderBalances(body);
      else renderTypes(body);
      if (Object.keys(q).length) {
        history.replaceState(null, "", "#/leave");
        ctx.query = {};
        if (q.new) openLeaveForm();
      }
      const self = this;
      ctx.el.onclick = (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="lv"]');
        if (tb) {
          tab = tb.dataset.tab;
          return self.render(ctx);
        }
        if (t.closest("[data-leave-new]")) return openLeaveForm();
        const nav = t.closest("[data-cal-nav]");
        if (nav) {
          const n = Number(nav.dataset.calNav);
          calMonth = n === 0 ? U.monthKey(U.today()) : U.monthKey(U.addMonths(`${calMonth}-01`, n));
          return self.render(ctx);
        }
        const more = t.closest("[data-cal-day]");
        if (more) {
          const d = more.dataset.calDay;
          const items = EHR.api.leave.visible().filter((l) => ["approved", "pending"].includes(l.status) && l.from <= d && l.to >= d);
          return UI.modal({ title: U.fmtLong(d), size: "sm", body: `<ul class="list">${items.map((l) => `<li class="list__item" data-go="#/leave?open=${l.id}" role="link" tabindex="0">${UI.avatar(EHR.L.empName(l.employeeId), "sm")}<div class="list__body"><b>${esc(EHR.L.empName(l.employeeId))}</b><small>${esc(typeName(l.typeId))}</small></div>${UI.status(LEAVE_ST, l.status)}</li>`).join("")}</ul>` });
        }
        if (t.closest("[data-lt-new]")) return openTypeForm();
        const lt = t.closest("[data-lt-edit]");
        if (lt) return openTypeForm(EHR.L.leaveType(lt.dataset.ltEdit));
        if (t.closest("[data-lt-policy]")) return EHR.openLeavePolicy();
      };
    },
  });
})((window.EHR = window.EHR || {}));
