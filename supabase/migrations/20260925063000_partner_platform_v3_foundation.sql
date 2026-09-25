
-- Vorlen Partner Platform V3: CRM, outreach, talent tooling and collaboration foundation.

alter table public.client_recruitment_contacts
  add column if not exists owner_partner_id uuid references public.profiles(id) on delete set null,
  add column if not exists relationship_strength smallint,
  add column if not exists relationship_status text not null default 'new',
  add column if not exists preferred_channel text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists communication_opt_out boolean not null default false;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='client_recruitment_contacts_relationship_strength_check') then
    alter table public.client_recruitment_contacts
      add constraint client_recruitment_contacts_relationship_strength_check
      check(relationship_strength is null or relationship_strength between 1 and 5);
  end if;
  if not exists(select 1 from pg_constraint where conname='client_recruitment_contacts_relationship_status_check') then
    alter table public.client_recruitment_contacts
      add constraint client_recruitment_contacts_relationship_status_check
      check(relationship_status in ('new','cold','warming','engaged','strong','inactive'));
  end if;
  if not exists(select 1 from pg_constraint where conname='client_recruitment_contacts_preferred_channel_check') then
    alter table public.client_recruitment_contacts
      add constraint client_recruitment_contacts_preferred_channel_check
      check(preferred_channel is null or preferred_channel in ('phone','email','sms','linkedin','meeting'));
  end if;
end $$;

create index if not exists client_recruitment_contacts_owner_partner_idx
  on public.client_recruitment_contacts(owner_partner_id);

create table if not exists public.partner_communication_events(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete cascade,
  contact_id uuid references public.client_recruitment_contacts(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  event_type text not null check(event_type in ('call','email','sms','linkedin','note','meeting','tob','handoff','vacancy','candidate_submission','interview','portal','sequence','system')),
  channel text check(channel is null or channel in ('phone','email','sms','linkedin','meeting','portal','internal','system')),
  direction text not null default 'internal' check(direction in ('inbound','outbound','internal')),
  subject text,
  summary text not null,
  external_ref text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(num_nonnulls(client_id,candidate_id,job_id)>0)
);
create index if not exists partner_communication_client_idx on public.partner_communication_events(company_id,client_id,occurred_at desc);
create index if not exists partner_communication_candidate_idx on public.partner_communication_events(company_id,candidate_id,occurred_at desc);
create index if not exists partner_communication_job_idx on public.partner_communication_events(company_id,job_id,occurred_at desc);
create index if not exists partner_communication_contact_idx on public.partner_communication_events(contact_id,occurred_at desc);

create table if not exists public.partner_opportunities(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_partner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  prospect_id uuid references public.partner_prospects(id) on delete set null,
  contact_id uuid references public.client_recruitment_contacts(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  name text not null,
  stage text not null default 'identified' check(stage in ('identified','qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won','lost')),
  expected_fee numeric(12,2),
  probability smallint not null default 10 check(probability between 0 and 100),
  next_action text,
  next_action_at timestamptz,
  source text,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(client_id is not null or prospect_id is not null)
);
create index if not exists partner_opportunities_owner_idx on public.partner_opportunities(company_id,owner_partner_id,stage,updated_at desc);
create index if not exists partner_opportunities_client_idx on public.partner_opportunities(company_id,client_id);

create table if not exists public.partner_outreach_templates(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_partner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  steps jsonb not null default '[]'::jsonb,
  stop_on_reply boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(jsonb_typeof(steps)='array')
);
create index if not exists partner_outreach_templates_owner_idx on public.partner_outreach_templates(company_id,owner_partner_id,active);

create table if not exists public.partner_outreach_enrollments(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.partner_outreach_templates(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.client_recruitment_contacts(id) on delete set null,
  status text not null default 'active' check(status in ('active','paused','completed','stopped_reply','cancelled')),
  current_step integer not null default 0,
  next_step_at timestamptz,
  replied_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_outreach_enrollments_partner_idx on public.partner_outreach_enrollments(company_id,partner_id,status,next_step_at);
create unique index if not exists partner_outreach_active_template_client_uq
  on public.partner_outreach_enrollments(template_id,partner_id,client_id)
  where status='active';

alter table public.partner_tasks
  add column if not exists outreach_enrollment_id uuid references public.partner_outreach_enrollments(id) on delete set null,
  add column if not exists outreach_step_index integer;

create index if not exists partner_tasks_outreach_idx on public.partner_tasks(outreach_enrollment_id)
where outreach_enrollment_id is not null;

create table if not exists public.partner_submission_packs(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  headline text,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check(status in ('draft','requested','approved','declined','submitted')),
  manager_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  candidate_submission_id uuid references public.candidate_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id,job_id,candidate_id)
);
create index if not exists partner_submission_packs_review_idx on public.partner_submission_packs(company_id,status,created_at desc);

create table if not exists public.client_vacancy_requests(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  title text not null,
  location text,
  employment_type text,
  salary_min numeric,
  salary_max numeric,
  hiring_need text not null,
  desired_start_date date,
  status text not null default 'submitted' check(status in ('submitted','under_review','approved','declined','converted')),
  manager_notes text,
  approved_job_id uuid references public.jobs(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_vacancy_requests_client_idx on public.client_vacancy_requests(company_id,client_id,status,created_at desc);

create table if not exists public.candidate_assessment_templates(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  assessment_type text not null default 'structured_screen' check(assessment_type in ('structured_screen','interview','skills','reference','custom')),
  questions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(jsonb_typeof(questions)='array')
);

create table if not exists public.candidate_assessment_results(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid references public.candidate_assessment_templates(id) on delete set null,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  assessor_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  summary text,
  recommendation text,
  status text not null default 'completed' check(status in ('draft','completed','reviewed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists candidate_assessment_results_candidate_idx on public.candidate_assessment_results(company_id,candidate_id,created_at desc);

create table if not exists public.recruitment_integrations(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  category text not null check(category in ('candidate_source','job_board','social','calendar','mailbox','assessment')),
  display_name text not null,
  status text not null default 'configuration_required' check(status in ('configuration_required','connected','disabled','error')),
  capabilities jsonb not null default '[]'::jsonb,
  configuration_note text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,provider,category)
);

create table if not exists public.candidate_source_records(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  provider text not null,
  external_profile_id text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(company_id,provider,external_profile_id)
);

create table if not exists public.job_distribution_requests(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider text not null,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check(status in ('requested','queued','published','failed','cancelled','configuration_required')),
  external_job_id text,
  external_url text,
  error_message text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_distribution_requests_job_idx on public.job_distribution_requests(company_id,job_id,requested_at desc);

-- Read policies. Mutations are controlled by RPCs.
alter table public.partner_communication_events enable row level security;
alter table public.partner_opportunities enable row level security;
alter table public.partner_outreach_templates enable row level security;
alter table public.partner_outreach_enrollments enable row level security;
alter table public.partner_submission_packs enable row level security;
alter table public.client_vacancy_requests enable row level security;
alter table public.candidate_assessment_templates enable row level security;
alter table public.candidate_assessment_results enable row level security;
alter table public.recruitment_integrations enable row level security;
alter table public.candidate_source_records enable row level security;
alter table public.job_distribution_requests enable row level security;

drop policy if exists "partner communication read" on public.partner_communication_events;
create policy "partner communication read" on public.partner_communication_events for select to authenticated
using(
  company_id=(select private.current_company_id()) and (
    (select private.is_manager())
    or (
      partner_id=(select auth.uid())
      or (client_id is not null and exists(select 1 from public.partner_assignments a where a.company_id=partner_communication_events.company_id and a.partner_id=(select auth.uid()) and a.client_id=partner_communication_events.client_id and a.completed_at is null))
      or (candidate_id is not null and exists(select 1 from public.partner_assignments a where a.company_id=partner_communication_events.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=partner_communication_events.candidate_id and a.completed_at is null))
      or (job_id is not null and exists(select 1 from public.partner_assignments a where a.company_id=partner_communication_events.company_id and a.partner_id=(select auth.uid()) and a.job_id=partner_communication_events.job_id and a.completed_at is null))
    )
  )
);

drop policy if exists "partner opportunities read" on public.partner_opportunities;
create policy "partner opportunities read" on public.partner_opportunities for select to authenticated
using(company_id=(select private.current_company_id()) and ((select private.is_manager()) or owner_partner_id=(select auth.uid())));

drop policy if exists "partner outreach templates read" on public.partner_outreach_templates;
create policy "partner outreach templates read" on public.partner_outreach_templates for select to authenticated
using(company_id=(select private.current_company_id()) and ((select private.is_manager()) or owner_partner_id is null or owner_partner_id=(select auth.uid())));

drop policy if exists "partner outreach enrollments read" on public.partner_outreach_enrollments;
create policy "partner outreach enrollments read" on public.partner_outreach_enrollments for select to authenticated
using(company_id=(select private.current_company_id()) and ((select private.is_manager()) or partner_id=(select auth.uid())));

drop policy if exists "partner submission packs read" on public.partner_submission_packs;
create policy "partner submission packs read" on public.partner_submission_packs for select to authenticated
using(company_id=(select private.current_company_id()) and ((select private.is_manager()) or partner_id=(select auth.uid())));

drop policy if exists "client vacancy requests read" on public.client_vacancy_requests;
create policy "client vacancy requests read" on public.client_vacancy_requests for select to authenticated
using(company_id=(select private.current_company_id()) and (
  (select private.is_manager())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='viewer' and p.client_id=client_vacancy_requests.client_id and p.company_id=client_vacancy_requests.company_id)
  or exists(select 1 from public.partner_assignments a where a.company_id=client_vacancy_requests.company_id and a.partner_id=(select auth.uid()) and a.client_id=client_vacancy_requests.client_id and a.completed_at is null)
));

drop policy if exists "assessment templates read" on public.candidate_assessment_templates;
create policy "assessment templates read" on public.candidate_assessment_templates for select to authenticated
using(company_id=(select private.current_company_id()));

drop policy if exists "assessment results read" on public.candidate_assessment_results;
create policy "assessment results read" on public.candidate_assessment_results for select to authenticated
using(company_id=(select private.current_company_id()) and (
  (select private.is_manager())
  or assessor_id=(select auth.uid())
  or exists(select 1 from public.partner_assignments a where a.company_id=candidate_assessment_results.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=candidate_assessment_results.candidate_id and a.completed_at is null)
));

drop policy if exists "recruitment integrations read" on public.recruitment_integrations;
create policy "recruitment integrations read" on public.recruitment_integrations for select to authenticated
using(company_id=(select private.current_company_id()));

drop policy if exists "candidate source records read" on public.candidate_source_records;
create policy "candidate source records read" on public.candidate_source_records for select to authenticated
using(company_id=(select private.current_company_id()) and (
  (select private.is_manager())
  or exists(select 1 from public.partner_assignments a where a.company_id=candidate_source_records.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=candidate_source_records.candidate_id and a.completed_at is null)
));

drop policy if exists "job distribution requests read" on public.job_distribution_requests;
create policy "job distribution requests read" on public.job_distribution_requests for select to authenticated
using(company_id=(select private.current_company_id()) and (
  (select private.is_manager())
  or requested_by=(select auth.uid())
  or exists(select 1 from public.partner_assignments a where a.company_id=job_distribution_requests.company_id and a.partner_id=(select auth.uid()) and a.job_id=job_distribution_requests.job_id and a.completed_at is null)
));

revoke insert,update,delete on public.partner_communication_events,public.partner_opportunities,public.partner_outreach_templates,public.partner_outreach_enrollments,public.partner_submission_packs,public.client_vacancy_requests,public.candidate_assessment_templates,public.candidate_assessment_results,public.recruitment_integrations,public.candidate_source_records,public.job_distribution_requests from authenticated;

-- Seed integration catalogue rows for the Vorlen workspace without storing secrets.
insert into public.recruitment_integrations(company_id,provider,category,display_name,capabilities,configuration_note)
select c.id,x.provider,x.category,x.display_name,x.capabilities::jsonb,x.note
from public.companies c
cross join (values
 ('vorlen_careers','job_board','Vorlen Careers','["publish","applications"]','Native and available when a vacancy is published in Vorlen.'),
 ('cv_library','candidate_source','CV-Library','["search","import"]','Requires a commercial CV-Library integration/API agreement and credentials.'),
 ('monster','candidate_source','Monster','["search","import"]','Requires a commercial Monster integration/API agreement and credentials.'),
 ('careerbuilder','candidate_source','CareerBuilder','["search","import"]','Requires a commercial CareerBuilder integration/API agreement and credentials.'),
 ('linkedin','social','LinkedIn','["profile_reference","manual_action"]','Direct automated sourcing requires LinkedIn-approved integration access.'),
 ('reed','job_board','Reed','["publish"]','Requires Reed recruiter/API credentials.'),
 ('totaljobs','job_board','Totaljobs','["publish"]','Requires Totaljobs integration credentials.'),
 ('google_calendar','calendar','Google Calendar','["interview_sync"]','Calendar sync requires an authorised connector.'),
 ('microsoft_calendar','calendar','Microsoft 365 Calendar','["interview_sync"]','Calendar sync requires an authorised connector.')
) as x(provider,category,display_name,capabilities,note)
on conflict(company_id,provider,category) do nothing;

-- Controlled contact relationship update.
create or replace function public.partner_update_contact_relationship(
  p_contact uuid,
  p_relationship_strength integer default null,
  p_relationship_status text default null,
  p_preferred_channel text default null,
  p_is_primary boolean default null,
  p_owner_partner uuid default null
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_client uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then raise exception 'Client-development partner access required'; end if;
 select client_id into v_client from public.client_recruitment_contacts where id=p_contact and company_id=v_company;
 if v_client is null or not private.partner_has_assigned_client(v_client,auth.uid()) then raise exception 'Assigned client contact required'; end if;
 if p_relationship_strength is not null and (p_relationship_strength<1 or p_relationship_strength>5) then raise exception 'Relationship strength must be 1 to 5'; end if;
 if p_relationship_status is not null and p_relationship_status not in ('new','cold','warming','engaged','strong','inactive') then raise exception 'Invalid relationship status'; end if;
 if p_preferred_channel is not null and p_preferred_channel not in ('phone','email','sms','linkedin','meeting') then raise exception 'Invalid preferred channel'; end if;
 if p_owner_partner is not null and p_owner_partner<>auth.uid() then raise exception 'Partners may only own contacts in their own portfolio'; end if;
 if coalesce(p_is_primary,false) then
   update public.client_recruitment_contacts set is_primary=false,updated_at=now() where company_id=v_company and client_id=v_client and id<>p_contact and is_primary;
 end if;
 update public.client_recruitment_contacts
 set relationship_strength=coalesce(p_relationship_strength,relationship_strength),
     relationship_status=coalesce(p_relationship_status,relationship_status),
     preferred_channel=coalesce(p_preferred_channel,preferred_channel),
     is_primary=coalesce(p_is_primary,is_primary),
     owner_partner_id=coalesce(p_owner_partner,owner_partner_id,auth.uid()),
     updated_at=now()
 where id=p_contact and company_id=v_company;
end $$;

create or replace function public.partner_log_communication(
  p_client uuid,
  p_event_type text,
  p_summary text,
  p_channel text default 'internal',
  p_direction text default 'internal',
  p_contact uuid default null,
  p_candidate uuid default null,
  p_job uuid default null,
  p_subject text default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then raise exception 'Client-development partner access required'; end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client required'; end if;
 if p_event_type not in ('call','email','sms','linkedin','note','meeting','tob','handoff','vacancy','candidate_submission','interview','portal','sequence','system') then raise exception 'Invalid event type'; end if;
 if p_direction not in ('inbound','outbound','internal') then raise exception 'Invalid direction'; end if;
 if p_contact is not null and not exists(select 1 from public.client_recruitment_contacts c where c.id=p_contact and c.client_id=p_client and c.company_id=v_company) then raise exception 'Contact does not belong to client'; end if;
 insert into public.partner_communication_events(company_id,partner_id,client_id,contact_id,candidate_id,job_id,event_type,channel,direction,subject,summary,occurred_at,metadata)
 values(v_company,auth.uid(),p_client,p_contact,p_candidate,p_job,p_event_type,p_channel,p_direction,nullif(btrim(coalesce(p_subject,'')),''),btrim(p_summary),coalesce(p_occurred_at,now()),coalesce(p_metadata,'{}'::jsonb))
 returning id into v_id;
 update public.client_recruitment_contacts set last_contacted_at=coalesce(p_occurred_at,now()),updated_at=now() where id=p_contact;
 if p_direction='inbound' then
   update public.partner_outreach_enrollments e
   set status='stopped_reply',replied_at=coalesce(p_occurred_at,now()),completed_at=coalesce(p_occurred_at,now()),updated_at=now()
   where e.company_id=v_company and e.partner_id=auth.uid() and e.client_id=p_client and e.status='active'
     and (e.contact_id is null or e.contact_id=p_contact)
     and exists(select 1 from public.partner_outreach_templates t where t.id=e.template_id and t.stop_on_reply);
   update public.partner_tasks t
   set status='cancelled',completed_at=coalesce(completed_at,now())
   where t.company_id=v_company and t.partner_id=auth.uid() and t.client_id=p_client
     and t.outreach_enrollment_id is not null and t.status not in ('done','cancelled');
 end if;
 return v_id;
end $$;

create or replace function public.partner_create_opportunity(
  p_client uuid,
  p_name text,
  p_stage text default 'identified',
  p_contact uuid default null,
  p_job uuid default null,
  p_expected_fee numeric default null,
  p_probability integer default 10,
  p_next_action text default null,
  p_next_action_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then raise exception 'Client-development partner access required'; end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client required'; end if;
 if p_stage not in ('identified','qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won','lost') then raise exception 'Invalid opportunity stage'; end if;
 insert into public.partner_opportunities(company_id,owner_partner_id,client_id,contact_id,job_id,name,stage,expected_fee,probability,next_action,next_action_at)
 values(v_company,auth.uid(),p_client,p_contact,p_job,btrim(p_name),p_stage,p_expected_fee,greatest(0,least(coalesce(p_probability,10),100)),nullif(btrim(coalesce(p_next_action,'')),''),p_next_action_at)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_update_opportunity(
  p_opportunity uuid,
  p_stage text,
  p_probability integer default null,
  p_expected_fee numeric default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_lost_reason text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
begin
 if not private.partner_is_active(auth.uid()) then raise exception 'Active partner required'; end if;
 if p_stage not in ('identified','qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won','lost') then raise exception 'Invalid opportunity stage'; end if;
 update public.partner_opportunities
 set stage=p_stage,
     probability=coalesce(p_probability,probability),
     expected_fee=coalesce(p_expected_fee,expected_fee),
     next_action=nullif(btrim(coalesce(p_next_action,'')),''),
     next_action_at=p_next_action_at,
     lost_reason=case when p_stage='lost' then nullif(btrim(coalesce(p_lost_reason,'')),'') else null end,
     updated_at=now()
 where id=p_opportunity and company_id=private.current_company_id() and owner_partner_id=auth.uid();
 if not found then raise exception 'Opportunity not found'; end if;
end $$;

create or replace function public.partner_create_outreach_template(
  p_name text,
  p_description text,
  p_steps jsonb,
  p_stop_on_reply boolean default true
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_step jsonb; v_channel text;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then raise exception 'Client-development partner access required'; end if;
 if jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)<1 or jsonb_array_length(p_steps)>12 then raise exception 'Sequence requires 1 to 12 steps'; end if;
 for v_step in select * from jsonb_array_elements(p_steps) loop
   v_channel:=coalesce(v_step->>'channel','task');
   if v_channel not in ('task','email','sms','linkedin','call','meeting') then raise exception 'Unsupported sequence channel %',v_channel; end if;
 end loop;
 insert into public.partner_outreach_templates(company_id,owner_partner_id,name,description,steps,stop_on_reply)
 values(private.current_company_id(),auth.uid(),btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),p_steps,coalesce(p_stop_on_reply,true))
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_enroll_outreach_sequence(
  p_template uuid,
  p_client uuid,
  p_contact uuid default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_template public.partner_outreach_templates%rowtype; v_id uuid; v_step jsonb; v_idx int:=0; v_delay int; v_channel text; v_title text;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) then raise exception 'Client-development partner access required'; end if;
 if not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client required'; end if;
 if private.client_is_suppressed(p_client) then raise exception 'Client is marked do not contact'; end if;
 select * into v_template from public.partner_outreach_templates where id=p_template and company_id=v_company and active and (owner_partner_id is null or owner_partner_id=auth.uid());
 if not found then raise exception 'Outreach template not found'; end if;
 if p_contact is not null and not exists(select 1 from public.client_recruitment_contacts where id=p_contact and client_id=p_client and company_id=v_company and not communication_opt_out) then raise exception 'Contact unavailable for outreach'; end if;
 insert into public.partner_outreach_enrollments(company_id,template_id,partner_id,client_id,contact_id,status,current_step,next_step_at)
 values(v_company,v_template.id,auth.uid(),p_client,p_contact,'active',0,now())
 returning id into v_id;
 for v_step in select * from jsonb_array_elements(v_template.steps) loop
   v_delay:=greatest(0,least(coalesce((v_step->>'delay_hours')::int,0),2160));
   v_channel:=coalesce(v_step->>'channel','task');
   v_title:=coalesce(nullif(v_step->>'title',''),initcap(v_channel)||' follow-up');
   insert into public.partner_tasks(company_id,partner_id,client_id,title,description,task_type,due_at,priority,outreach_enrollment_id,outreach_step_index)
   values(v_company,auth.uid(),p_client,v_title,nullif(v_step->>'instructions',''),
     case when v_channel in ('email','call','meeting') then v_channel when v_channel='task' then 'follow_up' else 'follow_up' end,
     now()+make_interval(hours=>v_delay),coalesce(nullif(v_step->>'priority',''),'normal'),v_id,v_idx);
   v_idx:=v_idx+1;
 end loop;
 insert into public.partner_communication_events(company_id,partner_id,client_id,contact_id,event_type,channel,direction,summary,metadata)
 values(v_company,auth.uid(),p_client,p_contact,'sequence','internal','internal','Started outreach sequence: '||v_template.name,jsonb_build_object('enrollment_id',v_id,'template_id',v_template.id));
 return v_id;
end $$;

create or replace function public.partner_create_submission_pack(
  p_job uuid,
  p_candidate uuid,
  p_summary text,
  p_headline text default null,
  p_strengths jsonb default '[]'::jsonb,
  p_concerns jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_client uuid; v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 select j.client_id into v_client from public.jobs j join public.partner_assignments a on a.job_id=j.id and a.company_id=j.company_id where j.id=p_job and j.company_id=v_company and a.partner_id=auth.uid() and a.completed_at is null;
 if v_client is null then raise exception 'Assigned vacancy required'; end if;
 if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=p_candidate and a.completed_at is null) then raise exception 'Assigned candidate required'; end if;
 insert into public.partner_submission_packs(company_id,partner_id,client_id,job_id,candidate_id,headline,summary,strengths,concerns,status)
 values(v_company,auth.uid(),v_client,p_job,p_candidate,nullif(btrim(coalesce(p_headline,'')),''),btrim(p_summary),coalesce(p_strengths,'[]'::jsonb),coalesce(p_concerns,'[]'::jsonb),'requested')
 on conflict(partner_id,job_id,candidate_id) do update set headline=excluded.headline,summary=excluded.summary,strengths=excluded.strengths,concerns=excluded.concerns,status='requested',manager_notes=null,reviewed_by=null,reviewed_at=null,updated_at=now()
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.review_partner_submission_pack(
  p_pack uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('approved','declined') then raise exception 'Status must be approved or declined'; end if;
 update public.partner_submission_packs
 set status=p_status,manager_notes=nullif(btrim(coalesce(p_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=p_pack and company_id=private.current_company_id() and status='requested';
 if not found then raise exception 'Pending submission pack not found'; end if;
end $$;

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
language plpgsql security definer set search_path=''
as $$
declare v_profile public.profiles%rowtype; v_id uuid;
begin
 select * into v_profile from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;
 if not found then raise exception 'Client portal access required'; end if;
 if length(btrim(coalesce(p_title,'')))<2 or length(btrim(coalesce(p_hiring_need,'')))<10 then raise exception 'Title and hiring requirement are required'; end if;
 insert into public.client_vacancy_requests(company_id,client_id,requested_by,title,location,employment_type,salary_min,salary_max,hiring_need,desired_start_date)
 values(v_profile.company_id,v_profile.client_id,auth.uid(),btrim(p_title),nullif(btrim(coalesce(p_location,'')),''),nullif(btrim(coalesce(p_employment_type,'')),''),p_salary_min,p_salary_max,btrim(p_hiring_need),p_desired_start_date)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.review_client_vacancy_request(
  p_request uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status not in ('under_review','approved','declined') then raise exception 'Invalid review status'; end if;
 update public.client_vacancy_requests
 set status=p_status,manager_notes=nullif(btrim(coalesce(p_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=case when p_status in ('approved','declined') then now() else reviewed_at end,updated_at=now()
 where id=p_request and company_id=private.current_company_id() and status in ('submitted','under_review');
 if not found then raise exception 'Vacancy request not found'; end if;
end $$;

create or replace function public.partner_record_assessment(
  p_candidate uuid,
  p_job uuid,
  p_template uuid,
  p_answers jsonb,
  p_score numeric default null,
  p_summary text default null,
  p_recommendation text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and candidate_id=p_candidate and completed_at is null) then raise exception 'Assigned candidate required'; end if;
 if p_job is not null and not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if p_template is not null and not exists(select 1 from public.candidate_assessment_templates where id=p_template and company_id=v_company and active) then raise exception 'Assessment template not found'; end if;
 insert into public.candidate_assessment_results(company_id,template_id,candidate_id,job_id,assessor_id,answers,score,summary,recommendation,status)
 values(v_company,p_template,p_candidate,p_job,auth.uid(),coalesce(p_answers,'{}'::jsonb),p_score,nullif(btrim(coalesce(p_summary,'')),''),nullif(btrim(coalesce(p_recommendation,'')),''),'completed')
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_schedule_interview(
  p_candidate uuid,
  p_job uuid,
  p_scheduled_at timestamptz,
  p_duration_minutes integer default 45,
  p_meeting_url text default null,
  p_notes text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_client uuid; v_id uuid;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 select client_id into v_client from public.jobs j where j.id=p_job and j.company_id=v_company;
 if v_client is null then raise exception 'Vacancy not found'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and candidate_id=p_candidate and completed_at is null) then raise exception 'Assigned candidate required'; end if;
 if not exists(select 1 from public.candidate_submissions s where s.company_id=v_company and s.job_id=p_job and s.candidate_id=p_candidate and s.client_id=v_client and s.status not in ('draft','withdrawn','approved_to_send') and (s.client_decision in ('approve','request_interview') or s.status in ('client_approved','interview_requested'))) then raise exception 'Client must approve or request an interview for this submitted candidate first'; end if;
 insert into public.interviews(company_id,client_id,job_id,candidate_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes)
 values(v_company,v_client,p_job,p_candidate,p_scheduled_at,greatest(15,least(coalesce(p_duration_minutes,45),240)),nullif(btrim(coalesce(p_meeting_url,'')),''),'scheduled',nullif(btrim(coalesce(p_notes,'')),''))
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_request_job_distribution(
  p_job uuid,
  p_provider text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_id uuid; v_status text;
begin
 if not private.partner_is_active(auth.uid()) or not (private.partner_can_close_clients(auth.uid()) or private.partner_can_source_candidates(auth.uid())) then raise exception 'Vacancy-capable partner access required'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 select status into v_status from public.recruitment_integrations where company_id=v_company and provider=p_provider and category in ('job_board','social') order by case when status='connected' then 0 else 1 end limit 1;
 if v_status is null then raise exception 'Unknown distribution provider'; end if;
 insert into public.job_distribution_requests(company_id,job_id,provider,requested_by,status)
 values(v_company,p_job,p_provider,auth.uid(),case when p_provider='vorlen_careers' then 'queued' when v_status='connected' then 'requested' else 'configuration_required' end)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.partner_candidate_match(
  p_job uuid,
  p_limit integer default 20
)
returns table(
  candidate_id uuid,
  full_name text,
  location text,
  experience_summary text,
  training_qualifications text,
  match_score integer,
  match_reasons text[],
  already_assigned boolean
)
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); v_job public.jobs%rowtype; v_terms text[];
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Recruiter/Hybrid access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 if not exists(select 1 from public.partner_assignments where company_id=v_company and partner_id=auth.uid() and job_id=p_job and completed_at is null) then raise exception 'Assigned vacancy required'; end if;
 select * into v_job from public.jobs where id=p_job and company_id=v_company;
 v_terms:=array(select distinct lower(x) from unnest(regexp_split_to_array(coalesce(v_job.title,'')||' '||coalesce(v_job.description,'')||' '||array_to_string(coalesce(v_job.requirements,'{}'::text[]),' ')||' '||coalesce(v_job.required_qualifications,''),'[^a-zA-Z0-9+#.]+')) x where length(x)>=3 limit 40);
 return query
 select c.id,c.full_name,c.location,c.experience_summary,c.training_qualifications,
   least(100,
     (case when lower(coalesce(c.location,''))=lower(coalesce(v_job.location,'')) then 15 else 0 end)
     + (select count(*)*4 from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%')
   )::int as match_score,
   array(select t from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%' limit 8) as match_reasons,
   exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null)
 from public.candidates c
 where c.company_id=v_company and c.erased_at is null
 order by 6 desc,c.created_at desc
 limit greatest(1,least(coalesce(p_limit,20),50));
end $$;

create or replace function public.partner_analytics_snapshot()
returns jsonb
language sql stable security definer set search_path=''
as $$
select jsonb_build_object(
 'contacts', (select count(*) from public.partner_communication_events e where e.company_id=private.current_company_id() and e.partner_id=auth.uid() and e.occurred_at>=now()-interval '30 days'),
 'calls', (select count(*) from public.partner_communication_events e where e.company_id=private.current_company_id() and e.partner_id=auth.uid() and e.event_type='call' and e.occurred_at>=now()-interval '30 days'),
 'emails', (select count(*) from public.partner_communication_events e where e.company_id=private.current_company_id() and e.partner_id=auth.uid() and e.event_type='email' and e.occurred_at>=now()-interval '30 days'),
 'meetings', (select count(*) from public.partner_communication_events e where e.company_id=private.current_company_id() and e.partner_id=auth.uid() and e.event_type='meeting' and e.occurred_at>=now()-interval '30 days'),
 'open_opportunities', (select count(*) from public.partner_opportunities o where o.company_id=private.current_company_id() and o.owner_partner_id=auth.uid() and o.stage not in ('won','lost')),
 'weighted_pipeline', (select coalesce(sum(coalesce(o.expected_fee,0)*(o.probability::numeric/100)),0) from public.partner_opportunities o where o.company_id=private.current_company_id() and o.owner_partner_id=auth.uid() and o.stage not in ('won','lost')),
 'won_opportunities', (select count(*) from public.partner_opportunities o where o.company_id=private.current_company_id() and o.owner_partner_id=auth.uid() and o.stage='won' and o.updated_at>=now()-interval '30 days'),
 'candidate_recommendations', (select count(*) from public.partner_candidate_pipeline p where p.company_id=private.current_company_id() and p.partner_id=auth.uid() and p.stage='recommended' and p.created_at>=now()-interval '30 days'),
 'submission_packs', (select count(*) from public.partner_submission_packs p where p.company_id=private.current_company_id() and p.partner_id=auth.uid() and p.created_at>=now()-interval '30 days'),
 'interviews', (select count(*) from public.interviews i where i.company_id=private.current_company_id() and i.created_at>=now()-interval '30 days' and exists(select 1 from public.partner_assignments a where a.company_id=i.company_id and a.partner_id=auth.uid() and (a.job_id=i.job_id or a.candidate_id=i.candidate_id))),
 'placements', (select count(*) from public.placements pl where pl.company_id=private.current_company_id() and pl.created_at>=now()-interval '30 days' and exists(select 1 from public.partner_attributions a where a.company_id=pl.company_id and a.partner_id=auth.uid() and a.placement_id=pl.id and a.status='active')),
 'commission_accrued', (select coalesce(sum(amount),0) from public.partner_commissions pc where pc.company_id=private.current_company_id() and pc.partner_user_id=auth.uid() and pc.created_at>=now()-interval '30 days')
)
$$;

create or replace function public.partner_crm_snapshot(p_client uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid:=private.current_company_id(); result jsonb;
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) or not private.partner_has_assigned_client(p_client,auth.uid()) then raise exception 'Assigned client-development access required'; end if;
 select jsonb_build_object(
  'client',(select to_jsonb(c)-'partner_terms_send_authorized_hash'-'terms_send_reserved_until' from public.clients c where c.id=p_client and c.company_id=v_company),
  'contacts',coalesce((select jsonb_agg(to_jsonb(x) order by x.is_primary desc,x.relationship_strength desc nulls last,x.updated_at desc) from public.client_recruitment_contacts x where x.company_id=v_company and x.client_id=p_client),'[]'::jsonb),
  'opportunities',coalesce((select jsonb_agg(to_jsonb(o) order by o.updated_at desc) from public.partner_opportunities o where o.company_id=v_company and o.owner_partner_id=auth.uid() and o.client_id=p_client),'[]'::jsonb),
  'sequences',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'current_step',e.current_step,'next_step_at',e.next_step_at,'replied_at',e.replied_at,'created_at',e.created_at,'template',jsonb_build_object('id',t.id,'name',t.name,'steps',t.steps,'stop_on_reply',t.stop_on_reply),'contact_id',e.contact_id) order by e.created_at desc) from public.partner_outreach_enrollments e join public.partner_outreach_templates t on t.id=e.template_id where e.company_id=v_company and e.partner_id=auth.uid() and e.client_id=p_client),'[]'::jsonb),
  'templates',coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc) from public.partner_outreach_templates t where t.company_id=v_company and t.active and (t.owner_partner_id is null or t.owner_partner_id=auth.uid())),'[]'::jsonb),
  'vacancy_requests',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.client_vacancy_requests v where v.company_id=v_company and v.client_id=p_client),'[]'::jsonb),
  'portal_activity',jsonb_build_object(
    'submissions',(select count(*) from public.candidate_submissions s where s.company_id=v_company and s.client_id=p_client and s.status not in ('draft','withdrawn','approved_to_send')),
    'awaiting_client_decision',(select count(*) from public.candidate_submissions s where s.company_id=v_company and s.client_id=p_client and s.status not in ('draft','withdrawn','approved_to_send') and s.client_decision is null),
    'interviews',(select count(*) from public.interviews i where i.company_id=v_company and i.client_id=p_client and i.status='scheduled')
  ),
  'timeline',coalesce((
    select jsonb_agg(e order by (e->>'at')::timestamptz desc)
    from (
      select jsonb_build_object('type',ce.event_type,'channel',ce.channel,'direction',ce.direction,'at',ce.occurred_at,'title',coalesce(ce.subject,initcap(ce.event_type)),'detail',ce.summary,'contact_id',ce.contact_id,'candidate_id',ce.candidate_id,'job_id',ce.job_id) e
      from public.partner_communication_events ce where ce.company_id=v_company and ce.client_id=p_client
      union all
      select jsonb_build_object('type','note','channel','internal','direction','internal','at',n.created_at,'title','Partner note','detail',n.note,'contact_id',null,'candidate_id',null,'job_id',null)
      from public.partner_client_notes n where n.company_id=v_company and n.client_id=p_client
      union all
      select jsonb_build_object('type','call','channel','phone','direction','outbound','at',coalesce(t.ended_at,t.started_at,t.created_at),'title','AI call','detail',coalesce(t.summary,t.transcript_text),'contact_id',null,'candidate_id',null,'job_id',null)
      from public.ai_call_transcripts t where t.company_id=v_company and t.client_id=p_client
      union all
      select jsonb_build_object('type','tob','channel','email','direction','outbound','at',coalesce(d.accepted_at,d.viewed_at,d.sent_at,d.created_at),'title','Terms of Business · '||d.status,'detail',d.version,'contact_id',null,'candidate_id',null,'job_id',null)
      from public.client_terms_documents d where d.company_id=v_company and d.client_id=p_client
      union all
      select jsonb_build_object('type','handoff','channel','internal','direction','internal','at',h.updated_at,'title','Commercial handoff · '||h.vacancy_title,'detail',h.status,'contact_id',null,'candidate_id',null,'job_id',h.approved_job_id)
      from public.partner_commercial_handoffs h where h.company_id=v_company and h.client_id=p_client
      union all
      select jsonb_build_object('type','vacancy','channel','internal','direction','internal','at',j.created_at,'title','Vacancy · '||j.title,'detail',j.status::text,'contact_id',null,'candidate_id',null,'job_id',j.id)
      from public.jobs j where j.company_id=v_company and j.client_id=p_client
      union all
      select jsonb_build_object('type','candidate_submission','channel','portal','direction','outbound','at',coalesce(s.submitted_at,s.created_at),'title','Candidate submission · '||c.full_name,'detail',coalesce(s.client_decision,s.status),'contact_id',null,'candidate_id',s.candidate_id,'job_id',s.job_id)
      from public.candidate_submissions s join public.candidates c on c.id=s.candidate_id where s.company_id=v_company and s.client_id=p_client and s.status not in ('draft','withdrawn','approved_to_send')
      union all
      select jsonb_build_object('type','interview','channel','meeting','direction','internal','at',i.scheduled_at,'title','Interview · '||c.full_name,'detail',i.status,'contact_id',null,'candidate_id',i.candidate_id,'job_id',i.job_id)
      from public.interviews i join public.candidates c on c.id=i.candidate_id where i.company_id=v_company and i.client_id=p_client
    ) z
  ),'[]'::jsonb)
 ) into result;
 return result;
end $$;

-- Extend client portal payload with vacancy requests.
create or replace function private.client_portal_data_authorised()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare p public.profiles%rowtype; result jsonb;
begin
  select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;
  if not found then raise exception 'Client access required'; end if;
  if not public.workspace_feature_enabled(p.company_id,'client_portal') then raise exception 'This feature requires an active subscription that includes it'; end if;
  select jsonb_build_object(
    'client',(select jsonb_build_object('company_name',company_name) from public.clients where id=p.client_id and company_id=p.company_id),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'location',location,'employment_type',employment_type)) from public.jobs where client_id=p.client_id and company_id=p.company_id),'[]'::jsonb),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'feedback',s.client_feedback,'summary',s.recruiter_summary,'headline',s.headline,'key_strengths',coalesce(s.key_strengths,'[]'::jsonb),'concerns',coalesce(s.concerns,'[]'::jsonb),'submitted_at',s.submitted_at,'client_decision',s.client_decision,'client_feedback_at',s.client_feedback_at,'has_cv',(c.resume_path is not null),'candidates',jsonb_build_object('full_name',c.full_name,'location',c.location,'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,'authorisations',c.authorisations),'jobs',jsonb_build_object('title',j.title))) from public.candidate_submissions s join public.candidates c on c.id=s.candidate_id join public.jobs j on j.id=s.job_id where s.client_id=p.client_id and s.company_id=p.company_id and s.status not in ('draft','withdrawn','approved_to_send')),'[]'::jsonb),
    'interviews',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,'meeting_url',i.meeting_url,'status',i.status,'candidates',jsonb_build_object('full_name',c.full_name),'jobs',jsonb_build_object('title',j.title))) from public.interviews i join public.candidates c on c.id=i.candidate_id join public.jobs j on j.id=i.job_id where i.client_id=p.client_id and i.company_id=p.company_id and exists(select 1 from public.candidate_submissions s where s.candidate_id=i.candidate_id and s.job_id=i.job_id and s.client_id=p.client_id and s.status not in ('draft','withdrawn','approved_to_send'))),'[]'::jsonb),
    'vacancy_requests',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'location',v.location,'employment_type',v.employment_type,'salary_min',v.salary_min,'salary_max',v.salary_max,'hiring_need',v.hiring_need,'desired_start_date',v.desired_start_date,'status',v.status,'manager_notes',v.manager_notes,'created_at',v.created_at) order by v.created_at desc) from public.client_vacancy_requests v where v.client_id=p.client_id and v.company_id=p.company_id),'[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Default reusable assessment template per workspace.
insert into public.candidate_assessment_templates(company_id,name,description,assessment_type,questions)
select c.id,'Structured recruiter screen','Consistent evidence-based screening before recommendation.','structured_screen',
'[
 {"key":"motivation","label":"Motivation for this role","type":"text","required":true},
 {"key":"relevant_experience","label":"Relevant experience evidence","type":"text","required":true},
 {"key":"availability","label":"Availability / notice period","type":"text","required":true},
 {"key":"salary","label":"Salary / rate expectations","type":"text","required":false},
 {"key":"location","label":"Location / travel fit","type":"text","required":false},
 {"key":"concerns","label":"Risks or concerns","type":"text","required":false}
]'::jsonb
from public.companies c
where not exists(select 1 from public.candidate_assessment_templates t where t.company_id=c.id and t.name='Structured recruiter screen');

-- RPC permissions.
revoke all on function public.partner_update_contact_relationship(uuid,integer,text,text,boolean,uuid) from public,anon;
revoke all on function public.partner_log_communication(uuid,text,text,text,text,uuid,uuid,uuid,text,timestamptz,jsonb) from public,anon;
revoke all on function public.partner_create_opportunity(uuid,text,text,uuid,uuid,numeric,integer,text,timestamptz) from public,anon;
revoke all on function public.partner_update_opportunity(uuid,text,integer,numeric,text,timestamptz,text) from public,anon;
revoke all on function public.partner_create_outreach_template(text,text,jsonb,boolean) from public,anon;
revoke all on function public.partner_enroll_outreach_sequence(uuid,uuid,uuid) from public,anon;
revoke all on function public.partner_create_submission_pack(uuid,uuid,text,text,jsonb,jsonb) from public,anon;
revoke all on function public.review_partner_submission_pack(uuid,text,text) from public,anon;
revoke all on function public.client_create_vacancy_request(text,text,text,text,numeric,numeric,date) from public,anon;
revoke all on function public.review_client_vacancy_request(uuid,text,text) from public,anon;
revoke all on function public.partner_record_assessment(uuid,uuid,uuid,jsonb,numeric,text,text) from public,anon;
revoke all on function public.partner_schedule_interview(uuid,uuid,timestamptz,integer,text,text) from public,anon;
revoke all on function public.partner_request_job_distribution(uuid,text) from public,anon;
revoke all on function public.partner_candidate_match(uuid,integer) from public,anon;
revoke all on function public.partner_analytics_snapshot() from public,anon;
revoke all on function public.partner_crm_snapshot(uuid) from public,anon;

grant execute on function public.partner_update_contact_relationship(uuid,integer,text,text,boolean,uuid) to authenticated;
grant execute on function public.partner_log_communication(uuid,text,text,text,text,uuid,uuid,uuid,text,timestamptz,jsonb) to authenticated;
grant execute on function public.partner_create_opportunity(uuid,text,text,uuid,uuid,numeric,integer,text,timestamptz) to authenticated;
grant execute on function public.partner_update_opportunity(uuid,text,integer,numeric,text,timestamptz,text) to authenticated;
grant execute on function public.partner_create_outreach_template(text,text,jsonb,boolean) to authenticated;
grant execute on function public.partner_enroll_outreach_sequence(uuid,uuid,uuid) to authenticated;
grant execute on function public.partner_create_submission_pack(uuid,uuid,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.review_partner_submission_pack(uuid,text,text) to authenticated;
grant execute on function public.client_create_vacancy_request(text,text,text,text,numeric,numeric,date) to authenticated;
grant execute on function public.review_client_vacancy_request(uuid,text,text) to authenticated;
grant execute on function public.partner_record_assessment(uuid,uuid,uuid,jsonb,numeric,text,text) to authenticated;
grant execute on function public.partner_schedule_interview(uuid,uuid,timestamptz,integer,text,text) to authenticated;
grant execute on function public.partner_request_job_distribution(uuid,text) to authenticated;
grant execute on function public.partner_candidate_match(uuid,integer) to authenticated;
grant execute on function public.partner_analytics_snapshot() to authenticated;
grant execute on function public.partner_crm_snapshot(uuid) to authenticated;
