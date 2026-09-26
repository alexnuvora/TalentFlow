import {createClient} from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CALLBACK=SUPABASE_URL+'/functions/v1/provider-oauth/callback';
const APP='https://www.vorlen.co.uk/dashboard/partner-management';
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const providers:any={
 google_calendar:{mode:'authorization_code',auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scopes:'openid email https://www.googleapis.com/auth/calendar.events',test:'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&singleEvents=true'},
 microsoft_calendar:{mode:'pkce',scopes:'openid profile email offline_access User.Read Calendars.ReadWrite',test:'https://graph.microsoft.com/v1.0/me/calendar'},
 linkedin:{mode:'authorization_code',auth:'https://www.linkedin.com/oauth/v2/authorization',token:'https://www.linkedin.com/oauth/v2/accessToken',scopes:'openid profile email',test:'https://api.linkedin.com/v2/userinfo'}
};

function allowedOrigin(req:Request){const o=req.headers.get('origin')||'';return ['https://www.vorlen.co.uk','https://vorlen.co.uk','http://localhost:5173'].includes(o)?o:'https://www.vorlen.co.uk'}
function cors(req:Request){return {'Access-Control-Allow-Origin':allowedOrigin(req),'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'}}
function json(req:Request,x:any,status=200){return new Response(JSON.stringify(x),{status,headers:{...cors(req),'Content-Type':'application/json'}})}
function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomString(n=48){const b=new Uint8Array(n);crypto.getRandomValues(b);return b64url(b)}
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return b64url(new Uint8Array(b))}
function redirect(provider:string,result:string,message=''){const u=new URL(APP);u.searchParams.set('integration',provider);u.searchParams.set('oauth',result);if(message)u.searchParams.set('message',message.slice(0,180));return Response.redirect(u.toString(),302)}
async function manager(req:Request){
 const h=req.headers.get('authorization')||'';if(!h.startsWith('Bearer '))throw Object.assign(new Error('Authentication required'),{status:401});
 const jwt=h.slice(7);const{data,error}=await admin.auth.getUser(jwt);if(error||!data.user)throw Object.assign(new Error('Authentication required'),{status:401});
 const{data:p,error:pe}=await admin.from('profiles').select('id,company_id,role').eq('id',data.user.id).single();
 if(pe||!p||!['owner','manager'].includes(p.role))throw Object.assign(new Error('Manager access required'),{status:403});
 return p;
}
async function material(company:string,provider:string){const{data,error}=await admin.rpc('internal_provider_oauth_material',{p_company:company,p_provider:provider});if(error)throw error;return data}
async function tokenMaterial(company:string,provider:string){const{data,error}=await admin.rpc('internal_provider_oauth_tokens',{p_company:company,p_provider:provider});if(error)throw error;return data}
function microsoftEndpoints(tenant?:string){const t=(tenant||'organizations').trim()||'organizations';return{auth:`https://login.microsoftonline.com/${encodeURIComponent(t)}/oauth2/v2.0/authorize`,token:`https://login.microsoftonline.com/${encodeURIComponent(t)}/oauth2/v2.0/token`}}
async function exchange(provider:string,code:string,state:any,mat:any){
 const p=providers[provider];const endpoints=provider==='microsoft_calendar'?microsoftEndpoints(mat.tenant_id):p;
 const body=new URLSearchParams({grant_type:'authorization_code',code,client_id:mat.client_id,redirect_uri:CALLBACK});
 if(mat.client_secret)body.set('client_secret',mat.client_secret);
 if(state.code_verifier)body.set('code_verifier',state.code_verifier);
 if(provider==='microsoft_calendar')body.set('scope',String(mat.public_config?.oauth_scopes||p.scopes));
 const r=await fetch(endpoints.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(20000)});
 const x=await r.json().catch(()=>({}));
 if(!r.ok||!x.access_token)throw new Error('Token exchange failed: '+(x.error_description||x.error||r.status));
 return x;
}
async function accountLabel(provider:string,access:string){
 try{
  if(provider==='google_calendar'){const r=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(12000)});if(r.ok){const x=await r.json();return x.email||x.name||''}}
  if(provider==='microsoft_calendar'){const r=await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(12000)});if(r.ok){const x=await r.json();return x.mail||x.userPrincipalName||x.displayName||''}}
  if(provider==='linkedin'){const r=await fetch('https://api.linkedin.com/v2/userinfo',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(12000)});if(r.ok){const x=await r.json();return x.email||x.name||x.sub||''}}
 }catch{}
 return '';
}
async function refresh(provider:string,company:string,t:any){
 const p=providers[provider];if(!t.refresh_token)throw new Error('Provider session requires reconnection');
 const pc=t.public_config||{};const endpoints=provider==='microsoft_calendar'?microsoftEndpoints(pc.tenant_id):p;
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:t.refresh_token,client_id:pc.client_id||''});
 if(t.client_secret)body.set('client_secret',t.client_secret);
 if(provider==='microsoft_calendar')body.set('scope',String(pc.oauth_scopes||p.scopes));
 const r=await fetch(endpoints.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(20000)});
 const x=await r.json().catch(()=>({}));
 if(!r.ok||!x.access_token)throw new Error('Token refresh failed: '+(x.error_description||x.error||r.status));
 const expires=new Date(Date.now()+Number(x.expires_in||3600)*1000).toISOString();
 const{error}=await admin.rpc('internal_provider_oauth_store_tokens',{p_company:company,p_provider:provider,p_access_token:x.access_token,p_refresh_token:x.refresh_token||'',p_expires_at:expires,p_scopes:x.scope||pc.granted_scopes||'',p_account_label:pc.connected_account||''});
 if(error)throw error;return x.access_token;
}
async function currentAccess(provider:string,company:string){
 const t=await tokenMaterial(company,provider);if(!t.access_token)throw new Error('No OAuth access token is stored');
 const exp=t.public_config?.token_expires_at?new Date(t.public_config.token_expires_at).getTime():0;
 if(exp&&exp>Date.now()+60000)return t.access_token;
 return await refresh(provider,company,t);
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
 const url=new URL(req.url),isCallback=req.method==='GET'&&url.pathname.endsWith('/callback');
 if(isCallback){
  const stateRaw=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'',providerError=url.searchParams.get('error');if(!stateRaw)return redirect('unknown','error','Missing OAuth state');
  let state:any=null;
  try{
   const stateHash=await sha256(stateRaw);const{data,error}=await admin.rpc('internal_provider_oauth_consume',{p_state_hash:stateHash});if(error)throw error;state=data;
   const provider=state.provider;if(providerError)throw new Error(url.searchParams.get('error_description')||providerError);if(!code)throw new Error('Authorization code was not returned');
   const mat=await material(state.company_id,provider);if(!mat?.client_id||!mat?.client_secret)throw new Error('OAuth application credentials are incomplete');
   const token=await exchange(provider,code,state,mat);const label=await accountLabel(provider,token.access_token);const expires=new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString();
   const{error:saveError}=await admin.rpc('internal_provider_oauth_store_tokens',{p_company:state.company_id,p_provider:provider,p_access_token:token.access_token,p_refresh_token:token.refresh_token||'',p_expires_at:expires,p_scopes:token.scope||providers[provider].scopes,p_account_label:label});if(saveError)throw saveError;
   await admin.rpc('internal_provider_oauth_cleanup',{p_state_id:state.id});return redirect(provider,'success','Connected'+(label?' as '+label:''));
  }catch(e){if(state?.id)await admin.rpc('internal_provider_oauth_cleanup',{p_state_id:state.id});return redirect(state?.provider||'unknown','error',e instanceof Error?e.message:'OAuth connection failed')}
 }
 if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
 try{
  const me=await manager(req),body=await req.json().catch(()=>({})),action=String(body.action||''),provider=String(body.provider||''),p=providers[provider];
  if(!p)return json(req,{error:'This provider does not support an OAuth connection from Vorlen.'},400);
  if(action==='start'){
   const mat=await material(me.company_id,provider);if(!mat?.client_id||!mat?.client_secret)return json(req,{error:'Save the provider OAuth client ID and client secret before connecting.'},409);
   const rawState=randomString(32),stateHash=await sha256(rawState);let verifier:string|null=null,codeChallenge:string|null=null;
   if(p.mode==='pkce'){verifier=randomString(64);codeChallenge=await sha256(verifier)}
   const{error:stateError}=await admin.rpc('internal_provider_oauth_begin',{p_company:me.company_id,p_provider:provider,p_user:me.id,p_state_hash:stateHash,p_code_verifier:verifier});if(stateError)throw stateError;
   const endpoints=provider==='microsoft_calendar'?microsoftEndpoints(mat.tenant_id):p;const a=new URL(endpoints.auth);
   a.searchParams.set('response_type','code');a.searchParams.set('client_id',mat.client_id);a.searchParams.set('redirect_uri',CALLBACK);a.searchParams.set('state',rawState);a.searchParams.set('scope',String(mat.public_config?.oauth_scopes||p.scopes));
   if(provider==='google_calendar'){a.searchParams.set('access_type','offline');a.searchParams.set('include_granted_scopes','true');a.searchParams.set('prompt','consent')}
   if(codeChallenge){a.searchParams.set('code_challenge',codeChallenge);a.searchParams.set('code_challenge_method','S256')}
   return json(req,{authorization_url:a.toString(),callback_url:CALLBACK,pkce:p.mode==='pkce'});
  }
  if(action==='test'){
   const access=await currentAccess(provider,me.company_id);const tm=await tokenMaterial(me.company_id,provider),endpoint=String(tm.public_config?.test_url||p.test);
   const r=await fetch(endpoint,{headers:{Authorization:'Bearer '+access,Accept:'application/json'},signal:AbortSignal.timeout(15000)});const msg=r.ok?'Connection verified':'Provider returned HTTP '+r.status;
   await admin.rpc('internal_provider_oauth_test_result',{p_company:me.company_id,p_provider:provider,p_ok:r.ok,p_result:msg});
   return json(req,{ok:r.ok,message:msg},r.ok?200:502);
  }
  return json(req,{error:'Unknown action'},400);
 }catch(e){const m=e instanceof Error?e.message:'Provider OAuth failed';console.error('provider-oauth',m);return json(req,{error:m},(e as any)?.status||500)}
});