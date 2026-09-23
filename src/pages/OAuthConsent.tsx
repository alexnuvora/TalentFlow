import {useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {supabase} from '../lib/supabase';

type Details={authorization_id?:string;redirect_url?:string;redirect_uri?:string;scope?:string;client?:{name?:string}};
export default function OAuthConsent(){
 const [params]=useSearchParams(),navigate=useNavigate(); const id=params.get('authorization_id');
 const [details,setDetails]=useState<Details|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{(async()=>{if(!id){setError('Missing authorization request.');return} const {data:{user}}=await supabase.auth.getUser(); if(!user){navigate('/login?redirect='+encodeURIComponent('/oauth/consent?authorization_id='+id),{replace:true});return} const {data,error}=await supabase.auth.oauth.getAuthorizationDetails(id); if(error){setError(error.message);return} const d=data as Details; if(d.redirect_url){window.location.assign(d.redirect_url);return} setDetails(d)})()},[id,navigate]);
 async function decide(approve:boolean){if(!id||busy)return;setBusy(true);setError('');const r=approve?await supabase.auth.oauth.approveAuthorization(id):await supabase.auth.oauth.denyAuthorization(id);if(r.error){setError(r.error.message);setBusy(false);return}if(r.data?.redirect_url)window.location.assign(r.data.redirect_url)}
 if(error)return <main className="auth"><div className="auth-card"><h1>Vorlen authorization</h1><p>{error}</p></div></main>;
 if(!details)return <main className="auth"><div className="auth-card"><p>Loading authorization request…</p></div></main>;
 const scopes=(details.scope||'email').split(' ').filter(Boolean);
 return <main className="auth"><div className="auth-card"><div className="brand"><strong>VORLEN</strong></div><h1>Authorize {details.client?.name||'ChatGPT'}</h1><p>This app is requesting access to your Vorlen workspace.</p><div className="notice"><strong>Requested access</strong><ul>{scopes.map(s=><li key={s}>{s}</li>)}</ul></div><p className="muted">Only approve this request if you started the connection from ChatGPT.</p><div className="form-actions"><button className="btn primary" disabled={busy} onClick={()=>decide(true)}>Approve</button><button className="btn" disabled={busy} onClick={()=>decide(false)}>Deny</button></div></div></main>}
