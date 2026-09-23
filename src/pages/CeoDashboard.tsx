import {useEffect,useState} from 'react';
import {Card,SkeletonCards} from '../components/Ui';
import {getCeoDashboard} from '../lib/api';

const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n||0));
const when=(v?:string|null)=>v?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const badge=(s?:string|null)=>{const x=String(s||'unknown').toLowerCase();return x.includes('fail')||x.includes('stale')?'red':x.includes('run')||x.includes('active')||x.includes('interest')||x.includes('complete')?'green':x.includes('callback')||x.includes('voicemail')||x.includes('queued')||x.includes('progress')?'amber':'blue'};

export default function CeoDashboard(){
 const[data,setData]=useState<any>(null),[error,setError]=useState('');
 const load=()=>getCeoDashboard().then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load();const id=setInterval(load,30000);return()=>clearInterval(id)},[]);
 if(error)return <div className="page"><div className="alert error">{error}</div></div>;
 if(!data)return <div className="page"><SkeletonCards count={8}/></div>;
 const o=data.operations||{},call=o.active_call,c=o.campaign,calls=o.calls_24h||{},out=o.outcomes||{},tx=o.transcripts||{},v=o.vacancies||{},r=o.recruitment||{};
 return <div className="page ceo-dashboard">
   <div className="page-actions ceo-head">
    <div><div className="eyebrow">CEO CONTROL ROOM</div><h2>Vorlen, right now</h2><p>Live operating picture across sales, AI calling, recruitment and cash.</p></div>
    <div className="ceo-refresh"><span className="badge green">Live</span><small>Updated {when(data.generated_at)}</small><button className="btn ghost" onClick={load}>Refresh</button></div>
   </div>

   <div className="ceo-metrics ceo-primary">
    <div className="ceo-metric"><span>Active call</span><strong>{call?call.client_name||'In progress':'None'}</strong><small>{call?call.status:'No live handset call'}</small></div>
    <div className="ceo-metric"><span>Campaign</span><strong>{c?c.name:'Idle'}</strong><small>{c?c.completed+' completed · '+c.queued+' queued':'No running campaign'}</small></div>
    <div className="ceo-metric"><span>Calls · 24h</span><strong>{calls.total||0}</strong><small>{calls.completed||0} completed · {calls.failed||0} failed</small></div>
    <div className="ceo-metric"><span>Interested</span><strong>{out.interested||0}</strong><small>{out.callback||0} callbacks due/in pipeline</small></div>
    <div className="ceo-metric"><span>Live vacancies</span><strong>{v.internal_live||0}</strong><small>{v.external_verified||0} fresh external signals</small></div>
    <div className="ceo-metric"><span>Placements</span><strong>{r.placements||0}</strong><small>{r.offers||0} offers · {r.interviews||0} interviews</small></div>
   </div>

   <div className="grid two ceo-live-grid">
    <Card>
      <div className="card-head"><div><h2>Live operations</h2><p>Current handset and AI dialler state.</p></div>{call&&<span className={'badge '+badge(call.status)}>{call.status}</span>}</div>
      {call?<>
        <div className="ceo-live-call"><div className="pulse-dot"/><div><strong>{call.client_name||'Client call'}</strong><span>Request {String(call.request_id).slice(0,8)}…</span></div></div>
        <div className="list-row"><div><strong>Call started</strong><span>{when(call.created_at)}</span></div><span className={'badge '+badge(call.transcript_status)}>{call.transcript_status||'No transcript'}</span></div>
      </>:<div className="empty small">No active call.</div>}
      {c&&<div className="campaign-progress">
        <div className="list-row"><div><strong>{c.name}</strong><span>{c.total} prospects in campaign</span></div><span className={'badge '+badge(c.status)}>{c.status}</span></div>
        <div className="progress-track"><i style={{width:(c.total?Math.round((c.completed/c.total)*100):0)+'%'}}/></div>
        <div className="campaign-stats"><span>{c.completed} completed</span><span>{c.dialing} dialing</span><span>{c.queued} queued</span><span>{c.failed} failed</span></div>
      </div>}
    </Card>

    <Card>
      <div className="card-head"><div><h2>Call outcomes</h2><p>Current client lifecycle across the prospect base.</p></div></div>
      <div className="outcome-grid">
        <div><strong>{out.interested||0}</strong><span>Interested</span></div>
        <div><strong>{out.callback||0}</strong><span>Callback</span></div>
        <div><strong>{out.voicemail||0}</strong><span>Voicemail</span></div>
        <div><strong>{out.no_answer||0}</strong><span>No answer</span></div>
        <div><strong>{out.busy||0}</strong><span>Busy</span></div>
        <div><strong>{out.not_interested||0}</strong><span>Not interested</span></div>
        <div><strong>{out.do_not_call||0}</strong><span>DNC</span></div>
      </div>
    </Card>
   </div>

   <div className="grid two">
    <Card>
      <div className="card-head"><div><h2>Recent transcripts</h2><p>Latest AI call records and transcript health.</p></div><span className="badge blue">{tx.completed||0} completed</span></div>
      {(tx.recent||[]).length?(tx.recent||[]).map((x:any)=><div className="transcript-row" key={x.id}>
        <div><strong>{x.client_name}</strong><span>{x.summary||'No summary saved'} · {when(x.started_at)}</span></div>
        <span className={'badge '+badge(x.status)}>{x.status}{!x.has_text&&x.status!=='in_progress'?' · no text':''}</span>
      </div>):<div className="empty small">No call transcripts yet.</div>}
    </Card>

    <Card>
      <div className="card-head"><div><h2>Needs attention</h2><p>Operational exceptions requiring a CEO or operator decision.</p></div><span className={'badge '+((o.attention||[]).length?'red':'green')}>{(o.attention||[]).length}</span></div>
      {(o.attention||[]).length?(o.attention||[]).slice(0,8).map((x:any,i:number)=><div className="attention-row" key={x.type+i}>
        <span className={'attention-dot '+x.severity}/><div><strong>{x.title}</strong><span>{x.detail||'Review required'} · {when(x.created_at)}</span></div>
      </div>):<div className="empty small">Nothing currently needs intervention.</div>}
    </Card>
   </div>

   <div className="ceo-metrics">
    <div className="ceo-metric"><span>Candidates</span><strong>{r.candidates||0}</strong><small>Current talent pool</small></div>
    <div className="ceo-metric"><span>Applications</span><strong>{r.applications||0}</strong><small>Across all vacancies</small></div>
    <div className="ceo-metric"><span>Interviews</span><strong>{r.interviews||0}</strong><small>Non-cancelled</small></div>
    <div className="ceo-metric"><span>Genuine vacancies</span><strong>{v.genuine_confirmed||0}</strong><small>Confirmed by client</small></div>
   </div>

   <Card>
    <div className="card-head"><div><h2>Commercial funnel</h2><p>From first employer contact through to placement.</p></div></div>
    <div className="ceo-funnel">{data.funnel.map((x:any,i:number)=><div className="ceo-funnel-step" key={x.label}><span>{x.label}</span><strong>{Number(x.value).toLocaleString()}</strong>{i>0&&<small>{x.conversion===null?'—':x.conversion+'% from previous'}</small>}</div>)}</div>
   </Card>

   <div className="grid two">
    <Card>
      <div className="card-head"><div><h2>Recent business activity</h2><p>Latest audited actions across TalentFlow.</p></div></div>
      {(o.recent_activity||[]).length?(o.recent_activity||[]).map((x:any)=><div className="activity-row" key={x.id}><div><strong>{String(x.event_type||'activity').replaceAll('_',' ')}</strong><span>{x.detail||'Activity recorded'}</span></div><time>{when(x.created_at)}</time></div>):<div className="empty small">No recent activity.</div>}
    </Card>
    <Card>
      <div className="card-head"><div><h2>Financial position</h2><p>Revenue, cash and commission.</p></div></div>
      <div className="list-row"><div><strong>Fees invoiced</strong><span>Ex VAT</span></div><strong>{money(data.finance.fees_invoiced)}</strong></div>
      <div className="list-row"><div><strong>Cash collected</strong><span>Recorded payments</span></div><strong>{money(data.finance.cash_collected)}</strong></div>
      <div className="list-row"><div><strong>Outstanding receivables</strong><span>Current amount due</span></div><strong>{money(data.finance.outstanding)}</strong></div>
      <div className="list-row"><div><strong>Partner commission</strong><span>Accrued + approved + paid</span></div><strong>{money(data.finance.partner_commission)}</strong></div>
      <div className="list-row"><div><strong>Vorlen gross profit</strong><span>Cash less partner commission</span></div><strong>{money(data.finance.gross_profit)}</strong></div>
    </Card>
   </div>

   <div className="ceo-metrics">
    <div className="ceo-metric"><span>Active subscriptions</span><strong>{data.subscriptions?.active||0}</strong><small>Active + trialling</small></div>
    <div className="ceo-metric"><span>Trials</span><strong>{data.subscriptions?.trialing||0}</strong><small>Currently trialling</small></div>
    <div className="ceo-metric"><span>Cancelling</span><strong>{data.subscriptions?.cancelling||0}</strong><small>At period end</small></div>
    <div className="ceo-metric"><span>Failed payments</span><strong>{data.subscriptions?.failed_payments||0}</strong><small>Stripe billing events</small></div>
   </div>
 </div>
}