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
create or replace function public.guard_client_email_compliance_update() returns trigger language plpgsql set search_path=public as $$
begin
 if auth.uid() is not null and (
   new.pecr_subscriber_type is distinct from old.pecr_subscriber_type or new.email_marketing_basis is distinct from old.email_marketing_basis or
   new.email_marketing_evidence is distinct from old.email_marketing_evidence or new.email_marketing_assessed_at is distinct from old.email_marketing_assessed_at or
   new.email_marketing_assessed_by is distinct from old.email_marketing_assessed_by
 ) then raise exception 'Email marketing compliance must be changed through the audited manager compliance workflow'; end if;
 return new;
end $$;
drop trigger if exists guard_client_email_compliance_update on public.clients;
create trigger guard_client_email_compliance_update before update on public.clients for each row execute function public.guard_client_email_compliance_update();
revoke execute on function public.guard_client_email_compliance_update() from public,anon,authenticated;
