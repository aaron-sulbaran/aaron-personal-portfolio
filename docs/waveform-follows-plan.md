# The waveform follows the reader: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The waveform introduced in the band under the book follows the reader as a fixed strip along the bottom of the viewport, ducking under text, and the playback pill condenses out of the band's control to show where the music lives.

**Architecture:** One wave conductor steps one field (the existing `lib/waveform` math plus a scroll conveyor and a sweep); two views paint it, the band's canvas in place and a new fixed horizon strip Portaled to body at z 0. A ScrollTrigger on `#listen` writes a sweep target and animates nothing; the horizon ducks columns under `[data-wave-avoid]` text to a still line under a contrast ceiling computed from the tokens. The pill moves to bottom centre on the horizon's baseline, grows a label layer, and arrives by one GSAP tween from the pressed control.

**Tech Stack:** Next 16.2, React 19.2, TypeScript strict, Tailwind 3.4, GSAP 3.15 (ScrollTrigger from `lib/gsap.ts`), 2D canvas, vitest, Playwright (`e2e/`).

**Spec:** `docs/waveform-follows-spec.md` (read it first; decision 2.11 in `docs/design-decisions-2026-09-28.md`).

## Global constraints

- No em dashes anywhere: code, comments, copy, commits. Use commas, semicolons or separate sentences.
- All copy in `lib/content.ts` (`siteContent.listen`, `siteContent.soundtrack`); sentence case; first person. Delete keys that lose their last reader.
- No hex in components; the engine reads tokens once per theme (the existing `readColors` pattern). Every clock in seconds.
- Fixed overlays Portal to `document.body` (`components/Portal.tsx`). Z scale: horizon 0, content 10, SiteNav 30, pill 45.
- GSAP owns scroll; nothing writes `scrollY`. Framer never touches a canvas. No `backdrop-filter` beyond the pill's existing glass.
- Phones (`PHONE_QUERY`, max-width 767px): no horizon view, no pill; the band keeps its buttons and the freeze toggle.
- Reduced motion (live, `useReducedMotionLive`): no conveyor, no sweep travel, no swell; still line; fades only.
- Work on branch `wave` (cut from `main` at `8465e8e` or later). One PR per task group into `wave`, small commits, never squashed. Builders credit themselves (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Never push `main`, never `vercel deploy`.
- Builders work in their own git worktree with their own `.next`; Aaron's `pnpm dev` runs in the main checkout on port 3000 and must not be touched. Local production checks use `NEXT_PUBLIC_SITE_MODE=full pnpm build && pnpm start -p 31NN` inside the worktree.
- Commands: `pnpm test` (vitest), `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test:e2e` (builds its own servers on 3140 and 3141; run only one e2e suite at a time on this machine).

## Review focus

Inputs the spec implies but no task's happy path exercises, most likely to bite first. Each has a test pinned to the owning task.

1. A resize during the sweep (window width changes while 0 < sweep < 1): both views must rebuild to the same column count and the train must stay continuous; no NaN dots, no blank canvas. Pinned in Task 6 (`sweep.test.ts`, "train positions are continuous for any width") and Task 7 (the horizon rebuilds without a throw on resize).
2. A scroll lock while the horizon is live (Menu open, modal open): `--scrollbar-comp` widens; the horizon must not rebuild its field or jump. Pinned in Task 7 (the strip's `right` is bound to the variable; test asserts the canvas width is unchanged after `document.documentElement.style.setProperty("--scrollbar-comp", "15px")`).
3. A theme toggle mid-sweep: alphas and colours re-read; nothing flashes to the other theme's alpha. Pinned in Task 7 (horizon alpha pair by theme) and the e2e readability test in both themes.
4. Fast flick past About (1500px/s): duck lag of one frame. Pinned in Task 8 (duck look-ahead of 160px with a 60ms attack; the e2e readability test scrolls with `mouse.wheel` deltas of 120px at 8ms intervals and samples 150ms after the last event).
5. "Play it" with audio that never starts (404, autoplay block): the pill must land in paused with the retry copy and never claim playing. Pinned in Task 11 (e2e route `/audio/*.mp3` to 404).

---

## File structure

Created:
- `lib/waveform/conveyor.ts` and `conveyor.test.ts`: the scroll-fed phase (pure).
- `lib/waveform/sweep.ts` and `sweep.test.ts`: sweep easing and train geometry (pure).
- `lib/waveform/duck.ts` and `duck.test.ts`: duck targets from rects and the per-column envelope (pure).
- `lib/waveform/contrast.ts` and `contrast.test.ts`: contrast math and the ceilings (pure; the test reads `app/globals.css`).
- `lib/waveform/dock.ts` and `dock.test.ts`: the pill's mode and label rules plus the arrival source store (pure).
- `lib/waveform/probe.ts`: the `?wavedebug` hook for e2e.
- `components/soundtrack/waveConductor.ts`: field, loop, audio, regime, clock, conveyor, sweep; a ref-counted singleton.
- `components/soundtrack/waveView.ts`: one canvas: layout, weights, avoid rects, cursor, paint.
- `components/soundtrack/HorizonCanvas.tsx`: the fixed strip.
- `components/soundtrack/useSweepTrigger.ts`: the ScrollTrigger that feeds the conductor.
- `components/soundtrack/PillLabel.tsx`: the label layer of the pill.
- `e2e/horizon.spec.ts`: sweep, layering, readability, reduced motion, phone.

Modified:
- `lib/waveform/field.ts`: `phase` in, weights out.
- `lib/waveform/dots.ts`: weights applied at paint; `columnX` callback.
- `components/soundtrack/waveEngine.ts`: deleted after Task 4 (its code moves into the conductor and the view).
- `components/soundtrack/WaveCanvas.tsx`, `BandStage.tsx`, `BandInvite.tsx`, `SoundtrackBand.tsx`, `PlaybackPill.tsx`, `PlayerCard.tsx`, `lib/waveform/pill.ts`, `lib/content.ts`.
- `components/AboutIntro.tsx`, `WhoIAm.tsx`, `UpToNow.tsx`, `Connect.tsx`, `Footer.tsx`: `data-wave-avoid` on text blocks.
- `e2e/soundtrack.spec.ts`: test 1 rewritten; the dock paths added.
- `lib/gsap.ts`: comment only (ScrollTrigger drives the wave's sweep).

Task groups and PRs: Tasks 1 to 4 are PR A (engine split, band unchanged). Tasks 5 to 9 are PR B (horizon, sweep, duck, probe, e2e). Tasks 10 to 12 are PR C (pill, copy, band). Task 13 is the review pass.

---

### Task 1: The conveyor (pure)

**Files:**
- Create: `lib/waveform/conveyor.ts`, `lib/waveform/conveyor.test.ts`

**Interfaces:**
- Produces: `interface ConveyorState { target: number; phase: number }`, `createConveyor(): ConveyorState`, `feedScroll(state, deltaPx: number): void`, `stepConveyor(state, dt: number, idle: boolean): { moving: boolean }`, constants `CONVEYOR = { pxPerColumn: 26, idleColumnsPerSecond: 0.4, leadColumns: 12, lambda: 11, capColumnsPerSecond: 40 }`.
- `phase` is in columns; positive scroll (down) decreases phase (the wave travels left), and the field SUBTRACTS `phase` from `i` (a feature at shape position j0 then shows at column j0 + phase, which is lower, so leftward, when phase is negative; the music terms with `+ time` travel the same way).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/waveform/conveyor.test.ts
import { describe, expect, it } from "vitest";
import { CONVEYOR, createConveyor, feedScroll, stepConveyor } from "./conveyor";

describe("conveyor", () => {
  it("26px of scroll down moves the target one column left (negative phase)", () => {
    const c = createConveyor();
    feedScroll(c, 26);
    expect(c.target).toBeCloseTo(-1, 6);
  });

  it("the lead is clamped so a flick cannot bank more than 12 columns", () => {
    const c = createConveyor();
    feedScroll(c, 100000);
    expect(c.target - c.phase).toBeCloseTo(-CONVEYOR.leadColumns, 6);
  });

  it("phase closes the gap with one exponential stage and never exceeds the cap", () => {
    const c = createConveyor();
    feedScroll(c, 26 * 12);
    const dt = 1 / 60;
    const { moving } = stepConveyor(c, dt, false);
    expect(moving).toBe(true);
    const expected = -12 * (1 - Math.exp(-CONVEYOR.lambda * dt));
    expect(c.phase).toBeCloseTo(Math.max(expected, -CONVEYOR.capColumnsPerSecond * dt), 6);
    for (let k = 0; k < 600; k++) stepConveyor(c, dt, false);
    expect(c.phase).toBeCloseTo(-12, 3);
    expect(stepConveyor(c, dt, false).moving).toBe(false);
  });

  it("idle drift moves the target 0.4 columns per second when idle", () => {
    const c = createConveyor();
    stepConveyor(c, 0.5, true);
    expect(c.target).toBeCloseTo(-0.2, 6);
  });

  it("scrolling up travels the other way", () => {
    const c = createConveyor();
    feedScroll(c, -52);
    expect(c.target).toBeCloseTo(2, 6);
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm vitest run lib/waveform/conveyor.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/waveform/conveyor.ts
// The wave's scroll conveyor, the Coil's idea applied to columns: page scroll
// feeds a target, one exponential stage closes the gap, a lead clamp keeps a
// flick from banking motion, and a speed cap keeps a fast scroll from
// aliasing the dots. Phase is in columns; the field adds it to the column
// index. Down travels the wave left (negative phase).

export const CONVEYOR = {
  pxPerColumn: 26,
  idleColumnsPerSecond: 0.4,
  leadColumns: 12,
  lambda: 11,
  capColumnsPerSecond: 40,
};

const REST_EPSILON = 1e-3;

export interface ConveyorState {
  target: number;
  phase: number;
}

export function createConveyor(): ConveyorState {
  return { target: 0, phase: 0 };
}

export function feedScroll(state: ConveyorState, deltaPx: number): void {
  state.target -= deltaPx / CONVEYOR.pxPerColumn;
  const lead = state.target - state.phase;
  if (lead > CONVEYOR.leadColumns) state.target = state.phase + CONVEYOR.leadColumns;
  else if (lead < -CONVEYOR.leadColumns) state.target = state.phase - CONVEYOR.leadColumns;
}

export function stepConveyor(state: ConveyorState, dt: number, idle: boolean): { moving: boolean } {
  if (idle) state.target -= CONVEYOR.idleColumnsPerSecond * dt;
  const gap = state.target - state.phase;
  if (Math.abs(gap) < REST_EPSILON) {
    state.phase = state.target;
    return { moving: false };
  }
  let step = gap * (1 - Math.exp(-CONVEYOR.lambda * dt));
  const cap = CONVEYOR.capColumnsPerSecond * dt;
  if (step > cap) step = cap;
  else if (step < -cap) step = -cap;
  state.phase += step;
  return { moving: true };
}
```

- [ ] **Step 4: Run them**

Run: `pnpm vitest run lib/waveform/conveyor.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/waveform/conveyor.ts lib/waveform/conveyor.test.ts
git commit -m "feat(waveform): scroll conveyor for the wave's phase"
```

---

### Task 2: The field takes a phase and gives up weights (pure)

**Files:**
- Modify: `lib/waveform/field.ts` (`FieldInput`, `columnTarget`, `columnDisplacement`, `stepField`)
- Modify: `lib/waveform/dots.ts` (`buildDots` applies weights and takes a `columnX`)
- Test: `lib/waveform/field.test.ts` (new), `lib/waveform/dots.test.ts` (extend)

**Interfaces:**
- `FieldInput` loses `weights` and gains `phase: number`. `stepField` eases `mag` toward the unweighted target (carve still applied).
- `columnTarget(i, time, levels, band)` and `columnDisplacement(i, time, levels, audioLevel)` take `i` as a float; callers pass `i - phase`. `bands[i]` stays bound to the integer column.
- `buildDots(field, layout, time, weights, cursor, muted, accent, columnX?: (i: number) => number)`: paints magnitude `FLOOR + (field.mag[i] - FLOOR) * weight` and displacement `field.disp[i] * weight`; `columnX` defaults to `startX + i * spacing`.
- The music term travels with the stream: `Math.sin(i * 0.3 + time * 3)` (sign flipped from `- time * 3`), so the reactive wave moves left like the conveyor.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/waveform/field.test.ts
import { describe, expect, it } from "vitest";
import { FLOOR, columnDisplacement, columnTarget, createField, levelTargets, stepField } from "./field";

const input = (over: Partial<Parameters<typeof stepField>[1]> = {}) => ({
  time: 1,
  dt: 1 / 60,
  regime: "idle" as const,
  bands: new Float32Array(8),
  audioLevel: 0,
  carve: null,
  phase: 0,
  ...over,
});

describe("field with phase", () => {
  it("a phase of one column shifts the shape by one column", () => {
    expect(columnTarget(3 + 1, 2, levelTargets("idle"), 0)).toBeCloseTo(columnTarget(4, 2, levelTargets("idle"), 0), 12);
    expect(columnDisplacement(2.5, 2, levelTargets("idle"), 0)).not.toBeCloseTo(columnDisplacement(2, 2, levelTargets("idle"), 0), 3);
  });

  it("stepField no longer takes weights: magnitude eases toward the unweighted target", () => {
    const field = createField(8);
    for (let k = 0; k < 400; k++) stepField(field, input());
    const target = columnTarget(0, 1, levelTargets("idle"), 0);
    expect(field.mag[0]).toBeCloseTo(target, 3);
  });

  it("applying a constant weight at paint time equals the old weighted field", () => {
    // The old engine eased toward FLOOR + (target - FLOOR) * w. Easing is
    // affine, so scaling the unweighted magnitude after easing is identical.
    const w = 0.4;
    const unweighted = createField(4);
    let old = FLOOR;
    for (let k = 0; k < 50; k++) {
      stepField(unweighted, input({ time: k / 60 }));
      const target = columnTarget(0, k / 60, unweighted.levels, 0);
      const scaled = FLOOR + (target - FLOOR) * w;
      old = scaled + (old - scaled) * Math.pow(1 - (scaled > old ? 0.35 : 0.12), (1 / 60) * 45);
    }
    expect(FLOOR + (unweighted.mag[0] - FLOOR) * w).toBeCloseTo(old, 6);
  });
});
```

Add to `lib/waveform/dots.test.ts` (create the file if it does not exist):

```ts
import { describe, expect, it } from "vitest";
import { buildDots } from "./dots";
import { FLOOR, createField } from "./field";

describe("buildDots", () => {
  const layout = { columns: 3, spacing: 10, startX: 5, baseline: 50, maxAmp: 20 };
  const cursor = { x: -1e4, y: -1e4, on: false };

  it("a weight of 0 pins the column to the floor on the midline", () => {
    const field = createField(3);
    field.mag.fill(0.5);
    field.disp.fill(0.5);
    const muted: number[] = [];
    const accent: number[] = [];
    buildDots(field, layout, 0, new Float32Array([0, 1, 1]), cursor, muted, accent);
    expect(muted.slice(0, 3)).toEqual([5, 50, 2.2]);
  });

  it("columnX places each column", () => {
    const field = createField(3);
    field.mag.fill(FLOOR);
    const muted: number[] = [];
    const accent: number[] = [];
    buildDots(field, layout, 0, new Float32Array([1, 1, 1]), cursor, muted, accent, (i) => 100 + i);
    expect([muted[0], muted[3], muted[6]]).toEqual([100, 101, 102]);
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm vitest run lib/waveform/field.test.ts lib/waveform/dots.test.ts`
Expected: FAIL (type errors on `phase`, wrong magnitudes).

- [ ] **Step 3: Implement**

In `lib/waveform/field.ts`: replace `weights: Float32Array;` in `FieldInput` with `phase: number; // columns, from the conveyor`; in `stepField` destructure `phase` instead of `weights`, compute `const j = i - phase;`, use `columnTarget(j, time, levels, bands[i] ?? 0)` with no weight multiply, `field.disp[i] = columnDisplacement(j, time, levels, audioLevel)` with no weight multiply. Flip the music sign in `columnDisplacement`: `Math.sin(i * 0.3 + time * 3)`. Update the comment at the top: weights are applied at paint time so two views can share one field.

In `lib/waveform/dots.ts`: add the `columnX` parameter and apply weights:

```ts
export function buildDots(
  field: Field,
  layout: DotLayout,
  time: number,
  weights: Float32Array,
  cursor: Cursor,
  muted: number[],
  accent: number[],
  columnX: (i: number) => number = (i) => layout.startX + i * layout.spacing,
): void {
  muted.length = 0;
  accent.length = 0;
  const { columns, baseline, maxAmp } = layout;
  for (let i = 0; i < columns; i++) {
    const x = columnX(i);
    const weight = weights[i] ?? 1;
    const magnitude = FLOOR + (field.mag[i] - FLOOR) * weight;
    const cy = baseline - field.disp[i] * weight * maxAmp;
    // the rest of the loop is unchanged
```

Import `FLOOR` from `./field`.

- [ ] **Step 4: Run the whole unit suite**

Run: `pnpm test`
Expected: PASS except `components/soundtrack/waveEngine.ts` type errors do not surface in vitest; run `pnpm tsc --noEmit` and expect errors only in `waveEngine.ts` (fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add lib/waveform/field.ts lib/waveform/dots.ts lib/waveform/field.test.ts lib/waveform/dots.test.ts
git commit -m "refactor(waveform): phase into the field, weights out to paint time"
```

---

### Task 3: The conductor

**Files:**
- Create: `components/soundtrack/waveConductor.ts`

**Interfaces:**
- Produces:

```ts
export interface WaveView {
  // Called once per conductor frame after the field steps; paint the field.
  paint(time: number): void;
  // True while this view should be painted (in view, not frozen).
  active(): boolean;
  // True if this view has anything still easing (cursor carve, duck); keeps the loop awake.
  busy(): boolean;
}

export interface WaveConductor {
  field: Field;            // sized to the widest attached view
  columns: number;
  conveyor: ConveyorState;
  sweep: SweepState;       // from Task 5; until then { value: 0, target: 0 }
  time: number;            // seconds, last stepped
  attach(view: WaveView): void;
  detach(view: WaveView): void;
  setColumns(columns: number): void; // a view asks for at least this many; keeps the max
  setSweepTarget(target: number, snap?: boolean): void;
  setFrozen(frozen: boolean): void;
  subscribe(listener: () => void): () => void; // fires after each step
  wake(): void;
  release(): void;         // ref-counted; the last release destroys it
}

export function acquireWaveConductor(still: boolean): WaveConductor;
```

- The conductor owns: `createField`, the loop (`MIN_FRAME_MS`, `MAX_STEP_S`, `document.hidden`, the settle stop from the old engine), `getSoundtrackPlayer().sample(t, columns)`, `regimeOf(getSoundtrackState())`, the conveyor fed from a passive `scroll` listener (`window.scrollY` delta per frame, as `components/coil/scene/input.ts` does), and the sweep step (Task 5). The carve array is per view in the old engine; move the carve into the conductor as `carve: Float32Array` that views write into (max of the views' carve targets), so the field sees one carve.
- `regime` for "off" becomes "idle" on the horizon (the spec: declined follows as a calm background). Keep `regimeOf` as is for the band; the conductor passes `regime = state === "off" ? "idle" : regimeOf(state)` only while `sweep.value > 0.5`; otherwise the band's rule. Document this in a comment.
- Frame rate: 30fps (`MIN_FRAME_MS = 1000 / 30 - 2`) when the regime is idle, paused or still and the conveyor is at rest and the sweep is at its target; 60fps otherwise.
- The loop stops when no attached view is `active()` and none is `busy()`, when frozen, when `document.hidden`, or when the field settled and the conveyor and sweep are at rest. `wake()` restarts it; `subscribeSoundtrack`, `visibilitychange` and the scroll listener call `wake()`.
- Ref counting: `acquireWaveConductor` returns the one live instance (module-level) and increments; `release()` decrements and destroys at zero. A change of `still` while attached destroys and recreates (the callers remount on `still`).

- [ ] **Step 1: Write the implementation** (no DOM unit test; it is covered by the band pixel guard in Task 4 and the e2e in Task 9)

Move from `waveEngine.ts`: the loop (`tick`, `wake`, `running`), `step` minus paint and minus cursor sync, the regime read, `player.sample`, the theme observer is NOT here (colours belong to views). Add the scroll listener:

```ts
let lastScrollY = window.scrollY;
const onScroll = () => {
  const y = window.scrollY;
  feedScroll(conveyor, y - lastScrollY);
  lastScrollY = y;
  wake();
};
window.addEventListener("scroll", onScroll, { passive: true });
```

and in `step`:

```ts
const idle = regime === "idle" && !still;
const { moving } = stepConveyor(conveyor, dt, idle);
const sweeping = stepSweep(sweep, dt); // Task 5; until then a stub that returns false
const { settled } = stepField(field, { time, dt, regime, bands: frame.bands, audioLevel: frame.level, carve, phase: conveyor.phase });
for (const view of views) if (view.active()) view.paint(time);
listeners.forEach((l) => l());
return settled && !moving && !sweeping && !views.some((v) => v.busy());
```

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: only `waveEngine.ts` errors remain (it is replaced in Task 4). If `stepSweep`/`SweepState` do not exist yet, define a local stub in the conductor: `type SweepState = { value: number; target: number }` and `const stepSweep = () => false`, marked to be replaced in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/soundtrack/waveConductor.ts
git commit -m "feat(soundtrack): wave conductor owns the field, loop, audio and conveyor"
```

---

### Task 4: The view, the band on the new engine, and the pixel guard

**Files:**
- Create: `components/soundtrack/waveView.ts`
- Modify: `components/soundtrack/WaveCanvas.tsx`
- Delete: `components/soundtrack/waveEngine.ts`
- Test: `e2e/soundtrack.spec.ts` (a new deterministic band snapshot test, see step 4)

**Interfaces:**
- Produces: `createWaveView(canvas: HTMLCanvasElement, conductor: WaveConductor, options: ViewOptions): WaveViewHandle` where

```ts
export interface ViewOptions {
  kind: "band" | "horizon";
  still: boolean;
  avoidRoot: ParentNode;            // where [data-wave-avoid] is queried
  alphas: { muted: number; accent: number } | ((theme: "light" | "dark") => { muted: number; accent: number });
}
export interface WaveViewHandle extends WaveView {
  setActive(active: boolean): void;
  destroy(): void;
}
```

- The band view keeps today's behaviour exactly: `bandLayout(width, height)`, calm and loud weights from `columnWeights` with `reachOf`, `blendWeights` per frame by `conductor.field.levels.reactive`, the cursor carve and repel confined to the canvas, `readColors` and the theme observer, alphas 0.55 and 0.9, the ResizeObserver on host and avoid elements, `paint` identical, `columnX` default. `measure()` calls `conductor.setColumns(layout.columns)`.
- `WaveCanvas` becomes: acquire the conductor (`acquireWaveConductor(still)`), create the band view, attach it, `setActive(active)`, `conductor.setFrozen(frozen)` (freezing is global now), release and destroy on unmount.

- [ ] **Step 1: Write the view** by moving the remaining `waveEngine.ts` code (sizing, weights, colours, cursor, paint) into `createWaveView`; the field comes from `conductor.field`, the carve is written into `conductor.carve` (band view: `carveTargets(layout, cursor, conductor.carve)` only while the cursor is on; otherwise contribute zeros). `busy()` returns true while any `conductor.carve[i] > 1e-3` for this view's columns or the cursor is on.

- [ ] **Step 2: Rewire `WaveCanvas.tsx`**

```tsx
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const conductor = acquireWaveConductor(still);
  const view = createWaveView(canvas, conductor, { kind: "band", still, avoidRoot: canvas.closest("section") ?? document, alphas: { muted: 0.55, accent: 0.9 } });
  conductor.attach(view);
  viewRef.current = view;
  conductorRef.current = conductor;
  return () => {
    conductor.detach(view);
    view.destroy();
    conductor.release();
    viewRef.current = null;
    conductorRef.current = null;
  };
}, [still]);
useEffect(() => viewRef.current?.setActive(active), [active, still]);
useEffect(() => conductorRef.current?.setFrozen(frozen), [frozen, still]);
```

- [ ] **Step 3: Delete `waveEngine.ts`, type check, lint, unit tests**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm test`
Expected: clean, 0 lint errors, all unit tests pass.

- [ ] **Step 4: The band pixel guard (e2e)**

The band must look the same before and after. Add to `e2e/soundtrack.spec.ts`:

```ts
test("band: the still line under reduced motion is pixel identical to the baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  await scrollBandIntoView(page);
  await page.waitForTimeout(300);
  await expect(page.locator("#listen canvas")).toHaveScreenshot("band-still.png", { maxDiffPixels: 0 });
});
```

Generate the baseline on the commit BEFORE Task 2 (`git stash` is not enough; check out `main` in a second worktree, run `pnpm test:e2e --update-snapshots -g "band: the still line"` there, copy the produced `e2e/soundtrack.spec.ts-snapshots/` folder into this branch), then run the test on this branch. Also a moving guard: with music "before" (idle drift) and a real clock the frames differ, so compare statistics instead:

```ts
test("band: idle drift paints the same dot count and extent as before the split", async ({ page }) => {
  await instrument(page);
  await openHome(page);
  await scrollBandIntoView(page);
  await page.waitForTimeout(1200);
  const stats = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#listen canvas")!;
    const ctx = canvas.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) { painted++; if (y < top) top = y; if (y > bottom) bottom = y; }
    }
    return { painted, top, bottom, width, height };
  });
  expect(stats.painted).toBeGreaterThan(2000);
  expect(stats.bottom - stats.top).toBeLessThan(stats.height * 0.5);
});
```

Run: `pnpm test:e2e -g "band:"`
Expected: PASS.

- [ ] **Step 5: Commit, open PR A into `wave`**

```bash
git add -A
git commit -m "refactor(soundtrack): the band paints through a wave view on the conductor"
```

PR title: "Wave engine split: conductor and view, band unchanged". Body lists the equivalence argument (affine easing), the pixel guard, and `pnpm test` / `tsc` / `lint` output.

---

### Task 5: Sweep easing and the train (pure)

**Files:**
- Create: `lib/waveform/sweep.ts`, `lib/waveform/sweep.test.ts`
- Modify: `components/soundtrack/waveConductor.ts` (replace the stub)

**Interfaces:**
- Produces:

```ts
export const SWEEP = { lambda: 8, capPerSecond: 1.5, curlColumns: 10, swell: 0.6 };
export interface SweepState { value: number; target: number }
export function createSweep(): SweepState;
export function stepSweep(state: SweepState, dt: number): boolean; // true while moving
// Where column i of a view of `width` px is painted during the sweep.
export function trainX(i: number, layout: { startX: number; spacing: number }, width: number, sweep: number, side: "band" | "horizon"): number;
// The junction curl: for the band's last columns and the horizon's first columns, a vertical
// offset (px, positive is down) and a magnitude scale in [0, 1] that thins toward the tip.
export function junction(i: number, columns: number, sweep: number, side: "band" | "horizon", curlPx: number): { dy: number; scale: number };
// Displacement multiplier while the train is in transit: 1 + swell * sin(pi * sweep).
export function swell(sweep: number): number;
```

- `trainX`: band `startX + i * spacing - sweep * width`; horizon `startX + i * spacing + (1 - sweep) * width`.
- `junction`: band side, for `i >= columns - curlColumns`: `t = (i - (columns - curlColumns)) / curlColumns` (0 at the first curled column, 1 at the tip); `dy = curlPx * smoothstep(t)`, `scale = 1 - 0.7 * t`; horizon side, for `i < curlColumns`: `t = 1 - i / curlColumns`; `dy = -curlPx * smoothstep(t)` (rises from below), same scale. Everywhere else `{ dy: 0, scale: 1 }`. When `sweep` is 0 or 1 the junction is off screen for the band or horizon respectively, but the function does not need to know that.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/waveform/sweep.test.ts
import { describe, expect, it } from "vitest";
import { SWEEP, createSweep, junction, stepSweep, swell, trainX } from "./sweep";

const layout = { startX: 6.5, spacing: 13 };

describe("sweep", () => {
  it("eases toward the target with lambda 8 and a 1.5 per second cap", () => {
    const s = createSweep();
    s.target = 1;
    expect(stepSweep(s, 1 / 60)).toBe(true);
    expect(s.value).toBeCloseTo(Math.min(1 - Math.exp(-8 / 60), 1.5 / 60), 6);
    for (let k = 0; k < 300; k++) stepSweep(s, 1 / 60);
    expect(s.value).toBeCloseTo(1, 3);
    expect(stepSweep(s, 1 / 60)).toBe(false);
  });

  it("a full jump is 95 percent done in about 0.7s under the cap", () => {
    const s = createSweep();
    s.target = 1;
    let t = 0;
    while (s.value < 0.95) { stepSweep(s, 1 / 120); t += 1 / 120; }
    expect(t).toBeGreaterThan(0.6);
    expect(t).toBeLessThan(0.85);
  });

  it("the band's tail and the horizon's head meet at the same x for any width and sweep", () => {
    for (const width of [390, 1024, 1440, 2560]) {
      const columns = Math.floor(width / 13);
      for (const sweep of [0, 0.2, 0.5, 0.83, 1]) {
        const tail = trainX(columns, layout, width, sweep, "band");
        const head = trainX(0, layout, width, sweep, "horizon");
        expect(tail).toBeCloseTo(head, 6);
        expect(Number.isFinite(trainX(columns - 1, layout, width, sweep, "band"))).toBe(true);
      }
    }
  });

  it("the junction curls the band's last ten columns down and the horizon's first ten up, thinning to the tip", () => {
    const band = junction(109, 110, 0.5, "band", 60);
    expect(band.dy).toBeCloseTo(60 * (0.9 ** 2 * (3 - 1.8)), 6);
    expect(band.scale).toBeLessThan(0.4);
    expect(junction(50, 110, 0.5, "band", 60)).toEqual({ dy: 0, scale: 1 });
    const head = junction(0, 110, 0.5, "horizon", 60);
    expect(head.dy).toBeCloseTo(-60, 6);
    expect(head.scale).toBeCloseTo(0.3, 6);
    expect(junction(10, 110, 0.5, "horizon", 60)).toEqual({ dy: 0, scale: 1 });
  });

  it("the swell peaks mid sweep and is 1 at rest", () => {
    expect(swell(0)).toBeCloseTo(1, 9);
    expect(swell(0.5)).toBeCloseTo(1 + SWEEP.swell, 9);
    expect(swell(1)).toBeCloseTo(1, 9);
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm vitest run lib/waveform/sweep.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `lib/waveform/sweep.ts` to the interface above (smoothstep is `t * t * (3 - 2 * t)` clamped to [0, 1]). Replace the stub in `waveConductor.ts` with the real `createSweep`/`stepSweep`; `setSweepTarget(target, snap)` sets `sweep.target` and, when `snap`, `sweep.value` too, then `wake()`.

- [ ] **Step 4: Run them**

Run: `pnpm vitest run lib/waveform/sweep.test.ts && pnpm tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/waveform/sweep.ts lib/waveform/sweep.test.ts components/soundtrack/waveConductor.ts
git commit -m "feat(waveform): sweep easing and the train geometry"
```

---

### Task 6: Duck and contrast (pure)

**Files:**
- Create: `lib/waveform/duck.ts`, `lib/waveform/duck.test.ts`, `lib/waveform/contrast.ts`, `lib/waveform/contrast.test.ts`

**Interfaces:**
- Produces:

```ts
export const DUCK = { padPx: 20, lookAheadPx: 160, attackRate: 0.4, releaseRate: 0.06 };
export const DUCK_ALPHA = { light: 0.09, dark: 0.15 }; // alpha ceiling for ducked dots
// `rects` are document-space boxes (already padded); `strip` is the horizon's viewport box
// as document-space top/bottom for this frame (scrollY + viewport offsets). Writes 1 for a
// column that must duck (a rect overlaps the strip or sits within lookAhead below it and
// spans the column's x), else 0.
export function duckTargets(rects: Rect[], columnXs: ArrayLike<number>, strip: { top: number; bottom: number }, out: Float32Array): void;
// Per-column envelope toward the targets with the asymmetric rates (easeToward semantics).
// Returns true while any column is still moving.
export function stepDuck(env: Float32Array, targets: Float32Array, dt: number): boolean;

export function hexToRgb(hex: string): [number, number, number];
export function blendOver(bg: [number, number, number], fg: [number, number, number], alpha: number): [number, number, number];
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number; // WCAG
```

- `rects` are sorted by `top`; `duckTargets` may scan linearly (at most about 10 rects). A rect spans a column when `rect.left <= x <= rect.right`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/waveform/duck.test.ts
import { describe, expect, it } from "vitest";
import { DUCK, duckTargets, stepDuck } from "./duck";

describe("duck", () => {
  const xs = [10, 20, 30, 40];
  it("a rect over the strip ducks the columns it spans", () => {
    const out = new Float32Array(4);
    duckTargets([{ left: 15, right: 35, top: 1000, bottom: 1100 }], xs, { top: 1050, bottom: 1226 }, out);
    expect([...out]).toEqual([0, 1, 1, 0]);
  });
  it("a rect within the look-ahead below the strip ducks early", () => {
    const out = new Float32Array(4);
    duckTargets([{ left: 0, right: 50, top: 1226 + DUCK.lookAheadPx - 1, bottom: 1500 }], xs, { top: 1050, bottom: 1226 }, out);
    expect([...out]).toEqual([1, 1, 1, 1]);
    duckTargets([{ left: 0, right: 50, top: 1226 + DUCK.lookAheadPx + 1, bottom: 1500 }], xs, { top: 1050, bottom: 1226 }, out);
    expect([...out]).toEqual([0, 0, 0, 0]);
  });
  it("attack reaches 0.8 within 100ms and release falls to 1/e in about 350ms", () => {
    const env = new Float32Array([0]);
    let t = 0;
    while (env[0] < 0.8) { stepDuck(env, new Float32Array([1]), 1 / 120); t += 1 / 120; }
    expect(t).toBeLessThan(0.1);
    env[0] = 1;
    t = 0;
    while (env[0] > 0.37) { stepDuck(env, new Float32Array([0]), 1 / 120); t += 1 / 120; }
    expect(t).toBeGreaterThan(0.25);
    expect(t).toBeLessThan(0.6);
    expect(stepDuck(env, new Float32Array([0]), 5)).toBe(false);
  });
});
```

```ts
// lib/waveform/contrast.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUCK_ALPHA } from "./duck";
import { blendOver, contrastRatio, hexToRgb } from "./contrast";

// Reads the token hexes from globals.css so a palette change fails here first.
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const token = (block: string, name: string) => {
  const scope = block === "light" ? css.split("[data-theme=\"dark\"]")[0] : css.slice(css.indexOf("[data-theme=\"dark\"]"));
  const m = scope.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found in ${block}`);
  return hexToRgb(m[1]);
};

describe("ducked dots keep muted body text readable", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: muted text on the darkest ducked dot is at least 4.5 to 1`, () => {
      const bg = token(theme, "--color-background");
      const text = token(theme, "--color-muted");
      const dot = blendOver(bg, token(theme, "--color-muted"), DUCK_ALPHA[theme]);
      const dotAccent = blendOver(bg, token(theme, "--color-accent"), DUCK_ALPHA[theme]);
      expect(contrastRatio(text, dot)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, dotAccent)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("contrastRatio matches WCAG for black on white", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm vitest run lib/waveform/duck.test.ts lib/waveform/contrast.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement** both modules. `stepDuck` uses `easeToward(env[i], target, target > env[i] ? DUCK.attackRate : DUCK.releaseRate, dt)` from `./field` and returns true if any `|env[i] - target| > 1e-3`. `contrastRatio` uses sRGB linearisation (`c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4`) and `(L1 + 0.05) / (L2 + 0.05)` with the lighter first. If the contrast test fails at the spec's ceilings, lower `DUCK_ALPHA` until it passes and record the values in the PR body; do not change the test's 4.5.

- [ ] **Step 4: Run them**

Run: `pnpm vitest run lib/waveform/duck.test.ts lib/waveform/contrast.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/waveform/duck.ts lib/waveform/duck.test.ts lib/waveform/contrast.ts lib/waveform/contrast.test.ts
git commit -m "feat(waveform): duck envelope and the contrast ceiling from the tokens"
```

---

### Task 7: The horizon view and strip

**Files:**
- Create: `components/soundtrack/HorizonCanvas.tsx`
- Modify: `components/soundtrack/waveView.ts` (the `horizon` kind), `components/soundtrack/BandStage.tsx` (mounts `HorizonCanvas` from md up), `app/globals.css` (one class for the mask)
- Modify: `components/AboutIntro.tsx`, `WhoIAm.tsx`, `UpToNow.tsx`, `Connect.tsx`, `Footer.tsx` (`data-wave-avoid` on the heading, lede/paragraph, list and footer row containers)

**Interfaces:**
- Consumes: `trainX`, `junction`, `swell` (Task 5); `duckTargets`, `stepDuck`, `DUCK`, `DUCK_ALPHA` (Task 6); `acquireWaveConductor`, `createWaveView`.
- Produces: `<HorizonCanvas />` (client; Portals to body a `div[data-wave="horizon"]` with `position: fixed; left: 0; right: var(--scrollbar-comp, 0px); bottom: 0; height: 176px; z-index: 0; pointer-events: none; aria-hidden`, containing the canvas with class `wave-horizon-mask`), and the `horizon` kind of view:
  - layout: `columns` from `bandLayout(width, 176)` but `baseline = 176 - 72 = 104`, `maxAmp = 44`; `thick` capped at 6 (add an optional `maxThick` to `DotLayout`, default unlimited, honoured in `buildDots`).
  - `columnX = (i) => trainX(i, layout, width, conductor.sweep.value, "horizon")`; and in paint, before `buildDots`, compute per column `junction(...)` and `swell(sweep)`: apply `dy` by painting with a per-column baseline offset (add an optional `baselineOffset?: Float32Array` to `DotLayout` honoured in `buildDots` as `cy = baseline + (baselineOffset?.[i] ?? 0) - disp * weight * maxAmp`), and `scale` and swell folded into the weights passed to `buildDots` (`weights[i] = open[i] * (1 - duck[i]) * junction.scale`, displacement multiplier by `swell` folded in the same way).
  - alphas by theme: light `{ muted: 0.30, accent: 0.50 }`, dark `{ muted: 0.40, accent: 0.70 }`; ducked columns paint at `DUCK_ALPHA[theme]` with a magnitude pinned to `FLOOR` (weights 0 does that) and the alpha applied per column: split the `muted`/`accent` arrays into two fills each (open alpha and ducked alpha), choosing by `duck[i] > 0.5`.
  - avoid rects: query `[data-wave-avoid]` under `main` and `footer`, measure document-space rects (`getBoundingClientRect()` plus `scrollY`) padded by `DUCK.padPx`, sorted by top; re-measure on `ScrollTrigger.addEventListener("refresh")`, `document.fonts.ready`, and a ResizeObserver on `main`.
  - per frame: `strip = { top: scrollY + innerHeight - 176, bottom: scrollY + innerHeight }`, `duckTargets(rects, columnXsThisFrame, strip, targets)`, `stepDuck(env, targets, dt)`; `busy()` returns the duck's moving flag; `active()` returns `conductor.sweep.value > 0 && !phone`.
  - cursor: repel and carve only while the pointer is inside the strip (`clientY >= innerHeight - 176`).
  - the band view (Task 4) gains the same `columnX` with side `"band"`, its own junction with `curlPx = height - baseline`, and the swell; at sweep 0 these are identities.
- The band's `WaveCanvas` keeps `active` tied to the band's IntersectionObserver; the horizon's `active()` is the sweep value. Both can be active during the sweep.

- [ ] **Step 1: Add the mask class** to `app/globals.css`:

```css
.wave-horizon-mask {
  -webkit-mask-image: linear-gradient(to top, #000 65%, transparent);
  mask-image: linear-gradient(to top, #000 65%, transparent);
}
```

(A `#000` inside a mask is not a colour; note that in a comment so the hex rule is not misread.)

- [ ] **Step 2: Add `data-wave-avoid`** to: AboutIntro's heading `h2` and the lede `p`; WhoIAm's label row and the `ReadAlong` paragraph container; UpToNow's heading and the list container; Connect's heading, blurb and the link list; Footer's inner row. These are Server Components; the attribute is inert markup.

- [ ] **Step 3: Extend `DotLayout` and `buildDots`** with `maxThick?: number` and `baselineOffset?: Float32Array` (defaults keep today's output; add two unit tests in `lib/waveform/dots.test.ts`: `maxThick: 1` yields at most 3 dots per column; `baselineOffset` of 10 moves the centre dot by 10).

- [ ] **Step 4: Write the horizon kind** in `waveView.ts` and `HorizonCanvas.tsx`; mount `<HorizonCanvas />` from `BandStage` next to `<PlaybackPill />`, gated by the same `phone` media query the pill uses (`useSyncExternalStore(subscribePhone, isPhone, () => true)`; move those two helpers into `lib/waveform/layout.ts` as `subscribePhone`/`isPhone` so both components share them).

- [ ] **Step 5: Verify by hand in the worktree** (`NEXT_PUBLIC_SITE_MODE=full pnpm build && pnpm start -p 3150`, then agent-browser `--session wave-b`): at the band `sweep` is 0 and no horizon dots; scroll through: the ribbon leaves left and arrives right along the bottom; past About the strip runs at the bottom; the About heading region shows the still line only. Save three screenshots to the scratchpad and attach them to the PR.

- [ ] **Step 6: Type check, lint, unit tests, commit**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm test`

```bash
git add -A
git commit -m "feat(soundtrack): the horizon strip paints the wave along the viewport bottom"
```

---

### Task 8: The sweep trigger and the probe

**Files:**
- Create: `components/soundtrack/useSweepTrigger.ts`, `lib/waveform/probe.ts`
- Modify: `components/soundtrack/BandStage.tsx` (calls the hook), `components/soundtrack/waveView.ts` (writes probe data), `lib/gsap.ts` (comment)

**Interfaces:**
- `useSweepTrigger(conductorRef: RefObject<WaveConductor | null>)`: inside `useGSAP` (from `lib/gsap.ts`), `ScrollTrigger.create({ trigger: "#listen", start: "center 60%", end: "bottom 15%", onUpdate: (self) => conductor.setSweepTarget(self.progress), onLeave: () => conductor.setSweepTarget(1), onLeaveBack: () => conductor.setSweepTarget(0), onRefresh: (self) => conductor.setSweepTarget(self.progress, true) })`; on creation call `setSweepTarget(st.progress, true)` so a deep load past the band starts at 1 with no glide. Under reduced motion, the hook still runs but the conductor's `stepSweep` snaps (`still` means `sweep.value = target` each step) and the horizon cross-fades its opacity over 400ms via a CSS transition on the strip when `sweep.target` crosses 0.5.
- `lib/waveform/probe.ts`: `waveProbe(): WaveProbe | null`, created only when `?wavedebug` is in the URL, exposed as `window.__waveProbe`:

```ts
export type WaveProbe = {
  sweep: () => number;
  horizonPaints: number;         // incremented by the horizon view's paint
  strip: () => { top: number; bottom: number; baseline: number } | null; // viewport px
  columns: () => { x: number; duck: number; alpha: number }[]; // last painted frame, horizon
};
```

- [ ] **Step 1: Write the hook and the probe**; the horizon view records `columns()` data from its last paint (x per column from `columnX`, `duck[i]`, the alpha it painted with).

- [ ] **Step 2: Update the `lib/gsap.ts` comment**: ScrollTrigger drives the wave's sweep (a number the conductor eases), the read-along and Up to now.

- [ ] **Step 3: Verify by hand** as in Task 7 with `?wavedebug`: `window.__waveProbe.sweep()` reads 0 at the band, 1 past it; a deep load of `/#about?wavedebug` reads 1 on the first frame.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(soundtrack): the sweep follows a ScrollTrigger; ?wavedebug probe"
```

---

### Task 9: e2e for the horizon and the rewritten rule

**Files:**
- Create: `e2e/horizon.spec.ts`
- Modify: `e2e/soundtrack.spec.ts` (test 1)

- [ ] **Step 1: Rewrite test 1** of `e2e/soundtrack.spec.ts`. Today it asserts zero fixed canvases and no text over any canvas. New assertion: the only fixed canvas is `[data-wave="horizon"] canvas`, it has computed `z-index: 0` and `pointer-events: none`, and for each `[data-wave-avoid]` element whose box intersects the strip after scrolling it there, `document.elementFromPoint` at the box's centre is inside that element.

- [ ] **Step 2: Write `e2e/horizon.spec.ts`** with these tests (use `openHome`, `scrollToY` from `./support/coil`, the `instrument` helper pattern from `soundtrack.spec.ts`, and `?wavedebug` on the home URL):

1. "sweep follows scroll": band centred: `sweep()` under 0.05 and `horizonPaints` stays 0 over 500ms; three increasing scroll positions inside the band's range: sweep strictly increasing; `#about` top plus 200: sweep over 0.99 and, after clicking "Play it" earlier in the test, `horizonPaints` grows by more than 10 in a second; scroll back to the band: sweep returns under 0.05 and `horizonPaints` is unchanged over a quiet second.
2. "deep load past the band starts at 1": `goto('/#about?wavedebug')`, first `sweep()` read over 0.99; CLS from `PerformanceObserver` under 0.05 (copy the CLS helper from the existing deep-load test in `soundtrack.spec.ts`).
3. "readability in light and dark": for each of `#about`, the WhoIAm paragraph, UpToNow, `#connect`, `footer`: scroll so the block's bottom is inside the strip, wait 150ms, read `columns()` and assert every column whose x is within the block's box paints `alpha <= DUCK_ALPHA[theme]` and `duck > 0.5`. Run under both `data-theme` values (set `localStorage` theme before load, or click the menu's theme chip).
4. "fast flick": from the band, `mouse.wheel(0, 120)` 25 times at 8ms, wait 150ms, then the same assertion as 3 for whichever block is over the strip.
5. "layering": computed `zIndex` of the strip is "0", `pointerEvents` "none", and `elementFromPoint` at a text block's centre returns the text.
6. "reduced motion": emulate reduce; at `#about` the strip is visible (opacity 1) and `horizonPaints` grows by at most 1 over a second.
7. "phone has no horizon": viewport 375x812, scroll to `#about`, `[data-wave="horizon"]` count is 0, the band's buttons exist.
8. "scroll lock does not resize the strip": at `#about`, read the canvas width, set `--scrollbar-comp` to `15px` on `<html>`, wait 100ms, canvas width unchanged (the strip narrows by CSS, the backing store does not rebuild: assert `horizonPaints` grew by at most 2).

- [ ] **Step 3: Run**

Run: `pnpm test:e2e -g "horizon|band|soundtrack"`
Expected: PASS. If the "a real click on Play it starts playback" soundtrack test fails with media time not advancing, that is the known environmental failure on this machine; say so in the PR and do not change the test.

- [ ] **Step 4: Commit, open PR B into `wave`**

```bash
git add -A
git commit -m "test(e2e): the horizon's sweep, readability rule, layering and phone gate"
```

PR title: "The wave follows the reader: horizon strip, sweep, duck rule". Body: the three screenshots, the probe readings, `pnpm test`, `tsc`, `lint`, and the e2e summary.

---

### Task 10: Dock rules and copy (pure plus content)

**Files:**
- Create: `lib/waveform/dock.ts`, `lib/waveform/dock.test.ts`
- Modify: `lib/waveform/pill.ts` (remove `pillVisible`; its one test moves), `lib/content.ts`

**Interfaces:**
- Produces:

```ts
export type DockMode = "hidden" | "label" | "capsule";
export type DockLabel = "accepted" | "declined" | "unanswered" | "returning" | "failed";
export interface DockInput {
  music: SoundtrackState;          // before | on | paused | off
  reached: boolean;                // the band's centre has crossed the viewport (sweep target > 0.35)
  phone: boolean;
  labelShown: boolean;             // this page load already showed the label for this state
  returning: boolean;              // stored "on" restored this session and not yet greeted
  failed: boolean;                 // the reconciler downgraded on to paused during the window
}
export function dockMode(input: DockInput): DockMode;   // hidden when phone or !reached; label when !labelShown; else capsule
export function dockLabel(input: DockInput): DockLabel; // failed > returning > by music: on => accepted, off => declined, before => unanswered, paused => accepted
export function capsuleText(music: SoundtrackState, trackTitle: string): string; // on => title, paused => "Paused", before => "Music?", off => "Music"
export const DOCK = { arriveMs: 600, holdMs: 2600, collapseMs: 360, arriveAtSweep: 0.35, capsulePx: 36, hitPx: 44, baselineFromBottomPx: 72 };
// Arrival source: BandInvite records the pressed control's viewport rect; the pill reads and clears it.
export function setDockSource(rect: DOMRect | null): void;
export function takeDockSource(): DOMRect | null;
```

- Copy to add to `siteContent.listen` and `siteContent.soundtrack` (exact strings):
  - `listen.line`: "Want some music while you scroll?"
  - `listen.body`: "I put together a short playlist for this site. The wave follows you down the page."
  - `listen.accept`: "Play it"; `listen.decline`: "Not now"
  - `listen.acceptedNote`: "Keep going, the music will follow."
  - `listen.declinedNote`: "No problem. It'll be here if you change your mind."
  - `listen.pausedNote`: "Paused. Resume whenever you like."
  - `soundtrack.dockAccepted`: "Music and volume live here."
  - `soundtrack.dockDeclined`: "Here if you change your mind."
  - `soundtrack.dockReturning`: "Welcome back. Your music is here."
  - `soundtrack.dockFailed`: "I couldn't start the music. Press here to try again."
  - `soundtrack.capsulePaused`: "Paused"; `soundtrack.capsuleUnanswered`: "Music?"; `soundtrack.capsuleOff`: "Music"
  - Delete: `listen.replay` (the band no longer offers it; the capsule does), `soundtrack.promptQuestion`, `promptYes`, `promptNo` (unused since the band took the ask; confirm with grep before deleting).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/waveform/dock.test.ts
import { describe, expect, it } from "vitest";
import { capsuleText, dockLabel, dockMode, setDockSource, takeDockSource } from "./dock";

const base = { music: "before" as const, reached: true, phone: false, labelShown: false, returning: false, failed: false };

describe("dock", () => {
  it("is hidden on phones and before the band is reached", () => {
    expect(dockMode({ ...base, phone: true })).toBe("hidden");
    expect(dockMode({ ...base, reached: false })).toBe("hidden");
  });
  it("shows the label once, then the capsule, in every music state", () => {
    for (const music of ["before", "on", "paused", "off"] as const) {
      expect(dockMode({ ...base, music })).toBe("label");
      expect(dockMode({ ...base, music, labelShown: true })).toBe("capsule");
    }
  });
  it("picks the label by state, failure first", () => {
    expect(dockLabel({ ...base, music: "on" })).toBe("accepted");
    expect(dockLabel({ ...base, music: "off" })).toBe("declined");
    expect(dockLabel({ ...base, music: "before" })).toBe("unanswered");
    expect(dockLabel({ ...base, music: "paused", returning: true })).toBe("returning");
    expect(dockLabel({ ...base, music: "paused", returning: true, failed: true })).toBe("failed");
  });
  it("capsule text", () => {
    expect(capsuleText("on", "Small Steps")).toBe("Small Steps");
    expect(capsuleText("paused", "x")).toBe("Paused");
    expect(capsuleText("before", "x")).toBe("Music?");
    expect(capsuleText("off", "x")).toBe("Music");
  });
  it("the arrival source is taken once", () => {
    const rect = { x: 1, y: 2, width: 3, height: 4, top: 2, left: 1, right: 4, bottom: 6, toJSON: () => ({}) } as DOMRect;
    setDockSource(rect);
    expect(takeDockSource()).toBe(rect);
    expect(takeDockSource()).toBeNull();
  });
});
```

- [ ] **Step 2: Run them**; expected FAIL, module not found.

- [ ] **Step 3: Implement** `lib/waveform/dock.ts`; `capsuleText` reads the strings from `siteContent.soundtrack` so copy stays in `content.ts`. Move the `pillVisible` test (if one exists in `lib/waveform/pill.test.ts`) to `dock.test.ts` semantics and delete `pillVisible`. Edit `lib/content.ts`.

- [ ] **Step 4: Run** `pnpm test && pnpm tsc --noEmit`; expect type errors only where components still read deleted keys (fixed in Tasks 11 and 12). Grep for every deleted key before committing.

- [ ] **Step 5: Commit**

```bash
git add lib/waveform/dock.ts lib/waveform/dock.test.ts lib/waveform/pill.ts lib/waveform/pill.test.ts lib/content.ts
git commit -m "feat(soundtrack): dock rules and the new soundtrack copy"
```

---

### Task 11: The pill becomes the dock

**Files:**
- Create: `components/soundtrack/PillLabel.tsx`
- Modify: `components/soundtrack/PlaybackPill.tsx`, `PlayerCard.tsx` (gains the freeze toggle), `BandStage.tsx` (passes `reached` from the conductor's sweep target, drops the freeze button), `menu/NoteIcon.tsx` (export reused), `lib/soundtrack.ts` (expose a `subscribePlayFailure` or reuse the existing reconciler's downgrade: when `on` becomes `paused` within 4s of `startSoundtrack`, the pill treats it as failed; implement as a module-level timestamp `lastStartAt` exported from `lib/soundtrack.ts`)

**Interfaces:**
- Consumes: `dockMode`, `dockLabel`, `capsuleText`, `DOCK`, `takeDockSource` (Task 10); `WaveConductor.subscribe` and `sweep.target` (Task 3 and 5); `gsap` from `lib/gsap.ts`.
- Behaviour:
  - Position: `bottom: DOCK.baselineFromBottomPx - DOCK.capsulePx / 2` (54px), centred, z 45, as today's `data-pill` root. Capsule 36px tall, 44px hit area via `::before` (add a `.pill-hit` class in `globals.css`: `position: relative; &::before { content: ""; position: absolute; inset: -4px; }`).
  - Glyph: `NoteIcon` (the menu's), filled when on, outlined with the slash when off, flat line when paused (reuse `Glyph` from `PillParts` for the equalizer when on if it exists; keep one visual language with the menu).
  - `reached`: `BandStage` subscribes to the conductor and sets `reached = conductor.sweep.target > DOCK.arriveAtSweep`.
  - Arrival: when `reached` flips true and `dockMode` is not hidden: `const source = takeDockSource()`; if `source` and `source.bottom > 0 && source.top < innerHeight`, set the root's transform to translate from the source's centre to the dock (`gsap.fromTo(root, { x: sx - dx, y: sy - dy, scale: 0.6, opacity: 0.4 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: DOCK.arriveMs / 1000, ease: "power3.out" })`); else `gsap.fromTo(root, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: "power2.out" })`. When `reached` flips false, reverse: tween to the band's control rect if on screen, else fade out. Under `reduce`, opacity only.
  - Label: `PillLabel` renders the one line for `dockLabel` with the `reveal` technique (max-width, max-height, opacity) beside the glyph; after `DOCK.holdMs` (paused while hovered or focused) it collapses over `DOCK.collapseMs` and `labelShown` becomes true for that state. `aria-live="polite"` on the label container; focus is never moved.
  - Returning: on mount, if `initSoundtrackFromStorage` restored `paused` and `sessionStorage.getItem("aaron-soundtrack-greeted")` is null, `returning = true`; set the key when the label collapses.
  - Failure: if `music` goes `on` then `paused` within 4s of `lastStartAt`, `failed = true` until the next successful `on`.
  - Click on the capsule: `before` or `off` starts the soundtrack (inside the click), otherwise opens the card as today.
  - "Freeze the wave" moves into `PlayerCard` as a row with the existing copy keys `listen.freeze`/`listen.unfreeze`, calling `conductor.setFrozen` through `BandStage`'s state lifted to a tiny store (`lib/waveform/freeze.ts`: `useFrozen()`, `setFrozen()`), so the band's `WaveCanvas` and the horizon both follow it.
- `BandInvite` (desktop and phone): on "Play it"/"Not now" click, `setDockSource(event.currentTarget.getBoundingClientRect())` before writing the state. The `replay` layer is removed (the capsule handles re-entry); the band shows `line`, `body`, the two buttons, and the notes per state as today.

- [ ] **Step 1: Build it** per the behaviour above.

- [ ] **Step 2: Verify by hand** in the worktree (production build on 3151, agent-browser `--session wave-c`): yes path (capsule condenses from "Play it", label, collapse, title in the capsule, on the wave's line); no path; unanswered; deep load at `#about` rises from the bottom; scroll back up returns it; audio 404 (block `**/audio/*.mp3`) shows the failed copy and a paused glyph. Save screenshots of the open label and the capsule in both themes.

- [ ] **Step 3: Type check, lint, unit tests, commit**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm test`

```bash
git add -A
git commit -m "feat(soundtrack): the pill condenses out of the band and lands on the wave"
```

---

### Task 12: e2e for the dock

**Files:**
- Modify: `e2e/soundtrack.spec.ts`

- [ ] **Step 1: Add tests** (reuse `instrument`, `media`, `scrollBandIntoView`):

1. "accept path": before the band `[data-pill]` is inert; at the band the question and both buttons are visible and `document.activeElement` is body; click "Play it"; `media()` reports a playing element (skip the time-advance check on this machine; assert `paused === false`); scroll to `#about`; within 1s the pill is not inert and shows "Music and volume live here."; within 4s the capsule shows the track title; capsule height at least 36 and its centre within 2px of viewport centre horizontally and within 4px of the probe's `strip().baseline`.
2. "decline path": click "Not now"; the note reads "No problem. It'll be here if you change your mind."; at `#about` the label reads "Here if you change your mind." then the capsule reads "Music"; `localStorage['aaron-soundtrack']` is "off"; reload at `/#about`: no label, the capsule reads "Music", `media()` is empty.
3. "unanswered": scroll from the band to `#about` without clicking: the capsule reads "Music?" and localStorage has no key.
4. "returning": set `localStorage['aaron-soundtrack'] = 'on'` before load; at `#about` the label reads "Welcome back. Your music is here."; a second navigation in the same context shows no label.
5. "audio failure": route `**/audio/*.mp3` to 404; click "Play it"; at `#about` the label reads "I couldn't start the music. Press here to try again." and the soundtrack state (read via `localStorage` plus the capsule text "Paused") is paused.
6. "arrival condenses from the control": with `?wavedebug`, click "Play it", then scroll just past the arrival threshold with the band still on screen; sample the pill root's bounding box every 50ms for 700ms: the first sample's centre is within 40px of the "Play it" button's last position and the last within 4px of the dock; y strictly increases.
7. "freeze lives in the card": at `#about` with music on, open the card, click "Freeze the wave", `horizonPaints` stops growing for a second; click "Let the wave move", it resumes.

- [ ] **Step 2: Run** `pnpm test:e2e -g "soundtrack|horizon"`; expected PASS (the environmental media-time case excepted, stated in the PR).

- [ ] **Step 3: Commit, open PR C into `wave`**

```bash
git add -A
git commit -m "test(e2e): the dock's accept, decline, unanswered, returning and failure paths"
```

PR title: "The pill condenses out of the band: dock, labels, copy". Body: screenshots of both themes, the arrival samples, and the suite summary.

---

### Task 13: Review pass (orchestrator)

- [ ] `/engineering:code-review` agents on each PR (one per PR, read-only), findings fixed by the PR's builder before merge into `wave`.
- [ ] A Fable review of the whole `wave` branch against the spec, then `/design-review` on a local production build of `wave` (light and dark, 1440 and 1024 wide, the sweep, the duck under each section, the pill's arrival both ways).
- [ ] Decision 2.11's unticked "later" line stays unticked; the build log gets a `wave` section; AGENTS.md Layer 2 gets the architecture update (shown as a diff, applied on Aaron's yes).
