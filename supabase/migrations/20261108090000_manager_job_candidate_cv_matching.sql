create or replace function public.manager_job_candidate_matches(
  p_job uuid,
  p_query text default null,
  p_limit integer default 50
)
returns table(
  candidate_id uuid,
  full_name text,
  location text,
  stage text,
  experience_summary text,
  training_qualifications text,
  authorisations text,
  match_score integer,
  match_reasons text[],
  work_seeker_terms_agreed boolean,
  already_applied boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := private.current_company_id();
  v_job public.jobs%rowtype;
  v_terms text[];
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if v_company is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = v_company
      and p.role in ('owner', 'manager')
  ) then
    raise exception 'Workspace owner or manager access required';
  end if;

  if not public.candidate_processing_allowed(v_company) then
    raise exception 'Candidate processing is not active';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job
    and j.company_id = v_company
    and j.status not in ('closed', 'paused')
    and (j.status = 'published' or j.partner_sourcing_state = 'internal_sourcing_approved');

  if not found then
    raise exception 'Vacancy is not open for candidate sourcing';
  end if;

  v_terms := array(
    select distinct term
    from pg_catalog.unnest(
      pg_catalog.regexp_split_to_array(
        pg_catalog.lower(
          pg_catalog.concat_ws(
            ' ',
            v_job.title,
            v_job.description,
            pg_catalog.array_to_string(coalesce(v_job.requirements, array[]::text[]), ' '),
            v_job.required_qualifications,
            v_job.duties,
            v_job.work_days_hours
          )
        ),
        '[^a-z0-9+#.]+'
      )
    ) as terms(term)
    where pg_catalog.length(term) >= 3
      and term not in (
        'the','and','for','with','from','this','that','you','your','our','are','will',
        'have','has','job','role','work','working','required','requirements','candidate',
        'candidates','experience','skills','salary','hours','days','week','must','able'
      )
    limit 50
  );

  return query
  with candidate_rows as (
    select
      c.id,
      c.full_name,
      c.location,
      c.stage::text as candidate_stage,
      c.experience_summary,
      c.training_qualifications,
      c.authorisations,
      pg_catalog.lower(
        pg_catalog.concat_ws(
          ' ',
          c.experience_summary,
          c.training_qualifications,
          c.authorisations
        )
      ) as searchable_text,
      (c.work_seeker_terms_agreed_at is not null) as terms_agreed,
      exists (
        select 1 from public.applications a
        where a.company_id = v_company
          and a.job_id = p_job
          and a.candidate_id = c.id
      ) as applied
    from public.candidates c
    where c.company_id = v_company
      and c.erased_at is null
      and nullif(trim(coalesce(c.resume_path, '')), '') is not null
      and (
        v_query is null
        or c.full_name ilike '%' || v_query || '%'
        or coalesce(c.location, '') ilike '%' || v_query || '%'
        or coalesce(c.experience_summary, '') ilike '%' || v_query || '%'
        or coalesce(c.training_qualifications, '') ilike '%' || v_query || '%'
        or coalesce(c.authorisations, '') ilike '%' || v_query || '%'
      )
  ),
  scored as (
    select
      c.*,
      least(
        100,
        (case
          when nullif(trim(coalesce(v_job.location, '')), '') is not null
            and (
              pg_catalog.lower(coalesce(c.location, '')) = pg_catalog.lower(v_job.location)
              or pg_catalog.lower(coalesce(c.location, '')) like '%' || pg_catalog.lower(v_job.location) || '%'
              or pg_catalog.lower(v_job.location) like '%' || pg_catalog.lower(coalesce(c.location, '')) || '%'
            )
          then 20 else 0
        end)
        + least(
            70,
            coalesce((
              select pg_catalog.count(*) * 7
              from pg_catalog.unnest(v_terms) as t(term)
              where c.searchable_text like '%' || t.term || '%'
            ), 0)
          )
        + (case when c.terms_agreed then 5 else 0 end)
        + (case when c.applied then 5 else 0 end)
      )::integer as score,
      (
        case
          when nullif(trim(coalesce(v_job.location, '')), '') is not null
            and (
              pg_catalog.lower(coalesce(c.location, '')) = pg_catalog.lower(v_job.location)
              or pg_catalog.lower(coalesce(c.location, '')) like '%' || pg_catalog.lower(v_job.location) || '%'
              or pg_catalog.lower(v_job.location) like '%' || pg_catalog.lower(coalesce(c.location, '')) || '%'
            )
          then array['Location aligns with vacancy']::text[]
          else array[]::text[]
        end
        ||
        coalesce((
          select pg_catalog.array_agg(t.term order by t.term)
          from pg_catalog.unnest(v_terms) as t(term)
          where c.searchable_text like '%' || t.term || '%'
        ), array[]::text[])
      ) as reasons
    from candidate_rows c
  )
  select
    s.id,
    s.full_name,
    s.location,
    s.candidate_stage,
    s.experience_summary,
    s.training_qualifications,
    s.authorisations,
    s.score,
    s.reasons,
    s.terms_agreed,
    s.applied
  from scored s
  where s.score > 0
  order by s.score desc, s.terms_agreed desc, s.full_name asc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
end;
$$;

revoke all on function public.manager_job_candidate_matches(uuid, text, integer) from public, anon;
grant execute on function public.manager_job_candidate_matches(uuid, text, integer) to authenticated;
