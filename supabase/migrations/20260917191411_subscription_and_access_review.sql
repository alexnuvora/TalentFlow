-- Additive upgrade for plan enforcement. No subscription prices or purchased limits are changed.
create or replace function public.workspace_feature_enabled(p_company uuid,p_feature text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select (s.status='active' or (s.status='trialing' and s.trial_ends_at>now()))
 and coalesce((p.features->>p_feature)::boolean,false) from public.company_subscriptions s
 join public.saas_plans p on p.code=s.plan_code and p.active where s.company_id=p_company),false)
$$;
revoke all on function public.workspace_feature_enabled(uuid,text) from public,anon,authenticated;
grant execute on function public.workspace_feature_enabled(uuid,text) to service_role;
create or replace function public.require_workspace_feature(p_feature text) returns void
language plpgsql stable security definer set search_path='' as $$
declare c uuid;begin
 select company_id into c from public.profiles where id=auth.uid();
 if c is null or not public.workspace_feature_enabled(c,p_feature) then raise exception 'This feature requires an active subscription that includes it';end if;
end $$;
revoke all on function public.require_workspace_feature(text) from public,anon;
grant execute on function public.require_workspace_feature(text) to authenticated;
create or replace function public.enforce_saas_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int; cnt int; sub_status text; trial_end timestamptz; plan_features jsonb; plan_code text;
begin
  -- Serialize quota checks so simultaneous inserts cannot exceed a plan limit.
  perform 1 from public.companies where id=new.company_id for update;
  -- Pausing a job or automation must remain possible after a trial ends.
  if tg_op='UPDATE' then
    if tg_table_name='jobs' and new.status::text<>'published' then return new;end if;
    if tg_table_name='automation_sequences' and new.active=false then return new;end if;
  end if;
  select s.status,s.trial_ends_at,s.plan_code,p.features into sub_status,trial_end,plan_code,plan_features
  from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code
  where s.company_id=new.company_id and p.active=true;
  if sub_status is null then raise exception 'Workspace subscription is not configured'; end if;
  if sub_status not in ('active','trialing') then raise exception 'Workspace subscription is not active'; end if;
  if sub_status='trialing' and (trial_end is null or trial_end<=now()) then raise exception 'Workspace trial has expired'; end if;
  if tg_table_name='jobs' then
    select p.active_job_limit into lim from public.saas_plans p where p.code=plan_code;
    if lim>=0 and coalesce(new.status::text,'')='published' then select count(*) into cnt from public.jobs where company_id=new.company_id and status::text='published' and id<>new.id; if cnt>=lim then raise exception 'Active job plan limit reached'; end if; end if;
  elsif tg_table_name='candidates' then
    select p.candidate_limit into lim from public.saas_plans p where p.code=plan_code;
    if lim>=0 then select count(*) into cnt from public.candidates where company_id=new.company_id and id<>new.id; if cnt>=lim then raise exception 'Candidate plan limit reached'; end if; end if;
  elsif tg_table_name='automation_sequences' then
    if coalesce((plan_features->>'automations')::boolean,false)=false then raise exception 'Automations are not included in the current plan'; end if;
    select p.automation_limit into lim from public.saas_plans p where p.code=plan_code;
    if lim>=0 then select count(*) into cnt from public.automation_sequences where company_id=new.company_id and id<>new.id; if cnt>=lim then raise exception 'Automation plan limit reached'; end if; end if;
  elsif tg_table_name='screening_reports' then
    if coalesce((plan_features->>'ai_screening')::boolean,false)=false then raise exception 'AI screening is not included in the current plan'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_saas_limit() from public, anon, authenticated;
drop trigger if exists enforce_screening_saas_entitlement on public.screening_reports;
create trigger enforce_screening_saas_entitlement before insert on public.screening_reports for each row execute function public.enforce_saas_limit();


-- Existing portal remains unchanged, with a subscription check before access.
alter function public.client_portal_data() rename to client_portal_data_authorised;
revoke all on function public.client_portal_data_authorised() from public,anon,authenticated;
create function public.client_portal_data() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform public.require_workspace_feature('client_portal');return public.client_portal_data_authorised();end $$;
revoke all on function public.client_portal_data() from public,anon;grant execute on function public.client_portal_data() to authenticated;
-- Finance and delivery records are agency records, never client-portal data.
do $$declare r record;begin
 for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('invoices','invoice_payments','invoice_adjustments','outbound_deliveries','commercial_audit_log') and cmd='SELECT' loop
 execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
end $$;
create policy invoices_staff_read on public.invoices for select to authenticated using(company_id=(select public.current_company_id()) and (select public.is_manager()));
create policy payments_staff_read on public.invoice_payments for select to authenticated using(company_id=(select public.current_company_id()) and (select public.is_manager()));
create policy adjustments_staff_read on public.invoice_adjustments for select to authenticated using(company_id=(select public.current_company_id()) and (select public.is_manager()));
create policy delivery_staff_read on public.outbound_deliveries for select to authenticated using(company_id=(select public.current_company_id()) and (select public.is_manager()));
create policy audit_staff_read on public.commercial_audit_log for select to authenticated using(company_id=(select public.current_company_id()) and (select public.is_manager()));

alter table public.candidate_submissions add column if not exists candidate_authorisation text;
create or replace function public.review_application(p_application uuid,p_status text,p_notes text) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;begin
 if not public.is_manager() or auth.uid() is null then raise exception 'Staff access required';end if;
 select * into a from public.applications where id=p_application and company_id=public.current_company_id() for update;
 if not found or a.status in ('withdrawn','placed') then raise exception 'Application unavailable';end if;
 if p_status not in ('screening','qualified','rejected','follow_up') or length(trim(coalesce(p_notes,'')))<3 then raise exception 'Decision and reason required';end if;
 update public.applications set status=p_status where id=a.id;
 insert into public.call_notes(company_id,candidate_id,application_id,recruiter_id,outcome,notes) values(a.company_id,a.candidate_id,a.id,auth.uid(),case when p_status='qualified' then 'qualified' when p_status='rejected' then 'not_suitable' else 'follow_up' end,p_notes);
end $$;
revoke all on function public.review_application(uuid,text,text) from public,anon;grant execute on function public.review_application(uuid,text,text) to authenticated;
create or replace function public.reserve_client_submission(p_application uuid,p_summary text,p_authorisation text,p_recipient text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;j public.jobs%rowtype;cl public.clients%rowtype;c public.candidates%rowtype;s public.candidate_submissions%rowtype;delivery uuid;
begin
 if not public.is_manager() or auth.uid() is null then raise exception 'Staff access required';end if;
 select * into a from public.applications where id=p_application and company_id=public.current_company_id() for update;
 if not found then raise exception 'Application unavailable';end if;
 select * into s from public.candidate_submissions where application_id=a.id;
 if found then return jsonb_build_object('existing',true,'submission_id',s.id,'status',s.status);end if;
 if a.status<>'qualified' then raise exception 'Record a human qualification decision before submission';end if;
 if length(trim(coalesce(p_summary,'')))<10 or length(p_summary)>8000 or length(trim(coalesce(p_authorisation,'')))<10 then raise exception 'Reviewed summary and candidate permission required';end if;
 if exists(select 1 from public.screening_reports where application_id=a.id and reviewed_at is null) then raise exception 'Review screening evidence before sharing';end if;
 select * into j from public.jobs where id=a.job_id and company_id=a.company_id;
 if j.application_mode='register_interest' then raise exception 'This is a talent pool, not an authorised client vacancy';end if;
 select * into cl from public.clients where id=j.client_id and company_id=a.company_id and status='active';
 if not found or cl.email is null or lower(trim(p_recipient))<>lower(trim(cl.email)) then raise exception 'Confirm the client contact recorded for this opportunity';end if;
 select * into c from public.candidates where id=a.candidate_id and company_id=a.company_id and erased_at is null;
 if not found then raise exception 'Candidate unavailable';end if;
 insert into public.outbound_deliveries(company_id,kind,idempotency_key,recipient,provider,status) values(a.company_id,'client_submission','submission:'||a.id,cl.email,'resend','reserved') returning id into delivery;
 insert into public.candidate_submissions(company_id,client_id,job_id,candidate_id,application_id,submitted_by,headline,recruiter_summary,status,recipient_email,reviewed_by,review_confirmed_at,delivery_id,candidate_authorisation)
 values(a.company_id,cl.id,j.id,c.id,a.id,auth.uid(),c.full_name||' — '||j.title,p_summary,'approved_to_send',cl.email,auth.uid(),now(),delivery,p_authorisation) returning * into s;
 return jsonb_build_object('existing',false,'submission_id',s.id,'delivery_id',delivery,'company_id',a.company_id,'recipient',cl.email,'subject','Candidate submission: '||j.title,'body',c.full_name||E'\nRole: '||j.title||E'\n\n'||p_summary);
end $$;
revoke all on function public.reserve_client_submission(uuid,text,text,text) from public,anon;
grant execute on function public.reserve_client_submission(uuid,text,text,text) to authenticated;
