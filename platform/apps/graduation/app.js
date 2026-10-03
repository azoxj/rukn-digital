// AZENK Graduation — graduation-project management: projects, teams,
// milestones, tasks, files, supervisor feedback and rubric evaluations.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { created } from "../../core/http.js";
import { HttpError, notFound, forbidden, conflict } from "../../core/errors.js";
import { parse, schema, v } from "../../core/validate.js";
import { paging, likeTerm, toCsv, sendCsv } from "../../core/services.js";
import { tx, nowIso } from "../../core/db.js";
import { localToday } from "../../core/time.js";
import { createFileStore, MAX_FILE } from "../../core/files.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const STUDENT = ["dashboard.view", "search", "projects.view_own", "tasks.manage", "files.upload", "milestones.submit"];
const SUPERVISOR = ["dashboard.view", "search", "projects.view_supervised", "projects.update_supervised", "milestones.manage", "milestones.review", "tasks.manage", "files.upload", "feedback.write", "evaluations.write", "reports.view"];
const ADMIN = [...new Set([...SUPERVISOR, "projects.view_all", "projects.manage", "users.view", "users.manage", "audit.view"])];

export const PROJECT_STATUS = ["proposal", "approved", "in_progress", "submitted", "completed", "rejected"];
const ACTIVE = "('proposal','approved','in_progress','submitted')";
export const DEFAULT_MILESTONES = [
  ["مقترح المشروع", 10], ["تحليل المتطلبات", 15], ["التصميم", 20], ["التطوير", 30], ["الاختبار", 15], ["التسليم النهائي والعرض", 10],
];
export const DEFAULT_RUBRIC = [["فهم المشكلة والتحليل", 20], ["التصميم والمنهجية", 20], ["جودة التنفيذ", 30], ["التوثيق", 15], ["العرض والمناقشة", 15]];


export const graduationApp = {
  name: "graduation",
  title: "AZENK Graduation",
  roles: ["ADMIN", "SUPERVISOR", "STUDENT"],
  permissions: { ADMIN, SUPERVISOR, STUDENT },
  manageRoles: { ADMIN: ["ADMIN", "SUPERVISOR", "STUDENT"] },
  tenants: false,
  migrationsDir: join(HERE, "migrations"),
  publicDir: join(HERE, "public"),
  routes,
};

function routes(router, { db, audit, notify, can, dataDir }) {
  const org = (ctx) => ctx.user.org_id;
  const me = (ctx) => ctx.user.id;
  const store = createFileStore(dataDir);


  /* ---------------- access ---------------- */
  const isMember = (pid, uid) => !!db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?").get(pid, uid);
  /** 'admin' | 'supervisor' | 'member' | null */
  const accessOf = (ctx, p) => {
    if (can(ctx.user, "projects.view_all")) return "admin";
    if (p.supervisor_id === me(ctx) && can(ctx.user, "projects.view_supervised")) return "supervisor";
    if (can(ctx.user, "projects.view_own") && isMember(p.id, me(ctx))) return "member";
    return null;
  };
  const projectOf = (ctx, id) => {
    const p = db.prepare("SELECT * FROM projects WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    const access = p && accessOf(ctx, p);
    if (!access) throw notFound("المشروع");
    return { p, access };
  };
  const staffRole = (a) => a === "admin" || a === "supervisor";
  const membersOf = (pid) => db.prepare("SELECT m.user_id, m.team_role, u.name, u.email FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.team_role = 'leader' DESC, u.name").all(pid);
  const notifyTeam = (ctx, p, msg) => { for (const m of membersOf(p.id)) notify.send(org(ctx), m.user_id, msg, { skipUserId: me(ctx) }); };
  const userIn = (ctx, id, role, field) => {
    const u = db.prepare("SELECT id, name, role FROM users WHERE id = ? AND org_id = ? AND is_active = 1").get(Number(id), org(ctx));
    if (!u || (role && u.role !== role)) throw new HttpError(422, "بيانات غير صالحة", { [field]: role === "STUDENT" ? "يجب اختيار طالب نشط" : role === "SUPERVISOR" ? "يجب اختيار مشرف نشط" : "المستخدم غير موجود" });
    return u;
  };

  const progressOf = (pid) => {
    const m = db.prepare("SELECT COALESCE(SUM(weight), 0) AS total, COALESCE(SUM(CASE WHEN status = 'approved' THEN weight END), 0) AS done, COUNT(*) AS n, SUM(status = 'approved') AS approved FROM milestones WHERE project_id = ?").get(pid);
    const t = db.prepare("SELECT COUNT(*) AS n, SUM(status = 'done') AS done FROM tasks WHERE project_id = ?").get(pid);
    return {
      percent: m.total ? Math.round((m.done / m.total) * 100) : 0,
      milestones: { total: m.n, approved: m.approved ?? 0 },
      tasks: { total: t.n, done: t.done ?? 0, percent: t.n ? Math.round(((t.done ?? 0) / t.n) * 100) : 0 },
    };
  };

  const scopeWhere = (ctx, alias = "p") => {
    if (can(ctx.user, "projects.view_all")) return { sql: `${alias}.org_id = ?`, args: [org(ctx)] };
    if (can(ctx.user, "projects.view_supervised")) return { sql: `${alias}.org_id = ? AND ${alias}.supervisor_id = ?`, args: [org(ctx), me(ctx)] };
    return { sql: `${alias}.org_id = ? AND ${alias}.id IN (SELECT project_id FROM project_members WHERE user_id = ?)`, args: [org(ctx), me(ctx)] };
  };

  /* ================= Projects ================= */
  const projectCreate = schema({
    title: v.string({ min: 5, max: 200 }),
    description: v.string({ max: 5000, optional: true, nullable: true }),
    department: v.string({ max: 120, optional: true, nullable: true }),
    academic_year: v.string({ max: 20, optional: true, nullable: true }),
    supervisor_id: v.int({ min: 1, optional: true, nullable: true }),
    start_date: v.date({ optional: true, nullable: true }),
    due_date: v.date({ optional: true, nullable: true }),
    members: v.array(v.object({ user_id: v.int({ min: 1 }), team_role: v.enum(["leader", "member"], { default: "member" }) }), { max: 8, optional: true }),
    default_milestones: v.bool({ default: true }),
  });
  const projectPatch = schema({
    title: v.string({ min: 5, max: 200 }),
    description: v.string({ max: 5000, optional: true, nullable: true }),
    department: v.string({ max: 120, optional: true, nullable: true }),
    academic_year: v.string({ max: 20, optional: true, nullable: true }),
    supervisor_id: v.int({ min: 1, nullable: true }),
    status: v.enum(PROJECT_STATUS),
    start_date: v.date({ optional: true, nullable: true }),
    due_date: v.date({ optional: true, nullable: true }),
  });

  const checkStudentFree = (ctx, uid, exceptProject) => {
    const other = db.prepare(`SELECT p.title FROM project_members m JOIN projects p ON p.id = m.project_id WHERE m.user_id = ? AND p.status IN ${ACTIVE} AND p.id <> ?`).get(uid, exceptProject || 0);
    if (other) throw new HttpError(409, `الطالب مسجّل في مشروع نشط آخر: ${other.title}`);
  };

  router.get("/api/projects", { perm: ["projects.view_all", "projects.view_supervised", "projects.view_own"] }, (ctx) => {
    const { size, offset, page } = paging(ctx.query);
    const q = ctx.query;
    const s = scopeWhere(ctx);
    const where = [s.sql], args = [...s.args];
    if (q.status === "active") where.push(`p.status IN ${ACTIVE}`);
    else if (q.status && PROJECT_STATUS.includes(q.status)) { where.push("p.status = ?"); args.push(q.status); }
    if (q.supervisor_id === "none") where.push("p.supervisor_id IS NULL");
    else if (q.supervisor_id) { where.push("p.supervisor_id = ?"); args.push(Number(q.supervisor_id)); }
    if (q.department) { where.push("p.department = ?"); args.push(String(q.department)); }
    if (q.year) { where.push("p.academic_year = ?"); args.push(String(q.year)); }
    if (q.q) { const t = likeTerm(q.q); where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = p.id AND u.name LIKE ? ESCAPE '\\'))"); args.push(t, t, t); }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM projects p WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT p.*, s.name AS supervisor_name, (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS members
      FROM projects p LEFT JOIN users s ON s.id = p.supervisor_id WHERE ${w} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`).all(...args, size, offset)
      .map((p) => ({ ...p, progress: progressOf(p.id).percent }));
    const filters = {
      departments: db.prepare("SELECT DISTINCT department FROM projects WHERE org_id = ? AND department IS NOT NULL ORDER BY department").all(org(ctx)).map((r) => r.department),
      years: db.prepare("SELECT DISTINCT academic_year FROM projects WHERE org_id = ? AND academic_year IS NOT NULL ORDER BY academic_year DESC").all(org(ctx)).map((r) => r.academic_year),
    };
    return { items, total, page, size, filters };
  });

  router.post("/api/projects", { perm: "projects.manage" }, (ctx) => {
    const b = parse(projectCreate, ctx.body);
    if (b.supervisor_id) userIn(ctx, b.supervisor_id, "SUPERVISOR", "supervisor_id");
    if (b.start_date && b.due_date && b.due_date < b.start_date) throw new HttpError(422, "بيانات غير صالحة", { due_date: "تاريخ التسليم قبل تاريخ البداية" });
    const members = b.members || [];
    if (new Set(members.map((m) => m.user_id)).size !== members.length) throw new HttpError(422, "بيانات غير صالحة", { members: "عضو مكرر" });
    if (members.filter((m) => m.team_role === "leader").length > 1) throw new HttpError(422, "بيانات غير صالحة", { members: "قائد واحد فقط للفريق" });
    for (const m of members) { userIn(ctx, m.user_id, "STUDENT", "members"); checkStudentFree(ctx, m.user_id); }
    const id = tx(db, () => {
      const pid = db.prepare(`INSERT INTO projects (org_id, title, description, department, academic_year, supervisor_id, start_date, due_date, created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(org(ctx), b.title, b.description ?? null, b.department ?? null, b.academic_year ?? null, b.supervisor_id ?? null, b.start_date ?? null, b.due_date ?? null, me(ctx)).lastInsertRowid;
      for (const m of members) db.prepare("INSERT INTO project_members (project_id, user_id, org_id, team_role) VALUES (?,?,?,?)").run(pid, m.user_id, org(ctx), m.team_role);
      if (b.default_milestones) DEFAULT_MILESTONES.forEach(([title, weight], i) => db.prepare("INSERT INTO milestones (org_id, project_id, title, weight, position) VALUES (?,?,?,?,?)").run(org(ctx), pid, title, weight, i + 1));
      return pid;
    });
    audit.log(ctx, "project.create", "project", id, { members: members.length });
    const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    if (p.supervisor_id) notify.send(org(ctx), p.supervisor_id, { type: "project.supervisor", title: "أُسند إليك الإشراف على مشروع", body: p.title, link: `#/projects/${id}` }, { skipUserId: me(ctx) });
    notifyTeam(ctx, p, { type: "project.member", title: "أُضفت إلى فريق مشروع تخرج", body: p.title, link: `#/projects/${id}` });
    return created({ project: p });
  });

  router.get("/api/projects/:id", { perm: ["projects.view_all", "projects.view_supervised", "projects.view_own"] }, (ctx) => {
    const { p, access } = projectOf(ctx, ctx.params.id);
    const supervisor = p.supervisor_id ? db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(p.supervisor_id) : null;
    return {
      project: p, access, supervisor,
      members: membersOf(p.id),
      milestones: db.prepare("SELECT m.*, (SELECT COUNT(*) FROM files f WHERE f.milestone_id = m.id) AS files FROM milestones m WHERE m.project_id = ? ORDER BY m.position, m.id").all(p.id),
      tasks: db.prepare("SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.project_id = ? ORDER BY t.status = 'done', t.due_date IS NULL, t.due_date, t.id").all(p.id),
      files: db.prepare("SELECT f.id, f.original_name, f.mime, f.size, f.milestone_id, f.created_at, f.uploader_id, u.name AS uploader_name FROM files f JOIN users u ON u.id = f.uploader_id WHERE f.project_id = ? ORDER BY f.id DESC").all(p.id),
      feedback: db.prepare("SELECT f.*, u.name AS author_name, m.title AS milestone_title FROM feedback f JOIN users u ON u.id = f.author_id LEFT JOIN milestones m ON m.id = f.milestone_id WHERE f.project_id = ? ORDER BY f.id DESC").all(p.id),
      evaluations: db.prepare("SELECT e.*, u.name AS evaluator_name FROM evaluations e JOIN users u ON u.id = e.evaluator_id WHERE e.project_id = ? ORDER BY e.id DESC").all(p.id).map((e) => ({ ...e, criteria: JSON.parse(e.criteria) })),
      progress: progressOf(p.id),
      rubric: DEFAULT_RUBRIC.map(([name, max]) => ({ name, max })),
    };
  });

  router.patch("/api/projects/:id", { perm: ["projects.manage", "projects.update_supervised"] }, (ctx) => {
    const { p, access } = projectOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    const b = parse(projectPatch, ctx.body, { partial: true });
    if (access === "supervisor") {
      const allowed = ["status", "description", "due_date"];
      if (Object.keys(b).some((k) => !allowed.includes(k))) throw forbidden();
    }
    if (b.supervisor_id) userIn(ctx, b.supervisor_id, "SUPERVISOR", "supervisor_id");
    const start = b.start_date !== undefined ? b.start_date : p.start_date, due = b.due_date !== undefined ? b.due_date : p.due_date;
    if (start && due && due < start) throw new HttpError(422, "بيانات غير صالحة", { due_date: "تاريخ التسليم قبل تاريخ البداية" });
    const cols = Object.keys(b);
    if (!cols.length) return { project: p };
    db.prepare(`UPDATE projects SET ${cols.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...cols.map((k) => b[k] ?? null), nowIso(), p.id);
    audit.log(ctx, "project.update", "project", p.id, b);
    const link = `#/projects/${p.id}`;
    if (b.status && b.status !== p.status) notifyTeam(ctx, p, { type: "project.status", title: "تغيّرت حالة مشروعك", body: `${p.title}: ${b.status}`, link });
    if (b.supervisor_id && b.supervisor_id !== p.supervisor_id) notify.send(org(ctx), b.supervisor_id, { type: "project.supervisor", title: "أُسند إليك الإشراف على مشروع", body: p.title, link }, { skipUserId: me(ctx) });
    return { project: db.prepare("SELECT * FROM projects WHERE id = ?").get(p.id) };
  });

  router.delete("/api/projects/:id", { perm: "projects.manage" }, (ctx) => {
    const { p } = projectOf(ctx, ctx.params.id);
    const used = db.prepare("SELECT (SELECT COUNT(*) FROM files WHERE project_id = ?) + (SELECT COUNT(*) FROM evaluations WHERE project_id = ?) AS n").get(p.id, p.id).n;
    if (used) throw conflict("لا يمكن حذف مشروع لديه ملفات أو تقييمات — غيّر حالته إلى مرفوض أو مكتمل بدلًا من ذلك");
    db.prepare("DELETE FROM projects WHERE id = ?").run(p.id);
    audit.log(ctx, "project.delete", "project", p.id, { title: p.title });
    return { ok: true };
  });

  /* ---------------- team ---------------- */
  router.post("/api/projects/:id/members", { perm: "projects.manage" }, (ctx) => {
    const { p } = projectOf(ctx, ctx.params.id);
    const b = parse(schema({ user_id: v.int({ min: 1 }), team_role: v.enum(["leader", "member"], { default: "member" }) }), ctx.body);
    userIn(ctx, b.user_id, "STUDENT", "user_id");
    if (isMember(p.id, b.user_id)) throw conflict("الطالب عضو في الفريق مسبقًا");
    checkStudentFree(ctx, b.user_id, p.id);
    if (db.prepare("SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?").get(p.id).n >= 8) throw conflict("الحد الأقصى 8 أعضاء للفريق");
    tx(db, () => {
      if (b.team_role === "leader") db.prepare("UPDATE project_members SET team_role = 'member' WHERE project_id = ?").run(p.id);
      db.prepare("INSERT INTO project_members (project_id, user_id, org_id, team_role) VALUES (?,?,?,?)").run(p.id, b.user_id, org(ctx), b.team_role);
    });
    audit.log(ctx, "project.member_add", "project", p.id, b);
    notify.send(org(ctx), b.user_id, { type: "project.member", title: "أُضفت إلى فريق مشروع تخرج", body: p.title, link: `#/projects/${p.id}` }, { skipUserId: me(ctx) });
    return created({ members: membersOf(p.id) });
  });

  router.delete("/api/projects/:id/members/:userId", { perm: "projects.manage" }, (ctx) => {
    const { p } = projectOf(ctx, ctx.params.id);
    const r = db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(p.id, Number(ctx.params.userId));
    if (!r.changes) throw notFound("العضو");
    db.prepare("UPDATE tasks SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ?").run(p.id, Number(ctx.params.userId));
    audit.log(ctx, "project.member_remove", "project", p.id, { user_id: Number(ctx.params.userId) });
    return { members: membersOf(p.id) };
  });

  /* ================= Milestones ================= */
  const msSchema = schema({
    title: v.string({ min: 2, max: 200 }),
    description: v.string({ max: 3000, optional: true, nullable: true }),
    due_date: v.date({ optional: true, nullable: true }),
    weight: v.int({ min: 1, max: 100, default: 10 }),
    position: v.int({ min: 0, max: 1000, optional: true }),
  });
  const milestoneOf = (ctx, id) => {
    const m = db.prepare("SELECT * FROM milestones WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!m) throw notFound("المرحلة");
    const { p, access } = projectOf(ctx, m.project_id);
    return { m, p, access };
  };

  router.post("/api/projects/:id/milestones", { perm: "milestones.manage" }, (ctx) => {
    const { p, access } = projectOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    const b = parse(msSchema, ctx.body);
    const pos = b.position ?? (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM milestones WHERE project_id = ?").get(p.id).n);
    const r = db.prepare("INSERT INTO milestones (org_id, project_id, title, description, due_date, weight, position) VALUES (?,?,?,?,?,?,?)").run(org(ctx), p.id, b.title, b.description ?? null, b.due_date ?? null, b.weight, pos);
    audit.log(ctx, "milestone.create", "milestone", r.lastInsertRowid, { project: p.id });
    notifyTeam(ctx, p, { type: "milestone.new", title: "مرحلة جديدة في مشروعك", body: b.title, link: `#/projects/${p.id}` });
    return created({ milestone: db.prepare("SELECT * FROM milestones WHERE id = ?").get(r.lastInsertRowid) });
  });

  router.patch("/api/milestones/:id", { perm: "milestones.manage" }, (ctx) => {
    const { m, access } = milestoneOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    const b = parse(msSchema, ctx.body, { partial: true });
    const cols = Object.keys(b);
    if (cols.length) db.prepare(`UPDATE milestones SET ${cols.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(...cols.map((k) => b[k] ?? null), m.id);
    audit.log(ctx, "milestone.update", "milestone", m.id, { fields: cols });
    return { milestone: db.prepare("SELECT * FROM milestones WHERE id = ?").get(m.id) };
  });

  router.delete("/api/milestones/:id", { perm: "milestones.manage" }, (ctx) => {
    const { m, access } = milestoneOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    if (db.prepare("SELECT COUNT(*) AS n FROM files WHERE milestone_id = ?").get(m.id).n) throw conflict("لا يمكن حذف مرحلة مرفق بها ملفات");
    db.prepare("DELETE FROM milestones WHERE id = ?").run(m.id);
    audit.log(ctx, "milestone.delete", "milestone", m.id, { title: m.title });
    return { ok: true };
  });

  router.post("/api/milestones/:id/submit", { perm: "milestones.submit" }, (ctx) => {
    const { m, p, access } = milestoneOf(ctx, ctx.params.id);
    if (access !== "member") throw forbidden();
    if (!["pending", "needs_changes"].includes(m.status)) throw conflict("المرحلة مُسلَّمة أو معتمدة مسبقًا");
    const b = parse(schema({ note: v.string({ max: 2000, optional: true, nullable: true }) }), ctx.body);
    tx(db, () => {
      db.prepare("UPDATE milestones SET status = 'submitted', submitted_at = ? WHERE id = ?").run(nowIso(), m.id);
      if (b.note) db.prepare("INSERT INTO feedback (org_id, project_id, milestone_id, author_id, kind, body) VALUES (?,?,?,?,?,?)").run(org(ctx), p.id, m.id, me(ctx), "comment", b.note);
      db.prepare("UPDATE projects SET updated_at = ?, status = CASE WHEN status = 'approved' THEN 'in_progress' ELSE status END WHERE id = ?").run(nowIso(), p.id);
    });
    audit.log(ctx, "milestone.submit", "milestone", m.id);
    notify.send(org(ctx), p.supervisor_id, { type: "milestone.submitted", title: "مرحلة بانتظار مراجعتك", body: `${p.title} — ${m.title}`, link: `#/projects/${p.id}` }, { skipUserId: me(ctx) });
    return { milestone: db.prepare("SELECT * FROM milestones WHERE id = ?").get(m.id) };
  });

  router.post("/api/milestones/:id/review", { perm: "milestones.review" }, (ctx) => {
    const { m, p, access } = milestoneOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    const b = parse(schema({ decision: v.enum(["approved", "needs_changes"]), comment: v.string({ max: 4000, optional: true, nullable: true }) }), ctx.body);
    if (b.decision === "needs_changes" && !b.comment) throw new HttpError(422, "بيانات غير صالحة", { comment: "اكتب الملاحظات المطلوب تعديلها" });
    if (m.status === "pending" && b.decision === "needs_changes") throw conflict("لم يُسلّم الطلاب هذه المرحلة بعد");
    tx(db, () => {
      db.prepare("UPDATE milestones SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(b.decision, nowIso(), me(ctx), m.id);
      db.prepare("INSERT INTO feedback (org_id, project_id, milestone_id, author_id, kind, body) VALUES (?,?,?,?,?,?)").run(org(ctx), p.id, m.id, me(ctx), b.decision, b.comment || (b.decision === "approved" ? "تم اعتماد المرحلة." : ""));
      db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), p.id);
    });
    audit.log(ctx, "milestone.review", "milestone", m.id, { decision: b.decision });
    notifyTeam(ctx, p, { type: "milestone.reviewed", title: b.decision === "approved" ? "تم اعتماد مرحلة" : "مرحلة تحتاج تعديلات", body: `${m.title}${b.comment ? " — " + b.comment.slice(0, 120) : ""}`, link: `#/projects/${p.id}` });
    return { milestone: db.prepare("SELECT * FROM milestones WHERE id = ?").get(m.id), progress: progressOf(p.id) };
  });

  /* ================= Tasks ================= */
  const taskSchema = schema({
    title: v.string({ min: 2, max: 200 }),
    description: v.string({ max: 3000, optional: true, nullable: true }),
    milestone_id: v.int({ min: 1, optional: true, nullable: true }),
    assignee_id: v.int({ min: 1, optional: true, nullable: true }),
    status: v.enum(["todo", "in_progress", "done"], { default: "todo" }),
    due_date: v.date({ optional: true, nullable: true }),
  });
  const checkTaskRefs = (p, b) => {
    if (b.milestone_id && !db.prepare("SELECT 1 FROM milestones WHERE id = ? AND project_id = ?").get(b.milestone_id, p.id)) throw new HttpError(422, "بيانات غير صالحة", { milestone_id: "المرحلة لا تتبع هذا المشروع" });
    if (b.assignee_id && !isMember(p.id, b.assignee_id)) throw new HttpError(422, "بيانات غير صالحة", { assignee_id: "يجب أن يكون المسؤول من أعضاء الفريق" });
  };
  const taskOf = (ctx, id) => {
    const t = db.prepare("SELECT * FROM tasks WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!t) throw notFound("المهمة");
    return { t, ...projectOf(ctx, t.project_id) };
  };

  router.post("/api/projects/:id/tasks", { perm: "tasks.manage" }, (ctx) => {
    const { p } = projectOf(ctx, ctx.params.id);
    const b = parse(taskSchema, ctx.body);
    checkTaskRefs(p, b);
    const r = db.prepare("INSERT INTO tasks (org_id, project_id, milestone_id, title, description, assignee_id, status, due_date, created_by, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(org(ctx), p.id, b.milestone_id ?? null, b.title, b.description ?? null, b.assignee_id ?? null, b.status, b.due_date ?? null, me(ctx), b.status === "done" ? nowIso() : null);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), p.id);
    audit.log(ctx, "task.create", "task", r.lastInsertRowid, { project: p.id });
    if (b.assignee_id) notify.send(org(ctx), b.assignee_id, { type: "task.assigned", title: "مهمة جديدة مسندة إليك", body: b.title, link: `#/projects/${p.id}` }, { skipUserId: me(ctx) });
    return created({ task: db.prepare("SELECT * FROM tasks WHERE id = ?").get(r.lastInsertRowid) });
  });

  router.patch("/api/tasks/:id", { perm: "tasks.manage" }, (ctx) => {
    const { t, p } = taskOf(ctx, ctx.params.id);
    const b = parse(taskSchema, ctx.body, { partial: true });
    checkTaskRefs(p, b);
    const cols = Object.keys(b);
    if (!cols.length) return { task: t };
    const sets = cols.map((k) => `${k} = ?`), vals = cols.map((k) => b[k] ?? null);
    if (b.status) { sets.push("completed_at = ?"); vals.push(b.status === "done" ? (t.completed_at || nowIso()) : null); }
    db.prepare(`UPDATE tasks SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), t.id);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), p.id);
    audit.log(ctx, "task.update", "task", t.id, { fields: cols, status: b.status });
    if (b.assignee_id && b.assignee_id !== t.assignee_id) notify.send(org(ctx), b.assignee_id, { type: "task.assigned", title: "مهمة جديدة مسندة إليك", body: b.title || t.title, link: `#/projects/${p.id}` }, { skipUserId: me(ctx) });
    return { task: db.prepare("SELECT * FROM tasks WHERE id = ?").get(t.id) };
  });

  router.delete("/api/tasks/:id", { perm: "tasks.manage" }, (ctx) => {
    const { t, access } = taskOf(ctx, ctx.params.id);
    if (!staffRole(access) && t.created_by !== me(ctx)) throw forbidden();
    db.prepare("DELETE FROM tasks WHERE id = ?").run(t.id);
    audit.log(ctx, "task.delete", "task", t.id, { title: t.title });
    return { ok: true };
  });

  router.get("/api/my-tasks", { perm: "tasks.manage" }, (ctx) => {
    const s = scopeWhere(ctx);
    const items = db.prepare(`SELECT t.*, p.title AS project_title FROM tasks t JOIN projects p ON p.id = t.project_id
      WHERE ${s.sql} AND t.assignee_id = ? AND t.status <> 'done' ORDER BY t.due_date IS NULL, t.due_date LIMIT 100`).all(...s.args, me(ctx));
    return { items };
  });

  /* ================= Files ================= */
  router.put("/api/projects/:id/files", { perm: "files.upload", raw: true, maxBytes: MAX_FILE }, (ctx) => {
    const { p } = projectOf(ctx, ctx.params.id);
    const milestoneId = ctx.query.milestone_id ? Number(ctx.query.milestone_id) : null;
    if (milestoneId && !db.prepare("SELECT 1 FROM milestones WHERE id = ? AND project_id = ?").get(milestoneId, p.id)) throw new HttpError(422, "بيانات غير صالحة", { milestone_id: "المرحلة لا تتبع هذا المشروع" });
    const f = store.save(org(ctx), ctx.query.name, ctx.body);
    let id;
    try {
      id = db.prepare("INSERT INTO files (org_id, project_id, milestone_id, uploader_id, original_name, mime, size, sha256, storage_key) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(org(ctx), p.id, milestoneId, me(ctx), f.name, f.mime, f.size, f.sha256, f.key).lastInsertRowid;
    } catch (e) { store.remove(f.key); throw e; }
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), p.id);
    audit.log(ctx, "file.upload", "file", id, { project: p.id, name: f.name, size: f.size });
    return created({ file: db.prepare("SELECT id, original_name, mime, size, milestone_id, created_at FROM files WHERE id = ?").get(id) });
  });

  const fileOf = (ctx, id) => {
    const f = db.prepare("SELECT * FROM files WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!f) throw notFound("الملف");
    return { f, ...projectOf(ctx, f.project_id) };
  };

  router.get("/api/files/:id/download", (ctx) => {
    const { f } = fileOf(ctx, ctx.params.id);
    store.send(ctx.res, f);
    audit.log(ctx, "file.download", "file", f.id);
  });

  router.delete("/api/files/:id", { perm: "files.upload" }, (ctx) => {
    const { f, access } = fileOf(ctx, ctx.params.id);
    if (!staffRole(access) && f.uploader_id !== me(ctx)) throw forbidden();
    db.prepare("DELETE FROM files WHERE id = ?").run(f.id);
    store.remove(f.storage_key);
    audit.log(ctx, "file.delete", "file", f.id, { name: f.original_name });
    return { ok: true };
  });

  /* ================= Feedback & evaluation ================= */
  router.post("/api/projects/:id/feedback", { perm: "feedback.write" }, (ctx) => {
    const { p, access } = projectOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    const b = parse(schema({ body: v.string({ min: 2, max: 4000 }), milestone_id: v.int({ min: 1, optional: true, nullable: true }) }), ctx.body);
    if (b.milestone_id && !db.prepare("SELECT 1 FROM milestones WHERE id = ? AND project_id = ?").get(b.milestone_id, p.id)) throw new HttpError(422, "بيانات غير صالحة", { milestone_id: "المرحلة لا تتبع هذا المشروع" });
    const r = db.prepare("INSERT INTO feedback (org_id, project_id, milestone_id, author_id, kind, body) VALUES (?,?,?,?,?,?)").run(org(ctx), p.id, b.milestone_id ?? null, me(ctx), "comment", b.body);
    audit.log(ctx, "feedback.create", "project", p.id);
    notifyTeam(ctx, p, { type: "feedback", title: "ملاحظات جديدة من المشرف", body: b.body.slice(0, 140), link: `#/projects/${p.id}` });
    return created({ feedback: db.prepare("SELECT * FROM feedback WHERE id = ?").get(r.lastInsertRowid) });
  });

  router.post("/api/projects/:id/evaluations", { perm: "evaluations.write" }, (ctx) => {
    const { p, access } = projectOf(ctx, ctx.params.id);
    if (!staffRole(access)) throw forbidden();
    const b = parse(schema({
      criteria: v.array(v.object({ name: v.string({ min: 2, max: 120 }), max: v.int({ min: 1, max: 100 }), score: v.int({ min: 0, max: 100 }) }), { min: 1, max: 15 }),
      comments: v.string({ max: 4000, optional: true, nullable: true }),
      is_final: v.bool({ default: false }),
    }), ctx.body);
    const bad = b.criteria.findIndex((c) => c.score > c.max);
    if (bad >= 0) throw new HttpError(422, "بيانات غير صالحة", { criteria: `الدرجة في «${b.criteria[bad].name}» أكبر من الحد الأقصى` });
    const total = b.criteria.reduce((s, c) => s + c.score, 0), max = b.criteria.reduce((s, c) => s + c.max, 0);
    const r = db.prepare("INSERT INTO evaluations (org_id, project_id, evaluator_id, criteria, total, max_total, comments, is_final) VALUES (?,?,?,?,?,?,?,?)")
      .run(org(ctx), p.id, me(ctx), JSON.stringify(b.criteria), total, max, b.comments ?? null, b.is_final ? 1 : 0);
    audit.log(ctx, "evaluation.create", "project", p.id, { total, max, final: b.is_final });
    notifyTeam(ctx, p, { type: "evaluation", title: b.is_final ? "صدر التقييم النهائي لمشروعك" : "تقييم جديد لمشروعك", body: `${total} / ${max}`, link: `#/projects/${p.id}` });
    return created({ evaluation: { ...db.prepare("SELECT * FROM evaluations WHERE id = ?").get(r.lastInsertRowid), criteria: b.criteria } });
  });

  /* ================= Dashboard ================= */
  router.get("/api/dashboard", { perm: "dashboard.view" }, (ctx) => {
    const s = scopeWhere(ctx);
    const today = localToday();
    const counts = db.prepare(`SELECT COUNT(*) AS total, SUM(p.status IN ${ACTIVE}) AS active, SUM(p.status = 'completed') AS completed, SUM(p.status = 'proposal') AS proposals, SUM(p.supervisor_id IS NULL) AS unsupervised FROM projects p WHERE ${s.sql}`).get(...s.args);
    const pending = db.prepare(`SELECT m.id, m.title, m.submitted_at, p.id AS project_id, p.title AS project_title FROM milestones m JOIN projects p ON p.id = m.project_id WHERE ${s.sql} AND m.status = 'submitted' ORDER BY m.submitted_at LIMIT 10`).all(...s.args);
    const upcoming = db.prepare(`SELECT m.id, m.title, m.due_date, m.status, p.id AS project_id, p.title AS project_title FROM milestones m JOIN projects p ON p.id = m.project_id
      WHERE ${s.sql} AND m.status <> 'approved' AND m.due_date IS NOT NULL AND p.status IN ${ACTIVE} ORDER BY m.due_date LIMIT 8`).all(...s.args);
    const overdue = db.prepare(`SELECT COUNT(*) AS n FROM milestones m JOIN projects p ON p.id = m.project_id WHERE ${s.sql} AND m.status IN ('pending','needs_changes') AND m.due_date < ? AND p.status IN ${ACTIVE}`).get(...s.args, today).n;
    const projects = db.prepare(`SELECT p.id, p.title, p.status, p.due_date FROM projects p WHERE ${s.sql} AND p.status IN ${ACTIVE} ORDER BY p.updated_at DESC LIMIT 8`).all(...s.args).map((p) => ({ ...p, progress: progressOf(p.id).percent }));
    const myTasks = db.prepare(`SELECT t.id, t.title, t.status, t.due_date, p.id AS project_id, p.title AS project_title FROM tasks t JOIN projects p ON p.id = t.project_id WHERE ${s.sql} AND t.assignee_id = ? AND t.status <> 'done' ORDER BY t.due_date IS NULL, t.due_date LIMIT 8`).all(...s.args, me(ctx));
    const feedback = db.prepare(`SELECT f.id, f.body, f.kind, f.created_at, u.name AS author_name, p.id AS project_id, p.title AS project_title FROM feedback f JOIN projects p ON p.id = f.project_id JOIN users u ON u.id = f.author_id WHERE ${s.sql} AND f.author_id <> ? ORDER BY f.id DESC LIMIT 5`).all(...s.args, me(ctx));
    const supervisors = can(ctx.user, "projects.view_all") ? db.prepare(`SELECT u.id, u.name,
        (SELECT COUNT(*) FROM projects p WHERE p.supervisor_id = u.id AND p.status IN ${ACTIVE}) AS active_projects,
        (SELECT COUNT(*) FROM milestones m JOIN projects p ON p.id = m.project_id WHERE p.supervisor_id = u.id AND m.status = 'submitted') AS pending_reviews
      FROM users u WHERE u.org_id = ? AND u.role = 'SUPERVISOR' AND u.is_active = 1 ORDER BY active_projects DESC, u.name`).all(org(ctx)) : null;
    const zero = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x ?? 0]));
    return { role: ctx.user.role, today, counts: zero(counts), pending_reviews: pending, upcoming, overdue_milestones: overdue, projects, my_tasks: myTasks, feedback, supervisors };
  });

  /* ================= Reports ================= */
  router.get("/api/reports/summary", { perm: "reports.view" }, (ctx) => {
    const s = scopeWhere(ctx);
    const today = localToday();
    const all = db.prepare(`SELECT p.*, u.name AS supervisor_name FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id WHERE ${s.sql}`).all(...s.args);
    const withProgress = all.map((p) => ({ ...p, progress: progressOf(p.id).percent }));
    const group = (key) => Object.entries(withProgress.reduce((a, p) => { const k = p[key] || "—"; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
    const active = withProgress.filter((p) => ["proposal", "approved", "in_progress", "submitted"].includes(p.status));
    const evals = db.prepare(`SELECT e.project_id, e.total, e.max_total FROM evaluations e JOIN projects p ON p.id = e.project_id WHERE ${s.sql} AND e.is_final = 1`).all(...s.args);
    const overdue = db.prepare(`SELECT m.title, m.due_date, p.id AS project_id, p.title AS project_title, u.name AS supervisor_name FROM milestones m JOIN projects p ON p.id = m.project_id LEFT JOIN users u ON u.id = p.supervisor_id
      WHERE ${s.sql} AND m.status IN ('pending','needs_changes') AND m.due_date < ? AND p.status IN ${ACTIVE} ORDER BY m.due_date`).all(...s.args, today);
    return {
      total: all.length,
      by_status: group("status"),
      by_department: group("department"),
      avg_progress: active.length ? Math.round(active.reduce((x, p) => x + p.progress, 0) / active.length) : null,
      avg_final_score_pct: evals.length ? Math.round((evals.reduce((x, e) => x + e.total / e.max_total, 0) / evals.length) * 100) : null,
      final_evaluations: evals.length,
      overdue_milestones: overdue,
      projects: withProgress.map((p) => ({ id: p.id, title: p.title, status: p.status, department: p.department, supervisor_name: p.supervisor_name, due_date: p.due_date, progress: p.progress })),
    };
  });

  router.get("/api/reports/export", { perm: "reports.view" }, (ctx) => {
    const s = scopeWhere(ctx);
    const rows = db.prepare(`SELECT p.*, u.name AS supervisor_name, (SELECT group_concat(us.name, ' / ') FROM project_members m JOIN users us ON us.id = m.user_id WHERE m.project_id = p.id) AS team,
        (SELECT total || ' / ' || max_total FROM evaluations e WHERE e.project_id = p.id AND e.is_final = 1 ORDER BY e.id DESC LIMIT 1) AS final_score
      FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id WHERE ${s.sql} ORDER BY p.id`).all(...s.args);
    const csv = toCsv(["رقم", "العنوان", "القسم", "العام", "الحالة", "المشرف", "الفريق", "تاريخ التسليم", "نسبة الإنجاز", "التقييم النهائي"],
      rows.map((p) => [p.id, p.title, p.department, p.academic_year, p.status, p.supervisor_name, p.team, p.due_date, progressOf(p.id).percent + "%", p.final_score]));
    audit.log(ctx, "report.export", "report", "projects");
    sendCsv(ctx.res, `azenk-graduation-projects-${localToday()}.csv`, csv);
  });

  /* ================= Search ================= */
  router.get("/api/search", { perm: "search" }, (ctx) => {
    const raw = String(ctx.query.q || "").trim().slice(0, 100);
    if (raw.length < 2) return { projects: [], users: [] };
    const t = likeTerm(raw);
    const s = scopeWhere(ctx);
    const projects = db.prepare(`SELECT p.id, p.title, p.status, p.department FROM projects p WHERE ${s.sql} AND (p.title LIKE ? ESCAPE '\\' OR p.department LIKE ? ESCAPE '\\') ORDER BY p.updated_at DESC LIMIT 8`).all(...s.args, t, t);
    const users = can(ctx.user, "users.view") ? db.prepare("SELECT id, name, email, role FROM users WHERE org_id = ? AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\') ORDER BY name LIMIT 8").all(org(ctx), t, t) : [];
    return { projects, users };
  });
}
