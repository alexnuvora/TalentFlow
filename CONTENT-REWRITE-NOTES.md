# Public page content rewrite — scope notes

Branch: content/de-ai-public-pages

## What changes
- Rewrite the generated public page copy (crawlDetails/staticPages in scripts/seo-build.mjs) in plain, concrete language.
- Rename /guides/ai-recruitment-questions to /guides/choosing-a-recruitment-agency (301 added in vercel.json).
- Prune the footer/crawl link farm from 15 links to 7 relevant ones.
- Use the verified legal name (VORLEN T/A IVY AND PEARLS LTD, Companies House #17387520) consistently in generated metadata.
- Update App.tsx route and llms.txt link for the renamed guide.

## What does NOT change
- No database, no edge functions, no ATS routes, no dashboard code.
- Careers runtime pages, application flow, partner portals untouched.
- Static build pipeline structure unchanged; only copy and slugs.
