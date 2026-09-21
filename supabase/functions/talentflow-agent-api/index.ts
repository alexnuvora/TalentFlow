import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {corsHeaders} from 'npm:@supabase/supabase-js@2.95.0/cors';

const cors={...corsHeaders,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[-0-9a-f]{36}$/i.test(v);
const str=(v:unknown,n=500)=>typeof v==='string'?v.trim().slice(0,n):'';

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization');
  if(!auth?.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)return json({error:'Server configuration error'},503);
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await userDb.auth.getUser();
  if(ue||!user)return json({error:'Authentication required'},401);
  const db=createClient(url,service);
  const {data:profile}=await db.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
  if(!profile?.company_id||!['owner','manager','recruiter'].includes(profile.role))return json({error:'Staff access required'},403);
  const{data:candidateAllowed}=await db.rpc('candidate_processing_allowed',{p_company_id:profile.company_id});
  const b=await req.json().catch(()=>({}));
  const action=str(b.action,80);
  const args=b.args&&typeof b.args==='object'?b.args:{};
  const company_id=profile.company_id;
  const log=async(detail:string)=>{await db.from('activity_log').insert({company_id,actor_id:user.id,event_type:'agent_api_action',detail:detail.slice(0,1000)}).then(()=>{});};
  if(action==='search_clients'){
   const q=str(args.query,120);let x=db.from('clients').select('id,company_name,contact_name,email,phone,website,status,created_at').eq('company_id',company_id).limit(25);
   if(q)x=x.or(`company_name.ilike.%${q.replace(/[%_,()]/g,'')}%,contact_name.ilike.%${q.replace(/[%_,()]/g,'')}%,email.ilike.%${q.replace(/[%_,()]/g,'')}%`);
   const {data,error}=await x;if(error)throw error;return json({data});
  }
  if(action==='search_jobs'){
   const q=str(args.query,120);let x=db.from('jobs').select('*').eq('company_id',company_id).limit(25);
   if(q)x=x.ilike('title',`%${q.replace(/[%_]/g,'')}%`);
   const {data,error}=await x;if(error)throw error;return json({data});
  }
  if(action==='search_candidates'){
   if(candidateAllowed!==true)return json({error:'Candidate processing is disabled'},409);
   const q=str(args.query,120);let x=db.from('candidates').select('id,full_name,email,phone,location,stage,score,source,recruiter_summary,next_action,next_action_at,created_at').eq('company_id',company_id).limit(25);
   if(q)x=x.or(`full_name.ilike.%${q.replace(/[%_,()]/g,'')}%,email.ilike.%${q.replace(/[%_,()]/g,'')}%`);
   const {data,error}=await x;if(error)throw error;return json({data});
  }
  if(action==='create_client'){
   if(!['owner','manager'].includes(profile.role))return json({error:'Manager access required'},403);
   const payload={company_id,company_name:str(args.company_name,200),contact_name:str(args.contact_name,200)||null,email:str(args.email,320)||null,phone:str(args.phone,80)||null,website:str(args.website,500)||null,status:str(args.status,50)||'prospect'};
   if(!payload.company_name)return json({error:'company_name required'},400);
   const {data,error}=await db.from('clients').insert(payload).select().single();if(error)throw error;await log(`create_client:${data.id}`);return json({data},201);
  }
  if(action==='create_candidate'){
   if(candidateAllowed!==true)return json({error:'Candidate processing is disabled'},409);
   const payload={company_id,full_name:str(args.full_name,200),email:str(args.email,320)||null,phone:str(args.phone,80)||null,location:str(args.location,200)||null,source:str(args.source,100)||'agent',recruiter_summary:str(args.recruiter_summary,1000)||null};
   if(!payload.full_name)return json({error:'full_name required'},400);
   const {data,error}=await db.from('candidates').insert(payload).select().single();if(error)throw error;await log(`create_candidate:${data.id}`);return json({data},201);
  }
  if(action==='create_application'){
   if(candidateAllowed!==true)return json({error:'Candidate processing is disabled'},409);
   if(!uuid(args.candidate_id)||!uuid(args.job_id))return json({error:'valid candidate_id and job_id required'},400);
   const {data:job}=await db.from('jobs').select('id').eq('id',args.job_id).eq('company_id',company_id).maybeSingle();
   const {data:candidate}=await db.from('candidates').select('id').eq('id',args.candidate_id).eq('company_id',company_id).maybeSingle();
   if(!job||!candidate)return json({error:'Job or candidate not found'},404);
   const {data,error}=await db.from('applications').insert({company_id,job_id:job.id,candidate_id:candidate.id,status:str(args.status,50)||'applied'}).select().single();if(error)throw error;await log(`create_application:${data.id}`);return json({data},201);
  }
  if(action==='record_activity'){
   const detail=str(args.detail,1000);if(!detail)return json({error:'detail required'},400);
   const payload:any={company_id,actor_id:user.id,event_type:str(args.event_type,80)||'agent_note',detail};
   if(uuid(args.candidate_id))payload.candidate_id=args.candidate_id;if(uuid(args.job_id))payload.job_id=args.job_id;
   const {data,error}=await db.from('activity_log').insert(payload).select().single();if(error)throw error;return json({data},201);
  }
  return json({error:'Unknown action'},400);
 }catch(e){console.error('talentflow-agent-api',e);return json({error:e instanceof Error?e.message:'Agent API failed'},500)}
});