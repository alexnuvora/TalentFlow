import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'https://www.vorlen.co.uk',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
};
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const CALLBACK=SUPABASE_URL+'/functions/v1/integration-oauth/callback';
const APP_ORIGIN='https://www.vorlen.co.uk';
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

type Provider='google_calendar'|'microsoft_calendar'|'linkedin';
const supported=new Set<Provider>(['google_calendar','microsoft_calendar','linkedin']);

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})}
function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomUrlSafe(size=48){const b=new Uint8Array(size);crypto.getRandomValues(b);return b64url(b)}
async function sha256(value:string){return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
function safePath(value:unknown){const p=String(value||'/dashboard/partner-management');return p.startsWith('/')&&!p.startsWith('//')?p:'/dashboard/partner-management'}
function redirect(path:string,provider:string,result:string,message=''){const u=new URL(safePath(path),APP_ORIGIN);u.searchParams.set('integration',provider);u.searchParams.set('oauth',result);if(message)u.searchParams.set('message',message.slice(0,180));return Response.redirect(u.toString(),303)}

async function caller(req:Request){
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))throw new Error('Authentication required');
 const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const{data:{user},error:ue}=await userClient.auth.getUser();
 if(ue||!user)throw new Error('Authentication required');
 const{data:profile,error:pe}=await userClient.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(pe||!profile||!['owner','manager'].includes(profile.role))throw new Error('Manager access required');
 return{user,profile};
}

async function appConfig(company:string,provider:Provider){
 const{data,error}=await admin.rpc('integration_oauth_app_config',{p_company:company,p_provider:provider});
 if(error)throw new Error('Provider app configuration unavailable: '+error.message);
 const cfg=data as any;
 const clientId=String(cfg?.public_config?.client_id||'').trim();
 const clientSecret=String(cfg?.client_secret||'').trim();
 if(!clientId||!clientSecret)throw new Error('Save the OAuth client ID and client secret before connecting this provider.');
 return{clientId,clientSecret,publicConfig:cfg.public_config||{}};
}

function providerMeta(provider:Provider,cfg:any){
 if(provider==='microsoft_calendar'){
   const tenant=String(cfg.publicConfig?.tenant_id||'common').trim()||'common';
   return{
     authorize:'https://login.microsoftonline.com/'+encodeURIComponent(tenant)+'/oauth2/v2.0/authorize',
     token:'https://login.microsoftonline.com/'+encodeURIComponent(tenant)+'/oauth2/v2.0/token',
     scopes:['openid','profile','offline_access','User.Read','Calendars.ReadWrite'],
     pkce:true,
   };
 }
 if(provider==='google_calendar')return{
   authorize:'https://accounts.google.com/o/oauth2/v2/auth',
   token:'https://oauth2.googleapis.com/token',
   scopes:['openid','email','profile','https://www.googleapis.com/auth/calendar.events'],
   pkce:false,
 };
 return{
   authorize:'https://www.linkedin.com/oauth/v2/authorization',
   token:'https://www.linkedin.com/oauth/v2/accessToken',
   scopes:['openid','profile','email'],
   pkce:false,
 };
}

async function verify(provider:Provider,access:string){
 const h={Authorization:'Bearer '+access,'Accept':'application/json'};
 if(provider==='microsoft_calendar'){
   const r=await fetch('https://graph.microsoft.com/v1.0/me/calendar?$select=id,name',{headers:h,signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('Microsoft Graph calendar test failed ('+r.status+')');
   const x=await r.json();return{id:String(x.id||''),label:String(x.name||'Microsoft 365 Calendar')};
 }
 if(provider==='google_calendar'){
   const [u,c]=await Promise.all([
     fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:h,signal:AbortSignal.timeout(15000)}),
     fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&singleEvents=true',{headers:h,signal:AbortSignal.timeout(15000)})
   ]);
   if(!u.ok)throw new Error('Google account verification failed ('+u.status+')');
   if(!c.ok)throw new Error('Google Calendar test failed ('+c.status+')');
   const x=await u.json();return{id:String(x.sub||''),label:String(x.email||x.name||'Google Calendar')};
 }
 const r=await fetch('https://api.linkedin.com/v2/userinfo',{headers:{...h,'LinkedIn-Version':'202609'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('LinkedIn identity test failed ('+r.status+')');
 const x=await r.json();return{id:String(x.sub||''),label:String(x.email||x.name||'LinkedIn')};
}

async function refresh(provider:Provider,company:string,tokens:any){
 const cfg=await appConfig(company,provider),meta=providerMeta(provider,cfg);
 if(!tokens?.refresh_token)throw new Error('No refresh token is available. Reconnect the provider.');
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:String(tokens.refresh_token),client_id:cfg.clientId,client_secret:cfg.clientSecret});
 if(provider==='microsoft_calendar')body.set('scope',meta.scopes.join(' '));
 const r=await fetch(meta.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body,signal:AbortSignal.timeout(20000)});
 const raw=await r.text();let x:any={};try{x=JSON.parse(raw)}catch{}
 if(!r.ok||!x.access_token)throw new Error('Provider token refresh failed ('+r.status+')');
 return x;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const url=new URL(req.url);
 const isCallback=req.method==='GET'&&url.pathname.endsWith('/callback');
 try{
  if(isCallback){
    const state=url.searchParams.get('state')||'';
    if(!state)return redirect('/dashboard/partner-management','unknown','error','Missing OAuth state.');
    const stateHash=await sha256(state);
    const{data:st,error:se}=await admin.rpc('integration_oauth_consume_state',{p_state_hash:stateHash});
    if(se||!st)return redirect('/dashboard/partner-management','unknown','error','The OAuth request expired or was already used.');
    const provider=String(st.provider) as Provider;
    if(!supported.has(provider))return redirect(st.redirect_after,provider,'error','Unsupported provider.');
    const providerError=url.searchParams.get('error');
    if(providerError)return redirect(st.redirect_after,provider,'error',url.searchParams.get('error_description')||providerError);
    const code=url.searchParams.get('code');
    if(!code)return redirect(st.redirect_after,provider,'error','Provider did not return an authorization code.');
    const cfg=await appConfig(String(st.company_id),provider),meta=providerMeta(provider,cfg);
    const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:CALLBACK,client_id:cfg.clientId,client_secret:cfg.clientSecret});
    if(meta.pkce)body.set('code_verifier',String(st.verifier||''));
    const tr=await fetch(meta.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body,signal:AbortSignal.timeout(20000)});
    const raw=await tr.text();let tok:any={};try{tok=JSON.parse(raw)}catch{}
    if(!tr.ok||!tok.access_token)return redirect(st.redirect_after,provider,'error','Token exchange failed ('+tr.status+').');
    let acct;
    try{acct=await verify(provider,String(tok.access_token))}catch(e){return redirect(st.redirect_after,provider,'error',e instanceof Error?e.message:'Connection test failed.')}
    const expires=tok.expires_in?new Date(Date.now()+Number(tok.expires_in)*1000).toISOString():null;
    const scopes=String(tok.scope||meta.scopes.join(' ')).split(/\s+/).filter(Boolean);
    const{error:storeErr}=await admin.rpc('integration_oauth_store_tokens',{
      p_company:st.company_id,p_provider:provider,p_user:st.initiated_by,p_access_token:String(tok.access_token),
      p_refresh_token:String(tok.refresh_token||''),p_token_type:String(tok.token_type||'Bearer'),p_expires_at:expires,
      p_scopes:scopes,p_account_id:acct.id||null,p_account_label:acct.label||null
    });
    if(storeErr)return redirect(st.redirect_after,provider,'error','Secure token storage failed.');
    return redirect(st.redirect_after,provider,'connected','Connection verified successfully.');
  }

  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const{user,profile}=await caller(req);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||'');
  const provider=String(body.provider||'') as Provider;
  if(!supported.has(provider))return json({error:'OAuth provider not supported'},400);

  if(action==='start'){
    const cfg=await appConfig(profile.company_id,provider),meta=providerMeta(provider,cfg);
    const state=randomUrlSafe(32),verifier=randomUrlSafe(64),challenge=await sha256(verifier),stateHash=await sha256(state);
    const{error:ce}=await admin.rpc('integration_oauth_create_state',{
      p_company:profile.company_id,p_provider:provider,p_user:user.id,p_state_hash:stateHash,p_verifier:verifier,
      p_redirect_after:safePath(body.redirect_after),p_minutes:10
    });
    if(ce)throw new Error('Could not create OAuth state: '+ce.message);
    const a=new URL(meta.authorize);
    a.searchParams.set('response_type','code');a.searchParams.set('client_id',cfg.clientId);a.searchParams.set('redirect_uri',CALLBACK);
    a.searchParams.set('state',state);a.searchParams.set('scope',meta.scopes.join(' '));
    if(meta.pkce){a.searchParams.set('code_challenge',challenge);a.searchParams.set('code_challenge_method','S256')}
    if(provider==='google_calendar'){a.searchParams.set('access_type','offline');a.searchParams.set('include_granted_scopes','true');a.searchParams.set('prompt','consent')}
    return json({authorization_url:a.toString(),pkce:meta.pkce,callback_url:CALLBACK});
  }

  if(action==='status'){
    const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:req.headers.get('authorization')||''}},auth:{persistSession:false,autoRefreshToken:false}});
    const{data,error}=await userClient.rpc('integration_oauth_status',{p_provider:provider});
    if(error)throw error;return json(data);
  }

  if(action==='test'){
    const{data:stored,error:re}=await admin.rpc('integration_oauth_read_tokens',{p_company:profile.company_id,p_provider:provider});
    if(re||!stored)return json({error:'Provider is not connected.'},409);
    let access=String(stored.access_token||''),refreshToken=String(stored.refresh_token||'');
    const exp=stored.expires_at?new Date(stored.expires_at).getTime():0;
    if(exp&&exp<Date.now()+60000){
      const rt=await refresh(provider,profile.company_id,stored);
      access=String(rt.access_token);refreshToken=String(rt.refresh_token||refreshToken);
      const cfg=await appConfig(profile.company_id,provider),meta=providerMeta(provider,cfg);
      const acct=await verify(provider,access);
      const expires=rt.expires_in?new Date(Date.now()+Number(rt.expires_in)*1000).toISOString():null;
      const{error:se}=await admin.rpc('integration_oauth_store_tokens',{
        p_company:profile.company_id,p_provider:provider,p_user:user.id,p_access_token:access,p_refresh_token:refreshToken,
        p_token_type:String(rt.token_type||stored.token_type||'Bearer'),p_expires_at:expires,
        p_scopes:String(rt.scope||((stored.scopes||[]) as string[]).join(' ')||meta.scopes.join(' ')).split(/\s+/).filter(Boolean),
        p_account_id:acct.id||stored.account_id||null,p_account_label:acct.label||stored.account_label||null
      });
      if(se)throw se;return json({ok:true,account:acct,refreshed:true});
    }
    const acct=await verify(provider,access);
    return json({ok:true,account:acct,refreshed:false});
  }

  if(action==='disconnect'){
    const{data:stored}=await admin.rpc('integration_oauth_read_tokens',{p_company:profile.company_id,p_provider:provider});
    if(stored?.access_token&&provider==='google_calendar'){
      await fetch('https://oauth2.googleapis.com/revoke?token='+encodeURIComponent(String(stored.access_token)),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(10000)}).catch(()=>null);
    }
    const{error:de}=await admin.rpc('integration_oauth_disconnect_service',{p_company:profile.company_id,p_provider:provider});
    if(de)throw de;return json({ok:true});
  }
  return json({error:'Unknown action'},400);
 }catch(e){
  console.error('integration-oauth',e instanceof Error?e.message:String(e));
  return json({error:e instanceof Error?e.message:'Integration OAuth failed'},500);
 }
});