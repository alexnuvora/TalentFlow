
drop policy if exists "partner handoffs insert" on public.partner_commercial_handoffs;
create policy "partner handoffs insert" on public.partner_commercial_handoffs
for insert to authenticated
with check(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_close_clients(auth.uid())
   )
 )
);

drop policy if exists "partner handoffs update" on public.partner_commercial_handoffs;
create policy "partner handoffs update" on public.partner_commercial_handoffs
for update to authenticated
using(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_close_clients(auth.uid())
   )
 )
)
with check(
 company_id=private.current_company_id()
 and (
   private.is_manager()
   or (
     partner_id=auth.uid()
     and private.partner_is_active()
     and private.partner_can_close_clients(auth.uid())
   )
 )
);

create or replace function public.review_partner_closer_handover(p_request uuid,p_status text,p_to_partner uuid default null,p_notes text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
 r public.partner_client_handover_requests%rowtype;
 v_specialism text;
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('assigned','declined') then raise exception 'Status must be assigned or declined'; end if;

 select * into r
 from public.partner_client_handover_requests
 where id=p_request and company_id=v_company and status='requested'
 for update;
 if not found then raise exception 'Pending client handover not found'; end if;

 if p_status='assigned' then
   if p_to_partner is null then raise exception 'Choose a Lead Closer or Hybrid Partner'; end if;
   if p_to_partner=r.from_partner then raise exception 'The closer must be a different partner from the originating advisor'; end if;

   select pp.specialism into v_specialism
   from public.partner_profiles pp
   join public.partner_onboarding o on o.partner_id=pp.user_id and o.company_id=pp.company_id
   join public.profiles p on p.id=pp.user_id and p.company_id=pp.company_id and p.role='partner'
   where pp.user_id=p_to_partner and pp.company_id=v_company and pp.active and o.status='active';

   if v_specialism not in ('lead_closer','hybrid') then
     raise exception 'Selected partner is not an active Lead Closer or Hybrid Partner';
   end if;

   if not exists(
     select 1 from public.partner_assignments a
     where a.company_id=v_company and a.partner_id=p_to_partner
       and a.client_id=r.client_id and a.completed_at is null
   ) then
     insert into public.partner_assignments(company_id,partner_id,client_id,priority,objective)
     values(v_company,p_to_partner,r.client_id,'high',
       'Convert qualified employer opportunity into an active Vorlen client and secure the first vacancy.');
   end if;

   update public.partner_assignments
   set completed_at=coalesce(completed_at,now())
   where company_id=v_company and partner_id=r.from_partner
     and client_id=r.client_id and completed_at is null;
 end if;

 update public.partner_client_handover_requests
 set status=p_status,
     to_partner=case when p_status='assigned' then p_to_partner else null end,
     manager_notes=nullif(btrim(coalesce(p_notes,'')),''),
     reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=r.id;
end
$$;
