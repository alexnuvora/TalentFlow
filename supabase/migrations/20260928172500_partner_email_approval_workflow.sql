create table if not exists public.partner_email_approvals (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 partner_id uuid not null,
 client_id uuid not null references public.clients(id) on delete cascade,
 email_status text not null,
 recipient text not null,
 subject text not null,
 message text not null,
 callback_at timestamptz,
 status text not null default 'pending' check (status in ('pending','sending','approved','rejected','sent','cancelled')),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text,
 sent_at timestamptz,
 provider_message_id text,
 updated_at timestamptz not null default now()
);
create index if not exists partner_email_approvals_company_status_idx on public.partner_email_approvals(company_id,status,submitted_at desc);
create index if not exists partner_email_approvals_partner_idx on public.partner_email_approvals(partner_id,submitted_at desc);
alter table public.partner_email_approvals enable row level security;
revoke all on public.partner_email_approvals from anon, authenticated;
grant select on public.partner_email_approvals to authenticated;
drop policy if exists partner_email_approvals_select on public.partner_email_approvals;
create policy partner_email_approvals_select on public.partner_email_approvals for select to authenticated using (
 company_id=(select company_id from public.profiles where id=(select auth.uid()))
 and (partner_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=partner_email_approvals.company_id and p.role in ('owner','manager')))
);