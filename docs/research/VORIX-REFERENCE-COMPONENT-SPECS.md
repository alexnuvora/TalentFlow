# Vorix → Vorlen exact-reference component map
Method: JCodesMore/ai-website-cloner-template `clone-website` reconnaissance/component specification/visual QA. Source evidence: user's **Vorix - Creative Digital Agency React JS Template.PDF** (10 mobile-width printed pages), **Vorlen _ UK Permanent Recruitment Agency.PDF** (12 mobile-width printed pages), and prior desktop/mobile public-browser inspection of https://vorix-creative-digital-agency-react-template-v2.21st.app/ .

## Nonnegotiable constraints
Preview branch and draft PR #97 ONLY. Do not merge, change production, alter auth/backend, fake clients, awards, reviews, job outcomes or follower counts. Vorix visual language, Vorlen company/sector content. Do not copy trademarked branding or source photos without rights. Prefer real naturally-lit business photography.

## Measured/reference-supported topology (sequence must not drift)
1. Desktop fixed white header ~110px; responsive mobile ~68px, wordmark + minimal menu.
2. Hero: huge geometric black headline, line 1 “Creative Digital”, line 2 “Agency”, short prose offset right of second line on desktop. Hero photographed band starts ~y726 at 1440 width, ~y675 at 390 width. Vorlen labels may differ but geometry must agree.
3. Full-width authentic collaborative team photo with colored overlapping rounded stats treatment bottom right (Vorlen must use qualitative attributes, not fabricated numbers).
4. Client solutions: clean offwhite/white background, horizontal bordered service cards ~450px tall desktop, right-side circular arrows; accessible pager.
5. About: left 20px-radius team photo with small white overlapping badge, right display title, prose, 3 check items and pill button.
6. Trusted/sector horizontal strip; not fictional client logos.
7. Work/projects: four actual photographic panels. Desktop 2 × 2 grid, mobile vertically stacked; hover zoom and overlay.
8. Working process: narrative left, four boxed steps with numbered circles on right. Mobile stacks copy then boxes.
9. Full-bleed photo/video interlude with circular sonic-ring control. If no real video, CTA navigates /contact and must not falsely promise video playback.
10. Vorix awards/honors: 4 bordered rows with thumbnail and year. Vorlen uses *why work with us* benefit rows rather than fabricated honours; preserve card silhouette.
11. Split testimonial/contact area with large quote-like positioning and real inquiry form. Vorlen must not use fabricated attributed client reviews. Capture inquiries through existing contact path.
12. Blog/guides: three bordered image cards, real routes and natural-language descriptions.
13. CTA: full-width accented background, oversized 2-line title, outline pill.
14. Footer: 4 columns with links, social and accurate company/legal reference.

## Fonts and tokens
Unbounded 600/700 hero headings, Poppins 400/500 body; reference ~120px desktop hero and ~56px mobile, section headings clamp(32px,4vw,60px). Vorix original #fefefe, #f6f5f3, #0e0e0e, #ecc80b; intentional Vorlen replacement black text/white canvas with muted lime #c5df85 and dark green. Reference photos with mild natural color, no 3D/glass/bubbles. Border radius 20px.

## Behaviors from reference inspection
- Hero static editorial typography, no pointless visual gimmicks.
- Scroll fade-up only once after viewport entry; reduced-motion disables transitions.
- Service carousel advances, circles previous/next; hover background accent.
- Project hover gently zooms photo and adds light overlay.
- Photo video circle sonar; only use if meaningful action.
- Mobile narrow-screen order and no horizontal overflow.

## Current gaps requiring verification
- The existing preview uses remote Unsplash photos; these can fail to load and are not bespoke Vorlen imagery.
- Independent visual comparison remains blocked by Vercel Deployment Protection redirecting anonymous browsers to login.
- Existing Landing CSS contains successive overrides; browser-computed styles must be extracted and compared at desktop 1440×900, tablet 768, mobile 390×844 before fidelity can be certified.
- The uploaded PDFs are mobile-width print captures, not exact browser screen captures, and omit several image regions; they cannot prove active animations.
