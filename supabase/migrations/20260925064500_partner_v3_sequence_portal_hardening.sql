
-- Partner platform v3 production hardening:
-- sequence lifecycle, suppression safety, portal collaboration timeline, and native integration state.

create or replace function public.sync_partner_outreach_enrollment_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_enrollment uuid:=coalesce(new.outreach_enrollment_id,old.outreach_enrollment_id);
  v_status text;
  v_next_step integer;
  v_next_at timestamptz;
  v_total integer;
begin
  if v_enrollment is null then return coalesce(new,old); end if;

  select status into v_status
  from public.partner_outreach_enrollments
  where id=v_enrollment
  for update;

  if not found then return coalesce(new,old); end if;
  if v_status in ('stopped_reply','cancelled') then return coalesce(new,old); end if;

  select min(t.outreach_step_index),min(t.due_at),count(*)
  into v_next_step,v_next_at,v_total
  from public.partner_tasks t
  where t.outreach_enrollment_id=v_enrollment
    and t.status not in ('done','cancelled');

  if v_total=0 then
    update public.partner_outreach_enrollments
    set status='completed',
        current_step=coalesce((select max(t.outreach_step_index)+1 from public.partner_tasks t where t.outreach_enrollment_id=v_enrollment),current_step),
        next_step_at=null,
        completed_at=coalesce(completed_at,now()),
        updated_at=now()
    where id=v_enrollment and status in ('active','paused','completed');
  else
    update public.partner_outreach_enrollments
    set status=case when status='completed' then 'active' else status end,
        current_step=coalesce(v_next_step,current_step),
        next_step_at=v_next_at,
        completed_at=case when status='completed' then null else completed_at end,
        updated_at=now()
    where id=v_enrollment and status in ('active','paused','completed');
  end if;

  return coalesce(new,old);
end
$$;

drop trigger if exists trg_sync_partner_outreach_enrollment_progress on public.partner_tasks;
create trigger trg_sync_partner_outreach_enrollment_progress
after insert or update of status,due_at,outreach_enrollment_id or delete
on public.partner_tasks
for each row execute function public.sync_partner_outreach_enrollment_progress();

revoke all on function public.sync_partner_outreach_enrollment_progress()
from public,anon,authenticated;

create or replace function public.cancel_partner_outreach_on_dnc()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if new.status='do_not_contact' and (tg_op='INSERT' or old.status is distinct from new.status) then
   update public.partner_outreach_enrollments
   set status='cancelled',completed_at=coalesce(completed_at,now()),next_step_at=null,updated_at=now()
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status in ('active','paused','completed');

   update public.partner_tasks
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status not in ('done','cancelled');

   update public.partner_client_sequences
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status in ('active','completed');
 end if;
 return new;
end
$$;

create or replace function public.cancel_partner_work_on_client_unassignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if old.client_id is not null
    and old.completed_at is null
    and new.completed_at is not null
    and not exists(
      select 1 from public.partner_assignments a
      where a.company_id=new.company_id
        and a.partner_id=new.partner_id
        and a.client_id=new.client_id
        and a.completed_at is null
        and a.id<>new.id
    ) then

   update public.partner_outreach_enrollments
   set status='cancelled',completed_at=coalesce(completed_at,now()),next_step_at=null,updated_at=now()
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status in ('active','paused','completed');

   update public.partner_tasks
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status not in ('done','cancelled');

   update public.partner_client_sequences
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where company_id=new.company_id
     and partner_id=new.partner_id
     and client_id=new.client_id
     and status in ('active','completed');
 end if;
 return new;
end
$$;

create or replace function public.cancel_partner_outreach_on_suppression()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.partner_outreach_enrollments e
  set status='cancelled',completed_at=coalesce(e.completed_at,now()),next_step_at=null,updated_at=now()
  where e.company_id=new.company_id
    and e.status in ('active','paused','completed')
    and exists(
      select 1
      from public.clients c
      where c.id=e.client_id
        and c.company_id=new.company_id
        and (
          (new.client_id is not null and c.id=new.client_id)
          or (new.email_normalized is not null and lower(btrim(coalesce(c.email,'')))=new.email_normalized)
          or (new.phone_normalized is not null and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=new.phone_normalized)
        )
    );

  update public.partner_tasks t
  set status='cancelled',completed_at=coalesce(t.completed_at,now())
  where t.company_id=new.company_id
    and t.client_id is not null
    and t.status not in ('done','cancelled')
    and exists(
      select 1 from public.clients c
      where c.id=t.client_id and c.company_id=new.company_id
        and (
          (new.client_id is not null and c.id=new.client_id)
          or (new.email_normalized is not null and lower(btrim(coalesce(c.email,'')))=new.email_normalized)
          or (new.phone_normalized is not null and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=new.phone_normalized)
        )
    );

  update public.partner_client_sequences s
  set status='cancelled',completed_at=coalesce(s.completed_at,now())
  where s.company_id=new.company_id
    and s.status in ('active','completed')
    and exists(
      select 1 from public.clients c
      where c.id=s.client_id and c.company_id=new.company_id
        and (
          (new.client_id is not null and c.id=new.client_id)
          or (new.email_normalized is not null and lower(btrim(coalesce(c.email,'')))=new.email_normalized)
          or (new.phone_normalized is not null and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=new.phone_normalized)
        )
    );

  return new;
end
$$;

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
  select * into p from public.profiles
  where id=auth.uid() and role='viewer' and client_id is not null;
  if not found then raise exception 'Client access required'; end if;
  if not public.workspace_feature_enabled(p.company_id,'client_portal') then
    raise exception 'This feature requires an active subscription that includes it';
  end if;

  select * into s
  from public.candidate_submissions
  where id=p_submission_id and company_id=p.company_id and client_id=p.client_id
  for update;
  if not found then raise exception 'Submission not found'; end if;

  ns:=case p_action
    when 'approve' then 'client_approved'
    when 'reject' then 'client_rejected'
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
    end || case when nullif(trim(coalesce(p_feedback,'')),'') is not null then ' Feedback: '||left(trim(p_feedback),5000) else '' end,
    jsonb_build_object('submission_id',s.id,'action',decision)
  );

  return jsonb_build_object('ok',true,'status',ns,'client_decision',decision);
end
$$;

create or replace function public.client_create_vacancy_request(
  p_title text,
  p_hiring_need text,
  p_location text default null,
  p_employment_type text default null,
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_desired_start_date date default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
 select * into v_profile
 from public.profiles
 where id=auth.uid() and role='viewer' and client_id is not null;
 if not found then raise exception 'Client portal access required'; end if;

 if length(btrim(coalesce(p_title,'')))<2 or length(btrim(coalesce(p_hiring_need,'')))<10 then
   raise exception 'Title and hiring requirement are required';
 end if;
 if p_salary_min is not null and p_salary_max is not null and p_salary_max<p_salary_min then
   raise exception 'Maximum salary cannot be lower than minimum salary';
 end if;

 insert into public.client_vacancy_requests(
   company_id,client_id,requested_by,title,location,employment_type,
   salary_min,salary_max,hiring_need,desired_start_date
 )
 values(
   v_profile.company_id,v_profile.client_id,auth.uid(),btrim(p_title),
   nullif(btrim(coalesce(p_location,'')),''),
   nullif(btrim(coalesce(p_employment_type,'')),''),
   p_salary_min,p_salary_max,btrim(p_hiring_need),p_desired_start_date
 )
 returning id into v_id;

 insert into public.partner_communication_events(
   company_id,client_id,event_type,channel,direction,subject,summary,metadata
 )
 values(
   v_profile.company_id,v_profile.client_id,'portal','portal','inbound',
   'Client vacancy request',
   'Client requested a vacancy: '||btrim(p_title)||'. '||left(btrim(p_hiring_need),5000),
   jsonb_build_object('vacancy_request_id',v_id)
 );

 return v_id;
end
$$;

-- Native Vorlen Careers is always a connected first-party distribution target.
update public.recruitment_integrations
set status='connected',
    configuration_note='Native Vorlen Careers distribution is available when a vacancy is published in Vorlen.',
    last_checked_at=now(),
    updated_at=now()
where provider='vorlen_careers' and category='job_board';

-- Backfill sequence progress for any existing active enrolments.
update public.partner_outreach_enrollments e
set current_step=coalesce(x.next_step,e.current_step),
    next_step_at=x.next_at,
    status=case when x.open_count=0 and e.status in ('active','paused') then 'completed' else e.status end,
    completed_at=case when x.open_count=0 and e.status in ('active','paused') then coalesce(e.completed_at,now()) else e.completed_at end,
    updated_at=now()
from (
  select e2.id,
         min(t.outreach_step_index) filter (where t.status not in ('done','cancelled')) next_step,
         min(t.due_at) filter (where t.status not in ('done','cancelled')) next_at,
         count(*) filter (where t.status not in ('done','cancelled')) open_count
  from public.partner_outreach_enrollments e2
  left join public.partner_tasks t on t.outreach_enrollment_id=e2.id
  group by e2.id
) x
where e.id=x.id;
