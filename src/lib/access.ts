import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';

export type WorkspaceAccess={
  loading:boolean;
  error:string;
  role:string;
  companyId:string|null;
  subscription:any;
  canManageWorkspace:boolean;
  canManageBilling:boolean;
  canUseAutomations:boolean;
  canUseAiScreening:boolean;
  canUseClientPortal:boolean;
  refresh:()=>Promise<void>;
};

export function useWorkspaceAccess():WorkspaceAccess{
  const[loading,setLoading]=useState(true),[error,setError]=useState(''),[role,setRole]=useState(''),[companyId,setCompanyId]=useState<string|null>(null),[subscription,setSubscription]=useState<any>(null);
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    const[p,s]=await Promise.all([
      supabase.from('profiles').select('role,company_id').single(),
      supabase.rpc('current_subscription_snapshot')
    ]);
    if(p.error){setError(p.error.message);setLoading(false);return}
    setRole(p.data?.role||'');setCompanyId(p.data?.company_id||null);
    if(s.error)setError(s.error.message);else setSubscription(s.data||null);
    setLoading(false);
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  const active=['active','trialing'].includes(subscription?.status);
  const features=subscription?.features||{};
  const canManageWorkspace=['owner','manager'].includes(role);
  return{loading,error,role,companyId,subscription,canManageWorkspace,canManageBilling:canManageWorkspace,canUseAutomations:active&&features.automations===true,canUseAiScreening:active&&features.ai_screening===true,canUseClientPortal:active&&features.client_portal===true,refresh};
}
