import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Bell,ChevronLeft,FileText,Image as ImageIcon,Link2,MessageCircle,Paperclip,Pencil,Pin,Reply,Search,Send,SmilePlus,Trash2,X} from 'lucide-react';
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
type Reaction={id:string;company_id:string;conversation_id:string;message_id:string;user_id:string;emoji:string;created_at:string;updated_at:string};
type ContextOption={id:string;label:string;path:string};

const allowedTypes=new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const maxFile=10*1024*1024;
const reactionEmojis=['👍','❤️','😂','😮','😢','🙏'] as const;
const contextTypes=[['client','Client'],['job','Vacancy'],['candidate','Candidate'],['application','Application'],['submission','Submission pack'],['handoff','Commercial handoff'],['placement','Placement'],['commission','Commission'],['task','Work queue']] as const;
const fmt=(v?:string|null)=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'';
const clock=(v:string)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const dayKey=(v:string)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
const safeName=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'file';
const size=(n:number)=>n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(1)} MB`;
const urlPattern=/(https?:\/\/[^\s<]+[^\s<.,:;!?'"\])}])/gi;
function applyInlineMarkup(el:HTMLElement,content:string){
 const tag=el.tagName.toLowerCase(),style=el.style;
 const weight=String(style.fontWeight||'').toLowerCase(),numericWeight=Number.parseInt(weight,10);
 const bold=tag==='strong'||tag==='b'||weight==='bold'||weight==='bolder'||(!Number.isNaN(numericWeight)&&numericWeight>=600);
 const italic=tag==='em'||tag==='i'||String(style.fontStyle||'').toLowerCase()==='italic';
 const decoration=(style.textDecoration||style.textDecorationLine||'').toLowerCase();
 const underline=tag==='u'||decoration.includes('underline');
 let out=content;
 if(underline&&out)out='++'+out+'++';
 if(italic&&out)out='*'+out+'*';
 if(bold&&out)out='**'+out+'**';
 return out;
}
function plainMessagePreview(value?:string|null){
 return String(value||'')
  .replace(/\*\*([^*\n]+)\*\*/g,'$1')
  .replace(/\+\+([^+\n]+)\+\+/g,'$1')
  .replace(/\*([^*\n]+)\*/g,'$1')
  .replace(/^\s*[-•]\s+/gm,'')
  .replace(/^\s*\d+[.)]\s+/gm,'')
  .replace(/\s+/g,' ')
  .trim();
}
function htmlToMessageMarkup(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const walk=(node:Node):string=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||'';
  if(node.nodeType!==Node.ELEMENT_NODE)return'';
  const el=node as HTMLElement,tag=el.tagName.toLowerCase(),children=()=>Array.from(el.childNodes).map(walk).join('');
  if(tag==='br')return'\n';
  if(tag==='a'){const label=children().trim(),href=el.getAttribute('href')||'';return href&&(label!==href)?label+' ('+href+')':label||href}
  if(tag==='ul')return Array.from(el.children).filter(x=>x.tagName.toLowerCase()==='li').map(x=>'- '+walk(x).trim()).join('\n')+'\n';
  if(tag==='ol')return Array.from(el.children).filter(x=>x.tagName.toLowerCase()==='li').map((x,i)=>(i+1)+'. '+walk(x).trim()).join('\n')+'\n';
  if(tag==='li')return children();
  if(/^h[1-6]$/.test(tag))return'**'+children().trim()+'**\n';
  if(tag==='p'||tag==='div'){
   const content=children().trimEnd();
   return applyInlineMarkup(el,content)+'\n';
  }
  return applyInlineMarkup(el,children());
 };
 return walk(doc.body).replace(/\n{3,}/g,'\n\n').trim();
}
function renderInline(text:string,keyBase:string):any[]{
 const out:any[]=[];let pos=0,part=0;
 const pushText=(value:string)=>{if(!value)return;const urls=value.split(urlPattern);urls.filter(Boolean).forEach(piece=>{const key=keyBase+'-'+part++;out.push(/^https?:\/\//i.test(piece)?<a className="chat-inline-link" key={key} href={piece} target="_blank" rel="noopener noreferrer">{piece}</a>:piece)})};
 while(pos<text.length){
  const candidates=[['**','strong'],['++','underline'],['*','em']].map(([mark,type])=>({mark,type,index:text.indexOf(mark,pos)})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index||b.mark.length-a.mark.length);
  const next=candidates[0];
  if(!next){pushText(text.slice(pos));break}
  if(next.index>pos)pushText(text.slice(pos,next.index));
  const contentStart=next.index+next.mark.length,close=text.indexOf(next.mark,contentStart);
  if(close<0){pushText(text.slice(next.index));break}
  const inner=renderInline(text.slice(contentStart,close),keyBase+'-nested-'+part),key=keyBase+'-'+part++;
  out.push(next.type==='strong'?<strong key={key}>{inner}</strong>:next.type==='underline'?<u key={key}>{inner}</u>:<em key={key}>{inner}</em>);
  pos=close+next.mark.length;
 }
 return out;
}
function renderMessageBody(body:string){
 const lines=body.split('\n'),nodes:any[]=[];let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){nodes.push(<div className="chat-rich-gap" key={'gap-'+i}/>);i++;continue}
  if(/^\s*[-•]\s+/.test(line)){const items:any[]=[];while(i<lines.length&&/^\s*[-•]\s+/.test(lines[i])){items.push(<li key={'ul-'+i}>{renderInline(lines[i].replace(/^\s*[-•]\s+/,''),'ul-'+i)}</li>);i++}nodes.push(<ul key={'ulist-'+i}>{items}</ul>);continue}
  if(/^\s*\d+[.)]\s+/.test(line)){const items:any[]=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i])){items.push(<li key={'ol-'+i}>{renderInline(lines[i].replace(/^\s*\d+[.)]\s+/,''),'ol-'+i)}</li>);i++}nodes.push(<ol key={'olist-'+i}>{items}</ol>);continue}
  nodes.push(<p key={'p-'+i}>{renderInline(line,'p-'+i)}</p>);i++;
 }
 return <div className="chat-rich-body">{nodes}</div>;
}

export default function PartnerChat({mode}:{mode:Mode}){
 const access=useWorkspaceAccess(),toast=useToast(),[params,setParams]=useSearchParams();
 const [me,setMe]=useState(''),[conversations,setConversations]=useState<Conversation[]>([]),[conversationId,setConversationId]=useState(''),[partnerId,setPartnerId]=useState('');
 const [messages,setMessages]=useState<Message[]>([]),[attachments,setAttachments]=useState<Attachment[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]),[states,setStates]=useState<UserState[]>([]),[reactions,setReactions]=useState<Reaction[]>([]);
 const [loading,setLoading]=useState(true),[loadingMessages,setLoadingMessages]=useState(false),[hasMore,setHasMore]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState('');
 const [body,setBody]=useState(''),[files,setFiles]=useState<File[]>([]),[replyTo,setReplyTo]=useState<Message|null>(null),[editing,setEditing]=useState<Message|null>(null);
 const [partnerSearch,setPartnerSearch]=useState(''),[messageSearch,setMessageSearch]=useState(''),[searchResults,setSearchResults]=useState<Message[]>([]);
 const [showContext,setShowContext]=useState(false),[contextType,setContextType]=useState(''),[contextOptions,setContextOptions]=useState<ContextOption[]>([]),[context,setContext]=useState<ContextOption|null>(null);
 const [notifySupported,setNotifySupported]=useState(false),[now,setNow]=useState(Date.now()),[typingSignalUntil,setTypingSignalUntil]=useState(0),[typingSignalUserId,setTypingSignalUserId]=useState(''),[mobileSearchOpen,setMobileSearchOpen]=useState(false),[reactingTo,setReactingTo]=useState<string>(''),[reactionPickerAbove,setReactionPickerAbove]=useState(false),[reactionBusy,setReactionBusy]=useState<string>('');
 const fileRef=useRef<HTMLInputElement>(null),messagesRef=useRef<HTMLDivElement>(null),composerRef=useRef<HTMLTextAreaElement>(null),chatChannelRef=useRef<any>(null),typingTimer=useRef<number|null>(null),typingRefreshTimer=useRef<number|null>(null),refreshTimer=useRef<number|null>(null),reactionPressTimer=useRef<number|null>(null),reactionPressStart=useRef<{x:number;y:number}|null>(null);

 const selected=useMemo(()=>conversations.find(c=>c.conversation_id===conversationId)||null,[conversations,conversationId]);
 const partnerUserId=mode==='partner'?me:(selected?.partner_id||partnerId);
 const recipientSpecialism=mode==='manager'?String(selected?.specialism||''):String(access.partnerSpecialism||'');
 const recipientCanClient=mode==='partner'?access.partnerCanDevelopClients:['b2b_advisor','lead_closer','hybrid'].includes(recipientSpecialism);
 const recipientCanClose=mode==='partner'?access.partnerCanCloseClients:['lead_closer','hybrid'].includes(recipientSpecialism);
 const recipientCanSource=mode==='partner'?access.partnerCanSourceCandidates:['candidate_sourcer','hybrid'].includes(recipientSpecialism);
 const recipientCanDelivery=recipientCanClose||recipientCanSource;
 const availableContextTypes=contextTypes.filter(([v])=>v==='task'||v==='placement'||v==='commission'||(v==='client'&&recipientCanClient)||(v==='job'&&recipientCanDelivery)||(v==='candidate'&&recipientCanSource)||(v==='application'&&recipientCanDelivery)||(v==='submission'&&recipientCanSource)||(v==='handoff'&&recipientCanClose));

 const otherStates=states.filter(s=>s.user_id!==me);
 const relevantOtherStates=mode==='manager'&&partnerUserId?otherStates.filter(s=>s.user_id===partnerUserId):otherStates;
 const otherOnline=relevantOtherStates.some(s=>now-new Date(s.last_seen_at).getTime()<75000);
 const otherTyping=typingSignalUntil>now||relevantOtherStates.some(s=>!!s.typing_until&&new Date(s.typing_until).getTime()>now);
 const typingSide: 'in'|'out'=mode==='partner'?(typingSignalUserId===partnerUserId?'out':'in'):(typingSignalUserId===partnerUserId?'in':'out');
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

 const isNearChatBottom=useCallback(()=>{const el=messagesRef.current;if(!el)return true;return el.scrollHeight-el.scrollTop-el.clientHeight<120},[]);
 const focusComposer=useCallback(()=>{window.setTimeout(()=>composerRef.current?.focus({preventScroll:true}),0)},[]);

 const markIncoming=useCallback(async(msgs:Message[],existing:Receipt[])=>{
  if(!me||!conversationId)return;const incoming=msgs.filter(m=>m.sender_id!==me&&!m.deleted_at);if(!incoming.length)return;
  const byId=new Map(existing.filter(r=>r.user_id===me).map(r=>[r.message_id,r]));
  const nowIso=new Date().toISOString(),rows=incoming.map(m=>({message_id:m.id,conversation_id:conversationId,user_id:me,delivered_at:byId.get(m.id)?.delivered_at||nowIso,read_at:document.visibilityState==='visible'?nowIso:(byId.get(m.id)?.read_at||null)}));
  const{error:e}=await supabase.from('partner_message_receipts').upsert(rows,{onConflict:'message_id,user_id'});if(!e&&document.visibilityState==='visible')window.dispatchEvent(new Event('partner-chat-read'));
 },[me,conversationId]);

 const loadConversation=useCallback(async(older=false,forceBottom=false)=>{
  if(!conversationId)return;
  const scroller=messagesRef.current;
  const previousHeight=scroller?.scrollHeight||0;
  const previousTop=scroller?.scrollTop||0;
  const shouldFollow=forceBottom||(!older&&isNearChatBottom());
  setLoadingMessages(true);setError('');
  let q=supabase.from('partner_messages').select('*').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(80);
  if(older&&messages.length)q=q.lt('created_at',messages[0].created_at);
  const{data:m,error:e}=await q;if(e){setError(e.message);setLoadingMessages(false);return}
  const batch=((m||[]) as Message[]).reverse(),combined=older?[...batch,...messages]:batch,setIds=combined.map(x=>x.id);
  setMessages(combined);setHasMore((m||[]).length===80);
  const [a,r,s,rx]=await Promise.all([
    setIds.length?supabase.from('partner_message_attachments').select('*').in('message_id',setIds):Promise.resolve({data:[],error:null} as any),
    setIds.length?supabase.from('partner_message_receipts').select('*').in('message_id',setIds):Promise.resolve({data:[],error:null} as any),
    supabase.from('partner_chat_user_state').select('*').eq('conversation_id',conversationId),
    setIds.length?supabase.from('partner_message_reactions').select('*').in('message_id',setIds):Promise.resolve({data:[],error:null} as any)
  ]);
  if(a.error||r.error||s.error||rx.error)setError(a.error?.message||r.error?.message||s.error?.message||rx.error?.message||'Chat data could not be loaded.');
  const signed=await signAttachments(a.data||[]);setAttachments(signed);setReceipts((r.data||[]) as Receipt[]);setStates((s.data||[]) as UserState[]);setReactions((rx.data||[]) as Reaction[]);
  await markIncoming(combined,(r.data||[]) as Receipt[]);
  setLoadingMessages(false);
  window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
   const el=messagesRef.current;if(!el)return;
   if(older){el.scrollTop=Math.max(0,el.scrollHeight-previousHeight+previousTop)}
   else if(shouldFollow){el.scrollTop=el.scrollHeight}
  }));
 },[conversationId,messages,markIncoming,signAttachments,isNearChatBottom]);

 useEffect(()=>{if(conversationId)void loadConversation(false,true)},[conversationId]);

 const touchState=useCallback(async(typing=false)=>{
  if(!conversationId||!me)return;const t=new Date(),typingUntil=typing?new Date(t.getTime()+4500).toISOString():null;
  await supabase.from('partner_chat_user_state').upsert({conversation_id:conversationId,user_id:me,last_seen_at:t.toISOString(),typing_until:typingUntil,updated_at:t.toISOString()},{onConflict:'conversation_id,user_id'});
 },[conversationId,me]);

 useEffect(()=>{if(!conversationId||!me)return;const activeConversation=conversationId;void touchState(false);const timer=window.setInterval(()=>{if(!typingRefreshTimer.current)void touchState(false)},30000);const vis=()=>{if(document.visibilityState==='visible'){if(!typingRefreshTimer.current)void touchState(false);void loadConversation(false)}};document.addEventListener('visibilitychange',vis);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',vis);if(typingTimer.current){window.clearTimeout(typingTimer.current);typingTimer.current=null}if(typingRefreshTimer.current){window.clearInterval(typingRefreshTimer.current);typingRefreshTimer.current=null}void supabase.from('partner_chat_user_state').update({typing_until:null,updated_at:new Date().toISOString()}).eq('conversation_id',activeConversation).eq('user_id',me)}},[conversationId,me,touchState]);

 useEffect(()=>{if(mode!=='manager'||!me)return;const ch=supabase.channel('partner-chat-manager-list-'+me).on('postgres_changes',{event:'INSERT',schema:'public',table:'partner_messages'},()=>void refreshList()).subscribe();return()=>{void supabase.removeChannel(ch)}},[mode,me,refreshList]);

 useEffect(()=>{if(!conversationId||!me)return;
  const scrollIfFollowing=()=>{if(!isNearChatBottom())return;window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{const el=messagesRef.current;if(el)el.scrollTop=el.scrollHeight}))};
  const reconcile=()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current);refreshTimer.current=window.setTimeout(()=>void loadConversation(false),120)};
  const onMessage=(change:any)=>{
   const row=(change.new||change.old) as Message|undefined;
   if(!row?.id)return reconcile();
   if(change.eventType==='DELETE'){setMessages(rows=>rows.filter(x=>x.id!==row.id));return}
   if(change.eventType==='INSERT'&&row.message_type==='attachment'){reconcile();return}
   setMessages(rows=>{
    const index=rows.findIndex(x=>x.id===row.id);
    if(index>=0){const next=[...rows];next[index]={...next[index],...row};return next}
    if(change.eventType==='INSERT')return [...rows,row].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
    return rows;
   });
   if(change.eventType==='INSERT'){
    scrollIfFollowing();
    if(row.sender_id!==me)void markIncoming([row],[]);
    if(mode==='manager')void refreshList();
   }
  };
  const onReceipt=(change:any)=>{const row=(change.new||change.old) as Receipt|undefined;if(!row?.message_id)return reconcile();setReceipts(rows=>change.eventType==='DELETE'?rows.filter(x=>!(x.message_id===row.message_id&&x.user_id===row.user_id)):[...rows.filter(x=>!(x.message_id===row.message_id&&x.user_id===row.user_id)),row])};
  const onState=(change:any)=>{const row=(change.new||change.old) as UserState|undefined;if(!row?.user_id)return reconcile();const followTyping=row.user_id!==me&&change.eventType!=='DELETE'&&!!row.typing_until&&new Date(row.typing_until).getTime()>Date.now()&&isNearChatBottom();setStates(rows=>change.eventType==='DELETE'?rows.filter(x=>x.user_id!==row.user_id):[...rows.filter(x=>x.user_id!==row.user_id),row]);if(followTyping)window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{const el=messagesRef.current;if(el)el.scrollTop=el.scrollHeight}))};
  const onReaction=(change:any)=>{const row=(change.new||change.old) as Reaction|undefined;if(!row?.id)return reconcile();setReactions(rows=>change.eventType==='DELETE'?rows.filter(x=>x.id!==row.id):[...rows.filter(x=>x.id!==row.id&&!(x.message_id===row.message_id&&x.user_id===row.user_id)),row])};
  const ch=supabase.channel(`partner-chat-db-${conversationId}`,{config:{broadcast:{ack:true}}})
   .on('broadcast',{event:'typing'},({payload}:any)=>{if(!payload)return;const active=payload.active===true;setTypingSignalUserId(active?String(payload.user_id||''):'');setTypingSignalUntil(active?Date.now()+5000:0);if(active&&isNearChatBottom())window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{const el=messagesRef.current;if(el)el.scrollTop=el.scrollHeight}))})
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_messages',filter:`conversation_id=eq.${conversationId}`},onMessage)
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_message_receipts',filter:`conversation_id=eq.${conversationId}`},onReceipt)
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_chat_user_state',filter:`conversation_id=eq.${conversationId}`},onState)
   .on('postgres_changes',{event:'*',schema:'public',table:'partner_message_reactions',filter:`conversation_id=eq.${conversationId}`},onReaction)
   .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Partner chat realtime channel',status)});
  chatChannelRef.current=ch;
  return()=>{if(chatChannelRef.current===ch)chatChannelRef.current=null;setTypingSignalUntil(0);setTypingSignalUserId('');if(refreshTimer.current)window.clearTimeout(refreshTimer.current);void supabase.removeChannel(ch)}
 },[conversationId,me,mode,loadConversation,refreshList,markIncoming,isNearChatBottom]);

 useEffect(()=>{setReactingTo('');cancelReactionPress();return()=>cancelReactionPress()},[conversationId]);
 useEffect(()=>{if(!reactingTo)return;const close=(e:PointerEvent)=>{const target=e.target as HTMLElement;if(target.closest('.chat-reaction-picker,.chat-actions,.chat-reactions'))return;setReactingTo('')};document.addEventListener('pointerdown',close,true);return()=>document.removeEventListener('pointerdown',close,true)},[reactingTo]);

 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),2000);setNotifySupported(typeof window!=='undefined'&&'Notification'in window);return()=>window.clearInterval(t)},[]);

 async function searchMessages(v:string){setMessageSearch(v);if(v.trim().length<2){setSearchResults([]);return}const{data,error:e}=await supabase.from('partner_messages').select('*').eq('conversation_id',conversationId).ilike('body',`%${v.trim().replace(/[%_]/g,'')}%`).order('created_at',{ascending:false}).limit(100);if(e)setError(e.message);else setSearchResults(((data||[]) as Message[]).reverse())}

 async function loadContextOptions(type:string){
  setContextType(type);setContext(null);setContextOptions([]);
  if(!type)return;
  if(!availableContextTypes.some(([v])=>v===type)){setError('This linked record type is not available to the selected partner role.');return}
  if(type==='task'){setContextOptions([{id:'work-queue',label:'Work queue',path:mode==='partner'?'/dashboard/partner/tasks':'/dashboard/partner-management'}]);return}
  const configs:any={
   client:{table:'clients',select:'id,company_name',label:(x:any)=>x.company_name,path:(x:any)=>mode==='partner'?'/dashboard/partner/clients?client='+x.id:'/dashboard/clients/'+x.id},
   job:{table:'jobs',select:'id,title,client_id',label:(x:any)=>x.title,path:(x:any)=>mode==='partner'?'/dashboard/partner/vacancies?job='+x.id:'/dashboard/jobs?job='+x.id},
   candidate:{table:'candidates',select:'id,full_name',label:(x:any)=>x.full_name,path:(x:any)=>mode==='partner'?'/dashboard/partner/candidates/'+x.id:'/dashboard/candidates/'+x.id},
   application:{table:'applications',select:'id,status,job_id,candidate_id',label:(x:any)=>'Application · '+String(x.id).slice(0,8)+' · '+x.status,path:(x:any)=>mode==='partner'?'/dashboard/partner/applications?application='+x.id:'/dashboard/applications?application='+x.id},
   submission:{table:'partner_submission_packs',select:'id,status,partner_id',label:(x:any)=>'Submission pack · '+String(x.id).slice(0,8)+' · '+x.status,path:(x:any)=>mode==='partner'?'/dashboard/partner/talent?submission='+x.id:'/dashboard/partner-management'},
   handoff:{table:'partner_commercial_handoffs',select:'id,status,partner_id',label:(x:any)=>'Commercial handoff · '+String(x.id).slice(0,8)+' · '+x.status,path:(x:any)=>mode==='partner'?'/dashboard/partner/handoffs?handoff='+x.id:'/dashboard/partner-management'},
   placement:{table:'placements',select:'id,start_date',label:(x:any)=>'Placement · '+String(x.id).slice(0,8)+(x.start_date?' · '+x.start_date:''),path:(x:any)=>mode==='partner'?'/dashboard/partner/earnings?placement='+x.id:'/dashboard/commercial?placement='+x.id},
   commission:{table:'partner_commissions',select:'id,amount,status,partner_user_id',label:(x:any)=>'Commission · £'+Number(x.amount||0).toFixed(2)+' · '+x.status,path:(x:any)=>mode==='partner'?'/dashboard/partner/earnings?commission='+x.id:'/dashboard/commercial?commission='+x.id}
  };
  const c=configs[type];if(!c)return;
  const{data,error:e}=await supabase.from(c.table).select(c.select).limit(150);
  if(e){setError('Context items could not be loaded: '+e.message);return}
  let rows=(data||[]) as any[];
  if(mode==='manager'&&partnerUserId){
   if(type==='submission'||type==='handoff')rows=rows.filter(x=>x.partner_id===partnerUserId);
   else if(type==='commission')rows=rows.filter(x=>x.partner_user_id===partnerUserId);
   else if(['client','job','candidate','application','placement'].includes(type)){
    const[{data:assignments,error:assignmentError},{data:pipeline,error:pipelineError},{data:attrs,error:attrError}]=await Promise.all([
     supabase.from('partner_assignments').select('client_id,job_id,candidate_id').eq('partner_id',partnerUserId).is('completed_at',null),
     supabase.from('partner_candidate_pipeline').select('job_id,candidate_id').eq('partner_id',partnerUserId),
     supabase.from('partner_attributions').select('placement_id').eq('partner_id',partnerUserId).eq('status','active')
    ]);
    if(assignmentError||pipelineError||attrError){setError('Partner-scoped context could not be verified. No record was linked.');return}
    const clientIds=new Set((assignments||[]).map((x:any)=>x.client_id).filter(Boolean));
    const jobIds=new Set([...(assignments||[]).map((x:any)=>x.job_id),...(pipeline||[]).map((x:any)=>x.job_id)].filter(Boolean));
    const candidateIds=new Set([...(assignments||[]).map((x:any)=>x.candidate_id),...(pipeline||[]).map((x:any)=>x.candidate_id)].filter(Boolean));
    const placementIds=new Set((attrs||[]).map((x:any)=>x.placement_id).filter(Boolean));
    if(type==='client')rows=rows.filter(x=>clientIds.has(x.id));
    if(type==='job')rows=rows.filter(x=>jobIds.has(x.id)||clientIds.has(x.client_id));
    if(type==='candidate')rows=rows.filter(x=>candidateIds.has(x.id));
    if(type==='application')rows=rows.filter(x=>jobIds.has(x.job_id)||candidateIds.has(x.candidate_id));
    if(type==='placement')rows=rows.filter(x=>placementIds.has(x.id));
   }
  }
  setContextOptions(rows.map((x:any)=>({id:x.id,label:c.label(x),path:c.path(x)})));
 }

 function contextHref(m:Message){
  if(!m.context_type)return m.context_path||'#';
  const id=encodeURIComponent(String(m.context_id||''));
  if(mode==='partner'){
   const paths:Record<string,string>={
    client:'/dashboard/partner/clients?client='+id,
    job:'/dashboard/partner/vacancies?job='+id,
    candidate:access.partnerCanSourceCandidates?'/dashboard/partner/candidates/'+id:'/dashboard/partner/applications?candidate='+id,
    application:'/dashboard/partner/applications?application='+id,
    submission:access.partnerCanSourceCandidates?'/dashboard/partner/talent?submission='+id:'/dashboard/partner/applications',
    handoff:'/dashboard/partner/handoffs?handoff='+id,
    placement:'/dashboard/partner/earnings?placement='+id,
    commission:'/dashboard/partner/earnings?commission='+id,
    task:'/dashboard/partner/tasks'
   };
   return paths[m.context_type]||m.context_path||'/dashboard/partner';
  }
  const paths:Record<string,string>={
   client:'/dashboard/clients/'+id,
   job:'/dashboard/jobs?job='+id,
   candidate:'/dashboard/candidates/'+id,
   application:'/dashboard/applications?application='+id,
   submission:'/dashboard/partner-management',
   handoff:'/dashboard/partner-management',
   placement:'/dashboard/commercial?placement='+id,
   commission:'/dashboard/commercial?commission='+id,
   task:'/dashboard/partner-management'
  };
  return paths[m.context_type]||m.context_path||'/dashboard';
 }
 function chooseFiles(list:FileList|null){if(!list)return;const accepted:File[]=[];for(const f of Array.from(list)){if(f.size>maxFile){toast(`${f.name} is larger than 10 MB.`,{tone:'error'});continue}if(!allowedTypes.has(f.type)){toast(`${f.name} is not a supported image, PDF or Office document.`,{tone:'error'});continue}accepted.push(f)}setFiles(v=>[...v,...accepted].slice(0,5))}

 function broadcastTyping(active:boolean){const channel=chatChannelRef.current;if(!channel)return;void channel.send({type:'broadcast',event:'typing',payload:{user_id:me,active}}).then((status:any)=>{if(status!=='ok')console.warn('Partner chat typing broadcast failed',status)})}
 function stopTyping(){if(typingTimer.current){window.clearTimeout(typingTimer.current);typingTimer.current=null}if(typingRefreshTimer.current){window.clearInterval(typingRefreshTimer.current);typingRefreshTimer.current=null}broadcastTyping(false);void touchState(false)}
 function typeBody(v:string){setBody(v);if(editing)return;if(typingTimer.current)window.clearTimeout(typingTimer.current);broadcastTyping(true);if(!typingRefreshTimer.current){void touchState(true);typingRefreshTimer.current=window.setInterval(()=>{broadcastTyping(true);void touchState(true)},2500)}typingTimer.current=window.setTimeout(stopTyping,3200)}
 function handleComposerPaste(e:any){
  const html=e.clipboardData?.getData('text/html')||'';
  if(!html)return;
  const formatted=htmlToMessageMarkup(html);
  if(!formatted)return;
  e.preventDefault();
  const el=e.currentTarget as HTMLTextAreaElement,start=el.selectionStart??body.length,end=el.selectionEnd??start;
  const next=(body.slice(0,start)+formatted+body.slice(end)).slice(0,8000);
  typeBody(next);
  window.requestAnimationFrame(()=>{if(composerRef.current){const pos=Math.min(start+formatted.length,next.length);composerRef.current.setSelectionRange(pos,pos);composerRef.current.focus({preventScroll:true})}});
 }

 async function sendMessage(){
  if(!conversationId||!me||sending)return;
  const{data:{user:currentUser}}=await supabase.auth.getUser();
  if(!currentUser||currentUser.id!==me){setError('Your signed-in session changed. Refresh this page and sign in again before sending.');return}
  if(mode==='partner'&&currentUser.id!==partnerUserId){setError('This chat is no longer using the partner account. Sign in as the partner before sending.');return}
  if(mode==='manager'&&currentUser.id===partnerUserId){setError('This chat is no longer using a management account. Sign in as management before sending.');return}stopTyping();if(editing){const next=body.trim();if(!next)return;setSending(true);const{error:e}=await supabase.from('partner_messages').update({body:next}).eq('id',editing.id);setSending(false);if(e)return setError(e.message);setEditing(null);setBody('');toast('Message updated.');return}
  if(!body.trim()&&!files.length)return;setSending(true);setError('');
  const payload:any={conversation_id:conversationId,company_id:access.companyId,sender_id:me,body:body.trim(),message_type:files.length?'attachment':'text',reply_to_id:replyTo?.id||null};
  if(context){payload.context_type=contextType;payload.context_id=contextType==='task'?null:context.id;payload.context_label=context.label;payload.context_path=context.path}
  const{data:m,error:e}=await supabase.from('partner_messages').insert(payload).select('*').single();if(e||!m){setSending(false);setError(e?.message||'Message could not be sent.');return}
  if(!files.length){setMessages(rows=>rows.some(x=>x.id===m.id)?rows:[...rows,m as Message]);window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{const el=messagesRef.current;if(el)el.scrollTop=el.scrollHeight}))}
  const uploaded:string[]=[],attachmentRows:string[]=[];try{for(const f of files){const path=`${access.companyId}/${conversationId}/${m.id}/${crypto.randomUUID()}-${safeName(f.name)}`;const up=await supabase.storage.from('partner-chat').upload(path,f,{contentType:f.type,upsert:false});if(up.error)throw up.error;uploaded.push(path);const row=await supabase.from('partner_message_attachments').insert({company_id:access.companyId,conversation_id:conversationId,message_id:m.id,uploaded_by:me,storage_path:path,filename:f.name,mime_type:f.type,size_bytes:f.size}).select('id').single();if(row.error)throw row.error;if(row.data?.id)attachmentRows.push(row.data.id)}}
  catch(err){if(uploaded.length)await supabase.storage.from('partner-chat').remove(uploaded);if(attachmentRows.length)await supabase.from('partner_message_attachments').delete().in('id',attachmentRows);await supabase.from('partner_messages').update({deleted_at:new Date().toISOString()}).eq('id',m.id);setSending(false);setError(err instanceof Error?err.message:'Attachment upload failed.');return}
  setBody('');setFiles([]);setReplyTo(null);setContext(null);setContextType('');setShowContext(false);void touchState(false);setSending(false);if(files.length)await loadConversation(false,true);if(mode==='manager')void refreshList();
 }

 async function removeMessage(m:Message){if(!confirm('Delete this message? The audit record will be retained.'))return;const{error:e}=await supabase.from('partner_messages').update({deleted_at:new Date().toISOString()}).eq('id',m.id);if(e)setError(e.message);else toast('Message deleted.')}
 async function togglePin(m:Message){const{error:e}=await supabase.from('partner_messages').update({pinned_at:m.pinned_at?null:new Date().toISOString(),pinned_by:null}).eq('id',m.id);if(e)setError(e.message);else toast(m.pinned_at?'Message unpinned.':'Message pinned.')}
 async function enableNotifications(){if(!notifySupported)return;const p=await Notification.requestPermission();toast(p==='granted'?'Chat notifications enabled.':'Notifications were not enabled.',{tone:p==='granted'?'success':'warning'})}

 async function setReaction(m:Message,emoji:string){
  if(!me||!conversationId||m.deleted_at||reactionBusy===m.id)return;
  const existing=reactions.find(r=>r.message_id===m.id&&r.user_id===me);
  setReactionBusy(m.id);setReactingTo('');
  if(existing?.emoji===emoji){
   setReactions(rows=>rows.filter(r=>r.id!==existing.id));
   const{error:e}=await supabase.from('partner_message_reactions').delete().eq('id',existing.id);
   if(e){setError(e.message);await loadConversation(false)}
   setReactionBusy('');
   return;
  }
  const optimistic:Reaction={id:existing?.id||'optimistic-'+m.id,company_id:m.company_id,conversation_id:m.conversation_id,message_id:m.id,user_id:me,emoji,created_at:existing?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
  setReactions(rows=>[...rows.filter(r=>!(r.message_id===m.id&&r.user_id===me)),optimistic]);
  const payload={company_id:m.company_id,conversation_id:m.conversation_id,message_id:m.id,user_id:me,emoji};
  const{error:e}=await supabase.from('partner_message_reactions').upsert(payload,{onConflict:'message_id,user_id'});
  if(e){setError(e.message);await loadConversation(false)}
  setReactionBusy('');
 }
 function reactionGroups(messageId:string){
  const rows=reactions.filter(r=>r.message_id===messageId),map=new Map<string,{emoji:string;count:number;mine:boolean}>();
  for(const r of rows){const v=map.get(r.emoji)||{emoji:r.emoji,count:0,mine:false};v.count+=1;if(r.user_id===me)v.mine=true;map.set(r.emoji,v)}
  return Array.from(map.values());
 }
 function cancelReactionPress(){if(reactionPressTimer.current){window.clearTimeout(reactionPressTimer.current);reactionPressTimer.current=null}reactionPressStart.current=null}
 function openReactionPicker(messageId:string){
  setReactingTo(messageId);
  window.requestAnimationFrame(()=>{
   const message=document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
   const scroller=messagesRef.current;
   if(!message||!scroller){setReactionPickerAbove(false);return}
   const mr=message.getBoundingClientRect(),sr=scroller.getBoundingClientRect();
   const estimatedPickerHeight=52,gap=8;
   const roomBelow=Math.max(0,sr.bottom-mr.bottom);
   const roomAbove=Math.max(0,mr.top-sr.top);
   setReactionPickerAbove(roomBelow<estimatedPickerHeight+gap&&roomAbove>roomBelow);
  })
 }
 function startReactionPress(e:any,m:Message){
  if(m.deleted_at||e.pointerType==='mouse')return;
  const target=e.target as HTMLElement;
  if(target.closest('a,button,input,textarea,select,[role="button"]'))return;
  cancelReactionPress();
  reactionPressStart.current={x:e.clientX,y:e.clientY};
  reactionPressTimer.current=window.setTimeout(()=>{openReactionPicker(m.id);reactionPressTimer.current=null},500);
 }
 function moveReactionPress(e:any){
  const start=reactionPressStart.current;if(!start)return;
  if(Math.abs(e.clientX-start.x)>10||Math.abs(e.clientY-start.y)>10)cancelReactionPress();
 }
 function startEdit(m:Message){setEditing(m);setReplyTo(null);setFiles([]);setBody(m.body);focusComposer()}
 function startReply(m:Message){setReplyTo(m);setEditing(null);focusComposer()}
 function attachmentFor(id:string){return attachments.filter(a=>a.message_id===id)}
 function statusFor(m:Message){if(m.sender_id!==me)return'';const rs=receipts.filter(r=>r.message_id===m.id&&r.user_id!==me);return rs.some(r=>r.read_at)?'Read':rs.some(r=>r.delivered_at)?'Delivered':'Sent'}
 function canChange(m:Message){return m.sender_id===me&&!m.deleted_at&&Date.now()-new Date(m.created_at).getTime()<=15*60000}
 function messageSide(m:Message){if(mode==='partner')return m.sender_id===me?'out':'in';return m.sender_id===partnerUserId?'in':'out'}
 function scrollTo(id:string){const container=messagesRef.current,el=document.querySelector<HTMLElement>(`[data-message-id="${id}"]`);if(container&&el){const cr=container.getBoundingClientRect(),er=el.getBoundingClientRect();container.scrollTo({top:container.scrollTop+(er.top-cr.top)-(container.clientHeight-el.clientHeight)/2,behavior:'smooth'})}setMessageSearch('');setSearchResults([])}
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
      <span className="chat-avatar"><span>{c.partner_name?.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'P'}</span></span><span className="chat-partner-copy"><strong>{c.partner_name}</strong><small>{String(c.specialism||'partner').replaceAll('_',' ')}</small><em>{plainMessagePreview(c.last_message)||'Start a conversation'}</em></span><span className="chat-list-meta"><time>{c.last_message_at?clock(c.last_message_at):''}</time>{Number(c.unread_count||0)>0&&<b>{Number(c.unread_count)>99?'99+':c.unread_count}</b>}</span>
     </button>)}</div>
   </aside>}
   <section className={`chat-conversation ${!conversationId?'empty-chat':''}`}>
    {!conversationId?<div className="chat-empty"><MessageCircle size={32}/><h3>Select a partner</h3><p>Choose a conversation to start messaging.</p></div>:<>
     <><header className="chat-header">{mode==='manager'&&<button className="chat-back" aria-label="Back to partner conversations" onClick={()=>setConversationId('')}><ChevronLeft size={20}/></button>}<span className="chat-avatar"><span>{headerName.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span></span><div className="chat-header-copy"><strong>{headerName}</strong><span className={otherOnline?'online':''}>{headerSub}</span></div><div className="chat-header-actions">{notifySupported&&Notification.permission!=='granted'&&<button className="chat-header-notification" aria-label="Enable chat notifications" onClick={enableNotifications}><Bell size={17}/></button>}<div className="search chat-message-search"><Search size={14}/><input value={messageSearch} onChange={e=>void searchMessages(e.target.value)} placeholder="Search messages"/></div><button className="chat-mobile-search-toggle" aria-label={mobileSearchOpen?'Close message search':'Search messages'} aria-expanded={mobileSearchOpen} onClick={()=>setMobileSearchOpen(v=>!v)}>{mobileSearchOpen?<X size={18}/>:<Search size={18}/>}</button></div></header>{mobileSearchOpen&&<div className="chat-mobile-search"><Search size={15}/><input autoFocus value={messageSearch} onChange={e=>void searchMessages(e.target.value)} placeholder="Search messages"/></div>}</>
     {pinned.length>0&&<div className="chat-pinned"><Pin size={14}/><div>{pinned.map(m=><button key={m.id} onClick={()=>scrollTo(m.id)}>{m.context_label||plainMessagePreview(m.body)||'Pinned attachment'}</button>)}</div></div>}
     <div ref={messagesRef} className="chat-messages">
      {hasMore&&!messageSearch&&<button className="chat-load-more" disabled={loadingMessages} onClick={()=>void loadConversation(true)}>{loadingMessages?'Loading…':'Load older messages'}</button>}
      {visibleMessages.map((m,i)=>{const previous=visibleMessages[i-1],showDay=!previous||dayKey(previous.created_at)!==dayKey(m.created_at),side=messageSide(m),reply=messages.find(x=>x.id===m.reply_to_id),atts=attachmentFor(m.id);return <div key={m.id}>{showDay&&<div className="chat-day"><span>{dayKey(m.created_at)}</span></div>}<article data-message-id={m.id} className={`chat-message ${side} ${m.pinned_at?'pinned':''} ${m.deleted_at?'deleted':''}`}>
        <div className="chat-message-stack"><div className="chat-bubble" onPointerDown={e=>startReactionPress(e,m)} onPointerUp={cancelReactionPress} onPointerCancel={cancelReactionPress} onPointerMove={moveReactionPress} onContextMenu={e=>{if(!m.deleted_at)e.preventDefault()}}>{m.pinned_at&&<span className="chat-pin"><Pin size={11}/> Pinned</span>}{reactingTo===m.id&&!m.deleted_at&&<div className={`chat-reaction-picker ${reactionPickerAbove?'above':'below'}`} role="menu" aria-label="React to message">{reactionEmojis.map(emoji=><button key={emoji} type="button" role="menuitem" aria-label={'React '+emoji} onPointerDown={e=>e.stopPropagation()} disabled={reactionBusy===m.id} onClick={()=>void setReaction(m,emoji)}>{emoji}</button>)}<button className="chat-reaction-close" type="button" aria-label="Close reactions" onPointerDown={e=>e.stopPropagation()} onClick={()=>setReactingTo('')}><X size={14}/></button></div>}{reply&&<button className="chat-reply-preview" onClick={()=>scrollTo(reply.id)}><strong>{reply.sender_id===me?'You':mode==='partner'?'Vorlen management':selected?.partner_name||'Partner'}</strong><span>{reply.deleted_at?'Deleted message':plainMessagePreview(reply.body)||'Attachment'}</span></button>}
         {m.deleted_at?<p className="chat-deleted">This message was deleted</p>:<>{m.body&&renderMessageBody(m.body)}{m.context_label&&m.context_path&&<Link className="chat-context" to={contextHref(m)}><Link2 size={14}/><span><small>{String(m.context_type||'context').replaceAll('_',' ')}</small><strong>{m.context_label}</strong></span></Link>}{atts.map(a=><a key={a.id} className={`chat-attachment ${a.mime_type.startsWith('image/')?'image':''}`} href={a.signed_url||'#'} target="_blank" rel="noreferrer">{a.mime_type.startsWith('image/')&&a.signed_url?<img src={a.signed_url} alt={a.filename}/>:a.mime_type.startsWith('image/')?<ImageIcon size={18}/>:<FileText size={18}/>}<span><strong>{a.filename}</strong><small>{size(a.size_bytes)}</small></span></a>)}</>}
         <footer><time>{clock(m.created_at)}</time>{m.edited_at&&!m.deleted_at&&<span>edited</span>}{m.sender_id===me&&<span className="chat-status">{statusFor(m)}</span>}</footer>
        </div>{!m.deleted_at&&reactionGroups(m.id).length>0&&<div className="chat-reactions">{reactionGroups(m.id).map(r=><button type="button" key={r.emoji} className={r.mine?'mine':''} aria-label={`${r.emoji} reaction${r.count>1?'s':''}, ${r.count}`} onPointerDown={e=>e.stopPropagation()} disabled={reactionBusy===m.id} onClick={()=>void setReaction(m,r.emoji)}><span>{r.emoji}</span>{r.count>1&&<b>{r.count}</b>}</button>)}</div>}</div>
       {!m.deleted_at&&<div className="chat-actions"><button title="React" aria-label="React to message" onClick={()=>setReactingTo(v=>v===m.id?'':m.id)}><SmilePlus size={13}/></button><button title="Reply" onClick={()=>startReply(m)}><Reply size={13}/></button>{canChange(m)&&<button title="Edit" onClick={()=>startEdit(m)}><Pencil size={13}/></button>}{canChange(m)&&<button title="Delete" onClick={()=>void removeMessage(m)}><Trash2 size={13}/></button>}{mode==='manager'&&<button title={m.pinned_at?'Unpin':'Pin'} onClick={()=>void togglePin(m)}><Pin size={13}/></button>}</div>}
      </article></div>})}
      {!visibleMessages.length&&!loadingMessages&&<div className="chat-empty small"><MessageCircle size={24}/><h3>{messageSearch?'No matching messages':'No messages yet'}</h3><p>{messageSearch?'Try another search.':'Send the first message in this private channel.'}</p></div>}
      {otherTyping&&!messageSearch&&<article className={`chat-message ${typingSide} chat-typing-message`} role="status" aria-live="polite" aria-label={headerName+' is typing'}><div className="chat-message-stack"><div className="chat-bubble chat-typing-bubble" aria-hidden="true"><span/><span/><span/></div></div></article>}
      <div className="chat-scroll-end" aria-hidden="true"/>
     </div>
     <div className="chat-compose-wrap">{(replyTo||editing)&&<div className="chat-compose-state"><div><strong>{editing?'Editing message':'Replying to '+(replyTo?.sender_id===me?'yourself':mode==='partner'?'Vorlen management':selected?.partner_name||'partner')}</strong><span>{editing?plainMessagePreview(editing.body):plainMessagePreview(replyTo?.body)||'Attachment'}</span></div><button onClick={()=>{setReplyTo(null);if(editing){setEditing(null);setBody('')}}}><X size={16}/></button></div>}
      {context&&<div className="chat-compose-context"><Link2 size={14}/><span><small>{contextType.replaceAll('_',' ')}</small><strong>{context.label}</strong></span><button onClick={()=>{setContext(null);setContextType('')}}><X size={14}/></button></div>}
      {files.length>0&&<div className="chat-file-chips">{files.map((f,i)=><span key={f.name+i}><Paperclip size={12}/>{f.name}<button onClick={()=>setFiles(v=>v.filter((_,x)=>x!==i))}><X size={12}/></button></span>)}</div>}
      {showContext&&!editing&&<div className="chat-context-picker"><select value={contextType} onChange={e=>void loadContextOptions(e.target.value)}><option value="">Choose context type…</option>{availableContextTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{contextType&&<select value={context?.id||''} onChange={e=>setContext(contextOptions.find(x=>x.id===e.target.value)||null)}><option value="">Choose item…</option>{contextOptions.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>}<button onClick={()=>setShowContext(false)}><X size={14}/></button></div>}
      <div className="chat-compose"><input ref={fileRef} hidden type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.doc,.docx,.xls,.xlsx" onChange={e=>{chooseFiles(e.target.files);e.target.value=''}}/><button title="Attach file" disabled={!!editing} onClick={()=>fileRef.current?.click()}><Paperclip size={19}/></button><button title="Link Vorlen record" disabled={!!editing} onClick={()=>setShowContext(v=>!v)}><Link2 size={18}/></button><textarea ref={composerRef} rows={1} maxLength={8000} value={body} onChange={e=>typeBody(e.target.value)} onPaste={handleComposerPaste} onBlur={()=>{if(!editing)stopTyping()}} onInput={e=>{const el=e.currentTarget;el.style.height='40px';el.style.height=Math.min(el.scrollHeight,96)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void sendMessage()}}} placeholder={editing?'Edit message…':'Type a message…'}/><button className="chat-send" disabled={sending||(!body.trim()&&!files.length)} onClick={()=>void sendMessage()}><Send size={18}/></button></div>
      <small className="chat-compose-note">Enter to send · Shift+Enter for a new line · files up to 10 MB</small>
     </div>
    </>}
   </section>
  </div>
 </div>
}
