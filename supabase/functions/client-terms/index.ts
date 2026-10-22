import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const enc=new TextEncoder();const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const bespokeTerms=(c:any,company:any,b:any)=>`VORLEN LTD — BESPOKE TERMS OF BUSINESS
Version: ${b.version}
Agency: ${company.legal_name||company.name} (trading as Vorlen)
Company registration: ${company.company_registration_number}
Registered address: ${company.legal_address||'As registered with Companies House'}
Client legal entity: ${c.company_name}
Scope: up to four initial commission-only telesales representatives.

1. ENGAGEMENT AND SERVICES
Vorlen will use reasonable care to source, screen and introduce suitable candidates for commission-only telesales roles agreed with Azimis. Azimis controls selection and the candidate's employment or engagement terms and must confirm the commission structure, employment status, working hours, expected duties and remuneration arrangements in writing before sourcing.

2. FIXED RECRUITMENT FEE
The Client agrees to pay Vorlen £500 (FIVE HUNDRED POUNDS) per successfully placed candidate, plus VAT where applicable. A placement occurs when an introduced candidate actually starts employment or another agreed engagement with Azimis. No fee is payable merely for an introduction if the candidate does not start. The initial scope covers up to four placements (total £2,000 if all four commence), with further placements at £500 each unless otherwise agreed in writing.

3. PAYMENT TRIGGER AND TIMING
Each £500 recruitment fee becomes earned and payable IMMEDIATELY on the placed candidate's first working day. Vorlen will issue a corresponding invoice. Payment is not conditional on the candidate making a sale, meeting targets, earning commission or receiving commission from Azimis. No recruitment fee is payable before the candidate's first working day.

4. NO REBATE OR REPLACEMENT
Once the candidate commences work, the recruitment fee is non-refundable. No rebate, refund, free replacement or retention guarantee is offered if the candidate resigns, is dismissed, fails sales targets or stops working. This provision does not exclude mandatory legal rights or remedies for Vorlen's material breach, fraud or other liabilities that cannot lawfully be excluded.

5. CLIENT DUTIES AND COMPLIANCE
Azimis is responsible for providing accurate vacancy particulars, conducting final interviews, determining lawful employment or engagement status, verifying right to work and performing other applicable employer checks. Both parties will comply with applicable UK recruitment, employment and data-protection law. Any commission-only arrangements must comply with applicable minimum wage and worker-rights obligations where relevant.

6. CONFIDENTIALITY AND CANDIDATE DATA
Candidate details and CVs are confidential and may be used solely for recruitment for the relevant position. Neither party will disclose unnecessary personal data to unauthorised third parties.

7. AGREED FEES AND CHANGES
The £500 fee per successful placement and the payment and refund conditions stated in this agreement apply to the telesales roles covered by it. Any change to these terms must be agreed in writing by authorised representatives of both parties.

8. GOVERNING LAW
Law of England and Wales. Nothing excludes liability that cannot lawfully be excluded.

9. ACCEPTANCE
By selecting 'Accept Terms of Business' and entering their name, an authorised representative of Crypty Ltd trading as AZIMIS confirms authority to bind Crypty Ltd and accepts the exact version and commercial terms presented. Acceptance is recorded with a date and audit evidence.`;
const emailShell=(title:string,body:string)=>`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,Helvetica,sans-serif;color:#10201d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d"><div style="font-size:19px;font-weight:800;letter-spacing:4px;color:#fff">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">CLIENT TERMS</div></td></tr><tr><td style="padding:36px 34px"><h1 style="margin:0 0 22px;font-size:27px;line-height:1.15;color:#10201d">${title}</h1>${body}</td></tr><tr><td style="padding:22px 34px;border-top:1px solid #e4ebe8;color:#6a7b75;font-size:11px;line-height:1.6">Vorlen Ltd · Company No. 17387520 · Registered in England and Wales · Rochdale, OL16 2EP<br><a href="https://www.vorlen.co.uk" style="color:#0b6b55">www.vorlen.co.uk</a> · billing@vorlen.co.uk</td></tr></table></td></tr></table></body></html>`;
const terms=(c:any,company:any,v:string)=>`VORLEN TERMS OF BUSINESS — ${v}
DRAFT COMMERCIAL TERMS FOR CLIENT ACCEPTANCE

Agency: ${company.legal_name||company.name} (trading as Vorlen)
Company number: ${company.company_registration_number}
Registered office: ${company.legal_address||'Confirm registered office address before issue'}
Registered in: England and Wales
Client: ${c.company_name}
Nature of business: ${c.business_nature||'Not recorded'}

1. DEFINITIONS AND SCOPE
1.1 "Agency" means the supplier named above; "Client" means the hirer named above; "Candidate" means a person whose identifying information or candidacy the Agency introduces; "Introduction" means provision of candidate identifying details, CV or interview arrangement by the Agency; "Engagement" includes direct or indirect employment or engagement by the Client or an associated company.
1.2 These terms govern permanent recruitment introductions only. Temporary-worker supply, contractor engagement and other services require separate written terms.

2. APPOINTMENT AND CLIENT RESPONSIBILITIES
2.1 The Agency will use reasonable care to identify and introduce potentially suitable candidates but does not warrant a successful appointment or continued service.
2.2 The Client controls recruitment decisions, must provide accurate vacancy, remuneration and working-condition information and must undertake checks required of an employer, including right to work, references and safeguarding/DBS checks where applicable.
2.3 The Client must notify the Agency in writing promptly of an offer, acceptance, start date, remuneration and any subsequent Engagement of an introduced Candidate.

3. INTRODUCTION FEE AND REMUNERATION
3.1 The introduction fee is ${c.recruitment_fee_percent}% of the Candidate's gross annual BASIC salary at the start of employment (excluding discretionary bonuses, commission, overtime, allowances, sleep-in payments, benefits in kind and employer pension contributions), unless otherwise expressly agreed in a signed client-specific fee schedule.
3.2 VAT is payable in addition at the rate required by law. If salary is not stated annually, the parties will agree a documented annualised basic-salary equivalent before an Engagement.
3.3 The fee becomes earned when the Candidate starts an Engagement following an Introduction. An Engagement by an associated business or through an intermediary is covered where legally enforceable, subject to any signed variation.
3.4 Where a fee is disputed, the Client shall promptly identify the disputed amount and reasons in writing; undisputed amounts remain due.

4. INVOICING AND PAYMENT
4.1 The Agency will issue its invoice on or shortly after the Candidate's first day of employment. Payment is due within ${c.payment_terms_days} CALENDAR DAYS of the invoice date.
4.2 Payments shall be made in pounds sterling by bank transfer to the details on a valid Agency invoice. Statutory late-payment interest and recovery costs may apply where permitted by law.
4.3 Neither a rebate request nor a recruitment complaint suspends the obligation to pay an undisputed invoice when due.

5. REBATE GUARANTEE
5.1 Subject to this clause and any signed variation, the agreed rebate schedule is: ${c.rebate_terms||'No rebate schedule agreed.'}
5.2 The relevant day count starts on the Candidate's first calendar day of employment. Day 1 is that date. A departure on days 1–28 qualifies for 100%, days 29–42 for 50%, days 43–84 for 25%; on or after day 85, no rebate is available, unless a different schedule is expressly agreed in writing.
5.3 Rebate applies to the Agency introduction fee actually paid, excluding VAT, and is not a refund of employment salary, costs or third-party expenses. Where applicable the Agency will issue a credit note and adjust VAT.
5.4 To claim, the Client must notify the Agency in writing within SEVEN CALENDAR DAYS after the Candidate's final day of employment, stating the departure date and reason, and provide reasonably requested corroboration.
5.5 The rebate is conditional on payment of the Agency's undisputed invoice within the agreed due period. A material payment dispute raised in good faith must be considered fairly rather than automatically forfeiting the guarantee.
5.6 No rebate is payable where departure is materially caused by redundancy, restructuring, a material change to role, location, remuneration or working conditions, unlawful treatment, or a material breach by the Client. Rebate otherwise applies to an early resignation or termination for genuine performance, conduct or suitability reasons.
5.7 The Client shall not unreasonably withhold information needed to assess eligibility. No duplicate rebate and replacement remedy applies to the same placement unless separately agreed in writing.

6. CONFIDENTIALITY, DATA PROTECTION AND CANDIDATE OWNERSHIP
6.1 CVs, interview information and candidate details are confidential, to be used only for lawful recruitment purposes, and may not be shared outside the Client's legitimate hiring team except as necessary and permitted by law.
6.2 Both parties must comply with applicable UK data-protection law and take appropriate security and retention measures. Each party's responsibilities and lawful basis shall be assessed according to its actual processing role.
6.3 The Client shall disclose if it already has an active, evidenced recruitment relationship with an introduced Candidate. The parties will resolve any fee dispute using dated documentary evidence.

7. LIABILITY AND LEGAL COMPLIANCE
7.1 Each party is responsible for its own legal obligations. Nothing excludes liability for fraud, fraudulent misrepresentation, death or personal injury caused by negligence, or any liability that cannot lawfully be excluded.
7.2 Subject to clause 7.1, any cap on liability, exclusion of consequential loss, indemnity or particular remedy must be agreed separately in clear written terms; no additional exclusion is implied by this document.

8. VARIATIONS, ENTIRE AGREEMENT AND GOVERNING LAW
8.1 These terms together with any signed client-specific commercial schedule comprise the agreement for permanent recruitment introductions. A variation must be agreed in writing by authorised representatives.
8.2 Existing accepted terms and historical placement obligations are not retrospectively amended by a newer standard template.
8.3 This agreement is governed by the law of England and Wales and courts of England and Wales have jurisdiction, subject to mandatory law.

9. ACCEPTANCE
By selecting "Accept Terms of Business", an authorised representative confirms authority to bind the Client and accepts the exact dated version and commercial values presented, which are retained in an immutable acceptance snapshot.

Privacy: ${company.privacy_email||'privacy@vorlen.co.uk'}
Billing: ${company.billing_email||'billing@vorlen.co.uk'}`;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(url,service);
 try{
  const u=new URL(req.url); const token=u.searchParams.get('token')||''; const action=u.searchParams.get('action')||'';
  if(req.method==='GET'&&token){const h=await sha(token);const{data:d}=await db.from('client_terms_documents').select('id,version,status,terms_text,recipient_name,recipient_email,token_expires_at,client_id,clients(company_name)').eq('public_token_hash',h).maybeSingle();if(!d||!d.token_expires_at||new Date(d.token_expires_at)<=new Date()||!['sent','viewed'].includes(d.status))return json({error:'This Terms of Business link is invalid or has expired.'},410);if(d.status==='sent')await db.from('client_terms_documents').update({status:'viewed',viewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',d.id);return json({document:{...d,public_token_hash:undefined}})}
  if(req.method==='POST'&&token&&action==='accept'){const h=await sha(token),body=await req.json();const{data:d}=await db.from('client_terms_documents').select('id,status,token_expires_at').eq('public_token_hash',h).maybeSingle();if(!d||!d.token_expires_at||new Date(d.token_expires_at)<=new Date()||!['sent','viewed'].includes(d.status))return json({error:'This Terms of Business link is invalid, expired or already completed.'},409);const name=String(body.name||'').trim();if(name.length<2||body.confirm!==true)return json({error:'Name and explicit acceptance are required.'},400);const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||null,ua=req.headers.get('user-agent');const{data:accepted,error}=await db.rpc('service_accept_client_terms',{p_document:d.id,p_name:name,p_ip:ip,p_user_agent:ua});if(error){const msg=error.message||'Terms acceptance could not be completed.';const conflict=/already been completed|expired/i.test(msg);return json({error:msg},conflict?409:500)}return json(accepted||{ok:true})}
  const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return json({error:'Unauthorized'},401);const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});const{data:{user}}=await userClient.auth.getUser();if(!user)return json({error:'Unauthorized'},401);const{data:p}=await db.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();if(!p)return json({error:'Forbidden'},403);
  const body=await req.json();if(body.action!=='send')return json({error:'Unsupported action'},400);
  let partnerSend=false;
  if(p.role==='partner'){
    const[{data:pp},{data:o},{data:a}]=await Promise.all([
      db.from('partner_profiles').select('specialism,active').eq('user_id',user.id).eq('company_id',p.company_id).maybeSingle(),
      db.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',p.company_id).maybeSingle(),
      db.from('partner_assignments').select('id').eq('partner_id',user.id).eq('company_id',p.company_id).eq('client_id',body.client_id).is('completed_at',null).limit(1).maybeSingle()
    ]);
    partnerSend=!!pp?.active&&o?.status==='active'&&['lead_closer','hybrid'].includes(pp?.specialism||'')&&!!a;
  }
  if(!['owner','manager'].includes(p.role)&&!partnerSend)return json({error:'Only an assigned Lead Closer or Hybrid Partner may send manager-authorised client terms.'},403);
  const{data:c}=await db.from('clients').select('*').eq('id',body.client_id).eq('company_id',p.company_id).maybeSingle();if(!c)return json({error:'Client not found'},404);if(c.terms_accepted_at)return json({error:'The client has already accepted the current Terms of Business. Clear/supersede the acceptance and prepare revised terms before sending another version.'},409);const{data:bespoke}=await db.from('client_bespoke_commercial_terms').select('*').eq('client_id',c.id).eq('company_id',p.company_id).in('status',['approved_internal','sent']).order('created_at',{ascending:false}).limit(1).maybeSingle();if(!c.email||!c.contact_name||!c.business_nature||(!bespoke&&(!c.recruitment_fee_percent||!c.payment_terms_days||!c.rebate_terms)))return json({error:'Complete the client identity, email and relevant commercial terms before sending.'},400);const emailNorm=String(c.email||'').trim().toLowerCase(),phoneNorm=String(c.phone||'').replace(/[^0-9]/g,'');const[{data:clientSupp},{data:emailSupp},{data:phoneSupp},{data:dncActivity}]=await Promise.all([db.from('b2b_call_suppressions').select('id').eq('company_id',p.company_id).eq('client_id',c.id).limit(1).maybeSingle(),emailNorm?db.from('b2b_call_suppressions').select('id').eq('company_id',p.company_id).eq('email_normalized',emailNorm).limit(1).maybeSingle():Promise.resolve({data:null}),phoneNorm?db.from('b2b_call_suppressions').select('id').eq('company_id',p.company_id).eq('phone_normalized',phoneNorm).limit(1).maybeSingle():Promise.resolve({data:null}),db.from('partner_client_activity').select('id').eq('company_id',p.company_id).eq('client_id',c.id).eq('status','do_not_contact').limit(1).maybeSingle()]);if(clientSupp||emailSupp||phoneSupp||dncActivity)return json({error:'This client is marked do not contact. Terms were not sent.'},409);
  if(partnerSend){
    const{data:allowed,error:allowError}=await userClient.rpc('partner_terms_send_allowed',{p_client:c.id});
    if(allowError||allowed!==true)return json({error:'Vorlen management must authorise the current commercial terms before a partner can send them.'},403);
  }
  const{data:reserved,error:reserveError}=await db.rpc('service_reserve_client_terms_send',{p_client:c.id,p_seconds:120});if(reserveError)return json({error:'Could not reserve the Terms of Business send.',detail:reserveError.message},500);if(reserved!==true)return json({error:'A Terms of Business send is already in progress for this client. Please wait a moment before retrying.'},409);
  const releaseReservation=async()=>{await db.rpc('service_release_client_terms_send',{p_client:c.id})};
  const{data:company,error:companyError}=await db.from('companies').select('name,legal_name,company_registration_number,legal_address,privacy_email,billing_email,trading_name').eq('id',p.company_id).single();if(companyError||!company){await releaseReservation();return json({error:'Company configuration could not be loaded.',detail:companyError?.message||'Company not found'},500)}
  const version=bespoke?.version||'client-tob-2026-10-15';const text=bespoke?bespokeTerms(c,company,bespoke):terms(c,company,version);const hash=await sha(text);const raw=crypto.randomUUID()+crypto.randomUUID().replaceAll('-','');const th=await sha(raw),expires=new Date(Date.now()+7*864e5).toISOString();
  const{data:d,error}=await db.from('client_terms_documents').insert({company_id:p.company_id,client_id:c.id,version,status:'draft',terms_snapshot:bespoke?{company_name:c.company_name,fee_model:'flat_fee',flat_fee:bespoke.fee_amount_gbp,payment_terms_days:bespoke.due_days,non_refundable:true,rebate_available:false,replacement_guarantee:false,bespoke_terms_id:bespoke.id}:{company_name:c.company_name,business_nature:c.business_nature,recruitment_fee_percent:c.recruitment_fee_percent,payment_terms_days:c.payment_terms_days,rebate_terms:c.rebate_terms},terms_text:text,content_hash:hash,recipient_name:c.contact_name,recipient_email:c.email,public_token_hash:th,token_expires_at:expires,created_by:user.id}).select().single();if(error){await releaseReservation();return json({error:error.message},500)}
  const app='https://www.vorlen.co.uk';const link=`${app}/terms/accept?token=${encodeURIComponent(raw)}`;const key=Deno.env.get('RESEND_API_KEY');if(!key){await releaseReservation();return json({error:'Transactional email is not configured.'},503)}
  let er:Response;try{er=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:'Vorlen <contact@vorlen.co.uk>',to:[c.email],reply_to:company.billing_email||'billing@vorlen.co.uk',subject:`Vorlen Terms of Business — ${c.company_name}`,html:emailShell('Terms of Business for '+esc(c.company_name),`<p style="margin:0 0 18px;font-size:15px;line-height:1.7">Dear ${esc(c.contact_name)},</p><p style="margin:0 0 24px;font-size:15px;line-height:1.7">Please review the Vorlen Terms of Business and the commercial terms recorded for ${esc(c.company_name)}.</p><p style="margin:26px 0"><a href="${link}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Review and accept terms</a></p><p style="margin:0;color:#667972;font-size:13px;line-height:1.6">This secure link expires in 7 days. If anything needs changing, reply before accepting the terms.</p>`)})})}catch(e){await releaseReservation();return json({error:'Unable to reach the transactional email provider.',detail:e instanceof Error?e.message:'Network error'},502)}
  const ej=await er.json().catch(()=>({}));if(!er.ok){await releaseReservation();const detail=ej?.message||ej?.name||'Email provider rejected the request';return json({error:'Unable to send Terms of Business email.',detail},er.status>=400&&er.status<500?424:502)}
  let{data:finalised,error:finaliseError}=await db.rpc('service_finalize_client_terms_send',{p_document:d.id,p_resend_message_id:ej.id||null});if(finaliseError){const retry=await db.rpc('service_finalize_client_terms_send',{p_document:d.id,p_resend_message_id:ej.id||null});finalised=retry.data;finaliseError=retry.error}
  if(finaliseError)return json({error:'Terms email was sent but the send record could not be finalised. Do not resend automatically; review the delivery record.',detail:finaliseError.message,document_id:d.id,email_id:ej.id||null},500);
  if(bespoke)await db.from('client_bespoke_commercial_terms').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',bespoke.id).eq('status','approved_internal');return json({ok:true,document_id:d.id,expires_at:expires,sent_at:finalised?.sent_at||null});
 }catch(e){return json({error:e instanceof Error?e.message:'Unexpected error'},500)}
});