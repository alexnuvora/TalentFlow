import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch();const base='http://127.0.0.1:4173';
for(let i=0;i<50;i++){try{await fetch(base);break}catch{await new Promise(r=>setTimeout(r,200));}}
const job={id:'10000000-0000-0000-0000-000000000001',title:'Sales consultant',slug:'sales-consultant',description:'A test opportunity',requirements:['Sales experience'],application_mode:'register_interest',opportunity_notice:'Register interest only',employment_type:'self_employed',location:'Manchester',application_questions:[{id:'experience',question:'Tell us about your experience',required:true,type:'text'}],created_at:'2026-09-17T00:00:00Z'};
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let submission;
 await page.route('**/*.supabase.co/**',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/jobs'))return route.fulfill({json:u.searchParams.has('slug')?job:[job]});if(u.pathname.endsWith('/submit-application')){submission=route.request().postData();return route.fulfill({json:{ok:true,portal_url:base+'/candidate?token=test'}})}return route.fulfill({json:[]});});
 await page.goto(base);await page.getByRole('link',{name:'Start 14-day free trial'}).click();await page.getByRole('heading',{name:'Create your recruitment workspace'}).waitFor();
 await page.goto(base+'/careers/sales-consultant');await page.getByLabel('First name',{exact:true}).fill('Test');await page.getByLabel('Last name',{exact:true}).fill('Candidate');await page.getByLabel('Email',{exact:true}).fill('candidate@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'cv.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test fixture')});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Tell us about your experience').fill('Five years of sales');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('input[type=checkbox]').first().check();await page.getByRole('button',{name:'Register interest',exact:true}).click();await page.getByRole('heading',{name:'Interest registered'}).waitFor();
 assert.match(submission,/name="full_name"/);assert.match(submission,/Test Candidate/);assert.match(submission,/name="resume_file"/);assert.equal(errors.length,0,errors.join('\n'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'Unexpected horizontal overflow');
 await page.goto(base+'/dashboard');await page.waitForURL('**/login');await context.close();
}
await browser.close();console.log('Desktop and mobile signup, application and private-route smoke checks passed. API responses were mocked; no real candidates or emails were created.');
