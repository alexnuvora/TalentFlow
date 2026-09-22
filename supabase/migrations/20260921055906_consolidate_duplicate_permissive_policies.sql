drop policy if exists "submissions staff write" on public.candidate_submissions;
create policy "submissions staff insert" on public.candidate_submissions for insert to authenticated with check ((company_id=private.current_company_id()) and private.is_manager());
create policy "submissions staff update" on public.candidate_submissions for update to authenticated using ((company_id=private.current_company_id()) and private.is_manager()) with check ((company_id=private.current_company_id()) and private.is_manager());
create policy "submissions staff delete" on public.candidate_submissions for delete to authenticated using ((company_id=private.current_company_id()) and private.is_manager());
create policy "submissions read" on public.candidate_submissions for select to authenticated using ((company_id=private.current_company_id()) and (private.is_manager() or client_id=(select profiles.client_id from public.profiles where profiles.id=(select auth.uid()))));

drop policy if exists "submissions client read" on public.candidate_submissions;

drop policy if exists "candidate sourcer insert" on public.candidates;
drop policy if exists "candidates approved staff insert" on public.candidates;
create policy "candidates authorised insert" on public.candidates for insert to authenticated with check ((company_id=private.current_company_id()) and (private.has_candidate_data_access() or (private.partner_is_active() and exists(select 1 from public.partner_profiles pp where pp.user_id=(select auth.uid()) and pp.company_id=candidates.company_id and pp.active and pp.specialism=any(array['candidate_sourcer'::text,'hybrid'::text])))));

drop policy if exists "candidates approved staff select" on public.candidates;
drop policy if exists "partner assigned candidates select" on public.candidates;
create policy "candidates authorised select" on public.candidates for select to authenticated using ((company_id=private.current_company_id()) and (private.has_candidate_data_access() or (private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=candidates.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=candidates.id and a.completed_at is null))));

drop policy if exists "candidates approved staff update" on public.candidates;
drop policy if exists "partner assigned candidates update" on public.candidates;
create policy "candidates authorised update" on public.candidates for update to authenticated using ((company_id=private.current_company_id()) and (private.has_candidate_data_access() or (private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=candidates.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=candidates.id and a.completed_at is null)))) with check ((company_id=private.current_company_id()) and (private.has_candidate_data_access() or private.partner_is_active()));

drop policy if exists "jobs role aware" on public.jobs;
drop policy if exists "partner assigned jobs select" on public.jobs;
create policy "jobs authorised select" on public.jobs for select to authenticated using ((company_id=private.current_company_id()) and (private.is_manager() or client_id=(select profiles.client_id from public.profiles where profiles.id=(select auth.uid())) or (private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=jobs.company_id and a.partner_id=(select auth.uid()) and a.job_id=jobs.id and a.completed_at is null))));

drop policy if exists "candidate sourcer self assigns candidate" on public.partner_assignments;
drop policy if exists "partner assignments managers insert" on public.partner_assignments;
create policy "partner assignments authorised insert" on public.partner_assignments for insert to authenticated with check ((company_id=private.current_company_id()) and (private.is_manager() or (partner_id=(select auth.uid()) and private.partner_is_active() and candidate_id is not null and client_id is null and job_id is null and exists(select 1 from public.partner_profiles pp where pp.user_id=(select auth.uid()) and pp.company_id=partner_assignments.company_id and pp.active and pp.specialism=any(array['candidate_sourcer'::text,'hybrid'::text])))));

drop policy if exists "manager attribution" on public.partner_attributions;
drop policy if exists "attribution read" on public.partner_attributions;
create policy "attribution select" on public.partner_attributions for select to authenticated using ((company_id=(select private.current_company_id())) and ((partner_id=(select auth.uid())) or (select private.is_manager())));
create policy "attribution managers insert" on public.partner_attributions for insert to authenticated with check ((company_id=(select private.current_company_id())) and (select private.is_manager()));
create policy "attribution managers update" on public.partner_attributions for update to authenticated using ((company_id=(select private.current_company_id())) and (select private.is_manager())) with check ((company_id=(select private.current_company_id())) and (select private.is_manager()));
create policy "attribution managers delete" on public.partner_attributions for delete to authenticated using ((company_id=(select private.current_company_id())) and (select private.is_manager()));

drop policy if exists "manager onboarding" on public.partner_onboarding;
drop policy if exists "onboarding read" on public.partner_onboarding;
drop policy if exists "partner onboarding update" on public.partner_onboarding;
create policy "onboarding select" on public.partner_onboarding for select to authenticated using ((company_id=(select private.current_company_id())) and ((partner_id=(select auth.uid())) or (select private.is_manager())));
create policy "onboarding managers insert" on public.partner_onboarding for insert to authenticated with check ((company_id=(select private.current_company_id())) and (select private.is_manager()));
create policy "onboarding update" on public.partner_onboarding for update to authenticated using ((company_id=(select private.current_company_id())) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and status=any(array['terms_pending'::text,'details_pending'::text,'review_pending'::text])))) with check ((company_id=(select private.current_company_id())) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and status=any(array['terms_pending'::text,'details_pending'::text,'review_pending'::text]))));
create policy "onboarding managers delete" on public.partner_onboarding for delete to authenticated using ((company_id=(select private.current_company_id())) and (select private.is_manager()));
