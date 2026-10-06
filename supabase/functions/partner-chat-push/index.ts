import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, x-chat-push-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});

const clean=(value:string)=>String(value||'')
  .replace(/\*\*([^*\n]+)\*\*/g,'$1')
  .replace(/\+\+([^+\n]+)\+\+/g,'$1')
  .replace(/\*([^*\n]+)\*/g,'$1')
  .replace(/^\s*[-•]\s+/gm,'')
  .replace(/^\s*\d+[.)]\s+/gm,'')
  .replace(/\s+/g,' ')
  .trim();

const nextRetry=(attempts:number)=>new Date(Date.now()+Math.min(15,Math.max(1,2**Math.max(0,attempts-1)))*60000).toISOString();

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);

  const url=Deno.env.get('SUPABASE_URL');
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!service)return json({error:'Push worker is not configured'},500);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  try{
    const secret=req.headers.get('x-chat-push-secret')||'';
    const{data:valid,error:secretError}=await db.rpc('verify_partner_chat_push_worker_secret',{p_secret:secret});
    if(secretError||valid!==true)return json({error:'Unauthorized'},401);

    let requestedEvent:string|null=null;
    try{
      const body=await req.json();
      requestedEvent=body?.event_id?String(body.event_id):null;
    }catch{}

    const{data:keyRows,error:keyError}=await db.rpc('partner_chat_push_vapid_keys');
    if(keyError)throw keyError;
    const keys=Array.isArray(keyRows)?keyRows[0]:keyRows;
    if(!keys?.public_key||!keys?.private_key)throw new Error('VAPID keys are not configured');
    webpush.setVapidDetails('mailto:contact@vorlen.co.uk',String(keys.public_key),String(keys.private_key));

    const{data:claimed,error:claimError}=await db.rpc('claim_partner_chat_push_events',{
      p_event_id:requestedEvent||null,
      p_limit:requestedEvent?1:25
    });
    if(claimError)throw claimError;

    const output:any[]=[];
    for(const item of claimed||[]){
      const eventId=String(item.event_id);
      const eventAttempts=Number(item.attempts||1);
      try{
        const{data:event,error:eventError}=await db.from('partner_chat_push_events').select('*').eq('id',eventId).maybeSingle();
        if(eventError||!event)throw eventError||new Error('Push event not found');

        const[{data:message,error:messageError},{data:conversation,error:conversationError}]=await Promise.all([
          db.from('partner_messages').select('id,company_id,conversation_id,sender_id,body,message_type,context_label,deleted_at').eq('id',event.message_id).maybeSingle(),
          db.from('partner_conversations').select('id,company_id,partner_id').eq('id',event.conversation_id).maybeSingle()
        ]);
        if(messageError||conversationError)throw messageError||conversationError;
        if(!message||!conversation||message.deleted_at){
          await db.from('partner_chat_push_events').update({status:'sent',processing_started_at:null,sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',eventId);
          output.push({event_id:eventId,status:'cancelled'});continue;
        }

        const{data:sender,error:senderError}=await db.from('profiles').select('id,company_id,role,full_name').eq('id',message.sender_id).eq('company_id',message.company_id).maybeSingle();
        if(senderError||!sender)throw senderError||new Error('Message sender profile is unavailable');

        let recipients:any[]=[];
        if(sender.role==='partner'){
          const{data,error}=await db.from('profiles').select('id,role,full_name').eq('company_id',message.company_id).in('role',['owner','manager']).neq('id',message.sender_id);
          if(error)throw error;
          recipients=data||[];
        }else if(['owner','manager'].includes(sender.role)){
          const{data,error}=await db.from('profiles').select('id,role,full_name').eq('id',conversation.partner_id).eq('company_id',message.company_id).maybeSingle();
          if(error)throw error;
          if(data&&data.id!==message.sender_id)recipients=[data];
        }

        const recipientIds=recipients.map((r:any)=>r.id);
        let subscriptions:any[]=[];
        if(recipientIds.length){
          const{data,error}=await db.from('partner_chat_push_subscriptions').select('*').in('user_id',recipientIds).eq('company_id',message.company_id).eq('enabled',true);
          if(error)throw error;
          subscriptions=data||[];
        }

        if(!subscriptions.length){
          const now=new Date().toISOString();
          await db.from('partner_chat_push_events').update({status:'sent',processing_started_at:null,sent_at:now,sent_count:0,failed_count:0,last_error:null,updated_at:now}).eq('id',eventId);
          output.push({event_id:eventId,status:'sent',sent:0,reason:'no_active_subscriptions'});continue;
        }

        const deliverySeed=subscriptions.map((s:any)=>({event_id:eventId,subscription_id:s.id,recipient_id:s.user_id}));
        const{error:seedError}=await db.from('partner_chat_push_deliveries').upsert(deliverySeed,{onConflict:'event_id,subscription_id',ignoreDuplicates:true});
        if(seedError)throw seedError;

        const{data:deliveries,error:deliveryError}=await db.from('partner_chat_push_deliveries').select('*').eq('event_id',eventId).in('status',['pending','processing']).lte('next_attempt_at',new Date().toISOString());
        if(deliveryError)throw deliveryError;

        const subscriptionById=new Map(subscriptions.map((s:any)=>[s.id,s]));
        for(const d of deliveries||[]){
          const sub=subscriptionById.get(d.subscription_id);
          if(!sub)continue;
          const attempts=Number(d.attempts||0)+1;
          const started=new Date().toISOString();
          await db.from('partner_chat_push_deliveries').update({status:'processing',attempts,processing_started_at:started,updated_at:started}).eq('id',d.id).in('status',['pending','processing']);

          const recipient=recipients.find((r:any)=>r.id===d.recipient_id);
          const recipientIsPartner=recipient?.role==='partner';
          const senderName=sender.role==='partner'?(String(sender.full_name||'Your Vorlen partner').trim()||'Your Vorlen partner'):'Vorlen';
          const preview=message.message_type==='attachment'?(clean(message.body)||'Sent you an attachment.'):clean(message.body);
          const notification={
            title:sender.role==='partner'?('New message from '+senderName):'New message from Vorlen',
            body:(preview||'You have a new secure chat message.').slice(0,180),
            icon:'/favicon.svg',
            tag:'vorlen-chat-'+message.conversation_id,
            renotify:true,
            data:{
              url:recipientIsPartner?'/dashboard/partner/chat':('/dashboard/partner-management/chat?partner='+conversation.partner_id),
              conversation_id:message.conversation_id,
              message_id:message.id
            }
          };

          try{
            await webpush.sendNotification(
              {endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},
              JSON.stringify(notification),
              {TTL:86400,urgency:'high'}
            );
            const now=new Date().toISOString();
            await Promise.all([
              db.from('partner_chat_push_deliveries').update({status:'sent',sent_at:now,processing_started_at:null,last_error:null,updated_at:now}).eq('id',d.id),
              db.from('partner_chat_push_subscriptions').update({failure_count:0,last_success_at:now,last_seen_at:now,updated_at:now}).eq('id',sub.id)
            ]);
          }catch(error:any){
            const code=Number(error?.statusCode||error?.status||0);
            const detail=String(error?.body||error?.message||'Web Push delivery failed').slice(0,1500);
            const expired=code===404||code===410;
            const final=expired||attempts>=5;
            const now=new Date().toISOString();
            await db.from('partner_chat_push_deliveries').update({
              status:expired?'expired':final?'failed':'pending',
              next_attempt_at:final?d.next_attempt_at:nextRetry(attempts),
              processing_started_at:null,
              last_error:detail,
              updated_at:now
            }).eq('id',d.id);
            await db.from('partner_chat_push_subscriptions').update({
              enabled:expired?false:true,
              failure_count:Number(sub.failure_count||0)+1,
              last_failure_at:now,
              updated_at:now
            }).eq('id',sub.id);
          }
        }

        const{data:allDeliveries,error:allError}=await db.from('partner_chat_push_deliveries').select('status,next_attempt_at').eq('event_id',eventId);
        if(allError)throw allError;
        const rows=allDeliveries||[];
        const sentCount=rows.filter((d:any)=>d.status==='sent').length;
        const failedCount=rows.filter((d:any)=>d.status==='failed'||d.status==='expired').length;
        const pending=rows.filter((d:any)=>d.status==='pending'||d.status==='processing');
        const now=new Date().toISOString();
        if(pending.length){
          const next=pending.map((d:any)=>new Date(d.next_attempt_at||now).getTime()).filter(Number.isFinite).sort((a:number,b:number)=>a-b)[0]||Date.now()+60000;
          await db.from('partner_chat_push_events').update({
            status:'pending',
            next_attempt_at:new Date(next).toISOString(),
            processing_started_at:null,
            sent_count:sentCount,
            failed_count:failedCount,
            last_error:null,
            updated_at:now
          }).eq('id',eventId);
          output.push({event_id:eventId,status:'pending',sent:sentCount,failed:failedCount});
        }else{
          const finalStatus=sentCount>0||failedCount===0?'sent':'failed';
          await db.from('partner_chat_push_events').update({
            status:finalStatus,
            processing_started_at:null,
            sent_at:finalStatus==='sent'?now:null,
            sent_count:sentCount,
            failed_count:failedCount,
            last_error:finalStatus==='failed'?'All push deliveries failed':null,
            updated_at:now
          }).eq('id',eventId);
          output.push({event_id:eventId,status:finalStatus,sent:sentCount,failed:failedCount});
        }
      }catch(error){
        const message=error instanceof Error?error.message:'Push event failed';
        const final=eventAttempts>=5;
        const now=new Date().toISOString();
        await db.from('partner_chat_push_events').update({
          status:final?'failed':'pending',
          next_attempt_at:final?new Date().toISOString():nextRetry(eventAttempts),
          processing_started_at:null,
          last_error:message.slice(0,2000),
          updated_at:now
        }).eq('id',eventId);
        output.push({event_id:eventId,status:final?'failed':'pending',error:message});
      }
    }

    return json({ok:true,processed:output.length,results:output});
  }catch(error){
    return json({error:error instanceof Error?error.message:'Partner chat push worker failed'},500);
  }
});
