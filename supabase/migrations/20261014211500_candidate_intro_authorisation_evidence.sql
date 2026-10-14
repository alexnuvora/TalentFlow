CREATE OR REPLACE FUNCTION public.record_candidate_sharing_authority(p_application uuid,p_evidence text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a public.applications%rowtype; actor public.profiles%rowtype;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=auth.uid();
 IF NOT FOUND OR actor.role NOT IN ('owner','manager','recruiter')
 OR NOT public.candidate_processing_allowed(actor.company_id) THEN RAISE EXCEPTION 'Approved recruitment access required'; END IF;
 IF actor.role='recruiter' AND NOT public.has_candidate_data_access() THEN RAISE EXCEPTION 'Recruiter candidate-data access required'; END IF;
 IF length(btrim(coalesce(p_evidence,'')))<20 THEN RAISE EXCEPTION 'Record specific candidate authorisation and its source (20 characters minimum)'; END IF;
 SELECT * INTO a FROM public.applications WHERE id=p_application AND company_id=actor.company_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application unavailable'; END IF;
 UPDATE public.applications SET source_details=jsonb_set(jsonb_set(coalesce(a.source_details,'{}'::jsonb),'{candidate_sharing_authorisation}',to_jsonb(btrim(p_evidence)),true),'{candidate_sharing_authorisation_recorded_at}',to_jsonb(now()),true) WHERE id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.record_candidate_sharing_authority(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_candidate_sharing_authority(uuid,text) TO authenticated;