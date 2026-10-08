# Coil build log, overnight 2026-09-29

Orchestrated by Fable; every slice built by an Opus 5.5 agent in its own worktree and merged into the integration branch `coil` after a Fable review. Codex review was unavailable all night (workspace spend cap hit during the first review). Nothing touched `main` or production; production still serves the holding page. Rules: `docs/design-decisions-2026-09-28.md` section 10. Architecture: `docs/coil-build-scaffold.md`.

## Pull requests, all merged into `coil`

| PR | Slice | What landed | Tests |
|---|---|---|---|
| 1 | 0 | Next 16.2.12, React 19.2.8, `proxy.ts`, ESLint 9 flat config, async params, `revalidateTag(tag, { expire: 0 })`, `images.qualities`, React 19 types, `data-scroll-behavior` opt-in | 78 |
| 2 | 1 | `HomeController`, readiness and seen stores, deep-reload recovery, `lib/coil/*` geometry and motion with tests, the book behind a flag, the ring path byte-identical | 137 |
| 3 | 2 | Profa Black site-wide via `--font-display`, Instrument Serif and Space Grotesk gone, no italics or tracked caps, shader, card, name and loader tokens, the AS bolt in the nav, dead `border-border/NN` classes fixed | 137 |
| 4 | 6 | H1 header (mark and pill during the hero, bar with headroom after), M1 pill-to-panel menu with the Listen dot, phone bottom sheet, the left rail retired | 137 |
| 5 | 3 | The scene: shader field, curved cards with duotone backs, name behind, idle, wheel capture with hover intent and gesture continuation, stretch, hover lift, seen ring, posters, error boundary | 152 |
| 6 | 4 | Loader (real progress, flash guard, continuity handoff within 1.2/255 of the canvas name) and the band-first entrance (wind start 0.38) | 200 |
| 7 | 5 | Book wired to the scene (hover-jump), double-click unwind egg, flight from a curved card into both modals (corners within 0.06px), Listen invite and pill re-anchored to `#listen` | 216 |
| 8 | 7 | Touch and time driver (Observer drag with coast, taps without flight), narrow composition with repeats, header band clearance, live reduced motion, failure paths; fixed an entrance replay on rebuild and a three.js leak into the first load | 222 |
| 9 | 9 | Verification gate (all headless-measurable items green, 10 minute theme soak with no leak, p99 16.8ms), sentence-case and first-person content fixes, flag flipped then removed, the ring retired (5,571 lines), AGENTS.md diffs proposed in the PR body | 198 |
| 10 | review fixes | "Play it" mouse click fixed, photo modal sized for the cover crop (photos carry width and height), cards fade with the field at the hero's bottom edge, hover-jump picks an on-screen copy, name gradient widened, "Soundtrack paused" chip state, build-time footer date, tab titles joined with a pipe, unwind single seen marker, light poster re-rendered | 206 |

State at the end of the night: `coil` at `3f6d129` holds the complete site; `main` is unchanged in code and 12 docs commits ahead of `origin/main`, unpushed. Not fixed by code: the orange share in light stays about 16 percent (`sec` 0.75; reaching a fifth needs the lobe itself moved), the phone greeting stays beside the band (no card-free window above the name exists), the apostrophe glyph is Profa's own.

## Decisions Fable took on Aaron's behalf (overturn any in the morning)

- Wind phase starts at 0.38 so the band's ends miss cleanly during the winding; a 3x1px corner touch for 17ms during the parting is bounded by a test and accepted.
- Wheel capture continues through a started gesture until the pointer itself leaves the cards (otherwise gaps between turns pass under a still pointer and the page scrolls mid-spin).
- Phones and tablet portrait repeat cards to fill the pane, the same rule as desktop, until the six photos arrive.
- The "List" control is labeled "Work and photos" (the design review flagged "List" as Pacôme's word and the arrow as a template tell).
- The waveform and playback pill reveal at the end of `#listen`, which keeps the old timing exactly.
- The greeting and control fade in mid-exit of the loader (350ms).
- Long copy (playback prompt, photo captions, case placeholder body) went to Inter; Profa stays on titles, the footer tagline and the Connect values. The three modals say "Press Esc to close". UpToNow lost its 01 to 04 markers.
- Listen dot and soundtrack chip show on phones; no headroom on `/recruiting`; the bolt alone in the pill's odometer; the lab's dark scrim.
- Theme repaint stays at 4 cards per frame (drop to 2 if a slow laptop shows it).
- The hero flag was removed entirely with the ring rather than left set; `siteContent.home` and the tile titles and blurbs were deleted (copy recoverable at commit `5361c9c`).

## Owed by Aaron

- Real-device pass: iPhone Safari and a mid-range Android Chrome, light and dark, the checklist in PR 8; a laptop GPU frame-time check and the theme soak; Lighthouse.
- The six missing photos, brand logo files, Talos copy, the min/Max live link (slice 8, not run).
- The full Profa cut into `app/fonts/` (the trial file stamps `*`, `;`, `@`; slice 2 routes them to the fallback).
- Apply the AGENTS.md diffs from PR 9 (archive first, then the Layer 2 rewrite) and change the 14 Layer 1 lines listed there.
- Decide: `main` or a `release` branch for production; whether `vercel.json` stays after the merge; Vercel Node version at least 20.9.
- Decide: the greeting beside the band rather than inside it; DefinitionModal (kept, nothing opens it); tab titles with a middle dot; the `capital-one-ba` row; the "This site" card back; ListenInvite versus the Listen dot; the Coil control position and the unwound list grouping.
- Known quirks carried: Back after a raw hash then a case page click keeps the case page on screen (App Router, predates the Coil); a plain `/` load in the same tab restores the last scroll position (suggested fix: restore only on real reloads and reserve ListenInvite's height); `bg-background/NN` classes emit nothing (need an alpha-capable token); the README is stale; `pnpm approve-builds` for sharp.
- Merging `coil` into `main` and pushing is Aaron's, once, after the real-device pass and the design review below.

## Pre-deploy design review (design-review skill on the built `coil` branch, 79f9114)

Verdict: the built hero matches the approved specimen (palette, duotone backs, tone panes, stretch, Sulbaran off, axis 33 and 8 per turn confirmed from the constants); all 15 lab review items are in code; no Pacôme or Aikawa lookalike; console clean everywhere. Nielsen health 28/40. Light-mode contrast over the live field: greeting 6.62:1, "Work and photos" 5.50:1, mark 13.15:1, pill 17.13:1 (all AA). Dark duotone backs read as intentional.

Ship blockers found (slice 10 fixes the code ones):
1. "Play it" ignores mouse clicks: the invisible confirmation paragraph sits over the buttons in `ListenInvite.tsx`. Predates the Coil; hidden in production by the holding page. Code fix.
2. Placeholder work logos everywhere (italic serif C1, HK, AN, AS, IEEE on a beige tile), the brightest thing on dark panes. Needs Aaron's real marks; until then, upright wordmarks on the tone pane.
3. The photo modal image is soft after the flight lands (a 384px request shown at 356x483 cover). Code fix.
4. Cards clip on a hard line at the hero's bottom edge while the field fades. Code fix.
5. Unfinished copy for a 60 second recruiter: the Capital One case page is a title and a "case study in progress" card; min/Max says "Live, link soon"; Talos says "coming soon"; the footer says "Last updated June 2026". Aaron for the first three; the date is a code fix.

Fix soon (after launch): hover-jump can pick a copy that lands off screen (slice 10 fixes it); the waveform runs under body copy while playing (predates the Coil); phone greeting sits 310px above the name; plain light work backs read as blank slabs; the every-section eyebrows ("A note from me", "About", "Who I am", "What I'm up to", "Connect") are the last template cadence on the page (Aaron's call); the name gradient reads flat (slice 10 widens it); orange share in light is 14.8 percent, a little under the fifth (slice 10 raises `sec` to 0.75).

Not verified by the review: the loader under real throttling, the touch drivers (the headless iPhone preset reports a fine pointer), flight in-between frames. These are on Aaron's real-device list.

## Aaron's hands-on pass, 2026-09-29 evening to 2026-09-30

Eleven defects and directions from Aaron's first hands-on session, plus the follow-ups they opened. All merged into `coil` and `main`.

| PR | What landed |
|---|---|
| 11 | Full AS mark in the favicon and the pill's hover; quarter-note Listen control with a drawn slash; seen rows dimmed |
| 12 | Wheel capture rebuilt as ownership per gesture (`lib/coil/capture.ts`, recorded trackpad streams as fixtures); row hover holds the coil |
| 13 | Seamless modal flight: the scene draws the flown card with its own shader in an overlay canvas; every swap 0.00/255 |
| 14 | The waveform as an in-flow band under the book; the pill as a mini-player; seven review defects fixed |
| 15 | "Work and photos" removed; the greeting drawn in the name's style; first-visit "Open me" and "Keep exploring"; discreet seen ring; visible drift (the seven grain fills here were later rejected) |
| 16 | Playwright suite (55 tests, proven to fail on the pre-fix builds) |
| 17 | Official logos: Anthropic and Claude (press kit), min/Max (rendered from the CDO repo); Capital One and IEEE need Aaron |
| 18 | CoilScene split into 18 modules with no behavior change (pixel-identical, tests unchanged); WebGL 2 probe |
| 19 | The name as a lit shader surface (Opus Tide color law on Fable's surface pass) with a museum-rhythm wake; greeting 0.18 inside the mask; ink 12 light and 14 dark |

Rulings recorded in `docs/design-decisions-2026-09-28.md` 2.10 and `docs/coil-input-model.md`. Two labs and a judge produced the name surface: `prototypes/labs/name-lab-opus.html`, `name-lab-fable.html`, verdict in the PR 19 body.

Open: Capital One assets (private Brandfolder), the IEEE toolkit agreement, the Talos mark pick, real-device checks, the soundtrack e2e test that fails only on this machine, the Codex spend cap.

## Aaron's hardware pass, 2026-10-06 (the scroll fix and the loader)

He tried PR 24 on his trackpad: "pleasantly surprised that the scroll fix is working again. Nothing is trapped." Two rulings from the same pass, each on its own branch and PR:

- **Page scroll no longer turns the coil** (branch `coil-scroll-free`). The coil runs at its idle pace whether or not the page is moving; scrolling away just carries the hero up. Wheel capture over the coil, touch drag and the book's row hold are unchanged. The `pageScrollCardsPerPixel` feed (1/150) goes, and table 1.1 and the input model's scroll line change with it.
- **The loader's fast path flashed the fallback heading** (branch `loader-lockup`). On a warm reload at the top the asset tally finishes inside the loader's 250ms guard, the loader skips, and the server-rendered "Hi, I'm Aaron." h1 is visible for about 200ms until the scene's first frame sets `data-scene="on"`; his recording shows it at frames 6 to 8 of 60 per second. The fix: when a scene is going to take over, the loader never vanishes; on the fast path it paints the lockup already in its landed pose and hands it to the canvas in one frame, so no frame shows the h1. The design change he asked for with it: the loader paints "Hi, I'm" above "Aaron" with the canvas lockup's proportions and both lines dissolve into the background lockup, the band unfurling in front. The h1 kept its role for reduced motion, no WebGL and a failed scene until PR 36 gave those paths a real still (below).

## The hero still, 2026-10-07 to 2026-10-08 (PR 36, `hero-still`)

Aaron's own Chrome runs with graphics acceleration off, so he met the no-WebGL fallback as a visitor: the empty field poster and the big h1. He called it gross and asked for the edge cases to be looked after, with a short notice for visitors who have something turned off. PR 36 (plan `docs/superpowers/plans/2026-10-07-hero-still-fallback.md`, merged 2026-10-08 on his word):

- `data-scene` on the hero is `on`, `off` (a scene awaited, the field poster) or `still` (no scene possible: no WebGL 2, a failed probe, reduced motion). Still: a real render of the scene at rest in three cuts per theme (wide 1440x900, square 1000x1000, narrow 390x844 at DPR 2; AVIF with a WebP fallback), chosen by aspect through `STILL_MEDIA`, hidden under `display:none` so scene visitors never fetch them.
- The loader's still path: the resting lockup from first paint, the still fading in beneath it over 400ms, the lockup landing on the baked name's rect and fading over 300ms; the decision is pure in `lib/loader/still.ts`, with a 1500ms give-up that never fades the lockup (the h1 is identical underneath) and a late dissolve for a still that decodes after it. Per-theme readiness (`data-still-ready`), so a theme toggle never shows a nameless hero.
- The notice (`components/coil/StillNotice.tsx`): one sentence per cause in Aaron's words, `role="status"`, "Got it" hands focus to the h1 and is remembered per browser (`aaron-still-notice`).
- Composition: the name is drawn behind the cards at the strong ink (`COIL.lockup.stillInk`); Aaron tried the name in front and reversed it ("takes away from the coil"). Phases per cut are picked by `scripts/render-posters.mjs --sweep` for the least name coverage: light wide 0.9375, light square 0.3125, light narrow 0, dark wide 0, dark square 0.1875, dark narrow 0.1875; the square and narrow cuts cover part of the name, accepted.
- **Rerun rule:** whenever the scene's resting look changes (the field, the card set, the lockup's ink or size, the conveyor's geometry), rerun `scripts/render-posters.mjs` and commit the twelve files and `lib/coil/heroStill.rects.ts`; `heroStill.files.test.ts` checks the files exist with the right sizes, not that they match the scene.

Counts at merge: 580 unit tests in 67 files, 175 e2e passed and 1 skipped, tsc and lint clean; two independent Opus reviews. Follow-ups without an owner: a `#listen` deep link lands under the header bar; browsers without `:has()` show the h1 over the still; a theme toggle inside the loader's first 1.5s races the still; `SQUARE_BELOW` and `HERO_STILL_SIZE` belong in `COIL`; the light and dark wide stills sit at different phases.

## The Coil and Band toggle, 2026-10-08 (PR 39, `coil-band-toggle`)

Aaron found the toggle missing from the site on 2026-10-08 (the master plan had parked it for want of a placement decision) and asked for it. Plan `docs/superpowers/plans/2026-10-08-coil-band-toggle.md`, reviewed before the build; built by an SDD controller (Tasks 1 to 6, a second controller resumed from the ledger after the first stalled). What landed: `pullHelix` (the entrance's pull as a value, the rest frame itself at pull 1), `lib/coil/shape.ts` (the shape clock, band copies matching the unwind's latch, `isSwitching`), the `shape` frame step and `scene/shape.ts`, `shapeJump` and `shapeCardPx` for a held row and a phone drag in the band, `ShapeToggle` in the hero's bottom-left seat, `COIL.toggle` (756ms, 99ms). The band keeps itself full relative to the visible slot window (the entrance's absolute rule would have emptied it under idle drift), needs at least two spare slots, and the strand holds mid-switch. Counts at merge: 599 unit, 185 e2e passed and 1 skipped, tsc and lint clean. Open: the capsule's pop-in at ready, the per-half focus cue, HeroOverlay at 406 lines (move `HintLine` and the unwound list out), the Layer 1 blur list.
