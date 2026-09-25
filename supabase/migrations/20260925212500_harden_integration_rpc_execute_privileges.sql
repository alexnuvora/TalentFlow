revoke execute on function public.manager_integration_requests() from public,anon;
revoke execute on function public.manager_review_integration_request(uuid,text,text) from public,anon;
revoke execute on function public.manager_update_recruitment_integration(text,text,text) from public,anon;
revoke execute on function public.partner_integration_requests() from public,anon;
revoke execute on function public.partner_request_integration_access(text,uuid,text) from public,anon;

grant execute on function public.manager_integration_requests() to authenticated;
grant execute on function public.manager_review_integration_request(uuid,text,text) to authenticated;
grant execute on function public.manager_update_recruitment_integration(text,text,text) to authenticated;
grant execute on function public.partner_integration_requests() to authenticated;
grant execute on function public.partner_request_integration_access(text,uuid,text) to authenticated;
