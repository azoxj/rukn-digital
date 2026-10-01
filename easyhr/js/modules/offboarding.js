/* =========================================================
   Easy HR — end of service: request & approval, notice,
   handover, asset return, multi-department clearance, final
   settlement (configurable components), exit interview, archive
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
  const svc = () => EHR.api.offboarding;
  const STAGE_IDX = (st) => svc().STAGES.findIndex((s) => s[0] === st);
  const canManage = () => auth().can("offboarding.manage");
  const canSeeMoney = () => auth().canAny(["offboarding.manage", "payroll.view"]);
  const CL = { approved: { label: "معتمد", tone: "success" }, pending: { label: "بانتظار", tone: "warning" }, rejected: { label: "مرفوض", tone: "danger" } };

  const rows = () => {
    const all = L().inCompany(EHR.db.offboarding);
    if (auth().scope("offboarding") === "all") return all;
    // Clearance approvers (finance, IT, managers) see the cases that need them
    if (auth().can("clearance.approve")) {
      const team = new Set(auth().team());
      return all.filter((o) => o.stage !== "archived" && (auth().role() !== "MANAGER" || team.has(o.employeeId)));
    }
    return all.filter((o) => me() && o.employeeId === me().id);
  };
  const clearanceProgress = (o) => {
    const deps = EHR.db.settings[o.companyId].clearanceDepartments;
    return U.pct(deps.filter((d) => o.clearance[d.key] && o.clearance[d.key].status === "approved").length, deps.length);
  };
  const canClearDept = (o, dept) => {
    if (!svc().canClear(dept)) return false;
    if (dept.role === "MANAGER" && auth().role() === "MANAGER") return L().emp(o.employeeId).managerId === (me() || {}).id;
    return true;
  };

  /* ---------- New case ---------- */
  const openNew = (empId = "") => {
    const emps = L().inCompany(EHR.db.employees).filter((e) => ["active", "probation", "suspended"].includes(e.status) && !EHR.db.offboarding.some((o) => o.employeeId === e.id && !["archived", "rejected"].includes(o.stage)));
    UI.formModal({
      title: "بدء إجراءات نهاية الخدمة", subtitle: "يمر الطلب بمسار اعتماد، ثم مراحل الإشعار والتسليم والعهد وإخلاء الطرف والتسوية ومقابلة الخروج.", size: "lg",
      fields: [
        { name: "employeeId", label: "الموظف", type: "select", required: true, options: emps.map((e) => [e.id, `${e.nameAr} — ${e.id}`]) },
        { name: "reason", label: "السبب", type: "select", required: true, options: Object.entries(svc().REASONS) },
        { name: "requestDate", label: "تاريخ الطلب", type: "date", required: true },
        { name: "noticeDays", label: "فترة الإشعار (يوم)", type: "number", min: 0, max: 180, required: true, hint: "حسب العقد وسياسة المنشأة" },
        { name: "lastDay", label: "آخر يوم عمل", type: "date", required: true, validate: (v, a) => (v < a.requestDate ? "آخر يوم عمل قبل تاريخ الطلب" : "") },
        { name: "notes", label: "ملاحظات", type: "textarea", full: true },
        { type: "note", label: "لا يحتسب النظام مكافأة نهاية الخدمة تلقائيًا؛ تُدخل قيمتها يدويًا وفق السياسة والأنظمة المعتمدة لدى المنشأة.", tone: "warning" },
      ],
      values: { employeeId: empId, reason: "resignation", requestDate: U.today(), noticeDays: 30, lastDay: U.addDays(U.today(), 30) },
      onMount(form) {
        const upd = () => {
          const d = $('[name="requestDate"]', form).value;
          const n = Number($('[name="noticeDays"]', form).value) || 0;
          if (d) $('[name="lastDay"]', form).value = U.addDays(d, n);
        };
        $('[name="noticeDays"]', form).addEventListener("input", upd);
        $('[name="requestDate"]', form).addEventListener("change", upd);
      },
      submitLabel: "بدء الإجراءات",
      async onSubmit(v) {
        const deps = L().settings().clearanceDepartments;
        const rec = await EHR.api.submitWithApproval("offboarding", "offboarding", {
          id: U.uid("EOS"), employeeId: v.employeeId, reason: v.reason, requestDate: v.requestDate, noticeDays: Number(v.noticeDays), lastDay: v.lastDay, notes: v.notes,
          stage: "request", status: "active",
          handover: { status: "pending", to: null, notes: "" },
          clearance: Object.fromEntries(deps.map((d) => [d.key, { status: "pending", by: null, at: null, comment: "" }])),
          settlement: { eos: null, assets: 0, notes: "" }, exitInterview: null, archivedAt: null,
        }, "نهاية الخدمة");
        await EHR.api.employees.update(v.employeeId, (e) => {
          e.status = "offboarding";
          e.timeline.push({ date: U.today(), title: "بدء إجراءات نهاية الخدمة", detail: svc().REASONS[v.reason], icon: "door" });
        }, "الموظفون", "بدء نهاية الخدمة");
        UI.toast(rec.stage === "notice" ? "تم اعتماد الطلب مباشرة وبدأت فترة الإشعار" : "تم إنشاء الملف وإرساله للاعتماد", "success");
        EHR.app.refresh();
        openCase(rec.id);
        return true;
      },
    });
  };

  /* ---------- Case detail ---------- */
  const openCase = (id) => {
    const o = EHR.db.offboarding.find((x) => x.id === id);
    if (!o) return;
    const emp = L().emp(o.employeeId);
    const s = EHR.db.settings[o.companyId];
    const idx = STAGE_IDX(o.stage);
    const assets = svc().pendingAssets(o);
    const st = svc().settlement(o);
    const clearOk = svc().clearanceComplete(o);
    const deps = s.clearanceDepartments;
    const apOpen = EHR.api.approvals.isOpen(o);
    const m = UI.modal({
      title: `نهاية خدمة — ${esc(emp.nameAr)}`, subtitle: `${o.id} · ${esc(svc().REASONS[o.reason])} · آخر يوم ${U.fmtDate(o.lastDay)}`,
      badge: o.stage === "rejected" ? UI.badge("مرفوض", "danger") : UI.badge(svc().STAGES[idx] ? svc().STAGES[idx][1] : o.stage, o.stage === "archived" ? "gray" : "warning"),
      size: "xl",
      body: `
        ${o.stage === "rejected" ? UI.notice("تم رفض طلب نهاية الخدمة.", "danger", "x") : UI.stepper(svc().STAGES, o.stage === "archived" ? svc().STAGES.length : idx, { compact: true })}
        <div class="info-grid">${UI.info("الموظف", H.empLink(o.employeeId))}${UI.info("الإدارة", esc(L().deptName(emp.departmentId)))}${UI.info("تاريخ الطلب", U.fmtDate(o.requestDate))}${UI.info("فترة الإشعار", `${o.noticeDays} يوم`)}${UI.info("آخر يوم عمل", `${U.fmtDate(o.lastDay)} <small class="muted">(${U.relDays(o.lastDay)})</small>`)}${UI.info("تاريخ التعيين", U.fmtDate(emp.joinDate))}</div>
        ${o.approval ? UI.section("اعتماد الطلب", UI.approvalTimeline(o.approval), "flow") : ""}
        ${UI.section("التسليم والاستلام", `<div class="info-grid">${UI.info("الحالة", o.handover.status === "completed" ? UI.badge("مكتمل", "success") : o.handover.status === "in_progress" ? UI.badge("جارٍ", "info") : UI.badge("لم يبدأ", "gray"))}${UI.info("المستلم", o.handover.to ? esc(L().empName(o.handover.to)) : "—")}${UI.info("ملاحظات", esc(o.handover.notes || "—"))}</div>`, "swap", canManage() && !["archived", "rejected"].includes(o.stage) ? `<button type="button" class="btn btn--ghost btn--sm" data-eos-handover>${icon("edit")}تحديث</button>` : "")}
        ${UI.section(`العهد (${assets.length} غير مسلّمة)`, assets.length ? `<ul class="list list--compact">${assets.map((a) => `<li class="list__item"><span class="list__icon">${icon("laptop")}</span><div class="list__body"><b>${esc(a.name)}</b><small>${a.id} · ${esc(a.serial)}</small></div>${auth().can("assets.manage") ? `<button type="button" class="btn btn--ghost btn--sm" data-go="#/assets?open=${a.id}">استلام</button>` : UI.badge("لم تُسلّم", "warning")}</li>`).join("")}</ul>` : UI.notice("تم استلام جميع العهد.", "success", "check"), "laptop")}
        ${UI.section(`إخلاء الطرف (${clearanceProgress(o)}%)`, `<div class="tbl-wrap"><table class="tbl tbl--mini tbl--stack"><thead><tr><th>الجهة</th><th>الحالة</th><th>بواسطة</th><th>ملاحظة</th><th></th></tr></thead><tbody>${deps
          .map((d) => {
            const c = o.clearance[d.key] || { status: "pending" };
            const can = canClearDept(o, d) && c.status !== "approved" && ["clearance", "assets", "handover", "notice"].includes(o.stage);
            return `<tr><td data-label="الجهة"><b>${esc(d.label)}</b></td><td data-label="الحالة">${UI.status(CL, c.status)}</td><td data-label="بواسطة">${c.by ? esc(c.byName || L().empName(c.by)) : "—"}${c.at ? `<small class="block muted">${U.fmtStamp(c.at)}</small>` : ""}</td><td data-label="ملاحظة">${esc(c.comment || "—")}</td>
              <td class="cell-actions">${can ? `<button type="button" class="btn btn--success btn--sm" data-clear="${d.key}" data-dec="approved">${icon("check")}اعتماد</button><button type="button" class="btn btn--danger-ghost btn--sm" data-clear="${d.key}" data-dec="rejected">${icon("x")}ملاحظة/رفض</button>` : ""}</td></tr>`;
          })
          .join("")}</tbody></table></div>`, "check-circle")}
        ${canSeeMoney() ? UI.section("التسوية النهائية", `<div class="tbl-wrap"><table class="tbl tbl--mini"><thead><tr><th>البند</th><th>النوع</th><th>الطريقة</th><th>المبلغ</th></tr></thead><tbody>${st.items
          .map((i) => `<tr><td>${esc(i.label)}${i.hint ? `<small class="block muted">${esc(i.hint)}</small>` : ""}${i.key === "leave" ? `<small class="block muted">${st.leaveDays} يوم رصيد</small>` : ""}</td><td>${i.type === "earning" ? UI.badge("مستحق", "success", false) : UI.badge("استقطاع", "danger", false)}</td><td>${i.mode === "auto" ? "تلقائي" : "يدوي"}</td><td class="num">${i.mode === "manual" && !i.amount ? '<span class="muted">لم يُدخل</span>' : U.money(i.amount)}</td></tr>`)
          .join("")}<tr class="total"><td colspan="3">الصافي (المستحقات − الاستقطاعات)</td><td class="num">${U.money(st.net)}</td></tr></tbody></table></div>
          ${UI.notice("البنود التلقائية محسوبة من الراتب ورصيد الإجازات والسلف القائمة. مكافأة نهاية الخدمة تُدخل يدويًا بعد احتسابها وفق السياسة المعتمدة — لا يحتسبها النظام تلقائيًا.", "info", "info")}`, "wallet", canManage() && !["archived", "rejected"].includes(o.stage) ? `<button type="button" class="btn btn--ghost btn--sm" data-eos-settle>${icon("edit")}البنود اليدوية</button>` : "") : ""}
        ${UI.section("مقابلة الخروج", o.exitInterview ? `<dl class="qa">${s.exitQuestions.map((q) => `<dt>${esc(q.label)}</dt><dd>${esc(o.exitInterview[q.key] || "—")}</dd>`).join("")}</dl>` : '<p class="muted">لم تُجرَ بعد.</p>', "chat", canManage() && !["archived", "rejected"].includes(o.stage) ? `<button type="button" class="btn btn--ghost btn--sm" data-eos-exit>${icon("edit")}${o.exitInterview ? "تعديل" : "تسجيل"}</button>` : "")}`,
    });
    const reopen = () => { m.close(); EHR.app.refresh(); openCase(id); };
    const btns = [];
    if (apOpen && EHR.api.approvals.canAct(o)) {
      btns.push({ label: "رفض", cls: "btn--danger-ghost", icon: "x", push: true, onClick: async () => { const c = await UI.prompt({ title: "رفض الطلب", label: "السبب", required: true, danger: true }); if (c !== null && (await UI.run(null, () => EHR.api.approvals.act("offboarding", o.id, "reject", c), "تم رفض الطلب")) !== undefined) { await EHR.api.employees.update(o.employeeId, { status: "active" }, "الموظفون", "إلغاء نهاية الخدمة"); reopen(); } } });
      btns.push({ label: "اعتماد", cls: "btn--success", icon: "check", onClick: async () => { const c = await UI.prompt({ title: "اعتماد الطلب", label: "ملاحظة (اختياري)" }); if (c !== null && (await UI.run(null, () => EHR.api.approvals.act("offboarding", o.id, "approve", c), "تم الاعتماد")) !== undefined) reopen(); } });
    }
    const nextStage = svc().STAGES[idx + 1];
    if (canManage() && !apOpen && nextStage && !["archived", "rejected", "request"].includes(o.stage)) {
      const guard = () => {
        if (o.stage === "handover" && o.handover.status !== "completed") return "أكمل التسليم أولًا";
        if (o.stage === "assets" && assets.length) return "توجد عهد لم تُسلّم بعد";
        if (o.stage === "clearance" && !clearOk) return "لم تعتمد جميع الجهات إخلاء الطرف";
        if (o.stage === "exit" && !o.exitInterview) return "سجّل مقابلة الخروج أو تجاوزها بملاحظة";
        return null;
      };
      btns.push({
        label: nextStage[0] === "archived" ? "إنهاء وأرشفة الملف" : `الانتقال إلى: ${nextStage[1]}`, cls: nextStage[0] === "archived" ? "btn--danger" : "btn--primary", icon: nextStage[0] === "archived" ? "archive" : "arrow-left",
        onClick: async (e, b) => {
          const g = guard();
          if (g) return UI.toast(g, "error", "لا يمكن الانتقال");
          if (nextStage[0] === "archived") {
            const ok = await UI.confirm({ title: "أرشفة ملف الموظف", text: `سيتم إنهاء خدمة <b>${esc(emp.nameAr)}</b> وأرشفة ملفه. لا يمكن التراجع من هذه الواجهة.`, confirmLabel: "أرشفة", danger: true });
            if (!ok) return;
          }
          if ((await UI.run(b, () => svc().setStage(o.id, nextStage[0]), "تم تحديث المرحلة")) !== undefined) reopen();
        },
      });
    }
    btns.push({ label: "طباعة المخالصة", icon: "print", onClick: () => U.printHTML("مخالصة نهائية", `<div class="head"><h1>نموذج إخلاء طرف ومخالصة</h1><p>${esc(L().company(o.companyId).name)} — ${o.id}</p></div><div class="grid"><p><b>الموظف:</b> ${esc(emp.nameAr)} (${emp.id})</p><p><b>السبب:</b> ${esc(svc().REASONS[o.reason])}</p><p><b>آخر يوم عمل:</b> ${U.fmtDate(o.lastDay)}</p><p><b>تاريخ التعيين:</b> ${U.fmtDate(emp.joinDate)}</p></div><table><thead><tr><th>الجهة</th><th>الحالة</th><th>التوقيع</th></tr></thead><tbody>${deps.map((d) => `<tr><td>${esc(d.label)}</td><td>${CL[(o.clearance[d.key] || {}).status || "pending"].label}</td><td></td></tr>`).join("")}</tbody></table>${canSeeMoney() ? `<table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>${st.items.map((i) => `<tr><td>${esc(i.label)} (${i.type === "earning" ? "+" : "−"})</td><td>${U.money(i.amount)}</td></tr>`).join("")}<tr class="total"><td>الصافي</td><td>${U.money(st.net)}</td></tr></tbody></table>` : ""}<p class="muted">مستند تجريبي — القيم اليدوية تخضع لسياسة المنشأة والأنظمة المعتمدة.</p><div class="sign"><span>الموظف</span><span>الموارد البشرية</span><span>المالية</span></div>`) });
    btns.push({ label: "إغلاق", cls: "btn--ghost" });
    m.setFooter(btns);

    m.el.addEventListener("click", async (e) => {
      const cb = e.target.closest("[data-clear]");
      if (cb) {
        const dec = cb.dataset.dec;
        const c = await UI.prompt({ title: dec === "approved" ? "اعتماد إخلاء الطرف" : "تسجيل ملاحظة / رفض", label: dec === "approved" ? "ملاحظة (اختياري)" : "السبب (مثل: مستحقات أو عهد غير مسلمة)", required: dec !== "approved", danger: dec !== "approved" });
        if (c === null) return;
        if ((await UI.run(cb, () => svc().clear(o.id, cb.dataset.clear, dec, c), dec === "approved" ? "تم اعتماد إخلاء الطرف" : "تم تسجيل الملاحظة")) !== undefined) reopen();
        return;
      }
      if (e.target.closest("[data-eos-handover]")) {
        return UI.formModal({
          title: "التسليم والاستلام",
          fields: [
            { name: "status", label: "الحالة", type: "select", options: [["pending", "لم يبدأ"], ["in_progress", "جارٍ"], ["completed", "مكتمل"]] },
            { name: "to", label: "المستلم", type: "select", placeholder: "—", options: L().inCompany(EHR.db.employees).filter((x) => x.status === "active" && x.id !== o.employeeId).map((x) => [x.id, x.nameAr]) },
            { name: "notes", label: "ما تم تسليمه", type: "textarea", full: true },
          ],
          values: o.handover,
          async onSubmit(v) {
            await EHR.api.records("offboarding").update(o.id, (x) => (x.handover = { ...v }), "نهاية الخدمة", "تحديث التسليم");
            UI.toast("تم الحفظ", "success");
            reopen();
            return true;
          },
        });
      }
      if (e.target.closest("[data-eos-settle]")) {
        const manual = s.settlementComponents.filter((c) => c.mode === "manual");
        return UI.formModal({
          title: "البنود اليدوية للتسوية",
          fields: [...manual.map((c) => ({ name: c.key, label: `${c.label} (ر.س)`, type: "number", min: 0, hint: c.hint || "" })), { name: "notes", label: "ملاحظات", type: "textarea", full: true }],
          values: o.settlement,
          async onSubmit(v) {
            await EHR.api.records("offboarding").update(o.id, (x) => { x.settlement = { ...x.settlement, ...Object.fromEntries(manual.map((c) => [c.key, v[c.key] === "" ? null : Number(v[c.key])])), notes: v.notes }; }, "نهاية الخدمة", "تحديث التسوية");
            UI.toast("تم حفظ بنود التسوية", "success");
            reopen();
            return true;
          },
        });
      }
      if (e.target.closest("[data-eos-exit]")) {
        return UI.formModal({
          title: "مقابلة الخروج", subtitle: "إجابات سرية تُستخدم لتحسين بيئة العمل.", size: "lg",
          fields: s.exitQuestions.map((q) => ({ name: q.key, label: q.label, type: ["environment", "management", "compensation", "development"].includes(q.key) ? "select" : "textarea", options: [["5", "5 — ممتاز"], ["4", "4 — جيد جدًا"], ["3", "3 — جيد"], ["2", "2 — مقبول"], ["1", "1 — ضعيف"]], full: !["environment", "management", "compensation", "development"].includes(q.key) })),
          values: o.exitInterview || { environment: "4", management: "4", compensation: "3", development: "3" },
          async onSubmit(v) {
            await EHR.api.records("offboarding").update(o.id, (x) => (x.exitInterview = { ...v, at: U.stamp() }), "نهاية الخدمة", "مقابلة خروج");
            UI.toast("تم حفظ مقابلة الخروج", "success");
            reopen();
            return true;
          },
        });
      }
    });
  };

  /* ---------- Page ---------- */
  let tab = "open";
  EHR.view("offboarding", {
    title: "نهاية الخدمة",
    render(ctx) {
      const list = rows();
      const tabs = [["open", "قيد الإجراء", list.filter((o) => !["archived", "rejected"].includes(o.stage)).length], ["archived", "مؤرشفة", list.filter((o) => ["archived", "rejected"].includes(o.stage)).length]];
      const q = ctx.query;
      if (q.tab && tabs.some((t) => t[0] === q.tab)) tab = q.tab;
      const shown = list.filter((o) => (tab === "open" ? !["archived", "rejected"].includes(o.stage) : ["archived", "rejected"].includes(o.stage)));
      const exits = L().inCompany(EHR.db.offboarding).filter((o) => o.exitInterview);
      ctx.el.innerHTML = `
        ${H.pageHead("نهاية الخدمة", "الاستقالة وإنهاء الخدمة: الاعتماد، الإشعار، التسليم، العهد، إخلاء الطرف، التسوية، مقابلة الخروج، الأرشفة", "door", canManage() ? `<button type="button" class="btn btn--primary" data-eos-new>${icon("plus")}بدء إجراءات</button>` : "")}
        ${auth().scope("offboarding") !== "all" && auth().can("clearance.approve") ? UI.notice("تظهر الملفات التي تحتاج اعتماد إخلاء الطرف من جهتك.", "info", "check-circle") : ""}
        <div class="kpis kpis--sm">
          ${UI.kpi({ label: "ملفات قيد الإجراء", value: tabs[0][2], iconName: "door", tone: "warning" })}
          ${UI.kpi({ label: "بانتظار إخلاء الطرف", value: list.filter((o) => o.stage === "clearance").length, iconName: "check-circle", tone: "info" })}
          ${UI.kpi({ label: "معدل الدوران (12 شهرًا)", value: `${EHR.api.reports.turnover(365)}%`, iconName: "trending-down", tone: "gray" })}
          ${UI.kpi({ label: "مقابلات خروج مسجلة", value: exits.length, iconName: "chat", tone: "brand" })}
        </div>
        ${UI.tabs("eos", tabs, tab)}
        ${shown.length ? `<div class="cards-grid">${shown
          .map((o) => {
            const e = L().emp(o.employeeId);
            const i = STAGE_IDX(o.stage);
            return `<button type="button" class="card eos-card" data-eos="${o.id}">
              <header class="card__head">${UI.person(e.nameAr, `${e.id} · ${esc(L().deptName(e.departmentId))}`)}${o.stage === "rejected" ? UI.badge("مرفوض", "danger") : UI.badge((svc().STAGES[i] || ["", o.stage])[1], o.stage === "archived" ? "gray" : "warning")}</header>
              <div class="info-grid info-grid--3">${UI.info("السبب", esc(svc().REASONS[o.reason]))}${UI.info("آخر يوم", U.fmtShort(o.lastDay))}${UI.info("إخلاء الطرف", `${clearanceProgress(o)}%`)}</div>
              ${UI.progress(o.stage === "archived" ? 100 : ((i + 1) / svc().STAGES.length) * 100, o.stage === "rejected" ? "danger" : "brand", "تقدم الإجراءات")}
            </button>`;
          })
          .join("")}</div>` : `<div class="card">${UI.empty({ icon: "door", title: tab === "open" ? "لا توجد ملفات قيد الإجراء" : "لا توجد ملفات مؤرشفة" })}</div>`}`;
      if (Object.keys(q).length) {
        history.replaceState(null, "", "#/offboarding");
        ctx.query = {};
        if (q.open && list.some((o) => o.id === q.open)) openCase(q.open);
        else if (q.new && canManage()) openNew(q.new === "1" ? "" : q.new);
      }
      const self = this;
      ctx.el.onclick = (e) => {
        const t = e.target;
        const tb = t.closest('[data-tab-group="eos"]');
        if (tb) { tab = tb.dataset.tab; return self.render(ctx); }
        if (t.closest("[data-eos-new]")) return openNew();
        const c = t.closest("[data-eos]");
        if (c) openCase(c.dataset.eos);
      };
    },
  });
})((window.EHR = window.EHR || {}));
