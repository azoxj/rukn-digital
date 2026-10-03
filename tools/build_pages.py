#!/usr/bin/env python3
"""Generate the AZENK subpages (products, solutions, build, services, work,
about, contact). Run:  python3 tools/build_pages.py
The home page (index.html) is edited by hand."""
import json, os
import pathlib
ROOT = str(pathlib.Path(__file__).resolve().parent.parent)
DOMAIN = "https://azenk.sa"

HEAD = """<!DOCTYPE html>
<html lang="ar" dir="rtl" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{url}">
  <meta name="theme-color" content="#06070a">
  <meta name="author" content="AZENK">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AZENK">
  <meta property="og:locale" content="ar_SA">
  <meta property="og:locale:alternate" content="en_US">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="https://azenk.sa/assets/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="AZENK — Digital · Technology · Creative">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="https://azenk.sa/assets/og-image.jpg">

  <script type="application/ld+json">
{ld}
  </script>

  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../style.css?v=20261003.3">
  <script src="../config.js?v=20261003.3" defer></script>
  <script src="../data.js?v=20261003.3" defer></script>
  <script src="../i18n.js?v=20261003.3" defer></script>
  <script src="../script.js?v=20261003.3" defer></script>
</head>
<body data-page="{page}" data-root="../">
  <a class="skip-link" href="#main" data-i18n="skip">تخطَّ إلى المحتوى</a>
  <header class="site-header" id="siteHeader"></header>

  <main id="main">
    <section class="page-hero">
      <div class="page-hero__bg" aria-hidden="true"></div>
      <div class="container">
        <nav class="crumbs" aria-label="مسار التنقل" data-i18n-aria="crumbs"><a href="../" data-i18n="nav.home">الرئيسية</a><span aria-hidden="true">/</span><span aria-current="page" data-i18n="nav.{page}">{crumb}</span></nav>
        <span class="eyebrow" data-i18n="{page}.eyebrow">{eyebrow}</span>
        <h1 data-i18n="{page}.h1">{h1}</h1>
        <p data-i18n="{page}.lead">{lead}</p>
      </div>
    </section>
{body}
  </main>

  <footer class="site-footer" id="siteFooter"></footer>
  <div id="waFloat"></div>
  <noscript>
    <nav class="noscript-nav" aria-label="روابط الموقع"><a href="../">الرئيسية</a> · <a href="../products/">الأنظمة</a> · <a href="../solutions/">الحلول</a> · <a href="../build/">ابنِ نظامك</a> · <a href="../services/">الخدمات</a> · <a href="../about/">من نحن</a> · <a href="../contact/">تواصل معنا</a></nav>
  </noscript>
</body>
</html>
"""

CTA = """
    <section class="cta">
      <div class="container">
        <div class="cta__box reveal">
          <div>
            <h2 data-i18n="cta.title">جاهز نبدأ؟</h2>
            <p data-i18n="cta.desc">اطلب حلًا عبر واتساب برسالة جاهزة، أو صف نظامك المطلوب في صفحة «ابنِ نظامك».</p>
          </div>
          <div class="cta__actions">
            <a class="btn btn--gold btn--lg" data-wa="start" href="#"><i data-icon="whatsapp"></i><span data-i18n="cta.start">اطلب حلًا</span></a>
            <a class="btn btn--ghost btn--lg" href="../build/"><span data-i18n="cta.build">ابنِ نظامك</span></a>
          </div>
        </div>
      </div>
    </section>"""

STEPS = [
  ("الفكرة", "نستمع لفكرتك ونحدد الهدف والمستخدمين والنتيجة المطلوبة."),
  ("التحليل", "نحوّل الفكرة إلى متطلبات واضحة ونطاق عمل ومراحل متفق عليها."),
  ("تجربة المستخدم والواجهات", "نصمم رحلة الاستخدام والشاشات قبل كتابة الكود."),
  ("هندسة النظام", "نحدد البنية وقاعدة البيانات والصلاحيات وطريقة الربط."),
  ("التطوير", "نبرمج على مراحل قصيرة ونعرض لك التقدم أولًا بأول."),
  ("الاختبار", "نختبر الوظائف والصلاحيات والأخطاء والأداء والعرض على الجوال."),
  ("الإطلاق", "نجهّز التشغيل ونقل البيانات والحسابات ونطلق النظام."),
  ("الدعم", "نتابع بعد الإطلاق ونصلح ونطوّر حسب الاحتياج."),
]
steps_html = "\n".join(f'          <li class="reveal"><span class="process__n">{i+1:02d}</span><h3 data-i18n="step.{i+1}.t">{t}</h3><p data-i18n="step.{i+1}.d">{d}</p></li>' for i, (t, d) in enumerate(STEPS))

PAGES = [
  dict(page="products", crumb="الأنظمة", title="أنظمة AZENK | AZENK HR وCall Center وGraduation وPresentations",
       desc="أنظمة AZENK المبرمجة والمختبرة: AZENK HR للموارد البشرية، AZENK Call Center لخدمة العملاء، AZENK Graduation لمشاريع التخرج، AZENK Presentations لعروض PowerPoint، وFleetPro وClinicFlow. السعر عند الطلب.",
       eyebrow="أنظمة مبرمجة ومختبرة", h1="أنظمة AZENK", lead="كل نظام هنا مبرمج فعليًا ومختبر. لكل نظام حالة واضحة، ونوضح أين يعمل: في المتصفح أو على خادم بقاعدة بيانات.",
       body="""
    <section class="section">
      <div class="container">
        <div class="products-grid products-grid--page" data-render="products" data-variant="full"></div>
        <p class="section-note reveal" data-i18n="products.legend"><b>جاهز</b>: يمكن استخدامه الآن. <b>Demo متاح</b>: نسخة تعمل يمكن تجربتها أو عرضها لك مباشرة. الأنظمة التي تعمل على خادم يُعرض الـ Demo الخاص بها في جلسة مباشرة عند الطلب.</p>
      </div>
    </section>

    <section class="section section--navy">
      <div class="container">
        <header class="section-head reveal">
          <span class="eyebrow" data-i18n="order.eyebrow">طريقة الطلب</span>
          <h2 data-i18n="order.title">من التجربة إلى التشغيل</h2>
          <p data-i18n="order.desc">لا توجد سلة مشتريات أو دفع إلكتروني في الموقع؛ نتواصل معك عبر واتساب ونحدد السعر حسب عدد المستخدمين والتخصيص.</p>
        </header>
        <ol class="process process--3">
          <li class="reveal"><span class="process__n">01</span><h3 data-i18n="order.1.t">جرّب أو اطلب Demo</h3><p data-i18n="order.1.d">جرّب النسخة المتاحة مباشرة، أو اطلب جلسة Demo للأنظمة التي تعمل على خادم.</p></li>
          <li class="reveal"><span class="process__n">02</span><h3 data-i18n="order.2.t">اطلب عرض السعر</h3><p data-i18n="order.2.d">تُفتح محادثة واتساب برسالة منظمة باسم النظام لتكمل بياناتك.</p></li>
          <li class="reveal"><span class="process__n">03</span><h3 data-i18n="order.3.t">نخصص ونشغّل</h3><p data-i18n="order.3.d">نتفق على التخصيص ونهيئ الحسابات والبيانات وندرّب فريقك.</p></li>
        </ol>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="custom-box reveal">
          <div>
            <h2 data-i18n="custom.title">لا تجد النظام الذي تحتاجه؟</h2>
            <p data-i18n="custom.desc">صف فكرتك ونبني لك نظامًا مخصصًا، أو دع أداة الحلول تقترح عليك الأنسب.</p>
          </div>
          <div class="cta__actions">
            <a class="btn btn--gold" href="../build/"><span data-i18n="cta.build">ابنِ نظامك</span></a>
            <a class="btn btn--ghost" href="../solutions/"><span data-i18n="custom.finder">اقترح لي حلًا</span></a>
          </div>
        </div>
      </div>
    </section>"""),

  dict(page="solutions", crumb="الحلول", title="دع AZENK تحدد الحل المناسب لك | AZENK",
       desc="أجب عن 6 أسئلة عن نشاطك وحجم منشأتك ومشكلتك وأنظمتك الحالية، واحصل على حل مقترح والأنظمة والمزايا المناسبة وخطوات التنفيذ، ثم اطلب عرض السعر عبر واتساب.",
       eyebrow="الحلول", h1="دع AZENK تحدد الحل المناسب لك", lead="أسئلة قصيرة عن نشاطك واحتياجك، ونقترح لك الحل والأنظمة والمزايا وخطوات التنفيذ. لا تُرسل إجاباتك إلى أي جهة إلا إذا اخترت طلب عرض السعر عبر واتساب.",
       body="""
    <section class="section">
      <div class="container container--narrow">
        <div data-render="finder"></div>
      </div>
    </section>
""" + CTA),

  dict(page="build", crumb="ابنِ نظامك", title="ابنِ نظامك مع AZENK | من الفكرة إلى نظام يعمل",
       desc="اطلب نظامًا مخصصًا من AZENK: فكرة، تحليل، تجربة مستخدم، هندسة النظام، تطوير، اختبار، إطلاق ودعم. أرسل وصف مشروعك عبر واتساب أو البريد.",
       eyebrow="ابنِ نظامك", h1="ابنِ نظامك", lead="نحوّل فكرتك إلى نظام يعمل عبر ثماني مراحل واضحة، وتبقى على اطلاع في كل مرحلة.",
       body="""
    <section class="section">
      <div class="container">
        <ol class="process process--8">
""" + steps_html + """
        </ol>
      </div>
    </section>

    <section class="section section--navy" id="request">
      <div class="container contact">
        <div class="contact__cards">
          <h2 class="contact__title" data-i18n="build.side.title">قبل أن ترسل</h2>
          <ul class="ticks">
            <li><i data-icon="check"></i><span data-i18n="build.side.1">اكتب المشكلة التي تريد حلها ومن سيستخدم النظام.</span></li>
            <li><i data-icon="check"></i><span data-i18n="build.side.2">اذكر الأنظمة أو الملفات التي تستخدمها حاليًا.</span></li>
            <li><i data-icon="check"></i><span data-i18n="build.side.3">الميزانية اختيارية وتساعدنا على اقتراح نطاق مناسب.</span></li>
            <li><i data-icon="check"></i><span data-i18n="build.side.4">المرفقات (ملفات، صور، أمثلة) أرسلها في محادثة واتساب بعد فتحها، أو أرفقها في البريد.</span></li>
          </ul>
          <p class="contact__hint" data-i18n="build.side.note">لا يُحفظ طلبك في الموقع: يُجهَّز كرسالة منظمة في واتساب أو البريد لتُرسلها بنفسك.</p>
        </div>

        <form class="form reveal" data-form="build" novalidate>
          <h2 data-i18n="build.form.title">صف النظام الذي تحتاجه</h2>
          <div class="form__row">
            <div class="field">
              <label for="b-name" data-i18n="form.name">الاسم</label>
              <input id="b-name" name="name" type="text" autocomplete="name" required data-i18n-ph="form.name.ph" placeholder="اسمك الكامل">
              <small class="field__error" aria-live="polite"></small>
            </div>
            <div class="field">
              <label for="b-business" data-i18n="form.business">النشاط / الجهة</label>
              <input id="b-business" name="business" type="text" autocomplete="organization" required data-i18n-ph="form.business.ph" placeholder="مثال: شركة نقل، عيادة، جامعة…">
              <small class="field__error" aria-live="polite"></small>
            </div>
          </div>
          <div class="form__row">
            <div class="field">
              <label for="b-phone" data-i18n="form.phone">رقم الجوال</label>
              <input id="b-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required placeholder="05XXXXXXXX">
              <small class="field__error" aria-live="polite"></small>
            </div>
            <div class="field">
              <label for="b-email"><span data-i18n="form.email">البريد الإلكتروني</span> <small class="opt" data-i18n="form.optional">(اختياري)</small></label>
              <input id="b-email" name="email" type="email" autocomplete="email" dir="ltr" placeholder="name@example.com">
              <small class="field__error" aria-live="polite"></small>
            </div>
          </div>
          <div class="form__row">
            <div class="field">
              <label for="b-type" data-i18n="form.type">نوع المشروع</label>
              <select id="b-type" name="service" required></select>
              <small class="field__error" aria-live="polite"></small>
            </div>
            <div class="field">
              <label for="b-budget"><span data-i18n="form.budget">الميزانية التقريبية</span> <small class="opt" data-i18n="form.optional">(اختياري)</small></label>
              <select id="b-budget" name="budget">
                <option value="" data-i18n="budget.none">أفضّل عدم التحديد</option>
                <option value="lt10" data-i18n="budget.1">أقل من 10,000 ريال</option>
                <option value="10-30" data-i18n="budget.2">10,000 – 30,000 ريال</option>
                <option value="30-80" data-i18n="budget.3">30,000 – 80,000 ريال</option>
                <option value="gt80" data-i18n="budget.4">أكثر من 80,000 ريال</option>
              </select>
              <small class="field__error" aria-live="polite"></small>
            </div>
          </div>
          <div class="field">
            <label for="b-details" data-i18n="form.desc">وصف المشروع</label>
            <textarea id="b-details" name="details" rows="6" required data-i18n-ph="form.desc.ph" placeholder="ما المشكلة؟ من سيستخدم النظام؟ ما أهم الشاشات أو الوظائف؟"></textarea>
            <small class="field__error" aria-live="polite"></small>
          </div>
          <button type="submit" class="btn btn--gold btn--block btn--lg"><i data-icon="whatsapp"></i><span data-i18n="build.form.wa">إرسال الطلب عبر واتساب</span></button>
          <button type="button" class="btn btn--ghost btn--block" data-mailto><i data-icon="mail"></i><span data-i18n="build.form.mail">أو أرسله بالبريد الإلكتروني</span></button>
          <p class="form__note" data-form-note role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>"""),

  dict(page="services", crumb="الخدمات", title="خدمات AZENK | أنظمة مخصصة، مواقع، متاجر، أتمتة وربط أنظمة",
       desc="خدمات AZENK: تطوير أنظمة مخصصة، المواقع، المتاجر الإلكترونية، الأتمتة، حلول الأعمال، مشاريع التخرج، عروض PowerPoint، حلول الكول سنتر، ربط الأنظمة والتحول الرقمي.",
       eyebrow="خدماتنا", h1="الخدمات", lead="عندما لا يكفي نظام جاهز: نطوّر ونربط ونؤتمت ما تحتاجه، ونطبّق أنظمة AZENK في منشأتك.",
       body="""
    <section class="section">
      <div class="container">
        <div class="services-grid services-grid--full" data-render="services" data-variant="full"></div>
      </div>
    </section>
""" + CTA),

  dict(page="work", crumb="أعمالنا", title="أعمال AZENK | مواقع وحلول منشورة",
       desc="أعمال AZENK المنشورة. الأنظمة المبرمجة القابلة للتجربة موجودة في صفحة الأنظمة.",
       eyebrow="أعمالنا", h1="أعمالنا", lead="أعمال منشورة نفّذتها AZENK. الأنظمة المبرمجة القابلة للتجربة تجدها في صفحة الأنظمة.",
       body="""
    <section class="section">
      <div class="container">
        <div data-render="work"></div>
        <p class="section-note reveal" data-i18n="work.note">أنظمة AZENK مثل AZENK HR وAZENK Call Center وAZENK Graduation وAZENK Presentations تجدها في <a class="link-more" href="../products/">صفحة الأنظمة</a>. تُضاف أعمال العملاء بعد اكتمالها وبموافقة أصحابها.</p>
      </div>
    </section>
""" + CTA),

  dict(page="about", crumb="من نحن", title="من نحن | AZENK — Digital · Technology · Creative",
       desc="AZENK منصة تقنية تبني أنظمة رقمية مبرمجة ومختبرة وتطوّر حلولًا تقنية مخصصة للأعمال والجهات التعليمية والأفراد. أسسها عبدالعزيز الخالدي.",
       eyebrow="من نحن", h1="عن AZENK", lead="منصة تقنية تبني أنظمة حقيقية وتطوّر حلولًا مخصصة.",
       body="""
    <section class="section">
      <div class="container about">
        <div class="about__text reveal">
          <h2 data-i18n="aboutp.who.title">من نحن</h2>
          <p data-i18n="aboutp.who.1">AZENK منصة تقنية تبني أنظمة رقمية جاهزة وتطوّر حلولًا تقنية مخصصة للشركات والمنشآت والجهات التعليمية والأفراد.</p>
          <p data-i18n="aboutp.who.2">قاعدتنا بسيطة: لا نعرض نظامًا قبل أن يكون مبرمجًا ومختبرًا، ونوضح بصراحة أين يعمل وما الذي يتضمنه وما لا يتضمنه. إلى جانب الأنظمة نقدّم خدمات التطوير المخصص والمواقع والمتاجر والأتمتة وربط الأنظمة ومشاريع التخرج والعروض التقديمية وحلول الكول سنتر.</p>
          <p class="founder" data-i18n="about.founder">أسسها <b>عبدالعزيز الخالدي</b> — Abdulaziz AlKhaldi.</p>
        </div>
        <div class="about__panel reveal">
          <span class="eyebrow" dir="ltr">Digital · Technology · Creative</span>
          <dl class="about__def">
            <div><dt dir="ltr">Digital</dt><dd data-i18n="aboutp.def.d">أنظمة رقمية تنظّم العمل اليومي.</dd></div>
            <div><dt dir="ltr">Technology</dt><dd data-i18n="aboutp.def.t">خوادم وقواعد بيانات وصلاحيات واختبارات.</dd></div>
            <div><dt dir="ltr">Creative</dt><dd data-i18n="aboutp.def.c">واجهات واضحة وعروض تقديمية بلمسة راقية.</dd></div>
          </dl>
        </div>
      </div>
    </section>

    <section class="section section--navy">
      <div class="container">
        <header class="section-head reveal">
          <span class="eyebrow" data-i18n="values.eyebrow">ما نلتزم به</span>
          <h2 data-i18n="values.title">طريقتنا في العمل</h2>
        </header>
        <div class="values">
          <article class="value reveal"><h3 data-i18n="values.1.t">الصدق</h3><p data-i18n="values.1.d">لا أنظمة وهمية ولا وعود بتكاملات غير موجودة.</p></article>
          <article class="value reveal"><h3 data-i18n="values.2.t">الجودة</h3><p data-i18n="values.2.d">اختبارات للوظائف والصلاحيات والأمان قبل أي إطلاق.</p></article>
          <article class="value reveal"><h3 data-i18n="values.3.t">الوضوح</h3><p data-i18n="values.3.d">نطاق ومراحل ومخرجات متفق عليها قبل البدء.</p></article>
          <article class="value reveal"><h3 data-i18n="values.4.t">الاستمرارية</h3><p data-i18n="values.4.d">أنظمة قابلة للتطوير والتوسع مع نمو أعمالك.</p></article>
        </div>
      </div>
    </section>
""" + CTA),
  dict(page="contact", crumb="تواصل معنا", title="تواصل مع AZENK | اطلب مشروعك عبر واتساب",
       desc="تواصل مع AZENK عبر واتساب أو البريد الإلكتروني، أو أرسل طلبًا منظّمًا من النموذج ليصلنا مباشرة على واتساب.",
       eyebrow="تواصل معنا", h1="تواصل معنا", lead="اختر الطريقة الأنسب لك: محادثة مباشرة عبر واتساب، أو البريد الإلكتروني، أو نموذج طلب المشروع.",
       body="""
    <section class="section">
      <div class="container contact">
        <div class="contact__cards">
          <a class="contact-card contact-card--wa reveal" data-wa="general" href="#">
            <span class="contact-card__icon"><i data-icon="whatsapp"></i></span>
            <span><b data-i18n="contact.wa">واتساب</b><small dir="ltr" data-wa-display></small></span>
          </a>
          <a class="contact-card reveal" data-email href="#">
            <span class="contact-card__icon"><i data-icon="mail"></i></span>
            <span><b data-i18n="contact.email">البريد الإلكتروني</b><small dir="ltr" data-email-text></small></span>
          </a>
          <div class="contact-card contact-card--static reveal">
            <span class="contact-card__icon"><i data-icon="globe"></i></span>
            <span><b data-i18n="contact.loc">المملكة العربية السعودية</b><small dir="ltr">azenk.sa</small></span>
          </div>
          <p class="contact__hint reveal" data-i18n="contact.hint">نرد على الرسائل في أوقات العمل، وكلما كانت التفاصيل أوضح كان ردّنا أدق.</p>
        </div>

        <form class="form reveal" data-form="project" novalidate>
          <h2 data-i18n="form.title">نموذج طلب مشروع</h2>
          <p class="form__lead" data-i18n="form.lead">عند الإرسال تُجهَّز رسالة منظّمة في واتساب لتُرسلها إلينا مباشرة.</p>
          <div class="form__row">
            <div class="field">
              <label for="f-name" data-i18n="form.name">الاسم</label>
              <input id="f-name" name="name" type="text" autocomplete="name" required data-i18n-ph="form.name.ph" placeholder="اسمك الكامل">
              <small class="field__error" aria-live="polite"></small>
            </div>
            <div class="field">
              <label for="f-phone" data-i18n="form.phone">رقم الجوال</label>
              <input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required placeholder="05XXXXXXXX">
              <small class="field__error" aria-live="polite"></small>
            </div>
          </div>
          <div class="form__row">
            <div class="field">
              <label for="f-email"><span data-i18n="form.email">البريد الإلكتروني</span> <small class="opt" data-i18n="form.optional">(اختياري)</small></label>
              <input id="f-email" name="email" type="email" autocomplete="email" dir="ltr" placeholder="name@example.com">
              <small class="field__error" aria-live="polite"></small>
            </div>
            <div class="field">
              <label for="f-service" data-i18n="form.service">نوع الخدمة</label>
              <select id="f-service" name="service" required></select>
              <small class="field__error" aria-live="polite"></small>
            </div>
          </div>
          <div class="field">
            <label for="f-details" data-i18n="form.details">تفاصيل المشروع</label>
            <textarea id="f-details" name="details" rows="5" required data-i18n-ph="form.details.ph" placeholder="اكتب فكرتك وما تحتاجه بالتفصيل..."></textarea>
            <small class="field__error" aria-live="polite"></small>
          </div>
          <button type="submit" class="btn btn--gold btn--block btn--lg"><i data-icon="whatsapp"></i><span data-i18n="form.submit">إرسال الطلب عبر واتساب</span></button>
          <p class="form__note" data-form-note role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>"""),
]

for p in PAGES:
    url = f"{DOMAIN}/{p['page']}/"
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": p["title"], "description": p["desc"], "inLanguage": "ar",
             "isPartOf": {"@id": f"{DOMAIN}/#website"}, "about": {"@id": f"{DOMAIN}/#organization"}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "AZENK", "item": f"{DOMAIN}/"},
                {"@type": "ListItem", "position": 2, "name": p["crumb"], "item": url}]},
        ],
    }
    if p["page"] == "about":
        ld["@graph"][0]["@type"] = "AboutPage"
    if p["page"] == "contact":
        ld["@graph"][0]["@type"] = "ContactPage"
    ldtxt = "\n".join("  " + l for l in json.dumps(ld, ensure_ascii=False, indent=2).splitlines())
    html = HEAD.format(title=p["title"], desc=p["desc"], url=url, ld=ldtxt, page=p["page"], crumb=p["crumb"],
                       eyebrow=p["eyebrow"], h1=p["h1"], lead=p["lead"], body=p["body"])
    with open(os.path.join(ROOT, p["page"], "index.html"), "w") as f:
        f.write(html)
    print("wrote", p["page"])
