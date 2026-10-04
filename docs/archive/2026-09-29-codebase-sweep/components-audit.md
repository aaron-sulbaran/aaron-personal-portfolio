# components/ audit for the Coil rebuild (read-only, nothing modified)

Repo: this repository at `main @ f49fb61`. Verified by reading every file in full plus grepping app/ and lib/. Line counts are `wc -l`. "S" is a Server Component, "C" is `"use client"`. Importer lists come from grep across app/, components/, lib/. Note that `three` is not in package.json or node_modules yet.

## 0. Headline findings

1. TileRing is not just a renderer. Roughly 40 percent of its 2691 lines is home-controller logic (readiness, locks, modals, explored, focus, deep-reload, flight orchestration, device fork) that must move to a renderer-neutral shell first. Section 6 lists it with line ranges.
2. Hidden DOM-level couplings will break silently if TileRing goes:
   - `[data-state]` on TileRing's `<section>` (TileRing.tsx:2012) is read by SiteNav.tsx:80-95 and ScrollProgress.tsx:112-128 via `document.querySelector("[data-state]")`. It is the only "hero ready" signal outside React context.
   - `#hero-pin` (app/page.tsx:47) is pinned by TileRing and MobileHome, and is the reason Portal exists.
   - `#work` is read by Waveform (ScrollTrigger `start: "top 12%"`, Waveform.tsx:~226), PlaybackPill (reveal gate, PlaybackPill.tsx:110-115), ScrollProgress, Menu, SiteNav and the case-page back link `/#work`.
   - `[data-tile-slot="photo"|"work"]` in PhotoModal.tsx:102 and WorkModal.tsx:105 is queried by FlyingTile.
   - `[data-cursor-hover]` is used by CustomCursor.
   - `--scrollbar-comp` is written by the scroll lock (lib/modal.ts:35) and read by the Menu trigger.
3. The phase machine (hidden, firstTile, stacking, shuffling, fanning, ready) runs on mobile too. Its timing gates mobile's scroll lock and `scrollReady`, while MobileHome runs its own separate entrance clock (~1.83s). The two clocks are independent (TileRing.tsx:713-767 versus MobileHome.tsx:355-385).
4. Explored state is only marked when a flight existed (TileRing.tsx:1122-1139). The mobile no-flight path returns early at 1122-1128 and never marks it. The new "seen" state needs to work for both drivers.
5. `lib/modal.ts:185-193` animates `backdropFilter: blur(24px)` on the full-viewport dialog root for Photo, Work and Definition modals. With the coil canvas kept visible behind the modal (per spec), that blurs a live WebGL canvas. It is only safe if the scene is frozen and stops rendering at activation.

---

## 1. Per-file inventory

Format: lines | S/C | what it does | project imports | imported by | VERDICT

### Home controller and ring (the retiring core)

**TileRing.tsx** | 2691 | C | Desktop hero: entrance phase machine, 20 DOM tiles on a 3D ring with cursor parallax and proximity lean, GSAP pin/scrub collapsing the ring into an arc carousel, wheel/arrow rotation, click-to-modal shared-element flight, modal ownership, explored state, deep-reload recovery, and the mobile fork. Exports `TileRing` and `useRingState`.
- Imports: lib/content, lib/modal (useBodyScrollLock), lib/scroll (readScrollY, saveScrollY), lib/motion (EASE), lib/gsap, lib/carouselGeometry, ArcIndex, GlassTile (+type TileActivatePayload), FlyingTile (+types), PhotoModal, WorkModal, MobileHome (+type CarouselOpenPayload), Portal.
- Imported by: app/page.tsx (wrapper), HomeHero.tsx (`useRingState`).
- VERDICT: RETIRE the renderer, EXTRACT the controller. Replace with a renderer-neutral home controller shell (client) that owns everything in section 6 plus a `<CoilScene>` client component. Dies: ring seats and geometry (95-134), entrance choreography constants and `computeTarget` (136-152, 2211-2399), cursor parallax (154-160, 407-437, 514-603), proximity lean and flip (243-264, 2401-2690), the ArcIndex panel writer (772-840), the whole ring-arc driver (1197-1994 minus the recovery tail 1929-1982), and the reduced-motion static arc (1851-1922, 2136-2167). Aaron's 2026-09-29 lock says "No cursor parallax on the helix", so parallax and proximity are confirmed dead.

**MobileHome.tsx** | 709 | C | Mobile-only: same 20 cards run a pile, riffle and curved-fan entrance on one imperative clock, then a scroll-scrubbed ring-to-coverflow, then horizontal swipe browsing. Its own `gsap.matchMedia` and its own pin on `#hero-pin`.
- Imports: lib/gsap, lib/content, GlassTile.
- Imported by: TileRing only.
- VERDICT: RETIRE (the Coil's touch/time driver replaces it). Portable ideas only:
  - a single entrance clock feeding one `layout()` that owns all transforms;
  - `inert` toggled on non-tappable cards (MobileHome.tsx:~349);
  - axis-lock touch handling with `[touch-action:pan-y]` and horizontal-only `preventDefault` (~437-470, 658);
  - the fact that mobile opens modals with no flight (`renderMedia`).
  It has raw copy strings (section 5).

**GlassTile.tsx** | 268 | C | One card as a DOM `<button>` with a translucent glass pane. Resolves a HomeTile to a photo or work item, emits `onActivate`, runs the explored frost veil, and scales pixel cues by `detailScale`.
- Imports: lib/content.
- Imported by: TileRing, MobileHome.
- VERDICT: RETIRE as a component. Detail in 2a.

**ArcIndex.tsx** | 79 | C | Presentational left panel for the settled carousel (NN / 20, kind, explored status, title, blurb, helper), filled imperatively via refs. It has an `aria-live` wrapper.
- Imports: none.
- Imported by: TileRing.
- VERDICT: RETIRE (replaced by the DOM list and its a11y). It orphans `siteContent.home.panelHelper/panelKindPhoto/panelKindCaseStudy/panelExplored/panelUnexplored/panelPrev/panelNext`. Its aria-live "05 / 20, Case study, Explored, title" announcement pattern is worth replicating in the list.

**HomeHero.tsx** | 206 | C | Centered hero copy: h1 "Hi, I'm Aaron." with "Aaron" accented, tagline whose words "products" and "community" open the DefinitionModal (shared `layoutId` morph), and a bobbing scroll cue. Fades in when the ring is ready and out when any modal opens.
- Imports: lib/content, TileRing (`useRingState`), DefinitionModal.
- Imported by: app/page.tsx (as TileRing's child).
- VERDICT: ADAPT heavily (effectively a rewrite). See 2h.

### Flight and modals

**FlyingTile.tsx** | 405 | C | Fixed-position DOM clone of a card that flies from its ring seat into the modal's image slot and dissolves back on close. Tracks the live slot rect, has a reduced-motion fade path, and renders front and mirrored-back frosted faces.
- Imports: lib/content, lib/modal (MODAL_DISMISS_HOLD, MODAL_DISMISS_RAMP).
- Imported by: TileRing.
- VERDICT: ADAPT (contract extension, not a rewrite). See 2b.

**PhotoModal.tsx** | 132 | C | Portaled dialog: blurred backdrop, glass panel, empty `data-tile-slot="photo"` (3:4) for the flown clone, serif italic caption. With `renderMedia` it draws its own image (mobile path).
- Imports: lib/modal (useBodyScrollLock, useEscapeKey, useFocusTrap, modalBackdropBlurVariants, modalBackdropTintVariants), lib/content, Portal.
- Imported by: TileRing.
- VERDICT: ADAPT (small). See 2d.

**WorkModal.tsx** | 157 | C | Same shell for work items: 80px `data-tile-slot="work"` logo slot, role and year, title, teaser, CTA link to `/work/[slug]`. Duplicates the work tint gradient for `renderMedia`.
- Imports: lib/modal, lib/content, Portal.
- Imported by: TileRing.
- VERDICT: ADAPT (small). See 2d.

**DefinitionModal.tsx** | 121 | C | Text-only modal "My definition of <term>". Its title term shares a `layoutId` with the hero word.
- Imports: lib/modal, lib/content, Portal.
- Imported by: HomeHero only.
- VERDICT: REUSE AS IS if the two definition words get a home; otherwise RETIRE with HomeHero. Aaron's hero brief is "the name, the helix, the menu, and one quiet way into the list view. Nothing else", so the tagline and its definition words have no slot on the hero screen. That is an open content decision. Definitions could move to the About or experiences area, since `siteContent.definitions` is keyed to words in `home.tagline`.

**Portal.tsx** | 23 | C | `createPortal` to `document.body`, mount-gated. Exists because the pinned `#hero-pin` leaves a transform, which would capture `position:fixed` descendants.
- Imports: none.
- Imported by: DefinitionModal, PhotoModal, WorkModal, PlaybackPill, ScrollProgress, Waveform, TileRing, recruiting/EditDialog, recruiting/Popover.
- VERDICT: REUSE AS IS. It is shared with recruiting, and the pin-transform trap still applies to any pinned hero.

### Chrome: menu, nav, cursor, progress

**Menu.tsx** | 237 | C | Layout-mounted, every non-holding route. A 44px circular top-right hamburger (`#site-menu-trigger`, z-40, `backdrop-blur-md`, offset by `--scrollbar-comp`) opens a full-viewport dialog. Details in 2e.
- Imports: lib/modal, lib/content, lib/scroll (`navigateToSection`), lib/theme, lib/soundtrack.
- Imported by: app/layout.tsx.
- VERDICT: ADAPT (new shell, keep the logic). Replace the JSX with pill and right-hand panel. Keep:
  - the hooks (`useBodyScrollLock`, `useEscapeKey`, `useFocusTrap`);
  - close on route change (Menu.tsx:~50);
  - `handleNavClick` close-then-double-rAF (65-74);
  - `toggleTheme` including `syncThemeColorMeta` and localStorage (76-87);
  - `toggleMusic` (95-98);
  - the `--scrollbar-comp` right-offset trick.

**SiteNav.tsx** | 184 | C | Sticky top nav: inline "A" BrandMark SVG, Work/About/Connect (uppercase tracking-caps). Hidden until `scrollY > 0.6*innerHeight`, then headroom (hide on scroll-down). Scroll-spy via IntersectionObserver. Deep-link hold until `[data-state]==="ready"`.
- Imports: lib/scroll.
- Imported by: app/layout.tsx.
- VERDICT: ADAPT. See 2f.

**CustomCursor.tsx** | 110 | C | Fine-pointer-only accent dot at z-[100]. Position is written directly to the DOM on `mousemove`. Grows to a ring when the target matches `HOVER_SELECTOR`.
- Imports: none.
- Imported by: app/layout.tsx.
- VERDICT: ADAPT (small). See 2g.

**ScrollProgress.tsx** | 245 | C | The left-edge scroll-spine rail (HOME/WORK/ABOUT/CONNECT with dots and fill, tracking-caps labels) plus a 2px mobile top bar, both Portaled at z-[31]. It measures `#work`, `#about`, `#connect` every frame and reveals on `[data-state]==="ready"`.
- Imports: lib/scroll (`scrollToTarget`), Portal.
- Imported by: app/page.tsx.
- VERDICT: RETIRE. Design decisions say "retire the left scroll-spy rail". It also removes one `[data-state]` consumer and one Portal user.

### Soundtrack surface

**Waveform.tsx** | 408 | C | Fixed full-viewport 2D-canvas twin-line particle waveform at z-0, Portaled. Its ScrollTrigger ramps in from `#work` (`start "top 12%"`). It reads theme colors from `--color-muted` and `--color-accent`, returns null under reduced motion, and bails on max-width 767.
- Imports: lib/gsap, Portal, lib/audio, lib/soundtrack.
- Imported by: app/page.tsx.
- VERDICT: REUSE AS IS. Only dependency on the old hero is that `#work` exists and sits below the hero. Design decision: the waveform lives "from the Listen invite down", not in the hero.

**PlaybackPill.tsx** | 698 | C | Portaled bottom-center glass player (fixed, z-45, bottom 30). Collapsed capsule, hover preview, expanded card with seek/transport/volume/track, an entry prompt card when state is "before", and an equalizer glyph. Reveals when `#work` top is above 12% of viewport (PlaybackPill.tsx:110-115). Renders null on mobile or when music is "off" (177).
- Imports: Portal, lib/content, lib/audio, lib/soundtrack.
- Imported by: app/page.tsx.
- VERDICT: REUSE AS IS for the player. ADAPT only the reveal rule if the Listen dot needs it reachable from the hero. See 2i.

**ListenInvite.tsx** | 128 | C | In-flow `#listen` section between hero and `#work`: "Play it" / "maybe later". It renders null on mobile, or if a soundtrack choice existed at mount. Uses `initSoundtrackFromStorage`, `startSoundtrack`, `stopSoundtrack`, `useSoundtrack`.
- Imports: lib/content, lib/motion, Reveal, lib/soundtrack.
- Imported by: app/page.tsx.
- VERDICT: ADAPT or RETIRE, a real decision. If the pill's Listen dot becomes the entry point, this 60vh beat is redundant, and it also sits where the new one-screen experiences table goes. If kept, it stays mostly as is (needs sentence-case restyle).

### Home page sections

**Reveal.tsx** | 86 | C | Scroll-in wrapper. Renders visible by default, arms after mount, and an IntersectionObserver flips `data-shown`. Descendants opt in via `.reveal-item` / `.reveal-mask` (CSS in globals.css:113-147).
- Imports: none.
- Imported by: AboutIntro, Connect, ListenInvite, UpToNow, WhoIAm, WorkSection.
- VERDICT: REUSE AS IS.

**ReadAlong.tsx** | 52 | C | Desktop-only scroll-scrubbed read-along paragraph (`--read-pos`), via `gsap.matchMedia` at min-width 768.
- Imports: lib/gsap.
- Imported by: WhoIAm.
- VERDICT: REUSE AS IS.

**UpToNowList.tsx** | 120 | C | The "What I'm up to" list: IO entrance plus desktop parallax scrub.
- Imports: lib/gsap, lib/motion.
- Imported by: UpToNow.
- VERDICT: REUSE AS IS.

**WorkSection.tsx** | 88 | S | `#work` index: eyebrow, h2, lede, and a `<ul>` of `siteContent.workItems` linking to `/work/[slug]` with logo, serif-italic title, and role · year.
- Imports: lib/content, lib/motion, Reveal.
- Imported by: app/page.tsx.
- VERDICT: ADAPT. It is the natural seed for the one-screen experiences table under the hero. Keep `id="work"` (Menu, SiteNav, Waveform, PlaybackPill, case back-link and Menu items depend on it). Content is a problem: the spec list order (Talos, min/Max, experience, photos) is not in `siteContent.workItems`.

**AboutIntro.tsx** | 41 | S | `#about` header block.
- Imports: lib/content, lib/motion, Reveal.
- Imported by: app/page.tsx.
- VERDICT: REUSE AS IS structurally, restyle later.

**WhoIAm.tsx** | 35 | S | `#who-i-am`: label plus ReadAlong bio.
- Imports: lib/content, lib/motion, Reveal, ReadAlong.
- Imported by: app/page.tsx.
- VERDICT: REUSE AS IS structurally, restyle later.

**UpToNow.tsx** | 37 | S | `#up-to-now`: header plus UpToNowList.
- Imports: lib/content, lib/motion, Reveal, UpToNowList.
- Imported by: app/page.tsx.
- VERDICT: REUSE AS IS structurally, restyle later.

**Connect.tsx** | 66 | S | `#connect`: heading, lede, and link rows (LinkedIn, GitHub, two emails).
- Imports: lib/content, lib/motion, Reveal.
- Imported by: app/page.tsx.
- VERDICT: REUSE AS IS structurally, restyle later.

**Footer.tsx** | 13 | S | Tagline and copyright.
- Imports: lib/content.
- Imported by: app/page.tsx, app/work/[slug]/page.tsx.
- VERDICT: REUSE AS IS structurally, restyle later.

Restyle scope for these six and the other serif and caps users: they all use `font-serif italic` (Instrument Serif) and `uppercase tracking-caps` eyebrows with a rule line. The new type system says Profa Black display, sentence-case labels, no tracked caps, no numbered eyebrows. This is a class-level change in 20 files. It is not a logic change and is best done in one type slice. Tracking-caps appears in AboutIntro, Connect, ListenInvite, Menu, PhotoModal, WorkModal, DefinitionModal, ArcIndex, MobileHome, ScrollProgress, SiteNav, UpToNow, WhoIAm, WorkSection, Holding, and app/work/[slug] and recruiting.

### Holding mode (UNRELATED to the Coil)

**Holding.tsx** | 100 | S | The "Pardon the dust." page (Profa Black headline, `.holding-rise` CSS entrance, social pills). It carries raw `aria-label="Where to find me"` (Holding.tsx:68).
- Imports: lib/content, lib/motion, lib/fonts, BrandIcons, HoldingDeck.
- Imported by: app/page.tsx (HOLDING_MODE).
- VERDICT: UNRELATED (holding).

**HoldingDeck.tsx** | 116 | C | Decorative 5-card riffle deck that re-implements GlassTile's material with raw `rgba(255,255,255,...)`.
- Imports: lib/content, lib/motion.
- Imported by: Holding.
- VERDICT: UNRELATED (holding).

**BrandIcons.tsx** | 53 | S | Inlined LinkedIn/GitHub/X/Instagram SVG paths plus a lucide Mail.
- Imports: type only from lib/content.
- Imported by: Holding.
- VERDICT: UNRELATED (holding). It is a good candidate for the new Menu panel's contact links.

**CLAUDE.md** | 10 | n/a | auto-generated claude-mem stub. UNRELATED.

### components/recruiting/ (UNRELATED; private `/recruiting` dashboard)

All import `siteContent` and lib/recruiting/*. Importers are only inside recruiting/ or app/recruiting/page.tsx.

| File | Lines | S/C | What | Imported by |
|---|---|---|---|---|
| ApplicationsTable.tsx | 329 | C | sortable applications table, cards on mobile | RecruitingDashboard |
| Controls.tsx | 147 | C | season/filter control row | RecruitingDashboard |
| EditDialog.tsx | 374 | C | edit/add dialog on lib/modal primitives; imports Portal | RecruitingDashboard |
| FilterMenu.tsx | 214 | C | filter popover | Controls |
| FunnelSankey.tsx | 394 | C | Sankey plus stacked bars | RecruitingDashboard |
| Popover.tsx | 162 | C | shared popover / bottom-sheet shell; imports Portal; exports its own `Menu` (name clash with components/Menu.tsx, different module) | FilterMenu, SortMenu |
| RecruitingDashboard.tsx | 251 | C | client shell | app/recruiting/page.tsx |
| RefreshButton.tsx | 117 | C | refresh request | app/recruiting/page.tsx |
| SortMenu.tsx | 150 | C | sort control | ApplicationsTable |
| StatTiles.tsx | 34 | S | headline numbers | RecruitingDashboard |
| submitEdit.ts | 24 | S | POST helper | EditDialog, RecruitingDashboard |
| tones.ts | 31 | S | flow-tone colors via `var(--viz-*)` | FunnelSankey, RecruitingDashboard |

VERDICT for all: UNRELATED. Cross-dependencies to protect:
- `Portal` and `lib/modal` must keep their API.
- RecruitingDashboard's StickyBar (RecruitingDashboard.tsx:~183-190) pins at `top-16` in full-site mode, assuming SiteNav is about 53-57px tall. If SiteNav or the header changes height, retune it.
- The layout mounts Menu, SiteNav and CustomCursor on `/recruiting` too, so the new pill and cursor must work off-home.

---

## 2. Deep dives

### 2a. GlassTile: is any of it useful for a WebGL card?

Only tokens and data, none of the CSS mechanics.

Useless for WebGL: everything that is DOM/CSS. That is `overflow-hidden` clipping, `box-shadow` rim and float, `ring-*`, `next/image` in a DOM button, `backdrop-filter` veil, the `detailScale` machinery (161-172, which exists only because of CSS scale-down blur), and the `entering` opaque backing.

Worth carrying forward:
- Card aspect 3:4 (TileRing 844).
- Radius ratio: 8px on a 9vmin (~72px) card, about 11 percent (GlassTile 162 and MobileHome comment).
- Glass cue values as visual reference, if the WebGL card keeps any glass: rim highlight `rgba(255,255,255,0.4)` top plus `0.14` inset (163-165), diagonal sheen 135deg `0.13 → transparent 42% → 0.04` (174-177), work accent-tint gradient `color-mix(accent 18% / glass 50% / accent 40%)` (180-183), photo opacity 0.9 (238, 249), float shadow `rgba(10,10,10,0.35)`.
- Note that the coil spec overrides several of these: card body tone off paper, ~0.2 ink hairline, flat 1px inner highlight with no gradient sheen, five work cards as solid accent with paper monograms, and recede by brightness, never blur.
- `resolveTile` (58-67), `TileActivatePayload` (11-13), and the accessible-name strings (123-126: "Open caption for ${alt}", "${title} logo, open preview, ${role}"). These are the labels the DOM list buttons will need. Move them into content.ts.
- `data-cursor-hover` on the button (210).
- The keyboard-vs-pointer focus signal (`focusedMV` set only on `:focus-visible`, 111, 140-148), which feeds `wasKeyboard` and focus restoration (see section 6).
- WorkDot (73-80): superseded by the seen-state outline dot in the upper corner. The current "explored" veil is `backdrop-filter: blur(7px) saturate(0.75)` (194-201), which contradicts "seen state: never greyed" and "no backdrop-filter in the scene". It dies.
- Texture sourcing: the DOM uses `next/image quality={88}` with `sizes="(max-width: 768px) 62vw, 26vw"`. The spec wants separately cacheable files at 384-512px. Placeholder SVGs (`photo-08/10/11/13/14`, marked PLACEHOLDER in content.ts:177-185) must never appear in the list.

### 2b. FlyingTile and the flight source contract

FlyingTile is renderer-agnostic in structure (it only consumes rects and angles), but the inputs are ring-shaped. Props (FlyingTile.tsx:32-59):
- `tile: HomeTile`, used only to resolve the image or logo.
- `homeRect: {left, top, width, height}`: the INTRINSIC (unrotated) viewport-px rect of the card at its rest slot. It is the closing target. TileRing deliberately builds this from geometry, not `getBoundingClientRect`, because the bbox of a rotated element distorts the flown shape (TileRing 904-909, 958-995).
- `homeTangentDeg`: base Z rotation. FlyingTile normalizes it to [-180,180] (213-214) so Framer takes the short arc. It is meaningless for a helix.
- `homeRestRotX` / `homeRestRotY`: resting X/Y tilt used in closing.
- `source: FlightSource {rect, rotX, rotY, rotZDelta}`: the live transform at click time (22-30). This makes the first frame identical to what the user saw.
- `target`: an initial slot guess. FlyingTile tracks the real slot itself by polling `[data-tile-slot="photo"|"work"]` every rAF until stable for 4 frames or 900ms (99-152), and takes one fresh synchronous measurement at close (159-166).
- `phase: "out" | "closing"`, `revealed` (photo defrosts in the modal), `onFlyOutComplete`, `onClosingComplete`.

Behavior: a `position:fixed` `motion.div` at z-[55] with `perspective:1400px`. On "out" it animates x/y/width/height and rotX/Y/Z to the slot over 0.52s on `[0.22,1,0.36,1]`, all rotations to 0. On "closing" it drifts 85 percent of the way home (`CLOSE_DRIFT`) over 0.46s while opacity dissolves after `MODAL_DISMISS_HOLD` (0.2s) for `MODAL_DISMISS_RAMP` (0.26s), so it masks with the held modal frost (lib/modal.ts:161-163). The reduced-motion path fades the clone in at the slot and out in place (183-205). The faces are DOM (`FlyingFace`, 325-392): translucent `bg-glass-strong`, sheen, rim, accent tint for work, plus a mirrored back face. The glass look is duplicated from GlassTile.

What a WebGL card must provide to fly into a modal:
1. At activation, the card's on-screen pose in CSS viewport px, including canvas offset. TileRing adds `offY = sectionRef.getBoundingClientRect().top` (1065). The canvas needs its own `getBoundingClientRect()` origin. With a curved card, a single rect plus three angles is only an approximation. The spec calls for extending the source to a projected quad (four corners, or a `matrix3d`), and the closing pose to a projected quad too.
2. A `homeRect` (closing target) recomputed from the LIVE frozen pose at close, not from click-time. TileRing does this in `beginClosing` (1096-1111) and re-measures on resize while the modal is open (1180-1195).
3. A frozen scene while a flight or modal is active. TileRing gates everything on `flightActiveRef` and `modalOpenRef` (467-469, 613-615, 1563, 1610, 1640, 1705, 1725-1727, 1782-1784). The idle spin, wheel spin and auto-advance must all stop, or the dissolve target drifts. TileRing also zeroed parallax on flight start (596-603) so the ring sits at pure rest at close. The coil's equivalent is freeze plus deterministic pose.
4. Hide only the selected mesh while phase is "out" (`hiddenRingKey`, TileRing 2000). Reveal it at "closing". FlyingTile is the only visible instance during "out".
5. A `HomeTile` (stable `tile.key`), the activation payload (`{kind:"photo",photo}` or `{kind:"work",workItem}`), the tile index, and the originating DOM button plus `wasKeyboard` for focus restoration (TileCapture, TileRing 82-93). In the coil the button lives in the DOM list.
6. `data-tile-slot` on the modal stays. FlyingTile's selector depends on it.
7. The clone's face material must match the new WebGL card (paper tone, hairline, flat highlight, accent monogram for work, designed back). Today's FlyingFace still paints the old glass. Keep that in sync or the handoff pops.
8. The whole flight path is gated by `phase === "ready"`, `!flight`, the click gate (917-924), and a hit-opacity floor. The coil needs an equivalent "interactive" gate.

### 2c. Portal

REUSE AS IS. It mount-gates (SSR renders nothing) and portals to body. It is required for every fixed overlay. The pinned hero, and anything the new hero pins, leaves a transform on `#hero-pin`, which becomes the containing block for `position:fixed` descendants. It is shared by recruiting (EditDialog, Popover).

### 2d. PhotoModal, WorkModal

Both are mounted permanently inside TileRing (TileRing 2205-2206), each with its own `useBodyScrollLock`, `useEscapeKey`, `useFocusTrap`, sharing `handleModalClose`. All three primitives come from lib/modal, which uses a reference-counted lock (14-52), an escape stack (60-105), and a focus trap that returns focus to the previously active element (118-152).

Changes needed:
- Copy strings out: "Tap outside to close" / "Press esc to close" (PhotoModal.tsx:123, WorkModal.tsx:148), plus the aria template `${item.title} preview` (WorkModal.tsx:76).
- Restyle: `font-serif italic` caption/title, uppercase caps hints.
- Keep `renderMedia` as the no-flight fallback the spec requires. Keep `data-tile-slot`.
- WorkModal's duplicate of `workTintStyle` (WorkModal.tsx:28-32) should match the new work-card look (accent solid with paper monogram).
- Modal panels keep `backdrop-blur-xl`. That is the sanctioned use.
- The full-viewport `backdropFilter: blur(24px)` variants in lib/modal.ts are the hazard over a live canvas (see headline 5).
- The photo modal's slot is 46 percent wide, aspect 3/4, and the work slot is a fixed 80x80 (h-20 w-20). A very different aspect between the coil card and the slot is handled by FlyingTile animating width and height, so no change is needed.

### 2e. Menu (current behavior and what the pill-to-panel replaces)

Current:
- Trigger (Menu.tsx:116-137): fixed top-4 (md:top-6), z-40, 44px circle, `border-border bg-background/90 backdrop-blur-md`, right offset `calc(1rem + var(--scrollbar-comp))`, two-bar SVG, `aria-expanded`, `aria-controls="site-menu"`.
- Open overlay (139-233): full-viewport dialog `bg-background/95 backdrop-blur-xl`, z-50. It has a title row (`siteContent.meta.title` in serif italic) and a close button. The nav is a list of `siteContent.menu.items` (only Home, Work, About; Connect is absent) as huge serif italics with a numbered "01/02/03" tracking-caps prefix and a slot-machine hover swap to Space Grotesk accent (600ms, `cubic-bezier(0.77,0,0.175,1)`, which is not the site ease). Below a rule are the music toggle (desktop only, `!isMobile`) and the theme toggle.
- Behavior: scroll lock, Escape, focus trap, close on pathname change, nav click means close, then double rAF, then `navigateToSection`, which does `location.assign` off-home.

The pill-to-panel replaces: the trigger geometry (circle to pill with "Menu" label, plus the Listen control inside it), the whole overlay (full-bleed to a right-hand panel), the hover treatment (roll-up to dim siblings at 0.75 with an accent underline), the panel blur (decided: none; the pill keeps its small blur), the numbering, and the italic/grotesk faces (Profa Black display). "Close lands where Menu was." It survives as behavior: theme toggle, close-then-scroll ordering, scroll lock plus `--scrollbar-comp`, focus trap, Esc, route-close.

Two latent issues to fix during the swap: (1) `iOS`/mobile hides the music toggle because the audio surface is desktop-only; (2) Menu never calls `initSoundtrackFromStorage`, so on non-home routes (where ListenInvite and PlaybackPill are not mounted) its toggle can show the wrong state for a returning visitor.

### 2f. SiteNav

Current: `motion.header` fixed z-30, `border-b bg-background/80 backdrop-blur-md`. Reveals when `scrollY > 0.6*innerHeight` (SiteNav.tsx:~44), then headroom. It has an IntersectionObserver scroll-spy at `rootMargin "-45% 0px -50% 0px"` over `#work/#about/#connect`. It carries an inline BrandMark SVG with raw fills `#1B3A5C` and `#FAFAF7` (lines 20, 28) with Instrument Serif italic "A". It has a deep-link effect (72-97) that waits for `[data-state]==="ready"` before `scrollIntoView` smooth. Labels are uppercase tracking-caps and hard-coded.

Changes:
- Swap in the new AS bolt mark from `public/brand/` (assets delivered per design-decisions section 5) and delete the inline SVG with its raw hex.
- Sentence-case labels. Put NAV_LINKS labels and the aria strings ("Primary", "Back to top") in content.ts.
- Re-anchor the reveal trigger: 0.6vh is a pin-era number. The new rule is "past the hero list", which is best a sentinel or ScrollTrigger end, not a magic fraction.
- Replace the `[data-state]` MutationObserver with the controller's readiness signal (context, store, or an attribute on a stable element).
- Remove the duplicate deep-link handler once the controller's recovery lands (TileRing's `applyRestore` already handles the hash instantly on a fast start).
- Backdrop blur on the header: only the pill keeps blur per the decisions. Header is a separate call.
- Retune RecruitingDashboard's `top-16` offset if height changes.

### 2g. CustomCursor: how it detects targets, and the canvas bridge

Detection (CustomCursor.tsx:5, 35-52): a `window` `mousemove` listener writes the dot's transform directly, calls `setVisible(true)`, then computes `event.target.closest("[data-cursor-hover], a, button, [role='button']")`. It only calls `setHovering` when the boolean flips (`hoverRef`). It is enabled only under `(pointer: fine)` (mobile gets nothing). It hides the native cursor via `html.cursor-none * {cursor:none !important}` (globals.css:95-100), so the canvas must never set its own CSS cursor.

The canvas problem: over a canvas, `event.target` is the `<canvas>`, which never matches. Also the helix moves under a stationary mouse (idle spin), and CustomCursor only re-evaluates on `mousemove`, so an attribute toggled by the render loop would lag until the next move.

Bridge options:
- (Simple) In the canvas `pointermove`, raycast and toggle `canvas.toggleAttribute("data-cursor-hover", hit)`. Per spec, `pointermove` dispatches before the compatibility `mousemove` for the same input, so CustomCursor sees the fresh attribute on that event. This handles mouse-driven hover only.
- (Robust) A tiny module store, like lib/soundtrack (`subscribe` plus `get`), or a `CustomEvent`, published by the scene each frame when the hit card changes. CustomCursor subscribes and sets `hovering` regardless of mouse motion. This handles the card spinning under a still cursor.
- Either way, CustomCursor stays REUSE-with-a-few-lines. The hit test must exclude invisible/back-facing cards ("excluded invisible cards from picking" in the spec) and stand down while a flight or modal is active. Also remember the dot sits at z-[100], above FlyingTile (z-[55]) and modals (z-50).

### 2h. HomeHero: what it reads from TileRing's context

Exactly two values from `useRingState()` (HomeHero.tsx:17): `phase` (only compared to "ready", 18) and `modalOpen` (51). From these it derives `heroVisible = ready && !modalOpen` and `interactive` (52-53). The default context is `{phase:"pre", modalOpen:false}` (TileRing 52-54), so SSR renders it hidden. So the coupling is only readiness plus modal-open, both of which move to the controller. HomeHero should consume the new controller context, or better, get them as props. HomeHero also owns its own DefinitionModal state and focus restoration (33-53).

What must change for the new hero: the h1 becomes "Hi, I'm" (small, Inter) plus "Aaron" (Profa Black) behind the canvas, with the accent-span hack `renderName` (85-101) using the literal "Aaron" (line 89) coupled to `home.name`; the tagline with definition triggers, the ScrollCue, and the `max-w-[60vmin]` ring safe-zone box all go or move (the hero is: name, helix, menu, one way into the list). SSR still has to server-render the greeting, per the spec.

### 2i. Soundtrack surface: where it mounts, and what a Listen dot needs

Mount points: app/page.tsx mounts Waveform, PlaybackPill (both self-Portal to body, z-0 and z-45) and ListenInvite (in-flow `#listen`). All three are home-only, so on `/work/[slug]` and `/recruiting` none is mounted. The store is lib/soundtrack.ts (`before | on | paused | off`, persisted to localStorage key `aaron-soundtrack`; `off` and `on` saved, `before` not; `initSoundtrackFromStorage()` seeds it as "paused" for a returning opted-in visitor, never autoplay). Menu is the only layout-level consumer today.

Gating today: PlaybackPill returns null on mobile or "off" (177); it reveals only once `#work` top is above 12 percent of viewport (110-115); Waveform bails at max-width 767 and returns null under reduced motion; ListenInvite renders null on mobile or when a choice existed at mount; Menu hides the music toggle on mobile.

What a Listen dot in the Menu pill would need:
1. Read `useSoundtrack()`. Hollow ring for paused/before/off-ish, filled pulsing dot for `on` (the decision: "hollow ring paused, filled pulsing dot playing"). Decide what "before" and "off" look like (the current pill glyphs: play triangle for before, flat line for paused).
2. Toggle inside a click handler (autoplay policy): `startSoundtrack()` / `pauseSoundtrack()` / `stopSoundtrack()`. `startSoundtrack` attaches the reconciler and calls `getSoundtrackPlayer().play()`.
3. Call `initSoundtrackFromStorage()` on mount, because the pill is layout-mounted and ListenInvite and PlaybackPill will not have run on non-home routes.
4. Layout-level mount means the audio player singleton (lib/audio.ts `getSoundtrackPlayer`) survives client navigation. Confirm it does not restart on route change.
5. Mobile: everything here is deliberately desktop-only today. Decide whether the dot appears on phones (the audio player itself is not desktop-specific; the visualizers are).
6. New copy strings for aria and tooltip (existing `menuToggleOn/Off`, `menuAriaLabelOn/Off` in `siteContent.soundtrack` can be reused).
7. Feedback: the Waveform is invisible in the hero, so the dot is the only feedback there. PlaybackPill's reveal gate would need widening if the expanded player should be reachable from the hero.
8. The pill needs a `--scrollbar-comp` right offset and a z-index relationship: currently Menu z-40, SiteNav z-30, PlaybackPill z-45, so the pill/panel must keep sitting under modals (z-50) and the cursor (z-100).

---

## 3. Raw hex and copy outside lib/content.ts (rule violations)

Hex in components:
- components/SiteNav.tsx:20 `fill="#1B3A5C"` and :28 `fill="#FAFAF7"` (the inline BrandMark; the only raw hex literals in components/ or app/*.tsx). Both are the light-theme accent and background, so the mark does not follow the dark theme.

Adjacent raw color literals (not hex, but raw palette):
- `rgba(255,255,255,…)` highlights and `rgba(10,10,10,…)` shadows in GlassTile.tsx:163-176, 260; FlyingTile.tsx:309, 388, 396; HoldingDeck.tsx:67, 107, 110; PlaybackPill.tsx:51 (`rgba(0,0,0,0.22)`); Menu.tsx:123; the three modals and EditDialog shadow classes; WorkSection.tsx:58; app/work/[slug]/page.tsx:53; recruiting Popover.tsx:97-98, RecruitingDashboard.tsx:201, FunnelSankey.tsx:93. These embed pure white and near-black, arguably at odds with "No pure #000 or #FFF".
- Waveform.tsx:~113-114 seeds fallback color triples `[136,136,136]` and `[127,168,201]` (the second equals the dark accent `#7FA8C9`); real values are re-read from the CSS tokens.
- lib/theme.ts has `#FAFAF7` / `#0E1419` for the meta theme-color tag (lib, not a component; unavoidable, but they mirror the tokens).

Copy strings embedded in components (should be siteContent):
- TileRing.tsx:2010 `aria-label="Home"`.
- MobileHome.tsx:659 `aria-label="Photo and work cards"`; :704 the caption "swipe to browse · scroll to continue" (and the "/" glue).
- PhotoModal.tsx:123 and WorkModal.tsx:148 "Tap outside to close" / "Press esc to close"; DefinitionModal.tsx:113 "Press esc to close"; WorkModal.tsx:76 `${item.title} preview`.
- GlassTile.tsx:125-126 "Open caption for …" and "… logo, open preview, …"; :116-118 alt suffix " logo" (also WorkModal.tsx:~118 and WorkSection.tsx:~62, app/work/[slug]/page.tsx).
- Menu.tsx:146 `aria-label="Site menu"`.
- SiteNav.tsx:10-12 the link labels "Work", "About", "Connect"; :145 "Primary"; :151 "Back to top".
- ScrollProgress.tsx:12-15 section labels; :167 "Section progress"; :197 `Jump to ${s.label}` (retiring).
- Holding.tsx:68 `aria-label="Where to find me"`.
- recruiting/Popover.tsx:110 `aria-label="Close"` (`siteContent.modals.closeAriaLabel` already exists).
- HomeHero.tsx:89 `const word = "Aaron"` (a literal that must stay in sync with `home.name`).
- app/layout.tsx:73 "Skip to content" (outside components/).
- Unused today: `siteContent.holding.deckAriaLabel` (HoldingDeck is `aria-hidden`).

## 4. Every backdrop-filter / backdrop-blur use

- components/GlassTile.tsx:197-198: `blur(7px) saturate(0.75)` on the explored frost veil, only when `frosted`. A plan-sanctioned exception to the ring ban; dies with GlassTile.
- components/PlaybackPill.tsx:49-50: `blur(16px)` in the shared `glass` style, applied to four surfaces (compact capsule, hint bubble, expanded card, prompt card), fixed z-45 over the page and the waveform canvas.
- components/Menu.tsx:123: trigger `backdrop-blur-md` (sanctioned). :152: full-viewport overlay `backdrop-blur-xl` (decided: the new panel has no blur).
- components/SiteNav.tsx:142: header `backdrop-blur-md`.
- components/PhotoModal.tsx:77, WorkModal.tsx:87, DefinitionModal.tsx:83: panel `backdrop-blur-xl` (sanctioned for modal panels).
- lib/modal.ts:185-193: animated `backdropFilter: blur(24px)` on the full-viewport dialog root for all three modals. This is the big one over a live canvas.
- components/TileRing.tsx:2154, 2162: the reduced-motion prev/next buttons `backdrop-blur-md` (dies).
- app/work/[slug]/page.tsx:77: the placeholder panel `backdrop-blur-md`.
- recruiting: Popover.tsx:124 (`backdrop-blur-sm`), EditDialog.tsx:188 (`backdrop-blur-xl`), FunnelSankey.tsx:93 (`backdrop-blur-md`).
- Comment-only mentions (no code): FlyingTile.tsx:322, GlassTile.tsx:155/185-188, DefinitionModal.tsx:32.

globals.css has none.

---

## 5. (1) Dependency graph, home page render tree from app/page.tsx

```
app/layout.tsx (S)
  head: themeInitScript (lib/theme)
  body:
    a.skip-link
    [!HOLDING_MODE] SiteNav (C)  -> lib/scroll; reads [data-state] (TileRing section) + #work/#about/#connect
    [!HOLDING_MODE] Menu (C)     -> lib/modal, lib/content, lib/scroll, lib/theme, lib/soundtrack
    CustomCursor (C)             -> no imports; listens to window mousemove
    {children} = app/page.tsx (S)

app/page.tsx
  HOLDING_MODE ? Holding (S) -> lib/content, lib/motion, lib/fonts, BrandIcons (S), HoldingDeck (C -> lib/content, lib/motion)
  else:
    Waveform (C)      -> lib/gsap, Portal, lib/audio, lib/soundtrack ; reads #work
    PlaybackPill (C)  -> Portal, lib/content, lib/audio, lib/soundtrack ; reads #work
    ScrollProgress (C)-> lib/scroll, Portal ; reads [data-state], #work/#about/#connect   [RETIRING]
    div.relative.z-10
      main#main
        div#hero-pin.z-20  (pinned by TileRing or MobileHome)
          TileRing (C) -> lib/content, lib/modal, lib/scroll, lib/motion, lib/gsap, lib/carouselGeometry,
                          ArcIndex, GlassTile, FlyingTile, PhotoModal, WorkModal, MobileHome, Portal
            RingStateContext.Provider {phase, modalOpen}
              section[data-state]
                div (heroContentRef)
                  {children} = HomeHero (C) -> lib/content, useRingState (TileRing), DefinitionModal (-> lib/modal, lib/content, Portal)
                desktop (mounted && !isMobile): 20 x TileSlot -> GlassTile (-> lib/content, next/image, framer) ; ArcIndex ; reduced-motion buttons
                mobile (mounted && isMobile): MobileHome (-> lib/gsap, lib/content, GlassTile)
            Portal -> FlyingTile (-> lib/content, lib/modal)   [only during a flight]
            PhotoModal (-> lib/modal, lib/content, Portal)
            WorkModal  (-> lib/modal, lib/content, Portal)
        ListenInvite (C) -> lib/content, lib/motion, Reveal, lib/soundtrack
        WorkSection (S)  -> lib/content, lib/motion, Reveal            #work
        AboutIntro (S)   -> lib/content, lib/motion, Reveal            #about
        WhoIAm (S)       -> ... Reveal, ReadAlong (C -> lib/gsap)      #who-i-am
        UpToNow (S)      -> ... Reveal, UpToNowList (C -> lib/gsap, lib/motion)   #up-to-now
        Connect (S)      -> lib/content, lib/motion, Reveal            #connect
      Footer (S) -> lib/content
Implicit (DOM-level, not imports):
  [data-state] (TileRing section)     -> SiteNav, ScrollProgress
  #hero-pin                           -> TileRing, MobileHome, Portal rationale
  #work                               -> Waveform, PlaybackPill, ScrollProgress, SiteNav, Menu, /work/[slug] back link
  [data-tile-slot=photo|work]         -> FlyingTile (owned by PhotoModal, WorkModal)
  [data-cursor-hover], a, button      -> CustomCursor
  --scrollbar-comp (lib/modal)        -> Menu trigger
  data-carousel on #hero-pin          -> nothing in-app; a headless-QA seam only
```

Import cycles: none (HomeHero imports TileRing; TileRing does not import HomeHero).

---

## 6. (2) TileRing-owned behaviors that must survive the rebuild (with line ranges)

1. **Readiness gating**
   - Internal phase machine `hidden | firstTile | stacking | shuffling | fanning | ready` (269), public mapping to `pre | entering | ready` (302-303), reduced motion starts at "ready" (279-281).
   - Timer-driven advance: kickoff rAF (713-721); firstTile to stacking (723-728); stacking to shuffling (730-735); shuffle interval and handoff (740-754); fanning to ready by a safety timer at `totalFanMs + 80` only (760-767); no `onAnimationComplete` is wired.
   - `scrollReady` (381), armed 520ms after ready, or immediately on fast start (617-630).
   - Context published: `RingStateContext.Provider value={{phase: publicState, modalOpen}}` (2007), `data-state={publicState}` on the section (2012).
   - Gates on activation: `phase !== "ready"` returns early (917), `flipEnabled` (2004), `proximityEnabled` (2094), `aria-hidden={phase !== "ready"}` on the stage (2039).
   - The pin-readiness invariant: the pin is created only after ready plus 520ms because "creating the ScrollTrigger pin reflows the hero subtree" (378-380, 1209-1211).
   - Consumers to re-point: HomeHero (17-18, 51), SiteNav (80-95), ScrollProgress (112-128).

2. **Scroll locks**
   - Entrance lock: `entranceLocked = !fastStart && !scrollReady` (390) into `useBodyScrollLock` (391), plus belt-and-suspenders non-passive `wheel` and `touchmove` `preventDefault` on window (396-405).
   - The lock itself is ref-counted in lib/modal.ts (14-52) so an overlapping Menu open cannot wedge the body.
   - Modal locks live in the modals (PhotoModal/WorkModal/DefinitionModal), not TileRing.
   - The desktop wheel is intercepted only while settled and over the cards (1562-1601, gate `carouselReach` 1459-1463). In the new design this becomes "wheel over the helix spins it, wheel outside scrolls the page", so it is re-implemented, not carried over.
   - Fast-start loads (reduced motion, or a deep reload) are never locked (383-389).
   - The mobile lock also comes from this same timer, not from MobileHome's clock.

3. **Modal selection**
   - State `selectedPhoto` / `selectedWork` (305-306), `modalFromCarousel` (311).
   - Set on activation in `handleTileClick` (954-955), or by `handleCarouselOpen` (1159-1163, no-flight mobile path).
   - `modalOpen` derived (1173), mirrored to `modalOpenRef` in a layout effect (1177-1179).
   - Close: `handleModalClose` (1118-1145) clears both selections and the carousel flag, and takes a no-flight early path (1122-1128).
   - Render: `<PhotoModal … renderMedia={modalFromCarousel}/>` and `<WorkModal …/>` (2205-2206), both permanently mounted.
   - `modalOpen` is exposed to HomeHero via context so the hero recedes (2007, HomeHero 51).

4. **Explored state**
   - Key `aaron-explored-tiles` in `sessionStorage` (42-44).
   - `explored: Set<string>` keyed by `tile.key` (334); imperative mirror `exploredRef` (339); write-arm guard so hydration is not clobbered (342, 365-376).
   - Hydrate once on mount (346-355); mark at MODAL CLOSE, not open, and only when a flight exists (1129-1139, so the mobile no-flight path never marks: 1122-1128).
   - Used by the panel status refresh (838-840, dies) and the card veil `frosted={explored.has(tile.key)}` (2099).
   - New requirements: usable by both drivers and by the DOM list; outline dot in the card's upper corner and never greyed (design decisions 2.9); the same storage key and scope (session, not local) can be kept.

5. **Focus restoration**
   - Refs `sourceButtonRef` and `restoreFocusOnCloseRef` (885-889).
   - `restoreSourceFocus` (891-902): only if the tile was keyboard-activated, focus on the next frame with `preventScroll` because a hidden button refuses focus.
   - Captured at click (926-927) from `TileCapture.button` and `wasKeyboard` (82-93), which GlassTile derives from `:focus-visible` (GlassTile 111, 132, 140-148).
   - Called from `handleModalClose` no-flight path (1126) and `handleClosingComplete` (1150-1153).
   - `focusCardButton` moves DOM focus to the arrow-key-stepped card (875-881, 1624-1626).
   - Plus a second mechanism in `useFocusTrap` (lib/modal.ts:118-152) that refocuses `document.activeElement` at open.
   - In the coil, the restore target must be the DOM list's button, since a canvas card has no button (spec: real `<ol>`, keyboard focus reveals a usable list, Enter opens, Esc returns focus). HomeHero has its own copy for the definition trigger (HomeHero 33-53).

6. **Deep-reload recovery**
   - Constants: `FAST_START_THRESHOLD_FRAC = 0.5` (40), `restoreTargetRef` (295), `skipEntrance` and `fastStart` (289-290).
   - The determination layout effect (632-680): takes manual `history.scrollRestoration`, re-asserts "manual" after every ScrollTrigger refresh (652-655), reads the hash (excluding "#main") and saved Y (`readScrollY`) to decide `deep` (657-665), and if deep sets `skipEntrance`, phase "ready", and `scrollReady` synchronously before paint (667-672). It uses `useIsoLayoutEffect` (35) to avoid the SSR warning.
   - Scroll persistence (685-708): rAF-coalesced `saveScrollY` on scroll and `pagehide` (lib/scroll.ts 44-60).
   - The restore itself, after the pin spacer exists: `applyRestore` with `getElementById(decodeURIComponent(hash.slice(1)))` (the "#123" ids are invalid selectors, so it must not use `querySelector`) then `scrollTo` fallback, plus `ScrollTrigger.update()` (1936-1955); re-landed after `document.fonts.ready` unless the user moved (1957-1982).
   - The first-frame clock renders AT the target so a deep reload lands settled with no eased catch-up (1649-1656).
   - Duplicate consumer: SiteNav's deep-link effect (SiteNav 72-97).
   - The spec keeps this ("deep-reload recovery" is an invariant). The scrub-model specifics in it die, but the fast-start branching, the manual restoration, and the post-pin restore do not.

7. **Device fork**
   - `mounted` and `isMobile` state (273-274); `matchMedia("(max-width: 767px)")` listener (486-493).
   - Render fork: desktop subtree only when `mounted && !isMobile` (2034-2169); `<MobileHome …/>` only when `mounted && isMobile` (2176-2183); SSR and first client render emit neither (2029-2033), which is why the hero is empty until hydration.
   - Separate GSAP contexts: desktop `mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)")` (1398) and reduced (1851); mobile matchMedia inside MobileHome (MobileHome ~386-397). Breakpoint 767 versus 768 is duplicated across Menu, ListenInvite, PlaybackPill, Waveform (767) and ReadAlong/UpToNowList (768).
   - The stated new model is "one object, two drivers" (and tablet portrait uses the phone driver, landscape the desktop driver), so this fork turns into a driver selection inside one scene.

8. **Flight orchestration** (TileRing-owned, needed by 2b)
   - `flight` state and shape (317-328).
   - `computeHomeRect` (962-995), `computeFlightSource` (1010-1079), `handleFlyOutComplete` (1084-1088), `beginClosing` (1096-1111), `handleClosingComplete` (1150-1153), resize re-measure (1173-1195), `flightActiveRef` (467, 613-615), `hiddenRingKey` (2000), `<Portal><FlyingTile/></Portal>` (2187-2203).
   - Rule from the spec: the pose rendered and the pose the flight uses must always be the same pose.

9. **Reduced motion**
   - `useReducedMotion` (272) and the reduced branch. The spec now says reduced motion renders the DOM list only, no scene, fade-only modals, and observes the preference live. The current arrow-key static arc and its buttons die.

Not worth keeping: the `data-carousel` attribute (1799-1804, 1862-1863; a QA seam nothing in-app consumes), the parallax and proximity springs, the snap tuning, the auto-advance idle clock, the `rasterHold` hack, `CAROUSEL`/`carouselGeometry` and its 303-line test (lib, not components/, but it retires with TileRing, and vitest is configured for `lib/**/*.test.ts` only).

---

## 7. Other things I noticed that will bite

- `SiteNav` and `ScrollProgress` use `document.querySelector("[data-state]")`, which returns the FIRST element with any `data-state`. Any new element earlier in DOM order carrying `data-state` would hijack it. Replace with an explicit signal.
- `app/page.tsx` z-order comments (lines 26-40) document the stack: SiteNav z-30, ScrollProgress z-[31], Menu trigger z-40, PlaybackPill z-45, modals/menu overlay z-50, FlyingTile z-[55], CustomCursor z-[100], `#hero-pin` z-20, content wrapper z-10, waveform z-0. The new fixed canvas and pill need slots in this scheme, and anything `fixed` inside the pinned hero is captured by the pin transform.
- The body scroll lock removes the scrollbar and adds `padding-right` (lib/modal.ts:30-36). A `position:fixed; inset:0` canvas would widen by the scrollbar width when a modal opens, causing a mid-flight canvas resize. Size the canvas from its container or honor `--scrollbar-comp`.
- HomeHero and the SSR path: TileRing SSR renders the hero content but at opacity 0 (phase "pre"), so first paint is empty. The spec wants a server-rendered greeting, list and painted fallback, so this changes.
- `siteContent.menu.items` has Home, Work, About but no Connect, while SiteNav and the design's header include Connect.
- `siteContent.homeTiles` has 20 tiles including 6 placeholder SVG photos. The spec says placeholders never appear in the list, and the Talos and min/Max entries do not exist in `workItems` or `homeTiles`.
- `docs/coil-hero-spec.md` and `docs/design-decisions-2026-09-28.md` (section 2.9, Aaron's 2026-09-29 green light) are the governing specs. Notable locks that affect components: no cursor parallax, no recoil, wheel over the helix spins it forever, curved cards, band-first entrance after the loader, shader background (Layer 1 already changed), and "MobileHome retires when the Coil ships".