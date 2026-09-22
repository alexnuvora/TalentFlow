create table if not exists public.client_acquisition_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  event_type text not null check (event_type in ('contacted','conversation','qualified')),
  channel text,
  detail text,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists client_acquisition_events_company_type_idx on public.client_acquisition_events(company_id,event_type,occurred_at desc);
alter table public.client_acquisition_events enable row level security;
revoke all on public.client_acquisition_events from anon;
grant select,insert,update,delete on public.client_acquisition_events to authenticated;
create policy "workspace members read acquisition events" on public.client_acquisition_events for select to authenticated using (company_id = public.current_company_id());
create policy "workspace staff create acquisition events" on public.client_acquisition_events for insert to authenticated with check (company_id = public.current_company_id());
create policy "workspace managers update acquisition events" on public.client_acquisition_events for update to authenticated using (company_id = public.current_company_id() and public.is_manager()) with check (company_id = public.current_company_id() and public.is_manager());
create policy "workspace managers delete acquisition events" on public.client_acquisition_events for delete to authenticated using (company_id = public.current_company_id() and public.is_manager());

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  placement_id uuid not null references public.placements(id) on delete cascade,
  partner_user_id uuid references auth.users(id) on delete set null,
  rate numeric(7,4) not null default 0.30 check (rate >= 0 and rate <= 1),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'accrued' check (status in ('accrued','approved','paid','void')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(placement_id,partner_user_id)
);
create index if not exists partner_commissions_company_status_idx on public.partner_commissions(company_id,status);
alter table public.partner_commissions enable row level security;
revoke all on public.partner_commissions from anon;
grant select on public.partner_commissions to authenticated;
grant insert,update,delete on public.partner_commissions to authenticated;
create policy "workspace members read commissions" on public.partner_commissions for select to authenticated using (company_id = public.current_company_id());
create policy "workspace managers create commissions" on public.partner_commissions for insert to authenticated with check (company_id = public.current_company_id() and public.is_manager());
create policy "workspace managers update commissions" on public.partner_commissions for update to authenticated using (company_id = public.current_company_id() and public.is_manager()) with check (company_id = public.current_company_id() and public.is_manager());
create policy "workspace managers delete commissions" on public.partner_commissions for delete to authenticated using (company_id = public.current_company_id() and public.is_manager());
