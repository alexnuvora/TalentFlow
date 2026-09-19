-- Vorlen V3: client portal, candidate magic links and interview scheduling
alter table public.profiles add column if not exists client_id uuid references public.clients(id) on delete set null;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  scheduled_at timestamptz not null, duration_minutes integer not null default 30 check(duration_minutes between 10 and 480),
  meeting_url text, status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled','no_show')),
  recruiter_notes text, client_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_interviews_client on public.interviews(client_id,scheduled_at);
create index if not exists idx_interviews_candidate on public.interviews(candidate_id,scheduled_at);

create table if not exists public.candidate_portal_tokens (
  token text primary key, candidate_id uuid not null references public.candidates(id) on delete cascade,
  expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_candidate_portal_candidate on public.candidate_portal_tokens(candidate_id);
alter table public.interviews enable row level security;
alter table public.candidate_portal_tokens enable row level security;

-- Replace broad base policies with role-aware policies. Managers retain full company access; client users are read-only and scoped to client_id.
drop policy if exists "clients tenant" on public.clients;
drop policy if exists "jobs tenant" on public.jobs;
drop policy if exists "applications tenant" on public.applications;
drop policy if exists "candidates tenant" on public.candidates;
drop policy if exists "clients role aware" on public.clients;
drop policy if exists "clients staff write" on public.clients;
drop policy if exists "jobs role aware" on public.jobs;
drop policy if exists "jobs staff write" on public.jobs;
drop policy if exists "applications role aware" on public.applications;
drop policy if exists "applications staff write" on public.applications;
drop policy if exists "candidates role aware" on public.candidates;
drop policy if exists "candidates staff write" on public.candidates;
drop policy if exists "interviews role aware" on public.interviews;
drop policy if exists "interviews staff write" on public.interviews;

create policy "clients role aware" on public.clients for select using (company_id=public.current_company_id() and (public.is_manager() or ((select role from public.profiles where id=auth.uid())='viewer' and (select client_id from public.profiles where id=auth.uid())=id)));
create policy "clients staff insert" on public.clients for insert with check (company_id=public.current_company_id() and public.is_manager());
create policy "clients staff update" on public.clients for update using (company_id=public.current_company_id() and public.is_manager()) with check (company_id=public.current_company_id() and public.is_manager());
create policy "clients staff delete" on public.clients for delete using (company_id=public.current_company_id() and public.is_manager());
create policy "jobs role aware" on public.jobs for select using (company_id=public.current_company_id() and (public.is_manager() or client_id=(select client_id from public.profiles where id=auth.uid())));
create policy "jobs staff insert" on public.jobs for insert with check (company_id=public.current_company_id() and public.is_manager());
create policy "jobs staff update" on public.jobs for update using (company_id=public.current_company_id() and public.is_manager()) with check (company_id=public.current_company_id() and public.is_manager());
create policy "jobs staff delete" on public.jobs for delete using (company_id=public.current_company_id() and public.is_manager());
create policy "applications role aware" on public.applications for select using (company_id=public.current_company_id() and (public.is_manager() or job_id in (select id from public.jobs where client_id=(select client_id from public.profiles where id=auth.uid()))));
create policy "applications staff insert" on public.applications for insert with check (company_id=public.current_company_id() and public.is_manager());
create policy "applications staff update" on public.applications for update using (company_id=public.current_company_id() and public.is_manager()) with check (company_id=public.current_company_id() and public.is_manager());
create policy "applications staff delete" on public.applications for delete using (company_id=public.current_company_id() and public.is_manager());
create policy "candidates role aware" on public.candidates for select using (company_id=public.current_company_id() and (public.is_manager() or id in (select candidate_id from public.applications where job_id in (select id from public.jobs where client_id=(select client_id from public.profiles where id=auth.uid())))));
create policy "candidates staff insert" on public.candidates for insert with check (company_id=public.current_company_id() and public.is_manager());
create policy "candidates staff update" on public.candidates for update using (company_id=public.current_company_id() and public.is_manager()) with check (company_id=public.current_company_id() and public.is_manager());
create policy "candidates staff delete" on public.candidates for delete using (company_id=public.current_company_id() and public.is_manager());
create policy "interviews role aware" on public.interviews for select using (company_id=public.current_company_id() and (public.is_manager() or client_id=(select client_id from public.profiles where id=auth.uid())));
create policy "interviews staff insert" on public.interviews for insert with check (company_id=public.current_company_id() and public.is_manager());
create policy "interviews staff update" on public.interviews for update using (company_id=public.current_company_id() and public.is_manager()) with check (company_id=public.current_company_id() and public.is_manager());
create policy "interviews staff delete" on public.interviews for delete using (company_id=public.current_company_id() and public.is_manager());

create or replace function public.create_candidate_portal_token(p_candidate_id uuid, p_days integer default 30)
returns text language plpgsql security definer set search_path=public as $$
declare t text; begin
 if not exists(select 1 from candidates where id=p_candidate_id and company_id=current_company_id()) then raise exception 'Candidate not found'; end if;
 t:=encode(gen_random_bytes(32),'hex'); insert into candidate_portal_tokens(token,candidate_id,expires_at) values(t,p_candidate_id,now()+make_interval(days=>greatest(1,least(p_days,90)))); return t;
end; $$;
