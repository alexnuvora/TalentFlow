drop index if exists public.partner_assignments_client_uq;
drop index if exists public.partner_assignments_candidate_uq;
drop index if exists public.partner_assignments_job_uq;

create unique index partner_assignments_client_uq
on public.partner_assignments(company_id,partner_id,client_id)
where client_id is not null and completed_at is null;

create unique index partner_assignments_candidate_uq
on public.partner_assignments(company_id,partner_id,candidate_id)
where candidate_id is not null and completed_at is null;

create unique index partner_assignments_job_uq
on public.partner_assignments(company_id,partner_id,job_id)
where job_id is not null and completed_at is null;
