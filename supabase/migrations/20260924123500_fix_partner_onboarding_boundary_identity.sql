create or replace function private.enforce_partner_onboarding_boundary()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_privileged boolean:=private.is_manager() or auth.role()='service_role' or auth.uid() is null;
begin
 new.updated_at:=now();
 if v_privileged then return new;end if;
 if old.partner_id<>auth.uid() or old.company_id<>private.current_company_id() then raise exception 'You may only update your own partner onboarding record';end if;
 new.partner_id:=old.partner_id;new.company_id:=old.company_id;new.agreement_id:=old.agreement_id;new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;new.activated_at:=old.activated_at;
 if old.status='terms_pending' then
  if new.status<>'details_pending' then raise exception 'Accept the partner agreement before completing onboarding details';end if;
  if not exists(select 1 from public.partner_agreements a where a.id=old.agreement_id and a.partner_id=old.partner_id and a.company_id=old.company_id and a.status='accepted' and a.accepted_at is not null and a.accepted_terms_hash is not null) then raise exception 'Accepted partner agreement required before completing partner details';end if;
 elsif old.status='details_pending' then
  if new.status not in ('details_pending','review_pending') then raise exception 'Partner details can only remain in progress or be submitted for review';end if;
 elsif old.status='review_pending' then
  if new.status<>'review_pending' then raise exception 'Submitted onboarding remains under review until Vorlen management acts';end if;
 elsif old.status='active' then
  if new.status<>'active' then raise exception 'Active partner lifecycle state is managed by Vorlen';end if;
 else raise exception 'This partner onboarding state is managed by Vorlen';end if;
 if new.status='review_pending' then
  if nullif(btrim(new.legal_name),'') is null or nullif(btrim(new.country),'') is null or nullif(btrim(new.address),'') is null or nullif(btrim(new.phone),'') is null or nullif(btrim(new.payment_method),'') is null then raise exception 'Complete the required partner details before submitting for review';end if;
  if not exists(select 1 from public.partner_agreements a where a.id=old.agreement_id and a.partner_id=old.partner_id and a.company_id=old.company_id and a.status='accepted' and a.accepted_at is not null and a.accepted_terms_hash is not null) then raise exception 'Accepted partner agreement required before review';end if;
 end if;
 return new;
end $$;
