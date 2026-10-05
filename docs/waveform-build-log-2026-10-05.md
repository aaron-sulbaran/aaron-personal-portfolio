# Waveform build log, 2026-10-02 to 2026-10-05

The record of "the waveform follows the reader": what was built, every defect found on the way and the test that guards its fix, the rulings, what was deferred, and Aaron's verdict after using it. Read this before touching `components/soundtrack/` or `lib/waveform/`, and when a wave or pill bug looks familiar.

Design: `docs/waveform-follows-spec.md`. Plan: `docs/waveform-follows-plan.md`. Decision: 2.11 in `docs/design-decisions-2026-09-28.md`. Orchestrated by Fable; every task built by an Opus 5.5 agent in a worktree, each with a fresh reviewer; one whole-branch review; a design review on a local production build. Production served the holding page throughout.

## Status after Aaron's hardware pass (2026-10-05): being reworked

Aaron used the merged build on real hardware the day it merged. His verdict, which governs what comes next:

- **The duck rule solved a problem he did not have.** The wave disappearing under text reads as broken (half a ribbon stops dead at the edge of a paragraph). Keeping the wave in the background, behind text, was the point.
- **The movement is confusing.** The sweep from the band to the strip and the scroll conveyor are hard to follow. He wants the wave as a background with a clean, self-contained loop, not a ribbon that scrolls and persists.
- **The placement is still wrong.** Not the bottom strip as built.
- **The pill's arrival is too fast and reads as a gimmick.** Other introductions are to be explored, including no animation at all.
- **Process.** The feature was built too autonomously. The rework goes the way the Coil did: small lab pages with sliders, tuned by hand, before anything is specified or built.

So sections 3 to 5 of the spec (the handoff, the duck rule, the pill's arrival) are under review. The engine split below (one conductor, views that only paint) stands and is what makes the rework cheap. Nothing here is removed from `main` until the labs settle a replacement.

## Pull requests, all merged into `main` on 2026-10-05 (merge commits, never squashed)

| PR | Branch | What landed |
|---|---|---|
| 20 | `wave-engine` | `lib/waveform/conveyor.ts`; the field takes a conveyor phase; `waveEngine.ts` split into `waveConductor.ts` (field, loop, audio sample, regime, conveyor, sweep) and `waveView.ts` (layout, weights, paint); a pixel guard on the band |
| 21 | `wave-horizon` | `lib/waveform/{sweep,track,duck,contrast}.ts`; `horizonView.ts` and `HorizonCanvas.tsx` (the fixed bottom strip); `useSweepTrigger.ts`; `data-wave-avoid` on the text blocks; the `?wavedebug` probe; `e2e/horizon.spec.ts` |
| 22 | `wave-pill` | `lib/waveform/{dock,freeze}.ts`; the pill's dock, labels and arrival (`PlaybackPill`, `PillLabel`, `usePillArrival`, `PlayerCard`); the band's new copy; `lastStartAt` and the failure window in `lib/soundtrack.ts` |
| 23 | `wave-fixes` | The fix wave after the whole-branch and design reviews: the look-ahead scaled by scroll speed, the pill moved bottom left, the muted test browsers, the self-healing holding server |

Final counts at merge: 406 unit tests in 42 files, about 102 end to end tests in 17 specs, `tsc` clean, lint 0 errors.

## Defects found before merge, and what guards each fix

If one of these comes back, the guard in the last column should already be failing. If it is not, the guard has been weakened: start there.

| # | Symptom | Cause | Fix | Guard |
|---|---|---|---|---|
| 1 | The wave would have travelled right on a scroll down | The plan sampled the field at `i + phase` | The field subtracts the phase (`j = i - phase`); a negative phase travels left | `lib/waveform/field.test.ts`, the nonzero-phase cases |
| 2 | Timing constants could drift unnoticed | The plan's sweep and duck tests asserted loose bounds | Exact single-step assertions | `sweep.test.ts`, `duck.test.ts` |
| 3 | The idle band could change density unnoticed | The stats test asserted floors only | Numbers pinned to what `main` measured, as a band | `e2e/pixels.spec.ts` |
| 4 | Muted text over a ducked dot fell under 4.5 to 1 | The spec's ceilings (0.09 light, 0.15 dark) were guesses | 0.07 and 0.11, computed from the tokens | `lib/waveform/contrast.test.ts` (reads `app/globals.css`) |
| 5 | The strip stalled after a jump past the band | Nothing stepped the sweep while no view was active | The conductor's `running()` is true while `sweep.value !== sweep.target` | `horizon.spec.ts`, "a jump past the band lands the train on the strip within 1.5s" |
| 6 | One ScrollTrigger leaked per reduced-motion toggle | `useGSAP` without `revertOnUpdate` | `revertOnUpdate: true` | `horizon.spec.ts`, "a live reduced-motion toggle keeps exactly one sweep trigger" |
| 7 | Up to now's offset last item ducked only by luck | Its words sit below its padded box; Connect's look-ahead happened to reach | A per-element pad (`data-wave-avoid-pad="80"`) | `horizon.spec.ts`, "Up to now's last right-column item is ducked" |
| 8 | "Behind the text" tests could not fail | `elementFromPoint` skips `pointer-events: none` | The test flips pointer events inside the evaluate | `horizon.spec.ts`, "the strip sits behind the text and takes no pointer" |
| 9 | The alpha check compared a constant with itself | The probe echoed the constant under test | A real `getImageData` read on the strip | `horizon.spec.ts`, the readability tests |
| 10 | A mouse click pinned the pill's label open | Focus paused the hold | Only `:focus-visible` or hover pauses it | `soundtrack.spec.ts`, the dock tests |
| 11 | Visitors who declined could not freeze the wave | The plan moved Freeze into the player card, which they never see | The band keeps the toggle while the state is unanswered or declined | `soundtrack.spec.ts` |
| 12 | Phones lost their only way back in after "Not now" | The plan removed the band's replay layer | "Play it" returns in the band on phones | `soundtrack.spec.ts`, the 375px cases |
| 13 | A reload showed the open greeting again | No once-per-session memory | `sessionStorage["aaron-soundtrack-greeted"]`, then a quiet "Paused" | `soundtrack.spec.ts` |
| 14 | An unanswered first trip rose from the bottom | The condense had no source without a pressed control | Falls back to the band's visible control, then its note | `soundtrack.spec.ts` |
| 15 | The capsule's accessible name lacked its visible text | WCAG 2.5.3 | `capsuleName` in `lib/waveform/dock.ts` | `dock.test.ts` |
| 16 | The capsule covered footer words | A fixed capsule over the last row | The home footer carries extra bottom padding (`dock`) | `soundtrack.spec.ts`, the footer hit test |
| 17 | The loop never slept once the train left | `busy()` read a scroll speed that no longer decayed | A pure scroll tracker, reset when the wave returns to the band | `duck.test.ts`; `horizon.spec.ts`, "back above the band, the strip stops painting" |
| 18 | Every arrival read as a 1500px per second flick | The first speed sample spanned a painting gap | No sample across a gap over 0.25s; no tracking under reduced motion | `duck.test.ts`; `horizon.spec.ts`, "a scroll made while frozen does not read as a flick" |
| 19 | The snake arrived almost invisible at 1440 by 900 | A fixed 160px look-ahead ducked most of the strip at rest | Look-ahead scales with downward scroll speed, zero at rest | `duck.test.ts` (`lookAheadFor`); `horizon.spec.ts`, "at rest only text over the strip ducks" |
| 20 | The test suite played the soundtrack aloud | Playwright launched an unmuted Chromium and pressed Play | Every test browser launches with `--mute-audio` (`playwright.config.ts`, `e2e/support/launch.ts`) | The config itself; never remove the flag |
| 21 | The suite could not boot (`MODULE_NOT_FOUND`) | macOS pruned the temp holding copy's `node_modules` while its stamp matched | `e2e/support/holding-server.mjs` retries once with a clean install | The retry path |

## Rulings

- The ask stays in the band; a popup that became the pill was cut (Aaron).
- The pill sits bottom left, 24px in, on the header mark's left edge; no fade under text (Aaron, from mockups of four placements on the real build).
- "Not now" is never asked twice.
- Both music terms of the field travel with the conveyor, not only the first.
- The junction curl and the transit swell scale with `sin(pi * sweep)`, so they are the identity at rest; the swell fades with a column's weight so held columns never get the boost.
- No carve under the pill; its blur softens the dots.
- The pressed control is the condense source for the first arrival only; later trips use the band's visible control or note.
- A paused returning visitor already greeted this session gets a quiet "Paused" capsule.
- Phones have no strip and no pill.

## Deferred at merge

- No fade when text passes under the pill; below about 1280 wide the capsule can cross text, and at 1024 the open label crosses the "Who I am" label.
- An alpha step at the duck split on a slow scroll up.
- The condense path drifts sideways as the label's slots grow.
- Pausing with an OS media key within 4 seconds of "Play it" reads as a failure.
- The pill sits above the Menu scrim.
- Two copies of `MUTED_ARGS`; the condense test's 1px rest tolerance may flake.
- `ScrollTrigger.refresh` on a `main` resize is debounced.
- Case pages do not need the footer's dock padding and do not get it; the home passes `dock`.

Most of these belong to the parts under rework; they are listed so nobody fixes them twice.

## Lessons

- Unmuted test browsers play real audio. Mute from the first test of any project with sound.
- A fresh reviewer per task caught most of the table above, including three defects in the orchestrator's own plan.
- A test that passes on the old code proves nothing; show it failing first.
- A look-ahead meant for fast scrolling must be zero at rest.
- Render placement options on the real build before recommending one.
- Tests and reviews did not catch the thing that mattered: whether the motion felt right. That is a lab question, answered by hand, before a spec.
