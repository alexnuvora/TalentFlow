import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {BASE,FULL,PARTNER_EMAIL,PARTNER_PASSWORD,RUN,requireFull,diagnostics,login,setupFixture,cleanupFixture} from './support.mjs';

let fx=null;

test.describe.serial('Vorlen partner and manager production E2E',()=>{
  test.beforeAll(async()=>{if(FULL){requireFull();fx=await setupFixture()}});
  test.afterAll(async()=>{if(FULL&&fx)await cleanupFixture(fx)});

  test('public production surfaces are healthy',async({page})=>{
    const errors=diagnostics(page);
    for(const path of ['/','/login','/careers']){
      await page.goto(BASE+path);
      await expect(page.locator('body')).toContainText(/Vorlen/i);
      await expect(page).not.toHaveTitle(/404|not found/i);
    }
    expect(errors.filter(x=>!x.includes('favicon'))).toEqual([]);
  });

  test('partner CRM: contact update, timeline, opportunity and sequence',async({page})=>{
    requireFull(); const errors=diagnostics(page);
    await login(page,PARTNER_EMAIL,PARTNER_PASSWORD);
    await page.goto(BASE+'/dashboard/partner/crm');
    await expect(page.getByText('ACCOUNT CRM')).toBeVisible();
    await page.getByLabel('Account').selectOption(fx.clientId);

    const contactName='[E2E] '+RUN+' Decision Maker';
    await page.getByLabel('Name').fill(contactName);
    await page.getByLabel('Title').fill('Hiring Manager');
    await page.getByLabel('Email').fill('decision-'+RUN+'@example.invalid');
    await page.getByLabel('Recruitment authority').selectOption('decision_maker');
    await page.getByLabel('Relationship').selectOption('warming');
    await page.getByRole('button',{name:'Add contact'}).click();
    await expect(page.getByText(contactName)).toBeVisible();

    const row=page.locator('.list-row',{hasText:contactName});
    await row.getByRole('button',{name:'Edit'}).click();
    await page.getByLabel('Relationship').selectOption('engaged');
    await page.getByRole('button',{name:'Update contact'}).click();
    await expect(page.getByText(/Relationship: engaged/)).toBeVisible();

    await page.getByRole('button',{name:'Timeline'}).click();
    await page.getByLabel('Type').selectOption('note');
    await page.getByLabel('Direction').selectOption('internal');
    await page.getByLabel('What happened?').fill(RUN+' production E2E account note.');
    await page.getByRole('button',{name:'Add to timeline'}).click();
    await expect(page.getByText(RUN+' production E2E account note.')).toBeVisible();

    await page.getByRole('button',{name:'Deals / opportunities'}).click();
    await page.getByLabel('Opportunity').fill('[E2E] '+RUN+' Opportunity');
    await page.getByLabel('Expected fee £').fill('5000');
    await page.getByLabel('Probability %').fill('50');
    await page.getByLabel('Next action').fill('E2E manager review');
    await page.getByRole('button',{name:'Create opportunity'}).click();
    await expect(page.getByText('[E2E] '+RUN+' Opportunity')).toBeVisible();

    await page.getByRole('button',{name:'Outreach sequences'}).click();
    let start=page.getByRole('button',{name:'Start'}).first();
    if(await start.count()===0){
      await page.getByLabel('Name').fill('[E2E] '+RUN+' Sequence');
      await page.getByRole('button',{name:'Save reusable sequence'}).click();
      start=page.getByRole('button',{name:'Start'}).first();
    }
    await start.click();
    await expect(page.getByText(/active · started/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('talent workflow: match, AI rerank, CV parse/enrichment and submission pack',async({page},testInfo)=>{
    requireFull(); const errors=diagnostics(page);
    await login(page,PARTNER_EMAIL,PARTNER_PASSWORD);
    await page.goto(BASE+'/dashboard/partner/talent');
    await expect(page.getByText('TALENT TOOLS')).toBeVisible();
    await page.getByLabel('Assigned vacancy').selectOption(fx.jobId);
    await page.getByLabel('Assigned candidate').selectOption(fx.candidateId);

    await page.getByRole('button',{name:'Evidence match'}).click();
    await expect(page.getByText(/Match \d+\/100/).first()).toBeVisible();
    await expect(page.getByRole('button',{name:'AI rerank'})).toBeEnabled();
    await page.getByRole('button',{name:'AI rerank'}).click();
    await expect(page.getByText(/Match \d+\/100/).first()).toBeVisible();

    const pdf=testInfo.outputPath('candidate.pdf');
    const text='Vorlen E2E Candidate Manchester software recruitment experience '+RUN;
    const escaped=text.replace(/([()\\])/g,'\\$1');
    const content='BT /F1 12 Tf 72 720 Td ('+escaped+') Tj ET';
    const objects=[
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      '<< /Length '+content.length+' >>\\nstream\\n'+content+'\\nendstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let body='%PDF-1.4\\n',offsets=[0];
    for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=(i+1)+' 0 obj\\n'+objects[i]+'\\nendobj\\n'}
    const xref=Buffer.byteLength(body);
    body+='xref\\n0 '+(objects.length+1)+'\\n0000000000 65535 f \\n';
    for(let i=1;i<offsets.length;i++)body+=String(offsets[i]).padStart(10,'0')+' 00000 n \\n';
    body+='trailer\\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF\\n';
    fs.writeFileSync(pdf,body);
    await page.getByLabel('Candidate-provided CV').setInputFiles(pdf);
    await page.getByLabel('Source / authorisation evidence').fill('Candidate fixture authorised for '+RUN+' production E2E testing.');
    await page.getByRole('button',{name:'Upload CV securely'}).click();
    await expect(page.getByText(/Stored CV available/)).toBeVisible();

    await page.getByRole('button',{name:'Parse CV with AI'}).click();
    await expect(page.getByText('Review proposed enrichment')).toBeVisible();
    await page.getByRole('button',{name:'Apply reviewed enrichment'}).click();

    await page.getByLabel('Headline').fill('[E2E] '+RUN+' Candidate');
    await page.getByLabel('Recruiter summary').fill('Production E2E candidate summary with enough detail for manager review and controlled submission.');
    await page.getByLabel('Strengths (one per line)').fill('Relevant experience\nManchester location');
    await page.getByRole('button',{name:'Send for Vorlen review'}).click();
    await expect(page.getByText(/requested/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('manager workflow: approve pack, create controlled submission, convert vacancy, see analytics',async({page})=>{
    requireFull(); const errors=diagnostics(page);
    await login(page,fx.manager.email,fx.manager.password);
    await page.goto(BASE+'/dashboard/partner-management');
    await expect(page.getByText('PARTNER OPERATIONS')).toBeVisible();
    await page.getByLabel('Team member').selectOption(fx.partnerId);

    const pack=page.locator('.list-row',{hasText:'[E2E] '+RUN+' Candidate'}).first();
    await expect(pack).toBeVisible();
    page.once('dialog',d=>d.accept('Approved by production E2E'));
    await pack.getByRole('button',{name:'Approve pack'}).click();

    await expect.poll(async()=>{
      const {data}=await fx.admin.from('partner_submission_packs').select('candidate_submission_id,status').eq('candidate_id',fx.candidateId).eq('job_id',fx.jobId).single();
      return Boolean(data?.candidate_submission_id)&&data?.status==='approved';
    }).toBe(true);
    const {data:submission}=await fx.admin.from('candidate_submissions').select('status').eq('candidate_id',fx.candidateId).eq('job_id',fx.jobId).single();
    expect(submission?.status).toBe('approved_to_send');

    const vacancy=page.locator('.list-row',{hasText:'[E2E] '+RUN+' Manager conversion'}).first();
    page.once('dialog',d=>d.accept('Reviewed by production E2E'));
    await vacancy.getByRole('button',{name:'Approve'}).click();
    await vacancy.getByRole('button',{name:'Create draft vacancy'}).click();
    await expect(page.getByText(/Draft vacancy:/)).toBeVisible();
    await expect(page.getByText('Partner commission ledger')).toBeVisible();
    await expect(page.getByText(/Weighted pipeline/)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
