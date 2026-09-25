import {useEffect,useMemo,useState} from 'react';
import {Building2,Phone,Mail,Users,GitBranch,ChartNoAxesCombined,Plus,RefreshCw,MessageSquareText,Target} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {Badge,Button,Card,SkeletonRows,useToast} from '../components/Ui';

const fmt=(v:any)=>v?new Date(v).toLocaleString('en-GB'):'—';
const money=(v:any)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(v||0));
const stages=['identified','qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won','lost'];
export default function PartnerCRM(){
 const toast=useToast();
 const[clients,setClients]=useState<any[]>([]),[selected,setSelected]=useState(''),[snap,setSnap]=useState<any>(null),[analytics,setAnalytics]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const[tab,setTab]=useState<'contacts'|'timeline'|'opportunities'|'sequences'>('contacts');
 const[comm,setComm]=useState({event_type:'call',channel:'phone',direction:'outbound',contact_id:'',subject:'',summary:''});
 const[opp,setOpp]=useState({name:'',stage:'identified',contact_id:'',expected_fee:'',probability:'10',next_action:'',next_action_at:''});
 const[templateName,setTemplateName]=useState('5-touch employer follow-up'),[templateDescription,setTemplateDescription]=useState('A respectful multi-channel follow-up sequence that stops when the client replies.'),[copilotQ,setCopilotQ]=useState('What should I do next on this account?'),[copilot,setCopilot]=useState<any>(null),[calls,setCalls]=useState<any[]>([]),[callNotes,setCallNotes]=useState<Record<string,any>>({});
 const[steps,setSteps]=useState<any[]>([
   {channel:'call',delay_hours:0,title:'Initial call',instructions:'Confirm the recruitment decision-maker and live hiring need.',priority:'high'},
   {channel:'email',delay_hours:24,title:'Follow-up email',instructions:'Send a concise follow-up based on the conversation.',priority:'normal'},
   {channel:'linkedin',delay_hours:72,title:'LinkedIn touch',instructions:'Personalised manual LinkedIn follow-up; do not automate platform actions.',priority:'normal'},
   {channel:'call',delay_hours:120,title:'Second call',instructions:'Reconnect and confirm urgency / next step.',priority:'normal'},
   {channel:'task',delay_hours:168,title:'Decide next move',instructions:'Qualify, pause or hand off based on evidence.',priority:'high'}
 ]);
 async function loadBase(){
   setLoading(true);setError('');
   const[{data:c,error:ce},{data:a,error:ae}]=await Promise.all([
     supabase.from('clients').select('id,company_name,contact_name,email,phone,status,website').order('company_name'),
     supabase.rpc('partner_analytics_snapshot')
   ]);
   if(ce||ae)setError(ce?.message||ae?.message||'Unable to load CRM workspace');
   setClients(c||[]);setAnalytics(a||null);
   setSelected(v=>v||(c?.[0]?.id||''));
   setLoading(false);
 }
 async function loadClient(id=selected){
   if(!id){setSnap(null);setCalls([]);return}
   setBusy('load');setError('');
   const[{data,error},{data:callRows,error:callError}]=await Promise.all([supabase.rpc('partner_crm_snapshot',{p_client:id}),supabase.rpc('partner_call_transcripts',{p_client:id})]);
   setBusy('');
   if(error||callError){setError(error?.message||callError?.message||'Unable to load account');return}
   setSnap(data);setCalls(callRows||[]);
 }
 useEffect(()=>{void loadBase()},[]);
 useEffect(()=>{if(selected)void loadClient(selected)},[selected]);
 const client=clients.find(c=>c.id===selected);
 const contacts=snap?.contacts||[],timeline=snap?.timeline||[],opps=snap?.opportunities||[],sequences=snap?.sequences||[],templates=snap?.templates||[];
 const primary=contacts.find((x:any)=>x.is_primary)||contacts[0];
 const openOpps=opps.filter((x:any)=>!['won','lost'].includes(x.stage));
 async function saveRelationship(c:any){
   const strength=Number(prompt('Relationship strength 1–5',String(c.relationship_strength||3)));if(!strength)return;
   const status=prompt('Relationship status: new, cold, warming, engaged, strong, inactive',c.relationship_status||'new');if(!status)return;
   const preferred=prompt('Preferred channel: phone, email, sms, linkedin, meeting',c.preferred_channel||'phone');if(!preferred)return;
   setBusy('contact');
   const{error}=await supabase.rpc('partner_update_contact_relationship',{p_contact:c.id,p_relationship_strength:strength,p_relationship_status:status,p_preferred_channel:preferred,p_is_primary:c.is_primary,p_owner_partner:null});
   setBusy('');if(error)return setError(error.message);toast('Contact relationship updated.');await loadClient();
 }
 async function logCommunication(e:any){
   e.preventDefault();if(!comm.summary.trim()||!selected)return;
   setBusy('comm');setError('');
   const{error}=await supabase.rpc('partner_log_communication',{p_client:selected,p_event_type:comm.event_type,p_summary:comm.summary.trim(),p_channel:comm.channel,p_direction:comm.direction,p_contact:comm.contact_id||null,p_candidate:null,p_job:null,p_subject:comm.subject||null,p_occurred_at:new Date().toISOString(),p_metadata:{}});
   setBusy('');if(error)return setError(error.message);
   setComm(v=>({...v,subject:'',summary:''}));toast('Communication added to the account timeline.');await loadClient();
 }
 async function createOpportunity(e:any){
   e.preventDefault();if(!opp.name.trim()||!selected)return;
   setBusy('opp');setError('');
   const{error}=await supabase.rpc('partner_create_opportunity',{p_client:selected,p_name:opp.name.trim(),p_stage:opp.stage,p_contact:opp.contact_id||null,p_job:null,p_expected_fee:opp.expected_fee?Number(opp.expected_fee):null,p_probability:Number(opp.probability||10),p_next_action:opp.next_action||null,p_next_action_at:opp.next_action_at?new Date(opp.next_action_at).toISOString():null});
   setBusy('');if(error)return setError(error.message);
   setOpp({name:'',stage:'identified',contact_id:'',expected_fee:'',probability:'10',next_action:'',next_action_at:''});toast('Opportunity created.');await loadClient();await loadBase();
 }
 async function moveOpportunity(o:any){
   const stage=prompt('Stage: '+stages.join(', '),o.stage);if(!stage)return;
   const probability=Number(prompt('Probability 0–100',String(o.probability??10)));if(Number.isNaN(probability))return;
   const next=prompt('Next action',o.next_action||'');if(next===null)return;
   setBusy('opp');
   const{error}=await supabase.rpc('partner_update_opportunity',{p_opportunity:o.id,p_stage:stage,p_probability:probability,p_expected_fee:o.expected_fee,p_next_action:next||null,p_next_action_at:o.next_action_at,p_lost_reason:stage==='lost'?prompt('Lost reason','')||null:null});
   setBusy('');if(error)return setError(error.message);toast('Opportunity updated.');await loadClient();await loadBase();
 }
 async function createTemplate(){
   if(!templateName.trim())return;
   setBusy('template');setError('');
   const{data,error}=await supabase.rpc('partner_create_outreach_template',{p_name:templateName.trim(),p_description:templateDescription.trim()||null,p_steps:steps,p_stop_on_reply:true});
   setBusy('');if(error)return setError(error.message);toast('Outreach sequence template created.');await loadClient();if(data)void data;
 }
 async function enroll(template:any){
   if(!selected)return;const contactId=primary?.id||null;
   setBusy('sequence');setError('');
   const{error}=await supabase.rpc('partner_enroll_outreach_sequence',{p_template:template.id,p_client:selected,p_contact:contactId});
   setBusy('');if(error)return setError(error.message);toast('Sequence started. Steps were added to your Tasks and will stop if an inbound reply is logged.');await loadClient();
 }
 async function askCopilot(){if(!selected||!copilotQ.trim())return;setBusy('copilot');setError('');const{data,error}=await supabase.functions.invoke('partner-ai-tools',{body:{action:'copilot',client_id:selected,question:copilotQ.trim()}});setBusy('');if(error||data?.error)return setError(data?.error||error?.message||'AI copilot failed');setCopilot(data)}
 async function summariseCall(id:string){setBusy('call-notes');setError('');const{data,error}=await supabase.functions.invoke('partner-ai-tools',{body:{action:'summarize_transcript',transcript_id:id}});setBusy('');if(error||data?.error)return setError(data?.error||error?.message||'AI call notes failed');setCallNotes(v=>({...v,[id]:data}))}
 async function saveCallNotes(call:any){const notes=callNotes[call.id];if(!selected||!notes)return;const sections=[notes.summary,Array.isArray(notes.decisions)&&notes.decisions.length?'Decisions: '+notes.decisions.join(' · '):'',Array.isArray(notes.client_needs)&&notes.client_needs.length?'Client needs: '+notes.client_needs.join(' · '):'',Array.isArray(notes.objections)&&notes.objections.length?'Objections: '+notes.objections.join(' · '):'',Array.isArray(notes.next_actions)&&notes.next_actions.length?'Next actions: '+notes.next_actions.join(' · '):''].filter(Boolean);setBusy('save-call-notes');setError('');const{error}=await supabase.rpc('partner_log_communication',{p_client:selected,p_event_type:'note',p_summary:sections.join('\n'),p_channel:'internal',p_direction:'internal',p_contact:null,p_candidate:null,p_job:null,p_subject:'Reviewed AI call notes',p_occurred_at:call.ended_at||call.started_at||new Date().toISOString(),p_metadata:{source:'ai_call_summary',transcript_id:call.id}});setBusy('');if(error)return setError(error.message);toast('Reviewed call notes saved to the account timeline.');setCallNotes(v=>({...v,[call.id]:{...notes,saved:true}}));await loadClient()}
 if(loading)return <div className="page"><SkeletonRows rows={6}/></div>;
 return <div className="page partner-page">
  {error&&<div className="notice error">{error}</div>}
  <div className="page-actions"><div><div className="eyebrow">ACCOUNT CRM</div><h2>Relationships, pipeline and outreach</h2><p>Everything about an employer account in one place: people, communication, opportunities and follow-up sequences.</p></div><Button variant="ghost" onClick={()=>{void loadBase();if(selected)void loadClient()}}><RefreshCw size={14}/>Refresh</Button></div>
  {analytics&&<div className="partner-kpi-grid">
   <div><span>30-day touches</span><strong>{analytics.contacts||0}</strong><small>{analytics.calls||0} calls · {analytics.emails||0} emails</small></div>
   <div><span>Open opportunities</span><strong>{analytics.open_opportunities||0}</strong><small>{analytics.won_opportunities||0} won this month</small></div>
   <div><span>Weighted pipeline</span><strong>{money(analytics.weighted_pipeline)}</strong><small>Evidence-based expected value</small></div>
   <div><span>Recruiting output</span><strong>{analytics.candidate_recommendations||0}</strong><small>{analytics.interviews||0} interviews · {analytics.placements||0} placements</small></div>
  </div>}
  <div className="grid two"><Card><div className="card-head"><div><h3>AI account copilot</h3><p>Ask about the live assigned account. Answers use current Vorlen data and keep commercial authority with management.</p></div></div><label>Question<input value={copilotQ} onChange={e=>setCopilotQ(e.target.value)}/></label><Button disabled={!selected||busy==='copilot'} onClick={askCopilot}>Ask copilot</Button>{copilot&&<div className="review-box"><strong>{copilot.answer}</strong>{copilot.next_actions?.length>0&&<><span>Next actions</span><ul>{copilot.next_actions.map((x:string)=><li key={x}>{x}</li>)}</ul></>}{copilot.risks_or_missing_info?.length>0&&<><span>Missing / risks</span><ul>{copilot.risks_or_missing_info.map((x:string)=><li key={x}>{x}</li>)}</ul></>}</div>}</Card><Card><div className="card-head"><div><h3>AI call / meeting notes</h3><p>Turn saved call transcripts into factual notes and next actions.</p></div></div>{calls.slice(0,5).map((c:any)=><div className="list-row" key={c.id}><div><strong>{fmt(c.ended_at||c.started_at)}</strong><span>{c.summary||'Saved call transcript'}</span>{callNotes[c.id]&&<div className="review-box"><span>{callNotes[c.id].summary}</span>{callNotes[c.id].next_actions?.length>0&&<small>Next: {callNotes[c.id].next_actions.join(' · ')}</small>}<div className="button-row">{!callNotes[c.id].saved?<Button variant="ghost" disabled={busy==='save-call-notes'} onClick={()=>saveCallNotes(c)}>Save reviewed notes</Button>:<Badge tone="green">Saved to timeline</Badge>}</div></div>}</div><Button variant="ghost" disabled={busy==='call-notes'} onClick={()=>summariseCall(c.id)}>AI notes</Button></div>)}{!calls.length&&<p className="muted">No saved call transcripts for this account yet.</p>}</Card></div>
  <Card><label>Account<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select account…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></label>{client&&<div className="account-strip"><strong>{client.company_name}</strong><span>{client.contact_name||'No named contact'}{client.email?' · '+client.email:''}</span><span>{client.status}</span></div>}</Card>
  {!selected?<Card><p className="muted">No assigned client account is available.</p></Card>:busy==='load'&&!snap?<SkeletonRows rows={4}/>:<>
   <div className="tabs partner-crm-tabs">
    {(['contacts','timeline','opportunities','sequences'] as const).map(x=><button className={tab===x?'active':''} onClick={()=>setTab(x)} key={x}>{x==='contacts'?'Contacts':x==='timeline'?'Timeline':x==='opportunities'?'Deals / opportunities':'Outreach sequences'}</button>)}
   </div>
   {tab==='contacts'&&<div className="grid two"><Card><div className="card-head"><div><h3><Users size={16}/> Account hierarchy</h3><p>Know who owns recruitment, who influences it and how strong the relationship is.</p></div></div>
    {contacts.map((c:any)=><div className="list-row" key={c.id}><div><strong>{c.name}{c.is_primary?' · Primary':''}</strong><span>{c.role_title||'Title not recorded'} · {String(c.recruitment_authority||'unknown').replaceAll('_',' ')}</span><span>{c.email||'No email'}{c.phone?' · '+c.phone:''}</span><span>Relationship: {c.relationship_status||'new'}{c.relationship_strength?' · '+c.relationship_strength+'/5':''}{c.preferred_channel?' · prefers '+c.preferred_channel:''}</span><span>{c.owner_partner_id?'Partner-owned':'No relationship owner'}{c.last_contacted_at?' · last touch '+fmt(c.last_contacted_at):''}</span></div><Button variant="ghost" disabled={!!busy} onClick={()=>saveRelationship(c)}>Relationship</Button></div>)}
    {!contacts.length&&<p className="muted">No recruitment contacts yet. Add contacts from My clients → Client Workspace.</p>}
   </Card><Card><h3>Decision-maker check</h3>{primary?<><p><strong>{primary.name}</strong> is currently the primary recruitment contact.</p><p className="muted">{primary.role_title||'No title recorded'} · {String(primary.recruitment_authority||'unknown').replaceAll('_',' ')}</p>{primary.recruitment_authority!=='decision_maker'&&<div className="notice">The primary contact is not marked as the recruitment decision-maker. Confirm authority before progressing commercial work.</div>}</>:<div className="notice">No primary recruitment contact is recorded yet.</div>}</Card></div>}
   {tab==='timeline'&&<div className="grid two"><Card><div className="card-head"><div><h3><MessageSquareText size={16}/> Unified account timeline</h3><p>Calls, email, notes, meetings, TOB, handoffs, vacancies, submissions and interviews.</p></div></div>{timeline.slice(0,100).map((x:any,i:number)=><div className="list-row" key={(x.type||'e')+i+String(x.at)}><div><strong>{x.title||x.type}</strong><span>{x.detail||'No detail'}</span><small>{fmt(x.at)} · {x.direction||'internal'}{x.channel?' · '+x.channel:''}</small></div></div>)}{!timeline.length&&<p className="muted">No account history yet.</p>}</Card>
    <Card><h3>Add communication</h3><form className="form-grid" onSubmit={logCommunication}><label>Type<select value={comm.event_type} onChange={e=>setComm({...comm,event_type:e.target.value})}>{['call','email','sms','linkedin','note','meeting'].map(x=><option key={x}>{x}</option>)}</select></label><label>Direction<select value={comm.direction} onChange={e=>setComm({...comm,direction:e.target.value})}><option value="outbound">Outbound</option><option value="inbound">Inbound / reply</option><option value="internal">Internal</option></select></label><label>Contact<select value={comm.contact_id} onChange={e=>setComm({...comm,contact_id:e.target.value})}><option value="">Account-level</option>{contacts.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Subject<input value={comm.subject} onChange={e=>setComm({...comm,subject:e.target.value})}/></label><label className="full">What happened?<textarea rows={5} required value={comm.summary} onChange={e=>setComm({...comm,summary:e.target.value})} placeholder="Facts, outcome, decision and agreed next step."/></label><Button type="submit" disabled={busy==='comm'}>Add to timeline</Button></form><p className="muted">Logging an inbound reply automatically stops active sequences configured to stop on reply.</p></Card></div>}
   {tab==='opportunities'&&<div className="grid two"><Card><div className="card-head"><div><h3><Target size={16}/> Opportunity pipeline</h3><p>A single sales pipeline from identified need through accepted terms, vacancy and win/loss.</p></div></div>{opps.map((o:any)=><div className="list-row" key={o.id}><div><strong>{o.name}</strong><span>{o.stage.replaceAll('_',' ')} · {o.probability}%{o.expected_fee?' · '+money(o.expected_fee):''}</span>{o.next_action&&<span>Next: {o.next_action}{o.next_action_at?' · '+fmt(o.next_action_at):''}</span>}</div><Button variant="ghost" onClick={()=>moveOpportunity(o)}>Update</Button></div>)}{!opps.length&&<p className="muted">No opportunities yet.</p>}</Card>
    <Card><h3><Plus size={16}/> New opportunity</h3><form className="form-grid" onSubmit={createOpportunity}><label className="full">Opportunity<input required value={opp.name} onChange={e=>setOpp({...opp,name:e.target.value})} placeholder="e.g. Q4 sales team expansion"/></label><label>Stage<select value={opp.stage} onChange={e=>setOpp({...opp,stage:e.target.value})}>{stages.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label><label>Decision-maker<select value={opp.contact_id} onChange={e=>setOpp({...opp,contact_id:e.target.value})}><option value="">Not linked</option>{contacts.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Expected fee £<input type="number" min="0" value={opp.expected_fee} onChange={e=>setOpp({...opp,expected_fee:e.target.value})}/></label><label>Probability %<input type="number" min="0" max="100" value={opp.probability} onChange={e=>setOpp({...opp,probability:e.target.value})}/></label><label className="full">Next action<input value={opp.next_action} onChange={e=>setOpp({...opp,next_action:e.target.value})}/></label><label>Due<input type="datetime-local" value={opp.next_action_at} onChange={e=>setOpp({...opp,next_action_at:e.target.value})}/></label><Button type="submit" disabled={busy==='opp'}>Create opportunity</Button></form></Card></div>}
   {tab==='sequences'&&<div className="grid two"><Card><h3><GitBranch size={16}/> Active sequences</h3>{sequences.map((e:any)=><div className="list-row" key={e.id}><div><strong>{e.template?.name||'Sequence'}</strong><span>{e.status.replaceAll('_',' ')} · started {fmt(e.created_at)}</span>{e.replied_at&&<span>Stopped on reply {fmt(e.replied_at)}</span>}</div><Badge tone={e.status==='active'?'green':e.status==='stopped_reply'?'amber':'neutral'}>{e.status.replaceAll('_',' ')}</Badge></div>)}{!sequences.length&&<p className="muted">No sequences running for this account.</p>}<h3>Available templates</h3>{templates.map((t:any)=><div className="list-row" key={t.id}><div><strong>{t.name}</strong><span>{Array.isArray(t.steps)?t.steps.length:0} steps · {t.stop_on_reply?'stops on reply':'manual stop'}</span></div><Button variant="ghost" onClick={()=>enroll(t)}>Start</Button></div>)}</Card>
    <Card><h3>Create sequence template</h3><label>Name<input value={templateName} onChange={e=>setTemplateName(e.target.value)}/></label><label>Description<textarea rows={3} value={templateDescription} onChange={e=>setTemplateDescription(e.target.value)}/></label><div className="sequence-preview">{steps.map((x,i)=><div className="list-row" key={i}><div><strong>{i+1}. {x.title}</strong><span>{x.channel} · +{x.delay_hours}h</span><small>{x.instructions}</small></div></div>)}</div><Button disabled={busy==='template'} onClick={createTemplate}>Save reusable sequence</Button><p className="muted">Email, SMS and LinkedIn steps are created as accountable partner actions unless an approved provider integration is connected. External platforms are never automated without provider authorisation.</p></Card></div>}
  </>}
 </div>
}