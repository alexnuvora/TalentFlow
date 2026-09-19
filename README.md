# Vorlen — Performance Recruitment OS 

Multi-client recruitment infrastructure for candidate acquisition, qualification, scheduling, placement fees and measurable campaign ROI.
  
## V8 audited release 
 
- Multi-client jobs and candidate pipeline
- Public careers and candidate portals
- Client portal and interview scheduling
- Configurable placement contracts and fee calculation
- Acquisition campaigns and branded landing pages
- Referral/source links with UTM attribution
- Campaign traffic, applications, placements and revenue analytics
- Candidate nurture sequences with a server-side queue
- AI screening as decision support with human review
- Supabase RLS + Edge Functions

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase migration order

1. `supabase/schema.sql`
2. `supabase/commercial_migration.sql`
3. `supabase/v3_migration.sql`
4. `supabase/v4_migration.sql`
5. `supabase/v5_acquisition.sql`
6. `supabase/v6_candidate_conversion.sql`
7. `supabase/v7_recruiter_os.sql`
8. `supabase/v8_production_compliance.sql`
9. `supabase/v9_least_privilege.sql`

Deploy the Edge Functions under `supabase/functions/` and configure their secrets. See `docs/PRODUCTION-SETUP.md` for the deployment checklist.

## Production notes

The public application endpoint uses server-side validation and rate limiting. Candidate portals use expiring random access tokens. AI screening is explicitly non-final decision support. Do not activate outbound automation until sender domains, privacy information, provider credentials and scheduling are verified.

V8 passes dependency installation, TypeScript compilation, production build, dependency audit and SQL parser checks. It is not deployment-verified until the migrations and functions have been tested against staging. Complete `docs/UK-COMPLIANCE-AND-LAUNCH.md` before accepting live candidates.
