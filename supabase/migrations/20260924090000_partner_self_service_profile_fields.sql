create or replace function private.update_partner_self_profile_impl(
  p_display_name text,p_phone text,p_country text,p_address text,p_linkedin_url text,p_timezone text,
  p_sectors text[],p_regions text[],p_role_types text[],p_availability_hours text,p_profile_photo_url text,
  p_payment_method text,p_payment_account_name text,p_payment_currency text,p_payment_details_reference text
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_company uuid;
  v_timezone text:=coalesce(nullif(btrim(p_timezone),''),'UTC');
  v_currency text:=upper(coalesce(nullif(btrim(p_payment_currency),''),'GBP'));
  v_linkedin text:=nullif(btrim(p_linkedin_url),'');
  v_photo text:=nullif(btrim(p_profile_photo_url),'');
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
  if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then raise exception 'Invalid timezone';end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Payment currency must be a three-letter currency code';end if;
  if v_linkedin is not null and v_linkedin !~* '^https://([a-z0-9-]+\.)?linkedin\.com/' then raise exception 'LinkedIn URL must use https://linkedin.com';end if;
  if v_photo is not null and v_photo !~* '^https://' then raise exception 'Profile photo URL must use HTTPS';end if;
  if coalesce(array_length(p_sectors,1),0)>20 or coalesce(array_length(p_regions,1),0)>20 or coalesce(array_length(p_role_types,1),0)>20 then raise exception 'Preference lists may contain at most 20 items each';end if;

  update public.partner_profiles
  set display_name=nullif(btrim(p_display_name),''),
      linkedin_url=v_linkedin,
      timezone=v_timezone,
      sectors=coalesce((select array_agg(distinct btrim(x)) filter (where nullif(btrim(x),'') is not null) from unnest(coalesce(p_sectors,'{}'::text[])) x),'{}'::text[]),
      regions=coalesce((select array_agg(distinct btrim(x)) filter (where nullif(btrim(x),'') is not null) from unnest(coalesce(p_regions,'{}'::text[])) x),'{}'::text[]),
      role_types=coalesce((select array_agg(distinct btrim(x)) filter (where nullif(btrim(x),'') is not null) from unnest(coalesce(p_role_types,'{}'::text[])) x),'{}'::text[]),
      availability_hours=nullif(btrim(p_availability_hours),''),
      profile_photo_url=v_photo,
      updated_at=now()
  where user_id=v_user and company_id=v_company;
  if not found then raise exception 'Partner profile is not configured';end if;

  update public.partner_onboarding
  set phone=nullif(btrim(p_phone),''),
      country=nullif(btrim(p_country),''),
      address=nullif(btrim(p_address),''),
      payment_method=nullif(btrim(p_payment_method),''),
      payment_account_name=nullif(btrim(p_payment_account_name),''),
      payment_currency=v_currency,
      payment_details_reference=nullif(btrim(p_payment_details_reference),''),
      updated_at=now()
  where partner_id=v_user and company_id=v_company;
  if not found then raise exception 'Partner onboarding record is not configured';end if;
end $$;

revoke all on function private.update_partner_self_profile_impl(text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text) from public,anon;
grant execute on function private.update_partner_self_profile_impl(text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text) to authenticated,service_role;

create or replace function public.update_partner_self_profile(
  p_display_name text,p_phone text,p_country text,p_address text,p_linkedin_url text,p_timezone text,
  p_sectors text[],p_regions text[],p_role_types text[],p_availability_hours text,p_profile_photo_url text,
  p_payment_method text,p_payment_account_name text,p_payment_currency text,p_payment_details_reference text
) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform private.update_partner_self_profile_impl(
    p_display_name,p_phone,p_country,p_address,p_linkedin_url,p_timezone,
    p_sectors,p_regions,p_role_types,p_availability_hours,p_profile_photo_url,
    p_payment_method,p_payment_account_name,p_payment_currency,p_payment_details_reference
  );
end $$;

revoke all on function public.update_partner_self_profile(text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text) from public,anon;
grant execute on function public.update_partner_self_profile(text,text,text,text,text,text,text[],text[],text[],text,text,text,text,text,text) to authenticated,service_role;
