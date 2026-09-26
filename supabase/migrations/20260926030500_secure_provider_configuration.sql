create table if not exists private.recruitment_integration_configs (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  auth_mode text not null default 'api_key',
  public_config jsonb not null default '{}'::jsonb,
  secret_refs jsonb not null default '{}'::jsonb,
  configured_by uuid references auth.users(id) on delete set null,
  configured_at timestamptz,
  last_tested_at timestamptz,
  last_test_result text,
  updated_at timestamptz not null default now(),
  primary key(company_id,provider)
);

create or replace function public.manager_integration_configuration(p_provider text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_cfg private.recruitment_integration_configs%rowtype;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if not exists(select 1 from public.recruitment_integrations where company_id=v_company and provider=p_provider) then raise exception 'Integration provider not found'; end if;
  select * into v_cfg from private.recruitment_integration_configs where company_id=v_company and provider=p_provider;
  return jsonb_build_object(
    'provider',p_provider,
    'auth_mode',coalesce(v_cfg.auth_mode,'api_key'),
    'public_config',coalesce(v_cfg.public_config,'{}'::jsonb),
    'configured_secret_keys',coalesce((select jsonb_agg(k order by k) from jsonb_object_keys(coalesce(v_cfg.secret_refs,'{}'::jsonb)) k),'[]'::jsonb),
    'configured_at',v_cfg.configured_at,
    'last_tested_at',v_cfg.last_tested_at,
    'last_test_result',v_cfg.last_test_result
  );
end
$$;

create or replace function public.manager_save_integration_configuration(
  p_provider text,p_auth_mode text,p_public_config jsonb default '{}'::jsonb,p_secrets jsonb default '{}'::jsonb
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

create or replace function public.manager_disconnect_recruitment_integration(p_provider text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_refs jsonb;v_id text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_provider='vorlen_careers' then raise exception 'Native Vorlen Careers cannot be disconnected'; end if;
  select secret_refs into v_refs from private.recruitment_integration_configs where company_id=v_company and provider=p_provider;
  if v_refs is not null then
    for v_id in select value from jsonb_each_text(v_refs)
    loop
      delete from vault.secrets where id=v_id::uuid;
    end loop;
  end if;
  delete from private.recruitment_integration_configs where company_id=v_company and provider=p_provider;
  update public.recruitment_integrations
  set status='configuration_required',configuration_note='Provider credentials are not configured.',last_checked_at=now(),updated_at=now()
  where company_id=v_company and provider=p_provider;
end
$$;

revoke all on function public.manager_integration_configuration(text) from public,anon;
revoke all on function public.manager_save_integration_configuration(text,text,jsonb,jsonb) from public,anon;
revoke all on function public.manager_disconnect_recruitment_integration(text) from public,anon;
grant execute on function public.manager_integration_configuration(text) to authenticated;
grant execute on function public.manager_save_integration_configuration(text,text,jsonb,jsonb) to authenticated;
grant execute on function public.manager_disconnect_recruitment_integration(text) to authenticated;
