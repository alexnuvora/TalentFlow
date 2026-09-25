
create index if not exists client_vacancy_requests_client_idx on public.client_vacancy_requests(client_id);
create index if not exists client_vacancy_requests_requested_by_idx on public.client_vacancy_requests(requested_by);
create index if not exists client_vacancy_requests_reviewed_by_idx on public.client_vacancy_requests(reviewed_by);
create index if not exists client_vacancy_requests_approved_job_idx on public.client_vacancy_requests(approved_job_id) where approved_job_id is not null;

create index if not exists job_distribution_requests_job_idx on public.job_distribution_requests(job_id);
create index if not exists job_distribution_requests_requested_by_idx on public.job_distribution_requests(requested_by);

create index if not exists partner_communication_events_partner_idx on public.partner_communication_events(partner_id) where partner_id is not null;
create index if not exists partner_communication_events_client_idx on public.partner_communication_events(client_id) where client_id is not null;
create index if not exists partner_communication_events_candidate_idx on public.partner_communication_events(candidate_id) where candidate_id is not null;
create index if not exists partner_communication_events_job_idx on public.partner_communication_events(job_id) where job_id is not null;

create index if not exists partner_opportunities_owner_idx2 on public.partner_opportunities(owner_partner_id);
create index if not exists partner_opportunities_client_idx on public.partner_opportunities(client_id) where client_id is not null;
create index if not exists partner_opportunities_prospect_idx on public.partner_opportunities(prospect_id) where prospect_id is not null;
create index if not exists partner_opportunities_contact_idx on public.partner_opportunities(contact_id) where contact_id is not null;
create index if not exists partner_opportunities_job_idx on public.partner_opportunities(job_id) where job_id is not null;

create index if not exists partner_outreach_enrollments_partner_idx on public.partner_outreach_enrollments(partner_id);
create index if not exists partner_outreach_enrollments_client_idx on public.partner_outreach_enrollments(client_id);
create index if not exists partner_outreach_enrollments_contact_idx on public.partner_outreach_enrollments(contact_id) where contact_id is not null;
create index if not exists partner_outreach_templates_owner_idx on public.partner_outreach_templates(owner_partner_id) where owner_partner_id is not null;

create index if not exists partner_submission_packs_client_idx on public.partner_submission_packs(client_id);
create index if not exists partner_submission_packs_job_idx on public.partner_submission_packs(job_id);
create index if not exists partner_submission_packs_candidate_idx on public.partner_submission_packs(candidate_id);
create index if not exists partner_submission_packs_reviewed_by_idx on public.partner_submission_packs(reviewed_by) where reviewed_by is not null;
create index if not exists partner_submission_packs_candidate_submission_idx on public.partner_submission_packs(candidate_submission_id) where candidate_submission_id is not null;

create index if not exists candidate_assessment_results_template_idx on public.candidate_assessment_results(template_id) where template_id is not null;
create index if not exists candidate_assessment_results_candidate_idx on public.candidate_assessment_results(candidate_id);
create index if not exists candidate_assessment_results_job_idx on public.candidate_assessment_results(job_id) where job_id is not null;
create index if not exists candidate_assessment_results_assessor_idx on public.candidate_assessment_results(assessor_id);

create index if not exists candidate_source_records_candidate_idx on public.candidate_source_records(candidate_id);
create index if not exists candidate_source_records_imported_by_idx on public.candidate_source_records(imported_by) where imported_by is not null;
