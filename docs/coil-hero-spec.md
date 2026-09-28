# The Coil: desktop hero rebuild spec

Status: decided 2026-09-27 with Aaron; ready for a plan. Research behind it: `docs/research/refresh-2026-09-27/` (README, DECISIONS, reviews, prototypes). The prototype to port from is `docs/research/refresh-2026-09-27/prototypes/coil.html` (editable source in `prototypes/coil-build/`).

## What it is

The desktop hero becomes one WebGL object with two states driven by native scroll, revised 2026-09-28 after Aaron's correction ("why are all the mockups a band and not a coil"): the **coil** is the hero at rest, an open tilted helix of the 20 cards spinning slowly with "Aaron" set large behind it, read through the gaps between the cards as they pass; scroll straightens the helix into the **list**, the recruiter view and the scroll destination. The closed band exists only inside the entrance (cards riffle out of a stack, gather for a beat, and rise into the helix, about 900ms total); it is a transition, never a resting state. One parametric system places every card in every state (`theta = phase + u*turns*2pi; x = R cos theta; z = R sin theta; y = rise*(u - anchor)`); time drives the idle spin, scroll drives radius, rise, phase, and anchor toward the list. There is no mid-walk. The list is a real DOM list; the canvas column settles onto it and sleeps.

History: the 2026-09-27 draft ordered it band -> coil -> list, with the band as the opening state; the prototype, the reviews, and the wireframe board followed that order, so their first frames show a band. Aaron never chose that; the coil-at-rest version above supersedes it, and it also removes the opening state Codex flagged as a moderate Aikawa resemblance.

## Decisions (Aaron, 2026-09-27)

- Hero: the Coil, list as destination. Fallback if the port stalls: the current DOM ring (arrival-pop fix merged).
- Display type: Profa Black (licensed via a class asset pack), Inter body. No accent word by default; see "Accent" below.
- Mark: pending Aaron's own sketch. Direction: a sharp S-shaped bolt (Ms. Marvel logic: two bends, tapered ends, no curved shoulders), the bottom-right segment of the bolt serving as the A's right leg. Round 4's shared-stroke idea stays; round 3 and 4's curved shoulders do not.
- Labels: sentence case in the body sans (Inter), muted. Lowercase is allowed only for nav chrome if the specimen proves it reads more personal ("work about connect"). Numbers only where sequence is real (case rail). No tracked mono caps, no "02 /" eyebrows.
- Recruiter list order: Talos (open-source coming soon, in-depth description), min/Max (live link, custom domain if ready), then experience (Capital One, IEEE, Anthropic ambassador, hackathon builds), then photos. Placeholder cards never appear in the list.

## Visitor journey

1. **Entrance** (time-based, about 900ms, the site ease): cards riffle out of a center stack, gather into a ring for a beat, and rise into the open helix; the name "Aaron" fades up behind. Idle spin begins (a bounded, damped offset that returns to zero when scroll takes over; never history-dependent). "View work" is reachable immediately.
2. **Coil at rest** (page top, before any scroll): the open helix, axis tilt no more than 8 degrees, spinning slowly; "Hi, I'm" small in Inter above or beside, "Aaron" large in Profa Black behind the helix, revealed through the gaps as cards pass (the cards are discrete, so the name is seen through the object, never hidden by a solid band). Cursor tilts the axis a few degrees and adds lateral parallax. Hover lifts a card; click flies it to its modal or case page.
3. **Straightening** (the pinned distance, about 1.2 viewports): radius eases to zero, cards rotate to face the camera, rows space out to the DOM list's row pitch, the name shrinks into the list heading; the canvas column lands exactly on the DOM rows, hands presentation to the DOM, and stops rendering.
4. **List**: greeting and contact on the left, the list on the right: thumbnail, title (Profa Black at ~28 to 32px), meta line in Inter (sentence case: "Capital One, product intern, 2025"). Hover dims siblings to ~0.75 (not 0.4). Work rows link to `/work/[slug]`; photo rows open the photo modal. A "coil" control returns the cards to the coil (the playful way back); it is not the primary path.
5. Continue scrolling: the page proceeds to Work, About, Connect as today.

Pinned distance: about 1.2 to 1.5 viewports total. No dead scroll at either end; no wheel hijack; Space, PageDown, scrollbar drag, anchors, and scroll restoration all work because progress comes from ScrollTrigger scrub over real document scroll.

**The name behind the coil.** Aaron wants the Aikawa move (a giant name behind the object) without the Aikawa composition. Ours: "Aaron" sits large behind the resting helix in Profa Black and reads through the gaps between the discrete cards as they spin; as the coil straightens, the name shrinks into the list's heading. The name participates in the transformation instead of being a backdrop. Differences from Aikawa that must hold: no floor reflection, no continuous band, no transparent category lettering, upright heavy grotesk rather than italic serif, and the name resolves into the list header. Aaron is unsure a heavy upright works as well as Aikawa's italic; judge it on the specimen and keep the fallback of the docked small greeting.

**Seen state.** Once a card's modal or case page has been opened, that item carries a subtle "seen" state in the coil (slightly lower brightness, a small dot on the card edge) and in the list (muted title, the same dot), persisted in `sessionStorage` (not `localStorage`; a fresh visit starts clean). Never a checkmark, never a color badge.

## Background

Aaron's requirement: not a flat off-white. Every reference has something happening behind the object (Aikawa: reflection; Pacôme: a fine grid and grain). Options, to be judged on the specimen:

- **A. Fine grid** in the border token at very low contrast (Pacôme's move; cheapest; risk: the closest resemblance).
- **B. Grain**: a static or slowly drifting noise field at 2 to 3% (paper feel; cheap; no color).
- **C. Light sweep**: one large soft radial light in a warmer paper tone that follows the coil's focus (a single-hue luminance change, no second color), rendered in the same canvas.
- **D. Shader field** (shadergradient.co style): a slow animated shader behind the coil. This is a real gradient on a section background, which AGENTS.md Layer 1 forbids ("No gradients on section backgrounds"). Doing D requires Aaron to change that rule by direct instruction. If chosen: monochrome or two tones of the same hue, low amplitude, paused under reduced motion, never over text.

Recommendation: B plus C (texture plus a single-hue light that moves with the coil) keeps the no-gradient rule and still makes the background alive. D only if Aaron changes Layer 1.

## Visual system

- **Type:** Profa Black for the hero name, section heads, list titles, case titles; Inter for everything else. Sizes: hero name as large as the composition allows (behind the coil), section heads at the current `section` scale, list titles 28 to 32px.
- **Accent with Profa (ideas, pick on the specimen):** (1) size contrast: "Hi, I'm" small in Inter, "Aaron" huge in Profa, no color; (2) the name seen through the coil is itself the emphasis; (3) a single accent rule under the name; (4) blue on one word (the tell; last resort). Deep sea blue stays the one accent for links, focus, active nav, and the five work cards' solid panes. Aaron is not sold on the blue; changing the accent hue is a Layer 1 token change and a separate decision.
- **Label voice, examples:** meta "Capital One, product intern, 2025"; "IEEE UT Austin, president, 2025 to 2026"; "Talos, open source soon"; photo "Graduation, UT Austin"; nav "Work About Connect" (sentence case) or "work about connect" (lowercase, only if the specimen proves it). Counters only on the case rail: "01 Problem, 02 My role, 03 What shipped, 04 Outcome".
- **Cards, light mode:** card body tone off paper as a token (2 to 3% below page paper), hairline at ~0.2 ink, a flat 1px inner highlight (no gradient sheen), photo mat with a hairline; the five work cards are solid accent with paper monograms; recede by brightness, never blur; one designed back per card (title on a plain pane), UVs flipped for back faces. Dark mode is the reference state and must stay as good as the prototype's.
- **Mark:** placeholder until Aaron's sketch lands; the lockup slot beside the name is reserved at ~1.3x cap height.

## Architecture contract (from the three reviews)

- Extract the home controller from `TileRing.tsx` first: responsive selection, readiness context, modal selection, explored state, focus restoration, recovery, and flight state move into a renderer-neutral shell. `HomeHero` stops importing TileRing's context directly. `MobileHome` keeps its props and its own `gsap.matchMedia`.
- Server-render the greeting, the DOM list, and a painted fallback. Dynamically import three.js only after desktop eligibility and first paint; never on reduced motion or holding mode. `ssr: false` alone does not defer loading.
- Vanilla three.js in an isolated client component (R3F 8 second choice; R3F 9 needs React 19, not before launch).
- Pure pose evaluator in `lib/coilGeometry.ts` with vitest tests (progress, mode blend, viewport, interaction state in; poses out). React owns semantic state; GSAP owns progress and morph parameters; three consumes; Framer keeps DOM entrance, modal, and flight motion. No per-frame React state across the cards.
- Scroll: one ScrollTrigger pin with scrub over real scroll, armed after the entrance (the pin-readiness invariant stays until proven unnecessary). One short smoothing stage only.
- Flight: freeze the scene at activation, project the card's four corners to CSS viewport coordinates (including canvas offset), extend `FlyingTile`'s source contract to a projected quad; hide only the selected mesh once the clone is ready; keep the canvas visible behind the modal; remeasure the return pose after resize; any no-flight fallback sets `renderMedia`. Rendered pose and flight source are always the same pose.
- Invariants that survive: body Portals for every fixed overlay, reference-counted scroll locks, modal freeze, deep-reload recovery, independent mobile GSAP context, no `backdrop-filter` in the scene.
- Accessibility and the recruiter list are one implementation: a real `<ol>` of buttons and links from `siteContent.homeTiles` with stable ids; keyboard focus reveals a usable list, never twenty invisible tab stops; Enter opens, Esc returns focus; raycast hover bridges into `CustomCursor`.
- Reduced motion: render the DOM list directly, no scene, fade-only modals; observe preference changes live.
- Assets: photos as separately cacheable files (no base64); 384 to 512px card textures, higher-res only for modal media; theme colors as uniforms; depth writes off for translucent panes; discard on final alpha; excluded invisible cards from picking; no instancing; stop rendering when settled; dispose everything on teardown; bound any debug samplers.
- Timing: `(0.22, 1, 0.36, 1)`; 200ms feedback, 350ms interface, 600ms entrance, 600 to 750ms explicit toggle.
- Failure: a rejected asset resolves to a placeholder; a failed scene leaves native scrolling and the DOM list working.

## Verification gate (before merge of the final slice)

Native scroll both directions; anchors and history; keyboard-only run through list, modal, and back; live reduced-motion toggle; breakpoint teardown (desktop to mobile and back); load and WebGL-context failure; mid-flight resize; frame-time distribution on a representative laptop (target 16.7ms); tsc, lint, vitest, build green; the resemblance check: side by side with pacomepertant.com and aikawakenichi.com, the states that must differ are the band (greeting inside), the straightening, and the list.

## Slices (each merged to main on its own)

1. Controller extraction from TileRing + `lib/coilGeometry.ts` with tests + the DOM list rendered server-side behind a flag (no three yet). Ships nothing visible; retires the risk.
2. Scene: band and opening on ScrollTrigger, light and dark material, photos as files. Flag-gated.
3. Straightening onto the DOM list, seen state, name-behind-coil, background option.
4. Flight adapter and modal handoff; hover and cursor bridge; failure paths.
5. Case-study template (parallel track; Talos and min/Max pages first).
6. Verification gate, then flip the flag, then AGENTS.md Layer 2.

Cost note: each Opus build agent tonight ran 150k to 290k tokens; a slice is two to four agents plus a Fable review. Do not start slice 1 in the same usage window as a min/Max build session.

## Open items

- Aaron's logo sketch (sharp S, tail as the A's right leg), then clean-up into vectors.
- The composed specimen (hero with the name behind the coil, section head, case title, list rows in sentence case and lowercase, nav, background options A to D, light and dark): one Opus agent, built before slice 2 so the material and type are locked on real content.
- Whether to change Layer 1 for a shader background (option D).
- Talos coming-soon copy and the min/Max link.
