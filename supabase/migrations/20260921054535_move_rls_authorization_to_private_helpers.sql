grant usage on schema private to authenticated, service_role;
grant execute on function private.current_company_id() to authenticated, service_role;
grant execute on function private.is_manager() to authenticated, service_role;
grant execute on function private.partner_is_active(uuid) to authenticated, service_role;

do $$
declare r record; q text;
begin
 for r in
   select tablename,policyname,cmd,roles,qual,with_check
   from pg_policies
   where schemaname='public'
     and (coalesce(qual,'') ~ '(current_company_id|is_manager|partner_is_active)'
       or coalesce(with_check,'') ~ '(current_company_id|is_manager|partner_is_active)')
 loop
   q := 'alter policy '||quote_ident(r.policyname)||' on public.'||quote_ident(r.tablename);
   if r.roles is not null then q:=q||' to '||(select string_agg(quote_ident(x),',') from unnest(r.roles) x); end if;
   if r.qual is not null then q:=q||' using ('||
     replace(replace(replace(r.qual,'current_company_id()','private.current_company_id()'),'is_manager()','private.is_manager()'),'partner_is_active()','private.partner_is_active()')||')'; end if;
   if r.with_check is not null then q:=q||' with check ('||
     replace(replace(replace(r.with_check,'current_company_id()','private.current_company_id()'),'is_manager()','private.is_manager()'),'partner_is_active()','private.partner_is_active()')||')'; end if;
   execute q;
 end loop;
end $$;

create or replace function public.current_company_id()
returns uuid language sql stable security invoker set search_path='' as $$ select private.current_company_id() $$;
create or replace function public.is_manager()
returns boolean language sql stable security invoker set search_path='' as $$ select private.is_manager() $$;
create or replace function public.partner_is_active(p_partner uuid default auth.uid())
returns boolean language sql stable security invoker set search_path='' as $$ select private.partner_is_active(p_partner) $$;
create or replace function public.require_workspace_feature(p_feature text)
returns void language plpgsql stable security invoker set search_path='' as $$
declare c uuid;
begin
 c:=private.current_company_id();
 if c is null or not public.workspace_feature_enabled(c,p_feature) then
   raise exception 'This feature requires an active subscription that includes it';
 end if;
end $$;
