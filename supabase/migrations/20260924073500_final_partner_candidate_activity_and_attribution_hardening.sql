drop policy if exists "candidates authorised insert" on public.candidates;
create policy "candidates managers insert" on public.candidates for insert to authenticated
with check (candidate_processing_allowed(company_id) and company_id=private.current_company_id() and private.has_candidate_data_access());

drop policy if exists "candidates authorised update" on public.candidates;
create policy "candidates managers update" on public.candidates for update to authenticated
using (candidate_processing_allowed(company_id) and company_id=private.current_company_id() and private.has_candidate_data_access())
with check (candidate_processing_allowed(company_id) and company_id=private.current_company_id() and private.has_candidate_data_access());

create or replace function private.record_partner_candidate_terms_impl(p_candidate uuid,p_terms_version text,p_evidence text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_company uuid;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
 if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active';end if;
 if nullif(btrim(p_terms_version),'') is null or nullif(btrim(p_evidence),'') is null then raise exception 'Terms version and evidence are required';end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=v_user and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Candidate is not assigned to your partner portfolio';end if;
 update public.candidates set work_seeker_terms_version=btrim(p_terms_version),work_seeker_terms_agreed_at=now(),work_seeker_terms_evidence=btrim(p_evidence) where id=p_candidate and company_id=v_company;
 if not found then raise exception 'Candidate not found';end if;
end $$;
revoke all on function private.record_partner_candidate_terms_impl(uuid,text,text) from public,anon;
grant execute on function private.record_partner_candidate_terms_impl(uuid,text,text) to authenticated,service_role;

create or replace function public.record_partner_candidate_terms(p_candidate uuid,p_terms_version text,p_evidence text)
returns void language plpgsql security invoker set search_path='' as $$
begin perform private.record_partner_candidate_terms_impl(p_candidate,p_terms_version,p_evidence);end $$;
revoke all on function public.record_partner_candidate_terms(uuid,text,text) from public,anon;
grant execute on function public.record_partner_candidate_terms(uuid,text,text) to authenticated,service_role;

drop policy if exists "partner activity assigned client" on public.partner_client_activity;
create policy "partner activity assigned client select" on public.partner_client_activity for select to authenticated using (
 company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=auth.uid() and a.client_id=partner_client_activity.client_id and a.completed_at is null))));
create policy "partner activity assigned client insert" on public.partner_client_activity for insert to authenticated with check (
 company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=auth.uid() and a.client_id=partner_client_activity.client_id and a.completed_at is null))));
create policy "partner activity assigned client update" on public.partner_client_activity for update to authenticated using (
 company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=auth.uid() and a.client_id=partner_client_activity.client_id and a.completed_at is null))))
with check (
 company_id=private.current_company_id() and (private.is_manager() or (partner_id=auth.uid() and private.partner_is_active() and exists(select 1 from public.partner_assignments a where a.company_id=partner_client_activity.company_id and a.partner_id=auth.uid() and a.client_id=partner_client_activity.client_id and a.completed_at is null))));
create policy "partner activity managers delete" on public.partner_client_activity for delete to authenticated using (company_id=private.current_company_id() and private.is_manager());

create or replace function private.source_partner_candidate_impl(p_full_name text,p_email text,p_phone text default null,p_location text default null,p_linkedin_url text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_company uuid;v_id uuid;v_specialism text;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
 if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required';end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active';end if;
 select pp.specialism into v_specialism from public.partner_profiles pp where pp.user_id=v_user and pp.company_id=v_company and pp.active;
 if coalesce(v_specialism,'') not in ('candidate_sourcer','hybrid') then raise exception 'Candidate sourcing is not enabled for this partner profile';end if;
 if nullif(btrim(p_full_name),'') is null or nullif(btrim(p_email),'') is null then raise exception 'Candidate name and email are required';end if;
 begin
  insert into public.candidates(company_id,full_name,email,phone,location,linkedin_url,stage,source,lawful_basis)
  values(v_company,btrim(p_full_name),lower(btrim(p_email)),nullif(btrim(p_phone),''),nullif(btrim(p_location),''),nullif(btrim(p_linkedin_url),''),'new','partner_sourced','legitimate_interests')
  returning id into v_id;
 exception when unique_violation then raise exception 'A candidate with this email already exists in Vorlen. Ask a manager to assign the existing candidate instead of creating a duplicate.';end;
 insert into public.partner_assignments(company_id,partner_id,candidate_id,priority,objective) values(v_company,v_user,v_id,'normal','Source and progress candidate');
 insert into public.partner_attributions(company_id,partner_id,candidate_id,attribution_type,evidence,attributed_by)
 values(v_company,v_user,v_id,'candidate_originator','Candidate created through partner sourcing workflow',v_user);
 return v_id;
end $$;

create or replace function private.promote_partner_prospect_impl(p_prospect uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_partner uuid;v_client uuid;v_prospect public.partner_prospects%rowtype;
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 select * into v_prospect from public.partner_prospects p where p.id=p_prospect and p.company_id=v_company and p.status='under_review' for update;
 if v_prospect.id is null then raise exception 'Prospect must be in Vorlen review before promotion';end if;
 if nullif(btrim(v_prospect.contact_name),'') is null then raise exception 'A real contact name is required before promotion';end if;
 if nullif(btrim(v_prospect.contact_email),'') is null then raise exception 'A real contact email is required before promotion';end if;
 if exists(select 1 from public.clients c where c.company_id=v_company and (lower(btrim(c.company_name))=lower(btrim(v_prospect.company_name)) or lower(btrim(c.email))=lower(btrim(v_prospect.contact_email)))) then raise exception 'A matching client already exists. Resolve this prospect to the existing client instead of creating a duplicate.';end if;
 insert into public.clients(company_id,company_name,contact_name,email,phone,website,status,business_nature)
 values(v_company,v_prospect.company_name,btrim(v_prospect.contact_name),lower(btrim(v_prospect.contact_email)),v_prospect.contact_phone,v_prospect.website,'prospect',v_prospect.business_nature) returning id into v_client;
 v_partner:=v_prospect.partner_id;
 update public.partner_prospects set status='promoted',promoted_client_id=v_client,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=v_prospect.id;
 insert into public.partner_assignments(company_id,partner_id,client_id,priority,objective) values(v_company,v_partner,v_client,'high','Develop promoted prospect into an approved Vorlen client');
 insert into public.partner_attributions(company_id,partner_id,client_id,attribution_type,evidence,attributed_by)
 values(v_company,v_partner,v_client,'client_originator','Client promoted from partner prospect '||v_prospect.id::text,auth.uid());
 update public.partner_commercial_handoffs set client_id=v_client,prospect_id=coalesce(prospect_id,v_prospect.id),updated_at=now()
 where company_id=v_company and partner_id=v_partner and client_id is null and status in ('draft','submitted','under_review') and (prospect_id=v_prospect.id or lower(btrim(coalesce(prospect_company,'')))=lower(btrim(v_prospect.company_name)));
 return v_client;
end $$;

create or replace function private.resolve_partner_prospect_existing_client_impl(p_prospect uuid,p_client uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_partner uuid;v_prospect public.partner_prospects%rowtype;v_existing_partner uuid;
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 select * into v_prospect from public.partner_prospects p where p.id=p_prospect and p.company_id=v_company and p.status='under_review' for update;
 if v_prospect.id is null then raise exception 'Prospect must be in Vorlen review before resolution';end if;
 if not exists(select 1 from public.clients c where c.id=p_client and c.company_id=v_company) then raise exception 'Existing client not found in this workspace';end if;
 v_partner:=v_prospect.partner_id;
 select a.partner_id into v_existing_partner from public.partner_attributions a where a.company_id=v_company and a.client_id=p_client and a.attribution_type='client_originator' and a.status='active' limit 1;
 if v_existing_partner is not null and v_existing_partner<>v_partner then raise exception 'This client already has a different active partner originator. Resolve attribution before linking this prospect.';end if;
 if v_existing_partner is null then insert into public.partner_attributions(company_id,partner_id,client_id,attribution_type,evidence,attributed_by) values(v_company,v_partner,p_client,'client_originator','Existing client matched to partner prospect '||v_prospect.id::text,auth.uid());end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=v_partner and a.client_id=p_client and a.completed_at is null) then insert into public.partner_assignments(company_id,partner_id,client_id,priority,objective) values(v_company,v_partner,p_client,'high','Develop resolved partner prospect');end if;
 update public.partner_prospects set status='promoted',promoted_client_id=p_client,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=v_prospect.id;
 update public.partner_commercial_handoffs set client_id=p_client,prospect_id=coalesce(prospect_id,v_prospect.id),updated_at=now()
 where company_id=v_company and partner_id=v_partner and client_id is null and status in ('draft','submitted','under_review') and (prospect_id=v_prospect.id or lower(btrim(coalesce(prospect_company,'')))=lower(btrim(v_prospect.company_name)));
 return p_client;
end $$;
revoke all on function private.resolve_partner_prospect_existing_client_impl(uuid,uuid) from public,anon;
grant execute on function private.resolve_partner_prospect_existing_client_impl(uuid,uuid) to authenticated,service_role;
create or replace function public.resolve_partner_prospect_existing_client(p_prospect uuid,p_client uuid)
returns uuid language plpgsql security invoker set search_path='' as $$begin return private.resolve_partner_prospect_existing_client_impl(p_prospect,p_client);end$$;
revoke all on function public.resolve_partner_prospect_existing_client(uuid,uuid) from public,anon;
grant execute on function public.resolve_partner_prospect_existing_client(uuid,uuid) to authenticated,service_role;

create or replace function public.link_partner_handoff_job(p_handoff uuid,p_job uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_partner uuid;v_client uuid;v_job_client uuid;v_existing_partner uuid;
begin
 if not private.is_manager() then raise exception 'Manager access required';end if;
 select h.partner_id,h.client_id into v_partner,v_client from public.partner_commercial_handoffs h where h.id=p_handoff and h.company_id=v_company and h.status='terms_approved' for update;
 if v_partner is null then raise exception 'Approved handoff not found';end if;
 if v_client is null then raise exception 'Attach the approved client before linking a vacancy';end if;
 select j.client_id into v_job_client from public.jobs j where j.id=p_job and j.company_id=v_company;
 if v_job_client is null then raise exception 'Vacancy not found in this workspace';end if;
 if v_job_client<>v_client then raise exception 'The selected vacancy belongs to a different client';end if;
 select a.partner_id into v_existing_partner from public.partner_attributions a where a.company_id=v_company and a.job_id=p_job and a.attribution_type='vacancy_originator' and a.status='active' limit 1;
 if v_existing_partner is not null and v_existing_partner<>v_partner then raise exception 'This vacancy already has a different active partner originator';end if;
 update public.partner_commercial_handoffs set status='converted',approved_job_id=p_job,approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now() where id=p_handoff;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=v_partner and a.job_id=p_job and a.completed_at is null) then insert into public.partner_assignments(company_id,partner_id,job_id,priority,objective) values(v_company,v_partner,p_job,'high','Deliver approved Vorlen vacancy');end if;
 if v_existing_partner is null then insert into public.partner_attributions(company_id,partner_id,job_id,attribution_type,evidence,attributed_by) values(v_company,v_partner,p_job,'vacancy_originator','Vacancy linked from approved partner commercial handoff '||p_handoff::text,auth.uid());end if;
end $$;
