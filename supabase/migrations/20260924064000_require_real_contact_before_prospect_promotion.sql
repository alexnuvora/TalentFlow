create or replace function private.promote_partner_prospect_impl(p_prospect uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_partner uuid;v_client uuid;v_prospect public.partner_prospects%rowtype;
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 select * into v_prospect from public.partner_prospects p where p.id=p_prospect and p.company_id=v_company and p.status in ('under_review','handoff_ready','interested','contacted','prospect') for update;
 if v_prospect.id is null then raise exception 'Prospect not found or already resolved';end if;
 if nullif(btrim(v_prospect.contact_name),'') is null then raise exception 'A real contact name is required before promotion';end if;
 if nullif(btrim(v_prospect.contact_email),'') is null then raise exception 'A real contact email is required before promotion';end if;
 if exists(select 1 from public.clients c where c.company_id=v_company and (lower(btrim(c.company_name))=lower(btrim(v_prospect.company_name)) or lower(btrim(c.email))=lower(btrim(v_prospect.contact_email)))) then raise exception 'A matching client already exists. Assign the existing client rather than creating a duplicate.';end if;
 insert into public.clients(company_id,company_name,contact_name,email,phone,website,status,business_nature)
 values(v_company,v_prospect.company_name,btrim(v_prospect.contact_name),lower(btrim(v_prospect.contact_email)),v_prospect.contact_phone,v_prospect.website,'prospect',v_prospect.business_nature)
 returning id into v_client;
 update public.partner_prospects set status='promoted',promoted_client_id=v_client,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=v_prospect.id;
 v_partner:=v_prospect.partner_id;
 insert into public.partner_assignments(company_id,partner_id,client_id,priority,objective) values(v_company,v_partner,v_client,'high','Develop promoted prospect into an approved Vorlen client');
 update public.partner_commercial_handoffs set client_id=v_client,prospect_id=coalesce(prospect_id,v_prospect.id),updated_at=now()
 where company_id=v_company and partner_id=v_partner and client_id is null and status in ('draft','submitted','under_review') and (prospect_id=v_prospect.id or lower(btrim(coalesce(prospect_company,'')))=lower(btrim(v_prospect.company_name)));
 return v_client;
end $$;
revoke all on function private.promote_partner_prospect_impl(uuid) from public,anon;
grant execute on function private.promote_partner_prospect_impl(uuid) to authenticated,service_role;
create or replace function public.promote_partner_prospect(p_prospect uuid) returns uuid language plpgsql security invoker set search_path='' as $$begin return private.promote_partner_prospect_impl(p_prospect);end$$;
revoke all on function public.promote_partner_prospect(uuid) from public,anon;
grant execute on function public.promote_partner_prospect(uuid) to authenticated,service_role;
