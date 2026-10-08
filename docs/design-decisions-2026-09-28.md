# Design decisions, 2026-09-28: the whole site in one tick list

How to use: tick `[x]` what you accept, write `change:` under anything you want different, and send the file back (or just reply with the section numbers and your picks). "rec" marks my recommendation. This supersedes `docs/coil-wireframe-checklist.md` (kept for its board frames) and feeds `docs/coil-hero-spec.md`, which gets revised from your ticks before any builder agent starts.

Everything referenced lives under `docs/research/refresh-2026-09-27/prototypes/` (local, gitignored). Open the `.html` labs by double-click; they are self-contained.

| Topic | Lab or sheet |
|---|---|
| Hero (helix, name behind, compositions, push and pull) | `labs/hero-lab.html` (pending, see section 2) |
| Loader | `labs/loader-lab.html`, `labs/loader-shots/contact-desktop.png`, `phone-both-50.png`, the `.webm` |
| Menu and header | `labs/menu-lab.html`, `labs/menu-shots/menus-sheet.png`, `headers-sheet.png`, `phones-sheet.png` |
| Logo | `logo7/slider.html` (the picker), `logo7/sheet.png`, `logo6/sheet.png` |
| Earlier boards | `wireframe/board.html`, `site-now-2026-09-28/` (the live site today) |

## 1. Already decided (confirm or reopen)

- [ ] The helix is the hero at rest, spinning slowly, the name large behind it; scroll straightens it into the recruiter list. The closed band exists only inside the entrance (optional, see 2.5).
- [ ] Display face Profa Black, Inter body, sentence-case labels, no tracked caps, no numbered eyebrows; numbers only on the case rail.
- [ ] One accent (deep sea blue / soft sea blue). Cards recede by brightness, never blur.
- [ ] Recruiter list order: Talos, min/Max, Capital One, IEEE, Anthropic ambassador, hackathon builds, then photos; placeholders never appear.
- [ ] Mobile is the same object with a touch and time driver, not a separate experience; MobileHome retires when the Coil ships.
- [ ] Native scroll only. GSAP ScrollTrigger owns progress; no wheel hijack, no virtual scroll.
- [ ] Nothing copied from Pacôme's top spiral-or-list toggle and list composition; no blur, no bounce.

## 2. Hero (`labs/hero-lab.html`; presets `#p=V`, `#p=D`, `#p=H`, `#p=B`, `#p=L`, add `&t=dark`; sheets in `labs/hero-shots/`)

What the lab proves: the mechanics all work at 60fps in headless Chrome (pin, straightening that lands on the DOM list within 1px, push and pull, hover-jump, name behind, seen state, reduced motion). What it does not yet prove: the helix as a hero object. At rest the coil is too small (cards about 17 percent of the viewport height, the object about a third of the pane) and too many cards face away as blank backs, so the stills read as a cluster of cards next to the name rather than a coil in front of it. Mobile vertical is the exception: the tall pane suits the column and it reads as a helix. The list landing is the best frame of the day and is close to final. So: tick orientation and extent as a direction, and the composed specimen carries a scale brief (cards 25 to 30 percent of the viewport height, three turns visible, the coil filling 60 to 70 percent of the pane, name centered behind, backs designed as real card backs).

2.1 Orientation of the helix axis
- [ ] Vertical: the clearest helix and the best name-through-gaps read; best on phones.
- [ ] Diagonal (rec): the strongest silhouette; D in dark is the best frame of the set.
- [ ] Horizontal: reject. Twenty cards cannot fill a spring across 1440px, and clipped horizontal cards streaming across the pane is Pacôme's desktop state.

2.2 Where the coil ends
- [ ] Trail off (rec with diagonal): the coil becomes an object with ends and frames the name.
- [ ] Endless conveyor (rec with vertical only).
- [ ] Clipped: reject, same card-count problem as horizontal.

2.3 The name behind
- [ ] "Aaron" in Profa Black at 70vw behind the helix, about 12 percent ink (lab slider 6 to 40); legible through the gaps in every preset, dark and light. rec keep at 12 dark / 10 light; judge on the scaled specimen.
- [ ] Greeting "Hi, I'm" small in Inter above the name (rec) / docked lower-left / none.

2.4 Composition
- [ ] A (rec): helix centered, the list arrives only as the scroll destination. The hero stays the hero.
- [ ] B: helix left, list beside it, hover-jump. Works and is the better recruiter page, but it demotes the helix to an illustration next to a list that repeats every card.

2.5 Entrance
- [ ] Riffle straight into the helix, 900ms (rec).
- [ ] Band first, 1400ms: closed ring, hold, seam opens into the helix.

2.6 Idle and interaction
- [ ] Idle spin slow (rec) / medium / off. Bounded offset; unwinds to zero once straightening starts so the landed pose is always the same.
- [ ] Scroll velocity pushes and pulls the cards (spring with overshoot plus a vertex shear capped at 12 degrees), both directions. The pin is 1.4 viewports with the first 16 percent as a push zone before straightening begins; no dead scroll.
- [ ] Capture-on-hover (wheel spins the coil when the cursor is over it): in composition A it can only engage at the top of the page, otherwise it traps the scroll. rec off in A, on in B.
- [ ] Hover lifts a card; click flies it to its modal or case page (not built in the lab; the flight contract is in the spec).

2.7 Seen state: opened cards dim slightly and carry a small edge dot in the coil and in the list, session-scoped. rec keep.

2.8 Content the lab surfaced
- [ ] Talos and min/Max have no card art; the list uses accent monogram thumbs for them. Decide: monograms (rec until real artifacts exist) / product screenshots.
- [ ] A "This site" (AS) row after Hackathon builds. rec keep.
- [ ] List copy is placeholder; real titles and meta lines come from you (section 9).

### 2.9 Aaron's green light, 2026-09-29 (supersedes the ticks above where they differ)

Locked:
- Diagonal, steeper than the lab's 22 degrees: start at 30, tune toward 45 in the build. The helix spans the whole pane, not the middle third.
- Endless conveyor. Uniform spacing: cards per turn on the high side (8 to 10 at 22 degrees; fewer as the angle steepens), gap between turns on the high side. Never convoluted.
- Wheel over the helix spins it, forever, both directions (images loop, nothing visually snaps). Wheel outside the helix scrolls the page away. A fast scroll must never turn the helix jagged.
- Every card the same portrait aspect; photos are cropped to the card, never the card to the photo.
- Cards are curved along the coil (a curved-monitor bend) so the eye reads one continuous helix instead of flat rectangles with sharp edges.
- No cursor parallax on the helix. No recoil or jiggle on scroll.
- Entrance: band first. Cards shutter out of the stack into a uniform band, then the band is stretched open as if two ends were pulled; may run longer than 1400ms; it plays after the loader. Motion must be clean.
- Idle: slow, possibly slower than the lab's slow.
- Name behind: keep, at the lab's weight. A gradient or shader over the type is welcome, not required. Option to try: "Sulbaran" small in Inter to the lower right, starting near the middle of the o, always readable (undecided).
- Background: the shader field, moving slowly, never fighting the helix. Not paper, not grain, not grid. Layer 1 changed 2026-09-29.
- Composition: the helix is the hero. Not B. The list beside the helix is too much; every card getting its own row is too much. How the list integrates is OPEN (options below).
- Hover-jump from a list row to its card: keep, slower and softer.
- Light and dark both.
- Seen state: never greyed. An outline dot in the card's upper corner instead of a solid dot.
- On screen in the hero: the name, the helix, the menu, and one quiet way into the list view. Nothing else.

Picked by Aaron from hero lab 2, 2026-09-29 (the build starts on these; see `docs/coil-build-scaffold.md` table 1.1):
- [x] O1: the book (one-screen two-column table under the hero; users can scroll away); the double-click unwind stays as the Easter egg.
- [x] O2: duotone backs (accent-tinted photo, not quite black and white). Curvature 0.7 as built.
- [x] O3: stretch. Noted for later: stretch plus light, and flare plus light.
- [x] Work cards: our pane (tone) with the logo; brand-colored panes revisited once real logos and assets are in the repo. Backs: same material, no logo.
- [x] "Sulbaran": off.
- [x] Name fill: a gradient (explore a grain gradient inside the letters during the build, not a flat fill).
- [x] Palette: sea plus burnt orange, the orange reduced to about 20 percent of the field (the lab's 50/50 was too much). Light and dark both approved.
- [x] Geometry: axis 33 degrees, 8 cards per turn, turn gap 1.5, card height 24 percent, neighbor gap 0.05, lean -12, curvature 0.7, repeats fill the pane.
- [x] Wheel (revised 2026-09-29 after Aaron's hands-on pass; see `docs/coil-input-model.md`): ownership is decided once per wheel gesture. Pointer inside the helix silhouette (gaps included) with the hero at least half in view: the coil owns the gesture, both directions, no delay, the page does not move. Otherwise the page owns it. Released only when the pointer itself leaves the silhouette. No hover intent, no "cards only", no "top of page only" (those three rules broke capture). Chevron nudge after 2.6s, gone the instant the coil lets go. Page scroll turns the coil gently. Revised 2026-10-06: page scroll no longer turns the coil; it runs at its idle pace while the hero scrolls away. Spin cap 12.5 cards/s, idle slow as built.
- [x] Build: autonomous overnight per the scaffold and section 10, Aaron's full permission (2026-09-29).

## 3. Loader

- [ ] Concept: giant "Aaron" fills the pane; a fill line rises from the baseline as assets load; a small percentage at the top; all assets loaded before the reveal. (rec yes)
- [ ] Two-tone mode: a, only the letters change tone (rec) / b, an accent band rises behind the name / c, a one-pixel line with accent below.
- [ ] Base: the loader is always dark (#0E1419, paper letters, accent fill) and the light site fades in under it (rec). On the light base the two tones barely separate; fixing that needs a lighter tint, a second color.
- [ ] Exit: continuity, the name shrinks and dims into its resting place behind the helix and the cards fade in over it (rec) / iris / garage up / screen down.
- [ ] Exit duration 800ms on the site ease.
- [ ] Number: top center, 12px, no status word; hidden when the load finishes under about 600ms (rec).
- [ ] Flash guard: the loader appears only after 250ms; if everything is ready sooner, go straight to the hero (rec).
- [ ] Phone: the name rotated up the left edge, the number in the free right column (rec) / single line.
- [ ] Reduced motion: name shown fully in accent, number counts, 300ms fade.

## 4. Menu and header

- [ ] Menu: M1, the pill grows into a right-hand panel on the site ease, no overshoot, no blur; the coil keeps moving; Close lands where Menu was (rec).
- [ ] Panel dim on the light theme: 45 percent as built / 30 percent (rec).
- [ ] Links in the panel: raise them to about a third down the panel (as built they sit low with dead space above) (rec).
- [ ] Full-page alternative kept as the fallback: M4, paper veil at 80 percent with the coil alive underneath.
- [ ] Rejected: M2 (M1 without the morph), M3 (drawer from the mark; trigger and origin on opposite corners), M5 (takeover hides the hero and adds numbers).
- [ ] Header: H1, mark and pill only during the hero; past the hero a bar with Work About Connect slides in, hides on scroll down, returns on scroll up (rec). Alternatives: H2 pill only everywhere; H3 no mark in the header.
- [ ] Pill hover: "Menu" rolls up and the mark rolls in (rec) / accent dot grows.
- [ ] Listen control lives inside the pill as its own button: hollow ring paused, filled pulsing dot playing (rec).
- [ ] Phone: M1 as a bottom sheet with a grip bar; pill stays top-right as Close.
- [ ] Retire the current left scroll-spy rail (duplicates the nav, tracked caps).

## 5. Logo

- [x] Recipe, chosen by Aaron 2026-09-28 in `logo7/slider.html`: `gap=8 apex=6 over=4 stroke=10 size=level` on the S2 bolt. Tips level so the A's right leg and the bolt's tail end on one point; hairline gap (0.92px at 32px on a 1x screen, so it reads grey at nav size on non-retina and clean at 2x); left foot 4 units below the right tip; A stroke 10. Exported by `logo-final/export.js`.
- [x] Favicon and any use under 24px: the bolt alone at favicon weight (round 6 C2), paper on the accent tile. No variant holds an A at 16px.
- [ ] Rendering rule: flat ink or paper, never outlined, slanted, or two-colored inside the letter (it tips into a sports crest).
- [x] Delivered: `public/brand/` (SVG ink, paper, on-paper, on-dark, bolt alone; PNG 256 to 2048; JPEG 1024 and 2048), `app/icon.svg` and `app/apple-icon.png` replaced; vault `attachments/brand/` with `wiki/concepts/personal-mark.md` linked from the personal-brand playbook.
- [ ] Nav mark size: 32px (rec, the gap survives at 2x) / 28px.

## 6. Background

- [ ] A fine grid (Pacôme's move; closest resemblance).
- [ ] B grain (static, a few KB).
- [ ] C single-hue light following the coil's focus (one uniform in the same canvas; light on paper, not a color gradient).
- [ ] D shader field (a real gradient; needs the Layer 1 rule "no gradients on section backgrounds" changed by you).
- [ ] E the existing waveform behind everything (already on main; two motions at once).
- [ ] F waveform plus grain.
- [ ] rec: B plus C in the hero; E stays from the Listen invite down. Say "D" and I draft the Layer 1 change.

## 7. Mobile

- [ ] Timed entrance to the resting helix; vertical scroll straightens it into the list at once and is never hijacked.
- [ ] Drag-to-spin Easter egg on the coil, locked to horizontal; "coil" and "list" pills swap the two states.
- [ ] Tablet portrait uses the phone driver with the list stacked under the greeting; landscape uses the desktop driver.
- [ ] Budget: 256 to 384px textures, DPR capped at 2, verified on a real iPhone and a mid-range Android before merge.
- [ ] Reduced motion: DOM list only.

## 8. Layer 1 changes this implies (AGENTS.md; only on your instruction)

- [ ] "Desktop and mobile are separate home experiences" becomes "one object, two drivers".
- [ ] Fonts row: Profa Black is the display face site-wide; Instrument Serif and Space Grotesk retire; the italic clause goes.
- [ ] Typography: sentence case for labels, no tracked caps.
- [ ] The sticky nav paragraph becomes H1 as ticked above (mark and pill during the hero, bar after).
- [ ] "No gradients on section backgrounds": unchanged unless you pick D.
- [ ] Glassmorphism paragraph: the Menu panel has no blur; the pill keeps its small blur.

## 2.10 Aaron's hands-on pass, 2026-09-29 evening (fix PRs 11 onward)

- [x] The mark is the full AS mark everywhere, including the favicon and the pill's hover (overrides "bolt alone under 24px" for those two places; the A is a smudge at 16px and that is accepted).
- [x] The Listen control is a single quarter note: filled accent when playing, outlined with a drawn slash when off.
- [x] "Work and photos" is removed from the hero. "Hi, I'm" is drawn in the canvas in the name's own style, as one lockup with "Aaron".
- [x] The name's fill is grain (the shadergradient look), alive at idle, pushed aside by the cursor in proportion to its speed, refilling within about a second. Options are built behind `?name=`; Aaron picks. Not green.
- [x] Ruled 2026-09-30 (design review of the Tide and Fabric labs, then Aaron's answers): the name is a lit shadergradient surface (the Tide lab's color law and pale crest in both themes, never orange in the letters) seen through the letters at ink 12 light and 14 dark, stirred by a museum-rhythm wake that swells about 0.75s after a swipe and settles over about three seconds (a faint stir at 300 px/s, up to about 20 percent ink where touched), every letter held within 1.5x of the strongest, the greeting at 0.18 of the cap height in the same mask; the seven fills, the repel and `?name=` are gone.
- [x] The background field's drift is raised until the movement is visible within a few seconds.
- [x] The seen ring in the coil is discreet and constant in contrast on every card. Seen rows in the book dim their title like non-hovered siblings.
- [x] Hovering a book row brings its card forward once and holds the coil still.
- [x] Clickability hint: first visit only, the cursor swells to "Open me" over a card until the first card is opened; then "Keep exploring" once. No orbiting text.
- [x] The flight to and from the modal must be seamless at both ends (Fable debug agent).
- [x] The waveform moves into a full-width band directly under the book, where the Listen invite and the pill are introduced; nothing animates behind body text. The music interaction gets its own session later.
- [x] Playwright is approved as a dev dependency for real-input and visual tests.

## 2.11 The music interaction session, 2026-10-02 (spec: `docs/waveform-follows-spec.md`)

- [x] Supersedes the 2.10 line "nothing animates behind body text". The waveform is introduced in the band under the book, then follows the reader down the page as a fixed strip along the bottom of the viewport. It may pass behind text only ducked to a still line under a contrast ceiling (4.5 to 1 for muted body text, tested from the tokens).
- [x] The ask stays in the band, with the waveform's introduction: "Want some music while you scroll?" The pill is what leaves with the reader: it condenses down from the control they pressed (or rises from the bottom when the band is off screen), lands open with one line saying the music lives there, then collapses to the capsule.
- [x] Yes: the wave reacts to the music and follows. No: the wave follows as a calm background that moves with the scroll and reacts to nothing, and the pill stays within reach ("Here if you change your mind."). "Not now" is never asked twice.
- [x] The handoff is a snake: the wave leaves the band at one edge and the same ribbon arrives from the other edge, lower down, driven by scroll and reversible.
- [x] Phones unchanged this pass (the band is the ask and the control).
- [x] Ruled 2026-10-05 from mockups of four placements on the real build: the pill sits at the bottom left on the wave's line, sharing the header mark's left edge. Bottom centre, the first build, put a fixed capsule on the reading column. No fade under text.
- [x] The duck's look-ahead scales with scroll speed (zero at rest), and the light theme's open-air dots are 0.40 and 0.55.
- [x] The test browser is muted; an unmuted suite was playing the soundtrack through the laptop's speakers.
- [ ] Later, Aaron's idea: once it is background, the wave reshapes into other forms (a helix echoing the hero).

## 2.12 Aaron's hardware pass, 2026-10-05 (the Coil's wheel)

- [x] Supersedes 2.9 and 2.10 where they say the coil owns a gesture anywhere inside the helix silhouette, gaps included. The silhouette took the wheel from empty background, and a page scroll could slide a card under a still pointer and trap the next gesture.
- [x] The coil takes a gesture only where the cursor shows a card, or in the seam between two cards. Empty background inside the helix scrolls the page.
- [x] The coil takes a gesture only after a real pointer move since the page last scrolled. A fresh load, or a card the page slid under a still pointer, scrolls the page.
- [x] Once the coil has a gesture it keeps the next ones until the pointer really moves or the page scrolls. Release is unchanged: only a real move outside the silhouette.
- [x] Still true: decided once per gesture, no delay, no hover intent, no top-of-page rule. Rules and tests: `docs/coil-input-model.md` section 3.

## 2.13 The still fallback, 2026-10-07 and 08 (PR 36)

- [x] A visitor with no WebGL, a failed scene or reduced motion sees the site at rest, not a safety floor: a real still of the scene per theme and aspect, the loader's lockup handing to it, and the book below. Aaron met the old poster in his own Chrome (graphics acceleration off) and ruled it out.
- [x] The name stays behind the cards in the still, at the strong ink that separates background, coil and name. "Name in front" was tried on his first call and reversed on sight: it took away from the coil.
- [x] The square and narrow stills cover part of the name with the helix; accepted.
- [x] A short notice tells those visitors why the page is still, one sentence per cause in his words, dismissible, remembered per browser. Copy in `siteContent.hero.still`.
- [x] Reduced motion keeps its own loader branch (no fill, a 300ms fade) and gets the same still.

## 9a. Surfaced by the overnight build (2026-09-29), yours in the morning

- [ ] The Profa file in `app/fonts/` is the trial cut: it draws a "personal use only" stamp for `*`, `;` and `@`. Slice 2 routes those three glyphs to the fallback font. Drop the full cut from your asset pack into `app/fonts/` (same filename or update `lib/fonts.ts`) and the workaround goes.
- [ ] Codex reviews are off: the workspace spend cap was hit during the slice 0 review. Every PR tonight carries a Fable-only review, stated in each merge note. Raise the cap or accept Fable-only until launch.
- [ ] Translucent token classes (`bg-background/70`, `/80`, `/85` in the three modals and SiteNav) generate no CSS under Tailwind 3 with `var()` colors, so those surfaces render transparent today. Slice 2 fixed the border and text cases; the background ones need an alpha-capable token (own small PR).
- [ ] Case page meta reads "Product Manager Intern · 2025"; the label rule is "Capital One, product manager intern, 2025". Slice 8 (content).
- [ ] Slice 2 removed the "01" to "04" markers in UpToNow per the numbers rule; the Menu's numbers go with slice 6. Say if you want any number back.
- [ ] Vercel project Node version must be 20.9 or newer before the production flip (Next 16 floor).
- [ ] Builder commits are credited to Claude Opus 5.5, the model that wrote them; Fable's line is on the docs commits.

## 9. Still yours

- [ ] The logo code string (section 5).
- [ ] Talos coming-soon copy; min/Max live link.
- [ ] Which five placeholder photo slots get real photos, or get cut.
- [ ] "apply" for the AGENTS.md Layer 2 diff proposed on 2026-09-27.
- [ ] Push of the docs commits on main (three so far, plus this one).

## 10. Build rules (Aaron, 2026-09-29; every builder agent reads these)

- Nothing the builders do may trigger a Vercel production build. Production deploys only from `main` on Aaron's explicit push, and only after the verification gate and the design review.
- Integration branch `coil` (created 2026-09-29 from `main`). Its first commit adds `vercel.json` with min/Max's `ignoreCommand`, so every branch carrying it skips its own preview build and never spends the daily Vercel deployment quota. Verification is a local production build (`pnpm build && pnpm start`), never a preview.
- One slice = one branch off `coil` = one PR into `coil`, small commits with one logical change each, so any step can be reverted alone. Fable and Codex review each PR before merge; nothing is squashed away.
- No agent pushes `main`. Merging `coil` into `main` is Aaron's call, once.
- Optional, Aaron decides: adopt min/Max's `release` branch pattern (production tracks `release`; `main` stays free to move) by changing Production Branch in the Vercel dashboard. Not required while production holds the holding page.
- Never run `pnpm dev` and `pnpm build` at the same time (shared `.next`). Builder agents that need a browser use agent-browser with a session name and per-command timeouts; at most two browser agents at once.

## What happens after you tick

1. I revise `docs/coil-hero-spec.md` from this file and export the logo.
2. One composed specimen (loader, hero with the chosen orientation and composition, name behind, list landing, section head, case title, header, menu, chosen background, light and dark, desktop and phone) by one Opus agent, reviewed by the design-review skill and Codex, judged by you.
3. Builder agents on the spec's slices, one at a time: controller extraction and `lib/coilGeometry.ts` first, then the scene, the straightening, the flight adapter, the case template, the verification gate.
