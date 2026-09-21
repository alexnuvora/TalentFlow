-- Partner portfolio access hardening.
-- Partners can only read clients explicitly assigned to their active portfolio.
drop policy if exists "clients role aware" on public.clients;
create policy "clients role aware" on public.clients for select to authenticated using(
 company_id=public.current_company_id() and (
  public.is_manager()
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='viewer' and p.client_id=clients.id)
  or (
    public.partner_is_active()
    and exists(select 1 from public.partner_assignments a where a.company_id=clients.company_id and a.partner_id=(select auth.uid()) and a.client_id=clients.id and a.completed_at is null)
  )
 )
);