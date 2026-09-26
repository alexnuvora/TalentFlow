drop policy if exists "placements role aware read" on public.placements;
create policy "placements role aware read" on public.placements for select to authenticated using (
  company_id=(select private.current_company_id()) and (
    (select private.is_manager()) or (
      (select private.partner_is_active()) and exists (
        select 1 from public.partner_attributions a
        where a.company_id=placements.company_id and a.partner_id=(select auth.uid())
          and a.placement_id=placements.id and a.status='active'
          and a.attribution_type in ('placement_owner','client_commission_owner','candidate_commission_owner')
      )
    )
  )
);