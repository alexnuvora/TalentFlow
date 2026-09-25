
-- Data-integrity hardening for partner CRM/outreach RPCs.

create or replace function public.partner_log_communication(
  p_client uuid,
  p_event_type text,
  p_summary text,
  p_channel text default 'internal',
  p_direction text default 'internal',
  p_contact uuid default null,
  p_candidate uuid default null,
  p_job uuid default null,
  p_subject text default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then
   raise exception 'Client-development partner access required';
 end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then
   raise exception 'Assigned client required';
 end if;
 if nullif(btrim(coalesce(p_summary,'')),'') is null then
   raise exception 'Communication summary is required';
 end if;
 if length(p_summary)>10000 then raise exception 'Communication summary is too long'; end if;
 if p_event_type not in ('call','email','sms','linkedin','note','meeting','tob','handoff','vacancy','candidate_submission','interview','portal','sequence','system') then
   raise exception 'Invalid event type';
 end if;
 if p_direction not in ('inbound','outbound','internal') then raise exception 'Invalid direction'; end if;

 if p_contact is not null and not exists(
   select 1 from public.client_recruitment_contacts c
   where c.id=p_contact and c.client_id=p_client and c.company_id=v_company
 ) then raise exception 'Contact does not belong to client'; end if;

 if p_job is not null and not exists(
   select 1 from public.jobs j
   where j.id=p_job and j.company_id=v_company and j.client_id=p_client
     and exists(
       select 1 from public.partner_assignments a
       where a.company_id=v_company and a.partner_id=auth.uid()
         and a.job_id=j.id and a.completed_at is null
     )
 ) then raise exception 'Vacancy is not assigned to you for this client'; end if;

 if p_candidate is not null and not exists(
   select 1 from public.candidates c
   where c.id=p_candidate and c.company_id=v_company and c.erased_at is null
     and exists(
       select 1 from public.partner_assignments a
       where a.company_id=v_company and a.partner_id=auth.uid()
         and a.candidate_id=c.id and a.completed_at is null
     )
 ) then raise exception 'Candidate is not assigned to you'; end if;

 insert into public.partner_communication_events(
   company_id,partner_id,client_id,contact_id,candidate_id,job_id,
   event_type,channel,direction,subject,summary,occurred_at,metadata
 )
 values(
   v_company,auth.uid(),p_client,p_contact,p_candidate,p_job,
   p_event_type,left(coalesce(nullif(btrim(p_channel),''),'internal'),64),
   p_direction,nullif(left(btrim(coalesce(p_subject,'')),500),''),
   left(btrim(p_summary),10000),coalesce(p_occurred_at,now()),coalesce(p_metadata,'{}'::jsonb)
 )
 returning id into v_id;

 update public.client_recruitment_contacts
 set last_contacted_at=coalesce(p_occurred_at,now()),updated_at=now()
 where id=p_contact;

 if p_direction='inbound' then
   update public.partner_outreach_enrollments e
   set status='stopped_reply',
       replied_at=coalesce(p_occurred_at,now()),
       completed_at=coalesce(p_occurred_at,now()),
       next_step_at=null,
       updated_at=now()
   where e.company_id=v_company
     and e.partner_id=auth.uid()
     and e.client_id=p_client
     and e.status='active'
     and (e.contact_id is null or e.contact_id=p_contact)
     and exists(
       select 1 from public.partner_outreach_templates t
       where t.id=e.template_id and t.stop_on_reply
     );

   update public.partner_tasks t
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where t.company_id=v_company
     and t.partner_id=auth.uid()
     and t.client_id=p_client
     and t.outreach_enrollment_id is not null
     and t.status not in ('done','cancelled');
 end if;

 return v_id;
end
$$;

create or replace function public.partner_create_opportunity(
  p_client uuid,
  p_name text,
  p_stage text default 'identified',
  p_contact uuid default null,
  p_job uuid default null,
  p_expected_fee numeric default null,
  p_probability integer default 10,
  p_next_action text default null,
  p_next_action_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then
   raise exception 'Client-development partner access required';
 end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client required'; end if;
 if length(btrim(coalesce(p_name,'')))<2 then raise exception 'Opportunity name is required'; end if;
 if p_stage not in ('identified','qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won','lost') then raise exception 'Invalid opportunity stage'; end if;
 if p_expected_fee is not null and p_expected_fee<0 then raise exception 'Expected fee cannot be negative'; end if;
 if p_contact is not null and not exists(
   select 1 from public.client_recruitment_contacts c where c.id=p_contact and c.company_id=v_company and c.client_id=p_client
 ) then raise exception 'Contact does not belong to client'; end if;
 if p_job is not null and not exists(
   select 1 from public.jobs j where j.id=p_job and j.company_id=v_company and j.client_id=p_client
 ) then raise exception 'Vacancy does not belong to client'; end if;

 insert into public.partner_opportunities(
   company_id,owner_partner_id,client_id,contact_id,job_id,name,stage,
   expected_fee,probability,next_action,next_action_at
 )
 values(
   v_company,auth.uid(),p_client,p_contact,p_job,left(btrim(p_name),500),p_stage,
   p_expected_fee,greatest(0,least(coalesce(p_probability,10),100)),
   nullif(left(btrim(coalesce(p_next_action,'')),1000),''),p_next_action_at
 )
 returning id into v_id;
 return v_id;
end
$$;

create or replace function public.partner_update_opportunity(
  p_opportunity uuid,
  p_stage text,
  p_probability integer default null,
  p_expected_fee numeric default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_lost_reason text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then
   raise exception 'Client-development partner access required';
 end if;
 if p_stage not in ('identified','qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won','lost') then
   raise exception 'Invalid opportunity stage';
 end if;
 if p_expected_fee is not null and p_expected_fee<0 then raise exception 'Expected fee cannot be negative'; end if;
 if p_probability is not null and (p_probability<0 or p_probability>100) then raise exception 'Probability must be between 0 and 100'; end if;
 if p_stage='lost' and nullif(btrim(coalesce(p_lost_reason,'')),'') is null then
   raise exception 'Record why the opportunity was lost';
 end if;

 update public.partner_opportunities
 set stage=p_stage,
     probability=coalesce(p_probability,probability),
     expected_fee=coalesce(p_expected_fee,expected_fee),
     next_action=nullif(left(btrim(coalesce(p_next_action,'')),1000),''),
     next_action_at=p_next_action_at,
     lost_reason=case when p_stage='lost' then left(btrim(p_lost_reason),2000) else null end,
     updated_at=now()
 where id=p_opportunity
   and company_id=private.current_company_id()
   and owner_partner_id=auth.uid();

 if not found then raise exception 'Opportunity not found'; end if;
end
$$;

create or replace function public.partner_create_outreach_template(
  p_name text,
  p_description text,
  p_steps jsonb,
  p_stop_on_reply boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid; v_step jsonb; v_channel text; v_priority text; v_delay integer;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then
   raise exception 'Client-development partner access required';
 end if;
 if length(btrim(coalesce(p_name,'')))<2 then raise exception 'Sequence name is required'; end if;
 if jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)<1 or jsonb_array_length(p_steps)>12 then
   raise exception 'Sequence requires 1 to 12 steps';
 end if;

 for v_step in select * from jsonb_array_elements(p_steps) loop
   if jsonb_typeof(v_step)<>'object' then raise exception 'Each sequence step must be an object'; end if;
   v_channel:=coalesce(v_step->>'channel','task');
   v_priority:=coalesce(nullif(v_step->>'priority',''),'normal');
   begin v_delay:=coalesce((v_step->>'delay_hours')::integer,0);
   exception when others then raise exception 'Sequence delay_hours must be a whole number'; end;
   if v_channel not in ('task','email','sms','linkedin','call','meeting') then raise exception 'Unsupported sequence channel %',v_channel; end if;
   if v_priority not in ('low','normal','high','urgent') then raise exception 'Invalid sequence priority'; end if;
   if v_delay<0 or v_delay>2160 then raise exception 'Sequence delay must be between 0 and 2160 hours'; end if;
   if length(coalesce(v_step->>'title',''))>500 or length(coalesce(v_step->>'instructions',''))>4000 then
     raise exception 'Sequence step content is too long';
   end if;
 end loop;

 insert into public.partner_outreach_templates(
   company_id,owner_partner_id,name,description,steps,stop_on_reply
 )
 values(
   private.current_company_id(),auth.uid(),left(btrim(p_name),500),
   nullif(left(btrim(coalesce(p_description,'')),4000),''),
   p_steps,coalesce(p_stop_on_reply,true)
 )
 returning id into v_id;
 return v_id;
end
$$;
