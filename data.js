/* =========================================================
   AZENK — site content data (services, products, work)
   ---------------------------------------------------------
   Edit this file to add / change products, services or work.
   Every text has an Arabic (ar) and English (en) version.

   PRODUCTS
   - price: a number (e.g. 549) or null → shows "Price on request".
     The WhatsApp order message is generated automatically from
     the product name and price (see script.js → waMessages).
   - image: path to an image file (relative to the site root),
     or leave null to use the built-in illustration (art).
   - demoUrl: optional link to a live demo inside this site.

   WORK
   - status: "demo"    → a demo built by AZENK (labelled as demo)
             "live"    → a real delivered / published project
             "concept" → a design concept (labelled as concept)
   Do not add a project as "live" unless it is a real one.
   ========================================================= */
window.AZENK_DATA = {
  /* ---------------- Services ---------------- */
  services: [
    {
      id: "software",
      icon: "code",
      title: { ar: "تطوير البرمجيات", en: "Software Development" },
      desc: { ar: "أنظمة وبرامج مخصصة للأفراد والشركات.", en: "Custom systems and software for individuals and businesses." },
      points: {
        ar: ["أنظمة ويب ولوحات تحكم مخصصة", "أنظمة إدارة داخلية للشركات", "تطبيقات تعمل على الجوال والكمبيوتر", "تطوير وتحسين أنظمة قائمة"],
        en: ["Custom web systems and dashboards", "Internal management systems", "Apps that work on mobile and desktop", "Improving and extending existing systems"],
      },
      message: {
        ar: "السلام عليكم، أرغب في تطوير نظام/برنامج وأود من AZENK معرفة التفاصيل.",
        en: "Hello, I would like to develop a system/software and would like to know the details from AZENK.",
      },
    },
    {
      id: "web",
      icon: "web",
      title: { ar: "المواقع والمتاجر", en: "Websites & Online Stores" },
      desc: { ar: "تصميم وتطوير مواقع ومتاجر إلكترونية احترافية.", en: "Professional websites and online stores, designed and built." },
      points: {
        ar: ["مواقع تعريفية للشركات والأفراد", "صفحات تسويقية وصفحات هبوط", "متاجر إلكترونية سهلة الإدارة", "تحسين السرعة والظهور في محركات البحث"],
        en: ["Company and personal websites", "Marketing and landing pages", "Easy-to-manage online stores", "Speed and search-engine optimisation"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة تطوير موقع من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request a website development service from AZENK and would like to know the details.",
      },
    },
    {
      id: "digital",
      icon: "layers",
      title: { ar: "الحلول الرقمية", en: "Digital Solutions" },
      desc: { ar: "حلول تقنية تساعد الشركات على تطوير أعمالها.", en: "Technology solutions that help businesses grow." },
      points: {
        ar: ["تحويل العمليات الورقية إلى رقمية", "بوابات للعملاء والموظفين", "لوحات متابعة وتقارير", "استشارات لاختيار الحل المناسب"],
        en: ["Turning paper processes into digital ones", "Customer and employee portals", "Dashboards and reporting", "Advice on choosing the right solution"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة الحلول الرقمية من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request AZENK's digital solutions service and would like to know the details.",
      },
    },
    {
      id: "automation",
      icon: "flow",
      title: { ar: "الأتمتة", en: "Automation" },
      desc: { ar: "أتمتة العمليات وربط الأنظمة والخدمات.", en: "Automating processes and connecting systems and services." },
      points: {
        ar: ["أتمتة المهام المتكررة", "ربط الأنظمة والخدمات ببعضها", "تنبيهات وإشعارات تلقائية", "نماذج وطلبات بمسارات موافقة"],
        en: ["Automating repetitive tasks", "Connecting systems and services", "Automatic alerts and notifications", "Forms and requests with approval flows"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة الأتمتة وربط الأنظمة من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request AZENK's automation and integration service and would like to know the details.",
      },
    },
    {
      id: "branding",
      icon: "pen",
      title: { ar: "الهوية والتصميم", en: "Branding & Design" },
      desc: { ar: "هويات بصرية وتصاميم رقمية احترافية.", en: "Visual identities and professional digital design." },
      points: {
        ar: ["تصميم الشعار والهوية البصرية", "دليل استخدام الهوية", "تصاميم السوشيال ميديا", "تصميم واجهات المواقع والتطبيقات"],
        en: ["Logo and visual identity design", "Brand guidelines", "Social media design", "Website and app interface design"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة الهوية والتصميم من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request AZENK's branding and design service and would like to know the details.",
      },
    },
    {
      id: "interior",
      icon: "interior",
      title: { ar: "التصميم الداخلي", en: "Interior Design" },
      desc: { ar: "تصميم مساحات داخلية عصرية وفاخرة للأفراد والشركات.", en: "Modern, refined interior spaces for individuals and businesses." },
      points: {
        ar: ["تصميم المنازل والشقق", "تصميم المكاتب والمساحات التجارية", "تصورات ثلاثية الأبعاد", "اختيار المواد والألوان والإضاءة"],
        en: ["Homes and apartments", "Offices and commercial spaces", "3D visualisations", "Materials, colour and lighting selection"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة تصميم داخلي من AZENK.",
        en: "Hello, I would like to request an interior design service from AZENK.",
      },
    },
  ],

  /* ---------------- Products (sample data — edit freely) ---------------- */
  products: [
    {
      id: "easy-fleet",
      name: "Easy Fleet",
      art: "fleet",
      image: null,
      price: 549,
      demoUrl: "fleetpro/index.html",
      tagline: { ar: "نظام إدارة الأسطول والمركبات", en: "Fleet and vehicle management" },
      summary: {
        ar: "تابع مركباتك وسائقيك والصيانة والرحلات من لوحة واحدة واضحة.",
        en: "Track your vehicles, drivers, maintenance and trips from one clear dashboard.",
      },
      description: {
        ar: "Easy Fleet نظام ويب لإدارة أساطيل المركبات يساعد الشركات على تنظيم المركبات والسائقين، وجدولة الرحلات، ومتابعة الصيانة الدورية وانتهاء الوثائق، مع تقارير تشغيلية تساعد على خفض التكاليف واتخاذ القرار.",
        en: "Easy Fleet is a web system for managing vehicle fleets. It helps businesses organise vehicles and drivers, schedule trips, follow up on maintenance and document expiry, with operational reports that support better decisions and lower costs.",
      },
      features: {
        ar: ["سجل كامل لكل مركبة وسائق", "تنبيهات الصيانة وانتهاء الوثائق", "جدولة الرحلات وتوزيع المهام", "تقارير الوقود والتكاليف", "صلاحيات متعددة للمستخدمين"],
        en: ["Full record for every vehicle and driver", "Maintenance and document-expiry alerts", "Trip scheduling and task assignment", "Fuel and cost reports", "Multiple user roles"],
      },
    },
    {
      id: "parking-pro",
      name: "Parking Pro",
      art: "parking",
      image: null,
      price: null,
      tagline: { ar: "حلول لإدارة مواقف السيارات", en: "Parking management" },
      summary: {
        ar: "نظّم دخول وخروج المركبات والاشتراكات وإشغال المواقف بسهولة.",
        en: "Manage vehicle entry and exit, subscriptions and occupancy with ease.",
      },
      description: {
        ar: "Parking Pro حل لإدارة مواقف السيارات في المباني والمجمعات التجارية والشركات، يساعد على متابعة الإشغال وتسجيل الدخول والخروج وإدارة الاشتراكات والتقارير اليومية.",
        en: "Parking Pro is a solution for managing car parks in buildings, commercial centres and companies. It helps you follow occupancy, log entries and exits, manage subscriptions and review daily reports.",
      },
      features: {
        ar: ["متابعة الإشغال لحظيًا", "تسجيل الدخول والخروج", "إدارة الاشتراكات والتصاريح", "تقارير يومية وشهرية"],
        en: ["Live occupancy overview", "Entry and exit logging", "Subscriptions and permits", "Daily and monthly reports"],
      },
    },
    {
      id: "store-pro",
      name: "Store Pro",
      art: "store",
      image: null,
      price: null,
      tagline: { ar: "حلول للمتاجر الإلكترونية", en: "E-commerce solutions" },
      summary: {
        ar: "متجر إلكتروني أنيق وسريع مع إدارة سهلة للمنتجات والطلبات.",
        en: "An elegant, fast online store with easy product and order management.",
      },
      description: {
        ar: "Store Pro حل جاهز لإطلاق متجر إلكتروني احترافي بهوية علامتك، مع إدارة المنتجات والطلبات والعملاء، وتصميم متجاوب يعمل بسلاسة على الجوال.",
        en: "Store Pro is a ready solution for launching a professional online store in your own brand, with product, order and customer management and a responsive design that works smoothly on mobile.",
      },
      features: {
        ar: ["تصميم بهوية علامتك", "إدارة المنتجات والمخزون", "متابعة الطلبات والعملاء", "تجربة شراء سريعة على الجوال"],
        en: ["Designed in your brand identity", "Product and stock management", "Order and customer tracking", "Fast mobile shopping experience"],
      },
    },
    {
      id: "biz-manager",
      name: "Biz Manager",
      art: "biz",
      image: null,
      price: null,
      tagline: { ar: "حلول لإدارة الأعمال والمشاريع", en: "Business and project management" },
      summary: {
        ar: "نظّم مشاريعك ومهام فريقك وعملاءك في مكان واحد.",
        en: "Organise your projects, team tasks and clients in one place.",
      },
      description: {
        ar: "Biz Manager نظام لإدارة الأعمال والمشاريع يجمع المهام والعملاء والعروض والمتابعة في لوحة واحدة، ليساعد أصحاب الأعمال والفرق على العمل بتنظيم ووضوح.",
        en: "Biz Manager brings tasks, clients, quotations and follow-ups into one dashboard, helping business owners and teams work in an organised, transparent way.",
      },
      features: {
        ar: ["إدارة المشاريع والمهام", "سجل العملاء والمتابعات", "عروض أسعار وفواتير مبسطة", "تقارير الإنجاز والأداء"],
        en: ["Project and task management", "Client records and follow-ups", "Simple quotations and invoices", "Progress and performance reports"],
      },
    },
  ],

  /* ---------------- Work categories ---------------- */
  categories: [
    { id: "software", label: { ar: "البرمجيات", en: "Software" } },
    { id: "websites", label: { ar: "المواقع", en: "Websites" } },
    { id: "stores", label: { ar: "المتاجر", en: "Online Stores" } },
    { id: "digital", label: { ar: "الحلول الرقمية", en: "Digital Solutions" } },
    { id: "design", label: { ar: "التصميم", en: "Design" } },
    { id: "interior", label: { ar: "التصميم الداخلي", en: "Interior Design" } },
  ],

  /* ---------------- Work (only real AZENK-built items) ---------------- */
  work: [
    {
      id: "azenk-site",
      title: "AZENK Website",
      category: "websites",
      status: "live",
      image: "assets/work/azenk-site.webp",
      url: "",
      desc: {
        ar: "الموقع الرسمي لـ AZENK بهوية فاخرة، ثنائي اللغة، مع طلب المنتجات والخدمات عبر واتساب.",
        en: "AZENK's official bilingual website with a premium identity and WhatsApp ordering for products and services.",
      },
    },
    {
      id: "easyhr",
      title: "Easy HR",
      category: "software",
      status: "demo",
      image: "assets/work/easyhr.webp",
      url: "easyhr/index.html",
      desc: {
        ar: "نظام موارد بشرية متكامل: الموظفون، الحضور بالنطاق الجغرافي، الإجازات، الرواتب، الأداء ونهاية الخدمة.",
        en: "A complete HR system: employees, geofenced attendance, leave, payroll, performance and end of service.",
      },
    },
    {
      id: "fleetpro",
      title: "FleetPro",
      category: "software",
      status: "demo",
      image: "assets/work/fleetpro.webp",
      url: "fleetpro/index.html",
      desc: {
        ar: "نظام لإدارة أسطول المركبات والسائقين والصيانة والرحلات من لوحة واحدة.",
        en: "A system for managing vehicles, drivers, maintenance and trips from one dashboard.",
      },
    },
    {
      id: "clinicflow",
      title: "ClinicFlow",
      category: "software",
      status: "demo",
      image: "assets/work/clinicflow.webp",
      url: "clinicflow/index.html",
      desc: {
        ar: "نظام لإدارة العيادات: المرضى والمواعيد والأطباء والفواتير والتقارير.",
        en: "A clinic management system: patients, appointments, doctors, invoices and reports.",
      },
    },
  ],
};
