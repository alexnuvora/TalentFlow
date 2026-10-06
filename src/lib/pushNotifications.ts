import {supabase} from './supabase';

const serviceWorkerPath='/vorlen-sw.js';

type PushState={supported:boolean;permission:NotificationPermission|'unsupported';enabled:boolean};

function base64ToUint8Array(value:string){
 const padding='='.repeat((4-value.length%4)%4);
 const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

function bytesToBase64Url(bytes:ArrayBuffer|null){
 if(!bytes)return'';
 const raw=String.fromCharCode(...new Uint8Array(bytes));
 return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function pushNotificationsSupported(){
 return typeof window!=='undefined'&&
  window.isSecureContext&&
  'Notification'in window&&
  'serviceWorker'in navigator&&
  'PushManager'in window;
}

async function registration(){
 if(!pushNotificationsSupported())throw new Error('Push notifications are not supported on this device or browser.');
 const reg=await navigator.serviceWorker.register(serviceWorkerPath,{scope:'/',updateViaCache:'none'});
 await navigator.serviceWorker.ready;
 return reg;
}

async function saveSubscription(subscription:PushSubscription){
 const p256dh=bytesToBase64Url(subscription.getKey('p256dh'));
 const auth=bytesToBase64Url(subscription.getKey('auth'));
 if(!p256dh||!auth)throw new Error('The browser did not provide valid push encryption keys.');
 const{error}=await supabase.rpc('register_partner_chat_push_subscription',{
  p_endpoint:subscription.endpoint,
  p_p256dh:p256dh,
  p_auth_secret:auth,
  p_user_agent:navigator.userAgent
 });
 if(error)throw error;
}

async function publicVapidKey(){
 const{data,error}=await supabase.rpc('partner_chat_push_public_key');
 if(error)throw error;
 const key=String(data||'').trim();
 if(!key)throw new Error('Vorlen push notifications are not configured.');
 return key;
}

export async function getPushNotificationState():Promise<PushState>{
 if(!pushNotificationsSupported())return{supported:false,permission:'unsupported',enabled:false};
 const permission=Notification.permission;
 if(permission!=='granted')return{supported:true,permission,enabled:false};
 try{
  const reg=await registration();
  const sub=await reg.pushManager.getSubscription();
  return{supported:true,permission,enabled:!!sub};
 }catch{
  return{supported:true,permission,enabled:false};
 }
}

export async function enablePushNotifications(){
 if(!pushNotificationsSupported())throw new Error('Push notifications are not supported on this device or browser.');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted'){
  if(permission==='denied')throw new Error('Notifications are blocked in your browser settings.');
  throw new Error('Notification permission was not granted.');
 }
 const reg=await registration();
 let subscription=await reg.pushManager.getSubscription();
 let created=false;
 if(!subscription){
  const key=await publicVapidKey();
  subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToUint8Array(key)});
  created=true;
 }
 try{
  await saveSubscription(subscription);
 }catch(error){
  if(created)await subscription.unsubscribe().catch(()=>false);
  throw error;
 }
 return true;
}

export async function syncPushNotificationSubscription(){
 if(!pushNotificationsSupported()||Notification.permission!=='granted')return false;
 try{
  const reg=await registration();
  const subscription=await reg.pushManager.getSubscription();
  if(!subscription)return false;
  await saveSubscription(subscription);
  return true;
 }catch(error){
  console.warn('Vorlen push subscription sync failed',error);
  return false;
 }
}

export async function disablePushNotifications(){
 if(!pushNotificationsSupported())return;
 try{
  const reg=await navigator.serviceWorker.getRegistration('/');
  const subscription=await reg?.pushManager.getSubscription();
  if(!subscription)return;
  try{await supabase.rpc('unregister_partner_chat_push_subscription',{p_endpoint:subscription.endpoint})}catch{}
  await subscription.unsubscribe().catch(()=>false);
 }catch(error){
  console.warn('Vorlen push subscription cleanup failed',error);
 }
}
