-- Link each partner candidate-vacancy pipeline association to one internal application.
-- Creating the application does not record candidate consent or authorise client submission.
CREATE OR REPLACE FUNCTION public.ensure_partner_pipeline_application()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.candidate_id IS NULL OR NEW.job_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.jobs j ON j.company_id = c.company_id
    WHERE c.id = NEW.candidate_id AND j.id = NEW.job_id AND c.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Candidate and vacancy must belong to the same organisation';
  END IF;
  INSERT INTO public.applications
    (company_id, job_id, candidate_id, source, status, cover_note, source_details, human_review_required)
  VALUES
    (NEW.company_id, NEW.job_id, NEW.candidate_id, 'partner_pipeline', 'received',
     'Candidate linked by an authorised recruiter; not submitted to the employer.',
     jsonb_build_object('origin','partner_candidate_pipeline','partner_id',NEW.partner_id), TRUE)
  ON CONFLICT (job_id, candidate_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_partner_pipeline_application_insert ON public.partner_candidate_pipeline;
CREATE TRIGGER ensure_partner_pipeline_application_insert
AFTER INSERT OR UPDATE OF job_id, candidate_id ON public.partner_candidate_pipeline
FOR EACH ROW EXECUTE FUNCTION public.ensure_partner_pipeline_application();
