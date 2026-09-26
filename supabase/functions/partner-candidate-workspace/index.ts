import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const allowedOrigins=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk','http://localhost:5173','http://127.0.0.1:5173']);
const corsFor=(req:Request)=>{const origin=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsFor(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
const clean=(v:unknown,max=10000)=>{const s=String(v??'').trim();return s?s.slice(0,max):null};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsFor(req)});
 if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return json(req,{error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}}),service=createClient(url,serviceKey);
  const{data:{user},error:authError}=await userDb.auth.getUser();if(authError||!user)return json(req,{error:'Authentication required'},401);
  const{data:profile,error:profileError}=await service.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();if(profileError)throw profileError;
  if(!profile?.company_id||profile.role!=='partner')return json(req,{error:'Partner access required'},403);
  const[{data:pp,error:ppe},{data:onb,error:onbe},{data:processing,error:processingError}]=await Promise.all([
    service.from('partner_profiles').select('active,specialism').eq('user_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
    service.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
    service.rpc('candidate_processing_allowed',{p_company_id:profile.company_id})
  ]);
  if(ppe)throw ppe;if(onbe)throw onbe;if(processingError)throw processingError;
  if(!pp?.active||onb?.status!=='active'||!['candidate_sourcer','hybrid'].includes(pp.specialism||''))return json(req,{error:'Candidate sourcing access required'},403);
  if(processing!==true)return json(req,{error:'Candidate processing is not currently active.'},409);
  const body=await req.json().catch(()=>({})),action=String(body?.action||'get'),candidateId=String(body?.candidate_id||'').trim();
  if(!candidateId)return json(req,{error:'Candidate is required'},400);
  const assigned=await service.from('partner_assignments').select('id').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('candidate_id',candidateId).is('completed_at',null).limit(1);
  if(assigned.error)throw assigned.error;if(!assigned.data?.length)return json(req,{error:'Assigned candidate required'},403);
  const{data:candidate,error:candidateError}=await service.from('candidates').select('id,full_name,email,phone,location,linkedin_url,stage,next_action,next_action_at,resume_path,work_seeker_terms_agreed_at,work_seeker_terms_evidence,experience_summary,training_qualifications,authorisations,created_at,erased_at').eq('id',candidateId).eq('company_id',profile.company_id).maybeSingle();
  if(candidateError)throw candidateError;if(!candidate||candidate.erased_at)return json(req,{error:'Candidate not found'},404);

  if(action==='get'){
    const results=await Promise.all([
      service.from('partner_candidate_pipeline').select('id,job_id,stage,notes,next_action,next_action_at,manager_status,manager_notes,updated_at').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('candidate_id',candidateId).order('updated_at',{ascending:false}),
      service.from('applications').select('id,job_id,status,source,submitted_at').eq('company_id',profile.company_id).eq('candidate_id',candidateId).order('submitted_at',{ascending:false}),
      service.from('candidate_submissions').select('id,job_id,status,client_decision,client_feedback,client_rating,submitted_at,client_decision_at').eq('company_id',profile.company_id).eq('candidate_id',candidateId).order('created_at',{ascending:false}),
      service.from('interviews').select('id,job_id,client_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes,client_notes,updated_at').eq('company_id',profile.company_id).eq('candidate_id',candidateId).order('scheduled_at',{ascending:false}),
      service.from('partner_communication_events').select('id,job_id,event_type,channel,direction,subject,summary,occurred_at,metadata').eq('company_id',profile.company_id).eq('candidate_id',candidateId).order('occurred_at',{ascending:false}).limit(100),
      service.from('partner_tasks').select('id,job_id,title,description,task_type,due_at,priority,status,completed_at').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('candidate_id',candidateId).order('due_at',{ascending:true,nullsFirst:false})
    ]);
    for(const r of results)if(r.error)throw r.error;
    const[pipeline,apps,subs,interviews,events,tasks]=results.map(r=>r.data||[]);
    const jobIds=[...new Set([...pipeline,...apps,...subs,...interviews].map((x:any)=>x.job_id).filter(Boolean))] as string[];
    const jr=jobIds.length?await service.from('jobs').select('id,client_id,title,status,location').eq('company_id',profile.company_id).in('id',jobIds):{data:[],error:null};if(jr.error)throw jr.error;
    const jobs=jr.data||[],clientIds=[...new Set(jobs.map((x:any)=>x.client_id).filter(Boolean))] as string[];
    const cr=clientIds.length?await service.from('clients').select('id,company_name').eq('company_id',profile.company_id).in('id',clientIds):{data:[],error:null};if(cr.error)throw cr.error;
    return json(req,{candidate,pipeline,applications:apps,submissions:subs,interviews,events,tasks,jobs,clients:cr.data||[]});
  }

  if(action==='log_event'){
    const jobId=body?.job_id?String(body.job_id):null;
    if(jobId){const r=await service.from('partner_assignments').select('id').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('job_id',jobId).is('completed_at',null).limit(1);if(r.error)throw r.error;if(!r.data?.length)return json(req,{error:'Assigned vacancy required'},403)}
    const kind=String(body?.kind||'note');
    const map:Record<string,{event_type:string,channel:string,direction:string}>={call:{event_type:'call',channel:'phone',direction:'outbound'},email:{event_type:'email',channel:'email',direction:'outbound'},sms:{event_type:'sms',channel:'sms',direction:'outbound'},linkedin:{event_type:'linkedin',channel:'linkedin',direction:'outbound'},inbound:{event_type:'note',channel:'internal',direction:'inbound'},meeting:{event_type:'meeting',channel:'meeting',direction:'outbound'},interview:{event_type:'interview',channel:'meeting',direction:'internal'},offer:{event_type:'note',channel:'internal',direction:'internal'},withdrawal:{event_type:'note',channel:'internal',direction:'internal'},note:{event_type:'note',channel:'internal',direction:'internal'}};
    const cfg=map[kind],summary=clean(body?.summary);if(!cfg)return json(req,{error:'Invalid candidate activity type'},400);if(!summary)return json(req,{error:'Activity summary is required'},400);
    const subject=clean(body?.subject,500)||({offer:'Offer update',withdrawal:'Candidate withdrawal / availability update'} as Record<string,string>)[kind]||null;
    const r=await service.from('partner_communication_events').insert({company_id:profile.company_id,partner_id:user.id,candidate_id:candidateId,job_id:jobId,event_type:cfg.event_type,channel:cfg.channel,direction:cfg.direction,subject,summary,metadata:{workflow_kind:kind}}).select('id').single();
    if(r.error)throw r.error;return json(req,{ok:true,id:r.data.id});
  }

  if(action==='manage_interview'){
    const interviewId=String(body?.interview_id||'').trim(),operation=String(body?.operation||'');
    if(!interviewId||!['reschedule','cancel','complete','no_show'].includes(operation))return json(req,{error:'Valid interview action required'},400);
    const ir=await service.from('interviews').select('id,job_id,candidate_id,status,scheduled_at,recruiter_notes').eq('id',interviewId).eq('company_id',profile.company_id).eq('candidate_id',candidateId).maybeSingle();
    if(ir.error)throw ir.error;const i=ir.data;if(!i)return json(req,{error:'Interview not found'},404);
    const ar=await service.from('partner_assignments').select('id').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('job_id',i.job_id).is('completed_at',null).limit(1);
    if(ar.error)throw ar.error;if(!ar.data?.length)return json(req,{error:'Assigned vacancy required'},403);
    if(['completed','cancelled','no_show'].includes(i.status)&&operation!=='reschedule')return json(req,{error:'This interview is already closed'},409);
    const patch:any={updated_at:new Date().toISOString()};let summary='';
    if(operation==='reschedule'){
      const when=new Date(String(body?.scheduled_at||''));if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now())return json(req,{error:'Choose a future interview time'},400);
      patch.scheduled_at=when.toISOString();patch.status='scheduled';const d=Number(body?.duration_minutes||45);if(d<15||d>240)return json(req,{error:'Interview duration must be between 15 and 240 minutes'},400);patch.duration_minutes=d;
      if(body?.meeting_url!==undefined)patch.meeting_url=clean(body.meeting_url,2000);summary='Interview rescheduled.';
    }else{
      if((operation==='complete'||operation==='no_show')&&new Date(i.scheduled_at).getTime()>Date.now()+15*60*1000)return json(req,{error:'A future interview cannot be marked complete or no-show yet'},409);
      patch.status=operation==='cancel'?'cancelled':operation;summary=operation==='cancel'?'Interview cancelled.':operation==='complete'?'Interview marked completed.':'Interview marked no-show.';
    }
    const note=clean(body?.notes,5000);if(note)patch.recruiter_notes=[i.recruiter_notes,note].filter(Boolean).join('\n\n').slice(0,5000);
    const ur=await service.from('interviews').update(patch).eq('id',i.id).eq('company_id',profile.company_id);if(ur.error)throw ur.error;
    const er=await service.from('partner_communication_events').insert({company_id:profile.company_id,partner_id:user.id,candidate_id:candidateId,job_id:i.job_id,event_type:'interview',channel:'meeting',direction:'internal',subject:'Interview '+operation,summary:note?summary+' '+note:summary,metadata:{interview_id:i.id,operation}});if(er.error)throw er.error;
    return json(req,{ok:true});
  }
  return json(req,{error:'Invalid action'},400);
 }catch(e){console.error('partner-candidate-workspace',e);return json(req,{error:e instanceof Error?e.message:'Candidate workspace operation failed'},500)}
});