# First public edition: the master plan

> **For agentic workers:** this is the architecture and sequencing document. Each slice below has its own implementation plan in this folder (`2026-10-06-<slice>.md`), executed with superpowers:subagent-driven-development, one controller per slice, each in its own worktree. Read this file for how the slices compose and merge; read the slice plan for the tasks.

**Goal:** take aaronsulbaran.com from the holding page to the full site in one evening, built only from the decisions Aaron made in the labs on 2026-10-05 and 2026-10-06, with the rejected waveform replaced and three open PRs merged.

**Spec sources:** `docs/lab-log-2026-10-05.md` (every lab pick and ruling), `docs/label-face-spec.md`, `docs/coil-build-log-2026-09-29.md` (the 2026-10-06 rulings), `docs/design-decisions-2026-09-28.md`, `AGENTS.md` Layer 1.

**Deciders:** Aaron approves this plan and every merge; Fable orchestrates; Opus 5.5 implements and reviews.

## 1. Decision record

**Status:** proposed, 2026-10-06.

**Context.** Production serves the holding page. `main` carries the Coil rebuild and a waveform Aaron rejected on hardware (the duck, the sweep to a bottom strip, the pill's condense). Six labs produced his picks for typography, section motion, controls, the mark, the wave and a new metrics section. Three PRs are open and reviewed: 24 (wheel capture), 25 (page scroll no longer turns the coil), 26 (the loader lockup and the fallback-heading flash). He wants the first public edition live tonight, knowing the site stays a living product after that.

**Decision.** Ship in tiers, each tier a mergeable state of `main` that is better than production, so the evening can stop at any tier boundary with a site worth sharing:

| Tier | Content | Why it is a stopping point |
|---|---|---|
| 0 | Merge PRs 24, 25, 26 in that order | Three reviewed fixes, no new surface |
| 1 | `wave-band-only`: the horizon strip, sweep, duck and pill condense switched off behind the engine split, the band keeps its wave and controls, the pill fades in when the band leaves the viewport | Removes the rejected feature from `main` in one small PR, so no tier ships it |
| 2 | `label-face`, `controls`, `sections`, `metrics` in parallel worktrees, merged in that order | Everything decided end to end, each one PR |
| 3 | `wave-path`: the scroll-drawn line from wave lab round 6 | The biggest slice and the one with the newest lab round; it lands on top of tier 1, never instead of it |
| 4 | `mark-strike`: the easter egg | Delight, not structure; last because its copy is Aaron's and its keyboard route is a judgment call |
| 5 | `go-live`: the site mode flips to full, OG metadata, the holding page retired from the default path, AGENTS.md Layer 2 | **Held by Aaron (2026-10-06): the final version is verified locally first, then his content pass (copy, photos, music, logos; `docs/aaron-before-launch.md`), and only then the push.** Nothing deploys before his explicit word |

**Options considered and rejected.** (a) One integration branch with everything, merged once: the Coil way, but it makes tier boundaries impossible and tonight needs them. (b) Ship the wave path before the band-only cut: if the path slips, production would carry the rejected strip; the band-only cut costs under an hour and removes that risk. (c) Build the toggle, the pill introductions and the content pass tonight: none has a lab decision; they stay out.

**Consequences.** Six worktrees in flight at once means merge conflicts in the shared files (section 4). The wave path is the long pole; if it misses tonight, tier 1's band stands alone and the path lands tomorrow. The site goes live with Aaron's current copy; the content pass stays his.

## 2. How the pieces compose on one page

```
<html data-theme data-home>
  Loader (z60, SSR-armed): resting lockup from first paint; fill on slow loads; one-frame hand-off to the canvas   [PR 26]
  SiteNav (z30) + MenuPill (z40): label face, fill on hover, bolt note with the state slash                        [label-face, controls]
  main
    hero: CoilStage (the one WebGL object; GSAP owns scroll; capture per PR 24; idle pace per PR 25)
    #work  Book (label face on meta; row hold unchanged)
    #listen SoundtrackBand: the ask; the band wave is the first stretch of the path                               [wave-band-only, then wave-path]
    #about AboutIntro, WhoIAm, UpToNow, Connect: the scrub-with-lag grammar, sticky labels, Up to now "beside"     [sections]
      UpToNow hosts <ContributionSkyline/> and its four stats: flat until seen, morphs once, bevel depth            [metrics]
    Footer
  PathLayer: in-flow canvas tiles behind the sections, the dots moving to the real track                           [wave-path]
  PlaybackPill (z45): fades in when the band leaves the viewport; no condense                                      [wave-band-only]
  CustomCursor (z100): "Open me" over cards; the ring with the hold arc over the mark                              [mark-strike]
  Mark strike: hold the mark 650ms, the cel strike, the card                                                        [mark-strike]
```

**Scroll.** GSAP ScrollTrigger owns every scroll-driven value: the sections' scrub timelines, the metrics morph gate, the wave's head position. Nothing animates `scrollTop`; no Lenis. The coil no longer reads page scroll at all (PR 25). The wave path reads scroll position only to place its head; its canvas tiles are in flow and repaint only when visible.

**Three canvases, one GPU budget.** The Coil (WebGL, hero only), the wave tiles (2D, under 768px each, visible ones only, at rest nothing repaints), the skyline (2D, one canvas, repaints during the morph and on orbit). They never share state. The frame budget rule from the Coil applies to all: no per-frame allocation, no layout reads in a paint.

**Music.** `lib/audio.ts` already analyses the hosted track with an AnalyserNode. The wave path consumes those bins directly; the lab's offline envelope was a stand-in for a silent lab and does not ship. The lab found the site's band shaping saturates on this track (middle columns at full more than half the time); the path slice levels each column to its own range as the lab does, in `lib/waveform/field.ts` or a sibling, and the band inherits it.

**Metrics data.** A server-side fetch of the GitHub contribution calendar through a token with no repository access (the profile setting now exposes private counts to any viewer), ISR 86,400 like `/recruiting`, a committed snapshot (`contributions-6mo.json`, refreshed by the lab's `fetch.mjs`) as the fallback when the token is unset or the fetch fails. No database. This is the one backend growth in the plan and it mirrors the recruiting pattern exactly; the heads-up is here and it is small.

**Typography.** The label face lands first because the controls, the sections' kickers, the pill and the metrics stats all take `font-label` and the three label sizes.

## 3. Branches, dependencies, merge order

| Order | Branch | Base | Depends on | Touches (hot spots in bold) |
|---|---|---|---|---|
| 0a | `coil-capture` (PR 24) | main | none | lib/coil/capture, scene/input, docs |
| 0b | `coil-scroll-free` (PR 25) | main | 0a merged (one test-file conflict: keep 24's arming block, drop the page-feed block) | lib/coil/motion, constants, scene/input, e2e |
| 0c | `loader-lockup` (PR 26) | main | none | components/loader, lib/loader, scene/name, constants |
| 1 | `wave-band-only` | main after 0 | none | components/soundtrack (remove horizon, sweep, duck wiring, condense), e2e horizon specs |
| 2a | `label-face` | main after 1 | none | **lib/fonts.ts, tailwind.config.ts, lib/content.ts**, many class swaps |
| 2b | `controls` | main after 1 | 2a (uses `font-label`) | components/menu, soundtrack pill, SiteNav, Connect, **globals.css** (the fill primitive) |
| 2c | `sections` | main after 1 | 2a (kickers) | Reveal, ReadAlong, UpToNowList, AboutIntro, WhoIAm, **UpToNow**, Connect, **globals.css** |
| 2d | `metrics` | main after 1 | 2a (stats), 2c (mounts inside the new UpToNow) | components/metrics/*, app/api or a server component, **UpToNow**, **lib/content.ts**, env |
| 3 | `wave-path` | main after 2 | 1, 2a (pill labels), 2c (its `data-wave-words` markers go on the sections' DOM and skip the sticky columns), 2d (the skyline's reflow) | lib/wavepath/*, components/soundtrack/path/*, band, **lib/content.ts** (band copy), e2e |
| 4 | `mark-strike` | main after 2 | 2b (fill grammar on the card), CustomCursor | components/mark/*, **CustomCursor**, menu/BrandMark, **lib/content.ts** |
| 5 | `go-live` | main after 4 (or after whatever tier holds) | all merged | lib/holding.ts, app/layout metadata, OG image, AGENTS.md (Aaron applies) |

Slices 2a to 2d build in parallel from the same base and merge in order; 2b, 2c, 2d rebase onto `main` after each merge ahead of them. Conflicts are expected only in the bold files, and each is a few lines: `lib/content.ts` (one meta string, the metrics strings, the band copy, the mark card copy; append-only sections avoid overlap), `globals.css` (the fill's custom property, the sticky rules, the metrics tokens; each slice adds its own block under its own comment), `UpToNow.tsx` (sections restructures it; metrics mounts one component inside it; metrics rebases after sections).

## 4. Execution model

- One superpowers:subagent-driven-development controller per slice, in its own worktree under `.worktrees/`, each with its own ledger under `.superpowers/sdd/`. Controllers run concurrently; implementers inside one controller run one at a time.
- Implementers: Opus 5.5 for anything touching motion, the scene, the wave or the skyline; Sonnet for class swaps and transcription tasks where the plan carries the code. Task reviewers: Sonnet for small diffs, Opus for motion and engine diffs. Final whole-branch review: Opus, fresh, per slice. Fable's own look at a local production build in both themes at 1440, 1024 and 390 before any merge recommendation.
- Every PR: small commits, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the Claude Code line in the body, tests written first and shown failing, `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint`, the affected e2e specs from a checkout with no dev server. Builders stop only the processes they started, never `pkill`, `killall` or a pattern match, never a port they did not open.
- Merges: Aaron's word each time, in the order above. Production builds only from his push of `main`, and every merge into `main` triggers a holding build on Vercel (harmless while the default is holding); merging the go-live PR is the production deploy, so it opens as a draft and stays one until his word.
- End-to-end isolation: tier 1 makes the Playwright ports and the holding temp directory per checkout (`E2E_FULL_PORT`, `E2E_HOLDING_PORT`, a per-port temp directory); every intermediate run in every slice serves its own build on its own port and passes `E2E_BASE_URL`; a full run uses `CI=1` after an `lsof` check of its ports. Four controllers must never test each other's builds.
- Who fixes what a later slice breaks: the slice that merges later fixes the earlier slice's tests it breaks, in its rebase task (label-face's locators once Fill duplicates text; tier 1's avoid-marker test once sections lands; sections' aria-hidden count once controls lands).
- `AGENTS.md` and `.claude/` are gitignored, so worktrees do not carry them: every dispatch points the implementer at the main checkout's `AGENTS.md` by absolute path, read-only. Only Fable edits `.claude/launch.json`.
- Each slice gets a preview port for his trackpad before its merge: capture 3220, scroll-free 3230, loader 3240, then 3250 upward in slice order (added to `.claude/launch.json`).

## 5. What Aaron supplies tonight

| Item | Needed by | If missing |
|---|---|---|
| A GitHub token with no repository scopes, as `GITHUB_CONTRIB_TOKEN` in Vercel (production) via `vercel env`; he creates it, agents never handle it | metrics | The committed snapshot serves; the day count stops advancing until the token lands |
| The mark card's words (name, gamertag line, whatever the card says) in `lib/content.ts` | mark-strike | The strike ships with the lab's marked placeholders replaced by the shortest true line, and he edits later |
| The LinkedIn figure and one fun figure for the two placeholder stats | metrics | The row ships with its three real figures and the placeholders removed |
| Merge calls at each tier boundary, and the push of `main` | all | Nothing goes live |
| Optional: the Who I am rewrite and the section header names | content pass | The grammar was designed to survive copy changes; nothing blocks on this |
| Optional: an OG image | go-live | The existing metadata ships; the social card is a follow-up |

## 6. Decisions this plan takes without a lab, flagged for his veto

1. **The pill's introduction** is a 300ms fade in at its dock when the band's bottom edge leaves the viewport, and a fade out when the band returns (candidate 1 from the lab log, "two seats and no flight"). No condense, no flight. The lab for introductions was never built; this is the quietest option and the cheapest to replace.
2. **The wave's draw speed** ships at 2800px/s of arc: Aaron's sections pick has "draw speed follows the lag" on, which links the cap to the 0.8s text lag, and an explicit pick outranks round 6's 4000 recommendation; 4000 is the alternative for his veto. The always-on Signature line ships as the one authored line (round 6 is logged as awaiting his read, so this is a plan decision too); the vetted seed list and per-visit lines wait for a later round. The 1024 graze of the Who I am label noted in round 6 is accepted for the edition.
3. **"Not now" draws the wave too** (both answers start the follow); the band's note stops promising that the music follows, and the music adds the reactive layer only after "Play it".
4. **The metrics morph's trigger** is 60 percent with the seen rule (60 percent in view, settled 120ms under 300px/s), bevel depth, six months, the current streak only.
5. **The mark has a keyboard route:** focus the mark, hold Enter or Space for 650ms; the ring is not drawn for keyboard users, the mark's own fill is the indicator.
6. **Go-live flips the default in `lib/holding.ts`** to full in the `go-live` PR, so the repository states the truth; `NEXT_PUBLIC_SITE_MODE=holding` remains the override to put the holding page back without a deploy of code.
7. **The Coil and Band toggle and the per-visit wave seeds do not ship tonight.** Both lack a decision (placement; the vetted list).

## 7. Risks, in order

1. **The wave path is the long pole.** It replaces an engine that took four PRs and has 21 logged defects with guards; the lab code is about 5,500 lines and the site needs perhaps 1,500 of it. Mitigation: tier 1 removes the rejected version first, so the path can land tomorrow without shame.
2. **Five slices touching `UpToNow`, `content.ts` and `globals.css`.** Mitigation: merge order and append-only blocks; metrics rebases after sections.
3. **The loader on Aaron's own Chrome.** He saw a persistent fallback heading on port 3240 that three headless runs and the app's pane could not reproduce. He has chosen to trust the tests. Mitigation: PR 26 merges in tier 0, and the first production load is checked on his machine before tier 2 goes live; if the heading persists there, the slow-path guard is the first suspect.
4. **Fonts.** The label face needs `ProfaTrial-Bold.ttf` tracked under the gitignore allowlist; it is already in the lab worktree's `app/fonts/`.
5. **End-to-end time.** The suite builds both modes and runs about ten minutes per slice; six slices in parallel compete for the machine. Mitigation: each controller runs only the affected specs per task and the whole suite once at the end.
6. **The audio analysis change** (levelling per column) alters the band on `main` too. Mitigation: it ships inside `wave-path` with a pixel test on the band, never in tier 1.

## 7a. Findings from the slice planners (2026-10-06), each confirmed in the code

- **The freeze toggle** (wave): with the horizon gone, a declined desktop visitor has nothing moving, so `wave-band-only` shows the toggle only when the music is on or already frozen (`freezable = !reduce && (music !== "off" || frozen)`); `wave-path` restores `!reduce`, because the band's run breathes after either answer.
- **Shared test ports.** Several worktrees running e2e at once share ports 3140 and 3141, and Playwright's `reuseExistingServer: !CI` would then quietly test another slice's build. Every final run uses `CI=1` and checks the ports first; the controllers stagger their full runs.
- **Draw speed, 4000 versus 2800.** The sections lab's "draw speed follows the lag" switch implies about 2800px/s for a 0.8s lag; wave round 6 measured and recommended 4000. Ruling: 4000 ships (it was measured against the catch-up Aaron complained about; the link was a lab switch, not a decision on the number); flagged for his veto.
- **The pointer mix is a no-op under pluck.** "push 1, carve 0.6, swell 0.5" is read only in the lab's "blend" mode; Aaron's pick is "pluck", so those three numbers do not become constants.
- **The idle band numbers** live in `e2e/soundtrack.spec.ts` (`MAIN_PAINTED = 4720`, extent 60 to 100px, snapshot `band-still`), not in the pixels spec. Tier 1 leaves them unchanged; `wave-path` re-pins them once for the levelling.
- **`lib/waveform/probe.ts` and `contrast.ts` go in tier 1** (every reader is horizon or sweep; the lab's `readout.ts` also imported contrast, and the lab never merges). `conveyor.ts` stays: the band uses it.
- **New leveller rates** for the live analyser (`rangeRate 40`, `targetRate 8` bytes per second, `warmS 3`, `warmBoost 5`) have no lab counterpart because the lab levelled offline over the whole file; they are constants and get a pixel test, and Aaron judges them on the preview port.
- **`DefinitionModal` is dead code** (imported nowhere); a cleanup for after launch, not this edition.
- **Tier 1 keeps its hands off what tier 3 rewrites.** `wave-band-only` deletes the horizon, sweep, duck and probe modules and their specs (rejected code does not sit on `main`) and unmounts the condense, but does not retune `waveConductor`, `waveView`, `dots`, `layout` or `field` beyond removing dead imports; `wave-path` rewrites those.
- **Three body-level ResizeObservers** (sections' refresh, metrics' refresh, wave-path's relayout) can storm when the skyline changes height; wave-path, merging last, owns consolidating them behind one debounced reflow broadcaster if the probe shows more than one refresh per reflow.
- **Timing-sensitive e2e** (the pill fade bounds, the mark's tap samples, the metrics fling) will flake with four production builds running at once; controllers stagger full runs and never read a timing failure as a defect on the first try.
- **Hard-coded copy in tests** ("Open menu", "Flat", "Skyline", "Close") is brittle under Aaron's content pass; builders read labels from `siteContent` in tests where a plan hard-codes them.

- **Found 2026-10-06 while looking at PRs 28 and 29 (merged PR 26, not the slices):** on a slow GPU the loader's resting lockup, which lives in the fixed `.coil-loader` layer, follows the scroll while the scene is still booting, so "Hi, I'm Aaron" floats over the book and band (measured at 0.9s with the page at 1800px, `data-scene` still off). Milliseconds on a fast GPU, visible on a slow device or a throttled tab. Fixed in PR 31 (`loader-rest-scroll`): the loader root is the hero's box at the document top (absolute, 100svh) so the lockup scrolls with the page, and the slow-path pane stays fixed; the lockup had stayed fixed while the page scrolled.

## 8. Go-live steps (tier 5)

1. `lib/holding.ts` default to full; `app/sitemap.ts` and `robots` follow; `/work/[slug]` no longer redirects.
2. Metadata: title, description, `openGraph` and `twitter` blocks in `app/layout.tsx` from `siteContent`; the OG image if supplied.
3. `vercel.json`: keep previews skipped (unchanged tonight).
4. AGENTS.md Layer 2: architecture tree (loader, metrics, wave path, mark), the invariants (wheel ownership per 2.12; page scroll never turns the coil; no frame shows the h1 while a scene is pending), build state, environment (`GITHUB_CONTRIB_TOKEN`), what's next. Fable shows the diff; Aaron applies.
5. Aaron pushes `main`; the first production load is checked on his Chrome and his phone; `vercel logs` for errors.

## 9. Slice plans

Each is a full writing-plans document with tasks, tests first, exact files and commands:

- `2026-10-06-wave-band-only.md`
- `2026-10-06-label-face.md`
- `2026-10-06-controls.md`
- `2026-10-06-sections.md`
- `2026-10-06-metrics.md`
- `2026-10-06-wave-path.md`
- `2026-10-06-mark-strike.md`
- `2026-10-06-go-live.md`

## 10. Build ledger (updated as PRs land)

| Slice | PR | Opened | Preview | Fable's look | Merged |
|---|---|---|---|---|---|
| coil-capture | 24 | 2026-10-05 | 3220 (retired) | yes | 2026-10-06, first |
| coil-scroll-free | 25 | 2026-10-06 | 3230 (retired) | yes | 2026-10-06, second, one test conflict resolved |
| loader-lockup | 26 | 2026-10-06 | 3240 (retired) | headless only; Aaron's Chrome sighting never reproduced | 2026-10-06, third |
| label-face | 27 | 2026-10-06 | 3260 (production build) | clean at 1440, 1024, 390 in both themes; the Connect email truncation at 1024 is pre-existing on `main`, handed to `sections` | merged 2026-10-07 second; seven conflicts resolved as listed, `BandStage` too; snapshot unchanged at that point |
| wave-band-only | 28 | 2026-10-06 | 3250 (production build) | clean: zero fixed canvases and zero avoid markers outside the band at every scroll position, the pill docks past the band and undocks above it | merged 2026-10-07 first |
| controls | 30 | 2026-10-06 | 3270 (production build) | see below | merged 2026-10-07 fourth on Aaron's "merge everything"; Connect rows swapped onto `Fill line={0}`, `leading-6` folded into the CTA classes, `band-still` regenerated once (1,256 px, all inside the band's text boxes), 131 of 131 e2e |
| sections | 29 | 2026-10-06 | 3280 (production build) | clean: beside layout with hairlines, sticky Who I am at 1024, Connect values break after the at sign at 390 with zero overflow at all widths, reduced motion hides nothing | merged 2026-10-07 third; the merge exposed a line-mask margin collapse (adjacent masks lost 0.04em, a block 10px taller armed than still) fixed in the same push |
| metrics | 32 | 2026-10-06 | 3290 (production build) | see below | merged 2026-10-07 fifth with the Fill swap on the toggle and sections' `UpToNow`; 139 e2e |
| scroll-refresh-instant (a race on main) | 33 | 2026-10-07 | none (fix) | fresh Opus review: approve with nits, applied; GSAP loses its scroll record when triggers created in media-query callbacks refresh alone, and leaves inline smooth over the reduced-motion rule | merged 2026-10-07 seventh |
| loader-rest-scroll (PR 26 defect) | 31 | 2026-10-06 | none (fix) | fresh Opus review: approve with nits, all eight applied, two new tests (one failing first), 445 unit and 26 e2e green | merged 2026-10-07 sixth |
| dock-sampler-settle (a marginal test) | 34 | 2026-10-07 | none (test only) | two files, time window instead of a count; the sections rebuild stalls up to 164ms on a live reduced-motion switch (follow-up) | merged 2026-10-07 eighth |
| hero-still (the no-scene fallback) | 36 | 2026-10-07 | 3002 (production build, retired) | frame-sampled on a blocked-WebGL build: still state at 169ms, decode at 216ms with the h1 collapsing in the same frame, lockup fading over 300ms, notice present; the live path unchanged | merged 2026-10-08 tenth on Aaron's word after his own check, the notice shortened to his sentence; 580 unit, 175 e2e |
| reveal-once (one-way section reveals) | 37 | 2026-10-08 | 3320 (production build, retired) | fresh Opus review of the GSAP mechanics against the library source: approve with nits, applied | merged 2026-10-08 eleventh on Aaron's "start merging"; 586 unit, sections e2e 15 |
| coil-band-toggle | 39 | 2026-10-08 | 3330 (production build, retired) | the capsule at rest and the band formed in a GPU Chrome, dark theme, 1440; plan reviewed before the build (twelve findings applied) | merged 2026-10-08 twelfth; 599 unit, 185 e2e and 1 skip |
| mark-strike (tier 4) | 38 | 2026-10-08 | 3310 (production build, retired) | the controller's own look on the no-WebGL path (the mark and pill centred at y 36 and 32, the strike and the card at 1440 dark, the card stacked at 390 light); pre-merge round: rebase onto 36, 37 and 39, the card's duplicate GSAP chunk removed (first hover 65KB to 6.5KB gzip), full suite 210 passed and 1 skipped | merged 2026-10-08 thirteenth; 623 unit, 211 e2e |
| review-fixes (the code review's four items plus three suggestions) | 35 | 2026-10-07 | none (fix) | fresh Opus re-review: approve, all seven addressed | merged 2026-10-07 ninth; main at ab736d4, 492 unit, 149 e2e |
