create or replace function public.approve_ai_governance(p_company uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.current_company_id()<>p_company or not public.is_manager() then raise exception 'Manager access required';end if;
 if exists(select 1 from public.ai_governance_risks where company_id=p_company and (status='blocked' or (residual_risk='high' and status<>'mitigated'))) then raise exception 'High or blocked AI risks must be resolved before DPIA approval';end if;
 if not exists(select 1 from public.ai_governance_reviews where company_id=p_company and review_type='bias' and outcome='pass' and reviewed_at>now()-interval '35 days') then raise exception 'A current passing bias review is required';end if;
 if not exists(select 1 from public.ai_governance_reviews where company_id=p_company and review_type='accuracy' and outcome='pass' and reviewed_at>now()-interval '35 days') then raise exception 'A current passing accuracy review is required';end if;
 if exists(select 1 from public.ai_governance where company_id=p_company and (provider_role='unassessed' or processor_contract_status='unverified' or provider_training_status<>'no_training' or high_residual_risk)) then raise exception 'Provider assessment, no-training assurance and residual-risk assessment must be complete';end if;
 update public.ai_governance set dpia_status='approved',approved_at=now(),approved_by=auth.uid(),last_reviewed_at=now(),next_review_at=now()+interval '90 days',updated_at=now() where company_id=p_company;
end $$;
revoke all on function public.approve_ai_governance(uuid) from public,anon;
grant execute on function public.approve_ai_governance(uuid) to authenticated;
