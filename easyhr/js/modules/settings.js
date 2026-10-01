/* =========================================================
   Easy HR — settings: company, roles & permissions, policies,
   approval workflows, notifications, lists, privacy,
   integrations (future), system status & demo reset, audit log
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const { $, $$, esc, icon } = U;

  const auth = () => EHR.auth;
  const L = () => EHR.L;
  const S = () => EHR.L.settings();
  const canEdit = () => auth().can("settings.manage");
  const saveSettings = (fn, label) =>
    EHR.api.call(() => {
      fn(S());
      EHR.api.audit.log("تعديل الإعدادات", "الإعدادات", label);
    });
  const STEP_ROLES = [["MANAGER", "المدير المباشر"], ["HR", "الموارد البشرية"], ["HR_MANAGER", "مدير الموارد البشرية"], ["FINANCE", "المالية"]];
  const editBtn = (attr, label = "تعديل") => (canEdit() ? `<button type="button" class="btn btn--ghost btn--sm" ${attr}>${icon("edit")}${label}</button>` : "");

  /* ---------- Company ---------- */
  const companyTab = () => {
    const c = S().company;
    const co = L().company(auth().companyId());
    return `<section class="card"><header class="card__head"><h3>${icon("building")}بيانات الشركة</h3>${editBtn("data-set-company")}</header>
      <div class="info-grid">${UI.info("الاسم", esc(c.name))}${UI.info("الاسم بالإنجليزية", esc(c.nameEn || "—"))}${UI.info("السجل التجاري", esc(co.crNumber || "—"))}${UI.info("المدينة", esc(co.city || "—"))}${UI.info("أيام العمل", c.workWeek.map((d) => U.WEEKDAYS[d]).join("، "))}${UI.info("العطلة الأسبوعية", c.weekend.map((d) => U.WEEKDAYS[d]).join("، "))}${UI.info("العملة", esc(c.currency))}${UI.info("المنطقة الزمنية", esc(c.timezone))}</div></section>
      <section class="card"><header class="card__head"><h3>${icon("calendar")}العطل الرسمية</h3>${editBtn("data-hol-add", "إضافة عطلة")}</header>
      ${S().attendance.holidays.length ? `<ul class="list list--compact">${S().attendance.holidays.map((h, i) => `<li class="list__item"><span class="list__icon">${icon("calendar")}</span><div class="list__body"><b>${esc(h.name)}</b><small>${U.fmtLong(h.date)}</small></div>${canEdit() ? `<button type="button" class="icon-btn icon-btn--sm" data-hol-del="${i}" aria-label="حذف ${esc(h.name)}">${icon("trash")}</button>` : ""}</li>`).join("")}</ul>` : '<p class="muted">لا توجد عطل مُعرّفة.</p>'}
      ${UI.notice("أدخل العطل الرسمية المعتمدة لكل سنة — لا يضيفها النظام تلقائيًا.", "info", "info")}</section>
      <section class="card"><header class="card__head"><h3>${icon("sitemap")}الهيكل التنظيمي</h3><a class="btn btn--ghost btn--sm" href="#/org">${icon("arrow-left")}إدارة الفروع والإدارات والمسميات</a></header><p class="muted">الشركات والفروع والإدارات والأقسام والمسميات والدرجات ومواقع العمل تُدار من صفحة الهيكل التنظيمي.</p></section>`;
  };
  const editCompany = () => {
    const c = S().company;
    UI.formModal({
      title: "بيانات الشركة", size: "lg",
      fields: [
        { name: "name", label: "اسم الشركة", required: true },
        { name: "nameEn", label: "الاسم بالإنجليزية", dir: "ltr" },
        { name: "workWeek", label: "أيام العمل", type: "checkgroup", full: true, required: true, options: U.WEEKDAYS.map((d, i) => [String(i), d]) },
        { name: "currency", label: "العملة", type: "select", options: [["SAR", "ريال سعودي (SAR)"]] },
        { name: "timezone", label: "المنطقة الزمنية", type: "select", options: [["Asia/Riyadh", "الرياض (UTC+3)"]] },
      ],
      values: { ...c, workWeek: c.workWeek.map(String) },
      async onSubmit(v) {
        const ww = v.workWeek.map(Number).sort();
        await saveSettings((s) => {
          Object.assign(s.company, { name: v.name, nameEn: v.nameEn, currency: v.currency, timezone: v.timezone, workWeek: ww, weekend: [0, 1, 2, 3, 4, 5, 6].filter((d) => !ww.includes(d)) });
          const co = L().company(auth().companyId());
          co.name = v.name;
          co.nameEn = v.nameEn;
        }, "بيانات الشركة");
        UI.toast("تم حفظ بيانات الشركة", "success");
        EHR.app.rerenderShell();
        return true;
      },
    });
  };

  /* ---------- Roles & permissions ---------- */
  let roleSel = "HR_MANAGER";
  const rolesTab = () => {
    const defs = auth().ROLE_DEFS;
    const editable = auth().can("roles.manage") && roleSel !== "SUPER_ADMIN";
    const perms = (EHR.db.rolePerms && EHR.db.rolePerms[roleSel]) || defs[roleSel].perms;
    const groups = U.groupBy(auth().PERMISSIONS, (p) => p.group);
    const has = (k) => perms.includes("*") || perms.includes(k);
    const usersIn = EHR.db.users.filter((u) => u.role === roleSel);
    return `<div class="grid-main grid-main--rev">
      <aside class="card role-list">${Object.entries(defs).map(([k, d]) => `<button type="button" class="role-row ${k === roleSel ? "active" : ""}" data-role-sel="${k}"><b>${esc(d.label)}</b><small>${esc(d.labelEn)} · ${d.perms.includes("*") ? "كل الصلاحيات" : `${((EHR.db.rolePerms && EHR.db.rolePerms[k]) || d.perms).length} صلاحية`}</small>${EHR.db.rolePerms && EHR.db.rolePerms[k] ? UI.badge("معدّل", "warning") : ""}</button>`).join("")}</aside>
      <section class="card">
        <header class="card__head"><h3>${icon("shield")}${esc(defs[roleSel].label)}</h3><div class="btn-row">${editable && EHR.db.rolePerms && EHR.db.rolePerms[roleSel] ? `<button type="button" class="btn btn--ghost btn--sm" data-role-reset>${icon("undo")}الافتراضي</button>` : ""}${editable ? `<button type="button" class="btn btn--primary btn--sm" data-role-save>${icon("check")}حفظ الصلاحيات</button>` : ""}</div></header>
        <p class="muted small">المستخدمون التجريبيون بهذا الدور: ${usersIn.map((u) => esc(u.name)).join("، ") || "—"}</p>
        ${roleSel === "SUPER_ADMIN" ? UI.notice("مدير النظام يملك جميع الصلاحيات ولا يمكن تقييده.", "info", "lock") : !auth().can("roles.manage") ? UI.notice("عرض فقط — تعديل الصلاحيات يتطلب صلاحية «إدارة الأدوار».", "info", "lock") : ""}
        ${UI.notice("الصلاحيات في هذه النسخة تُطبق في الواجهة فقط لأغراض العرض؛ في الإنتاج يجب فرضها على الخادم لكل طلب.", "warning", "shield")}
        <div class="perm-matrix" data-perm-form>${Object.entries(groups).map(([g, list]) => `<fieldset class="perm-group"><legend>${esc(g)}</legend>${list.map((p) => `<label class="check"><input type="checkbox" value="${p.key}" ${has(p.key) ? "checked" : ""} ${editable ? "" : "disabled"}><span>${esc(p.label)}</span><small dir="ltr">${p.key}</small></label>`).join("")}</fieldset>`).join("")}</div>
      </section></div>`;
  };

  /* ---------- Policies ---------- */
  const policiesTab = () => {
    const a = S().attendance;
    const lv = S().leave;
    const p = S().payroll;
    const perf = S().performance || { selfWeight: 30, scale: 5 };
    return `${UI.notice("جميع القيم التالية أمثلة افتراضية قابلة للتعديل. لا يحتوي النظام على أي قاعدة نظامية مثبتة (استحقاقات الإجازات، الاستقطاعات، الإضافي، مكافأة نهاية الخدمة، فترة التجربة، ساعات العمل، الرسوم الحكومية).", "warning", "alert")}
      <div class="cards-grid">
        <section class="card"><header class="card__head"><h3>${icon("clock")}الحضور والانصراف</h3>${editBtn("data-pol-att")}</header><div class="info-grid info-grid--1">${UI.info("فترة السماح", `${a.grace} د`)}${UI.info("الانصراف المبكر", `${a.earlyCheckout} د`)}${UI.info("الإضافي بعد", `${a.overtimeAfter} د`)}${UI.info("الحد اليومي", `${a.maxDailyHours} س`)}${UI.info("النطاق الجغرافي", a.requireGeofence ? "إلزامي" : "معطل")}</div><footer class="card__foot"><a class="link small" href="#/attendance?tab=workplaces">مواقع العمل</a><a class="link small" href="#/shifts">الورديات</a></footer></section>
        <section class="card"><header class="card__head"><h3>${icon("palm")}الإجازات</h3>${editBtn("data-pol-leave")}</header><div class="info-grid info-grid--1">${UI.info("احتساب نهاية الأسبوع", lv.countWeekends ? "نعم" : "لا")}${UI.info("الرصيد السالب", lv.allowNegative ? "مسموح" : "غير مسموح")}${UI.info("الترحيل", `${lv.carryOverMax} يوم`)}</div><footer class="card__foot"><a class="link small" href="#/leave?tab=types">أنواع الإجازات</a></footer></section>
        <section class="card"><header class="card__head"><h3>${icon("wallet")}الرواتب</h3>${editBtn("data-pol-pay")}</header><div class="info-grid info-grid--1">${UI.info("بدل السكن", `${p.housingPct}%`)}${UI.info("بدل النقل", U.money(p.transportAmount))}${UI.info("معامل الإضافي", `× ${p.overtimeMultiplier}`)}${UI.info(p.extraDeductionLabel, `${p.extraDeductionPct}%`)}</div></section>
        <section class="card"><header class="card__head"><h3>${icon("contract")}العقود والتجربة</h3>${editBtn("data-pol-ct")}</header><div class="info-grid info-grid--1">${UI.info("تنبيهات الانتهاء", S().contracts.alerts.map((d) => `${d} يوم`).join(" / "))}${UI.info("فترة التجربة الافتراضية", `${S().contracts.probationDays} يوم`)}</div></section>
        <section class="card"><header class="card__head"><h3>${icon("target")}تقييم الأداء</h3>${editBtn("data-pol-perf")}</header><div class="info-grid info-grid--1">${UI.info("وزن التقييم الذاتي", `${perf.selfWeight}%`)}${UI.info("مقياس التقييم", `من 1 إلى ${perf.scale}`)}</div></section>
        <section class="card"><header class="card__head"><h3>${icon("door")}نهاية الخدمة</h3>${editBtn("data-pol-eos")}</header><p class="small">جهات إخلاء الطرف: ${S().clearanceDepartments.map((d) => esc(d.label)).join("، ")}</p><p class="small muted">بنود التسوية: ${S().settlementComponents.map((c) => `${esc(c.label)} (${c.mode === "auto" ? "تلقائي" : "يدوي"})`).join("، ")}</p></section>
      </div>`;
  };

  /* ---------- Workflows ---------- */
  const workflowsTab = () => {
    const wf = S().workflows;
    return `${UI.notice("حدد مراحل الاعتماد لكل نوع طلب. يُتخطى «المدير المباشر» تلقائيًا إذا لم يكن للموظف مدير، ولا يمكن لأي مستخدم اعتماد طلبه بنفسه.", "info", "flow")}
      <div class="card card--flush"><div class="tbl-wrap"><table class="tbl tbl--stack"><thead><tr><th>نوع الطلب</th><th>المراحل</th><th></th></tr></thead><tbody>${Object.entries(wf)
        .map(([k, w]) => `<tr><td data-label="نوع الطلب"><b>${esc(w.label)}</b></td><td data-label="المراحل"><div class="flow-chips">${w.steps.map((s, i) => `${i ? icon("chevron-left") : ""}<span class="chip">${esc(EHR.api.approvals.STEP_LABEL[s] || s)}</span>`).join("")}</div></td><td class="cell-actions">${canEdit() ? `<button type="button" class="icon-btn icon-btn--sm" data-wf="${k}" aria-label="تعديل مسار ${esc(w.label)}">${icon("edit")}</button>` : ""}</td></tr>`)
        .join("")}</tbody></table></div></div>`;
  };
  const editWorkflow = (key) => {
    const w = S().workflows[key];
    const fields = [0, 1, 2, 3].map((i) => ({ name: `s${i}`, label: `المرحلة ${i + 1}`, type: "select", required: i === 0, placeholder: i ? "— بدون —" : undefined, options: STEP_ROLES }));
    const vals = {};
    w.steps.forEach((s, i) => (vals[`s${i}`] = s));
    UI.formModal({
      title: `مسار اعتماد: ${w.label}`, fields, values: vals,
      async onSubmit(v) {
        const steps = [0, 1, 2, 3].map((i) => v[`s${i}`]).filter(Boolean);
        if (new Set(steps).size !== steps.length) throw new Error("لا يمكن تكرار نفس المرحلة");
        await saveSettings((s) => (s.workflows[key].steps = steps), `مسار ${w.label}`);
        UI.toast("تم حفظ المسار — يُطبق على الطلبات الجديدة", "success");
        EHR.app.refresh();
        return true;
      },
    });
  };

  /* ---------- Notifications ---------- */
  const NOTIF_KEYS = [["contractExpiry", "انتهاء العقود"], ["documentExpiry", "انتهاء المستندات"], ["lateArrival", "التأخير في الحضور"], ["missingCheckout", "نسيان تسجيل الانصراف"], ["pendingApproval", "طلبات بانتظار الموافقة"], ["payroll", "الرواتب وقسائم الرواتب"], ["training", "التدريب والشهادات"]];
  const notificationsTab = () => {
    const n = S().notifications;
    const dis = canEdit() ? "" : "disabled";
    return `<section class="card"><header class="card__head"><h3>${icon("bell")}قنوات الإشعارات</h3></header>
      <div class="toggles">
        <label class="switch"><input type="checkbox" data-ntf="inApp" ${n.inApp ? "checked" : ""} ${dis}><span></span><b>داخل النظام</b></label>
        <label class="switch is-disabled"><input type="checkbox" disabled><span></span><b>البريد الإلكتروني</b><small>يتطلب مزود بريد عبر خادم — غير متاح في النسخة التجريبية</small></label>
        <label class="switch is-disabled"><input type="checkbox" disabled><span></span><b>رسائل SMS</b><small>يتطلب مزود رسائل عبر خادم — غير متاح في النسخة التجريبية</small></label>
      </div></section>
      <section class="card"><header class="card__head"><h3>${icon("settings")}أنواع التنبيهات</h3></header><div class="toggles">${NOTIF_KEYS.map(([k, l]) => `<label class="switch"><input type="checkbox" data-ntf="${k}" ${n[k] !== false ? "checked" : ""} ${dis}><span></span><b>${l}</b></label>`).join("")}</div></section>`;
  };

  /* ---------- Lists ---------- */
  const LISTS = [["documentTypes", "أنواع المستندات", "folder"], ["assetTypes", "أنواع العهد", "laptop"], ["requestTypes", "أنواع الطلبات", "inbox"]];
  const listsTab = () => `<div class="cards-grid">${LISTS.map(([k, l, ic]) => `<section class="card"><header class="card__head"><h3>${icon(ic)}${l}</h3>${editBtn(`data-list="${k}"`)}</header><div class="flow-chips">${S()[k].map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></section>`).join("")}</div>`;

  /* ---------- Privacy ---------- */
  const privacyTab = () => {
    const p = S().privacy;
    const dis = canEdit() ? "" : "disabled";
    return `<section class="card"><header class="card__head"><h3>${icon("shield")}الخصوصية وحماية البيانات</h3></header>
      <div class="toggles">
        <label class="switch"><input type="checkbox" data-priv="showDemographics" ${p.showDemographics ? "checked" : ""} ${dis}><span></span><b>إظهار تقارير الجنس والجنسية</b><small>معطّل افتراضيًا. فعّله فقط عند وجود مسوّغ نظامي واضح (مثل متطلبات التوطين) ولأصحاب صلاحية التحليلات.</small></label>
        <label class="switch is-disabled"><input type="checkbox" disabled><span></span><b>عرض المواقع الدقيقة للموظفين على خريطة</b><small>غير مدعوم عمدًا: يظهر فقط داخل/خارج النطاق والمسافة لأصحاب الصلاحية.</small></label>
      </div></section>
      <section class="card"><header class="card__head"><h3>${icon("lock")}ممارسات مطبقة في النسخة التجريبية</h3></header><ul class="bullets">
        <li>البيانات الحساسة (الراتب، الهوية، الآيبان) مخفية عن الأدوار غير المخوّلة.</li>
        <li>المدير يرى فريقه فقط، والموظف يرى بياناته فقط.</li>
        <li>لا تُخزن كلمات مرور أو مفاتيح أو بيانات حيوية (Biometric) في المتصفح.</li>
        <li>الموقع يُقرأ لحظة التسجيل فقط ولا يُتتبع الموظف.</li>
        <li>سجل التدقيق لا يحفظ محتوى البيانات الحساسة.</li>
      </ul>${UI.notice("التخزين المحلي (localStorage) ليس تخزينًا آمنًا ولا يصلح لبيانات حقيقية.", "danger", "alert")}</section>`;
  };

  /* ---------- Integrations ---------- */
  const INTEGRATIONS = [["qiwa", "منصة قوى", "مزامنة العقود وبيانات العاملين"], ["gosi", "التأمينات الاجتماعية", "تسجيل المشتركين والأجور"], ["mudad", "مُدد", "حماية الأجور وملفات الرواتب"], ["bank", "ربط البنوك", "ملفات صرف الرواتب"]];
  const integrationsTab = () => `${UI.notice("لا توجد أي تكاملات فعلية في هذه النسخة. البطاقات التالية توضح التكاملات المخطط لها مستقبلًا، وتتطلب خادمًا آمنًا واتفاقيات ربط رسمية.", "warning", "info")}
    <div class="cards-grid cards-grid--sm">${INTEGRATIONS.map(([k, l, d]) => `<article class="card integ"><span class="integ__icon">${icon("plug")}</span><b>${esc(l)}</b><small>${esc(d)}</small>${UI.badge("مستقبلي — غير مرتبط", "gray")}<button type="button" class="btn btn--ghost btn--sm" disabled>ربط</button></article>`).join("")}</div>`;

  /* ---------- System ---------- */
  const systemTab = () => {
    let size = 0;
    try {
      size = (localStorage.getItem("easyhr:v1:data") || "").length;
    } catch (e) {
      size = 0;
    }
    const db = EHR.db;
    return `<div class="cards-grid">
      <section class="card"><header class="card__head"><h3>${icon("info")}حالة النظام</h3>${UI.badge("وضع تجريبي", "warning")}</header>
        <div class="info-grid info-grid--1">${UI.info("الإصدار", "Easy HR — نسخة عرض 1.0")}${UI.info("مصدر البيانات", "بيانات تجريبية في المتصفح (localStorage)")}${UI.info("حجم البيانات المحلية", `${U.round(size / 1024, 1)} KB`)}${UI.info("تاريخ التوليد", U.fmtStamp(db.meta.seededAt))}${UI.info("الموظفون / السجلات", `${db.employees.length} / ${db.attendance.length} سجل حضور`)}</div></section>
      <section class="card"><header class="card__head"><h3>${icon("refresh")}البيانات التجريبية</h3></header>
        <p class="small">يعيد النظام إلى حالته الأصلية ويحذف كل ما أضفته أو عدّلته في هذا المتصفح.</p>
        <div class="btn-row"><button type="button" class="btn btn--danger" data-reset-demo>${icon("refresh")}إعادة ضبط البيانات التجريبية</button><button type="button" class="btn btn--ghost" data-export-json>${icon("download")}تصدير نسخة JSON</button></div></section>
      <section class="card"><header class="card__head"><h3>${icon("moon")}المظهر واللغة</h3></header>
        <div class="seg" role="radiogroup" aria-label="المظهر">${[["light", "نهاري"], ["dark", "ليلي"]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${EHR.theme.get() === k}" class="seg__btn ${EHR.theme.get() === k ? "active" : ""}" data-theme-set="${k}">${l}</button>`).join("")}</div>
        <p class="small mt">اللغة: العربية (RTL). بنية النصوص مجهزة لإضافة الإنجليزية لاحقًا.</p></section>
      <section class="card"><header class="card__head"><h3>${icon("server")}متطلبات التشغيل الفعلي</h3></header><ul class="bullets small"><li>خادم API وقاعدة بيانات (مثل PostgreSQL) مع عزل بيانات الشركات.</li><li>مصادقة حقيقية (كلمات مرور مشفرة، MFA، SSO).</li><li>فرض الصلاحيات والتحقق من الموقع والوقت على الخادم.</li><li>تخزين ملفات آمن ونسخ احتياطي وسجل تدقيق غير قابل للتعديل.</li></ul></section>
    </div>`;
  };

  /* ---------- Audit ---------- */
  const renderAudit = (el) => {
    el.innerHTML = '<div class="card card--flush"><div data-audit></div></div>';
    const R = auth().ROLE_DEFS;
    UI.table($("[data-audit]", el), {
      id: "audit",
      rows: () => EHR.db.audit.filter((a) => a.companyId === auth().companyId()),
      search: (a) => `${a.userName} ${a.action} ${a.module} ${a.record}`,
      searchPlaceholder: "ابحث في السجل…",
      filters: [
        { key: "module", label: "كل الوحدات", options: () => [...new Set(EHR.db.audit.map((a) => a.module))].map((m) => [m, m]), test: (a, v) => a.module === v },
        { key: "status", label: "كل النتائج", options: [["success", "ناجحة"], ["failed", "فاشلة"]], test: (a, v) => a.status === v },
      ],
      defaultSort: { key: "at", dir: -1 },
      pageSize: 15,
      columns: [
        { key: "at", label: "الوقت", render: (a) => `<span class="num">${U.fmtStamp(a.at)}</span>`, sort: (a) => a.at },
        { key: "user", label: "المستخدم", render: (a) => `<b>${esc(a.userName)}</b><small class="block muted">${esc(a.role ? R[a.role].label : "—")}</small>`, sort: (a) => a.userName },
        { key: "action", label: "الإجراء", render: (a) => esc(a.action) },
        { key: "module", label: "الوحدة", render: (a) => esc(a.module) },
        { key: "record", label: "السجل", render: (a) => `<small class="clamp-1">${esc(a.record)}</small>` },
        { key: "status", label: "النتيجة", render: (a) => (a.status === "failed" ? UI.badge("فشل", "danger") : UI.badge("نجاح", "success")) },
      ],
      exportName: "audit-log",
      exportColumns: [["الوقت", (a) => a.at], ["المستخدم", (a) => a.userName], ["الدور", (a) => (a.role ? R[a.role].label : "")], ["الإجراء", (a) => a.action], ["الوحدة", (a) => a.module], ["السجل", (a) => a.record], ["النتيجة", (a) => a.status]],
    });
  };

  /* ---------- Page ---------- */
  let tab = "company";
  EHR.view("settings", {
    title: "الإعدادات",
    render(ctx) {
      const tabs = [["company", "الشركة"], ["roles", "الأدوار والصلاحيات"], ["policies", "السياسات"], ["workflows", "مسارات الاعتماد"], ["notifications", "الإشعارات"], ["lists", "القوائم"], ["privacy", "الخصوصية"], ["integrations", "التكاملات"], ["system", "حالة النظام"]];
      if (auth().can("audit.view")) tabs.push(["audit", "سجل التدقيق"]);
      if (ctx.query.tab && tabs.some((t) => t[0] === ctx.query.tab)) tab = ctx.query.tab;
      if (!tabs.some((t) => t[0] === tab)) tab = "company";
      ctx.el.innerHTML = `
        ${H.pageHead("الإعدادات", canEdit() ? "إعدادات الشركة والسياسات والصلاحيات — كل التغييرات تُسجل في سجل التدقيق" : "عرض الإعدادات (قراءة فقط لدورك)", "settings")}
        ${UI.tabs("set", tabs, tab, "tabs--scroll")}
        <div data-set-body></div>`;
      const body = $("[data-set-body]", ctx.el);
      const map = { company: companyTab, roles: rolesTab, policies: policiesTab, workflows: workflowsTab, notifications: notificationsTab, lists: listsTab, privacy: privacyTab, integrations: integrationsTab, system: systemTab };
      if (tab === "audit") renderAudit(body);
      else body.innerHTML = map[tab]();
      if (Object.keys(ctx.query).length) {
        history.replaceState(null, "", "#/settings");
        ctx.query = {};
      }
      const self = this;
      const again = () => self.render(ctx);
      ctx.el.onclick = async (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="set"]');
        if (tb) { tab = tb.dataset.tab; return again(); }
        if (t.closest("[data-set-company]")) return editCompany();
        if (t.closest("[data-hol-add]"))
          return UI.formModal({ title: "إضافة عطلة رسمية", fields: [{ name: "name", label: "اسم العطلة", required: true }, { name: "date", label: "التاريخ", type: "date", required: true }, { name: "days", label: "عدد الأيام", type: "number", min: 1, max: 30, required: true }], values: { days: 1 }, async onSubmit(v) { await saveSettings((s) => { for (let i = 0; i < Number(v.days); i++) s.attendance.holidays.push({ date: U.addDays(v.date, i), name: v.name }); s.attendance.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)); }, `عطلة: ${v.name}`); UI.toast("تمت إضافة العطلة", "success"); again(); return true; } });
        const hd = t.closest("[data-hol-del]");
        if (hd) { await saveSettings((s) => s.attendance.holidays.splice(Number(hd.dataset.holDel), 1), "حذف عطلة"); UI.toast("تم حذف العطلة", "info"); return again(); }
        const rs = t.closest("[data-role-sel]");
        if (rs) { roleSel = rs.dataset.roleSel; return again(); }
        if (t.closest("[data-role-save]")) {
          const perms = $$("[data-perm-form] input:checked", ctx.el).map((i) => i.value);
          if (!perms.includes("dashboard.view")) return UI.toast("يجب الإبقاء على صلاحية عرض لوحة التحكم", "error");
          await UI.run(t.closest("button"), () => EHR.api.call(() => { EHR.db.rolePerms = EHR.db.rolePerms || {}; EHR.db.rolePerms[roleSel] = perms; EHR.api.audit.log("تعديل صلاحيات", "الأدوار", auth().ROLE_DEFS[roleSel].label); }), "تم حفظ صلاحيات الدور");
          return EHR.app.rerenderShell();
        }
        if (t.closest("[data-role-reset]")) {
          await EHR.api.call(() => { delete EHR.db.rolePerms[roleSel]; EHR.api.audit.log("استعادة الصلاحيات الافتراضية", "الأدوار", auth().ROLE_DEFS[roleSel].label); });
          UI.toast("تمت استعادة الصلاحيات الافتراضية", "info");
          return EHR.app.rerenderShell();
        }
        if (t.closest("[data-pol-att]")) return EHR.openAttendanceRules();
        if (t.closest("[data-pol-leave]")) return EHR.openLeavePolicy();
        if (t.closest("[data-pol-pay]")) return EHR.openPayrollRules();
        if (t.closest("[data-pol-ct]"))
          return UI.formModal({ title: "العقود والتجربة", fields: [{ name: "alerts", label: "أيام التنبيه قبل انتهاء العقد (مفصولة بفواصل)", required: true, pattern: "^\\s*\\d+(\\s*,\\s*\\d+)*\\s*$", patternMsg: "أرقام مفصولة بفواصل مثل 30,60,90" }, { name: "probationDays", label: "فترة التجربة الافتراضية (يوم)", type: "number", min: 0, max: 365, required: true, hint: "حسب سياسة المنشأة والعقد" }], values: { alerts: S().contracts.alerts.join(","), probationDays: S().contracts.probationDays }, async onSubmit(v) { await saveSettings((s) => { s.contracts.alerts = v.alerts.split(",").map((x) => Number(x.trim())).sort((a, b) => a - b); s.contracts.probationDays = Number(v.probationDays); }, "العقود"); UI.toast("تم الحفظ", "success"); again(); return true; } });
        if (t.closest("[data-pol-perf]"))
          return UI.formModal({ title: "إعدادات تقييم الأداء", fields: [{ name: "selfWeight", label: "وزن التقييم الذاتي في النتيجة (%)", type: "number", min: 0, max: 100, required: true }, { name: "scale", label: "أعلى درجة في المقياس", type: "number", min: 3, max: 10, required: true }], values: S().performance || { selfWeight: 30, scale: 5 }, async onSubmit(v) { await saveSettings((s) => (s.performance = { selfWeight: Number(v.selfWeight), scale: Number(v.scale) }), "الأداء"); UI.toast("تم الحفظ", "success"); again(); return true; } });
        if (t.closest("[data-pol-eos]"))
          return UI.formModal({ title: "جهات إخلاء الطرف", subtitle: "سطر لكل جهة بالصيغة: المفتاح|الاسم|الدور (HR أو FINANCE أو MANAGER أو SUPER_ADMIN)", fields: [{ name: "deps", label: "الجهات", type: "textarea", rows: 7, full: true, required: true, dir: "rtl" }], values: { deps: S().clearanceDepartments.map((d) => `${d.key}|${d.label}|${d.role}`).join("\n") }, async onSubmit(v) { const deps = v.deps.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0]); if (deps.some((d) => d.length < 3 || !["HR", "FINANCE", "MANAGER", "SUPER_ADMIN"].includes(d[2]))) throw new Error("صيغة غير صحيحة في أحد الأسطر"); await saveSettings((s) => (s.clearanceDepartments = deps.map(([key, label, role]) => ({ key, label, role }))), "جهات إخلاء الطرف"); UI.toast("تم الحفظ — يُطبق على الملفات الجديدة", "success"); again(); return true; } });
        const wf = t.closest("[data-wf]");
        if (wf) return editWorkflow(wf.dataset.wf);
        const ls = t.closest("[data-list]");
        if (ls) {
          const key = ls.dataset.list;
          return UI.formModal({ title: LISTS.find((x) => x[0] === key)[1], subtitle: "عنصر في كل سطر", fields: [{ name: "items", label: "العناصر", type: "textarea", rows: 9, full: true, required: true }], values: { items: S()[key].join("\n") }, async onSubmit(v) { const items = [...new Set(v.items.split("\n").map((x) => x.trim()).filter(Boolean))]; await saveSettings((s) => (s[key] = items), LISTS.find((x) => x[0] === key)[1]); UI.toast("تم الحفظ", "success"); again(); return true; } });
        }
        if (t.closest("[data-reset-demo]")) {
          const ok = await UI.confirm({ title: "إعادة ضبط البيانات التجريبية", text: "سيتم حذف جميع التعديلات التي أجريتها في هذا المتصفح واستعادة البيانات التجريبية الأصلية. هل تريد المتابعة؟", confirmLabel: "إعادة الضبط", danger: true });
          if (!ok) return;
          const uid = (auth().user() || {}).id;
          EHR.store.reset();
          if (uid) auth().loginAs(uid, false);
          UI.toast("تمت إعادة ضبط البيانات التجريبية", "success");
          history.replaceState(null, "", "#/dashboard");
          return EHR.app.rerenderShell();
        }
        if (t.closest("[data-export-json]")) {
          const blob = new Blob([JSON.stringify(EHR.db, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `easyhr-demo-data-${U.today()}.json`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
          EHR.api.audit.log("تصدير البيانات", "النظام", "JSON");
          return UI.toast("تم تصدير نسخة JSON من البيانات التجريبية", "info");
        }
        const th = t.closest("[data-theme-set]");
        if (th) { EHR.theme.set(th.dataset.themeSet); return again(); }
      };
      ctx.el.onchange = async (e) => {
        const n = e.target.closest("[data-ntf]");
        if (n) { await saveSettings((s) => (s.notifications[n.dataset.ntf] = n.checked), `إشعارات: ${n.dataset.ntf}`); return UI.toast("تم حفظ إعداد الإشعارات", "success"); }
        const p = e.target.closest("[data-priv]");
        if (p) { await saveSettings((s) => (s.privacy[p.dataset.priv] = p.checked), `الخصوصية: ${p.dataset.priv}`); return UI.toast("تم حفظ إعداد الخصوصية", "success"); }
      };
    },
  });
})((window.EHR = window.EHR || {}));
