drop policy if exists "staff_boundary" on public.client_contracts;

create policy "client contracts managers only"
on public.client_contracts
for all
to authenticated
using (
  private.is_manager()
  and company_id = private.current_company_id()
)
with check (
  private.is_manager()
  and company_id = private.current_company_id()
);
