create or replace function private.attribute_partner_entity_impl(
  p_partner uuid,p_type text,p_entity uuid,p_evidence text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;v_company uuid:=private.current_company_id();v_component text;v_specialism text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  select pp.specialism into v_specialism
  from public.partner_onboarding o
  join public.partner_profiles pp on pp.user_id=o.partner_id and pp.company_id=o.company_id
  where o.partner_id=p_partner and o.company_id=v_company
    and o.status='active' and pp.active=true;

  if v_specialism is null then raise exception 'Partner must be active'; end if;

  if p_type not in (
    'client_originator','vacancy_originator','candidate_originator','placement_owner',
    'client_commission_owner','candidate_commission_owner'
  ) then raise exception 'Invalid attribution type'; end if;

  if nullif(btrim(p_evidence),'') is null then raise exception 'Attribution evidence is required'; end if;

  if p_type in ('client_commission_owner','candidate_commission_owner')
     and not exists(
       select 1 from public.partner_agreements a
       where a.company_id=v_company and a.partner_id=p_partner
         and a.version='partner-2026-09-26-split-v2'
         and a.commission_model='split_15_15'
         and a.status='accepted'
         and a.accepted_at is not null
         and a.accepted_terms_hash=a.terms_hash
     )
  then
    raise exception 'Partner must accept the latest split-commission terms before commission ownership can be assigned';
  end if;

  if p_type='client_commission_owner'
     and v_specialism not in ('b2b_advisor','lead_closer','hybrid') then
    raise exception 'Client Development commission requires a client-capable partner specialism';
  end if;

  if p_type='candidate_commission_owner'
     and v_specialism not in ('candidate_sourcer','hybrid') then
    raise exception 'Candidate Delivery commission requires a candidate-sourcing partner specialism';
  end if;

  if p_type='client_originator'
    and not exists(select 1 from public.clients c where c.id=p_entity and c.company_id=v_company)
  then raise exception 'Client not found in this workspace';
  elsif p_type='vacancy_originator'
    and not exists(select 1 from public.jobs j where j.id=p_entity and j.company_id=v_company)
  then raise exception 'Vacancy not found in this workspace';
  elsif p_type='candidate_originator'
    and not exists(select 1 from public.candidates c where c.id=p_entity and c.company_id=v_company)
  then raise exception 'Candidate not found in this workspace';
  elsif p_type in ('placement_owner','client_commission_owner','candidate_commission_owner')
    and not exists(select 1 from public.placements p where p.id=p_entity and p.company_id=v_company)
  then raise exception 'Placement not found in this workspace';
  end if;

  if p_type in ('client_commission_owner','candidate_commission_owner') then
    v_component:=case when p_type='client_commission_owner' then 'client' else 'candidate' end;

    if exists(
      select 1 from public.partner_commissions pc
      where pc.company_id=v_company and pc.placement_id=p_entity
        and pc.commission_component=v_component
        and pc.status in ('approved','paid')
        and pc.partner_user_id is distinct from p_partner
    ) then
      raise exception 'This commission side is financially locked because commission has already been approved or paid';
    end if;

    update public.partner_attributions
    set status='superseded'
    where company_id=v_company and placement_id=p_entity
      and attribution_type=p_type and status='active' and partner_id<>p_partner;

    select pa.id into v_id
    from public.partner_attributions pa
    where pa.company_id=v_company and pa.placement_id=p_entity
      and pa.attribution_type=p_type and pa.status='active' and pa.partner_id=p_partner
    limit 1;

    if v_id is not null then
      update public.partner_attributions
      set evidence=btrim(p_evidence),attributed_by=auth.uid(),attributed_at=now()
      where id=v_id;
    else
      insert into public.partner_attributions(
        company_id,partner_id,placement_id,attribution_type,evidence,attributed_by
      ) values(
        v_company,p_partner,p_entity,p_type,btrim(p_evidence),auth.uid()
      )
      returning id into v_id;
    end if;

    perform private.reconcile_partner_commission_component(
      v_company,p_entity,v_component,null
    );
    return v_id;
  end if;

  insert into public.partner_attributions(
    company_id,partner_id,client_id,job_id,candidate_id,placement_id,
    attribution_type,evidence,attributed_by
  ) values(
    v_company,p_partner,
    case when p_type='client_originator' then p_entity end,
    case when p_type='vacancy_originator' then p_entity end,
    case when p_type='candidate_originator' then p_entity end,
    case when p_type='placement_owner' then p_entity end,
    p_type,btrim(p_evidence),auth.uid()
  )
  returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception 'This record already has an active owner; resolve the existing attribution instead of creating a duplicate';
end
$$;

revoke all on function private.attribute_partner_entity_impl(uuid,text,uuid,text) from public,anon;
grant execute on function private.attribute_partner_entity_impl(uuid,text,uuid,text) to authenticated,service_role;
