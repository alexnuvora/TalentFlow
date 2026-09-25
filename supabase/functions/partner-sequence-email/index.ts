import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(v:string)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const shell=(subject:string,name:string,body:string)=>`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,sans-serif;color:#10201d"><table role="presentation" width="100%"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" style="max-width:620px;margin:auto;background:#fff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d;color:#fff"><div style="font-size:19px;font-weight:800;letter-spacing:4px">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">PERMANENT RECRUITMENT</div></td></tr><tr><td style="padding:36px 34px"><h1 style="margin:0 0 22px;font-size:24px">${esc(subject)}</h1><p style="font-size:15px;line-height:1.7">Hi ${esc(name||'there')},</p><p style="font-size:15px;line-height:1.7;white-space:pre-line">${esc(body)}</p><p style="margin:28px 0 0;font-size:15px;line-height:1.7">Kind regards,<br><strong>Vorlen</strong></p></td></tr><tr><td style="padding:22px 34px;border-top:1px solid #e4ebe8;color:#6a7b75;font-size:11px;line-height:1.6">Vorlen · VORLEN T/A IVY AND PEARLS LTD · Company No. 17387520<br>contact@vorlen.co.uk · <a href="https://www.vorlen.co.uk/privacy">Privacy notice</a><br>To stop recruitment-service marketing emails, reply “unsubscribe” or email contact@vorlen.co.uk.</td></tr></table></td></tr></table></body></html>`;

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const udb=createClient(url,anon,{global:{headers:{Authorization:auth}}}),db=createClient(url,service);
  const{data:{user}}=await udb.auth.getUser();if(!user)return json({error:'Authentication required'},401);
  const{data:p}=await udb.from('profiles').select('company_id,role,full_name').eq('id',user.id).maybeSingle();
  if(!p||p.role!=='partner')return json({error:'Partner access required'},403);
  const{data:active}=await udb.rpc('partner_is_active');if(active!==true)return json({error:'Partner activation required'},403);
  const body=await req.json(),taskId=String(body.task_id||'');
  if(!taskId)return json({error:'Task id required'},400);

  const{data:task}=await db.from('partner_tasks')
    .select('id,company_id,partner_id,client_id,title,description,status,outreach_channel,outreach_enrollment_id,outreach_step_index')
    .eq('id',taskId).eq('company_id',p.company_id).eq('partner_id',user.id).maybeSingle();
  if(!task)return json({error:'Sequence task not found'},404);
  if(task.status==='done')return json({ok:true,deduplicated:true});
  if(['cancelled'].includes(task.status))return json({error:'This sequence task is no longer active'},409);
  if(task.outreach_channel!=='email'||!task.outreach_enrollment_id)return json({error:'This is not an email sequence step'},400);

  const{data:enrollment}=await db.from('partner_outreach_enrollments')
    .select('id,status,contact_id,client_id,template_id')
    .eq('id',task.outreach_enrollment_id).eq('partner_id',user.id).eq('company_id',p.company_id).maybeSingle();
  if(!enrollment||enrollment.status!=='active')return json({error:'This outreach sequence is no longer active'},409);
  if(enrollment.client_id!==task.client_id)return json({error:'Sequence task scope mismatch'},409);

  const[{data:client},{data:contact},{data:supp}]=await Promise.all([
    db.from('clients').select('id,company_name,contact_name,email,phone,pecr_subscriber_type,email_marketing_basis,email_marketing_assessed_at,email_marketing_evidence').eq('id',task.client_id).eq('company_id',p.company_id).maybeSingle(),
    enrollment.contact_id?db.from('client_recruitment_contacts').select('id,name,email,communication_opt_out').eq('id',enrollment.contact_id).eq('client_id',task.client_id).eq('company_id',p.company_id).maybeSingle():Promise.resolve({data:null}),
    db.from('b2b_call_suppressions').select('id').eq('company_id',p.company_id).eq('client_id',task.client_id).limit(1).maybeSingle()
  ]);
  if(!client)return json({error:'Client not found'},404);
  if(supp)return json({error:'This client is marked do not contact. Email was not sent.'},409);
  if(contact?.communication_opt_out)return json({error:'This contact has opted out of communication.'},409);
  const marketingEvidence=String(client.email_marketing_evidence||'').trim();
  const marketingAllowed=!!client.email_marketing_assessed_at&&!!marketingEvidence&&(
    (client.pecr_subscriber_type==='corporate'&&['legitimate_interests','consent','solicited'].includes(client.email_marketing_basis))
    ||(client.pecr_subscriber_type==='individual'&&['consent','soft_opt_in','solicited'].includes(client.email_marketing_basis))
  );
  if(!marketingAllowed)return json({error:'Email marketing compliance has not been verified for this client. Record PECR subscriber type, lawful basis and evidence before sending.'},409);

  const recipient=String(contact?.email||client.email||'').trim().toLowerCase();
  const recipientName=String(contact?.name||client.contact_name||'there');
  if(!recipient)return json({error:'No email address is available for this sequence contact.'},400);

  const{data:emailSupp}=await db.from('b2b_call_suppressions').select('id').eq('company_id',p.company_id).eq('email_normalized',recipient).limit(1).maybeSingle();
  if(emailSupp)return json({error:'This email address is suppressed. Email was not sent.'},409);

  const subject=String(task.title||'Vorlen follow-up').trim().slice(0,300);
  const message=String(task.description||'Following up on our recent conversation.').trim().slice(0,10000);
  const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('RESEND_FROM')||'Vorlen <contact@vorlen.co.uk>';
  if(!key)return json({error:'Transactional email is not configured.'},503);

  const idempotencyKey='partner-sequence-email:'+task.id;
  const{data:existing}=await db.from('outbound_deliveries').select('id,status,provider_message_id,created_at').eq('company_id',p.company_id).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing?.status==='sent'){
    await db.from('partner_tasks').update({status:'done',completed_at:new Date().toISOString()}).eq('id',task.id).eq('partner_id',user.id);
    return json({ok:true,id:existing.provider_message_id,deduplicated:true});
  }
  if(existing?.status==='reserved'&&Date.now()-new Date(existing.created_at).getTime()<10*60*1000)return json({error:'This sequence email is already being sent.'},409);

  let deliveryId:string;
  if(existing){
    deliveryId=existing.id;
    const{data:claimed}=await db.from('outbound_deliveries').update({status:'reserved',last_error:null,recipient,payload:{task_id:task.id,enrollment_id:enrollment.id,subject},created_at:new Date().toISOString()}).eq('id',existing.id).eq('created_at',existing.created_at).select('id').maybeSingle();
    if(!claimed)return json({error:'This sequence email is already being sent.'},409);
  }else{
    const{data:reserved,error:reserveError}=await db.from('outbound_deliveries').insert({company_id:p.company_id,kind:'partner_sequence_email',idempotency_key:idempotencyKey,recipient,provider:'resend',status:'reserved',payload:{task_id:task.id,enrollment_id:enrollment.id,subject}}).select('id').single();
    if(reserveError||!reserved)return json({error:reserveError?.code==='23505'?'This sequence email is already being sent.':'Could not reserve email delivery'},reserveError?.code==='23505'?409:500);
    deliveryId=reserved.id;
  }

  let response:Response;
  try{
    response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[recipient],reply_to:'contact@vorlen.co.uk',subject,html:shell(subject,recipientName,message)})});
  }catch(e){
    await db.from('outbound_deliveries').update({status:'failed',last_error:e instanceof Error?e.message:'Network error'}).eq('id',deliveryId);
    return json({error:'Unable to reach the email provider.'},502);
  }
  const out=await response.json().catch(()=>({}));
  if(!response.ok){
    await db.from('outbound_deliveries').update({status:'failed',last_error:String(out?.message||'Email delivery failed')}).eq('id',deliveryId);
    return json({error:out?.message||'Email delivery failed'},502);
  }

  const now=new Date().toISOString();
  await db.from('outbound_deliveries').update({status:'sent',provider_message_id:out.id,sent_at:now,last_error:null}).eq('id',deliveryId);
  const{error:logError}=await udb.rpc('partner_log_communication',{p_client:client.id,p_event_type:'email',p_summary:'Sequence email sent: '+subject,p_channel:'email',p_direction:'outbound',p_contact:contact?.id||null,p_candidate:null,p_job:null,p_subject:subject,p_occurred_at:now,p_metadata:{provider:'resend',message_id:out.id,delivery_id:deliveryId,task_id:task.id,enrollment_id:enrollment.id}});
  if(logError)return json({error:'Email was sent but the account timeline could not be updated. Do not resend automatically.',email_id:out.id,detail:logError.message},500);
  const{error:taskError}=await db.from('partner_tasks').update({status:'done',completed_at:now}).eq('id',task.id).eq('partner_id',user.id).eq('company_id',p.company_id);
  if(taskError)return json({error:'Email was sent but the sequence task could not be completed. Do not resend automatically.',email_id:out.id,detail:taskError.message},500);
  return json({ok:true,id:out.id,recipient,subject});
 }catch(e){
  return json({error:e instanceof Error?e.message:'Sequence email failed'},500);
 }
});