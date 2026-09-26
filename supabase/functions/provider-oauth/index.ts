import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('SITE_URL')||'https://www.vorlen.co.uk').replace(/\/+$/,'');
const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')||JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const oauthProviders=new Set(['google_calendar','microsoft_calendar','linkedin']);

function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomVerifier(){return b64url(crypto.getRandomValues(new Uint8Array(64)))}
async function challenge(verifier:string){return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))}
function redirectResult(returnTo:string,provider:string,ok:boolean,message:string){const u=new URL(returnTo);u.searchParams.set('integration',provider);u.searchParams.set(ok?'oauth_connected':'oauth_error',ok?'1':message.slice(0,240));return Response.redirect(u.toString(),302)}
async function managerContext(req:Request){
 const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))throw Object.assign(new Error('Authentication required'),{status:401});
 const userDb=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const{data:{user},error:ue}=await userDb.auth.getUser();if(ue||!user)throw Object.assign(new Error('Authentication required'),{status:401});
 const{data:profile,error:pe}=await userDb.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(pe||!profile||!['owner','manager'].includes(profile.role))throw Object.assign(new Error('Manager access required'),{status:403});
 return{userDb,user,companyId:profile.company_id};
}
function endpoints(provider:string,tenant?:string|null){
 if(provider==='google_calendar')return{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token'};
 if(provider==='microsoft_calendar'){const t=(tenant||'organizations').trim()||'organizations';return{authorize:`https://login.microsoftonline.com/${encodeURIComponent(t)}/oauth2/v2.0/authorize`,token:`https://login.microsoftonline.com/${encodeURIComponent(t)}/oauth2/v2.0/token`}}
 return{authorize:'https://www.linkedin.com/oauth/v2/authorization',token:'https://www.linkedin.com/oauth/v2/accessToken'};
}
function defaultScopes(provider:string){
 if(provider==='google_calendar')return'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
 if(provider==='microsoft_calendar')return'offline_access User.Read Calendars.ReadWrite';
 return'openid profile email';
}
async function exchange(provider:string,material:any,code:string){
 const ep=endpoints(provider,material.tenant_id),scope=material.requested_scopes||defaultScopes(provider);
 const body=new URLSearchParams({grant_type:'authorization_code',code,client_id:material.client_id,redirect_uri:material.redirect_uri,code_verifier:material.code_verifier});
 if(material.client_secret)body.set('client_secret',material.client_secret);
 if(provider==='microsoft_calendar')body.set('scope',scope);
 const r=await fetch(ep.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(20000)});
 const text=await r.text();if(!r.ok)throw new Error('OAuth token exchange failed ('+r.status+')');
 let data:any;try{data=JSON.parse(text)}catch{throw new Error('OAuth provider returned an invalid token response')}
 if(!data.access_token)throw new Error('OAuth provider did not return an access token');
 return data;
}
async function refresh(provider:string,material:any){
 if(!material.refresh_token)throw new Error('Provider session requires reconnection');
 const ep=endpoints(provider,material.tenant_id),scope=material.scope||defaultScopes(provider);
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:material.refresh_token,client_id:material.client_id});
 if(material.client_secret)body.set('client_secret',material.client_secret);
 if(provider==='microsoft_calendar')body.set('scope',scope);
 const r=await fetch(ep.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('Provider token refresh failed ('+r.status+')');
 const data=await r.json();if(!data.access_token)throw new Error('Provider did not return a refreshed access token');return data;
}
async function providerTest(provider:string,token:string){
 const headers={Authorization:'Bearer '+token,'Accept':'application/json'};
 if(provider==='google_calendar'){
   const [cal,who]=await Promise.all([
     fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',{headers,signal:AbortSignal.timeout(15000)}),
     fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers,signal:AbortSignal.timeout(15000)})
   ]);
   if(!cal.ok)throw new Error('Google Calendar permission test failed ('+cal.status+')');
   const account=who.ok?await who.json():{};return{provider_user_id:account.sub||null,email:account.email||null,name:account.name||null};
 }
 if(provider==='microsoft_calendar'){
   const [cal,who]=await Promise.all([
     fetch('https://graph.microsoft.com/v1.0/me/calendars?$top=1',{headers,signal:AbortSignal.timeout(15000)}),
     fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',{headers,signal:AbortSignal.timeout(15000)})
   ]);
   if(!cal.ok)throw new Error('Microsoft Calendar permission test failed ('+cal.status+')');
   const account=who.ok?await who.json():{};return{provider_user_id:account.id||null,email:account.mail||account.userPrincipalName||null,name:account.displayName||null};
 }
 const who=await fetch('https://api.linkedin.com/v2/userinfo',{headers,signal:AbortSignal.timeout(15000)});
 if(!who.ok)throw new Error('LinkedIn identity permission test failed ('+who.status+')');
 const account=await who.json();return{provider_user_id:account.sub||null,email:account.email||null,name:account.name||null};
}
async function storeTokens(companyId:string,provider:string,tokens:any,account:any,existingRefresh?:string|null){
 const expiresAt=tokens.expires_in?new Date(Date.now()+Number(tokens.expires_in)*1000).toISOString():null;
 const{error}=await admin.rpc('service_store_integration_oauth_tokens',{
   p_company:companyId,p_provider:provider,p_access_token:tokens.access_token,
   p_refresh_token:tokens.refresh_token||existingRefresh||null,p_expires_at:expiresAt,
   p_scope:tokens.scope||'',p_token_type:tokens.token_type||'Bearer',p_external_account:account,p_test_result:'OAuth connection verified'
 });
 if(error)throw new Error(error.message);
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=new URL(req.url),isCallback=url.pathname.endsWith('/callback');
 try{
  if(isCallback){
    const state=url.searchParams.get('state'),code=url.searchParams.get('code'),providerError=url.searchParams.get('error');
    if(!state)return redirectResult(appUrl+'/dashboard/partner-management','unknown',false,'Missing OAuth state');
    const{data:material,error:me}=await admin.rpc('service_consume_integration_oauth_state',{p_state:state});
    if(me||!material)return redirectResult(appUrl+'/dashboard/partner-management','unknown',false,'OAuth state expired or invalid');
    if(providerError)return redirectResult(material.return_to,material.provider,false,url.searchParams.get('error_description')||providerError);
    if(!code)return redirectResult(material.return_to,material.provider,false,'Provider did not return an authorization code');
    const tokens=await exchange(material.provider,material,code);
    const account=await providerTest(material.provider,tokens.access_token);
    await storeTokens(material.company_id,material.provider,tokens,account);
    return redirectResult(material.return_to,material.provider,true,'Connected');
  }

  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const ctx=await managerContext(req),body=await req.json().catch(()=>({})),action=String(body.action||''),provider=String(body.provider||'');
  if(!oauthProviders.has(provider))return json({error:'This provider does not support Vorlen OAuth/PKCE.'},400);

  if(action==='start'){
    const verifier=randomVerifier(),codeChallenge=await challenge(verifier),redirectUri=supabaseUrl+'/functions/v1/provider-oauth/callback',returnTo=appUrl+'/dashboard/partner-management';
    const{data:prepared,error}=await admin.rpc('service_prepare_integration_oauth',{p_company:ctx.companyId,p_provider:provider,p_user:ctx.user.id,p_verifier:verifier,p_redirect_uri:redirectUri,p_return_to:returnTo});
    if(error)throw new Error(error.message);
    const ep=endpoints(provider,prepared.tenant_id),scope=prepared.requested_scopes||defaultScopes(provider);
    const authUrl=new URL(ep.authorize);
    authUrl.searchParams.set('client_id',prepared.client_id);authUrl.searchParams.set('redirect_uri',redirectUri);authUrl.searchParams.set('response_type','code');
    authUrl.searchParams.set('state',prepared.state);authUrl.searchParams.set('scope',scope);authUrl.searchParams.set('code_challenge',codeChallenge);authUrl.searchParams.set('code_challenge_method','S256');
    if(provider==='google_calendar'){authUrl.searchParams.set('access_type','offline');authUrl.searchParams.set('include_granted_scopes','true');authUrl.searchParams.set('prompt','consent')}
    return json({authorization_url:authUrl.toString()});
  }

  if(action==='test'){
    const{data:material,error}=await admin.rpc('service_integration_oauth_material',{p_company:ctx.companyId,p_provider:provider});if(error)throw new Error(error.message);
    let token=material?.access_token,tokens:any=null;
    const expires=material?.expires_at?new Date(material.expires_at).getTime():0;
    if(!token||!expires||expires<Date.now()+120000){tokens=await refresh(provider,material);token=tokens.access_token}
    const account=await providerTest(provider,token);
    if(tokens)await storeTokens(ctx.companyId,provider,tokens,account,material.refresh_token);
    else await storeTokens(ctx.companyId,provider,{access_token:token,refresh_token:material.refresh_token,expires_in:Math.max(60,Math.floor((expires-Date.now())/1000)),scope:material.scope,token_type:'Bearer'},account,material.refresh_token);
    return json({ok:true,account});
  }

  if(action==='disconnect'){
    const{error}=await ctx.userDb.rpc('manager_disconnect_oauth_connection',{p_provider:provider});if(error)throw new Error(error.message);
    return json({ok:true});
  }
  return json({error:'Unsupported action'},400);
 }catch(e){console.error('provider-oauth',e instanceof Error?e.message:String(e));const status=(e as any)?.status||500;return json({error:e instanceof Error?e.message:'Provider OAuth failed'},status)}
});
