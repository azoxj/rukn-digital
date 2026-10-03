/* =========================================================
   AZENK — site content data (services, products, work)
   ---------------------------------------------------------
   Edit this file to add / change products, services or work.
   Every text has an Arabic (ar) and English (en) version.

   PRODUCTS — only systems that are actually programmed.
   - status: "ready" → جاهز (delivered/production version)
             "demo"  → Demo متاح (a working demo exists)
             "dev"   → قيد التطوير (real code, not released yet)
     Never list an idea or an unbuilt system as a product.
   - demoUrl: link to a REAL working demo inside this site, or "".
     Never add a demo link that does not exist.
   - image: a real screenshot of the system (relative to the site
     root), or null when no screenshot exists yet.
   - No numeric prices are shown: every product is "price on request".
     The WhatsApp order message is generated from the product name.

   WORK
   - status: "live" → a real delivered / published project
             "demo" → a demo built by AZENK (labelled as demo)
   ========================================================= */
window.AZENK_DATA = {
  /* ---------------- Services (separate from products) ---------------- */
  services: [
    {
      id: "software",
      icon: "code",
      title: { ar: "تطوير أنظمة مخصصة", en: "Custom Systems Development" },
      desc: { ar: "أنظمة وبرامج مبنية حسب احتياج عملك للأفراد والشركات.", en: "Systems and software built around how your business works." },
      points: {
        ar: ["أنظمة ويب ولوحات تحكم مخصصة", "أنظمة إدارة داخلية للشركات", "صلاحيات وأدوار للمستخدمين", "تطوير وتحسين أنظمة قائمة"],
        en: ["Custom web systems and dashboards", "Internal management systems", "User roles and permissions", "Improving and extending existing systems"],
      },
      message: {
        ar: "السلام عليكم، أرغب في تطوير نظام/برنامج وأود من AZENK معرفة التفاصيل.",
        en: "Hello, I would like to develop a system/software and would like to know the details from AZENK.",
      },
    },
    {
      id: "web",
      icon: "web",
      title: { ar: "تطوير مواقع ومتاجر", en: "Websites & Online Stores" },
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
      id: "automation",
      icon: "flow",
      title: { ar: "أتمتة وحلول رقمية", en: "Automation & Digital Solutions" },
      desc: { ar: "أتمتة العمليات وربط الأنظمة وتحويل الإجراءات إلى حلول رقمية.", en: "Automating processes, connecting systems and digitising procedures." },
      points: {
        ar: ["أتمتة المهام المتكررة", "ربط الأنظمة والخدمات ببعضها", "تحويل النماذج الورقية إلى رقمية", "لوحات متابعة وتقارير"],
        en: ["Automating repetitive tasks", "Connecting systems and services", "Turning paper forms into digital ones", "Dashboards and reporting"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة الأتمتة والحلول الرقمية من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request AZENK's automation and digital solutions service and would like to know the details.",
      },
    },
    {
      id: "branding",
      icon: "pen",
      title: { ar: "تصميم وهوية", en: "Design & Branding" },
      desc: { ar: "هويات بصرية وتصاميم رقمية احترافية تعكس قيمة علامتك.", en: "Visual identities and professional digital design that reflect your brand." },
      points: {
        ar: ["تصميم الشعار والهوية البصرية", "دليل استخدام الهوية", "تصاميم السوشيال ميديا", "تصميم واجهات المواقع والتطبيقات"],
        en: ["Logo and visual identity design", "Brand guidelines", "Social media design", "Website and app interface design"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة التصميم والهوية من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request AZENK's design and branding service and would like to know the details.",
      },
    },
    {
      id: "graduation",
      icon: "graduation",
      title: { ar: "مشاريع تخرج", en: "Graduation Projects" },
      desc: { ar: "تطوير مشاريع التخرج التقنية مع التوثيق والشرح.", en: "Technical graduation projects, with documentation and explanation." },
      points: {
        ar: ["أنظمة ومواقع وتطبيقات ويب", "توثيق المشروع وشرح طريقة عمله", "تجهيز العرض التقديمي للمناقشة", "متابعة وتعديلات حسب الملاحظات"],
        en: ["Systems, websites and web apps", "Project documentation and walkthrough", "Presentation for the final defence", "Follow-up and revisions based on feedback"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب خدمة مشروع تخرج من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request a graduation project service from AZENK and would like to know the details.",
      },
    },
    {
      id: "presentations",
      icon: "slides",
      title: { ar: "عروض PowerPoint", en: "PowerPoint Presentations" },
      desc: { ar: "تصميم عروض تقديمية احترافية للشركات والأفراد والمشاريع.", en: "Professional presentations for companies, individuals and projects." },
      points: {
        ar: ["عروض تعريفية للشركات", "عروض المشاريع والمناقشات", "تحويل المحتوى إلى شرائح واضحة", "تصميم بهوية علامتك"],
        en: ["Company profile presentations", "Project and defence presentations", "Turning content into clear slides", "Designed in your brand identity"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب تصميم عرض PowerPoint من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request a PowerPoint presentation design from AZENK and would like to know the details.",
      },
    },
    {
      id: "callcenter",
      icon: "headset",
      title: { ar: "حلول كول سنتر", en: "Call Center Solutions" },
      desc: { ar: "حلول لتنظيم مراكز الاتصال وخدمة العملاء ومتابعة الطلبات.", en: "Solutions for organising call centres, customer service and request follow-up." },
      points: {
        ar: ["تنظيم متابعة الطلبات والتذاكر", "نصوص ومسارات للمكالمات", "تقارير أداء الخدمة", "ربط خدمة العملاء بأنظمة العمل"],
        en: ["Request and ticket follow-up", "Call scripts and flows", "Service performance reports", "Linking customer service with business systems"],
      },
      message: {
        ar: "السلام عليكم، أرغب في طلب حلول الكول سنتر من AZENK وأود معرفة التفاصيل.",
        en: "Hello, I would like to request call center solutions from AZENK and would like to know the details.",
      },
    },
  ],

  /* ---------------- Products (only systems that are actually programmed) ---------------- */
  products: [
    {
      id: "easy-hr",
      name: "Easy HR",
      status: "demo",
      demoUrl: "easyhr/index.html",
      image: "assets/work/easyhr.webp",
      tagline: { ar: "نظام موارد بشرية متكامل", en: "Complete HR management system" },
      summary: {
        ar: "إدارة الموظفين والحضور والإجازات والرواتب والأداء ونهاية الخدمة في نظام واحد.",
        en: "Employees, attendance, leave, payroll, performance and end of service in one system.",
      },
      description: {
        ar: "Easy HR نظام موارد بشرية مبرمج بالكامل بواجهة عربية، يغطي دورة حياة الموظف من التوظيف والتهيئة إلى الحضور والإجازات والرواتب والأداء ونهاية الخدمة. النسخة المتاحة Demo تعمل في المتصفح ببيانات تجريبية، ويمكن تخصيص النظام وربطه بخادم وقاعدة بيانات عند التسليم.",
        en: "Easy HR is a fully programmed Arabic HR system covering the employee lifecycle: recruitment and onboarding, attendance, leave, payroll, performance and end of service. The available demo runs in the browser with sample data; the system can be customised and connected to a server and database on delivery.",
      },
      features: {
        ar: ["الموظفون والهيكل التنظيمي والتوظيف", "حضور وانصراف بالتحقق من الموقع (Geofence)", "الإجازات والطلبات بمسارات موافقة", "مسير رواتب وقسائم رواتب", "الأداء والتدريب ونهاية الخدمة", "صلاحيات حسب الدور وتقارير CSV"],
        en: ["Employees, organisation and recruitment", "Geofenced attendance check-in", "Leave and requests with approval flows", "Payroll runs and payslips", "Performance, training and end of service", "Role-based access and CSV reports"],
      },
    },
    {
      id: "fleetpro",
      name: "FleetPro",
      status: "demo",
      demoUrl: "fleetpro/index.html",
      image: "assets/work/fleetpro.webp",
      tagline: { ar: "نظام إدارة الأسطول", en: "Fleet management system" },
      summary: {
        ar: "متابعة المركبات والسائقين والصيانة والوقود والتأمين والمخالفات من لوحة واحدة.",
        en: "Track vehicles, drivers, maintenance, fuel, insurance and violations from one dashboard.",
      },
      description: {
        ar: "FleetPro نظام ويب مبرمج لإدارة أساطيل المركبات، يجمع بيانات المركبات والسائقين وسجلات الصيانة والوقود والتأمين والحوادث والمخالفات مع تقارير ولوحة تحكم. النسخة المتاحة Demo تعمل في المتصفح ببيانات تجريبية، ويمكن تخصيصها حسب طبيعة أسطولك.",
        en: "FleetPro is a programmed web system for managing vehicle fleets. It brings together vehicles, drivers, maintenance, fuel, insurance, accidents and violations, with reports and a dashboard. The available demo runs in the browser with sample data and can be customised to your fleet.",
      },
      features: {
        ar: ["سجل المركبات والسائقين", "الصيانة والوقود", "التأمين والحوادث والمخالفات", "لوحة تحكم وتقارير مع تصدير CSV"],
        en: ["Vehicle and driver records", "Maintenance and fuel", "Insurance, accidents and violations", "Dashboard and reports with CSV export"],
      },
    },
    {
      id: "clinicflow",
      name: "ClinicFlow",
      status: "demo",
      demoUrl: "clinicflow/index.html",
      image: "assets/work/clinicflow.webp",
      tagline: { ar: "نظام إدارة العيادات", en: "Clinic management system" },
      summary: {
        ar: "إدارة المرضى والمواعيد والأطباء والعيادات والفواتير والتقارير.",
        en: "Manage patients, appointments, doctors, clinics, invoices and reports.",
      },
      description: {
        ar: "ClinicFlow نظام ويب مبرمج لإدارة العيادات والمجمعات الطبية، يشمل ملفات المرضى وجدولة المواعيد ومتابعة الأطباء والعيادات والفواتير والتقارير والإشعارات. النسخة المتاحة Demo تعمل في المتصفح ببيانات تجريبية وليست للاستخدام الطبي الفعلي قبل التخصيص والربط بخادم آمن.",
        en: "ClinicFlow is a programmed web system for clinics and medical centres, covering patient records, appointment scheduling, doctors, clinics, invoices, reports and notifications. The available demo runs in the browser with sample data and is not for real medical use before customisation and a secure server setup.",
      },
      features: {
        ar: ["ملفات المرضى وسجل الزيارات", "جدولة المواعيد ومنع التعارض", "الأطباء والعيادات", "الفواتير والتقارير مع تصدير CSV"],
        en: ["Patient records and visit history", "Appointment scheduling without conflicts", "Doctors and clinics", "Invoices and reports with CSV export"],
      },
    },
    {
      id: "easy-fleet",
      name: "Easy Fleet",
      status: "dev",
      demoUrl: "",
      image: null,
      tagline: { ar: "نظام إدارة المركبات والمشاريع", en: "Vehicle and project management" },
      summary: {
        ar: "نظام بخادم وقاعدة بيانات لإدارة المركبات والمشاريع والإسنادات — المرحلة الأولى مكتملة.",
        en: "A server-backed system for vehicles, projects and assignments — first phase completed.",
      },
      description: {
        ar: "Easy Fleet نظام قيد التطوير مبني بخادم وقاعدة بيانات حقيقية. اكتملت مرحلته الأولى: تسجيل الدخول الآمن، المستخدمون والأدوار والصلاحيات، المشاريع والإسنادات، المركبات، لوحة التحكم، سجل التدقيق والإشعارات. لا تتوفر له نسخة Demo عامة بعد، ويمكنك التواصل لمعرفة موعد توفره.",
        en: "Easy Fleet is in development, built on a real server and database. Its first phase is complete: secure sign-in, users, roles and permissions, projects and assignments, vehicles, a dashboard, an audit log and notifications. No public demo is available yet; contact us to learn when it will be available.",
      },
      features: {
        ar: ["تسجيل دخول آمن وصلاحيات حسب الدور", "المشاريع والإسنادات", "إدارة المركبات وسجلها الزمني", "سجل تدقيق وإشعارات"],
        en: ["Secure sign-in and role-based permissions", "Projects and assignments", "Vehicle management and timeline", "Audit log and notifications"],
      },
    },
  ],

  /* ---------------- Work categories ---------------- */
  categories: [
    { id: "software", label: { ar: "الأنظمة", en: "Systems" } },
    { id: "websites", label: { ar: "المواقع والمتاجر", en: "Websites & Stores" } },
    { id: "automation", label: { ar: "الأتمتة والحلول الرقمية", en: "Automation & Digital" } },
    { id: "design", label: { ar: "التصميم والهوية", en: "Design & Branding" } },
    { id: "graduation", label: { ar: "مشاريع التخرج", en: "Graduation Projects" } },
    { id: "presentations", label: { ar: "العروض التقديمية", en: "Presentations" } },
  ],

  /* ---------------- Work (only real AZENK-built items) ----------------
     Programmed systems are listed under products (not repeated here). */
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
  ],
};
