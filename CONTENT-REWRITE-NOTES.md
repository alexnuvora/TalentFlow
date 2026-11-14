# Public page content rewrite — scope notes

Branch: content/de-ai-public-pages

## What changes
- Rewrite the generated public page copy from scripts/seo-content.mjs in plain, concrete language; scripts/seo-build.mjs consumes that shared content.
- Rename /guides/ai-recruitment-questions to /guides/choosing-a-recruitment-agency (301 added in vercel.json).
- Prune the footer/crawl link farm from 15 links to 7 relevant ones.
- Use the verified legal name (VORLEN LTD, Companies House #17387520) consistently in generated metadata.
- Update App.tsx route and llms.txt link for the renamed guide.

## What does NOT change
- No database schema changes, ATS routes or dashboard code. One additive Supabase migration updates split-commission agreement generation to legal-identity version v3 and supersedes only pending v2 agreements; previously accepted agreements remain immutable. Apply this migration before issuing new partner terms. The password-recovery Edge Function email footer is also updated and must be deployed when merged.
- Careers runtime pages, application flow, partner portals untouched.
- Static build pipeline structure remains the same; the SEO verifier is updated to validate the renamed canonical guide and its permanent redirect.
