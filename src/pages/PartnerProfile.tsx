import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Badge,Button,Card,SkeletonRows,useToast} from '../components/Ui';
import {supabase} from '../lib/supabase';
import {useWorkspaceAccess} from '../lib/access';
import {BriefcaseBusiness,CheckCircle2,Circle,ExternalLink,FileText,LifeBuoy,LockKeyhole,Receipt,ShieldCheck,UserRound,Users} from 'lucide-react';

const split=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean);
const money=(v:any)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v||0));
const specialismLabel=(v:string)=>({b2b_advisor:'B2B Advisor',lead_closer:'Lead Closer',candidate_sourcer:'Candidate Sourcer',hybrid:'Hybrid Partner'} as Record<string,string>)[v]||v?.replaceAll('_',' ')||'Partner';
const statusTone=(v:boolean):'green'|'neutral'=>v?'green':'neutral';

export default function PartnerProfile(){
 const access=useWorkspaceAccess(),toast=useToast(),navigate=useNavigate();
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const[user,setUser]=useState<any>(null),[profile,setProfile]=useState<any>(null),[partnerProfile,setPartnerProfile]=useState<any>(null),[onboarding,setOnboarding]=useState<any>(null),[agreement,setAgreement]=useState<any>(null);
 const[stats,setStats]=useState({clients:0,jobs:0,candidates:0,placements:0,paid:0});
 const[form,setForm]=useState({display_name:'',phone:'',country:'',address:'',trading_name:'',linkedin_url:'',timezone:'UTC',sectors:'',regions:'',role_types:'',availability_hours:'',profile_photo_url:'',payment_method:'',payment_account_name:'',payment_currency:'GBP',payment_details_reference:''});

 async function load(){
  setLoading(true);setError('');
  const{data:{user:u},error:ue}=await supabase.auth.getUser();
  if(ue||!u){setError(ue?.message||'Your session has expired.');setLoading(false);return}
  setUser(u);
  const[{data:p,error:pe},{data:pp,error:ppe},{data:o,error:oe},{data:a,error:ae},{data:assign,error:ase},{data:attrs,error:ate},{data:comm,error:ce}]=await Promise.all([
   supabase.from('profiles').select('id,full_name,role,created_at').eq('id',u.id).maybeSingle(),
   supabase.from('partner_profiles').select('*').eq('user_id',u.id).maybeSingle(),
   supabase.from('partner_onboarding').select('*').eq('partner_id',u.id).maybeSingle(),
   supabase.from('partner_agreements').select('*').eq('partner_id',u.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('partner_assignments').select('client_id,job_id,candidate_id,completed_at').eq('partner_id',u.id),
   supabase.from('partner_attributions').select('placement_id').eq('partner_id',u.id).eq('attribution_type','placement_owner').eq('status','active'),
   supabase.from('partner_commissions').select('amount,status').eq('partner_user_id',u.id)
  ]);
  const first=pe||ppe||oe||ae||ase||ate||ce;if(first)setError(first.message);
  setProfile(p);setPartnerProfile(pp);setOnboarding(o);setAgreement(a);
  const active=(assign||[]).filter((x:any)=>!x.completed_at);
  setStats({
   clients:new Set(active.map((x:any)=>x.client_id).filter(Boolean)).size,
   jobs:new Set(active.map((x:any)=>x.job_id).filter(Boolean)).size,
   candidates:new Set(active.map((x:any)=>x.candidate_id).filter(Boolean)).size,
   placements:new Set((attrs||[]).map((x:any)=>x.placement_id).filter(Boolean)).size,
   paid:(comm||[]).filter((x:any)=>x.status==='paid').reduce((n:number,x:any)=>n+Number(x.amount||0),0)
  });
  setForm({
   display_name:pp?.display_name||p?.full_name||o?.legal_name||'',
   phone:o?.phone||'',country:o?.country||'',address:o?.address||'',trading_name:o?.trading_name||'',
   linkedin_url:pp?.linkedin_url||'',timezone:pp?.timezone||'UTC',
   sectors:(pp?.sectors||[]).join(', '),regions:(pp?.regions||[]).join(', '),role_types:(pp?.role_types||[]).join(', '),
   availability_hours:pp?.availability_hours||'',profile_photo_url:pp?.profile_photo_url||'',
   payment_method:o?.payment_method||'',payment_account_name:o?.payment_account_name||'',
   payment_currency:String(o?.payment_currency||'GBP').trim(),payment_details_reference:o?.payment_details_reference||''
  });
  setLoading(false);
 }
 useEffect(()=>{void load()},[]);

 async function save(e:any){
  e.preventDefault();setBusy(true);setError('');
  const{error:er}=await supabase.rpc('update_partner_self_profile',{
   p_display_name:form.display_name,p_phone:form.phone,p_country:form.country,p_address:form.address,
   p_trading_name:form.trading_name||'',p_linkedin_url:form.linkedin_url||'',p_timezone:form.timezone||'UTC',
   p_sectors:split(form.sectors),p_regions:split(form.regions),p_role_types:split(form.role_types),
   p_availability_hours:form.availability_hours||'',p_profile_photo_url:form.profile_photo_url||'',
   p_payment_method:form.payment_method||'',p_payment_account_name:form.payment_account_name||'',
   p_payment_currency:form.payment_currency||'GBP',p_payment_details_reference:form.payment_details_reference||''
  });
  setBusy(false);if(er)return setError(er.message);
  toast('Partner profile updated.');await load();
 }

 const accepted=agreement?.status==='accepted';
 const personalComplete=Boolean(onboarding?.legal_name&&onboarding?.country&&onboarding?.address&&onboarding?.phone);
 const paymentComplete=Boolean(onboarding?.payment_method&&onboarding?.payment_account_name);
 const reviewed=Boolean(onboarding?.reviewed_at);
 const active=onboarding?.status==='active';
 const candidateEnabled=['candidate_sourcer','hybrid'].includes(partnerProfile?.specialism)&&access.candidateProcessingActive;
 const clientDevelopment=['b2b_advisor','lead_closer','hybrid'].includes(partnerProfile?.specialism);
 const joined=onboarding?.activated_at||partnerProfile?.created_at||profile?.created_at;
 const initials=(form.display_name||onboarding?.legal_name||user?.email||'VP').split(/\s+/).map((x:string)=>x[0]).join('').slice(0,2).toUpperCase();
 const checklist=[
  ['Partner agreement accepted',accepted],
  ['Personal details complete',personalComplete],
  ['Payment administration complete',paymentComplete],
  ['Vorlen management review complete',reviewed],
  ['Partner account activated',active]
 ] as const;

 if(loading||access.loading)return <div className="page"><SkeletonRows rows={8}/></div>;
 if(access.role!=='partner')return <div className="page"><div className="notice">Partner profile access required.</div></div>;
 if(!onboarding)return <div className="page"><Card><h2>Partner profile</h2><p>Your partner record has not been initialised yet. Ask a Vorlen manager to configure your partner account.</p></Card></div>;

 return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">PARTNER PROFILE</div><h2>Your Vorlen partner account</h2><p>Personal details, partnership status, permissions, preferences, payment administration and account security.</p></div><Badge tone={active?'green':'amber'}>{String(onboarding.status).replaceAll('_',' ')}</Badge></div>
  {error&&<div className="notice error">{error}</div>}

  <Card>
   <div className="profile-hero">
    <div className="profile-avatar">{partnerProfile?.profile_photo_url?<img src={partnerProfile.profile_photo_url} alt="Partner profile"/>:<span>{initials}</span>}</div>
    <div><div className="eyebrow">VORLEN PARTNER</div><h2>{form.display_name||onboarding.legal_name||'Partner'}</h2><p>{specialismLabel(partnerProfile?.specialism)} · {active?'Active partner':'Onboarding in progress'}{joined?' · Joined '+new Date(joined).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''}</p><span className="muted">{user?.email}</span></div>
   </div>
  </Card>

  <div className="grid three">
   <Card><span className="muted">Partner agreement</span><h3>{accepted?'Accepted':'Pending'}</h3><p>{agreement?.version||'No agreement version'}{agreement?.accepted_at?' · '+new Date(agreement.accepted_at).toLocaleDateString('en-GB'):''}</p></Card>
   <Card><span className="muted">Commission share</span><h2>{Number(agreement?.commission_percent||0).toFixed(0)}%</h2><p>of qualifying fees actually received and retained by Vorlen</p></Card>
   <Card><span className="muted">Commercial authority</span><h3>Vorlen management only</h3><p>You may develop employer relationships and gather requirements, but you cannot bind Vorlen to client terms.</p></Card>
  </div>

  <div className="grid two">
   <Card><h3>Onboarding status</h3>{checklist.map(([label,done])=><div className="list-row compact" key={label}><div className="button-row">{done?<CheckCircle2 size={17}/>:<Circle size={17}/>}<strong>{label}</strong></div><Badge tone={statusTone(done)}>{done?'Complete':'Outstanding'}</Badge></div>)}{!active&&<Button onClick={()=>navigate('/dashboard/partner-onboarding')}>Continue onboarding</Button>}</Card>
   <Card><h3>Permissions & capabilities</h3>
    <div className="list-row compact"><div><strong>Client development</strong><span>Prospecting, employer relationship development and commercial handoffs</span></div><Badge tone={statusTone(clientDevelopment)}>{clientDevelopment?'Enabled':'Not enabled'}</Badge></div>
    <div className="list-row compact"><div><strong>Candidate sourcing</strong><span>Controlled candidate sourcing and partner pipeline</span></div><Badge tone={statusTone(candidateEnabled)}>{candidateEnabled?'Enabled':'Disabled'}</Badge></div>
    <div className="list-row compact"><div><strong>Candidate processing phase</strong><span>Company-level compliance gate</span></div><Badge tone={statusTone(access.candidateProcessingActive)}>{access.candidateProcessingActive?'Active':'Gated'}</Badge></div>
    <div className="list-row compact"><div><strong>Commercial approval</strong><span>Fees, terms, guarantees, exclusivity and candidate ownership</span></div><Badge tone="neutral">Manager only</Badge></div>
   </Card>
  </div>

  <Card>
   <div className="card-head"><div><h3>Personal details & recruitment preferences</h3><p>These are your partner-operating details. Legal agreement fields and permissions are controlled separately by Vorlen.</p></div></div>
   {active?<form className="form-grid" onSubmit={save}>
    <label>Display name<input required value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})}/></label>
    <label>Email<input value={user?.email||''} disabled/></label>
    <label>Phone<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <label>Country<input required value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label>
    <label className="full">Address<input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
    <label>Trading / business name<input value={form.trading_name} onChange={e=>setForm({...form,trading_name:e.target.value})}/></label>
    <label>Timezone<input required value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} placeholder="Europe/London"/></label>
    <label>LinkedIn profile<input type="url" value={form.linkedin_url} onChange={e=>setForm({...form,linkedin_url:e.target.value})} placeholder="https://www.linkedin.com/in/..."/></label>
    <label>Profile photo URL<input type="url" value={form.profile_photo_url} onChange={e=>setForm({...form,profile_photo_url:e.target.value})} placeholder="https://..."/></label>
    <label>Sectors / specialisms<input value={form.sectors} onChange={e=>setForm({...form,sectors:e.target.value})} placeholder="IT, Engineering, Healthcare"/></label>
    <label>UK regions<input value={form.regions} onChange={e=>setForm({...form,regions:e.target.value})} placeholder="North West, London, UK-wide"/></label>
    <label>Role types<input value={form.role_types} onChange={e=>setForm({...form,role_types:e.target.value})} placeholder="Software, DevOps, Operations"/></label>
    <label>Availability / working hours<input value={form.availability_hours} onChange={e=>setForm({...form,availability_hours:e.target.value})} placeholder="Mon-Fri 09:00-17:00 UK overlap"/></label>
    <div className="full form-divider"><strong>Payment administration</strong><p className="muted">Use a safe payout/invoicing reference only. Do not enter passwords, card PINs or online-banking credentials.</p></div>
    <label>Payment method<input value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})} placeholder="Bank transfer / Wise / invoice"/></label>
    <label>Payment account name<input value={form.payment_account_name} onChange={e=>setForm({...form,payment_account_name:e.target.value})}/></label>
    <label>Payment currency<input maxLength={3} value={form.payment_currency} onChange={e=>setForm({...form,payment_currency:e.target.value.toUpperCase()})}/></label>
    <label>Payment reference<input value={form.payment_details_reference} onChange={e=>setForm({...form,payment_details_reference:e.target.value})} placeholder="Safe reference used by Vorlen finance"/></label>
    <Button type="submit" disabled={busy}>Save profile</Button>
   </form>:<div><p>Your editable partner profile unlocks after activation.</p><Button onClick={()=>navigate('/dashboard/partner-onboarding')}>Continue onboarding</Button></div>}
  </Card>

  <div className="grid two">
   <Card><h3>Legal & business record</h3><p className="muted">Read-only partnership administration. Changes to legal identity, registration or tax details should be reviewed by Vorlen and must not silently alter an accepted agreement.</p>
    <div className="list-row"><div><strong>Legal name</strong><span>{onboarding.legal_name||'Not recorded'}</span></div></div>
    <div className="list-row"><div><strong>Business type</strong><span>{onboarding.business_type||'Not recorded'}</span></div></div>
    <div className="list-row"><div><strong>Company registration</strong><span>{onboarding.company_registration_number||'Not recorded'}</span></div></div>
    <div className="list-row"><div><strong>VAT number</strong><span>{onboarding.vat_number||'Not recorded'}</span></div></div>
    <div className="list-row"><div><strong>Tax reference</strong><span>{onboarding.tax_reference?'Recorded with Vorlen':'Not recorded'}</span></div></div>
   </Card>
   <Card><h3>Partner agreement</h3><div className="list-row"><div><strong>Version</strong><span>{agreement?.version||'—'}</span></div><Badge tone={accepted?'green':'amber'}>{agreement?.status||'pending'}</Badge></div><div className="list-row"><div><strong>Accepted by</strong><span>{agreement?.accepted_name||'Not yet accepted'}</span></div><span>{agreement?.accepted_at?new Date(agreement.accepted_at).toLocaleString('en-GB'):'—'}</span></div><details><summary>View accepted terms</summary><pre className="answer-box">{agreement?.terms_text||'Agreement is being prepared by Vorlen.'}</pre></details><p className="muted">Accepted terms and commission are immutable. Material changes require a new agreement version.</p></Card>
  </div>

  <div className="grid five partner-profile-stats">
   <Card><Users size={18}/><span className="muted">Active clients</span><h2>{stats.clients}</h2></Card>
   <Card><BriefcaseBusiness size={18}/><span className="muted">Active vacancies</span><h2>{stats.jobs}</h2></Card>
   <Card><UserRound size={18}/><span className="muted">Assigned candidates</span><h2>{stats.candidates}</h2></Card>
   <Card><Receipt size={18}/><span className="muted">Placements</span><h2>{stats.placements}</h2></Card>
   <Card><Receipt size={18}/><span className="muted">Paid commission</span><h2>{money(stats.paid)}</h2></Card>
  </div>

  <div className="grid two">
   <Card><LockKeyhole size={20}/><h3>Security & account</h3><div className="list-row"><div><strong>Account email</strong><span>{user?.email}</span></div></div><div className="list-row"><div><strong>Last sign-in</strong><span>{user?.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('en-GB'):'Not available'}</span></div></div><div className="button-row"><Link className="btn ghost" to="/forgot-password">Reset password</Link><Button variant="ghost" onClick={async()=>{await supabase.auth.signOut();navigate('/login')}}>Sign out</Button></div></Card>
   <Card><ShieldCheck size={20}/><h3>Support & compliance</h3><p>Use only approved Vorlen systems for client and candidate records. Escalate contractual terms, complaints, data-rights requests and unusual compliance issues to Vorlen management.</p><div className="button-row"><Link className="btn ghost" to="/dashboard/partner/resources"><LifeBuoy size={14}/> Partner resources</Link><Link className="btn ghost" to="/privacy"><FileText size={14}/> Privacy</Link><Link className="btn ghost" to="/contact">Contact Vorlen</Link>{form.linkedin_url&&<a className="btn ghost" href={form.linkedin_url} target="_blank" rel="noreferrer">LinkedIn <ExternalLink size={14}/></a>}</div></Card>
  </div>
 </div>
}
