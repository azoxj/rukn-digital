/* =========================================================
   Easy HR — attendance & shifts
   - Mobile check-in with the real Geolocation API or a clearly
     labelled simulated location (demo only)
   - Haversine geofence + rule checklist before every check-in
   - History, corrections & overtime (approval workflows)
   - Workplaces (geofences), attendance rules, shifts & schedule
   NOTE: In production the location, time and rules must be
   validated server-side — a browser can be spoofed.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const E = EHR.engine;
  const { $, $$, esc, icon } = U;

  const ATT = H.S.attendance;
  const LOC = {
    inside: { label: "داخل النطاق", tone: "success" }, outside: { label: "خارج النطاق", tone: "danger" },
    simulated: { label: "موقع محاكى (تجريبي)", tone: "warning" }, manual: { label: "إدخال يدوي", tone: "gray" },
  };
  const SHIFT_TYPES = { morning: "صباحية", evening: "مسائية", night: "ليلية", rotating: "متناوبة", custom: "مخصصة/مرنة" };

  let tab = null;
  let locMode = "real"; // real | sim-inside | sim-outside
  let lastPoint = null; // last acquired location (memory only — never persisted)
  let lastVerify = null;

  const auth = () => EHR.auth;
  const me = () => EHR.auth.me();
  const canSeeAll = () => auth().scope("attendance") === "all";
  const scopeIds = () => {
    const sc = auth().scope("attendance");
    if (sc === "all") return EHR.L.inCompany(EHR.db.employees).map((e) => e.id);
    if (sc === "team") return auth().team();
    return me() ? [me().id] : [];
  };
  const canSeeLocation = (empId) => auth().can("attendance.location") || (me() && me().id === empId);
  const isMissing = (a) => a.checkIn && !a.checkOut && a.date < U.today();

  /* =========================================================
     Mini map (SVG) — schematic, not a real map tile
     ========================================================= */
  const miniMap = (wp, point) => {
    const S = 220;
    const c = S / 2;
    let px = null;
    let dist = 0;
    if (point) {
      const dx = (point.lng - wp.lng) * Math.cos((wp.lat * Math.PI) / 180) * 111320;
      const dy = (point.lat - wp.lat) * 110540;
      dist = Math.sqrt(dx * dx + dy * dy);
      const span = Math.max(wp.radius * 1.6, dist * 1.25);
      const k = (S / 2 - 14) / span;
      px = { x: c + dx * k, y: c - dy * k, r: wp.radius * k };
    }
    const span = point ? Math.max(wp.radius * 1.6, dist * 1.25) : wp.radius * 1.6;
    const r = (wp.radius * (S / 2 - 14)) / span;
    const inside = point && dist <= wp.radius;
    return `<svg class="minimap" viewBox="0 0 ${S} ${S}" role="img" aria-label="مخطط النطاق الجغرافي لموقع ${esc(wp.name)}${point ? `: المسافة ${Math.round(dist)} متر` : ""}">
      <defs><pattern id="mm-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="currentColor" stroke-opacity=".08"/></pattern></defs>
      <rect width="${S}" height="${S}" rx="16" fill="url(#mm-grid)"/>
      <circle cx="${c}" cy="${c}" r="${r}" class="minimap__fence"/>
      <circle cx="${c}" cy="${c}" r="6" class="minimap__site"/>
      ${point ? `<line x1="${c}" y1="${c}" x2="${px.x}" y2="${px.y}" class="minimap__line"/><circle cx="${px.x}" cy="${px.y}" r="8" class="minimap__me ${inside ? "is-in" : "is-out"}"/>` : ""}
      <text x="${c}" y="${c + r + 14 > S - 6 ? S - 6 : c + r + 14}" text-anchor="middle" class="minimap__label">${wp.radius} م</text>
    </svg>`;
  };

  /* =========================================================
     Check-in screen (employee)
     ========================================================= */
  const renderCheckin = (el, ctx) => {
    const emp = me();
    if (!emp) {
      el.innerHTML = `<div class="card">${UI.empty({ icon: "user", title: "لا يوجد ملف موظف مرتبط بهذا الحساب", text: "تسجيل الحضور متاح للحسابات المرتبطة بموظف. جرّب الدخول كموظف تجريبي." })}</div>`;
      return;
    }
    const s = EHR.db.settings[emp.companyId];
    const rec = EHR.api.attendance.todayFor(emp.id);
    const shift = E.shiftFor(EHR.db, emp, U.today());
    const workday = E.isWorkday(s, U.today()) && E.shiftWorksOn(shift, U.today());
    const wps = (emp.workplaceIds || []).map((id) => EHR.L.workplace(id)).filter(Boolean);
    const active = wps.filter((w) => w.status === "active");
    const nearest = lastPoint && active.length ? active.map((w) => ({ w, ...E.geofence(lastPoint, w) })).sort((a, b) => a.distance - b.distance)[0] : null;
    const mapWp = nearest ? nearest.w : active[0] || wps[0];
    const kind = rec && rec.checkIn ? (rec.checkOut ? "done" : "out") : "in";
    const leave = EHR.db.leaves.find((l) => l.employeeId === emp.id && l.status === "approved" && l.from <= U.today() && l.to >= U.today());
    const recent = EHR.db.attendance.filter((a) => a.employeeId === emp.id && a.date < U.today()).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

    el.innerHTML = `
      <div class="checkin">
        <section class="card checkin__hero">
          <div class="checkin__clock">
            <time data-clock>${U.fmtTime(U.nowTime())}</time>
            <small>${U.fmtLong(U.today())}</small>
          </div>
          <div class="checkin__shift">
            ${shift ? `${icon("repeat")}<span><b>${esc(shift.name)}</b><small>${U.fmtTime(shift.start)} – ${U.fmtTime(shift.end)} · سماح ${shift.grace ?? s.attendance.grace} دقيقة</small></span>` : `${icon("alert")}<span><b>لا توجد وردية مسندة</b><small>تواصل مع الموارد البشرية</small></span>`}
          </div>
          ${leave ? UI.notice(`أنت في إجازة معتمدة اليوم (${esc((EHR.L.leaveType(leave.typeId) || {}).name || "")}).`, "info", "palm") : ""}
          ${!workday && !leave ? UI.notice("اليوم ليس يوم عمل في جدولك. أي تسجيل سيُعامل وفق سياسة العمل في أيام العطل.", "info", "calendar") : ""}
          <div class="checkin__times">
            <div><small>الحضور</small><b>${rec && rec.checkIn ? U.fmtTime(rec.checkIn) : "—"}</b>${rec && rec.checkIn ? UI.status(ATT, rec.status) : ""}</div>
            <div><small>الانصراف</small><b>${rec && rec.checkOut ? U.fmtTime(rec.checkOut) : "—"}</b>${rec && rec.overtimeMin ? UI.badge(`إضافي ${U.fmtDuration(rec.overtimeMin)}`, "info") : rec && rec.earlyMin ? UI.badge("انصراف مبكر", "warning") : ""}</div>
            <div><small>ساعات العمل</small><b>${rec && rec.workedMin != null ? U.fmtDuration(rec.workedMin) : rec && rec.checkIn ? `<span data-elapsed="${rec.checkIn}">…</span>` : "—"}</b></div>
          </div>
          ${kind === "done"
            ? `<div class="checkin__done">${icon("check-circle")}<b>اكتمل يوم العمل</b><small>تم تسجيل الحضور والانصراف لليوم.</small></div>`
            : `<button type="button" class="checkin__btn ${kind === "out" ? "is-out" : ""}" data-punch="${kind}">${icon(kind === "in" ? "log-in" : "log-out")}<span>${kind === "in" ? "تسجيل الحضور" : "تسجيل الانصراف"}</span><small>يتم التحقق من الموقع والوردية قبل التسجيل</small></button>`}
        </section>

        <section class="card">
          <header class="card__head"><h3>${icon("pin")}الموقع</h3>${UI.badge(locMode === "real" ? "موقع حقيقي" : "وضع المحاكاة", locMode === "real" ? "success" : "warning")}</header>
          <div class="seg" role="radiogroup" aria-label="مصدر الموقع">
            ${[["real", "موقعي الحقيقي (GPS)"], ["sim-inside", "محاكاة: داخل النطاق"], ["sim-outside", "محاكاة: خارج النطاق"]]
              .map(([k, l]) => `<button type="button" role="radio" aria-checked="${locMode === k}" class="seg__btn ${locMode === k ? "active" : ""}" data-locmode="${k}">${esc(l)}</button>`)
              .join("")}
          </div>
          ${locMode !== "real" ? UI.notice("<b>وضع تجريبي:</b> هذا موقع محاكى لأغراض العرض فقط ولا يمثل موقعك الحقيقي. يُوسم السجل بأنه «موقع محاكى».", "warning", "alert") : UI.notice("سيطلب المتصفح إذن الوصول إلى موقعك. يُستخدم الموقع لحظة التسجيل فقط ولا يتم تتبعك بشكل مستمر.", "info", "shield")}
          <div class="checkin__loc">
            ${mapWp ? miniMap(mapWp, lastPoint) : ""}
            <div class="checkin__locinfo">
              ${lastPoint
                ? `${UI.info("المصدر", lastPoint.source === "real" ? "GPS المتصفح" : "محاكاة (تجريبي)")}
                   ${UI.info("دقة الموقع", `± ${U.num(lastPoint.accuracy)} م`)}
                   ${nearest ? UI.info("أقرب موقع عمل", esc(nearest.w.name)) : ""}
                   ${nearest ? UI.info("المسافة", `${U.num(nearest.distance)} م من ${nearest.radius} م ${nearest.inside ? UI.badge("داخل النطاق", "success") : UI.badge("خارج النطاق", "danger")}`) : ""}`
                : `<p class="muted">لم يتم تحديد الموقع بعد.</p>${active.length ? `<p class="small">مواقعك المعتمدة: ${active.map((w) => `<b>${esc(w.name)}</b>`).join("، ")}</p>` : UI.notice("لا يوجد موقع عمل نشط مسند لك.", "danger", "alert")}`}
              <button type="button" class="btn btn--ghost btn--sm" data-locate>${icon("crosshair")}${lastPoint ? "تحديث الموقع" : "تحديد موقعي"}</button>
            </div>
          </div>
        </section>

        ${lastVerify ? `<section class="card"><header class="card__head"><h3>${icon("shield")}نتيجة التحقق</h3>${lastVerify.ok ? UI.badge("مقبول", "success") : UI.badge("مرفوض", "danger")}</header>
          <ul class="checks">${lastVerify.checks.map((c) => `<li class="${c.ok ? "is-ok" : c.blocking ? "is-bad" : "is-warn"}">${icon(c.ok ? "check-circle" : "x-circle")}<span><b>${esc(c.label)}</b><small>${esc(c.detail)}</small></span></li>`).join("")}</ul></section>` : ""}

        <section class="card face">
          <header class="card__head"><h3>${icon("face")}التحقق بالوجه - قيد التجهيز</h3>${UI.badge("غير مفعّل", "gray")}</header>
          <p class="muted small">ميزة التحقق بالوجه غير مفعّلة في هذه النسخة. لا يتم التقاط صور أو تخزين أي بيانات حيوية (Biometric). عند تفعيلها مستقبلًا ستتطلب موافقة صريحة من الموظف ومعالجة آمنة على الخادم وفق الأنظمة المعمول بها.</p>
          <button type="button" class="btn btn--ghost btn--sm" disabled aria-disabled="true">${icon("face")}التحقق بالوجه — غير متاح</button>
        </section>

        <section class="card">
          <header class="card__head"><h3>${icon("history")}آخر أيام العمل</h3><button type="button" class="link-btn" data-att-tab="history">عرض السجل</button></header>
          ${recent.length ? `<ul class="list list--compact">${recent.map((a) => `<li class="list__item"><span class="date-chip"><b>${Number(a.date.slice(8, 10))}</b><small>${U.weekdayShort(a.date)}</small></span><div class="list__body"><b>${a.checkIn ? U.fmtTime(a.checkIn) : "—"} ← ${a.checkOut ? U.fmtTime(a.checkOut) : isMissing(a) ? "لم يُسجل" : "—"}</b><small>${a.workedMin != null ? U.fmtDuration(a.workedMin) : ""}${a.lateMin ? ` · تأخير ${a.lateMin} د` : ""}</small></div>${isMissing(a) ? UI.badge("انصراف مفقود", "warning") : UI.status(ATT, a.status)}</li>`).join("")}</ul>` : UI.empty({ icon: "clock", title: "لا توجد سجلات سابقة" })}
        </section>
      </div>`;

    // Live clock + elapsed time (cleaned up when the view changes)
    const tick = () => {
      const c = $("[data-clock]", el);
      if (c) c.textContent = U.fmtTime(U.nowTime());
      const el2 = $("[data-elapsed]", el);
      if (el2) {
        let m = U.nowMin() - U.toMin(el2.dataset.elapsed);
        if (m < 0) m += 1440;
        el2.textContent = U.fmtDuration(m);
      }
    };
    tick();
    const timer = setInterval(tick, 15000);
    ctx.cleanup = () => clearInterval(timer);
  };

  const locate = async (emp, btn) => {
    const wp = (emp.workplaceIds || []).map((id) => EHR.L.workplace(id)).find((w) => w && w.status === "active");
    if (!wp && locMode !== "real") throw new Error("لا يوجد موقع عمل نشط لمحاكاة الموقع حوله");
    const p = await UI.busy(btn, () => EHR.api.attendance.locate(locMode, wp));
    lastPoint = p;
    return p;
  };

  const punch = async (kind, btn) => {
    const emp = me();
    try {
      await UI.busy(btn, async () => {
        const point = await EHR.api.attendance.locate(locMode, (emp.workplaceIds || []).map((id) => EHR.L.workplace(id)).find((w) => w && w.status === "active") || EHR.L.workplace(emp.primaryWorkplaceId));
        lastPoint = point;
        const res = kind === "in" ? await EHR.api.attendance.checkIn(emp, point) : await EHR.api.attendance.checkOut(emp, point);
        lastVerify = res.verify;
        if (res.ok) {
          UI.toast(kind === "in" ? `تم تسجيل الحضور الساعة ${U.fmtTime(res.record.checkIn)}${res.record.status === "late" ? ` (تأخير ${res.record.lateMin} دقيقة)` : ""}` : `تم تسجيل الانصراف الساعة ${U.fmtTime(res.record.checkOut)}`, res.record.status === "late" ? "warning" : "success", point.source === "simulated" ? "وضع تجريبي — موقع محاكى" : "");
        } else {
          UI.toast(res.verify.checks.filter((c) => !c.ok && c.blocking).map((c) => `${c.label}: ${c.detail}`).join(" — "), "error", "تعذّر التسجيل");
        }
      });
    } catch (err) {
      lastVerify = null;
      UI.toast(err.message, "error", "تعذّر تحديد الموقع");
    }
    EHR.app.refresh();
  };

  /* =========================================================
     Overview (HR / manager)
     ========================================================= */
  const renderOverview = (el) => {
    const ids = scopeIds();
    const sum = EHR.api.attendance.todaySummary(ids);
    const series = H.attendanceSeries(ids, 14);
    const L = EHR.L;
    const byWp = U.groupBy(sum.list.filter((x) => x.rec && x.rec.checkIn), (x) => x.rec.workplaceId);
    el.innerHTML = `
      ${auth().scope("attendance") === "team" ? UI.notice("تعرض هذه الصفحة بيانات فريقك المباشر فقط.", "info", "users") : ""}
      <div class="kpis">
        ${UI.kpi({ label: "مجدولون اليوم", value: sum.scheduled, iconName: "users" })}
        ${UI.kpi({ label: "حاضرون", value: sum.present, iconName: "user-check", tone: "success", sub: `${U.pct(sum.present, sum.scheduled)}% من المجدولين` })}
        ${UI.kpi({ label: "متأخرون", value: sum.late, iconName: "clock", tone: "warning", attrs: 'data-today-filter="late"' })}
        ${UI.kpi({ label: "غائبون", value: sum.absent, iconName: "user-x", tone: "danger", attrs: 'data-today-filter="absent"' })}
        ${UI.kpi({ label: "في إجازة", value: sum.leave, iconName: "palm", tone: "info", attrs: 'data-today-filter="leave"' })}
        ${UI.kpi({ label: "لم يسجلوا بعد", value: sum.notYet, iconName: "hourglass", tone: "gray", attrs: 'data-today-filter="notYet"' })}
      </div>
      <div class="grid-2">
        <section class="card">
          <header class="card__head"><h3>${icon("chart")}الحضور خلال آخر أسبوعين</h3>${UI.chart.legend([{ label: "في الوقت", color: "var(--success)" }, { label: "متأخر", color: "var(--warning)" }, { label: "غائب", color: "var(--danger)" }])}</header>
          ${UI.chart.bars({ labels: series.labels, series: [{ label: "في الوقت", color: "var(--success)", values: series.onTime }, { label: "متأخر", color: "var(--warning)", values: series.late }, { label: "غائب", color: "var(--danger)", values: series.absent }], height: 220 })}
        </section>
        <section class="card">
          <header class="card__head"><h3>${icon("pin")}الحضور حسب موقع العمل</h3><small class="muted">أعداد مجمّعة فقط</small></header>
          ${UI.chart.hbars(L.inCompany(EHR.db.workplaces).filter((w) => w.status === "active").map((w) => ({ label: w.name, value: (byWp[w.id] || []).length })))}
          <p class="muted small mt">${icon("shield")} لا تُعرض المواقع الدقيقة للموظفين على الخريطة؛ يظهر فقط هل التسجيل داخل النطاق أم خارجه${auth().can("attendance.location") ? "، مع المسافة لأصحاب الصلاحية" : ""}.</p>
        </section>
      </div>
      <section class="card card--flush"><header class="card__head card__head--pad"><h3>${icon("list")}حالة اليوم</h3></header><div data-today></div></section>`;
    UI.table($("[data-today]", el), {
      id: "att-today",
      rows: () => sum.list,
      search: (x) => `${x.emp.nameAr} ${x.emp.id} ${L.deptName(x.emp.departmentId)}`,
      searchPlaceholder: "ابحث عن موظف…",
      filters: [
        { key: "status", label: "كل الحالات", options: Object.entries(ATT).filter(([k]) => k !== "holiday").map(([k, v]) => [k, v.label]), test: (x, v) => x.status === v },
        { key: "dept", label: "كل الإدارات", options: () => L.inCompany(EHR.db.departments).map((d) => [d.id, d.name]), test: (x, v) => x.emp.departmentId === v },
      ],
      defaultSort: { key: "in", dir: 1 },
      columns: [
        { key: "emp", label: "الموظف", render: (x) => H.emp(x.emp.id, `${x.emp.id} · ${esc(L.deptName(x.emp.departmentId))}`), sort: (x) => x.emp.nameAr },
        { key: "shift", label: "الوردية", render: (x) => (x.shift ? `${esc(x.shift.name)}<small class="block muted">${x.shift.start}–${x.shift.end}</small>` : "—") },
        { key: "in", label: "الحضور", render: (x) => (x.rec && x.rec.checkIn ? `<span class="num">${U.fmtTime(x.rec.checkIn)}</span>` : "—"), sort: (x) => (x.rec && x.rec.checkIn) || "99" },
        { key: "out", label: "الانصراف", render: (x) => (x.rec && x.rec.checkOut ? `<span class="num">${U.fmtTime(x.rec.checkOut)}</span>` : "—") },
        { key: "late", label: "التأخير", render: (x) => (x.rec && x.rec.lateMin ? `${x.rec.lateMin} د` : "—"), sort: (x) => (x.rec && x.rec.lateMin) || 0 },
        { key: "loc", label: "الموقع", render: (x) => (x.rec && x.rec.checkIn ? `${UI.status(LOC, x.rec.locationStatus)}${canSeeLocation(x.emp.id) && x.rec.distance != null ? `<small class="block muted">${U.num(x.rec.distance)} م</small>` : ""}` : "—") },
        { key: "status", label: "الحالة", render: (x) => UI.status(ATT, x.status), sort: (x) => x.status },
      ],
      exportName: "attendance-today",
      exportColumns: [["الرقم", (x) => x.emp.id], ["الموظف", (x) => x.emp.nameAr], ["الإدارة", (x) => L.deptName(x.emp.departmentId)], ["الحضور", (x) => (x.rec && x.rec.checkIn) || ""], ["الانصراف", (x) => (x.rec && x.rec.checkOut) || ""], ["التأخير (د)", (x) => (x.rec && x.rec.lateMin) || 0], ["الحالة", (x) => ATT[x.status].label]],
    });
  };

  /* =========================================================
     History
     ========================================================= */
  const openRecord = (id) => {
    const a = EHR.db.attendance.find((x) => x.id === id);
    if (!a) return;
    const L = EHR.L;
    const emp = L.emp(a.employeeId);
    const shift = L.shift(a.shiftId);
    const mine = me() && me().id === a.employeeId;
    const m = UI.modal({
      title: `سجل حضور — ${esc(emp.nameAr)}`, subtitle: `${U.fmtLong(a.date)} · ${a.id}`, badge: isMissing(a) ? UI.badge("انصراف مفقود", "warning") : UI.status(ATT, a.status), size: "md",
      body: `<div class="info-grid">
        ${UI.info("الوردية", shift ? `${esc(shift.name)} (${shift.start}–${shift.end})` : "—")}${UI.info("موقع العمل", esc(L.workplaceName(a.workplaceId)))}
        ${UI.info("الحضور", a.checkIn ? U.fmtTime(a.checkIn) : "—")}${UI.info("الانصراف", a.checkOut ? U.fmtTime(a.checkOut) : "—")}
        ${UI.info("ساعات العمل", a.workedMin != null ? U.fmtDuration(a.workedMin) : "—")}${UI.info("التأخير", a.lateMin ? `${a.lateMin} دقيقة` : "—")}
        ${UI.info("الانصراف المبكر", a.earlyMin ? `${a.earlyMin} دقيقة` : "—")}${UI.info("وقت إضافي (محسوب)", a.overtimeMin ? U.fmtDuration(a.overtimeMin) : "—")}
        ${UI.info("حالة الموقع", a.checkIn ? UI.status(LOC, a.locationStatus) : "—")}${canSeeLocation(a.employeeId) && a.distance != null ? UI.info("المسافة عن الموقع", `${U.num(a.distance)} م`) : ""}
        ${UI.info("المصدر", `${a.source === "mobile" ? "جوال" : a.source === "web" ? "متصفح" : a.source === "correction" ? "تصحيح معتمد" : esc(a.source || "—")}`)}${UI.info("الجهاز", esc(a.device || "—"))}
        ${UI.info("طريقة التحقق", a.verification === "location" ? "الموقع الجغرافي" : "—")}
      </div>${a.exceedsMax ? UI.notice("تجاوز الحد الأقصى لساعات العمل اليومية المحدد في السياسة.", "warning", "alert") : ""}
      ${a.overtimeMin ? UI.notice("الوقت الإضافي المحسوب لا يُصرف إلا بعد تقديم طلب عمل إضافي واعتماده.", "info", "info") : ""}`,
    });
    const btns = [];
    if (mine) btns.push({ label: "طلب تعديل", icon: "edit", onClick: () => { m.close(); openCorrectionForm(a); } });
    if (auth().can("attendance.manage") && !mine) btns.push({ label: "تعديل يدوي", icon: "edit", onClick: () => { m.close(); manualEdit(a); } });
    btns.push({ label: "إغلاق", cls: "btn--ghost" });
    m.setFooter(btns);
  };

  const manualEdit = (a) =>
    UI.formModal({
      title: "تعديل يدوي للحضور", subtitle: `${EHR.L.empName(a.employeeId)} · ${U.fmtDate(a.date)}`,
      fields: [
        { name: "checkIn", label: "وقت الحضور", type: "time" },
        { name: "checkOut", label: "وقت الانصراف", type: "time" },
        { name: "reason", label: "سبب التعديل (يُسجل في سجل التدقيق)", type: "textarea", full: true, required: true },
      ],
      values: { checkIn: a.checkIn || "", checkOut: a.checkOut || "" },
      async onSubmit(v) {
        await EHR.api.attendance.update(a.id, (r) => {
          r.checkIn = v.checkIn || null;
          r.checkOut = v.checkOut || null;
          r.source = "manual";
          r.locationStatus = r.checkIn ? r.locationStatus || "manual" : r.locationStatus;
          const emp = EHR.L.emp(r.employeeId);
          const shift = E.shiftFor(EHR.db, emp, r.date) || EHR.L.shift(r.shiftId);
          if (r.status === "absent" && r.checkIn) r.status = null;
          Object.assign(r, E.calcAttendance(r, shift, EHR.db.settings[r.companyId].attendance));
          r.status = E.attendanceStatus({ ...r, status: r.checkIn ? null : "absent" });
        }, `الحضور — ${v.reason}`, "تعديل يدوي");
        UI.toast("تم تعديل السجل وتوثيقه في سجل التدقيق", "success");
        EHR.app.refresh();
        return true;
      },
    });

  const renderHistory = (el, query) => {
    const L = EHR.L;
    const ids = new Set(scopeIds());
    const preset = {};
    if (query.emp) preset.emp = query.emp;
    if (query.status) preset.status = query.status;
    if (Object.keys(preset).length) UI.presetTable("att-history", { filters: preset });
    const self = auth().scope("attendance") === "self";
    const columns = [
      { key: "date", label: "التاريخ", render: (a) => `<b>${U.fmtDate(a.date)}</b><small class="block muted">${U.weekday(a.date)}</small>`, sort: (a) => a.date },
      { key: "in", label: "الحضور", render: (a) => (a.checkIn ? `<span class="num">${U.fmtTime(a.checkIn)}</span>` : "—") },
      { key: "out", label: "الانصراف", render: (a) => (a.checkOut ? `<span class="num">${U.fmtTime(a.checkOut)}</span>` : isMissing(a) ? UI.badge("لم يُسجل", "warning") : "—") },
      { key: "worked", label: "ساعات العمل", render: (a) => (a.workedMin != null ? U.fmtDuration(a.workedMin) : "—"), sort: (a) => a.workedMin || 0 },
      { key: "late", label: "التأخير", render: (a) => (a.lateMin ? `${a.lateMin} د` : "—"), sort: (a) => a.lateMin || 0 },
      { key: "ot", label: "إضافي", render: (a) => (a.overtimeMin ? U.fmtDuration(a.overtimeMin) : "—"), sort: (a) => a.overtimeMin || 0 },
      { key: "loc", label: "الموقع", render: (a) => (a.checkIn ? `${UI.status(LOC, a.locationStatus)}${canSeeLocation(a.employeeId) && a.distance != null ? `<small class="block muted">${U.num(a.distance)} م · ${esc(a.device || "")}</small>` : ""}` : "—") },
      { key: "status", label: "الحالة", render: (a) => UI.status(ATT, a.status), sort: (a) => a.status },
    ];
    if (!self) columns.unshift({ key: "emp", label: "الموظف", render: (a) => H.emp(a.employeeId), sort: (a) => L.empName(a.employeeId) });
    el.innerHTML = '<div class="card card--flush"><div data-hist></div></div>';
    UI.table($("[data-hist]", el), {
      id: "att-history",
      rows: () => L.inCompany(EHR.db.attendance).filter((a) => ids.has(a.employeeId)),
      search: self ? null : (a) => `${L.empName(a.employeeId)} ${a.employeeId}`,
      searchPlaceholder: "ابحث باسم الموظف…",
      filters: [
        ...(self ? [] : [{ key: "emp", label: "كل الموظفين", options: () => [...ids].map((id) => L.emp(id)).filter(Boolean).map((e) => [e.id, e.nameAr]), test: (a, v) => a.employeeId === v }]),
        { key: "status", label: "كل الحالات", options: [["present", "حاضر"], ["late", "متأخر"], ["absent", "غائب"], ["leave", "إجازة"], ["missing", "انصراف مفقود"], ["outside", "خارج النطاق"]], test: (a, v) => (v === "missing" ? isMissing(a) : v === "outside" ? a.locationStatus === "outside" : a.status === v) },
        { key: "period", label: "كل الفترات", options: [["0", "اليوم"], ["7", "آخر 7 أيام"], ["30", "آخر 30 يومًا"]], test: (a, v) => a.date >= U.addDays(U.today(), -Number(v)) },
      ],
      defaultSort: { key: "date", dir: -1 },
      pageSize: 12,
      rowAttrs: (a) => `data-att="${a.id}" tabindex="0" class="is-click"`,
      columns,
      exportName: "attendance",
      exportColumns: [["الرقم الوظيفي", (a) => a.employeeId], ["الموظف", (a) => L.empName(a.employeeId)], ["التاريخ", (a) => a.date], ["الحضور", (a) => a.checkIn || ""], ["الانصراف", (a) => a.checkOut || ""], ["ساعات العمل (د)", (a) => a.workedMin ?? ""], ["التأخير (د)", (a) => a.lateMin || 0], ["الإضافي (د)", (a) => a.overtimeMin || 0], ["حالة الموقع", (a) => (LOC[a.locationStatus] || {}).label || ""], ["الحالة", (a) => (ATT[a.status] || {}).label || a.status]],
    });
  };

  /* =========================================================
     Corrections & overtime (approval workflows)
     ========================================================= */
  const approvalCols = (extra) => {
    const L = EHR.L;
    return [
      { key: "emp", label: "الموظف", render: (r) => H.emp(r.employeeId), sort: (r) => L.empName(r.employeeId) },
      ...extra,
      { key: "step", label: "المرحلة الحالية", render: (r) => { const st = EHR.api.approvals.currentStep(r); return st ? esc(EHR.api.approvals.STEP_LABEL[st.role]) : "—"; } },
      { key: "status", label: "الحالة", render: (r) => UI.status(H.S.approval, r.status), sort: (r) => r.status },
    ];
  };
  const statusTabs = [["all", "الكل"], ["pending", "قيد الاعتماد", (r) => r.status === "pending"], ["mine", "بانتظاري", (r) => EHR.api.approvals.canAct(r)], ["approved", "معتمد", (r) => r.status === "approved"], ["rejected", "مرفوض", (r) => r.status === "rejected"]];

  const openCorrectionForm = (att = null) => {
    const emp = me();
    if (!emp) return UI.toast("طلب التعديل متاح للموظفين فقط", "error");
    const recs = EHR.db.attendance.filter((a) => a.employeeId === emp.id && a.date >= U.addDays(U.today(), -30)).sort((a, b) => (a.date < b.date ? 1 : -1));
    UI.formModal({
      title: "طلب تعديل حضور", subtitle: "يمر الطلب بمسار الاعتماد ثم يُحدَّث السجل تلقائيًا بعد الموافقة.",
      fields: [
        { name: "attendanceId", label: "اليوم", type: "select", required: true, options: recs.map((a) => [a.id, `${U.fmtDate(a.date)} — ${a.checkIn ? U.fmtTime(a.checkIn) : "—"} ← ${a.checkOut ? U.fmtTime(a.checkOut) : "بدون انصراف"}`]) },
        { name: "field", label: "المطلوب تعديله", type: "select", options: [["checkOut", "وقت الانصراف"], ["checkIn", "وقت الحضور"]], required: true },
        { name: "requested", label: "الوقت الصحيح", type: "time", required: true },
        { name: "reason", label: "السبب", type: "textarea", full: true, required: true },
        { name: "attachment", label: "مرفق (اختياري)", type: "file", full: true },
      ],
      values: { attendanceId: att ? att.id : (recs.find(isMissing) || recs[0] || {}).id, field: att && !isMissing(att) && att.lateMin ? "checkIn" : "checkOut" },
      submitLabel: "إرسال الطلب",
      async onSubmit(v) {
        const a = EHR.db.attendance.find((x) => x.id === v.attendanceId);
        if (EHR.db.corrections.some((c) => c.attendanceId === a.id && c.field === v.field && c.status === "pending")) throw new Error("يوجد طلب تعديل قيد الاعتماد لنفس اليوم");
        await EHR.api.submitWithApproval("corrections", "correction", { id: U.uid("CR"), employeeId: emp.id, attendanceId: a.id, date: a.date, field: v.field, original: a[v.field], requested: v.requested, reason: v.reason, attachment: v.attachment ? v.attachment.name : null }, "الحضور");
        UI.toast("تم إرسال طلب التعديل للاعتماد", "success");
        EHR.app.refresh();
        return true;
      },
    });
  };

  const correctionsCrud = () =>
    EHR.crud({
      key: "corrections", title: "طلبات تعديل الحضور", embedded: true, icon: "edit",
      subtitle: "عند الاعتماد النهائي يُحدَّث سجل الحضور وتُعاد حساباته ويُوثّق التغيير في سجل التدقيق.",
      api: EHR.api.corrections, statuses: H.S.approval, approvalCollection: "corrections",
      tabs: statusTabs,
      canCreate: () => !!me() && auth().can("attendance.self"),
      createLabel: "طلب تعديل",
      columns: approvalCols([
        { key: "date", label: "اليوم", render: (r) => U.fmtDate(r.date), sort: (r) => r.date },
        { key: "field", label: "التعديل", render: (r) => `${r.field === "checkIn" ? "الحضور" : "الانصراف"}: <span class="num">${r.original ? U.fmtTime(r.original) : "—"}</span> ← <b class="num">${U.fmtTime(r.requested)}</b>` },
      ]),
      search: (r) => `${EHR.L.empName(r.employeeId)} ${r.id} ${r.reason}`,
      defaultSort: { key: "date", dir: -1 },
      detailTitle: (r) => `طلب تعديل حضور — ${esc(EHR.L.empName(r.employeeId))}`,
      detailSubtitle: (r) => r.id,
      detailBody: (r) => `<div class="info-grid">${UI.info("اليوم", U.fmtLong(r.date))}${UI.info("الحقل", r.field === "checkIn" ? "وقت الحضور" : "وقت الانصراف")}${UI.info("القيمة الأصلية", r.original ? U.fmtTime(r.original) : "غير مسجل")}${UI.info("القيمة المطلوبة", U.fmtTime(r.requested))}${UI.info("المرفق", r.attachment ? esc(r.attachment) : "—")}</div>${UI.section("السبب", `<p>${esc(r.reason)}</p>`, "note")}`,
    });

  const overtimeCrud = () =>
    EHR.crud({
      key: "overtime", title: "طلبات العمل الإضافي", embedded: true, icon: "clock-plus",
      subtitle: "يُصرف الوقت الإضافي في الرواتب فقط بعد الاعتماد النهائي، بالمعامل المحدد في سياسة الرواتب.",
      api: EHR.api.overtime, statuses: H.S.approval, approvalCollection: "overtime",
      tabs: statusTabs,
      canCreate: () => !!me() && auth().can("attendance.self"),
      createLabel: "طلب عمل إضافي",
      columns: approvalCols([
        { key: "date", label: "التاريخ", render: (r) => U.fmtDate(r.date), sort: (r) => r.date },
        { key: "hours", label: "الساعات", render: (r) => `<span class="num">${r.hours}</span> س`, sort: (r) => r.hours },
      ]),
      search: (r) => `${EHR.L.empName(r.employeeId)} ${r.id} ${r.reason}`,
      defaultSort: { key: "date", dir: -1 },
      formFields: () => [
        { name: "date", label: "تاريخ العمل الإضافي", type: "date", required: true, max: U.addDays(U.today(), 30) },
        { name: "hours", label: "عدد الساعات", type: "number", min: 0.5, max: EHR.L.settings().attendance.maxDailyHours, step: "0.5", required: true },
        { name: "reason", label: "المهمة / السبب", type: "textarea", full: true, required: true },
      ],
      defaults: () => ({ date: U.today(), hours: 1 }),
      create: (v) => EHR.api.submitWithApproval("overtime", "overtime", { id: U.uid("OT"), employeeId: me().id, date: v.date, hours: Number(v.hours), reason: v.reason }, "الحضور"),
      createdMsg: "تم إرسال طلب العمل الإضافي للاعتماد",
      detailTitle: (r) => `عمل إضافي — ${esc(EHR.L.empName(r.employeeId))}`,
      detailSubtitle: (r) => r.id,
      detailBody: (r) => {
        const att = EHR.db.attendance.find((a) => a.employeeId === r.employeeId && a.date === r.date);
        return `<div class="info-grid">${UI.info("التاريخ", U.fmtLong(r.date))}${UI.info("الساعات المطلوبة", `${r.hours} ساعة`)}${UI.info("الإضافي المسجل بالحضور", att && att.overtimeMin ? U.fmtDuration(att.overtimeMin) : "لا يوجد")}${UI.info("المعامل", `× ${EHR.L.settings().payroll.overtimeMultiplier}`)}</div>${UI.section("السبب", `<p>${esc(r.reason)}</p>`, "note")}`;
      },
    });

  /* =========================================================
     Workplaces (geofences) & tester
     ========================================================= */
  const canManageWp = () => auth().canAny(["attendance.manage", "settings.manage"]);
  const openWorkplaceForm = (wp = null) => {
    const L = EHR.L;
    UI.formModal({
      title: wp ? `تعديل موقع العمل — ${wp.name}` : "إضافة موقع عمل",
      subtitle: "حدد الإحداثيات ونصف قطر النطاق المسموح لتسجيل الحضور.",
      size: "lg",
      fields: [
        { name: "name", label: "اسم الموقع", required: true },
        { name: "branchId", label: "الفرع", type: "select", options: L.inCompany(EHR.db.branches).map((b) => [b.id, b.name]), required: true },
        { name: "address", label: "العنوان", full: true },
        { name: "lat", label: "خط العرض (Latitude)", type: "number", step: "any", min: -90, max: 90, required: true, dir: "ltr" },
        { name: "lng", label: "خط الطول (Longitude)", type: "number", step: "any", min: -180, max: 180, required: true, dir: "ltr" },
        { name: "radius", label: "نصف القطر المسموح (متر)", type: "number", min: 20, max: 5000, required: true },
        { name: "status", label: "الحالة", type: "select", options: [["active", "نشط"], ["inactive", "غير نشط"]] },
        { name: "departmentIds", label: "الإدارات المرتبطة", type: "checkgroup", full: true, options: L.inCompany(EHR.db.departments).map((d) => [d.id, d.name]) },
        { type: "note", label: "يمكنك الحصول على الإحداثيات من أي تطبيق خرائط. زر «استخدام موقعي الحالي» يستخدم GPS المتصفح لتعبئتها." },
      ],
      values: wp || { radius: 150, status: "active", departmentIds: [], branchId: (L.inCompany(EHR.db.branches)[0] || {}).id },
      extraFooter: [{ label: "استخدام موقعي الحالي", icon: "crosshair", push: true, onClick: async (e, btn, m) => {
        const r = await UI.run(btn, () => EHR.api.attendance.locate("real"));
        if (r) {
          $('[name="lat"]', m.el).value = r.lat.toFixed(6);
          $('[name="lng"]', m.el).value = r.lng.toFixed(6);
          UI.toast(`تم تحديد الموقع بدقة ± ${r.accuracy} م`, "success");
        }
      } }],
      async onSubmit(v) {
        const data = { ...v, lat: Number(v.lat), lng: Number(v.lng), radius: Number(v.radius) };
        if (wp) await EHR.api.records("workplaces").update(wp.id, data, "مواقع العمل");
        else await EHR.api.records("workplaces").create({ id: U.uid("W"), ...data }, "مواقع العمل");
        UI.toast("تم حفظ موقع العمل", "success");
        EHR.app.refresh();
        return true;
      },
    });
  };
  const geofenceTester = () => {
    const wps = EHR.L.inCompany(EHR.db.workplaces);
    const fields = [
      { name: "wp", label: "موقع العمل", type: "select", options: wps.map((w) => [w.id, `${w.name} (${w.radius} م)`]), required: true },
      { name: "lat", label: "خط العرض للنقطة", type: "number", step: "any", required: true, dir: "ltr" },
      { name: "lng", label: "خط الطول للنقطة", type: "number", step: "any", required: true, dir: "ltr" },
    ];
    const p = U.offsetPoint(wps[0].lat, wps[0].lng, 90, 30);
    const m = UI.modal({ title: "اختبار النطاق الجغرافي", subtitle: "احسب المسافة (Haversine) بين نقطة وموقع العمل", size: "md", body: `${UI.formHTML(fields, { wp: wps[0].id, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }, "gfTest")}<div data-gf-out class="mt"></div>` });
    const calc = () => {
      const { values, errors } = UI.readForm($("#gfTest", m.el), fields);
      UI.showErrors($("#gfTest", m.el), errors);
      if (Object.keys(errors).length) return;
      const w = EHR.L.workplace(values.wp);
      const g = E.geofence({ lat: values.lat, lng: values.lng }, w);
      $("[data-gf-out]", m.el).innerHTML = `<div class="gf-result">${miniMap(w, { lat: values.lat, lng: values.lng })}<div>${UI.info("المسافة", `${U.num(g.distance)} متر`)}${UI.info("نصف القطر", `${g.radius} متر`)}${UI.info("النتيجة", g.inside ? UI.badge("داخل النطاق — يُسمح بالتسجيل", "success") : UI.badge("خارج النطاق — يُرفض التسجيل", "danger"))}</div></div>`;
    };
    m.setFooter([{ label: "إغلاق", cls: "btn--ghost" }, { label: "احسب", cls: "btn--primary", icon: "crosshair", onClick: calc }]);
    calc();
  };
  const renderWorkplaces = (el) => {
    const L = EHR.L;
    const wps = L.inCompany(EHR.db.workplaces);
    const today = U.today();
    el.innerHTML = `
      <div class="toolbar-row toolbar-row--end"><p class="muted small grow">المواقع المعتمدة لتسجيل الحضور مع نطاقها الجغرافي. لا يتم عرض مواقع الموظفين الدقيقة.</p>
        <button type="button" class="btn btn--ghost" data-gf-test>${icon("crosshair")}اختبار النطاق</button>
        ${canManageWp() ? `<button type="button" class="btn btn--primary" data-wp-new>${icon("plus")}إضافة موقع</button>` : ""}</div>
      <div class="cards-grid">${wps
        .map((w) => {
          const staff = L.inCompany(EHR.db.employees).filter((e) => (e.workplaceIds || []).includes(w.id) && e.status !== "archived").length;
          const present = EHR.db.attendance.filter((a) => a.workplaceId === w.id && a.date === today && a.checkIn).length;
          return `<article class="card wp-card ${w.status !== "active" ? "is-muted" : ""}">
            <header class="card__head"><h3>${icon("pin")}${esc(w.name)}</h3>${w.status === "active" ? UI.badge("نشط", "success") : UI.badge("غير نشط", "gray")}</header>
            <div class="wp-card__body">${miniMap(w, null)}
              <div>${UI.info("الفرع", esc(L.branchName(w.branchId)))}${UI.info("الإحداثيات", `<span dir="ltr" class="num">${w.lat.toFixed(4)}, ${w.lng.toFixed(4)}</span>`)}${UI.info("نصف القطر", `${w.radius} م`)}${UI.info("الموظفون المصرّح لهم", staff)}${UI.info("حاضرون اليوم", present)}</div></div>
            <p class="muted small">${esc(w.address || "")}</p>
            ${canManageWp() ? `<footer class="card__foot"><button type="button" class="btn btn--ghost btn--sm" data-wp-edit="${w.id}">${icon("edit")}تعديل</button><button type="button" class="btn btn--ghost btn--sm" data-wp-toggle="${w.id}">${icon(w.status === "active" ? "pause" : "play")}${w.status === "active" ? "تعطيل" : "تفعيل"}</button></footer>` : ""}
          </article>`;
        })
        .join("")}</div>`;
  };

  /* =========================================================
     Attendance rules (shared with settings)
     ========================================================= */
  const RULE_FIELDS = [
    { name: "grace", label: "فترة السماح الافتراضية للتأخير (دقيقة)", type: "number", min: 0, max: 120, required: true, hint: "يمكن تخصيصها لكل وردية" },
    { name: "earlyCheckout", label: "حد الانصراف المبكر (دقيقة قبل نهاية الوردية)", type: "number", min: 0, max: 240, required: true },
    { name: "overtimeAfter", label: "يُحتسب الإضافي بعد (دقيقة من نهاية الوردية)", type: "number", min: 0, max: 240, required: true },
    { name: "maxDailyHours", label: "الحد الأقصى لساعات العمل اليومية", type: "number", min: 1, max: 24, required: true },
    { name: "absenceAfter", label: "يُعتبر غائبًا بعد (دقيقة من بداية الوردية دون تسجيل)", type: "number", min: 15, max: 720, required: true },
    { name: "weekendWork", label: "العمل في أيام العطل", type: "select", options: [["overtime", "يُحتسب عملًا إضافيًا"], ["normal", "يوم عمل عادي"], ["blocked", "غير مسموح"]] },
    { name: "requireGeofence", label: "إلزام التحقق من النطاق الجغرافي", type: "checkbox", full: true },
    { name: "allowWebCheckIn", label: "السماح بالتسجيل من متصفح الحاسب", type: "checkbox", full: true },
  ];
  EHR.openAttendanceRules = () =>
    UI.formModal({
      title: "قواعد الحضور والانصراف", subtitle: "جميع القيم قابلة للتعديل حسب سياسة الشركة — لا توجد قيم نظامية مثبتة في النظام.", size: "lg",
      fields: RULE_FIELDS, values: EHR.L.settings().attendance,
      async onSubmit(v) {
        await EHR.api.call(() => {
          Object.assign(EHR.L.settings().attendance, { ...v, grace: Number(v.grace), earlyCheckout: Number(v.earlyCheckout), overtimeAfter: Number(v.overtimeAfter), maxDailyHours: Number(v.maxDailyHours), absenceAfter: Number(v.absenceAfter) });
          EHR.api.audit.log("تعديل السياسة", "قواعد الحضور", "attendance");
        });
        UI.toast("تم حفظ قواعد الحضور", "success");
        EHR.app.refresh();
        return true;
      },
    });
  const rulesSummary = () => {
    const r = EHR.L.settings().attendance;
    const ww = { overtime: "يُحتسب إضافيًا", normal: "يوم عادي", blocked: "غير مسموح" };
    return `<div class="info-grid">${UI.info("فترة السماح", `${r.grace} دقيقة`)}${UI.info("الانصراف المبكر", `قبل ${r.earlyCheckout} دقيقة`)}${UI.info("بداية الإضافي", `بعد ${r.overtimeAfter} دقيقة`)}${UI.info("الحد اليومي", `${r.maxDailyHours} ساعة`)}${UI.info("الغياب", `بعد ${r.absenceAfter} دقيقة`)}${UI.info("العطل", ww[r.weekendWork] || "—")}${UI.info("النطاق الجغرافي", r.requireGeofence ? "إلزامي" : "غير مفعّل")}${UI.info("التسجيل من المتصفح", r.allowWebCheckIn ? "مسموح" : "غير مسموح")}</div>
      ${UI.section("العطل الرسمية المُعرّفة", (r.holidays || []).length ? `<ul class="list list--compact">${r.holidays.map((h) => `<li class="list__item"><span class="list__icon">${icon("calendar")}</span><div class="list__body"><b>${esc(h.name)}</b><small>${U.fmtLong(h.date)}</small></div></li>`).join("")}</ul>` : '<p class="muted">لا توجد</p>', "calendar")}
      ${UI.notice("أمثلة الحساب: وردية تبدأ 08:00 بسماح 15 دقيقة — الحضور 08:08 يُعد في الوقت، والحضور 08:25 يُعد تأخيرًا بمقدار 25 دقيقة.", "info", "info")}`;
  };

  /* =========================================================
     Attendance page
     ========================================================= */
  const tabsFor = () => {
    const list = [];
    const sc = auth().scope("attendance");
    if (sc === "all" || sc === "team") list.push(["overview", "نظرة عامة"]);
    if (me() && auth().can("attendance.self")) list.push(["checkin", "تسجيل الحضور"]);
    list.push(["history", "السجل"]);
    list.push(["corrections", "طلبات التعديل"]);
    list.push(["overtime", "العمل الإضافي"]);
    if (sc !== "self" || canManageWp()) list.push(["workplaces", "مواقع العمل"]);
    if (sc === "all") list.push(["rules", "القواعد"]);
    return list;
  };

  const render = (ctx) => {
    const tabs = tabsFor();
    if (ctx.query.tab && tabs.some((t) => t[0] === ctx.query.tab)) tab = ctx.query.tab;
    if (!tab || !tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
    const pendMine = EHR.api.approvals.pendingForMe().filter((p) => ["corrections", "overtime"].includes(p.def.collection));
    const counts = { corrections: pendMine.filter((p) => p.def.collection === "corrections").length, overtime: pendMine.filter((p) => p.def.collection === "overtime").length };
    ctx.el.innerHTML = `
      ${H.pageHead("الحضور والانصراف", canSeeAll() ? "متابعة الحضور اليومي والسجلات والتصحيحات والعمل الإضافي" : "سجّل حضورك وتابع سجلك وطلباتك", "clock",
        `${me() && auth().can("attendance.self") && tab !== "checkin" ? `<button type="button" class="btn btn--primary" data-att-tab="checkin">${icon("log-in")}تسجيل الحضور</button>` : ""}`)}
      ${UI.tabs("att", tabs.map(([k, l]) => [k, l, counts[k] || null]), tab, "tabs--scroll")}
      <div data-att-body></div>`;
    const body = $("[data-att-body]", ctx.el);
    const q = ctx.query;
    if (tab === "overview") renderOverview(body);
    else if (tab === "checkin") renderCheckin(body, ctx);
    else if (tab === "history") renderHistory(body, q);
    else if (tab === "corrections") correctionsCrud().render({ el: body, query: { open: q.open, new: q.new }, view: "attendance" });
    else if (tab === "overtime") overtimeCrud().render({ el: body, query: { open: q.open, new: q.new }, view: "attendance" });
    else if (tab === "workplaces") renderWorkplaces(body);
    else if (tab === "rules") body.innerHTML = `<section class="card"><header class="card__head"><h3>${icon("settings")}قواعد الحضور الحالية</h3>${auth().can("attendance.manage") || auth().can("settings.manage") ? `<button type="button" class="btn btn--primary btn--sm" data-rules-edit>${icon("edit")}تعديل القواعد</button>` : ""}</header>${rulesSummary()}</section>`;
    if (Object.keys(q).length) {
      history.replaceState(null, "", "#/attendance");
      ctx.query = {};
    }

    ctx.el.onclick = async (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab-group="att"]') || t.closest("[data-att-tab]");
      if (tb) {
        tab = tb.dataset.tab || tb.dataset.attTab;
        return render(ctx);
      }
      const tf = t.closest("[data-today-filter]");
      if (tf) {
        UI.presetTable("att-today", { filters: { status: tf.dataset.todayFilter } });
        return render(ctx);
      }
      const lm = t.closest("[data-locmode]");
      if (lm) {
        locMode = lm.dataset.locmode;
        lastPoint = null;
        lastVerify = null;
        return render(ctx);
      }
      const lb = t.closest("[data-locate]");
      if (lb) {
        try {
          await locate(me(), lb);
          lastVerify = null;
        } catch (err) {
          UI.toast(err.message, "error", "تعذّر تحديد الموقع");
        }
        return render(ctx);
      }
      const pb = t.closest("[data-punch]");
      if (pb) return punch(pb.dataset.punch, pb);
      const ar = t.closest("[data-att]");
      if (ar) return openRecord(ar.dataset.att);
      if (t.closest("[data-gf-test]")) return geofenceTester();
      if (t.closest("[data-wp-new]")) return openWorkplaceForm();
      const we = t.closest("[data-wp-edit]");
      if (we) return openWorkplaceForm(EHR.L.workplace(we.dataset.wpEdit));
      const wt = t.closest("[data-wp-toggle]");
      if (wt) {
        const w = EHR.L.workplace(wt.dataset.wpToggle);
        await UI.run(wt, () => EHR.api.records("workplaces").update(w.id, { status: w.status === "active" ? "inactive" : "active" }, "مواقع العمل"), "تم تحديث حالة الموقع");
        return EHR.app.refresh();
      }
      if (t.closest("[data-rules-edit]")) return EHR.openAttendanceRules();
    };
    ctx.el.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.matches("[data-att]")) openRecord(e.target.dataset.att);
    };
  };

  EHR.view("attendance", { title: "الحضور والانصراف", render });

  /* =========================================================
     Shifts & schedule
     ========================================================= */
  let shiftTab = "list";
  let weekStart = null;
  let schedDept = "all";

  const openShiftForm = (sh = null) => {
    const L = EHR.L;
    const others = L.inCompany(EHR.db.shifts).filter((s) => s.type !== "rotating" && (!sh || s.id !== sh.id));
    UI.formModal({
      title: sh ? `تعديل الوردية — ${sh.name}` : "إضافة وردية", size: "lg",
      fields: [
        { name: "name", label: "اسم الوردية", required: true },
        { name: "type", label: "النوع", type: "select", options: Object.entries(SHIFT_TYPES), required: true },
        { name: "start", label: "بداية الوردية", type: "time", required: true },
        { name: "end", label: "نهاية الوردية", type: "time", required: true, hint: "إذا كانت النهاية قبل البداية تُعامل كوردية ليلية تمتد لليوم التالي" },
        { name: "breakMin", label: "الاستراحة (دقيقة)", type: "number", min: 0, max: 180, required: true },
        { name: "grace", label: "فترة السماح (دقيقة)", type: "number", min: 0, max: 120, required: true },
        { name: "workplaceId", label: "موقع العمل الافتراضي", type: "select", options: L.inCompany(EHR.db.workplaces).map((w) => [w.id, w.name]) },
        { name: "days", label: "أيام العمل", type: "checkgroup", full: true, required: true, options: U.WEEKDAYS.map((d, i) => [String(i), d]) },
        { name: "rotation", label: "الورديات المتناوبة (أسبوعيًا — للنوع «متناوبة»)", type: "checkgroup", full: true, options: others.map((s) => [s.id, s.name]) },
      ],
      values: sh ? { ...sh, days: sh.days.map(String), rotation: sh.rotation || [] } : { type: "morning", start: "08:00", end: "17:00", breakMin: 60, grace: EHR.L.settings().attendance.grace, days: EHR.L.settings().company.workWeek.map(String), rotation: [] },
      async onSubmit(v) {
        if (v.type === "rotating" && (v.rotation || []).length < 2) throw UI.fieldError({ rotation: "اختر ورديتين على الأقل للتناوب" });
        const data = { name: v.name, type: v.type, start: v.start, end: v.end, breakMin: Number(v.breakMin), grace: Number(v.grace), workplaceId: v.workplaceId, days: v.days.map(Number), rotation: v.type === "rotating" ? v.rotation : undefined };
        if (sh) await EHR.api.records("shifts").update(sh.id, data, "الورديات");
        else await EHR.api.records("shifts").create({ id: U.uid("SH"), ...data }, "الورديات");
        UI.toast("تم حفظ الوردية", "success");
        EHR.app.refresh();
        return true;
      },
    });
  };
  const assignShift = (preset = null) => {
    const L = EHR.L;
    const emps = L.inCompany(EHR.db.employees).filter((e) => e.status !== "archived");
    UI.formModal({
      title: "إسناد وردية", subtitle: "يُطبق الإسناد على الموظفين المحددين اعتبارًا من اليوم.", size: "lg",
      fields: [
        { name: "shiftId", label: "الوردية", type: "select", options: L.inCompany(EHR.db.shifts).map((s) => [s.id, `${s.name} (${s.start}–${s.end})`]), required: true },
        { name: "employeeIds", label: "الموظفون", type: "checkgroup", full: true, required: true, options: emps.map((e) => [e.id, `${e.nameAr}`]) },
      ],
      values: { shiftId: preset || (L.inCompany(EHR.db.shifts)[0] || {}).id, employeeIds: [] },
      submitLabel: "إسناد",
      async onSubmit(v) {
        await EHR.api.call(() => {
          v.employeeIds.forEach((id) => {
            const e = L.emp(id);
            e.shiftId = v.shiftId;
            e.timeline.push({ date: U.today(), title: "تغيير الوردية", detail: L.shift(v.shiftId).name, icon: "repeat" });
          });
          EHR.api.audit.log("إسناد وردية", "الورديات", `${L.shift(v.shiftId).name} → ${v.employeeIds.length} موظف`);
        });
        UI.toast(`تم إسناد الوردية إلى ${v.employeeIds.length} موظف`, "success");
        EHR.app.refresh();
        return true;
      },
    });
  };

  EHR.view("shifts", {
    title: "الورديات",
    render(ctx) {
      const L = EHR.L;
      const canManage = auth().can("shifts.manage");
      const shifts = L.inCompany(EHR.db.shifts);
      const emps = L.inCompany(EHR.db.employees).filter((e) => ["active", "probation", "offboarding"].includes(e.status));
      if (ctx.query.tab) shiftTab = ctx.query.tab;
      if (!weekStart) weekStart = U.addDays(U.today(), -U.dayOfWeek(U.today()));
      ctx.el.innerHTML = `
        ${H.pageHead("الورديات", "تعريف الورديات (صباحية، مسائية، ليلية، متناوبة، مرنة) وإسنادها والجدول الأسبوعي", "repeat",
          canManage ? `<button type="button" class="btn btn--ghost" data-sh-assign>${icon("users")}إسناد وردية</button><button type="button" class="btn btn--primary" data-sh-new>${icon("plus")}إضافة وردية</button>` : "")}
        ${UI.tabs("sh", [["list", "الورديات", shifts.length], ["schedule", "الجدول الأسبوعي"]], shiftTab)}
        <div data-sh-body></div>`;
      const body = $("[data-sh-body]", ctx.el);
      if (shiftTab === "list") {
        body.innerHTML = `<div class="cards-grid">${shifts
          .map((s) => {
            const count = emps.filter((e) => e.shiftId === s.id).length;
            const w = E.shiftWindow(s);
            return `<article class="card shift-card">
              <header class="card__head"><h3>${icon(s.type === "night" ? "moon" : s.type === "rotating" ? "repeat" : "sun")}${esc(s.name)}</h3>${UI.badge(SHIFT_TYPES[s.type] || s.type, s.type === "night" ? "brand" : s.type === "rotating" ? "info" : "gray")}</header>
              <div class="shift-card__time"><b class="num">${s.start}</b><span>${icon("arrow-left")}</span><b class="num">${s.end}</b>${w.end > 1440 ? UI.badge("يمتد لليوم التالي", "warning") : ""}</div>
              <div class="info-grid info-grid--3">${UI.info("المدة", U.fmtDuration(w.length - (s.breakMin || 0)))}${UI.info("الاستراحة", `${s.breakMin} د`)}${UI.info("السماح", `${s.grace} د`)}</div>
              <div class="days">${U.WEEKDAYS.map((d, i) => `<span class="${s.days.includes(i) ? "on" : ""}" title="${d}">${d.slice(0, 2)}</span>`).join("")}</div>
              ${s.rotation ? `<p class="small muted">${icon("repeat")} تتناوب أسبوعيًا: ${s.rotation.map((id) => esc(L.shift(id) ? L.shift(id).name : id)).join(" ← ")}</p>` : ""}
              <footer class="card__foot"><span class="muted small">${icon("users")} ${count} موظف · ${esc(L.workplaceName(s.workplaceId))}</span>${canManage ? `<button type="button" class="btn btn--ghost btn--sm" data-sh-edit="${s.id}">${icon("edit")}تعديل</button>` : ""}</footer>
            </article>`;
          })
          .join("")}</div>`;
      } else {
        const days = Array.from({ length: 7 }, (_, i) => U.addDays(weekStart, i));
        const s = L.settings();
        const list = emps.filter((e) => schedDept === "all" || e.departmentId === schedDept);
        body.innerHTML = `
          <div class="toolbar-row">
            <div class="btn-group"><button type="button" class="icon-btn" data-week="-7" aria-label="الأسبوع السابق">${icon("chevron-right")}</button><b>${U.fmtDate(days[0])} – ${U.fmtDate(days[6])}</b><button type="button" class="icon-btn" data-week="7" aria-label="الأسبوع التالي">${icon("chevron-left")}</button><button type="button" class="btn btn--ghost btn--sm" data-week="0">هذا الأسبوع</button></div>
            <select class="input input--sm" data-sched-dept aria-label="الإدارة"><option value="all">كل الإدارات</option>${L.inCompany(EHR.db.departments).map((d) => `<option value="${d.id}" ${d.id === schedDept ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
          </div>
          <div class="card card--flush"><div class="tbl-wrap"><table class="tbl sched">
            <thead><tr><th scope="col">الموظف</th>${days.map((d) => `<th scope="col" class="${d === U.today() ? "is-today" : ""}">${U.weekdayShort(d)}<small class="block">${U.fmtShort(d)}</small></th>`).join("")}</tr></thead>
            <tbody>${list
              .map((e) => `<tr><th scope="row">${UI.person(e.nameAr, esc(L.deptName(e.departmentId)), "xs")}</th>${days
                .map((d) => {
                  const sh = E.shiftFor(EHR.db, e, d);
                  const leave = EHR.db.leaves.some((l) => l.employeeId === e.id && l.status === "approved" && l.from <= d && l.to >= d);
                  if (leave) return '<td><span class="shift-pill tone-info">إجازة</span></td>';
                  if (!E.isWorkday(s, d) || !E.shiftWorksOn(sh, d)) return '<td><span class="shift-pill tone-gray">راحة</span></td>';
                  const base = sh.rotationOf ? L.shift(sh.rotationOf) : sh;
                  return `<td><span class="shift-pill tone-${base.type === "night" ? "brand" : base.type === "evening" ? "warning" : "success"}" title="${esc(sh.name)}">${base.start}–${base.end}</span></td>`;
                })
                .join("")}</tr>`)
              .join("")}</tbody></table></div></div>`;
      }
      ctx.el.onclick = (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="sh"]');
        if (tb) {
          shiftTab = tb.dataset.tab;
          history.replaceState(null, "", "#/shifts");
          ctx.query = {};
          return this.render(ctx);
        }
        if (t.closest("[data-sh-new]")) return openShiftForm();
        if (t.closest("[data-sh-assign]")) return assignShift();
        const ed = t.closest("[data-sh-edit]");
        if (ed) return openShiftForm(L.shift(ed.dataset.shEdit));
        const wk = t.closest("[data-week]");
        if (wk) {
          const n = Number(wk.dataset.week);
          weekStart = n === 0 ? U.addDays(U.today(), -U.dayOfWeek(U.today())) : U.addDays(weekStart, n);
          return this.render(ctx);
        }
      };
      ctx.el.onchange = (e) => {
        if (e.target.matches("[data-sched-dept]")) {
          schedDept = e.target.value;
          this.render(ctx);
        }
      };
    },
  });
})((window.EHR = window.EHR || {}));
