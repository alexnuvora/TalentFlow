import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {CalendarDays,RefreshCw} from 'lucide-react';
import {Badge,Button,Card} from '../components/Ui';
import {supabase} from '../lib/supabase';

const fmt=(d:string)=>new Date(d).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
export default function PartnerCalendar(){
 const [entries,setEntries]=useState<any[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const refresh=async()=>{setBusy(true);setError('');const{data,error:e}=await supabase.functions.invoke('partner-candidate-workspace',{body:{action:'calendar'}});if(e||data?.error){setError(data?.error||e?.message||'Could not load calendar');setEntries([])}else{
 const meetings=(data.interviews||[]).map((x:any)=>({...x,type:'interview',when:x.scheduled_at,title:'Candidate interview'}));
 const tasks=(data.tasks||[]).filter((x:any)=>x.due_at).map((x:any)=>({...x,type:'task',when:x.due_at}));
 setEntries([...meetings,...tasks].sort((a:any,b:any)=>new Date(a.when).getTime()-new Date(b.when).getTime()));
 }setBusy(false)};
 useEffect(()=>{void refresh()},[]);
 const groups=useMemo(()=>{const output:Record<string,any[]>={};for(const e of entries){const k=new Date(e.when).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});(output[k]||=[]).push(e)}return Object.entries(output)},[entries]);
 return <div className="page partner-page"><div className="page-actions"><div><div className="eyebrow">MY WORKSPACE</div><h2>My Calendar</h2><p>Your assigned candidate interviews and scheduled work, based on live records. No events are created automatically by this view.</p></div><Button variant="ghost" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</Button></div>
 {error&&<div className="notice error" role="alert">{error}</div>}
 {busy?<Card>Loading your schedule…</Card>:groups.length?groups.map(([day,rows])=><Card key={day}><h3><CalendarDays size={17}/> {day}</h3>{rows.map((e:any)=><div className="list-row" key={e.type+'-'+e.id}><div><strong>{fmt(e.when)} · {e.title}</strong><span>{e.type==='interview'?('Interview · '+String(e.status||'scheduled').replaceAll('_',' ')):(e.description||String(e.status||'open').replaceAll('_',' '))}</span></div><div className="button-row"><Badge tone={e.type==='interview'?'blue':'neutral'}>{e.type==='interview'?'Interview':'Task'}</Badge><Link className="btn ghost" to={e.candidate_id?'/dashboard/partner/candidates/'+e.candidate_id:'/dashboard/partner/tasks'}>Open record</Link></div></div>)}</Card>):<Card><h3>No scheduled items</h3><p>There are no assigned interviews or due tasks in the current calendar window (last 30 days through the next 120 days).</p><Link className="btn ghost" to="/dashboard/partner/tasks">Open My Tasks</Link></Card>}
 </div>;
}
