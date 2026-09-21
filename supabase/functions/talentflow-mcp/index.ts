import {createClient} from 'npm:@supabase/supabase-js@2.95.0';

const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const rpc=(id:unknown,result:unknown,status=200)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{status,headers});
const err=(id:unknown,code:number,message:string,status=200)=>new Response(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}}),{status,headers});
const clean=(v:unknown,n=500)=>typeof v==='string'?v.trim().slice(0,n):'';
const safe=(v:string)=>v.replace(/[%_,()]/g,'');
const uuid=(v:unknown)=>typeof v==='string'&&/^[-0-9a-f]{36}$/i.test(v);

const tools=[
 {name:'search_clients',description:'Search Vorlen clients and prospects in the authenticated workspace.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false}},
 {name:'search_jobs',description:'Search jobs in the authenticated Vorlen workspace.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false}},
 {name:'search_candidates',description:'Search candidates in the authenticated Vorlen workspace.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false}},
 {name:'create_client',description:'Create a client/prospect. Requires owner or manager role.',inputSchema:{type:'object',required:['company_name'],properties:{company_name:{type:'string'},contact_name:{type:'string'},email:{type:'string'},phone:{type:'string'},website:{type:'string'},status:{type:'string'}},additionalProperties:false}},
 {name:'create_candidate',description:'Create a candidate record in Vorlen.',inputSchema:{type:'object',required:['full_name'],properties:{full_name:{type:'string'},email:{type:'string'},phone:{type:'string'},location:{type:'string'},source:{type:'string'},recruiter_summary:{type:'string'}},additionalProperties:false}},
 {name:'create_application',description:'Attach a candidate to a job as an application.',inputSchema:{type:'object',required:['candidate_id','job_id'],properties:{candidate_id:{type:'string'},job_id:{type:'string'},status:{type:'string'}},additionalProperties:false}},
 {name:'record_activity',description:'Record an audited Vorlen activity/note.',inputSchema:{type:'object',required:['detail'],properties:{detail:{type:'string'},event_type:{type:'string'},candidate_id:{type:'string'},job_id:{type:'string'}},additionalProperties:false}}
];

Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response(JSON.stringify({name:'Vorlen MCP',status:'ok'}),{status:200,headers});
 let body:any={};try{body=await req.json()}catch{return err(null,-32700,'Parse error',400)}
 const id=body.id??null,method=body.method;
 if(method==='initialize')return rpc(id,{protocolVersion:body?.params?.protocolVersion||'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'talentflow',version:'1.0.0'}});
 if(method==='notifications/initialized')return new Response(null,{status:202});
 if(method==='tools/list')return rpc(id,{tools});
 if(method!=='tools/call')return err(id,-32601,'Method not found');

 const auth=req.headers.get('Authorization');
 if(!auth?.startsWith('Bearer '))return err(id,-32001,'Authentication required',401);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return err(id,-32603,'Server configuration error',503);
 const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:ue}=await userDb.auth.getUser();
 if(ue||!user)return err(id,-32001,'Authentication required',401);
 const db=createClient(url,service);
 const {data:profile}=await db.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
 if(!profile?.company_id||!['owner','manager','recruiter'].includes(profile.role))return err(id,-32003,'Staff access required',403);
 const company_id=profile.company_id,name=clean(body?.params?.name,80),a=body?.params?.arguments||{};
 const{data:candidateAllowed}=await db.rpc('candidate_processing_allowed',{p_company_id:company_id});
 const done=(data:unknown)=>rpc(id,{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:{data}});
 const audit=async(detail:string)=>{await db.from('activity_log').insert({company_id,actor_id:user.id,event_type:'mcp_action',detail:detail.slice(0,1000)});};
 try{
  if(name==='search_clients'){const q=clean(a.query,120);let x=db.from('clients').select('id,company_name,contact_name,email,phone,website,status,created_at').eq('company_id',company_id).limit(25);if(q)x=x.or(`company_name.ilike.%${safe(q)}%,contact_name.ilike.%${safe(q)}%,email.ilike.%${safe(q)}%`);const {data,error}=await x;if(error)throw error;return done(data||[])}
  if(name==='search_jobs'){const q=clean(a.query,120);let x=db.from('jobs').select('id,client_id,title,description,employment_type,location,salary_min,salary_max,status,requirements,created_at').eq('company_id',company_id).limit(25);if(q)x=x.ilike('title',`%${safe(q)}%`);const {data,error}=await x;if(error)throw error;return done(data||[])}
  if(name==='search_candidates'){if(candidateAllowed!==true)return err(id,-32003,'Candidate processing is disabled',409);const q=clean(a.query,120);let x=db.from('candidates').select('id,full_name,email,phone,location,stage,score,source,recruiter_summary,next_action,next_action_at,created_at').eq('company_id',company_id).is('erased_at',null).limit(25);if(q)x=x.or(`full_name.ilike.%${safe(q)}%,email.ilike.%${safe(q)}%`);const {data,error}=await x;if(error)throw error;return done(data||[])}
  if(name==='create_client'){if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);const payload={company_id,company_name:clean(a.company_name,200),contact_name:clean(a.contact_name,200)||null,email:clean(a.email,320)||null,phone:clean(a.phone,80)||null,website:clean(a.website,500)||null,status:clean(a.status,50)||'prospect'};if(!payload.company_name)return err(id,-32602,'company_name required');const {data,error}=await db.from('clients').insert(payload).select().single();if(error)throw error;await audit(`create_client:${data.id}`);return done(data)}
  if(name==='create_candidate'){if(candidateAllowed!==true)return err(id,-32003,'Candidate processing is disabled',409);const payload={company_id,full_name:clean(a.full_name,200),email:clean(a.email,320)||null,phone:clean(a.phone,80)||null,location:clean(a.location,200)||null,source:clean(a.source,100)||'mcp',recruiter_summary:clean(a.recruiter_summary,1000)||null};if(!payload.full_name)return err(id,-32602,'full_name required');const {data,error}=await db.from('candidates').insert(payload).select().single();if(error)throw error;await audit(`create_candidate:${data.id}`);return done(data)}
  if(name==='create_application'){if(candidateAllowed!==true)return err(id,-32003,'Candidate processing is disabled',409);if(!uuid(a.candidate_id)||!uuid(a.job_id))return err(id,-32602,'valid candidate_id and job_id required');const {data:job}=await db.from('jobs').select('id').eq('id',a.job_id).eq('company_id',company_id).maybeSingle();const {data:candidate}=await db.from('candidates').select('id').eq('id',a.candidate_id).eq('company_id',company_id).maybeSingle();if(!job||!candidate)return err(id,-32602,'Job or candidate not found');const {data,error}=await db.from('applications').insert({company_id,job_id:job.id,candidate_id:candidate.id,status:clean(a.status,50)||'applied',source:'mcp'}).select().single();if(error)throw error;await audit(`create_application:${data.id}`);return done(data)}
  if(name==='record_activity'){const detail=clean(a.detail,1000);if(!detail)return err(id,-32602,'detail required');const payload:any={company_id,actor_id:user.id,event_type:clean(a.event_type,80)||'mcp_note',detail};if(uuid(a.candidate_id))payload.candidate_id=a.candidate_id;if(uuid(a.job_id))payload.job_id=a.job_id;const {data,error}=await db.from('activity_log').insert(payload).select().single();if(error)throw error;return done(data)}
  return err(id,-32602,'Unknown tool');
 }catch(e){console.error('talentflow-mcp',e);return err(id,-32603,e instanceof Error?e.message:'Tool failed',500)}
});