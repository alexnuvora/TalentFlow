-- Allow authenticated Vorlen workspace users to read researched public vacancies
-- linked to clients they are authorised to access. Writes remain server-side only.

grant select on public.client_external_vacancies to authenticated;

drop policy if exists "client external vacancies role aware read" on public.client_external_vacancies;
create policy "client external vacancies role aware read"
on public.client_external_vacancies
for select
to authenticated
using (
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or exists(
     select 1 from public.profiles p
     where p.id=(select auth.uid())
       and p.role='recruiter'::public.user_role
   )
   or exists(
     select 1 from public.profiles p
     where p.id=(select auth.uid())
       and p.role='viewer'::public.user_role
       and p.client_id=client_external_vacancies.client_id
   )
   or (
     private.partner_is_active()
     and exists(
       select 1 from public.partner_assignments a
       where a.company_id=client_external_vacancies.company_id
         and a.partner_id=(select auth.uid())
         and a.client_id=client_external_vacancies.client_id
         and a.completed_at is null
     )
   )
 )
);
