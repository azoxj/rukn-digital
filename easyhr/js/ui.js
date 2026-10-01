/* =========================================================
   Easy HR — UI kit (toasts, modals, forms, tables, charts,
   kanban, calendar, steppers). Plain DOM, no dependencies.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const { $, $$, esc, icon } = U;
  const UI = {};

  /* =========================================================
     Small building blocks
     ========================================================= */
  UI.badge = (label, tone = "gray", withDot = true) =>
    `<span class="badge tone-${tone}">${withDot ? '<i aria-hidden="true"></i>' : ""}${esc(label)}</span>`;
  UI.status = (map, key) => {
    const s = map[key] || { label: key || "—", tone: "gray" };
    return UI.badge(s.label, s.tone);
  };
  UI.avatar = (name, size = "", hue) =>
    `<span class="avatar ${size}" style="--h:${hue ?? U.hue(name)}" aria-hidden="true">${esc(U.initials(name))}</span>`;
  UI.person = (name, sub = "", size = "sm", extra = "") =>
    `<span class="person">${UI.avatar(name, size)}<span class="person__text"><b>${esc(name)}</b>${sub ? `<small>${sub}</small>` : ""}</span>${extra}</span>`;
  UI.progress = (pct, tone = "brand", label = "") =>
    `<div class="progress" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" ${label ? `aria-label="${esc(label)}"` : ""}><span class="tone-${tone}" style="width:${U.clamp(pct, 0, 100)}%"></span></div>`;
  UI.empty = ({ icon: ic = "inbox", title = "لا توجد بيانات", text = "", action = null } = {}) =>
    `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ""}${
      action ? `<button class="btn btn--primary btn--sm" type="button" ${action.attrs || ""}>${icon(action.icon || "plus")}${esc(action.label)}</button>` : ""
    }</div>`;
  UI.kpi = ({ label, value, unit = "", iconName = "chart", tone = "brand", sub = "", trend = null, attrs = "" }) => {
    const tag = attrs ? "button" : "div";
    return `<${tag} class="kpi tone-${tone}" ${attrs ? `type="button" ${attrs}` : ""}>
      <span class="kpi__icon">${icon(iconName)}</span>
      <span class="kpi__body">
        <span class="kpi__label">${esc(label)}</span>
        <span class="kpi__value">${value}${unit ? `<small>${unit}</small>` : ""}</span>
        ${sub || trend != null ? `<span class="kpi__sub">${trend != null ? UI.trend(trend) : ""}${sub}</span>` : ""}
      </span>
    </${tag}>`;
  };
  UI.trend = (v, goodWhenUp = true) => {
    const up = v >= 0;
    const good = up === goodWhenUp;
    return `<span class="trend ${good ? "is-good" : "is-bad"}">${icon(up ? "arrow-up" : "arrow-down")}${Math.abs(v)}%</span>`;
  };
  UI.tabs = (group, items, active, cls = "") =>
    `<div class="tabs ${cls}" role="tablist">${items
      .map(([key, label, count]) => `<button type="button" role="tab" class="tab ${key === active ? "active" : ""}" aria-selected="${key === active}" data-tab-group="${group}" data-tab="${key}">${esc(label)}${count != null ? `<em>${count}</em>` : ""}</button>`)
      .join("")}</div>`;
  UI.info = (label, value) => `<div class="info"><small>${esc(label)}</small><b>${value ?? "—"}</b></div>`;
  UI.section = (title, body, iconName = "", extra = "") =>
    `<section class="sect"><header class="sect__head"><h4>${iconName ? icon(iconName) : ""}${esc(title)}</h4>${extra}</header>${body}</section>`;
  UI.notice = (text, tone = "info", iconName = "info") => `<div class="notice tone-${tone}">${icon(iconName)}<p>${text}</p></div>`;
  UI.skeleton = (rows = 4) => `<div class="skeleton">${'<span></span>'.repeat(rows)}</div>`;

  /* =========================================================
     Toasts
     ========================================================= */
  const TOAST_ICON = { success: "check-circle", error: "alert", info: "info", warning: "alert" };
  UI.toast = (message, type = "success", title = "") => {
    const box = $("#toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `toast tone-${type === "error" ? "danger" : type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.innerHTML = `${icon(TOAST_ICON[type] || "info")}<div class="toast__body">${title ? `<b>${esc(title)}</b>` : ""}<span>${esc(message)}</span></div>
      <button type="button" class="icon-btn icon-btn--sm" aria-label="إغلاق التنبيه">${icon("x")}</button>`;
    let done = false;
    const remove = () => {
      if (done) return;
      done = true;
      el.classList.add("out");
      setTimeout(() => el.remove(), 250);
    };
    el.querySelector("button").addEventListener("click", remove);
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild.remove();
    setTimeout(remove, type === "error" ? 6500 : 4200);
  };

  /* =========================================================
     Modals (stackable, focus-trapped)
     ========================================================= */
  const stack = [];
  const focusables = (root) =>
    $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]', root).filter((el) => el.offsetParent !== null);

  UI.modal = ({ title, subtitle = "", badge = "", body = "", footer = [], size = "md", onClose = null, className = "" }) => {
    const root = $("#modals");
    const wrap = document.createElement("div");
    wrap.className = `modal modal--${size} ${className}`;
    wrap.innerHTML = `
      <div class="modal__backdrop" data-modal-close></div>
      <div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="mt-${stack.length}" tabindex="-1">
        <header class="modal__head">
          <div class="modal__titles"><h2 id="mt-${stack.length}">${title}${badge ? ` ${badge}` : ""}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>
          <button type="button" class="icon-btn" data-modal-close aria-label="إغلاق">${icon("x")}</button>
        </header>
        <div class="modal__body"></div>
        <footer class="modal__foot"></footer>
      </div>`;
    const bodyEl = $(".modal__body", wrap);
    const footEl = $(".modal__foot", wrap);
    const box = $(".modal__box", wrap);
    const api = {
      el: wrap,
      body: bodyEl,
      foot: footEl,
      returnFocus: document.activeElement,
      setBody(html) {
        bodyEl.innerHTML = html;
      },
      setFooter(btns) {
        footEl.innerHTML = "";
        (btns || []).forEach((b) => {
          if (typeof b === "string") return footEl.insertAdjacentHTML("beforeend", b);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `btn ${b.cls || "btn--ghost"}`;
          if (b.push) btn.classList.add("push");
          btn.innerHTML = `${b.icon ? icon(b.icon) : ""}${esc(b.label)}`;
          if (b.disabled) btn.disabled = true;
          if (b.form) btn.setAttribute("form", b.form);
          if (b.submit) btn.type = "submit";
          if (b.onClick) btn.addEventListener("click", (e) => b.onClick(e, btn, api));
          else if (!b.submit) btn.addEventListener("click", () => api.close());
          footEl.appendChild(btn);
        });
        footEl.hidden = !footEl.children.length;
      },
      close() {
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        wrap.classList.remove("open");
        setTimeout(() => wrap.remove(), 200);
        if (!stack.length) document.body.classList.remove("modal-open");
        if (onClose) onClose();
        if (api.returnFocus && document.contains(api.returnFocus)) api.returnFocus.focus({ preventScroll: true });
      },
    };
    if (typeof body === "string") bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);
    api.setFooter(footer);
    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]") && e.target.closest(".modal") === wrap) api.close();
    });
    root.appendChild(wrap);
    stack.push(api);
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => {
      wrap.classList.add("open");
      const first = focusables(bodyEl).find((el) => /INPUT|SELECT|TEXTAREA/.test(el.tagName));
      (first && window.innerWidth > 760 ? first : box).focus({ preventScroll: true });
    });
    return api;
  };
  UI.topModal = () => stack[stack.length - 1] || null;
  UI.closeAllModals = () => stack.slice().forEach((m) => m.close());

  document.addEventListener("keydown", (e) => {
    const top = UI.topModal();
    if (!top) return;
    if (e.key === "Escape") {
      e.preventDefault();
      top.close();
    }
    if (e.key === "Tab") {
      const list = focusables($(".modal__box", top.el));
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.el.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  UI.confirm = ({ title = "تأكيد", text = "", confirmLabel = "تأكيد", cancelLabel = "إلغاء", danger = false }) =>
    new Promise((resolve) => {
      let answered = false;
      const m = UI.modal({
        title, size: "sm",
        body: `<div class="confirm">${icon(danger ? "alert" : "help", danger ? "is-danger" : "")}<p>${text}</p></div>`,
        onClose: () => !answered && resolve(false),
      });
      m.setFooter([
        { label: cancelLabel, cls: "btn--ghost", onClick: () => { answered = true; resolve(false); m.close(); } },
        { label: confirmLabel, cls: danger ? "btn--danger" : "btn--primary", onClick: () => { answered = true; resolve(true); m.close(); } },
      ]);
    });

  UI.prompt = ({ title, text = "", label = "ملاحظة", required = false, confirmLabel = "تأكيد", danger = false, placeholder = "" }) =>
    new Promise((resolve) => {
      let answered = false;
      const m = UI.modal({
        title, size: "sm",
        body: `${text ? `<p class="muted mb">${text}</p>` : ""}<label class="field"><span>${esc(label)}${required ? " *" : ""}</span><textarea class="input" rows="3" id="promptInput" placeholder="${esc(placeholder)}"></textarea><small class="field__error"></small></label>`,
        onClose: () => !answered && resolve(null),
      });
      m.setFooter([
        { label: "إلغاء", onClick: () => { answered = true; resolve(null); m.close(); } },
        {
          label: confirmLabel, cls: danger ? "btn--danger" : "btn--primary",
          onClick: () => {
            const v = $("#promptInput", m.el).value.trim();
            if (required && !v) {
              $(".field__error", m.el).textContent = "هذا الحقل مطلوب";
              $(".field", m.el).classList.add("invalid");
              $("#promptInput", m.el).focus();
              return;
            }
            answered = true;
            resolve(v);
            m.close();
          },
        },
      ]);
    });

  /* =========================================================
     Buttons with loading state
     ========================================================= */
  UI.busy = async (btn, fn) => {
    if (!btn) return fn();
    if (btn.classList.contains("is-loading")) return undefined;
    btn.classList.add("is-loading");
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
      return await fn();
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  };
  // Run an async action with loading + success/error toasts; never fails silently
  UI.run = async (btn, fn, successMsg) => {
    try {
      const r = await UI.busy(btn, fn);
      if (successMsg) UI.toast(typeof successMsg === "function" ? successMsg(r) : successMsg, "success");
      return r;
    } catch (err) {
      UI.toast(err && err.message ? err.message : "حدث خطأ غير متوقع", "error", "تعذّر إتمام العملية");
      return undefined;
    }
  };

  /* =========================================================
     Forms
     ========================================================= */
  const optionList = (opts) => (typeof opts === "function" ? opts() : opts || []).map((o) => (Array.isArray(o) ? o : [o, o]));
  UI.fieldHTML = (f, value) => {
    if (f.type === "section") return `<h5 class="form__section full">${esc(f.label)}</h5>`;
    if (f.type === "note") return `<div class="full">${UI.notice(f.label, f.tone || "info")}</div>`;
    const id = `f-${f.name}-${Math.random().toString(36).slice(2, 6)}`;
    const v = value ?? f.value ?? "";
    const req = f.required ? "required" : "";
    const dis = f.disabled ? "disabled" : "";
    const attrs = `id="${id}" name="${f.name}" ${req} ${dis} ${f.attrs || ""}`;
    let control;
    switch (f.type) {
      case "select":
        control = `<select class="input" ${attrs}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ""}${optionList(f.options)
          .map(([val, label]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(label)}</option>`)
          .join("")}</select>`;
        break;
      case "textarea":
        control = `<textarea class="input" rows="${f.rows || 3}" ${attrs} placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
        break;
      case "checkbox":
        return `<label class="check ${f.full ? "full" : ""}"><input type="checkbox" name="${f.name}" ${v ? "checked" : ""} ${dis}><span>${esc(f.label)}</span>${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
      case "checkgroup": {
        const vals = Array.isArray(v) ? v.map(String) : [];
        control = `<div class="checkgroup" role="group" aria-labelledby="${id}-l">${optionList(f.options)
          .map(([val, label]) => `<label class="chip-check"><input type="checkbox" name="${f.name}" value="${esc(val)}" ${vals.includes(String(val)) ? "checked" : ""} ${dis}><span>${esc(label)}</span></label>`)
          .join("")}</div>`;
        return `<div class="field ${f.full ? "full" : ""}" data-field="${f.name}"><span id="${id}-l">${esc(f.label)}${f.required ? " *" : ""}</span>${control}<small class="field__error"></small>${f.hint ? `<small class="field__hint">${esc(f.hint)}</small>` : ""}</div>`;
      }
      case "file":
        control = `<div class="file-drop"><input type="file" ${attrs} ${f.accept ? `accept="${f.accept}"` : ""}><span>${icon("upload")}<b>اختر ملفًا</b><small>${esc(f.placeholder || "PDF أو صورة — تخزين محاكى في النسخة التجريبية")}</small></span></div>`;
        break;
      default:
        control = `<input class="input" type="${f.type || "text"}" ${attrs} value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.step ? `step="${f.step}"` : ""} ${f.dir ? `dir="${f.dir}"` : ""}>`;
    }
    return `<label class="field ${f.full ? "full" : ""}" for="${id}" data-field="${f.name}"><span>${esc(f.label)}${f.required ? " *" : ""}</span>${control}<small class="field__error"></small>${f.hint ? `<small class="field__hint">${esc(f.hint)}</small>` : ""}</label>`;
  };
  UI.formHTML = (fields, values = {}, id = "") =>
    `<form class="form" ${id ? `id="${id}"` : ""} novalidate>${fields.map((f) => UI.fieldHTML(f, values[f.name])).join("")}<p class="form__error full" role="alert"></p></form>`;

  UI.readForm = (form, fields) => {
    const values = {};
    const errors = {};
    fields.forEach((f) => {
      if (!f.name || f.type === "section" || f.type === "note") return;
      const els = $$(`[name="${f.name}"]`, form);
      let v;
      if (f.type === "checkbox") v = !!(els[0] && els[0].checked);
      else if (f.type === "checkgroup") v = els.filter((x) => x.checked).map((x) => x.value);
      else if (f.type === "file") v = els[0] && els[0].files && els[0].files[0] ? { name: els[0].files[0].name, size: els[0].files[0].size } : null;
      else v = els[0] ? els[0].value.trim() : "";
      if (f.type === "number" && v !== "") v = Number(v);
      values[f.name] = v;
    });
    fields.forEach((f) => {
      if (!f.name || f.type === "section" || f.type === "note" || f.disabled) return;
      const v = values[f.name];
      const emptyV = v === "" || v == null || (Array.isArray(v) && !v.length);
      if (f.required && emptyV) errors[f.name] = f.type === "file" ? "يرجى إرفاق ملف" : "هذا الحقل مطلوب";
      else if (!emptyV && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errors[f.name] = "بريد إلكتروني غير صحيح";
      else if (!emptyV && f.type === "number" && (isNaN(v) || (f.min != null && v < f.min) || (f.max != null && v > f.max)))
        errors[f.name] = f.min != null && f.max != null ? `أدخل قيمة بين ${f.min} و ${f.max}` : f.min != null ? `الحد الأدنى ${f.min}` : "قيمة غير صحيحة";
      else if (!emptyV && f.pattern && !new RegExp(f.pattern).test(v)) errors[f.name] = f.patternMsg || "صيغة غير صحيحة";
      else if (!emptyV && f.validate) {
        const msg = f.validate(v, values);
        if (msg) errors[f.name] = msg;
      }
    });
    return { values, errors };
  };
  UI.showErrors = (form, errors, formMsg = "") => {
    $$(".field, .check", form).forEach((wrap) => {
      const name = wrap.getAttribute("data-field");
      const msg = name ? errors[name] : "";
      wrap.classList.toggle("invalid", !!msg);
      const err = $(".field__error", wrap);
      if (err) err.textContent = msg || "";
    });
    const top = $(".form__error", form);
    if (top) top.textContent = formMsg;
    const firstBad = $(".invalid input, .invalid select, .invalid textarea", form);
    if (firstBad) firstBad.focus();
  };

  // Complete add/edit modal: validation, loading state, error handling
  UI.formModal = ({ title, subtitle = "", fields, values = {}, submitLabel = "حفظ", size = "md", onSubmit, onMount, extraFooter = [] }) => {
    const formId = `frm-${Math.random().toString(36).slice(2, 7)}`;
    const m = UI.modal({ title, subtitle, size, body: UI.formHTML(fields, values, formId) });
    const form = $(`#${formId}`, m.el);
    m.setFooter([
      ...extraFooter,
      { label: "إلغاء", cls: "btn--ghost" },
      { label: submitLabel, cls: "btn--primary", icon: "check", submit: true, form: formId },
    ]);
    if (onMount) onMount(form, m);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const { values: vals, errors } = UI.readForm(form, fields);
      UI.showErrors(form, errors);
      if (Object.keys(errors).length) return;
      const btn = $('button[type="submit"]', m.el);
      try {
        const ok = await UI.busy(btn, () => onSubmit(vals, form, m));
        if (ok !== false) m.close();
      } catch (err) {
        UI.showErrors(form, err.fieldErrors || {}, err.message || "حدث خطأ");
        UI.toast(err.message || "تعذّر الحفظ", "error");
      }
    });
    return m;
  };
  UI.fieldError = (fieldErrors, message = "يرجى تصحيح الأخطاء") => {
    const err = new Error(message);
    err.fieldErrors = fieldErrors;
    return err;
  };

  /* =========================================================
     Data table (search, filters, sort, pagination, CSV,
     responsive cards on mobile). State survives re-renders.
     ========================================================= */
  const tableState = {};
  // Pre-set a table's search / filters before it renders (used by deep links like ?status=late)
  UI.presetTable = (id, { q, filters } = {}) => {
    const st = (tableState[id] = tableState[id] || { q: "", filters: {}, sort: undefined, page: 1 });
    if (q != null) st.q = q;
    if (filters) Object.assign(st.filters, filters);
    st.page = 1;
  };
  UI.table = (el, opts) => {
    const id = opts.id;
    const st = (tableState[id] = tableState[id] || { q: "", filters: {}, sort: undefined, page: 1 });
    if (st.sort === undefined) st.sort = opts.defaultSort || null;
    const pageSize = opts.pageSize || 10;

    const compute = () => {
      let rows = opts.rows();
      if (st.q && opts.search) rows = rows.filter((r) => U.matches(opts.search(r), st.q));
      (opts.filters || []).forEach((f) => {
        const v = st.filters[f.key];
        if (v != null && v !== "" && v !== "all") rows = rows.filter((r) => f.test(r, v));
      });
      if (st.sort) {
        const col = opts.columns.find((c) => c.key === st.sort.key);
        if (col && col.sort) {
          rows = rows.slice().sort((a, b) => {
            const x = col.sort(a);
            const y = col.sort(b);
            const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), "ar");
            return cmp * st.sort.dir;
          });
        }
      }
      return rows;
    };

    const render = () => {
      const rows = compute();
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      st.page = U.clamp(st.page, 1, pages);
      const slice = rows.slice((st.page - 1) * pageSize, st.page * pageSize);
      const filters = (opts.filters || [])
        .map((f) => {
          const options = typeof f.options === "function" ? f.options() : f.options;
          return `<select class="input input--sm" data-filter="${f.key}" aria-label="${esc(f.label)}"><option value="all">${esc(f.label)}</option>${options
            .map(([v, l]) => `<option value="${esc(v)}" ${String(st.filters[f.key] ?? "all") === String(v) ? "selected" : ""}>${esc(l)}</option>`)
            .join("")}</select>`;
        })
        .join("");
      const head = opts.columns
        .map((c) => {
          if (!c.sort) return `<th scope="col" class="${c.cls || ""}">${esc(c.label)}</th>`;
          const active = st.sort && st.sort.key === c.key;
          const dir = active ? (st.sort.dir > 0 ? "ascending" : "descending") : "none";
          return `<th scope="col" class="${c.cls || ""}" aria-sort="${dir}"><button type="button" class="th-sort ${active ? "active" : ""}" data-sort="${c.key}">${esc(c.label)}${icon(active ? (st.sort.dir > 0 ? "arrow-up" : "arrow-down") : "sort")}</button></th>`;
        })
        .join("");
      const body = slice.length
        ? slice
            .map((r) => {
              const attrs = opts.rowAttrs ? opts.rowAttrs(r) : "";
              return `<tr ${attrs}>${opts.columns
                .map((c) => `<td class="${c.cls || ""}" data-label="${esc(c.label)}">${c.render ? c.render(r) : esc(r[c.key] ?? "—")}</td>`)
                .join("")}</tr>`;
            })
            .join("")
        : `<tr class="row-empty"><td colspan="${opts.columns.length}">${UI.empty(opts.empty || { title: st.q ? "لا توجد نتائج مطابقة" : "لا توجد بيانات", text: st.q ? "جرّب كلمات بحث أخرى أو أزل الفلاتر." : "" })}</td></tr>`;
      const from = rows.length ? (st.page - 1) * pageSize + 1 : 0;
      const to = Math.min(st.page * pageSize, rows.length);
      let nums = [];
      if (pages <= 7) nums = Array.from({ length: pages }, (_, i) => i + 1);
      else {
        nums = [...new Set([1, st.page - 1, st.page, st.page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
        nums = nums.reduce((acc, n, i) => (i && n - nums[i - 1] > 1 ? [...acc, "…", n] : [...acc, n]), []);
      }
      el.innerHTML = `
        ${opts.toolbar === false ? "" : `<div class="tbl-toolbar">
          ${opts.search ? `<label class="search-input">${icon("search")}<input type="search" value="${esc(st.q)}" placeholder="${esc(opts.searchPlaceholder || "بحث...")}" aria-label="${esc(opts.searchPlaceholder || "بحث")}" data-search></label>` : ""}
          ${filters}
          <div class="tbl-toolbar__end">${opts.toolbarEnd ? opts.toolbarEnd() : ""}${
            opts.exportName ? `<button type="button" class="btn btn--ghost btn--sm" data-export>${icon("download")}تصدير CSV</button>` : ""
          }</div>
        </div>`}
        <div class="tbl-wrap"><table class="tbl ${opts.stack === false ? "" : "tbl--stack"}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
        ${rows.length > pageSize || opts.alwaysFooter ? `<div class="tbl-foot"><span>عرض ${from}–${to} من ${rows.length}</span>
          <div class="pager">
            <button type="button" data-page="${st.page - 1}" ${st.page <= 1 ? "disabled" : ""} aria-label="الصفحة السابقة">${icon("chevron-right")}</button>
            ${nums.map((n) => (n === "…" ? '<span class="pager__gap">…</span>' : `<button type="button" class="${n === st.page ? "active" : ""}" data-page="${n}" aria-label="صفحة ${n}" ${n === st.page ? 'aria-current="page"' : ""}>${n}</button>`)).join("")}
            <button type="button" data-page="${st.page + 1}" ${st.page >= pages ? "disabled" : ""} aria-label="الصفحة التالية">${icon("chevron-left")}</button>
          </div></div>` : `<div class="tbl-foot tbl-foot--count"><span>${rows.length} سجل</span></div>`}`;
      if (opts.afterRender) opts.afterRender(el, slice);
    };

    if (!el.__tableBound) {
      el.__tableBound = true;
      el.addEventListener("input", U.debounce((e) => {
        if (!e.target.matches("[data-search]")) return;
        const s = tableState[el.__tableId];
        s.q = e.target.value;
        s.page = 1;
        const pos = e.target.selectionStart;
        el.__render();
        const inp = $("[data-search]", el);
        if (inp) {
          inp.focus();
          inp.setSelectionRange(pos, pos);
        }
      }, 180));
      el.addEventListener("change", (e) => {
        const f = e.target.closest("[data-filter]");
        if (!f) return;
        const s = tableState[el.__tableId];
        s.filters[f.dataset.filter] = f.value;
        s.page = 1;
        el.__render();
      });
      el.addEventListener("click", (e) => {
        const s = tableState[el.__tableId];
        const sortBtn = e.target.closest("[data-sort]");
        if (sortBtn && el.contains(sortBtn)) {
          const key = sortBtn.dataset.sort;
          s.sort = s.sort && s.sort.key === key ? { key, dir: -s.sort.dir } : { key, dir: 1 };
          return el.__render();
        }
        const pg = e.target.closest("[data-page]");
        if (pg && el.contains(pg) && !pg.disabled) {
          s.page = Number(pg.dataset.page);
          el.__render();
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        if (e.target.closest("[data-export]")) {
          const rows = el.__compute();
          const cols = el.__opts.exportColumns;
          const name = U.downloadCSV(el.__opts.exportName, cols.map((c) => c[0]), rows.map((r) => cols.map((c) => c[1](r))));
          UI.toast(`تم تصدير ${rows.length} سجل (${name})`, "info");
          if (el.__opts.onExport) el.__opts.onExport(rows);
        }
      });
    }
    el.__tableId = id;
    el.__opts = opts;
    el.__render = render;
    el.__compute = compute;
    render();
    return { render, compute, state: st };
  };

  /* =========================================================
     Charts (HTML/CSS/SVG only)
     ========================================================= */
  const niceMax = (v) => {
    if (v <= 0) return 4;
    const mag = 10 ** Math.floor(Math.log10(v));
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= v);
  };
  const fmtAxis = (v) => (v >= 1000 ? `${U.round(v / 1000, 1)}k` : String(U.round(v, 1)));
  UI.chart = {};

  // Vertical bars (optionally stacked); tooltip on hover/focus
  UI.chart.bars = ({ labels, series, height = 220, format = U.num, highlight = -1, unit = "" }) => {
    const totals = labels.map((_, i) => U.sum(series, (s) => s.values[i] || 0));
    const max = niceMax(Math.max(...totals, 1));
    const grid = [4, 3, 2, 1, 0].map((k) => `<span data-v="${fmtAxis((max * k) / 4)}"></span>`).join("");
    const cols = labels
      .map((label, i) => {
        const edge = i === 0 ? "edge-start" : i === labels.length - 1 ? "edge-end" : "";
        const segs = series.map((s) => `<i style="--c:${s.color};height:${((s.values[i] || 0) / max) * 100}%;animation-delay:${i * 40}ms"></i>`).join("");
        const tip = `<div class="tip"><b>${esc(label)}</b>${series.map((s) => `<span><em><i style="--c:${s.color}"></i>${esc(s.label)}</em><strong>${format(s.values[i] || 0)}${unit}</strong></span>`).join("")}</div>`;
        return `<div class="bars__col ${edge} ${i === highlight ? "is-hl" : ""}" tabindex="0" aria-label="${esc(label)}: ${format(totals[i])}${unit}">${tip}<div class="bars__stack">${segs}</div></div>`;
      })
      .join("");
    return `<div class="bars" style="height:${height}px">
      <div class="bars__plot"><div class="bars__grid">${grid}</div>${cols}</div>
      <div class="bars__labels">${labels.map((l, i) => `<span class="${i === highlight ? "is-hl" : ""}">${esc(l)}</span>`).join("")}</div>
    </div>`;
  };

  // Line/area chart: SVG paths + HTML hover columns for tooltips
  UI.chart.line = ({ labels, series, height = 220, format = U.num, unit = "", area = true }) => {
    const all = series.flatMap((s) => s.values);
    const max = niceMax(Math.max(...all, 1));
    const n = labels.length;
    const W = 600;
    const H = 200;
    const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const y = (v) => H - (v / max) * H;
    const paths = series
      .map((s) => {
        const pts = s.values.map((v, i) => [x(i), y(v || 0)]);
        const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        return `${area ? `<path d="${d} L${W},${H} L0,${H} Z" fill="${s.color}" opacity="0.1"/>` : ""}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`;
      })
      .join("");
    const grid = [4, 3, 2, 1, 0].map((k) => `<span data-v="${fmtAxis((max * k) / 4)}"></span>`).join("");
    const hover = labels
      .map((l, i) => {
        const edge = i === 0 ? "edge-start" : i === n - 1 ? "edge-end" : "";
        return `<div class="line__col ${edge}" tabindex="0" aria-label="${esc(l)}"><div class="tip"><b>${esc(l)}</b>${series
          .map((s) => `<span><em><i style="--c:${s.color}"></i>${esc(s.label)}</em><strong>${format(s.values[i] || 0)}${unit}</strong></span>`)
          .join("")}</div>${series.map((s) => `<b class="line__dot" style="--c:${s.color};bottom:${((s.values[i] || 0) / max) * 100}%"></b>`).join("")}</div>`;
      })
      .join("");
    const step = Math.ceil(n / 8);
    return `<div class="line" style="height:${height}px">
      <div class="line__plot"><div class="bars__grid">${grid}</div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" style="transform:scaleX(-1)">${paths}</svg>
        <div class="line__cols">${hover}</div>
      </div>
      <div class="bars__labels">${labels.map((l, i) => `<span>${i % step === 0 || i === n - 1 ? esc(l) : ""}</span>`).join("")}</div>
    </div>`;
  };

  UI.chart.donut = ({ segments, center = "", centerLabel = "", size = 170 }) => {
    const total = U.sum(segments, (s) => s.value) || 1;
    let acc = 0;
    const stops = segments
      .map((s) => {
        const a = (acc / total) * 360;
        acc += s.value;
        return `${s.color} ${a}deg ${(acc / total) * 360}deg`;
      })
      .join(",");
    return `<div class="donut-wrap">
      <div class="donut" style="width:${size}px;height:${size}px;background:conic-gradient(${stops || "var(--surface-3) 0 360deg"})" role="img" aria-label="${esc(segments.map((s) => `${s.label}: ${s.value}`).join("، "))}">
        <div class="donut__center"><b>${center}</b><small>${esc(centerLabel)}</small></div>
      </div>
      <ul class="legend-list">${segments
        .map((s) => `<li><i style="--c:${s.color}"></i><span>${esc(s.label)}</span><b>${U.num(s.value)}</b><small>${U.pct(s.value, total)}%</small></li>`)
        .join("")}</ul>
    </div>`;
  };

  UI.chart.hbars = (items, { format = U.num, unit = "" } = {}) => {
    const max = Math.max(...items.map((i) => i.value), 1);
    return `<div class="hbars">${items
      .map(
        (it) => `<div class="hbar"><div class="hbar__top"><span>${esc(it.label)}</span><b>${format(it.value)}${unit}</b></div>
          <div class="hbar__track"><i style="--c:${it.color || "var(--brand)"};width:${(it.value / max) * 100}%"></i></div></div>`
      )
      .join("")}</div>`;
  };

  UI.chart.ring = (pct, label = "", tone = "brand", size = 92) =>
    `<div class="ring tone-${tone}" style="--p:${U.clamp(pct, 0, 100)};--s:${size}px" role="img" aria-label="${esc(label)} ${Math.round(pct)}%"><b>${Math.round(pct)}%</b>${label ? `<small>${esc(label)}</small>` : ""}</div>`;

  UI.chart.legend = (series) => `<div class="legend">${series.map((s) => `<span><i style="--c:${s.color}"></i>${esc(s.label)}</span>`).join("")}</div>`;

  /* =========================================================
     Stepper & approval timeline
     ========================================================= */
  UI.stepper = (steps, currentIndex, { rejected = false, compact = false } = {}) =>
    `<ol class="stepper ${compact ? "stepper--compact" : ""}">${steps
      .map(([key, label], i) => {
        const state = rejected && i === currentIndex ? "rejected" : i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
        return `<li class="is-${state}" ${i === currentIndex ? 'aria-current="step"' : ""}><span>${state === "done" ? icon("check") : state === "rejected" ? icon("x") : i + 1}</span><b>${esc(label)}</b></li>`;
      })
      .join("")}</ol>`;

  const STEP_STATUS = {
    approved: ["معتمد", "success"], rejected: ["مرفوض", "danger"], pending: ["بانتظار الإجراء", "warning"],
    waiting: ["لم يبدأ", "gray"], skipped: ["تم التخطي", "gray"],
  };
  UI.approvalTimeline = (approval) => {
    if (!approval) return "";
    const L = EHR.L;
    return `<ol class="approval">${approval.steps
      .map((s, i) => {
        const [label, tone] = STEP_STATUS[s.status] || ["—", "gray"];
        const who = s.byName || (s.by ? L.empName(s.by) : "");
        return `<li class="is-${s.status}">
          <span class="approval__dot">${s.status === "approved" ? icon("check") : s.status === "rejected" ? icon("x") : i + 1}</span>
          <div class="approval__body">
            <div class="approval__row"><b>${esc(EHR.api.approvals.STEP_LABEL[s.role] || s.role)}</b>${UI.badge(label, tone)}</div>
            ${who || s.at ? `<small>${who ? esc(who) : ""}${who && s.at ? " · " : ""}${s.at ? U.fmtStamp(s.at) : ""}</small>` : ""}
            ${s.comment ? `<p>${esc(s.comment)}</p>` : ""}
          </div>
        </li>`;
      })
      .join("")}</ol>`;
  };

  /* =========================================================
     Kanban board (drag & drop + accessible move menu)
     ========================================================= */
  UI.kanban = (el, { columns, items, card, onMove, colKey = "stage" }) => {
    el.innerHTML = `<div class="kanban">${columns
      .map((c) => {
        const list = items.filter((it) => it[colKey] === c.key);
        return `<section class="kanban__col tone-${c.tone || "gray"}" data-col="${c.key}" aria-label="${esc(c.label)}">
          <header><b>${esc(c.label)}</b><em>${list.length}</em></header>
          <div class="kanban__list" data-drop="${c.key}">${list.map((it) => `<article class="kcard" draggable="true" data-kid="${it.id}" tabindex="0">${card(it)}</article>`).join("") || '<p class="kanban__empty">لا يوجد</p>'}</div>
        </section>`;
      })
      .join("")}</div>`;
    let dragId = null;
    el.ondragstart = (e) => {
      const c = e.target.closest(".kcard");
      if (!c) return;
      dragId = c.dataset.kid;
      c.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", dragId);
      } catch (err) {
        /* ignore */
      }
    };
    el.ondragend = (e) => {
      const c = e.target.closest(".kcard");
      if (c) c.classList.remove("dragging");
      $$(".kanban__list.over", el).forEach((x) => x.classList.remove("over"));
    };
    el.ondragover = (e) => {
      const zone = e.target.closest("[data-drop]");
      if (!zone) return;
      e.preventDefault();
      $$(".kanban__list.over", el).forEach((x) => x !== zone && x.classList.remove("over"));
      zone.classList.add("over");
    };
    el.ondrop = (e) => {
      const zone = e.target.closest("[data-drop]");
      if (!zone || !dragId) return;
      e.preventDefault();
      zone.classList.remove("over");
      const id = dragId;
      dragId = null;
      onMove(id, zone.dataset.drop);
    };
  };

  /* =========================================================
     Calendar (month / week / day)
     ========================================================= */
  UI.calendar = ({ view, date, events }) => {
    const byDate = U.groupBy(events, (e) => e.date);
    const today = U.today();
    const evHTML = (e, full = false) =>
      `<button type="button" class="cal-ev tone-${e.tone || "brand"}" ${e.link ? `data-go="${esc(e.link)}"` : ""} title="${esc(e.title)}">${e.time ? `<time>${U.fmtTime(e.time)}</time>` : ""}<span>${esc(e.title)}</span>${full && e.sub ? `<small>${esc(e.sub)}</small>` : ""}</button>`;
    if (view === "day") {
      const list = (byDate[date] || []).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      return `<div class="cal-day"><h4>${U.fmtLong(date)}</h4>${list.length ? list.map((e) => evHTML(e, true)).join("") : UI.empty({ icon: "calendar", title: "لا توجد أحداث في هذا اليوم" })}</div>`;
    }
    if (view === "week") {
      const start = U.addDays(date, -U.dayOfWeek(date));
      return `<div class="cal-week">${Array.from({ length: 7 }, (_, i) => {
        const d = U.addDays(start, i);
        const list = byDate[d] || [];
        return `<div class="cal-week__day ${d === today ? "is-today" : ""}"><header><b>${U.weekday(d)}</b><small>${U.fmtShort(d)}</small></header>${list.map((e) => evHTML(e, true)).join("") || '<p class="muted small">—</p>'}</div>`;
      }).join("")}</div>`;
    }
    const first = `${date.slice(0, 7)}-01`;
    const startOffset = U.dayOfWeek(first);
    const daysInMonth = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)), 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push('<div class="cal-cell is-out"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${date.slice(0, 7)}-${String(d).padStart(2, "0")}`;
      const list = byDate[iso] || [];
      cells.push(`<div class="cal-cell ${iso === today ? "is-today" : ""}" data-day="${iso}"><span class="cal-cell__n">${d}</span>${list
        .slice(0, 3)
        .map((e) => evHTML(e))
        .join("")}${list.length > 3 ? `<button type="button" class="cal-more" data-cal-day="${iso}">+${list.length - 3} المزيد</button>` : ""}</div>`);
    }
    return `<div class="cal-month"><div class="cal-head">${U.WEEKDAYS.map((w) => `<span>${w}</span>`).join("")}</div><div class="cal-grid">${cells.join("")}</div></div>`;
  };

  EHR.UI = UI;
})((window.EHR = window.EHR || {}));
