revoke all on function public.get_candidate_portal_token(uuid) from public,anon;
revoke all on function public.create_candidate_portal_token(uuid,integer) from public,anon;
revoke all on function public.revoke_candidate_portal_token(uuid) from public,anon;

grant execute on function public.get_candidate_portal_token(uuid) to authenticated;
grant execute on function public.create_candidate_portal_token(uuid,integer) to authenticated;
grant execute on function public.revoke_candidate_portal_token(uuid) to authenticated;
