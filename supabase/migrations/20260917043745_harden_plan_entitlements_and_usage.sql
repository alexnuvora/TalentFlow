create or replace function public.enforce_saas_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim int; cnt int; sub_status text; trial_end timestamptz; plan_features jsonb; plan_code text;
begin
  select s.status,s.trial_ends_at,s.plan_code,p.features
    into sub_status,trial_end,plan_code,plan_features
  from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code
  where s.company_id=new.company_id and p.active=true;
  if sub_status is null then raise exception 'Workspace subscription is not configured'; end if;
  if sub_status not in ('active','trialing') then raise exception 'Workspace subscription is not active'; end if;
  if sub_status='trialing' and (trial_end is null or trial_end<=now()) then raise exception 'Workspace trial has expired'; end if;

  if tg_table_name='jobs' then
    select p.active_job_limit into lim from public.saas_plans p where p.code=plan_code;
    if lim>=0 and coalesce(new.status::text,'')='published' then
      select count(*) into cnt from public.jobs where company_id=new.company_id and status::text='published' and id<>new.id;
      if cnt>=lim then raise exception 'Active job plan limit reached'; end if;
    end if;
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

create or replace function public.current_subscription_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c uuid; result jsonb;
begin
  select company_id into c from public.profiles where id=auth.uid();
  if c is null then raise exception 'Workspace access required'; end if;
  select jsonb_build_object(
    'company_id',c,'plan_code',s.plan_code,'plan_name',p.name,'status',s.status,'trial_ends_at',s.trial_ends_at,
    'current_period_end',s.current_period_end,'cancel_at_period_end',s.cancel_at_period_end,'features',p.features,
    'limits',jsonb_build_object('recruiters',p.recruiter_limit,'active_jobs',p.active_job_limit,'candidates',p.candidate_limit,'automations',p.automation_limit),
    'usage',jsonb_build_object(
      'recruiters',(select count(*) from public.profiles x where x.company_id=c and x.role in ('owner','manager','recruiter')),
      'active_jobs',(select count(*) from public.jobs x where x.company_id=c and x.status::text='published'),
      'candidates',(select count(*) from public.candidates x where x.company_id=c),
      'automations',(select count(*) from public.automation_sequences x where x.company_id=c)
    )
  ) into result
  from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code
  where s.company_id=c;
  return coalesce(result,jsonb_build_object('company_id',c,'status','not_configured'));
end $$;
revoke execute on function public.current_subscription_snapshot() from public, anon;
grant execute on function public.current_subscription_snapshot() to authenticated;
