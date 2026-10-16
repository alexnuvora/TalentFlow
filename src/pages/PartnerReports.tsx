import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {BarChart3,RefreshCw} from 'lucide-react';
import {Badge,Button,Card} from '../components/Ui';
import {supabase} from '../lib/supabase';
const num=(v:unknown)=>Number(v||0).toLocaleString('en-GB');
export default function PartnerReports(){
 const [snapshot,setSnapshot]=useState<any>(null),[queue,setQueue]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');const [p,q]=await Promise.all([supabase.rpc('partner_performance_snapshot'),supabase.functions.invoke('partner-work-queue',{body:{}})]);if(p.error||q.error||q.data?.error)setError(p.error?.message||q.data?.error||q.error?.message||'Unable to load performance');setSnapshot(p.data||null);setQueue(q.data||null);setLoading(false)}
 useEffect(()=>{void load()},[]);
 const actual=snapshot?.actual||{},targets=snapshot?.targets||{},facts=[['Candidate sourcing','candidates_sourced'],['Recommendations','candidate_recommendations'],['Qualified employer opportunities','qualified_opportunities'],['Client contacts','client_contacts'],['Client meetings','meetings'],['Terms accepted','tob_acceptances'],['Placements','placements']];
 return <div className="page partner-page"><div className="page-actions"><div><div className="eyebrow">PERFORMANCE</div><h2>Reports & Analytics</h2><p>Your recruitment activity and current work queue. Only records permitted for your partner account are included.</p></div><Button variant="ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</Button></div>
 {error&&<div className="notice error" role="alert">{error}</div>}
 {loading?<Card>Loading recruiter performance…</Card>:<><div className="grid four">{facts.filter(([,key])=>Object.prototype.hasOwnProperty.call(actual,key)).map(([name,key])=><Card key={key}><span className="muted">{name}</span><h2>{num(actual[key])}</h2>{targets[key]!=null&&<p>Target {num(targets[key])}</p>}</Card>)}</div>
 <Card><h3><BarChart3 size={17}/> Workload & bottlenecks</h3><div className="grid four"><div><span className="muted">Ready to action</span><h2>{num(queue?.summary?.ready_now)}</h2></div><div><span className="muted">Urgent</span><h2>{num(queue?.summary?.urgent)}</h2></div><div><span className="muted">High priority</span><h2>{num(queue?.summary?.high)}</h2></div><div><span className="muted">Waiting</span><h2>{num(queue?.summary?.waiting)}</h2></div></div><Link className="btn" to="/dashboard/partner/tasks">Open priority work queue</Link></Card>
 <Card><h3>What needs attention</h3>{(queue?.actions||[]).slice(0,10).map((x:any,i:number)=><div className="list-row" key={x.key||i}><div><strong>{x.title}</strong><span>{x.detail}</span></div><div className="button-row"><Badge tone={x.priority==='urgent'?'red':x.priority==='high'?'amber':'neutral'}>{x.priority||'normal'}</Badge><Link className="btn ghost" to={x.route||'/dashboard/partner/tasks'}>{x.action_label||'Open'}</Link></div></div>)}{!queue?.actions?.length&&<p className="muted">There are no outstanding actions right now.</p>}</Card>
 <p className="muted">Performance reflects the existing Vorlen partner scorecard; it is not a new billing or commission calculation. The work queue changes as recruitment records are updated.</p></>}
 </div>;
}
