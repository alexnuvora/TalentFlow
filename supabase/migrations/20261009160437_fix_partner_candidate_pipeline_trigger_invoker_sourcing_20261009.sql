-- Keep the partner candidate pipeline trigger invoker-safe; do not grant external callers
-- EXECUTE on a private sourcing helper. Preserve manager and candidate evidence gates.
CREATE OR REPLACE FUNCTION public.enforce_partner_candidate_pipeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_manager boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
 new.updated_at := now();
 if v_manager then
  if tg_op='UPDATE' and new.manager_status is distinct from old.manager_status then
   new.reviewed_at := now();
   new.reviewed_by := coalesce(auth.uid(),new.reviewed_by);
  end if;
  return new;
 end if;
 if not private.partner_is_active() then raise exception 'Active partner access required'; end if;
 if not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate sourcing is not enabled for this partner profile'; end if;
 if not public.candidate_processing_allowed(private.current_company_id()) then raise exception 'Candidate processing is not active'; end if;
 if tg_op='INSERT' then
  new.company_id := private.current_company_id();
  new.partner_id := auth.uid();
  new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
  new.manager_notes := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
 else
  if old.partner_id <> auth.uid() or old.company_id <> private.current_company_id() then raise exception 'You may only update your own candidate pipeline'; end if;
  new.company_id := old.company_id;
  new.partner_id := old.partner_id;
  new.candidate_id := old.candidate_id;
  new.job_id := old.job_id;
  new.manager_notes := old.manager_notes;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  if old.manager_status in ('approved','declined') then raise exception 'This recommendation has been reviewed by Vorlen and is locked'; end if;
  new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
 end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.candidate_id=new.candidate_id and a.completed_at is null) then raise exception 'Candidate is not assigned to your partner portfolio'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.job_id=new.job_id and a.completed_at is null) then raise exception 'Vacancy is not assigned to your partner portfolio'; end if;
 if not exists(
  select 1 from public.jobs j
  where j.id=new.job_id and j.company_id=new.company_id
   and ((j.partner_sourcing_state='internal_sourcing_approved' and j.status='draft')
     or (j.partner_sourcing_state='published' and j.status='published'))
 ) then
  raise exception 'This vacancy is a research opportunity. Vorlen management must approve internal sourcing before candidates can be added.';
 end if;
 if new.stage='recommended' and not exists(
  select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id
  and c.work_seeker_terms_agreed_at is not null
  and nullif(btrim(c.work_seeker_terms_evidence),'') is not null
 ) then raise exception 'Candidate work-seeker terms evidence is required before recommendation'; end if;
 return new;
end
$function$
;
