create or replace function public.internal_provider_oauth_disconnect(p_company uuid,p_provider text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_cfg private.recruitment_integration_configs%rowtype;v_refs jsonb;v_id text;
begin
 select * into v_cfg from private.recruitment_integration_configs where company_id=p_company and provider=p_provider for update;
 if not found then raise exception 'Provider configuration not found'; end if;
 v_refs:=coalesce(v_cfg.secret_refs,'{}'::jsonb);
 for v_id in select value from jsonb_each_text(v_refs) where key in ('access_token','refresh_token')
 loop delete from vault.secrets where id=v_id::uuid; end loop;
 v_refs:=v_refs-'access_token'-'refresh_token';
 update private.recruitment_integration_configs
 set secret_refs=v_refs,public_config=(coalesce(public_config,'{}'::jsonb)-'token_expires_at'-'granted_scopes'-'connected_account'),
     last_tested_at=now(),last_test_result='disconnected',updated_at=now()
 where company_id=p_company and provider=p_provider;
 update public.recruitment_integrations
 set status='configured',configuration_note='OAuth application is configured; authorised provider account is disconnected.',last_checked_at=now(),updated_at=now()
 where company_id=p_company and provider=p_provider;
end
$$;
revoke all on function public.internal_provider_oauth_disconnect(uuid,text) from public,anon,authenticated;
grant execute on function public.internal_provider_oauth_disconnect(uuid,text) to service_role;

create or replace function public.internal_provider_oauth_store_tokens(
  p_company uuid,p_provider text,p_access_token text,p_refresh_token text,p_expires_at timestamptz,p_scopes text,p_account_label text
) returns void
language plpgsql
security definer
set search_path=''
as $$
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
 update public.recruitment_integrations set status='connected',configuration_note='OAuth connection established and verified.',last_checked_at=now(),updated_at=now()
 where company_id=p_company and provider=p_provider;
 update public.job_distribution_requests set status='requested',error_message=null,updated_at=now()
 where company_id=p_company and provider=p_provider and status='configuration_required';
 update public.partner_integration_requests set status='fulfilled',reviewed_at=coalesce(reviewed_at,now()),updated_at=now(),
   manager_notes=coalesce(manager_notes,'Provider connected by Vorlen management.')
 where company_id=p_company and provider=p_provider and status in ('requested','under_review','approved');
end
$$;
