create or replace function public.integration_oauth_store_tokens(
  p_company uuid,p_provider text,p_user uuid,p_access_token text,p_refresh_token text,p_token_type text,
  p_expires_at timestamptz,p_scopes text[],p_account_id text,p_account_label text
) returns void language plpgsql security definer set search_path='' as $$
declare v_old private.recruitment_integration_oauth_tokens%rowtype;v_access uuid;v_refresh uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Service role only'; end if;
  select * into v_old from private.recruitment_integration_oauth_tokens where company_id=p_company and provider=p_provider;
  if found and v_old.access_token_ref is not null then delete from vault.secrets where id=v_old.access_token_ref; end if;
  v_access:=vault.create_secret(p_access_token,null,'Vorlen OAuth access token',null);
  if nullif(p_refresh_token,'') is not null then
    if found and v_old.refresh_token_ref is not null then delete from vault.secrets where id=v_old.refresh_token_ref; end if;
    v_refresh:=vault.create_secret(p_refresh_token,null,'Vorlen OAuth refresh token',null);
  elsif found then
    v_refresh:=v_old.refresh_token_ref;
  end if;

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

create or replace function public.manager_disconnect_recruitment_integration(p_provider text)
returns void language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_refs jsonb;v_id text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_provider='vorlen_careers' then raise exception 'Native Vorlen Careers cannot be disconnected'; end if;
  if exists(select 1 from private.recruitment_integration_oauth_tokens where company_id=v_company and provider=p_provider) then
    raise exception 'Disconnect the OAuth account before removing the provider application configuration';
  end if;
  select secret_refs into v_refs from private.recruitment_integration_configs where company_id=v_company and provider=p_provider;
  if v_refs is not null then
    for v_id in select value from jsonb_each_text(v_refs)
    loop delete from vault.secrets where id=v_id::uuid; end loop;
  end if;
  delete from private.recruitment_integration_configs where company_id=v_company and provider=p_provider;
  update public.recruitment_integrations
  set status='configuration_required',configuration_note='Provider credentials are not configured.',last_checked_at=now(),updated_at=now()
  where company_id=v_company and provider=p_provider;
end $$;
