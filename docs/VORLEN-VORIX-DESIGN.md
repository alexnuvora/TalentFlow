# Vorlen Homepage — Reference-Aligned Design Specification
Source: https://vorix-creative-digital-agency-react-template-v2.21st.app/
Workflow adapted from xiaopu-ai/web-design (MIT). Scope: preview branch only, never production without approval.

## 1. Visual Theme & Atmosphere
Editorial UK recruitment agency, generous breathing room, strong contrast, candid human photography. Reproduce Vorix's rhythm and layout, not its agency-specific claims. No unrelated decorative 3D balls.

## 2. Colour Palette & Roles
CSS tokens scoped to .vfx-site: --vfx-ink #171b17; --vfx-paper #fff; --vfx-cloud #f5f6f2; --vfx-green #254c39; --vfx-lime #c6eb83; --vfx-muted #6b7068. Approx RGB ink (23,27,23), green (37,76,57), lime (198,235,131). Green and lime deliberately replace the reference's black/yellow. Black text is standard; green identifies Vorlen; lime highlights CTA and hover.

## 3. Typography Rules
Font source Google Fonts: Unbounded 400-800 display, Poppins 400-700 body; system sans fallback. Desktop hero 67-125px, sections 35-66px, card titles 18-32px, body 14-18px. Tight headline tracking ~ -0.065em. Do not use ornate italic serif, mixed generic AI fonts, or illegible all-caps body text.

## 4. Component Styling
Header: sticky white, translucent when supported, brand left/navigation centred/CTA right; mobile menu. Buttons: lime pill, dark alternative, hover lift and visible keyboard focus. Services: outlined rounded cards become lime on hover and focus, carousel controls clearly labelled. Photos: 20px rounded except full-width bands. FAQ: native details/summary. Each clickable card has keyboard-focus indication. Disabled states use low-opacity, no pointer interactions where applicable.

## 5. Layout Principles
1280px desktop container with 40px outer margin, 18px at phone. Follow reference's core order: header; huge typographic hero; photographic stats band; service carousel; about/photo; specialty trust band; two-by-two photographic work grid; four-step process; photo break; differentiation grid; FAQ/contact split; three resource cards; lime CTA; four-column footer. Section spacing 75-125px; large negative space around typography.

## 6. Depth & Elevation
Default flat surfaces with delicate borders (#d3d8cf). Cards gain mild shadow only on interaction. Photographic overlays use gradients rather than aggressive blur. Floating photo labels use small shadows. Avoid heavy glassmorphism or persistent WebGL.

## 7. Animation & Interaction
L2: Initial hero reveal, text/section scroll reveal with IntersectionObserver, hover lift on cards, slow service carousel, image zoom/overlay hover, circular sonar CTA. Scroll-driven reveal uses opacity and transform, not blur. Pause or disable effects under prefers-reduced-motion. The carousel must have manual previous/next and pagination. Motion durations: 450-750ms reveals, 250-350ms hover. Avoid scroll hijacking and pinned sections.

## 8. Do's and Don'ts
Do retain service accuracy and human review. Do preserve legal footer and Preferred Sources control. Do keep recruitment pathways functional. Do use meaningful alt text. Do respect keyboard focus and reduced motion. Don't invent testimonials, client counts, awards, case studies or fee guarantees. Don't copy original Vorix brand or stock copy. Don't insert irrelevant decorative ball art. Don't force expensive WebGL. Don't merge this preview until approved. Don't claim visual equivalence without checking screenshots.

## 9. Responsive & Accessibility
Desktop >1100px: full horizontal nav, 3-card service carousel, photo grids. Tablet <=780px: stacked hero, two service cards, mobile navigation. Phone <=520px: single carousel card, single-column photo/project cards, stacked contact and footer. Touch targets >=44px. No horizontal overflow at 390px. All controls named, focus indicators visible, photos provide alt text, and reduced-motion users see all content without animation.

## Reference difference audit
Aligned: structure, oversized display typography, soft grey/white section alternation, photo band, overlapping stats panel, service carousel, photo grid, numbered process, photo feature and circular CTA, contact/FAQ split, insights and large CTA.
Intentional changes: green/lime Vorlen colours, recruitment content and no unsupported reference-client metrics. Remaining work: replace temporary Unsplash images with approved bespoke Vorlen imagery; browser-based visual comparison at 1440px and 390px; exact easing and pixel-spacing checks. Not yet certified pixel-perfect.
