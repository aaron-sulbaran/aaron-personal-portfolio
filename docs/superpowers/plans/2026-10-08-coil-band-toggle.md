# The Coil and Band toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a two-half capsule at the hero's bottom left that switches the Coil between the wound helix (default) and the closed, angled band the entrance passes through, as one value animated on the entrance's own pull curve.

**Architecture:** The band is the entrance's pose at pull 0 (`lib/coil/entrance.ts`). The pull math moves out of `entranceHelix` into `pullHelix(rest, geo, pull)`, shared by the entrance and the toggle. A pure clock (`lib/coil/shape.ts`) runs a linear `progress` between 0 (band) and 1 (coil) over 756ms and reads the pose through the pull curve; a new scene module (`components/coil/scene/shape.ts`) steps it as a new update step `shape` right after `entrance`, and the cards show one copy of each card in the band. The visitor's choice lives in `CoilStage` state and reaches the scene as a prop; the capsule (`components/coil/ShapeToggle.tsx`) sits in `HeroOverlay`.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript strict, vanilla three 0.186 (no three code changes), Tailwind 3.4 plus one CSS block in `app/globals.css`, vitest, Playwright (Chromium with GPU, local production builds).

**Spec:** `docs/lab-log-2026-10-05.md` ("Controls lab": the toggle's description and Aaron's pick "trailing delay 99ms, no glyphs"; "The Coil and Band toggle (not built)"), `docs/superpowers/plans/2026-10-06-first-public-edition.md` section 6 item 7, `docs/coil-scene-modules.md`, `docs/adr/0001-coil-scene-split.md`, `docs/coil-input-model.md` section 3, and the lab control: `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/controls/copies/Hero.tsx` (`CoilBandToggle`) with `controls.css` ("the Coil and Band toggle"). Worktrees do not carry `AGENTS.md`; read it by absolute path: `/Users/asulbaran21/Personal Projects/aaron-portfolio-website/AGENTS.md`. Layer 1 binds every task.

## Global Constraints

Copied from AGENTS.md Layer 1; every task's requirements include these.

- **No em dashes anywhere.** Body copy, comments, docs, commit messages. Use commas, semicolons, or separate sentences.
- **No hardcoded hex values in component files.** Tokens only.
- **All site copy lives in `lib/content.ts`.** Components import `siteContent` (and the typed exports `WorkItem`, `Photo`, `HomeTile`, `WorkBodySection`); they never embed strings.
- **`prefers-reduced-motion` is respected globally.** The Coil, loader, flight and modal scale collapse to fade-only (no scene at all) when set, live, both directions. Never bypass.
- **Component file size.** Aim under 200 lines; scene modules under 400. `CoilScene.tsx` is a composition root of about 220 lines; a new per-frame concern becomes a `components/coil/scene/` module and a step in `lib/coil/frame.ts`, never more lines in the root.
- **Hero values live only in `lib/coil/constants.ts`** (the scaffold's table 1.1 plus the `lab` block). Never retune by eye in a component.
- GSAP owns scroll, three never writes it, Framer never touches the canvas; no two libraries drive one transform.
- three lives only in the CoilScene chunk. DOM code never imports `lib/coil/{textures,theme,material}` or `components/coil/scene/*`; `cardFace.ts` stays import-free.
- One PR per slice, small commits, never squashed. Opus builders credit themselves: every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (passed as a second `-m`); the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- No agent action may trigger a Vercel production build: production builds only from Aaron's push to `main`; `vercel.json` skips previews; never `vercel deploy`.
- `pnpm dev` and `pnpm build` share `.next`; never both in one checkout.
- Ports: preview 3330 (Fable adds it to `.claude/launch.json`; builders never edit `.claude/`); e2e `E2E_FULL_PORT=3180 E2E_HOLDING_PORT=3181`. Branch `coil-band-toggle`, worktree `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-coil-band-toggle`, PR into `main`.
- Builders stop only servers they started (PID in a shell variable inside the same command); never `pkill`, `killall`, a pattern, or a port they did not open. The e2e command below lets Playwright start and stop its own servers, so nothing needs killing.
- Subagents never write `.md` files; doc edits are the orchestrator's (Task 7).

**The e2e command** (Tasks 5 and 6; `SPECS` is a list of spec files). Playwright builds both modes, serves them on 3180 and 3181 and stops them; a rerun with no source change may prefix `E2E_NO_BUILD=1`.
```bash
lsof -nP -iTCP:3180 -iTCP:3181 -sTCP:LISTEN && { echo "3180 or 3181 is taken: stop and report"; exit 1; }
CI=1 E2E_FULL_PORT=3180 E2E_HOLDING_PORT=3181 pnpm test:e2e $SPECS --project=chromium
```
## Decisions (the orchestrator's rulings, flagged for Aaron's veto)

1. **Placement** (open in the lab log; this fills the gap it left, it overrides no pick; the lab's stand-in corner, flagged for Aaron): bottom left, `bottom-[24px] left-[28px]`, on the Menu pill's glass with an 8px blur, as `copies/Hero.tsx` lays it out. Correction to the brief: there is no "Work and photos" control at rest on `main` (removed 2026-09-29, decision 2.10; `e2e/hero.spec.ts` pins its absence). The only control in that seat is the unwound list's "Coil" wind-back button, shown only while unwound. So the toggle takes the seat alone and **gives it to that button while unwound**: one cross-fade on the unwind's own clock (the toggle's opacity is one minus the button's, `smooth(seg(progress, 0.5, 1))` in `HeroOverlay.unwindFrame`), so the seat is never empty; on the way back the button goes at once and the toggle returns at once, as the button does today. Flagged for Aaron. It shows only while a scene draws (`data-scene="on"`, inherited from `HeroOverlay`'s root), never on the still or under reduced motion, and only once the entrance has rested (`phase === "ready"` with an entrance). It shows on every input, phones included (one object, two drivers).
2. **One value on the pull curve.** `progress` runs linearly between 0 (band) and 1 (coil) over `COIL.toggle.durationMs = 756`: the entrance's pull, `(1 - entrance.pullStart) * entrance.durationMs = (1 - 0.58) * 1800`. The pose is `pullCurve(progress)`, the entrance's `cubic-bezier(0.55, 0, 0.25, 1)` (`COIL.entrance.pullCurve`, built by `pullCurve()` in `lib/coil/entrance.ts`, exported here). Band to coil replays the entrance's last movement exactly; coil to band plays the same curve backward in time; a press mid-switch turns around from the current progress, so the pose never jumps. No new easing.
3. **For the visit only**, coil on every load, no storage. Adjusted from "state in `HomeController`": the state lives in **`CoilStage`**, which renders both readers (the scene and `HeroOverlay`), stays mounted while the scene remounts, and spares `HomeController` (433 lines). Same behavior. A scene that mounts in the band starts there at once, as a rebuild starts at rest.
4. **Reduced motion:** no scene, no toggle. A live switch while in the band unmounts the scene as today; switching back remounts it in the band (3).
5. **Labels and semantics.** Words: "Coil", "Band", group name "Hero layout" (the lab's), in `siteContent.hero.shapeToggle`. Two native buttons with `aria-pressed` in a `role="group"`, not a radiogroup: it is what the lab built, it matches the shipped Flat and Skyline toggle (`components/metrics/skyline/parts.tsx`), and native buttons give Enter and Space with no key handling. Keyboard: Tab to a half, Enter or Space picks it; Shift+Tab back.
6. **The capsule's motion.** The lab's toggle is not the `Fill` primitive's icon family; it is its own two-edge clip (`.tg` in the lab's `controls.css`) in the hero's colorway (glass to accent) on the fill's clock (`--fx-ms` 450ms, `--fx-ease` the reference in-out circ). It ships as a `.shape-toggle` block in `globals.css`; trailing edge `COIL.toggle.trailingDelayMs = 99`. Its buttons never carry the class `fx`: `e2e/controls.spec.ts` finds the hero control as `section[data-scene] button.fx`.
7. **The band spins** on the coil's feeds (idle, wheel, touch drag) **once a switch has landed**. During a switch (0 < progress < 1) the strand holds where the switch began, as the entrance and the unwind already hold it: mid-pull the seam's two ends sit apart (measured at 1440 by 900: 123px at pull 0.2, 431px at 0.5), so a card carried across the seam would jump; a coast or throw under way stops at the press. Flagged for Aaron (the alternative, latching band membership at the switch's start, costs end-fade risk on phones). Hover, picking, a flight and the unwind egg behave identically; the band shows the copy of each card the unwind latches, so the egg and a flight fly the card the visitor sees. Two input paths assumed the rested pose and are adapted (Task 4): the book row's hover-jump and the touch drag's cards per pixel. Accepted as is: the hull used for wheel release is an infinite strip along the axis, so release is more lenient around the band; the seam margin uses the rested card size (equal on desktop with 14 cards, looser on phones).
8. **The first-visit line on phones.** `HintLine` at `bottom-[max(32px,7svh)]` overlaps the toggle at 390 by 844 (about 12 by 5 px with "Tap a card"). Below `sm` it moves to `bottom-[76px]` (24 + 40 + 12). Desktop unchanged.
9. **Drift, not fixed here:** Layer 1 lists blur only on modals, the Menu pill and the playback pill, but the controls slice shipped `backdrop-blur-[8px]` on the hero control on Aaron's pick, and this toggle uses that surface. Layer 1 needs Aaron's edit.

## What the band pose breaks (each handled in a task)

- `entrancePose` decides "in the band" by **absolute** strand position, which works only because the entrance holds the conveyor at 0. After the entrance the idle moves the offset forever; at 1440 by 900 (N 14, M 30) the absolute band leaves the slot window after (M - N) / 2 = 8 cards, about 90s of idle, and the band would empty. The toggle uses a window rule (`bandCopy(u)`, Task 2): exactly the copy the unwind latches (`lib/coil/unwind.ts` latchPositions), given at least two spare slots (M >= N + 2, true on every pane with today's 14 cards).
- `entranceHelix` lerped to pull 1 is not bit-identical to the rest frame (`radius = step / angStep` is recomputed). `pullHelix` returns the rest frame itself at pull 1, so the coil at rest is untouched by the new step (Task 1).
- `hover.ts` `hoverJump` projects with `restHelix` and `geo.cardsPerTurn`; in the band it would aim a card at a turn that does not exist (Task 4).
- `input.ts` `dragCardsPerPx` uses `geo.cardPx`; the band's cards are 79.8px against 160.4px at 390 by 844, so the band would spin twice as fast as the finger (Task 4). On desktop with 14 cards the band's cards are the rest size (216px at 1440 by 900).
- No hero idle screenshot baseline exists: the only committed baseline is `e2e/soundtrack.spec.ts-snapshots/band-still-chromium-darwin.png` (the band canvas, untouched); the hero pixel checks are self-relative diffs; `scripts/render-posters.mjs` hides all DOM. Task 6 adds a masked round-trip pixel check on `?coildebug=still`.

## Review Focus

1. **A switch while the strand moves** (idle, a wheel coast, a touch throw): in the steady band each card hands over to its copy with no pop; mid-switch the strand holds, so no card crosses the seam. Pinned by Task 2's seam and hold tests and Task 5's offset samples.
2. **A second press mid-switch:** the pose turns around from where it is and still finishes in the remaining time. Pinned by Task 2's turnaround test.
3. **A card opened, or the egg unwound, from the band:** the flown card is the one the band shows, and the scene lands back in the band. Pinned by Task 2 (band copies equal the latch), Task 5 (the unwind) and Task 6 (a flight).
4. **A scene rebuilt while in the band** (lost context, reduced motion switched off again): in the band from its first frame, no replayed switch, no entrance. Pinned by Task 2's clock-at-creation test and Task 3's module reading the prop at creation.
5. **The band's smaller cards under input:** a held book row lands its card at the band's front; a phone drag moves with the finger; the phone's first-visit line clears the toggle. Pinned by Task 4's `shapeJump` and `shapeCardPx` tests and Task 5's narrow overlap test.

### Task 0: Worktree and baseline (no files changed)

- [ ] **Step 1: Create the worktree from `main` and install**
```bash
cd "/Users/asulbaran21/Personal Projects/aaron-portfolio-website"
git worktree add -b coil-band-toggle "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-coil-band-toggle" main
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-coil-band-toggle" && pnpm install --frozen-lockfile
```
- [ ] **Step 2: Record the baseline.** Run `pnpm test`. Expected: `Test Files 67 passed (67)`, `Tests 580 passed (580)` (measured on `main` at 278dfe3, 2026-10-08). Any other count: stop and report. Then read `docs/coil-scene-modules.md` ("Adding a feature without growing the root"), `lib/coil/entrance.ts`, `lib/coil/frame.ts`, `components/coil/scene/cards.ts` (`poseSlots`) and `components/coil/HeroOverlay.tsx`.

### Task 1: The pull as a value (`pullHelix`, `outOfBandAlpha`, `pullCurve`) and `COIL.toggle`

**Files:**
- Modify: `lib/coil/entrance.ts` (export `pullCurve`; new `pullHelix`, `outOfBandAlpha`; `entranceHelix` and `entrancePose` delegate)
- Modify: `lib/coil/constants.ts` (a `toggle` block after `entrance`)
- Test: `lib/coil/entrance.test.ts` (append), `lib/coil/shape.test.ts` (create)

**Interfaces:**
- Produces: `pullCurve(c: CoilConstants): (x: number) => number`; `pullHelix(rest: HelixFrame, geo: CoilGeometry, pull: number, c?: CoilConstants): HelixFrame` (returns `rest` itself when `pull >= 1`); `outOfBandAlpha(pull: number): number`; `COIL.toggle.durationMs` (756), `COIL.toggle.trailingDelayMs` (99).

- [ ] **Step 1: Write the failing tests.** Append to `lib/coil/entrance.test.ts` (add `outOfBandAlpha`, `pullCurve`, `pullHelix` and `type EntranceClock` to its import from `@/lib/coil/entrance`; `cases`, `TAU`, `restHelix`, `isRested`, `pullPhases`, `pullProgress` and the `CoilGeometry`, `HelixFrame` types are already in the file). The equivalence test compares against a frozen copy of the old body, since after the refactor `entranceHelix` calls `pullHelix` and comparing the two would be a tautology:
```ts
// entranceHelix as it stood at 278dfe3 (lib/coil/entrance.ts:77-96), frozen for this test.
const legacyLerp = (a: number, b: number, t: number) => a + (b - a) * t;
function legacyEntranceHelix(rest: HelixFrame, geo: CoilGeometry, clock: EntranceClock): HelixFrame {
  if (isRested(clock)) return rest;
  const n = geo.cardCount;
  const pull = pullProgress(clock);
  const { part, wind } = pullPhases(pull);
  const angStep = legacyLerp(TAU / n, rest.angStep, wind);
  return { ...rest, angStep, radius: geo.step / angStep, dy: legacyLerp((COIL.lab.washerPitch / n) * part, rest.dy, wind),
    cardWorld: legacyLerp(geo.bandCardWorld, rest.cardWorld, pull),
    leanRad: legacyLerp(COIL.camera.bandLeanDeg * (Math.PI / 180), rest.leanRad, pull) };
}
describe("the pull as a value (the Coil and Band toggle reuses it)", () => {
  it("reproduces the entrance's frame exactly, swept", () => {
    for (const [, geo] of cases) for (const recede of [COIL.lab.recedeLight, COIL.lab.recedeDark]) {
      const rest = restHelix(geo, recede);
      for (let ms = 0; ms <= 1800; ms += 25) expect(entranceHelix(rest, geo, entranceClock(ms))).toEqual(legacyEntranceHelix(rest, geo, entranceClock(ms)));
    }
  });
  it("is the rest frame itself at pull 1, so the coil at rest is untouched", () => {
    for (const [, geo] of cases) {
      const rest = restHelix(geo);
      expect(pullHelix(rest, geo, 1)).toBe(rest);
      expect(pullHelix(rest, geo, 1.2)).toBe(rest);
    }
  });
  it("closes the band at pull 0: every card on one turn, no rise, the band's size and lean", () => {
    for (const [, geo] of cases) {
      const band = pullHelix(restHelix(geo), geo, 0);
      expect(band.angStep).toBeCloseTo(TAU / geo.cardCount, 12);
      expect(band.dy).toBe(0);
      expect(band.cardWorld).toBe(geo.bandCardWorld);
      expect(band.leanRad).toBeCloseTo((COIL.camera.bandLeanDeg * Math.PI) / 180, 12);
    }
  });
  it("fades the copies outside the band in over pull 0.35 to 0.9", () => {
    expect([outOfBandAlpha(0), outOfBandAlpha(0.35), outOfBandAlpha(0.9), outOfBandAlpha(1)]).toEqual([0, 0, 1, 1]);
    expect(outOfBandAlpha(0.625)).toBeCloseTo(0.5, 9);
  });
  it("the pull curve is the entrance's cubic-bezier(0.55, 0, 0.25, 1)", () => {
    expect(COIL.entrance.pullCurve).toEqual([0.55, 0, 0.25, 1]);
    const curve = pullCurve(COIL);
    expect(curve(0)).toBeCloseTo(0, 9);
    expect(curve(1)).toBeCloseTo(1, 9);
    expect(curve(0.5)).toBeCloseTo(0.6856, 3);
  });
});
```
Create `lib/coil/shape.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
describe("toggle timing", () => {
  it("plays over the entrance's pull: (1 - pullStart) of its 1800ms, 756ms", () => {
    expect(COIL.toggle.durationMs).toBe(Math.round((1 - COIL.entrance.pullStart) * COIL.entrance.durationMs));
    expect(COIL.toggle.durationMs).toBe(756);
  });
  it("trails the capsule's second edge by Aaron's 99ms", () => expect(COIL.toggle.trailingDelayMs).toBe(99));
});
```
- [ ] **Step 2: Verify they fail.** Run `pnpm vitest run lib/coil/entrance.test.ts lib/coil/shape.test.ts`. Expected: FAIL (`pullHelix` not exported; `COIL.toggle` undefined).

- [ ] **Step 3: Implement.** In `lib/coil/constants.ts`, after the `entrance` block:
```ts
  // The Coil and Band toggle (lab log, "Controls lab" and "The Coil and Band
  // toggle"): the band is the entrance's pose at pull 0, so a switch plays
  // the entrance's pull on its curve and over its length, (1 - pullStart) of
  // the entrance: 0.42 of 1800ms. trailingDelayMs is the capsule's trailing
  // edge (Aaron's pick, 2026-10-06: 22 percent of the fill's 450ms).
  toggle: {
    durationMs: 756,
    trailingDelayMs: 99,
  },
```
In `lib/coil/entrance.ts` change `function pullCurve(c: CoilConstants)` to `export function pullCurve(c: CoilConstants)`, and replace `entranceHelix` (its comment included) with:
```ts
// Frame level: the band's winding, radius, rise, card size and lean pulled
// toward the rested helix (`rest` may already carry the stretch envelope) by
// the pull itself: 0 is the closed band; 1 returns the rest frame as is, so a
// rested coil is exactly the rest frame. The Coil and Band toggle
// (lib/coil/shape.ts) drives the same pull.
export function pullHelix(rest: HelixFrame, geo: CoilGeometry, pull: number, c: CoilConstants = COIL): HelixFrame {
  if (pull >= 1) return rest;
  const n = geo.cardCount;
  const { part, wind } = pullPhases(pull, c);
  const angStep = lerp(TAU / n, rest.angStep, wind);
  return {
    ...rest,
    angStep,
    radius: geo.step / angStep,
    dy: lerp((c.lab.washerPitch / n) * part, rest.dy, wind),
    cardWorld: lerp(geo.bandCardWorld, rest.cardWorld, pull),
    leanRad: lerp(c.camera.bandLeanDeg * DEG, rest.leanRad, pull),
  };
}
export function entranceHelix(rest: HelixFrame, geo: CoilGeometry, clock: EntranceClock, c: CoilConstants = COIL): HelixFrame {
  if (isRested(clock)) return rest;
  return pullHelix(rest, geo, pullProgress(clock, c), c);
}
// The copies outside the one band wait hidden and fade in late in the pull.
export function outOfBandAlpha(pull: number) {
  return smooth(seg(pull, 0.35, 0.9));
}
```
In `entrancePose` replace `smooth(seg(pullProgress(clock, c), 0.35, 0.9))` with `outOfBandAlpha(pullProgress(clock, c))`. Nothing else in the entrance changes.

- [ ] **Step 4: Verify they pass.** Run `pnpm vitest run lib/coil/entrance.test.ts lib/coil/shape.test.ts && pnpm tsc --noEmit`. Expected: PASS, every pre-existing entrance test unchanged.

- [ ] **Step 5: Commit**
```bash
git add lib/coil/entrance.ts lib/coil/entrance.test.ts lib/coil/constants.ts lib/coil/shape.test.ts
git commit -m "coil: the pull as a value (pullHelix), and the toggle's timing in COIL.toggle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
### Task 2: The shape clock and the band's cards (`lib/coil/shape.ts`)

**Files:**
- Create: `lib/coil/shape.ts`
- Test: `lib/coil/shape.test.ts` (append)

**Interfaces:**
- Consumes: `pullCurve`, `pullHelix`, `outOfBandAlpha` (Task 1).
- Produces: `type CoilShape = "coil" | "band"`; `type ShapeClock = { progress: number }`; `shapeTarget(shape): 0 | 1`; `createShapeClock(shape): ShapeClock`; `stepShapeClock(clock, shape, dtS, c?): ShapeClock` (mutates, returns it); `shapePull(clock, c?): number`; `isSwitching(clock: ShapeClock): boolean`; `bandCopy(u: number, cardCount: number): boolean`; `shapePose<P extends CardPose>(pose: P, cardCount: number, pull: number): P`.

- [ ] **Step 1: Write the failing tests.** Append to `lib/coil/shape.test.ts` (imports merged at the top):
```ts
import { pullCurve, pullHelix } from "@/lib/coil/entrance";
import { coilPose, mod, poseAt, restHelix, solveGeometry, type CoilGeometry } from "@/lib/coil/geometry";
import { latchPositions } from "@/lib/coil/unwind";
import { bandCopy, createShapeClock, isSwitching, shapePose, shapePull, stepShapeClock } from "@/lib/coil/shape";
const panes = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
const cases: CoilGeometry[] = panes.flatMap((pane) => [14, 20].map((n) => solveGeometry(pane, n)));
const OFFSETS = [0, 3, -7, 0.25, 3.4, -7.49, 41.3, -120.8];
describe("shape clock", () => {
  it("starts at its shape, at rest (a scene rebuilt in the band starts there)", () => {
    expect([createShapeClock("coil").progress, createShapeClock("band").progress]).toEqual([1, 0]);
    expect([shapePull(createShapeClock("coil")), shapePull(createShapeClock("band"))]).toEqual([1, 0]);
  });
  it("reaches the band in 756ms of frames and not before", () => {
    const clock = createShapeClock("coil");
    for (let i = 0; i < 45; i++) stepShapeClock(clock, "band", 1 / 60);
    expect(clock.progress).toBeGreaterThan(0);
    stepShapeClock(clock, "band", 1 / 60);
    expect(clock.progress).toBe(0);
  });
  it("reads the pose through the entrance's pull curve", () => {
    for (const progress of [0.1, 0.3, 0.5, 0.9]) expect(shapePull({ progress })).toBeCloseTo(pullCurve(COIL)(progress), 12);
  });
  it("turns around mid-switch from where it is", () => {
    const clock = createShapeClock("coil");
    stepShapeClock(clock, "band", 0.3);
    const mid = clock.progress;
    expect(mid).toBeCloseTo(1 - 300 / 756, 12);
    stepShapeClock(clock, "coil", 1 / 60);
    expect(clock.progress - mid).toBeCloseTo(1000 / 60 / 756, 12);
    stepShapeClock(clock, "coil", 0.3);
    expect(clock.progress).toBe(1);
  });
  it("holds on a still frame or a stopped scene (no time passes)", () => expect(stepShapeClock({ progress: 0.4 }, "band", 0).progress).toBe(0.4));
});
describe("the band's cards", () => {
  const bandSlots = (geo: CoilGeometry, offset: number) => {
    const frame = pullHelix(restHelix(geo), geo, 0);
    return Array.from({ length: geo.slotCount }, (_, j) => coilPose(frame, j, offset)).filter((pose) => bandCopy(pose.u, geo.cardCount));
  };
  // Needs two spare slots (M >= N + 2): with M == N the window's end copy falls outside the slots or
  // under the strand-end fade. Today's 14 cards give M >= 16 on every pane; the 20-card narrow cases do not.
  it("shows one copy of each card, the copy the unwind latches, all drawn", () => {
    for (const geo of cases.filter((g) => g.slotCount >= g.cardCount + 2)) {
      for (const offset of OFFSETS) {
        const shown = bandSlots(geo, offset);
        expect(new Set(shown.map((pose) => mod(pose.strandPosition, geo.cardCount))).size).toBe(geo.cardCount);
        expect(shown.filter((pose) => pose.alpha > 0.01).length).toBe(geo.cardCount);
        const latched = latchPositions(offset, geo.cardCount).sort((a, b) => a - b);
        expect(shown.map((pose) => pose.strandPosition).sort((a, b) => a - b)).toEqual(latched);
      }
    }
  });
  it("hands each card to its copy at the same spot on the ring, so the turning band never pops", () => {
    for (const geo of cases) {
      const frame = pullHelix(restHelix(geo), geo, 0);
      const leaving = poseAt(frame, geo.cardCount / 2 - 1e-9).position;
      const arriving = poseAt(frame, -geo.cardCount / 2 - 1e-9).position;
      expect(Math.hypot(leaving[0] - arriving[0], leaving[1] - arriving[1], leaving[2] - arriving[2])).toBeLessThan(1e-6);
    }
  });
  it("mid-switch the seam's two ends sit apart, so the strand must hold", () => {
    for (const geo of cases) for (const pull of [0.05, 0.2, 0.5, 0.8]) {
      const frame = pullHelix(restHelix(geo), geo, pull);
      const a = poseAt(frame, geo.cardCount / 2 - 1e-9).position;
      const b = poseAt(frame, -geo.cardCount / 2 - 1e-9).position;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(1e-3);
    }
    expect([0, 0.3, 1].map((progress) => isSwitching({ progress }))).toEqual([false, true, false]);
  });
  it("leaves every pose alone at pull 1, and hides the other copies at pull 0", () => {
    const geo = cases[0];
    const frame = pullHelix(restHelix(geo), geo, 0);
    for (let j = 0; j < geo.slotCount; j++) {
      const pose = coilPose(frame, j, 3.4);
      expect(shapePose(pose, geo.cardCount, 1)).toBe(pose);
      expect(shapePose(pose, geo.cardCount, 0).alpha).toBe(bandCopy(pose.u, geo.cardCount) ? pose.alpha : 0);
    }
  });
});
```
- [ ] **Step 2: Verify they fail.** Run `pnpm vitest run lib/coil/shape.test.ts`. Expected: FAIL (cannot resolve `@/lib/coil/shape`).

- [ ] **Step 3: Implement `lib/coil/shape.ts`**
```ts
import { COIL, type CoilConstants } from "./constants";
import { outOfBandAlpha, pullCurve } from "./entrance";
import type { CardPose } from "./geometry";
// The Coil and Band toggle's pure half (lab log, "The Coil and Band
// toggle"). The band is the entrance's pose at pull 0 (entrance.ts,
// pullHelix). One value, `progress`, runs linearly in time between 0 (the
// band) and 1 (the coil) over COIL.toggle.durationMs, the pull's own length;
// the pose reads it through the entrance's pull curve, so band to coil
// replays the entrance's last movement and coil to band plays it backward. A
// press mid-switch turns around from where it is.
export type CoilShape = "coil" | "band";
export type ShapeClock = { progress: number };
export const shapeTarget = (shape: CoilShape): 0 | 1 => (shape === "band" ? 0 : 1);
// A scene that mounts in a shape starts there, as a rebuild starts at rest.
export function createShapeClock(shape: CoilShape): ShapeClock {
  return { progress: shapeTarget(shape) };
}
// Toward the shape by dtS seconds; no time (a still frame, a stopped scene) holds it.
export function stepShapeClock(clock: ShapeClock, shape: CoilShape, dtS: number, c: CoilConstants = COIL): ShapeClock {
  const target = shapeTarget(shape);
  const step = (Math.max(0, dtS) * 1000) / c.toggle.durationMs;
  clock.progress = clock.progress < target ? Math.min(target, clock.progress + step) : Math.max(target, clock.progress - step);
  return clock;
}
// Mid-switch the seam's two ends sit apart, so the scene holds the strand (scene/shape.ts).
export function isSwitching(clock: ShapeClock) {
  return clock.progress > 0 && clock.progress < 1;
}
export function shapePull(clock: ShapeClock, c: CoilConstants = COIL) {
  if (clock.progress >= 1) return 1;
  if (clock.progress <= 0) return 0;
  return pullCurve(c)(clock.progress);
}
// The band shows one copy of each card: the one in the window (-N/2, N/2]
// around the strand's center (u is the slot's window position), which is
// exactly the copy the unwind latches (unwind.ts latchPositions, half up), so
// the egg and a flight fly the card the band shows. Every copy is drawn when
// the strand has two spare slots (M >= N + 2; 14 cards give M >= 16).
export function bandCopy(u: number, cardCount: number) {
  return u > -cardCount / 2 && u <= cardCount / 2;
}
// Card level: toward and in the band, the other copies fade as in the entrance's pull.
export function shapePose<P extends CardPose>(pose: P, cardCount: number, pull: number): P {
  if (pull >= 1 || bandCopy(pose.u, cardCount)) return pose;
  return { ...pose, alpha: pose.alpha * outOfBandAlpha(pull) };
}
```
- [ ] **Step 4: Verify they pass.** Run `pnpm vitest run lib/coil/shape.test.ts lib/coil/entrance.test.ts && pnpm tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/coil/shape.ts lib/coil/shape.test.ts
git commit -m "coil: the shape clock and the band's one copy per card (lib/coil/shape)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
### Task 3: The `shape` frame step and its scene module

**Files:**
- Modify: `lib/coil/frame.ts`, `lib/coil/frame.test.ts`
- Create: `components/coil/scene/shape.ts`
- Modify: `components/coil/scene/state.ts`, `components/coil/scene/loop.ts`, `components/coil/scene/cards.ts`, `components/coil/scene/types.ts`, `components/coil/scene/debug.ts`, `components/coil/CoilScene.tsx`, `e2e/support/hooks.ts`

**Interfaces:**
- Consumes: `createShapeClock`, `stepShapeClock`, `shapePull`, `isSwitching`, `shapePose`, `CoilShape` (Task 2); `pullHelix`, `isRested` (`lib/coil/entrance.ts`).
- Produces: `UpdateSteps.shape`; `SceneFrame.shapePull: number` (1 coil, 0 band); `CoilSceneProps.shape?: CoilShape`; `createShape(ctx): { step(f: SceneFrame): void; state(): { target: CoilShape; progress: number; pull: number; angStep: number } }`; `window.__coil.shape(): ShapeProbe`, `ShapeProbe = { target: CoilShape; progress: number; pull: number; angStep: number; bandAngStep: number; restAngStep: number | null; shown: number }`.

- [ ] **Step 1: Write the failing test.** In `lib/coil/frame.test.ts` insert `"shape",` after `"entrance",` in `UPDATE`, and change the throw test's expectation to `["scroll", "conveyor", "helix", "entrance", "shape", "rebuild", "unwind"]`.

- [ ] **Step 2: Verify it fails.** Run `pnpm vitest run lib/coil/frame.test.ts`. Expected: FAIL (the recorded calls lack `shape`).

- [ ] **Step 3: The step in `lib/coil/frame.ts`.** Add `shape: (frame: F) => void;` after `entrance` in `UpdateSteps<F>`, and `steps.shape(frame);` after `steps.entrance(frame);` in `runUpdate`. In the top comment (lines 10 and 11, where "entrance (the" ends line 10 and "strand held until the band opens; the name's fade), rebuild fade, unwind" runs on line 11) insert `shape (the Coil and Band toggle's pull),` before `rebuild fade,` and reflow the comment. Run `pnpm vitest run lib/coil/frame.test.ts`: PASS. `pnpm tsc --noEmit` now fails in `CoilScene.tsx` (its step table lacks `shape`); Steps 4 to 7 fix it.

- [ ] **Step 4: Create `components/coil/scene/shape.ts`**
```ts
import { isRested, pullHelix } from "@/lib/coil/entrance";
import type { HelixFrame } from "@/lib/coil/geometry";
import { createShapeClock, isSwitching, shapePull, stepShapeClock } from "@/lib/coil/shape";
import type { SceneCtx, SceneFrame } from "./state";
// The Coil and Band toggle: the helix pulled toward the entrance's closed band
// by one value on the pull curve (lib/coil/shape.ts). The shape is a prop
// (CoilStage holds the choice); a scene mounted in the band starts there. It
// waits for the entrance to rest; a stopped scene holds it (no time passes).
// Mid-switch it holds the strand where the switch began, as the entrance and
// the unwind do: the seam's two ends sit apart, so a crossing card would jump.
export function createShape(ctx: SceneCtx) {
  const { live, st } = ctx;
  const clock = createShapeClock(live.current.shape ?? "coil");
  let angStep = 0;
  let held: number | null = null;
  // Update step, after the entrance.
  function step(f: SceneFrame) {
    if (f.clock && !isRested(f.clock)) {
      f.shapePull = 1;
    } else {
      stepShapeClock(clock, f.props.shape ?? "coil", f.dt);
      if (isSwitching(clock)) {
        held ??= st.conveyor.offset;
        Object.assign(st.conveyor, { offset: held, target: held, velocity: 0, excessVelocity: 0, glide: null });
        st.coast = null;
      } else held = null;
      f.shapePull = shapePull(clock);
      f.helix = pullHelix(f.helix as HelixFrame, f.geo, f.shapePull);
    }
    angStep = (f.helix as HelixFrame).angStep;
  }
  function state() {
    return { target: live.current.shape ?? "coil", progress: clock.progress, pull: shapePull(clock), angStep };
  }
  return { step, state };
}
export type Shape = ReturnType<typeof createShape>;
```
- [ ] **Step 5: Thread the pull and the prop**
  - `scene/state.ts`, in `SceneFrame` after `rebuilt: number;`: `shapePull: number; // the Coil and Band toggle: 1 the coil, 0 the band (scene/shape.ts)`
  - `scene/loop.ts`, in the record passed to `runUpdate`, after `rebuilt: 1,`: `shapePull: 1,`
  - `scene/types.ts`: `import type { CoilShape } from "@/lib/coil/shape";`, and in `CoilSceneProps` after `onEntranceEnd` the comment `// The Coil and Band toggle: the shape the visitor picked (the coil when absent).` and `shape?: CoilShape;`
  - `scene/cards.ts`: `import { shapePose } from "@/lib/coil/shape";`; `shapePull: number;` in `CardFrame` after `rebuilt`; in `poseSlots`, directly after the `entrancePose` line: `pose = shapePose(pose, tileCount, f.shapePull);`

- [ ] **Step 6: The QA hook.** In `scene/debug.ts` add `import type { CoilShape } from "@/lib/coil/shape";` and `import type { Shape } from "./shape";`; in `DebugStats` after `entrance?: () => object;`:
```ts
  // The Coil and Band toggle: the shape asked for, the clock (0 band, 1
  // coil), the pull, this frame's angular step beside the band's and the
  // rest's, and how many cards show.
  shape?: () => ShapeProbe;
```
Export the type, add `shape: Shape;` to `HookParts` after `entrance`, destructure it in `installSceneHooks`, and set the hook after `debug.entrance = ...`:
```ts
export type ShapeProbe = { target: CoilShape; progress: number; pull: number; angStep: number; bandAngStep: number; restAngStep: number | null; shown: number };
```
```ts
  debug.shape = () => ({
    ...shape.state(), bandAngStep: (Math.PI * 2) / tileCount, restAngStep: st.geo?.angStep ?? null,
    shown: st.rendered.filter((pose) => pose && pose.alpha > 0.01).length,
  });
```
In `e2e/support/hooks.ts`, `CoilHooks`, after `entrance`: the comment `// The Coil and Band toggle (scene/shape.ts).` and `shape: () => { target: "coil" | "band"; progress: number; pull: number; angStep: number; bandAngStep: number; restAngStep: number | null; shown: number };`

- [ ] **Step 7: Wire the root (three lines).** In `components/coil/CoilScene.tsx`: `import { createShape } from "./scene/shape";` after the `createProbe` import; `const shape = createShape(ctx);` after `const entrance = createEntrance(ctx, heroName);`; `shape: shape.step,` after `entrance: entrance.entrance,` in the step table; `shape` after `entrance` in the `installSceneHooks` parts. In the top comment change "helix frame, entrance, rebuild fade," to "helix frame, entrance, shape (the Coil and Band toggle), rebuild fade,". Check `wc -l components/coil/CoilScene.tsx` is at most 250.

- [ ] **Step 8: Verify.** Run `pnpm test && pnpm tsc --noEmit && pnpm lint`. Expected: 68 files (67 plus `lib/coil/shape.test.ts`), all PASS; tsc and lint clean.

- [ ] **Step 9: Commit**
```bash
git add lib/coil/frame.ts lib/coil/frame.test.ts components/coil/scene/shape.ts components/coil/scene/state.ts components/coil/scene/loop.ts components/coil/scene/cards.ts components/coil/scene/types.ts components/coil/scene/debug.ts components/coil/CoilScene.tsx e2e/support/hooks.ts
git commit -m "coil: the shape step pulls the band on the entrance curve once the entrance rests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
### Task 4: A held book row and a phone drag in the band

**Files:**
- Modify: `lib/coil/shape.ts` (`shapeJump`, `shapeCardPx`), `components/coil/scene/hover.ts` (`hoverJump`), `components/coil/scene/input.ts` (`dragCardsPerPx`)
- Test: `lib/coil/shape.test.ts` (append)

**Interfaces:**
- Consumes: `pullHelix` (Task 1); `bandCopy`, `CoilShape` (Task 2); `hoverJumpTarget` (`lib/coil/motion.ts`).
- Produces: `type ShapeJump = { frame: HelixFrame; cardsPerTurn: number; maxU: number }`; `shapeJump(geo: CoilGeometry, rest: HelixFrame, shape: CoilShape, c?: CoilConstants): ShapeJump`; `shapeCardPx(geo: CoilGeometry, shape: CoilShape): number`.

- [ ] **Step 1: Write the failing tests.** Append to `lib/coil/shape.test.ts` (add `shapeCardPx`, `shapeJump` to the shape import, and `import { hoverJumpTarget } from "@/lib/coil/motion";`):
```ts
describe("the band's input", () => {
  it("drags at the size of the cards shown", () => {
    for (const geo of cases) {
      expect(shapeCardPx(geo, "coil")).toBe(geo.cardPx);
      expect(shapeCardPx(geo, "band")).toBeCloseTo(geo.bandCardWorld / geo.camera.worldPerPx, 9);
    }
    const phone = solveGeometry({ width: 390, height: 844 }, 14);
    expect(shapeCardPx(phone, "band") / shapeCardPx(phone, "coil")).toBeLessThan(0.6);
  });
  it("aims the coil's hover-jump as today", () => {
    for (const geo of cases) {
      const rest = restHelix(geo);
      expect(shapeJump(geo, rest, "coil")).toEqual({ frame: rest, cardsPerTurn: geo.cardsPerTurn, maxU: geo.slotCount / 2 - COIL.lab.endFadeSlots });
      expect(shapeJump(geo, rest, "coil").frame).toBe(rest);
    }
  });
  it("lands a held row's card at the front of the band, on the copy the band shows", () => {
    const anywhere = { top: -1e6, bottom: 1e6, left: -1e6, right: 1e6 };
    for (const geo of cases) {
      const jump = shapeJump(geo, restHelix(geo), "band");
      expect(jump.cardsPerTurn).toBe(geo.cardCount);
      for (const offset of OFFSETS) {
        for (let tile = 0; tile < geo.cardCount; tile++) {
          const { to, arrival } = hoverJumpTarget(tile, offset, geo.cardCount, jump.cardsPerTurn, jump.maxU, () => ({ x: 0, y: 0 }), anywhere);
          expect(arrival).not.toBeNull();
          expect(Math.abs(arrival as number)).toBeLessThanOrEqual(1);
          expect(mod(Math.round((arrival as number) - to), geo.cardCount)).toBe(tile);
          expect(bandCopy(arrival as number, geo.cardCount)).toBe(true);
        }
      }
    }
  });
});
```
- [ ] **Step 2: Verify they fail.** Run `pnpm vitest run lib/coil/shape.test.ts`. Expected: FAIL (`shapeJump`, `shapeCardPx` not exported).

- [ ] **Step 3: Implement.** In `lib/coil/shape.ts` change the imports to `import { outOfBandAlpha, pullCurve, pullHelix } from "./entrance";` and `import type { CardPose, CoilGeometry, HelixFrame } from "./geometry";`, then append:
```ts
// The book row's hover-jump (scene/hover.ts) aims a card at the front of a
// turn on this frame: the rest helix on the coil; in the band one turn of all
// N cards, inside the band's window. A switch under way aims at the shape it
// is heading to.
export type ShapeJump = { frame: HelixFrame; cardsPerTurn: number; maxU: number };
export function shapeJump(geo: CoilGeometry, rest: HelixFrame, shape: CoilShape, c: CoilConstants = COIL): ShapeJump {
  if (shape === "coil") return { frame: rest, cardsPerTurn: geo.cardsPerTurn, maxU: geo.slotCount / 2 - c.lab.endFadeSlots };
  return { frame: pullHelix(rest, geo, 0, c), cardsPerTurn: geo.cardCount, maxU: geo.cardCount / 2 - 1 };
}
// A card's height in CSS px in a shape: the touch drag moves one card per
// card of finger travel (scene/input.ts).
export function shapeCardPx(geo: CoilGeometry, shape: CoilShape) {
  return shape === "band" ? geo.bandCardWorld / geo.camera.worldPerPx : geo.cardPx;
}
```
- [ ] **Step 4: Wire the scene.** In `components/coil/scene/hover.ts` add `import { shapeJump } from "@/lib/coil/shape";` and in `hoverJump` replace the lines from `const frame = restHelix(...)` through the `hoverJumpTarget(...)` call (the `frame`, `camera` and `maxU` constants and the call) with:
```ts
    const jump = shapeJump(st.geo, restHelix(st.geo, st.theme.card.recede), props.shape ?? "coil");
    const camera = st.geoCamera;
    const { to } = hoverJumpTarget(tile, conveyor.offset, tileCount, jump.cardsPerTurn, jump.maxU, (u) =>
      projectPoint(camera, poseAt(jump.frame, u).position), band);
```
(`props` is `live.current` at the top of `hoverJump`; `COIL` stays imported for `rowHold`.) In `components/coil/scene/input.ts` add `import { shapeCardPx } from "@/lib/coil/shape";` and make `dragCardsPerPx` return `1 / Math.max(1, st.geo.step * shapeCardPx(st.geo, live.current.shape ?? "coil") * Math.cos(st.geo.axisRad));`.

- [ ] **Step 5: Verify.** Run `pnpm test && pnpm tsc --noEmit && pnpm lint`. Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add lib/coil/shape.ts lib/coil/shape.test.ts components/coil/scene/hover.ts components/coil/scene/input.ts
git commit -m "coil: a held row and a phone drag follow the band's own turn and card size" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
### Task 5: The capsule (`ShapeToggle`), its seat and its state

**Files:**
- Modify: `lib/content.ts` (`siteContent.hero.shapeToggle`), `app/globals.css` (a `.shape-toggle` block after "The fill" block, before the "Metrics" comment), `components/coil/CoilStage.tsx`, `components/coil/HeroOverlay.tsx`
- Create: `components/coil/ShapeToggle.tsx`
- Test: `e2e/toggle.spec.ts` (create)

**Interfaces:**
- Consumes: `CoilShape` (Task 2); `COIL.toggle.trailingDelayMs` (Task 1); `CoilSceneProps.shape`, `window.__coil.shape()` (Task 3).
- Produces: `ShapeToggle({ ref, shape, onShapeChange, entrance, listOn })` (it decides its own seat); `HeroOverlay` props `shape: CoilShape` and `onShapeChange: (shape: CoilShape) => void`; DOM hooks `[data-shape-toggle]` (the group) and `[data-hint-line]` (the first-visit line).

- [ ] **Step 1: Write the failing spec, `e2e/toggle.spec.ts`**
```ts
import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome } from "./support/coil";
import { settled } from "./support/fallback";
import type { HookWindow } from "./support/hooks";
import { noWebgl2Api } from "./support/webgl";
// The Coil and Band toggle (lab log, "Controls lab"): a capsule at the
// hero's bottom left that pulls the coil into the entrance's band and back,
// shown only while a scene runs and the entrance has rested.
const labels = siteContent.hero.shapeToggle;
const toggle = (page: Page) => page.getByRole("group", { name: labels.ariaLabel });
const half = (page: Page, name: string) => toggle(page).getByRole("button", { name, exact: true });
const shape = (page: Page) => page.evaluate(() => (window as HookWindow).__coil!.shape());
const cardCount = async (page: Page) => Number((await page.evaluate(() => (window as HookWindow).__coil!.budget())).cards);
async function waitForPull(page: Page, pull: 0 | 1) {
  await page.waitForFunction((p) => (window as HookWindow).__coil!.shape().pull === p, pull, { timeout: 5_000 });
  await nextFrames(page, 2);
}
test("toggle: hidden through the loader and the entrance, then shown with Coil pressed", async ({ page }) => {
  await page.addInitScript(() => {
    const seen: boolean[] = ((window as unknown as { __toggleSeen: boolean[] }).__toggleSeen = []);
    const tick = () => {
      const el = document.querySelector("[data-shape-toggle]");
      if (document.documentElement.dataset.home !== "ready") seen.push(!!el && el.checkVisibility({ visibilityProperty: true }));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openHome(page);
  const before = await page.evaluate(() => (window as unknown as { __toggleSeen: boolean[] }).__toggleSeen);
  expect(before.length, "frames sampled before ready").toBeGreaterThan(0);
  expect(before.filter(Boolean), "frames showing the toggle before ready").toEqual([]);
  await expect(toggle(page)).toBeVisible();
  await expect(half(page, labels.coil)).toHaveAttribute("aria-pressed", "true");
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "false");
  expect(await shape(page)).toMatchObject({ target: "coil", pull: 1 });
});
test("toggle: Band pulls the coil into the entrance's band over the pull, Coil winds it back", async ({ page }) => {
  await openHome(page);
  const cards = await cardCount(page);
  await page.evaluate(() => {
    const w = window as HookWindow & { __held?: number[] };
    const held: number[] = (w.__held = []);
    const tick = () => {
      const now = w.__coil!.shape();
      if (now.progress > 0 && now.progress < 1) held.push(w.__coil!.offset());
      if (now.pull !== 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const startedAt = await page.evaluate(() => performance.now());
  await half(page, labels.band).click();
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(() => (window as HookWindow).__coil!.shape().pull === 0, null, { timeout: 5_000 });
  const tookMs = (await page.evaluate(() => performance.now())) - startedAt;
  expect(tookMs, "the switch animates over the pull").toBeGreaterThan(COIL.toggle.durationMs * 0.8);
  await nextFrames(page, 2);
  const band = await shape(page);
  expect(band.angStep).toBeCloseTo(band.bandAngStep, 9);
  expect(band.shown, "one copy of each card").toBe(cards);
  const held = await page.evaluate(() => (window as unknown as { __held: number[] }).__held);
  expect(held.length, "frames sampled mid-switch").toBeGreaterThan(10);
  expect(new Set(held).size, "the strand holds through the switch").toBe(1);
  await half(page, labels.coil).click();
  await waitForPull(page, 1);
  const coil = await shape(page);
  expect(coil.angStep).toBe(coil.restAngStep);
  expect(coil.shown).toBeGreaterThan(cards);
});
test("toggle: the keyboard reaches each half and Space or Enter picks it", async ({ page }) => {
  await openHome(page);
  await half(page, labels.coil).focus();
  await page.keyboard.press("Tab");
  await expect(half(page, labels.band)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "true");
  await waitForPull(page, 0);
  await page.keyboard.press("Shift+Tab");
  await expect(half(page, labels.coil)).toBeFocused();
  await page.keyboard.press("Enter");
  await waitForPull(page, 1);
});
test("toggle: cross-fades its seat to the unwound list's Coil control, and comes back in the band", async ({ page }) => {
  await openHome(page);
  await half(page, labels.band).click();
  await waitForPull(page, 0);
  await page.evaluate(() => {
    const seat: number[][] = ((window as unknown as { __seat: number[][] }).__seat = []);
    const op = (sel: string) => Number(getComputedStyle(document.querySelector(sel)!).opacity);
    const tick = () => {
      seat.push([op("[data-shape-toggle]"), op("section[data-scene] button.fx")]);
      if (seat.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => (window as HookWindow).__coil!.api.unwind(true));
  await page.waitForFunction(() => (window as HookWindow).__coil!.unwindState().progress === 1, null, { timeout: 5_000 });
  await expect(toggle(page)).toBeHidden();
  const seat = await page.evaluate(() => (window as unknown as { __seat: number[][] }).__seat);
  expect(seat.filter(([a, b]) => Math.abs(a + b - 1) > 0.01), "one cross-fade, the seat never empty").toEqual([]);
  await page.evaluate(() => (window as HookWindow).__coil!.api.unwind(false));
  await page.waitForFunction(() => (window as HookWindow).__coil!.unwindState().progress === 0, null, { timeout: 5_000 });
  await expect(toggle(page)).toBeVisible();
  expect(await shape(page)).toMatchObject({ pull: 0, shown: await cardCount(page) });
});
test("toggle: on a phone-width pane the first-visit line clears it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const overlap = await page.evaluate((text) => {
    const line = document.querySelector<HTMLElement>("[data-hint-line]")!;
    line.textContent = text;
    const a = line.getBoundingClientRect();
    const b = document.querySelector("[data-shape-toggle]")!.getBoundingClientRect();
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }, siteContent.hero.hints.tapCard);
  expect(overlap).toBe(0);
});
async function expectNoToggle(page: Page) {
  await page.goto("/");
  await settled(page);
  await expect(toggle(page)).toBeHidden();
}
test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("toggle: no scene, no toggle", async ({ page }) => expectNoToggle(page));
});
test("toggle: the still fallback (no WebGL 2) has no toggle", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  await expectNoToggle(page);
});
```
- [ ] **Step 2: Verify it fails.** Run the e2e command with `SPECS=e2e/toggle.spec.ts`. Expected: FAIL (`siteContent.hero.shapeToggle` undefined; no group named "Hero layout").

- [ ] **Step 3: The copy.** In `lib/content.ts`, in `hero` after `coilControl: "Coil",`:
```ts
    // The Coil and Band toggle: the group's name and its two halves
    // (placeholders; words and no glyphs per Aaron's pick).
    shapeToggle: { ariaLabel: "Hero layout", coil: "Coil", band: "Band" },
```
- [ ] **Step 4: The component, `components/coil/ShapeToggle.tsx`**
```tsx
"use client";
import { useState, type CSSProperties, type Ref } from "react";
import { useHomeController } from "@/components/home/HomeController";
import { siteContent } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import type { CoilShape } from "@/lib/coil/shape";
import type { CoilEntrance } from "./CoilScene";
// The Coil and Band toggle (lab log, "Controls lab"; Aaron's pick: trailing
// delay 99ms, no glyphs): a two-half capsule whose selection is a fill over a
// second, aria-hidden and inert copy of both labels (as Fill's; globals.css,
// "The Coil and Band toggle"). Native buttons with aria-pressed, as the Flat
// and Skyline toggle. Never the class fx (controls.spec finds the hero
// control as section[data-scene] button.fx). It shows once the entrance has
// rested (the overlay's root adds the data-scene gate) and is inert while the
// unwound list holds its seat; HeroOverlay cross-fades it through `ref`.
const SHAPES: readonly CoilShape[] = ["coil", "band"];
const LAG = { "--tg-lag": `${COIL.toggle.trailingDelayMs}ms` } as CSSProperties;
const HALF = "flex h-10 items-center justify-center px-4 font-label text-label leading-none";
type Props = {
  ref?: Ref<HTMLDivElement>; shape: CoilShape; onShapeChange: (shape: CoilShape) => void; entrance: CoilEntrance | null; listOn: boolean;
};
export function ShapeToggle({ ref, shape, onShapeChange, entrance, listOn }: Props) {
  const controller = useHomeController();
  const rested = controller?.phase === "ready" && entrance !== null;
  const [dir, setDir] = useState<"left" | "right" | "none">("none");
  const labels = siteContent.hero.shapeToggle;
  const pick = (next: CoilShape) => {
    if (next === shape) return;
    setDir(next === "band" ? "right" : "left");
    onShapeChange(next);
  };
  return (
    <div
      ref={ref}
      role="group"
      aria-label={labels.ariaLabel}
      data-shape-toggle
      data-state={shape}
      data-dir={dir}
      inert={!rested || listOn}
      style={LAG}
      className={`shape-toggle pointer-events-auto absolute bottom-[24px] left-[28px] ${rested ? "" : "invisible"}`}
    >
      <span className="shape-toggle__base grid grid-cols-2">
        {SHAPES.map((key) => (
          <button key={key} type="button" data-seg={key} aria-pressed={shape === key} onClick={() => pick(key)} className={`shape-toggle__seg ${HALF}`}>
            {labels[key]}
          </button>
        ))}
      </span>
      <span aria-hidden="true" inert className="shape-toggle__over grid grid-cols-2">
        {SHAPES.map((key) => <span key={key} className={HALF}>{labels[key]}</span>)}
      </span>
    </div>
  );
}
```
- [ ] **Step 5: The CSS.** Insert in `app/globals.css` after the fill block's reduced-motion rule, before the "Metrics" comment (tokens only; the lab's `.tg` rules renamed):
```css
/* The Coil and Band toggle (components/coil/ShapeToggle.tsx; lab log,
   "Controls lab"). The selection is a fill: an accent clip over a second
   copy of both labels, its edges --tg-a and --tg-b, on the fill's clock. On a
   switch the leading edge goes first and the trailing edge follows --tg-lag
   later (COIL.toggle.trailingDelayMs). Hovering or focusing the other half
   leans the leading edge toward it. On the Menu pill's glass. */
@property --tg-a { syntax: "<number>"; inherits: true; initial-value: 0; }
@property --tg-b { syntax: "<number>"; inherits: true; initial-value: 0.5; }
.shape-toggle {
  --tg-a: 0; --tg-b: 0.5; --tg-da: 0ms; --tg-db: 0ms; --tg-pad: 3px;
  display: grid; border-radius: 999px; background: var(--menu-pill);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 0 0 1px var(--color-border);
  transition: --tg-a var(--fx-ms) var(--fx-ease) var(--tg-da), --tg-b var(--fx-ms) var(--fx-ease) var(--tg-db);
}
.shape-toggle[data-state="band"] { --tg-a: 0.5; --tg-b: 1; }
.shape-toggle[data-dir="right"] { --tg-da: var(--tg-lag); }
.shape-toggle[data-dir="left"] { --tg-db: var(--tg-lag); }
@media (hover: hover) {
  .shape-toggle[data-state="coil"]:has([data-seg="band"]:hover) { --tg-b: 0.57; }
  .shape-toggle[data-state="band"]:has([data-seg="coil"]:hover) { --tg-a: 0.43; }
}
.shape-toggle[data-state="coil"]:has([data-seg="band"]:focus-visible) { --tg-b: 0.57; }
.shape-toggle[data-state="band"]:has([data-seg="coil"]:focus-visible) { --tg-a: 0.43; }
.shape-toggle:has(:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 3px; }
.shape-toggle > .shape-toggle__base,
.shape-toggle > .shape-toggle__over { grid-area: 1 / 1; }
.shape-toggle > .shape-toggle__over {
  pointer-events: none; border-radius: 999px; background: var(--color-accent); color: var(--color-background);
  clip-path: inset(
    var(--tg-pad) calc((1 - var(--tg-b)) * (100% - 2 * var(--tg-pad)) + var(--tg-pad)) var(--tg-pad)
      calc(var(--tg-a) * (100% - 2 * var(--tg-pad)) + var(--tg-pad)) round 999px
  );
}
.shape-toggle__seg { color: var(--color-muted); transition: color 200ms var(--ease-out); }
.shape-toggle__seg:hover { color: var(--color-foreground); }
.shape-toggle__seg:focus-visible { outline: none; }
@media (prefers-reduced-motion: reduce) { .shape-toggle { transition: none !important; } }
```
- [ ] **Step 6: The state and the seat.** In `components/coil/CoilStage.tsx` add `import type { CoilShape } from "@/lib/coil/shape";` and, after `const ownApiRef = ...`:
```ts
  // The Coil and Band toggle: the visitor's choice for this visit (coil on
  // every load, no storage), held here beside both readers so a scene that
  // remounts keeps it.
  const [shape, setShape] = useState<CoilShape>("coil");
```
Pass `shape={shape}` to `<Scene ... />` after `onEntranceEnd`, and render `<HeroOverlay ref={overlayRef} api={apiRef} onRowOpen={onRowOpen} entrance={entrance} shape={shape} onShapeChange={setShape} />`.

In `components/coil/HeroOverlay.tsx` import `{ ShapeToggle }` from `"./ShapeToggle"` and `type { CoilShape }` from `"@/lib/coil/shape"`; add to `Props`:
```ts
  // The Coil and Band toggle: the shape in use and the visitor's pick.
  shape: CoilShape;
  onShapeChange: (shape: CoilShape) => void;
```
Destructure `shape, onShapeChange` in `HeroOverlay`, add `const seatRef = useRef<HTMLDivElement>(null);` beside `coilControlRef`, and in the handle's `unwindFrame` replace the `const coil = coilControlRef.current; if (coil) { const shown = ...; ... }` block with:
```ts
        const coil = coilControlRef.current;
        const shown = on ? smooth(seg(progress, 0.5, 1)) : 0;
        if (coil) {
          coil.style.opacity = shown.toFixed(3);
          coil.style.visibility = shown > 0.01 ? "visible" : "hidden";
        }
        // The toggle and the Coil control share one seat: one cross-fade on the unwind's clock.
        const seat = seatRef.current;
        if (seat) {
          seat.style.opacity = (1 - shown).toFixed(3);
          seat.style.visibility = shown > 0.99 ? "hidden" : "";
        }
```
Directly before the wind-back `<Fill ref={coilControlRef} ...>`: `<ShapeToggle ref={seatRef} shape={shape} onShapeChange={onShapeChange} entrance={entrance} listOn={listOn} />`. The seat rule lives in `ShapeToggle`, so these two files grow as little as possible: `HeroOverlay.tsx` (381 lines) and `CoilStage.tsx` (212) were already over Layer 1's 200-line aim before this slice, and it adds about 16 and 5. In `HintLine`'s `<p>` add the attribute `data-hint-line` and change `bottom-[max(32px,7svh)]` to `bottom-[max(32px,7svh)] max-sm:bottom-[76px]`.

- [ ] **Step 7: Verify.** Run the e2e command with `SPECS="e2e/toggle.spec.ts e2e/hero.spec.ts e2e/controls.spec.ts e2e/a11y.spec.ts"`. Expected: PASS (the toggle's 7 tests; hero, controls and a11y unchanged). Then `pnpm test && pnpm tsc --noEmit && pnpm lint`: PASS.

- [ ] **Step 8: Commit**
```bash
git add lib/content.ts components/coil/ShapeToggle.tsx app/globals.css components/coil/CoilStage.tsx components/coil/HeroOverlay.tsx e2e/toggle.spec.ts
git commit -m "hero: the Coil and Band toggle at the bottom left, on the Menu pill's glass" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
### Task 6: Guards (a flight from the band, the still frame after a round trip) and the full run

**Files:**
- Modify: `e2e/toggle.spec.ts` (two tests appended), `e2e/support/hooks.ts` (`quadOf: (slot: number) => Quad | null;` in `CoilHooks.api`; the scene api already has it, `components/coil/scene/api.ts`)

- Consumes: `coilPoints` (`e2e/support/coil.ts`), `decodePng`, `Image` (`e2e/support/pixels.ts`).

These guard what Tasks 3 to 5 built and are expected to pass on their first run. A failure is a defect in those tasks: fix it there (with a failing unit test first where the cause is pure), never by loosening a guard.

- [ ] **Step 1: Append the guards.** Add `coilPoints` to the `./support/coil` import and `import { decodePng, type Image } from "./support/pixels";`:
```ts
function maxChannelDelta(a: Image, b: Image) {
  let max = 0;
  for (let i = 0; i < a.rgba.length; i++) if ((i & 3) !== 3) max = Math.max(max, Math.abs(a.rgba[i] - b.rgba[i]));
  return max;
}
function differingPixels(a: Image, b: Image, threshold = 24) {
  let count = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    const d = Math.abs(a.rgba[i] - b.rgba[i]) + Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) + Math.abs(a.rgba[i + 2] - b.rgba[i + 2]);
    if (d > threshold) count++;
  }
  return count;
}
test("toggle: a card flown from the band lands back in the band", async ({ page }) => {
  await openHome(page);
  const cards = await cardCount(page);
  await half(page, labels.band).click();
  await waitForPull(page, 0);
  const { card } = await coilPoints(page);
  await page.mouse.move(card.x - 20, card.y + 10);
  await page.mouse.move(card.x, card.y);
  await page.waitForFunction(() => (window as HookWindow).__coil!.hovered() >= 0);
  await page.waitForTimeout(800); // the hover lift settles (6.5/s), so the landing carries the same lift
  const slot = (await page.evaluate(({ x, y }) => (window as HookWindow).__coil!.api.cardAt(x, y), card))!.slot;
  const quadBefore = (await page.evaluate((s) => (window as HookWindow).__coil!.api.quadOf(s), slot))!;
  await page.mouse.click(card.x, card.y);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(700); // the flight out (520ms) before the close, as a visitor looks
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  await nextFrames(page, 3);
  const landed = await shape(page);
  expect(landed).toMatchObject({ pull: 0, shown: cards });
  expect(landed.angStep).toBeCloseTo(landed.bandAngStep, 9);
  const quadAfter = (await page.evaluate((s) => (window as HookWindow).__coil!.api.quadOf(s), slot))!;
  for (let i = 0; i < 4; i++) expect(Math.hypot(quadAfter[i].x - quadBefore[i].x, quadAfter[i].y - quadBefore[i].y)).toBeLessThan(4);
});
test("toggle: a round trip to the band leaves the hero's still frame as it was", async ({ page }) => {
  // ?coildebug=still holds the field, the name's surface and the conveyor,
  // so the frame repeats; the keyboard drives the toggle so no pointer stirs
  // the name; the toggle and the cursor are masked.
  await openHome(page, { debug: "still" });
  const canvas = page.locator("section[data-scene] canvas");
  const mask = [page.locator("[data-shape-toggle]"), page.locator(".z-\\[100\\]")];
  await nextFrames(page, 3);
  const before = decodePng(await canvas.screenshot({ mask }));
  await half(page, labels.band).focus();
  await page.keyboard.press("Space");
  await waitForPull(page, 0);
  const band = decodePng(await canvas.screenshot({ mask }));
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Space");
  await waitForPull(page, 1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await nextFrames(page, 3);
  const after = decodePng(await canvas.screenshot({ mask }));
  expect(differingPixels(before, band), "the band draws a different frame").toBeGreaterThan(1000);
  expect(maxChannelDelta(before, after), "the coil after a round trip").toBeLessThanOrEqual(2);
});
```
- [ ] **Step 2: Every spec that touches the hero.** Run the e2e command with `SPECS="e2e/toggle.spec.ts e2e/hero.spec.ts e2e/capture.spec.ts e2e/row-hold.spec.ts e2e/flight.spec.ts e2e/nudge.spec.ts e2e/modal.spec.ts e2e/controls.spec.ts e2e/a11y.spec.ts e2e/fallbacks.spec.ts e2e/no-webgl.spec.ts e2e/loader.spec.ts"`. Expected: all PASS. Timing tests can flake while other worktrees build: rerun a single failure once with `E2E_NO_BUILD=1` before reading it as a defect.

- [ ] **Step 3: The full run, once.**
```bash
pnpm test && pnpm tsc --noEmit && pnpm lint
lsof -nP -iTCP:3180 -iTCP:3181 -sTCP:LISTEN && { echo "3180 or 3181 is taken: stop and report"; exit 1; }
CI=1 E2E_FULL_PORT=3180 E2E_HOLDING_PORT=3181 pnpm test:e2e
```
Expected: unit 68 files, all PASS; e2e 175 plus the toggle's 9, all PASS (every project). Also: `wc -l components/coil/CoilScene.tsx` at most 250; `components/coil/scene/shape.ts` under 400; `git diff main --stat` touches only the files named in Tasks 1 to 6; `git diff main | grep -c "$(printf '\342\200\224')"` prints 0 (no em dash).

- [ ] **Step 4: Commit**
```bash
git add e2e/toggle.spec.ts e2e/support/hooks.ts
git commit -m "e2e: a flight from the band, and the still frame after a round trip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
### Task 7: The PR, the preview and the docs (the orchestrator)

**Files:** none by builders. Fable owns `.claude/launch.json` and every `.md`.

- [ ] **Step 1: Push and open the PR into `main`** (no Vercel build follows; `vercel.json` skips previews). Write the body to `$TMPDIR/coil-band-toggle-pr.txt`: the capsule pulls the coil into the entrance's band and back on `cubic-bezier(0.55, 0, 0.25, 1)` over the pull's 756ms; a new scene module and frame step (`shape`, after `entrance`), the root three lines longer; coil on every load, the choice kept for the visit; hidden until the entrance rests, while unwound, on the still and under reduced motion; tests `lib/coil/shape.test.ts`, entrance and frame order, `e2e/toggle.spec.ts` (9); the plan's Decisions for Aaron's veto; the last line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
```bash
git push -u origin coil-band-toggle
gh pr create --base main --head coil-band-toggle --title "The Coil and Band toggle" --body-file "$TMPDIR/coil-band-toggle-pr.txt"
```
- [ ] **Step 2: Preview for Aaron's hands (Fable).** A `coil-band-toggle` entry in `.claude/launch.json` on port 3330 serving a full production build of the worktree (`NEXT_PUBLIC_SITE_MODE=full pnpm build && pnpm start -p 3330`), looked at in a GPU Chrome at 1440, 1024 and 390 in both themes.

- [ ] **Step 3: Docs (Fable, after merge).**
  - `docs/coil-scene-modules.md`: a files-table row for `scene/shape.ts` (the toggle's clock on the scene's time, held until the entrance rests; the helix pulled toward the band; calls none); a frame-table row `shape | shape | shapePull, helix` between `entrance` and `rebuild`; `SceneFrame.shapePull`; the root's line count.
  - `docs/coil-build-scaffold.md` table 1.1: `toggle.durationMs 756`, `toggle.trailingDelayMs 99`, with their sources.
  - `docs/lab-log-2026-10-05.md`: "The Coil and Band toggle (not built)" becomes built, with the PR number and the Decisions.
  - `docs/superpowers/plans/2026-10-06-first-public-edition.md` section 10: the ledger row.
  - `AGENTS.md` Layer 2 (diff shown to Aaron first): the tree (`ShapeToggle.tsx`, `scene/shape.ts`, `lib/coil/shape.ts`), test counts, and an invariant: "**The band is the entrance at pull 0.** One pull curve for both; the band shows the window copy (`bandCopy`), the unwind's latch; `pullHelix` returns the rest frame itself at pull 1." Layer 1's blur list (Decision 9) is Aaron's edit.
