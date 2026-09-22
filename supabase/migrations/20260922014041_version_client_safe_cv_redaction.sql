alter table public.candidate_submissions
  add column if not exists client_safe_cv_redaction_version text;
