create table if not exists public.client_submission_review_tokens (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.candidate_submissions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_submission_review_tokens_submission_idx on public.client_submission_review_tokens(submission_id);
alter table public.client_submission_review_tokens enable row level security;
revoke all on table public.client_submission_review_tokens from anon, authenticated;
alter table public.candidate_submissions add column if not exists client_decision text;
alter table public.candidate_submissions add column if not exists client_decision_at timestamptz;
alter table public.candidate_submissions add column if not exists client_feedback_at timestamptz;
