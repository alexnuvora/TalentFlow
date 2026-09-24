drop policy if exists "client briefs workspace read" on public.client_ai_briefs;
create policy "client briefs role aware read"
on public.client_ai_briefs for select to authenticated
using (
  company_id=private.current_company_id()
  and (
    private.is_manager()
    or (
      private.partner_is_active()
      and exists (
        select 1 from public.partner_assignments a
        where a.company_id=client_ai_briefs.company_id
          and a.partner_id=auth.uid()
          and a.client_id=client_ai_briefs.client_id
          and a.completed_at is null
      )
    )
  )
);
