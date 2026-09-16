import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, LogOut, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge, Card, Empty, Button } from '../components/Ui';

export default function ClientPortal(){
  const [client,setClient]=useState<any>(null),[jobs,setJobs]=useState<any[]>([]),[candidates,setCandidates]=useState<any[]>([]),[interviews,setInterviews]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const {data,error}=await supabase.rpc('client_portal_data');
        if(error)throw error;
        if(active){setClient(data.client);setJobs(data.jobs);setCandidates(data.candidates);setInterviews(data.interviews);}
      }catch{if(active)setError('Unable to load the portal. Please check that this account has client access.');}
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false};
  },[]);
  if(loading)return <div className="public"><div className="loading">Loading client portal…</div></div>;
  if(error)return <div className="public"><Card><h2>Client portal</h2><p className="muted">{error}</p><Button onClick={()=>supabase.auth.signOut()}>Sign out</Button></Card></div>;
  return <div className="public portal"><header><div className="brand big"><div className="brand-mark">TF</div><div><strong>TalentFlow</strong><span>Client portal</span></div></div><div className="button-row"><Badge tone="green">{client?.company_name}</Badge><Button variant="ghost" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</Button></div></header>
    <section className="hero"><Badge tone="blue">Client workspace</Badge><h1>Your recruitment pipeline.</h1><p>Review active roles, submitted candidates and scheduled interviews in one place.</p></section>
    <div className="metrics"><Card className="metric"><div className="metric-label">Open roles</div><div className="metric-value">{jobs.filter(j=>j.status==='published').length}</div></Card><Card className="metric"><div className="metric-label">Candidates</div><div className="metric-value">{candidates.length}</div></Card><Card className="metric"><div className="metric-label">Interviews</div><div className="metric-value">{interviews.filter(i=>i.status==='scheduled').length}</div></Card></div>
    <div className="grid two"><Card><div className="card-head"><div><h2>Submitted candidates</h2><p>Only candidates submitted to your vacancies are visible.</p></div><Users size={20}/></div>{candidates.length===0?<Empty title="No candidates submitted" text="Your recruitment partner will add candidates here as they are qualified."/>:candidates.map((a:any)=><div className="list-row" key={a.id}><div><strong>{a.candidates?.full_name}</strong><span>{a.jobs?.title} · {a.candidates?.email}</span></div><Badge tone={a.candidates?.stage==='placed'?'green':a.candidates?.stage==='rejected'?'red':'blue'}>{a.candidates?.stage||a.status}</Badge></div>)}</Card>
    <Card><div className="card-head"><div><h2>Interviews</h2><p>Upcoming and recent interview activity.</p></div><CalendarDays size={20}/></div>{interviews.length===0?<Empty title="No interviews scheduled" text="Scheduled interviews will appear here."/>:interviews.map(i=><div className="list-row" key={i.id}><div><strong>{i.candidates?.full_name}</strong><span>{i.jobs?.title} · {new Date(i.scheduled_at).toLocaleString('en-GB')}</span></div><Badge tone={i.status==='completed'?'green':'amber'}>{i.status}</Badge></div>)}</Card></div>
    <Card><div className="card-head"><div><h2>Your vacancies</h2><p>Roles currently managed through TalentFlow.</p></div><Clock3 size={20}/></div>{jobs.map(j=><div className="list-row" key={j.id}><div><strong>{j.title}</strong><span>{j.location} · {j.employment_type}</span></div><Badge tone={j.status==='published'?'green':'neutral'}>{j.status}</Badge></div>)}</Card>
  </div>
}
