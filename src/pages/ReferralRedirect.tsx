import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {publicSupabase} from '../lib/supabase';
import {referralId,referralDestination} from '../lib/referralLinks';
export default function ReferralRedirect(){
 const {code}=useParams();const [status,setStatus]=useState<'loading'|'missing'|'error'>('loading');
 useEffect(()=>{let cancelled=false;setStatus('loading');void(async()=>{try{
 const id=referralId(code||'');if(!id){if(!cancelled)setStatus('missing');return}
 const {data:l,error:le}=await publicSupabase.from('campaign_links').select('id,campaign_id,slug,source,medium,campaign,content').eq('id',id).eq('active',true).maybeSingle();
 if(cancelled)return;if(le){setStatus('error');return}if(!l){setStatus('missing');return}
 const {data:c,error:ce}=await publicSupabase.from('campaigns').select('slug').eq('id',l.campaign_id).eq('status','active').maybeSingle();
 if(cancelled)return;if(ce){setStatus('error');return}if(!c?.slug){setStatus('missing');return}
 window.location.replace(referralDestination(c,l));
 }catch{if(!cancelled)setStatus('error')}})();return()=>{cancelled=true}},[code]);
 return <main className="public"><div className="card empty"><h2>{status==='loading'?'Opening vacancy…':status==='error'?'Unable to open referral link':'Referral link unavailable'}</h2><p>{status==='loading'?'Please wait.':status==='error'?'Try again or browse current vacancies.':'This referral may be inactive or no longer available.'}</p>{status!=='loading'&&<Link to="/careers">Browse current vacancies</Link>}</div></main>
}
