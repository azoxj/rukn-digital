/* =========================================================
   Easy HR — generic record module (list + stats + tabs + form +
   detail + approval actions). Modules describe *what* they need;
   this factory renders a consistent, accessible page.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const { $, esc, icon } = U;

  const tabState = {};

  EHR.crud = (cfg) => {
    const api = cfg.api;
    const statusKey = cfg.statusKey || "status";
    const approvals = () => EHR.api.approvals;

    const rowsForUser = () => (cfg.rows ? cfg.rows() : api.visible());
    const tabbedRows = () => {
      const rows = rowsForUser();
      const tab = tabState[cfg.key] || (cfg.tabs ? cfg.tabs[0][0] : null);
      const def = cfg.tabs && cfg.tabs.find((t) => t[0] === tab);
      return def && def[2] ? rows.filter(def[2]) : rows;
    };

    // ----- Detail modal -----
    const openDetail = (id) => {
      const rec = api.get(id);
      if (!rec) return UI.toast("السجل غير موجود", "error");
      const st = cfg.statuses ? cfg.statuses[rec[statusKey]] : null;
      const m = UI.modal({
        title: cfg.detailTitle ? cfg.detailTitle(rec) : esc(rec.id),
        subtitle: cfg.detailSubtitle ? cfg.detailSubtitle(rec) : "",
        badge: st ? UI.badge(st.label, st.tone) : "",
        size: cfg.detailSize || "lg",
        body: `${cfg.detailBody(rec)}${rec.approval ? UI.section("مسار الاعتماد", UI.approvalTimeline(rec.approval), "flow") : ""}`,
      });
      const done = async (fn, msg) => {
        const r = await UI.run(null, fn, msg);
        if (r !== undefined) {
          m.close();
          EHR.app.refresh();
          if (api.get(id)) openDetail(id);
        }
      };
      const buttons = [];
      if (rec.approval && approvals().canAct(rec)) {
        buttons.push({
          label: "رفض", cls: "btn--danger-ghost", icon: "x", push: true,
          onClick: async () => {
            const c = await UI.prompt({ title: "رفض الطلب", label: "سبب الرفض", required: true, confirmLabel: "تأكيد الرفض", danger: true });
            if (c !== null) done(() => approvals().act(cfg.approvalCollection, id, "reject", c), "تم رفض الطلب");
          },
        });
        buttons.push({
          label: "اعتماد", cls: "btn--success", icon: "check",
          onClick: async () => {
            const c = await UI.prompt({ title: "اعتماد الطلب", label: "ملاحظة (اختياري)", confirmLabel: "اعتماد" });
            if (c !== null) done(() => approvals().act(cfg.approvalCollection, id, "approve", c), "تم الاعتماد");
          },
        });
      }
      (cfg.detailActions ? cfg.detailActions(rec) : []).forEach((a) => {
        if (a.when && !a.when(rec)) return;
        buttons.push({
          label: a.label, cls: a.cls || "btn--ghost", icon: a.icon,
          onClick: async (e, btn) => {
            if (a.confirm) {
              const ok = await UI.confirm({ title: a.label, text: a.confirm, confirmLabel: a.label, danger: !!a.danger });
              if (!ok) return;
            }
            if (a.custom) return a.run(rec, btn, m);
            const r = await UI.run(btn, () => a.run(rec), a.success);
            if (r !== undefined) {
              m.close();
              EHR.app.refresh();
              if (api.get(id)) openDetail(id);
            }
          },
        });
      });
      if (cfg.canEdit && cfg.canEdit(rec) && cfg.formFields) {
        buttons.push({ label: "تعديل", icon: "edit", onClick: () => { m.close(); openForm(rec); } });
      }
      if (cfg.printable) {
        buttons.push({ label: "طباعة", icon: "print", onClick: () => U.printHTML(cfg.title, cfg.printable(rec)) });
      }
      buttons.push({ label: "إغلاق", cls: "btn--ghost" });
      m.setFooter(buttons);
      return m;
    };

    // ----- Add / edit form -----
    const openForm = (rec = null) => {
      const fields = cfg.formFields(rec);
      return UI.formModal({
        title: rec ? `تعديل — ${rec.id}` : cfg.createLabel,
        subtitle: cfg.formSubtitle ? cfg.formSubtitle(rec) : "",
        size: cfg.formSize || "md",
        fields,
        values: rec ? (cfg.toForm ? cfg.toForm(rec) : rec) : cfg.defaults ? cfg.defaults() : {},
        submitLabel: rec ? "حفظ التعديلات" : cfg.submitLabel || "حفظ",
        onMount: cfg.onFormMount,
        onSubmit: async (values) => {
          if (cfg.validate) {
            const errs = cfg.validate(values, rec);
            if (errs && Object.keys(errs).length) throw UI.fieldError(errs, "يرجى تصحيح الحقول المحددة");
          }
          let saved;
          if (rec) {
            saved = await api.update(rec.id, cfg.toRecord(values, rec), cfg.title);
            UI.toast("تم حفظ التعديلات", "success");
          } else if (cfg.create) {
            saved = await cfg.create(values);
            UI.toast(cfg.createdMsg || "تم الحفظ بنجاح", "success");
          } else {
            saved = await api.create({ id: U.uid(cfg.idPrefix || "REC"), ...cfg.toRecord(values, null) }, cfg.title);
            UI.toast(cfg.createdMsg || "تم الحفظ بنجاح", "success");
          }
          EHR.app.refresh();
          if (cfg.afterSave) cfg.afterSave(saved);
          return true;
        },
      });
    };

    // ----- Page -----
    const render = (ctx) => {
      // Deep links: ?tab=<key> selects a tab, ?<filterKey>=<value> presets a table filter
      if (ctx.query.tab && cfg.tabs && cfg.tabs.some((t) => t[0] === ctx.query.tab)) tabState[cfg.key] = ctx.query.tab;
      const preset = {};
      (cfg.filters || []).forEach((f) => ctx.query[f.key] && (preset[f.key] = ctx.query[f.key]));
      if (Object.keys(preset).length) UI.presetTable(`crud-${cfg.key}`, { filters: preset });
      const rows = rowsForUser();
      const canCreate = cfg.canCreate ? cfg.canCreate() : false;
      const tab = tabState[cfg.key] || (cfg.tabs ? cfg.tabs[0][0] : null);
      const pendingMine = cfg.approvalCollection ? rows.filter((r) => r.approval && approvals().isOpen(r) && approvals().canAct(r)).length : 0;
      const actionsHTML = `${cfg.headerActions ? cfg.headerActions(ctx) : ""}
            ${canCreate && !cfg.noCreateButton ? `<button type="button" class="btn btn--primary" data-crud-create>${icon("plus")}${esc(cfg.createLabel)}</button>` : ""}`;
      // Embedded mode renders inside another page's tab (no page heading)
      ctx.el.innerHTML = `
        ${cfg.embedded
          ? `<div class="toolbar-row toolbar-row--end">${cfg.subtitle ? `<p class="muted small grow">${cfg.subtitle}</p>` : ""}${actionsHTML}</div>`
          : `<div class="page-head">
          <div><h1>${icon(cfg.icon)}${esc(cfg.title)}</h1><p>${cfg.subtitle || ""}</p></div>
          <div class="page-actions">${actionsHTML}</div>
        </div>`}
        ${cfg.scopeNote ? cfg.scopeNote() : ""}
        ${pendingMine ? UI.notice(`لديك <b>${pendingMine}</b> ${pendingMine === 1 ? "طلب" : "طلبات"} بانتظار موافقتك في هذه القائمة.`, "warning", "bell") : ""}
        ${cfg.stats ? `<div class="kpis kpis--sm">${cfg.stats(rows).map(UI.kpi).join("")}</div>` : ""}
        ${cfg.extraTop ? cfg.extraTop(ctx) : ""}
        ${cfg.tabs ? UI.tabs(`crud-${cfg.key}`, cfg.tabs.map(([k, l, test]) => [k, l, test ? rows.filter(test).length : rows.length]), tab) : ""}
        <div class="card card--flush"><div data-crud-table></div></div>
        ${cfg.extraBottom ? cfg.extraBottom(ctx) : ""}`;

      const columns = [...cfg.columns];
      columns.push({
        key: "_actions", label: "الإجراءات", cls: "cell-actions",
        render: (r) => `<div class="row-actions">
          ${r.approval && approvals().isOpen(r) && approvals().canAct(r) ? `<span class="pill-alert" title="بانتظار موافقتك">${icon("bell")}</span>` : ""}
          <button type="button" class="icon-btn icon-btn--sm" data-crud-view="${r.id}" aria-label="عرض ${esc(r.id)}" data-tip="عرض">${icon("eye")}</button>
          ${cfg.canEdit && cfg.canEdit(r) && cfg.formFields ? `<button type="button" class="icon-btn icon-btn--sm" data-crud-edit="${r.id}" aria-label="تعديل ${esc(r.id)}" data-tip="تعديل">${icon("edit")}</button>` : ""}
          ${cfg.rowActions ? cfg.rowActions(r) : ""}
        </div>`,
      });

      UI.table($("[data-crud-table]", ctx.el), {
        id: `crud-${cfg.key}`,
        rows: tabbedRows,
        columns,
        search: cfg.search,
        searchPlaceholder: cfg.searchPlaceholder,
        filters: cfg.filters,
        defaultSort: cfg.defaultSort,
        pageSize: cfg.pageSize || 10,
        rowAttrs: (r) => `data-crud-row="${r.id}" tabindex="0"`,
        exportName: cfg.exportName,
        exportColumns: cfg.exportColumns,
        empty: cfg.empty
          ? { ...cfg.empty, action: canCreate ? { label: cfg.createLabel, attrs: "data-crud-create" } : null }
          : { title: "لا توجد سجلات", text: "", action: canCreate ? { label: cfg.createLabel, attrs: "data-crud-create" } : null },
      });

      ctx.el.onclick = (e) => {
        const t = e.target;
        if (t.closest("[data-crud-create]")) return openForm(null);
        const tabBtn = t.closest(`[data-tab-group="crud-${cfg.key}"]`);
        if (tabBtn) {
          tabState[cfg.key] = tabBtn.dataset.tab;
          return render(ctx);
        }
        const ed = t.closest("[data-crud-edit]");
        if (ed) return openForm(api.get(ed.dataset.crudEdit));
        const vw = t.closest("[data-crud-view]");
        if (vw) return openDetail(vw.dataset.crudView);
        if (t.closest("button, a, input, select, label")) return;
        const row = t.closest("[data-crud-row]");
        if (row) openDetail(row.dataset.crudRow);
      };
      ctx.el.onkeydown = (e) => {
        if (e.key === "Enter" && e.target.matches("[data-crud-row]")) openDetail(e.target.dataset.crudRow);
      };
      if (cfg.afterRender) cfg.afterRender(ctx);
      // Deep links: ?open=<id> opens a record, ?new=1 opens the create form
      if (ctx.query.open || ctx.query.new || ctx.query.tab || Object.keys(preset).length) {
        const { open, new: isNew } = ctx.query;
        if (!cfg.embedded) history.replaceState(null, "", `#/${ctx.view}`);
        ctx.query = {};
        if (open && api.get(open)) openDetail(open);
        else if (isNew && canCreate) openForm(null);
      }
    };

    return { render, openDetail, openForm };
  };
})((window.EHR = window.EHR || {}));
