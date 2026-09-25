
create or replace function private.client_portal_action(
  p_submission_id uuid,
  p_action text,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.profiles%rowtype;
  s public.candidate_submissions%rowtype;
  ns text;
  ast text;
  decision text;
begin
  select * into p
  from public.profiles
  where id=auth.uid() and role='viewer' and client_id is not null;
  if not found then raise exception 'Client access required'; end if;

  if not public.workspace_feature_enabled(p.company_id,'client_portal') then
    raise exception 'This feature requires an active subscription that includes it';
  end if;

  select * into s
  from public.candidate_submissions
  where id=p_submission_id
    and company_id=p.company_id
    and client_id=p.client_id
  for update;
  if not found then raise exception 'Submission not found'; end if;

  if s.status in ('withdrawn','rejected') and p_action<>'reject' then
    raise exception 'This submission is no longer available for progression';
  end if;

  ns:=case p_action
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'request_interview' then 'interview_requested'
  end;
  ast:=case p_action
    when 'approve' then 'client_approved'
    when 'reject' then 'rejected'
    when 'request_interview' then 'interview_requested'
  end;
  decision:=case p_action
    when 'approve' then 'approve'
    when 'reject' then 'reject'
    when 'request_interview' then 'request_interview'
  end;
  if ns is null then raise exception 'Invalid action'; end if;

  update public.candidate_submissions
  set status=ns,
      client_decision=decision,
      client_decision_at=now(),
      client_feedback=nullif(left(trim(coalesce(p_feedback,'')),5000),''),
      client_feedback_at=case when nullif(trim(coalesce(p_feedback,'')),'') is not null then now() else client_feedback_at end,
      reviewed_at=now(),
      updated_at=now()
  where id=s.id;

  if s.application_id is not null then
    update public.applications
    set status=ast
    where id=s.application_id and company_id=p.company_id;
  end if;

  insert into public.partner_communication_events(
    company_id,partner_id,client_id,candidate_id,job_id,event_type,channel,direction,subject,summary,metadata
  )
  values(
    s.company_id,null,s.client_id,s.candidate_id,s.job_id,'portal','portal','inbound',
    'Client candidate decision',
    case decision
      when 'approve' then 'Client approved the candidate for progression.'
      when 'reject' then 'Client decided not to progress the candidate.'
      else 'Client requested an interview with the candidate.'
    end
    || case when nullif(trim(coalesce(p_feedback,'')),'') is not null
       then ' Feedback: '||left(trim(p_feedback),5000) else '' end,
    jsonb_build_object('submission_id',s.id,'action',decision)
  );

  return jsonb_build_object('ok',true,'status',ns,'client_decision',decision);
end
$$;
