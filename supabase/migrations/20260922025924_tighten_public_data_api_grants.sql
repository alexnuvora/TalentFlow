revoke all privileges on all tables in schema public from anon;
grant select on table public.jobs, public.campaigns, public.campaign_links to anon;

revoke all privileges on table
  public.application_rate_limits,
  public.candidate_portal_tokens,
  public.client_submission_review_tokens,
  public.compliance_audit_log,
  public.invoice_number_sequences,
  public.stripe_webhook_events
from authenticated, anon;

revoke execute on function public.assert_job_publish_compliance() from public, anon, authenticated;
revoke execute on function public.audit_commercial_change() from public, anon, authenticated;
revoke execute on function public.enforce_screening_human_review() from public, anon, authenticated;
revoke execute on function public.invalidate_ai_governance() from public, anon, authenticated;
revoke execute on function public.mark_application_record_retention() from public, anon, authenticated;
revoke execute on function public.pause_sequence_enrolments() from public, anon, authenticated;
revoke execute on function public.protect_paid_placement() from public, anon, authenticated;
revoke execute on function public.set_placement_campaign_from_application() from public, anon, authenticated;
