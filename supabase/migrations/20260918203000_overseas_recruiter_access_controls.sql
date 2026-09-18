-- Overseas recruiter access control for candidate personal data.
-- Recruiter accounts fail closed until an owner/manager records an approval.
create table if not exists public.recruiter_data_access_approvals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  transfer_mechanism text not null check (transfer_mechanism in ('UK_IDTA','UK_ADDENDUM','ADEQUACY','UK_SAME_ENTITY','OTHER')),
  data_protection_test_completed_at timestamptz,
  agreement_signed_at timestamptz not null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recruiter_data_access_approvals enable row level security;
revoke all on public.recruiter_data_access_approvals from anon;
grant select,insert,update on public.recruiter_data_access_approvals to authenticated;

create policy recruiter_access_approval_managers_select on public.recruiter_data_access_approvals
for select to authenticated
using (company_id=public.current_company_id() and public.is_manager());

create policy recruiter_access_approval_managers_insert on public.recruiter_data_access_approvals
for insert to authenticated
with check (company_id=public.current_company_id() and public.is_manager() and approved_by=(select auth.uid()));

create policy recruiter_access_approval_managers_update on public.recruiter_data_access_approvals
for update to authenticated
using (company_id=public.current_company_id() and public.is_manager())
with check (company_id=public.current_company_id() and public.is_manager());

create index if not exists recruiter_data_access_approvals_company_idx
on public.recruiter_data_access_approvals(company_id,revoked_at,expires_at);

comment on table public.recruiter_data_access_approvals is
'Owner/manager evidence gate for recruiter access to candidate personal data, including overseas transfer safeguards.';
