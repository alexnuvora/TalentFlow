const key='tf_session_id';
export function sessionId(){try{let v=localStorage.getItem(key);if(!v){v=crypto.randomUUID();localStorage.setItem(key,v)}return v}catch{return crypto.randomUUID()}}
export async function trackCampaign(campaignSlug:string,eventType:'page_view'|'cta_click'|'application_started',linkSlug?:string,metadata:Record<string,unknown>={}){
  // Optional analytics stays off until an explicit consent UI is implemented.
  return;
  try{await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-campaign-event`,{method:'POST',headers:{'Content-Type':'application/json','apikey':import.meta.env.VITE_SUPABASE_ANON_KEY},body:JSON.stringify({campaign_slug:campaignSlug,event_type:eventType,session_id:sessionId(),link_slug:linkSlug||null,landing_path:window.location.pathname,metadata})})}catch{/* analytics must never block the candidate journey */}
}
