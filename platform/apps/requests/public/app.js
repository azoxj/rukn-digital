/* =========================================================
   AZENK Requests — frontend views
   ========================================================= */
(function () {
  "use strict";
  const AZ = window.AZ;
  const { esc, fmt, $, $$ } = AZ;

  const L = {
    role: { ADMIN: "مدير النظام", MANAGER: "مدير", EMPLOYEE: "موظف" },
    status: { pending: "بانتظار الموافقة", returned: "معاد للتعديل", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغى" },
    tone: { pending: "warn", returned: "info", approved: "ok", rejected: "err", cancelled: "" },
    step: { pending: "بانتظار القرار", approved: "موافقة", rejected: "رفض", returned: "إعادة للتعديل", cancelled: "ملغاة" },
    stepTone: { pending: "warn", approved: "ok", rejected: "err", returned: "info", cancelled: "" },
    ftype: { text: "نص قصير", textarea: "نص طويل", number: "رقم", date: "تاريخ", select: "قائمة اختيار", checkbox: "مربع اختيار" },
  };
  const badge = (s) => AZ.badge(L.status[s] || s, L.tone[s]);
  const head = (title, sub, actions = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
  const late = (iso) => iso && Date.parse(iso) < Date.now();
  const size = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB");
  let directory = null;
  const staff = async () => (directory ||= (await AZ.get("/api/users/directory")).items);
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

  /* ---------- dynamic request form (fields → inputs named data.<key>) ---------- */
  const dataFields = (fields, data = {}) => `<div class="grid2">${fields.map((f) => {
    const name = `data.${f.key}`;
    const v = data[f.key];
    if (f.type === "checkbox") return `<div class="fld fld--full" data-field="${name}"><label class="chk"><input type="checkbox" name="${name}"${v ? " checked" : ""}> ${esc(f.label)}${f.required ? ' <em aria-hidden="true">*</em>' : ""}</label><small class="err" hidden></small></div>`;
    const type = f.type === "select" ? "select" : f.type === "textarea" ? "textarea" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text";
    return AZ.field({ name, label: f.label, type, required: f.required, value: v ?? "", max: f.max, step: type === "number" ? "any" : undefined, full: f.type === "textarea",
      options: f.type === "select" ? [["", "اختر…"], ...f.options.map((o) => [o, o])] : undefined, rows: 4 });
  }).join("")}</div>`;
  const readData = (form) => {
    const out = {};
    for (const el of form.elements) {
      if (!el.name || !el.name.startsWith("data.")) continue;
      out[el.name.slice(5)] = el.type === "checkbox" ? el.checked : el.value;
    }
    return out;
  };
  const showData = (fields, data) => `<dl class="dl">${fields.map((f) => {
    const v = data[f.key];
    const txt = f.type === "checkbox" ? (v ? "نعم" : "لا") : f.type === "date" && v ? fmt.date(v) : f.type === "number" && v != null ? fmt.num(v) : v;
    return `<dt>${esc(f.label)}</dt><dd class="pre">${esc(txt == null || txt === "" ? "—" : txt)}</dd>`;
  }).join("")}</dl>`;
  const uploadAll = async (rid, files) => {
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) throw new AZ.ApiError(413, `«${file.name}» أكبر من 15MB`);
      await AZ.api("PUT", `/api/requests/${rid}/files` + AZ.qs({ name: file.name }), file, { raw: true, type: file.type || "application/octet-stream" });
    }
  };
  const fileInput = `<div class="fld"><label for="rq-files">مرفقات (اختياري، حتى 10 ملفات · 15MB لكل ملف)</label><input id="rq-files" type="file" multiple accept=".pdf,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg,.txt,.md"><small class="hint">PDF، Word، PowerPoint، Excel، ZIP، صور، نص — يتحقق الخادم من نوع كل ملف ومحتواه.</small></div>`;

  /* ================= Dashboard ================= */
  const dashboard = async (main) => {
    const d = await AZ.get("/api/dashboard");
    main.innerHTML = `${head(`مرحبًا ${AZ.state.user.name}`, "طلباتك والموافقات المطلوبة منك", '<a class="btn btn--primary" href="#/new">+ طلب جديد</a>')}
      <div class="stats">
        ${AZ.stat("بانتظار موافقتي", fmt.num(d.inbox.n), { tone: d.inbox.n ? "warn" : "", href: "#/approvals" })}
        ${AZ.stat("متأخرة عندي", fmt.num(d.inbox.overdue), { tone: d.inbox.overdue ? "err" : "", href: "#/approvals" })}
        ${AZ.stat("طلباتي قيد الموافقة", fmt.num(d.mine.pending), { href: "#/requests?status=pending" })}
        ${AZ.stat("معادة لي للتعديل", fmt.num(d.mine.returned), { tone: d.mine.returned ? "warn" : "", href: "#/requests?status=returned" })}
        ${AZ.stat("طلباتي المعتمدة", fmt.num(d.mine.approved), { tone: "ok" })}
        ${d.org ? AZ.stat("طلبات المنشأة المتأخرة", fmt.num(d.org.overdue), { tone: d.org.overdue ? "err" : "", href: "#/requests?scope=all&overdue=1" }) : ""}
      </div>
      <div class="cols cols--2">
        <section class="card"><div class="card__head"><h2>بانتظار موافقتي</h2><a href="#/approvals">الكل</a></div>
          ${d.inbox_top.length ? `<ul class="timeline">${d.inbox_top.map((r) => `<li><a href="#/requests/${r.id}"><b>#${r.number} ${esc(r.title)}</b></a><small>${esc(r.type_name)} · ${esc(r.requester_name)} · ${esc(r.step_name)}</small><small class="${late(r.due_at) ? "badge badge--err" : ""}">الاستحقاق: ${esc(fmt.dateTime(r.due_at))}</small></li>`).join("")}</ul>` : '<div class="empty">لا توجد طلبات بانتظار موافقتك.</div>'}</section>
        <section class="card"><div class="card__head"><h2>آخر طلباتي</h2><a href="#/requests">الكل</a></div>
          ${d.recent.length ? `<ul class="timeline">${d.recent.map((r) => `<li><a href="#/requests/${r.id}"><b>#${r.number} ${esc(r.title)}</b></a> ${badge(r.status)}<small>${esc(r.type_name)} · ${esc(fmt.rel(r.updated_at))}</small></li>`).join("")}</ul>` : '<div class="empty">لم تقدّم طلبات بعد.</div>'}</section>
      </div>`;
  };

  /* ================= New request ================= */
  const newPick = async (main) => {
    const types = (await AZ.get("/api/types")).items;
    const groups = {};
    types.forEach((t) => (groups[t.category || "عام"] ||= []).push(t));
    main.innerHTML = `${head("طلب جديد", "اختر نوع الطلب")}
      ${types.length ? Object.entries(groups).map(([g, list]) => `<section class="card"><h2>${esc(g)}</h2><div class="type-grid">${list.map((t) => `<a class="type-card" href="#/new/${t.id}"><b>${esc(t.name)}</b><span>${esc(t.description || "")}</span><small>${t.steps.length} ${t.steps.length === 1 ? "مرحلة موافقة" : "مراحل موافقة"} · مدة الاستجابة ${t.sla_hours} ساعة</small></a>`).join("")}</div></section>`).join("")
        : `<div class="empty">لا توجد أنواع طلبات مفعّلة بعد.${AZ.can("types.manage") ? ' <a href="#/types">أضف أنواع الطلبات</a>' : " تواصل مع مدير النظام."}</div>`}`;
  };

  const newForm = async (main, [id]) => {
    const t = (await AZ.get(`/api/types/${id}`)).type;
    main.innerHTML = `${head(t.name, t.description || "")}
      <div class="cols cols--main">
        <form class="card" data-new novalidate>
          ${AZ.field({ name: "title", label: "عنوان الطلب", required: true, max: 200, placeholder: "وصف مختصر يظهر في القوائم" })}
          ${dataFields(t.fields)}
          ${fileInput}
          <p class="form-err" role="alert" hidden></p>
          <div class="actions"><button class="btn btn--primary" type="submit">إرسال الطلب</button><a class="btn btn--ghost" href="#/new">رجوع</a></div>
        </form>
        <aside class="card"><h2>مسار الموافقة</h2><ol class="path-steps">${t.steps.map((s) => `<li><b>${esc(s.name)}</b><small>${esc(approverLabel(s.approver))}</small></li>`).join("")}</ol>
          <p class="hint">يجب البت في كل مرحلة خلال ${t.sla_hours} ساعة. ستصلك إشعارات بكل قرار.</p></aside>
      </div>`;
    const form = $("[data-new]", main);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      try {
        AZ.showErrors(form, null);
        const r = await AZ.post("/api/requests", { type_id: t.id, title: form.elements.title.value, data: readData(form) });
        const files = [...$("#rq-files", form).files];
        try { await uploadAll(r.request.id, files); } catch (err) { AZ.toast(`تم إرسال الطلب، لكن تعذّر رفع مرفق: ${err.message}`, "err"); }
        AZ.toast(`تم إرسال الطلب #${r.request.number}`);
        AZ.go(`#/requests/${r.request.id}`);
      } catch (err) { AZ.showErrors(form, err); }
      finally { btn.disabled = false; }
    });
  };
  const approverLabel = (a) => a === "manager" ? "المدير المباشر" : a.startsWith("role:") ? `أي ${L.role[a.slice(5)] || a.slice(5)}` : ((directory || []).find((u) => `user:${u.id}` === a) || {}).name || "مستخدم محدد";

  /* ================= Lists ================= */
  const requestsList = async (main, _a, params) => {
    const scopes = [["mine", "طلباتي"], ...(AZ.can("requests.view_team") ? [["team", "طلبات فريقي"]] : []), ...(AZ.can("requests.view_all") ? [["all", "كل الطلبات"]] : [])];
    const types = (await AZ.get("/api/types" + (AZ.can("types.manage") ? "?all=1" : ""))).items;
    const state = { scope: scopes.some(([k]) => k === params.scope) ? params.scope : "mine", status: params.status || "", type_id: "", q: "", overdue: params.overdue || "", page: 1 };
    main.innerHTML = `${head("الطلبات", "", '<a class="btn btn--primary" href="#/new">+ طلب جديد</a>')}
      <form class="filters">${AZ.field({ name: "scope", label: "العرض", type: "select", options: scopes, value: state.scope })}
        ${AZ.field({ name: "q", label: "بحث (رقم أو عنوان أو اسم)", type: "search" })}
        ${AZ.field({ name: "status", label: "الحالة", type: "select", options: [["", "الكل"], ["open", "المفتوحة"], ...Object.entries(L.status)], value: state.status })}
        ${AZ.field({ name: "type_id", label: "النوع", type: "select", options: [["", "الكل"], ...types.map((t) => [t.id, t.name])] })}
        ${AZ.field({ name: "overdue", label: "التأخير", type: "select", options: [["", "الكل"], ["1", "المتأخرة فقط"]], value: state.overdue })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/requests" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "رقم", html: (x) => `<a href="#/requests/${x.id}">#${x.number}</a>` },
        { label: "العنوان", html: (x) => `<a href="#/requests/${x.id}">${esc(x.title)}</a><br><small class="muted">${esc(x.type_name)}</small>` },
        { label: "مقدم الطلب", key: "requester_name" },
        { label: "الحالة", html: (x) => `${badge(x.status)}${x.current_step_name ? `<br><small class="muted">${esc(x.current_step_name)}</small>` : ""}` },
        { label: "الاستحقاق", html: (x) => x.status === "pending" ? `<span class="${late(x.step_due_at) ? "badge badge--err" : ""}">${esc(fmt.dateTime(x.step_due_at))}</span>` : "—" },
        { label: "آخر تحديث", html: (x) => esc(fmt.rel(x.updated_at)) },
      ], r.items, { empty: "لا توجد طلبات مطابقة." }) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    await render();
  };

  const approvals = async (main, _a, params) => {
    const state = { status: params.status === "decided" ? "decided" : "pending", page: 1 };
    main.innerHTML = `${head("الموافقات", "الطلبات التي تنتظر قرارك والقرارات السابقة")}
      <nav class="tabs" aria-label="الموافقات"><a href="#/approvals"${state.status === "pending" ? ' class="is-active" aria-current="page"' : ""}>بانتظار قراري</a><a href="#/approvals?status=decided"${state.status === "decided" ? ' class="is-active" aria-current="page"' : ""}>قراراتي السابقة</a></nav><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/approvals" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([
        { label: "رقم", html: (x) => `<a href="#/requests/${x.id}">#${x.number}</a>` },
        { label: "الطلب", html: (x) => `<a href="#/requests/${x.id}">${esc(x.title)}</a><br><small class="muted">${esc(x.type_name)}</small>` },
        { label: "مقدم الطلب", key: "requester_name" },
        { label: "المرحلة", key: "step_name" },
        ...(state.status === "pending"
          ? [{ label: "الاستحقاق", html: (x) => `<span class="${late(x.due_at) ? "badge badge--err" : ""}">${esc(fmt.dateTime(x.due_at))}</span>` }, { label: "", html: (x) => `<a class="btn btn--primary btn--sm" href="#/requests/${x.id}">مراجعة</a>` }]
          : [{ label: "قراري", html: (x) => AZ.badge(L.step[x.step_status], L.stepTone[x.step_status]) }, { label: "التاريخ", html: (x) => esc(fmt.dateTime(x.decided_at)) }, { label: "حالة الطلب الآن", html: (x) => badge(x.status) }]),
      ], r.items, { empty: state.status === "pending" ? "لا توجد طلبات بانتظار قرارك." : "لم تتخذ قرارات بعد." }) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    await render();
  };

  /* ================= Request detail ================= */
  const requestView = async (main, [id]) => {
    const d = await AZ.get(`/api/requests/${id}`);
    await staff().catch(() => {});
    const r = d.request;
    const steps = r.steps.map((def, i) => {
      const inst = d.approvals.filter((a) => a.step_index === i);
      const lastInst = inst[inst.length - 1];
      return { def, i, inst, state: lastInst ? lastInst.status : "waiting" };
    });
    main.innerHTML = `${head(`#${r.number} · ${r.title}`, `${r.type_name} · قدّمه ${r.requester_name} ${fmt.rel(r.created_at)}`, badge(r.status))}
      <div class="cols cols--main">
        <div>
          ${d.can.decide ? `<section class="card card--focus"><h2>قرارك على مرحلة «${esc(d.approvals.find((a) => a.status === "pending").name)}»</h2>
            <form data-decide novalidate>${AZ.field({ name: "comment", label: "تعليق (مطلوب عند الرفض أو الإعادة)", type: "textarea", rows: 3, max: 2000 })}<p class="form-err" hidden></p>
              <div class="actions"><button class="btn btn--primary" type="button" data-d="approve">موافقة</button><button class="btn btn--ghost" type="button" data-d="return">إعادة للتعديل</button><button class="btn btn--danger" type="button" data-d="reject">رفض</button></div></form></section>` : ""}
          ${d.can.resubmit ? `<section class="card card--focus"><h2>عدّل طلبك وأعد إرساله</h2>
            ${(() => { const ret = [...d.approvals].reverse().find((a) => a.status === "returned"); return ret && ret.comment ? `<p class="note">ملاحظة ${esc(ret.decided_by_name || "")}: ${esc(ret.comment)}</p>` : ""; })()}
            <form data-resubmit novalidate>${AZ.field({ name: "title", label: "عنوان الطلب", required: true, value: r.title, max: 200 })}${dataFields(r.fields, r.data)}<p class="form-err" hidden></p>
              <button class="btn btn--primary" type="submit">إعادة الإرسال</button></form></section>` : ""}
          <section class="card"><h2>بيانات الطلب</h2>${showData(r.fields, r.data)}</section>
          <section class="card"><div class="card__head"><h2>المرفقات</h2></div>
            ${d.files.length ? `<ul class="timeline">${d.files.map((f) => `<li><button class="link" data-dl="${f.id}" data-name="${esc(f.original_name)}">${esc(f.original_name)}</button> <small class="muted" dir="ltr">${size(f.size)}</small><small>${esc(f.uploader_name)} · ${esc(fmt.dateTime(f.created_at))}</small>${f.uploader_id === AZ.state.user.id && ["pending", "returned"].includes(r.status) ? ' <button class="link" data-rmfile="' + f.id + '">حذف</button>' : ""}</li>`).join("")}</ul>` : '<p class="muted">لا توجد مرفقات.</p>'}
            ${d.can.upload ? `<form class="mt" data-upload>${fileInput}<p class="form-err" hidden></p><button class="btn btn--ghost btn--sm" type="submit">رفع</button></form>` : ""}</section>
          <section class="card"><h2>التعليقات</h2>
            ${d.comments.length ? `<ul class="timeline">${d.comments.map((c) => `<li><b>${esc(c.user_name)}</b><small>${esc(fmt.dateTime(c.created_at))}</small><p>${esc(c.body)}</p></li>`).join("")}</ul>` : '<p class="muted">لا توجد تعليقات.</p>'}
            <form class="mt" data-comment novalidate>${AZ.field({ name: "body", label: "تعليق جديد", type: "textarea", rows: 2, max: 2000, required: true })}<p class="form-err" hidden></p><button class="btn btn--ghost btn--sm" type="submit">إضافة</button></form></section>
        </div>
        <aside>
          <section class="card"><h2>مسار الموافقة</h2><ol class="path-steps">${steps.map((s) => `<li class="ps--${s.state}"><b>${esc(s.def.name)}</b>
            ${s.inst.length ? s.inst.map((a) => `<small>${AZ.badge(L.step[a.status], L.stepTone[a.status])} ${esc(a.status === "pending" ? (a.approver_name || `أي ${L.role[a.approver_role] || a.approver_role}`) : (a.decided_by_name || ""))}${a.decided_at ? " · " + esc(fmt.dateTime(a.decided_at)) : a.due_at ? ` · الاستحقاق ${esc(fmt.dateTime(a.due_at))}` : ""}</small>${a.comment ? `<p>${esc(a.comment)}</p>` : ""}`).join("") : `<small class="muted">${esc(approverLabel(s.def.approver))} — لم تصل بعد</small>`}</li>`).join("")}</ol></section>
          ${d.can.cancel ? '<section class="card"><button class="btn btn--ghost btn--block" data-cancel>إلغاء الطلب</button></section>' : ""}
        </aside>
      </div>`;

    const reload = (m) => { if (m) AZ.toast(m); AZ.reload(); };
    const df = $("[data-decide]", main);
    if (df) df.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-d]");
      if (!b) return;
      if (b.dataset.d === "reject" && !(await AZ.confirm("رفض الطلب", "سيُرفض الطلب نهائيًا ويُبلَّغ مقدمه. متابعة؟", { submit: "رفض" }))) return;
      try { AZ.showErrors(df, null); await AZ.post(`/api/requests/${r.id}/decide`, { decision: b.dataset.d, comment: df.elements.comment.value }); reload({ approve: "تمت الموافقة", return: "أعيد الطلب للتعديل", reject: "تم رفض الطلب" }[b.dataset.d]); }
      catch (err) { AZ.showErrors(df, err); }
    });
    const rf = $("[data-resubmit]", main);
    if (rf) rf.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { AZ.showErrors(rf, null); await AZ.post(`/api/requests/${r.id}/resubmit`, { title: rf.elements.title.value, data: readData(rf) }); reload("تمت إعادة إرسال الطلب"); } catch (err) { AZ.showErrors(rf, err); }
    });
    const uf = $("[data-upload]", main);
    if (uf) uf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const files = [...$("#rq-files", uf).files];
      if (!files.length) return AZ.showErrors(uf, new AZ.ApiError(422, "اختر ملفًا أولًا"));
      try { AZ.showErrors(uf, null); await uploadAll(r.id, files); reload("تم رفع المرفقات"); } catch (err) { AZ.showErrors(uf, err); }
    });
    const cf = $("[data-comment]", main);
    cf.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { AZ.showErrors(cf, null); await AZ.post(`/api/requests/${r.id}/comments`, { body: cf.elements.body.value }); reload("تمت إضافة التعليق"); } catch (err) { AZ.showErrors(cf, err); }
    });
    main.addEventListener("click", async (e) => {
      const dl = e.target.closest("[data-dl]"), rm = e.target.closest("[data-rmfile]"), cn = e.target.closest("[data-cancel]");
      try {
        if (dl) await AZ.download(`/api/request-files/${dl.dataset.dl}/download`, dl.dataset.name);
        if (rm && (await AZ.confirm("حذف المرفق", "حذف هذا المرفق؟", { submit: "حذف" }))) { await AZ.del(`/api/request-files/${rm.dataset.rmfile}`); reload("تم حذف المرفق"); }
        if (cn && (await AZ.confirm("إلغاء الطلب", "إلغاء الطلب نهائيًا؟", { submit: "إلغاء الطلب" }))) { await AZ.post(`/api/requests/${r.id}/cancel`); reload("تم إلغاء الطلب"); }
      } catch (err) { AZ.fail(err); }
    });
  };

  /* ================= Request types (builder) ================= */
  const types = async (main) => {
    if (!AZ.can("types.manage")) throw new AZ.ApiError(403, "ليست لديك صلاحية لإدارة أنواع الطلبات");
    const list = (await AZ.get("/api/types?all=1")).items;
    await staff();
    main.innerHTML = `${head("أنواع الطلبات", "الحقول ومسار الموافقة لكل نوع", '<button class="btn btn--ghost" data-starter>تثبيت القوالب الجاهزة</button><button class="btn btn--primary" data-new>+ نوع جديد</button>')}
      ${AZ.table([{ label: "النوع", html: (t) => `<b>${esc(t.name)}</b><br><small class="muted">${esc(t.category || "")}</small>` }, { label: "الحقول", html: (t) => `${t.fields.length}` , cls: "num" },
        { label: "مسار الموافقة", html: (t) => esc(t.steps.map((s) => s.name).join(" ← ")) }, { label: "مدة الاستجابة", html: (t) => `${t.sla_hours} ساعة` },
        { label: "الطلبات", key: "requests", cls: "num" }, { label: "الحالة", html: (t) => t.is_active ? AZ.badge("مفعّل", "ok") : AZ.badge("موقوف") },
        { label: "", html: (t) => `<button class="btn btn--ghost btn--sm" data-edit="${t.id}">تعديل</button>` }], list, { empty: "لا توجد أنواع طلبات. ثبّت القوالب الجاهزة أو أنشئ نوعًا جديدًا." })}`;
    $("[data-new]", main).addEventListener("click", () => typeEditor(null));
    $("[data-starter]", main).addEventListener("click", async () => { try { const x = await AZ.post("/api/types/starter"); AZ.toast(x.added ? `أضيفت ${x.added} أنواع` : "القوالب مثبتة مسبقًا"); AZ.reload(); } catch (e) { AZ.fail(e); } });
    main.addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) typeEditor(list.find((t) => String(t.id) === b.dataset.edit)); });
  };

  const typeEditor = (t) => {
    const model = t ? JSON.parse(JSON.stringify(t)) : { name: "", description: "", category: "", sla_hours: 48, is_active: true, fields: [{ key: "details", label: "التفاصيل", type: "textarea", required: true }], steps: [{ name: "موافقة المدير المباشر", approver: "manager" }] };
    const approverOpts = [["manager", "المدير المباشر"], ["role:ADMIN", "أي مدير نظام"], ["role:MANAGER", "أي مدير"], ...(directory || []).map((u) => [`user:${u.id}`, `${u.name} (${L.role[u.role] || u.role})`])];
    const opt = (list, v) => list.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("");
    const rowsHtml = () => `
      <h3 class="mt">الحقول</h3><div class="rows" data-fields>${model.fields.map((f, i) => `<div class="row-edit" data-i="${i}">
        <input aria-label="عنوان الحقل" data-k="label" value="${esc(f.label)}" placeholder="عنوان الحقل" maxlength="80">
        <input aria-label="المفتاح" data-k="key" value="${esc(f.key)}" placeholder="key" dir="ltr" maxlength="40">
        <select aria-label="النوع" data-k="type">${opt(Object.entries(L.ftype), f.type)}</select>
        <label class="chk"><input type="checkbox" data-k="required"${f.required ? " checked" : ""}> مطلوب</label>
        <input aria-label="الخيارات" data-k="options" value="${esc((f.options || []).join("، "))}" placeholder="الخيارات مفصولة بفاصلة"${f.type === "select" ? "" : " hidden"}>
        <button type="button" class="icon-btn" data-rm-field="${i}" aria-label="حذف الحقل">✕</button></div>`).join("")}</div>
      <button type="button" class="btn btn--ghost btn--sm" data-add-field>+ حقل</button>
      <h3 class="mt">مسار الموافقة (بالترتيب)</h3><div class="rows" data-steps>${model.steps.map((s, i) => `<div class="row-edit row-edit--step" data-i="${i}">
        <span class="row-n">${i + 1}</span><input aria-label="اسم المرحلة" data-k="name" value="${esc(s.name)}" maxlength="80">
        <select aria-label="المعتمد" data-k="approver">${opt(approverOpts, s.approver)}</select>
        <button type="button" class="icon-btn" data-rm-step="${i}" aria-label="حذف المرحلة">✕</button></div>`).join("")}</div>
      <button type="button" class="btn btn--ghost btn--sm" data-add-step>+ مرحلة</button>
      <div class="fld" data-field="fields"><small class="err" hidden></small></div><div class="fld" data-field="steps"><small class="err" hidden></small></div>`;
    const collect = (form) => {
      const el = form.elements;
      model.name = el.name.value; model.category = el.category.value; model.description = el.description.value;
      model.sla_hours = Number(el.sla_hours.value); model.is_active = el.is_active.checked;
      model.fields = $$("[data-fields] .row-edit", form).map((row) => {
        const g = (k) => $(`[data-k="${k}"]`, row);
        const f = { key: g("key").value.trim(), label: g("label").value.trim(), type: g("type").value, required: g("required").checked };
        if (f.type === "select") f.options = g("options").value.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
        return f;
      });
      model.steps = $$("[data-steps] .row-edit", form).map((row) => ({ name: $('[data-k="name"]', row).value.trim(), approver: $('[data-k="approver"]', row).value }));
    };
    AZ.modal({
      title: t ? `تعديل «${t.name}»` : "نوع طلب جديد", submit: "حفظ", wide: true,
      body: `<div class="grid2">${AZ.field({ name: "name", label: "اسم النوع", required: true, value: model.name, max: 120 })}${AZ.field({ name: "category", label: "التصنيف", value: model.category, max: 80, placeholder: "مثال: الموارد البشرية" })}
        ${AZ.field({ name: "sla_hours", label: "مدة الاستجابة لكل مرحلة (ساعات)", type: "number", min: 1, value: model.sla_hours })}${AZ.field({ name: "is_active", label: "مفعّل", type: "checkbox", value: model.is_active })}</div>
        ${AZ.field({ name: "description", label: "الوصف", type: "textarea", rows: 2, value: model.description, max: 1000 })}
        ${t && t.requests ? `<p class="note">لهذا النوع ${t.requests} طلب سابق. التعديل يُطبق على الطلبات الجديدة فقط؛ الطلبات السابقة تحتفظ بحقولها ومسارها.</p>` : ""}
        <div data-rows>${rowsHtml()}</div>`,
      onOpen: (form) => {
        const rows = $("[data-rows]", form);
        const rerender = () => { rows.innerHTML = rowsHtml(); };
        rows.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          collect(form);
          if ("addField" in b.dataset) model.fields.push({ key: `field_${model.fields.length + 1}`, label: "", type: "text", required: false });
          else if ("addStep" in b.dataset) model.steps.push({ name: "", approver: "role:ADMIN" });
          else if (b.dataset.rmField) model.fields.splice(Number(b.dataset.rmField), 1);
          else if (b.dataset.rmStep) model.steps.splice(Number(b.dataset.rmStep), 1);
          else return;
          rerender();
        });
        rows.addEventListener("change", (e) => { if (e.target.dataset.k === "type") { const o = $('[data-k="options"]', e.target.closest(".row-edit")); o.hidden = e.target.value !== "select"; } });
      },
      onSubmit: async (_v, form) => {
        collect(form);
        const body = { ...model };
        delete body.id; delete body.requests;
        if (t) await AZ.api("PUT", `/api/types/${t.id}`, body); else await AZ.post("/api/types", body);
        AZ.toast("تم حفظ نوع الطلب");
        AZ.reload();
      },
    });
  };

  /* ================= People ================= */
  const people = async (main) => {
    const [r, users] = await Promise.all([AZ.get("/api/people"), AZ.get("/api/users")]);
    const manageable = users.manageable_roles;
    main.innerHTML = `${head("الموظفون", "الحسابات والأدوار والمدير المباشر (يُستخدم لتوجيه الموافقات)", '<button class="btn btn--primary" data-new>+ مستخدم</button>')}
      ${AZ.table([{ label: "الاسم", key: "name" }, { label: "البريد", html: (u) => `<span dir="ltr">${esc(u.email)}</span>` }, { label: "الدور", html: (u) => esc(L.role[u.role]) },
        { label: "القسم", html: (u) => esc(u.department || "—") }, { label: "المدير المباشر", html: (u) => esc(u.manager_name || "—") },
        { label: "الحالة", html: (u) => u.is_active ? AZ.badge("نشط", "ok") : AZ.badge("معطّل", "err") },
        { label: "", html: (u) => `<div class="actions"><button class="btn btn--ghost btn--sm" data-org="${u.id}">المدير والقسم</button>${u.id !== AZ.state.user.id ? `<button class="btn btn--ghost btn--sm" data-edit="${u.id}">الحساب</button><button class="btn btn--ghost btn--sm" data-reset="${u.id}">كلمة مرور مؤقتة</button>` : ""}</div>` }], r.items)}`;
    const roleOpts = manageable.map((x) => [x, L.role[x]]);
    $("[data-new]", main).addEventListener("click", () => AZ.modal({
      title: "مستخدم جديد", submit: "إنشاء", body: `${AZ.field({ name: "name", label: "الاسم", required: true })}${AZ.field({ name: "email", label: "البريد الإلكتروني", type: "email", required: true, dir: "ltr" })}${AZ.field({ name: "phone", label: "الجوال", type: "tel", dir: "ltr" })}${AZ.field({ name: "role", label: "الدور", type: "select", options: roleOpts, value: "EMPLOYEE" })}`,
      onSubmit: async (v) => { const x = await AZ.post("/api/users", v); directory = null; AZ.reload(); AZ.showSecret("تم إنشاء المستخدم", `كلمة المرور المؤقتة لـ ${x.user.email}:`, x.temporary_password); },
    }));
    main.addEventListener("click", async (e) => {
      const og = e.target.closest("[data-org]"), ed = e.target.closest("[data-edit]"), rs = e.target.closest("[data-reset]");
      const find = (id) => r.items.find((x) => String(x.id) === id);
      if (og) {
        const u = find(og.dataset.org);
        AZ.modal({ title: `المدير والقسم — ${u.name}`, submit: "حفظ", body: `${AZ.field({ name: "manager_id", label: "المدير المباشر", type: "select", options: [["", "بدون"], ...r.items.filter((x) => x.id !== u.id && x.is_active).map((x) => [x.id, x.name])], value: u.manager_id || "" })}${AZ.field({ name: "department", label: "القسم", value: u.department, max: 80 })}`,
          onSubmit: async (v) => { await AZ.patch(`/api/people/${u.id}`, { manager_id: v.manager_id ? Number(v.manager_id) : null, department: v.department }); AZ.toast("تم الحفظ"); AZ.reload(); } });
      }
      if (ed) {
        const u = find(ed.dataset.edit);
        AZ.modal({ title: "تعديل الحساب", submit: "حفظ", body: `${AZ.field({ name: "name", label: "الاسم", required: true, value: u.name })}${AZ.field({ name: "role", label: "الدور", type: "select", options: roleOpts, value: u.role })}${AZ.field({ name: "is_active", label: "الحساب نشط", type: "checkbox", value: u.is_active })}`,
          onSubmit: async (v) => { await AZ.patch(`/api/users/${u.id}`, v); directory = null; AZ.toast("تم الحفظ"); AZ.reload(); } });
      }
      if (rs) {
        const u = find(rs.dataset.reset);
        if (!(await AZ.confirm("كلمة مرور مؤقتة", `إنشاء كلمة مرور مؤقتة جديدة لـ ${u.name}؟ سيتم تسجيل خروجه من كل الأجهزة.`, { submit: "إنشاء", danger: false }))) return;
        try { const x = await AZ.post(`/api/users/${u.id}/reset-password`); AZ.showSecret("كلمة مرور مؤقتة", `كلمة المرور المؤقتة الجديدة لـ ${u.email}:`, x.temporary_password); } catch (err) { AZ.fail(err); }
      }
    });
  };

  /* ================= Reports & audit ================= */
  const reports = async (main) => {
    const state = { from: AZ.addDays(AZ.today(), -29), to: AZ.today() };
    main.innerHTML = `${head("التقارير", "حجم الطلبات وسرعة البت فيها")}
      <form class="filters">${AZ.field({ name: "from", label: "من", type: "date", value: state.from })}${AZ.field({ name: "to", label: "إلى", type: "date", value: state.to })}<div class="actions"><button class="btn btn--ghost" type="button" data-csv>تصدير CSV</button></div></form><div data-rep></div>`;
    const render = async () => {
      const r = await AZ.get("/api/reports/summary" + AZ.qs(state));
      const st = Object.fromEntries(r.by_status.map((x) => [x.status, x.n]));
      const m = Math.max(1, ...r.by_status.map((x) => x.n));
      $("[data-rep]", main).innerHTML = `<div class="stats">${AZ.stat("الطلبات", fmt.num(r.total))}${AZ.stat("معتمدة", fmt.num(st.approved || 0), { tone: "ok" })}${AZ.stat("مرفوضة", fmt.num(st.rejected || 0), { tone: st.rejected ? "err" : "" })}${AZ.stat("مفتوحة", fmt.num((st.pending || 0) + (st.returned || 0)))}${AZ.stat("متأخرة الآن", fmt.num(r.overdue.length), { tone: r.overdue.length ? "err" : "" })}</div>
        <div class="cols cols--2"><section class="card"><h2>حسب الحالة</h2>${r.by_status.length ? `<div class="bars-h">${r.by_status.map((x) => `<div><span>${esc(L.status[x.status])}</span>${AZ.progress((x.n / m) * 100)}<b>${x.n}</b></div>`).join("")}</div>` : '<div class="empty">لا توجد بيانات.</div>'}</section>
          <section class="card"><h2>المعتمدون</h2>${AZ.table([{ label: "الاسم", key: "name" }, { label: "قرارات", key: "decided", cls: "num" }, { label: "متوسط وقت القرار", html: (x) => x.avg_hours != null ? `${x.avg_hours} ساعة` : "—" }, { label: "بانتظاره", key: "pending", cls: "num" }], r.approvers, { empty: "لا توجد قرارات في الفترة." })}</section></div>
        <section class="card"><h2>حسب نوع الطلب</h2>${AZ.table([{ label: "النوع", key: "type_name" }, { label: "الإجمالي", key: "total", cls: "num" }, { label: "معتمد", key: "approved", cls: "num" }, { label: "مرفوض", key: "rejected", cls: "num" }, { label: "مفتوح", key: "open", cls: "num" }, { label: "متوسط مدة الإنجاز", html: (x) => x.avg_hours != null ? `${x.avg_hours} ساعة` : "—" }], r.by_type)}</section>
        <section class="card"><h2>طلبات متأخرة الآن</h2>${AZ.table([{ label: "رقم", html: (x) => `<a href="#/requests/${x.id}">#${x.number}</a>` }, { label: "العنوان", key: "title" }, { label: "المرحلة", key: "step_name" }, { label: "عند", html: (x) => esc(L.role[x.approver] || x.approver) }, { label: "الاستحقاق", html: (x) => esc(fmt.dateTime(x.step_due_at)) }], r.overdue, { empty: "لا توجد طلبات متأخرة." })}</section>`;
    };
    const f = $(".filters", main);
    f.addEventListener("change", () => { Object.assign(state, AZ.formValues(f)); render().catch(AZ.fail); });
    $("[data-csv]", main).addEventListener("click", () => AZ.download("/api/reports/export" + AZ.qs(state), "requests.csv").catch(AZ.fail));
    await render();
  };

  const auditView = async (main) => {
    const state = { action: "", entity: "", page: 1 };
    main.innerHTML = `${head("سجل التدقيق", "كل العمليات الحساسة مسجلة ولا يمكن تعديلها أو حذفها")}
      <form class="filters">${AZ.field({ name: "action", label: "الإجراء", type: "search", placeholder: "مثال: request.approve" })}
        ${AZ.field({ name: "entity", label: "الكيان", type: "select", options: [["", "الكل"], ["request", "طلب"], ["request_type", "نوع طلب"], ["request_file", "مرفق"], ["user", "مستخدم"], ["report", "تقرير"]] })}</form><div data-list></div>`;
    const render = async () => {
      const r = await AZ.get("/api/audit" + AZ.qs(state));
      $("[data-list]", main).innerHTML = AZ.table([{ label: "الوقت", html: (a) => esc(fmt.dateTime(a.created_at)) }, { label: "المستخدم", html: (a) => esc(a.user_name || "—") },
        { label: "الإجراء", html: (a) => `<code dir="ltr">${esc(a.action)}</code>` }, { label: "الكيان", html: (a) => esc(a.entity ? `${a.entity} #${a.entity_id ?? ""}` : "—") },
        { label: "تفاصيل", html: (a) => `<small class="muted" dir="ltr">${esc((a.meta || "").slice(0, 160))}</small>` }], r.items) + AZ.pager(r.total, r.page, r.size);
    };
    bindFilters(main, state, () => render().catch(AZ.fail));
    await render();
  };

  const search = async (q) => {
    const r = await AZ.get("/api/search" + AZ.qs({ q }));
    if (!r.requests.length) return '<p class="pad muted">لا توجد نتائج.</p>';
    return `<ul class="search-list">${r.requests.map((x) => `<li><a href="#/requests/${x.id}"><b>#${x.number} ${esc(x.title)}</b><small>${esc(x.type_name)} · ${esc(L.status[x.status])}</small></a></li>`).join("")}</ul>`;
  };

  AZ.start({
    app: "requests",
    title: "AZENK Requests",
    tagline: "الطلبات الداخلية والموافقات",
    home: "dashboard",
    roleLabels: L.role,
    search,
    searchPlaceholder: "ابحث برقم الطلب أو عنوانه…",
    nav: [
      { route: "dashboard", label: "الرئيسية", icon: "◧", perm: "dashboard.view" },
      { route: "new", label: "طلب جديد", icon: "+", perm: "requests.create" },
      { route: "requests", label: "الطلبات", icon: "▤", perm: "requests.create" },
      { route: "approvals", label: "الموافقات", icon: "✓", perm: "approvals.decide" },
      { route: "types", label: "أنواع الطلبات", icon: "⚙", perm: "types.manage" },
      { route: "people", label: "الموظفون", icon: "⚇", perm: "users.manage" },
      { route: "reports", label: "التقارير", icon: "▦", perm: "reports.view" },
      { route: "audit", label: "سجل التدقيق", icon: "⎙", perm: "audit.view" },
    ],
    routes: { dashboard, new: newPick, "new/:id": newForm, requests: requestsList, "requests/:id": requestView, approvals, types, people, reports, audit: auditView },
  });
})();
