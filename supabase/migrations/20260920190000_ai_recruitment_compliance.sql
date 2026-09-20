-- Third compliance pass: explicit AI/ADM notice and human-review enforcement.
alter table public.applications add column if not exists ai_notice_at timestamptz, add column if not exists ai_notice_version text;
alter table public.screening_reports add column if not exists candidate_notice_version text, add column if not exists candidate_notice_at timestamptz, add column if not exists human_review_required boolean not null default true, add column if not exists bias_check_version text;
create or replace function public.enforce_screening_human_review() returns trigger language plpgsql set search_path=public as $$ begin if new.human_review_required is not true then raise exception 'AI-assisted recruitment screening must remain subject to human review';end if;if new.candidate_notice_at is null or coalesce(trim(new.candidate_notice_version),'')='' then raise exception 'Candidate AI/automation notice must be recorded before a screening report is stored';end if;return new;end $$;
drop trigger if exists trg_screening_human_review on public.screening_reports;
create trigger trg_screening_human_review before insert or update on public.screening_reports for each row execute function public.enforce_screening_human_review();
-- Production assert_job_publish_compliance additionally requires location as a mandatory Regulation 18/21 vacancy particular.
