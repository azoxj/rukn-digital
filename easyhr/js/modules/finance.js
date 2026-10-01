/* =========================================================
   Easy HR — contracts, payroll, advances, allowances & benefits
   All rates come from company settings (editable). Nothing here
   encodes a legal rule or government fee.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const E = EHR.engine;
  const { $, esc, icon } = U;

  const auth = () => EHR.auth;
  const me = () => EHR.auth.me();
  const L = () => EHR.L;
  const CT = H.S.contractType;
  const sens = (html, empId) => (auth().can("employees.sensitive") || auth().can("payroll.view") || (me() && me().id === empId) ? html : H.sensitive(html));

  /* =========================================================
     Contracts
     ========================================================= */
  const daysLeft = (c) => (c.end ? U.daysFromToday(c.end) : null);
  const expiryBadge = (c) => {
    const n = daysLeft(c);
    if (n == null || !["active", "renewal"].includes(c.status)) return "";
    if (n < 0) return UI.badge("منتهٍ", "danger");
    if (n <= 30) return UI.badge(`${n} يومًا متبقية`, "danger");
    if (n <= 60) return UI.badge(`${n} يومًا متبقية`, "warning");
    if (n <= 90) return UI.badge(`${n} يومًا متبقية`, "info");
    return "";
  };
  const contractFields = () => [
    { name: "employeeId", label: "الموظف", type: "select", required: true, options: L().inCompany(EHR.db.employees).filter((e) => e.status !== "archived").map((e) => [e.id, `${e.nameAr} — ${e.id}`]) },
    { name: "number", label: "رقم العقد", required: true, dir: "ltr" },
    { name: "type", label: "نوع العقد", type: "select", options: Object.entries(CT), required: true },
    { name: "start", label: "تاريخ البداية", type: "date", required: true },
    { name: "end", label: "تاريخ النهاية", type: "date", hint: "اتركه فارغًا للعقد غير محدد المدة", validate: (v, all) => (v && all.start && v <= all.start ? "النهاية يجب أن تكون بعد البداية" : all.type !== "permanent" && !v ? "مطلوب لهذا النوع من العقود" : "") },
    { name: "salary", label: "الراتب الأساسي (ر.س)", type: "number", min: 0, required: true },
    { name: "allowances", label: "إجمالي البدلات (ر.س)", type: "number", min: 0 },
    { name: "hours", label: "ساعات العمل اليومية", type: "number", min: 1, max: 12, required: true },
    { name: "workplaceId", label: "موقع العمل", type: "select", options: L().inCompany(EHR.db.workplaces).map((w) => [w.id, w.name]) },
    { name: "notes", label: "ملاحظات / شروط خاصة", type: "textarea", full: true },
    { name: "file", label: "نسخة العقد", type: "file", full: true },
  ];
  const renewContract = async (c) => {
    const len = c.end && c.start ? U.diffDays(c.start, c.end) : 365;
    const start = U.addDays(c.end || U.today(), 1);
    const rec = await EHR.api.contracts.create({
      id: U.uid("CT"), employeeId: c.employeeId, number: `${c.number}-R`, type: c.type === "probation" ? "fixed" : c.type, start, end: U.addDays(start, Math.max(365, len)),
      salary: c.salary, allowances: c.allowances, hours: c.hours, workplaceId: c.workplaceId, status: "draft", approval: null, renewalOf: c.id,
    }, "العقود");
    await EHR.api.contracts.update(c.id, { status: "renewal", renewedBy: rec.id }, "العقود", "بدء التجديد");
    return rec;
  };
  const contracts = EHR.crud({
    key: "contracts", title: "العقود", icon: "contract",
    subtitle: "دورة حياة العقد: مسودة ← مراجعة ← اعتماد ← ساري ← تجديد/انتهاء، مع تنبيهات 30/60/90 يومًا",
    api: EHR.api.contracts, statuses: H.S.contract, approvalCollection: "contracts",
    rows: () => EHR.api.contracts.visible(),
    tabs: [
      ["all", "الكل"],
      ["active", "سارية", (c) => c.status === "active"],
      ["expiring", "تنتهي خلال 90 يومًا", (c) => ["active", "renewal"].includes(c.status) && daysLeft(c) != null && daysLeft(c) >= 0 && daysLeft(c) <= 90],
      ["draft", "مسودات ومراجعة", (c) => ["draft", "review", "approved"].includes(c.status)],
      ["expired", "منتهية", (c) => c.status === "expired"],
    ],
    stats: (rows) => {
      const act = rows.filter((c) => ["active", "renewal"].includes(c.status) && c.end);
      const within = (n) => act.filter((c) => daysLeft(c) >= 0 && daysLeft(c) <= n).length;
      return [
        { label: "عقود سارية", value: rows.filter((c) => c.status === "active").length, iconName: "contract", tone: "success" },
        { label: "تنتهي خلال 30 يومًا", value: within(30), iconName: "alert", tone: "danger" },
        { label: "خلال 60 يومًا", value: within(60), iconName: "clock", tone: "warning" },
        { label: "خلال 90 يومًا", value: within(90), iconName: "calendar", tone: "info" },
      ];
    },
    columns: [
      { key: "number", label: "رقم العقد", render: (c) => `<b dir="ltr" class="num">${esc(c.number)}</b>${c.renewalOf ? '<small class="block muted">تجديد</small>' : ""}`, sort: (c) => c.number },
      { key: "emp", label: "الموظف", render: (c) => H.emp(c.employeeId), sort: (c) => L().empName(c.employeeId) },
      { key: "type", label: "النوع", render: (c) => esc(CT[c.type] || c.type) },
      { key: "start", label: "البداية", render: (c) => U.fmtDate(c.start), sort: (c) => c.start },
      { key: "end", label: "النهاية", render: (c) => `${c.end ? U.fmtDate(c.end) : "غير محدد"}${expiryBadge(c) ? `<span class="block">${expiryBadge(c)}</span>` : ""}`, sort: (c) => c.end || "9999" },
      { key: "salary", label: "الراتب", render: (c) => sens(H.money(c.salary), c.employeeId), sort: (c) => c.salary },
      { key: "status", label: "الحالة", render: (c) => UI.status(H.S.contract, c.status), sort: (c) => c.status },
    ],
    filters: [
      { key: "type", label: "كل الأنواع", options: Object.entries(CT), test: (c, v) => c.type === v },
      { key: "status", label: "كل الحالات", options: Object.entries(H.S.contract).map(([k, v]) => [k, v.label]), test: (c, v) => c.status === v },
    ],
    search: (c) => `${c.number} ${L().empName(c.employeeId)} ${c.employeeId}`,
    searchPlaceholder: "ابحث برقم العقد أو اسم الموظف…",
    defaultSort: { key: "end", dir: 1 },
    exportName: "contracts",
    exportColumns: [["رقم العقد", (c) => c.number], ["الموظف", (c) => L().empName(c.employeeId)], ["النوع", (c) => CT[c.type]], ["البداية", (c) => c.start], ["النهاية", (c) => c.end || ""], ["الحالة", (c) => H.S.contract[c.status].label]],
    canCreate: () => auth().can("contracts.manage"),
    createLabel: "عقد جديد",
    formSize: "lg",
    formFields: contractFields,
    defaults: () => ({ type: "fixed", start: U.today(), end: U.addDays(U.today(), 365), hours: 8, number: `NEW-${Date.now().toString().slice(-5)}` }),
    toRecord: (v, rec) => ({ employeeId: v.employeeId, number: v.number, type: v.type, start: v.start, end: v.end || null, salary: Number(v.salary), allowances: Number(v.allowances) || 0, hours: Number(v.hours), workplaceId: v.workplaceId, notes: v.notes, fileName: v.file ? v.file.name : (rec && rec.fileName) || null, status: rec ? rec.status : "draft", approval: rec ? rec.approval : null }),
    idPrefix: "CT",
    createdMsg: "تم إنشاء العقد كمسودة",
    canEdit: (c) => auth().can("contracts.manage") && c.status === "draft",
    detailTitle: (c) => `عقد <span dir="ltr">${esc(c.number)}</span>`,
    detailSubtitle: (c) => `${esc(L().empName(c.employeeId))} · ${esc(CT[c.type] || "")}`,
    detailBody: (c) => {
      const stages = [["draft", "مسودة"], ["review", "مراجعة"], ["approved", "اعتماد"], ["active", "ساري"]];
      const idx = Math.max(0, stages.findIndex((s) => s[0] === c.status));
      return `${["draft", "review", "approved", "active"].includes(c.status) ? UI.stepper(stages, c.status === "active" ? 4 : idx, { compact: true }) : ""}
        <div class="info-grid">${UI.info("الموظف", H.empLink(c.employeeId))}${UI.info("نوع العقد", esc(CT[c.type]))}${UI.info("البداية", U.fmtDate(c.start))}${UI.info("النهاية", c.end ? `${U.fmtDate(c.end)} ${expiryBadge(c)}` : "غير محدد المدة")}
        ${UI.info("الراتب الأساسي", sens(U.money(c.salary), c.employeeId))}${UI.info("البدلات", sens(U.money(c.allowances), c.employeeId))}${UI.info("ساعات العمل", `${c.hours} ساعات يوميًا`)}${UI.info("موقع العمل", esc(L().workplaceName(c.workplaceId)))}
        ${UI.info("نسخة العقد", c.fileName ? `${icon("file")} ${esc(c.fileName)}` : "—")}${c.renewalOf ? UI.info("تجديد للعقد", esc((EHR.api.contracts.get(c.renewalOf) || {}).number || c.renewalOf)) : ""}${c.renewedBy ? UI.info("العقد المجدد", esc((EHR.api.contracts.get(c.renewedBy) || {}).number || c.renewedBy)) : ""}</div>
        ${c.notes ? UI.section("ملاحظات", `<p>${esc(c.notes)}</p>`, "note") : ""}`;
    },
    detailActions: () => [
      {
        label: "إرسال للاعتماد", icon: "send", cls: "btn--primary", when: (c) => c.status === "draft" && auth().can("contracts.manage"),
        run: (c) => EHR.api.contracts.update(c.id, (x) => {
          x.approval = EHR.api.approvals.build("contract", x.employeeId);
          x.status = x.approval.current < 0 ? "approved" : "review";
          const st = EHR.api.approvals.currentStep(x);
          if (st) EHR.api.notifications.push({ to: st.role === "MANAGER" ? { employeeIds: [(L().emp(x.employeeId) || {}).managerId] } : { roles: st.role === "HR" ? ["HR_MANAGER", "HR_OFFICER"] : [st.role] }, type: "approval", title: "عقد بانتظار الاعتماد", body: `${L().empName(x.employeeId)} — ${x.number}`, link: `#/contracts?open=${x.id}` });
        }, "العقود", "إرسال للاعتماد"),
        success: "تم إرسال العقد لمسار الاعتماد",
      },
      {
        label: "تفعيل العقد", icon: "check", cls: "btn--success", when: (c) => c.status === "approved" && auth().can("contracts.manage"),
        run: (c) => EHR.api.contracts.update(c.id, (x) => {
          x.status = "active";
          const emp = L().emp(x.employeeId);
          if (emp) {
            emp.contractType = x.type;
            emp.basicSalary = x.salary;
            emp.timeline.push({ date: U.today(), title: x.renewalOf ? "تجديد العقد" : "تفعيل العقد", detail: x.number, icon: "contract" });
          }
        }, "العقود", "تفعيل"),
        success: "تم تفعيل العقد وتحديث ملف الموظف",
      },
      { label: "تجديد", icon: "repeat", when: (c) => c.status === "active" && c.end && auth().can("contracts.manage"), run: (c) => renewContract(c), success: "تم إنشاء مسودة عقد التجديد" },
      { label: "إنهاء العقد", icon: "x", cls: "btn--danger-ghost", danger: true, confirm: "سيتم تغيير حالة العقد إلى «منتهٍ». هل تريد المتابعة؟", when: (c) => ["active", "renewal"].includes(c.status) && auth().can("contracts.manage"), run: (c) => EHR.api.contracts.update(c.id, { status: "expired", endedAt: U.today() }, "العقود", "إنهاء"), success: "تم إنهاء العقد" },
    ],
    printable: (c) => {
      const e = L().emp(c.employeeId);
      const co = L().company(c.companyId);
      return `<div class="head"><h1>ملخص عقد عمل</h1><p>${esc(co.name)} — رقم العقد ${esc(c.number)}</p></div>
        <div class="grid"><p><b>الموظف:</b> ${esc(e.nameAr)} (${e.id})</p><p><b>المسمى:</b> ${esc(L().titleName(e.jobTitleId))}</p><p><b>النوع:</b> ${esc(CT[c.type])}</p><p><b>المدة:</b> ${U.fmtDate(c.start)} — ${c.end ? U.fmtDate(c.end) : "غير محدد"}</p><p><b>الراتب الأساسي:</b> ${U.money(c.salary)}</p><p><b>البدلات:</b> ${U.money(c.allowances)}</p><p><b>ساعات العمل:</b> ${c.hours} يوميًا</p><p><b>موقع العمل:</b> ${esc(L().workplaceName(c.workplaceId))}</p></div>
        <p class="muted">مستند تجريبي مُولّد من نظام Easy HR — ليس عقدًا ملزمًا.</p><div class="sign"><span>توقيع الموظف</span><span>توقيع صاحب العمل</span></div>`;
    },
  });
  EHR.view("contracts", { title: "العقود", render: contracts.render });

  /* =========================================================
     Payroll
     ========================================================= */
  const PS = H.S.payroll;
  const STEPS = [["draft", "مسودة"], ["review", "مراجعة"], ["approved", "اعتماد"], ["processed", "معالجة"], ["paid", "صرف"]];
  const NEXT_LABEL = { draft: "إرسال للمراجعة", review: "اعتماد المسير", approved: "معالجة الرواتب", processed: "تأكيد الصرف" };
  let payTab = null;
  let runId = null;

  const payslipHTML = (run, line) => {
    const e = L().emp(line.employeeId);
    const s = EHR.db.settings[run.companyId].payroll;
    const earn = [["الراتب الأساسي", line.basic], [`بدل السكن (${s.housingPct}%)`, line.housing], ["بدل النقل", line.transport], ["بدلات أخرى", line.other], [`عمل إضافي (${line.otHours} ساعة × ${s.overtimeMultiplier})`, line.overtime], ["مكافآت وعمولات", line.bonus]].filter((x) => x[1]);
    const ded = [[`غياب (${line.absentDays} يوم)`, line.absence], ["خصم التأخير", line.lateDeduction], ["قسط سلفة", line.advance], ["جزاءات معتمدة", line.disciplinary], [s.extraDeductionLabel || "استقطاعات أخرى", line.extra]].filter((x) => x[1]);
    const rows = (list) => list.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${U.money(v)}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">لا يوجد</td></tr>';
    return `<div class="payslip">
      <div class="payslip__head"><div><b>${esc(L().company(run.companyId).name)}</b><small>قسيمة راتب — ${U.fmtMonth(run.period)}</small></div>${UI.status(PS, run.status)}</div>
      <div class="info-grid">${UI.info("الموظف", esc(e.nameAr))}${UI.info("الرقم الوظيفي", e.id)}${UI.info("الإدارة", esc(L().deptName(e.departmentId)))}${UI.info("المسمى", esc(L().titleName(e.jobTitleId)))}${UI.info("البنك", auth().can("employees.sensitive") || (me() && me().id === e.id) ? esc((e.bank || {}).name || "—") : H.sensitive(""))}</div>
      <div class="payslip__cols">
        <table class="tbl tbl--mini"><thead><tr><th>المستحقات</th><th>المبلغ</th></tr></thead><tbody>${rows(earn)}<tr class="total"><td>الإجمالي</td><td class="num">${U.money(line.gross)}</td></tr></tbody></table>
        <table class="tbl tbl--mini"><thead><tr><th>الاستقطاعات</th><th>المبلغ</th></tr></thead><tbody>${rows(ded)}<tr class="total"><td>الإجمالي</td><td class="num">${U.money(line.deductions)}</td></tr></tbody></table>
      </div>
      <div class="payslip__net"><span>صافي الراتب</span><b>${U.money(line.net)}</b></div>
      <p class="muted small">قسيمة تجريبية. نسب البدلات والاستقطاعات مأخوذة من إعدادات الرواتب القابلة للتعديل ولا تمثل حسابًا نظاميًا معتمدًا.</p>
    </div>`;
  };
  const openPayslip = (run, line) => {
    const m = UI.modal({ title: `قسيمة راتب — ${esc(L().empName(line.employeeId))}`, subtitle: U.fmtMonth(run.period), size: "md", body: payslipHTML(run, line) });
    m.setFooter([{ label: "طباعة / PDF", icon: "print", onClick: () => U.printHTML(`قسيمة راتب ${run.period}`, payslipHTML(run, line)) }, { label: "إغلاق", cls: "btn--ghost" }]);
  };

  EHR.openPayrollRules = () =>
    UI.formModal({
      title: "قواعد الرواتب", subtitle: "القيم الافتراضية أمثلة قابلة للتعديل — لا توجد نسب أو رسوم نظامية مثبتة في النظام.", size: "lg",
      fields: [
        { name: "housingPct", label: "بدل السكن (% من الأساسي)", type: "number", min: 0, max: 100, required: true },
        { name: "transportAmount", label: "بدل النقل الافتراضي (ر.س)", type: "number", min: 0, required: true },
        { name: "overtimeMultiplier", label: "معامل العمل الإضافي", type: "number", min: 1, max: 5, step: "0.05", required: true },
        { name: "daysPerMonth", label: "أيام الشهر لاحتساب الأجر اليومي", type: "number", min: 20, max: 31, required: true },
        { name: "hoursPerDay", label: "ساعات اليوم لاحتساب أجر الساعة", type: "number", min: 1, max: 12, required: true },
        { name: "lateDeductionPerMinute", label: "خصم دقيقة التأخير (ر.س) — 0 لتعطيله", type: "number", min: 0, step: "0.01" },
        { name: "extraDeductionPct", label: "استقطاعات أخرى (% من الأساسي)", type: "number", min: 0, max: 50, step: "0.01", hint: "مثل الاشتراكات التي تحددها الشركة وفق الأنظمة المعتمدة لديها" },
        { name: "extraDeductionLabel", label: "مسمى الاستقطاعات الأخرى" },
        { name: "payDay", label: "يوم صرف الرواتب", type: "number", min: 1, max: 31 },
        { name: "deductAbsence", label: "خصم أيام الغياب من الراتب", type: "checkbox", full: true },
      ],
      values: EHR.L.settings().payroll,
      async onSubmit(v) {
        await EHR.api.call(() => {
          const num = ["housingPct", "transportAmount", "overtimeMultiplier", "daysPerMonth", "hoursPerDay", "lateDeductionPerMinute", "extraDeductionPct", "payDay"];
          const out = { ...v };
          num.forEach((k) => (out[k] = Number(v[k]) || 0));
          Object.assign(EHR.L.settings().payroll, out);
          EHR.api.audit.log("تعديل السياسة", "قواعد الرواتب", "payroll");
        });
        UI.toast("تم حفظ قواعد الرواتب — أعد حساب المسير المفتوح لتطبيقها", "success");
        EHR.app.refresh();
        return true;
      },
    });

  const renderRun = (el, run) => {
    const t = { gross: U.sum(run.lines, (l) => l.gross), ded: U.sum(run.lines, (l) => l.deductions), net: U.sum(run.lines, (l) => l.net), ot: U.sum(run.lines, (l) => l.overtime) };
    const idx = STEPS.findIndex((s) => s[0] === run.status);
    const next = STEPS[idx + 1];
    const canNext = next && auth().can(next[0] === "approved" ? "payroll.approve" : "payroll.manage");
    el.innerHTML = `
      <section class="card">
        <header class="card__head"><h3>${icon("wallet")}مسير ${U.fmtMonth(run.period)}</h3>${UI.status(PS, run.status)}</header>
        ${UI.stepper(STEPS, run.status === "paid" ? 5 : idx)}
        <div class="kpis kpis--sm mt">
          ${UI.kpi({ label: "الموظفون", value: run.lines.length, iconName: "users" })}
          ${UI.kpi({ label: "إجمالي المستحقات", value: U.num(t.gross), unit: " ر.س", iconName: "trending-up", tone: "success" })}
          ${UI.kpi({ label: "إجمالي الاستقطاعات", value: U.num(t.ded), unit: " ر.س", iconName: "trending-down", tone: "danger" })}
          ${UI.kpi({ label: "صافي الرواتب", value: U.num(t.net), unit: " ر.س", iconName: "wallet", tone: "brand" })}
        </div>
        <div class="btn-row mt">
          ${run.status === "draft" && auth().can("payroll.manage") ? `<button type="button" class="btn btn--ghost" data-pr-recalc>${icon("refresh")}إعادة الحساب</button>` : ""}
          ${canNext ? `<button type="button" class="btn btn--primary" data-pr-next>${icon(next[0] === "paid" ? "check-circle" : "send")}${NEXT_LABEL[run.status]}</button>` : ""}
          ${["review", "approved"].includes(run.status) && auth().canAny(["payroll.manage", "payroll.approve"]) ? `<button type="button" class="btn btn--danger-ghost" data-pr-return>${icon("undo")}إرجاع للمسودة</button>` : ""}
          <button type="button" class="btn btn--ghost" data-pr-print>${icon("print")}طباعة ملخص</button>
          <span class="muted small push">${run.calculatedAt ? `آخر حساب: ${U.fmtStamp(run.calculatedAt)}` : ""}</span>
        </div>
        ${run.status === "draft" ? UI.notice("المسير في حالة مسودة: يمكن إعادة الحساب بعد أي تعديل على الحضور أو الإضافي المعتمد أو السلف أو الجزاءات.", "info", "info") : ""}
      </section>
      <section class="card card--flush"><div data-pr-lines></div></section>
      <section class="card"><header class="card__head"><h3>${icon("history")}سجل المسير</h3></header>
        <ul class="timeline">${run.history.slice().reverse().map((h) => `<li><b>${PS[h.status].label}</b><small>${U.fmtStamp(h.at)}${h.by ? ` · ${esc(h.by.startsWith && h.by.startsWith("EMP-") ? L().empName(h.by) : h.by)}` : ""}${h.comment ? ` — ${esc(h.comment)}` : ""}</small></li>`).join("")}</ul></section>`;
    UI.table($("[data-pr-lines]", el), {
      id: `pr-lines`,
      rows: () => run.lines,
      search: (l) => `${L().empName(l.employeeId)} ${l.employeeId}`,
      searchPlaceholder: "ابحث عن موظف…",
      filters: [{ key: "dept", label: "كل الإدارات", options: () => L().inCompany(EHR.db.departments).map((d) => [d.id, d.name]), test: (l, v) => (L().emp(l.employeeId) || {}).departmentId === v }],
      defaultSort: { key: "net", dir: -1 },
      rowAttrs: (l) => `data-slip="${l.employeeId}" tabindex="0" class="is-click"`,
      columns: [
        { key: "emp", label: "الموظف", render: (l) => H.emp(l.employeeId), sort: (l) => L().empName(l.employeeId) },
        { key: "basic", label: "الأساسي", render: (l) => H.money(l.basic), sort: (l) => l.basic },
        { key: "allow", label: "البدلات", render: (l) => H.money(l.housing + l.transport + l.other), sort: (l) => l.housing + l.transport + l.other },
        { key: "ot", label: "إضافي/مكافآت", render: (l) => (l.overtime + l.bonus ? H.money(l.overtime + l.bonus) : "—"), sort: (l) => l.overtime + l.bonus },
        { key: "ded", label: "الاستقطاعات", render: (l) => (l.deductions ? `<span class="tone-danger">${H.money(l.deductions)}</span>` : "—"), sort: (l) => l.deductions },
        { key: "net", label: "الصافي", render: (l) => `<b>${H.money(l.net)}</b>`, sort: (l) => l.net },
      ],
      exportName: `payroll-${run.period}`,
      exportColumns: [["الرقم الوظيفي", (l) => l.employeeId], ["الموظف", (l) => L().empName(l.employeeId)], ["الأساسي", (l) => l.basic], ["السكن", (l) => l.housing], ["النقل", (l) => l.transport], ["أخرى", (l) => l.other], ["إضافي", (l) => l.overtime], ["مكافآت", (l) => l.bonus], ["غياب", (l) => l.absence], ["تأخير", (l) => l.lateDeduction], ["سلف", (l) => l.advance], ["جزاءات", (l) => l.disciplinary], ["أخرى", (l) => l.extra], ["الإجمالي", (l) => l.gross], ["الاستقطاعات", (l) => l.deductions], ["الصافي", (l) => l.net]],
    });
  };

  const renderRules = (el) => {
    const s = EHR.L.settings().payroll;
    el.innerHTML = `<section class="card"><header class="card__head"><h3>${icon("settings")}قواعد احتساب الرواتب</h3>${auth().can("settings.manage") || auth().can("payroll.manage") ? `<button type="button" class="btn btn--primary btn--sm" data-pr-rules>${icon("edit")}تعديل</button>` : ""}</header>
      <div class="info-grid">${UI.info("بدل السكن", `${s.housingPct}% من الأساسي`)}${UI.info("بدل النقل الافتراضي", U.money(s.transportAmount))}${UI.info("معامل الإضافي", `× ${s.overtimeMultiplier}`)}${UI.info("أيام الشهر", s.daysPerMonth)}${UI.info("ساعات اليوم", s.hoursPerDay)}${UI.info("خصم الغياب", s.deductAbsence ? "مفعّل" : "معطّل")}${UI.info("خصم التأخير/دقيقة", s.lateDeductionPerMinute ? U.money(s.lateDeductionPerMinute) : "معطّل")}${UI.info(s.extraDeductionLabel, `${s.extraDeductionPct}%`)}${UI.info("يوم الصرف", s.payDay)}</div>
      ${UI.notice("لا يحتوي النظام على نسب تأمينات أو رسوم حكومية مثبتة. أدخل النسب المعتمدة لدى منشأتك، أو اربطها مستقبلًا بأنظمة الرواتب الرسمية عبر خادم آمن.", "warning", "shield")}
      ${UI.section("معادلات الحساب", `<ul class="bullets"><li>أجر الساعة = الأساسي ÷ (أيام الشهر × ساعات اليوم)</li><li>الإضافي = ساعات الإضافي المعتمدة فقط × أجر الساعة × المعامل</li><li>خصم الغياب = أيام الغياب × (الأساسي ÷ أيام الشهر) عند التفعيل</li><li>قسط السلفة = مبلغ السلفة ÷ عدد الأقساط ابتداءً من شهر البداية</li><li>الجزاءات المالية تُخصم فقط بعد صدور القرار واعتماده</li></ul>`, "info")}</section>`;
  };

  const renderMyPayslips = (el) => {
    const emp = me();
    const list = emp ? EHR.api.payroll.myLines(emp.id).sort((a, b) => (a.run.period < b.run.period ? 1 : -1)) : [];
    el.innerHTML = list.length
      ? `<div class="cards-grid cards-grid--sm">${list
          .map(({ run, line }) => `<button type="button" class="card slip-card" data-my-slip="${run.id}"><span class="slip-card__month">${icon("wallet")}${U.fmtMonth(run.period)}</span><b>${U.money(line.net)}</b><small>صافي الراتب · ${PS[run.status].label}</small><span class="link-btn">عرض القسيمة ${icon("chevron-left")}</span></button>`)
          .join("")}</div>`
      : `<div class="card">${UI.empty({ icon: "wallet", title: "لا توجد قسائم متاحة", text: "تظهر القسائم بعد معالجة المسير وصرفه." })}</div>`;
  };

  EHR.view("payroll", {
    title: "الرواتب",
    render(ctx) {
      const canRuns = auth().can("payroll.view");
      const tabs = [];
      if (canRuns) tabs.push(["runs", "مسيرات الرواتب"]);
      if (me() && auth().can("payroll.self")) tabs.push(["mine", "قسائمي"]);
      if (canRuns) tabs.push(["rules", "قواعد الاحتساب"]);
      if (ctx.query.tab && tabs.some((t) => t[0] === ctx.query.tab)) payTab = ctx.query.tab;
      if (!payTab || !tabs.some((t) => t[0] === payTab)) payTab = tabs[0][0];
      const runs = EHR.api.payroll.all().slice().sort((a, b) => (a.period < b.period ? 1 : -1));
      if (!runId || !runs.some((r) => r.id === runId)) runId = (runs[0] || {}).id;
      const nextPeriod = U.monthKey(U.addMonths(`${(runs[0] || { period: U.monthKey(U.today()) }).period}-01`, 1));
      ctx.el.innerHTML = `
        ${H.pageHead("الرواتب", canRuns ? "إعداد المسير ومراجعته واعتماده ومعالجته وصرفه، مع قسائم الرواتب" : "قسائم رواتبك الشهرية", "wallet",
          canRuns && auth().can("payroll.manage") ? `<button type="button" class="btn btn--primary" data-pr-new>${icon("plus")}مسير ${U.fmtMonth(nextPeriod)}</button>` : "")}
        ${tabs.length > 1 ? UI.tabs("pay", tabs, payTab) : ""}
        <div data-pay-body></div>`;
      const body = $("[data-pay-body]", ctx.el);
      if (payTab === "runs") {
        body.innerHTML = `<div class="run-strip" role="tablist" aria-label="المسيرات">${runs
          .map((r) => `<button type="button" role="tab" aria-selected="${r.id === runId}" class="run-chip ${r.id === runId ? "active" : ""}" data-run="${r.id}"><b>${U.fmtMonthShort(r.period)} ${r.period.slice(0, 4)}</b>${UI.status(PS, r.status)}</button>`)
          .join("")}</div><div data-run-body></div>`;
        const run = EHR.api.payroll.get(runId);
        if (run) renderRun($("[data-run-body]", body), run);
      } else if (payTab === "mine") renderMyPayslips(body);
      else renderRules(body);
      if (Object.keys(ctx.query).length) {
        history.replaceState(null, "", "#/payroll");
        ctx.query = {};
      }
      const self = this;
      ctx.el.onclick = async (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="pay"]');
        if (tb) {
          payTab = tb.dataset.tab;
          return self.render(ctx);
        }
        const rc = t.closest("[data-run]");
        if (rc) {
          runId = rc.dataset.run;
          return self.render(ctx);
        }
        const run = EHR.api.payroll.get(runId);
        if (t.closest("[data-pr-new]")) {
          const ok = await UI.confirm({ title: "إنشاء مسير جديد", text: `سيتم إنشاء مسير ${U.fmtMonth(nextPeriod)} بحالة مسودة وحساب رواتب ${EHR.api.payroll.staff(nextPeriod).length} موظف.`, confirmLabel: "إنشاء" });
          if (!ok) return;
          const r = await UI.run(null, () => EHR.api.payroll.createRun(nextPeriod), "تم إنشاء المسير");
          if (r) {
            runId = r.id;
            payTab = "runs";
            EHR.app.refresh();
          }
          return;
        }
        const b1 = t.closest("[data-pr-recalc]");
        if (b1) return (await UI.run(b1, () => EHR.api.payroll.recalculate(run.id), "تمت إعادة حساب الرواتب")) !== undefined && EHR.app.refresh();
        const b2 = t.closest("[data-pr-next]");
        if (b2) {
          const ok = await UI.confirm({ title: NEXT_LABEL[run.status], text: `هل تريد «${NEXT_LABEL[run.status]}» لمسير ${U.fmtMonth(run.period)}؟ صافي الرواتب ${U.money(U.sum(run.lines, (l) => l.net))}.`, confirmLabel: NEXT_LABEL[run.status] });
          if (ok && (await UI.run(b2, () => EHR.api.payroll.advance(run.id), "تم تحديث حالة المسير")) !== undefined) EHR.app.refresh();
          return;
        }
        const b3 = t.closest("[data-pr-return]");
        if (b3) {
          const c = await UI.prompt({ title: "إرجاع المسير للمسودة", label: "سبب الإرجاع", required: true, danger: true, confirmLabel: "إرجاع" });
          if (c !== null && (await UI.run(b3, () => EHR.api.payroll.returnToDraft(run.id, c), "تم إرجاع المسير")) !== undefined) EHR.app.refresh();
          return;
        }
        if (t.closest("[data-pr-print]")) {
          return U.printHTML(`مسير رواتب ${run.period}`, `<div class="head"><h1>ملخص مسير الرواتب</h1><p>${esc(L().company(run.companyId).name)} — ${U.fmtMonth(run.period)} — ${PS[run.status].label}</p></div>
            <table><thead><tr><th>الموظف</th><th>الإجمالي</th><th>الاستقطاعات</th><th>الصافي</th></tr></thead><tbody>${run.lines.map((l) => `<tr><td>${esc(L().empName(l.employeeId))}</td><td>${U.money(l.gross)}</td><td>${U.money(l.deductions)}</td><td>${U.money(l.net)}</td></tr>`).join("")}
            <tr class="total"><td>الإجمالي</td><td>${U.money(U.sum(run.lines, (l) => l.gross))}</td><td>${U.money(U.sum(run.lines, (l) => l.deductions))}</td><td>${U.money(U.sum(run.lines, (l) => l.net))}</td></tr></tbody></table><div class="sign"><span>أعدّه</span><span>اعتمده</span></div>`);
        }
        const sl = t.closest("[data-slip]");
        if (sl && run) return openPayslip(run, run.lines.find((l) => l.employeeId === sl.dataset.slip));
        const ms = t.closest("[data-my-slip]");
        if (ms) {
          const r = EHR.api.payroll.get(ms.dataset.mySlip);
          return openPayslip(r, r.lines.find((l) => l.employeeId === me().id));
        }
        if (t.closest("[data-pr-rules]")) return EHR.openPayrollRules();
      };
      ctx.el.onkeydown = (e) => {
        if (e.key === "Enter" && e.target.matches("[data-slip]")) e.target.click();
      };
    },
  });

  /* =========================================================
     Advances
     ========================================================= */
  const ADV = { ...H.S.approval, active: { label: "قيد السداد", tone: "info" }, closed: { label: "مسددة", tone: "gray" } };
  const advStatus = (a) => (a.status === "approved" ? (E.advancePaidBy(a, U.monthKey(U.today())) >= a.installments ? "closed" : "active") : a.status);
  const advances = EHR.crud({
    key: "advances", title: "السلف", icon: "coins",
    subtitle: "طلب السلف واعتمادها وجدولة أقساطها وخصمها تلقائيًا من مسير الرواتب",
    api: EHR.api.advances, statuses: ADV, statusKey: "_st", approvalCollection: "advances",
    rows: () => EHR.api.advances.visible().map((a) => Object.assign(a, { _st: advStatus(a) })),
    tabs: [["all", "الكل"], ["mine", "بانتظار موافقتي", (a) => EHR.api.approvals.canAct(a)], ["pending", "قيد الاعتماد", (a) => a.status === "pending"], ["active", "قيد السداد", (a) => a._st === "active"], ["closed", "مسددة/مغلقة", (a) => ["closed", "rejected"].includes(a._st)]],
    stats: (rows) => [
      { label: "إجمالي السلف القائمة", value: U.num(U.sum(rows.filter((a) => a._st === "active"), (a) => a.amount - Math.round((a.amount / a.installments) * E.advancePaidBy(a, U.monthKey(U.today()))))), unit: " ر.س", iconName: "coins" },
      { label: "قيد السداد", value: rows.filter((a) => a._st === "active").length, iconName: "repeat", tone: "info" },
      { label: "بانتظار الاعتماد", value: rows.filter((a) => a.status === "pending").length, iconName: "hourglass", tone: "warning" },
    ],
    columns: [
      { key: "emp", label: "الموظف", render: (a) => H.emp(a.employeeId), sort: (a) => L().empName(a.employeeId) },
      { key: "amount", label: "المبلغ", render: (a) => H.money(a.amount), sort: (a) => a.amount },
      { key: "inst", label: "الأقساط", render: (a) => `${a.installments} × ${U.money(Math.round(a.amount / a.installments))}` },
      { key: "start", label: "بداية الخصم", render: (a) => U.fmtMonth(a.startMonth), sort: (a) => a.startMonth },
      { key: "paid", label: "السداد", render: (a) => { const p = a.status === "approved" ? E.advancePaidBy(a, U.monthKey(U.today())) : 0; return `${UI.progress((p / a.installments) * 100, "brand", "نسبة السداد")}<small class="muted">${p}/${a.installments}</small>`; } },
      { key: "status", label: "الحالة", render: (a) => UI.status(ADV, a._st), sort: (a) => a._st },
    ],
    search: (a) => `${L().empName(a.employeeId)} ${a.id} ${a.reason}`,
    defaultSort: { key: "start", dir: -1 },
    exportName: "advances",
    exportColumns: [["الرقم", (a) => a.id], ["الموظف", (a) => L().empName(a.employeeId)], ["المبلغ", (a) => a.amount], ["الأقساط", (a) => a.installments], ["بداية الخصم", (a) => a.startMonth], ["الحالة", (a) => ADV[a._st].label]],
    canCreate: () => !!me() && auth().can("advances.request"),
    createLabel: "طلب سلفة",
    formFields: () => [
      { name: "amount", label: "المبلغ المطلوب (ر.س)", type: "number", min: 100, max: 1000000, required: true },
      { name: "installments", label: "عدد الأقساط الشهرية", type: "number", min: 1, max: 24, required: true },
      { name: "startMonth", label: "شهر بداية الخصم", type: "month", required: true, validate: (v) => (v < U.monthKey(U.today()) ? "اختر الشهر الحالي أو لاحقًا" : "") },
      { name: "reason", label: "السبب", type: "textarea", full: true, required: true },
      { type: "note", label: "يمر الطلب على المدير المباشر ثم المالية حسب إعدادات سير العمل، ويُخصم القسط تلقائيًا من مسير الرواتب بعد الاعتماد." },
    ],
    defaults: () => ({ installments: 3, startMonth: U.monthKey(U.addMonths(`${U.monthKey(U.today())}-01`, 1)) }),
    validate: (v) => (EHR.db.advances.some((a) => a.employeeId === me().id && a.status === "pending") ? { amount: "لديك طلب سلفة قيد الاعتماد بالفعل" } : null),
    create: (v) => EHR.api.submitWithApproval("advances", "advance", { id: U.uid("ADV"), employeeId: me().id, amount: Number(v.amount), installments: Number(v.installments), startMonth: v.startMonth, reason: v.reason }, "السلف"),
    createdMsg: "تم إرسال طلب السلفة للاعتماد",
    detailTitle: (a) => `سلفة — ${esc(L().empName(a.employeeId))}`,
    detailSubtitle: (a) => `${a.id} · ${U.money(a.amount)}`,
    detailBody: (a) => {
      const per = Math.round(a.amount / a.installments);
      const cur = U.monthKey(U.today());
      const sched = Array.from({ length: a.installments }, (_, i) => {
        const m = U.monthKey(U.addMonths(`${a.startMonth}-01`, i));
        const done = a.status === "approved" && m <= cur;
        return `<tr><td>${i + 1}</td><td>${U.fmtMonth(m)}</td><td class="num">${U.money(i === a.installments - 1 ? a.amount - per * (a.installments - 1) : per)}</td><td>${a.status !== "approved" ? UI.badge("—", "gray", false) : done ? UI.badge("مخصوم", "success") : UI.badge("قادم", "brand")}</td></tr>`;
      }).join("");
      return `<div class="info-grid">${UI.info("المبلغ", U.money(a.amount))}${UI.info("عدد الأقساط", a.installments)}${UI.info("القسط الشهري", U.money(per))}${UI.info("بداية الخصم", U.fmtMonth(a.startMonth))}</div>
        ${UI.section("السبب", `<p>${esc(a.reason)}</p>`, "note")}
        ${UI.section("جدول الأقساط", `<div class="tbl-wrap"><table class="tbl tbl--mini"><thead><tr><th>#</th><th>الشهر</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${sched}</tbody></table></div>`, "calendar")}`;
    },
  });
  EHR.view("advances", { title: "السلف", render: advances.render });

  /* =========================================================
     Allowances & benefits (compensation changes with approval)
     ========================================================= */
  const KIND = { raise: "زيادة راتب", allowance: "بدل", bonus: "مكافأة", commission: "عمولة", benefit: "مزية", promotion: "ترقية" };
  const fmtVal = (c, v) => (typeof v === "number" ? U.money(v) : esc(v ?? "—"));
  const benefits = EHR.crud({
    key: "compensation", title: "البدلات والمزايا", icon: "gift",
    subtitle: "الزيادات والبدلات والمكافآت والعمولات والمزايا مع سجل تاريخي ومسار اعتماد",
    api: EHR.api.compensation, statuses: H.S.approval, approvalCollection: "compensation",
    tabs: [["all", "الكل"], ["mine", "بانتظار موافقتي", (c) => EHR.api.approvals.canAct(c)], ["pending", "قيد الاعتماد", (c) => c.status === "pending"], ["approved", "معتمدة", (c) => c.status === "approved"]],
    stats: (rows) => {
      const yr = U.today().slice(0, 4);
      const ap = rows.filter((c) => c.status === "approved" && c.effective.startsWith(yr));
      return [
        { label: `مكافآت وعمولات ${yr}`, value: U.num(U.sum(ap.filter((c) => ["bonus", "commission"].includes(c.kind)), (c) => c.next)), unit: " ر.س", iconName: "gift", tone: "success" },
        { label: `زيادات ${yr}`, value: ap.filter((c) => c.kind === "raise").length, iconName: "trending-up", tone: "brand" },
        { label: "بانتظار الاعتماد", value: rows.filter((c) => c.status === "pending").length, iconName: "hourglass", tone: "warning" },
      ];
    },
    extraTop: () => {
      const s = EHR.L.settings().payroll;
      return `<div class="card card--soft"><div class="info-grid">${UI.info("بدل السكن (سياسة الشركة)", `${s.housingPct}% من الأساسي`)}${UI.info("بدل النقل الافتراضي", U.money(s.transportAmount))}${UI.info("معامل الإضافي", `× ${s.overtimeMultiplier}`)}${UI.info("مصدر القيم", '<a class="link" href="#/payroll?tab=rules">قواعد الرواتب</a>')}</div></div>`;
    },
    columns: [
      { key: "emp", label: "الموظف", render: (c) => H.emp(c.employeeId), sort: (c) => L().empName(c.employeeId) },
      { key: "kind", label: "النوع", render: (c) => UI.badge(KIND[c.kind] || c.kind, "brand", false) },
      { key: "item", label: "البند", render: (c) => esc(c.item) },
      { key: "change", label: "التغيير", render: (c) => `${c.prev ? `${fmtVal(c, c.prev)} ← ` : ""}<b>${fmtVal(c, c.next)}</b>` },
      { key: "eff", label: "تاريخ السريان", render: (c) => U.fmtDate(c.effective), sort: (c) => c.effective },
      { key: "status", label: "الحالة", render: (c) => UI.status(H.S.approval, c.status), sort: (c) => c.status },
    ],
    filters: [{ key: "kind", label: "كل الأنواع", options: Object.entries(KIND), test: (c, v) => c.kind === v }],
    search: (c) => `${L().empName(c.employeeId)} ${c.item} ${c.id}`,
    defaultSort: { key: "eff", dir: -1 },
    exportName: "compensation",
    exportColumns: [["الرقم", (c) => c.id], ["الموظف", (c) => L().empName(c.employeeId)], ["النوع", (c) => KIND[c.kind]], ["البند", (c) => c.item], ["السابق", (c) => c.prev ?? ""], ["الجديد", (c) => c.next], ["السريان", (c) => c.effective], ["الحالة", (c) => H.S.approval[c.status].label]],
    canCreate: () => auth().can("benefits.manage"),
    createLabel: "إضافة تغيير",
    formFields: () => [
      { name: "employeeId", label: "الموظف", type: "select", required: true, options: L().inCompany(EHR.db.employees).filter((e) => e.status !== "archived").map((e) => [e.id, `${e.nameAr} — ${e.id}`]) },
      { name: "kind", label: "النوع", type: "select", options: Object.entries(KIND), required: true },
      { name: "item", label: "البند (مثل: بدل اتصال، مكافأة ربعية)", required: true },
      { name: "next", label: "القيمة الجديدة / المبلغ (ر.س)", type: "number", min: 0, required: true },
      { name: "effective", label: "تاريخ السريان", type: "date", required: true },
      { name: "reason", label: "المبرر", type: "textarea", full: true, required: true },
      { type: "note", label: "في حالة «زيادة راتب» يُحدَّث الراتب الأساسي تلقائيًا بعد الاعتماد النهائي. المكافآت والعمولات تُضاف لمسير شهر السريان." },
    ],
    defaults: () => ({ kind: "allowance", effective: U.today() }),
    create: (v) => {
      const emp = L().emp(v.employeeId);
      const prev = v.kind === "raise" ? emp.basicSalary : v.kind === "allowance" ? 0 : 0;
      return EHR.api.submitWithApproval("compensation", "compensation", { id: U.uid("CMP"), employeeId: v.employeeId, kind: v.kind, item: v.kind === "raise" ? "الراتب الأساسي" : v.item, prev, next: Number(v.next), effective: v.effective, reason: v.reason }, "البدلات والمزايا");
    },
    createdMsg: "تم إرسال التغيير لمسار الاعتماد",
    detailTitle: (c) => `${esc(KIND[c.kind])} — ${esc(L().empName(c.employeeId))}`,
    detailSubtitle: (c) => c.id,
    detailBody: (c) => `<div class="info-grid">${UI.info("البند", esc(c.item))}${UI.info("القيمة السابقة", fmtVal(c, c.prev))}${UI.info("القيمة الجديدة", fmtVal(c, c.next))}${UI.info("تاريخ السريان", U.fmtDate(c.effective))}</div>${UI.section("المبرر", `<p>${esc(c.reason)}</p>`, "note")}
      ${UI.section("السجل التاريخي للموظف", `<ul class="timeline">${EHR.db.compensation.filter((x) => x.employeeId === c.employeeId && x.status === "approved").sort((a, b) => (a.effective < b.effective ? 1 : -1)).map((x) => `<li><b>${esc(KIND[x.kind])} — ${esc(x.item)}</b><small>${U.fmtDate(x.effective)} · ${fmtVal(x, x.next)}</small></li>`).join("") || '<li class="muted">لا يوجد</li>'}</ul>`, "history")}`,
  });
  EHR.view("benefits", { title: "البدلات والمزايا", render: benefits.render });
})((window.EHR = window.EHR || {}));
