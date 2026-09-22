create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path='public'
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','manager')) $$;

create or replace function public.has_candidate_data_access()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
   select 1 from public.profiles p
   where p.id=auth.uid() and (
     p.role in ('owner','manager') or
     (p.role='recruiter' and exists(
       select 1 from public.recruiter_data_access_approvals a
       where a.company_id=p.company_id and a.user_id=p.id
         and a.approved_at is not null and a.revoked_at is null
         and (a.expires_at is null or a.expires_at>now())
     ))
   )
 )
$$;

drop policy if exists "staff_boundary" on public.candidates;
drop policy if exists "candidates role aware" on public.candidates;
drop policy if exists "candidates staff insert" on public.candidates;
drop policy if exists "candidates staff update" on public.candidates;
drop policy if exists "candidates staff delete" on public.candidates;
create policy "candidates approved staff select" on public.candidates for select to authenticated using (company_id=public.current_company_id() and public.has_candidate_data_access());
create policy "candidates approved staff insert" on public.candidates for insert to authenticated with check (company_id=public.current_company_id() and public.has_candidate_data_access());
create policy "candidates approved staff update" on public.candidates for update to authenticated using (company_id=public.current_company_id() and public.has_candidate_data_access()) with check (company_id=public.current_company_id() and public.has_candidate_data_access());
create policy "candidates managers delete" on public.candidates for delete to authenticated using (company_id=public.current_company_id() and public.is_manager());

drop policy if exists "staff_boundary" on public.applications;
drop policy if exists "applications role aware" on public.applications;
drop policy if exists "applications staff insert" on public.applications;
drop policy if exists "applications staff update" on public.applications;
drop policy if exists "applications staff delete" on public.applications;
create policy "applications approved staff select" on public.applications for select to authenticated using (company_id=public.current_company_id() and public.has_candidate_data_access());
create policy "applications approved staff insert" on public.applications for insert to authenticated with check (company_id=public.current_company_id() and public.has_candidate_data_access());
create policy "applications approved staff update" on public.applications for update to authenticated using (company_id=public.current_company_id() and public.has_candidate_data_access()) with check (company_id=public.current_company_id() and public.has_candidate_data_access());
create policy "applications managers delete" on public.applications for delete to authenticated using (company_id=public.current_company_id() and public.is_manager());

alter table public.privacy_requests drop constraint if exists privacy_requests_candidate_company_fkey;
create unique index if not exists candidates_company_id_id_uq on public.candidates(company_id,id);
alter table public.privacy_requests add constraint privacy_requests_candidate_company_fkey foreign key(company_id,candidate_id) references public.candidates(company_id,id);

create or replace function public.enforce_recruiter_seat_limit()
returns trigger language plpgsql security definer set search_path='public'
as $$ declare lim int; cnt int; begin
 if new.company_id is null or new.role not in ('owner','manager','recruiter') then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text,0));
 select p.recruiter_limit into lim from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code where s.company_id=new.company_id and (s.status='active' or (s.status='trialing' and s.trial_ends_at>now()));
 if lim is null then raise exception 'An active subscription is required to add staff seats'; end if;
 select count(*) into cnt from public.profiles where company_id=new.company_id and role in ('owner','manager','recruiter') and id<>new.id;
 if lim>=0 and cnt>=lim then raise exception 'Recruiter seat plan limit reached'; end if;
 return new; end $$;
