-- Align role-visible application flows with database authorization boundaries.
-- Applied to production as migration 20260921234356.

create or replace function private.has_candidate_data_access()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.candidate_processing_allowed(private.current_company_id())
     and public.has_candidate_data_access()
$$;

drop policy if exists "clients role aware" on public.clients;
create policy "clients role aware"
on public.clients for select to authenticated
using (
  company_id = private.current_company_id()
  and (
    private.is_manager()
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='recruiter')
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='viewer' and p.client_id=clients.id)
    or (private.partner_is_active() and exists(
      select 1 from public.partner_assignments a
      where a.company_id=clients.company_id and a.partner_id=(select auth.uid())
        and a.client_id=clients.id and a.completed_at is null
    ))
  )
);

drop policy if exists "jobs authorised select" on public.jobs;
create policy "jobs authorised select"
on public.jobs for select to authenticated
using (
  company_id = private.current_company_id()
  and (
    private.is_manager()
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='recruiter')
    or client_id=(select p.client_id from public.profiles p where p.id=(select auth.uid()))
    or (private.partner_is_active() and exists(
      select 1 from public.partner_assignments a
      where a.company_id=jobs.company_id and a.partner_id=(select auth.uid())
        and a.job_id=jobs.id and a.completed_at is null
    ))
  )
);

drop policy if exists "interviews role aware" on public.interviews;
create policy "interviews role aware"
on public.interviews for select to authenticated
using (
  company_id = private.current_company_id()
  and (
    private.is_manager()
    or (public.has_candidate_data_access() and exists(
      select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='recruiter'
    ))
    or client_id=(select p.client_id from public.profiles p where p.id=(select auth.uid()))
  )
);

drop policy if exists "interviews staff insert" on public.interviews;
create policy "interviews staff insert"
on public.interviews for insert to authenticated
with check (
  company_id=private.current_company_id()
  and public.has_candidate_data_access()
  and public.candidate_processing_allowed(company_id)
);

drop policy if exists "calls staff" on public.call_notes;
drop policy if exists "call notes recruitment staff" on public.call_notes;
create policy "call notes recruitment staff"
on public.call_notes for all to authenticated
using (company_id=private.current_company_id() and private.has_candidate_data_access())
with check (company_id=private.current_company_id() and private.has_candidate_data_access());

drop policy if exists "screening staff" on public.screening_reports;
drop policy if exists "screening recruitment staff" on public.screening_reports;
create policy "screening recruitment staff"
on public.screening_reports for all to authenticated
using (company_id=private.current_company_id() and private.has_candidate_data_access())
with check (company_id=private.current_company_id() and private.has_candidate_data_access());

drop policy if exists "submissions read" on public.candidate_submissions;
create policy "submissions read"
on public.candidate_submissions for select to authenticated
using (
  company_id=private.current_company_id()
  and (
    private.has_candidate_data_access()
    or client_id=(select p.client_id from public.profiles p where p.id=(select auth.uid()))
  )
);

do $
declare ddl text;
begin
  select pg_get_functiondef('public.record_introduction_compliance(uuid,text,text,text,boolean,boolean,text)'::regprocedure) into ddl;
  if position('if auth.uid() is null or not public.is_manager() then' in ddl)=0 then
    raise exception 'record_introduction_compliance expected guard not found';
  end if;
  ddl:=replace(ddl,
    'if auth.uid() is null or not public.is_manager() then raise exception ''Staff access required''; end if;',
    'if auth.uid() is null or not public.has_candidate_data_access() or not public.candidate_processing_allowed(public.current_company_id()) then raise exception ''Approved recruitment staff access required''; end if;');
  execute ddl;

  select pg_get_functiondef('public.reserve_client_submission(uuid,text,text,text)'::regprocedure) into ddl;
  if position('if not public.is_manager() or auth.uid() is null then' in ddl)=0 then
    raise exception 'reserve_client_submission expected guard not found';
  end if;
  ddl:=replace(ddl,
    'if not public.is_manager() or auth.uid() is null then raise exception ''Staff access required'';end if;',
    'if auth.uid() is null or not public.has_candidate_data_access() or not public.candidate_processing_allowed(public.current_company_id()) then raise exception ''Approved recruitment staff access required'';end if;');
  execute ddl;

  select pg_get_functiondef('public.review_application(uuid,text,text)'::regprocedure) into ddl;
  if position('if not public.is_manager() or auth.uid() is null then' in ddl)=0 then
    raise exception 'review_application expected guard not found';
  end if;
  ddl:=replace(ddl,
    'if not public.is_manager() or auth.uid() is null then raise exception ''Staff access required'';end if;',
    'if auth.uid() is null or not public.has_candidate_data_access() or not public.candidate_processing_allowed(public.current_company_id()) then raise exception ''Approved recruitment staff access required'';end if;');
  execute ddl;

  select pg_get_functiondef('public.signoff_screening_report(uuid)'::regprocedure) into ddl;
  if position('select * into p from public.profiles where id=auth.uid() and role in (''owner'',''manager'',''recruiter'');' in ddl)=0 then
    raise exception 'signoff_screening_report expected role guard not found';
  end if;
  ddl:=replace(ddl,
    'select * into p from public.profiles where id=auth.uid() and role in (''owner'',''manager'',''recruiter'');if not found then raise exception ''Staff access required'';end if;',
    'if auth.uid() is null or not public.has_candidate_data_access() or not public.candidate_processing_allowed(public.current_company_id()) then raise exception ''Approved recruitment staff access required'';end if; select * into p from public.profiles where id=auth.uid(); if not found then raise exception ''Staff access required'';end if;');
  execute ddl;

  select pg_get_functiondef('public.manage_interview(uuid,text,timestamptz,integer,text,text)'::regprocedure) into ddl;
  if position('select * into p from public.profiles where id=auth.uid() and role in (''owner'',''manager'',''recruiter'');' in ddl)=0 then
    raise exception 'manage_interview expected role guard not found';
  end if;
  ddl:=replace(ddl,
    'select * into p from public.profiles where id=auth.uid() and role in (''owner'',''manager'',''recruiter'');if not found then raise exception ''Staff access required'';end if;',
    'if auth.uid() is null or not public.has_candidate_data_access() or not public.candidate_processing_allowed(public.current_company_id()) then raise exception ''Approved recruitment staff access required'';end if; select * into p from public.profiles where id=auth.uid(); if not found then raise exception ''Staff access required'';end if;');
  execute ddl;
end $;
