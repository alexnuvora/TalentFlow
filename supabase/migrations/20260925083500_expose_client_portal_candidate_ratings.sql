
create or replace function public.client_portal_ratings()
returns table(submission_id uuid,rating integer)
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

  return query
  select s.id,s.client_rating::integer
  from public.candidate_submissions s
  where s.company_id=v_company
    and s.client_id=v_client
    and s.status not in ('draft','withdrawn','approved_to_send');
end
$$;

revoke all on function public.client_portal_ratings() from public,anon;
grant execute on function public.client_portal_ratings() to authenticated;
