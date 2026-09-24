alter table public.companies
  add column if not exists candidate_test_mode_until timestamptz;

create or replace function public.candidate_processing_allowed(p_company_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select coalesce((
    select
      (
        operating_phase='candidate_operations'
        and ico_status in ('exempt','registered')
        and (ico_status <> 'registered' or nullif(btrim(ico_registration_number),'') is not null)
      )
      or
      (
        operating_phase='pre_trading'
        and candidate_test_mode_until is not null
        and candidate_test_mode_until > now()
      )
    from public.companies
    where id=p_company_id
  ),false)
$function$;

create or replace function public.set_candidate_test_mode(p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company uuid:=public.current_company_id();
  v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.company_id=v_company and p.role='owner'
  ) then
    raise exception 'Owner access required';
  end if;

  if p_hours < 0 or p_hours > 168 then
    raise exception 'Test mode duration must be between 0 and 168 hours';
  end if;

  if p_hours=0 then
    update public.companies set candidate_test_mode_until=null where id=v_company;
    v_until:=null;
  else
    if not exists(
      select 1 from public.companies c
      where c.id=v_company and c.operating_phase='pre_trading'
    ) then
      raise exception 'Candidate test mode is only available while the workspace is pre-trading';
    end if;
    v_until:=now()+make_interval(hours=>p_hours);
    update public.companies set candidate_test_mode_until=v_until where id=v_company;
  end if;

  return jsonb_build_object(
    'active', public.candidate_processing_allowed(v_company),
    'test_mode', v_until is not null and v_until>now(),
    'test_until', v_until
  );
end
$function$;

create or replace function public.candidate_processing_status()
returns jsonb
language plpgsql
security definer
stable
set search_path to ''
as $function$
declare
  v_company uuid:=public.current_company_id();
  v_company_row public.companies%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_company_row from public.companies where id=v_company;
  if not found then raise exception 'Workspace not found'; end if;

  return jsonb_build_object(
    'active', public.candidate_processing_allowed(v_company),
    'test_mode', v_company_row.candidate_test_mode_until is not null and v_company_row.candidate_test_mode_until>now(),
    'test_until', v_company_row.candidate_test_mode_until,
    'operating_phase', v_company_row.operating_phase,
    'ico_status', v_company_row.ico_status,
    'ico_registration_number', v_company_row.ico_registration_number
  );
end
$function$;

revoke all on function public.set_candidate_test_mode(integer) from public;
grant execute on function public.set_candidate_test_mode(integer) to authenticated;
revoke all on function public.candidate_processing_status() from public;
grant execute on function public.candidate_processing_status() to authenticated;
