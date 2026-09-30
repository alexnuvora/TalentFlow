import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, x-chat-reminder-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(v:string)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const workspaceUrl='https://www.vorlen.co.uk/dashboard/partner/chat';

function emailHtml(firstName:string,unreadCount:number){
 return `<!doctype html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Vorlen has messaged you</title></head>
<body style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#11251f">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${unreadCount} unread ${unreadCount===1?'message':'messages'} from Vorlen management.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f7f5"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce6e1;border-radius:14px;overflow:hidden">
<tr><td style="padding:24px 30px;background:#11251f">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td aria-hidden="true" style="width:42px;height:42px;border:2px solid #b8e34b;text-align:center;vertical-align:middle;font-size:24px;font-weight:800;line-height:42px;color:#b8e34b">V</td>
<td style="padding-left:14px"><div style="font-size:21px;line-height:1;font-weight:800;letter-spacing:5px;color:#ffffff">VORLEN</div><div style="padding-top:7px;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:1.6px;color:#b8e34b">PARTNER WORKSPACE</div></td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 30px 38px">
<div style="width:42px;height:4px;background:#b8e34b;margin-bottom:24px"></div>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.18;color:#11251f">Vorlen has messaged you</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#11251f">Hi ${esc(firstName||'there')},</p>
<p style="margin:0 0 12px;font-size:18px;line-height:1.55;font-weight:700;color:#11251f">${unreadCount} new ${unreadCount===1?'message':'messages'} from Vorlen management.</p><p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#31463f">Your messages are waiting for you in your Vorlen partner workspace.</p>
<p style="margin:0 0 26px;font-size:13px;line-height:1.65;color:#65766f">For your privacy, the message content is not included in this email. Open your secure Vorlen workspace to read it and reply.</p>
<p style="margin:0 0 8px"><a href="${workspaceUrl}" style="display:inline-block;padding:14px 24px;background:#0b6b55;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;border-radius:8px">View messages</a></p>
</td></tr>
<tr><td style="padding:22px 30px;background:#f8faf9;border-top:1px solid #e3ebe7;font-size:11px;line-height:1.65;color:#60716a">
<strong style="color:#11251f">VORLEN</strong> · Secure recruitment workspace<br>
Ivy and Pearls Ltd trading as Vorlen · Company No. 17387520 · Registered in England and Wales<br>
<a href="https://www.vorlen.co.uk" style="color:#153b32;text-decoration:underline">Visit Vorlen</a> · <a href="mailto:contact@vorlen.co.uk" style="color:#153b32;text-decoration:underline">contact@vorlen.co.uk</a>
</td></tr></table>
</td></tr></table></body></html>`;
}

function emailText(firstName:string,unreadCount:number){
 return `Hi ${firstName||'there'},

${unreadCount} new ${unreadCount===1?'message':'messages'} from Vorlen management.

Your messages are waiting for you in your Vorlen partner workspace.

For your privacy, the message content is not included in this email.

View messages:
${workspaceUrl}

Kind regards,
Vorlen
Secure recruitment workspace`;
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!;
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db=createClient(url,service);
  const secret=req.headers.get('x-chat-reminder-secret')||'';
  const{data:valid,error:secretError}=await db.rpc('verify_partner_chat_reminder_secret',{p_secret:secret});
  if(secretError||valid!==true)return json({error:'Unauthorized'},401);

  const{data:ids,error:claimError}=await db.rpc('claim_partner_chat_email_reminders',{p_limit:25});
  if(claimError)throw claimError;

  const resendKey=Deno.env.get('RESEND_API_KEY');
  if(!resendKey)throw new Error('Email provider is not configured');

  const results:any[]=[];
  for(const rawId of ids||[]){
   const id=String(rawId);
   let reminder:any=null;
   let deliveryId:string|null=null;
   try{
    const{data:r,error:re}=await db.from('partner_chat_email_reminders').select('*').eq('id',id).maybeSingle();
    if(re||!r){results.push({id,status:'missing'});continue}
    reminder=r;
    if(r.status!=='processing'){results.push({id,status:r.status});continue}

    const[{data:message,error:me},{data:receipt,error:rce},{data:partner,error:pe},{data:onboarding,error:oe}]=await Promise.all([
      db.from('partner_messages').select('id,company_id,conversation_id,sender_id,created_at,deleted_at').eq('id',r.message_id).maybeSingle(),
      db.from('partner_message_receipts').select('read_at').eq('message_id',r.message_id).eq('user_id',r.partner_id).maybeSingle(),
      db.from('profiles').select('id,company_id,role,full_name').eq('id',r.partner_id).eq('company_id',r.company_id).maybeSingle(),
      db.from('partner_onboarding').select('status').eq('partner_id',r.partner_id).eq('company_id',r.company_id).maybeSingle()
    ]);
    if(me||rce||pe||oe)throw me||rce||pe||oe;
    if(!message||message.deleted_at||receipt?.read_at||!partner||partner.role!=='partner'||onboarding?.status!=='active'){
      await db.from('partner_chat_email_reminders').update({status:'cancelled',cancelled_at:new Date().toISOString(),processing_started_at:null,updated_at:new Date().toISOString(),last_error:null}).eq('id',id).eq('status','processing');
      results.push({id,status:'cancelled'});continue;
    }

    const{data:authUser,error:authError}=await db.auth.admin.getUserById(r.partner_id);
    const recipient=String(authUser?.user?.email||'').trim().toLowerCase();
    if(authError||!recipient)throw new Error('Partner email address is unavailable');

    const{data:managementUsers,error:managementError}=await db.from('profiles').select('id').eq('company_id',r.company_id).in('role',['owner','manager']);
    if(managementError)throw managementError;
    const managementIds=(managementUsers||[]).map((x:any)=>x.id);
    let unreadCount=0;
    if(managementIds.length){
      const{data:managementMessages,error:messageListError}=await db.from('partner_messages').select('id').eq('conversation_id',r.conversation_id).in('sender_id',managementIds).is('deleted_at',null);
      if(messageListError)throw messageListError;
      const messageIds=(managementMessages||[]).map((x:any)=>x.id);
      if(messageIds.length){
        const{data:readRows,error:readRowsError}=await db.from('partner_message_receipts').select('message_id').eq('user_id',r.partner_id).in('message_id',messageIds).not('read_at','is',null);
        if(readRowsError)throw readRowsError;
        const readIds=new Set((readRows||[]).map((x:any)=>x.message_id));
        unreadCount=messageIds.filter((messageId:string)=>!readIds.has(messageId)).length;
      }
    }
    if(unreadCount<1){
      await db.from('partner_chat_email_reminders').update({status:'cancelled',cancelled_at:new Date().toISOString(),processing_started_at:null,updated_at:new Date().toISOString(),last_error:null}).eq('id',id).eq('status','processing');
      results.push({id,status:'cancelled'});continue;
    }

    // Re-check immediately before reserving/sending so a read receipt that arrived during processing cancels the reminder.
    const{data:latest}=await db.from('partner_chat_email_reminders').select('status').eq('id',id).maybeSingle();
    const{data:latestReceipt}=await db.from('partner_message_receipts').select('read_at').eq('message_id',r.message_id).eq('user_id',r.partner_id).maybeSingle();
    if(latest?.status!=='processing'||latestReceipt?.read_at){
      if(latest?.status==='processing')await db.from('partner_chat_email_reminders').update({status:'cancelled',cancelled_at:new Date().toISOString(),processing_started_at:null,updated_at:new Date().toISOString()}).eq('id',id);
      results.push({id,status:'cancelled'});continue;
    }

    const idem=`partner-chat-unread:${r.message_id}`;
    let{data:delivery,error:de}=await db.from('outbound_deliveries').insert({
      company_id:r.company_id,
      kind:'partner_chat_unread_reminder',
      idempotency_key:idem,
      recipient,
      provider:'resend',
      status:'sending',
      payload:{reminder_id:id,message_id:r.message_id,conversation_id:r.conversation_id,partner_id:r.partner_id}
    }).select('id,status,provider_message_id').single();

    if(de){
      const{data:existing,error:ee}=await db.from('outbound_deliveries').select('id,status,provider_message_id').eq('company_id',r.company_id).eq('idempotency_key',idem).maybeSingle();
      if(ee||!existing)throw new Error('Reminder delivery could not be reserved');
      if(existing.status==='sent'){
        await db.from('partner_chat_email_reminders').update({status:'sent',sent_at:new Date().toISOString(),provider_message_id:existing.provider_message_id||null,processing_started_at:null,last_error:null,updated_at:new Date().toISOString()}).eq('id',id);
        results.push({id,status:'sent',deduplicated:true});continue;
      }
      delivery=existing;
      if(existing.status==='failed'){
        const{data:retry,error:retryError}=await db.from('outbound_deliveries').update({status:'sending',last_error:null}).eq('id',existing.id).eq('status','failed').select('id,status,provider_message_id').maybeSingle();
        if(retryError||!retry)throw new Error('Reminder delivery retry could not be reserved');
        delivery=retry;
      }
    }
    deliveryId=delivery!.id;

    const firstName=String(partner.full_name||'there').trim().split(/\s+/)[0]||'there';
    const subject='Vorlen has messaged you';
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':idem},
      body:JSON.stringify({
        from:'Vorlen <contact@vorlen.co.uk>',
        to:[recipient],
        reply_to:'contact@vorlen.co.uk',
        subject,
        html:emailHtml(firstName,unreadCount),
        text:emailText(firstName,unreadCount),
        headers:{'X-Entity-Ref-ID':r.message_id}
      })
    });
    const raw=await response.text();
    if(!response.ok)throw new Error(`Resend ${response.status}: ${raw.slice(0,240)}`);
    let providerId:string|null=null;try{providerId=JSON.parse(raw)?.id||null}catch{}

    const sentAt=new Date().toISOString();
    await db.from('outbound_deliveries').update({status:'sent',provider_message_id:providerId,sent_at:sentAt,last_error:null}).eq('id',deliveryId);
    await db.from('partner_chat_email_reminders').update({status:'sent',sent_at:sentAt,provider_message_id:providerId,processing_started_at:null,last_error:null,updated_at:sentAt}).eq('id',id);
    results.push({id,status:'sent',unread_count:unreadCount});
   }catch(error){
    const message=error instanceof Error?error.message:'Reminder send failed';
    const attempts=Number(reminder?.attempts||0)+1;
    const final=attempts>=5;
    const retryMinutes=Math.min(60,5*(2**Math.max(0,attempts-1)));
    const now=new Date();
    const next=new Date(now.getTime()+retryMinutes*60000).toISOString();
    if(deliveryId)await db.from('outbound_deliveries').update({status:'failed',last_error:message}).eq('id',deliveryId).neq('status','sent');
    if(reminder)await db.from('partner_chat_email_reminders').update({
      status:final?'failed':'pending',
      attempts,
      due_at:final?reminder.due_at:next,
      processing_started_at:null,
      last_error:message.slice(0,2000),
      updated_at:now.toISOString()
    }).eq('id',id).neq('status','sent').neq('status','cancelled');
    results.push({id,status:final?'failed':'retry',error:message});
   }
  }
  return json({ok:true,processed:results.length,results});
 }catch(error){
  return json({error:error instanceof Error?error.message:'Partner chat reminder worker failed'},500);
 }
});
