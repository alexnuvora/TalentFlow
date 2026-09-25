
create or replace function public.authorise_partner_terms_send(
  p_client uuid,
  p_authorised boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_hash text;
begin
  if not private.is_manager() then
    raise exception 'Manager access required';
  end if;

  if not exists(
    select 1 from public.clients c
    where c.id=p_client and c.company_id=v_company
  ) then
    raise exception 'Client not found';
  end if;

  if p_authorised then
    if exists(
      select 1 from public.clients c
      where c.id=p_client and c.terms_accepted_at is not null
    ) then
      raise exception 'Client has already accepted Terms of Business';
    end if;

    if private.client_is_suppressed(p_client) then
      raise exception 'This client is marked do not contact';
    end if;

    if exists(
      select 1
      from public.clients c
      where c.id=p_client
        and (
          nullif(btrim(coalesce(c.company_name,'')),'') is null
          or nullif(btrim(coalesce(c.contact_name,'')),'') is null
          or nullif(btrim(coalesce(c.email,'')),'') is null
          or nullif(btrim(coalesce(c.business_nature,'')),'') is null
          or c.recruitment_fee_percent is null
          or c.payment_terms_days is null
          or nullif(btrim(coalesce(c.rebate_terms,'')),'') is null
        )
    ) then
      raise exception 'Complete the client identity, recipient and commercial terms before authorising partner send';
    end if;

    v_hash:=private.client_commercial_hash(p_client);

    update public.clients
    set partner_terms_send_authorized_at=now(),
        partner_terms_send_authorized_by=auth.uid(),
        partner_terms_send_authorized_hash=v_hash
    where id=p_client and company_id=v_company;
  else
    update public.clients
    set partner_terms_send_authorized_at=null,
        partner_terms_send_authorized_by=null,
        partner_terms_send_authorized_hash=null
    where id=p_client and company_id=v_company;
  end if;

  return jsonb_build_object(
    'authorised',p_authorised,
    'hash',case when p_authorised then v_hash else null end
  );
end
$$;
