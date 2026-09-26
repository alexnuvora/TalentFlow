create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  verifier_ref uuid,
  redirect_after text not null default '/dashboard/partner-management',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.integration_oauth_states enable row level security;
revoke all on table public.integration_oauth_states from public,anon,authenticated;

create table if not exists private.recruitment_integration_oauth_tokens (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  access_token_ref uuid,
  refresh_token_ref uuid,
  token_type text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  account_id text,
  account_label text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  last_tested_at timestamptz,
  last_test_result text,
  updated_at timestamptz not null default now(),
  primary key(company_id,provider)
);

create or replace function public.integration_oauth_app_config(p_company uuid,p_provider text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cfg private.recruitment_integration_configs%rowtype;v_secret text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider;
  if not found then return null; end if;
  if v_cfg.secret_refs ? 'client_secret' then
    select decrypted_secret into v_secret from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'client_secret')::uuid;
  end if;
  return jsonb_build_object('auth_mode',v_cfg.auth_mode,'public_config',v_cfg.public_config,'client_secret',v_secret);
end $$;

create or replace function public.integration_oauth_create_state(
  p_company uuid,p_provider text,p_user uuid,p_state_hash text,p_verifier text,p_redirect_after text,p_minutes integer default 10
) returns void language plpgsql security definer set search_path='' as $$
declare v_ref uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  if p_provider not in ('google_calendar','microsoft_calendar','linkedin') then raise exception 'OAuth provider not supported'; end if;
  v_ref:=vault.create_secret(p_verifier,null,'Vorlen OAuth PKCE verifier',null);
  delete from public.integration_oauth_states where expires_at<now() or used_at is not null;
  insert into public.integration_oauth_states(company_id,provider,initiated_by,state_hash,verifier_ref,redirect_after,expires_at)
  values(p_company,p_provider,p_user,p_state_hash,v_ref,coalesce(nullif(p_redirect_after,''),'/dashboard/partner-management'),
         now()+make_interval(mins=>greatest(1,least(p_minutes,15))));
end $$;

create or replace function public.integration_oauth_consume_state(p_state_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.integration_oauth_states%rowtype;v_verifier text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  select * into v_state from public.integration_oauth_states
  where state_hash=p_state_hash and used_at is null and expires_at>now() for update;
  if not found then return null; end if;
  update public.integration_oauth_states set used_at=now() where id=v_state.id;
  select decrypted_secret into v_verifier from vault.decrypted_secrets where id=v_state.verifier_ref;
  delete from vault.secrets where id=v_state.verifier_ref;
  return jsonb_build_object('company_id',v_state.company_id,'provider',v_state.provider,'initiated_by',v_state.initiated_by,
    'verifier',v_verifier,'redirect_after',v_state.redirect_after);
end $$;

create or replace function public.integration_oauth_store_tokens(
  p_company uuid,p_provider text,p_user uuid,p_access_token text,p_refresh_token text,p_token_type text,
  p_expires_at timestamptz,p_scopes text[],p_account_id text,p_account_label text
) returns void language plpgsql security definer set search_path='' as $$
declare v_old private.recruitment_integration_oauth_tokens%rowtype;v_access uuid;v_refresh uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  select * into v_old from private.recruitment_integration_oauth_tokens where company_id=p_company and provider=p_provider;
  if found and v_old.access_token_ref is not null then delete from vault.secrets where id=v_old.access_token_ref; end if;
  if found and v_old.refresh_token_ref is not null then delete from vault.secrets where id=v_old.refresh_token_ref; end if;
  v_access:=vault.create_secret(p_access_token,null,'Vorlen OAuth access token',null);
  if nullif(p_refresh_token,'') is not null then v_refresh:=vault.create_secret(p_refresh_token,null,'Vorlen OAuth refresh token',null); end if;
  insert into private.recruitment_integration_oauth_tokens(company_id,provider,access_token_ref,refresh_token_ref,token_type,expires_at,scopes,account_id,account_label,connected_by,connected_at,last_tested_at,last_test_result,updated_at)
  values(p_company,p_provider,v_access,v_refresh,p_token_type,p_expires_at,coalesce(p_scopes,'{}'),p_account_id,p_account_label,p_user,now(),now(),'connected',now())
  on conflict(company_id,provider) do update set
    access_token_ref=excluded.access_token_ref,refresh_token_ref=excluded.refresh_token_ref,token_type=excluded.token_type,
    expires_at=excluded.expires_at,scopes=excluded.scopes,account_id=excluded.account_id,account_label=excluded.account_label,
    connected_by=excluded.connected_by,connected_at=excluded.connected_at,last_tested_at=excluded.last_tested_at,
    last_test_result='connected',updated_at=now();
  update public.recruitment_integrations
  set status='connected',configuration_note='OAuth connection verified successfully.',last_checked_at=now(),updated_at=now()
  where company_id=p_company and provider=p_provider;
  update public.partner_integration_requests
  set status='fulfilled',reviewed_by=p_user,reviewed_at=now(),updated_at=now(),
      manager_notes=coalesce(manager_notes,'Provider connected through secure OAuth.')
  where company_id=p_company and provider=p_provider and status in ('requested','under_review','approved');
  update public.job_distribution_requests set status='requested',error_message=null,updated_at=now()
  where company_id=p_company and provider=p_provider and status='configuration_required';
end $$;

create or replace function public.integration_oauth_read_tokens(p_company uuid,p_provider text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t private.recruitment_integration_oauth_tokens%rowtype;v_access text;v_refresh text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  select * into v_t from private.recruitment_integration_oauth_tokens where company_id=p_company and provider=p_provider;
  if not found then return null; end if;
  select decrypted_secret into v_access from vault.decrypted_secrets where id=v_t.access_token_ref;
  if v_t.refresh_token_ref is not null then select decrypted_secret into v_refresh from vault.decrypted_secrets where id=v_t.refresh_token_ref; end if;
  return jsonb_build_object('access_token',v_access,'refresh_token',v_refresh,'token_type',v_t.token_type,'expires_at',v_t.expires_at,
    'scopes',v_t.scopes,'account_id',v_t.account_id,'account_label',v_t.account_label);
end $$;

create or replace function public.integration_oauth_status(p_provider text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_t private.recruitment_integration_oauth_tokens%rowtype;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  select * into v_t from private.recruitment_integration_oauth_tokens where company_id=v_company and provider=p_provider;
  if not found then return jsonb_build_object('connected',false,'provider',p_provider); end if;
  return jsonb_build_object('connected',true,'provider',p_provider,'account_id',v_t.account_id,'account_label',v_t.account_label,
    'scopes',v_t.scopes,'expires_at',v_t.expires_at,'connected_at',v_t.connected_at,'last_tested_at',v_t.last_tested_at,
    'last_test_result',v_t.last_test_result);
end $$;

create or replace function public.integration_oauth_disconnect_service(p_company uuid,p_provider text)
returns void language plpgsql security definer set search_path='' as $$
declare v_t private.recruitment_integration_oauth_tokens%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  select * into v_t from private.recruitment_integration_oauth_tokens where company_id=p_company and provider=p_provider;
  if found then
    if v_t.access_token_ref is not null then delete from vault.secrets where id=v_t.access_token_ref; end if;
    if v_t.refresh_token_ref is not null then delete from vault.secrets where id=v_t.refresh_token_ref; end if;
  end if;
  delete from private.recruitment_integration_oauth_tokens where company_id=p_company and provider=p_provider;
  update public.recruitment_integrations
  set status=case when exists(select 1 from private.recruitment_integration_configs c where c.company_id=p_company and c.provider=p_provider) then 'configured' else 'configuration_required' end,
      configuration_note='OAuth connection removed. Reconnect to use this provider.',last_checked_at=now(),updated_at=now()
  where company_id=p_company and provider=p_provider;
end $$;

revoke all on function public.integration_oauth_app_config(uuid,text) from public,anon,authenticated;
revoke all on function public.integration_oauth_create_state(uuid,text,uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.integration_oauth_consume_state(text) from public,anon,authenticated;
revoke all on function public.integration_oauth_store_tokens(uuid,text,uuid,text,text,text,timestamptz,text[],text,text) from public,anon,authenticated;
revoke all on function public.integration_oauth_read_tokens(uuid,text) from public,anon,authenticated;
revoke all on function public.integration_oauth_disconnect_service(uuid,text) from public,anon,authenticated;
grant execute on function public.integration_oauth_app_config(uuid,text) to service_role;
grant execute on function public.integration_oauth_create_state(uuid,text,uuid,text,text,text,integer) to service_role;
grant execute on function public.integration_oauth_consume_state(text) to service_role;
grant execute on function public.integration_oauth_store_tokens(uuid,text,uuid,text,text,text,timestamptz,text[],text,text) to service_role;
grant execute on function public.integration_oauth_read_tokens(uuid,text) to service_role;
grant execute on function public.integration_oauth_disconnect_service(uuid,text) to service_role;
revoke all on function public.integration_oauth_status(text) from public,anon;
grant execute on function public.integration_oauth_status(text) to authenticated;
