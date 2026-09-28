import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Bell,ChevronLeft,FileText,Image as ImageIcon,Link2,MessageCircle,Paperclip,Pencil,Pin,Reply,Search,Send,Trash2,X} from 'lucide-react';
import {Link,useSearchParams} from 'react-router-dom';
import {Badge,Button,SkeletonCards,useToast} from '../components/Ui';
import {supabase} from '../lib/supabase';
import {useWorkspaceAccess} from '../lib/access';

type Mode='partner'|'manager';
type Conversation={conversation_id:string;partner_id:string;partner_name:string;specialism?:string|null;partner_active?:boolean;last_message_at?:string|null;last_message?:string|null;unread_count?:number;partner_last_seen_at?:string|null};
type Message={id:string;company_id:string;conversation_id:string;sender_id:string;body:string;message_type:string;reply_to_id?:string|null;context_type?:string|null;context_id?:string|null;context_label?:string|null;context_path?:string|null;created_at:string;edited_at?:string|null;deleted_at?:string|null;pinned_at?:string|null;pinned_by?:string|null};
type Attachment={id:string;message_id:string;filename:string;mime_type:string;size_bytes:number;storage_path:string;signed_url?:string};
type Receipt={message_id:string;user_id:string;delivered_at:string;read_at?:string|null};
type UserState={conversation_id:string;user_id:string;last_seen_at:string;typing_until?:string|null};
type ContextOption={id:string;label:string;path:string};

const allowedTypes=new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const maxFile=10*1024*1024;
const contextTypes=[['client','Client'],['job','Vacancy'],['candidate','Candidate'],['application','Application'],['submission','Submission pack'],['handoff','Commercial handoff'],['placement','Placement'],['commission','Commission'],['task','Work queue']] as const;
const fmt=(v?:string|null)=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'';
const clock=(v:string)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const dayKey=(v:string)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
const safeName=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'file';
const size=(n:number)=>n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(1)} MB`;
const urlPattern=/(https?:\/\/[^\s<]+[^\s<.,:;!?'"\])}])/gi;
function renderMessageBody(body:string){const parts=body.split(urlPattern);return <p>{parts.map((part,i)=>/^https?:\/\//i.test(part)?<a className="chat-inline-link" key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>:part)}</p>}

export default function PartnerChat({mode}:{mode:Mode}){
 const access=useWorkspaceAccess(),toast=useToast(),[params,setParams]=useSearchParams();
 const [me,setMe]=useState(''),[conversations,setConversations]=useState<Conversation[]>([]),[conversationId,setConversationId]=useState(''),[partnerId,setPartnerId]=useState('');
 const [messages,setMessages]=useState<Message[]>([]),[attachments,setAttachments]=useState<Attachment[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]),[states,setStates]=useState<UserState[]>([]);
 const [loading,setLoading]=useState(true),[loadingMessages,setLoadingMessages]=useState(false),[hasMore,setHasMore]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState('');
 const [body,setBody]=useState(''),[files,setFiles]=useState<File[]>([]),[replyTo,setReplyTo]=useState<Message|null>(null),[editing,setEditing]=useState<Message|null>(null);
 const [partnerSearch,setPartnerSearch]=useState(''),[messageSearch,setMessageSearch]=useState(''),[searchResults,setSearchResults]=useState<Message[]>([]);
 const [showContext,setShowContext]=useState(false),[contextType,setContextType]=useState(''),[contextOptions,setContextOptions]=useState<ContextOption[]>([]),[context,setContext]=useState<ContextOption|null>(null);
 const [notifySupported,setNotifySupported]=useState(false),[now,setNow]=useState(Date.now()),[mobileSearchOpen,setMobileSearchOpen]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null),bottomRef=useRef<HTMLDivElement>(null),typingTimer=useRef<number|null>(null),refreshTimer=useRef<number|null>(null);

 const selected=useMemo(()=>conversations.find(c=>c.conversation_id===conversationId)||null,[conversations,conversationId]);
 const partnerUserId=mode==='partner'?me:(selected?.partner_id||partnerId);
 const otherStates=states.filter(s=>s.user_id!==me);
 const relevantOtherStates=mode==='manager'&&partnerUserId?otherStates.filter(s=>s.user_id===partnerUserId):otherStates;
 const otherOnline=relevantOtherStates.some(s=>now-new Date(s.last_seen_at).getTime()<75000);
 const otherTyping=relevantOtherStates.some(s=>!!s.typing_until&&new Date(s.typing_until).getTime()>now);
 const pinned=messages.filter(m=>m.pinned_at&&!m.deleted_at).slice(-3);
 const visibleMessages=messageSearch.trim()?searchResults:messages;
 const filteredConversations=conversations.filter(c=>(c.partner_name||'').toLowerCase().includes(partnerSearch.trim().toLowerCase()));

 const refreshList=useCallback(async()=>{
  if(mode!=='manager')return;
  const{data,error:e}=await supabase.rpc('partner_chat_list');
  if(e){setError(e.message);return}
  const rows=(data||[]) as Conversation[];setConversations(rows);
  const requested=params.get('partner');
  setConversationId(cur=>cur||(requested?rows.find(x=>x.partner_id===requested)?.conversation_id:'')||rows[0]?.conversation_id||'');
 },[mode,params]);

 useEffect(()=>{void(async()=>{if(access.loading)return;setLoading(true);setError('');const{data:{user}}=await supabase.auth.getUser();if(!user){setError('Your session has expired.');setLoading(false);return}setMe(user.id);
  if(mode==='manager'){await refreshList();setLoading(false);return}
  let{data:c,error:e}=await supabase.from('partner_conversations').select('id,partner_id,last_message_at').eq('partner_id',user.id).limit(1).maybeSingle();
  if(e){setError(e.message);setLoading(false);return}
  if(!c&&access.companyId){const created=await supabase.from('partner_conversations').insert({company_id:access.companyId,partner_id:user.id}).select('id,partner_id,last_message_at').single();c=created.data;e=created.error}
  if(e||!c){setError(e?.message||'Your management conversation is not available.');setLoading(false);return}
  const row:Conversation={conversation_id:c.id,partner_id:c.partner_id,partner_name:'Vorlen management',last_message_at:c.last_message_at};setConversations([row]);setConversationId(c.id);setPartnerId(user.id);setLoading(false);
 })()},[access.loading,access.companyId,mode,refreshList]);

 const signAttachments=useCallback(async(rows:any[])=>{
  if(!rows.length)return [] as Attachment[];
  return await Promise.all(rows.map(async(a:any)=>{const{data}=await supabase.storage.from('partner-chat').createSignedUrl(a.storage_path,3600);return{...a,signed_url:data?.signedUrl||undefined} as Attachment}));
 },[]);

 const markIncoming=useCallback(async(msgs:Message[],existing:Receipt[])=>{
  if(!me||!conversationId)return;const incoming=msgs.filter(m=>m.sender_id!==me&&!m.deleted_at);if(!incoming.length)return;
  const byId=new Map(existing.filter(r=>r.user_id===me).map(r=>[r.message_id,r]));
  const nowIso=new Date().toISOString(),rows=incoming.map(m=>({message_id:m.id,conversation_id:conversationId,user_id:me,delivered_at:byId.get(m.id)?.delivered_at||nowIso,read_at:document.visibilityState==='visible'?nowIso:(byId.get(m.id)?.read_at||null)}));
  const{error:e}=await supabase.from('partner_message_receipts').upsert(rows,{onConflict:'message_id,user_id'});if(!e&&document.visibilityState==='visible')window.dispatchEvent(new Event('partner-chat-read'));
 },[me,conversationId]);

 const loadConversation=useCallback(async(older=false)=>{
  if(!conversationId)return;setLoadingMessages(true);setError('');
  let q=supabase.from('partner_messages').select('*').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(80);
  if(older&&messages.length)q=q.lt('created_at',messages[0].created_at);
  const{data:m,error:e}=await q;if(e){setError(e.message);setLoadingMessages(false);return}
  const batch=((m||[]) as Message[]).reverse(),combined=older?[...batch,...messages]:batch,setIds=combined.map(x=>x.id);
  setMessages(combined);setHasMore((m||[]).length===80);
  const [a,r,s]=await Promise.all([
    setIds.length?supabase.from('partner_message_attachments').select('*').in('message_id',setIds):Promise.resolve({data:[],error:null} as any),
    setIds.length?supabase.from('partner_message_receipts').select('*').in('message_id',setIds):Promise.resolve({data:[],error:null} as any),
    supabase.from('partner_chat_user_state').select('*').eq('conversation_id',conversationId)
  ]);
  if(a.error||r.error||s.error)setError(a.error?.message||r.error?.message||s.error?.message||'Chat data could not be loaded.');
  const signed=await signAttachments(a.data||[]);setAttachments(signed);setReceipts((r.data||[]) as Receipt[]);setStates((s.data||[]) as UserState[]);
  await markIncoming(combined,(r.data||[]) as Receipt[]);
  setLoadingMessages(false);
  if(!older)window.setTimeout(()=>bottomRef.current?.scrollIntoView({block:'end'}),30);
 },[conversationId,messages,markIncoming,signAttachments]);

 useEffect(()=>{if(conversationId)void loadConversation(false)},[conversationId]);

 const touchState=useCallback(async(typing=false)=>{
  if(!conversationId||!me)return;const t=new Date(),typingUntil=typing?new Date(t.getTime()+4500).toISOString():null;
  await supabase.from('partner_chat_user_state').upsert({conversation_id:conversationId,user_id:me,last_seen_at:t.toISOString(),typing_until:typingUntil,updated_at:t.toISOString()},{onConflict:'conversation_id,user_id'});
 },[conversationId,me]);

 useEffect(()=>{if(!conversationId||!me)return;void touchState(false);const timer=window.setInterval(()=>void touchState(false),30000);const vis=()=>{if(document.visibilityState==='visible'){void touchState(false);void loadConversation(false)}};document.addEventListener('visibilitychange',vis);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',vis)}},[conversationId,me,touchState]);

 useEffect(()=>{if(mode!=='manager'||!me)return;const ch=supabase.channel('partner-chat-manager-list-'+me).on('postgres_changes',{event:'INSERT',schema:'public',table:'partner_messages'},()=>void refreshList()).subscribe();return()=>{void supabase.removeChannel(ch)}},[mode,me,refreshList]);

 useEffect(()=>{if(!conversationId||!me)return;const schedule=()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current);refreshTimer.current=window.setTimeout(()=>{void loadConversation(false);if(mode==='manager')void refreshList()},120)};
  const ch=supabase.channel(`partner-chat-db-${conversationId}-${me}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_messages',filter:`conversation_id=eq.${conversationId}`},schedule)
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_message_receipts',filter:`conversation_id=eq.${conversationId}`},schedule)
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_chat_user_state',filter:`conversation_id=eq.${conversationId}`},schedule)
   .subscribe();
  return()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current);void supabase.removeChannel(ch)}
 },[conversationId,me,mode,selected?.partner_name,loadConversation,refreshList]);

 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),2000);setNotifySupported(typeof window!=='undefined'&&'Notification'in window);return()=>window.clearInterval(t)},[]);

 async function searchMessages(v:string){setMessageSearch(v);if(v.trim().length<2){setSearchResults([]);return}const{data,error:e}=await supabase.from('partner_messages').select('*').eq('conversation_id',conversationId).ilike('body',`%${v.trim().replace(/[%_]/g,'')}%`).order('created_at',{ascending:false}).limit(100);if(e)setError(e.message);else setSearchResults(((data||[]) as Message[]).reverse())}

 async function loadContextOptions(type:string){setContextType(type);setContext(null);setContextOptions([]);if(!type)return;if(type==='task'){setContextOptions([{id:'work-queue',label:'Work queue',path:mode==='partner'?'/dashboard/partner/tasks':'/dashboard/partner-management'}]);return}
  const configs:any={
   client:{table:'clients',select:'id,company_name',label:(x:any)=>x.company_name,path:(x:any)=>mode==='partner'?`/dashboard/partner/clients?client=${x.id}`:`/dashboard/clients/${x.id}`},
   job:{table:'jobs',select:'id,title',label:(x:any)=>x.title,path:(x:any)=>mode==='partner'?`/dashboard/partner/vacancies?job=${x.id}`:'/dashboard/jobs'},
   candidate:{table:'candidates',select:'id,full_name',label:(x:any)=>x.full_name,path:(x:any)=>mode==='partner'?`/dashboard/partner/candidates/${x.id}`:`/dashboard/candidates/${x.id}`},
   application:{table:'applications',select:'id,status',label:(x:any)=>`Application · ${String(x.id).slice(0,8)} · ${x.status}`,path:()=>mode==='partner'?'/dashboard/partner/applications':'/dashboard/applications'},
   submission:{table:'partner_submission_packs',select:'id,status',label:(x:any)=>`Submission pack · ${String(x.id).slice(0,8)} · ${x.status}`,path:()=>mode==='partner'?'/dashboard/partner/talent':'/dashboard/partner-management'},
   handoff:{table:'partner_commercial_handoffs',select:'id,status',label:(x:any)=>`Commercial handoff · ${String(x.id).slice(0,8)} · ${x.status}`,path:()=>mode==='partner'?'/dashboard/partner/handoffs':'/dashboard/partner-management'},
   placement:{table:'placements',select:'id,start_date',label:(x:any)=>`Placement · ${String(x.id).slice(0,8)}${x.start_date?' · '+x.start_date:''}`,path:()=>mode==='partner'?'/dashboard/partner/earnings':'/dashboard/commercial'},
   commission:{table:'partner_commissions',select:'id,amount,status',label:(x:any)=>`Commission · £${Number(x.amount||0).toFixed(2)} · ${x.status}`,path:()=>mode==='partner'?'/dashboard/partner/earnings':'/dashboard/commercial'}
  };const c=configs[type];if(!c)return;const{data,error:e}=await supabase.from(c.table).select(c.select).limit(100);if(e){setError('Context items could not be loaded: '+e.message);return}setContextOptions((data||[]).map((x:any)=>({id:x.id,label:c.label(x),path:c.path(x)})))}

 function chooseFiles(list:FileList|null){if(!list)return;const accepted:File[]=[];for(const f of Array.from(list)){if(f.size>maxFile){toast(`${f.name} is larger than 10 MB.`,{tone:'error'});continue}if(!allowedTypes.has(f.type)){toast(`${f.name} is not a supported image, PDF or Office document.`,{tone:'error'});continue}accepted.push(f)}setFiles(v=>[...v,...accepted].slice(0,5))}

 function typeBody(v:string){setBody(v);if(editing)return;if(typingTimer.current)window.clearTimeout(typingTimer.current);void touchState(true);typingTimer.current=window.setTimeout(()=>void touchState(false),4800)}

 async function sendMessage(){
  if(!conversationId||!me||sending)return;if(editing){const next=body.trim();if(!next)return;setSending(true);const{error:e}=await supabase.from('partner_messages').update({body:next}).eq('id',editing.id);setSending(false);if(e)return setError(e.message);setEditing(null);setBody('');toast('Message updated.');return}
  if(!body.trim()&&!files.length)return;setSending(true);setError('');
  const payload:any={conversation_id:conversationId,company_id:access.companyId,sender_id:me,body:body.trim(),message_type:files.length?'attachment':'text',reply_to_id:replyTo?.id||null};
  if(context){payload.context_type=contextType;payload.context_id=contextType==='task'?null:context.id;payload.context_label=context.label;payload.context_path=context.path}
  const{data:m,error:e}=await supabase.from('partner_messages').insert(payload).select('*').single();if(e||!m){setSending(false);setError(e?.message||'Message could not be sent.');return}
  const uploaded:string[]=[],attachmentRows:string[]=[];try{for(const f of files){const path=`${access.companyId}/${conversationId}/${m.id}/${crypto.randomUUID()}-${safeName(f.name)}`;const up=await supabase.storage.from('partner-chat').upload(path,f,{contentType:f.type,upsert:false});if(up.error)throw up.error;uploaded.push(path);const row=await supabase.from('partner_message_attachments').insert({company_id:access.companyId,conversation_id:conversationId,message_id:m.id,uploaded_by:me,storage_path:path,filename:f.name,mime_type:f.type,size_bytes:f.size}).select('id').single();if(row.error)throw row.error;if(row.data?.id)attachmentRows.push(row.data.id)}}
  catch(err){if(uploaded.length)await supabase.storage.from('partner-chat').remove(uploaded);if(attachmentRows.length)await supabase.from('partner_message_attachments').delete().in('id',attachmentRows);await supabase.from('partner_messages').update({deleted_at:new Date().toISOString()}).eq('id',m.id);setSending(false);setError(err instanceof Error?err.message:'Attachment upload failed.');return}
  setBody('');setFiles([]);setReplyTo(null);setContext(null);setContextType('');setShowContext(false);await touchState(false);setSending(false);await loadConversation(false);if(mode==='manager')await refreshList();
 }

 async function removeMessage(m:Message){if(!confirm('Delete this message? The audit record will be retained.'))return;const{error:e}=await supabase.from('partner_messages').update({deleted_at:new Date().toISOString()}).eq('id',m.id);if(e)setError(e.message);else toast('Message deleted.')}
 async function togglePin(m:Message){const{error:e}=await supabase.from('partner_messages').update({pinned_at:m.pinned_at?null:new Date().toISOString(),pinned_by:null}).eq('id',m.id);if(e)setError(e.message);else toast(m.pinned_at?'Message unpinned.':'Message pinned.')}
 async function enableNotifications(){if(!notifySupported)return;const p=await Notification.requestPermission();toast(p==='granted'?'Chat notifications enabled.':'Notifications were not enabled.',{tone:p==='granted'?'success':'warning'})}

 function startEdit(m:Message){setEditing(m);setReplyTo(null);setFiles([]);setBody(m.body);window.setTimeout(()=>document.querySelector<HTMLTextAreaElement>('.chat-compose textarea')?.focus(),0)}
 function startReply(m:Message){setReplyTo(m);setEditing(null);window.setTimeout(()=>document.querySelector<HTMLTextAreaElement>('.chat-compose textarea')?.focus(),0)}
 function attachmentFor(id:string){return attachments.filter(a=>a.message_id===id)}
 function statusFor(m:Message){if(m.sender_id!==me)return'';const rs=receipts.filter(r=>r.message_id===m.id&&r.user_id!==me);return rs.some(r=>r.read_at)?'Read':rs.some(r=>r.delivered_at)?'Delivered':'Sent'}
 function canChange(m:Message){return m.sender_id===me&&!m.deleted_at&&Date.now()-new Date(m.created_at).getTime()<=15*60000}
 function messageSide(m:Message){if(mode==='partner')return m.sender_id===me?'out':'in';return m.sender_id===partnerUserId?'in':'out'}
 function scrollTo(id:string){document.querySelector(`[data-message-id="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});setMessageSearch('');setSearchResults([])}
 const headerName=mode==='partner'?'Vorlen management':selected?.partner_name||'Partner';
 const headerSub=otherTyping?'typing…':otherOnline?'online':mode==='manager'&&selected?.partner_last_seen_at?'last active '+fmt(selected.partner_last_seen_at):'Secure partner channel';

 if(loading)return <div className="page"><SkeletonCards count={5}/></div>;
 return <div className="page chat-page">
  <div className="page-actions chat-page-head"><div><div className="eyebrow">PARTNER COMMUNICATIONS</div><h2>{mode==='partner'?'Chat with Vorlen':'Partner messages'}</h2><p>{mode==='partner'?'Private 1-to-1 communication with Vorlen management.':'Live partner conversations, linked directly to operational work.'}</p></div>{notifySupported&&Notification.permission!=='granted'&&<Button className="chat-notification-cta" variant="ghost" onClick={enableNotifications}><Bell size={15}/><span>Enable notifications</span></Button>}</div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <div className={`chat-shell ${mode==='partner'?'partner-only':''}`}>
   {mode==='manager'&&<aside className={`chat-list ${conversationId?'has-selection':''}`}>
    <div className="chat-list-head"><div className="search"><Search size={15}/><input value={partnerSearch} onChange={e=>setPartnerSearch(e.target.value)} placeholder="Search partners"/></div></div>
    <div className="chat-partners">{filteredConversations.map(c=><button key={c.conversation_id} className={c.conversation_id===conversationId?'active':''} onClick={()=>{setConversationId(c.conversation_id);setPartnerId(c.partner_id);setParams(c.partner_id?{partner:c.partner_id}:{})}}>
      <span className="chat-avatar">{c.partner_name?.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'P'}</span><span className="chat-partner-copy"><strong>{c.partner_name}</strong><small>{String(c.specialism||'partner').replaceAll('_',' ')}</small><em>{c.last_message||'Start a conversation'}</em></span><span className="chat-list-meta"><time>{c.last_message_at?clock(c.last_message_at):''}</time>{Number(c.unread_count||0)>0&&<b>{Number(c.unread_count)>99?'99+':c.unread_count}</b>}</span>
     </button>)}</div>
   </aside>}
   <section className={`chat-conversation ${!conversationId?'empty-chat':''}`}>
    {!conversationId?<div className="chat-empty"><MessageCircle size={32}/><h3>Select a partner</h3><p>Choose a conversation to start messaging.</p></div>:<>
     <><header className="chat-header">{mode==='manager'&&<button className="chat-back" aria-label="Back to partner conversations" onClick={()=>setConversationId('')}><ChevronLeft size={20}/></button>}<span className="chat-avatar">{headerName.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span><div className="chat-header-copy"><strong>{headerName}</strong><span className={otherOnline?'online':''}>{headerSub}</span></div><div className="chat-header-actions">{notifySupported&&Notification.permission!=='granted'&&<button className="chat-header-notification" aria-label="Enable chat notifications" onClick={enableNotifications}><Bell size={17}/></button>}<div className="search chat-message-search"><Search size={14}/><input value={messageSearch} onChange={e=>void searchMessages(e.target.value)} placeholder="Search messages"/></div><button className="chat-mobile-search-toggle" aria-label={mobileSearchOpen?'Close message search':'Search messages'} aria-expanded={mobileSearchOpen} onClick={()=>setMobileSearchOpen(v=>!v)}>{mobileSearchOpen?<X size={18}/>:<Search size={18}/>}</button></div></header>{mobileSearchOpen&&<div className="chat-mobile-search"><Search size={15}/><input autoFocus value={messageSearch} onChange={e=>void searchMessages(e.target.value)} placeholder="Search messages"/></div>}</>
     {pinned.length>0&&<div className="chat-pinned"><Pin size={14}/><div>{pinned.map(m=><button key={m.id} onClick={()=>scrollTo(m.id)}>{m.context_label||m.body||'Pinned attachment'}</button>)}</div></div>}
     <div className="chat-messages">
      {hasMore&&!messageSearch&&<button className="chat-load-more" disabled={loadingMessages} onClick={()=>void loadConversation(true)}>{loadingMessages?'Loading…':'Load older messages'}</button>}
      {visibleMessages.map((m,i)=>{const previous=visibleMessages[i-1],showDay=!previous||dayKey(previous.created_at)!==dayKey(m.created_at),side=messageSide(m),reply=messages.find(x=>x.id===m.reply_to_id),atts=attachmentFor(m.id);return <div key={m.id}>{showDay&&<div className="chat-day"><span>{dayKey(m.created_at)}</span></div>}<article data-message-id={m.id} className={`chat-message ${side} ${m.pinned_at?'pinned':''} ${m.deleted_at?'deleted':''}`}>
       <div className="chat-bubble">{m.pinned_at&&<span className="chat-pin"><Pin size={11}/> Pinned</span>}{reply&&<button className="chat-reply-preview" onClick={()=>scrollTo(reply.id)}><strong>{reply.sender_id===me?'You':mode==='partner'?'Vorlen management':selected?.partner_name||'Partner'}</strong><span>{reply.deleted_at?'Deleted message':reply.body||'Attachment'}</span></button>}
        {m.deleted_at?<p className="chat-deleted">This message was deleted</p>:<>{m.body&&renderMessageBody(m.body)}{m.context_label&&m.context_path&&<Link className="chat-context" to={m.context_path}><Link2 size={14}/><span><small>{String(m.context_type||'context').replaceAll('_',' ')}</small><strong>{m.context_label}</strong></span></Link>}{atts.map(a=><a key={a.id} className={`chat-attachment ${a.mime_type.startsWith('image/')?'image':''}`} href={a.signed_url||'#'} target="_blank" rel="noreferrer">{a.mime_type.startsWith('image/')&&a.signed_url?<img src={a.signed_url} alt={a.filename}/>:a.mime_type.startsWith('image/')?<ImageIcon size={18}/>:<FileText size={18}/>}<span><strong>{a.filename}</strong><small>{size(a.size_bytes)}</small></span></a>)}</>}
        <footer><time>{clock(m.created_at)}</time>{m.edited_at&&!m.deleted_at&&<span>edited</span>}{m.sender_id===me&&<span className="chat-status">{statusFor(m)}</span>}</footer>
       </div>
       {!m.deleted_at&&<div className="chat-actions"><button title="Reply" onClick={()=>startReply(m)}><Reply size={13}/></button>{canChange(m)&&<button title="Edit" onClick={()=>startEdit(m)}><Pencil size={13}/></button>}{canChange(m)&&<button title="Delete" onClick={()=>void removeMessage(m)}><Trash2 size={13}/></button>}{mode==='manager'&&<button title={m.pinned_at?'Unpin':'Pin'} onClick={()=>void togglePin(m)}><Pin size={13}/></button>}</div>}
      </article></div>})}
      {!visibleMessages.length&&!loadingMessages&&<div className="chat-empty small"><MessageCircle size={24}/><h3>{messageSearch?'No matching messages':'No messages yet'}</h3><p>{messageSearch?'Try another search.':'Send the first message in this private channel.'}</p></div>}
      <div ref={bottomRef}/>
     </div>
     <div className="chat-compose-wrap">{(replyTo||editing)&&<div className="chat-compose-state"><div><strong>{editing?'Editing message':'Replying to '+(replyTo?.sender_id===me?'yourself':mode==='partner'?'Vorlen management':selected?.partner_name||'partner')}</strong><span>{editing?editing.body:replyTo?.body||'Attachment'}</span></div><button onClick={()=>{setReplyTo(null);if(editing){setEditing(null);setBody('')}}}><X size={16}/></button></div>}
      {context&&<div className="chat-compose-context"><Link2 size={14}/><span><small>{contextType.replaceAll('_',' ')}</small><strong>{context.label}</strong></span><button onClick={()=>{setContext(null);setContextType('')}}><X size={14}/></button></div>}
      {files.length>0&&<div className="chat-file-chips">{files.map((f,i)=><span key={f.name+i}><Paperclip size={12}/>{f.name}<button onClick={()=>setFiles(v=>v.filter((_,x)=>x!==i))}><X size={12}/></button></span>)}</div>}
      {showContext&&!editing&&<div className="chat-context-picker"><select value={contextType} onChange={e=>void loadContextOptions(e.target.value)}><option value="">Choose context type…</option>{contextTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{contextType&&<select value={context?.id||''} onChange={e=>setContext(contextOptions.find(x=>x.id===e.target.value)||null)}><option value="">Choose item…</option>{contextOptions.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>}<button onClick={()=>setShowContext(false)}><X size={14}/></button></div>}
      <div className="chat-compose"><input ref={fileRef} hidden type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.doc,.docx,.xls,.xlsx" onChange={e=>{chooseFiles(e.target.files);e.target.value=''}}/><button title="Attach file" disabled={!!editing} onClick={()=>fileRef.current?.click()}><Paperclip size={19}/></button><button title="Link Vorlen record" disabled={!!editing} onClick={()=>setShowContext(v=>!v)}><Link2 size={18}/></button><textarea rows={1} maxLength={8000} value={body} onChange={e=>typeBody(e.target.value)} onInput={e=>{const el=e.currentTarget;el.style.height='40px';el.style.height=Math.min(el.scrollHeight,96)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void sendMessage()}}} placeholder={editing?'Edit message…':'Type a message…'}/><button className="chat-send" disabled={sending||(!body.trim()&&!files.length)} onClick={()=>void sendMessage()}><Send size={18}/></button></div>
      <small className="chat-compose-note">Enter to send · Shift+Enter for a new line · files up to 10 MB</small>
     </div>
    </>}
   </section>
  </div>
 </div>
}
