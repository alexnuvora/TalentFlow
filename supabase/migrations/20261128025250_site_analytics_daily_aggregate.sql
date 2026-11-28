-- Daily aggregate website analytics. No browser identifier, full URL, IP or form content.
create table if not exists public.site_analytics_daily (
 event_day date not null,
 page text not null check (char_length(page) between 1 and 100 and page ~ '^/[a-z0-9/-]*$'),
 source text not null check (source in ('direct-or-unknown','google','bing','facebook','instagram','linkedin','other')),
 event_name text not null check (event_name in ('page_view','employer_enquiry','candidate_application','interest_registered')),
 event_count integer not null default 0 check (event_count between 0 and 1000000),
 primary key (event_day,page,source,event_name)
);
alter table public.site_analytics_daily enable row level security;
revoke all on public.site_analytics_daily from public,anon,authenticated;
grant select,insert,update on public.site_analytics_daily to service_role;

create or replace function public.record_site_analytics(p_page text,p_source text,p_event text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_page not in ('/','/about','/employers','/our-approach','/contact','/candidates','/partners','/careers',
 '/services/permanent-recruitment','/services/candidate-sourcing','/services/recruitment-for-smes',
 '/sectors/technology','/sectors/sales-business-development','/sectors/finance-accounting','/sectors/engineering',
 '/sectors/hgv-driver-recruitment','/sectors/transport-logistics-recruitment-cheshire','/sectors/telesales-recruitment',
 '/sectors/childrens-residential-care-recruitment','/sectors/electrical-design-engineer-recruitment',
 '/locations/manchester','/locations/greater-manchester','/guides/employer-recruitment-questions',
 '/guides/choosing-a-recruitment-agency','/guides/how-to-hire-hgv-drivers','/tools/recruitment-fee-calculator',
 '/tools/recruitment-brief-template','/careers/opportunity','/campaign/opportunity') then
   raise exception 'Invalid public page';
 end if;
 if p_event='employer_enquiry' and p_page<>'/contact' then raise exception 'Invalid event page'; end if;
 if p_event in ('candidate_application','interest_registered') and p_page<>'/careers/opportunity' then raise exception 'Invalid event page'; end if;
 insert into public.site_analytics_daily(event_day,page,source,event_name,event_count)
 values ((now() at time zone 'UTC')::date,p_page,p_source,p_event,1)
 on conflict (event_day,page,source,event_name) do update
 set event_count=least(public.site_analytics_daily.event_count+1,1000000);
end;
$$;
revoke all on function public.record_site_analytics(text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_analytics(text,text,text) to service_role;

create or replace function public.site_analytics_snapshot(p_days integer default 28)
returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as (
  select * from public.site_analytics_daily
  where event_day between (now() at time zone 'UTC')::date-(greatest(1,least(coalesce(p_days,28),90))-1)
  and (now() at time zone 'UTC')::date
 ),
 totals as (select event_name,sum(event_count)::bigint as total from filtered group by event_name),
 pages as (select page,sum(event_count)::bigint as views from filtered where event_name='page_view' group by page order by views desc,page),
 sources as (select source,sum(event_count)::bigint as views from filtered where event_name='page_view' group by source order by views desc,source),
 daily as (select event_day,sum(event_count)::bigint as views from filtered where event_name='page_view' group by event_day order by event_day)
 select jsonb_build_object(
  'totals',coalesce((select jsonb_object_agg(event_name,total) from totals),'{}'::jsonb),
  'pages',coalesce((select jsonb_agg(to_jsonb(p) order by p.views desc,p.page) from pages p),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.views desc,s.source) from sources s),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.event_day) from daily d),'[]'::jsonb)
 );
$$;
revoke all on function public.site_analytics_snapshot(integer) from public,anon,authenticated;
grant execute on function public.site_analytics_snapshot(integer) to service_role;

