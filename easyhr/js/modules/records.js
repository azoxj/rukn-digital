/* =========================================================
   Easy HR — records & services: documents, assets (custody),
   disciplinary, employee requests + approvals inbox, travel,
   transfers & promotions
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const { $, esc, icon } = U;

  const auth = () => EHR.auth;
  const me = () => EHR.auth.me();
  const L = () => EHR.L;
  const empOptions = () => L().inCompany(EHR.db.employees).filter((e) => e.status !== "archived").map((e) => [e.id, `${e.nameAr} — ${e.id}`]);
  const fileSize = (b) => (b ? (b > 1048576 ? `${U.round(b / 1048576, 1)} MB` : `${Math.round(b / 1024)} KB`) : "");
  const IDENTITY = ["هوية وطنية", "إقامة", "جواز سفر"];

  /* =========================================================
     Documents
     ========================================================= */
  const canManageDocs = () => auth().can("documents.manage");
  const docs = EHR.crud({
    key: "documents", title: "المستندات", icon: "folder",
    subtitle: "مستندات الموظفين مع تواريخ الانتهاء والتنبيهات. رفع الملفات في النسخة التجريبية محاكى (يُحفظ اسم الملف فقط).",
    api: EHR.api.documents, statuses: H.S.doc, statusKey: "_st",
    rows: () => EHR.api.documents.visible().map((d) => Object.assign(d, { _st: H.docStatus(d) })),
    tabs: [["all", "الكل"], ["expiring", "تنتهي خلال 30 يومًا", (d) => d._st === "expiring"], ["expired", "منتهية", (d) => d._st === "expired"], ["valid", "سارية", (d) => d._st === "valid"]],
    stats: (rows) => [
      { label: "إجمالي المستندات", value: rows.length, iconName: "folder" },
      { label: "تنتهي خلال 30 يومًا", value: rows.filter((d) => d._st === "expiring").length, iconName: "clock", tone: "warning" },
      { label: "منتهية", value: rows.filter((d) => d._st === "expired").length, iconName: "alert", tone: "danger" },
    ],
    columns: [
      { key: "emp", label: "الموظف", render: (d) => H.emp(d.employeeId), sort: (d) => L().empName(d.employeeId) },
      { key: "name", label: "المستند", render: (d) => `<b>${esc(d.name)}</b><small class="block muted">${esc(d.category)}</small>`, sort: (d) => d.name },
      { key: "number", label: "الرقم", render: (d) => (d.number ? (IDENTITY.includes(d.category) && !auth().can("employees.sensitive") && !(me() && me().id === d.employeeId) ? H.sensitive("") : `<span dir="ltr" class="num">${esc(d.number)}</span>`) : "—") },
      { key: "expiry", label: "الانتهاء", render: (d) => (d.expiry ? `${U.fmtDate(d.expiry)}<small class="block muted">${U.relDays(d.expiry)}</small>` : "—"), sort: (d) => d.expiry || "9999" },
      { key: "file", label: "الملف", render: (d) => `${icon("file")} <small>${esc(d.fileName)}</small>` },
      { key: "status", label: "الحالة", render: (d) => UI.status(H.S.doc, d._st), sort: (d) => d._st },
    ],
    filters: [{ key: "category", label: "كل الأنواع", options: () => L().settings().documentTypes.map((t) => [t, t]), test: (d, v) => d.category === v }],
    search: (d) => `${d.name} ${d.category} ${L().empName(d.employeeId)} ${d.fileName}`,
    searchPlaceholder: "ابحث باسم المستند أو الموظف…",
    defaultSort: { key: "expiry", dir: 1 },
    exportName: "documents",
    exportColumns: [["الموظف", (d) => L().empName(d.employeeId)], ["النوع", (d) => d.category], ["المستند", (d) => d.name], ["الإصدار", (d) => d.issue || ""], ["الانتهاء", (d) => d.expiry || ""], ["الحالة", (d) => H.S.doc[d._st].label]],
    canCreate: () => canManageDocs() || (!!me() && auth().can("documents.self")),
    createLabel: "رفع مستند",
    formFields: (rec) => [
      ...(canManageDocs() ? [{ name: "employeeId", label: "الموظف", type: "select", required: true, options: empOptions() }] : []),
      { name: "category", label: "نوع المستند", type: "select", required: true, options: L().settings().documentTypes },
      { name: "name", label: "اسم المستند", required: true },
      { name: "number", label: "رقم المستند", dir: "ltr" },
      { name: "issue", label: "تاريخ الإصدار", type: "date" },
      { name: "expiry", label: "تاريخ الانتهاء", type: "date", validate: (v, a) => (v && a.issue && v <= a.issue ? "الانتهاء بعد الإصدار" : "") },
      { name: "file", label: "الملف", type: "file", full: true, required: !rec, accept: ".pdf,image/*" },
    ],
    defaults: () => ({ employeeId: (me() || {}).id, category: "أخرى" }),
    toRecord: (v, rec) => ({
      employeeId: v.employeeId || (rec ? rec.employeeId : me().id), category: v.category, name: v.name, number: v.number, issue: v.issue || null, expiry: v.expiry || null,
      fileName: v.file ? v.file.name : rec.fileName, size: v.file ? v.file.size : rec.size, uploadedAt: v.file ? U.stamp() : rec.uploadedAt, storage: "simulated",
    }),
    idPrefix: "DOC",
    createdMsg: "تم رفع المستند (تخزين محاكى)",
    canEdit: () => canManageDocs(),
    detailTitle: (d) => esc(d.name),
    detailSubtitle: (d) => `${esc(L().empName(d.employeeId))} · ${esc(d.category)}`,
    detailBody: (d) => `<div class="info-grid">${UI.info("الموظف", H.empLink(d.employeeId))}${UI.info("النوع", esc(d.category))}${UI.info("الرقم", d.number ? `<span dir="ltr">${esc(d.number)}</span>` : "—")}${UI.info("الإصدار", U.fmtDate(d.issue))}${UI.info("الانتهاء", d.expiry ? `${U.fmtDate(d.expiry)} (${U.relDays(d.expiry)})` : "بدون تاريخ انتهاء")}${UI.info("تاريخ الرفع", U.fmtStamp(d.uploadedAt))}</div>
      <div class="file-row">${icon("file")}<div><b>${esc(d.fileName)}</b><small>${fileSize(d.size)} · تخزين محاكى</small></div><button type="button" class="btn btn--ghost btn--sm" disabled title="غير متاح في النسخة التجريبية">${icon("download")}تنزيل</button></div>
      ${UI.notice("في النسخة الإنتاجية تُحفظ الملفات في تخزين آمن على الخادم مع صلاحيات وصول وروابط مؤقتة.", "info", "shield")}`,
    detailActions: () => [
      { label: "حذف", icon: "trash", cls: "btn--danger-ghost", danger: true, confirm: "سيتم حذف المستند نهائيًا من النظام.", when: () => canManageDocs(), run: (d) => EHR.api.documents.remove(d.id, "المستندات"), success: "تم حذف المستند" },
    ],
  });
  EHR.view("documents", { title: "المستندات", render: docs.render });

  /* =========================================================
     Assets / custody
     ========================================================= */
  const canManageAssets = () => auth().can("assets.manage");
  const handoverDoc = (a, action = "تسليم") => `<div class="head"><h1>نموذج ${action} عهدة</h1><p>${esc(L().company(a.companyId).name)}</p></div>
    <div class="grid"><p><b>رقم العهدة:</b> ${a.id}</p><p><b>النوع:</b> ${esc(a.type)}</p><p><b>الوصف:</b> ${esc(a.name)}</p><p><b>الرقم التسلسلي:</b> ${esc(a.serial)}</p><p><b>الموظف:</b> ${esc(L().empName(a.employeeId))}</p><p><b>التاريخ:</b> ${U.fmtDate(a.issueDate || U.today())}</p><p><b>الحالة:</b> ${esc(a.condition)}</p></div>
    <p>يقر الموظف باستلام العهدة الموضحة أعلاه بحالة سليمة، ويلتزم بالمحافظة عليها وإعادتها عند الطلب أو عند انتهاء الخدمة.</p><div class="sign"><span>المستلم</span><span>المسلِّم</span><span>الموارد البشرية</span></div>`;
  const assets = EHR.crud({
    key: "assets", title: "العهد والأصول", icon: "laptop",
    subtitle: "تسجيل العهد وتسليمها واستلامها وحالتها وسجلها، وربطها بإخلاء الطرف",
    api: EHR.api.assets, statuses: H.S.asset,
    rows: () => (auth().scope("assets") === "all" ? EHR.api.assets.all() : EHR.api.assets.visible().filter((a) => a.employeeId)),
    tabs: [["all", "الكل"], ["assigned", "مسلّمة", (a) => a.status === "assigned"], ["available", "متاحة", (a) => a.status === "available"], ["maintenance", "صيانة", (a) => a.status === "maintenance"], ["retired", "مستبعدة", (a) => a.status === "retired"]],
    stats: (rows) => [
      { label: "إجمالي العهد", value: rows.length, iconName: "laptop" },
      { label: "مسلّمة للموظفين", value: rows.filter((a) => a.status === "assigned").length, iconName: "user-check", tone: "brand" },
      { label: "متاحة", value: rows.filter((a) => a.status === "available").length, iconName: "check-circle", tone: "success" },
      ...(canManageAssets() ? [{ label: "القيمة الدفترية", value: U.num(U.sum(rows.filter((a) => a.status !== "retired"), (a) => a.value)), unit: " ر.س", iconName: "wallet", tone: "info" }] : []),
    ],
    columns: [
      { key: "id", label: "الرقم", render: (a) => `<b class="num">${a.id}</b>`, sort: (a) => a.id },
      { key: "name", label: "العهدة", render: (a) => `<b>${esc(a.name)}</b><small class="block muted">${esc(a.type)} · <span dir="ltr">${esc(a.serial)}</span></small>`, sort: (a) => a.name },
      { key: "emp", label: "المستلم", render: (a) => (a.employeeId ? H.emp(a.employeeId) : '<span class="muted">—</span>'), sort: (a) => L().empName(a.employeeId) },
      { key: "date", label: "تاريخ التسليم", render: (a) => U.fmtDate(a.issueDate), sort: (a) => a.issueDate || "" },
      { key: "cond", label: "الحالة الفنية", render: (a) => esc(a.condition) },
      { key: "status", label: "الوضع", render: (a) => UI.status(H.S.asset, a.status), sort: (a) => a.status },
    ],
    filters: [{ key: "type", label: "كل الأنواع", options: () => L().settings().assetTypes.map((t) => [t, t]), test: (a, v) => a.type === v }],
    search: (a) => `${a.id} ${a.name} ${a.serial} ${a.type} ${L().empName(a.employeeId)}`,
    searchPlaceholder: "ابحث بالرقم أو التسلسلي أو الموظف…",
    defaultSort: { key: "id", dir: 1 },
    exportName: "assets",
    exportColumns: [["الرقم", (a) => a.id], ["النوع", (a) => a.type], ["الوصف", (a) => a.name], ["التسلسلي", (a) => a.serial], ["الموظف", (a) => (a.employeeId ? L().empName(a.employeeId) : "")], ["الوضع", (a) => H.S.asset[a.status].label]],
    canCreate: canManageAssets,
    createLabel: "إضافة عهدة",
    formFields: () => [
      { name: "type", label: "النوع", type: "select", required: true, options: L().settings().assetTypes },
      { name: "name", label: "الوصف / الطراز", required: true },
      { name: "serial", label: "الرقم التسلسلي", required: true, dir: "ltr", validate: (v) => (EHR.db.assets.some((a) => a.serial === v) ? "الرقم التسلسلي مسجل مسبقًا" : "") },
      { name: "value", label: "القيمة (ر.س)", type: "number", min: 0 },
      { name: "condition", label: "الحالة الفنية", type: "select", options: ["جديد", "جيدة جدًا", "جيدة", "مقبولة", "تحتاج صيانة", "تالف"] },
    ],
    defaults: () => ({ condition: "جديد", value: 0 }),
    toRecord: (v) => ({ type: v.type, name: v.name, serial: v.serial, value: Number(v.value) || 0, condition: v.condition, status: "available", employeeId: null, issueDate: null, returnDate: null, history: [{ date: U.today(), action: "إضافة للمخزون" }] }),
    idPrefix: "AS",
    detailTitle: (a) => `${esc(a.name)} <small class="muted num">${a.id}</small>`,
    detailSubtitle: (a) => `${esc(a.type)} · ${esc(a.serial)}`,
    detailBody: (a) => `<div class="info-grid">${UI.info("المستلم", a.employeeId ? H.empLink(a.employeeId) : "—")}${UI.info("تاريخ التسليم", U.fmtDate(a.issueDate))}${UI.info("الحالة الفنية", esc(a.condition))}${canManageAssets() ? UI.info("القيمة", U.money(a.value)) : ""}${a.returnDate ? UI.info("تاريخ الإرجاع", U.fmtDate(a.returnDate)) : ""}</div>
      ${UI.section("سجل العهدة", `<ul class="timeline">${(a.history || []).slice().reverse().map((h) => `<li><b>${esc(h.action)}</b><small>${U.fmtDate(h.date)}${h.employeeId ? ` · ${esc(L().empName(h.employeeId))}` : ""}${h.note ? ` · ${esc(h.note)}` : ""}</small></li>`).join("") || '<li class="muted">لا يوجد</li>'}</ul>`, "history")}`,
    detailActions: () => [
      {
        label: "تسليم لموظف", icon: "user-plus", cls: "btn--primary", custom: true, when: (a) => canManageAssets() && a.status === "available",
        run: (a, btn, m) => UI.formModal({
          title: `تسليم ${a.name}`, fields: [{ name: "employeeId", label: "الموظف", type: "select", required: true, options: empOptions() }, { name: "date", label: "تاريخ التسليم", type: "date", required: true }, { name: "condition", label: "الحالة عند التسليم", type: "select", options: ["جديد", "جيدة جدًا", "جيدة", "مقبولة"] }],
          values: { date: U.today(), condition: a.condition },
          async onSubmit(v) {
            await EHR.api.assets.update(a.id, (x) => {
              Object.assign(x, { employeeId: v.employeeId, issueDate: v.date, condition: v.condition, status: "assigned", returnDate: null });
              x.history = x.history || [];
              x.history.push({ date: v.date, action: "تسليم", employeeId: v.employeeId });
            }, "العهد", "تسليم");
            UI.toast("تم تسليم العهدة — يمكنك طباعة نموذج التسليم", "success");
            m.close();
            EHR.app.refresh();
            return true;
          },
        }),
      },
      {
        label: "استلام (إرجاع)", icon: "undo", custom: true, when: (a) => canManageAssets() && a.status === "assigned",
        run: (a, btn, m) => UI.formModal({
          title: `استلام ${a.name}`, fields: [{ name: "condition", label: "الحالة عند الاستلام", type: "select", options: ["جيدة جدًا", "جيدة", "مقبولة", "تحتاج صيانة", "تالف"] }, { name: "note", label: "ملاحظات", type: "textarea", full: true }],
          values: { condition: a.condition },
          async onSubmit(v) {
            await EHR.api.assets.update(a.id, (x) => {
              x.history = x.history || [];
              x.history.push({ date: U.today(), action: "استلام", employeeId: x.employeeId, note: v.note });
              Object.assign(x, { employeeId: null, returnDate: U.today(), condition: v.condition, status: ["تحتاج صيانة", "تالف"].includes(v.condition) ? "maintenance" : "available" });
            }, "العهد", "استلام");
            UI.toast("تم استلام العهدة", "success");
            m.close();
            EHR.app.refresh();
            return true;
          },
        }),
      },
      { label: "إرسال للصيانة", icon: "tool", when: (a) => canManageAssets() && a.status === "available", run: (a) => EHR.api.assets.update(a.id, (x) => { x.status = "maintenance"; x.history.push({ date: U.today(), action: "صيانة" }); }, "العهد", "صيانة"), success: "تم التحديث" },
      { label: "إعادة للمخزون", icon: "check", when: (a) => canManageAssets() && a.status === "maintenance", run: (a) => EHR.api.assets.update(a.id, (x) => { x.status = "available"; x.condition = "جيدة"; x.history.push({ date: U.today(), action: "انتهاء الصيانة" }); }, "العهد"), success: "تم التحديث" },
      { label: "استبعاد", icon: "archive", cls: "btn--danger-ghost", danger: true, confirm: "سيتم استبعاد العهدة من الاستخدام.", when: (a) => canManageAssets() && ["available", "maintenance"].includes(a.status), run: (a) => EHR.api.assets.update(a.id, (x) => { x.status = "retired"; x.history.push({ date: U.today(), action: "استبعاد" }); }, "العهد", "استبعاد"), success: "تم الاستبعاد" },
    ],
    printable: (a) => (a.employeeId ? handoverDoc(a) : `<div class="head"><h1>بطاقة عهدة</h1></div><div class="grid"><p><b>الرقم:</b> ${a.id}</p><p><b>الوصف:</b> ${esc(a.name)}</p><p><b>التسلسلي:</b> ${esc(a.serial)}</p><p><b>الوضع:</b> ${H.S.asset[a.status].label}</p></div>`),
  });
  EHR.view("assets", { title: "العهد والأصول", render: assets.render });

  /* =========================================================
     Disciplinary
     ========================================================= */
  const DS = H.S.disciplinary;
  const canManageDisc = () => auth().can("disciplinary.manage");
  const disciplinary = EHR.crud({
    key: "disciplinary", title: "المخالفات والجزاءات", icon: "gavel",
    subtitle: "تسجيل المخالفات والتحقيق والقرار. لا يُطبّق أي جزاء تلقائيًا — يلزم قرار معتمد، ولا يُخصم من الراتب إلا عند تفعيل ذلك صراحةً.",
    api: EHR.api.disciplinary, statuses: DS, approvalCollection: "disciplinary",
    tabs: [["all", "الكل"], ["open", "مفتوحة", (d) => ["open", "investigation", "pending_approval"].includes(d.status)], ["decided", "صدر القرار", (d) => d.status === "decided"], ["closed", "مغلقة", (d) => ["closed", "rejected"].includes(d.status)]],
    stats: (rows) => [
      { label: "حالات مفتوحة", value: rows.filter((d) => ["open", "investigation", "pending_approval"].includes(d.status)).length, iconName: "gavel", tone: "warning" },
      { label: "قيد التحقيق", value: rows.filter((d) => d.status === "investigation").length, iconName: "search", tone: "info" },
      { label: `قرارات ${U.today().slice(0, 4)}`, value: rows.filter((d) => ["decided", "closed"].includes(d.status) && d.date.startsWith(U.today().slice(0, 4))).length, iconName: "check", tone: "gray" },
    ],
    columns: [
      { key: "emp", label: "الموظف", render: (d) => H.emp(d.employeeId), sort: (d) => L().empName(d.employeeId) },
      { key: "date", label: "التاريخ", render: (d) => U.fmtDate(d.date), sort: (d) => d.date },
      { key: "type", label: "النوع", render: (d) => UI.badge(d.type, "gray", false) },
      { key: "desc", label: "الوصف", render: (d) => `<span class="clamp-2">${esc(d.description)}</span>` },
      { key: "action", label: "الإجراء", render: (d) => `${esc(d.action)}${d.amount ? `<small class="block muted">${U.money(d.amount)}${d.applyToPayroll ? " · يُخصم بالرواتب" : ""}</small>` : ""}` },
      { key: "status", label: "الحالة", render: (d) => UI.status(DS, d.status), sort: (d) => d.status },
    ],
    filters: [{ key: "type", label: "كل الأنواع", options: [["إنذار", "إنذار"], ["مخالفة", "مخالفة"], ["تحقيق", "تحقيق"], ["خصم", "خصم"], ["إيقاف", "إيقاف"]], test: (d, v) => d.type === v }],
    search: (d) => `${L().empName(d.employeeId)} ${d.description} ${d.id}`,
    defaultSort: { key: "date", dir: -1 },
    exportName: "disciplinary",
    exportColumns: [["الرقم", (d) => d.id], ["الموظف", (d) => L().empName(d.employeeId)], ["التاريخ", (d) => d.date], ["النوع", (d) => d.type], ["الوصف", (d) => d.description], ["الإجراء", (d) => d.action], ["المبلغ", (d) => d.amount || 0], ["الحالة", (d) => DS[d.status].label]],
    canCreate: canManageDisc,
    createLabel: "تسجيل مخالفة",
    formSize: "lg",
    formFields: () => [
      { name: "employeeId", label: "الموظف", type: "select", required: true, options: empOptions() },
      { name: "date", label: "تاريخ الواقعة", type: "date", required: true, max: U.today() },
      { name: "type", label: "النوع", type: "select", options: ["مخالفة", "إنذار", "تحقيق", "خصم", "إيقاف"], required: true },
      { name: "description", label: "وصف الواقعة", type: "textarea", full: true, required: true },
      { name: "action", label: "الإجراء المقترح", required: true, full: true, hint: "وفق لائحة الجزاءات المعتمدة لدى المنشأة" },
      { name: "amount", label: "المبلغ المالي المقترح (إن وجد)", type: "number", min: 0 },
      { name: "applyToPayroll", label: "خصم المبلغ من الرواتب بعد صدور القرار المعتمد", type: "checkbox", full: true },
      { name: "attachment", label: "مرفق", type: "file", full: true },
    ],
    defaults: () => ({ date: U.today(), type: "مخالفة", amount: 0 }),
    toRecord: (v, rec) => ({ employeeId: v.employeeId, date: v.date, type: v.type, description: v.description, action: v.action, amount: Number(v.amount) || 0, applyToPayroll: !!v.applyToPayroll && Number(v.amount) > 0, attachments: v.attachment ? [v.attachment.name] : rec ? rec.attachments : [], status: rec ? rec.status : "open", approval: rec ? rec.approval : null }),
    idPrefix: "DS",
    canEdit: (d) => canManageDisc() && ["open", "investigation"].includes(d.status),
    detailTitle: (d) => `${esc(d.type)} — ${esc(L().empName(d.employeeId))}`,
    detailSubtitle: (d) => `${d.id} · ${U.fmtDate(d.date)}`,
    detailBody: (d) => `${UI.stepper([["open", "تسجيل"], ["investigation", "تحقيق"], ["pending_approval", "اعتماد"], ["decided", "القرار"], ["closed", "إغلاق"]], Math.max(0, ["open", "investigation", "pending_approval", "decided", "closed"].indexOf(d.status)) + (d.status === "closed" ? 1 : 0), { compact: true, rejected: d.status === "rejected" })}
      <div class="info-grid">${UI.info("الموظف", H.empLink(d.employeeId))}${UI.info("النوع", esc(d.type))}${UI.info("الإجراء", esc(d.action))}${UI.info("المبلغ", d.amount ? U.money(d.amount) : "—")}${UI.info("الخصم من الرواتب", d.applyToPayroll ? "نعم بعد القرار" : "لا")}${UI.info("المعتمد", d.approverId ? esc(L().empName(d.approverId)) : "—")}</div>
      ${UI.section("الوصف", `<p>${esc(d.description)}</p>`, "note")}
      ${d.investigation ? UI.section("محضر التحقيق", `<p>${esc(d.investigation)}</p>`, "search") : ""}
      ${d.employeeResponse ? UI.section("إفادة الموظف", `<p>${esc(d.employeeResponse)}</p>`, "user") : ""}
      ${(d.attachments || []).length ? UI.section("المرفقات", d.attachments.map((a) => `<div class="file-row">${icon("file")}<div><b>${esc(a)}</b><small>ملف محاكى</small></div></div>`).join(""), "file") : ""}`,
    detailActions: () => [
      {
        label: "تسجيل التحقيق", icon: "search", custom: true, when: (d) => canManageDisc() && ["open", "investigation"].includes(d.status),
        run: (d, btn, m) => UI.formModal({
          title: "محضر التحقيق وإفادة الموظف", size: "lg",
          fields: [{ name: "investigation", label: "ملخص التحقيق", type: "textarea", full: true, required: true, rows: 4 }, { name: "employeeResponse", label: "إفادة الموظف (حق الرد)", type: "textarea", full: true, rows: 3 }],
          values: d,
          async onSubmit(v) {
            await EHR.api.disciplinary.update(d.id, { ...v, status: "investigation" }, "المخالفات", "تحقيق");
            UI.toast("تم حفظ محضر التحقيق", "success");
            m.close();
            EHR.app.refresh();
            return true;
          },
        }),
      },
      {
        label: "رفع للاعتماد", icon: "send", cls: "btn--primary", when: (d) => canManageDisc() && ["open", "investigation"].includes(d.status),
        run: (d) => EHR.api.disciplinary.update(d.id, (x) => {
          x.approval = EHR.api.approvals.build("disciplinary", x.employeeId);
          x.status = "pending_approval";
          EHR.api.notifications.push({ to: { roles: ["HR_MANAGER"] }, type: "approval", title: "قرار جزاء بانتظار الاعتماد", body: `${L().empName(x.employeeId)} — ${x.type}`, link: `#/disciplinary?open=${x.id}` });
        }, "المخالفات", "رفع للاعتماد"),
        success: "تم رفع القرار للاعتماد",
      },
      { label: "إغلاق الحالة", icon: "lock", when: (d) => canManageDisc() && d.status === "decided", run: (d) => EHR.api.disciplinary.update(d.id, { status: "closed" }, "المخالفات", "إغلاق"), success: "تم إغلاق الحالة" },
      { label: "إلغاء", icon: "x", cls: "btn--danger-ghost", danger: true, confirm: "سيتم إلغاء المخالفة دون أي إجراء.", when: (d) => canManageDisc() && ["open", "investigation"].includes(d.status), run: (d) => EHR.api.disciplinary.update(d.id, { status: "rejected" }, "المخالفات", "إلغاء"), success: "تم الإلغاء" },
    ],
  });
  EHR.view("disciplinary", { title: "المخالفات والجزاءات", render: disciplinary.render });

  /* =========================================================
     Requests + approvals inbox
     ========================================================= */
  const RQ = { ...H.S.request, cancelled: { label: "ملغى", tone: "gray" } };
  const LETTER_TYPES = ["شهادة راتب", "شهادة تعريف بالراتب", "خطاب تعريف"];
  const letterHTML = (r) => {
    const e = L().emp(r.employeeId);
    const co = L().company(r.companyId);
    const salary = r.type !== "خطاب تعريف";
    const s = EHR.db.settings[e.companyId].payroll;
    const total = e.basicSalary + Math.round((e.basicSalary * s.housingPct) / 100) + (e.transportAllowance ?? s.transportAmount) + (e.otherAllowance || 0);
    return `<div class="head"><h1>${esc(r.type)}</h1><p>${esc(co.name)} — ${U.fmtLong(U.today())}</p></div>
      <p>إلى من يهمه الأمر،</p><p>تشهد ${esc(co.name)} بأن السيد/ة <b>${esc(e.nameAr)}</b> (${esc(e.nationality)}) يعمل لديها بوظيفة <b>${esc(L().titleName(e.jobTitleId))}</b> منذ ${U.fmtDate(e.joinDate)} وما زال على رأس العمل حتى تاريخه${salary ? `، ويتقاضى راتبًا شهريًا إجماليًا قدره <b>${U.money(total)}</b>` : ""}.</p>
      <p>وقد أُعطي هذا الخطاب بناءً على طلبه دون أدنى مسؤولية على الشركة.</p><p class="muted">رقم المرجع: ${r.id} — مستند تجريبي صادر من Easy HR.</p><div class="sign"><span>مدير الموارد البشرية</span><span>الختم</span></div>`;
  };
  const requests = EHR.crud({
    key: "requests", title: "الطلبات", icon: "inbox", embedded: true, noCreateButton: true,
    api: EHR.api.requests, statuses: RQ, approvalCollection: "requests",
    tabs: [["all", "الكل"], ["mine", "بانتظار موافقتي", (r) => EHR.api.approvals.canAct(r)], ["open", "قيد الإجراء", (r) => ["new", "pending"].includes(r.status)], ["approved", "معتمدة", (r) => r.status === "approved"], ["done", "مكتملة/مغلقة", (r) => ["completed", "rejected", "cancelled"].includes(r.status)]],
    columns: [
      { key: "id", label: "رقم الطلب", render: (r) => `<b class="num">${r.id}</b>`, sort: (r) => r.id },
      { key: "emp", label: "الموظف", render: (r) => H.emp(r.employeeId), sort: (r) => L().empName(r.employeeId) },
      { key: "type", label: "النوع", render: (r) => `<b>${esc(r.type)}</b><small class="block muted clamp-1">${esc(r.details)}</small>` },
      { key: "date", label: "التاريخ", render: (r) => U.fmtDate(r.date), sort: (r) => r.createdAt },
      { key: "step", label: "المرحلة", render: (r) => { const st = EHR.api.approvals.currentStep(r); return st ? esc(EHR.api.approvals.STEP_LABEL[st.role]) : "—"; } },
      { key: "status", label: "الحالة", render: (r) => UI.status(RQ, r.status), sort: (r) => r.status },
    ],
    filters: [{ key: "type", label: "كل الأنواع", options: () => L().settings().requestTypes.map((t) => [t, t]), test: (r, v) => r.type === v }],
    search: (r) => `${r.id} ${r.type} ${r.details} ${L().empName(r.employeeId)}`,
    searchPlaceholder: "ابحث برقم الطلب أو النوع أو الموظف…",
    defaultSort: { key: "date", dir: -1 },
    exportName: "requests",
    exportColumns: [["الرقم", (r) => r.id], ["الموظف", (r) => L().empName(r.employeeId)], ["النوع", (r) => r.type], ["التفاصيل", (r) => r.details], ["التاريخ", (r) => r.date], ["الحالة", (r) => RQ[r.status].label]],
    canCreate: () => !!me() && auth().can("requests.submit"),
    createLabel: "طلب جديد",
    formFields: () => [
      { name: "type", label: "نوع الطلب", type: "select", required: true, options: L().settings().requestTypes },
      { name: "details", label: "التفاصيل", type: "textarea", full: true, required: true },
      { name: "attachment", label: "مرفق (اختياري)", type: "file", full: true },
    ],
    defaults: () => ({ type: "شهادة راتب" }),
    create: (v) => EHR.api.submitWithApproval("requests", "request", { id: `REQ-${U.today().slice(0, 4)}-${String(EHR.db.requests.length + 1).padStart(3, "0")}${Math.random().toString(36).slice(2, 4).toUpperCase()}`, employeeId: me().id, type: v.type, details: v.details, attachment: v.attachment ? v.attachment.name : null, date: U.today(), comments: [] }, "الطلبات"),
    createdMsg: "تم تقديم الطلب",
    detailTitle: (r) => `${esc(r.type)} — ${esc(L().empName(r.employeeId))}`,
    detailSubtitle: (r) => `${r.id} · ${U.fmtDate(r.date)}`,
    detailBody: (r) => `<div class="info-grid">${UI.info("مقدم الطلب", H.empLink(r.employeeId))}${UI.info("النوع", esc(r.type))}${UI.info("التاريخ", U.fmtDate(r.date))}${UI.info("المرفق", r.attachment ? esc(r.attachment) : "—")}</div>${UI.section("التفاصيل", `<p>${esc(r.details)}</p>`, "note")}
      ${UI.section("التعليقات", (r.comments || []).length ? `<ul class="comments">${r.comments.map((c) => `<li>${UI.avatar(c.by, "xs")}<div><b>${esc(c.by)}</b><small>${U.fmtStamp(c.at)}</small><p>${esc(c.text)}</p></div></li>`).join("")}</ul>` : '<p class="muted">لا توجد تعليقات</p>', "chat")}`,
    detailActions: () => [
      {
        label: "إضافة تعليق", icon: "chat", custom: true, when: (r) => !["cancelled"].includes(r.status),
        run: async (r, btn, m) => {
          const c = await UI.prompt({ title: "إضافة تعليق", label: "التعليق", required: true, confirmLabel: "إضافة" });
          if (c === null) return;
          await UI.run(btn, () => EHR.api.requests.update(r.id, (x) => { x.comments = x.comments || []; x.comments.push({ by: (auth().user() || {}).name, at: U.stamp(), text: c }); }, "الطلبات", "تعليق"), "تمت إضافة التعليق");
          m.close();
          EHR.app.refresh();
          requests.openDetail(r.id);
        },
      },
      { label: "إصدار الخطاب", icon: "print", when: (r) => LETTER_TYPES.includes(r.type) && ["approved", "completed"].includes(r.status) && (auth().can("requests.view") || (me() && me().id === r.employeeId)), custom: true, run: (r) => U.printHTML(r.type, letterHTML(r)) },
      { label: "إتمام الطلب", icon: "check-circle", cls: "btn--success", when: (r) => r.status === "approved" && auth().can("requests.view"), run: (r) => EHR.api.requests.update(r.id, (x) => { x.status = "completed"; EHR.api.notifications.push({ companyId: x.companyId, to: { employeeIds: [x.employeeId] }, type: "request", title: "تم إنجاز طلبك", body: `${x.type} — ${x.id}`, link: `#/requests?open=${x.id}` }); }, "الطلبات", "إتمام"), success: "تم إتمام الطلب وإشعار الموظف" },
      { label: "إلغاء الطلب", icon: "x", cls: "btn--danger-ghost", danger: true, confirm: "هل تريد إلغاء الطلب؟", when: (r) => me() && r.employeeId === me().id && ["new", "pending"].includes(r.status), run: (r) => EHR.api.requests.update(r.id, (x) => { x.status = "cancelled"; if (x.approval) x.approval.current = -1; }, "الطلبات", "إلغاء"), success: "تم إلغاء الطلب" },
    ],
  });

  const renderInbox = (el) => {
    const items = EHR.api.approvals.pendingForMe();
    el.innerHTML = items.length
      ? `<div class="card card--flush"><div data-inbox></div></div>`
      : `<div class="card">${UI.empty({ icon: "check-circle", title: "صندوق الموافقات فارغ", text: "لا توجد طلبات بانتظار إجرائك حاليًا." })}</div>`;
    if (!items.length) return;
    UI.table($("[data-inbox]", el), {
      id: "inbox",
      rows: () => EHR.api.approvals.pendingForMe(),
      search: (x) => `${x.def.label} ${L().empName(x.rec.employeeId || x.rec.requestedBy)} ${x.rec.id}`,
      searchPlaceholder: "ابحث في الموافقات…",
      filters: [{ key: "type", label: "كل الأنواع", options: EHR.api.approvals.APPROVABLE.map((d) => [d.type, d.label]), test: (x, v) => x.def.type === v }],
      columns: [
        { key: "type", label: "النوع", render: (x) => UI.badge(x.def.label, "brand", false) },
        { key: "emp", label: "مقدم الطلب", render: (x) => H.emp(x.rec.employeeId || x.rec.requestedBy) },
        { key: "id", label: "المرجع", render: (x) => `<span class="num">${x.rec.id}</span>` },
        { key: "step", label: "مرحلتك", render: (x) => esc(EHR.api.approvals.STEP_LABEL[EHR.api.approvals.currentStep(x.rec).role]) },
        { key: "at", label: "منذ", render: (x) => `<small>${U.ago(x.rec.createdAt)}</small>`, sort: (x) => x.rec.createdAt },
        {
          key: "act", label: "الإجراء", cls: "cell-actions",
          render: (x) => `<div class="row-actions"><button type="button" class="btn btn--ghost btn--sm" data-go="${x.def.route}${x.def.route.includes("?") ? "&" : "?"}open=${x.rec.id}">${icon("eye")}عرض</button><button type="button" class="btn btn--success btn--sm" data-quick="approve" data-col="${x.def.collection}" data-id="${x.rec.id}">${icon("check")}اعتماد</button><button type="button" class="btn btn--danger-ghost btn--sm" data-quick="reject" data-col="${x.def.collection}" data-id="${x.rec.id}">${icon("x")}رفض</button></div>`,
        },
      ],
      defaultSort: { key: "at", dir: -1 },
      exportName: "approvals-inbox",
      exportColumns: [["النوع", (x) => x.def.label], ["مقدم الطلب", (x) => L().empName(x.rec.employeeId || x.rec.requestedBy)], ["المرجع", (x) => x.rec.id]],
    });
  };

  let reqTab = "requests";
  EHR.view("requests", {
    title: "الطلبات",
    render(ctx) {
      const q = ctx.query;
      const canInbox = auth().canAny(EHR.api.approvals.APPROVABLE.map((d) => d.perm).concat(["requests.approve"])) || auth().role() === "SUPER_ADMIN";
      const tabs = [["requests", "الطلبات"]];
      const inboxCount = EHR.api.approvals.pendingForMe().length;
      if (canInbox) tabs.push(["inbox", "صندوق الموافقات", inboxCount]);
      if (q.tab && tabs.some((t) => t[0] === q.tab)) reqTab = q.tab;
      if (q.open || q.new) reqTab = "requests";
      if (!tabs.some((t) => t[0] === reqTab)) reqTab = "requests";
      const vis = EHR.api.requests.visible();
      ctx.el.innerHTML = `
        ${H.pageHead("الطلبات", "طلبات الموظفين (شهادات، خطابات، تحديث بيانات، استئذان…) وصندوق الموافقات الموحد", "inbox",
          me() && auth().can("requests.submit") ? `<button type="button" class="btn btn--primary" data-req-new>${icon("plus")}طلب جديد</button>` : "")}
        <div class="kpis kpis--sm">
          ${UI.kpi({ label: "بانتظار موافقتي (كل الأنواع)", value: inboxCount, iconName: "bell", tone: "warning", attrs: canInbox ? 'data-req-tab="inbox"' : "" })}
          ${UI.kpi({ label: "طلبات قيد الإجراء", value: vis.filter((r) => ["new", "pending"].includes(r.status)).length, iconName: "hourglass", tone: "info" })}
          ${UI.kpi({ label: "مكتملة هذا الشهر", value: vis.filter((r) => r.status === "completed" && (r.updatedAt || r.createdAt).slice(0, 7) === U.today().slice(0, 7)).length, iconName: "check-circle", tone: "success" })}
        </div>
        ${tabs.length > 1 ? UI.tabs("req", tabs, reqTab) : ""}
        <div data-req-body></div>`;
      const body = $("[data-req-body]", ctx.el);
      if (reqTab === "requests") requests.render({ el: body, query: { open: q.open, new: q.new }, view: "requests" });
      else renderInbox(body);
      if (Object.keys(q).length) {
        history.replaceState(null, "", "#/requests");
        ctx.query = {};
      }
      const self = this;
      ctx.el.onclick = async (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="req"]') || t.closest("[data-req-tab]");
        if (tb) { reqTab = tb.dataset.tab || tb.dataset.reqTab; return self.render(ctx); }
        if (t.closest("[data-req-new]")) return requests.openForm(null);
        const qb = t.closest("[data-quick]");
        if (qb) {
          const dec = qb.dataset.quick;
          const c = await UI.prompt({ title: dec === "approve" ? "اعتماد" : "رفض", label: dec === "approve" ? "ملاحظة (اختياري)" : "سبب الرفض", required: dec === "reject", danger: dec === "reject", confirmLabel: dec === "approve" ? "اعتماد" : "رفض" });
          if (c === null) return;
          if ((await UI.run(null, () => EHR.api.approvals.act(qb.dataset.col, qb.dataset.id, dec, c), dec === "approve" ? "تم الاعتماد" : "تم الرفض")) !== undefined) EHR.app.rerenderShell();
        }
      };
    },
  });

  /* =========================================================
     Travel & assignments
     ========================================================= */
  const TV = { ...H.S.approval };
  const tripDays = (t) => U.diffDays(t.from, t.to) + 1;
  const travel = EHR.crud({
    key: "travel", title: "السفر والانتداب", icon: "plane",
    subtitle: "طلبات سفر العمل والانتداب الداخلي والخارجي مع البدل اليومي ومسار الاعتماد",
    api: EHR.api.travel, statuses: TV, approvalCollection: "travel",
    tabs: [["all", "الكل"], ["mine", "بانتظار موافقتي", (t) => EHR.api.approvals.canAct(t)], ["upcoming", "قادمة", (t) => t.status === "approved" && t.from >= U.today()], ["pending", "قيد الاعتماد", (t) => t.status === "pending"], ["done", "مكتملة", (t) => t.status === "completed"]],
    stats: (rows) => [
      { label: "رحلات قادمة", value: rows.filter((t) => t.status === "approved" && t.from >= U.today()).length, iconName: "plane" },
      { label: "في مهمة الآن", value: rows.filter((t) => t.status === "approved" && t.from <= U.today() && t.to >= U.today()).length, iconName: "pin", tone: "info" },
      { label: "بدلات السنة المعتمدة", value: U.num(U.sum(rows.filter((t) => ["approved", "completed"].includes(t.status) && t.from.startsWith(U.today().slice(0, 4))), (t) => t.perDiem * tripDays(t))), unit: " ر.س", iconName: "wallet", tone: "success" },
    ],
    columns: [
      { key: "emp", label: "الموظف", render: (t) => H.emp(t.employeeId), sort: (t) => L().empName(t.employeeId) },
      { key: "dest", label: "الوجهة", render: (t) => `<b>${esc(t.destination)}</b><small class="block muted">${esc(t.kind)}</small>` },
      { key: "from", label: "الفترة", render: (t) => `${U.fmtShort(t.from)} – ${U.fmtShort(t.to)}<small class="block muted">${U.dayPhrase(tripDays(t))}</small>`, sort: (t) => t.from },
      { key: "per", label: "البدل", render: (t) => `${H.money(t.perDiem * tripDays(t))}<small class="block muted">${U.money(t.perDiem)}/يوم</small>`, sort: (t) => t.perDiem * tripDays(t) },
      { key: "status", label: "الحالة", render: (t) => UI.status(TV, t.status), sort: (t) => t.status },
    ],
    search: (t) => `${L().empName(t.employeeId)} ${t.destination} ${t.purpose} ${t.id}`,
    defaultSort: { key: "from", dir: -1 },
    exportName: "travel",
    exportColumns: [["الرقم", (t) => t.id], ["الموظف", (t) => L().empName(t.employeeId)], ["الوجهة", (t) => t.destination], ["النوع", (t) => t.kind], ["من", (t) => t.from], ["إلى", (t) => t.to], ["البدل", (t) => t.perDiem * tripDays(t)], ["الحالة", (t) => TV[t.status].label]],
    canCreate: () => !!me() && auth().can("travel.request"),
    createLabel: "طلب سفر/انتداب",
    formFields: () => [
      { name: "kind", label: "النوع", type: "select", options: ["سفر عمل", "انتداب داخلي", "انتداب خارجي"], required: true },
      { name: "destination", label: "الوجهة", required: true },
      { name: "purpose", label: "الغرض", type: "textarea", full: true, required: true },
      { name: "from", label: "من", type: "date", required: true },
      { name: "to", label: "إلى", type: "date", required: true, validate: (v, a) => (v < a.from ? "النهاية قبل البداية" : "") },
      { name: "perDiem", label: "البدل اليومي (ر.س)", type: "number", min: 0, required: true, hint: "حسب سياسة الانتداب في المنشأة" },
      { name: "transport", label: "وسيلة التنقل", type: "select", options: ["طيران", "سيارة الشركة", "سيارة خاصة", "قطار", "حافلة"] },
    ],
    defaults: () => ({ kind: "سفر عمل", from: U.addDays(U.today(), 7), to: U.addDays(U.today(), 9), perDiem: 500, transport: "طيران" }),
    create: (v) => EHR.api.submitWithApproval("travel", "travel", { id: U.uid("TRV"), employeeId: me().id, kind: v.kind, destination: v.destination, purpose: v.purpose, from: v.from, to: v.to, perDiem: Number(v.perDiem), transport: v.transport }, "السفر"),
    createdMsg: "تم إرسال الطلب للاعتماد",
    detailTitle: (t) => `${esc(t.kind)} إلى ${esc(t.destination)}`,
    detailSubtitle: (t) => `${esc(L().empName(t.employeeId))} · ${t.id}`,
    detailBody: (t) => `<div class="info-grid">${UI.info("الفترة", `${U.fmtDate(t.from)} – ${U.fmtDate(t.to)}`)}${UI.info("المدة", U.dayPhrase(tripDays(t)))}${UI.info("البدل اليومي", U.money(t.perDiem))}${UI.info("إجمالي البدل", U.money(t.perDiem * tripDays(t)))}${UI.info("التنقل", esc(t.transport || "—"))}</div>${UI.section("الغرض", `<p>${esc(t.purpose)}</p>`, "note")}${t.report ? UI.section("تقرير المهمة", `<p>${esc(t.report)}</p>`, "file") : ""}`,
    detailActions: () => [
      {
        label: "إغلاق المهمة", icon: "check-circle", custom: true, when: (t) => t.status === "approved" && t.from <= U.today() && ((me() && me().id === t.employeeId) || auth().can("travel.view")),
        run: (t, btn, m) => UI.formModal({ title: "تقرير إنجاز المهمة", fields: [{ name: "report", label: "ملخص ما تم إنجازه", type: "textarea", full: true, required: true }], async onSubmit(v) { await EHR.api.travel.update(t.id, { status: "completed", report: v.report }, "السفر", "إغلاق"); UI.toast("تم إغلاق المهمة", "success"); m.close(); EHR.app.refresh(); return true; } }),
      },
    ],
  });
  EHR.view("travel", { title: "السفر والانتداب", render: travel.render });

  /* =========================================================
     Transfers & promotions
     ========================================================= */
  const TR = { ...H.S.approval };
  const describe = (obj) =>
    Object.entries(obj || {})
      .map(([k, v]) => {
        if (k === "branchId") return `الفرع: ${L().branchName(v)}`;
        if (k === "departmentId") return `الإدارة: ${L().deptName(v)}`;
        if (k === "jobTitleId") return `المسمى: ${L().titleName(v)}`;
        if (k === "jobTitle") return `المسمى: ${v}`;
        if (k === "gradeId") return `الدرجة: ${(L().grade(v) || {}).name || v}`;
        if (k === "basicSalary") return `الراتب: ${U.money(v)}`;
        return "";
      })
      .filter(Boolean)
      .join(" · ");
  const transfers = EHR.crud({
    key: "transfers", title: "النقل والترقيات", icon: "swap",
    subtitle: "نقل الموظفين بين الفروع والإدارات والترقيات مع مسار اعتماد، ثم التنفيذ على ملف الموظف في تاريخ السريان",
    api: EHR.api.transfers, statuses: TR, approvalCollection: "transfers",
    tabs: [["all", "الكل"], ["mine", "بانتظار موافقتي", (t) => EHR.api.approvals.canAct(t)], ["pending", "قيد الاعتماد", (t) => t.status === "pending"], ["approved", "معتمدة للتنفيذ", (t) => t.status === "approved"], ["done", "منفذة", (t) => t.status === "completed"]],
    columns: [
      { key: "emp", label: "الموظف", render: (t) => H.emp(t.employeeId), sort: (t) => L().empName(t.employeeId) },
      { key: "kind", label: "النوع", render: (t) => UI.badge(t.kind === "promotion" ? "ترقية" : "نقل", t.kind === "promotion" ? "success" : "info", false) },
      { key: "change", label: "التغيير", render: (t) => `<small class="block muted">${esc(describe(t.from))}</small><b>${esc(describe(t.to))}</b>` },
      { key: "eff", label: "السريان", render: (t) => U.fmtDate(t.effective), sort: (t) => t.effective },
      { key: "status", label: "الحالة", render: (t) => UI.status(TR, t.status), sort: (t) => t.status },
    ],
    filters: [{ key: "kind", label: "كل الأنواع", options: [["transfer", "نقل"], ["promotion", "ترقية"]], test: (t, v) => t.kind === v }],
    search: (t) => `${L().empName(t.employeeId)} ${t.id} ${t.reason}`,
    defaultSort: { key: "eff", dir: -1 },
    exportName: "transfers",
    exportColumns: [["الرقم", (t) => t.id], ["الموظف", (t) => L().empName(t.employeeId)], ["النوع", (t) => (t.kind === "promotion" ? "ترقية" : "نقل")], ["من", (t) => describe(t.from)], ["إلى", (t) => describe(t.to)], ["السريان", (t) => t.effective], ["الحالة", (t) => TR[t.status].label]],
    canCreate: () => auth().can("transfers.manage"),
    createLabel: "طلب نقل/ترقية",
    formSize: "lg",
    formFields: () => [
      { name: "employeeId", label: "الموظف", type: "select", required: true, options: empOptions() },
      { name: "kind", label: "النوع", type: "select", options: [["transfer", "نقل"], ["promotion", "ترقية"]], required: true },
      { name: "branchId", label: "الفرع الجديد", type: "select", placeholder: "بدون تغيير", options: L().inCompany(EHR.db.branches).map((b) => [b.id, b.name]) },
      { name: "departmentId", label: "الإدارة الجديدة", type: "select", placeholder: "بدون تغيير", options: L().inCompany(EHR.db.departments).map((d) => [d.id, d.name]) },
      { name: "jobTitleId", label: "المسمى الجديد", type: "select", placeholder: "بدون تغيير", options: L().inCompany(EHR.db.jobTitles).map((j) => [j.id, j.name]) },
      { name: "gradeId", label: "الدرجة الجديدة", type: "select", placeholder: "بدون تغيير", options: L().inCompany(EHR.db.grades).map((g) => [g.id, g.name]) },
      { name: "basicSalary", label: "الراتب الأساسي الجديد (اختياري)", type: "number", min: 0 },
      { name: "effective", label: "تاريخ السريان", type: "date", required: true },
      { name: "reason", label: "المبرر", type: "textarea", full: true, required: true },
    ],
    defaults: () => ({ kind: "transfer", effective: U.addDays(U.today(), 14) }),
    validate: (v) => (!v.branchId && !v.departmentId && !v.jobTitleId && !v.gradeId && !v.basicSalary ? { branchId: "حدد تغييرًا واحدًا على الأقل" } : null),
    create: (v) => {
      const e = L().emp(v.employeeId);
      const to = {};
      const from = {};
      ["branchId", "departmentId", "jobTitleId", "gradeId"].forEach((k) => {
        if (v[k] && v[k] !== e[k]) { to[k] = v[k]; from[k] = e[k]; }
      });
      if (v.basicSalary) { to.basicSalary = Number(v.basicSalary); from.basicSalary = e.basicSalary; }
      return EHR.api.submitWithApproval("transfers", "transfer", { id: U.uid("TRF"), employeeId: e.id, kind: v.kind, from, to, effective: v.effective, reason: v.reason }, "النقل والترقيات");
    },
    createdMsg: "تم إرسال الطلب لمسار الاعتماد",
    detailTitle: (t) => `${t.kind === "promotion" ? "ترقية" : "نقل"} — ${esc(L().empName(t.employeeId))}`,
    detailSubtitle: (t) => t.id,
    detailBody: (t) => `<div class="compare"><div><small>الوضع الحالي</small><b>${esc(describe(t.from)) || "—"}</b></div>${icon("arrow-left")}<div><small>بعد التنفيذ</small><b>${esc(describe(t.to)) || "—"}</b></div></div>
      <div class="info-grid">${UI.info("تاريخ السريان", U.fmtDate(t.effective))}${UI.info("المبرر", esc(t.reason))}</div>
      ${t.status === "approved" ? UI.notice("الطلب معتمد وجاهز للتنفيذ على ملف الموظف.", "success", "check") : ""}`,
    detailActions: () => [
      {
        label: "تنفيذ على ملف الموظف", icon: "check-circle", cls: "btn--success", when: (t) => t.status === "approved" && auth().can("transfers.manage"),
        confirm: "سيتم تحديث بيانات الموظف (الفرع/الإدارة/المسمى/الدرجة/الراتب) وتوثيق ذلك في سجله.",
        run: (t) => EHR.api.transfers.update(t.id, (x) => {
          const e = L().emp(x.employeeId);
          const to = x.to || {};
          ["branchId", "departmentId", "jobTitleId", "gradeId", "basicSalary"].forEach((k) => to[k] != null && (e[k] = to[k]));
          if (to.jobTitle) {
            const jt = EHR.db.jobTitles.find((j) => j.companyId === e.companyId && j.name === to.jobTitle);
            if (jt) e.jobTitleId = jt.id;
          }
          if (to.branchId) {
            const wp = EHR.db.workplaces.find((w) => w.branchId === to.branchId && w.status === "active");
            if (wp) { e.primaryWorkplaceId = wp.id; e.workplaceIds = Array.from(new Set([wp.id, ...(e.workplaceIds || [])])); }
          }
          e.timeline.push({ date: x.effective, title: x.kind === "promotion" ? "ترقية" : "نقل", detail: describe(to), icon: "swap" });
          x.status = "completed";
          x.executedAt = U.stamp();
        }, "النقل والترقيات", "تنفيذ"),
        success: "تم التنفيذ وتحديث ملف الموظف",
      },
    ],
  });
  EHR.view("transfers", { title: "النقل والترقيات", render: transfers.render });
})((window.EHR = window.EHR || {}));
