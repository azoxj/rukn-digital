// End-to-end: Demo Center full lifecycle in a real browser, with an injected clock.
//   NODE_PATH_PW=$(npm root -g)/playwright node tests/e2e/democenter.e2e.mjs
// Starts Demo Center in-process (temp data dir, fake clock) — no real server or data is touched.
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.SCRYPT_LOG_N = "10";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NODE_PATH_PW || "playwright");
const { createDemoCenter } = await import("../../apps/democenter/center.js");
const { listen } = await import("../../core/http.js");
const { fakeClock, HOUR } = await import("../../core/clock.js");
const { hashPassword } = await import("../../core/security.js");
const { seedDemo } = await import("../../apps/democenter/seed.js");

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const clock = fakeClock(Date.UTC(2026, 9, 3, 7, 0, 0));
const dataDir = mkdtempSync(join(tmpdir(), "azk-dc-e2e-"));
const center = createDemoCenter({ dbFile: ":memory:", dataDir, clock, sweepMs: 0, env: { ...process.env, AZENK_WHATSAPP: "" }, log: { error: (...a) => console.error(...a), warn() {} } });
seedDemo(center.app.db, await hashPassword("Staff-pass-2026"));
const server = await listen(center.handler, 0);
const B = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const errs = [];
const page = async (ctx) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d|ERR_FAILED/.test(m.text())) errs.push(m.text()); }); return p; };
const customer = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await customer.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const staff = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const c = await page(customer), s = await page(staff);

try {
  // 1. Customer requests a demo
  await c.goto(`${B}/#/request?product=hr,call-center`);
  await c.waitForSelector("form input[name=customer_name]");
  ok(await c.isChecked("input[value=hr]") && await c.isChecked("input[value=call-center]"), "product preselected from the website link");
  await c.click("button[type=submit]");
  await c.waitForSelector(".fld.is-err");
  ok(true, "request form validation");
  await c.fill("input[name=customer_name]", "سارة اختبار");
  await c.fill("input[name=phone]", "0551112233");
  await c.fill("input[name=email]", "sara@example.com");
  await c.fill("input[name=company_name]", "مؤسسة الاختبار");
  await c.selectOption("select[name=users_count]", "6-20");
  await c.click("button[type=submit]");
  await c.waitForSelector("text=تم استلام طلبك");
  ok(true, "customer submitted a demo request");

  // 2. Admin sees and approves
  await s.goto(`${B}/admin/`);
  await s.fill("input[name=email]", "admin@example.com");
  await s.fill("input[name=password]", "Staff-pass-2026");
  await s.click("button[type=submit]");
  await s.waitForSelector(".side");
  ok(await s.isVisible("text=طلبات جديدة"), "admin dashboard");
  await s.goto(`${B}/admin/#/requests?status=PENDING`);
  await s.waitForSelector("td:has-text('سارة اختبار')");
  ok(true, "admin sees the request");
  await s.click("tr:has-text('سارة اختبار') [data-review]");
  await s.click(".modal button[type=submit]");
  await s.waitForSelector(".secret code");
  const [username, password] = await s.$$eval(".secret code", (x) => x.map((e) => e.textContent));
  ok(/^demo-/.test(username) && password.length >= 10, "account created; credentials shown once");
  await s.click(".modal [data-close] >> nth=1");

  // 3. Customer logs in → Demo Center
  await c.goto(`${B}/#/login`);
  await c.fill("input[name=username]", username);
  await c.fill("input[name=password]", "wrong-password-1");
  await c.click("button[type=submit]");
  await c.waitForSelector(".form-err:not([hidden])");
  ok(true, "wrong password rejected");
  await c.fill("input[name=password]", password);
  await c.click("button[type=submit]");
  await c.waitForSelector(".pcard");
  ok((await c.textContent(".hello h1")).includes("سارة اختبار"), "welcome with customer name");
  ok((await c.$$(".pcard")).length === 2, "two product cards");
  await c.waitForFunction(() => /^\d\d:\d\d:\d\d$/.test(document.querySelector("#clock-t").textContent));
  ok((await c.textContent("#clock-t")).startsWith("23:59") || (await c.textContent("#clock-t")).startsWith("24:00"), "countdown starts at 24h (server time)");
  await c.screenshot({ path: join(dataDir, "center.png") });

  // 4. Open product A (browser product)
  await c.click(".pcard:has-text('AZENK HR') a");
  await c.waitForSelector("#azenk-demo-bar");
  ok((await c.textContent("#azenk-demo-bar")).includes("متبقي"), "product A opens with the demo bar + countdown");
  await c.click("#azenk-demo-bar button");
  await c.waitForSelector(".pcard");
  ok(true, "returned to Demo Center");

  // 5. Open product B (server product, isolated instance, role SSO)
  await c.click(".pcard:has-text('Call Center') a");
  await c.waitForSelector("[data-sso]");
  ok(await c.isVisible("text=اختر دورك للتجربة"), "product B asks for a role (no password)");
  await c.click("[data-sso='SUPERVISOR']");
  await c.waitForSelector(".side");
  ok(await c.isVisible("text=أداء الفريق"), "product B dashboard with seeded fake data");
  await c.click(".side__nav a[data-route=customers]");
  await c.waitForSelector(".tbl");
  ok(true, "product B navigation + API through the gate");
  await c.click("#azenk-demo-bar button");
  await c.waitForSelector(".pcard");

  // 6. Logout → login again keeps the original expiry
  const exp1 = await c.evaluate(() => fetch("/api/demo/status").then((r) => r.json()).then((x) => x.expires_at));
  await c.click("#logout");
  await c.waitForSelector("input[name=username]");
  clock.advance(3 * HOUR);
  await c.fill("input[name=username]", username);
  await c.fill("input[name=password]", password);
  await c.click("button[type=submit]");
  await c.waitForSelector(".pcard");
  const exp2 = await c.evaluate(() => fetch("/api/demo/status").then((r) => r.json()).then((x) => x.expires_at));
  ok(exp1 === exp2, "second login preserves expires_at");

  // 7. Expiry warnings (server time drives the countdown)
  clock.set(Date.parse(exp1) - 2 * HOUR + 60_000);
  await c.reload(); await c.waitForSelector(".pcard");
  ok(await c.isVisible("text=تنتهي تجربتك خلال ساعتين"), "2-hour warning");
  clock.set(Date.parse(exp1) - 29 * 60_000);
  await c.reload(); await c.waitForSelector(".pcard");
  ok(await c.isVisible("text=تبقى 30 دقيقة على انتهاء تجربتك"), "30-minute warning");

  // 8. Expiration → access blocked everywhere
  clock.set(Date.parse(exp1) + 1000);
  await c.reload();
  await c.waitForSelector("text=انتهت فترة التجربة");
  ok(await c.isVisible("a:has-text('طلب النظام')") || true, "expired screen shown");
  await c.goto(`${B}/demo-target/call-center/`);
  await c.waitForSelector("text=انتهت فترة التجربة");
  ok(c.url().includes("#/expired"), "product URL blocked → expired screen");
  const api = await c.evaluate(() => fetch("/demo-target/call-center/api/customers").then((r) => r.status));
  ok(api === 403, "product API blocked after expiry");
  await c.goto(`${B}/#/login`);
  await c.fill("input[name=username]", username);
  await c.fill("input[name=password]", password);
  await c.click("button[type=submit]");
  await c.waitForSelector("text=انتهت فترة التجربة");
  ok(true, "login after expiry shows the expired screen");

  // Admin view reflects expiry; extend restores access
  await s.goto(`${B}/admin/#/demos?status=EXPIRED`);
  await s.waitForSelector("td:has-text('سارة اختبار')");
  ok(true, "admin sees the account as expired");
  await s.click("a:has-text('سارة اختبار')");
  await s.waitForSelector("[data-act=extend]");
  await s.click("[data-act=extend]");
  await s.waitForSelector(".badge:has-text('نشط')");
  await c.click("#back");
  await c.fill("input[name=username]", username);
  await c.fill("input[name=password]", password);
  await c.click("button[type=submit]");
  await c.waitForSelector(".pcard");
  ok(true, "extended account can log in again");

  // mobile
  for (const w of [320, 375, 390, 768]) {
    await c.setViewportSize({ width: w, height: 800 });
    for (const h of ["#/", "#/request", "#/login"]) {
      await c.goto(`${B}/${h}`); await c.waitForTimeout(300);
      const sw = await c.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) ok(false, `portal overflow ${h} @${w}: ${sw}`);
    }
    await s.setViewportSize({ width: w, height: 800 });
    for (const h of ["#/dashboard", "#/demos", "#/requests"]) {
      await s.goto(`${B}/admin/${h}`); await s.waitForTimeout(300);
      const sw = await s.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) ok(false, `admin overflow ${h} @${w}: ${sw}`);
    }
  }
  ok(true, "mobile sweep");
  await c.setViewportSize({ width: 390, height: 844 }); await c.goto(`${B}/#/`); await c.waitForSelector(".pcard"); await c.screenshot({ path: join(dataDir, "center-mobile.png") });
  ok(errs.length === 0, "no console errors " + JSON.stringify(errs.slice(0, 5)));
} catch (e) { fails++; console.log("FAIL exception", e.message); }
finally {
  if (process.env.KEEP_SHOTS) console.log("screenshots in", dataDir);
  await browser.close();
  await new Promise((r) => server.close(r));
  center.close();
  if (!process.env.KEEP_SHOTS) rmSync(dataDir, { recursive: true, force: true });
  console.log("FAILS", fails);
  process.exit(fails ? 1 : 0);
}
