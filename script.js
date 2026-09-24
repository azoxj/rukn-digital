/* =========================================================
   Rukn Digital | رُكن ديجيتال
   ========================================================= */
(() => {
  "use strict";

  document.documentElement.classList.remove("no-js");

  const WHATSAPP_NUMBER = "966500000000";

  /* ---------- Projects data ---------- */
  const projects = [
    {
      id: "rukn",
      category: "landing",
      name: "Rukn Digital",
      type: "صفحة تسويقية",
      preview: "landing",
      summary: "صفحة تسويقية عصرية لشركة تقنية تعرض الخدمات والأعمال بتجربة سلسة وسريعة.",
      description:
        "تصميم وتطوير الموقع التعريفي لرُكن ديجيتال بهوية بصرية حديثة، يركّز على إبراز الخدمات والمشاريع وتسهيل تواصل العملاء عبر واتساب والبريد الإلكتروني.",
      features: [
        "تصميم متجاوب بالكامل مع جميع الأجهزة",
        "دعم كامل للغة العربية واتجاه RTL",
        "حركات خفيفة وتأثيرات تفاعلية",
        "نموذج تواصل مرتبط بواتساب",
        "سرعة تحميل عالية بدون مكتبات ثقيلة",
      ],
      tech: ["HTML5", "CSS3", "JavaScript", "Responsive Design"],
    },
    {
      id: "fleetpro",
      category: "system",
      url: "fleetpro/index.html",
      name: "FleetPro",
      type: "نظام إدارة أسطول",
      preview: "fleet",
      summary: "نظام متكامل لمتابعة المركبات والسائقين والرحلات والصيانة من لوحة واحدة.",
      description:
        "نظام ويب لإدارة أساطيل النقل يمكّن الشركات من تتبع المركبات، وجدولة الرحلات، ومتابعة الصيانة الدورية، واستخراج تقارير تشغيلية دقيقة.",
      features: [
        "تتبع حالة المركبات ومواقعها",
        "إدارة السائقين وتوزيع المهام",
        "تنبيهات الصيانة وانتهاء الوثائق",
        "تقارير استهلاك الوقود والتكاليف",
        "صلاحيات متعددة للمستخدمين",
      ],
      tech: ["HTML5", "CSS3", "JavaScript", "REST API", "Charts"],
    },
    {
      id: "dashboard",
      category: "system",
      name: "Business Dashboard",
      type: "نظام ويب",
      preview: "dashboard",
      summary: "لوحة تحكم تحليلية تعرض مؤشرات الأداء والمبيعات بشكل مرئي وواضح.",
      description:
        "لوحة معلومات تفاعلية تساعد الإدارة على اتخاذ القرار من خلال عرض مؤشرات الأداء الرئيسية، والمبيعات، والعملاء في رسوم بيانية سهلة القراءة.",
      features: [
        "مؤشرات أداء (KPIs) لحظية",
        "رسوم بيانية تفاعلية",
        "فلترة البيانات حسب الفترة",
        "تصدير التقارير",
        "واجهة داكنة مريحة للعين",
      ],
      tech: ["HTML5", "CSS3", "JavaScript", "SVG Charts"],
    },
    {
      id: "corporate",
      category: "landing",
      name: "Corporate Landing",
      type: "صفحة تسويقية",
      preview: "corporate",
      summary: "صفحة هبوط احترافية لشركة استشارية تعكس الموثوقية وتزيد من طلبات العملاء.",
      description:
        "صفحة تسويقية لشركة في قطاع الأعمال صُممت لرفع معدل التحويل، مع أقسام واضحة للخدمات والأرقام وآراء العملاء ودعوات إجراء بارزة.",
      features: [
        "هيكل محتوى مُحسّن للتحويل",
        "قسم إحصائيات وآراء العملاء",
        "تحسين محركات البحث (SEO)",
        "أداء عالٍ على الجوال",
        "سهولة التعديل والتوسّع",
      ],
      tech: ["HTML5", "CSS3", "JavaScript", "SEO"],
    },
  ];

  /* ---------- Preview templates (pure HTML/CSS) ---------- */
  const lines = (...widths) => widths.map((w) => `<span class="mock-line w-${w}"></span>`).join("");

  const landingPreview = (variant) => `
    <div class="preview preview--${variant}" aria-hidden="true">
      <div class="preview__bar">
        <span class="preview__logo"></span>
        <span class="preview__menu"><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="preview__hero">
        <div class="preview__text">${lines(90, 70, 80, 50)}<span class="preview__btn"></span></div>
        <div class="preview__art"></div>
      </div>
      <div class="preview__row"><span></span><span></span><span></span></div>
    </div>`;

  const previews = {
    landing: () => landingPreview("landing"),
    corporate: () => landingPreview("corporate"),
    dashboard: () => `
      <div class="preview preview--dashboard" aria-hidden="true">
        <div class="preview__sidebar">${lines(80, 70, 50, 60, 40)}</div>
        <div class="preview__content">
          <div class="preview__kpis"><span></span><span></span><span></span></div>
          <div class="preview__chart">
            <svg viewBox="0 0 200 70" preserveAspectRatio="none">
              <path class="area" d="M0 55 L25 42 L50 48 L75 30 L100 36 L125 20 L150 26 L175 12 L200 16 L200 70 L0 70 Z"/>
              <path class="line" d="M0 55 L25 42 L50 48 L75 30 L100 36 L125 20 L150 26 L175 12 L200 16"/>
            </svg>
          </div>
        </div>
      </div>`,
    fleet: () => `
      <div class="preview preview--fleet" aria-hidden="true">
        <div class="preview__map">
          <svg viewBox="0 0 200 120" preserveAspectRatio="none">
            <path class="route" d="M20 100 C60 90 50 40 100 50 S150 20 180 25"/>
          </svg>
          <span class="pin" style="right:10%;top:18%"></span>
          <span class="pin pin--2" style="right:48%;top:38%"></span>
          <span class="pin pin--3" style="right:86%;top:78%"></span>
        </div>
        <div class="preview__list"><span></span><span></span><span></span><span></span></div>
      </div>`,
  };

  /* ---------- Render project cards ---------- */
  const grid = document.getElementById("projectsGrid");

  grid.innerHTML = projects
    .map(
      (p) => `
      <article class="project-card reveal" data-category="${p.category}">
        <div class="project-card__thumb">${previews[p.preview]()}</div>
        <div class="project-card__body">
          <span class="project-type">${p.type}</span>
          <h3>${p.name}</h3>
          <p>${p.summary}</p>
          <div class="project-card__footer">
            <ul class="project-card__tech">${p.tech.slice(0, 3).map((t) => `<li>${t}</li>`).join("")}</ul>
            <div class="project-card__buttons">
              <button class="btn btn--ghost btn--sm" type="button" data-project="${p.id}">
                عرض المشروع
                <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
              </button>
              ${p.url ? `<a class="btn btn--primary btn--sm" href="${p.url}">معاينة المشروع</a>` : ""}
            </div>
          </div>
        </div>
      </article>`
    )
    .join("");

  /* ---------- Project filters ---------- */
  const filterButtons = document.querySelectorAll(".filters__btn");
  const cards = [...grid.querySelectorAll(".project-card")];

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      filterButtons.forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      cards.forEach((card) => {
        const show = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("is-hidden", !show);
        card.classList.remove("is-entering");
        if (show) {
          void card.offsetWidth; // restart the entry animation
          card.classList.add("is-entering");
        }
      });
    });
  });

  /* ---------- Modal ---------- */
  const modal = document.getElementById("projectModal");
  const dialog = modal.querySelector(".modal__dialog");
  const modalEls = {
    preview: document.getElementById("modalPreview"),
    type: document.getElementById("modalType"),
    title: document.getElementById("modalTitle"),
    desc: document.getElementById("modalDesc"),
    features: document.getElementById("modalFeatures"),
    tech: document.getElementById("modalTech"),
    counter: document.getElementById("modalCounter"),
    live: document.getElementById("modalLive"),
    request: document.getElementById("modalRequest"),
  };
  let lastFocused = null;
  let currentIndex = 0;

  const renderModal = (index) => {
    const p = projects[index];
    currentIndex = index;

    modalEls.preview.innerHTML = previews[p.preview]();
    modalEls.type.textContent = p.type;
    modalEls.title.textContent = p.name;
    modalEls.desc.textContent = p.description;
    modalEls.features.innerHTML = p.features.map((f) => `<li>${f}</li>`).join("");
    modalEls.tech.innerHTML = p.tech.map((t) => `<li>${t}</li>`).join("");
    modalEls.counter.textContent = `${index + 1} / ${projects.length}`;

    // Projects with a live demo get a preview link; the request button steps back to secondary
    modalEls.live.hidden = !p.url;
    if (p.url) modalEls.live.href = p.url;
    modalEls.request.classList.toggle("btn--primary", !p.url);
    modalEls.request.classList.toggle("btn--ghost", Boolean(p.url));
    dialog.scrollTop = 0;
  };

  const stepModal = (step) => {
    renderModal((currentIndex + step + projects.length) % projects.length);
  };

  const openModal = (id) => {
    const index = projects.findIndex((item) => item.id === id);
    if (index === -1) return;
    renderModal(index);

    lastFocused = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    dialog.focus();
  };

  const closeModal = () => {
    if (!modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    if (lastFocused) lastFocused.focus({ preventScroll: true });
  };

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-project]");
    if (btn) openModal(btn.dataset.project);
  });

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
    const arrow = e.target.closest("[data-step]");
    if (arrow) stepModal(Number(arrow.dataset.step));
  });

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") closeModal();
    // RTL: the left arrow moves forward, the right arrow moves back
    if (e.key === "ArrowLeft") stepModal(1);
    if (e.key === "ArrowRight") stepModal(-1);

    // Keep keyboard focus inside the dialog
    if (e.key === "Tab") {
      const focusable = dialog.querySelectorAll("a[href], button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------- Header: scroll state & mobile menu ---------- */
  const header = document.getElementById("header");
  const nav = document.getElementById("nav");
  const menuToggle = document.getElementById("menuToggle");

  const setMenu = (open) => {
    nav.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    document.body.classList.toggle("no-scroll", open);
  };

  menuToggle.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 960 && nav.classList.contains("open")) setMenu(false);
  });

  const progress = document.getElementById("scrollProgress");
  const waFloat = document.querySelector(".wa-float");

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle("scrolled", y > 20);
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    waFloat.classList.toggle("show", y > window.innerHeight * 0.6);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Active nav link on scroll ---------- */
  const navLinks = document.querySelectorAll(".nav__link");
  const sections = [...navLinks]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;
        navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === id));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => sectionObserver.observe(s));

  /* ---------- Reveal on scroll ---------- */
  const revealObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  // Stagger siblings inside grids for a smoother cascade
  document.querySelectorAll(".reveal").forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = `${Math.min(index * 90, 360)}ms`;
    revealObserver.observe(el);
  });

  /* ---------- Animated counters ---------- */
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animateCount = (el) => {
    const target = Number(el.dataset.count);
    if (prefersReducedMotion) {
      el.textContent = target;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const counterObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.6 }
  );
  document.querySelectorAll("[data-count]").forEach((el) => counterObserver.observe(el));

  /* ---------- Contact form (sends via WhatsApp) ---------- */
  const form = document.getElementById("contactForm");
  const formNote = document.getElementById("formNote");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const messages = {
    name: "يرجى إدخال الاسم",
    email: "يرجى إدخال بريد إلكتروني صحيح",
    service: "يرجى اختيار نوع الخدمة",
    message: "يرجى كتابة تفاصيل المشروع (10 أحرف على الأقل)",
  };

  const validateField = (field) => {
    const value = field.value.trim();
    let valid = value.length > 0;
    if (field.name === "email") valid = emailPattern.test(value);
    if (field.name === "message") valid = value.length >= 10;

    const group = field.closest(".form-group");
    group.classList.toggle("invalid", !valid);
    group.querySelector(".form-error").textContent = valid ? "" : messages[field.name];
    return valid;
  };

  const fields = [...form.querySelectorAll("input, select, textarea")];
  fields.forEach((field) => {
    const evt = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(evt, () => {
      if (field.closest(".form-group").classList.contains("invalid")) validateField(field);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formNote.textContent = "";

    const results = fields.map(validateField);
    if (results.includes(false)) {
      const firstInvalid = fields[results.indexOf(false)];
      firstInvalid.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const text = [
      "مرحبًا رُكن ديجيتال 👋",
      `الاسم: ${data.name.trim()}`,
      `البريد: ${data.email.trim()}`,
      `الخدمة: ${data.service}`,
      `التفاصيل: ${data.message.trim()}`,
    ].join("\n");

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    formNote.textContent = "شكرًا لك! تم تجهيز رسالتك في واتساب، وسنتواصل معك قريبًا.";
    form.reset();
  });

  /* ---------- Footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
