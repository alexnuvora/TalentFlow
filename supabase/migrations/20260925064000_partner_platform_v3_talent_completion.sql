
-- Partner Platform V3 completion: talent snapshot, safe CV enrichment, vacancy conversion and native distribution lifecycle.

create or replace function public.partner_apply_candidate_enrichment(
  p_candidate uuid,
  p_location text default null,
  p_experience_summary text default null,
  p_training_qualifications text default null,
  p_authorisations text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Assigned candidate required'; end if;
 update public.candidates
 set location=case when nullif(btrim(coalesce(p_location,'')),'') is not null then btrim(p_location) else location end,
     experience_summary=case when nullif(btrim(coalesce(p_experience_summary,'')),'') is not null then btrim(p_experience_summary) else experience_summary end,
     training_qualifications=case when nullif(btrim(coalesce(p_training_qualifications,'')),'') is not null then btrim(p_training_qualifications) else training_qualifications end,
     authorisations=case when nullif(btrim(coalesce(p_authorisations,'')),'') is not null then btrim(p_authorisations) else authorisations end
 where id=p_candidate and company_id=v_company;
 insert into public.partner_communication_events(company_id,partner_id,candidate_id,event_type,channel,direction,summary,metadata)
 values(v_company,auth.uid(),p_candidate,'system','internal','internal','Applied recruiter-reviewed CV enrichment to candidate profile',jsonb_build_object('source','ai_resume_parse','human_confirmed',true));
end $$;

create or replace function public.manager_convert_client_vacancy_request(
  p_request uuid
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_req public.client_vacancy_requests%rowtype; v_client public.clients%rowtype; v_job uuid; v_slug text;
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 select * into v_req from public.client_vacancy_requests where id=p_request and company_id=v_company for update;
 if not found then raise exception 'Vacancy request not found'; end if;
 if v_req.status='converted' and v_req.approved_job_id is not null then return v_req.approved_job_id; end if;
 if v_req.status<>'approved' then raise exception 'Vacancy request must be approved before conversion'; end if;
 select * into v_client from public.clients where id=v_req.client_id and company_id=v_company;
 if not found then raise exception 'Client not found'; end if;
 if v_client.terms_accepted_at is null then raise exception 'Client Terms of Business must be accepted before a vacancy request can become an active recruitment instruction'; end if;
 v_slug:=trim(both '-' from regexp_replace(lower(v_req.title),'[^a-z0-9]+','-','g'))||'-'||left(replace(v_req.id::text,'-',''),8);
 insert into public.jobs(company_id,client_id,title,slug,description,employment_type,location,salary_min,salary_max,status,requirements,application_mode,genuine_vacancy_confirmed_at,client_instruction_reference)
 values(v_company,v_req.client_id,v_req.title,v_slug,v_req.hiring_need,coalesce(nullif(v_req.employment_type,''),'Permanent'),coalesce(nullif(v_req.location,''),'UK'),v_req.salary_min,v_req.salary_max,'draft','{}'::text[],'apply',now(),'client_portal_request:'||v_req.id::text)
 returning id into v_job;
 update public.client_vacancy_requests set status='converted',approved_job_id=v_job,reviewed_by=auth.uid(),reviewed_at=coalesce(reviewed_at,now()),updated_at=now() where id=v_req.id;
 return v_job;
end $$;

create or replace function public.manager_review_job_distribution(
  p_request uuid,
  p_status text,
  p_external_job_id text default null,
  p_external_url text default null,
  p_error_message text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('queued','published','failed','cancelled','configuration_required') then raise exception 'Invalid distribution status'; end if;
 update public.job_distribution_requests
 set status=p_status,external_job_id=nullif(btrim(coalesce(p_external_job_id,'')),''),external_url=nullif(btrim(coalesce(p_external_url,'')),''),error_message=nullif(btrim(coalesce(p_error_message,'')),''),updated_at=now()
 where id=p_request and company_id=private.current_company_id();
 if not found then raise exception 'Distribution request not found'; end if;
end $$;

create or replace function public.sync_native_vorlen_distribution()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
 if new.status='published' and old.status is distinct from new.status then
   update public.job_distribution_requests
   set status='published',external_job_id=new.id::text,external_url='https://www.vorlen.co.uk/careers/'||new.slug,error_message=null,updated_at=now()
   where company_id=new.company_id and job_id=new.id and provider='vorlen_careers' and status in ('requested','queued','configuration_required');
 end if;
 if new.status in ('closed','archived') and old.status is distinct from new.status then
   update public.job_distribution_requests
   set status='cancelled',updated_at=now()
   where company_id=new.company_id and job_id=new.id and provider='vorlen_careers' and status in ('requested','queued','published');
 end if;
 return new;
end $$;

drop trigger if exists trg_sync_native_vorlen_distribution on public.jobs;
create trigger trg_sync_native_vorlen_distribution
after update of status on public.jobs
for each row execute function public.sync_native_vorlen_distribution();
revoke all on function public.sync_native_vorlen_distribution() from public,anon,authenticated;

create or replace function public.partner_talent_snapshot()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); result jsonb;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 select jsonb_build_object(
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'location',j.location,'client_id',j.client_id,'slug',j.slug) order by j.created_at desc) from public.jobs j where j.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=j.id and a.completed_at is null)),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'full_name',c.full_name,'location',c.location,'stage',c.stage,'resume_path',c.resume_path,'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,'authorisations',c.authorisations) order by c.created_at desc) from public.candidates c where c.company_id=v_company and c.erased_at is null and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null)),'[]'::jsonb),
  'pools',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'members',(select coalesce(jsonb_agg(jsonb_build_object('candidate_id',m.candidate_id,'full_name',c.full_name,'location',c.location)),'[]'::jsonb) from public.partner_talent_pool_members m join public.candidates c on c.id=m.candidate_id where m.pool_id=p.id)) order by p.created_at desc) from public.partner_talent_pools p where p.company_id=v_company and p.partner_id=auth.uid()),'[]'::jsonb),
  'submission_packs',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'job_id',s.job_id,'candidate_id',s.candidate_id,'headline',s.headline,'summary',s.summary,'strengths',s.strengths,'concerns',s.concerns,'status',s.status,'manager_notes',s.manager_notes,'created_at',s.created_at,'candidate_submission_id',s.candidate_submission_id) order by s.updated_at desc) from public.partner_submission_packs s where s.company_id=v_company and s.partner_id=auth.uid()),'[]'::jsonb),
  'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'job_id',s.job_id,'candidate_id',s.candidate_id,'status',s.status,'client_decision',s.client_decision,'client_feedback',s.client_feedback,'submitted_at',s.submitted_at,'client_decision_at',s.client_decision_at) order by coalesce(s.submitted_at,s.created_at) desc) from public.candidate_submissions s where s.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=s.job_id and a.completed_at is null)),'[]'::jsonb),
  'interviews',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'job_id',i.job_id,'candidate_id',i.candidate_id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,'meeting_url',i.meeting_url,'status',i.status,'recruiter_notes',i.recruiter_notes) order by i.scheduled_at desc) from public.interviews i where i.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and (a.job_id=i.job_id or a.candidate_id=i.candidate_id) and a.completed_at is null)),'[]'::jsonb),
  'assessment_templates',coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.candidate_assessment_templates t where t.company_id=v_company and t.active),'[]'::jsonb),
  'assessment_results',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.candidate_assessment_results r where r.company_id=v_company and r.assessor_id=auth.uid()),'[]'::jsonb),
  'integrations',coalesce((select jsonb_agg(to_jsonb(i) order by i.category,i.display_name) from public.recruitment_integrations i where i.company_id=v_company),'[]'::jsonb),
  'distribution_requests',coalesce((select jsonb_agg(to_jsonb(d) order by d.requested_at desc) from public.job_distribution_requests d where d.company_id=v_company and d.requested_by=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end $$;

revoke all on function public.partner_apply_candidate_enrichment(uuid,text,text,text,text) from public,anon;
revoke all on function public.manager_convert_client_vacancy_request(uuid) from public,anon;
revoke all on function public.manager_review_job_distribution(uuid,text,text,text,text) from public,anon;
revoke all on function public.partner_talent_snapshot() from public,anon;

grant execute on function public.partner_apply_candidate_enrichment(uuid,text,text,text,text) to authenticated;
grant execute on function public.manager_convert_client_vacancy_request(uuid) to authenticated;
grant execute on function public.manager_review_job_distribution(uuid,text,text,text,text) to authenticated;
grant execute on function public.partner_talent_snapshot() to authenticated;
