# Public page content rewrite — scope notes

Branch: content/de-ai-public-pages

## What changes
- Rewrite the generated public page copy from scripts/seo-content.mjs in plain, concrete language; scripts/seo-build.mjs consumes that shared content.
- Rename /guides/ai-recruitment-questions to /guides/choosing-a-recruitment-agency (permanent redirect added in vercel.json).
- Prune the footer/crawl link farm from 15 links to 7 relevant ones.
- Use the verified legal name (VORLEN LTD, Companies House #17387520) and current Manchester registered office consistently in public and partner-facing legal copy.
- Update App.tsx route and llms.txt link for the renamed guide.

## What does NOT change
- No database schema/table changes or ATS route changes. One additive Supabase migration updates partner agreement generation plus every public/private commission-attribution and placement-finalisation function that enforces the old v2 terms. It supersedes only pending v2 agreements and issues v3 to eligible partners; accepted v2 agreements remain immutable. Apply this migration before issuing or accepting new partner terms.
- The manager Partner Management screen now gates commission attribution on accepted v3 terms. Candidate application flow and partner-facing portal remain unchanged.
- The password-recovery Edge Function email footer is updated and must be deployed when merged.
- Static build pipeline structure remains the same; the SEO verifier is updated to validate the renamed canonical guide and its permanent redirect.
