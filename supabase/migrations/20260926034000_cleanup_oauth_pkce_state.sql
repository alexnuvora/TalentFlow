create or replace function public.service_prepare_integration_oauth(
  p_company uuid,p_provider text,p_user uuid,p_verifier text,p_redirect_uri text,p_return_to text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_state uuid:=gen_random_uuid();
  v_verifier_secret uuid;
  v_cfg private.recruitment_integration_configs%rowtype;
  v_expired record;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;

  for v_expired in select state,verifier_secret_id from private.integration_oauth_states where expires_at<=now() or consumed_at is not null
  loop
    delete from vault.secrets where id=v_expired.verifier_secret_id;
  end loop;
  delete from private.integration_oauth_states where expires_at<=now() or consumed_at is not null;

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
    'state',v_state,'client_id',v_cfg.public_config->>'client_id','tenant_id',v_cfg.public_config->>'tenant_id',
    'organization_id',v_cfg.public_config->>'organization_id','requested_scopes',v_cfg.public_config->>'scopes'
  );
end
$$;
