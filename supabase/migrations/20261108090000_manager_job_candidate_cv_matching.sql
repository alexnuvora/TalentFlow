create or replace function public.manager_job_candidate_matches(
  p_job uuid,p_query text default null,p_limit integer default 50
)
returns table(candidate_id uuid,full_name text,location text,stage text,experience_summary text,training_qualifications text,authorisations text,match_score integer,match_reasons text[],work_seeker_terms_agreed boolean,already_applied boolean)
language plpgsql stable security definer set search_path=''
as $$
declare
 v_company uuid:=private.current_company_id(); v_job public.jobs%rowtype; v_terms text[]; v_query text:=nullif(trim(coalesce(p_query,'')),'');
begin
 if v_company is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.company_id=v_company and p.role in ('owner','manager')) then raise exception 'Workspace owner or manager access required'; end if;
 if not public.candidate_processing_allowed(v_company) then raise exception 'Candidate processing is not active'; end if;
 select * into v_job from public.jobs j where j.id=p_job and j.company_id=v_company and j.status not in ('closed','paused') and (j.status='published' or j.partner_sourcing_state='internal_sourcing_approved');
 if not found then raise exception 'Vacancy is not open for candidate sourcing'; end if;
 v_terms:=array(
  select distinct term from pg_catalog.unnest(pg_catalog.regexp_split_to_array(pg_catalog.lower(pg_catalog.concat_ws(' ',v_job.title,v_job.description,pg_catalog.array_to_string(coalesce(v_job.requirements,array[]::text[]),' '),v_job.required_qualifications,v_job.duties)),'[^a-z0-9+#.]+')) as terms(term)
  where pg_catalog.length(term)>=3 and term not in ('the','and','for','with','from','this','that','you','your','our','are','will','have','has','job','role','work','working','required','requirements','candidate','candidates','experience','skills','salary','hours','days','week','must','able','full','time','per','year','based','within','including','provide','ensure','support','team','good','strong','ability','duties','responsibilities','company','position','role','north','west','east','south','uk','england','yorkshire','manchester','lancashire','cheshire','remote','hybrid','permanent','temporary') limit 50
 );
 return query
 with candidate_rows as (
  select c.id,c.full_name,c.location,c.stage::text candidate_stage,c.experience_summary,c.training_qualifications,c.authorisations,
   pg_catalog.lower(pg_catalog.concat_ws(' ',c.experience_summary,c.training_qualifications,c.authorisations)) searchable_text,
   (c.work_seeker_terms_agreed_at is not null) terms_agreed,
   exists(select 1 from public.applications a where a.company_id=v_company and a.job_id=p_job and a.candidate_id=c.id) applied
  from public.candidates c
  where c.company_id=v_company and c.erased_at is null and nullif(trim(coalesce(c.resume_path,'')),'') is not null
   and (v_query is null or c.full_name ilike '%'||v_query||'%' or coalesce(c.location,'') ilike '%'||v_query||'%' or coalesce(c.experience_summary,'') ilike '%'||v_query||'%' or coalesce(c.training_qualifications,'') ilike '%'||v_query||'%' or coalesce(c.authorisations,'') ilike '%'||v_query||'%')
 ), scored as (
  select c.*,
   (select count(*)::integer from pg_catalog.unnest(v_terms) t(term) where c.searchable_text like '%'||t.term||'%') term_matches,
   (nullif(trim(coalesce(c.location,'')),'') is not null and nullif(trim(coalesce(v_job.location,'')),'') is not null and (pg_catalog.lower(c.location)=pg_catalog.lower(v_job.location) or pg_catalog.lower(c.location) like '%'||pg_catalog.lower(v_job.location)||'%' or pg_catalog.lower(v_job.location) like '%'||pg_catalog.lower(c.location)||'%')) location_match
  from candidate_rows c
 ), qualified as (
  select s.*,least(100,(case when s.location_match then 20 else 0 end)+least(80,s.term_matches*10))::integer score,
   (case when s.location_match then array['Location aligns with vacancy']::text[] else array[]::text[] end
    ||coalesce((select pg_catalog.array_agg(t.term order by t.term) from pg_catalog.unnest(v_terms) t(term) where s.searchable_text like '%'||t.term||'%'),array[]::text[])) reasons
  from scored s
  where s.term_matches>=2 or (s.location_match and s.term_matches>=1)
 )
 select q.id,q.full_name,q.location,q.candidate_stage,q.experience_summary,q.training_qualifications,q.authorisations,q.score,q.reasons,q.terms_agreed,q.applied
 from qualified q order by q.score desc,q.terms_agreed desc,q.full_name asc limit greatest(1,least(coalesce(p_limit,50),50));
end;
$$;
revoke all on function public.manager_job_candidate_matches(uuid,text,integer) from public,anon;
grant execute on function public.manager_job_candidate_matches(uuid,text,integer) to authenticated;