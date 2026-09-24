create or replace function private.record_partner_candidate_terms_impl(
  p_candidate uuid,p_terms_version text,p_evidence text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();v_company uuid;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
  if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active';end if;
  if nullif(btrim(p_terms_version),'') is null or nullif(btrim(p_evidence),'') is null then raise exception 'Terms version and evidence are required';end if;
  if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=v_user and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Candidate is not assigned to your partner portfolio';end if;
  update public.candidates set work_seeker_terms_version=btrim(p_terms_version),work_seeker_terms_agreed_at=now(),work_seeker_terms_evidence=btrim(p_evidence)
  where id=p_candidate and company_id=v_company and work_seeker_terms_agreed_at is null;
  if not found then
    if exists(select 1 from public.candidates c where c.id=p_candidate and c.company_id=v_company and c.work_seeker_terms_agreed_at is not null) then raise exception 'Work-seeker terms evidence is already recorded and cannot be overwritten by a partner';end if;
    raise exception 'Candidate not found';
  end if;
end $$;

create or replace function private.create_partner_prospect_impl(
  p_company_name text,p_website text default null,p_contact_name text default null,
  p_contact_email text default null,p_contact_phone text default null,p_business_nature text default null,
  p_hiring_need text default null,p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();v_company uuid;v_id uuid;v_name text:=btrim(p_company_name);v_email text:=nullif(lower(btrim(p_contact_email)),'');v_website text:=nullif(lower(regexp_replace(btrim(p_website),'/+$','')),'');
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
  if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
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

create or replace function public.enforce_partner_prospect_boundary()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_manager boolean:=current_user in ('postgres','service_role') or private.is_manager();v_name text:=lower(btrim(new.company_name));v_email text:=nullif(lower(btrim(new.contact_email)),'');v_website text:=nullif(lower(regexp_replace(btrim(new.website),'/+$','')),'');
begin
  new.updated_at:=now();
  if not v_manager then
    if not private.partner_is_active() then raise exception 'Active partner access required';end if;
    if tg_op='INSERT' then
      new.company_id:=private.current_company_id();new.partner_id:=auth.uid();new.promoted_client_id:=null;new.reviewed_by:=null;new.reviewed_at:=null;new.manager_notes:=null;
      if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact') then new.status:='prospect';end if;
    else
      if old.company_id<>private.current_company_id() or old.partner_id<>auth.uid() then raise exception 'You may only update your own prospects';end if;
      if old.status in ('under_review','promoted','declined','do_not_contact') then raise exception 'This prospect is locked for Vorlen review or suppression';end if;
      new.company_id:=old.company_id;new.partner_id:=old.partner_id;new.promoted_client_id:=old.promoted_client_id;new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;new.manager_notes:=old.manager_notes;
      if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact','under_review') then raise exception 'Partners cannot approve or promote prospects';end if;
    end if;
  else
    if new.status in ('promoted','declined') and new.reviewed_at is null then new.reviewed_at:=now();new.reviewed_by:=coalesce(new.reviewed_by,auth.uid());end if;
    if new.status='promoted' and new.promoted_client_id is null then raise exception 'Promoted prospect must reference the authoritative client record';end if;
  end if;
  if nullif(v_name,'') is null then raise exception 'Company name is required';end if;
  if new.status not in ('promoted','declined') and exists(select 1 from public.clients c where c.company_id=new.company_id and (lower(btrim(c.company_name))=v_name or (v_email is not null and lower(btrim(c.email))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(c.website),'/+$','')),'')=v_website))) then raise exception 'This company or contact already exists as a Vorlen client';end if;
  if new.status not in ('promoted','declined') and exists(select 1 from public.partner_prospects p where p.company_id=new.company_id and p.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid) and p.status<>'declined' and (lower(btrim(p.company_name))=v_name or (v_email is not null and lower(btrim(coalesce(p.contact_email,'')))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(p.website),'/+$','')),'')=v_website))) then raise exception 'A matching or suppressed prospect already exists in Vorlen';end if;
  return new;
end $$;
