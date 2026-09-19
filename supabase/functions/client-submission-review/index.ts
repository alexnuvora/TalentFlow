import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(url,service);
 const u=new URL(req.url),body=req.method==='POST'?await req.json().catch(()=>({})):{};const token=String(body.token||u.searchParams.get('token')||'').trim();
 if(token.length<32)return json({error:'This review link is invalid.'},401);
 const tokenHash=await hash(token);
 const{data:t}=await db.from('client_submission_review_tokens').select('*').eq('token_hash',tokenHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(!t)return json({error:'This review link has expired or been revoked.'},401);
 const{data:s}=await db.from('candidate_submissions').select('id,company_id,client_id,job_id,candidate_id,application_id,recruiter_summary,status,client_feedback,client_decision,submitted_at').eq('id',t.submission_id).eq('company_id',t.company_id).single();
 if(!s)return json({error:'Candidate submission is unavailable.'},404);
 if(req.method==='POST'&&body.action){
   const action=String(body.action),feedback=String(body.feedback||'').trim().slice(0,5000);
   const status=action==='request_interview'?'interview_requested':action==='progress'?'client_approved':action==='reject'?'client_rejected':action==='feedback'?s.status:null;
   if(!status)return json({error:'Invalid review action.'},400);
   const patch:any={status,client_feedback:feedback||s.client_feedback,client_feedback_at:feedback?new Date().toISOString():null,updated_at:new Date().toISOString()};
   if(action!=='feedback'){patch.client_decision=action;patch.client_decision_at=new Date().toISOString();patch.reviewed_at=new Date().toISOString()}
   await db.from('candidate_submissions').update(patch).eq('id',s.id);
   if(s.application_id&&action!=='feedback'){const ast=action==='request_interview'?'interview_requested':action==='progress'?'client_approved':'rejected';await db.from('applications').update({status:ast}).eq('id',s.application_id).eq('company_id',s.company_id)}
   return json({ok:true,status});
 }
 const [{data:c},{data:j},{data:cl},{data:co}]=await Promise.all([
  db.from('candidates').select('full_name,location,resume_path,cv_url').eq('id',s.candidate_id).single(),
  db.from('jobs').select('title,location,employment_type').eq('id',s.job_id).single(),
  db.from('clients').select('company_name').eq('id',s.client_id).single(),
  db.from('companies').select('name,legal_name').eq('id',s.company_id).single()
 ]);
 let cvUrl:string|null=null;if(c?.resume_path){for(const bucket of ['resumes','cvs','candidate-cvs']){const{data}=await db.storage.from(bucket).createSignedUrl(c.resume_path,900,{download:true});if(data?.signedUrl){cvUrl=data.signedUrl;break}}}else if(c?.cv_url)cvUrl=c.cv_url;
 await db.from('client_submission_review_tokens').update({last_viewed_at:new Date().toISOString()}).eq('id',t.id);
 return json({submission:{id:s.id,status:s.status,recruiter_summary:s.recruiter_summary,client_feedback:s.client_feedback,client_decision:s.client_decision,submitted_at:s.submitted_at},candidate:{full_name:c?.full_name,location:c?.location,cv_url:cvUrl},job:j,client:cl,agency:{name:co?.name||co?.legal_name||'Recruitment team'}});
}catch(e){return json({error:e instanceof Error?e.message:'Unable to open candidate review.'},500)}});