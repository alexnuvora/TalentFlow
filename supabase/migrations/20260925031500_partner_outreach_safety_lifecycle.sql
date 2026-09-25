
create or replace function private.client_is_suppressed(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select coalesce((
   select
     exists(
       select 1 from public.b2b_call_suppressions s
       where s.company_id=c.company_id
         and (
           s.client_id=c.id
           or (s.email_normalized is not null and lower(btrim(coalesce(c.email,'')))=s.email_normalized)
           or (s.phone_normalized is not null and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=s.phone_normalized)
         )
     )
     or exists(
       select 1 from public.partner_client_activity a
       where a.company_id=c.company_id and a.client_id=c.id and a.status='do_not_contact'
     )
   from public.clients c
   where c.id=p_client and c.company_id=private.current_company_id()
 ),false)
$$;

create or replace function public.partner_terms_send_allowed(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select coalesce(
   private.partner_is_active(auth.uid())
   and private.partner_can_close_clients(auth.uid())
   and private.partner_has_assigned_client(p_client,auth.uid())
   and not private.client_is_suppressed(p_client)
   and exists(
     select 1
     from public.clients c
     where c.id=p_client
       and c.company_id=private.current_company_id()
       and c.terms_accepted_at is null
       and c.partner_terms_send_authorized_at is not null
       and c.partner_terms_send_authorized_hash=private.client_commercial_hash(c.id)
       and nullif(btrim(coalesce(c.business_nature,'')),'') is not null
       and c.recruitment_fee_percent is not null
       and c.payment_terms_days is not null
       and nullif(btrim(coalesce(c.rebate_terms,'')),'') is not null
   ),
 false)
$$;

create or replace function public.partner_start_client_sequence(p_client uuid,p_template text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
 v_sequence uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_has_assigned_client(p_client,auth.uid()) then
   raise exception 'Assigned client access required';
 end if;
 if private.client_is_suppressed(p_client) then
   raise exception 'This client is marked do not contact. No outreach sequence was started';
 end if;
 if p_template='advisor_discovery' and not private.partner_can_prospect(auth.uid()) then
   raise exception 'Advisor sequence not enabled for this specialism';
 end if;
 if p_template='closer_conversion' and not private.partner_can_close_clients(auth.uid()) then
   raise exception 'Closer sequence not enabled for this specialism';
 end if;
 if p_template not in ('advisor_discovery','closer_conversion') then
   raise exception 'Invalid sequence template';
 end if;

 insert into public.partner_client_sequences(company_id,partner_id,client_id,template)
 values(v_company,auth.uid(),p_client,p_template)
 returning id into v_sequence;

 if p_template='advisor_discovery' then
   insert into public.partner_tasks(company_id,partner_id,client_id,sequence_id,title,description,task_type,due_at,priority)
   values
   (v_company,auth.uid(),p_client,v_sequence,'Research recruitment decision-maker','Identify the person responsible for recruitment and record them in Client Workspace.','admin',now(),'high'),
   (v_company,auth.uid(),p_client,v_sequence,'Initial discovery call','Confirm whether the employer is hiring and qualify the need.','call',now(),'high'),
   (v_company,auth.uid(),p_client,v_sequence,'Discovery follow-up','Send a concise follow-up based on the conversation.','email',now()+interval '2 days','normal'),
   (v_company,auth.uid(),p_client,v_sequence,'Second discovery call','Reconnect and qualify urgency, headcount and decision process.','call',now()+interval '5 days','normal'),
   (v_company,auth.uid(),p_client,v_sequence,'Prepare qualified opportunity','If a genuine hiring need exists, send the qualified account to a Lead Closer.','follow_up',now()+interval '7 days','high');
 else
   insert into public.partner_tasks(company_id,partner_id,client_id,sequence_id,title,description,task_type,due_at,priority)
   values
   (v_company,auth.uid(),p_client,v_sequence,'Confirm hiring authority','Confirm the decision-maker and live hiring requirement.','call',now(),'high'),
   (v_company,auth.uid(),p_client,v_sequence,'Review Vorlen-approved commercial position','Check Client Workspace for management-authorised terms before discussing next steps.','admin',now(),'high'),
   (v_company,auth.uid(),p_client,v_sequence,'Send approved Terms of Business','Only send when Client Workspace shows partner send authorised.','email',now()+interval '1 day','high'),
   (v_company,auth.uid(),p_client,v_sequence,'Follow up on Terms of Business','Check whether the client viewed/accepted the secure terms link.','follow_up',now()+interval '3 days','normal'),
   (v_company,auth.uid(),p_client,v_sequence,'Secure first vacancy','Once terms are accepted, confirm the first genuine vacancy and submit/update the handoff.','call',now()+interval '5 days','high');
 end if;
 return v_sequence;
exception when unique_violation then
 raise exception 'An active % sequence already exists for this client',p_template;
end
$$;

create or replace function public.cancel_partner_outreach_on_dnc()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if new.status='do_not_contact' and (tg_op='INSERT' or old.status is distinct from new.status) then
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
     and status='active';
 end if;
 return new;
end
$$;

drop trigger if exists trg_cancel_partner_outreach_on_dnc on public.partner_client_activity;
create trigger trg_cancel_partner_outreach_on_dnc
after insert or update of status on public.partner_client_activity
for each row execute function public.cancel_partner_outreach_on_dnc();

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
     and status='active';
 end if;
 return new;
end
$$;

drop trigger if exists trg_cancel_partner_work_on_client_unassignment on public.partner_assignments;
create trigger trg_cancel_partner_work_on_client_unassignment
after update of completed_at on public.partner_assignments
for each row execute function public.cancel_partner_work_on_client_unassignment();
