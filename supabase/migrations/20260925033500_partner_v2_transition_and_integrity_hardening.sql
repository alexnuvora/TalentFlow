
-- Final hardening for partner v2 role transitions and contact/target integrity.

-- Ensure only one primary recruitment contact can exist per client.
with ranked as (
  select id,row_number() over(
    partition by company_id,client_id
    order by coalesce(last_confirmed_at,updated_at,created_at) desc,id
  ) rn
  from public.client_recruitment_contacts
  where is_primary
)
update public.client_recruitment_contacts c
set is_primary=false,updated_at=now()
from ranked r
where c.id=r.id and r.rn>1;

create unique index if not exists client_recruitment_contacts_one_primary_uq
  on public.client_recruitment_contacts(company_id,client_id)
  where is_primary;

-- KPI targets are operational goals; keep malformed direct writes out of the database.
do $$
begin
  if not exists(select 1 from pg_constraint where conname='partner_profiles_target_calls_range') then
    alter table public.partner_profiles add constraint partner_profiles_target_calls_range check(target_calls between 0 and 10000);
  end if;
  if not exists(select 1 from pg_constraint where conname='partner_profiles_target_meetings_range') then
    alter table public.partner_profiles add constraint partner_profiles_target_meetings_range check(target_meetings between 0 and 10000);
  end if;
  if not exists(select 1 from pg_constraint where conname='partner_profiles_target_placements_range') then
    alter table public.partner_profiles add constraint partner_profiles_target_placements_range check(target_placements between 0 and 10000);
  end if;
  if not exists(select 1 from pg_constraint where conname='partner_profiles_target_qualified_opportunities_range') then
    alter table public.partner_profiles add constraint partner_profiles_target_qualified_opportunities_range check(target_qualified_opportunities between 0 and 10000);
  end if;
  if not exists(select 1 from pg_constraint where conname='partner_profiles_target_tob_acceptances_range') then
    alter table public.partner_profiles add constraint partner_profiles_target_tob_acceptances_range check(target_tob_acceptances between 0 and 10000);
  end if;
  if not exists(select 1 from pg_constraint where conname='partner_profiles_target_candidate_recommendations_range') then
    alter table public.partner_profiles add constraint partner_profiles_target_candidate_recommendations_range check(target_candidate_recommendations between 0 and 10000);
  end if;
end $$;

create or replace function public.set_partner_specialism(p_partner uuid,p_specialism text)
returns void
language plpgsql
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_status text;
  v_old_specialism text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_specialism not in ('b2b_advisor','lead_closer','candidate_sourcer','hybrid') then
    raise exception 'Invalid partner specialism';
  end if;

  select o.status,pp.specialism into v_status,v_old_specialism
  from public.partner_onboarding o
  join public.profiles p on p.id=o.partner_id and p.company_id=o.company_id and p.role='partner'
  left join public.partner_profiles pp on pp.user_id=o.partner_id and pp.company_id=o.company_id
  where o.partner_id=p_partner and o.company_id=v_company;

  if v_status is null then raise exception 'Partner onboarding record not found'; end if;
  if v_status='terminated' then raise exception 'Terminated partners cannot be reconfigured'; end if;
  if coalesce(v_old_specialism,p_specialism)=p_specialism then return; end if;

  -- Removing all employer-development capability requires client work to be handed off first.
  if p_specialism not in ('b2b_advisor','lead_closer','hybrid') and exists(
    select 1 from public.partner_assignments a
    where a.company_id=v_company and a.partner_id=p_partner
      and a.client_id is not null and a.completed_at is null
  ) then
    raise exception 'Complete or reassign active client assignments before removing employer-development permission';
  end if;

  -- Removing prospecting must not strand partner-owned leads or an advisor-to-closer request.
  if p_specialism not in ('b2b_advisor','hybrid') then
    if exists(
      select 1 from public.partner_prospects p
      where p.company_id=v_company and p.partner_id=p_partner
        and p.status in ('prospect','contacted','interested','handoff_ready','under_review')
    ) then
      raise exception 'Resolve or transfer active partner prospects before removing B2B Advisor permission';
    end if;
    if exists(
      select 1 from public.partner_client_handover_requests h
      where h.company_id=v_company and h.from_partner=p_partner and h.status='requested'
    ) then
      raise exception 'Resolve pending advisor-to-closer handovers before removing B2B Advisor permission';
    end if;
  end if;

  -- Removing closer capability must not strand contractual conversion work.
  if p_specialism not in ('lead_closer','hybrid') then
    if exists(
      select 1 from public.partner_commercial_handoffs h
      where h.company_id=v_company and h.partner_id=p_partner
        and h.status in ('draft','submitted','under_review','terms_approved')
    ) then
      raise exception 'Resolve active commercial handoffs before removing Lead Closer permission';
    end if;
    if exists(
      select 1
      from public.partner_assignments a
      join public.clients c on c.id=a.client_id and c.company_id=a.company_id
      where a.company_id=v_company and a.partner_id=p_partner
        and a.client_id is not null and a.completed_at is null
        and c.terms_accepted_at is null
        and c.partner_terms_send_authorized_at is not null
    ) then
      raise exception 'Revoke or complete manager-authorised Terms of Business work before removing Lead Closer permission';
    end if;
  end if;

  -- Removing recruiting capability must not strand candidate work or access requests.
  if p_specialism not in ('candidate_sourcer','hybrid') then
    if exists(
      select 1 from public.partner_assignments a
      where a.company_id=v_company and a.partner_id=p_partner
        and a.candidate_id is not null and a.completed_at is null
    ) then
      raise exception 'Complete or reassign active candidate assignments before removing Recruiter permission';
    end if;
    if exists(
      select 1 from public.partner_candidate_access_requests r
      where r.company_id=v_company and r.partner_id=p_partner and r.status='pending'
    ) then
      raise exception 'Resolve pending candidate access requests before removing Recruiter permission';
    end if;
  end if;

  insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
  values(p_partner,v_company,p_specialism,v_status='active',now())
  on conflict(user_id) do update
    set specialism=excluded.specialism,
        active=excluded.active,
        updated_at=excluded.updated_at;
end
$$;
