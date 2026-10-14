import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUp,SmilePlus,X} from 'lucide-react';
import {Link} from 'react-router-dom';
import {supabase} from '../lib/supabase';

type Latest={id:string;sender_id:string;body:string;created_at:string};
type Reaction={id:string;message_id:string;user_id:string;emoji:string};
const reactionEmojis=['👍','❤️','😂','😮','😢','🙏'];
export function PartnerChatQuickReply({unreadCount}:{unreadCount:number}){
 const lastUnread=useRef<number|null>(null);
 const suppressedUntilNewMessage=useRef(false);
 const messageScroll=useRef<HTMLDivElement|null>(null);
 const[history,setHistory]=useState<Latest[]>([]);
 const[reactions,setReactions]=useState<Reaction[]>([]),[reactingTo,setReactingTo]=useState(''),[reactionBusy,setReactionBusy]=useState('');
 const[open,setOpen]=useState(false),[companyId,setCompanyId]=useState(''),[conversation,setConversation]=useState(''),[latest,setLatest]=useState<Latest|null>(null),[me,setMe]=useState(''),[reply,setReply]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  const{data:{user}}=await supabase.auth.getUser();if(!user)return;
  setMe(user.id);
  const{data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).maybeSingle();if(profile?.company_id)setCompanyId(profile.company_id);
  const{data:c,error:ce}=await supabase.from('partner_conversations').select('id').eq('partner_id',user.id).limit(1).maybeSingle();
  if(ce){setError('Unable to load partner chat.');return}
  if(!c){setConversation('');setLatest(null);setHistory([]);return}
  setConversation(c.id);
  const{data:m,error:e}=await supabase.from('partner_messages').select('id,sender_id,body,created_at').eq('conversation_id',c.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(200);
  if(e){setError('Unable to load conversation.');return}
  const ordered=[...(m||[])].reverse() as Latest[];
  setHistory(ordered);
  const ids=ordered.map(item=>item.id);
  if(ids.length){const{data:rx,error:rxError}=await supabase.from('partner_message_reactions').select('id,message_id,user_id,emoji').in('message_id',ids);if(!rxError)setReactions((rx||[]) as Reaction[])}else setReactions([]);
  setLatest(ordered.filter(item=>item.sender_id!==user.id).at(-1)||null);setError('');
 },[]);
 const react=async(message:Latest,emoji:string)=>{
  if(!me||!companyId||!conversation||reactionBusy)return;
  const existing=reactions.find(r=>r.message_id===message.id&&r.user_id===me);
  setReactionBusy(message.id);
  const request=existing?.emoji===emoji?supabase.from('partner_message_reactions').delete().eq('id',existing.id):supabase.from('partner_message_reactions').upsert({company_id:companyId,conversation_id:conversation,message_id:message.id,user_id:me,emoji},{onConflict:'message_id,user_id'});
  const{error:reactionError}=await request;
  if(reactionError)setError('Could not update reaction. Please try again.');else await refresh();
  setReactingTo('');setReactionBusy('');
 };
 useEffect(()=>{if(!open)return;void refresh();const timer=window.setInterval(()=>void refresh(),15000);const channel=supabase.channel('partner-chat-quick-reply').on('postgres_changes',{event:'INSERT',schema:'public',table:'partner_messages'},()=>void refresh()).subscribe();return()=>{window.clearInterval(timer);void supabase.removeChannel(channel)}},[open,refresh]);
 useEffect(()=>{if(open&&messageScroll.current)messageScroll.current.scrollTop=messageScroll.current.scrollHeight},[open,history]);
 useEffect(()=>{
  const previous=lastUnread.current;
  lastUnread.current=unreadCount;
  if(unreadCount===0){suppressedUntilNewMessage.current=false;setOpen(false);return}
  if((previous===null||unreadCount>previous)&&!suppressedUntilNewMessage.current){setOpen(true)}
  if(previous!==null&&unreadCount>previous){suppressedUntilNewMessage.current=false;setOpen(true)}
 },[unreadCount]);
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(sending||!reply.trim()||!conversation||!me||!companyId)return;setSending(true);setError('');
  const{error:e2}=await supabase.from('partner_messages').insert({company_id:companyId,conversation_id:conversation,sender_id:me,body:reply.trim(),message_type:'text',reply_to_id:latest?.id||null});
  if(e2){setError('Reply could not be sent. Please try again or open chat.')}else{
   // A quick reply acknowledges the incoming message shown in this panel.
   // Update its read receipt using the same table as the full partner chat.
   if(latest?.id){
    const now=new Date().toISOString();
    const{error:receiptError}=await supabase.from('partner_message_receipts').upsert({
     message_id:latest.id,conversation_id:conversation,user_id:me,delivered_at:now,read_at:now
    },{onConflict:'message_id,user_id'});
    if(receiptError)console.error('Partner quick reply read receipt failed',receiptError.message);
    else window.dispatchEvent(new Event('partner-chat-read'));
   }
   suppressedUntilNewMessage.current=true;setReply('');setOpen(false);
  }setSending(false);
 };
 return <div className={`partner-chat-quick-shell${open?' is-visible':''}`}>
 {<section className={`partner-chat-quick-panel${open?' is-open':''}`} aria-hidden={!open} role="dialog" aria-label="Quick reply to Vorlen" aria-modal="false" inert={!open}><header><strong>Chat with Vorlen</strong><button type="button" aria-label="Close quick reply" onClick={()=>setOpen(false)}><X size={18}/></button></header><div className="partner-chat-quick-body" ref={messageScroll} role="log" aria-label="Partner chat conversation" aria-live="off">{history.length?<div className="partner-chat-quick-history">{history.map(item=><div key={item.id} className={`partner-chat-quick-message-wrap${item.sender_id===me?' is-mine':''}`}><div className={`partner-chat-quick-message${item.sender_id===me?' is-mine':''}`}><span>{item.sender_id===me?'You':'Vorlen'} · {new Date(item.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span><p>{item.body||'Attachment — open full chat to view'}</p></div><div className="partner-chat-quick-reactions">{[...new Set(reactions.filter(r=>r.message_id===item.id).map(r=>r.emoji))].map(emoji=><button key={emoji} type="button" className={reactions.some(r=>r.message_id===item.id&&r.emoji===emoji&&r.user_id===me)?'is-mine':''} onClick={()=>void react(item,emoji)} disabled={!!reactionBusy} aria-label={`React ${emoji}`}>{emoji}{reactions.filter(r=>r.message_id===item.id&&r.emoji===emoji).length>1?' '+reactions.filter(r=>r.message_id===item.id&&r.emoji===emoji).length:''}</button>)}<button type="button" aria-label="Add emoji reaction" aria-expanded={reactingTo===item.id} onClick={()=>setReactingTo(v=>v===item.id?'':item.id)}><SmilePlus size={15}/></button></div>{reactingTo===item.id&&<div className="partner-chat-quick-picker">{reactionEmojis.map(emoji=><button type="button" key={emoji} disabled={!!reactionBusy} onClick={()=>void react(item,emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>}</div>)}</div>:<p>{conversation?'No messages yet.':'Open the full chat to start your conversation.'}</p>}{error&&<p className="partner-chat-quick-error" role="alert">{error}</p>}</div><form onSubmit={send}><label htmlFor="partner-chat-quick-input">Your reply</label><div className="partner-chat-quick-compose"><input id="partner-chat-quick-input" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a quick reply…" disabled={!conversation||sending} maxLength={5000}/><button aria-label="Send quick reply" type="submit" disabled={!reply.trim()||!conversation||sending}><ArrowUp size={18}/></button></div></form><Link className="partner-chat-quick-full" to="/dashboard/partner/chat" onClick={()=>setOpen(false)}>Open full partner chat →</Link></section>}

 </div>
}
