
-- Remove remaining per-row auth function reevaluation in partner RLS policies.

create index if not exists clients_partner_terms_send_authorized_by_idx
  on public.clients(partner_terms_send_authorized_by);

drop policy if exists "partner activity assigned client select" on public.partner_client_activity;
create policy "partner activity assigned client select" on public.partner_client_activity
for select to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_develop_clients((select auth.uid())))
      and exists(
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_activity.company_id
          and a.partner_id=(select auth.uid())
          and a.client_id=partner_client_activity.client_id
          and a.completed_at is null
      )
    )
  )
);

drop policy if exists "partner activity assigned client insert" on public.partner_client_activity;
create policy "partner activity assigned client insert" on public.partner_client_activity
for insert to authenticated
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_develop_clients((select auth.uid())))
      and exists(
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_activity.company_id
          and a.partner_id=(select auth.uid())
          and a.client_id=partner_client_activity.client_id
          and a.completed_at is null
      )
    )
  )
);

drop policy if exists "partner activity assigned client update" on public.partner_client_activity;
create policy "partner activity assigned client update" on public.partner_client_activity
for update to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_develop_clients((select auth.uid())))
      and exists(
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_activity.company_id
          and a.partner_id=(select auth.uid())
          and a.client_id=partner_client_activity.client_id
          and a.completed_at is null
      )
    )
  )
)
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_develop_clients((select auth.uid())))
      and exists(
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_activity.company_id
          and a.partner_id=(select auth.uid())
          and a.client_id=partner_client_activity.client_id
          and a.completed_at is null
      )
    )
  )
);

drop policy if exists "partner handoffs insert" on public.partner_commercial_handoffs;
create policy "partner handoffs insert" on public.partner_commercial_handoffs
for insert to authenticated
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_close_clients((select auth.uid())))
    )
  )
);

drop policy if exists "partner handoffs update" on public.partner_commercial_handoffs;
create policy "partner handoffs update" on public.partner_commercial_handoffs
for update to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_close_clients((select auth.uid())))
    )
  )
)
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_close_clients((select auth.uid())))
    )
  )
);

drop policy if exists "candidates authorised select" on public.candidates;
create policy "candidates authorised select" on public.candidates
for select to authenticated
using(
  (select public.candidate_processing_allowed(company_id))
  and company_id=(select private.current_company_id())
  and (
    (select private.has_candidate_data_access())
    or (
      (select private.partner_is_active())
      and (select private.partner_can_source_candidates((select auth.uid())))
      and exists(
        select 1 from public.partner_assignments a
        where a.company_id=candidates.company_id
          and a.partner_id=(select auth.uid())
          and a.candidate_id=candidates.id
          and a.completed_at is null
      )
    )
  )
);

drop policy if exists "partner candidate pipeline insert" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline insert" on public.partner_candidate_pipeline
for insert to authenticated
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_source_candidates((select auth.uid())))
    )
  )
);

drop policy if exists "partner candidate pipeline select" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline select" on public.partner_candidate_pipeline
for select to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_source_candidates((select auth.uid())))
    )
  )
);

drop policy if exists "partner candidate pipeline update" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline update" on public.partner_candidate_pipeline
for update to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_source_candidates((select auth.uid())))
    )
  )
)
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_source_candidates((select auth.uid())))
    )
  )
);

drop policy if exists "partner notes assigned client read" on public.partner_client_notes;
create policy "partner notes assigned client read" on public.partner_client_notes
for select to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      (select private.partner_is_active())
      and (select private.partner_can_develop_clients((select auth.uid())))
      and exists(
        select 1 from public.partner_assignments a
        where a.company_id=partner_client_notes.company_id
          and a.partner_id=(select auth.uid())
          and a.client_id=partner_client_notes.client_id
          and a.completed_at is null
      )
    )
  )
);

drop policy if exists "partner notes insert assigned client" on public.partner_client_notes;
create policy "partner notes insert assigned client" on public.partner_client_notes
for insert to authenticated
with check(
  company_id=(select private.current_company_id())
  and partner_id=(select auth.uid())
  and (select private.partner_is_active())
  and (select private.partner_can_develop_clients((select auth.uid())))
  and exists(
    select 1 from public.partner_assignments a
    where a.company_id=partner_client_notes.company_id
      and a.partner_id=(select auth.uid())
      and a.client_id=partner_client_notes.client_id
      and a.completed_at is null
  )
);

drop policy if exists "partner prospects update" on public.partner_prospects;
create policy "partner prospects update" on public.partner_prospects
for update to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_prospect((select auth.uid())))
    )
  )
)
with check(
  company_id=(select private.current_company_id())
  and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      and (select private.partner_is_active())
      and (select private.partner_can_prospect((select auth.uid())))
    )
  )
);
