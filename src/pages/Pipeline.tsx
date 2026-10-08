import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {Badge,Card,SkeletonCards} from '../components/Ui';
import {useWorkspaceAccess} from '../lib/access';

const stages=['new','screening','qualified','submitted','interview','offer','placed'];
const partnerStages=['sourced','contacted','screening','qualified','recommended','paused','rejected'];

export default function Pipeline(){
 const access=useWorkspaceAccess();
 const[rows,setRows]=useState<any[]>([]),[partnerRows,setPartnerRows]=useState<any[]>([]),[jobs,setJobs]=useState<any[]>([]),[clients,setClients]=useState<any[]>([]),[partners,setPartners]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const canManageShared=access.role==='owner'||access.role==='manager';

 async function load(){
  setLoading(true);setError('');
  const requests:any[]=[
   supabase.from('candidates').select('id,full_name,email,stage,score,created_at').is('erased_at',null).order('created_at',{ascending:false})
  ];
  if(canManageShared){
   requests.push(
    supabase.from('partner_candidate_pipeline').select('id,partner_id,candidate_id,job_id,stage,notes,next_action,next_action_at,manager_status,manager_notes,updated_at').order('updated_at',{ascending:false}),
    supabase.from('jobs').select('id,title,client_id,status').order('created_at',{ascending:false}),
    supabase.from('clients').select('id,company_name').order('company_name'),
    supabase.from('profiles').select('id,full_name').eq('role','partner').order('full_name')
   );
  }
  const result=await Promise.all(requests);
  const candidateResult=result[0];
  if(candidateResult.error)setError(candidateResult.error.message);
  setRows(candidateResult.data||[]);
  if(canManageShared){
   const [pipe,jobRows,clientRows,partnerProfiles]=result.slice(1);
   if(pipe.error||jobRows.error||clientRows.error||partnerProfiles.error)setError(pipe.error?.message||jobRows.error?.message||clientRows.error?.message||partnerProfiles.error?.message||'Unable to load shared vacancy pipeline');
   setPartnerRows(pipe.data||[]);setJobs(jobRows.data||[]);setClients(clientRows.data||[]);setPartners(partnerProfiles.data||[]);
  }else{
   setPartnerRows([]);setJobs([]);setClients([]);setPartners([]);
  }
  setLoading(false);
 }
 useEffect(()=>{if(!access.loading)void load()},[access.loading,access.role]);

 async function move(id:string,stage:string){
  const previous=rows.find(r=>r.id===id)?.stage;
  setBusy(id);setRows(x=>x.map(r=>r.id===id?{...r,stage}:r));
  const{error}=await supabase.from('candidates').update({stage}).eq('id',id);
  setBusy('');
  if(error){setRows(x=>x.map(r=>r.id===id?{...r,stage:previous}:r));setError(`Could not move candidate: ${error.message}`)}
 }

 async function movePartner(row:any,stage:string){
  if(!canManageShared)return;
  const previous={stage:row.stage,manager_status:row.manager_status,manager_notes:row.manager_notes};
  const patch:any={stage};
  if(stage==='recommended'&&row.stage!=='recommended'&&row.manager_status==='none')patch.manager_status='pending';
  if(stage!=='recommended'&&row.stage==='recommended'&&row.manager_status==='pending'){patch.manager_status='none';patch.manager_notes=null}
  setBusy('partner-'+row.id);setPartnerRows(x=>x.map(r=>r.id===row.id?{...r,...patch}:r));
  const{error}=await supabase.from('partner_candidate_pipeline').update(patch).eq('id',row.id);
  setBusy('');
  if(error){setPartnerRows(x=>x.map(r=>r.id===row.id?{...r,...previous}:r));setError(`Could not update shared vacancy pipeline: ${error.message}`)}
 }

 const candidateById=useMemo(()=>new Map(rows.map(x=>[x.id,x])),[rows]);
 const jobsById=useMemo(()=>new Map(jobs.map(x=>[x.id,x])),[jobs]);
 const clientsById=useMemo(()=>new Map(clients.map(x=>[x.id,x])),[clients]);
 const partnersById=useMemo(()=>new Map(partners.map(x=>[x.id,x])),[partners]);
 const managersByCandidate=useMemo(()=>{const map=new Map<string,string[]>();for(const row of partnerRows){const name=partnersById.get(row.partner_id)?.full_name||'Partner';const list=map.get(row.candidate_id)||[];if(!list.includes(name))list.push(name);map.set(row.candidate_id,list)}return map},[partnerRows,partnersById]);

 if(access.loading||loading)return <div className="page"><SkeletonCards count={4}/></div>;

 return <div className="page">
  <div className="page-actions"><div><h2>Pipeline</h2><p>Management view of shared vacancy work and the wider candidate lifecycle.</p></div></div>
  {error&&<div className="alert error" role="alert">{error}</div>}

  {canManageShared&&<section className="pipeline-section">
   <div className="card-head"><div><h2>Shared partner vacancy pipeline</h2><p>This is the same candidate × vacancy pipeline used by Vorlen partners. Changes here are immediately visible in the partner workspace, and partner changes appear here.</p></div><Badge tone="blue">{partnerRows.length} tracked</Badge></div>
   {partnerRows.length?<div className="partner-pipeline manager-shared-pipeline">{partnerStages.map(stage=>{const lane=partnerRows.filter(r=>r.stage===stage);return <div className="partner-lane" key={stage}><div className="lane-head"><strong>{stage.replaceAll('_',' ')}</strong><span>{lane.length}</span></div>{lane.map(row=>{const cand=candidateById.get(row.candidate_id),job=jobsById.get(row.job_id),client=clientsById.get(job?.client_id);const partner=partnersById.get(row.partner_id);return <Card className="candidate-card" key={row.id}><Link className="candidate-name" to={cand?'/dashboard/candidates/'+cand.id:'/dashboard/candidates'}><strong>{cand?.full_name||'Candidate'}</strong></Link><span>{job?.title||'Vacancy'}{client?.company_name?' · '+client.company_name:''}</span><span className="pipeline-owner"><strong>Managed by:</strong> {partner?.full_name||'Partner'}</span>{row.next_action&&<span>Next: {row.next_action}{row.next_action_at?' · '+new Date(row.next_action_at).toLocaleString('en-GB'):''}</span>}{row.manager_status!=='none'&&<Badge tone={row.manager_status==='approved'?'green':row.manager_status==='declined'?'red':'amber'}>{row.manager_status}</Badge>}{row.manager_notes&&<span>Vorlen review: {row.manager_notes}</span>}<select className="stage-select" aria-label={`Shared vacancy pipeline stage for ${cand?.full_name||'candidate'}`} disabled={busy==='partner-'+row.id||['approved','declined'].includes(row.manager_status)} value={row.stage} onChange={e=>void movePartner(row,e.target.value)}>{partnerStages.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></Card>})}{!lane.length&&<div className="empty small">No candidates</div>}</div>})}</div>:<Card><div className="empty small">No partner vacancy pipeline records yet.</div></Card>}
  </section>}

  <section className="pipeline-section">
   <div className="card-head"><div><h2>Candidate lifecycle</h2><p>The candidate's overall Vorlen lifecycle. This remains separate from job-specific partner pipeline stages so one candidate can be worked against more than one vacancy safely.</p></div></div>
   <div className="kanban">{stages.map(s=>{const lane=rows.filter(r=>r.stage===s);return <div className="lane" key={s}><div className="lane-head"><strong>{s}</strong><span>{lane.length}</span></div>{lane.length===0&&<div className="empty small">No candidates</div>}{lane.map(c=><Card className="candidate-card" key={c.id}><Link className="candidate-name" to={`/dashboard/candidates/${c.id}`}><strong>{c.full_name||'Unnamed candidate'}</strong></Link><span>{c.email||'No email'}</span>{managersByCandidate.get(c.id)?.length?<span className="pipeline-owner"><strong>Managed by:</strong> {managersByCandidate.get(c.id)!.join(', ')}</span>:null}{c.score!=null&&<Badge tone="blue">AI evidence score {c.score}</Badge>}<select className="stage-select" aria-label={`Candidate stage for ${c.full_name||'candidate'}`} disabled={busy===c.id} value={c.stage||'new'} onChange={e=>void move(c.id,e.target.value)}>{[...stages,'rejected','withdrawn'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></Card>)}</div>})}</div>
  </section>
 </div>
}