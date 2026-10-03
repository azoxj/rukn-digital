import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { boot } from "./helpers.js";
import { graduationApp } from "../apps/graduation/app.js";

let t, A, B, u = {}, c = {}, ids = {};
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

before(async () => {
  t = await boot(graduationApp);
  A = t.org("University A", "uni-a");
  B = t.org("University B", "uni-b");
  u.admin = t.user(A, "ADMIN", "admin@uni.test");
  u.sup = t.user(A, "SUPERVISOR", "sup@uni.test");
  u.sup2 = t.user(A, "SUPERVISOR", "sup2@uni.test");
  u.s1 = t.user(A, "STUDENT", "s1@uni.test");
  u.s2 = t.user(A, "STUDENT", "s2@uni.test");
  u.s3 = t.user(A, "STUDENT", "s3@uni.test");
  u.bAdmin = t.user(B, "ADMIN", "admin@unib.test");
  u.bStudent = t.user(B, "STUDENT", "s@unib.test");
  for (const [k, email] of [["admin", "admin@uni.test"], ["sup", "sup@uni.test"], ["sup2", "sup2@uni.test"], ["s1", "s1@uni.test"], ["s2", "s2@uni.test"], ["s3", "s3@uni.test"], ["bAdmin", "admin@unib.test"]]) c[k] = await t.client(email).login();
});
after(() => t.close());

test("projects: only admins create; validation; default milestones", async () => {
  assert.equal((await c.s1.post("/api/projects", { title: "Student made project" })).status, 403);
  assert.equal((await c.sup.post("/api/projects", { title: "Supervisor made project" })).status, 403);
  const bad = await c.admin.post("/api/projects", { title: "abc", start_date: "2026-10-01", due_date: "2026-09-01" });
  assert.equal(bad.status, 422);
  const wrongSup = await c.admin.post("/api/projects", { title: "Library management system", supervisor_id: u.s1 });
  assert.equal(wrongSup.status, 422);
  const r = await c.admin.post("/api/projects", {
    title: "Library management system", department: "Computer Science", academic_year: "2026/2027", supervisor_id: u.sup,
    start_date: "2026-09-01", due_date: "2027-05-30", members: [{ user_id: u.s1, team_role: "leader" }, { user_id: u.s2 }],
  });
  assert.equal(r.status, 201);
  ids.p1 = r.data.project.id;
  const d = await c.admin.get(`/api/projects/${ids.p1}`);
  assert.equal(d.data.milestones.length, 6);
  assert.equal(d.data.milestones.reduce((s, m) => s + m.weight, 0), 100);
  assert.equal(d.data.members.length, 2);
  assert.equal(d.data.members[0].team_role, "leader");
  assert.equal(d.data.progress.percent, 0);
});

test("a student cannot be in two active projects; members must be students", async () => {
  const r = await c.admin.post("/api/projects", { title: "Second project for s1", members: [{ user_id: u.s1 }] });
  assert.equal(r.status, 409);
  const r2 = await c.admin.post("/api/projects", { title: "Project with a supervisor member", members: [{ user_id: u.sup2 }] });
  assert.equal(r2.status, 422);
  const ok = await c.admin.post("/api/projects", { title: "Smart parking prototype", supervisor_id: u.sup2, members: [{ user_id: u.s3, team_role: "leader" }], default_milestones: false });
  assert.equal(ok.status, 201);
  ids.p2 = ok.data.project.id;
});

test("visibility: members, supervisor and admin only", async () => {
  assert.equal((await c.s1.get(`/api/projects/${ids.p1}`)).data.access, "member");
  assert.equal((await c.sup.get(`/api/projects/${ids.p1}`)).data.access, "supervisor");
  assert.equal((await c.admin.get(`/api/projects/${ids.p1}`)).data.access, "admin");
  assert.equal((await c.s3.get(`/api/projects/${ids.p1}`)).status, 404);
  assert.equal((await c.sup2.get(`/api/projects/${ids.p1}`)).status, 404);
  assert.equal((await c.bAdmin.get(`/api/projects/${ids.p1}`)).status, 404);
  assert.equal((await c.s1.get("/api/projects")).data.total, 1);
  assert.equal((await c.sup.get("/api/projects")).data.total, 1);
  assert.equal((await c.admin.get("/api/projects")).data.total, 2);
  assert.equal((await c.bAdmin.get("/api/projects")).data.total, 0);
});

test("project updates: supervisor limited to status/description/due date", async () => {
  assert.equal((await c.sup.patch(`/api/projects/${ids.p1}`, { status: "approved" })).status, 200);
  assert.equal((await c.sup.patch(`/api/projects/${ids.p1}`, { title: "Renamed by supervisor" })).status, 403);
  assert.equal((await c.s1.patch(`/api/projects/${ids.p1}`, { status: "completed" })).status, 403);
  const n = await c.s2.get("/api/notifications");
  assert.ok(n.data.items.some((x) => x.type === "project.status"));
});

test("tasks: team members create and update; assignee must be on the team", async () => {
  const d = await c.s1.get(`/api/projects/${ids.p1}`);
  ids.m1 = d.data.milestones[0].id;
  const r = await c.s1.post(`/api/projects/${ids.p1}/tasks`, { title: "Write the proposal", milestone_id: ids.m1, assignee_id: u.s2, due_date: "2026-10-20" });
  assert.equal(r.status, 201);
  ids.t1 = r.data.task.id;
  assert.equal((await c.s1.post(`/api/projects/${ids.p1}/tasks`, { title: "Bad assignee", assignee_id: u.s3 })).status, 422);
  const foreignMilestone = await c.s1.post(`/api/projects/${ids.p1}/tasks`, { title: "Bad milestone", milestone_id: 99999 });
  assert.equal(foreignMilestone.status, 422);
  const done = await c.s2.patch(`/api/tasks/${ids.t1}`, { status: "done" });
  assert.ok(done.data.task.completed_at);
  assert.equal((await c.s3.patch(`/api/tasks/${ids.t1}`, { status: "todo" })).status, 404);
  const my = await c.s2.get("/api/my-tasks");
  assert.equal(my.data.items.length, 0);
});

test("files: upload with type + magic-byte checks, download, access control", async () => {
  const bad = await c.s1.req("PUT", `/api/projects/${ids.p1}/files?name=virus.exe`, Buffer.from("MZ"), { raw: true, headers: { "content-type": "application/octet-stream" } });
  assert.equal(bad.status, 415);
  const fake = await c.s1.req("PUT", `/api/projects/${ids.p1}/files?name=fake.pdf`, Buffer.from("not a pdf"), { raw: true, headers: { "content-type": "application/pdf" } });
  assert.equal(fake.status, 415);
  const r = await c.s1.req("PUT", `/api/projects/${ids.p1}/files?name=${encodeURIComponent("مقترح المشروع.pdf")}&milestone_id=${ids.m1}`, PDF, { raw: true, headers: { "content-type": "application/pdf" } });
  assert.equal(r.status, 201);
  ids.f1 = r.data.file.id;
  assert.equal(r.data.file.original_name, "مقترح المشروع.pdf");
  const dl = await c.sup.get(`/api/files/${ids.f1}/download`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get("content-disposition"), /attachment/);
  assert.ok(Buffer.compare(dl.data, PDF) === 0);
  assert.equal((await c.s3.get(`/api/files/${ids.f1}/download`)).status, 404);
  assert.equal((await c.bAdmin.get(`/api/files/${ids.f1}/download`)).status, 404);
  const stored = readdirSync(join(t.dataDir, "files", String(A)));
  assert.equal(stored.length, 1);
  assert.ok(!stored[0].includes("pdf"), "stored under a random key, not the user's file name");
});

test("files: uploads without CSRF token are refused", async () => {
  const good = c.s1.csrf;
  c.s1.setCsrf("x");
  const r = await c.s1.req("PUT", `/api/projects/${ids.p1}/files?name=a.txt`, Buffer.from("hello"), { raw: true, headers: { "content-type": "text/plain" } });
  assert.equal(r.status, 403);
  c.s1.setCsrf(good);
});

test("milestones: submit → supervisor reviews → progress is weighted", async () => {
  assert.equal((await c.sup.post(`/api/milestones/${ids.m1}/submit`, {})).status, 403);
  const s = await c.s1.post(`/api/milestones/${ids.m1}/submit`, { note: "Proposal attached" });
  assert.equal(s.data.milestone.status, "submitted");
  assert.equal((await c.s1.post(`/api/milestones/${ids.m1}/submit`, {})).status, 409);
  const n = await c.sup.get("/api/notifications?unread=1");
  assert.ok(n.data.items.some((x) => x.type === "milestone.submitted"));
  assert.equal((await c.sup.post(`/api/milestones/${ids.m1}/review`, { decision: "needs_changes" })).status, 422);
  const nc = await c.sup.post(`/api/milestones/${ids.m1}/review`, { decision: "needs_changes", comment: "Add a literature review" });
  assert.equal(nc.data.milestone.status, "needs_changes");
  await c.s1.post(`/api/milestones/${ids.m1}/submit`, {});
  const ok = await c.sup.post(`/api/milestones/${ids.m1}/review`, { decision: "approved" });
  assert.equal(ok.data.milestone.status, "approved");
  assert.equal(ok.data.progress.percent, 10);
  assert.equal((await c.s1.post(`/api/milestones/${ids.m1}/review`, { decision: "approved" })).status, 403);
  const d = await c.s2.get(`/api/projects/${ids.p1}`);
  assert.ok(d.data.feedback.some((f) => f.kind === "needs_changes"));
});

test("milestones: supervisor adds a custom one; cannot delete one with files", async () => {
  const r = await c.sup.post(`/api/projects/${ids.p1}/milestones`, { title: "Usability study", weight: 5, due_date: "2027-03-01" });
  assert.equal(r.status, 201);
  assert.equal((await c.s1.post(`/api/projects/${ids.p1}/milestones`, { title: "Student milestone" })).status, 403);
  assert.equal((await c.sup.del(`/api/milestones/${ids.m1}`)).status, 409);
  assert.equal((await c.sup.del(`/api/milestones/${r.data.milestone.id}`)).status, 200);
});

test("feedback and rubric evaluation", async () => {
  assert.equal((await c.s1.post(`/api/projects/${ids.p1}/feedback`, { body: "self praise" })).status, 403);
  assert.equal((await c.sup.post(`/api/projects/${ids.p1}/feedback`, { body: "Good start, focus on the ERD" })).status, 201);
  const over = await c.sup.post(`/api/projects/${ids.p1}/evaluations`, { criteria: [{ name: "Implementation", max: 30, score: 31 }] });
  assert.equal(over.status, 422);
  const e = await c.sup.post(`/api/projects/${ids.p1}/evaluations`, { criteria: [{ name: "Analysis", max: 20, score: 17 }, { name: "Implementation", max: 30, score: 25 }], comments: "Solid work", is_final: true });
  assert.equal(e.status, 201);
  assert.equal(e.data.evaluation.total, 42);
  assert.equal(e.data.evaluation.max_total, 50);
  const d = await c.s2.get(`/api/projects/${ids.p1}`);
  assert.equal(d.data.evaluations.length, 1);
  assert.equal(d.data.evaluations[0].criteria.length, 2);
});

test("team management and deletion rules", async () => {
  assert.equal((await c.admin.post(`/api/projects/${ids.p2}/members`, { user_id: u.s1 })).status, 409);
  assert.equal((await c.admin.post(`/api/projects/${ids.p2}/members`, { user_id: u.s3 })).status, 409);
  assert.equal((await c.sup2.post(`/api/projects/${ids.p2}/members`, { user_id: u.s2 })).status, 403);
  assert.equal((await c.admin.del(`/api/projects/${ids.p1}`)).status, 409);
  const tmp = await c.admin.post("/api/projects", { title: "Temporary project to delete" });
  assert.equal((await c.admin.del(`/api/projects/${tmp.data.project.id}`)).status, 200);
});

test("dashboards are role scoped", async () => {
  const s = await c.s1.get("/api/dashboard");
  assert.equal(s.data.counts.total, 1);
  assert.equal(s.data.supervisors, null);
  const sp = await c.sup.get("/api/dashboard");
  assert.equal(sp.data.counts.total, 1);
  const a = await c.admin.get("/api/dashboard");
  assert.equal(a.data.counts.total, 2);
  assert.ok(a.data.supervisors.length === 2);
});

test("reports and CSV export (staff only)", async () => {
  assert.equal((await c.s1.get("/api/reports/summary")).status, 403);
  const r = await c.admin.get("/api/reports/summary");
  assert.equal(r.data.total, 2);
  assert.equal(r.data.avg_final_score_pct, 84);
  const csv = await c.admin.get("/api/reports/export");
  assert.match(csv.data.toString("utf8"), /Library management system/);
  const sup = await c.sup.get("/api/reports/summary");
  assert.equal(sup.data.total, 1);
});

test("search is scoped", async () => {
  assert.equal((await c.s3.get("/api/search?q=Library")).data.projects.length, 0);
  assert.equal((await c.s1.get("/api/search?q=Library")).data.projects.length, 1);
  assert.equal((await c.s1.get("/api/search?q=uni")).data.users.length, 0);
  assert.ok((await c.admin.get("/api/search?q=uni")).data.users.length > 0);
});

test("file deletion removes bytes; audit trail kept", async () => {
  const r = await c.s2.req("PUT", `/api/projects/${ids.p1}/files?name=notes.txt`, Buffer.from("meeting notes"), { raw: true, headers: { "content-type": "text/plain" } });
  assert.equal((await c.s1.del(`/api/files/${r.data.file.id}`)).status, 403);
  assert.equal((await c.s2.del(`/api/files/${r.data.file.id}`)).status, 200);
  assert.equal(readdirSync(join(t.dataDir, "files", String(A))).length, 1);
  const a = await c.admin.get("/api/audit?entity=file");
  const actions = a.data.items.map((x) => x.action);
  for (const x of ["file.upload", "file.download", "file.delete"]) assert.ok(actions.includes(x), x);
  assert.ok(existsSync(t.dataDir));
});
