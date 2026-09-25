# Vorlen production E2E

The production E2E suite is implemented with Playwright under `tests/e2e/`.

## Safety model

Every normal push runs **public smoke only** against `https://www.vorlen.co.uk`.

The full production journey is **manual-only** through the `Production E2E` workflow with `mode=full`. It creates uniquely tagged E2E records, never contacts real prospects, never sends an outreach email or phone call, and cleans up its own fixture data and CV storage object.

Required protected GitHub environment secrets:

- `VORLEN_E2E_PARTNER_EMAIL`
- `VORLEN_E2E_PARTNER_PASSWORD`
- `VORLEN_SUPABASE_URL`
- `VORLEN_SUPABASE_SERVICE_ROLE_KEY`

Recommended observability secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`

Store them in the protected GitHub environment named `production-e2e`. Do not put credentials in the repository.

## Coverage

The full suite verifies:

1. Partner CRM contact create/update, account timeline, opportunity creation, outreach sequence enrolment.
2. Talent Match evidence search, AI rerank, secure CV upload, AI parse, recruiter-reviewed enrichment and submission pack.
3. Manager pack approval, controlled official submission creation, client vacancy request review/conversion, partner analytics and commission UI.
4. Client portal permissions, candidate rating/feedback, interview request and vacancy request.
5. Candidate self-service application visibility, profile update, marketing preference and privacy request.
6. Interview schedule, ICS export, reschedule/cancel and client/candidate consistency.
7. Partner and client role-escalation attempts, unassigned candidate/job visibility and client-safe data exposure.
8. Browser console/page failures, HTTP 4xx/5xx, failed outbound deliveries, Supabase API/function/Postgres errors and Vercel runtime errors.

## Compliance gate

The suite does not silently enable candidate processing. If the workspace is in pre-trading mode, candidate-processing tests require the existing authorised candidate test-mode window to be active. This keeps the E2E harness from overriding a production compliance control.

## Submission-pack workflow

Manager approval now creates or links an official `candidate_submissions` record in `approved_to_send` state. This is intentionally not client-visible. Statutory candidate/vacancy checks must still complete before the submission can progress to a client-visible state.

## Artifacts

Failures retain Playwright traces/screenshots/videos. Full runs also produce `production-e2e-observability.json` with database delivery failures and, when management/API credentials are configured, Supabase and Vercel runtime diagnostics.
