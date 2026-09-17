import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
 const authorization=req.headers.get('Authorization');if(!authorization)return json({error:'Sign in required'},401);
 const userDb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error:authError}=await userDb.auth.getUser();if(authError||!user)return json({error:'Sign in required'},401);
 const b=await req.json(),key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('RESEND_FROM');
 if(!key||!from||from.includes('onboarding@resend.dev'))return json({error:'Configure a verified sender before client submissions'},503);
 if(b.review_confirmed!==true)return json({error:'Review the submission first'},400);
 const {data:r,error}=await userDb.rpc('reserve_client_submission',{p_application:b.application_id,p_summary:b.summary,p_authorisation:b.candidate_authorisation,p_recipient:b.recipient_email});
 if(error)return json({error:error.message},400);
 if(r.existing)return r.status==='submitted'?json({ok:true,already_submitted:true}):json({error:'This submission already has a delivery attempt. Check delivery history before retrying.'},409);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const marked=await db.from('outbound_deliveries').update({status:'sending'}).eq('id',r.delivery_id);if(marked.error)throw marked.error;
 try{
 const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`submission:${b.application_id}`},body:JSON.stringify({from,to:[r.recipient],subject:r.subject,text:r.body})});
 if(!response.ok)throw new Error(`Email provider returned ${response.status}; reconcile delivery before retrying`);
 const sent=await response.json();if(!sent.id)throw new Error('Provider acceptance could not be confirmed');
 const d=await db.from('outbound_deliveries').update({status:'sent',provider_message_id:sent.id,sent_at:new Date().toISOString()}).eq('id',r.delivery_id);if(d.error)throw d.error;
 const s=await db.from('candidate_submissions').update({status:'submitted',submitted_at:new Date().toISOString()}).eq('id',r.submission_id);if(s.error)throw s.error;
 const a=await db.from('applications').update({status:'submitted'}).eq('id',b.application_id).eq('company_id',r.company_id);if(a.error)throw a.error;
 return json({ok:true,submission_id:r.submission_id,email_id:sent.id});
 }catch(e){await db.from('outbound_deliveries').update({last_error:'Delivery outcome requires manual reconciliation; do not resend automatically'}).eq('id',r.delivery_id);throw e;}
 }catch(e){return json({error:e instanceof Error?e.message:'Submission failed'},500)}
});
