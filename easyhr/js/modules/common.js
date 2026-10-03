/* =========================================================
   AZENK HR — shared helpers for modules (status maps, widgets)
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const { esc, icon } = U;
  const H = {};

  /* ---------- Status dictionaries (label + tone; tone is never the only cue) ---------- */
  H.S = {
    employee: {
      active: { label: "نشط", tone: "success" }, probation: { label: "تحت التجربة", tone: "info" }, suspended: { label: "موقوف", tone: "warning" },
      offboarding: { label: "في إجراءات نهاية الخدمة", tone: "warning" }, archived: { label: "مؤرشف", tone: "gray" },
    },
    approval: { pending: { label: "بانتظار الموافقة", tone: "warning" }, approved: { label: "معتمد", tone: "success" }, rejected: { label: "مرفوض", tone: "danger" }, cancelled: { label: "ملغي", tone: "gray" }, completed: { label: "مكتمل", tone: "info" }, closed: { label: "مغلق", tone: "gray" }, new: { label: "جديد", tone: "brand" }, active: { label: "نشطة", tone: "info" } },
    attendance: {
      present: { label: "حاضر", tone: "success" }, late: { label: "متأخر", tone: "warning" }, absent: { label: "غائب", tone: "danger" },
      leave: { label: "إجازة", tone: "info" }, holiday: { label: "عطلة", tone: "gray" }, notYet: { label: "لم يسجل بعد", tone: "gray" },
    },
    contract: {
      draft: { label: "مسودة", tone: "gray" }, review: { label: "قيد المراجعة", tone: "warning" }, approved: { label: "معتمد", tone: "brand" },
      active: { label: "ساري", tone: "success" }, renewal: { label: "قيد التجديد", tone: "info" }, expired: { label: "منتهٍ", tone: "danger" }, rejected: { label: "مرفوض", tone: "danger" },
    },
    contractType: { permanent: "غير محدد المدة", fixed: "محدد المدة", probation: "تحت التجربة", parttime: "دوام جزئي", other: "أخرى" },
    payroll: {
      draft: { label: "مسودة", tone: "gray" }, review: { label: "قيد المراجعة", tone: "warning" }, approved: { label: "معتمد", tone: "brand" },
      processed: { label: "تمت المعالجة", tone: "info" }, paid: { label: "مصروف", tone: "success" },
    },
    asset: {
      available: { label: "متاحة", tone: "success" }, assigned: { label: "مسلّمة", tone: "brand" }, returned: { label: "مُرجعة", tone: "info" },
      maintenance: { label: "صيانة", tone: "warning" }, retired: { label: "مستبعدة", tone: "gray" },
    },
    disciplinary: {
      open: { label: "مفتوحة", tone: "brand" }, investigation: { label: "قيد التحقيق", tone: "warning" }, pending_approval: { label: "بانتظار الاعتماد", tone: "warning" },
      decided: { label: "صدر القرار", tone: "danger" }, closed: { label: "مغلقة", tone: "gray" }, rejected: { label: "ملغاة", tone: "gray" },
    },
    request: {
      new: { label: "جديد", tone: "brand" }, pending: { label: "قيد الاعتماد", tone: "warning" }, approved: { label: "معتمد", tone: "success" },
      rejected: { label: "مرفوض", tone: "danger" }, completed: { label: "مكتمل", tone: "info" },
    },
    doc: { valid: { label: "ساري", tone: "success" }, expiring: { label: "ينتهي قريبًا", tone: "warning" }, expired: { label: "منتهٍ", tone: "danger" }, none: { label: "بدون تاريخ انتهاء", tone: "gray" } },
    review: {
      goals: { label: "تحديد الأهداف", tone: "gray" }, in_progress: { label: "قيد التنفيذ", tone: "info" }, manager_review: { label: "تقييم المدير", tone: "warning" },
      employee_review: { label: "مراجعة الموظف", tone: "brand" }, approved: { label: "معتمد نهائيًا", tone: "success" },
    },
    course: { upcoming: { label: "قادمة", tone: "brand" }, in_progress: { label: "جارية", tone: "info" }, completed: { label: "مكتملة", tone: "success" }, cancelled: { label: "ملغاة", tone: "gray" } },
    enrollment: { enrolled: { label: "مسجّل", tone: "brand" }, in_progress: { label: "قيد التعلم", tone: "info" }, completed: { label: "مكتمل", tone: "success" }, failed: { label: "لم يجتز", tone: "danger" }, cancelled: { label: "ملغى", tone: "gray" } },
    job: { requested: { label: "بانتظار الاعتماد", tone: "warning" }, open: { label: "مفتوحة", tone: "success" }, closed: { label: "مغلقة", tone: "gray" }, rejected: { label: "مرفوضة", tone: "danger" }, on_hold: { label: "معلّقة", tone: "gray" } },
  };
  H.docStatus = (d) => {
    if (!d.expiry) return "none";
    const n = U.daysFromToday(d.expiry);
    return n < 0 ? "expired" : n <= 30 ? "expiring" : "valid";
  };

  /* ---------- Cells ---------- */
  H.emp = (id, sub) => {
    const e = EHR.L.emp(id);
    if (!e) return '<span class="muted">—</span>';
    return UI.person(e.nameAr, sub != null ? sub : `${e.id} · ${EHR.L.titleName(e.jobTitleId)}`);
  };
  H.empLink = (id) => {
    const e = EHR.L.emp(id);
    if (!e) return "—";
    return EHR.auth.canSeeEmployee(id, "employees") ? `<a class="link" href="#/employees/${e.id}">${esc(e.nameAr)}</a>` : esc(e.nameAr);
  };
  H.money = (n) => `<span class="num">${U.money(n)}</span>`;
  H.sensitive = (html) => (EHR.auth.can("employees.sensitive") ? html : `<span class="masked" title="بيانات حساسة — تتطلب صلاحية">••••••</span>`);

  /* ---------- Approvals widget ---------- */
  H.approvalsList = (items, limit = 6) => {
    if (!items.length) return UI.empty({ icon: "check-circle", title: "لا توجد موافقات معلّقة", text: "كل الطلبات تمت معالجتها." });
    return `<ul class="list">${items
      .slice(0, limit)
      .map(({ def, rec }) => {
        const step = EHR.api.approvals.currentStep(rec);
        return `<li class="list__item" data-go="${def.route}${def.route.includes("?") ? "&" : "?"}open=${rec.id}" tabindex="0" role="link">
          ${UI.avatar(EHR.L.empName(rec.employeeId || rec.requestedBy), "sm")}
          <div class="list__body"><b>${esc(def.label)} — ${esc(EHR.L.empName(rec.employeeId || rec.requestedBy))}</b>
          <small>${esc(rec.id)} · المرحلة: ${esc(EHR.api.approvals.STEP_LABEL[step.role] || step.role)} · ${U.ago(rec.createdAt)}</small></div>
          ${UI.badge("بانتظار", "warning")}
        </li>`;
      })
      .join("")}</ul>`;
  };

  /* ---------- Alert builder ---------- */
  H.alerts = () => {
    const db = EHR.db;
    const L = EHR.L;
    const s = L.settings();
    const alerts = [];
    const horizon = s.contracts.alerts[0] || 30;
    const expiringContracts = L.inCompany(db.contracts).filter((c) => c.end && ["active", "renewal"].includes(c.status) && U.daysFromToday(c.end) >= 0 && U.daysFromToday(c.end) <= horizon);
    if (expiringContracts.length && EHR.auth.can("contracts.view")) alerts.push(["contract", "warning", `${expiringContracts.length} عقود ستنتهي خلال ${horizon} يومًا`, "راجع التجديد أو إنهاء العقد", "#/contracts"]);
    const docs = L.inCompany(db.documents);
    const expDocs = docs.filter((d) => H.docStatus(d) === "expiring").length;
    const expiredDocs = docs.filter((d) => H.docStatus(d) === "expired").length;
    if ((expDocs || expiredDocs) && EHR.auth.can("documents.view")) alerts.push(["folder", "warning", `${expDocs} مستندات ستنتهي قريبًا${expiredDocs ? ` و${expiredDocs} منتهية` : ""}`, "هويات وإقامات وجوازات", "#/documents"]);
    const pend = EHR.api.approvals.pendingAll();
    const pl = pend.filter((p) => p.def.collection === "leaves").length;
    if (pl && EHR.auth.canAny(["leave.view", "leave.approve"])) alerts.push(["palm", "info", `${pl} طلبات إجازة بانتظار الموافقة`, "على مستوى المدير أو الموارد البشرية", "#/leave?tab=approvals"]);
    const pa = pend.filter((p) => p.def.collection === "advances").length;
    if (pa && EHR.auth.canAny(["advances.view", "advances.approve"])) alerts.push(["coins", "info", `${pa} طلبات سلفة بانتظار الموافقة`, "مسار: المدير ← المالية", "#/advances"]);
    if (EHR.auth.canAny(["attendance.view", "attendance.approve"])) {
      const ids = EHR.auth.scope("attendance") === "all" ? L.inCompany(db.employees).map((e) => e.id) : EHR.auth.team();
      const sum = EHR.api.attendance.todaySummary(ids);
      if (sum.late) alerts.push(["clock", "danger", `${sum.late} موظفين متأخرون اليوم`, "تجاوزوا فترة السماح المحددة", "#/attendance"]);
      const missing = L.inCompany(db.attendance).filter((a) => a.checkIn && !a.checkOut && a.date < U.today() && a.date >= U.addDays(U.today(), -7) && ids.includes(a.employeeId)).length;
      if (missing) alerts.push(["log-out", "warning", `${missing} حالات نسيان تسجيل انصراف`, "خلال آخر 7 أيام", "#/attendance?tab=history&status=missing"]);
    }
    const probation = L.inCompany(db.employees).filter((e) => e.status === "probation" && e.joinDate <= U.today() && U.diffDays(U.today(), U.addDays(e.joinDate, e.probationDays || 90)) <= 21 && U.diffDays(U.today(), U.addDays(e.joinDate, e.probationDays || 90)) >= 0);
    if (probation.length && EHR.auth.can("employees.view")) alerts.push(["user-check", "info", `${probation.length} فترات تجربة تنتهي خلال 3 أسابيع`, "يلزم تقييم وتأكيد التعيين", "#/employees?status=probation"]);
    const eos = L.inCompany(db.offboarding).filter((o) => o.stage === "clearance");
    if (eos.length && EHR.auth.canAny(["offboarding.view", "clearance.approve"])) alerts.push(["door", "warning", `${eos.length} ملفات إخلاء طرف قيد الإجراء`, "بانتظار اعتماد الأقسام", "#/offboarding"]);
    return alerts;
  };
  H.alertsHTML = (alerts) =>
    alerts.length
      ? `<ul class="alerts">${alerts
          .map(([ic, tone, title, sub, link]) => `<li><button type="button" class="alert-row" data-go="${link}"><span class="alert-row__icon tone-${tone}">${icon(ic)}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${icon("chevron-left")}</button></li>`)
          .join("")}</ul>`
      : UI.empty({ icon: "check-circle", title: "لا توجد تنبيهات", text: "كل المؤشرات ضمن الحدود المحددة." });

  /* ---------- Attendance series for charts ---------- */
  H.attendanceSeries = (empIds, days = 30) => {
    const db = EHR.db;
    const s = EHR.L.settings();
    const set = new Set(empIds);
    const labels = [];
    const onTime = [];
    const late = [];
    const absent = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = U.addDays(U.today(), -i);
      if (!EHR.engine.isWorkday(s, d)) continue;
      const recs = db.attendance.filter((a) => a.date === d && set.has(a.employeeId));
      labels.push(U.fmtShort(d));
      onTime.push(recs.filter((a) => a.status === "present").length);
      late.push(recs.filter((a) => a.status === "late").length);
      absent.push(recs.filter((a) => a.status === "absent").length);
    }
    return { labels, onTime, late, absent };
  };

  H.pageHead = (title, sub, iconName, actions = "") =>
    `<div class="page-head"><div><h1>${icon(iconName)}${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="page-actions">${actions}</div></div>`;

  // Month names for the last n months (oldest first)
  H.lastMonths = (n) => Array.from({ length: n }, (_, i) => U.monthKey(U.addMonths(`${U.monthKey(U.today())}-01`, i - n + 1)));

  EHR.H = H;
})((window.EHR = window.EHR || {}));
