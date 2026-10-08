-- Standardise Hybrid Partner vacancy sourcing into three explicit states:
-- research_opportunity -> Do not source
-- internal_sourcing_approved -> Source candidates, no public applications
-- published -> Source candidates + public applications

alter table public.jobs
  add column if not exists partner_sourcing_state text not null default 'research_opportunity',
  add column if not exists sourcing_approved_at timestamptz,
  add column if not exists sourcing_approved_by uuid references public.profiles(id) on delete set null;

alter table public.jobs drop constraint if exists jobs_partner_sourcing_state_check;
alter table public.jobs add constraint jobs_partner_sourcing_state_check
check (partner_sourcing_state in ('research_opportunity','internal_sourcing_approved','published'));

-- Preserve the four vacancies already being actively sourced; all other draft records
-- fail closed as research opportunities. Published records remain published.
update public.jobs j
set partner_sourcing_state = case
  when j.status='published' then 'published'
  when exists(select 1 from public.partner_candidate_pipeline p where p.job_id=j.id) then 'internal_sourcing_approved'
  else 'research_opportunity'
end,
sourcing_approved_at = case
  when j.status='published' or exists(select 1 from public.partner_candidate_pipeline p where p.job_id=j.id)
    then coalesce(j.sourcing_approved_at,j.created_at)
  else null
end
where true;

create or replace function private.normalize_job_partner_sourcing_state()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.status='published' then
    new.partner_sourcing_state:='published';
  elsif new.partner_sourcing_state='published' then
    new.status:='published';
  elsif new.partner_sourcing_state='internal_sourcing_approved' then
    new.status:='draft';
  else
    new.partner_sourcing_state:='research_opportunity';
    if new.status='published' then new.status:='draft'; end if;
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

drop trigger if exists trg_normalize_job_partner_sourcing_state on public.jobs;
create trigger trg_normalize_job_partner_sourcing_state
before insert or update of status,partner_sourcing_state
on public.jobs
for each row execute function private.normalize_job_partner_sourcing_state();

create or replace function private.partner_job_sourcing_allowed(p_job uuid,p_company uuid)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select exists(
    select 1 from public.jobs j
    where j.id=p_job
      and j.company_id=p_company
      and (
        (j.partner_sourcing_state='internal_sourcing_approved' and j.status='draft')
        or
        (j.partner_sourcing_state='published' and j.status='published')
      )
  )
$$;
revoke all on function private.partner_job_sourcing_allowed(uuid,uuid) from public,anon,authenticated;

create or replace function public.manager_save_job(p_job jsonb,p_job_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_id uuid;
  v_start_date date:=nullif(btrim(coalesce(p_job->>'start_date','')),'')::date;
  v_start_date_text text:=coalesce(nullif(btrim(coalesce(p_job->>'start_date_text','')),''),'To be confirmed');
  v_confirmed_at timestamptz:=nullif(btrim(coalesce(p_job->>'genuine_vacancy_confirmed_at','')),'')::timestamptz;
  v_requirements text[]:=coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'requirements','[]'::jsonb))),'{}'::text[]);
  v_sourcing_state text:=coalesce(
    nullif(btrim(coalesce(p_job->>'partner_sourcing_state','')),''),
    case when coalesce(p_job->>'status','draft')='published' then 'published' else 'research_opportunity' end
  );
  v_status public.job_status;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if nullif(btrim(coalesce(p_job->>'client_id','')),'') is null then raise exception 'Client is required'; end if;
  if nullif(btrim(coalesce(p_job->>'title','')),'') is null then raise exception 'Job title is required'; end if;
  if nullif(btrim(coalesce(p_job->>'description','')),'') is null then raise exception 'Description is required'; end if;
  if v_sourcing_state not in ('research_opportunity','internal_sourcing_approved','published') then raise exception 'Invalid vacancy sourcing state'; end if;

  v_status:=case when v_sourcing_state='published' then 'published'::public.job_status else 'draft'::public.job_status end;

  if p_job_id is null then
    insert into public.jobs(
      company_id,client_id,title,slug,description,employment_type,location,salary_min,salary_max,
      commission_text,status,partner_sourcing_state,requirements,application_questions,application_mode,opportunity_notice,
      start_date,start_date_text,duration_text,duties,work_days_hours,health_safety_risks,health_safety_measures,
      required_qualifications,expenses_text,minimum_remuneration_text,pay_interval,notice_period,
      genuine_vacancy_confirmed_at,client_instruction_reference,works_with_vulnerable_people,
      qualification_verification_required,agency_service_type
    ) values(
      v_company,(p_job->>'client_id')::uuid,btrim(p_job->>'title'),btrim(p_job->>'slug'),
      p_job->>'description',coalesce(nullif(p_job->>'employment_type',''),'Permanent'),
      coalesce(nullif(p_job->>'location',''),'UK'),nullif(p_job->>'salary_min','')::numeric,
      nullif(p_job->>'salary_max','')::numeric,nullif(p_job->>'commission_text',''),
      v_status,v_sourcing_state,v_requirements,
      coalesce(p_job->'application_questions','[]'::jsonb),coalesce(nullif(p_job->>'application_mode',''),'apply'),
      nullif(p_job->>'opportunity_notice',''),v_start_date,v_start_date_text,nullif(p_job->>'duration_text',''),
      nullif(p_job->>'duties',''),nullif(p_job->>'work_days_hours',''),nullif(p_job->>'health_safety_risks',''),
      nullif(p_job->>'health_safety_measures',''),nullif(p_job->>'required_qualifications',''),
      nullif(p_job->>'expenses_text',''),nullif(p_job->>'minimum_remuneration_text',''),
      nullif(p_job->>'pay_interval',''),nullif(p_job->>'notice_period',''),v_confirmed_at,
      nullif(p_job->>'client_instruction_reference',''),coalesce((p_job->>'works_with_vulnerable_people')::boolean,false),
      coalesce((p_job->>'qualification_verification_required')::boolean,false),
      coalesce(nullif(p_job->>'agency_service_type',''),'permanent_employment')
    ) returning id into v_id;
  else
    update public.jobs set
      client_id=(p_job->>'client_id')::uuid,title=btrim(p_job->>'title'),slug=btrim(p_job->>'slug'),
      description=p_job->>'description',employment_type=coalesce(nullif(p_job->>'employment_type',''),'Permanent'),
      location=coalesce(nullif(p_job->>'location',''),'UK'),salary_min=nullif(p_job->>'salary_min','')::numeric,
      salary_max=nullif(p_job->>'salary_max','')::numeric,commission_text=nullif(p_job->>'commission_text',''),
      status=v_status,partner_sourcing_state=v_sourcing_state,requirements=v_requirements,
      application_questions=coalesce(p_job->'application_questions','[]'::jsonb),
      application_mode=coalesce(nullif(p_job->>'application_mode',''),'apply'),
      opportunity_notice=nullif(p_job->>'opportunity_notice',''),start_date=v_start_date,start_date_text=v_start_date_text,
      duration_text=nullif(p_job->>'duration_text',''),duties=nullif(p_job->>'duties',''),
      work_days_hours=nullif(p_job->>'work_days_hours',''),health_safety_risks=nullif(p_job->>'health_safety_risks',''),
      health_safety_measures=nullif(p_job->>'health_safety_measures',''),
      required_qualifications=nullif(p_job->>'required_qualifications',''),expenses_text=nullif(p_job->>'expenses_text',''),
      minimum_remuneration_text=nullif(p_job->>'minimum_remuneration_text',''),
      pay_interval=nullif(p_job->>'pay_interval',''),notice_period=nullif(p_job->>'notice_period',''),
      genuine_vacancy_confirmed_at=v_confirmed_at,client_instruction_reference=nullif(p_job->>'client_instruction_reference',''),
      works_with_vulnerable_people=coalesce((p_job->>'works_with_vulnerable_people')::boolean,false),
      qualification_verification_required=coalesce((p_job->>'qualification_verification_required')::boolean,false),
      agency_service_type=coalesce(nullif(p_job->>'agency_service_type',''),'permanent_employment')
    where id=p_job_id and company_id=v_company returning id into v_id;
    if v_id is null then raise exception 'Job not found'; end if;
  end if;
  return v_id;
end
$$;
revoke all on function public.manager_save_job(jsonb,uuid) from public,anon;
grant execute on function public.manager_save_job(jsonb,uuid) to authenticated;

create or replace function public.enforce_partner_candidate_pipeline()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_manager boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
  new.updated_at := now();

  if v_manager then
    if tg_op='UPDATE' and new.manager_status is distinct from old.manager_status then
      new.reviewed_at := now();
      new.reviewed_by := coalesce(auth.uid(),new.reviewed_by);
    end if;
    return new;
  end if;

  if not private.partner_is_active() then raise exception 'Active partner access required'; end if;
  if not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate sourcing is not enabled for this partner profile'; end if;
  if not public.candidate_processing_allowed(private.current_company_id()) then raise exception 'Candidate processing is not active'; end if;

  if tg_op='INSERT' then
    new.company_id := private.current_company_id();
    new.partner_id := auth.uid();
    new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
    new.manager_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    if old.partner_id <> auth.uid() or old.company_id <> private.current_company_id() then raise exception 'You may only update your own candidate pipeline'; end if;
    new.company_id := old.company_id;
    new.partner_id := old.partner_id;
    new.candidate_id := old.candidate_id;
    new.job_id := old.job_id;
    new.manager_notes := old.manager_notes;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    if old.manager_status in ('approved','declined') then raise exception 'This recommendation has been reviewed by Vorlen and is locked'; end if;
    new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
  end if;

  if not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.candidate_id=new.candidate_id and a.completed_at is null)
    then raise exception 'Candidate is not assigned to your partner portfolio'; end if;
  if not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.job_id=new.job_id and a.completed_at is null)
    then raise exception 'Vacancy is not assigned to your partner portfolio'; end if;
  if not private.partner_job_sourcing_allowed(new.job_id,new.company_id) then
    raise exception 'This vacancy is a research opportunity. Vorlen management must approve internal sourcing before candidates can be added.';
  end if;

  if new.stage='recommended' and not exists(
    select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id
      and c.work_seeker_terms_agreed_at is not null
      and nullif(btrim(c.work_seeker_terms_evidence),'') is not null
  ) then raise exception 'Candidate work-seeker terms evidence is required before recommendation'; end if;

  return new;
end
$$;

create or replace function public.partner_candidate_discover_ranked(
  p_job uuid,p_query text default null::text,p_limit integer default 30,p_mode text default 'match'::text
)
returns table(candidate_id uuid,full_name text,location text,experience_summary text,training_qualifications text,stage text,match_score integer,match_reasons text[],already_assigned boolean,request_status text)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_job public.jobs%rowtype;
  v_terms text[];
  v_mode text:=lower(coalesce(nullif(trim(p_mode),''),'match'));
begin
  if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
  if v_mode not in ('match','all') then raise exception 'Discovery mode must be match or all'; end if;
  if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=p_job and a.completed_at is null) then raise exception 'Assigned vacancy required'; end if;
  if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'This is a Research Opportunity — Do Not Source. Vorlen management must approve internal sourcing first.'; end if;
  select * into v_job from public.jobs where id=p_job and company_id=v_company;
  if not found then raise exception 'Assigned vacancy not found'; end if;
  v_terms:=array(select distinct x from unnest(regexp_split_to_array(lower(coalesce(v_job.title,'')||' '||coalesce(v_job.description,'')||' '||array_to_string(coalesce(v_job.requirements,'{}'::text[]),' ')||' '||coalesce(v_job.required_qualifications,'')||' '||coalesce(v_job.duties,'')),'[^a-z0-9+#.]+')) x where length(x)>=3 and x not in ('the','and','for','with','from','this','that','you','your','our','are','will','have','has','job','role','work','working','required','requirements','candidate','candidates','experience','skills') limit 50);
  return query
  with scored as (
    select c.id,c.full_name,c.location,c.experience_summary,c.training_qualifications,c.stage::text candidate_stage,
      least(100,
        case when nullif(trim(v_job.location),'') is not null and lower(coalesce(c.location,''))=lower(v_job.location) then 20 else 0 end
        + least(60,coalesce((select count(*)*5 from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%'),0))
        + case when nullif(trim(coalesce(p_query,'')),'') is not null and (c.full_name ilike '%'||p_query||'%' or coalesce(c.location,'') ilike '%'||p_query||'%' or coalesce(c.experience_summary,'') ilike '%'||p_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%') then 20 else 0 end
      )::int score,
      array(select t from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%' limit 8) reasons,
      exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null) is_assigned,
      (select case when r.status='approved' and not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null) then 'expired' else r.status end from public.partner_candidate_access_requests r where r.company_id=v_company and r.partner_id=auth.uid() and r.candidate_id=c.id and r.job_id=p_job order by r.created_at desc limit 1) access_status
    from public.candidates c
    where c.company_id=v_company and c.erased_at is null
      and (nullif(trim(coalesce(p_query,'')),'') is null or c.full_name ilike '%'||p_query||'%' or coalesce(c.location,'') ilike '%'||p_query||'%' or coalesce(c.experience_summary,'') ilike '%'||p_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%')
  )
  select s.id,s.full_name,s.location,s.experience_summary,s.training_qualifications,s.candidate_stage,s.score,s.reasons,s.is_assigned,s.access_status
  from scored s
  order by case when v_mode='match' then s.score else 0 end desc,s.is_assigned desc,s.full_name asc
  limit greatest(1,least(coalesce(p_limit,30),50));
end
$$;

create or replace function public.partner_request_candidate_access(p_candidate uuid,p_job uuid,p_reason text default null::text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.jobs j join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id where j.id=p_job and j.company_id=v_company and a.partner_id=auth.uid() and a.completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if not private.partner_job_sourcing_allowed(p_job,v_company) then raise exception 'This is a Research Opportunity — Do Not Source. Vorlen management must approve internal sourcing first.'; end if;
 if not exists(select 1 from public.candidates c where c.id=p_candidate and c.company_id=v_company and c.erased_at is null) then raise exception 'Candidate unavailable'; end if;
 if exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Candidate is already assigned to you'; end if;
 insert into public.partner_candidate_access_requests(company_id,partner_id,candidate_id,job_id,reason)
 values(v_company,auth.uid(),p_candidate,p_job,nullif(btrim(coalesce(p_reason,'')),''))
 returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'A candidate access request is already pending for this vacancy';
end
$$;
