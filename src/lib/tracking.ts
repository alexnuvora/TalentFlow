export async function trackCampaign(campaignSlug:string,eventType:'page_view'|'cta_click'|'application_started',linkSlug?:string,metadata:Record<string,unknown>={}){
  // Cookieless first-party recruitment attribution: no localStorage/session identifier,
  // fingerprint, IP address or cross-site identifier is sent by the browser.
  if(!campaignSlug)return;
  try{
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-campaign-event`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':import.meta.env.VITE_SUPABASE_ANON_KEY},
      body:JSON.stringify({
        campaign_slug:campaignSlug,
        event_type:eventType,
        session_id:null,
        link_slug:linkSlug||null,
        landing_path:window.location.pathname,
        metadata
      })
    });
  }catch{/* analytics must never block the candidate journey */}
}
