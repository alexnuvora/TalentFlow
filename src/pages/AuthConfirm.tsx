import {useEffect,useState} from 'react';import {useNavigate,useSearchParams} from 'react-router-dom';import {supabase} from '../lib/supabase';import AuthShell from './AuthShell';import {noIndex,setSeo} from '../lib/seo';

export default function AuthConfirm(){
  const nav=useNavigate(),[params]=useSearchParams(),[error,setError]=useState('');
  useEffect(()=>{setSeo({title:'Secure sign in | Vorlen',description:'Completing your secure Vorlen sign in.',path:'/auth/confirm',robots:noIndex});let active=true;(async()=>{
    const token=params.get('token_hash'),type=(params.get('type')||'email') as any,next=params.get('next')||'/client';
    if(!token){if(active)setError('This sign-in link is incomplete. Request a fresh invitation.');return}
    const{data,error}=await supabase.auth.verifyOtp({token_hash:token,type});
    if(error||!data.session){if(active)setError(error?.message||'This sign-in link is invalid or has expired.');return}
    if(next==='/reset-password'){nav('/reset-password',{replace:true});return}
    const{data:p}=await supabase.from('profiles').select('role,client_id').eq('id',data.user?.id).maybeSingle();
    if(!active)return;
    nav(p?.role==='viewer'&&p?.client_id?'/client':p?.role==='partner'?'/dashboard/partner':'/dashboard',{replace:true});
  })();return()=>{active=false}},[nav,params]);
  return <AuthShell eyebrow="SECURE ACCESS" title={error?'Link unavailable':'Signing you in…'} copy={error||'Verifying your one-time secure link and opening your Vorlen workspace.'}>{error&&<div className="form-error" role="alert">{error}</div>}</AuthShell>
}
