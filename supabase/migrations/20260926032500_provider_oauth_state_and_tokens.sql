alter table public.recruitment_integrations drop constraint if exists recruitment_integrations_status_check;
alter table public.recruitment_integrations
  add constraint recruitment_integrations_status_check
  check (status in ('configuration_required','configured','connected','paused','disabled','error'));

create table if not exists public.recruitment_oauth_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  verifier_secret_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  used_at timestamptz
);
alter table public.recruitment_oauth_states enable row level security;
revoke all on table public.recruitment_oauth_states from anon,authenticated;
grant select,insert,update,delete on table public.recruitment_oauth_states to service_role;

create or replace function public.internal_provider_oauth_material(p_company uuid,p_provider text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cfg private.recruitment_integration_configs%rowtype;v_secret text;
begin
 select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider;
 if not found then raise exception 'Provider configuration not found'; end if;
 if v_cfg.secret_refs ? 'client_secret' then select decrypted_secret into v_secret from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'client_secret')::uuid; end if;
 return jsonb_build_object('client_id',v_cfg.public_config->>'client_id','tenant_id',v_cfg.public_config->>'tenant_id','organization_id',v_cfg.public_config->>'organization_id','client_secret',v_secret,'public_config',v_cfg.public_config);
end $$;

create or replace function public.internal_provider_oauth_begin(p_company uuid,p_provider text,p_user uuid,p_state_hash text,p_code_verifier text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();v_secret uuid;
begin
 delete from public.recruitment_oauth_states where expires_at<now() or used_at is not null;
 if p_code_verifier is not null then v_secret:=vault.create_secret(p_code_verifier,'vorlen_oauth_pkce_'||replace(v_id::text,'-',''),'Short-lived Vorlen OAuth PKCE verifier',null); end if;
 insert into public.recruitment_oauth_states(id,company_id,provider,user_id,state_hash,verifier_secret_id) values(v_id,p_company,p_provider,p_user,p_state_hash,v_secret);
 return v_id;
end $$;

create or replace function public.internal_provider_oauth_consume(p_state_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.recruitment_oauth_states%rowtype;v_verifier text;
begin
 select * into v_state from public.recruitment_oauth_states where state_hash=p_state_hash and used_at is null and expires_at>now() for update;
 if not found then raise exception 'OAuth state is invalid or expired'; end if;
 update public.recruitment_oauth_states set used_at=now() where id=v_state.id;
 if v_state.verifier_secret_id is not null then select decrypted_secret into v_verifier from vault.decrypted_secrets where id=v_state.verifier_secret_id; end if;
 return jsonb_build_object('id',v_state.id,'company_id',v_state.company_id,'provider',v_state.provider,'user_id',v_state.user_id,'code_verifier',v_verifier,'verifier_secret_id',v_state.verifier_secret_id);
end $$;

create or replace function public.internal_provider_oauth_store_tokens(p_company uuid,p_provider text,p_access_token text,p_refresh_token text,p_expires_at timestamptz,p_scopes text,p_account_label text)
returns void language plpgsql security definer set search_path='' as $$
declare v_cfg private.recruitment_integration_configs%rowtype;v_refs jsonb;v_id uuid;
begin
 select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider for update;
 if not found then raise exception 'Provider configuration not found'; end if;
 v_refs:=coalesce(v_cfg.secret_refs,'{}'::jsonb);
 if v_refs ? 'access_token' then perform vault.update_secret((v_refs->>'access_token')::uuid,p_access_token,null,null,null);
 else v_id:=vault.create_secret(p_access_token,'vorlen_'||replace(p_company::text,'-','')||'_'||p_provider||'_access_token','Vorlen provider OAuth access token',null);v_refs:=v_refs||jsonb_build_object('access_token',v_id::text);end if;
 if nullif(p_refresh_token,'') is not null then
  if v_refs ? 'refresh_token' then perform vault.update_secret((v_refs->>'refresh_token')::uuid,p_refresh_token,null,null,null);
  else v_id:=vault.create_secret(p_refresh_token,'vorlen_'||replace(p_company::text,'-','')||'_'||p_provider||'_refresh_token','Vorlen provider OAuth refresh token',null);v_refs:=v_refs||jsonb_build_object('refresh_token',v_id::text);end if;
 end if;
 update private.recruitment_integration_configs set secret_refs=v_refs,
   public_config=coalesce(public_config,'{}'::jsonb)||jsonb_build_object('token_expires_at',p_expires_at,'granted_scopes',coalesce(p_scopes,''),'connected_account',coalesce(p_account_label,'')),
   last_tested_at=now(),last_test_result='connected',updated_at=now()
 where company_id=p_company and provider=p_provider;
 update public.recruitment_integrations set status='connected',configuration_note='OAuth connection established and verified.',last_checked_at=now(),updated_at=now() where company_id=p_company and provider=p_provider;
 update public.partner_integration_requests set status='fulfilled',reviewed_at=coalesce(reviewed_at,now()),updated_at=now(),manager_notes=coalesce(manager_notes,'Provider connected by Vorlen management.')
 where company_id=p_company and provider=p_provider and status in ('requested','under_review','approved');
end $$;

create or replace function public.internal_provider_oauth_tokens(p_company uuid,p_provider text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cfg private.recruitment_integration_configs%rowtype;v_access text;v_refresh text;v_client_secret text;
begin
 select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider;
 if not found then raise exception 'Provider configuration not found'; end if;
 if v_cfg.secret_refs ? 'access_token' then select decrypted_secret into v_access from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'access_token')::uuid; end if;
 if v_cfg.secret_refs ? 'refresh_token' then select decrypted_secret into v_refresh from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'refresh_token')::uuid; end if;
 if v_cfg.secret_refs ? 'client_secret' then select decrypted_secret into v_client_secret from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'client_secret')::uuid; end if;
 return jsonb_build_object('access_token',v_access,'refresh_token',v_refresh,'client_secret',v_client_secret,'public_config',v_cfg.public_config);
end $$;

create or replace function public.internal_provider_oauth_test_result(p_company uuid,p_provider text,p_ok boolean,p_result text)
returns void language plpgsql security definer set search_path='' as $$
begin
 update private.recruitment_integration_configs set last_tested_at=now(),last_test_result=left(coalesce(p_result,''),1000),updated_at=now() where company_id=p_company and provider=p_provider;
 update public.recruitment_integrations set status=case when p_ok then 'connected' else 'error' end,
 configuration_note=case when p_ok then 'OAuth connection verified.' else 'OAuth connection test failed: '||left(coalesce(p_result,'Unknown error'),500) end,
 last_checked_at=now(),updated_at=now() where company_id=p_company and provider=p_provider;
end $$;

create or replace function public.internal_provider_oauth_cleanup(p_state_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_secret uuid;
begin
 select verifier_secret_id into v_secret from public.recruitment_oauth_states where id=p_state_id;
 if v_secret is not null then delete from vault.secrets where id=v_secret; end if;
 delete from public.recruitment_oauth_states where id=p_state_id;
end $$;

revoke all on function public.internal_provider_oauth_material(uuid,text) from public,anon,authenticated;
revoke all on function public.internal_provider_oauth_begin(uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.internal_provider_oauth_consume(text) from public,anon,authenticated;
revoke all on function public.internal_provider_oauth_store_tokens(uuid,text,text,text,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.internal_provider_oauth_tokens(uuid,text) from public,anon,authenticated;
revoke all on function public.internal_provider_oauth_test_result(uuid,text,boolean,text) from public,anon,authenticated;
revoke all on function public.internal_provider_oauth_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.internal_provider_oauth_material(uuid,text) to service_role;
grant execute on function public.internal_provider_oauth_begin(uuid,text,uuid,text,text) to service_role;
grant execute on function public.internal_provider_oauth_consume(text) to service_role;
grant execute on function public.internal_provider_oauth_store_tokens(uuid,text,text,text,timestamptz,text,text) to service_role;
grant execute on function public.internal_provider_oauth_tokens(uuid,text) to service_role;
grant execute on function public.internal_provider_oauth_test_result(uuid,text,boolean,text) to service_role;
grant execute on function public.internal_provider_oauth_cleanup(uuid) to service_role;