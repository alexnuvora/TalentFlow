create or replace function private.finalise_partner_placement_workflow()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_client_delivery_partner uuid;v_client_commission_partner uuid;v_candidate_delivery_partner uuid;v_candidate_commission_partner uuid;v_due timestamptz;
begin
 select pa.partner_id into v_client_delivery_partner from public.partner_attributions pa
 join public.partner_profiles pp on pp.user_id=pa.partner_id and pp.company_id=pa.company_id and pp.active
 join public.partner_onboarding po on po.partner_id=pa.partner_id and po.company_id=pa.company_id and po.status='active'
 where pa.company_id=new.company_id and pa.job_id=new.job_id and pa.attribution_type='vacancy_originator' and pa.status='active' and pp.specialism in ('lead_closer','hybrid')
 order by pa.attributed_at asc limit 1;

 select vo.partner_id into v_client_commission_partner from public.partner_attributions vo
 join public.partner_attributions co on co.company_id=vo.company_id and co.partner_id=vo.partner_id and co.client_id=new.client_id and co.attribution_type='client_originator' and co.status='active'
 join public.partner_profiles pp on pp.user_id=vo.partner_id and pp.company_id=vo.company_id and pp.active
 join public.partner_onboarding po on po.partner_id=vo.partner_id and po.company_id=vo.company_id and po.status='active'
 join public.partner_agreements ag on ag.partner_id=vo.partner_id and ag.company_id=vo.company_id and ag.version='partner-2026-09-26-split-v2' and ag.commission_model='split_15_15' and ag.status='accepted' and ag.accepted_at is not null and ag.accepted_terms_hash=ag.terms_hash
 where vo.company_id=new.company_id and vo.job_id=new.job_id and vo.attribution_type='vacancy_originator' and vo.status='active' and pp.specialism in ('lead_closer','hybrid')
 order by vo.attributed_at asc limit 1;
 if v_client_commission_partner is not null and not exists(select 1 from public.partner_attributions a where a.company_id=new.company_id and a.placement_id=new.id and a.attribution_type='client_commission_owner' and a.status='active') then
  insert into public.partner_attributions(company_id,partner_id,placement_id,attribution_type,evidence,attributed_by) values(new.company_id,v_client_commission_partner,new.id,'client_commission_owner','Automatically carried forward because the same eligible partner is the verified client originator and vacancy originator.',auth.uid());
 end if;

 select pa.partner_id into v_candidate_delivery_partner from public.partner_attributions pa
 join public.partner_profiles pp on pp.user_id=pa.partner_id and pp.company_id=pa.company_id and pp.active
 join public.partner_onboarding po on po.partner_id=pa.partner_id and po.company_id=pa.company_id and po.status='active'
 where pa.company_id=new.company_id and pa.candidate_id=new.candidate_id and pa.attribution_type='candidate_originator' and pa.status='active' and pp.specialism in ('candidate_sourcer','hybrid')
 order by pa.attributed_at asc limit 1;

 select pa.partner_id into v_candidate_commission_partner from public.partner_attributions pa
 join public.partner_profiles pp on pp.user_id=pa.partner_id and pp.company_id=pa.company_id and pp.active
 join public.partner_onboarding po on po.partner_id=pa.partner_id and po.company_id=pa.company_id and po.status='active'
 join public.partner_agreements ag on ag.partner_id=pa.partner_id and ag.company_id=pa.company_id and ag.version='partner-2026-09-26-split-v2' and ag.commission_model='split_15_15' and ag.status='accepted' and ag.accepted_at is not null and ag.accepted_terms_hash=ag.terms_hash
 where pa.company_id=new.company_id and pa.candidate_id=new.candidate_id and pa.attribution_type='candidate_originator' and pa.status='active' and pp.specialism in ('candidate_sourcer','hybrid')
 order by pa.attributed_at asc limit 1;
 if v_candidate_commission_partner is not null and not exists(select 1 from public.partner_attributions a where a.company_id=new.company_id and a.placement_id=new.id and a.attribution_type='candidate_commission_owner' and a.status='active') then
  insert into public.partner_attributions(company_id,partner_id,placement_id,attribution_type,evidence,attributed_by) values(new.company_id,v_candidate_commission_partner,new.id,'candidate_commission_owner','Automatically carried forward from the verified eligible candidate originator when the placement was recorded.',auth.uid());
 end if;

 update public.partner_candidate_offers set placement_review_status='completed',placement_id=new.id,updated_at=now()
 where company_id=new.company_id and candidate_id=new.candidate_id and job_id=new.job_id and status='accepted' and placement_review_status in ('requested','under_review');
 v_due:=coalesce(new.start_date::timestamptz,now()+interval '1 day');

 if v_candidate_delivery_partner is not null then
  if not exists(select 1 from public.partner_tasks t where t.company_id=new.company_id and t.partner_id=v_candidate_delivery_partner and t.candidate_id=new.candidate_id and t.job_id=new.job_id and t.title='Candidate placement start-date check-in' and t.status in ('open','in_progress')) then insert into public.partner_tasks(company_id,partner_id,candidate_id,job_id,title,description,task_type,due_at,priority) values(new.company_id,v_candidate_delivery_partner,new.candidate_id,new.job_id,'Candidate placement start-date check-in','Confirm the candidate is still on track to start and record any issue immediately.','follow_up',v_due,'high');end if;
  if not exists(select 1 from public.partner_tasks t where t.company_id=new.company_id and t.partner_id=v_candidate_delivery_partner and t.candidate_id=new.candidate_id and t.job_id=new.job_id and t.title='Candidate first-week aftercare' and t.status in ('open','in_progress')) then insert into public.partner_tasks(company_id,partner_id,candidate_id,job_id,title,description,task_type,due_at,priority) values(new.company_id,v_candidate_delivery_partner,new.candidate_id,new.job_id,'Candidate first-week aftercare','Check how the placement is progressing after the first week and record the outcome.','follow_up',v_due+interval '7 days','normal');end if;
 end if;
 if v_client_delivery_partner is not null then
  if not exists(select 1 from public.partner_tasks t where t.company_id=new.company_id and t.partner_id=v_client_delivery_partner and t.client_id=new.client_id and t.job_id=new.job_id and t.title='Client placement start check-in' and t.status in ('open','in_progress')) then insert into public.partner_tasks(company_id,partner_id,client_id,job_id,title,description,task_type,due_at,priority) values(new.company_id,v_client_delivery_partner,new.client_id,new.job_id,'Client placement start check-in','Confirm the successful candidate has started as expected and record any client issue.','follow_up',v_due,'high');end if;
  if not exists(select 1 from public.partner_tasks t where t.company_id=new.company_id and t.partner_id=v_client_delivery_partner and t.client_id=new.client_id and t.job_id=new.job_id and t.title='Client first-week placement aftercare' and t.status in ('open','in_progress')) then insert into public.partner_tasks(company_id,partner_id,client_id,job_id,title,description,task_type,due_at,priority) values(new.company_id,v_client_delivery_partner,new.client_id,new.job_id,'Client first-week placement aftercare','Check client satisfaction after the first week and record any guarantee-period concern.','follow_up',v_due+interval '7 days','normal');end if;
 end if;
 return new;
end$$;
revoke all on function private.finalise_partner_placement_workflow() from public,anon,authenticated;