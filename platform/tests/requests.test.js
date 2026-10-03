import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers.js";
import { requestsApp, validateData } from "../apps/requests/app.js";

let t, A, B, u = {}, c = {}, ids = {};
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n");

before(async () => {
  t = await boot(requestsApp);
  A = t.org("Company A", "co-a");
  B = t.org("Company B", "co-b");
  u.admin = t.user(A, "ADMIN", "admin@a.test");
  u.admin2 = t.user(A, "ADMIN", "admin2@a.test");
  u.mgr = t.user(A, "MANAGER", "mgr@a.test");
  u.emp = t.user(A, "EMPLOYEE", "emp@a.test");
  u.emp2 = t.user(A, "EMPLOYEE", "emp2@a.test");
  u.bAdmin = t.user(B, "ADMIN", "admin@b.test");
  for (const [k, e] of [["admin", "admin@a.test"], ["admin2", "admin2@a.test"], ["mgr", "mgr@a.test"], ["emp", "emp@a.test"], ["emp2", "emp2@a.test"], ["bAdmin", "admin@b.test"]]) c[k] = await t.client(e).login();
});
after(() => t.close());

const leaveData = { leave_type: "سنوية", start_date: "2026-11-01", end_date: "2026-11-05", reason: "سفر" };

test("starter templates install once (admin only)", async () => {
  assert.equal((await c.emp.post("/api/types/starter")).status, 403);
  assert.equal((await c.admin.post("/api/types/starter")).data.added, 4);
  assert.equal((await c.admin.post("/api/types/starter")).data.added, 0);
  const types = (await c.emp.get("/api/types")).data.items;
  assert.equal(types.length, 4);
  ids.leave = types.find((x) => x.name === "طلب إجازة").id;
  ids.it = types.find((x) => x.name === "طلب دعم تقني").id;
  assert.equal((await c.bAdmin.get("/api/types")).data.items.length, 0, "types are per organisation");
});

test("type definitions are validated", async () => {
  const base = { name: "Custom", fields: [{ key: "a", label: "A", type: "text" }], steps: [{ name: "Approve", approver: "role:ADMIN" }] };
  assert.equal((await c.admin.post("/api/types", { ...base, fields: [{ key: "Bad Key", label: "A", type: "text" }] })).status, 422);
  assert.equal((await c.admin.post("/api/types", { ...base, fields: [{ key: "a", label: "A", type: "select" }] })).status, 422);
  assert.equal((await c.admin.post("/api/types", { ...base, fields: [{ key: "a", label: "A", type: "text" }, { key: "a", label: "B", type: "text" }] })).status, 422);
  assert.equal((await c.admin.post("/api/types", { ...base, steps: [{ name: "X", approver: "boss" }] })).status, 422);
  assert.equal((await c.admin.post("/api/types", { ...base, steps: [{ name: "X", approver: `user:${u.bAdmin}` }] })).status, 422, "approver from another org");
  assert.equal((await c.admin.post("/api/types", { ...base, name: "طلب إجازة" })).status, 422, "duplicate name");
  const ok = await c.admin.post("/api/types", { ...base, steps: [{ name: "Manager", approver: `user:${u.mgr}` }] });
  assert.equal(ok.status, 201);
  ids.custom = ok.data.type.id;
});

test("data validation against fields", () => {
  const fields = [{ key: "n", label: "N", type: "number", required: true }, { key: "s", label: "S", type: "select", options: ["x"], required: true }, { key: "start_date", label: "", type: "date" }, { key: "end_date", label: "", type: "date" }];
  assert.throws(() => validateData(fields, { n: "abc", s: "y" }), (e) => !!(e.fields["data.n"] && e.fields["data.s"]));
  assert.throws(() => validateData(fields, { n: 1, s: "x", start_date: "2026-02-02", end_date: "2026-01-01" }), (e) => !!e.fields["data.end_date"]);
  assert.deepEqual(validateData(fields, { n: "5", s: "x", extra: "dropped" }), { n: 5, s: "x" });
});

test("people: manager assignment with cycle protection", async () => {
  assert.equal((await c.admin.patch(`/api/people/${u.emp}`, { manager_id: u.mgr, department: "Sales" })).status, 200);
  assert.equal((await c.admin.patch(`/api/people/${u.emp2}`, { manager_id: u.mgr })).status, 200);
  assert.equal((await c.admin.patch(`/api/people/${u.mgr}`, { manager_id: u.emp })).status, 422, "cycle");
  assert.equal((await c.admin.patch(`/api/people/${u.emp}`, { manager_id: u.emp })).status, 422, "self");
  assert.equal((await c.emp.patch(`/api/people/${u.emp2}`, { manager_id: u.emp })).status, 403);
});

test("create request: validation, numbering, routed to direct manager", async () => {
  const badReq = await c.emp.post("/api/requests", { type_id: ids.leave, title: "إجازة", data: { leave_type: "غير موجود" } });
  assert.equal(badReq.status, 422);
  assert.ok(badReq.data.error.fields["data.leave_type"] && badReq.data.error.fields["data.start_date"]);
  const r = await c.emp.post("/api/requests", { type_id: ids.leave, title: "إجازة سنوية نوفمبر", data: leaveData });
  assert.equal(r.status, 201);
  assert.equal(r.data.request.number, 1001);
  ids.r1 = r.data.request.id;
  const n = await c.mgr.get("/api/notifications?unread=1");
  assert.ok(n.data.items.some((x) => x.type === "approval.pending"));
  const inbox = await c.mgr.get("/api/approvals");
  assert.equal(inbox.data.total, 1);
  assert.equal((await c.admin.get("/api/approvals")).data.total, 0, "admins not yet involved");
});

test("visibility: requester, manager, approver, admin — not peers or other orgs", async () => {
  assert.equal((await c.emp.get(`/api/requests/${ids.r1}`)).status, 200);
  assert.equal((await c.mgr.get(`/api/requests/${ids.r1}`)).status, 200);
  assert.equal((await c.admin.get(`/api/requests/${ids.r1}`)).status, 200);
  assert.equal((await c.emp2.get(`/api/requests/${ids.r1}`)).status, 404);
  assert.equal((await c.bAdmin.get(`/api/requests/${ids.r1}`)).status, 404);
  assert.equal((await c.emp2.get("/api/requests?scope=all")).status, 403);
  assert.equal((await c.mgr.get("/api/requests?scope=team")).data.total, 1);
});

test("decisions: only the assigned approver, comment required for return/reject", async () => {
  assert.equal((await c.emp2.post(`/api/requests/${ids.r1}/decide`, { decision: "approve" })).status, 404);
  assert.equal((await c.admin.post(`/api/requests/${ids.r1}/decide`, { decision: "approve" })).status, 403, "not admin's step yet");
  assert.equal((await c.mgr.post(`/api/requests/${ids.r1}/decide`, { decision: "return" })).status, 422);
  const ret = await c.mgr.post(`/api/requests/${ids.r1}/decide`, { decision: "return", comment: "حدد البديل أثناء الإجازة" });
  assert.equal(ret.data.request.status, "returned");
  assert.ok((await c.emp.get("/api/notifications?unread=1")).data.items.some((x) => x.type === "request.returned"));
});

test("resubmit after return restarts the same step; peers cannot resubmit", async () => {
  assert.equal((await c.emp2.post(`/api/requests/${ids.r1}/resubmit`, { data: leaveData })).status, 404);
  assert.equal((await c.emp.post(`/api/requests/${ids.r1}/resubmit`, { data: { ...leaveData, end_date: "2026-10-01" } })).status, 422);
  const rs = await c.emp.post(`/api/requests/${ids.r1}/resubmit`, { data: { ...leaveData, reason: "سفر — البديل: أحمد" } });
  assert.equal(rs.data.request.status, "pending");
  assert.equal(rs.data.request.current_step, 0);
});

test("multi-step approval: manager → any ADMIN; final status + notification", async () => {
  const s1 = await c.mgr.post(`/api/requests/${ids.r1}/decide`, { decision: "approve", comment: "موافق" });
  assert.equal(s1.data.request.status, "pending");
  assert.equal(s1.data.request.current_step, 1);
  assert.equal((await c.mgr.post(`/api/requests/${ids.r1}/decide`, { decision: "approve" })).status, 403, "manager cannot approve the HR step");
  assert.equal((await c.admin2.get("/api/approvals")).data.total, 1, "role step reaches every admin");
  const s2 = await c.admin2.post(`/api/requests/${ids.r1}/decide`, { decision: "approve" });
  assert.equal(s2.data.request.status, "approved");
  assert.ok(s2.data.request.decided_at);
  assert.equal((await c.admin.post(`/api/requests/${ids.r1}/decide`, { decision: "approve" })).status, 409, "already decided");
  const d = await c.emp.get(`/api/requests/${ids.r1}`);
  assert.deepEqual(d.data.approvals.map((a) => a.status), ["returned", "approved", "approved"]);
  assert.ok((await c.emp.get("/api/notifications")).data.items.some((x) => x.type === "request.approved"));
  assert.equal((await c.admin2.get("/api/approvals?status=decided")).data.total, 1);
});

test("no self-approval: an admin's own request goes to another admin", async () => {
  const r = await c.admin.post("/api/requests", { type_id: ids.it, title: "جهاز جديد", data: { issue_type: "عطل جهاز", details: "الشاشة لا تعمل", urgent: true } });
  assert.equal((await c.admin.post(`/api/requests/${r.data.request.id}/decide`, { decision: "approve" })).status, 403);
  assert.equal((await c.admin.get("/api/approvals")).data.items.length, 0, "own request not in own inbox");
  assert.equal((await c.admin2.post(`/api/requests/${r.data.request.id}/decide`, { decision: "reject", comment: "استخدم الجهاز الاحتياطي" })).data.request.status, "rejected");
});

test("employee without a manager is routed to admins; direct-user steps work", async () => {
  const r = await c.mgr.post("/api/requests", { type_id: ids.leave, title: "إجازة مدير", data: leaveData });
  const d = await c.admin.get(`/api/requests/${r.data.request.id}`);
  assert.equal(d.data.approvals[0].approver_role, "ADMIN");
  const cu = await c.emp.post("/api/requests", { type_id: ids.custom, title: "طلب مخصص", data: { a: "x" } });
  assert.equal((await c.mgr.get("/api/approvals")).data.items.some((x) => x.id === cu.data.request.id), true);
});

test("cancel by requester only while open", async () => {
  const r = await c.emp2.post("/api/requests", { type_id: ids.it, title: "طابعة", data: { issue_type: "أخرى", details: "الطابعة لا تطبع" } });
  assert.equal((await c.emp.post(`/api/requests/${r.data.request.id}/cancel`)).status, 404);
  assert.equal((await c.emp2.post(`/api/requests/${r.data.request.id}/cancel`)).status, 200);
  assert.equal((await c.emp2.post(`/api/requests/${r.data.request.id}/cancel`)).status, 409);
  assert.equal((await c.admin.post(`/api/requests/${r.data.request.id}/decide`, { decision: "approve" })).status, 409);
});

test("comments and attachments with access rules", async () => {
  const r = await c.emp.post("/api/requests", { type_id: ids.leave, title: "إجازة مرضية", data: { ...leaveData, leave_type: "مرضية" } });
  ids.r2 = r.data.request.id;
  const up = await c.emp.req("PUT", `/api/requests/${ids.r2}/files?name=${encodeURIComponent("تقرير طبي.pdf")}`, PDF, { raw: true, headers: { "content-type": "application/pdf" } });
  assert.equal(up.status, 201);
  assert.equal((await c.emp.req("PUT", `/api/requests/${ids.r2}/files?name=x.exe`, Buffer.from("MZ"), { raw: true })).status, 415);
  assert.equal((await c.emp2.req("PUT", `/api/requests/${ids.r2}/files?name=a.txt`, Buffer.from("x"), { raw: true })).status, 404);
  const dl = await c.mgr.get(`/api/request-files/${up.data.file.id}/download`);
  assert.equal(dl.status, 200);
  assert.ok(Buffer.compare(dl.data, PDF) === 0);
  assert.equal((await c.emp2.get(`/api/request-files/${up.data.file.id}/download`)).status, 404);
  assert.equal((await c.mgr.post(`/api/requests/${ids.r2}/comments`, { body: "هل التقرير معتمد؟" })).status, 201);
  assert.ok((await c.emp.get("/api/notifications?unread=1")).data.items.some((x) => x.type === "request.comment"));
});

test("type edits do not change submitted requests (snapshot)", async () => {
  const t0 = (await c.admin.get(`/api/types/${ids.leave}`)).data.type;
  const res = await c.admin.put(`/api/types/${ids.leave}`, { ...t0, fields: [...t0.fields, { key: "phone", label: "جوال التواصل", type: "text", required: true }] });
  assert.equal(res.status, 200);
  const d = await c.emp.get(`/api/requests/${ids.r2}`);
  assert.equal(d.data.request.fields.length, 4);
  assert.equal((await c.emp.post("/api/requests", { type_id: ids.leave, title: "بدون جوال", data: leaveData })).status, 422, "new requests use new fields");
  await c.admin.put(`/api/types/${ids.leave}`, { ...t0, is_active: false });
  assert.equal((await c.emp.post("/api/requests", { type_id: ids.leave, title: "نوع موقوف", data: leaveData })).status, 404);
  assert.equal((await c.emp.get("/api/types")).data.items.length, 4, "4 active incl. custom");
});

test("dashboard, reports, CSV, search, audit", async () => {
  const dm = await c.mgr.get("/api/dashboard");
  assert.ok(dm.data.inbox.n >= 1);
  assert.equal(dm.data.org, null);
  assert.ok((await c.admin.get("/api/dashboard")).data.org.total >= 5);
  assert.equal((await c.emp.get("/api/reports/summary")).status, 403);
  const rep = await c.admin.get("/api/reports/summary");
  assert.ok(rep.data.by_type.some((x) => x.type_name === "طلب إجازة" && x.approved === 1));
  assert.ok(rep.data.approvers.some((x) => x.id === u.mgr));
  const csv = await c.admin.get("/api/reports/export");
  assert.match(csv.data.toString("utf8"), /إجازة سنوية نوفمبر/);
  assert.equal((await c.emp2.get("/api/search?q=نوفمبر")).data.requests.length, 0);
  assert.equal((await c.emp.get("/api/search?q=نوفمبر")).data.requests.length, 1);
  assert.equal((await c.emp.get("/api/search?q=1001")).data.requests[0].id, ids.r1);
  const acts = (await c.admin.get("/api/audit?entity=request")).data.items.map((x) => x.action);
  for (const a of ["request.create", "request.approve", "request.return", "request.reject", "request.resubmit", "request.cancel"]) assert.ok(acts.includes(a), a);
});
