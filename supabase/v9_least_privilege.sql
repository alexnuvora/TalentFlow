-- Vorlen V9: least-privilege Data API and RPC hardening.

-- Remove table-owner-style defaults such as TRUNCATE, REFERENCES and TRIGGER.
revoke all privileges on all tables in schema public from anon, authenticated;

-- Public careers and campaign pages are read-only.
grant select on public.jobs, public.campaigns, public.campaign_links to anon;

-- Signed-in users still pass RLS; grants only make the intended CRUD verbs available.
grant select on all tables in schema public to authenticated;
grant insert, update, delete on
  public.clients, public.jobs, public.candidates, public.applications,
  public.client_contracts, public.placements, public.interviews,
  public.campaigns, public.application_events, public.automation_sequences,
  public.billing_connections, public.campaign_links, public.campaign_events,
  public.automation_enrollments, public.recruiter_booking_slots,
  public.candidate_bookings, public.screening_reports, public.call_notes,
  public.candidate_submissions, public.activity_log, public.data_rights_requests
to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Restrict non-public policies to signed-in users so anonymous public reads do
-- not evaluate tenant helper functions.
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname='public'
      and policyname not in ('public can read published jobs','campaigns public','campaign links public')
  loop
    execute format('alter policy %I on public.%I to authenticated',p.policyname,p.tablename);
  end loop;
end $$;
alter policy "public can read published jobs" on public.jobs to anon;
alter policy "campaigns public" on public.campaigns to anon;
alter policy "campaign links public" on public.campaign_links to anon;

-- New functions default to EXECUTE for PUBLIC. Rebuild the RPC allowlist.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.create_candidate_portal_token(uuid,integer) to authenticated;
grant execute on function public.calculate_placement_fee(uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.campaign_performance() to authenticated;
grant execute on function public.client_review_submission(uuid,text,text) to authenticated;
grant execute on function public.public_booking_slots(text) to anon, authenticated;
grant execute on function public.book_candidate_slot(text,uuid) to anon, authenticated;
grant execute on function public.check_application_rate_limit(text,integer,integer) to service_role;
grant execute on function public.track_campaign_event(text,text,text,text,text,jsonb) to service_role;

comment on table public.application_rate_limits is 'Internal service-role rate-limit state; intentionally has no user RLS policy.';
comment on table public.candidate_portal_tokens is 'Internal bearer-token state; intentionally has no direct user RLS policy.';
