-- Vorlen V7 Recruiter Operating System
alter table public.candidates add column if not exists recruiter_summary text;
alter table public.candidates add column if not exists next_action text;
alter table public.candidates add column if not exists next_action_at timestamptz;

create table if not exists public.screening_reports (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 application_id uuid not null references public.applications(id) on delete cascade, candidate_id uuid not null references public.candidates(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade, score integer check(score between 0 and 100), summary text,
 strengths jsonb not null default '[]', gaps jsonb not null default '[]', interview_questions jsonb not null default '[]', evidence jsonb not null default '[]',
 model text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists idx_screening_reports_candidate on public.screening_reports(candidate_id,created_at desc);

create table if not exists public.call_notes (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 candidate_id uuid not null references public.candidates(id) on delete cascade, application_id uuid references public.applications(id) on delete set null,
 recruiter_id uuid references auth.users(id), outcome text not null default 'pending' check(outcome in ('pending','qualified','follow_up','not_suitable','no_answer')),
 notes text, answers jsonb not null default '{}', next_action text, next_action_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_call_notes_candidate on public.call_notes(candidate_id,created_at desc);

create table if not exists public.candidate_submissions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade, job_id uuid not null references public.jobs(id) on delete cascade,
 candidate_id uuid not null references public.candidates(id) on delete cascade, application_id uuid references public.applications(id) on delete set null,
 submitted_by uuid references auth.users(id), headline text, recruiter_summary text, key_strengths jsonb not null default '[]', concerns jsonb not null default '[]',
 status text not null default 'submitted' check(status in ('draft','submitted','reviewing','approved','rejected','interview_requested','withdrawn')),
 client_feedback text, submitted_at timestamptz, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists idx_submission_unique_active on public.candidate_submissions(job_id,candidate_id) where status <> 'withdrawn';

create table if not exists public.activity_log (
 id bigserial primary key, company_id uuid not null references public.companies(id) on delete cascade,
 candidate_id uuid references public.candidates(id) on delete cascade, job_id uuid references public.jobs(id) on delete set null,
 actor_id uuid references auth.users(id), event_type text not null, detail text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists idx_activity_candidate on public.activity_log(candidate_id,created_at desc);

alter table public.screening_reports enable row level security; alter table public.call_notes enable row level security;
alter table public.candidate_submissions enable row level security; alter table public.activity_log enable row level security;
create policy "screening staff" on public.screening_reports for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create policy "calls staff" on public.call_notes for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create policy "submissions staff write" on public.candidate_submissions for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create policy "submissions client read" on public.candidate_submissions for select using(company_id=public.current_company_id() and client_id=(select client_id from public.profiles where id=auth.uid()));
create policy "activity staff" on public.activity_log for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());

create or replace function public.client_review_submission(p_submission_id uuid,p_status text,p_feedback text default null)
returns void language plpgsql security definer set search_path=public as $$
declare s candidate_submissions%rowtype; cid uuid;
begin
 cid=(select client_id from profiles where id=auth.uid());
 select * into s from candidate_submissions where id=p_submission_id and client_id=cid;
 if not found then raise exception 'Submission not found'; end if;
 if p_status not in ('approved','rejected','interview_requested','reviewing') then raise exception 'Invalid status'; end if;
 update candidate_submissions set status=p_status,client_feedback=p_feedback,reviewed_at=now(),updated_at=now() where id=p_submission_id;
 insert into activity_log(company_id,candidate_id,job_id,actor_id,event_type,detail) values(s.company_id,s.candidate_id,s.job_id,auth.uid(),'client_review',p_status||coalesce(': '||p_feedback,''));
 if p_status='interview_requested' then update candidates set stage='interview' where id=s.candidate_id; end if;
end $$;
grant execute on function public.client_review_submission(uuid,text,text) to authenticated;
