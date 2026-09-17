import {useEffect,useState} from 'react';
import {Link,Navigate,useLocation} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {hasFeature} from '../lib/entitlements.mjs';
export function WorkspaceGate({children}:{children:React.ReactNode}) {
 const {pathname}=useLocation();const [state,setState]=useState<any>(null);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;setState(null);setError('');(async()=>{
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError)throw authError;
 if(!user){if(alive)setState({login:true});return;}
 const p=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();if(p.error)throw p.error;
 if(!p.data){if(alive)setState({onboard:true});return;}
 const s=await supabase.rpc('current_subscription_snapshot');if(s.error)throw s.error;
 if(alive)setState({role:p.data.role,subscription:s.data});
 })().catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[pathname]);
 if(error)return <main className="page"><h1>We could not open your workspace</h1><p role="alert">{error}</p><button onClick={()=>location.reload()}>Try again</button></main>;
 if(!state)return <div className="page" role="status">Opening your workspace…</div>;
 if(state.login)return <Navigate to="/login" replace/>;
 if(state.onboard)return <Navigate to="/onboarding" replace/>;
 if(state.role==='viewer'&&pathname.startsWith('/dashboard'))return <Navigate to="/client" replace/>;
 if(pathname==='/client'&&!hasFeature(state.subscription,'client_portal'))return <main className="page"><h1>Client access is temporarily unavailable</h1><p>Please contact your recruitment team.</p></main>;
 if(pathname==='/dashboard/automations'&&!hasFeature(state.subscription,'automations'))return <main className="page"><h1>Automated follow-ups</h1><p>Automations require an active Growth or Scale subscription. Your existing records remain available.</p><Link className="btn" to="/dashboard/billing">View your plan</Link></main>;
 return <>{children}</>;
}
