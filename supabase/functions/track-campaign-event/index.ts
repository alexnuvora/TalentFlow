import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const b=await req.json();
    const slug=String(b.campaign_slug||'').trim(),eventType=String(b.event_type||'').trim();
    if(!slug||slug.length>160||!eventType)throw new Error('Valid campaign_slug and event_type are required');
    if(!['page_view','cta_click','application_started'].includes(eventType))throw new Error('Unsupported event type');
    const sessionId=b.session_id?String(b.session_id).trim().slice(0,120):null;
    const linkSlug=b.link_slug?String(b.link_slug).trim().slice(0,160):null;
    const landingPath=b.landing_path?String(b.landing_path).trim().slice(0,500):null;
    const metadata=b.metadata&&typeof b.metadata==='object'&&!Array.isArray(b.metadata)?b.metadata:{};
    if(JSON.stringify(metadata).length>4096)throw new Error('Event metadata is too large');

    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown').slice(0,100);
    const{data:allowed,error:rlError}=await db.rpc('check_application_rate_limit',{p_key:`campaign-event:${ip}:${slug}`,p_limit:240,p_window_seconds:3600});
    if(rlError||allowed!==true)return json({error:'Too many tracking requests'},429);

    const {data,error}=await db.rpc('track_campaign_event',{
      p_campaign_slug:slug,p_event_type:eventType,p_session_id:sessionId,p_link_slug:linkSlug,p_landing_path:landingPath,p_metadata:metadata
    });
    if(error)throw error;
    return json({ok:data===true});
  }catch(e){return json({error:e instanceof Error?e.message:'Tracking failed'},400)}
});
