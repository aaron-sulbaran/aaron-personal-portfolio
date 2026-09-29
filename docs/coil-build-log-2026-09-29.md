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

## Pre-deploy design review

Pending at the time of writing; appended when it lands.
