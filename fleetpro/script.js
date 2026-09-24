/* =========================================================
   FleetPro — نظام إدارة الأسطول
   Frontend demo: all data lives in memory (no backend).
   ========================================================= */
(() => {
  "use strict";

  /* =========================================================
     Helpers
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const DAY = 86400000;
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);
  const addDays = (n) => new Date(TODAY.getTime() + n * DAY);
  const daysFrom = (date) => Math.round((date - TODAY) / DAY);

  const LOCALE = "ar-SA-u-ca-gregory-nu-latn";
  const dateFormatter = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
  const longDateFormatter = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthFormatter = new Intl.DateTimeFormat(LOCALE, { month: "short" });

  const fmtDate = (d) => dateFormatter.format(d);
  const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
  const fmtMoney = (n) => `${fmtNum(n)} ر.س`;
  const fmtK = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n)));
  const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (name) => `<svg class="i"><use href="#i-${name}"/></svg>`;

  const dayPhrase = (n) => (n === 1 ? "يوم" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يومًا`);
  const relDays = (n) => (n === 0 ? "اليوم" : n > 0 ? `بعد ${dayPhrase(n)}` : `منذ ${dayPhrase(-n)}`);

  // Arabic-aware normalisation for search
  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[ً-ٟـ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();

  const niceMax = (v) => {
    if (v <= 0) return 1;
    const mag = 10 ** Math.floor(Math.log10(v));
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= v);
  };

  /* =========================================================
     Demo data
     ========================================================= */
  const PROJECTS = ["مشروع نيوم", "مترو الرياض", "البحر الأحمر", "القدية", "المقر الرئيسي"];
  const INSURERS = { "التعاونية": "TAW", "ملاذ": "MAL", "تكافل الراجحي": "ATK", "ولاء": "WLA", "ميدغلف": "MDG" };
  const MAINT_TYPES = ["تغيير زيت وفلاتر", "فحص دوري شامل", "تغيير إطارات", "صيانة الفرامل", "صيانة التكييف", "فحص ناقل الحركة"];
  const WORKSHOPS = ["مركز عبداللطيف جميل", "ورشة الجفالي", "بترومين إكسبرس", "مركز الماجدوعي", "الورشة الداخلية"];
  const ACCIDENT_TYPES = ["تصادم خفيف", "تصادم متوسط", "كسر زجاج", "خدوش جانبية", "اصطدام بحاجز", "انقلاب"];
  const VEHICLE_TYPES = ["بيك أب", "سيدان", "دفع رباعي", "حافلة صغيرة", "حافلة", "شاحنة خفيفة", "شاحنة ثقيلة", "معدات ثقيلة"];

  const CATEGORY_COST = {
    "شاحنة ثقيلة": 2400, "معدات ثقيلة": 3200, "شاحنة خفيفة": 1400, "حافلة": 1100,
    "حافلة صغيرة": 800, "بيك أب": 650, "دفع رباعي": 750, "سيدان": 450,
  };
  const MONTHLY_LITERS = {
    "شاحنة ثقيلة": 1180, "معدات ثقيلة": 960, "حافلة": 620, "شاحنة خفيفة": 540,
    "حافلة صغيرة": 410, "بيك أب": 330, "دفع رباعي": 300, "سيدان": 170,
  };
  const FUEL_PRICE = { "ديزل": 1.66, "بنزين 91": 2.18, "بنزين 95": 2.33 };
  const fuelFor = (type) =>
    ["شاحنة ثقيلة", "شاحنة خفيفة", "معدات ثقيلة", "حافلة"].includes(type)
      ? "ديزل"
      : ["دفع رباعي", "سيدان"].includes(type) ? "بنزين 95" : "بنزين 91";

  const VEHICLE_STATUS = {
    active: { label: "نشطة", c: "c-success" },
    maintenance: { label: "في الصيانة", c: "c-warning" },
    inactive: { label: "متوقفة", c: "" },
  };
  const INS_STATUS = {
    valid: { label: "ساري", c: "c-success" },
    soon: { label: "ينتهي قريبًا", c: "c-warning" },
    expired: { label: "منتهي", c: "c-danger" },
  };
  const ACC_STATUS = {
    "قيد التحقيق": "c-warning",
    "بانتظار التقدير": "c-info",
    "قيد الإصلاح": "c-primary",
    "مغلق": "c-success",
  };
  const VIO_STATUS = {
    unpaid: { label: "غير مسددة", c: "c-danger" },
    objected: { label: "معترض عليها", c: "c-warning" },
    paid: { label: "مسددة", c: "c-success" },
  };
  const DRIVER_STATUS = { "في رحلة": "c-info", "متاح": "c-success", "إجازة": "" };

  // [name, phone, licence expiry (days from today), trips this month, rating, status]
  const DRIVERS = [
    ["محمد العتيبي", "0551234871", 420, 64, 4.8, "في رحلة"],
    ["خالد القحطاني", "0507719342", 200, 58, 4.6, "متاح"],
    ["فهد الشمري", "0543328810", 25, 41, 4.2, "في رحلة"],
    ["عبدالله الدوسري", "0569981245", 610, 22, 4.9, "متاح"],
    ["سعد الغامدي", "0530047718", 150, 49, 4.4, "في رحلة"],
    ["ناصر الحربي", "0558823407", -6, 30, 4.1, "إجازة"],
    ["ماجد الزهراني", "0501197736", 380, 55, 4.7, "في رحلة"],
    ["تركي المطيري", "0547762290", 90, 37, 4.5, "متاح"],
    ["يوسف السبيعي", "0566610384", 18, 44, 4.3, "في رحلة"],
    ["بندر العنزي", "0592231870", 270, 60, 4.6, "في رحلة"],
    ["راشد الشهري", "0533348109", 510, 28, 4.8, "متاح"],
    ["عمر البقمي", "0557730021", 130, 39, 4.0, "في رحلة"],
    ["سلطان العمري", "0504416639", 700, 18, 4.9, "متاح"],
    ["فيصل المالكي", "0548850712", 45, 52, 4.5, "إجازة"],
    ["مشعل الرشيدي", "0556672014", 330, 0, 4.3, "متاح"],
    ["حمد السهلي", "0509938476", 260, 0, 4.6, "متاح"],
  ].map(([name, phone, licence, trips, rating, status], i) => ({
    id: `D-${101 + i}`, name, phone, licenceExpiry: addDays(licence), trips, rating, status,
  }));

  // [plate, model, type, project, status, last service, next service, insurer, cover, insurance expiry, km, year, driver]
  const VEHICLES = [
    ["ر س ع 4821", "تويوتا هايلكس", "بيك أب", 0, "active", -38, 22, "التعاونية", "شامل", 210, 48230, 2023, 0],
    ["ب ح د 7315", "هيونداي H1", "حافلة صغيرة", 1, "active", -12, 78, "ملاذ", "شامل", 18, 63410, 2022, 1],
    ["ك ل م 2290", "إيسوزو NPR", "شاحنة خفيفة", 2, "maintenance", -95, -5, "تكافل الراجحي", "ضد الغير", 95, 121880, 2021, 2],
    ["ن هـ و 6604", "نيسان باترول", "دفع رباعي", 4, "active", -20, 70, "التعاونية", "شامل", -12, 35120, 2024, 3],
    ["أ ط ص 1187", "مرسيدس أكتروس", "شاحنة ثقيلة", 0, "active", -60, 3, "ولاء", "شامل", 160, 210450, 2020, 4],
    ["د ر س 9043", "تويوتا كامري", "سيدان", 4, "active", -30, 60, "ميدغلف", "شامل", 290, 27800, 2024, 5],
    ["ع ق ك 3378", "فورد F-150", "بيك أب", 3, "active", -110, -14, "ملاذ", "شامل", 7, 88400, 2022, 6],
    ["ل م ن 5512", "تويوتا كوستر", "حافلة", 1, "inactive", -140, -40, "التعاونية", "ضد الغير", -45, 154300, 2019, null],
    ["هـ و ى 7720", "هيونداي أكسنت", "سيدان", 2, "active", -8, 82, "تكافل الراجحي", "شامل", 240, 19650, 2025, 7],
    ["ب د ر 8841", "إيسوزو D-Max", "بيك أب", 3, "active", -45, 12, "ولاء", "شامل", 25, 57200, 2023, 8],
    ["س ص ط 2067", "فولفو FH", "شاحنة ثقيلة", 0, "maintenance", -70, -2, "ميدغلف", "شامل", 130, 188900, 2021, 9],
    ["ح ع ق 4439", "تويوتا لاندكروزر", "دفع رباعي", 2, "active", -25, 65, "التعاونية", "شامل", 330, 41800, 2024, 10],
    ["ك ن هـ 6158", "هينو 300", "شاحنة خفيفة", 1, "active", -50, 8, "ملاذ", "ضد الغير", -3, 99750, 2022, 11],
    ["م و أ 3925", "شيفروليه تاهو", "دفع رباعي", 4, "active", -15, 75, "تكافل الراجحي", "شامل", 185, 30100, 2024, 12],
    ["ر ط ل 7086", "تويوتا هايلكس", "بيك أب", 0, "active", -33, 27, "ولاء", "شامل", 55, 51900, 2023, 13],
    ["ص ى ب 1634", "مرسيدس سبرينتر", "حافلة صغيرة", 3, "maintenance", -88, -9, "ميدغلف", "شامل", 110, 97300, 2021, null],
    ["ع د ح 5270", "هيونداي سوناتا", "سيدان", 4, "active", -5, 85, "التعاونية", "شامل", 265, 14200, 2025, null],
    ["ق س ك 8813", "كاتربيلر 320", "معدات ثقيلة", 0, "active", -40, 20, "ملاذ", "شامل", 28, 6420, 2022, null],
    ["ن ل ر 2947", "نيسان نافارا", "بيك أب", 2, "inactive", -160, -60, "تكافل الراجحي", "ضد الغير", -80, 132600, 2019, null],
    ["و هـ ط 6391", "تويوتا هايس", "حافلة صغيرة", 1, "active", -22, 68, "ولاء", "شامل", 150, 45700, 2023, null],
  ].map((r, i, rows) => ({
    id: `FP-${1001 + i}`,
    plate: r[0],
    model: r[1],
    type: r[2],
    project: PROJECTS[r[3]],
    status: r[4],
    lastService: addDays(r[5]),
    nextService: addDays(r[6]),
    nextType: MAINT_TYPES[i % MAINT_TYPES.length],
    insurer: r[7],
    cover: r[8],
    policyNo: `${INSURERS[r[7]]}-${4810000 + ((i * 73129) % 900000)}`,
    insExpiry: addDays(r[9]),
    mileage: r[10],
    year: r[11],
    driverId: r[12] === null ? null : DRIVERS[r[12]].id,
    fuel: fuelFor(r[2]),
    addedAt: addDays(-(rows.length - i) * 11),
  }));

  const maintenanceLog = [];
  VEHICLES.forEach((v, i) => {
    const base = CATEGORY_COST[v.type];
    maintenanceLog.push({
      vehicleId: v.id,
      date: v.lastService,
      type: MAINT_TYPES[(i + 2) % MAINT_TYPES.length],
      workshop: WORKSHOPS[i % WORKSHOPS.length],
      cost: Math.round((base * (1 + (i % 3) * 0.35)) / 10) * 10,
    });
    maintenanceLog.push({
      vehicleId: v.id,
      date: new Date(v.lastService.getTime() - 95 * DAY),
      type: MAINT_TYPES[i % MAINT_TYPES.length],
      workshop: WORKSHOPS[(i + 2) % WORKSHOPS.length],
      cost: Math.round((base * 0.8) / 10) * 10,
    });
  });
  const sortLog = () => maintenanceLog.sort((a, b) => b.date - a.date);
  sortLog();

  const accidents = [
    ["AC-0107", -2, "FP-1007", "تصادم خفيف", "طريق الملك فهد، الرياض", "قيد التحقيق", 4500, "اصطدام خفيف من الخلف أثناء التوقف عند الإشارة. لا توجد إصابات، وتم رفع بلاغ نجم."],
    ["AC-0106", -9, "FP-1013", "كسر زجاج", "الدائري الشرقي، الرياض", "بانتظار التقدير", 1800, "كسر في الزجاج الأمامي نتيجة ارتطام حصى من شاحنة أمامية."],
    ["AC-0105", -21, "FP-1003", "اصطدام بحاجز", "طريق ينبع - أملج", "قيد الإصلاح", 12500, "انحراف المركبة واصطدامها بالحاجز الخرساني بسبب الرياح. أضرار في الواجهة الأمامية."],
    ["AC-0104", -37, "FP-1015", "خدوش جانبية", "موقع مشروع نيوم - البوابة 3", "مغلق", 950, "خدوش في الباب الجانبي أثناء المناورة داخل الموقع."],
    ["AC-0103", -58, "FP-1011", "تصادم متوسط", "طريق تبوك - ضباء", "مغلق", 21400, "تصادم مع مركبة أخرى عند التقاطع. تم تحديد نسبة الخطأ على الطرف الآخر."],
    ["AC-0102", -84, "FP-1002", "تصادم خفيف", "طريق الملك عبدالله، الرياض", "مغلق", 3200, "احتكاك جانبي أثناء تغيير المسار في وقت الذروة."],
    ["AC-0101", -130, "FP-1019", "انقلاب", "طريق القدية الرئيسي", "مغلق", 38000, "انقلاب المركبة على جانب الطريق مع إصابات طفيفة للسائق. المركبة متوقفة عن العمل."],
  ].map(([id, date, vehicleId, type, location, status, cost, description]) => ({
    id, date: addDays(date), vehicleId, type, location, status, cost, description,
  }));

  const violations = [
    ["48213051", "FP-1005", -1, "تجاوز السرعة المحددة", 900, "unpaid"],
    ["48209877", "FP-1010", -4, "قطع الإشارة الضوئية", 3000, "objected"],
    ["48198642", "FP-1002", -6, "الوقوف في مكان ممنوع", 150, "unpaid"],
    ["48187730", "FP-1007", -11, "استخدام الجوال أثناء القيادة", 500, "unpaid"],
    ["48176615", "FP-1013", -15, "تجاوز السرعة المحددة", 300, "paid"],
    ["48160092", "FP-1001", -22, "عدم ربط حزام الأمان", 150, "paid"],
    ["48151248", "FP-1020", -29, "تجاوز السرعة المحددة", 600, "paid"],
    ["48139964", "FP-1011", -40, "حمولة زائدة", 2000, "unpaid"],
    ["48122571", "FP-1006", -53, "الوقوف في مكان ممنوع", 100, "paid"],
    ["48108306", "FP-1015", -71, "تجاوز السرعة المحددة", 450, "paid"],
    ["48097719", "FP-1009", -88, "عدم تجديد الفحص الدوري", 300, "paid"],
  ].map(([id, vehicleId, date, type, amount, status]) => ({ id, vehicleId, date: addDays(date), type, amount, status }));

  const fuelLog = [
    [0, "FP-1005", 310, "أرامكو - تبوك"],
    [0, "FP-1002", 62, "ساسكو - الدائري الشمالي"],
    [-1, "FP-1011", 295, "أرامكو - ضباء"],
    [-1, "FP-1014", 85, "نفط - حي الملقا"],
    [-2, "FP-1010", 70, "المحروقات - القدية"],
    [-2, "FP-1003", 120, "بترومين - أملج"],
    [-3, "FP-1018", 240, "أرامكو - تبوك"],
    [-3, "FP-1020", 68, "الدريس - طريق الخرج"],
    [-4, "FP-1012", 92, "بترومين - أملج"],
    [-5, "FP-1001", 75, "أرامكو - تبوك"],
    [-6, "FP-1006", 48, "نفط - حي الملقا"],
  ].map(([date, vehicleId, liters, station]) => ({ date: addDays(date), vehicleId, liters, station }));

  // Last six months (oldest first)
  const MONTHS = Array.from({ length: 6 }, (_, i) =>
    monthFormatter.format(new Date(TODAY.getFullYear(), TODAY.getMonth() - 5 + i, 1))
  );
  const EXPENSES = {
    fuel: [38400, 41200, 39800, 44600, 43100, 46300],
    maintenance: [12800, 9600, 18400, 11200, 15900, 13400],
    insurance: [6200, 6200, 8900, 6200, 6200, 7400],
    other: [3100, 2400, 4600, 1900, 3800, 2700],
  };
  const FUEL_LITERS = [19800, 21100, 20300, 22900, 22100, 23700];
  const FLEET_SIZE = [16, 17, 17, 18, 19];
  const EXPENSE_SERIES = [
    { key: "fuel", label: "الوقود", color: "var(--primary)" },
    { key: "maintenance", label: "الصيانة", color: "var(--accent)" },
    { key: "insurance", label: "التأمين", color: "var(--warning)" },
    { key: "other", label: "مخالفات وأخرى", color: "var(--text-dim)" },
  ];

  /* =========================================================
     State
     ========================================================= */
  const DEFAULT_SETTINGS = {
    company: "شركة الإنشاءات المتقدمة",
    email: "fleet@company.sa",
    city: "الرياض",
    interval: 90,
    notifyMaint: true,
    notifyIns: true,
    weekly: false,
  };

  const loadSettings = () => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("fleetpro-settings") || "{}") };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  };

  const state = {
    view: "dashboard",
    filter: { q: "", status: "all", project: "all", type: "all" },
    sort: { key: "id", dir: 1 },
    insTab: "all",
    vioTab: "all",
    driverQ: "",
    settings: loadSettings(),
    notifications: [],
  };

  /* =========================================================
     Selectors & derived data
     ========================================================= */
  const findVehicle = (id) => VEHICLES.find((v) => v.id === id);
  const findDriver = (id) => DRIVERS.find((d) => d.id === id);
  const driverOf = (v) => (v && v.driverId ? findDriver(v.driverId) : null);
  const vehicleOfDriver = (d) => VEHICLES.find((v) => v.driverId === d.id);

  const insState = (v) => {
    const d = daysFrom(v.insExpiry);
    return d < 0 ? "expired" : d <= 30 ? "soon" : "valid";
  };
  const inService = (v) => v.status !== "inactive";
  const overdueVehicles = () =>
    VEHICLES.filter((v) => inService(v) && daysFrom(v.nextService) < 0).sort((a, b) => a.nextService - b.nextService);
  const upcomingVehicles = (days = 30) =>
    VEHICLES.filter((v) => inService(v) && daysFrom(v.nextService) >= 0 && daysFrom(v.nextService) <= days).sort(
      (a, b) => a.nextService - b.nextService
    );
  const needsMaintenance = () => VEHICLES.filter((v) => inService(v) && daysFrom(v.nextService) <= 14);

  const searchText = (v) => {
    const d = driverOf(v);
    return normalize([v.id, v.plate, v.plate.replace(/\s/g, ""), v.model, v.type, v.project, d ? d.name : ""].join(" "));
  };
  const matchVehicle = (v, q) => {
    const words = normalize(q).split(" ").filter(Boolean);
    const hay = searchText(v);
    return words.every((w) => hay.includes(w));
  };

  const monthIndexOf = (date) => {
    const diff = (TODAY.getFullYear() - date.getFullYear()) * 12 + (TODAY.getMonth() - date.getMonth());
    return 5 - diff; // 0..5 inside the six-month window
  };
  const accidentsByMonth = () => {
    const counts = [0, 0, 0, 0, 0, 0];
    accidents.forEach((a) => {
      const idx = monthIndexOf(a.date);
      if (idx >= 0 && idx <= 5) counts[idx] += 1;
    });
    return counts;
  };
  const recentAccidents = () => accidents.filter((a) => daysFrom(a.date) >= -183);
  const monthlyTotals = () => MONTHS.map((_, i) => sum(EXPENSE_SERIES.map((s) => EXPENSES[s.key][i])));

  const vehicleMonthlyLiters = (v, i) => Math.round(MONTHLY_LITERS[v.type] * (0.85 + ((i * 37) % 30) / 100));

  /* =========================================================
     Small templates
     ========================================================= */
  const badge = (label, c = "") => `<span class="badge ${c}">${label}</span>`;
  const statusBadge = (status) => badge(VEHICLE_STATUS[status].label, VEHICLE_STATUS[status].c);

  const splitPlate = (plate) => {
    const m = plate.match(/^(.*?)\s*(\d+)$/);
    return m ? [m[1], m[2]] : [plate, ""];
  };
  const plateHTML = (plate) => {
    const [letters, digits] = splitPlate(plate);
    return `<span class="plate" title="${esc(plate)}"><span>${esc(letters)}</span><span>${esc(digits)}</span></span>`;
  };
  const vehicleCell = (v) =>
    v
      ? `<div class="cell-vehicle"><span class="vid">${v.id}</span><small>${esc(v.model)}</small></div>`
      : `<span class="dim">—</span>`;

  const trend = (pct) =>
    `<span class="trend ${pct >= 0 ? "trend--up" : "trend--down"}">${icon(pct >= 0 ? "up" : "down")}${Math.abs(pct)}%</span>`;

  const statCard = ({ label, value, unit = "", iconName, c, foot = "", attrs = "" }) => {
    const tag = attrs ? "button" : "div";
    return `<${tag} class="stat ${c}" ${attrs ? `type="button" ${attrs}` : ""}>
      <div class="stat__top"><span class="stat__label">${label}</span><span class="stat__icon">${icon(iconName)}</span></div>
      <div class="stat__value">${value}${unit ? `<small>${unit}</small>` : ""}</div>
      ${foot ? `<div class="stat__foot">${foot}</div>` : ""}
    </${tag}>`;
  };

  const listItem = ({ iconName, c, title, sub, side = "", attrs = "" }) => `
    <li class="list__item" ${attrs}>
      <span class="list__icon ${c}">${icon(iconName)}</span>
      <div class="list__body"><b>${title}</b><small>${sub}</small></div>
      <div class="list__side">${side}</div>
    </li>`;

  const emptyList = (text) => `<li class="list__empty">${icon("check")}${text}</li>`;

  const tabsHTML = (group, current, items) =>
    items
      .map(
        ([value, label, count]) =>
          `<button class="tab ${value === current ? "active" : ""}" type="button" role="tab" aria-selected="${value === current}" data-tab="${group}" data-value="${value}">${label}<span class="tab__count">${count}</span></button>`
      )
      .join("");

  const tableHTML = (headers, rows, emptyText = "لا توجد بيانات") =>
    `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
     <tbody>${rows.length ? rows.join("") : `<tr class="table-empty"><td colspan="${headers.length}">${emptyText}</td></tr>`}</tbody>`;

  /* =========================================================
     Charts (pure HTML / CSS / SVG)
     ========================================================= */
  const renderBarChart = (el, legendEl, labels, series, data) => {
    const totals = labels.map((_, i) => sum(series.map((s) => data[s.key][i])));
    const max = niceMax(Math.max(...totals));
    const grid = [4, 3, 2, 1, 0].map((k) => `<span data-v="${fmtK((max * k) / 4)}"></span>`).join("");
    const cols = labels
      .map((label, i) => {
        const edge = i === 0 ? "edge-r" : i === labels.length - 1 ? "edge-l" : "";
        return `<div class="bar-chart__col ${edge}" tabindex="0" aria-label="${label}: ${fmtMoney(totals[i])}">
          <div class="tip"><b>${label}</b>${series
            .map((s) => `<span><em>${s.label}</em><strong>${fmtNum(data[s.key][i])}</strong></span>`)
            .join("")}<span><em>الإجمالي</em><strong>${fmtNum(totals[i])}</strong></span></div>
          ${series
            .map(
              (s) =>
                `<div class="bar-chart__seg" style="--c:${s.color};height:${((data[s.key][i] / max) * 100).toFixed(2)}%;animation-delay:${i * 60}ms"></div>`
            )
            .join("")}
        </div>`;
      })
      .join("");
    el.innerHTML = `<div class="bar-chart__plot"><div class="bar-chart__grid">${grid}</div>${cols}</div>
      <div class="bar-chart__labels">${labels.map((l) => `<span>${l}</span>`).join("")}</div>`;
    if (legendEl) {
      legendEl.innerHTML = series.map((s) => `<span><i style="--c:${s.color}"></i>${s.label}</span>`).join("");
    }
  };

  const renderDonut = (el, segments, centerLabel) => {
    const total = sum(segments.map((s) => s.value)) || 1;
    let acc = 0;
    const stops = segments
      .map((s) => {
        const from = (acc / total) * 360;
        acc += s.value;
        return `${s.color} ${from}deg ${(acc / total) * 360}deg`;
      })
      .join(", ");
    el.innerHTML = `
      <div class="donut" style="background:conic-gradient(${stops})">
        <div class="donut__center"><b>${total}</b><small>${centerLabel}</small></div>
      </div>
      <ul class="donut-legend">${segments
        .map(
          (s) =>
            `<li><i style="--c:${s.color}"></i>${s.label}<b>${s.value}</b><small>${Math.round((s.value / total) * 100)}%</small></li>`
        )
        .join("")}</ul>`;
  };

  const renderHBars = (el, items) => {
    el.innerHTML = items
      .map(
        (it, i) => `<div class="hbar">
          <div class="hbar__top"><span>${it.label}</span><b>${it.valueLabel}</b></div>
          <div class="hbar__track"><div class="hbar__fill" style="width:${it.pct}%;animation-delay:${i * 80}ms"></div></div>
        </div>`
      )
      .join("");
  };

  const smoothPath = (pts) =>
    pts.reduce((d, [x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
    }, "");

  const renderLineChart = (el, labels, values) => {
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!W || !H) return;
    const pad = { t: 28, r: 20, b: 32, l: 46 };
    const max = niceMax(Math.max(...values) * 1.1);
    const n = values.length;
    const step = (W - pad.l - pad.r) / (n - 1);
    const x = (i) => W - pad.r - i * step; // oldest month on the right (RTL)
    const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    const pts = values.map((v, i) => [+x(i).toFixed(1), +y(v).toFixed(1)]);
    const line = smoothPath(pts);
    const base = H - pad.b;
    const gridLines = [0, 1, 2, 3, 4]
      .map((k) => {
        const gy = y((max * k) / 4);
        return `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}"/>
                <text class="axis-label" x="4" y="${gy + 4}">${fmtK((max * k) / 4)}</text>`;
      })
      .join("");
    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="استهلاك الوقود الشهري">
        <defs>
          <linearGradient id="lineGrad" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#6d5dfc"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
          <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.28"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
        </defs>
        ${gridLines}
        <path class="area" d="${line} L${pts[n - 1][0]},${base} L${pts[0][0]},${base} Z"/>
        <path class="line" d="${line}"/>
        ${pts
          .map(
            ([px, py], i) => `
          <circle class="dot" cx="${px}" cy="${py}" r="5"><title>${labels[i]}: ${fmtNum(values[i])} لتر</title></circle>
          <text class="dot-label" x="${px}" y="${py - 12}" text-anchor="middle">${fmtK(values[i])}</text>
          <text class="axis-label" x="${px}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>`
          )
          .join("")}
      </svg>`;
  };

  const sparkline = (values) => {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const n = values.length;
    const pts = values.map((v, i) => [100 - i * (100 / (n - 1)), 36 - ((v - min) / (max - min || 1)) * 30]);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-area" d="${line} L0,40 L100,40 Z"/>
      <path d="${line}" vector-effect="non-scaling-stroke"/>
    </svg>`;
  };

  /* =========================================================
     Views
     ========================================================= */
  const VEHICLE_COLS = [
    { key: "id", label: "رقم المركبة" },
    { key: "plate", label: "اللوحة" },
    { key: "model", label: "النوع" },
    { key: "project", label: "المشروع" },
    { key: "status", label: "الحالة" },
    { key: "lastService", label: "آخر صيانة" },
    { key: null, label: "الإجراء" },
  ];

  const vehicleRow = (v) => `
    <tr class="row-in" data-open-vehicle="${v.id}" tabindex="0">
      <td data-label="رقم المركبة"><span class="vid">${v.id}</span></td>
      <td data-label="اللوحة">${plateHTML(v.plate)}</td>
      <td data-label="النوع"><div class="cell-vehicle">${esc(v.model)}<small>${v.type} · ${v.year}</small></div></td>
      <td data-label="المشروع">${v.project}</td>
      <td data-label="الحالة">${statusBadge(v.status)}</td>
      <td data-label="آخر صيانة"><div class="cell-vehicle">${fmtDate(v.lastService)}<small>${relDays(daysFrom(v.lastService))}</small></div></td>
      <td data-label="الإجراء"><div class="row-actions">
        <button class="icon-btn icon-btn--sm" type="button" data-action="view-vehicle" data-id="${v.id}" title="عرض التفاصيل" aria-label="عرض تفاصيل ${v.id}">${icon("eye")}</button>
        <button class="icon-btn icon-btn--sm" type="button" data-action="schedule" data-id="${v.id}" title="جدولة صيانة" aria-label="جدولة صيانة ${v.id}">${icon("calendar")}</button>
      </div></td>
    </tr>`;

  const vehicleTableHTML = (list, sortable) => {
    const head = VEHICLE_COLS.map((c) => {
      if (!sortable || !c.key) return `<th>${c.label}</th>`;
      const sorted = state.sort.key === c.key;
      return `<th data-sort="${c.key}" class="${sorted ? "sorted" : ""}" aria-sort="${sorted ? (state.sort.dir > 0 ? "ascending" : "descending") : "none"}">${c.label}${icon("sort")}</th>`;
    }).join("");
    const body = list.length
      ? list.map(vehicleRow).join("")
      : `<tr class="table-empty"><td colspan="${VEHICLE_COLS.length}">لا توجد مركبات مطابقة للبحث أو الفلاتر المحددة</td></tr>`;
    return `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  };

  /* ---------- Dashboard ---------- */
  const renderDashboard = () => {
    const total = VEHICLES.length;
    const active = VEHICLES.filter((v) => v.status === "active").length;
    const maint = needsMaintenance().length;
    const overdue = overdueVehicles().length;
    const expired = VEHICLES.filter((v) => insState(v) === "expired").length;
    const soon = VEHICLES.filter((v) => insState(v) === "soon").length;
    const added = VEHICLES.filter((v) => daysFrom(v.addedAt) >= -30).length;

    $("#welcomeText").textContent = `مرحبًا أحمد، هذه نظرة عامة على أسطول ${state.settings.company} — ${longDateFormatter.format(TODAY)}`;

    $("#dashStats").innerHTML = [
      statCard({
        label: "إجمالي المركبات", value: total, iconName: "truck", c: "c-primary",
        foot: added ? `<span class="trend trend--up">${icon("up")}+${added}</span> خلال آخر 30 يومًا` : "لا إضافات خلال آخر 30 يومًا",
        attrs: `data-view="vehicles" data-status="all"`,
      }),
      statCard({
        label: "المركبات النشطة", value: active, iconName: "gauge", c: "c-success",
        foot: `${Math.round((active / total) * 100)}% من إجمالي الأسطول`,
        attrs: `data-view="vehicles" data-status="active"`,
      }),
      statCard({
        label: "تحتاج صيانة", value: maint, iconName: "wrench", c: "c-warning",
        foot: overdue ? `منها <b class="text-danger">${overdue}</b> متأخرة عن موعدها` : "لا توجد صيانات متأخرة",
        attrs: `data-view="maintenance"`,
      }),
      statCard({
        label: "التأمينات المنتهية", value: expired, iconName: "shield", c: "c-danger",
        foot: `و <b class="text-warning">${soon}</b> تنتهي خلال 30 يومًا`,
        attrs: `data-view="insurance" data-tab="ins" data-value="expired"`,
      }),
    ].join("");

    renderBarChart($("#expenseChart"), $("#expenseLegend"), MONTHS, EXPENSE_SERIES, EXPENSES);

    renderDonut(
      $("#statusDonut"),
      [
        { label: "نشطة", value: active, color: "var(--success)" },
        { label: "في الصيانة", value: VEHICLES.filter((v) => v.status === "maintenance").length, color: "var(--warning)" },
        { label: "متوقفة", value: VEHICLES.filter((v) => v.status === "inactive").length, color: "var(--text-dim)" },
      ],
      "مركبة"
    );

    const maintItems = [...overdueVehicles(), ...upcomingVehicles(30)].slice(0, 5);
    $("#dashUpcoming").innerHTML = maintItems.length
      ? maintItems.map(maintListItem).join("")
      : emptyList("لا توجد صيانات قادمة");

    const insItems = VEHICLES.filter((v) => insState(v) !== "valid").sort((a, b) => a.insExpiry - b.insExpiry).slice(0, 5);
    $("#dashInsurance").innerHTML = insItems.length
      ? insItems
          .map((v) => {
            const st = insState(v);
            const d = daysFrom(v.insExpiry);
            return listItem({
              iconName: "shield", c: INS_STATUS[st].c,
              title: `<span class="vid">${v.id}</span> · ${esc(v.model)}`,
              sub: `${v.insurer} · ${st === "expired" ? "انتهت" : "تنتهي"} ${relDays(d)}`,
              side: badge(INS_STATUS[st].label, INS_STATUS[st].c),
              attrs: `data-open-vehicle="${v.id}" tabindex="0"`,
            });
          })
          .join("")
      : emptyList("جميع الوثائق سارية");

    const maxProject = Math.max(...PROJECTS.map((p) => VEHICLES.filter((v) => v.project === p).length));
    renderHBars(
      $("#projectBars"),
      PROJECTS.map((p) => {
        const count = VEHICLES.filter((v) => v.project === p).length;
        return { label: p, valueLabel: `${count} مركبات`, pct: (count / maxProject) * 100 };
      }).sort((a, b) => b.pct - a.pct)
    );

    const latest = [...VEHICLES].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5);
    $("#dashVehicles").innerHTML = vehicleTableHTML(latest, false);
  };

  const maintListItem = (v) => {
    const d = daysFrom(v.nextService);
    const c = d < 0 ? "c-danger" : d <= 7 ? "c-warning" : "c-primary";
    return listItem({
      iconName: "wrench", c,
      title: `<span class="vid">${v.id}</span> · ${esc(v.model)}`,
      sub: `${v.nextType} · ${fmtDate(v.nextService)}`,
      side: badge(d < 0 ? `متأخرة ${dayPhrase(-d)}` : relDays(d), c),
      attrs: `data-open-vehicle="${v.id}" tabindex="0"`,
    });
  };

  /* ---------- Vehicles ---------- */
  const filteredVehicles = () => {
    const { q, status, project, type } = state.filter;
    const list = VEHICLES.filter(
      (v) =>
        (status === "all" || v.status === status) &&
        (project === "all" || v.project === project) &&
        (type === "all" || v.type === type) &&
        (!q.trim() || matchVehicle(v, q))
    );
    const { key, dir } = state.sort;
    const order = { active: 0, maintenance: 1, inactive: 2 };
    const val = (v) => (key === "lastService" ? v.lastService.getTime() : key === "status" ? order[v.status] : v[key]);
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ar")) * dir;
    });
  };

  const fillSelect = (el, allLabel, values, current) => {
    el.innerHTML = [`<option value="all">${allLabel}</option>`, ...values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)].join("");
    el.value = values.includes(current) ? current : "all";
  };

  const renderVehicles = () => {
    const count = (s) => VEHICLES.filter((v) => s === "all" || v.status === s).length;
    $("#vehicleTabs").innerHTML = tabsHTML("status", state.filter.status, [
      ["all", "الكل", count("all")],
      ["active", "نشطة", count("active")],
      ["maintenance", "في الصيانة", count("maintenance")],
      ["inactive", "متوقفة", count("inactive")],
    ]);

    fillSelect($("#filterProject"), "كل المشاريع", PROJECTS, state.filter.project);
    const types = VEHICLE_TYPES.filter((t) => VEHICLES.some((v) => v.type === t));
    fillSelect($("#filterType"), "كل الأنواع", types, state.filter.type);
    if ($("#vehicleSearch").value !== state.filter.q) $("#vehicleSearch").value = state.filter.q;

    const list = filteredVehicles();
    $("#vehiclesTable").innerHTML = vehicleTableHTML(list, true);
    $("#vehiclesFoot").textContent = `عرض ${list.length} من أصل ${VEHICLES.length} مركبة`;
  };

  /* ---------- Maintenance ---------- */
  const renderMaintenance = () => {
    const upcoming = upcomingVehicles(30);
    const overdue = overdueVehicles();
    const monthCost = sum(maintenanceLog.filter((m) => daysFrom(m.date) >= -30).map((m) => m.cost));

    $("#maintStats").innerHTML = [
      statCard({ label: "صيانات قادمة", value: upcoming.length, unit: "خلال 30 يومًا", iconName: "calendar", c: "c-primary" }),
      statCard({ label: "صيانات متأخرة", value: overdue.length, unit: "مركبة", iconName: "alert", c: "c-danger" }),
      statCard({ label: "تكاليف آخر 30 يومًا", value: fmtNum(monthCost), unit: "ر.س", iconName: "coin", c: "c-accent" }),
    ].join("");

    const actions = (v) => `
      <div class="row-actions">
        <button class="icon-btn icon-btn--sm" type="button" data-action="complete" data-id="${v.id}" title="تسجيل الإنجاز" aria-label="تسجيل إنجاز صيانة ${v.id}">${icon("check")}</button>
        <button class="icon-btn icon-btn--sm" type="button" data-action="schedule" data-id="${v.id}" title="إعادة الجدولة" aria-label="إعادة جدولة ${v.id}">${icon("calendar")}</button>
      </div>`;

    $("#maintUpcoming").innerHTML = upcoming.length
      ? upcoming
          .map((v) => {
            const d = daysFrom(v.nextService);
            const c = d <= 7 ? "c-warning" : "c-primary";
            return listItem({
              iconName: "wrench", c,
              title: `<span class="vid">${v.id}</span> · ${esc(v.model)}`,
              sub: `${v.nextType} · ${fmtDate(v.nextService)}`,
              side: `${badge(relDays(d), c)}${actions(v)}`,
              attrs: `data-open-vehicle="${v.id}" tabindex="0"`,
            });
          })
          .join("")
      : emptyList("لا توجد صيانات خلال 30 يومًا");

    $("#maintOverdue").innerHTML = overdue.length
      ? overdue
          .map((v) =>
            listItem({
              iconName: "alert", c: "c-danger",
              title: `<span class="vid">${v.id}</span> · ${esc(v.model)}`,
              sub: `${v.nextType} · كان موعدها ${fmtDate(v.nextService)}`,
              side: `${badge(`متأخرة ${dayPhrase(-daysFrom(v.nextService))}`, "c-danger")}${actions(v)}`,
              attrs: `data-open-vehicle="${v.id}" tabindex="0"`,
            })
          )
          .join("")
      : emptyList("لا توجد صيانات متأخرة — عمل رائع!");

    $("#maintHistory").innerHTML = tableHTML(
      ["التاريخ", "المركبة", "نوع الصيانة", "الورشة", "التكلفة", "الحالة"],
      maintenanceLog.slice(0, 12).map((m) => {
        const v = findVehicle(m.vehicleId);
        return `<tr class="row-in" data-open-vehicle="${m.vehicleId}" tabindex="0">
          <td>${fmtDate(m.date)}</td>
          <td>${vehicleCell(v)}</td>
          <td>${m.type}</td>
          <td class="muted">${m.workshop}</td>
          <td class="num">${fmtMoney(m.cost)}</td>
          <td>${badge("مكتملة", "c-success")}</td>
        </tr>`;
      })
    );
  };

  /* ---------- Insurance ---------- */
  const renderInsurance = () => {
    const count = (s) => VEHICLES.filter((v) => s === "all" || insState(v) === s).length;
    $("#insStats").innerHTML = [
      statCard({ label: "تأمين ساري", value: count("valid"), unit: "وثيقة", iconName: "shield", c: "c-success", attrs: `data-tab="ins" data-value="valid"` }),
      statCard({ label: "ينتهي قريبًا", value: count("soon"), unit: "خلال 30 يومًا", iconName: "clock", c: "c-warning", attrs: `data-tab="ins" data-value="soon"` }),
      statCard({ label: "تأمين منتهي", value: count("expired"), unit: "وثيقة", iconName: "alert", c: "c-danger", attrs: `data-tab="ins" data-value="expired"` }),
    ].join("");

    $("#insTabs").innerHTML = tabsHTML("ins", state.insTab, [
      ["all", "الكل", count("all")],
      ["valid", "ساري", count("valid")],
      ["soon", "ينتهي قريبًا", count("soon")],
      ["expired", "منتهي", count("expired")],
    ]);

    const list = VEHICLES.filter((v) => state.insTab === "all" || insState(v) === state.insTab).sort((a, b) => a.insExpiry - b.insExpiry);
    $("#insTable").innerHTML = tableHTML(
      ["المركبة", "اللوحة", "شركة التأمين", "التغطية", "رقم الوثيقة", "تاريخ الانتهاء", "المتبقي", "الحالة", "الإجراء"],
      list.map((v) => {
        const st = insState(v);
        const d = daysFrom(v.insExpiry);
        return `<tr class="row-in" data-open-vehicle="${v.id}" tabindex="0">
          <td>${vehicleCell(v)}</td>
          <td>${plateHTML(v.plate)}</td>
          <td>${v.insurer}</td>
          <td class="muted">${v.cover}</td>
          <td class="num muted">${v.policyNo}</td>
          <td>${fmtDate(v.insExpiry)}</td>
          <td class="${st === "expired" ? "text-danger" : st === "soon" ? "text-warning" : "muted"}">${relDays(d)}</td>
          <td>${badge(INS_STATUS[st].label, INS_STATUS[st].c)}</td>
          <td>${
            st === "valid"
              ? `<button class="icon-btn icon-btn--sm" type="button" data-action="view-vehicle" data-id="${v.id}" aria-label="عرض">${icon("eye")}</button>`
              : `<button class="btn btn--primary btn--sm" type="button" data-action="renew" data-id="${v.id}">${icon("refresh")}تجديد</button>`
          }</td>
        </tr>`;
      }),
      "لا توجد وثائق في هذا التصنيف"
    );
  };

  /* ---------- Accidents ---------- */
  const renderAccidents = () => {
    const recent = recentAccidents();
    const open = accidents.filter((a) => a.status !== "مغلق");
    $("#accStats").innerHTML = [
      statCard({ label: "حوادث آخر 6 أشهر", value: recent.length, unit: "حادث", iconName: "alert", c: "c-danger" }),
      statCard({ label: "بلاغات مفتوحة", value: open.length, unit: "قيد المعالجة", iconName: "clock", c: "c-warning" }),
      statCard({ label: "التكلفة التقديرية", value: fmtNum(sum(recent.map((a) => a.cost))), unit: "ر.س", iconName: "coin", c: "c-accent" }),
    ].join("");

    const list = [...accidents].sort((a, b) => b.date - a.date);
    $("#accTable").innerHTML = tableHTML(
      ["التاريخ", "رقم البلاغ", "المركبة", "المشروع", "نوع الحادث", "الموقع", "التكلفة", "الحالة", "الإجراء"],
      list.map((a) => {
        const v = findVehicle(a.vehicleId);
        return `<tr class="row-in" data-open-accident="${a.id}" tabindex="0">
          <td>${fmtDate(a.date)}</td>
          <td class="vid">${a.id}</td>
          <td>${vehicleCell(v)}</td>
          <td>${v ? v.project : "—"}</td>
          <td>${a.type}</td>
          <td class="muted">${esc(a.location)}</td>
          <td class="num">${fmtMoney(a.cost)}</td>
          <td>${badge(a.status, ACC_STATUS[a.status])}</td>
          <td><button class="icon-btn icon-btn--sm" type="button" data-action="view-accident" data-id="${a.id}" aria-label="عرض البلاغ ${a.id}">${icon("eye")}</button></td>
        </tr>`;
      })
    );
  };

  /* ---------- Violations ---------- */
  const renderViolations = () => {
    const by = (s) => violations.filter((x) => s === "all" || x.status === s);
    const amount = (list) => sum(list.map((x) => x.amount));
    $("#vioStats").innerHTML = [
      statCard({ label: "إجمالي المخالفات", value: violations.length, unit: "مخالفة", iconName: "receipt", c: "c-primary", foot: `بقيمة ${fmtMoney(amount(violations))}` }),
      statCard({ label: "غير مسددة", value: fmtNum(amount([...by("unpaid"), ...by("objected")])), unit: "ر.س", iconName: "alert", c: "c-danger", foot: `${by("unpaid").length} غير مسددة و ${by("objected").length} معترض عليها`, attrs: `data-tab="vio" data-value="unpaid"` }),
      statCard({ label: "مسددة", value: fmtNum(amount(by("paid"))), unit: "ر.س", iconName: "check", c: "c-success", foot: `${by("paid").length} مخالفة مسددة`, attrs: `data-tab="vio" data-value="paid"` }),
    ].join("");

    $("#vioTabs").innerHTML = tabsHTML("vio", state.vioTab, [
      ["all", "الكل", violations.length],
      ["unpaid", "غير مسددة", by("unpaid").length],
      ["objected", "معترض عليها", by("objected").length],
      ["paid", "مسددة", by("paid").length],
    ]);

    const list = by(state.vioTab).sort((a, b) => b.date - a.date);
    $("#vioTable").innerHTML = tableHTML(
      ["رقم المخالفة", "المركبة", "السائق", "نوع المخالفة", "التاريخ", "القيمة", "الحالة", "الإجراء"],
      list.map((x) => {
        const v = findVehicle(x.vehicleId);
        const d = driverOf(v);
        const st = VIO_STATUS[x.status];
        let action = `<span class="dim">${icon("check")}</span>`;
        if (x.status === "unpaid") {
          action = `<div class="row-actions">
            <button class="btn btn--primary btn--sm" type="button" data-action="pay" data-id="${x.id}">سداد</button>
            <button class="btn btn--ghost btn--sm" type="button" data-action="object" data-id="${x.id}">اعتراض</button></div>`;
        } else if (x.status === "objected") {
          action = `<button class="btn btn--primary btn--sm" type="button" data-action="pay" data-id="${x.id}">سداد</button>`;
        }
        return `<tr class="row-in" data-open-vehicle="${x.vehicleId}" tabindex="0">
          <td class="vid">${x.id}</td>
          <td>${vehicleCell(v)}</td>
          <td>${d ? d.name : `<span class="dim">غير مسند</span>`}</td>
          <td>${x.type}</td>
          <td>${fmtDate(x.date)}</td>
          <td class="num">${fmtMoney(x.amount)}</td>
          <td>${badge(st.label, st.c)}</td>
          <td>${action}</td>
        </tr>`;
      }),
      "لا توجد مخالفات في هذا التصنيف"
    );
  };

  /* ---------- Fuel ---------- */
  const renderFuel = () => {
    const liters = FUEL_LITERS[5];
    const cost = EXPENSES.fuel[5];
    const change = (a, b) => Math.round(((a - b) / b) * 100);
    $("#fuelStats").innerHTML = [
      statCard({ label: "استهلاك هذا الشهر", value: fmtNum(liters), unit: "لتر", iconName: "fuel", c: "c-primary", foot: `${trend(change(liters, FUEL_LITERS[4]))} مقارنة بالشهر الماضي` }),
      statCard({ label: "تكلفة الوقود", value: fmtNum(cost), unit: "ر.س", iconName: "coin", c: "c-warning", foot: `${trend(change(cost, EXPENSES.fuel[4]))} مقارنة بالشهر الماضي` }),
      statCard({ label: "متوسط سعر اللتر", value: (cost / liters).toFixed(2), unit: "ر.س", iconName: "gauge", c: "c-accent", foot: "ديزل وبنزين 91 و 95" }),
    ].join("");

    renderFuelChart();

    const consumers = VEHICLES.map((v, i) => ({ v, liters: inService(v) ? vehicleMonthlyLiters(v, i) : 0 }))
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 5);
    const top = consumers[0].liters;
    renderHBars(
      $("#fuelTop"),
      consumers.map(({ v, liters: l }) => ({ label: `${v.id} · ${esc(v.model)}`, valueLabel: fmtNum(l), pct: (l / top) * 100 }))
    );

    $("#fuelTable").innerHTML = tableHTML(
      ["التاريخ", "المركبة", "السائق", "المحطة", "الوقود", "الكمية", "سعر اللتر", "التكلفة"],
      [...fuelLog]
        .sort((a, b) => b.date - a.date)
        .map((f) => {
          const v = findVehicle(f.vehicleId);
          const d = driverOf(v);
          const price = FUEL_PRICE[v.fuel];
          return `<tr class="row-in" data-open-vehicle="${f.vehicleId}" tabindex="0">
            <td>${fmtDate(f.date)}</td>
            <td>${vehicleCell(v)}</td>
            <td>${d ? d.name : `<span class="dim">—</span>`}</td>
            <td class="muted">${f.station}</td>
            <td>${v.fuel}</td>
            <td class="num">${fmtNum(f.liters)} لتر</td>
            <td class="num muted">${price.toFixed(2)}</td>
            <td class="num">${fmtMoney(f.liters * price)}</td>
          </tr>`;
        })
    );
  };

  const renderFuelChart = () => {
    if (state.view === "fuel") renderLineChart($("#fuelChart"), MONTHS, FUEL_LITERS);
  };

  /* ---------- Drivers ---------- */
  const renderDrivers = () => {
    const q = state.driverQ;
    const list = DRIVERS.filter((d) => {
      if (!q.trim()) return true;
      const v = vehicleOfDriver(d);
      return normalize(`${d.name} ${d.phone} ${d.id} ${v ? v.id : ""}`).includes(normalize(q));
    });
    $("#driversGrid").innerHTML = list.length
      ? list
          .map((d, i) => {
            const v = vehicleOfDriver(d);
            const lic = daysFrom(d.licenceExpiry);
            const licClass = lic < 0 ? "text-danger" : lic <= 30 ? "text-warning" : "";
            const initials = d.name.split(" ").map((w) => w.replace(/^ال/, "")[0]).join(" ");
            const vio = v ? violations.filter((x) => x.vehicleId === v.id).length : 0;
            return `<article class="driver" style="animation-delay:${i * 40}ms">
              <div class="driver__head">
                <span class="driver__avatar" style="--h:${(i * 47) % 360}">${initials}</span>
                <div class="driver__name"><b>${d.name}</b><small class="num">${d.id}</small></div>
                ${badge(d.status, DRIVER_STATUS[d.status])}
              </div>
              <div class="driver__meta">
                <div><small>المركبة المسندة</small><b>${v ? `<span class="vid">${v.id}</span>` : `<span class="dim">غير مسند</span>`}</b></div>
                <div><small>انتهاء الرخصة</small><b class="${licClass}">${lic < 0 ? "منتهية" : fmtDate(d.licenceExpiry)}</b></div>
                <div><small>رحلات هذا الشهر</small><b>${d.trips}</b></div>
                <div><small>المخالفات</small><b class="${vio ? "text-warning" : ""}">${vio}</b></div>
              </div>
              <div class="driver__foot">
                <span class="stars">${icon("star")}${d.rating.toFixed(1)}</span>
                <div class="row-actions">
                  <a class="icon-btn icon-btn--sm" href="tel:${d.phone}" aria-label="اتصال بـ ${d.name}" title="${d.phone}">${icon("phone")}</a>
                  ${
                    v
                      ? `<button class="btn btn--ghost btn--sm" type="button" data-action="view-vehicle" data-id="${v.id}">${icon("truck")}عرض المركبة</button>`
                      : `<button class="btn btn--primary btn--sm" type="button" data-action="assign" data-id="${d.id}">${icon("plus")}إسناد مركبة</button>`
                  }
                </div>
              </div>
            </article>`;
          })
          .join("")
      : `<p class="list__empty">لا يوجد سائقون مطابقون للبحث</p>`;
  };

  /* ---------- Reports ---------- */
  const reportCards = () => {
    const totals = monthlyTotals();
    return [
      { key: "fleet", title: "تقرير الأسطول", sub: "حالة وتوزيع المركبات", iconName: "truck", c: "c-primary",
        value: `${VEHICLES.length} <small>مركبة</small>`, spark: [...FLEET_SIZE, VEHICLES.length] },
      { key: "maintenance", title: "تقرير الصيانة", sub: "تكاليف آخر 6 أشهر", iconName: "wrench", c: "c-accent",
        value: `${fmtNum(sum(EXPENSES.maintenance))} <small>ر.س</small>`, spark: EXPENSES.maintenance },
      { key: "accidents", title: "تقرير الحوادث", sub: "آخر 6 أشهر", iconName: "alert", c: "c-danger",
        value: `${recentAccidents().length} <small>حوادث</small>`, spark: accidentsByMonth() },
      { key: "expenses", title: "تقرير المصروفات", sub: "إجمالي آخر 6 أشهر", iconName: "coin", c: "c-warning",
        value: `${fmtNum(sum(totals))} <small>ر.س</small>`, spark: totals },
    ];
  };

  const renderReports = () => {
    $("#reportsGrid").innerHTML = reportCards()
      .map(
        (r) => `<article class="report ${r.c}">
          <div class="report__head"><span class="stat__icon">${icon(r.iconName)}</span><div><b>${r.title}</b><small>${r.sub}</small></div></div>
          <div class="report__value">${r.value}</div>
          ${sparkline(r.spark)}
          <div class="report__actions">
            <button class="btn btn--ghost btn--sm" type="button" data-action="view-report" data-report="${r.key}">${icon("eye")}عرض</button>
            <button class="btn btn--ghost btn--sm" type="button" data-action="export" data-report="${r.key}">${icon("download")}CSV</button>
          </div>
        </article>`
      )
      .join("");
    renderBarChart($("#reportChart"), $("#reportLegend"), MONTHS, EXPENSE_SERIES, EXPENSES);
  };

  /* ---------- Sidebar counts ---------- */
  const renderCounts = () => {
    const counts = {
      vehicles: VEHICLES.length,
      maintenance: overdueVehicles().length || "",
      insurance: VEHICLES.filter((v) => insState(v) !== "valid").length || "",
      violations: violations.filter((x) => x.status === "unpaid").length || "",
    };
    $$("[data-count]").forEach((el) => (el.textContent = counts[el.dataset.count]));
  };

  const renderAll = () => {
    renderDashboard();
    renderVehicles();
    renderMaintenance();
    renderInsurance();
    renderAccidents();
    renderViolations();
    renderFuel();
    renderDrivers();
    renderReports();
    renderCounts();
    renderNotifications();
  };

  /* =========================================================
     Navigation
     ========================================================= */
  const VIEWS = ["dashboard", "vehicles", "maintenance", "insurance", "accidents", "violations", "fuel", "drivers", "reports", "settings"];
  const sidebar = $("#sidebar");
  const menuBtn = $("#menuBtn");
  const isCompact = () => window.innerWidth <= 1024;

  const setSidebar = (open) => {
    sidebar.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("locked", open && isCompact());
  };

  const showView = (view) => {
    if (!VIEWS.includes(view)) view = "dashboard";
    state.view = view;
    $$(".view").forEach((s) => (s.hidden = s.id !== `view-${view}`));
    $$(".side-nav__link").forEach((a) => {
      const on = a.dataset.view === view;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const title = $(`#view-${view}`).dataset.title;
    $("#pageTitle").textContent = title;
    document.title = `${title} | FleetPro`;
    if (view === "fuel") renderFuelChart();
    if (isCompact()) setSidebar(false);
    window.scrollTo(0, 0);
  };

  const navigate = (view) => {
    if (location.hash === `#${view}`) showView(view);
    else location.hash = view;
  };

  window.addEventListener("hashchange", () => showView(location.hash.slice(1)));

  menuBtn.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
  $("#sidebarClose").addEventListener("click", () => setSidebar(false));
  $("#sidebarOverlay").addEventListener("click", () => setSidebar(false));

  /* =========================================================
     Modal
     ========================================================= */
  const modal = $("#modal");
  const modalDialog = $(".modal__dialog", modal);
  let modalReturnFocus = null;
  let modalContext = null;

  const openModal = ({ title, subtitle = "", badgeHTML = "", body, foot = "", size = "", context = null }) => {
    $("#modalHead").innerHTML = `<div class="modal__title-row"><h3 id="modalTitle">${title}</h3>${badgeHTML}</div>${subtitle ? `<p>${subtitle}</p>` : ""}`;
    $("#modalBody").innerHTML = body;
    $("#modalFoot").innerHTML = foot;
    modal.classList.toggle("modal--sm", size === "sm");
    modalContext = context;
    if (!modal.classList.contains("open")) {
      modalReturnFocus = document.activeElement;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("locked");
      modalDialog.focus();
    }
    $("#modalBody").scrollTop = 0;
  };

  const closeModal = () => {
    if (!modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!sidebar.classList.contains("open")) document.body.classList.remove("locked");
    modalContext = null;
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus({ preventScroll: true });
  };

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });

  // Re-render every view, then refresh an open vehicle modal so it shows fresh data
  const refresh = () => {
    renderAll();
    if (modalContext && modalContext.type === "vehicle") openVehicle(modalContext.id);
  };

  /* ---------- Forms inside the modal ---------- */
  const fieldHTML = (f) => {
    const id = `f-${f.name}`;
    const common = `id="${id}" name="${f.name}" ${f.required ? "required" : ""} ${f.attrs || ""}`;
    let control;
    if (f.type === "select") {
      control = `<select class="select" ${common}>${f.options
        .map((o) => {
          const [val, label] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(f.value ?? "") ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("")}</select>`;
    } else if (f.type === "textarea") {
      control = `<textarea class="textarea" ${common} placeholder="${f.placeholder || ""}">${esc(f.value || "")}</textarea>`;
    } else {
      control = `<input class="input" type="${f.type || "text"}" ${common} value="${esc(f.value ?? "")}" placeholder="${f.placeholder || ""}">`;
    }
    return `<label class="form__field ${f.full ? "full" : ""}" for="${id}"><span>${f.label}</span>${control}<small class="form__error"></small></label>`;
  };

  const openForm = ({ title, subtitle, fields, submitLabel, onSubmit }) => {
    openModal({
      title, subtitle, size: "sm",
      body: `<form class="form form--grid" id="modalForm" novalidate>${fields.map(fieldHTML).join("")}</form>`,
      foot: `<button class="btn btn--ghost" type="button" data-close>إلغاء</button>
             <button class="btn btn--primary" type="submit" form="modalForm">${icon("check")}${submitLabel}</button>`,
    });
    const form = $("#modalForm");
    const first = form.querySelector("input, select, textarea");
    if (first && !isCompact()) first.focus();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstInvalid = null;
      fields.forEach((f) => {
        const input = form.elements[f.name];
        const value = input.value.trim();
        let error = "";
        if (f.required && !value) error = "هذا الحقل مطلوب";
        else if (value && f.validate) error = f.validate(value) || "";
        const wrap = input.closest(".form__field");
        wrap.classList.toggle("invalid", !!error);
        wrap.querySelector(".form__error").textContent = error;
        if (error && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      const values = Object.fromEntries(fields.map((f) => [f.name, form.elements[f.name].value.trim()]));
      if (onSubmit(values) !== false) closeModal();
    });
  };

  /* =========================================================
     Detail modals
     ========================================================= */
  const dItem = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;

  const vehicleHistory = (v) =>
    [
      ...maintenanceLog.filter((m) => m.vehicleId === v.id).map((m) => ({
        date: m.date, iconName: "wrench", c: "c-accent", title: m.type, sub: `${m.workshop} · ${fmtMoney(m.cost)}`,
      })),
      ...accidents.filter((a) => a.vehicleId === v.id).map((a) => ({
        date: a.date, iconName: "alert", c: "c-danger", title: `حادث: ${a.type}`, sub: `${esc(a.location)} · ${a.status}`,
      })),
      ...violations.filter((x) => x.vehicleId === v.id).map((x) => ({
        date: x.date, iconName: "receipt", c: "c-warning", title: `مخالفة: ${x.type}`, sub: `${fmtMoney(x.amount)} · ${VIO_STATUS[x.status].label}`,
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);

  const openVehicle = (id) => {
    const v = findVehicle(id);
    if (!v) return;
    const d = driverOf(v);
    const nextDays = daysFrom(v.nextService);
    const st = insState(v);
    const span = Math.max(1, daysFrom(v.nextService) - daysFrom(v.lastService));
    const elapsed = Math.min(100, Math.max(0, (-daysFrom(v.lastService) / span) * 100));
    const nextClass = nextDays < 0 ? "text-danger" : nextDays <= 14 ? "text-warning" : "text-success";
    const history = vehicleHistory(v);

    openModal({
      title: esc(v.model),
      badgeHTML: statusBadge(v.status),
      subtitle: `<span class="vid">${v.id}</span> · ${v.type} · ${v.project}`,
      context: { type: "vehicle", id },
      body: `
        <div class="detail-hero">
          <span class="detail-hero__icon">${icon("truck")}</span>
          <div class="detail-hero__body"><b>${esc(v.model)} ${v.year}</b><div>${plateHTML(v.plate)}</div></div>
          <div class="detail-hero__km"><b class="num">${fmtNum(v.mileage)}</b><small>كم</small></div>
        </div>
        <div class="detail-section">
          <h4>${icon("file")}معلومات المركبة</h4>
          <div class="detail-grid">
            ${dItem("رقم المركبة", `<span class="vid">${v.id}</span>`)}
            ${dItem("النوع", v.type)}
            ${dItem("سنة الصنع", v.year)}
            ${dItem("المشروع", v.project)}
            ${dItem("السائق", d ? d.name : `<span class="dim">غير مسند</span>`)}
            ${dItem("نوع الوقود", v.fuel)}
          </div>
        </div>
        <div class="detail-section">
          <h4>${icon("wrench")}الصيانة</h4>
          <div class="detail-grid">
            ${dItem("آخر صيانة", fmtDate(v.lastService))}
            ${dItem("الصيانة القادمة", fmtDate(v.nextService))}
            ${dItem("المتبقي", `<span class="${nextClass}">${nextDays < 0 ? `متأخرة ${dayPhrase(-nextDays)}` : relDays(nextDays)}</span>`)}
          </div>
          <div class="progress" style="--c:var(--${nextDays < 0 ? "danger" : nextDays <= 14 ? "warning" : "success"})"><span style="width:${elapsed.toFixed(0)}%"></span></div>
          <small class="dim">نوع الصيانة القادمة: ${v.nextType}</small>
        </div>
        <div class="detail-section">
          <h4>${icon("shield")}التأمين</h4>
          <div class="detail-grid">
            ${dItem("شركة التأمين", v.insurer)}
            ${dItem("التغطية", v.cover)}
            ${dItem("رقم الوثيقة", `<span class="num">${v.policyNo}</span>`)}
            ${dItem("تاريخ الانتهاء", fmtDate(v.insExpiry))}
            ${dItem("المتبقي", relDays(daysFrom(v.insExpiry)))}
            ${dItem("الحالة", badge(INS_STATUS[st].label, INS_STATUS[st].c))}
          </div>
        </div>
        <div class="detail-section">
          <h4>${icon("clock")}سجل المركبة</h4>
          ${
            history.length
              ? `<ul class="timeline">${history
                  .map(
                    (hItem) => `<li><span class="list__icon ${hItem.c}">${icon(hItem.iconName)}</span>
                      <div class="timeline__body">${hItem.title}<small>${hItem.sub}</small></div>
                      <span class="dim">${fmtDate(hItem.date)}</span></li>`
                  )
                  .join("")}</ul>`
              : `<p class="dim">لا يوجد سجل لهذه المركبة بعد.</p>`
          }
        </div>`,
      foot: `
        <label class="spacer status-field"><span class="dim">الحالة</span>
          <select class="select" id="vehicleStatus" aria-label="تغيير حالة المركبة">
            ${Object.entries(VEHICLE_STATUS).map(([k, s]) => `<option value="${k}" ${k === v.status ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </label>
        ${st !== "valid" ? `<button class="btn btn--ghost" type="button" data-action="renew" data-id="${v.id}">${icon("refresh")}تجديد التأمين</button>` : ""}
        <button class="btn btn--primary" type="button" data-action="schedule" data-id="${v.id}">${icon("calendar")}جدولة صيانة</button>`,
    });

    $("#vehicleStatus").addEventListener("change", (e) => {
      v.status = e.target.value;
      toast("تم تحديث حالة المركبة", `${v.id} أصبحت: ${VEHICLE_STATUS[v.status].label}`);
      refresh();
    });
  };

  const openAccident = (id) => {
    const a = accidents.find((x) => x.id === id);
    if (!a) return;
    const v = findVehicle(a.vehicleId);
    const d = driverOf(v);
    openModal({
      title: `بلاغ حادث <span class="vid">${a.id}</span>`,
      badgeHTML: badge(a.status, ACC_STATUS[a.status]),
      subtitle: `${a.type} · ${fmtDate(a.date)}`,
      body: `
        <div class="detail-grid">
          ${dItem("المركبة", v ? `<button class="link-btn" type="button" data-open-vehicle="${v.id}">${v.id} · ${esc(v.model)}</button>` : "—")}
          ${dItem("المشروع", v ? v.project : "—")}
          ${dItem("السائق", d ? d.name : "غير مسند")}
          ${dItem("نوع الحادث", a.type)}
          ${dItem("التكلفة التقديرية", fmtMoney(a.cost))}
          ${dItem("التاريخ", fmtDate(a.date))}
        </div>
        <div class="detail-section">
          <h4>${icon("pin")}الموقع</h4>
          <p class="muted">${esc(a.location)}</p>
        </div>
        <div class="detail-section">
          <h4>${icon("file")}وصف الحادث</h4>
          <p class="muted">${esc(a.description) || "لا يوجد وصف."}</p>
        </div>`,
      foot: `
        <label class="spacer status-field"><span class="dim">الحالة</span>
          <select class="select" id="accidentStatus" aria-label="حالة البلاغ">
            ${Object.keys(ACC_STATUS).map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn--ghost" type="button" data-close>إغلاق</button>
        <button class="btn btn--primary" type="button" id="saveAccident">${icon("check")}حفظ</button>`,
    });
    $("#saveAccident").addEventListener("click", () => {
      a.status = $("#accidentStatus").value;
      closeModal();
      renderAll();
      toast("تم تحديث البلاغ", `${a.id}: ${a.status}`);
    });
  };

  /* ---------- Reports ---------- */
  const summaryHTML = (items) => `<div class="report-summary">${items.map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join("")}</div>`;

  const openReport = (key) => {
    const card = reportCards().find((r) => r.key === key);
    let body = "";
    if (key === "fleet") {
      const active = VEHICLES.filter((v) => v.status === "active").length;
      const avgAge = sum(VEHICLES.map((v) => TODAY.getFullYear() - v.year)) / VEHICLES.length;
      body =
        summaryHTML([["إجمالي المركبات", VEHICLES.length], ["نسبة التشغيل", `${Math.round((active / VEHICLES.length) * 100)}%`], ["متوسط عمر المركبة", `${avgAge.toFixed(1)} سنة`]]) +
        `<div class="table-wrap"><table class="table">${tableHTML(
          ["المشروع", "المركبات", "نشطة", "في الصيانة", "متوقفة"],
          PROJECTS.map((p) => {
            const list = VEHICLES.filter((v) => v.project === p);
            const c = (s) => list.filter((v) => v.status === s).length;
            return `<tr><td>${p}</td><td><b>${list.length}</b></td><td class="text-success">${c("active")}</td><td class="text-warning">${c("maintenance")}</td><td class="muted">${c("inactive")}</td></tr>`;
          })
        )}</table></div>`;
    } else if (key === "maintenance") {
      const recent = maintenanceLog.filter((m) => daysFrom(m.date) >= -183);
      body =
        summaryHTML([["عمليات الصيانة", recent.length], ["إجمالي التكلفة", fmtMoney(sum(EXPENSES.maintenance))], ["متأخرة حاليًا", overdueVehicles().length]]) +
        `<div class="table-wrap"><table class="table">${tableHTML(
          ["التاريخ", "المركبة", "النوع", "التكلفة"],
          recent.slice(0, 10).map((m) => `<tr><td>${fmtDate(m.date)}</td><td class="vid">${m.vehicleId}</td><td>${m.type}</td><td class="num">${fmtMoney(m.cost)}</td></tr>`)
        )}</table></div>`;
    } else if (key === "accidents") {
      const recent = recentAccidents();
      body =
        summaryHTML([["عدد الحوادث", recent.length], ["بلاغات مفتوحة", recent.filter((a) => a.status !== "مغلق").length], ["التكلفة التقديرية", fmtMoney(sum(recent.map((a) => a.cost)))]]) +
        `<div class="table-wrap"><table class="table">${tableHTML(
          ["التاريخ", "المركبة", "النوع", "الحالة"],
          recent.map((a) => `<tr><td>${fmtDate(a.date)}</td><td class="vid">${a.vehicleId}</td><td>${a.type}</td><td>${badge(a.status, ACC_STATUS[a.status])}</td></tr>`)
        )}</table></div>`;
    } else {
      const totals = monthlyTotals();
      const fuelShare = Math.round((sum(EXPENSES.fuel) / sum(totals)) * 100);
      body =
        summaryHTML([["إجمالي المصروفات", fmtMoney(sum(totals))], ["المتوسط الشهري", fmtMoney(sum(totals) / 6)], ["حصة الوقود", `${fuelShare}%`]]) +
        `<div class="table-wrap"><table class="table">${tableHTML(
          ["الشهر", ...EXPENSE_SERIES.map((s) => s.label), "الإجمالي"],
          [
            ...MONTHS.map((m, i) => `<tr><td>${m}</td>${EXPENSE_SERIES.map((s) => `<td class="num">${fmtNum(EXPENSES[s.key][i])}</td>`).join("")}<td class="num"><b>${fmtNum(totals[i])}</b></td></tr>`),
            `<tr><td><b>الإجمالي</b></td>${EXPENSE_SERIES.map((s) => `<td class="num"><b>${fmtNum(sum(EXPENSES[s.key]))}</b></td>`).join("")}<td class="num"><b>${fmtNum(sum(totals))}</b></td></tr>`,
          ]
        )}</table></div>`;
    }
    openModal({
      title: card.title,
      subtitle: `${card.sub} · تم الإنشاء ${fmtDate(TODAY)}`,
      body,
      foot: `<button class="btn btn--ghost" type="button" data-close>إغلاق</button>
             <button class="btn btn--primary" type="button" data-action="export" data-report="${key}">${icon("download")}تصدير CSV</button>`,
    });
  };

  /* =========================================================
     Actions
     ========================================================= */
  const nextVehicleId = () => `FP-${Math.max(...VEHICLES.map((v) => Number(v.id.slice(3)))) + 1}`;

  const openAddVehicle = () => {
    const freeDrivers = DRIVERS.filter((d) => !vehicleOfDriver(d));
    openForm({
      title: "إضافة مركبة جديدة",
      subtitle: `سيتم تسجيلها برقم ${nextVehicleId()}`,
      submitLabel: "إضافة المركبة",
      fields: [
        { name: "letters", label: "حروف اللوحة", placeholder: "مثال: ر س ع", required: true,
          validate: (v) => (/^[ء-يـ](\s*[ء-يـ]){0,4}$/.test(v) ? "" : "أدخل من 1 إلى 3 أحرف عربية") },
        { name: "digits", label: "أرقام اللوحة", placeholder: "مثال: 4821", required: true, attrs: 'inputmode="numeric" maxlength="4" dir="ltr"',
          validate: (v) => (/^\d{1,4}$/.test(v) ? "" : "أدخل من 1 إلى 4 أرقام") },
        { name: "model", label: "الطراز", placeholder: "مثال: تويوتا هايلكس", required: true, full: true },
        { name: "type", label: "النوع", type: "select", options: VEHICLE_TYPES, value: "بيك أب" },
        { name: "year", label: "سنة الصنع", type: "number", value: TODAY.getFullYear(), required: true, attrs: `min="2000" max="${TODAY.getFullYear() + 1}"`,
          validate: (v) => (+v >= 2000 && +v <= TODAY.getFullYear() + 1 ? "" : "سنة غير صحيحة") },
        { name: "project", label: "المشروع", type: "select", options: PROJECTS },
        { name: "status", label: "الحالة", type: "select", options: Object.entries(VEHICLE_STATUS).map(([k, s]) => [k, s.label]) },
        { name: "driver", label: "السائق", type: "select", options: [["", "بدون سائق"], ...freeDrivers.map((d) => [d.id, d.name])] },
        { name: "insurer", label: "شركة التأمين", type: "select", options: Object.keys(INSURERS) },
        { name: "mileage", label: "عداد المسافة (كم)", type: "number", value: 0, attrs: 'min="0"',
          validate: (v) => (+v >= 0 ? "" : "قيمة غير صحيحة") },
      ],
      onSubmit: (f) => {
        const letters = [...f.letters.replace(/[\sـ]/g, "")].map((c) => (c === "ه" ? "هـ" : c)).join(" ");
        const plate = `${letters} ${f.digits}`;
        if (VEHICLES.some((v) => v.plate === plate)) {
          toast("اللوحة مسجلة مسبقًا", `اللوحة ${plate} موجودة في الأسطول`, "danger");
          return false;
        }
        const i = VEHICLES.length;
        const v = {
          id: nextVehicleId(), plate, model: f.model, type: f.type, project: f.project, status: f.status,
          lastService: TODAY, nextService: addDays(Number(state.settings.interval) || 90), nextType: MAINT_TYPES[0],
          insurer: f.insurer, cover: "شامل", policyNo: `${INSURERS[f.insurer]}-${4810000 + ((i * 73129) % 900000)}`,
          insExpiry: addDays(365), mileage: Number(f.mileage) || 0, year: Number(f.year),
          driverId: f.driver || null, fuel: fuelFor(f.type), addedAt: TODAY,
        };
        VEHICLES.push(v);
        renderAll();
        toast("تمت إضافة المركبة", `${v.id} · ${f.model} أُضيفت إلى الأسطول`);
        return true;
      },
    });
  };

  const openSchedule = (vehicleId) => {
    const v = vehicleId ? findVehicle(vehicleId) : null;
    openForm({
      title: "جدولة صيانة",
      subtitle: v ? `${v.id} · ${v.model}` : "حدد المركبة وموعد الصيانة",
      submitLabel: "تأكيد الجدولة",
      fields: [
        { name: "vehicle", label: "المركبة", type: "select", full: true, value: vehicleId || "",
          options: VEHICLES.map((x) => [x.id, `${x.id} · ${x.model} (${x.plate})`]) },
        { name: "type", label: "نوع الصيانة", type: "select", options: MAINT_TYPES, value: v ? v.nextType : MAINT_TYPES[0] },
        { name: "date", label: "التاريخ", type: "date", value: isoDate(addDays(7)), required: true, attrs: `min="${isoDate(TODAY)}"`,
          validate: (val) => (daysFrom(parseISO(val)) >= 0 ? "" : "اختر تاريخًا من اليوم فصاعدًا") },
        { name: "workshop", label: "الورشة", type: "select", options: WORKSHOPS, full: true },
        { name: "notes", label: "ملاحظات", type: "textarea", placeholder: "ملاحظات إضافية للورشة (اختياري)", full: true },
      ],
      onSubmit: (f) => {
        const target = findVehicle(f.vehicle);
        target.nextService = parseISO(f.date);
        target.nextType = f.type;
        renderAll();
        toast("تمت جدولة الصيانة", `${target.id} — ${f.type} في ${fmtDate(target.nextService)} لدى ${f.workshop}`);
        return true;
      },
    });
  };

  const completeMaintenance = (id) => {
    const v = findVehicle(id);
    maintenanceLog.push({
      vehicleId: v.id, date: TODAY, type: v.nextType, workshop: WORKSHOPS[4],
      cost: CATEGORY_COST[v.type],
    });
    sortLog();
    v.lastService = TODAY;
    v.nextService = addDays(Number(state.settings.interval) || 90);
    v.nextType = MAINT_TYPES[(MAINT_TYPES.indexOf(v.nextType) + 1) % MAINT_TYPES.length];
    if (v.status === "maintenance") v.status = "active";
    refresh();
    toast("تم تسجيل إنجاز الصيانة", `${v.id} — الصيانة القادمة ${fmtDate(v.nextService)}`);
  };

  const renewInsurance = (id) => {
    const v = findVehicle(id);
    v.insExpiry = addDays(Math.max(daysFrom(v.insExpiry), 0) + 365);
    refresh();
    toast("تم تجديد التأمين", `وثيقة ${v.id} سارية حتى ${fmtDate(v.insExpiry)}`);
  };

  const setViolationStatus = (id, status) => {
    const x = violations.find((item) => item.id === id);
    x.status = status;
    renderAll();
    if (status === "paid") toast("تم سداد المخالفة", `المخالفة ${x.id} بقيمة ${fmtMoney(x.amount)}`);
    else toast("تم تقديم الاعتراض", `سيتم إشعارك بنتيجة الاعتراض على المخالفة ${x.id}`, "info");
  };

  const openAddAccident = () => {
    openForm({
      title: "تسجيل حادث",
      subtitle: "سيتم إنشاء بلاغ جديد بحالة «قيد التحقيق»",
      submitLabel: "تسجيل البلاغ",
      fields: [
        { name: "vehicle", label: "المركبة", type: "select", full: true, options: VEHICLES.map((x) => [x.id, `${x.id} · ${x.model}`]) },
        { name: "type", label: "نوع الحادث", type: "select", options: ACCIDENT_TYPES },
        { name: "date", label: "تاريخ الحادث", type: "date", value: isoDate(TODAY), required: true, attrs: `max="${isoDate(TODAY)}"`,
          validate: (val) => (daysFrom(parseISO(val)) <= 0 ? "" : "لا يمكن أن يكون التاريخ في المستقبل") },
        { name: "location", label: "الموقع", placeholder: "مثال: طريق الملك فهد، الرياض", required: true, full: true },
        { name: "cost", label: "التكلفة التقديرية (ر.س)", type: "number", value: 0, attrs: 'min="0"', validate: (val) => (+val >= 0 ? "" : "قيمة غير صحيحة") },
        { name: "description", label: "وصف الحادث", type: "textarea", full: true, placeholder: "صف ما حدث باختصار" },
      ],
      onSubmit: (f) => {
        const num = Math.max(...accidents.map((a) => Number(a.id.slice(3)))) + 1;
        const a = {
          id: `AC-${String(num).padStart(4, "0")}`, date: parseISO(f.date), vehicleId: f.vehicle, type: f.type,
          location: f.location, status: "قيد التحقيق", cost: Number(f.cost) || 0, description: f.description,
        };
        accidents.unshift(a);
        pushNotification({ kind: "accident", iconName: "alert", c: "c-danger", title: "بلاغ حادث جديد", text: `تم تسجيل ${a.type} للمركبة ${a.vehicleId}`, action: { accident: a.id } });
        renderAll();
        toast("تم تسجيل الحادث", `رقم البلاغ ${a.id}`);
        return true;
      },
    });
  };

  const openAssign = (driverId) => {
    const d = findDriver(driverId);
    const free = VEHICLES.filter((v) => !v.driverId && inService(v));
    if (!free.length) {
      toast("لا توجد مركبات متاحة", "جميع المركبات العاملة مسندة لسائقين", "warning");
      return;
    }
    openForm({
      title: "إسناد مركبة",
      subtitle: `السائق: ${d.name}`,
      submitLabel: "إسناد",
      fields: [{ name: "vehicle", label: "المركبة", type: "select", full: true, options: free.map((v) => [v.id, `${v.id} · ${v.model} — ${v.project}`]) }],
      onSubmit: (f) => {
        findVehicle(f.vehicle).driverId = d.id;
        renderAll();
        toast("تم الإسناد", `أُسندت المركبة ${f.vehicle} إلى ${d.name}`);
        return true;
      },
    });
  };

  /* ---------- CSV export ---------- */
  const EXPORTS = {
    fleet: () => ["fleet", ["رقم المركبة", "اللوحة", "الطراز", "النوع", "المشروع", "الحالة", "السائق", "آخر صيانة", "الصيانة القادمة", "انتهاء التأمين", "العداد"],
      VEHICLES.map((v) => [v.id, v.plate, v.model, v.type, v.project, VEHICLE_STATUS[v.status].label, driverOf(v)?.name || "", isoDate(v.lastService), isoDate(v.nextService), isoDate(v.insExpiry), v.mileage])],
    vehicles: () => ["vehicles", ["رقم المركبة", "اللوحة", "الطراز", "النوع", "المشروع", "الحالة", "آخر صيانة"],
      filteredVehicles().map((v) => [v.id, v.plate, v.model, v.type, v.project, VEHICLE_STATUS[v.status].label, isoDate(v.lastService)])],
    maintenance: () => ["maintenance", ["التاريخ", "المركبة", "نوع الصيانة", "الورشة", "التكلفة"],
      maintenanceLog.map((m) => [isoDate(m.date), m.vehicleId, m.type, m.workshop, m.cost])],
    insurance: () => ["insurance", ["المركبة", "اللوحة", "شركة التأمين", "التغطية", "رقم الوثيقة", "تاريخ الانتهاء", "الحالة"],
      VEHICLES.map((v) => [v.id, v.plate, v.insurer, v.cover, v.policyNo, isoDate(v.insExpiry), INS_STATUS[insState(v)].label])],
    accidents: () => ["accidents", ["رقم البلاغ", "التاريخ", "المركبة", "المشروع", "نوع الحادث", "الموقع", "التكلفة", "الحالة"],
      accidents.map((a) => [a.id, isoDate(a.date), a.vehicleId, findVehicle(a.vehicleId)?.project || "", a.type, a.location, a.cost, a.status])],
    violations: () => ["violations", ["رقم المخالفة", "المركبة", "التاريخ", "نوع المخالفة", "القيمة", "الحالة"],
      violations.map((x) => [x.id, x.vehicleId, isoDate(x.date), x.type, x.amount, VIO_STATUS[x.status].label])],
    fuel: () => ["fuel", ["التاريخ", "المركبة", "المحطة", "الوقود", "الكمية (لتر)", "التكلفة"],
      fuelLog.map((f) => { const v = findVehicle(f.vehicleId); return [isoDate(f.date), f.vehicleId, f.station, v.fuel, f.liters, (f.liters * FUEL_PRICE[v.fuel]).toFixed(2)]; })],
    expenses: () => ["expenses", ["الشهر", ...EXPENSE_SERIES.map((s) => s.label), "الإجمالي"],
      MONTHS.map((m, i) => [m, ...EXPENSE_SERIES.map((s) => EXPENSES[s.key][i]), monthlyTotals()[i]])],
  };

  const exportCSV = (key) => {
    const [name, headers, rows] = EXPORTS[key]();
    const cell = (c) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fleetpro-${name}-${isoDate(TODAY)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("تم تصدير الملف", `${a.download} (${rows.length} سجل)`, "info");
  };

  /* =========================================================
     Toasts
     ========================================================= */
  const TOAST_TYPES = { success: ["check", "c-success"], info: ["download", "c-info"], warning: ["alert", "c-warning"], danger: ["alert", "c-danger"], notify: ["bell", "c-primary"] };
  const toastBox = $("#toasts");

  const toast = (title, text = "", type = "success") => {
    const [ic, c] = TOAST_TYPES[type];
    const el = document.createElement("div");
    el.className = `toast ${c}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span class="list__icon ${c}">${icon(ic)}</span>
      <div class="toast__body"><b>${title}</b>${text ? `<span>${esc(text)}</span>` : ""}</div>
      <button class="icon-btn" type="button" aria-label="إغلاق التنبيه">${icon("x")}</button>`;
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    };
    el.querySelector("button").addEventListener("click", remove);
    toastBox.appendChild(el);
    while (toastBox.children.length > 4) toastBox.firstElementChild.remove();
    setTimeout(remove, 4500);
  };

  /* =========================================================
     Notifications
     ========================================================= */
  const notifBtn = $("#notifBtn");
  const notifPanel = $("#notifPanel");
  let notifSeq = 0;

  const buildNotifications = () => {
    const times = ["منذ 5 دقائق", "منذ 18 دقيقة", "منذ ساعة", "منذ 3 ساعات", "منذ 5 ساعات", "أمس", "أمس", "منذ يومين"];
    const list = [];
    overdueVehicles().slice(0, 2).forEach((v) =>
      list.push({ kind: "maint", iconName: "wrench", c: "c-danger", title: "صيانة متأخرة", text: `${v.id} · ${v.model} تجاوزت موعد الصيانة ${relDays(daysFrom(v.nextService))}`, action: { vehicle: v.id } })
    );
    const openAcc = accidents.find((a) => a.status !== "مغلق");
    if (openAcc) list.push({ kind: "accident", iconName: "alert", c: "c-danger", title: "بلاغ حادث قيد التحقيق", text: `${openAcc.type} للمركبة ${openAcc.vehicleId} — ${openAcc.location}`, action: { accident: openAcc.id } });
    VEHICLES.filter((v) => insState(v) === "expired").slice(0, 1).forEach((v) =>
      list.push({ kind: "ins", iconName: "shield", c: "c-warning", title: "تأمين منتهي", text: `انتهت وثيقة تأمين ${v.id} ${relDays(daysFrom(v.insExpiry))}`, action: { view: "insurance", tab: "expired" } })
    );
    VEHICLES.filter((v) => insState(v) === "soon").slice(0, 1).forEach((v) =>
      list.push({ kind: "ins", iconName: "clock", c: "c-warning", title: "تأمين ينتهي قريبًا", text: `وثيقة تأمين ${v.id} تنتهي ${relDays(daysFrom(v.insExpiry))}`, action: { vehicle: v.id } })
    );
    const unpaid = violations.filter((x) => x.status === "unpaid");
    if (unpaid.length) list.push({ kind: "vio", iconName: "receipt", c: "c-info", title: "مخالفات غير مسددة", text: `لديك ${unpaid.length} مخالفات بقيمة ${fmtMoney(sum(unpaid.map((x) => x.amount)))}`, action: { view: "violations" } });
    const licence = DRIVERS.find((d) => daysFrom(d.licenceExpiry) >= 0 && daysFrom(d.licenceExpiry) <= 30);
    if (licence) list.push({ kind: "driver", iconName: "users", c: "c-primary", title: "رخصة سائق", text: `رخصة ${licence.name} تنتهي ${relDays(daysFrom(licence.licenceExpiry))}`, action: { view: "drivers" }, read: true });
    list.push({ kind: "maint", iconName: "check", c: "c-success", title: "صيانة مكتملة", text: `تم إنجاز صيانة ${VEHICLES[16].id} بنجاح`, action: { vehicle: VEHICLES[16].id }, read: true });
    state.notifications = list.map((n, i) => ({ id: `n${++notifSeq}`, read: false, time: times[i] || "هذا الأسبوع", ...n }));
  };

  const visibleNotifications = () =>
    state.notifications.filter(
      (n) => !(n.kind === "maint" && !state.settings.notifyMaint) && !(n.kind === "ins" && !state.settings.notifyIns)
    );

  const renderNotifications = () => {
    const list = visibleNotifications();
    const unread = list.filter((n) => !n.read).length;
    $("#notifBadge").textContent = unread || "";
    notifBtn.setAttribute("aria-label", unread ? `الإشعارات (${unread} غير مقروءة)` : "الإشعارات");
    $("#notifList").innerHTML = list.length
      ? list
          .map(
            (n) => `<li><button class="notif__item ${n.read ? "" : "unread"}" type="button" data-notif="${n.id}">
              <span class="list__icon ${n.c}">${icon(n.iconName)}</span>
              <span class="notif__text"><b>${n.title}</b><span>${esc(n.text)}</span><small>${n.time}</small></span>
            </button></li>`
          )
          .join("")
      : `<li class="notif__empty">لا توجد إشعارات جديدة</li>`;
  };

  const pushNotification = (n) => {
    state.notifications.unshift({ id: `n${++notifSeq}`, read: false, time: "الآن", ...n });
    renderNotifications();
    const b = $("#notifBadge");
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
  };

  const setNotifPanel = (open) => {
    notifPanel.classList.toggle("open", open);
    notifBtn.setAttribute("aria-expanded", String(open));
  };

  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setNotifPanel(!notifPanel.classList.contains("open"));
  });

  $("#markAllRead").addEventListener("click", () => {
    state.notifications.forEach((n) => (n.read = true));
    renderNotifications();
    toast("تم تحديد جميع الإشعارات كمقروءة", "", "notify");
  });

  const handleNotification = (id) => {
    const n = state.notifications.find((x) => x.id === id);
    if (!n) return;
    n.read = true;
    renderNotifications();
    setNotifPanel(false);
    const { action } = n;
    if (action.vehicle) openVehicle(action.vehicle);
    else if (action.accident) openAccident(action.accident);
    else if (action.view) {
      if (action.tab) state.insTab = action.tab;
      renderInsurance();
      navigate(action.view);
    }
  };

  // A live demo event: a new traffic violation arrives while the client is watching
  const simulateLiveEvent = () => {
    const pool = VEHICLES.filter((v) => v.status === "active" && v.driverId);
    const v = pool[Math.floor(Math.random() * pool.length)];
    const x = { id: String(48220000 + Math.floor(Math.random() * 9000)), vehicleId: v.id, date: TODAY, type: "تجاوز السرعة المحددة", amount: 300, status: "unpaid" };
    violations.unshift(x);
    renderAll();
    pushNotification({ kind: "vio", iconName: "receipt", c: "c-warning", title: "مخالفة جديدة", text: `سُجلت مخالفة ${x.type} على ${v.id} بقيمة ${fmtMoney(x.amount)}`, action: { view: "violations" } });
    toast("مخالفة جديدة", `${v.id} · ${x.type}`, "notify");
  };

  /* =========================================================
     Global search
     ========================================================= */
  const topbar = $("#topbar");
  const gsWrap = $("#globalSearch");
  const gsInput = $("#globalSearchInput");
  const gsResults = $("#searchResults");
  let gsIndex = -1;

  const closeSearch = () => {
    gsResults.classList.remove("open");
    gsIndex = -1;
  };

  const renderSearch = () => {
    const q = gsInput.value;
    if (!q.trim()) return closeSearch();
    const matches = VEHICLES.filter((v) => matchVehicle(v, q));
    gsIndex = -1;
    gsResults.innerHTML = matches.length
      ? matches
          .slice(0, 6)
          .map((v) => {
            const d = driverOf(v);
            return `<button type="button" role="option" data-open-vehicle="${v.id}">
              ${plateHTML(v.plate)}
              <span class="search-results__meta"><b><span class="vid">${v.id}</span> · ${esc(v.model)}</b><small>${v.project}${d ? ` · ${d.name}` : ""}</small></span>
              ${statusBadge(v.status)}
            </button>`;
          })
          .join("") +
        `<button type="button" class="search-results__all" data-action="search-all">عرض كل النتائج (${matches.length}) في صفحة المركبات</button>`
      : `<div class="search-results__empty">لا توجد نتائج لـ «${esc(q)}»</div>`;
    gsResults.classList.add("open");
  };

  const searchAll = () => {
    state.filter = { q: gsInput.value, status: "all", project: "all", type: "all" };
    closeSearch();
    topbar.classList.remove("search-open");
    gsInput.blur();
    renderVehicles();
    navigate("vehicles");
  };

  gsInput.addEventListener("input", renderSearch);
  gsInput.addEventListener("focus", renderSearch);
  gsInput.addEventListener("keydown", (e) => {
    const items = $$("button", gsResults);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      gsIndex = (gsIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((b, i) => b.classList.toggle("focused", i === gsIndex));
      items[gsIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (gsIndex >= 0 && items[gsIndex]) items[gsIndex].click();
      else if (gsInput.value.trim()) searchAll();
    } else if (e.key === "Escape") {
      closeSearch();
      gsInput.blur();
    }
  });

  $("#searchToggle").addEventListener("click", () => {
    const open = !topbar.classList.contains("search-open");
    topbar.classList.toggle("search-open", open);
    if (open) gsInput.focus();
    else closeSearch();
  });

  /* =========================================================
     Theme & settings
     ========================================================= */
  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    $('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#0b0f1a" : "#f3f5fa");
    try {
      localStorage.setItem("fleetpro-theme", theme);
    } catch (e) {}
    const sw = $("#settingsForm").elements.dark;
    if (sw) sw.checked = theme === "dark";
  };
  const currentTheme = () => document.documentElement.getAttribute("data-theme") || "dark";

  $("#themeToggle").addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    toast(currentTheme() === "dark" ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح", "", "notify");
  });

  const settingsForm = $("#settingsForm");
  const fillSettings = () => {
    const f = settingsForm.elements;
    const s = state.settings;
    f.company.value = s.company;
    f.email.value = s.email;
    f.city.value = s.city;
    f.interval.value = s.interval;
    f.notifyMaint.checked = s.notifyMaint;
    f.notifyIns.checked = s.notifyIns;
    f.weekly.checked = s.weekly;
    f.dark.checked = currentTheme() === "dark";
  };

  const saveSettings = () => {
    try {
      localStorage.setItem("fleetpro-settings", JSON.stringify(state.settings));
    } catch (e) {}
  };

  settingsForm.elements.dark.addEventListener("change", (e) => applyTheme(e.target.checked ? "dark" : "light"));

  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = settingsForm.elements;
    if (!f.company.value.trim()) {
      f.company.focus();
      toast("اسم الشركة مطلوب", "", "danger");
      return;
    }
    const interval = Math.min(365, Math.max(30, Number(f.interval.value) || 90));
    state.settings = {
      company: f.company.value.trim(),
      email: f.email.value.trim(),
      city: f.city.value,
      interval,
      notifyMaint: f.notifyMaint.checked,
      notifyIns: f.notifyIns.checked,
      weekly: f.weekly.checked,
    };
    f.interval.value = interval;
    saveSettings();
    renderAll();
    toast("تم حفظ الإعدادات", "تم تطبيق التفضيلات الجديدة على النظام");
  });

  $("#resetSettings").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    applyTheme("dark");
    fillSettings();
    renderAll();
    toast("تمت استعادة الإعدادات الافتراضية", "", "notify");
  });

  /* =========================================================
     Vehicle filters
     ========================================================= */
  $("#vehicleSearch").addEventListener("input", (e) => {
    state.filter.q = e.target.value;
    renderVehicles();
  });
  $("#filterProject").addEventListener("change", (e) => {
    state.filter.project = e.target.value;
    renderVehicles();
  });
  $("#filterType").addEventListener("change", (e) => {
    state.filter.type = e.target.value;
    renderVehicles();
  });
  $("#resetFilters").addEventListener("click", () => {
    state.filter = { q: "", status: "all", project: "all", type: "all" };
    state.sort = { key: "id", dir: 1 };
    renderVehicles();
  });
  $("#driverSearch").addEventListener("input", (e) => {
    state.driverQ = e.target.value;
    renderDrivers();
  });

  /* =========================================================
     Delegated clicks
     ========================================================= */
  const ACTIONS = {
    "add-vehicle": () => openAddVehicle(),
    "view-vehicle": (el) => openVehicle(el.dataset.id),
    schedule: (el) => openSchedule(el.dataset.id),
    complete: (el) => completeMaintenance(el.dataset.id),
    renew: (el) => renewInsurance(el.dataset.id),
    pay: (el) => setViolationStatus(el.dataset.id, "paid"),
    object: (el) => setViolationStatus(el.dataset.id, "objected"),
    "add-accident": () => openAddAccident(),
    "view-accident": (el) => openAccident(el.dataset.id),
    assign: (el) => openAssign(el.dataset.id),
    export: (el) => exportCSV(el.dataset.report),
    "view-report": (el) => openReport(el.dataset.report),
    "search-all": () => searchAll(),
  };

  document.addEventListener("click", (e) => {
    const t = e.target;

    if (!t.closest(".notif")) setNotifPanel(false);
    if (!t.closest("#globalSearch") && !t.closest("#searchToggle")) closeSearch();

    const notif = t.closest("[data-notif]");
    if (notif) return handleNotification(notif.dataset.notif);

    const action = t.closest("[data-action]");
    if (action) {
      e.preventDefault();
      return ACTIONS[action.dataset.action](action);
    }

    const sortTh = t.closest("th[data-sort]");
    if (sortTh) {
      const key = sortTh.dataset.sort;
      state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : 1 };
      return renderVehicles();
    }

    const tab = t.closest("[data-tab]");
    if (tab) {
      const { tab: group, value } = tab.dataset;
      if (group === "status") state.filter.status = value;
      if (group === "ins") state.insTab = value;
      if (group === "vio") state.vioTab = value;
      renderVehicles();
      renderInsurance();
      renderViolations();
      if (tab.dataset.view) {
        e.preventDefault();
        navigate(tab.dataset.view);
      }
      return;
    }

    const viewLink = t.closest("[data-view]");
    if (viewLink) {
      e.preventDefault();
      if (viewLink.dataset.status) {
        state.filter = { q: "", status: viewLink.dataset.status, project: "all", type: "all" };
        renderVehicles();
      }
      return navigate(viewLink.dataset.view);
    }

    const vehicleEl = t.closest("[data-open-vehicle]");
    if (vehicleEl) {
      closeSearch();
      topbar.classList.remove("search-open");
      return openVehicle(vehicleEl.dataset.openVehicle);
    }

    const accEl = t.closest("[data-open-accident]");
    if (accEl) return openAccident(accEl.dataset.openAccident);
  });

  // Keyboard: open focused rows with Enter, shortcuts, and focus trap for the modal
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    if (e.key === "Enter" && !typing) {
      const row = e.target.closest && e.target.closest("[data-open-vehicle], [data-open-accident]");
      if (row && row === e.target) {
        e.preventDefault();
        row.click();
      }
    }

    if (e.key === "/" && !typing && !modal.classList.contains("open")) {
      e.preventDefault();
      if (window.innerWidth <= 760) topbar.classList.add("search-open");
      gsInput.focus();
    }

    if (e.key === "Escape") {
      if (modal.classList.contains("open")) closeModal();
      else if (notifPanel.classList.contains("open")) setNotifPanel(false);
      else if (sidebar.classList.contains("open")) setSidebar(false);
      else if (topbar.classList.contains("search-open")) topbar.classList.remove("search-open");
    }

    if (e.key === "Tab" && modal.classList.contains("open")) {
      const focusable = $$('button:not([disabled]), a[href], input, select, textarea', modalDialog).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modalDialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderFuelChart();
      if (!isCompact() && sidebar.classList.contains("open")) setSidebar(false);
    }, 150);
  });

  /* =========================================================
     Init
     ========================================================= */
  buildNotifications();
  renderAll();
  fillSettings();
  showView(location.hash.slice(1));
  setTimeout(simulateLiveEvent, 25000);
})();
