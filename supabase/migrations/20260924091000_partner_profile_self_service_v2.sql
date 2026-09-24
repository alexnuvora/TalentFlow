drop function if exists public.update_partner_self_profile(text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text);
drop function if exists private.update_partner_self_profile_impl(text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text);
drop function if exists public.update_partner_self_profile(text,text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text);
drop function if exists private.update_partner_self_profile_impl(text,text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text);

create or replace function private.update_partner_self_profile_impl(
  p_display_name text,p_linkedin_url text,p_timezone text,p_sectors text[],p_regions text[],p_role_types text[],
  p_availability_hours text,p_profile_photo_url text,p_legal_name text,p_trading_name text,p_country text,p_address text,
  p_phone text,p_business_type text,p_company_registration_number text,p_vat_number text,p_tax_reference text,
  p_payment_method text,p_payment_account_name text,p_payment_currency text,p_payment_details_reference text
) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_company uuid;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
  if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;

  if nullif(btrim(p_display_name),'') is null then raise exception 'Display name is required';end if;
  if nullif(btrim(p_legal_name),'') is null then raise exception 'Full legal name is required';end if;
  if nullif(btrim(p_phone),'') is null then raise exception 'Phone is required';end if;
  if nullif(btrim(p_country),'') is null then raise exception 'Country is required';end if;
  if nullif(btrim(p_address),'') is null then raise exception 'Address is required';end if;
  if nullif(btrim(p_timezone),'') is null then raise exception 'Timezone is required';end if;
  if nullif(btrim(p_linkedin_url),'') is not null and lower(btrim(p_linkedin_url)) !~ '^https://([a-z0-9-]+\.)?linkedin\.com/' then raise exception 'LinkedIn URL must use https://linkedin.com';end if;
  if nullif(btrim(p_profile_photo_url),'') is not null and lower(btrim(p_profile_photo_url)) !~ '^https://' then raise exception 'Profile photo URL must use HTTPS';end if;
  if char_length(upper(coalesce(nullif(btrim(p_payment_currency),''),'GBP')))<>3 then raise exception 'Payment currency must be a three-letter code';end if;

  update public.profiles set full_name=btrim(p_display_name) where id=v_user and company_id=v_company;

  update public.partner_profiles
  set display_name=btrim(p_display_name),linkedin_url=nullif(btrim(p_linkedin_url),''),timezone=btrim(p_timezone),
      sectors=coalesce(p_sectors,'{}'::text[]),regions=coalesce(p_regions,'{}'::text[]),role_types=coalesce(p_role_types,'{}'::text[]),
      availability_hours=nullif(btrim(p_availability_hours),''),profile_photo_url=nullif(btrim(p_profile_photo_url),''),updated_at=now()
  where user_id=v_user and company_id=v_company;
  if not found then raise exception 'Partner profile is not configured';end if;

  update public.partner_onboarding
  set legal_name=btrim(p_legal_name),trading_name=nullif(btrim(p_trading_name),''),country=btrim(p_country),
      address=btrim(p_address),phone=btrim(p_phone),business_type=nullif(btrim(p_business_type),''),
      company_registration_number=nullif(btrim(p_company_registration_number),''),vat_number=nullif(btrim(p_vat_number),''),
      tax_reference=nullif(btrim(p_tax_reference),''),payment_method=nullif(btrim(p_payment_method),''),
      payment_account_name=nullif(btrim(p_payment_account_name),''),
      payment_currency=upper(coalesce(nullif(btrim(p_payment_currency),''),'GBP'))::char(3),
      payment_details_reference=nullif(btrim(p_payment_details_reference),''),updated_at=now()
  where partner_id=v_user and company_id=v_company and status='active';
  if not found then raise exception 'Active partner onboarding record not found';end if;
end $$;

revoke all on function private.update_partner_self_profile_impl(text,text,text,text[],text[],text[],text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function private.update_partner_self_profile_impl(text,text,text,text[],text[],text[],text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated,service_role;

create or replace function public.update_partner_self_profile(
  p_display_name text,p_linkedin_url text,p_timezone text,p_sectors text[],p_regions text[],p_role_types text[],
  p_availability_hours text,p_profile_photo_url text,p_legal_name text,p_trading_name text,p_country text,p_address text,
  p_phone text,p_business_type text,p_company_registration_number text,p_vat_number text,p_tax_reference text,
  p_payment_method text,p_payment_account_name text,p_payment_currency text,p_payment_details_reference text
) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform private.update_partner_self_profile_impl(
    p_display_name,p_linkedin_url,p_timezone,p_sectors,p_regions,p_role_types,p_availability_hours,p_profile_photo_url,
    p_legal_name,p_trading_name,p_country,p_address,p_phone,p_business_type,p_company_registration_number,p_vat_number,
    p_tax_reference,p_payment_method,p_payment_account_name,p_payment_currency,p_payment_details_reference
  );
end $$;

revoke all on function public.update_partner_self_profile(text,text,text,text[],text[],text[],text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.update_partner_self_profile(text,text,text,text[],text[],text[],text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated,service_role;
