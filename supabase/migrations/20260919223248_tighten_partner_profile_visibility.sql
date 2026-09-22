drop policy if exists "partner profiles read workspace" on public.partner_profiles;
create policy "partner profiles read own or manager" on public.partner_profiles for select to authenticated
using (company_id=current_company_id() and (user_id=(select auth.uid()) or is_manager()));
