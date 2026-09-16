# TalentFlow V6 — Candidate Conversion Engine

V6 turns a public vacancy into a conversion funnel: multi-step application, qualification questions, CV upload, consent capture, attribution, candidate portal and optional self-booking of screening calls.

## Deploy

1. Apply migrations in order: `schema.sql`, `commercial_migration.sql`, `v3_migration.sql`, `v4_migration.sql`, `v5_acquisition.sql`, then `v6_candidate_conversion.sql`.
2. Ensure the `candidate-resumes` private Storage bucket exists (the migration creates it).
3. Deploy `supabase/functions/submit-application`.
4. Set the Edge Function secret `PUBLIC_APP_URL` to the public TalentFlow URL.
5. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_URL` in the web app.
6. Recruiters can create public screening slots under **Interviews → Add screening slot**. Candidates receive available times in their private portal.

## Qualification questions

Set `jobs.application_questions` to an array such as:

```json
[
  {"id":"sales_years","question":"How many years of B2B sales experience do you have?","type":"select","options":["None","Less than 1","1–3","3–5","5+"],"required":true},
  {"id":"self_employed","question":"Are you comfortable working on a self-employed basis?","type":"textarea","required":true}
]
```

Questions are stored with the application. They should support human review; they are not an autonomous hiring decision.

## CV handling

CVs are accepted as PDF/DOC/DOCX up to 5MB and stored in the private `candidate-resumes` bucket under the company/candidate path. Service-role upload occurs inside the Edge Function so browser clients never receive storage write credentials.

## Screening calls

Recruiters publish availability slots. A candidate's opaque portal token is required to list or book slots. Booking uses a database function and a unique slot constraint to prevent double booking, then creates an interview record for the candidate's latest application.

## Production checklist

- Replace wildcard CORS with the exact public app origin if the deployment topology permits.
- Configure a verified transactional email sender and notification provider.
- Review retention/deletion policy for candidate data and CVs before launch.
- Configure backups and monitoring for Supabase.
- Keep AI screening advisory and subject to recruiter review.
