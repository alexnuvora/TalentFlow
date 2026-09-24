create or replace function private.accept_partner_agreement_impl(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void language plpgsql security definer set search_path=''
as $$
declare v_hash text;v_user uuid:=auth.uid();v_company uuid;
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
  update public.partner_agreements
  set status='accepted',accepted_at=now(),accepted_name=btrim(p_accepted_name),
      terms_hash=v_hash,accepted_terms_hash=v_hash,accepted_user_agent=left(p_user_agent,500)
  where id=p_agreement and partner_id=v_user and status='pending';
  update public.partner_onboarding
  set status='details_pending',agreement_id=p_agreement,updated_at=now()
  where partner_id=v_user and company_id=v_company and status='terms_pending';
  if not found then raise exception 'Partner onboarding record is not ready for agreement acceptance'; end if;
end $$;

revoke all on function private.accept_partner_agreement_impl(uuid,text,text) from public,anon;
grant execute on function private.accept_partner_agreement_impl(uuid,text,text) to authenticated,service_role;

create or replace function public.accept_partner_agreement(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void language plpgsql security invoker set search_path=''
as $$begin perform private.accept_partner_agreement_impl(p_agreement,p_accepted_name,p_user_agent);end$$;

revoke all on function public.accept_partner_agreement(uuid,text,text) from public,anon;
grant execute on function public.accept_partner_agreement(uuid,text,text) to authenticated,service_role;

create or replace function private.source_partner_candidate_impl(
  p_full_name text,p_email text,p_phone text default null,p_location text default null,p_linkedin_url text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_company uuid;v_id uuid;v_specialism text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
  if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required'; end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
  select pp.specialism into v_specialism from public.partner_profiles pp where pp.user_id=v_user and pp.company_id=v_company and pp.active;
  if coalesce(v_specialism,'') not in ('candidate_sourcer','hybrid') then raise exception 'Candidate sourcing is not enabled for this partner profile'; end if;
  if nullif(btrim(p_full_name),'') is null or nullif(btrim(p_email),'') is null then raise exception 'Candidate name and email are required'; end if;
  begin
    insert into public.candidates(company_id,full_name,email,phone,location,linkedin_url,stage,source,lawful_basis)
    values(v_company,btrim(p_full_name),lower(btrim(p_email)),nullif(btrim(p_phone),''),nullif(btrim(p_location),''),nullif(btrim(p_linkedin_url),''),'new','partner_sourced','legitimate_interests')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A candidate with this email already exists in Vorlen. Ask a manager to assign the existing candidate instead of creating a duplicate.';
  end;
  insert into public.partner_assignments(company_id,partner_id,candidate_id,priority,objective)
  values(v_company,v_user,v_id,'normal','Source and progress candidate');
  return v_id;
end $$;

revoke all on function private.source_partner_candidate_impl(text,text,text,text,text) from public,anon;
grant execute on function private.source_partner_candidate_impl(text,text,text,text,text) to authenticated,service_role;

create or replace function public.source_partner_candidate(
  p_full_name text,p_email text,p_phone text default null,p_location text default null,p_linkedin_url text default null
) returns uuid language plpgsql security invoker set search_path=''
as $$begin return private.source_partner_candidate_impl(p_full_name,p_email,p_phone,p_location,p_linkedin_url);end$$;

revoke all on function public.source_partner_candidate(text,text,text,text,text) from public,anon;
grant execute on function public.source_partner_candidate(text,text,text,text,text) to authenticated,service_role;
