insert into public.partner_profiles(user_id,company_id)
select p.id,p.company_id
from public.profiles p
join public.partner_onboarding o on o.partner_id=p.id and o.company_id=p.company_id and o.status='active'
left join public.partner_profiles pp on pp.user_id=p.id and pp.company_id=p.company_id
where p.role='partner' and pp.user_id is null;

create or replace function public.activate_partner(p_partner uuid)
returns void language plpgsql security invoker set search_path='public'
as $$
declare o public.partner_onboarding%rowtype; a public.partner_agreements%rowtype;
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  select * into o from public.partner_onboarding
  where partner_id=p_partner and company_id=public.current_company_id() for update;
  if o.status<>'review_pending'
     or nullif(trim(o.legal_name),'') is null
     or nullif(trim(o.country),'') is null
     or nullif(trim(o.address),'') is null
     or nullif(trim(o.phone),'') is null
     or nullif(trim(o.payment_method),'') is null
  then raise exception 'Partner onboarding is incomplete'; end if;
  select * into a from public.partner_agreements
  where id=o.agreement_id and partner_id=p_partner and company_id=o.company_id;
  if a.status<>'accepted' or a.accepted_at is null or a.accepted_terms_hash is null then raise exception 'Accepted partner agreement required'; end if;
  update public.partner_onboarding
  set status='active',reviewed_by=auth.uid(),reviewed_at=now(),activated_at=now(),updated_at=now()
  where partner_id=p_partner and company_id=o.company_id;
  insert into public.partner_profiles(user_id,company_id,active,updated_at)
  values(p_partner,o.company_id,true,now())
  on conflict (user_id) do update set active=true,updated_at=excluded.updated_at;
end $$;
