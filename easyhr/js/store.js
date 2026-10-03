/* =========================================================
   AZENK HR — data layer, services, auth (RBAC) and approval engine
   ---------------------------------------------------------
   The whole app talks to EHR.api.* services. Today they read and
   write a localStorage document (demo only — NOT secure storage).
   To go to production, replace `storage` + the async service
   bodies with calls to a real backend (REST / Supabase / Postgres);
   authentication, authorisation, geofence validation and audit
   must then be enforced server-side.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const E = EHR.engine;

  const DATA_KEY = "easyhr:v1:data";
  const SESSION_KEY = "easyhr:v1:session";
  const LATENCY = 220; // simulated network latency (ms) so loading states are visible

  /* =========================================================
     Storage adapter (swap for an HTTP client later)
     ========================================================= */
  const storage = {
    load() {
      try {
        const raw = localStorage.getItem(DATA_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && data.meta && data.meta.version === 1 ? data : null;
      } catch (e) {
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(DATA_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false; // storage full or blocked — the app keeps working in memory
      }
    },
    clear() {
      try {
        localStorage.removeItem(DATA_KEY);
      } catch (e) {
        /* ignore */
      }
    },
  };

  let db = null;
  const persist = () => storage.save(db);

  /* ---------- Keep the demo "alive": top up attendance up to today ---------- */
  const topUpAttendance = () => {
    const today = U.today();
    if (db.meta.anchor === today) return;
    const rnd = U.prng(Number(today.replace(/-/g, "")));
    const demoEmp = (db.users.find((u) => u.id === "U-EMP") || {}).employeeId;
    const nowM = U.nowMin();
    for (let d = U.addDays(db.meta.anchor, 1); d <= today; d = U.addDays(d, 1)) {
      db.employees.forEach((e) => {
        if (!["active", "probation", "offboarding"].includes(e.status) || d < e.joinDate) return;
        const s = db.settings[e.companyId];
        if (!E.isWorkday(s, d)) return;
        const shift = E.shiftFor(db, e, d);
        if (!E.shiftWorksOn(shift, d)) return;
        if (db.attendance.some((a) => a.employeeId === e.id && a.date === d)) return;
        if (d === today && e.id === demoEmp) return;
        const w = E.shiftWindow(shift);
        const inMin = w.start + (rnd() < 0.08 ? 20 + Math.floor(rnd() * 40) : Math.floor(rnd() * 24) - 12);
        if (d === today && inMin > nowM) return;
        const rec = {
          id: U.uid("AT"), companyId: e.companyId, employeeId: e.id, date: d, shiftId: shift.id, workplaceId: e.primaryWorkplaceId,
          checkIn: U.fromMin(inMin), checkOut: d === today && nowM < w.end + 10 ? null : U.fromMin(w.end + Math.floor(rnd() * 30) - 5),
          locationStatus: "inside", distance: 10 + Math.floor(rnd() * 90), source: "mobile", device: "Android · Chrome", verification: "location",
        };
        Object.assign(rec, E.calcAttendance(rec, shift, s.attendance));
        rec.status = E.attendanceStatus(rec);
        db.attendance.push(rec);
      });
    }
    db.meta.anchor = today;
    persist();
  };

  /* =========================================================
     Roles & permissions (RBAC)
     ========================================================= */
  const PERMISSIONS = [
    ["dashboard.view", "عرض لوحة التحكم", "عام"],
    ["employees.view", "عرض جميع الموظفين", "الموظفون"], ["employees.view_team", "عرض موظفي الفريق", "الموظفون"],
    ["employees.create", "إضافة موظف", "الموظفون"], ["employees.edit", "تعديل موظف", "الموظفون"], ["employees.archive", "أرشفة موظف", "الموظفون"],
    ["employees.delete", "حذف موظف نهائيًا", "الموظفون"], ["employees.export", "تصدير الموظفين", "الموظفون"], ["employees.sensitive", "البيانات الحساسة (الراتب، الهوية، البنك)", "الموظفون"],
    ["org.view", "عرض الهيكل التنظيمي", "الهيكل"], ["org.manage", "إدارة الهيكل التنظيمي", "الهيكل"],
    ["recruitment.view", "عرض التوظيف", "التوظيف"], ["recruitment.manage", "إدارة التوظيف", "التوظيف"], ["recruitment.approve", "اعتماد الوظائف", "التوظيف"],
    ["onboarding.view", "عرض التهيئة", "التوظيف"], ["onboarding.manage", "إدارة التهيئة", "التوظيف"],
    ["attendance.self", "تسجيل الحضور الشخصي", "الحضور"], ["attendance.view", "عرض حضور الجميع", "الحضور"], ["attendance.manage", "إدارة الحضور", "الحضور"],
    ["attendance.approve", "اعتماد الحضور والإضافي", "الحضور"], ["attendance.location", "عرض تفاصيل الموقع", "الحضور"],
    ["shifts.view", "عرض الورديات", "الحضور"], ["shifts.manage", "إدارة الورديات", "الحضور"],
    ["leave.request", "طلب إجازة", "الإجازات"], ["leave.view", "عرض إجازات الجميع", "الإجازات"], ["leave.approve", "اعتماد الإجازات", "الإجازات"], ["leave.manage", "إدارة سياسات الإجازات", "الإجازات"],
    ["contracts.view", "عرض العقود", "العقود"], ["contracts.manage", "إدارة العقود", "العقود"], ["contracts.approve", "اعتماد العقود", "العقود"],
    ["payroll.self", "عرض قسيمة الراتب", "الرواتب"], ["payroll.view", "عرض الرواتب", "الرواتب"], ["payroll.manage", "إعداد مسير الرواتب", "الرواتب"], ["payroll.approve", "اعتماد الرواتب", "الرواتب"],
    ["advances.request", "طلب سلفة", "السلف"], ["advances.view", "عرض السلف", "السلف"], ["advances.approve", "اعتماد السلف", "السلف"], ["advances.manage", "إدارة السلف", "السلف"],
    ["benefits.view", "عرض البدلات والمزايا", "المزايا"], ["benefits.manage", "إدارة البدلات والمزايا", "المزايا"],
    ["performance.self", "تقييمي الشخصي", "الأداء"], ["performance.view", "عرض التقييمات", "الأداء"], ["performance.review", "تقييم الفريق", "الأداء"], ["performance.manage", "إدارة دورات التقييم", "الأداء"],
    ["training.self", "تدريبي", "التدريب"], ["training.view", "عرض التدريب", "التدريب"], ["training.manage", "إدارة التدريب", "التدريب"],
    ["documents.self", "مستنداتي", "المستندات"], ["documents.view", "عرض المستندات", "المستندات"], ["documents.manage", "إدارة المستندات", "المستندات"],
    ["assets.self", "عهدي", "العهد"], ["assets.view", "عرض العهد", "العهد"], ["assets.manage", "إدارة العهد", "العهد"],
    ["disciplinary.view", "عرض المخالفات", "المخالفات"], ["disciplinary.manage", "إدارة المخالفات", "المخالفات"],
    ["requests.submit", "تقديم طلب", "الطلبات"], ["requests.view", "عرض جميع الطلبات", "الطلبات"], ["requests.approve", "اعتماد الطلبات", "الطلبات"],
    ["travel.request", "طلب سفر/انتداب", "السفر"], ["travel.view", "عرض السفر", "السفر"], ["travel.approve", "اعتماد السفر", "السفر"],
    ["transfers.view", "عرض النقل والترقيات", "النقل"], ["transfers.manage", "إدارة النقل والترقيات", "النقل"],
    ["offboarding.view", "عرض نهاية الخدمة", "نهاية الخدمة"], ["offboarding.manage", "إدارة نهاية الخدمة", "نهاية الخدمة"], ["clearance.approve", "اعتماد إخلاء الطرف", "نهاية الخدمة"],
    ["reports.view", "عرض التقارير", "التقارير"], ["analytics.view", "التحليلات", "التقارير"],
    ["calendar.view", "التقويم", "عام"], ["notifications.view", "الإشعارات", "عام"],
    ["settings.view", "عرض الإعدادات", "النظام"], ["settings.manage", "إدارة الإعدادات", "النظام"], ["roles.manage", "إدارة الأدوار والصلاحيات", "النظام"],
    ["audit.view", "سجل التدقيق", "النظام"], ["companies.manage", "إدارة الشركات", "النظام"],
  ].map(([key, label, group]) => ({ key, label, group }));

  const SELF = ["dashboard.view", "attendance.self", "leave.request", "payroll.self", "advances.request", "performance.self", "training.self", "documents.self", "assets.self", "requests.submit", "travel.request", "calendar.view", "notifications.view"];
  const ROLE_DEFS = {
    SUPER_ADMIN: { label: "مدير النظام", labelEn: "Super Admin", perms: ["*"] },
    HR_MANAGER: {
      label: "مدير الموارد البشرية", labelEn: "HR Manager",
      perms: [...SELF, "employees.view", "employees.create", "employees.edit", "employees.archive", "employees.export", "employees.sensitive", "org.view", "org.manage",
        "recruitment.view", "recruitment.manage", "recruitment.approve", "onboarding.view", "onboarding.manage", "attendance.view", "attendance.manage", "attendance.approve", "attendance.location",
        "shifts.view", "shifts.manage", "leave.view", "leave.approve", "leave.manage", "contracts.view", "contracts.manage", "contracts.approve", "payroll.view", "payroll.approve",
        "advances.view", "benefits.view", "benefits.manage", "performance.view", "performance.review", "performance.manage", "training.view", "training.manage",
        "documents.view", "documents.manage", "assets.view", "assets.manage", "disciplinary.view", "disciplinary.manage", "requests.view", "requests.approve",
        "travel.view", "travel.approve", "transfers.view", "transfers.manage", "offboarding.view", "offboarding.manage", "clearance.approve",
        "reports.view", "analytics.view", "settings.view", "settings.manage", "audit.view"],
    },
    HR_OFFICER: {
      label: "أخصائي موارد بشرية", labelEn: "HR Officer",
      perms: [...SELF, "employees.view", "employees.create", "employees.edit", "employees.export", "employees.sensitive", "org.view", "recruitment.view", "onboarding.view", "onboarding.manage",
        "attendance.view", "attendance.manage", "attendance.approve", "attendance.location", "shifts.view", "shifts.manage", "leave.view", "leave.approve", "contracts.view", "contracts.manage",
        "documents.view", "documents.manage", "assets.view", "assets.manage", "disciplinary.view", "requests.view", "requests.approve", "travel.view", "travel.approve",
        "transfers.view", "offboarding.view", "offboarding.manage", "clearance.approve", "performance.view", "training.view", "reports.view", "settings.view"],
    },
    MANAGER: {
      label: "مدير مباشر", labelEn: "Manager",
      perms: [...SELF, "employees.view_team", "attendance.approve", "leave.approve", "requests.approve", "advances.approve", "travel.approve", "performance.review",
        "clearance.approve", "org.view", "reports.view"],
    },
    EMPLOYEE: { label: "موظف", labelEn: "Employee", perms: [...SELF] },
    FINANCE: {
      label: "المالية", labelEn: "Finance",
      perms: [...SELF, "employees.view", "payroll.view", "payroll.manage", "payroll.approve", "advances.view", "advances.approve", "advances.manage", "benefits.view", "benefits.manage", "clearance.approve", "reports.view"],
    },
    RECRUITER: { label: "أخصائي توظيف", labelEn: "Recruiter", perms: [...SELF, "recruitment.view", "recruitment.manage", "onboarding.view", "onboarding.manage", "org.view", "reports.view"] },
    TRAINING: { label: "مسؤول التدريب", labelEn: "Training", perms: [...SELF, "training.view", "training.manage", "employees.view", "reports.view"] },
    AUDITOR: {
      label: "مدقق", labelEn: "Auditor",
      perms: ["dashboard.view", "employees.view", "org.view", "recruitment.view", "attendance.view", "leave.view", "contracts.view", "payroll.view", "advances.view", "benefits.view",
        "performance.view", "training.view", "documents.view", "assets.view", "disciplinary.view", "requests.view", "travel.view", "transfers.view", "offboarding.view",
        "reports.view", "analytics.view", "audit.view", "settings.view", "calendar.view", "notifications.view", "shifts.view", "onboarding.view"],
    },
  };

  /* =========================================================
     Session & auth (frontend simulation — no passwords stored)
     ========================================================= */
  const session = {
    read() {
      try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
      } catch (e) {
        return null;
      }
    },
    write(value, remember) {
      try {
        const json = JSON.stringify(value);
        sessionStorage.setItem(SESSION_KEY, json);
        if (remember) localStorage.setItem(SESSION_KEY, json);
        else localStorage.removeItem(SESSION_KEY);
      } catch (e) {
        /* ignore */
      }
    },
    clear() {
      try {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {
        /* ignore */
      }
    },
  };
  let current = null; // { userId, companyId, remember }

  const auth = {
    ROLE_DEFS,
    PERMISSIONS,
    restore() {
      const s = session.read();
      if (s && db.users.some((u) => u.id === s.userId)) current = s;
      return !!current;
    },
    loginAs(userId, remember = false) {
      const u = db.users.find((x) => x.id === userId);
      if (!u) throw new Error("حساب غير معروف");
      current = { userId: u.id, companyId: u.companyId, remember };
      session.write(current, remember);
      audit.log("تسجيل دخول", "النظام", `حساب تجريبي: ${ROLE_DEFS[u.role].label}`);
      return u;
    },
    logout() {
      if (current) audit.log("تسجيل خروج", "النظام", "—");
      current = null;
      session.clear();
    },
    user() {
      return current ? db.users.find((u) => u.id === current.userId) : null;
    },
    companyId() {
      return current ? current.companyId : "C1";
    },
    setCompany(companyId) {
      if (!auth.can("companies.manage")) return false;
      current.companyId = companyId;
      session.write(current, current.remember);
      audit.log("تبديل الشركة", "النظام", (db.companies.find((c) => c.id === companyId) || {}).name);
      return true;
    },
    role() {
      const u = auth.user();
      return u ? u.role : null;
    },
    perms() {
      const role = auth.role();
      if (!role) return [];
      return (db.rolePerms && db.rolePerms[role]) || ROLE_DEFS[role].perms;
    },
    can(perm) {
      const p = auth.perms();
      return p.includes("*") || p.includes(perm);
    },
    canAny(list) {
      return list.some((p) => auth.can(p));
    },
    me() {
      const u = auth.user();
      return u && u.employeeId ? db.employees.find((e) => e.id === u.employeeId) : null;
    },
    // Direct and indirect reports of the signed-in manager
    team() {
      const me = auth.me();
      if (!me) return [];
      const ids = new Set();
      const walk = (mgrId, depth) => {
        db.employees.filter((e) => e.managerId === mgrId && e.companyId === me.companyId).forEach((e) => {
          if (!ids.has(e.id)) {
            ids.add(e.id);
            if (depth < 3) walk(e.id, depth + 1);
          }
        });
      };
      walk(me.id, 0);
      return Array.from(ids);
    },
  };

  // Which slice of a module's records the current user may see
  const SCOPES = {
    employees: ["employees.view", "employees.view_team", null],
    attendance: ["attendance.view", "attendance.approve", "attendance.self"],
    leave: ["leave.view", "leave.approve", "leave.request"],
    payroll: ["payroll.view", null, "payroll.self"],
    advances: ["advances.view", "advances.approve", "advances.request"],
    compensation: ["benefits.view", null, "dashboard.view"],
    contracts: ["contracts.view", null, "dashboard.view"],
    performance: ["performance.view", "performance.review", "performance.self"],
    training: ["training.view", "performance.review", "training.self"],
    documents: ["documents.view", null, "documents.self"],
    assets: ["assets.view", null, "assets.self"],
    disciplinary: ["disciplinary.view", null, "dashboard.view"],
    requests: ["requests.view", "requests.approve", "requests.submit"],
    travel: ["travel.view", "travel.approve", "travel.request"],
    transfers: ["transfers.view", "employees.view_team", "dashboard.view"],
    offboarding: ["offboarding.view", "clearance.approve", "dashboard.view"],
  };
  auth.scope = (module) => {
    const [all, team, self] = SCOPES[module] || [null, null, null];
    if (all && auth.can(all)) return "all";
    if (team && auth.can(team) && auth.me() && auth.team().length) return "team";
    if ((self === null || auth.can(self)) && auth.me()) return "self";
    return "none";
  };
  auth.canSeeEmployee = (empId, module = "employees") => {
    const sc = auth.scope(module);
    const me = auth.me();
    if (sc === "all") return true;
    if (sc === "team") return auth.team().includes(empId) || (me && me.id === empId);
    if (sc === "self") return !!me && me.id === empId;
    return false;
  };

  /* =========================================================
     Audit log (never stores sensitive payloads)
     ========================================================= */
  const audit = {
    log(action, module, record, status = "success") {
      const u = auth.user();
      db.audit.unshift({
        id: U.uid("AUD"), companyId: auth.companyId(), userId: u ? u.id : null, userName: u ? u.name : "زائر",
        role: u ? u.role : null, action, module, record: String(record || "—"), at: U.stamp(), status,
      });
      if (db.audit.length > 600) db.audit.length = 600;
      persist();
    },
  };

  /* =========================================================
     Notifications
     ========================================================= */
  const notifications = {
    visible() {
      const u = auth.user();
      if (!u) return [];
      return db.notifications
        .filter((n) => n.companyId === auth.companyId())
        .filter((n) => {
          const to = n.to || {};
          if (to.all) return true;
          if (to.roles && to.roles.includes(u.role)) return true;
          if (u.employeeId && to.employeeIds && to.employeeIds.includes(u.employeeId)) return true;
          return false;
        })
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    unread() {
      return notifications.visible().filter((n) => !n.read).length;
    },
    push({ companyId, to, type, title, body, link }) {
      const s = db.settings[companyId || auth.companyId()];
      const toggles = { contract: "contractExpiry", document: "documentExpiry", attendance: "lateArrival", approval: "pendingApproval", payroll: "payroll", training: "training" };
      if (toggles[type] && s && s.notifications[toggles[type]] === false) return null;
      const n = { id: U.uid("NT"), companyId: companyId || auth.companyId(), to, type, title, body, link: link || "", read: false, createdAt: U.stamp() };
      db.notifications.unshift(n);
      persist();
      document.dispatchEvent(new CustomEvent("ehr:notify", { detail: n }));
      return n;
    },
    markRead(id) {
      const n = db.notifications.find((x) => x.id === id);
      if (n) n.read = true;
      persist();
    },
    markAll() {
      notifications.visible().forEach((n) => (n.read = true));
      persist();
    },
  };

  /* =========================================================
     Lookups
     ========================================================= */
  const L = {
    emp: (id) => db.employees.find((e) => e.id === id),
    empName: (id) => (L.emp(id) || {}).nameAr || "—",
    dept: (id) => db.departments.find((d) => d.id === id),
    deptName: (id) => (L.dept(id) || {}).name || "—",
    section: (id) => db.sections.find((s) => s.id === id),
    branch: (id) => db.branches.find((b) => b.id === id),
    branchName: (id) => (L.branch(id) || {}).name || "—",
    title: (id) => db.jobTitles.find((j) => j.id === id),
    titleName: (id) => (L.title(id) || {}).name || "—",
    grade: (id) => db.grades.find((g) => g.id === id),
    workplace: (id) => db.workplaces.find((w) => w.id === id),
    workplaceName: (id) => (L.workplace(id) || {}).name || "—",
    shift: (id) => db.shifts.find((s) => s.id === id),
    leaveType: (id) => db.leaveTypes.find((t) => t.id === id),
    company: (id) => db.companies.find((c) => c.id === id),
    settings: () => db.settings[auth.companyId()],
    inCompany: (list) => list.filter((r) => !r.companyId || r.companyId === auth.companyId()),
  };

  /* =========================================================
     Generic record service
     ========================================================= */
  const call = async (fn) => {
    await U.sleep(LATENCY);
    const result = fn();
    persist();
    document.dispatchEvent(new CustomEvent("ehr:data"));
    return result;
  };
  const records = (collection, module) => ({
    all: () => L.inCompany(db[collection]),
    // Records the current user may see (company isolation + role scope)
    visible: () =>
      L.inCompany(db[collection]).filter((r) => !r.employeeId || !module || auth.canSeeEmployee(r.employeeId, module)),
    get: (id) => db[collection].find((r) => r.id === id),
    create: (rec, auditLabel) =>
      call(() => {
        const full = { companyId: auth.companyId(), createdAt: U.stamp(), ...rec };
        db[collection].unshift(full);
        if (auditLabel) audit.log("إنشاء", auditLabel, full.id);
        return full;
      }),
    update: (id, patch, auditLabel, action = "تعديل") =>
      call(() => {
        const rec = db[collection].find((r) => r.id === id);
        if (!rec) throw new Error("السجل غير موجود");
        Object.assign(rec, typeof patch === "function" ? patch(rec) || {} : patch, { updatedAt: U.stamp() });
        if (auditLabel) audit.log(action, auditLabel, id);
        return rec;
      }),
    remove: (id, auditLabel) =>
      call(() => {
        const i = db[collection].findIndex((r) => r.id === id);
        if (i >= 0) db[collection].splice(i, 1);
        if (auditLabel) audit.log("حذف", auditLabel, id);
      }),
  });

  /* =========================================================
     Approval engine
     ========================================================= */
  const APPROVABLE = [
    { collection: "leaves", type: "leave", label: "إجازة", route: "#/leave", module: "leave", perm: "leave.approve" },
    { collection: "advances", type: "advance", label: "سلفة", route: "#/advances", module: "advances", perm: "advances.approve" },
    { collection: "contracts", type: "contract", label: "عقد", route: "#/contracts", module: "contracts", perm: "contracts.approve" },
    { collection: "requests", type: "request", label: "طلب", route: "#/requests", module: "requests", perm: "requests.approve" },
    { collection: "overtime", type: "overtime", label: "عمل إضافي", route: "#/attendance?tab=overtime", module: "attendance", perm: "attendance.approve" },
    { collection: "corrections", type: "correction", label: "تعديل حضور", route: "#/attendance?tab=corrections", module: "attendance", perm: "attendance.approve" },
    { collection: "travel", type: "travel", label: "سفر/انتداب", route: "#/travel", module: "travel", perm: "travel.approve" },
    { collection: "transfers", type: "transfer", label: "نقل/ترقية", route: "#/transfers", module: "transfers", perm: "transfers.manage" },
    { collection: "compensation", type: "compensation", label: "بدل/مزية", route: "#/benefits", module: "compensation", perm: "benefits.manage" },
    { collection: "jobs", type: "job", label: "وظيفة جديدة", route: "#/recruitment", module: null, perm: "recruitment.approve" },
    { collection: "offboarding", type: "offboarding", label: "نهاية خدمة", route: "#/offboarding", module: "offboarding", perm: "offboarding.manage" },
    { collection: "disciplinary", type: "disciplinary", label: "جزاء", route: "#/disciplinary", module: "disciplinary", perm: "disciplinary.manage" },
  ];
  const STEP_LABEL = { MANAGER: "المدير المباشر", HR: "الموارد البشرية", HR_MANAGER: "مدير الموارد البشرية", FINANCE: "المالية", ADMIN: "مدير النظام" };

  const approvals = {
    APPROVABLE,
    STEP_LABEL,
    build(type, empId) {
      const emp = L.emp(empId);
      const cfg = L.settings().workflows[type] || { steps: ["HR"] };
      const steps = cfg.steps.map((role) => ({
        role, status: role === "MANAGER" && !(emp && emp.managerId) ? "skipped" : "waiting", by: null, at: null, comment: role === "MANAGER" && !(emp && emp.managerId) ? "لا يوجد مدير مباشر" : "",
      }));
      const first = steps.findIndex((s) => s.status === "waiting");
      if (first >= 0) steps[first].status = "pending";
      return { type, steps, current: first };
    },
    isOpen: (rec) => !!(rec && rec.approval && rec.approval.current >= 0),
    currentStep: (rec) => (approvals.isOpen(rec) ? rec.approval.steps[rec.approval.current] : null),
    // Can the signed-in user act on the current step?
    canAct(rec) {
      const step = approvals.currentStep(rec);
      const u = auth.user();
      if (!step || !u) return false;
      const empId = rec.employeeId || rec.requestedBy;
      if (u.employeeId && empId === u.employeeId && u.role !== "SUPER_ADMIN") return false; // no self-approval
      if (u.role === "SUPER_ADMIN") return true;
      const emp = L.emp(empId);
      switch (step.role) {
        case "MANAGER": return !!(emp && u.employeeId && emp.managerId === u.employeeId);
        case "HR": return ["HR_MANAGER", "HR_OFFICER"].includes(u.role);
        case "HR_MANAGER": return u.role === "HR_MANAGER";
        case "FINANCE": return u.role === "FINANCE";
        default: return false;
      }
    },
    pendingForMe() {
      const out = [];
      APPROVABLE.forEach((def) => {
        L.inCompany(db[def.collection]).forEach((rec) => {
          if (approvals.isOpen(rec) && approvals.canAct(rec)) out.push({ def, rec });
        });
      });
      return out.sort((a, b) => (a.rec.createdAt < b.rec.createdAt ? 1 : -1));
    },
    pendingAll() {
      const out = [];
      APPROVABLE.forEach((def) => L.inCompany(db[def.collection]).forEach((rec) => approvals.isOpen(rec) && out.push({ def, rec })));
      return out;
    },
    async act(collection, id, decision, comment = "") {
      return call(() => {
        const rec = db[collection].find((r) => r.id === id);
        if (!rec || !approvals.isOpen(rec)) throw new Error("لا يوجد إجراء مطلوب على هذا السجل");
        if (!approvals.canAct(rec)) throw new Error("ليست لديك صلاحية اعتماد هذه المرحلة");
        const u = auth.user();
        const ap = rec.approval;
        const step = ap.steps[ap.current];
        step.status = decision === "approve" ? "approved" : "rejected";
        step.by = u.employeeId || u.id;
        step.byName = u.name;
        step.at = U.stamp();
        step.comment = comment;
        const def = APPROVABLE.find((d) => d.collection === collection);
        if (decision === "reject") {
          ap.current = -1;
          HOOKS.rejected(def, rec, comment);
        } else {
          let next = ap.current + 1;
          while (next < ap.steps.length && ap.steps[next].status === "skipped") next += 1;
          if (next < ap.steps.length) {
            ap.current = next;
            ap.steps[next].status = "pending";
            HOOKS.advanced(def, rec, ap.steps[next]);
          } else {
            ap.current = -1;
            HOOKS.approved(def, rec);
          }
        }
        audit.log(decision === "approve" ? "اعتماد" : "رفض", def.label, id);
        return rec;
      });
    },
  };

  // What happens when a workflow finishes — keeps modules consistent
  const HOOKS = {
    notifyEmployee(rec, title, body, link) {
      if (rec.employeeId) notifications.push({ companyId: rec.companyId, to: { employeeIds: [rec.employeeId] }, type: "approval", title, body, link });
    },
    advanced(def, rec, step) {
      const to = step.role === "MANAGER"
        ? { employeeIds: [(L.emp(rec.employeeId) || {}).managerId] }
        : { roles: step.role === "HR" ? ["HR_MANAGER", "HR_OFFICER"] : [step.role] };
      notifications.push({ companyId: rec.companyId, to, type: "approval", title: `${def.label} بانتظار موافقتك`, body: `${L.empName(rec.employeeId)} — ${rec.id}`, link: def.route });
    },
    approved(def, rec) {
      const today = U.today();
      switch (def.type) {
        case "leave":
          rec.status = "approved";
          (L.emp(rec.employeeId) || { timeline: [] }).timeline.push({ date: today, title: "إجازة معتمدة", detail: `${rec.days} أيام`, icon: "palm" });
          break;
        case "advance": rec.status = "approved"; break;
        case "contract": rec.status = "approved"; break;
        case "request": rec.status = "approved"; break;
        case "overtime": rec.status = "approved"; break;
        case "travel": rec.status = "approved"; break;
        case "transfer": rec.status = "approved"; break;
        case "job": rec.status = "open"; break;
        case "offboarding": rec.stage = "notice"; break;
        case "disciplinary": rec.status = "decided"; rec.approverId = (auth.user() || {}).employeeId; break;
        case "correction": {
          rec.status = "approved";
          const att = db.attendance.find((a) => a.id === rec.attendanceId);
          if (att) {
            att[rec.field] = rec.requested;
            att.source = "correction";
            const emp = L.emp(att.employeeId);
            const shift = E.shiftFor(db, emp, att.date) || L.shift(att.shiftId);
            Object.assign(att, E.calcAttendance(att, shift, db.settings[att.companyId].attendance));
            att.status = E.attendanceStatus(att);
            audit.log("تصحيح حضور", "الحضور", `${att.id}: ${rec.original || "—"} → ${rec.requested}`);
          }
          break;
        }
        case "compensation": {
          rec.status = "approved";
          const emp = L.emp(rec.employeeId);
          if (emp && rec.kind === "raise") emp.basicSalary = Number(rec.next);
          if (emp && rec.kind === "allowance") emp.otherAllowance = (emp.otherAllowance || 0) + (Number(rec.next) - Number(rec.prev || 0));
          if (emp) emp.timeline.push({ date: rec.effective, title: "تحديث التعويضات", detail: rec.item, icon: "gift" });
          break;
        }
        default: rec.status = "approved";
      }
      HOOKS.notifyEmployee(rec, `تمت الموافقة على ${def.label}`, `تمت الموافقة على طلبك ${rec.id}.`, def.route);
    },
    rejected(def, rec, comment) {
      if (def.type === "job") rec.status = "rejected";
      else if (def.type === "offboarding") rec.stage = "rejected";
      else rec.status = "rejected";
      HOOKS.notifyEmployee(rec, `تم رفض ${def.label}`, `${rec.id}${comment ? ` — ${comment}` : ""}`, def.route);
    },
  };

  /* =========================================================
     Domain services
     ========================================================= */
  const nextEmpId = (companyId) => {
    const prefix = companyId === "C1" ? 1000 : companyId === "C2" ? 2000 : 3000;
    const nums = db.employees.filter((e) => e.companyId === companyId).map((e) => Number(e.id.split("-")[1]));
    return `EMP-${Math.max(prefix, ...nums) + 1}`;
  };

  const employeesService = {
    ...records("employees", "employees"),
    visible() {
      return L.inCompany(db.employees).filter((e) => auth.canSeeEmployee(e.id, "employees"));
    },
    async createEmployee(data) {
      return call(() => {
        const id = nextEmpId(auth.companyId());
        const emp = {
          id, companyId: auth.companyId(), status: "probation", timeline: [{ date: data.joinDate || U.today(), title: "تم التعيين", detail: L.titleName(data.jobTitleId), icon: "user-plus" }],
          workplaceIds: [data.primaryWorkplaceId], avatarHue: U.hue(data.nameAr), createdAt: U.stamp(), notes: "",
          emergency: { name: "", relation: "", phone: "" }, bank: { name: "", iban: "" }, insurance: { provider: "", class: "", policyNo: "" },
          transportAllowance: null, otherAllowance: 0, probationDays: L.settings().contracts.probationDays,
          ...data,
        };
        db.employees.unshift(emp);
        const s = L.settings();
        db.leaveTypes.filter((t) => t.companyId === emp.companyId).forEach((t) => {
          if ((t.key === "maternity" && emp.gender !== "F") || (t.key === "paternity" && emp.gender !== "M")) return;
          db.leaveBalances.push({ employeeId: emp.id, typeId: t.id, year: Number(U.today().slice(0, 4)), opening: t.defaultDays });
        });
        void s;
        audit.log("إنشاء", "الموظفون", `${id}`);
        return emp;
      });
    },
    async archive(id) {
      const eos = db.offboarding.find((o) => o.employeeId === id && o.stage !== "archived" && o.stage !== "rejected");
      if (eos && !offboardingService.clearanceComplete(eos)) throw new Error("لا يمكن الأرشفة قبل اكتمال إخلاء الطرف في ملف نهاية الخدمة");
      return employeesService.update(id, { status: "archived", archivedAt: U.today() }, "الموظفون", "أرشفة");
    },
  };

  const attendanceService = {
    ...records("attendance", "attendance"),
    todayFor(empId) {
      return db.attendance.find((a) => a.employeeId === empId && a.date === U.today());
    },
    deviceInfo() {
      const ua = navigator.userAgent;
      const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "Linux";
      const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "متصفح";
      return `${os} · ${br}`;
    },
    // Location: the real browser Geolocation API, or an explicitly labelled simulation
    locate(mode, workplace) {
      if (mode === "sim-inside" || mode === "sim-outside") {
        const dist = mode === "sim-inside" ? Math.round(workplace.radius * 0.35) : Math.round(workplace.radius + 350);
        const p = U.offsetPoint(workplace.lat, workplace.lng, dist, 60);
        return U.sleep(500).then(() => ({ lat: p.lat, lng: p.lng, accuracy: 12, source: "simulated" }));
      }
      return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) return reject(new Error("المتصفح لا يدعم تحديد الموقع الجغرافي."));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), source: "real" }),
          (err) => {
            const msg = {
              1: "تم رفض إذن الوصول إلى الموقع. فعّل صلاحية الموقع من إعدادات المتصفح ثم أعد المحاولة.",
              2: "تعذّر تحديد موقعك حاليًا. تأكد من تشغيل خدمة الموقع.",
              3: "انتهت مهلة تحديد الموقع. حاول مرة أخرى في مكان مفتوح.",
            }[err.code] || "حدث خطأ أثناء تحديد الموقع.";
            reject(new Error(msg));
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      });
    },
    // Evaluate every rule before allowing a check-in / check-out
    verify(emp, point, kind = "in") {
      const u = auth.user();
      const s = db.settings[emp.companyId];
      const today = U.today();
      const checks = [];
      const push = (key, label, ok, detail, blocking = true) => checks.push({ key, label, ok, detail, blocking });
      push("identity", "هوية المستخدم", !!u && u.employeeId === emp.id && ["active", "probation", "offboarding"].includes(emp.status),
        u && u.employeeId === emp.id ? `${emp.nameAr} — ${emp.id}` : "الجلسة لا تطابق الموظف");
      const workday = E.isWorkday(s, today);
      push("datetime", "التاريخ والوقت", true, `${U.fmtLong(today)} · ${U.fmtTime(U.nowTime())}${workday ? "" : " — يوم عطلة (يُحتسب إضافيًا وفق السياسة)"}`, false);
      const wps = (emp.workplaceIds || []).map((id) => L.workplace(id)).filter((w) => w && w.status === "active");
      push("workplace", "موقع العمل المعتمد", wps.length > 0, wps.length ? wps.map((w) => w.name).join("، ") : "لا يوجد موقع عمل نشط مسند");
      let geo = null;
      if (wps.length && point) {
        const results = wps.map((w) => ({ w, ...E.geofence(point, w) })).sort((a, b) => a.distance - b.distance);
        geo = results[0];
        const needed = s.attendance.requireGeofence;
        push("geofence", "النطاق الجغرافي (Geofence)", !needed || geo.inside,
          `${geo.w.name}: ${U.num(geo.distance)} م من أصل ${geo.radius} م مسموح${needed ? "" : " (التحقق معطّل في الإعدادات)"}`);
      } else {
        push("geofence", "النطاق الجغرافي (Geofence)", false, "لم يتم تحديد الموقع");
      }
      const shift = E.shiftFor(db, emp, today);
      let shiftOk = !!shift;
      let shiftDetail = shift ? `${shift.name} (${U.fmtTime(shift.start)} – ${U.fmtTime(shift.end)})` : "لا توجد وردية مسندة";
      if (shift && kind === "in") {
        const w = E.shiftWindow(shift);
        const now = U.nowMin();
        const earliest = w.start - 120;
        if (now < earliest && !(w.end > 1440 && now < w.end - 1440)) {
          shiftOk = false;
          shiftDetail += " — لم يبدأ وقت التسجيل بعد (قبل الوردية بساعتين كحد أقصى)";
        }
      }
      // Demo only: in the clearly-labelled simulated mode the shift-time window is a warning,
      // so the demo can be tried at any hour. Real GPS mode keeps it as a blocking rule.
      const demoTime = !shiftOk && !!shift && point && point.source === "simulated";
      if (demoTime) shiftDetail += " — سُمح به في وضع المحاكاة التجريبي فقط";
      push("shift", "الوردية المسندة", shiftOk, shiftDetail, !demoTime);
      const rec = attendanceService.todayFor(emp.id);
      if (kind === "in") push("record", "سجل اليوم", !(rec && rec.checkIn), rec && rec.checkIn ? `تم تسجيل الحضور مسبقًا الساعة ${U.fmtTime(rec.checkIn)}` : "لا يوجد تسجيل سابق اليوم");
      else push("record", "سجل اليوم", !!(rec && rec.checkIn && !rec.checkOut), !rec || !rec.checkIn ? "لا يوجد تسجيل حضور اليوم" : rec.checkOut ? `تم تسجيل الانصراف مسبقًا الساعة ${U.fmtTime(rec.checkOut)}` : `الحضور مسجّل الساعة ${U.fmtTime(rec.checkIn)}`);
      return { ok: checks.every((c) => c.ok || !c.blocking), checks, geo, shift };
    },
    async checkIn(emp, point) {
      const v = attendanceService.verify(emp, point, "in");
      if (!v.ok) {
        audit.log("محاولة حضور مرفوضة", "الحضور", `${emp.id} — ${v.checks.filter((c) => !c.ok).map((c) => c.label).join("، ")}`, "failed");
        return { ok: false, verify: v };
      }
      const s = db.settings[emp.companyId];
      const rec = await call(() => {
        const r = {
          id: U.uid("AT"), companyId: emp.companyId, employeeId: emp.id, date: U.today(), shiftId: v.shift.id, workplaceId: v.geo.w.id,
          checkIn: U.nowTime(), checkOut: null, locationStatus: point.source === "simulated" ? "simulated" : v.geo.inside ? "inside" : "outside",
          distance: v.geo.distance, accuracy: point.accuracy, source: "mobile", device: attendanceService.deviceInfo(), verification: "location",
          checkInAt: U.stamp(),
        };
        Object.assign(r, E.calcAttendance(r, v.shift, s.attendance));
        r.status = E.attendanceStatus(r);
        db.attendance.push(r);
        audit.log("تسجيل حضور", "الحضور", `${emp.id} · ${r.checkIn}${point.source === "simulated" ? " (موقع محاكى)" : ""}`);
        if (r.status === "late" && emp.managerId) {
          notifications.push({ companyId: emp.companyId, to: { employeeIds: [emp.managerId] }, type: "attendance", title: "تأخر في الحضور", body: `${emp.nameAr} سجّل حضوره الساعة ${U.fmtTime(r.checkIn)} (تأخير ${r.lateMin} دقيقة).`, link: "#/attendance" });
        }
        return r;
      });
      return { ok: true, record: rec, verify: v };
    },
    async checkOut(emp, point) {
      const v = attendanceService.verify(emp, point, "out");
      if (!v.ok) {
        audit.log("محاولة انصراف مرفوضة", "الحضور", emp.id, "failed");
        return { ok: false, verify: v };
      }
      const s = db.settings[emp.companyId];
      const rec = await call(() => {
        const r = attendanceService.todayFor(emp.id);
        r.checkOut = U.nowTime();
        r.checkOutAt = U.stamp();
        r.checkOutDistance = v.geo.distance;
        const shift = E.shiftFor(db, emp, r.date) || L.shift(r.shiftId);
        Object.assign(r, E.calcAttendance(r, shift, s.attendance));
        r.status = E.attendanceStatus(r);
        audit.log("تسجيل انصراف", "الحضور", `${emp.id} · ${r.checkOut}`);
        return r;
      });
      return { ok: true, record: rec, verify: v };
    },
    // Aggregate today's status for a set of employees
    todaySummary(empIds) {
      const today = U.today();
      const nowM = U.nowMin();
      const out = { scheduled: 0, present: 0, late: 0, absent: 0, leave: 0, early: 0, overtime: 0, notYet: 0, list: [] };
      empIds.forEach((id) => {
        const e = L.emp(id);
        if (!e || !["active", "probation", "offboarding"].includes(e.status) || e.joinDate > today) return;
        const s = db.settings[e.companyId];
        const rec = attendanceService.todayFor(id);
        const onLeave = db.leaves.some((l) => l.employeeId === id && l.status === "approved" && l.from <= today && l.to >= today);
        const shift = E.shiftFor(db, e, today);
        if (!E.isWorkday(s, today) || !E.shiftWorksOn(shift, today)) return;
        out.scheduled += 1;
        let st;
        if (onLeave || (rec && rec.status === "leave")) st = "leave";
        else if (rec && rec.checkIn) st = rec.status;
        else if (rec && rec.status === "absent") st = "absent";
        else st = nowM > E.shiftWindow(shift).start + s.attendance.absenceAfter ? "absent" : "notYet";
        if (st === "present" || st === "late") out.present += 1;
        if (st === "late") out.late += 1;
        if (st === "absent") out.absent += 1;
        if (st === "leave") out.leave += 1;
        if (st === "notYet") out.notYet += 1;
        if (rec && rec.earlyMin) out.early += 1;
        if (rec && rec.overtimeMin) out.overtime += 1;
        out.list.push({ emp: e, rec, status: st, shift });
      });
      return out;
    },
  };

  const leaveService = {
    ...records("leaves", "leave"),
    balance: (empId, typeId) => E.leaveBalance(db, empId, typeId, Number(U.today().slice(0, 4))),
    typesFor(emp) {
      return db.leaveTypes.filter((t) => t.companyId === emp.companyId && t.active && !(t.key === "maternity" && emp.gender !== "F") && !(t.key === "paternity" && emp.gender !== "M"));
    },
    validate(emp, { typeId, from, to }) {
      const s = db.settings[emp.companyId];
      if (!from || !to) return "حدد تاريخ البداية والنهاية";
      if (to < from) return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية";
      const days = E.leaveDays(s, from, to);
      if (days <= 0) return "الفترة المختارة لا تتضمن أيام عمل";
      const overlap = db.leaves.find((l) => l.employeeId === emp.id && ["pending", "approved"].includes(l.status) && l.from <= to && l.to >= from);
      if (overlap) return `يوجد طلب إجازة متداخل (${overlap.id})`;
      const bal = leaveService.balance(emp.id, typeId);
      if (!s.leave.allowNegative && bal.remaining < days) return `الرصيد غير كافٍ: المتبقي ${bal.remaining} يوم والمطلوب ${days}`;
      return null;
    },
    async request(emp, data) {
      const err = leaveService.validate(emp, data);
      if (err) throw new Error(err);
      const s = db.settings[emp.companyId];
      const days = E.leaveDays(s, data.from, data.to);
      return call(() => {
        const rec = {
          id: U.uid("LV"), companyId: emp.companyId, employeeId: emp.id, typeId: data.typeId, from: data.from, to: data.to, days,
          reason: data.reason || "", attachment: data.attachment || null, createdAt: U.stamp(),
          approval: approvals.build("leave", emp.id), status: "pending",
        };
        if (rec.approval.current < 0) rec.status = "approved";
        db.leaves.unshift(rec);
        emp.timeline.push({ date: U.today(), title: "طلب إجازة", detail: `${days} أيام`, icon: "palm" });
        audit.log("طلب إجازة", "الإجازات", rec.id);
        const step = approvals.currentStep(rec);
        if (step) HOOKS.advanced(APPROVABLE[0], rec, step);
        return rec;
      });
    },
  };

  // Generic "submit something that needs approval"
  const submitWithApproval = (collection, type, rec, auditModule) =>
    call(() => {
      const full = { id: rec.id || U.uid(type.toUpperCase().slice(0, 3)), companyId: auth.companyId(), createdAt: U.stamp(), ...rec };
      full.approval = approvals.build(type, full.employeeId || full.requestedBy);
      if (full.approval.current < 0) {
        const def = APPROVABLE.find((d) => d.collection === collection);
        HOOKS.approved(def, full);
      } else if (!full.status || full.status === "new") {
        full.status = "pending";
      }
      db[collection].unshift(full);
      audit.log("إنشاء", auditModule, full.id);
      const step = approvals.currentStep(full);
      const def = APPROVABLE.find((d) => d.collection === collection);
      if (step && def) HOOKS.advanced(def, full, step);
      return full;
    });

  const payrollService = {
    ...records("payrollRuns", null),
    STATUSES: ["draft", "review", "approved", "processed", "paid"],
    staff(period) {
      return L.inCompany(db.employees).filter((e) => ["active", "probation", "offboarding"].includes(e.status) && e.joinDate <= `${period}-28`);
    },
    async createRun(period) {
      if (db.payrollRuns.some((r) => r.companyId === auth.companyId() && r.period === period)) throw new Error("يوجد مسير لهذه الفترة مسبقًا");
      return call(() => {
        const rules = L.settings().payroll;
        const run = {
          id: `PR-${auth.companyId()}-${period}`, companyId: auth.companyId(), period, status: "draft",
          lines: payrollService.staff(period).map((e) => E.payrollLine(db, e, period, rules)),
          createdAt: U.stamp(), history: [{ status: "draft", at: U.stamp(), by: (auth.user() || {}).name }],
        };
        db.payrollRuns.unshift(run);
        audit.log("إنشاء مسير", "الرواتب", period);
        return run;
      });
    },
    async recalculate(id) {
      return call(() => {
        const run = db.payrollRuns.find((r) => r.id === id);
        if (run.status !== "draft") throw new Error("لا يمكن إعادة الحساب إلا في حالة المسودة");
        const rules = db.settings[run.companyId].payroll;
        run.lines = payrollService.staff(run.period).map((e) => E.payrollLine(db, e, run.period, rules));
        run.calculatedAt = U.stamp();
        audit.log("حساب الرواتب", "الرواتب", run.period);
        return run;
      });
    },
    async advance(id, comment = "") {
      return call(() => {
        const run = db.payrollRuns.find((r) => r.id === id);
        const i = payrollService.STATUSES.indexOf(run.status);
        const next = payrollService.STATUSES[i + 1];
        if (!next) throw new Error("المسير في حالته النهائية");
        const needs = next === "approved" ? "payroll.approve" : "payroll.manage";
        if (!auth.can(needs)) throw new Error("ليست لديك صلاحية لهذه الخطوة");
        if (next === "review" && !run.calculatedAt && run.history.length <= 1) run.calculatedAt = U.stamp();
        run.status = next;
        run.history.push({ status: next, at: U.stamp(), by: (auth.user() || {}).name, comment });
        audit.log({ review: "إرسال للمراجعة", approved: "اعتماد", processed: "معالجة", paid: "تأكيد الصرف" }[next], "الرواتب", run.period);
        if (next === "paid") {
          notifications.push({ companyId: run.companyId, to: { all: true }, type: "payroll", title: "قسيمة الراتب متاحة", body: `تم صرف رواتب ${U.fmtMonth(run.period)}.`, link: "#/payroll" });
        }
        if (next === "review") notifications.push({ companyId: run.companyId, to: { roles: ["HR_MANAGER", "SUPER_ADMIN"] }, type: "payroll", title: "مسير رواتب بانتظار الاعتماد", body: U.fmtMonth(run.period), link: "#/payroll" });
        return run;
      });
    },
    async returnToDraft(id, comment) {
      return call(() => {
        const run = db.payrollRuns.find((r) => r.id === id);
        if (!["review", "approved"].includes(run.status)) throw new Error("لا يمكن الإرجاع في هذه الحالة");
        run.status = "draft";
        run.history.push({ status: "draft", at: U.stamp(), by: (auth.user() || {}).name, comment: comment || "إعادة للتعديل" });
        audit.log("إرجاع للمسودة", "الرواتب", run.period);
        return run;
      });
    },
    myLines(empId) {
      return db.payrollRuns
        .filter((r) => r.lines.some((l) => l.employeeId === empId) && ["processed", "paid"].includes(r.status))
        .map((r) => ({ run: r, line: r.lines.find((l) => l.employeeId === empId) }));
    },
  };

  const recruitmentService = {
    STAGES: [
      ["applied", "متقدم جديد"], ["screening", "فرز"], ["interview", "مقابلة"], ["evaluation", "تقييم"],
      ["offer", "عرض وظيفي"], ["accepted", "قبول"], ["hired", "تعيين"], ["rejected", "مرفوض"],
    ],
    canMove(c, to) {
      if (c.stage === "hired") return "المرشح تم تعيينه بالفعل";
      if (to === "evaluation" && !c.interviews.some((i) => i.status === "done")) return "يجب إتمام مقابلة واحدة على الأقل قبل التقييم";
      if (to === "offer" && !(c.score >= 0 && c.score !== null)) return "أدخل درجة التقييم قبل إرسال العرض";
      if (to === "accepted" && !(c.offer && c.offer.status === "sent")) return "يجب إرسال عرض وظيفي أولًا";
      if (to === "hired") return "استخدم زر «تعيين» لإتمام التعيين وإنشاء ملف الموظف";
      return null;
    },
    async move(id, to) {
      const c = db.candidates.find((x) => x.id === id);
      const err = recruitmentService.canMove(c, to);
      if (err) throw new Error(err);
      return call(() => {
        c.stage = to;
        if (to === "accepted" && c.offer) c.offer.status = "accepted";
        audit.log("تغيير مرحلة", "التوظيف", `${c.id} → ${to}`);
        return c;
      });
    },
    async hire(id) {
      const c = db.candidates.find((x) => x.id === id);
      if (c.stage !== "accepted") throw new Error("لا يمكن التعيين قبل قبول العرض الوظيفي");
      const job = db.jobs.find((j) => j.id === c.jobId);
      const emp = await employeesService.createEmployee({
        nameAr: c.name, nameEn: "", gender: "M", nationality: "سعودي", nationalityCode: "SA", idType: "هوية وطنية", idNumber: "",
        dob: "", marital: "", phone: c.phone, email: c.email, address: "",
        departmentId: job.departmentId, sectionId: (db.sections.find((s) => s.departmentId === job.departmentId) || {}).id,
        jobTitleId: (db.jobTitles.find((t) => t.companyId === job.companyId && t.name.includes(job.title.split(" ")[0])) || db.jobTitles.find((t) => t.companyId === job.companyId)).id,
        managerId: (L.dept(job.departmentId) || {}).managerId, branchId: job.branchId,
        primaryWorkplaceId: (db.workplaces.find((w) => w.branchId === job.branchId) || db.workplaces[0]).id,
        shiftId: (db.shifts.find((s) => s.companyId === job.companyId) || {}).id, employmentType: "دوام كامل", contractType: "probation",
        joinDate: (c.offer && c.offer.start) || U.addDays(U.today(), 14), basicSalary: (c.offer && c.offer.salary) || 0,
      });
      return call(() => {
        c.stage = "hired";
        c.employeeId = emp.id;
        const ob = {
          id: U.uid("ONB"), companyId: emp.companyId, employeeId: emp.id, candidateId: c.id, startDate: emp.joinDate, createdAt: U.stamp(),
          tasks: onboardingService.TEMPLATE.map(([key, title, owner]) => ({ key, title, owner, status: key === "account" ? "completed" : "pending" })),
        };
        db.onboarding.unshift(ob);
        db.contracts.unshift({
          id: U.uid("CT"), companyId: emp.companyId, employeeId: emp.id, number: `NEW-${emp.id}`, type: "probation", start: emp.joinDate,
          end: U.addDays(emp.joinDate, db.settings[emp.companyId].contracts.probationDays), salary: emp.basicSalary,
          allowances: Math.round(emp.basicSalary * 0.25), hours: 8, workplaceId: emp.primaryWorkplaceId, status: "draft", approval: null, createdAt: U.stamp(),
        });
        const open = db.candidates.filter((x) => x.jobId === job.id && x.stage === "hired").length;
        if (open >= job.openings) job.status = "closed";
        audit.log("تعيين", "التوظيف", `${c.id} → ${emp.id}`);
        notifications.push({ companyId: emp.companyId, to: { roles: ["HR_MANAGER", "HR_OFFICER"] }, type: "request", title: "موظف جديد", body: `تم تعيين ${emp.nameAr} — بدأت قائمة التهيئة.`, link: "#/onboarding" });
        return { emp, onboarding: ob };
      });
    },
  };

  const onboardingService = {
    TEMPLATE: [
      ["account", "إنشاء حساب الموظف", "HR"], ["documents", "رفع المستندات", "HR"], ["contract", "توقيع العقد", "HR"],
      ["workplace", "تحديد موقع العمل", "HR"], ["department", "تعيين الإدارة", "HR"], ["manager", "تعيين المدير المباشر", "HR"],
      ["payroll", "بيانات الرواتب والحساب البنكي", "FINANCE"], ["attendance", "إعداد الحضور", "HR"], ["shift", "تعيين الوردية", "HR"],
      ["assets", "تسليم العهد", "IT"], ["orientation", "برنامج التعريف", "MANAGER"], ["training", "التدريب الأولي", "TRAINING"],
    ],
    progress: (ob) => U.pct(ob.tasks.filter((t) => t.status === "completed").length, ob.tasks.length),
    async setTask(id, key, status) {
      return call(() => {
        const ob = db.onboarding.find((o) => o.id === id);
        const t = ob.tasks.find((x) => x.key === key);
        t.status = status;
        t.at = U.stamp();
        if (onboardingService.progress(ob) === 100) {
          ob.completedAt = U.stamp();
          const emp = L.emp(ob.employeeId);
          if (emp) emp.timeline.push({ date: U.today(), title: "اكتملت التهيئة", detail: "جميع مهام التهيئة منجزة", icon: "check" });
        }
        audit.log("تحديث مهمة تهيئة", "التهيئة", `${id}: ${t.title}`);
        return ob;
      });
    },
  };

  const offboardingService = {
    STAGES: [
      ["request", "الطلب"], ["notice", "فترة الإشعار"], ["handover", "التسليم"], ["assets", "إرجاع العهد"],
      ["clearance", "إخلاء الطرف"], ["settlement", "التسوية النهائية"], ["exit", "مقابلة الخروج"], ["archived", "الأرشفة"],
    ],
    REASONS: { resignation: "استقالة", termination: "إنهاء خدمة", retirement: "تقاعد", contract_expiry: "انتهاء العقد", other: "أخرى" },
    clearanceComplete(eos) {
      const req = db.settings[eos.companyId].clearanceDepartments;
      return req.every((d) => eos.clearance[d.key] && eos.clearance[d.key].status === "approved");
    },
    pendingAssets: (eos) => db.assets.filter((a) => a.employeeId === eos.employeeId && a.status === "assigned"),
    canClear(dept) {
      const u = auth.user();
      if (!u || !auth.can("clearance.approve")) return false;
      if (u.role === "SUPER_ADMIN") return true;
      if (dept.role === "HR") return ["HR_MANAGER", "HR_OFFICER"].includes(u.role);
      if (dept.role === "MANAGER") return u.role === "MANAGER" || u.role === "HR_MANAGER";
      return u.role === dept.role;
    },
    settlement(eos) {
      const emp = L.emp(eos.employeeId);
      const s = db.settings[eos.companyId];
      const daily = (emp.basicSalary || 0) / (s.payroll.daysPerMonth || 30);
      const lastDay = eos.lastDay;
      const daysWorked = Number(lastDay.slice(8, 10));
      const annual = db.leaveTypes.find((t) => t.companyId === emp.companyId && t.key === "annual");
      const bal = annual ? E.leaveBalance(db, emp.id, annual.id, Number(lastDay.slice(0, 4))) : { remaining: 0 };
      const advances = U.sum(db.advances.filter((a) => a.employeeId === emp.id && ["approved", "active"].includes(a.status)), (a) => {
        const paid = E.advancePaidBy(a, U.monthKey(U.today()));
        return Math.max(0, a.amount - Math.round((a.amount / a.installments) * paid));
      });
      const auto = { salary: Math.round(daily * daysWorked), leave: Math.round(Math.max(0, bal.remaining) * daily), advances };
      const items = s.settlementComponents.map((c) => ({
        ...c, amount: c.mode === "auto" ? auto[c.key] || 0 : Number((eos.settlement || {})[c.key]) || 0,
      }));
      const earnings = U.sum(items.filter((i) => i.type === "earning"), (i) => i.amount);
      const deductions = U.sum(items.filter((i) => i.type === "deduction"), (i) => i.amount);
      return { items, earnings, deductions, net: earnings - deductions, leaveDays: bal.remaining };
    },
    async setStage(id, stage) {
      return call(() => {
        const eos = db.offboarding.find((o) => o.id === id);
        if (stage === "archived") {
          if (!offboardingService.clearanceComplete(eos)) throw new Error("لا يمكن الأرشفة قبل اعتماد جميع أقسام إخلاء الطرف");
          if (offboardingService.pendingAssets(eos).length) throw new Error("توجد عهد لم تُسلَّم بعد");
          const emp = L.emp(eos.employeeId);
          emp.status = "archived";
          emp.archivedAt = U.today();
          emp.leftDate = eos.lastDay;
          emp.timeline.push({ date: U.today(), title: "انتهاء الخدمة والأرشفة", detail: offboardingService.REASONS[eos.reason], icon: "archive" });
          eos.archivedAt = U.stamp();
        }
        eos.stage = stage;
        audit.log("تحديث مرحلة", "نهاية الخدمة", `${id} → ${stage}`);
        return eos;
      });
    },
    async clear(id, key, status, comment) {
      return call(() => {
        const eos = db.offboarding.find((o) => o.id === id);
        const u = auth.user();
        eos.clearance[key] = { status, by: u.employeeId || u.id, byName: u.name, at: U.stamp(), comment };
        audit.log(status === "approved" ? "اعتماد إخلاء طرف" : "رفض إخلاء طرف", "نهاية الخدمة", `${id} · ${key}`);
        return eos;
      });
    },
  };

  const reportsService = {
    headcount: () => L.inCompany(db.employees).filter((e) => e.status !== "archived" && e.joinDate <= U.today()).length,
    turnover(days = 365) {
      const from = U.addDays(U.today(), -days);
      const left = L.inCompany(db.employees).filter((e) => e.leftDate && e.leftDate >= from).length;
      const avg = reportsService.headcount() || 1;
      return U.round((left / avg) * 100, 1);
    },
    attendanceRate(days = 30) {
      const from = U.addDays(U.today(), -days);
      const recs = L.inCompany(db.attendance).filter((a) => a.date >= from && a.status !== "leave");
      const present = recs.filter((a) => a.checkIn).length;
      return { rate: U.pct(present, recs.length), late: U.pct(recs.filter((a) => a.status === "late").length, recs.length), absence: U.pct(recs.filter((a) => a.status === "absent").length, recs.length), total: recs.length };
    },
    avgTenureYears() {
      const list = L.inCompany(db.employees).filter((e) => e.status !== "archived" && e.joinDate <= U.today());
      return list.length ? U.round(U.sum(list, (e) => U.diffDays(e.joinDate, U.today())) / list.length / 365, 1) : 0;
    },
  };

  /* =========================================================
     Public API
     ========================================================= */
  EHR.store = {
    init() {
      const loaded = storage.load();
      db = loaded || EHR.seed();
      if (!loaded) persist();
      else topUpAttendance();
      EHR.db = db;
    },
    reset() {
      storage.clear();
      db = EHR.seed();
      EHR.db = db;
      persist();
    },
    persist,
    get db() {
      return db;
    },
  };
  EHR.auth = auth;
  EHR.L = L;
  EHR.api = {
    call,
    records,
    submitWithApproval,
    audit,
    notifications,
    approvals,
    employees: employeesService,
    attendance: attendanceService,
    leave: leaveService,
    payroll: payrollService,
    recruitment: recruitmentService,
    onboarding: onboardingService,
    offboarding: offboardingService,
    reports: reportsService,
    contracts: records("contracts", "contracts"),
    advances: records("advances", "advances"),
    compensation: records("compensation", "compensation"),
    documents: records("documents", "documents"),
    assets: records("assets", "assets"),
    disciplinary: records("disciplinary", "disciplinary"),
    requests: records("requests", "requests"),
    travel: records("travel", "travel"),
    transfers: records("transfers", "transfers"),
    overtime: records("overtime", "attendance"),
    corrections: records("corrections", "attendance"),
    reviews: records("reviews", "performance"),
    courses: records("courses", null),
    enrollments: records("enrollments", "training"),
    jobs: records("jobs", null),
    candidates: records("candidates", null),
  };
})((window.EHR = window.EHR || {}));
