-- Transactional recruiter candidate + vacancy handoff.
-- The existing audited source_partner_candidate implementation remains authoritative for
-- candidate identity, consent, attribution, and partner portfolio assignment.
create or replace function public.source_partner_candidate_for_job(
 p_full_name text,
 p_email text,
 p_job uuid default null,
 p_phone text default null,
 p_location text default null,
 p_linkedin_url text default null
)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
 v_user uuid:=auth.uid();
 v_candidate uuid;
begin
 if v_user is null or v_company is null then
  raise exception 'Authenticated partner workspace required';
 end if;
 if p_job is not null then
  if not exists (
   select 1 from public.partner_assignments a
   join public.jobs j on j.id=a.job_id and j.company_id=a.company_id
   where a.company_id=v_company and a.partner_id=v_user
     and a.job_id=p_job and a.completed_at is null
  ) then
   raise exception 'Select an assigned Vorlen vacancy before sourcing a candidate';
  end if;
  if not private.partner_job_sourcing_allowed(p_job,v_company) then
   raise exception 'This vacancy is not approved for candidate sourcing';
  end if;
 end if;
 v_candidate:=private.source_partner_candidate_impl(
  p_full_name,p_email,p_phone,p_location,p_linkedin_url
 );
 if p_job is not null then
  insert into public.partner_candidate_pipeline(
   company_id,partner_id,candidate_id,job_id,stage,next_action
  ) values (
   v_company,v_user,v_candidate,p_job,'sourced',
   'Screen candidate and confirm work-seeker terms'
  );
 end if;
 return v_candidate;
end;
$$;
revoke all on function public.source_partner_candidate_for_job(text,text,uuid,text,text,text) from public,anon;
grant execute on function public.source_partner_candidate_for_job(text,text,uuid,text,text,text) to authenticated;
