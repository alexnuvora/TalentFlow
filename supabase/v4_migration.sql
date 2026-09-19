-- Vorlen V4: campaign attribution, automation sequences and billing integration records
create table if not exists public.campaigns (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 client_id uuid references public.clients(id) on delete cascade, name text not null, source text not null, medium text, campaign text, landing_path text,
 budget numeric(12,2) not null default 0, starts_at timestamptz, ends_at timestamptz, active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_campaigns_company on public.campaigns(company_id,active);
create table if not exists public.application_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, application_id uuid not null references public.applications(id) on delete cascade,
 event_type text not null, source text, medium text, campaign text, content text, landing_path text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists idx_application_events_app on public.application_events(application_id,created_at);
create index if not exists idx_application_events_campaign on public.application_events(company_id,campaign);
create table if not exists public.automation_sequences (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, name text not null, trigger_event text not null, channel text not null check(channel in ('email','sms','whatsapp')), active boolean not null default false,
 provider text, from_name text, from_address text, template_id text, steps jsonb not null default '[]', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.billing_connections (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, provider text not null check(provider in ('stripe','xero')), status text not null default 'disconnected', account_label text, external_account_id text, connected_at timestamptz, metadata jsonb not null default '{}', created_at timestamptz not null default now(), unique(company_id,provider)
);
alter table public.campaigns enable row level security; alter table public.application_events enable row level security; alter table public.automation_sequences enable row level security; alter table public.billing_connections enable row level security;
drop policy if exists "campaigns manager" on public.campaigns; create policy "campaigns manager" on public.campaigns for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
drop policy if exists "events manager" on public.application_events; create policy "events manager" on public.application_events for select using(company_id=public.current_company_id() and public.is_manager());
drop policy if exists "automation manager" on public.automation_sequences; create policy "automation manager" on public.automation_sequences for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
drop policy if exists "billing manager" on public.billing_connections; create policy "billing manager" on public.billing_connections for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());

create or replace function public.check_application_rate_limit(p_key text, p_limit integer default 20, p_window_seconds integer default 3600) returns boolean
language plpgsql security definer set search_path=public as $$
declare r public.application_rate_limits%rowtype; begin
 select * into r from application_rate_limits where key=p_key for update;
 if not found then insert into application_rate_limits(key,window_started_at,request_count) values(p_key,now(),1); return true; end if;
 if extract(epoch from now()-r.window_started_at)>p_window_seconds then update application_rate_limits set window_started_at=now(),request_count=1 where key=p_key; return true; end if;
 if r.request_count>=p_limit then return false; end if;
 update application_rate_limits set request_count=request_count+1 where key=p_key; return true;
end; $$;

-- The public application endpoint is the only intended caller of this limiter.
revoke all on function public.check_application_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.check_application_rate_limit(text, integer, integer) to service_role;
