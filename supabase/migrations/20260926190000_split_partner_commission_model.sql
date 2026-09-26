-- Split partner commission model: 15% Client Development + 15% Candidate Delivery.
-- Existing accepted agreements remain immutable; active partners receive a new version to accept.

alter table public.partner_agreements
  add column if not exists commission_model text,
  add column if not exists client_commission_percent numeric(5,2),
  add column if not exists candidate_commission_percent numeric(5,2);

update public.partner_agreements
set commission_model=coalesce(commission_model,'legacy_single_30')
where commission_model is null;

alter table public.partner_agreements
  alter column commission_model set default 'split_15_15',
  alter column commission_model set not null;

alter table public.partner_agreements drop constraint if exists partner_agreements_commission_model_check;
alter table public.partner_agreements add constraint partner_agreements_commission_model_check
  check (commission_model in ('legacy_single_30','split_15_15'));

alter table public.partner_agreements drop constraint if exists partner_agreements_client_commission_percent_check;
alter table public.partner_agreements add constraint partner_agreements_client_commission_percent_check
  check (client_commission_percent is null or client_commission_percent between 0 and 100);

alter table public.partner_agreements drop constraint if exists partner_agreements_candidate_commission_percent_check;
alter table public.partner_agreements add constraint partner_agreements_candidate_commission_percent_check
  check (candidate_commission_percent is null or candidate_commission_percent between 0 and 100);

alter table public.partner_agreements drop constraint if exists partner_agreements_split_total_check;
alter table public.partner_agreements add constraint partner_agreements_split_total_check
  check (
    commission_model<>'split_15_15'
    or (
      client_commission_percent is not null
      and candidate_commission_percent is not null
      and client_commission_percent + candidate_commission_percent <= commission_percent
      and commission_percent <= 30
    )
  );

alter table public.partner_attributions drop constraint if exists partner_attributions_attribution_type_check;
alter table public.partner_attributions add constraint partner_attributions_attribution_type_check
  check (attribution_type in (
    'client_originator','vacancy_originator','candidate_originator','placement_owner',
    'client_commission_owner','candidate_commission_owner'
  ));

create unique index if not exists uq_partner_active_client_commission_owner
  on public.partner_attributions(company_id,placement_id)
  where status='active' and attribution_type='client_commission_owner' and placement_id is not null;

create unique index if not exists uq_partner_active_candidate_commission_owner
  on public.partner_attributions(company_id,placement_id)
  where status='active' and attribution_type='candidate_commission_owner' and placement_id is not null;

alter table public.partner_commissions
  add column if not exists commission_component text;

update public.partner_commissions
set commission_component='client'
where commission_component is null;

alter table public.partner_commissions
  alter column commission_component set not null;

alter table public.partner_commissions drop constraint if exists partner_commissions_commission_component_check;
alter table public.partner_commissions add constraint partner_commissions_commission_component_check
  check (commission_component in ('client','candidate'));

alter table public.partner_commissions drop constraint if exists partner_commissions_placement_id_partner_user_id_key;
drop index if exists public.partner_commissions_placement_id_partner_user_id_key;

create unique index if not exists partner_commissions_placement_component_uq
  on public.partner_commissions(placement_id,commission_component);

alter table public.partner_commission_adjustments
  add column if not exists commission_component text;

update public.partner_commission_adjustments a
set commission_component=c.commission_component
from public.partner_commissions c
where a.base_commission_id=c.id and a.commission_component is null;

alter table public.partner_commission_adjustments
  alter column commission_component set not null;

alter table public.partner_commission_adjustments drop constraint if exists partner_commission_adjustments_component_check;
alter table public.partner_commission_adjustments add constraint partner_commission_adjustments_component_check
  check (commission_component in ('client','candidate'));

create index if not exists partner_commissions_component_status_idx
  on public.partner_commissions(company_id,commission_component,status);

create index if not exists partner_attributions_commission_lookup_idx
  on public.partner_attributions(company_id,placement_id,attribution_type,status);

create or replace function private.partner_agreement_terms()
returns text
language sql
immutable
set search_path=''
as $$
select 'Vorlen Recruitment Partner Agreement
1. Appointment. The partner acts as an independent recruitment/business-development partner and is not an employee, agent with authority to bind Vorlen, or authorised to vary Vorlen client terms.
2. Scope. Work is limited to permanent recruitment activity authorised through Vorlen. The partner must use Vorlen systems for client, vacancy, candidate and introduction records.
3. Commission pool. The maximum standard partner commission pool is 30% of qualifying recruitment fees actually received and retained by Vorlen, split into two independently attributable components: 15% Client Development and 15% Candidate Delivery. A partner earns only the component(s) for which Vorlen records them as the verified commission owner for the placement. Where the same partner validly performs both sides, that partner may earn both components, up to 30% in total.
4. Client Development component. The 15% client-side component requires evidence-backed responsibility for originating/developing the employer relationship, reaching or working with the recruitment decision-maker, progressing the client through Vorlen onboarding/approved commercial terms and bringing the relevant hiring requirement/vacancy into the authorised Vorlen workflow. Merely adding a company or contact to the CRM does not create commission entitlement.
5. Candidate Delivery component. The 15% candidate-side component requires evidence-backed responsibility for sourcing/engaging the candidate who is ultimately placed and progressing that candidate through the authorised Vorlen recruitment workflow. Merely uploading a CV, viewing a candidate or creating a duplicate candidate record does not create commission entitlement.
6. Commission base. VAT, refunds, credits, rebates, chargebacks, pass-through costs and sums not retained by Vorlen are excluded. Where client payments include VAT, commission is calculated only on the corresponding net recruitment-fee portion actually received. No commission is earned merely because a candidate is introduced or an invoice is issued.
7. Attribution. Vorlen''s timestamped client, vacancy, candidate, submission, placement and manager-reviewed attribution records determine each commission component. Duplicate or disputed claims are reviewed by an authorised Vorlen manager. Approved or paid commission is financially locked and attribution cannot be reassigned to avoid or duplicate an earned liability.
8. Client terms and authority. Partners may develop employer relationships, discuss hiring needs and gather commercial information, but they must not quote, agree, accept or vary recruitment fees, payment terms, rebates, guarantees, exclusivity, candidate-ownership periods or any other contractual commitment on behalf of Vorlen. A client engagement becomes binding only when the applicable terms are approved and recorded by an authorised Vorlen manager.
9. Candidate data. Personal data may be processed only for authorised recruitment purposes, through approved Vorlen systems, with appropriate confidentiality and data-protection safeguards. Candidate data must not be exported, retained privately or reused outside authorised work.
10. Conduct. The partner must act professionally, accurately identify the Vorlen relationship, avoid misleading statements and comply with applicable recruitment, equality, privacy, anti-bribery and marketing rules.
11. Confidentiality and IP. Vorlen/client/candidate confidential information and platform materials remain protected and may be used only for the partnership.
12. Payment and adjustments. Earned commission is subject to manager approval and is paid using the partner''s approved payment details. If qualifying client fees later increase, decrease, are refunded or rebated after approval, Vorlen records a corresponding auditable commission adjustment. Any recovery or offset must be evidenced in the ledger.
13. Termination. Vorlen may suspend or terminate access for compliance, security, misconduct or commercial reasons. Termination does not create commission on fees not actually received; valid earned commission already due remains recorded.
14. Independent status. The partner is responsible for their own tax, insurance and business obligations in their jurisdiction. Nothing creates employment, worker status, partnership in law or authority to bind Vorlen.
15. Entire operational terms. These terms work with Vorlen privacy/security policies and any written partner schedule issued by Vorlen. Material changes require a new version and acceptance.'::text
$$;

create or replace function public.issue_partner_commission_terms(p_partner uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_partner and p.company_id=v_company and p.role='partner') then
    raise exception 'Partner not found in this workspace';
  end if;

  select a.id into v_id
  from public.partner_agreements a
  where a.company_id=v_company
    and a.partner_id=p_partner
    and a.status='pending'
    and a.commission_model='split_15_15'
  order by a.created_at desc
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.partner_agreements(
    company_id,partner_id,version,status,commission_percent,
    client_commission_percent,candidate_commission_percent,commission_model,
    terms_text,terms_hash
  ) values(
    v_company,p_partner,'partner-2026-09-26-split-v1','pending',30,
    15,15,'split_15_15',private.partner_agreement_terms(),
    encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.issue_partner_commission_terms(uuid) from public,anon;
grant execute on function public.issue_partner_commission_terms(uuid) to authenticated,service_role;

create or replace function public.accept_partner_agreement(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_hash text;v_user uuid:=auth.uid();v_company uuid;v_onboarding_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_accepted_name),'') is null then raise exception 'Full legal name is required'; end if;

  select a.company_id,encode(extensions.digest(a.terms_text,'sha256'),'hex')
    into v_company,v_hash
  from public.partner_agreements a
  join public.profiles p on p.id=v_user and p.company_id=a.company_id and p.role='partner'
  where a.id=p_agreement and a.partner_id=v_user and a.status='pending'
  for update;

  if v_hash is null then raise exception 'Pending partner agreement not found'; end if;

  select o.status into v_onboarding_status
  from public.partner_onboarding o
  where o.partner_id=v_user and o.company_id=v_company
  for update;

  if v_onboarding_status is null then raise exception 'Partner onboarding record not found'; end if;

  update public.partner_agreements
  set status='superseded'
  where company_id=v_company and partner_id=v_user and status='accepted' and id<>p_agreement;

  update public.partner_agreements
  set status='accepted',accepted_at=now(),accepted_name=btrim(p_accepted_name),
      terms_hash=v_hash,accepted_terms_hash=v_hash,accepted_user_agent=left(p_user_agent,500)
  where id=p_agreement and partner_id=v_user and status='pending';

  if v_onboarding_status='terms_pending' then
    update public.partner_onboarding
    set status='details_pending',agreement_id=p_agreement,updated_at=now()
    where partner_id=v_user and company_id=v_company;
  else
    update public.partner_onboarding
    set agreement_id=p_agreement,updated_at=now()
    where partner_id=v_user and company_id=v_company;
  end if;
end
$$;

revoke all on function public.accept_partner_agreement(uuid,text,text) from public,anon;
grant execute on function public.accept_partner_agreement(uuid,text,text) to authenticated,service_role;

create or replace function private.initialise_partner_onboarding_impl(
  p_company uuid,p_partner uuid,p_specialism text default 'b2b_advisor'
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_agreement uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and current_user <> 'service_role' then
    if not private.is_manager() then raise exception 'Manager access required'; end if;
    if p_company<>private.current_company_id() then raise exception 'Workspace mismatch'; end if;
  end if;

  if p_specialism not in ('b2b_advisor','lead_closer','candidate_sourcer','hybrid') then
    raise exception 'Invalid partner specialism';
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_partner and p.company_id=p_company and p.role='partner'
  ) then raise exception 'Partner profile is not present in this workspace'; end if;

  select o.agreement_id into v_agreement
  from public.partner_onboarding o
  where o.partner_id=p_partner and o.company_id=p_company;

  if v_agreement is not null then
    insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
    values(
      p_partner,p_company,p_specialism,
      exists(select 1 from public.partner_onboarding o where o.partner_id=p_partner and o.company_id=p_company and o.status='active'),
      now()
    )
    on conflict(user_id) do update
      set specialism=excluded.specialism,active=excluded.active,updated_at=excluded.updated_at;
    return v_agreement;
  end if;

  insert into public.partner_agreements(
    company_id,partner_id,version,commission_percent,
    client_commission_percent,candidate_commission_percent,commission_model,
    terms_text,terms_hash
  ) values(
    p_company,p_partner,'partner-2026-09-26-split-v1',30,
    15,15,'split_15_15',private.partner_agreement_terms(),
    encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
  )
  returning id into v_agreement;

  insert into public.partner_onboarding(partner_id,company_id,status,agreement_id)
  values(p_partner,p_company,'terms_pending',v_agreement);

  insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
  values(p_partner,p_company,p_specialism,false,now())
  on conflict(user_id) do update
    set company_id=excluded.company_id,specialism=excluded.specialism,active=false,updated_at=excluded.updated_at;

  return v_agreement;
end
$$;

create or replace function private.partner_net_fee_received(p_placement uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select round(coalesce(sum(
    case
      when i.status='void' then 0
      when coalesce(i.amount_paid,0)<=0 then 0
      when coalesce(i.total,0)>0
        then least(coalesce(i.subtotal,0),coalesce(i.amount_paid,0)*coalesce(i.subtotal,0)/i.total)
      else least(coalesce(i.subtotal,0),coalesce(i.amount_paid,0))
    end
  ),0),2)
  from public.invoices i
  where i.placement_id=p_placement
$$;

revoke all on function private.partner_net_fee_received(uuid) from public,anon,authenticated;
grant execute on function private.partner_net_fee_received(uuid) to service_role;

create or replace function private.reconcile_partner_commission_component(
  p_company uuid,p_placement uuid,p_component text,p_source_invoice uuid default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_attr_type text;v_partner uuid;v_agreement uuid;v_percent numeric;v_received numeric;v_target numeric;
  v_base public.partner_commissions%rowtype;v_old public.partner_commissions%rowtype;
  v_settled_fee numeric;v_fee_delta numeric;v_amount_delta numeric;v_open uuid;v_invoice uuid;
begin
  if p_component not in ('client','candidate') then raise exception 'Invalid commission component'; end if;
  v_attr_type:=case when p_component='client' then 'client_commission_owner' else 'candidate_commission_owner' end;

  select pa.partner_id into v_partner
  from public.partner_attributions pa
  where pa.company_id=p_company and pa.placement_id=p_placement
    and pa.attribution_type=v_attr_type and pa.status='active'
  order by pa.attributed_at desc
  limit 1;

  for v_old in
    select *
    from public.partner_commissions pc
    where pc.company_id=p_company
      and pc.placement_id=p_placement
      and pc.commission_component=p_component
      and (v_partner is null or pc.partner_user_id is distinct from v_partner)
    for update
  loop
    if v_old.status in ('approved','paid') then
      raise exception 'Cannot reassign % commission after it has been approved or paid',p_component;
    end if;

    if v_old.status='accrued' then
      update public.partner_commissions
      set status='void',amount=0,updated_at=now(),
          notes=coalesce(notes||' · ','')||'Voided after commission-side attribution changed'
      where id=v_old.id;
    end if;
  end loop;

  if v_partner is null then return; end if;

  select a.id,
         case when p_component='client' then a.client_commission_percent else a.candidate_commission_percent end
    into v_agreement,v_percent
  from public.partner_agreements a
  where a.company_id=p_company
    and a.partner_id=v_partner
    and a.status='accepted'
    and a.commission_model='split_15_15'
  order by a.accepted_at desc nulls last,a.created_at desc
  limit 1;

  if v_agreement is null or coalesce(v_percent,0)<=0 then return; end if;

  v_received:=private.partner_net_fee_received(p_placement);
  v_target:=round(v_received*v_percent/100,2);

  if p_source_invoice is null then
    select i.id into v_invoice
    from public.invoices i
    where i.placement_id=p_placement and i.status<>'void'
    order by coalesce(i.paid_at,i.created_at) desc
    limit 1;
  else
    v_invoice:=p_source_invoice;
  end if;

  select * into v_base
  from public.partner_commissions pc
  where pc.company_id=p_company
    and pc.placement_id=p_placement
    and pc.commission_component=p_component
  for update;

  if v_base.id is null then
    if v_received<=0 then return; end if;

    insert into public.partner_commissions(
      company_id,placement_id,partner_user_id,commission_component,rate,amount,status,
      agreement_id,invoice_id,eligible_fee_received,notes
    ) values(
      p_company,p_placement,v_partner,p_component,v_percent/100,v_target,'accrued',
      v_agreement,v_invoice,v_received,
      case when p_component='client' then 'Client Development commission' else 'Candidate Delivery commission' end
    );
    return;
  end if;

  if v_base.partner_user_id is distinct from v_partner then return; end if;

  if v_base.status='accrued' then
    if v_received<=0 then
      update public.partner_commissions
      set amount=0,eligible_fee_received=0,invoice_id=v_invoice,status='void',updated_at=now()
      where id=v_base.id;
    else
      update public.partner_commissions
      set rate=v_percent/100,amount=v_target,eligible_fee_received=v_received,
          agreement_id=v_agreement,invoice_id=v_invoice,updated_at=now()
      where id=v_base.id;
    end if;
    return;
  end if;

  if v_base.status='void' then return; end if;

  select coalesce(sum(adj.eligible_fee_delta),0) into v_settled_fee
  from public.partner_commission_adjustments adj
  where adj.base_commission_id=v_base.id and adj.status in ('approved','paid');

  v_settled_fee:=v_base.eligible_fee_received+v_settled_fee;
  v_fee_delta:=round(v_received-v_settled_fee,2);
  v_amount_delta:=round(v_fee_delta*v_base.rate,2);

  select adj.id into v_open
  from public.partner_commission_adjustments adj
  where adj.base_commission_id=v_base.id and adj.status='accrued'
  limit 1
  for update;

  if abs(v_fee_delta)<0.005 or abs(v_amount_delta)<0.005 then
    if v_open is not null then
      update public.partner_commission_adjustments
      set status='void',
          reason='No remaining commission adjustment after invoice reconciliation',
          updated_at=now()
      where id=v_open;
    end if;
    return;
  end if;

  if v_open is null then
    insert into public.partner_commission_adjustments(
      company_id,base_commission_id,placement_id,partner_user_id,agreement_id,source_invoice_id,
      commission_component,eligible_fee_delta,amount,status,reason
    ) values(
      v_base.company_id,v_base.id,v_base.placement_id,v_base.partner_user_id,v_base.agreement_id,v_invoice,
      p_component,v_fee_delta,v_amount_delta,'accrued',
      case when v_amount_delta>=0 then 'Additional qualifying net client fee received after commission approval'
           else 'Qualifying net client fee reduction/refund after commission approval' end
    );
  else
    update public.partner_commission_adjustments
    set source_invoice_id=v_invoice,
        commission_component=p_component,
        eligible_fee_delta=v_fee_delta,
        amount=v_amount_delta,
        reason=case when v_amount_delta>=0 then 'Additional qualifying net client fee received after commission approval'
                    else 'Qualifying net client fee reduction/refund after commission approval' end,
        updated_at=now()
    where id=v_open;
  end if;
end
$$;

revoke all on function private.reconcile_partner_commission_component(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.reconcile_partner_commission_component(uuid,uuid,text,uuid) to service_role;

create or replace function public.sync_partner_commission()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.placement_id is null then return new; end if;
  perform private.reconcile_partner_commission_component(new.company_id,new.placement_id,'client',new.id);
  perform private.reconcile_partner_commission_component(new.company_id,new.placement_id,'candidate',new.id);
  return new;
end
$$;

revoke all on function public.sync_partner_commission() from public,anon,authenticated;

create or replace function public.attribute_partner_entity(
  p_partner uuid,p_type text,p_entity uuid,p_evidence text
) returns uuid
language plpgsql
set search_path=''
as $$
declare v_id uuid;v_company uuid:=private.current_company_id();v_component text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  if not exists(
    select 1 from public.partner_onboarding
    where partner_id=p_partner and company_id=v_company and status='active'
  ) then raise exception 'Partner must be active'; end if;

  if p_type not in (
    'client_originator','vacancy_originator','candidate_originator','placement_owner',
    'client_commission_owner','candidate_commission_owner'
  ) then raise exception 'Invalid attribution type'; end if;

  if nullif(btrim(p_evidence),'') is null then raise exception 'Attribution evidence is required'; end if;

  if p_type='client_originator'
    and not exists(select 1 from public.clients c where c.id=p_entity and c.company_id=v_company)
  then raise exception 'Client not found in this workspace';
  elsif p_type='vacancy_originator'
    and not exists(select 1 from public.jobs j where j.id=p_entity and j.company_id=v_company)
  then raise exception 'Vacancy not found in this workspace';
  elsif p_type='candidate_originator'
    and not exists(select 1 from public.candidates c where c.id=p_entity and c.company_id=v_company)
  then raise exception 'Candidate not found in this workspace';
  elsif p_type in ('placement_owner','client_commission_owner','candidate_commission_owner')
    and not exists(select 1 from public.placements p where p.id=p_entity and p.company_id=v_company)
  then raise exception 'Placement not found in this workspace';
  end if;

  if p_type in ('client_commission_owner','candidate_commission_owner') then
    v_component:=case when p_type='client_commission_owner' then 'client' else 'candidate' end;

    if exists(
      select 1 from public.partner_commissions pc
      where pc.company_id=v_company
        and pc.placement_id=p_entity
        and pc.commission_component=v_component
        and pc.status in ('approved','paid')
        and pc.partner_user_id is distinct from p_partner
    ) then
      raise exception 'This commission side is financially locked because commission has already been approved or paid';
    end if;

    update public.partner_attributions
    set status='superseded'
    where company_id=v_company
      and placement_id=p_entity
      and attribution_type=p_type
      and status='active'
      and partner_id<>p_partner;

    select pa.id into v_id
    from public.partner_attributions pa
    where pa.company_id=v_company
      and pa.placement_id=p_entity
      and pa.attribution_type=p_type
      and pa.status='active'
      and pa.partner_id=p_partner
    limit 1;

    if v_id is not null then
      update public.partner_attributions
      set evidence=btrim(p_evidence),attributed_by=auth.uid(),attributed_at=now()
      where id=v_id;
    else
      insert into public.partner_attributions(
        company_id,partner_id,placement_id,attribution_type,evidence,attributed_by
      ) values(
        v_company,p_partner,p_entity,p_type,btrim(p_evidence),auth.uid()
      )
      returning id into v_id;
    end if;

    perform private.reconcile_partner_commission_component(v_company,p_entity,v_component,null);
    return v_id;
  end if;

  insert into public.partner_attributions(
    company_id,partner_id,client_id,job_id,candidate_id,placement_id,
    attribution_type,evidence,attributed_by
  ) values(
    v_company,p_partner,
    case when p_type='client_originator' then p_entity end,
    case when p_type='vacancy_originator' then p_entity end,
    case when p_type='candidate_originator' then p_entity end,
    case when p_type='placement_owner' then p_entity end,
    p_type,btrim(p_evidence),auth.uid()
  )
  returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception 'This record already has an active owner; resolve the existing attribution instead of creating a duplicate';
end
$$;

revoke all on function public.attribute_partner_entity(uuid,text,uuid,text) from public,anon;
grant execute on function public.attribute_partner_entity(uuid,text,uuid,text) to authenticated,service_role;

create or replace function public.protect_partner_commission_integrity()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare v_privileged boolean:=current_user in ('postgres','service_role');
begin
  new.updated_at:=now();

  if not v_privileged and (
    old.company_id is distinct from new.company_id
    or old.placement_id is distinct from new.placement_id
    or old.partner_user_id is distinct from new.partner_user_id
    or old.commission_component is distinct from new.commission_component
    or old.rate is distinct from new.rate
    or old.amount is distinct from new.amount
    or old.agreement_id is distinct from new.agreement_id
    or old.invoice_id is distinct from new.invoice_id
    or old.eligible_fee_received is distinct from new.eligible_fee_received
  ) then raise exception 'Calculated commission fields cannot be edited manually'; end if;

  if old.status='accrued' and new.status not in ('accrued','approved','void') then
    raise exception 'Accrued commission may only be approved or voided';
  elsif old.status='approved' and new.status not in ('approved','paid','void') then
    raise exception 'Approved commission may only be paid or voided';
  elsif old.status in ('paid','void') and new.status<>old.status then
    raise exception 'Paid or void commission status is immutable';
  end if;

  if old.status in ('approved','paid','void') and (
    old.company_id is distinct from new.company_id
    or old.placement_id is distinct from new.placement_id
    or old.partner_user_id is distinct from new.partner_user_id
    or old.commission_component is distinct from new.commission_component
    or old.rate is distinct from new.rate
    or old.amount is distinct from new.amount
    or old.agreement_id is distinct from new.agreement_id
    or old.invoice_id is distinct from new.invoice_id
    or old.eligible_fee_received is distinct from new.eligible_fee_received
  ) then raise exception 'Approved, paid or void commission amounts are financially locked'; end if;

  if new.status='approved' and old.status<>'approved' then
    new.approved_at:=coalesce(new.approved_at,now());
    new.approved_by:=coalesce(new.approved_by,auth.uid());
  end if;

  if new.status='paid' and old.status<>'paid' then
    if nullif(btrim(new.payment_reference),'') is null then
      raise exception 'Payment reference is required before marking commission paid';
    end if;
    new.paid_at:=coalesce(new.paid_at,now());
  end if;

  return new;
end
$$;

create or replace function public.protect_partner_commission_adjustment_integrity()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare v_privileged boolean:=current_user in ('postgres','service_role');v_base public.partner_commissions%rowtype;
begin
  new.updated_at:=now();

  select * into v_base
  from public.partner_commissions pc
  where pc.id=new.base_commission_id;

  if v_base.id is null
    or v_base.company_id<>new.company_id
    or v_base.placement_id<>new.placement_id
    or v_base.partner_user_id is distinct from new.partner_user_id
    or v_base.agreement_id is distinct from new.agreement_id
    or coalesce(new.commission_component,v_base.commission_component)<>v_base.commission_component
  then raise exception 'Commission adjustment does not match its base commission'; end if;

  new.commission_component:=v_base.commission_component;

  if not v_privileged and tg_op='UPDATE' and (
    old.company_id is distinct from new.company_id
    or old.base_commission_id is distinct from new.base_commission_id
    or old.placement_id is distinct from new.placement_id
    or old.partner_user_id is distinct from new.partner_user_id
    or old.agreement_id is distinct from new.agreement_id
    or old.source_invoice_id is distinct from new.source_invoice_id
    or old.commission_component is distinct from new.commission_component
    or old.eligible_fee_delta is distinct from new.eligible_fee_delta
    or old.amount is distinct from new.amount
    or old.reason is distinct from new.reason
  ) then raise exception 'Calculated commission adjustment fields cannot be edited manually'; end if;

  if tg_op='UPDATE' then
    if old.status='accrued' and new.status not in ('accrued','approved','void') then
      raise exception 'Accrued adjustment may only be approved or voided';
    elsif old.status='approved' and new.status not in ('approved','paid','void') then
      raise exception 'Approved adjustment may only be paid or voided';
    elsif old.status in ('paid','void') and new.status<>old.status then
      raise exception 'Paid or void adjustment is immutable';
    end if;
  end if;

  if new.status='approved' and (tg_op='INSERT' or old.status<>'approved') then
    new.approved_at:=coalesce(new.approved_at,now());
    new.approved_by:=coalesce(new.approved_by,auth.uid());
  end if;

  if new.status='paid' and (tg_op='INSERT' or old.status<>'paid') then
    if nullif(btrim(new.payment_reference),'') is null then
      raise exception 'Payment or offset reference is required before marking adjustment paid';
    end if;
    new.paid_at:=coalesce(new.paid_at,now());
  end if;

  return new;
end
$$;

-- Pending, unaccepted agreements may be upgraded in place.
update public.partner_agreements a
set version='partner-2026-09-26-split-v1',
    commission_percent=30,
    client_commission_percent=15,
    candidate_commission_percent=15,
    commission_model='split_15_15',
    terms_text=private.partner_agreement_terms(),
    terms_hash=encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
where a.status='pending'
  and not exists(
    select 1
    from public.partner_agreements x
    where x.partner_id=a.partner_id
      and x.id<>a.id
      and x.version='partner-2026-09-26-split-v1'
  );

-- Accepted agreements are immutable: issue a new version instead of rewriting them.
insert into public.partner_agreements(
  company_id,partner_id,version,status,commission_percent,
  client_commission_percent,candidate_commission_percent,commission_model,
  terms_text,terms_hash
)
select a.company_id,a.partner_id,'partner-2026-09-26-split-v1','pending',30,
       15,15,'split_15_15',private.partner_agreement_terms(),
       encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
from public.partner_agreements a
where a.status='accepted'
  and not exists(
    select 1
    from public.partner_agreements x
    where x.partner_id=a.partner_id
      and x.version='partner-2026-09-26-split-v1'
  );


create or replace function private.enforce_partner_attribution_scope()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_partner_company uuid;
  v_nonnull integer;
begin
  select p.company_id into v_partner_company
  from public.profiles p
  where p.id=new.partner_id and p.role='partner';

  if v_partner_company is null or v_partner_company<>new.company_id then
    raise exception 'Partner attribution must belong to the same workspace as the partner';
  end if;

  v_nonnull:=num_nonnulls(new.client_id,new.job_id,new.candidate_id,new.placement_id);
  if v_nonnull<>1 then raise exception 'Partner attribution must reference exactly one entity'; end if;

  if new.attribution_type='client_originator' then
    if new.client_id is null or not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then
      raise exception 'Client attribution must reference a client in the same workspace';
    end if;
  elsif new.attribution_type='vacancy_originator' then
    if new.job_id is null or not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id) then
      raise exception 'Vacancy attribution must reference a vacancy in the same workspace';
    end if;
  elsif new.attribution_type='candidate_originator' then
    if new.candidate_id is null or not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then
      raise exception 'Candidate attribution must reference a candidate in the same workspace';
    end if;
  elsif new.attribution_type in ('placement_owner','client_commission_owner','candidate_commission_owner') then
    if new.placement_id is null or not exists(select 1 from public.placements p where p.id=new.placement_id and p.company_id=new.company_id) then
      raise exception 'Placement attribution must reference a placement in the same workspace';
    end if;
  else
    raise exception 'Invalid attribution type';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_partner_attribution_scope() from public,anon,authenticated;


-- Final split-commission hardening: preserve voided history, allow safe reassignment
-- before approval, backfill on later agreement acceptance, and keep manager issuance
-- under RLS/security-invoker rather than a new SECURITY DEFINER API surface.

drop index if exists public.partner_commissions_placement_component_uq;
create unique index if not exists partner_commissions_active_component_uq
  on public.partner_commissions(placement_id,commission_component)
  where status<>'void';

create or replace function public.issue_partner_commission_terms(p_partner uuid)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_partner and p.company_id=v_company and p.role='partner') then
    raise exception 'Partner not found in this workspace';
  end if;
  select a.id into v_id
  from public.partner_agreements a
  where a.company_id=v_company and a.partner_id=p_partner
    and a.status='pending' and a.commission_model='split_15_15'
  order by a.created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.partner_agreements(
    company_id,partner_id,version,status,commission_percent,
    client_commission_percent,candidate_commission_percent,commission_model,terms_text,terms_hash
  ) values(
    v_company,p_partner,'partner-2026-09-26-split-v1','pending',30,15,15,'split_15_15',
    private.partner_agreement_terms(),encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
  ) returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.issue_partner_commission_terms(uuid) from public,anon;
grant execute on function public.issue_partner_commission_terms(uuid) to authenticated,service_role;

create or replace function private.reconcile_partner_commission_component(
  p_company uuid,p_placement uuid,p_component text,p_source_invoice uuid default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_attr_type text;v_partner uuid;v_agreement uuid;v_percent numeric;v_received numeric;v_target numeric;
  v_base public.partner_commissions%rowtype;v_old public.partner_commissions%rowtype;
  v_settled_fee numeric;v_fee_delta numeric;v_amount_delta numeric;v_open uuid;v_invoice uuid;
begin
  if p_component not in ('client','candidate') then raise exception 'Invalid commission component'; end if;
  v_attr_type:=case when p_component='client' then 'client_commission_owner' else 'candidate_commission_owner' end;

  select pa.partner_id into v_partner
  from public.partner_attributions pa
  where pa.company_id=p_company and pa.placement_id=p_placement
    and pa.attribution_type=v_attr_type and pa.status='active'
  order by pa.attributed_at desc limit 1;

  for v_old in
    select * from public.partner_commissions pc
    where pc.company_id=p_company and pc.placement_id=p_placement
      and pc.commission_component=p_component and pc.status<>'void'
      and (v_partner is null or pc.partner_user_id is distinct from v_partner)
    for update
  loop
    if v_old.status in ('approved','paid') then
      raise exception 'Cannot reassign % commission after it has been approved or paid',p_component;
    end if;
    if v_old.status='accrued' then
      update public.partner_commissions
      set status='void',updated_at=now(),
          notes=coalesce(notes||' · ','')||'Voided after commission-side attribution changed'
      where id=v_old.id;
    end if;
  end loop;

  if v_partner is null then return; end if;

  select a.id,
         case when p_component='client' then a.client_commission_percent else a.candidate_commission_percent end
  into v_agreement,v_percent
  from public.partner_agreements a
  where a.company_id=p_company and a.partner_id=v_partner and a.status='accepted'
    and a.commission_model='split_15_15'
  order by a.accepted_at desc nulls last,a.created_at desc limit 1;

  if v_agreement is null or coalesce(v_percent,0)<=0 then return; end if;

  v_received:=private.partner_net_fee_received(p_placement);
  v_target:=round(v_received*v_percent/100,2);

  if p_source_invoice is null then
    select i.id into v_invoice
    from public.invoices i
    where i.placement_id=p_placement and i.status<>'void'
    order by coalesce(i.paid_at,i.created_at) desc limit 1;
  else
    v_invoice:=p_source_invoice;
  end if;

  select * into v_base
  from public.partner_commissions pc
  where pc.company_id=p_company and pc.placement_id=p_placement
    and pc.commission_component=p_component and pc.status<>'void'
  for update;

  if v_base.id is null then
    if v_received<=0 then return; end if;
    insert into public.partner_commissions(
      company_id,placement_id,partner_user_id,commission_component,rate,amount,status,
      agreement_id,invoice_id,eligible_fee_received,notes
    ) values(
      p_company,p_placement,v_partner,p_component,v_percent/100,v_target,'accrued',
      v_agreement,v_invoice,v_received,
      case when p_component='client' then 'Client Development commission' else 'Candidate Delivery commission' end
    );
    return;
  end if;

  if v_base.partner_user_id is distinct from v_partner then return; end if;

  if v_base.status='accrued' then
    if v_received<=0 then
      update public.partner_commissions
      set status='void',invoice_id=v_invoice,updated_at=now(),
          notes=coalesce(notes||' · ','')||'Voided because no qualifying net fee remains'
      where id=v_base.id;
    else
      update public.partner_commissions
      set rate=v_percent/100,amount=v_target,eligible_fee_received=v_received,
          agreement_id=v_agreement,invoice_id=v_invoice,updated_at=now()
      where id=v_base.id;
    end if;
    return;
  end if;

  select coalesce(sum(adj.eligible_fee_delta),0) into v_settled_fee
  from public.partner_commission_adjustments adj
  where adj.base_commission_id=v_base.id and adj.status in ('approved','paid');

  v_settled_fee:=v_base.eligible_fee_received+v_settled_fee;
  v_fee_delta:=round(v_received-v_settled_fee,2);
  v_amount_delta:=round(v_fee_delta*v_base.rate,2);

  select adj.id into v_open
  from public.partner_commission_adjustments adj
  where adj.base_commission_id=v_base.id and adj.status='accrued'
  limit 1 for update;

  if abs(v_fee_delta)<0.005 or abs(v_amount_delta)<0.005 then
    if v_open is not null then
      update public.partner_commission_adjustments
      set status='void',reason='No remaining commission adjustment after invoice reconciliation',updated_at=now()
      where id=v_open;
    end if;
    return;
  end if;

  if v_open is null then
    insert into public.partner_commission_adjustments(
      company_id,base_commission_id,placement_id,partner_user_id,agreement_id,source_invoice_id,
      commission_component,eligible_fee_delta,amount,status,reason
    ) values(
      v_base.company_id,v_base.id,v_base.placement_id,v_base.partner_user_id,v_base.agreement_id,v_invoice,
      p_component,v_fee_delta,v_amount_delta,'accrued',
      case when v_amount_delta>=0 then 'Additional qualifying net client fee received after commission approval'
           else 'Qualifying net client fee reduction/refund after commission approval' end
    );
  else
    update public.partner_commission_adjustments
    set source_invoice_id=v_invoice,commission_component=p_component,eligible_fee_delta=v_fee_delta,amount=v_amount_delta,
        reason=case when v_amount_delta>=0 then 'Additional qualifying net client fee received after commission approval'
                    else 'Qualifying net client fee reduction/refund after commission approval' end,
        updated_at=now()
    where id=v_open;
  end if;
end
$$;
revoke all on function private.reconcile_partner_commission_component(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.reconcile_partner_commission_component(uuid,uuid,text,uuid) to service_role;

create or replace function public.attribute_partner_entity(
  p_partner uuid,p_type text,p_entity uuid,p_evidence text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;v_company uuid:=private.current_company_id();v_component text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if not exists(select 1 from public.partner_onboarding where partner_id=p_partner and company_id=v_company and status='active') then
    raise exception 'Partner must be active';
  end if;
  if p_type not in ('client_originator','vacancy_originator','candidate_originator','placement_owner','client_commission_owner','candidate_commission_owner') then
    raise exception 'Invalid attribution type';
  end if;
  if nullif(btrim(p_evidence),'') is null then raise exception 'Attribution evidence is required'; end if;

  if p_type='client_originator' and not exists(select 1 from public.clients c where c.id=p_entity and c.company_id=v_company) then
    raise exception 'Client not found in this workspace';
  elsif p_type='vacancy_originator' and not exists(select 1 from public.jobs j where j.id=p_entity and j.company_id=v_company) then
    raise exception 'Vacancy not found in this workspace';
  elsif p_type='candidate_originator' and not exists(select 1 from public.candidates c where c.id=p_entity and c.company_id=v_company) then
    raise exception 'Candidate not found in this workspace';
  elsif p_type in ('placement_owner','client_commission_owner','candidate_commission_owner')
    and not exists(select 1 from public.placements p where p.id=p_entity and p.company_id=v_company) then
    raise exception 'Placement not found in this workspace';
  end if;

  if p_type in ('client_commission_owner','candidate_commission_owner') then
    v_component:=case when p_type='client_commission_owner' then 'client' else 'candidate' end;

    if exists(
      select 1 from public.partner_commissions pc
      where pc.company_id=v_company and pc.placement_id=p_entity and pc.commission_component=v_component
        and pc.status in ('approved','paid') and pc.partner_user_id is distinct from p_partner
    ) then
      raise exception 'This commission side is financially locked because commission has already been approved or paid';
    end if;

    update public.partner_attributions
    set status='superseded'
    where company_id=v_company and placement_id=p_entity and attribution_type=p_type
      and status='active' and partner_id<>p_partner;

    select pa.id into v_id
    from public.partner_attributions pa
    where pa.company_id=v_company and pa.placement_id=p_entity and pa.attribution_type=p_type
      and pa.status='active' and pa.partner_id=p_partner
    limit 1;

    if v_id is not null then
      update public.partner_attributions
      set evidence=btrim(p_evidence),attributed_by=auth.uid(),attributed_at=now()
      where id=v_id;
    else
      insert into public.partner_attributions(company_id,partner_id,placement_id,attribution_type,evidence,attributed_by)
      values(v_company,p_partner,p_entity,p_type,btrim(p_evidence),auth.uid())
      returning id into v_id;
    end if;

    perform private.reconcile_partner_commission_component(v_company,p_entity,v_component,null);
    return v_id;
  end if;

  insert into public.partner_attributions(
    company_id,partner_id,client_id,job_id,candidate_id,placement_id,attribution_type,evidence,attributed_by
  ) values(
    v_company,p_partner,
    case when p_type='client_originator' then p_entity end,
    case when p_type='vacancy_originator' then p_entity end,
    case when p_type='candidate_originator' then p_entity end,
    case when p_type='placement_owner' then p_entity end,
    p_type,btrim(p_evidence),auth.uid()
  ) returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception 'This record already has an active owner; resolve the existing attribution instead of creating a duplicate';
end
$$;
revoke all on function public.attribute_partner_entity(uuid,text,uuid,text) from public,anon;
grant execute on function public.attribute_partner_entity(uuid,text,uuid,text) to authenticated,service_role;

create or replace function public.accept_partner_agreement(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_hash text;v_user uuid:=auth.uid();v_company uuid;v_onboarding_status text;v_model text;v_attr record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_accepted_name),'') is null then raise exception 'Full legal name is required'; end if;

  select a.company_id,encode(extensions.digest(a.terms_text,'sha256'),'hex'),a.commission_model
    into v_company,v_hash,v_model
  from public.partner_agreements a
  join public.profiles p on p.id=v_user and p.company_id=a.company_id and p.role='partner'
  where a.id=p_agreement and a.partner_id=v_user and a.status='pending'
  for update;

  if v_hash is null then raise exception 'Pending partner agreement not found'; end if;

  select o.status into v_onboarding_status
  from public.partner_onboarding o
  where o.partner_id=v_user and o.company_id=v_company
  for update;

  if v_onboarding_status is null then raise exception 'Partner onboarding record not found'; end if;

  update public.partner_agreements
  set status='superseded'
  where company_id=v_company and partner_id=v_user and status='accepted' and id<>p_agreement;

  update public.partner_agreements
  set status='accepted',accepted_at=now(),accepted_name=btrim(p_accepted_name),
      terms_hash=v_hash,accepted_terms_hash=v_hash,accepted_user_agent=left(p_user_agent,500)
  where id=p_agreement and partner_id=v_user and status='pending';

  if v_onboarding_status='terms_pending' then
    update public.partner_onboarding
    set status='details_pending',agreement_id=p_agreement,updated_at=now()
    where partner_id=v_user and company_id=v_company;
  else
    update public.partner_onboarding
    set agreement_id=p_agreement,updated_at=now()
    where partner_id=v_user and company_id=v_company;
  end if;

  if v_model='split_15_15' then
    for v_attr in
      select distinct pa.placement_id,
        case when pa.attribution_type='client_commission_owner' then 'client' else 'candidate' end as component
      from public.partner_attributions pa
      where pa.company_id=v_company and pa.partner_id=v_user and pa.status='active'
        and pa.attribution_type in ('client_commission_owner','candidate_commission_owner')
        and pa.placement_id is not null
    loop
      perform private.reconcile_partner_commission_component(v_company,v_attr.placement_id,v_attr.component,null);
    end loop;
  end if;
end
$$;
revoke all on function public.accept_partner_agreement(uuid,text,text) from public,anon;
grant execute on function public.accept_partner_agreement(uuid,text,text) to authenticated,service_role;
