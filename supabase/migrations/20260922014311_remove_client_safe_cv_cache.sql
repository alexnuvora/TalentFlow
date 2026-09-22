alter table public.candidate_submissions
  drop column if exists client_safe_cv_text,
  drop column if exists client_safe_cv_generated_at,
  drop column if exists client_safe_cv_source_hash,
  drop column if exists client_safe_cv_redaction_version;
