create table if not exists public.partner_integration_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  job_id uuid null references public.jobs(id) on delete cascade,
  request_type text not null default 'access' check (request_type in ('access','configuration')),
  request_note text null,
  status text not null default 'requested' check (status in ('requested','under_review','approved','declined','fulfilled','cancelled')),
  manager_notes text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_integration_requests_company_status_idx on public.partner_integration_requests(company_id,status,created_at desc);
create index if not exists partner_integration_requests_requester_idx on public.partner_integration_requests(requested_by,created_at desc);
create unique index if not exists partner_integration_requests_open_unique
  on public.partner_integration_requests(company_id,provider,requested_by,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),request_type)
  where status in ('requested','under_review','approved');
alter table public.partner_integration_requests enable row level security;

create or replace function public.partner_request_integration_access(p_provider text,p_job uuid default null,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();v_id uuid;v_category text;
begin
 if not private.partner_is_active(auth.uid()) then raise exception 'Active partner access required'; end if;
 select category into v_category from public.recruitment_integrations where company_id=v_company and provider=p_provider limit 1;
 if v_category is null then raise exception 'Unknown integration provider'; end if;
 if p_job is not null and not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 select id into v_id from public.partner_integration_requests
 where company_id=v_company and provider=p_provider and requested_by=auth.uid()
 and coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_job,'00000000-0000-0000-0000-000000000000'::uuid)
 and request_type='access' and status in ('requested','under_review','approved') order by created_at desc limit 1;
 if v_id is not null then return v_id; end if;
 insert into public.partner_integration_requests(company_id,provider,requested_by,job_id,request_type,request_note)
 values(v_company,p_provider,auth.uid(),p_job,'access',nullif(trim(coalesce(p_note,'')),'')) returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_integration_requests()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb)
 from public.partner_integration_requests r where r.company_id=private.current_company_id() and r.requested_by=auth.uid()
$$;

create or replace function public.manager_integration_requests()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();result jsonb;
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'provider',r.provider,'requested_by',r.requested_by,'job_id',r.job_id,'request_type',r.request_type,
  'request_note',r.request_note,'status',r.status,'manager_notes',r.manager_notes,'reviewed_by',r.reviewed_by,
  'reviewed_at',r.reviewed_at,'created_at',r.created_at,'updated_at',r.updated_at,'requester_name',p.full_name,
  'job_title',j.title,'display_name',i.display_name,'category',i.category,'integration_status',i.status
 ) order by r.created_at desc),'[]'::jsonb) into result
 from public.partner_integration_requests r
 left join public.profiles p on p.id=r.requested_by
 left join public.jobs j on j.id=r.job_id
 left join public.recruitment_integrations i on i.company_id=r.company_id and i.provider=r.provider
 where r.company_id=v_company;
 return result;
end $$;

create or replace function public.manager_review_integration_request(p_request uuid,p_status text,p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('under_review','approved','declined','fulfilled','cancelled') then raise exception 'Invalid request status'; end if;
 update public.partner_integration_requests set status=p_status,manager_notes=nullif(trim(coalesce(p_notes,'')),''),
 reviewed_by=auth.uid(),reviewed_at=case when p_status in ('approved','declined','fulfilled','cancelled') then now() else reviewed_at end,updated_at=now()
 where id=p_request and company_id=v_company;
 if not found then raise exception 'Integration request not found'; end if;
end $$;

create or replace function public.manager_update_recruitment_integration(p_provider text,p_status text,p_configuration_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('configuration_required','connected','paused','error') then raise exception 'Invalid integration status'; end if;
 update public.recruitment_integrations set status=p_status,configuration_note=nullif(trim(coalesce(p_configuration_note,'')),''),last_checked_at=now(),updated_at=now()
 where company_id=v_company and provider=p_provider;
 if not found then raise exception 'Integration provider not found'; end if;
 if p_status='connected' then
  update public.job_distribution_requests set status='requested',error_message=null,updated_at=now()
  where company_id=v_company and provider=p_provider and status='configuration_required';
  update public.partner_integration_requests set status='fulfilled',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),
  manager_notes=coalesce(manager_notes,'Provider connected by Vorlen management.')
  where company_id=v_company and provider=p_provider and status in ('requested','under_review','approved');
 end if;
end $$;

grant execute on function public.partner_request_integration_access(text,uuid,text) to authenticated;
grant execute on function public.partner_integration_requests() to authenticated;
grant execute on function public.manager_integration_requests() to authenticated;
grant execute on function public.manager_review_integration_request(uuid,text,text) to authenticated;
grant execute on function public.manager_update_recruitment_integration(text,text,text) to authenticated;
