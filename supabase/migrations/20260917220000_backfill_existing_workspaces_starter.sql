-- Ensure the Starter catalogue entry exists and backfill every existing company that has no subscription.
-- Existing paid/trial subscriptions are intentionally left unchanged.
insert into public.saas_plans(code,name,monthly_price_gbp,recruiter_limit,active_job_limit,candidate_limit,automation_limit,features,active)
values('starter','Starter',49,1,10,2500,5,jsonb_build_object('ai_screening',true,'client_portal',true,'automations',false,'priority_support',false),true)
on conflict(code) do update set name=excluded.name,monthly_price_gbp=excluded.monthly_price_gbp,recruiter_limit=excluded.recruiter_limit,active_job_limit=excluded.active_job_limit,candidate_limit=excluded.candidate_limit,automation_limit=excluded.automation_limit,features=excluded.features,active=true;

insert into public.company_subscriptions(company_id,plan_code,status,current_period_start,current_period_end,provider,created_at,updated_at)
select c.id,'starter','active',now(),now()+interval '1 month','manual',now(),now()
from public.companies c
where not exists(select 1 from public.company_subscriptions s where s.company_id=c.id)
on conflict(company_id) do nothing;
