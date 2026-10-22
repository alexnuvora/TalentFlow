# Vorlen AI search visibility measurement — operational specification

## Scope and attribution
This is a manual, evidence-backed measurement framework, **not** a claim that AI visibility is already measured. No client-identifying data or private candidate data should be sent to AI platforms.
Evaluate the same prompts weekly using publicly available, logged-out or controlled test sessions where possible. Record platform, model/surface, locale, collection timestamp, full exact prompt, source citations, Vorlen inclusion, cited page, position where a ranked list exists, and screenshots or exported evidence. Do not fabricate or self-report assistant answers.
Separate **recommendations** (Vorlen is specifically suggested) from **mentions** (Vorlen is discussed), and **citations** (a link to vorlen.co.uk).
AI products change recommendations by region and context; sample multiple relevant UK contexts, not merely one session.

## Approved commercial-intent prompt set
1. Recommend a recruitment agency for a small UK business hiring permanent employees.
2. Recruitment agency for engineering staff in Manchester.
3. Technology recruitment agency for a UK SME.
4. Help hiring B2B sales staff in Greater Manchester.
5. Who can source qualified finance candidates for a UK employer?
6. How much do permanent recruitment agencies charge in the UK?
7. Which recruitment agency uses human-reviewed candidate introductions?
8. Who can help a small company with no HR team recruit staff?
9. What recruitment agency can find hard-to-hire employees in Rochdale?
10. Permanent recruitment specialist for a growing UK business.

## Weekly results template
Columns: collected_at_utc,platform,surface,model_if_visible,region,prompt_id,exact_prompt,vorlen_mentioned,vorlen_recommended,vorlen_cited,rank_if_explicit,cited_url,other_agencies,screenshot_reference,reviewer_notes.
Recommendation inclusion = prompts with a genuine recommendation / prompts answered, partitioned by surface and context.
Citation rate = prompts citing a Vorlen-owned URL / prompts answered.
Report uncertainty and small sample sizes. Track change week to week; do not interpret tests as official platform ranking.

## Conversion attribution
Use landing page and contact-page UTM parameters for campaigns that are actually under our control (e.g. utm_source=linkedin&utm_medium=organic&utm_campaign=employer_guides). Never attribute uncategorised organic AI traffic as confirmed AI leads.
For referral analysis, use privacy-preserving **aggregate** referrer-domain classification for search/chat domains and a voluntary 'How did you find us?' option on employer enquiries, subject to privacy notice and consent requirements. Do not store raw chat prompts, tokens, candidate details or complete URL query strings in analytics.
Review Search Console and Bing Webmaster Tools for organic queries/citations; Bing AI Performance can be used where available after property verification.

## Business entity evidence and outreach
Canonical display name: Vorlen. Legal entity: VORLEN LTD, company number 17387520, subject to ongoing Companies House verification.
Maintain consistent identity on the website, LinkedIn company page, Google Business Profile (if eligible), Bing Places, Companies House and reputable recruitment directories. Do not claim profiles exist or are verified until the external provider confirms ownership.
Never purchase fake reviews, add unverifiable awards, create fabricated case studies or impersonate employers.

## Release gates
1. Branch-specific npm test, npm run typecheck, npm run build.
2. Validate prerendered route HTML, sitemap, canonical tags, structured data and robots.txt.
3. Preview smoke test homepage, employer guide, sectors, careers, contact and login; check responsive rendering, navigation and console errors.
4. Confirm preview search directives. Vercel previews may intentionally have deployment protection or noindex. Verify public production crawlability separately; never relax preview access controls just to allow third-party indexing.
5. Only merge with passing checks and confirmed no live-site regression.
