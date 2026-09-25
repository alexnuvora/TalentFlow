create or replace function public.client_create_vacancy_request(
 p_title text,p_hiring_need text,p_location text default null,p_employment_type text default null,
 p_salary_min numeric default null,p_salary_max numeric default null,p_desired_start_date date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid;v_client uuid;v_role text;v_id uuid;
begin
 select c.company_id,c.client_id,c.portal_role into v_company,v_client,v_role from private.current_client_portal_context() c;
 if v_client is null then raise exception 'Client portal access required'; end if;
 if not public.workspace_feature_enabled(v_company,'client_portal') then raise exception 'This feature requires an active subscription that includes the client portal'; end if;
 if v_role not in ('admin','hiring_manager') then raise exception 'Your client portal role cannot request vacancies'; end if;
 if length(btrim(coalesce(p_title,'')))<2 or length(btrim(coalesce(p_hiring_need,'')))<10 then raise exception 'Title and hiring requirement are required'; end if;
 if p_salary_min is not null and p_salary_min<0 then raise exception 'Minimum salary cannot be negative'; end if;
 if p_salary_max is not null and p_salary_max<0 then raise exception 'Maximum salary cannot be negative'; end if;
 if p_salary_min is not null and p_salary_max is not null and p_salary_max<p_salary_min then raise exception 'Maximum salary cannot be lower than minimum salary'; end if;
 insert into public.client_vacancy_requests(company_id,client_id,requested_by,title,location,employment_type,salary_min,salary_max,hiring_need,desired_start_date)
 values(v_company,v_client,auth.uid(),left(btrim(p_title),300),nullif(left(btrim(coalesce(p_location,'')),300),''),nullif(left(btrim(coalesce(p_employment_type,'')),100),''),p_salary_min,p_salary_max,left(btrim(p_hiring_need),10000),p_desired_start_date)
 returning id into v_id;
 insert into public.partner_communication_events(company_id,client_id,event_type,channel,direction,subject,summary,metadata)
 values(v_company,v_client,'portal','portal','inbound','Client vacancy request','Client requested a vacancy: '||left(btrim(p_title),300)||'. '||left(btrim(p_hiring_need),5000),jsonb_build_object('vacancy_request_id',v_id,'portal_role',v_role));
 return v_id;
end $$;

create or replace function public.client_portal_permissions()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;v_client uuid;v_role text;
begin
 select c.company_id,c.client_id,c.portal_role into v_company,v_client,v_role from private.current_client_portal_context() c;
 if v_client is null then raise exception 'Client portal access required'; end if;
 if not public.workspace_feature_enabled(v_company,'client_portal') then raise exception 'This feature requires an active subscription that includes the client portal'; end if;
 return jsonb_build_object('portal_role',v_role,'can_review_candidates',v_role in ('admin','hiring_manager','reviewer'),'can_request_vacancies',v_role in ('admin','hiring_manager'),'can_manage_members',v_role='admin');
end $$;

create or replace function public.client_portal_members()
returns table(user_id uuid,email text,full_name text,portal_role text,status text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;v_client uuid;v_role text;
begin
 select c.company_id,c.client_id,c.portal_role into v_company,v_client,v_role from private.current_client_portal_context() c;
 if v_client is null then raise exception 'Client portal access required'; end if;
 if not public.workspace_feature_enabled(v_company,'client_portal') then raise exception 'This feature requires an active subscription that includes the client portal'; end if;
 if v_role<>'admin' then raise exception 'Client admin access required'; end if;
 return query select m.user_id,m.email,m.full_name,m.portal_role,m.status,m.updated_at from public.client_portal_memberships m
 where m.company_id=v_company and m.client_id=v_client order by case when m.user_id=auth.uid() then 0 else 1 end,m.full_name nulls last,m.email;
end $$;

create or replace function public.client_rate_candidate(p_submission_id uuid,p_rating integer,p_feedback text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_company uuid;v_client uuid;v_role text;v_submission public.candidate_submissions%rowtype;
begin
 select c.company_id,c.client_id,c.portal_role into v_company,v_client,v_role from private.current_client_portal_context() c;
 if v_client is null then raise exception 'Client portal access required'; end if;
 if not public.workspace_feature_enabled(v_company,'client_portal') then raise exception 'This feature requires an active subscription that includes the client portal'; end if;
 if v_role not in ('admin','hiring_manager','reviewer') then raise exception 'Your client portal role is read-only'; end if;
 if p_rating<1 or p_rating>5 then raise exception 'Rating must be between 1 and 5'; end if;
 select * into v_submission from public.candidate_submissions s where s.id=p_submission_id and s.company_id=v_company and s.client_id=v_client and s.status not in ('draft','withdrawn','approved_to_send') for update;
 if not found then raise exception 'Candidate submission not found'; end if;
 update public.candidate_submissions set client_rating=p_rating,client_feedback=case when nullif(btrim(coalesce(p_feedback,'')),'') is not null then left(btrim(p_feedback),5000) else client_feedback end,client_feedback_at=case when nullif(btrim(coalesce(p_feedback,'')),'') is not null then now() else client_feedback_at end,updated_at=now() where id=v_submission.id;
 insert into public.partner_communication_events(company_id,client_id,candidate_id,job_id,event_type,channel,direction,subject,summary,metadata)
 values(v_submission.company_id,v_submission.client_id,v_submission.candidate_id,v_submission.job_id,'portal','portal','inbound','Client candidate rating','Client rated the candidate '||p_rating::text||'/5.'||case when nullif(btrim(coalesce(p_feedback,'')),'') is not null then ' Feedback: '||left(btrim(p_feedback),5000) else '' end,jsonb_build_object('submission_id',v_submission.id,'rating',p_rating));
 return jsonb_build_object('ok',true,'rating',p_rating);
end $$;

create or replace function public.client_admin_update_portal_member(p_user uuid,p_role text,p_status text default 'active')
returns void language plpgsql security definer set search_path='' as $$
declare v_company uuid;v_client uuid;v_role text;
begin
 select c.company_id,c.client_id,c.portal_role into v_company,v_client,v_role from private.current_client_portal_context() c;
 if v_client is null or v_role<>'admin' then raise exception 'Client admin access required'; end if;
 if p_status='active' and not public.workspace_feature_enabled(v_company,'client_portal') then raise exception 'This feature requires an active subscription that includes the client portal'; end if;
 if p_user=auth.uid() then raise exception 'You cannot change or revoke your own client admin access'; end if;
 if p_role not in ('admin','hiring_manager','reviewer','read_only') then raise exception 'Invalid client portal role'; end if;
 if p_status not in ('active','revoked') then raise exception 'Invalid membership status'; end if;
 update public.client_portal_memberships set portal_role=p_role,status=p_status,updated_at=now() where user_id=p_user and company_id=v_company and client_id=v_client;
 if not found then raise exception 'Client portal member not found'; end if;
end $$;

create or replace function public.manager_update_client_portal_member(p_user uuid,p_client uuid,p_role text,p_status text default 'active')
returns void language plpgsql security definer set search_path='' as $$
declare v_company uuid:=private.current_company_id();
begin
 if not private.is_manager() then raise exception 'Manager access required'; end if;
 if p_status='active' and not public.workspace_feature_enabled(v_company,'client_portal') then raise exception 'This feature requires an active subscription that includes the client portal'; end if;
 if p_role not in ('admin','hiring_manager','reviewer','read_only') then raise exception 'Invalid client portal role'; end if;
 if p_status not in ('active','revoked') then raise exception 'Invalid membership status'; end if;
 update public.client_portal_memberships m set portal_role=p_role,status=p_status,updated_at=now() where m.user_id=p_user and m.client_id=p_client and m.company_id=v_company;
 if not found then raise exception 'Client portal member not found'; end if;
end $$;
