-- Harden split partner commission terms and privileged RPC boundaries.
-- Supersedes unaccepted split-v1 terms with split-v2 production terms.

create or replace function private.partner_agreement_terms()
returns text
language sql
immutable
set search_path=''
as $$
select 'VORLEN RECRUITMENT PARTNER TERMS — SPLIT COMMISSION MODEL
Effective version: partner-2026-09-26-split-v2

1. Parties and status.
These terms are between Ivy and Pearls Ltd trading as Vorlen, company number 17387520, registered in England and Wales with registered office at 10 South Street, Rochdale, United Kingdom, OL16 2EP ("Vorlen"), and the recruitment partner identified in the accepted agreement record ("Partner"). The Partner acts as an independent recruitment/business-development contractor. Nothing creates employment, worker status, a legal partnership, or authority to bind Vorlen.

2. Authorised scope.
The Partner may carry out only the recruitment activities enabled for their Vorlen partner specialism and account permissions. Recruitment records, client activity, candidate activity, submissions, interviews and commission evidence must be maintained in authorised Vorlen systems.

3. Maximum partner commission pool.
The standard maximum partner commission pool for a qualifying permanent placement is 30% of the qualifying net recruitment fee actually received and retained by Vorlen. It is divided into two separate components:
(a) 15% Client Development; and
(b) 15% Candidate Delivery.
A Partner earns only the component or components for which Vorlen records them as the verified commission owner for that placement. A Hybrid Partner who validly performs both sides may earn both components, up to 30% in total.

4. Client Development — 15%.
The Client Development component requires evidence-backed responsibility for the employer side of the relevant placement. This normally includes genuine relationship development with the hiring organisation, engagement with an appropriate recruitment decision-maker, progressing the client through Vorlen onboarding and manager-approved commercial terms, obtaining or progressing a genuine hiring instruction, and bringing the relevant vacancy into the authorised Vorlen workflow. Merely adding a company, contact, lead, vacancy or publicly available information to Vorlen does not create commission entitlement.

5. Candidate Delivery — 15%.
The Candidate Delivery component requires evidence-backed responsibility for sourcing or engaging the candidate who is ultimately placed and materially progressing that candidate through the authorised Vorlen recruitment workflow, including appropriate screening/qualification and candidate authority where required. Merely uploading a CV, viewing a candidate, creating a duplicate candidate record or making an unsupported ownership claim does not create commission entitlement.

6. Attribution and disputes.
Vorlen''s timestamped client, vacancy, candidate, submission, placement and manager-reviewed attribution records determine commission ownership. Each placement can have only one active Client Development commission owner and one active Candidate Delivery commission owner. A commission side may be reassigned before approval where the evidence supports correction. Once that side has been approved or paid, its financial ownership is locked except for a documented accounting correction or adjustment. Duplicate or disputed claims are decided by an authorised Vorlen manager using the recorded evidence.

7. Commission base and payment trigger.
Commission is calculated only on qualifying net recruitment fees actually received and retained by Vorlen. VAT, refunds, credits, rebates, chargebacks, pass-through costs, candidate-paid sums, and amounts not retained by Vorlen are excluded. If a client pays an invoice partly, commission accrues only on the corresponding net recruitment-fee portion actually received. No commission is earned merely because a candidate is introduced, an invoice is issued, or a placement is recorded.

8. Refunds, rebates and later changes.
If qualifying client fees increase, decrease, are refunded, rebated or otherwise adjusted after commission has accrued, been approved or been paid, Vorlen records the corresponding commission adjustment in the auditable commission ledger. Any recovery or offset must be evidenced. A paid commission record is not silently rewritten.

9. Client terms and authority.
Partners may develop employer relationships, discuss hiring needs and gather commercial information within their assigned capabilities, but must not quote, agree, accept or vary recruitment fees, payment terms, rebates, guarantees, exclusivity, candidate-ownership periods or any other contractual commitment on behalf of Vorlen unless expressly authorised in writing by Vorlen. A client engagement becomes binding only when the applicable terms are approved and recorded by an authorised Vorlen manager.

10. Candidate protection and work-seeker fees.
A Partner must not charge a candidate or work-seeker any fee for work-finding services. Candidate personal information may be processed only for authorised recruitment purposes through approved Vorlen systems and must not be exported, retained privately, reused or disclosed outside the authorised workflow. Identifiable candidate information may be submitted to an employer only where the applicable lawful basis and candidate authority requirements have been met.

11. Data protection, confidentiality and security.
The Partner must comply with applicable data-protection, confidentiality and security requirements, including Vorlen instructions governing UK GDPR restricted transfers where relevant. Credentials must be kept private; MFA must be used where available; suspected loss, unauthorised access or disclosure must be reported promptly; bulk exports and unauthorised local copies are prohibited; and personal/confidential data must be returned or deleted when required.

12. AI and recruitment decisions.
AI-generated screening, summaries, matching or scores are decision-support tools only. The Partner must review source evidence and must not make a final hiring or rejection decision solely because of an AI output. Protected characteristics must not be inferred or used unlawfully.

13. Conduct, records and non-circumvention.
The Partner must act professionally, accurately describe the Vorlen relationship, comply with applicable recruitment, equality, privacy, anti-bribery and marketing rules, and keep material recruitment activity in Vorlen. During the engagement and for 6 months after it ends, the Partner must not deliberately circumvent Vorlen to collect directly a recruitment fee arising from a client introduction or active assignment first introduced through Vorlen, to the extent enforceable under applicable law.

14. Suspension and termination.
Either party may end the relationship on 7 days'' written notice. Vorlen may suspend or terminate access immediately for compliance, security, fraud, candidate charging, client misrepresentation, confidentiality/data-protection breach or serious conduct concerns. No new commission accrues from unauthorised activity after termination. Valid commission already earned on qualifying fees remains governed by these terms and the recorded attribution/adjustment ledger.

15. Governing law, changes and acceptance.
These terms are governed by the law of England and Wales and the courts of England and Wales have jurisdiction, subject to any mandatory law that applies to the Partner. Material commercial changes require a new agreement version. Acceptance records the exact terms hash, version, date, accepting account and typed legal name in Vorlen. The Partner should retain a copy of the accepted terms.'::text
$$;

create or replace function public.issue_partner_commission_terms(p_partner uuid)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare v_company uuid:=private.current_company_id();v_id uuid;v_status text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  select o.status into v_status
  from public.partner_onboarding o
  join public.profiles p on p.id=o.partner_id and p.company_id=o.company_id and p.role='partner'
  where o.partner_id=p_partner and o.company_id=v_company;

  if v_status is null then raise exception 'Partner not found in this workspace'; end if;
  if v_status in ('suspended','terminated') then
    raise exception 'New commission terms cannot be issued to a suspended or terminated partner';
  end if;

  select a.id into v_id
  from public.partner_agreements a
  where a.company_id=v_company and a.partner_id=p_partner
    and a.status='pending' and a.version='partner-2026-09-26-split-v2'
  order by a.created_at desc limit 1;

  if v_id is not null then return v_id; end if;

  update public.partner_agreements
  set status='superseded'
  where company_id=v_company and partner_id=p_partner
    and status='pending' and commission_model='split_15_15';

  insert into public.partner_agreements(
    company_id,partner_id,version,status,commission_percent,
    client_commission_percent,candidate_commission_percent,commission_model,
    terms_text,terms_hash
  ) values(
    v_company,p_partner,'partner-2026-09-26-split-v2','pending',30,
    15,15,'split_15_15',private.partner_agreement_terms(),
    encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
  )
  returning id into v_id;

  return v_id;
end
$$;
revoke all on function public.issue_partner_commission_terms(uuid) from public,anon;
grant execute on function public.issue_partner_commission_terms(uuid) to authenticated,service_role;

create or replace function private.accept_partner_agreement_impl(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_hash text;v_user uuid:=auth.uid();v_company uuid;v_onboarding_status text;
  v_model text;v_version text;v_attr record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_accepted_name),'') is null then raise exception 'Full legal name is required'; end if;

  select a.company_id,encode(extensions.digest(a.terms_text,'sha256'),'hex'),a.commission_model,a.version
    into v_company,v_hash,v_model,v_version
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
  if v_onboarding_status in ('suspended','terminated') then
    raise exception 'A suspended or terminated partner cannot accept new agreement terms';
  end if;

  if v_model='split_15_15' and v_version<>'partner-2026-09-26-split-v2' then
    raise exception 'A newer split-commission agreement version must be accepted';
  end if;

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
      perform private.reconcile_partner_commission_component(
        v_company,v_attr.placement_id,v_attr.component,null
      );
    end loop;
  end if;
end
$$;
revoke all on function private.accept_partner_agreement_impl(uuid,text,text) from public,anon;
grant execute on function private.accept_partner_agreement_impl(uuid,text,text) to authenticated,service_role;

create or replace function public.accept_partner_agreement(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void
language sql
security invoker
set search_path=''
as $$
  select private.accept_partner_agreement_impl(p_agreement,p_accepted_name,p_user_agent)
$$;
revoke all on function public.accept_partner_agreement(uuid,text,text) from public,anon;
grant execute on function public.accept_partner_agreement(uuid,text,text) to authenticated,service_role;

create or replace function private.attribute_partner_entity_impl(
  p_partner uuid,p_type text,p_entity uuid,p_evidence text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;v_company uuid:=private.current_company_id();v_component text;v_specialism text;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  select pp.specialism into v_specialism
  from public.partner_onboarding o
  join public.partner_profiles pp on pp.user_id=o.partner_id and pp.company_id=o.company_id
  where o.partner_id=p_partner and o.company_id=v_company
    and o.status='active' and pp.active=true;

  if v_specialism is null then raise exception 'Partner must be active'; end if;

  if p_type not in (
    'client_originator','vacancy_originator','candidate_originator','placement_owner',
    'client_commission_owner','candidate_commission_owner'
  ) then raise exception 'Invalid attribution type'; end if;

  if nullif(btrim(p_evidence),'') is null then raise exception 'Attribution evidence is required'; end if;

  if p_type='client_commission_owner'
     and v_specialism not in ('b2b_advisor','lead_closer','hybrid') then
    raise exception 'Client Development commission requires a client-capable partner specialism';
  end if;

  if p_type='candidate_commission_owner'
     and v_specialism not in ('candidate_sourcer','hybrid') then
    raise exception 'Candidate Delivery commission requires a candidate-sourcing partner specialism';
  end if;

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
      where pc.company_id=v_company and pc.placement_id=p_entity
        and pc.commission_component=v_component
        and pc.status in ('approved','paid')
        and pc.partner_user_id is distinct from p_partner
    ) then
      raise exception 'This commission side is financially locked because commission has already been approved or paid';
    end if;

    update public.partner_attributions
    set status='superseded'
    where company_id=v_company and placement_id=p_entity
      and attribution_type=p_type and status='active' and partner_id<>p_partner;

    select pa.id into v_id
    from public.partner_attributions pa
    where pa.company_id=v_company and pa.placement_id=p_entity
      and pa.attribution_type=p_type and pa.status='active' and pa.partner_id=p_partner
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

    perform private.reconcile_partner_commission_component(
      v_company,p_entity,v_component,null
    );
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
revoke all on function private.attribute_partner_entity_impl(uuid,text,uuid,text) from public,anon;
grant execute on function private.attribute_partner_entity_impl(uuid,text,uuid,text) to authenticated,service_role;

create or replace function public.attribute_partner_entity(
  p_partner uuid,p_type text,p_entity uuid,p_evidence text
) returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.attribute_partner_entity_impl(p_partner,p_type,p_entity,p_evidence)
$$;
revoke all on function public.attribute_partner_entity(uuid,text,uuid,text) from public,anon;
grant execute on function public.attribute_partner_entity(uuid,text,uuid,text) to authenticated,service_role;

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
    p_company,p_partner,'partner-2026-09-26-split-v2',30,
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

update public.partner_agreements a
set status=case when o.status='terminated' then 'terminated' else 'superseded' end
from public.partner_onboarding o
where a.partner_id=o.partner_id and a.company_id=o.company_id
  and a.status='pending'
  and a.version='partner-2026-09-26-split-v1';

insert into public.partner_agreements(
  company_id,partner_id,version,status,commission_percent,
  client_commission_percent,candidate_commission_percent,commission_model,
  terms_text,terms_hash
)
select o.company_id,o.partner_id,'partner-2026-09-26-split-v2','pending',30,
       15,15,'split_15_15',private.partner_agreement_terms(),
       encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
from public.partner_onboarding o
join public.profiles p on p.id=o.partner_id and p.company_id=o.company_id and p.role='partner'
where o.status not in ('suspended','terminated')
  and not exists(
    select 1 from public.partner_agreements a
    where a.partner_id=o.partner_id and a.company_id=o.company_id
      and a.version='partner-2026-09-26-split-v2'
  );
