alter table public.partner_onboarding add column if not exists business_type text, add column if not exists company_registration_number text, add column if not exists vat_number text, add column if not exists payment_account_name text, add column if not exists payment_currency char(3) not null default 'GBP';
create unique index if not exists uq_partner_active_client_origin on public.partner_attributions(company_id,client_id) where status='active' and attribution_type='client_originator' and client_id is not null;
create unique index if not exists uq_partner_active_vacancy_origin on public.partner_attributions(company_id,job_id) where status='active' and attribution_type='vacancy_originator' and job_id is not null;
create unique index if not exists uq_partner_active_candidate_origin on public.partner_attributions(company_id,candidate_id) where status='active' and attribution_type='candidate_originator' and candidate_id is not null;
create unique index if not exists uq_partner_active_placement_owner on public.partner_attributions(company_id,placement_id) where status='active' and attribution_type='placement_owner' and placement_id is not null;
create or replace function public.set_partner_status(p_partner uuid,p_status text) returns void language plpgsql security invoker set search_path=public as $$begin
 if not public.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('suspended','terminated') then raise exception 'Invalid partner status'; end if;
 update public.partner_onboarding set status=p_status,updated_at=now() where partner_id=p_partner and company_id=public.current_company_id() and status in ('active','suspended');
 if not found then raise exception 'Partner is not in a state that can be changed'; end if;
 if p_status='terminated' then update public.partner_agreements set status='terminated' where partner_id=p_partner and company_id=public.current_company_id() and status='accepted'; end if;
end$$;
revoke all on function public.set_partner_status(uuid,text) from public,anon; grant execute on function public.set_partner_status(uuid,text) to authenticated;
create or replace function public.attribute_partner_entity(p_partner uuid,p_type text,p_entity uuid,p_evidence text) returns uuid language plpgsql security invoker set search_path=public as $$declare v_id uuid;begin
 if not public.is_manager() then raise exception 'Manager access required';end if;
 if not exists(select 1 from public.partner_onboarding where partner_id=p_partner and company_id=public.current_company_id() and status='active') then raise exception 'Partner must be active';end if;
 if p_type not in ('client_originator','vacancy_originator','candidate_originator','placement_owner') then raise exception 'Invalid attribution type';end if;
 if nullif(trim(p_evidence),'') is null then raise exception 'Attribution evidence is required';end if;
 insert into public.partner_attributions(company_id,partner_id,client_id,job_id,candidate_id,placement_id,attribution_type,evidence,attributed_by)
 values(public.current_company_id(),p_partner,case when p_type='client_originator' then p_entity end,case when p_type='vacancy_originator' then p_entity end,case when p_type='candidate_originator' then p_entity end,case when p_type='placement_owner' then p_entity end,p_type,trim(p_evidence),auth.uid()) returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'This record already has an active owner; resolve the existing attribution instead of creating a duplicate';end$$;
revoke all on function public.attribute_partner_entity(uuid,text,uuid,text) from public,anon;grant execute on function public.attribute_partner_entity(uuid,text,uuid,text) to authenticated;
drop policy if exists "placements tenant" on public.placements;
drop policy if exists "partner attributed placements read" on public.placements;
create policy "partner attributed placements read" on public.placements for select to authenticated using(company_id=public.current_company_id() and public.partner_is_active() and exists(select 1 from public.partner_attributions a where a.company_id=placements.company_id and a.partner_id=(select auth.uid()) and a.placement_id=placements.id and a.attribution_type='placement_owner' and a.status='active'));
