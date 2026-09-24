create table if not exists public.partner_commercial_handoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  prospect_company text,
  contact_name text,
  contact_email text,
  contact_phone text,
  vacancy_title text not null,
  vacancy_location text,
  salary_context text,
  hiring_need text not null,
  commercial_request text,
  status text not null default 'draft'
    check (status in ('draft','submitted','under_review','terms_approved','declined','converted')),
  manager_notes text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approved_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id is not null or nullif(btrim(prospect_company),'') is not null)
);

create index if not exists idx_partner_handoffs_partner_status
  on public.partner_commercial_handoffs(company_id,partner_id,status,updated_at desc);
create index if not exists idx_partner_handoffs_client
  on public.partner_commercial_handoffs(company_id,client_id)
  where client_id is not null;

alter table public.partner_commercial_handoffs enable row level security;

drop policy if exists "partner handoffs select" on public.partner_commercial_handoffs;
create policy "partner handoffs select"
on public.partner_commercial_handoffs for select to authenticated
using (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
);

drop policy if exists "partner handoffs insert" on public.partner_commercial_handoffs;
create policy "partner handoffs insert"
on public.partner_commercial_handoffs for insert to authenticated
with check (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
);

drop policy if exists "partner handoffs update" on public.partner_commercial_handoffs;
create policy "partner handoffs update"
on public.partner_commercial_handoffs for update to authenticated
using (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
)
with check (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
);

create or replace function public.enforce_partner_handoff_boundary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_privileged boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
  new.updated_at := now();

  if v_privileged then
    if new.status in ('terms_approved','converted') and new.approved_at is null then
      new.approved_at := now();
      new.approved_by := coalesce(new.approved_by, auth.uid());
    end if;
    return new;
  end if;

  if not private.partner_is_active() then
    raise exception 'Active partner access required';
  end if;

  if tg_op = 'INSERT' then
    new.company_id := private.current_company_id();
    new.partner_id := auth.uid();
    new.manager_notes := null;
    new.approved_by := null;
    new.approved_at := null;
    new.approved_job_id := null;
    if new.status not in ('draft','submitted') then new.status := 'draft'; end if;
  else
    if old.partner_id <> auth.uid() or old.company_id <> private.current_company_id() then
      raise exception 'You may only update your own commercial handoffs';
    end if;
    new.company_id := old.company_id;
    new.partner_id := old.partner_id;
    new.client_id := old.client_id;
    new.manager_notes := old.manager_notes;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.approved_job_id := old.approved_job_id;
    if old.status not in ('draft','submitted') then
      raise exception 'This handoff is under Vorlen review and can no longer be edited by the partner';
    end if;
    if new.status not in ('draft','submitted') then
      raise exception 'Partners can only save a draft or submit for Vorlen review';
    end if;
  end if;

  if new.client_id is not null and not exists (
    select 1 from public.partner_assignments a
    where a.company_id = new.company_id
      and a.partner_id = auth.uid()
      and a.client_id = new.client_id
      and a.completed_at is null
  ) then
    raise exception 'The selected client is not assigned to your partner portfolio';
  end if;

  return new;
end
$$;

drop trigger if exists trg_partner_handoff_boundary on public.partner_commercial_handoffs;
create trigger trg_partner_handoff_boundary
before insert or update on public.partner_commercial_handoffs
for each row execute function public.enforce_partner_handoff_boundary();

revoke all on function public.enforce_partner_handoff_boundary() from public,anon,authenticated;
grant execute on function public.enforce_partner_handoff_boundary() to service_role;

revoke all on table public.partner_commercial_handoffs from anon;
grant select,insert,update on table public.partner_commercial_handoffs to authenticated;
grant all on table public.partner_commercial_handoffs to service_role;
