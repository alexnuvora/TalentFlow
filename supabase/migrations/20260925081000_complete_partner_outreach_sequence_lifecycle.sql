
-- Complete multi-step outreach lifecycle: preserve the exact channel and keep
-- enrollment progress synchronized with its generated tasks.

alter table public.partner_tasks
  add column if not exists outreach_channel text;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.partner_tasks'::regclass
      and conname='partner_tasks_outreach_channel_check'
  ) then
    alter table public.partner_tasks
      add constraint partner_tasks_outreach_channel_check
      check(outreach_channel is null or outreach_channel in ('task','email','sms','linkedin','call','meeting'));
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.partner_tasks'::regclass
      and conname='partner_tasks_outreach_step_index_check'
  ) then
    alter table public.partner_tasks
      add constraint partner_tasks_outreach_step_index_check
      check(outreach_step_index is null or outreach_step_index>=0);
  end if;
end $$;

-- Recover channel metadata for already-created sequence tasks from the stored
-- immutable template steps.
update public.partner_tasks pt
set outreach_channel = coalesce(
  t.steps -> pt.outreach_step_index ->> 'channel',
  case pt.task_type
    when 'call' then 'call'
    when 'email' then 'email'
    when 'meeting' then 'meeting'
    else 'task'
  end
)
from public.partner_outreach_enrollments e
join public.partner_outreach_templates t on t.id=e.template_id
where pt.outreach_enrollment_id=e.id
  and pt.outreach_step_index is not null
  and pt.outreach_channel is null;

create or replace function public.sync_partner_outreach_enrollment_from_tasks()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_enrollment uuid:=coalesce(new.outreach_enrollment_id,old.outreach_enrollment_id);
  v_status text;
  v_open_count integer;
  v_next_index integer;
  v_next_at timestamptz;
begin
  if v_enrollment is null then
    return coalesce(new,old);
  end if;

  select e.status into v_status
  from public.partner_outreach_enrollments e
  where e.id=v_enrollment
  for update;

  if not found or v_status<>'active' then
    return coalesce(new,old);
  end if;

  select
    count(*) filter (where t.status not in ('done','cancelled')),
    min(t.outreach_step_index) filter (where t.status not in ('done','cancelled')),
    min(t.due_at) filter (where t.status not in ('done','cancelled'))
  into v_open_count,v_next_index,v_next_at
  from public.partner_tasks t
  where t.outreach_enrollment_id=v_enrollment;

  if coalesce(v_open_count,0)=0 then
    update public.partner_outreach_enrollments
    set status='completed',
        current_step=coalesce((
          select max(t.outreach_step_index)+1
          from public.partner_tasks t
          where t.outreach_enrollment_id=v_enrollment
        ),0),
        next_step_at=null,
        completed_at=coalesce(completed_at,now()),
        updated_at=now()
    where id=v_enrollment and status='active';
  else
    update public.partner_outreach_enrollments
    set current_step=coalesce(v_next_index,0),
        next_step_at=v_next_at,
        updated_at=now()
    where id=v_enrollment and status='active';
  end if;

  return coalesce(new,old);
end
$$;

drop trigger if exists trg_sync_partner_outreach_enrollment_from_tasks on public.partner_tasks;
create trigger trg_sync_partner_outreach_enrollment_from_tasks
after insert or update of status,due_at,outreach_step_index,outreach_enrollment_id or delete
on public.partner_tasks
for each row execute function public.sync_partner_outreach_enrollment_from_tasks();

revoke all on function public.sync_partner_outreach_enrollment_from_tasks()
from public,anon,authenticated;

create or replace function public.partner_enroll_outreach_sequence(
  p_template uuid,
  p_client uuid,
  p_contact uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_template public.partner_outreach_templates%rowtype;
  v_id uuid;
  v_step jsonb;
  v_idx integer:=0;
  v_delay integer;
  v_channel text;
  v_title text;
begin
  if not private.partner_is_active(auth.uid())
     or not private.partner_can_develop_clients(auth.uid()) then
    raise exception 'Client-development partner access required';
  end if;

  if not private.partner_has_assigned_client(p_client,auth.uid()) then
    raise exception 'Assigned client required';
  end if;

  if private.client_is_suppressed(p_client) then
    raise exception 'Client is marked do not contact';
  end if;

  select * into v_template
  from public.partner_outreach_templates
  where id=p_template
    and company_id=v_company
    and active
    and (owner_partner_id is null or owner_partner_id=auth.uid());

  if not found then raise exception 'Outreach template not found'; end if;

  if p_contact is not null and not exists(
    select 1
    from public.client_recruitment_contacts c
    where c.id=p_contact
      and c.client_id=p_client
      and c.company_id=v_company
      and not c.communication_opt_out
  ) then
    raise exception 'Contact unavailable for outreach';
  end if;

  insert into public.partner_outreach_enrollments(
    company_id,template_id,partner_id,client_id,contact_id,status,current_step,next_step_at
  )
  values(v_company,v_template.id,auth.uid(),p_client,p_contact,'active',0,null)
  returning id into v_id;

  for v_step in select * from jsonb_array_elements(v_template.steps) loop
    v_delay:=greatest(0,least(coalesce((v_step->>'delay_hours')::integer,0),2160));
    v_channel:=coalesce(v_step->>'channel','task');
    v_title:=coalesce(nullif(v_step->>'title',''),initcap(v_channel)||' follow-up');

    insert into public.partner_tasks(
      company_id,partner_id,client_id,title,description,task_type,due_at,priority,
      outreach_enrollment_id,outreach_step_index,outreach_channel
    )
    values(
      v_company,auth.uid(),p_client,v_title,nullif(v_step->>'instructions',''),
      case
        when v_channel in ('email','call','meeting') then v_channel
        else 'follow_up'
      end,
      now()+make_interval(hours=>v_delay),
      coalesce(nullif(v_step->>'priority',''),'normal'),
      v_id,v_idx,v_channel
    );
    v_idx:=v_idx+1;
  end loop;

  insert into public.partner_communication_events(
    company_id,partner_id,client_id,contact_id,event_type,channel,direction,summary,metadata
  )
  values(
    v_company,auth.uid(),p_client,p_contact,'sequence','internal','internal',
    'Started outreach sequence: '||v_template.name,
    jsonb_build_object('enrollment_id',v_id,'template_id',v_template.id)
  );

  perform public.sync_partner_outreach_enrollment_from_tasks();

  return v_id;
end
$$;
