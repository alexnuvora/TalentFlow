create table if not exists public.partner_candidate_pipeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  stage text not null default 'sourced'
    check (stage in ('sourced','contacted','screening','qualified','recommended','paused','rejected')),
  notes text,
  next_action text,
  next_action_at timestamptz,
  manager_status text not null default 'none'
    check (manager_status in ('none','pending','approved','declined')),
  manager_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,partner_id,candidate_id,job_id)
);

create index if not exists idx_partner_candidate_pipeline_partner
  on public.partner_candidate_pipeline(company_id,partner_id,stage,updated_at desc);
create index if not exists idx_partner_candidate_pipeline_review
  on public.partner_candidate_pipeline(company_id,manager_status,updated_at desc);

alter table public.partner_candidate_pipeline enable row level security;

drop policy if exists "partner candidate pipeline select" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline select"
on public.partner_candidate_pipeline for select to authenticated
using (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
);

drop policy if exists "partner candidate pipeline insert" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline insert"
on public.partner_candidate_pipeline for insert to authenticated
with check (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
);

drop policy if exists "partner candidate pipeline update" on public.partner_candidate_pipeline;
create policy "partner candidate pipeline update"
on public.partner_candidate_pipeline for update to authenticated
using (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
)
with check (
  company_id = private.current_company_id()
  and (private.is_manager() or (partner_id = auth.uid() and private.partner_is_active()))
);

create or replace function public.enforce_partner_candidate_pipeline()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_manager boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
  new.updated_at := now();
  if v_manager then
    if tg_op='UPDATE' and new.manager_status is distinct from old.manager_status then
      new.reviewed_at := now();
      new.reviewed_by := coalesce(auth.uid(),new.reviewed_by);
    end if;
    return new;
  end if;
  if not private.partner_is_active() then raise exception 'Active partner access required'; end if;
  if not public.candidate_processing_allowed(private.current_company_id()) then raise exception 'Candidate processing is not active'; end if;
  if tg_op='INSERT' then
    new.company_id := private.current_company_id();
    new.partner_id := auth.uid();
    new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
    new.manager_notes := null; new.reviewed_by := null; new.reviewed_at := null;
  else
    if old.partner_id <> auth.uid() or old.company_id <> private.current_company_id() then raise exception 'You may only update your own candidate pipeline'; end if;
    new.company_id := old.company_id; new.partner_id := old.partner_id; new.candidate_id := old.candidate_id; new.job_id := old.job_id;
    new.manager_notes := old.manager_notes; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    if old.manager_status in ('approved','declined') then raise exception 'This recommendation has been reviewed by Vorlen and is locked'; end if;
    new.manager_status := case when new.stage='recommended' then 'pending' else 'none' end;
  end if;
  if not exists (select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.candidate_id=new.candidate_id and a.completed_at is null) then raise exception 'Candidate is not assigned to your partner portfolio'; end if;
  if not exists (select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.job_id=new.job_id and a.completed_at is null) then raise exception 'Vacancy is not assigned to your partner portfolio'; end if;
  if new.stage='recommended' and not exists (
    select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id
      and c.work_seeker_terms_agreed_at is not null and nullif(btrim(c.work_seeker_terms_evidence),'') is not null
  ) then raise exception 'Candidate work-seeker terms evidence is required before recommendation'; end if;
  return new;
end $$;

drop trigger if exists trg_partner_candidate_pipeline on public.partner_candidate_pipeline;
create trigger trg_partner_candidate_pipeline before insert or update on public.partner_candidate_pipeline
for each row execute function public.enforce_partner_candidate_pipeline();

revoke all on table public.partner_candidate_pipeline from anon;
grant select,insert,update on table public.partner_candidate_pipeline to authenticated;
grant all on table public.partner_candidate_pipeline to service_role;

create or replace function public.source_partner_candidate(
  p_full_name text,p_email text,p_phone text default null,p_location text default null,p_linkedin_url text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_company uuid; v_id uuid; v_specialism text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select p.company_id into v_company from public.profiles p where p.id=v_user and p.role='partner';
  if v_company is null or not private.partner_is_active(v_user) then raise exception 'Active partner access required'; end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
  select pp.specialism into v_specialism from public.partner_profiles pp where pp.user_id=v_user and pp.company_id=v_company and pp.active;
  if coalesce(v_specialism,'') not in ('candidate_sourcer','hybrid') then raise exception 'Candidate sourcing is not enabled for this partner profile'; end if;
  if nullif(btrim(p_full_name),'') is null or nullif(btrim(p_email),'') is null then raise exception 'Candidate name and email are required'; end if;
  insert into public.candidates(company_id,full_name,email,phone,location,linkedin_url,stage,source,lawful_basis)
  values(v_company,btrim(p_full_name),lower(btrim(p_email)),nullif(btrim(p_phone),''),nullif(btrim(p_location),''),nullif(btrim(p_linkedin_url),''),'new','partner_sourced','legitimate_interests')
  returning id into v_id;
  insert into public.partner_assignments(company_id,partner_id,candidate_id,priority,objective)
  values(v_company,v_user,v_id,'normal','Source and progress candidate');
  return v_id;
end $$;

revoke all on function public.source_partner_candidate(text,text,text,text,text) from public,anon;
grant execute on function public.source_partner_candidate(text,text,text,text,text) to authenticated,service_role;

create or replace function public.link_partner_handoff_job(p_handoff uuid,p_job uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_company uuid := private.current_company_id(); v_partner uuid;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;
  select h.partner_id into v_partner from public.partner_commercial_handoffs h
  where h.id=p_handoff and h.company_id=v_company and h.status='terms_approved' for update;
  if v_partner is null then raise exception 'Approved handoff not found'; end if;
  if not exists(select 1 from public.jobs j where j.id=p_job and j.company_id=v_company) then raise exception 'Vacancy not found in this workspace'; end if;
  update public.partner_commercial_handoffs
  set status='converted',approved_job_id=p_job,approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now()
  where id=p_handoff;
  if not exists (select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=v_partner and a.job_id=p_job and a.completed_at is null) then
    insert into public.partner_assignments(company_id,partner_id,job_id,priority,objective)
    values(v_company,v_partner,p_job,'high','Deliver approved Vorlen vacancy');
  end if;
end $$;

revoke all on function public.link_partner_handoff_job(uuid,uuid) from public,anon;
grant execute on function public.link_partner_handoff_job(uuid,uuid) to authenticated,service_role;

create or replace function public.enforce_partner_handoff_boundary()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_privileged boolean := current_user in ('postgres','service_role') or private.is_manager();
begin
  new.updated_at := now();
  if v_privileged then
    if new.status in ('terms_approved','converted') and new.approved_at is null then new.approved_at := now(); new.approved_by := coalesce(new.approved_by,auth.uid()); end if;
    if new.status='converted' and new.approved_job_id is null then raise exception 'A live vacancy must be linked before a handoff can be converted'; end if;
    return new;
  end if;
  if not private.partner_is_active() then raise exception 'Active partner access required'; end if;
  if tg_op='INSERT' then
    new.company_id := private.current_company_id(); new.partner_id := auth.uid();
    new.manager_notes := null; new.approved_by := null; new.approved_at := null; new.approved_job_id := null;
    if new.status not in ('draft','submitted') then new.status := 'draft'; end if;
  else
    if old.partner_id <> auth.uid() or old.company_id <> private.current_company_id() then raise exception 'You may only update your own commercial handoffs'; end if;
    if old.status <> 'draft' then raise exception 'Submitted handoffs are locked while Vorlen reviews them'; end if;
    new.company_id := old.company_id; new.partner_id := old.partner_id; new.client_id := old.client_id;
    new.manager_notes := old.manager_notes; new.approved_by := old.approved_by; new.approved_at := old.approved_at; new.approved_job_id := old.approved_job_id;
    if new.status not in ('draft','submitted') then raise exception 'Partners can only save a draft or submit for Vorlen review'; end if;
  end if;
  if new.client_id is not null and not exists (
    select 1 from public.partner_assignments a where a.company_id=new.company_id and a.partner_id=auth.uid() and a.client_id=new.client_id and a.completed_at is null
  ) then raise exception 'The selected client is not assigned to your partner portfolio'; end if;
  return new;
end $$;
