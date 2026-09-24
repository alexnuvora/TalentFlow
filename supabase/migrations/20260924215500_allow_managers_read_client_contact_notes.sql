grant select on table public.client_contact_notes to authenticated;

drop policy if exists client_contact_notes_manager_select on public.client_contact_notes;
create policy client_contact_notes_manager_select
on public.client_contact_notes
for select
to authenticated
using (
  company_id = public.current_company_id()
  and public.is_manager()
);
