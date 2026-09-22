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
  isOwner:boolean;
  canUseAutomations:boolean;
  canUseAiScreening:boolean;
  canUseClientPortal:boolean;
  candidateProcessingActive:boolean;
  candidateDataApproved:boolean;
  canAccessCandidateData:boolean;
  refresh:()=>Promise<void>;
};

export function useWorkspaceAccess():WorkspaceAccess{
  const[loading,setLoading]=useState(true),[error,setError]=useState(''),[role,setRole]=useState(''),[companyId,setCompanyId]=useState<string|null>(null),[subscription,setSubscription]=useState<any>(null),[candidateProcessingActive,setCandidateProcessingActive]=useState(false),[candidateDataApproved,setCandidateDataApproved]=useState(false);
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const{data:{session},error:sessionError}=await supabase.auth.getSession();
      const user=session?.user||null;
      if(sessionError||!user){setRole('');setCompanyId(null);setSubscription(null);setCandidateProcessingActive(false);setCandidateDataApproved(false);setError(sessionError?.message||'Your session has expired. Please sign in again.');return}
      const p=await supabase.from('profiles').select('role,company_id').eq('id',user.id).limit(1).maybeSingle();
      if(p.error){setRole('');setCompanyId(null);setSubscription(null);setCandidateProcessingActive(false);setCandidateDataApproved(false);setError(p.error.message);return}
      if(!p.data){setRole('');setCompanyId(null);setSubscription(null);setCandidateProcessingActive(false);setCandidateDataApproved(false);setError('Your workspace profile is not available yet. Complete onboarding or contact a workspace owner.');return}
      setRole(p.data.role||'');setCompanyId(p.data.company_id||null);
      const [candidatePhase,candidateApproval,s]=await Promise.all([supabase.rpc('candidate_processing_allowed',{p_company_id:p.data.company_id}),supabase.rpc('has_candidate_data_access'),supabase.rpc('current_subscription_snapshot')]);
      setCandidateProcessingActive(candidatePhase.data===true);
      setCandidateDataApproved(candidateApproval.data===true);
      if(s.error){setSubscription(null);setError(`Plan information is temporarily unavailable: ${s.error.message}`)}else setSubscription(s.data||null);
    }catch(e){setError(e instanceof Error?e.message:'Workspace access could not be loaded.')}finally{setLoading(false)}
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  const active=['active','trialing'].includes(subscription?.status);
  const features=subscription?.features||{};
  const isOwner=role==='owner';
  const canManageWorkspace=['owner','manager'].includes(role);
  const canAccessCandidateData=candidateProcessingActive&&candidateDataApproved;
  return{loading,error,role,companyId,subscription,canManageWorkspace,canManageBilling:isOwner,isOwner,canUseAutomations:active&&features.automations===true,canUseAiScreening:active&&features.ai_screening===true&&canAccessCandidateData,canUseClientPortal:active&&features.client_portal===true,candidateProcessingActive,candidateDataApproved,canAccessCandidateData,refresh};
}
