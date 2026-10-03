/* =========================================================
   AZENK HR — utilities (no dependencies)
   ========================================================= */
(function (EHR) {
  "use strict";

  // View registry: modules register pages before the shell (script.js) boots
  EHR.VIEWS = EHR.VIEWS || {};
  EHR.view = (key, def) => (EHR.VIEWS[key] = def);

  const U = {};
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- DOM ---------- */
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  U.icon = (name, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ---------- Dates (ISO yyyy-mm-dd strings everywhere) ---------- */
  const LOCALE = "ar-SA-u-ca-gregory-nu-latn";
  const F = {
    date: new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" }),
    short: new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }),
    long: new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    month: new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }),
    monthShort: new Intl.DateTimeFormat(LOCALE, { month: "short" }),
    weekday: new Intl.DateTimeFormat(LOCALE, { weekday: "long" }),
    weekdayShort: new Intl.DateTimeFormat(LOCALE, { weekday: "short" }),
  };
  U.iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.parse = (s) => {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  U.today = () => U.iso(new Date());
  U.addDays = (iso, n) => {
    const d = U.parse(iso);
    d.setDate(d.getDate() + n);
    return U.iso(d);
  };
  U.addMonths = (iso, n) => {
    const d = U.parse(iso);
    d.setMonth(d.getMonth() + n);
    return U.iso(d);
  };
  U.diffDays = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 86400000);
  U.daysFromToday = (iso) => U.diffDays(U.today(), iso);
  U.dayOfWeek = (iso) => U.parse(iso).getDay(); // 0 = Sunday
  U.monthKey = (iso) => iso.slice(0, 7);
  U.fmtDate = (iso) => (iso ? F.date.format(U.parse(iso)) : "—");
  U.fmtShort = (iso) => (iso ? F.short.format(U.parse(iso)) : "—");
  U.fmtLong = (iso) => (iso ? F.long.format(U.parse(iso)) : "—");
  U.fmtMonth = (key) => F.month.format(U.parse(`${key}-01`));
  U.fmtMonthShort = (key) => F.monthShort.format(U.parse(`${key}-01`));
  U.weekday = (iso) => F.weekday.format(U.parse(iso));
  U.weekdayShort = (iso) => F.weekdayShort.format(U.parse(iso));
  U.WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  /* ---------- Times (HH:MM strings) ---------- */
  U.toMin = (t) => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  U.fromMin = (m) => {
    const v = ((Math.round(m) % 1440) + 1440) % 1440;
    return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
  };
  U.nowTime = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  U.nowMin = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  U.fmtTime = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "ص" : "م"}`;
  };
  U.fmtDuration = (min) => {
    if (min == null || isNaN(min)) return "—";
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r} د`;
    return r ? `${h} س ${r} د` : `${h} س`;
  };
  U.stamp = () => new Date().toISOString();
  U.fmtStamp = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${U.fmtDate(U.iso(d))} · ${U.fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
  };
  U.dayPhrase = (n) => (n === 1 ? "يوم" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يومًا`);
  U.relDays = (iso) => {
    const n = U.daysFromToday(iso);
    if (n === 0) return "اليوم";
    if (n === 1) return "غدًا";
    if (n === -1) return "أمس";
    return n > 0 ? `بعد ${U.dayPhrase(n)}` : `منذ ${U.dayPhrase(-n)}`;
  };
  U.ago = (ts) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(ts)) / 60000));
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m === 1 ? "دقيقة" : m === 2 ? "دقيقتين" : m <= 10 ? `${m} دقائق` : `${m} دقيقة`}`;
    const h = Math.round(m / 60);
    if (h < 24) return `منذ ${h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? `${h} ساعات` : `${h} ساعة`}`;
    return `منذ ${U.dayPhrase(Math.round(h / 24))}`;
  };

  /* ---------- Numbers ---------- */
  U.num = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-US"));
  U.money = (n) => `${U.num(n)} ر.س`;
  U.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  U.sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

  /* ---------- Misc ---------- */
  U.uid = (prefix = "ID") => `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.debounce = (fn, ms = 200) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  U.groupBy = (arr, fn) =>
    arr.reduce((m, x) => {
      const k = fn(x);
      (m[k] = m[k] || []).push(x);
      return m;
    }, {});
  U.hue = (str) => Array.from(String(str)).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  U.initials = (name) => {
    const words = String(name || "?").replace(/^(د\.|م\.|أ\.)\s*/, "").split(/\s+/).filter(Boolean);
    const first = words[0] || "?";
    const last = words.length > 1 ? words[words.length - 1].replace(/^ال/, "") : "";
    return last ? `${first[0]}${last[0]}` : first.slice(0, 2);
  };

  // Arabic-aware normalisation for search
  U.normalize = (s) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/[ً-ٟـ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();
  U.matches = (hay, q) => {
    const words = U.normalize(q).split(" ").filter(Boolean);
    if (!words.length) return true;
    const h = U.normalize(hay);
    return words.every((w) => h.includes(w));
  };

  /* ---------- Geofence: Haversine distance in metres ---------- */
  U.haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  // Move a point by a distance (metres) along a bearing — used by the location simulator
  U.offsetPoint = (lat, lng, meters, bearingDeg = 45) => {
    const R = 6371000;
    const br = (bearingDeg * Math.PI) / 180;
    const la1 = (lat * Math.PI) / 180;
    const lo1 = (lng * Math.PI) / 180;
    const d = meters / R;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
    const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: (la2 * 180) / Math.PI, lng: (lo2 * 180) / Math.PI };
  };

  /* ---------- Export & print ---------- */
  U.downloadCSV = (name, headers, rows) => {
    const cell = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `easyhr-${name}-${U.today()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return a.download;
  };

  // Print arbitrary HTML in an isolated frame with a clean A4 stylesheet
  U.printHTML = (title, html) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:0;bottom:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${U.esc(title)}</title>
      <style>
        body{font-family:"Segoe UI",Tahoma,"Noto Sans Arabic",sans-serif;color:#101828;margin:28px;font-size:13px;line-height:1.7}
        h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #2451d6;padding-bottom:4px}
        .muted{color:#667085} table{width:100%;border-collapse:collapse;margin-top:6px}
        th,td{border:1px solid #d0d5dd;padding:6px 8px;text-align:right;vertical-align:top} th{background:#f2f4f7}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #d0d5dd;padding-bottom:12px;margin-bottom:12px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 18px} .grid div{border-bottom:1px dashed #e4e7ec;padding:4px 0}
        .grid small{display:block;color:#667085;font-size:11px} .total{font-size:16px;font-weight:700}
        .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:48px}.sign div{border-top:1px solid #98a2b3;padding-top:6px;text-align:center}
        .demo{margin-top:24px;font-size:11px;color:#98a2b3;text-align:center}
      </style></head><body>${html}<p class="demo">مستند تجريبي صادر من نسخة عرض AZENK HR — البيانات وهمية.</p></body></html>`);
    doc.close();
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        /* printing unavailable (e.g. headless) */
      }
      setTimeout(() => frame.remove(), 1000);
    }, 150);
  };

  /* ---------- Deterministic PRNG for demo data ---------- */
  U.prng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  EHR.U = U;
})((window.EHR = window.EHR || {}));
