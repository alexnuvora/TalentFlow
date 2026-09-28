create or replace function public.partner_create_submission_pack(
  p_job uuid,
  p_candidate uuid,
  p_summary text,
  p_headline text default null::text,
  p_strengths jsonb default '[]'::jsonb,
  p_concerns jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_client uuid;
  v_id uuid;
  v_existing public.partner_submission_packs%rowtype;
begin
  if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
  select j.client_id into v_client from public.jobs j join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id where j.id=p_job and j.company_id=v_company and a.partner_id=auth.uid() and a.completed_at is null;
  if v_client is null then raise exception 'Assigned vacancy required'; end if;
  if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Assigned candidate required'; end if;
  if not exists(select 1 from public.partner_candidate_pipeline pcp where pcp.company_id=v_company and pcp.partner_id=auth.uid() and pcp.job_id=p_job and pcp.candidate_id=p_candidate and pcp.stage='recommended' and pcp.manager_status='approved') then raise exception 'Vorlen recommendation approval is required before creating a client submission pack'; end if;
  if not exists(select 1 from public.candidates c where c.id=p_candidate and c.company_id=v_company and c.erased_at is null and c.work_seeker_terms_agreed_at is not null and coalesce(trim(c.resume_path),'')<>'') then raise exception 'Candidate terms and an authorised CV are required before creating a submission pack'; end if;
  if length(btrim(coalesce(p_summary,'')))<20 then raise exception 'Provide a meaningful recruiter summary of at least 20 characters'; end if;
  if jsonb_typeof(coalesce(p_strengths,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_concerns,'[]'::jsonb))<>'array' then raise exception 'Strengths and concerns must be arrays'; end if;
  select * into v_existing from public.partner_submission_packs where partner_id=auth.uid() and job_id=p_job and candidate_id=p_candidate for update;
  if found and (v_existing.status='submitted' or v_existing.candidate_submission_id is not null) then raise exception 'This candidate has already progressed into the official client submission workflow and the partner pack is locked'; end if;
  if found then
    update public.partner_submission_packs set headline=nullif(left(btrim(coalesce(p_headline,'')),500),''),summary=left(btrim(p_summary),10000),strengths=p_strengths,concerns=p_concerns,status='requested',manager_notes=null,reviewed_by=null,reviewed_at=null,updated_at=now() where id=v_existing.id returning id into v_id;
  else
    insert into public.partner_submission_packs(company_id,partner_id,client_id,job_id,candidate_id,headline,summary,strengths,concerns,status)
    values(v_company,auth.uid(),v_client,p_job,p_candidate,nullif(left(btrim(coalesce(p_headline,'')),500),''),left(btrim(p_summary),10000),p_strengths,p_concerns,'requested') returning id into v_id;
  end if;
  return v_id;
end
$$;