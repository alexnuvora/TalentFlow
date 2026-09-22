create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create or replace function private.current_company_id()
returns uuid language sql stable security definer set search_path='' as $$
 select company_id from public.profiles where id=auth.uid()
$$;
create or replace function private.is_manager()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','manager'))
$$;
revoke all on function private.current_company_id() from public,anon,authenticated;
revoke all on function private.is_manager() from public,anon,authenticated;

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path='' as $$
 select private.current_company_id()
$$;
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_manager()
$$;
revoke all on function public.current_company_id() from public,anon;
revoke all on function public.is_manager() from public,anon;
grant execute on function public.current_company_id() to authenticated,service_role;
grant execute on function public.is_manager() to authenticated,service_role;
