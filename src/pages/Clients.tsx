import {useEffect,useState} from 'react';
import {Plus,ChevronRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Card,Button,Badge,Empty,useToast} from '../components/Ui';
import {supabase} from '../lib/supabase';

const TERMS_VERSION='client-tob-2026-09-21';
const blank={company_name:'',contact_name:'',email:'',phone:'',website:'',status:'prospect',business_nature:'',recruitment_fee_percent:'',payment_terms_days:'30',rebate_terms:'',terms_accepted:false,terms_accepted_by:'',terms_acceptance_method:'email',terms_evidence:'',pecr_subscriber_type:'unknown',email_marketing_basis:'none',email_marketing_evidence:'',tps_ctps_screened_at:'',tps_ctps_clear:false,tps_ctps_evidence:'',marketing_call_consent_at:''};

export default function Clients(){
 const toast=useToast();
 const[rows,setRows]=useState<any[]>([]),[show,setShow]=useState(false),[f,setF]=useState<any>(blank),[error,setError]=useState('');
 const load=()=>supabase.from('clients').select('*').order('created_at',{ascending:false}).then(r=>setRows(r.data||[]));
 useEffect(()=>{load()},[]);
 function openNew(){setF(blank);setShow(true)}
 async function submit(e:any){
  e.preventDefault();setError('');
  if(f.status==='active'&&!f.terms_accepted)return setError('Active recruitment clients must have agreed Terms of Business.');
  if(f.terms_accepted&&(!f.business_nature.trim()||!f.terms_accepted_by.trim()||!f.terms_evidence.trim()||!f.recruitment_fee_percent||!f.payment_terms_days||!f.rebate_terms.trim()))return setError('Record the client business, fee, payment terms, rebate terms and evidence of Terms of Business acceptance.');if(f.email_marketing_basis!=='none'&&(f.pecr_subscriber_type==='unknown'||!f.email_marketing_evidence.trim()))return setError('Record the PECR subscriber type and evidence before enabling email marketing.');if(f.pecr_subscriber_type==='individual'&&f.email_marketing_basis==='legitimate_interests')return setError('Individual subscribers such as sole traders cannot use the corporate B2B email route. Record consent, soft opt-in or a specifically solicited message instead.');
  const payload:any={company_name:f.company_name,contact_name:f.contact_name,email:f.email,phone:f.phone||null,website:f.website||null,status:f.status,business_nature:f.business_nature||null,recruitment_fee_percent:f.recruitment_fee_percent?Number(f.recruitment_fee_percent):null,payment_terms_days:f.payment_terms_days?Number(f.payment_terms_days):null,rebate_terms:f.rebate_terms||null,terms_version:f.terms_accepted?TERMS_VERSION:null,terms_accepted_at:f.terms_accepted?new Date().toISOString():null,terms_accepted_by:f.terms_accepted?f.terms_accepted_by:null,terms_acceptance_method:f.terms_accepted?f.terms_acceptance_method:null,terms_evidence:f.terms_accepted?f.terms_evidence:null,pecr_subscriber_type:f.pecr_subscriber_type,email_marketing_basis:f.email_marketing_basis,email_marketing_assessed_at:f.email_marketing_basis!=='none'?new Date().toISOString():null,email_marketing_evidence:f.email_marketing_basis!=='none'?f.email_marketing_evidence||null:null,tps_ctps_screened_at:f.tps_ctps_screened_at?new Date(f.tps_ctps_screened_at).toISOString():null,tps_ctps_clear:f.tps_ctps_screened_at?!!f.tps_ctps_clear:null,tps_ctps_evidence:f.tps_ctps_screened_at?f.tps_ctps_evidence||null:null,marketing_call_consent_at:f.marketing_call_consent_at?new Date(f.marketing_call_consent_at).toISOString():null};
  const{error}=await supabase.from('clients').insert(payload);
  if(error)setError(error.message);else{toast('Client created.');setShow(false);setF(blank);load()}
 }
 return <div className="page">
  <div className="page-actions"><div><h2>Clients</h2><p>Select a client to open their workspace, actions and commercial record.</p></div><Button onClick={openNew}><Plus size={17}/> New client</Button></div>
  {error&&<div className="alert error">{error}</div>}
  {show&&<Card className="form-card"><form onSubmit={submit} className="form-grid">
   <label>Company<input required value={f.company_name} onChange={e=>setF({...f,company_name:e.target.value})}/></label>
   <label>Contact<input required value={f.contact_name} onChange={e=>setF({...f,contact_name:e.target.value})}/></label>
   <label>Email<input required type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
   <label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
   <label>Website<input value={f.website} onChange={e=>setF({...f,website:e.target.value})}/></label>
   <label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option>prospect</option><option>active</option><option>paused</option><option>closed</option></select></label>
   <label className="full">Nature of client's business<textarea required rows={2} value={f.business_nature} onChange={e=>setF({...f,business_nature:e.target.value})}/></label><div className="full notice"><strong>Direct marketing compliance</strong><p>Classify the subscriber before email outreach. For live marketing calls, record a current TPS/CTPS check (or specific call consent). Unknown or unverified records are blocked from automated outreach.</p></div><label>PECR subscriber<select value={f.pecr_subscriber_type} onChange={e=>setF({...f,pecr_subscriber_type:e.target.value})}><option value="unknown">Unknown / do not market</option><option value="corporate">Corporate body</option><option value="individual">Individual subscriber / sole trader / ordinary partnership</option></select></label><label>Email basis<select value={f.email_marketing_basis} onChange={e=>setF({...f,email_marketing_basis:e.target.value})}><option value="none">None / do not email marketing</option><option value="legitimate_interests">Legitimate interests (corporate B2B)</option><option value="consent">Consent</option><option value="soft_opt_in">Soft opt-in</option><option value="solicited">Specifically solicited message</option></select></label><label className="full">Email compliance evidence<textarea rows={2} value={f.email_marketing_evidence} onChange={e=>setF({...f,email_marketing_evidence:e.target.value})} placeholder="Company status/source and lawful-basis assessment or consent/soft-opt-in evidence."/></label><label>TPS/CTPS screened at<input type="datetime-local" value={f.tps_ctps_screened_at} onChange={e=>setF({...f,tps_ctps_screened_at:e.target.value})}/></label><label className="check"><input type="checkbox" checked={!!f.tps_ctps_clear} onChange={e=>setF({...f,tps_ctps_clear:e.target.checked})}/><span>TPS and CTPS screen clear</span></label><label className="full">TPS/CTPS evidence<textarea rows={2} value={f.tps_ctps_evidence} onChange={e=>setF({...f,tps_ctps_evidence:e.target.value})} placeholder="Screening source/reference and result."/></label><label>Specific marketing-call consent (optional)<input type="datetime-local" value={f.marketing_call_consent_at} onChange={e=>setF({...f,marketing_call_consent_at:e.target.value})}/></label>
   <label>Recruitment fee (%)<input type="number" min="0.01" max="100" step="0.01" value={f.recruitment_fee_percent} onChange={e=>setF({...f,recruitment_fee_percent:e.target.value})}/></label>
   <label>Payment terms (days)<input type="number" min="1" max="120" value={f.payment_terms_days} onChange={e=>setF({...f,payment_terms_days:e.target.value})}/></label>
   <label className="full">Rebate / replacement terms<textarea rows={2} value={f.rebate_terms} onChange={e=>setF({...f,rebate_terms:e.target.value})}/></label>
   <label className="check full"><input type="checkbox" checked={f.terms_accepted} onChange={e=>setF({...f,terms_accepted:e.target.checked})}/><span>Record external acceptance of Vorlen Terms of Business version {TERMS_VERSION}</span></label>
   {f.terms_accepted&&<><label>Accepted by<input required value={f.terms_accepted_by} onChange={e=>setF({...f,terms_accepted_by:e.target.value})}/></label><label>Acceptance method<select value={f.terms_acceptance_method} onChange={e=>setF({...f,terms_acceptance_method:e.target.value})}><option value="email">Email</option><option value="signed_document">Signed document</option><option value="portal">Portal</option></select></label><label className="full">Acceptance evidence / reference<textarea required rows={2} value={f.terms_evidence} onChange={e=>setF({...f,terms_evidence:e.target.value})}/></label></>}
   <div className="form-actions full"><Button type="submit">Create client</Button><Button type="button" variant="ghost" onClick={()=>setShow(false)}>Cancel</Button></div>
  </form></Card>}
  {rows.length===0?<Empty title="No clients yet" text="Add a client and agree Terms of Business before recruiting."/>:
   <div className="cards-list client-list-grid">{rows.map(c=><Link to={'/dashboard/clients/'+c.id} className="client-card-link" key={c.id}><Card className="client-list-card">
    <div className="card-head"><div><h3>{c.company_name}</h3><p>{c.contact_name}{c.email?' · '+c.email:''}</p></div><Badge tone={c.terms_accepted_at?'green':'amber'}>{c.terms_accepted_at?'terms agreed':'terms required'}</Badge></div>
    <p>{c.business_nature||'Nature of business not recorded'}</p>
    <div className="client-card-footer"><span>{String(c.status||'prospect').replaceAll('_',' ')}</span><span>Open client <ChevronRight size={15}/></span></div>
   </Card></Link>)}</div>}
 </div>
}