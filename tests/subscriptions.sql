begin;
insert into auth.users values('10000000-0000-0000-0000-000000000001');
insert into public.companies(id,name) values('20000000-0000-0000-0000-000000000001','Test workspace');
insert into public.company_subscriptions(company_id,plan_code,status) values('20000000-0000-0000-0000-000000000001','starter','active');
insert into public.profiles(id,company_id,role) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$begin
 if public.workspace_feature_enabled('20000000-0000-0000-0000-000000000001','automations') then raise exception 'Starter must not enable automations';end if;
 if not public.workspace_feature_enabled('20000000-0000-0000-0000-000000000001','ai_screening') then raise exception 'Starter includes AI screening';end if;
 if public.workspace_feature_enabled('20000000-0000-0000-0000-000000000002','ai_screening') then raise exception 'Missing subscriptions must fail closed';end if;
end$$;
update public.company_subscriptions set plan_code='growth',status='trialing',trial_ends_at=now()-interval '1 second' where company_id='20000000-0000-0000-0000-000000000001';
do $$begin if public.workspace_feature_enabled('20000000-0000-0000-0000-000000000001','automations') then raise exception 'Expired trial enabled automations';end if;end$$;
update public.company_subscriptions set status='active' where company_id='20000000-0000-0000-0000-000000000001';
do $$begin if not public.workspace_feature_enabled('20000000-0000-0000-0000-000000000001','automations') then raise exception 'Growth must enable automations';end if;end$$;
set local role authenticated;
select public.require_workspace_feature('ai_screening');
do $$begin
 begin perform public.workspace_feature_enabled('20000000-0000-0000-0000-000000000002','ai_screening');raise exception 'Cross-workspace entitlement oracle exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.company_subscriptions set status='past_due' where company_id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$begin
 begin perform public.require_workspace_feature('ai_screening');raise exception 'Expected inactive feature rejection';exception when raise_exception then if sqlerrm='Expected inactive feature rejection' then raise;end if;end;
end$$;
rollback;
