create index if not exists client_terms_documents_client_id_idx
  on public.client_terms_documents(client_id);
create index if not exists client_terms_documents_created_by_idx
  on public.client_terms_documents(created_by);

drop policy if exists "client terms managers insert" on public.client_terms_documents;
create policy "client terms managers insert"
on public.client_terms_documents
for insert to authenticated
with check (
  company_id = private.current_company_id()
  and private.is_manager()
  and created_by = (select auth.uid())
);

drop policy if exists "recruiter_access_approval_managers_select" on public.recruiter_data_access_approvals;
drop policy if exists "recruiter_access_approval_self_select" on public.recruiter_data_access_approvals;
drop policy if exists "recruiter_access_approval_select" on public.recruiter_data_access_approvals;
create policy "recruiter_access_approval_select"
on public.recruiter_data_access_approvals
for select to authenticated
using (
  company_id = private.current_company_id()
  and (private.is_manager() or user_id = (select auth.uid()))
);

create or replace function private.client_portal_data_authorised()
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare p public.profiles%rowtype; result jsonb;
begin
  select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;
  if not found then raise exception 'Client access required'; end if;
  if not public.workspace_feature_enabled(p.company_id,'client_portal') then raise exception 'This feature requires an active subscription that includes it'; end if;
  select jsonb_build_object(
    'client',(select jsonb_build_object('company_name',company_name) from public.clients where id=p.client_id and company_id=p.company_id),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'location',location,'employment_type',employment_type)) from public.jobs where client_id=p.client_id and company_id=p.company_id),'[]'::jsonb),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'feedback',s.client_feedback,'summary',s.recruiter_summary,'headline',s.headline,'key_strengths',coalesce(s.key_strengths,'[]'::jsonb),'concerns',coalesce(s.concerns,'[]'::jsonb),'submitted_at',s.submitted_at,'has_cv',(c.resume_path is not null),'candidates',jsonb_build_object('full_name',c.full_name,'location',c.location,'experience_summary',c.experience_summary,'training_qualifications',c.training_qualifications,'authorisations',c.authorisations),'jobs',jsonb_build_object('title',j.title))) from public.candidate_submissions s join public.candidates c on c.id=s.candidate_id join public.jobs j on j.id=s.job_id where s.client_id=p.client_id and s.company_id=p.company_id and s.status not in ('draft','withdrawn','approved_to_send')),'[]'::jsonb),
    'interviews',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'scheduled_at',i.scheduled_at,'duration_minutes',i.duration_minutes,'meeting_url',i.meeting_url,'status',i.status,'candidates',jsonb_build_object('full_name',c.full_name),'jobs',jsonb_build_object('title',j.title))) from public.interviews i join public.candidates c on c.id=i.candidate_id join public.jobs j on j.id=i.job_id where i.client_id=p.client_id and i.company_id=p.company_id and exists(select 1 from public.candidate_submissions s where s.candidate_id=i.candidate_id and s.job_id=i.job_id and s.client_id=p.client_id and s.status not in ('draft','withdrawn','approved_to_send'))),'[]'::jsonb)
  ) into result;
  return result;
end $function$;

revoke all on function private.client_portal_data_authorised() from public,anon;
grant execute on function private.client_portal_data_authorised() to authenticated,service_role;

create or replace function public.client_portal_data()
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.client_portal_data_authorised() $function$;

create or replace function private.client_portal_action(p_submission_id uuid,p_action text,p_feedback text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare p public.profiles%rowtype; s public.candidate_submissions%rowtype; ns text; ast text;
begin
  select * into p from public.profiles where id=auth.uid() and role='viewer' and client_id is not null;
  if not found then raise exception 'Client access required'; end if;
  if not public.workspace_feature_enabled(p.company_id,'client_portal') then raise exception 'This feature requires an active subscription that includes it'; end if;
  select * into s from public.candidate_submissions where id=p_submission_id and company_id=p.company_id and client_id=p.client_id;
  if not found then raise exception 'Submission not found'; end if;
  ns:=case p_action when 'approve' then 'client_approved' when 'reject' then 'client_rejected' when 'request_interview' then 'interview_requested' end;
  ast:=case p_action when 'approve' then 'client_approved' when 'reject' then 'rejected' when 'request_interview' then 'interview_requested' end;
  if ns is null then raise exception 'Invalid action'; end if;
  update public.candidate_submissions set status=ns,client_feedback=nullif(left(trim(coalesce(p_feedback,'')),5000),''),reviewed_at=now(),updated_at=now() where id=s.id;
  if s.application_id is not null then update public.applications set status=ast where id=s.application_id and company_id=p.company_id; end if;
  return jsonb_build_object('ok',true,'status',ns);
end $function$;

revoke all on function private.client_portal_action(uuid,text,text) from public,anon;
grant execute on function private.client_portal_action(uuid,text,text) to authenticated,service_role;

create or replace function public.client_portal_action(p_submission_id uuid,p_action text,p_feedback text default null)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.client_portal_action(p_submission_id,p_action,p_feedback) $function$;

revoke execute on function public.client_portal_data() from public,anon;
grant execute on function public.client_portal_data() to authenticated,service_role;
revoke execute on function public.client_portal_action(uuid,text,text) from public,anon;
grant execute on function public.client_portal_action(uuid,text,text) to authenticated,service_role;

drop function if exists public.client_portal_data_authorised();
