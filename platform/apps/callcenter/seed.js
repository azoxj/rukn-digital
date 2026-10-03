// Demo data for AZENK Call Center (fictional people, example.com e-mails,
// 0500000xxx phone numbers). Used only by `npm run seed:demo`.
import { localToday, localDayStartIso } from "../../core/time.js";

const FIRST = ["محمد", "عبدالله", "فهد", "سارة", "نورة", "خالد", "ريم", "سلطان", "هند", "ماجد", "لمى", "تركي", "أمل", "ياسر", "جود", "بدر", "منيرة", "عمر", "دانة", "سعود", "شهد", "نايف", "رهف", "مشعل", "غادة"];
const LAST = ["العتيبي", "القحطاني", "الشهري", "الغامدي", "الدوسري", "الحربي", "المطيري", "الزهراني", "السبيعي", "العنزي"];
const CITIES = ["الرياض", "جدة", "الدمام", "مكة المكرمة", "المدينة المنورة", "الخبر", "أبها", "تبوك"];
const COMPANIES = [null, null, "مؤسسة تجريبية للتجارة", "شركة نموذجية للخدمات", "متجر تجريبي", null, "مكتب عينة للاستشارات"];
const SUBJECTS = [
  ["complaint", "تأخر توصيل الطلب"], ["inquiry", "استفسار عن حالة الطلب"], ["billing", "طلب استرجاع مبلغ"], ["technical", "مشكلة في تسجيل الدخول للتطبيق"],
  ["sales", "طلب عرض سعر لكمية كبيرة"], ["general", "تحديث بيانات الحساب"], ["complaint", "منتج غير مطابق للوصف"], ["technical", "الرسائل لا تصل للجوال"],
  ["billing", "فاتورة مكررة"], ["inquiry", "مواعيد العمل خلال الإجازة"], ["sales", "الاستفسار عن الباقات"], ["general", "طلب إلغاء الاشتراك"],
];
const OUTCOMES = ["تم حل الاستفسار", "تم فتح تذكرة", "سيعاود العميل الاتصال", "تم تحويل الطلب للقسم المختص", "تم تأكيد الطلب", null];

function rng(seed) { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }

export function seedDemo(db, hash) {
  const r = rng(42);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const today = localToday();
  const dayStart = (n) => Date.parse(localDayStartIso(today, n));

  const orgId = db.prepare("INSERT INTO organizations (name, slug) VALUES (?, ?)").run("منشأة تجريبية", "demo").lastInsertRowid;
  const mkUser = (role, email, name) => db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,0)").run(orgId, email, name, role, hash).lastInsertRowid;
  const users = {
    root: mkUser("SUPER_ADMIN", "superadmin@example.com", "مدير المنصة (تجريبي)"),
    admin: mkUser("ADMIN", "admin@example.com", "مدير النظام (تجريبي)"),
    sup: mkUser("SUPERVISOR", "supervisor@example.com", "مشرفة الفريق — ريم"),
    agents: [mkUser("AGENT", "agent1@example.com", "خالد — خدمة العملاء"), mkUser("AGENT", "agent2@example.com", "نورة — خدمة العملاء"), mkUser("AGENT", "agent3@example.com", "ياسر — خدمة العملاء")],
  };

  const customers = [];
  for (let i = 0; i < 28; i++) {
    const name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`;
    const phone = `0500000${String(100 + i).padStart(3, "0")}`;
    const created = new Date(dayStart(-int(20, 60)) + int(8, 20) * 3600000).toISOString();
    customers.push(db.prepare("INSERT INTO customers (org_id, name, phone, email, company, city, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(orgId, name, phone, r() > 0.5 ? `customer${i + 1}@example.com` : null, pick(COMPANIES), pick(CITIES), r() > 0.8 ? "عميل يفضّل التواصل مساءً" : null, pick(users.agents), created, created).lastInsertRowid);
  }

  const insTicket = db.prepare("INSERT INTO tickets (org_id, number, customer_id, subject, description, category, status, priority, assignee_id, created_by, due_at, resolved_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const insHist = db.prepare("INSERT INTO ticket_history (org_id, ticket_id, user_id, field, from_value, to_value, created_at) VALUES (?,?,?,?,?,?,?)");
  const insComment = db.prepare("INSERT INTO ticket_comments (org_id, ticket_id, user_id, body, created_at) VALUES (?,?,?,?,?)");
  const tickets = [];
  const statuses = ["open", "open", "in_progress", "in_progress", "pending", "resolved", "resolved", "resolved", "closed"];
  for (let i = 0; i < 34; i++) {
    const [category, subject] = pick(SUBJECTS);
    const customer = pick(customers);
    const agent = r() > 0.12 ? pick(users.agents) : null;
    const status = agent ? pick(statuses) : "open";
    const createdMs = dayStart(-int(0, 20)) + int(8, 21) * 3600000;
    const created = new Date(Math.min(createdMs, Date.now() - 3600000)).toISOString();
    const resolved = ["resolved", "closed"].includes(status) ? new Date(Math.min(Date.parse(created) + int(1, 72) * 3600000, Date.now())).toISOString() : null;
    const due = r() > 0.4 ? new Date(Date.parse(created) + int(24, 120) * 3600000).toISOString() : null;
    const priority = pick(["low", "medium", "medium", "high", "high", "urgent"]);
    const id = insTicket.run(orgId, 1001 + i, customer, subject, "تفاصيل تجريبية للتذكرة: وصف المشكلة كما ذكرها العميل في المكالمة.", category, status, priority, agent, agent || users.sup, due, resolved, created, resolved || created).lastInsertRowid;
    if (status !== "open") insHist.run(orgId, id, agent || users.sup, "status", "open", status, resolved || created);
    if (r() > 0.5) insComment.run(orgId, id, agent || users.sup, "تم التواصل مع العميل وجارٍ المتابعة.", new Date(Date.parse(created) + 1800000).toISOString());
    tickets.push({ id, customer, agent });
  }

  const insCall = db.prepare("INSERT INTO calls (org_id, customer_id, agent_id, ticket_id, direction, status, started_at, duration_sec, outcome, notes) VALUES (?,?,?,?,?,?,?,?,?,?)");
  for (let d = -13; d <= 0; d++) {
    const n = int(6, 14);
    for (let i = 0; i < n; i++) {
      const started = dayStart(d) + int(8, 21) * 3600000 + int(0, 59) * 60000;
      if (started > Date.now()) continue;
      const status = pick(["answered", "answered", "answered", "answered", "missed", "no_answer", "busy", "voicemail"]);
      const t = r() > 0.75 ? pick(tickets) : null;
      insCall.run(orgId, t ? t.customer : pick(customers), t && t.agent ? t.agent : pick(users.agents), t ? t.id : null, r() > 0.35 ? "inbound" : "outbound", status,
        new Date(started).toISOString(), status === "answered" ? int(45, 900) : 0, status === "answered" ? pick(OUTCOMES) : null, status === "answered" && r() > 0.5 ? "ملاحظات تجريبية عن المكالمة." : null);
    }
  }

  const insTask = db.prepare("INSERT INTO tasks (org_id, type, title, customer_id, ticket_id, assignee_id, priority, status, due_at, completed_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  const titles = ["الاتصال بالعميل لتأكيد الحل", "إرسال عرض السعر", "متابعة حالة الشحنة", "تأكيد استرجاع المبلغ", "مراجعة الطلب مع القسم الفني"];
  for (let i = 0; i < 22; i++) {
    const t = pick(tickets);
    const due = new Date(Date.now() + int(-3, 5) * 86400000 + int(-5, 5) * 3600000).toISOString();
    const done = Date.parse(due) < Date.now() && r() > 0.5;
    insTask.run(orgId, r() > 0.25 ? "followup" : "task", pick(titles), t.customer, r() > 0.4 ? t.id : null, t.agent || pick(users.agents), pick(["low", "medium", "high", "urgent"]), done ? "done" : "open", due, done ? due : null, users.sup);
  }

  return [
    ["SUPER_ADMIN", "superadmin@example.com"], ["ADMIN", "admin@example.com"], ["SUPERVISOR", "supervisor@example.com"],
    ["AGENT", "agent1@example.com"], ["AGENT", "agent2@example.com"], ["AGENT", "agent3@example.com"],
  ];
}
