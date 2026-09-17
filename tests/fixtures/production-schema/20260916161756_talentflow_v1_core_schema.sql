create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type public.user_role as enum ('owner','recruiter','manager','viewer');
create type public.job_status as enum ('draft','published','paused','closed');
create type public.candidate_stage as enum ('new','screening','qualified','submitted','interview','offer','placed','rejected','withdrawn');
create type public.client_status as enum ('prospect','active','paused','closed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'recruiter',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  status public.client_status not null default 'prospect',
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  slug text not null,
  description text not null,
  employment_type text not null default 'Permanent',
  location text not null default 'UK',
  salary_min numeric,
  salary_max numeric,
  commission_text text,
  status public.job_status not null default 'draft',
  requirements text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(company_id, slug)
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  location text,
  linkedin_url text,
  cv_url text,
  source text,
  stage public.candidate_stage not null default 'new',
  score integer check (score between 0 and 100),
  notes text,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  cover_note text,
  answers jsonb not null default '{}',
  source text,
  status text not null default 'received',
  submitted_at timestamptz not null default now(),
  unique(job_id,candidate_id)
);

create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_candidates_stage on public.candidates(stage);
create index if not exists idx_candidates_email on public.candidates(lower(email));
create index if not exists idx_applications_job on public.applications(job_id);
create index if not exists idx_applications_candidate on public.applications(candidate_id);

create table if not exists public.application_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

alter table public.application_rate_limits enable row level security;


create or replace function public.current_company_id() returns uuid language sql stable security definer set search_path=public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','manager'))
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;

create policy "profiles own company" on public.profiles for select using (id=auth.uid() or company_id=public.current_company_id());
create policy "company visible" on public.companies for select using (id=public.current_company_id());
create policy "clients tenant" on public.clients for all using (company_id=public.current_company_id()) with check (company_id=public.current_company_id());
create policy "jobs tenant" on public.jobs for all using (company_id=public.current_company_id()) with check (company_id=public.current_company_id());
create policy "candidates tenant" on public.candidates for all using (company_id=public.current_company_id()) with check (company_id=public.current_company_id());
create policy "applications tenant" on public.applications for all using (company_id=public.current_company_id()) with check (company_id=public.current_company_id());

-- Public careers pages need to read only published jobs. Public applications are inserted by the Edge Function using service role.
create policy "public can read published jobs" on public.jobs for select using (status='published');

-- Bootstrap a first company/profile after creating an Auth user:
-- 1. insert into public.companies(name) values ('Your Recruitment Company') returning id;
-- 2. insert into public.profiles(id,company_id,full_name,role) values ('AUTH_USER_UUID','COMPANY_UUID','Your Name','owner');
-- 3. create clients/jobs through the app.

