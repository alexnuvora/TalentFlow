
-- Hardening and lifecycle completion for partner operating model v2.

alter table public.partner_tasks
  add column if not exists sequence_id uuid references public.partner_client_sequences(id) on delete set null;

create index if not exists partner_tasks_sequence_idx on public.partner_tasks(sequence_id)
where sequence_id is not null;

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
   (v_company,auth.uid(),p_client,v_sequence,'Prepare qualified opportunity','If a genuine hiring need exists, submit a commercial handoff to Vorlen.','follow_up',now()+interval '7 days','high');
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

create or replace function public.sync_partner_sequence_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
 v_sequence uuid:=coalesce(new.sequence_id,old.sequence_id);
begin
 if v_sequence is null then return coalesce(new,old); end if;

 if not exists(
   select 1
   from public.partner_tasks t
   where t.sequence_id=v_sequence
     and t.status not in ('done','cancelled')
 ) then
   update public.partner_client_sequences
   set status='completed',completed_at=coalesce(completed_at,now())
   where id=v_sequence and status='active';
 elsif tg_op='UPDATE' then
   update public.partner_client_sequences
   set status='active',completed_at=null
   where id=v_sequence and status='completed'
     and exists(select 1 from public.partner_tasks t where t.sequence_id=v_sequence and t.status not in ('done','cancelled'));
 end if;
 return coalesce(new,old);
end
$$;

drop trigger if exists trg_sync_partner_sequence_status on public.partner_tasks;
create trigger trg_sync_partner_sequence_status
after insert or update of status or delete on public.partner_tasks
for each row execute function public.sync_partner_sequence_status();

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

create or replace function public.partner_client_workspace(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
 v_client public.clients%rowtype;
 v_hash text;
 v_terms_authorised boolean:=false;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_has_assigned_client(p_client,auth.uid()) then
   raise exception 'Assigned client access required';
 end if;
 select * into v_client from public.clients where id=p_client and company_id=v_company;
 if not found then raise exception 'Client not found'; end if;
 v_hash:=private.client_commercial_hash(p_client);
 v_terms_authorised:=v_client.partner_terms_send_authorized_at is not null
   and v_client.partner_terms_send_authorized_hash=v_hash
   and v_client.terms_accepted_at is null;

 return jsonb_build_object(
  'client',jsonb_build_object(
    'id',v_client.id,'company_name',v_client.company_name,'contact_name',v_client.contact_name,
    'email',v_client.email,'phone',v_client.phone,'website',v_client.website,'status',v_client.status,
    'business_nature',v_client.business_nature
  ),
  'capabilities',jsonb_build_object(
    'can_prospect',private.partner_can_prospect(auth.uid()),
    'can_close',private.partner_can_close_clients(auth.uid()),
    'can_source',private.partner_can_source_candidates(auth.uid())
  ),
  'commercial',jsonb_build_object(
    'terms_accepted',v_client.terms_accepted_at is not null,
    'terms_accepted_at',v_client.terms_accepted_at,
    'partner_send_authorised',v_terms_authorised,
    'fee_percent',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.recruitment_fee_percent else null end,
    'payment_terms_days',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.payment_terms_days else null end,
    'rebate_terms',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.rebate_terms else null end,
    'latest_document',(
      select jsonb_build_object('status',d.status,'sent_at',d.sent_at,'viewed_at',d.viewed_at,'accepted_at',d.accepted_at,'version',d.version)
      from public.client_terms_documents d
      where d.client_id=p_client and d.company_id=v_company
      order by d.created_at desc limit 1
    ),
    'contract_status',(
      select cc.status::text from public.client_contracts cc
      where cc.client_id=p_client and cc.company_id=v_company
      order by cc.created_at desc limit 1
    )
  ),
  'contacts',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',x.id,'name',x.name,'role_title',x.role_title,'email',x.email,'phone',x.phone,
      'recruitment_authority',x.recruitment_authority,'vacancy_contact_confirmed',x.vacancy_contact_confirmed,
      'is_primary',x.is_primary,'last_confirmed_at',x.last_confirmed_at
    ) order by x.is_primary desc,x.last_confirmed_at desc)
    from public.client_recruitment_contacts x
    where x.client_id=p_client and x.company_id=v_company
  ),'[]'::jsonb),
  'jobs',coalesce((
    select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'location',j.location,'created_at',j.created_at) order by j.created_at desc)
    from public.jobs j where j.client_id=p_client and j.company_id=v_company
  ),'[]'::jsonb),
  'handoffs',coalesce((
    select jsonb_agg(jsonb_build_object('id',h.id,'vacancy_title',h.vacancy_title,'status',h.status,'manager_notes',h.manager_notes,'updated_at',h.updated_at) order by h.updated_at desc)
    from public.partner_commercial_handoffs h
    where h.client_id=p_client and h.company_id=v_company and h.partner_id=auth.uid()
  ),'[]'::jsonb),
  'timeline',coalesce((
    select jsonb_agg(e order by (e->>'at')::timestamptz desc)
    from (
      select jsonb_build_object('type','partner_note','at',n.created_at,'title','Partner note','detail',n.note) e
      from public.partner_client_notes n
      where n.client_id=p_client and n.company_id=v_company and n.partner_id=auth.uid()
      union all
      select jsonb_build_object('type','terms','at',coalesce(d.accepted_at,d.viewed_at,d.sent_at,d.created_at),'title','Terms of Business · '||d.status,'detail',d.version)
      from public.client_terms_documents d where d.client_id=p_client and d.company_id=v_company
      union all
      select jsonb_build_object('type','vacancy','at',j.created_at,'title','Vacancy · '||j.title,'detail',j.status::text)
      from public.jobs j where j.client_id=p_client and j.company_id=v_company
      union all
      select jsonb_build_object('type','handoff','at',h.updated_at,'title','Commercial handoff · '||h.vacancy_title,'detail',h.status)
      from public.partner_commercial_handoffs h
      where h.client_id=p_client and h.company_id=v_company and h.partner_id=auth.uid()
    ) z
  ),'[]'::jsonb)
 );
end
$$;

drop policy if exists "partner talent pool members own" on public.partner_talent_pool_members;
create policy "partner talent pool members own" on public.partner_talent_pool_members
for select to authenticated
using(
 exists(
  select 1 from public.partner_talent_pools p
  where p.id=pool_id
    and p.company_id=private.current_company_id()
    and (private.is_manager() or p.partner_id=auth.uid())
 )
);

revoke insert,update,delete on public.partner_talent_pool_members from authenticated;
revoke insert on public.partner_client_sequences from authenticated;
revoke insert,update,delete on public.partner_candidate_access_requests from authenticated;
revoke insert,update,delete on public.partner_client_handover_requests from authenticated;

revoke all on function public.partner_terms_send_allowed(uuid) from public,anon;
grant execute on function public.partner_terms_send_allowed(uuid) to authenticated;
