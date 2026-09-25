
create or replace function public.partner_candidate_discover(
  p_job uuid,
  p_query text default null,
  p_limit integer default 20
)
returns table(
 candidate_id uuid,
 full_name text,
 location text,
 experience_summary text,
 training_qualifications text,
 stage text,
 already_assigned boolean,
 request_status text
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id();
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then
   raise exception 'Candidate-sourcing partner access required';
 end if;
 if not public.candidate_processing_allowed(v_company) then
   raise exception 'Candidate processing is not active';
 end if;
 if not exists(
   select 1 from public.partner_assignments a
   where a.company_id=v_company
     and a.partner_id=auth.uid()
     and a.job_id=p_job
     and a.completed_at is null
 ) then
   raise exception 'Assigned vacancy required';
 end if;

 return query
 select
   c.id,
   c.full_name,
   c.location,
   c.experience_summary,
   c.training_qualifications,
   c.stage::text,
   exists(
     select 1 from public.partner_assignments a
     where a.company_id=v_company
       and a.partner_id=auth.uid()
       and a.candidate_id=c.id
       and a.completed_at is null
   ) as already_assigned,
   (
     select case
       when r.status='approved'
        and not exists(
          select 1 from public.partner_assignments a
          where a.company_id=v_company
            and a.partner_id=auth.uid()
            and a.candidate_id=c.id
            and a.completed_at is null
        )
       then 'expired'
       else r.status
     end
     from public.partner_candidate_access_requests r
     where r.company_id=v_company
       and r.partner_id=auth.uid()
       and r.candidate_id=c.id
       and r.job_id=p_job
     order by r.created_at desc
     limit 1
   ) as request_status
 from public.candidates c
 where c.company_id=v_company
   and c.erased_at is null
   and (
    nullif(btrim(coalesce(p_query,'')),'') is null
    or c.full_name ilike '%'||p_query||'%'
    or coalesce(c.location,'') ilike '%'||p_query||'%'
    or coalesce(c.experience_summary,'') ilike '%'||p_query||'%'
    or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%'
   )
 order by c.created_at desc
 limit greatest(1,least(coalesce(p_limit,20),50));
end
$$;

create or replace function public.cleanup_partner_assignment_access()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    if old.job_id is not null then
      update public.partner_referral_links
      set active=false,revoked_at=coalesce(revoked_at,now())
      where company_id=old.company_id
        and partner_id=old.partner_id
        and job_id=old.job_id
        and active=true;
    end if;

    if old.candidate_id is not null
       and not exists(
         select 1 from public.partner_assignments a
         where a.company_id=old.company_id
           and a.partner_id=old.partner_id
           and a.candidate_id=old.candidate_id
           and a.completed_at is null
           and a.id<>old.id
       ) then
      delete from public.partner_talent_pool_members m
      using public.partner_talent_pools p
      where m.pool_id=p.id
        and p.company_id=old.company_id
        and p.partner_id=old.partner_id
        and m.candidate_id=old.candidate_id;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_cleanup_partner_assignment_access on public.partner_assignments;
create trigger trg_cleanup_partner_assignment_access
after update of completed_at on public.partner_assignments
for each row execute function public.cleanup_partner_assignment_access();

revoke all on function public.cleanup_partner_assignment_access()
from public,anon,authenticated;
