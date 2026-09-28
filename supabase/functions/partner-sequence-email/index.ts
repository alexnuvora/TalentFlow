import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import {vorlenEmailShell,vorlenEmailBody,vorlenPlainText} from '../_shared/vorlen-email.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
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
  const{data:existingApproval}=await db.from('partner_email_approvals').select('id,status').eq('company_id',p.company_id).eq('partner_id',user.id).eq('task_id',task.id).in('status',['pending','sending']).maybeSingle();
  if(existingApproval)return json({ok:true,submitted:true,deduplicated:true,approval_id:existingApproval.id,message:'This sequence email is already awaiting management approval.'});
  const{data:approval,error:approvalError}=await db.from('partner_email_approvals').insert({company_id:p.company_id,partner_id:user.id,client_id:client.id,task_id:task.id,email_status:'follow_up',recipient,subject,message,status:'pending'}).select('id,status,submitted_at').single();
  if(approvalError||!approval)return json({error:'Could not submit sequence email for management approval.'},500);
  return json({ok:true,submitted:true,approval_id:approval.id,recipient,subject,message:'Sequence email submitted to Vorlen management for approval. Nothing has been sent to the client.'});
 }catch(e){
  return json({error:e instanceof Error?e.message:'Sequence email approval submission failed'},500);
 }
});
