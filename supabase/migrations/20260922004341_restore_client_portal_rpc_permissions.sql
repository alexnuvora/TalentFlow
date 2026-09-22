revoke execute on function public.client_portal_data() from public, anon;
grant execute on function public.client_portal_data() to authenticated, service_role;

revoke execute on function public.client_portal_action(uuid,text,text) from public, anon;
grant execute on function public.client_portal_action(uuid,text,text) to authenticated, service_role;
