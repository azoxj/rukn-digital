/* =========================================================
   Easy HR — demo data generator
   Every person, number and address below is fictional. Dates are
   generated relative to "today" so the demo always looks current.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const E = EHR.engine;

  EHR.seed = function seed() {
    const rnd = U.prng(20260930);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const T = U.today();
    const D = (n) => U.addDays(T, n);
    const thisMonth = U.monthKey(T);
    const monthOffset = (n) => U.monthKey(U.addMonths(`${thisMonth}-01`, n));
    const year = Number(T.slice(0, 4));
    const stamp = (daysAgo, time = "10:00") => new Date(`${D(-daysAgo)}T${time}:00`).toISOString();

    /* ---------------- Companies & organisation ---------------- */
    const companies = [
      { id: "C1", name: "شركة الأفق للتقنية", nameEn: "Al Ofoq Technology Co.", crNumber: "رقم سجل تجاري تجريبي", city: "الرياض", logoHue: 222 },
      { id: "C2", name: "مجموعة الواحة التجارية", nameEn: "Al Waha Trading Group", crNumber: "رقم سجل تجاري تجريبي", city: "الرياض", logoHue: 158 },
    ];
    const branches = [
      { id: "B1", companyId: "C1", name: "المقر الرئيسي - الرياض", city: "الرياض", status: "active" },
      { id: "B2", companyId: "C1", name: "فرع جدة", city: "جدة", status: "active" },
      { id: "B3", companyId: "C1", name: "فرع الدمام", city: "الدمام", status: "active" },
      { id: "B4", companyId: "C2", name: "مقر الواحة - الرياض", city: "الرياض", status: "active" },
      { id: "B5", companyId: "C2", name: "فرع مكة المكرمة", city: "مكة المكرمة", status: "active" },
    ];
    const departments = [
      { id: "D1", companyId: "C1", branchId: "B1", name: "الموارد البشرية", code: "HR" },
      { id: "D2", companyId: "C1", branchId: "B1", name: "تقنية المعلومات", code: "IT" },
      { id: "D3", companyId: "C1", branchId: "B1", name: "المالية", code: "FIN" },
      { id: "D4", companyId: "C1", branchId: "B1", name: "المبيعات", code: "SAL" },
      { id: "D5", companyId: "C1", branchId: "B1", name: "العمليات", code: "OPS" },
      { id: "D6", companyId: "C2", branchId: "B4", name: "الإدارة العامة", code: "ADM" },
      { id: "D7", companyId: "C2", branchId: "B4", name: "المبيعات", code: "SAL" },
    ];
    const sections = [
      { id: "S1", companyId: "C1", departmentId: "D1", name: "التوظيف" },
      { id: "S2", companyId: "C1", departmentId: "D1", name: "شؤون الموظفين" },
      { id: "S3", companyId: "C1", departmentId: "D2", name: "التطوير" },
      { id: "S4", companyId: "C1", departmentId: "D2", name: "الدعم الفني" },
      { id: "S5", companyId: "C1", departmentId: "D3", name: "الحسابات" },
      { id: "S6", companyId: "C1", departmentId: "D3", name: "الرواتب" },
      { id: "S7", companyId: "C1", departmentId: "D4", name: "مبيعات الشركات" },
      { id: "S8", companyId: "C1", departmentId: "D4", name: "خدمة العملاء" },
      { id: "S9", companyId: "C1", departmentId: "D5", name: "الخدمات اللوجستية" },
      { id: "S10", companyId: "C1", departmentId: "D5", name: "المشتريات" },
      { id: "S11", companyId: "C2", departmentId: "D6", name: "العمليات" },
      { id: "S12", companyId: "C2", departmentId: "D7", name: "المبيعات الميدانية" },
    ];
    const grades = [
      { id: "G1", companyId: "C1", name: "الدرجة 1", min: 5000, max: 8000 },
      { id: "G2", companyId: "C1", name: "الدرجة 2", min: 7000, max: 10000 },
      { id: "G3", companyId: "C1", name: "الدرجة 3", min: 9000, max: 13000 },
      { id: "G4", companyId: "C1", name: "الدرجة 4", min: 12000, max: 17000 },
      { id: "G5", companyId: "C1", name: "الدرجة 5", min: 15000, max: 21000 },
      { id: "G6", companyId: "C1", name: "الدرجة 6", min: 19000, max: 30000 },
      { id: "G7", companyId: "C2", name: "الدرجة أ", min: 5000, max: 12000 },
      { id: "G8", companyId: "C2", name: "الدرجة ب", min: 12000, max: 25000 },
    ];
    const jobTitles = [
      { id: "J1", companyId: "C1", name: "مدير إدارة", nameEn: "Department Manager", gradeId: "G6" },
      { id: "J2", companyId: "C1", name: "أخصائي موارد بشرية", nameEn: "HR Specialist", gradeId: "G3" },
      { id: "J3", companyId: "C1", name: "أخصائي توظيف", nameEn: "Recruitment Specialist", gradeId: "G3" },
      { id: "J4", companyId: "C1", name: "مطوّر برمجيات", nameEn: "Software Developer", gradeId: "G4" },
      { id: "J5", companyId: "C1", name: "محلل أعمال", nameEn: "Business Analyst", gradeId: "G4" },
      { id: "J6", companyId: "C1", name: "مسؤول دعم فني", nameEn: "IT Support Officer", gradeId: "G2" },
      { id: "J7", companyId: "C1", name: "محاسب", nameEn: "Accountant", gradeId: "G3" },
      { id: "J8", companyId: "C1", name: "أخصائي رواتب", nameEn: "Payroll Specialist", gradeId: "G3" },
      { id: "J9", companyId: "C1", name: "مندوب مبيعات", nameEn: "Sales Representative", gradeId: "G2" },
      { id: "J10", companyId: "C1", name: "ممثل خدمة عملاء", nameEn: "Customer Service Rep.", gradeId: "G1" },
      { id: "J11", companyId: "C1", name: "منسق عمليات", nameEn: "Operations Coordinator", gradeId: "G2" },
      { id: "J12", companyId: "C1", name: "منسق تدريب", nameEn: "Training Coordinator", gradeId: "G3" },
      { id: "J13", companyId: "C1", name: "مساعد إداري", nameEn: "Administrative Assistant", gradeId: "G1" },
      { id: "J14", companyId: "C2", name: "مدير فرع", nameEn: "Branch Manager", gradeId: "G8" },
      { id: "J15", companyId: "C2", name: "مندوب مبيعات", nameEn: "Sales Representative", gradeId: "G7" },
      { id: "J16", companyId: "C2", name: "موظف عمليات", nameEn: "Operations Officer", gradeId: "G7" },
    ];
    const workplaces = [
      { id: "W1", companyId: "C1", branchId: "B1", name: "المقر الرئيسي - الرياض", address: "طريق الملك فهد، الرياض (عنوان تجريبي)", lat: 24.7136, lng: 46.6753, radius: 150, status: "active", departmentIds: ["D1", "D2", "D3", "D4", "D5"] },
      { id: "W2", companyId: "C1", branchId: "B2", name: "فرع جدة", address: "طريق المدينة، جدة (عنوان تجريبي)", lat: 21.5433, lng: 39.1728, radius: 200, status: "active", departmentIds: ["D4", "D5", "D1"] },
      { id: "W3", companyId: "C1", branchId: "B3", name: "فرع الدمام", address: "طريق الملك سعود، الدمام (عنوان تجريبي)", lat: 26.4207, lng: 50.0888, radius: 150, status: "active", departmentIds: ["D4", "D5"] },
      { id: "W4", companyId: "C2", branchId: "B4", name: "مقر الواحة - الرياض", address: "حي الملز، الرياض (عنوان تجريبي)", lat: 24.6877, lng: 46.7219, radius: 120, status: "active", departmentIds: ["D6", "D7"] },
      { id: "W5", companyId: "C2", branchId: "B5", name: "فرع مكة المكرمة", address: "حي العزيزية، مكة المكرمة (عنوان تجريبي)", lat: 21.4225, lng: 39.8262, radius: 150, status: "inactive", departmentIds: ["D7"] },
    ];
    const WORK = [0, 1, 2, 3, 4]; // Sunday → Thursday (configurable)
    const shifts = [
      { id: "SH1", companyId: "C1", name: "الوردية الصباحية", type: "morning", start: "08:00", end: "17:00", breakMin: 60, grace: 15, days: WORK, workplaceId: "W1" },
      { id: "SH2", companyId: "C1", name: "الوردية المسائية", type: "evening", start: "14:00", end: "23:00", breakMin: 60, grace: 10, days: WORK, workplaceId: "W1" },
      { id: "SH3", companyId: "C1", name: "الوردية الليلية", type: "night", start: "22:00", end: "06:00", breakMin: 45, grace: 10, days: WORK, workplaceId: "W3" },
      { id: "SH4", companyId: "C1", name: "دوام مرن", type: "custom", start: "09:00", end: "18:00", breakMin: 60, grace: 30, days: WORK, workplaceId: "W1" },
      { id: "SH5", companyId: "C1", name: "وردية متناوبة", type: "rotating", start: "08:00", end: "17:00", breakMin: 60, grace: 15, days: WORK, workplaceId: "W1", rotation: ["SH1", "SH2"] },
      { id: "SH6", companyId: "C2", name: "الدوام الرسمي", type: "morning", start: "08:30", end: "17:30", breakMin: 60, grace: 15, days: WORK, workplaceId: "W4" },
    ];

    /* ---------------- Employees ---------------- */
    // [key, nameAr, nameEn, gender, nationality, dept, section, title, branch, workplace, shift, manager, joinOffsetDays, basic, contractType, status]
    const E_ROWS = [
      ["E01", "نورة عبدالله القحطاني", "Noura Abdullah Alqahtani", "F", "SA", "D1", "S2", "J1", "B1", "W1", "SH1", null, -2600, 24000, "permanent", "active"],
      ["E02", "ريم سعد العتيبي", "Reem Saad Alotaibi", "F", "SA", "D1", "S2", "J2", "B1", "W1", "SH1", "E01", -1500, 11500, "permanent", "active"],
      ["E03", "فيصل خالد الدوسري", "Faisal Khalid Aldosari", "M", "SA", "D1", "S1", "J3", "B1", "W1", "SH1", "E01", -900, 10500, "fixed", "active"],
      ["E04", "هند محمد الشهري", "Hind Mohammed Alshehri", "F", "SA", "D1", "S2", "J12", "B1", "W1", "SH1", "E01", -700, 10000, "fixed", "active"],
      ["E05", "سلطان ناصر المطيري", "Sultan Nasser Almutairi", "M", "SA", "D1", "S2", "J2", "B2", "W2", "SH1", "E01", -1200, 10800, "permanent", "active"],
      ["E06", "خالد إبراهيم الغامدي", "Khalid Ibrahim Alghamdi", "M", "SA", "D2", "S3", "J1", "B1", "W1", "SH1", null, -2300, 26000, "permanent", "active"],
      ["E07", "عبدالرحمن فهد الزهراني", "Abdulrahman Fahad Alzahrani", "M", "SA", "D2", "S3", "J4", "B1", "W1", "SH1", "E06", -820, 14500, "fixed", "active"],
      ["E08", "سارة علي الحربي", "Sarah Ali Alharbi", "F", "SA", "D2", "S3", "J4", "B1", "W1", "SH4", "E06", -640, 14000, "fixed", "active"],
      ["E09", "محمد أحمد عبدالعزيز", "Mohamed Ahmed Abdelaziz", "M", "EG", "D2", "S4", "J6", "B1", "W1", "SH2", "E06", -1100, 9000, "fixed", "active"],
      ["E10", "لمى تركي السبيعي", "Lama Turki Alsubaie", "F", "SA", "D2", "S3", "J5", "B1", "W1", "SH1", "E06", -400, 13000, "fixed", "active"],
      ["E11", "أرجون ميهتا", "Arjun Mehta", "M", "IN", "D2", "S3", "J4", "B1", "W1", "SH1", "E06", -950, 13500, "fixed", "active"],
      ["E12", "يوسف ماجد العنزي", "Yousef Majed Alenezi", "M", "SA", "D2", "S4", "J6", "B1", "W1", "SH5", "E06", -50, 8500, "probation", "probation"],
      ["E13", "عبدالله سالم البقمي", "Abdullah Salem Albuqami", "M", "SA", "D3", "S5", "J1", "B1", "W1", "SH1", null, -2100, 25000, "permanent", "active"],
      ["E14", "منيرة حمد السهلي", "Munira Hamad Alsahli", "F", "SA", "D3", "S6", "J8", "B1", "W1", "SH1", "E13", -1000, 12000, "permanent", "active"],
      ["E15", "طارق محمود حسن", "Tariq Mahmoud Hassan", "M", "JO", "D3", "S5", "J7", "B1", "W1", "SH1", "E13", -1300, 11500, "fixed", "active"],
      ["E16", "أمل عبدالرحمن الرشيدي", "Amal Abdulrahman Alrashidi", "F", "SA", "D3", "S6", "J8", "B1", "W1", "SH1", "E13", -520, 10500, "fixed", "active"],
      ["E17", "بندر فيصل العمري", "Bandar Faisal Alomari", "M", "SA", "D4", "S7", "J1", "B1", "W1", "SH1", null, -1900, 23000, "permanent", "active"],
      ["E18", "تركي عادل الشمري", "Turki Adel Alshammari", "M", "SA", "D4", "S7", "J9", "B1", "W1", "SH1", "E17", -760, 8500, "fixed", "active"],
      ["E19", "نوف صالح الجهني", "Nouf Saleh Aljuhani", "F", "SA", "D4", "S7", "J9", "B1", "W1", "SH1", "E17", -600, 8500, "fixed", "active"],
      ["E20", "ماجد راشد القرني", "Majed Rashed Alqarni", "M", "SA", "D4", "S7", "J9", "B2", "W2", "SH1", "E17", -880, 8800, "fixed", "active"],
      ["E21", "جواد أحمد خان", "Jawad Ahmed Khan", "M", "PK", "D4", "S7", "J9", "B3", "W3", "SH1", "E17", -1400, 7800, "fixed", "active"],
      ["E22", "غادة طلال الحارثي", "Ghada Talal Alharthi", "F", "SA", "D4", "S8", "J10", "B1", "W1", "SH2", "E17", -350, 7000, "fixed", "active"],
      ["E23", "مشعل بدر المالكي", "Mishal Badr Almalki", "M", "SA", "D4", "S7", "J9", "B2", "W2", "SH1", "E17", -230, 8200, "fixed", "active"],
      ["E24", "عمر سعيد باوزير", "Omar Saeed Bawazir", "M", "SA", "D5", "S9", "J1", "B1", "W1", "SH1", null, -2000, 22000, "permanent", "active"],
      ["E25", "حسن علي الأحمدي", "Hassan Ali Alahmadi", "M", "SA", "D5", "S9", "J11", "B2", "W2", "SH1", "E24", -1150, 9000, "fixed", "active"],
      ["E26", "ماريا سانتوس", "Maria Santos", "F", "PH", "D5", "S10", "J11", "B1", "W1", "SH1", "E24", -980, 7500, "fixed", "active"],
      ["E27", "عبدالمجيد ناصر السديري", "Abdulmajeed Nasser Alsudairi", "M", "SA", "D5", "S9", "J11", "B3", "W3", "SH3", "E24", -700, 8800, "fixed", "active"],
      ["E28", "وعد خالد العسيري", "Waad Khalid Alasiri", "F", "SA", "D5", "S10", "J11", "B1", "W1", "SH1", "E24", -470, 8700, "fixed", "active"],
      ["E29", "زياد فهد الرويلي", "Ziyad Fahad Alruwaili", "M", "SA", "D5", "S9", "J11", "B1", "W1", "SH1", "E24", -1600, 9200, "fixed", "offboarding"],
      ["E30", "ليان محمد الحمدان", "Layan Mohammed Alhamdan", "F", "SA", "D1", "S2", "J13", "B1", "W1", "SH1", "E01", -9, 6500, "probation", "probation"],
      ["E31", "رنا سامي الخالدي", "Rana Sami Alkhalidi", "F", "SA", "D2", "S3", "J4", "B1", "W1", "SH1", "E06", -1800, 13800, "fixed", "archived"],
      ["E32", "عبدالعزيز مطلق العصيمي", "Abdulaziz Mutlaq Alosaimi", "M", "SA", "D4", "S8", "J10", "B1", "W1", "SH1", "E17", 5, 7000, "probation", "probation"],
      ["E40", "سامي عبدالله الفهيد", "Sami Abdullah Alfuhaid", "M", "SA", "D6", "S11", "J14", "B4", "W4", "SH6", null, -1500, 20000, "permanent", "active"],
      ["E41", "أسماء خالد الزامل", "Asma Khalid Alzamil", "F", "SA", "D6", "S11", "J16", "B4", "W4", "SH6", "E40", -600, 8000, "fixed", "active"],
      ["E42", "فهد سعود القاسم", "Fahad Saud Alqasim", "M", "SA", "D7", "S12", "J15", "B4", "W4", "SH6", "E40", -800, 7500, "fixed", "active"],
      ["E43", "شريف عادل منصور", "Sherif Adel Mansour", "M", "EG", "D7", "S12", "J15", "B4", "W4", "SH6", "E40", -1000, 7200, "fixed", "active"],
      ["E44", "نجلاء ماجد الصالح", "Najla Majed Alsaleh", "F", "SA", "D6", "S11", "J16", "B4", "W4", "SH6", "E40", -300, 7800, "fixed", "active"],
      ["E45", "بدر علي الحمادي", "Badr Ali Alhammadi", "M", "SA", "D7", "S12", "J15", "B4", "W4", "SH6", "E40", -450, 7400, "fixed", "active"],
      ["E46", "روان سليمان الدخيل", "Rawan Sulaiman Aldakheel", "F", "SA", "D6", "S11", "J16", "B4", "W4", "SH6", "E40", -200, 7600, "probation", "probation"],
      ["E47", "كريم يوسف عطية", "Karim Yousef Attia", "M", "EG", "D7", "S12", "J15", "B4", "W4", "SH6", "E40", -1200, 7100, "fixed", "active"],
    ];
    const idOf = {};
    let c1 = 1000;
    let c2 = 2000;
    E_ROWS.forEach((r) => {
      const company = ["D6", "D7"].includes(r[5]) ? "C2" : "C1";
      idOf[r[0]] = `EMP-${company === "C1" ? ++c1 : ++c2}`;
    });
    const NAT = { SA: "سعودي", EG: "مصري", JO: "أردني", IN: "هندي", PK: "باكستاني", PH: "فلبيني" };
    const CITY = { B1: "الرياض", B2: "جدة", B3: "الدمام", B4: "الرياض", B5: "مكة المكرمة" };
    const DISTRICTS = ["حي النرجس", "حي الياسمين", "حي الروضة", "حي السلامة", "حي الشاطئ", "حي الفيصلية", "حي العليا", "حي المروج"];
    const BANKS = ["بنك الريادة (تجريبي)", "مصرف النخبة (تجريبي)", "بنك الأفق الوطني (تجريبي)"];
    const digits = (n) => Array.from({ length: n }, () => between(0, 9)).join("");
    const employees = E_ROWS.map((r, i) => {
      const [key, nameAr, nameEn, gender, nat, dept, section, title, branch, wp, shift, mgr, join, basic, ctype, status] = r;
      const company = ["D6", "D7"].includes(dept) ? "C2" : "C1";
      const saudi = nat === "SA";
      const age = between(24, 52);
      const first = nameEn.split(" ")[0].toLowerCase();
      const last = nameEn.split(" ").slice(-1)[0].toLowerCase().replace(/[^a-z]/g, "");
      return {
        id: idOf[key], companyId: company, nameAr, nameEn, gender,
        nationality: NAT[nat], nationalityCode: nat,
        idType: saudi ? "هوية وطنية" : "إقامة", idNumber: `${saudi ? 1 : 2}${digits(9)}`,
        dob: U.addDays(T, -age * 365 - between(0, 300)),
        marital: pick(["أعزب", "متزوج", "متزوج", "متزوج"]),
        phone: `05${between(0, 9)}${digits(7)}`,
        email: `${first}.${last}@${company === "C1" ? "ofoq" : "waha"}.example`,
        address: `${pick(DISTRICTS)}، ${CITY[branch]} (عنوان تجريبي)`,
        emergency: { name: "جهة اتصال للطوارئ (تجريبي)", relation: pick(["الأب", "الأخ", "الزوج/الزوجة", "الأم"]), phone: `05${between(0, 9)}${digits(7)}` },
        departmentId: dept, sectionId: section, jobTitleId: title, gradeId: (jobTitles.find((j) => j.id === title) || {}).gradeId,
        managerId: mgr ? idOf[mgr] : null, branchId: branch,
        workplaceIds: key === "E05" ? ["W2", "W1"] : [wp], primaryWorkplaceId: wp, shiftId: shift,
        employmentType: ctype === "parttime" ? "دوام جزئي" : "دوام كامل",
        contractType: ctype, joinDate: U.addDays(T, join), probationDays: 90,
        basicSalary: basic, transportAllowance: null, otherAllowance: pick([0, 0, 300, 500]),
        bank: { name: pick(BANKS), iban: `SA${digits(2)} 0000 ${digits(4)} ${digits(4)} ${digits(4)} ${digits(4)}` },
        insurance: { provider: "شركة تأمين (تجريبي)", class: pick(["A", "B", "B", "C"]), policyNo: `POL-${digits(6)}` },
        status, notes: "", archivedAt: status === "archived" ? D(-60) : null,
        avatarHue: U.hue(nameAr), createdAt: stamp(Math.max(0, -join)),
        timeline: [],
      };
    });
    const empBy = (key) => employees.find((e) => e.id === idOf[key]);
    const dept = (id) => departments.find((d) => d.id === id);
    departments.forEach((d) => {
      const head = employees.find((e) => e.departmentId === d.id && e.jobTitleId === "J1") || employees.find((e) => e.departmentId === d.id && e.jobTitleId === "J14");
      d.managerId = head ? head.id : null;
    });
    // E31 left the company; E32 joins soon
    empBy("E31").leftDate = D(-60);

    /* ---------------- Settings (all policies editable) ---------------- */
    const makeSettings = (company) => ({
      company: { name: company.name, nameEn: company.nameEn, workWeek: WORK, weekend: [5, 6], currency: "SAR", timezone: "Asia/Riyadh", language: "ar" },
      attendance: {
        grace: 15, earlyCheckout: 15, overtimeAfter: 30, maxDailyHours: 12, absenceAfter: 120,
        requireGeofence: true, allowWebCheckIn: true, weekendWork: "overtime",
        holidays: [{ date: `${year}-09-23`, name: "إجازة رسمية (مثال قابل للتعديل)" }],
      },
      leave: { countWeekends: false, allowNegative: false, carryOverMax: 10, requireAttachmentForSick: true },
      payroll: {
        housingPct: 25, transportAmount: 500, overtimeMultiplier: 1.5, hoursPerDay: 8, daysPerMonth: 30,
        deductAbsence: true, lateDeductionPerMinute: 0, extraDeductionPct: 0,
        extraDeductionLabel: "استقطاعات نظامية تحددها الشركة", payDay: 27,
      },
      contracts: { alerts: [30, 60, 90], probationDays: 90 },
      workflows: {
        leave: { label: "الإجازات", steps: ["MANAGER", "HR"] },
        advance: { label: "السلف", steps: ["MANAGER", "FINANCE"] },
        contract: { label: "العقود", steps: ["HR", "MANAGER", "HR_MANAGER"] },
        request: { label: "طلبات الموظفين", steps: ["MANAGER", "HR"] },
        overtime: { label: "العمل الإضافي", steps: ["MANAGER", "HR"] },
        correction: { label: "تعديل الحضور", steps: ["MANAGER", "HR"] },
        travel: { label: "السفر والانتداب", steps: ["MANAGER", "HR"] },
        transfer: { label: "النقل والترقيات", steps: ["MANAGER", "HR_MANAGER"] },
        compensation: { label: "البدلات والمزايا", steps: ["HR_MANAGER", "FINANCE"] },
        job: { label: "طلب وظيفة جديدة", steps: ["HR_MANAGER"] },
        offboarding: { label: "نهاية الخدمة", steps: ["MANAGER", "HR_MANAGER"] },
        disciplinary: { label: "الجزاءات", steps: ["HR_MANAGER"] },
      },
      notifications: { inApp: true, email: false, sms: false, contractExpiry: true, documentExpiry: true, lateArrival: true, missingCheckout: true, pendingApproval: true, payroll: true, training: true },
      documentTypes: ["هوية وطنية", "إقامة", "جواز سفر", "عقد عمل", "شهادة علمية", "رخصة", "تقرير طبي للعمل", "شهادة تدريب", "أخرى"],
      assetTypes: ["لابتوب", "جوال", "سيارة", "شريحة اتصال", "بطاقة دخول", "مفاتيح", "معدات", "أدوات", "جهاز لوحي"],
      requestTypes: ["شهادة راتب", "شهادة تعريف بالراتب", "خطاب تعريف", "تحديث بيانات", "استئذان", "طلب نقل", "طلب ترقية", "أخرى"],
      clearanceDepartments: [
        { key: "hr", label: "الموارد البشرية", role: "HR" },
        { key: "finance", label: "المالية", role: "FINANCE" },
        { key: "it", label: "تقنية المعلومات", role: "SUPER_ADMIN" },
        { key: "admin", label: "الشؤون الإدارية", role: "HR" },
        { key: "fleet", label: "الأسطول والمركبات", role: "HR" },
        { key: "manager", label: "المدير المباشر", role: "MANAGER" },
      ],
      settlementComponents: [
        { key: "salary", label: "راتب الأيام المستحقة", type: "earning", mode: "auto" },
        { key: "leave", label: "بدل رصيد الإجازات", type: "earning", mode: "auto" },
        { key: "eos", label: "مكافأة نهاية الخدمة", type: "earning", mode: "manual", hint: "تُحسب وفق السياسة والأنظمة المعتمدة لدى الشركة" },
        { key: "advances", label: "السلف المتبقية", type: "deduction", mode: "auto" },
        { key: "assets", label: "عهد غير مسلّمة", type: "deduction", mode: "manual" },
      ],
      exitQuestions: [
        { key: "reason", label: "سبب ترك العمل" },
        { key: "environment", label: "بيئة العمل" },
        { key: "management", label: "الإدارة والقيادة" },
        { key: "compensation", label: "الرواتب والمزايا" },
        { key: "development", label: "فرص التطوير" },
        { key: "suggestions", label: "مقترحات للتحسين" },
        { key: "comments", label: "ملاحظات أخرى" },
      ],
      privacy: { showDemographics: false, showExactLocation: false },
      integrations: { qiwa: "future", gosi: "future", mudad: "future", bank: "future" },
    });
    const settings = { C1: makeSettings(companies[0]), C2: makeSettings(companies[1]) };

    /* ---------------- Leave types & balances ---------------- */
    const leaveTypes = [];
    ["C1", "C2"].forEach((c) => {
      [
        ["annual", "إجازة سنوية", true, 21, "#2451d6"],
        ["sick", "إجازة مرضية", true, 30, "#d93636"],
        ["emergency", "إجازة اضطرارية", true, 5, "#d98200"],
        ["unpaid", "إجازة بدون راتب", false, 30, "#667085"],
        ["maternity", "إجازة أمومة", true, 70, "#c2255c"],
        ["paternity", "إجازة أبوة", true, 3, "#0b7fc7"],
        ["other", "إجازة أخرى", true, 5, "#7048e8"],
      ].forEach(([key, name, paid, days, color]) =>
        leaveTypes.push({ id: `${c}-${key}`, companyId: c, key, name, paid, defaultDays: days, color, requiresAttachment: key === "sick", active: true })
      );
    });
    const leaveBalances = [];
    employees.forEach((e) => {
      leaveTypes.filter((t) => t.companyId === e.companyId).forEach((t) => {
        if (t.key === "maternity" && e.gender !== "F") return;
        if (t.key === "paternity" && e.gender !== "M") return;
        const carry = t.key === "annual" ? between(0, 8) : 0;
        leaveBalances.push({ employeeId: e.id, typeId: t.id, year, opening: t.defaultDays + carry });
      });
    });

    /* ---------------- Approval helper ---------------- */
    const approval = (type, companyId, empId, states, dayOffset = -2) => {
      const steps = settings[companyId].workflows[type].steps;
      const emp = employees.find((e) => e.id === empId);
      const list = steps.map((role, i) => {
        const skipped = role === "MANAGER" && !emp.managerId;
        const st = skipped ? "skipped" : states[i] || "waiting";
        const byRole = { MANAGER: emp.managerId, HR: idOf.E02, HR_MANAGER: idOf.E01, FINANCE: idOf.E14 }[role];
        return {
          role, status: st,
          by: ["approved", "rejected"].includes(st) ? byRole : null,
          at: ["approved", "rejected"].includes(st) ? stamp(-dayOffset + i * -1 > 0 ? -dayOffset : 1, "11:20") : null,
          comment: st === "rejected" ? "لا يمكن الموافقة في هذه الفترة لضغط العمل" : st === "approved" ? "موافق" : "",
        };
      });
      let current = list.findIndex((s) => s.status === "waiting" || s.status === "pending");
      if (current >= 0) list[current].status = "pending";
      return { type, steps: list, current };
    };
    const statusFromApproval = (ap) =>
      ap.steps.some((s) => s.status === "rejected") ? "rejected" : ap.steps.every((s) => ["approved", "skipped"].includes(s.status)) ? "approved" : "pending";

    /* ---------------- Leaves ---------------- */
    const leaves = [];
    let leaveSeq = 100;
    const addLeave = (key, type, from, to, states, reason) => {
      const e = empBy(key);
      const ap = approval("leave", e.companyId, e.id, states, from);
      const l = {
        id: `LV-${++leaveSeq}`, companyId: e.companyId, employeeId: e.id, typeId: `${e.companyId}-${type}`,
        from: D(from), to: D(to), days: E.leaveDays(settings[e.companyId], D(from), D(to)), reason,
        attachment: type === "sick" ? "تقرير_طبي_تجريبي.pdf" : null,
        approval: ap, status: statusFromApproval(ap), createdAt: stamp(Math.max(1, -from + 5)),
      };
      leaves.push(l);
      return l;
    };
    addLeave("E08", "annual", -20, -16, ["approved", "approved"], "إجازة عائلية");
    addLeave("E19", "sick", -12, -11, ["approved", "approved"], "وعكة صحية");
    addLeave("E25", "annual", -26, -22, ["approved", "approved"], "سفر");
    addLeave("E15", "emergency", -8, -8, ["approved", "approved"], "ظرف طارئ");
    addLeave("E02", "annual", -5, -3, ["approved", "approved"], "إجازة قصيرة");
    addLeave("E10", "annual", -2, 4, ["approved", "approved"], "إجازة سنوية");
    addLeave("E26", "annual", -1, 6, ["approved", "approved"], "زيارة الأهل");
    addLeave("E43", "annual", 0, 3, ["approved", "approved"], "إجازة سنوية");
    addLeave("E18", "annual", 10, 14, ["approved", "approved"], "إجازة سنوية");
    addLeave("E11", "annual", 20, 30, ["approved", "approved"], "سفر إلى الوطن");
    // pending approvals
    addLeave("E07", "annual", 7, 9, ["pending"], "إنجاز معاملات شخصية");
    addLeave("E09", "sick", 1, 2, ["approved", "pending"], "موعد طبي ومتابعة");
    addLeave("E20", "annual", 15, 19, ["pending"], "إجازة سنوية");
    addLeave("E22", "emergency", 2, 2, ["pending"], "ظرف عائلي");
    addLeave("E28", "annual", 25, 29, ["approved", "pending"], "سفر");
    addLeave("E16", "unpaid", 40, 44, ["pending"], "ظروف خاصة");
    addLeave("E05", "paternity", 5, 7, ["approved", "pending"], "مولود جديد");
    addLeave("E44", "annual", 12, 14, ["pending"], "إجازة سنوية");
    // rejected
    addLeave("E23", "annual", -3, -1, ["rejected"], "إجازة قصيرة");
    addLeave("E21", "annual", 3, 5, ["approved", "rejected"], "سفر");

    /* ---------------- Attendance (last 30 days) ---------------- */
    const attendance = [];
    let attSeq = 0;
    const nowM = U.nowMin();
    const DEVICES = ["iPhone · Safari", "Android · Chrome", "Android · Chrome", "Windows · Edge", "macOS · Safari"];
    const onLeave = (empId, iso) => leaves.find((l) => l.employeeId === empId && l.status === "approved" && l.from <= iso && l.to >= iso);
    employees.forEach((e) => {
      if (e.status === "archived") return;
      const s = settings[e.companyId];
      const wp = workplaces.find((w) => w.id === e.primaryWorkplaceId);
      for (let off = -29; off <= 0; off++) {
        const iso = D(off);
        if (iso < e.joinDate) continue;
        if (!E.isWorkday(s, iso)) continue;
        const shift = E.shiftFor({ shifts }, e, iso);
        if (!E.shiftWorksOn(shift, iso)) continue;
        if (off === 0 && e.id === idOf.E07) continue; // the demo employee checks in live
        const base = { id: `AT-${++attSeq}`, companyId: e.companyId, employeeId: e.id, date: iso, shiftId: shift.id, workplaceId: wp.id };
        const lv = onLeave(e.id, iso);
        if (lv) {
          attendance.push({ ...base, status: "leave", checkIn: null, checkOut: null, leaveId: lv.id });
          continue;
        }
        const w = E.shiftWindow(shift);
        const roll = rnd();
        if (roll < 0.035) {
          if (off === 0 && nowM < w.start + s.attendance.absenceAfter) continue;
          attendance.push({ ...base, status: "absent", checkIn: null, checkOut: null });
          continue;
        }
        const late = rnd() < 0.09;
        const inMin = w.start + (late ? between(18, 70) : between(-14, 12));
        if (off === 0 && inMin > nowM) continue; // not arrived yet
        let outMin = null;
        const r3 = rnd();
        if (!(off === 0 && nowM < w.end + 10)) {
          if (r3 < 0.015) outMin = null; // forgot to check out
          else if (r3 < 0.07) outMin = w.end - between(20, 60);
          else if (r3 < 0.24) outMin = w.end + between(35, 130);
          else outMin = w.end + between(-8, 14);
        }
        const rec = {
          ...base,
          checkIn: U.fromMin(inMin), checkOut: outMin == null ? null : U.fromMin(outMin),
          locationStatus: "inside", distance: between(6, Math.min(120, wp.radius - 10)),
          source: rnd() < 0.8 ? "mobile" : "web", device: pick(DEVICES), verification: "location",
        };
        Object.assign(rec, E.calcAttendance(rec, shift, s.attendance));
        rec.status = E.attendanceStatus(rec);
        attendance.push(rec);
      }
    });
    // Two known "forgot to check out" records used by correction requests
    const forceMissingCheckout = (key, off) => {
      const rec = attendance.find((a) => a.employeeId === idOf[key] && a.date === D(off));
      if (rec && rec.checkIn) {
        rec.checkOut = null;
        rec.workedMin = null;
        rec.overtimeMin = 0;
        rec.earlyMin = 0;
      }
      return rec;
    };

    /* ---------------- Contracts ---------------- */
    const contracts = [];
    let ctSeq = 0;
    const expiring = { E09: 12, E15: 24, E21: 28, E26: 19, E11: 27, E18: 45, E20: 75, E25: 85 };
    employees.forEach((e) => {
      let start = e.joinDate;
      let end = null;
      if (e.contractType === "fixed") {
        end = expiring[Object.keys(idOf).find((k) => idOf[k] === e.id)] != null
          ? D(expiring[Object.keys(idOf).find((k) => idOf[k] === e.id)])
          : D(between(140, 620));
        start = U.addDays(end, -730 + 1) > e.joinDate ? U.addDays(end, -730 + 1) : e.joinDate;
      }
      if (e.contractType === "probation") end = U.addDays(e.joinDate, settings[e.companyId].contracts.probationDays);
      let status = "active";
      if (e.status === "archived") status = "expired";
      if (e.id === idOf.E32) status = "review";
      const ct = {
        id: `CT-${++ctSeq}`, companyId: e.companyId, employeeId: e.id,
        number: `${e.companyId === "C1" ? "AFQ" : "WAH"}-${year}-${String(ctSeq).padStart(4, "0")}`,
        type: e.contractType, start, end,
        salary: e.basicSalary, allowances: Math.round(e.basicSalary * 0.25) + 500 + (e.otherAllowance || 0),
        hours: 8, workplaceId: e.primaryWorkplaceId, status,
        approval: e.id === idOf.E32 ? approval("contract", e.companyId, e.id, ["approved"]) : null,
        renewalOf: null, createdAt: stamp(Math.max(1, U.diffDays(start, T))),
      };
      if (e.status === "archived") ct.end = D(-60);
      contracts.push(ct);
    });
    // A renewal draft for a contract that is about to expire
    const baseRenew = contracts.find((c) => c.employeeId === idOf.E09);
    contracts.push({
      id: `CT-${++ctSeq}`, companyId: "C1", employeeId: idOf.E09, number: `AFQ-${year}-${String(ctSeq).padStart(4, "0")}`,
      type: "fixed", start: U.addDays(baseRenew.end, 1), end: U.addDays(baseRenew.end, 730), salary: 9500, allowances: baseRenew.allowances + 200,
      hours: 8, workplaceId: "W1", status: "draft", approval: null, renewalOf: baseRenew.id, createdAt: stamp(2),
    });

    /* ---------------- Documents ---------------- */
    const documents = [];
    let docSeq = 0;
    const addDoc = (e, category, name, number, expiry, fileName) =>
      documents.push({
        id: `DOC-${++docSeq}`, companyId: e.companyId, employeeId: e.id, category, name, number: number || "",
        issue: expiry ? U.addDays(expiry, -365 * 2) : U.addDays(e.joinDate, -30), expiry: expiry || null,
        fileName: fileName || `${name.replace(/\s+/g, "_")}.pdf`, size: between(120, 1800) * 1024,
        uploadedAt: stamp(between(5, 300)), storage: "simulated",
      });
    const docExpiry = { E09: 18, E11: 29, E26: 25, E21: -5 };
    employees.filter((e) => e.status !== "archived").forEach((e) => {
      const key = Object.keys(idOf).find((k) => idOf[k] === e.id);
      const saudi = e.nationalityCode === "SA";
      const exp = docExpiry[key] != null ? D(docExpiry[key]) : D(between(90, 1500));
      addDoc(e, saudi ? "هوية وطنية" : "إقامة", saudi ? "الهوية الوطنية" : "الإقامة", e.idNumber, key === "E26" ? D(between(200, 900)) : exp);
      if (!saudi) addDoc(e, "جواز سفر", "جواز السفر", `P${digits(7)}`, key === "E26" ? D(25) : D(between(300, 2000)));
      addDoc(e, "عقد عمل", "نسخة عقد العمل", "", null);
      if (rnd() < 0.5) addDoc(e, "شهادة علمية", pick(["شهادة البكالوريوس", "شهادة الدبلوم", "شهادة الماجستير"]), "", null);
    });
    addDoc(empBy("E25"), "رخصة", "رخصة القيادة", `L${digits(8)}`, D(210));
    addDoc(empBy("E27"), "تقرير طبي للعمل", "تقرير اللياقة للعمل", "", D(140));

    /* ---------------- Assets ---------------- */
    const assets = [];
    let asSeq = 0;
    const addAsset = (type, name, serial, key, status, condition = "جيدة", issueOff = -200) => {
      const e = key ? empBy(key) : null;
      assets.push({
        id: `AS-${String(++asSeq).padStart(3, "0")}`, companyId: e ? e.companyId : "C1", type, name, serial,
        employeeId: e ? e.id : null, issueDate: e ? D(Math.max(issueOff, U.diffDays(T, e.joinDate))) : null, returnDate: null,
        condition, status, value: { "لابتوب": 5200, "جوال": 3100, "سيارة": 95000, "جهاز لوحي": 2800 }[type] || 300,
        history: e ? [{ date: D(Math.max(issueOff, U.diffDays(T, e.joinDate))), action: "تسليم", employeeId: e.id }] : [],
      });
    };
    addAsset("لابتوب", "Dell Latitude 5440", "DL-54-88213", "E07", "assigned");
    addAsset("لابتوب", "MacBook Pro 14", "MBP-14-20931", "E08", "assigned");
    addAsset("لابتوب", "Lenovo ThinkPad T14", "LN-T14-55021", "E10", "assigned");
    addAsset("لابتوب", "HP EliteBook 840", "HP-840-11007", "E11", "assigned");
    addAsset("جوال", "iPhone 15", "IP15-77451", "E17", "assigned");
    addAsset("جوال", "Samsung Galaxy A54", "SGA54-3310", "E18", "assigned");
    addAsset("شريحة اتصال", "شريحة بيانات مؤسسية", "SIM-0551", "E18", "assigned");
    addAsset("سيارة", "تويوتا هايلكس (لوحة تجريبية)", "VIN-TYT-44120", "E25", "assigned", "جيدة جدًا");
    addAsset("بطاقة دخول", "بطاقة دخول المقر", "CARD-1107", "E07", "assigned");
    addAsset("مفاتيح", "مفاتيح المستودع", "KEY-WH-02", "E26", "assigned");
    addAsset("لابتوب", "Dell Latitude 5440", "DL-54-88290", null, "available");
    addAsset("جوال", "Samsung Galaxy A34", "SGA34-1022", null, "available");
    addAsset("معدات", "طابعة ملصقات محمولة", "PRN-LB-301", null, "maintenance", "تحتاج صيانة");
    addAsset("لابتوب", "Lenovo ThinkPad قديم", "LN-OLD-0099", null, "retired", "تالف");
    addAsset("لابتوب", "HP ProBook 450", "HP-450-66210", "E29", "assigned");
    addAsset("بطاقة دخول", "بطاقة دخول المقر", "CARD-1188", "E29", "assigned");
    addAsset("أدوات", "أدوات قياس ومعدات سلامة", "TL-SAFE-09", "E27", "assigned");
    addAsset("جهاز لوحي", "iPad Air", "IPAD-A-5561", "E24", "assigned");
    addAsset("لابتوب", "Dell Latitude 7440", "DL-74-19822", "E14", "assigned");
    addAsset("لابتوب", "MacBook Air", "MBA-13-44310", "E02", "assigned");
    addAsset("لابتوب", "Dell Vostro 3520", "DV-35-10021", "E30", "assigned", "جديد", -8);
    addAsset("لابتوب", "HP ProBook 440", "HP-440-99010", "E42", "assigned");

    /* ---------------- Advances ---------------- */
    const advances = [];
    let advSeq = 0;
    const addAdvance = (key, amount, installments, startMonth, reason, states, status) => {
      const e = empBy(key);
      const ap = approval("advance", e.companyId, e.id, states);
      advances.push({
        id: `ADV-${++advSeq}`, companyId: e.companyId, employeeId: e.id, amount, installments, startMonth, reason,
        approval: ap, status: status || statusFromApproval(ap), createdAt: stamp(between(3, 70)),
      });
    };
    addAdvance("E18", 5000, 5, monthOffset(-2), "ظروف عائلية", ["approved", "approved"]);
    addAdvance("E26", 3000, 3, monthOffset(-1), "رسوم دراسية", ["approved", "approved"]);
    addAdvance("E09", 4000, 4, monthOffset(1), "إصلاح سيارة", ["pending"]);
    addAdvance("E22", 2000, 2, monthOffset(1), "مصاريف طارئة", ["approved", "pending"]);
    addAdvance("E07", 6000, 6, monthOffset(-8), "شراء أثاث", ["approved", "approved"], "closed");
    addAdvance("E20", 2500, 5, thisMonth, "مصاريف انتقال", ["approved", "approved"]);

    /* ---------------- Compensation & benefits history ---------------- */
    const compensation = [];
    let cmSeq = 0;
    const addComp = (key, kind, item, prev, next, effOff, reason, status = "approved") => {
      const e = empBy(key);
      compensation.push({
        id: `CMP-${++cmSeq}`, companyId: e.companyId, employeeId: e.id, kind, item, prev, next,
        effective: D(effOff), reason, status,
        approval: approval("compensation", e.companyId, e.id, status === "approved" ? ["approved", "approved"] : ["approved"]),
        approverId: idOf.E01, createdAt: stamp(Math.max(1, -effOff + 3)),
      });
    };
    addComp("E07", "raise", "الراتب الأساسي", 13500, 14500, -60, "نتيجة تقييم أداء متميز");
    addComp("E19", "commission", "عمولة مبيعات الربع", 0, 1800, -20, "تحقيق مستهدف المبيعات");
    addComp("E18", "bonus", "مكافأة تحقيق المستهدف", 0, 2500, -2, "تجاوز المستهدف الشهري");
    addComp("E10", "allowance", "بدل اتصال", 0, 300, -90, "طبيعة العمل");
    addComp("E14", "benefit", "فئة التأمين الطبي", "B", "A", -120, "ترقية المزايا حسب الدرجة");
    addComp("E02", "promotion", "المسمى الوظيفي", "أخصائي موارد بشرية", "أخصائي موارد بشرية أول", -30, "ترقية سنوية");
    addComp("E25", "raise", "الراتب الأساسي", 8500, 9000, -200, "مراجعة سنوية");
    addComp("E09", "allowance", "بدل مناوبة", 0, 500, -10, "العمل في الوردية المسائية", "pending");
    addComp("E17", "bonus", "مكافأة ربعية", 0, 5000, -75, "أداء فريق المبيعات");

    /* ---------------- Overtime & attendance corrections ---------------- */
    const overtime = [];
    let otSeq = 0;
    const addOT = (key, off, hours, reason, states) => {
      const e = empBy(key);
      const ap = approval("overtime", e.companyId, e.id, states);
      overtime.push({ id: `OT-${++otSeq}`, companyId: e.companyId, employeeId: e.id, date: D(off), hours, reason, approval: ap, status: statusFromApproval(ap), createdAt: stamp(Math.max(0, -off)) });
    };
    addOT("E08", -3, 2, "إطلاق تحديث النظام", ["approved", "approved"]);
    addOT("E09", -1, 3, "صيانة طارئة للخوادم", ["pending"]);
    addOT("E27", -5, 4, "استلام شحنة ليلية", ["approved", "approved"]);
    addOT("E07", -2, 1.5, "إنهاء مهمة عاجلة", ["approved", "pending"]);
    addOT("E20", -6, 2, "زيارة عميل بعد الدوام", ["rejected"]);

    const corrections = [];
    let crSeq = 0;
    const addCorrection = (key, off, field, requested, reason, states, forceMissing) => {
      const e = empBy(key);
      const rec = forceMissing ? forceMissingCheckout(key, off) : attendance.find((a) => a.employeeId === e.id && a.date === D(off));
      if (!rec) return;
      const ap = approval("correction", e.companyId, e.id, states);
      corrections.push({
        id: `CR-${++crSeq}`, companyId: e.companyId, employeeId: e.id, attendanceId: rec.id, date: rec.date, field,
        original: rec[field], requested, reason, approval: ap, status: statusFromApproval(ap), createdAt: stamp(Math.max(0, -off - 1)),
      });
    };
    addCorrection("E08", -4, "checkOut", "17:05", "نسيت تسجيل الانصراف", ["pending"], true);
    addCorrection("E18", -7, "checkIn", "08:05", "عطل في تطبيق الجوال", ["rejected"]);
    addCorrection("E07", -6, "checkOut", "17:10", "انتهت بطارية الجوال", ["approved", "pending"], true);

    /* ---------------- Performance ---------------- */
    const perfCycles = [
      { id: "PC1", companyId: "C1", name: `تقييم منتصف العام ${year}`, period: `${year}-H1`, start: D(-40), end: D(20), status: "active" },
      { id: "PC0", companyId: "C1", name: `التقييم السنوي ${year - 1}`, period: `${year - 1}`, start: `${year - 1}-11-15`, end: `${year - 1}-12-31`, status: "closed" },
      { id: "PC2", companyId: "C2", name: `تقييم منتصف العام ${year}`, period: `${year}-H1`, start: D(-30), end: D(30), status: "active" },
    ];
    const GOALS = {
      D2: [["إطلاق الإصدار الجديد من البوابة", 40], ["خفض الأعطال الحرجة بنسبة 30%", 30], ["توثيق الأنظمة الداخلية", 30]],
      D4: [["تحقيق مستهدف مبيعات الربع", 50], ["إضافة 10 عملاء جدد", 30], ["رفع رضا العملاء", 20]],
      D1: [["تقليص مدة التوظيف إلى 30 يومًا", 40], ["أتمتة ملفات الموظفين", 30], ["تنفيذ خطة التدريب السنوية", 30]],
    };
    const reviews = [];
    let rvSeq = 0;
    const addReview = (key, stage, selfScore, mgrScore) => {
      const e = empBy(key);
      const goals = (GOALS[e.departmentId] || GOALS.D1).map(([title, weight]) => ({ title, weight, progress: stage === "goals" ? 0 : between(45, 100) }));
      reviews.push({
        id: `RV-${++rvSeq}`, companyId: e.companyId, cycleId: "PC1", employeeId: e.id, reviewerId: e.managerId,
        stage, goals, selfScore: selfScore ?? null, managerScore: mgrScore ?? null,
        finalScore: stage === "approved" ? Math.round((selfScore * 0.3 + mgrScore * 0.7) * 10) / 10 : null,
        managerComment: mgrScore ? "أداء جيد مع فرص للتطوير في إدارة الوقت." : "",
        selfComment: selfScore ? "حققت أغلب الأهداف وأطمح لتطوير مهاراتي القيادية." : "",
        devPlan: stage === "approved" ? "دورة في إدارة المشاريع خلال الربع القادم" : "",
        updatedAt: stamp(between(1, 20)),
      });
    };
    addReview("E07", "employee_review", null, 4.2);
    addReview("E08", "approved", 4.5, 4.4);
    addReview("E09", "manager_review", 3.8, null);
    addReview("E10", "in_progress");
    addReview("E11", "approved", 4.0, 3.9);
    addReview("E12", "goals");
    addReview("E18", "manager_review", 4.1, null);
    addReview("E19", "approved", 4.6, 4.7);
    addReview("E20", "in_progress");
    addReview("E02", "approved", 4.3, 4.5);
    addReview("E03", "employee_review", null, 3.6);

    /* ---------------- Training ---------------- */
    const courses = [
      { id: "TR1", companyId: "C1", name: "القيادة الإدارية الفعّالة", provider: "أكاديمية تطوير (تجريبي)", trainer: "م. خالد يوسف", type: "حضوري", hours: 16, cost: 18000, start: D(-40), end: D(-38), seats: 12, status: "completed", skill: "القيادة", certValidityDays: 0 },
      { id: "TR2", companyId: "C1", name: "أمن المعلومات للموظفين", provider: "داخلي", trainer: "فريق تقنية المعلومات", type: "عن بُعد", hours: 4, cost: 0, start: D(-10), end: D(-10), seats: 60, status: "completed", skill: "أمن المعلومات", certValidityDays: 365 },
      { id: "TR3", companyId: "C1", name: "مهارات التفاوض والمبيعات", provider: "مركز مهارات (تجريبي)", trainer: "أ. سارة المحمد", type: "حضوري", hours: 12, cost: 9600, start: D(6), end: D(7), seats: 10, status: "upcoming", skill: "المبيعات", certValidityDays: 0 },
      { id: "TR4", companyId: "C1", name: "الإسعافات الأولية", provider: "جهة تدريب معتمدة (تجريبي)", trainer: "مدرب معتمد", type: "حضوري", hours: 8, cost: 4200, start: D(-345), end: D(-345), seats: 15, status: "completed", skill: "السلامة", certValidityDays: 365 },
      { id: "TR5", companyId: "C1", name: "Excel المتقدم وتحليل البيانات", provider: "منصة تعلّم (تجريبي)", trainer: "محتوى إلكتروني", type: "إلكتروني", hours: 10, cost: 2400, start: D(-12), end: D(18), seats: 20, status: "in_progress", skill: "تحليل البيانات", certValidityDays: 0 },
      { id: "TR6", companyId: "C1", name: "أنظمة وسياسات الموارد البشرية", provider: "داخلي", trainer: "إدارة الموارد البشرية", type: "حضوري", hours: 6, cost: 0, start: D(15), end: D(15), seats: 25, status: "upcoming", skill: "الامتثال", certValidityDays: 0 },
      { id: "TR7", companyId: "C2", name: "خدمة العملاء المتميزة", provider: "داخلي", trainer: "مدير الفرع", type: "حضوري", hours: 6, cost: 0, start: D(9), end: D(9), seats: 10, status: "upcoming", skill: "خدمة العملاء", certValidityDays: 0 },
    ];
    const enrollments = [];
    let enSeq = 0;
    const enroll = (courseId, keys, status) =>
      keys.forEach((k) => {
        const e = empBy(k);
        const course = courses.find((c) => c.id === courseId);
        const done = status === "completed";
        enrollments.push({
          id: `EN-${++enSeq}`, companyId: e.companyId, courseId, employeeId: e.id, status,
          attendance: done ? between(85, 100) : status === "in_progress" ? between(30, 70) : 0,
          score: done ? between(70, 98) : null,
          certificateNo: done ? `CERT-${digits(6)}` : null,
          certExpiry: done && course.certValidityDays ? U.addDays(course.end, course.certValidityDays) : null,
        });
      });
    enroll("TR1", ["E06", "E13", "E17", "E24", "E01"], "completed");
    enroll("TR2", ["E07", "E08", "E09", "E10", "E11", "E14", "E15", "E18", "E19"], "completed");
    enroll("TR3", ["E18", "E19", "E20", "E21", "E23"], "enrolled");
    enroll("TR4", ["E25", "E27", "E28"], "completed");
    enroll("TR5", ["E10", "E14", "E16"], "in_progress");
    enroll("TR6", ["E30", "E12", "E02"], "enrolled");
    enroll("TR7", ["E42", "E43", "E45"], "enrolled");

    /* ---------------- Disciplinary ---------------- */
    const disciplinary = [];
    let dsSeq = 0;
    const addDisc = (key, off, type, description, action, status, amount = 0) => {
      const e = empBy(key);
      disciplinary.push({
        id: `DS-${++dsSeq}`, companyId: e.companyId, employeeId: e.id, date: D(off), type, description, action, status,
        amount, applyToPayroll: amount > 0, attachments: status === "investigation" ? ["محضر_تحقيق_تجريبي.pdf"] : [],
        approverId: ["decided", "closed"].includes(status) ? idOf.E01 : null,
        approval: status === "pending_approval" ? approval("disciplinary", e.companyId, e.id, []) : null,
        createdAt: stamp(Math.max(0, -off)),
      });
    };
    addDisc("E22", -15, "إنذار", "تأخر متكرر عن بداية الوردية", "إنذار كتابي أول", "closed");
    addDisc("E23", -30, "مخالفة", "عدم الالتزام بإجراءات السلامة في الموقع", "لفت نظر", "closed");
    addDisc("E21", -6, "تحقيق", "شكوى من أحد العملاء بخصوص التواصل", "قيد التحقيق", "investigation");
    addDisc("E09", -18, "خصم", "غياب بدون عذر مقبول", "خصم يوم وفق اللائحة المعتمدة", "decided", 300);
    addDisc("E12", -2, "إنذار", "مخالفة سياسة استخدام الأجهزة", "إنذار كتابي", "pending_approval");

    /* ---------------- Requests ---------------- */
    const requests = [];
    let rqSeq = 0;
    const addRequest = (key, type, details, off, states, finalStatus) => {
      const e = empBy(key);
      const ap = approval("request", e.companyId, e.id, states);
      let status = statusFromApproval(ap);
      if (finalStatus) status = finalStatus;
      if (!states.length && !finalStatus) status = "new";
      requests.push({
        id: `REQ-${year}-${String(++rqSeq).padStart(3, "0")}`, companyId: e.companyId, employeeId: e.id, type, details,
        date: D(off), approval: ap, status, comments: [], createdAt: stamp(Math.max(0, -off)),
      });
    };
    addRequest("E07", "شهادة راتب", "مطلوبة لتقديمها إلى جهة تمويل", -1, ["pending"]);
    addRequest("E08", "خطاب تعريف", "خطاب تعريف موجّه لسفارة", -4, ["approved", "approved"], "completed");
    addRequest("E10", "تحديث بيانات", "تحديث رقم الجوال والعنوان", -2, ["approved", "pending"]);
    addRequest("E11", "استئذان", "استئذان ساعتين يوم الأحد لمراجعة جهة حكومية", -1, ["pending"]);
    addRequest("E18", "شهادة تعريف بالراتب", "لفتح حساب بنكي", -6, ["approved", "approved"], "completed");
    addRequest("E19", "طلب نقل", "رغبة في الانتقال إلى فرع جدة", -9, ["rejected"]);
    addRequest("E22", "استئذان", "مغادرة مبكرة لظرف عائلي", 0, [], null);
    addRequest("E25", "أخرى", "طلب تجديد بطاقة الدخول", -3, ["approved", "approved"]);
    addRequest("E28", "شهادة راتب", "مطلوبة لجهة حكومية", -2, ["approved", "pending"]);
    addRequest("E14", "خطاب تعريف", "خطاب تعريف عام", -12, ["approved"], "completed");
    addRequest("E09", "طلب ترقية", "طلب مراجعة المسمى الوظيفي بعد إتمام الشهادة", -5, ["pending"]);
    addRequest("E42", "شهادة راتب", "لجهة تمويل", -1, ["pending"]);
    addRequest("E07", "تحديث بيانات", "إضافة مؤهل علمي جديد", -20, ["approved", "approved"], "completed");

    /* ---------------- Travel / assignments ---------------- */
    const travel = [];
    let tvSeq = 0;
    const addTravel = (key, destination, purpose, fromOff, toOff, perDiem, states, finalStatus) => {
      const e = empBy(key);
      const ap = approval("travel", e.companyId, e.id, states);
      travel.push({
        id: `TRV-${++tvSeq}`, companyId: e.companyId, employeeId: e.id, destination, purpose, kind: destination.includes("داخلي") ? "انتداب داخلي" : "سفر عمل",
        from: D(fromOff), to: D(toOff), perDiem, transport: "طيران", status: finalStatus || statusFromApproval(ap), approval: ap, createdAt: stamp(Math.max(0, -fromOff + 6)),
      });
    };
    addTravel("E17", "جدة", "اجتماع مع عميل استراتيجي", 3, 5, 600, ["approved"]);
    addTravel("E07", "دبي", "حضور مؤتمر تقني", 18, 21, 900, ["pending"]);
    addTravel("E25", "الدمام", "دعم افتتاح المستودع", -20, -17, 500, ["approved", "approved"], "completed");
    addTravel("E10", "الخبر", "ورشة عمل مع شريك", 9, 10, 500, ["approved", "pending"]);
    addTravel("E20", "المدينة المنورة", "زيارة عملاء", -8, -7, 450, ["rejected"]);

    /* ---------------- Transfers & promotions ---------------- */
    const transfers = [];
    let tfSeq = 0;
    const addTransfer = (key, kind, from, to, effOff, reason, states, finalStatus) => {
      const e = empBy(key);
      const ap = approval("transfer", e.companyId, e.id, states);
      transfers.push({
        id: `TRF-${++tfSeq}`, companyId: e.companyId, employeeId: e.id, kind, from, to, effective: D(effOff), reason,
        status: finalStatus || statusFromApproval(ap), approval: ap, createdAt: stamp(Math.max(1, -effOff + 10)),
      });
    };
    addTransfer("E05", "transfer", { branchId: "B2", departmentId: "D1" }, { branchId: "B1", departmentId: "D1" }, 20, "احتياج المقر الرئيسي", ["approved", "pending"]);
    addTransfer("E02", "promotion", { jobTitle: "أخصائي موارد بشرية", gradeId: "G3" }, { jobTitle: "أخصائي موارد بشرية أول", gradeId: "G4" }, -30, "ترقية سنوية مستحقة", ["approved", "approved"], "completed");
    addTransfer("E08", "promotion", { jobTitle: "مطوّر برمجيات", gradeId: "G4" }, { jobTitle: "مطوّر برمجيات أول", gradeId: "G5" }, 30, "أداء متميز لعامين", ["pending"]);
    addTransfer("E28", "transfer", { sectionId: "S9" }, { sectionId: "S10" }, -45, "إعادة توزيع المهام", ["approved", "approved"], "completed");
    addTransfer("E23", "transfer", { branchId: "B2" }, { branchId: "B3" }, 40, "رغبة الموظف", ["rejected"]);

    /* ---------------- Recruitment ---------------- */
    const jobs = [
      { id: "JOB-1", companyId: "C1", title: "مطوّر واجهات أمامية", departmentId: "D2", branchId: "B1", type: "دوام كامل", openings: 2, status: "open", description: "تطوير واجهات المنتجات الرقمية باستخدام HTML وCSS وJavaScript.", requirements: "خبرة 3 سنوات، معرفة بأطر العمل الحديثة", salaryRange: "12,000 – 16,000", createdAt: stamp(25), approval: null },
      { id: "JOB-2", companyId: "C1", title: "محاسب أول", departmentId: "D3", branchId: "B1", type: "دوام كامل", openings: 1, status: "open", description: "إعداد القوائم المالية ومتابعة الحسابات.", requirements: "خبرة 5 سنوات، شهادة مهنية ميزة", salaryRange: "13,000 – 17,000", createdAt: stamp(18), approval: null },
      { id: "JOB-3", companyId: "C1", title: "مندوب مبيعات - جدة", departmentId: "D4", branchId: "B2", type: "دوام كامل", openings: 2, status: "open", description: "تطوير المبيعات في المنطقة الغربية.", requirements: "خبرة سنتين في المبيعات، رخصة قيادة", salaryRange: "7,500 – 9,500 + عمولة", createdAt: stamp(12), approval: null },
      { id: "JOB-4", companyId: "C1", title: "أخصائي تدريب", departmentId: "D1", branchId: "B1", type: "دوام كامل", openings: 1, status: "requested", description: "تخطيط وتنفيذ برامج التدريب.", requirements: "خبرة 3 سنوات في التدريب والتطوير", salaryRange: "10,000 – 13,000", createdAt: stamp(3), approval: approval("job", "C1", idOf.E03, []), requestedBy: idOf.E03 },
      { id: "JOB-5", companyId: "C1", title: "ممثل خدمة عملاء", departmentId: "D4", branchId: "B1", type: "دوام كامل", openings: 1, status: "closed", description: "استقبال استفسارات العملاء وحلها.", requirements: "مهارات تواصل ممتازة", salaryRange: "6,500 – 7,500", createdAt: stamp(60), approval: null },
      { id: "JOB-6", companyId: "C2", title: "مندوب مبيعات", departmentId: "D7", branchId: "B4", type: "دوام كامل", openings: 1, status: "open", description: "مبيعات ميدانية في الرياض.", requirements: "خبرة سنة", salaryRange: "6,500 – 8,000", createdAt: stamp(9), approval: null },
    ];
    const CAND = [
      ["JOB-1", "أحمد ياسر المرزوقي", 4, "بكالوريوس علوم حاسب", "applied", null],
      ["JOB-1", "هيا عبدالله النمر", 3, "بكالوريوس نظم معلومات", "screening", null],
      ["JOB-1", "مازن طلال الفيفي", 5, "بكالوريوس هندسة برمجيات", "interview", null],
      ["JOB-1", "دلال فهد الحميدي", 4, "ماجستير علوم حاسب", "evaluation", 82],
      ["JOB-1", "رائد حسن العمودي", 6, "بكالوريوس علوم حاسب", "offer", 88],
      ["JOB-1", "سيف علي البلوي", 1, "دبلوم تقنية", "rejected", 54],
      ["JOB-1", "جنى ماجد الربيعة", 2, "بكالوريوس علوم حاسب", "applied", null],
      ["JOB-2", "إبراهيم سعد الهاجري", 6, "بكالوريوس محاسبة + SOCPA", "applied", null],
      ["JOB-2", "شهد ناصر الخثلان", 5, "بكالوريوس محاسبة", "interview", null],
      ["JOB-2", "عادل محمد الغامدي", 7, "ماجستير مالية", "evaluation", 76],
      ["JOB-2", "لينا فيصل الجار الله", 2, "بكالوريوس محاسبة", "rejected", 60],
      ["JOB-3", "بسام خالد اللحياني", 3, "بكالوريوس إدارة أعمال", "applied", null],
      ["JOB-3", "نواف سالم الحربي", 2, "دبلوم تسويق", "applied", null],
      ["JOB-3", "مهند عمر باشا", 4, "بكالوريوس تسويق", "screening", null],
      ["JOB-3", "طلال راشد الزهراني", 3, "بكالوريوس إدارة أعمال", "accepted", 85],
      ["JOB-5", "عبدالعزيز مطلق العصيمي", 2, "بكالوريوس إدارة أعمال", "hired", 84],
      ["JOB-6", "منصور عبدالله العتيق", 2, "دبلوم مبيعات", "screening", null],
    ];
    const candidates = CAND.map(([jobId, name, exp, edu, stage, score], i) => {
      const job = jobs.find((j) => j.id === jobId);
      const interviews = [];
      if (["interview", "evaluation", "offer", "accepted", "hired", "rejected"].includes(stage) && stage !== "rejected" || (stage === "rejected" && score)) {
        interviews.push({
          id: `INT-${i + 1}`, date: stage === "interview" ? D(i % 2 ? 1 : 2) : D(-between(3, 12)), time: pick(["10:00", "11:30", "13:00"]),
          type: pick(["حضوري", "عن بُعد"]), interviewer: job.departmentId === "D2" ? idOf.E06 : job.departmentId === "D3" ? idOf.E13 : idOf.E17,
          status: stage === "interview" ? "scheduled" : "done", score: stage === "interview" ? null : score,
          notes: stage === "interview" ? "" : "مهارات تقنية جيدة وتواصل واضح.",
        });
      }
      return {
        id: `CAN-${100 + i}`, companyId: job.companyId, jobId, name, phone: `05${between(0, 9)}${digits(7)}`,
        email: `candidate${100 + i}@mail.example`, experience: exp, education: edu, cvName: `CV_${100 + i}.pdf`,
        stage, score, interviews,
        offer: ["offer", "accepted", "hired"].includes(stage) ? { salary: jobId === "JOB-1" ? 15000 : jobId === "JOB-5" ? 7000 : 8500, start: stage === "hired" ? D(5) : D(21), status: stage === "offer" ? "sent" : "accepted" } : null,
        notes: "", appliedAt: stamp(between(2, 24)), employeeId: stage === "hired" ? idOf.E32 : null,
      };
    });

    /* ---------------- Onboarding ---------------- */
    const ONB_TASKS = [
      ["account", "إنشاء حساب الموظف", "HR"], ["documents", "رفع المستندات", "HR"], ["contract", "توقيع العقد", "HR"],
      ["workplace", "تحديد موقع العمل", "HR"], ["department", "تعيين الإدارة", "HR"], ["manager", "تعيين المدير المباشر", "HR"],
      ["payroll", "بيانات الرواتب والحساب البنكي", "FINANCE"], ["attendance", "إعداد الحضور", "HR"], ["shift", "تعيين الوردية", "HR"],
      ["assets", "تسليم العهد", "IT"], ["orientation", "برنامج التعريف", "MANAGER"], ["training", "التدريب الأولي", "TRAINING"],
    ];
    const onboarding = [
      { id: "ONB-1", companyId: "C1", employeeId: idOf.E30, candidateId: null, startDate: D(-9), createdAt: stamp(15),
        tasks: ONB_TASKS.map(([key, title, owner], i) => ({ key, title, owner, status: i < 9 ? "completed" : i === 9 ? "completed" : i === 10 ? "in_progress" : "pending" })) },
      { id: "ONB-2", companyId: "C1", employeeId: idOf.E32, candidateId: "CAN-115", startDate: D(5), createdAt: stamp(2),
        tasks: ONB_TASKS.map(([key, title, owner], i) => ({ key, title, owner, status: i < 2 ? "completed" : i === 2 ? "in_progress" : "pending" })) },
    ];

    /* ---------------- End of service ---------------- */
    const clearanceTemplate = settings.C1.clearanceDepartments;
    const offboarding = [
      {
        id: "EOS-1", companyId: "C1", employeeId: idOf.E29, reason: "resignation", requestDate: D(-18), noticeDays: 30, lastDay: D(12),
        stage: "clearance", approval: approval("offboarding", "C1", idOf.E29, ["approved", "approved"]),
        handover: { status: "in_progress", to: idOf.E25, notes: "تسليم ملفات الموردين والمسارات" },
        clearance: Object.fromEntries(clearanceTemplate.map((c) => [c.key, { status: ["it", "manager"].includes(c.key) ? "approved" : "pending", by: ["it", "manager"].includes(c.key) ? idOf.E06 : null, at: ["it", "manager"].includes(c.key) ? stamp(3) : null, comment: "" }])),
        settlement: { eos: null, assets: 0, notes: "" }, exitInterview: null, archivedAt: null, createdAt: stamp(18),
      },
      {
        id: "EOS-0", companyId: "C1", employeeId: idOf.E31, reason: "contract_expiry", requestDate: D(-95), noticeDays: 30, lastDay: D(-60),
        stage: "archived", approval: approval("offboarding", "C1", idOf.E31, ["approved", "approved"]),
        handover: { status: "completed", to: idOf.E08, notes: "تم تسليم المشاريع" },
        clearance: Object.fromEntries(clearanceTemplate.map((c) => [c.key, { status: "approved", by: idOf.E01, at: stamp(62), comment: "" }])),
        settlement: { eos: 32000, assets: 0, notes: "تمت التسوية" },
        exitInterview: { reason: "انتهاء العقد وفرصة خارج المدينة", environment: "4", management: "4", compensation: "3", development: "3", suggestions: "زيادة فرص التدريب التقني", comments: "تجربة إيجابية", at: stamp(61) },
        archivedAt: stamp(58), createdAt: stamp(95),
      },
    ];

    /* ---------------- Payroll runs ---------------- */
    const payrollRuns = [];
    const partial = { contracts, overtime, compensation, attendance, advances, disciplinary };
    [-3, -2, -1, 0].forEach((mo) => {
      ["C1", "C2"].forEach((c) => {
        const period = monthOffset(mo);
        const rules = settings[c].payroll;
        const staff = employees.filter((e) => e.companyId === c && ["active", "probation", "offboarding"].includes(e.status) && e.joinDate <= `${period}-28`);
        const lines = staff.map((e) => E.payrollLine(partial, e, period, rules));
        payrollRuns.push({
          id: `PR-${c}-${period}`, companyId: c, period, status: mo < 0 ? "paid" : "draft",
          lines, createdAt: stamp(mo < 0 ? -mo * 30 - 3 : 1),
          history: mo < 0
            ? ["draft", "review", "approved", "processed", "paid"].map((s, i) => ({ status: s, at: stamp(Math.max(1, -mo * 30 - i)), by: i === 2 ? idOf.E01 : idOf.E14 }))
            : [{ status: "draft", at: stamp(1), by: idOf.E14 }],
        });
      });
    });

    /* ---------------- Users (demo accounts — no passwords stored) ---------------- */
    const users = [
      { id: "U-ADMIN", role: "SUPER_ADMIN", name: "مدير النظام", employeeId: null, companyId: "C1", email: "admin@easyhr.example" },
      { id: "U-HRM", role: "HR_MANAGER", name: empBy("E01").nameAr, employeeId: idOf.E01, companyId: "C1", email: empBy("E01").email },
      { id: "U-HRO", role: "HR_OFFICER", name: empBy("E02").nameAr, employeeId: idOf.E02, companyId: "C1", email: empBy("E02").email },
      { id: "U-MGR", role: "MANAGER", name: empBy("E06").nameAr, employeeId: idOf.E06, companyId: "C1", email: empBy("E06").email },
      { id: "U-EMP", role: "EMPLOYEE", name: empBy("E07").nameAr, employeeId: idOf.E07, companyId: "C1", email: empBy("E07").email },
      { id: "U-FIN", role: "FINANCE", name: empBy("E14").nameAr, employeeId: idOf.E14, companyId: "C1", email: empBy("E14").email },
      { id: "U-REC", role: "RECRUITER", name: empBy("E03").nameAr, employeeId: idOf.E03, companyId: "C1", email: empBy("E03").email },
      { id: "U-TRN", role: "TRAINING", name: empBy("E04").nameAr, employeeId: idOf.E04, companyId: "C1", email: empBy("E04").email },
      { id: "U-AUD", role: "AUDITOR", name: "مدقق داخلي", employeeId: null, companyId: "C1", email: "auditor@easyhr.example" },
    ];

    /* ---------------- Timelines ---------------- */
    employees.forEach((e) => {
      e.timeline.push({ date: e.joinDate, title: "تم التعيين", detail: (jobTitles.find((j) => j.id === e.jobTitleId) || {}).name || "", icon: "user-plus" });
    });
    compensation.filter((c) => c.status === "approved").forEach((c) => {
      const e = employees.find((x) => x.id === c.employeeId);
      e.timeline.push({ date: c.effective, title: { raise: "زيادة راتب", bonus: "مكافأة", commission: "عمولة", allowance: "بدل جديد", benefit: "تحديث المزايا", promotion: "ترقية" }[c.kind], detail: c.item, icon: "gift" });
    });
    leaves.forEach((l) => {
      const e = employees.find((x) => x.id === l.employeeId);
      e.timeline.push({ date: l.createdAt.slice(0, 10), title: "طلب إجازة", detail: `${l.days} أيام — ${{ approved: "معتمد", pending: "قيد الاعتماد", rejected: "مرفوض" }[l.status]}`, icon: "palm" });
    });
    reviews.filter((r) => r.stage === "approved").forEach((r) => {
      const e = employees.find((x) => x.id === r.employeeId);
      e.timeline.push({ date: r.updatedAt.slice(0, 10), title: "تقييم أداء", detail: `النتيجة ${r.finalScore} من 5`, icon: "target" });
    });
    transfers.filter((t) => t.status === "completed").forEach((t) => {
      const e = employees.find((x) => x.id === t.employeeId);
      e.timeline.push({ date: t.effective, title: t.kind === "promotion" ? "تمت ترقية الموظف" : "نقل الموظف", detail: t.reason, icon: "swap" });
    });

    /* ---------------- Audit log ---------------- */
    const audit = [];
    let auSeq = 0;
    const log = (daysAgo, time, userId, action, module, record, status = "success") => {
      const u = users.find((x) => x.id === userId);
      audit.push({ id: `AUD-${++auSeq}`, companyId: "C1", userId, userName: u.name, role: u.role, action, module, record, at: stamp(daysAgo, time), status });
    };
    log(12, "08:12", "U-ADMIN", "تسجيل دخول", "النظام", "—");
    log(11, "09:40", "U-HRO", "إنشاء", "الموظفون", `${idOf.E30} — ليان محمد الحمدان`);
    log(11, "10:05", "U-HRO", "إنشاء", "العقود", `عقد ${idOf.E30}`);
    log(10, "13:22", "U-HRM", "اعتماد", "الإجازات", "LV-101");
    log(9, "11:10", "U-FIN", "اعتماد", "الرواتب", `مسير ${monthOffset(-1)}`);
    log(8, "09:02", "U-MGR", "رفض", "الإجازات", "LV-119", "success");
    log(7, "15:40", "U-ADMIN", "تعديل صلاحيات", "الأدوار", "دور المدير المباشر");
    log(6, "10:30", "U-HRO", "تعديل", "الموظفون", `${idOf.E10} — تحديث البيانات`);
    log(5, "12:18", "U-REC", "تغيير مرحلة", "التوظيف", "CAN-115 → تعيين");
    log(4, "08:55", "U-HRM", "تصحيح حضور", "الحضور", "CR-3");
    log(3, "16:10", "U-FIN", "اعتماد", "السلف", "ADV-6");
    log(2, "09:15", "U-HRO", "رفع مستند", "المستندات", "DOC — إقامة");
    log(1, "08:03", "U-EMP", "تسجيل حضور", "الحضور", idOf.E07);
    log(1, "17:08", "U-EMP", "تسجيل انصراف", "الحضور", idOf.E07);
    log(0, "07:58", "U-ADMIN", "محاولة دخول فاشلة", "النظام", "—", "failed");

    /* ---------------- Notifications ---------------- */
    const notifications = [];
    let ntSeq = 0;
    const notify = (companyId, to, type, title, body, link, minutesAgo, read = false) =>
      notifications.push({ id: `NT-${++ntSeq}`, companyId, to, type, title, body, link, read, createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString() });
    const HR = { roles: ["HR_MANAGER", "HR_OFFICER", "SUPER_ADMIN"] };
    notify("C1", HR, "contract", "عقود ستنتهي قريبًا", "5 عقود ستنتهي خلال 30 يومًا.", "#/contracts", 25);
    notify("C1", HR, "document", "مستندات ستنتهي قريبًا", "3 مستندات ستنتهي خلال 30 يومًا ومستند منتهٍ.", "#/documents", 40);
    notify("C1", { employeeIds: [idOf.E06] }, "approval", "طلب إجازة بانتظار موافقتك", `${empBy("E07").nameAr} طلب إجازة سنوية لمدة 3 أيام.`, "#/leave", 55);
    notify("C1", { employeeIds: [idOf.E06] }, "approval", "لديك طلب سلفة بانتظار الموافقة", `${empBy("E09").nameAr} طلب سلفة بقيمة 4,000 ر.س.`, "#/advances", 80);
    notify("C1", { employeeIds: [idOf.E07] }, "leave", "تمت الموافقة على طلب العمل الإضافي", "وافق المدير المباشر على طلب العمل الإضافي وهو الآن لدى الموارد البشرية.", "#/attendance?tab=overtime", 120);
    notify("C1", { employeeIds: [idOf.E07] }, "payroll", "قسيمة الراتب متاحة", `قسيمة راتب ${U.fmtMonth(monthOffset(-1))} جاهزة للعرض.`, "#/payroll", 60 * 26, true);
    notify("C1", { roles: ["FINANCE", "SUPER_ADMIN"] }, "payroll", "مسير الرواتب جاهز للمراجعة", `مسير ${U.fmtMonth(thisMonth)} في حالة مسودة.`, "#/payroll", 150);
    notify("C1", { roles: ["FINANCE"] }, "approval", "سلفة بانتظار اعتماد المالية", `${empBy("E22").nameAr} — 2,000 ر.س`, "#/advances", 200);
    notify("C1", HR, "attendance", "موظفون متأخرون اليوم", "تم رصد حالات تأخير في الحضور اليوم.", "#/attendance", 90);
    notify("C1", HR, "attendance", "نسيان تسجيل انصراف", `${empBy("E08").nameAr} لم يسجل الانصراف قبل 4 أيام.`, "#/attendance?tab=history", 60 * 30, true);
    notify("C1", HR, "training", "شهادة تدريب ستنتهي", "شهادات الإسعافات الأولية تنتهي خلال 20 يومًا.", "#/training", 60 * 48, true);
    notify("C1", HR, "request", "طلب جديد", `${empBy("E22").nameAr} قدّم طلب استئذان.`, "#/requests", 15);
    notify("C1", { roles: ["HR_MANAGER", "SUPER_ADMIN"] }, "approval", "طلب وظيفة جديدة بانتظار الاعتماد", "أخصائي تدريب — إدارة الموارد البشرية.", "#/recruitment", 300);
    notify("C2", HR, "contract", "تذكير", "لا توجد عقود تنتهي خلال 30 يومًا.", "#/contracts", 500, true);

    return {
      meta: { version: 1, seededAt: new Date().toISOString(), anchor: T },
      companies, branches, departments, sections, grades, jobTitles, workplaces, shifts,
      employees, contracts, documents, assets, attendance, leaveTypes, leaveBalances, leaves,
      advances, compensation, overtime, corrections, perfCycles, reviews, courses, enrollments,
      disciplinary, requests, travel, transfers, jobs, candidates, onboarding, offboarding,
      payrollRuns, users, settings, audit, notifications,
    };
  };
})((window.EHR = window.EHR || {}));
