create or replace function private.partner_is_active(p_partner uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.partner_onboarding o
  join public.partner_agreements a on a.id=o.agreement_id
  where o.partner_id=p_partner and o.partner_id=auth.uid()
    and o.company_id=private.current_company_id()
    and o.status='active' and a.status='accepted' and a.accepted_at is not null
 )
$$;
revoke all on function private.partner_is_active(uuid) from public,anon,authenticated;

create or replace function public.partner_is_active(p_partner uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select private.partner_is_active(p_partner)
$$;
revoke all on function public.partner_is_active(uuid) from public,anon;
grant execute on function public.partner_is_active(uuid) to authenticated,service_role;

create or replace function public.require_workspace_feature(p_feature text)
returns void language plpgsql stable security definer set search_path='' as $$
declare c uuid;
begin
 c:=private.current_company_id();
 if c is null or not public.workspace_feature_enabled(c,p_feature) then
   raise exception 'This feature requires an active subscription that includes it';
 end if;
end $$;
revoke all on function public.require_workspace_feature(text) from public,anon;
grant execute on function public.require_workspace_feature(text) to authenticated,service_role;
