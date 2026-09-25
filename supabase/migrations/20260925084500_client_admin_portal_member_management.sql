
create or replace function public.client_portal_members()
returns table(
  user_id uuid,
  email text,
  full_name text,
  portal_role text,
  status text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_client uuid;
  v_role text;
begin
  select c.company_id,c.client_id,c.portal_role
  into v_company,v_client,v_role
  from private.current_client_portal_context() c;

  if v_client is null then raise exception 'Client portal access required'; end if;
  if v_role<>'admin' then raise exception 'Client admin access required'; end if;

  return query
  select m.user_id,m.email,m.full_name,m.portal_role,m.status,m.updated_at
  from public.client_portal_memberships m
  where m.company_id=v_company and m.client_id=v_client
  order by case when m.user_id=auth.uid() then 0 else 1 end,m.full_name nulls last,m.email;
end
$$;

create or replace function public.client_admin_update_portal_member(
  p_user uuid,
  p_role text,
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_client uuid;
  v_role text;
begin
  select c.company_id,c.client_id,c.portal_role
  into v_company,v_client,v_role
  from private.current_client_portal_context() c;

  if v_client is null or v_role<>'admin' then raise exception 'Client admin access required'; end if;
  if p_user=auth.uid() then raise exception 'You cannot change or revoke your own client admin access'; end if;
  if p_role not in ('admin','hiring_manager','reviewer','read_only') then raise exception 'Invalid client portal role'; end if;
  if p_status not in ('active','revoked') then raise exception 'Invalid membership status'; end if;

  update public.client_portal_memberships
  set portal_role=p_role,status=p_status,updated_at=now()
  where user_id=p_user and company_id=v_company and client_id=v_client;

  if not found then raise exception 'Client portal member not found'; end if;
end
$$;

revoke all on function public.client_portal_members() from public,anon;
revoke all on function public.client_admin_update_portal_member(uuid,text,text) from public,anon;
grant execute on function public.client_portal_members() to authenticated;
grant execute on function public.client_admin_update_portal_member(uuid,text,text) to authenticated;
