create or replace function public.review_partner_submission_pack(
  p_pack uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_pack public.partner_submission_packs%rowtype;
  v_submission uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_status not in ('approved','declined') then raise exception 'Status must be approved or declined'; end if;

  select * into v_pack
  from public.partner_submission_packs
  where id=p_pack and company_id=v_company and status='requested'
  for update;

  if not found then raise exception 'Pending submission pack not found'; end if;

  update public.partner_submission_packs
  set status=p_status,
      manager_notes=nullif(btrim(coalesce(p_notes,'')),''),
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      updated_at=now()
  where id=v_pack.id;

  if p_status='declined' then return; end if;

  select s.id into v_submission
  from public.candidate_submissions s
  where s.company_id=v_company
    and s.client_id=v_pack.client_id
    and s.job_id=v_pack.job_id
    and s.candidate_id=v_pack.candidate_id
    and s.status<>'withdrawn'
  order by s.created_at desc
  limit 1
  for update;

  if v_submission is null then
    insert into public.candidate_submissions(
      company_id,client_id,job_id,candidate_id,submitted_by,
      headline,recruiter_summary,key_strengths,concerns,status
    )
    values(
      v_company,v_pack.client_id,v_pack.job_id,v_pack.candidate_id,v_pack.partner_id,
      v_pack.headline,v_pack.summary,v_pack.strengths,v_pack.concerns,'approved_to_send'
    )
    returning id into v_submission;
  end if;

  update public.partner_submission_packs
  set candidate_submission_id=v_submission,updated_at=now()
  where id=v_pack.id;
end
$$;

revoke all on function public.review_partner_submission_pack(uuid,text,text) from public,anon;
grant execute on function public.review_partner_submission_pack(uuid,text,text) to authenticated;
