alter function public.has_candidate_data_access() security invoker;

drop policy if exists "recruiter_access_approval_self_select" on public.recruiter_data_access_approvals;
create policy "recruiter_access_approval_self_select"
on public.recruiter_data_access_approvals
for select to authenticated
using (
  user_id=(select auth.uid())
  and company_id=private.current_company_id()
);

revoke execute on function public.has_candidate_data_access() from public, anon;
grant execute on function public.has_candidate_data_access() to authenticated, service_role;
