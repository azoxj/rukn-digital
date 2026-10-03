/* =========================================================
   AZENK HR — application shell: login, navigation, routing,
   theme, notifications popover, global search & command palette.
   Module views live in js/modules/*.js and register themselves
   through EHR.view(key, definition).
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const UI = EHR.UI;
  const { $, $$, esc, icon } = U;

  /* =========================================================
     View registry & navigation model
     ========================================================= */
  const VIEWS = EHR.VIEWS; // populated by js/modules/*.js through EHR.view()
  EHR.actions = EHR.actions || {};

  const NAV = [
    { group: "الرئيسية", items: [["dashboard", "لوحة التحكم", "grid", ["dashboard.view"]]] },
    {
      group: "الموظفون",
      items: [
        ["employees", "الموظفون", "users", ["employees.view", "employees.view_team"]],
        ["org", "الهيكل التنظيمي", "sitemap", ["org.view"]],
        ["recruitment", "التوظيف", "briefcase", ["recruitment.view"]],
        ["onboarding", "الموظف الجديد", "user-plus", ["onboarding.view"]],
      ],
    },
    {
      group: "الوقت والحضور",
      items: [
        ["attendance", "الحضور والانصراف", "clock", ["attendance.self", "attendance.view", "attendance.approve"]],
        ["shifts", "الورديات", "repeat", ["shifts.view"]],
        ["leave", "الإجازات", "palm", ["leave.request", "leave.view", "leave.approve"]],
      ],
    },
    {
      group: "التعويضات",
      items: [
        ["contracts", "العقود", "contract", ["contracts.view"]],
        ["payroll", "الرواتب", "wallet", ["payroll.view", "payroll.self"]],
        ["advances", "السلف", "coins", ["advances.request", "advances.view", "advances.approve"]],
        ["benefits", "البدلات والمزايا", "gift", ["benefits.view"]],
      ],
    },
    {
      group: "التطوير",
      items: [
        ["performance", "الأداء والتقييم", "target", ["performance.self", "performance.view", "performance.review"]],
        ["training", "التدريب والتطوير", "graduation", ["training.self", "training.view"]],
      ],
    },
    {
      group: "السجلات",
      items: [
        ["documents", "المستندات", "folder", ["documents.self", "documents.view"]],
        ["assets", "العهد والأصول", "laptop", ["assets.self", "assets.view"]],
        ["disciplinary", "المخالفات والجزاءات", "gavel", ["disciplinary.view"]],
      ],
    },
    {
      group: "الخدمات",
      items: [
        ["requests", "الطلبات", "inbox", ["requests.submit", "requests.view", "requests.approve"]],
        ["travel", "السفر والانتداب", "plane", ["travel.request", "travel.view", "travel.approve"]],
        ["transfers", "النقل والترقيات", "swap", ["transfers.view"]],
        ["offboarding", "نهاية الخدمة", "door", ["offboarding.view", "clearance.approve"]],
      ],
    },
    {
      group: "النظام",
      items: [
        ["reports", "التقارير", "chart", ["reports.view"]],
        ["calendar", "التقويم", "calendar", ["calendar.view"]],
        ["notifications", "الإشعارات", "bell", ["notifications.view"]],
        ["settings", "الإعدادات", "settings", ["settings.view"]],
        ["help", "مركز المساعدة", "help", []],
      ],
    },
  ];
  const navItem = (key) => NAV.flatMap((g) => g.items).find((i) => i[0] === key);
  const allowed = (key) => {
    const item = navItem(key);
    if (!item) return true;
    return !item[3].length || EHR.auth.canAny(item[3]);
  };
  EHR.allowed = allowed;

  /* =========================================================
     Router
     ========================================================= */
  const parseHash = () => {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(qs || ""));
    return { view: parts[0] || "dashboard", param: parts[1] ? decodeURIComponent(parts[1]) : null, query };
  };
  let currentCtx = null;
  EHR.go = (hash) => {
    if (location.hash === hash) EHR.app.refresh();
    else location.hash = hash;
  };
  EHR.setQuery = (patch) => {
    const r = parseHash();
    const q = new URLSearchParams({ ...r.query, ...patch });
    [...q.keys()].forEach((k) => (q.get(k) === "" || q.get(k) == null) && q.delete(k));
    const hash = `#/${r.view}${r.param ? `/${encodeURIComponent(r.param)}` : ""}${q.toString() ? `?${q}` : ""}`;
    history.replaceState(null, "", hash);
    EHR.app.refresh();
  };

  const renderView = () => {
    if (!EHR.auth.user()) return showLogin();
    const r = parseHash();
    const main = $("#view");
    if (currentCtx && currentCtx.cleanup) currentCtx.cleanup();
    const def = VIEWS[r.view];
    const ctx = { el: main, param: r.param, query: r.query, view: r.view, cleanup: null };
    currentCtx = ctx;
    main.onclick = null;
    main.onkeydown = null;
    main.onchange = null;
    main.oninput = null;
    main.onsubmit = null;
    if (!def) {
      main.innerHTML = UI.empty({ icon: "compass", title: "الصفحة غير موجودة", text: "تأكد من الرابط أو عد إلى لوحة التحكم.", action: { label: "لوحة التحكم", attrs: 'data-go="#/dashboard"', icon: "grid" } });
    } else if (!allowed(r.view)) {
      main.innerHTML = UI.empty({ icon: "lock", title: "لا تملك صلاحية الوصول", text: "هذه الصفحة غير متاحة لدورك الحالي. يمكنك تبديل الدور التجريبي من قائمة المستخدم.", action: { label: "العودة للرئيسية", attrs: 'data-go="#/dashboard"', icon: "grid" } });
    } else {
      try {
        def.render(ctx);
      } catch (err) {
        console.error(err);
        main.innerHTML = UI.empty({ icon: "alert", title: "تعذّر عرض الصفحة", text: err.message });
      }
    }
    const item = navItem(r.view);
    document.title = `${def && def.title ? def.title : item ? item[1] : "AZENK HR"} | AZENK HR`;
    $$(".nav__link").forEach((a) => {
      const on = a.dataset.nav === r.view;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $$(".bottom-nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === r.view));
    updateBadges();
    closeDrawer();
  };

  /* =========================================================
     Login
     ========================================================= */
  const DEMO_ACCOUNTS = [
    ["U-ADMIN", "دخول كمسؤول", "shield", "كل الصلاحيات والشركات"],
    ["U-EMP", "دخول كموظف", "user", "الخدمة الذاتية وتسجيل الحضور"],
    ["U-MGR", "دخول كمدير", "users", "فريق تقنية المعلومات"],
    ["U-HRM", "دخول HR", "briefcase", "مدير الموارد البشرية"],
    ["U-FIN", "دخول Finance", "wallet", "الرواتب والسلف"],
  ];
  const OTHER_ACCOUNTS = [["U-HRO", "أخصائي موارد بشرية"], ["U-REC", "أخصائي توظيف"], ["U-TRN", "مسؤول التدريب"], ["U-AUD", "مدقق (قراءة فقط)"]];

  const showLogin = () => {
    $("#shell").hidden = true;
    const login = $("#login");
    login.hidden = false;
    login.innerHTML = `
      <div class="login__brand">
        <div class="brand brand--light">${brandMark()}<span><b>AZENK HR</b><small>منصة الموارد البشرية المتكاملة</small></span></div>
        <h1>كل دورة حياة الموظف في منصة واحدة</h1>
        <p>من التوظيف والتعيين إلى الحضور بالنطاق الجغرافي، الإجازات، الرواتب، الأداء، ونهاية الخدمة — بواجهة عربية مصممة للشركات في السعودية.</p>
        <ul>
          <li>${icon("map-pin")}حضور وانصراف بالتحقق من الموقع (Geofence)</li>
          <li>${icon("flow")}مسارات موافقات قابلة للتخصيص</li>
          <li>${icon("shield")}صلاحيات حسب الدور ونطاق البيانات</li>
          <li>${icon("chart")}تقارير وتحليلات قابلة للتصدير</li>
        </ul>
        <p class="login__demo">${icon("info")}هذه نسخة تجريبية لعرض النظام. البيانات الحالية تجريبية.</p>
      </div>
      <div class="login__panel">
        <form class="login__form" id="loginForm" novalidate>
          <h2>تسجيل الدخول</h2>
          <p class="muted">ادخل ببريدك أو رقمك الوظيفي، أو استخدم حسابًا تجريبيًا.</p>
          <label class="field"><span>البريد الإلكتروني / الرقم الوظيفي</span><input class="input" name="user" autocomplete="username" dir="ltr" placeholder="name@company.sa"><small class="field__error"></small></label>
          <label class="field"><span>كلمة المرور</span><input class="input" type="password" name="password" autocomplete="current-password" dir="ltr"><small class="field__error"></small></label>
          <div class="login__row">
            <label class="check"><input type="checkbox" name="remember" id="rememberMe"><span>تذكرني</span></label>
            <button type="button" class="link-btn" data-login-forgot>نسيت كلمة المرور؟</button>
          </div>
          <p class="form__error" role="alert"></p>
          <button class="btn btn--primary btn--block" type="submit">${icon("login")}تسجيل الدخول</button>
          <div class="login__divider"><span>أو جرّب النظام بحساب تجريبي</span></div>
          <div class="demo-accounts">
            ${DEMO_ACCOUNTS.map(([id, label, ic, sub]) => `<button type="button" class="demo-acc" data-demo-login="${id}">${icon(ic)}<span><b>${label}</b><small>${sub}</small></span><em>حساب تجريبي</em></button>`).join("")}
          </div>
          <label class="field field--inline"><span>حسابات تجريبية أخرى</span>
            <select class="input input--sm" id="otherDemo"><option value="">اختر دورًا…</option>${OTHER_ACCOUNTS.map(([id, l]) => `<option value="${id}">${l}</option>`).join("")}</select>
          </label>
          <p class="login__note">${icon("lock")}لا تُخزَّن أي كلمات مرور في هذه النسخة. تسجيل الدخول الحقيقي يتطلب خادمًا آمنًا.</p>
          <a class="login__back" href="../index.html">${icon("arrow-right")}العودة إلى AZENK</a>
        </form>
      </div>`;
    const form = $("#loginForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = { user: form.user.value.trim(), password: form.password.value };
      const errs = {};
      if (!f.user) errs.user = "أدخل البريد الإلكتروني أو الرقم الوظيفي";
      if (!f.password) errs.password = "أدخل كلمة المرور";
      $$(".field", form).forEach((w) => {
        const name = $("input", w) && $("input", w).name;
        w.classList.toggle("invalid", !!errs[name]);
        const er = $(".field__error", w);
        if (er) er.textContent = errs[name] || "";
      });
      $(".form__error", form).textContent = Object.keys(errs).length
        ? ""
        : "تسجيل الدخول بكلمة المرور غير مفعّل في النسخة التجريبية لأنه يتطلب خادم مصادقة آمن. استخدم أحد الحسابات التجريبية أدناه.";
    });
    login.onclick = (e) => {
      const b = e.target.closest("[data-demo-login]");
      if (b) return doLogin(b.dataset.demoLogin);
      if (e.target.closest("[data-login-forgot]")) {
        UI.modal({
          title: "استعادة كلمة المرور",
          size: "sm",
          body: UI.notice("استعادة كلمة المرور تتطلب خادمًا لإرسال رابط آمن عبر البريد. هذه الميزة ستتوفر عند ربط النظام بخادم المصادقة.", "info"),
          footer: [{ label: "حسنًا", cls: "btn--primary" }],
        });
      }
    };
    $("#otherDemo").onchange = (e) => e.target.value && doLogin(e.target.value);
  };

  const doLogin = (userId) => {
    const remember = $("#rememberMe") ? $("#rememberMe").checked : false;
    const u = EHR.auth.loginAs(userId, remember);
    $("#login").hidden = true;
    $("#login").innerHTML = "";
    renderShell();
    if (!location.hash || location.hash === "#/" || location.hash.startsWith("#/login")) history.replaceState(null, "", "#/dashboard");
    renderView();
    UI.toast(`مرحبًا ${u.name} — ${EHR.auth.ROLE_DEFS[u.role].label}`, "success", "تم تسجيل الدخول (حساب تجريبي)");
  };

  /* =========================================================
     Shell (sidebar, topbar, bottom nav)
     ========================================================= */
  const brandMark = () => `<span class="brand__mark" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9"/><path d="M10 10h9M10 16h7M10 22h9M10 10v12" /><circle cx="22.5" cy="19" r="3"/></svg></span>`;

  const renderShell = () => {
    const u = EHR.auth.user();
    const role = EHR.auth.ROLE_DEFS[u.role];
    const me = EHR.auth.me();
    const company = EHR.L.company(EHR.auth.companyId());
    $("#shell").hidden = false;

    const groups = NAV.map((g) => {
      const items = g.items.filter(([key]) => allowed(key));
      if (!items.length) return "";
      return `<div class="nav__group"><span class="nav__label">${g.group}</span>${items
        .map(([key, label, ic]) => {
          const selfProfile = key === "employees" && EHR.auth.scope("employees") === "self";
          const href = selfProfile && me ? `#/employees/${me.id}` : `#/${key}`;
          return `<a class="nav__link" href="${href}" data-nav="${key}">${icon(ic)}<span>${selfProfile ? "ملفي الشخصي" : label}</span><em class="nav__badge" data-badge="${key}"></em></a>`;
        })
        .join("")}</div>`;
    }).join("");

    $("#sidebar").innerHTML = `
      <div class="sidebar__top">
        <a href="#/dashboard" class="brand">${brandMark()}<span><b>AZENK HR</b><small>نظام الموارد البشرية</small></span></a>
        <button type="button" class="icon-btn sidebar__close" data-action="close-drawer" aria-label="إغلاق القائمة">${icon("x")}</button>
      </div>
      <div class="company-chip">
        <span class="company-chip__logo" style="--h:${company.logoHue}">${esc(company.name.split(" ").slice(-1)[0].slice(0, 2))}</span>
        <span><b>${esc(company.name)}</b><small>${esc(role.label)}</small></span>
      </div>
      <nav class="nav" aria-label="القائمة الرئيسية">${groups}</nav>
      <div class="sidebar__foot">
        <div class="demo-card">${icon("flask")}<p><b>وضع تجريبي</b>هذه نسخة تجريبية لعرض النظام. البيانات الحالية تجريبية.</p></div>
        <a class="back-link" href="../index.html">${icon("arrow-right")}العودة إلى AZENK</a>
      </div>`;

    const companies = EHR.db.companies;
    $("#topbar").innerHTML = `
      <button type="button" class="icon-btn topbar__menu" data-action="open-drawer" aria-label="فتح القائمة" aria-controls="sidebar">${icon("menu")}</button>
      <button type="button" class="search-btn" data-action="palette" aria-label="البحث والأوامر (Ctrl+K)">${icon("search")}<span>ابحث عن موظف، طلب، عقد، مستند…</span><kbd>Ctrl K</kbd></button>
      <div class="topbar__end">
        <span class="demo-pill" title="هذه نسخة تجريبية لعرض النظام. البيانات الحالية تجريبية.">${icon("flask")}<span>وضع تجريبي</span></span>
        ${EHR.auth.can("companies.manage") ? `<label class="company-select"><span class="sr-only">الشركة</span>${icon("building")}<select id="companySelect" aria-label="الشركة الحالية">${companies.map((c) => `<option value="${c.id}" ${c.id === company.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` : ""}
        <button type="button" class="icon-btn" data-action="theme" aria-label="تبديل الوضع الليلي" data-tip="الوضع الليلي">${icon("moon", "show-light")}${icon("sun", "show-dark")}</button>
        <div class="pop" id="notifPop">
          <button type="button" class="icon-btn" data-action="toggle-notif" aria-label="الإشعارات" aria-haspopup="true" aria-expanded="false">${icon("bell")}<span class="count-dot" id="notifCount"></span></button>
          <div class="pop__panel pop__panel--notif" id="notifPanel"></div>
        </div>
        <div class="pop" id="userPop">
          <button type="button" class="user-btn" data-action="toggle-user" aria-haspopup="true" aria-expanded="false">
            ${UI.avatar(u.name, "sm")}<span class="user-btn__text"><b>${esc(u.name)}</b><small>${esc(role.label)}</small></span>${icon("chevron-down")}
          </button>
          <div class="pop__panel menu" role="menu">
            <div class="menu__head">${UI.avatar(u.name)}<span><b>${esc(u.name)}</b><small>${esc(role.label)} · ${esc(company.name)}</small></span></div>
            ${me ? `<a class="menu__item" href="#/employees/${me.id}" role="menuitem">${icon("user")}ملفي الشخصي</a>` : ""}
            <button type="button" class="menu__item" data-action="switch-role" role="menuitem">${icon("swap")}تبديل الدور التجريبي</button>
            ${allowed("settings") ? `<a class="menu__item" href="#/settings" role="menuitem">${icon("settings")}الإعدادات</a>` : ""}
            <a class="menu__item" href="#/help" role="menuitem">${icon("help")}مركز المساعدة</a>
            <hr>
            <button type="button" class="menu__item is-danger" data-action="logout" role="menuitem">${icon("logout")}تسجيل الخروج</button>
          </div>
        </div>
      </div>`;

    const isEmp = u.role === "EMPLOYEE";
    const bottom = isEmp
      ? [["dashboard", "الرئيسية", "grid"], ["attendance", "الحضور", "clock"], ["leave", "الإجازات", "palm"], ["requests", "الطلبات", "inbox"]]
      : [["dashboard", "الرئيسية", "grid"], [allowed("employees") ? "employees" : "attendance", allowed("employees") ? "الموظفون" : "الحضور", allowed("employees") ? "users" : "clock"], ["requests", "الطلبات", "inbox"], ["notifications", "الإشعارات", "bell"]];
    $("#bottomNav").innerHTML = `${bottom
      .filter(([k]) => allowed(k))
      .map(([k, l, ic]) => {
        const href = k === "employees" && EHR.auth.scope("employees") === "self" && me ? `#/employees/${me.id}` : `#/${k}`;
        return `<a href="${href}" data-nav="${k}">${icon(ic)}<span>${l}</span><em class="nav__badge" data-badge="${k}"></em></a>`;
      })
      .join("")}<button type="button" data-action="open-drawer">${icon("menu")}<span>القائمة</span></button>`;

    const sel = $("#companySelect");
    if (sel)
      sel.onchange = () => {
        EHR.auth.setCompany(sel.value);
        renderShell();
        renderView();
        UI.toast(`تم التبديل إلى ${EHR.L.company(sel.value).name} — البيانات معزولة لكل شركة`, "info");
      };
    updateBadges();
  };

  const updateBadges = () => {
    if (!EHR.auth.user()) return;
    const n = EHR.api.notifications.unread();
    const dot = $("#notifCount");
    if (dot) dot.textContent = n ? (n > 99 ? "99+" : n) : "";
    const pending = EHR.api.approvals.pendingForMe();
    const counts = {
      notifications: n,
      requests: pending.filter((p) => p.def.collection === "requests").length,
      leave: pending.filter((p) => p.def.collection === "leaves").length,
      advances: pending.filter((p) => p.def.collection === "advances").length,
      attendance: pending.filter((p) => ["overtime", "corrections"].includes(p.def.collection)).length,
    };
    $$("[data-badge]").forEach((el) => {
      const v = counts[el.dataset.badge];
      el.textContent = v ? v : "";
    });
  };
  EHR.updateBadges = updateBadges;

  /* =========================================================
     Drawer, popovers, theme
     ========================================================= */
  const openDrawer = () => {
    $("#sidebar").classList.add("open");
    $("#scrim").classList.add("show");
    document.body.classList.add("drawer-open");
    const first = $(".nav__link", $("#sidebar"));
    if (first) first.focus({ preventScroll: true });
  };
  const closeDrawer = () => {
    $("#sidebar") && $("#sidebar").classList.remove("open");
    $("#scrim") && $("#scrim").classList.remove("show");
    document.body.classList.remove("drawer-open");
  };
  const closePops = () => $$(".pop.open").forEach((p) => {
    p.classList.remove("open");
    const b = $("button", p);
    if (b) b.setAttribute("aria-expanded", "false");
  });
  const togglePop = (id) => {
    const p = $(id);
    const open = !p.classList.contains("open");
    closePops();
    p.classList.toggle("open", open);
    $("button", p).setAttribute("aria-expanded", String(open));
    if (open && id === "#notifPop") renderNotifPanel();
  };
  const renderNotifPanel = () => {
    const list = EHR.api.notifications.visible().slice(0, 6);
    $("#notifPanel").innerHTML = `
      <div class="pop__head"><b>الإشعارات</b><button type="button" class="link-btn" data-action="notif-read-all">تحديد الكل كمقروء</button></div>
      <div class="pop__list">${list.length ? list.map((n) => notifRow(n, true)).join("") : UI.empty({ icon: "bell", title: "لا توجد إشعارات" })}</div>
      <a class="pop__foot" href="#/notifications">عرض كل الإشعارات</a>`;
  };
  const NOTIF_ICON = { contract: ["contract", "warning"], document: ["folder", "warning"], approval: ["flow", "brand"], leave: ["palm", "success"], payroll: ["wallet", "info"], attendance: ["clock", "danger"], training: ["graduation", "violet"], request: ["inbox", "info"] };
  const notifRow = (n, compact) => {
    const [ic, tone] = NOTIF_ICON[n.type] || ["bell", "brand"];
    return `<div class="notif ${n.read ? "" : "unread"} ${compact ? "notif--compact" : ""}">
      <span class="notif__icon tone-${tone}">${icon(ic)}</span>
      <button type="button" class="notif__body" data-notif-open="${n.id}"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${U.ago(n.createdAt)}</small></button>
      ${!compact && !n.read ? `<button type="button" class="btn btn--ghost btn--sm" data-notif-read="${n.id}">${icon("check")}تحديد كمقروء</button>` : ""}
    </div>`;
  };
  EHR.notifRow = notifRow;

  const THEME_KEY = "easyhr:theme";
  const applyTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch (e) {
      /* ignore */
    }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0e1424" : "#2451d6");
  };
  EHR.theme = { get: () => document.documentElement.getAttribute("data-theme") || "light", set: applyTheme };

  /* =========================================================
     Role switching (demo)
     ========================================================= */
  const switchRole = () => {
    const users = EHR.db.users;
    const cur = EHR.auth.user();
    const m = UI.modal({
      title: "تبديل الدور التجريبي",
      subtitle: "كل دور يرى قائمة وبيانات مختلفة حسب صلاحياته.",
      size: "md",
      body: `<div class="role-grid">${users
        .map((u) => `<button type="button" class="role-card ${u.id === cur.id ? "is-current" : ""}" data-role-pick="${u.id}">${UI.avatar(u.name)}<span><b>${esc(EHR.auth.ROLE_DEFS[u.role].label)}</b><small>${esc(u.name)}</small></span>${u.id === cur.id ? UI.badge("الحالي", "brand") : ""}</button>`)
        .join("")}</div>`,
      footer: [{ label: "إغلاق" }],
    });
    m.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-role-pick]");
      if (!b) return;
      m.close();
      EHR.auth.loginAs(b.dataset.rolePick, false);
      renderShell();
      history.replaceState(null, "", "#/dashboard");
      renderView();
      const u = EHR.auth.user();
      UI.toast(`أنت الآن: ${EHR.auth.ROLE_DEFS[u.role].label} (${u.name})`, "info", "تم تبديل الدور");
    });
  };

  /* =========================================================
     Command palette + global search (Ctrl+K / "/")
     ========================================================= */
  const COMMANDS = () =>
    [
      ["إضافة موظف", "user-plus", "#/employees?new=1", "employees.create"],
      ["تسجيل حضور", "log-in", "#/attendance?tab=checkin", "attendance.self"],
      ["تسجيل انصراف", "log-out", "#/attendance?tab=checkin", "attendance.self"],
      ["طلب إجازة", "palm", "#/leave?new=1", "leave.request"],
      ["تقديم طلب", "inbox", "#/requests?new=1", "requests.submit"],
      ["طلب سلفة", "coins", "#/advances?new=1", "advances.request"],
      ["فتح الموظفين", "users", "#/employees", "employees.view"],
      ["فتح الحضور والانصراف", "clock", "#/attendance", "attendance.view"],
      ["فتح الرواتب", "wallet", "#/payroll", "payroll.view"],
      ["قسيمة راتبي", "wallet", "#/payroll", "payroll.self"],
      ["فتح التقارير", "chart", "#/reports", "reports.view"],
      ["فتح التوظيف", "briefcase", "#/recruitment", "recruitment.view"],
      ["فتح التقويم", "calendar", "#/calendar", "calendar.view"],
      ["فتح الإعدادات", "settings", "#/settings", "settings.view"],
      ["مركز المساعدة", "help", "#/help", null],
      ["تبديل الوضع الليلي", "moon", "action:theme", null],
    ].filter((c) => !c[3] || EHR.auth.can(c[3]));

  let palIndex = 0;
  const openPalette = () => {
    if (!EHR.auth.user()) return;
    closePops();
    const pal = $("#palette");
    pal.hidden = false;
    requestAnimationFrame(() => pal.classList.add("open"));
    document.body.classList.add("modal-open");
    const input = $("#palInput");
    input.value = "";
    renderPalette("");
    input.focus();
  };
  const closePalette = () => {
    const pal = $("#palette");
    pal.classList.remove("open");
    setTimeout(() => (pal.hidden = true), 150);
    if (!UI.topModal()) document.body.classList.remove("modal-open");
  };
  EHR.openPalette = openPalette;

  const globalSearch = (q) => {
    const L = EHR.L;
    const api = EHR.api;
    const groups = [];
    const emps = api.employees.visible().filter((e) => U.matches(`${e.nameAr} ${e.nameEn} ${e.id} ${L.deptName(e.departmentId)} ${L.titleName(e.jobTitleId)}`, q)).slice(0, 5);
    if (emps.length) groups.push(["الموظفون", emps.map((e) => [`#/employees/${e.id}`, UI.avatar(e.nameAr, "xs"), e.nameAr, `${e.id} · ${L.titleName(e.jobTitleId)}`])]);
    const reqs = api.requests.visible().filter((r) => U.matches(`${r.id} ${r.type} ${L.empName(r.employeeId)}`, q)).slice(0, 4);
    const lvs = api.leave.visible().filter((r) => U.matches(`${r.id} ${L.empName(r.employeeId)} ${(L.leaveType(r.typeId) || {}).name}`, q)).slice(0, 3);
    if (reqs.length || lvs.length)
      groups.push(["الطلبات", [
        ...reqs.map((r) => [`#/requests?open=${r.id}`, icon("inbox"), `${r.type} — ${L.empName(r.employeeId)}`, r.id]),
        ...lvs.map((r) => [`#/leave?open=${r.id}`, icon("palm"), `${(L.leaveType(r.typeId) || {}).name} — ${L.empName(r.employeeId)}`, `${r.id} · ${U.fmtShort(r.from)}`]),
      ]]);
    if (EHR.auth.can("contracts.view")) {
      const cts = api.contracts.all().filter((c) => U.matches(`${c.number} ${L.empName(c.employeeId)}`, q)).slice(0, 4);
      if (cts.length) groups.push(["العقود", cts.map((c) => [`#/contracts?open=${c.id}`, icon("contract"), `${c.number} — ${L.empName(c.employeeId)}`, c.end ? `ينتهي ${U.fmtDate(c.end)}` : "غير محدد المدة"])]);
    }
    const docs = api.documents.visible().filter((d) => U.matches(`${d.name} ${d.category} ${L.empName(d.employeeId)} ${d.number}`, q)).slice(0, 4);
    if (docs.length) groups.push(["المستندات", docs.map((d) => [`#/documents?open=${d.id}`, icon("folder"), `${d.name} — ${L.empName(d.employeeId)}`, d.expiry ? `تنتهي ${U.fmtDate(d.expiry)}` : d.category])]);
    if (EHR.auth.scope("attendance") !== "none") {
      const att = emps.filter((e) => EHR.auth.canSeeEmployee(e.id, "attendance")).slice(0, 3);
      if (att.length) groups.push(["الحضور", att.map((e) => [`#/attendance?tab=history&emp=${e.id}`, icon("clock"), `سجل حضور ${e.nameAr}`, "آخر 30 يومًا"])]);
    }
    if (EHR.auth.can("recruitment.view")) {
      const jobs = api.jobs.all().filter((j) => U.matches(`${j.title} ${j.id}`, q)).slice(0, 3);
      const cands = api.candidates.all().filter((c) => U.matches(`${c.name} ${c.id}`, q)).slice(0, 3);
      if (jobs.length || cands.length)
        groups.push(["التوظيف", [...jobs.map((j) => ["#/recruitment", icon("briefcase"), j.title, `${j.openings} شاغر`]), ...cands.map((c) => [`#/recruitment?cand=${c.id}`, icon("user"), c.name, "مرشح"])]]);
    }
    const assets = api.assets.visible().filter((a) => U.matches(`${a.id} ${a.name} ${a.serial} ${a.type} ${L.empName(a.employeeId)}`, q)).slice(0, 4);
    if (assets.length) groups.push(["العهد", assets.map((a) => [`#/assets?open=${a.id}`, icon("laptop"), `${a.name}`, `${a.id} · ${a.employeeId ? L.empName(a.employeeId) : "متاحة"}`])]);
    return groups;
  };

  const renderPalette = (q) => {
    const cmds = COMMANDS().filter(([label]) => !q || U.matches(label, q));
    const groups = [];
    if (cmds.length) groups.push(["الأوامر", cmds.map(([label, ic, target]) => [target, icon(ic), label, "أمر سريع"])]);
    if (q.trim()) groups.push(...globalSearch(q));
    palIndex = 0;
    $("#palResults").innerHTML = groups.length
      ? groups
          .map(([title, items]) => `<div class="pal__group">${esc(title)}</div>${items
            .map(([target, lead, label, sub]) => `<button type="button" class="pal__item" data-pal-go="${esc(target)}">${lead}<span><b>${esc(label)}</b><small>${esc(sub)}</small></span>${icon("chevron-left", "pal__arrow")}</button>`)
            .join("")}`)
          .join("")
      : UI.empty({ icon: "search", title: `لا توجد نتائج لـ «${q}»`, text: "جرّب اسم موظف أو رقم طلب أو اسم مستند." });
    highlightPal();
  };
  const highlightPal = () => {
    const items = $$(".pal__item");
    items.forEach((el, i) => {
      el.classList.toggle("active", i === palIndex);
      el.setAttribute("aria-selected", String(i === palIndex));
    });
    if (items[palIndex]) items[palIndex].scrollIntoView({ block: "nearest" });
  };
  const palGo = (target) => {
    closePalette();
    if (target === "action:theme") return EHR.actions.theme();
    EHR.go(target);
  };

  /* =========================================================
     Global event delegation
     ========================================================= */
  Object.assign(EHR.actions, {
    "open-drawer": openDrawer,
    "close-drawer": closeDrawer,
    palette: openPalette,
    theme: () => {
      const next = EHR.theme.get() === "dark" ? "light" : "dark";
      applyTheme(next);
      UI.toast(next === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع النهاري", "info");
      if (currentCtx && currentCtx.view === "settings") renderView();
    },
    "toggle-notif": () => togglePop("#notifPop"),
    "toggle-user": () => togglePop("#userPop"),
    "switch-role": () => {
      closePops();
      switchRole();
    },
    logout: async () => {
      closePops();
      const ok = await UI.confirm({ title: "تسجيل الخروج", text: "هل تريد تسجيل الخروج من الحساب التجريبي؟", confirmLabel: "تسجيل الخروج" });
      if (!ok) return;
      EHR.auth.logout();
      UI.closeAllModals();
      history.replaceState(null, "", "#/login");
      showLogin();
    },
    "notif-read-all": () => {
      EHR.api.notifications.markAll();
      updateBadges();
      renderNotifPanel();
      if (currentCtx && currentCtx.view === "notifications") renderView();
      UI.toast("تم تحديد جميع الإشعارات كمقروءة", "info");
    },
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.closest(".pop")) closePops();
    const act = t.closest("[data-action]");
    if (act && EHR.actions[act.dataset.action]) {
      e.preventDefault();
      return EHR.actions[act.dataset.action](act, e);
    }
    const go = t.closest("[data-go]");
    if (go) {
      e.preventDefault();
      UI.closeAllModals();
      closePops();
      return EHR.go(go.dataset.go);
    }
    const pal = t.closest("[data-pal-go]");
    if (pal) return palGo(pal.dataset.palGo);
    if (t.closest("#palette") && !t.closest(".pal__box")) return closePalette();
    const nOpen = t.closest("[data-notif-open]");
    if (nOpen) {
      const n = EHR.db.notifications.find((x) => x.id === nOpen.dataset.notifOpen);
      EHR.api.notifications.markRead(n.id);
      closePops();
      updateBadges();
      if (n.link) EHR.go(n.link);
      else renderView();
      return;
    }
    const nRead = t.closest("[data-notif-read]");
    if (nRead) {
      EHR.api.notifications.markRead(nRead.dataset.notifRead);
      updateBadges();
      renderView();
      UI.toast("تم تحديد الإشعار كمقروء", "info");
    }
    if (t.closest(".nav__link") && window.innerWidth <= 1100) closeDrawer();
  });
  $("#scrim").addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    const palOpen = !$("#palette").hidden;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      return palOpen ? closePalette() : openPalette();
    }
    if (e.key === "/" && !typing && !palOpen && !UI.topModal()) {
      e.preventDefault();
      return openPalette();
    }
    if (palOpen) {
      const items = $$(".pal__item");
      if (e.key === "Escape") return closePalette();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        palIndex = (palIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        return highlightPal();
      }
      if (e.key === "Enter" && items[palIndex]) {
        e.preventDefault();
        return palGo(items[palIndex].dataset.palGo);
      }
      return;
    }
    // Keyboard activation for non-button elements that navigate (role="link" list rows, cards)
    if ((e.key === "Enter" || e.key === " ") && !typing && document.activeElement.matches("[data-go]:not(button):not(a)")) {
      e.preventDefault();
      return document.activeElement.click();
    }
    if (e.key === "Escape" && !UI.topModal()) {
      closePops();
      closeDrawer();
    }
  });
  $("#palInput").addEventListener("input", (e) => renderPalette(e.target.value));

  document.addEventListener("ehr:notify", () => updateBadges());
  window.addEventListener("hashchange", renderView);

  /* =========================================================
     Public app API & boot
     ========================================================= */
  EHR.app = {
    refresh() {
      renderView();
    },
    rerenderShell() {
      UI.closeAllModals();
      renderShell();
      renderView();
    },
    ctx: () => currentCtx,
  };

  const boot = () => {
    EHR.store.init();
    if (EHR.auth.restore()) {
      renderShell();
      if (!location.hash || location.hash.startsWith("#/login")) history.replaceState(null, "", "#/dashboard");
      renderView();
    } else {
      showLogin();
    }
    document.documentElement.classList.remove("is-booting");
  };
  boot();
})((window.EHR = window.EHR || {}));
