create or replace function private.has_candidate_data_access()
returns boolean language sql stable security definer set search_path='' as $$
 select public.candidate_processing_allowed(private.current_company_id())
    and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','manager','recruiter'))
$$;
revoke all on function private.has_candidate_data_access() from public,anon,authenticated;
grant execute on function private.has_candidate_data_access() to authenticated,service_role;

do $$
declare r record; q text;
begin
 for r in select tablename,policyname,roles,qual,with_check from pg_policies
 where schemaname='public' and (coalesce(qual,'') like '%has_candidate_data_access()%' or coalesce(with_check,'') like '%has_candidate_data_access()%')
 loop
  q:='alter policy '||quote_ident(r.policyname)||' on public.'||quote_ident(r.tablename);
  if r.roles is not null then q:=q||' to '||(select string_agg(quote_ident(x),',') from unnest(r.roles)x); end if;
  if r.qual is not null then q:=q||' using ('||replace(r.qual,'has_candidate_data_access()','private.has_candidate_data_access()')||')'; end if;
  if r.with_check is not null then q:=q||' with check ('||replace(r.with_check,'has_candidate_data_access()','private.has_candidate_data_access()')||')'; end if;
  execute q;
 end loop;
end $$;

create or replace function public.current_subscription_snapshot()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c uuid; result jsonb;
begin
 c:=private.current_company_id();
 if c is null then raise exception 'Workspace access required'; end if;
 select jsonb_build_object(
  'company_id',c,'plan_code',s.plan_code,'plan_name',p.name,'status',s.status,'trial_ends_at',s.trial_ends_at,
  'current_period_end',s.current_period_end,'cancel_at_period_end',s.cancel_at_period_end,'features',p.features,
  'limits',jsonb_build_object('recruiters',p.recruiter_limit,'active_jobs',p.active_job_limit,'candidates',p.candidate_limit,'automations',p.automation_limit),
  'usage',jsonb_build_object(
   'recruiters',(select count(*) from public.profiles x where x.company_id=c and x.role in ('owner','manager','recruiter')),
   'active_jobs',(select count(*) from public.jobs x where x.company_id=c and x.status::text='published'),
   'candidates',case when public.candidate_processing_allowed(c) then (select count(*) from public.candidates x where x.company_id=c) else 0 end,
   'automations',(select count(*) from public.automation_sequences x where x.company_id=c)
  )
 ) into result from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code where s.company_id=c;
 return coalesce(result,jsonb_build_object('company_id',c,'status','not_configured'));
end $$;
