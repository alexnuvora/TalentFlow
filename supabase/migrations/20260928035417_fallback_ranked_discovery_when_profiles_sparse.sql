create or replace function public.partner_candidate_discover_ranked(
  p_job uuid,
  p_query text default null::text,
  p_limit integer default 30,
  p_mode text default 'match'
)
returns table(candidate_id uuid,full_name text,location text,experience_summary text,training_qualifications text,stage text,match_score integer,match_reasons text[],already_assigned boolean,request_status text)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_job public.jobs%rowtype;
  v_terms text[];
  v_mode text:=lower(coalesce(nullif(trim(p_mode),''),'match'));
begin
  if not private.partner_is_active(auth.uid()) or not private.partner_can_source_candidates(auth.uid()) then raise exception 'Candidate-sourcing partner access required'; end if;
  if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
  if v_mode not in ('match','all') then raise exception 'Discovery mode must be match or all'; end if;
  if not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.job_id=p_job and a.completed_at is null) then raise exception 'Assigned vacancy required'; end if;
  select * into v_job from public.jobs where id=p_job and company_id=v_company;
  if not found then raise exception 'Assigned vacancy not found'; end if;
  v_terms:=array(select distinct x from unnest(regexp_split_to_array(lower(coalesce(v_job.title,'')||' '||coalesce(v_job.description,'')||' '||array_to_string(coalesce(v_job.requirements,'{}'::text[]),' ')||' '||coalesce(v_job.required_qualifications,'')||' '||coalesce(v_job.duties,'')),'[^a-z0-9+#.]+')) x where length(x)>=3 and x not in ('the','and','for','with','from','this','that','you','your','our','are','will','have','has','job','role','work','working','required','requirements','candidate','candidates','experience','skills') limit 50);
  return query
  with scored as (
    select c.id,c.full_name,c.location,c.experience_summary,c.training_qualifications,c.stage::text candidate_stage,
      least(100,
        case when nullif(trim(v_job.location),'') is not null and lower(coalesce(c.location,''))=lower(v_job.location) then 20 else 0 end
        + least(60,coalesce((select count(*)*5 from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%'),0))
        + case when nullif(trim(coalesce(p_query,'')),'') is not null and (c.full_name ilike '%'||p_query||'%' or coalesce(c.location,'') ilike '%'||p_query||'%' or coalesce(c.experience_summary,'') ilike '%'||p_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%') then 20 else 0 end
      )::int score,
      array(select t from unnest(v_terms) t where lower(coalesce(c.experience_summary,'')||' '||coalesce(c.training_qualifications,'')||' '||coalesce(c.authorisations,'')) like '%'||t||'%' limit 8) reasons,
      exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null) is_assigned,
      (select case when r.status='approved' and not exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=auth.uid() and a.candidate_id=c.id and a.completed_at is null) then 'expired' else r.status end from public.partner_candidate_access_requests r where r.company_id=v_company and r.partner_id=auth.uid() and r.candidate_id=c.id and r.job_id=p_job order by r.created_at desc limit 1) access_status
    from public.candidates c
    where c.company_id=v_company and c.erased_at is null
      and (nullif(trim(coalesce(p_query,'')),'') is null or c.full_name ilike '%'||p_query||'%' or coalesce(c.location,'') ilike '%'||p_query||'%' or coalesce(c.experience_summary,'') ilike '%'||p_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||p_query||'%')
  )
  select s.id,s.full_name,s.location,s.experience_summary,s.training_qualifications,s.candidate_stage,s.score,s.reasons,s.is_assigned,s.access_status
  from scored s
  order by case when v_mode='match' then s.score else 0 end desc,s.is_assigned desc,s.full_name asc
  limit greatest(1,least(coalesce(p_limit,30),50));
end
$$;
revoke all on function public.partner_candidate_discover_ranked(uuid,text,integer,text) from public,anon;
grant execute on function public.partner_candidate_discover_ranked(uuid,text,integer,text) to authenticated;