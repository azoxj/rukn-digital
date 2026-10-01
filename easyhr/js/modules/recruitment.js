/* =========================================================
   Easy HR — recruitment: job requests (with approval), ATS
   pipeline (kanban), candidate profile, interviews, offers, hiring
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const H = EHR.H;
  const { $, esc, icon } = U;

  const STAGE_TONE = { applied: "gray", screening: "info", interview: "brand", evaluation: "warning", offer: "warning", accepted: "success", hired: "success", rejected: "danger" };
  let tab = "pipeline";
  let jobFilter = "all";

  const svc = () => EHR.api.recruitment;
  const stageLabel = (k) => (svc().STAGES.find((s) => s[0] === k) || [k, k])[1];
  const jobOf = (c) => EHR.api.jobs.get(c.jobId) || {};
  const canManage = () => EHR.auth.can("recruitment.manage");

  /* ---------- Job request form ---------- */
  const openJobForm = (job = null) => {
    const L = EHR.L;
    const db = EHR.db;
    UI.formModal({
      title: job ? `تعديل الوظيفة — ${job.id}` : "طلب وظيفة جديدة",
      subtitle: job ? "" : "يمر الطلب بمسار اعتماد قبل نشر الوظيفة وفق إعدادات سير العمل.",
      size: "lg",
      fields: [
        { name: "title", label: "المسمى الوظيفي", required: true },
        { name: "departmentId", label: "الإدارة", type: "select", options: L.inCompany(db.departments).map((d) => [d.id, d.name]), required: true },
        { name: "branchId", label: "الفرع", type: "select", options: L.inCompany(db.branches).map((b) => [b.id, b.name]), required: true },
        { name: "type", label: "نوع التوظيف", type: "select", options: ["دوام كامل", "دوام جزئي", "عقد مؤقت", "تدريب تعاوني"] },
        { name: "openings", label: "عدد الشواغر", type: "number", min: 1, max: 50, required: true },
        { name: "salaryRange", label: "نطاق الراتب (تقديري)" },
        { name: "description", label: "الوصف الوظيفي", type: "textarea", full: true, required: true },
        { name: "requirements", label: "المتطلبات", type: "textarea", full: true },
      ],
      values: job || { type: "دوام كامل", openings: 1, departmentId: (L.inCompany(db.departments)[0] || {}).id, branchId: (L.inCompany(db.branches)[0] || {}).id },
      submitLabel: job ? "حفظ" : "إرسال للاعتماد",
      async onSubmit(v) {
        const data = { ...v, openings: Number(v.openings) };
        if (job) {
          await EHR.api.jobs.update(job.id, data, "التوظيف");
          UI.toast("تم تحديث الوظيفة", "success");
        } else {
          const me = EHR.auth.me();
          const rec = await EHR.api.submitWithApproval("jobs", "job", { id: U.uid("JOB"), ...data, status: "requested", requestedBy: me ? me.id : null }, "التوظيف");
          UI.toast(rec.status === "open" ? "تم نشر الوظيفة" : "تم إرسال طلب الوظيفة للاعتماد", "success");
        }
        EHR.app.refresh();
        return true;
      },
    });
  };

  /* ---------- Candidate form ---------- */
  const openCandidateForm = (c = null) => {
    const jobs = EHR.api.jobs.all().filter((j) => j.status === "open" || (c && j.id === c.jobId));
    if (!jobs.length) return UI.toast("لا توجد وظائف مفتوحة لإضافة مرشحين", "warning");
    UI.formModal({
      title: c ? `تعديل المرشح — ${c.name}` : "إضافة مرشح",
      size: "lg",
      fields: [
        { name: "name", label: "الاسم الكامل", required: true },
        { name: "jobId", label: "الوظيفة", type: "select", options: jobs.map((j) => [j.id, j.title]), required: true },
        { name: "phone", label: "الجوال", dir: "ltr", required: true, pattern: "^05\\d{8}$", patternMsg: "رقم جوال سعودي من 10 أرقام يبدأ بـ 05" },
        { name: "email", label: "البريد الإلكتروني", type: "email", dir: "ltr", required: true },
        { name: "experience", label: "سنوات الخبرة", type: "number", min: 0, max: 45, required: true },
        { name: "education", label: "المؤهل العلمي", required: true },
        { name: "cv", label: "السيرة الذاتية", type: "file", full: true, accept: ".pdf,.doc,.docx", placeholder: "PDF أو Word — يُحفظ اسم الملف فقط في النسخة التجريبية" },
        { name: "notes", label: "ملاحظات", type: "textarea", full: true },
      ],
      values: c || { jobId: jobFilter !== "all" ? jobFilter : jobs[0].id, experience: 0 },
      submitLabel: c ? "حفظ" : "إضافة المرشح",
      async onSubmit(v) {
        const data = { name: v.name, jobId: v.jobId, phone: v.phone, email: v.email, experience: Number(v.experience), education: v.education, notes: v.notes };
        if (v.cv) data.cvName = v.cv.name;
        if (c) await EHR.api.candidates.update(c.id, data, "التوظيف");
        else await EHR.api.candidates.create({ id: U.uid("CAN"), ...data, cvName: data.cvName || null, stage: "applied", score: null, interviews: [], offer: null, appliedAt: U.stamp() }, "التوظيف");
        UI.toast(c ? "تم حفظ بيانات المرشح" : "تمت إضافة المرشح", "success");
        EHR.app.refresh();
        return true;
      },
    });
  };

  /* ---------- Candidate profile ---------- */
  const openCandidate = (id) => {
    const c = EHR.api.candidates.get(id);
    if (!c) return UI.toast("المرشح غير موجود", "error");
    const job = jobOf(c);
    const stages = svc().STAGES.filter((s) => s[0] !== "rejected");
    const idx = c.stage === "rejected" ? stages.length - 1 : stages.findIndex((s) => s[0] === c.stage);
    const L = EHR.L;
    const interviews = c.interviews.length
      ? `<ul class="list">${c.interviews
          .map((i) => `<li class="list__item"><span class="list__icon">${icon("calendar")}</span><div class="list__body"><b>${U.fmtDate(i.date)} · ${U.fmtTime(i.time)} — ${esc(i.type)}</b>
            <small>المقيّم: ${esc(L.empName(i.interviewer))}${i.score != null ? ` · الدرجة ${i.score}/100` : ""}${i.notes ? ` · ${esc(i.notes)}` : ""}</small></div>
            ${i.status === "done" ? UI.badge("تمت", "success") : `${UI.badge("مجدولة", "brand")}${canManage() ? `<button type="button" class="btn btn--ghost btn--sm" data-int-done="${i.id}">تسجيل النتيجة</button>` : ""}`}</li>`)
          .join("")}</ul>`
      : UI.empty({ icon: "calendar", title: "لا توجد مقابلات", text: "جدول مقابلة لنقل المرشح لمرحلة التقييم." });
    const m = UI.modal({
      title: esc(c.name),
      subtitle: `${esc(c.id)} · ${esc(job.title || "—")}`,
      badge: UI.badge(stageLabel(c.stage), STAGE_TONE[c.stage]),
      size: "lg",
      body: `
        ${c.stage === "rejected" ? UI.notice("تم رفض هذا المرشح.", "danger", "x") : UI.stepper(stages, idx, { compact: true })}
        <div class="info-grid">
          ${UI.info("الجوال", `<span dir="ltr">${esc(c.phone)}</span>`)}${UI.info("البريد", `<span dir="ltr">${esc(c.email)}</span>`)}
          ${UI.info("الخبرة", `${c.experience} سنوات`)}${UI.info("المؤهل", esc(c.education))}
          ${UI.info("تاريخ التقديم", U.fmtDate(c.appliedAt.slice(0, 10)))}${UI.info("درجة التقييم", c.score != null ? `${c.score}/100` : "—")}
          ${UI.info("السيرة الذاتية", c.cvName ? `${icon("file")} ${esc(c.cvName)} <small class="muted">(ملف محاكى)</small>` : "—")}
          ${c.offer ? UI.info("العرض الوظيفي", `${U.money(c.offer.salary)} · يبدأ ${U.fmtDate(c.offer.start)} · ${c.offer.status === "sent" ? "مُرسل" : "مقبول"}`) : ""}
          ${c.employeeId ? UI.info("ملف الموظف", H.empLink(c.employeeId)) : ""}
        </div>
        ${UI.section("المقابلات", interviews, "calendar")}
        ${c.notes ? UI.section("ملاحظات", `<p>${esc(c.notes)}</p>`, "note") : ""}
        ${canManage() && !["hired", "rejected"].includes(c.stage) ? `<label class="field mt"><span>نقل إلى مرحلة</span><select class="input" data-move-stage>${svc().STAGES.filter((s) => !["hired"].includes(s[0])).map((s) => `<option value="${s[0]}" ${s[0] === c.stage ? "selected" : ""}>${esc(s[1])}</option>`).join("")}</select></label>` : ""}`,
    });
    const reopen = () => {
      m.close();
      EHR.app.refresh();
      openCandidate(id);
    };
    const btns = [];
    if (canManage() && !["hired", "rejected"].includes(c.stage)) {
      btns.push({ label: "رفض", cls: "btn--danger-ghost", icon: "x", push: true, onClick: async (e, b) => {
        const ok = await UI.confirm({ title: "رفض المرشح", text: `هل تريد رفض <b>${esc(c.name)}</b>؟`, confirmLabel: "رفض", danger: true });
        if (ok && (await UI.run(b, () => svc().move(c.id, "rejected"), "تم رفض المرشح")) !== undefined) reopen();
      } });
      btns.push({ label: "جدولة مقابلة", icon: "calendar", onClick: () => scheduleInterview(c, reopen) });
      if (["interview", "evaluation"].includes(c.stage) || c.interviews.some((i) => i.status === "done"))
        btns.push({ label: "درجة التقييم", icon: "star", onClick: () => scoreCandidate(c, reopen) });
      if (["evaluation", "offer"].includes(c.stage)) btns.push({ label: c.offer ? "تعديل العرض" : "إرسال عرض", icon: "send", onClick: () => sendOffer(c, reopen) });
      if (c.stage === "offer" && c.offer) btns.push({ label: "قبول العرض", icon: "check", onClick: async (e, b) => (await UI.run(b, () => svc().move(c.id, "accepted"), "تم تسجيل قبول العرض")) !== undefined && reopen() });
      if (c.stage === "accepted") btns.push({ label: "تعيين وإنشاء ملف", cls: "btn--success", icon: "user-plus", onClick: () => hire(c, m) });
      btns.push({ label: "تعديل", icon: "edit", onClick: () => { m.close(); openCandidateForm(c); } });
    }
    btns.push({ label: "إغلاق", cls: "btn--ghost" });
    m.setFooter(btns);
    m.el.addEventListener("change", async (e) => {
      if (!e.target.matches("[data-move-stage]")) return;
      const to = e.target.value;
      if (to === c.stage) return;
      const r = await UI.run(null, () => svc().move(c.id, to), `تم النقل إلى «${stageLabel(to)}»`);
      if (r !== undefined) reopen();
      else e.target.value = c.stage;
    });
    m.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-int-done]");
      if (b) interviewResult(c, b.dataset.intDone, reopen);
    });
  };

  const scheduleInterview = (c, done) => {
    const L = EHR.L;
    UI.formModal({
      title: `جدولة مقابلة — ${c.name}`,
      fields: [
        { name: "date", label: "التاريخ", type: "date", required: true, min: U.today(), validate: (v) => (v < U.today() ? "اختر تاريخًا قادمًا" : "") },
        { name: "time", label: "الوقت", type: "time", required: true },
        { name: "type", label: "نوع المقابلة", type: "select", options: ["حضوري", "عن بُعد", "هاتفية"] },
        { name: "interviewer", label: "المقيّم", type: "select", options: L.inCompany(EHR.db.employees).filter((e) => e.status === "active").map((e) => [e.id, e.nameAr]), required: true },
      ],
      values: { date: U.addDays(U.today(), 2), time: "10:00", type: "حضوري", interviewer: (L.dept(jobOf(c).departmentId) || {}).managerId },
      submitLabel: "جدولة",
      async onSubmit(v) {
        await EHR.api.candidates.update(c.id, (x) => {
          x.interviews.push({ id: U.uid("INT"), ...v, status: "scheduled", score: null, notes: "" });
          if (["applied", "screening"].includes(x.stage)) x.stage = "interview";
        }, "التوظيف", "جدولة مقابلة");
        EHR.api.notifications.push({ to: { employeeIds: [v.interviewer] }, type: "request", title: "مقابلة مجدولة", body: `${c.name} — ${U.fmtDate(v.date)} ${v.time}`, link: `#/recruitment?cand=${c.id}` });
        UI.toast("تمت جدولة المقابلة وإشعار المقيّم", "success");
        done();
        return true;
      },
    });
  };
  const interviewResult = (c, intId, done) =>
    UI.formModal({
      title: "نتيجة المقابلة",
      fields: [
        { name: "score", label: "الدرجة (من 100)", type: "number", min: 0, max: 100, required: true },
        { name: "notes", label: "ملاحظات المقيّم", type: "textarea", full: true, required: true },
      ],
      async onSubmit(v) {
        await EHR.api.candidates.update(c.id, (x) => {
          const i = x.interviews.find((y) => y.id === intId);
          Object.assign(i, { status: "done", score: Number(v.score), notes: v.notes });
          if (x.stage === "interview") x.stage = "evaluation";
        }, "التوظيف", "نتيجة مقابلة");
        UI.toast("تم تسجيل النتيجة ونقل المرشح إلى التقييم", "success");
        done();
        return true;
      },
    });
  const scoreCandidate = (c, done) =>
    UI.formModal({
      title: "درجة التقييم النهائية",
      fields: [{ name: "score", label: "الدرجة (من 100)", type: "number", min: 0, max: 100, required: true }],
      values: { score: c.score ?? "" },
      async onSubmit(v) {
        await EHR.api.candidates.update(c.id, { score: Number(v.score) }, "التوظيف", "تقييم مرشح");
        UI.toast("تم حفظ الدرجة", "success");
        done();
        return true;
      },
    });
  const sendOffer = (c, done) =>
    UI.formModal({
      title: `عرض وظيفي — ${c.name}`,
      fields: [
        { name: "salary", label: "الراتب الأساسي المعروض (ر.س)", type: "number", min: 1000, required: true },
        { name: "start", label: "تاريخ المباشرة", type: "date", required: true, validate: (v) => (v < U.today() ? "اختر تاريخًا قادمًا" : "") },
        { type: "note", label: "لا يتم إرسال بريد فعلي في النسخة التجريبية؛ يُسجَّل العرض داخل النظام فقط." },
      ],
      values: c.offer || { start: U.addDays(U.today(), 21) },
      submitLabel: "تسجيل العرض",
      async onSubmit(v) {
        if (c.score == null) throw new Error("أدخل درجة التقييم قبل إرسال العرض");
        await EHR.api.candidates.update(c.id, (x) => {
          x.offer = { salary: Number(v.salary), start: v.start, status: "sent" };
          x.stage = "offer";
        }, "التوظيف", "عرض وظيفي");
        UI.toast("تم تسجيل العرض الوظيفي", "success");
        done();
        return true;
      },
    });
  const hire = async (c, m) => {
    const ok = await UI.confirm({ title: "تعيين المرشح", text: `سيتم إنشاء ملف موظف لـ <b>${esc(c.name)}</b> بحالة «تحت التجربة»، وقائمة تهيئة، ومسودة عقد. هل تريد المتابعة؟`, confirmLabel: "تعيين" });
    if (!ok) return;
    const r = await UI.run(null, () => svc().hire(c.id), (x) => `تم التعيين برقم ${x.emp.id}`);
    if (r) {
      m.close();
      EHR.go("#/onboarding");
    }
  };

  /* ---------- Job detail ---------- */
  const openJob = (id) => {
    const j = EHR.api.jobs.get(id);
    if (!j) return;
    const L = EHR.L;
    const cands = EHR.api.candidates.all().filter((c) => c.jobId === j.id);
    const m = UI.modal({
      title: esc(j.title), subtitle: `${j.id} · ${esc(L.deptName(j.departmentId))} · ${esc(L.branchName(j.branchId))}`, badge: UI.status(H.S.job, j.status), size: "lg",
      body: `<div class="info-grid">${UI.info("نوع التوظيف", esc(j.type))}${UI.info("الشواغر", j.openings)}${UI.info("نطاق الراتب", esc(j.salaryRange || "—"))}${UI.info("المرشحون", cands.length)}
        ${UI.info("تاريخ الطلب", U.fmtDate(j.createdAt.slice(0, 10)))}${j.requestedBy ? UI.info("مقدم الطلب", esc(L.empName(j.requestedBy))) : ""}</div>
        ${UI.section("الوصف", `<p>${esc(j.description)}</p>`, "file")}${j.requirements ? UI.section("المتطلبات", `<p>${esc(j.requirements)}</p>`, "check") : ""}
        ${j.approval ? UI.section("مسار الاعتماد", UI.approvalTimeline(j.approval), "flow") : ""}`,
    });
    const btns = [];
    const ap = EHR.api.approvals;
    const act = async (dec, b) => {
      const cmt = await UI.prompt({ title: dec === "approve" ? "اعتماد الوظيفة" : "رفض الوظيفة", label: dec === "approve" ? "ملاحظة (اختياري)" : "سبب الرفض", required: dec === "reject", danger: dec === "reject" });
      if (cmt === null) return;
      if ((await UI.run(b, () => ap.act("jobs", j.id, dec, cmt), dec === "approve" ? "تم اعتماد الوظيفة ونشرها" : "تم رفض الطلب")) !== undefined) {
        m.close();
        EHR.app.refresh();
      }
    };
    if (ap.canAct(j)) {
      btns.push({ label: "رفض", cls: "btn--danger-ghost", icon: "x", push: true, onClick: (e, b) => act("reject", b) });
      btns.push({ label: "اعتماد ونشر", cls: "btn--success", icon: "check", onClick: (e, b) => act("approve", b) });
    }
    if (canManage() && ["open", "on_hold"].includes(j.status)) {
      btns.push({ label: j.status === "open" ? "تعليق" : "إعادة فتح", icon: "pause", onClick: async (e, b) => (await UI.run(b, () => EHR.api.jobs.update(j.id, { status: j.status === "open" ? "on_hold" : "open" }, "التوظيف"), "تم التحديث")) !== undefined && (m.close(), EHR.app.refresh()) });
      btns.push({ label: "إغلاق الوظيفة", icon: "lock", onClick: async (e, b) => (await UI.run(b, () => EHR.api.jobs.update(j.id, { status: "closed" }, "التوظيف", "إغلاق"), "تم إغلاق الوظيفة")) !== undefined && (m.close(), EHR.app.refresh()) });
      btns.push({ label: "تعديل", icon: "edit", onClick: () => { m.close(); openJobForm(j); } });
    }
    if (j.status === "open") btns.push({ label: "عرض المرشحين", icon: "users", onClick: () => { m.close(); jobFilter = j.id; tab = "pipeline"; EHR.app.refresh(); } });
    btns.push({ label: "إغلاق", cls: "btn--ghost" });
    m.setFooter(btns);
  };

  /* ---------- Page ---------- */
  const render = (ctx) => {
    const L = EHR.L;
    if (ctx.query.tab) tab = ctx.query.tab;
    const jobs = EHR.api.jobs.all();
    const cands = EHR.api.candidates.all();
    if (jobFilter !== "all" && !jobs.some((j) => j.id === jobFilter)) jobFilter = "all";
    const list = cands.filter((c) => jobFilter === "all" || c.jobId === jobFilter);
    const upcoming = cands.flatMap((c) => c.interviews.filter((i) => i.status === "scheduled").map((i) => ({ ...i, cand: c }))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const year = U.today().slice(0, 4);
    ctx.el.innerHTML = `
      ${H.pageHead("التوظيف", "طلبات الوظائف، مسار المرشحين، المقابلات والعروض حتى التعيين", "briefcase",
        `${canManage() ? `<button type="button" class="btn btn--ghost" data-new-cand>${icon("user-plus")}إضافة مرشح</button>` : ""}${EHR.auth.canAny(["recruitment.manage", "recruitment.approve"]) ? `<button type="button" class="btn btn--primary" data-new-job>${icon("plus")}طلب وظيفة جديدة</button>` : ""}`)}
      <div class="kpis kpis--sm">
        ${UI.kpi({ label: "وظائف مفتوحة", value: jobs.filter((j) => j.status === "open").length, iconName: "briefcase" })}
        ${UI.kpi({ label: "إجمالي المرشحين", value: cands.filter((c) => !["hired", "rejected"].includes(c.stage)).length, iconName: "users", tone: "info", sub: "في المسار حاليًا" })}
        ${UI.kpi({ label: "مقابلات قادمة", value: upcoming.length, iconName: "calendar", tone: "warning" })}
        ${UI.kpi({ label: `تعيينات ${year}`, value: cands.filter((c) => c.stage === "hired").length, iconName: "user-check", tone: "success" })}
      </div>
      ${UI.tabs("rec", [["pipeline", "مسار المرشحين", list.length], ["jobs", "الوظائف", jobs.length], ["interviews", "المقابلات", upcoming.length]], tab)}
      <div data-rec-body></div>`;
    const body = $("[data-rec-body]", ctx.el);

    if (tab === "pipeline") {
      body.innerHTML = `<div class="toolbar-row"><label class="field field--inline"><span>الوظيفة</span><select class="input input--sm" data-job-filter><option value="all">كل الوظائف</option>${jobs
        .filter((j) => j.status !== "rejected")
        .map((j) => `<option value="${j.id}" ${j.id === jobFilter ? "selected" : ""}>${esc(j.title)}</option>`)
        .join("")}</select></label><small class="muted">${canManage() ? "اسحب البطاقة لنقلها بين المراحل، أو افتحها لاستخدام قائمة «نقل إلى مرحلة»." : "عرض فقط."}</small></div><div data-kanban></div>`;
      UI.kanban($("[data-kanban]", body), {
        columns: svc().STAGES.map(([key, label]) => ({ key, label, tone: STAGE_TONE[key] })),
        items: list,
        card: (c) => `<b>${esc(c.name)}</b><small>${esc(jobOf(c).title || "")}</small><div class="kcard__meta"><span>${icon("briefcase")}${c.experience} س</span>${c.score != null ? `<span>${icon("star")}${c.score}</span>` : ""}${c.interviews.some((i) => i.status === "scheduled") ? `<span class="tone-brand">${icon("calendar")}مقابلة</span>` : ""}</div>`,
        onMove: async (id, to) => {
          if (!canManage()) return UI.toast("ليست لديك صلاحية تعديل المسار", "error");
          const c = EHR.api.candidates.get(id);
          if (c.stage === to) return;
          if (to === "hired") {
            if (c.stage !== "accepted") return UI.toast("يجب قبول العرض قبل التعيين", "error");
            return openCandidate(id);
          }
          await UI.run(null, () => svc().move(id, to), `تم نقل ${c.name} إلى «${stageLabel(to)}»`);
          EHR.app.refresh();
        },
      });
    } else if (tab === "jobs") {
      body.innerHTML = '<div class="card card--flush"><div data-jobs></div></div>';
      UI.table($("[data-jobs]", body), {
        id: "rec-jobs", rows: () => EHR.api.jobs.all(), search: (j) => `${j.title} ${j.id} ${L.deptName(j.departmentId)}`, searchPlaceholder: "ابحث عن وظيفة…",
        filters: [{ key: "status", label: "كل الحالات", options: Object.entries(H.S.job).map(([k, v]) => [k, v.label]), test: (j, v) => j.status === v }],
        defaultSort: { key: "created", dir: -1 },
        rowAttrs: (j) => `data-job="${j.id}" tabindex="0" class="is-click"`,
        columns: [
          { key: "title", label: "الوظيفة", render: (j) => `<b>${esc(j.title)}</b><small class="block muted">${j.id}</small>`, sort: (j) => j.title },
          { key: "dept", label: "الإدارة", render: (j) => esc(L.deptName(j.departmentId)) },
          { key: "branch", label: "الفرع", render: (j) => esc(L.branchName(j.branchId)) },
          { key: "openings", label: "الشواغر", render: (j) => `<span class="num">${j.openings}</span>`, sort: (j) => j.openings },
          { key: "cands", label: "المرشحون", render: (j) => `<span class="num">${cands.filter((c) => c.jobId === j.id).length}</span>` },
          { key: "created", label: "تاريخ الطلب", render: (j) => U.fmtDate(j.createdAt.slice(0, 10)), sort: (j) => j.createdAt },
          { key: "status", label: "الحالة", render: (j) => `${UI.status(H.S.job, j.status)}${EHR.api.approvals.canAct(j) ? ` <span class="pill-alert" title="بانتظار موافقتك">${icon("bell")}</span>` : ""}` },
        ],
        exportName: "jobs", exportColumns: [["الرقم", (j) => j.id], ["الوظيفة", (j) => j.title], ["الإدارة", (j) => L.deptName(j.departmentId)], ["الشواغر", (j) => j.openings], ["الحالة", (j) => H.S.job[j.status].label]],
      });
    } else {
      body.innerHTML = upcoming.length
        ? `<div class="card"><ul class="list">${upcoming
            .map((i) => `<li class="list__item" data-cand="${i.cand.id}" tabindex="0" role="button"><span class="date-chip"><b>${Number(i.date.slice(8, 10))}</b><small>${U.fmtMonthShort(i.date.slice(0, 7))}</small></span>
              <div class="list__body"><b>${esc(i.cand.name)} — ${esc(jobOf(i.cand).title || "")}</b><small>${U.weekday(i.date)} · ${U.fmtTime(i.time)} · ${esc(i.type)} · المقيّم: ${esc(L.empName(i.interviewer))}</small></div>${UI.badge(U.relDays(i.date), "brand")}</li>`)
            .join("")}</ul></div>`
        : `<div class="card">${UI.empty({ icon: "calendar", title: "لا توجد مقابلات مجدولة" })}</div>`;
    }

    ctx.el.onclick = (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab-group="rec"]');
      if (tb) {
        tab = tb.dataset.tab;
        history.replaceState(null, "", "#/recruitment");
        ctx.query = {};
        return render(ctx);
      }
      if (t.closest("[data-new-job]")) return openJobForm();
      if (t.closest("[data-new-cand]")) return openCandidateForm();
      const jr = t.closest("[data-job]");
      if (jr) return openJob(jr.dataset.job);
      const k = t.closest("[data-kid]") || t.closest("[data-cand]");
      if (k) return openCandidate(k.dataset.kid || k.dataset.cand);
    };
    ctx.el.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const k = e.target.closest("[data-kid], [data-cand], [data-job]");
      if (!k) return;
      if (k.dataset.job) openJob(k.dataset.job);
      else openCandidate(k.dataset.kid || k.dataset.cand);
    };
    ctx.el.onchange = (e) => {
      if (e.target.matches("[data-job-filter]")) {
        jobFilter = e.target.value;
        render(ctx);
      }
    };
    if (ctx.query.cand || ctx.query.open || ctx.query.new) {
      const { cand, open, new: isNew } = ctx.query;
      history.replaceState(null, "", "#/recruitment");
      ctx.query = {};
      if (cand) openCandidate(cand);
      else if (open) openJob(open);
      else if (isNew && canManage()) openJobForm();
    }
  };

  EHR.view("recruitment", { title: "التوظيف", render });
})((window.EHR = window.EHR || {}));
