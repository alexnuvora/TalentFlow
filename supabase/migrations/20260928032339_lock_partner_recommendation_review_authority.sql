create or replace function private.enforce_partner_candidate_recommendation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_terms timestamptz;
  v_resume text;
  v_manager boolean:=private.is_manager();
begin
  if not v_manager then
    if tg_op='INSERT' and new.manager_status in ('approved','declined') then
      raise exception 'Only Vorlen management can approve or decline candidate recommendations';
    end if;
    if tg_op='UPDATE'
       and new.manager_status in ('approved','declined')
       and new.manager_status is distinct from old.manager_status then
      raise exception 'Only Vorlen management can approve or decline candidate recommendations';
    end if;
    if tg_op='UPDATE' then
      new.reviewed_by:=old.reviewed_by;
      new.reviewed_at:=old.reviewed_at;
    else
      new.reviewed_by:=null;
      new.reviewed_at:=null;
    end if;
  end if;
  if new.stage='recommended' then
    select c.work_seeker_terms_agreed_at,c.resume_path into v_terms,v_resume
    from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id and c.erased_at is null;
    if v_terms is null then raise exception 'Work-seeker terms must be evidenced before recommendation'; end if;
    if coalesce(trim(v_resume),'')='' then raise exception 'A candidate-provided or authorised CV is required before recommendation'; end if;
    if new.manager_status='none' then
      new.manager_status:='pending';new.manager_notes:=null;new.reviewed_by:=null;new.reviewed_at:=null;
    end if;
  end if;
  if tg_op='UPDATE' and old.manager_status in ('approved','declined') and not v_manager
     and (new.stage is distinct from old.stage or new.manager_status is distinct from old.manager_status or new.candidate_id is distinct from old.candidate_id or new.job_id is distinct from old.job_id) then
    raise exception 'Reviewed recommendations are locked for partner edits';
  end if;
  return new;
end
$$;
revoke all on function private.enforce_partner_candidate_recommendation() from public,anon,authenticated;