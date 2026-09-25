
create or replace function private.enforce_partner_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_partner_company uuid;
  v_specialism text;
  v_active boolean;
begin
  select p.company_id,pp.specialism,(o.status='active' and pp.active)
  into v_partner_company,v_specialism,v_active
  from public.profiles p
  join public.partner_profiles pp on pp.user_id=p.id and pp.company_id=p.company_id
  join public.partner_onboarding o on o.partner_id=p.id and o.company_id=p.company_id
  where p.id=new.partner_id and p.role='partner';

  if v_partner_company is null or v_partner_company<>new.company_id then
    raise exception 'Partner assignment must belong to the same workspace as the partner';
  end if;

  if new.client_id is not null and not exists(
    select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id
  ) then raise exception 'Assigned client must belong to the same workspace'; end if;

  if new.candidate_id is not null and not exists(
    select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id
  ) then raise exception 'Assigned candidate must belong to the same workspace'; end if;

  if new.job_id is not null and not exists(
    select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id
  ) then raise exception 'Assigned vacancy must belong to the same workspace'; end if;

  if new.completed_at is null then
    if not coalesce(v_active,false) then
      raise exception 'Only active partners can receive active assignments';
    end if;

    if new.client_id is not null and v_specialism not in ('b2b_advisor','lead_closer','hybrid') then
      raise exception 'Client assignments are not enabled for this partner specialism';
    end if;

    if new.candidate_id is not null then
      if v_specialism not in ('candidate_sourcer','hybrid') then
        raise exception 'Candidate assignments are not enabled for this partner specialism';
      end if;
      if not public.candidate_processing_allowed(new.company_id) then
        raise exception 'Candidate processing is not active';
      end if;
    end if;

    if new.job_id is not null and v_specialism not in ('lead_closer','candidate_sourcer','hybrid') then
      raise exception 'Vacancy assignments are only enabled for Lead Closer, Recruiter and Hybrid Partner profiles';
    end if;
  end if;

  return new;
end
$$;
