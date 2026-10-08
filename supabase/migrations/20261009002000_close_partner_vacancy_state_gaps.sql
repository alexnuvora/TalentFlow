-- Close remaining Hybrid Partner vacancy-state gaps.
-- Preserve paused/closed lifecycle, fail closed for sourcing, and gate all candidate-sourcing workflows.

create or replace function private.normalize_job_partner_sourcing_state()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.status in ('paused','closed') then
    new.partner_sourcing_state:='research_opportunity';
  elsif new.status='published' then
    new.partner_sourcing_state:='published';
  elsif new.partner_sourcing_state='published' then
    new.status:='published';
  elsif new.partner_sourcing_state='internal_sourcing_approved' then
    new.status:='draft';
  else
    new.partner_sourcing_state:='research_opportunity';
    if new.status not in ('paused','closed') then new.status:='draft'; end if;
  end if;

  if new.partner_sourcing_state in ('internal_sourcing_approved','published')
     and (tg_op='INSERT' or old.partner_sourcing_state is distinct from new.partner_sourcing_state) then
    new.sourcing_approved_at:=now();
    new.sourcing_approved_by:=coalesce(auth.uid(),new.sourcing_approved_by);
  elsif new.partner_sourcing_state='research_opportunity' then
    new.sourcing_approved_at:=null;
    new.sourcing_approved_by:=null;
  end if;
  return new;
end
$$;

create or replace function public.partner_candidate_discover(p_job uuid,p_query text default null::text,p_limit integer default 20)
returns table(candidate_id uuid,full_name text,location text,experience_summary text,training_qualifications text,stage text,already_assigned boolean,request_status text)
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=p_job and a.completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'This is a Research Opportunity — Do Not Source. Vorlen management must approve internal sourcing first.'; end if;

 return query
 select c.id,c.full_name,c.location,c.experience_summary,c.training_qualifications,c.stage::text,
   exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null),
   (select case when r.status='approved' and not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null) then 'expired' else r.status end
    from public.partner_candidate_access_requests r
    where r.company_id=v_company and r.partner_id=auth.uid() and r.candidate_id=c.id and r.job_id=p_job
    order by r.created_at desc limit 1)
 from public.candidates c
 where c.company_id=v_company and c.erased_at is null
   and (nullif(btrim(coalesce(p_query,'')),'') is null or c.full_name ilike '%'||p_query||'%' or coalesce(c.location,'') ilike '%'||p_query||'%' or coalesce(c.experience_summary,'') ilike '%'||p_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%')
 order by c.created_at desc
 limit greatest(1,least(coalesce(p_limit,20),50));
end
$$;

create or replace function public.partner_candidate_match(p_job uuid,p_limit integer default 20)
returns table(candidate_id uuid,full_name text,location text,experience_summary text,training_qualifications text,match_score integer,match_reasons text[],already_assigned boolean)
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_job public.jobs%rowtype; v_terms text[];
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'This is a Research Opportunity — Do Not Source. Vorlen management must approve internal sourcing first.'; end if;
 select * into v_job from public.jobs where id=p_job and company_id=v_company;
 v_terms:=array(select distinct lower(x) from unnest(regexp_split_to_array(coalesce(v_job.title,'')||' '||coalesce(v_job.description,'')||' '||array_to_string(coalesce(v_job.requirements,'{}'::text[]),' ')||' '||coalesce(v_job.required_qualifications,''),'[^a-zA-Z0-9+#.]+')) x where length(x)>=3 limit 40);
 return query
 select c.id,c.full_name,c.location,c.experience_summary,c.training_qualifications,
   least(100,(case when lower(coalesce(c.location,''))=lower(coalesce(v_job.location,'')) then 15 else 0 end)
     +(select count(*)*4 from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%'))::int,
   array(select t from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%' limit 8),
   exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null)
 from public.candidates c
 where c.company_id=v_company and c.erased_at is null
   and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null)
 order by 6 desc,c.created_at desc
 limit greatest(1,least(coalesce(p_limit,20),50));
end
$$;

create or replace function public.partner_talent_snapshot()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); result jsonb;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 select jsonb_build_object(
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'partner_sourcing_state',j.partner_sourcing_state,'location',j.location,'client_id',j.client_id,'slug',j.slug) order by j.created_at desc) from public.jobs j where j.company_id=v_company and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=j.id and a.completed_at is null)),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'full_name',c.full_name,'location',c.location,'stage',c.stage,'resume_path',c.resume_path,'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,'authorisations',c.authorisations) order by c.created_at desc) from public.candidates c where c.company_id=v_company and c.erased_at is null and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null)),'[]'::jsonb),
  'pools',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'members',(select coalesce(jsonb_agg(jsonb_build_object('candidate_id',m.candidate_id,'full_name',c.full_name,'location',c.location)),'[]'::jsonb) from public.partner_talent_pool_members m join public.candidates c on c.id=m.candidate_id where m.pool_id=p.id)) order by p.created_at desc) from public.partner_talent_pools p where p.company_id=v_company and p.partner_id=auth.uid()),'[]'::jsonb),
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
$$;

create or replace function public.partner_request_job_distribution(p_job uuid,p_provider text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;v_status text;v_job_status text;v_sourcing_state text;
begin
 if not private.partner_is_active(auth.uid()) or not (private.partner_can_close_clients(auth.uid()) or private.partner_can_source_candidates(auth.uid())) then raise exception 'Vacancy-capable partner access required'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 select j.status::text,j.partner_sourcing_state into v_job_status,v_sourcing_state from public.jobs j where j.id=p_job and j.company_id=v_company;
 if v_job_status is null then raise exception 'Vacancy not found'; end if;
 if v_job_status<>'published' or v_sourcing_state<>'published' then raise exception 'Job distribution is available only for Published Vacancy — Source Candidates/Public Applications records'; end if;
 select status into v_status from public.recruitment_integrations where company_id=v_company and provider=p_provider and category in ('job_board','social') order by case when status='connected' then 0 else 1 end limit 1;
 if v_status is null then raise exception 'Unknown distribution provider'; end if;
 select id into v_id from public.job_distribution_requests where company_id=v_company and job_id=p_job and provider=p_provider and requested_by=auth.uid() and status not in ('failed','cancelled') order by requested_at desc limit 1;
 if v_id is not null then return v_id; end if;
 insert into public.job_distribution_requests(company_id,job_id,provider,requested_by,status)
 values(v_company,p_job,p_provider,auth.uid(),case when p_provider='vorlen_careers' then 'published' when v_status='connected' then 'requested' else 'configuration_required' end)
 returning id into v_id;
 return v_id;
end
$$;

create or replace function public.partner_record_assessment(p_candidate uuid,p_job uuid,p_template uuid,p_answers jsonb,p_score numeric default null::numeric,p_summary text default null::text,p_recommendation text default null::text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and candidate_id=p_candidate and completed_at is null) then raise exception 'Assigned candidate required'; end if;
 if p_job is not null then
  if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
  if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'Research Opportunity — Do Not Source. Assessment activity for this vacancy is blocked until sourcing is approved.'; end if;
 end if;
 if p_template is not null and not exists(select 1 from public.candidate_assessment_templates where id=p_template and company_id=v_company and active) then raise exception 'Assessment template not found'; end if;
 if p_score is not null and (p_score<0 or p_score>100) then raise exception 'Assessment score must be between 0 and 100'; end if;
 if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'Assessment answers must be a JSON object'; end if;
 insert into public.candidate_assessment_results(company_id,template_id,candidate_id,job_id,assessor_id,answers,score,summary,recommendation,status)
 values(v_company,p_template,p_candidate,p_job,auth.uid(),coalesce(p_answers,'{}'::jsonb),p_score,nullif(left(btrim(coalesce(p_summary,'')),10000),''),nullif(left(btrim(coalesce(p_recommendation,'')),4000),''),'completed')
 returning id into v_id;
 return v_id;
end
$$;

create or replace function public.partner_create_submission_pack(p_job uuid,p_candidate uuid,p_summary text,p_headline text default null::text,p_strengths jsonb default '[]'::jsonb,p_concerns jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_client uuid;v_id uuid;v_existing public.partner_submission_packs%rowtype;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 select j.client_id into v_client from public.jobs j join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id where j.id=p_job and j.company_id=v_company and a.partner_id=auth.uid() and a.completed_at is null;
 if v_client is null then raise exception 'Assigned vacancy required'; end if;
 if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'Research Opportunity — Do Not Source. Submission packs are blocked until sourcing is approved.'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Assigned candidate required'; end if;
 if not exists(select 1 from public.partner_candidate_pipeline pcp where pcp.company_id=v_company and pcp.partner_id=auth.uid() and pcp.job_id=p_job and pcp.candidate_id=p_candidate and pcp.stage='recommended' and pcp.manager_status='approved') then raise exception 'Vorlen recommendation approval is required before creating a client submission pack'; end if;
 if not exists(select 1 from public.candidates c where c.id=p_candidate and c.company_id=v_company and c.erased_at is null and c.work_seeker_terms_agreed_at is not null and coalesce(trim(c.resume_path),'')<>'') then raise exception 'Candidate terms and an authorised CV are required before creating a submission pack'; end if;
 if length(btrim(coalesce(p_summary,'')))<20 then raise exception 'Provide a meaningful recruiter summary of at least 20 characters'; end if;
 if jsonb_typeof(coalesce(p_strengths,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_concerns,'[]'::jsonb))<>'array' then raise exception 'Strengths and concerns must be arrays'; end if;
 select * into v_existing from public.partner_submission_packs where partner_id=auth.uid() and job_id=p_job and candidate_id=p_candidate for update;
 if found and (v_existing.status='submitted' or v_existing.candidate_submission_id is not null) then raise exception 'This candidate has already progressed into the official client submission workflow and the partner pack is locked'; end if;
 if found then
  update public.partner_submission_packs set headline=nullif(left(btrim(coalesce(p_headline,'')),500),''),summary=left(btrim(p_summary),10000),strengths=p_strengths,concerns=p_concerns,status='requested',manager_notes=null,reviewed_by=null,reviewed_at=null,updated_at=now() where id=v_existing.id returning id into v_id;
 else
  insert into public.partner_submission_packs(company_id,partner_id,client_id,job_id,candidate_id,headline,summary,strengths,concerns,status)
  values(v_company,auth.uid(),v_client,p_job,p_candidate,nullif(left(btrim(coalesce(p_headline,'')),500),''),left(btrim(p_summary),10000),p_strengths,p_concerns,'requested') returning id into v_id;
 end if;
 return v_id;
end
$$;

create or replace function public.partner_schedule_interview(p_candidate uuid,p_job uuid,p_scheduled_at timestamptz,p_duration_minutes integer default 45,p_meeting_url text default null::text,p_notes text default null::text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_client uuid;v_id uuid;
begin
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if p_scheduled_at is null or p_scheduled_at<=now() then raise exception 'Interview must be scheduled in the future'; end if;
 if p_duration_minutes is not null and (p_duration_minutes<15 or p_duration_minutes>240) then raise exception 'Interview duration must be between 15 and 240 minutes'; end if;
 select client_id into v_client from public.jobs j where j.id=p_job and j.company_id=v_company;
 if v_client is null then raise exception 'Vacancy not found'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'Research Opportunity — Do Not Source. Interview scheduling is blocked until sourcing is approved.'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and candidate_id=p_candidate and completed_at is null) then raise exception 'Assigned candidate required'; end if;
 if not exists(select 1 from public.candidate_submissions s where s.company_id=v_company and s.job_id=p_job and s.candidate_id=p_candidate and s.client_id=v_client and s.status not in ('draft','withdrawn','approved_to_send') and (s.client_decision in ('approve','request_interview') or s.status in ('approved','interview_requested'))) then raise exception 'Client must approve or request an interview for this submitted candidate first'; end if;
 if exists(select 1 from public.interviews i where i.company_id=v_company and i.job_id=p_job and i.candidate_id=p_candidate and i.status in ('scheduled','confirmed') and abs(extract(epoch from (i.scheduled_at-p_scheduled_at)))<300) then raise exception 'A matching interview is already scheduled'; end if;
 insert into public.interviews(company_id,client_id,job_id,candidate_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes)
 values(v_company,v_client,p_job,p_candidate,p_scheduled_at,coalesce(p_duration_minutes,45),nullif(left(btrim(coalesce(p_meeting_url,'')),2000),''),'scheduled',nullif(left(btrim(coalesce(p_notes,'')),5000),'')) returning id into v_id;
 insert into public.partner_communication_events(company_id,partner_id,client_id,candidate_id,job_id,event_type,channel,direction,subject,summary,metadata)
 values(v_company,auth.uid(),v_client,p_candidate,p_job,'interview','meeting','outbound','Interview scheduled','Interview scheduled for '||to_char(p_scheduled_at at time zone 'Europe/London','DD Mon YYYY HH24:MI')||'.',jsonb_build_object('interview_id',v_id));
 return v_id;
end
$$;

create or replace function public.partner_request_integration_access(p_provider text,p_job uuid default null::uuid,p_note text default null::text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;v_category text;
begin
 if not private.partner_is_active(auth.uid()) then raise exception 'Active partner access required'; end if;
 select category into v_category from public.recruitment_integrations where company_id=v_company and provider=p_provider limit 1;
 if v_category is null then raise exception 'Unknown integration provider'; end if;
 if p_job is not null then
  if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
  if v_category in ('candidate_source','social') and not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'Research Opportunity — Do Not Source. Sourcing integration access is blocked for this vacancy.'; end if;
  if v_category='job_board' and not exists(select 1 from public.jobs j where j.id=p_job and j.company_id=v_company and j.status='published' and j.partner_sourcing_state='published') then raise exception 'Job-board access for a vacancy requires Published Vacancy — Source Candidates/Public Applications.'; end if;
 end if;
 select id into v_id from public.partner_integration_requests where company_id=v_company and provider=p_provider and requested_by=auth.uid() and coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_job,'00000000-0000-0000-0000-000000000000'::uuid) and request_type='access' and status in ('requested','under_review','approved') order by created_at desc limit 1;
 if v_id is not null then return v_id; end if;
 insert into public.partner_integration_requests(company_id,provider,requested_by,job_id,request_type,request_note)
 values(v_company,p_provider,auth.uid(),p_job,'access',nullif(trim(coalesce(p_note,'')),'')) returning id into v_id;
 return v_id;
end
$$;
