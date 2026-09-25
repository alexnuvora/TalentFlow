
create or replace function public.manager_convert_client_vacancy_request(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_req public.client_vacancy_requests%rowtype;
  v_client public.clients%rowtype;
  v_job uuid;
  v_slug text;
  r record;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  select * into v_req
  from public.client_vacancy_requests
  where id=p_request and company_id=v_company
  for update;

  if not found then raise exception 'Vacancy request not found'; end if;
  if v_req.status='converted' and v_req.approved_job_id is not null then
    return v_req.approved_job_id;
  end if;
  if v_req.status<>'approved' then
    raise exception 'Vacancy request must be approved before conversion';
  end if;

  select * into v_client
  from public.clients
  where id=v_req.client_id and company_id=v_company;

  if not found then raise exception 'Client not found'; end if;
  if v_client.terms_accepted_at is null then
    raise exception 'Client Terms of Business must be accepted before a vacancy request can become an active recruitment instruction';
  end if;
  if not exists(
    select 1 from public.client_contracts cc
    where cc.company_id=v_company
      and cc.client_id=v_client.id
      and cc.status='active'
      and cc.source_type='terms_acceptance'
      and cc.source_terms_accepted_at=v_client.terms_accepted_at
  ) then
    raise exception 'The latest accepted Terms of Business must have an active matching client contract before vacancy conversion';
  end if;

  v_slug:=trim(both '-' from regexp_replace(lower(v_req.title),'[^a-z0-9]+','-','g'))
          ||'-'||left(replace(v_req.id::text,'-',''),8);

  insert into public.jobs(
    company_id,client_id,title,slug,description,employment_type,location,
    salary_min,salary_max,status,requirements,application_mode,
    genuine_vacancy_confirmed_at,client_instruction_reference
  )
  values(
    v_company,v_req.client_id,v_req.title,v_slug,v_req.hiring_need,
    coalesce(nullif(v_req.employment_type,''),'Permanent'),
    coalesce(nullif(v_req.location,''),'UK'),
    v_req.salary_min,v_req.salary_max,'draft','{}'::text[],'apply',
    now(),'client_portal_request:'||v_req.id::text
  )
  returning id into v_job;

  update public.client_vacancy_requests
  set status='converted',
      approved_job_id=v_job,
      reviewed_by=auth.uid(),
      reviewed_at=coalesce(reviewed_at,now()),
      updated_at=now()
  where id=v_req.id;

  -- Preserve continuity: any active Lead Closer / Hybrid already owning the client
  -- receives the draft vacancy automatically. Recruiter-only assignment remains a
  -- deliberate manager action because recruiters do not own client accounts.
  for r in
    select distinct a.partner_id
    from public.partner_assignments a
    join public.partner_profiles pp
      on pp.user_id=a.partner_id and pp.company_id=a.company_id
    join public.partner_onboarding po
      on po.partner_id=a.partner_id and po.company_id=a.company_id
    where a.company_id=v_company
      and a.client_id=v_req.client_id
      and a.completed_at is null
      and pp.active
      and po.status='active'
      and pp.specialism in ('lead_closer','hybrid')
  loop
    if not exists(
      select 1 from public.partner_assignments x
      where x.company_id=v_company
        and x.partner_id=r.partner_id
        and x.job_id=v_job
        and x.completed_at is null
    ) then
      insert into public.partner_assignments(
        company_id,partner_id,job_id,priority,objective
      )
      values(
        v_company,r.partner_id,v_job,'high',
        'Review the client-requested vacancy, complete the delivery brief and progress suitable candidates through Vorlen.'
      );
    end if;
  end loop;

  insert into public.partner_communication_events(
    company_id,client_id,job_id,event_type,channel,direction,subject,summary,metadata
  )
  values(
    v_company,v_req.client_id,v_job,'vacancy','internal','internal',
    'Client vacancy request converted',
    'Vorlen approved the client vacancy request and created a draft vacancy: '||v_req.title,
    jsonb_build_object('vacancy_request_id',v_req.id)
  );

  return v_job;
end
$$;
