# Public page content rewrite — scope notes

Branch: content/de-ai-public-pages

## What changes
- Rewrite the generated public page copy (crawlDetails/staticPages in scripts/seo-build.mjs) in plain, concrete language.
- Rename /guides/ai-recruitment-questions to /guides/choosing-a-recruitment-agency (301 added in vercel.json).
- Prune the footer/crawl link farm from 15 links to 7 relevant ones.
- Use the verified legal name (VORLEN LTD, Companies House #17387520) consistently in generated metadata.
- Update App.tsx route and llms.txt link for the renamed guide.

## What does NOT change
- No database, migrations, ATS routes or dashboard code. The password-recovery Edge Function email footer is updated to the current legal identity and must be deployed when merged.
- Careers runtime pages, application flow, partner portals untouched.
- Static build pipeline structure remains the same; the SEO verifier is updated to validate the renamed canonical guide and its permanent redirect.
