alter function public.approve_partner_handoff_and_create_vacancy(uuid,text) security definer;
alter function public.approve_partner_handoff_and_create_vacancy(uuid,text) set search_path to '';

revoke all on function private.sync_terms_contract_for_client(uuid) from public,anon,authenticated;
revoke all on function public.protect_accepted_client_terms() from public,anon,authenticated;
revoke all on function public.sync_client_contract_after_terms_change() from public,anon,authenticated;

revoke all on function public.approve_partner_handoff_and_create_vacancy(uuid,text) from public,anon;
grant execute on function public.approve_partner_handoff_and_create_vacancy(uuid,text) to authenticated;
