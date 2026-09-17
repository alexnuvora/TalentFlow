-- Additive hardening; retain all existing records. No live customer data required.
do $$ declare t record; begin
  for t in select table_name from information_schema.columns
    where table_schema='public' and column_name='company_id' and table_name <> 'profiles'
  loop
    execute format('alter table public.%I alter column company_id set default public.current_company_id()',t.table_name);
  end loop;
end $$;
alter table public.campaigns alter column source set default 'direct';

-- Fail closed for client users: raw candidate, application and interview records
-- contain internal notes. The client portal reads the allowlisted RPC below.
do $$ declare t text; begin
  foreach t in array array['candidates','applications','interviews','client_contracts','placements','candidate_submissions','activity_log'] loop
    execute format('create policy staff_boundary on public.%I as restrictive for all to authenticated using (public.is_manager() and company_id=public.current_company_id()) with check (public.is_manager() and company_id=public.current_company_id())',t);
  end loop;
end $$;
revoke update,delete on public.activity_log from authenticated;

-- Validate tenant references for every public FK linking company-owned records.
-- Composite FKs preserve existing ON DELETE behaviour and close cross-tenant writes.
do $$ declare r record; begin
  for r in
    select distinct c.confrelid::regclass as target
    from pg_constraint c join pg_attribute a on a.attrelid=c.confrelid and a.attname='company_id'
    join pg_attribute b on b.attrelid=c.conrelid and b.attname='company_id'
    where c.contype='f' and c.connamespace='public'::regnamespace and cardinality(c.conkey)=1
      and c.confrelid in (select oid from pg_class where relnamespace='public'::regnamespace)
  loop
    execute format('create unique index if not exists %I on %s(company_id,id)', 'tenant_key_'||replace(r.target::text,'public.',''),r.target);
  end loop;
  for r in
    select c.conrelid::regclass as source,c.confrelid::regclass as target, a.attname as col,c.conname
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    join pg_attribute b on b.attrelid=c.confrelid and b.attname='company_id'
    join pg_attribute d on d.attrelid=c.conrelid and d.attname='company_id'
    where c.contype='f' and c.connamespace='public'::regnamespace and cardinality(c.conkey)=1
      and c.confrelid in (select oid from pg_class where relnamespace='public'::regnamespace)
  loop
    execute format('alter table %s add constraint %I foreign key(company_id,%I) references %s(company_id,id)',r.source,'tenant_'||r.conname,r.col,r.target);
    execute format('create index if not exists %I on %s(company_id,%I)','fk_'||r.conname,r.source,r.col);
  end loop;
end $$;

create or replace function public.create_candidate_portal_token(p_candidate_id uuid,p_days integer default 30)
returns text language plpgsql security definer set search_path='' as $$
declare t text; begin
 if not public.is_manager() or not exists(select 1 from public.candidates where id=p_candidate_id and company_id=public.current_company_id()) then raise exception 'Candidate not found'; end if;
 t:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.candidate_portal_tokens(token,candidate_id,expires_at) values(t,p_candidate_id,now()+make_interval(days=>greatest(1,least(p_days,90))));
 return t;
end $$;

create or replace function public.book_candidate_slot(p_token text,p_slot_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.recruiter_booking_slots%rowtype; c public.candidates%rowtype; a public.applications%rowtype; bid uuid;
begin
 select c0.* into c from public.candidates c0 join public.candidate_portal_tokens t on t.candidate_id=c0.id
 where t.token=p_token and t.revoked_at is null and t.expires_at>now();
 if not found then raise exception 'Invalid or expired application link'; end if;
 select * into s from public.recruiter_booking_slots where id=p_slot_id and company_id=c.company_id and status='available' and starts_at>now() for update;
 if not found then raise exception 'That appointment is no longer available'; end if;
 if s.ends_at-s.starts_at > interval '8 hours' then raise exception 'Invalid appointment duration'; end if;
 select * into a from public.applications where candidate_id=c.id and company_id=c.company_id order by submitted_at desc limit 1;
 if not found then raise exception 'Application not found'; end if;
 update public.recruiter_booking_slots set status='booked' where id=s.id;
 insert into public.candidate_bookings(company_id,candidate_id,application_id,slot_id,candidate_name,candidate_email)
 values(c.company_id,c.id,a.id,s.id,c.full_name,c.email) returning id into bid;
 insert into public.interviews(company_id,client_id,job_id,candidate_id,scheduled_at,duration_minutes,meeting_url,status,recruiter_notes)
 select c.company_id,j.client_id,a.job_id,c.id,s.starts_at,greatest(10,ceil(extract(epoch from(s.ends_at-s.starts_at))/60)::integer),s.meeting_url,'scheduled','Candidate self-booked screening call'
 from public.jobs j where j.id=a.job_id and j.company_id=c.company_id;
 return jsonb_build_object('id',bid,'starts_at',s.starts_at,'ends_at',s.ends_at,'meeting_url',s.meeting_url);
end $$;

create or replace function public.client_portal_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles%rowtype; result jsonb;
begin
 select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;
 if not found then raise exception 'Client access required'; end if;
 select jsonb_build_object(
  'client',(select jsonb_build_object('company_name',company_name) from public.clients where id=p.client_id and company_id=p.company_id),
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'location',location,'employment_type',employment_type)) from public.jobs where client_id=p.client_id and company_id=p.company_id),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'candidates',jsonb_build_object('full_name',c.full_name),'jobs',jsonb_build_object('title',j.title),'summary',s.recruiter_summary))
    from public.candidate_submissions s join public.candidates c on c.id=s.candidate_id join public.jobs j on j.id=s.job_id
    where s.client_id=p.client_id and s.company_id=p.company_id and s.status not in ('draft','withdrawn')),'[]'::jsonb),
  'interviews',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'scheduled_at',i.scheduled_at,'status',i.status,'candidates',jsonb_build_object('full_name',c.full_name),'jobs',jsonb_build_object('title',j.title)))
    from public.interviews i join public.candidates c on c.id=i.candidate_id join public.jobs j on j.id=i.job_id
    where i.client_id=p.client_id and i.company_id=p.company_id and exists(select 1 from public.candidate_submissions s where s.candidate_id=i.candidate_id and s.job_id=i.job_id and s.client_id=p.client_id and s.status not in ('draft','withdrawn'))),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.client_portal_data() from public,anon;
grant execute on function public.client_portal_data() to authenticated;

create or replace function public.client_review_submission(p_submission_id uuid,p_status text,p_feedback text default null)
returns void language plpgsql security definer set search_path='' as $$
declare s public.candidate_submissions%rowtype; p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;
 if not found then raise exception 'Client access required'; end if;
 if p_status not in ('approved','rejected','interview_requested','reviewing') or length(p_feedback)>4000 then raise exception 'Invalid review'; end if;
 select * into s from public.candidate_submissions where id=p_submission_id and client_id=p.client_id and company_id=p.company_id and status not in ('draft','withdrawn') for update;
 if not found then raise exception 'Submission not found'; end if;
 update public.candidate_submissions set status=p_status,client_feedback=p_feedback,reviewed_at=now(),updated_at=now() where id=s.id;
 insert into public.activity_log(company_id,candidate_id,job_id,actor_id,event_type,detail) values(s.company_id,s.candidate_id,s.job_id,auth.uid(),'client_review',p_status);
end $$;

