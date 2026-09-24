create or replace function private.enforce_partner_assignment_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_partner_company uuid;
begin
  select p.company_id into v_partner_company from public.profiles p where p.id=new.partner_id and p.role='partner';
  if v_partner_company is null or v_partner_company<>new.company_id then raise exception 'Partner assignment must belong to the same workspace as the partner';end if;
  if new.client_id is not null and not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Assigned client must belong to the same workspace';end if;
  if new.candidate_id is not null and not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then raise exception 'Assigned candidate must belong to the same workspace';end if;
  if new.job_id is not null and not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id) then raise exception 'Assigned vacancy must belong to the same workspace';end if;
  if new.completed_at is null and not exists(select 1 from public.partner_onboarding o where o.partner_id=new.partner_id and o.company_id=new.company_id and o.status='active') then raise exception 'Only active partners can receive active assignments';end if;
  return new;
end $$;
drop trigger if exists trg_partner_assignment_scope on public.partner_assignments;
create trigger trg_partner_assignment_scope before insert or update on public.partner_assignments for each row execute function private.enforce_partner_assignment_scope();
revoke all on function private.enforce_partner_assignment_scope() from public,anon,authenticated;
grant execute on function private.enforce_partner_assignment_scope() to service_role;

create or replace function private.enforce_partner_attribution_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_partner_company uuid;v_nonnull integer;
begin
  select p.company_id into v_partner_company from public.profiles p where p.id=new.partner_id and p.role='partner';
  if v_partner_company is null or v_partner_company<>new.company_id then raise exception 'Partner attribution must belong to the same workspace as the partner';end if;
  v_nonnull:=num_nonnulls(new.client_id,new.job_id,new.candidate_id,new.placement_id);
  if v_nonnull<>1 then raise exception 'Partner attribution must reference exactly one entity';end if;
  if new.attribution_type='client_originator' then
    if new.client_id is null or not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Client attribution must reference a client in the same workspace';end if;
  elsif new.attribution_type='vacancy_originator' then
    if new.job_id is null or not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id) then raise exception 'Vacancy attribution must reference a vacancy in the same workspace';end if;
  elsif new.attribution_type='candidate_originator' then
    if new.candidate_id is null or not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then raise exception 'Candidate attribution must reference a candidate in the same workspace';end if;
  elsif new.attribution_type='placement_owner' then
    if new.placement_id is null or not exists(select 1 from public.placements p where p.id=new.placement_id and p.company_id=new.company_id) then raise exception 'Placement attribution must reference a placement in the same workspace';end if;
  else raise exception 'Invalid attribution type';
  end if;
  return new;
end $$;
drop trigger if exists trg_partner_attribution_scope on public.partner_attributions;
create trigger trg_partner_attribution_scope before insert or update on public.partner_attributions for each row execute function private.enforce_partner_attribution_scope();
revoke all on function private.enforce_partner_attribution_scope() from public,anon,authenticated;
grant execute on function private.enforce_partner_attribution_scope() to service_role;

create or replace function public.attribute_partner_entity(p_partner uuid,p_type text,p_entity uuid,p_evidence text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_company uuid:=private.current_company_id();
begin
  if not private.is_manager() then raise exception 'Manager access required';end if;
  if not exists(select 1 from public.partner_onboarding where partner_id=p_partner and company_id=v_company and status='active') then raise exception 'Partner must be active';end if;
  if p_type not in ('client_originator','vacancy_originator','candidate_originator','placement_owner') then raise exception 'Invalid attribution type';end if;
  if nullif(btrim(p_evidence),'') is null then raise exception 'Attribution evidence is required';end if;
  if p_type='client_originator' and not exists(select 1 from public.clients c where c.id=p_entity and c.company_id=v_company) then raise exception 'Client not found in this workspace';
  elsif p_type='vacancy_originator' and not exists(select 1 from public.jobs j where j.id=p_entity and j.company_id=v_company) then raise exception 'Vacancy not found in this workspace';
  elsif p_type='candidate_originator' and not exists(select 1 from public.candidates c where c.id=p_entity and c.company_id=v_company) then raise exception 'Candidate not found in this workspace';
  elsif p_type='placement_owner' and not exists(select 1 from public.placements p where p.id=p_entity and p.company_id=v_company) then raise exception 'Placement not found in this workspace';
  end if;
  insert into public.partner_attributions(company_id,partner_id,client_id,job_id,candidate_id,placement_id,attribution_type,evidence,attributed_by)
  values(v_company,p_partner,case when p_type='client_originator' then p_entity end,case when p_type='vacancy_originator' then p_entity end,case when p_type='candidate_originator' then p_entity end,case when p_type='placement_owner' then p_entity end,p_type,btrim(p_evidence),auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'This record already has an active owner; resolve the existing attribution instead of creating a duplicate';
end $$;

create or replace function public.set_partner_status(p_partner uuid,p_status text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_onboarding public.partner_onboarding%rowtype;
begin
  if not private.is_manager() then raise exception 'Manager access required';end if;
  if p_status not in ('active','suspended','terminated') then raise exception 'Invalid partner status';end if;
  select * into v_onboarding from public.partner_onboarding where partner_id=p_partner and company_id=v_company for update;
  if v_onboarding.partner_id is null then raise exception 'Partner onboarding record not found';end if;
  if p_status='active' then
    if v_onboarding.status<>'suspended' then raise exception 'Only suspended partners can be reactivated';end if;
    if not exists(select 1 from public.partner_agreements a where a.id=v_onboarding.agreement_id and a.partner_id=p_partner and a.company_id=v_company and a.status='accepted' and a.accepted_at is not null and a.accepted_terms_hash is not null) then raise exception 'Accepted partner agreement required before reactivation';end if;
    update public.partner_onboarding set status='active',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where partner_id=p_partner and company_id=v_company;
    update public.partner_profiles set active=true,updated_at=now() where user_id=p_partner and company_id=v_company;
    return;
  end if;
  if p_status='suspended' then
    if v_onboarding.status<>'active' then raise exception 'Only active partners can be suspended';end if;
    update public.partner_onboarding set status='suspended',updated_at=now() where partner_id=p_partner and company_id=v_company;
    update public.partner_profiles set active=false,updated_at=now() where user_id=p_partner and company_id=v_company;
    return;
  end if;
  if v_onboarding.status not in ('active','suspended') then raise exception 'Partner is not in a state that can be terminated';end if;
  update public.partner_onboarding set status='terminated',updated_at=now() where partner_id=p_partner and company_id=v_company;
  update public.partner_profiles set active=false,updated_at=now() where user_id=p_partner and company_id=v_company;
  update public.partner_agreements set status='terminated' where partner_id=p_partner and company_id=v_company and status='accepted';
  update public.partner_assignments set completed_at=coalesce(completed_at,now()) where partner_id=p_partner and company_id=v_company and completed_at is null;
  update public.partner_tasks set status='cancelled',completed_at=coalesce(completed_at,now()) where partner_id=p_partner and company_id=v_company and status in ('open','in_progress');
end $$;

create or replace function private.enforce_partner_client_activity_dnc()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_manager boolean:=private.is_manager();v_email text;v_phone text;
begin
  if tg_op='UPDATE' and old.status='do_not_contact' and new.status<>'do_not_contact' and not v_manager then raise exception 'Do-not-contact status can only be removed by Vorlen management';end if;
  if new.status='do_not_contact' and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform pg_advisory_xact_lock(hashtext(new.company_id::text||':'||new.client_id::text));
    select nullif(lower(btrim(c.email)),''),nullif(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),'') into v_email,v_phone from public.clients c where c.id=new.client_id and c.company_id=new.company_id;
    if not exists(select 1 from public.b2b_call_suppressions s where s.company_id=new.company_id and s.client_id=new.client_id) then insert into public.b2b_call_suppressions(company_id,client_id,reason,source,requested_by) values(new.company_id,new.client_id,'do_not_contact','partner_crm',new.partner_id);end if;
    if v_email is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=new.company_id and s.email_normalized=v_email) then insert into public.b2b_call_suppressions(company_id,email_normalized,reason,source,requested_by) values(new.company_id,v_email,'do_not_contact','partner_crm',new.partner_id);end if;
    if v_phone is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=new.company_id and s.phone_normalized=v_phone) then insert into public.b2b_call_suppressions(company_id,phone_normalized,reason,source,requested_by) values(new.company_id,v_phone,'do_not_contact','partner_crm',new.partner_id);end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_partner_client_activity_dnc on public.partner_client_activity;
create trigger trg_partner_client_activity_dnc before insert or update on public.partner_client_activity for each row execute function private.enforce_partner_client_activity_dnc();
revoke all on function private.enforce_partner_client_activity_dnc() from public,anon,authenticated;
grant execute on function private.enforce_partner_client_activity_dnc() to service_role;

create or replace function private.sync_partner_prospect_dnc()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text:=nullif(lower(btrim(new.contact_email)),'');v_phone text:=nullif(regexp_replace(coalesce(new.contact_phone,''),'[^0-9]','','g'),'');
begin
  if new.status='do_not_contact' and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform pg_advisory_xact_lock(hashtext(new.company_id::text||':'||coalesce(v_email,'')||':'||coalesce(v_phone,'')));
    if v_email is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=new.company_id and s.email_normalized=v_email) then insert into public.b2b_call_suppressions(company_id,email_normalized,reason,source,requested_by) values(new.company_id,v_email,'do_not_contact','partner_prospect',new.partner_id);end if;
    if v_phone is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=new.company_id and s.phone_normalized=v_phone) then insert into public.b2b_call_suppressions(company_id,phone_normalized,reason,source,requested_by) values(new.company_id,v_phone,'do_not_contact','partner_prospect',new.partner_id);end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_partner_prospect_dnc on public.partner_prospects;
create trigger trg_partner_prospect_dnc before insert or update on public.partner_prospects for each row execute function private.sync_partner_prospect_dnc();
revoke all on function private.sync_partner_prospect_dnc() from public,anon,authenticated;
grant execute on function private.sync_partner_prospect_dnc() to service_role;

insert into public.b2b_call_suppressions(company_id,client_id,reason,source,requested_by)
select a.company_id,a.client_id,'do_not_contact','partner_crm_backfill',a.partner_id from public.partner_client_activity a
where a.status='do_not_contact' and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=a.company_id and s.client_id=a.client_id);
insert into public.b2b_call_suppressions(company_id,email_normalized,reason,source,requested_by)
select a.company_id,lower(btrim(c.email)),'do_not_contact','partner_crm_backfill',a.partner_id from public.partner_client_activity a join public.clients c on c.id=a.client_id and c.company_id=a.company_id
where a.status='do_not_contact' and nullif(btrim(c.email),'') is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=a.company_id and s.email_normalized=lower(btrim(c.email)));
insert into public.b2b_call_suppressions(company_id,phone_normalized,reason,source,requested_by)
select a.company_id,regexp_replace(c.phone,'[^0-9]','','g'),'do_not_contact','partner_crm_backfill',a.partner_id from public.partner_client_activity a join public.clients c on c.id=a.client_id and c.company_id=a.company_id
where a.status='do_not_contact' and nullif(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),'') is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=a.company_id and s.phone_normalized=regexp_replace(c.phone,'[^0-9]','','g'));
insert into public.b2b_call_suppressions(company_id,email_normalized,reason,source,requested_by)
select p.company_id,lower(btrim(p.contact_email)),'do_not_contact','partner_prospect_backfill',p.partner_id from public.partner_prospects p
where p.status='do_not_contact' and nullif(btrim(p.contact_email),'') is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=p.company_id and s.email_normalized=lower(btrim(p.contact_email)));
insert into public.b2b_call_suppressions(company_id,phone_normalized,reason,source,requested_by)
select p.company_id,regexp_replace(p.contact_phone,'[^0-9]','','g'),'do_not_contact','partner_prospect_backfill',p.partner_id from public.partner_prospects p
where p.status='do_not_contact' and nullif(regexp_replace(coalesce(p.contact_phone,''),'[^0-9]','','g'),'') is not null and not exists(select 1 from public.b2b_call_suppressions s where s.company_id=p.company_id and s.phone_normalized=regexp_replace(p.contact_phone,'[^0-9]','','g'));
