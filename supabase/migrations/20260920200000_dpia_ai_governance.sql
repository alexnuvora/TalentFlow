-- DPIA and AI governance accountability system.
create table if not exists public.ai_governance (
 company_id uuid primary key references public.companies(id) on delete cascade, system_name text not null default 'Vorlen AI-assisted candidate screening', system_purpose text not null,
 provider_name text, model_name text, provider_role text not null default 'processor', lawful_basis text not null default 'legitimate_interests', special_category_condition text,
 solely_automated_significant_decisions boolean not null default false, human_review_required boolean not null default true, candidate_notice_version text not null default 'privacy-2026-09-20',
 dpia_version text not null default 'DPIA-1.0', dpia_status text not null default 'draft', processing_description text not null, necessity_proportionality text not null,
 data_categories text not null, data_subjects text not null default 'job applicants and work-seekers', data_sources text not null, recipients text not null, retention_controls text not null,
 international_transfers text, processor_contract_status text not null default 'unverified', provider_training_status text not null default 'unverified', security_controls text not null,
 rights_redress_controls text not null, bias_fairness_controls text not null, residual_risk text not null default 'medium', high_residual_risk boolean not null default true,
 approved_at timestamptz, approved_by uuid references auth.users(id), next_review_at timestamptz, last_reviewed_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.ai_governance_risks(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,category text not null,risk text not null,likelihood text not null,impact text not null,controls text not null,residual_risk text not null,owner text,status text not null default 'open',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.ai_governance_reviews(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,review_type text not null,version text not null,outcome text not null,summary text not null,evidence text,reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default now(),next_review_at timestamptz);
create table if not exists public.ai_governance_changes(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,change_type text not null,description text not null,material boolean not null default true,requires_dpia_review boolean not null default true,created_by uuid references auth.users(id),created_at timestamptz not null default now());
alter table public.ai_governance enable row level security;alter table public.ai_governance_risks enable row level security;alter table public.ai_governance_reviews enable row level security;alter table public.ai_governance_changes enable row level security;
-- Production migration additionally seeds the Vorlen DPIA/risk register, creates manager-only RLS,
-- approval controls, material-change invalidation, and service-only ai_governance_ready().
