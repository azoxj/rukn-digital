/* =========================================================
   AZENK — site content data (systems, services, finder, work)
   ---------------------------------------------------------
   Every text has an Arabic (ar) and English (en) version.

   PRODUCTS (الأنظمة) — only systems that are actually programmed
   and tested. Never list an idea or an unbuilt system here.
   - status: "ready" → جاهز       (usable now)
             "demo"  → Demo متاح   (a real working demo exists)
             "dev"   → قيد التطوير (real code, not released yet)
   - demo.type: "live"    → the demo opens on this site (demo.url).
                            Server systems run their real code in the
                            visitor's browser (demos/, built by
                            platform/scripts/build-demo.js).
                "request" → demo shown in a live session on request
   - runtime: "browser" → runs in the browser, data stays on the device
              "server"  → Node.js server + database + accounts/roles
   - image: a real screenshot of the system (relative to site root).
   - No numeric prices: every system is "price on request".
   ========================================================= */
window.AZENK_DATA = {
  /* ---------------- Systems (programmed and tested) ---------------- */
  products: [
    {
      id: "azenk-hr",
      name: "AZENK HR",
      status: "demo",
      demo: { type: "live", url: "easyhr/index.html" },
      runtime: "browser",
      image: "assets/work/azenk-hr.webp",
      tagline: { ar: "نظام الموارد البشرية", en: "HR management system" },
      summary: {
        ar: "دورة حياة الموظف كاملة: الموظفون، الهيكل، الحضور، الإجازات، العقود، الرواتب، الأداء ونهاية الخدمة.",
        en: "The full employee lifecycle: employees, structure, attendance, leave, contracts, payroll, performance and end of service.",
      },
      problem: {
        ar: "ملفات إكسل متفرقة وطلبات ورقية وموافقات ضائعة لشؤون الموظفين.",
        en: "Scattered spreadsheets, paper requests and lost approvals for employee affairs.",
      },
      description: {
        ar: "AZENK HR نظام موارد بشرية مبرمج بواجهة عربية يغطي الموظفين والأقسام والوظائف والتوظيف والتهيئة، والحضور بالتحقق من الموقع والورديات، والإجازات والطلبات بمسارات موافقة، والعقود والمستندات والرواتب والسلف، والأداء والتدريب ونهاية الخدمة، مع صلاحيات حسب الدور وسجل تدقيق وتقارير. نسخة الـ Demo تعمل في المتصفح ببيانات تجريبية محفوظة على جهازك؛ ويُربط بخادم وقاعدة بيانات وتسجيل دخول حقيقي عند التنفيذ للمنشأة.",
        en: "AZENK HR is a programmed Arabic HR system covering employees, departments, positions, recruitment and onboarding, geofenced attendance and shifts, leave and requests with approval flows, contracts, documents, payroll and advances, performance, training and end of service — with role-based permissions, an audit log and reports. The demo runs in the browser with sample data stored on your device; a server, database and real sign-in are set up when it is implemented for an organisation.",
      },
      features: {
        ar: ["الموظفون والأقسام والوظائف والهيكل التنظيمي", "الحضور والانصراف بالتحقق من الموقع والورديات", "الإجازات والطلبات بمسارات موافقة", "العقود والمستندات والرواتب والسلف", "الأداء والتدريب ونهاية الخدمة", "أدوار وصلاحيات وسجل تدقيق وتقارير CSV"],
        en: ["Employees, departments, positions and org chart", "Geofenced attendance and shifts", "Leave and requests with approval flows", "Contracts, documents, payroll and advances", "Performance, training and end of service", "Roles, permissions, audit log and CSV reports"],
      },
    },
    {
      id: "azenk-callcenter",
      name: "AZENK Call Center",
      status: "demo",
      demo: { type: "live", url: "demos/callcenter/" },
      runtime: "server",
      image: "assets/work/callcenter.webp",
      tagline: { ar: "نظام مركز الاتصال وخدمة العملاء", en: "Call centre & customer service system" },
      summary: {
        ar: "سجل العملاء والمكالمات والتذاكر والمتابعات وأداء الفريق في نظام واحد بصلاحيات واضحة.",
        en: "Customers, calls, tickets, follow-ups and team performance in one system with clear permissions.",
      },
      problem: {
        ar: "مكالمات لا تُسجَّل، وطلبات عملاء تضيع بين الموظفين، ولا توجد متابعة أو تقارير أداء.",
        en: "Unlogged calls, customer requests lost between staff, and no follow-up or performance reports.",
      },
      description: {
        ar: "AZENK Call Center نظام بخادم وقاعدة بيانات لإدارة خدمة العملاء: ملف لكل عميل بسجل تواصله، وتسجيل المكالمات الواردة والصادرة بمؤقت ومدة وحالة وملاحظات، وتذاكر بأولويات وحالات وإسناد وسجل تغييرات، ومتابعات ومهام بمواعيد، ولوحة تحكم وتقارير مع تصدير CSV، وبحث شامل وإشعارات وسجل تدقيق. الأدوار: مدير المنصة، مدير النظام، المشرف، موظف خدمة العملاء، مع عزل بيانات كل منشأة. يُسجَّل اتصال المكالمة داخل النظام؛ والربط مع مزود اتصال (VoIP) أو واتساب أو الرسائل يُنفَّذ كمشروع إضافي عند الطلب ولا يتضمنه النظام حاليًا.",
        en: "AZENK Call Center is a server-backed system for customer service: a profile and contact history for every customer, logging inbound and outbound calls with a timer, duration, status and notes, tickets with priorities, statuses, assignment and change history, scheduled follow-ups and tasks, a dashboard and reports with CSV export, global search, notifications and an audit log. Roles: platform super admin, admin, supervisor and agent, with each organisation's data isolated. Calls are logged inside the system; connecting a telephony (VoIP) provider, WhatsApp or SMS is a separate project on request and is not included today.",
      },
      features: {
        ar: ["العملاء وسجل التواصل الكامل لكل عميل", "تسجيل المكالمات بمؤقت ومدة وحالة وملاحظات", "التذاكر: أولوية، حالة، إسناد، سجل تغييرات", "متابعات ومهام بمواعيد وتنبيهات", "لوحة تحكم وتقارير أداء وتصدير CSV", "أدوار وصلاحيات وعزل بيانات وسجل تدقيق"],
        en: ["Customers with full contact history", "Call logging with timer, duration, status and notes", "Tickets: priority, status, assignment, history", "Scheduled follow-ups and tasks with notifications", "Dashboard, performance reports and CSV export", "Roles, permissions, data isolation and audit log"],
      },
    },
    {
      id: "azenk-requests",
      name: "AZENK Requests",
      status: "demo",
      demo: { type: "live", url: "demos/requests/" },
      runtime: "server",
      image: "assets/work/requests.webp",
      tagline: { ar: "الطلبات الداخلية والموافقات", en: "Internal requests & approvals" },
      summary: {
        ar: "طلبات الإجازة والشراء والدعم التقني وغيرها بنماذج تحددها أنت ومسارات موافقة على مراحل.",
        en: "Leave, purchase, IT support and any request you define, with multi-step approval paths.",
      },
      problem: {
        ar: "طلبات داخلية عبر الورق والواتساب، وموافقات تتأخر أو تضيع، ولا أحد يعرف أين وصل الطلب.",
        en: "Internal requests on paper and chat, approvals that stall or get lost, and nobody knows where a request is.",
      },
      description: {
        ar: "AZENK Requests نظام بخادم وقاعدة بيانات للطلبات الداخلية: يحدد مدير النظام أنواع الطلبات وحقولها (نص، رقم، تاريخ، قائمة، مربع اختيار) ومسار الموافقة لكل نوع — المدير المباشر، أو دور، أو شخص محدد — مع مدة استجابة لكل مرحلة. يقدّم الموظف الطلب مع مرفقاته، ويوافق المعتمد أو يرفض أو يعيده للتعديل، ويُعاد الإرسال بعد التعديل. يشمل صندوق موافقات، وإشعارات، وتعليقات، ولوحة تحكم، وتقارير بأوقات البت وتصدير CSV، وسجل تدقيق، ويمنع اعتماد الشخص لطلبه بنفسه. الأدوار: مدير النظام، المدير، الموظف. الإشعارات داخل النظام؛ ولا يتضمن حاليًا إرسال بريد إلكتروني أو رسائل نصية.",
        en: "AZENK Requests is a server-backed system for internal requests: the admin defines request types, their fields (text, number, date, list, checkbox) and each type's approval path — direct manager, a role or a named person — with a response time per step. Employees submit requests with attachments; approvers approve, reject or return them for changes, and returned requests are resubmitted. It includes an approvals inbox, notifications, comments, a dashboard, reports with decision times and CSV export, and an audit log, and it blocks self-approval. Roles: admin, manager, employee. Notifications are in-app; e-mail or SMS delivery is not included today.",
      },
      features: {
        ar: ["أنواع طلبات وحقول تحددها بنفسك", "مسارات موافقة: المدير المباشر، دور، أو شخص محدد", "موافقة، رفض، أو إعادة للتعديل مع التعليق", "مرفقات موثّقة النوع وتعليقات وإشعارات", "مدة استجابة لكل مرحلة وتنبيه بالمتأخر", "تقارير بأوقات البت وتصدير CSV وسجل تدقيق"],
        en: ["Request types and fields you define", "Approval paths: direct manager, role or named person", "Approve, reject or return with comments", "Type-checked attachments, comments and notifications", "Response time per step with overdue tracking", "Decision-time reports, CSV export and audit log"],
      },
    },
    {
      id: "azenk-graduation",
      name: "AZENK Graduation",
      status: "demo",
      demo: { type: "live", url: "demos/graduation/" },
      runtime: "server",
      image: "assets/work/graduation.webp",
      tagline: { ar: "نظام إدارة مشاريع التخرج", en: "Graduation project management" },
      summary: {
        ar: "المشاريع والفرق والمراحل والمهام والملفات وملاحظات المشرف والتقييم في منصة واحدة.",
        en: "Projects, teams, milestones, tasks, files, supervisor feedback and evaluation on one platform.",
      },
      problem: {
        ar: "متابعة مشاريع التخرج عبر البريد والمجموعات، وملفات وملاحظات متفرقة، وتقييم بلا معايير واضحة.",
        en: "Graduation projects followed over e-mail and chat groups, scattered files and feedback, and evaluation without clear criteria.",
      },
      description: {
        ar: "AZENK Graduation نظام بخادم وقاعدة بيانات للجامعات والكليات وجهات التدريب: إنشاء المشاريع وتحديد المشرف وفريق الطلاب، ومراحل بأوزان ومواعيد يسلّمها الطلاب ويعتمدها المشرف أو يطلب تعديلها، ولوحة مهام للفريق، ورفع ملفات موثّقة النوع، وملاحظات المشرف، وتقييم بمعايير ودرجات، ونسبة إنجاز محسوبة، ولوحات تحكم حسب الدور وتقارير مع تصدير CSV وإشعارات وسجل تدقيق. الأدوار: مدير النظام، المشرف، الطالب.",
        en: "AZENK Graduation is a server-backed system for universities, colleges and training bodies: create projects with a supervisor and a student team, weighted milestones with due dates that students submit and supervisors approve or return, a team task board, type-checked file uploads, supervisor feedback, rubric-based evaluation, calculated progress, role-based dashboards, reports with CSV export, notifications and an audit log. Roles: admin, supervisor and student.",
      },
      features: {
        ar: ["المشاريع والمشرفون وفرق الطلاب", "مراحل بأوزان: تسليم ← مراجعة ← اعتماد", "لوحة مهام للفريق بمواعيد ومسؤولين", "رفع وتنزيل الملفات مع التحقق من نوعها", "ملاحظات المشرف وتقييم بمعايير ودرجات", "نسبة إنجاز وتقارير وإشعارات وسجل تدقيق"],
        en: ["Projects, supervisors and student teams", "Weighted milestones: submit → review → approve", "Team task board with owners and due dates", "Type-checked file upload and download", "Supervisor feedback and rubric evaluation", "Progress, reports, notifications and audit log"],
      },
    },
    {
      id: "azenk-presentations",
      name: "AZENK Presentations",
      status: "ready",
      demo: { type: "live", url: "presentations/" },
      runtime: "browser",
      image: "assets/work/presentations.webp",
      tagline: { ar: "إنشاء العروض وتصديرها إلى PowerPoint", en: "Build presentations and export to PowerPoint" },
      summary: {
        ar: "أنشئ عرضًا من قالب، حرّر الشرائح والنقاط والصور، اعرضه، ثم صدّره كملف PowerPoint ‎(.pptx).",
        en: "Start from a template, edit slides, bullets and images, present, then export a PowerPoint (.pptx) file.",
      },
      problem: {
        ar: "وقت طويل في ترتيب الشرائح وتنسيقها من الصفر لكل عرض.",
        en: "Hours spent arranging and formatting slides from scratch for every presentation.",
      },
      description: {
        ar: "AZENK Presentations أداة تعمل في المتصفح: اختر نوع العرض (تعريف شركة، مشروع، مشروع تخرج، مبيعات) والقالب، فتحصل على شرائح أولية تحرّرها: عناوين ونقاط ونصوص وصور وملاحظات المتحدث، مع إضافة وحذف وتكرار وإعادة ترتيب الشرائح وعرضها بملء الشاشة، ثم تصدير ملف PowerPoint حقيقي ‎(.pptx) يدعم العربية. تُحفظ العروض على جهازك، ويمكن حفظ نسخة JSON ونقلها. وللعروض التي يصممها فريق AZENK بالكامل تتوفر خدمة عروض PowerPoint.",
        en: "AZENK Presentations runs in the browser: choose a presentation type (company profile, project, graduation project, sales) and a template to get starter slides, then edit titles, bullets, text, images and speaker notes, add, delete, duplicate and reorder slides, present full screen and export a real PowerPoint (.pptx) file with Arabic support. Presentations are saved on your device and can be saved and moved as JSON. For decks fully designed by the AZENK team, see the PowerPoint presentations service.",
      },
      features: {
        ar: ["قوالب وأنواع عروض بشرائح أولية جاهزة", "7 تخطيطات: غلاف، قسم، نقاط، نص، صورة، خاتمة…", "إضافة وحذف وتكرار وإعادة ترتيب الشرائح", "صور وملاحظات المتحدث وعرض بملء الشاشة", "تصدير ملف PowerPoint حقيقي ‎(.pptx)", "حفظ تلقائي ونسخة JSON للنقل والاحتفاظ"],
        en: ["Templates and deck types with starter slides", "7 layouts: cover, section, bullets, text, image, closing…", "Add, delete, duplicate and reorder slides", "Images, speaker notes and full-screen show", "Real PowerPoint (.pptx) export", "Autosave and JSON backup"],
      },
    },
    {
      id: "fleetpro",
      name: "FleetPro",
      status: "demo",
      demo: { type: "live", url: "fleetpro/index.html" },
      runtime: "browser",
      image: "assets/work/fleetpro.webp",
      tagline: { ar: "نظام إدارة الأسطول", en: "Fleet management system" },
      summary: {
        ar: "المركبات والسائقون والصيانة والوقود والتأمين والحوادث والمخالفات من لوحة واحدة.",
        en: "Vehicles, drivers, maintenance, fuel, insurance, accidents and violations from one dashboard.",
      },
      problem: {
        ar: "صيانات تفوت مواعيدها وتأمينات تنتهي دون تنبيه ومصاريف مركبات بلا متابعة.",
        en: "Missed maintenance, insurance expiring without warning and untracked vehicle costs.",
      },
      description: {
        ar: "FleetPro نظام ويب مبرمج لإدارة أساطيل المركبات: سجل المركبات والسائقين والإسناد، وجدولة الصيانة وتسجيل إنجازها، والوقود، والتأمين مع تنبيهات الانتهاء، والحوادث والمخالفات، ولوحة تحكم وتقارير مع تصدير CSV. نسخة الـ Demo تعمل في المتصفح ببيانات تجريبية، وتُخصَّص وتُربط بخادم عند التنفيذ.",
        en: "FleetPro is a programmed web system for vehicle fleets: vehicle and driver records and assignment, maintenance scheduling and completion, fuel, insurance with expiry alerts, accidents and violations, plus a dashboard and reports with CSV export. The demo runs in the browser with sample data and is customised and connected to a server on implementation.",
      },
      features: {
        ar: ["سجل المركبات والسائقين وإسناد المركبات", "جدولة الصيانة وتسجيل إنجازها", "التأمين مع تنبيهات الانتهاء", "الوقود والحوادث والمخالفات", "لوحة تحكم وتقارير وتصدير CSV"],
        en: ["Vehicle and driver records and assignment", "Maintenance scheduling and completion", "Insurance with expiry alerts", "Fuel, accidents and violations", "Dashboard, reports and CSV export"],
      },
    },
    {
      id: "clinicflow",
      name: "ClinicFlow",
      status: "demo",
      demo: { type: "live", url: "clinicflow/index.html" },
      runtime: "browser",
      image: "assets/work/clinicflow.webp",
      tagline: { ar: "نظام إدارة العيادات", en: "Clinic management system" },
      summary: {
        ar: "المرضى والمواعيد والأطباء والعيادات والفواتير والتقارير.",
        en: "Patients, appointments, doctors, clinics, invoices and reports.",
      },
      problem: {
        ar: "حجوزات متعارضة وملفات مرضى ورقية وفواتير يصعب متابعة تحصيلها.",
        en: "Conflicting bookings, paper patient files and invoices that are hard to follow up.",
      },
      description: {
        ar: "ClinicFlow نظام ويب مبرمج للعيادات والمجمعات الطبية: ملفات المرضى، وجدولة المواعيد ومنع التعارض، والأطباء والعيادات، والفواتير والتحصيل، والإشعارات والتقارير مع تصدير CSV. نسخة الـ Demo تعمل في المتصفح ببيانات تجريبية وليست للاستخدام الطبي الفعلي قبل التخصيص والربط بخادم آمن.",
        en: "ClinicFlow is a programmed web system for clinics and medical centres: patient records, conflict-free appointment scheduling, doctors and clinics, invoices and collection, notifications and reports with CSV export. The demo runs in the browser with sample data and is not for real medical use before customisation and a secure server setup.",
      },
      features: {
        ar: ["ملفات المرضى وسجل الزيارات", "جدولة المواعيد ومنع التعارض", "الأطباء والعيادات", "الفواتير والتحصيل", "الإشعارات والتقارير وتصدير CSV"],
        en: ["Patient records and visit history", "Conflict-free appointment scheduling", "Doctors and clinics", "Invoices and collection", "Notifications, reports and CSV export"],
      },
    },
  ],

  /* ---------------- Services (custom work, separate from systems) ---------------- */
  services: [
    {
      id: "software", icon: "code", related: ["azenk-hr", "azenk-callcenter"],
      title: { ar: "تطوير أنظمة مخصصة", en: "Custom Software" },
      desc: { ar: "أنظمة ويب ولوحات تحكم مبنية حول طريقة عملك، بصلاحيات وقاعدة بيانات.", en: "Web systems and dashboards built around how you work, with roles and a database." },
      points: { ar: ["تحليل المتطلبات وتصميم النظام", "واجهات عربية وإنجليزية", "أدوار وصلاحيات وسجل تدقيق", "تطوير أنظمة قائمة وتحسينها"], en: ["Requirements analysis and system design", "Arabic and English interfaces", "Roles, permissions and audit log", "Improving and extending existing systems"] },
    },
    {
      id: "web", icon: "web", related: [],
      title: { ar: "تطوير المواقع", en: "Websites" },
      desc: { ar: "مواقع تعريفية وصفحات هبوط سريعة وثنائية اللغة ومهيأة لمحركات البحث.", en: "Fast, bilingual company sites and landing pages, optimised for search engines." },
      points: { ar: ["مواقع الشركات والأفراد", "صفحات هبوط للحملات", "تصميم متجاوب لكل الشاشات", "تحسين السرعة والظهور في البحث"], en: ["Company and personal websites", "Campaign landing pages", "Responsive on every screen", "Speed and search optimisation"] },
    },
    {
      id: "ecommerce", icon: "cart", related: [],
      title: { ar: "المتاجر الإلكترونية", en: "E-commerce" },
      desc: { ar: "متاجر إلكترونية سهلة الإدارة، أو تجهيز متجرك على منصة قائمة.", en: "Easy-to-manage online stores, or setting up your store on an existing platform." },
      points: { ar: ["تصميم واجهة المتجر وصفحات المنتجات", "إعداد المنتجات والتصنيفات والشحن", "ربط بوابات الدفع المعتمدة لدى المنصة", "تقارير الطلبات والمبيعات"], en: ["Storefront and product page design", "Products, categories and shipping setup", "Connecting the platform's supported payment gateways", "Order and sales reports"] },
    },
    {
      id: "automation", icon: "flow", related: ["azenk-requests"],
      title: { ar: "الأتمتة", en: "Automation" },
      desc: { ar: "تحويل الإجراءات اليدوية والمتكررة إلى خطوات رقمية تلقائية.", en: "Turning manual, repetitive procedures into automatic digital steps." },
      points: { ar: ["أتمتة المهام المتكررة والتقارير", "نماذج رقمية بدل الورق", "تنبيهات ومسارات موافقة", "لوحات متابعة"], en: ["Automating repetitive tasks and reports", "Digital forms instead of paper", "Alerts and approval flows", "Monitoring dashboards"] },
    },
    {
      id: "business", icon: "building", related: ["azenk-hr", "azenk-requests", "azenk-callcenter", "fleetpro", "clinicflow"],
      title: { ar: "حلول الأعمال", en: "Business Solutions" },
      desc: { ar: "تطبيق أنظمة AZENK في منشأتك وتخصيصها لإجراءاتك وبياناتك.", en: "Implementing AZENK systems in your organisation and tailoring them to your processes and data." },
      points: { ar: ["تخصيص الأنظمة لإجراءات المنشأة", "نقل البيانات من الإكسل أو نظام قديم", "تدريب المستخدمين", "دعم ما بعد التشغيل"], en: ["Tailoring systems to your processes", "Migrating data from spreadsheets or a legacy system", "User training", "Post-launch support"] },
    },
    {
      id: "graduation", icon: "graduation", related: ["azenk-graduation", "azenk-presentations"],
      title: { ar: "مشاريع التخرج", en: "Graduation Projects" },
      desc: { ar: "مساعدة الطلاب في تطوير مشاريعهم التقنية وتوثيقها وفهمها للمناقشة.", en: "Helping students build, document and understand their technical projects for the defence." },
      points: { ar: ["أنظمة ومواقع وتطبيقات ويب", "التوثيق وشرح طريقة العمل", "تجهيز عرض المناقشة", "تعديلات حسب ملاحظات المشرف"], en: ["Systems, websites and web apps", "Documentation and walkthrough", "Defence presentation", "Revisions based on supervisor feedback"] },
    },
    {
      id: "presentations", icon: "slides", related: ["azenk-presentations"],
      title: { ar: "عروض PowerPoint", en: "PowerPoint Presentations" },
      desc: { ar: "تصميم عروض تقديمية احترافية للشركات والمشاريع والمناقشات.", en: "Professional presentations for companies, projects and defences." },
      points: { ar: ["ملفات تعريف الشركات", "عروض المشاريع والمبيعات", "تحويل المحتوى إلى شرائح واضحة", "تصميم بهوية علامتك"], en: ["Company profiles", "Project and sales decks", "Turning content into clear slides", "Designed in your brand identity"] },
    },
    {
      id: "callcenter", icon: "headset", related: ["azenk-callcenter"],
      title: { ar: "حلول الكول سنتر", en: "Call Center Solutions" },
      desc: { ar: "تنظيم خدمة العملاء: نظام، ومسارات عمل، ونصوص مكالمات، وتقارير أداء.", en: "Organising customer service: a system, workflows, call scripts and performance reports." },
      points: { ar: ["تطبيق AZENK Call Center وتخصيصه", "مسارات التذاكر والتصعيد", "نصوص ومسارات المكالمات", "مؤشرات وتقارير الأداء"], en: ["Implementing and tailoring AZENK Call Center", "Ticket and escalation workflows", "Call scripts and flows", "Performance indicators and reports"] },
    },
    {
      id: "integration", icon: "plug", related: [],
      title: { ar: "ربط الأنظمة", en: "System Integration" },
      desc: { ar: "ربط أنظمتك ببعضها أو بخدمات خارجية عبر واجهات برمجية (API) وتبادل البيانات.", en: "Connecting your systems to each other or to external services through APIs and data exchange." },
      points: { ar: ["ربط عبر واجهات API", "استيراد وتصدير البيانات", "مزامنة بين الأنظمة", "توثيق الربط واختباره"], en: ["API integrations", "Data import and export", "Synchronisation between systems", "Documented, tested integrations"] },
    },
    {
      id: "transformation", icon: "spark", related: ["azenk-requests"],
      title: { ar: "التحول الرقمي", en: "Digital Transformation" },
      desc: { ar: "دراسة إجراءاتك الحالية ووضع خطة عملية لتحويلها إلى حلول رقمية على مراحل.", en: "Reviewing your current procedures and drawing a practical, phased plan to digitise them." },
      points: { ar: ["تحليل الوضع الحالي", "تحديد الأولويات والمراحل", "اختيار الحل: جاهز أو مخصص", "متابعة التنفيذ والقياس"], en: ["Current-state analysis", "Priorities and phases", "Choosing ready or custom solutions", "Implementation follow-up and measurement"] },
    },
  ],

  /* ---------------- Solution finder (rule-based, not AI) ---------------- */
  finder: {
    questions: [
      { id: "activity", type: "single", label: { ar: "ما نشاطك؟", en: "What is your activity?" }, options: [
        ["company", { ar: "شركة أو منشأة", en: "Company or business" }],
        ["callcenter", { ar: "خدمة عملاء / مركز اتصال", en: "Customer service / call centre" }],
        ["education", { ar: "جامعة أو كلية أو جهة تدريب", en: "University, college or training body" }],
        ["clinic", { ar: "عيادة أو مركز طبي", en: "Clinic or medical centre" }],
        ["fleet", { ar: "نقل أو أسطول مركبات", en: "Transport or vehicle fleet" }],
        ["student", { ar: "طالب أو فرد", en: "Student or individual" }],
        ["other", { ar: "أخرى", en: "Other" }],
      ] },
      { id: "size", type: "single", label: { ar: "حجم المنشأة", en: "Organisation size" }, options: [
        ["solo", { ar: "فرد", en: "Individual" }], ["small", { ar: "صغيرة (حتى 10)", en: "Small (up to 10)" }],
        ["medium", { ar: "متوسطة (11 – 100)", en: "Medium (11–100)" }], ["large", { ar: "كبيرة (أكثر من 100)", en: "Large (100+)" }],
      ] },
      { id: "users", type: "single", label: { ar: "كم شخصًا سيستخدم النظام؟", en: "How many people will use the system?" }, options: [
        ["1-5", { ar: "1 – 5", en: "1–5" }], ["6-20", { ar: "6 – 20", en: "6–20" }], ["21-100", { ar: "21 – 100", en: "21–100" }], ["100+", { ar: "أكثر من 100", en: "100+" }],
      ] },
      { id: "problems", type: "multi", label: { ar: "ما المشكلة التي تريد حلها؟ (اختر كل ما ينطبق)", en: "What do you want to solve? (choose all that apply)" }, options: [
        ["hr", { ar: "شؤون الموظفين والحضور والإجازات", en: "Employee affairs, attendance and leave" }],
        ["customers", { ar: "متابعة العملاء والمكالمات والشكاوى", en: "Customers, calls and complaints" }],
        ["projects", { ar: "متابعة مشاريع التخرج أو الفرق", en: "Following graduation projects or teams" }],
        ["vehicles", { ar: "المركبات والصيانة والتأمين", en: "Vehicles, maintenance and insurance" }],
        ["appointments", { ar: "المواعيد والمرضى والفواتير", en: "Appointments, patients and invoices" }],
        ["slides", { ar: "إعداد عروض تقديمية", en: "Preparing presentations" }],
        ["website", { ar: "موقع أو متجر إلكتروني", en: "A website or online store" }],
        ["requests", { ar: "طلبات داخلية وموافقات (إجازات، مشتريات، دعم تقني)", en: "Internal requests and approvals (leave, purchases, IT)" }],
        ["manual", { ar: "إجراءات ورقية أو يدوية متكررة", en: "Paper or repetitive manual procedures" }],
        ["integration", { ar: "أنظمة غير مترابطة", en: "Disconnected systems" }],
      ] },
      { id: "current", type: "single", label: { ar: "ما الذي تستخدمه حاليًا؟", en: "What do you use today?" }, options: [
        ["none", { ar: "ورق أو إكسل", en: "Paper or spreadsheets" }], ["unfit", { ar: "نظام جاهز لا يناسبنا", en: "A ready system that doesn't fit" }],
        ["legacy", { ar: "نظام قديم نريد تطويره", en: "A legacy system to improve" }], ["many", { ar: "عدة أنظمة غير مترابطة", en: "Several disconnected systems" }],
      ] },
      { id: "need", type: "single", label: { ar: "ما الأنسب لك؟", en: "What suits you best?" }, options: [
        ["ready", { ar: "نظام جاهز أبدأ به بسرعة", en: "A ready system to start quickly" }], ["custom", { ar: "نظام مخصص بالكامل", en: "A fully custom system" }],
        ["improve", { ar: "تطوير أو ربط ما لدي", en: "Improve or connect what I have" }], ["advice", { ar: "استشارة أولًا", en: "Advice first" }],
      ] },
    ],
    // problem → systems that address it
    problemSystems: { hr: ["azenk-hr"], requests: ["azenk-requests"], manual: ["azenk-requests"], customers: ["azenk-callcenter"], projects: ["azenk-graduation"], vehicles: ["fleetpro"], appointments: ["clinicflow"], slides: ["azenk-presentations"] },
    // activity → systems that usually fit
    activitySystems: { company: ["azenk-hr", "azenk-requests"], callcenter: ["azenk-callcenter"], education: ["azenk-graduation"], clinic: ["clinicflow"], fleet: ["fleetpro"], student: ["azenk-presentations"] },
    // problem → services
    problemServices: { website: ["web", "ecommerce"], manual: ["automation", "transformation"], integration: ["integration"], slides: ["presentations"], projects: ["graduation"], customers: ["callcenter"] },
  },

  /* ---------------- Work (only real AZENK-built items) ---------------- */
  categories: [
    { id: "software", label: { ar: "الأنظمة", en: "Systems" } },
    { id: "websites", label: { ar: "المواقع والمتاجر", en: "Websites & Stores" } },
    { id: "automation", label: { ar: "الأتمتة والحلول الرقمية", en: "Automation & Digital" } },
    { id: "graduation", label: { ar: "مشاريع التخرج", en: "Graduation Projects" } },
    { id: "presentations", label: { ar: "العروض التقديمية", en: "Presentations" } },
  ],
  work: [
    {
      id: "azenk-site",
      title: "AZENK Website",
      category: "websites",
      status: "live",
      image: "assets/work/azenk-site.webp",
      url: "",
      desc: {
        ar: "الموقع الرسمي لـ AZENK: ثنائي اللغة، يعرض الأنظمة والخدمات مع طلب الحلول عبر واتساب.",
        en: "AZENK's official bilingual website presenting the systems and services, with requests over WhatsApp.",
      },
    },
  ],
};
