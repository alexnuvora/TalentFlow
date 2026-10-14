CREATE OR REPLACE FUNCTION public.partner_confirm_candidate_introduction(p_candidate uuid,p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE uid uuid:=auth.uid(); prof public.partner_profiles%rowtype; candidate public.candidates%rowtype; job public.jobs%rowtype; pack public.partner_submission_packs%rowtype; app public.applications%rowtype; note text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO prof FROM public.partner_profiles WHERE user_id=uid AND active=true AND specialism IN ('candidate_sourcer','hybrid');
 IF NOT FOUND THEN RAISE EXCEPTION 'Active candidate-sourcing partner access required'; END IF;
 IF NOT public.candidate_processing_allowed(prof.company_id) THEN RAISE EXCEPTION 'Candidate processing unavailable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.partner_assignments WHERE company_id=prof.company_id AND partner_id=uid AND candidate_id=p_candidate AND completed_at IS NULL) THEN RAISE EXCEPTION 'Candidate assignment required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.partner_assignments WHERE company_id=prof.company_id AND partner_id=uid AND job_id=p_job AND completed_at IS NULL) THEN RAISE EXCEPTION 'Vacancy assignment required'; END IF;
 SELECT * INTO candidate FROM public.candidates WHERE id=p_candidate AND company_id=prof.company_id AND erased_at IS NULL;
 IF NOT FOUND OR candidate.work_seeker_terms_agreed_at IS NULL OR candidate.resume_path IS NULL THEN RAISE EXCEPTION 'CV and terms evidence required'; END IF;
 SELECT * INTO job FROM public.jobs WHERE id=p_job AND company_id=prof.company_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vacancy unavailable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.partner_candidate_pipeline WHERE company_id=prof.company_id AND partner_id=uid AND candidate_id=p_candidate AND job_id=p_job AND manager_status='approved') THEN RAISE EXCEPTION 'Management review required'; END IF;
 SELECT * INTO pack FROM public.partner_submission_packs WHERE company_id=prof.company_id AND partner_id=uid AND candidate_id=p_candidate AND job_id=p_job AND status='approved' ORDER BY reviewed_at DESC LIMIT 1;
 IF NOT FOUND OR length(btrim(coalesce(pack.summary,'')))<30 THEN RAISE EXCEPTION 'Approved screening pack required'; END IF;
 SELECT * INTO app FROM public.applications WHERE company_id=prof.company_id AND candidate_id=p_candidate AND job_id=p_job FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application unavailable'; END IF;
 note:='Recruiter '||uid::text||' confirmed on '||to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC that the candidate has received the particulars for '||job.title||', wishes to proceed, and has expressly authorised sharing a client-safe CV and profile with this employer. Confirmed from recruiter attestation at the time of action.';
 UPDATE public.applications SET
 source_details=jsonb_set(jsonb_set(coalesce(source_details,'{}'::jsonb),'{candidate_sharing_authorisation}',to_jsonb(note),true),'{candidate_sharing_authorisation_recorded_at}',to_jsonb(now()),true),
 vacancy_particulars_provided_at=coalesce(vacancy_particulars_provided_at,now()),
 willingness_confirmed_at=coalesce(willingness_confirmed_at,now()),
 willingness_evidence=coalesce(nullif(btrim(willingness_evidence),''),note),
 suitability_checked_at=coalesce(suitability_checked_at,pack.reviewed_at,now()),
 suitability_evidence=coalesce(nullif(btrim(suitability_evidence),''),'Management-approved recruiter screening pack '||pack.id::text||': '||pack.summary)
 WHERE id=app.id;
 RETURN jsonb_build_object('confirmed',true,'application_id',app.id);
END $$;
REVOKE ALL ON FUNCTION public.partner_confirm_candidate_introduction(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_confirm_candidate_introduction(uuid,uuid) TO authenticated;