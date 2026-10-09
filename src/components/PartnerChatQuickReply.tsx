import {useCallback,useEffect,useState} from 'react';
import {ArrowUp,MessageCircle,X} from 'lucide-react';
import {Link} from 'react-router-dom';
import {supabase} from '../lib/supabase';

type Latest={id:string;sender_id:string;body:string;created_at:string};
export function PartnerChatQuickReply({unreadCount}:{unreadCount:number}){
 const[open,setOpen]=useState(false),[companyId,setCompanyId]=useState(''),[conversation,setConversation]=useState(''),[latest,setLatest]=useState<Latest|null>(null),[me,setMe]=useState(''),[reply,setReply]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  const{data:{user}}=await supabase.auth.getUser();if(!user)return;
  setMe(user.id);
  const{data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).maybeSingle();if(profile?.company_id)setCompanyId(profile.company_id);
  const{data:c,error:ce}=await supabase.from('partner_conversations').select('id').eq('partner_id',user.id).limit(1).maybeSingle();
  if(ce){setError('Unable to load partner chat.');return}
  if(!c){setConversation('');setLatest(null);return}
  setConversation(c.id);
  const{data:m,error:e}=await supabase.from('partner_messages').select('id,sender_id,body,created_at').eq('conversation_id',c.id).neq('sender_id',user.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(e){setError('Unable to load latest message.');return}
  setLatest(m as Latest|null);setError('');
 },[]);
 useEffect(()=>{if(!open)return;void refresh();const timer=window.setInterval(()=>void refresh(),15000);const channel=supabase.channel('partner-chat-quick-reply').on('postgres_changes',{event:'INSERT',schema:'public',table:'partner_messages'},()=>void refresh()).subscribe();return()=>{window.clearInterval(timer);void supabase.removeChannel(channel)}},[open,refresh]);
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(sending||!reply.trim()||!conversation||!me||!companyId)return;setSending(true);setError('');
  const{error:e2}=await supabase.from('partner_messages').insert({company_id:companyId,conversation_id:conversation,sender_id:me,body:reply.trim(),message_type:'text',reply_to_id:latest?.id||null});
  if(e2){setError('Reply could not be sent. Please try again or open chat.')}else{setReply('');await refresh()}setSending(false);
 };
 return <div className="partner-chat-quick-shell">
 {open&&<section className="partner-chat-quick-panel" role="dialog" aria-label="Quick reply to Vorlen" aria-modal="false"><header><strong>Chat with Vorlen</strong><button type="button" aria-label="Close quick reply" onClick={()=>setOpen(false)}><X size={18}/></button></header><div className="partner-chat-quick-body"><span className="partner-chat-quick-kicker">Latest message received</span>{latest?<p>{latest.body||'Attachment received — open chat to view.'}</p>:<p>{conversation?'No messages received yet.':'Open the full chat to start your conversation.'}</p>}{error&&<p className="partner-chat-quick-error" role="alert">{error}</p>}</div><form onSubmit={send}><label htmlFor="partner-chat-quick-input">Your reply</label><div className="partner-chat-quick-compose"><input id="partner-chat-quick-input" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a quick reply…" disabled={!conversation||sending} maxLength={5000}/><button aria-label="Send quick reply" type="submit" disabled={!reply.trim()||!conversation||sending}><ArrowUp size={18}/></button></div></form><Link className="partner-chat-quick-full" to="/dashboard/partner/chat" onClick={()=>setOpen(false)}>Open full partner chat →</Link></section>}
 <button type="button" className="partner-chat-float" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={open?'Close partner chat quick reply':unreadCount>0?`Open partner chat, ${unreadCount} unread messages`:'Open partner chat quick reply'}><span className="partner-chat-float-icon"><MessageCircle size={27} strokeWidth={2.3}/>{unreadCount>0&&<span className="partner-chat-float-count">{unreadCount>99?'99+':unreadCount}</span>}</span><span className="partner-chat-float-label"><strong>Chat with Vorlen</strong><small>{unreadCount>0?`${unreadCount} unread ${unreadCount===1?'message':'messages'}`:'Partner support & messages'}</small></span><span className="partner-chat-float-arrow" aria-hidden="true">↗</span></button>
 </div>
}
