create or replace function private.initialise_partner_onboarding_impl(
  p_company uuid,
  p_partner uuid,
  p_specialism text default 'b2b_advisor'::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_agreement uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and current_user <> 'service_role' then
    if not private.is_manager() then raise exception 'Manager access required'; end if;
    if p_company<>private.current_company_id() then raise exception 'Workspace mismatch'; end if;
  end if;

  if p_specialism not in ('b2b_advisor','lead_closer','candidate_sourcer','hybrid') then
    raise exception 'Invalid partner specialism';
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_partner and p.company_id=p_company and p.role='partner'
  ) then
    raise exception 'Partner profile is not present in this workspace';
  end if;

  select o.agreement_id into v_agreement
  from public.partner_onboarding o
  where o.partner_id=p_partner and o.company_id=p_company;

  if v_agreement is not null then
    insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
    values(
      p_partner,p_company,p_specialism,
      exists(select 1 from public.partner_onboarding o where o.partner_id=p_partner and o.company_id=p_company and o.status='active'),
      now()
    )
    on conflict(user_id) do update
      set specialism=excluded.specialism,
          active=excluded.active,
          updated_at=excluded.updated_at;
    return v_agreement;
  end if;

  insert into public.partner_agreements(company_id,partner_id,version,commission_percent,terms_text,terms_hash)
  values(
    p_company,p_partner,'partner-2026-09-24',30,private.partner_agreement_terms(),
    encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
  )
  returning id into v_agreement;

  insert into public.partner_onboarding(partner_id,company_id,status,agreement_id)
  values(p_partner,p_company,'terms_pending',v_agreement);

  insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
  values(p_partner,p_company,p_specialism,false,now())
  on conflict(user_id) do update
    set company_id=excluded.company_id,
        specialism=excluded.specialism,
        active=false,
        updated_at=excluded.updated_at;

  return v_agreement;
end
$function$;
