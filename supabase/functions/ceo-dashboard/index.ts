import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {corsHeaders} from 'npm:@supabase/supabase-js@2.95.0/cors';
const cors={...corsHeaders,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
const n=(v:unknown)=>Number(v||0);
const recent=(iso:string|null|undefined,hours=24)=>!!iso&&Date.now()-new Date(iso).getTime()<=hours*3600000;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)return json({error:'Server configuration error'},503);
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await userDb.auth.getUser();if(!user)return json({error:'Authentication required'},401);
  const db=createClient(url,service);const {data:p}=await db.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
  if(!p?.company_id||p.role!=='owner')return json({error:'Owner access required'},403);
  const cid=p.company_id, since24=new Date(Date.now()-86400000).toISOString(), staleCutoff=new Date(Date.now()-5*60000).toISOString();
  const [events,clients,jobs,candidates,apps,interviews,placements,invoices,payments,commissions,subs,billingEvents,campaigns,dialerItems,callRequests,transcripts,externalVacancies,activities]=await Promise.all([
   db.from('client_acquisition_events').select('client_id,event_type,occurred_at').eq('company_id',cid),
   db.from('clients').select('id,company_name,status,call_status,last_contacted_at,next_call_at,call_attempts,last_call_outcome,recruitment_fee_percent,payment_terms_days').eq('company_id',cid),
   db.from('jobs').select('id,client_id,title,status,created_at,genuine_vacancy_confirmed_at').eq('company_id',cid),
   db.from('candidates').select('id,stage,created_at').eq('company_id',cid).is('erased_at',null),
   db.from('applications').select('id,status,submitted_at').eq('company_id',cid),
   db.from('interviews').select('id,status,scheduled_at,created_at').eq('company_id',cid),
   db.from('placements').select('id,fee_amount,total_amount,invoice_status,invoiced_at,paid_at,created_at').eq('company_id',cid),
   db.from('invoices').select('id,status,subtotal,total,amount_paid,amount_due,issue_date,paid_at').eq('company_id',cid),
   db.from('invoice_payments').select('id,amount,status,paid_at').eq('company_id',cid),
   db.from('partner_commissions').select('id,placement_id,amount,status,paid_at').eq('company_id',cid),
   db.from('company_subscriptions').select('plan_code,status,current_period_start,current_period_end,cancel_at_period_end,created_at').eq('company_id',cid),
   db.from('billing_events').select('event_type,status,created_at').eq('company_id',cid),
   db.from('ai_dialer_campaigns').select('id,name,status,started_at,completed_at,next_call_after,created_at,max_calls').eq('company_id',cid).order('created_at',{ascending:false}).limit(20),
   db.from('ai_dialer_items').select('id,campaign_id,client_id,status,outcome,last_error,attempts,call_request_id,created_at,completed_at,research_status').eq('company_id',cid).order('created_at',{ascending:false}).limit(500),
   db.from('call_gateway_requests').select('id,phone_number,status,claimed_at,completed_at,error,created_at').eq('company_id',cid).order('created_at',{ascending:false}).limit(200),
   db.from('ai_call_transcripts').select('id,client_id,campaign_id,dialer_item_id,call_request_id,status,started_at,ended_at,summary,transcript_text,updated_at').eq('company_id',cid).order('started_at',{ascending:false}).limit(25),
   db.from('client_external_vacancies').select('id,client_id,title,location,status,last_verified_at,expires_at,source_url').eq('company_id',cid).order('last_verified_at',{ascending:false}).limit(100),
   db.from('activity_log').select('id,event_type,detail,created_at').eq('company_id',cid).order('created_at',{ascending:false}).limit(30)
  ]);
  const all=[events,clients,jobs,candidates,apps,interviews,placements,invoices,payments,commissions,subs,billingEvents,campaigns,dialerItems,callRequests,transcripts,externalVacancies,activities];
  for(const x of all)if(x.error)throw x.error;
  const ev=events.data||[],cl=clients.data||[],jb=jobs.data||[],cand=candidates.data||[],ap=apps.data||[],iv=interviews.data||[],pl=placements.data||[],ins=invoices.data||[],pay=payments.data||[],com=commissions.data||[];
  const camps=campaigns.data||[],items=dialerItems.data||[],calls=callRequests.data||[],tx=transcripts.data||[],ext=externalVacancies.data||[],acts=activities.data||[];
  const clientMap=new Map(cl.map((x:any)=>[x.id,x]));
  const distinct=(type:string)=>new Set(ev.filter((e:any)=>e.event_type===type).map((e:any)=>e.client_id).filter(Boolean)).size;
  const contacted=distinct('contacted'),conversations=distinct('conversation'),qualified=Math.max(distinct('qualified'),cl.filter((c:any)=>['active','qualified'].includes(String(c.status))).length);
  const vacancies=jb.filter((j:any)=>!['closed','archived','draft'].includes(String(j.status))).length;
  const submitted=ap.filter((a:any)=>['submitted','client_review','interview','offer','placed'].includes(String(a.status))).length;
  const interviewCount=iv.filter((i:any)=>String(i.status)!=='cancelled').length;
  const offers=ap.filter((a:any)=>['offer','offered','placed'].includes(String(a.status))).length;
  const placementCount=pl.length;
  const feesInvoiced=ins.filter((i:any)=>!['draft','void'].includes(String(i.status))).reduce((s:number,i:any)=>s+n(i.subtotal),0);
  const cashCollected=pay.filter((x:any)=>!['failed','refunded','void'].includes(String(x.status))).reduce((s:number,x:any)=>s+n(x.amount),0);
  const partnerCommission=com.filter((x:any)=>String(x.status)!=='void').reduce((s:number,x:any)=>s+n(x.amount),0);
  const grossProfit=cashCollected-partnerCommission;
  const funnel=[['Companies contacted',contacted],['Conversations',conversations],['Qualified clients',qualified],['Live vacancies',vacancies],['Candidates submitted',submitted],['Interviews',interviewCount],['Offers',offers],['Placements',placementCount]].map(([label,value],i,a)=>({label,value,conversion:i&&n(a[i-1][1])?Math.round(n(value)/n(a[i-1][1])*1000)/10:null}));
  const ss=subs.data||[],be=billingEvents.data||[];const activeSubs=ss.filter((s:any)=>['active','trialing'].includes(String(s.status))).length,failedPayments=be.filter((e:any)=>e.event_type==='invoice.payment_failed').length,cancelling=ss.filter((s:any)=>s.cancel_at_period_end).length;
  const calls24=calls.filter((x:any)=>x.created_at>=since24), callStatus=(s:string)=>cl.filter((x:any)=>String(x.call_status)===s).length;
  const activeRequest=calls.find((x:any)=>['approved','claimed'].includes(String(x.status)))||null;
  const activeItem=activeRequest?items.find((x:any)=>x.call_request_id===activeRequest.id):null;
  const activeClient=activeItem?clientMap.get(activeItem.client_id):null;
  const activeTranscript=activeRequest?tx.find((x:any)=>x.call_request_id===activeRequest.id):null;
  const runningCampaign=camps.find((x:any)=>x.status==='running')||null;
  const campaignItems=runningCampaign?items.filter((x:any)=>x.campaign_id===runningCampaign.id):[];
  const campaignProgress=runningCampaign?{id:runningCampaign.id,name:runningCampaign.name,status:runningCampaign.status,queued:campaignItems.filter((x:any)=>x.status==='queued').length,dialing:campaignItems.filter((x:any)=>x.status==='dialing').length,completed:campaignItems.filter((x:any)=>x.status==='completed').length,failed:campaignItems.filter((x:any)=>x.status==='failed').length,total:campaignItems.length,next_call_after:runningCampaign.next_call_after}:null;
  const recentTranscripts=tx.slice(0,8).map((t:any)=>({id:t.id,client_id:t.client_id,client_name:clientMap.get(t.client_id)?.company_name||'Unknown client',status:t.status,started_at:t.started_at,ended_at:t.ended_at,summary:t.summary,has_text:!!t.transcript_text,call_request_id:t.call_request_id}));
  const staleCalls=calls.filter((x:any)=>['approved','claimed'].includes(String(x.status))&&x.created_at<staleCutoff);
  const staleTranscripts=tx.filter((x:any)=>x.status==='in_progress'&&x.started_at<staleCutoff);
  const failedItems=items.filter((x:any)=>x.status==='failed').slice(0,10);
  const overdueCallbacks=cl.filter((x:any)=>x.call_status==='callback'&&x.next_call_at&&new Date(x.next_call_at).getTime()<Date.now());
  const missingTerms=cl.filter((x:any)=>['interested','contacted','callback'].includes(String(x.call_status))&&(x.recruitment_fee_percent==null||x.payment_terms_days==null));
  const attention=[
   ...staleCalls.map((x:any)=>({type:'stale_call',severity:'high',title:'Stale call request',detail:x.error||'Call still appears active after 5 minutes',created_at:x.created_at,request_id:x.id})),
   ...staleTranscripts.map((x:any)=>({type:'stale_transcript',severity:'high',title:'Transcript still in progress',detail:clientMap.get(x.client_id)?.company_name||'Unknown client',created_at:x.started_at,transcript_id:x.id})),
   ...failedItems.map((x:any)=>({type:'failed_dialer_item',severity:'medium',title:'Dialler item failed',detail:x.last_error||x.outcome||clientMap.get(x.client_id)?.company_name||'Unknown client',created_at:x.completed_at||x.created_at})),
   ...overdueCallbacks.map((x:any)=>({type:'overdue_callback',severity:'medium',title:'Callback overdue',detail:x.company_name,created_at:x.next_call_at})),
   ...missingTerms.slice(0,10).map((x:any)=>({type:'missing_terms',severity:'low',title:'Commercial terms incomplete',detail:x.company_name,created_at:x.last_contacted_at}))
  ].sort((a:any,b:any)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime()).slice(0,20);
  return json({
   operations:{
    active_call:activeRequest?{request_id:activeRequest.id,status:activeRequest.status,created_at:activeRequest.created_at,claimed_at:activeRequest.claimed_at,client_id:activeItem?.client_id||null,client_name:activeClient?.company_name||null,transcript_status:activeTranscript?.status||null}:null,
    campaign:campaignProgress,
    calls_24h:{total:calls24.length,completed:calls24.filter((x:any)=>x.status==='completed').length,failed:calls24.filter((x:any)=>x.status==='failed').length,active:calls24.filter((x:any)=>['approved','claimed'].includes(String(x.status))).length},
    outcomes:{interested:callStatus('interested'),callback:callStatus('callback'),voicemail:callStatus('voicemail'),no_answer:callStatus('no_answer'),busy:callStatus('busy'),not_interested:callStatus('not_interested'),do_not_call:callStatus('do_not_call')},
    transcripts:{recent:recentTranscripts,in_progress:tx.filter((x:any)=>x.status==='in_progress').length,completed:tx.filter((x:any)=>x.status==='completed').length,failed:tx.filter((x:any)=>x.status==='failed').length},
    vacancies:{internal_live:vacancies,genuine_confirmed:jb.filter((x:any)=>!!x.genuine_vacancy_confirmed_at).length,external_verified:ext.filter((x:any)=>x.status==='verified'&&(!x.expires_at||new Date(x.expires_at).getTime()>Date.now())).length},
    recruitment:{candidates:cand.length,applications:ap.length,interviews:interviewCount,offers,placements:placementCount},
    attention,
    recent_activity:acts.slice(0,12)
   },
   funnel,
   subscriptions:{active:activeSubs,trialing:ss.filter((s:any)=>s.status==='trialing').length,cancelling,failed_payments:failedPayments},
   finance:{fees_invoiced:feesInvoiced,cash_collected:cashCollected,partner_commission:partnerCommission,gross_profit:grossProfit,outstanding:ins.reduce((s:number,i:any)=>s+n(i.amount_due),0),placements:placementCount},
   generated_at:new Date().toISOString()
  });
 }catch(e){console.error('ceo-dashboard',e);return json({error:e instanceof Error?e.message:'Unable to load CEO dashboard'},500)}
});