import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const pri=(p:string)=>p==='urgent'?0:p==='high'?1:p==='normal'?2:3;

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const udb=createClient(url,anon,{global:{headers:{Authorization:auth}}}),db=createClient(url,service);
  const{data:{user}}=await udb.auth.getUser();if(!user)return json({error:'Authentication required'},401);
  const{data:profile}=await udb.from('profiles').select('company_id,role,full_name').eq('id',user.id).maybeSingle();
  if(!profile||profile.role!=='partner')return json({error:'Partner access required'},403);
  const[{data:active},{data:canDevelop},{data:canClose},{data:canSource},{data:candidatePhase}]=await Promise.all([
   udb.rpc('partner_is_active'),udb.rpc('partner_can_develop_clients'),udb.rpc('partner_can_close_clients'),udb.rpc('partner_can_source_candidates'),udb.rpc('candidate_processing_allowed',{p_company_id:profile.company_id})
  ]);
  if(active!==true)return json({error:'Partner activation required'},403);

  const company=profile.company_id;const canSourceNow=canSource===true&&candidatePhase===true;
  const [
   {data:assignments},{data:tasks},{data:clients},{data:activity},{data:jobs},{data:pipeline},
   {data:candidates},{data:submissions},{data:offers},{data:interviews},{data:placements},{data:handoffs}
  ]=await Promise.all([
   db.from('partner_assignments').select('id,client_id,candidate_id,job_id,priority,objective,due_at,assigned_at').eq('company_id',company).eq('partner_id',user.id).is('completed_at',null),
   db.from('partner_tasks').select('id,title,description,task_type,client_id,candidate_id,job_id,due_at,priority,status,outreach_channel,outreach_enrollment_id').eq('company_id',company).eq('partner_id',user.id).not('status','in','("done","cancelled")'),
   db.from('clients').select('id,company_name,terms_accepted_at').eq('company_id',company),
   db.from('partner_client_activity').select('client_id,status,callback_at,last_contacted_at,updated_at').eq('company_id',company).eq('partner_id',user.id),
   db.from('jobs').select('id,client_id,title,status,location,description,requirements,required_qualifications').eq('company_id',company),
   db.from('partner_candidate_pipeline').select('id,candidate_id,job_id,stage,next_action,next_action_at,manager_status,updated_at').eq('company_id',company).eq('partner_id',user.id),
   db.from('candidates').select('id,full_name,resume_path,work_seeker_terms_agreed_at,stage').eq('company_id',company).is('erased_at',null),
   db.from('candidate_submissions').select('id,client_id,job_id,candidate_id,status,client_feedback,client_feedback_at,submitted_at,updated_at').eq('company_id',company),
   db.from('partner_candidate_offers').select('id,candidate_id,job_id,status,placement_review_status,placement_id,proposed_start_date,updated_at').eq('company_id',company).eq('partner_id',user.id),
   db.from('interviews').select('id,client_id,job_id,candidate_id,scheduled_at,status,updated_at').eq('company_id',company),
   db.from('placements').select('id,client_id,job_id,candidate_id,start_date,invoice_status,created_at').eq('company_id',company),
   db.from('partner_commercial_handoffs').select('id,client_id,approved_job_id,status,updated_at').eq('company_id',company).eq('partner_id',user.id)
  ]);

  const clientMap=new Map((clients||[]).map((x:any)=>[x.id,x])),jobMap=new Map((jobs||[]).map((x:any)=>[x.id,x])),candMap=new Map((candidates||[]).map((x:any)=>[x.id,x]));
  const activityMap=new Map((activity||[]).map((x:any)=>[x.client_id,x]));
  const assignedClients=new Set((assignments||[]).filter((x:any)=>x.client_id).map((x:any)=>x.client_id));
  const assignedJobs=new Set((assignments||[]).filter((x:any)=>x.job_id).map((x:any)=>x.job_id));
  const assignedCandidates=new Set((assignments||[]).filter((x:any)=>x.candidate_id).map((x:any)=>x.candidate_id));
  const queue:any[]=[];const waiting:any[]=[];const seen=new Set<string>();
  const add=(x:any,blocked=false)=>{const key=x.key||[x.kind,x.client_id,x.job_id,x.candidate_id,x.title].join(':');if(seen.has(key))return;seen.add(key);(blocked?waiting:queue).push({...x,key,blocked})};
  const route=(kind:string,id?:string)=>kind==='client'?'/dashboard/partner/clients'+(id?'?client='+encodeURIComponent(id):''):kind==='job'?'/dashboard/partner/vacancies':kind==='pipeline'?'/dashboard/partner/pipeline'+(id?'?job='+encodeURIComponent(id):''):kind==='candidate'&&id?'/dashboard/partner/candidates/'+id:kind==='application'?'/dashboard/partner/applications':kind==='handoff'?'/dashboard/partner/handoffs':kind==='earnings'?'/dashboard/partner/earnings':'/dashboard/partner/tasks';

  for(const t of tasks||[]) add({key:'task:'+t.id,kind:'task',source:'task',title:t.title,detail:t.description||'Recorded Vorlen task',priority:t.priority||'normal',due_at:t.due_at,client_id:t.client_id,job_id:t.job_id,candidate_id:t.candidate_id,route:'/dashboard/partner/tasks',action_label:t.outreach_channel==='email'&&t.outreach_enrollment_id?'Open task & send':'Open task'});

  if(canDevelop===true){
   for(const a of (assignments||[]).filter((x:any)=>x.client_id)){
    const c=clientMap.get(a.client_id);if(!c)continue;const ac=activityMap.get(c.id);const base={client_id:c.id,client_name:c.company_name,priority:a.priority||'normal',due_at:a.due_at};
    if(a.objective)add({...base,key:'objective:client:'+a.id,kind:'client',source:'assignment',title:a.objective,detail:'Manager-assigned objective for '+c.company_name,route:route('client',c.id),action_label:'Open client'});
    if(!ac||ac.status==='not_contacted')add({...base,key:'client:first:'+c.id,kind:'client',source:'derived',title:'Contact '+c.company_name,detail:'Identify the recruitment decision-maker, current hiring need and agreed next step.',priority:a.priority==='high'?'high':'normal',route:route('client',c.id),action_label:'Open client'});
    else if(ac.status==='call_back'&&ac.callback_at){
      const isDue=new Date(ac.callback_at)<=new Date();add({...base,key:'client:callback:'+c.id,kind:'client',source:'derived',title:(isDue?'Call back ':'Scheduled callback · ')+c.company_name,detail:isDue?'Callback is due. Record the outcome and next action.':'Callback is scheduled; no action needed before then.',priority:isDue?'urgent':'normal',due_at:ac.callback_at,route:route('client',c.id),action_label:'Open client'},!isDue);
    } else if(['no_answer','busy','contacted','send_more_info','follow_up'].includes(ac.status)){
      add({...base,key:'client:followup:'+c.id,kind:'client',source:'derived',title:'Follow up '+c.company_name,detail:'The account has no scheduled callback. Make the next touchpoint explicit.',priority:'normal',route:route('client',c.id),action_label:'Open client'});
    } else if(ac.status==='interested'){
      add({...base,key:'client:qualify:'+c.id,kind:'client',source:'derived',title:canClose===true?'Qualify the hiring requirement · '+c.company_name:'Complete qualification and hand off · '+c.company_name,detail:canClose===true?'Confirm vacancy, decision-maker, urgency and route the opportunity through authorised Vorlen terms.':'Capture hiring need, authority, urgency and objections, then request Lead Closer handover.',priority:'high',route:route('client',c.id),action_label:'Open client'});
    } else if(ac.status==='meeting_booked'){
      add({...base,key:'client:meeting:'+c.id,kind:'client',source:'derived',title:'Prepare for client meeting · '+c.company_name,detail:'Review the account timeline, hiring need, decision-maker and agreed next step before the meeting.',priority:'high',route:route('client',c.id),action_label:'Open client'});
    } else if(ac.status==='converted'&&!c.terms_accepted_at){
      add({...base,key:'client:terms:'+c.id,kind:'client',source:'derived',title:'Waiting for authorised Terms · '+c.company_name,detail:'The opportunity is ready for Vorlen terms review/acceptance. Continue relationship follow-up, but do not vary commercial terms.',priority:'normal',route:route('client',c.id),action_label:'Open client'},true);
    }
    if(canClose===true&&c.terms_accepted_at&&!Array.from(assignedJobs).some((jid:any)=>jobMap.get(jid)?.client_id===c.id)){
      add({...base,key:'client:no-vacancy:'+c.id,kind:'client',source:'derived',title:'Secure the first vacancy · '+c.company_name,detail:'Terms are accepted but no vacancy is assigned yet. Confirm the live hiring requirement and submit/link the vacancy through Vorlen.',priority:'high',route:'/dashboard/partner/handoffs?new=1&client='+encodeURIComponent(c.id),action_label:'Start vacancy handoff'});
    }
   }
  }

  for(const a of (assignments||[]).filter((x:any)=>x.job_id)){
   const j=jobMap.get(a.job_id);if(!j)continue;const c=clientMap.get(j.client_id);const base={job_id:j.id,job_name:j.title,client_id:j.client_id,client_name:c?.company_name,priority:a.priority||'normal',due_at:a.due_at};
   if(a.objective)add({...base,key:'objective:job:'+a.id,kind:'job',source:'assignment',title:a.objective,detail:'Manager-assigned objective for '+j.title,route:route('job'),action_label:'Open vacancy'});
   const rows=(pipeline||[]).filter((x:any)=>x.job_id===j.id);
   const activeRows=rows.filter((x:any)=>!['rejected','paused'].includes(x.stage));
   if(canSource===true&&candidatePhase!==true&&['draft','published'].includes(String(j.status)))add({...base,key:'job:phase:'+j.id,kind:'pipeline',source:'derived',title:'Candidate processing not yet active · '+j.title,detail:'Vorlen compliance has not activated candidate processing for this workspace, so sourcing actions are intentionally blocked.',priority:'normal',route:route('job'),action_label:'View vacancy'},true);
   if(canSourceNow&&['draft','published'].includes(String(j.status))&&activeRows.length===0){
     add({...base,key:'job:source:'+j.id,kind:'pipeline',source:'derived',title:'Start sourcing · '+j.title,detail:(j.status==='draft'?'Approved for internal delivery. ':'Published vacancy. ')+'Search Vorlen candidates first, then source externally as needed.',priority:'high',route:route('pipeline',j.id),action_label:'Start sourcing'});
   }
   if(canSourceNow){
    for(const row of activeRows){
      const cand=candMap.get(row.candidate_id);if(!cand)continue;const b={...base,candidate_id:cand.id,candidate_name:cand.full_name,kind:'candidate',source:'derived',route:route('candidate',cand.id),action_label:'Open candidate'};
      if(row.next_action)add({...b,key:'pipe:next:'+row.id,title:row.next_action,detail:'Explicit next action for '+cand.full_name+' on '+j.title,priority:row.next_action_at&&new Date(row.next_action_at)<=new Date()?'urgent':'normal',due_at:row.next_action_at});
      else if(row.stage==='sourced')add({...b,key:'pipe:sourced:'+row.id,title:'Contact '+cand.full_name,detail:'Confirm interest in '+j.title+', work-seeker terms and permission to progress.',priority:'high'});
      else if(row.stage==='contacted'&&!cand.work_seeker_terms_agreed_at)add({...b,key:'pipe:terms:'+row.id,title:'Record candidate terms · '+cand.full_name,detail:'Work-seeker terms must be evidenced before progressing recruitment activity.',priority:'high'});
      else if(row.stage==='contacted'&&!cand.resume_path)add({...b,key:'pipe:cv:'+row.id,title:'Obtain CV · '+cand.full_name,detail:'Securely upload the candidate-provided/authorised CV before screening.',priority:'high'});
      else if(row.stage==='contacted')add({...b,key:'pipe:screen:'+row.id,title:'Screen '+cand.full_name,detail:'Assess explicit evidence against '+j.title+' and record gaps/next action.',priority:'high'});
      else if(row.stage==='screening')add({...b,key:'pipe:qualify:'+row.id,title:'Complete qualification · '+cand.full_name,detail:'Finish screening and move only evidenced suitable candidates to qualified.',priority:'high'});
      else if(row.stage==='qualified')add({...b,key:'pipe:recommend:'+row.id,title:'Recommend '+cand.full_name+' to Vorlen',detail:'Prepare the evidence-based recommendation for human review. This is not yet a client submission.',priority:'high'});
      else if(row.stage==='recommended'&&['none','pending'].includes(row.manager_status||'none'))add({...b,key:'pipe:review:'+row.id,title:'Vorlen review pending · '+cand.full_name,detail:'Recommendation is with Vorlen for human review. No duplicate action is needed.',priority:'normal'},true);
      else if(row.stage==='recommended'&&row.manager_status==='approved'&&!(submissions||[]).some((s:any)=>s.job_id===j.id&&s.candidate_id===cand.id&&!['draft','withdrawn'].includes(s.status)))add({...b,key:'pipe:submission:'+row.id,title:'Prepare submission pack · '+cand.full_name,detail:'Vorlen approved the recommendation. Complete the controlled submission workflow for '+j.title+'.',priority:'high'});
    }
   }
  }

  for(const s of submissions||[]){
   if(!assignedJobs.has(s.job_id)&&!assignedCandidates.has(s.candidate_id))continue;
   const j=jobMap.get(s.job_id),c=clientMap.get(s.client_id),cand=candMap.get(s.candidate_id);if(!j||!cand)continue;
   if(['submitted','reviewing'].includes(s.status)&&!s.client_feedback){
     if(canClose===true&&assignedJobs.has(s.job_id))add({key:'submission:feedback:'+s.id,kind:'application',source:'derived',title:'Chase client feedback · '+cand.full_name,detail:(c?.company_name||'Client')+' has '+cand.full_name+' for '+j.title+'. Record feedback or the agreed next step.',priority:'high',client_id:s.client_id,job_id:s.job_id,candidate_id:s.candidate_id,route:route('client',s.client_id),action_label:'Open client'});
     else add({key:'submission:wait:'+s.id,kind:'application',source:'derived',title:'Client feedback pending · '+cand.full_name,detail:'The official submission is with '+(c?.company_name||'the client')+'.',priority:'normal',job_id:s.job_id,candidate_id:s.candidate_id,route:route('application'),action_label:'Open applications'},true);
   }
   if(s.status==='interview_requested'&&canSourceNow)add({key:'submission:interview:'+s.id,kind:'candidate',source:'derived',title:'Arrange interview · '+cand.full_name,detail:'Client requested an interview for '+j.title+'. Coordinate the authorised interview workflow.',priority:'urgent',job_id:s.job_id,candidate_id:s.candidate_id,route:'/dashboard/partner/talent?job='+encodeURIComponent(j.id)+'&candidate='+encodeURIComponent(cand.id),action_label:'Prepare pack'});
  }

  for(const i of interviews||[]){
   if(!assignedJobs.has(i.job_id)&&!assignedCandidates.has(i.candidate_id))continue;
   const cand=candMap.get(i.candidate_id),j=jobMap.get(i.job_id);if(!cand||!j)continue;
   if(i.status==='scheduled'){
     const when=new Date(i.scheduled_at),soon=when.getTime()-Date.now()<=24*3600*1000;
     add({key:'interview:'+i.id,kind:'candidate',source:'derived',title:(soon?'Interview due soon · ':'Prepare interview · ')+cand.full_name,detail:j.title+' · '+when.toLocaleString('en-GB'),priority:soon?'urgent':'high',due_at:i.scheduled_at,job_id:i.job_id,candidate_id:i.candidate_id,route:route('candidate',cand.id),action_label:'Open candidate'});
   }
  }

  for(const o of offers||[]){
   const cand=candMap.get(o.candidate_id),j=jobMap.get(o.job_id);if(!cand||!j)continue;
   if(o.status==='extended')add({key:'offer:follow:'+o.id,kind:'candidate',source:'derived',title:'Follow up offer · '+cand.full_name,detail:'Offer is outstanding for '+j.title+'. Record acceptance, decline or withdrawal with evidence.',priority:'urgent',job_id:o.job_id,candidate_id:o.candidate_id,route:route('candidate',cand.id),action_label:'Open offer'});
   else if(o.status==='accepted'&&['requested','under_review'].includes(o.placement_review_status))add({key:'offer:placement:'+o.id,kind:'candidate',source:'derived',title:'Placement confirmation pending · '+cand.full_name,detail:'Accepted offer has been sent to Vorlen for authoritative placement review.',priority:'normal',job_id:o.job_id,candidate_id:o.candidate_id,route:route('candidate',cand.id),action_label:'Open candidate'},true);
  }

  for(const h of handoffs||[]){
   if(['submitted','under_review'].includes(h.status))add({key:'handoff:'+h.id,kind:'handoff',source:'derived',title:'Commercial handoff under review',detail:'Vorlen is reviewing the submitted employer/vacancy opportunity.',priority:'normal',client_id:h.client_id,job_id:h.approved_job_id,route:route('handoff'),action_label:'Open handoffs'},true);
  }

  const sort=(a:any,b:any)=>pri(a.priority)-pri(b.priority)||(+new Date(a.due_at||'2999-01-01'))-(+new Date(b.due_at||'2999-01-01'))||a.title.localeCompare(b.title);
  queue.sort(sort);waiting.sort(sort);
  return json({
   generated_at:new Date().toISOString(),
   role:{can_develop_clients:canDevelop===true,can_close_clients:canClose===true,can_source_candidates:canSource===true,candidate_processing_active:candidatePhase===true},
   summary:{ready_now:queue.length,waiting:waiting.length,urgent:queue.filter(x=>x.priority==='urgent').length,high:queue.filter(x=>x.priority==='high').length},
   actions:queue.slice(0,80),waiting:waiting.slice(0,50)
  });
 }catch(e){console.error('partner-work-queue failed',e instanceof Error?e.message:String(e));return json({error:e instanceof Error?e.message:'Unable to build partner work queue'},500)}
});