create policy "candidate sourcer self assigns candidate" on public.partner_assignments for insert to authenticated
with check (
 company_id=current_company_id()
 and partner_id=(select auth.uid())
 and candidate_id is not null and client_id is null and job_id is null
 and exists(select 1 from public.partner_profiles pp where pp.user_id=(select auth.uid()) and pp.company_id=partner_assignments.company_id and pp.active and pp.specialism in ('candidate_sourcer','hybrid'))
);
