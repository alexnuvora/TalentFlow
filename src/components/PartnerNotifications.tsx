import {useEffect,useState} from 'react';
import {Bell,X} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {useWorkspaceAccess} from '../lib/access';
type Notice={id:string;title:string;detail:string|null;created_at:string};
export function PartnerNotifications({page=false}:{page?:boolean}){
 const access=useWorkspaceAccess();
 const [items,setItems]=useState<Notice[]>([]);
 const [read,setRead]=useState<string[]>([]);
 const [open,setOpen]=useState(false);
 const [error,setError]=useState('');
 const allowed=access.role==='partner'&&!access.loading;
 useEffect(()=>{
  if(!allowed)return;
  let alive=true;
  async function reload(){
   const [a,b]=await Promise.all([
    supabase.from('partner_notifications').select('id,title,detail,created_at').order('created_at',{ascending:false}).limit(150),
    supabase.from('partner_notification_reads').select('notification_id')
   ]);
   if(!alive)return;
   if(a.error){setError(a.error.message);return;}
   setItems((a.data||[]) as Notice[]);
   if(!b.error)setRead((b.data||[]).map(x=>x.notification_id));
   setError('');
  }
  void reload();
  const timer=window.setInterval(()=>void reload(),30000);
  return()=>{alive=false;window.clearInterval(timer)};
 },[allowed]);
 if(!allowed)return null;
 const unread=items.filter(x=>!read.includes(x.id)).length;
 async function markRead(n:Notice){
  if(read.includes(n.id))return;
  setRead(x=>x.includes(n.id)?x:[...x,n.id]);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setRead(x=>x.filter(id=>id!==n.id));return;}
  const {error:e}=await supabase.from('partner_notification_reads').upsert({notification_id:n.id,user_id:user.id},{onConflict:'notification_id,user_id',ignoreDuplicates:true});
  if(e){setRead(x=>x.filter(id=>id!==n.id));setError('Could not mark notification as read: '+e.message)}
 }
 const list=<div className="partner-notification-list">{items.map(n=><button type="button" key={n.id} className={'partner-notification-item'+(read.includes(n.id)?'':' unread')} onClick={()=>void markRead(n)}><span><strong>{n.title}</strong><small>{new Date(n.created_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}</small></span><span>{n.detail}</span><em>{read.includes(n.id)?'Read':'Mark as read'}</em></button>)}</div>;
 if(page)return <div className="page"><h2>My notifications</h2>{error&&<p role="alert">{error}</p>}{items.length===0&&!error&&<p>No management updates yet.</p>}{list}</div>;
 return <div className="partner-notification-root"><button type="button" className="partner-notification-trigger" onClick={()=>setOpen(x=>!x)} aria-label={`My notifications: ${unread} unread`} aria-expanded={open}><Bell size={19}/>{unread>0&&<span className="partner-notification-count">{unread>99?'99+':unread}</span>}</button>{open&&<div className="partner-notification-panel" role="dialog" aria-label="My notifications"><div className="partner-notification-heading"><strong>My notifications</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close"><X size={18}/></button></div>{error&&<p role="alert">{error}</p>}{items.length===0&&!error&&<p className="partner-notification-empty">No management updates yet.</p>}{list}</div>}</div>;
}