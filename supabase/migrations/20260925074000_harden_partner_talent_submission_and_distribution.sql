
-- Final integrity hardening for partner talent and distribution workflows.

create unique index if not exists job_distribution_requests_active_uq
  on public.job_distribution_requests(company_id,job_id,provider,requested_by)
  where status not in ('failed','cancelled');

do $$
begin
  if not exists(select 1 from pg_constraint where conname='candidate_assessment_results_score_range') then
    alter table public.candidate_assessment_results
      add constraint candidate_assessment_results_score_range
      check(score is null or (score>=0 and score<=100));
  end if;
end $$;

create or replace function public.partner_create_submission_pack(
  p_job uuid,
  p_candidate uuid,
  p_summary text,
  p_headline text default null,
  p_strengths jsonb default '[]'::jsonb,
  p_concerns jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_client uuid;
  v_id uuid;
  v_existing public.partner_submission_packs%rowtype;
begin
  if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then
    raise exception 'Recruiter/Hybrid access required';
  end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;

  select j.client_id into v_client
  from public.jobs j
  join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id
  where j.id=p_job and j.company_id=v_company
    and a.partner_id=auth.uid() and a.completed_at is null;
  if v_client is null then raise exception 'Assigned vacancy required'; end if;

  if not exists(
    select 1 from public.partner_assignments a
    where a.company_id=v_company and a.partner_id=auth.uid()
      and a.candidate_id=p_candidate and a.completed_at is null
  ) then raise exception 'Assigned candidate required'; end if;

  if length(btrim(coalesce(p_summary,'')))<20 then
    raise exception 'Provide a meaningful recruiter summary of at least 20 characters';
  end if;
  if jsonb_typeof(coalesce(p_strengths,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_concerns,'[]'::jsonb))<>'array' then
    raise exception 'Strengths and concerns must be arrays';
  end if;

  select * into v_existing
  from public.partner_submission_packs
  where partner_id=auth.uid() and job_id=p_job and candidate_id=p_candidate
  for update;

  if found and (v_existing.status='submitted' or v_existing.candidate_submission_id is not null) then
    raise exception 'This candidate has already progressed into the official client submission workflow and the partner pack is locked';
  end if;

  if found then
    update public.partner_submission_packs
    set headline=nullif(left(btrim(coalesce(p_headline,'')),500),''),
        summary=left(btrim(p_summary),10000),
        strengths=p_strengths,
        concerns=p_concerns,
        status='requested',
        manager_notes=null,
        reviewed_by=null,
        reviewed_at=null,
        updated_at=now()
    where id=v_existing.id
    returning id into v_id;
  else
    insert into public.partner_submission_packs(
      company_id,partner_id,client_id,job_id,candidate_id,headline,summary,strengths,concerns,status
    )
    values(
      v_company,auth.uid(),v_client,p_job,p_candidate,
      nullif(left(btrim(coalesce(p_headline,'')),500),''),
      left(btrim(p_summary),10000),
      p_strengths,p_concerns,'requested'
    )
    returning id into v_id;
  end if;

  return v_id;
end
$$;

create or replace function public.partner_record_assessment(
  p_candidate uuid,
  p_job uuid,
  p_template uuid,
  p_answers jsonb,
  p_score numeric default null,
  p_summary text default null,
  p_recommendation text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
  if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then
    raise exception 'Recruiter/Hybrid access required';
  end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
  if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and candidate_id=p_candidate and completed_at is null) then
    raise exception 'Assigned candidate required';
  end if;
  if p_job is not null and not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then
    raise exception 'Assigned vacancy required';
  end if;
  if p_template is not null and not exists(select 1 from public.candidate_assessment_templates where id=p_template and company_id=v_company and active) then
    raise exception 'Assessment template not found';
  end if;
  if p_score is not null and (p_score<0 or p_score>100) then raise exception 'Assessment score must be between 0 and 100'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'Assessment answers must be a JSON object'; end if;

  insert into public.candidate_assessment_results(
    company_id,template_id,candidate_id,job_id,assessor_id,answers,score,summary,recommendation,status
  )
  values(
    v_company,p_template,p_candidate,p_job,auth.uid(),coalesce(p_answers,'{}'::jsonb),p_score,
    nullif(left(btrim(coalesce(p_summary,'')),10000),''),
    nullif(left(btrim(coalesce(p_recommendation,'')),4000),''),
    'completed'
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.partner_schedule_interview(
  p_candidate uuid,
  p_job uuid,
  p_scheduled_at timestamptz,
  p_duration_minutes integer default 45,
  p_meeting_url text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_client uuid; v_id uuid;
begin
  if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then
    raise exception 'Recruiter/Hybrid access required';
  end if;
  if p_scheduled_at is null or p_scheduled_at<=now() then raise exception 'Interview must be scheduled in the future'; end if;
  if p_duration_minutes is not null and (p_duration_minutes<15 or p_duration_minutes>240) then raise exception 'Interview duration must be between 15 and 240 minutes'; end if;

  select client_id into v_client from public.jobs j where j.id=p_job and j.company_id=v_company;
  if v_client is null then raise exception 'Vacancy not found'; end if;

  if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then
    raise exception 'Assigned vacancy required';
  end if;
  if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and candidate_id=p_candidate and completed_at is null) then
    raise exception 'Assigned candidate required';
  end if;
  if not exists(
    select 1 from public.candidate_submissions s
    where s.company_id=v_company and s.job_id=p_job and s.candidate_id=p_candidate and s.client_id=v_client
      and s.status not in ('draft','withdrawn','approved_to_send')
      and (s.client_decision in ('approve','request_interview') or s.status in ('approved','interview_requested'))
  ) then raise exception 'Client must approve or request an interview for this submitted candidate first'; end if;

  if exists(
    select 1 from public.interviews i
    where i.company_id=v_company and i.job_id=p_job and i.candidate_id=p_candidate
      and i.status in ('scheduled','confirmed')
      and abs(extract(epoch from (i.scheduled_at-p_scheduled_at)))<300
  ) then raise exception 'A matching interview is already scheduled'; end if;

  insert into public.interviews(
    company_id,client_id,job_id,candidate_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes
  )
  values(
    v_company,v_client,p_job,p_candidate,p_scheduled_at,coalesce(p_duration_minutes,45),
    nullif(left(btrim(coalesce(p_meeting_url,'')),2000),''),
    'scheduled',
    nullif(left(btrim(coalesce(p_notes,'')),5000),'')
  )
  returning id into v_id;

  insert into public.partner_communication_events(
    company_id,partner_id,client_id,candidate_id,job_id,event_type,channel,direction,subject,summary,metadata
  )
  values(
    v_company,auth.uid(),v_client,p_candidate,p_job,'interview','meeting','outbound',
    'Interview scheduled',
    'Interview scheduled for '||to_char(p_scheduled_at at time zone 'Europe/London','DD Mon YYYY HH24:MI')||'.',
    jsonb_build_object('interview_id',v_id)
  );

  return v_id;
end
$$;

create or replace function public.partner_request_job_distribution(p_job uuid,p_provider text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_id uuid;
  v_status text;
  v_job_status text;
begin
  if not private.partner_is_active(auth.uid()) or not (private.partner_can_close_clients(auth.uid()) or private.partner_can_source_candidates(auth.uid())) then
    raise exception 'Vacancy-capable partner access required';
  end if;
  if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then
    raise exception 'Assigned vacancy required';
  end if;

  select j.status into v_job_status from public.jobs j where j.id=p_job and j.company_id=v_company;
  if v_job_status is null then raise exception 'Vacancy not found'; end if;

  select status into v_status
  from public.recruitment_integrations
  where company_id=v_company and provider=p_provider and category in ('job_board','social')
  order by case when status='connected' then 0 else 1 end
  limit 1;
  if v_status is null then raise exception 'Unknown distribution provider'; end if;

  select id into v_id
  from public.job_distribution_requests
  where company_id=v_company and job_id=p_job and provider=p_provider and requested_by=auth.uid()
    and status not in ('failed','cancelled')
  order by requested_at desc limit 1;
  if v_id is not null then return v_id; end if;

  if p_provider<>'vorlen_careers' and v_status='connected' and v_job_status<>'published' then
    raise exception 'External distribution can start only after the vacancy is published in Vorlen';
  end if;

  insert into public.job_distribution_requests(company_id,job_id,provider,requested_by,status)
  values(
    v_company,p_job,p_provider,auth.uid(),
    case
      when p_provider='vorlen_careers' then case when v_job_status='published' then 'published' else 'queued' end
      when v_status='connected' then 'requested'
      else 'configuration_required'
    end
  )
  returning id into v_id;

  return v_id;
end
$$;

create or replace function public.manager_review_job_distribution(
  p_request uuid,
  p_status text,
  p_external_job_id text default null,
  p_external_url text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_req public.job_distribution_requests%rowtype;
  v_integration_status text;
  v_job_status text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_status not in ('queued','published','failed','cancelled','configuration_required') then raise exception 'Invalid distribution status'; end if;

  select * into v_req
  from public.job_distribution_requests
  where id=p_request and company_id=v_company
  for update;
  if not found then raise exception 'Distribution request not found'; end if;

  select status into v_job_status from public.jobs where id=v_req.job_id and company_id=v_company;
  select status into v_integration_status
  from public.recruitment_integrations
  where company_id=v_company and provider=v_req.provider and category in ('job_board','social')
  order by case when status='connected' then 0 else 1 end limit 1;

  if v_req.provider='vorlen_careers' then
    if p_status='published' and v_job_status<>'published' then
      raise exception 'Vorlen Careers is published only when the Vorlen vacancy itself is published';
    end if;
  elsif p_status in ('queued','published') then
    if v_integration_status<>'connected' then raise exception 'External provider is not connected'; end if;
    if v_job_status<>'published' then raise exception 'Vacancy must be published in Vorlen before external distribution'; end if;
  end if;

  if p_status='published' and v_req.provider<>'vorlen_careers'
     and nullif(btrim(coalesce(p_external_url,'')),'') is null
     and nullif(btrim(coalesce(p_external_job_id,'')),'') is null then
    raise exception 'Record the provider job ID or listing URL when marking an external distribution as published';
  end if;
  if p_status='failed' and nullif(btrim(coalesce(p_error_message,'')),'') is null then
    raise exception 'Record why distribution failed';
  end if;

  update public.job_distribution_requests
  set status=p_status,
      external_job_id=nullif(left(btrim(coalesce(p_external_job_id,'')),1000),''),
      external_url=nullif(left(btrim(coalesce(p_external_url,'')),2000),''),
      error_message=case when p_status='failed' then nullif(left(btrim(coalesce(p_error_message,'')),4000),'') else null end,
      updated_at=now()
  where id=v_req.id;
end
$$;
