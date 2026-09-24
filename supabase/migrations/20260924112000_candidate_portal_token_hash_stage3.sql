drop trigger if exists trg_hash_candidate_portal_token on public.candidate_portal_tokens;
drop function if exists private.hash_candidate_portal_token();

alter table public.candidate_portal_tokens
  drop column if exists token;
