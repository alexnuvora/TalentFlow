create or replace function public.manager_save_integration_configuration(
  p_provider text,
  p_auth_mode text,
  p_public_config jsonb default '{}'::jsonb,
  p_secrets jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_refs jsonb:='{}'::jsonb;
  v_existing jsonb:='{}'::jsonb;
  v_key text;v_value text;v_id uuid;v_name text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_auth_mode not in ('api_key','basic','oauth2','manual','none') then raise exception 'Unsupported authentication mode'; end if;
  if not exists(select 1 from public.recruitment_integrations where company_id=v_company and provider=p_provider) then raise exception 'Integration provider not found'; end if;

  select secret_refs into v_existing from private.recruitment_integration_configs where company_id=v_company and provider=p_provider;
  v_refs:=coalesce(v_existing,'{}'::jsonb);

  for v_key,v_value in select key,value from jsonb_each_text(coalesce(p_secrets,'{}'::jsonb))
  loop
    if nullif(btrim(v_value),'') is null then continue; end if;
    if v_key !~ '^[a-z0-9_]{2,50}$' then raise exception 'Invalid secret field'; end if;
    if v_refs ? v_key then
      v_id:=(v_refs->>v_key)::uuid;
      perform vault.update_secret(v_id,v_value,null,null,null);
    else
      v_name:='vorlen_'||replace(v_company::text,'-','')||'_'||p_provider||'_'||v_key;
      v_id:=vault.create_secret(v_value,v_name,'Vorlen recruitment provider credential',null);
      v_refs:=v_refs||jsonb_build_object(v_key,v_id::text);
    end if;
  end loop;

  if p_provider in ('cv_library','careerbuilder','monster','reed','totaljobs') and not (v_refs ? 'api_key') then
    raise exception 'API key is required for this provider';
  end if;
  if p_provider in ('linkedin','google_calendar','microsoft_calendar') and not (v_refs ? 'client_secret') then
    raise exception 'OAuth client secret is required for this provider';
  end if;
  if p_provider in ('linkedin','google_calendar','microsoft_calendar')
     and nullif(btrim(coalesce(p_public_config->>'client_id','')),'') is null then
    raise exception 'OAuth client ID is required for this provider';
  end if;

  insert into private.recruitment_integration_configs(company_id,provider,auth_mode,public_config,secret_refs,configured_by,configured_at,updated_at)
  values(v_company,p_provider,p_auth_mode,coalesce(p_public_config,'{}'::jsonb),v_refs,auth.uid(),now(),now())
  on conflict(company_id,provider) do update set
    auth_mode=excluded.auth_mode,public_config=excluded.public_config,secret_refs=excluded.secret_refs,
    configured_by=auth.uid(),configured_at=now(),updated_at=now();

  update public.recruitment_integrations
  set status=case when p_provider='vorlen_careers' then 'connected' else 'configured' end,
      configuration_note=case when p_provider='vorlen_careers' then configuration_note else 'Credentials/configuration saved securely. Provider adapter must pass a live connection test before use.' end,
      last_checked_at=now(),updated_at=now()
  where company_id=v_company and provider=p_provider;

  return public.manager_integration_configuration(p_provider);
end
$$;
