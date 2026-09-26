create table if not exists private.integration_oauth_states (
  state uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  verifier_secret_id uuid not null,
  redirect_uri text not null,
  return_to text not null,
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists integration_oauth_states_expiry_idx on private.integration_oauth_states(expires_at);

CREATE OR REPLACE FUNCTION public.manager_disconnect_oauth_connection(p_provider text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company uuid:=private.current_company_id();
  v_cfg private.recruitment_integration_configs%rowtype;
  v_id uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_provider not in ('google_calendar','microsoft_calendar','linkedin') then raise exception 'Provider is not OAuth-managed'; end if;
  select * into v_cfg from private.recruitment_integration_configs where company_id=v_company and provider=p_provider for update;
  if not found then raise exception 'Provider configuration not found'; end if;

  if v_cfg.secret_refs ? 'oauth_access_token' then
    v_id=(v_cfg.secret_refs->>'oauth_access_token')::uuid; delete from vault.secrets where id=v_id;
  end if;
  if v_cfg.secret_refs ? 'oauth_refresh_token' then
    v_id=(v_cfg.secret_refs->>'oauth_refresh_token')::uuid; delete from vault.secrets where id=v_id;
  end if;

  update private.recruitment_integration_configs
  set secret_refs=coalesce(secret_refs,'{}'::jsonb)-'oauth_access_token'-'oauth_refresh_token',
      public_config=coalesce(public_config,'{}'::jsonb)-'oauth_scope'-'oauth_token_type'-'oauth_token_expires_at'-'oauth_account',
      last_tested_at=now(),last_test_result='Disconnected by Vorlen management',updated_at=now()
  where company_id=v_company and provider=p_provider;

  update public.recruitment_integrations
  set status='configured',configuration_note='OAuth application credentials are configured; user authorisation is disconnected.',
      last_checked_at=now(),updated_at=now()
  where company_id=v_company and provider=p_provider;
end
$function$;

CREATE OR REPLACE FUNCTION public.service_consume_integration_oauth_state(p_state uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_state private.integration_oauth_states%rowtype;
  v_cfg private.recruitment_integration_configs%rowtype;
  v_verifier text;
  v_client_secret text;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  select * into v_state from private.integration_oauth_states
  where state=p_state and consumed_at is null and expires_at>now()
  for update;
  if not found then raise exception 'OAuth state is invalid or expired'; end if;

  select * into v_cfg from private.recruitment_integration_configs
  where company_id=v_state.company_id and provider=v_state.provider;
  if not found then raise exception 'Provider configuration no longer exists'; end if;

  select decrypted_secret into v_verifier from vault.decrypted_secrets where id=v_state.verifier_secret_id;
  select decrypted_secret into v_client_secret from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'client_secret')::uuid;
  if v_verifier is null or v_client_secret is null then raise exception 'OAuth secret material is unavailable'; end if;

  update private.integration_oauth_states set consumed_at=now() where state=p_state;
  delete from vault.secrets where id=v_state.verifier_secret_id;

  return jsonb_build_object(
    'company_id',v_state.company_id,'provider',v_state.provider,'initiated_by',v_state.initiated_by,
    'redirect_uri',v_state.redirect_uri,'return_to',v_state.return_to,'code_verifier',v_verifier,
    'client_id',v_cfg.public_config->>'client_id','client_secret',v_client_secret,
    'tenant_id',v_cfg.public_config->>'tenant_id','organization_id',v_cfg.public_config->>'organization_id',
    'requested_scopes',v_cfg.public_config->>'scopes'
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.service_integration_oauth_material(p_company uuid, p_provider text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cfg private.recruitment_integration_configs%rowtype;
  v_access text;v_refresh text;v_client_secret text;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider;
  if not found then raise exception 'Provider configuration not found'; end if;
  if v_cfg.secret_refs ? 'oauth_access_token' then select decrypted_secret into v_access from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'oauth_access_token')::uuid; end if;
  if v_cfg.secret_refs ? 'oauth_refresh_token' then select decrypted_secret into v_refresh from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'oauth_refresh_token')::uuid; end if;
  if v_cfg.secret_refs ? 'client_secret' then select decrypted_secret into v_client_secret from vault.decrypted_secrets where id=(v_cfg.secret_refs->>'client_secret')::uuid; end if;
  return jsonb_build_object(
    'client_id',v_cfg.public_config->>'client_id','client_secret',v_client_secret,
    'tenant_id',v_cfg.public_config->>'tenant_id','organization_id',v_cfg.public_config->>'organization_id',
    'access_token',v_access,'refresh_token',v_refresh,
    'expires_at',v_cfg.public_config->>'oauth_token_expires_at',
    'scope',v_cfg.public_config->>'oauth_scope',
    'account',coalesce(v_cfg.public_config->'oauth_account','{}'::jsonb)
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.service_prepare_integration_oauth(p_company uuid, p_provider text, p_user uuid, p_verifier text, p_redirect_uri text, p_return_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_state uuid:=gen_random_uuid();
  v_verifier_secret uuid;
  v_cfg private.recruitment_integration_configs%rowtype;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  if p_provider not in ('google_calendar','microsoft_calendar','linkedin') then raise exception 'Provider does not support Vorlen OAuth'; end if;
  if not exists(select 1 from public.profiles where id=p_user and company_id=p_company and role in ('owner','manager')) then raise exception 'Manager access required'; end if;
  select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider;
  if not found then raise exception 'Configure the provider OAuth application first'; end if;
  if nullif(btrim(coalesce(v_cfg.public_config->>'client_id','')),'') is null then raise exception 'OAuth client ID is not configured'; end if;
  if not (coalesce(v_cfg.secret_refs,'{}'::jsonb) ? 'client_secret') then raise exception 'OAuth client secret is not configured'; end if;

  v_verifier_secret:=vault.create_secret(p_verifier,'vorlen_oauth_pkce_'||replace(v_state::text,'-',''),'Temporary PKCE verifier',null);
  insert into private.integration_oauth_states(state,company_id,provider,initiated_by,verifier_secret_id,redirect_uri,return_to)
  values(v_state,p_company,p_provider,p_user,v_verifier_secret,p_redirect_uri,p_return_to);

  return jsonb_build_object(
    'state',v_state,
    'client_id',v_cfg.public_config->>'client_id',
    'tenant_id',v_cfg.public_config->>'tenant_id',
    'organization_id',v_cfg.public_config->>'organization_id',
    'requested_scopes',v_cfg.public_config->>'scopes'
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.service_store_integration_oauth_tokens(p_company uuid, p_provider text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone, p_scope text, p_token_type text, p_external_account jsonb DEFAULT '{}'::jsonb, p_test_result text DEFAULT 'OAuth connection verified'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cfg private.recruitment_integration_configs%rowtype;
  v_refs jsonb;
  v_id uuid;
  v_name text;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider for update;
  if not found then raise exception 'Provider configuration not found'; end if;
  v_refs:=coalesce(v_cfg.secret_refs,'{}'::jsonb);

  if nullif(p_access_token,'') is not null then
    if v_refs ? 'oauth_access_token' then
      perform vault.update_secret((v_refs->>'oauth_access_token')::uuid,p_access_token,null,null,null);
    else
      v_name:='vorlen_'||replace(p_company::text,'-','')||'_'||p_provider||'_oauth_access_token';
      v_id:=vault.create_secret(p_access_token,v_name,'Vorlen provider OAuth access token',null);
      v_refs:=v_refs||jsonb_build_object('oauth_access_token',v_id::text);
    end if;
  end if;

  if nullif(p_refresh_token,'') is not null then
    if v_refs ? 'oauth_refresh_token' then
      perform vault.update_secret((v_refs->>'oauth_refresh_token')::uuid,p_refresh_token,null,null,null);
    else
      v_name:='vorlen_'||replace(p_company::text,'-','')||'_'||p_provider||'_oauth_refresh_token';
      v_id:=vault.create_secret(p_refresh_token,v_name,'Vorlen provider OAuth refresh token',null);
      v_refs:=v_refs||jsonb_build_object('oauth_refresh_token',v_id::text);
    end if;
  end if;

  update private.recruitment_integration_configs
  set secret_refs=v_refs,
      public_config=coalesce(public_config,'{}'::jsonb)||jsonb_build_object(
        'oauth_scope',coalesce(p_scope,''),
        'oauth_token_type',coalesce(p_token_type,'Bearer'),
        'oauth_token_expires_at',p_expires_at,
        'oauth_account',coalesce(p_external_account,'{}'::jsonb)
      ),
      last_tested_at=now(),last_test_result=p_test_result,updated_at=now()
  where company_id=p_company and provider=p_provider;

  update public.recruitment_integrations
  set status='connected',configuration_note='OAuth connection verified. Tokens are stored securely and are not exposed to the browser.',
      last_checked_at=now(),updated_at=now()
  where company_id=p_company and provider=p_provider;

  update public.partner_integration_requests
  set status='fulfilled',reviewed_at=now(),updated_at=now(),
      manager_notes=coalesce(manager_notes,'Provider OAuth connection verified by Vorlen management.')
  where company_id=p_company and provider=p_provider and status in ('requested','under_review','approved');

  update public.job_distribution_requests
  set status='requested',error_message=null,updated_at=now()
  where company_id=p_company and provider=p_provider and status='configuration_required';
end
$function$;


revoke all on function public.service_prepare_integration_oauth(uuid,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.service_consume_integration_oauth_state(uuid) from public,anon,authenticated;
revoke all on function public.service_store_integration_oauth_tokens(uuid,text,text,text,timestamptz,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.service_integration_oauth_material(uuid,text) from public,anon,authenticated;
grant execute on function public.service_prepare_integration_oauth(uuid,text,uuid,text,text,text) to service_role;
grant execute on function public.service_consume_integration_oauth_state(uuid) to service_role;
grant execute on function public.service_store_integration_oauth_tokens(uuid,text,text,text,timestamptz,text,text,jsonb,text) to service_role;
grant execute on function public.service_integration_oauth_material(uuid,text) to service_role;
revoke all on function public.manager_disconnect_oauth_connection(text) from public,anon;
grant execute on function public.manager_disconnect_oauth_connection(text) to authenticated;
