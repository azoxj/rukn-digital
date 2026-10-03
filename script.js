/* =========================================================
   AZENK — site script (shared by every page)
   - Header / mobile navigation / footer / floating WhatsApp
   - Arabic (RTL) ⇄ English (LTR) language switch
   - WhatsApp links generated from config.js (one number, one place)
   - Systems, services and work rendered from data.js
   - Solution finder (rule-based) and request forms → organised
     WhatsApp messages
   No libraries, no payments, no backend.
   ========================================================= */
(() => {
  "use strict";

  const CFG = window.AZENK_CONFIG || {};
  const DATA = window.AZENK_DATA || { services: [], products: [], work: [], categories: [] };
  const EN = window.AZENK_EN || {};
  const doc = document.documentElement;
  const body = document.body;
  const ROOT = body.dataset.root || "";
  const PAGE = body.dataset.page || "home";
  const LANG_KEY = "azenk:lang";

  doc.classList.remove("no-js");
  // Reveal animations are enabled only by this script, so content stays visible if JS fails
  doc.classList.add("az-js");

  /* =========================================================
     Language
     ========================================================= */
  const readLang = () => {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "ar" || q === "en") return q;
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "ar" || saved === "en") return saved;
    } catch (e) {
      /* storage blocked */
    }
    return CFG.DEFAULT_LANG || "ar";
  };
  let lang = readLang();
  const t = (v) => (v && typeof v === "object" ? v[lang] ?? v.ar ?? "" : v ?? "");

  // UI strings used by the script-rendered parts (header, footer, cards, modal, form)
  const UI = {
    home: { ar: "الرئيسية", en: "Home" },
    products: { ar: "الأنظمة", en: "Systems" },
    solutions: { ar: "الحلول", en: "Solutions" },
    build: { ar: "ابنِ نظامك", en: "Build your system" },
    services: { ar: "الخدمات", en: "Services" },
    work: { ar: "أعمالنا", en: "Our Work" },
    about: { ar: "من نحن", en: "About" },
    contact: { ar: "تواصل معنا", en: "Contact" },
    startProject: { ar: "اطلب حلًا", en: "Request a solution" },
    menu: { ar: "القائمة", en: "Menu" },
    openMenu: { ar: "فتح القائمة", en: "Open menu" },
    closeMenu: { ar: "إغلاق القائمة", en: "Close menu" },
    langSwitch: { ar: "English", en: "العربية" },
    langLabel: { ar: "Switch to English", en: "التبديل إلى العربية" },
    tiktok: { ar: "AZENK على TikTok", en: "AZENK on TikTok" },
    tiktokSoon: { ar: "حساب TikTok — سيُضاف الرابط قريبًا", en: "TikTok account — link coming soon" },
    whatsapp: { ar: "واتساب", en: "WhatsApp" },
    waFloat: { ar: "تواصل عبر واتساب", en: "Chat on WhatsApp" },
    email: { ar: "البريد الإلكتروني", en: "Email" },
    footerAbout: {
      ar: "علامة رقمية تطوّر الحلول التقنية والمنتجات الرقمية والخدمات الإبداعية للأفراد والشركات.",
      en: "A digital brand building technology solutions, digital products and creative services for individuals and businesses.",
    },
    footerSite: { ar: "الموقع", en: "Site" },
    footerServices: { ar: "الخدمات", en: "Services" },
    footerContact: { ar: "تواصل", en: "Contact" },
    rights: { ar: "جميع الحقوق محفوظة.", en: "All rights reserved." },
    orderNow: { ar: "اطلب الآن", en: "Order now" },
    details: { ar: "التفاصيل", en: "Details" },
    explore: { ar: "استكشف النظام", en: "Explore the system" },
    tryDemo: { ar: "جرّب الـ Demo", en: "Try the demo" },
    tryNow: { ar: "جرّب الآن", en: "Try it now" },
    requestDemo: { ar: "اطلب Demo", en: "Request a demo" },
    requestQuote: { ar: "اطلب عرض السعر", en: "Request a quote" },
    problemLabel: { ar: "المشكلة التي يحلها", en: "The problem it solves" },
    runtimeBrowser: { ar: "يعمل في المتصفح", en: "Runs in the browser" },
    runtimeServer: { ar: "خادم + قاعدة بيانات", en: "Server + database" },
    runtimeBrowserNote: { ar: "نسخة تعمل في المتصفح، والبيانات تُحفظ على جهازك.", en: "Runs in the browser; data is stored on your device." },
    runtimeServerNote: { ar: "نظام بخادم وقاعدة بيانات وحسابات وصلاحيات. اطلب Demo ونجهّز لك حسابًا خاصًا بمنشأتك ببيانات تجريبية، صالحًا لمدة 24 ساعة من أول دخول.", en: "A server system with a database, accounts and permissions. Request a demo and we set up a private account for you with sample data, valid for 24 hours from your first sign-in." },
    demoCenterLogin: { ar: "تسجيل الدخول إلى Demo Center", en: "Sign in to Demo Center" },
    relatedSystems: { ar: "أنظمة ذات صلة", en: "Related systems" },
    requestService: { ar: "اطلب الخدمة", en: "Request service" },
    priceOnRequest: { ar: "السعر عند الطلب", en: "Price on request" },
    features: { ar: "المزايا", en: "Features" },
    watchDemo: { ar: "شاهد Demo", en: "View demo" },
    prodReady: { ar: "جاهز", en: "Ready" },
    prodDemo: { ar: "Demo متاح", en: "Demo available" },
    prodDev: { ar: "قيد التطوير", en: "In development" },
    previewSoon: { ar: "المعاينة متاحة عند الإطلاق", en: "Preview available at launch" },
    preview: { ar: "معاينة", en: "Preview" },
    similar: { ar: "اطلب مشروعًا مشابهًا", en: "Request a similar project" },
    all: { ar: "الكل", en: "All" },
    close: { ar: "إغلاق", en: "Close" },
    statusDemo: { ar: "نموذج تجريبي", en: "Demo" },
    statusLive: { ar: "مشروع منشور", en: "Live project" },
    statusConcept: { ar: "تصور تصميمي", en: "Design concept" },
    emptyCategory: { ar: "لا توجد أعمال منشورة في هذا التصنيف بعد.", en: "No published work in this category yet." },
    emptyCta: { ar: "اطلب مشروعك الأول في هذا المجال", en: "Request your project in this field" },
    illustrative: { ar: "صورة توضيحية", en: "Illustration" },
    noNumber: {
      ar: "رقم واتساب لم يُضبط بعد. يمكنك التواصل عبر البريد الإلكتروني.",
      en: "The WhatsApp number is not set yet. You can reach us by email.",
    },
    formSent: {
      ar: "تم تجهيز رسالتك في واتساب. أرسلها من هناك وسنتواصل معك قريبًا.",
      en: "Your message is ready in WhatsApp. Send it from there and we will get back to you soon.",
    },
    errName: { ar: "يرجى إدخال الاسم", en: "Please enter your name" },
    errPhone: { ar: "يرجى إدخال رقم جوال صحيح، مثل 05XXXXXXXX", en: "Please enter a valid mobile number, e.g. 05XXXXXXXX" },
    errEmail: { ar: "صيغة البريد الإلكتروني غير صحيحة", en: "Please enter a valid email address" },
    errService: { ar: "يرجى اختيار النوع", en: "Please choose a type" },
    errBusiness: { ar: "يرجى كتابة النشاط أو اسم الجهة", en: "Please enter your business or organisation" },
    mailSent: { ar: "تم فتح برنامج البريد برسالة جاهزة. أرسلها من هناك.", en: "Your mail app opened with a ready message. Send it from there." },
    errDetails: { ar: "يرجى كتابة تفاصيل المشروع (10 أحرف على الأقل)", en: "Please describe your project (at least 10 characters)" },
    optReady: { ar: "نظام جاهز من أنظمة AZENK", en: "A ready AZENK system" },
    optCustom: { ar: "مشروع مخصص", en: "Custom project" },
    optOther: { ar: "أخرى", en: "Other" },
    choose: { ar: "اختر نوع الخدمة", en: "Choose a service" },
  };
  const ui = (k) => t(UI[k]);

  /* =========================================================
     WhatsApp (single source: CFG.WHATSAPP_NUMBER)
     ========================================================= */
  // A placeholder such as "966XXXXXXXXX" is never published as a link
  const RAW_NUMBER = String(CFG.WHATSAPP_NUMBER || "").trim();
  const waReady = /^\d{8,15}$/.test(RAW_NUMBER);
  const WA_NUMBER = waReady ? RAW_NUMBER : "";
  const waHref = (text) => (waReady ? `https://wa.me/${WA_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null);

  // AZENK Demo Center (CFG.DEMO_CENTER_URL): only the «تسجيل الدخول إلى Demo Center» link; hidden while empty.
  // Demo requests always go to AZENK's regular WhatsApp with a ready message (no WhatsApp API or bot).
  const DEMO_CENTER = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)[^\s?#]*$/.test(String(CFG.DEMO_CENTER_URL || "")) ? String(CFG.DEMO_CENTER_URL).replace(/\/+$/, "") : "";
  const demoCenterLink = (cls) => (DEMO_CENTER ? `<a class="${cls}" href="${esc(DEMO_CENTER)}/#/login" rel="noopener">${ui("demoCenterLogin")}</a>` : "");
  const phoneDisplay = () => {
    if (!waReady) return "—";
    if (WA_NUMBER.startsWith("966") && WA_NUMBER.length === 12) return `+966 ${WA_NUMBER.slice(3, 5)} ${WA_NUMBER.slice(5, 8)} ${WA_NUMBER.slice(8)}`;
    return `+${WA_NUMBER}`;
  };
  const findProduct = (id) => DATA.products.find((p) => p.id === id);
  const findService = (id) => DATA.services.find((s) => s.id === id);
  const findWork = (id) => DATA.work.find((w) => w.id === id);

  // Message for each data-wa key ("start", "general", "service:web", "product:azenk-hr",
  // "demo:azenk-callcenter", "quote:azenk-hr", "work:azenk-site"). Requests carry
  // empty fields for the customer to fill in WhatsApp.
  const form = (lines) => lines.join("\n");
  const fieldsAr = ["الاسم:", "النشاط:", "عدد المستخدمين:", "ملاحظات:"];
  const fieldsEn = ["Name:", "Business:", "Number of users:", "Notes:"];
  const waMessages = {
    start: () => (lang === "ar"
      ? form(["السلام عليكم، أرغب في طلب حل تقني من AZENK.", "", "الاسم:", "النشاط:", "الاحتياج:", "ملاحظات:"])
      : form(["Hello, I would like to request a technology solution from AZENK.", "", "Name:", "Business:", "Need:", "Notes:"])),
    general: () => (lang === "ar" ? "السلام عليكم، أرغب في التواصل مع AZENK." : "Hello, I would like to get in touch with AZENK."),
    service: (id) => {
      const sv = findService(id);
      if (!sv) return waMessages.general();
      return lang === "ar"
        ? form([`السلام عليكم، أرغب في خدمة «${t(sv.title)}» من AZENK.`, "", "الاسم:", "النشاط:", "تفاصيل الطلب:"])
        : form([`Hello, I would like AZENK's "${t(sv.title)}" service.`, "", "Name:", "Business:", "Request details:"]);
    },
    product: (id) => {
      const p = findProduct(id);
      if (!p) return waMessages.general();
      return lang === "ar" ? form([`السلام عليكم، أرغب في معرفة تفاصيل نظام ${p.name}.`, "", ...fieldsAr]) : form([`Hello, I would like to know the details of ${p.name}.`, "", ...fieldsEn]);
    },
    demo: (id) => {
      const p = findProduct(id);
      if (!p) return waMessages.general();
      return lang === "ar"
        ? form(["السلام عليكم،", `أرغب في تجربة نظام ${p.name}.`, "", "الاسم:", "اسم المنشأة:", "عدد المستخدمين:", "ملاحظات:"])
        : form(["Hello,", `I would like to try ${p.name}.`, "", "Name:", "Company name:", "Number of users:", "Notes:"]);
    },
    quote: (id) => {
      const p = findProduct(id);
      if (!p) return waMessages.general();
      return lang === "ar" ? form([`السلام عليكم، أرغب في عرض سعر لنظام ${p.name}.`, "", ...fieldsAr]) : form([`Hello, I would like a quote for ${p.name}.`, "", ...fieldsEn]);
    },
    work: (id) => {
      const w = findWork(id);
      const name = w ? w.title : "";
      return lang === "ar" ? form([`السلام عليكم، أرغب في مشروع مشابه لـ ${name} من AZENK.`, "", "الاسم:", "النشاط:", "تفاصيل الطلب:"]) : form([`Hello, I would like a project similar to ${name} from AZENK.`, "", "Name:", "Business:", "Request details:"]);
    },
  };
  const waText = (key) => {
    const [type, id] = String(key || "general").split(":");
    return (waMessages[type] || waMessages.general)(id);
  };
  // Apply to every [data-wa] link in the page
  const applyWaLinks = (scope = document) => {
    scope.querySelectorAll("[data-wa]").forEach((a) => {
      const href = waHref(waText(a.dataset.wa));
      if (href) {
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        a.removeAttribute("aria-disabled");
      } else {
        a.setAttribute("href", "#");
        a.setAttribute("aria-disabled", "true");
      }
    });
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('[data-wa][aria-disabled="true"]');
    if (!a) return;
    e.preventDefault();
    toast(ui("noNumber"));
  });

  /* =========================================================
     Icons (inline SVG, stroke style)
     ========================================================= */
  const P = {
    whatsapp: '<path d="M20.5 3.5A11 11 0 0 0 3.2 17.1L2 22l5-1.3A11 11 0 0 0 20.5 3.5zM12 20.2a9.1 9.1 0 0 1-4.7-1.3l-.3-.2-3 .8.8-2.9-.2-.3A9.2 9.2 0 1 1 12 20.2zm5-6.9c-.3-.1-1.6-.8-1.9-.9-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1a7.5 7.5 0 0 1-3.7-3.2c-.3-.5.3-.4.8-1.4.1-.2 0-.3 0-.5l-.9-2c-.2-.5-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.7 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M16.6 5.8A4.6 4.6 0 0 1 15.4 3h-3.2v12.5a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V9.6a6 6 0 1 0 5.1 5.9V9.2a7.7 7.7 0 0 0 4.5 1.4V7.4a4.6 4.6 0 0 1-3.3-1.6z" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    web: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01M7 13h6M7 16h10"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" opacity=".6"/>',
    flow: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v3a3 3 0 0 0 3 3h6M15 6h3a3 3 0 0 1 3 3v0"/><circle cx="15" cy="6" r="1.2"/>',
    pen: '<path d="M12 19l7-7 2 2-7 7-2-2z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
    graduation: '<path d="m22 10-10-5-10 5 10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5M22 10v6"/>',
    slides: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="4" height="6" rx="1.5"/><rect x="17.5" y="14" width="4" height="6" rx="1.5"/><path d="M19.5 20a3 3 0 0 1-3 2H13"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
    cart: '<path d="M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  };
  const icon = (name, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || P.spark}</svg>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fillIcons = (scope = document) => scope.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
    el.removeAttribute("data-icon");
  });

  // AZENK monogram: a precise "A" inside a diamond frame
  const mark = (cls = "") => `<svg class="mark ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs><linearGradient id="azg-${cls || "m"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1dfae"/><stop offset=".55" stop-color="#c9a45c"/><stop offset="1" stop-color="#9c7b3e"/></linearGradient></defs>
      <path d="M24 2.5 45.5 24 24 45.5 2.5 24Z" fill="none" stroke="url(#azg-${cls || "m"})" stroke-width="1.6"/>
      <path d="M15.5 33 24 13.5 32.5 33" fill="none" stroke="url(#azg-${cls || "m"})" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 26.5h10" stroke="url(#azg-${cls || "m"})" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`;
  const logo = () => `<a class="logo" href="${ROOT || "./"}" aria-label="AZENK — ${ui("home")}">${mark("logo")}<span class="logo__text"><b>AZENK</b><small>Digital · Technology · Creative</small></span></a>`;

  /* =========================================================
     Header, mobile navigation, footer, floating WhatsApp
     ========================================================= */
  const NAV = [
    ["home", ""],
    ["products", "products/"],
    ["solutions", "solutions/"],
    ["build", "build/"],
    ["services", "services/"],
    ["about", "about/"],
    ["contact", "contact/"],
  ];
  const FOOTER_NAV = [...NAV, ["work", "work/"]];
  const tiktokLink = (cls) =>
    CFG.TIKTOK_URL
      ? `<a class="${cls}" href="${esc(CFG.TIKTOK_URL)}" target="_blank" rel="noopener noreferrer" aria-label="${ui("tiktok")}" title="${ui("tiktok")}">${icon("tiktok")}</a>`
      : `<span class="${cls} is-soon" role="img" aria-label="${ui("tiktokSoon")}" title="${ui("tiktokSoon")}">${icon("tiktok")}</span>`;
  const langBtn = (cls) => `<button type="button" class="${cls}" data-lang-toggle aria-label="${ui("langLabel")}" lang="${lang === "ar" ? "en" : "ar"}">${icon("globe")}<span>${ui("langSwitch")}</span></button>`;

  const renderHeader = () => {
    const el = document.getElementById("siteHeader");
    if (!el) return;
    el.innerHTML = `
      <div class="container header__inner">
        ${logo()}
        <nav class="nav" aria-label="${lang === "ar" ? "القائمة الرئيسية" : "Main navigation"}">
          <ul>${NAV.map(([k, href]) => `<li><a class="nav__link ${k === PAGE ? "is-active" : ""}" href="${ROOT}${href || (ROOT ? "" : "./")}" ${k === PAGE ? 'aria-current="page"' : ""}>${ui(k)}</a></li>`).join("")}</ul>
        </nav>
        <div class="header__actions">
          ${tiktokLink("icon-link")}
          ${langBtn("lang-btn")}
          <a class="btn btn--gold btn--sm header__cta" data-wa="start" href="#">${ui("startProject")}</a>
          <button type="button" class="burger" data-menu-open aria-label="${ui("openMenu")}" aria-expanded="false" aria-controls="mobileNav"><span></span><span></span></button>
        </div>
      </div>`;
    const m = document.getElementById("mobileNav");
    m.innerHTML = `
      <div class="mnav__top">${logo()}<button type="button" class="mnav__close" data-menu-close aria-label="${ui("closeMenu")}">${icon("close")}</button></div>
      <nav aria-label="${ui("menu")}"><ol class="mnav__links">${NAV.map(([k, href], i) => `<li style="--i:${i}"><a href="${ROOT}${href || (ROOT ? "" : "./")}" class="${k === PAGE ? "is-active" : ""}" ${k === PAGE ? 'aria-current="page"' : ""}><em>0${i + 1}</em>${ui(k)}</a></li>`).join("")}</ol></nav>
      <div class="mnav__foot">
        <a class="btn btn--gold btn--block" data-wa="start" href="#">${icon("whatsapp")}${ui("startProject")}</a>
        ${demoCenterLink("btn btn--ghost btn--block")}
        <div class="mnav__row">${langBtn("lang-btn lang-btn--lg")}${tiktokLink("icon-link icon-link--lg")}</div>
      </div>`;
  };

  const renderFooter = () => {
    const el = document.getElementById("siteFooter");
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
      <div class="container footer__grid">
        <div class="footer__brand">
          ${logo()}
          <p>${ui("footerAbout")}</p>
          <div class="footer__social">${tiktokLink("icon-link")}<a class="icon-link" data-wa="general" href="#" aria-label="${ui("whatsapp")}">${icon("whatsapp")}</a><a class="icon-link" href="mailto:${esc(CFG.EMAIL)}" aria-label="${ui("email")}">${icon("mail")}</a></div>
        </div>
        <div class="footer__col"><h3>${ui("footerSite")}</h3><ul>${FOOTER_NAV.map(([k, href]) => `<li><a href="${ROOT}${href || (ROOT ? "" : "./")}">${ui(k)}</a></li>`).join("")}</ul></div>
        <div class="footer__col"><h3>${ui("footerServices")}</h3><ul>${DATA.services.map((s) => `<li><a href="${ROOT}services/#${s.id}">${esc(t(s.title))}</a></li>`).join("")}</ul></div>
        <div class="footer__col"><h3>${ui("footerContact")}</h3><ul>
          <li><a data-wa="general" href="#"><span dir="ltr">${phoneDisplay()}</span></a></li>
          <li><a href="mailto:${esc(CFG.EMAIL)}" dir="ltr">${esc(CFG.EMAIL)}</a></li>
          ${DEMO_CENTER ? `<li>${demoCenterLink("")}</li>` : ""}
          <li>${lang === "ar" ? "المملكة العربية السعودية" : "Saudi Arabia"}</li>
        </ul></div>
      </div>
      <div class="container footer__bottom">
        <p>© ${year} AZENK. ${ui("rights")}</p>
        <p class="footer__tag" dir="ltr">azenk.sa · Digital · Technology · Creative</p>
      </div>`;
  };

  const renderFloat = () => {
    const el = document.getElementById("waFloat");
    if (!el) return;
    el.innerHTML = `<a class="wa-float" data-wa="general" href="#" aria-label="${ui("waFloat")}">${icon("whatsapp")}<span>${ui("waFloat")}</span></a>`;
  };

  /* ---------- Mobile navigation behaviour ---------- */
  let lastFocus = null;
  const setMenu = (open) => {
    const m = document.getElementById("mobileNav");
    if (!m) return;
    m.classList.toggle("is-open", open);
    m.setAttribute("aria-hidden", String(!open));
    body.classList.toggle("is-locked", open);
    const burger = document.querySelector("[data-menu-open]");
    if (burger) burger.setAttribute("aria-expanded", String(open));
    if (open) {
      lastFocus = document.activeElement;
      const first = m.querySelector(".mnav__close");
      if (first) first.focus({ preventScroll: true });
    } else if (lastFocus) lastFocus.focus({ preventScroll: true });
  };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-menu-open]")) return setMenu(true);
    if (e.target.closest("[data-menu-close]")) return setMenu(false);
    if (e.target.closest("#mobileNav a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    const m = document.getElementById("mobileNav");
    if (!m || !m.classList.contains("is-open")) return;
    if (e.key === "Escape") return setMenu(false);
    if (e.key === "Tab") {
      const f = [...m.querySelectorAll("a[href], button")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) setMenu(false);
  });

  /* =========================================================
     Product media: a real screenshot, or a neutral placeholder
     (never a fake interface for a system that has no screenshot)
     ========================================================= */
  const STATUS_KEY = { ready: "prodReady", demo: "prodDemo", dev: "prodDev" };
  const statusBadge = (p) => `<span class="pstatus pstatus--${esc(p.status)}">${ui(STATUS_KEY[p.status] || "prodDev")}</span>`;
  const runtimeBadge = (p) => `<span class="pruntime">${icon(p.runtime === "server" ? "server" : "globe")}${ui(p.runtime === "server" ? "runtimeServer" : "runtimeBrowser")}</span>`;
  const productPlaceholder = (p) => `<div class="pplaceholder" role="img" aria-label="${esc(p.name)} — ${ui("previewSoon")}">
      ${mark("ph")}<b dir="ltr">${esc(p.name)}</b><small>${ui("previewSoon")}</small></div>`;
  const productVisual = (p) => (p.image ? `<img src="${ROOT}${esc(p.image)}" alt="${esc(p.name)} — ${esc(t(p.tagline))}" loading="lazy" width="800" height="500">` : productPlaceholder(p));
  const priceHTML = () => `<span class="price price--ask">${ui("priceOnRequest")}</span>`;
  // Demo buttons: the live browser version (if any) + «اطلب Demo» on WhatsApp with a ready message for this system.
  const demoBtn = (p, cls = "btn--sm") => {
    const d = p.demo || {};
    const live = d.type === "live" && d.url ? `<a class="btn btn--ghost ${cls}" href="${ROOT}${esc(d.url)}">${icon("external")}${ui(p.status === "ready" ? "tryNow" : "tryDemo")}</a>` : "";
    return `${live}<a class="btn btn--ghost ${cls}" data-wa="demo:${p.id}" href="#">${icon("whatsapp")}${ui("requestDemo")}</a>`;
  };
  const quoteBtn = (p, cls = "btn--sm") => `<a class="btn btn--gold ${cls}" data-wa="quote:${p.id}" href="#">${icon("whatsapp")}${ui("requestQuote")}</a>`;

  /* =========================================================
     Renderers ([data-render] containers)
     ========================================================= */
  const renderServices = (el) => {
    const limit = Number(el.dataset.limit) || DATA.services.length;
    const full = el.dataset.variant === "full";
    el.innerHTML = DATA.services.slice(0, limit).map((s, i) => {
      const related = (s.related || []).map(findProduct).filter(Boolean);
      return `
      <article class="service reveal" id="${full ? s.id : `svc-${s.id}`}" style="--d:${i}">
        <span class="service__num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <span class="service__icon">${icon(s.icon)}</span>
        <h3>${esc(t(s.title))}</h3>
        <p>${esc(t(s.desc))}</p>
        ${full ? `<ul class="ticks">${t(s.points).map((x) => `<li>${icon("check")}${esc(x)}</li>`).join("")}</ul>` : ""}
        ${full && related.length ? `<p class="service__rel"><span>${ui("relatedSystems")}:</span> ${related.map((p) => `<a href="${ROOT}products/#${p.id}" dir="ltr">${esc(p.name)}</a>`).join(" · ")}</p>` : ""}
        <a class="link-wa" data-wa="service:${s.id}" href="#">${icon("whatsapp")}<span>${ui("requestService")}</span>${icon("arrow", "flip")}</a>
      </article>`;
    }).join("");
  };

  const renderProducts = (el) => {
    const limit = Number(el.dataset.limit) || DATA.products.length;
    const full = el.dataset.variant === "full";
    el.innerHTML = DATA.products.slice(0, limit).map((p, i) => `
      <article class="product reveal" id="${full ? p.id : `prd-${p.id}`}" style="--d:${i}">
        <button type="button" class="product__media" data-product="${p.id}" aria-label="${ui("explore")}: ${esc(p.name)}">${productVisual(p)}${statusBadge(p)}</button>
        <div class="product__body">
          <span class="product__tag">${esc(t(p.tagline))} ${runtimeBadge(p)}</span>
          <h3 dir="ltr">${esc(p.name)}</h3>
          <p>${esc(t(p.summary))}</p>
          <p class="product__problem"><b>${ui("problemLabel")}:</b> ${esc(t(p.problem))}</p>
          <ul class="ticks ticks--sm">${t(p.features).slice(0, full ? 6 : 3).map((x) => `<li>${icon("check")}${esc(x)}</li>`).join("")}</ul>
          <div class="product__foot">
            ${priceHTML()}
            <button type="button" class="link-more" data-product="${p.id}">${ui("explore")}</button>
          </div>
          <div class="product__actions">
            ${demoBtn(p)}
            ${quoteBtn(p)}
          </div>
        </div>
      </article>`).join("");
  };

  let workFilter = "all";
  const statusLabel = (s) => ui(s === "live" ? "statusLive" : s === "concept" ? "statusConcept" : "statusDemo");
  const catLabel = (id) => t((DATA.categories.find((c) => c.id === id) || {}).label) || id;
  const renderWork = (el) => {
    const limit = Number(el.dataset.limit) || 99;
    const withFilters = el.dataset.filters !== "false";
    const list = DATA.work.filter((w) => workFilter === "all" || w.category === workFilter).slice(0, limit);
    const filters = withFilters
      ? `<div class="chips" role="group" aria-label="${lang === "ar" ? "تصنيف الأعمال" : "Filter work"}">${[["all", ui("all")], ...DATA.categories.map((c) => [c.id, t(c.label)])]
          .map(([id, label]) => `<button type="button" class="chip ${id === workFilter ? "is-active" : ""}" data-work-filter="${id}" aria-pressed="${id === workFilter}">${esc(label)}</button>`)
          .join("")}</div>`
      : "";
    const cards = list.length
      ? list.map((w, i) => `
        <article class="work reveal" style="--d:${i}">
          <div class="work__media">
            <img src="${ROOT}${esc(w.image)}" alt="${esc(w.title)}" loading="lazy" width="800" height="500" onerror="this.parentNode.classList.add('is-missing');this.remove()">
            <span class="work__status work__status--${w.status}">${statusLabel(w.status)}</span>
          </div>
          <div class="work__body">
            <span class="work__cat">${esc(catLabel(w.category))}</span>
            <h3 dir="ltr">${esc(w.title)}</h3>
            <p>${esc(t(w.desc))}</p>
            <div class="work__actions">
              ${w.url ? `<a class="btn btn--ghost btn--sm" href="${ROOT}${esc(w.url)}">${icon("external")}${ui("preview")}</a>` : ""}
              <a class="link-wa" data-wa="work:${w.id}" href="#">${icon("whatsapp")}<span>${ui("similar")}</span></a>
            </div>
          </div>
        </article>`).join("")
      : `<div class="empty-work reveal">${mark("empty")}<p>${ui("emptyCategory")}</p><a class="btn btn--ghost btn--sm" data-wa="custom" href="#">${icon("whatsapp")}${ui("emptyCta")}</a></div>`;
    el.innerHTML = `${filters}<div class="work-grid">${cards}</div>`;
  };

  /* =========================================================
     Solution finder — fixed rules applied to the visitor's answers
     (no AI, nothing sent anywhere until the visitor chooses WhatsApp)
     ========================================================= */
  const F = {
    title: { ar: "أجب عن 6 أسئلة قصيرة", en: "Answer 6 short questions" },
    submit: { ar: "اعرض الحل المقترح", en: "Show the suggested solution" },
    reset: { ar: "ابدأ من جديد", en: "Start again" },
    required: { ar: "يرجى الإجابة عن هذا السؤال", en: "Please answer this question" },
    resultTitle: { ar: "الحل المقترح لك", en: "Your suggested solution" },
    systems: { ar: "الأنظمة المناسبة", en: "Matching systems" },
    services: { ar: "خدمات قد تحتاجها", en: "Services you may need" },
    features: { ar: "مزايا مقترحة", en: "Suggested features" },
    steps: { ar: "خطوات التنفيذ", en: "Implementation steps" },
    quote: { ar: "اطلب عرض سعر لهذا الحل", en: "Request a quote for this solution" },
    build: { ar: "ابدأ طلب نظام مخصص", en: "Start a custom system request" },
    disclaimer: {
      ar: "توصية أولية مبنية على قواعد ثابتة وعلى إجاباتك فقط — ليست ذكاءً اصطناعيًا. يؤكدها فريق AZENK بعد التواصل معك.",
      en: "An initial recommendation based on fixed rules and your answers only — not AI. The AZENK team confirms it after talking to you.",
    },
    types: {
      ready: { ar: "نظام جاهز من AZENK مع تخصيص لمنشأتك", en: "A ready AZENK system tailored to your organisation" },
      custom: { ar: "نظام مخصص يُبنى حول طريقة عملك", en: "A custom system built around how you work" },
      improve: { ar: "تطوير أنظمتك الحالية وربطها ببعضها", en: "Improve and connect your current systems" },
      advice: { ar: "جلسة استشارية وخطة تحول رقمي على مراحل", en: "An advisory session and a phased digital plan" },
      student: { ar: "أدوات وخدمات للطلاب والأفراد", en: "Tools and services for students and individuals" },
    },
    stepsBy: {
      ready: { ar: ["جلسة Demo على النظام المقترح", "تحديد التخصيصات والصلاحيات المطلوبة", "تهيئة الحسابات ونقل البيانات الحالية", "تدريب المستخدمين والتشغيل والدعم"], en: ["A demo session of the suggested system", "Agreeing customisations and permissions", "Setting up accounts and migrating current data", "User training, launch and support"] },
      custom: { ar: ["تحليل المتطلبات ونطاق العمل", "تصميم تجربة الاستخدام والواجهات", "التطوير والاختبار على مراحل", "الإطلاق والدعم بعد التسليم"], en: ["Requirements and scope analysis", "UX and interface design", "Phased development and testing", "Launch and post-delivery support"] },
      improve: { ar: ["مراجعة الأنظمة الحالية وبياناتها", "تصميم الربط أو التطوير المطلوب", "التنفيذ والاختبار دون إيقاف العمل", "التشغيل والمتابعة"], en: ["Reviewing current systems and data", "Designing the integration or improvement", "Implementation and testing without stopping work", "Go-live and monitoring"] },
      advice: { ar: ["جلسة لفهم إجراءاتك الحالية", "تحديد الأولويات وخطة مراحل", "اختيار الحل: جاهز أو مخصص", "تنفيذ تدريجي وقياس النتائج"], en: ["A session to understand your current procedures", "Priorities and a phased plan", "Choosing ready or custom solutions", "Gradual implementation and measuring results"] },
      student: { ar: ["تحديد ما تحتاجه: أداة أو خدمة", "تجربة الأداة المناسبة مباشرة", "طلب الخدمة عند الحاجة لمساعدة", "مراجعة وتسليم"], en: ["Decide what you need: a tool or a service", "Try the matching tool right away", "Request the service if you need help", "Review and delivery"] },
    },
    extraFeatures: {
      manual: { ar: "نماذج رقمية ومسارات موافقة بدل الورق", en: "Digital forms and approval flows instead of paper" },
      integration: { ar: "ربط الأنظمة عبر واجهات API وتبادل البيانات", en: "System integration through APIs and data exchange" },
      website: { ar: "موقع أو متجر متجاوب ثنائي اللغة", en: "A responsive bilingual website or store" },
    },
    scale: { ar: "لعدد المستخدمين الكبير يُنصح بتشغيل النظام على خادم مخصص، والبدء بمرحلة تجريبية على قسم واحد قبل التعميم.", en: "For many users we recommend a dedicated server and a pilot in one department before rolling out." },
  };
  const ft = (k) => t(F[k]);

  const renderFinder = (el) => {
    const Q = (DATA.finder && DATA.finder.questions) || [];
    el.innerHTML = `
      <form class="finder reveal" data-finder novalidate>
        <h2 class="finder__title">${ft("title")}</h2>
        ${Q.map((q, qi) => `
          <fieldset class="finder__q" data-q="${q.id}">
            <legend><span class="finder__n">${qi + 1}</span>${esc(t(q.label))}</legend>
            <div class="finder__opts">${q.options.map(([v, l]) => `
              <label class="opt-chip"><input type="${q.type === "multi" ? "checkbox" : "radio"}" name="${q.id}" value="${v}"><span>${esc(t(l))}</span></label>`).join("")}</div>
            <small class="field__error" aria-live="polite"></small>
          </fieldset>`).join("")}
        <div class="finder__actions"><button type="submit" class="btn btn--gold btn--lg">${icon("target")}${ft("submit")}</button><button type="reset" class="btn btn--ghost">${ft("reset")}</button></div>
      </form>
      <div class="finder-result" data-finder-result hidden tabindex="-1"></div>`;
  };

  const finderCompute = (a) => {
    const R = DATA.finder;
    const score = {};
    const add = (ids, n) => (ids || []).forEach((id) => (score[id] = (score[id] || 0) + n));
    a.problems.forEach((pr) => add(R.problemSystems[pr], 3));
    add(R.activitySystems[a.activity], 2);
    const systems = Object.entries(score).sort((x, y) => y[1] - x[1]).map(([id]) => findProduct(id)).filter(Boolean).slice(0, 3);
    const services = [...new Set(a.problems.flatMap((pr) => R.problemServices[pr] || []))].map(findService).filter(Boolean);
    let type;
    if (a.need === "advice") type = "advice";
    else if (a.need === "improve" || a.problems.includes("integration") || a.current === "legacy" || a.current === "many") type = "improve";
    else if (a.need === "custom" || !systems.length) type = "custom";
    else if (a.activity === "student" || a.size === "solo") type = "student";
    else type = "ready";
    if (type === "custom" && !services.some((x) => x.id === "software")) services.unshift(findService("software"));
    if (type === "improve" && !services.some((x) => x.id === "integration")) services.unshift(findService("integration"));
    if (type === "advice" && !services.some((x) => x.id === "transformation")) services.unshift(findService("transformation"));
    if ((type === "ready" || type === "improve") && systems.length && !services.some((x) => x.id === "business")) services.push(findService("business"));
    const features = [...new Set([...(systems[0] ? t(systems[0].features).slice(0, 4) : []), ...a.problems.map((pr) => F.extraFeatures[pr] && t(F.extraFeatures[pr])).filter(Boolean)])];
    const large = a.users === "100+" || a.size === "large";
    return { type, systems, services: services.filter(Boolean).slice(0, 4), features, large };
  };

  const answerLabel = (qid, v) => {
    const q = DATA.finder.questions.find((x) => x.id === qid);
    const o = q && q.options.find(([k]) => k === v);
    return o ? t(o[1]) : v;
  };

  const initFinder = (form) => {
    const out = form.parentNode.querySelector("[data-finder-result]");
    const Q = DATA.finder.questions;
    form.addEventListener("change", (e) => { const fs = e.target.closest(".finder__q"); if (fs) { fs.classList.remove("is-invalid"); fs.querySelector(".field__error").textContent = ""; } });
    form.addEventListener("reset", () => { out.hidden = true; out.innerHTML = ""; form.querySelectorAll(".finder__q").forEach((fs) => fs.classList.remove("is-invalid")); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const a = {};
      let firstBad = null;
      Q.forEach((q) => {
        const vals = fd.getAll(q.id);
        a[q.id] = q.type === "multi" ? vals : vals[0];
        const fs = form.querySelector(`[data-q="${q.id}"]`);
        const bad = !vals.length;
        fs.classList.toggle("is-invalid", bad);
        fs.querySelector(".field__error").textContent = bad ? ft("required") : "";
        if (bad && !firstBad) firstBad = fs;
      });
      if (firstBad) { const i = firstBad.querySelector("input"); if (i) i.focus(); return; }
      const r = finderCompute(a);
      const shortLabel = (q) => t(q.label).replace(/\s*\(.*\)\s*$/, "").replace(/[؟?]\s*$/, "");
      const summary = Q.map((q) => `• ${shortLabel(q)}: ${q.type === "multi" ? a[q.id].map((v) => answerLabel(q.id, v)).join(lang === "ar" ? "، " : ", ") : answerLabel(q.id, a[q.id])}`);
      const msg = (lang === "ar"
        ? ["السلام عليكم، استخدمت أداة «دع AZENK تحدد الحل المناسب» وأرغب في عرض سعر.", "", `الحل المقترح: ${t(F.types[r.type])}`, r.systems.length ? `الأنظمة: ${r.systems.map((p) => p.name).join("، ")}` : "", "", "إجاباتي:", ...summary, "", "الاسم:", "ملاحظات:"]
        : ["Hello, I used the AZENK solution finder and would like a quote.", "", `Suggested solution: ${t(F.types[r.type])}`, r.systems.length ? `Systems: ${r.systems.map((p) => p.name).join(", ")}` : "", "", "My answers:", ...summary, "", "Name:", "Notes:"]).filter((x, i, arr) => x !== "" || arr[i - 1] !== "").join("\n");
      const href = waHref(msg);
      out.innerHTML = `
        <div class="result">
          <span class="eyebrow">${ft("resultTitle")}</span>
          <h2>${esc(t(F.types[r.type]))}</h2>
          ${r.large ? `<p class="result__note">${icon("info")}${esc(t(F.scale))}</p>` : ""}
          <div class="result__grid">
            ${r.systems.length ? `<section><h3>${ft("systems")}</h3><ul class="result__systems">${r.systems.map((p) => `<li><a href="${ROOT}products/#${p.id}"><img src="${ROOT}${esc(p.image)}" alt="" width="160" height="100" loading="lazy"><span><b dir="ltr">${esc(p.name)}</b><small>${esc(t(p.tagline))}</small></span></a></li>`).join("")}</ul></section>` : ""}
            ${r.services.length ? `<section><h3>${ft("services")}</h3><ul class="ticks">${r.services.map((x) => `<li>${icon("check")}<a href="${ROOT}services/#${x.id}">${esc(t(x.title))}</a></li>`).join("")}</ul></section>` : ""}
            ${r.features.length ? `<section><h3>${ft("features")}</h3><ul class="ticks">${r.features.map((x) => `<li>${icon("check")}${esc(x)}</li>`).join("")}</ul></section>` : ""}
            <section><h3>${ft("steps")}</h3><ol class="result__steps">${t(F.stepsBy[r.type]).map((x) => `<li>${esc(x)}</li>`).join("")}</ol></section>
          </div>
          <div class="result__actions">
            ${href ? `<a class="btn btn--gold btn--lg" href="${href}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")}${ft("quote")}</a>` : `<span class="form__note">${ui("noNumber")}</span>`}
            ${r.type === "custom" || r.type === "improve" ? `<a class="btn btn--ghost btn--lg" href="${ROOT}build/">${ft("build")}</a>` : ""}
          </div>
          <p class="result__disclaimer">${esc(ft("disclaimer"))}</p>
        </div>`;
      out.hidden = false;
      out.focus({ preventScroll: true });
      out.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  };

  const RENDERERS = { services: renderServices, products: renderProducts, work: renderWork, finder: renderFinder };
  const renderAll = () => {
    document.querySelectorAll("[data-render]").forEach((el) => {
      const fn = RENDERERS[el.dataset.render];
      if (fn) fn(el);
    });
  };
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-work-filter]");
    if (!f) return;
    workFilter = f.dataset.workFilter;
    document.querySelectorAll('[data-render="work"]').forEach((el) => {
      renderWork(el);
      afterRender(el);
    });
    const btn = document.querySelector(`[data-work-filter="${workFilter}"]`);
    if (btn) btn.focus({ preventScroll: true });
  });

  /* =========================================================
     Product details modal
     ========================================================= */
  const modal = document.createElement("div");
  modal.className = "pmodal";
  modal.setAttribute("aria-hidden", "true");
  body.appendChild(modal);
  let modalReturn = null;
  const openProduct = (id) => {
    const p = findProduct(id);
    if (!p) return;
    modalReturn = document.activeElement;
    modal.innerHTML = `
      <div class="pmodal__backdrop" data-pclose></div>
      <div class="pmodal__dialog" role="dialog" aria-modal="true" aria-labelledby="pmTitle" tabindex="-1">
        <button type="button" class="pmodal__close" data-pclose aria-label="${ui("close")}">${icon("close")}</button>
        <div class="pmodal__media">${productVisual(p)}</div>
        <div class="pmodal__body">
          <span class="product__tag">${esc(t(p.tagline))} · ${statusBadge(p)} ${runtimeBadge(p)}</span>
          <h2 id="pmTitle" dir="ltr">${esc(p.name)}</h2>
          <p class="product__problem"><b>${ui("problemLabel")}:</b> ${esc(t(p.problem))}</p>
          <p class="pmodal__desc">${esc(t(p.description))}</p>
          <h3>${ui("features")}</h3>
          <ul class="ticks">${t(p.features).map((x) => `<li>${icon("check")}${esc(x)}</li>`).join("")}</ul>
          <p class="pmodal__note">${icon("info")}${ui(p.runtime === "server" ? "runtimeServerNote" : "runtimeBrowserNote")}</p>
          <div class="pmodal__foot">
            ${priceHTML()}
            <div class="product__actions">
              ${demoBtn(p, "")}
              <a class="btn btn--ghost" data-wa="product:${p.id}" href="#">${icon("whatsapp")}${ui("details")}</a>
              ${quoteBtn(p, "")}
            </div>
          </div>
        </div>
      </div>`;
    applyWaLinks(modal);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("is-locked");
    requestAnimationFrame(() => modal.querySelector(".pmodal__dialog").focus({ preventScroll: true }));
  };
  const closeProduct = () => {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("is-locked");
    if (modalReturn) modalReturn.focus({ preventScroll: true });
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-product]");
    if (b) return openProduct(b.dataset.product);
    if (e.target.closest("[data-pclose]")) closeProduct();
  });
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.key === "Escape") closeProduct();
    if (e.key === "Tab") {
      const f = [...modal.querySelectorAll("a[href], button")];
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === modal.querySelector(".pmodal__dialog"))) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  });
  // Deep link: products/#azenk-hr opens that system
  const openFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (PAGE === "products" && findProduct(id)) openProduct(id);
  };

  /* =========================================================
     Project request form → WhatsApp
     ========================================================= */
  const fillServiceSelect = (sel) => {
    const current = sel.value;
    sel.innerHTML = `<option value="">${ui("choose")}</option>${DATA.services.map((s) => `<option value="${s.id}">${esc(t(s.title))}</option>`).join("")}
      <option value="product">${ui("optReady")}</option><option value="custom">${ui("optCustom")}</option><option value="other">${ui("optOther")}</option>`;
    const qs = new URLSearchParams(location.search);
    const pre = current || qs.get("service") || qs.get("type");
    if (pre) sel.value = pre;
  };
  const optionLabel = (v) => {
    const s = findService(v);
    if (s) return t(s.title);
    return { product: ui("optReady"), custom: ui("optCustom"), other: ui("optOther") }[v] || v;
  };
  const FORM_TXT = {
    build: {
      ar: { head: "طلب بناء نظام من موقع AZENK", name: "الاسم", business: "النشاط / الجهة", phone: "الجوال", email: "البريد", service: "نوع المشروع", budget: "الميزانية التقريبية", details: "وصف المشروع", attach: "المرفقات: سأرسلها في هذه المحادثة إن وجدت." },
      en: { head: "Build-a-system request from the AZENK website", name: "Name", business: "Business / organisation", phone: "Mobile", email: "Email", service: "Project type", budget: "Approximate budget", details: "Project description", attach: "Attachments: I will send them in this chat if any." },
    },
    project: {
      ar: { head: "طلب مشروع جديد من موقع AZENK", name: "الاسم", phone: "الجوال", email: "البريد", service: "الخدمة", details: "تفاصيل المشروع" },
      en: { head: "New project request from the AZENK website", name: "Name", phone: "Mobile", email: "Email", service: "Service", details: "Project details" },
    },
  };
  const requestText = (form) => {
    const kind = form.dataset.form === "build" ? "build" : "project";
    const L = FORM_TXT[kind][lang];
    const d = Object.fromEntries(new FormData(form));
    const v = (k) => String(d[k] || "").trim();
    const budgetSel = form.querySelector('[name="budget"]');
    const budget = budgetSel && budgetSel.value ? budgetSel.options[budgetSel.selectedIndex].text : "—";
    const lines = [L.head, "", `${L.name}: ${v("name")}`];
    if (kind === "build") lines.push(`${L.business}: ${v("business")}`);
    lines.push(`${L.phone}: ${v("phone")}`, `${L.email}: ${v("email") || "—"}`, `${L.service}: ${optionLabel(v("service"))}`);
    if (kind === "build") lines.push(`${L.budget}: ${budget}`);
    lines.push(`${L.details}: ${v("details")}`);
    if (kind === "build") lines.push("", L.attach);
    return { text: lines.join("\n"), subject: L.head };
  };

  const initForm = (form) => {
    const sel = form.querySelector('[name="service"]');
    if (sel) fillServiceSelect(sel);
    const note = form.querySelector("[data-form-note]");
    const rules = {
      name: (v) => (v.length >= 2 ? "" : ui("errName")),
      business: (v) => (v.length >= 2 ? "" : ui("errBusiness")),
      phone: (v) => (/^(\+?966|00966|0)?5\d{8}$/.test(v.replace(/[\s-]/g, "")) ? "" : ui("errPhone")),
      email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : ui("errEmail")),
      service: (v) => (v ? "" : ui("errService")),
      details: (v) => (v.length >= 10 ? "" : ui("errDetails")),
    };
    const check = (field) => {
      const rule = rules[field.name];
      if (!rule) return true;
      const msg = rule(field.value.trim());
      const group = field.closest(".field");
      group.classList.toggle("is-invalid", !!msg);
      field.setAttribute("aria-invalid", String(!!msg));
      group.querySelector(".field__error").textContent = msg;
      return !msg;
    };
    const fields = [...form.querySelectorAll("input, select, textarea")].filter((f) => f.name);
    fields.forEach((f) => f.addEventListener(f.tagName === "SELECT" ? "change" : "input", () => {
      const g = f.closest(".field");
      if (g && g.classList.contains("is-invalid")) check(f);
    }));
    const validate = () => {
      note.textContent = "";
      const ok = fields.map(check);
      if (ok.includes(false)) { fields[ok.indexOf(false)].focus(); return false; }
      return true;
    };
    const open = (href) => {
      const a = document.createElement("a");
      a.href = href;
      if (href.startsWith("https:")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate()) return;
      const href = waHref(requestText(form).text);
      if (!href) { note.textContent = ui("noNumber"); return; }
      open(href);
      note.textContent = ui("formSent");
      form.reset();
      if (sel) sel.value = "";
    });
    const mail = form.querySelector("[data-mailto]");
    if (mail) mail.addEventListener("click", () => {
      if (!validate()) return;
      const { text, subject } = requestText(form);
      open(`mailto:${CFG.EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
      note.textContent = ui("mailSent");
    });
  };

  /* =========================================================
     Static text translation (data-i18n)
     ========================================================= */
  const translateStatic = () => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (el.dataset.ar === undefined) el.dataset.ar = el.innerHTML;
      el.innerHTML = lang === "en" && EN[key] != null ? EN[key] : el.dataset.ar;
    });
    [["placeholder", "i18nPh"], ["aria-label", "i18nAria"], ["content", "i18nContent"]].forEach(([attr, ds]) => {
      document.querySelectorAll(`[data-${ds.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`).forEach((el) => {
        const key = el.dataset[ds];
        const store = `ar${attr.replace(/-/g, "")}`;
        if (el.dataset[store] === undefined) el.dataset[store] = el.getAttribute(attr) || "";
        el.setAttribute(attr, lang === "en" && EN[key] != null ? EN[key] : el.dataset[store]);
      });
    });
    const titleKey = `title.${PAGE}`;
    if (!doc.dataset.arTitle) doc.dataset.arTitle = document.title;
    document.title = lang === "en" && EN[titleKey] ? EN[titleKey] : doc.dataset.arTitle;
  };

  const applyLang = () => {
    doc.lang = lang;
    doc.dir = lang === "ar" ? "rtl" : "ltr";
    renderHeader();
    renderFooter();
    renderFloat();
    renderAll();
    document.querySelectorAll("[data-finder]").forEach(initFinder);
    translateStatic();
    fillIcons();
    applyWaLinks();
    document.querySelectorAll("form[data-form]").forEach((f) => {
      const sel = f.querySelector('[name="service"]');
      if (sel) fillServiceSelect(sel);
      f.querySelectorAll(".field.is-invalid").forEach((g) => {
        g.classList.remove("is-invalid");
        g.querySelector(".field__error").textContent = "";
      });
    });
    afterRender(document);
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-lang-toggle]")) return;
    lang = lang === "ar" ? "en" : "ar";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (err) {
      /* ignore */
    }
    const u = new URL(location.href);
    if (u.searchParams.has("lang")) {
      u.searchParams.set("lang", lang);
      history.replaceState(null, "", u);
    }
    const menuOpen = document.getElementById("mobileNav").classList.contains("is-open");
    applyLang();
    if (menuOpen) setMenu(true);
    toast(lang === "ar" ? "تم التبديل إلى العربية" : "Switched to English");
  });

  /* =========================================================
     Toast, reveal, header state
     ========================================================= */
  let toastTimer = null;
  const toast = (msg) => {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 3200);
  };

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      }), { threshold: 0.1, rootMargin: "0px 0px -30px 0px" })
    : null;
  const afterRender = (scope) => {
    scope.querySelectorAll(".reveal:not(.is-in)").forEach((el) => (io ? io.observe(el) : el.classList.add("is-in")));
  };

  const header = document.getElementById("siteHeader");
  const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });

  /* =========================================================
     Boot
     ========================================================= */
  const mnav = document.createElement("div");
  mnav.className = "mnav";
  mnav.id = "mobileNav";
  mnav.setAttribute("aria-hidden", "true");
  body.appendChild(mnav);

  applyLang();
  document.querySelectorAll("form[data-form]").forEach(initForm);
  document.querySelectorAll("[data-wa-display]").forEach((el) => (el.textContent = phoneDisplay()));
  document.querySelectorAll("a[data-email]").forEach((el) => (el.href = `mailto:${CFG.EMAIL}`));
  document.querySelectorAll("[data-email-text]").forEach((el) => (el.textContent = CFG.EMAIL));
  onScroll();
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  // Contact details for search engines, generated from the central config
  if (PAGE === "home" || PAGE === "contact") {
    const ld = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${CFG.DOMAIN}/#organization`,
      name: "AZENK",
      contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", email: CFG.EMAIL, availableLanguage: ["ar", "en"], ...(waReady ? { telephone: `+${WA_NUMBER}`, url: `https://wa.me/${WA_NUMBER}` } : {}) }],
      ...(CFG.TIKTOK_URL ? { sameAs: [CFG.TIKTOK_URL] } : {}),
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

})();
