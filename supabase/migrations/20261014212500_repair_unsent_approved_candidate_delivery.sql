CREATE OR REPLACE FUNCTION public.repair_unsent_approved_candidate_delivery(p_actor uuid,p_application uuid,p_summary text,p_authorisation text,p_recipient text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a public.applications%rowtype; s public.candidate_submissions%rowtype; actor public.profiles%rowtype; cl public.clients%rowtype; j public.jobs%rowtype; delivery uuid;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor;
 IF NOT FOUND OR actor.role NOT IN ('owner','manager','recruiter') THEN RAISE EXCEPTION 'Approved staff access required'; END IF;
 IF actor.role='recruiter' AND NOT EXISTS (SELECT 1 FROM public.recruiter_data_access_approvals r WHERE r.user_id=p_actor AND r.company_id=actor.company_id AND r.approved_at IS NOT NULL AND r.revoked_at IS NULL AND (r.expires_at IS NULL OR r.expires_at>now())) THEN RAISE EXCEPTION 'Recruiter approval required'; END IF;
 SELECT * INTO a FROM public.applications WHERE id=p_application AND company_id=actor.company_id FOR UPDATE;
 IF NOT FOUND OR a.status<>'qualified' THEN RAISE EXCEPTION 'Qualified application required'; END IF;
 IF coalesce(btrim(a.willingness_evidence),'')='' OR a.willingness_confirmed_at IS NULL OR a.vacancy_particulars_provided_at IS NULL OR coalesce(btrim(a.suitability_evidence),'')='' OR a.suitability_checked_at IS NULL THEN RAISE EXCEPTION 'Candidate willingness and suitability evidence required'; END IF;
 IF coalesce(length(btrim(p_summary)),0)<10 OR coalesce(length(btrim(p_authorisation)),0)<10 THEN RAISE EXCEPTION 'Approved summary and genuine sharing authority required'; END IF;
 SELECT * INTO j FROM public.jobs WHERE id=a.job_id AND company_id=a.company_id;
 SELECT * INTO cl FROM public.clients WHERE id=j.client_id AND company_id=a.company_id AND status='active';
 IF NOT FOUND OR cl.email IS NULL OR lower(btrim(p_recipient))<>lower(btrim(cl.email)) THEN RAISE EXCEPTION 'Verified client recipient required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.partner_submission_packs pk WHERE pk.company_id=a.company_id AND pk.job_id=a.job_id AND pk.candidate_id=a.candidate_id AND pk.status='approved') THEN RAISE EXCEPTION 'Approved recruiter pack required'; END IF;
 SELECT * INTO s FROM public.candidate_submissions WHERE company_id=a.company_id AND client_id=cl.id AND job_id=a.job_id AND candidate_id=a.candidate_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'approved_to_send' OR s.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Only an unsent approved submission can be repaired'; END IF;
 IF s.delivery_id IS NOT NULL THEN RETURN s.delivery_id; END IF;
 INSERT INTO public.outbound_deliveries(company_id,kind,idempotency_key,recipient,provider,status)
 VALUES(a.company_id,'client_submission','submission:'||a.id,cl.email,'resend','reserved')
 ON CONFLICT (company_id,idempotency_key) DO UPDATE SET recipient=excluded.recipient
 RETURNING id INTO delivery;
 UPDATE public.candidate_submissions SET application_id=a.id,delivery_id=delivery,recipient_email=cl.email,recruiter_summary=p_summary,candidate_authorisation=p_authorisation,reviewed_by=p_actor,review_confirmed_at=now(),updated_at=now() WHERE id=s.id;
 RETURN delivery;
END $$;
REVOKE ALL ON FUNCTION public.repair_unsent_approved_candidate_delivery(uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_unsent_approved_candidate_delivery(uuid,uuid,text,text,text) TO service_role;