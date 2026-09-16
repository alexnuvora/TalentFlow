-- V6 Candidate Conversion Engine
alter table public.jobs add column if not exists application_questions jsonb not null default '[]'::jsonb;
alter table public.candidates add column if not exists resume_path text;
alter table public.applications add column if not exists consent_version text;
alter table public.applications add column if not exists consent_at timestamptz;
alter table public.applications add column if not exists source_details jsonb not null default '{}'::jsonb;

create table if not exists public.recruiter_booking_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recruiter_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check(status in ('available','held','booked','cancelled')),
  meeting_url text,
  notes text,
  created_at timestamptz not null default now(),
  check(ends_at > starts_at)
);
create index if not exists idx_booking_slots_public on public.recruiter_booking_slots(company_id,status,starts_at);

create table if not exists public.candidate_bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  slot_id uuid not null references public.recruiter_booking_slots(id) on delete restrict,
  candidate_name text not null,
  candidate_email text not null,
  status text not null default 'booked' check(status in ('booked','cancelled','completed','no_show')),
  created_at timestamptz not null default now(),
  unique(slot_id)
);
create index if not exists idx_candidate_bookings_candidate on public.candidate_bookings(candidate_id,created_at desc);

alter table public.recruiter_booking_slots enable row level security;
alter table public.candidate_bookings enable row level security;
drop policy if exists "booking slots manager" on public.recruiter_booking_slots;
create policy "booking slots manager" on public.recruiter_booking_slots for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
drop policy if exists "candidate bookings manager" on public.candidate_bookings;
create policy "candidate bookings manager" on public.candidate_bookings for all using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());

-- Public functions use SECURITY DEFINER and validate the opaque candidate portal token before changing data.
create or replace function public.public_booking_slots(p_token text)
returns table(id uuid, starts_at timestamptz, ends_at timestamptz, meeting_url text)
language sql security definer set search_path=public
as $$
  select s.id,s.starts_at,s.ends_at,s.meeting_url
  from public.recruiter_booking_slots s
  join public.candidate_portal_tokens t on t.token=p_token
  where t.revoked_at is null and t.expires_at>now()
    and s.company_id=(select c.company_id from public.candidates c where c.id=t.candidate_id)
    and s.status='available' and s.starts_at>now()
  order by s.starts_at limit 50;
$$;
revoke all on function public.public_booking_slots(text) from public;
grant execute on function public.public_booking_slots(text) to anon,authenticated;

create or replace function public.book_candidate_slot(p_token text,p_slot_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare t public.candidate_portal_tokens%rowtype; s public.recruiter_booking_slots%rowtype; c public.candidates%rowtype; a public.applications%rowtype; b public.candidate_bookings%rowtype;
begin
 select * into t from public.candidate_portal_tokens where token=p_token and revoked_at is null and expires_at>now() limit 1;
 if not found then raise exception 'Invalid or expired application link'; end if;
 select * into s from public.recruiter_booking_slots where id=p_slot_id and status='available' and starts_at>now() for update;
 if not found then raise exception 'That appointment is no longer available'; end if;
 select * into c from public.candidates where id=t.candidate_id;
 select * into a from public.applications where candidate_id=c.id order by submitted_at desc limit 1;
 update public.recruiter_booking_slots set status='booked' where id=s.id;
 insert into public.candidate_bookings(company_id,candidate_id,application_id,slot_id,candidate_name,candidate_email)
 values(c.company_id,c.id,a.id,s.id,c.full_name,c.email) returning * into b;
 if a.id is not null then
   insert into public.interviews(company_id,client_id,job_id,candidate_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes)
   select c.company_id,j.client_id,a.job_id,s.starts_at,greatest(10,ceil(extract(epoch from (s.ends_at-s.starts_at))/60)::integer),s.meeting_url,'scheduled','Candidate self-booked screening call'
   from public.jobs j where j.id=a.job_id;
 end if;
 return jsonb_build_object('id',b.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'meeting_url',s.meeting_url);
exception when unique_violation then raise exception 'That appointment was just booked by someone else';
end;
$$;
revoke all on function public.book_candidate_slot(text,uuid) from public;
grant execute on function public.book_candidate_slot(text,uuid) to anon,authenticated;
insert into storage.buckets(id,name,public) values('candidate-resumes','candidate-resumes',false) on conflict(id) do nothing;
-- Service-role uploads bypass storage RLS. Recruiters can access files through authenticated storage policies if desired.
drop policy if exists "resume manager read" on storage.objects;
create policy "resume manager read" on storage.objects for select to authenticated using(bucket_id='candidate-resumes' and public.is_manager() and (storage.foldername(name))[1]=public.current_company_id()::text);
