create table if not exists public.outbound_deliveries (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 kind text not null, idempotency_key text not null, recipient text not null, provider text, provider_message_id text,
 status text not null default 'reserved' check(status in ('reserved','sending','sent','failed','cancelled')),
 payload jsonb not null default '{}'::jsonb, last_error text, created_at timestamptz not null default now(), sent_at timestamptz,
 unique(company_id,idempotency_key)
);
alter table public.outbound_deliveries enable row level security;
drop policy if exists "outbound deliveries tenant read" on public.outbound_deliveries;
create policy "outbound deliveries tenant read" on public.outbound_deliveries for select to authenticated using(company_id=public.current_company_id());

alter table public.candidate_submissions add column if not exists recipient_email text;
alter table public.candidate_submissions add column if not exists reviewed_by uuid references auth.users(id);
alter table public.candidate_submissions add column if not exists review_confirmed_at timestamptz;
alter table public.candidate_submissions add column if not exists delivery_id uuid references public.outbound_deliveries(id);

alter table public.automation_enrollments add column if not exists claimed_at timestamptz;
alter table public.automation_enrollments add column if not exists claim_token uuid;

create table if not exists public.privacy_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 candidate_id uuid references public.candidates(id) on delete set null, email text not null,
 request_type text not null check(request_type in ('access','export','rectification','erasure','restriction','objection')),
 status text not null default 'open' check(status in ('open','verified','in_progress','completed','rejected')),
 notes text, requested_at timestamptz not null default now(), due_at timestamptz not null default (now()+interval '30 days'), completed_at timestamptz, handled_by uuid references auth.users(id)
);
alter table public.privacy_requests enable row level security;
drop policy if exists "privacy requests managers" on public.privacy_requests;
create policy "privacy requests managers" on public.privacy_requests for all to authenticated using(public.is_manager() and company_id=public.current_company_id()) with check(public.is_manager() and company_id=public.current_company_id());

create unique index if not exists candidate_submissions_once on public.candidate_submissions(company_id,application_id,job_id) where application_id is not null;

create or replace function public.protect_paid_placement() returns trigger language plpgsql security invoker set search_path=public as $$ begin
 if old.invoice_status='paid' then
  if new.client_id is distinct from old.client_id or new.job_id is distinct from old.job_id or new.candidate_id is distinct from old.candidate_id or new.contract_id is distinct from old.contract_id or new.campaign_id is distinct from old.campaign_id or new.start_date is distinct from old.start_date or new.annual_salary is distinct from old.annual_salary or new.initial_fee is distinct from old.initial_fee or new.first_year_revenue is distinct from old.first_year_revenue or new.fee_base is distinct from old.fee_base or new.fee_amount is distinct from old.fee_amount or new.vat_rate is distinct from old.vat_rate or new.vat_amount is distinct from old.vat_amount or new.total_amount is distinct from old.total_amount or new.currency is distinct from old.currency or new.invoice_status is distinct from old.invoice_status or new.invoiced_at is distinct from old.invoiced_at or new.paid_at is distinct from old.paid_at then raise exception 'Paid placements are financially locked'; end if;
 end if;
 if not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id and j.client_id=new.client_id) then raise exception 'Placement job/client relationship is invalid'; end if;
 if not exists(select 1 from public.applications a where a.job_id=new.job_id and a.candidate_id=new.candidate_id and a.company_id=new.company_id) then raise exception 'Candidate has no application for placement job'; end if;
 if new.contract_id is not null and not exists(select 1 from public.client_contracts c where c.id=new.contract_id and c.company_id=new.company_id and c.client_id=new.client_id) then raise exception 'Placement contract/client relationship is invalid'; end if;
 return new; end $$;
drop trigger if exists protect_paid_placement_trigger on public.placements;
create trigger protect_paid_placement_trigger before insert or update on public.placements for each row execute function public.protect_paid_placement();

create or replace function public.pause_sequence_enrolments() returns trigger language plpgsql security invoker set search_path=public as $$ begin
 if old.active=true and new.active=false then update public.automation_enrollments set status='paused',updated_at=now() where sequence_id=new.id and status in ('queued','processing');
 elsif old.active=false and new.active=true then update public.automation_enrollments set status='queued',updated_at=now() where sequence_id=new.id and status='paused'; end if; return new; end $$;
drop trigger if exists sequence_pause_enrolments on public.automation_sequences;
create trigger sequence_pause_enrolments after update of active on public.automation_sequences for each row execute function public.pause_sequence_enrolments();
