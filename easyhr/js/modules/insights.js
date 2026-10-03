/* =========================================================
   AZENK HR — reports & analytics, notifications center,
   unified calendar, help center
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const E = EHR.engine;
  const { $, $$, esc, icon } = U;

  const auth = () => EHR.auth;
  const L = () => EHR.L;
  const db = () => EHR.db;

  /* =========================================================
     Reports
     ========================================================= */
  let period = 30;
  let deptFilter = "all";
  // Employees in the user's reporting scope (all for HR, team for managers)
  const scopeEmps = () => {
    const all = L().inCompany(db().employees);
    if (auth().canAny(["employees.view", "analytics.view"])) return all;
    const team = new Set(auth().team());
    return all.filter((e) => team.has(e.id));
  };
  const inScope = () => {
    const set = new Set(scopeEmps().filter((e) => deptFilter === "all" || e.departmentId === deptFilter).map((e) => e.id));
    return (id) => set.has(id);
  };
  const since = () => U.addDays(U.today(), -period);
  const byDept = (list, fn) => L().inCompany(db().departments).filter((d) => deptFilter === "all" || d.id === deptFilter).map((d) => ({ label: d.name, value: fn(list.filter((x) => x._dept === d.id)) }));
  const withDept = (list, key = "employeeId") => list.map((x) => ({ ...x, _dept: (L().emp(x[key]) || {}).departmentId }));
  const EMP_ST = H.S.employee;

  const REPORTS = [
    {
      key: "headcount", group: "الموظفون", title: "تقرير الموظفين", icon: "users", perm: "reports.view", timeless: true,
      desc: "عدد الموظفين وتوزيعهم حسب الإدارة والفرع والحالة",
      rows: () => scopeEmps().filter((e) => deptFilter === "all" || e.departmentId === deptFilter).map((e) => ({ ...e, _dept: e.departmentId })),
      cols: [["الرقم", (e) => e.id], ["الاسم", (e) => e.nameAr], ["الإدارة", (e) => L().deptName(e.departmentId)], ["الفرع", (e) => L().branchName(e.branchId)], ["المسمى", (e) => L().titleName(e.jobTitleId)], ["تاريخ التعيين", (e) => e.joinDate], ["الحالة", (e) => EMP_ST[e.status].label]],
      chart: (rows) => UI.chart.hbars(byDept(rows.filter((e) => e.status !== "archived"), (l) => l.length), { unit: " موظف" }),
    },
    {
      key: "hires", group: "الموظفون", title: "التعيينات الجديدة", icon: "user-plus", perm: "reports.view",
      desc: "الموظفون المعينون خلال الفترة المحددة",
      rows: () => scopeEmps().filter((e) => e.joinDate >= since() && inScope()(e.id)).map((e) => ({ ...e, _dept: e.departmentId })),
      cols: [["الاسم", (e) => e.nameAr], ["الإدارة", (e) => L().deptName(e.departmentId)], ["المسمى", (e) => L().titleName(e.jobTitleId)], ["تاريخ التعيين", (e) => e.joinDate], ["نوع العقد", (e) => H.S.contractType[e.contractType] || e.contractType]],
    },
    {
      key: "turnover", group: "الموظفون", title: "الدوران الوظيفي والمغادرون", icon: "trending-down", perm: "reports.view", timeless: true,
      desc: "الموظفون الذين غادروا وأسباب المغادرة",
      rows: () => L().inCompany(db().offboarding).filter((o) => inScope()(o.employeeId)).map((o) => ({ ...o, _dept: (L().emp(o.employeeId) || {}).departmentId })),
      cols: [["الموظف", (o) => L().empName(o.employeeId)], ["السبب", (o) => EHR.api.offboarding.REASONS[o.reason]], ["تاريخ الطلب", (o) => o.requestDate], ["آخر يوم", (o) => o.lastDay], ["المرحلة", (o) => (EHR.api.offboarding.STAGES.find((s) => s[0] === o.stage) || ["", o.stage])[1]]],
      chart: (rows) => UI.chart.donut({ segments: Object.entries(EHR.api.offboarding.REASONS).map(([k, l], i) => ({ label: l, value: rows.filter((o) => o.reason === k).length, color: ["#2451d6", "#d93636", "#0b7fc7", "#d98200", "#667085"][i] })).filter((s) => s.value), center: `${EHR.api.reports.turnover(365)}%`, centerLabel: "دوران سنوي" }),
    },
    {
      key: "attendance", group: "الحضور", title: "ملخص الحضور", icon: "clock", perm: "reports.view",
      desc: "أيام الحضور والتأخير والغياب لكل موظف خلال الفترة",
      rows: () => scopeEmps().filter((e) => e.status !== "archived" && inScope()(e.id)).map((e) => {
        const recs = db().attendance.filter((a) => a.employeeId === e.id && a.date >= since());
        return { id: e.id, name: e.nameAr, _dept: e.departmentId, present: recs.filter((a) => a.checkIn).length, late: recs.filter((a) => a.status === "late").length, absent: recs.filter((a) => a.status === "absent").length, leave: recs.filter((a) => a.status === "leave").length, lateMin: U.sum(recs, (a) => a.lateMin || 0), worked: U.sum(recs, (a) => a.workedMin || 0) };
      }),
      cols: [["الموظف", (r) => r.name], ["أيام الحضور", (r) => r.present], ["التأخير (أيام)", (r) => r.late], ["دقائق التأخير", (r) => r.lateMin], ["الغياب", (r) => r.absent], ["الإجازات", (r) => r.leave], ["ساعات العمل", (r) => U.round(r.worked / 60, 1)]],
      chart: (rows) => { const s = H.attendanceSeries(rows.map((r) => r.id), Math.min(period, 30)); return UI.chart.bars({ labels: s.labels, series: [{ label: "في الوقت", color: "var(--success)", values: s.onTime }, { label: "متأخر", color: "var(--warning)", values: s.late }, { label: "غائب", color: "var(--danger)", values: s.absent }], height: 200 }); },
    },
    {
      key: "late", group: "الحضور", title: "تقرير التأخير", icon: "hourglass", perm: "reports.view",
      desc: "حالات التأخير بالتفصيل مع الدقائق",
      rows: () => withDept(L().inCompany(db().attendance).filter((a) => a.status === "late" && a.date >= since() && inScope()(a.employeeId))),
      cols: [["الموظف", (a) => L().empName(a.employeeId)], ["التاريخ", (a) => a.date], ["الحضور", (a) => a.checkIn], ["دقائق التأخير", (a) => a.lateMin]],
      chart: (rows) => UI.chart.hbars(byDept(rows, (l) => l.length), { unit: " حالة" }),
    },
    {
      key: "absence", group: "الحضور", title: "تقرير الغياب", icon: "user-x", perm: "reports.view",
      desc: "أيام الغياب دون تسجيل حضور أو إجازة معتمدة",
      rows: () => withDept(L().inCompany(db().attendance).filter((a) => a.status === "absent" && a.date >= since() && inScope()(a.employeeId))),
      cols: [["الموظف", (a) => L().empName(a.employeeId)], ["التاريخ", (a) => a.date], ["اليوم", (a) => U.weekday(a.date)]],
      chart: (rows) => UI.chart.hbars(byDept(rows, (l) => l.length), { unit: " يوم" }),
    },
    {
      key: "overtime", group: "الحضور", title: "العمل الإضافي", icon: "clock-plus", perm: "reports.view",
      desc: "طلبات العمل الإضافي وحالتها وساعاتها",
      rows: () => withDept(L().inCompany(db().overtime).filter((o) => o.date >= since() && inScope()(o.employeeId))),
      cols: [["الموظف", (o) => L().empName(o.employeeId)], ["التاريخ", (o) => o.date], ["الساعات", (o) => o.hours], ["السبب", (o) => o.reason], ["الحالة", (o) => H.S.approval[o.status].label]],
    },
    {
      key: "leave", group: "الإجازات", title: "تقرير الإجازات", icon: "palm", perm: "reports.view",
      desc: "الإجازات حسب النوع والحالة خلال الفترة",
      rows: () => withDept(L().inCompany(db().leaves).filter((l) => l.to >= since() && inScope()(l.employeeId))),
      cols: [["الموظف", (l) => L().empName(l.employeeId)], ["النوع", (l) => (L().leaveType(l.typeId) || {}).name], ["من", (l) => l.from], ["إلى", (l) => l.to], ["الأيام", (l) => l.days], ["الحالة", (l) => (H.S.approval[l.status] || { label: l.status }).label]],
      chart: (rows) => UI.chart.donut({ segments: db().leaveTypes.filter((t) => t.companyId === auth().companyId()).map((t) => ({ label: t.name, value: U.sum(rows.filter((l) => l.typeId === t.id && l.status === "approved"), (l) => l.days), color: t.color })).filter((s) => s.value), center: U.sum(rows.filter((l) => l.status === "approved"), (l) => l.days), centerLabel: "يوم معتمد" }),
    },
    {
      key: "balances", group: "الإجازات", title: "أرصدة الإجازات", icon: "calendar", perm: "reports.view", timeless: true,
      desc: "الرصيد السنوي المتبقي والمستخدم لكل موظف",
      rows: () => scopeEmps().filter((e) => e.status !== "archived" && inScope()(e.id)).map((e) => { const t = db().leaveTypes.find((x) => x.companyId === e.companyId && x.key === "annual"); const b = EHR.api.leave.balance(e.id, t.id); return { name: e.nameAr, _dept: e.departmentId, ...b }; }),
      cols: [["الموظف", (r) => r.name], ["الرصيد", (r) => r.opening], ["المستخدم", (r) => r.used], ["قيد الاعتماد", (r) => r.pending], ["المتبقي", (r) => r.remaining]],
    },
    {
      key: "payroll", group: "المالية", title: "تقرير الرواتب", icon: "wallet", perm: "payroll.view", timeless: true,
      desc: "آخر مسير رواتب حسب الإدارة (للمخوّلين فقط)",
      rows: () => { const run = EHR.api.payroll.all().slice().sort((a, b) => (a.period < b.period ? 1 : -1))[0]; return run ? withDept(run.lines.filter((l) => inScope()(l.employeeId))).map((l) => ({ ...l, period: run.period })) : []; },
      cols: [["الموظف", (l) => L().empName(l.employeeId)], ["الفترة", (l) => l.period], ["الإجمالي", (l) => l.gross], ["الاستقطاعات", (l) => l.deductions], ["الصافي", (l) => l.net]],
      chart: (rows) => UI.chart.hbars(byDept(rows, (l) => U.sum(l, (x) => x.net)), { format: U.num, unit: " ر.س" }),
    },
    {
      key: "contracts", group: "المالية", title: "العقود المنتهية قريبًا", icon: "contract", perm: "contracts.view", timeless: true,
      desc: "العقود السارية التي تنتهي خلال 90 يومًا",
      rows: () => withDept(L().inCompany(db().contracts).filter((c) => ["active", "renewal"].includes(c.status) && c.end && U.daysFromToday(c.end) >= 0 && U.daysFromToday(c.end) <= 90 && inScope()(c.employeeId))),
      cols: [["رقم العقد", (c) => c.number], ["الموظف", (c) => L().empName(c.employeeId)], ["النهاية", (c) => c.end], ["الأيام المتبقية", (c) => U.daysFromToday(c.end)], ["الحالة", (c) => H.S.contract[c.status].label]],
    },
    {
      key: "documents", group: "السجلات", title: "المستندات المنتهية", icon: "folder", perm: "documents.view", timeless: true,
      desc: "المستندات المنتهية أو التي تنتهي خلال 30 يومًا",
      rows: () => withDept(L().inCompany(db().documents).filter((d) => ["expiring", "expired"].includes(H.docStatus(d)) && inScope()(d.employeeId))),
      cols: [["الموظف", (d) => L().empName(d.employeeId)], ["المستند", (d) => d.name], ["النوع", (d) => d.category], ["الانتهاء", (d) => d.expiry], ["الحالة", (d) => H.S.doc[H.docStatus(d)].label]],
    },
    {
      key: "training", group: "التطوير", title: "تقرير التدريب", icon: "graduation", perm: "reports.view", timeless: true,
      desc: "المشاركات التدريبية ونتائجها والساعات",
      rows: () => withDept(L().inCompany(db().enrollments).filter((e) => inScope()(e.employeeId))).map((e) => ({ ...e, _course: db().courses.find((c) => c.id === e.courseId) || {} })),
      cols: [["الموظف", (e) => L().empName(e.employeeId)], ["الدورة", (e) => e._course.name], ["الساعات", (e) => e._course.hours], ["الحالة", (e) => H.S.enrollment[e.status].label], ["الدرجة", (e) => e.score ?? ""]],
      chart: (rows) => UI.chart.hbars(byDept(rows.filter((r) => r.status === "completed"), (l) => U.sum(l, (x) => x._course.hours || 0)), { unit: " ساعة" }),
    },
    {
      key: "performance", group: "التطوير", title: "نتائج الأداء", icon: "target", perm: "reports.view", timeless: true,
      desc: "نتائج التقييمات المعتمدة حسب الإدارة",
      rows: () => withDept(L().inCompany(db().reviews).filter((r) => inScope()(r.employeeId))),
      cols: [["الموظف", (r) => L().empName(r.employeeId)], ["الدورة", (r) => (db().perfCycles.find((c) => c.id === r.cycleId) || {}).name], ["المرحلة", (r) => H.S.review[r.stage].label], ["النتيجة", (r) => r.finalScore ?? ""]],
      chart: (rows) => UI.chart.hbars(byDept(rows.filter((r) => r.finalScore != null), (l) => (l.length ? U.round(U.sum(l, (x) => x.finalScore) / l.length, 1) : 0)), { format: (v) => String(v), unit: " / 5" }),
    },
    {
      key: "assets", group: "السجلات", title: "العهد والأصول", icon: "laptop", perm: "assets.view", timeless: true,
      desc: "العهد حسب النوع والوضع والمستلم",
      rows: () => withDept(L().inCompany(db().assets).filter((a) => !a.employeeId || inScope()(a.employeeId))),
      cols: [["الرقم", (a) => a.id], ["النوع", (a) => a.type], ["الوصف", (a) => a.name], ["المستلم", (a) => (a.employeeId ? L().empName(a.employeeId) : "")], ["الوضع", (a) => H.S.asset[a.status].label]],
      chart: (rows) => UI.chart.donut({ segments: Object.entries(H.S.asset).map(([k, v], i) => ({ label: v.label, value: rows.filter((a) => a.status === k).length, color: ["#12a150", "#2451d6", "#0b7fc7", "#d98200", "#98a2b3"][i] })).filter((s) => s.value), center: rows.length, centerLabel: "عهدة" }),
    },
    {
      key: "demographics", group: "الموظفون", title: "التركيبة السكانية", icon: "chart", perm: "analytics.view", timeless: true,
      desc: "التوزيع حسب الجنس والجنسية — معطّل افتراضيًا ويُفعّل من إعدادات الخصوصية",
      enabled: () => !!L().settings().privacy.showDemographics,
      rows: () => scopeEmps().filter((e) => e.status !== "archived" && inScope()(e.id)).map((e) => ({ ...e, _dept: e.departmentId })),
      cols: [["الإدارة", (e) => L().deptName(e.departmentId)], ["الجنس", (e) => (e.gender === "F" ? "أنثى" : "ذكر")], ["الجنسية", (e) => e.nationality]],
      chart: (rows) => { const g = U.groupBy(rows, (e) => e.nationality); return UI.chart.hbars(Object.entries(g).map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value)); },
    },
  ];
  const allowedReports = () => REPORTS.filter((r) => auth().can(r.perm));

  const renderReport = (ctx, rep) => {
    const disabled = rep.enabled && !rep.enabled();
    ctx.el.innerHTML = `
      ${H.pageHead(rep.title, esc(rep.desc), rep.icon, `<button type="button" class="btn btn--ghost" data-go="#/reports">${icon("arrow-right")}كل التقارير</button>${disabled ? "" : `<button type="button" class="btn btn--ghost" data-rep-print>${icon("print")}طباعة</button>`}`)}
      ${disabled ? `<div class="card">${UI.empty({ icon: "shield", title: "هذا التقرير معطّل", text: "تقارير الجنس والجنسية معطّلة افتراضيًا لحماية الخصوصية، ويمكن لمدير النظام تفعيلها من الإعدادات ← الخصوصية عند وجود مسوّغ نظامي." })}</div>` : `
      <div class="toolbar-row">
        <select class="input input--sm" data-rep-dept aria-label="الإدارة"><option value="all">كل الإدارات</option>${L().inCompany(db().departments).map((d) => `<option value="${d.id}" ${d.id === deptFilter ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
        ${rep.timeless ? "" : `<select class="input input--sm" data-rep-period aria-label="الفترة">${[[7, "آخر 7 أيام"], [30, "آخر 30 يومًا"], [90, "آخر 90 يومًا"], [365, "آخر سنة"]].map(([v, l]) => `<option value="${v}" ${v === period ? "selected" : ""}>${l}</option>`).join("")}</select>`}
        ${auth().scope("employees") !== "all" && !auth().can("analytics.view") ? UI.badge("نطاق فريقك فقط", "info") : ""}
      </div>
      ${rep.chart ? `<section class="card">${rep.chart(rep.rows())}</section>` : ""}
      <section class="card card--flush"><div data-rep-table></div></section>`}`;
    if (!disabled) {
      UI.table($("[data-rep-table]", ctx.el), {
        id: `rep-${rep.key}`,
        rows: rep.rows,
        search: (r) => rep.cols.map((c) => c[1](r)).join(" "),
        searchPlaceholder: "ابحث في التقرير…",
        columns: rep.cols.map(([label, fn], i) => ({ key: `c${i}`, label, render: (r) => { const v = fn(r); return typeof v === "number" ? `<span class="num">${U.num(v)}</span>` : /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? U.fmtDate(v) : esc(v ?? "—"); }, sort: (r) => fn(r) })),
        pageSize: 15,
        exportName: `report-${rep.key}`,
        exportColumns: rep.cols,
        onExport: () => EHR.api.audit.log("تصدير تقرير", "التقارير", rep.title),
      });
    }
    ctx.el.onchange = (e) => {
      if (e.target.matches("[data-rep-dept]")) deptFilter = e.target.value;
      else if (e.target.matches("[data-rep-period]")) period = Number(e.target.value);
      else return;
      renderReport(ctx, rep);
    };
    ctx.el.onclick = (e) => {
      if (!e.target.closest("[data-rep-print]")) return;
      const rows = rep.rows();
      EHR.api.audit.log("طباعة تقرير", "التقارير", rep.title);
      U.printHTML(rep.title, `<div class="head"><h1>${esc(rep.title)}</h1><p>${esc(L().company(auth().companyId()).name)} — ${U.fmtLong(U.today())}${rep.timeless ? "" : ` — آخر ${period} يومًا`}${deptFilter !== "all" ? ` — ${esc(L().deptName(deptFilter))}` : ""}</p></div>
        <table><thead><tr>${rep.cols.map((c) => `<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${rep.cols.map((c) => `<td>${esc(c[1](r) ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="muted">${rows.length} سجل — بيانات تجريبية.</p>`);
    };
  };

  EHR.view("reports", {
    title: "التقارير",
    render(ctx) {
      if (ctx.param) {
        const rep = allowedReports().find((r) => r.key === ctx.param);
        if (rep) return renderReport(ctx, rep);
        ctx.el.innerHTML = UI.empty({ icon: "lock", title: "التقرير غير متاح", text: "التقرير غير موجود أو لا تملك صلاحية عرضه.", action: { label: "كل التقارير", attrs: 'data-go="#/reports"', icon: "chart" } });
        return;
      }
      const reps = allowedReports();
      const groups = U.groupBy(reps, (r) => r.group);
      const analytics = auth().can("analytics.view");
      const att = EHR.api.reports.attendanceRate(30);
      ctx.el.innerHTML = `
        ${H.pageHead("التقارير والتحليلات", "تقارير قابلة للتصفية والطباعة والتصدير إلى CSV", "chart")}
        ${analytics ? `<div class="kpis">
          ${UI.kpi({ label: "إجمالي الموظفين", value: EHR.api.reports.headcount(), iconName: "users" })}
          ${UI.kpi({ label: "معدل الدوران السنوي", value: `${EHR.api.reports.turnover(365)}%`, iconName: "trending-down", tone: "warning" })}
          ${UI.kpi({ label: "نسبة الحضور (30 يومًا)", value: `${att.rate}%`, iconName: "user-check", tone: "success", sub: `تأخير ${att.late}% · غياب ${att.absence}%` })}
          ${UI.kpi({ label: "متوسط مدة الخدمة", value: EHR.api.reports.avgTenureYears(), unit: " سنة", iconName: "award", tone: "info" })}
        </div>
        <div class="grid-2">
          <section class="card"><header class="card__head"><h3>${icon("users")}نمو القوى العاملة</h3></header>${UI.chart.line({ labels: H.lastMonths(12).map((m) => U.fmtMonthShort(m)), series: [{ label: "عدد الموظفين", color: "var(--brand)", values: H.lastMonths(12).map((m) => L().inCompany(db().employees).filter((e) => e.joinDate <= `${m}-28` && (!e.leftDate || e.leftDate > `${m}-28`)).length) }], height: 200 })}</section>
          <section class="card"><header class="card__head"><h3>${icon("sitemap")}التوزيع حسب الإدارة</h3></header>${UI.chart.hbars(L().inCompany(db().departments).map((d) => ({ label: d.name, value: L().inCompany(db().employees).filter((e) => e.departmentId === d.id && e.status !== "archived").length })), { unit: " موظف" })}</section>
        </div>` : UI.notice("تعرض التقارير بيانات فريقك المباشر فقط وفق صلاحياتك.", "info", "users")}
        ${Object.entries(groups).map(([g, list]) => `<h2 class="section-title">${esc(g)}</h2><div class="cards-grid cards-grid--sm">${list.map((r) => `<button type="button" class="card report-card" data-go="#/reports/${r.key}">${icon(r.icon)}<b>${esc(r.title)}</b><small>${esc(r.desc)}</small>${r.enabled && !r.enabled() ? UI.badge("معطّل للخصوصية", "gray") : ""}</button>`).join("")}</div>`).join("")}`;
    },
  });

  /* =========================================================
     Notifications center
     ========================================================= */
  let nFilter = "all";
  EHR.view("notifications", {
    title: "الإشعارات",
    render(ctx) {
      const all = EHR.api.notifications.visible();
      const types = [["all", "الكل", all.length], ["unread", "غير المقروءة", all.filter((n) => !n.read).length], ["approval", "الموافقات"], ["attendance", "الحضور"], ["contract", "العقود"], ["document", "المستندات"], ["payroll", "الرواتب"]];
      const list = all.filter((n) => nFilter === "all" || (nFilter === "unread" ? !n.read : n.type === nFilter));
      const s = L().settings().notifications;
      ctx.el.innerHTML = `
        ${H.pageHead("الإشعارات", "تنبيهات النظام والموافقات والانتهاءات", "bell", `<button type="button" class="btn btn--ghost" data-action="notif-read-all">${icon("check")}تحديد الكل كمقروء</button>`)}
        ${UI.tabs("nt", types, nFilter, "tabs--scroll")}
        <section class="card card--flush notif-list">${list.length ? list.map((n) => EHR.notifRow(n, false)).join("") : UI.empty({ icon: "bell", title: "لا توجد إشعارات" })}</section>
        <p class="muted small">${icon("info")} القنوات: داخل النظام ${s.inApp ? "مفعّلة" : "معطّلة"} · البريد الإلكتروني و SMS تتطلب ربط مزوّد عبر خادم (غير مفعّلة في النسخة التجريبية).</p>`;
      const self = this;
      ctx.el.onclick = (e) => {
        const tb = e.target.closest('[data-tab-group="nt"]');
        if (tb) { nFilter = tb.dataset.tab; self.render(ctx); }
      };
    },
  });

  /* =========================================================
     Calendar
     ========================================================= */
  const CAL_TYPES = [
    ["leave", "الإجازات", "info", () => auth().scope("leave") !== "none"],
    ["interview", "المقابلات", "brand", () => auth().can("recruitment.view")],
    ["training", "التدريب", "violet", () => auth().canAny(["training.view", "training.self"])],
    ["contract", "انتهاء العقود", "warning", () => auth().can("contracts.view")],
    ["document", "انتهاء المستندات", "danger", () => auth().can("documents.view")],
    ["travel", "السفر", "success", () => auth().scope("travel") !== "none"],
    ["company", "الشركة (عطل، رواتب، تقييم)", "gray", () => true],
  ];
  let calView = "month";
  let calDate = null;
  const hidden = new Set();
  const calEvents = () => {
    const ev = [];
    const on = (k) => !hidden.has(k) && CAL_TYPES.find((t) => t[0] === k)[3]();
    if (on("leave")) EHR.api.leave.visible().filter((l) => ["approved", "pending"].includes(l.status)).forEach((l) => {
      for (let d = l.from; d <= l.to; d = U.addDays(d, 1)) ev.push({ date: d, title: `${L().empName(l.employeeId).split(" ")[0]} — ${(L().leaveType(l.typeId) || {}).name}`, sub: l.status === "pending" ? "قيد الاعتماد" : "معتمدة", tone: l.status === "pending" ? "warning" : "info", link: `#/leave?open=${l.id}` });
    });
    if (on("interview")) EHR.api.candidates.all().forEach((c) => c.interviews.filter((i) => i.status === "scheduled").forEach((i) => ev.push({ date: i.date, time: i.time, title: `مقابلة: ${c.name}`, sub: i.type, tone: "brand", link: `#/recruitment?cand=${c.id}` })));
    if (on("training")) EHR.api.courses.all().filter((c) => c.status !== "cancelled").forEach((c) => {
      for (let d = c.start; d <= c.end && U.diffDays(c.start, d) < 40; d = U.addDays(d, 1)) if (E.isWorkday(L().settings(), d) || c.start === c.end) ev.push({ date: d, title: c.name, sub: c.type, tone: "violet", link: "#/training" });
    });
    if (on("contract")) L().inCompany(db().contracts).filter((c) => c.end && ["active", "renewal"].includes(c.status)).forEach((c) => ev.push({ date: c.end, title: `انتهاء عقد ${L().empName(c.employeeId).split(" ")[0]}`, sub: c.number, tone: "warning", link: `#/contracts?open=${c.id}` }));
    if (on("document")) L().inCompany(db().documents).filter((d) => d.expiry).forEach((d) => ev.push({ date: d.expiry, title: `انتهاء ${d.name}`, sub: L().empName(d.employeeId), tone: "danger", link: `#/documents?open=${d.id}` }));
    if (on("travel")) EHR.api.travel.visible().filter((t) => ["approved", "pending"].includes(t.status)).forEach((t) => {
      for (let d = t.from; d <= t.to; d = U.addDays(d, 1)) ev.push({ date: d, title: `${L().empName(t.employeeId).split(" ")[0]} — ${t.destination}`, sub: t.kind, tone: "success", link: `#/travel?open=${t.id}` });
    });
    if (on("company")) {
      const s = L().settings();
      (s.attendance.holidays || []).forEach((h) => ev.push({ date: h.date, title: h.name, tone: "gray" }));
      const base = calDate || U.today();
      [-1, 0, 1].forEach((n) => {
        const m = U.monthKey(U.addMonths(`${base.slice(0, 7)}-01`, n));
        const day = Math.min(s.payroll.payDay || 27, 28);
        ev.push({ date: `${m}-${String(day).padStart(2, "0")}`, title: "موعد صرف الرواتب", tone: "gray", link: auth().canAny(["payroll.view", "payroll.self"]) ? "#/payroll" : "" });
      });
      L().inCompany(db().perfCycles).filter((c) => c.status === "active").forEach((c) => ev.push({ date: c.end, title: `نهاية ${c.name}`, tone: "gray", link: "#/performance" }));
    }
    return ev;
  };
  EHR.view("calendar", {
    title: "التقويم",
    render(ctx) {
      if (!calDate) calDate = U.today();
      const types = CAL_TYPES.filter((t) => t[3]());
      const label = calView === "month" ? U.fmtMonth(calDate.slice(0, 7)) : calView === "week" ? `${U.fmtShort(U.addDays(calDate, -U.dayOfWeek(calDate)))} – ${U.fmtShort(U.addDays(calDate, 6 - U.dayOfWeek(calDate)))}` : U.fmtLong(calDate);
      ctx.el.innerHTML = `
        ${H.pageHead("التقويم", "الإجازات والمقابلات والتدريب وانتهاء العقود والمستندات والسفر في مكان واحد", "calendar")}
        <div class="toolbar-row">
          <div class="btn-group"><button type="button" class="icon-btn" data-cal-step="-1" aria-label="السابق">${icon("chevron-right")}</button><b class="cal-label">${label}</b><button type="button" class="icon-btn" data-cal-step="1" aria-label="التالي">${icon("chevron-left")}</button><button type="button" class="btn btn--ghost btn--sm" data-cal-today>اليوم</button></div>
          <div class="seg seg--sm" role="radiogroup" aria-label="طريقة العرض">${[["month", "شهر"], ["week", "أسبوع"], ["day", "يوم"]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${calView === k}" class="seg__btn ${calView === k ? "active" : ""}" data-cal-view="${k}">${l}</button>`).join("")}</div>
        </div>
        <div class="cal-filters">${types.map(([k, l, tone]) => `<label class="chip-check tone-${tone}"><input type="checkbox" data-cal-type="${k}" ${hidden.has(k) ? "" : "checked"}><span>${esc(l)}</span></label>`).join("")}</div>
        <section class="card cal-card">${UI.calendar({ view: calView, date: calDate, events: calEvents() })}</section>`;
      const self = this;
      ctx.el.onclick = (e) => {
        const t = e.target;
        const st = t.closest("[data-cal-step]");
        if (st) {
          const n = Number(st.dataset.calStep);
          calDate = calView === "month" ? `${U.monthKey(U.addMonths(`${calDate.slice(0, 7)}-01`, n))}-01` : U.addDays(calDate, n * (calView === "week" ? 7 : 1));
          return self.render(ctx);
        }
        if (t.closest("[data-cal-today]")) { calDate = U.today(); return self.render(ctx); }
        const v = t.closest("[data-cal-view]");
        if (v) { calView = v.dataset.calView; return self.render(ctx); }
        const more = t.closest("[data-cal-day]");
        if (more) { calDate = more.dataset.calDay; calView = "day"; return self.render(ctx); }
        const cell = t.closest(".cal-cell[data-day]");
        if (cell && !t.closest(".cal-ev")) { calDate = cell.dataset.day; calView = "day"; return self.render(ctx); }
      };
      ctx.el.onchange = (e) => {
        const cb = e.target.closest("[data-cal-type]");
        if (!cb) return;
        if (cb.checked) hidden.delete(cb.dataset.calType);
        else hidden.add(cb.dataset.calType);
        self.render(ctx);
      };
    },
  });

  /* =========================================================
     Help center
     ========================================================= */
  const FAQ = [
    ["البداية", "كيف أجرّب النظام؟", "من شاشة الدخول اختر أحد الحسابات التجريبية (مسؤول، موظف، مدير، HR، مالية). يمكنك تبديل الدور في أي وقت من قائمة المستخدم أعلى الصفحة ← «تبديل الدور التجريبي»."],
    ["البداية", "هل البيانات حقيقية؟", "لا. جميع الأسماء والأرقام والعناوين في النسخة التجريبية وهمية، وتُحفظ في متصفحك فقط (localStorage). يمكنك إعادتها لوضعها الأصلي من الإعدادات ← حالة النظام ← «إعادة ضبط البيانات التجريبية»."],
    ["البداية", "ما اختصارات لوحة المفاتيح؟", "Ctrl + K أو / لفتح البحث والأوامر، Esc لإغلاق النوافذ، والأسهم للتنقل في نتائج البحث."],
    ["الحضور", "كيف يعمل التحقق من الموقع؟", "عند الضغط على «تسجيل الحضور» يطلب المتصفح إذن الموقع (GPS)، ثم تُحسب المسافة بينك وبين موقع العمل المعتمد بمعادلة Haversine. إذا كانت المسافة أكبر من نصف القطر المسموح يُرفض التسجيل مع توضيح السبب."],
    ["الحضور", "ما هو «وضع المحاكاة»؟", "للعرض فقط: يتيح تجربة التسجيل داخل النطاق أو خارجه دون التواجد في الموقع. يظهر بوضوح «موقع محاكى (تجريبي)» على الشاشة وفي السجل. في النسخة الإنتاجية يُعطّل هذا الوضع ويُتحقق من الموقع على الخادم."],
    ["الحضور", "هل يتم تتبع موقعي؟", "لا. يُقرأ الموقع لحظة الضغط على زر التسجيل فقط، ولا يُعرض الموقع الدقيق للموظفين على أي خريطة؛ يظهر فقط هل التسجيل داخل النطاق أم خارجه، والمسافة لأصحاب الصلاحية."],
    ["الحضور", "هل يدعم النظام التحقق بالوجه؟", "ليس بعد. الميزة معروضة كـ «قيد التجهيز» ولا يلتقط النظام صورًا ولا يخزن أي بيانات حيوية. تفعيلها مستقبلًا يتطلب موافقة صريحة ومعالجة آمنة على الخادم."],
    ["الحضور", "نسيت تسجيل الانصراف، ماذا أفعل؟", "من الحضور ← طلبات التعديل ← «طلب تعديل»، اختر اليوم والوقت الصحيح واذكر السبب. بعد اعتماد المدير والموارد البشرية يُحدَّث السجل تلقائيًا ويُوثّق في سجل التدقيق."],
    ["الإجازات", "كيف يُحسب رصيد الإجازة؟", "الرصيد المتبقي = الرصيد السنوي − المعتمد − قيد الاعتماد. احتساب عطلة نهاية الأسبوع والسماح بالرصيد السالب والترحيل كلها إعدادات قابلة للتعديل."],
    ["الموافقات", "كيف تعمل مسارات الموافقات؟", "لكل نوع طلب مسار مراحل (مثل: المدير المباشر ← الموارد البشرية) يمكن تعديله من الإعدادات ← مسارات الاعتماد. لا يمكن لأي موظف اعتماد طلبه بنفسه، ويُتخطى المدير المباشر إذا لم يوجد."],
    ["الرواتب", "هل نسب الرواتب والتأمينات مثبتة في النظام؟", "لا. بدل السكن والنقل ومعامل الإضافي وأي استقطاعات أخرى كلها قيم قابلة للتعديل في قواعد الرواتب. لا توجد رسوم حكومية أو نسب نظامية مثبتة في الكود."],
    ["نهاية الخدمة", "هل يحسب النظام مكافأة نهاية الخدمة؟", "لا تلقائيًا. تُحسب البنود التشغيلية (راتب الأيام، رصيد الإجازة، السلف) تلقائيًا، بينما تُدخل مكافأة نهاية الخدمة يدويًا وفق السياسة والأنظمة المعتمدة لدى المنشأة."],
    ["الأمان", "هل هذه النسخة آمنة للاستخدام الفعلي؟", "لا. هذه نسخة عرض أمامية فقط: الصلاحيات والتحقق تتم في المتصفح ويمكن تجاوزها، والتخزين المحلي غير مشفّر. التشغيل الفعلي يتطلب خادمًا بمصادقة حقيقية وصلاحيات وتحقق وتدقيق على مستوى الخادم وقاعدة بيانات آمنة."],
    ["التكامل", "هل النظام مرتبط بقوى أو التأمينات أو مدد؟", "لا يوجد أي ربط فعلي. هذه تكاملات مخطط لها مستقبلًا وتظهر في الإعدادات بحالة «مستقبلي»."],
  ];
  EHR.view("help", {
    title: "مركز المساعدة",
    render(ctx) {
      const groups = U.groupBy(FAQ, (f) => f[0]);
      ctx.el.innerHTML = `
        ${H.pageHead("مركز المساعدة", "إجابات سريعة وإرشادات استخدام النسخة التجريبية", "help")}
        <label class="search-input search-input--lg">${icon("search")}<input type="search" data-faq-q placeholder="ابحث في الأسئلة…" aria-label="ابحث في الأسئلة"></label>
        <div class="grid-main">
          <div data-faq>${Object.entries(groups).map(([g, list]) => `<section class="faq-group" data-faq-group><h2 class="section-title">${esc(g)}</h2>${list.map(([, q, a]) => `<details class="faq" data-faq-item><summary>${esc(q)}${icon("chevron-down")}</summary><p>${esc(a)}</p></details>`).join("")}</section>`).join("")}<p class="muted" data-faq-empty hidden>لا توجد نتائج مطابقة.</p></div>
          <aside>
            <section class="card"><header class="card__head"><h3>${icon("flag")}ابدأ من هنا</h3></header><ol class="steps-list">
              <li><a class="link" href="#/attendance?tab=checkin">سجّل حضورك بالموقع أو المحاكاة</a></li>
              <li><a class="link" href="#/leave?new=1">قدّم طلب إجازة</a></li>
              <li><a class="link" href="#/requests?tab=inbox">راجع صندوق الموافقات (كمدير/HR)</a></li>
              <li><a class="link" href="#/payroll">استعرض مسير الرواتب وقسيمة الراتب</a></li>
              <li><a class="link" href="#/reports">صدّر تقريرًا إلى CSV</a></li>
            </ol></section>
            <section class="card"><header class="card__head"><h3>${icon("info")}حدود النسخة التجريبية</h3></header><ul class="bullets small"><li>التخزين في المتصفح فقط.</li><li>لا يوجد خادم مصادقة ولا كلمات مرور.</li><li>رفع الملفات محاكى.</li><li>لا إرسال بريد أو SMS فعلي.</li><li>لا تكاملات حكومية فعلية.</li></ul></section>
          </aside>
        </div>`;
      ctx.el.oninput = (e) => {
        if (!e.target.matches("[data-faq-q]")) return;
        const q = e.target.value;
        let any = 0;
        $$("[data-faq-item]", ctx.el).forEach((d) => {
          const hit = !q || U.matches(d.textContent, q);
          d.hidden = !hit;
          if (hit) any += 1;
          if (q && hit) d.open = true;
        });
        $$("[data-faq-group]", ctx.el).forEach((g) => (g.hidden = !$$("[data-faq-item]:not([hidden])", g).length));
        $("[data-faq-empty]", ctx.el).hidden = !!any;
      };
    },
  });
})((window.EHR = window.EHR || {}));
