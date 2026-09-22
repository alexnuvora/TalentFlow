import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {corsHeaders} from 'npm:@supabase/supabase-js@2.95.0/cors';
const cors={...corsHeaders,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
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
  const cid=p.company_id;
  const [events,clients,jobs,apps,interviews,placements,invoices,payments,commissions,subs,billingEvents]=await Promise.all([
   db.from('client_acquisition_events').select('client_id,event_type,occurred_at').eq('company_id',cid),
   db.from('clients').select('id,status,created_at').eq('company_id',cid),
   db.from('jobs').select('id,status,created_at').eq('company_id',cid),
   db.from('applications').select('id,status,submitted_at').eq('company_id',cid),
   db.from('interviews').select('id,status,scheduled_at,created_at').eq('company_id',cid),
   db.from('placements').select('id,fee_amount,total_amount,invoice_status,invoiced_at,paid_at,created_at').eq('company_id',cid),
   db.from('invoices').select('id,status,subtotal,total,amount_paid,amount_due,issue_date,paid_at').eq('company_id',cid),
   db.from('invoice_payments').select('id,amount,status,paid_at').eq('company_id',cid),
   db.from('partner_commissions').select('id,placement_id,amount,status,paid_at').eq('company_id',cid),
   db.from('company_subscriptions').select('plan_code,status,current_period_start,current_period_end,cancel_at_period_end,created_at').eq('company_id',cid),
   db.from('billing_events').select('event_type,status,created_at').eq('company_id',cid)
  ]);
  for(const x of [events,clients,jobs,apps,interviews,placements,invoices,payments,commissions,subs,billingEvents])if(x.error)throw x.error;
  const ev=events.data||[],cl=clients.data||[],jb=jobs.data||[],ap=apps.data||[],iv=interviews.data||[],pl=placements.data||[],ins=invoices.data||[],pay=payments.data||[],com=commissions.data||[];
  const distinct=(type:string)=>new Set(ev.filter((e:any)=>e.event_type===type).map((e:any)=>e.client_id).filter(Boolean)).size;
  const contacted=distinct('contacted'),conversations=distinct('conversation'),qualified=Math.max(distinct('qualified'),cl.filter((c:any)=>['active','qualified'].includes(String(c.status))).length);
  const vacancies=jb.filter((j:any)=>!['closed','archived','draft'].includes(String(j.status))).length;
  const submitted=ap.filter((a:any)=>['submitted','client_review','interview','offer','placed'].includes(String(a.status))).length;
  const interviewCount=iv.filter((i:any)=>String(i.status)!=='cancelled').length;
  const offers=ap.filter((a:any)=>['offer','offered','placed'].includes(String(a.status))).length;
  const placementCount=pl.length;
  const feesInvoiced=ins.filter((i:any)=>!['draft','void'].includes(String(i.status))).reduce((s:number,i:any)=>s+Number(i.subtotal||0),0);
  const cashCollected=pay.filter((x:any)=>!['failed','refunded','void'].includes(String(x.status))).reduce((s:number,x:any)=>s+Number(x.amount||0),0);
  const partnerCommission=com.filter((x:any)=>String(x.status)!=='void').reduce((s:number,x:any)=>s+Number(x.amount||0),0);
  const grossProfit=cashCollected-partnerCommission;
  const funnel=[
   ['Companies contacted',contacted],['Conversations',conversations],['Qualified clients',qualified],['Live vacancies',vacancies],['Candidates submitted',submitted],['Interviews',interviewCount],['Offers',offers],['Placements',placementCount]
  ].map(([label,value],i,a)=>({label,value,conversion:i&&Number(a[i-1][1])?Math.round(Number(value)/Number(a[i-1][1])*1000)/10:null}));
  const ss=subs.data||[],be=billingEvents.data||[];const activeSubs=ss.filter((s:any)=>['active','trialing'].includes(String(s.status))).length,failedPayments=be.filter((e:any)=>e.event_type==='invoice.payment_failed').length,cancelling=ss.filter((s:any)=>s.cancel_at_period_end).length;return json({funnel,subscriptions:{active:activeSubs,trialing:ss.filter((s:any)=>s.status==='trialing').length,cancelling,failed_payments:failedPayments},finance:{fees_invoiced:feesInvoiced,cash_collected:cashCollected,partner_commission:partnerCommission,gross_profit:grossProfit,outstanding:ins.reduce((s:number,i:any)=>s+Number(i.amount_due||0),0),placements:placementCount},generated_at:new Date().toISOString()});
 }catch(e){console.error('ceo-dashboard',e);return json({error:e instanceof Error?e.message:'Unable to load CEO dashboard'},500)}
});