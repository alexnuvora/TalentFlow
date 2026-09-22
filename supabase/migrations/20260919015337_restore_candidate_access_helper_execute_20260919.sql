-- RLS policies on candidates/applications invoke this helper as the authenticated caller.
-- Keep PUBLIC and anon denied, but authenticated must be able to execute it.
revoke all on function public.has_candidate_data_access() from public, anon;
grant execute on function public.has_candidate_data_access() to authenticated;
