alter table public.clients add column if not exists email_marketing_assessed_by uuid;
create table if not exists public.client_email_compliance_audit(
 id uuid primary key default gen_random_uuid(), company_id uuid not null, client_id uuid not null references public.clients(id) on delete cascade,
 assessed_by uuid not null, pecr_subscriber_type text not null, email_marketing_basis text not null, evidence text not null, assessed_at timestamptz not null default now()
);
alter table public.client_email_compliance_audit enable row level security;
revoke all on public.client_email_compliance_audit from anon,authenticated;
grant select on public.client_email_compliance_audit to authenticated;
create policy manager_read_client_email_compliance_audit on public.client_email_compliance_audit for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=client_email_compliance_audit.company_id and p.role in ('owner','manager')));
create index if not exists client_email_compliance_audit_client_idx on public.client_email_compliance_audit(company_id,client_id,assessed_at desc);