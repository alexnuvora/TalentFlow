create or replace function private.partner_agreement_terms()
returns text language sql immutable set search_path='' as $$
select 'Vorlen Recruitment Partner Agreement
1. Appointment. The partner acts as an independent recruitment/business-development partner and is not an employee, agent with authority to bind Vorlen, or authorised to vary Vorlen client terms.
2. Scope. Work is limited to permanent recruitment activity authorised through Vorlen. The partner must use Vorlen systems for client, vacancy, candidate and introduction records.
3. Commission. The standard partner share is 30% of qualifying recruitment fees actually received by Vorlen for a placement attributed to the partner under Vorlen records. VAT, refunds, credits, rebates, chargebacks and sums not retained by Vorlen are excluded from the commission base. No commission is earned merely because a candidate is introduced or an invoice is issued.
4. Attribution. Vorlen''s timestamped client, vacancy, candidate and placement records determine attribution. Duplicate or disputed introductions are reviewed by a Vorlen manager. A partner must not create duplicate records to obtain attribution.
5. Client terms and authority. Partners may develop employer relationships, discuss hiring needs and gather commercial information, but they must not quote, agree, accept or vary recruitment fees, payment terms, rebates, guarantees, exclusivity, candidate-ownership periods or any other contractual commitment on behalf of Vorlen. A client engagement becomes binding only when the applicable terms are approved and recorded by an authorised Vorlen manager.
6. Candidate data. Personal data may be processed only for authorised recruitment purposes, through approved Vorlen systems, with appropriate confidentiality and data-protection safeguards. Candidate data must not be exported, retained privately or reused outside authorised work.
7. Conduct. The partner must act professionally, accurately identify the Vorlen relationship, avoid misleading statements and comply with applicable recruitment, equality, privacy, anti-bribery and marketing rules.
8. Confidentiality and IP. Vorlen/client/candidate confidential information and platform materials remain protected and may be used only for the partnership.
9. Payment. Earned commission is subject to manager approval and is paid using the partner''s approved payment details. Any overpayment or commission affected by a later client refund/rebate may be reversed or offset where the underlying fee is no longer retained.
10. Termination. Vorlen may suspend or terminate access for compliance, security, misconduct or commercial reasons. Termination does not create commission on fees not actually received; valid earned commission already due remains recorded.
11. Independent status. The partner is responsible for their own tax, insurance and business obligations in their jurisdiction. Nothing creates employment, worker status, partnership in law or authority to bind Vorlen.
12. Entire operational terms. These terms work with Vorlen privacy/security policies and any written partner schedule issued by Vorlen. Material changes require a new version and acceptance.'::text
$$;

create or replace function private.initialise_partner_onboarding_impl(p_company uuid,p_partner uuid,p_specialism text default 'b2b_advisor')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_agreement uuid;
begin
 if p_specialism not in ('b2b_advisor','lead_closer','candidate_sourcer','hybrid') then raise exception 'Invalid partner specialism';end if;
 if not exists(select 1 from public.profiles p where p.id=p_partner and p.company_id=p_company and p.role='partner') then raise exception 'Partner profile is not present in this workspace';end if;
 select o.agreement_id into v_agreement from public.partner_onboarding o where o.partner_id=p_partner and o.company_id=p_company;
 if v_agreement is not null then
  insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at)
  values(p_partner,p_company,p_specialism,exists(select 1 from public.partner_onboarding o where o.partner_id=p_partner and o.company_id=p_company and o.status='active'),now())
  on conflict(user_id) do update set specialism=excluded.specialism,active=excluded.active,updated_at=excluded.updated_at;
  return v_agreement;
 end if;
 insert into public.partner_agreements(company_id,partner_id,version,commission_percent,terms_text,terms_hash)
 values(p_company,p_partner,'partner-2026-09-24',30,private.partner_agreement_terms(),encode(extensions.digest(private.partner_agreement_terms(),'sha256'),'hex'))
 returning id into v_agreement;
 insert into public.partner_onboarding(partner_id,company_id,status,agreement_id) values(p_partner,p_company,'terms_pending',v_agreement);
 insert into public.partner_profiles(user_id,company_id,specialism,active,updated_at) values(p_partner,p_company,p_specialism,false,now())
 on conflict(user_id) do update set company_id=excluded.company_id,specialism=excluded.specialism,active=false,updated_at=excluded.updated_at;
 return v_agreement;
end $$;

revoke all on function private.initialise_partner_onboarding_impl(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.initialise_partner_onboarding_impl(uuid,uuid,text) to service_role;

create or replace function public.initialise_partner_onboarding(p_partner uuid,p_specialism text default 'b2b_advisor')
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 return private.initialise_partner_onboarding_impl(v_company,p_partner,p_specialism);
end $$;
revoke all on function public.initialise_partner_onboarding(uuid,text) from public,anon;
grant execute on function public.initialise_partner_onboarding(uuid,text) to authenticated,service_role;

create or replace function public.service_initialise_partner_onboarding(p_company uuid,p_partner uuid,p_specialism text default 'b2b_advisor')
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' then raise exception 'Service role required';end if;
 return private.initialise_partner_onboarding_impl(p_company,p_partner,p_specialism);
end $$;
revoke all on function public.service_initialise_partner_onboarding(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.service_initialise_partner_onboarding(uuid,uuid,text) to service_role;

create or replace function private.partner_is_active(p_partner uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
select exists(
 select 1 from public.partner_onboarding o
 join public.partner_agreements a on a.id=o.agreement_id
 join public.profiles p on p.id=o.partner_id and p.company_id=o.company_id and p.role='partner'
 join public.partner_profiles pp on pp.user_id=o.partner_id and pp.company_id=o.company_id and pp.active
 where o.partner_id=p_partner and o.partner_id=auth.uid() and o.company_id=private.current_company_id()
   and o.status='active' and a.status='accepted' and a.accepted_at is not null
)
$$;

create or replace function private.partner_can_develop_clients(p_partner uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
select private.partner_is_active(p_partner) and exists(
 select 1 from public.partner_profiles pp where pp.user_id=p_partner and pp.company_id=private.current_company_id() and pp.active
 and pp.specialism in ('b2b_advisor','lead_closer','hybrid'))
$$;
create or replace function private.partner_can_source_candidates(p_partner uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
select private.partner_is_active(p_partner) and exists(
 select 1 from public.partner_profiles pp where pp.user_id=p_partner and pp.company_id=private.current_company_id() and pp.active
 and pp.specialism in ('candidate_sourcer','hybrid'))
$$;
revoke all on function private.partner_can_develop_clients(uuid) from public,anon,authenticated;
revoke all on function private.partner_can_source_candidates(uuid) from public,anon,authenticated;
grant execute on function private.partner_can_develop_clients(uuid) to service_role;
grant execute on function private.partner_can_source_candidates(uuid) to service_role;

create or replace function public.partner_can_develop_clients()
returns boolean language sql stable security invoker set search_path='' as $$ select private.partner_can_develop_clients(auth.uid()) $$;
create or replace function public.partner_can_source_candidates()
returns boolean language sql stable security invoker set search_path='' as $$ select private.partner_can_source_candidates(auth.uid()) $$;
revoke all on function public.partner_can_develop_clients() from public,anon;
revoke all on function public.partner_can_source_candidates() from public,anon;
grant execute on function public.partner_can_develop_clients() to authenticated,service_role;
grant execute on function public.partner_can_source_candidates() to authenticated,service_role;

create or replace function public.enforce_partner_prospect_boundary()
returns trigger language plpgsql set search_path='' as $$
declare v_manager boolean:=current_user in ('postgres','service_role') or private.is_manager();v_name text:=lower(btrim(new.company_name));v_email text:=nullif(lower(btrim(new.contact_email)),'');v_website text:=nullif(lower(regexp_replace(btrim(new.website),'/+$','')),'');
begin
 new.updated_at:=now();
 if not v_manager then
  if not private.partner_can_develop_clients() then raise exception 'Client development is not enabled for this partner profile';end if;
  if tg_op='INSERT' then new.company_id:=private.current_company_id();new.partner_id:=auth.uid();new.promoted_client_id:=null;new.reviewed_by:=null;new.reviewed_at:=null;new.manager_notes:=null;if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact') then new.status:='prospect';end if;
  else if old.company_id<>private.current_company_id() or old.partner_id<>auth.uid() then raise exception 'You may only update your own prospects';end if;if old.status in ('under_review','promoted','declined','do_not_contact') then raise exception 'This prospect is locked for Vorlen review or suppression';end if;new.company_id:=old.company_id;new.partner_id:=old.partner_id;new.promoted_client_id:=old.promoted_client_id;new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;new.manager_notes:=old.manager_notes;if new.status not in ('prospect','contacted','interested','handoff_ready','do_not_contact','under_review') then raise exception 'Partners cannot approve or promote prospects';end if;end if;
 else if new.status in ('promoted','declined') and new.reviewed_at is null then new.reviewed_at:=now();new.reviewed_by:=coalesce(new.reviewed_by,auth.uid());end if;if new.status='promoted' and new.promoted_client_id is null then raise exception 'Promoted prospect must reference the authoritative client record';end if;end if;
 if nullif(v_name,'') is null then raise exception 'Company name is required';end if;
 if new.status not in ('promoted','declined') and exists(select 1 from public.clients c where c.company_id=new.company_id and (lower(btrim(c.company_name))=v_name or (v_email is not null and lower(btrim(c.email))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(c.website),'/+$','')),'')=v_website))) then raise exception 'This company or contact already exists as a Vorlen client';end if;
 if new.status not in ('promoted','declined') and exists(select 1 from public.partner_prospects p where p.company_id=new.company_id and p.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid) and p.status<>'declined' and (lower(btrim(p.company_name))=v_name or (v_email is not null and lower(btrim(coalesce(p.contact_email,'')))=v_email) or (v_website is not null and nullif(lower(regexp_replace(btrim(p.website),'/+$','')),'')=v_website))) then raise exception 'A matching or suppressed prospect already exists in Vorlen';end if;
 return new;
end $$;

create or replace function public.enforce_partner_handoff_boundary()
returns trigger language plpgsql set search_path='' as $$
declare v_privileged boolean:=current_user in ('postgres','service_role') or private.is_manager();v_prospect public.partner_prospects%rowtype;
begin
 new.updated_at:=now();
 if v_privileged then
  if new.prospect_id is not null then select * into v_prospect from public.partner_prospects p where p.id=new.prospect_id and p.company_id=new.company_id;if v_prospect.id is null then raise exception 'Prospect not found in this workspace';end if;if new.client_id is null and v_prospect.promoted_client_id is not null then new.client_id:=v_prospect.promoted_client_id;end if;end if;
  if new.status in ('terms_approved','converted') then if new.client_id is null then raise exception 'Attach the approved client before approving commercial terms';end if;if not exists(select 1 from public.client_contracts cc where cc.company_id=new.company_id and cc.client_id=new.client_id and cc.status='active') then raise exception 'An active Vorlen client contract is required before commercial terms can be approved';end if;if new.approved_at is null then new.approved_at:=now();new.approved_by:=coalesce(new.approved_by,auth.uid());end if;end if;
  if new.status='converted' then if new.approved_job_id is null then raise exception 'A live vacancy must be linked before a handoff can be converted';end if;if not exists(select 1 from public.jobs j where j.id=new.approved_job_id and j.company_id=new.company_id and j.client_id=new.client_id) then raise exception 'The linked vacancy must belong to the approved client';end if;end if;
  return new;
 end if;
 if not private.partner_can_develop_clients() then raise exception 'Commercial handoffs are not enabled for this partner profile';end if;
 if tg_op='INSERT' then new.company_id:=private.current_company_id();new.partner_id:=auth.uid();new.manager_notes:=null;new.approved_by:=null;new.approved_at:=null;new.approved_job_id:=null;if new.status not in ('draft','submitted') then new.status:='draft';end if;
 else if old.partner_id<>auth.uid() or old.company_id<>private.current_company_id() then raise exception 'You may only update your own commercial handoffs';end if;if old.status<>'draft' then raise exception 'Submitted handoffs are locked while Vorlen reviews them';end if;new.company_id:=old.company_id;new.partner_id:=old.partner_id;new.manager_notes:=old.manager_notes;new.approved_by:=old.approved_by;new.approved_at:=old.approved_at;new.approved_job_id:=old.approved_job_id;if new.status not in ('draft','submitted') then raise exception 'Partners can only save a draft or submit for Vorlen review';end if;end if;
 if new.client_id is not null and new.prospect_id is not null then raise exception 'Choose either an assigned client or a partner prospect, not both';end if;
 if new.client_id is not null and not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.client_id=new.client_id and a.completed_at is null) then raise exception 'The selected client is not assigned to your partner portfolio';end if;
 if new.prospect_id is not null then select * into v_prospect from public.partner_prospects p where p.id=new.prospect_id and p.company_id=new.company_id and p.partner_id=auth.uid() and p.status not in ('declined','do_not_contact');if v_prospect.id is null then raise exception 'The selected prospect is not available in your portfolio';end if;new.prospect_company:=v_prospect.company_name;new.contact_name:=v_prospect.contact_name;new.contact_email:=v_prospect.contact_email;new.contact_phone:=v_prospect.contact_phone;end if;
 return new;
end $$;

create or replace function private.enforce_partner_assignment_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_partner_company uuid;v_specialism text;v_active boolean;
begin
 select p.company_id,pp.specialism,(o.status='active' and pp.active) into v_partner_company,v_specialism,v_active
 from public.profiles p join public.partner_profiles pp on pp.user_id=p.id and pp.company_id=p.company_id join public.partner_onboarding o on o.partner_id=p.id and o.company_id=p.company_id
 where p.id=new.partner_id and p.role='partner';
 if v_partner_company is null or v_partner_company<>new.company_id then raise exception 'Partner assignment must belong to the same workspace as the partner';end if;
 if new.client_id is not null and not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Assigned client must belong to the same workspace';end if;
 if new.candidate_id is not null and not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then raise exception 'Assigned candidate must belong to the same workspace';end if;
 if new.job_id is not null and not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id) then raise exception 'Assigned vacancy must belong to the same workspace';end if;
 if new.completed_at is null then
  if not coalesce(v_active,false) then raise exception 'Only active partners can receive active assignments';end if;
  if new.client_id is not null and v_specialism not in ('b2b_advisor','lead_closer','hybrid') then raise exception 'Client assignments are not enabled for this partner specialism';end if;
  if new.candidate_id is not null then if v_specialism not in ('candidate_sourcer','hybrid') then raise exception 'Candidate assignments are not enabled for this partner specialism';end if;if not public.candidate_processing_allowed(new.company_id) then raise exception 'Candidate processing is not active';end if;end if;
 end if;
 return new;
end $$;
