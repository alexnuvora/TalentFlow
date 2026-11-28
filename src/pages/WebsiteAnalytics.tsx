import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
type CountRow={page?:string;source?:string;event_day?:string;views:number};
type Snapshot={days:number;totals:Record<string,number>;pages:CountRow[];sources:CountRow[];daily:CountRow[]};
const fmt=(n:number)=>new Intl.NumberFormat('en-GB').format(n||0);
export default function WebsiteAnalytics(){
 const [days,setDays]=useState(28),[data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');setData(null);
  void(async()=>{try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw new Error('Please sign in again.');
   const response=await fetch('/api/site-analytics?days='+days,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
   const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||'Analytics unavailable.');
   if(active)setData(body);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Analytics unavailable.')}finally{if(active)setLoading(false)}})();
  return()=>{active=false};
 },[days,refresh]);
 const totals=data?.totals||{};
 const metrics=[['Page views','page_view'],['Employer enquiries','employer_enquiry'],['Candidate applications','candidate_application'],['Interest registrations','interest_registered']];
 const table=(title:string,rows:CountRow[],key:'page'|'source'|'event_day')=><section className="card" style={{marginTop:16}}><h2>{title}</h2>{rows.length?<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>{key==='page'?'Public page':key==='source'?'Source':'Date (UTC)'}</th><th>Page views</th></tr></thead><tbody>{rows.map(row=><tr key={row[key]}><td>{row[key]}</td><td>{fmt(row.views)}</td></tr>)}</tbody></table></div>:<p>No recorded views for this period.</p>}</section>;
 return <div className="page"><div className="page-actions"><div><h2>Website analytics</h2><p>First-party public website measurement, only after visitor permission.</p></div><div><label>Period <select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={28}>28 days</option><option value={90}>90 days</option></select></label> <button className="btn" onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div></div>
 <p className="notice">Counts include consenting visits only, not unique people. Source categories are approximate, dates use UTC, and browser-generated events may include automated or repeat traffic. This is not a complete count of applications or enquiries. No Google Analytics or Meta Pixel data is included.</p>
 {loading?<p role="status">Loading analytics…</p>:error?<p role="alert">{error}</p>:data?<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>{metrics.map(([label,key])=><section key={key} className="card"><p>{label}</p><h2>{fmt(totals[key])}</h2></section>)}</div>{table('Public pages',data.pages,'page')}{table('Traffic sources',data.sources,'source')}{table('Daily page views',data.daily,'event_day')}</>:null}
 </div>
}
