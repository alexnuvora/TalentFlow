alter table public.candidate_portal_tokens
  add column if not exists id uuid default gen_random_uuid();

update public.candidate_portal_tokens
set id=gen_random_uuid()
where id is null;

alter table public.candidate_portal_tokens
  alter column id set not null;

alter table public.candidate_portal_tokens
  drop constraint if exists candidate_portal_tokens_pkey;

alter table public.candidate_portal_tokens
  add constraint candidate_portal_tokens_pkey primary key (id);

alter table public.candidate_portal_tokens
  alter column token drop not null;

create or replace function private.hash_candidate_portal_token()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.token_hash is null and nullif(new.token,'') is not null then
    new.token_hash:=encode(extensions.digest(new.token,'sha256'),'hex');
  end if;
  if new.token_hash is null then raise exception 'Candidate portal token hash is required';end if;
  new.token:=null;
  return new;
end $$;

drop trigger if exists trg_hash_candidate_portal_token on public.candidate_portal_tokens;
create trigger trg_hash_candidate_portal_token
before insert or update of token,token_hash on public.candidate_portal_tokens
for each row execute function private.hash_candidate_portal_token();

revoke all on function private.hash_candidate_portal_token() from public,anon,authenticated;
grant execute on function private.hash_candidate_portal_token() to service_role;

update public.candidate_portal_tokens
set token=null
where token is not null;
