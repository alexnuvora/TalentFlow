
-- Ensure converted commercial handoffs always result in usable partner portfolio assignments.

create or replace function public.ensure_partner_handoff_assignments(
  p_handoff uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_partner uuid;
  v_client uuid;
  v_job uuid;
  v_status text;
  v_specialism text;
  v_partner_active boolean;
begin
  select h.company_id,h.partner_id,h.client_id,h.approved_job_id,h.status
  into v_company,v_partner,v_client,v_job,v_status
  from public.partner_commercial_handoffs h
  where h.id=p_handoff;

  if v_status is distinct from 'converted' then
    return;
  end if;

  if v_client is null or v_job is null then
    raise exception 'Converted handoff must have both client and approved vacancy';
  end if;

  select pp.specialism,(pp.active and o.status='active' and p.role='partner')
  into v_specialism,v_partner_active
  from public.partner_profiles pp
  join public.partner_onboarding o
    on o.partner_id=pp.user_id and o.company_id=pp.company_id
  join public.profiles p
    on p.id=pp.user_id and p.company_id=pp.company_id
  where pp.user_id=v_partner and pp.company_id=v_company;

  if not coalesce(v_partner_active,false) then
    raise exception 'Converted handoff partner is not active';
  end if;

  if v_specialism not in ('lead_closer','hybrid') then
    raise exception 'Converted handoff partner must be a Lead Closer or Hybrid Partner';
  end if;

  if not exists(
    select 1 from public.clients c
    where c.id=v_client and c.company_id=v_company
  ) then
    raise exception 'Converted handoff client is not in the same workspace';
  end if;

  if not exists(
    select 1 from public.jobs j
    where j.id=v_job and j.company_id=v_company and j.client_id=v_client
  ) then
    raise exception 'Converted handoff vacancy must belong to the handoff client';
  end if;

  if not exists(
    select 1 from public.partner_assignments a
    where a.company_id=v_company
      and a.partner_id=v_partner
      and a.client_id=v_client
      and a.completed_at is null
  ) then
    insert into public.partner_assignments(
      company_id,partner_id,client_id,priority,objective
    ) values(
      v_company,v_partner,v_client,'high',
      'Own the active client relationship, maintain recruitment contacts and progress approved hiring requirements.'
    );
  end if;

  if not exists(
    select 1 from public.partner_assignments a
    where a.company_id=v_company
      and a.partner_id=v_partner
      and a.job_id=v_job
      and a.completed_at is null
  ) then
    insert into public.partner_assignments(
      company_id,partner_id,job_id,priority,objective
    ) values(
      v_company,v_partner,v_job,'high',
      'Deliver the approved Vorlen vacancy and progress suitable candidates through the controlled recruitment workflow.'
    );
  end if;
end
$$;

create or replace function public.sync_partner_handoff_assignments()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='converted'
     and (
       tg_op='INSERT'
       or old.status is distinct from new.status
       or old.client_id is distinct from new.client_id
       or old.approved_job_id is distinct from new.approved_job_id
       or old.partner_id is distinct from new.partner_id
     ) then
    perform public.ensure_partner_handoff_assignments(new.id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_sync_partner_handoff_assignments
on public.partner_commercial_handoffs;

create trigger trg_sync_partner_handoff_assignments
after insert or update of status,client_id,approved_job_id,partner_id
on public.partner_commercial_handoffs
for each row
execute function public.sync_partner_handoff_assignments();

revoke all on function public.ensure_partner_handoff_assignments(uuid)
from public,anon,authenticated;
revoke all on function public.sync_partner_handoff_assignments()
from public,anon,authenticated;

-- Repair previously converted handoffs.
do $$
declare r record;
begin
  for r in
    select h.id
    from public.partner_commercial_handoffs h
    where h.status='converted'
      and h.client_id is not null
      and h.approved_job_id is not null
  loop
    perform public.ensure_partner_handoff_assignments(r.id);
  end loop;
end
$$;
