import {useState} from 'react';
import {supabase} from '../lib/supabase';
export function CandidateCvActions({candidateId,compact=false}:{candidateId:string;compact?:boolean}){
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function access(action:'view'|'download'){
  if(busy)return;setBusy(true);setError('');
  // Reserve the tab synchronously to avoid popup blocking after the authenticated request.
  const tab=action==='view'?window.open('about:blank','_blank','noopener'):null;
  try{
   const{data,error:e}=await supabase.functions.invoke('candidate-cv-access',{body:{candidate_id:candidateId,action}});
   if(e||!data?.url)throw new Error(String(data?.error||e?.message||'CV unavailable'));
   if(tab)tab.location.href=data.url;else if(action==='view')window.location.assign(data.url);else{
    const a=document.createElement('a');a.href=data.url;a.download='candidate-cv';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
   }
  }catch(e){if(tab)tab.close();setError(e instanceof Error?e.message:'CV unavailable')}finally{setBusy(false)}
 }
 return <span className={compact?'candidate-cv-actions compact':'candidate-cv-actions'}><button type="button" disabled={busy} onClick={()=>void access('view')}>View CV</button><button type="button" disabled={busy} onClick={()=>void access('download')}>Download CV</button>{error&&<span role="alert" className="candidate-cv-error">{error}</span>}</span>
}
