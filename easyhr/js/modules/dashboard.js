/* =========================================================
   AZENK HR — role-based dashboards
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const { esc, icon } = U;

  const COLORS = { brand: "var(--brand)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)", violet: "var(--violet)", gray: "var(--gray)", accent: "var(--accent)" };
  const PALETTE = ["var(--brand)", "var(--info)", "var(--violet)", "var(--accent)", "var(--success)", "var(--warning)", "var(--danger)"];

  const greet = () => (new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير");
  const card = (title, sub, body, extra = "", cls = "") =>
    `<section class="card ${cls}"><header class="card__head"><div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ""}</div>${extra}</header>${body}</section>`;

  const recentOps = () => {
    const list = EHR.L.inCompany(EHR.db.audit).slice(0, 7);
    return `<div class="tbl-wrap"><table class="tbl tbl--stack tbl--compact"><thead><tr><th>المستخدم</th><th>العملية</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr></thead><tbody>${list
      .map((a) => {
        const d = new Date(a.at);
        return `<tr><td data-label="المستخدم">${UI.person(a.userName, esc(a.module), "xs")}</td><td data-label="العملية">${esc(a.action)} <small class="muted">${esc(a.record)}</small></td>
          <td data-label="التاريخ">${U.fmtDate(U.iso(d))}</td><td data-label="الوقت">${U.fmtTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)}</td>
          <td data-label="الحالة">${a.status === "success" ? UI.badge("ناجحة", "success") : UI.badge("مرفوضة", "danger")}</td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  };

  /* ---------------- HR / Admin dashboard ---------------- */
  const hrDashboard = (ctx) => {
    const db = EHR.db;
    const L = EHR.L;
    const s = L.settings();
    const emps = L.inCompany(db.employees);
    const current = emps.filter((e) => e.status !== "archived" && e.joinDate <= U.today());
    const activeCount = current.filter((e) => ["active", "probation"].includes(e.status)).length;
    const sum = EHR.api.attendance.todaySummary(current.map((e) => e.id));
    const expiring = L.inCompany(db.contracts).filter((c) => c.end && ["active", "renewal"].includes(c.status) && U.daysFromToday(c.end) >= 0 && U.daysFromToday(c.end) <= (s.contracts.alerts[0] || 30)).length;
    const pending = EHR.api.approvals.pendingAll();
    const mine = EHR.api.approvals.pendingForMe();
    const series = H.attendanceSeries(current.map((e) => e.id), 30);
    const company = L.company(EHR.auth.companyId());

    const byDept = L.inCompany(db.departments).map((d, i) => ({ label: d.name, value: current.filter((e) => e.departmentId === d.id).length, color: PALETTE[i % PALETTE.length] }));
    const months = H.lastMonths(4);
    const runs = months.map((m) => L.inCompany(db.payrollRuns).find((r) => r.period === m));
    const recruitStages = EHR.api.recruitment.STAGES.filter(([k]) => k !== "rejected").map(([k, l]) => ({ label: l, value: L.inCompany(db.candidates).filter((c) => c.stage === k).length, color: "var(--brand)" }));
    const leaveByType = db.leaveTypes.filter((t) => t.companyId === EHR.auth.companyId()).map((t) => ({ label: t.name, value: U.sum(L.inCompany(db.leaves).filter((l) => l.typeId === t.id && l.status === "approved"), (l) => l.days), color: t.color })).filter((x) => x.value);
    // Headcount at the end of each of the last 6 months (turnover context)
    const hcMonths = H.lastMonths(6);
    const headcount = hcMonths.map((m) => {
      const end = U.addDays(U.addMonths(`${m}-01`, 1), -1);
      return emps.filter((e) => e.joinDate <= end && (!e.leftDate || e.leftDate > end)).length;
    });
    const joiners = hcMonths.map((m) => emps.filter((e) => e.joinDate.slice(0, 7) === m).length);
    const leavers = hcMonths.map((m) => emps.filter((e) => e.leftDate && e.leftDate.slice(0, 7) === m).length);
    const absentByDept = L.inCompany(db.departments).map((d) => {
      const ids = new Set(current.filter((e) => e.departmentId === d.id).map((e) => e.id));
      const recs = db.attendance.filter((a) => ids.has(a.employeeId) && a.date >= U.addDays(U.today(), -30) && a.status !== "leave");
      return { label: d.name, value: U.pct(recs.filter((a) => a.status === "absent").length, recs.length), color: "var(--danger)" };
    });

    const demographics = s.privacy.showDemographics
      ? UI.chart.donut({ segments: [{ label: "ذكور", value: current.filter((e) => e.gender === "M").length, color: "var(--info)" }, { label: "إناث", value: current.filter((e) => e.gender === "F").length, color: "var(--violet)" }], center: current.length, centerLabel: "موظف", size: 150 })
      : UI.empty({ icon: "shield", title: "مخفي حسب إعدادات الخصوصية", text: "توزيع الجنس/الجنسية معطّل افتراضيًا ويمكن تفعيله من الإعدادات عند الحاجة النظامية." });

    ctx.el.innerHTML = `
      <div class="page-head page-head--hero">
        <div><h1>${greet()}، ${esc(EHR.auth.user().name.split(" ")[0])} 👋</h1><p>${U.fmtLong(U.today())} · ${esc(company.name)}</p></div>
        <div class="page-actions">
          ${EHR.auth.can("employees.create") ? `<button type="button" class="btn btn--ghost" data-go="#/employees?new=1">${icon("user-plus")}إضافة موظف</button>` : ""}
          ${EHR.auth.can("reports.view") ? `<button type="button" class="btn btn--primary" data-go="#/reports">${icon("chart")}التقارير</button>` : ""}
        </div>
      </div>
      <div class="kpis">
        ${UI.kpi({ label: "إجمالي الموظفين", value: current.length, iconName: "users", tone: "brand", attrs: 'data-go="#/employees"' })}
        ${UI.kpi({ label: "الموظفون النشطون", value: activeCount, iconName: "user-check", tone: "success", sub: `${U.pct(activeCount, current.length)}% من الإجمالي`, attrs: 'data-go="#/employees?status=active"' })}
        ${UI.kpi({ label: "الحاضرون اليوم", value: sum.present, iconName: "log-in", tone: "info", sub: `من ${sum.scheduled} مجدولين`, attrs: 'data-go="#/attendance"' })}
        ${UI.kpi({ label: "المتأخرون", value: sum.late, iconName: "clock", tone: "warning", attrs: 'data-go="#/attendance?status=late"' })}
        ${UI.kpi({ label: "الغائبون", value: sum.absent, iconName: "user-x", tone: "danger", sub: sum.notYet ? `${sum.notYet} لم يسجلوا بعد` : "", attrs: 'data-go="#/attendance?status=absent"' })}
        ${UI.kpi({ label: "في إجازة", value: sum.leave, iconName: "palm", tone: "violet", attrs: 'data-go="#/leave?tab=calendar"' })}
        ${UI.kpi({ label: "عقود ستنتهي قريبًا", value: expiring, iconName: "contract", tone: "accent", sub: `خلال ${s.contracts.alerts[0]} يومًا`, attrs: 'data-go="#/contracts"' })}
        ${UI.kpi({ label: "طلبات بانتظار الموافقة", value: pending.length, iconName: "flow", tone: "gray", sub: mine.length ? `${mine.length} بانتظارك` : "", attrs: 'data-go="#/requests?tab=inbox"' })}
      </div>

      <div class="grid grid--2-1">
        ${card("الحضور خلال الشهر", "آخر 30 يومًا (أيام العمل)", UI.chart.bars({ labels: series.labels, series: [{ label: "في الوقت", color: COLORS.success, values: series.onTime }, { label: "متأخر", color: COLORS.warning, values: series.late }, { label: "غائب", color: COLORS.danger, values: series.absent }], height: 230 }), UI.chart.legend([{ label: "في الوقت", color: COLORS.success }, { label: "متأخر", color: COLORS.warning }, { label: "غائب", color: COLORS.danger }]))}
        ${card("تنبيهات مهمة", "تحتاج إلى متابعة", H.alertsHTML(H.alerts()))}
      </div>

      <div class="grid grid--3">
        ${card("توزيع الموظفين حسب الإدارة", "", UI.chart.donut({ segments: byDept, center: current.length, centerLabel: "موظف" }))}
        ${card("نسبة الغياب حسب الإدارة", "آخر 30 يومًا", UI.chart.hbars(absentByDept, { unit: "%" }))}
        ${card("توزيع الجنس", "اختياري وقابل للتعطيل", demographics)}
      </div>

      <div class="grid grid--3">
        ${card("تكلفة الرواتب", "صافي الرواتب لآخر 4 أشهر (ر.س)", UI.chart.bars({ labels: months.map(U.fmtMonthShort), series: [{ label: "صافي الرواتب", color: COLORS.brand, values: runs.map((r) => (r ? U.sum(r.lines, (l) => l.net) : 0)) }], height: 190, format: U.num }))}
        ${card("التوظيف", "المرشحون حسب المرحلة", UI.chart.hbars(recruitStages))}
        ${card("الإجازات المعتمدة", `حسب النوع — ${U.today().slice(0, 4)}`, leaveByType.length ? UI.chart.hbars(leaveByType, { unit: " يوم" }) : UI.empty({ icon: "palm", title: "لا توجد إجازات معتمدة" }))}
      </div>

      <div class="grid grid--2">
        ${card("دوران الموظفين", `معدل الدوران السنوي: ${EHR.api.reports.turnover()}%`, UI.chart.line({ labels: hcMonths.map(U.fmtMonthShort), series: [{ label: "عدد الموظفين", color: COLORS.brand, values: headcount }], height: 180 }) + `<div class="mini-stats">${UI.info("المنضمون (6 أشهر)", U.sum(joiners))}${UI.info("المغادرون (6 أشهر)", U.sum(leavers))}${UI.info("متوسط مدة الخدمة", `${EHR.api.reports.avgTenureYears()} سنة`)}</div>`)}
        ${card("الموافقات", mine.length ? `${mine.length} طلبات بانتظار إجرائك` : "الطلبات المعلقة في الشركة", H.approvalsList(mine.length ? mine : pending), `<a class="link-btn" href="#/requests?tab=inbox">عرض الكل</a>`)}
      </div>

      ${card("آخر العمليات", "من سجل التدقيق", recentOps(), EHR.auth.can("audit.view") ? `<a class="link-btn" href="#/settings?tab=audit">سجل التدقيق</a>` : "", "card--flush-body")}
    `;
  };

  /* ---------------- Manager dashboard ---------------- */
  const managerDashboard = (ctx) => {
    const db = EHR.db;
    const L = EHR.L;
    const team = EHR.auth.team();
    const me = EHR.auth.me();
    const sum = EHR.api.attendance.todaySummary(team);
    const mine = EHR.api.approvals.pendingForMe();
    const series = H.attendanceSeries(team, 14);
    const upcoming = db.leaves.filter((l) => team.includes(l.employeeId) && l.status === "approved" && l.to >= U.today() && l.from <= U.addDays(U.today(), 30)).sort((a, b) => (a.from < b.from ? -1 : 1));
    const reviews = db.reviews.filter((r) => team.includes(r.employeeId));
    const avg = reviews.filter((r) => r.finalScore).length ? U.round(U.sum(reviews.filter((r) => r.finalScore), (r) => r.finalScore) / reviews.filter((r) => r.finalScore).length, 1) : "—";

    ctx.el.innerHTML = `
      <div class="page-head page-head--hero">
        <div><h1>${greet()}، ${esc(me.nameAr.split(" ")[0])} 👋</h1><p>لوحة المدير — ${esc(L.deptName(me.departmentId))} · ${U.fmtLong(U.today())}</p></div>
        <div class="page-actions"><button type="button" class="btn btn--primary" data-go="#/requests?tab=inbox">${icon("flow")}الموافقات${mine.length ? ` (${mine.length})` : ""}</button></div>
      </div>
      ${UI.notice("تعرض هذه اللوحة بيانات فريقك فقط. لا يمكن الاطلاع على بيانات الإدارات الأخرى.", "info", "shield")}
      <div class="kpis">
        ${UI.kpi({ label: "أعضاء الفريق", value: team.length, iconName: "users", tone: "brand", attrs: 'data-go="#/employees"' })}
        ${UI.kpi({ label: "الحاضرون", value: sum.present, iconName: "log-in", tone: "success", sub: `من ${sum.scheduled} مجدولين` })}
        ${UI.kpi({ label: "المتأخرون", value: sum.late, iconName: "clock", tone: "warning" })}
        ${UI.kpi({ label: "الغائبون", value: sum.absent, iconName: "user-x", tone: "danger" })}
        ${UI.kpi({ label: "في إجازة", value: sum.leave, iconName: "palm", tone: "violet" })}
        ${UI.kpi({ label: "موافقات معلّقة", value: mine.length, iconName: "flow", tone: "accent", attrs: 'data-go="#/requests?tab=inbox"' })}
      </div>
      <div class="grid grid--2-1">
        ${card("حضور الفريق", "آخر أسبوعين", UI.chart.bars({ labels: series.labels, series: [{ label: "في الوقت", color: COLORS.success, values: series.onTime }, { label: "متأخر", color: COLORS.warning, values: series.late }, { label: "غائب", color: COLORS.danger, values: series.absent }], height: 220 }))}
        ${card("الموافقات", "بانتظار إجرائك", H.approvalsList(mine))}
      </div>
      <div class="grid grid--3">
        ${card("الفريق اليوم", "", `<ul class="list">${sum.list.map((x) => `<li class="list__item" data-go="#/employees/${x.emp.id}" tabindex="0" role="link">${UI.avatar(x.emp.nameAr, "sm")}<div class="list__body"><b>${esc(x.emp.nameAr)}</b><small>${x.rec && x.rec.checkIn ? `حضور ${U.fmtTime(x.rec.checkIn)}` : esc(x.shift ? x.shift.name : "")}</small></div>${UI.status(H.S.attendance, x.status)}</li>`).join("") || UI.empty({ title: "لا يوجد أعضاء مجدولون اليوم" })}</ul>`)}
        ${card("تقويم إجازات الفريق", "خلال 30 يومًا", upcoming.length ? `<ul class="list">${upcoming.map((l) => `<li class="list__item">${UI.avatar(L.empName(l.employeeId), "sm")}<div class="list__body"><b>${esc(L.empName(l.employeeId))}</b><small>${esc((L.leaveType(l.typeId) || {}).name)} · ${U.fmtShort(l.from)} – ${U.fmtShort(l.to)}</small></div>${UI.badge(`${l.days} أيام`, "info", false)}</li>`).join("")}</ul>` : UI.empty({ icon: "palm", title: "لا توجد إجازات قادمة" }), `<a class="link-btn" href="#/calendar">التقويم</a>`)}
        ${card("أداء الفريق", `متوسط التقييم النهائي: ${avg}`, UI.chart.hbars(Object.entries(H.S.review).map(([k, v]) => ({ label: v.label, value: reviews.filter((r) => r.stage === k).length, color: "var(--violet)" }))), `<a class="link-btn" href="#/performance">التقييمات</a>`)}
      </div>`;
  };

  /* ---------------- Employee self-service dashboard ---------------- */
  const employeeDashboard = (ctx) => {
    const db = EHR.db;
    const L = EHR.L;
    const me = EHR.auth.me();
    const u = EHR.auth.user();
    const rec = EHR.api.attendance.todayFor(me.id);
    const shift = EHR.engine.shiftFor(db, me, U.today());
    const annual = db.leaveTypes.find((t) => t.companyId === me.companyId && t.key === "annual");
    const bal = annual ? EHR.api.leave.balance(me.id, annual.id) : { remaining: 0, opening: 0 };
    const pendingReq = [...db.requests, ...db.leaves, ...db.advances, ...db.overtime].filter((r) => r.employeeId === me.id && ["pending", "new"].includes(r.status)).length;
    const slips = EHR.api.payroll.myLines(me.id).sort((a, b) => (a.run.period < b.run.period ? 1 : -1));
    const lastSlip = slips[0];
    const myDocs = db.documents.filter((d) => d.employeeId === me.id);
    const expDocs = myDocs.filter((d) => ["expiring", "expired"].includes(H.docStatus(d))).length;
    const notifs = EHR.api.notifications.visible().slice(0, 4);
    const worked = rec && rec.checkIn && !rec.checkOut ? U.nowMin() - U.toMin(rec.checkIn) : rec && rec.workedMin;
    const state = !rec || !rec.checkIn ? "in" : !rec.checkOut ? "out" : "done";
    const myLeaves = db.leaves.filter((l) => l.employeeId === me.id && l.to >= U.today() && ["approved", "pending"].includes(l.status));
    const myCourses = db.enrollments.filter((e) => e.employeeId === me.id && ["enrolled", "in_progress"].includes(e.status));

    const workspace =
      u.role === "RECRUITER"
        ? card("مساحة عمل التوظيف", "", `<div class="mini-stats">${UI.info("وظائف مفتوحة", L.inCompany(db.jobs).filter((j) => j.status === "open").length)}${UI.info("مرشحون نشطون", L.inCompany(db.candidates).filter((c) => !["hired", "rejected"].includes(c.stage)).length)}${UI.info("مقابلات قادمة", L.inCompany(db.candidates).flatMap((c) => c.interviews).filter((i) => i.status === "scheduled").length)}</div><button type="button" class="btn btn--primary btn--sm mt" data-go="#/recruitment">${icon("briefcase")}فتح لوحة التوظيف</button>`)
        : u.role === "TRAINING"
        ? card("مساحة عمل التدريب", "", `<div class="mini-stats">${UI.info("دورات قادمة", L.inCompany(db.courses).filter((c) => c.status === "upcoming").length)}${UI.info("دورات جارية", L.inCompany(db.courses).filter((c) => c.status === "in_progress").length)}${UI.info("شهادات تنتهي خلال 30 يومًا", L.inCompany(db.enrollments).filter((e) => e.certExpiry && U.daysFromToday(e.certExpiry) <= 30 && U.daysFromToday(e.certExpiry) >= 0).length)}</div><button type="button" class="btn btn--primary btn--sm mt" data-go="#/training">${icon("graduation")}فتح التدريب</button>`)
        : "";

    ctx.el.innerHTML = `
      <div class="page-head page-head--hero">
        <div><h1>${greet()}، ${esc(me.nameAr.split(" ")[0])} 👋</h1><p>${U.fmtLong(U.today())} · ${esc(L.titleName(me.jobTitleId))}</p></div>
      </div>
      <div class="grid grid--2-1">
        <section class="card att-hero">
          <div class="att-hero__info">
            <span class="eyebrow">${icon("clock")}حضور اليوم</span>
            <h2>${state === "in" ? "لم تسجّل حضورك بعد" : state === "out" ? `حاضر منذ ${U.fmtTime(rec.checkIn)}` : "اكتمل يوم العمل"}</h2>
            <p>${shift ? `${esc(shift.name)} · ${U.fmtTime(shift.start)} – ${U.fmtTime(shift.end)}` : "لا توجد وردية اليوم"} · ${esc(L.workplaceName(me.primaryWorkplaceId))}</p>
            <div class="att-hero__stats">
              ${UI.info("وقت الحضور", rec && rec.checkIn ? U.fmtTime(rec.checkIn) : "—")}
              ${UI.info("وقت الانصراف", rec && rec.checkOut ? U.fmtTime(rec.checkOut) : "—")}
              ${UI.info("مدة العمل", worked != null ? U.fmtDuration(worked) : "—")}
            </div>
          </div>
          <a class="checkin-cta ${state === "out" ? "is-out" : state === "done" ? "is-done" : ""}" href="#/attendance?tab=checkin">
            ${icon(state === "out" ? "log-out" : state === "done" ? "check-circle" : "log-in")}
            <b>${state === "in" ? "تسجيل الحضور" : state === "out" ? "تسجيل الانصراف" : "عرض سجل اليوم"}</b>
          </a>
        </section>
        ${card("إجراءات سريعة", "", `<div class="quick">
          ${[["#/leave?new=1", "palm", "طلب إجازة"], ["#/requests?new=1", "inbox", "تقديم طلب"], ["#/advances?new=1", "coins", "طلب سلفة"], ["#/payroll", "wallet", "قسيمة الراتب"], ["#/documents", "folder", "مستنداتي"], ["#/assets", "laptop", "عهدي"]]
            .map(([h, ic, l]) => `<a class="quick__item" href="${h}">${icon(ic)}<span>${l}</span></a>`)
            .join("")}
        </div>`)}
      </div>
      <div class="kpis kpis--sm">
        ${UI.kpi({ label: "رصيد الإجازة السنوية", value: bal.remaining, unit: " يوم", iconName: "palm", tone: "violet", sub: `من ${bal.opening} يومًا`, attrs: 'data-go="#/leave"' })}
        ${UI.kpi({ label: "طلبات قيد المعالجة", value: pendingReq, iconName: "inbox", tone: "warning", attrs: 'data-go="#/requests"' })}
        ${UI.kpi({ label: "آخر راتب صافي", value: lastSlip ? U.num(lastSlip.line.net) : "—", unit: lastSlip ? " ر.س" : "", iconName: "wallet", tone: "success", sub: lastSlip ? U.fmtMonth(lastSlip.run.period) : "", attrs: 'data-go="#/payroll"' })}
        ${UI.kpi({ label: "مستندات تحتاج تحديثًا", value: expDocs, iconName: "folder", tone: expDocs ? "danger" : "gray", attrs: 'data-go="#/documents"' })}
      </div>
      <div class="grid grid--3">
        ${workspace || card("إجازاتي القادمة", "", myLeaves.length ? `<ul class="list">${myLeaves.map((l) => `<li class="list__item">${icon("palm")}<div class="list__body"><b>${esc((L.leaveType(l.typeId) || {}).name)}</b><small>${U.fmtShort(l.from)} – ${U.fmtShort(l.to)} · ${l.days} أيام</small></div>${UI.status(H.S.approval, l.status)}</li>`).join("")}</ul>` : UI.empty({ icon: "palm", title: "لا توجد إجازات قادمة", action: { label: "طلب إجازة", attrs: 'data-go="#/leave?new=1"' } }))}
        ${card("تدريبي", "", myCourses.length ? `<ul class="list">${myCourses.map((en) => { const c = db.courses.find((x) => x.id === en.courseId); return `<li class="list__item">${icon("graduation")}<div class="list__body"><b>${esc(c.name)}</b><small>${U.fmtShort(c.start)} · ${esc(c.type)}</small></div>${UI.status(H.S.enrollment, en.status)}</li>`; }).join("")}</ul>` : UI.empty({ icon: "graduation", title: "لا توجد دورات حالية" }))}
        ${card("آخر الإشعارات", "", notifs.length ? `<div class="notif-list">${notifs.map((n) => EHR.notifRow(n, true)).join("")}</div>` : UI.empty({ icon: "bell", title: "لا توجد إشعارات" }), `<a class="link-btn" href="#/notifications">الكل</a>`)}
      </div>`;
  };

  /* ---------------- Finance dashboard ---------------- */
  const financeDashboard = (ctx) => {
    const db = EHR.db;
    const L = EHR.L;
    const runs = L.inCompany(db.payrollRuns).sort((a, b) => (a.period < b.period ? -1 : 1));
    const cur = runs[runs.length - 1];
    const months = runs.slice(-4);
    const advances = L.inCompany(db.advances);
    const outstanding = U.sum(advances.filter((a) => ["approved", "active"].includes(a.status)), (a) => a.amount - Math.round((a.amount / a.installments) * EHR.engine.advancePaidBy(a, U.monthKey(U.today()))));
    const mine = EHR.api.approvals.pendingForMe();
    const tot = (k) => (cur ? U.sum(cur.lines, (l) => l[k]) : 0);
    const statusIdx = cur ? EHR.api.payroll.STATUSES.indexOf(cur.status) : 0;

    ctx.el.innerHTML = `
      <div class="page-head page-head--hero">
        <div><h1>${greet()}، ${esc(EHR.auth.user().name.split(" ")[0])} 👋</h1><p>لوحة المالية · ${U.fmtLong(U.today())}</p></div>
        <div class="page-actions"><button type="button" class="btn btn--primary" data-go="#/payroll">${icon("wallet")}مسير الرواتب</button></div>
      </div>
      <div class="kpis">
        ${UI.kpi({ label: "إجمالي الرواتب (صافي)", value: U.num(tot("net")), unit: " ر.س", iconName: "wallet", tone: "brand", sub: cur ? U.fmtMonth(cur.period) : "" })}
        ${UI.kpi({ label: "حالة المسير الحالي", value: cur ? H.S.payroll[cur.status].label : "—", iconName: "flow", tone: "warning", attrs: 'data-go="#/payroll"' })}
        ${UI.kpi({ label: "السلف القائمة", value: U.num(outstanding), unit: " ر.س", iconName: "coins", tone: "accent", attrs: 'data-go="#/advances"' })}
        ${UI.kpi({ label: "سلف بانتظار الاعتماد", value: advances.filter((a) => a.status === "pending").length, iconName: "clock", tone: "warning", attrs: 'data-go="#/advances"' })}
        ${UI.kpi({ label: "الاستقطاعات هذا الشهر", value: U.num(tot("deductions")), unit: " ر.س", iconName: "minus-circle", tone: "danger" })}
        ${UI.kpi({ label: "البدلات هذا الشهر", value: U.num(tot("housing") + tot("transport") + tot("other")), unit: " ر.س", iconName: "gift", tone: "success" })}
      </div>
      <div class="grid grid--2-1">
        ${card("اتجاه الرواتب", "الإجمالي والصافي (ر.س)", UI.chart.line({ labels: months.map((r) => U.fmtMonthShort(r.period)), series: [{ label: "الإجمالي", color: COLORS.info, values: months.map((r) => U.sum(r.lines, (l) => l.gross)) }, { label: "الصافي", color: COLORS.brand, values: months.map((r) => U.sum(r.lines, (l) => l.net)) }], height: 220 }), UI.chart.legend([{ label: "الإجمالي", color: COLORS.info }, { label: "الصافي", color: COLORS.brand }]))}
        ${card("المسير الحالي", cur ? U.fmtMonth(cur.period) : "", cur ? `${UI.stepper(EHR.api.payroll.STATUSES.map((k) => [k, H.S.payroll[k].label]), statusIdx, { compact: true })}<div class="mini-stats mt">${UI.info("عدد الموظفين", cur.lines.length)}${UI.info("الإجمالي", U.money(tot("gross")))}${UI.info("الاستقطاعات", U.money(tot("deductions")))}</div>` : UI.empty({ title: "لا يوجد مسير" }))}
      </div>
      <div class="grid grid--2">
        ${card("مكونات المسير الحالي", "", UI.chart.hbars([
          { label: "الراتب الأساسي", value: tot("basic"), color: COLORS.brand }, { label: "بدل السكن", value: tot("housing"), color: COLORS.info },
          { label: "بدل النقل", value: tot("transport"), color: COLORS.violet }, { label: "بدلات أخرى", value: tot("other"), color: COLORS.accent },
          { label: "العمل الإضافي", value: tot("overtime"), color: COLORS.success }, { label: "المكافآت والعمولات", value: tot("bonus"), color: COLORS.success },
          { label: "الاستقطاعات", value: tot("deductions"), color: COLORS.danger },
        ], { format: U.num, unit: " ر.س" }))}
        ${card("الموافقات المالية", "بانتظار إجرائك", H.approvalsList(mine))}
      </div>`;
  };

  EHR.view("dashboard", {
    title: "لوحة التحكم",
    render(ctx) {
      const role = EHR.auth.role();
      if (["SUPER_ADMIN", "HR_MANAGER", "HR_OFFICER", "AUDITOR"].includes(role)) return hrDashboard(ctx);
      if (role === "MANAGER") return managerDashboard(ctx);
      if (role === "FINANCE") return financeDashboard(ctx);
      return employeeDashboard(ctx);
    },
  });
})((window.EHR = window.EHR || {}));
