import {test,expect} from '@playwright/test';
import {BASE,FULL,PARTNER_EMAIL,PARTNER_PASSWORD,RUN,requireFull,diagnostics,login,setupFixture,cleanupFixture} from './support.mjs';

let fx=null;
let submissionId='';

test.describe.serial('Vorlen portals, interviews and permission E2E',()=>{
  test.beforeAll(async()=>{
    if(!FULL)return;
    requireFull();
    fx=await setupFixture();
    const {data,error}=await fx.admin.from('candidate_submissions').insert({
      company_id:fx.companyId,client_id:fx.clientId,job_id:fx.jobId,candidate_id:fx.candidateId,
      submitted_by:fx.partnerId,headline:'[E2E] '+RUN,
      recruiter_summary:'Production E2E submission for client portal review.',
      key_strengths:['Relevant experience'],concerns:[],status:'submitted',
      submitted_at:new Date().toISOString()
    }).select('id').single();
    if(error)throw error;
    submissionId=data.id;
  });
  test.afterAll(async()=>{if(FULL&&fx)await cleanupFixture(fx)});

  test('client journey: admin permissions, rating, feedback, interview request and vacancy request',async({page})=>{
    requireFull(); const errors=diagnostics(page);
    await login(page,fx.client.email,fx.client.password);
    await expect(page).toHaveURL(/\/client$/);
    await expect(page.getByText(/SECURE CLIENT WORKSPACE · ADMIN/)).toBeVisible();
    await expect(page.getByRole('button',{name:'Manage access'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Request vacancy'})).toBeVisible();

    const card=page.locator('article.client-submission',{hasText:'[E2E] '+RUN+' Candidate'}).first();
    await expect(card).toBeVisible();
    await card.getByRole('button',{name:'5★'}).click();
    await card.getByLabel('Feedback').fill(RUN+' client feedback');
    await card.getByRole('button',{name:'Request interview'}).click();
    await expect(card.getByText(/interview requested/i)).toBeVisible();

    await page.getByRole('button',{name:'Request vacancy'}).click();
    await page.getByLabel('Job title').fill('[E2E] '+RUN+' Client requested vacancy');
    await page.getByLabel('Hiring requirement').fill('Production E2E client vacancy request with enough detail for manager review.');
    await page.getByRole('button',{name:'Send for review'}).click();
    await expect(page.getByText('[E2E] '+RUN+' Client requested vacancy')).toBeVisible();

    const {data}=await fx.admin.from('candidate_submissions').select('client_rating,client_feedback,status').eq('id',submissionId).single();
    expect(data.client_rating).toBe(5);
    expect(data.status).toBe('interview_requested');
    expect(data.client_feedback).toContain(RUN);
    expect(errors).toEqual([]);
  });

  test('candidate journey: application visibility, profile, marketing and privacy request',async({page})=>{
    requireFull(); const errors=diagnostics(page);
    await page.goto(BASE+'/candidate?token='+fx.candidateToken);
    await expect(page.getByText('Private application workspace')).toBeVisible();
    await expect(page.getByText('[E2E] '+RUN+' Vacancy')).toBeVisible();

    await page.getByLabel('Location').fill('Greater Manchester');
    await page.getByRole('button',{name:'Save my details'}).click();
    await expect(page.getByRole('status')).toContainText('Your profile has been updated.');

    const marketing=page.getByRole('button',{name:/Opt in|Opt out/});
    await marketing.click();
    await expect(page.getByRole('status')).toContainText(/Recruitment/);

    await page.getByRole('button',{name:'Request correction'}).click();
    await expect(page.getByRole('status')).toContainText('Your request has been recorded.');
    expect(errors).toEqual([]);
  });

  test('interview flow: schedule, calendar export, reschedule and cancel stay consistent',async({page})=>{
    requireFull(); const errors=diagnostics(page);
    await login(page,PARTNER_EMAIL,PARTNER_PASSWORD);
    await page.goto(BASE+'/dashboard/partner/talent');
    await page.getByLabel('Assigned vacancy').selectOption(fx.jobId);
    await page.getByLabel('Assigned candidate').selectOption(fx.candidateId);

    const future=new Date(Date.now()+3*86400000);
    const local=new Date(future.getTime()-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
    await page.getByLabel('When').fill(local);
    await page.getByLabel('Minutes').fill('45');
    await page.getByRole('button',{name:'Schedule interview'}).click();
    await expect(page.getByText(/scheduled/).last()).toBeVisible();

    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Add to calendar'}).first().click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.ics$/);

    await page.goto(BASE+'/dashboard/interviews');
    const row=page.locator('tr',{hasText:'[E2E] '+RUN+' Candidate'}).first();
    await expect(row).toBeVisible();

    page.once('dialog',d=>d.accept(new Date(Date.now()+4*86400000).toISOString().slice(0,16)));
    page.once('dialog',d=>d.accept('30'));
    page.once('dialog',d=>d.accept('https://example.invalid/e2e-meeting'));
    await row.getByRole('button',{name:'Reschedule'}).click();

    page.once('dialog',d=>d.accept('Cancelled by production E2E'));
    await row.getByRole('button',{name:'Cancel'}).click();
    await expect(row.getByText('cancelled')).toBeVisible();

    await page.context().clearCookies();
    await page.goto(BASE+'/candidate?token='+fx.candidateToken);
    await expect(page.getByText(/cancelled/i)).toBeVisible();

    await page.context().clearCookies();
    await login(page,fx.client.email,fx.client.password);
    await expect(page.getByText(/cancelled/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('security boundaries: role escalation, unassigned data and client-safe view are denied',async({browser})=>{
    requireFull();
    const {data:otherClient,error:oce}=await fx.admin.from('clients').insert({
      company_id:fx.companyId,company_name:'[E2E] '+RUN+' Other Client',contact_name:'Other',
      email:'other-'+RUN+'@example.invalid',status:'prospect'
    }).select('id').single(); if(oce)throw oce;
    const {data:otherJob,error:oje}=await fx.admin.from('jobs').insert({
      company_id:fx.companyId,client_id:otherClient.id,title:'[E2E] '+RUN+' UNASSIGNED JOB',
      slug:'e2e-unassigned-'+RUN.toLowerCase(),description:'Unassigned security fixture',
      employment_type:'Permanent',location:'Leeds',status:'draft',requirements:[]
    }).select('id').single(); if(oje)throw oje;
    const {data:otherCandidate,error:oca}=await fx.admin.from('candidates').insert({
      company_id:fx.companyId,full_name:'[E2E] '+RUN+' UNASSIGNED CANDIDATE',
      email:'unassigned-'+RUN+'@example.invalid',source:'production_e2e'
    }).select('id').single(); if(oca)throw oca;

    try{
      const partnerPage=await browser.newPage();
      await login(partnerPage,PARTNER_EMAIL,PARTNER_PASSWORD);
      await partnerPage.goto(BASE+'/dashboard/settings');
      await expect(partnerPage).toHaveURL(/\/dashboard\/partner/);
      await partnerPage.goto(BASE+'/dashboard/partner/talent');
      await expect(partnerPage.getByLabel('Assigned vacancy')).not.toContainText('UNASSIGNED JOB');
      await expect(partnerPage.getByLabel('Assigned candidate')).not.toContainText('UNASSIGNED CANDIDATE');
      await partnerPage.close();

      const clientPage=await browser.newPage();
      await login(clientPage,fx.client.email,fx.client.password);
      await clientPage.goto(BASE+'/dashboard/partner-management');
      await expect(clientPage).toHaveURL(/\/client$/);
      await clientPage.goto(BASE+'/client');
      const body=(await clientPage.locator('body').innerText()).toLowerCase();
      expect(body).not.toContain('resume_path');
      expect(body).not.toContain('source / authorisation evidence');
      await clientPage.close();
    } finally {
      await fx.admin.from('candidates').delete().eq('id',otherCandidate.id);
      await fx.admin.from('jobs').delete().eq('id',otherJob.id);
      await fx.admin.from('clients').delete().eq('id',otherClient.id);
    }
  });
});
