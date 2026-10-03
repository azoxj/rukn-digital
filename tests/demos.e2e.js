// Local check of the offline browser previews (npm run build:demo in platform/, then serve the repo root on :8080).
//   NODE_PATH_PW=$(npm root -g)/playwright node tests/demos.e2e.js
const { chromium } = require(process.env.NODE_PATH_PW || "playwright");
const B=process.env.BASE||'http://localhost:8080/demos/';
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++;};
(async()=>{
 const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage(); const errs=[];
 p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error' && !/40[0-9]|415|422/.test(m.text())) errs.push(m.text()); });
 const t0=Date.now();
 const demoLogin=async(app,role)=>{ await p.goto(B+app+'/'); await p.waitForSelector('.demo-login',{timeout:30000}); await p.click(`.demo-login [data-demo-email]:has-text("${role}")`); await p.waitForSelector('.side'); };
 // Call Center
 await demoLogin('callcenter','مشرف'); ok(true,'callcenter boots + demo login ('+(Date.now()-t0)+'ms)');
 ok(await p.isVisible('.demo-bar'),'demo banner');
 ok(await p.isVisible('text=أداء الفريق'),'supervisor dashboard with seeded data');
 await p.click('.side__nav a[data-route=tickets]'); await p.waitForSelector('.filters select[name=priority]'); await p.waitForSelector('[data-list] .tbl tbody tr'); ok((await p.$$('.tbl tbody tr')).length>5,'tickets listed');
 await p.click('.tbl tbody tr a >> nth=0'); await p.waitForSelector('[data-edit]');
 await p.selectOption('[data-edit] select[name=status]','resolved'); await p.click('[data-edit] button[type=submit]'); await p.waitForSelector('text=تم حفظ التذكرة'); ok(true,'ticket update works');
 await p.goto(B+'callcenter/#/reports'); await p.waitForSelector('text=أداء الموظفين');
 const [dl]=await Promise.all([p.waitForEvent('download'), p.click('[data-csv=calls]')]); ok(dl.suggestedFilename().endsWith('.csv'),'CSV export in demo');
 await p.click('[data-demo-switch]'); await p.waitForSelector('.demo-login'); await p.click('.demo-login [data-demo-email]:has-text("موظف خدمة")'); await p.waitForSelector('.side');
 await p.goto(B+'callcenter/#/reports'); await p.waitForSelector('text=لا تملك صلاحية'); ok(true,'RBAC enforced in demo (agent blocked from reports)');
 await p.goto(B+'callcenter/#/calls/new'); await p.fill('input[name=lookup]','0500000101'); await p.click('[data-find]'); await p.waitForSelector('[data-change]');
 await p.fill('textarea[name=notes]','مكالمة من الـ Demo'); await p.fill('input[name=duration_min]','2'); await p.click('[data-call] button[type=submit]'); await p.waitForSelector('text=بيانات العميل'); ok(await p.isVisible('text=مكالمة من الـ Demo'),'log a call in demo');
 // Graduation
 await demoLogin('graduation','طالب'); ok(await p.isVisible('text=نظام إدارة المكتبة الجامعية'),'graduation student dashboard');
 await p.goto(B+'graduation/#/projects/1?tab=files'); await p.waitForSelector('[data-upload]');
 await p.setInputFiles('#up-file', {name:'تقرير.pdf', mimeType:'application/pdf', buffer:Buffer.from('%PDF-1.4\n%%EOF\n')});
 await p.click('[data-upload] button[type=submit]'); await p.waitForSelector('text=تم رفع الملف'); ok(true,'file upload in demo (validated)');
 const [d2]=await Promise.all([p.waitForEvent('download'), p.click('[data-dl] >> nth=0')]); ok(!!d2,'file download in demo');
 await demoLogin('graduation','مشرف'); await p.goto(B+'graduation/#/projects/1?tab=milestones'); await p.waitForSelector('[data-review]'); ok(true,'supervisor sees review buttons');
 // Requests
 await demoLogin('requests','موظف'); await p.click('.side__nav a[data-route=new]'); await p.click('.type-card:has-text("طلب دعم تقني")');
 await p.fill('[data-new] input[name=title]','طلب من الـ Demo'); await p.selectOption('select[name="data.issue_type"]','برنامج'); await p.fill('textarea[name="data.details"]','تجربة');
 await p.click('[data-new] button[type=submit]'); await p.waitForSelector('h1:has-text("#")'); ok(true,'request created in demo');
 await demoLogin('requests','مدير النظام'); await p.click('.side__nav a[data-route=approvals]'); await p.waitForSelector('a:has-text("طلب من الـ Demo")').catch(()=>{});
 ok(!(await p.isVisible('a:has-text("طلب من الـ Demo")')),'reload re-seeds a fresh demo (previous data gone)');
 await p.click('a:has-text("مراجعة") >> nth=0'); await p.waitForSelector('[data-decide]'); await p.click('[data-d=approve]'); await p.waitForSelector('text=تمت الموافقة'); ok(true,'approve in demo');
 // mobile overflow
 for (const w of [320,390,768]) { await p.setViewportSize({width:w,height:800}); for (const a of ['callcenter','graduation','requests']) { await p.goto(B+a+'/'); await p.waitForSelector('.demo-login'); const sw=await p.evaluate(()=>document.documentElement.scrollWidth); if(sw>w) ok(false,`login overflow ${a}@${w}: ${sw}`);} }
 ok(true,'mobile login sweep');
 ok(errs.length===0,'no console errors '+JSON.stringify(errs.slice(0,5)));
 await b.close(); console.log('FAILS',fails);
})();
