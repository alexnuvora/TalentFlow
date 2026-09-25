
-- Granular client portal roles while preserving the existing viewer/client_id model.

create table if not exists public.client_portal_memberships(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  full_name text,
  portal_role text not null default 'hiring_manager'
    check(portal_role in ('admin','hiring_manager','reviewer','read_only')),
  status text not null default 'active'
    check(status in ('active','revoked')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id),
  unique(client_id,user_id)
);

create index if not exists client_portal_memberships_client_idx
  on public.client_portal_memberships(company_id,client_id,status);
create index if not exists client_portal_memberships_created_by_idx
  on public.client_portal_memberships(created_by);

alter table public.client_portal_memberships enable row level security;

drop policy if exists "client portal membership read" on public.client_portal_memberships;
create policy "client portal membership read"
on public.client_portal_memberships
for select to authenticated
using(
  company_id=(select private.current_company_id())
  and (
    user_id=(select auth.uid())
    or (select private.is_manager())
  )
);

revoke insert,update,delete on public.client_portal_memberships from authenticated;

-- Backfill current client viewers as hiring managers so existing portals keep working.
insert into public.client_portal_memberships(
  company_id,client_id,user_id,email,full_name,portal_role,status,created_by
)
select
  p.company_id,p.client_id,p.id,
  coalesce(u.email,'unknown@invalid.local'),
  p.full_name,
  'hiring_manager',
  'active',
  null
from public.profiles p
join auth.users u on u.id=p.id
where p.role='viewer' and p.client_id is not null
on conflict(user_id) do nothing;

create or replace function private.current_client_portal_context()
returns table(company_id uuid,client_id uuid,portal_role text)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return query
  select m.company_id,m.client_id,m.portal_role
  from public.client_portal_memberships m
  join public.profiles p on p.id=m.user_id
  where m.user_id=auth.uid()
    and m.status='active'
    and p.role='viewer'
    and p.company_id=m.company_id
    and p.client_id=m.client_id
  limit 1;

  if found then return; end if;

  -- Compatibility fallback for any legacy viewer not yet represented in memberships.
  return query
  select p.company_id,p.client_id,'hiring_manager'::text
  from public.profiles p
  where p.id=auth.uid()
    and p.role='viewer'
    and p.client_id is not null
  limit 1;
end
$$;

revoke all on function private.current_client_portal_context()
from public,anon,authenticated;

create or replace function public.client_portal_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_client uuid;
  v_role text;
begin
  select c.company_id,c.client_id,c.portal_role
  into v_company,v_client,v_role
  from private.current_client_portal_context() c;

  if v_client is null then
    raise exception 'Client portal access required';
  end if;

  return jsonb_build_object(
    'portal_role',v_role,
    'can_review_candidates',v_role in ('admin','hiring_manager','reviewer'),
    'can_request_vacancies',v_role in ('admin','hiring_manager'),
    'can_manage_members',v_role='admin'
  );
end
$$;

revoke all on function public.client_portal_permissions() from public,anon;
grant execute on function public.client_portal_permissions() to authenticated;

create or replace function private.client_portal_data_authorised()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_client uuid;
  v_role text;
  result jsonb;
begin
  select c.company_id,c.client_id,c.portal_role
  into v_company,v_client,v_role
  from private.current_client_portal_context() c;

  if v_client is null then raise exception 'Client access required'; end if;
  if not public.workspace_feature_enabled(v_company,'client_portal') then
    raise exception 'This feature requires an active subscription that includes it';
  end if;

  select jsonb_build_object(
    'portal_role',v_role,
    'permissions',jsonb_build_object(
      'can_review_candidates',v_role in ('admin','hiring_manager','reviewer'),
      'can_request_vacancies',v_role in ('admin','hiring_manager'),
      'can_manage_members',v_role='admin'
    ),
    'client',(select jsonb_build_object('company_name',company_name) from public.clients where id=v_client and company_id=v_company),
    'jobs',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'location',location,'employment_type',employment_type))
      from public.jobs where client_id=v_client and company_id=v_company
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'status',s.status,'feedback',s.client_feedback,
        'summary',s.recruiter_summary,'headline',s.headline,
        'key_strengths',coalesce(s.key_strengths,'[]'::jsonb),
        'concerns',coalesce(s.concerns,'[]'::jsonb),
        'submitted_at',s.submitted_at,'client_decision',s.client_decision,
        'client_feedback_at',s.client_feedback_at,
        'has_cv',(c.resume_path is not null),
        'candidates',jsonb_build_object(
          'full_name',c.full_name,'location',c.location,
          'experience_summary',c.experience_summary,
          'training_qualifications',c.training_qualifications,
          'authorisations',c.authorisations
        ),
        'jobs',jsonb_build_object('title',j.title)
      ))
      from public.candidate_submissions s
      join public.candidates c on c.id=s.candidate_id
      join public.jobs j on j.id=s.job_id
      where s.client_id=v_client
        and s.company_id=v_company
        and s.status not in ('draft','withdrawn','approved_to_send')
    ),'[]'::jsonb),
    'interviews',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,
        'meeting_url',i.meeting_url,'status',i.status,
        'candidates',jsonb_build_object('full_name',c.full_name),
        'jobs',jsonb_build_object('title',j.title)
      ))
      from public.interviews i
      join public.candidates c on c.id=i.candidate_id
      join public.jobs j on j.id=i.job_id
      where i.client_id=v_client
        and i.company_id=v_company
        and exists(
          select 1 from public.candidate_submissions s
          where s.candidate_id=i.candidate_id
            and s.job_id=i.job_id
            and s.client_id=v_client
            and s.status not in ('draft','withdrawn','approved_to_send')
        )
    ),'[]'::jsonb),
    'vacancy_requests',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',v.id,'title',v.title,'location',v.location,
        'employment_type',v.employment_type,'salary_min',v.salary_min,
        'salary_max',v.salary_max,'hiring_need',v.hiring_need,
        'desired_start_date',v.desired_start_date,'status',v.status,
        'manager_notes',v.manager_notes,'created_at',v.created_at
      ) order by v.created_at desc)
      from public.client_vacancy_requests v
      where v.client_id=v_client and v.company_id=v_company
    ),'[]'::jsonb)
  ) into result;

  return result;
end
$$;

create or replace function public.client_portal_action(
  p_submission_id uuid,
  p_action text,
  p_feedback text default null
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_role text;
begin
  select c.portal_role into v_role
  from private.current_client_portal_context() c;

  if v_role is null then raise exception 'Client portal access required'; end if;
  if v_role not in ('admin','hiring_manager','reviewer') then
    raise exception 'Your client portal role is read-only';
  end if;

  return private.client_portal_action(p_submission_id,p_action,p_feedback);
end
$$;

create or replace function public.client_create_vacancy_request(
  p_title text,
  p_hiring_need text,
  p_location text default null,
  p_employment_type text default null,
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_desired_start_date date default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_client uuid;
  v_role text;
  v_id uuid;
begin
  select c.company_id,c.client_id,c.portal_role
  into v_company,v_client,v_role
  from private.current_client_portal_context() c;

  if v_client is null then raise exception 'Client portal access required'; end if;
  if v_role not in ('admin','hiring_manager') then
    raise exception 'Your client portal role cannot request vacancies';
  end if;

  if length(btrim(coalesce(p_title,'')))<2
     or length(btrim(coalesce(p_hiring_need,'')))<10 then
    raise exception 'Title and hiring requirement are required';
  end if;
  if p_salary_min is not null and p_salary_min<0 then
    raise exception 'Minimum salary cannot be negative';
  end if;
  if p_salary_max is not null and p_salary_max<0 then
    raise exception 'Maximum salary cannot be negative';
  end if;
  if p_salary_min is not null and p_salary_max is not null and p_salary_max<p_salary_min then
    raise exception 'Maximum salary cannot be lower than minimum salary';
  end if;

  insert into public.client_vacancy_requests(
    company_id,client_id,requested_by,title,location,employment_type,
    salary_min,salary_max,hiring_need,desired_start_date
  )
  values(
    v_company,v_client,auth.uid(),left(btrim(p_title),300),
    nullif(left(btrim(coalesce(p_location,'')),300),''),
    nullif(left(btrim(coalesce(p_employment_type,'')),100),''),
    p_salary_min,p_salary_max,left(btrim(p_hiring_need),10000),p_desired_start_date
  )
  returning id into v_id;

  insert into public.partner_communication_events(
    company_id,client_id,event_type,channel,direction,subject,summary,metadata
  )
  values(
    v_company,v_client,'portal','portal','inbound',
    'Client vacancy request',
    'Client requested a vacancy: '||left(btrim(p_title),300)||'. '||left(btrim(p_hiring_need),5000),
    jsonb_build_object('vacancy_request_id',v_id,'portal_role',v_role)
  );

  return v_id;
end
$$;

create or replace function public.manager_update_client_portal_member(
  p_user uuid,
  p_client uuid,
  p_role text,
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_company uuid:=private.current_company_id();
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  if p_role not in ('admin','hiring_manager','reviewer','read_only') then
    raise exception 'Invalid client portal role';
  end if;
  if p_status not in ('active','revoked') then
    raise exception 'Invalid membership status';
  end if;

  update public.client_portal_memberships m
  set portal_role=p_role,status=p_status,updated_at=now()
  where m.user_id=p_user
    and m.client_id=p_client
    and m.company_id=v_company;

  if not found then raise exception 'Client portal member not found'; end if;
end
$$;

revoke all on function public.manager_update_client_portal_member(uuid,uuid,text,text)
from public,anon;
grant execute on function public.manager_update_client_portal_member(uuid,uuid,text,text)
to authenticated;
