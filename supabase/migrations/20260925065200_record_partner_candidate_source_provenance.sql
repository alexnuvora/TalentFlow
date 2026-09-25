
create or replace function private.source_partner_candidate_impl(
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_location text default null,
  p_linkedin_url text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_company uuid;
  v_id uuid;
  v_specialism text;
  v_source_url text:=nullif(btrim(coalesce(p_linkedin_url,'')),'');
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select p.company_id into v_company
  from public.profiles p
  where p.id=v_user and p.role='partner';

  if v_company is null or not private.partner_is_active(v_user) then
    raise exception 'Active partner access required';
  end if;
  if not public.candidate_processing_allowed(v_company) then
    raise exception 'Candidate processing is not active';
  end if;

  select pp.specialism into v_specialism
  from public.partner_profiles pp
  where pp.user_id=v_user and pp.company_id=v_company and pp.active;

  if coalesce(v_specialism,'') not in ('candidate_sourcer','hybrid') then
    raise exception 'Candidate sourcing is not enabled for this partner profile';
  end if;
  if nullif(btrim(p_full_name),'') is null or nullif(btrim(p_email),'') is null then
    raise exception 'Candidate name and email are required';
  end if;

  begin
    insert into public.candidates(
      company_id,full_name,email,phone,location,linkedin_url,stage,source,lawful_basis
    )
    values(
      v_company,btrim(p_full_name),lower(btrim(p_email)),nullif(btrim(p_phone),''),
      nullif(btrim(p_location),''),v_source_url,'new','partner_sourced','legitimate_interests'
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A candidate with this email already exists in Vorlen. Ask a manager to assign the existing candidate instead of creating a duplicate.';
  end;

  insert into public.partner_assignments(company_id,partner_id,candidate_id,priority,objective)
  values(v_company,v_user,v_id,'normal','Source and progress candidate');

  insert into public.partner_attributions(
    company_id,partner_id,candidate_id,attribution_type,evidence,attributed_by
  )
  values(
    v_company,v_user,v_id,'candidate_originator',
    case when v_source_url is not null
      then 'Candidate created through partner sourcing workflow with source profile recorded'
      else 'Candidate created through partner sourcing workflow'
    end,
    v_user
  );

  insert into public.candidate_source_records(
    company_id,candidate_id,provider,source_url,metadata,imported_by
  )
  values(
    v_company,v_id,
    case when v_source_url is not null and lower(v_source_url) like '%linkedin.com/%' then 'linkedin' else 'partner_manual' end,
    v_source_url,
    jsonb_build_object('origin','partner_sourcing_form','partner_id',v_user),
    v_user
  );

  return v_id;
end
$$;
