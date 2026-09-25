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
  v_confirmed_at timestamptz:=nullif(btrim(coalesce(p_job->>'genuine_vacancy_confirmed_at','')),'')::timestamptz;
  v_requirements text[]:=coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'requirements','[]'::jsonb))),'{}'::text[]);
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if nullif(btrim(coalesce(p_job->>'client_id','')),'') is null then raise exception 'Client is required'; end if;
  if nullif(btrim(coalesce(p_job->>'title','')),'') is null then raise exception 'Job title is required'; end if;
  if nullif(btrim(coalesce(p_job->>'description','')),'') is null then raise exception 'Description is required'; end if;

  if p_job_id is null then
    insert into public.jobs(
      company_id,client_id,title,slug,description,employment_type,location,salary_min,salary_max,
      commission_text,status,requirements,application_questions,application_mode,opportunity_notice,
      start_date,duration_text,duties,work_days_hours,health_safety_risks,health_safety_measures,
      required_qualifications,expenses_text,minimum_remuneration_text,pay_interval,notice_period,
      genuine_vacancy_confirmed_at,client_instruction_reference,works_with_vulnerable_people,
      qualification_verification_required,agency_service_type
    ) values(
      v_company,(p_job->>'client_id')::uuid,btrim(p_job->>'title'),btrim(p_job->>'slug'),
      p_job->>'description',coalesce(nullif(p_job->>'employment_type',''),'Permanent'),
      coalesce(nullif(p_job->>'location',''),'UK'),nullif(p_job->>'salary_min','')::numeric,
      nullif(p_job->>'salary_max','')::numeric,nullif(p_job->>'commission_text',''),
      coalesce(nullif(p_job->>'status',''),'draft')::public.job_status,v_requirements,
      coalesce(p_job->'application_questions','[]'::jsonb),coalesce(nullif(p_job->>'application_mode',''),'apply'),
      nullif(p_job->>'opportunity_notice',''),v_start_date,nullif(p_job->>'duration_text',''),
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
      status=coalesce(nullif(p_job->>'status',''),'draft')::public.job_status,requirements=v_requirements,
      application_questions=coalesce(p_job->'application_questions','[]'::jsonb),
      application_mode=coalesce(nullif(p_job->>'application_mode',''),'apply'),
      opportunity_notice=nullif(p_job->>'opportunity_notice',''),start_date=v_start_date,
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
