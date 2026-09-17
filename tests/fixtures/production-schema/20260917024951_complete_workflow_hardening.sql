create or replace function public.enqueue_automation_event(p_company uuid,p_event text,p_candidate uuid,p_application uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare s record; n integer:=0; first_delay numeric;
begin
 for s in select id,steps from public.automation_sequences where company_id=p_company and trigger_event=p_event and active=true loop
  first_delay:=coalesce((s.steps->0->>'delay_hours')::numeric,0);
  insert into public.automation_enrollments(company_id,sequence_id,candidate_id,application_id,current_step,status,next_run_at)
  values(p_company,s.id,p_candidate,p_application,0,'queued',now()+make_interval(secs=greatest(first_delay,0)*3600))
  on conflict(sequence_id,candidate_id,application_id) do nothing;
  if found then n:=n+1; end if;
 end loop;
 return n;
end$$;
revoke all on function public.enqueue_automation_event(uuid,text,uuid,uuid) from public,anon,authenticated;

create or replace function public.tf_application_automation() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.enqueue_automation_event(new.company_id,'application_received',new.candidate_id,new.id); return new; end$$;
drop trigger if exists tf_application_automation on public.applications;
create trigger tf_application_automation after insert on public.applications for each row execute function public.tf_application_automation();

create or replace function public.tf_candidate_automation() returns trigger language plpgsql security definer set search_path='' as $$declare aid uuid;begin
 if new.stage='qualified' and old.stage is distinct from new.stage then select id into aid from public.applications where company_id=new.company_id and candidate_id=new.id order by submitted_at desc limit 1; perform public.enqueue_automation_event(new.company_id,'candidate_qualified',new.id,aid); end if; return new; end$$;
drop trigger if exists tf_candidate_automation on public.candidates;
create trigger tf_candidate_automation after update of stage on public.candidates for each row execute function public.tf_candidate_automation();

create or replace function public.tf_interview_automation() returns trigger language plpgsql security definer set search_path='' as $$declare aid uuid;begin
 if new.status='scheduled' and (tg_op='INSERT' or old.status is distinct from new.status or old.scheduled_at is distinct from new.scheduled_at) then select id into aid from public.applications where company_id=new.company_id and candidate_id=new.candidate_id and job_id=new.job_id order by submitted_at desc limit 1; perform public.enqueue_automation_event(new.company_id,'interview_scheduled',new.candidate_id,aid); end if; return new; end$$;
drop trigger if exists tf_interview_automation on public.interviews;
create trigger tf_interview_automation after insert or update of status,scheduled_at on public.interviews for each row execute function public.tf_interview_automation();

create or replace function public.tf_placement_automation() returns trigger language plpgsql security definer set search_path='' as $$declare aid uuid;begin select id into aid from public.applications where company_id=new.company_id and candidate_id=new.candidate_id and job_id=new.job_id order by submitted_at desc limit 1; perform public.enqueue_automation_event(new.company_id,'placement_created',new.candidate_id,aid); return new; end$$;
drop trigger if exists tf_placement_automation on public.placements;
create trigger tf_placement_automation after insert on public.placements for each row execute function public.tf_placement_automation();

create or replace function public.enqueue_inactive_candidates(p_hours integer default 168) returns integer language plpgsql security definer set search_path='' as $$declare r record;n integer:=0;begin
 for r in select c.company_id,c.id candidate_id,(select a.id from public.applications a where a.company_id=c.company_id and a.candidate_id=c.id order by a.submitted_at desc limit 1) application_id from public.candidates c where c.erased_at is null and c.stage not in ('placed','rejected','withdrawn') and coalesce(c.next_action_at,c.created_at)<now()-make_interval(hours=>greatest(p_hours,24)) loop n:=n+public.enqueue_automation_event(r.company_id,'candidate_inactive',r.candidate_id,r.application_id); end loop; return n;end$$;
revoke all on function public.enqueue_inactive_candidates(integer) from public,anon,authenticated;

create or replace function public.claim_automation_enrollments(p_limit integer default 25) returns setof uuid language sql security definer set search_path='' as $$
 with picked as (select e.id from public.automation_enrollments e join public.automation_sequences s on s.id=e.sequence_id and s.company_id=e.company_id where e.status='queued' and e.next_run_at<=now() and s.active=true order by e.next_run_at for update of e skip locked limit least(greatest(p_limit,1),100)), upd as (update public.automation_enrollments e set status='processing',updated_at=now() from picked where e.id=picked.id returning e.id) select id from upd;
$$;
revoke all on function public.claim_automation_enrollments(integer) from public,anon,authenticated;

create or replace function public.client_portal_action(p_submission_id uuid,p_action text,p_feedback text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype;s public.candidate_submissions%rowtype; new_status text;
begin
 select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;if not found then raise exception 'Client access required';end if;
 select * into s from public.candidate_submissions where id=p_submission_id and company_id=p.company_id and client_id=p.client_id;if not found then raise exception 'Submission not found';end if;
 new_status:=case p_action when 'approve' then 'client_approved' when 'reject' then 'client_rejected' when 'request_interview' then 'interview_requested' else null end;if new_status is null then raise exception 'Invalid action';end if;
 update public.candidate_submissions set status=new_status,client_feedback=nullif(left(trim(coalesce(p_feedback,'')),5000),''),reviewed_at=now(),updated_at=now() where id=s.id;
 if p_action='approve' then update public.candidates set stage='offer' where id=s.candidate_id and company_id=p.company_id and stage not in ('placed','withdrawn'); elsif p_action='reject' then update public.candidates set stage='rejected' where id=s.candidate_id and company_id=p.company_id and stage not in ('placed','withdrawn'); elsif p_action='request_interview' then update public.candidates set stage='interview' where id=s.candidate_id and company_id=p.company_id and stage not in ('placed','withdrawn'); end if;
 return jsonb_build_object('ok',true,'status',new_status);
end$$;
revoke all on function public.client_portal_action(uuid,text,text) from public,anon;grant execute on function public.client_portal_action(uuid,text,text) to authenticated;

create or replace function public.manage_interview(p_interview_id uuid,p_action text,p_scheduled_at timestamptz default null,p_duration integer default null,p_meeting_url text default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype;i public.interviews%rowtype;begin
 select * into p from public.profiles where id=auth.uid() and role in ('owner','manager','recruiter');if not found then raise exception 'Staff access required';end if;
 select * into i from public.interviews where id=p_interview_id and company_id=p.company_id;if not found then raise exception 'Interview not found';end if;
 if p_action='cancel' then update public.interviews set status='cancelled',recruiter_notes=coalesce(nullif(left(trim(coalesce(p_notes,'')),5000),''),recruiter_notes),updated_at=now() where id=i.id;
 elsif p_action='complete' then update public.interviews set status='completed',recruiter_notes=coalesce(nullif(left(trim(coalesce(p_notes,'')),5000),''),recruiter_notes),updated_at=now() where id=i.id;
 elsif p_action='reschedule' then if p_scheduled_at is null or p_scheduled_at<=now() then raise exception 'Future interview time required';end if; update public.interviews set scheduled_at=p_scheduled_at,duration_minutes=coalesce(p_duration,duration_minutes),meeting_url=coalesce(nullif(trim(p_meeting_url),''),meeting_url),status='scheduled',recruiter_notes=coalesce(nullif(left(trim(coalesce(p_notes,'')),5000),''),recruiter_notes),updated_at=now() where id=i.id;
 else raise exception 'Invalid action';end if;return jsonb_build_object('ok',true);
end$$;
revoke all on function public.manage_interview(uuid,text,timestamptz,integer,text,text) from public,anon;grant execute on function public.manage_interview(uuid,text,timestamptz,integer,text,text) to authenticated;

create or replace function public.client_portal_data() returns jsonb language plpgsql stable security definer set search_path='' as $$declare p public.profiles%rowtype;result jsonb;begin
 select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;if not found then raise exception 'Client access required';end if;
 select jsonb_build_object('client',(select jsonb_build_object('company_name',company_name) from public.clients where id=p.client_id and company_id=p.company_id),'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'location',location,'employment_type',employment_type)) from public.jobs where client_id=p.client_id and company_id=p.company_id),'[]'::jsonb),'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'feedback',s.client_feedback,'summary',s.recruiter_summary,'submitted_at',s.submitted_at,'candidates',jsonb_build_object('full_name',c.full_name),'jobs',jsonb_build_object('title',j.title))) from public.candidate_submissions s join public.candidates c on c.id=s.candidate_id join public.jobs j on j.id=s.job_id where s.client_id=p.client_id and s.company_id=p.company_id and s.status not in ('draft','withdrawn','approved_to_send')),'[]'::jsonb),'interviews',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,'meeting_url',i.meeting_url,'status',i.status,'candidates',jsonb_build_object('full_name',c.full_name),'jobs',jsonb_build_object('title',j.title))) from public.interviews i join public.candidates c on c.id=i.candidate_id join public.jobs j on j.id=i.job_id where i.client_id=p.client_id and i.company_id=p.company_id and exists(select 1 from public.candidate_submissions s where s.candidate_id=i.candidate_id and s.job_id=i.job_id and s.client_id=p.client_id and s.status not in ('draft','withdrawn','approved_to_send'))),'[]'::jsonb)) into result;return result;end$$;
revoke all on function public.client_portal_data() from public,anon;grant execute on function public.client_portal_data() to authenticated;
