import {createClient} from 'npm:@supabase/supabase-js@2.95.0';

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
const resource='https://mzkaodoruhklzluikagy.supabase.co/functions/v1/talentflow-mcp';
const resourceMetadata=resource+'/oauth-protected-resource';
const authorizationServer='https://mzkaodoruhklzluikagy.supabase.co/auth/v1';
const oauthScheme=[{type:'oauth2',scopes:['openid','email','profile']}];
const toolMeta={securitySchemes:oauthScheme,ui:{visibility:['model','app']}};
const outputSchema={type:'object',properties:{data:{}},required:['data'],additionalProperties:false};
const authChallenge='Bearer resource_metadata="'+resourceMetadata+'", error="invalid_token", error_description="Sign in with Vorlen to continue"';
const rpc=(id:unknown,result:unknown,status=200)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{status,headers});
const err=(id:unknown,code:number,message:string,status=200)=>new Response(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}}),{status,headers});
const clean=(v:unknown,n=500)=>typeof v==='string'?v.trim().slice(0,n):'';
const safe=(v:string)=>v.replace(/[%_,()]/g,'');
const uuid=(v:unknown)=>typeof v==='string'&&/^[-0-9a-f]{36}$/i.test(v);
const normPhone=(v:unknown)=>{const x=clean(v,40);if(!x)return '';const d=x.replace(/\D/g,'');return d.startsWith('00')?'+'+d.slice(2):x.startsWith('+')?'+'+d:d};
const arr=(v:unknown,n=20)=>Array.isArray(v)?v.map(x=>clean(x,300)).filter(Boolean).slice(0,n):[];
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;

const tools=[
 {name:'search_clients',description:'Search Vorlen clients and prospects in the authenticated workspace.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'search_jobs',description:'Search jobs in the authenticated Vorlen workspace.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'search_candidates',description:'Search candidates in the authenticated Vorlen workspace.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'create_client',description:'Create a client/prospect. Requires owner or manager role.',inputSchema:{type:'object',required:['company_name'],properties:{company_name:{type:'string'},contact_name:{type:'string'},email:{type:'string'},phone:{type:'string'},website:{type:'string'},status:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'update_client',description:'Update verified contact or commercial fields on an existing Vorlen client/prospect. Requires owner or manager role.',inputSchema:{type:'object',required:['client_id'],properties:{client_id:{type:'string'},contact_name:{type:'string'},email:{type:'string'},phone:{type:'string'},website:{type:'string'},status:{type:'string'},business_nature:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'create_job',description:'Capture a genuine client vacancy as a DRAFT job from a live recruitment conversation. Requires owner or manager role. Draft status prevents incomplete call notes being published as an advert.',inputSchema:{type:'object',required:['client_id','title'],properties:{client_id:{type:'string'},title:{type:'string'},description:{type:'string'},employment_type:{type:'string'},location:{type:'string'},salary_min:{type:'number'},salary_max:{type:'number'},requirements:{type:'array',items:{type:'string'}},start_date:{type:'string'},duties:{type:'string'},work_days_hours:{type:'string'},required_qualifications:{type:'string'},pay_interval:{type:'string'},notice_period:{type:'string'},client_instruction_reference:{type:'string'},genuine_vacancy_confirmed:{type:'boolean'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'check_contact_eligibility',description:'Check whether a phone/email/client is suppressed from B2B outreach before calling or following up.',inputSchema:{type:'object',properties:{phone:{type:'string'},email:{type:'string'},client_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'suppress_contact',description:'Immediately record a do-not-contact/opt-out request for a phone, email or client. Use when a prospect asks not to be contacted.',inputSchema:{type:'object',properties:{phone:{type:'string'},email:{type:'string'},client_id:{type:'string'},reason:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'get_commercial_terms',description:'Read verified Vorlen commercial terms. Returns configured=false for anything not explicitly configured; never infer missing terms.',inputSchema:{type:'object',properties:{client_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'set_client_commercial_terms',description:'Set explicitly agreed commercial terms for one Vorlen client. Owner or manager only. Do not use unless the terms were actually agreed or otherwise verified.',inputSchema:{type:'object',required:['client_id'],properties:{client_id:{type:'string'},recruitment_fee_percent:{type:'number'},payment_terms_days:{type:'integer'},rebate_terms:{type:'string'},terms_version:{type:'string'},terms_accepted_by:{type:'string'},terms_acceptance_method:{type:'string'},terms_evidence:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'set_commercial_terms',description:'Set workspace default commercial terms. Owner only. Values are authoritative for future calls until changed.',inputSchema:{type:'object',properties:{recruitment_fee_percent:{type:'number'},payment_terms_days:{type:'integer'},rebate_terms:{type:'string'},guarantee_terms:{type:'string'},exclusivity_terms:{type:'string'},negotiation_authority:{type:'string'},terms_version:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'record_call_outcome',description:'Record a structured B2B call outcome with provenance after a real call.',inputSchema:{type:'object',required:['outcome'],properties:{client_id:{type:'string'},job_id:{type:'string'},request_id:{type:'string'},outcome:{type:'string'},decision_maker_reached:{type:'boolean'},hiring_status:{type:'string'},objections:{type:'array',items:{type:'string'}},commitments:{type:'array',items:{type:'string'}},next_action:{type:'string'},follow_up_at:{type:'string'},prospect_stated_facts:{type:'array',items:{type:'string'}},alex_inferences:{type:'array',items:{type:'string'}}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'create_candidate',description:'Create a candidate record in Vorlen.',inputSchema:{type:'object',required:['full_name'],properties:{full_name:{type:'string'},email:{type:'string'},phone:{type:'string'},location:{type:'string'},source:{type:'string'},recruiter_summary:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'create_application',description:'Attach a candidate to a job as an application.',inputSchema:{type:'object',required:['candidate_id','job_id'],properties:{candidate_id:{type:'string'},job_id:{type:'string'},status:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'record_activity',description:'Record an audited Vorlen activity/note.',inputSchema:{type:'object',required:['detail'],properties:{detail:{type:'string'},event_type:{type:'string'},candidate_id:{type:'string'},job_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'get_clients_needing_vacancy_research',description:'Return queued/current dialer prospects that have no internal Vorlen vacancy and therefore require fresh public web vacancy research before calling.',inputSchema:{type:'object',properties:{campaign_id:{type:'string'},limit:{type:'integer'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'save_external_vacancy_research',description:'Persist verified public vacancy evidence found through web research for a Vorlen client. Every vacancy requires its exact source URL. Use an empty vacancies array when fresh research found no verified vacancy.',inputSchema:{type:'object',required:['client_id','vacancies'],properties:{client_id:{type:'string'},dialer_item_id:{type:'string'},vacancies:{type:'array',items:{type:'object',required:['title','source_url'],properties:{title:{type:'string'},location:{type:'string'},source_url:{type:'string'},source_domain:{type:'string'},evidence_excerpt:{type:'string'}}}},researched_at:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'get_client_call_context',description:'Get the authoritative pre-call brief for one Vorlen client, including contact state, notes and linked vacancies.',inputSchema:{type:'object',required:['client_id'],properties:{client_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'get_next_dialer_client',description:'Get the current or next client and pre-call context for a running Vorlen AI dialer campaign.',inputSchema:{type:'object',properties:{campaign_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'create_auto_dialer_campaign',description:'Create a sequential B2B dialer campaign directly from eligible Vorlen prospects. Selects prospects with phone numbers whose call state is not_contacted or due callback, excluding suppressed/DNC/wrong/not-interested records. compliance_confirmed=true is required.',inputSchema:{type:'object',required:['name','compliance_confirmed'],properties:{name:{type:'string'},compliance_confirmed:{type:'boolean'},device_code:{type:'string'},limit:{type:'integer'},inter_call_delay_seconds:{type:'integer'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'update_client_call_outcome',description:'Update a client call lifecycle after a real call and append a permanent contact note. Handles retry/callback timing and DNC state.',inputSchema:{type:'object',required:['client_id','call_status'],properties:{client_id:{type:'string'},call_status:{type:'string',enum:['contacted','no_answer','busy','voicemail','callback','not_interested','interested','wrong_number','do_not_call']},note:{type:'string'},next_call_at:{type:'string'},call_request_id:{type:'string'},outcome:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'create_dialer_campaign',description:'Create a sequential Vorlen B2B dialer queue from existing client IDs. Each queued client must have a phone number and compliance_confirmed=true, confirming required outreach checks were completed. Requires owner/manager.',inputSchema:{type:'object',required:['name','client_ids','compliance_confirmed'],properties:{name:{type:'string'},client_ids:{type:'array',items:{type:'string'},minItems:1,maxItems:200},compliance_confirmed:{type:'boolean'},device_code:{type:'string'},inter_call_delay_seconds:{type:'integer'},max_calls:{type:'integer'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'start_dialer_campaign',description:'Start or resume a prepared sequential dialer campaign. Calls are dispatched one at a time only while the handset calling session is explicitly approved.',inputSchema:{type:'object',required:['campaign_id'],properties:{campaign_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'pause_dialer_campaign',description:'Pause a dialer campaign. Does not terminate an already active phone call.',inputSchema:{type:'object',required:['campaign_id'],properties:{campaign_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'get_dialer_state',description:'Get campaign progress and queued/current/completed dialer items.',inputSchema:{type:'object',properties:{campaign_id:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'request_call',description:'Create an approved outbound call request for the paired Vorlen phone gateway. Requires owner or manager role and an active user-approved calling session on the handset before it will dial.',inputSchema:{type:'object',required:['phone_number'],properties:{phone_number:{type:'string'},device_code:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'hangup_call',description:'Request the paired Vorlen phone gateway to end the active call.',inputSchema:{type:'object',properties:{request_id:{type:'string'},device_code:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'get_call_state',description:'Get recent Vorlen phone gateway requests, commands and call-state events.',inputSchema:{type:'object',properties:{request_id:{type:'string'},device_code:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'start_call_transcript',description:'Start or resume the transcript for a real Vorlen call. Link it to the active call request so every spoken turn can be persisted.',inputSchema:{type:'object',required:['call_request_id'],properties:{call_request_id:{type:'string'},client_id:{type:'string'},campaign_id:{type:'string'},dialer_item_id:{type:'string'},source:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'append_call_transcript_turn',description:'Append one exact spoken turn to an in-progress Vorlen call transcript. Save Alex and prospect turns in chronological order during the call.',inputSchema:{type:'object',required:['transcript_id','speaker','text'],properties:{transcript_id:{type:'string'},speaker:{type:'string',enum:['alex','prospect','unknown']},text:{type:'string'},spoken_at:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},
 {name:'complete_call_transcript',description:'Finalize a Vorlen call transcript after the call ends, storing the assembled transcript and optional factual summary.',inputSchema:{type:'object',required:['transcript_id'],properties:{transcript_id:{type:'string'},status:{type:'string',enum:['completed','partial','failed']},summary:{type:'string'}},additionalProperties:false},outputSchema,securitySchemes:oauthScheme,_meta:toolMeta},];

Deno.serve(async(req)=>{
 const u=new URL(req.url);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
 if(req.method==='GET'&&u.pathname.endsWith('/oauth-protected-resource'))return new Response(JSON.stringify({resource,authorization_servers:[authorizationServer],bearer_methods_supported:['header'],scopes_supported:['openid','email','profile'],resource_documentation:'https://www.vorlen.co.uk/privacy'}),{status:200,headers});
 if(req.method!=='POST')return new Response(JSON.stringify({name:'Vorlen MCP',status:'ok',oauth:true,resource_metadata:resourceMetadata}),{status:200,headers});
 let body:any={};try{body=await req.json()}catch{return err(null,-32700,'Parse error',400)}
 const id=body.id??null,method=body.method;
 if(method==='initialize')return rpc(id,{protocolVersion:body?.params?.protocolVersion||'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'talentflow',version:'1.0.0'}});
 if(method==='notifications/initialized')return new Response(null,{status:202});
 if(method==='tools/list')return rpc(id,{tools});
 if(method!=='tools/call')return err(id,-32601,'Method not found');

 const auth=req.headers.get('Authorization');
 if(!auth?.startsWith('Bearer '))return new Response(JSON.stringify({jsonrpc:'2.0',id,error:{code:-32001,message:'Authentication required'},result:{content:[{type:'text',text:'Authentication required.'}],isError:true,_meta:{'mcp/www_authenticate':[authChallenge]}}}),{status:401,headers:{...headers,'WWW-Authenticate':authChallenge}});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return err(id,-32603,'Server configuration error',503);
 const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:ue}=await userDb.auth.getUser();
 if(ue||!user)return new Response(JSON.stringify({jsonrpc:'2.0',id,error:{code:-32001,message:'Authentication required'}}),{status:401,headers:{...headers,'WWW-Authenticate':authChallenge}});
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
  if(name==='update_client'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);
   if(!uuid(a.client_id))return err(id,-32602,'valid client_id required');
   const {data:existing}=await db.from('clients').select('id').eq('id',a.client_id).eq('company_id',company_id).maybeSingle();if(!existing)return err(id,-32602,'Client not found');
   const p:any={}; for(const k of ['contact_name','email','phone','website','business_nature'])if(a[k]!==undefined)p[k]=clean(a[k],k==='website'?500:320);
   if(a.status!==undefined){const st=clean(a.status,30);if(!['prospect','active','paused','closed'].includes(st))return err(id,-32602,'invalid client status');p.status=st;}
   if(!Object.keys(p).length)return err(id,-32602,'No update fields supplied');
   const {data,error}=await db.from('clients').update(p).eq('id',a.client_id).eq('company_id',company_id).select().single();if(error)throw error;await audit(`update_client:${data.id}`);return done(data);
  }
  if(name==='create_job'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);
   if(!uuid(a.client_id))return err(id,-32602,'valid client_id required');const title=clean(a.title,200);if(!title)return err(id,-32602,'title required');
   const {data:client}=await db.from('clients').select('id,company_name').eq('id',a.client_id).eq('company_id',company_id).maybeSingle();if(!client)return err(id,-32602,'Client not found');
   const slug=(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'vacancy')+'-'+crypto.randomUUID().slice(0,8);
   const p:any={company_id,client_id:client.id,title,slug,description:clean(a.description,5000)||title,employment_type:clean(a.employment_type,80)||'Permanent',location:clean(a.location,200)||'UK',status:'draft',requirements:arr(a.requirements),duties:clean(a.duties,5000)||null,work_days_hours:clean(a.work_days_hours,1000)||null,required_qualifications:clean(a.required_qualifications,2000)||null,pay_interval:clean(a.pay_interval,80)||null,notice_period:clean(a.notice_period,500)||null,client_instruction_reference:clean(a.client_instruction_reference,500)||null};
   if(num(a.salary_min)!==null)p.salary_min=num(a.salary_min);if(num(a.salary_max)!==null)p.salary_max=num(a.salary_max);if(clean(a.start_date,20))p.start_date=clean(a.start_date,20);if(a.genuine_vacancy_confirmed===true)p.genuine_vacancy_confirmed_at=new Date().toISOString();
   const {data,error}=await db.from('jobs').insert(p).select().single();if(error)throw error;await audit(`create_job:${data.id}:draft`);return done(data);
  }
  if(name==='check_contact_eligibility'){
   const phone=normPhone(a.phone)||null,email=clean(a.email,320).toLowerCase()||null,clientId=uuid(a.client_id)?a.client_id:null;if(!phone&&!email&&!clientId)return err(id,-32602,'phone, email or client_id required');
   let q=db.from('b2b_call_suppressions').select('id,phone_normalized,email_normalized,client_id,reason,requested_at').eq('company_id',company_id);const ors=[];if(phone)ors.push(`phone_normalized.eq.${phone}`);if(email)ors.push(`email_normalized.eq.${email}`);if(clientId)ors.push(`client_id.eq.${clientId}`);q=q.or(ors.join(','));
   const {data,error}=await q.limit(20);if(error)throw error;return done({eligible:!(data&&data.length),suppressed:(data||[])});
  }
  if(name==='suppress_contact'){
   const phone=normPhone(a.phone)||null,email=clean(a.email,320).toLowerCase()||null,clientId=uuid(a.client_id)?a.client_id:null;if(!phone&&!email&&!clientId)return err(id,-32602,'phone, email or client_id required');
   let resolvedPhone=phone,resolvedEmail=email;if(clientId&&(!resolvedPhone||!resolvedEmail)){const {data:c}=await db.from('clients').select('phone,email').eq('id',clientId).eq('company_id',company_id).maybeSingle();if(c){resolvedPhone=resolvedPhone||normPhone(c.phone)||null;resolvedEmail=resolvedEmail||clean(c.email,320).toLowerCase()||null;}}
   const p={company_id,phone_normalized:resolvedPhone,email_normalized:resolvedEmail,client_id:clientId,reason:clean(a.reason,500)||'do_not_contact',source:'mcp',requested_by:user.id};
   const {data,error}=await db.from('b2b_call_suppressions').insert(p).select().single();if(error&&error.code!=='23505')throw error;if(error?.code==='23505'){const {data:existing}=await db.from('b2b_call_suppressions').select().eq('company_id',company_id).or([phone?`phone_normalized.eq.${phone}`:'',email?`email_normalized.eq.${email}`:'',clientId?`client_id.eq.${clientId}`:''].filter(Boolean).join(',')).limit(1).single();return done(existing);}
   await audit(`suppress_contact:${data.id}`);return done(data);
  }
  if(name==='get_commercial_terms'){
   let clientTerms:any=null;if(uuid(a.client_id)){const {data:c}=await db.from('clients').select('id,recruitment_fee_percent,payment_terms_days,rebate_terms,terms_version,terms_accepted_at').eq('id',a.client_id).eq('company_id',company_id).maybeSingle();clientTerms=c||null;}
   const {data:defaults,error}=await db.from('b2b_commercial_settings').select('recruitment_fee_percent,payment_terms_days,rebate_terms,guarantee_terms,exclusivity_terms,negotiation_authority,terms_version,updated_at').eq('company_id',company_id).maybeSingle();if(error)throw error;
   const effective={recruitment_fee_percent:clientTerms?.recruitment_fee_percent??defaults?.recruitment_fee_percent??null,payment_terms_days:clientTerms?.payment_terms_days??defaults?.payment_terms_days??null,rebate_terms:clientTerms?.rebate_terms??defaults?.rebate_terms??null,guarantee_terms:defaults?.guarantee_terms??null,exclusivity_terms:defaults?.exclusivity_terms??null,negotiation_authority:defaults?.negotiation_authority??null,terms_version:clientTerms?.terms_version??defaults?.terms_version??null};
   return done({configured:Object.values(effective).some(v=>v!==null),effective,client_override:clientTerms,workspace_defaults:defaults||null});
  }
  if(name==='set_client_commercial_terms'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);if(!uuid(a.client_id))return err(id,-32602,'valid client_id required');
   const p:any={};if(num(a.recruitment_fee_percent)!==null)p.recruitment_fee_percent=num(a.recruitment_fee_percent);if(Number.isInteger(a.payment_terms_days))p.payment_terms_days=a.payment_terms_days;
   for(const k of ['rebate_terms','terms_version','terms_accepted_by','terms_acceptance_method','terms_evidence'])if(a[k]!==undefined)p[k]=clean(a[k],2000)||null;
   if(a.terms_accepted_by||a.terms_acceptance_method||a.terms_evidence)p.terms_accepted_at=new Date().toISOString();if(!Object.keys(p).length)return err(id,-32602,'No commercial terms supplied');
   const {data,error}=await db.from('clients').update(p).eq('id',a.client_id).eq('company_id',company_id).select('id,company_name,recruitment_fee_percent,payment_terms_days,rebate_terms,terms_version,terms_accepted_at,terms_accepted_by,terms_acceptance_method,terms_evidence').single();if(error)throw error;await audit(`set_client_commercial_terms:${data.id}`);return done(data);
  }
  if(name==='set_commercial_terms'){
   if(profile.role!=='owner')return err(id,-32003,'Owner access required',403);
   const p:any={company_id,updated_by:user.id,updated_at:new Date().toISOString()};if(num(a.recruitment_fee_percent)!==null)p.recruitment_fee_percent=num(a.recruitment_fee_percent);if(Number.isInteger(a.payment_terms_days))p.payment_terms_days=a.payment_terms_days;
   for(const k of ['rebate_terms','guarantee_terms','exclusivity_terms','negotiation_authority','terms_version'])if(a[k]!==undefined)p[k]=clean(a[k],2000)||null;
   const {data,error}=await db.from('b2b_commercial_settings').upsert(p,{onConflict:'company_id'}).select().single();if(error)throw error;await audit('set_commercial_terms');return done(data);
  }
  if(name==='record_call_outcome'){
   const outcome=clean(a.outcome,120);if(!outcome)return err(id,-32602,'outcome required');
   const metadata:any={source:'live_b2b_call',client_id:uuid(a.client_id)?a.client_id:null,request_id:uuid(a.request_id)?a.request_id:null,decision_maker_reached:a.decision_maker_reached===true,hiring_status:clean(a.hiring_status,200)||null,objections:arr(a.objections),commitments:arr(a.commitments),next_action:clean(a.next_action,1000)||null,follow_up_at:clean(a.follow_up_at,80)||null,prospect_stated_facts:arr(a.prospect_stated_facts),alex_inferences:arr(a.alex_inferences)};
   const payload:any={company_id,actor_id:user.id,event_type:'b2b_call_outcome',detail:outcome,metadata};if(uuid(a.job_id))payload.job_id=a.job_id;
   const {data,error}=await db.from('activity_log').insert(payload).select().single();if(error)throw error;await audit(`record_call_outcome:${data.id}`);return done(data);
  }
  if(name==='create_candidate'){if(candidateAllowed!==true)return err(id,-32003,'Candidate processing is disabled',409);const payload={company_id,full_name:clean(a.full_name,200),email:clean(a.email,320)||null,phone:clean(a.phone,80)||null,location:clean(a.location,200)||null,source:clean(a.source,100)||'mcp',recruiter_summary:clean(a.recruiter_summary,1000)||null};if(!payload.full_name)return err(id,-32602,'full_name required');const {data,error}=await db.from('candidates').insert(payload).select().single();if(error)throw error;await audit(`create_candidate:${data.id}`);return done(data)}
  if(name==='create_application'){if(candidateAllowed!==true)return err(id,-32003,'Candidate processing is disabled',409);if(!uuid(a.candidate_id)||!uuid(a.job_id))return err(id,-32602,'valid candidate_id and job_id required');const {data:job}=await db.from('jobs').select('id').eq('id',a.job_id).eq('company_id',company_id).maybeSingle();const {data:candidate}=await db.from('candidates').select('id').eq('id',a.candidate_id).eq('company_id',company_id).maybeSingle();if(!job||!candidate)return err(id,-32602,'Job or candidate not found');const {data,error}=await db.from('applications').insert({company_id,job_id:job.id,candidate_id:candidate.id,status:clean(a.status,50)||'applied',source:'mcp'}).select().single();if(error)throw error;await audit(`create_application:${data.id}`);return done(data)}
  if(name==='get_clients_needing_vacancy_research'){
   const lim=Number.isInteger(a.limit)?Math.max(1,Math.min(50,a.limit)):20;let q=db.from('ai_dialer_items').select('id,campaign_id,client_id,position,status,research_status').eq('company_id',company_id).eq('research_status','needed').in('status',['queued','dialing']).order('position').limit(lim);if(uuid(a.campaign_id))q=q.eq('campaign_id',a.campaign_id);const {data:items,error}=await q;if(error)throw error;
   const out=[];for(const item of items||[]){const {data:c}=await db.from('clients').select('id,company_name,website,phone,business_nature').eq('id',item.client_id).eq('company_id',company_id).single();out.push({dialer_item_id:item.id,campaign_id:item.campaign_id,client:c});}return done(out);
  }
  if(name==='save_external_vacancy_research'){
   if(!uuid(a.client_id)||!Array.isArray(a.vacancies))return err(id,-32602,'valid client_id and vacancies required');const {data:c}=await db.from('clients').select('id').eq('id',a.client_id).eq('company_id',company_id).maybeSingle();if(!c)return err(id,-32602,'Client not found');
   const now=new Date().toISOString(),exp=new Date(Date.now()+48*3600*1000).toISOString();await db.from('client_external_vacancies').update({status:'stale'}).eq('company_id',company_id).eq('client_id',a.client_id).eq('status','verified');
   const rows=[];for(const v of a.vacancies.slice(0,30)){const title=clean(v.title,300),url=clean(v.source_url,1500);if(!title||!/^https?:\/\//i.test(url))continue;let domain=clean(v.source_domain,200);try{domain=domain||new URL(url).hostname}catch{}rows.push({company_id,client_id:a.client_id,title,location:clean(v.location,300)||null,source_url:url,source_domain:domain||'unknown',evidence_excerpt:clean(v.evidence_excerpt,1000)||null,last_verified_at:now,expires_at:exp,status:'verified',discovered_by:'ai_web_search'});}
   if(rows.length){const {error}=await db.from('client_external_vacancies').upsert(rows,{onConflict:'company_id,client_id,source_url,title'});if(error)throw error;}
   if(uuid(a.dialer_item_id))await db.from('ai_dialer_items').update({research_status:'ready',research_completed_at:now}).eq('id',a.dialer_item_id).eq('company_id',company_id).eq('client_id',a.client_id);
   await audit(`save_external_vacancy_research:${a.client_id}:${rows.length}`);return done({client_id:a.client_id,verified_vacancies:rows.length,research_status:'ready',expires_at:exp});
  }
  if(name==='get_client_call_context'){
   if(!uuid(a.client_id))return err(id,-32602,'valid client_id required');
   const {data:client,error}=await db.from('clients').select('id,company_name,contact_name,email,phone,website,status,business_nature,call_status,last_contacted_at,next_call_at,call_attempts,last_call_outcome,last_call_note,recruitment_fee_percent,payment_terms_days,rebate_terms').eq('id',a.client_id).eq('company_id',company_id).maybeSingle();if(error)throw error;if(!client)return err(id,-32602,'Client not found');
   const [{data:jobs,error:je},{data:notes,error:ne}]=await Promise.all([db.from('jobs').select('id,title,status,description,employment_type,location,salary_min,salary_max,requirements,start_date,duties,work_days_hours,required_qualifications,client_instruction_reference,genuine_vacancy_confirmed_at,created_at').eq('company_id',company_id).eq('client_id',client.id).in('status',['draft','published']).order('created_at',{ascending:false}).limit(10),db.from('client_contact_notes').select('note,note_type,source,created_at').eq('company_id',company_id).eq('client_id',client.id).order('created_at',{ascending:false}).limit(10)]);if(je)throw je;if(ne)throw ne;
   const {data:external}=await db.from('client_external_vacancies').select('id,title,location,source_url,source_domain,evidence_excerpt,last_verified_at,expires_at').eq('company_id',company_id).eq('client_id',client.id).eq('status','verified').gt('expires_at',new Date().toISOString()).order('last_verified_at',{ascending:false}).limit(20);
   return done({client,vacancies:jobs||[],external_vacancies:external||[],recent_notes:notes||[]});
  }
  if(name==='get_next_dialer_client'){
   let cq=db.from('ai_dialer_campaigns').select('id,name,status').eq('company_id',company_id).in('status',['running','paused']).order('created_at',{ascending:false}).limit(1);if(uuid(a.campaign_id))cq=cq.eq('id',a.campaign_id);const {data:campaign,error}=await cq.maybeSingle();if(error)throw error;if(!campaign)return done({campaign:null,item:null,context:null});
   const {data:item,error:ie}=await db.from('ai_dialer_items').select('id,client_id,phone_number,position,status,call_request_id,pre_call_context,context_generated_at').eq('company_id',company_id).eq('campaign_id',campaign.id).in('status',['dialing','queued']).order('status',{ascending:true}).order('position').limit(1).maybeSingle();if(ie)throw ie;if(!item)return done({campaign,item:null,context:null});
   const {data:client}=await db.from('clients').select('id,company_name,contact_name,email,phone,website,status,business_nature,call_status,last_contacted_at,next_call_at,call_attempts,last_call_outcome,last_call_note').eq('id',item.client_id).eq('company_id',company_id).single();
   const {data:jobs}=await db.from('jobs').select('id,title,status,description,employment_type,location,salary_min,salary_max,requirements,start_date,duties,work_days_hours,required_qualifications,genuine_vacancy_confirmed_at').eq('company_id',company_id).eq('client_id',item.client_id).in('status',['draft','published']).order('created_at',{ascending:false}).limit(10);
   const {data:notes}=await db.from('client_contact_notes').select('note,note_type,created_at').eq('company_id',company_id).eq('client_id',item.client_id).order('created_at',{ascending:false}).limit(5);
   const {data:external}=await db.from('client_external_vacancies').select('id,title,location,source_url,source_domain,evidence_excerpt,last_verified_at,expires_at').eq('company_id',company_id).eq('client_id',item.client_id).eq('status','verified').gt('expires_at',new Date().toISOString()).order('last_verified_at',{ascending:false}).limit(20);
   return done({campaign,item,context:{client,vacancies:jobs||[],external_vacancies:external||[],recent_notes:notes||[]}});
  }
  if(name==='create_auto_dialer_campaign'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);if(a.compliance_confirmed!==true)return err(id,-32602,'compliance_confirmed=true required before queueing outreach');
   const deviceCode=clean(a.device_code,80)||'s24fe-primary';const {data:device}=await db.from('call_gateway_devices').select('id').eq('company_id',company_id).eq('device_code',deviceCode).eq('enabled',true).maybeSingle();if(!device)return err(id,-32602,'Gateway device not available');
   const lim=Number.isInteger(a.limit)?Math.max(1,Math.min(200,a.limit)):50,delay=Number.isInteger(a.inter_call_delay_seconds)?Math.max(5,Math.min(600,a.inter_call_delay_seconds)):20,now=new Date().toISOString();
   const {data:clients,error:cle}=await db.from('clients').select('id,company_name,phone,call_status,next_call_at').eq('company_id',company_id).eq('status','prospect').not('phone','is',null).in('call_status',['not_contacted','callback']).order('created_at',{ascending:true}).limit(500);if(cle)throw cle;
   const eligible=(clients||[]).filter(c=>c.call_status==='not_contacted'||(c.call_status==='callback'&&c.next_call_at&&c.next_call_at<=now));
   const {data:sups,error:se}=await db.from('b2b_call_suppressions').select('client_id,phone_normalized').eq('company_id',company_id);if(se)throw se;const blocked=new Set((sups||[]).flatMap(x=>[x.client_id,x.phone_normalized].filter(Boolean)));
   const picked=eligible.filter(c=>!blocked.has(c.id)&&!blocked.has(normPhone(c.phone))).slice(0,lim);
   const {data:campaign,error:ce}=await db.from('ai_dialer_campaigns').insert({company_id,device_id:device.id,name:clean(a.name,200)||'Vorlen auto dialer',inter_call_delay_seconds:delay,max_calls:lim,created_by:user.id}).select().single();if(ce)throw ce;
   const rows=[];for(let i=0;i<picked.length;i++){const c=picked[i];const {data:jobs}=await db.from('jobs').select('id,title,status,employment_type,location,salary_min,salary_max,requirements,start_date').eq('company_id',company_id).eq('client_id',c.id).in('status',['draft','published']).order('created_at',{ascending:false}).limit(10);const {data:notes}=await db.from('client_contact_notes').select('note,created_at').eq('company_id',company_id).eq('client_id',c.id).order('created_at',{ascending:false}).limit(5);rows.push({campaign_id:campaign.id,company_id,client_id:c.id,phone_number:normPhone(c.phone),position:i+1,status:'queued',compliance_confirmed_at:now,pre_call_context:{company_name:c.company_name,vacancies:jobs||[],recent_notes:notes||[]},context_generated_at:now,research_status:(jobs||[]).length?'not_needed':'needed',research_requested_at:(jobs||[]).length?null:now});}
   if(rows.length){const {error:ie}=await db.from('ai_dialer_items').insert(rows);if(ie)throw ie;await db.from('clients').update({call_status:'queued'}).eq('company_id',company_id).in('id',picked.map(x=>x.id));}
   await audit(`create_auto_dialer_campaign:${campaign.id}:${rows.length}`);return done({campaign,queued:rows.length,eligible_found:eligible.length});
  }
  if(name==='update_client_call_outcome'){
   if(!uuid(a.client_id))return err(id,-32602,'valid client_id required');const st=clean(a.call_status,40);if(!['contacted','no_answer','busy','voicemail','callback','not_interested','interested','wrong_number','do_not_call'].includes(st))return err(id,-32602,'invalid call_status');
   const now=new Date().toISOString(),note=clean(a.note,4000),outcome=clean(a.outcome,1000)||st;const patch:any={call_status:st,last_contacted_at:now,last_call_outcome:outcome,last_call_note:note||null};if(st==='callback'){if(!clean(a.next_call_at,80))return err(id,-32602,'next_call_at required for callback');patch.next_call_at=clean(a.next_call_at,80);}else patch.next_call_at=null;
   const {data:client,error}=await db.from('clients').update(patch).eq('id',a.client_id).eq('company_id',company_id).select('id,company_name,phone,call_status,last_contacted_at,next_call_at,call_attempts,last_call_outcome').single();if(error)throw error;
   if(note){const {error:ne}=await db.from('client_contact_notes').insert({company_id,client_id:client.id,call_request_id:uuid(a.call_request_id)?a.call_request_id:null,note,note_type:'call_outcome',source:'ai_dialer',created_by:user.id});if(ne)throw ne;}
   if(st==='do_not_call'){const ph=normPhone(client.phone)||null;const {error:se}=await db.from('b2b_call_suppressions').insert({company_id,phone_normalized:ph,client_id:client.id,reason:'do_not_contact',source:'ai_dialer',requested_by:user.id});if(se&&se.code!=='23505')throw se;}
   await audit(`update_client_call_outcome:${client.id}:${st}`);return done(client);
  }
  if(name==='create_dialer_campaign'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);if(a.compliance_confirmed!==true)return err(id,-32602,'compliance_confirmed=true required before queueing outreach');
   const ids=Array.isArray(a.client_ids)?[...new Set(a.client_ids.filter(uuid))].slice(0,200):[];if(!ids.length)return err(id,-32602,'valid client_ids required');
   const deviceCode=clean(a.device_code,80)||'s24fe-primary';const {data:device}=await db.from('call_gateway_devices').select('id').eq('company_id',company_id).eq('device_code',deviceCode).eq('enabled',true).maybeSingle();if(!device)return err(id,-32602,'Gateway device not available');
   const delay=Number.isInteger(a.inter_call_delay_seconds)?Math.max(5,Math.min(600,a.inter_call_delay_seconds)):20;const maxCalls=Number.isInteger(a.max_calls)?Math.max(1,Math.min(1000,a.max_calls)):100;
   const {data:campaign,error:ce}=await db.from('ai_dialer_campaigns').insert({company_id,device_id:device.id,name:clean(a.name,200)||'Vorlen dialer',inter_call_delay_seconds:delay,max_calls:maxCalls,created_by:user.id}).select().single();if(ce)throw ce;
   const {data:clients,error:cle}=await db.from('clients').select('id,company_name,phone').eq('company_id',company_id).in('id',ids);if(cle)throw cle;
   const phones=(clients||[]).filter(c=>normPhone(c.phone));const {data:sups,error:se}=await db.from('b2b_call_suppressions').select('client_id,phone_normalized').eq('company_id',company_id);if(se)throw se;const blocked=new Set((sups||[]).flatMap(x=>[x.client_id,x.phone_normalized].filter(Boolean)));
   const now=new Date().toISOString();const rows=phones.map((c,i)=>({campaign_id:campaign.id,company_id,client_id:c.id,phone_number:normPhone(c.phone),position:i+1,status:blocked.has(c.id)||blocked.has(normPhone(c.phone))?'blocked':'queued',compliance_confirmed_at:now}));
   if(rows.length){const {error}=await db.from('ai_dialer_items').insert(rows);if(error)throw error;}await audit(`create_dialer_campaign:${campaign.id}:${rows.length}`);return done({campaign,queued:rows.filter(x=>x.status==='queued').length,blocked:rows.filter(x=>x.status==='blocked').length,missing_phone:ids.length-phones.length});
  }
  if(name==='start_dialer_campaign'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);if(!uuid(a.campaign_id))return err(id,-32602,'valid campaign_id required');
   const {data,error}=await db.from('ai_dialer_campaigns').update({status:'running',started_at:new Date().toISOString(),paused_at:null,next_call_after:new Date().toISOString()}).eq('id',a.campaign_id).eq('company_id',company_id).in('status',['draft','paused']).select().maybeSingle();if(error)throw error;if(!data)return err(id,-32602,'Campaign not startable');await audit(`start_dialer_campaign:${data.id}`);return done(data);
  }
  if(name==='pause_dialer_campaign'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);if(!uuid(a.campaign_id))return err(id,-32602,'valid campaign_id required');
   const {data,error}=await db.from('ai_dialer_campaigns').update({status:'paused',paused_at:new Date().toISOString()}).eq('id',a.campaign_id).eq('company_id',company_id).eq('status','running').select().maybeSingle();if(error)throw error;if(!data)return err(id,-32602,'Running campaign not found');await audit(`pause_dialer_campaign:${data.id}`);return done(data);
  }
  if(name==='get_dialer_state'){
   let q=db.from('ai_dialer_campaigns').select('*').eq('company_id',company_id).order('created_at',{ascending:false}).limit(10);if(uuid(a.campaign_id))q=q.eq('id',a.campaign_id);const {data:campaigns,error}=await q;if(error)throw error;
   let items:any[]=[];if(campaigns?.length){const {data,error:ie}=await db.from('ai_dialer_items').select('id,campaign_id,client_id,phone_number,position,status,call_request_id,attempts,outcome,last_error,completed_at').eq('company_id',company_id).in('campaign_id',campaigns.map(c=>c.id)).order('position').limit(500);if(ie)throw ie;items=data||[];}return done({campaigns:campaigns||[],items});
  }
  if(name==='request_call'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);
   const phone=clean(a.phone_number,30),digits=phone.replace(/\D/g,'');
   if(!/^\+?[0-9]{7,15}$/.test(phone)||['999','112','911','000'].includes(digits))return err(id,-32602,'valid non-emergency phone_number required');
   const normalizedPhone=normPhone(phone);
   const {data:suppressed,error:se}=await db.from('b2b_call_suppressions').select('id,reason,requested_at').eq('company_id',company_id).eq('phone_normalized',normalizedPhone).limit(1);if(se)throw se;if(suppressed?.length)return err(id,-32003,'Call blocked: contact is suppressed/do-not-contact',409);
   const deviceCode=clean(a.device_code,80)||'s24fe-primary';
   const {data:device,error:de}=await db.from('call_gateway_devices').select('id,device_code,enabled,paired_at').eq('company_id',company_id).eq('device_code',deviceCode).maybeSingle();
   if(de)throw de;if(!device?.enabled||!device.paired_at)return err(id,-32602,'Paired call gateway device not available');
   const {data,error}=await db.from('call_gateway_requests').insert({company_id,device_id:device.id,phone_number:phone,status:'approved',requested_by:user.id,approved_by:user.id,approved_at:new Date().toISOString()}).select('id,phone_number,status,created_at,expires_at').single();
   if(error)throw error;await audit(`request_call:${data.id}:${deviceCode}`);return done(data);
  }
  if(name==='hangup_call'){
   if(!['owner','manager'].includes(profile.role))return err(id,-32003,'Manager access required',403);
   const deviceCode=clean(a.device_code,80)||'s24fe-primary';
   const {data:device,error:de}=await db.from('call_gateway_devices').select('id,device_code,enabled').eq('company_id',company_id).eq('device_code',deviceCode).maybeSingle();
   if(de)throw de;if(!device?.enabled)return err(id,-32602,'Call gateway device not available');
   let requestId:string|null=null;
   if(uuid(a.request_id)){const {data:r,error:vre}=await db.from('call_gateway_requests').select('id').eq('id',a.request_id).eq('company_id',company_id).eq('device_id',device.id).in('status',['claimed','approved']).maybeSingle();if(vre)throw vre;if(!r)return err(id,-32602,'Active call request not found for this device');requestId=r.id;}
   else {const {data:r}=await db.from('call_gateway_requests').select('id').eq('company_id',company_id).eq('device_id',device.id).in('status',['claimed','approved']).order('created_at',{ascending:false}).limit(1).maybeSingle();requestId=r?.id||null;}
   const {data,error}=await db.from('call_gateway_commands').insert({company_id,device_id:device.id,request_id:requestId,action:'hangup'}).select('id,request_id,action,status,created_at,expires_at').single();
   if(error)throw error;await audit(`hangup_call:${data.id}:${deviceCode}`);return done(data);
  }
  if(name==='get_call_state'){
   const deviceCode=clean(a.device_code,80)||'s24fe-primary';
   const {data:device,error:de}=await db.from('call_gateway_devices').select('id,device_code,enabled,last_seen_at').eq('company_id',company_id).eq('device_code',deviceCode).maybeSingle();
   if(de)throw de;if(!device)return err(id,-32602,'Call gateway device not found');
   let rq=db.from('call_gateway_requests').select('id,phone_number,status,created_at,claimed_at,completed_at,error').eq('company_id',company_id).eq('device_id',device.id).order('created_at',{ascending:false}).limit(10);
   if(uuid(a.request_id))rq=rq.eq('id',a.request_id);
   const [{data:requests,error:re},{data:commands,error:ce},{data:events,error:ee}]=await Promise.all([rq,db.from('call_gateway_commands').select('id,request_id,action,status,created_at,completed_at,error').eq('company_id',company_id).eq('device_id',device.id).order('created_at',{ascending:false}).limit(10),db.from('call_gateway_events').select('request_id,event_type,call_state,created_at').eq('company_id',company_id).eq('device_id',device.id).order('created_at',{ascending:false}).limit(20)]);
   if(re)throw re;if(ce)throw ce;if(ee)throw ee;return done({device,requests:requests||[],commands:commands||[],events:events||[]});
  }
  if(name==='start_call_transcript'){
   if(!uuid(a.call_request_id))return err(id,-32602,'valid call_request_id required');
   const {data:reqRow,error:re}=await db.from('call_gateway_requests').select('id,company_id,created_at').eq('id',a.call_request_id).eq('company_id',company_id).maybeSingle();if(re)throw re;if(!reqRow)return err(id,-32602,'Call request not found');
   let clientId=uuid(a.client_id)?a.client_id:null,campaignId=uuid(a.campaign_id)?a.campaign_id:null,itemId=uuid(a.dialer_item_id)?a.dialer_item_id:null;
   if(!itemId){const {data:item}=await db.from('ai_dialer_items').select('id,client_id,campaign_id').eq('company_id',company_id).eq('call_request_id',reqRow.id).maybeSingle();if(item){itemId=item.id;clientId=clientId||item.client_id;campaignId=campaignId||item.campaign_id;}}
   if(clientId){const {data:c}=await db.from('clients').select('id').eq('id',clientId).eq('company_id',company_id).maybeSingle();if(!c)return err(id,-32602,'Client not found in workspace');}
   const payload={company_id,client_id:clientId,campaign_id:campaignId,dialer_item_id:itemId,call_request_id:reqRow.id,source:clean(a.source,80)||'chatgpt_voice',status:'in_progress',started_at:reqRow.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
   const {data,error}=await db.from('ai_call_transcripts').upsert(payload,{onConflict:'call_request_id'}).select().single();if(error)throw error;await audit(`start_call_transcript:${data.id}:${reqRow.id}`);return done(data);
  }
  if(name==='append_call_transcript_turn'){
   if(!uuid(a.transcript_id))return err(id,-32602,'valid transcript_id required');const speaker=clean(a.speaker,20),turnText=clean(a.text,12000);if(!['alex','prospect','unknown'].includes(speaker)||!turnText)return err(id,-32602,'valid speaker and text required');
   const {data:t}=await db.from('ai_call_transcripts').select('id,status').eq('id',a.transcript_id).eq('company_id',company_id).maybeSingle();if(!t)return err(id,-32602,'Transcript not found');if(t.status!=='in_progress')return err(id,-32602,'Transcript is not in progress');
   const {data:last}=await db.from('ai_call_transcript_turns').select('sequence_no').eq('transcript_id',t.id).order('sequence_no',{ascending:false}).limit(1).maybeSingle();const sequence=(last?.sequence_no||0)+1;
   const spoken=clean(a.spoken_at,80);const {data,error}=await db.from('ai_call_transcript_turns').insert({transcript_id:t.id,sequence_no:sequence,speaker,text:turnText,spoken_at:spoken||new Date().toISOString()}).select().single();if(error)throw error;await db.from('ai_call_transcripts').update({updated_at:new Date().toISOString()}).eq('id',t.id);return done(data);
  }
  if(name==='complete_call_transcript'){
   if(!uuid(a.transcript_id))return err(id,-32602,'valid transcript_id required');const finalStatus=clean(a.status,20)||'completed';if(!['completed','partial','failed'].includes(finalStatus))return err(id,-32602,'invalid transcript status');
   const {data:t}=await db.from('ai_call_transcripts').select('id').eq('id',a.transcript_id).eq('company_id',company_id).maybeSingle();if(!t)return err(id,-32602,'Transcript not found');
   const {data:turns,error:te}=await db.from('ai_call_transcript_turns').select('sequence_no,speaker,text,spoken_at').eq('transcript_id',t.id).order('sequence_no');if(te)throw te;
   const transcript=(turns||[]).map(x=>`${x.speaker==='alex'?'Alex':x.speaker==='prospect'?'Prospect':'Unknown'}: ${x.text}`).join('\n');
   const {data,error}=await db.from('ai_call_transcripts').update({status:finalStatus,ended_at:new Date().toISOString(),transcript_text:transcript,summary:clean(a.summary,8000)||null,updated_at:new Date().toISOString()}).eq('id',t.id).eq('company_id',company_id).select().single();if(error)throw error;await audit(`complete_call_transcript:${t.id}:${finalStatus}:${(turns||[]).length}`);return done({...data,turn_count:(turns||[]).length});
  }
  if(name==='record_activity'){const detail=clean(a.detail,1000);if(!detail)return err(id,-32602,'detail required');const payload:any={company_id,actor_id:user.id,event_type:clean(a.event_type,80)||'mcp_note',detail};if(uuid(a.candidate_id))payload.candidate_id=a.candidate_id;if(uuid(a.job_id))payload.job_id=a.job_id;const {data,error}=await db.from('activity_log').insert(payload).select().single();if(error)throw error;return done(data)}
  return err(id,-32602,'Unknown tool');
 }catch(e){console.error('talentflow-mcp',e);return err(id,-32603,e instanceof Error?e.message:'Tool failed',500)}
});