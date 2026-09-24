create or replace function public.attach_partner_handoff_client(p_handoff uuid,p_client uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_company uuid := private.current_company_id();
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if not exists(select 1 from public.clients c where c.id=p_client and c.company_id=v_company) then raise exception 'Client not found in this workspace'; end if;
  update public.partner_commercial_handoffs h set client_id=p_client,updated_at=now()
  where h.id=p_handoff and h.company_id=v_company and h.status in ('submitted','under_review','terms_approved');
  if not found then raise exception 'Handoff is not available for client attachment'; end if;
end $$;
revoke all on function public.attach_partner_handoff_client(uuid,uuid) from public,anon;
grant execute on function public.attach_partner_handoff_client(uuid,uuid) to authenticated,service_role;

create or replace function public.link_partner_handoff_job(p_handoff uuid,p_job uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_company uuid := private.current_company_id(); v_partner uuid; v_client uuid; v_job_client uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  select h.partner_id,h.client_id into v_partner,v_client from public.partner_commercial_handoffs h
  where h.id=p_handoff and h.company_id=v_company and h.status='terms_approved' for update;
  if v_partner is null then raise exception 'Approved handoff not found'; end if;
  if v_client is null then raise exception 'Attach the approved client before linking a vacancy'; end if;
  select j.client_id into v_job_client from public.jobs j where j.id=p_job and j.company_id=v_company;
  if v_job_client is null then raise exception 'Vacancy not found in this workspace'; end if;
  if v_job_client <> v_client then raise exception 'The selected vacancy belongs to a different client'; end if;
  update public.partner_commercial_handoffs
  set status='converted',approved_job_id=p_job,approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now()
  where id=p_handoff;
  if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=v_partner and a.job_id=p_job and a.completed_at is null) then
    insert into public.partner_assignments(company_id,partner_id,job_id,priority,objective)
    values(v_company,v_partner,p_job,'high','Deliver approved Vorlen vacancy');
  end if;
end $$;
revoke all on function public.link_partner_handoff_job(uuid,uuid) from public,anon;
grant execute on function public.link_partner_handoff_job(uuid,uuid) to authenticated,service_role;
