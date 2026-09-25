create or replace function public.enqueue_automation_event(p_company uuid, p_event text, p_candidate uuid, p_application uuid default null)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare s record; n integer:=0; first_delay numeric;
begin
 for s in select id,steps from public.automation_sequences where company_id=p_company and trigger_event=p_event and active=true loop
  first_delay:=coalesce((s.steps->0->>'delay_hours')::numeric,0);
  insert into public.automation_enrollments(company_id,sequence_id,candidate_id,application_id,current_step,status,next_run_at)
  values(p_company,s.id,p_candidate,p_application,0,'queued',now()+make_interval(secs => greatest(first_delay,0)*3600))
  on conflict(sequence_id,candidate_id,application_id) do nothing;
  if found then n:=n+1; end if;
 end loop;
 return n;
end
$$;
