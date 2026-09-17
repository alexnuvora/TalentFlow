-- TalentFlow V8: production security and UK recruitment compliance controls.
-- Run after v7_recruiter_os.sql. Review periods with UK counsel and your records schedule.
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','manager','recruiter'))
$$;
alter table public.companies add column if not exists legal_name text;
alter table public.companies add column if not exists legal_address text;
alter table public.companies add column if not exists privacy_email text;
alter table public.companies add column if not exists ico_registration_number text;
alter table public.companies add column if not exists candidate_retention_months integer not null default 6 check(candidate_retention_months between 1 and 84);
alter table public.candidates add column if not exists lawful_basis text not null default 'legitimate_interests' check(lawful_basis in ('contract_steps','legitimate_interests','legal_obligation','consent'));
alter table public.candidates add column if not exists retention_review_at timestamptz;
alter table public.candidates add column if not exists marketing_opt_in_at timestamptz;
alter table public.candidates add column if not exists marketing_opt_out_at timestamptz;
alter table public.candidates add column if not exists erased_at timestamptz;
alter table public.applications add column if not exists privacy_notice_version text not null default '2026-09-16';
alter table public.applications add column if not exists human_review_required boolean not null default true;
alter table public.screening_reports add column if not exists reviewed_by uuid references auth.users(id);
alter table public.screening_reports add column if not exists reviewed_at timestamptz;
alter table public.screening_reports add column if not exists review_outcome text check(review_outcome in ('accepted','overridden','needs_more_information'));
create table if not exists public.data_rights_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 candidate_id uuid references public.candidates(id) on delete set null, requester_email text not null,
 request_type text not null check(request_type in ('access','rectification','erasure','restriction','portability','objection','automated_review')),
 status text not null default 'received' check(status in ('received','identity_check','in_progress','completed','refused')),
 received_at timestamptz not null default now(), due_at timestamptz not null default now()+interval '1 month',
 completed_at timestamptz, notes text, handled_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.data_rights_requests enable row level security;
create policy "rights staff" on public.data_rights_requests for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create index if not exists idx_rights_due on public.data_rights_requests(company_id,status,due_at);
create index if not exists idx_candidate_retention on public.candidates(company_id,retention_review_at) where erased_at is null;
revoke all on function public.create_candidate_portal_token(uuid,integer) from public, anon;
grant execute on function public.create_candidate_portal_token(uuid,integer) to authenticated;
revoke all on function public.calculate_placement_fee(uuid,numeric,numeric,numeric) from public, anon;
grant execute on function public.calculate_placement_fee(uuid,numeric,numeric,numeric) to authenticated;
revoke all on function public.campaign_performance() from public, anon;
grant execute on function public.campaign_performance() to authenticated;
create unique index if not exists idx_candidates_company_email_unique on public.candidates(company_id,lower(email)) where erased_at is null;
comment on column public.screening_reports.score is 'Decision-support score only; progression or rejection requires meaningful human review.';
comment on column public.applications.human_review_required is 'Must remain true while AI-assisted recruitment is enabled.';

