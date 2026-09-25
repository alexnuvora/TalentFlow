
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
      case when v_channel in ('email','call','meeting') then v_channel else 'follow_up' end,
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

  return v_id;
end
$$;
