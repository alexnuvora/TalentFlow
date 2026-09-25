import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Badge,Button,Card,SkeletonRows,useToast} from '../components/Ui';
import {supabase} from '../lib/supabase';
import {useWorkspaceAccess} from '../lib/access';
import {ClipboardList,FileCheck2,Handshake,LifeBuoy,Plus,Receipt,Search,Send,UserRoundCheck} from 'lucide-react';

export type PartnerOpsSection='vacancies'|'pipeline'|'handoffs'|'earnings'|'resources';
const money=(v:any,c='GBP')=>new Intl.NumberFormat('en-GB',{style:'currency',currency:String(c||'GBP').trim()}).format(Number(v||0));
const handoffLabel=(s:string)=>({draft:'Draft',submitted:'Submitted to Vorlen',under_review:'Under Vorlen review',terms_approved:'Terms approved',declined:'Declined',converted:'Converted to live vacancy'} as Record<string,string>)[s]||s.replaceAll('_',' ');
const handoffTone=(s:string)=>s==='terms_approved'||s==='converted'?'green':s==='declined'?'red':s==='submitted'||s==='under_review'?'amber':'neutral';
const pipelineStages=['sourced','contacted','screening','qualified','recommended','paused','rejected'];

export default function PartnerOperations({section}:{section:PartnerOpsSection}){
 const access=useWorkspaceAccess(),toast=useToast();
 const[params,setParams]=useSearchParams();
 const[active,setActive]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const[clients,setClients]=useState<any[]>([]),[prospects,setProspects]=useState<any[]>([]),[jobs,setJobs]=useState<any[]>([]),[candidates,setCandidates]=useState<any[]>([]),[pipeline,setPipeline]=useState<any[]>([]),[handoffs,setHandoffs]=useState<any[]>([]),[placements,setPlacements]=useState<any[]>([]),[commissions,setCommissions]=useState<any[]>([]),[commissionAdjustments,setCommissionAdjustments]=useState<any[]>([]),[agreement,setAgreement]=useState<any>(null),[talentPools,setTalentPools]=useState<any[]>([]),[talentPoolMembers,setTalentPoolMembers]=useState<any[]>([]),[accessRequests,setAccessRequests]=useState<any[]>([]);
 const[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState<any>(null),[handoffFormOpen,setHandoffFormOpen]=useState(false),[selectedJob,setSelectedJob]=useState<any>(null),[newPipeline,setNewPipeline]=useState({candidate_id:'',job_id:''}),[discoveryJob,setDiscoveryJob]=useState(''),[discoveryQuery,setDiscoveryQuery]=useState(''),[discoveryResults,setDiscoveryResults]=useState<any[]>([]),[poolName,setPoolName]=useState(''),[poolCandidate,setPoolCandidate]=useState(''),[poolId,setPoolId]=useState('');
 const blank={client_id:'',prospect_id:'',prospect_company:'',contact_name:'',contact_email:'',contact_phone:'',vacancy_title:'',vacancy_location:'',salary_context:'',hiring_need:'',commercial_request:''};
 const[form,setForm]=useState<any>(blank);

 async function load(){
  if(access.loading||access.role!=='partner')return;
  setLoading(true);setError('');
  const{data:{user}}=await supabase.auth.getUser();
  if(!user){setError('Session expired. Please sign in again.');setLoading(false);return}
  const [{data:isActive},{data:c,error:ce},{data:pr,error:pre},{data:j,error:je},{data:ca,error:cae},{data:pi,error:pie},{data:h,error:he},{data:p,error:pe},{data:co,error:coe},{data:adj,error:adje},{data:a},{data:tp},{data:tpm},{data:ar}]=await Promise.all([
   supabase.rpc('partner_is_active'),
   supabase.from('clients').select('id,company_name,contact_name,email,phone,status').order('company_name'),
   supabase.from('partner_prospects').select('*').order('updated_at',{ascending:false}),
   supabase.from('jobs').select('id,client_id,title,slug,status,location,salary_min,salary_max,employment_type,application_mode,description,requirements,duties,required_qualifications,work_days_hours,start_date,duration_text,minimum_remuneration_text,notice_period,created_at').order('created_at',{ascending:false}),
   supabase.from('candidates').select('id,full_name,email,phone,location,stage,next_action,next_action_at,work_seeker_terms_agreed_at,created_at').order('created_at',{ascending:false}),
   supabase.from('partner_candidate_pipeline').select('*').order('updated_at',{ascending:false}),
   supabase.from('partner_commercial_handoffs').select('*').order('updated_at',{ascending:false}),
   supabase.from('placements').select('id,client_id,job_id,candidate_id,fee_amount,currency,invoice_status,start_date,paid_at,created_at').order('created_at',{ascending:false}),
   supabase.from('partner_commissions').select('id,placement_id,rate,amount,status,eligible_fee_received,paid_at,payment_reference,created_at').eq('partner_user_id',user.id).order('created_at',{ascending:false}),
   supabase.from('partner_commission_adjustments').select('id,base_commission_id,placement_id,eligible_fee_delta,amount,status,reason,paid_at,payment_reference,created_at').eq('partner_user_id',user.id).order('created_at',{ascending:false}),
   supabase.from('partner_agreements').select('commission_percent,status,version').eq('partner_id',user.id).eq('status','accepted').order('created_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('partner_talent_pools').select('*').order('created_at',{ascending:false}),
   supabase.from('partner_talent_pool_members').select('*'),
   supabase.from('partner_candidate_access_requests').select('*').order('created_at',{ascending:false})
  ]);
  setActive(isActive===true);
  const first=ce||pre||je||cae||pie||he||pe||coe||adje;if(first)setError(first.message);
  setClients(c||[]);setProspects(pr||[]);setJobs(j||[]);setCandidates(ca||[]);setPipeline(pi||[]);setHandoffs(h||[]);setPlacements(p||[]);setCommissions(co||[]);setCommissionAdjustments(adj||[]);setAgreement(a||null);setTalentPools(tp||[]);setTalentPoolMembers(tpm||[]);setAccessRequests(ar||[]);setLoading(false);
 }
 useEffect(()=>{void load()},[access.loading,access.role]);
 useEffect(()=>{if(section!=='handoffs'||loading)return;const prospectId=params.get('prospect'),clientId=params.get('client');if(prospectId){const p=prospects.find(x=>x.id===prospectId);if(!p)return;setEditing(null);setHandoffFormOpen(true);setForm({...blank,prospect_id:p.id,prospect_company:p.company_name,contact_name:p.contact_name||'',contact_email:p.contact_email||'',contact_phone:p.contact_phone||'',hiring_need:p.hiring_need||''});setParams({}, {replace:true});return}if(params.get('new')==='1'){const client=clientId?clients.find(x=>x.id===clientId):null;setEditing(null);setHandoffFormOpen(true);setForm(client?{...blank,client_id:client.id,contact_name:client.contact_name||'',contact_email:client.email||'',contact_phone:client.phone||''}:blank);setParams({}, {replace:true})}},[section,loading,prospects,clients,params,setParams]);

 const clientsById=useMemo(()=>new Map(clients.map(x=>[x.id,x])),[clients]);
 const jobsById=useMemo(()=>new Map(jobs.map(x=>[x.id,x])),[jobs]);
 const candidateById=useMemo(()=>new Map(candidates.map(x=>[x.id,x])),[candidates]);
 const filteredJobs=jobs.filter(j=>`${j.title} ${j.location||''} ${clientsById.get(j.client_id)?.company_name||''}`.toLowerCase().includes(search.toLowerCase()));
 const expectedRate=Number(agreement?.commission_percent||30)/100;
 const expected=placements.reduce((n,p)=>n+Number(p.fee_amount||0)*expectedRate,0);
 const accrued=commissions.filter(x=>x.status!=='void').reduce((n,x)=>n+Number(x.amount||0),0)+commissionAdjustments.filter(x=>x.status!=='void').reduce((n,x)=>n+Number(x.amount||0),0);
 const paid=commissions.filter(x=>x.status==='paid').reduce((n,x)=>n+Number(x.amount||0),0)+commissionAdjustments.filter(x=>x.status==='paid').reduce((n,x)=>n+Number(x.amount||0),0);

 function startHandoff(h?:any){setEditing(h||null);setHandoffFormOpen(true);setForm(h?Object.fromEntries(Object.keys(blank).map(k=>[k,h[k]||''])):blank);setError('')}
 async function saveHandoff(status:'draft'|'submitted'){
  if(!form.vacancy_title.trim()||!form.hiring_need.trim())return setError('Vacancy title and hiring need are required.');
  if(!form.client_id&&!form.prospect_id&&!form.prospect_company.trim())return setError('Choose an assigned client, select one of your prospects, or enter a prospect company.');
  setBusy(true);setError('');
  const payload={...form,client_id:form.client_id||null,prospect_id:form.prospect_id||null,prospect_company:form.client_id?null:form.prospect_company.trim(),vacancy_title:form.vacancy_title.trim(),hiring_need:form.hiring_need.trim(),status};
  const q=editing?supabase.from('partner_commercial_handoffs').update(payload).eq('id',editing.id):supabase.from('partner_commercial_handoffs').insert(payload);
  const{error:e}=await q;setBusy(false);if(e)return setError(e.message);
  toast(status==='submitted'?'Commercial handoff submitted to Vorlen and locked for review.':'Draft saved.');
  setEditing(null);setHandoffFormOpen(false);setForm(blank);await load();
 }
 async function addPipeline(e:any){
  e.preventDefault();if(!access.companyId||!newPipeline.candidate_id||!newPipeline.job_id)return;
  setBusy(true);setError('');
  const{data:{user}}=await supabase.auth.getUser();
  const{error:e2}=await supabase.from('partner_candidate_pipeline').insert({company_id:access.companyId,partner_id:user!.id,candidate_id:newPipeline.candidate_id,job_id:newPipeline.job_id,stage:'sourced'});
  setBusy(false);if(e2)return setError(e2.message);
  setNewPipeline({candidate_id:'',job_id:''});toast('Candidate added to the vacancy pipeline.');await load();
 }
 async function movePipeline(row:any,stage:string){
  setBusy(true);setError('');
  const{error:e}=await supabase.from('partner_candidate_pipeline').update({stage}).eq('id',row.id);
  setBusy(false);if(e)return setError(e.message);
  toast(stage==='recommended'?'Candidate recommended to Vorlen for human review.':'Pipeline updated.');await load();
 }
 async function updateNextAction(row:any){
  const next=prompt('Next action',row.next_action||'');if(next===null)return;
  const when=prompt('Due date/time in ISO or leave blank',row.next_action_at||'');if(when===null)return;
  const due=when.trim()?new Date(when):null;if(due&&Number.isNaN(+due))return setError('Enter a valid date/time or leave it blank.');
  const{error:e}=await supabase.from('partner_candidate_pipeline').update({next_action:next.trim()||null,next_action_at:due?.toISOString()||null}).eq('id',row.id);
  if(e)return setError(e.message);toast('Next action updated.');await load();
 }
 async function discoverCandidates(){
  if(!discoveryJob)return setError('Choose an assigned vacancy first.');
  setBusy(true);setError('');
  const{data,error:e}=await supabase.rpc('partner_candidate_discover',{p_job:discoveryJob,p_query:discoveryQuery||null,p_limit:30});
  setBusy(false);if(e)return setError(e.message);setDiscoveryResults(data||[]);
 }
 async function requestCandidateAccess(row:any){
  const reason=prompt('Why is this candidate relevant to the assigned vacancy?',row.experience_summary||'');if(reason===null)return;
  const{error:e}=await supabase.rpc('partner_request_candidate_access',{p_candidate:row.candidate_id,p_job:discoveryJob,p_reason:reason.trim()||null});
  if(e)return setError(e.message);toast('Candidate access request sent to Vorlen management.');await load();await discoverCandidates();
 }
 async function createTalentPool(){
  if(!poolName.trim())return;
  const{error:e}=await supabase.rpc('partner_create_talent_pool',{p_name:poolName.trim(),p_description:null});
  if(e)return setError(e.message);setPoolName('');toast('Talent pool created.');await load();
 }
 async function addTalentPoolMember(){
  if(!poolId||!poolCandidate)return setError('Choose a talent pool and assigned candidate.');
  const{error:e}=await supabase.rpc('partner_add_talent_pool_member',{p_pool:poolId,p_candidate:poolCandidate});
  if(e)return setError(e.message);setPoolCandidate('');toast('Candidate added to talent pool.');await load();
 }
 async function createReferralLink(job:any){
  setBusy(true);setError('');
  const{data:token,error:e}=await supabase.rpc('partner_create_referral_link',{p_job:job.id,p_label:'Partner referral · '+job.title,p_days:180});
  setBusy(false);if(e)return setError(e.message);
  const url='https://www.vorlen.co.uk/careers/'+encodeURIComponent(job.slug||'')+'?partner_ref='+encodeURIComponent(String(token||''));
  try{await navigator.clipboard.writeText(url);toast('Secure referral link copied. It attributes new applications from this vacancy to your partner account.')}catch{setError('Referral link created but could not be copied automatically. Generate a replacement after enabling clipboard access.')}
 }

 if(access.loading||loading)return <div className="page"><SkeletonRows rows={6}/></div>;
 if(access.role!=='partner')return <div className="page"><div className="notice">Partner workspace access required.</div></div>;
 if(!active)return <div className="page"><Card><h2>Partner activation required</h2><p>Your operational workspace unlocks after agreement acceptance and Vorlen approval.</p></Card></div>;

 if(section==='vacancies'&&!access.partnerCanCloseClients&&!access.partnerCanSourceCandidates)return <div className="page"><Card><h2>Vacancy workspace not enabled</h2><p>B2B Advisors qualify employer opportunities and hand them to a Lead Closer. Vacancy delivery is enabled for Lead Closers, Recruiters and Hybrid Partners.</p></Card></div>;
 if(section==='vacancies')return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">MY VACANCIES</div><h2>Vacancy workspace</h2><p>Work only the genuine vacancies assigned to you by Vorlen.{access.partnerCanCloseClients?' New commercially qualified opportunities can be submitted for Vorlen review.':''}</p></div>{access.partnerCanCloseClients&&<Button onClick={()=>location.assign('/dashboard/partner/handoffs?new=1')}><Plus size={15}/> Submit hiring opportunity</Button>}</div>
  {error&&<div className="notice error">{error}</div>}
  <div className="notice"><strong>Vacancy control:</strong> These are manager-authorised Vorlen vacancy records assigned to you. {access.partnerCanCloseClients?'A new employer opportunity is not live until commercial terms are approved and a manager creates or links the authorised job record.':access.partnerCanProspect?'Qualified employer opportunities should be handed to a Lead Closer through Client Workspace.':'Your role can work assigned vacancy briefs but does not create employer prospects or commercial handoffs.'}</div>
  <Card><div className="card-head"><div><h3>Assigned live work</h3><p>{jobs.length} vacancy record{jobs.length===1?'':'s'} currently visible in your portfolio.</p></div><div className="search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vacancies"/></div></div>
   {!filteredJobs.length?<p className="muted">No assigned vacancies yet.</p>:<div className="table-wrap"><table><thead><tr><th>Vacancy</th><th>Client</th><th>Location</th><th>Status</th><th>Salary</th></tr></thead><tbody>{filteredJobs.map(j=><tr key={j.id}><td><strong>{j.title}</strong><span>{j.employment_type}</span></td><td>{clientsById.get(j.client_id)?.company_name||'Assigned client'}</td><td>{j.location||'—'}</td><td><Badge tone={j.status==='published'?'green':'neutral'}>{String(j.status).replaceAll('_',' ')}</Badge></td><td>{j.salary_min||j.salary_max?`${j.salary_min?money(j.salary_min):'—'} – ${j.salary_max?money(j.salary_max):'—'}`:'Not stated'}<div className="button-row"><Button variant="ghost" onClick={()=>setSelectedJob(j)}>View brief</Button>{access.partnerCanSourceCandidates&&j.status==='published'&&<Button variant="ghost" disabled={busy} onClick={()=>createReferralLink(j)}>Copy referral link</Button>}</div></td></tr>)}</tbody></table></div>}
  </Card>
  {selectedJob&&<Card><div className="card-head"><div><div className="eyebrow">APPROVED VACANCY BRIEF</div><h3>{selectedJob.title}</h3><p>{clientsById.get(selectedJob.client_id)?.company_name||'Client'} · {selectedJob.location}</p></div><button className="close" onClick={()=>setSelectedJob(null)}>×</button></div><div className="grid two"><div><strong>Description</strong><p className="prose">{selectedJob.description||'No description recorded.'}</p></div><div><strong>Requirements</strong><p className="prose">{Array.isArray(selectedJob.requirements)?selectedJob.requirements.join('\n'):selectedJob.requirements||'No requirements recorded.'}</p></div><div><strong>Duties</strong><p className="prose">{selectedJob.duties||'Not recorded.'}</p></div><div><strong>Qualifications</strong><p className="prose">{selectedJob.required_qualifications||'Not recorded.'}</p></div><div><strong>Working pattern</strong><p>{selectedJob.work_days_hours||'Not recorded.'}</p></div><div><strong>Start / duration</strong><p>{selectedJob.start_date||'Not specified'}{selectedJob.duration_text?' · '+selectedJob.duration_text:''}</p></div></div></Card>}
 </div>;

 if(section==='pipeline'&&!access.partnerCanSourceCandidates)return <div className="page"><Card><h2>Candidate sourcing not enabled</h2><p>Your current partner specialism does not include candidate sourcing or pipeline activity.</p></Card></div>;
 if(section==='pipeline')return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">MY PIPELINE</div><h2>Candidate × vacancy pipeline</h2><p>Track each candidate against a specific assigned vacancy. Recommending a candidate sends the record to Vorlen for human review; it does not submit the candidate to the client.</p></div></div>
  {!access.candidateProcessingActive&&<div className="notice"><strong>Candidate processing is currently gated.</strong> The pipeline will become operational when Vorlen activates the candidate-processing phase.</div>}
  {error&&<div className="notice error">{error}</div>}
  {access.candidateProcessingActive&&<div className="grid two"><Card><div className="card-head"><div><h3>Search Vorlen candidate database</h3><p>Search limited candidate profiles for an assigned vacancy. Contact data stays hidden until Vorlen approves access.</p></div></div><div className="form-grid"><label>Assigned vacancy<select value={discoveryJob} onChange={e=>{setDiscoveryJob(e.target.value);setDiscoveryResults([])}}><option value="">Select vacancy…</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title} · {clientsById.get(j.client_id)?.company_name||'Client'}</option>)}</select></label><label>Search<input value={discoveryQuery} onChange={e=>setDiscoveryQuery(e.target.value)} placeholder="skills, location, candidate name…"/></label><Button disabled={busy||!discoveryJob} onClick={discoverCandidates}><Search size={14}/> Search database</Button></div>{discoveryResults.map((r:any)=><div className="list-row" key={r.candidate_id}><div><strong>{r.full_name}</strong><span>{r.location||'Location not recorded'} · {r.stage||'candidate'}</span>{r.experience_summary&&<span>{r.experience_summary}</span>}{r.training_qualifications&&<span>{r.training_qualifications}</span>}</div><div className="button-row">{r.already_assigned?<Badge tone="green">Assigned</Badge>:r.request_status==='pending'?<Badge tone="amber">Access requested</Badge>:r.request_status==='approved'?<Badge tone="green">Approved</Badge>:<Button variant="ghost" onClick={()=>requestCandidateAccess(r)}>Request access</Button>}</div></div>)}{discoveryJob&&!discoveryResults.length&&<p className="muted">Search the secure candidate database before sourcing externally.</p>}</Card><Card><div className="card-head"><div><h3>Talent pools</h3><p>Organise candidates already assigned to you without exporting candidate data.</p></div></div><div className="button-row"><input value={poolName} onChange={e=>setPoolName(e.target.value)} placeholder="e.g. Manchester BDMs"/><Button disabled={!poolName.trim()} onClick={createTalentPool}><Plus size={14}/> Create pool</Button></div>{talentPools.map((p:any)=><div className="list-row" key={p.id}><div><strong>{p.name}</strong><span>{talentPoolMembers.filter((m:any)=>m.pool_id===p.id).length} candidate{talentPoolMembers.filter((m:any)=>m.pool_id===p.id).length===1?'':'s'}</span></div></div>)}{talentPools.length>0&&candidates.length>0&&<div className="form-grid"><label>Pool<select value={poolId} onChange={e=>setPoolId(e.target.value)}><option value="">Select pool…</option>{talentPools.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Assigned candidate<select value={poolCandidate} onChange={e=>setPoolCandidate(e.target.value)}><option value="">Select candidate…</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><Button disabled={!poolId||!poolCandidate} onClick={addTalentPoolMember}>Add to pool</Button></div>}{!talentPools.length&&<p className="muted">Create a pool for recurring skills, sectors or locations.</p>}</Card></div>}
  {access.candidateProcessingActive&&<Card><h3>Add candidate to vacancy</h3><form className="form-grid" onSubmit={addPipeline}><label>Candidate<select required value={newPipeline.candidate_id} onChange={e=>setNewPipeline({...newPipeline,candidate_id:e.target.value})}><option value="">Select assigned candidate…</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><label>Vacancy<select required value={newPipeline.job_id} onChange={e=>setNewPipeline({...newPipeline,job_id:e.target.value})}><option value="">Select assigned vacancy…</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title} · {clientsById.get(j.client_id)?.company_name||'Client'}</option>)}</select></label><Button type="submit" disabled={busy}>Add to pipeline</Button></form></Card>}
  <div className="partner-pipeline">{pipelineStages.map(stage=>{const rows=pipeline.filter(x=>x.stage===stage);return <div className="partner-lane" key={stage}><div className="lane-head"><strong>{stage.replaceAll('_',' ')}</strong><span>{rows.length}</span></div>{rows.map(row=>{const cand=candidateById.get(row.candidate_id),job=jobsById.get(row.job_id);return <Card className="candidate-card" key={row.id}><strong>{cand?.full_name||'Candidate'}</strong><span>{job?.title||'Vacancy'} · {clientsById.get(job?.client_id)?.company_name||'Client'}</span>{row.next_action&&<span>Next: {row.next_action}{row.next_action_at?` · ${new Date(row.next_action_at).toLocaleString('en-GB')}`:''}</span>}{row.manager_status!=='none'&&<Badge tone={row.manager_status==='approved'?'green':row.manager_status==='declined'?'red':'amber'}>{row.manager_status}</Badge>}{row.manager_notes&&<span>Vorlen: {row.manager_notes}</span>}<select aria-label="Pipeline stage" value={row.stage} disabled={busy||['approved','declined'].includes(row.manager_status)} onChange={e=>void movePipeline(row,e.target.value)}>{pipelineStages.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select><Button variant="ghost" disabled={busy||['approved','declined'].includes(row.manager_status)} onClick={()=>updateNextAction(row)}>Next action</Button>{!cand?.work_seeker_terms_agreed_at&&row.stage!=='recommended'&&<span>Work-seeker terms must be evidenced before recommendation.</span>}</Card>})}{!rows.length&&<span className="muted">No candidates</span>}</div>})}</div>
 </div>;

 if(section==='handoffs'&&!access.partnerCanCloseClients)return <div className="page"><Card><h2>Commercial handoffs not enabled</h2><p>Your current partner specialism does not include client-closing authority. B2B Advisors qualify employer opportunities and hand them to an assigned Lead Closer; Lead Closers and Hybrid Partners submit commercial handoffs for Vorlen management approval.</p></Card></div>;
 if(section==='handoffs')return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">COMMERCIAL HANDOFFS</div><h2>Take an opportunity to Vorlen review</h2><p>Capture the hiring need and any commercial request. Vorlen management approves the binding terms.</p></div><Button onClick={()=>startHandoff()}><Plus size={15}/> New handoff</Button></div>
  {error&&<div className="notice error">{error}</div>}
  <div className="notice"><strong>Do not agree terms yourself.</strong> Record what the employer asks for, including fee or payment expectations, without accepting them on Vorlen's behalf. Once submitted, the handoff is locked for Vorlen review.</div>
  {handoffFormOpen&&<Card><div className="card-head"><div><h3>{editing?'Edit draft':'New commercial handoff'}</h3><p>Save as a draft or submit it to Vorlen management.</p></div><button className="close" onClick={()=>{setEditing(null);setHandoffFormOpen(false);setForm(blank)}}>×</button></div><div className="form-grid">
   <label>Assigned client<select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value,prospect_id:e.target.value?'':'',prospect_company:e.target.value?'':form.prospect_company})}><option value="">No assigned client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></label>
   {!form.client_id&&<label>My prospect<select value={form.prospect_id} onChange={e=>{const p=prospects.find(x=>x.id===e.target.value);setForm({...form,prospect_id:e.target.value,prospect_company:p?.company_name||'',contact_name:p?.contact_name||'',contact_email:p?.contact_email||'',contact_phone:p?.contact_phone||'',hiring_need:p?.hiring_need||form.hiring_need})}}><option value="">Enter another prospect manually</option>{prospects.filter(p=>!['declined','do_not_contact'].includes(p.status)).map(p=><option key={p.id} value={p.id}>{p.company_name}</option>)}</select></label>}
   {!form.client_id&&!form.prospect_id&&<label>Prospect company<input required value={form.prospect_company} onChange={e=>setForm({...form,prospect_company:e.target.value})}/></label>}
   <label>Contact name<input value={form.contact_name} onChange={e=>setForm({...form,contact_name:e.target.value})}/></label><label>Contact email<input type="email" value={form.contact_email} onChange={e=>setForm({...form,contact_email:e.target.value})}/></label>
   <label>Contact phone<input value={form.contact_phone} onChange={e=>setForm({...form,contact_phone:e.target.value})}/></label><label>Vacancy title<input required value={form.vacancy_title} onChange={e=>setForm({...form,vacancy_title:e.target.value})}/></label>
   <label>Vacancy location<input value={form.vacancy_location} onChange={e=>setForm({...form,vacancy_location:e.target.value})}/></label><label>Salary / package context<input value={form.salary_context} onChange={e=>setForm({...form,salary_context:e.target.value})} placeholder="What the employer stated"/></label>
   <label className="full">Hiring need<textarea required rows={4} value={form.hiring_need} onChange={e=>setForm({...form,hiring_need:e.target.value})} placeholder="Role, urgency, headcount, decision maker, hiring context…"/></label>
   <label className="full">Commercial request / expectations<textarea rows={3} value={form.commercial_request} onChange={e=>setForm({...form,commercial_request:e.target.value})} placeholder="Record what the employer requested. Do not agree it."/></label>
   <div className="button-row full"><Button variant="ghost" disabled={busy} onClick={()=>saveHandoff('draft')}>Save draft</Button><Button disabled={busy} onClick={()=>saveHandoff('submitted')}><Send size={14}/> Submit to Vorlen</Button></div>
  </div></Card>}
  <Card><h3>My handoffs</h3>{handoffs.map(h=><div className="list-row" key={h.id}><div><strong>{h.vacancy_title}</strong><span>{h.client_id?clientsById.get(h.client_id)?.company_name:(h.prospect_id?prospects.find(p=>p.id===h.prospect_id)?.company_name:h.prospect_company)} · {h.vacancy_location||'Location not stated'}</span>{h.manager_notes&&<span>Vorlen: {h.manager_notes}</span>}{h.approved_job_id&&<span>Live vacancy linked: {jobsById.get(h.approved_job_id)?.title||h.approved_job_id}</span>}</div><div className="button-row"><Badge tone={handoffTone(h.status) as any}>{handoffLabel(h.status)}</Badge>{h.status==='draft'&&<Button variant="ghost" onClick={()=>startHandoff(h)}>Edit</Button>}</div></div>)}{!handoffs.length&&<p className="muted">No handoffs yet.</p>}</Card>
 </div>;

 if(section==='earnings')return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">PLACEMENTS & EARNINGS</div><h2>My commercial outcomes</h2><p>Read-only placement and commission records attributed to your partner account.</p></div></div>
  {error&&<div className="notice error">{error}</div>}
  <div className="grid three"><Card><span className="muted">Expected share</span><h2>{money(expected)}</h2><p>{Number(expectedRate*100).toFixed(0)}% of attributed placement fees</p></Card><Card><span className="muted">Earned / accrued</span><h2>{money(accrued)}</h2><p>after qualifying fees received</p></Card><Card><span className="muted">Paid</span><h2>{money(paid)}</h2><p>commission marked paid by Vorlen</p></Card></div>
  <Card><h3>Attributed placements</h3>{placements.map(p=><div className="list-row" key={p.id}><div><strong>{candidateById.get(p.candidate_id)?.full_name||'Candidate'} · {jobsById.get(p.job_id)?.title||'Placement'}</strong><span>{clientsById.get(p.client_id)?.company_name||'Client'} · fee {money(p.fee_amount,p.currency)} · expected share {money(Number(p.fee_amount||0)*expectedRate,p.currency)}</span></div><Badge tone={p.invoice_status==='paid'?'green':'neutral'}>{String(p.invoice_status).replaceAll('_',' ')}</Badge></div>)}{!placements.length&&<p className="muted">No attributed placements yet.</p>}</Card>
  <Card><h3>Commission ledger</h3>{commissions.map(c=><div className="list-row" key={c.id}><div><strong>{money(c.amount)}</strong><span>Eligible fee received {money(c.eligible_fee_received)} · {(Number(c.rate||0)*100).toFixed(0)}%{c.payment_reference?' · '+c.payment_reference:''}</span></div><Badge tone={c.status==='paid'?'green':'neutral'}>{c.status}</Badge></div>)}{commissionAdjustments.map(a=><div className="list-row" key={'adj-'+a.id}><div><strong>{Number(a.amount||0)>=0?'+':''}{money(a.amount)}</strong><span>Commission adjustment · fee change {Number(a.eligible_fee_delta||0)>=0?'+':''}{money(a.eligible_fee_delta)} · {a.reason}{a.payment_reference?' · '+a.payment_reference:''}</span></div><Badge tone={a.status==='paid'?'green':a.status==='void'?'neutral':'amber'}>{a.status}</Badge></div>)}{!commissions.length&&!commissionAdjustments.length&&<p className="muted">No commission entries yet.</p>}</Card>
 </div>;

 return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">PARTNER RESOURCES</div><h2>How to operate inside Vorlen</h2><p>Practical rules for client development, vacancy qualification, candidate work and escalation.</p></div></div>
  <div className="notice"><strong>Your current operating permissions:</strong> Client development {access.partnerCanDevelopClients?'enabled':'not enabled'} · Candidate sourcing {access.partnerCanSourceCandidates?'enabled':'not enabled'} · Candidate processing phase {access.candidateProcessingActive?'active':'currently gated'}.</div>
  <div className="grid two">
   <Card><Handshake size={20}/><h3>Employer development</h3><p>{access.partnerCanProspect?'Identify genuine UK employers, find the recruitment decision-maker, qualify the hiring need and hand qualified opportunities to a Lead Closer.':access.partnerCanCloseClients?'Work assigned qualified employer opportunities through requirements, approved commercial terms, client activation and the first vacancy.':'Employer development is not assigned to your current partner specialism.'}</p></Card>
   <Card><FileCheck2 size={20}/><h3>Commercial authority</h3><p>You can gather fee expectations and objections, but only authorised Vorlen managers may approve or vary fees, payment terms, rebates, guarantees, exclusivity, candidate ownership or contractual commitments.</p></Card>
   <Card><UserRoundCheck size={20}/><h3>Candidate handling</h3><p>Only process candidates through approved Vorlen workflows. Do not export candidate data into personal systems. A partner recommendation is a request for Vorlen human review, not permission to introduce the candidate to a client.</p></Card>
   <Card><ClipboardList size={20}/><h3>Record keeping</h3><p>Keep client notes, vacancy facts, candidate sourcing evidence, follow-ups and commercial requests in the platform. Accurate timestamped records protect attribution and commission entitlement.</p></Card>
   <Card><Receipt size={20}/><h3>Commission</h3><p>Your accepted partner agreement controls the commission rate. Commission is based on qualifying recruitment fees actually received and retained by Vorlen, not merely on an introduction or invoice.</p></Card>
   <Card><LifeBuoy size={20}/><h3>When to escalate</h3><p>Escalate contractual questions, complaints, data-rights requests, unusual candidate safeguarding issues, fee negotiations and anything that could legally or financially bind Vorlen.</p></Card>
  </div>
 </div>
}
