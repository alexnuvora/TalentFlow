create table if not exists public.client_recruitment_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role_title text,
  email text,
  phone text,
  recruitment_authority text not null default 'unknown'
    check (recruitment_authority in ('unknown','gatekeeper','influencer','vacancy_contact','decision_maker')),
  vacancy_contact_confirmed boolean not null default false,
  is_primary boolean not null default false,
  source text not null default 'live_call',
  confidence text not null default 'stated'
    check (confidence in ('stated','inferred','verified')),
  last_confirmed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_recruitment_contacts_client_name_uq
  on public.client_recruitment_contacts(company_id,client_id,lower(name));

create index if not exists client_recruitment_contacts_client_idx
  on public.client_recruitment_contacts(company_id,client_id,last_confirmed_at desc);

alter table public.client_recruitment_contacts enable row level security;

drop policy if exists client_recruitment_contacts_staff_select on public.client_recruitment_contacts;
create policy client_recruitment_contacts_staff_select
on public.client_recruitment_contacts for select
to authenticated
using (company_id = public.current_company_id() and public.is_manager());

drop policy if exists client_recruitment_contacts_staff_write on public.client_recruitment_contacts;
create policy client_recruitment_contacts_staff_write
on public.client_recruitment_contacts for all
to authenticated
using (company_id = public.current_company_id() and public.is_manager())
with check (company_id = public.current_company_id() and public.is_manager());

grant select,insert,update,delete on public.client_recruitment_contacts to authenticated;
grant all on public.client_recruitment_contacts to service_role;
