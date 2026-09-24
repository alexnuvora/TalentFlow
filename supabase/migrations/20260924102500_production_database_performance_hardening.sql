create index if not exists idx_ai_call_transcripts_campaign_id on public.ai_call_transcripts(campaign_id);
create index if not exists idx_ai_call_transcripts_client_id on public.ai_call_transcripts(client_id);
create index if not exists idx_ai_call_transcripts_dialer_item_id on public.ai_call_transcripts(dialer_item_id);
create index if not exists idx_call_gateway_commands_request_id on public.call_gateway_commands(request_id);
create index if not exists idx_call_gateway_events_request_id on public.call_gateway_events(request_id);
create index if not exists idx_client_contact_notes_client_id on public.client_contact_notes(client_id);
create index if not exists idx_client_external_vacancies_client_id on public.client_external_vacancies(client_id);
create index if not exists idx_partner_candidate_pipeline_candidate_id on public.partner_candidate_pipeline(candidate_id);
create index if not exists idx_partner_candidate_pipeline_job_id on public.partner_candidate_pipeline(job_id);
create index if not exists idx_partner_candidate_pipeline_partner_id on public.partner_candidate_pipeline(partner_id);
create index if not exists idx_partner_candidate_pipeline_reviewed_by on public.partner_candidate_pipeline(reviewed_by);
create index if not exists idx_partner_handoffs_approved_by on public.partner_commercial_handoffs(approved_by);
create index if not exists idx_partner_handoffs_approved_job_id on public.partner_commercial_handoffs(approved_job_id);
create index if not exists idx_partner_handoffs_client_id on public.partner_commercial_handoffs(client_id);
create index if not exists idx_partner_handoffs_partner_id on public.partner_commercial_handoffs(partner_id);
create index if not exists idx_partner_handoffs_prospect_id on public.partner_commercial_handoffs(prospect_id);
create index if not exists idx_partner_commission_adjustments_agreement_id on public.partner_commission_adjustments(agreement_id);
create index if not exists idx_partner_commission_adjustments_approved_by on public.partner_commission_adjustments(approved_by);
create index if not exists idx_partner_commission_adjustments_placement_id on public.partner_commission_adjustments(placement_id);
create index if not exists idx_partner_commission_adjustments_source_invoice_id on public.partner_commission_adjustments(source_invoice_id);
create index if not exists idx_partner_prospects_partner_id on public.partner_prospects(partner_id);
create index if not exists idx_partner_prospects_promoted_client_id on public.partner_prospects(promoted_client_id);
create index if not exists idx_partner_prospects_reviewed_by on public.partner_prospects(reviewed_by);

drop policy if exists "client briefs role aware read" on public.client_ai_briefs;
create policy "client briefs role aware read" on public.client_ai_briefs for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or ((select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=client_ai_briefs.company_id and a.partner_id=(select auth.uid()) and a.client_id=client_ai_briefs.client_id and a.completed_at is null)));

drop policy if exists "partner prospects select" on public.partner_prospects;
create policy "partner prospects select" on public.partner_prospects for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));
drop policy if exists "partner prospects update" on public.partner_prospects;
create policy "partner prospects update" on public.partner_prospects for update to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))))
with check (company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));

drop policy if exists "partner activity assigned client select" on public.partner_client_activity;
create policy "partner activity assigned client select" on public.partner_client_activity for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_client_activity.client_id and a.completed_at is null))));
drop policy if exists "partner activity assigned client insert" on public.partner_client_activity;
create policy "partner activity assigned client insert" on public.partner_client_activity for insert to authenticated with check (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_client_activity.client_id and a.completed_at is null))));
drop policy if exists "partner activity assigned client update" on public.partner_client_activity;
create policy "partner activity assigned client update" on public.partner_client_activity for update to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_client_activity.client_id and a.completed_at is null))))
with check (company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_client_activity.client_id and a.completed_at is null))));

drop policy if exists "commission adjustments read own or managers" on public.partner_commission_adjustments;
create policy "commission adjustments read own or managers" on public.partner_commission_adjustments for select to authenticated using (
 company_id=(select private.current_company_id()) and (partner_user_id=(select auth.uid()) or (select private.is_manager())));

drop policy if exists "partner handoffs select" on public.partner_commercial_handoffs;
create policy "partner handoffs select" on public.partner_commercial_handoffs for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));
drop policy if exists "partner handoffs insert" on public.partner_commercial_handoffs;
create policy "partner handoffs insert" on public.partner_commercial_handoffs for insert to authenticated with check (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));
drop policy if exists "partner handoffs update" on public.partner_commercial_handoffs;
create policy "partner handoffs update" on public.partner_commercial_handoffs for update to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))))
with check (company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));

drop policy if exists "partner candidate pipeline select" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline select" on public.partner_candidate_pipeline for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));
drop policy if exists "partner candidate pipeline insert" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline insert" on public.partner_candidate_pipeline for insert to authenticated with check (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));
drop policy if exists "partner candidate pipeline update" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline update" on public.partner_candidate_pipeline for update to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))))
with check (company_id=(select private.current_company_id()) and ((select private.is_manager()) or (partner_id=(select auth.uid()) and (select private.partner_is_active()))));

drop policy if exists "partner notes assigned client read" on public.partner_client_notes;
create policy "partner notes assigned client read" on public.partner_client_notes for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or ((select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=partner_client_notes.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_client_notes.client_id and a.completed_at is null))));
drop policy if exists "partner notes insert assigned client" on public.partner_client_notes;
create policy "partner notes insert assigned client" on public.partner_client_notes for insert to authenticated with check (
 company_id=(select private.current_company_id()) and partner_id=(select auth.uid()) and (select private.partner_is_active()) and exists(
  select 1 from public.partner_assignments a where a.company_id=partner_client_notes.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_client_notes.client_id and a.completed_at is null));

drop policy if exists "partner attributed placements read" on public.placements;
drop policy if exists "placements managers all" on public.placements;
create policy "placements role aware read" on public.placements for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or ((select private.partner_is_active()) and exists(
  select 1 from public.partner_attributions a where a.company_id=placements.company_id and a.partner_id=(select auth.uid()) and a.placement_id=placements.id and a.attribution_type='placement_owner' and a.status='active'))));
create policy "placements managers insert" on public.placements for insert to authenticated with check (
 company_id=(select private.current_company_id()) and (select private.is_manager()));
create policy "placements managers update" on public.placements for update to authenticated using (
 company_id=(select private.current_company_id()) and (select private.is_manager()))
with check (company_id=(select private.current_company_id()) and (select private.is_manager()));
create policy "placements managers delete" on public.placements for delete to authenticated using (
 company_id=(select private.current_company_id()) and (select private.is_manager()));
