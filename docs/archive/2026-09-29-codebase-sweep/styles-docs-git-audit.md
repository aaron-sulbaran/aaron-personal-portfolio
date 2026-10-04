# Read-only audit: styles, docs, git (main @ f49fb61, 2026-09-29)

Produced by a read-only Explore agent for the Coil rebuild scaffold. Companion audits: `components-audit.md`, `app-lib-upgrade-audit.md` (same folder, when they land).

## 1. Styling and tokens

### 1A. CSS custom properties (`app/globals.css`, 243 lines)

`:root` = light; `[data-theme="dark"]` overrides.

| Name | Light | Dark |
|---|---|---|
| `--color-background` | #FAFAF7 | #0E1419 |
| `--color-foreground` | #0A0A0A | #F5F2EC |
| `--color-muted` | #6B6B6B | #8A8A8A |
| `--color-accent` | #1B3A5C | #7FA8C9 |
| `--color-accent-hover` | #24496F | #9AC0DD |
| `--color-border` | #E5E5E0 | #1F2830 |
| `--color-glass` | rgba(255,255,255,0.6) | rgba(20,25,30,0.5) |
| `--color-glass-strong` | rgba(255,255,255,0.78) | rgba(20,25,30,0.72) |
| `--scrollbar-comp` | 0px (runtime, `lib/modal.ts:34,45`) | same |
| `--ease-out` | cubic-bezier(0.22,1,0.36,1) (mirrors `EASE` in `lib/motion.ts`) | same |
| `--viz-lane-1..3`, `--viz-warm`, `--viz-cool`, `--viz-node` | recruiting data-viz encodings, see globals | |

Runtime-only vars: `--reveal-i` (`revealIndex()`), `--read-pos` (ReadAlong). Font vars come from `next/font` classes on `<html>`, not globals. No font/type-scale/reveal indirection layer exists on main (only on `design-exploration`). Base rules: `html` color-scheme + `scroll-behavior: smooth`; body Inter features cv11/ss01/ss03 + 250ms bg/color transition; `::selection`, `:focus-visible` 2px accent, `.skip-link`, `html.cursor-none` under `pointer: fine`; `.scrollcue-bob`; `.chip-*` (recruiting).

### 1B. Tailwind (`tailwind.config.ts`, 53 lines)

Colors are `var()` maps of the tokens above. `fontFamily`: `serif` = `--font-serif`, `sans` = `--font-sans`, `grotesk` = `--font-grotesk`. `fontSize`: `display-sm` clamp(3rem,8vw,4.5rem); `display` clamp(3.5rem,10vw,6rem); `display-lg` clamp(2.75rem,9vmin,6.25rem) (sized to the old ring safe zone); `section` clamp(2rem,5vw,3.5rem); `body-lg` 1.25rem. `letterSpacing.caps` 0.14em (33 usages of `tracking-caps`). `screens.xs` 400px. Arbitrary sizes bypassing the scale: `text-[clamp(4rem,10vw,8rem)]` (AboutIntro, WorkSection), `text-[clamp(3rem,8vw,6rem)]` (`app/work/[slug]/page.tsx:66`), `text-[clamp(2.5rem,5vw,4.25rem)]` (ListenInvite), `text-[clamp(2.75rem,5vw,4.5rem)]` (ArcIndex). Config edits do not hot-reload.

### 1C. Fonts

`app/layout.tsx` loads Inter (`--font-sans`), Instrument Serif 400 normal+italic (`--font-serif`), Space Grotesk 400/500/700 (`--font-grotesk`). Profa Black loads in `lib/fonts.ts` via `next/font/local` (weight 900, no `variable` option, so className only); used by `Holding.tsx:45` and `app/recruiting/page.tsx:48` only. Instrument Serif still renders everywhere else: 32 `font-serif` usages in 24 files, 38 `italic` usages, inline `var(--font-serif)` at `PlaybackPill.tsx:401,550`, `var(--font-grotesk)` at `PlaybackPill.tsx:312,517`, `font-grotesk` at `Menu.tsx:190`, hardcoded Instrument Serif in the SiteNav SVG `SiteNav.tsx:25`. `app/fonts/` has 10 files on disk; only `ProfaTrial-Black.ttf` is tracked (gitignore allowlist); the 9 others (Doxent, Groste, Phonk demo, Profa Regular/Bold, Scaver x4) are untracked and unused.

### 1D. Reduced motion

Global CSS forces 0.001ms animations/transitions and `scroll-behavior: auto`; this does not stop rAF/canvas/WebGL loops, so a shader canvas needs its own gate. JS: Framer `useReducedMotion` in ReadAlong, HomeHero, HoldingDeck, Waveform, ScrollProgress, FlyingTile, Menu, WorkModal, PlaybackPill, TileRing; GSAP matchMedia in TileRing (explicit reduce branch ~line 1851) and MobileHome.

### 1E. Named classes

`.reveal-item` / `.reveal-mask` (globals 121-147, inside no-preference; armed by `<Reveal>`; 0.6s/0.7s, `--reveal-i * 60ms`; the mask padding 0.12em exists for italic serif ascenders, re-tune for Profa). `.read-along` (154-165; gradient clipped to text; GSAP scrubs `--read-pos`). `.holding-rise` (200-220). `eqbar` keyframes (169-177; inline in `PlaybackPill.tsx:691`). `lib/motion.ts` comment says 70ms stagger, CSS uses 60ms.

### 1F. Dev-only variant machinery

None on main. On local-only branch `design-exploration` (3 commits 2026-07-18: `69a08c7`, `4efd2ad`, `0936da6`, not on origin): `app/design-variants.css` (5 font variants), `lib/design.ts`, `lib/useDesignVariant.ts`, `components/DesignPanel.tsx`, layout loads 5 local fonts, globals adds the indirection vars (`--font-display/body/label`, `--text-*`, `--lh-*`, `--ls-*`, `--text-mega`, `--reveal-*`). Predates the recruiting merge; would delete `--viz-*`, `.chip-*`, `.holding-rise` if merged. Only the indirection pattern is worth cherry-picking.

### 1G. What the rebuild adds or changes

Profa Black site-wide (Instrument Serif and Space Grotesk retire):
1. `lib/fonts.ts`: add `variable: "--font-display"`; put `profaBlack.variable` on `<html>`; remove Instrument Serif and Space Grotesk imports and classes; keep Inter.
2. `tailwind.config.ts`: `fontFamily.serif` -> `var(--font-display)` or rename to `display` and change the 32 usages; remove `grotesk`.
3. Replace inline `var(--font-serif)` / `var(--font-grotesk)` in PlaybackPill (4), `Menu.tsx:190`, `SiteNav.tsx:25`.
4. Strip 38 `italic` usages; add `font-synthesis: none`; audit 62 `font-medium/semibold/bold` usages that land on the display face.
5. Re-tune the type scale for a heavy wide face: `display-lg` is vmin-tuned to the old ring; the name behind the coil (~70vw) needs a new token (`display-name`); fold the arbitrary clamps into tokens; revisit `.reveal-mask` padding and letter-spacing; `tracking-caps` (33 uses) conflicts with the no-tracked-caps decision.
6. Trial font files: leave ignored or delete locally; keep the `!app/fonts/ProfaTrial-Black.ttf` allowlist (Vercel git build fails without it).

Shader hero background: no three/ogl/shader dependency on main. Existing background is `Waveform.tsx` (body Portal canvas z-0) which reads `--color-muted` / `--color-accent` via `getComputedStyle` and accepts only `#` hex (`Waveform.tsx:126-129`, `hexToRgb`); re-reads on a `data-theme` MutationObserver. Any token a canvas/shader reads must be hex, not rgba/color-mix. Shader needs its own IntersectionObserver pause, reduced-motion gate, poster fallback. Prototype values (`labs/hero-build-2/hero-lab-2.src.html` 315-329): field top #E2E8EE / #0A0F13, bottom #F7F7F3 / #132436, glow #C6D5E4 / #2E5475, secondary hue HSL S0.40 L0.82 light / S0.30 L0.34 dark, mixed toward paper 0.45 / 0.42. Suggested tokens `--shader-top`, `--shader-bottom`, `--shader-glow`, `--shader-warm` (light+dark), deliberately NOT mapped into Tailwind. Do not reuse `--viz-lane-2`. The burnt-orange value is undecided. Layer 1 lines 123 ("no second accent") and 127 ("tones of the one accent") both need amending for the secondary hue. `lib/theme.ts:5-6` duplicates background hex for theme-color meta.

Card-back tint tokens: none exist; card tints are inline `color-mix()` in `GlassTile.tsx:182`, `WorkModal.tsx:31`, `FlyingTile.tsx:313`; `GlassTile.tsx:196` frost veil. Lab 2 `THEMES` starting values: pane #F2F2EE / #1A232B; patBase #DAE2EA / #15212B; patMark #C6D3DF / #1D2E3C; duoDark #1B3A5C / #0F1B26; duoLight #E6ECF1 / #7FA8C9; hair rgba(10,10,10,0.18) / rgba(245,242,236,0.16); hi rgba(255,255,255,0.75) / rgba(245,242,236,0.09); slideVeil rgba(244,244,240,0.58) / rgba(16,23,29,0.58); recede 0.34 / 0.5; sheen 0.10 / 0.07. Spec wants card body 2 to 3 percent below paper as a token. Uniform inputs need hex/rgb.

Other: `SiteNav.tsx` BrandMark still draws the old italic "A" tile with hex and Instrument Serif; `app/icon.svg` and `public/brand/` carry the new AS mark.

### 1H. Hardcoded colors outside token files

Hex: `SiteNav.tsx:20,28`; `lib/theme.ts:5-6` (meta duplicate); `app/icon.svg` (asset). rgba/rgb literals: white/black rims and sheens in `GlassTile.tsx:163-176,260` (+ `ring-white/25`), `HoldingDeck.tsx:67,107,110`, `FlyingTile.tsx:309,388,396`; rgba(10,10,10,x) shadows in Menu 123, WorkModal 87, DefinitionModal 83, PhotoModal 77, `app/work/[slug]/page.tsx:53`, WorkSection 58, recruiting Popover 97-98, FunnelSankey 93, EditDialog 188, RecruitingDashboard 201; `PlaybackPill.tsx:51` rgba(0,0,0,0.22).

## 2. Docs

### 2A. Tracked

- `docs/design-decisions-2026-09-28.md`: current, governs the rebuild.
- `docs/coil-hero-spec.md`: current but stale versus section 2.9 (axis tilt <= 8 vs 30 to 45; cursor parallax vs none; riffle vs band first; greyed seen state vs outline dot; shader as pending option D). Revise before builders.
- `docs/coil-wireframe-checklist.md`: superseded.
- `docs/carousel-visible-engagement-spec.md`: historical (implemented; carousel retires).
- `docs/videos/*.mov` (3 files, ~45 MB) are TRACKED in git (`d84cdc2`): Pacôme menu captures and a carousel bug capture.

### 2B. `docs/plans/` (gitignored)

- `design.md` (06-22): partly superseded. Dead after rebuild: Instrument Serif, ring orientation/entrance/parallax, mobile coverflow, home layout. Still valid: color table, a11y, modal, photo treatment, motion curves, back-half sections. AGENTS.md says it wins on visual and motion details.
- `scroll-journey-redesign-brief.md`, `scroll-journey-build-progress.md`: historical; lessons distilled into the invariants; still true: single-page routing, GSAP owns scroll, click -> flight -> modal contract.
- `waveform-spotify-handoff.md` (07-01) and `2026-07-01-waveform-phase4-self-hosted-audio.md`: current; soundtrack survives; Task 10 open.
- `navbar-direction.md`: superseded by decisions section 4.
- `back-half-scroll-journey.md`: still relevant (`.reveal-*`, `.read-along`).
- `menu-hover-font.md`: dead after rebuild.
- `card-index-scrollwheel-plan.md`, `refresh-scroll-recovery.md` (implemented, `lib/scroll.ts`), `audit-fix-plan.md`, `ring-arc-*`, `2026-07-05-carousel-visible-engagement.md`, `tile-ring-carousel-arrival-pop.md`: historical.
- `definition-modal.md`: shipped; OPEN after rebuild: the hero shows only name, helix, menu, list link, which orphans the DefinitionModal triggers in HomeHero.
- `waveform-design-spec.md`: 0 bytes, dead stub (real spec under `docs/research/ascii-waveform-spotify-integration/`).
- `Desktop card redesign exploration/`: historical.

### 2C. Other gitignored

`docs/archive/` PRD (historical); `docs/review-sweep/` (~27 MB July scratch); `docs/research/refresh-2026-09-27/` (current; `repo-state.md` branch table is stale, predates the sweep merge); `design-exploration-2026-07-18/` (~79 MB, historical); `inspiration/` (~28 MB reference library); `inkwell/` (67 MB perf trace, historical); `ascii-waveform-spotify-integration/` (implemented).

### 2D. AGENTS.md source-of-truth links

`docs/design.md`, `docs/scroll-journey-redesign-brief.md`, `docs/scroll-journey-build-progress.md` do NOT resolve; they live in `docs/plans/`. All targets are gitignored; AGENTS.md itself is gitignored, so the authority chain is local-only.

### 2E. Sizes

AGENTS.md 39,983 characters / 40,286 bytes. `AGENTS_ARCHIVE.md` 65,245 characters (archives 07-03, 07-18, 09-12, 09-22). `AGENTS.template.md` and `PRODUCT.md` (gitignored; its anti-references list cream paper, italic display serif, navy accent, glass cards, tracked-caps eyebrows) exist.

## 3. Git

Branches: `main` local tip f49fb61 (no upstream configured; 6 ahead of `origin/main` a9f7fcd); `holding-page`, `recruiting-dashboard`, `review-sweep-codex-fable` fully merged (delete local + origin); `design-exploration` local only, 3 unique commits (see 1F). No stashes, clean tree, single worktree. Remote `github.com/aaron-sulbaran/aaron-personal-portfolio`. `.vercel/` present, gitignored.

`public/`: 9 real JPEGs (capital-one, claude-hackathon, drum-major, hsf-speaking, misuki, mt-fuji, traveling, uncs-grad, yosemite-hiking; 118 to 406 KB), 7 SVG placeholders (`photo-08..14`; 5 wired with TODO captions; `photo-09`, `photo-12` unreferenced), 3 mp3 + LICENSES.md, 5 work logos, `brand/` (new).

## Drift list (AGENTS.md vs code/git)

Layer 1: (1) three source-of-truth links wrong path; (2) Profa "loaded inside Holding.tsx, holding headline only" is wrong (lib/fonts.ts, also /recruiting h1); (3) Instrument Serif / Space Grotesk still presented as the faces; (4) "no second accent" and the shader exception's "tones of the one accent" conflict with the planned burnt orange; (5) hex in `SiteNav.tsx:20,28`; (6) pure white/black rgba literals widely; (7) `backdrop-blur` beyond modal panels and Menu trigger: `SiteNav.tsx:142`, `PlaybackPill.tsx:49`, `Menu.tsx:152`, `TileRing.tsx:2154,2162`, `app/work/[slug]/page.tsx:77`, recruiting Popover/EditDialog, `FunnelSankey.tsx:93`; (8) desktop/mobile paragraph describes the "inkwell deck"; code is the ring-arc carousel; (9) sizes: TileRing 2,691 lines, MobileHome 709; (10) em dash in `lib/soundtrack.ts:51`; (11) SiteNav mark is the old italic A while the favicon is the bolt.

Layer 2: (12) globals "indirection layer" claim is only on `design-exploration`; (13) `app/design-variants.css`, `lib/design.ts`, `components/DesignPanel.tsx` do not exist on main; variants are font trials, not terra/signal/verdigris; (14) "7 trial fonts" is 5, and none on main; (15) build-state header 2026-09-23 stale (sweep merge, recruiting work after 09-23, AS mark, brand assets, coil specs, 09-29 decisions missing); (16) design-exploration "decision pending" is stale; (17) tests list omits `recruiting/companies`, `edits`, `sort`; (18) `lib/recruiting/` omits `companies.ts`, `edits.ts`, `refresh.ts`, `sort.ts`, `vault-issues.ts`; `app/recruiting/edit/route.ts` and `refresh/route.ts` missing; `components/recruiting/` omits EditDialog, Popover, SortMenu, FilterMenu, Controls, RefreshButton, submitEdit.ts; (19) docs tree puts design.md at `docs/` and omits tracked docs and `docs/videos/`.

Accurate: palettes, stack versions, holding default, `/work` `/about` redirects in `next.config.mjs`, placeholder counts, audio, logos, `.vercel/`.
