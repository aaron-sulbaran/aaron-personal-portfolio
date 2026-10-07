# Coil build scaffold

Status: the architecture for the Coil rebuild, 2026-09-29, before any builder starts. Authority: `docs/design-decisions-2026-09-28.md` section 2.9 wins on design intent; this scaffold wins over `docs/coil-hero-spec.md` where they differ (its straighten-on-scroll journey, 8 degree tilt, cursor parallax, riffle entrance and greyed seen state are superseded); AGENTS.md Layer 1 wins on conventions until Aaron amends it (section 8).

Gitignored inputs, absent from every worktree; read them from the main checkout, never copy them in: `/Users/asulbaran21/Personal Projects/aaron-portfolio-website/AGENTS.md`, `.../docs/research/refresh-2026-09-27/scaffold-inputs/` (audits, hero lab 2 notes, vault recon), `.../prototypes/labs/hero-build-2/hero-lab-2.src.html` (the code to port), `.../labs/loader-lab.html`, `.../labs/menu-lab.html`.

## 1. Final build, in one page

One scrolling document at `/`, light and dark, one object with input drivers.

1. **Loader.** Always dark (`#0E1419`, paper letters, accent fill). Giant "Aaron" fills the pane, "Hi, I'm" above it in the canvas lockup's proportions (`COIL.lockup`); only the name fills, rising inside the letters as real assets resolve (fonts, scene chunk, strand textures, first field frame). Number top center, 12px, no status word, hidden if the load ends under about 600ms. Flash guard: the pane shows only after 250ms; under it, from first paint, the resting lockup already in the landed pose (the h1 held at opacity 0, still in the accessibility tree); a load ready sooner keeps that lockup until the scene has drawn, then hands it off in one frame (revised 2026-10-06, Aaron's warm-reload flash). The greeting takes the accent over the 150ms hold once the name is full. Continuity exit, 800ms site ease: the lockup shrinks and dims into its rest rect behind the helix as the background clears. Phone: name up the left edge, number in the right column. Reduced motion: name in accent, number counts, 300ms fade. Deep reloads skip it.
2. **Hero at rest.** The Dusk shader field; "Aaron" in Profa Black at 70 percent of the width (90 on narrow panes) behind the helix at about 12 percent ink, drawn in the canvas; "Hi, I'm" small above in Profa Black at `COIL.lockup.greetingCap` of the cap height; "Sulbaran" small in Inter from the middle of the "o" with a 1px halo (pending). The helix: a diagonal endless conveyor of curved 3:4 cards spanning the pane and leaving through two corners, idling slowly. On screen: name, helix, mark and Menu pill, and one quiet "List" control on the greeting's line flush with the name's right edge. No tagline, scroll cue or definition words.
3. **Entrance** after the loader exit: cards shutter out of a center stack into one closed band, hold a beat, then two hands pull it open (the seam parts along the axis first, then the band winds into the coil). Scroll locked for loader plus entrance, never on reduced motion or fast start.
4. **Interaction.** Hover lifts a card (scale, brightness), no tilt, no parallax. Click flies the card into its modal. The wheel over the helix spins it forever both ways with no delay; ownership is decided once per gesture (`docs/coil-input-model.md`); elsewhere the wheel scrolls the page. Fast input stretches the gap between turns (critically damped, no recoil). A caret nudges off the helix after 2.6s of captured wheeling. Seen cards carry a 1px outline dot in the upper corner, never greyed.
5. **Unwind egg.** Double-click open hero space: the helix unwinds in place into a list inside the hero (about 730ms); "Coil" or Esc winds it back.
6. **The book** (`#work`, directly under the hero, one desktop screen): Work (Talos, min/Max, Capital One, IEEE, Anthropic ambassador, Hackathon builds, This site) and Photos columns, text first: Profa title, Inter meta, outline dot when seen. Row hover glides its card to the front of the visible helix. Work rows are links to `/work/[slug]` (min/Max to its live URL); photo rows open the photo modal. Placeholders never appear.
7. **Surviving sections:** Listen invite (`#listen`, after the book), the waveform from there down, About (`#about`, WhoIAm, UpToNow), Connect, Footer. New type, same logic.
8. **Header H1, Menu M1.** During the hero: AS bolt mark top-left, Menu pill top-right; past the hero a bar (mark, Work About Connect, Menu) slides in with headroom. The pill holds a Listen button (hollow ring paused, pulsing dot playing). The pill grows into a right panel on the site ease, no blur, no overshoot, coil moving under a dim; Close lands where Menu was. Phone: bottom sheet with a grip. The left rail is gone.
9. **Case pages** `/work/[slug]` stay, restyled. **Holding mode** unchanged and default in production. **/recruiting** untouched.
10. **Drivers.** Composition by aspect (narrow when width/height < 0.8: axis at 0.3 of the angle, at most 6.2 cards per turn); input by capability (fine pointer: hover, pick, wheel capture; coarse pointer: time plus horizontal drag-to-spin). Vertical scroll is never hijacked. Tablet portrait composes narrow, landscape wide.

### 1.1 Hero values (source: hero lab 2 notes and `DEFAULTS` in the lab source)

Picked by Aaron on 2026-09-29 (decision record section 2.9). They live in one typed object, `lib/coil/constants.ts`; builders never retune them by eye.

| Item | Value (Aaron's pick) |
|---|---|
| O1 list integration | a2 Book plus (b) Unwind as double-click egg |
| O2 back | duotone: the photo tinted in the accent (`duoDark` / `duoLight` tokens), front true color |
| Work card front / back | our pane (`--card-work-pane`) with the logo in brand color (paper in dark) / same pane, no logo; brand-colored panes revisited once real logos land |
| O3 speed | Stretch, amount 0.6: turn gap times `1 + envelope`. Noted for later: stretch plus light, flare plus light |
| Palette | sea plus burnt orange (`#p=ut` preset) with the orange reduced to about 20 percent of the field, never 50/50; light and dark both approved |
| Name fill | a gradient inside the letters, about 12 percent ink; explore a grain gradient in the fill during slice 3 (grain lives only inside the name, never on the field) |
| Sulbaran | off (no surname anywhere in the hero) |
| Axis, cards per turn, turn gap | 33 degrees, 8, 1.5 card heights |
| Card height, curvature, gap | 24 percent of viewport, 0.7, 0.05 card widths |
| Idle, spin cap | 0.09 cards/s, 12.5 cards/s |
| Entrance | 1800ms; stack in 0.05, shutter from 0.06 at 0.011 stagger, fly 0.22, pull from 0.58; pull curve (0.55, 0, 0.25, 1) |
| Camera | FOV 26, lean -12 degrees, band lean -22 degrees |
| Wheel | one exponential stage, lambda 11 (about 90ms), 0.0045 cards/px; page scroll does not turn the coil (Aaron, 2026-10-06) |
| Capture | per gesture: the helix silhouette (gaps included), hero at least half in view, no intent delay, released only by a real pointer move outside; chevron nudge at 2.6s. Superseded rules: cards only, 400ms intent, top of page only (see `docs/coil-input-model.md`) |
| Hover-jump, unwind | 600ms site ease; 580ms per card, 8ms stagger |
| Strand fit | repeats fill the pane (M slots over N cards) |
| Mark, light panel dim | 32px, 30 percent |

## 2. Stack after the rebuild

| Layer | Choice | Owns |
|---|---|---|
| Framework | Next 16.2.x App Router, Turbopack, `proxy.ts` | routing; SSR of greeting, book, sections |
| UI | React 19.2 | semantic state only, no per-frame React state |
| Language | TypeScript 5.9 strict | |
| CSS | Tailwind 3.4 (not 4) + CSS tokens | DOM styling |
| DOM motion | Framer Motion 12 | modals, FlyingTile, menu content, DOM entrances |
| Scroll, timelines | GSAP 3.15: ScrollTrigger, Observer, SplitText, CustomEase (free, in `gsap`) | hero visibility and progress, loader timeline, touch drag, shared eases |
| Scene | vanilla `three` r169+ with matching `@types/three`, no R3F | canvas, field, cards, picking |
| Tests | vitest 4 | pure `lib/**` math |

One rule per pair: GSAP owns scroll progress, three consumes it and never writes scroll. Framer never touches the canvas or its transforms. GSAP and Framer never drive the same property on one element. No Lenis, no virtual scroll. Wheel capture is a raw non-passive listener on the hero, decided per event (the lab's pattern); Observer is for touch drag only.

## 3. Module layout

```
app/page.tsx              # flag fork; coil order: hero, Book #work, ListenInvite #listen, AboutIntro, WhoIAm, UpToNow, Connect, Footer
app/layout.tsx            # Inter + profaBlack.variable on <html>; no Instrument Serif or Space Grotesk; mounts SiteNav, MenuPill
app/globals.css           # font-synthesis:none, shader/card/loader tokens, .reveal-mask retune
tailwind.config.ts        # fontFamily.display, serif alias to display (recruiting), display-name size
app/work/[slug]/page.tsx  # async params (0), type (2)
app/recruiting/{edit,refresh}/route.ts  # revalidateTag(tag, { expire: 0 }) only (0)
proxy.ts                  # was middleware.ts; export proxy, same matcher
next.config.mjs           # images.qualities [75, 88, 90]; transpilePackages ["three"]
eslint.config.mjs         # flat config (core-web-vitals + typescript); .eslintrc.json deleted
vitest.config.ts          # "@" alias
lib/flags.ts +test        # HOME_HERO from NEXT_PUBLIC_HOME_HERO; "ring" until slice 9
lib/fonts.ts              # profaBlack variable "--font-display"
lib/content.ts            # strand, book rows, Talos, min/Max, card labels, menu Connect, hero copy, sentence case
lib/home/readiness.ts     # store pre|entering|ready + data-home on <html>; replaces [data-state]
lib/home/seen.ts          # store over sessionStorage "aaron-explored-tiles"
lib/home/recovery.ts      # fast start and restore, ported from TileRing 40, 289-295, 632-708, 1936-1982
lib/cursor/hover.ts       # scene publishes hovered card; CustomCursor subscribes
lib/coil/geometry.ts +test  # solve, coilPose, strand slot->u->index mod N, end fade, silhouette, projectQuad
lib/coil/motion.ts +test  # conveyor (smoothing, cap, idle, wheel, page), envelope, glide
lib/coil/entrance.ts +test  # pose modifier, identity until slice 4
lib/coil/unwind.ts +test  # latch + unwind modifier, identity until slice 5
lib/coil/drift.ts +test   # shaderDrift ping-pong from min/Max
lib/coil/field.glsl.ts    # noise, fbm3, field, composite (name masks, explicit LOD, dither)
lib/coil/material.ts      # card bend vertex; fragment: backs, seen ring, shade, sheen, bright, fade
lib/coil/textures.ts      # paint card canvases from tokens; image URLs from next/image getImageProps
lib/coil/theme.ts         # tokens -> uniforms and paints; MutationObserver on data-theme
lib/coil/constants.ts     # table 1.1
lib/coil/drivers.ts +test # composition and input selection
lib/loader/progress.ts    # truthful weighted tally
components/home/HomeController.tsx  # C: readiness, locks, modal selection, seen, focus, recovery, flight, drivers, reduced motion
components/home/HeroText.tsx  # S: h1 "Hi, I'm Aaron" (+ Sulbaran); visible without a scene, visually hidden with one
components/coil/CoilStage.tsx # C: hero section, poster, boundary, import(CoilScene) after first paint
components/coil/CoilScene.tsx # C: renderer, passes, loop, input, picking (dynamic chunk)
components/coil/CoilErrorBoundary.tsx  # C: poster, one remount
components/coil/HeroOverlay.tsx  # C: List and Coil controls, Sulbaran, nudge, unwind list layer
components/book/Book.tsx  # S: <section id="work">, two <ol> (adapts WorkSection)
components/book/BookRow.tsx  # C: link or button, hover-jump, seen dot
components/loader/Loader.tsx  # C: SSR-armed overlay, guard, continuity exit
components/menu/{MenuPill,MenuPanel,ListenDot}.tsx  # C: M1 pill and panel, phone sheet, Listen (logic from Menu.tsx)
components/SiteNav.tsx    # H1 bar, AS bolt, sentence case, readiness store, sentinel reveal
components/FlyingTile.tsx # projected-quad source and home; face from the card canvas
components/{PhotoModal,WorkModal,DefinitionModal}.tsx  # copy to content, type
components/CustomCursor.tsx  # subscribes to lib/cursor/hover
components/{Waveform,PlaybackPill}.tsx  # trigger #listen, not #work
components/ListenInvite.tsx  # always renders the #listen wrapper
public/coil/field-{light,dark}.avif  # posters at the tuned drift time
```

Retire in slice 9, after the flip: `TileRing`, `MobileHome`, `GlassTile`, `ArcIndex`, `HomeHero`, `Menu`, `WorkSection`, `lib/carouselGeometry.ts` and test, the `#hero-pin` wrapper, `siteContent.home.panel*`. `ScrollProgress` retires in slice 6. `HoldingDeck` stays (the holding page is unchanged). Aaron archives branch `design-exploration` as a tag; it is never merged.

## 4. Contracts that survive

- **Portal to body** for every fixed overlay (modals, FlyingTile, PlaybackPill, Waveform, Loader, menu scrim).
- **Ref-counted scroll lock** (`lib/modal.ts:14-52`) for entrance, Menu and modals; it writes `--scrollbar-comp` (`lib/modal.ts:34`), read as a right offset by the pill, bar and modal close buttons.
- **Canvas sized from its container**: `position:absolute; inset:0` in the 100svh hero, sized by ResizeObserver, not the viewport. A deliberate change from the lab's fixed full-screen canvas: with no scroll-straighten nothing leaves the hero, so the lock's padding cannot resize it mid-flight, the one-frame lag and scissor go, and `uHeroShift` is dropped.
- **Explicit readiness**: `lib/home/readiness.ts` replaces `[data-state]` (TileRing.tsx:2012, read by SiteNav.tsx:80-95 and ScrollProgress.tsx:112-128 through first-match `querySelector`). Consumers: SiteNav, HeroOverlay, the entrance lock. Other routes never wait. TileRing publishes to it until it retires.
- **`#work`** stays on the book (Menu, SiteNav, `/#work` back link, `next.config.mjs` redirects). Waveform (Waveform.tsx:~226) and PlaybackPill (110-115) move to `#listen`.
- **`[data-tile-slot]`** on modal media slots (PhotoModal.tsx:102, WorkModal.tsx:105), polled by FlyingTile.
- **`[data-cursor-hover]`** for DOM targets; the canvas publishes hits to `lib/cursor/hover.ts` because cards spin under a still cursor (components audit 2g). The canvas never sets a CSS cursor.
- **Modal blur only over a frozen scene**: `lib/modal.ts:185-193` blurs the dialog root, so the scene stops rendering before a modal activates. The Menu panel has no blur; the scene keeps moving.
- **Rendered pose equals flight pose**: freeze, project the card's four bent corners to viewport px plus the canvas rect, hide only that mesh once the clone mounts. FlyingTile animates a progress value and writes a `matrix3d` homography from the lerped quad to the slot; the home quad is recomputed from the frozen pose at close and on resize. The clone draws the card's own front canvas. No-flight paths set `renderMedia`.
- **Deep-reload recovery** (TileRing.tsx:40, 632-708, 1936-1982): manual `scrollRestoration`; hash via `getElementById(decodeURIComponent(...))`, else saved Y; fast start past 0.5 viewport (no loader, entrance or lock); re-land after `document.fonts.ready` unless the user moved. SiteNav's duplicate handler goes.
- **Seen** marks at modal close on flight and no-flight paths (the old mobile path never marked, TileRing.tsx:1122-1128) and on a work-row click.
- **Focus** returns to the originating row or control (`preventScroll`); canvas `aria-hidden`; the book is the accessible list; no card is a tab stop.
- **Reduced motion**, live: no scene and no three import; poster, DOM h1, book; fade-only modals.
- **No `backdrop-filter` in the scene.** Allowed: modal panels, the pill, PlaybackPill.
- **Theme via tokens**: uniform colors hex, canvas paints hex or `rgba()`, never `var()` or `color-mix()`; `ColorManagement.enabled = false` and linear output so hex maps 1:1; MutationObserver on `data-theme` updates uniforms and repaints at most 4 cards per frame into fresh textures, disposing old ones.
- **Failure**: boundary around the chunk; poster and DOM h1 on failure; context loss shows the poster and remounts once, a second loss stays; a rejected photo paints the plain pane; the loader gives up at 6s.
- **Dispose** geometries, materials, textures, render target, renderer, listeners, observers.
- **Render only when needed**: not while hidden, off screen (IntersectionObserver), frozen, or reduced; the field pass only when its clock moves.
- **Clocks in seconds** (the Waveform `t/1000` invariant holds for the scene).
- **Z scale** (app/page.tsx:26-40): waveform 0, content 10 (hero and canvas inside), SiteNav 30, scrim 35, pill and panel 40, PlaybackPill 45, modals 50, FlyingTile 55, loader 60, cursor 100.

## 5. Slices

One branch off `coil` per slice, one PR into `coil`. Verification for every slice:

```
pnpm tsc --noEmit && pnpm lint && pnpm test
NEXT_PUBLIC_SITE_MODE=full NEXT_PUBLIC_HOME_HERO=coil pnpm build && pnpm start -p 31NN   # NN = slice
pnpm build && pnpm start -p 32NN        # holding default: / is the holding page, no three chunk
perl -e 'alarm 60; exec @ARGV' agent-browser --session coil-sNN <command>   # one command per call; finish with `--session coil-sNN close`, never `close --all`
```

A plain `pnpm build` is holding mode (no env file sets full for builds). Before slice 0, merge `main` into `coil` (it lacks 1b81d6c and this file).

**0. Upgrade** (8h). `package.json`, lockfile, `next.config.mjs`, `tsconfig.json`, `proxy.ts`, `eslint.config.mjs`, `app/work/[slug]/page.tsx:12-34`, `app/recruiting/edit/route.ts:34`, `refresh/route.ts:35`, `ArcIndex.tsx:20-27`, `BrandIcons.tsx:42`, `lib/holding.ts` comment, `lib/content.ts:526`. Codemod `npx @next/codemod@canary upgrade latest`, the React 19 types recipe, then the manual items in the app-lib audit section 2. Done: Next 16.2.x, React 19.2, `lint` is `eslint .`, `engines.node >= 20.9`; route tables (full and holding) saved to the scratchpad before and after, identical but the proxy line; recruiting unlock and 404 unchanged; the ring home, modals, Waveform and PlaybackPill pass a browser pass.

**1. Controller and geometry, nothing visible** (8h). `lib/flags.ts`, `lib/home/*`, `lib/coil/{geometry,motion,drift,constants}.ts` with tests, `HomeController`, `HeroText`, `Book` and `BookRow` (static), `app/page.tsx`, content schema with current data, `vitest.config.ts`, readiness wiring in SiteNav and TileRing. Extract by porting, not refactoring in place: HomeController reimplements components audit section 6 (readiness 269-303 and 713-767, locks 383-405, modal selection 305-311 and 1118-1179, explored 42-44 and 334-376, focus 82-93 and 885-902, recovery, flight state 317-328, fork 273-274 and 486-493) for the coil path; TileRing stays intact behind the ring flag. Done: with the coil flag, view-source of `/` shows the h1 and book; readiness reaches `ready`; deep links land; book rows open modals with `renderMedia`. Tests: slot index mod N for negative X, M even and at least N, narrow solve, pose continuity across the wrap, silhouette, projectQuad, speed cap, idle, no envelope overshoot.

**2. Tokens and type** (6h). `globals.css`, `tailwind.config.ts`, `layout.tsx`, `lib/fonts.ts`, SiteNav mark, and every surviving public file using `font-serif`, `italic`, `tracking-caps` or grotesk (AboutIntro, Connect, Footer, ListenInvite, UpToNow, UpToNowList, WhoIAm, the three modals, PlaybackPill 312/401/517/550, error, not-found, work/[slug], Holding). Skip retiring files and all recruiting files (they render through the `serif` alias). Tokens, light / dark: `--shader-top #AFC8E0 / #090E13`, `--shader-bottom #F3E8DC / #142537`, `--shader-glow #D98B55 / #8A4015`, `--shader-second #AFC8E0 / #2E5475`, `--card-pane #EFF1F1 / #1A232B`, `--card-work-pane #F7F7F3 / #18212A`, `--card-hair rgba(10,10,10,0.18) / rgba(245,242,236,0.16)`, `--card-hi rgba(250,250,247,0.75) / rgba(245,242,236,0.09)` (paper, not the lab's white), `--card-veil rgba(243,245,245,0.56) / rgba(17,24,30,0.56)`, `--card-recede 0.3 / 0.5`, `--card-sheen 0.10 / 0.07`, `--name-ink 0.12`, and theme-fixed `--loader-bg #0E1419`, `--loader-name #F5F2EC`, `--loader-fill #7FA8C9`, `--loader-muted #8A8A8A`. Shader and card tokens stay out of Tailwind. The AS bolt from `public/brand/` replaces the raw hex at SiteNav.tsx:20,28. Done: no serif, italic, tracked caps or grotesk outside retiring and recruiting files; Profa upright everywhere; holding and /recruiting differ only in heading face.

**3. Scene** (16h, parallel with 6). `lib/coil/{field.glsl,material,textures,theme}.ts`, `entrance.ts` and `unwind.ts` as identity seams, `components/coil/*`, `lib/cursor/hover.ts`, `CustomCursor.tsx`, `package.json` (+ `three`, `@types/three`). Port from the lab source: renderer 518-531, field 533-577 (one third resolution), composite 579-631 without `uHeroShift`, card shaders 634-693, painting 391-516, `solveGeometry` 753-805, `coilPose` 1021-1047, `layoutName` 827-861, conveyor and envelope 1122-1151, slot loop 1196-1256, picking 1288-1297, nudge 1299-1315, `overHelix` and wheel 1370-1394 plus hover intent. DPR cap 1.75, textures 384x512. Done: the rested helix matches the `#p=rest` and `#p=dark` shots side by side; idle, capture (top of page only, released on exit, page never moves while captured), stretch, hover, seen dot; p99 frame time at most 16.8ms, zero backward frames on a trackpad flick, top speed under 0.5 cards per frame; three absent from initial JS; a theme toggle repaints without a stall.

**4. Loader and entrance** (8h). `components/loader/*`, `lib/loader/progress.ts`, `lib/coil/entrance.ts` + test, the CoilScene wiring block, HomeController lock timing, loader copy. Port `loader-lab.html` 205-384 and the lab entrance 1084-1086, 1156-1166, 1219-1237. The loader lockup (greeting and name) lands on the canvas lockup rect and hands off in one frame; it tweens to the composite color there. The entrance starts when the exit ends (up to 250ms overlap allowed on the specimen). Done: cached, normal and slow runs; no loader under 250ms; no number under 600ms; band ends never cross; reduced and fast-start paths; the lock releases exactly once.

**5. Book, List, unwind, flight** (12h). `components/book/*`, `HeroOverlay.tsx`, `lib/coil/unwind.ts` + test, the CoilScene wiring block, `FlyingTile.tsx`, `ListenInvite.tsx`, trigger lines in Waveform and PlaybackPill, modal copy. Port hover-jump 1412-1432, unwind 1088-1097, 1258-1286, 1318-1325, overlays 1327-1360, the lab's `.bookGrid` and `.brow` CSS. Done: List scrolls to `#work` (instant under reduced motion); row hover glides the nearest copy to center; double-click unwinds, Coil and Esc return; a curved card flies into both modals and back with no pop at either end; mid-flight resize lands; keyboard rows, Enter, Esc with focus return; seen persists per session. 4 and 5 run in parallel only if each keeps CoilScene edits inside its own wiring block.

**6. Header, Menu, rail** (8h, parallel with 3). `components/menu/*`, `SiteNav.tsx`, `layout.tsx`, `page.tsx` and `ScrollProgress.tsx` (delete), menu and nav copy with Connect, and only the `top-16` offset in `RecruitingDashboard.tsx:~183-190` if the bar height changes (flag it). Port `menu-lab.html` M1 and H1: panel `max(440px, 34vw)` by `100vh - 32px`, radius 20, 600ms site ease, links a third down; sheet 8px insets, 82dvh, radius 26, 36x4 grip. Keep Menu.tsx behaviors (hooks, route close, close then double rAF then `navigateToSection`, theme toggle with `syncThemeColorMeta`). Done: works on `/`, case pages, /recruiting; Esc, focus trap, no jump from `--scrollbar-comp`; the Listen dot shows the right state on a case page for a returning visitor; the bar appears past a hero sentinel.

**7. Touch drivers, reduced motion, failure** (10h). CoilScene input block, `lib/coil/drivers.ts` + test, CoilStage, boundary, posters. Coarse pointer: `touch-action: pan-y`, Observer horizontal drag with axis lock, no wheel or hover, textures 256 to 384px, DPR cap 2; narrow composition shows every card with no repeats. Done: a vertical swipe starting on a card scrolls; orientation change rebuilds; live reduced-motion toggle tears down and back; `WEBGL_lose_context` shows the poster and remounts once; a thrown scene leaves the book working; checked on Aaron's iPhone and a mid-range Android.

**8. Content** (4h plus Aaron, beside 3 to 7; values only, never keys). `lib/content.ts`, `public/photos/`, `public/work/logos/`. Talos, min/Max, logos, sentence-case titles and meta ("Capital One, product intern, 2025"), first-person alts, placeholders out of strand and book. Whatever Aaron has not supplied is listed in the PR.

**9. Gate, review, flip** (8h). The coil hero spec's gate plus: capture never traps; a 10 minute theme-toggle soak on real hardware; deep reload at `#about` and `#connect`; holding build ships no three bytes; /recruiting route table unchanged; Lighthouse and bundle; resemblance check against pacomepertant.com and aikawakenichi.com. Then design review, Fable and Codex review, flip `HOME_HERO` to `coil`, delete retiring files in their own commit, and propose the AGENTS.md diff.

Order: 0, 1, then 2 (8 may start); then 3 with 6; then 4 and 5; then 7; then 9. About 88 agent-hours.

## 6. Builder agent rules

From the build rules (decision record section 10): worktree per slice, branch from `coil`, PR into `coil`, never push `main` (the `coil` to `main` merge is Aaron's, once); nothing may trigger a Vercel production build (`vercel.json` skips previews; verify on a local production build, never a preview or `vercel deploy`); small commits, one logical change each, reviewed by Fable and Codex, never squashed; never `pnpm dev` and `pnpm build` in one checkout at once; agent-browser only, after reading `~/.claude/snippets/browser-policy.md`, one session per builder, at most two builders browsing, `--session coil-sNN`, 60s per command, skip on hang, close only your own session, never `close --all` (it kills every other agent's browser).

Added: `pnpm install` in the worktree; gitignored inputs read from the main checkout; report as text, no `.md` reports or notes in the repo; no AGENTS.md edits (Layer 2 only in slice 9, never Layer 1); no dependencies beyond `three`, `@types/three` and the slice 0 set; no em dashes in copy, comments or commits; sentence case; copy only in `lib/content.ts`; tokens only, no hex in components; first-person alt text; Server Components stay server; values from `lib/coil/constants.ts`, never retuned by eye.

Stop and ask Aaron, through the orchestrator, before: a Layer 1 change; a new dependency; any visual or motion deviation from the labs or table 1.1; touching `components/recruiting`, `app/recruiting`, `lib/recruiting` or `proxy.ts` logic beyond slice 0; changing the holding page; deleting a route or a content key something reads; leaving the slice's file list.

## 7. Open items

| Item | Effect | Owner |
|---|---|---|
| Hero lab 2 picks: O1, O2 and curvature, O3, work front and back, Sulbaran, palette, name fill and weight, axis, cards per turn, card height, idle, entrance length, hover intent | defaults ship; picks are constant edits | Aaron |
| Six missing photos, or a strand of real cards only with repeats | degrades every frame; default drops placeholders | Aaron |
| Real logo files and brand colors (Capital One, IEEE, Anthropic, min/Max, Talos, Hackathons) | work fronts | Aaron |
| Talos copy (page or coming-soon row), min/Max live URL | slice 8 | Aaron |
| Burnt orange (`--shader-glow`) and the Layer 1 line allowing a shader second hue; without it Sea ships | slice 3 | Aaron |
| Sulbaran yes or no | slice 3 | Aaron |
| Production on a `release` branch or `main`; keep or drop `vercel.json` at the final merge | the flip | Aaron |
| "This site" back: plain work back (default) versus AS-consistent (mark mirrors, ruled out) | slice 3 | Aaron |
| `capital-one-ba`: own row, or folded into Capital One (default: page kept, no row) | slice 8 | Aaron |
| DefinitionModal has no home on the coil hero (default: unmounted, keys kept) | slice 9 | Aaron |
| ListenInvite after the book, or retired for the Listen dot; Listen dot on phones | slices 5, 6 | Aaron |
| `main` into `coil` before slice 0 | all | Aaron or orchestrator |
| Real-device checks | slices 7, 9 | Aaron |

## 8. AGENTS.md changes to propose (not applied)

Layer 1, only on Aaron's instruction:
- Stack: Next 16, React 19.2; Animation adds vanilla three and the GSAP plugins; Fonts: Profa Black display site-wide via `lib/fonts.ts` (`--font-display`), Inter body, Instrument Serif and Space Grotesk retired, italic clause gone; Auth, Storage, Rate limiting and every "no backend, no user input surfaces" line corrected for /recruiting (HMAC cookie in `proxy.ts`, POST routes, GitHub API, two secrets).
- Typography: sentence case, no tracked caps, numbers only on the case rail, `font-synthesis: none`.
- Aesthetic guardrails: one UI accent, a second hue in the shader field only (the exception loses "tones of the one accent"); glass paragraph: the Coil's cards are opaque WebGL panes that recede by brightness, no `backdrop-filter` in the scene, Menu panel unblurred, the pill and modal panels keep theirs; nav paragraph becomes H1.
- "Desktop and mobile are separate home experiences" becomes "One object, two drivers": one scene, composition by aspect, input by capability, reduced motion renders the book.
- Source-of-truth docs: fix the three dead paths (in gitignored `docs/plans/`), add the decision record and this scaffold, mark the coil hero spec partly superseded.
- Conventions: Server and client lists; CoilScene size budget replaces the TileRing and MobileHome exceptions; Context7 for Next 16; `pnpm lint` is `eslint .`; the local full build needs `NEXT_PUBLIC_SITE_MODE=full`.

Layer 2 rewrite (AGENTS.md is 39,983 characters, 40,286 bytes: no headroom):
1. Archive first: append Architecture, Current build state (with the ring-era invariants), Environment and What's next verbatim to `AGENTS_ARCHIVE.md` under `## Archived <flip date>`.
2. Architecture from section 3, final paths only.
3. Current build state: the Coil live on `coil` and then `main`; invariants from section 4; drift fixed (file sizes, design-exploration files, recruiting lists, tests list).
4. Environment: `NEXT_PUBLIC_HOME_HERO` while it exists.
5. What's next from section 7.
6. Show both diffs; apply on Aaron's yes.
