drop policy if exists "partner prospects insert" on public.partner_prospects;
create policy "partner prospects managers insert"
on public.partner_prospects for insert to authenticated
with check (company_id=private.current_company_id() and private.is_manager());

create or replace function public.enforce_partner_prospect_boundary()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
  v_manager boolean:=current_user in ('postgres','service_role') or private.is_manager();
  v_name text:=lower(btrim(new.company_name));
  v_email text:=nullif(lower(btrim(new.contact_email)),'');
begin
  new.updated_at:=now();

  if not v_manager then
    if not private.partner_is_active() then raise exception 'Active partner access required';end if;
    if tg_op='INSERT' then
      new.company_id:=private.current_company_id();new.partner_id:=auth.uid();
      new.promoted_client_id:=null;new.reviewed_by:=null;new.reviewed_at:=null;new.manager_notes:=null;
      if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact') then new.status:='prospect';end if;
    else
      if old.company_id<>private.current_company_id() or old.partner_id<>auth.uid() then raise exception 'You may only update your own prospects';end if;
      if old.status in ('under_review','promoted','declined') then raise exception 'This prospect is locked for Vorlen review';end if;
      new.company_id:=old.company_id;new.partner_id:=old.partner_id;new.promoted_client_id:=old.promoted_client_id;
      new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;new.manager_notes:=old.manager_notes;
      if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact','under_review') then raise exception 'Partners cannot approve or promote prospects';end if;
    end if;
  else
    if new.status in ('promoted','declined') and new.reviewed_at is null then new.reviewed_at:=now();new.reviewed_by:=coalesce(new.reviewed_by,auth.uid());end if;
    if new.status='promoted' and new.promoted_client_id is null then raise exception 'Promoted prospect must reference the authoritative client record';end if;
  end if;

  if nullif(v_name,'') is null then raise exception 'Company name is required';end if;
  if new.status not in ('promoted','declined','do_not_contact') and exists(
    select 1 from public.clients c where c.company_id=new.company_id
      and (lower(btrim(c.company_name))=v_name or (v_email is not null and lower(btrim(c.email))=v_email))
  ) then raise exception 'This company or contact already exists as a Vorlen client';end if;
  if new.status not in ('promoted','declined','do_not_contact') and exists(
    select 1 from public.partner_prospects p where p.company_id=new.company_id
      and p.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
      and p.status not in ('declined','do_not_contact')
      and (lower(btrim(p.company_name))=v_name or (v_email is not null and lower(btrim(coalesce(p.contact_email,'')))=v_email))
  ) then raise exception 'A matching prospect already exists in Vorlen';end if;

  return new;
end $$;

create or replace function private.promote_partner_prospect_impl(p_prospect uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_partner uuid;v_client uuid;v_prospect public.partner_prospects%rowtype;
begin
  if not private.is_manager() then raise exception 'Manager access required';end if;
  select * into v_prospect from public.partner_prospects p where p.id=p_prospect and p.company_id=v_company and p.status='under_review' for update;
  if v_prospect.id is null then raise exception 'Prospect must be in Vorlen review before promotion';end if;
  if nullif(btrim(v_prospect.contact_name),'') is null then raise exception 'A real contact name is required before promotion';end if;
  if nullif(btrim(v_prospect.contact_email),'') is null then raise exception 'A real contact email is required before promotion';end if;
  if exists(select 1 from public.clients c where c.company_id=v_company and (lower(btrim(c.company_name))=lower(btrim(v_prospect.company_name)) or lower(btrim(c.email))=lower(btrim(v_prospect.contact_email)))) then raise exception 'A matching client already exists. Assign the existing client rather than creating a duplicate.';end if;
  insert into public.clients(company_id,company_name,contact_name,email,phone,website,status,business_nature)
  values(v_company,v_prospect.company_name,btrim(v_prospect.contact_name),lower(btrim(v_prospect.contact_email)),v_prospect.contact_phone,v_prospect.website,'prospect',v_prospect.business_nature)
  returning id into v_client;
  update public.partner_prospects set status='promoted',promoted_client_id=v_client,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=v_prospect.id;
  v_partner:=v_prospect.partner_id;
  insert into public.partner_assignments(company_id,partner_id,client_id,priority,objective)
  values(v_company,v_partner,v_client,'high','Develop promoted prospect into an approved Vorlen client');
  update public.partner_commercial_handoffs
  set client_id=v_client,prospect_id=coalesce(prospect_id,v_prospect.id),updated_at=now()
  where company_id=v_company and partner_id=v_partner and client_id is null and status in ('draft','submitted','under_review')
    and (prospect_id=v_prospect.id or lower(btrim(coalesce(prospect_company,'')))=lower(btrim(v_prospect.company_name)));
  return v_client;
end $$;
