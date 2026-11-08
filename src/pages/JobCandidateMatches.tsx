import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Search,FileText,BriefcaseBusiness,MapPin,ArrowUpRight,RefreshCw} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {Card,Button,Badge} from '../components/Ui';
import {CandidateCvActions} from '../components/CandidateCvActions';

type Job={id:string;title:string;location:string|null;status:string;partner_sourcing_state:string|null};
type Match={candidate_id:string;full_name:string;location:string|null;stage:string;experience_summary:string|null;training_qualifications:string|null;authorisations:string|null;match_score:number;match_reasons:string[];work_seeker_terms_agreed:boolean;already_applied:boolean};

export default function JobCandidateMatches(){
 const [params,setParams]=useSearchParams();
 const requestedJob=params.get('job')||'';
 const [jobs,setJobs]=useState<Job[]>([]);
 const [jobId,setJobId]=useState(requestedJob);
 const [query,setQuery]=useState('');
 const [results,setResults]=useState<Match[]>([]);
 const [loading,setLoading]=useState(true);
 const [searching,setSearching]=useState(false);
 const [searched,setSearched]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  let alive=true;
  (async()=>{
   setLoading(true);setError('');
   const {data,error}=await supabase.from('jobs').select('id,title,location,status,partner_sourcing_state').order('created_at',{ascending:false});
   if(!alive)return;
   if(error){setError(error.message);setLoading(false);return;}
   const eligible=(data||[]).filter((j:any)=>j.status!=='closed'&&j.status!=='paused'&&(j.status==='published'||j.partner_sourcing_state==='internal_sourcing_approved')) as Job[];
   setJobs(eligible);
   const selected=eligible.find(j=>j.id===requestedJob)||eligible[0];
   if(selected){setJobId(selected.id);if(selected.id!==requestedJob)setParams({job:selected.id},{replace:true});}
   else{setJobId('');setResults([]);}
   setLoading(false);
  })();
  return()=>{alive=false;};
 },[requestedJob,setParams]);

 async function findMatches(){
  if(!jobId||searching)return;
  setSearching(true);setError('');setSearched(true);
  const {data,error}=await supabase.rpc('manager_job_candidate_matches',{p_job:jobId,p_query:query.trim()||null,p_limit:50});
  if(error){setResults([]);setError(error.message);}
  else setResults((data||[]) as Match[]);
  setSearching(false);
 }
 const selected=jobs.find(j=>j.id===jobId);
 return <div className="page">
  <div className="page-actions">
   <div><div className="eyebrow">VORLEN TALENT SEARCH</div><h2>CV Match Finder</h2><p>Find existing Vorlen candidates with an uploaded CV, ranked against an approved vacancy.</p></div>
  </div>
  <Card>
   <div className="card-head"><div><h3><BriefcaseBusiness size={17}/> Choose a vacancy</h3><p>Research-only opportunities are excluded. Only published or internally approved vacancies can be sourced.</p></div></div>
   {loading?<p className="muted">Loading active vacancies…</p>:jobs.length===0?<div className="notice">There are no published or internally approved vacancies available for candidate sourcing.</div>:<>
    <div className="form-grid">
     <label className="full">Vacancy
      <select value={jobId} onChange={e=>{setJobId(e.target.value);setResults([]);setSearched(false);setParams({job:e.target.value},{replace:true});}}>
       {jobs.map(j=><option key={j.id} value={j.id}>{j.title} — {j.location||'Location not specified'} ({j.status==='published'?'Published':'Internal sourcing approved'})</option>)}
      </select>
     </label>
     <label className="full">Optional candidate search
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search candidate name, location, experience or qualifications"/>
     </label>
    </div>
    <div className="button-row"><Button disabled={!jobId||searching} onClick={()=>void findMatches()}>{searching?'Searching CV database…':<><Search size={15}/> Find matching CVs</>}</Button>{searched&&<Button variant="ghost" disabled={searching} onClick={()=>{setQuery('');setResults([]);setSearched(false);}}><RefreshCw size={14}/> Clear results</Button>}</div>
   </>}
  </Card>
  {selected&&<Card>
   <div className="card-head"><div><h3>{selected.title}</h3><p><MapPin size={14}/> {selected.location||'Location not specified'}</p></div><Badge tone={selected.status==='published'?'green':'amber'}>{selected.status==='published'?'Published vacancy':'Internal sourcing approved'}</Badge></div>
   {searched&&!error&&<p className="muted">{results.length} candidate{results.length===1?'':'s'} with a CV matched the vacancy. Maximum 50 results, ranked by recorded experience, qualifications, authorisations and location.</p>}
   {error&&<div className="alert error" role="alert">{error}</div>}
   {searched&&!error&&results.length===0&&<div className="notice">No CV-bearing candidates matched the recorded vacancy requirements. Try a broader candidate search or check whether candidate experience and qualification records are complete.</div>}
   {results.length>0&&<div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Match</th><th>Evidence</th><th>Readiness</th><th>CV</th></tr></thead><tbody>
    {results.map(c=><tr key={c.candidate_id}>
     <td><strong>{c.full_name||'Candidate'}</strong><span>{c.location||'Location not recorded'} · {c.stage||'new'}</span><Link className="text-link" to={'/dashboard/candidates/'+c.candidate_id}>Open candidate <ArrowUpRight size={12}/></Link></td>
     <td><strong>{c.match_score}%</strong><span>Keyword and location match</span></td>
     <td>{(c.match_reasons||[]).length?<span>{c.match_reasons.slice(0,6).map(x=>x==='Location aligns with vacancy'?x:x).join(' · ')}</span>:<span>Review profile manually</span>}</td>
     <td><Badge tone={c.work_seeker_terms_agreed?'green':'amber'}>{c.work_seeker_terms_agreed?'Terms recorded':'Terms required'}</Badge>{c.already_applied&&<span>Already linked to this vacancy</span>}</td>
     <td><CandidateCvActions candidateId={c.candidate_id} compact/></td>
    </tr>)}
   </tbody></table></div>}
   <p className="muted">CVs remain in Vorlen's private storage. View and download actions use the existing permission-checked, audited CV access service. Match scores are an initial shortlist aid, not an automated hiring decision.</p>
  </Card>}
 </div>;
}
