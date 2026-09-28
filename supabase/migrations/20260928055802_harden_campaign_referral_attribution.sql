create or replace function public.track_campaign_event(
  p_campaign_slug text,
  p_event_type text,
  p_session_id text default null,
  p_link_slug text default null,
  p_landing_path text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  c public.campaigns%rowtype;
  l public.campaign_links%rowtype;
  v_link_slug text:=nullif(btrim(coalesce(p_link_slug,'')),'');
begin
  if p_event_type not in ('page_view','cta_click','application_started') then return false; end if;
  select * into c from public.campaigns where slug=p_campaign_slug and status='active' limit 1;
  if not found then return false; end if;
  if v_link_slug is not null then
    select * into l from public.campaign_links
    where slug=v_link_slug and campaign_id=c.id and company_id=c.company_id and active=true
    limit 1;
    if not found then return false; end if;
  end if;
  insert into public.campaign_events(company_id,campaign_id,link_id,event_type,session_id,landing_path,metadata)
  values(c.company_id,c.id,case when v_link_slug is null then null else l.id end,p_event_type,left(p_session_id,120),left(p_landing_path,500),coalesce(p_metadata,'{}'::jsonb));
  return true;
end
$$;
revoke all on function public.track_campaign_event(text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.track_campaign_event(text,text,text,text,text,jsonb) to service_role;

create or replace function public.campaign_link_performance()
returns table(link_id uuid,campaign_id uuid,campaign_name text,label text,slug text,source text,medium text,campaign text,content text,active boolean,page_views bigint,application_starts bigint,applications bigint,placements bigint,revenue numeric)
language sql stable set search_path=''
as $$
  with ev as (
    select ce.link_id,
      count(*) filter(where ce.event_type='page_view') page_views,
      count(*) filter(where ce.event_type='application_started') application_starts
    from public.campaign_events ce where ce.link_id is not null group by ce.link_id
  ),
  apps as (
    select nullif(a.source_details->>'campaign_link_id','')::uuid link_id,count(*) applications
    from public.applications a
    where coalesce(a.source_details->>'campaign_link_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    group by 1
  ),
  pls as (
    select nullif(a.source_details->>'campaign_link_id','')::uuid link_id,count(distinct p.id) placements,coalesce(sum(distinct p.fee_amount),0) revenue
    from public.placements p join public.applications a on a.company_id=p.company_id and a.job_id=p.job_id and a.candidate_id=p.candidate_id
    where p.invoice_status <> 'void'
      and coalesce(a.source_details->>'campaign_link_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    group by 1
  )
  select l.id,l.campaign_id,c.name,l.label,l.slug,l.source,l.medium,l.campaign,l.content,l.active,
    coalesce(ev.page_views,0),coalesce(ev.application_starts,0),coalesce(apps.applications,0),coalesce(pls.placements,0),coalesce(pls.revenue,0)
  from public.campaign_links l join public.campaigns c on c.id=l.campaign_id and c.company_id=l.company_id
  left join ev on ev.link_id=l.id left join apps on apps.link_id=l.id left join pls on pls.link_id=l.id
  where l.company_id=public.current_company_id() and public.is_manager()
  order by l.created_at desc;
$$;
revoke all on function public.campaign_link_performance() from public,anon;
grant execute on function public.campaign_link_performance() to authenticated;

create or replace function private.inherit_placement_campaign()
returns trigger language plpgsql set search_path=''
as $$
declare v_campaign uuid;
begin
  if new.campaign_id is null and new.job_id is not null and new.candidate_id is not null then
    select case when coalesce(a.source_details->>'campaign_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (a.source_details->>'campaign_id')::uuid else null end
    into v_campaign
    from public.applications a
    where a.company_id=new.company_id and a.job_id=new.job_id and a.candidate_id=new.candidate_id
    order by a.submitted_at desc limit 1;
    if v_campaign is null then
      select ae.campaign_id into v_campaign
      from public.application_events ae join public.applications a on a.id=ae.application_id
      where a.company_id=new.company_id and a.job_id=new.job_id and a.candidate_id=new.candidate_id and ae.campaign_id is not null
      order by ae.created_at desc limit 1;
    end if;
    if v_campaign is not null and exists(select 1 from public.campaigns c where c.id=v_campaign and c.company_id=new.company_id) then new.campaign_id:=v_campaign; end if;
  end if;
  return new;
end
$$;
drop trigger if exists trg_inherit_placement_campaign on public.placements;
create trigger trg_inherit_placement_campaign before insert or update of job_id,candidate_id,campaign_id on public.placements for each row execute function private.inherit_placement_campaign();
revoke all on function private.inherit_placement_campaign() from public,anon,authenticated;
