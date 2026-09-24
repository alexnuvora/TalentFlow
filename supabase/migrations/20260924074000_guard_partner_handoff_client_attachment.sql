create or replace function public.attach_partner_handoff_client(p_handoff uuid,p_client uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_prospect uuid;v_promoted_client uuid;
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 if not exists(select 1 from public.clients c where c.id=p_client and c.company_id=v_company) then raise exception 'Client not found in this workspace';end if;
 select h.prospect_id into v_prospect from public.partner_commercial_handoffs h where h.id=p_handoff and h.company_id=v_company and h.status in ('submitted','under_review','terms_approved') for update;
 if not found then raise exception 'Handoff is not available for client attachment';end if;
 if v_prospect is not null then
  select p.promoted_client_id into v_promoted_client from public.partner_prospects p where p.id=v_prospect and p.company_id=v_company;
  if v_promoted_client is null then raise exception 'Resolve or promote the linked prospect before attaching a client to this handoff';end if;
  if v_promoted_client<>p_client then raise exception 'The handoff prospect is linked to a different Vorlen client';end if;
 end if;
 update public.partner_commercial_handoffs set client_id=p_client,updated_at=now() where id=p_handoff and company_id=v_company;
end $$;