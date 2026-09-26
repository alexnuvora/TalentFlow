alter table public.partner_onboarding
  add column if not exists terminated_at timestamptz;

update public.partner_onboarding
set terminated_at=coalesce(terminated_at,updated_at)
where status='terminated' and terminated_at is null;

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
Either party may end the relationship on 7 days'' written notice. Vorlen may suspend or terminate access immediately for compliance, security, fraud, candidate charging, client misrepresentation, confidentiality/data-protection breach or serious conduct concerns. Termination blocks new partner activity and new commission-side attribution. Where a commission side was validly attributed before the recorded termination time, later qualifying client receipts for that pre-termination placement remain eligible for reconciliation under the accepted agreement terms. No commission is earned for post-termination activity. Valid accrued, approved or paid commission remains governed by these terms and the recorded attribution/adjustment ledger.

15. Governing law, changes and acceptance.
These terms are governed by the law of England and Wales and the courts of England and Wales have jurisdiction, subject to any mandatory law that applies to the Partner. Material commercial changes require a new agreement version. Acceptance records the exact terms hash, version, date, accepting account and typed legal name in Vorlen. The Partner should retain a copy of the accepted terms.'::text
$$;

update public.partner_agreements
set terms_text=private.partner_agreement_terms(),
    terms_hash=encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex')
where version='partner-2026-09-26-split-v2'
  and status='pending';

create or replace function private.reconcile_partner_commission_component(
  p_company uuid,p_placement uuid,p_component text,p_source_invoice uuid default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_attr_type text;v_partner uuid;v_attributed_at timestamptz;v_agreement uuid;v_percent numeric;
  v_received numeric;v_target numeric;v_base public.partner_commissions%rowtype;
  v_old public.partner_commissions%rowtype;v_settled_fee numeric;v_fee_delta numeric;
  v_amount_delta numeric;v_open uuid;v_invoice uuid;
begin
  if p_component not in ('client','candidate') then raise exception 'Invalid commission component'; end if;
  v_attr_type:=case when p_component='client' then 'client_commission_owner' else 'candidate_commission_owner' end;

  select pa.partner_id,pa.attributed_at into v_partner,v_attributed_at
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
  join public.partner_onboarding o
    on o.partner_id=a.partner_id and o.company_id=a.company_id
  where a.company_id=p_company and a.partner_id=v_partner
    and a.commission_model='split_15_15'
    and (
      a.status='accepted'
      or (
        a.status='terminated'
        and a.accepted_at is not null
        and o.terminated_at is not null
        and v_attributed_at<=o.terminated_at
      )
    )
  order by a.accepted_at desc nulls last,a.created_at desc
  limit 1;

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

create or replace function public.set_partner_status(p_partner uuid,p_status text)
returns void
language plpgsql
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_onboarding public.partner_onboarding%rowtype;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_status not in ('active','suspended','terminated') then raise exception 'Invalid partner status'; end if;

  select * into v_onboarding
  from public.partner_onboarding
  where partner_id=p_partner and company_id=v_company
  for update;

  if v_onboarding.partner_id is null then raise exception 'Partner onboarding record not found'; end if;

  if p_status='active' then
    if v_onboarding.status<>'suspended' then raise exception 'Only suspended partners can be reactivated'; end if;
    if not exists(
      select 1 from public.partner_agreements a
      where a.id=v_onboarding.agreement_id and a.partner_id=p_partner and a.company_id=v_company
        and a.status='accepted' and a.accepted_at is not null and a.accepted_terms_hash is not null
    ) then raise exception 'Accepted partner agreement required before reactivation'; end if;

    update public.partner_onboarding
    set status='active',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where partner_id=p_partner and company_id=v_company;

    update public.partner_profiles
    set active=true,updated_at=now()
    where user_id=p_partner and company_id=v_company;
    return;
  end if;

  if p_status='suspended' then
    if v_onboarding.status<>'active' then raise exception 'Only active partners can be suspended'; end if;

    update public.partner_onboarding
    set status='suspended',updated_at=now()
    where partner_id=p_partner and company_id=v_company;

    update public.partner_profiles
    set active=false,updated_at=now()
    where user_id=p_partner and company_id=v_company;
    return;
  end if;

  if v_onboarding.status not in ('active','suspended') then
    raise exception 'Partner is not in a state that can be terminated';
  end if;

  update public.partner_onboarding
  set status='terminated',terminated_at=now(),updated_at=now()
  where partner_id=p_partner and company_id=v_company;

  update public.partner_profiles
  set active=false,updated_at=now()
  where user_id=p_partner and company_id=v_company;

  update public.partner_agreements
  set status='terminated'
  where partner_id=p_partner and company_id=v_company and status in ('accepted','pending');

  update public.partner_assignments
  set completed_at=coalesce(completed_at,now())
  where partner_id=p_partner and company_id=v_company and completed_at is null;

  update public.partner_tasks
  set status='cancelled',completed_at=coalesce(completed_at,now())
  where partner_id=p_partner and company_id=v_company and status in ('open','in_progress');
end
$$;
