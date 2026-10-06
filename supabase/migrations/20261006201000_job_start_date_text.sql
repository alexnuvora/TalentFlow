-- Support jobs whose exact start date is not yet known.
alter table public.jobs
  add column if not exists start_date_text text not null default 'To be confirmed';

update public.jobs
set start_date_text='To be confirmed'
where coalesce(btrim(start_date_text),'')='';

create or replace function public.assert_job_publish_compliance()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare cl public.clients%rowtype; co public.companies%rowtype;
begin
 if new.status::text <> 'published' then return new; end if;
 select * into cl from public.clients where id=new.client_id and company_id=new.company_id;
 select * into co from public.companies where id=new.company_id;
 if new.agency_service_type <> 'permanent_employment' then raise exception 'Vorlen is currently compliance-configured only for permanent employment-agency vacancies'; end if;
 if co.legal_name is null or btrim(co.legal_name)='' or co.legal_address is null or btrim(co.legal_address)='' or co.privacy_email is null or btrim(co.privacy_email)='' then raise exception 'Agency legal identity and privacy contact must be configured before publishing vacancies'; end if;
 if cl.id is null or cl.terms_accepted_at is null or cl.terms_version is null or coalesce(btrim(cl.business_nature),'')='' or cl.recruitment_fee_percent is null or cl.payment_terms_days is null or coalesce(btrim(cl.rebate_terms),'')='' then raise exception 'Complete client terms, fee, payment and rebate terms before publishing vacancies'; end if;
 if new.application_mode <> 'register_interest' then
  if new.genuine_vacancy_confirmed_at is null or coalesce(btrim(new.client_instruction_reference),'')='' then raise exception 'A genuine client instruction must be evidenced before publication'; end if;
  if (new.start_date is null and coalesce(btrim(new.start_date_text),'')='') or coalesce(btrim(new.duration_text),'')='' or coalesce(btrim(new.duties),'')='' or coalesce(btrim(new.location),'')='' or coalesce(btrim(new.work_days_hours),'')='' then raise exception 'Start date/date text, duration, duties, location and days/hours are required'; end if;
  if coalesce(btrim(new.health_safety_risks),'')='' or coalesce(btrim(new.health_safety_measures),'')='' or coalesce(btrim(new.required_qualifications),'')='' or coalesce(btrim(new.expenses_text),'')='' then raise exception 'Health and safety risks, controls, qualifications and expenses information are required'; end if;
  if coalesce(btrim(new.minimum_remuneration_text),'')='' or coalesce(btrim(new.pay_interval),'')='' or coalesce(btrim(new.notice_period),'')='' then raise exception 'Remuneration, pay interval and notice period are required'; end if;
 end if;
 new.agency_legal_name_snapshot:=co.legal_name;
 new.hirer_name_snapshot:=cl.company_name;
 return new;
end
$function$;

create or replace function public.sync_native_vorlen_distribution()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
 if new.status='published' and old.status is distinct from new.status then
   update public.job_distribution_requests
   set status='published',external_job_id=new.id::text,external_url='https://www.vorlen.co.uk/careers/'||new.slug,error_message=null,updated_at=now()
   where company_id=new.company_id and job_id=new.id and provider='vorlen_careers' and status in ('requested','queued','configuration_required');
 end if;
 if new.status='closed' and old.status is distinct from new.status then
   update public.job_distribution_requests
   set status='cancelled',updated_at=now()
   where company_id=new.company_id and job_id=new.id and provider='vorlen_careers' and status in ('requested','queued','published');
 end if;
 return new;
end
$function$;

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
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if nullif(btrim(coalesce(p_job->>'client_id','')),'') is null then raise exception 'Client is required'; end if;
  if nullif(btrim(coalesce(p_job->>'title','')),'') is null then raise exception 'Job title is required'; end if;
  if nullif(btrim(coalesce(p_job->>'description','')),'') is null then raise exception 'Description is required'; end if;

  if p_job_id is null then
    insert into public.jobs(
      company_id,client_id,title,slug,description,employment_type,location,salary_min,salary_max,
      commission_text,status,requirements,application_questions,application_mode,opportunity_notice,
      start_date,start_date_text,duration_text,duties,work_days_hours,health_safety_risks,health_safety_measures,
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
      status=coalesce(nullif(p_job->>'status',''),'draft')::public.job_status,requirements=v_requirements,
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
