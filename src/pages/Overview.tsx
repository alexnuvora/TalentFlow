import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Card,Badge,SkeletonCards} from '../components/Ui';
import {Metric} from '../components/Metric';
import {getDashboard} from '../lib/api';
import {useWorkspaceAccess} from '../lib/access';

const planPrice=(name:string)=>({starter:49,growth:99,scale:199} as Record<string,number>)[name.toLowerCase()];
const usageValue=(usage:any,...keys:string[])=>{for(const key of keys)if(usage?.[key]!==undefined)return Number(usage[key]||0);return 0};
const limitValue=(limits:any,...keys:string[])=>{for(const key of keys)if(limits?.[key]!==undefined)return Number(limits[key]);return null};
const allowance=(used:number,limit:number|null)=>limit===null?'Not available':limit<0?`${used.toLocaleString()} used · Unlimited`:`${used.toLocaleString()} of ${limit.toLocaleString()} used`;

export default function Overview(){
  const[data,setData]=useState<any>(null),[error,setError]=useState('');
  const access=useWorkspaceAccess();
  useEffect(()=>{getDashboard().then(setData).catch(e=>setError(e.message))},[]);
  const stats=useMemo(()=>{const candidates=data?.candidates||[],jobs=data?.jobs||[],apps=data?.applications||[];return{placed:candidates.filter((c:any)=>c.stage==='placed').length,qualified:candidates.filter((c:any)=>['qualified','submitted','interview','offer','placed'].includes(c.stage)).length,published:jobs.filter((j:any)=>j.status==='published').length,candidates,jobs,apps}},[data]);
  if(error)return <div className="page"><div className="alert error" role="alert">{error}</div><p className="muted">TalentFlow could not load your workspace. Retry the page; if the problem persists, ask a workspace owner to check Settings.</p></div>;
  if(!data||access.loading)return <div className="page"><SkeletonCards count={4}/></div>;

  const limits=access.subscription?.limits||{},usage=access.subscription?.usage||{},features=access.subscription?.features||{};
  const planName=access.subscription?.plan_name||'Your plan';
  const price=planPrice(planName);
  const recruitersLimit=limitValue(limits,'recruiters','recruiter_limit','recruiter_seats');
  const jobsLimit=limitValue(limits,'active_jobs','active_job_limit','jobs');
  const candidatesLimit=limitValue(limits,'candidates','candidate_limit');
  const recruiterUsage=usageValue(usage,'recruiters','recruiter_seats');
  const jobsUsage=usageValue(usage,'active_jobs','jobs')||stats.published;
  const candidateUsage=usageValue(usage,'candidates')||stats.candidates.length;
  const status=access.subscription?.status||'not configured';
  const setup=[{done:(data.clients||[]).length>0,label:'Add your first client',to:'/dashboard/clients'},{done:stats.jobs.length>0,label:'Create a job',to:'/dashboard/jobs'},{done:stats.published>0,label:'Publish a role',to:'/dashboard/jobs'},{done:stats.candidates.length>0,label:'Receive or add a candidate',to:'/dashboard/candidates'}];
  const setupDone=setup.filter(x=>x.done).length;

  return <div className="page overview-page">
    <div className="page-actions"><div><div className="eyebrow">WORKSPACE</div><h2>Overview</h2><p>What needs attention across your recruitment operation.</p></div><div className="button-row"><Link className="btn ghost" to="/dashboard/jobs">Create job</Link><Link className="btn" to="/dashboard/candidates">Add candidate</Link></div></div>
    {access.error&&<div className="notice">Plan information could not be loaded: {access.error}</div>}
    <div className="metrics"><Metric label="Active jobs" value={stats.published} detail={`${stats.jobs.length} total`}/><Metric label="Candidate pipeline" value={stats.candidates.length} detail={`${stats.qualified} qualified+`}/><Metric label="Applications" value={stats.apps.length}/><Metric label="Placements" value={stats.placed}/></div>
    <div className="grid two">
      <Card><div className="card-head"><div><h2>{setupDone===setup.length?'Workspace ready':'Get set up'}</h2><p>{setupDone}/{setup.length} core steps complete.</p></div><Badge tone={setupDone===setup.length?'green':'blue'}>{Math.round(setupDone/setup.length*100)}%</Badge></div>{setup.map(x=><Link className="list-row overview-row-link" key={x.label} to={x.to}><div><strong>{x.done?'✓ ':''}{x.label}</strong><span>{x.done?'Complete':'Open this step'}</span></div><span className="row-arrow" aria-hidden="true">→</span></Link>)}</Card>
      <Card className="overview-plan-card">
        <div className="overview-plan-head"><div><div className="eyebrow">CURRENT PLAN</div><div className="overview-plan-title"><h2>{planName}</h2><Badge tone={['active','trialing'].includes(status)?'green':'amber'}>{status==='trialing'?'Trial':status}</Badge></div><p>{price!==undefined?`£${price}/month · `:''}Your workspace capacity and included tools.</p></div>{access.canManageBilling&&<Link className="btn ghost overview-manage-plan" to="/dashboard/billing">Manage plan</Link>}</div>
        <div className="overview-plan-capacity">
          <div><span>Recruiter seats</span><strong>{recruitersLimit===null?'—':recruitersLimit<0?'Unlimited':recruitersLimit.toLocaleString()}</strong><small>{recruitersLimit===null?'Plan allowance unavailable':allowance(recruiterUsage,recruitersLimit)}</small></div>
          <div><span>Active jobs</span><strong>{jobsLimit===null?'—':jobsLimit<0?'Unlimited':jobsLimit.toLocaleString()}</strong><small>{jobsLimit===null?'Plan allowance unavailable':allowance(jobsUsage,jobsLimit)}</small></div>
          <div><span>Candidate capacity</span><strong>{candidatesLimit===null?'—':candidatesLimit<0?'Unlimited':candidatesLimit.toLocaleString()}</strong><small>{candidatesLimit===null?'Plan allowance unavailable':`${candidateUsage.toLocaleString()} currently stored`}</small></div>
        </div>
        <div className="overview-plan-features"><span className={features.ai_screening?'included':'locked'}>{features.ai_screening?'✓':'–'} AI screening</span><span className={features.client_portal?'included':'locked'}>{features.client_portal?'✓':'–'} Client portal</span><span className={features.automations?'included':'locked'}>{features.automations?'✓':'–'} Automations</span>{features.priority_support&&<span className="included">✓ Priority support</span>}</div>
        {!features.automations&&access.canManageBilling&&<div className="overview-plan-upgrade"><span><strong>Need workflow automations?</strong><small>Growth and Scale add automation capacity for repetitive recruitment tasks.</small></span><Link className="text-link" to="/dashboard/billing">Compare plans →</Link></div>}
      </Card>
    </div>
    <div className="grid two"><Card><div className="card-head"><div><h2>Live jobs</h2><p>Roles currently accepting candidates.</p></div><Link className="text-link" to="/dashboard/jobs">View all jobs</Link></div>{stats.jobs.filter((j:any)=>j.status==='published').slice(0,5).map((j:any)=><div className="list-row" key={j.id}><div><strong>{j.title}</strong><span>{j.location||'Location not set'} · {j.employment_type||'Type not set'}</span></div><Badge tone="green">Published</Badge></div>)}{stats.published===0&&<div className="empty small"><p>No published jobs yet.</p><Link className="text-link" to="/dashboard/jobs">Create or publish a role</Link></div>}</Card><Card><div className="card-head"><div><h2>Recent candidates</h2><p>Latest people entering your funnel.</p></div><Link className="text-link" to="/dashboard/candidates">View all candidates</Link></div>{stats.candidates.slice(0,6).map((c:any)=><Link className="list-row overview-row-link" to={`/dashboard/candidates/${c.id}`} key={c.id}><div><strong>{c.full_name||'Unnamed candidate'}</strong><span>{c.email||'No email'} · {c.source||'Direct'}</span></div><Badge tone={c.stage==='placed'?'green':c.stage==='rejected'?'red':'blue'}>{c.stage||'new'}</Badge></Link>)}{stats.candidates.length===0&&<div className="empty small"><p>No candidates yet.</p><Link className="text-link" to="/dashboard/candidates">Add a candidate</Link></div>}</Card></div>
    <Card><div className="card-head"><div><h2>Recruitment flow</h2><p>TalentFlow keeps the hand-offs visible while AI remains decision support, not the hiring decision-maker.</p></div></div><div className="funnel"><span>Traffic</span><i>→</i><span>Application</span><i>→</i><span>AI evidence</span><i>→</i><span>Recruiter review</span><i>→</i><span>Client interview</span><i>→</i><span>Placement</span></div></Card>
  </div>
}
