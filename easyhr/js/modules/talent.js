/* =========================================================
   Easy HR — performance (cycles, goals, reviews workflow) and
   training (courses, enrollments, certificates, skills)
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

  /* =========================================================
     Performance
     ========================================================= */
  const STAGES = [["goals", "تحديد الأهداف"], ["in_progress", "التنفيذ والتقييم الذاتي"], ["manager_review", "تقييم المدير"], ["employee_review", "مراجعة الموظف"], ["approved", "الاعتماد النهائي"]];
  const RS = H.S.review;
  const perfCfg = () => {
    const s = EHR.L.settings();
    s.performance = s.performance || { selfWeight: 30, scale: 5 };
    return s.performance;
  };
  const finalScore = (r) => {
    const w = perfCfg().selfWeight / 100;
    if (r.managerScore == null) return null;
    if (r.selfScore == null) return r.managerScore;
    return U.round(r.selfScore * w + r.managerScore * (1 - w), 1);
  };
  const scoreBadge = (v) => {
    if (v == null) return '<span class="muted">—</span>';
    const scale = perfCfg().scale;
    const tone = v >= scale * 0.85 ? "success" : v >= scale * 0.65 ? "brand" : v >= scale * 0.5 ? "warning" : "danger";
    return UI.badge(`${v} / ${scale}`, tone, false);
  };
  const isReviewer = (r) => me() && r.reviewerId === me().id;
  const isOwner = (r) => me() && r.employeeId === me().id;
  const canManagePerf = () => auth().can("performance.manage");
  const goalsProgress = (r) => U.round(U.sum(r.goals, (g) => (g.weight * g.progress) / 100), 0);

  const updateReview = (id, fn, action) => EHR.api.reviews.update(id, (r) => { fn(r); r.updatedAt = U.stamp(); }, "الأداء", action);

  const openReview = (id) => {
    const r = EHR.api.reviews.get(id);
    if (!r) return;
    const cycle = EHR.db.perfCycles.find((c) => c.id === r.cycleId) || {};
    const idx = STAGES.findIndex((s) => s[0] === r.stage);
    const scale = perfCfg().scale;
    const m = UI.modal({
      title: `تقييم أداء — ${esc(L().empName(r.employeeId))}`, subtitle: `${esc(cycle.name || "")} · ${r.id}`, badge: UI.status(RS, r.stage), size: "lg",
      body: `${UI.stepper(STAGES, r.stage === "approved" ? 5 : idx, { compact: true })}
        <div class="info-grid">${UI.info("المقيّم", esc(L().empName(r.reviewerId)))}${UI.info("إنجاز الأهداف (موزون)", `${goalsProgress(r)}%`)}${UI.info("التقييم الذاتي", scoreBadge(r.selfScore))}${UI.info("تقييم المدير", scoreBadge(r.managerScore))}${UI.info("النتيجة النهائية", scoreBadge(r.finalScore))}${UI.info("آخر تحديث", U.ago(r.updatedAt))}</div>
        ${UI.section("الأهداف ومؤشرات الأداء", `<div class="goals">${r.goals.map((g) => `<div class="goal"><div class="goal__top"><b>${esc(g.title)}</b><small>الوزن ${g.weight}%</small></div>${UI.progress(g.progress, g.progress >= 80 ? "success" : g.progress >= 50 ? "brand" : "warning", g.title)}<small class="muted">${g.progress}% منجز</small></div>`).join("")}</div>`, "target")}
        ${r.selfComment ? UI.section("تعليق الموظف", `<p>${esc(r.selfComment)}</p>`, "user") : ""}
        ${r.managerComment ? UI.section("ملاحظات المدير", `<p>${esc(r.managerComment)}</p>`, "user-check") : ""}
        ${r.devPlan ? UI.section("خطة التطوير", `<p>${esc(r.devPlan)}</p>`, "graduation") : ""}
        ${r.ack ? UI.notice(`اطلع الموظف على التقييم ${r.ack.agree ? "ووافق عليه" : "مع تحفظ"}${r.ack.comment ? `: ${esc(r.ack.comment)}` : ""}.`, r.ack.agree ? "success" : "warning", "check") : ""}`,
    });
    const done = () => { m.close(); EHR.app.refresh(); openReview(id); };
    const btns = [];
    if (r.stage === "goals" && (isReviewer(r) || canManagePerf())) {
      btns.push({ label: "تعديل الأهداف", icon: "edit", onClick: () => editGoals(r, done) });
      btns.push({ label: "اعتماد الأهداف", cls: "btn--primary", icon: "check", onClick: async (e, b) => (await UI.run(b, () => {
        const total = U.sum(r.goals, (g) => g.weight);
        if (total !== 100) throw new Error(`مجموع أوزان الأهداف ${total}% — يجب أن يساوي 100%`);
        return updateReview(r.id, (x) => (x.stage = "in_progress"), "اعتماد الأهداف");
      }, "تم اعتماد الأهداف وبدء التنفيذ")) !== undefined && done() });
    }
    if (r.stage === "in_progress" && isOwner(r)) btns.push({ label: "التقييم الذاتي", cls: "btn--primary", icon: "star", onClick: () => selfReview(r, done) });
    if (r.stage === "in_progress" && canManagePerf() && !isOwner(r)) btns.push({ label: "نقل لتقييم المدير", icon: "send", onClick: async (e, b) => (await UI.run(b, () => updateReview(r.id, (x) => (x.stage = "manager_review"), "نقل مرحلة"), "تم النقل")) !== undefined && done() });
    if (r.stage === "manager_review" && (isReviewer(r) || auth().role() === "SUPER_ADMIN")) btns.push({ label: "تقييم المدير", cls: "btn--primary", icon: "star", onClick: () => managerReview(r, done) });
    if (r.stage === "employee_review" && isOwner(r) && !r.ack) btns.push({ label: "تأكيد الاطلاع", cls: "btn--primary", icon: "check", onClick: () => acknowledge(r, done) });
    if (r.stage === "employee_review" && canManagePerf() && !isOwner(r)) btns.push({ label: "اعتماد نهائي", cls: "btn--success", icon: "check-circle", onClick: async (e, b) => (await UI.run(b, () => updateReview(r.id, (x) => {
      x.stage = "approved";
      x.finalScore = finalScore(x);
      const emp = L().emp(x.employeeId);
      if (emp) emp.timeline.push({ date: U.today(), title: "تقييم أداء معتمد", detail: `النتيجة ${x.finalScore} من ${scale}`, icon: "target" });
      EHR.api.notifications.push({ to: { employeeIds: [x.employeeId] }, type: "request", title: "تم اعتماد تقييم أدائك", body: `النتيجة النهائية ${x.finalScore} من ${scale}`, link: "#/performance" });
    }, "اعتماد نهائي"), "تم اعتماد التقييم")) !== undefined && done() });
    btns.push({ label: "طباعة", icon: "print", onClick: () => U.printHTML("تقييم أداء", `<div class="head"><h1>نموذج تقييم أداء</h1><p>${esc(cycle.name || "")}</p></div><div class="grid"><p><b>الموظف:</b> ${esc(L().empName(r.employeeId))}</p><p><b>المقيّم:</b> ${esc(L().empName(r.reviewerId))}</p><p><b>التقييم الذاتي:</b> ${r.selfScore ?? "—"}</p><p><b>تقييم المدير:</b> ${r.managerScore ?? "—"}</p><p><b>النتيجة:</b> ${r.finalScore ?? "—"} / ${scale}</p><p><b>المرحلة:</b> ${RS[r.stage].label}</p></div><table><thead><tr><th>الهدف</th><th>الوزن</th><th>الإنجاز</th></tr></thead><tbody>${r.goals.map((g) => `<tr><td>${esc(g.title)}</td><td>${g.weight}%</td><td>${g.progress}%</td></tr>`).join("")}</tbody></table><p><b>خطة التطوير:</b> ${esc(r.devPlan || "—")}</p><div class="sign"><span>الموظف</span><span>المدير المباشر</span><span>الموارد البشرية</span></div>`) });
    btns.push({ label: "إغلاق", cls: "btn--ghost" });
    m.setFooter(btns);
  };

  const editGoals = (r, done) => {
    const fields = [];
    const vals = {};
    for (let i = 0; i < 5; i++) {
      const g = r.goals[i] || {};
      fields.push({ name: `t${i}`, label: `الهدف ${i + 1}`, required: i === 0 }, { name: `w${i}`, label: "الوزن %", type: "number", min: 0, max: 100 });
      vals[`t${i}`] = g.title || "";
      vals[`w${i}`] = g.weight ?? "";
    }
    fields.push({ type: "note", label: "يجب أن يكون مجموع الأوزان 100%." });
    UI.formModal({
      title: "أهداف ومؤشرات الأداء", fields, values: vals, size: "lg",
      async onSubmit(v) {
        const goals = [];
        for (let i = 0; i < 5; i++) if (v[`t${i}`]) goals.push({ title: v[`t${i}`], weight: Number(v[`w${i}`]) || 0, progress: 0 });
        const total = U.sum(goals, (g) => g.weight);
        if (total !== 100) throw new Error(`مجموع الأوزان ${total}% ويجب أن يساوي 100%`);
        await updateReview(r.id, (x) => (x.goals = goals), "تحديد الأهداف");
        UI.toast("تم حفظ الأهداف", "success");
        done();
        return true;
      },
    });
  };
  const selfReview = (r, done) => {
    const scale = perfCfg().scale;
    const fields = r.goals.map((g, i) => ({ name: `p${i}`, label: `إنجاز: ${g.title} (%)`, type: "number", min: 0, max: 100, required: true }));
    fields.push({ name: "selfScore", label: `التقييم الذاتي (1 – ${scale})`, type: "number", min: 1, max: scale, step: "0.1", required: true }, { name: "selfComment", label: "تعليقك", type: "textarea", full: true, required: true });
    const vals = { selfScore: r.selfScore ?? "", selfComment: r.selfComment || "" };
    r.goals.forEach((g, i) => (vals[`p${i}`] = g.progress));
    UI.formModal({
      title: "التقييم الذاتي", fields, values: vals, submitLabel: "إرسال للمدير", size: "lg",
      async onSubmit(v) {
        await updateReview(r.id, (x) => {
          x.goals.forEach((g, i) => (g.progress = Number(v[`p${i}`])));
          x.selfScore = Number(v.selfScore);
          x.selfComment = v.selfComment;
          x.stage = "manager_review";
        }, "تقييم ذاتي");
        if (r.reviewerId) EHR.api.notifications.push({ to: { employeeIds: [r.reviewerId] }, type: "approval", title: "تقييم أداء بانتظارك", body: L().empName(r.employeeId), link: `#/performance?open=${r.id}` });
        UI.toast("تم إرسال التقييم الذاتي للمدير", "success");
        done();
        return true;
      },
    });
  };
  const managerReview = (r, done) => {
    const scale = perfCfg().scale;
    UI.formModal({
      title: `تقييم المدير — ${L().empName(r.employeeId)}`, size: "lg",
      fields: [
        { name: "managerScore", label: `تقييم المدير (1 – ${scale})`, type: "number", min: 1, max: scale, step: "0.1", required: true },
        { name: "managerComment", label: "نقاط القوة وفرص التحسين", type: "textarea", full: true, required: true },
        { name: "devPlan", label: "خطة التطوير المقترحة", type: "textarea", full: true },
      ],
      values: r,
      submitLabel: "إرسال للموظف",
      async onSubmit(v) {
        await updateReview(r.id, (x) => Object.assign(x, { managerScore: Number(v.managerScore), managerComment: v.managerComment, devPlan: v.devPlan, stage: "employee_review" }), "تقييم المدير");
        EHR.api.notifications.push({ to: { employeeIds: [r.employeeId] }, type: "request", title: "تقييم أدائك جاهز للمراجعة", body: "اطلع على تقييم مديرك وأكّد الاطلاع", link: `#/performance?open=${r.id}` });
        UI.toast("تم إرسال التقييم للموظف", "success");
        done();
        return true;
      },
    });
  };
  const acknowledge = (r, done) =>
    UI.formModal({
      title: "تأكيد الاطلاع على التقييم",
      fields: [{ name: "agree", label: "أوافق على نتيجة التقييم", type: "checkbox", full: true }, { name: "comment", label: "ملاحظات (اختياري)", type: "textarea", full: true }],
      values: { agree: true },
      async onSubmit(v) {
        await updateReview(r.id, (x) => (x.ack = { agree: v.agree, comment: v.comment, at: U.stamp() }), "تأكيد اطلاع");
        UI.toast("تم تأكيد الاطلاع — بانتظار الاعتماد النهائي من الموارد البشرية", "success");
        done();
        return true;
      },
    });

  const openCycleForm = () =>
    UI.formModal({
      title: "دورة تقييم جديدة",
      fields: [
        { name: "name", label: "اسم الدورة", required: true },
        { name: "start", label: "البداية", type: "date", required: true },
        { name: "end", label: "النهاية", type: "date", required: true, validate: (v, a) => (v <= a.start ? "النهاية بعد البداية" : "") },
        { name: "launch", label: "إنشاء نماذج تقييم لجميع الموظفين النشطين الآن", type: "checkbox", full: true },
      ],
      values: { start: U.today(), end: U.addDays(U.today(), 45), launch: true },
      async onSubmit(v) {
        await EHR.api.call(() => {
          const cid = auth().companyId();
          const cyc = { id: U.uid("PC"), companyId: cid, name: v.name, period: v.start.slice(0, 7), start: v.start, end: v.end, status: "active" };
          EHR.db.perfCycles.unshift(cyc);
          if (v.launch) {
            L().inCompany(EHR.db.employees).filter((e) => ["active", "probation"].includes(e.status)).forEach((e) => {
              EHR.db.reviews.push({ id: U.uid("RV"), companyId: cid, cycleId: cyc.id, employeeId: e.id, reviewerId: e.managerId, stage: "goals", goals: [{ title: "هدف رئيسي (يُحدَّد مع المدير)", weight: 100, progress: 0 }], selfScore: null, managerScore: null, finalScore: null, managerComment: "", selfComment: "", devPlan: "", updatedAt: U.stamp() });
            });
          }
          EHR.api.audit.log("إنشاء دورة تقييم", "الأداء", v.name);
        });
        UI.toast("تم إنشاء دورة التقييم", "success");
        EHR.app.refresh();
        return true;
      },
    });

  let perfTab = "reviews";
  let cycleFilter = null;
  EHR.view("performance", {
    title: "الأداء والتقييم",
    render(ctx) {
      const cycles = L().inCompany(EHR.db.perfCycles);
      if (!cycleFilter || !cycles.some((c) => c.id === cycleFilter)) cycleFilter = (cycles.find((c) => c.status === "active") || cycles[0] || {}).id;
      const all = EHR.api.reviews.visible();
      const rows = all.filter((r) => r.cycleId === cycleFilter);
      const tabs = [["reviews", "التقييمات", rows.length]];
      if (canManagePerf()) tabs.push(["cycles", "دورات التقييم", cycles.length]);
      if (ctx.query.tab && tabs.some((t) => t[0] === ctx.query.tab)) perfTab = ctx.query.tab;
      if (!tabs.some((t) => t[0] === perfTab)) perfTab = "reviews";
      const approved = rows.filter((r) => r.finalScore != null);
      const scale = perfCfg().scale;
      const myAction = rows.filter((r) => (r.stage === "manager_review" && isReviewer(r)) || (["in_progress"].includes(r.stage) && isOwner(r)) || (r.stage === "employee_review" && isOwner(r) && !r.ack) || (r.stage === "employee_review" && canManagePerf() && !isOwner(r))).length;
      const bucket = (a, b) => approved.filter((r) => r.finalScore >= a && r.finalScore < b).length;
      ctx.el.innerHTML = `
        ${H.pageHead("الأداء والتقييم", "دورات التقييم والأهداف ومؤشرات الأداء والتقييم الذاتي وتقييم المدير وخطط التطوير", "target",
          canManagePerf() ? `<button type="button" class="btn btn--primary" data-cycle-new>${icon("plus")}دورة تقييم</button>` : "")}
        ${auth().scope("performance") === "team" ? UI.notice("تظهر تقييمات فريقك المباشر وتقييمك الشخصي.", "info", "users") : ""}
        <div class="toolbar-row"><label class="field field--inline"><span>الدورة</span><select class="input input--sm" data-cycle>${cycles.map((c) => `<option value="${c.id}" ${c.id === cycleFilter ? "selected" : ""}>${esc(c.name)}${c.status === "closed" ? " (مغلقة)" : ""}</option>`).join("")}</select></label></div>
        <div class="kpis kpis--sm">
          ${UI.kpi({ label: "نماذج التقييم", value: rows.length, iconName: "target" })}
          ${UI.kpi({ label: "مكتملة", value: `${U.pct(rows.filter((r) => r.stage === "approved").length, rows.length)}%`, iconName: "check-circle", tone: "success" })}
          ${UI.kpi({ label: "متوسط النتيجة", value: approved.length ? U.round(U.sum(approved, (r) => r.finalScore) / approved.length, 1) : "—", unit: approved.length ? ` / ${scale}` : "", iconName: "star", tone: "brand" })}
          ${UI.kpi({ label: "بانتظار إجرائي", value: myAction, iconName: "bell", tone: "warning" })}
        </div>
        ${UI.tabs("perf", tabs, perfTab)}
        <div data-perf-body></div>`;
      const body = $("[data-perf-body]", ctx.el);
      if (perfTab === "reviews") {
        body.innerHTML = `<div class="grid-main"><div class="card card--flush"><div data-rv></div></div>
          <section class="card"><header class="card__head"><h3>${icon("chart")}توزيع النتائج</h3></header>${approved.length ? UI.chart.hbars([
            { label: "متميز", value: bucket(scale * 0.85, scale + 1), color: "var(--success)" },
            { label: "جيد جدًا", value: bucket(scale * 0.65, scale * 0.85), color: "var(--brand)" },
            { label: "مرضٍ", value: bucket(scale * 0.5, scale * 0.65), color: "var(--warning)" },
            { label: "يحتاج تحسين", value: bucket(0, scale * 0.5), color: "var(--danger)" },
          ]) : UI.empty({ icon: "chart", title: "لا توجد نتائج معتمدة بعد" })}
          <p class="muted small mt">النتيجة النهائية = ${perfCfg().selfWeight}% تقييم ذاتي + ${100 - perfCfg().selfWeight}% تقييم المدير (قابل للتعديل من الإعدادات).</p></section></div>`;
        UI.table($("[data-rv]", body), {
          id: "perf-reviews",
          rows: () => EHR.api.reviews.visible().filter((r) => r.cycleId === cycleFilter),
          search: (r) => `${L().empName(r.employeeId)} ${r.id}`,
          searchPlaceholder: "ابحث عن موظف…",
          filters: [{ key: "stage", label: "كل المراحل", options: STAGES.map(([k, l]) => [k, l]), test: (r, v) => r.stage === v }, { key: "dept", label: "كل الإدارات", options: () => L().inCompany(EHR.db.departments).map((d) => [d.id, d.name]), test: (r, v) => (L().emp(r.employeeId) || {}).departmentId === v }],
          rowAttrs: (r) => `data-rv-open="${r.id}" tabindex="0" class="is-click"`,
          defaultSort: { key: "updated", dir: -1 },
          columns: [
            { key: "emp", label: "الموظف", render: (r) => H.emp(r.employeeId), sort: (r) => L().empName(r.employeeId) },
            { key: "goals", label: "الأهداف", render: (r) => `${UI.progress(goalsProgress(r), "brand", "إنجاز الأهداف")}<small class="muted">${goalsProgress(r)}%</small>`, sort: (r) => goalsProgress(r) },
            { key: "self", label: "ذاتي", render: (r) => scoreBadge(r.selfScore) },
            { key: "mgr", label: "المدير", render: (r) => scoreBadge(r.managerScore) },
            { key: "final", label: "النهائي", render: (r) => scoreBadge(r.finalScore), sort: (r) => r.finalScore ?? -1 },
            { key: "stage", label: "المرحلة", render: (r) => UI.status(RS, r.stage), sort: (r) => STAGES.findIndex((s) => s[0] === r.stage) },
            { key: "updated", label: "آخر تحديث", render: (r) => `<small>${U.ago(r.updatedAt)}</small>`, sort: (r) => r.updatedAt },
          ],
          exportName: "performance",
          exportColumns: [["الموظف", (r) => L().empName(r.employeeId)], ["المرحلة", (r) => RS[r.stage].label], ["ذاتي", (r) => r.selfScore ?? ""], ["المدير", (r) => r.managerScore ?? ""], ["النهائي", (r) => r.finalScore ?? ""]],
        });
      } else {
        body.innerHTML = `<div class="cards-grid">${cycles.map((c) => {
          const rv = EHR.db.reviews.filter((r) => r.cycleId === c.id);
          const pct = U.pct(rv.filter((r) => r.stage === "approved").length, rv.length);
          return `<article class="card"><header class="card__head"><h3>${icon("target")}${esc(c.name)}</h3>${c.status === "active" ? UI.badge("نشطة", "success") : UI.badge("مغلقة", "gray")}</header>
            <div class="info-grid info-grid--3">${UI.info("البداية", U.fmtDate(c.start))}${UI.info("النهاية", U.fmtDate(c.end))}${UI.info("النماذج", rv.length)}</div>
            ${UI.progress(pct, "success", "نسبة الاكتمال")}<small class="muted">${pct}% مكتمل</small>
            ${c.status === "active" ? `<footer class="card__foot"><button type="button" class="btn btn--ghost btn--sm" data-cycle-close="${c.id}">${icon("lock")}إغلاق الدورة</button></footer>` : ""}</article>`;
        }).join("")}</div>`;
      }
      const self = this;
      const q = ctx.query;
      if (Object.keys(q).length) {
        history.replaceState(null, "", "#/performance");
        ctx.query = {};
        if (q.open) {
          const r = EHR.api.reviews.get(q.open);
          if (r && auth().canSeeEmployee(r.employeeId, "performance")) openReview(r.id);
        }
      }
      ctx.el.onclick = async (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="perf"]');
        if (tb) { perfTab = tb.dataset.tab; return self.render(ctx); }
        const o = t.closest("[data-rv-open]");
        if (o) return openReview(o.dataset.rvOpen);
        if (t.closest("[data-cycle-new]")) return openCycleForm();
        const cc = t.closest("[data-cycle-close]");
        if (cc) {
          const ok = await UI.confirm({ title: "إغلاق دورة التقييم", text: "لن يمكن تعديل نماذج هذه الدورة بعد الإغلاق.", confirmLabel: "إغلاق", danger: true });
          if (ok) {
            await UI.run(cc, () => EHR.api.records("perfCycles").update(cc.dataset.cycleClose, { status: "closed" }, "الأداء", "إغلاق دورة"), "تم إغلاق الدورة");
            EHR.app.refresh();
          }
        }
      };
      ctx.el.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches("[data-rv-open]")) openReview(e.target.dataset.rvOpen); };
      ctx.el.onchange = (e) => { if (e.target.matches("[data-cycle]")) { cycleFilter = e.target.value; self.render(ctx); } };
    },
  });

  /* =========================================================
     Training
     ========================================================= */
  const CS = H.S.course;
  const ES = H.S.enrollment;
  const canManageTr = () => auth().can("training.manage");
  const courseOf = (en) => EHR.api.courses.get(en.courseId) || {};
  const certState = (en) => {
    if (!en.certExpiry) return en.certificateNo ? "valid" : null;
    const n = U.daysFromToday(en.certExpiry);
    return n < 0 ? "expired" : n <= 30 ? "expiring" : "valid";
  };
  const visibleEnrollments = () => {
    const sc = auth().scope("training");
    return L().inCompany(EHR.db.enrollments).filter((en) => sc === "all" || auth().canSeeEmployee(en.employeeId, "training"));
  };

  const openCourseForm = (c = null) =>
    UI.formModal({
      title: c ? `تعديل الدورة — ${c.name}` : "دورة تدريبية جديدة", size: "lg",
      fields: [
        { name: "name", label: "اسم الدورة", required: true, full: true },
        { name: "provider", label: "الجهة المقدمة", required: true },
        { name: "trainer", label: "المدرب" },
        { name: "type", label: "النوع", type: "select", options: ["حضوري", "عن بُعد", "إلكتروني", "مدمج"] },
        { name: "skill", label: "المهارة المستهدفة", required: true },
        { name: "start", label: "البداية", type: "date", required: true },
        { name: "end", label: "النهاية", type: "date", required: true, validate: (v, a) => (v < a.start ? "النهاية قبل البداية" : "") },
        { name: "hours", label: "عدد الساعات", type: "number", min: 1, max: 500, required: true },
        { name: "seats", label: "المقاعد", type: "number", min: 1, max: 500, required: true },
        { name: "cost", label: "التكلفة الإجمالية (ر.س)", type: "number", min: 0 },
        { name: "certValidityDays", label: "صلاحية الشهادة (يوم) — 0 بدون انتهاء", type: "number", min: 0 },
        { name: "status", label: "الحالة", type: "select", options: Object.entries(CS).map(([k, v]) => [k, v.label]) },
      ],
      values: c || { type: "حضوري", start: U.addDays(U.today(), 14), end: U.addDays(U.today(), 15), hours: 8, seats: 15, cost: 0, certValidityDays: 0, status: "upcoming" },
      async onSubmit(v) {
        const data = { ...v, hours: Number(v.hours), seats: Number(v.seats), cost: Number(v.cost) || 0, certValidityDays: Number(v.certValidityDays) || 0 };
        if (c) await EHR.api.courses.update(c.id, data, "التدريب");
        else await EHR.api.courses.create({ id: U.uid("TR"), ...data }, "التدريب");
        UI.toast("تم حفظ الدورة", "success");
        EHR.app.refresh();
        return true;
      },
    });

  const openCourse = (id) => {
    const c = EHR.api.courses.get(id);
    if (!c) return;
    const ens = visibleEnrollments().filter((e) => e.courseId === c.id);
    const allEns = EHR.db.enrollments.filter((e) => e.courseId === c.id);
    const mine = me() && allEns.find((e) => e.employeeId === me().id);
    const m = UI.modal({
      title: esc(c.name), subtitle: `${esc(c.provider)} · ${esc(c.type)}`, badge: UI.status(CS, c.status), size: "lg",
      body: `<div class="info-grid">${UI.info("الفترة", `${U.fmtDate(c.start)} – ${U.fmtDate(c.end)}`)}${UI.info("الساعات", c.hours)}${UI.info("المدرب", esc(c.trainer || "—"))}${UI.info("المهارة", esc(c.skill))}${UI.info("المقاعد", `${allEns.length} / ${c.seats}`)}${canManageTr() ? UI.info("التكلفة", U.money(c.cost)) : ""}${UI.info("صلاحية الشهادة", c.certValidityDays ? `${c.certValidityDays} يوم` : "بدون انتهاء")}</div>
        ${UI.section("المشاركون", ens.length ? `<div class="tbl-wrap"><table class="tbl tbl--mini tbl--stack"><thead><tr><th>الموظف</th><th>الحضور</th><th>الدرجة</th><th>الشهادة</th><th>الحالة</th>${canManageTr() ? "<th></th>" : ""}</tr></thead><tbody>${ens
          .map((en) => `<tr><td data-label="الموظف">${H.emp(en.employeeId)}</td><td data-label="الحضور">${en.attendance}%</td><td data-label="الدرجة">${en.score ?? "—"}</td><td data-label="الشهادة">${en.certificateNo ? `<span dir="ltr" class="num">${en.certificateNo}</span>` : "—"}</td><td data-label="الحالة">${UI.status(ES, en.status)}</td>${canManageTr() ? `<td class="cell-actions">${en.status !== "completed" ? `<button type="button" class="btn btn--ghost btn--sm" data-en-complete="${en.id}">${icon("check")}إتمام</button>` : ""}</td>` : ""}</tr>`)
          .join("")}</tbody></table></div>` : UI.empty({ icon: "users", title: "لا يوجد مشاركون" }), "users")}`,
    });
    const done = () => { m.close(); EHR.app.refresh(); openCourse(id); };
    const btns = [];
    if (canManageTr()) {
      btns.push({ label: "تسجيل موظفين", icon: "user-plus", onClick: () => enrollForm(c, allEns, done) });
      btns.push({ label: "تعديل", icon: "edit", onClick: () => { m.close(); openCourseForm(c); } });
    }
    if (me() && !mine && c.status === "upcoming" && auth().can("training.self")) {
      btns.push({ label: "التسجيل في الدورة", cls: "btn--primary", icon: "plus", onClick: async (e, b) => (await UI.run(b, () => {
        if (allEns.length >= c.seats) throw new Error("لا توجد مقاعد متاحة");
        return EHR.api.enrollments.create({ id: U.uid("EN"), courseId: c.id, employeeId: me().id, status: "enrolled", attendance: 0, score: null, certificateNo: null, certExpiry: null }, "التدريب");
      }, "تم تسجيلك في الدورة")) !== undefined && done() });
    }
    btns.push({ label: "إغلاق", cls: "btn--ghost" });
    m.setFooter(btns);
    m.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-en-complete]");
      if (b) completeForm(EHR.api.enrollments.get(b.dataset.enComplete), c, done);
    });
  };
  const enrollForm = (c, allEns, done) => {
    const taken = new Set(allEns.map((e) => e.employeeId));
    UI.formModal({
      title: `تسجيل موظفين — ${c.name}`, size: "lg",
      fields: [{ name: "ids", label: `الموظفون (المقاعد المتبقية: ${c.seats - allEns.length})`, type: "checkgroup", full: true, required: true, options: L().inCompany(EHR.db.employees).filter((e) => ["active", "probation"].includes(e.status) && !taken.has(e.id)).map((e) => [e.id, e.nameAr]) }],
      values: { ids: [] },
      async onSubmit(v) {
        if (v.ids.length > c.seats - allEns.length) throw new Error("العدد المختار يتجاوز المقاعد المتاحة");
        await EHR.api.call(() => {
          v.ids.forEach((id) => EHR.db.enrollments.push({ id: U.uid("EN"), companyId: c.companyId, courseId: c.id, employeeId: id, status: "enrolled", attendance: 0, score: null, certificateNo: null, certExpiry: null }));
          EHR.api.notifications.push({ to: { employeeIds: v.ids }, type: "training", title: "تم تسجيلك في دورة تدريبية", body: `${c.name} — ${U.fmtDate(c.start)}`, link: "#/training" });
          EHR.api.audit.log("تسجيل متدربين", "التدريب", `${c.id} (${v.ids.length})`);
        });
        UI.toast(`تم تسجيل ${v.ids.length} موظف`, "success");
        done();
        return true;
      },
    });
  };
  const completeForm = (en, c, done) =>
    UI.formModal({
      title: `إتمام الدورة — ${L().empName(en.employeeId)}`,
      fields: [
        { name: "attendance", label: "نسبة الحضور %", type: "number", min: 0, max: 100, required: true },
        { name: "score", label: "الدرجة", type: "number", min: 0, max: 100, required: true },
        { name: "passed", label: "اجتاز الدورة (تُصدر شهادة)", type: "checkbox", full: true },
      ],
      values: { attendance: 100, score: 85, passed: true },
      async onSubmit(v) {
        await EHR.api.enrollments.update(en.id, (x) => {
          x.attendance = Number(v.attendance);
          x.score = Number(v.score);
          x.status = v.passed ? "completed" : "failed";
          x.certificateNo = v.passed ? `CERT-${Date.now().toString().slice(-6)}` : null;
          x.certExpiry = v.passed && c.certValidityDays ? U.addDays(U.today(), c.certValidityDays) : null;
          const emp = L().emp(x.employeeId);
          if (emp && v.passed) emp.timeline.push({ date: U.today(), title: "إتمام دورة تدريبية", detail: c.name, icon: "graduation" });
        }, "التدريب", "إتمام دورة");
        UI.toast("تم تحديث نتيجة المتدرب", "success");
        done();
        return true;
      },
    });
  const printCert = (en) => {
    const c = courseOf(en);
    U.printHTML("شهادة إتمام", `<div class="head" style="text-align:center"><h1>شهادة إتمام دورة تدريبية</h1><p>${esc(L().company(en.companyId).name)}</p></div><p style="text-align:center;font-size:18px">تشهد الإدارة بأن <b>${esc(L().empName(en.employeeId))}</b> قد أتم بنجاح دورة <b>${esc(c.name)}</b> بعدد ${c.hours} ساعة تدريبية.</p><div class="grid"><p><b>رقم الشهادة:</b> ${en.certificateNo}</p><p><b>تاريخ الإتمام:</b> ${U.fmtDate(c.end)}</p><p><b>صالحة حتى:</b> ${en.certExpiry ? U.fmtDate(en.certExpiry) : "بدون انتهاء"}</p><p><b>الدرجة:</b> ${en.score}</p></div><p class="muted">شهادة تجريبية صادرة من نظام Easy HR.</p><div class="sign"><span>مسؤول التدريب</span><span>مدير الموارد البشرية</span></div>`);
  };

  let trTab = "courses";
  EHR.view("training", {
    title: "التدريب والتطوير",
    render(ctx) {
      const courses = EHR.api.courses.all();
      const ens = visibleEnrollments();
      const sc = auth().scope("training");
      const tabs = [["courses", "الدورات", courses.length], ["enrollments", sc === "self" ? "تدريبي" : "المشاركات", ens.length], ["certs", "الشهادات", ens.filter((e) => e.certificateNo).length]];
      if (sc !== "self") tabs.push(["skills", "مصفوفة المهارات"]);
      if (ctx.query.tab && tabs.some((t) => t[0] === ctx.query.tab)) trTab = ctx.query.tab;
      if (!tabs.some((t) => t[0] === trTab)) trTab = "courses";
      const yr = U.today().slice(0, 4);
      const yearCourses = courses.filter((c) => c.start.startsWith(yr));
      ctx.el.innerHTML = `
        ${H.pageHead("التدريب والتطوير", "الدورات والمشاركين والشهادات وانتهاؤها والمهارات", "graduation", canManageTr() ? `<button type="button" class="btn btn--primary" data-course-new>${icon("plus")}دورة جديدة</button>` : "")}
        <div class="kpis kpis--sm">
          ${UI.kpi({ label: `دورات ${yr}`, value: yearCourses.length, iconName: "graduation" })}
          ${UI.kpi({ label: "ساعات تدريبية منجزة", value: U.num(U.sum(ens.filter((e) => e.status === "completed"), (e) => courseOf(e).hours || 0)), iconName: "clock", tone: "info" })}
          ${canManageTr() ? UI.kpi({ label: `ميزانية ${yr}`, value: U.num(U.sum(yearCourses, (c) => c.cost)), unit: " ر.س", iconName: "wallet", tone: "success" }) : UI.kpi({ label: "دورات قادمة", value: courses.filter((c) => c.status === "upcoming").length, iconName: "calendar", tone: "success" })}
          ${UI.kpi({ label: "شهادات تنتهي قريبًا", value: ens.filter((e) => ["expiring", "expired"].includes(certState(e))).length, iconName: "alert", tone: "warning", attrs: 'data-tr-certs' })}
        </div>
        ${UI.tabs("tr", tabs, trTab)}
        <div data-tr-body></div>`;
      const body = $("[data-tr-body]", ctx.el);
      if (trTab === "courses") {
        body.innerHTML = `<div class="cards-grid">${courses
          .slice()
          .sort((a, b) => (a.start < b.start ? 1 : -1))
          .map((c) => {
            const n = EHR.db.enrollments.filter((e) => e.courseId === c.id).length;
            const mine = me() && EHR.db.enrollments.some((e) => e.courseId === c.id && e.employeeId === me().id);
            return `<button type="button" class="card course-card" data-course="${c.id}"><header class="card__head"><h3>${esc(c.name)}</h3>${UI.status(CS, c.status)}</header>
              <p class="muted small">${esc(c.provider)} · ${esc(c.type)} · ${c.hours} ساعة</p>
              <div class="course-card__meta"><span>${icon("calendar")}${U.fmtShort(c.start)}${c.end !== c.start ? ` – ${U.fmtShort(c.end)}` : ""}</span><span>${icon("users")}${n}/${c.seats}</span><span>${icon("star")}${esc(c.skill)}</span></div>
              ${UI.progress((n / c.seats) * 100, n >= c.seats ? "danger" : "brand", "المقاعد المحجوزة")}${mine ? UI.badge("مسجّل", "success") : ""}</button>`;
          })
          .join("")}</div>`;
      } else if (trTab === "enrollments" || trTab === "certs") {
        body.innerHTML = '<div class="card card--flush"><div data-en></div></div>';
        const certs = trTab === "certs";
        const CERT = { valid: { label: "سارية", tone: "success" }, expiring: { label: "تنتهي قريبًا", tone: "warning" }, expired: { label: "منتهية", tone: "danger" } };
        UI.table($("[data-en]", body), {
          id: certs ? "tr-certs" : "tr-ens",
          rows: () => (certs ? visibleEnrollments().filter((e) => e.certificateNo) : visibleEnrollments()),
          search: sc === "self" ? null : (e) => `${L().empName(e.employeeId)} ${courseOf(e).name}`,
          searchPlaceholder: "ابحث…",
          filters: certs ? [{ key: "cert", label: "كل الحالات", options: Object.entries(CERT).map(([k, v]) => [k, v.label]), test: (e, v) => certState(e) === v }] : [{ key: "status", label: "كل الحالات", options: Object.entries(ES).map(([k, v]) => [k, v.label]), test: (e, v) => e.status === v }],
          rowAttrs: (e) => `data-course="${e.courseId}" tabindex="0" class="is-click"`,
          columns: [
            ...(sc === "self" ? [] : [{ key: "emp", label: "الموظف", render: (e) => H.emp(e.employeeId), sort: (e) => L().empName(e.employeeId) }]),
            { key: "course", label: "الدورة", render: (e) => `<b>${esc(courseOf(e).name)}</b><small class="block muted">${U.fmtDate(courseOf(e).start)}</small>`, sort: (e) => courseOf(e).start },
            ...(certs
              ? [
                  { key: "no", label: "رقم الشهادة", render: (e) => `<span dir="ltr" class="num">${e.certificateNo}</span>` },
                  { key: "exp", label: "الانتهاء", render: (e) => (e.certExpiry ? U.fmtDate(e.certExpiry) : "بدون انتهاء"), sort: (e) => e.certExpiry || "9999" },
                  { key: "st", label: "الحالة", render: (e) => UI.status(CERT, certState(e)) },
                  { key: "print", label: "", cls: "cell-actions", render: (e) => `<button type="button" class="icon-btn icon-btn--sm" data-cert="${e.id}" aria-label="طباعة الشهادة">${icon("print")}</button>` },
                ]
              : [
                  { key: "att", label: "الحضور", render: (e) => `${e.attendance}%`, sort: (e) => e.attendance },
                  { key: "score", label: "الدرجة", render: (e) => e.score ?? "—", sort: (e) => e.score ?? -1 },
                  { key: "status", label: "الحالة", render: (e) => UI.status(ES, e.status) },
                ]),
          ],
          defaultSort: { key: certs ? "exp" : "course", dir: certs ? 1 : -1 },
          exportName: certs ? "certificates" : "enrollments",
          exportColumns: [["الموظف", (e) => L().empName(e.employeeId)], ["الدورة", (e) => courseOf(e).name], ["الحالة", (e) => ES[e.status].label], ["الدرجة", (e) => e.score ?? ""], ["رقم الشهادة", (e) => e.certificateNo || ""], ["انتهاء الشهادة", (e) => e.certExpiry || ""]],
        });
      } else {
        const done = visibleEnrollments().filter((e) => e.status === "completed");
        const skills = U.groupBy(done, (e) => courseOf(e).skill || "—");
        body.innerHTML = `<div class="grid-2"><section class="card"><header class="card__head"><h3>${icon("star")}المهارات المكتسبة</h3></header>${UI.chart.hbars(Object.entries(skills).map(([k, v]) => ({ label: k, value: new Set(v.map((x) => x.employeeId)).size })).sort((a, b) => b.value - a.value), { unit: " موظف" })}</section>
          <section class="card"><header class="card__head"><h3>${icon("users")}حسب الإدارة</h3></header>${UI.chart.hbars(L().inCompany(EHR.db.departments).map((d) => ({ label: d.name, value: done.filter((e) => (L().emp(e.employeeId) || {}).departmentId === d.id).length })), { unit: " دورة" })}</section></div>`;
      }
      if (Object.keys(ctx.query).length) {
        history.replaceState(null, "", "#/training");
        ctx.query = {};
      }
      const self = this;
      ctx.el.onclick = (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="tr"]');
        if (tb) { trTab = tb.dataset.tab; return self.render(ctx); }
        if (t.closest("[data-tr-certs]")) { trTab = "certs"; return self.render(ctx); }
        if (t.closest("[data-course-new]")) return openCourseForm();
        const cert = t.closest("[data-cert]");
        if (cert) return printCert(EHR.api.enrollments.get(cert.dataset.cert));
        const c = t.closest("[data-course]");
        if (c) return openCourse(c.dataset.course);
      };
      ctx.el.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches("tr[data-course]")) openCourse(e.target.dataset.course); };
    },
  });
})((window.EHR = window.EHR || {}));
