import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Card,Button} from '../components/Ui';
import {supabase} from '../lib/supabase';
import {setSeo,noIndex} from '../lib/seo';

type Enquiry={id:string;created_at:string;name:string;email:string;company:string|null;reason:string;role_title:string|null;message:string;notification_status:string;triage_status:string;internal_notes:string|null;source_page:string|null;utm_source:string|null;utm_campaign:string|null};
const statusOptions=['new','contacted','qualified','closed'];
export default function PublicEnquiries(){
 const [rows,setRows]=useState<Enquiry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('all'),[saving,setSaving]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({});
 useEffect(()=>{setSeo({title:'Website enquiries | Vorlen',description:'Private staff enquiry triage.',path:'/dashboard/enquiries',robots:noIndex});void load()},[]);
 async function load(){setLoading(true);setError('');const{data,error:e}=await supabase.from('public_enquiries').select('id,created_at,name,email,company,reason,role_title,message,notification_status,triage_status,internal_notes,source_page,utm_source,utm_campaign').order('created_at',{ascending:false}).limit(200);if(e)setError(e.message);else{setRows(data||[]);setDrafts(Object.fromEntries((data||[]).map((r:any)=>[r.id,r.internal_notes||''])))}setLoading(false)}
 async function update(row:Enquiry,change:Partial<Pick<Enquiry,'triage_status'|'internal_notes'>>){setSaving(row.id);setError('');const{error:e}=await supabase.from('public_enquiries').update(change).eq('id',row.id);if(e)setError(e.message);else setRows(old=>old.map(r=>r.id===row.id?{...r,...change}:r));setSaving('')}
 const filtered=useMemo(()=>rows.filter(r=>(status==='all'||r.triage_status===status)&&[r.name,r.email,r.company,r.reason,r.role_title,r.message].join(' ').toLowerCase().includes(search.toLowerCase())),[rows,status,search]);
 return <main className="page" style={{maxWidth:1080,margin:'0 auto'}}>
  <div className="page-actions"><div><div className="eyebrow">WEBSITE LEADS</div><h1>Website enquiries</h1><p>Enquiries received through Vorlen's public contact form. No messages are sent automatically from this screen.</p></div><Button variant="ghost" onClick={()=>void load()} disabled={loading}>Refresh</Button></div>
  {error&&<p className="alert error" role="alert">{error}</p>}
  <div className="recruiter-metric-grid"><Card><strong>{rows.filter(r=>r.triage_status==='new').length}</strong><span>New enquiries</span></Card><Card><strong>{rows.filter(r=>r.reason==='employer').length}</strong><span>Employer enquiries</span></Card><Card><strong>{rows.length}</strong><span>Latest records (up to 200)</span></Card></div>
  <div className="form-grid"><label>Search enquiries<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Person, business, vacancy or message"/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statusOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></label></div>
  {loading?<p role="status">Loading enquiries…</p>:filtered.length===0?<Card><p>No enquiries match your filters.</p></Card>:<div style={{display:'grid',gap:14,marginTop:20}}>{filtered.map(r=><Card key={r.id}>
   <div className="page-actions"><div><small>{new Date(r.created_at).toLocaleString('en-GB')} · {r.reason.toUpperCase()}</small><h2>{r.name}</h2><p>{r.company||'No company supplied'}{r.role_title?' · '+r.role_title:''}</p></div><span className="badge">{r.triage_status}</span></div>
   <p><a href={'mailto:'+encodeURIComponent(r.email)}>{r.email}</a></p>
   <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{r.message}</p>
   {(r.source_page||r.utm_source||r.utm_campaign)&&<p className="muted">Source: {r.source_page||'Direct'} · {r.utm_source||'Unspecified'}{r.utm_campaign?' / '+r.utm_campaign:''}</p>}
   <div className="form-grid"><label>Follow-up status<select value={r.triage_status} disabled={saving===r.id} onChange={e=>void update(r,{triage_status:e.target.value})}>{statusOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></label><label className="full">Internal follow-up notes<textarea rows={3} value={drafts[r.id]||''} onChange={e=>setDrafts(old=>({...old,[r.id]:e.target.value}))} placeholder="Record contact outcome, owner and next step"/></label></div>
   <div className="button-row"><Button disabled={saving===r.id||drafts[r.id]===(r.internal_notes||'')} onClick={()=>void update(r,{internal_notes:drafts[r.id]})}>{saving===r.id?'Saving…':'Save notes'}</Button><a className="btn ghost" href={'mailto:'+encodeURIComponent(r.email)+'?subject='+encodeURIComponent('Your Vorlen enquiry')}>Reply in email app</a></div>
  </Card>)}</div>}
  <p className="muted" style={{marginTop:16}}>Only authorised Vorlen staff can view or update these enquiries. Contact data should be used solely to respond to the enquiry, subject to Vorlen's <Link to="/privacy">privacy notice</Link>.</p>
 </main>
}
