import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Badge,Button,Card,SkeletonRows,useToast} from '../components/Ui';
import {useWorkspaceAccess} from '../lib/access';
import {supabase} from '../lib/supabase';
import {BriefcaseBusiness,CheckCircle2,FileCheck2,LifeBuoy,LockKeyhole,Receipt,UserRound} from 'lucide-react';

const listText=(v:any)=>Array.isArray(v)?v.join(', '):'';
const splitList=(v:string)=>[...new Set(v.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,20);
const dateText=(v?:string|null)=>v?new Date(v).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'—';
const money=(v:any)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v||0));
const specialismLabel=(v?:string)=>({b2b_advisor:'B2B advisor',candidate_sourcer:'Candidate sourcer',hybrid:'Hybrid partner'} as Record<string,string>)[v||'']||String(v||'Not configured').replaceAll('_',' ');
const statusTone=(ok:boolean)=>ok?'green':'neutral';

export default function PartnerProfile(){
 const access=useWorkspaceAccess(),toast=useToast(),navigate=useNavigate();
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const[user,setUser]=useState<any>(null),[baseProfile,setBaseProfile]=useState<any>(null),[onb,setOnb]=useState<any>(null),[partnerProfile,setPartnerProfile]=useState<any>(null);
 const[agreement,setAgreement]=useState<any>(null),[latestAgreement,setLatestAgreement]=useState<any>(null);
 const[stats,setStats]=useState({clients:0,vacancies:0,candidates:0,placements:0,openTasks:0,handoffs:0,paidCommission:0});
 const[form,setForm]=useState({
  display_name:'',phone:'',country:'',address:'',linkedin_url:'',timezone:'UTC',
  sectors:'',regions:'',role_types:'',availability_hours:'',profile_photo_url:'',
  payment_method:'',payment_account_name:'',payment_currency:'GBP',payment_details_reference:''
 });

 async function load(){
  if(access.loading||access.role!=='partner')return;
  setLoading(true);setError('');
  const{data:{user:u},error:ue}=await supabase.auth.getUser();
  if(ue||!u){setError(ue?.message||'Session expired.');setLoading(false);return}
  setUser(u);
  const [{data:bp,error:bpe},{data:o,error:oe},{data:pp,error:ppe},{data:ags,error:age},{data:clients},{data:jobs},{data:candidates},{data:tasks},{data:handoffs},{data:attrs},{data:commissions}]=await Promise.all([
   supabase.from('profiles').select('full_name,created_at').eq('id',u.id).maybeSingle(),
   supabase.from('partner_onboarding').select('*').eq('partner_id',u.id).maybeSingle(),
   supabase.from('partner_profiles').select('*').eq('user_id',u.id).maybeSingle(),
   supabase.from('partner_agreements').select('*').eq('partner_id',u.id).order('created_at',{ascending:false}).limit(10),
   supabase.from('clients').select('id'),
   supabase.from('jobs').select('id,status'),
   supabase.from('candidates').select('id'),
   supabase.from('partner_tasks').select('id,status'),
   supabase.from('partner_commercial_handoffs').select('id,status'),
   supabase.from('partner_attributions').select('placement_id').eq('partner_id',u.id).eq('attribution_type','placement_owner').eq('status','active'),
   supabase.from('partner_commissions').select('amount,status').eq('partner_user_id',u.id)
  ]);
  const first=bpe||oe||ppe||age;if(first)setError(first.message);
  setBaseProfile(bp||null);setOnb(o||null);setPartnerProfile(pp||null);
  const rows=ags||[],latest=rows[0]||null,accepted=rows.find((x:any)=>x.status==='accepted')||null;
  setLatestAgreement(latest);setAgreement(latest?.status==='accepted'?latest:(accepted||latest));
  setStats({
   clients:(clients||[]).length,
   vacancies:(jobs||[]).filter((j:any)=>!['closed','filled','cancelled'].includes(j.status)).length,
   candidates:(candidates||[]).length,
   placements:(attrs||[]).filter((x:any)=>x.placement_id).length,
   openTasks:(tasks||[]).filter((t:any)=>!['done','cancelled'].includes(t.status)).length,
   handoffs:(handoffs||[]).filter((h:any)=>!['declined'].includes(h.status)).length,
   paidCommission:(commissions||[]).filter((c:any)=>c.status==='paid').reduce((n:number,c:any)=>n+Number(c.amount||0),0)
  });
  setForm({
   display_name:pp?.display_name||'',
   phone:o?.phone||'',
   country:o?.country||'',
   address:o?.address||'',
   linkedin_url:pp?.linkedin_url||'',
   timezone:pp?.timezone||'UTC',
   sectors:listText(pp?.sectors),
   regions:listText(pp?.regions),
   role_types:listText(pp?.role_types),
   availability_hours:pp?.availability_hours||'',
   profile_photo_url:pp?.profile_photo_url||'',
   payment_method:o?.payment_method||'',
   payment_account_name:o?.payment_account_name||'',
   payment_currency:String(o?.payment_currency||'GBP').trim(),
   payment_details_reference:o?.payment_details_reference||''
  });
  setLoading(false);
 }
 useEffect(()=>{void load()},[access.loading,access.role]);

 async function save(e:any){
  e.preventDefault();setBusy(true);setError('');
  const{error:er}=await supabase.rpc('update_partner_self_profile',{
   p_display_name:form.display_name||null,
   p_phone:form.phone||null,
   p_country:form.country||null,
   p_address:form.address||null,
   p_linkedin_url:form.linkedin_url||null,
   p_timezone:form.timezone||'UTC',
   p_sectors:splitList(form.sectors),
   p_regions:splitList(form.regions),
   p_role_types:splitList(form.role_types),
   p_availability_hours:form.availability_hours||null,
   p_profile_photo_url:form.profile_photo_url||null,
   p_payment_method:form.payment_method||null,
   p_payment_account_name:form.payment_account_name||null,
   p_payment_currency:form.payment_currency||'GBP',
   p_payment_details_reference:form.payment_details_reference||null
  });
  setBusy(false);if(er)return setError(er.message);
  toast('Partner profile updated.');await load();
 }
 async function signOut(){await supabase.auth.signOut();navigate('/login',{replace:true})}

 if(access.loading||loading)return <div className="page"><SkeletonRows rows={7}/></div>;
 if(access.role!=='partner')return <div className="page"><div className="notice">Partner profile access required.</div></div>;
 if(!onb)return <div className="page"><Card><h2>Partner profile</h2><p>Your partner record is not configured yet.</p></Card></div>;

 const active=onb.status==='active'&&partnerProfile?.active===true;
 const clientDevelopment=['b2b_advisor','hybrid'].includes(partnerProfile?.specialism);
 const candidateRole=['candidate_sourcer','hybrid'].includes(partnerProfile?.specialism);
 const candidateEnabled=candidateRole&&access.candidateProcessingActive;
 const personalComplete=Boolean(onb.legal_name&&onb.country&&onb.address&&onb.phone);
 const paymentComplete=Boolean(onb.payment_method&&onb.payment_account_name&&onb.payment_currency);
 const agreementAccepted=agreement?.status==='accepted';
 const displayName=form.display_name||baseProfile?.full_name||onb.legal_name||'Vorlen partner';
 const joined=onb.activated_at||partnerProfile?.created_at||onb.created_at||baseProfile?.created_at;
 const initials=displayName.split(/\s+/).filter(Boolean).slice(0,2).map((x:string)=>x[0]?.toUpperCase()).join('');

 return <div className="page partner-page">
  <div className="page-actions partner-profile-header">
   <div className="partner-profile-identity">
    {form.profile_photo_url?.startsWith('https://')?<img className="profile-avatar" src={form.profile_photo_url} alt="Partner profile"/>:<div className="profile-avatar profile-avatar-fallback">{initials||'VP'}</div>}
    <div><div className="eyebrow">VORLEN PARTNER PROFILE</div><h2>{displayName}</h2><p>{specialismLabel(partnerProfile?.specialism)} · Joined {joined?new Date(joined).toLocaleDateString('en-GB',{dateStyle:'medium'}):'—'}</p></div>
   </div>
   <Badge tone={active?'green':'amber'}>{active?'Active partner':String(onb.status||'pending').replaceAll('_',' ')}</Badge>
  </div>

  {error&&<div className="notice error">{error}</div>}
  {!active&&<div className="notice"><strong>Onboarding is not complete.</strong> Finish your partner onboarding before self-service profile changes are enabled. <Link to="/dashboard/partner-onboarding">Open onboarding</Link>.</div>}
  {latestAgreement&&agreement&&latestAgreement.id!==agreement.id&&<div className="notice"><strong>New partner agreement pending.</strong> Your existing accepted agreement remains the current signed record until the new version is accepted.</div>}

  <div className="grid three">
   <Card><span className="muted">Partner agreement</span><h3>{agreementAccepted?'Accepted':'Pending'}</h3><p>{agreement?.version||'Not issued'}{agreement?.accepted_at?' · '+new Date(agreement.accepted_at).toLocaleDateString('en-GB'):''}</p></Card>
   <Card><span className="muted">Commission</span><h3>{agreementAccepted?Number(agreement?.commission_percent||0).toFixed(0)+'%':'—'}</h3><p>of qualifying recruitment fees under your accepted agreement</p></Card>
   <Card><span className="muted">Commercial authority</span><h3>Vorlen management only</h3><p>You may gather commercial information but cannot bind Vorlen or vary client terms.</p></Card>
  </div>

  <div className="grid two">
   <Card>
    <h3><UserRound size={18}/> Personal details</h3>
    <p className="muted">Your legal identity and sign-in email are shown for reference. Active partners can update contact/display details below; legal-name changes require Vorlen review.</p>
    <form className="form-grid" onSubmit={save}>
     <label>Full legal name<input value={onb.legal_name||''} readOnly/></label>
     <label>Display name<input value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} disabled={!active}/></label>
     <label>Email<input value={user?.email||''} readOnly/></label>
     <label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} disabled={!active}/></label>
     <label>Country<input value={form.country} onChange={e=>setForm({...form,country:e.target.value})} disabled={!active}/></label>
     <label>Timezone<input list="partner-timezones" value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} placeholder="Europe/London" disabled={!active}/><datalist id="partner-timezones"><option value="Europe/London"/><option value="UTC"/><option value="Asia/Karachi"/><option value="America/New_York"/></datalist></label>
     <label className="full">Address<textarea rows={3} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} disabled={!active}/></label>
     <label>LinkedIn URL<input type="url" value={form.linkedin_url} onChange={e=>setForm({...form,linkedin_url:e.target.value})} placeholder="https://www.linkedin.com/in/…" disabled={!active}/></label>
     <label>Profile photo URL<input type="url" value={form.profile_photo_url} onChange={e=>setForm({...form,profile_photo_url:e.target.value})} placeholder="https://…" disabled={!active}/></label>
    </form>
   </Card>

   <Card>
    <h3><BriefcaseBusiness size={18}/> Role & capabilities</h3>
    <div className="profile-status-row"><div><strong>Partner specialism</strong><span>{specialismLabel(partnerProfile?.specialism)}</span></div><Badge tone={active?'green':'neutral'}>{active?'active':'inactive'}</Badge></div>
    <div className="profile-status-row"><div><strong>Client development</strong><span>Employer prospecting, relationship development and hiring-need qualification</span></div><Badge tone={statusTone(clientDevelopment)}>{clientDevelopment?'Enabled':'Not enabled for role'}</Badge></div>
    <div className="profile-status-row"><div><strong>Candidate sourcing</strong><span>{candidateRole&&!access.candidateProcessingActive?'Role enabled; currently held by the candidate-processing compliance gate':'Candidate sourcing and pipeline capability'}</span></div><Badge tone={statusTone(candidateEnabled)}>{candidateEnabled?'Enabled':candidateRole?'System gated':'Not enabled for role'}</Badge></div>
    <div className="profile-status-row"><div><strong>Commercial approval</strong><span>Fees, payment terms, rebates, guarantees, exclusivity and candidate ownership</span></div><Badge tone="neutral">Vorlen only</Badge></div>
    <p className="muted">Role/specialism and capability permissions are controlled by Vorlen management and cannot be changed from this page.</p>
   </Card>
  </div>

  <Card>
   <h3><BriefcaseBusiness size={18}/> Recruitment preferences & availability</h3>
   <p className="muted">Use comma-separated values. Vorlen can use these preferences when deciding which clients and vacancies to assign.</p>
   <form className="form-grid" onSubmit={save}>
    <label>Sectors<input value={form.sectors} onChange={e=>setForm({...form,sectors:e.target.value})} placeholder="IT, Engineering, Healthcare" disabled={!active}/></label>
    <label>UK regions / territories<input value={form.regions} onChange={e=>setForm({...form,regions:e.target.value})} placeholder="Greater Manchester, London, UK-wide" disabled={!active}/></label>
    <label>Role types<input value={form.role_types} onChange={e=>setForm({...form,role_types:e.target.value})} placeholder="Software, DevOps, Operations" disabled={!active}/></label>
    <label>Availability / working hours<input value={form.availability_hours} onChange={e=>setForm({...form,availability_hours:e.target.value})} placeholder="Mon–Fri, 09:00–17:00 UK overlap" disabled={!active}/></label>
   </form>
  </Card>

  <div className="grid three">
   <Card><span className="muted">Assigned clients</span><h2>{stats.clients}</h2><p>current partner portfolio</p></Card>
   <Card><span className="muted">Active vacancies</span><h2>{stats.vacancies}</h2><p>assigned live work</p></Card>
   <Card><span className="muted">Candidates</span><h2>{stats.candidates}</h2><p>currently visible in your portfolio</p></Card>
   <Card><span className="muted">Commercial handoffs</span><h2>{stats.handoffs}</h2><p>active / submitted opportunities</p></Card>
   <Card><span className="muted">Placements</span><h2>{stats.placements}</h2><p>placement-owner attribution</p></Card>
   <Card><span className="muted">Paid commission</span><h2>{money(stats.paidCommission)}</h2><p>commission marked paid by Vorlen</p></Card>
  </div>

  <div className="grid two">
   <Card>
    <h3><CheckCircle2 size={18}/> Onboarding status</h3>
    <div className="profile-check"><CheckCircle2 size={16}/><div><strong>Partner agreement</strong><span>{agreementAccepted?'Accepted':'Not yet accepted'}</span></div></div>
    <div className="profile-check"><CheckCircle2 size={16}/><div><strong>Personal details</strong><span>{personalComplete?'Complete':'Incomplete'}</span></div></div>
    <div className="profile-check"><CheckCircle2 size={16}/><div><strong>Payment administration</strong><span>{paymentComplete?'Complete':'Incomplete'}</span></div></div>
    <div className="profile-check"><CheckCircle2 size={16}/><div><strong>Management review</strong><span>{onb.reviewed_at?'Completed '+dateText(onb.reviewed_at):'Pending'}</span></div></div>
    <div className="profile-check"><CheckCircle2 size={16}/><div><strong>Account activation</strong><span>{onb.activated_at?'Activated '+dateText(onb.activated_at):'Pending'}</span></div></div>
   </Card>

   <Card>
    <h3><Receipt size={18}/> Payment administration</h3>
    <p className="muted">Store only the payment method/account-name/reference information Vorlen needs for administration. Do not enter passwords, PINs, card security codes or online-banking credentials.</p>
    <form className="form-grid" onSubmit={save}>
     <label>Payment method<input value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})} placeholder="Bank transfer / Wise / invoice" disabled={!active}/></label>
     <label>Account / payee name<input value={form.payment_account_name} onChange={e=>setForm({...form,payment_account_name:e.target.value})} disabled={!active}/></label>
     <label>Currency<input maxLength={3} value={form.payment_currency} onChange={e=>setForm({...form,payment_currency:e.target.value.toUpperCase()})} disabled={!active}/></label>
     <label>Safe payment reference<input value={form.payment_details_reference} onChange={e=>setForm({...form,payment_details_reference:e.target.value})} placeholder="Invoice method or safe account reference" disabled={!active}/></label>
    </form>
   </Card>
  </div>

  <Card>
   <h3><FileCheck2 size={18}/> Agreement & partner authority</h3>
   <div className="grid three">
    <div><span className="muted">Version</span><strong>{agreement?.version||'—'}</strong></div>
    <div><span className="muted">Status</span><strong>{agreement?.status||'—'}</strong></div>
    <div><span className="muted">Accepted</span><strong>{agreement?.accepted_at?dateText(agreement.accepted_at):'—'}</strong></div>
   </div>
   <p>Partners may develop employer relationships, qualify hiring requirements and source candidates when authorised. Binding client fees, payment terms, rebates, guarantees, exclusivity, candidate-ownership periods and other contractual commitments remain under Vorlen management control.</p>
   {agreement?.terms_text&&<details><summary>View accepted agreement terms</summary><pre className="answer-box">{agreement.terms_text}</pre></details>}
  </Card>

  <div className="grid two">
   <Card>
    <h3><LockKeyhole size={18}/> Account & security</h3>
    <div className="profile-status-row"><div><strong>Sign-in email</strong><span>{user?.email||'—'}</span></div></div>
    <div className="profile-status-row"><div><strong>Last sign-in</strong><span>{dateText(user?.last_sign_in_at)}</span></div></div>
    <div className="profile-status-row"><div><strong>Open tasks</strong><span>{stats.openTasks} currently open</span></div></div>
    <div className="button-row"><Button variant="ghost" onClick={()=>navigate('/forgot-password')}>Reset password</Button><Button variant="ghost" onClick={signOut}>Sign out</Button></div>
   </Card>
   <Card>
    <h3><LifeBuoy size={18}/> Support & compliance</h3>
    <p>Use Vorlen systems for client, vacancy and candidate records. Escalate contractual questions, complaints, data-rights requests and anything that could legally or financially bind Vorlen.</p>
    <div className="button-row"><Link className="btn ghost" to="/dashboard/partner/resources">Partner resources</Link><Link className="btn ghost" to="/privacy">Privacy</Link><Link className="btn ghost" to="/candidate-terms">Candidate terms</Link><Link className="btn ghost" to="/contact">Contact Vorlen</Link></div>
   </Card>
  </div>

  <div className="page-actions"><div><p className="muted">Changes to specialism, activation, agreement terms, commission rate or commercial authority require Vorlen management.</p></div><Button disabled={!active||busy} onClick={save}>{busy?'Saving…':'Save profile changes'}</Button></div>
 </div>
}
