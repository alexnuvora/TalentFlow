alter table public.candidate_submissions
  add column if not exists client_safe_cv_text text,
  add column if not exists client_safe_cv_generated_at timestamptz,
  add column if not exists client_safe_cv_source_hash text;

create or replace function public.client_portal_data_authorised()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  p public.profiles%rowtype;
  result jsonb;
begin
  select * into p
  from public.profiles
  where id=auth.uid() and role='viewer' and client_id is not null;
  if not found then raise exception 'Client access required'; end if;
  select jsonb_build_object(
    'client',(select jsonb_build_object('company_name',company_name) from public.clients where id=p.client_id and company_id=p.company_id),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'location',location,'employment_type',employment_type)) from public.jobs where client_id=p.client_id and company_id=p.company_id),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'status',s.status,'feedback',s.client_feedback,'summary',s.recruiter_summary,
        'headline',s.headline,'key_strengths',coalesce(s.key_strengths,'[]'::jsonb),
        'concerns',coalesce(s.concerns,'[]'::jsonb),'submitted_at',s.submitted_at,
        'has_cv',(c.resume_path is not null),
        'candidates',jsonb_build_object(
          'full_name',c.full_name,'location',c.location,
          'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,
          'authorisations',c.authorisations
        ),
        'jobs',jsonb_build_object('title',j.title)
      ))
      from public.candidate_submissions s
      join public.candidates c on c.id=s.candidate_id
      join public.jobs j on j.id=s.job_id
      where s.client_id=p.client_id and s.company_id=p.company_id
        and s.status not in ('draft','withdrawn','approved_to_send')
    ),'[]'::jsonb),
    'interviews',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,
        'meeting_url',i.meeting_url,'status',i.status,
        'candidates',jsonb_build_object('full_name',c.full_name),
        'jobs',jsonb_build_object('title',j.title)
      ))
      from public.interviews i
      join public.candidates c on c.id=i.candidate_id
      join public.jobs j on j.id=i.job_id
      where i.client_id=p.client_id and i.company_id=p.company_id
        and exists(
          select 1 from public.candidate_submissions s
          where s.candidate_id=i.candidate_id and s.job_id=i.job_id
            and s.client_id=p.client_id
            and s.status not in ('draft','withdrawn','approved_to_send')
        )
    ),'[]'::jsonb)
  ) into result;
  return result;
end
$function$;

create or replace function public.reserve_client_submission(p_application uuid, p_summary text, p_authorisation text, p_recipient text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  a public.applications%rowtype;
  j public.jobs%rowtype;
  cl public.clients%rowtype;
  c public.candidates%rowtype;
  s public.candidate_submissions%rowtype;
  delivery uuid;
  co public.companies%rowtype;
begin
  if auth.uid() is null or not public.has_candidate_data_access() or not public.candidate_processing_allowed(public.current_company_id()) then raise exception 'Approved recruitment staff access required'; end if;
  select * into a from public.applications where id=p_application and company_id=public.current_company_id() for update;
  if not found then raise exception 'Application unavailable'; end if;

  select * into j from public.jobs where id=a.job_id and company_id=a.company_id;
  if not found then raise exception 'Job unavailable'; end if;
  select * into cl from public.clients where id=j.client_id and company_id=a.company_id and status='active';
  if not found or cl.email is null or lower(trim(p_recipient))<>lower(trim(cl.email)) then raise exception 'Confirm the active client contact recorded for this opportunity'; end if;
  if cl.terms_accepted_at is null
     or cl.terms_version <> 'client-tob-2026-09-21'
     or cl.recruitment_fee_percent is null
     or cl.payment_terms_days is null
     or coalesce(trim(cl.terms_accepted_by),'')=''
     or coalesce(trim(cl.terms_evidence),'')='' then
    raise exception 'Current Vorlen Terms of Business must be accepted and evidenced before candidate introduction';
  end if;

  select * into s from public.candidate_submissions where application_id=a.id;
  if found then return jsonb_build_object('existing',true,'submission_id',s.id,'status',s.status); end if;

  if a.status<>'qualified' then raise exception 'Record a human qualification decision before submission'; end if;
  if a.vacancy_particulars_provided_at is null or a.willingness_confirmed_at is null or coalesce(trim(a.willingness_evidence),'')='' then raise exception 'Record that Regulation 18 particulars were provided and the candidate confirmed willingness for this position'; end if;
  if a.suitability_checked_at is null or coalesce(trim(a.suitability_evidence),'')='' then raise exception 'Complete and evidence the Regulation 20 suitability check before introduction'; end if;
  if length(trim(coalesce(p_summary,'')))<10 or length(p_summary)>8000 or length(trim(coalesce(p_authorisation,'')))<10 then raise exception 'Reviewed summary and candidate permission required'; end if;
  if exists(select 1 from public.screening_reports where application_id=a.id and reviewed_at is null) then raise exception 'Review screening evidence before sharing'; end if;
  if j.application_mode='register_interest' or j.status::text<>'published' or j.agency_service_type<>'permanent_employment' then raise exception 'Candidate introductions require a current authorised permanent vacancy'; end if;
  if j.qualification_verification_required and (a.qualification_verified_at is null or coalesce(trim(a.qualification_verification_evidence),'')='') then raise exception 'Required qualification/authorisation evidence must be checked before introduction'; end if;
  if j.works_with_vulnerable_people and (a.reference_1_verified_at is null or a.reference_2_verified_at is null or coalesce(trim(a.vulnerable_checks_evidence),'')='') then raise exception 'Two references and vulnerable-person suitability checks are required before introduction'; end if;

  select * into co from public.companies where id=a.company_id;
  if co.legal_name is null or co.legal_address is null or co.privacy_email is null then raise exception 'Agency legal identity must be configured'; end if;
  select * into c from public.candidates where id=a.candidate_id and company_id=a.company_id and erased_at is null;
  if not found then raise exception 'Candidate unavailable'; end if;
  if coalesce(trim(c.postal_address),'')='' or c.under_22 is null or (c.under_22 and c.date_of_birth is null) then raise exception 'Required work-seeker record particulars are incomplete'; end if;
  if coalesce(a.work_seeker_terms_agreed_at,c.work_seeker_terms_agreed_at) is null then raise exception 'Work-seeker terms must be agreed before work-finding services or introduction'; end if;
  if coalesce(trim(c.experience_summary),'')='' or coalesce(trim(c.training_qualifications),'')='' or coalesce(trim(c.authorisations),'')='' then raise exception 'Candidate experience, training/qualifications and authorisations must be recorded before introduction'; end if;

  insert into public.outbound_deliveries(company_id,kind,idempotency_key,recipient,provider,status)
  values(a.company_id,'client_submission','submission:'||a.id,cl.email,'resend','reserved')
  returning id into delivery;

  insert into public.candidate_submissions(company_id,client_id,job_id,candidate_id,application_id,submitted_by,headline,recruiter_summary,status,recipient_email,reviewed_by,review_confirmed_at,delivery_id,candidate_authorisation,regulation21_confirmed_at,willingness_statement)
  values(a.company_id,cl.id,j.id,c.id,a.id,auth.uid(),c.full_name||' — '||j.title,p_summary,'approved_to_send',cl.email,auth.uid(),now(),delivery,p_authorisation,now(),'Candidate confirmed willingness for this specific position: '||a.willingness_evidence)
  returning * into s;

  update public.candidates set last_work_finding_service_at=now(),statutory_retain_until=greatest(coalesce(statutory_retain_until,'epoch'::timestamptz),now()+interval '1 year') where id=c.id;
  update public.clients set last_service_at=now(),statutory_retain_until=greatest(coalesce(statutory_retain_until,'epoch'::timestamptz),now()+interval '1 year') where id=cl.id;
  return jsonb_build_object('existing',false,'submission_id',s.id,'delivery_id',delivery,'company_id',a.company_id,'recipient',cl.email);
end
$function$;
