-- Close authenticated candidate/recruitment RPC surface while candidate processing is disabled.
revoke execute on function public.client_portal_action(uuid,text,text) from authenticated;
revoke execute on function public.client_portal_data() from authenticated;
revoke execute on function public.client_review_submission(uuid,text,text) from authenticated;
revoke execute on function public.create_candidate_portal_token(uuid,integer) from authenticated;
revoke execute on function public.get_candidate_portal_token(uuid) from authenticated;
revoke execute on function public.manage_interview(uuid,text,timestamptz,integer,text,text) from authenticated;
revoke execute on function public.record_introduction_compliance(uuid,text,text,text,boolean,boolean,text) from authenticated;
revoke execute on function public.reserve_client_submission(uuid,text,text,text) from authenticated;
revoke execute on function public.review_application(uuid,text,text) from authenticated;
revoke execute on function public.revoke_candidate_portal_token(uuid) from authenticated;
revoke execute on function public.signoff_screening_report(uuid) from authenticated;

-- Pin search_path on authenticated SECURITY DEFINER RPCs that intentionally remain exposed.
alter function public.calculate_placement_fee(uuid,numeric,numeric,numeric) set search_path='';
alter function public.campaign_performance() set search_path='';
alter function public.create_placement_invoice(uuid,date) set search_path='';
alter function public.current_company_id() set search_path='';
alter function public.is_manager() set search_path='';
alter function public.partner_is_active(uuid) set search_path='';
alter function public.record_invoice_adjustment(uuid,text,numeric,text,text) set search_path='';
alter function public.record_invoice_payment(uuid,numeric,text,text) set search_path='';
alter function public.void_invoice(uuid,text) set search_path='';
