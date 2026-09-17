export async function trackCampaign(campaignSlug:string,eventType:'page_view'|'cta_click'|'application_started',linkSlug?:string,metadata:Record<string,unknown>={}){
  // Cookieless first-party recruitment attribution: no localStorage/session identifier,
  // fingerprint, IP address or cross-site identifier is sent by the browser.
  if(!campaignSlug)return;
  try{await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-campaign-event`,{method:'POST',headers:{'Content-Type':'application/json','apikey':import.meta.env.VITE_SUPABASE_ANON_KEY},body:JSON.stringify({campaign_slug:campaignSlug,event_type:eventType,session_id:null,link_slug:linkSlug||null,landing_path:window.location.pathname,metadata})})}catch{/* analytics must never block the candidate journey */}
}
export function trackCampaignLanding(campaignSlug:string,linkSlug?:string){return trackCampaign(campaignSlug,'page_view',linkSlug)}
export function trackJobView(jobId:string,metadata:Record<string,unknown>={}){const campaign=String(metadata.campaign_slug||'');if(!campaign)return Promise.resolve();const {campaign_slug:_,link_slug,...rest}=metadata;return trackCampaign(campaign,'page_view',typeof link_slug==='string'?link_slug:undefined,{job_id:jobId,...rest})}
export function trackApplicationStart(jobId:string,metadata:Record<string,unknown>={}){const campaign=String(metadata.campaign_slug||'');if(!campaign)return Promise.resolve();const {campaign_slug:_,link_slug,...rest}=metadata;return trackCampaign(campaign,'application_started',typeof link_slug==='string'?link_slug:undefined,{job_id:jobId,...rest})}
