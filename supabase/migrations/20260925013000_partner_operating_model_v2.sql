-- Partner operating model v2: differentiated specialisms, controlled client closing,
-- contact intelligence, task sequences, role KPIs and secure candidate discovery.

alter table public.partner_profiles
  add column if not exists target_qualified_opportunities integer not null default 5,
  add column if not exists target_tob_acceptances integer not null default 2,
  add column if not exists target_candidate_recommendations integer not null default 10;

alter table public.clients
  add column if not exists partner_terms_send_authorized_at timestamptz,
  add column if not exists partner_terms_send_authorized_by uuid,
  add column if not exists partner_terms_send_authorized_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='clients_partner_terms_send_authorized_by_fkey'
      and conrelid='public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_partner_terms_send_authorized_by_fkey
      foreign key(partner_terms_send_authorized_by)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.partner_client_sequences(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  template text not null check(template in ('advisor_discovery','closer_conversion')),
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists partner_client_sequences_active_uq
  on public.partner_client_sequences(partner_id,client_id,template)
  where status='active';
alter table public.partner_client_sequences enable row level security;

create table if not exists public.partner_candidate_access_requests(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  reason text,
  status text not null default 'pending' check(status in ('pending','approved','declined','cancelled')),
  manager_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists partner_candidate_access_pending_uq
  on public.partner_candidate_access_requests(partner_id,candidate_id,job_id)
  where status='pending';
alter table public.partner_candidate_access_requests enable row level security;

create table if not exists public.partner_talent_pools(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id,name)
);
alter table public.partner_talent_pools enable row level security;

create table if not exists public.partner_talent_pool_members(
  pool_id uuid not null references public.partner_talent_pools(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(pool_id,candidate_id)
);
alter table public.partner_talent_pool_members enable row level security;

create or replace function private.partner_specialism(p_partner uuid default auth.uid())
returns text
language sql stable security definer set search_path=''
as $$
  select pp.specialism
  from public.partner_profiles pp
  join public.profiles p on p.id=pp.user_id and p.company_id=pp.company_id
  join public.partner_onboarding o on o.partner_id=pp.user_id and o.company_id=pp.company_id
  where pp.user_id=p_partner
    and p.role='partner'
    and pp.active
    and o.status='active'
    and (p_partner=auth.uid() or private.is_manager())
  limit 1
$$;

create or replace function private.partner_can_prospect(p_partner uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=''
as $$ select coalesce(private.partner_specialism(p_partner) in ('b2b_advisor','hybrid'),false) $$;

create or replace function private.partner_can_close_clients(p_partner uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=''
as $$ select coalesce(private.partner_specialism(p_partner) in ('lead_closer','hybrid'),false) $$;

create or replace function private.partner_has_assigned_client(p_client uuid,p_partner uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(
   select 1
   from public.partner_assignments a
   join public.profiles p on p.id=a.partner_id and p.company_id=a.company_id and p.role='partner'
   where a.company_id=private.current_company_id()
     and a.partner_id=p_partner
     and a.client_id=p_client
     and a.completed_at is null
     and (p_partner=auth.uid() or private.is_manager())
 )
$$;

create or replace function private.client_commercial_hash(p_client uuid)
returns text
language sql stable security definer set search_path=''
as $$
 select encode(extensions.digest(
   concat_ws('|',coalesce(c.business_nature,''),coalesce(c.recruitment_fee_percent::text,''),coalesce(c.payment_terms_days::text,''),coalesce(c.rebate_terms,'')),
   'sha256'
 ),'hex')
 from public.clients c where c.id=p_client
$$;

create or replace function public.partner_can_prospect()
returns boolean language sql stable set search_path=''
as $$ select private.partner_can_prospect(auth.uid()) $$;
create or replace function public.partner_can_close_clients()
returns boolean language sql stable set search_path=''
as $$ select private.partner_can_close_clients(auth.uid()) $$;

create or replace function public.partner_capability_snapshot()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
   'specialism',private.partner_specialism(auth.uid()),
   'active',private.partner_is_active(auth.uid()),
   'can_prospect',private.partner_can_prospect(auth.uid()),
   'can_close_clients',private.partner_can_close_clients(auth.uid()),
   'can_develop_clients',private.partner_can_develop_clients(auth.uid()),
   'can_source_candidates',private.partner_can_source_candidates(auth.uid())
 )
$$;

create or replace function public.authorise_partner_terms_send(p_client uuid,p_authorised boolean default true)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_hash text;
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if not exists(select 1 from public.clients c where c.id=p_client and c.company_id=v_company) then raise exception 'Client not found'; end if;
 if p_authorised then
   if exists(select 1 from public.clients c where c.id=p_client and c.terms_accepted_at is not null) then raise exception 'Client has already accepted Terms of Business'; end if;
   if exists(select 1 from public.clients c where c.id=p_client and (
       nullif(btrim(coalesce(c.business_nature,'')),'') is null or c.recruitment_fee_percent is null or c.payment_terms_days is null or nullif(btrim(coalesce(c.rebate_terms,'')),'') is null
   )) then raise exception 'Complete the commercial terms before authorising partner send'; end if;
   v_hash:=private.client_commercial_hash(p_client);
   update public.clients set partner_terms_send_authorized_at=now(),partner_terms_send_authorized_by=auth.uid(),partner_terms_send_authorized_hash=v_hash where id=p_client and company_id=v_company;
 else
   update public.clients set partner_terms_send_authorized_at=null,partner_terms_send_authorized_by=null,partner_terms_send_authorized_hash=null where id=p_client and company_id=v_company;
 end if;
 return jsonb_build_object('authorised',p_authorised,'hash',case when p_authorised then v_hash else null end);
end $$;

create or replace function public.clear_partner_terms_authorisation_on_change()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.business_nature is distinct from old.business_nature or new.recruitment_fee_percent is distinct from old.recruitment_fee_percent or new.payment_terms_days is distinct from old.payment_terms_days or new.rebate_terms is distinct from old.rebate_terms then
   new.partner_terms_send_authorized_at:=null; new.partner_terms_send_authorized_by:=null; new.partner_terms_send_authorized_hash:=null;
 end if;
 return new;
end $$;
drop trigger if exists trg_clear_partner_terms_authorisation on public.clients;
create trigger trg_clear_partner_terms_authorisation before update on public.clients for each row execute function public.clear_partner_terms_authorisation_on_change();

create or replace function public.partner_upsert_client_contact(
 p_client uuid,p_contact uuid default null,p_name text default null,p_role_title text default null,p_email text default null,p_phone text default null,p_authority text default 'unknown',p_vacancy_contact boolean default false,p_primary boolean default false
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then raise exception 'Client-development partner access required'; end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client access required'; end if;
 if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Contact name is required'; end if;
 if p_authority not in ('unknown','gatekeeper','influencer','vacancy_contact','decision_maker') then raise exception 'Invalid recruitment authority'; end if;
 if p_primary then update public.client_recruitment_contacts set is_primary=false,updated_at=now() where company_id=v_company and client_id=p_client; end if;
 if p_contact is null then
   insert into public.client_recruitment_contacts(company_id,client_id,name,role_title,email,phone,recruitment_authority,vacancy_contact_confirmed,is_primary,source,confidence,created_by,last_confirmed_at,updated_at)
   values(v_company,p_client,btrim(p_name),nullif(btrim(coalesce(p_role_title,'')),''),nullif(lower(btrim(coalesce(p_email,''))),''),nullif(btrim(coalesce(p_phone,'')),''),p_authority,p_vacancy_contact,p_primary,'partner_workspace','stated',auth.uid(),now(),now())
   on conflict(company_id,client_id,(lower(name))) do update set role_title=excluded.role_title,email=excluded.email,phone=excluded.phone,recruitment_authority=excluded.recruitment_authority,vacancy_contact_confirmed=excluded.vacancy_contact_confirmed,is_primary=excluded.is_primary,last_confirmed_at=now(),updated_at=now()
   returning id into v_id;
 else
   update public.client_recruitment_contacts set name=btrim(p_name),role_title=nullif(btrim(coalesce(p_role_title,'')),''),email=nullif(lower(btrim(coalesce(p_email,''))),''),phone=nullif(btrim(coalesce(p_phone,'')),''),recruitment_authority=p_authority,vacancy_contact_confirmed=p_vacancy_contact,is_primary=p_primary,last_confirmed_at=now(),updated_at=now()
   where id=p_contact and company_id=v_company and client_id=p_client returning id into v_id;
   if v_id is null then raise exception 'Contact not found'; end if;
 end if;
 return v_id;
end $$;

create or replace function public.partner_client_workspace(p_client uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_client public.clients%rowtype; v_hash text; v_terms_authorised boolean:=false;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client access required'; end if;
 select * into v_client from public.clients where id=p_client and company_id=v_company;
 if not found then raise exception 'Client not found'; end if;
 v_hash:=private.client_commercial_hash(p_client);
 v_terms_authorised:=v_client.partner_terms_send_authorized_at is not null and v_client.partner_terms_send_authorized_hash=v_hash and v_client.terms_accepted_at is null;
 return jsonb_build_object(
  'client',jsonb_build_object('id',v_client.id,'company_name',v_client.company_name,'contact_name',v_client.contact_name,'email',v_client.email,'phone',v_client.phone,'website',v_client.website,'status',v_client.status,'business_nature',v_client.business_nature),
  'capabilities',jsonb_build_object('can_prospect',private.partner_can_prospect(auth.uid()),'can_close',private.partner_can_close_clients(auth.uid()),'can_source',private.partner_can_source_candidates(auth.uid())),
  'commercial',jsonb_build_object(
    'terms_accepted',v_client.terms_accepted_at is not null,'terms_accepted_at',v_client.terms_accepted_at,'partner_send_authorised',v_terms_authorised,
    'fee_percent',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.recruitment_fee_percent else null end,
    'payment_terms_days',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.payment_terms_days else null end,
    'rebate_terms',case when v_terms_authorised or v_client.terms_accepted_at is not null then v_client.rebate_terms else null end,
    'latest_document',(select jsonb_build_object('status',d.status,'sent_at',d.sent_at,'viewed_at',d.viewed_at,'accepted_at',d.accepted_at,'version',d.version) from public.client_terms_documents d where d.client_id=p_client and d.company_id=v_company order by d.created_at desc limit 1),
    'contract_status',(select cc.status::text from public.client_contracts cc where cc.client_id=p_client and cc.company_id=v_company order by cc.created_at desc limit 1)
  ),
  'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'role_title',x.role_title,'email',x.email,'phone',x.phone,'recruitment_authority',x.recruitment_authority,'vacancy_contact_confirmed',x.vacancy_contact_confirmed,'is_primary',x.is_primary,'last_confirmed_at',x.last_confirmed_at) order by x.is_primary desc,x.last_confirmed_at desc) from public.client_recruitment_contacts x where x.client_id=p_client and x.company_id=v_company),'[]'::jsonb),
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'location',j.location,'created_at',j.created_at) order by j.created_at desc) from public.jobs j where j.client_id=p_client and j.company_id=v_company),'[]'::jsonb),
  'handoffs',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'vacancy_title',h.vacancy_title,'status',h.status,'manager_notes',h.manager_notes,'updated_at',h.updated_at) order by h.updated_at desc) from public.partner_commercial_handoffs h where h.client_id=p_client and h.company_id=v_company and h.partner_id=auth.uid()),'[]'::jsonb),
  'timeline',coalesce((select jsonb_agg(e order by (e->>'at')::timestamptz desc) from (
      select jsonb_build_object('type','partner_note','at',n.created_at,'title','Partner note','detail',n.note) e from public.partner_client_notes n where n.client_id=p_client and n.company_id=v_company
      union all select jsonb_build_object('type','terms','at',coalesce(d.accepted_at,d.viewed_at,d.sent_at,d.created_at),'title','Terms of Business · '||d.status,'detail',d.version) from public.client_terms_documents d where d.client_id=p_client and d.company_id=v_company
      union all select jsonb_build_object('type','vacancy','at',j.created_at,'title','Vacancy · '||j.title,'detail',j.status::text) from public.jobs j where j.client_id=p_client and j.company_id=v_company
      union all select jsonb_build_object('type','handoff','at',h.updated_at,'title','Commercial handoff · '||h.vacancy_title,'detail',h.status) from public.partner_commercial_handoffs h where h.client_id=p_client and h.company_id=v_company and h.partner_id=auth.uid()
    ) z),'[]'::jsonb)
 );
end $$;

create or replace function public.partner_start_client_sequence(p_client uuid,p_template text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_sequence uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client access required'; end if;
 if p_template='advisor_discovery' and not private.partner_can_prospect(auth.uid()) then raise exception 'Advisor sequence not enabled for this specialism'; end if;
 if p_template='closer_conversion' and not private.partner_can_close_clients(auth.uid()) then raise exception 'Closer sequence not enabled for this specialism'; end if;
 if p_template not in ('advisor_discovery','closer_conversion') then raise exception 'Invalid sequence template'; end if;
 insert into public.partner_client_sequences(company_id,partner_id,client_id,template) values(v_company,auth.uid(),p_client,p_template) returning id into v_sequence;
 if p_template='advisor_discovery' then
   insert into public.partner_tasks(company_id,partner_id,client_id,title,description,task_type,due_at,priority) values
   (v_company,auth.uid(),p_client,'Research recruitment decision-maker','Identify the person responsible for recruitment and record them in Client Workspace.','admin',now(),'high'),
   (v_company,auth.uid(),p_client,'Initial discovery call','Confirm whether the employer is hiring and qualify the need.','call',now(),'high'),
   (v_company,auth.uid(),p_client,'Discovery follow-up','Send a concise follow-up based on the conversation.','email',now()+interval '2 days','normal'),
   (v_company,auth.uid(),p_client,'Second discovery call','Reconnect and qualify urgency, headcount and decision process.','call',now()+interval '5 days','normal'),
   (v_company,auth.uid(),p_client,'Prepare qualified opportunity','If a genuine hiring need exists, submit a commercial handoff to Vorlen.','follow_up',now()+interval '7 days','high');
 else
   insert into public.partner_tasks(company_id,partner_id,client_id,title,description,task_type,due_at,priority) values
   (v_company,auth.uid(),p_client,'Confirm hiring authority','Confirm the decision-maker and live hiring requirement.','call',now(),'high'),
   (v_company,auth.uid(),p_client,'Review Vorlen-approved commercial position','Check Client Workspace for management-authorised terms before discussing next steps.','admin',now(),'high'),
   (v_company,auth.uid(),p_client,'Send approved Terms of Business','Only send when Client Workspace shows partner send authorised.','email',now()+interval '1 day','high'),
   (v_company,auth.uid(),p_client,'Follow up on Terms of Business','Check whether the client viewed/accepted the secure terms link.','follow_up',now()+interval '3 days','normal'),
   (v_company,auth.uid(),p_client,'Secure first vacancy','Once terms are accepted, confirm the first genuine vacancy and submit/update the handoff.','call',now()+interval '5 days','high');
 end if;
 return v_sequence;
exception when unique_violation then raise exception 'An active % sequence already exists for this client',p_template;
end $$;

create or replace function public.partner_performance_snapshot()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_profile public.partner_profiles%rowtype; v_since timestamptz:=now()-interval '30 days';
begin
 if not private.partner_is_active(auth.uid()) then raise exception 'Active partner access required'; end if;
 select * into v_profile from public.partner_profiles where user_id=auth.uid() and company_id=v_company;
 return jsonb_build_object(
  'specialism',v_profile.specialism,'period_days',30,
  'targets',jsonb_build_object('calls',v_profile.target_calls,'meetings',v_profile.target_meetings,'placements',v_profile.target_placements,'qualified_opportunities',v_profile.target_qualified_opportunities,'tob_acceptances',v_profile.target_tob_acceptances,'candidate_recommendations',v_profile.target_candidate_recommendations),
  'actual',jsonb_build_object(
    'client_contacts',(select count(*) from public.partner_client_activity a where a.partner_id=auth.uid() and a.company_id=v_company and a.last_contacted_at>=v_since),
    'meetings',(select count(*) from public.partner_client_activity a where a.partner_id=auth.uid() and a.company_id=v_company and a.status='meeting_booked' and a.updated_at>=v_since),
    'qualified_opportunities',(select count(*) from public.partner_commercial_handoffs h where h.partner_id=auth.uid() and h.company_id=v_company and h.created_at>=v_since and h.status<>'declined'),
    'tob_acceptances',(select count(*) from public.client_terms_documents d where d.company_id=v_company and d.created_by=auth.uid() and d.accepted_at>=v_since),
    'candidates_sourced',(select count(*) from public.partner_attributions a where a.company_id=v_company and a.partner_id=auth.uid() and a.attribution_type='candidate_originator' and a.attributed_at>=v_since),
    'candidate_recommendations',(select count(*) from public.partner_candidate_pipeline p where p.company_id=v_company and p.partner_id=auth.uid() and p.stage='recommended' and p.updated_at>=v_since),
    'placements',(select count(*) from public.partner_attributions a where a.company_id=v_company and a.partner_id=auth.uid() and a.attribution_type='placement_owner' and a.attributed_at>=v_since)
  )
 );
end $$;

create or replace function public.partner_candidate_discover(p_job uuid,p_query text default null,p_limit integer default 20)
returns table(candidate_id uuid,full_name text,location text,experience_summary text,training_qualifications text,stage text,already_assigned boolean,request_status text)
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=p_job and a.completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 return query
 select c.id,c.full_name,c.location,c.experience_summary,c.training_qualifications,c.stage::text,
   exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null),
   (select r.status from public.partner_candidate_access_requests r where r.company_id=v_company and r.partner_id=auth.uid() and r.candidate_id=c.id and r.job_id=p_job order by r.created_at desc limit 1)
 from public.candidates c
 where c.company_id=v_company and c.erased_at is null and (
    nullif(btrim(coalesce(p_query,'')),'') is null or c.full_name ilike '%'||p_query||'%' or coalesce(c.location,'') ilike '%'||p_query||'%' or coalesce(c.experience_summary,'') ilike '%'||p_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%'
 )
 order by c.created_at desc limit greatest(1,least(coalesce(p_limit,20),50));
end $$;

create or replace function public.partner_request_candidate_access(p_candidate uuid,p_job uuid,p_reason text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.jobs j join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id where j.id=p_job and j.company_id=v_company and a.partner_id=auth.uid() and a.completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if not exists(select 1 from public.candidates c where c.id=p_candidate and c.company_id=v_company and c.erased_at is null) then raise exception 'Candidate unavailable'; end if;
 if exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Candidate is already assigned to you'; end if;
 insert into public.partner_candidate_access_requests(company_id,partner_id,candidate_id,job_id,reason) values(v_company,auth.uid(),p_candidate,p_job,nullif(btrim(coalesce(p_reason,'')),'')) returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'A candidate access request is already pending for this vacancy';
end $$;

create or replace function public.review_partner_candidate_access_request(p_request uuid,p_status text,p_notes text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); r public.partner_candidate_access_requests%rowtype;
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('approved','declined') then raise exception 'Status must be approved or declined'; end if;
 select * into r from public.partner_candidate_access_requests where id=p_request and company_id=v_company and status='pending' for update;
 if not found then raise exception 'Pending request not found'; end if;
 update public.partner_candidate_access_requests set status=p_status,manager_notes=nullif(btrim(coalesce(p_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
 if p_status='approved' and not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=r.partner_id and a.candidate_id=r.candidate_id and a.completed_at is null) then
   insert into public.partner_assignments(company_id,partner_id,candidate_id,priority,objective) values(v_company,r.partner_id,r.candidate_id,'normal','Evaluate candidate for assigned vacancy '||r.job_id::text);
 end if;
end $$;

create or replace function public.partner_create_talent_pool(p_name text,p_description text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_company uuid:=private.current_company_id();
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
 if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Pool name required'; end if;
 insert into public.partner_talent_pools(company_id,partner_id,name,description) values(v_company,auth.uid(),btrim(p_name),nullif(btrim(coalesce(p_description,'')),'')) returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_add_talent_pool_member(p_pool uuid,p_candidate uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
 if not exists(select 1 from public.partner_talent_pools p where p.id=p_pool and p.company_id=v_company and p.partner_id=auth.uid()) then raise exception 'Talent pool not found'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Candidate must be assigned to you before adding to a talent pool'; end if;
 insert into public.partner_talent_pool_members(pool_id,candidate_id) values(p_pool,p_candidate) on conflict do nothing;
end $$;

drop policy if exists "partner sequences read" on public.partner_client_sequences;
create policy "partner sequences read" on public.partner_client_sequences for select to authenticated using(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid()));
drop policy if exists "partner sequences own write" on public.partner_client_sequences;
create policy "partner sequences own write" on public.partner_client_sequences for update to authenticated using(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid())) with check(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid()));

drop policy if exists "partner candidate access read" on public.partner_candidate_access_requests;
create policy "partner candidate access read" on public.partner_candidate_access_requests for select to authenticated using(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid()));
drop policy if exists "partner candidate access manager update" on public.partner_candidate_access_requests;
create policy "partner candidate access manager update" on public.partner_candidate_access_requests for update to authenticated using(company_id=private.current_company_id() and private.is_manager()) with check(company_id=private.current_company_id() and private.is_manager());

drop policy if exists "partner talent pools own" on public.partner_talent_pools;
create policy "partner talent pools own" on public.partner_talent_pools for all to authenticated using(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid())) with check(company_id=private.current_company_id() and (private.is_manager() or partner_id=auth.uid()));
drop policy if exists "partner talent pool members own" on public.partner_talent_pool_members;
create policy "partner talent pool members own" on public.partner_talent_pool_members for all to authenticated using(exists(select 1 from public.partner_talent_pools p where p.id=pool_id and p.company_id=private.current_company_id() and (private.is_manager() or p.partner_id=auth.uid()))) with check(exists(select 1 from public.partner_talent_pools p where p.id=pool_id and p.company_id=private.current_company_id() and (private.is_manager() or p.partner_id=auth.uid())));

revoke all on function public.partner_capability_snapshot() from public,anon;
revoke all on function public.partner_can_prospect() from public,anon;
revoke all on function public.partner_can_close_clients() from public,anon;
revoke all on function public.partner_client_workspace(uuid) from public,anon;
revoke all on function public.partner_upsert_client_contact(uuid,uuid,text,text,text,text,text,boolean,boolean) from public,anon;
revoke all on function public.partner_start_client_sequence(uuid,text) from public,anon;
revoke all on function public.partner_performance_snapshot() from public,anon;
revoke all on function public.partner_candidate_discover(uuid,text,integer) from public,anon;
revoke all on function public.partner_request_candidate_access(uuid,uuid,text) from public,anon;
revoke all on function public.partner_create_talent_pool(text,text) from public,anon;
revoke all on function public.partner_add_talent_pool_member(uuid,uuid) from public,anon;
revoke all on function public.authorise_partner_terms_send(uuid,boolean) from public,anon;
revoke all on function public.review_partner_candidate_access_request(uuid,text,text) from public,anon;

grant execute on function public.partner_capability_snapshot() to authenticated;
grant execute on function public.partner_can_prospect() to authenticated;
grant execute on function public.partner_can_close_clients() to authenticated;
grant execute on function public.partner_client_workspace(uuid) to authenticated;
grant execute on function public.partner_upsert_client_contact(uuid,uuid,text,text,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.partner_start_client_sequence(uuid,text) to authenticated;
grant execute on function public.partner_performance_snapshot() to authenticated;
grant execute on function public.partner_candidate_discover(uuid,text,integer) to authenticated;
grant execute on function public.partner_request_candidate_access(uuid,uuid,text) to authenticated;
grant execute on function public.partner_create_talent_pool(text,text) to authenticated;
grant execute on function public.partner_add_talent_pool_member(uuid,uuid) to authenticated;
grant execute on function public.authorise_partner_terms_send(uuid,boolean) to authenticated;
grant execute on function public.review_partner_candidate_access_request(uuid,text,text) to authenticated;
