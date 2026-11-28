import {validAnalyticsEvent} from '../src/lib/siteConsent.mjs';
const origins=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk']);
const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data))};
export default async function handler(req,res){
 const url=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const anon=process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
 if(!url||!service||!anon)return json(res,503,{error:'Analytics unavailable'});
 const headers={apikey:service,authorization:'Bearer '+service,'content-type':'application/json'};
 async function rest(path,body){
  const r=await fetch(url+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Error('Database unavailable');
  const t=await r.text();return t?JSON.parse(t):null;
 }
 try{
  if(req.method==='POST'){
   if(!origins.has(req.headers.origin)|| (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site']!=='same-origin'))return json(res,403,{error:'Origin not allowed'});
   if(!String(req.headers['content-type']||'').startsWith('application/json')||Number(req.headers['content-length']||0)>1024)return json(res,400,{error:'Invalid request'});
   let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return json(res,400,{error:'Invalid request'})}
   if(!validAnalyticsEvent(body))return json(res,400,{error:'Invalid event'});
   // Global safety limit, not a per-visitor identity. The public endpoint is not proof of a genuine visit.
   const allowed=await rest('rpc/check_application_rate_limit',{p_key:'site-analytics:global',p_limit:600,p_window_seconds:60});
   if(allowed!==true)return json(res,429,{error:'Rate limit'});
   await rest('rpc/record_site_analytics',{p_page:body.page,p_source:body.source,p_event:body.event});
   return json(res,200,{ok:true});
  }
  const token=String(req.headers.authorization||'').match(/^Bearer ([^\s]+)$/i)?.[1];
  if(!token)return json(res,401,{error:'Sign in required'});
  const u=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,authorization:'Bearer '+token}});
  if(!u.ok)return json(res,401,{error:'Sign in required'});
  const user=await u.json();
  if(!user.id)return json(res,401,{error:'Sign in required'});
  const profiles=await rest('profiles?id=eq.'+encodeURIComponent(user.id)+'&select=company_id,role');
  const profile=profiles?.[0];
  if(profile?.role!=='owner'||!profile.company_id)return json(res,403,{error:'Owner access required'});
  const companies=await rest('companies?id=eq.'+encodeURIComponent(profile.company_id)+'&select=company_registration_number');
  if(companies?.[0]?.company_registration_number!=='17387520')return json(res,403,{error:'Vorlen owner access required'});
  const days=[7,28,90].includes(Number(req.query?.days))?Number(req.query.days):28;
  return json(res,200,{ok:true,days,...await rest('rpc/site_analytics_snapshot',{p_days:days})});
 }catch{return json(res,503,{error:'Analytics temporarily unavailable'})}
}
