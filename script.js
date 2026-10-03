/* =========================================================
   AZENK — site script (shared by every page)
   - Header / mobile navigation / footer / floating WhatsApp
   - Arabic (RTL) ⇄ English (LTR) language switch
   - WhatsApp links generated from config.js (one number, one place)
   - Services, products and work rendered from data.js
   - Project request form → organised WhatsApp message
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
    products: { ar: "المنتجات", en: "Products" },
    services: { ar: "الخدمات", en: "Services" },
    work: { ar: "أعمالنا", en: "Our Work" },
    about: { ar: "من نحن", en: "About" },
    contact: { ar: "تواصل معنا", en: "Contact" },
    startProject: { ar: "ابدأ مشروعك", en: "Start your project" },
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
    requestService: { ar: "اطلب الخدمة", en: "Request service" },
    priceOnRequest: { ar: "السعر عند الطلب", en: "Price on request" },
    features: { ar: "المزايا", en: "Features" },
    liveDemo: { ar: "معاينة تجريبية", en: "Live demo" },
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
    errService: { ar: "يرجى اختيار نوع الخدمة", en: "Please choose a service" },
    errDetails: { ar: "يرجى كتابة تفاصيل المشروع (10 أحرف على الأقل)", en: "Please describe your project (at least 10 characters)" },
    optReady: { ar: "منتج جاهز من منتجات AZENK", en: "A ready AZENK product" },
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
  const phoneDisplay = () => {
    if (!waReady) return "—";
    if (WA_NUMBER.startsWith("966") && WA_NUMBER.length === 12) return `+966 ${WA_NUMBER.slice(3, 5)} ${WA_NUMBER.slice(5, 8)} ${WA_NUMBER.slice(8)}`;
    return `+${WA_NUMBER}`;
  };
  const findProduct = (id) => DATA.products.find((p) => p.id === id);
  const findService = (id) => DATA.services.find((s) => s.id === id);
  const findWork = (id) => DATA.work.find((w) => w.id === id);
  const currency = () => t(CFG.CURRENCY) || (lang === "ar" ? "ريال" : "SAR");

  // Message for each data-wa key ("start", "general", "service:web", "product:easy-fleet", ...)
  const waMessages = {
    start: () => (lang === "ar" ? "السلام عليكم، أرغب في بدء مشروع مع AZENK وأود معرفة التفاصيل." : "Hello, I would like to start a project with AZENK and would like to know the details."),
    general: () => (lang === "ar" ? "السلام عليكم، أرغب في التواصل مع AZENK." : "Hello, I would like to get in touch with AZENK."),
    individuals: () => (lang === "ar" ? "السلام عليكم، لدي فكرة وأرغب في تحويلها إلى مشروع رقمي مع AZENK. أود معرفة التفاصيل." : "Hello, I have an idea and would like to turn it into a digital project with AZENK. I would like to know the details."),
    business: () => (lang === "ar" ? "السلام عليكم، أمثّل شركة/منشأة وأرغب في حلول تقنية من AZENK لتطوير أعمالنا. أود معرفة التفاصيل." : "Hello, I represent a company and would like AZENK's technology solutions to grow our business. I would like to know the details."),
    custom: () => (lang === "ar" ? "السلام عليكم، أرغب في طلب مشروع مخصص من AZENK وأود معرفة التفاصيل." : "Hello, I would like to request a custom project from AZENK and would like to know the details."),
    service: (id) => {
      const s = findService(id);
      return s ? t(s.message) : waMessages.general();
    },
    product: (id) => {
      const p = findProduct(id);
      if (!p) return waMessages.general();
      if (p.price != null) {
        return lang === "ar"
          ? `السلام عليكم، أرغب في طلب ${p.name} بسعر ${p.price} ${currency()}. أود معرفة التفاصيل.`
          : `Hello, I would like to order ${p.name} for ${p.price} ${currency()}. I would like to know the details.`;
      }
      return lang === "ar"
        ? `السلام عليكم، أرغب في طلب منتج ${p.name} من AZENK. أود معرفة التفاصيل وطريقة الحصول عليه.`
        : `Hello, I would like to order ${p.name} from AZENK. I would like to know the details and how to get it.`;
    },
    work: (id) => {
      const w = findWork(id);
      const name = w ? w.title : "";
      return lang === "ar" ? `السلام عليكم، أرغب في مشروع مشابه لـ ${name} من AZENK. أود معرفة التفاصيل.` : `Hello, I would like a project similar to ${name} from AZENK. I would like to know the details.`;
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
    interior: '<path d="M3 21V10l9-6 9 6v11"/><path d="M7 21v-6h10v6M7 15v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
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
    ["services", "services/"],
    ["work", "work/"],
    ["about", "about/"],
    ["contact", "contact/"],
  ];
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
        <div class="footer__col"><h3>${ui("footerSite")}</h3><ul>${NAV.map(([k, href]) => `<li><a href="${ROOT}${href || (ROOT ? "" : "./")}">${ui(k)}</a></li>`).join("")}</ul></div>
        <div class="footer__col"><h3>${ui("footerServices")}</h3><ul>${DATA.services.map((s) => `<li><a href="${ROOT}services/#${s.id}">${esc(t(s.title))}</a></li>`).join("")}</ul></div>
        <div class="footer__col"><h3>${ui("footerContact")}</h3><ul>
          <li><a data-wa="general" href="#"><span dir="ltr">${phoneDisplay()}</span></a></li>
          <li><a href="mailto:${esc(CFG.EMAIL)}" dir="ltr">${esc(CFG.EMAIL)}</a></li>
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
     Product illustrations (lightweight inline SVG)
     ========================================================= */
  const productArt = (kind) => {
    const frame = (inner) => `<svg class="art" viewBox="0 0 400 250" role="img" aria-label="${ui("illustrative")}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg-${kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1b33"/><stop offset="1" stop-color="#070a12"/></linearGradient>
        <linearGradient id="gd-${kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1dfae"/><stop offset="1" stop-color="#b08a45"/></linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#bg-${kind})"/>
      <circle cx="330" cy="40" r="120" fill="#c9a45c" opacity=".05"/>
      <rect x="40" y="34" width="320" height="196" rx="12" fill="#0b1426" stroke="rgba(255,255,255,.1)"/>
      <rect x="40" y="34" width="320" height="22" rx="12" fill="rgba(255,255,255,.04)"/>
      <circle cx="56" cy="45" r="3" fill="#c9a45c"/><circle cx="66" cy="45" r="3" fill="rgba(255,255,255,.25)"/><circle cx="76" cy="45" r="3" fill="rgba(255,255,255,.25)"/>
      ${inner}</svg>`;
    const kpis = `<g fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.08)"><rect x="56" y="68" width="88" height="34" rx="6"/><rect x="156" y="68" width="88" height="34" rx="6"/><rect x="256" y="68" width="88" height="34" rx="6"/></g>
      <g fill="url(#gd-${kind})"><rect x="64" y="88" width="36" height="5" rx="2.5"/><rect x="164" y="88" width="48" height="5" rx="2.5"/><rect x="264" y="88" width="30" height="5" rx="2.5"/></g>`;
    switch (kind) {
      case "fleet":
        return frame(`${kpis}
          <rect x="56" y="114" width="288" height="102" rx="8" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.07)"/>
          <path d="M70 200 C120 180 110 130 170 140 S250 120 330 128" fill="none" stroke="url(#gd-${kind})" stroke-width="2.5" stroke-dasharray="6 6"/>
          <circle cx="70" cy="200" r="6" fill="#c9a45c"/><circle cx="170" cy="140" r="5" fill="#f5f3ee"/><circle cx="330" cy="128" r="6" fill="#c9a45c"/>
          <rect x="230" y="160" width="96" height="40" rx="6" fill="#0f1b33" stroke="rgba(201,164,92,.4)"/><rect x="240" y="172" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.4)"/><rect x="240" y="184" width="40" height="5" rx="2.5" fill="url(#gd-${kind})"/>`);
      case "parking": {
        let slots = "";
        for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) {
          const x = 62 + c * 40;
          const y = 120 + r * 50;
          const busy = (r * 7 + c) % 3 !== 1;
          slots += `<rect x="${x}" y="${y}" width="32" height="42" rx="5" fill="${busy ? "rgba(201,164,92,.18)" : "rgba(255,255,255,.03)"}" stroke="${busy ? "rgba(201,164,92,.55)" : "rgba(255,255,255,.12)"}"/>`;
          if (busy) slots += `<rect x="${x + 8}" y="${y + 9}" width="16" height="24" rx="4" fill="url(#gd-${kind})" opacity=".85"/>`;
        }
        return frame(`${kpis}${slots}`);
      }
      case "store":
        return frame(`<rect x="56" y="68" width="288" height="16" rx="5" fill="rgba(255,255,255,.05)"/>
          ${[0, 1, 2].map((i) => `<g transform="translate(${56 + i * 98} 96)"><rect width="90" height="120" rx="8" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><rect x="10" y="10" width="70" height="56" rx="6" fill="${i === 1 ? "url(#gd-store)" : "rgba(255,255,255,.08)"}" opacity="${i === 1 ? ".85" : "1"}"/><rect x="10" y="76" width="54" height="5" rx="2.5" fill="rgba(255,255,255,.4)"/><rect x="10" y="88" width="34" height="5" rx="2.5" fill="url(#gd-store)"/><rect x="10" y="100" width="70" height="12" rx="6" fill="rgba(255,255,255,.07)"/></g>`).join("")}`);
      default:
        return frame(`${kpis}
          ${[0, 1, 2].map((c) => `<g transform="translate(${56 + c * 98} 114)"><rect width="90" height="102" rx="8" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.07)"/><rect x="10" y="10" width="40" height="5" rx="2.5" fill="url(#gd-biz)"/>${[0, 1, 2].slice(0, 3 - (c % 2)).map((r) => `<rect x="8" y="${24 + r * 24}" width="74" height="18" rx="4" fill="rgba(255,255,255,.06)"/>`).join("")}</g>`).join("")}`);
    }
  };
  const productVisual = (p) => (p.image ? `<img src="${ROOT}${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" width="400" height="250">` : productArt(p.art || "biz"));
  const priceHTML = (p) => (p.price != null ? `<span class="price"><b>${p.price}</b><small>${currency()}</small></span>` : `<span class="price price--ask">${ui("priceOnRequest")}</span>`);

  /* =========================================================
     Renderers ([data-render] containers)
     ========================================================= */
  const renderServices = (el) => {
    const limit = Number(el.dataset.limit) || DATA.services.length;
    const full = el.dataset.variant === "full";
    el.innerHTML = DATA.services.slice(0, limit).map((s, i) => `
      <article class="service reveal" id="${full ? s.id : `svc-${s.id}`}" style="--d:${i}">
        <span class="service__num" aria-hidden="true">0${i + 1}</span>
        <span class="service__icon">${icon(s.icon)}</span>
        <h3>${esc(t(s.title))}</h3>
        <p>${esc(t(s.desc))}</p>
        ${full ? `<ul class="ticks">${t(s.points).map((x) => `<li>${icon("check")}${esc(x)}</li>`).join("")}</ul>` : ""}
        <a class="link-wa" data-wa="service:${s.id}" href="#">${icon("whatsapp")}<span>${ui("requestService")}</span>${icon("arrow", "flip")}</a>
      </article>`).join("");
  };

  const renderProducts = (el) => {
    const limit = Number(el.dataset.limit) || DATA.products.length;
    el.innerHTML = DATA.products.slice(0, limit).map((p, i) => `
      <article class="product reveal" style="--d:${i}">
        <button type="button" class="product__media" data-product="${p.id}" aria-label="${ui("details")}: ${esc(p.name)}">${productVisual(p)}</button>
        <div class="product__body">
          <span class="product__tag">${esc(t(p.tagline))}</span>
          <h3 dir="ltr">${esc(p.name)}</h3>
          <p>${esc(t(p.summary))}</p>
          <div class="product__foot">
            ${priceHTML(p)}
            <div class="product__actions">
              <button type="button" class="btn btn--ghost btn--sm" data-product="${p.id}">${ui("details")}</button>
              <a class="btn btn--gold btn--sm" data-wa="product:${p.id}" href="#">${icon("whatsapp")}${ui("orderNow")}</a>
            </div>
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

  const RENDERERS = { services: renderServices, products: renderProducts, work: renderWork };
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
          <span class="product__tag">${esc(t(p.tagline))}</span>
          <h2 id="pmTitle" dir="ltr">${esc(p.name)}</h2>
          <p class="pmodal__desc">${esc(t(p.description))}</p>
          <h3>${ui("features")}</h3>
          <ul class="ticks">${t(p.features).map((x) => `<li>${icon("check")}${esc(x)}</li>`).join("")}</ul>
          <div class="pmodal__foot">
            ${priceHTML(p)}
            <div class="product__actions">
              ${p.demoUrl ? `<a class="btn btn--ghost btn--sm" href="${ROOT}${esc(p.demoUrl)}">${icon("external")}${ui("liveDemo")}</a>` : ""}
              <a class="btn btn--gold" data-wa="product:${p.id}" href="#">${icon("whatsapp")}${ui("orderNow")}</a>
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
  // Deep link: products/#easy-fleet opens that product
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
    const pre = current || new URLSearchParams(location.search).get("service");
    if (pre) sel.value = pre;
  };
  const optionLabel = (v) => {
    const s = findService(v);
    if (s) return t(s.title);
    return { product: ui("optReady"), custom: ui("optCustom"), other: ui("optOther") }[v] || v;
  };
  const initForm = (form) => {
    const sel = form.querySelector('[name="service"]');
    if (sel) fillServiceSelect(sel);
    const note = form.querySelector("[data-form-note]");
    const rules = {
      name: (v) => (v.length >= 2 ? "" : ui("errName")),
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
    const fields = [...form.querySelectorAll("input, select, textarea")];
    fields.forEach((f) => f.addEventListener(f.tagName === "SELECT" ? "change" : "input", () => {
      if (f.closest(".field").classList.contains("is-invalid")) check(f);
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      note.textContent = "";
      const ok = fields.map(check);
      if (ok.includes(false)) {
        fields[ok.indexOf(false)].focus();
        return;
      }
      const d = Object.fromEntries(new FormData(form));
      const text = lang === "ar"
        ? ["طلب مشروع جديد من موقع AZENK", "", `الاسم: ${d.name.trim()}`, `الجوال: ${d.phone.trim()}`, `البريد: ${d.email.trim() || "—"}`, `الخدمة: ${optionLabel(d.service)}`, `تفاصيل المشروع: ${d.details.trim()}`].join("\n")
        : ["New project request from the AZENK website", "", `Name: ${d.name.trim()}`, `Mobile: ${d.phone.trim()}`, `Email: ${d.email.trim() || "—"}`, `Service: ${optionLabel(d.service)}`, `Project details: ${d.details.trim()}`].join("\n");
      const href = waHref(text);
      if (!href) {
        note.textContent = ui("noNumber");
        return;
      }
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      note.textContent = ui("formSent");
      form.reset();
      if (sel) sel.value = "";
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
