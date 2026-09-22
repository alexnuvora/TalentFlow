alter table public.saas_plans add column if not exists stripe_price_id text, add column if not exists stripe_product_id text;
update public.saas_plans set stripe_product_id=case code when 'starter' then 'prod_VHijGkuCR0ITsd' when 'growth' then 'prod_VHij6qAs4nQiWo' when 'scale' then 'prod_VHijG2CVfg2NJR' end,
stripe_price_id=case code when 'starter' then 'price_1UH9HpK38GdjphewKuBhWmHb' when 'growth' then 'price_1UH9HsK38Gdjphewz3rhMWAh' when 'scale' then 'price_1UH9HyK38Gdjphewm5FXNTp2' end,
candidate_limit=case code when 'starter' then 500 when 'growth' then 25000 else 100000 end,
active_job_limit=case code when 'starter' then 10 when 'growth' then 50 else 200 end,
recruiter_limit=case code when 'starter' then 1 when 'growth' then 5 else 15 end,
features=case code
when 'starter' then '{"ai_screening":true,"ai_screening_limit":100,"candidate_portal":true,"recruiter_workspace":true,"client_portal":false,"ceo_dashboard":false,"automations":false,"api_access":false,"mcp_access":false,"white_label":false}'::jsonb
when 'growth' then '{"ai_screening":true,"ai_screening_limit":500,"candidate_portal":true,"recruiter_workspace":true,"client_portal":true,"ceo_dashboard":true,"automations":true,"api_access":true,"mcp_access":true,"white_label":false}'::jsonb
else '{"ai_screening":true,"ai_screening_limit":-1,"candidate_portal":true,"recruiter_workspace":true,"client_portal":true,"ceo_dashboard":true,"automations":true,"api_access":true,"mcp_access":true,"white_label":true,"priority_support":true}'::jsonb end
where code in ('starter','growth','scale');
create table if not exists public.billing_events(id uuid primary key default gen_random_uuid(),company_id uuid references public.companies(id) on delete cascade,stripe_event_id text unique,event_type text not null,status text not null default 'received',payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon;
grant select on public.billing_events to authenticated;
drop policy if exists billing_events_manager_read on public.billing_events;
create policy billing_events_manager_read on public.billing_events for select to authenticated using(company_id=public.current_company_id() and public.is_manager());
create table if not exists public.subscription_payment_history(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,stripe_invoice_id text unique,stripe_payment_intent_id text,amount_paid numeric(12,2) not null default 0,currency text not null default 'GBP',status text not null,invoice_url text,invoice_pdf text,paid_at timestamptz,created_at timestamptz not null default now());
alter table public.subscription_payment_history enable row level security;
revoke all on public.subscription_payment_history from anon;
grant select on public.subscription_payment_history to authenticated;
drop policy if exists subscription_payment_history_read on public.subscription_payment_history;
create policy subscription_payment_history_read on public.subscription_payment_history for select to authenticated using(company_id=public.current_company_id());
create or replace function public.ensure_starter_subscription(p_company_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and company_id=p_company_id) then raise exception 'Forbidden'; end if;
 insert into public.company_subscriptions(company_id,plan_code,status,provider) values(p_company_id,'starter','active','internal') on conflict(company_id) do nothing;
end $$;
revoke all on function public.ensure_starter_subscription(uuid) from public,anon; grant execute on function public.ensure_starter_subscription(uuid) to authenticated;
