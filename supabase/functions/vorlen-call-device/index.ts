import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const same=(a:string,b:string)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
Deno.serve(async(req)=>{
 try{
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!service)return json({error:'Server configuration error'},503);
  const db=createClient(url,service);
  const deviceCode=(req.headers.get('x-device-code')||'').trim(),token=req.headers.get('x-device-token')||'';
  if(!deviceCode||token.length<24)return json({error:'Device authentication required'},401);
  const {data:device}=await db.from('call_gateway_devices').select('id,company_id,enabled,pairing_token_hash').eq('device_code',deviceCode).maybeSingle();
  if(!device?.enabled||!device.pairing_token_hash)return json({error:'Unknown or unpaired device'},403);
  if(!same(await sha(token),device.pairing_token_hash))return json({error:'Invalid device credential'},403);
  await db.from('call_gateway_devices').update({last_seen_at:new Date().toISOString()}).eq('id',device.id);
  if(req.method==='GET'){
   const now=new Date().toISOString();
   const {data:control,error:ce}=await db.from('call_gateway_commands').select('id,request_id,action,status,expires_at,created_at').eq('device_id',device.id).eq('company_id',device.company_id).eq('status','pending').gt('expires_at',now).order('created_at',{ascending:true}).limit(1).maybeSingle();
   if(ce)throw ce;
   if(control)return json({command:{id:control.id,request_id:control.request_id,action:control.action}});
   const claim=()=>db.rpc('claim_gateway_call',{p_company:device.company_id,p_device:device.id});
   const {data:pending,error:pe}=await claim();if(pe)throw pe;
   if(pending)return json({command:pending});
   const {error:de}=await db.rpc('dispatch_next_ai_dialer_call',{p_company_id:device.company_id,p_device_id:device.id});if(de)throw de;
   const {data:next,error:ne}=await claim();if(ne)throw ne;
   if(next)return json({command:next});
   return json({command:null});
  }
  if(req.method==='POST'){
   const b=await req.json().catch(()=>({}));
   if(b.type==='event'){
    if(b.request_id){const{data:owned,error:oe}=await db.from('call_gateway_requests').select('id').eq('id',b.request_id).eq('device_id',device.id).eq('company_id',device.company_id).maybeSingle();if(oe||!owned)return json({error:'Request not found'},404);}
    const {error}=await db.from('call_gateway_events').insert({company_id:device.company_id,device_id:device.id,request_id:typeof b.request_id==='string'?b.request_id:null,event_type:String(b.event_type||'state').slice(0,80),call_state:typeof b.call_state==='string'?b.call_state.slice(0,40):null,payload:typeof b.payload==='object'&&b.payload?b.payload:{}});
    if(error)throw error; return json({ok:true});
   }
   if(typeof b.id!=='string')return json({error:'id required'},400);
   const status=b.status==='completed'?'completed':b.status==='failed'?'failed':b.status==='claimed'?'claimed':null;
   if(!status)return json({error:'invalid status'},400);
   const table=b.kind==='command'?'call_gateway_commands':'call_gateway_requests';
   const patch:any={status,error:typeof b.error==='string'?b.error.slice(0,500):null};
   if(status==='claimed')patch.claimed_at=new Date().toISOString();
   if(status==='completed'||status==='failed')patch.completed_at=new Date().toISOString();
   const {data,error}=await db.from(table).update(patch).eq('id',b.id).eq('device_id',device.id).eq('company_id',device.company_id).in('status',status==='claimed'?['approved','pending','claimed']:['approved','pending','claimed',status]).select('id,status').maybeSingle();
   if(error)throw error;if(!data)return json({error:'request not found'},404);
   if(table==='call_gateway_requests'&&(status==='completed'||status==='failed')){
    const {data:item}=await db.from('ai_dialer_items').select('id,campaign_id').eq('call_request_id',b.id).eq('status','dialing').maybeSingle();
    if(item){
     await db.from('ai_dialer_items').update({status:status==='completed'?'completed':'failed',completed_at:new Date().toISOString(),last_error:status==='failed'?(typeof b.error==='string'?b.error.slice(0,500):'call failed'):null}).eq('id',item.id);
     const {data:camp}=await db.from('ai_dialer_campaigns').select('inter_call_delay_seconds,status').eq('id',item.campaign_id).maybeSingle();
     if(camp?.status==='running')await db.from('ai_dialer_campaigns').update({next_call_after:new Date(Date.now()+camp.inter_call_delay_seconds*1000).toISOString()}).eq('id',item.campaign_id);
    }
   }
   return json({data});
  }
  return json({error:'Method not allowed'},405);
 }catch(e){console.error(e);return json({error:'Gateway failed'},500)}
});
