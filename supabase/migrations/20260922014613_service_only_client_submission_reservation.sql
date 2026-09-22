create or replace function public.reserve_client_submission_service(
  p_actor uuid,
  p_application uuid,
  p_summary text,
  p_authorisation text,
  p_recipient text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
declare
  actor public.profiles%rowtype;
  a public.applications%rowtype;
  j public.jobs%rowtype;
  cl public.clients%rowtype;
  c public.candidates%rowtype;
  s public.candidate_submissions%rowtype;
  delivery uuid;
  co public.companies%rowtype;
begin
  select * into actor from public.profiles where id=p_actor;
  if not found or actor.role not in ('owner','manager','recruiter') then raise exception 'Approved recruitment staff access required'; end if;
  if actor.role='recruiter' and not exists(
    select 1 from public.recruiter_data_access_approvals r
    where r.user_id=p_actor and r.company_id=actor.company_id
      and r.approved_at is not null and r.revoked_at is null
      and (r.expires_at is null or r.expires_at>now())
  ) then raise exception 'Approved recruitment staff access required'; end if;
  if not public.candidate_processing_allowed(actor.company_id) then raise exception 'Candidate processing is not currently active'; end if;

  select * into a from public.applications where id=p_application and company_id=actor.company_id for update;
  if not found then raise exception 'Application unavailable'; end if;
  select * into j from public.jobs where id=a.job_id and company_id=a.company_id;
  if not found then raise exception 'Job unavailable'; end if;
  select * into cl from public.clients where id=j.client_id and company_id=a.company_id and status='active';
  if not found or cl.email is null or lower(trim(p_recipient))<>lower(trim(cl.email)) then raise exception 'Confirm the active client contact recorded for this opportunity'; end if;
  if cl.terms_accepted_at is null or cl.terms_version <> 'client-tob-2026-09-21'
     or cl.recruitment_fee_percent is null or cl.payment_terms_days is null
     or coalesce(trim(cl.terms_accepted_by),'')='' or coalesce(trim(cl.terms_evidence),'')='' then
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
  values(a.company_id,cl.id,j.id,c.id,a.id,p_actor,c.full_name||' — '||j.title,p_summary,'approved_to_send',cl.email,p_actor,now(),delivery,p_authorisation,now(),'Candidate confirmed willingness for this specific position: '||a.willingness_evidence)
  returning * into s;

  update public.candidates set last_work_finding_service_at=now(),statutory_retain_until=greatest(coalesce(statutory_retain_until,'epoch'::timestamptz),now()+interval '1 year') where id=c.id;
  update public.clients set last_service_at=now(),statutory_retain_until=greatest(coalesce(statutory_retain_until,'epoch'::timestamptz),now()+interval '1 year') where id=cl.id;

  return jsonb_build_object('existing',false,'submission_id',s.id,'delivery_id',delivery,'company_id',a.company_id,'recipient',cl.email);
end
$function$;

revoke execute on function public.reserve_client_submission_service(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.reserve_client_submission_service(uuid,uuid,text,text,text) to service_role;
