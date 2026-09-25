
-- Security review: trigger-only SECURITY DEFINER functions must never be callable through PostgREST RPC.
revoke all on function public.sync_partner_sequence_status() from public,anon,authenticated;
revoke all on function public.cancel_partner_outreach_on_dnc() from public,anon,authenticated;
revoke all on function public.cancel_partner_work_on_client_unassignment() from public,anon,authenticated;
