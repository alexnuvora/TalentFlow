-- Use a unique anonymised external profile ID per candidate source row.
-- Prevents collisions between successive candidate privacy erasures.
CREATE OR REPLACE FUNCTION public.candidate_privacy_operation(p_request uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.privacy_requests%rowtype; c public.candidates%rowtype; t record; col record; rows jsonb; result jsonb:='{}'; assignments text; replacement text;
begin
 select q.* into r from public.privacy_requests q join public.profiles p on p.company_id=q.company_id and p.id=auth.uid() and p.role in ('owner','manager') where q.id=p_request for update of q;
 if not found then raise exception 'Privacy request not found or manager access required'; end if;
 select * into c from public.candidates where id=r.candidate_id and company_id=r.company_id for update;
 if not found then raise exception 'Linked candidate not found'; end if;
 if p_action not in ('export','erase') then raise exception 'Invalid privacy operation'; end if;
 if p_action='erase' and c.statutory_retain_until>now() then raise exception 'Retention hold until %. Review and explain the applicable exception before erasure.',c.statutory_retain_until; end if;
 if p_action='erase' and exists(select 1 from storage.objects where bucket_id='candidate-resumes' and (name=c.resume_path or starts_with(name,c.company_id::text||'/'||c.id::text||'/'))) then raise exception 'Candidate file removal has not completed';end if;
 if p_action='export' then result:=jsonb_build_object('candidate',to_jsonb(c),'exported_at',now());end if;
 if p_action='erase' then perform set_config('vorlen.privacy_candidate',c.id::text,true);end if;
 for t in select distinct x.table_name from information_schema.columns x where x.table_schema='public' and x.column_name='candidate_id' and x.table_name not in ('candidate_portal_tokens') loop
  if p_action='export' then
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x where candidate_id=$1 and company_id=$2',t.table_name) into rows using c.id,c.company_id;
   result:=result||jsonb_build_object(t.table_name,rows);
  else
   assignments:='';
   for col in select column_name,data_type from information_schema.columns where table_schema='public' and table_name=t.table_name and column_name in ('notes','detail','metadata','answers','source_details','cover_note','recruiter_notes','client_notes','summary','recruiter_summary','headline','client_feedback','candidate_authorisation','willingness_statement','willingness_evidence','suitability_evidence','qualification_verification_evidence','vulnerable_checks_evidence','training_qualifications','authorisations','next_action','manager_notes','description','title','subject','external_ref','candidate_name','candidate_email','email','source_url','external_profile_id','evidence','interview_questions','strengths','gaps','key_strengths','concerns','meeting_url') loop
    replacement:=case when t.table_name='candidate_source_records' and col.column_name='external_profile_id' then '''erased-''||id::text' when col.data_type='jsonb' then case when col.column_name in ('strengths','gaps','key_strengths','concerns','evidence','interview_questions') then '''[]''::jsonb' else '''{}''::jsonb' end else '''Erased''' end;
    assignments:=assignments||case when assignments='' then '' else ',' end||format('%I=%s',col.column_name,replacement);
   end loop;
   if assignments<>'' then execute format('update public.%I set %s where candidate_id=$1 and company_id=$2',t.table_name,assignments) using c.id,c.company_id;end if;
  end if;
 end loop;
 if p_action='export' then return result;end if;
 update public.candidate_portal_tokens set revoked_at=now() where candidate_id=c.id;
 update public.client_submission_review_tokens set revoked_at=now() where company_id=c.company_id and submission_id in(select id from public.candidate_submissions where candidate_id=c.id and company_id=c.company_id);
 update public.automation_enrollments set status='completed',last_error='Candidate erased' where candidate_id=c.id and company_id=c.company_id;
 update public.outbound_deliveries set payload='{}',recipient='erased@invalid.local' where company_id=c.company_id and (recipient=c.email or recipient=c.phone or id in(select delivery_id from public.candidate_submissions where candidate_id=c.id and company_id=c.company_id));
 delete from public.frozen_email_attempts f where f.company_id=c.company_id and (f.submission_id in (select id from public.candidate_submissions where candidate_id=c.id and company_id=c.company_id) or exists(select 1 from public.automation_enrollments a where a.candidate_id=c.id and a.company_id=c.company_id and starts_with(f.idempotency_key,'automation:'||a.id::text||':step:')));
 update public.candidates set full_name='Erased candidate',email='erased+'||c.id||'@invalid.local',phone=null,location=null,linkedin_url=null,cv_url=null,resume_path=null,source=null,notes=null,recruiter_summary=null,next_action=null,next_action_at=null,score=null,postal_address=null,date_of_birth=null,under_22=null,experience_summary=null,training_qualifications=null,authorisations=null,work_seeker_terms_evidence=null,marketing_opt_in_at=null,marketing_opt_out_at=now(),erased_at=now() where id=c.id and company_id=c.company_id;
 update public.privacy_requests set status='completed',completed_at=now(),handled_by=auth.uid() where id=r.id;
 perform set_config('vorlen.privacy_candidate','',true);
 return jsonb_build_object('ok',true);
end $function$
;
