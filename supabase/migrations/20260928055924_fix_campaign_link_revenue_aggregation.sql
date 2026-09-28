create or replace function public.campaign_link_performance()
returns table(link_id uuid,campaign_id uuid,campaign_name text,label text,slug text,source text,medium text,campaign text,content text,active boolean,page_views bigint,application_starts bigint,applications bigint,placements bigint,revenue numeric)
language sql stable set search_path=''
as $$
  with ev as (
    select ce.link_id,count(*) filter(where ce.event_type='page_view') page_views,count(*) filter(where ce.event_type='application_started') application_starts
    from public.campaign_events ce where ce.link_id is not null group by ce.link_id
  ),
  apps as (
    select nullif(a.source_details->>'campaign_link_id','')::uuid link_id,count(*) applications
    from public.applications a
    where coalesce(a.source_details->>'campaign_link_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    group by 1
  ),
  placed_rows as (
    select distinct nullif(a.source_details->>'campaign_link_id','')::uuid link_id,p.id placement_id,p.fee_amount
    from public.placements p join public.applications a on a.company_id=p.company_id and a.job_id=p.job_id and a.candidate_id=p.candidate_id
    where p.invoice_status <> 'void'
      and coalesce(a.source_details->>'campaign_link_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  pls as (select link_id,count(*) placements,coalesce(sum(fee_amount),0) revenue from placed_rows group by link_id)
  select l.id,l.campaign_id,c.name,l.label,l.slug,l.source,l.medium,l.campaign,l.content,l.active,
    coalesce(ev.page_views,0),coalesce(ev.application_starts,0),coalesce(apps.applications,0),coalesce(pls.placements,0),coalesce(pls.revenue,0)
  from public.campaign_links l join public.campaigns c on c.id=l.campaign_id and c.company_id=l.company_id
  left join ev on ev.link_id=l.id left join apps on apps.link_id=l.id left join pls on pls.link_id=l.id
  where l.company_id=public.current_company_id() and public.is_manager()
  order by l.created_at desc;
$$;
revoke all on function public.campaign_link_performance() from public,anon;
grant execute on function public.campaign_link_performance() to authenticated;
