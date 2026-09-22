alter table public.candidate_submissions
  add column if not exists client_safe_cv_text text,
  add column if not exists client_safe_cv_generated_at timestamptz,
  add column if not exists client_safe_cv_source_hash text;

do $$
declare ddl text;
begin
  select pg_get_functiondef('public.client_portal_data_authorised()'::regprocedure) into ddl;
  ddl:=replace(ddl,',''linkedin_url'',c.linkedin_url','');
  ddl:=replace(ddl,'(c.resume_path is not null or c.cv_url is not null)','(c.resume_path is not null)');
  execute ddl;

  select pg_get_functiondef('public.reserve_client_submission(uuid,text,text,text)'::regprocedure) into ddl;
  ddl:=replace(
    ddl,
    'if cl.terms_accepted_at is null or cl.terms_version is null or cl.recruitment_fee_percent is null or cl.payment_terms_days is null then raise exception ''Client terms of business must be agreed before candidate introduction'';end if;',
    'if cl.terms_accepted_at is null or cl.terms_version <> ''client-tob-2026-09-21'' or cl.recruitment_fee_percent is null or cl.payment_terms_days is null or coalesce(trim(cl.terms_accepted_by),'''')='''' or coalesce(trim(cl.terms_evidence),'''')='''' then raise exception ''Current Vorlen Terms of Business must be accepted and evidenced before candidate introduction'';end if;'
  );
  ddl:=replace(
    ddl,
    'select * into s from public.candidate_submissions where application_id=a.id;if found then return jsonb_build_object(''existing'',true,''submission_id'',s.id,''status'',s.status);end if;',
    'select * into j from public.jobs where id=a.job_id and company_id=a.company_id; if not found then raise exception ''Job unavailable''; end if; select * into cl from public.clients where id=j.client_id and company_id=a.company_id and status=''active''; if not found or cl.email is null or lower(trim(p_recipient))<>lower(trim(cl.email)) then raise exception ''Confirm the active client contact recorded for this opportunity''; end if; if cl.terms_accepted_at is null or cl.terms_version <> ''client-tob-2026-09-21'' or cl.recruitment_fee_percent is null or cl.payment_terms_days is null or coalesce(trim(cl.terms_accepted_by),'''')='''' or coalesce(trim(cl.terms_evidence),'''')='''' then raise exception ''Current Vorlen Terms of Business must be accepted and evidenced before candidate introduction''; end if; select * into s from public.candidate_submissions where application_id=a.id; if found then return jsonb_build_object(''existing'',true,''submission_id'',s.id,''status'',s.status); end if;'
  );
  execute ddl;
end $$;
