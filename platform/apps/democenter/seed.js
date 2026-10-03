// Local development data for AZENK Demo Center (fictional, example.com).
// Staff accounts only + two sample incoming requests. Demo customer accounts
// are never pre-created: each one is created from a request or by staff.
export function seedDemo(db, hash) {
  const t = new Date().toISOString();
  const org = db.prepare("INSERT INTO organizations (name, slug) VALUES ('AZENK', 'azenk')").run().lastInsertRowid;
  const mk = (role, email, name) => db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,0)").run(org, email, name, role, hash);
  mk("SUPER_ADMIN", "superadmin@example.com", "مدير عام (تجريبي)");
  mk("ADMIN", "admin@example.com", "مدير Demo Center (تجريبي)");
  const req = (name, company, phone, products, users) => db.prepare("INSERT INTO demo_requests (org_id, customer_name, phone, email, company_name, products, users_count, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(org, name, phone, null, company, JSON.stringify(products), users, "طلب تجريبي لبيئة التطوير", t);
  req("عميل تجريبي أ", "مؤسسة تجريبية للتجارة", "0500000201", ["hr", "fleet"], "6-20");
  req("عميل تجريبي ب", "مركز اتصال تجريبي", "0500000202", ["call-center", "requests"], "21-100");
  return [["SUPER_ADMIN", "superadmin@example.com"], ["ADMIN", "admin@example.com"]];
}
