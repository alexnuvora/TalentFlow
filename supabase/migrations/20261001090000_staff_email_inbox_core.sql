create table if not exists public.staff_email_threads (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 subject text not null default '', normalized_subject text not null default '', last_message_at timestamptz not null default now(),
 last_message_preview text, message_count integer not null default 0, unread_count integer not null default 0,
 is_starred boolean not null default false, is_archived boolean not null default false,
 client_id uuid references public.clients(id) on delete set null, candidate_id uuid references public.candidates(id) on delete set null,
 job_id uuid references public.jobs(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Production schema applied through Supabase migration staff_email_inbox_core.
-- Tables: staff_email_threads, staff_email_messages, staff_email_attachments.
-- RLS and manager-only RPCs are defined in the applied migration.