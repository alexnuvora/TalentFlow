
create or replace function public.create_candidate_portal_token(p_candidate_id uuid, p_days integer default 30)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token text;
  v_hash text;
begin
  if auth.uid() is null or not public.has_candidate_data_access() then raise exception 'Not authorised'; end if;
  if p_days < 1 or p_days > 90 then raise exception 'Expiry must be between 1 and 90 days'; end if;
  if not exists(
    select 1
    from public.candidates c
    join public.profiles p on p.id=auth.uid()
    where c.id=p_candidate_id and c.company_id=p.company_id
  ) then raise exception 'Candidate not found or not authorised'; end if;

  update public.candidate_portal_tokens
  set revoked_at=now()
  where candidate_id=p_candidate_id and revoked_at is null and expires_at>now();

  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

  insert into public.candidate_portal_tokens(token_hash,candidate_id,expires_at)
  values(v_hash,p_candidate_id,now()+make_interval(days=>p_days));

  return v_token;
end
$function$;

create or replace function public.get_candidate_portal_token(p_candidate_id uuid)
returns table(token text, expires_at timestamptz, revoked_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_candidate_data_access() then raise exception 'Not authorised'; end if;
  if not exists(
    select 1
    from public.candidates c
    join public.profiles p on p.id=auth.uid()
    where c.id=p_candidate_id and c.company_id=p.company_id
  ) then raise exception 'Candidate not found or not authorised'; end if;

  return query
  select null::text,t.expires_at,t.revoked_at,t.created_at
  from public.candidate_portal_tokens t
  where t.candidate_id=p_candidate_id
  order by t.created_at desc
  limit 1;
end
$function$;

create or replace function public.public_booking_slots(p_token text)
returns table(id uuid, starts_at timestamptz, ends_at timestamptz, meeting_url text)
language sql
security definer
set search_path to 'public'
as $function$
  select s.id,s.starts_at,s.ends_at,null::text as meeting_url
  from public.recruiter_booking_slots s
  join public.candidate_portal_tokens t
    on t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
  where t.revoked_at is null
    and t.expires_at>now()
    and s.company_id=(select c.company_id from public.candidates c where c.id=t.candidate_id)
    and s.status='available'
    and s.starts_at>now()
  order by s.starts_at
  limit 50
$function$;

create or replace function public.book_candidate_slot(p_token text, p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s public.recruiter_booking_slots%rowtype;
  c public.candidates%rowtype;
  a public.applications%rowtype;
  bid uuid;
begin
  select c0.* into c
  from public.candidates c0
  join public.candidate_portal_tokens t on t.candidate_id=c0.id
  where t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and t.revoked_at is null
    and t.expires_at>now();

  if not found then raise exception 'Invalid or expired application link'; end if;

  select * into s
  from public.recruiter_booking_slots
  where id=p_slot_id
    and company_id=c.company_id
    and status='available'
    and starts_at>now()
  for update;

  if not found then raise exception 'That appointment is no longer available'; end if;
  if s.ends_at-s.starts_at > interval '8 hours' then raise exception 'Invalid appointment duration'; end if;

  select * into a
  from public.applications
  where candidate_id=c.id and company_id=c.company_id
  order by submitted_at desc
  limit 1;

  if not found then raise exception 'Application not found'; end if;

  update public.recruiter_booking_slots set status='booked' where id=s.id;

  insert into public.candidate_bookings(company_id,candidate_id,application_id,slot_id,candidate_name,candidate_email)
  values(c.company_id,c.id,a.id,s.id,c.full_name,c.email)
  returning id into bid;

  insert into public.interviews(company_id,client_id,job_id,candidate_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes)
  select c.company_id,j.client_id,a.job_id,c.id,s.starts_at,
         greatest(10,ceil(extract(epoch from(s.ends_at-s.starts_at))/60)::integer),
         s.meeting_url,'scheduled','Candidate self-booked screening call'
  from public.jobs j
  where j.id=a.job_id and j.company_id=c.company_id;

  return jsonb_build_object('id',bid,'starts_at',s.starts_at,'ends_at',s.ends_at,'meeting_url',s.meeting_url);
end
$function$;

revoke all on function public.get_candidate_portal_token(uuid) from public,anon;
revoke all on function public.create_candidate_portal_token(uuid,integer) from public,anon;
revoke all on function public.revoke_candidate_portal_token(uuid) from public,anon;
grant execute on function public.get_candidate_portal_token(uuid) to authenticated;
grant execute on function public.create_candidate_portal_token(uuid,integer) to authenticated;
grant execute on function public.revoke_candidate_portal_token(uuid) to authenticated;
