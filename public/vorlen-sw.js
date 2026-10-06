/* Vorlen partner chat Web Push service worker */
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let payload={};
  try{payload=event.data?event.data.json():{}}catch{payload={title:'Vorlen',body:event.data?.text?.()||'You have a new message.'}}
  const title=String(payload.title||'Vorlen');
  const target=String(payload?.data?.url||'/dashboard/partner/chat');
  const absolute=new URL(target,self.location.origin);
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const chatAlreadyVisible=windows.some(client=>{
   try{
    const current=new URL(client.url);
    return client.visibilityState==='visible'&&current.origin===absolute.origin&&current.pathname===absolute.pathname;
   }catch{return false}
  });
  for(const client of windows){
   try{client.postMessage({type:'VORLEN_CHAT_PUSH',data:payload.data||{}})}catch{}
  }
  if(chatAlreadyVisible)return;

  await self.registration.showNotification(title,{
   body:String(payload.body||'You have a new secure chat message.'),
   icon:String(payload.icon||'/favicon.svg'),
   tag:String(payload.tag||'vorlen-chat'),
   renotify:payload.renotify!==false,
   data:{...(payload.data||{}),url:target},
   silent:false
  });
 })());
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=String(event.notification?.data?.url||'/dashboard/partner/chat');
  const absolute=new URL(target,self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   try{
    const current=new URL(client.url);
    if(current.origin!==self.location.origin)continue;
    if('navigate'in client&&client.url!==absolute)await client.navigate(absolute);
    if('focus'in client)return await client.focus();
   }catch{}
  }
  return self.clients.openWindow?self.clients.openWindow(absolute):undefined;
 })());
});
