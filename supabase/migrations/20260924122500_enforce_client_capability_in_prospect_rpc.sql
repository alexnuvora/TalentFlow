create or replace function private.create_partner_prospect_impl(
  p_company_name text,p_website text default null,p_contact_name text default null,p_contact_email text default null,
  p_contact_phone text default null,p_business_nature text default null,p_hiring_need text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_company uuid;v_id uuid;v_name text:=btrim(p_company_name);v_email text:=nullif(lower(btrim(p_contact_email)),'');v_website text:=nullif(lower(regexp_replace(btrim(p_website),'/+$','')),'');
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
 if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
 if not private.partner_can_develop_clients(v_user) then raise exception 'Client development is not enabled for this partner profile';end if;
 if nullif(v_name,'') is null then raise exception 'Company name is required';end if;
 if exists(select 1 from public.clients c where c.company_id=v_company and (lower(btrim(c.company_name))=lower(v_name) or (v_email is not null and lower(btrim(c.email))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(c.website),'/+$','')),'')=v_website))) then raise exception 'This company or contact already exists as a Vorlen client. Ask a manager to assign the existing record.';end if;
 if exists(select 1 from public.partner_prospects p where p.company_id=v_company and p.status<>'declined' and (lower(btrim(p.company_name))=lower(v_name) or (v_email is not null and lower(btrim(coalesce(p.contact_email,'')))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(p.website),'/+$','')),'')=v_website))) then
  if exists(select 1 from public.partner_prospects p where p.company_id=v_company and p.status='do_not_contact' and (lower(btrim(p.company_name))=lower(v_name) or (v_email is not null and lower(btrim(coalesce(p.contact_email,'')))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(p.website),'/+$','')),'')=v_website))) then raise exception 'This prospect is marked do not contact in Vorlen';end if;
  raise exception 'A matching prospect already exists in Vorlen. Ask a manager to review ownership rather than creating a duplicate.';
 end if;
 insert into public.partner_prospects(company_id,partner_id,company_name,website,contact_name,contact_email,contact_phone,business_nature,hiring_need,notes)
 values(v_company,v_user,v_name,nullif(btrim(p_website),''),nullif(btrim(p_contact_name),''),v_email,nullif(btrim(p_contact_phone),''),nullif(btrim(p_business_nature),''),nullif(btrim(p_hiring_need),''),nullif(btrim(p_notes),'')) returning id into v_id;
 return v_id;
end $$;
