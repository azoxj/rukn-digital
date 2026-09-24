/* =========================================================
   ClinicFlow — نظام إدارة العيادات
   Portfolio demo: every record is fictional and lives in memory.
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
  const daysFrom = (d) => Math.round((d - TODAY) / DAY);

  const LOCALE = "ar-SA-u-ca-gregory-nu-latn";
  const FMT = {
    date: new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" }),
    short: new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }),
    long: new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    weekday: new Intl.DateTimeFormat(LOCALE, { weekday: "long" }),
    weekdayShort: new Intl.DateTimeFormat(LOCALE, { weekday: "short" }),
    month: new Intl.DateTimeFormat(LOCALE, { month: "short" }),
  };
  const fmtDate = (d) => FMT.date.format(d);
  const dayLabel = (d) => {
    const n = daysFrom(d);
    return n === 0 ? "اليوم" : n === 1 ? "غدًا" : n === -1 ? "أمس" : FMT.short.format(d);
  };
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fmtTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
  };
  const stamp = (a) => a.date.getTime() + toMin(a.time) * 60000;
  const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
  const fmtMoney = (n) => `${fmtNum(n)} ر.س`;
  const fmtK = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n)));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (name) => `<svg class="i"><use href="#i-${name}"/></svg>`;

  const dayPhrase = (n) => (n === 1 ? "يوم" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يومًا`);
  const relDays = (n) => (n === 0 ? "اليوم" : n > 0 ? `بعد ${dayPhrase(n)}` : `منذ ${dayPhrase(-n)}`);
  const ago = (date) => {
    const m = Math.max(0, Math.round((Date.now() - date) / 60000));
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m === 1 ? "دقيقة" : m === 2 ? "دقيقتين" : m <= 10 ? `${m} دقائق` : `${m} دقيقة`}`;
    const h = Math.round(m / 60);
    if (h < 24) return `منذ ${h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? `${h} ساعات` : `${h} ساعة`}`;
    return `منذ ${dayPhrase(Math.round(h / 24))}`;
  };

  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[ً-ٟـ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();
  const matches = (hay, q) => normalize(q).split(" ").filter(Boolean).every((w) => normalize(hay).includes(w));

  const hue = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const initials = (name) => {
    const words = name.replace(/^د\.\s*/, "").split(" ").filter(Boolean);
    const first = words[0];
    const last = words.length > 1 ? words[words.length - 1].replace(/^ال/, "") : "";
    return last ? `${first[0]}.${last[0]}` : first[0];
  };
  const avatar = (name, cls = "") => `<span class="avatar ${cls}" style="--h:${hue(name)}">${esc(initials(name))}</span>`;

  // Deterministic pseudo-random numbers so the demo looks the same on every load
  const mulberry32 = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rnd = mulberry32(240924);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  /* =========================================================
     Demo data (fictional)
     ========================================================= */
  const CLINICS = [
    { id: "general", name: "العيادة العامة", icon: "stethoscope", tone: "tone-teal", floor: "الدور الأرضي", capacity: 5, types: ["كشف جديد", "متابعة", "فحص دوري", "استشارة"] },
    { id: "dental", name: "عيادة الأسنان", icon: "tooth", tone: "tone-sky", floor: "الدور الأول", capacity: 6, types: ["كشف أسنان", "تنظيف أسنان", "حشو أسنان", "متابعة تقويم"] },
    { id: "derma", name: "العيادة الجلدية", icon: "drop", tone: "tone-violet", floor: "الدور الأول", capacity: 4, types: ["استشارة جلدية", "جلسة علاجية", "متابعة"] },
    { id: "pediatric", name: "عيادة الأطفال", icon: "smile", tone: "tone-amber", floor: "الدور الأرضي", capacity: 6, types: ["كشف أطفال", "تطعيم", "متابعة نمو"] },
    { id: "internal", name: "العيادة الباطنية", icon: "pulse", tone: "tone-rose", floor: "الدور الثاني", capacity: 4, types: ["كشف باطنية", "متابعة", "استشارة"] },
  ];
  const PRICES = {
    "كشف جديد": 250, "متابعة": 150, "فحص دوري": 200, "استشارة": 200,
    "كشف أسنان": 200, "تنظيف أسنان": 300, "حشو أسنان": 450, "متابعة تقويم": 350,
    "استشارة جلدية": 300, "جلسة علاجية": 600,
    "كشف أطفال": 220, "تطعيم": 120, "متابعة نمو": 150, "كشف باطنية": 280,
  };
  const PAY_METHODS = ["مدى", "بطاقة ائتمانية", "نقدًا", "تأمين", "Apple Pay"];

  const DOCTORS = [
    ["d1", "د. سارة القحطاني", "طب الأسرة", "general", "متاح", 4.9, 12, -900],
    ["d2", "د. خالد العمري", "طب الأسنان", "dental", "مشغول", 4.7, 9, -700],
    ["d3", "د. ريم الشهري", "تقويم الأسنان", "dental", "متاح", 4.8, 7, -500],
    ["d4", "د. فيصل الدوسري", "الأمراض الجلدية", "derma", "غير متاح", 4.6, 11, -800],
    ["d5", "د. نورة السبيعي", "طب الأطفال", "pediatric", "مشغول", 4.9, 14, -1000],
    ["d6", "د. عبدالرحمن الحربي", "طب الأطفال", "pediatric", "متاح", 4.5, 6, -300],
    ["d7", "د. منى الزهراني", "الطب الباطني", "internal", "متاح", 4.8, 10, -650],
    ["d8", "د. ماجد العتيبي", "الطب العام", "general", "مشغول", 4.4, 4, -12],
  ].map(([id, name, specialty, clinicId, status, rating, experience, joined]) => ({
    id, name, specialty, clinicId, status, rating, experience, joinedAt: addDays(joined),
  }));

  // [name, age, gender, status, registered (days from today), admin note]
  const PATIENTS = [
    ["عبدالله محمد الشمري", 34, "ذكر", "نشط", -620, "يفضّل التواصل عبر واتساب."],
    ["نوف سعد العتيبي", 28, "أنثى", "نشط", -410, "تفضّل المواعيد المسائية بعد الساعة 5 م."],
    ["تركي فهد القحطاني", 45, "ذكر", "تحت المتابعة", -700, "مشمول بتأمين الشركة — التحقق من البطاقة عند الحضور."],
    ["لمى خالد الدوسري", 7, "أنثى", "نشط", -380, "ولي الأمر: الأب — التواصل بخصوص المواعيد عبر رقمه."],
    ["سلمان ناصر الحربي", 61, "ذكر", "تحت المتابعة", -820, "يحتاج تذكيرًا بالموعد قبل يوم."],
    ["هيفاء عبدالعزيز المالكي", 39, "أنثى", "نشط", -300, ""],
    ["يزيد عمر الغامدي", 12, "ذكر", "نشط", -260, "ولي الأمر: الأم."],
    ["رهف ماجد الشهري", 23, "أنثى", "جديد", -18, "سُجّلت عبر الحجز الإلكتروني."],
    ["بدر سلطان العنزي", 52, "ذكر", "غير نشط", -900, "لم يحضر آخر موعدين."],
    ["أمل حمد السبيعي", 47, "أنثى", "نشط", -540, ""],
    ["فارس عادل الزهراني", 5, "ذكر", "نشط", -200, "ولي الأمر: الأب — يفضّل الفترة الصباحية."],
    ["جود فيصل المطيري", 31, "أنثى", "جديد", -9, "محوّلة من فرع جدة."],
    ["مشعل راشد البقمي", 29, "ذكر", "نشط", -150, ""],
    ["ريما صالح العمري", 36, "أنثى", "تحت المتابعة", -470, "تفضّل التواصل بالبريد الإلكتروني."],
    ["عمر يوسف الرشيدي", 68, "ذكر", "نشط", -1000, "يُرجى تجهيز كرسي متحرك عند الوصول."],
    ["شهد بندر الجهني", 19, "أنثى", "نشط", -120, ""],
    ["ناصر إبراهيم القرني", 41, "ذكر", "غير نشط", -760, ""],
    ["غادة طلال الحارثي", 55, "أنثى", "نشط", -330, "مشمولة بتأمين خاص."],
    ["إياد مازن الأحمدي", 9, "ذكر", "جديد", -4, "ولي الأمر: الأم — أول زيارة."],
    ["دانة وليد السهلي", 26, "أنثى", "نشط", -90, ""],
  ].map(([name, age, gender, status, registered, note], i) => ({
    id: `CF-${10231 + i}`,
    name, age, gender, status,
    registered: addDays(registered),
    phone: `05${String((i * 48271 + 12345) * 97 % 89999999 + 10000000).slice(0, 8)}`,
    notes: note ? [{ text: note, at: addDays(registered), by: "الاستقبال" }] : [],
  }));

  const SLOTS = [];
  for (let m = 8 * 60; m < 22 * 60; m += 30) SLOTS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  const FRIDAY_SLOTS = SLOTS.filter((t) => toMin(t) >= 16 * 60);

  const canSee = (doctor, patient) => {
    if (doctor.clinicId === "pediatric") return patient.age < 15;
    if (doctor.clinicId === "dental") return true;
    return patient.age >= 15;
  };

  // Generate ~60 days of history and two weeks of bookings
  const APPTS = [];
  let apptSeq = 5000;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const TODAY_PLAN = { general: 4, dental: 4, pediatric: 3, internal: 2 };

  const makeAppt = (off, doctor, time, used) => {
    const day = addDays(off);
    const key = `${doctor.id}${time}`;
    if (used.has(key) || day < doctor.joinedAt) return false;
    const eligible = PATIENTS.filter(
      (p) => canSee(doctor, p) && daysFrom(p.registered) <= off && !(p.status === "غير نشط" && off > -40)
    );
    if (!eligible.length) return false;
    const patient = pick(eligible);
    const clinic = CLINICS.find((c) => c.id === doctor.clinicId);
    const roll = rnd();
    let status;
    if (off < 0 || (off === 0 && toMin(time) < nowMin)) status = roll < 0.9 ? "مكتمل" : "ملغي";
    else if (off === 0) status = roll < 0.7 ? "مؤكد" : "بانتظار التأكيد";
    else status = roll < 0.08 ? "ملغي" : roll < 0.62 ? "مؤكد" : "بانتظار التأكيد";
    used.add(key);
    APPTS.push({
      id: `AP-${++apptSeq}`,
      patientId: patient.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      date: day,
      time,
      type: pick(clinic.types),
      status,
      notes: rnd() < 0.15 ? pick(["أول زيارة للمجمع.", "طلب المريض موعدًا مسائيًا.", "تم الحجز عبر الهاتف.", "الحجز عبر التطبيق."]) : "",
    });
    return true;
  };

  for (let off = -60; off <= 14; off++) {
    const day = addDays(off);
    const isFriday = day.getDay() === 5;
    const slots = isFriday ? FRIDAY_SLOTS : SLOTS;
    const used = new Set();
    if (off === 0) {
      Object.entries(TODAY_PLAN).forEach(([clinicId, count]) => {
        const docs = DOCTORS.filter((d) => d.clinicId === clinicId && d.status !== "غير متاح");
        let guard = 0;
        while (count > 0 && guard++ < 40) if (makeAppt(0, pick(docs), pick(slots), used)) count -= 1;
      });
      continue;
    }
    // The clinic has been growing: the latest month is a little busier than the one before
    let n = (isFriday ? 2 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 4)) + (off >= -30 ? 1 : 0);
    if (off > 0) n = Math.max(1, Math.round(n * (1 - off / 18)));
    let guard = 0;
    while (n > 0 && guard++ < 60) {
      const doctor = pick(DOCTORS);
      if (doctor.status === "غير متاح" && off >= 0 && off <= 3) continue;
      if (makeAppt(off, doctor, pick(slots), used)) n -= 1;
    }
  }
  APPTS.sort((a, b) => stamp(a) - stamp(b));

  const INVOICES = [];
  let invSeq = 24000;
  APPTS.forEach((a) => {
    const off = daysFrom(a.date);
    if (a.status === "مكتمل") {
      INVOICES.push({
        id: `INV-${++invSeq}`, apptId: a.id, patientId: a.patientId, service: a.type, amount: PRICES[a.type],
        date: a.date, status: off >= -4 && rnd() < 0.5 ? "معلقة" : "مدفوعة", method: pick(PAY_METHODS),
      });
    } else if (a.status === "ملغي" && off < 0 && rnd() < 0.3) {
      INVOICES.push({
        id: `INV-${++invSeq}`, apptId: a.id, patientId: a.patientId, service: a.type, amount: PRICES[a.type],
        date: a.date, status: "ملغاة", method: "—",
      });
    }
  });

  /* =========================================================
     Status metadata
     ========================================================= */
  const APPT_STATUS = { "مؤكد": "tone-sky", "بانتظار التأكيد": "tone-amber", "مكتمل": "tone-green", "ملغي": "tone-rose" };
  const INV_STATUS = { "مدفوعة": "tone-green", "معلقة": "tone-amber", "ملغاة": "tone-rose" };
  const PATIENT_STATUS = { "نشط": "tone-green", "تحت المتابعة": "tone-sky", "جديد": "tone-violet", "غير نشط": "tone-gray" };
  const DOCTOR_STATUS = { "متاح": "tone-green", "مشغول": "tone-amber", "غير متاح": "tone-gray" };
  const CLINIC_STATUS = { "متاحة": "tone-green", "مزدحمة": "tone-amber", "مغلقة": "tone-gray" };
  const badge = (label, tone) => `<span class="badge ${tone || ""}">${esc(label)}</span>`;

  /* =========================================================
     State & settings
     ========================================================= */
  const DEFAULT_SETTINGS = {
    name: "مجمع رعاية الطبي",
    email: "info@riaya-clinic.sa",
    open: "08:00",
    close: "22:00",
    duration: "30",
    reminders: true,
    notifyNew: true,
    notifyInvoices: true,
  };
  const loadSettings = () => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("clinicflow-settings") || "{}") };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  };

  const state = {
    view: "dashboard",
    patients: { q: "", status: "all", gender: "all", sort: "file", dir: 1, page: 1 },
    appts: { q: "", status: "all", doctor: "all", scope: "week", page: 1 },
    invoices: { q: "", status: "all", page: 1 },
    doctorsTab: "all",
    notifTab: "all",
    settings: loadSettings(),
    notifications: [],
  };

  /* =========================================================
     Selectors
     ========================================================= */
  const findPatient = (id) => PATIENTS.find((p) => p.id === id);
  const findDoctor = (id) => DOCTORS.find((d) => d.id === id);
  const findClinic = (id) => CLINICS.find((c) => c.id === id);
  const findAppt = (id) => APPTS.find((a) => a.id === id);
  const findInvoice = (id) => INVOICES.find((x) => x.id === id);
  const invoiceOf = (appt) => INVOICES.find((x) => x.apptId === appt.id && x.status !== "ملغاة");

  const isActive = (a) => a.status !== "ملغي";
  const isOpen = (a) => a.status === "مؤكد" || a.status === "بانتظار التأكيد";
  const inDays = (d, from, to) => {
    const n = daysFrom(d);
    return n >= from && n <= to;
  };
  const upcoming = (list = APPTS) => list.filter((a) => isOpen(a) && stamp(a) >= Date.now()).sort((a, b) => stamp(a) - stamp(b));
  const patientAppts = (p) => APPTS.filter((a) => a.patientId === p.id);
  const lastVisit = (p) =>
    patientAppts(p).filter((a) => a.status === "مكتمل").sort((a, b) => stamp(b) - stamp(a))[0] || null;
  const weekStart = () => addDays(-((TODAY.getDay() + 1) % 7)); // weeks start on Saturday

  const doctorToday = (d) => APPTS.filter((a) => a.doctorId === d.id && daysFrom(a.date) === 0 && isActive(a));
  const clinicDoctors = (c) => DOCTORS.filter((d) => d.clinicId === c.id);
  const clinicToday = (c) => APPTS.filter((a) => a.clinicId === c.id && daysFrom(a.date) === 0 && isActive(a)).length;
  const clinicStatus = (c) => {
    if (clinicDoctors(c).every((d) => d.status === "غير متاح")) return "مغلقة";
    return clinicToday(c) / c.capacity >= 0.75 ? "مزدحمة" : "متاحة";
  };

  const paidBetween = (from, to) => sum(INVOICES.filter((x) => x.status === "مدفوعة" && inDays(x.date, from, to)).map((x) => x.amount));
  const apptsBetween = (from, to) => APPTS.filter((a) => inDays(a.date, from, to));

  /* =========================================================
     Chart helpers (plain HTML / CSS / SVG)
     ========================================================= */
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const mag = 10 ** Math.floor(Math.log10(v));
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= v);
  };

  const renderBars = (el, legendEl, labels, series, data, { todayIndex = -1, extra = () => "" } = {}) => {
    const totals = labels.map((_, i) => sum(series.map((s) => data[s.key][i])));
    const max = Math.max(4, Math.ceil(Math.max(...totals) / 4) * 4);
    const grid = [4, 3, 2, 1, 0].map((k) => `<span data-v="${(max * k) / 4}"></span>`).join("");
    const cols = labels
      .map((label, i) => {
        const edge = i === 0 ? "edge-r" : i === labels.length - 1 ? "edge-l" : "";
        return `<div class="bars__col ${edge} ${i === todayIndex ? "is-today" : ""}" tabindex="0" aria-label="${label}: ${totals[i]}">
          <div class="tooltip"><b>${label}</b>${series
            .map((s) => `<span><em>${s.label}</em><strong>${data[s.key][i]}</strong></span>`)
            .join("")}${extra(i)}</div>
          ${series
            .map((s) => `<div class="bars__seg" style="--c:${s.color};height:${((data[s.key][i] / max) * 100).toFixed(2)}%;animation-delay:${i * 60}ms"></div>`)
            .join("")}
        </div>`;
      })
      .join("");
    el.innerHTML = `<div class="bars__plot"><div class="bars__grid">${grid}</div>${cols}</div>
      <div class="bars__labels">${labels.map((l, i) => `<span class="${i === todayIndex ? "is-today" : ""}">${l}</span>`).join("")}</div>`;
    if (legendEl) legendEl.innerHTML = series.map((s) => `<span><i style="--c:${s.color}"></i>${s.label}</span>`).join("");
  };

  const smoothPath = (pts) =>
    pts.reduce((d, [x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
    }, "");

  const renderArea = (el, labels, values, unit) => {
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!W || !H) return;
    const pad = { t: 22, r: 22, b: 30, l: 44 };
    const max = niceMax(Math.max(...values) * 1.15);
    const n = values.length;
    const step = (W - pad.l - pad.r) / (n - 1);
    const x = (i) => W - pad.r - i * step; // oldest on the right (RTL)
    const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    const pts = values.map((v, i) => [+x(i).toFixed(1), +y(v).toFixed(1)]);
    const line = smoothPath(pts);
    const base = H - pad.b;
    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="${unit}">
        <defs><linearGradient id="cfArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#14b8a6" stop-opacity="0.32"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/>
        </linearGradient></defs>
        ${[0, 1, 2, 3, 4]
          .map((k) => {
            const gy = y((max * k) / 4);
            return `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}"/><text class="axis" x="2" y="${gy + 4}">${fmtK((max * k) / 4)}</text>`;
          })
          .join("")}
        <path class="area" d="${line} L${pts[n - 1][0]},${base} L${pts[0][0]},${base} Z"/>
        <path class="line" d="${line}"/>
        <line class="cursor" x1="0" x2="0" y1="${pad.t}" y2="${base}"/>
        ${pts.map(([px, py], i) => `<circle class="dot" cx="${px}" cy="${py}" r="4.5" data-i="${i}"/>`).join("")}
        ${pts.map(([px], i) => `<text class="axis" x="${px}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>`).join("")}
      </svg>
      <div class="tooltip"></div>`;

    const svg = $("svg", el);
    const tip = $(".tooltip", el);
    const cursor = $(".cursor", el);
    const dots = $$(".dot", el);
    const show = (i) => {
      const [px, py] = pts[i];
      dots.forEach((d, k) => d.classList.toggle("active", k === i));
      cursor.setAttribute("x1", px);
      cursor.setAttribute("x2", px);
      cursor.classList.add("show");
      tip.innerHTML = `<b>${labels[i]}</b><span><em>${unit}</em><strong>${fmtNum(values[i])}</strong></span>${
        i > 0 ? `<span><em>التغيّر</em><strong>${pct(values[i], values[i - 1]) >= 0 ? "+" : ""}${pct(values[i], values[i - 1])}%</strong></span>` : ""
      }`;
      const tw = tip.offsetWidth || 140;
      tip.style.left = `${Math.min(Math.max(px, tw / 2 + 4), W - tw / 2 - 4)}px`;
      tip.style.top = `${Math.max(0, py - 78)}px`;
      tip.classList.add("show");
    };
    const hide = () => {
      tip.classList.remove("show");
      cursor.classList.remove("show");
      dots.forEach((d) => d.classList.remove("active"));
    };
    svg.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      let best = 0;
      pts.forEach(([px], i) => {
        if (Math.abs(px - mx) < Math.abs(pts[best][0] - mx)) best = i;
      });
      show(best);
    });
    svg.addEventListener("pointerleave", hide);
  };

  const renderDonut = (el, segments, center) => {
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
      <div class="donut" style="background:conic-gradient(${stops})"><div class="donut__center"><b>${fmtNum(total)}</b><small>${center}</small></div></div>
      <ul class="donut-legend">${segments
        .map((s) => `<li><i style="--c:${s.color}"></i>${s.label}<b>${fmtNum(s.value)}</b><small>${Math.round((s.value / total) * 100)}%</small></li>`)
        .join("")}</ul>`;
  };

  const renderHBars = (el, items) => {
    el.innerHTML = items
      .map(
        (it, i) => `<div class="hbar">
          <div class="hbar__top"><span>${it.label}</span><b>${it.valueLabel}</b></div>
          <div class="hbar__track"><div class="hbar__fill" style="--c:${it.color || "var(--brand)"};width:${it.pct}%;animation-delay:${i * 70}ms"></div></div>
        </div>`
      )
      .join("");
  };

  const sparkbars = (values) => {
    const max = Math.max(...values) || 1;
    return `<div class="sparkbars" aria-hidden="true">${values
      .map((v, i) => `<span style="height:${Math.max(8, (v / max) * 100)}%;animation-delay:${i * 50}ms"></span>`)
      .join("")}</div>`;
  };

  const changeChip = (value) =>
    `<span class="chip ${value >= 0 ? "tone-green" : "tone-rose"}">${icon(value >= 0 ? "up" : "down")}${Math.abs(value)}%</span>`;

  /* =========================================================
     Shared templates
     ========================================================= */
  const personCell = (p, sub) =>
    `<div class="person">${avatar(p.name, "avatar--sm")}<div class="person__text"><b>${esc(p.name)}</b><small>${sub}</small></div></div>`;

  const segHTML = (group, current, items) =>
    items
      .map(
        ([value, label, count]) =>
          `<button type="button" class="seg ${value === current ? "active" : ""}" role="tab" aria-selected="${value === current}" data-seg="${group}" data-value="${value}">${label}${count !== undefined ? `<em>${count}</em>` : ""}</button>`
      )
      .join("");

  const emptyRow = (cols, text) =>
    `<tr class="empty"><td colspan="${cols}"><div class="empty-state">${icon("inbox")}${text}</div></td></tr>`;

  const PAGE_SIZE = 10;
  const paginate = (list, key) => {
    const s = state[key];
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    s.page = Math.min(Math.max(1, s.page), pages);
    return { rows: list.slice((s.page - 1) * PAGE_SIZE, s.page * PAGE_SIZE), pages, page: s.page };
  };
  const pagerHTML = (key, page, pages, total, noun) => {
    const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(page * PAGE_SIZE, total);
    let nums = [];
    if (pages <= 7) nums = Array.from({ length: pages }, (_, i) => i + 1);
    else {
      nums = [1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages);
      nums = [...new Set(nums)].sort((a, b) => a - b);
      nums = nums.reduce((acc, n, i) => (i && n - nums[i - 1] > 1 ? [...acc, "…", n] : [...acc, n]), []);
    }
    return `<span>عرض ${from}–${to} من ${total} ${noun}</span>
      <div class="pager">
        <button type="button" data-page="${key}:${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="الصفحة السابقة">${icon("chevron").replace('class="i"', 'class="i flip"')}</button>
        ${nums.map((n) => (n === "…" ? `<button type="button" disabled>…</button>` : `<button type="button" class="${n === page ? "active" : ""}" data-page="${key}:${n}" aria-label="صفحة ${n}">${n}</button>`)).join("")}
        <button type="button" data-page="${key}:${page + 1}" ${page >= pages ? "disabled" : ""} aria-label="الصفحة التالية">${icon("chevron")}</button>
      </div>`;
  };

  /* =========================================================
     Dashboard
     ========================================================= */
  const renderDashboard = () => {
    const hour = new Date().getHours();
    const today = APPTS.filter((a) => daysFrom(a.date) === 0 && isActive(a));
    const pendingToday = today.filter((a) => a.status === "بانتظار التأكيد").length;
    $("#greeting").textContent = `${hour < 12 ? "صباح الخير" : "مساء الخير"}، ريم 👋`;
    $("#greetingSub").textContent = `لديك ${today.length} مواعيد اليوم في ${state.settings.name}${pendingToday ? ` — ${pendingToday} منها بانتظار التأكيد` : ""}.`;

    // KPI: patients
    const new30 = PATIENTS.filter((p) => inDays(p.registered, -29, 0)).length;
    const patientGrowth = PATIENTS.length - new30 ? Math.round((new30 / (PATIENTS.length - new30)) * 100) : 0;
    const monthlyTotals = Array.from({ length: 7 }, (_, i) => {
      const end = new Date(TODAY.getFullYear(), TODAY.getMonth() - 6 + i + 1, 0);
      return PATIENTS.filter((p) => p.registered <= end).length;
    });
    // KPI: appointments
    const month = apptsBetween(-29, 0).filter(isActive).length;
    const prevMonth = apptsBetween(-59, -30).filter(isActive).length;
    const last7 = Array.from({ length: 7 }, (_, i) => APPTS.filter((a) => daysFrom(a.date) === i - 6 && isActive(a)).length);
    // KPI: doctors
    const newDoctors = DOCTORS.filter((d) => inDays(d.joinedAt, -29, 0)).length;
    const available = DOCTORS.filter((d) => d.status === "متاح").length;
    // KPI: revenue
    const revenue = paidBetween(-29, 0);
    const prevRevenue = paidBetween(-59, -30);
    const weekly = Array.from({ length: 7 }, (_, i) => paidBetween(-7 * (7 - i) + 1, -7 * (6 - i)));
    const pending = INVOICES.filter((x) => x.status === "معلقة");

    const kpi = ({ label, value, unit = "", iconName, tone, chip, foot, spark, view }) => `
      <button class="kpi ${tone}" type="button" data-view="${view}">
        <div class="kpi__top"><span class="kpi__icon">${icon(iconName)}</span>${chip}</div>
        <span class="kpi__label">${label}</span>
        <span class="kpi__value">${value}${unit ? `<small>${unit}</small>` : ""}</span>
        <span class="kpi__foot">${foot}</span>
        ${sparkbars(spark)}
      </button>`;

    $("#kpis").innerHTML = [
      kpi({ label: "إجمالي المرضى", value: fmtNum(PATIENTS.length), iconName: "users", tone: "tone-teal", view: "patients",
        chip: changeChip(patientGrowth), foot: `+${new30} مريض جديد مقارنة بالشهر السابق`, spark: monthlyTotals }),
      kpi({ label: "مواعيد اليوم", value: today.length, iconName: "calendar", tone: "tone-sky", view: "appointments",
        chip: changeChip(pct(month, prevMonth)), foot: `${fmtNum(month)} موعدًا هذا الشهر مقارنة بـ ${fmtNum(prevMonth)}`, spark: last7 }),
      kpi({ label: "الأطباء", value: DOCTORS.length, iconName: "stethoscope", tone: "tone-violet", view: "doctors",
        chip: changeChip(DOCTORS.length - newDoctors ? Math.round((newDoctors / (DOCTORS.length - newDoctors)) * 100) : 0),
        foot: `${available} متاح الآن · +${newDoctors} هذا الشهر`, spark: DOCTORS.map((d) => doctorToday(d).length + 1) }),
      kpi({ label: "الإيرادات الشهرية", value: fmtNum(revenue), unit: "ر.س", iconName: "coin", tone: "tone-amber", view: "invoices",
        chip: changeChip(pct(revenue, prevRevenue)), foot: `آخر 30 يومًا · ${fmtMoney(sum(pending.map((x) => x.amount)))} معلقة`, spark: weekly }),
    ].join("");

    // Weekly appointments chart (Saturday → Friday)
    const start = weekStart();
    const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
    const byDay = (d, pred) => APPTS.filter((a) => daysFrom(a.date) === daysFrom(d) && pred(a)).length;
    const data = {
      done: days.map((d) => byDay(d, (a) => a.status === "مكتمل")),
      booked: days.map((d) => byDay(d, isOpen)),
      cancelled: days.map((d) => byDay(d, (a) => a.status === "ملغي")),
    };
    $("#weekRange").textContent = `${FMT.short.format(days[0])} – ${FMT.short.format(days[6])}`;
    renderBars(
      $("#weekChart"),
      $("#weekLegend"),
      days.map((d) => FMT.weekdayShort.format(d)),
      [
        { key: "done", label: "مكتملة", color: "var(--brand)" },
        { key: "booked", label: "مجدولة", color: "var(--sky)" },
      ],
      data,
      { todayIndex: days.findIndex((d) => daysFrom(d) === 0), extra: (i) => `<span><em>ملغاة</em><strong>${data.cancelled[i]}</strong></span>` }
    );

    // Monthly revenue (rolling 30-day windows, oldest first)
    const series = [prevRevenue * 0.78, prevRevenue * 0.85, prevRevenue * 0.9, prevRevenue * 0.95, prevRevenue, revenue].map(Math.round);
    const months = Array.from({ length: 6 }, (_, i) => FMT.month.format(new Date(TODAY.getFullYear(), TODAY.getMonth() - 5 + i, 1)));
    const change = pct(revenue, prevRevenue);
    const chip = $("#revenueChip");
    chip.className = `chip ${change >= 0 ? "tone-green" : "tone-rose"}`;
    chip.innerHTML = `${icon(change >= 0 ? "up" : "down")}${Math.abs(change)}%`;
    if (state.view === "dashboard") renderArea($("#revenueChart"), months, series, "الإيرادات (ر.س)");
    renderDashboard.revenueArgs = [months, series];

    // Upcoming appointments
    const next = upcoming().slice(0, 6);
    $("#upcomingList").innerHTML = next.length
      ? next
          .map((a) => {
            const p = findPatient(a.patientId);
            const d = findDoctor(a.doctorId);
            return `<li class="agenda__item" data-open="appt:${a.id}" tabindex="0">
              <div class="agenda__time"><b>${fmtTime(a.time).split(" ")[0]}</b><small>${fmtTime(a.time).split(" ")[1]} · ${dayLabel(a.date)}</small></div>
              <div class="list-body"><b>${esc(p.name)}</b><small>${d.name} · ${a.type}</small></div>
              <div class="list-side">${badge(a.status, APPT_STATUS[a.status])}${
                a.status === "بانتظار التأكيد"
                  ? `<button class="icon-btn icon-btn--sm" type="button" data-action="confirm-appt" data-id="${a.id}" data-tip="تأكيد" aria-label="تأكيد الموعد">${icon("check")}</button>`
                  : ""
              }</div>
            </li>`;
          })
          .join("")
      : `<li class="list-empty">لا توجد مواعيد قادمة</li>`;

    // Latest patients
    $("#recentPatients").innerHTML = [...PATIENTS]
      .sort((a, b) => b.registered - a.registered)
      .slice(0, 5)
      .map(
        (p) => `<li class="people__item" data-open="patient:${p.id}" tabindex="0">
          ${avatar(p.name)}
          <div class="list-body"><b>${esc(p.name)}</b><small><span class="code">${p.id}</span> · سُجّل ${relDays(daysFrom(p.registered))}</small></div>
          <div class="list-side">${badge(p.status, PATIENT_STATUS[p.status])}</div>
        </li>`
      )
      .join("");

    // Alerts
    const alerts = [];
    if (pending.length)
      alerts.push({ iconName: "receipt", tone: "tone-amber", title: `${pending.length} فواتير معلقة`, sub: `بإجمالي ${fmtMoney(sum(pending.map((x) => x.amount)))} بانتظار التحصيل`, go: `data-view="invoices" data-set="invoices.status=معلقة"` });
    const toConfirm = upcoming().filter((a) => a.status === "بانتظار التأكيد" && daysFrom(a.date) <= 1);
    if (toConfirm.length)
      alerts.push({ iconName: "clock", tone: "tone-sky", title: `${toConfirm.length} مواعيد تحتاج تأكيدًا`, sub: "مواعيد اليوم وغدًا بانتظار التأكيد", go: `data-view="appointments" data-set="appts.status=بانتظار التأكيد"` });
    DOCTORS.filter((d) => d.status === "غير متاح").forEach((d) =>
      alerts.push({ iconName: "stethoscope", tone: "tone-gray", title: `${d.name} غير متاح`, sub: `${findClinic(d.clinicId).name} — يُرجى إعادة توزيع المواعيد`, go: `data-open="doctor:${d.id}"` })
    );
    CLINICS.filter((c) => clinicStatus(c) === "مزدحمة").forEach((c) =>
      alerts.push({ iconName: "building", tone: "tone-rose", title: `${c.name} مزدحمة اليوم`, sub: `${clinicToday(c)} مواعيد من أصل ${c.capacity}`, go: `data-view="clinics"` })
    );
    $("#alertsList").innerHTML = alerts.length
      ? alerts
          .map(
            (al) => `<li class="alerts__item" ${al.go} tabindex="0">
              <span class="alerts__icon ${al.tone}">${icon(al.iconName)}</span>
              <div class="list-body"><b>${al.title}</b><small>${al.sub}</small></div>
              <span class="icon-btn icon-btn--sm">${icon("chevron")}</span>
            </li>`
          )
          .join("")
      : `<li class="list-empty">لا توجد تنبيهات — كل شيء على ما يرام</li>`;
  };

  /* =========================================================
     Patients
     ========================================================= */
  const filteredPatients = () => {
    const f = state.patients;
    const list = PATIENTS.filter(
      (p) =>
        (f.status === "all" || p.status === f.status) &&
        (f.gender === "all" || p.gender === f.gender) &&
        (!f.q.trim() || matches(`${p.name} ${p.id} ${p.phone}`, f.q))
    );
    const val = (p) => {
      if (f.sort === "lastVisit") return lastVisit(p) ? stamp(lastVisit(p)) : 0;
      if (f.sort === "age") return p.age;
      if (f.sort === "name") return p.name;
      return p.id;
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ar")) * f.dir;
    });
  };

  const fillSelect = (el, allLabel, values, current) => {
    el.innerHTML = [`<option value="all">${allLabel}</option>`, ...values.map((v) => {
      const [val, label] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(val)}">${esc(label)}</option>`;
    })].join("");
    el.value = current;
  };

  const renderPatients = () => {
    const f = state.patients;
    fillSelect($("#patientStatus"), "كل الحالات", Object.keys(PATIENT_STATUS), f.status);
    fillSelect($("#patientGender"), "الجنسان", ["ذكر", "أنثى"], f.gender);
    $("#patientSort").value = f.sort;
    if ($("#patientSearch").value !== f.q) $("#patientSearch").value = f.q;

    const list = filteredPatients();
    const { rows, pages, page } = paginate(list, "patients");
    const th = (key, label) =>
      key
        ? `<th data-sort="patients:${key}" class="${f.sort === key ? "sorted" : ""}" aria-sort="${f.sort === key ? (f.dir > 0 ? "ascending" : "descending") : "none"}">${label}${icon("sort")}</th>`
        : `<th>${label}</th>`;
    $("#patientsTable").innerHTML = `
      <thead><tr>${th("file", "رقم الملف")}${th("name", "اسم المريض")}${th("age", "العمر")}${th(null, "الجنس")}${th(null, "رقم الجوال")}${th("lastVisit", "آخر زيارة")}${th(null, "الحالة")}${th(null, "الإجراء")}</tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map((p) => {
                const lv = lastVisit(p);
                const visits = patientAppts(p).filter((a) => a.status === "مكتمل").length;
                return `<tr class="enter" data-open="patient:${p.id}" tabindex="0">
                  <td data-label="رقم الملف"><span class="code">${p.id}</span></td>
                  <td class="cell-main" data-label="اسم المريض">${personCell(p, `${visits} زيارات مكتملة`)}</td>
                  <td data-label="العمر">${p.age} سنة</td>
                  <td data-label="الجنس">${p.gender}</td>
                  <td data-label="رقم الجوال"><span class="num">${p.phone}</span></td>
                  <td data-label="آخر زيارة">${lv ? `<div class="person__text"><span>${fmtDate(lv.date)}</span><small>${relDays(daysFrom(lv.date))}</small></div>` : `<span class="dim">لا توجد زيارات</span>`}</td>
                  <td data-label="الحالة">${badge(p.status, PATIENT_STATUS[p.status])}</td>
                  <td class="cell-actions" data-label="الإجراء"><div class="row-actions">
                    <button class="icon-btn icon-btn--sm" type="button" data-open="patient:${p.id}" data-tip="عرض الملف" aria-label="عرض ملف ${esc(p.name)}">${icon("eye")}</button>
                    <button class="icon-btn icon-btn--sm" type="button" data-action="add-appointment" data-patient="${p.id}" data-tip="حجز موعد" aria-label="حجز موعد لـ ${esc(p.name)}">${icon("calendar-plus")}</button>
                  </div></td>
                </tr>`;
              })
              .join("")
          : emptyRow(8, "لا يوجد مرضى مطابقون للبحث أو الفلاتر")
      }</tbody>`;
    $("#patientsFoot").innerHTML = pagerHTML("patients", page, pages, list.length, "مريض");
  };

  /* =========================================================
     Appointments
     ========================================================= */
  const APPT_SCOPES = {
    today: { label: "اليوم", test: (a) => daysFrom(a.date) === 0, dir: 1 },
    week: { label: "هذا الأسبوع", test: (a) => inDays(a.date, daysFrom(weekStart()), daysFrom(weekStart()) + 6), dir: 1 },
    upcoming: { label: "القادمة", test: (a) => stamp(a) >= Date.now(), dir: 1 },
    past: { label: "السابقة", test: (a) => stamp(a) < Date.now(), dir: -1 },
    all: { label: "الكل", test: () => true, dir: -1 },
  };

  const filteredAppts = () => {
    const f = state.appts;
    const scope = APPT_SCOPES[f.scope];
    return APPTS.filter((a) => {
      if (!scope.test(a)) return false;
      if (f.status !== "all" && a.status !== f.status) return false;
      if (f.doctor !== "all" && a.doctorId !== f.doctor) return false;
      if (f.q.trim()) {
        const p = findPatient(a.patientId);
        const d = findDoctor(a.doctorId);
        return matches(`${a.id} ${p.name} ${p.id} ${d.name} ${a.type} ${findClinic(a.clinicId).name}`, f.q);
      }
      return true;
    }).sort((a, b) => (stamp(a) - stamp(b)) * scope.dir);
  };

  const apptActions = (a) => {
    let quick = "";
    if (a.status === "بانتظار التأكيد")
      quick = `<button class="icon-btn icon-btn--sm" type="button" data-action="confirm-appt" data-id="${a.id}" data-tip="تأكيد" aria-label="تأكيد الموعد ${a.id}">${icon("check")}</button>`;
    if (isOpen(a))
      quick += `<button class="icon-btn icon-btn--sm" type="button" data-action="edit-appt" data-id="${a.id}" data-tip="تعديل" aria-label="تعديل الموعد ${a.id}">${icon("edit")}</button>`;
    return `<div class="row-actions">${quick}<button class="icon-btn icon-btn--sm" type="button" data-menu="appt:${a.id}" data-tip="المزيد" aria-label="خيارات الموعد ${a.id}" aria-haspopup="true">${icon("dots")}</button></div>`;
  };

  const renderAppointments = () => {
    const f = state.appts;
    const weekFrom = daysFrom(weekStart());
    const today = APPTS.filter((a) => daysFrom(a.date) === 0 && isActive(a)).length;
    const awaiting = upcoming().filter((a) => a.status === "بانتظار التأكيد").length;
    const doneWeek = APPTS.filter((a) => a.status === "مكتمل" && inDays(a.date, weekFrom, weekFrom + 6)).length;
    const month = apptsBetween(-29, 0);
    const cancelRate = month.length ? Math.round((month.filter((a) => a.status === "ملغي").length / month.length) * 100) : 0;

    const mini = (label, value, iconName, tone) =>
      `<div class="mini ${tone}"><span class="mini__icon">${icon(iconName)}</span><div><b>${value}</b><span>${label}</span></div></div>`;
    $("#apptStats").innerHTML = [
      mini("مواعيد اليوم", today, "calendar", "tone-sky"),
      mini("بانتظار التأكيد", awaiting, "clock", "tone-amber"),
      mini("مكتملة هذا الأسبوع", doneWeek, "check-double", "tone-green"),
      mini("نسبة الإلغاء (30 يومًا)", `${cancelRate}<small>%</small>`, "ban", "tone-rose"),
    ].join("");

    $("#apptScope").innerHTML = segHTML(
      "appts.scope",
      f.scope,
      Object.entries(APPT_SCOPES).map(([k, s]) => [k, s.label, APPTS.filter(s.test).length])
    );
    fillSelect($("#apptStatus"), "كل الحالات", Object.keys(APPT_STATUS), f.status);
    fillSelect($("#apptDoctor"), "كل الأطباء", DOCTORS.map((d) => [d.id, d.name]), f.doctor);
    if ($("#apptSearch").value !== f.q) $("#apptSearch").value = f.q;

    const list = filteredAppts();
    const { rows, pages, page } = paginate(list, "appts");
    $("#apptTable").innerHTML = `
      <thead><tr><th>التاريخ</th><th>الوقت</th><th>المريض</th><th>الطبيب</th><th>العيادة</th><th>نوع الموعد</th><th>الحالة</th><th>الإجراء</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map((a) => {
                const p = findPatient(a.patientId);
                const d = findDoctor(a.doctorId);
                return `<tr class="enter" data-open="appt:${a.id}" tabindex="0">
                  <td data-label="التاريخ"><div class="person__text"><span>${Math.abs(daysFrom(a.date)) <= 1 ? dayLabel(a.date) : FMT.weekday.format(a.date)}</span><small>${fmtDate(a.date)}</small></div></td>
                  <td data-label="الوقت"><b class="nowrap">${fmtTime(a.time)}</b></td>
                  <td class="cell-main" data-label="المريض">${personCell(p, `<span class="code">${a.id}</span>`)}</td>
                  <td data-label="الطبيب">${d.name}</td>
                  <td data-label="العيادة">${findClinic(a.clinicId).name}</td>
                  <td data-label="نوع الموعد">${a.type}</td>
                  <td data-label="الحالة">${badge(a.status, APPT_STATUS[a.status])}</td>
                  <td class="cell-actions" data-label="الإجراء">${apptActions(a)}</td>
                </tr>`;
              })
              .join("")
          : emptyRow(8, "لا توجد مواعيد مطابقة للفلاتر المحددة")
      }</tbody>`;
    $("#apptFoot").innerHTML = pagerHTML("appts", page, pages, list.length, "موعد");
  };

  /* =========================================================
     Doctors & clinics
     ========================================================= */
  const renderDoctors = () => {
    const count = (s) => DOCTORS.filter((d) => s === "all" || d.status === s).length;
    $("#doctorTabs").innerHTML = segHTML("doctorsTab", state.doctorsTab, [
      ["all", "الكل", count("all")],
      ["متاح", "متاح", count("متاح")],
      ["مشغول", "مشغول", count("مشغول")],
      ["غير متاح", "غير متاح", count("غير متاح")],
    ]);
    const list = DOCTORS.filter((d) => state.doctorsTab === "all" || d.status === state.doctorsTab);
    $("#doctorsGrid").innerHTML = list.length
      ? list
          .map((d, i) => {
            const today = doctorToday(d);
            const next = upcoming(APPTS.filter((a) => a.doctorId === d.id))[0];
            return `<article class="doctor ${DOCTOR_STATUS[d.status]}" style="animation-delay:${i * 50}ms">
              <div class="doctor__head">
                <span class="doctor__avatar">${avatar(d.name, "avatar--lg")}</span>
                <div class="doctor__name"><b>${d.name}</b><small>${d.specialty}</small></div>
                ${badge(d.status, DOCTOR_STATUS[d.status])}
              </div>
              <div class="doctor__meta">
                <div><small>العيادة</small><b>${findClinic(d.clinicId).name}</b></div>
                <div><small>مواعيد اليوم</small><b>${today.length}</b></div>
                <div><small>الموعد القادم</small><b>${next ? `${dayLabel(next.date)} ${fmtTime(next.time)}` : "—"}</b></div>
                <div><small>الخبرة</small><b>${d.experience} سنوات</b></div>
              </div>
              <div class="doctor__foot">
                <span class="rating">${icon("star")}${d.rating.toFixed(1)}</span>
                <div class="row-actions">
                  <button class="btn btn--ghost btn--sm" type="button" data-open="doctor:${d.id}">${icon("calendar")}الجدول</button>
                  <button class="btn btn--primary btn--sm" type="button" data-action="add-appointment" data-doctor="${d.id}">${icon("plus")}حجز</button>
                </div>
              </div>
            </article>`;
          })
          .join("")
      : `<p class="list-empty">لا يوجد أطباء بهذه الحالة</p>`;
  };

  const renderClinics = () => {
    $("#clinicsGrid").innerHTML = CLINICS.map((c, i) => {
      const docs = clinicDoctors(c);
      const today = clinicToday(c);
      const status = clinicStatus(c);
      const load = Math.min(100, Math.round((today / c.capacity) * 100));
      const head = docs[0];
      return `<article class="clinic ${c.tone}" style="animation-delay:${i * 50}ms">
        <div class="clinic__head"><span class="clinic__icon">${icon(c.icon)}</span>${badge(status, CLINIC_STATUS[status])}</div>
        <div><h3>${c.name}</h3><p class="clinic__doctor">${head ? `رئيس القسم: ${head.name}` : "—"} · ${c.floor}</p></div>
        <div class="clinic__stats">
          <div><b>${today}</b>مواعيد اليوم</div>
          <div><b>${docs.length}</b>أطباء</div>
          <div><b>${apptsBetween(-29, 0).filter((a) => a.clinicId === c.id && isActive(a)).length}</b>هذا الشهر</div>
        </div>
        <div><div class="meter-label"><span>نسبة الإشغال اليوم</span><b>${load}%</b></div><div class="meter"><span style="width:${load}%"></span></div></div>
        <div class="row-actions">
          <button class="btn btn--soft btn--sm" type="button" data-action="add-appointment" data-clinic="${c.id}" ${status === "مغلقة" ? "disabled" : ""}>${icon("calendar-plus")}حجز موعد</button>
          <button class="btn btn--ghost btn--sm" type="button" data-view="doctors">${icon("stethoscope")}الأطباء</button>
        </div>
      </article>`;
    }).join("");

    const counts = CLINICS.map((c) => ({ c, n: apptsBetween(-29, 0).filter((a) => a.clinicId === c.id && isActive(a)).length }));
    const max = Math.max(...counts.map((x) => x.n)) || 1;
    renderHBars(
      $("#clinicBars"),
      counts.sort((a, b) => b.n - a.n).map(({ c, n }) => ({ label: c.name, valueLabel: `${n} موعد`, pct: (n / max) * 100, color: `var(--${toneVar(c.tone)})` }))
    );
  };
  const toneVar = (tone) => ({ "tone-teal": "brand", "tone-sky": "sky", "tone-violet": "violet", "tone-amber": "amber", "tone-rose": "rose" })[tone] || "brand";

  /* =========================================================
     Invoices
     ========================================================= */
  const filteredInvoices = () => {
    const f = state.invoices;
    return INVOICES.filter((x) => {
      if (f.status !== "all" && x.status !== f.status) return false;
      if (f.q.trim()) return matches(`${x.id} ${findPatient(x.patientId).name} ${x.service}`, f.q);
      return true;
    }).sort((a, b) => b.date - a.date || b.id.localeCompare(a.id));
  };

  const renderInvoices = () => {
    const f = state.invoices;
    const month = INVOICES.filter((x) => inDays(x.date, -29, 0));
    const pending = INVOICES.filter((x) => x.status === "معلقة");
    const cancelled = month.filter((x) => x.status === "ملغاة");
    const mini = (label, value, iconName, tone) =>
      `<div class="mini ${tone}"><span class="mini__icon">${icon(iconName)}</span><div><b>${value}</b><span>${label}</span></div></div>`;
    $("#invStats").innerHTML = [
      mini("المحصّل (30 يومًا)", `${fmtNum(paidBetween(-29, 0))} <small>ر.س</small>`, "coin", "tone-green"),
      mini(`معلقة (${pending.length} فاتورة)`, `${fmtNum(sum(pending.map((x) => x.amount)))} <small>ر.س</small>`, "clock", "tone-amber"),
      mini("فواتير هذا الشهر", month.length, "receipt", "tone-sky"),
      mini("فواتير ملغاة", cancelled.length, "ban", "tone-rose"),
    ].join("");

    const count = (s) => INVOICES.filter((x) => s === "all" || x.status === s).length;
    $("#invTabs").innerHTML = segHTML("invoices.status", f.status, [
      ["all", "الكل", count("all")],
      ["مدفوعة", "مدفوعة", count("مدفوعة")],
      ["معلقة", "معلقة", count("معلقة")],
      ["ملغاة", "ملغاة", count("ملغاة")],
    ]);
    if ($("#invSearch").value !== f.q) $("#invSearch").value = f.q;

    const list = filteredInvoices();
    const { rows, pages, page } = paginate(list, "invoices");
    $("#invTable").innerHTML = `
      <thead><tr><th>رقم الفاتورة</th><th>المريض</th><th>الخدمة</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th><th>الإجراء</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map((x) => {
                const p = findPatient(x.patientId);
                return `<tr class="enter" data-open="invoice:${x.id}" tabindex="0">
                  <td data-label="رقم الفاتورة"><span class="code">${x.id}</span></td>
                  <td class="cell-main" data-label="المريض">${personCell(p, `<span class="code">${p.id}</span>`)}</td>
                  <td data-label="الخدمة">${x.service}</td>
                  <td data-label="المبلغ"><b class="num">${fmtMoney(x.amount)}</b></td>
                  <td data-label="التاريخ">${fmtDate(x.date)}</td>
                  <td data-label="الحالة">${badge(x.status, INV_STATUS[x.status])}</td>
                  <td class="cell-actions" data-label="الإجراء"><div class="row-actions">
                    <button class="icon-btn icon-btn--sm" type="button" data-open="invoice:${x.id}" data-tip="عرض الفاتورة" aria-label="عرض الفاتورة ${x.id}">${icon("eye")}</button>
                    ${x.status === "معلقة" ? `<button class="btn btn--soft btn--sm" type="button" data-action="collect" data-id="${x.id}">${icon("check")}تحصيل</button>` : ""}
                  </div></td>
                </tr>`;
              })
              .join("")
          : emptyRow(7, "لا توجد فواتير مطابقة")
      }</tbody>`;
    $("#invFoot").innerHTML = pagerHTML("invoices", page, pages, list.length, "فاتورة");
  };

  /* =========================================================
     Reports
     ========================================================= */
  const buildReport = (key) => {
    const month = apptsBetween(-29, 0);
    if (key === "appointments") {
      const done = month.filter((a) => a.status === "مكتمل").length;
      const cancelled = month.filter((a) => a.status === "ملغي").length;
      return {
        title: "تقرير المواعيد", iconName: "calendar", tone: "tone-sky",
        desc: "حجم المواعيد ونسب الحضور والإلغاء لكل عيادة خلال آخر 30 يومًا.",
        value: month.length, unit: "موعد",
        summary: [["إجمالي المواعيد", month.length], ["مكتملة", done], ["نسبة الإلغاء", `${month.length ? Math.round((cancelled / month.length) * 100) : 0}%`]],
        headers: ["العيادة", "المواعيد", "مكتملة", "ملغاة", "قادمة"],
        rows: CLINICS.map((c) => {
          const list = month.filter((a) => a.clinicId === c.id);
          return [c.name, list.length, list.filter((a) => a.status === "مكتمل").length, list.filter((a) => a.status === "ملغي").length, list.filter(isOpen).length];
        }),
      };
    }
    if (key === "patients") {
      const new30 = PATIENTS.filter((p) => inDays(p.registered, -29, 0)).length;
      return {
        title: "تقرير المرضى", iconName: "users", tone: "tone-teal",
        desc: "توزيع المرضى حسب الحالة والفئة العمرية والتسجيلات الجديدة.",
        value: PATIENTS.length, unit: "مريض",
        summary: [["إجمالي المرضى", PATIENTS.length], ["جدد هذا الشهر", new30], ["متوسط العمر", `${Math.round(sum(PATIENTS.map((p) => p.age)) / PATIENTS.length)} سنة`]],
        headers: ["الفئة", "العدد", "النسبة"],
        rows: [
          ...Object.keys(PATIENT_STATUS).map((s) => ["الحالة", s, PATIENTS.filter((p) => p.status === s).length]),
          ["الفئة العمرية", "أقل من 15 سنة", PATIENTS.filter((p) => p.age < 15).length],
          ["الفئة العمرية", "15 – 44 سنة", PATIENTS.filter((p) => p.age >= 15 && p.age < 45).length],
          ["الفئة العمرية", "45 سنة فأكثر", PATIENTS.filter((p) => p.age >= 45).length],
        ].map(([group, label, n]) => [`${group}: ${label}`, n, `${Math.round((n / PATIENTS.length) * 100)}%`]),
      };
    }
    if (key === "revenue") {
      const paid = INVOICES.filter((x) => x.status === "مدفوعة" && inDays(x.date, -29, 0));
      const pending = INVOICES.filter((x) => x.status === "معلقة");
      return {
        title: "تقرير الإيرادات", iconName: "coin", tone: "tone-amber",
        desc: "الإيرادات المحصّلة والمبالغ المعلقة مفصّلة حسب العيادة.",
        value: fmtNum(sum(paid.map((x) => x.amount))), unit: "ر.س",
        summary: [["المحصّل", fmtMoney(sum(paid.map((x) => x.amount)))], ["المعلّق", fmtMoney(sum(pending.map((x) => x.amount)))], ["متوسط الفاتورة", fmtMoney(paid.length ? sum(paid.map((x) => x.amount)) / paid.length : 0)]],
        headers: ["العيادة", "فواتير مدفوعة", "الإيرادات (ر.س)"],
        rows: CLINICS.map((c) => {
          const list = paid.filter((x) => findAppt(x.apptId).clinicId === c.id);
          return [c.name, list.length, fmtNum(sum(list.map((x) => x.amount)))];
        }),
      };
    }
    const perDoctor = DOCTORS.map((d) => ({ d, list: month.filter((a) => a.doctorId === d.id) }));
    const top = [...perDoctor].sort((a, b) => b.list.length - a.list.length)[0];
    return {
      title: "تقرير الأطباء", iconName: "stethoscope", tone: "tone-violet",
      desc: "أداء الكادر الطبي: عدد المواعيد المنجزة والتقييم لكل طبيب.",
      value: DOCTORS.length, unit: "أطباء",
      summary: [["عدد الأطباء", DOCTORS.length], ["متوسط المواعيد للطبيب", Math.round(month.length / DOCTORS.length)], ["الأكثر مواعيد", top.d.name]],
      headers: ["الطبيب", "التخصص", "المواعيد", "مكتملة", "التقييم"],
      rows: perDoctor.map(({ d, list }) => [d.name, d.specialty, list.length, list.filter((a) => a.status === "مكتمل").length, d.rating.toFixed(1)]),
    };
  };
  const REPORT_KEYS = ["appointments", "patients", "revenue", "doctors"];

  const renderReports = () => {
    $("#reportsGrid").innerHTML = REPORT_KEYS.map((key) => {
      const r = buildReport(key);
      return `<article class="report ${r.tone}">
        <span class="report__icon">${icon(r.iconName)}</span>
        <h3>${r.title}</h3>
        <p>${r.desc}</p>
        <div class="report__value">${r.value} <small>${r.unit}</small></div>
        <div class="row-actions">
          <button class="btn btn--soft btn--sm" type="button" data-action="open-report" data-report="${key}">${icon("eye")}عرض التقرير</button>
          <button class="icon-btn icon-btn--sm" type="button" data-action="export" data-export="report-${key}" data-tip="تصدير CSV" aria-label="تصدير ${r.title}">${icon("download")}</button>
        </div>
      </article>`;
    }).join("");

    const month = apptsBetween(-29, 0);
    renderDonut(
      $("#statusDonut"),
      [
        { label: "مكتمل", value: month.filter((a) => a.status === "مكتمل").length, color: "var(--green)" },
        { label: "مؤكد", value: month.filter((a) => a.status === "مؤكد").length, color: "var(--sky)" },
        { label: "بانتظار التأكيد", value: month.filter((a) => a.status === "بانتظار التأكيد").length, color: "var(--amber)" },
        { label: "ملغي", value: month.filter((a) => a.status === "ملغي").length, color: "var(--rose)" },
      ],
      "موعد"
    );
    const paid = INVOICES.filter((x) => x.status === "مدفوعة" && inDays(x.date, -29, 0));
    const byClinic = CLINICS.map((c) => ({ c, v: sum(paid.filter((x) => findAppt(x.apptId).clinicId === c.id).map((x) => x.amount)) }));
    const max = Math.max(...byClinic.map((x) => x.v)) || 1;
    renderHBars(
      $("#revenueByClinic"),
      byClinic.sort((a, b) => b.v - a.v).map(({ c, v }) => ({ label: c.name, valueLabel: fmtMoney(v), pct: (v / max) * 100, color: `var(--${toneVar(c.tone)})` }))
    );
  };

  /* =========================================================
     Notifications
     ========================================================= */
  const NOTIF_TYPES = {
    new: { iconName: "calendar-plus", tone: "tone-sky", group: "appts" },
    confirmed: { iconName: "check", tone: "tone-green", group: "appts" },
    reminder: { iconName: "clock", tone: "tone-violet", group: "appts" },
    invoice: { iconName: "receipt", tone: "tone-amber", group: "invoices" },
    patient: { iconName: "user", tone: "tone-teal", group: "patients" },
    cancelled: { iconName: "ban", tone: "tone-rose", group: "appts" },
  };
  let notifSeq = 0;
  const minutesAgo = (m) => new Date(Date.now() - m * 60000);

  const buildNotifications = () => {
    const list = [];
    const next = upcoming();
    const pendingAppts = next.filter((a) => a.status === "بانتظار التأكيد");
    const confirmedAppts = next.filter((a) => a.status === "مؤكد");
    const name = (a) => findPatient(a.patientId).name;
    if (pendingAppts[0]) list.push({ type: "new", title: "موعد جديد", text: `حجز ${name(pendingAppts[0])} موعد ${pendingAppts[0].type} ${dayLabel(pendingAppts[0].date)} الساعة ${fmtTime(pendingAppts[0].time)}`, target: `appt:${pendingAppts[0].id}`, at: minutesAgo(6) });
    const soon = next.find((a) => daysFrom(a.date) <= 1 && a.status === "مؤكد");
    if (soon) list.push({ type: "reminder", title: "تذكير بموعد", text: `موعد ${name(soon)} مع ${findDoctor(soon.doctorId).name} ${dayLabel(soon.date)} الساعة ${fmtTime(soon.time)}`, target: `appt:${soon.id}`, at: minutesAgo(22) });
    if (confirmedAppts[1]) list.push({ type: "confirmed", title: "موعد تم تأكيده", text: `أكّد ${name(confirmedAppts[1])} حضوره لموعد ${confirmedAppts[1].type}`, target: `appt:${confirmedAppts[1].id}`, at: minutesAgo(48) });
    const pendingInv = INVOICES.filter((x) => x.status === "معلقة").sort((a, b) => b.date - a.date);
    if (pendingInv[0]) list.push({ type: "invoice", title: "فاتورة معلقة", text: `الفاتورة ${pendingInv[0].id} بقيمة ${fmtMoney(pendingInv[0].amount)} لم تُحصّل بعد`, target: `invoice:${pendingInv[0].id}`, at: minutesAgo(95) });
    if (pendingAppts[1]) list.push({ type: "new", title: "موعد جديد", text: `حجز ${name(pendingAppts[1])} موعد ${pendingAppts[1].type} ${dayLabel(pendingAppts[1].date)}`, target: `appt:${pendingAppts[1].id}`, at: minutesAgo(180) });
    const newest = [...PATIENTS].sort((a, b) => b.registered - a.registered)[0];
    list.push({ type: "patient", title: "مريض جديد", text: `تم تسجيل ملف جديد: ${newest.name} (${newest.id})`, target: `patient:${newest.id}`, at: minutesAgo(60 * 26), read: true });
    if (pendingInv[1]) list.push({ type: "invoice", title: "فاتورة معلقة", text: `الفاتورة ${pendingInv[1].id} بانتظار التحصيل منذ ${dayPhrase(Math.max(1, -daysFrom(pendingInv[1].date)))}`, target: `invoice:${pendingInv[1].id}`, at: minutesAgo(60 * 30), read: true });
    if (confirmedAppts[3]) list.push({ type: "confirmed", title: "موعد تم تأكيده", text: `تم تأكيد موعد ${name(confirmedAppts[3])} عبر الرسائل النصية`, target: `appt:${confirmedAppts[3].id}`, at: minutesAgo(60 * 50), read: true });
    state.notifications = list.map((n) => ({ id: `n${++notifSeq}`, read: false, ...n }));
  };

  const pushNotification = (n) => {
    state.notifications.unshift({ id: `n${++notifSeq}`, read: false, at: new Date(), ...n });
    const b = $("#notifBadge");
    renderNotifications();
    renderCounts();
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
  };

  const notifItem = (n, compact) => {
    const t = NOTIF_TYPES[n.type];
    return `<li class="notif ${n.read ? "" : "unread"} ${compact ? "notif--compact" : ""}">
      <span class="alerts__icon ${t.tone}">${icon(t.iconName)}</span>
      <div class="notif__body" data-notif="${n.id}" tabindex="0" role="button">
        <b>${n.title}</b><p>${esc(n.text)}</p><small>${ago(n.at)}</small>
      </div>
      ${!compact && !n.read ? `<button class="link-btn" type="button" data-action="read" data-id="${n.id}">تحديد كمقروء</button>` : ""}
    </li>`;
  };

  const renderNotifications = () => {
    const all = state.notifications;
    const unread = all.filter((n) => !n.read).length;
    $("#notifBadge").textContent = unread || "";
    $("#notifBtn").setAttribute("aria-label", unread ? `الإشعارات (${unread} غير مقروءة)` : "الإشعارات");
    $("#notifPopList").innerHTML = all.length
      ? all.slice(0, 5).map((n) => notifItem(n, true)).join("")
      : `<li class="list-empty">لا توجد إشعارات</li>`;

    const tabs = [
      ["all", "الكل", all.length],
      ["unread", "غير مقروءة", unread],
      ["appts", "المواعيد", all.filter((n) => NOTIF_TYPES[n.type].group === "appts").length],
      ["invoices", "الفواتير", all.filter((n) => NOTIF_TYPES[n.type].group === "invoices").length],
    ];
    $("#notifTabs").innerHTML = segHTML("notifTab", state.notifTab, tabs);
    const list = all.filter((n) =>
      state.notifTab === "all" ? true : state.notifTab === "unread" ? !n.read : NOTIF_TYPES[n.type].group === state.notifTab
    );
    $("#notifList").innerHTML = list.length
      ? list.map((n) => notifItem(n, false)).join("")
      : `<li class="list-empty"><div class="empty-state">${icon("inbox")}لا توجد إشعارات في هذا القسم</div></li>`;
  };

  const markRead = (id) => {
    const n = state.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    renderNotifications();
    renderCounts();
  };

  /* =========================================================
     Counts & full render
     ========================================================= */
  const renderCounts = () => {
    const counts = {
      patients: PATIENTS.length,
      appointments: APPTS.filter((a) => daysFrom(a.date) === 0 && isActive(a)).length,
      invoices: INVOICES.filter((x) => x.status === "معلقة").length || "",
      notifications: state.notifications.filter((n) => !n.read).length || "",
    };
    $$("[data-count]").forEach((el) => (el.textContent = counts[el.dataset.count]));
  };

  const renderAll = () => {
    renderDashboard();
    renderPatients();
    renderAppointments();
    renderDoctors();
    renderClinics();
    renderInvoices();
    renderReports();
    renderNotifications();
    renderCounts();
  };

  /* =========================================================
     Navigation
     ========================================================= */
  const VIEWS = ["dashboard", "patients", "appointments", "doctors", "clinics", "invoices", "reports", "notifications", "settings"];
  const sidebar = $("#sidebar");
  const menuBtn = $("#menuBtn");
  const isCompact = () => window.innerWidth <= 1100;

  const setSidebar = (open) => {
    sidebar.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("locked", open && isCompact());
  };

  const showView = (view) => {
    if (!VIEWS.includes(view)) view = "dashboard";
    state.view = view;
    $$(".view").forEach((s) => (s.hidden = s.id !== `view-${view}`));
    $$(".nav__item").forEach((a) => {
      const on = a.dataset.view === view;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const title = $(`#view-${view}`).dataset.title;
    $("#pageTitle").textContent = title;
    document.title = `${title} | ClinicFlow`;
    if (view === "dashboard" && renderDashboard.revenueArgs) renderArea($("#revenueChart"), ...renderDashboard.revenueArgs, "الإيرادات (ر.س)");
    closePops();
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
  $("#scrim").addEventListener("click", () => setSidebar(false));

  /* =========================================================
     Popovers & row dropdown
     ========================================================= */
  const pops = $$(".pop");
  const closePops = (except) => {
    pops.forEach((p) => {
      if (p === except) return;
      p.classList.remove("open");
      $("button", p).setAttribute("aria-expanded", "false");
    });
    closeRowMenu();
  };
  pops.forEach((p) => {
    $("button", p).addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !p.classList.contains("open");
      closePops(p);
      p.classList.toggle("open", open);
      e.currentTarget.setAttribute("aria-expanded", String(open));
    });
  });

  const rowMenu = $("#rowMenu");
  const closeRowMenu = () => {
    rowMenu.classList.remove("open");
    rowMenu.dataset.for = "";
  };
  const openRowMenu = (btn) => {
    const ref = btn.dataset.menu;
    if (rowMenu.classList.contains("open") && rowMenu.dataset.for === ref) return closeRowMenu();
    const a = findAppt(ref.split(":")[1]);
    const items = [["view-appt", "عرض التفاصيل", "eye"]];
    if (a.status === "بانتظار التأكيد") items.push(["confirm-appt", "تأكيد الموعد", "check"]);
    if (isOpen(a)) items.push(["edit-appt", "تعديل الموعد", "edit"]);
    if (isOpen(a) && daysFrom(a.date) <= 0) items.push(["complete-appt", "إتمام الموعد", "check-double"]);
    if (a.status === "ملغي") items.push(["edit-appt", "إعادة جدولة", "refresh"]);
    if (a.status === "مكتمل" && invoiceOf(a)) items.push(["view-invoice", "عرض الفاتورة", "receipt"]);
    if (isOpen(a)) items.push(["cancel-appt", "إلغاء الموعد", "ban", true]);
    rowMenu.innerHTML = items
      .map(([act, label, ic, danger]) => `${danger ? "<hr>" : ""}<button class="menu__item ${danger ? "is-danger" : ""}" type="button" role="menuitem" data-action="${act}" data-id="${a.id}">${icon(ic)}${label}</button>`)
      .join("");
    rowMenu.classList.add("open");
    rowMenu.dataset.for = ref;
    rowMenu.dataset.scroll = String(window.scrollY);
    const r = btn.getBoundingClientRect();
    const w = rowMenu.offsetWidth;
    const h = rowMenu.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.bottom + h + 8 > window.innerHeight ? r.top - h - 6 : r.bottom + 6;
    rowMenu.style.left = `${left}px`;
    rowMenu.style.top = `${Math.max(8, top)}px`;
  };
  // Close on a real scroll only (small scroll-into-view adjustments keep it open)
  window.addEventListener("scroll", () => {
    if (rowMenu.classList.contains("open") && Math.abs(window.scrollY - Number(rowMenu.dataset.scroll || 0)) > 40) closeRowMenu();
  }, { passive: true });
  window.addEventListener("resize", closeRowMenu);

  /* =========================================================
     Modal, forms & confirm dialog
     ========================================================= */
  const modal = $("#modal");
  const modalBox = $(".modal__box", modal);
  let modalCtx = null;
  let modalReturnFocus = null;

  const openModal = ({ title, sub = "", badgeHTML = "", body, foot = "", size = "", ctx = null }) => {
    $("#modalHead").innerHTML = `<h3 id="modalTitle">${title}${badgeHTML}</h3>${sub ? `<p>${sub}</p>` : ""}`;
    $("#modalBody").innerHTML = body;
    $("#modalFoot").innerHTML = foot;
    modal.classList.remove("modal--sm", "modal--xs");
    if (size) modal.classList.add(`modal--${size}`);
    modalCtx = ctx;
    closePops();
    if (!modal.classList.contains("open")) {
      modalReturnFocus = document.activeElement;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("locked");
      modalBox.focus();
    }
    $("#modalBody").scrollTop = 0;
  };

  const closeModal = () => {
    if (!modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!sidebar.classList.contains("open")) document.body.classList.remove("locked");
    modalCtx = null;
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus({ preventScroll: true });
  };
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });

  // After a data change: re-render views and refresh whatever detail is open
  const refresh = (ctx = modalCtx) => {
    renderAll();
    if (ctx && OPENERS[ctx.type]) OPENERS[ctx.type](ctx.id);
    else closeModal();
  };

  const fieldHTML = (f) => {
    const id = `f-${f.name}`;
    const attrs = `id="${id}" name="${f.name}" ${f.attrs || ""}`;
    let control;
    if (f.type === "select") {
      control = `<select class="select" ${attrs}>${f.options
        .map((o) => {
          const [val, label] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(f.value ?? "") ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("")}</select>`;
    } else if (f.type === "textarea") {
      control = `<textarea class="textarea" ${attrs} placeholder="${f.placeholder || ""}">${esc(f.value || "")}</textarea>`;
    } else {
      control = `<input class="input" type="${f.type || "text"}" ${attrs} value="${esc(f.value ?? "")}" placeholder="${f.placeholder || ""}">`;
    }
    return `<label class="field ${f.full ? "full" : ""}" for="${id}"><span>${f.label}${f.required ? " *" : ""}</span>${control}<small class="field__error"></small></label>`;
  };

  const openForm = ({ title, sub, fields, submitLabel, onSubmit, validate, onMount, back = null }) => {
    openModal({
      title, sub, size: "sm",
      body: `<form class="form--grid" id="modalForm" novalidate>${fields.map(fieldHTML).join("")}<p class="form-error" id="formError"></p></form>`,
      foot: `<button class="btn btn--ghost" type="button" data-action="form-back">إلغاء</button>
             <button class="btn btn--primary" type="submit" form="modalForm">${icon("check")}${submitLabel}</button>`,
      ctx: back ? { type: "form", back } : null,
    });
    const form = $("#modalForm");
    if (onMount) onMount(form);
    if (!isCompact()) {
      const first = form.querySelector("input, select, textarea");
      if (first) first.focus();
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const values = Object.fromEntries(fields.map((f) => [f.name, form.elements[f.name].value.trim()]));
      const errors = {};
      fields.forEach((f) => {
        const v = values[f.name];
        if (f.required && !v) errors[f.name] = "هذا الحقل مطلوب";
        else if (v && f.check) {
          const msg = f.check(v, values);
          if (msg) errors[f.name] = msg;
        }
      });
      if (!Object.keys(errors).length && validate) Object.assign(errors, validate(values) || {});
      fields.forEach((f) => {
        const wrap = form.elements[f.name].closest(".field");
        wrap.classList.toggle("invalid", !!errors[f.name]);
        wrap.querySelector(".field__error").textContent = errors[f.name] || "";
      });
      $("#formError").textContent = errors._form || "";
      const firstBad = fields.find((f) => errors[f.name]);
      if (firstBad) return form.elements[firstBad.name].focus();
      if (errors._form) return;
      onSubmit(values);
    });
  };

  const openConfirm = ({ title, text, confirmLabel, danger = true, onConfirm, back = null }) => {
    openModal({
      title, size: "xs",
      body: `<div class="confirm"><span class="alerts__icon ${danger ? "tone-rose" : "tone-teal"}">${icon(danger ? "alert" : "check")}</span><p class="muted">${text}</p></div>`,
      foot: `<button class="btn btn--ghost" type="button" data-action="form-back">تراجع</button>
             <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" id="confirmBtn">${confirmLabel}</button>`,
      ctx: back ? { type: "form", back } : null,
    });
    $("#confirmBtn").addEventListener("click", onConfirm);
  };

  const goBack = () => {
    const back = modalCtx && modalCtx.back;
    if (back && OPENERS[back.type]) OPENERS[back.type](back.id);
    else closeModal();
  };

  /* =========================================================
     Detail views
     ========================================================= */
  const info = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;

  const openPatient = (id) => {
    const p = findPatient(id);
    if (!p) return;
    const appts = patientAppts(p);
    const lv = lastVisit(p);
    const next = upcoming(appts);
    const history = appts.filter((a) => a.status === "مكتمل" || (a.status === "ملغي" && stamp(a) < Date.now())).sort((a, b) => stamp(b) - stamp(a)).slice(0, 6);
    const docCount = {};
    appts.forEach((a) => (docCount[a.doctorId] = (docCount[a.doctorId] || 0) + 1));
    const mainDoc = Object.entries(docCount).sort((a, b) => b[1] - a[1])[0];

    openModal({
      title: "ملف المريض",
      sub: "بيانات تجريبية لأغراض العرض فقط",
      ctx: { type: "patient", id },
      body: `
        <div class="profile">
          ${avatar(p.name, "avatar--lg")}
          <div class="profile__text"><h3>${esc(p.name)}</h3><p><span class="code">${p.id}</span> · مسجّل منذ ${fmtDate(p.registered)}</p></div>
          ${badge(p.status, PATIENT_STATUS[p.status])}
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("user")}معلومات المريض</h4></div>
          <div class="info-grid">
            ${info("العمر", `${p.age} سنة`)}
            ${info("الجنس", p.gender)}
            ${info("رقم الجوال", `<span class="num">${p.phone}</span>`)}
            ${info("إجمالي الزيارات", appts.filter((a) => a.status === "مكتمل").length)}
            ${info("المواعيد الملغاة", appts.filter((a) => a.status === "ملغي").length)}
            ${info("الطبيب المتابع", mainDoc ? findDoctor(mainDoc[0]).name : "—")}
          </div>
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("clock")}آخر زيارة</h4></div>
          ${
            lv
              ? `<div class="highlight">${icon("check-double")}<div class="list-body"><b>${lv.type} — ${findClinic(lv.clinicId).name}</b><small>${fmtDate(lv.date)} · ${fmtTime(lv.time)} · ${findDoctor(lv.doctorId).name}</small></div><span class="dim">${relDays(daysFrom(lv.date))}</span></div>`
              : `<p class="dim">لا توجد زيارات مكتملة بعد.</p>`
          }
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("calendar")}المواعيد القادمة</h4><button class="link-btn" type="button" data-action="add-appointment" data-patient="${p.id}">+ حجز موعد</button></div>
          ${
            next.length
              ? `<ul class="mini-list">${next
                  .slice(0, 4)
                  .map((a) => `<li data-open="appt:${a.id}"><div class="list-body"><b>${dayLabel(a.date)} · ${fmtTime(a.time)}</b><small>${a.type} — ${findDoctor(a.doctorId).name}</small></div>${badge(a.status, APPT_STATUS[a.status])}</li>`)
                  .join("")}</ul>`
              : `<p class="dim">لا توجد مواعيد قادمة.</p>`
          }
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("file")}سجل الزيارات</h4><span class="dim">سجل تجريبي</span></div>
          ${
            history.length
              ? `<ul class="timeline">${history
                  .map(
                    (a) => `<li style="--c:var(--${a.status === "ملغي" ? "rose" : "brand"})"><div>${a.type} — ${findClinic(a.clinicId).name}<small>${findDoctor(a.doctorId).name}${a.status === "ملغي" ? " · ملغي" : ""}</small></div><span class="dim nowrap">${fmtDate(a.date)}</span></li>`
                  )
                  .join("")}</ul>`
              : `<p class="dim">لا يوجد سجل زيارات.</p>`
          }
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("note")}الملاحظات</h4></div>
          <div class="notes">${
            p.notes.length
              ? [...p.notes].reverse().map((n) => `<div class="note">${esc(n.text)}<small>${n.by} · ${fmtDate(n.at)}</small></div>`).join("")
              : `<p class="dim">لا توجد ملاحظات.</p>`
          }</div>
          <form class="note-form" id="noteForm">
            <input class="input" name="note" placeholder="أضف ملاحظة إدارية (مثال: يفضّل التواصل مساءً)" maxlength="200" aria-label="ملاحظة جديدة">
            <button class="btn btn--soft" type="submit">${icon("plus")}إضافة</button>
          </form>
        </div>`,
      foot: `
        <label class="push field" style="flex-direction:row;align-items:center;gap:8px"><span>الحالة</span>
          <select class="select" id="patientStatusSelect" style="width:auto" aria-label="حالة المريض">
            ${Object.keys(PATIENT_STATUS).map((s) => `<option ${s === p.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn--primary" type="button" data-action="add-appointment" data-patient="${p.id}">${icon("calendar-plus")}حجز موعد</button>`,
    });

    $("#noteForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = e.target.elements.note.value.trim();
      if (!text) return e.target.elements.note.focus();
      p.notes.push({ text, at: new Date(), by: "ريم الخالد" });
      openPatient(p.id);
      toast("تمت إضافة الملاحظة", p.name);
    });
    $("#patientStatusSelect").addEventListener("change", (e) => {
      p.status = e.target.value;
      refresh();
      toast("تم تحديث حالة المريض", `${p.name}: ${p.status}`);
    });
  };

  const openAppt = (id) => {
    const a = findAppt(id);
    if (!a) return;
    const p = findPatient(a.patientId);
    const d = findDoctor(a.doctorId);
    const inv = invoiceOf(a);
    const buttons = [];
    if (isOpen(a)) buttons.push(`<button class="btn btn--ghost push" type="button" data-action="cancel-appt" data-id="${a.id}" style="color:var(--rose)">${icon("ban")}إلغاء الموعد</button>`);
    if (isOpen(a)) buttons.push(`<button class="btn btn--ghost" type="button" data-action="edit-appt" data-id="${a.id}">${icon("edit")}تعديل</button>`);
    if (a.status === "بانتظار التأكيد") buttons.push(`<button class="btn btn--primary" type="button" data-action="confirm-appt" data-id="${a.id}">${icon("check")}تأكيد الموعد</button>`);
    if (a.status === "مؤكد") buttons.push(`<button class="btn btn--primary" type="button" data-action="complete-appt" data-id="${a.id}">${icon("check-double")}إتمام الموعد</button>`);
    if (a.status === "مكتمل" && inv) buttons.push(`<button class="btn btn--primary" type="button" data-open="invoice:${inv.id}">${icon("receipt")}عرض الفاتورة</button>`);
    if (a.status === "ملغي") buttons.push(`<button class="btn btn--primary" type="button" data-action="edit-appt" data-id="${a.id}">${icon("refresh")}إعادة جدولة</button>`);

    openModal({
      title: `موعد <span class="code">${a.id}</span>`,
      badgeHTML: badge(a.status, APPT_STATUS[a.status]),
      sub: `${a.type} · ${findClinic(a.clinicId).name}`,
      size: "sm",
      ctx: { type: "appt", id },
      body: `
        <div class="highlight">${icon("calendar")}<div class="list-body"><b>${FMT.long.format(a.date)}</b><small>الساعة ${fmtTime(a.time)} · مدة ${state.settings.duration} دقيقة</small></div><span class="chip tone-teal">${relDays(daysFrom(a.date))}</span></div>
        <div class="section">
          <div class="info-grid">
            ${info("المريض", `<button class="link-btn" type="button" data-open="patient:${p.id}">${esc(p.name)}</button>`)}
            ${info("رقم الملف", `<span class="code">${p.id}</span>`)}
            ${info("الجوال", `<span class="num">${p.phone}</span>`)}
            ${info("الطبيب", `<button class="link-btn" type="button" data-open="doctor:${d.id}">${d.name}</button>`)}
            ${info("العيادة", findClinic(a.clinicId).name)}
            ${info("رسوم الخدمة", fmtMoney(PRICES[a.type]))}
          </div>
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("note")}ملاحظات الموعد</h4></div>
          <p class="muted">${a.notes ? esc(a.notes) : "لا توجد ملاحظات."}</p>
        </div>`,
      foot: buttons.join(""),
    });
  };

  const openDoctor = (id) => {
    const d = findDoctor(id);
    if (!d) return;
    const today = doctorToday(d).sort((a, b) => stamp(a) - stamp(b));
    const month = apptsBetween(-29, 0).filter((a) => a.doctorId === d.id && isActive(a)).length;
    openModal({
      title: d.name,
      badgeHTML: badge(d.status, DOCTOR_STATUS[d.status]),
      sub: `${d.specialty} · ${findClinic(d.clinicId).name}`,
      size: "sm",
      ctx: { type: "doctor", id },
      body: `
        <div class="info-grid">
          ${info("التخصص", d.specialty)}
          ${info("العيادة", findClinic(d.clinicId).name)}
          ${info("سنوات الخبرة", `${d.experience} سنوات`)}
          ${info("التقييم", `★ ${d.rating.toFixed(1)}`)}
          ${info("مواعيد اليوم", today.length)}
          ${info("مواعيد الشهر", month)}
        </div>
        <div class="section">
          <div class="section__title"><h4>${icon("calendar")}جدول اليوم</h4><span class="dim">${FMT.long.format(TODAY)}</span></div>
          ${
            today.length
              ? `<ul class="mini-list">${today
                  .map((a) => `<li data-open="appt:${a.id}"><div class="list-body"><b>${fmtTime(a.time)} — ${esc(findPatient(a.patientId).name)}</b><small>${a.type}</small></div>${badge(a.status, APPT_STATUS[a.status])}</li>`)
                  .join("")}</ul>`
              : `<p class="dim">لا توجد مواعيد اليوم.</p>`
          }
        </div>`,
      foot: `
        <label class="push field" style="flex-direction:row;align-items:center;gap:8px"><span>الحالة</span>
          <select class="select" id="doctorStatusSelect" style="width:auto" aria-label="حالة الطبيب">
            ${Object.keys(DOCTOR_STATUS).map((s) => `<option ${s === d.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn--primary" type="button" data-action="add-appointment" data-doctor="${d.id}">${icon("calendar-plus")}حجز موعد</button>`,
    });
    $("#doctorStatusSelect").addEventListener("change", (e) => {
      d.status = e.target.value;
      refresh();
      toast("تم تحديث حالة الطبيب", `${d.name}: ${d.status}`);
    });
  };

  const openInvoice = (id) => {
    const x = findInvoice(id);
    if (!x) return;
    const p = findPatient(x.patientId);
    const a = findAppt(x.apptId);
    openModal({
      title: `فاتورة <span class="code">${x.id}</span>`,
      badgeHTML: badge(x.status, INV_STATUS[x.status]),
      sub: `${fmtDate(x.date)} · ${findClinic(a.clinicId).name}`,
      size: "sm",
      ctx: { type: "invoice", id },
      body: `
        <div class="invoice-box">
          <div class="invoice-box__head">
            <div><b>${esc(state.settings.name)}</b><p class="dim">${esc(state.settings.email)}</p></div>
            <div style="text-align:left"><b class="code">${x.id}</b><p class="dim">${fmtDate(x.date)}</p></div>
          </div>
          <div class="info-grid">
            ${info("المريض", `<button class="link-btn" type="button" data-open="patient:${p.id}">${esc(p.name)}</button>`)}
            ${info("الطبيب", findDoctor(a.doctorId).name)}
            ${info("طريقة الدفع", x.status === "مدفوعة" ? x.method : "—")}
          </div>
          <ul class="mini-list" style="margin-top:14px">
            <li><div class="list-body"><b>${x.service}</b><small>موعد <span class="code">${a.id}</span> · ${fmtTime(a.time)}</small></div><b class="num">${fmtMoney(x.amount)}</b></li>
          </ul>
          <div class="invoice-box__total"><span>الإجمالي</span><span class="num">${fmtMoney(x.amount)}</span></div>
        </div>
        <p class="dim" style="margin-top:12px">فاتورة تجريبية لأغراض العرض — لا تمثل معاملة حقيقية.</p>`,
      foot:
        x.status === "معلقة"
          ? `<button class="btn btn--ghost push" type="button" data-action="cancel-invoice" data-id="${x.id}" style="color:var(--rose)">${icon("ban")}إلغاء الفاتورة</button>
             <button class="btn btn--primary" type="button" data-action="collect" data-id="${x.id}">${icon("check")}تحصيل المبلغ</button>`
          : `<button class="btn btn--ghost" type="button" data-close>إغلاق</button>`,
    });
  };

  const openReport = (key) => {
    const r = buildReport(key);
    openModal({
      title: r.title,
      sub: `${r.desc} · حتى ${fmtDate(TODAY)}`,
      body: `
        <div class="summary">${r.summary.map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join("")}</div>
        <div class="table-wrap"><table class="table">
          <thead><tr>${r.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${r.rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`,
      foot: `<button class="btn btn--ghost" type="button" data-close>إغلاق</button>
             <button class="btn btn--primary" type="button" data-action="export" data-export="report-${key}">${icon("download")}تصدير CSV</button>`,
    });
  };

  const OPENERS = { patient: openPatient, appt: openAppt, doctor: openDoctor, invoice: openInvoice };

  /* =========================================================
     Actions
     ========================================================= */
  const slotOptions = () => {
    const step = Number(state.settings.duration) || 30;
    const out = [];
    for (let m = toMin(state.settings.open); m < toMin(state.settings.close); m += step) {
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      out.push([t, fmtTime(t)]);
    }
    return out;
  };

  const openAddPatient = () => {
    openForm({
      title: "إضافة مريض جديد",
      sub: `سيُنشأ ملف برقم CF-${10231 + PATIENTS.length}`,
      submitLabel: "حفظ الملف",
      fields: [
        { name: "name", label: "الاسم الكامل", required: true, full: true, placeholder: "مثال: سارة أحمد الغامدي",
          check: (v) => (v.split(/\s+/).length >= 2 ? "" : "أدخل الاسم الأول واسم العائلة على الأقل") },
        { name: "phone", label: "رقم الجوال", required: true, placeholder: "05XXXXXXXX", attrs: 'dir="ltr" inputmode="tel" maxlength="10"',
          check: (v) => (/^05\d{8}$/.test(v) ? (PATIENTS.some((p) => p.phone === v) ? "رقم الجوال مسجّل لمريض آخر" : "") : "رقم جوال سعودي من 10 أرقام يبدأ بـ 05") },
        { name: "age", label: "العمر", type: "number", required: true, attrs: 'min="0" max="120"',
          check: (v) => (+v >= 0 && +v <= 120 && Number.isInteger(+v) ? "" : "عمر غير صحيح") },
        { name: "gender", label: "الجنس", type: "select", options: ["ذكر", "أنثى"] },
        { name: "status", label: "الحالة", type: "select", options: Object.keys(PATIENT_STATUS), value: "جديد" },
        { name: "note", label: "ملاحظة إدارية", type: "textarea", full: true, placeholder: "اختياري — مثال: يفضّل التواصل عبر واتساب" },
      ],
      onSubmit: (v) => {
        const p = {
          id: `CF-${10231 + PATIENTS.length}`,
          name: v.name, age: Number(v.age), gender: v.gender, status: v.status,
          registered: new Date(TODAY), phone: v.phone,
          notes: v.note ? [{ text: v.note, at: new Date(), by: "ريم الخالد" }] : [],
        };
        PATIENTS.push(p);
        pushNotification({ type: "patient", title: "مريض جديد", text: `تم تسجيل ملف جديد: ${p.name} (${p.id})`, target: `patient:${p.id}` });
        state.patients = { ...state.patients, q: "", status: "all", gender: "all", sort: "file", dir: -1, page: 1 };
        renderAll();
        openPatient(p.id);
        toast("تمت إضافة المريض", `${p.name} — ${p.id}`);
      },
    });
  };

  const openApptForm = ({ appt = null, patientId = "", doctorId = "", clinicId = "" } = {}) => {
    const editing = !!appt;
    let doctor = findDoctor(appt ? appt.doctorId : doctorId);
    if (!doctor && clinicId) doctor = DOCTORS.find((d) => d.clinicId === clinicId && d.status !== "غير متاح");
    if (!doctor) doctor = DOCTORS.find((d) => d.status !== "غير متاح");
    const typesFor = (d) => findClinic(d.clinicId).types.map((t) => [t, `${t} — ${fmtMoney(PRICES[t])}`]);
    const defaultDate = appt && daysFrom(appt.date) >= 0 ? appt.date : addDays(1);

    openForm({
      title: editing ? (appt.status === "ملغي" ? "إعادة جدولة الموعد" : "تعديل الموعد") : "إضافة موعد جديد",
      sub: editing ? `${appt.id} · ${findPatient(appt.patientId).name}` : "اختر المريض والطبيب والوقت المناسب",
      submitLabel: editing ? "حفظ التعديلات" : "تأكيد الحجز",
      back: editing ? { type: "appt", id: appt.id } : null,
      fields: [
        { name: "patient", label: "المريض", type: "select", full: true, required: true, value: appt ? appt.patientId : patientId,
          options: [["", "اختر المريض"], ...PATIENTS.map((p) => [p.id, `${p.name} — ${p.id}`])] },
        { name: "doctor", label: "الطبيب", type: "select", full: true, value: doctor.id,
          options: DOCTORS.map((d) => [d.id, `${d.name} — ${d.specialty}${d.status === "غير متاح" ? " (غير متاح)" : ""}`]) },
        { name: "date", label: "التاريخ", type: "date", required: true, value: iso(defaultDate), attrs: `min="${iso(TODAY)}"`,
          check: (v) => (daysFrom(parseISO(v)) >= 0 ? "" : "لا يمكن الحجز في تاريخ سابق") },
        { name: "time", label: "الوقت", type: "select", value: appt ? appt.time : "10:00", options: slotOptions() },
        { name: "type", label: "نوع الموعد", type: "select", full: true, value: appt ? appt.type : "", options: typesFor(doctor) },
        ...(editing
          ? [{ name: "status", label: "الحالة", type: "select", full: true, value: appt.status === "ملغي" ? "بانتظار التأكيد" : appt.status, options: ["مؤكد", "بانتظار التأكيد"] }]
          : [{ name: "status", label: "الحالة", type: "select", full: true, value: "مؤكد", options: ["مؤكد", "بانتظار التأكيد"] }]),
        { name: "notes", label: "ملاحظات", type: "textarea", full: true, value: appt ? appt.notes : "", placeholder: "اختياري" },
      ],
      onMount: (form) => {
        form.elements.doctor.addEventListener("change", (e) => {
          const d = findDoctor(e.target.value);
          form.elements.type.innerHTML = typesFor(d).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
        });
      },
      validate: (v) => {
        const date = parseISO(v.date);
        const d = findDoctor(v.doctor);
        const errors = {};
        if (daysFrom(date) === 0 && toMin(v.time) <= new Date().getHours() * 60 + new Date().getMinutes())
          errors.time = "هذا الوقت مضى، اختر وقتًا لاحقًا";
        if (d.status === "غير متاح" && daysFrom(date) <= 3) errors.doctor = "الطبيب غير متاح خلال الأيام القادمة";
        const clash = APPTS.find((a) => a.id !== (appt && appt.id) && isActive(a) && a.doctorId === v.doctor && daysFrom(a.date) === daysFrom(date) && a.time === v.time);
        if (clash) errors.time = `الطبيب لديه موعد آخر في هذا الوقت (${clash.id})`;
        const own = APPTS.find((a) => a.id !== (appt && appt.id) && isActive(a) && a.patientId === v.patient && daysFrom(a.date) === daysFrom(date) && a.time === v.time);
        if (own && !clash) errors.time = "المريض لديه موعد آخر في هذا الوقت";
        return errors;
      },
      onSubmit: (v) => {
        const d = findDoctor(v.doctor);
        const data = { patientId: v.patient, doctorId: d.id, clinicId: d.clinicId, date: parseISO(v.date), time: v.time, type: v.type, status: v.status, notes: v.notes };
        if (editing) {
          Object.assign(appt, data);
          toast(appt.status === "بانتظار التأكيد" ? "تم تحديث الموعد" : "تم حفظ التعديلات", `${appt.id} — ${dayLabel(appt.date)} ${fmtTime(appt.time)}`);
          refresh({ type: "appt", id: appt.id });
        } else {
          const a = { id: `AP-${++apptSeq}`, ...data };
          APPTS.push(a);
          if (state.settings.notifyNew)
            pushNotification({ type: "new", title: "موعد جديد", text: `تم حجز موعد ${a.type} لـ ${findPatient(a.patientId).name} ${dayLabel(a.date)} الساعة ${fmtTime(a.time)}`, target: `appt:${a.id}` });
          toast("تم حجز الموعد", `${findPatient(a.patientId).name} — ${dayLabel(a.date)} ${fmtTime(a.time)} مع ${d.name}`);
          refresh({ type: "appt", id: a.id });
        }
      },
    });
  };

  const confirmAppt = (id) => {
    const a = findAppt(id);
    a.status = "مؤكد";
    pushNotification({ type: "confirmed", title: "موعد تم تأكيده", text: `تم تأكيد موعد ${findPatient(a.patientId).name} ${dayLabel(a.date)} الساعة ${fmtTime(a.time)}`, target: `appt:${a.id}`, read: true });
    toast("تم تأكيد الموعد", `${a.id} — ${findPatient(a.patientId).name}`);
    refresh(modalCtx && modalCtx.type === "appt" ? modalCtx : null);
  };

  const completeAppt = (id) => {
    const a = findAppt(id);
    if (daysFrom(a.date) > 0) {
      toast("لا يمكن إتمام موعد مستقبلي", "يمكن إتمام المواعيد في يومها فقط", "warning");
      return;
    }
    a.status = "مكتمل";
    const inv = { id: `INV-${++invSeq}`, apptId: a.id, patientId: a.patientId, service: a.type, amount: PRICES[a.type], date: new Date(TODAY), status: "معلقة", method: "—" };
    INVOICES.push(inv);
    if (state.settings.notifyInvoices)
      pushNotification({ type: "invoice", title: "فاتورة معلقة", text: `أُنشئت الفاتورة ${inv.id} بقيمة ${fmtMoney(inv.amount)}`, target: `invoice:${inv.id}` });
    toast("تم إتمام الموعد", `أُنشئت الفاتورة ${inv.id} بانتظار التحصيل`);
    refresh({ type: "appt", id: a.id });
  };

  const cancelAppt = (id) => {
    const a = findAppt(id);
    const fromModal = modalCtx && modalCtx.type === "appt";
    openConfirm({
      title: "إلغاء الموعد",
      text: `هل أنت متأكد من إلغاء موعد <b>${esc(findPatient(a.patientId).name)}</b> ${dayLabel(a.date)} الساعة ${fmtTime(a.time)}؟ سيُرسَل إشعار للمريض (تجريبي).`,
      confirmLabel: "نعم، إلغاء الموعد",
      back: fromModal ? { type: "appt", id } : null,
      onConfirm: () => {
        a.status = "ملغي";
        pushNotification({ type: "cancelled", title: "تم إلغاء موعد", text: `أُلغي موعد ${findPatient(a.patientId).name} (${a.id})`, target: `appt:${a.id}`, read: true });
        toast("تم إلغاء الموعد", `${a.id} — ${findPatient(a.patientId).name}`, "danger");
        refresh(fromModal ? { type: "appt", id } : null);
      },
    });
  };

  const collectInvoice = (id) => {
    const x = findInvoice(id);
    x.status = "مدفوعة";
    x.method = "مدى";
    toast("تم تحصيل المبلغ", `${x.id} — ${fmtMoney(x.amount)}`);
    refresh(modalCtx && modalCtx.type === "invoice" ? modalCtx : null);
  };

  const cancelInvoice = (id) => {
    const x = findInvoice(id);
    openConfirm({
      title: "إلغاء الفاتورة",
      text: `سيتم إلغاء الفاتورة <b class="code">${x.id}</b> بقيمة ${fmtMoney(x.amount)}. هل تريد المتابعة؟`,
      confirmLabel: "إلغاء الفاتورة",
      back: { type: "invoice", id },
      onConfirm: () => {
        x.status = "ملغاة";
        toast("تم إلغاء الفاتورة", x.id, "danger");
        refresh({ type: "invoice", id });
      },
    });
  };

  /* ---------- CSV export ---------- */
  const downloadCSV = (name, headers, rows) => {
    const cell = (c) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinicflow-${name}-${iso(TODAY)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("تم تصدير الملف", `${link.download} — ${rows.length} سجل`, "info");
  };

  const EXPORTS = {
    patients: () => ["patients", ["رقم الملف", "الاسم", "العمر", "الجنس", "الجوال", "آخر زيارة", "الحالة", "تاريخ التسجيل"],
      filteredPatients().map((p) => { const lv = lastVisit(p); return [p.id, p.name, p.age, p.gender, p.phone, lv ? iso(lv.date) : "", p.status, iso(p.registered)]; })],
    appointments: () => ["appointments", ["رقم الموعد", "التاريخ", "الوقت", "المريض", "الطبيب", "العيادة", "نوع الموعد", "الحالة"],
      filteredAppts().map((a) => [a.id, iso(a.date), a.time, findPatient(a.patientId).name, findDoctor(a.doctorId).name, findClinic(a.clinicId).name, a.type, a.status])],
    invoices: () => ["invoices", ["رقم الفاتورة", "المريض", "الخدمة", "المبلغ (ر.س)", "التاريخ", "الحالة", "طريقة الدفع"],
      filteredInvoices().map((x) => [x.id, findPatient(x.patientId).name, x.service, x.amount, iso(x.date), x.status, x.method])],
    summary: () => {
      const rows = [];
      REPORT_KEYS.forEach((key) => {
        const r = buildReport(key);
        rows.push([r.title, "", ""]);
        r.summary.forEach(([l, v]) => rows.push(["", l, v]));
      });
      return ["report-summary", ["التقرير", "المؤشر", "القيمة"], rows];
    },
  };
  REPORT_KEYS.forEach((key) => {
    EXPORTS[`report-${key}`] = () => {
      const r = buildReport(key);
      return [`report-${key}`, r.headers, r.rows];
    };
  });
  const exportCSV = (key) => downloadCSV(...EXPORTS[key]());

  /* =========================================================
     Toasts
     ========================================================= */
  const TOASTS = { success: ["check", "tone-green"], info: ["download", "tone-sky"], warning: ["alert", "tone-amber"], danger: ["ban", "tone-rose"], notify: ["bell", "tone-teal"] };
  const toast = (title, text = "", type = "success") => {
    const [ic, tone] = TOASTS[type];
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = `<span class="alerts__icon ${tone}">${icon(ic)}</span>
      <div class="toast__body"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}</div>
      <button class="icon-btn" type="button" aria-label="إغلاق التنبيه">${icon("x")}</button>`;
    let gone = false;
    const remove = () => {
      if (gone) return;
      gone = true;
      el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    };
    $("button", el).addEventListener("click", remove);
    const box = $("#toasts");
    box.append(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(remove, 4200);
  };

  /* =========================================================
     Global search (command palette)
     ========================================================= */
  const palette = $("#palette");
  const pInput = $("#paletteInput");
  const pResults = $("#paletteResults");
  let pIndex = 0;

  const mark = (text, q) => {
    const raw = String(text);
    const needle = q.trim();
    const at = needle ? raw.indexOf(needle) : -1;
    if (at < 0) return esc(raw);
    return `${esc(raw.slice(0, at))}<mark>${esc(needle)}</mark>${esc(raw.slice(at + needle.length))}`;
  };

  const paletteItem = (attrs, lead, title, sub, side = "") =>
    `<button type="button" class="palette__item" role="option" ${attrs}>${lead}<span class="list-body"><b>${title}</b><small>${sub}</small></span>${side}</button>`;

  const renderPalette = () => {
    const q = pInput.value;
    const groups = [];
    if (!q.trim()) {
      groups.push(["إجراءات سريعة", [
        paletteItem('data-action="add-patient"', `<span class="alerts__icon tone-teal">${icon("plus")}</span>`, "إضافة مريض جديد", "إنشاء ملف مريض"),
        paletteItem('data-action="add-appointment"', `<span class="alerts__icon tone-sky">${icon("calendar-plus")}</span>`, "حجز موعد جديد", "اختيار الطبيب والوقت"),
        paletteItem('data-view="appointments" data-set="appts.scope=today"', `<span class="alerts__icon tone-violet">${icon("calendar")}</span>`, "مواعيد اليوم", `${APPTS.filter((a) => daysFrom(a.date) === 0 && isActive(a)).length} موعد`),
        paletteItem('data-view="invoices" data-set="invoices.status=معلقة"', `<span class="alerts__icon tone-amber">${icon("receipt")}</span>`, "الفواتير المعلقة", `${INVOICES.filter((x) => x.status === "معلقة").length} فاتورة`),
      ]]);
      groups.push(["مرضى حديثون", [...PATIENTS].sort((a, b) => b.registered - a.registered).slice(0, 3)
        .map((p) => paletteItem(`data-open="patient:${p.id}"`, avatar(p.name, "avatar--sm"), esc(p.name), `<span class="code">${p.id}</span>`, badge(p.status, PATIENT_STATUS[p.status])))]);
    } else {
      const pts = PATIENTS.filter((p) => matches(`${p.name} ${p.id} ${p.phone}`, q)).slice(0, 4);
      if (pts.length) groups.push(["المرضى", pts.map((p) => paletteItem(`data-open="patient:${p.id}"`, avatar(p.name, "avatar--sm"), mark(p.name, q), `${mark(p.id, q)} · <span class="num">${mark(p.phone, q)}</span>`, badge(p.status, PATIENT_STATUS[p.status])))]);
      const aps = APPTS.filter((a) => matches(`${a.id} ${findPatient(a.patientId).name} ${findDoctor(a.doctorId).name} ${a.type}`, q))
        .sort((a, b) => Math.abs(stamp(a) - Date.now()) - Math.abs(stamp(b) - Date.now()))
        .slice(0, 5);
      if (aps.length) groups.push(["المواعيد", aps.map((a) => paletteItem(`data-open="appt:${a.id}"`, `<span class="alerts__icon tone-sky">${icon("calendar")}</span>`, `${mark(findPatient(a.patientId).name, q)} — ${a.type}`, `${mark(a.id, q)} · ${dayLabel(a.date)} ${fmtTime(a.time)} · ${mark(findDoctor(a.doctorId).name, q)}`, badge(a.status, APPT_STATUS[a.status])))]);
      const docs = DOCTORS.filter((d) => matches(`${d.name} ${d.specialty} ${findClinic(d.clinicId).name}`, q)).slice(0, 4);
      if (docs.length) groups.push(["الأطباء", docs.map((d) => paletteItem(`data-open="doctor:${d.id}"`, avatar(d.name, "avatar--sm"), mark(d.name, q), `${mark(d.specialty, q)} · ${findClinic(d.clinicId).name}`, badge(d.status, DOCTOR_STATUS[d.status])))]);
      const invs = INVOICES.filter((x) => matches(`${x.id} ${findPatient(x.patientId).name} ${x.service}`, q)).sort((a, b) => b.date - a.date).slice(0, 4);
      if (invs.length) groups.push(["الفواتير", invs.map((x) => paletteItem(`data-open="invoice:${x.id}"`, `<span class="alerts__icon tone-amber">${icon("receipt")}</span>`, `${mark(x.id, q)} — ${fmtMoney(x.amount)}`, `${mark(findPatient(x.patientId).name, q)} · ${mark(x.service, q)}`, badge(x.status, INV_STATUS[x.status])))]);
    }
    pResults.innerHTML = groups.length
      ? groups.map(([label, items]) => `<div class="palette__group">${label}</div>${items.join("")}`).join("")
      : `<div class="palette__empty">${icon("search")}لا توجد نتائج لـ «${esc(q)}»<br><small>جرّب اسم مريض أو رقم ملف مثل CF-10231</small></div>`;
    pIndex = 0;
    highlightPalette();
  };

  const highlightPalette = () => {
    const items = $$(".palette__item", pResults);
    items.forEach((el, i) => el.classList.toggle("active", i === pIndex));
    if (items[pIndex]) items[pIndex].scrollIntoView({ block: "nearest" });
  };

  const openPalette = () => {
    closePops();
    if (modal.classList.contains("open")) closeModal();
    palette.classList.add("open");
    palette.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    pInput.value = "";
    renderPalette();
    void palette.offsetWidth; // apply the visible state so the input can take focus right away
    pInput.focus();
  };
  const closePalette = () => {
    if (!palette.classList.contains("open")) return;
    palette.classList.remove("open");
    palette.setAttribute("aria-hidden", "true");
    if (!sidebar.classList.contains("open") && !modal.classList.contains("open")) document.body.classList.remove("locked");
  };

  pInput.addEventListener("input", renderPalette);
  pInput.addEventListener("keydown", (e) => {
    const items = $$(".palette__item", pResults);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      pIndex = (pIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      highlightPalette();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[pIndex]) items[pIndex].click();
    }
  });
  $("#searchTrigger").addEventListener("click", openPalette);
  $("[data-palette-close]").addEventListener("click", closePalette);

  /* =========================================================
     Theme & settings
     ========================================================= */
  const settingsForm = $("#settingsForm");
  const currentTheme = () => document.documentElement.getAttribute("data-theme") || "light";
  const applyTheme = (theme, announce = false) => {
    document.documentElement.setAttribute("data-theme", theme);
    $('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#081312" : "#0b3d3a");
    try {
      localStorage.setItem("clinicflow-theme", theme);
    } catch (e) {}
    settingsForm.elements.dark.checked = theme === "dark";
    if (state.view === "dashboard" && renderDashboard.revenueArgs) renderArea($("#revenueChart"), ...renderDashboard.revenueArgs, "الإيرادات (ر.س)");
    if (announce) toast(theme === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع النهاري", "", "notify");
  };
  const toggleTheme = () => applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
  $("#themeToggle").addEventListener("click", toggleTheme);

  const HOURS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);
  const fillSettings = () => {
    const f = settingsForm.elements;
    const s = state.settings;
    f.open.innerHTML = HOURS.map((h) => `<option value="${h}">${fmtTime(h)}</option>`).join("");
    f.close.innerHTML = HOURS.map((h) => `<option value="${h}">${fmtTime(h)}</option>`).join("");
    f.name.value = s.name;
    f.email.value = s.email;
    f.open.value = s.open;
    f.close.value = s.close;
    f.duration.value = s.duration;
    f.reminders.checked = s.reminders;
    f.notifyNew.checked = s.notifyNew;
    f.notifyInvoices.checked = s.notifyInvoices;
    f.dark.checked = currentTheme() === "dark";
  };
  const saveSettings = () => {
    try {
      localStorage.setItem("clinicflow-settings", JSON.stringify(state.settings));
    } catch (e) {}
  };

  settingsForm.elements.dark.addEventListener("change", (e) => applyTheme(e.target.checked ? "dark" : "light", true));
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = settingsForm.elements;
    if (!f.name.value.trim()) {
      f.name.focus();
      return toast("اسم المجمع مطلوب", "", "warning");
    }
    if (toMin(f.close.value) <= toMin(f.open.value)) return toast("وقت نهاية الدوام يجب أن يكون بعد بدايته", "", "warning");
    state.settings = {
      name: f.name.value.trim(), email: f.email.value.trim(), open: f.open.value, close: f.close.value, duration: f.duration.value,
      reminders: f.reminders.checked, notifyNew: f.notifyNew.checked, notifyInvoices: f.notifyInvoices.checked,
    };
    saveSettings();
    renderAll();
    toast("تم حفظ الإعدادات", "طُبّقت التفضيلات الجديدة");
  });
  $("#resetSettings").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    applyTheme("light");
    fillSettings();
    renderAll();
    toast("تمت استعادة الإعدادات الافتراضية", "", "notify");
  });

  /* =========================================================
     Filters
     ========================================================= */
  const bindFilter = (sel, key, prop, evt = "input") =>
    $(sel).addEventListener(evt, (e) => {
      state[key][prop] = e.target.value;
      state[key].page = 1;
      RENDERERS[key]();
    });
  const RENDERERS = { patients: renderPatients, appts: renderAppointments, invoices: renderInvoices };
  bindFilter("#patientSearch", "patients", "q");
  bindFilter("#patientStatus", "patients", "status", "change");
  bindFilter("#patientGender", "patients", "gender", "change");
  $("#patientSort").addEventListener("change", (e) => {
    state.patients.sort = e.target.value;
    state.patients.dir = e.target.value === "lastVisit" ? -1 : 1;
    renderPatients();
  });
  bindFilter("#apptSearch", "appts", "q");
  bindFilter("#apptStatus", "appts", "status", "change");
  bindFilter("#apptDoctor", "appts", "doctor", "change");
  bindFilter("#invSearch", "invoices", "q");
  $("#apptReset").addEventListener("click", () => {
    state.appts = { q: "", status: "all", doctor: "all", scope: "week", page: 1 };
    renderAppointments();
  });

  // "data-set" lets a link pre-set a filter, e.g. data-set="invoices.status=معلقة"
  const applySet = (spec) => {
    if (!spec) return;
    const [path, value] = spec.split("=");
    const [key, prop] = path.split(".");
    if (key === "appts") state.appts = { q: "", status: "all", doctor: "all", scope: "upcoming", page: 1 };
    if (key === "invoices") state.invoices = { q: "", status: "all", page: 1 };
    state[key][prop] = value;
    RENDERERS[key]();
  };

  /* =========================================================
     Event delegation
     ========================================================= */
  const ACTIONS = {
    "add-patient": () => openAddPatient(),
    "add-appointment": (el) => openApptForm({ patientId: el.dataset.patient || "", doctorId: el.dataset.doctor || "", clinicId: el.dataset.clinic || "" }),
    "view-appt": (el) => openAppt(el.dataset.id),
    "edit-appt": (el) => openApptForm({ appt: findAppt(el.dataset.id) }),
    "confirm-appt": (el) => confirmAppt(el.dataset.id),
    "complete-appt": (el) => completeAppt(el.dataset.id),
    "cancel-appt": (el) => cancelAppt(el.dataset.id),
    "view-invoice": (el) => openInvoice(invoiceOf(findAppt(el.dataset.id)).id),
    collect: (el) => collectInvoice(el.dataset.id),
    "cancel-invoice": (el) => cancelInvoice(el.dataset.id),
    "open-report": (el) => openReport(el.dataset.report),
    export: (el) => exportCSV(el.dataset.export),
    read: (el) => {
      markRead(el.dataset.id);
      toast("تم تحديد الإشعار كمقروء", "", "notify");
    },
    "read-all": () => {
      state.notifications.forEach((n) => (n.read = true));
      renderNotifications();
      renderCounts();
      toast("تم تحديد جميع الإشعارات كمقروءة", "", "notify");
    },
    "toggle-theme": () => {
      closePops();
      toggleTheme();
    },
    "form-back": () => goBack(),
  };

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.closest(".pop")) closePops();
    else if (!t.closest("[data-menu]") && !t.closest("#rowMenu")) closeRowMenu();

    const inPalette = t.closest("#palette");
    const trigger = t.closest("[data-page], [data-menu], [data-action], th[data-sort], [data-seg], [data-view], [data-open], [data-notif]");
    if (!trigger) {
      if (!t.closest("#rowMenu")) closeRowMenu();
      return;
    }
    if (inPalette && !trigger.matches("[data-palette-close]")) closePalette();

    if (trigger.matches("[data-page]")) {
      const [key, page] = trigger.dataset.page.split(":");
      state[key].page = Number(page);
      RENDERERS[key]();
      const table = $(key === "appts" ? "#apptTable" : key === "invoices" ? "#invTable" : "#patientsTable");
      table.closest(".card").scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (trigger.matches("[data-menu]")) {
      e.stopPropagation();
      return openRowMenu(trigger);
    }
    if (trigger.matches("[data-notif]")) {
      const n = state.notifications.find((x) => x.id === trigger.dataset.notif);
      closePops();
      markRead(n.id);
      const [type, id] = n.target.split(":");
      return OPENERS[type] && OPENERS[type](id);
    }
    if (trigger.matches("[data-action]")) {
      e.preventDefault();
      closeRowMenu();
      return ACTIONS[trigger.dataset.action](trigger);
    }
    if (trigger.matches("th[data-sort]")) {
      const [, key] = trigger.dataset.sort.split(":");
      const f = state.patients;
      f.dir = f.sort === key ? -f.dir : key === "lastVisit" ? -1 : 1;
      f.sort = key;
      return renderPatients();
    }
    if (trigger.matches("[data-seg]")) {
      const path = trigger.dataset.seg;
      const value = trigger.dataset.value;
      if (path === "doctorsTab") {
        state.doctorsTab = value;
        return renderDoctors();
      }
      if (path === "notifTab") {
        state.notifTab = value;
        return renderNotifications();
      }
      const [key, prop] = path.split(".");
      state[key][prop] = value;
      state[key].page = 1;
      return RENDERERS[key]();
    }
    if (trigger.matches("[data-view]")) {
      e.preventDefault();
      applySet(trigger.dataset.set);
      closeModal();
      return navigate(trigger.dataset.view);
    }
    if (trigger.matches("[data-open]")) {
      closeRowMenu();
      const [type, id] = trigger.dataset.open.split(":");
      return OPENERS[type] && OPENERS[type](id);
    }
  });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      if (!palette.classList.contains("open")) openPalette();
      return;
    }
    if (e.key === "Escape") {
      if (palette.classList.contains("open")) return closePalette();
      if (rowMenu.classList.contains("open")) return closeRowMenu();
      if (modal.classList.contains("open")) return closeModal();
      if (pops.some((p) => p.classList.contains("open"))) return closePops();
      if (sidebar.classList.contains("open")) return setSidebar(false);
    }
    if (e.key === "Enter" && !typing && e.target.matches && e.target.matches("[data-open], [data-notif], [data-view].alerts__item")) {
      e.preventDefault();
      e.target.click();
    }
    // Keep focus inside the open modal
    if (e.key === "Tab" && modal.classList.contains("open")) {
      const focusable = $$('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]', modalBox).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modalBox)) {
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
      if (state.view === "dashboard" && renderDashboard.revenueArgs) renderArea($("#revenueChart"), ...renderDashboard.revenueArgs, "الإيرادات (ر.س)");
      if (!isCompact() && sidebar.classList.contains("open")) setSidebar(false);
    }, 150);
  });

  /* =========================================================
     Live demo events: new online bookings arrive while presenting
     ========================================================= */
  let liveCount = 0;
  const simulateBooking = () => {
    if (liveCount >= 3) return;
    const doctors = DOCTORS.filter((d) => d.status !== "غير متاح");
    for (let tries = 0; tries < 30; tries++) {
      const doctor = pick(doctors);
      const off = 1 + Math.floor(rnd() * 3);
      const time = pick(SLOTS.filter((t) => toMin(t) >= toMin(state.settings.open) && toMin(t) < toMin(state.settings.close)));
      const taken = APPTS.some((a) => a.doctorId === doctor.id && daysFrom(a.date) === off && a.time === time && isActive(a));
      const patients = PATIENTS.filter((p) => canSee(doctor, p) && p.status !== "غير نشط");
      if (taken || !patients.length) continue;
      const patient = pick(patients);
      const clinic = findClinic(doctor.clinicId);
      const a = { id: `AP-${++apptSeq}`, patientId: patient.id, doctorId: doctor.id, clinicId: clinic.id, date: addDays(off), time, type: pick(clinic.types), status: "بانتظار التأكيد", notes: "الحجز عبر التطبيق." };
      APPTS.push(a);
      liveCount += 1;
      if (state.settings.notifyNew)
        pushNotification({ type: "new", title: "موعد جديد", text: `حجز ${patient.name} موعد ${a.type} ${dayLabel(a.date)} الساعة ${fmtTime(a.time)} عبر التطبيق`, target: `appt:${a.id}` });
      renderAll();
      toast("موعد جديد عبر التطبيق", `${patient.name} — ${dayLabel(a.date)} ${fmtTime(a.time)}`, "notify");
      return;
    }
  };

  /* =========================================================
     Init
     ========================================================= */
  $("#pageDate").textContent = FMT.long.format(TODAY);
  buildNotifications();
  fillSettings();
  renderAll();
  showView(location.hash.slice(1));
  setInterval(simulateBooking, 45000);
})();
