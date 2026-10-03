import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers.js";
import { callcenterApp } from "../apps/callcenter/app.js";

let t, A, B, ids = {};
let admin, sup, agent1, agent2, otherOrg;

before(async () => {
  t = await boot(callcenterApp);
  A = t.org("Org A", "cc-a");
  B = t.org("Org B", "cc-b");
  ids.admin = t.user(A, "ADMIN", "admin@cc.test");
  ids.sup = t.user(A, "SUPERVISOR", "sup@cc.test");
  ids.a1 = t.user(A, "AGENT", "a1@cc.test");
  ids.a2 = t.user(A, "AGENT", "a2@cc.test");
  ids.b = t.user(B, "ADMIN", "admin@ccb.test");
  admin = await t.client("admin@cc.test").login();
  sup = await t.client("sup@cc.test").login();
  agent1 = await t.client("a1@cc.test").login();
  agent2 = await t.client("a2@cc.test").login();
  otherOrg = await t.client("admin@ccb.test").login();
});
after(() => t.close());

test("customers: create with validation and duplicate phone check", async () => {
  const bad = await agent1.post("/api/customers", { name: "A", phone: "12" });
  assert.equal(bad.status, 422);
  assert.ok(bad.data.error.fields.name && bad.data.error.fields.phone);
  const r = await agent1.post("/api/customers", { name: "Sara Customer", phone: "0551112222", email: "sara@example.com", company: "Shop" });
  assert.equal(r.status, 201);
  ids.c1 = r.data.customer.id;
  const dup = await agent2.post("/api/customers", { name: "Other", phone: "055 111 2222" });
  assert.equal(dup.status, 409);
  const c2 = await agent2.post("/api/customers", { name: "Fahad Customer", phone: "0553334444" });
  ids.c2 = c2.data.customer.id;
});

test("customers: search, lookup by phone, update", async () => {
  const s = await agent1.get("/api/customers?q=Sara");
  assert.equal(s.data.total, 1);
  const l = await agent1.get("/api/customers/lookup?phone=0551112222");
  assert.equal(l.data.customer.id, ids.c1);
  const u = await agent1.patch(`/api/customers/${ids.c1}`, { city: "Riyadh" });
  assert.equal(u.data.customer.city, "Riyadh");
});

test("tenant isolation: another organisation cannot read or modify customers", async () => {
  assert.equal((await otherOrg.get(`/api/customers/${ids.c1}`)).status, 404);
  assert.equal((await otherOrg.patch(`/api/customers/${ids.c1}`, { name: "Hacked" })).status, 404);
  assert.equal((await otherOrg.get("/api/customers")).data.total, 0);
});

test("calls: agent logs inbound call with follow-up task", async () => {
  const due = new Date(Date.now() + 86400000).toISOString();
  const r = await agent1.post("/api/calls", { customer_id: ids.c1, direction: "inbound", status: "answered", duration_sec: 185, notes: "Asked about order", followup: { title: "Call back with order status", due_at: due } });
  assert.equal(r.status, 201);
  assert.equal(r.data.call.agent_id, ids.a1);
  assert.equal(r.data.call.duration_sec, 185);
  assert.ok(r.data.followup_task_id);
  ids.call1 = r.data.call.id;
  await agent2.post("/api/calls", { customer_id: ids.c2, direction: "outbound", status: "no_answer", duration_sec: 40 });
});

test("calls: validation (future time, enum, foreign customer)", async () => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  assert.equal((await agent1.post("/api/calls", { customer_id: ids.c1, direction: "inbound", status: "answered", started_at: future })).status, 422);
  assert.equal((await agent1.post("/api/calls", { customer_id: ids.c1, direction: "sideways", status: "answered" })).status, 422);
  assert.equal((await otherOrg.post("/api/calls", { customer_id: ids.c1, direction: "inbound", status: "answered" })).status, 404);
});

test("calls: unanswered calls never carry talk time", async () => {
  const r = await agent2.get("/api/calls");
  assert.equal(r.data.items[0].status, "no_answer");
  assert.equal(r.data.items[0].duration_sec, 0);
});

test("calls: agents see only their own calls; supervisors see all", async () => {
  const mine = await agent1.get("/api/calls");
  assert.ok(mine.data.items.every((c) => c.agent_id === ids.a1));
  const all = await sup.get("/api/calls");
  assert.equal(all.data.total, 2);
  const filtered = await sup.get("/api/calls?direction=outbound");
  assert.equal(filtered.data.total, 1);
});

test("tickets: agent creates (self-assigned), numbering is per organisation", async () => {
  const r = await agent1.post("/api/tickets", { customer_id: ids.c1, subject: "Order not delivered", priority: "high", category: "complaint" });
  assert.equal(r.status, 201);
  assert.equal(r.data.ticket.assignee_id, ids.a1);
  assert.equal(r.data.ticket.number, 1001);
  ids.t1 = r.data.ticket.id;
  const r2 = await agent1.post("/api/tickets", { customer_id: ids.c1, subject: "Second issue" });
  assert.equal(r2.data.ticket.number, 1002);
  ids.t2 = r2.data.ticket.id;
  const cB = await otherOrg.post("/api/customers", { name: "B Customer", phone: "0559990000" });
  const tB = await otherOrg.post("/api/tickets", { customer_id: cB.data.customer.id, subject: "Org B ticket" });
  assert.equal(tB.data.ticket.number, 1001);
});

test("tickets: agents cannot assign to others", async () => {
  const r = await agent1.post("/api/tickets", { customer_id: ids.c1, subject: "Try to assign", assignee_id: ids.a2 });
  assert.equal(r.status, 403);
  assert.equal((await agent1.post(`/api/tickets/${ids.t1}/assign`, { assignee_id: ids.a2 })).status, 403);
});

test("tickets: visibility is limited for agents", async () => {
  assert.equal((await agent2.get(`/api/tickets/${ids.t1}`)).status, 404);
  assert.equal((await agent2.get("/api/tickets")).data.total, 0);
  assert.equal((await sup.get("/api/tickets")).data.total, 2);
});

test("tickets: supervisor assigns → history + notification for the assignee", async () => {
  const r = await sup.post(`/api/tickets/${ids.t1}/assign`, { assignee_id: ids.a2 });
  assert.equal(r.status, 200);
  assert.equal(r.data.ticket.assignee_id, ids.a2);
  const n = await agent2.get("/api/notifications");
  assert.ok(n.data.unread >= 1);
  assert.match(n.data.items[0].title, /#1001/);
  const d = await agent2.get(`/api/tickets/${ids.t1}`);
  assert.equal(d.status, 200);
  assert.ok(d.data.history.some((h) => h.field === "assignee_id"));
  assert.equal((await sup.post(`/api/tickets/${ids.t1}/assign`, { assignee_id: ids.b })).status, 422);
});

test("tickets: status workflow, comments, resolved timestamp, creator notified", async () => {
  assert.equal((await agent2.patch(`/api/tickets/${ids.t1}`, { status: "flying" })).status, 422);
  const p = await agent2.patch(`/api/tickets/${ids.t1}`, { status: "in_progress" });
  assert.equal(p.data.ticket.status, "in_progress");
  const c = await agent2.post(`/api/tickets/${ids.t1}/comments`, { body: "Contacted the courier" });
  assert.equal(c.status, 201);
  const res = await agent2.patch(`/api/tickets/${ids.t1}`, { status: "resolved" });
  assert.ok(res.data.ticket.resolved_at);
  const n = await agent1.get("/api/notifications?unread=1");
  assert.ok(n.data.items.some((x) => x.type === "ticket.resolved"));
  const reopen = await agent2.patch(`/api/tickets/${ids.t1}`, { status: "open" });
  assert.equal(reopen.data.ticket.resolved_at, null);
  const d = await sup.get(`/api/tickets/${ids.t1}`);
  assert.equal(d.data.comments.length, 1);
  assert.ok(d.data.history.filter((h) => h.field === "status").length >= 3);
});

test("tickets: filters (status, priority, search by number, overdue)", async () => {
  assert.equal((await sup.get("/api/tickets?priority=high")).data.total, 1);
  assert.equal((await sup.get("/api/tickets?q=%231002")).data.items[0].id, ids.t2);
  await sup.patch(`/api/tickets/${ids.t2}`, { due_at: new Date(Date.now() - 3600 * 1000).toISOString() });
  assert.equal((await sup.get("/api/tickets?overdue=1")).data.total, 1);
  assert.equal((await sup.get("/api/tickets?assignee=none")).data.total, 0);
});

test("tasks: own scope, assignment rules, completion", async () => {
  const mine = await agent1.get("/api/tasks");
  assert.equal(mine.data.total, 1);
  const tid = mine.data.items[0].id;
  assert.equal((await agent2.patch(`/api/tasks/${tid}`, { status: "done" })).status, 404);
  const due = new Date(Date.now() + 7200 * 1000).toISOString();
  assert.equal((await agent1.post("/api/tasks", { title: "For someone else", due_at: due, assignee_id: ids.a2 })).status, 403);
  const s = await sup.post("/api/tasks", { title: "Call VIP customer", due_at: due, assignee_id: ids.a2, customer_id: ids.c2, priority: "urgent" });
  assert.equal(s.status, 201);
  const done = await agent1.patch(`/api/tasks/${tid}`, { status: "done" });
  assert.ok(done.data.task.completed_at);
  assert.equal((await agent1.post("/api/tasks", { title: "x" })).status, 422);
});

test("dashboard: agent sees own scope, supervisor sees org and agent table", async () => {
  const a = await agent1.get("/api/dashboard");
  assert.equal(a.data.scope, "own");
  assert.equal(a.data.agents, null);
  assert.equal(a.data.calls.total, 1);
  const s = await sup.get("/api/dashboard");
  assert.equal(s.data.scope, "org");
  assert.equal(s.data.calls.total, 2);
  assert.ok(s.data.agents.length >= 2);
});

test("reports: supervisor only, with CSV export", async () => {
  assert.equal((await agent1.get("/api/reports/summary")).status, 403);
  const r = await sup.get("/api/reports/summary");
  assert.equal(r.status, 200);
  assert.equal(r.data.calls.total, 2);
  assert.equal(r.data.tickets.created, 2);
  const csv = await sup.get("/api/reports/export?type=calls");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  const text = csv.data.toString("utf8");
  assert.ok(text.startsWith("﻿"));
  assert.match(text, /Sara Customer/);
  assert.equal((await sup.get("/api/reports/summary?from=2026-05-01&to=2026-01-01")).status, 422);
});

test("CSV export neutralises spreadsheet formulas", async () => {
  await agent1.post("/api/customers", { name: "=HYPERLINK(\"x\")", phone: "0557778888" });
  const c = (await agent1.get("/api/customers/lookup?phone=0557778888")).data.customer;
  await agent1.post("/api/calls", { customer_id: c.id, direction: "inbound", status: "answered", duration_sec: 5 });
  const text = (await sup.get("/api/reports/export?type=calls")).data.toString("utf8");
  assert.match(text, /'=HYPERLINK/);
});

test("search returns customers and visible tickets only", async () => {
  const s = await agent2.get("/api/search?q=Sara");
  assert.equal(s.data.customers.length, 1);
  const tAgent1 = await agent1.get("/api/search?q=Second");
  assert.equal(tAgent1.data.tickets.length, 1);
  const tAgent2 = await agent2.get("/api/search?q=Second");
  assert.equal(tAgent2.data.tickets.length, 0);
});

test("customers: delete blocked when history exists; admin only", async () => {
  assert.equal((await agent1.del(`/api/customers/${ids.c1}`)).status, 403);
  assert.equal((await admin.del(`/api/customers/${ids.c1}`)).status, 409);
  const fresh = await agent1.post("/api/customers", { name: "Temp Customer", phone: "0551231234" });
  assert.equal((await admin.del(`/api/customers/${fresh.data.customer.id}`)).status, 200);
});

test("audit: domain actions are recorded", async () => {
  const r = await admin.get("/api/audit?entity=ticket");
  const actions = r.data.items.map((x) => x.action);
  for (const a of ["ticket.create", "ticket.assign", "ticket.update", "ticket.comment"]) assert.ok(actions.includes(a), a);
});
