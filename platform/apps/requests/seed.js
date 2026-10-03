// Demo data for AZENK Requests (fictional people, example.com e-mails).
// Used only by `npm run seed:demo -- --app requests`.
import { STARTER_TYPES } from "./app.js";
import { localToday, shiftDay } from "../../core/time.js";

export function seedDemo(db, hash) {
  const orgId = db.prepare("INSERT INTO organizations (name, slug) VALUES (?, ?)").run("شركة تجريبية", "demo").lastInsertRowid;
  const mk = (role, email, name) => db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,0)").run(orgId, email, name, role, hash).lastInsertRowid;
  const prof = (uid, manager, dept) => db.prepare("INSERT INTO user_profiles (user_id, org_id, manager_id, department) VALUES (?,?,?,?)").run(uid, orgId, manager, dept);
  const admin = mk("ADMIN", "admin@example.com", "إدارة الموارد البشرية (تجريبي)");
  const admin2 = mk("ADMIN", "it@example.com", "تقنية المعلومات (تجريبي)");
  const m1 = mk("MANAGER", "manager1@example.com", "سلطان — مدير المبيعات");
  const m2 = mk("MANAGER", "manager2@example.com", "هند — مديرة العمليات");
  const emps = [["employee1@example.com", "خالد"], ["employee2@example.com", "نورة"], ["employee3@example.com", "ماجد"], ["employee4@example.com", "ريم"], ["employee5@example.com", "تركي"]]
    .map(([e, n], i) => { const id = mk("EMPLOYEE", e, `${n} (موظف تجريبي)`); prof(id, i < 3 ? m1 : m2, i < 3 ? "المبيعات" : "العمليات"); return id; });
  prof(admin, null, "الموارد البشرية"); prof(admin2, null, "تقنية المعلومات"); prof(m1, null, "المبيعات"); prof(m2, null, "العمليات");

  const types = STARTER_TYPES.map((t) => ({ ...t, id: db.prepare("INSERT INTO request_types (org_id, name, description, category, fields, steps, sla_hours, created_by) VALUES (?,?,?,?,?,?,?,?)")
    .run(orgId, t.name, t.description, t.category, JSON.stringify(t.fields), JSON.stringify(t.steps), t.sla_hours, admin).lastInsertRowid }));
  const T = Object.fromEntries(types.map((t) => [t.name, t]));
  const today = localToday();
  const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
  let number = 1000;

  // plan: [type, requester, title, data, outcomes[] per step ("approved"|"rejected"|"returned"|"pending"), ageHours]
  const managerOf = (uid) => db.prepare("SELECT manager_id FROM user_profiles WHERE user_id = ?").get(uid).manager_id;
  const plans = [
    ["طلب إجازة", emps[0], "إجازة سنوية — نهاية الشهر", { leave_type: "سنوية", start_date: shiftDay(today, 20), end_date: shiftDay(today, 26), reason: "سفر عائلي" }, ["pending"], 5],
    ["طلب إجازة", emps[1], "إجازة مرضية يومين", { leave_type: "مرضية", start_date: shiftDay(today, -3), end_date: shiftDay(today, -2), reason: "" }, ["approved", "approved"], 90],
    ["طلب إجازة", emps[3], "إجازة اضطرارية", { leave_type: "اضطرارية", start_date: shiftDay(today, 2), end_date: shiftDay(today, 3), reason: "ظرف عائلي" }, ["approved", "pending"], 30],
    ["طلب شراء", emps[2], "شاشة إضافية لقسم المبيعات", { item: "شاشة 27 بوصة", quantity: 2, estimated_cost: 2400, justification: "لعرض لوحات المبيعات أثناء الاجتماعات" }, ["pending"], 60],
    ["طلب شراء", emps[4], "أدوات مكتبية للربع القادم", { item: "أدوات مكتبية متنوعة", quantity: 1, estimated_cost: 900, justification: "مخزون الربع الرابع" }, ["approved", "approved"], 200],
    ["طلب شراء", emps[0], "اشتراك برنامج تصميم", { item: "اشتراك سنوي", quantity: 1, estimated_cost: 3000, justification: "لإعداد العروض التسويقية" }, ["returned"], 50],
    ["طلب شراء", emps[3], "كرسي مكتب", { item: "كرسي مكتب طبي", quantity: 1, estimated_cost: 1200, justification: "ألم في الظهر" }, ["approved", "rejected"], 150],
    ["طلب دعم تقني", emps[1], "لا أستطيع الدخول للبريد", { issue_type: "حساب أو صلاحية", details: "رسالة خطأ عند تسجيل الدخول منذ الصباح", urgent: true }, ["pending"], 3],
    ["طلب دعم تقني", emps[2], "الطابعة لا تعمل", { issue_type: "عطل جهاز", details: "الطابعة في الدور الثاني تعطي خطأ ورق", urgent: false }, ["approved"], 40],
    ["طلب دعم تقني", emps[4], "تثبيت برنامج الإكسل", { issue_type: "برنامج", details: "أحتاج نسخة محدثة", urgent: false }, ["pending"], 12],
    ["خطاب تعريف", emps[3], "خطاب تعريف للبنك", { addressed_to: "البنك", with_salary: true }, ["approved"], 80],
    ["خطاب تعريف", emps[0], "خطاب تعريف للسفارة", { addressed_to: "سفارة", with_salary: false }, ["pending"], 52],
  ];
  for (const [typeName, req, title, data, outcomes, age] of plans) {
    const t = T[typeName];
    number += 1;
    const created = hoursAgo(age);
    const last = outcomes[outcomes.length - 1];
    const status = last === "pending" ? "pending" : last;
    const rid = db.prepare("INSERT INTO requests (org_id, number, type_id, type_name, fields, steps, requester_id, title, data, status, current_step, sla_hours, step_due_at, decided_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(orgId, number, t.id, t.name, JSON.stringify(t.fields), JSON.stringify(t.steps), req, title, JSON.stringify(data), status, outcomes.length - 1, t.sla_hours,
        status === "pending" ? new Date(Date.parse(created) + (age > t.sla_hours ? t.sla_hours * 0.5 : t.sla_hours) * 3600000).toISOString() : null,
        ["approved", "rejected"].includes(status) ? hoursAgo(Math.max(1, age - 20)) : null, created, hoursAgo(Math.max(1, age - 20))).lastInsertRowid;
    outcomes.forEach((o, i) => {
      const def = t.steps[i];
      const mgr = def.approver === "manager" ? managerOf(req) : null;
      const role = mgr ? null : def.approver.slice(5);
      const decider = mgr || (t.name === "طلب دعم تقني" ? admin2 : admin);
      const at = hoursAgo(Math.max(1, age - 10 * (i + 1)));
      db.prepare("INSERT INTO approval_steps (org_id, request_id, step_index, name, approver_user_id, approver_role, status, comment, decided_by, decided_at, due_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(orgId, rid, i, def.name, mgr, role, o, o === "returned" ? "يرجى إرفاق عرض السعر من المورد" : o === "rejected" ? "خارج الميزانية المعتمدة لهذا الربع" : null,
          o === "pending" ? null : decider, o === "pending" ? null : at, new Date(Date.parse(created) + t.sla_hours * 3600000).toISOString(), created);
    });
  }
  return [["ADMIN", "admin@example.com"], ["ADMIN", "it@example.com"], ["MANAGER", "manager1@example.com"], ["MANAGER", "manager2@example.com"], ["EMPLOYEE", "employee1@example.com"], ["EMPLOYEE", "employee2@example.com"]];
}
