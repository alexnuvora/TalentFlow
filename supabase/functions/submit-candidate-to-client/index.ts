import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
if(req.method!=='POST')return json({error:'Method not allowed'},405);
const auth=req.headers.get('Authorization')||'',url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}}),db=createClient(url,service);
const{data:{user}}=await uc.auth.getUser();if(!user)return json({error:'Authentication required'},401);
const{data:profile}=await db.from('profiles').select('company_id').eq('id',user.id).single();if(!profile)return json({error:'Workspace not found'},403);const{data:candidateAllowed}=await db.rpc('candidate_processing_allowed',{p_company_id:profile.company_id});if(candidateAllowed!==true)return json({error:'Candidate processing is disabled until Vorlen completes the candidate compliance activation process.'},409);const b=await req.json();let appId=String(b.application_id||''),summary=String(b.recruiter_summary||'').trim(),recipient=String(b.recipient_email||'').trim(),authorisation=String(b.candidate_authorisation||'').trim();
if(b.action==='readiness'||b.action==='send_approved'){
 const{data:staff}=await db.from('profiles').select('role').eq('id',user.id).eq('company_id',profile.company_id).maybeSingle();
 if(!staff||!['owner','manager','recruiter'].includes(staff.role))return json({error:'Recruitment staff access required'},403);
 if(staff.role==='recruiter'){
 const{data:approved}=await db.from('recruiter_data_access_approvals').select('approved_at,revoked_at,expires_at').eq('user_id',user.id).eq('company_id',profile.company_id).not('approved_at','is',null).is('revoked_at',null).limit(1).maybeSingle();
 if(!approved||(approved.expires_at&&new Date(approved.expires_at)<=new Date()))return json({error:'Candidate access approval required'},403);
 }
 const{data:a,error:ae}=await db.from('applications').select('*').eq('id',appId).eq('company_id',profile.company_id).maybeSingle();
 if(ae||!a)return json({error:'Application not found'},404);
 const[{data:job},{data:client},{data:packs},{data:submissions},{data:reports},{data:candidate}]=await Promise.all([
 db.from('jobs').select('id,title,client_id,status,application_mode,agency_service_type,qualification_verification_required,works_with_vulnerable_people').eq('id',a.job_id).eq('company_id',profile.company_id).maybeSingle(),
 db.from('clients').select('id,email,status,terms_accepted_at,terms_version,terms_accepted_by,terms_evidence,recruitment_fee_percent,payment_terms_days').eq('id', (await db.from('jobs').select('client_id').eq('id',a.job_id).single()).data?.client_id||'00000000-0000-0000-0000-000000000000').eq('company_id',profile.company_id).maybeSingle(),
 db.from('partner_submission_packs').select('id,summary,headline,status').eq('candidate_id',a.candidate_id).eq('job_id',a.job_id).eq('company_id',profile.company_id).eq('status','approved').order('reviewed_at',{ascending:false}).limit(1),
 db.from('candidate_submissions').select('status,candidate_authorisation,recipient_email,delivery_id,submitted_at').eq('candidate_id',a.candidate_id).eq('job_id',a.job_id).eq('company_id',profile.company_id).limit(1),
 db.from('screening_reports').select('id,reviewed_at').eq('application_id',a.id).eq('company_id',profile.company_id),
 db.from('candidates').select('resume_path,postal_address,under_22,date_of_birth,experience_summary,training_qualifications,authorisations,work_seeker_terms_agreed_at').eq('id',a.candidate_id).eq('company_id',profile.company_id).maybeSingle()
 ]);
 const pack=packs?.[0],existing=submissions?.[0];const blockers:string[]=[];
 if(!job||!client||!candidate)blockers.push('Candidate, vacancy or client information is unavailable.');
 if(!pack?.summary||pack.summary.trim().length<10)blockers.push('An approved recruiter submission pack with a useful summary is required.');
 if(a.status!=='qualified'&&a.status!=='submitted')blockers.push('The application needs a verified human qualification decision.');
 if((reports||[]).some((r:any)=>!r.reviewed_at))blockers.push('An AI screening report still needs human review.');
 if(!a.vacancy_particulars_provided_at||!a.willingness_confirmed_at||!String(a.willingness_evidence||'').trim())blockers.push('Candidate willingness for this vacancy and the vacancy particulars are not yet evidenced.');
 if(!a.suitability_checked_at||!String(a.suitability_evidence||'').trim())blockers.push('The role-specific suitability check has not been recorded.');
 if(job?.qualification_verification_required&&(!a.qualification_verified_at||!String(a.qualification_verification_evidence||'').trim()))blockers.push('Required qualifications or authorisations still need verification.');
 if(job?.works_with_vulnerable_people&&(!a.reference_1_verified_at||!a.reference_2_verified_at||!a.vulnerable_checks_evidence))blockers.push('Required references and vulnerable-person checks are incomplete.');
 const savedAuthority=String(existing?.candidate_authorisation||a.source_details?.candidate_sharing_authorisation||'').trim();
 if(savedAuthority.length<10)blockers.push('Candidate permission to share their details with this client has not been evidenced.');
 if(!candidate?.resume_path)blockers.push('Candidate CV is missing.');
 if(!candidate?.work_seeker_terms_agreed_at)blockers.push('Work-seeker terms have not been acknowledged.');
 if(!candidate?.postal_address||candidate?.under_22===null||(candidate?.under_22&&!candidate?.date_of_birth)||!candidate?.experience_summary||!candidate?.training_qualifications||!candidate?.authorisations)blockers.push('Mandatory candidate record details need completion.');
 if(!client||client.status!=='active'||!client.email)blockers.push('An active verified employer contact is required.');
 if(!client?.terms_accepted_at||client.terms_version!=='client-tob-2026-09-21'||!client.terms_accepted_by||!client.terms_evidence||client.recruitment_fee_percent==null||client.payment_terms_days==null)blockers.push('Current signed client Terms of Business and commercial terms are required.');
 if(!job||job.status!=='published'||job.application_mode==='register_interest'||job.agency_service_type!=='permanent_employment')blockers.push('The vacancy is not published for authorised permanent introductions.');
 if(existing?.status==='submitted')blockers.push('This candidate has already been introduced to this employer.');
 // Previously approved but unsent submissions are reserved atomically before delivery.
 if(b.action==='readiness')return json({ready:blockers.length===0,blockers,recipient_email:client?.email||null,summary:pack?.summary||null,application_id:appId,existing_status:existing?.status||null});
 if(blockers.length)return json({error:'Introduction cannot proceed until outstanding checks are completed.',blockers},409);
 summary=pack.summary.trim();recipient=client.email;authorisation=savedAuthority;
 b.review_confirmed=true;b.force_resend=false;
}
if(!appId||!recipient||summary.length<10||authorisation.length<10||b.review_confirmed!==true)return json({error:'Application, recipient, reviewed summary, candidate authorisation and human review confirmation are required'},400);if(b.action==='send_approved'){
 // The reservation helper checks applicant, approved pack, role and prior delivery state again.
 const{data:targetApp}=await db.from('applications').select('candidate_id,job_id').eq('company_id',profile.company_id).eq('id',appId).maybeSingle();const{data:pending}=targetApp?await db.from('candidate_submissions').select('id,status,delivery_id,submitted_at').eq('company_id',profile.company_id).eq('candidate_id',targetApp.candidate_id).eq('job_id',targetApp.job_id).eq('status','approved_to_send').is('delivery_id',null).limit(1).maybeSingle():{data:null};
 if(pending){
 const{error:repairError}=await db.rpc('repair_unsent_approved_candidate_delivery',{p_actor:user.id,p_application:appId,p_summary:summary,p_authorisation:authorisation,p_recipient:recipient});
 if(repairError)return json({error:repairError.message},409);
 }
}

const{data:res,error:re}=await db.rpc('reserve_client_submission_service',{p_actor:user.id,p_application:appId,p_summary:summary,p_authorisation:authorisation,p_recipient:recipient});
if(re)return json({error:re.message},400);
const submissionId=res?.submission_id;if(!submissionId)return json({error:'Submission reservation failed'},500);
const{data:s,error:se}=await db.from('candidate_submissions').select('id,company_id,candidate_id,job_id,client_id,delivery_id,status,recruiter_summary,recipient_email').eq('id',submissionId).single();
if(se||!s)return json({error:'Reserved submission could not be loaded'},500);
if(res?.existing===true&&b.force_resend===true){const{error:ue}=await db.from('candidate_submissions').update({recruiter_summary:summary,candidate_authorisation:authorisation,recipient_email:recipient,reviewed_by:user.id,review_confirmed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',submissionId);if(ue)return json({error:'Updated client-facing submission could not be saved'},500);s.recruiter_summary=summary;s.recipient_email=recipient;}
const [{data:c},{data:j},{data:cl},{data:d}]=await Promise.all([db.from('candidates').select('full_name,experience_summary,training_qualifications,authorisations').eq('id',s.candidate_id).single(),db.from('jobs').select('title').eq('id',s.job_id).single(),db.from('clients').select('company_name').eq('id',s.client_id).single(),db.from('outbound_deliveries').select('id,status,provider_message_id').eq('id',s.delivery_id).single()]);
if(!c||!j||!cl||!d)return json({error:'Submission dependencies could not be loaded'},500);
const{data:company}=await db.from('companies').select('name,legal_name').eq('id',s.company_id).single();const agencyName=company?.name||company?.legal_name||'Recruitment team';const{data:recruiter}=await db.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
if(s.status==='submitted'&&b.force_resend!==true)return json({ok:true,already_submitted:true,submission_id:s.id});
const reviewToken=crypto.randomUUID()+crypto.randomUUID().replaceAll('-','');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(reviewToken));const tokenHash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
await db.from('client_submission_review_tokens').update({revoked_at:new Date().toISOString()}).eq('submission_id',s.id).is('revoked_at',null);await db.from('client_submission_review_tokens').insert({submission_id:s.id,company_id:s.company_id,token_hash:tokenHash,expires_at:new Date(Date.now()+14*86400000).toISOString()});
const appUrl='https://www.vorlen.co.uk';const reviewUrl=`${appUrl}/review/${reviewToken}`;
const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('RESEND_FROM');if(!key||!from)return json({error:'Email delivery is not configured'},503);
const html=`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,Helvetica,sans-serif;color:#10201d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d"><div style="font-size:19px;font-weight:800;letter-spacing:4px;color:#fff">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">CANDIDATE INTRODUCTION</div></td></tr><tr><td style="padding:36px 34px"><p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hi,</p><h1 style="font-size:28px;line-height:1.15;margin:0 0 20px;color:#10201d">${esc(c.full_name)} for ${esc(j.title)}</h1><p style="font-size:15px;line-height:1.7;margin:0 0 24px">We have reviewed the application and would like to introduce this candidate for your consideration.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f5f8f6;border-left:3px solid #0b6b55"><tr><td style="padding:20px;font-size:14px;line-height:1.75"><strong>Candidate</strong><br>${esc(c.full_name)}<br><br><strong>Position</strong><br>${esc(j.title)}<br><br><strong>Experience</strong><br>${esc(c.experience_summary)}<br><br><strong>Training / qualifications</strong><br>${esc(c.training_qualifications)}<br><br><strong>Professional / legal authorisations</strong><br>${esc(c.authorisations)}</td></tr></table><p style="font-size:12px;font-weight:800;letter-spacing:1.2px;color:#0b6b55;margin:0 0 8px">RECRUITER SUMMARY</p><p style="font-size:15px;line-height:1.7;margin:0 0 22px">${esc(s.recruiter_summary)}</p><p style="font-size:14px;line-height:1.7;color:#50645d;margin:0 0 24px">The candidate has confirmed they are willing to be considered for this position and has authorised their profile and client-safe CV to be shared with ${esc(cl.company_name)} for this opportunity.</p><p style="margin:28px 0"><a href="${esc(reviewUrl)}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Review ${esc(c.full_name)}</a></p><p style="font-size:12px;line-height:1.6;color:#6a7b75;margin:0 0 28px">The secure review link is valid for 14 days. Candidate contact details and personal profile links are withheld in the client-safe view. Please coordinate contact through Vorlen.</p><p style="font-size:15px;line-height:1.7;margin:0">Kind regards,<br><strong>${esc(recruiter?.full_name||agencyName)}</strong><br>Vorlen</p></td></tr><tr><td style="padding:22px 34px;border-top:1px solid #e4ebe8;color:#6a7b75;font-size:11px;line-height:1.6">Vorlen · Vorlen Ltd · Company No. 17387520<br><a href="https://www.vorlen.co.uk" style="color:#0b6b55">www.vorlen.co.uk</a> · contact@vorlen.co.uk</td></tr></table></td></tr></table></body></html>`;
const resendId=String(b.resend_request_id||'').trim();if(b.force_resend===true&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resendId))return json({error:'A valid resend request ID is required'},400);
const idem=b.force_resend===true?`client-submission:${s.id}:resend:${resendId}`:`client-submission:${s.id}`;
const send=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify({from,to:[s.recipient_email],subject:`Candidate introduction: ${c.full_name} — ${j.title}`,html})});
const raw=await send.text();if(!send.ok)return json({error:'Client email could not be sent',provider_status:send.status},502);
let out:any={};try{out=JSON.parse(raw)}catch{}const now=new Date().toISOString();
await db.from('outbound_deliveries').update({status:'sent',provider_message_id:out.id||d.provider_message_id,sent_at:now,last_error:null}).eq('id',d.id);
await db.from('candidate_submissions').update({status:'submitted',submitted_at:now}).eq('id',s.id);await db.from('applications').update({status:'submitted'}).eq('id',appId);
return json({ok:true,submission_id:s.id,email_id:out.id||null,resent:b.force_resend===true});
}catch(e){return json({error:e instanceof Error?e.message:'Unable to submit candidate'},500)}});