create table if not exists public.partner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  specialism text not null default 'b2b_advisor' check (specialism in ('b2b_advisor','lead_closer','candidate_sourcer','hybrid')),
  target_calls integer not null default 30 check (target_calls >= 0),
  target_meetings integer not null default 5 check (target_meetings >= 0),
  target_placements integer not null default 2 check (target_placements >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_profiles enable row level security;
grant select,insert,update on public.partner_profiles to authenticated;
create policy "partner profiles read workspace" on public.partner_profiles for select to authenticated
using (company_id = current_company_id());
create policy "partner profiles managers manage" on public.partner_profiles for all to authenticated
using (company_id=current_company_id() and is_manager())
with check (company_id=current_company_id() and is_manager());

create table if not exists public.partner_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  objective text,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  check (num_nonnulls(client_id,candidate_id,job_id)=1)
);
create unique index if not exists partner_assignments_client_uq on public.partner_assignments(company_id,partner_id,client_id) where client_id is not null;
create unique index if not exists partner_assignments_candidate_uq on public.partner_assignments(company_id,partner_id,candidate_id) where candidate_id is not null;
create unique index if not exists partner_assignments_job_uq on public.partner_assignments(company_id,partner_id,job_id) where job_id is not null;
create index if not exists partner_assignments_partner_idx on public.partner_assignments(partner_id,completed_at,due_at);
alter table public.partner_assignments enable row level security;
grant select,insert,update,delete on public.partner_assignments to authenticated;
create policy "partner assignments read" on public.partner_assignments for select to authenticated
using (company_id=current_company_id() and (partner_id=(select auth.uid()) or is_manager()));
create policy "partner assignments managers insert" on public.partner_assignments for insert to authenticated
with check (company_id=current_company_id() and is_manager());
create policy "partner assignments managers update" on public.partner_assignments for update to authenticated
using (company_id=current_company_id() and is_manager()) with check (company_id=current_company_id() and is_manager());
create policy "partner assignments managers delete" on public.partner_assignments for delete to authenticated
using (company_id=current_company_id() and is_manager());

create table if not exists public.partner_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'follow_up' check(task_type in ('call','email','follow_up','meeting','source_candidates','screen_candidate','submit_candidate','admin')),
  client_id uuid references public.clients(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  due_at timestamptz,
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists partner_tasks_partner_idx on public.partner_tasks(partner_id,status,due_at);
alter table public.partner_tasks enable row level security;
grant select,insert,update,delete on public.partner_tasks to authenticated;
create policy "partner tasks own or manager read" on public.partner_tasks for select to authenticated
using (company_id=current_company_id() and (partner_id=(select auth.uid()) or is_manager()));
create policy "partner tasks create" on public.partner_tasks for insert to authenticated
with check (company_id=current_company_id() and (partner_id=(select auth.uid()) or is_manager()));
create policy "partner tasks update" on public.partner_tasks for update to authenticated
using (company_id=current_company_id() and (partner_id=(select auth.uid()) or is_manager()))
with check (company_id=current_company_id() and (partner_id=(select auth.uid()) or is_manager()));
create policy "partner tasks delete" on public.partner_tasks for delete to authenticated
using (company_id=current_company_id() and (partner_id=(select auth.uid()) or is_manager()));

create policy "partner assigned candidates select" on public.candidates for select to authenticated
using (company_id=current_company_id() and exists(select 1 from public.partner_assignments a where a.company_id=candidates.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=candidates.id and a.completed_at is null));
create policy "candidate sourcer insert" on public.candidates for insert to authenticated
with check (company_id=current_company_id() and exists(select 1 from public.partner_profiles pp where pp.user_id=(select auth.uid()) and pp.company_id=candidates.company_id and pp.active and pp.specialism in ('candidate_sourcer','hybrid')));
create policy "partner assigned candidates update" on public.candidates for update to authenticated
using (company_id=current_company_id() and exists(select 1 from public.partner_assignments a where a.company_id=candidates.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=candidates.id and a.completed_at is null))
with check (company_id=current_company_id());

create policy "partner assigned jobs select" on public.jobs for select to authenticated
using (company_id=current_company_id() and exists(select 1 from public.partner_assignments a where a.company_id=jobs.company_id and a.partner_id=(select auth.uid()) and a.job_id=jobs.id and a.completed_at is null));
