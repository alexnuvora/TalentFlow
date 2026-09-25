import {expect,test} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createHash,randomBytes} from 'node:crypto';

export const BASE=process.env.VORLEN_E2E_BASE_URL||'https://www.vorlen.co.uk';
export const FULL=process.env.VORLEN_E2E_ALLOW_MUTATIONS==='true';
export const PARTNER_EMAIL=process.env.VORLEN_E2E_PARTNER_EMAIL||'';
export const PARTNER_PASSWORD=process.env.VORLEN_E2E_PARTNER_PASSWORD||'';
const SUPABASE_URL=process.env.VORLEN_SUPABASE_URL||'';
const SERVICE_KEY=process.env.VORLEN_SUPABASE_SERVICE_ROLE_KEY||'';
export const RUN='E2E-'+Date.now().toString(36);
const MANAGER_PASSWORD='M!'+randomBytes(15).toString('base64url');
const CLIENT_PASSWORD='C!'+randomBytes(15).toString('base64url');

export function requireFull(){
  test.skip(!FULL,'Full production mutation suite requires VORLEN_E2E_ALLOW_MUTATIONS=true.');
  test.skip(!PARTNER_EMAIL||!PARTNER_PASSWORD,'Partner E2E credentials are not configured.');
  test.skip(!SUPABASE_URL||!SERVICE_KEY,'Service-role fixture/cleanup credentials are not configured.');
}
export function diagnostics(page){
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text())});
  page.on('response',r=>{if(r.status()>=500)errors.push('http '+r.status()+' '+r.url())});
  return errors;
}
export async function login(page,email,password){
  await page.goto(BASE+'/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.waitForLoadState('networkidle').catch(()=>{});
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}
async function findUser(admin,email){
  for(let page=1;page<=10;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
    if(error)throw error;
    const found=data.users.find(u=>(u.email||'').toLowerCase()===email.toLowerCase());
    if(found)return found;
    if(data.users.length<100)break;
  }
  return null;
}
export async function setupFixture(){
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const partner=await findUser(admin,PARTNER_EMAIL);
  if(!partner)throw new Error('Configured partner auth user was not found.');
  const {data:profile,error:pe}=await admin.from('profiles').select('company_id').eq('id',partner.id).single();
  if(pe)throw pe;
  const companyId=profile.company_id;
  const clientEmail=('client-'+RUN+'@example.invalid').toLowerCase();
  const managerEmail=('manager-'+RUN+'@example.invalid').toLowerCase();

  const {data:client,error:ce}=await admin.from('clients').insert({
    company_id:companyId,company_name:'[E2E] '+RUN+' Client',contact_name:'E2E Contact',
    email:clientEmail,status:'active',terms_version:'e2e',terms_accepted_at:new Date().toISOString(),
    terms_accepted_by:'E2E automation',terms_acceptance_method:'test_fixture',terms_evidence:RUN
  }).select('id').single(); if(ce)throw ce;

  const {data:job,error:je}=await admin.from('jobs').insert({
    company_id:companyId,client_id:client.id,title:'[E2E] '+RUN+' Vacancy',
    slug:'e2e-'+RUN.toLowerCase(),description:'Production E2E fixture vacancy.',
    employment_type:'Permanent',location:'Manchester',status:'draft',requirements:['E2E'],
    genuine_vacancy_confirmed_at:new Date().toISOString(),client_instruction_reference:'e2e:'+RUN
  }).select('id').single(); if(je)throw je;

  const {data:candidate,error:cane}=await admin.from('candidates').insert({
    company_id:companyId,full_name:'[E2E] '+RUN+' Candidate',
    email:('candidate-'+RUN+'@example.invalid').toLowerCase(),location:'Manchester',
    source:'production_e2e',consent_at:new Date().toISOString(),
    work_seeker_terms_version:'e2e',work_seeker_terms_agreed_at:new Date().toISOString(),
    work_seeker_terms_evidence:RUN,experience_summary:'Production E2E candidate fixture.',
    training_qualifications:'E2E qualification',authorisations:'E2E authorised'
  }).select('id').single(); if(cane)throw cane;

  const {data:application,error:ae}=await admin.from('applications').insert({
    company_id:companyId,job_id:job.id,candidate_id:candidate.id,source:'production_e2e',
    consent_version:'e2e',consent_at:new Date().toISOString(),work_seeker_terms_version:'e2e',
    work_seeker_terms_agreed_at:new Date().toISOString(),willingness_confirmed_at:new Date().toISOString(),
    willingness_evidence:RUN,suitability_checked_at:new Date().toISOString(),suitability_evidence:RUN
  }).select('id').single(); if(ae)throw ae;

  const {error:assnErr}=await admin.from('partner_assignments').insert([
    {company_id:companyId,partner_id:partner.id,client_id:client.id,priority:'normal',objective:RUN},
    {company_id:companyId,partner_id:partner.id,job_id:job.id,priority:'normal',objective:RUN},
    {company_id:companyId,partner_id:partner.id,candidate_id:candidate.id,priority:'normal',objective:RUN}
  ]); if(assnErr)throw assnErr;

  const {data:mu,error:mue}=await admin.auth.admin.createUser({email:managerEmail,password:MANAGER_PASSWORD,email_confirm:true});
  if(mue)throw mue;
  const {error:mpe}=await admin.from('profiles').insert({id:mu.user.id,company_id:companyId,full_name:'[E2E] Manager',role:'manager'});
  if(mpe)throw mpe;

  const {data:cu,error:cue}=await admin.auth.admin.createUser({email:clientEmail,password:CLIENT_PASSWORD,email_confirm:true});
  if(cue)throw cue;
  const {error:cpe}=await admin.from('profiles').insert({id:cu.user.id,company_id:companyId,client_id:client.id,full_name:'[E2E] Client Admin',role:'viewer'});
  if(cpe)throw cpe;
  const {error:cme}=await admin.from('client_portal_memberships').insert({
    company_id:companyId,client_id:client.id,user_id:cu.user.id,email:clientEmail,
    full_name:'[E2E] Client Admin',portal_role:'admin',status:'active',created_by:mu.user.id
  }); if(cme)throw cme;

  const raw=randomBytes(32).toString('hex');
  const tokenHash=createHash('sha256').update(raw).digest('hex');
  const {error:te}=await admin.from('candidate_portal_tokens').insert({
    candidate_id:candidate.id,token_hash:tokenHash,expires_at:new Date(Date.now()+86400000).toISOString()
  }); if(te)throw te;

  const {error:vre}=await admin.from('client_vacancy_requests').insert({
    company_id:companyId,client_id:client.id,requested_by:cu.user.id,
    title:'[E2E] '+RUN+' Manager conversion',location:'Manchester',employment_type:'Permanent',
    hiring_need:'Production E2E request for manager review and conversion.'
  }); if(vre)throw vre;

  return {
    admin,companyId,partnerId:partner.id,clientId:client.id,jobId:job.id,candidateId:candidate.id,
    applicationId:application.id,candidateToken:raw,
    manager:{email:managerEmail,password:MANAGER_PASSWORD,userId:mu.user.id},
    client:{email:clientEmail,password:CLIENT_PASSWORD,userId:cu.user.id}
  };
}
export async function cleanupFixture(fx){
  const a=fx?.admin;if(!a||!fx)return;
  await a.from('candidate_portal_tokens').delete().eq('candidate_id',fx.candidateId);
  await a.from('client_portal_memberships').delete().eq('client_id',fx.clientId);
  await a.from('partner_outreach_enrollments').delete().eq('client_id',fx.clientId);
  await a.from('partner_communication_events').delete().eq('client_id',fx.clientId);
  await a.from('partner_opportunities').delete().eq('client_id',fx.clientId);
  await a.from('client_recruitment_contacts').delete().eq('client_id',fx.clientId);
  await a.from('client_vacancy_requests').delete().eq('client_id',fx.clientId);
  await a.from('interviews').delete().eq('client_id',fx.clientId);
  await a.from('partner_submission_packs').delete().eq('client_id',fx.clientId);
  await a.from('candidate_submissions').delete().eq('client_id',fx.clientId);
  await a.from('applications').delete().eq('candidate_id',fx.candidateId);
  await a.from('partner_assignments').delete().eq('partner_id',fx.partnerId);
  await a.from('candidates').delete().eq('id',fx.candidateId);
  await a.from('jobs').delete().eq('id',fx.jobId);
  await a.from('clients').delete().eq('id',fx.clientId);
  await a.auth.admin.deleteUser(fx.manager.userId);
  await a.auth.admin.deleteUser(fx.client.userId);
}
