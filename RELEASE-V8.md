# Vorlen V8 audited release

## Verified

- Clean dependency installation with lockfile
- TypeScript project compilation
- Vite production build and route code splitting
- `npm audit`: zero known vulnerabilities
- PostgreSQL parser validation for all eight SQL files
- SPA HTTP fallback for public, legal and login routes
- No embedded API/service secrets detected

## Release-blocking defects corrected from V7

- Restored missing `trackCampaign` import that prevented compilation.
- Replaced silent placeholder Supabase credentials with fail-fast configuration.
- Corrected invalid multi-command PostgreSQL RLS policy statements.
- Allowed the `recruiter` role to perform recruitment operations while keeping client viewers scoped and read-only.
- Made the automation scheduler secret mandatory and POST-only.
- Added server-side input lengths, URL checks, trusted proxy selection, explicit lawful-basis/retention fields and privacy-version capture.
- Added human-review, data-rights and retention controls in the V8 migration.
- Replaced the placeholder privacy page; added work-seeker terms and accessibility/adjustment information.
- Added security headers for Vercel and Netlify and split the production bundle.

## Honest release boundary

This archive is build verified, not deployment verified. Production approval still requires real legal/controller details, signed client and processor terms, a DPIA/LIA, configured Supabase/Resend/Twilio/OpenAI environments, applied migrations, tenant-isolation tests, malware scanning for CVs, accessibility testing and an end-to-end staging journey. See `docs/UK-COMPLIANCE-AND-LAUNCH.md`.
