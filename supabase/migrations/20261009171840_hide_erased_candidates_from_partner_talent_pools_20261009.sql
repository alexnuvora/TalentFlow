-- Exclude erased candidate memberships from active talent pool snapshots.
CREATE OR REPLACE FUNCTION public.partner_talent_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_company uuid:=private.current_company_id(); result jsonb;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 select jsonb_build_object(
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'partner_sourcing_state',j.partner_sourcing_state,'location',j.location,'client_id',j.client_id,'slug',j.slug) order by j.created_at desc) from public.jobs j where j.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=j.id and a.completed_at is null)),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'full_name',c.full_name,'location',c.location,'stage',c.stage,'resume_path',c.resume_path,'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,'authorisations',c.authorisations) order by c.created_at desc) from public.candidates c where c.company_id=v_company and c.erased_at is null and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null)),'[]'::jsonb),
  'pools',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'members',(select coalesce(jsonb_agg(jsonb_build_object('candidate_id',m.candidate_id,'full_name',c.full_name,'location',c.location)),'[]'::jsonb) from public.partner_talent_pool_members m join public.candidates c on c.id=m.candidate_id and c.erased_at is null where m.pool_id=p.id)) order by p.created_at desc) from public.partner_talent_pools p where p.company_id=v_company and p.partner_id=auth.uid()),'[]'::jsonb),
  'submission_packs',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'job_id',s.job_id,'candidate_id',s.candidate_id,'headline',s.headline,'summary',s.summary,'strengths',s.strengths,'concerns',s.concerns,'status',s.status,'manager_notes',s.manager_notes,'created_at',s.created_at,'candidate_submission_id',s.candidate_submission_id) order by s.updated_at desc) from public.partner_submission_packs s where s.company_id=v_company and s.partner_id=auth.uid()),'[]'::jsonb),
  'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'job_id',s.job_id,'candidate_id',s.candidate_id,'status',s.status,'client_decision',s.client_decision,'client_feedback',s.client_feedback,'client_rating',s.client_rating,'submitted_at',s.submitted_at,'client_decision_at',s.client_decision_at) order by coalesce(s.submitted_at,s.created_at) desc) from public.candidate_submissions s where s.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=s.job_id and a.completed_at is null)),'[]'::jsonb),
  'interviews',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'job_id',i.job_id,'candidate_id',i.candidate_id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,'meeting_url',i.meeting_url,'status',i.status,'recruiter_notes',i.recruiter_notes) order by i.scheduled_at desc) from public.interviews i where i.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and (a.job_id=i.job_id or a.candidate_id=i.candidate_id) and a.completed_at is null)),'[]'::jsonb),
  'assessment_templates',coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.candidate_assessment_templates t where t.company_id=v_company and t.active),'[]'::jsonb),
  'assessment_results',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.candidate_assessment_results r where r.company_id=v_company and r.assessor_id=auth.uid()),'[]'::jsonb),
  'integrations',coalesce((select jsonb_agg(to_jsonb(i) order by i.category,i.display_name) from public.recruitment_integrations i where i.company_id=v_company),'[]'::jsonb),
  'distribution_requests',coalesce((select jsonb_agg(to_jsonb(d) order by d.requested_at desc) from public.job_distribution_requests d where d.company_id=v_company and d.requested_by=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end
$function$
;
