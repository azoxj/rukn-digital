// AZENK Requests — internal requests with configurable multi-step approvals.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { created } from "../../core/http.js";
import { HttpError, notFound, forbidden, conflict } from "../../core/errors.js";
import { parse, schema, v } from "../../core/validate.js";
import { paging, likeTerm, toCsv, sendCsv } from "../../core/services.js";
import { tx, nowIso } from "../../core/db.js";
import { localToday, localDayStartIso, shiftDay } from "../../core/time.js";
import { createFileStore, MAX_FILE } from "../../core/files.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const EMPLOYEE = ["dashboard.view", "search", "requests.create", "approvals.decide", "files.upload"];
const MANAGER = [...EMPLOYEE, "requests.view_team"];
const ADMIN = [...MANAGER, "requests.view_all", "types.manage", "users.view", "users.manage", "audit.view", "reports.view"];
const ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"];

export const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox"];
export const STATUS = ["pending", "returned", "approved", "rejected", "cancelled"];
const OPEN = "('pending','returned')";

/** Starter request types (installed by seed or on demand by an admin). */
export const STARTER_TYPES = [
  {
    name: "طلب إجازة", category: "الموارد البشرية", description: "إجازة سنوية أو مرضية أو اضطرارية.", sla_hours: 24,
    fields: [
      { key: "leave_type", label: "نوع الإجازة", type: "select", required: true, options: ["سنوية", "مرضية", "اضطرارية", "بدون راتب"] },
      { key: "start_date", label: "من تاريخ", type: "date", required: true },
      { key: "end_date", label: "إلى تاريخ", type: "date", required: true },
      { key: "reason", label: "السبب", type: "textarea", required: false, max: 1000 },
    ],
    steps: [{ name: "موافقة المدير المباشر", approver: "manager" }, { name: "اعتماد الموارد البشرية", approver: "role:ADMIN" }],
  },
  {
    name: "طلب شراء", category: "المالية", description: "شراء مواد أو أجهزة أو خدمات.", sla_hours: 48,
    fields: [
      { key: "item", label: "الصنف أو الخدمة", type: "text", required: true, max: 200 },
      { key: "quantity", label: "الكمية", type: "number", required: true },
      { key: "estimated_cost", label: "التكلفة التقديرية (ريال)", type: "number", required: true },
      { key: "justification", label: "المبرر", type: "textarea", required: true, max: 2000 },
    ],
    steps: [{ name: "موافقة المدير المباشر", approver: "manager" }, { name: "اعتماد الإدارة", approver: "role:ADMIN" }],
  },
  {
    name: "طلب دعم تقني", category: "تقنية المعلومات", description: "أجهزة، حسابات، صلاحيات أو أعطال.", sla_hours: 8,
    fields: [
      { key: "issue_type", label: "النوع", type: "select", required: true, options: ["عطل جهاز", "حساب أو صلاحية", "برنامج", "شبكة", "أخرى"] },
      { key: "details", label: "التفاصيل", type: "textarea", required: true, max: 2000 },
      { key: "urgent", label: "عاجل (يوقف العمل)", type: "checkbox", required: false },
    ],
    steps: [{ name: "معالجة تقنية المعلومات", approver: "role:ADMIN" }],
  },
  {
    name: "خطاب تعريف", category: "الموارد البشرية", description: "خطاب تعريف بالراتب أو بدون راتب.", sla_hours: 24,
    fields: [
      { key: "addressed_to", label: "الجهة الموجّه إليها", type: "text", required: true, max: 200 },
      { key: "with_salary", label: "يتضمن الراتب", type: "checkbox", required: false },
    ],
    steps: [{ name: "اعتماد الموارد البشرية", approver: "role:ADMIN" }],
  },
];

export const requestsApp = {
  name: "requests",
  title: "AZENK Requests",
  roles: ROLES,
  permissions: { ADMIN, MANAGER, EMPLOYEE },
  manageRoles: { ADMIN: ["ADMIN", "MANAGER", "EMPLOYEE"] },
  tenants: false,
  migrationsDir: join(HERE, "migrations"),
  publicDir: join(HERE, "public"),
  routes,
};

const bad = (fields) => new HttpError(422, "بيانات غير صالحة", fields);

/* ---------------- request type definitions ---------------- */
export function validateTypeDef(input, { userExists }) {
  const b = parse(schema({
    name: v.string({ min: 2, max: 120 }),
    description: v.string({ max: 1000, optional: true, nullable: true }),
    category: v.string({ max: 80, optional: true, nullable: true }),
    sla_hours: v.int({ min: 1, max: 720, default: 48 }),
    is_active: v.bool({ default: true }),
    fields: v.array(v.object({
      key: v.string({ min: 1, max: 40, pattern: /^[a-z][a-z0-9_]*$/, message: "حروف إنجليزية صغيرة وأرقام و _ ويبدأ بحرف" }),
      label: v.string({ min: 1, max: 80 }),
      type: v.enum(FIELD_TYPES),
      required: v.bool({ default: false }),
      options: v.array(v.string({ min: 1, max: 80 }), { max: 30, optional: true }),
      max: v.int({ min: 1, max: 4000, optional: true }),
    }), { min: 1, max: 30 }),
    steps: v.array(v.object({
      name: v.string({ min: 2, max: 80 }),
      approver: v.string({ min: 1, max: 40, pattern: /^(manager|role:(ADMIN|MANAGER|EMPLOYEE)|user:\d+)$/, message: "المعتمد: المدير المباشر أو دور أو مستخدم" }),
    }), { min: 1, max: 6 }),
  }), input);
  const keys = new Set();
  for (const f of b.fields) {
    if (keys.has(f.key)) throw bad({ fields: `المفتاح «${f.key}» مكرر` });
    keys.add(f.key);
    if (f.type === "select" && !(f.options && f.options.length)) throw bad({ fields: `الحقل «${f.label}» من نوع قائمة ويحتاج خيارات` });
    if (f.type !== "select") delete f.options;
  }
  for (const s of b.steps) if (s.approver.startsWith("user:") && !userExists(Number(s.approver.slice(5)))) throw bad({ steps: `المعتمد في «${s.name}» غير موجود أو غير نشط` });
  return b;
}

/** Validate request data against a field list; returns clean data. */
export function validateData(fields, input) {
  const data = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = {}, errors = {};
  for (const f of fields) {
    let x = data[f.key];
    const empty = x === undefined || x === null || x === "" || (f.type === "checkbox" && x === false);
    if (f.type === "checkbox") { out[f.key] = x === true; if (f.required && !out[f.key]) errors[f.key] = "يجب التأشير على هذا الحقل"; continue; }
    if (empty) { if (f.required) errors[f.key] = "هذا الحقل مطلوب"; continue; }
    if (f.type === "number") {
      const n = typeof x === "string" ? Number(x) : x;
      if (typeof n !== "number" || !Number.isFinite(n)) { errors[f.key] = "رقم غير صحيح"; continue; }
      if (Math.abs(n) > 1e12) { errors[f.key] = "رقم كبير جدًا"; continue; }
      out[f.key] = n;
    } else if (f.type === "date") {
      if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x) || Number.isNaN(Date.parse(x + "T00:00:00Z"))) { errors[f.key] = "تاريخ غير صحيح"; continue; }
      out[f.key] = x;
    } else if (f.type === "select") {
      if (!f.options.includes(x)) { errors[f.key] = "اختيار غير مسموح"; continue; }
      out[f.key] = x;
    } else {
      if (typeof x !== "string") { errors[f.key] = "نص مطلوب"; continue; }
      x = x.trim();
      const max = f.max || (f.type === "textarea" ? 4000 : 500);
      if (x.length > max) { errors[f.key] = `الحد الأقصى ${max} حرف`; continue; }
      if (!x && f.required) { errors[f.key] = "هذا الحقل مطلوب"; continue; }
      out[f.key] = x;
    }
  }
  // Sensible cross-check for any start/end date pair.
  if (out.start_date && out.end_date && out.end_date < out.start_date) errors.end_date = "تاريخ النهاية قبل تاريخ البداية";
  if (Object.keys(errors).length) throw bad(Object.fromEntries(Object.entries(errors).map(([k, m]) => [`data.${k}`, m])));
  return out;
}

function routes(router, { db, audit, notify, can, dataDir }) {
  const org = (ctx) => ctx.user.org_id;
  const me = (ctx) => ctx.user.id;
  const store = createFileStore(dataDir);
  const link = (id) => `#/requests/${id}`;

  const activeUser = (orgId, id) => db.prepare("SELECT id, name, role FROM users WHERE id = ? AND org_id = ? AND is_active = 1").get(id, orgId);
  const managerOf = (userId) => db.prepare("SELECT manager_id FROM user_profiles WHERE user_id = ?").get(userId)?.manager_id ?? null;

  /* ---------------- type helpers ---------------- */
  const typeRow = (t) => t && { ...t, fields: JSON.parse(t.fields), steps: JSON.parse(t.steps), is_active: !!t.is_active };
  const typeOf = (ctx, id, { activeOnly = false } = {}) => {
    const t = db.prepare("SELECT * FROM request_types WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!t || (activeOnly && !t.is_active)) throw notFound("نوع الطلب");
    return typeRow(t);
  };
  const insertType = (orgId, userId, b) => db.prepare("INSERT INTO request_types (org_id, name, description, category, fields, steps, sla_hours, is_active, created_by) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(orgId, b.name, b.description ?? null, b.category ?? null, JSON.stringify(b.fields), JSON.stringify(b.steps), b.sla_hours, b.is_active === false ? 0 : 1, userId).lastInsertRowid;

  /* ---------------- workflow ---------------- */
  // Who approves step `def` of a request by `requesterId`. Never the requester:
  // a missing/self manager or self user falls back to any ADMIN.
  const resolveApprover = (orgId, requesterId, def) => {
    if (def.approver === "manager") {
      const m = managerOf(requesterId);
      if (m && m !== requesterId && activeUser(orgId, m)) return { user: m, role: null };
      return { user: null, role: "ADMIN" };
    }
    if (def.approver.startsWith("role:")) return { user: null, role: def.approver.slice(5) };
    const uid = Number(def.approver.slice(5));
    if (uid !== requesterId && activeUser(orgId, uid)) return { user: uid, role: null };
    return { user: null, role: "ADMIN" };
  };

  const notifyApprovers = (orgId, r, step, actorId) => {
    const msg = { type: "approval.pending", title: `طلب #${r.number} بانتظار موافقتك`, body: `${r.type_name}: ${r.title}`, link: link(r.id) };
    const ids = step.user ? [step.user] : db.prepare("SELECT id FROM users WHERE org_id = ? AND role = ? AND is_active = 1").all(orgId, step.role).map((x) => x.id);
    for (const id of ids) if (id !== r.requester_id) notify.send(orgId, id, msg, { skipUserId: actorId });
  };

  const activateStep = (orgId, r, index, actorId) => {
    const defs = JSON.parse(r.steps);
    const step = resolveApprover(orgId, r.requester_id, defs[index]);
    const due = new Date(Date.now() + r.sla_hours * 3600 * 1000).toISOString();
    db.prepare("INSERT INTO approval_steps (org_id, request_id, step_index, name, approver_user_id, approver_role, due_at) VALUES (?,?,?,?,?,?,?)")
      .run(orgId, r.id, index, defs[index].name, step.user, step.role, due);
    db.prepare("UPDATE requests SET current_step = ?, step_due_at = ?, status = 'pending', updated_at = ? WHERE id = ?").run(index, due, nowIso(), r.id);
    notifyApprovers(orgId, r, step, actorId);
  };

  const pendingStep = (rid) => db.prepare("SELECT * FROM approval_steps WHERE request_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(rid);
  const canDecide = (user, r, step) => !!step && r.status === "pending" && r.requester_id !== user.id && can(user, "approvals.decide")
    && (step.approver_user_id === user.id || (!step.approver_user_id && step.approver_role === user.role));

  const canView = (ctx, r) => {
    if (can(ctx.user, "requests.view_all") || r.requester_id === me(ctx)) return true;
    if (can(ctx.user, "requests.view_team") && managerOf(r.requester_id) === me(ctx)) return true;
    return !!db.prepare(`SELECT 1 FROM approval_steps WHERE request_id = ? AND (approver_user_id = ? OR decided_by = ? OR (approver_user_id IS NULL AND approver_role = ? AND status = 'pending'))`).get(r.id, me(ctx), me(ctx), ctx.user.role);
  };
  const requestOf = (ctx, id) => {
    const r = db.prepare("SELECT * FROM requests WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!r || !canView(ctx, r)) throw notFound("الطلب");
    return r;
  };
  const listRow = (r) => ({ ...r, fields: undefined, steps: undefined, data: undefined });

  /* ================= Request types ================= */
  router.get("/api/types", (ctx) => {
    const all = ctx.query.all === "1" && can(ctx.user, "types.manage");
    const rows = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM requests r WHERE r.type_id = t.id) AS requests FROM request_types t WHERE t.org_id = ? ${all ? "" : "AND t.is_active = 1"} ORDER BY t.category, t.name`).all(org(ctx));
    return { items: rows.map(typeRow) };
  });
  router.get("/api/types/:id", (ctx) => ({ type: typeOf(ctx, ctx.params.id, { activeOnly: !can(ctx.user, "types.manage") }) }));

  const userExists = (ctx) => (id) => !!activeUser(org(ctx), id);
  router.post("/api/types", { perm: "types.manage" }, (ctx) => {
    const b = validateTypeDef(ctx.body, { userExists: userExists(ctx) });
    if (db.prepare("SELECT 1 FROM request_types WHERE org_id = ? AND name = ?").get(org(ctx), b.name)) throw bad({ name: "يوجد نوع بنفس الاسم" });
    const id = insertType(org(ctx), me(ctx), b);
    audit.log(ctx, "type.create", "request_type", id, { name: b.name });
    return created({ type: typeOf(ctx, id) });
  });
  router.put("/api/types/:id", { perm: "types.manage" }, (ctx) => {
    const t = typeOf(ctx, ctx.params.id);
    const b = validateTypeDef(ctx.body, { userExists: userExists(ctx) });
    if (db.prepare("SELECT 1 FROM request_types WHERE org_id = ? AND name = ? AND id <> ?").get(org(ctx), b.name, t.id)) throw bad({ name: "يوجد نوع بنفس الاسم" });
    db.prepare("UPDATE request_types SET name = ?, description = ?, category = ?, fields = ?, steps = ?, sla_hours = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(b.name, b.description ?? null, b.category ?? null, JSON.stringify(b.fields), JSON.stringify(b.steps), b.sla_hours, b.is_active ? 1 : 0, nowIso(), t.id);
    audit.log(ctx, "type.update", "request_type", t.id, { name: b.name, active: b.is_active });
    return { type: typeOf(ctx, t.id) };
  });
  router.post("/api/types/starter", { perm: "types.manage" }, (ctx) => {
    const added = [];
    for (const st of STARTER_TYPES) {
      if (db.prepare("SELECT 1 FROM request_types WHERE org_id = ? AND name = ?").get(org(ctx), st.name)) continue;
      added.push(insertType(org(ctx), me(ctx), st));
    }
    audit.log(ctx, "type.install_starter", "request_type", null, { added: added.length });
    return { added: added.length };
  });

  /* ================= People (manager & department) ================= */
  router.get("/api/people", { perm: "users.view" }, (ctx) => ({
    items: db.prepare(`SELECT u.id, u.name, u.email, u.role, u.is_active, p.manager_id, p.department, m.name AS manager_name
      FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id LEFT JOIN users m ON m.id = p.manager_id WHERE u.org_id = ? ORDER BY u.name`).all(org(ctx)),
  }));
  router.patch("/api/people/:id", { perm: "users.manage" }, (ctx) => {
    const u = activeUser(org(ctx), Number(ctx.params.id)) || db.prepare("SELECT id FROM users WHERE id = ? AND org_id = ?").get(Number(ctx.params.id), org(ctx));
    if (!u) throw notFound("المستخدم");
    const b = parse(schema({ manager_id: v.int({ min: 1, nullable: true }), department: v.string({ max: 80, optional: true, nullable: true }) }), ctx.body, { partial: true });
    if (b.manager_id) {
      if (b.manager_id === u.id) throw bad({ manager_id: "لا يمكن أن يكون المستخدم مديرًا لنفسه" });
      if (!activeUser(org(ctx), b.manager_id)) throw bad({ manager_id: "المدير غير موجود أو غير نشط" });
      // Prevent cycles: walk up from the new manager.
      for (let cur = b.manager_id, i = 0; cur && i < 50; i++) {
        if (cur === u.id) throw bad({ manager_id: "هذا الاختيار ينشئ حلقة في التسلسل الإداري" });
        cur = managerOf(cur);
      }
    }
    const cur = db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").get(u.id);
    const manager = b.manager_id !== undefined ? b.manager_id : cur?.manager_id ?? null;
    const dept = b.department !== undefined ? b.department : cur?.department ?? null;
    db.prepare(`INSERT INTO user_profiles (user_id, org_id, manager_id, department, updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET manager_id = excluded.manager_id, department = excluded.department, updated_at = excluded.updated_at`).run(u.id, org(ctx), manager, dept, nowIso());
    audit.log(ctx, "profile.update", "user", u.id, { manager_id: manager, department: dept });
    return { ok: true };
  });

  /* ================= Requests ================= */
  router.get("/api/requests", (ctx) => {
    const { size, offset, page } = paging(ctx.query);
    const q = ctx.query;
    const scope = ["mine", "team", "all"].includes(q.scope) ? q.scope : "mine";
    const where = ["r.org_id = ?"], args = [org(ctx)];
    if (scope === "mine") { where.push("r.requester_id = ?"); args.push(me(ctx)); }
    else if (scope === "team") {
      if (!can(ctx.user, "requests.view_team")) throw forbidden();
      where.push("r.requester_id IN (SELECT user_id FROM user_profiles WHERE manager_id = ?)"); args.push(me(ctx));
    } else if (!can(ctx.user, "requests.view_all")) throw forbidden();
    if (q.status === "open") where.push(`r.status IN ${OPEN}`);
    else if (q.status && STATUS.includes(q.status)) { where.push("r.status = ?"); args.push(q.status); }
    if (q.type_id) { where.push("r.type_id = ?"); args.push(Number(q.type_id)); }
    if (q.overdue === "1") { where.push("r.status = 'pending' AND r.step_due_at < ?"); args.push(nowIso()); }
    if (q.q) {
      const raw = String(q.q).replace(/^#/, "");
      where.push("(r.title LIKE ? ESCAPE '\\' OR r.type_name LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR r.number = ?)");
      const t = likeTerm(q.q); args.push(t, t, t, /^\d+$/.test(raw) ? Number(raw) : -1);
    }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM requests r JOIN users u ON u.id = r.requester_id WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT r.*, u.name AS requester_name,
        (SELECT name FROM approval_steps s WHERE s.request_id = r.id AND s.status = 'pending' ORDER BY s.id DESC LIMIT 1) AS current_step_name
      FROM requests r JOIN users u ON u.id = r.requester_id WHERE ${w} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`).all(...args, size, offset).map(listRow);
    return { items, total, page, size };
  });

  router.get("/api/requests/:id", (ctx) => {
    const r = requestOf(ctx, ctx.params.id);
    const step = pendingStep(r.id);
    const isRequester = r.requester_id === me(ctx);
    return {
      request: { ...r, fields: JSON.parse(r.fields), steps: JSON.parse(r.steps), data: JSON.parse(r.data), requester_name: db.prepare("SELECT name FROM users WHERE id = ?").get(r.requester_id).name },
      approvals: db.prepare(`SELECT s.*, a.name AS approver_name, d.name AS decided_by_name FROM approval_steps s LEFT JOIN users a ON a.id = s.approver_user_id LEFT JOIN users d ON d.id = s.decided_by WHERE s.request_id = ? ORDER BY s.id`).all(r.id),
      comments: db.prepare("SELECT c.*, u.name AS user_name FROM request_comments c JOIN users u ON u.id = c.user_id WHERE c.request_id = ? ORDER BY c.id").all(r.id),
      files: db.prepare("SELECT f.id, f.original_name, f.mime, f.size, f.uploader_id, f.created_at, u.name AS uploader_name FROM request_files f JOIN users u ON u.id = f.uploader_id WHERE f.request_id = ? ORDER BY f.id").all(r.id),
      can: {
        decide: canDecide(ctx.user, r, step),
        resubmit: isRequester && r.status === "returned",
        cancel: isRequester && ["pending", "returned"].includes(r.status),
        upload: (isRequester && ["pending", "returned"].includes(r.status)) || canDecide(ctx.user, r, step),
      },
    };
  });

  router.post("/api/requests", { perm: "requests.create" }, (ctx) => {
    const b = parse(schema({ type_id: v.int({ min: 1 }) }), { type_id: ctx.body?.type_id });
    const t = typeOf(ctx, b.type_id, { activeOnly: true });
    // Report title and field errors together.
    let title, data, errors = {};
    try { title = parse(schema({ title: v.string({ min: 3, max: 200 }) }), { title: ctx.body?.title }).title; } catch (e) { errors = { ...errors, ...e.fields }; }
    try { data = validateData(t.fields, ctx.body?.data); } catch (e) { errors = { ...errors, ...e.fields }; }
    if (Object.keys(errors).length) throw bad(errors);
    b.title = title;
    const id = tx(db, () => {
      const number = db.prepare("SELECT COALESCE(MAX(number), 1000) + 1 AS n FROM requests WHERE org_id = ?").get(org(ctx)).n;
      const rid = db.prepare("INSERT INTO requests (org_id, number, type_id, type_name, fields, steps, requester_id, title, data, sla_hours) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(org(ctx), number, t.id, t.name, JSON.stringify(t.fields), JSON.stringify(t.steps), me(ctx), b.title, JSON.stringify(data), t.sla_hours).lastInsertRowid;
      activateStep(org(ctx), db.prepare("SELECT * FROM requests WHERE id = ?").get(rid), 0, me(ctx));
      return rid;
    });
    const r = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    audit.log(ctx, "request.create", "request", id, { number: r.number, type: t.name });
    return created({ request: listRow(r) });
  });

  router.post("/api/requests/:id/decide", { perm: "approvals.decide" }, (ctx) => {
    const r = requestOf(ctx, ctx.params.id);
    const b = parse(schema({ decision: v.enum(["approve", "reject", "return"]), comment: v.string({ max: 2000, optional: true, nullable: true }) }), ctx.body);
    const step = pendingStep(r.id);
    if (r.requester_id === me(ctx)) throw new HttpError(403, "لا يمكنك اعتماد طلبك بنفسك");
    if (!canDecide(ctx.user, r, step)) throw new HttpError(r.status === "pending" ? 403 : 409, r.status === "pending" ? "هذه الخطوة ليست مسندة إليك" : "الطلب ليس بانتظار قرار");
    if (b.decision !== "approve" && !b.comment) throw bad({ comment: b.decision === "reject" ? "اكتب سبب الرفض" : "اكتب المطلوب تعديله" });
    const steps = JSON.parse(r.steps);
    const now = nowIso();
    const status = { approve: "approved", reject: "rejected", return: "returned" }[b.decision];
    tx(db, () => {
      // Guard against a concurrent decision on the same step.
      const upd = db.prepare("UPDATE approval_steps SET status = ?, comment = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'").run(status, b.comment ?? null, me(ctx), now, step.id);
      if (!upd.changes) throw conflict("تم اتخاذ قرار على هذه الخطوة للتو، حدّث الصفحة");
      if (b.decision === "approve" && r.current_step + 1 < steps.length) activateStep(org(ctx), r, r.current_step + 1, me(ctx));
      else if (b.decision === "approve") db.prepare("UPDATE requests SET status = 'approved', decided_at = ?, step_due_at = NULL, updated_at = ? WHERE id = ?").run(now, now, r.id);
      else if (b.decision === "reject") db.prepare("UPDATE requests SET status = 'rejected', decided_at = ?, step_due_at = NULL, updated_at = ? WHERE id = ?").run(now, now, r.id);
      else db.prepare("UPDATE requests SET status = 'returned', step_due_at = NULL, updated_at = ? WHERE id = ?").run(now, r.id);
    });
    audit.log(ctx, `request.${b.decision}`, "request", r.id, { step: step.name });
    const after = db.prepare("SELECT * FROM requests WHERE id = ?").get(r.id);
    const titles = { approved: `تم اعتماد طلبك #${r.number}`, rejected: `تم رفض طلبك #${r.number}`, returned: `طلبك #${r.number} يحتاج تعديلًا`, pending: `تمت الموافقة على مرحلة «${step.name}» في طلبك #${r.number}` };
    notify.send(org(ctx), r.requester_id, { type: `request.${after.status}`, title: titles[after.status], body: b.comment ? b.comment.slice(0, 140) : r.title, link: link(r.id) }, { skipUserId: me(ctx) });
    return { request: listRow(after) };
  });

  router.post("/api/requests/:id/resubmit", { perm: "requests.create" }, (ctx) => {
    const r = requestOf(ctx, ctx.params.id);
    if (r.requester_id !== me(ctx)) throw forbidden();
    if (r.status !== "returned") throw conflict("يمكن إعادة الإرسال فقط للطلبات المعادة للتعديل");
    const title = ctx.body?.title !== undefined ? parse(schema({ title: v.string({ min: 3, max: 200 }) }), { title: ctx.body.title }).title : r.title;
    const data = validateData(JSON.parse(r.fields), ctx.body?.data);
    tx(db, () => {
      db.prepare("UPDATE requests SET title = ?, data = ?, updated_at = ? WHERE id = ?").run(title, JSON.stringify(data), nowIso(), r.id);
      activateStep(org(ctx), { ...r, title }, r.current_step, me(ctx));
    });
    audit.log(ctx, "request.resubmit", "request", r.id);
    return { request: listRow(db.prepare("SELECT * FROM requests WHERE id = ?").get(r.id)) };
  });

  router.post("/api/requests/:id/cancel", { perm: "requests.create" }, (ctx) => {
    const r = requestOf(ctx, ctx.params.id);
    if (r.requester_id !== me(ctx)) throw forbidden();
    if (!["pending", "returned"].includes(r.status)) throw conflict("لا يمكن إلغاء طلب تم البت فيه");
    tx(db, () => {
      db.prepare("UPDATE approval_steps SET status = 'cancelled', decided_at = ? WHERE request_id = ? AND status = 'pending'").run(nowIso(), r.id);
      db.prepare("UPDATE requests SET status = 'cancelled', step_due_at = NULL, decided_at = ?, updated_at = ? WHERE id = ?").run(nowIso(), nowIso(), r.id);
    });
    audit.log(ctx, "request.cancel", "request", r.id);
    return { ok: true };
  });

  router.post("/api/requests/:id/comments", (ctx) => {
    const r = requestOf(ctx, ctx.params.id);
    const b = parse(schema({ body: v.string({ min: 1, max: 2000 }) }), ctx.body);
    const id = db.prepare("INSERT INTO request_comments (org_id, request_id, user_id, body) VALUES (?,?,?,?)").run(org(ctx), r.id, me(ctx), b.body).lastInsertRowid;
    db.prepare("UPDATE requests SET updated_at = ? WHERE id = ?").run(nowIso(), r.id);
    audit.log(ctx, "request.comment", "request", r.id);
    const msg = { type: "request.comment", title: `تعليق جديد على الطلب #${r.number}`, body: b.body.slice(0, 140), link: link(r.id) };
    const to = new Set([r.requester_id]);
    const step = pendingStep(r.id);
    if (step && step.approver_user_id) to.add(step.approver_user_id);
    for (const uid of to) notify.send(org(ctx), uid, msg, { skipUserId: me(ctx) });
    return created({ comment: db.prepare("SELECT c.*, u.name AS user_name FROM request_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?").get(id) });
  });

  /* ---------------- attachments ---------------- */
  router.put("/api/requests/:id/files", { perm: "files.upload", raw: true, maxBytes: MAX_FILE }, (ctx) => {
    const r = requestOf(ctx, ctx.params.id);
    const isRequester = r.requester_id === me(ctx);
    if (!((isRequester && ["pending", "returned"].includes(r.status)) || canDecide(ctx.user, r, pendingStep(r.id)))) throw forbidden();
    if (db.prepare("SELECT COUNT(*) AS n FROM request_files WHERE request_id = ?").get(r.id).n >= 10) throw conflict("الحد الأقصى 10 مرفقات للطلب");
    const f = store.save(org(ctx), ctx.query.name, ctx.body);
    let id;
    try {
      id = db.prepare("INSERT INTO request_files (org_id, request_id, uploader_id, original_name, mime, size, sha256, storage_key) VALUES (?,?,?,?,?,?,?,?)")
        .run(org(ctx), r.id, me(ctx), f.name, f.mime, f.size, f.sha256, f.key).lastInsertRowid;
    } catch (e) { store.remove(f.key); throw e; }
    audit.log(ctx, "file.upload", "request_file", id, { request: r.id, name: f.name, size: f.size });
    return created({ file: { id, original_name: f.name, size: f.size, mime: f.mime } });
  });
  const fileOf = (ctx, id) => {
    const f = db.prepare("SELECT * FROM request_files WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!f) throw notFound("الملف");
    return { f, r: requestOf(ctx, f.request_id) };
  };
  router.get("/api/request-files/:id/download", (ctx) => {
    const { f } = fileOf(ctx, ctx.params.id);
    store.send(ctx.res, f);
    audit.log(ctx, "file.download", "request_file", f.id);
  });
  router.delete("/api/request-files/:id", { perm: "files.upload" }, (ctx) => {
    const { f, r } = fileOf(ctx, ctx.params.id);
    if (!(f.uploader_id === me(ctx) && ["pending", "returned"].includes(r.status)) && !can(ctx.user, "requests.view_all")) throw forbidden();
    db.prepare("DELETE FROM request_files WHERE id = ?").run(f.id);
    store.remove(f.storage_key);
    audit.log(ctx, "file.delete", "request_file", f.id, { name: f.original_name });
    return { ok: true };
  });

  /* ================= Approvals inbox ================= */
  router.get("/api/approvals", { perm: "approvals.decide" }, (ctx) => {
    const decided = ctx.query.status === "decided";
    const { size, offset, page } = paging(ctx.query);
    const where = decided
      ? ["s.org_id = ?", "s.decided_by = ?", "s.status IN ('approved','rejected','returned')"]
      : ["s.org_id = ?", "s.status = 'pending'", "r.requester_id <> ?", "(s.approver_user_id = ? OR (s.approver_user_id IS NULL AND s.approver_role = ?))"];
    const args = decided ? [org(ctx), me(ctx)] : [org(ctx), me(ctx), me(ctx), ctx.user.role];
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM approval_steps s JOIN requests r ON r.id = s.request_id WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT s.id AS step_id, s.name AS step_name, s.status AS step_status, s.due_at, s.decided_at, s.comment, r.id, r.number, r.title, r.type_name, r.status, r.created_at, u.name AS requester_name
      FROM approval_steps s JOIN requests r ON r.id = s.request_id JOIN users u ON u.id = r.requester_id WHERE ${w}
      ORDER BY ${decided ? "s.decided_at DESC" : "s.due_at ASC"} LIMIT ? OFFSET ?`).all(...args, size, offset);
    return { items, total, page, size };
  });

  /* ================= Dashboard ================= */
  router.get("/api/dashboard", { perm: "dashboard.view" }, (ctx) => {
    const now = nowIso();
    const inboxWhere = "s.org_id = ? AND s.status = 'pending' AND r.requester_id <> ? AND (s.approver_user_id = ? OR (s.approver_user_id IS NULL AND s.approver_role = ?))";
    const ia = [org(ctx), me(ctx), me(ctx), ctx.user.role];
    const inbox = db.prepare(`SELECT COUNT(*) AS n, SUM(s.due_at < ?) AS overdue FROM approval_steps s JOIN requests r ON r.id = s.request_id WHERE ${inboxWhere}`).get(now, ...ia);
    const mine = db.prepare(`SELECT SUM(status = 'pending') AS pending, SUM(status = 'returned') AS returned, SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected FROM requests WHERE org_id = ? AND requester_id = ?`).get(org(ctx), me(ctx));
    const inboxTop = db.prepare(`SELECT r.id, r.number, r.title, r.type_name, s.name AS step_name, s.due_at, u.name AS requester_name FROM approval_steps s JOIN requests r ON r.id = s.request_id JOIN users u ON u.id = r.requester_id WHERE ${inboxWhere} ORDER BY s.due_at LIMIT 6`).all(...ia);
    const recent = db.prepare(`SELECT id, number, title, type_name, status, updated_at FROM requests WHERE org_id = ? AND requester_id = ? ORDER BY updated_at DESC LIMIT 6`).all(org(ctx), me(ctx));
    const orgStats = can(ctx.user, "requests.view_all") ? db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'pending') AS pending, SUM(status = 'pending' AND step_due_at < ?) AS overdue, SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected FROM requests WHERE org_id = ?`).get(now, org(ctx)) : null;
    const z = (o) => o && Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x ?? 0]));
    return { inbox: z(inbox), mine: z(mine), inbox_top: inboxTop, recent, org: z(orgStats) };
  });

  /* ================= Reports ================= */
  const range = (q) => {
    const today = localToday();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || "") ? q.from : shiftDay(today, -29);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to || "") ? q.to : today;
    if (from > to) throw bad({ from: "تاريخ البداية بعد تاريخ النهاية" });
    return { from, to, start: localDayStartIso(from), end: localDayStartIso(to, 1) };
  };
  router.get("/api/reports/summary", { perm: "reports.view" }, (ctx) => {
    const r = range(ctx.query);
    const o = org(ctx);
    const byType = db.prepare(`SELECT type_name, COUNT(*) AS total, SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected, SUM(status IN ${OPEN}) AS open,
        ROUND(AVG(CASE WHEN status IN ('approved','rejected') THEN (julianday(decided_at) - julianday(created_at)) * 24 END), 1) AS avg_hours
      FROM requests WHERE org_id = ? AND created_at >= ? AND created_at < ? GROUP BY type_name ORDER BY total DESC`).all(o, r.start, r.end);
    const byStatus = db.prepare(`SELECT status, COUNT(*) AS n FROM requests WHERE org_id = ? AND created_at >= ? AND created_at < ? GROUP BY status`).all(o, r.start, r.end);
    const approvers = db.prepare(`SELECT u.id, u.name, u.role,
        (SELECT COUNT(*) FROM approval_steps s WHERE s.decided_by = u.id AND s.decided_at >= ? AND s.decided_at < ? AND s.status IN ('approved','rejected','returned')) AS decided,
        (SELECT ROUND(AVG((julianday(s.decided_at) - julianday(s.created_at)) * 24), 1) FROM approval_steps s WHERE s.decided_by = u.id AND s.decided_at >= ? AND s.decided_at < ? AND s.status IN ('approved','rejected','returned')) AS avg_hours,
        (SELECT COUNT(*) FROM approval_steps s JOIN requests q ON q.id = s.request_id WHERE s.status = 'pending' AND q.requester_id <> u.id AND (s.approver_user_id = u.id OR (s.approver_user_id IS NULL AND s.approver_role = u.role))) AS pending
      FROM users u WHERE u.org_id = ? AND u.is_active = 1 ORDER BY pending DESC, decided DESC`).all(r.start, r.end, r.start, r.end, o).filter((x) => x.decided || x.pending);
    const overdue = db.prepare(`SELECT r.id, r.number, r.title, r.type_name, r.step_due_at, s.name AS step_name, COALESCE(a.name, s.approver_role) AS approver FROM requests r
      JOIN approval_steps s ON s.request_id = r.id AND s.status = 'pending' LEFT JOIN users a ON a.id = s.approver_user_id
      WHERE r.org_id = ? AND r.status = 'pending' AND r.step_due_at < ? ORDER BY r.step_due_at`).all(o, nowIso());
    const total = byType.reduce((s, x) => s + x.total, 0);
    return { range: { from: r.from, to: r.to }, total, by_type: byType, by_status: byStatus, approvers, overdue };
  });
  router.get("/api/reports/export", { perm: "reports.view" }, (ctx) => {
    const r = range(ctx.query);
    const rows = db.prepare(`SELECT r.number, r.created_at, r.type_name, r.title, u.name AS requester, r.status, r.decided_at FROM requests r JOIN users u ON u.id = r.requester_id
      WHERE r.org_id = ? AND r.created_at >= ? AND r.created_at < ? ORDER BY r.number`).all(org(ctx), r.start, r.end);
    audit.log(ctx, "report.export", "report", "requests", { from: r.from, to: r.to });
    sendCsv(ctx.res, `azenk-requests-${r.from}-${r.to}.csv`, toCsv(["رقم", "تاريخ الإنشاء", "النوع", "العنوان", "مقدم الطلب", "الحالة", "تاريخ القرار"], rows.map((x) => [x.number, x.created_at, x.type_name, x.title, x.requester, x.status, x.decided_at])));
  });

  /* ================= Search ================= */
  router.get("/api/search", { perm: "search" }, (ctx) => {
    const raw = String(ctx.query.q || "").trim().slice(0, 100);
    if (raw.length < 2) return { requests: [] };
    const num = /^#?\d+$/.test(raw) ? Number(raw.replace("#", "")) : -1;
    const rows = db.prepare(`SELECT * FROM requests WHERE org_id = ? AND (title LIKE ? ESCAPE '\\' OR type_name LIKE ? ESCAPE '\\' OR number = ?) ORDER BY updated_at DESC LIMIT 40`)
      .all(org(ctx), likeTerm(raw), likeTerm(raw), num);
    return { requests: rows.filter((r) => canView(ctx, r)).slice(0, 8).map((r) => ({ id: r.id, number: r.number, title: r.title, type_name: r.type_name, status: r.status })) };
  });
}
