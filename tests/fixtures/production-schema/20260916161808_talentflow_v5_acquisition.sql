-- TalentFlow V5: acquisition engine, campaign landing pages, referral links and ROI attribution.
-- Run after schema.sql, commercial_migration.sql and v4_migration.sql.

alter table public.application_events add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.placements add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

alter table public.campaigns add column if not exists job_id uuid references public.jobs(id) on delete set null;
alter table public.campaigns add column if not exists slug text;
alter table public.campaigns add column if not exists headline text;
alter table public.campaigns add column if not exists subheadline text;
alter table public.campaigns add column if not exists cta_text text not null default 'Apply now';
alter table public.campaigns add column if not exists logo_url text;
alter table public.campaigns add column if not exists status text not null default 'draft';

create unique index if not exists idx_campaigns_company_slug on public.campaigns(company_id, slug) where slug is not null;
create index if not exists idx_application_events_campaign_id on public.application_events(campaign_id, created_at);
create index if not exists idx_placements_campaign_id on public.placements(campaign_id);

create table if not exists public.campaign_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  slug text not null,
  label text not null,
  source text not null,
  medium text not null default 'referral',
  campaign text,
  content text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, slug)
);
create index if not exists idx_campaign_links_campaign on public.campaign_links(campaign_id, active);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  link_id uuid references public.campaign_links(id) on delete set null,
  event_type text not null check(event_type in ('page_view','cta_click','application_started')),
  session_id text,
  landing_path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_campaign_events_campaign on public.campaign_events(campaign_id, created_at);
create index if not exists idx_campaign_events_type on public.campaign_events(company_id, event_type, created_at);

alter table public.campaign_links enable row level security;
alter table public.campaign_events enable row level security;

drop policy if exists "campaigns public" on public.campaigns;
create policy "campaigns public" on public.campaigns for select using (status='active' and slug is not null);

drop policy if exists "campaign links public" on public.campaign_links;
create policy "campaign links public" on public.campaign_links for select using (active=true and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='active'));

-- Managers can create/update links and read analytics. Public clients never get write access.
drop policy if exists "campaign links manager" on public.campaign_links;
create policy "campaign links manager" on public.campaign_links for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
drop policy if exists "campaign events manager" on public.campaign_events;
create policy "campaign events manager" on public.campaign_events for select using(company_id=public.current_company_id() and public.is_manager());

create or replace function public.track_campaign_event(
  p_campaign_slug text,
  p_event_type text,
  p_session_id text default null,
  p_link_slug text default null,
  p_landing_path text default null,
  p_metadata jsonb default '{}'
) returns boolean
language plpgsql security definer set search_path=public
as $$
declare c public.campaigns%rowtype; l public.campaign_links%rowtype;
begin
  if p_event_type not in ('page_view','cta_click','application_started') then return false; end if;
  select * into c from public.campaigns where slug=p_campaign_slug and status='active' limit 1;
  if not found then return false; end if;
  if p_link_slug is not null then
    select * into l from public.campaign_links where slug=p_link_slug and campaign_id=c.id and active=true limit 1;
  end if;
  insert into public.campaign_events(company_id,campaign_id,link_id,event_type,session_id,landing_path,metadata)
  values(c.company_id,c.id,l.id,p_event_type,left(p_session_id,120),left(p_landing_path,500),coalesce(p_metadata,'{}'));
  return true;
end;
$$;
revoke all on function public.track_campaign_event(text,text,text,text,text,jsonb) from public;
grant execute on function public.track_campaign_event(text,text,text,text,text,jsonb) to anon, authenticated, service_role;

create or replace function public.campaign_performance()
returns table(
  campaign_id uuid, campaign_name text, slug text, budget numeric, status text,
  page_views bigint, cta_clicks bigint, applications bigint, placements bigint,
  revenue numeric, cost_per_application numeric, cost_per_placement numeric, roi numeric
)
language sql stable security definer set search_path=public
as $$
  with ev as (
    select campaign_id,
      count(*) filter(where event_type='page_view') page_views,
      count(*) filter(where event_type='cta_click') cta_clicks
    from public.campaign_events
    group by campaign_id
  ), apps as (
    select campaign_id, count(*) applications
    from public.application_events
    where event_type='application_submitted' and campaign_id is not null
    group by campaign_id
  ), pls as (
    select campaign_id, count(*) placements, coalesce(sum(fee_amount),0) revenue
    from public.placements
    where campaign_id is not null and invoice_status <> 'void'
    group by campaign_id
  )
  select c.id,c.name,c.slug,c.budget,c.status,
    coalesce(ev.page_views,0),coalesce(ev.cta_clicks,0),coalesce(apps.applications,0),coalesce(pls.placements,0),coalesce(pls.revenue,0),
    case when coalesce(apps.applications,0)>0 then round(c.budget/coalesce(apps.applications,0),2) else null end,
    case when coalesce(pls.placements,0)>0 then round(c.budget/coalesce(pls.placements,0),2) else null end,
    case when c.budget>0 then round(((coalesce(pls.revenue,0)-c.budget)/c.budget)*100,2) else null end
  from public.campaigns c
  left join ev on ev.campaign_id=c.id
  left join apps on apps.campaign_id=c.id
  left join pls on pls.campaign_id=c.id
  where c.company_id=public.current_company_id() and public.is_manager()
  order by c.created_at desc;
$$;
revoke all on function public.campaign_performance() from public;
grant execute on function public.campaign_performance() to authenticated;

-- Keep the campaign attribution on placement creation if it can be inferred from the candidate's latest submitted application.
create or replace function public.infer_placement_campaign() returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if new.campaign_id is null then
    select ae.campaign_id into new.campaign_id
    from public.applications a
    join public.application_events ae on ae.application_id=a.id and ae.event_type='application_submitted'
    where a.candidate_id=new.candidate_id and ae.campaign_id is not null
    order by ae.created_at desc limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_infer_placement_campaign on public.placements;
create trigger trg_infer_placement_campaign before insert on public.placements for each row execute function public.infer_placement_campaign();

-- Candidate nurture queue. Sequences remain opt-in: only active sequences are enrolled.
create table if not exists public.automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sequence_id uuid not null references public.automation_sequences(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  current_step integer not null default 0,
  status text not null default 'queued' check(status in ('queued','processing','completed','cancelled','failed')),
  next_run_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id,candidate_id,application_id)
);
create index if not exists idx_automation_enrollments_due on public.automation_enrollments(company_id,status,next_run_at);
alter table public.automation_enrollments enable row level security;
drop policy if exists "automation enrollments manager" on public.automation_enrollments;
create policy "automation enrollments manager" on public.automation_enrollments for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());

