import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const allowedOrigins=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk']);
const headers=(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  return {
    'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://www.vorlen.co.uk',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Vary':'Origin',
    'Cache-Control':'no-store'
  };
};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers(req),'Content-Type':'application/json'}});
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shell=(title:string,body:string)=>`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,Helvetica,sans-serif;color:#10201d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d"><div style="font-size:19px;font-weight:800;letter-spacing:4px;color:#ffffff">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">UK PERMANENT RECRUITMENT</div></td></tr><tr><td style="padding:36px 34px"><h1 style="margin:0 0 22px;font-size:28px;line-height:1.15;color:#10201d">${title}</h1>${body}</td></tr><tr><td style="padding:22px 34px;border-top:1px solid #e4ebe8;color:#6a7b75;font-size:11px;line-height:1.6">Vorlen · VORLEN T/A IVY AND PEARLS LTD · Company No. 17387520<br><a href="https://www.vorlen.co.uk" style="color:#0b6b55">www.vorlen.co.uk</a> · contact@vorlen.co.uk</td></tr></table></td></tr></table></body></html>`;
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:headers(req)});
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  try{
    const email=String((await req.json())?.email||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email))return json(req,{error:'Enter a valid email address.'},400);

    const url=Deno.env.get('SUPABASE_URL')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resend=Deno.env.get('RESEND_API_KEY');
    if(!url||!service||!resend)return json(req,{error:'Password recovery is temporarily unavailable.'},503);
    const db=createClient(url,service);

    const key='password-recovery:'+await sha256(email);
    const now=Date.now(),windowMs=15*60*1000;
    const{data:rate}=await db.from('application_rate_limits').select('window_started_at,request_count').eq('key',key).maybeSingle();
    const fresh=rate&&now-new Date(rate.window_started_at).getTime()<windowMs;
    if(fresh&&Number(rate.request_count)>=3)return json(req,{error:'Too many recovery requests. Please try again in about 15 minutes.'},429);
    await db.from('application_rate_limits').upsert({
      key,
      window_started_at:fresh?rate.window_started_at:new Date(now).toISOString(),
      request_count:fresh?Number(rate.request_count)+1:1
    });

    const{data:link,error:linkError}=await db.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:'https://www.vorlen.co.uk/reset-password'}});
    if(linkError||!link?.properties){
      // Do not reveal whether an account exists.
      return json(req,{ok:true});
    }
    const token=link.properties.hashed_token||(()=>{try{return new URL(link.properties.action_link||'').searchParams.get('token')||''}catch{return''}})();
    if(!token)return json(req,{error:'Password recovery is temporarily unavailable.'},503);

    const actionLink='https://www.vorlen.co.uk/auth/confirm?token_hash='+encodeURIComponent(token)+'&type=recovery&next='+encodeURIComponent('/reset-password');
    const name=String(link.user?.user_metadata?.full_name||'there');
    const mail=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:'Vorlen <contact@vorlen.co.uk>',
        to:[email],
        reply_to:'contact@vorlen.co.uk',
        subject:'Reset your Vorlen password',
        html:shell('Reset your Vorlen password',`<p style="margin:0 0 18px;font-size:15px;line-height:1.7">Hello ${esc(name)},</p><p style="margin:0 0 24px;font-size:15px;line-height:1.7">We received a request to reset the password for your Vorlen account.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px">Reset password</a></p><p style="margin:0;color:#667972;font-size:13px;line-height:1.6">This is a one-time, time-limited link. If you did not request it, you can ignore this email.</p>`)
      })
    });
    if(!mail.ok)return json(req,{error:'Password recovery email could not be sent. Please try again shortly.'},502);
    return json(req,{ok:true});
  }catch(e){
    console.error('password-recovery',e);
    return json(req,{error:'Password recovery is temporarily unavailable.'},500);
  }
});
