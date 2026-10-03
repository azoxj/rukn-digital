// End-to-end checks for the static AZENK site + browser products.
// Usage: serve the repo root (python3 -m http.server 8080) then
//   NODE_PATH_PW=$(npm root -g)/playwright node tests/site.e2e.js [baseUrl]
const { chromium } = require(process.env.NODE_PATH_PW || "playwright");
const BASE = process.argv[2] || "http://localhost:8080/";
const WA = "966507192393";
const PAGES = ["", "products/", "solutions/", "build/", "services/", "about/", "contact/", "work/"];
const WIDTHS = [320, 375, 390, 768, 1024, 1440];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, body: "wa" }));
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/net::ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  const waTexts = async () => p.$$eval("a[href^='https://wa.me/']", (as) => as.map((a) => decodeURIComponent(a.href.split("text=")[1] || "")));

  /* ---------- every page ---------- */
  for (const pg of PAGES) {
    const res = await p.goto(BASE + pg);
    ok(res.status() === 200, `${pg} status`);
    await p.waitForSelector(".site-header .nav");
    ok((await p.$$(".site-header .nav a")).length === 7, `${pg} 7 nav links`);
    ok((await p.textContent(".header__cta")).includes("اطلب حلًا"), `${pg} CTA label`);
    ok(await p.$("h1"), `${pg} h1`);
    const canon = await p.getAttribute('link[rel="canonical"]', "href");
    ok(canon === `https://azenk.sa/${pg}`, `${pg} canonical ${canon}`);
    const text = await p.evaluate(() => document.body.innerText + document.title + document.head.innerHTML);
    for (const bad of ["Easy Fleet", "Easy HR", "Rukn", "رُكن", "ركن ديجيتال", "قريبًا سيتم", "عملاؤنا", "+100"]) ok(!text.includes(bad), `${pg} must not contain "${bad}"`);
    for (const s of await p.$$eval('script[type="application/ld+json"]', (x) => x.map((e) => e.textContent))) { try { JSON.parse(s); ok(true); } catch { ok(false, `${pg} JSON-LD`); } }
    const hrefs = await p.$$eval("a[href^='https://wa.me/']", (as) => as.map((a) => a.href));
    ok(hrefs.length > 0 && hrefs.every((h) => h.startsWith(`https://wa.me/${WA}`)), `${pg} wa number`);
    ok(!(await p.$("a[href*='tiktok.com']")), `${pg} no tiktok link while URL empty`);
  }

  /* ---------- systems ---------- */
  await p.goto(BASE + "products/");
  const cards = await p.$$("#main .product");
  ok(cards.length === 7, "7 systems");
  const names = await p.$$eval("#main .product h3", (x) => x.map((e) => e.textContent.trim()));
  ok(JSON.stringify(names) === JSON.stringify(["AZENK HR", "AZENK Call Center", "AZENK Requests", "AZENK Graduation", "AZENK Presentations", "FleetPro", "ClinicFlow"]), "system names/order " + names);
  ok((await p.$$("#main .product__problem")).length === 7, "problem statement on every card");
  await p.evaluate(() => document.querySelectorAll("img").forEach((i) => (i.loading = "eager")));
  await p.waitForTimeout(800);
  const imgs = await p.$$eval("#main .product img", (x) => x.map((i) => i.complete && i.naturalWidth > 0));
  ok(imgs.length === 7 && imgs.every(Boolean), "real screenshots load");
  const statuses = await p.$$eval("#main .pstatus", (x) => x.map((e) => e.textContent.trim()));
  ok(statuses.every((s) => ["جاهز", "Demo متاح", "قيد التطوير"].includes(s)), "allowed statuses " + statuses);
  ok(!(await p.textContent("#main")).match(/\d[\d,]*\s*(ريال|SAR|ر\.س)/), "no numeric prices on systems page");
  const live = await p.$$eval("#main .product a.btn[href]:not([data-wa])", (x) => x.map((a) => a.getAttribute("href")));
  ok(live.length === 7, "7 live demos " + live);
  for (const h of live) { const r = await p.request.get(new URL(h, BASE + "products/").href); ok(r.status() === 200, `demo ${h} reachable`); }
  const w = await waTexts();
  ok(w.some((t) => t === "السلام عليكم، أرغب في عرض سعر لنظام AZENK HR.\n\nالاسم:\nالنشاط:\nعدد المستخدمين:\nملاحظات:"), "structured quote message");
  await p.goto(BASE + "products/#azenk-hr");
  await p.waitForSelector(".pmodal.is-open");
  ok((await p.textContent(".pmodal")).includes("يعمل في المتصفح"), "modal deep link + runtime note");
  ok((await waTexts()).includes("السلام عليكم، أرغب في معرفة تفاصيل نظام AZENK HR.\n\nالاسم:\nالنشاط:\nعدد المستخدمين:\nملاحظات:"), "structured details message (spec text)");
  await p.keyboard.press("Escape");
  ok(!(await p.$(".pmodal.is-open")), "modal closes with Escape");

  /* ---------- home paths ---------- */
  await p.goto(BASE);
  const paths = await p.$$eval(".path", (x) => x.map((a) => a.getAttribute("href")));
  ok(paths.length === 4, "4 paths");
  for (const h of paths) { const r = await p.request.get(new URL(h.split("#")[0], BASE).href); ok(r.status() === 200, `path ${h}`); }
  ok((await p.textContent(".hero__title")).includes("نبني التقنية") && (await p.textContent(".hero__title")).includes("التي تشغّل أعمالك."), "hero title");
  const heroLinks = await p.$$eval(".hero__actions a", (x) => x.map((a) => a.getAttribute("href")));
  ok(heroLinks[0] === "products/" && heroLinks[1] === "build/", "hero CTAs");

  /* ---------- services ---------- */
  await p.goto(BASE + "services/");
  ok((await p.$$("#main .service")).length === 10, "10 services");
  ok((await waTexts()).some((t) => t.startsWith("السلام عليكم، أرغب في خدمة «ربط الأنظمة» من AZENK.")), "service message");

  /* ---------- solution finder ---------- */
  await p.goto(BASE + "solutions/");
  await p.click("[data-finder] button[type=submit]");
  ok((await p.$$(".finder__q.is-invalid")).length === 6, "finder requires answers");
  const pick = async (n, v) => p.click(`label:has(input[name=${n}][value="${v}"])`);
  await pick("activity", "education"); await pick("size", "medium"); await pick("users", "100+"); await pick("problems", "projects"); await pick("current", "none"); await pick("need", "ready");
  await p.click("[data-finder] button[type=submit]");
  await p.waitForSelector(".result");
  ok((await p.textContent(".result__systems")).includes("AZENK Graduation"), "finder suggests Graduation");
  ok((await p.textContent(".result")).includes("ليست ذكاءً اصطناعيًا"), "finder discloses rule-based");
  ok(await p.isVisible(".result__note"), "scale note for 100+ users");
  const fw = await p.getAttribute(".result__actions a", "href");
  ok(decodeURIComponent(fw).includes("• العدد") || decodeURIComponent(fw).includes("• كم شخصًا سيستخدم النظام: أكثر من 100"), "finder quote has answers");
  await p.click("[data-finder] button[type=reset]");
  ok(await p.isHidden("[data-finder-result]"), "finder reset");
  await pick("activity", "company"); await pick("size", "small"); await pick("users", "6-20"); await pick("problems", "integration"); await pick("current", "many"); await pick("need", "improve");
  await p.click("[data-finder] button[type=submit]");
  await p.waitForSelector(".result");
  ok((await p.textContent(".result h2")).includes("تطوير أنظمتك الحالية"), "finder improve path");
  await p.click("[data-finder] button[type=reset]");
  await pick("activity", "company"); await pick("size", "medium"); await pick("users", "21-100"); await pick("problems", "requests"); await pick("current", "none"); await pick("need", "ready");
  await p.click("[data-finder] button[type=submit]");
  await p.waitForSelector(".result");
  ok((await p.textContent(".result__systems")).includes("AZENK Requests"), "finder suggests Requests for approvals");

  /* ---------- build form ---------- */
  await p.goto(BASE + "build/?type=graduation");
  ok((await p.$$("#main .process--8 li")).length === 8, "8 build steps");
  ok((await p.inputValue("#b-type")) === "graduation", "type preselected from URL");
  await p.click("[data-form=build] button[type=submit]");
  ok((await p.$$("[data-form=build] .field.is-invalid")).length === 4, "build validation (name, business, phone, details)");
  await p.fill("#b-name", "عميل اختبار"); await p.fill("#b-business", "جامعة تجريبية"); await p.fill("#b-phone", "0551234567");
  await p.fill("#b-email", "bad"); await p.fill("#b-details", "نظام لمتابعة مشاريع الطلاب");
  await p.click("[data-form=build] button[type=submit]");
  ok(await p.$("#b-email[aria-invalid=true]"), "email validated");
  await p.fill("#b-email", "x@example.com"); await p.selectOption("#b-budget", "10-30");
  const [pop] = await Promise.all([ctx.waitForEvent("page"), p.click("[data-form=build] button[type=submit]")]);
  const msg = decodeURIComponent(pop.url().split("text=")[1]);
  ok(msg.includes("طلب بناء نظام من موقع AZENK") && msg.includes("النشاط / الجهة: جامعة تجريبية") && msg.includes("الميزانية التقريبية: 10,000 – 30,000 ريال") && msg.includes("المرفقات"), "build WhatsApp message");
  await pop.close();
  ok((await p.textContent("[data-form-note]")).length > 0, "build sent note");

  /* ---------- contact form ---------- */
  await p.goto(BASE + "contact/");
  await p.fill("#f-name", "اختبار"); await p.fill("#f-phone", "0551234567"); await p.selectOption("#f-service", "software"); await p.fill("#f-details", "أحتاج نظامًا داخليًا للشركة");
  const [pop2] = await Promise.all([ctx.waitForEvent("page"), p.click("[data-form=project] button[type=submit]")]);
  ok(decodeURIComponent(pop2.url()).includes("الخدمة: تطوير أنظمة مخصصة"), "contact WhatsApp message");
  await pop2.close();

  /* ---------- English ---------- */
  for (const pg of PAGES) {
    await p.goto(BASE + pg + "?lang=en");
    await p.waitForSelector(".site-header .nav");
    ok((await p.getAttribute("html", "dir")) === "ltr", `${pg} en dir`);
    const ar = await p.evaluate(() => [...document.querySelectorAll("[data-i18n]")].filter((e) => /[؀-ۿ]/.test(e.textContent) && !e.closest(".founder") && !/عبدالعزيز/.test(e.textContent)).map((e) => e.dataset.i18n));
    ok(ar.length === 0, `${pg} untranslated keys: ${ar.join(",")}`);
    ok(!/[؀-ۿ]/.test(await p.title()), `${pg} en title`);
  }
  await p.goto(BASE + "solutions/?lang=en");
  ok((await p.textContent(".finder")).includes("What is your activity?"), "finder in English");

  /* ---------- mobile / overflow ---------- */
  for (const wdt of WIDTHS) {
    await p.setViewportSize({ width: wdt, height: 800 });
    for (const pg of PAGES) {
      await p.goto(BASE + pg);
      await p.waitForTimeout(150);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      ok(sw <= wdt, `${pg} overflow at ${wdt}: ${sw}`);
    }
    await p.goto(BASE + "presentations/");
    ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= wdt, `presentations overflow at ${wdt}`);
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(BASE);
  await p.click("[data-menu-open]");
  ok(await p.isVisible("#mobileNav.is-open"), "mobile menu opens");
  ok((await p.$$("#mobileNav .mnav__links a")).length === 7, "mobile menu 7 links");

  /* ---------- misc ---------- */
  for (const f of ["sitemap.xml", "robots.txt", "404.html", "assets/og-image.jpg"]) ok((await p.request.get(BASE + f)).status() === 200, f);
  const sm = await (await p.request.get(BASE + "sitemap.xml")).text();
  for (const loc of sm.match(/https:\/\/azenk\.sa\/[^<]*/g)) ok((await p.request.get(loc.replace("https://azenk.sa/", BASE))).status() === 200, `sitemap ${loc}`);
  ok(errs.length === 0, "console errors: " + JSON.stringify(errs.slice(0, 5)));

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
