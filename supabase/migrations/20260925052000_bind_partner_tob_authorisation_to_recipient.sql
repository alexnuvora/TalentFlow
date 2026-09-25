
create or replace function private.client_commercial_hash(p_client uuid)
returns text
language sql
stable
security definer
set search_path=''
as $$
 select encode(
   extensions.digest(
     concat_ws('|',
       lower(btrim(coalesce(c.company_name,''))),
       lower(btrim(coalesce(c.contact_name,''))),
       lower(btrim(coalesce(c.email,''))),
       coalesce(c.business_nature,''),
       coalesce(c.recruitment_fee_percent::text,''),
       coalesce(c.payment_terms_days::text,''),
       coalesce(c.rebate_terms,'')
     ),
     'sha256'
   ),
   'hex'
 )
 from public.clients c
 where c.id=p_client
$$;

create or replace function public.clear_partner_terms_authorisation_on_change()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.company_name is distinct from old.company_name
     or new.contact_name is distinct from old.contact_name
     or lower(btrim(coalesce(new.email,''))) is distinct from lower(btrim(coalesce(old.email,'')))
     or new.business_nature is distinct from old.business_nature
     or new.recruitment_fee_percent is distinct from old.recruitment_fee_percent
     or new.payment_terms_days is distinct from old.payment_terms_days
     or new.rebate_terms is distinct from old.rebate_terms then
    new.partner_terms_send_authorized_at:=null;
    new.partner_terms_send_authorized_by:=null;
    new.partner_terms_send_authorized_hash:=null;
  end if;
  return new;
end
$$;
