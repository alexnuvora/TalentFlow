alter table public.candidate_portal_tokens
  add column if not exists token_hash text;

update public.candidate_portal_tokens
set token_hash=encode(extensions.digest(token,'sha256'),'hex')
where token_hash is null;

alter table public.candidate_portal_tokens
  alter column token_hash set not null;

create unique index if not exists candidate_portal_tokens_token_hash_uq
  on public.candidate_portal_tokens(token_hash);
