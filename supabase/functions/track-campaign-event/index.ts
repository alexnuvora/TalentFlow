import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const b=await req.json();
    if(!b.campaign_slug||!b.event_type) throw new Error('campaign_slug and event_type are required');
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data,error}=await db.rpc('track_campaign_event',{p_campaign_slug:String(b.campaign_slug),p_event_type:String(b.event_type),p_session_id:b.session_id?String(b.session_id):null,p_link_slug:b.link_slug?String(b.link_slug):null,p_landing_path:b.landing_path?String(b.landing_path):null,p_metadata:b.metadata||{}});
    if(error) throw error;
    return new Response(JSON.stringify({ok:data===true}),{headers:{...cors,'Content-Type':'application/json'}});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Tracking failed'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});
