drop policy if exists "partner assignments authorised insert" on public.partner_assignments;
create policy "partner assignments managers insert"
on public.partner_assignments for insert to authenticated
with check (
  company_id=private.current_company_id()
  and private.is_manager()
);
