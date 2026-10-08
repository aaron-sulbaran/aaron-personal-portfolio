# The first public edition build: the brief

Written overnight on 2026-10-07 after the build Aaron kicked off at the end of 2026-10-06. Everything below is on `main` and pushed; nothing is deployed, because production serves the holding page until the go-live PR merges, which is held for his content pass. The local link to the merged site is in section 6.

## 1. What was implemented

Eight pull requests merged into `main` in order, each one slice of the plan set in `docs/superpowers/plans/` and each built from a decision Aaron made in the labs (`docs/lab-log-2026-10-05.md`):

| PR | Slice | What a visitor gets |
|---|---|---|
| 24 | Wheel capture (decision 2.12) | The Coil takes the wheel only on a card or a two-card seam, after a real pointer move, and keeps it after a spin. No more trap, no more capture over the background. |
| 25 | Page scroll leaves the Coil alone | Scrolling the page no longer turns the helix; it idles at its own pace and rides up with the hero. |
| 26 and 31 | The loader lockup | The loader shows "Hi, I'm" over "Aaron" in the canvas lockup's proportions from the first paint, fills only the name, and hands the whole lockup to the canvas in one frame. No frame ever shows the plain fallback heading (the flash Aaron recorded). PR 31 fixed what PR 26 missed: the resting lockup now lives in the hero's own box, so it scrolls with the page while a slow GPU is still booting the scene. |
| 28 | The wave cut (tier 1) | The rejected strip, sweep, duck and pill condense are gone. The band keeps its wave and its ask; the pill fades in at its dock once the band's bottom passes a 112px line under the header, and fades out on the way back. |
| 27 | The label face | Every small non-body text is Profa Bold at three sizes, accent when clickable or attached to a title, muted otherwise; the back link's drawn arrow, role lines under titles, book rows that wrap, "Not now" muted with its faint underline. |
| 29 | The sections grammar | About, Who I am, Up to now and Connect arrive by one scrub-with-lag grammar (0.8s lag, everything masks in), Who I am's label and Up to now's heading hold sticky, Up to now takes the "beside" layout, Connect rows draw and never truncate (the 390 grid bug went with it). |
| 30 | Controls | The house hover fill on every control in Aaron's picked variant and colourway (the Menu pill's word rolls to the AS mark, as in the lab), the bolt-eighth note with a slash for paused and off, nothing to the right of the note, a pill whose width never changes. |
| 32 | Metrics | The six-month GitHub contribution skyline inside Up to now: flat with bevelled cells until seen, one morph to rounded prisms, a Flat/Skyline toggle in the fill grammar, the stats beside it with the current streak only; a daily server fetch with a read-only token and a committed snapshot as the fallback (the one backend growth: no database). |
| 33 | The scroll refresh guard | A ScrollTrigger refresh (a resize, a rotation, a media-query crossing) never scroll-jumps the page to the top, and no longer leaves an inline `smooth` that overrode the reduced-motion rule. |
| 34 | A test fix | The dock sampler test measures a time window instead of a count. |
| 35 | Review fixes | The four required items and three suggestions from the code review (section 3a). |

Build process: six read-only Opus planners wrote the slice plans, one fresh Opus reviewer reviewed the set (it caught three wrong cross-slice guesses and one plan that would have failed its own suite), five Opus controllers ran subagent-driven development in parallel worktrees (fresh implementer per task, fresh reviewer per task, whole-branch review per slice), and each merge step after the first was done by a fresh agent that resolved the known conflicts and reran the suites. Fable looked at every slice on a production build at 1440, 1024 and 390 in both themes before it merged.

Final state of `main` (section 6 has the numbers after the two late fixes): every merge step reran the unit suite, the type check, lint and the full end-to-end suite on its own build before its PR merged.

## 2. Issues met on the way, and how each was fixed

| Issue | Where | Fix |
|---|---|---|
| Planners guessed each other's interfaces wrong (the Up to now slot's prop name, the fill primitive's path and props, the kicker size) and two shell checks matched "horizontal" and "sweep" inside the Coil | The plan set | The whole-set review before any dispatch; every planner revised its own plan from the edit list |
| Parallel controllers would have tested each other's builds on the shared Playwright ports | All five slices | Tier 1 made the ports and the holding temp dir per checkout; every slice served its own build on its own port |
| An implementer killed a process it did not own by reading a shared PID file | Tier 1, and once in label face | The rule that a PID lives only in the shell that started it, in every brief since; a note in Fable's memory |
| A merge agent's permission classifier refused the one `git rm` a merge needed | Sections | Fable completed the deletion (the branch's own retirement of a dead file) |
| The loader's resting lockup stayed fixed while the page scrolled on a slow GPU | PR 26, found while looking at PRs 28 and 29 | PR 31: the loader root is the hero's box, the pane stays fixed; two new fail-first tests; a follow-up for the off-screen exit took the plain fade |
| A resize smooth-scrolled the page to the top sometimes | Found by the label-face merge agent | PR 33: GSAP loses its scroll record when triggers created in media-query callbacks refresh alone, and Chromium skips the style flush for a jump to 0; the guard restores both |
| Adjacent line masks collapsed their negative margins, so a Who I am block was 10px taller armed than still and a deep load at Connect lost its place once the label face shortened the page | Found by the sections merge agent | One CSS rule on adjacent masks, verified by the sections spec |
| The dock sampler test needed 14 samples in a window the sections rebuild now stalls for up to 164ms | Found by the metrics merge | PR 34: a time window; the stall itself is a follow-up for the sections engine |
| The Menu pill's hover looked wrong in a headless capture | Fable's look at controls | Two causes, neither a defect: the custom cursor sits in captures, and the word rolling to the AS mark is the lab's own behaviour |
| The Connect email values truncated at 1024 | Pre-existing on main | The sections slice took it: a size step, a break after the at sign, an e2e assertion |

## 3. The final two checks (filled in when they report)

### 3a. Code review (`engineering:code-review`, a fresh Opus reader over the whole merged range)

Verdict on the merged range: Request Changes, four required items and twelve suggestions; the architecture approved. The four, plus three cheap suggestions, became PR 35 (nine commits, every change with a fail-first test), re-reviewed by a second fresh Opus reader: approve, all seven addressed, nothing broken. Merged.

- The skyline painter built several hundred colour strings per frame through the morph (a binding rule); now a per-slot cache rebuilt only when a rounded colour changes.
- The chart re-themed on every scroll-refresh style write and every scroll lock; now only on a real `data-theme` change.
- The GitHub fetch had no timeout; now 8 seconds, and GraphQL's own error messages are reported before the shape check.
- Dead code out: the sweep stand-in in the wave conductor and view, the orphan `DefinitionModal` and its content block.
- The Flat click no longer replays the skyline after a live reduced-motion switch; the legend swatches have a 24px-tall hit area (24px wide needs a wider gap, Aaron's call); the Listen note and the panel chip keep one stable accessible name with `aria-pressed`.

What it praised: no secret can reach the client (the fetch is server-only and the `{ data, error }` boundary holds on every path), the refresh guard, the sections engine's accessibility, the Fill primitive's handling of duplicated children, and the loader's new geometry having tests.

Left as follow-ups by its own judgement: the two body ResizeObservers, the per-frame stage height write during the morph, `lastGood` across Vercel instances, woff2 fonts and the Bold preload, the 150px initial stage height, the `@` glyph until the full cut.

### 3b. Design review (`design-review`, a fresh Opus reader, frame by frame at 1440, 1024 and 390, both themes, on a production build)

Verdict: the build matches the lab decisions almost everywhere; nothing contradicts a lab pick. Verified against the picks: the label face sizes and colours, the book rows wrapping only where needed, the band row on one baseline with the exact gaps, the pill's dock and fade both ways with a box that never moves, every control's fill variant and the slashed note, the sections grammar with sticky labels, the beside layout and the drawn Connect rows, the metrics gate (flat until crossed, one morph, pending on a fast pass, replayed on return, flat again above), the case page's arrow and role line, and reduced motion at 1440.

Two items to fix before launch:
1. The band's note still says "The wave follows you down the page." Nothing follows the reader until `wave-path` lands. The copy is Aaron's (added to the before-launch list).
2. Opening a photo modal from the book scrolled the page to 344 behind the modal in 2 of about 18 runs, so closing returned the visitor to the hero. The reviewer's traces never caught the caller. A systematic-debugging agent is on it with the repro scripts (section 4 says where it stands).

Polish and notes, none blocking: a width change keeps `scrollY` but not the reader's place (ScrollTrigger restores the number, not the content); the metrics block grows about 150px during the morph and pushes Connect down (reserve the height or accept it); the morph stretches under a slow renderer; touch devices still read "Drag to orbit, double-click to reset" (content pass); the `@` in the Connect emails is the Inter fallback until the full cut; the photo modal panel has no fill of its own (the known alpha-token debt) so the book shows through during the close; the header bar lets book text show faintly behind the nav links (predates tonight).

Its three answers: it feels like Aaron, one voice from the bolt mark through the label face to the skyline, with the streak as earned evidence; most elements earn their space, the stale band sentence and the blank stretches before reveals cost some of a 60-second skim; he would be proud to share it once the copy line is fixed and the modal jump is ruled out.

## 4. What still needs Aaron, aside from the content itself

1. **Approve and apply the AGENTS.md refresh.** The diff is at `docs/plans/agents-layer2-2026-10-07.diff` with the proposed file and the archive append beside it; the live file lands at 39,961 bytes. Layer 1 lines are his: the Stack and Typography font lines (Profa Bold is now a tracked face), "quarter-note Listen control" becomes the bolt eighth, and the blur guardrail should name the hero control if the 8px blur stays.
2. **The before-launch list**, `docs/aaron-before-launch.md`: the music, the copy, the photos with EXIF stripped, the GitHub token as `GITHUB_CONTRIB_TOKEN` in Vercel, the full Profa cuts, the brand assets, his own hardware pass, and then the go-live draft PR.
3. **Two product calls from the code review:** on Vercel a failed daily GitHub fetch serves the committed snapshot rather than yesterday's page (honest but it goes backwards), and whether the trial Profa cuts ship in a public edition (licence settled per Aaron; the files are TTF and preload on every route, woff2 is a follow-up).
4. **Tiers 3 and 4** (`wave-path`, `mark-strike`) start on his word from their plans; both wait for nothing else.
5. **Follow-ups logged, none blocking:** the sections engine's rebuild on a live reduced-motion switch stalls the main thread up to 164ms (one shared matchMedia, or deferring off-screen re-splits); two body-level ResizeObservers refresh back to back (`wave-path` consolidates them); the metrics phone hints say "Hover" and "double-click"; the first run of the refetch script changes numbers three unit tests pin.

## 5. Housekeeping done

Seven merged worktrees removed and their local branches deleted (all live on GitHub); the `lab` branch pushed as the backup it was missing; `.claude/launch.json` reduced to `holding`, `dev`, `recruiting-dev`, `lab` and a new `main-prod` (a production start of main on port 3000); the master plan's build ledger (`docs/superpowers/plans/2026-10-06-first-public-edition.md` section 10) records every PR, port, look and merge; the lab log, the waveform build log and the Coil ledger carry the rulings; Fable's memory has the parallel-build lessons.

## 6. The local link

**http://localhost:3001** serves a production build of `main` at `ab736d4` (the launch config `main-prod`; port 3000 holds the creative director session's dev server). Final verification on that exact tree: `pnpm test` 54 files, 492 tests; `pnpm test:e2e` 149 passed, 1 skipped, 0 failed, 0 flaky, 10.8 minutes; type check clean; lint 0 errors.

**The photo-modal scroll jump (section 3b, item 2) is not a site bug.** A systematic-debugging agent reproduced it (0 of 30 at baseline, 1 of 60 under a 4x CPU throttle, 4 of 30 under machine load, most runs when clicking within 600ms of arriving at the book) and traced every jump to Playwright retrying its own click: when a book row is still mid-reveal the click is "not stable", the retry scrolls the row into view with a forced alignment (end, center, start, in that order), the click lands before the page glides under the site's smooth scroll, and the glide finishes behind the open modal. The landing position matched the retry count every time (344, 767, 1190). The reviewer's traces missed it because Playwright scrolls from its isolated world. The scroll lock, the refresh guard, the focus trap, the ResizeObservers, the flight and the modal code were each ruled out; a forced refresh with the modal open left the page at 900. No PR; the harness note for future specs is to wait for a row's rect to hold before clicking it.

## 7. Addendum, 2026-10-07 morning: the fallback Aaron saw

Aaron opened http://localhost:3001 and saw the poster of the empty field with the big "Hi, I'm Aaron." h1, no Coil, no loader lockup, and read it as the build having lost the hero. The build was intact (served since 02:43, every chunk 200, the scene drawing in a visible GPU Chrome in both themes). His Chrome runs with "Use graphics acceleration when available" off, which removes WebGL entirely, so the stage's probe found no context and the site took its designed fallback. The band's ask was collapsed because a "Not now" is remembered per origin in localStorage.

Two things came out of it:

- The fallback was a safety floor nobody had looked at as a visitor. PR 36 (`hero-still`, plan `docs/superpowers/plans/2026-10-07-hero-still-fallback.md`) replaces it: a real still of the scene at rest in three cuts per theme (AVIF with WebP fallback, rendered by `scripts/render-posters.mjs`), the loader's resting lockup handing to the still in one frame, the h1 hidden only once the still has decoded, and a quiet dismissible notice saying why the page is still (placeholder copy in `siteContent.hero.still`, his to rewrite). Reduced-motion visitors get the same still.
- A deep link to `#listen` lands with the band's question under the fixed header bar; it needs a scroll margin. Logged as a follow-up, no owner yet.

The in-app browser pane is hidden and never runs the scene; visual checks of the hero go through a visible Chrome with a GPU.

**2026-10-08:** Aaron checked PR 36 himself and said merge; the notice copy became one sentence per cause in his words first. Merged as the tenth slice; rulings in `docs/design-decisions-2026-09-28.md` 2.13, the record in the Coil build log. The 3002 preview and the `hero-still` worktree are retired. Found in the same check: the mark strike (tier 4) and the Coil and Band toggle were never built, and the sections' reversible reveal is replaced by a one-way one; all three are in flight.
