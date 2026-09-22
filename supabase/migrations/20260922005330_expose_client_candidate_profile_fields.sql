create or replace function public.client_portal_data_authorised()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  p public.profiles%rowtype;
  result jsonb;
begin
  select * into p
  from public.profiles
  where id=auth.uid() and role='viewer' and client_id is not null;

  if not found then raise exception 'Client access required'; end if;

  select jsonb_build_object(
    'client',(
      select jsonb_build_object('company_name',company_name)
      from public.clients
      where id=p.client_id and company_id=p.company_id
    ),
    'jobs',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,'title',title,'status',status,'location',location,'employment_type',employment_type
      ))
      from public.jobs
      where client_id=p.client_id and company_id=p.company_id
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'status',s.status,'feedback',s.client_feedback,'summary',s.recruiter_summary,
        'headline',s.headline,'key_strengths',coalesce(s.key_strengths,'[]'::jsonb),
        'concerns',coalesce(s.concerns,'[]'::jsonb),'submitted_at',s.submitted_at,
        'has_cv',(c.resume_path is not null or c.cv_url is not null),
        'candidates',jsonb_build_object(
          'full_name',c.full_name,'location',c.location,'linkedin_url',c.linkedin_url,
          'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,
          'authorisations',c.authorisations
        ),
        'jobs',jsonb_build_object('title',j.title)
      ))
      from public.candidate_submissions s
      join public.candidates c on c.id=s.candidate_id
      join public.jobs j on j.id=s.job_id
      where s.client_id=p.client_id and s.company_id=p.company_id
        and s.status not in ('draft','withdrawn','approved_to_send')
    ),'[]'::jsonb),
    'interviews',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,
        'meeting_url',i.meeting_url,'status',i.status,
        'candidates',jsonb_build_object('full_name',c.full_name),
        'jobs',jsonb_build_object('title',j.title)
      ))
      from public.interviews i
      join public.candidates c on c.id=i.candidate_id
      join public.jobs j on j.id=i.job_id
      where i.client_id=p.client_id and i.company_id=p.company_id
        and exists(
          select 1 from public.candidate_submissions s
          where s.candidate_id=i.candidate_id and s.job_id=i.job_id
            and s.client_id=p.client_id
            and s.status not in ('draft','withdrawn','approved_to_send')
        )
    ),'[]'::jsonb)
  ) into result;

  return result;
end
$function$;
