create or replace function public.set_partner_specialism(p_partner uuid,p_specialism text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_status text;
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 if p_specialism not in ('b2b_advisor','lead_closer','candidate_sourcer','hybrid') then raise exception 'Invalid partner specialism';end if;
 select o.status into v_status from public.partner_onboarding o join public.profiles p on p.id=o.partner_id and p.company_id=o.company_id and p.role='partner'
 where o.partner_id=p_partner and o.company_id=v_company;
 if v_status is null then raise exception 'Partner onboarding record not found';end if;
 if v_status='terminated' then raise exception 'Terminated partners cannot be reconfigured';end if;
 if p_specialism not in ('b2b_advisor','lead_closer','hybrid') and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_partner and a.client_id is not null and a.completed_at is null) then raise exception 'Complete or reassign active client assignments before removing client-development permission';end if;
 if p_specialism not in ('candidate_sourcer','hybrid') and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_partner and a.candidate_id is not null and a.completed_at is null) then raise exception 'Complete or reassign active candidate assignments before removing candidate-sourcing permission';end if;
 insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
 values(p_partner,v_company,p_specialism,v_status='active',now())
 on conflict(user_id) do update set specialism=excluded.specialism,active=excluded.active,updated_at=excluded.updated_at;
end $$;
revoke all on function public.set_partner_specialism(uuid,text) from public,anon;
grant execute on function public.set_partner_specialism(uuid,text) to authenticated,service_role;
