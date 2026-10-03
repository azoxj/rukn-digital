// Demo data for AZENK Graduation (fictional people, example.com e-mails).
// Used only by `npm run seed:demo -- --app graduation`.
import { DEFAULT_MILESTONES } from "./app.js";
import { localToday, shiftDay } from "../../core/time.js";

const STUDENTS = ["عبدالله", "سارة", "فهد", "نورة", "خالد", "ريم", "ماجد", "لمى", "تركي", "جود", "بدر", "دانة", "سلطان", "شهد"];
const PROJECTS = [
  ["نظام إدارة المكتبة الجامعية", "علوم الحاسب", "نظام ويب لإدارة الكتب والإعارات والحجوزات مع لوحة تحكم للموظفين وإشعارات للطلاب."],
  ["تطبيق حجز مواعيد العيادات", "نظم المعلومات", "تطبيق يتيح للمرضى حجز المواعيد ومتابعة الحجوزات، ولوحة للعيادة لإدارة الجداول."],
  ["منصة تطوع طلابية", "نظم المعلومات", "منصة تربط الطلاب بالفرص التطوعية وتسجل الساعات وتصدر الشهادات."],
  ["نظام متابعة الحضور بالرمز QR", "علوم الحاسب", "نظام لتسجيل حضور المحاضرات عبر رمز QR متغير مع تقارير لأعضاء هيئة التدريس."],
  ["متجر إلكتروني للمنتجات المحلية", "هندسة البرمجيات", "متجر ويب للأسر المنتجة مع إدارة المنتجات والطلبات والتقارير."],
];

export function seedDemo(db, hash) {
  const today = localToday();
  const orgId = db.prepare("INSERT INTO organizations (name, slug) VALUES (?, ?)").run("جامعة تجريبية", "demo").lastInsertRowid;
  const mk = (role, email, name) => db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,0)").run(orgId, email, name, role, hash).lastInsertRowid;
  const admin = mk("ADMIN", "admin@example.com", "منسق مشاريع التخرج (تجريبي)");
  const sups = [mk("SUPERVISOR", "supervisor1@example.com", "د. أحمد — مشرف"), mk("SUPERVISOR", "supervisor2@example.com", "د. هيفاء — مشرفة")];
  const students = STUDENTS.map((n, i) => mk("STUDENT", `student${i + 1}@example.com`, `${n} (طالب تجريبي)`));

  const statuses = ["in_progress", "in_progress", "approved", "submitted", "proposal"];
  const approvedCount = [3, 2, 1, 5, 0];
  PROJECTS.forEach(([title, dept, desc], pi) => {
    const pid = db.prepare("INSERT INTO projects (org_id, title, description, department, academic_year, status, supervisor_id, start_date, due_date, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(orgId, title, desc, dept, "2026/2027", statuses[pi], pi === 4 ? null : sups[pi % 2], shiftDay(today, -40), shiftDay(today, 150 + pi * 5), admin).lastInsertRowid;
    const team = students.slice(pi * 3, pi * 3 + 3).filter(Boolean);
    team.forEach((uid, i) => db.prepare("INSERT INTO project_members (project_id, user_id, org_id, team_role) VALUES (?,?,?,?)").run(pid, uid, orgId, i === 0 ? "leader" : "member"));
    const msIds = DEFAULT_MILESTONES.map(([t, w], i) => {
      const done = i < approvedCount[pi];
      const submitted = i === approvedCount[pi] && pi === 0;
      return db.prepare("INSERT INTO milestones (org_id, project_id, title, weight, position, due_date, status, submitted_at, reviewed_at, reviewed_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(orgId, pid, t, w, i + 1, shiftDay(today, -30 + i * 30), done ? "approved" : submitted ? "submitted" : "pending",
          done || submitted ? new Date(Date.now() - (6 - i) * 86400000).toISOString() : null, done ? new Date(Date.now() - (5 - i) * 86400000).toISOString() : null, done ? sups[pi % 2] : null).lastInsertRowid;
    });
    const tasks = [["كتابة فصل المقدمة", "done"], ["رسم مخطط قاعدة البيانات (ERD)", "done"], ["تصميم واجهات المستخدم", "in_progress"], ["برمجة صفحة تسجيل الدخول", "in_progress"], ["إعداد خطة الاختبار", "todo"], ["تجهيز عرض المناقشة", "todo"]];
    tasks.forEach(([t, st], i) => {
      if (!team.length) return;
      db.prepare("INSERT INTO tasks (org_id, project_id, milestone_id, title, assignee_id, status, due_date, created_by, completed_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(orgId, pid, msIds[Math.min(i, msIds.length - 1)], t, team[i % team.length], st, shiftDay(today, -10 + i * 7), team[0], st === "done" ? new Date().toISOString() : null);
    });
    if (pi < 4) {
      db.prepare("INSERT INTO feedback (org_id, project_id, milestone_id, author_id, kind, body) VALUES (?,?,?,?,?,?)").run(orgId, pid, msIds[0], sups[pi % 2], "approved", "تم اعتماد المقترح. ركّزوا في المرحلة القادمة على تحديد المتطلبات غير الوظيفية.");
      db.prepare("INSERT INTO feedback (org_id, project_id, milestone_id, author_id, kind, body) VALUES (?,?,?,?,?,?)").run(orgId, pid, null, sups[pi % 2], "comment", "يرجى رفع محضر الاجتماع الأسبوعي في تبويب الملفات.");
    }
    if (pi === 3) {
      const criteria = [{ name: "فهم المشكلة والتحليل", max: 20, score: 17 }, { name: "التصميم والمنهجية", max: 20, score: 16 }, { name: "جودة التنفيذ", max: 30, score: 25 }, { name: "التوثيق", max: 15, score: 12 }, { name: "العرض والمناقشة", max: 15, score: 13 }];
      db.prepare("INSERT INTO evaluations (org_id, project_id, evaluator_id, criteria, total, max_total, comments, is_final) VALUES (?,?,?,?,?,?,?,1)")
        .run(orgId, pid, sups[1], JSON.stringify(criteria), 83, 100, "عمل متكامل وتوثيق جيد. يُنصح بتحسين اختبارات الأداء.");
    }
  });

  return [["ADMIN", "admin@example.com"], ["SUPERVISOR", "supervisor1@example.com"], ["SUPERVISOR", "supervisor2@example.com"], ["STUDENT", "student1@example.com"], ["STUDENT", "student2@example.com"], ["STUDENT", "student13@example.com"]];
}
