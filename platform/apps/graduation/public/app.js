/* =========================================================
   AZENK Graduation — frontend views
   ========================================================= */
(function () {
  "use strict";
  const AZ = window.AZ;
  const { esc, fmt, $, $$ } = AZ;

  const L = {
    role: { ADMIN: "مدير النظام", SUPERVISOR: "مشرف أكاديمي", STUDENT: "طالب" },
    status: { proposal: "مقترح", approved: "معتمد", in_progress: "قيد التنفيذ", submitted: "مُسلَّم", completed: "مكتمل", rejected: "مرفوض" },
    statusTone: { proposal: "info", approved: "gold", in_progress: "gold", submitted: "warn", completed: "ok", rejected: "err" },
    ms: { pending: "لم تُسلَّم", submitted: "بانتظار المراجعة", approved: "معتمدة", needs_changes: "تحتاج تعديلات" },
    msTone: { pending: "", submitted: "warn", approved: "ok", needs_changes: "err" },
    task: { todo: "لم تبدأ", in_progress: "قيد التنفيذ", done: "منجزة" },
    taskTone: { todo: "", in_progress: "info", done: "ok" },
    team: { leader: "قائد الفريق", member: "عضو" },
    fb: { comment: "ملاحظة", approved: "اعتماد", needs_changes: "طلب تعديل" },
  };
  const opts = (map, all) => [...(all ? [["", all]] : []), ...Object.entries(map)];
  const badge = (map, tones, v) => AZ.badge(map[v] || v, tones[v]);
  const head = (title, sub, actions = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
  const late = (day, done) => day && !done && day < AZ.today();
  const size = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB");
  const bindFilters = (root, state, render) => {
    const f = $(".filters", root);
    if (f) {
      let timer;
      const apply = () => { Object.assign(state, AZ.formValues(f), { page: 1 }); render(); };
      f.addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(apply, e.target.type === "search" ? 300 : 0); });
      f.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
    }
    root.addEventListener("click", (e) => { const p = e.target.closest("[data-page]"); if (p && !p.disabled) { state.page = Number(p.dataset.page); render(); } });
  };
  const usersBy = async (role) => (await AZ.get("/api/users" + AZ.qs({ role, active: 1 }))).items;

  /* ================= Dashboard ================= */
  const dashboard = async (main) => {
    const d = await AZ.get("/api/dashboard");
    const isStudent = d.role === "STUDENT";
    const projectsCard = `<section class="card"><div class="card__head"><h2>${isStudent ? "مشروعي" : "المشاريع النشطة"}</h2><a href="#/projects">الكل</a></div>
      ${d.projects.length ? `<ul class="timeline">${d.projects.map((p) => `<li><a href="#/projects/${p.id}"><b>${esc(p.title)}</b></a> ${badge(L.status, L.statusTone, p.status)}
        <div class="row-prog">${AZ.progress(p.progress, "نسبة الإنجاز")}<b>${p.progress}%</b></div>${p.due_date ? `<small>التسليم: ${esc(fmt.date(p.due_date))}</small>` : ""}</li>`).join("")}</ul>`
        : `<div class="empty">${isStudent ? "لم تُضَف إلى فريق مشروع بعد. يضيفك مدير النظام إلى فريقك." : "لا توجد مشاريع نشطة."}</div>`}</section>`;
    main.innerHTML = `${head("لوحة التحكم", isStudent ? "تقدّم مشروعك ومهامك" : d.role === "SUPERVISOR" ? "المشاريع التي تشرف عليها" : "نظرة عامة على مشاريع التخرج")}
      <div class="stats">
        ${isStudent ? "" : AZ.stat("كل المشاريع", fmt.num(d.counts.total), { href: "#/projects" })}
        ${AZ.stat("نشطة", fmt.num(d.counts.active), { href: "#/projects?status=active" })}
        ${AZ.stat("مكتملة", fmt.num(d.counts.completed), { tone: "ok" })}
        ${AZ.stat("بانتظار المراجعة", fmt.num(d.pending_reviews.length), { tone: d.pending_reviews.length ? "warn" : "" })}
        ${AZ.stat("مراحل متأخرة", fmt.num(d.overdue_milestones), { tone: d.overdue_milestones ? "err" : "" })}
        ${d.supervisors ? AZ.stat("بدون مشرف", fmt.num(d.counts.unsupervised), { tone: d.counts.unsupervised ? "warn" : "", href: "#/projects?supervisor_id=none" }) : ""}
      </div>
      <div class="cols cols--2">
        ${projectsCard}
        <section class="card"><h2>${isStudent ? "مراحل قادمة" : "مراحل بانتظار مراجعتك"}</h2>
          ${isStudent
            ? (d.upcoming.length ? `<ul class="timeline">${d.upcoming.map((m) => `<li><b>${esc(m.title)}</b> ${badge(L.ms, L.msTone, m.status)}<small class="${late(m.due_date) ? "badge badge--err" : ""}">${esc(fmt.date(m.due_date))}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد مراحل قادمة بمواعيد.</div>')
            : (d.pending_reviews.length ? `<ul class="timeline">${d.pending_reviews.map((m) => `<li><a href="#/projects/${m.project_id}?tab=milestones"><b>${esc(m.title)}</b></a><small>${esc(m.project_title)} · سُلِّمت ${esc(fmt.rel(m.submitted_at))}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد مراحل بانتظار المراجعة.</div>')}</section>
        <section class="card"><div class="card__head"><h2>مهامي</h2><a href="#/my-tasks">الكل</a></div>
          ${d.my_tasks.length ? `<ul class="timeline">${d.my_tasks.map((t) => `<li><a href="#/projects/${t.project_id}?tab=tasks"><b>${esc(t.title)}</b></a> ${badge(L.task, L.taskTone, t.status)}<small class="${late(t.due_date) ? "badge badge--err" : ""}">${t.due_date ? esc(fmt.date(t.due_date)) : "بدون موعد"}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد مهام مسندة إليك.</div>'}</section>
        <section class="card"><h2>آخر الملاحظات</h2>
          ${d.feedback.length ? `<ul class="timeline">${d.feedback.map((f) => `<li><b>${esc(f.author_name)}</b> ${AZ.badge(L.fb[f.kind], f.kind === "approved" ? "ok" : f.kind === "needs_changes" ? "err" : "")}<small>${esc(f.project_title)} · ${esc(fmt.rel(f.created_at))}</small><p>${esc(f.body)}</p></li>`).join("")}</ul>` : '<div class="empty">لا توجد ملاحظات بعد.</div>'}</section>
      </div>
      ${d.supervisors ? `<section class="card"><h2>عبء المشرفين</h2>${AZ.table([{ label: "المشرف", key: "name" }, { label: "مشاريع نشطة", key: "active_projects", cls: "num" }, { label: "بانتظار المراجعة", key: "pending_reviews", cls: "num" }], d.supervisors, { empty: "لا يوجد مشرفون." })}</section>` : ""}`;
  };

  /* ================= Projects ================= */
  const projectDialog = async () => {
    const [sups, students] = await Promise.all([usersBy("SUPERVISOR"), usersBy("STUDENT")]);
    AZ.modal({
      title: "مشروع تخرج جديد", submit: "إنشاء المشروع", wide: true,
      body: `${AZ.field({ name: "title", label: "عنوان المشروع", required: true, max: 200 })}
        <div class="grid2">${AZ.field({ name: "department", label: "القسم", max: 120 })}${AZ.field({ name: "academic_year", label: "العام الأكاديمي", placeholder: "2026/2027", max: 20 })}
          ${AZ.field({ name: "supervisor_id", label: "المشرف", type: "select", options: [["", "لاحقًا"], ...sups.map((u) => [u.id, u.name])] })}
          ${AZ.field({ name: "start_date", label: "تاريخ البداية", type: "date" })}${AZ.field({ name: "due_date", label: "تاريخ التسليم النهائي", type: "date" })}</div>
        ${AZ.field({ name: "description", label: "وصف المشروع", type: "textarea", rows: 3, max: 5000 })}
        <fieldset class="fld" data-field="members"><legend>أعضاء الفريق (طلاب)</legend>
          ${students.length ? `<div class="check-grid">${students.map((s) => `<label class="chk"><input type="checkbox" name="m_${s.id}"> ${esc(s.name)}</label>`).join("")}</div>` : '<p class="hint">لا يوجد طلاب. أضفهم من صفحة المستخدمين.</p>'}
          <small class="err" hidden></small></fieldset>
        ${students.length ? AZ.field({ name: "leader", label: "قائد الفريق", type: "select", options: [["", "بدون"], ...students.map((s) => [s.id, s.name])] }) : ""}
        ${AZ.field({ name: "default_milestones", label: "إضافة المراحل الافتراضية (مقترح، تحليل، تصميم، تطوير، اختبار، تسليم)", type: "checkbox", value: true })}`,
      onSubmit: async (v) => {
        const members = students.filter((s) => v["m_" + s.id]).map((s) => ({ user_id: s.id, team_role: String(s.id) === v.leader ? "leader" : "member" }));
        if (v.leader && !members.some((m) => String(m.user_id) === v.leader)) members.push({ user_id: Number(v.leader), team_role: "leader" });
        const r = await AZ.post("/api/projects", { title: v.title, department: v.department, academic_year: v.academic_year, supervisor_id: v.supervisor_id ? Number(v.supervisor_id) : null,
          start_date: v.start_date, due_date: v.due_date, description: v.description, members, default_milestones: !!v.default_milestones });
        AZ.toast("تم إنشاء المشروع");
        AZ.go(`#/projects/${r.project.id}`);
      },
    });
  };

  const projects = async (main, _a, params) => {
    const staff = AZ.can("projects.view_all");
    const state = { q: "", status: params.status || "", supervisor_id: params.supervisor_id || "", department: "", year: "", page: 1 };
    const first = await AZ.get("/api/projects" + AZ.qs({ size: 1 }));
    const sups = staff ? await usersBy("SUPERVISOR") : [];
    main.innerHTML = `${head("المشاريع", staff ? "كل مشاريع التخرج" : AZ.state.user.role === "SUPERVISOR" ? "المشاريع التي تشرف عليها" : "مشروعك", AZ.can("projects.manage") ? '<button class="btn btn--primary" data-new>+ مشروع</button>' : "")}
      <form class="filters">${AZ.field({ name: "q", label: "بحث (العنوان أو اسم الطالب)", type: "search" })}
        ${AZ.field({ name: "status", label: "الحالة", type: "select", options: [["", "الكل"], ["active", "النشطة"], ...Object.entries(L.status)], value: state.status })}
        ${staff ? AZ.field({ name: "supervisor_id", label: "المشرف", type: "select", options: [["", "الكل"], ["none", "بدون مشرف"], ...sups.map((u) => [u.id, u.name])], value: state.supervisor_id }) : ""}
        ${first.filters.departments.length ? AZ.field({ name: "department", label: "القسم", type: "select", options: [["", "الكل"], ...first.filters.departments.map((x) => [x, x])] }) : ""}
        ${first.filters.years.length ? AZ.field({ name: "year", label: "العام", type: "select", options: [["", "الكل"], ...first.filters.years.map((x) => [x, x])] }) : ""}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/projects" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "المشروع", html: (p) => `<a href="#/projects/${p.id}">${esc(p.title)}</a>${p.department ? `<br><small class="muted">${esc(p.department)}${p.academic_year ? " · " + esc(p.academic_year) : ""}</small>` : ""}` },
        { label: "الحالة", html: (p) => badge(L.status, L.statusTone, p.status) },
        { label: "المشرف", html: (p) => esc(p.supervisor_name || "—") },
        { label: "الفريق", html: (p) => `${p.members} طالب` },
        { label: "الإنجاز", html: (p) => `<div class="row-prog">${AZ.progress(p.progress)}<b>${p.progress}%</b></div>` },
        { label: "التسليم", html: (p) => `<span class="${late(p.due_date, ["completed", "rejected"].includes(p.status)) ? "badge badge--err" : ""}">${esc(p.due_date ? fmt.date(p.due_date) : "—")}</span>` },
      ], r.items, { empty: "لا توجد مشاريع مطابقة." }) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    const nb = $("[data-new]", main); if (nb) nb.addEventListener("click", () => projectDialog().catch(AZ.fail));
    await render();
  };

  /* ----- project detail with tabs ----- */
  const TABS = [["overview", "نظرة عامة"], ["milestones", "المراحل"], ["tasks", "المهام"], ["files", "الملفات"], ["feedback", "الملاحظات"], ["evaluation", "التقييم"]];

  const projectView = async (main, [id], params) => {
    const d = await AZ.get(`/api/projects/${id}`);
    const p = d.project;
    const staff = d.access === "admin" || d.access === "supervisor";
    const admin = d.access === "admin";
    const member = d.access === "member";
    const tab = TABS.some(([k]) => k === params.tab) ? params.tab : "overview";
    const msName = (mid) => (d.milestones.find((m) => m.id === mid) || {}).title;
    const memberOpts = [["", "غير مسند"], ...d.members.map((m) => [m.user_id, m.name])];

    const overview = `<div class="cols cols--main"><section class="card"><h2>عن المشروع</h2>${p.description ? `<p class="pre">${esc(p.description)}</p>` : '<p class="muted">لا يوجد وصف.</p>'}
        <dl class="dl mt"><dt>القسم</dt><dd>${esc(p.department || "—")}</dd><dt>العام</dt><dd>${esc(p.academic_year || "—")}</dd><dt>البداية</dt><dd>${esc(fmt.date(p.start_date))}</dd>
        <dt>التسليم</dt><dd>${esc(fmt.date(p.due_date))}</dd><dt>المشرف</dt><dd>${esc(d.supervisor ? d.supervisor.name : "لم يُحدد")}</dd></dl>
        ${staff ? `<form class="mt" data-edit novalidate><div class="grid2">${AZ.field({ name: "status", label: "حالة المشروع", type: "select", options: opts(L.status), value: p.status })}
          ${AZ.field({ name: "due_date", label: "تاريخ التسليم", type: "date", value: p.due_date })}
          ${admin ? AZ.field({ name: "supervisor_id", label: "المشرف", type: "select", options: [["", "بدون"], ...(await usersBy("SUPERVISOR")).map((u) => [u.id, u.name])], value: p.supervisor_id || "" }) : ""}</div>
          <p class="form-err" hidden></p><button class="btn btn--primary btn--sm" type="submit">حفظ</button>${admin ? ' <button class="btn btn--ghost btn--sm" type="button" data-del-project>حذف المشروع</button>' : ""}</form>` : ""}</section>
      <section class="card"><h2>الإنجاز</h2><div class="big-prog"><b>${d.progress.percent}%</b>${AZ.progress(d.progress.percent, "إنجاز المراحل")}<small class="muted">${d.progress.milestones.approved} من ${d.progress.milestones.total} مراحل معتمدة (حسب الأوزان)</small></div>
        <div class="big-prog mt">${AZ.progress(d.progress.tasks.percent, "إنجاز المهام")}<small class="muted">المهام: ${d.progress.tasks.done} من ${d.progress.tasks.total} منجزة</small></div>
        <h2 class="mt">الفريق</h2>${d.members.length ? `<ul class="timeline">${d.members.map((m) => `<li><b>${esc(m.name)}</b> ${AZ.badge(L.team[m.team_role], m.team_role === "leader" ? "gold" : "")}<small dir="ltr">${esc(m.email)}</small>${admin ? ` <button class="link" data-rm-member="${m.user_id}">إزالة</button>` : ""}</li>`).join("")}</ul>` : '<p class="muted">لا يوجد أعضاء.</p>'}
        ${admin ? '<button class="btn btn--ghost btn--sm mt" data-add-member>+ إضافة طالب</button>' : ""}</section></div>`;

    const milestones = `<section class="card"><div class="card__head"><h2>مراحل المشروع</h2>${staff ? '<button class="btn btn--ghost btn--sm" data-add-ms>+ مرحلة</button>' : ""}</div>
      ${d.milestones.length ? `<ol class="ms-list">${d.milestones.map((m) => `<li class="ms ms--${m.status}"><div class="ms__head"><b>${esc(m.title)}</b> ${badge(L.ms, L.msTone, m.status)} <small class="muted">الوزن ${m.weight}%</small></div>
          <div class="kv-inline">${m.due_date ? `<span class="${late(m.due_date, m.status === "approved") ? "badge badge--err" : ""}">الموعد: ${esc(fmt.date(m.due_date))}</span>` : "<span>بدون موعد</span>"}<span>الملفات: ${m.files}</span>${m.submitted_at ? `<span>سُلِّمت ${esc(fmt.rel(m.submitted_at))}</span>` : ""}</div>
          ${m.description ? `<p class="pre">${esc(m.description)}</p>` : ""}
          <div class="actions mt-s">${member && ["pending", "needs_changes"].includes(m.status) ? `<button class="btn btn--primary btn--sm" data-submit-ms="${m.id}">تسليم المرحلة</button>` : ""}
            ${staff && m.status === "submitted" ? `<button class="btn btn--primary btn--sm" data-review="${m.id}" data-decision="approved">اعتماد</button><button class="btn btn--ghost btn--sm" data-review="${m.id}" data-decision="needs_changes">طلب تعديل</button>` : ""}
            ${staff && m.status !== "submitted" && m.status !== "approved" ? `<button class="btn btn--ghost btn--sm" data-review="${m.id}" data-decision="approved">اعتماد مباشر</button>` : ""}
            ${staff ? `<button class="btn btn--ghost btn--sm" data-edit-ms="${m.id}">تعديل</button>` : ""}</div></li>`).join("")}</ol>` : '<div class="empty">لا توجد مراحل بعد.</div>'}</section>`;

    const col = (st) => `<div class="kanban__col"><h3>${esc(L.task[st])} <small class="muted">${d.tasks.filter((t) => t.status === st).length}</small></h3>
      ${d.tasks.filter((t) => t.status === st).map((t) => `<article class="kcard"><b>${esc(t.title)}</b>${t.description ? `<p>${esc(t.description.slice(0, 160))}</p>` : ""}
        <div class="kv-inline">${t.assignee_name ? `<span>${esc(t.assignee_name)}</span>` : "<span>غير مسند</span>"}${t.due_date ? `<span class="${late(t.due_date, t.status === "done") ? "badge badge--err" : ""}">${esc(fmt.date(t.due_date))}</span>` : ""}${t.milestone_id ? `<span>${esc(msName(t.milestone_id) || "")}</span>` : ""}</div>
        <div class="actions mt-s"><label class="sr" for="ts-${t.id}">الحالة</label><select id="ts-${t.id}" data-task-status="${t.id}">${Object.entries(L.task).map(([k, l]) => `<option value="${k}"${k === t.status ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
          <button class="btn btn--ghost btn--sm" data-edit-task="${t.id}">تعديل</button>${staff || t.created_by === AZ.state.user.id ? `<button class="btn btn--ghost btn--sm" data-del-task="${t.id}">حذف</button>` : ""}</div></article>`).join("") || '<p class="muted">—</p>'}</div>`;
    const tasks = `<section class="card"><div class="card__head"><h2>مهام الفريق</h2><button class="btn btn--primary btn--sm" data-add-task>+ مهمة</button></div><div class="kanban">${col("todo")}${col("in_progress")}${col("done")}</div></section>`;

    const files = `<section class="card"><div class="card__head"><h2>ملفات المشروع</h2></div>
      <form class="upload" data-upload><div class="grid2"><div class="fld"><label for="up-file">ملف (حتى 15MB)</label><input id="up-file" type="file" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.txt,.md"></div>
        ${AZ.field({ name: "milestone_id", label: "مرتبط بمرحلة", type: "select", options: [["", "بدون"], ...d.milestones.map((m) => [m.id, m.title])] })}</div>
        <p class="hint">المسموح: PDF، Word ‎(docx)، PowerPoint ‎(pptx)، Excel ‎(xlsx)، ZIP، PNG/JPG، TXT/MD. يتم التحقق من نوع الملف ومحتواه على الخادم.</p>
        <p class="form-err" role="alert" hidden></p><button class="btn btn--primary btn--sm" type="submit">رفع الملف</button></form>
      ${AZ.table([{ label: "الملف", html: (f) => `<button class="link" data-dl="${f.id}" data-name="${esc(f.original_name)}">${esc(f.original_name)}</button>` }, { label: "المرحلة", html: (f) => esc(msName(f.milestone_id) || "—") },
        { label: "الحجم", html: (f) => `<span dir="ltr">${size(f.size)}</span>`, cls: "num" }, { label: "رفعه", key: "uploader_name" }, { label: "التاريخ", html: (f) => esc(fmt.dateTime(f.created_at)) },
        { label: "", html: (f) => staff || f.uploader_id === AZ.state.user.id ? `<button class="btn btn--ghost btn--sm" data-del-file="${f.id}">حذف</button>` : "" }], d.files, { empty: "لا توجد ملفات مرفوعة." })}</section>`;

    const feedback = `<section class="card"><h2>ملاحظات المشرف</h2>
      ${staff ? `<form data-feedback novalidate class="mb">${AZ.field({ name: "body", label: "ملاحظة جديدة للفريق", type: "textarea", rows: 3, max: 4000, required: true })}
        ${AZ.field({ name: "milestone_id", label: "مرتبطة بمرحلة", type: "select", options: [["", "عامة"], ...d.milestones.map((m) => [m.id, m.title])] })}<p class="form-err" hidden></p><button class="btn btn--primary btn--sm" type="submit">إرسال</button></form>` : ""}
      ${d.feedback.length ? `<ul class="timeline">${d.feedback.map((f) => `<li><b>${esc(f.author_name)}</b> ${AZ.badge(L.fb[f.kind], f.kind === "approved" ? "ok" : f.kind === "needs_changes" ? "err" : "")}${f.milestone_title ? ` <small class="muted">${esc(f.milestone_title)}</small>` : ""}<small>${esc(fmt.dateTime(f.created_at))}</small><p>${esc(f.body)}</p></li>`).join("")}</ul>` : '<div class="empty">لا توجد ملاحظات بعد.</div>'}</section>`;

    const evaluation = `<div class="cols cols--main"><section class="card"><h2>التقييمات</h2>
      ${d.evaluations.length ? d.evaluations.map((e) => `<article class="eval"><div class="card__head"><b>${esc(e.evaluator_name)}</b>${e.is_final ? AZ.badge("تقييم نهائي", "gold") : AZ.badge("تقييم مرحلي")}<span class="eval__score">${e.total} / ${e.max_total}</span></div>
        ${AZ.table([{ label: "المعيار", key: "name" }, { label: "الدرجة", html: (c) => `${c.score} / ${c.max}`, cls: "num" }], e.criteria)}${e.comments ? `<p class="pre">${esc(e.comments)}</p>` : ""}<small class="muted">${esc(fmt.dateTime(e.created_at))}</small></article>`).join("") : '<div class="empty">لم يُقيَّم المشروع بعد.</div>'}</section>
      ${staff ? `<section class="card"><h2>تقييم جديد</h2><form data-eval novalidate>${d.rubric.map((c, i) => `<div class="eval-row"><input name="cn_${i}" value="${esc(c.name)}" aria-label="اسم المعيار" maxlength="120"><input name="cm_${i}" type="number" min="1" max="100" value="${c.max}" aria-label="الحد الأقصى" dir="ltr"><input name="cs_${i}" type="number" min="0" max="100" aria-label="الدرجة" placeholder="الدرجة" dir="ltr"></div>`).join("")}
        <p class="hint">لكل معيار: الاسم · الدرجة القصوى · الدرجة المستحقة.</p>
        ${AZ.field({ name: "comments", label: "تعليق", type: "textarea", rows: 3, max: 4000 })}${AZ.field({ name: "is_final", label: "تقييم نهائي", type: "checkbox" })}
        <div class="fld" data-field="criteria"><small class="err" hidden></small></div><p class="form-err" hidden></p><button class="btn btn--primary btn--sm" type="submit">حفظ التقييم</button></form></section>` : ""}</div>`;

    const body = { overview, milestones, tasks, files, feedback, evaluation }[tab];
    main.innerHTML = `${head(p.title, `${L.status[p.status]}${p.department ? " · " + p.department : ""}`, "")}
      <nav class="tabs" aria-label="أقسام المشروع">${TABS.map(([k, l]) => `<a href="#/projects/${p.id}?tab=${k}"${k === tab ? ' aria-current="page" class="is-active"' : ""}>${esc(l)}${k === "milestones" ? ` <small>${d.milestones.length}</small>` : k === "tasks" ? ` <small>${d.tasks.length}</small>` : k === "files" ? ` <small>${d.files.length}</small>` : ""}</a>`).join("")}</nav>
      <div class="tabbody">${body}</div>`;
    bindProject(main, d, { staff, admin, member, memberOpts });
  };

  const bindProject = (main, d, { staff, memberOpts }) => {
    const p = d.project;
    const reload = (msg) => { if (msg) AZ.toast(msg); AZ.reload(); };
    const form = (sel, fn) => { const f = $(sel, main); if (f) f.addEventListener("submit", async (e) => { e.preventDefault(); const btn = $("button[type=submit]", f); btn.disabled = true; try { AZ.showErrors(f, null); await fn(AZ.formValues(f), f); } catch (err) { AZ.showErrors(f, err); } finally { btn.disabled = false; } }); };

    form("[data-edit]", async (v) => {
      const body = { status: v.status, due_date: v.due_date || null };
      if ("supervisor_id" in v) body.supervisor_id = v.supervisor_id ? Number(v.supervisor_id) : null;
      await AZ.patch(`/api/projects/${p.id}`, body); reload("تم حفظ المشروع");
    });
    form("[data-feedback]", async (v) => { await AZ.post(`/api/projects/${p.id}/feedback`, { body: v.body, milestone_id: v.milestone_id ? Number(v.milestone_id) : null }); reload("تم إرسال الملاحظة"); });
    form("[data-eval]", async (v) => {
      const criteria = [];
      for (let i = 0; `cn_${i}` in v; i++) {
        if (!v[`cn_${i}`].trim()) continue;
        if (v[`cs_${i}`] === "") throw new AZ.ApiError(422, "بيانات غير صالحة", { criteria: `أدخل الدرجة لمعيار «${v[`cn_${i}`]}»` });
        criteria.push({ name: v[`cn_${i}`].trim(), max: Number(v[`cm_${i}`]), score: Number(v[`cs_${i}`]) });
      }
      await AZ.post(`/api/projects/${p.id}/evaluations`, { criteria, comments: v.comments, is_final: !!v.is_final }); reload("تم حفظ التقييم");
    });
    form("[data-upload]", async (v, f) => {
      const file = $("input[type=file]", f).files[0];
      if (!file) throw new AZ.ApiError(422, "اختر ملفًا أولًا");
      if (file.size > 15 * 1024 * 1024) throw new AZ.ApiError(413, "حجم الملف أكبر من 15MB");
      await AZ.api("PUT", `/api/projects/${p.id}/files` + AZ.qs({ name: file.name, milestone_id: v.milestone_id }), file, { raw: true, type: file.type || "application/octet-stream" });
      reload("تم رفع الملف");
    });

    main.addEventListener("change", async (e) => {
      const s = e.target.closest("[data-task-status]");
      if (s) { try { await AZ.patch(`/api/tasks/${s.dataset.taskStatus}`, { status: s.value }); reload("تم تحديث المهمة"); } catch (err) { AZ.fail(err); } }
    });

    main.addEventListener("click", async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      const ds = t.dataset;
      try {
        if ("delProject" in ds) {
          if (await AZ.confirm("حذف المشروع", `حذف «${p.title}» نهائيًا؟ لا يمكن حذف مشروع لديه ملفات أو تقييمات.`, { submit: "حذف" })) { await AZ.del(`/api/projects/${p.id}`); AZ.toast("تم حذف المشروع"); AZ.go("#/projects"); }
        } else if ("addMember" in ds) {
          const students = (await usersBy("STUDENT")).filter((s) => !d.members.some((m) => m.user_id === s.id));
          AZ.modal({ title: "إضافة طالب للفريق", submit: "إضافة", body: students.length ? `${AZ.field({ name: "user_id", label: "الطالب", type: "select", options: students.map((s) => [s.id, s.name]) })}${AZ.field({ name: "team_role", label: "الدور", type: "select", options: opts(L.team), value: "member" })}` : '<p>لا يوجد طلاب متاحون. أضف طالبًا من صفحة المستخدمين.</p>',
            onSubmit: async (v) => { if (!v.user_id) return; await AZ.post(`/api/projects/${p.id}/members`, { user_id: Number(v.user_id), team_role: v.team_role }); reload("تمت إضافة الطالب"); } });
        } else if (ds.rmMember) {
          if (await AZ.confirm("إزالة عضو", "إزالة الطالب من الفريق؟ ستُلغى إسناد مهامه.", { submit: "إزالة" })) { await AZ.del(`/api/projects/${p.id}/members/${ds.rmMember}`); reload("تمت الإزالة"); }
        } else if ("addMs" in ds || ds.editMs) {
          const m = ds.editMs ? d.milestones.find((x) => String(x.id) === ds.editMs) : null;
          AZ.modal({ title: m ? "تعديل المرحلة" : "مرحلة جديدة", submit: "حفظ", body: `${AZ.field({ name: "title", label: "العنوان", required: true, value: m && m.title, max: 200 })}<div class="grid2">${AZ.field({ name: "due_date", label: "الموعد", type: "date", value: m && m.due_date })}${AZ.field({ name: "weight", label: "الوزن (%)", type: "number", min: 1, value: m ? m.weight : 10 })}</div>${AZ.field({ name: "description", label: "الوصف", type: "textarea", rows: 3, value: m && m.description, max: 3000 })}${m ? '<button type="button" class="btn btn--ghost btn--sm" data-del-ms>حذف المرحلة</button>' : ""}`,
            onOpen: (f, close) => { const del = $("[data-del-ms]", f); if (del) del.addEventListener("click", async () => { try { await AZ.del(`/api/milestones/${m.id}`); close(); reload("تم حذف المرحلة"); } catch (err) { AZ.showErrors(f, err); } }); },
            onSubmit: async (v) => { const body = { title: v.title, due_date: v.due_date || null, weight: Number(v.weight), description: v.description }; if (m) await AZ.patch(`/api/milestones/${m.id}`, body); else await AZ.post(`/api/projects/${p.id}/milestones`, body); reload("تم الحفظ"); } });
        } else if (ds.submitMs) {
          AZ.modal({ title: "تسليم المرحلة", submit: "تسليم", body: `<p class="note">ارفع ملفات المرحلة من تبويب «الملفات» قبل التسليم إن وُجدت.</p>${AZ.field({ name: "note", label: "ملاحظة للمشرف (اختياري)", type: "textarea", rows: 3, max: 2000 })}`,
            onSubmit: async (v) => { await AZ.post(`/api/milestones/${ds.submitMs}/submit`, { note: v.note }); reload("تم تسليم المرحلة للمشرف"); } });
        } else if (ds.review) {
          const approve = ds.decision === "approved";
          AZ.modal({ title: approve ? "اعتماد المرحلة" : "طلب تعديلات", submit: approve ? "اعتماد" : "إرسال الطلب", body: AZ.field({ name: "comment", label: approve ? "تعليق (اختياري)" : "التعديلات المطلوبة", type: "textarea", rows: 4, required: !approve, max: 4000 }),
            onSubmit: async (v) => { await AZ.post(`/api/milestones/${ds.review}/review`, { decision: ds.decision, comment: v.comment }); reload(approve ? "تم اعتماد المرحلة" : "تم إرسال طلب التعديل"); } });
        } else if ("addTask" in ds || ds.editTask) {
          const tk = ds.editTask ? d.tasks.find((x) => String(x.id) === ds.editTask) : null;
          AZ.modal({ title: tk ? "تعديل المهمة" : "مهمة جديدة", submit: "حفظ", body: `${AZ.field({ name: "title", label: "العنوان", required: true, value: tk && tk.title, max: 200 })}<div class="grid2">
              ${AZ.field({ name: "assignee_id", label: "المسؤول", type: "select", options: memberOpts, value: tk ? tk.assignee_id || "" : "" })}${AZ.field({ name: "milestone_id", label: "المرحلة", type: "select", options: [["", "بدون"], ...d.milestones.map((m) => [m.id, m.title])], value: tk ? tk.milestone_id || "" : "" })}
              ${AZ.field({ name: "due_date", label: "الموعد", type: "date", value: tk && tk.due_date })}${AZ.field({ name: "status", label: "الحالة", type: "select", options: opts(L.task), value: tk ? tk.status : "todo" })}</div>
              ${AZ.field({ name: "description", label: "التفاصيل", type: "textarea", rows: 3, value: tk && tk.description, max: 3000 })}`,
            onSubmit: async (v) => { const body = { title: v.title, assignee_id: v.assignee_id ? Number(v.assignee_id) : null, milestone_id: v.milestone_id ? Number(v.milestone_id) : null, due_date: v.due_date || null, status: v.status, description: v.description };
              if (tk) await AZ.patch(`/api/tasks/${tk.id}`, body); else await AZ.post(`/api/projects/${p.id}/tasks`, body); reload("تم حفظ المهمة"); } });
        } else if (ds.delTask) {
          if (await AZ.confirm("حذف المهمة", "حذف هذه المهمة؟", { submit: "حذف" })) { await AZ.del(`/api/tasks/${ds.delTask}`); reload("تم حذف المهمة"); }
        } else if (ds.dl) {
          await AZ.download(`/api/files/${ds.dl}/download`, ds.name);
        } else if (ds.delFile) {
          if (await AZ.confirm("حذف الملف", "حذف هذا الملف نهائيًا؟", { submit: "حذف" })) { await AZ.del(`/api/files/${ds.delFile}`); reload("تم حذف الملف"); }
        }
      } catch (err) { AZ.fail(err); }
    });
    void staff;
  };

  /* ================= My tasks ================= */
  const myTasks = async (main) => {
    const r = await AZ.get("/api/my-tasks");
    main.innerHTML = `${head("مهامي", "المهام المسندة إليك وغير المنجزة")}
      ${AZ.table([{ label: "المهمة", html: (t) => `<a href="#/projects/${t.project_id}?tab=tasks">${esc(t.title)}</a>` }, { label: "المشروع", key: "project_title" },
        { label: "الحالة", html: (t) => badge(L.task, L.taskTone, t.status) }, { label: "الموعد", html: (t) => `<span class="${late(t.due_date) ? "badge badge--err" : ""}">${esc(t.due_date ? fmt.date(t.due_date) : "—")}</span>` },
        { label: "", html: (t) => `<button class="btn btn--ghost btn--sm" data-done="${t.id}">تمت</button>` }], r.items, { empty: "لا توجد مهام مفتوحة مسندة إليك." })}`;
    main.addEventListener("click", async (e) => { const b = e.target.closest("[data-done]"); if (!b) return; try { await AZ.patch(`/api/tasks/${b.dataset.done}`, { status: "done" }); AZ.toast("تم إنجاز المهمة"); AZ.reload(); } catch (err) { AZ.fail(err); } });
  };

  /* ================= Reports ================= */
  const reports = async (main) => {
    const r = await AZ.get("/api/reports/summary");
    const hb = (rows, map) => { const m = Math.max(1, ...rows.map((x) => x.n)); return rows.length ? `<div class="bars-h">${rows.map((x) => `<div><span>${esc(map ? map[x.key] || x.key : x.key)}</span>${AZ.progress((x.n / m) * 100)}<b>${x.n}</b></div>`).join("")}</div>` : '<div class="empty">لا توجد بيانات.</div>'; };
    main.innerHTML = `${head("التقارير", "حالة مشاريع التخرج والإنجاز والتقييم", '<button class="btn btn--ghost" data-csv>تصدير المشاريع CSV</button>')}
      <div class="stats">${AZ.stat("المشاريع", fmt.num(r.total))}${AZ.stat("متوسط إنجاز النشطة", r.avg_progress == null ? "—" : r.avg_progress + "%")}
        ${AZ.stat("متوسط التقييم النهائي", r.avg_final_score_pct == null ? "—" : r.avg_final_score_pct + "%", { sub: `${r.final_evaluations} تقييم نهائي` })}${AZ.stat("مراحل متأخرة", fmt.num(r.overdue_milestones.length), { tone: r.overdue_milestones.length ? "err" : "" })}</div>
      <div class="cols cols--2"><section class="card"><h2>حسب الحالة</h2>${hb(r.by_status, L.status)}</section><section class="card"><h2>حسب القسم</h2>${hb(r.by_department)}</section></div>
      <section class="card"><h2>المراحل المتأخرة</h2>${AZ.table([{ label: "المرحلة", key: "title" }, { label: "المشروع", html: (m) => `<a href="#/projects/${m.project_id}?tab=milestones">${esc(m.project_title)}</a>` }, { label: "المشرف", html: (m) => esc(m.supervisor_name || "—") }, { label: "الموعد", html: (m) => esc(fmt.date(m.due_date)) }], r.overdue_milestones, { empty: "لا توجد مراحل متأخرة." })}</section>
      <section class="card"><h2>كل المشاريع</h2>${AZ.table([{ label: "المشروع", html: (p) => `<a href="#/projects/${p.id}">${esc(p.title)}</a>` }, { label: "الحالة", html: (p) => badge(L.status, L.statusTone, p.status) }, { label: "المشرف", html: (p) => esc(p.supervisor_name || "—") }, { label: "الإنجاز", html: (p) => `<div class="row-prog">${AZ.progress(p.progress)}<b>${p.progress}%</b></div>` }], r.projects)}</section>`;
    $("[data-csv]", main).addEventListener("click", () => AZ.download("/api/reports/export", "projects.csv").catch(AZ.fail));
  };

  /* ================= Users & audit ================= */
  const users = async (main) => {
    const r = await AZ.get("/api/users");
    main.innerHTML = `${head("المستخدمون", "الطلاب والمشرفون ومديرو النظام", '<button class="btn btn--primary" data-new>+ مستخدم</button>')}
      ${AZ.table([{ label: "الاسم", key: "name" }, { label: "البريد", html: (u) => `<span dir="ltr">${esc(u.email)}</span>` }, { label: "الدور", html: (u) => esc(L.role[u.role]) },
        { label: "الحالة", html: (u) => u.is_active ? AZ.badge("نشط", "ok") : AZ.badge("معطّل", "err") }, { label: "آخر دخول", html: (u) => esc(u.last_login_at ? fmt.rel(u.last_login_at) : "لم يدخل بعد") },
        { label: "إجراءات", html: (u) => u.id !== AZ.state.user.id ? `<div class="actions"><button class="btn btn--ghost btn--sm" data-edit="${u.id}">تعديل</button><button class="btn btn--ghost btn--sm" data-reset="${u.id}">كلمة مرور مؤقتة</button></div>` : "—" }], r.items)}`;
    const roleOpts = r.manageable_roles.map((x) => [x, L.role[x]]);
    $("[data-new]", main).addEventListener("click", () => AZ.modal({
      title: "مستخدم جديد", submit: "إنشاء", body: `${AZ.field({ name: "name", label: "الاسم", required: true })}${AZ.field({ name: "email", label: "البريد الإلكتروني", type: "email", required: true, dir: "ltr" })}${AZ.field({ name: "phone", label: "الجوال", type: "tel", dir: "ltr" })}${AZ.field({ name: "role", label: "الدور", type: "select", options: roleOpts, value: "STUDENT" })}`,
      onSubmit: async (v) => { const x = await AZ.post("/api/users", v); AZ.reload(); AZ.showSecret("تم إنشاء المستخدم", `كلمة المرور المؤقتة لـ ${x.user.email}:`, x.temporary_password); },
    }));
    main.addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]"), rs = e.target.closest("[data-reset]");
      if (ed) {
        const u = r.items.find((x) => String(x.id) === ed.dataset.edit);
        AZ.modal({ title: "تعديل المستخدم", submit: "حفظ", body: `${AZ.field({ name: "name", label: "الاسم", required: true, value: u.name })}${AZ.field({ name: "phone", label: "الجوال", type: "tel", dir: "ltr", value: u.phone })}${AZ.field({ name: "role", label: "الدور", type: "select", options: roleOpts, value: u.role })}${AZ.field({ name: "is_active", label: "الحساب نشط", type: "checkbox", value: u.is_active })}`,
          onSubmit: async (v) => { await AZ.patch(`/api/users/${u.id}`, v); AZ.toast("تم الحفظ"); AZ.reload(); } });
      }
      if (rs) {
        const u = r.items.find((x) => String(x.id) === rs.dataset.reset);
        if (!(await AZ.confirm("كلمة مرور مؤقتة", `إنشاء كلمة مرور مؤقتة جديدة لـ ${u.name}؟ سيتم تسجيل خروجه من كل الأجهزة.`, { submit: "إنشاء", danger: false }))) return;
        try { const x = await AZ.post(`/api/users/${u.id}/reset-password`); AZ.showSecret("كلمة مرور مؤقتة", `كلمة المرور المؤقتة الجديدة لـ ${u.email}:`, x.temporary_password); } catch (err) { AZ.fail(err); }
      }
    });
  };

  const auditView = async (main) => {
    const state = { action: "", entity: "", page: 1 };
    main.innerHTML = `${head("سجل التدقيق", "كل العمليات الحساسة مسجلة ولا يمكن تعديلها أو حذفها")}
      <form class="filters">${AZ.field({ name: "action", label: "الإجراء", type: "search", placeholder: "مثال: milestone أو file" })}
        ${AZ.field({ name: "entity", label: "الكيان", type: "select", options: [["", "الكل"], ["user", "مستخدم"], ["project", "مشروع"], ["milestone", "مرحلة"], ["task", "مهمة"], ["file", "ملف"], ["report", "تقرير"]] })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/audit" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([{ label: "الوقت", html: (a) => esc(fmt.dateTime(a.created_at)) }, { label: "المستخدم", html: (a) => esc(a.user_name || "—") },
        { label: "الإجراء", html: (a) => `<code dir="ltr">${esc(a.action)}</code>` }, { label: "الكيان", html: (a) => esc(a.entity ? `${a.entity} #${a.entity_id}` : "—") },
        { label: "تفاصيل", html: (a) => `<small class="muted" dir="ltr">${esc((a.meta || "").slice(0, 160))}</small>` }], r.items) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    await render();
  };

  const search = async (q) => {
    const r = await AZ.get("/api/search" + AZ.qs({ q }));
    if (!r.projects.length && !r.users.length) return '<p class="pad muted">لا توجد نتائج.</p>';
    return `${r.projects.length ? `<p class="search-group">المشاريع</p><ul class="search-list">${r.projects.map((p) => `<li><a href="#/projects/${p.id}"><b>${esc(p.title)}</b><small>${esc(L.status[p.status])}${p.department ? " · " + esc(p.department) : ""}</small></a></li>`).join("")}</ul>` : ""}
      ${r.users.length ? `<p class="search-group">المستخدمون</p><ul class="search-list">${r.users.map((u) => `<li><a href="#/users"><b>${esc(u.name)}</b><small>${esc(L.role[u.role])} · <span dir="ltr">${esc(u.email)}</span></small></a></li>`).join("")}</ul>` : ""}`;
  };

  AZ.start({
    app: "graduation",
    title: "AZENK Graduation",
    tagline: "إدارة مشاريع التخرج",
    home: "dashboard",
    roleLabels: L.role,
    search,
    searchPlaceholder: "ابحث عن مشروع…",
    nav: [
      { route: "dashboard", label: "لوحة التحكم", icon: "◧", perm: "dashboard.view" },
      { route: "projects", label: "المشاريع", icon: "▤", perm: ["projects.view_all", "projects.view_supervised", "projects.view_own"] },
      { route: "my-tasks", label: "مهامي", icon: "✓", perm: "tasks.manage" },
      { route: "reports", label: "التقارير", icon: "▦", perm: "reports.view" },
      { route: "users", label: "المستخدمون", icon: "⚇", perm: "users.manage" },
      { route: "audit", label: "سجل التدقيق", icon: "⎙", perm: "audit.view" },
    ],
    routes: { dashboard, projects, "projects/:id": projectView, "my-tasks": myTasks, reports, users, audit: auditView },
  });
})();
