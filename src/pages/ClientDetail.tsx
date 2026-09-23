import {useEffect,useState} from 'react';
import {ArrowLeft,ExternalLink,Pencil,Send,Trash2,UserPlus} from 'lucide-react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {Badge,Button,Card,Empty,SkeletonCards,useToast} from '../components/Ui';
import {supabase} from '../lib/supabase';

const TERMS_VERSION='client-tob-2026-09-21';
const blank={company_name:'',contact_name:'',email:'',phone:'',website:'',status:'prospect',business_nature:'',recruitment_fee_percent:'',payment_terms_days:'30',rebate_terms:'',terms_accepted:false,terms_accepted_by:'',terms_acceptance_method:'email',terms_evidence:''};

export default function ClientDetail(){
 const {id}=useParams(),navigate=useNavigate(),toast=useToast();
 const[client,setClient]=useState<any>(null),[jobs,setJobs]=useState<any[]>([]),[notes,setNotes]=useState<any[]>([]),[loading,setLoading]=useState(true),[editing,setEditing]=useState(false),[f,setF]=useState<any>(blank),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const load=async()=>{if(!id)return;setLoading(true);setError('');const [c,j,n]=await Promise.all([
  supabase.from('clients').select('*').eq('id',id).maybeSingle(),
  supabase.from('jobs').select('id,title,status,location,created_at').eq('client_id',id).order('created_at',{ascending:false}),
  supabase.from('client_contact_notes').select('id,note,note_type,source,created_at').eq('client_id',id).order('created_at',{ascending:false}).limit(10)
 ]);if(c.error)setError(c.error.message);setClient(c.data||null);setJobs(j.data||[]);setNotes(n.data||[]);setLoading(false)};
 useEffect(()=>{load()},[id]);
 function openEdit(){if(!client)return;setF({...blank,...client,terms_accepted:!!client.terms_accepted_at,recruitment_fee_percent:client.recruitment_fee_percent??'',payment_terms_days:client.payment_terms_days??30});setEditing(true)}
 async function save(e:any){e.preventDefault();setError('');if(f.status==='active'&&!f.terms_accepted)return setError('Active recruitment clients must have agreed Terms of Business.');if(f.terms_accepted&&(!String(f.business_nature||'').trim()||!String(f.terms_accepted_by||'').trim()||!String(f.terms_evidence||'').trim()||!f.recruitment_fee_percent||!f.payment_terms_days||!String(f.rebate_terms||'').trim()))return setError('Record the client business, fee, payment terms, rebate terms and evidence of Terms of Business acceptance.');
 const payload:any={company_name:f.company_name,contact_name:f.contact_name,email:f.email,phone:f.phone||null,website:f.website||null,status:f.status,business_nature:f.business_nature||null,recruitment_fee_percent:f.recruitment_fee_percent?Number(f.recruitment_fee_percent):null,payment_terms_days:f.payment_terms_days?Number(f.payment_terms_days):null,rebate_terms:f.rebate_terms||null,terms_version:f.terms_accepted?TERMS_VERSION:null,terms_accepted_at:f.terms_accepted?(client?.terms_accepted_at||new Date().toISOString()):null,terms_accepted_by:f.terms_accepted?f.terms_accepted_by:null,terms_acceptance_method:f.terms_accepted?f.terms_acceptance_method:null,terms_evidence:f.terms_accepted?f.terms_evidence:null};
 const{error}=await supabase.from('clients').update(payload).eq('id',id);if(error)setError(error.message);else{toast('Client updated.');setEditing(false);load()}}
 async function remove(){if(!client||!confirm(`Delete ${client.company_name}? This cannot be undone.`))return;const{error}=await supabase.from('clients').delete().eq('id',client.id);if(error)setError(error.message);else{toast('Client deleted.');navigate('/dashboard/clients')}}
 async function sendTerms(){if(!client?.email)return setError('Add a client contact email first.');setBusy('terms');setError('');const{data,error}=await supabase.functions.invoke('client-terms',{body:{action:'send',client_id:client.id}});setBusy('');if(error||data?.error)setError(data?.error||error?.message||'Could not send Terms of Business.');else{toast('Terms of Business sent securely to the client.');load()}}
 async function invite(){if(!client?.email)return setError('Add a client contact email first.');setBusy('invite');setError('');const{data,error}=await supabase.functions.invoke('admin-user-management',{body:{action:'invite',email:client.email,full_name:client.contact_name||client.company_name,role:'viewer',client_id:client.id}});setBusy('');if(error||data?.error)return setError(data?.detail?`${data.error} ${data.detail}`:(data?.error||error?.message||'Could not send client portal invitation.'));toast(data?.message||'Client portal invitation sent.')}
 if(loading)return <div className="page"><SkeletonCards count={4}/></div>;
 if(!client)return <div className="page"><Link className="text-link" to="/dashboard/clients"><ArrowLeft size={14}/> Back to clients</Link><Empty title="Client not found" text={error||'This client may have been removed.'}/></div>;
 return <div className="page client-detail-page">
  <div className="client-detail-back"><Link className="text-link" to="/dashboard/clients"><ArrowLeft size={14}/> Back to clients</Link></div>
  <div className="page-actions client-detail-head"><div><div className="eyebrow">CLIENT WORKSPACE</div><h2>{client.company_name}</h2><p>{client.contact_name}{client.email?' · '+client.email:''}</p></div><div className="button-row">
   <Button variant="ghost" disabled={busy==='terms'} onClick={sendTerms}><Send size={14}/> Send TOB</Button>
   <Button variant="ghost" disabled={busy==='invite'} onClick={invite}><UserPlus size={14}/> Invite</Button>
   <Button variant="ghost" onClick={openEdit}><Pencil size={14}/> Edit</Button>
   <Button variant="danger" onClick={remove}><Trash2 size={14}/> Delete</Button>
  </div></div>
  {error&&<div className="alert error">{error}</div>}
  <div className="client-summary-grid">
   <Card><span className="metric-label">Status</span><div className="client-summary-value">{String(client.status||'prospect').replaceAll('_',' ')}</div><Badge tone={client.terms_accepted_at?'green':'amber'}>{client.terms_accepted_at?'Terms agreed':'Terms required'}</Badge></Card>
   <Card><span className="metric-label">Call status</span><div className="client-summary-value">{String(client.call_status||'not contacted').replaceAll('_',' ')}</div><small>{client.call_attempts||0} call attempts</small></Card>
   <Card><span className="metric-label">Commercial terms</span><div className="client-summary-value">{client.recruitment_fee_percent!=null?client.recruitment_fee_percent+'% fee':'Not set'}</div><small>{client.payment_terms_days?client.payment_terms_days+' day payment terms':'Payment terms not set'}</small></Card>
   <Card><span className="metric-label">Vacancies</span><div className="client-summary-value">{jobs.length}</div><small>{jobs.filter(j=>!['closed','archived'].includes(String(j.status))).length} open/draft</small></Card>
  </div>
  {editing&&<Card className="form-card"><div className="card-head"><div><h2>Edit client</h2><p>Update the client record and commercial terms.</p></div></div><form onSubmit={save} className="form-grid">
   <label>Company<input required value={f.company_name} onChange={e=>setF({...f,company_name:e.target.value})}/></label><label>Contact<input required value={f.contact_name} onChange={e=>setF({...f,contact_name:e.target.value})}/></label><label>Email<input required type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Phone<input value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Website<input value={f.website||''} onChange={e=>setF({...f,website:e.target.value})}/></label><label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option>prospect</option><option>active</option><option>paused</option><option>closed</option></select></label>
   <label className="full">Nature of client's business<textarea required rows={2} value={f.business_nature||''} onChange={e=>setF({...f,business_nature:e.target.value})}/></label><label>Recruitment fee (%)<input type="number" min="0.01" max="100" step="0.01" value={f.recruitment_fee_percent} onChange={e=>setF({...f,recruitment_fee_percent:e.target.value})}/></label><label>Payment terms (days)<input type="number" min="1" max="120" value={f.payment_terms_days} onChange={e=>setF({...f,payment_terms_days:e.target.value})}/></label><label className="full">Rebate / replacement terms<textarea rows={2} value={f.rebate_terms||''} onChange={e=>setF({...f,rebate_terms:e.target.value})}/></label>
   <label className="check full"><input type="checkbox" checked={!!f.terms_accepted} onChange={e=>setF({...f,terms_accepted:e.target.checked})}/><span>Record external acceptance of Vorlen Terms of Business version {TERMS_VERSION}</span></label>{f.terms_accepted&&<><label>Accepted by<input required value={f.terms_accepted_by||''} onChange={e=>setF({...f,terms_accepted_by:e.target.value})}/></label><label>Acceptance method<select value={f.terms_acceptance_method||'email'} onChange={e=>setF({...f,terms_acceptance_method:e.target.value})}><option value="email">Email</option><option value="signed_document">Signed document</option><option value="portal">Portal</option></select></label><label className="full">Acceptance evidence / reference<textarea required rows={2} value={f.terms_evidence||''} onChange={e=>setF({...f,terms_evidence:e.target.value})}/></label></>}
   <div className="form-actions full"><Button type="submit">Save changes</Button><Button type="button" variant="ghost" onClick={()=>setEditing(false)}>Cancel</Button></div>
  </form></Card>}
  <div className="grid two">
   <Card><div className="card-head"><div><h2>Client details</h2><p>Contact and operating context.</p></div></div>
    <div className="detail-list"><div><span>Business</span><strong>{client.business_nature||'Not recorded'}</strong></div><div><span>Phone</span><strong>{client.phone||'Not recorded'}</strong></div><div><span>Email</span><strong>{client.email||'Not recorded'}</strong></div><div><span>Website</span><strong>{client.website?<a href={client.website.startsWith('http')?client.website:'https://'+client.website} target="_blank" rel="noreferrer">{client.website} <ExternalLink size={12}/></a>:'Not recorded'}</strong></div><div><span>Last call outcome</span><strong>{client.last_call_outcome||'None recorded'}</strong></div><div><span>Last call note</span><strong>{client.last_call_note||'None recorded'}</strong></div></div>
   </Card>
   <Card><div className="card-head"><div><h2>Terms of Business</h2><p>Commercial and acceptance record.</p></div></div>
    <div className="detail-list"><div><span>Terms status</span><strong>{client.terms_accepted_at?'Accepted':'Not accepted'}</strong></div><div><span>Accepted by</span><strong>{client.terms_accepted_by||'—'}</strong></div><div><span>Method</span><strong>{client.terms_acceptance_method||'—'}</strong></div><div><span>Fee</span><strong>{client.recruitment_fee_percent!=null?client.recruitment_fee_percent+'%':'—'}</strong></div><div><span>Payment terms</span><strong>{client.payment_terms_days?client.payment_terms_days+' days':'—'}</strong></div><div><span>Rebate / replacement</span><strong>{client.rebate_terms||'—'}</strong></div></div>
   </Card>
  </div>
  <div className="grid two">
   <Card><div className="card-head"><div><h2>Vacancies</h2><p>Jobs associated with this client.</p></div></div>{jobs.length?jobs.map(j=><div className="list-row" key={j.id}><div><strong>{j.title}</strong><span>{j.location||'Location not set'}</span></div><Badge tone={j.status==='published'?'green':j.status==='draft'?'amber':'blue'}>{j.status}</Badge></div>):<div className="empty small">No vacancies for this client yet.</div>}</Card>
   <Card><div className="card-head"><div><h2>Recent contact notes</h2><p>Latest client communication history.</p></div></div>{notes.length?notes.map(n=><div className="list-row" key={n.id}><div><strong>{n.note_type||'Note'}</strong><span>{n.note}</span></div><small>{new Date(n.created_at).toLocaleDateString('en-GB')}</small></div>):<div className="empty small">No contact notes yet.</div>}</Card>
  </div>
 </div>
}