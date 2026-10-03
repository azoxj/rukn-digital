// AZENK Call Center — app definition, permissions and API routes.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { created } from "../../core/http.js";
import { HttpError, notFound, forbidden, conflict } from "../../core/errors.js";
import { parse, schema, v } from "../../core/validate.js";
import { paging, likeTerm, toCsv, sendCsv } from "../../core/services.js";
import { tx, nowIso } from "../../core/db.js";
import { tzOffsetMin, localDay, localToday, localDayStartIso, shiftDay } from "../../core/time.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const AGENT = ["dashboard.view", "search", "customers.view", "customers.manage", "calls.log", "calls.view_own",
  "tickets.create", "tickets.view_own", "tickets.update_own", "tickets.comment", "tasks.view_own", "tasks.manage_own"];
const SUPERVISOR = [...AGENT, "calls.view_all", "tickets.view_all", "tickets.update_all", "tickets.assign", "tasks.view_all", "tasks.assign", "reports.view", "users.view"];
const ADMIN = [...SUPERVISOR, "users.manage", "audit.view", "customers.delete"];
const SUPER_ADMIN = [...ADMIN, "orgs.manage"];

export const CATEGORIES = ["general", "inquiry", "complaint", "technical", "billing", "sales"];
export const TICKET_STATUS = ["open", "in_progress", "pending", "resolved", "closed"];
export const PRIORITY = ["low", "medium", "high", "urgent"];
export const CALL_STATUS = ["answered", "missed", "no_answer", "busy", "voicemail"];
const OPEN_STATES = "('open','in_progress','pending')";

export const callcenterApp = {
  name: "callcenter",
  title: "AZENK Call Center",
  roles: ["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "AGENT"],
  permissions: { SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT },
  manageRoles: { SUPER_ADMIN: ["ADMIN", "SUPERVISOR", "AGENT"], ADMIN: ["SUPERVISOR", "AGENT"] },
  tenants: true,
  migrationsDir: join(HERE, "migrations"),
  publicDir: join(HERE, "public"),
  routes,
};

function routes(router, { db, audit, notify, can }) {
  const org = (ctx) => ctx.user.org_id;
  const me = (ctx) => ctx.user.id;
  const off = tzOffsetMin();

  /* ---------------- shared lookups ---------------- */
  const customerOf = (ctx, id) => {
    const c = db.prepare("SELECT * FROM customers WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!c) throw notFound("العميل");
    return c;
  };
  const staffOf = (ctx, id, label = "الموظف") => {
    const u = db.prepare("SELECT id, name, role FROM users WHERE id = ? AND org_id = ? AND is_active = 1").get(Number(id), org(ctx));
    if (!u) throw new HttpError(422, "بيانات غير صالحة", { assignee_id: `${label} غير موجود أو غير نشط` });
    return u;
  };
  const canSeeTicket = (ctx, t) => can(ctx.user, "tickets.view_all") || t.assignee_id === me(ctx) || t.created_by === me(ctx);
  const canEditTicket = (ctx, t) => can(ctx.user, "tickets.update_all") || (can(ctx.user, "tickets.update_own") && (t.assignee_id === me(ctx) || t.created_by === me(ctx)));
  const ticketOf = (ctx, id) => {
    const t = db.prepare("SELECT * FROM tickets WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!t || !canSeeTicket(ctx, t)) throw notFound("التذكرة"); // hide existence from users without access
    return t;
  };
  const taskOf = (ctx, id) => {
    const t = db.prepare("SELECT * FROM tasks WHERE id = ? AND org_id = ?").get(Number(id), org(ctx));
    if (!t || !(can(ctx.user, "tasks.view_all") || t.assignee_id === me(ctx) || t.created_by === me(ctx))) throw notFound("المهمة");
    return t;
  };
  const ticketLink = (id) => `#/tickets/${id}`;

  /* ================= Customers ================= */
  const customerSchema = schema({
    name: v.string({ min: 2, max: 120 }),
    phone: v.phone(),
    email: v.email({ optional: true, nullable: true }),
    company: v.string({ max: 120, optional: true, nullable: true }),
    city: v.string({ max: 80, optional: true, nullable: true }),
    notes: v.string({ max: 2000, optional: true, nullable: true }),
  });

  router.get("/api/customers", { perm: "customers.view" }, (ctx) => {
    const { size, offset, page } = paging(ctx.query);
    const where = ["c.org_id = ?"], args = [org(ctx)];
    if (ctx.query.q) {
      const t = likeTerm(ctx.query.q);
      where.push("(c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.company LIKE ? ESCAPE '\\')");
      args.push(t, t, t, t);
    }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM customers c WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT c.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = c.id AND t.status IN ${OPEN_STATES}) AS open_tickets,
        (SELECT MAX(started_at) FROM calls k WHERE k.customer_id = c.id) AS last_call_at
      FROM customers c WHERE ${w} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`).all(...args, size, offset);
    return { items, total, page, size };
  });

  router.get("/api/customers/lookup", { perm: "customers.view" }, (ctx) => {
    const phone = String(ctx.query.phone || "").replace(/[\s()-]/g, "");
    if (!phone) return { customer: null };
    return { customer: db.prepare("SELECT * FROM customers WHERE org_id = ? AND phone = ?").get(org(ctx), phone) || null };
  });

  router.get("/api/customers/:id", { perm: "customers.view" }, (ctx) => {
    const c = customerOf(ctx, ctx.params.id);
    const calls = db.prepare(`SELECT k.*, u.name AS agent_name FROM calls k JOIN users u ON u.id = k.agent_id WHERE k.customer_id = ? AND k.org_id = ? ORDER BY k.started_at DESC LIMIT 50`).all(c.id, org(ctx));
    const ticketsAll = db.prepare(`SELECT t.*, u.name AS assignee_name FROM tickets t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.customer_id = ? AND t.org_id = ? ORDER BY t.created_at DESC LIMIT 50`).all(c.id, org(ctx));
    const tickets = ticketsAll.filter((t) => canSeeTicket(ctx, t));
    const tasks = db.prepare(`SELECT t.*, u.name AS assignee_name FROM tasks t JOIN users u ON u.id = t.assignee_id WHERE t.customer_id = ? AND t.org_id = ? ORDER BY t.due_at DESC LIMIT 50`).all(c.id, org(ctx))
      .filter((t) => can(ctx.user, "tasks.view_all") || t.assignee_id === me(ctx) || t.created_by === me(ctx));
    return { customer: c, calls, tickets, tasks };
  });

  router.post("/api/customers", { perm: "customers.manage" }, (ctx) => {
    const b = parse(customerSchema, ctx.body);
    if (db.prepare("SELECT 1 FROM customers WHERE org_id = ? AND phone = ?").get(org(ctx), b.phone)) throw new HttpError(409, "يوجد عميل بنفس رقم الجوال", { phone: "مسجل مسبقًا" });
    const r = db.prepare(`INSERT INTO customers (org_id, name, phone, email, company, city, notes, created_by) VALUES (?,?,?,?,?,?,?,?)`)
      .run(org(ctx), b.name, b.phone, b.email ?? null, b.company ?? null, b.city ?? null, b.notes ?? null, me(ctx));
    audit.log(ctx, "customer.create", "customer", r.lastInsertRowid);
    return created({ customer: db.prepare("SELECT * FROM customers WHERE id = ?").get(r.lastInsertRowid) });
  });

  router.patch("/api/customers/:id", { perm: "customers.manage" }, (ctx) => {
    const c = customerOf(ctx, ctx.params.id);
    const b = parse(customerSchema, ctx.body, { partial: true });
    if (b.phone && b.phone !== c.phone && db.prepare("SELECT 1 FROM customers WHERE org_id = ? AND phone = ? AND id <> ?").get(org(ctx), b.phone, c.id)) {
      throw new HttpError(409, "يوجد عميل بنفس رقم الجوال", { phone: "مسجل مسبقًا" });
    }
    const cols = Object.keys(b);
    if (cols.length) {
      db.prepare(`UPDATE customers SET ${cols.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...cols.map((k) => b[k] ?? null), nowIso(), c.id);
      audit.log(ctx, "customer.update", "customer", c.id, { fields: cols });
    }
    return { customer: db.prepare("SELECT * FROM customers WHERE id = ?").get(c.id) };
  });

  router.delete("/api/customers/:id", { perm: "customers.delete" }, (ctx) => {
    const c = customerOf(ctx, ctx.params.id);
    const used = db.prepare(`SELECT (SELECT COUNT(*) FROM calls WHERE customer_id = ?) + (SELECT COUNT(*) FROM tickets WHERE customer_id = ?) + (SELECT COUNT(*) FROM tasks WHERE customer_id = ?) AS n`).get(c.id, c.id, c.id).n;
    if (used) throw conflict("لا يمكن حذف عميل لديه مكالمات أو تذاكر أو مهام — السجل محفوظ للتدقيق");
    db.prepare("DELETE FROM customers WHERE id = ?").run(c.id);
    audit.log(ctx, "customer.delete", "customer", c.id, { name: c.name, phone: c.phone });
    return { ok: true };
  });

  /* ================= Calls ================= */
  const callSchema = schema({
    customer_id: v.int({ min: 1 }),
    direction: v.enum(["inbound", "outbound"]),
    status: v.enum(CALL_STATUS),
    started_at: v.datetime({ optional: true }),
    duration_sec: v.int({ min: 0, max: 6 * 3600, default: 0 }),
    outcome: v.string({ max: 200, optional: true, nullable: true }),
    notes: v.string({ max: 4000, optional: true, nullable: true }),
    ticket_id: v.int({ min: 1, optional: true, nullable: true }),
    followup: v.object({ title: v.string({ min: 2, max: 200 }), due_at: v.datetime() }, { optional: true, nullable: true }),
  });

  router.get("/api/calls", { perm: ["calls.view_all", "calls.view_own"] }, (ctx) => {
    const { size, offset, page } = paging(ctx.query);
    const q = ctx.query;
    const where = ["k.org_id = ?"], args = [org(ctx)];
    if (!can(ctx.user, "calls.view_all")) { where.push("k.agent_id = ?"); args.push(me(ctx)); }
    else if (q.agent_id) { where.push("k.agent_id = ?"); args.push(Number(q.agent_id)); }
    if (q.direction && ["inbound", "outbound"].includes(q.direction)) { where.push("k.direction = ?"); args.push(q.direction); }
    if (q.status && CALL_STATUS.includes(q.status)) { where.push("k.status = ?"); args.push(q.status); }
    if (q.customer_id) { where.push("k.customer_id = ?"); args.push(Number(q.customer_id)); }
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) { where.push("k.started_at >= ?"); args.push(localDayStartIso(q.from)); }
    if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) { where.push("k.started_at < ?"); args.push(localDayStartIso(q.to, 1)); }
    if (q.q) { const t = likeTerm(q.q); where.push("(c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR k.notes LIKE ? ESCAPE '\\')"); args.push(t, t, t); }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM calls k JOIN customers c ON c.id = k.customer_id WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT k.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS agent_name, t.number AS ticket_number
      FROM calls k JOIN customers c ON c.id = k.customer_id JOIN users u ON u.id = k.agent_id LEFT JOIN tickets t ON t.id = k.ticket_id
      WHERE ${w} ORDER BY k.started_at DESC LIMIT ? OFFSET ?`).all(...args, size, offset);
    return { items, total, page, size };
  });

  router.post("/api/calls", { perm: "calls.log" }, (ctx) => {
    const b = parse(callSchema, ctx.body);
    const c = customerOf(ctx, b.customer_id);
    if (b.ticket_id) ticketOf(ctx, b.ticket_id);
    const started = b.started_at || new Date(Date.now() - b.duration_sec * 1000).toISOString();
    if (Date.parse(started) > Date.now() + 5 * 60 * 1000) throw new HttpError(422, "بيانات غير صالحة", { started_at: "لا يمكن تسجيل مكالمة في المستقبل" });
    if (b.status !== "answered" && b.duration_sec > 0 && b.status !== "voicemail") b.duration_sec = 0;
    const out = tx(db, () => {
      const r = db.prepare(`INSERT INTO calls (org_id, customer_id, agent_id, ticket_id, direction, status, started_at, duration_sec, outcome, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(org(ctx), c.id, me(ctx), b.ticket_id ?? null, b.direction, b.status, started, b.duration_sec, b.outcome ?? null, b.notes ?? null);
      let task = null;
      if (b.followup) {
        const t = db.prepare(`INSERT INTO tasks (org_id, type, title, customer_id, ticket_id, assignee_id, due_at, created_by) VALUES (?, 'followup', ?, ?, ?, ?, ?, ?)`)
          .run(org(ctx), b.followup.title, c.id, b.ticket_id ?? null, me(ctx), b.followup.due_at, me(ctx));
        task = t.lastInsertRowid;
      }
      db.prepare("UPDATE customers SET updated_at = ? WHERE id = ?").run(nowIso(), c.id);
      return { id: r.lastInsertRowid, task };
    });
    audit.log(ctx, "call.log", "call", out.id, { direction: b.direction, status: b.status, duration: b.duration_sec });
    if (out.task) audit.log(ctx, "task.create", "task", out.task, { from: "call" });
    return created({ call: db.prepare("SELECT * FROM calls WHERE id = ?").get(out.id), followup_task_id: out.task });
  });

  router.patch("/api/calls/:id", { perm: "calls.log" }, (ctx) => {
    const k = db.prepare("SELECT * FROM calls WHERE id = ? AND org_id = ?").get(Number(ctx.params.id), org(ctx));
    if (!k || (k.agent_id !== me(ctx) && !can(ctx.user, "calls.view_all"))) throw notFound("المكالمة");
    const b = parse(schema({ outcome: v.string({ max: 200, optional: true, nullable: true }), notes: v.string({ max: 4000, optional: true, nullable: true }), ticket_id: v.int({ min: 1, optional: true, nullable: true }) }), ctx.body, { partial: true });
    if (b.ticket_id) ticketOf(ctx, b.ticket_id);
    const cols = Object.keys(b);
    if (cols.length) db.prepare(`UPDATE calls SET ${cols.map((x) => `${x} = ?`).join(", ")} WHERE id = ?`).run(...cols.map((x) => b[x] ?? null), k.id);
    audit.log(ctx, "call.update", "call", k.id, { fields: cols });
    return { call: db.prepare("SELECT * FROM calls WHERE id = ?").get(k.id) };
  });

  /* ================= Tickets ================= */
  const ticketCreate = schema({
    customer_id: v.int({ min: 1 }),
    subject: v.string({ min: 3, max: 200 }),
    description: v.string({ max: 5000, optional: true, nullable: true }),
    category: v.enum(CATEGORIES, { default: "general" }),
    priority: v.enum(PRIORITY, { default: "medium" }),
    due_at: v.datetime({ optional: true, nullable: true }),
    assignee_id: v.int({ min: 1, optional: true, nullable: true }),
  });
  const ticketPatch = schema({
    subject: v.string({ min: 3, max: 200 }),
    description: v.string({ max: 5000, optional: true, nullable: true }),
    category: v.enum(CATEGORIES),
    priority: v.enum(PRIORITY),
    status: v.enum(TICKET_STATUS),
    due_at: v.datetime({ optional: true, nullable: true }),
  });

  const ticketRow = (id) => db.prepare(`SELECT t.*, c.name AS customer_name, c.phone AS customer_phone, a.name AS assignee_name, cb.name AS creator_name
    FROM tickets t JOIN customers c ON c.id = t.customer_id LEFT JOIN users a ON a.id = t.assignee_id JOIN users cb ON cb.id = t.created_by WHERE t.id = ?`).get(id);

  router.get("/api/tickets", { perm: ["tickets.view_all", "tickets.view_own"] }, (ctx) => {
    const { size, offset, page } = paging(ctx.query);
    const q = ctx.query;
    const where = ["t.org_id = ?"], args = [org(ctx)];
    if (!can(ctx.user, "tickets.view_all")) { where.push("(t.assignee_id = ? OR t.created_by = ?)"); args.push(me(ctx), me(ctx)); }
    if (q.status === "active") where.push(`t.status IN ${OPEN_STATES}`);
    else if (q.status && TICKET_STATUS.includes(q.status)) { where.push("t.status = ?"); args.push(q.status); }
    if (q.priority && PRIORITY.includes(q.priority)) { where.push("t.priority = ?"); args.push(q.priority); }
    if (q.category && CATEGORIES.includes(q.category)) { where.push("t.category = ?"); args.push(q.category); }
    if (q.assignee === "me") { where.push("t.assignee_id = ?"); args.push(me(ctx)); }
    else if (q.assignee === "none") where.push("t.assignee_id IS NULL");
    else if (q.assignee && /^\d+$/.test(q.assignee)) { where.push("t.assignee_id = ?"); args.push(Number(q.assignee)); }
    if (q.customer_id) { where.push("t.customer_id = ?"); args.push(Number(q.customer_id)); }
    if (q.overdue === "1") { where.push(`t.due_at IS NOT NULL AND t.due_at < ? AND t.status IN ${OPEN_STATES}`); args.push(nowIso()); }
    if (q.q) {
      const raw = String(q.q).replace(/^#/, "");
      const t = likeTerm(q.q);
      where.push("(t.subject LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR t.number = ?)");
      args.push(t, t, t, /^\d+$/.test(raw) ? Number(raw) : -1);
    }
    const w = where.join(" AND ");
    const order = q.sort === "priority"
      ? "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC"
      : q.sort === "due" ? "t.due_at IS NULL, t.due_at ASC" : "t.updated_at DESC";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM tickets t JOIN customers c ON c.id = t.customer_id WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT t.*, c.name AS customer_name, c.phone AS customer_phone, a.name AS assignee_name
      FROM tickets t JOIN customers c ON c.id = t.customer_id LEFT JOIN users a ON a.id = t.assignee_id
      WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, size, offset);
    return { items, total, page, size };
  });

  router.get("/api/tickets/:id", { perm: ["tickets.view_all", "tickets.view_own"] }, (ctx) => {
    const t = ticketOf(ctx, ctx.params.id);
    return {
      ticket: ticketRow(t.id),
      can_edit: canEditTicket(ctx, t),
      can_assign: can(ctx.user, "tickets.assign"),
      comments: db.prepare("SELECT m.*, u.name AS user_name FROM ticket_comments m JOIN users u ON u.id = m.user_id WHERE m.ticket_id = ? ORDER BY m.id").all(t.id),
      history: db.prepare("SELECT h.*, u.name AS user_name FROM ticket_history h JOIN users u ON u.id = h.user_id WHERE h.ticket_id = ? ORDER BY h.id").all(t.id),
      calls: db.prepare("SELECT k.*, u.name AS agent_name FROM calls k JOIN users u ON u.id = k.agent_id WHERE k.ticket_id = ? ORDER BY k.started_at DESC").all(t.id),
      tasks: db.prepare("SELECT k.*, u.name AS assignee_name FROM tasks k JOIN users u ON u.id = k.assignee_id WHERE k.ticket_id = ? ORDER BY k.due_at").all(t.id),
    };
  });

  router.post("/api/tickets", { perm: "tickets.create" }, (ctx) => {
    const b = parse(ticketCreate, ctx.body);
    const c = customerOf(ctx, b.customer_id);
    let assignee = me(ctx);
    if (b.assignee_id !== undefined) {
      if (b.assignee_id !== me(ctx) && !can(ctx.user, "tickets.assign")) throw forbidden();
      assignee = b.assignee_id === null ? null : staffOf(ctx, b.assignee_id).id;
    }
    const id = tx(db, () => {
      const number = db.prepare("SELECT COALESCE(MAX(number), 1000) + 1 AS n FROM tickets WHERE org_id = ?").get(org(ctx)).n;
      return db.prepare(`INSERT INTO tickets (org_id, number, customer_id, subject, description, category, priority, assignee_id, created_by, due_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(org(ctx), number, c.id, b.subject, b.description ?? null, b.category, b.priority, assignee, me(ctx), b.due_at ?? null).lastInsertRowid;
    });
    const t = ticketRow(id);
    audit.log(ctx, "ticket.create", "ticket", id, { number: t.number, priority: t.priority });
    notify.send(org(ctx), assignee, { type: "ticket.assigned", title: `أُسندت إليك التذكرة #${t.number}`, body: t.subject, link: ticketLink(id) }, { skipUserId: me(ctx) });
    return created({ ticket: t });
  });

  router.patch("/api/tickets/:id", { perm: ["tickets.update_all", "tickets.update_own"] }, (ctx) => {
    const t = ticketOf(ctx, ctx.params.id);
    if (!canEditTicket(ctx, t)) throw forbidden();
    const b = parse(ticketPatch, ctx.body, { partial: true });
    const cols = Object.keys(b).filter((k) => (b[k] ?? null) !== (t[k] ?? null));
    if (!cols.length) return { ticket: ticketRow(t.id) };
    const sets = cols.map((k) => `${k} = ?`), vals = cols.map((k) => b[k] ?? null);
    if (b.status && b.status !== t.status) {
      const done = ["resolved", "closed"].includes(b.status);
      sets.push("resolved_at = ?");
      vals.push(done ? (t.resolved_at || nowIso()) : null);
    }
    tx(db, () => {
      db.prepare(`UPDATE tickets SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), t.id);
      for (const f of cols.filter((k) => ["status", "priority", "category", "due_at"].includes(k))) {
        db.prepare("INSERT INTO ticket_history (org_id, ticket_id, user_id, field, from_value, to_value) VALUES (?,?,?,?,?,?)").run(org(ctx), t.id, me(ctx), f, t[f] ?? null, b[f] ?? null);
      }
    });
    audit.log(ctx, "ticket.update", "ticket", t.id, { fields: cols, status: b.status });
    const link = ticketLink(t.id);
    if (b.status && b.status !== t.status) {
      notify.send(org(ctx), t.assignee_id, { type: "ticket.status", title: `تغيّرت حالة التذكرة #${t.number}`, body: b.status, link }, { skipUserId: me(ctx) });
      if (["resolved", "closed"].includes(b.status) && t.created_by !== t.assignee_id) notify.send(org(ctx), t.created_by, { type: "ticket.resolved", title: `تم حل التذكرة #${t.number}`, body: t.subject, link }, { skipUserId: me(ctx) });
    }
    return { ticket: ticketRow(t.id) };
  });

  router.post("/api/tickets/:id/assign", { perm: "tickets.assign" }, (ctx) => {
    const t = ticketOf(ctx, ctx.params.id);
    const b = parse(schema({ assignee_id: v.int({ min: 1, nullable: true }) }), ctx.body);
    const to = b.assignee_id === null ? null : staffOf(ctx, b.assignee_id).id;
    if (to === t.assignee_id) return { ticket: ticketRow(t.id) };
    tx(db, () => {
      db.prepare("UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?").run(to, nowIso(), t.id);
      db.prepare("INSERT INTO ticket_history (org_id, ticket_id, user_id, field, from_value, to_value) VALUES (?,?,?,?,?,?)").run(org(ctx), t.id, me(ctx), "assignee_id", t.assignee_id == null ? null : String(t.assignee_id), to == null ? null : String(to));
    });
    audit.log(ctx, "ticket.assign", "ticket", t.id, { from: t.assignee_id, to });
    notify.send(org(ctx), to, { type: "ticket.assigned", title: `أُسندت إليك التذكرة #${t.number}`, body: t.subject, link: ticketLink(t.id) }, { skipUserId: me(ctx) });
    return { ticket: ticketRow(t.id) };
  });

  router.post("/api/tickets/:id/comments", { perm: "tickets.comment" }, (ctx) => {
    const t = ticketOf(ctx, ctx.params.id);
    const b = parse(schema({ body: v.string({ min: 1, max: 4000 }) }), ctx.body);
    const r = db.prepare("INSERT INTO ticket_comments (org_id, ticket_id, user_id, body) VALUES (?,?,?,?)").run(org(ctx), t.id, me(ctx), b.body);
    db.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").run(nowIso(), t.id);
    audit.log(ctx, "ticket.comment", "ticket", t.id);
    const link = ticketLink(t.id);
    for (const uid of new Set([t.assignee_id, t.created_by])) notify.send(org(ctx), uid, { type: "ticket.comment", title: `ملاحظة جديدة على التذكرة #${t.number}`, body: b.body.slice(0, 140), link }, { skipUserId: me(ctx) });
    return created({ comment: db.prepare("SELECT m.*, u.name AS user_name FROM ticket_comments m JOIN users u ON u.id = m.user_id WHERE m.id = ?").get(r.lastInsertRowid) });
  });

  /* ================= Tasks / follow-ups ================= */
  const taskCreate = schema({
    type: v.enum(["followup", "task"], { default: "followup" }),
    title: v.string({ min: 2, max: 200 }),
    description: v.string({ max: 2000, optional: true, nullable: true }),
    customer_id: v.int({ min: 1, optional: true, nullable: true }),
    ticket_id: v.int({ min: 1, optional: true, nullable: true }),
    assignee_id: v.int({ min: 1, optional: true }),
    priority: v.enum(PRIORITY, { default: "medium" }),
    due_at: v.datetime(),
  });
  const taskPatch = schema({
    title: v.string({ min: 2, max: 200 }),
    description: v.string({ max: 2000, optional: true, nullable: true }),
    priority: v.enum(PRIORITY),
    status: v.enum(["open", "done", "cancelled"]),
    due_at: v.datetime(),
    assignee_id: v.int({ min: 1 }),
  });
  const taskRow = (id) => db.prepare(`SELECT k.*, u.name AS assignee_name, c.name AS customer_name, t.number AS ticket_number
    FROM tasks k JOIN users u ON u.id = k.assignee_id LEFT JOIN customers c ON c.id = k.customer_id LEFT JOIN tickets t ON t.id = k.ticket_id WHERE k.id = ?`).get(id);

  router.get("/api/tasks", { perm: ["tasks.view_all", "tasks.view_own"] }, (ctx) => {
    const { size, offset, page } = paging(ctx.query, 50);
    const q = ctx.query;
    const where = ["k.org_id = ?"], args = [org(ctx)];
    if (!can(ctx.user, "tasks.view_all") || q.mine === "1") { where.push("k.assignee_id = ?"); args.push(me(ctx)); }
    else if (q.assignee_id) { where.push("k.assignee_id = ?"); args.push(Number(q.assignee_id)); }
    if (q.status && ["open", "done", "cancelled"].includes(q.status)) { where.push("k.status = ?"); args.push(q.status); }
    if (q.type && ["followup", "task"].includes(q.type)) { where.push("k.type = ?"); args.push(q.type); }
    const todayStart = localDayStartIso(localToday()), tomorrow = localDayStartIso(localToday(), 1);
    if (q.due === "overdue") { where.push("k.status = 'open' AND k.due_at < ?"); args.push(nowIso()); }
    else if (q.due === "today") { where.push("k.due_at >= ? AND k.due_at < ?"); args.push(todayStart, tomorrow); }
    else if (q.due === "upcoming") { where.push("k.due_at >= ?"); args.push(tomorrow); }
    if (q.customer_id) { where.push("k.customer_id = ?"); args.push(Number(q.customer_id)); }
    const w = where.join(" AND ");
    const total = db.prepare(`SELECT COUNT(*) AS n FROM tasks k WHERE ${w}`).get(...args).n;
    const items = db.prepare(`SELECT k.*, u.name AS assignee_name, c.name AS customer_name, t.number AS ticket_number
      FROM tasks k JOIN users u ON u.id = k.assignee_id LEFT JOIN customers c ON c.id = k.customer_id LEFT JOIN tickets t ON t.id = k.ticket_id
      WHERE ${w} ORDER BY k.status = 'open' DESC, k.due_at ASC LIMIT ? OFFSET ?`).all(...args, size, offset);
    return { items, total, page, size };
  });

  router.post("/api/tasks", { perm: "tasks.manage_own" }, (ctx) => {
    const b = parse(taskCreate, ctx.body);
    if (b.customer_id) customerOf(ctx, b.customer_id);
    if (b.ticket_id) ticketOf(ctx, b.ticket_id);
    let assignee = me(ctx);
    if (b.assignee_id && b.assignee_id !== me(ctx)) {
      if (!can(ctx.user, "tasks.assign")) throw forbidden();
      assignee = staffOf(ctx, b.assignee_id).id;
    }
    const r = db.prepare(`INSERT INTO tasks (org_id, type, title, description, customer_id, ticket_id, assignee_id, priority, due_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(org(ctx), b.type, b.title, b.description ?? null, b.customer_id ?? null, b.ticket_id ?? null, assignee, b.priority, b.due_at, me(ctx));
    audit.log(ctx, "task.create", "task", r.lastInsertRowid, { assignee });
    notify.send(org(ctx), assignee, { type: "task.assigned", title: "مهمة جديدة مسندة إليك", body: b.title, link: "#/tasks" }, { skipUserId: me(ctx) });
    return created({ task: taskRow(r.lastInsertRowid) });
  });

  router.patch("/api/tasks/:id", { perm: "tasks.manage_own" }, (ctx) => {
    const t = taskOf(ctx, ctx.params.id);
    const isMine = t.assignee_id === me(ctx) || t.created_by === me(ctx);
    if (!isMine && !can(ctx.user, "tasks.assign")) throw forbidden();
    const b = parse(taskPatch, ctx.body, { partial: true });
    if (b.assignee_id !== undefined && b.assignee_id !== t.assignee_id) {
      if (!can(ctx.user, "tasks.assign")) throw forbidden();
      staffOf(ctx, b.assignee_id);
    }
    const cols = Object.keys(b);
    if (!cols.length) return { task: taskRow(t.id) };
    const sets = cols.map((k) => `${k} = ?`), vals = cols.map((k) => b[k] ?? null);
    if (b.status) { sets.push("completed_at = ?"); vals.push(b.status === "done" ? (t.completed_at || nowIso()) : null); }
    db.prepare(`UPDATE tasks SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), t.id);
    audit.log(ctx, "task.update", "task", t.id, { fields: cols, status: b.status });
    if (b.assignee_id && b.assignee_id !== t.assignee_id) notify.send(org(ctx), b.assignee_id, { type: "task.assigned", title: "مهمة جديدة مسندة إليك", body: b.title || t.title, link: "#/tasks" }, { skipUserId: me(ctx) });
    return { task: taskRow(t.id) };
  });

  /* ================= Dashboard ================= */
  router.get("/api/dashboard", { perm: "dashboard.view" }, (ctx) => {
    const all = can(ctx.user, "calls.view_all");
    const today = localToday();
    const start = localDayStartIso(today), end = localDayStartIso(today, 1);
    const now = nowIso();
    const callScope = all ? "" : " AND agent_id = ?";
    const tScope = can(ctx.user, "tickets.view_all") ? "" : " AND (assignee_id = ? OR created_by = ?)";
    const ca = all ? [] : [me(ctx)];
    const ta = can(ctx.user, "tickets.view_all") ? [] : [me(ctx), me(ctx)];
    const calls = db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'answered') AS answered, SUM(status IN ('missed','no_answer','busy')) AS missed,
        SUM(direction = 'inbound') AS inbound, SUM(direction = 'outbound') AS outbound, COALESCE(ROUND(AVG(CASE WHEN status = 'answered' THEN duration_sec END)), 0) AS avg_duration
      FROM calls WHERE org_id = ? AND started_at >= ? AND started_at < ?${callScope}`).get(org(ctx), start, end, ...ca);
    const tickets = db.prepare(`SELECT SUM(status IN ${OPEN_STATES}) AS open, SUM(status IN ${OPEN_STATES} AND priority = 'urgent') AS urgent,
        SUM(status IN ${OPEN_STATES} AND due_at IS NOT NULL AND due_at < ?) AS overdue, SUM(status IN ${OPEN_STATES} AND assignee_id IS NULL) AS unassigned,
        SUM(resolved_at >= ? AND resolved_at < ?) AS resolved_today
      FROM tickets WHERE org_id = ?${tScope}`).get(now, start, end, org(ctx), ...ta);
    const tasks = db.prepare(`SELECT SUM(status = 'open' AND due_at < ?) AS overdue, SUM(status = 'open' AND due_at >= ? AND due_at < ?) AS due_today
      FROM tasks WHERE org_id = ? AND assignee_id = ?`).get(now, start, end, org(ctx), me(ctx));
    const week = db.prepare(`SELECT ${localDay("started_at", off)} AS day, COUNT(*) AS total, SUM(status = 'answered') AS answered
      FROM calls WHERE org_id = ? AND started_at >= ?${callScope} GROUP BY day ORDER BY day`).all(org(ctx), localDayStartIso(today, -6), ...ca);
    const myTasks = db.prepare(`SELECT k.*, c.name AS customer_name FROM tasks k LEFT JOIN customers c ON c.id = k.customer_id
      WHERE k.org_id = ? AND k.assignee_id = ? AND k.status = 'open' ORDER BY k.due_at LIMIT 6`).all(org(ctx), me(ctx));
    const recent = db.prepare(`SELECT t.id, t.number, t.subject, t.status, t.priority, t.updated_at, c.name AS customer_name, a.name AS assignee_name
      FROM tickets t JOIN customers c ON c.id = t.customer_id LEFT JOIN users a ON a.id = t.assignee_id
      WHERE t.org_id = ? AND t.status IN ${OPEN_STATES}${tScope.replace(/assignee_id|created_by/g, (m) => "t." + m)}
      ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.updated_at DESC LIMIT 6`).all(org(ctx), ...ta);
    const agents = all ? db.prepare(`SELECT u.id, u.name, u.role,
        (SELECT COUNT(*) FROM calls k WHERE k.agent_id = u.id AND k.started_at >= ? AND k.started_at < ?) AS calls_today,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.status IN ${OPEN_STATES}) AS open_tickets,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.resolved_at >= ?) AS resolved_7d
      FROM users u WHERE u.org_id = ? AND u.is_active = 1 AND u.role IN ('AGENT','SUPERVISOR') ORDER BY calls_today DESC, u.name`).all(start, end, localDayStartIso(today, -6), org(ctx)) : null;
    const zero = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x ?? 0]));
    return { scope: all ? "org" : "own", today, calls: zero(calls), tickets: zero(tickets), tasks: zero(tasks), week, my_tasks: myTasks, recent_tickets: recent, agents };
  });

  /* ================= Reports ================= */
  const range = (q) => {
    const today = localToday();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || "") ? q.from : shiftDay(today, -29);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to || "") ? q.to : today;
    if (from > to) throw new HttpError(422, "بيانات غير صالحة", { from: "تاريخ البداية بعد تاريخ النهاية" });
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366) throw new HttpError(422, "بيانات غير صالحة", { from: "أقصى مدى للتقرير سنة واحدة" });
    return { from, to, start: localDayStartIso(from), end: localDayStartIso(to, 1) };
  };

  router.get("/api/reports/summary", { perm: "reports.view" }, (ctx) => {
    const r = range(ctx.query);
    const o = org(ctx);
    const byDay = db.prepare(`SELECT ${localDay("started_at", off)} AS day, COUNT(*) AS total, SUM(status = 'answered') AS answered, SUM(direction = 'inbound') AS inbound, SUM(direction = 'outbound') AS outbound
      FROM calls WHERE org_id = ? AND started_at >= ? AND started_at < ? GROUP BY day ORDER BY day`).all(o, r.start, r.end);
    const callStatus = db.prepare(`SELECT status, COUNT(*) AS n FROM calls WHERE org_id = ? AND started_at >= ? AND started_at < ? GROUP BY status`).all(o, r.start, r.end);
    const callTotals = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(duration_sec), 0) AS talk_sec, COALESCE(ROUND(AVG(CASE WHEN status='answered' THEN duration_sec END)), 0) AS avg_sec,
        SUM(status = 'answered') AS answered FROM calls WHERE org_id = ? AND started_at >= ? AND started_at < ?`).get(o, r.start, r.end);
    const tCreated = db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE org_id = ? AND created_at >= ? AND created_at < ?`).get(o, r.start, r.end).n;
    const tResolved = db.prepare(`SELECT COUNT(*) AS n, ROUND(AVG((julianday(resolved_at) - julianday(created_at)) * 24), 1) AS avg_hours
      FROM tickets WHERE org_id = ? AND resolved_at >= ? AND resolved_at < ?`).get(o, r.start, r.end);
    const byPriority = db.prepare(`SELECT priority, COUNT(*) AS n FROM tickets WHERE org_id = ? AND created_at >= ? AND created_at < ? GROUP BY priority`).all(o, r.start, r.end);
    const byCategory = db.prepare(`SELECT category, COUNT(*) AS n FROM tickets WHERE org_id = ? AND created_at >= ? AND created_at < ? GROUP BY category ORDER BY n DESC`).all(o, r.start, r.end);
    const byStatus = db.prepare(`SELECT status, COUNT(*) AS n FROM tickets WHERE org_id = ? GROUP BY status`).all(o);
    const agents = db.prepare(`SELECT u.id, u.name, u.role,
        (SELECT COUNT(*) FROM calls k WHERE k.agent_id = u.id AND k.started_at >= ? AND k.started_at < ?) AS calls,
        (SELECT COALESCE(SUM(duration_sec), 0) FROM calls k WHERE k.agent_id = u.id AND k.started_at >= ? AND k.started_at < ?) AS talk_sec,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.resolved_at >= ? AND t.resolved_at < ?) AS resolved,
        (SELECT COUNT(*) FROM tasks k WHERE k.assignee_id = u.id AND k.completed_at >= ? AND k.completed_at < ?) AS tasks_done
      FROM users u WHERE u.org_id = ? AND u.role IN ('AGENT','SUPERVISOR') ORDER BY calls DESC, u.name`).all(r.start, r.end, r.start, r.end, r.start, r.end, r.start, r.end, o);
    return { range: { from: r.from, to: r.to }, calls: { ...callTotals, answered: callTotals.answered ?? 0, by_day: byDay, by_status: callStatus },
      tickets: { created: tCreated, resolved: tResolved.n, avg_resolution_hours: tResolved.avg_hours, by_priority: byPriority, by_category: byCategory, by_status: byStatus }, agents };
  });

  router.get("/api/reports/export", { perm: "reports.view" }, (ctx) => {
    const r = range(ctx.query);
    const type = ctx.query.type === "tickets" ? "tickets" : "calls";
    let csv;
    if (type === "calls") {
      const rows = db.prepare(`SELECT k.started_at, k.direction, k.status, k.duration_sec, c.name, c.phone, u.name AS agent, k.outcome, k.notes
        FROM calls k JOIN customers c ON c.id = k.customer_id JOIN users u ON u.id = k.agent_id
        WHERE k.org_id = ? AND k.started_at >= ? AND k.started_at < ? ORDER BY k.started_at`).all(org(ctx), r.start, r.end);
      csv = toCsv(["التاريخ", "الاتجاه", "الحالة", "المدة (ث)", "العميل", "الجوال", "الموظف", "النتيجة", "ملاحظات"], rows.map((x) => [x.started_at, x.direction, x.status, x.duration_sec, x.name, x.phone, x.agent, x.outcome, x.notes]));
    } else {
      const rows = db.prepare(`SELECT t.number, t.created_at, t.subject, t.category, t.priority, t.status, c.name, a.name AS assignee, t.resolved_at
        FROM tickets t JOIN customers c ON c.id = t.customer_id LEFT JOIN users a ON a.id = t.assignee_id
        WHERE t.org_id = ? AND t.created_at >= ? AND t.created_at < ? ORDER BY t.number`).all(org(ctx), r.start, r.end);
      csv = toCsv(["رقم", "تاريخ الإنشاء", "الموضوع", "التصنيف", "الأولوية", "الحالة", "العميل", "المسؤول", "تاريخ الحل"], rows.map((x) => [x.number, x.created_at, x.subject, x.category, x.priority, x.status, x.name, x.assignee, x.resolved_at]));
    }
    audit.log(ctx, "report.export", "report", type, { from: r.from, to: r.to });
    sendCsv(ctx.res, `azenk-${type}-${r.from}-${r.to}.csv`, csv);
  });

  /* ================= Search ================= */
  router.get("/api/search", { perm: "search" }, (ctx) => {
    const raw = String(ctx.query.q || "").trim().slice(0, 100);
    if (raw.length < 2) return { customers: [], tickets: [] };
    const t = likeTerm(raw);
    const customers = db.prepare(`SELECT id, name, phone, company FROM customers WHERE org_id = ? AND (name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\') ORDER BY name LIMIT 8`)
      .all(org(ctx), t, t, t, t);
    const num = /^#?\d+$/.test(raw) ? Number(raw.replace("#", "")) : -1;
    const own = can(ctx.user, "tickets.view_all") ? "" : " AND (t.assignee_id = ? OR t.created_by = ?)";
    const tickets = db.prepare(`SELECT t.id, t.number, t.subject, t.status, t.priority, c.name AS customer_name FROM tickets t JOIN customers c ON c.id = t.customer_id
      WHERE t.org_id = ? AND (t.subject LIKE ? ESCAPE '\\' OR t.number = ?)${own} ORDER BY t.updated_at DESC LIMIT 8`)
      .all(org(ctx), t, num, ...(own ? [me(ctx), me(ctx)] : []));
    return { customers, tickets };
  });
}

