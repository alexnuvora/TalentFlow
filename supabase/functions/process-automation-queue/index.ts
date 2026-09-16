import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const esc=(v:string)=>v.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...cors,'Content-Type':'application/json','Allow':'POST'}});
  const secret=Deno.env.get('AUTOMATION_CRON_SECRET');
  if(!secret)throw new Error('AUTOMATION_CRON_SECRET is not configured');
  if(req.headers.get('x-automation-secret')!==secret)throw new Error('Invalid automation secret');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now=new Date().toISOString();
  const {data:rows,error}=await db.from('automation_enrollments').select('*, automation_sequences(id,name,channel,provider,from_name,from_address,steps), candidates(full_name,email), applications(jobs(title))').eq('status','queued').lte('next_run_at',now).order('next_run_at').limit(25);
  if(error) throw error;
  const results=[];
  for(const row of rows||[]){
   const seq=row.automation_sequences; const step=Array.isArray(seq?.steps)?seq.steps[row.current_step]:null; if(!step){await db.from('automation_enrollments').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',row.id);continue;}
   const firstName=String(row.candidates?.full_name||'Candidate').split(' ')[0]; const jobTitle=row.applications?.jobs?.title||'the opportunity';
   const render=(v:string)=>String(v||'').replaceAll('{{first_name}}',esc(firstName)).replaceAll('{{job_title}}',esc(jobTitle));
   try{
    const subject=render(step.subject||`Update from the recruitment team`); const body=render(step.body||'');
    if(seq.channel==='email'){const key=Deno.env.get('RESEND_API_KEY');if(!key)throw new Error('RESEND_API_KEY is not configured');const from=seq.from_address?`${seq.from_name||'Recruitment'} <${seq.from_address}>`:Deno.env.get('RESEND_FROM')||'Recruitment <onboarding@resend.dev>';const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[row.candidates.email],subject,html:`<div style="font-family:Arial,sans-serif;line-height:1.6">${body.replaceAll('\n','<br>')}</div>`})});if(!r.ok)throw new Error(`Resend ${r.status}`)}
    else {const sid=Deno.env.get('TWILIO_ACCOUNT_SID'),token=Deno.env.get('TWILIO_AUTH_TOKEN'),from=seq.channel==='whatsapp'?Deno.env.get('TWILIO_WHATSAPP_FROM'):Deno.env.get('TWILIO_SMS_FROM');if(!sid||!token||!from)throw new Error('Twilio is not configured');const {data:c}=await db.from('candidates').select('phone').eq('id',row.candidate_id).single();if(!c?.phone)throw new Error('Candidate has no phone number');const to=seq.channel==='whatsapp'&&!String(c.phone).startsWith('whatsapp:')?`whatsapp:${c.phone}`:c.phone;const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${sid}:${token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:to,From:from,Body:`${subject}\n\n${body}`})});if(!r.ok)throw new Error(`Twilio ${r.status}`)}
    const next=row.current_step+1; const nextStep=Array.isArray(seq.steps)?seq.steps[next]:null; await db.from('automation_enrollments').update({current_step:next,status:nextStep?'queued':'completed',next_run_at:nextStep?new Date(Date.now()+Math.max(0,Number(nextStep.delay_hours||0))*3600000).toISOString():new Date().toISOString(),attempts:0,last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id); results.push({id:row.id,status:nextStep?'queued':'completed'});
   }catch(e){const attempts=Number(row.attempts||0)+1;await db.from('automation_enrollments').update({attempts,last_error:e instanceof Error?e.message:'Send failed',status:attempts>=3?'failed':'queued',next_run_at:new Date(Date.now()+Math.min(24,2**attempts)*3600000).toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id);results.push({id:row.id,status:'retry',error:e instanceof Error?e.message:'Send failed'});}
  }
  return new Response(JSON.stringify({ok:true,processed:results.length,results}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Queue processing failed'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});
