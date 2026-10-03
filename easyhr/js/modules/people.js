/* =========================================================
   AZENK HR — employees, profile, organisation, onboarding
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const { $, esc, icon } = U;

  const NATIONALITIES = ["سعودي", "مصري", "أردني", "سوري", "يمني", "سوداني", "هندي", "باكستاني", "فلبيني", "بنغلاديشي", "أخرى"];
  const CT = H.S.contractType;

  /* =========================================================
     Employee form
     ========================================================= */
  const employeeFields = (emp) => {
    const db = EHR.db;
    const L = EHR.L;
    const cid = EHR.auth.companyId();
    const depts = L.inCompany(db.departments).map((d) => [d.id, d.name]);
    const deptId = (emp && emp.departmentId) || (depts[0] || [])[0];
    const f = [
      { type: "section", label: "البيانات الأساسية" },
      { name: "nameAr", label: "الاسم الكامل (عربي)", required: true, validate: (v) => (v.split(/\s+/).length >= 2 ? "" : "أدخل الاسم الأول واسم العائلة على الأقل") },
      { name: "nameEn", label: "الاسم (إنجليزي)", dir: "ltr", pattern: "^[A-Za-z .'-]*$", patternMsg: "أحرف إنجليزية فقط" },
      { name: "nationality", label: "الجنسية", type: "select", options: NATIONALITIES, required: true },
      { name: "idType", label: "نوع الهوية", type: "select", options: ["هوية وطنية", "إقامة", "جواز سفر"], required: true },
      { name: "idNumber", label: "رقم الهوية / الإقامة", dir: "ltr", validate: (v, all) => (all.idType !== "جواز سفر" && !/^[12]\d{9}$/.test(v) ? "رقم من 10 أرقام يبدأ بـ 1 للهوية أو 2 للإقامة" : "") },
      { name: "dob", label: "تاريخ الميلاد", type: "date", validate: (v) => { const age = U.diffDays(v, U.today()) / 365; return age < 16 || age > 75 ? "تاريخ ميلاد غير منطقي" : ""; } },
      { name: "gender", label: "الجنس", type: "select", options: [["M", "ذكر"], ["F", "أنثى"]], required: true },
      { name: "marital", label: "الحالة الاجتماعية", type: "select", options: ["أعزب", "متزوج", "مطلق", "أرمل"], placeholder: "—" },
      { type: "section", label: "بيانات التواصل" },
      { name: "phone", label: "الجوال", dir: "ltr", required: true, pattern: "^05\\d{8}$", patternMsg: "رقم جوال سعودي من 10 أرقام يبدأ بـ 05" },
      { name: "email", label: "البريد الإلكتروني", type: "email", dir: "ltr", required: true, validate: (v) => (EHR.db.employees.some((x) => x.email === v && (!emp || x.id !== emp.id)) ? "البريد مستخدم لموظف آخر" : "") },
      { name: "address", label: "العنوان", full: true },
      { name: "emName", label: "جهة اتصال للطوارئ" },
      { name: "emRelation", label: "صلة القرابة" },
      { name: "emPhone", label: "جوال الطوارئ", dir: "ltr", pattern: "^(05\\d{8})?$", patternMsg: "رقم جوال غير صحيح" },
      { type: "section", label: "البيانات الوظيفية" },
      { name: "departmentId", label: "الإدارة", type: "select", options: depts, required: true },
      { name: "sectionId", label: "القسم", type: "select", options: L.inCompany(db.sections).filter((s) => s.departmentId === deptId).map((s) => [s.id, s.name]), placeholder: "—" },
      { name: "jobTitleId", label: "المسمى الوظيفي", type: "select", options: L.inCompany(db.jobTitles).map((j) => [j.id, j.name]), required: true },
      { name: "managerId", label: "المدير المباشر", type: "select", options: L.inCompany(db.employees).filter((e) => e.status !== "archived" && (!emp || e.id !== emp.id)).map((e) => [e.id, `${e.nameAr} — ${e.id}`]), placeholder: "بدون مدير مباشر" },
      { name: "branchId", label: "الفرع", type: "select", options: L.inCompany(db.branches).map((b) => [b.id, b.name]), required: true },
      { name: "primaryWorkplaceId", label: "موقع العمل الأساسي", type: "select", options: L.inCompany(db.workplaces).map((w) => [w.id, w.name]), required: true },
      { name: "workplaceIds", label: "مواقع العمل المصرّح بها للحضور", type: "checkgroup", full: true, options: L.inCompany(db.workplaces).map((w) => [w.id, w.name]), hint: "يمكن للموظف تسجيل الحضور من أي موقع محدد هنا (يُضاف الموقع الأساسي تلقائيًا)." },
      { name: "shiftId", label: "الوردية", type: "select", options: L.inCompany(db.shifts).map((s) => [s.id, `${s.name} (${s.start}–${s.end})`]), required: true },
      { name: "employmentType", label: "نوع التوظيف", type: "select", options: ["دوام كامل", "دوام جزئي", "عقد مؤقت", "تدريب تعاوني"] },
      { name: "contractType", label: "نوع العقد", type: "select", options: Object.entries(CT), required: true },
      { name: "joinDate", label: "تاريخ التعيين", type: "date", required: true },
      { name: "probationDays", label: "مدة التجربة (يوم)", type: "number", min: 0, max: 365, hint: "حسب سياسة الشركة" },
    ];
    if (EHR.auth.can("employees.sensitive")) {
      f.push(
        { type: "section", label: "الراتب والبنك والتأمين (بيانات حساسة)" },
        { name: "basicSalary", label: "الراتب الأساسي (ر.س)", type: "number", min: 0, required: true },
        { name: "otherAllowance", label: "بدلات أخرى ثابتة (ر.س)", type: "number", min: 0 },
        { name: "transportAllowance", label: "بدل نقل مخصص (اختياري)", type: "number", min: 0, hint: "اتركه فارغًا لاستخدام القيمة الافتراضية في سياسة الرواتب" },
        { name: "bankName", label: "البنك" },
        { name: "iban", label: "رقم الآيبان", dir: "ltr", validate: (v) => (!/^SA\d{22}$/.test(v.replace(/\s/g, "")) ? "آيبان سعودي: SA متبوعة بـ 22 رقمًا" : "") },
        { name: "insProvider", label: "شركة التأمين" },
        { name: "insClass", label: "فئة التأمين", type: "select", options: ["A", "B", "C", "VIP"], placeholder: "—" },
        { name: "insPolicy", label: "رقم الوثيقة", dir: "ltr" }
      );
    }
    f.push({ name: "notes", label: "ملاحظات", type: "textarea", full: true });
    void cid;
    return f;
  };
  const toForm = (e) => ({
    ...e,
    emName: e.emergency && e.emergency.name, emRelation: e.emergency && e.emergency.relation, emPhone: e.emergency && e.emergency.phone,
    bankName: e.bank && e.bank.name, iban: e.bank && e.bank.iban, insProvider: e.insurance && e.insurance.provider, insClass: e.insurance && e.insurance.class, insPolicy: e.insurance && e.insurance.policyNo,
    transportAllowance: e.transportAllowance ?? "",
  });
  const fromForm = (v, e) => {
    const out = {
      nameAr: v.nameAr, nameEn: v.nameEn, nationality: v.nationality, nationalityCode: v.nationality === "سعودي" ? "SA" : "XX", idType: v.idType, idNumber: v.idNumber,
      dob: v.dob, gender: v.gender, marital: v.marital, phone: v.phone, email: v.email, address: v.address,
      emergency: { name: v.emName, relation: v.emRelation, phone: v.emPhone },
      departmentId: v.departmentId, sectionId: v.sectionId || null, jobTitleId: v.jobTitleId, gradeId: (EHR.L.title(v.jobTitleId) || {}).gradeId,
      managerId: v.managerId || null, branchId: v.branchId, primaryWorkplaceId: v.primaryWorkplaceId,
      workplaceIds: Array.from(new Set([v.primaryWorkplaceId, ...(v.workplaceIds || [])])), shiftId: v.shiftId,
      employmentType: v.employmentType, contractType: v.contractType, joinDate: v.joinDate, probationDays: v.probationDays === "" ? 90 : Number(v.probationDays), notes: v.notes,
    };
    if (EHR.auth.can("employees.sensitive")) {
      Object.assign(out, {
        basicSalary: Number(v.basicSalary) || 0, otherAllowance: Number(v.otherAllowance) || 0,
        transportAllowance: v.transportAllowance === "" || v.transportAllowance == null ? null : Number(v.transportAllowance),
        bank: { name: v.bankName, iban: (v.iban || "").replace(/\s/g, "") }, insurance: { provider: v.insProvider, class: v.insClass, policyNo: v.insPolicy },
      });
    } else if (e) {
      // keep sensitive values untouched when the editor can't see them
      ["basicSalary", "otherAllowance", "transportAllowance", "bank", "insurance"].forEach((k) => (out[k] = e[k]));
    }
    return out;
  };

  const openEmployeeForm = (emp = null) => {
    const L = EHR.L;
    UI.formModal({
      title: emp ? `تعديل بيانات ${emp.nameAr}` : "إضافة موظف جديد",
      subtitle: emp ? emp.id : "سيتم إنشاء رقم وظيفي تلقائيًا ويُضاف الموظف بحالة «تحت التجربة».",
      size: "xl",
      fields: employeeFields(emp),
      values: emp
        ? toForm(emp)
        : { nationality: "سعودي", idType: "هوية وطنية", gender: "M", contractType: "probation", employmentType: "دوام كامل", joinDate: U.today(), probationDays: L.settings().contracts.probationDays, primaryWorkplaceId: (L.inCompany(EHR.db.workplaces)[0] || {}).id, branchId: (L.inCompany(EHR.db.branches)[0] || {}).id, shiftId: (L.inCompany(EHR.db.shifts)[0] || {}).id, workplaceIds: [] },
      submitLabel: emp ? "حفظ التعديلات" : "إضافة الموظف",
      onMount(form) {
        const dept = form.querySelector('[name="departmentId"]');
        const sec = form.querySelector('[name="sectionId"]');
        if (dept && sec)
          dept.addEventListener("change", () => {
            sec.innerHTML = `<option value="">—</option>${L.inCompany(EHR.db.sections).filter((s) => s.departmentId === dept.value).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}`;
          });
      },
      async onSubmit(v) {
        const data = fromForm(v, emp);
        if (emp) {
          await EHR.api.employees.update(emp.id, (e) => {
            Object.assign(e, data);
            e.timeline.push({ date: U.today(), title: "تحديث البيانات", detail: "تم تعديل ملف الموظف", icon: "edit" });
          }, "الموظفون");
          UI.toast("تم حفظ بيانات الموظف", "success");
          EHR.app.refresh();
        } else {
          const created = await EHR.api.employees.createEmployee(data);
          UI.toast(`تمت إضافة ${created.nameAr} برقم ${created.id}`, "success");
          EHR.go(`#/employees/${created.id}`);
        }
        return true;
      },
    });
  };
  EHR.openEmployeeForm = openEmployeeForm;

  const setStatus = async (emp, status, label) => {
    const ok = await UI.confirm({ title: label, text: `هل تريد ${label} للموظف <b>${esc(emp.nameAr)}</b>؟`, confirmLabel: label, danger: status !== "active" });
    if (!ok) return;
    const r = await UI.run(null, () => EHR.api.employees.update(emp.id, (e) => {
      e.status = status;
      e.timeline.push({ date: U.today(), title: label, detail: "", icon: status === "active" ? "check" : "pause" });
    }, "الموظفون", label), `تم ${label}`);
    if (r) EHR.app.refresh();
  };
  const archiveEmp = async (emp) => {
    const ok = await UI.confirm({
      title: "أرشفة الموظف",
      text: `هل أنت متأكد من أرشفة <b>${esc(emp.nameAr)}</b>؟ تُحفظ جميع السجلات للرجوع إليها، ويُمنع الوصول وتسجيل الحضور. يُفضَّل استخدام مسار «نهاية الخدمة» لإتمام إخلاء الطرف.`,
      confirmLabel: "أرشفة", danger: true,
    });
    if (!ok) return;
    const r = await UI.run(null, () => EHR.api.employees.archive(emp.id), "تمت أرشفة الموظف");
    if (r) EHR.app.refresh();
  };
  const deleteEmp = async (emp) => {
    const ok = await UI.confirm({ title: "حذف نهائي", text: `هل أنت متأكد من حذف الموظف <b>${esc(emp.nameAr)}</b> نهائيًا؟ لا يمكن التراجع، ويُنصح بالأرشفة بدلًا من الحذف للسجلات المهمة.`, confirmLabel: "حذف نهائي", danger: true });
    if (!ok) return;
    const r = await UI.run(null, () => EHR.api.employees.remove(emp.id, "الموظفون"), "تم حذف الموظف");
    if (r !== undefined) EHR.go("#/employees");
  };

  /* =========================================================
     Employees list
     ========================================================= */
  const renderList = (ctx) => {
    const db = EHR.db;
    const L = EHR.L;
    if (EHR.auth.scope("employees") === "self") return EHR.go(`#/employees/${EHR.auth.me().id}`);
    const rows = () => EHR.api.employees.visible();
    const all = rows();
    const tab = ctx.query.status || "current";
    const counts = {
      current: all.filter((e) => e.status !== "archived").length, active: all.filter((e) => e.status === "active").length,
      probation: all.filter((e) => e.status === "probation").length, suspended: all.filter((e) => e.status === "suspended").length,
      offboarding: all.filter((e) => e.status === "offboarding").length, archived: all.filter((e) => e.status === "archived").length,
    };
    const scopeTeam = EHR.auth.scope("employees") === "team";
    ctx.el.innerHTML = `
      ${H.pageHead(scopeTeam ? "موظفو فريقي" : "الموظفون", scopeTeam ? "تعرض هذه القائمة أعضاء فريقك فقط." : "إدارة ملفات الموظفين وبياناتهم الوظيفية.", "users",
        EHR.auth.can("employees.create") ? `<button type="button" class="btn btn--primary" data-emp-new>${icon("user-plus")}إضافة موظف</button>` : "")}
      ${UI.tabs("emp-status", [["current", "الحاليون", counts.current], ["active", "نشط", counts.active], ["probation", "تحت التجربة", counts.probation], ["suspended", "موقوف", counts.suspended], ["offboarding", "نهاية الخدمة", counts.offboarding], ["archived", "المؤرشفون", counts.archived]], tab)}
      <div class="card card--flush"><div data-emp-table></div></div>`;
    const inTab = (e) => (tab === "current" ? e.status !== "archived" : e.status === tab);
    UI.table($("[data-emp-table]", ctx.el), {
      id: "employees",
      rows: () => rows().filter(inTab),
      search: (e) => `${e.nameAr} ${e.nameEn} ${e.id} ${e.email} ${e.phone}`,
      searchPlaceholder: "ابحث بالاسم أو الرقم الوظيفي أو البريد أو الجوال",
      filters: [
        { key: "dept", label: "كل الإدارات", options: () => L.inCompany(db.departments).map((d) => [d.id, d.name]), test: (e, v) => e.departmentId === v },
        { key: "branch", label: "كل الفروع", options: () => L.inCompany(db.branches).map((b) => [b.id, b.name]), test: (e, v) => e.branchId === v },
        { key: "contract", label: "كل أنواع العقود", options: Object.entries(CT), test: (e, v) => e.contractType === v },
        { key: "wp", label: "كل مواقع العمل", options: () => L.inCompany(db.workplaces).map((w) => [w.id, w.name]), test: (e, v) => e.primaryWorkplaceId === v },
      ],
      defaultSort: { key: "id", dir: 1 },
      columns: [
        { key: "id", label: "رقم الموظف", sort: (e) => e.id, render: (e) => `<span class="code">${e.id}</span>` },
        { key: "photo", label: "الصورة", cls: "cell-photo", render: (e) => UI.avatar(e.nameAr, "", e.avatarHue) },
        { key: "name", label: "الاسم", cls: "cell-main", sort: (e) => e.nameAr, render: (e) => `<a class="link strong" href="#/employees/${e.id}">${esc(e.nameAr)}</a><small class="block muted">${esc(e.email)}</small>` },
        { key: "dept", label: "القسم", sort: (e) => L.deptName(e.departmentId), render: (e) => `${esc(L.deptName(e.departmentId))}<small class="block muted">${esc((L.section(e.sectionId) || {}).name || "")}</small>` },
        { key: "title", label: "المسمى الوظيفي", sort: (e) => L.titleName(e.jobTitleId), render: (e) => esc(L.titleName(e.jobTitleId)) },
        { key: "manager", label: "المدير المباشر", render: (e) => (e.managerId ? esc(L.empName(e.managerId)) : '<span class="muted">—</span>') },
        { key: "contract", label: "نوع العقد", render: (e) => esc(CT[e.contractType] || "—") },
        { key: "status", label: "حالة الموظف", sort: (e) => e.status, render: (e) => UI.status(H.S.employee, e.status) },
        { key: "join", label: "تاريخ التعيين", sort: (e) => e.joinDate, render: (e) => U.fmtDate(e.joinDate) },
        { key: "wp", label: "موقع العمل", render: (e) => esc(L.workplaceName(e.primaryWorkplaceId)) },
        {
          key: "act", label: "الإجراءات", cls: "cell-actions",
          render: (e) => `<div class="row-actions">
            <a class="icon-btn icon-btn--sm" href="#/employees/${e.id}" aria-label="عرض ${esc(e.nameAr)}" data-tip="عرض">${icon("eye")}</a>
            ${EHR.auth.can("employees.edit") && e.status !== "archived" ? `<button type="button" class="icon-btn icon-btn--sm" data-emp-edit="${e.id}" aria-label="تعديل" data-tip="تعديل">${icon("edit")}</button>` : ""}
            ${EHR.auth.can("employees.edit") && ["active", "probation"].includes(e.status) ? `<button type="button" class="icon-btn icon-btn--sm" data-emp-suspend="${e.id}" aria-label="إيقاف" data-tip="إيقاف">${icon("pause")}</button>` : ""}
            ${EHR.auth.can("employees.edit") && e.status === "suspended" ? `<button type="button" class="icon-btn icon-btn--sm" data-emp-activate="${e.id}" aria-label="تفعيل" data-tip="تفعيل">${icon("play")}</button>` : ""}
            ${EHR.auth.can("employees.archive") && e.status !== "archived" ? `<button type="button" class="icon-btn icon-btn--sm" data-emp-archive="${e.id}" aria-label="أرشفة" data-tip="أرشفة">${icon("archive")}</button>` : ""}
          </div>`,
        },
      ],
      exportName: EHR.auth.can("employees.export") ? "employees" : null,
      exportColumns: [
        ["رقم الموظف", (e) => e.id], ["الاسم", (e) => e.nameAr], ["الاسم بالإنجليزية", (e) => e.nameEn], ["الإدارة", (e) => L.deptName(e.departmentId)],
        ["المسمى الوظيفي", (e) => L.titleName(e.jobTitleId)], ["المدير المباشر", (e) => (e.managerId ? L.empName(e.managerId) : "")], ["نوع العقد", (e) => CT[e.contractType]],
        ["الحالة", (e) => H.S.employee[e.status].label], ["تاريخ التعيين", (e) => e.joinDate], ["الفرع", (e) => L.branchName(e.branchId)], ["موقع العمل", (e) => L.workplaceName(e.primaryWorkplaceId)],
        ["الجوال", (e) => e.phone], ["البريد", (e) => e.email],
      ],
      empty: { icon: "users", title: "لا يوجد موظفون في هذه الفئة" },
    });
    ctx.el.onclick = (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab-group="emp-status"]');
      if (tb) return EHR.setQuery({ status: tb.dataset.tab === "current" ? "" : tb.dataset.tab });
      if (t.closest("[data-emp-new]")) return openEmployeeForm();
      const find = (attr) => { const el = t.closest(`[${attr}]`); return el ? EHR.L.emp(el.getAttribute(attr)) : null; };
      let emp;
      if ((emp = find("data-emp-edit"))) return openEmployeeForm(emp);
      if ((emp = find("data-emp-suspend"))) return setStatus(emp, "suspended", "إيقاف الموظف");
      if ((emp = find("data-emp-activate"))) return setStatus(emp, "active", "تفعيل الموظف");
      if ((emp = find("data-emp-archive"))) return archiveEmp(emp);
    };
    if (ctx.query.new && EHR.auth.can("employees.create")) {
      history.replaceState(null, "", "#/employees");
      openEmployeeForm();
    }
  };

  /* =========================================================
     Employee profile (15 tabs + timeline)
     ========================================================= */
  const PROFILE_TABS = [
    ["basic", "البيانات الأساسية"], ["job", "البيانات الوظيفية"], ["contact", "بيانات التواصل"], ["documents", "المستندات"], ["contract", "العقد"],
    ["attendance", "الحضور"], ["leave", "الإجازات"], ["payroll", "الرواتب"], ["advances", "السلف"], ["assets", "العهد"], ["performance", "الأداء"],
    ["training", "التدريب"], ["disciplinary", "المخالفات"], ["requests", "الطلبات"], ["log", "سجل العمليات"],
  ];
  const miniTable = (headers, rows, emptyText = "لا توجد سجلات") =>
    rows.length
      ? `<div class="tbl-wrap"><table class="tbl tbl--stack tbl--compact"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c, i) => `<td data-label="${headers[i]}">${c}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      : UI.empty({ title: emptyText });

  const profileTab = (emp, tab) => {
    const db = EHR.db;
    const L = EHR.L;
    const self = EHR.auth.me() && EHR.auth.me().id === emp.id;
    const sens = EHR.auth.can("employees.sensitive") || self;
    const S = (v) => (sens ? v : H.sensitive(v));
    const grid = (items) => `<div class="info-grid">${items.map(([l, v]) => UI.info(l, v)).join("")}</div>`;
    switch (tab) {
      case "basic":
        return grid([
          ["الرقم الوظيفي (Employee ID)", `<span class="code">${emp.id}</span>`], ["الاسم الكامل", esc(emp.nameAr)], ["الاسم بالإنجليزية", `<span dir="ltr">${esc(emp.nameEn || "—")}</span>`],
          ["الجنسية", esc(emp.nationality)], ["نوع الهوية", esc(emp.idType)], ["رقم الهوية", S(`<span class="code">${esc(emp.idNumber || "—")}</span>`)],
          ["تاريخ الميلاد", S(U.fmtDate(emp.dob))], ["الجنس", emp.gender === "F" ? "أنثى" : "ذكر"], ["الحالة الاجتماعية", esc(emp.marital || "—")],
          ["الحالة", UI.status(H.S.employee, emp.status)], ["الشركة", esc(L.company(emp.companyId).name)], ["ملاحظات", esc(emp.notes || "—")],
        ]);
      case "job": {
        const shift = L.shift(emp.shiftId);
        const probEnd = U.addDays(emp.joinDate, emp.probationDays || 90);
        return grid([
          ["الإدارة", esc(L.deptName(emp.departmentId))], ["القسم", esc((L.section(emp.sectionId) || {}).name || "—")], ["المسمى الوظيفي", esc(L.titleName(emp.jobTitleId))],
          ["الدرجة الوظيفية", esc((L.grade(emp.gradeId) || {}).name || "—")], ["المدير المباشر", emp.managerId ? H.empLink(emp.managerId) : "—"], ["الفرع", esc(L.branchName(emp.branchId))],
          ["موقع العمل الأساسي", esc(L.workplaceName(emp.primaryWorkplaceId))], ["مواقع الحضور المصرّح بها", (emp.workplaceIds || []).map((w) => esc(L.workplaceName(w))).join("، ")],
          ["الوردية", shift ? `${esc(shift.name)} (${U.fmtTime(shift.start)} – ${U.fmtTime(shift.end)})` : "—"], ["نوع التوظيف", esc(emp.employmentType)], ["نوع العقد", esc(CT[emp.contractType] || "—")],
          ["تاريخ التعيين", U.fmtDate(emp.joinDate)], ["مدة الخدمة", `${U.round(U.diffDays(emp.joinDate, U.today()) / 365, 1)} سنة`],
          ["نهاية فترة التجربة", emp.status === "probation" ? `${U.fmtDate(probEnd)} (${U.relDays(probEnd)})` : "منتهية"],
          ["الراتب الأساسي", S(U.money(emp.basicSalary))], ["بدلات ثابتة", S(U.money((emp.otherAllowance || 0) + (emp.transportAllowance ?? L.settings().payroll.transportAmount)))],
          ["البنك", S(esc((emp.bank || {}).name || "—"))], ["الآيبان", S(`<span class="code" dir="ltr">${esc((emp.bank || {}).iban || "—")}</span>`)],
          ["التأمين الطبي", S(`${esc((emp.insurance || {}).provider || "—")} · فئة ${esc((emp.insurance || {}).class || "—")}`)], ["رقم وثيقة التأمين", S(`<span class="code">${esc((emp.insurance || {}).policyNo || "—")}</span>`)],
        ]);
      }
      case "contact":
        return grid([
          ["الجوال", `<a class="link" href="tel:${esc(emp.phone)}" dir="ltr">${esc(emp.phone)}</a>`], ["البريد الإلكتروني", `<a class="link" href="mailto:${esc(emp.email)}" dir="ltr">${esc(emp.email)}</a>`],
          ["العنوان", esc(emp.address || "—")], ["جهة اتصال للطوارئ", esc((emp.emergency || {}).name || "—")], ["صلة القرابة", esc((emp.emergency || {}).relation || "—")],
          ["جوال الطوارئ", `<span dir="ltr">${esc((emp.emergency || {}).phone || "—")}</span>`],
        ]);
      case "documents":
        if (!(EHR.auth.can("documents.view") || self)) return UI.empty({ icon: "lock", title: "لا تملك صلاحية عرض المستندات" });
        return miniTable(["المستند", "الفئة", "الرقم", "تاريخ الانتهاء", "الحالة"], db.documents.filter((d) => d.employeeId === emp.id).map((d) => [esc(d.name), esc(d.category), S(esc(d.number || "—")), U.fmtDate(d.expiry), UI.status(H.S.doc, H.docStatus(d))])) +
          `<a class="link-btn mt" href="#/documents">إدارة المستندات</a>`;
      case "contract":
        return miniTable(["رقم العقد", "النوع", "البداية", "النهاية", "الراتب", "الحالة"], db.contracts.filter((c) => c.employeeId === emp.id).map((c) => [`<span class="code">${esc(c.number)}</span>`, esc(CT[c.type]), U.fmtDate(c.start), c.end ? `${U.fmtDate(c.end)}<small class="block muted">${U.relDays(c.end)}</small>` : "غير محدد", S(U.money(c.salary)), UI.status(H.S.contract, c.status)]));
      case "attendance": {
        if (!EHR.auth.canSeeEmployee(emp.id, "attendance")) return UI.empty({ icon: "lock", title: "لا تملك صلاحية عرض الحضور" });
        const recs = db.attendance.filter((a) => a.employeeId === emp.id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
        return miniTable(["التاريخ", "الحضور", "الانصراف", "الحالة", "التأخير", "الإضافي", "ساعات العمل"], recs.map((a) => [U.fmtDate(a.date), U.fmtTime(a.checkIn), a.checkIn && !a.checkOut && a.date < U.today() ? UI.badge("لم يُسجّل", "warning") : U.fmtTime(a.checkOut), UI.status(H.S.attendance, a.status), a.lateMin ? `${a.lateMin} د` : "—", a.overtimeMin ? U.fmtDuration(a.overtimeMin) : "—", U.fmtDuration(a.workedMin)])) +
          `<a class="link-btn mt" href="#/attendance?tab=history&emp=${emp.id}">السجل الكامل</a>`;
      }
      case "leave": {
        const types = EHR.api.leave.typesFor(emp);
        const bals = types.map((t) => ({ t, b: EHR.api.leave.balance(emp.id, t.id) }));
        return `<div class="balance-grid">${bals.map(({ t, b }) => `<div class="balance" style="--c:${t.color}"><b>${esc(t.name)}</b><span class="balance__num">${b.remaining}<small> متبقٍ</small></span><small>افتتاحي ${b.opening} · مستخدم ${b.used} · معلّق ${b.pending}</small>${UI.progress(b.opening ? (b.used / b.opening) * 100 : 0)}</div>`).join("")}</div>` +
          miniTable(["الرقم", "النوع", "من", "إلى", "الأيام", "الحالة"], db.leaves.filter((l) => l.employeeId === emp.id).map((l) => [`<span class="code">${l.id}</span>`, esc((L.leaveType(l.typeId) || {}).name), U.fmtDate(l.from), U.fmtDate(l.to), l.days, UI.status(H.S.approval, l.status)]));
      }
      case "payroll":
        if (!(EHR.auth.can("payroll.view") || self)) return UI.empty({ icon: "lock", title: "لا تملك صلاحية عرض الرواتب" });
        return miniTable(["الفترة", "الإجمالي", "الاستقطاعات", "الصافي", "حالة المسير"], L.inCompany(db.payrollRuns).filter((r) => r.lines.some((l) => l.employeeId === emp.id)).sort((a, b) => (a.period < b.period ? 1 : -1)).map((r) => { const l = r.lines.find((x) => x.employeeId === emp.id); return [U.fmtMonth(r.period), U.money(l.gross), U.money(l.deductions), `<b>${U.money(l.net)}</b>`, UI.status(H.S.payroll, r.status)]; }));
      case "advances":
        return miniTable(["الرقم", "المبلغ", "الأقساط", "بداية الخصم", "الحالة"], db.advances.filter((a) => a.employeeId === emp.id).map((a) => [`<span class="code">${a.id}</span>`, S(U.money(a.amount)), a.installments, U.fmtMonth(a.startMonth), UI.status(H.S.approval, a.status)]));
      case "assets":
        return miniTable(["الرمز", "النوع", "الاسم", "الرقم التسلسلي", "تاريخ التسليم", "الحالة"], db.assets.filter((a) => a.employeeId === emp.id).map((a) => [`<span class="code">${a.id}</span>`, esc(a.type), esc(a.name), `<span class="code">${esc(a.serial)}</span>`, U.fmtDate(a.issueDate), UI.status(H.S.asset, a.status)]));
      case "performance":
        if (!EHR.auth.canSeeEmployee(emp.id, "performance")) return UI.empty({ icon: "lock", title: "لا تملك صلاحية عرض التقييمات" });
        return miniTable(["الدورة", "المرحلة", "التقييم الذاتي", "تقييم المدير", "النتيجة النهائية"], db.reviews.filter((r) => r.employeeId === emp.id).map((r) => [esc((db.perfCycles.find((c) => c.id === r.cycleId) || {}).name), UI.status(H.S.review, r.stage), r.selfScore ?? "—", r.managerScore ?? "—", r.finalScore ? `<b>${r.finalScore}</b> / 5` : "—"]));
      case "training":
        return miniTable(["الدورة", "التاريخ", "الساعات", "الحالة", "الشهادة", "انتهاء الشهادة"], db.enrollments.filter((e) => e.employeeId === emp.id).map((en) => { const c = db.courses.find((x) => x.id === en.courseId); return [esc(c.name), U.fmtDate(c.start), c.hours, UI.status(H.S.enrollment, en.status), en.certificateNo ? `<span class="code">${en.certificateNo}</span>` : "—", en.certExpiry ? U.fmtDate(en.certExpiry) : "—"]; }));
      case "disciplinary":
        if (!(EHR.auth.can("disciplinary.view") || self)) return UI.empty({ icon: "lock", title: "لا تملك صلاحية عرض المخالفات" });
        return miniTable(["التاريخ", "النوع", "الوصف", "الإجراء", "الحالة"], db.disciplinary.filter((d) => d.employeeId === emp.id).map((d) => [U.fmtDate(d.date), esc(d.type), esc(d.description), esc(d.action), UI.status(H.S.disciplinary, d.status)]));
      case "requests":
        return miniTable(["الرقم", "النوع", "التاريخ", "الحالة"], [
          ...db.requests.filter((r) => r.employeeId === emp.id).map((r) => [`<span class="code">${r.id}</span>`, esc(r.type), U.fmtDate(r.date), UI.status(H.S.request, r.status)]),
          ...db.travel.filter((r) => r.employeeId === emp.id).map((r) => [`<span class="code">${r.id}</span>`, `سفر إلى ${esc(r.destination)}`, U.fmtDate(r.from), UI.status(H.S.approval, r.status)]),
          ...db.overtime.filter((r) => r.employeeId === emp.id).map((r) => [`<span class="code">${r.id}</span>`, `عمل إضافي ${r.hours} س`, U.fmtDate(r.date), UI.status(H.S.approval, r.status)]),
        ]);
      case "log": {
        const events = [...(emp.timeline || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
        const auditRows = EHR.auth.can("audit.view") ? db.audit.filter((a) => a.record.includes(emp.id)).slice(0, 10) : [];
        return `<ol class="timeline">${events.map((ev) => `<li><span class="timeline__dot">${icon(ev.icon || "dot")}</span><div><time>${U.fmtDate(ev.date)}</time><b>${esc(ev.title)}</b>${ev.detail ? `<p>${esc(ev.detail)}</p>` : ""}</div></li>`).join("") || "<li>لا توجد أحداث</li>"}</ol>` +
          (auditRows.length ? `<h5 class="subhead">سجل التدقيق</h5>${miniTable(["المستخدم", "العملية", "الوحدة", "الوقت"], auditRows.map((a) => [esc(a.userName), esc(a.action), esc(a.module), U.fmtStamp(a.at)]))}` : "");
      }
      default:
        return "";
    }
  };

  const printProfile = (emp) => {
    const L = EHR.L;
    const sens = EHR.auth.can("employees.sensitive");
    const row = (l, v) => `<div><small>${l}</small>${U.esc(v ?? "—")}</div>`;
    U.printHTML(`ملف ${emp.nameAr}`, `
      <div class="head"><div><h1>${U.esc(emp.nameAr)}</h1><div class="muted">${emp.id} · ${U.esc(L.titleName(emp.jobTitleId))} · ${U.esc(L.deptName(emp.departmentId))}</div></div><div class="muted">${U.esc(L.company(emp.companyId).name)}<br>${U.fmtDate(U.today())}</div></div>
      <h2>البيانات الأساسية</h2><div class="grid">${row("الاسم بالإنجليزية", emp.nameEn)}${row("الجنسية", emp.nationality)}${row("نوع الهوية", emp.idType)}${row("رقم الهوية", sens ? emp.idNumber : "مخفي")}${row("تاريخ الميلاد", sens ? emp.dob : "مخفي")}${row("الحالة الاجتماعية", emp.marital)}</div>
      <h2>البيانات الوظيفية</h2><div class="grid">${row("المدير المباشر", emp.managerId ? L.empName(emp.managerId) : "—")}${row("الفرع", L.branchName(emp.branchId))}${row("موقع العمل", L.workplaceName(emp.primaryWorkplaceId))}${row("نوع العقد", CT[emp.contractType])}${row("تاريخ التعيين", emp.joinDate)}${row("الحالة", H.S.employee[emp.status].label)}</div>
      <h2>التواصل</h2><div class="grid">${row("الجوال", emp.phone)}${row("البريد", emp.email)}${row("العنوان", emp.address)}</div>
      <div class="sign"><div>الموارد البشرية</div><div>المدير المباشر</div><div>الموظف</div></div>`);
  };

  const renderProfile = (ctx) => {
    const L = EHR.L;
    const emp = L.emp(ctx.param);
    if (!emp || emp.companyId !== EHR.auth.companyId()) {
      ctx.el.innerHTML = UI.empty({ icon: "user-x", title: "الموظف غير موجود", text: "قد يكون الموظف في شركة أخرى أو تم حذفه.", action: { label: "قائمة الموظفين", attrs: 'data-go="#/employees"', icon: "users" } });
      return;
    }
    if (!EHR.auth.canSeeEmployee(emp.id, "employees")) {
      ctx.el.innerHTML = UI.empty({ icon: "lock", title: "لا تملك صلاحية عرض هذا الملف", text: "يمكنك الاطلاع على ملفك الشخصي أو ملفات فريقك فقط." });
      return;
    }
    const tab = ctx.query.tab || "basic";
    const self = EHR.auth.me() && EHR.auth.me().id === emp.id;
    const tenure = U.round(U.diffDays(emp.joinDate, U.today()) / 365, 1);
    const canEdit = EHR.auth.can("employees.edit") && emp.status !== "archived";
    ctx.el.innerHTML = `
      <nav class="crumbs" aria-label="مسار التنقل">${self ? "" : `<a href="#/employees">الموظفون</a>${icon("chevron-left")}`}<span>${esc(emp.nameAr)}</span></nav>
      <section class="card profile">
        <div class="profile__main">
          ${UI.avatar(emp.nameAr, "xl", emp.avatarHue)}
          <div class="profile__text">
            <h1>${esc(emp.nameAr)} ${UI.status(H.S.employee, emp.status)}</h1>
            <p dir="auto" class="muted">${esc(emp.nameEn || "")}</p>
            <p><span class="code">${emp.id}</span> · ${esc(L.titleName(emp.jobTitleId))} · ${esc(L.deptName(emp.departmentId))}</p>
          </div>
        </div>
        <div class="profile__facts">
          ${UI.info("تاريخ التعيين", U.fmtDate(emp.joinDate))}${UI.info("مدة الخدمة", `${tenure} سنة`)}${UI.info("المدير المباشر", emp.managerId ? H.empLink(emp.managerId) : "—")}${UI.info("موقع العمل", esc(L.workplaceName(emp.primaryWorkplaceId)))}
        </div>
        <div class="profile__actions">
          ${canEdit ? `<button type="button" class="btn btn--primary btn--sm" data-p-edit>${icon("edit")}تعديل</button>` : ""}
          <button type="button" class="btn btn--ghost btn--sm" data-p-print>${icon("print")}طباعة الملف</button>
          ${canEdit && emp.status === "suspended" ? `<button type="button" class="btn btn--ghost btn--sm" data-p-activate>${icon("play")}تفعيل</button>` : ""}
          ${canEdit && ["active", "probation"].includes(emp.status) ? `<button type="button" class="btn btn--ghost btn--sm" data-p-suspend>${icon("pause")}إيقاف</button>` : ""}
          ${EHR.auth.can("offboarding.manage") && ["active", "probation", "suspended"].includes(emp.status) ? `<button type="button" class="btn btn--ghost btn--sm" data-go="#/offboarding?new=${emp.id}">${icon("door")}بدء نهاية الخدمة</button>` : ""}
          ${EHR.auth.can("employees.archive") && emp.status !== "archived" ? `<button type="button" class="btn btn--danger-ghost btn--sm" data-p-archive>${icon("archive")}أرشفة</button>` : ""}
          ${EHR.auth.role() === "SUPER_ADMIN" && emp.status === "archived" ? `<button type="button" class="btn btn--danger-ghost btn--sm" data-p-delete>${icon("trash")}حذف نهائي</button>` : ""}
        </div>
      </section>
      ${UI.tabs("profile", PROFILE_TABS, tab, "tabs--scroll")}
      <section class="card" aria-live="polite">${profileTab(emp, tab)}</section>`;
    ctx.el.onclick = (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab-group="profile"]');
      if (tb) return EHR.setQuery({ tab: tb.dataset.tab });
      if (t.closest("[data-p-edit]")) return openEmployeeForm(emp);
      if (t.closest("[data-p-print]")) return printProfile(emp);
      if (t.closest("[data-p-suspend]")) return setStatus(emp, "suspended", "إيقاف الموظف");
      if (t.closest("[data-p-activate]")) return setStatus(emp, "active", "تفعيل الموظف");
      if (t.closest("[data-p-archive]")) return archiveEmp(emp);
      if (t.closest("[data-p-delete]")) return deleteEmp(emp);
    };
  };

  EHR.view("employees", {
    title: "الموظفون",
    render(ctx) {
      if (ctx.param) return renderProfile(ctx);
      return renderList(ctx);
    },
  });

  /* =========================================================
     Organisation
     ========================================================= */
  const ORG_TABS = [["chart", "الهيكل التنظيمي"], ["companies", "الشركات"], ["branches", "الفروع"], ["departments", "الإدارات"], ["sections", "الأقسام"], ["titles", "المسميات الوظيفية"], ["grades", "الدرجات الوظيفية"], ["managers", "المديرون"], ["workplaces", "مواقع العمل"]];

  const orgChart = () => {
    const db = EHR.db;
    const L = EHR.L;
    const company = L.company(EHR.auth.companyId());
    const emps = L.inCompany(db.employees).filter((e) => e.status !== "archived");
    const depts = L.inCompany(db.departments);
    const top = `<div class="org">
      <div class="org__node org__node--root">${icon("building")}<b>${esc(company.name)}</b><small>${emps.length} موظف · ${L.inCompany(db.branches).length} فروع</small></div>
      <div class="org__children">${depts
        .map((d) => {
          const head = L.emp(d.managerId);
          const count = emps.filter((e) => e.departmentId === d.id).length;
          return `<div class="org__branch"><div class="org__node">${head ? UI.avatar(head.nameAr, "sm") : icon("users")}<b>${esc(d.name)}</b><small>${head ? esc(head.nameAr) : "بدون مدير"}</small><em>${count} موظف</em></div></div>`;
        })
        .join("")}</div></div>`;
    const tree = L.inCompany(db.branches)
      .map((b) => {
        const bEmps = emps.filter((e) => e.branchId === b.id);
        if (!bEmps.length) return "";
        const deptIds = [...new Set(bEmps.map((e) => e.departmentId))];
        return `<details class="tree" open><summary>${icon("map-pin")}<b>${esc(b.name)}</b><small>${bEmps.length} موظف</small></summary>${deptIds
          .map((did) => {
            const d = L.dept(did);
            const dEmps = bEmps.filter((e) => e.departmentId === did);
            const secIds = [...new Set(dEmps.map((e) => e.sectionId))];
            return `<details class="tree"><summary>${icon("users")}<b>${esc(d.name)}</b><small>${dEmps.length} · المدير: ${esc(L.empName(d.managerId))}</small></summary>${secIds
              .map((sid) => {
                const sEmps = dEmps.filter((e) => e.sectionId === sid);
                return `<details class="tree"><summary>${icon("layers")}<b>${esc((L.section(sid) || {}).name || "بدون قسم")}</b><small>${sEmps.length}</small></summary><div class="tree__people">${sEmps
                  .map((e) => `<a class="tree__person ${e.id === d.managerId ? "is-mgr" : ""}" href="#/employees/${e.id}">${UI.avatar(e.nameAr, "xs")}<span>${esc(e.nameAr)}<small>${esc(L.titleName(e.jobTitleId))}${e.id === d.managerId ? " · مدير الإدارة" : ""}</small></span></a>`)
                  .join("")}</div></details>`;
              })
              .join("")}</details>`;
          })
          .join("")}</details>`;
      })
      .join("");
    return `<section class="card">${top}</section><section class="card"><header class="card__head"><div><h3>التسلسل التفصيلي</h3><p>الشركة ← الفرع ← الإدارة ← القسم ← المدير ← الموظفون</p></div></header>${tree}</section>`;
  };

  const ORG_ENTITIES = {
    companies: { coll: "companies", label: "شركة", fields: () => [{ name: "name", label: "اسم الشركة", required: true }, { name: "nameEn", label: "الاسم بالإنجليزية", dir: "ltr" }, { name: "city", label: "المدينة" }, { name: "crNumber", label: "رقم السجل التجاري" }], perm: "companies.manage", global: true },
    branches: { coll: "branches", label: "فرع", fields: () => [{ name: "name", label: "اسم الفرع", required: true }, { name: "city", label: "المدينة", required: true }, { name: "status", label: "الحالة", type: "select", options: [["active", "نشط"], ["inactive", "غير نشط"]] }] },
    departments: { coll: "departments", label: "إدارة", fields: () => [{ name: "name", label: "اسم الإدارة", required: true }, { name: "code", label: "الرمز", dir: "ltr" }, { name: "branchId", label: "الفرع", type: "select", options: EHR.L.inCompany(EHR.db.branches).map((b) => [b.id, b.name]), required: true }, { name: "managerId", label: "مدير الإدارة", type: "select", placeholder: "—", options: EHR.L.inCompany(EHR.db.employees).filter((e) => e.status !== "archived").map((e) => [e.id, e.nameAr]) }] },
    sections: { coll: "sections", label: "قسم", fields: () => [{ name: "name", label: "اسم القسم", required: true }, { name: "departmentId", label: "الإدارة", type: "select", options: EHR.L.inCompany(EHR.db.departments).map((d) => [d.id, d.name]), required: true }] },
    titles: { coll: "jobTitles", label: "مسمى وظيفي", fields: () => [{ name: "name", label: "المسمى", required: true }, { name: "nameEn", label: "المسمى بالإنجليزية", dir: "ltr" }, { name: "gradeId", label: "الدرجة", type: "select", options: EHR.L.inCompany(EHR.db.grades).map((g) => [g.id, g.name]) }] },
    grades: { coll: "grades", label: "درجة وظيفية", fields: () => [{ name: "name", label: "اسم الدرجة", required: true }, { name: "min", label: "الحد الأدنى للراتب", type: "number", min: 0, required: true }, { name: "max", label: "الحد الأعلى للراتب", type: "number", min: 0, required: true, validate: (v, all) => (Number(v) < Number(all.min) ? "الحد الأعلى أقل من الأدنى" : "") }] },
  };
  const openOrgForm = (tab, rec) => {
    const ent = ORG_ENTITIES[tab];
    UI.formModal({
      title: rec ? `تعديل ${ent.label}` : `إضافة ${ent.label}`,
      fields: ent.fields(),
      values: rec || {},
      async onSubmit(v) {
        await EHR.api.call(() => {
          if (rec) Object.assign(rec, v);
          else {
            const id = U.uid(tab.slice(0, 2).toUpperCase());
            const record = { id, ...v, ...(ent.global ? {} : { companyId: EHR.auth.companyId() }) };
            if (tab === "companies") {
              record.logoHue = U.hue(v.name);
              EHR.db.settings[id] = U.clone(EHR.db.settings[EHR.auth.companyId()]);
              EHR.db.settings[id].company.name = v.name;
              EHR.db.settings[id].attendance.holidays = [];
              ["annual", "sick", "emergency", "unpaid", "maternity", "paternity", "other"].forEach((k) => {
                const base = EHR.db.leaveTypes.find((t) => t.companyId === "C1" && t.key === k);
                if (base) EHR.db.leaveTypes.push({ ...base, id: `${id}-${k}`, companyId: id });
              });
            }
            EHR.db[ent.coll].push(record);
          }
          EHR.api.audit.log(rec ? "تعديل" : "إنشاء", "الهيكل التنظيمي", `${ent.label}: ${v.name}`);
        });
        UI.toast(rec ? "تم الحفظ" : `تمت إضافة ${ent.label}`, "success");
        EHR.app.refresh();
        return true;
      },
    });
  };

  const orgTable = (tab) => {
    const db = EHR.db;
    const L = EHR.L;
    const list = (arr, cols) => `<div class="tbl-wrap"><table class="tbl tbl--stack"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}${EHR.auth.can("org.manage") ? "<th>الإجراءات</th>" : ""}</tr></thead><tbody>${arr
      .map((r) => `<tr>${cols.map((c) => `<td data-label="${c[0]}">${c[1](r)}</td>`).join("")}${EHR.auth.can("org.manage") && ORG_ENTITIES[tab] ? `<td class="cell-actions"><button type="button" class="icon-btn icon-btn--sm" data-org-edit="${r.id}" aria-label="تعديل">${icon("edit")}</button></td>` : EHR.auth.can("org.manage") ? "<td></td>" : ""}</tr>`)
      .join("")}</tbody></table></div>`;
    const emps = L.inCompany(db.employees).filter((e) => e.status !== "archived");
    switch (tab) {
      case "companies":
        return list(db.companies, [["الشركة", (c) => `<b>${esc(c.name)}</b>${c.id === EHR.auth.companyId() ? " " + UI.badge("الحالية", "brand") : ""}`], ["الاسم بالإنجليزية", (c) => `<span dir="ltr">${esc(c.nameEn || "")}</span>`], ["المدينة", (c) => esc(c.city || "—")], ["الموظفون", (c) => db.employees.filter((e) => e.companyId === c.id && e.status !== "archived").length]]) +
          UI.notice("كل سجل في النظام مرتبط بشركة، ولا تُعرض بيانات شركة داخل أخرى. التبديل بين الشركات متاح لمدير النظام من الشريط العلوي. العزل الكامل يتطلب تطبيقه في الخادم.", "info", "shield");
      case "branches":
        return list(L.inCompany(db.branches), [["الفرع", (b) => `<b>${esc(b.name)}</b>`], ["المدينة", (b) => esc(b.city)], ["الموظفون", (b) => emps.filter((e) => e.branchId === b.id).length], ["الحالة", (b) => (b.status === "active" ? UI.badge("نشط", "success") : UI.badge("غير نشط", "gray"))]]);
      case "departments":
        return list(L.inCompany(db.departments), [["الإدارة", (d) => `<b>${esc(d.name)}</b> <small class="muted">${esc(d.code || "")}</small>`], ["الفرع", (d) => esc(L.branchName(d.branchId))], ["المدير", (d) => (d.managerId ? H.empLink(d.managerId) : "—")], ["الأقسام", (d) => L.inCompany(db.sections).filter((s) => s.departmentId === d.id).length], ["الموظفون", (d) => emps.filter((e) => e.departmentId === d.id).length]]);
      case "sections":
        return list(L.inCompany(db.sections), [["القسم", (s) => `<b>${esc(s.name)}</b>`], ["الإدارة", (s) => esc(L.deptName(s.departmentId))], ["الموظفون", (s) => emps.filter((e) => e.sectionId === s.id).length]]);
      case "titles":
        return list(L.inCompany(db.jobTitles), [["المسمى", (j) => `<b>${esc(j.name)}</b>`], ["بالإنجليزية", (j) => `<span dir="ltr">${esc(j.nameEn || "")}</span>`], ["الدرجة", (j) => esc((L.grade(j.gradeId) || {}).name || "—")], ["الموظفون", (j) => emps.filter((e) => e.jobTitleId === j.id).length]]);
      case "grades":
        return list(L.inCompany(db.grades), [["الدرجة", (g) => `<b>${esc(g.name)}</b>`], ["نطاق الراتب", (g) => (EHR.auth.can("employees.sensitive") ? `${U.money(g.min)} – ${U.money(g.max)}` : H.sensitive(""))], ["المسميات", (g) => L.inCompany(db.jobTitles).filter((j) => j.gradeId === g.id).length]]);
      case "managers": {
        const mgrs = emps.filter((e) => emps.some((x) => x.managerId === e.id));
        return list(mgrs, [["المدير", (m) => H.emp(m.id)], ["الإدارة", (m) => esc(L.deptName(m.departmentId))], ["المرؤوسون المباشرون", (m) => emps.filter((x) => x.managerId === m.id).length], ["الفريق", (m) => emps.filter((x) => x.managerId === m.id).slice(0, 5).map((x) => UI.avatar(x.nameAr, "xs")).join("")]]);
      }
      case "workplaces":
        return list(L.inCompany(db.workplaces), [["الموقع", (w) => `<b>${esc(w.name)}</b><small class="block muted">${esc(w.address)}</small>`], ["الفرع", (w) => esc(L.branchName(w.branchId))], ["نصف القطر", (w) => `${w.radius} م`], ["الموظفون", (w) => emps.filter((e) => (e.workplaceIds || []).includes(w.id)).length], ["الحالة", (w) => (w.status === "active" ? UI.badge("نشط", "success") : UI.badge("غير نشط", "gray"))]]) +
          `<a class="btn btn--ghost btn--sm mt" href="#/attendance?tab=workplaces">${icon("map-pin")}إدارة مواقع العمل والنطاق الجغرافي</a>`;
      default:
        return "";
    }
  };

  EHR.view("org", {
    title: "الهيكل التنظيمي",
    render(ctx) {
      const tab = ctx.query.tab || "chart";
      const ent = ORG_ENTITIES[tab];
      const canAdd = ent && (ent.perm ? EHR.auth.can(ent.perm) : EHR.auth.can("org.manage"));
      ctx.el.innerHTML = `
        ${H.pageHead("الهيكل التنظيمي", "الشركات والفروع والإدارات والأقسام والمسميات والدرجات.", "sitemap", canAdd ? `<button type="button" class="btn btn--primary" data-org-new>${icon("plus")}إضافة ${ent.label}</button>` : "")}
        ${UI.tabs("org", ORG_TABS, tab, "tabs--scroll")}
        ${tab === "chart" ? orgChart() : `<section class="card card--flush">${orgTable(tab)}</section>`}`;
      ctx.el.onclick = (e) => {
        const tb = e.target.closest('[data-tab-group="org"]');
        if (tb) return EHR.setQuery({ tab: tb.dataset.tab });
        if (e.target.closest("[data-org-new]")) return openOrgForm(tab, null);
        const ed = e.target.closest("[data-org-edit]");
        if (ed && ent) return openOrgForm(tab, EHR.db[ent.coll].find((r) => r.id === ed.dataset.orgEdit));
      };
    },
  });

  /* =========================================================
     Onboarding
     ========================================================= */
  const FLOW = [["candidate", "المرشح"], ["employee", "الموظف"], ["documents", "المستندات"], ["contract", "العقد"], ["workplace", "موقع العمل"], ["shift", "الوردية"], ["assets", "العهد"], ["training", "التدريب"], ["done", "مكتمل"]];
  const flowIndex = (ob) => {
    const done = (k) => (ob.tasks.find((t) => t.key === k) || {}).status === "completed";
    const order = ["documents", "contract", "workplace", "shift", "assets", "training"];
    let i = 2;
    for (const k of order) {
      if (!done(k)) return i;
      i += 1;
    }
    return 8;
  };
  const TASK_STATUS = { pending: { label: "معلّقة", tone: "gray" }, in_progress: { label: "قيد التنفيذ", tone: "warning" }, completed: { label: "مكتملة", tone: "success" } };

  const openOnboarding = (id) => {
    const ob = EHR.db.onboarding.find((o) => o.id === id);
    const emp = EHR.L.emp(ob.employeeId);
    const pct = EHR.api.onboarding.progress(ob);
    const can = EHR.auth.can("onboarding.manage");
    const m = UI.modal({
      title: `تهيئة ${esc(emp.nameAr)}`,
      subtitle: `${emp.id} · تاريخ المباشرة ${U.fmtDate(ob.startDate)}${ob.candidateId ? " · من التوظيف" : ""}`,
      size: "lg",
      body: `<div class="onb-head">${UI.chart.ring(pct, "الإنجاز", pct === 100 ? "success" : "brand")}<div>${UI.stepper(FLOW, flowIndex(ob), { compact: true })}</div></div>
        <ul class="checklist">${ob.tasks
          .map((t) => `<li class="is-${t.status}"><span class="checklist__icon">${icon(t.status === "completed" ? "check-circle" : t.status === "in_progress" ? "clock" : "circle")}</span>
            <div><b>${esc(t.title)}</b><small>المسؤول: ${esc({ HR: "الموارد البشرية", FINANCE: "المالية", IT: "تقنية المعلومات", MANAGER: "المدير المباشر", TRAINING: "التدريب" }[t.owner] || t.owner)}</small></div>
            ${can ? `<select class="input input--sm" data-task="${t.key}" aria-label="حالة ${esc(t.title)}">${Object.entries(TASK_STATUS).map(([k, v]) => `<option value="${k}" ${k === t.status ? "selected" : ""}>${v.label}</option>`).join("")}</select>` : UI.status(TASK_STATUS, t.status)}
          </li>`)
          .join("")}</ul>`,
      footer: [{ label: "فتح ملف الموظف", icon: "user", onClick: () => { m.close(); EHR.go(`#/employees/${emp.id}`); } }, { label: "إغلاق", cls: "btn--primary" }],
    });
    m.body.addEventListener("change", async (e) => {
      const sel = e.target.closest("[data-task]");
      if (!sel) return;
      sel.disabled = true;
      const r = await UI.run(null, () => EHR.api.onboarding.setTask(id, sel.dataset.task, sel.value), "تم تحديث المهمة");
      m.close();
      EHR.app.refresh();
      if (r) openOnboarding(id);
    });
  };

  EHR.view("onboarding", {
    title: "الموظف الجديد",
    render(ctx) {
      const db = EHR.db;
      const L = EHR.L;
      const list = L.inCompany(db.onboarding);
      const tab = ctx.query.tab || "active";
      const shown = list.filter((o) => (tab === "active" ? EHR.api.onboarding.progress(o) < 100 : EHR.api.onboarding.progress(o) === 100));
      const withoutOb = L.inCompany(db.employees).filter((e) => ["probation", "active"].includes(e.status) && !list.some((o) => o.employeeId === e.id) && U.diffDays(e.joinDate, U.today()) < 120);
      ctx.el.innerHTML = `
        ${H.pageHead("الموظف الجديد (التهيئة)", "قوائم التهيئة من التعيين حتى اكتمال التدريب الأولي.", "user-plus", EHR.auth.can("onboarding.manage") ? `<button type="button" class="btn btn--primary" data-onb-new>${icon("plus")}قائمة تهيئة جديدة</button>` : "")}
        ${UI.notice("عند تعيين مرشح من «التوظيف» تُنشأ قائمة التهيئة تلقائيًا مع ملف الموظف ومسودة العقد.", "info", "flow")}
        ${UI.tabs("onb", [["active", "قيد التنفيذ", list.filter((o) => EHR.api.onboarding.progress(o) < 100).length], ["done", "مكتملة", list.filter((o) => EHR.api.onboarding.progress(o) === 100).length]], tab)}
        <div class="cards-grid">${shown
          .map((o) => {
            const emp = L.emp(o.employeeId);
            const pct = EHR.api.onboarding.progress(o);
            const next = o.tasks.find((t) => t.status !== "completed");
            return `<article class="card card--click" data-onb="${o.id}" tabindex="0" role="button" aria-label="تهيئة ${esc(emp.nameAr)}">
              <div class="onb-card">${UI.chart.ring(pct, "", pct === 100 ? "success" : "brand", 72)}<div><b>${esc(emp.nameAr)}</b><small class="block muted">${esc(L.titleName(emp.jobTitleId))} · ${esc(L.deptName(emp.departmentId))}</small><small class="block">المباشرة: ${U.fmtDate(o.startDate)} (${U.relDays(o.startDate)})</small></div></div>
              ${UI.progress(pct)}
              <p class="muted small mt">${next ? `المهمة التالية: <b>${esc(next.title)}</b>` : "اكتملت جميع المهام"}</p>
            </article>`;
          })
          .join("") || UI.empty({ icon: "user-plus", title: tab === "active" ? "لا توجد عمليات تهيئة جارية" : "لا توجد عمليات مكتملة", action: EHR.auth.can("onboarding.manage") && tab === "active" ? { label: "قائمة تهيئة جديدة", attrs: "data-onb-new" } : null })}</div>`;
      ctx.el.onclick = (e) => {
        const tb = e.target.closest('[data-tab-group="onb"]');
        if (tb) return EHR.setQuery({ tab: tb.dataset.tab });
        const c = e.target.closest("[data-onb]");
        if (c) return openOnboarding(c.dataset.onb);
        if (e.target.closest("[data-onb-new]")) {
          if (!withoutOb.length) return UI.toast("لا يوجد موظفون جدد بدون قائمة تهيئة", "info");
          UI.formModal({
            title: "إنشاء قائمة تهيئة",
            fields: [{ name: "employeeId", label: "الموظف", type: "select", required: true, options: withoutOb.map((x) => [x.id, `${x.nameAr} — ${x.id}`]) }],
            async onSubmit(v) {
              const emp = L.emp(v.employeeId);
              await EHR.api.call(() => {
                db.onboarding.unshift({ id: U.uid("ONB"), companyId: emp.companyId, employeeId: emp.id, candidateId: null, startDate: emp.joinDate, createdAt: U.stamp(), tasks: EHR.api.onboarding.TEMPLATE.map(([key, title, owner]) => ({ key, title, owner, status: key === "account" ? "completed" : "pending" })) });
                EHR.api.audit.log("إنشاء", "التهيئة", emp.id);
              });
              UI.toast("تم إنشاء قائمة التهيئة", "success");
              EHR.app.refresh();
              return true;
            },
          });
        }
      };
      ctx.el.onkeydown = (e) => {
        if (e.key === "Enter" && e.target.matches("[data-onb]")) openOnboarding(e.target.dataset.onb);
      };
    },
  });
})((window.EHR = window.EHR || {}));
