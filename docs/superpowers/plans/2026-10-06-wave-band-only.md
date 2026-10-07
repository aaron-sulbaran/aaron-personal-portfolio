# wave-band-only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the rejected horizon strip, sweep, duck and pill condense off `main`. What remains is the band as it was before PR 21, plus the pill at its dock, introduced by a 300ms fade.

**Architecture:** This is a deletion behind the engine split. The conductor keeps the field, loop, audio sample, regime and conveyor (the band uses the conveyor for scroll travel and idle drift through `phase`). It loses the sweep. The band view loses the track transit. The pill's arrival becomes an opacity fade. It is driven by the band's existing IntersectionObserver, which now also reports "passed": the bottom edge has gone above the header bar's 72px line. `contrast.ts` (read only by its own test) and `probe.ts` (horizon and sweep readers only) are deleted. The footer's dock padding stays.

**Tech Stack:** Next 16, React 19, TypeScript strict, Tailwind 3.4, GSAP 3.15, vitest, Playwright (muted Chromium).

**Spec:** `docs/waveform-build-log-2026-10-05.md` ("Status after Aaron's hardware pass"); `docs/superpowers/plans/2026-10-06-first-public-edition.md` section 6, decision 1.

## Global Constraints

- Next 16, React 19, TypeScript strict, Tailwind 3.4, GSAP ScrollTrigger, vitest, Playwright muted.
- Clocks in seconds.
- No per-frame allocation or layout read in a paint.
- Test browsers launch muted and nobody presses Play it in an unmuted browser.
- **No em dashes anywhere.** Body copy, comments, docs, commit messages.
- **No hardcoded hex values in component files.** Tokens only.
- **All site copy lives in `lib/content.ts`.**
- **`prefers-reduced-motion` is respected globally.**
- Wave: one conductor steps the field and views only paint.
- Z scale: content 10, SiteNav 30, scrim 35, pill and panel 40, PlaybackPill 45, modals 50, flight 55, loader 60, cursor 100.
- No agent action may trigger a Vercel production build; never `vercel deploy`.
- Builders stop only processes they started; never `pkill`, `killall` or a port they did not open.
- Commits end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Port collision.** Another worktree is already serving 3140 or 3141, so `reuseExistingServer` would run this suite against that build. Expected: the final run refuses to reuse it. Pinned in Task 3, step 1.
2. **Deep load at `#about`.** The observer's first callback must report "passed", so the pill fades in with no scroll. Pinned in Task 1 (deep-load test).
3. **Turning back mid-fade.** The fade must reverse from the opacity it has, with no flash and no jump. Pinned in Task 1 (reversal test).
4. **Crossing the phone breakpoint while past the band.** The pill disappears on a phone and fades back in on desktop. Pinned in Task 1 (breakpoint test).
5. **Declined visitor on desktop.** The freeze toggle must not be a dead control, but a frozen wave can still be let go. Pinned in Task 2 (decline test).

---

### Task 1: The pill fades in at its dock

**Files:**
- Modify: `lib/waveform/dock.ts`, `lib/waveform/dock.test.ts`, `components/soundtrack/BandStage.tsx`, `components/soundtrack/PlaybackPill.tsx`, `components/soundtrack/BandInvite.tsx`, `e2e/soundtrack.spec.ts`, `e2e/support/wave.ts`
- Create: `components/soundtrack/usePillFade.ts`
- Delete: `components/soundtrack/usePillArrival.ts`

**Interfaces:**
- Produces: `bandPassed(bottom: number, rootTop: number | null, intersecting: boolean): boolean`; `DOCK.fadeMs = 300`; `DOCK.headerPx = 72`; `usePillFade(target: RefObject<HTMLElement | null>, shown: boolean): { present: boolean; landed: boolean }`; `bandBottomAt(page, y)` in `e2e/support/wave.ts`.

- [ ] **Step 1: Worktree**

```bash
git -C "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" worktree add "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-wave-band-only" -b wave-band-only main
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-wave-band-only" && pnpm install
```
Every later command runs from this worktree's root.

- [ ] **Step 2: Failing unit test.** In `lib/waveform/dock.test.ts`, change the import to `import { bandPassed, capsuleName, capsuleText, dockLabel, dockMode } from "./dock";` and replace the test "the arrival source is taken once" with:

```ts
  it("the band is passed once its bottom edge is above the header bar, never while it shows or lies below", () => {
    expect(bandPassed(-10, 72, false)).toBe(true);
    expect(bandPassed(72, 72, false)).toBe(true);
    expect(bandPassed(80, 72, true)).toBe(false);
    expect(bandPassed(1400, 72, false)).toBe(false);
    expect(bandPassed(40, null, false)).toBe(true);
  });
```

- [ ] **Step 3: Run** `pnpm vitest run lib/waveform/dock.test.ts`. Expected: FAIL, `bandPassed is not a function`.

- [ ] **Step 4: Implement in `lib/waveform/dock.ts`.**
  - Delete `setDockSource`, `takeDockSource`, the `docked` store (`getDocked`, `setDocked`, `subscribeDocked`) and their comments.
  - Change the `reached` comment to `// the band's bottom edge is above the header bar (bandPassed)`.
  - Replace `DOCK` and add `bandPassed`:

```ts
export const DOCK = {
  holdMs: 2600,
  collapseMs: 360,
  fadeMs: 300,
  headerPx: 72, // the header bar: a band tucked under it is already out of view
  capsulePx: 36,
  hitPx: 44,
  baselineFromBottomPx: 72,
  insetPx: 24, // the header mark's sm:left-6, so the mark and the pill share one left edge
};

// The reader has scrolled past the band: its bottom edge is above the header
// bar's line. A band below the viewport (the hero, the book) is not passed.
export function bandPassed(bottom: number, rootTop: number | null, intersecting: boolean): boolean {
  return !intersecting && bottom <= (rootTop ?? DOCK.headerPx);
}
```

- [ ] **Step 5: Run** `pnpm vitest run lib/waveform/dock.test.ts`. Expected: PASS.

- [ ] **Step 6: Failing e2e.**
  - Add to `e2e/support/wave.ts`:

```ts
// The band's bottom edge at `y` px from the viewport's top.
export async function bandBottomAt(page: Page, y: number) {
  const top = await page.evaluate((y) => document.getElementById("listen")!.getBoundingClientRect().bottom + window.scrollY - y, y);
  await scrollToY(page, Math.round(top));
}
```
  - In `e2e/soundtrack.spec.ts`, delete these tests: "dock: the first arrival condenses out of the pressed control…", "dock: after \"Not now\" the first arrival condenses…", "dock: an unanswered first trip condenses…", "dock: a declined later trip condenses…", "dock: a deep load at #about rises into place…", "dock: scrolling back above the threshold returns the pill…".
  - Also delete `near`, `arrival`, `condense`, `SOURCE_PX`, `NOT_NOW`, `VISIBLE_CONTROLS` and `VISIBLE_NOTE`.
  - Import `bandBottomAt` from `./support/wave`, then add:

```ts
// The introduction: an opacity fade at the dock once the band's bottom edge is
// above the header bar, and the same fade out when it returns. The box never moves.
async function fadeRun(page: Page, bottom: number) {
  await startDock(page, 25);
  await bandBottomAt(page, bottom);
  await page.waitForTimeout(DOCK.fadeMs + 250);
  return (await stopDock(page)).filter((s) => s.shown);
}

function expectStill(samples: DockSample[], rest: DockSample) {
  for (const s of samples) {
    expect({ transform: s.transform, computed: s.computed }).toEqual({ transform: "", computed: "none" });
    expect(Math.hypot(s.x - rest.x, s.y - rest.y), "the box held still").toBeLessThanOrEqual(0.5);
  }
}

test("dock: the pill fades in at its dock once the band's bottom edge passes the header bar, and fades out in place", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await bandControl(page, "before").click();
  await bandBottomAt(page, DOCK.headerPx + 12);
  await page.waitForTimeout(DOCK.fadeMs + 100);
  await expect(page.locator(PILL), "band edge still in view").toHaveAttribute("inert", "");
  const fadeIn = await fadeRun(page, DOCK.headerPx - 12);
  await dockLanded(page);
  const rest = (await readDock(page))!;
  expectStill(fadeIn, rest);
  const first = fadeIn.find((s) => s.opacity > 0)!;
  const full = fadeIn.find((s) => s.opacity === 1)!;
  expect(fadeIn.some((s) => s.opacity > 0.1 && s.opacity < 0.9), "a fade in between").toBe(true);
  expect(full.t - first.t, "the fade, ms").toBeGreaterThan(DOCK.fadeMs * 0.6);
  expect(full.t - first.t).toBeLessThan(DOCK.fadeMs * 1.6);
  const fadeOut = await fadeRun(page, DOCK.headerPx + 12);
  expectStill(fadeOut, rest);
  expect(fadeOut.some((s) => s.opacity > 0.1 && s.opacity < 0.9), "a fade out between").toBe(true);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
});

test("dock: a deep load at #about fades the pill in at its dock without moving", async ({ page }) => {
  await armDock(page, { fromLoad: true });
  await page.goto(`${HOME}#about`);
  await settled(page);
  await dockLanded(page);
  await page.waitForTimeout(200);
  const samples = (await stopDock(page)).filter((s) => s.shown);
  expectStill(samples, (await readDock(page))!);
  expect(samples.some((s) => s.opacity > 0 && s.opacity < 1), "a fade in").toBe(true);
});

test("dock: turning back mid-fade reverses from the opacity it has", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await startDock(page, 16);
  await bandBottomAt(page, DOCK.headerPx - 12);
  await page.waitForTimeout(DOCK.fadeMs / 2);
  await bandBottomAt(page, DOCK.headerPx + 12);
  await page.waitForTimeout(DOCK.fadeMs + 100);
  const samples = (await stopDock(page)).filter((s) => s.shown);
  expect(Math.max(...samples.map((s) => s.opacity)), "turned before full").toBeLessThan(1);
  for (let i = 1; i < samples.length; i++) expect(samples[i].opacity - samples[i - 1].opacity, `no jump at ${i}`).toBeLessThan(0.5);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
});

test("dock: a phone width removes the pill and desktop fades it back in", async ({ page }) => {
  await armDock(page);
  await page.goto(`${HOME}#about`);
  await settled(page);
  await dockLanded(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(PILL)).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await toAbout(page);
  await dockLanded(page);
  expect(Math.abs((await dockGeometry(page)).left - DOCK.insetPx)).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 7: Run** `pnpm test:e2e e2e/soundtrack.spec.ts --project=chromium -g "dock:"`. Expected: FAIL. The fade-in samples carry the condense's inline transform, and the deep load rises 12px.

- [ ] **Step 8: Implement.** Create `components/soundtrack/usePillFade.ts`:

```ts
"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { DOCK } from "@/lib/waveform/dock";

// The pill's introduction at its dock: opacity over DOCK.fadeMs when the
// band's bottom edge leaves the viewport, and the same fade out when the band
// returns. It never moves, so reduced motion gets the same fade. A reversal
// starts from the opacity it has. `present`: the root shows (in, or fading
// away). `landed`: fully in, which starts the label's hold.
export function usePillFade(target: RefObject<HTMLElement | null>, shown: boolean) {
  const [exiting, setExiting] = useState(false);
  const [landed, setLanded] = useState(false);
  const [previous, setPrevious] = useState(shown);
  const tween = useRef<gsap.core.Tween | null>(null);
  const out = useRef(false);

  if (shown !== previous) {
    setPrevious(shown);
    setExiting(!shown);
    setLanded(false);
  }

  useLayoutEffect(() => {
    const el = target.current;
    if (shown === out.current) return;
    out.current = shown;
    const running = tween.current?.isActive() ?? false;
    tween.current?.kill();
    tween.current = null;
    // No wrapper (the phone query matched): nothing to fade.
    if (!el) {
      out.current = false;
      gsap.delayedCall(0, () => setExiting(false));
      return;
    }
    const seconds = DOCK.fadeMs / 1000;
    if (shown) {
      const from = running ? Number(gsap.getProperty(el, "opacity")) : 0;
      tween.current = gsap.fromTo(el, { opacity: from }, {
        opacity: 1,
        duration: seconds * (1 - from),
        ease: "none",
        onComplete: () => {
          gsap.set(el, { clearProps: "opacity" });
          tween.current = null;
          setLanded(true);
        },
      });
      return;
    }
    // The wrapper keeps its 0 until the next fade in sets its own, so the
    // pill never flashes at rest before React hides the root.
    tween.current = gsap.to(el, {
      opacity: 0,
      duration: seconds * Number(gsap.getProperty(el, "opacity")),
      ease: "none",
      onComplete: () => {
        tween.current = null;
        setExiting(false);
      },
    });
  }, [shown, target]);

  useLayoutEffect(() => () => void tween.current?.kill(), []);

  return { present: shown || exiting, landed };
}
```

  - `PlaybackPill.tsx`: replace the `usePillArrival` import with `import { usePillFade } from "./usePillFade";`. Replace the call with `const { present, landed } = usePillFade(wrapperRef, shown);`. In the header comment, replace "it condenses out of the band control the visitor pressed (usePillArrival), lands open" with "it fades in at its dock once the band has left the viewport (usePillFade), opens".
  - `BandInvite.tsx`:
    - Delete the `lib/waveform/dock` import, the `docked` line and the header paragraph about the arrival source.
    - Make `act` just `moveFocus.current = event.currentTarget.dataset.focusTo === "note" ? "note" : "control"; write();`.
    - Give the controls `div` `className="grid"`.
  - `BandStage.tsx`:
    - Replace the `inView` state with `const [band, setBand] = useState({ inView: false, passed: false });`.
    - Make the observer callback `([entry]) => setBand({ inView: entry.isIntersecting, passed: bandPassed(entry.boundingClientRect.bottom, entry.rootBounds?.top ?? null, entry.isIntersecting) })` and its rootMargin `` `-${DOCK.headerPx}px 0px 0px 0px` ``.
    - Change the JSX to `<WaveCanvas active={band.inView} frozen={frozen} />` and `<PlaybackPill reached={band.passed} />`.
    - Delete `const reached = …`, the `useDockReached` function and the `useCallback` and `RefObject` imports. Import `bandPassed`.
  - `git rm components/soundtrack/usePillArrival.ts`

- [ ] **Step 9: Run** `pnpm test && pnpm tsc --noEmit && pnpm test:e2e e2e/soundtrack.spec.ts --project=chromium`. Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A lib/waveform/dock.ts lib/waveform/dock.test.ts components/soundtrack e2e/soundtrack.spec.ts e2e/support/wave.ts
git commit -m "feat(soundtrack): the pill fades in at its dock when the band leaves, no condense

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Remove the horizon, the sweep, the duck and their probe

**Files:**
- Delete:
  - `components/soundtrack/{horizonView.ts,HorizonCanvas.tsx,useSweepTrigger.ts}`
  - `lib/waveform/{sweep,track,duck,contrast,probe}.ts`
  - `lib/waveform/{sweep,track,duck,contrast}.test.ts`
  - `e2e/horizon.spec.ts`, `e2e/horizon-scrollbar.spec.ts`
- Modify:
  - `components/soundtrack/{waveConductor.ts,waveView.ts,WaveCanvas.tsx,viewParts.ts,BandStage.tsx}`
  - `lib/waveform/{dots.ts,dots.test.ts,layout.ts,layout.test.ts,field.ts}`
  - `app/globals.css`
  - `components/{AboutIntro,WhoIAm,UpToNow,UpToNowList,Connect,Footer}.tsx`
  - `playwright.config.ts`
  - `e2e/soundtrack.spec.ts`, `e2e/support/{wave,dock}.ts`

**Interfaces:**
- Consumes: `DOCK`, `bandPassed` (Task 1).
- Produces: `WaveConductor` without `sweep`, `setSweepTarget` or `subscribe`; `ViewOptions` without `kind`; `DotLayout` without `maxThick` and `baselineOffset`; `ACCENT_LINE` stays exported.

- [ ] **Step 1: Failing e2e.** In `e2e/soundtrack.spec.ts`:
  - Set `const HOME = "/";`. Drop the `HORIZON` import. Import only `parkBand` from `./support/wave` (plus `bandBottomAt`). Delete the probe line in `scrollBandIntoView`.
  - Replace the test "band: in flow directly under the book; the one fixed canvas is the horizon…" with:

```ts
// The wave lives in the band and nowhere else: no canvas fixed to the
// viewport, and no text outside the band carries the duck's mark.
test("band: in flow directly under the book; no canvas is fixed to the viewport", async ({ page }) => {
  await openHome(page, { path: HOME });
  const layout = await page.evaluate(() => {
    const band = document.getElementById("listen")!;
    const book = document.getElementById("work")!;
    const fixed = [...document.querySelectorAll("canvas")].filter((c) => {
      for (let n: HTMLElement | null = c; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
      return false;
    });
    return {
      followsBook: !!(book.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING),
      position: getComputedStyle(band).position,
      fixedCanvases: fixed.length,
      avoidOutsideBand: [...document.querySelectorAll("[data-wave-avoid]")].filter((el) => !band.contains(el)).length,
      bandTop: band.getBoundingClientRect().top + window.scrollY,
      bookBottom: book.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  expect(layout.followsBook).toBe(true);
  expect(["static", "relative"]).toContain(layout.position);
  expect(layout.fixedCanvases, "canvases fixed to the viewport").toBe(0);
  expect(layout.avoidOutsideBand, "duck marks outside the band").toBe(0);
  expect(layout.bandTop).toBeGreaterThan(layout.bookBottom - 100);
});
```
  - Footer test: change `"footer [data-wave-avoid]"` to `"footer > div"`.
  - Decline test: replace the freeze `toBeVisible` line with:

```ts
  // Declined, nothing in the band moves, so its freeze toggle is inert.
  await expect(band.locator("button", { hasText: L.freeze })).toHaveAttribute("inert", "");
```
  - Under `bandPaints`, add:

```ts
const bandRepaints = async (page: Page, ms: number) => {
  const before = await bandPaints(page);
  await page.waitForTimeout(ms);
  return (await bandPaints(page)) - before;
};
```
  - Replace the test "dock: the freeze toggle lives in the player card once music is on" with:

```ts
test("dock: the freeze toggle lives in the player card once music is on, and stops the band", async ({ page }) => {
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const bandFreeze = page.locator("#listen").getByRole("button", { name: L.freeze, exact: true });
  await expect(bandFreeze).toBeVisible();
  await bandControl(page, "before").click();
  await expect(bandFreeze).toBeHidden();
  const card = page.getByRole("group", { name: S.ariaOpen });
  const toggleInCard = async (name: string) => {
    await toAbout(page);
    await dockLanded(page);
    if ((await card.getAttribute("inert")) !== null) await page.locator(CAPSULE).click();
    await card.getByRole("button", { name, exact: true }).click();
  };
  await toggleInCard(L.freeze);
  await scrollBandIntoView(page);
  await page.waitForTimeout(300);
  expect(await bandRepaints(page, 1000), "band repaints in a frozen second").toBe(0);
  await toggleInCard(L.unfreeze);
  await scrollBandIntoView(page);
  await expect.poll(() => bandRepaints(page, 1000), { message: "band repaints once the wave moves" }).toBeGreaterThan(0);
});
```
  - Reduced-motion toggle test: delete its last line (the `sweep` poll).
  - In `e2e/support/dock.ts`, import `DOCK` from `@/lib/waveform/dock` and replace `dockGeometry` with:

```ts
// Where the capsule sits: its left edge DOCK.insetPx in, its centre on the dock's line.
export async function dockGeometry(page: Page) {
  return page.evaluate((fromBottom) => {
    const r = document.querySelector("[data-pill] .pill-hit")!.getBoundingClientRect();
    return { left: r.left, x: r.left + r.width / 2, y: r.top + r.height / 2, height: r.height, baseline: window.innerHeight - fromBottom };
  }, DOCK.baselineFromBottomPx);
}
```
  - In `e2e/support/wave.ts`:
    - Delete the `DUCK_SPLIT` and `WaveProbe` imports, `ProbeWindow`, `AVOID_BLOCKS`, `hasProbe`, `sweep`, `horizonPaints`, `paintedColumns`, `sweepTriggers`, `sweepTriggersCreated`, `themeOf`, `scrollHeld`, `paintsOver`, `DuckReport`, `duckReport` and `stripPixelsUnder`.
    - Keep `BAND_PARK`, `documentTop`, `parkBand` and `bandBottomAt`.
    - Header comment: `// Placing the page against the band.`

- [ ] **Step 2: Run** `pnpm test:e2e e2e/soundtrack.spec.ts --project=chromium -g "band:|dock: the freeze|declin"`. Expected: FAIL: `canvases fixed to the viewport` is 1, and the freeze toggle is not inert.

- [ ] **Step 3: Implement.**

```bash
git rm components/soundtrack/horizonView.ts components/soundtrack/HorizonCanvas.tsx components/soundtrack/useSweepTrigger.ts \
  lib/waveform/sweep.ts lib/waveform/sweep.test.ts lib/waveform/track.ts lib/waveform/track.test.ts \
  lib/waveform/duck.ts lib/waveform/duck.test.ts lib/waveform/contrast.ts lib/waveform/contrast.test.ts \
  lib/waveform/probe.ts e2e/horizon.spec.ts e2e/horizon-scrollbar.spec.ts
```

`waveConductor.ts`:
- Delete the `sweep` import, the `sweep` field, `setSweepTarget` (interface and object), and `subscribe`, `listeners` and `listeners.clear()`.
- `regimeNow` becomes `const regimeNow = (): Regime => regimeOf(getSoundtrackState());`.
- In `step`, delete `const sweeping = …` and `listeners.forEach(…)`, and end it with:

```ts
    const calm = regime !== "reactive" && arrived && !drifting;
    minFrameMs = calm ? SLOW_FRAME_MS : FAST_FRAME_MS;
    return settled && !moving && !views.some((view) => view.busy());
```
- Then:

```ts
  const running = () => !destroyed && !still && !frozen && !document.hidden && views.some((view) => view.active() || view.busy());
```
- Header comment: "the field, the loop, the audio sample, the regime, the clock and the scroll conveyor".

`waveView.ts`:
- Imports: drop `DotLayout`, `trainX`, `layTrack` and `createHorizonView`.
- Delete `kind` from `ViewOptions`, the `kind === "horizon"` dispatch, `xs`, `offsets`, `trackWeights`, `track`, `carveLayout`, `scratch`, `atX`, `sweepNow`, the five track lines in `measure`, and the header's train paragraph.
- `prepare` calls `carveTargets(layout, cursor, carve);`. `paint` is:

```ts
  const paint = (time: number) => {
    ctx.clearRect(0, 0, width, height);
    buildDots(conductor.field, layout, time, weights, cursor, muted, accent);
    painter.fill(muted, painter.colors.muted, alphas.muted);
    painter.fill(accent, painter.colors.accent, alphas.accent);
    ctx.globalAlpha = 1;
  };
```

`WaveCanvas.tsx`: drop `kind: "band",`.

`viewParts.ts`: delete `measureAvoidRects`, `inkBox` and the `Rect` import. Header: "What the band view draws with: colors read once per theme, the batched dot fills, the canvas sizing and the pointer."

`dots.ts`:
- Delete the `DUCK_SPLIT` import, `DuckSplit`, and the `maxThick` and `baselineOffset` fields. Keep `export const ACCENT_LINE`.
- `buildDots` drops its `ducked` parameter:

```ts
  muted.length = 0;
  accent.length = 0;
  const { columns, baseline, maxAmp } = layout;
  for (let i = 0; i < columns; i++) {
    const x = columnX(i);
    const weight = weights[i] ?? 1;
    const magnitude = FLOOR + (field.mag[i] - FLOOR) * weight;
    const cy = baseline - field.disp[i] * weight * maxAmp;
    const peak = magnitude > ACCENT_PEAK;
    pushDot(magnitude > ACCENT_LINE ? accent : muted, x, cy, CENTER_RADIUS, cursor, weight);
    const thick = Math.floor((magnitude * maxAmp) / DOT_GAP);
    for (let k = 1; k <= thick; k++) {
      const offset = k * DOT_GAP;
      const fade = 1 - k / (thick + 1.5);
      const shimmer = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.3 + k * 2.1);
      if (shimmer >= 0.5 + fade * 0.45) continue;
      const target = k >= thick && peak ? accent : muted;
      pushDot(target, x, cy - offset, FUZZ_RADIUS, cursor, weight);
      pushDot(target, x, cy + offset, FUZZ_RADIUS, cursor, weight);
    }
  }
```

`dots.test.ts`: delete "maxThick 1 stacks…", "baselineOffset moves…" and "a duck past half…".

`layout.ts`: delete `HORIZON` and `horizonLayout`. `layout.test.ts`: delete `describe("horizonLayout")` and its imports.

`field.ts` header: "The band's view (components/soundtrack/waveView.ts) turns these into dots."

`app/globals.css`: delete the `/* The horizon strip's top edge fades out… */` comment and the `.wave-horizon-mask { … }` rule.

Sections and footer:
- Delete every `data-wave-avoid` in `AboutIntro`, `WhoIAm`, `UpToNow`, `Connect` and `Footer`.
- In `UpToNowList`, delete `data-wave-avoid`, `data-wave-avoid-pad={AVOID_PAD}` and `const AVOID_PAD = 80;`.
- Keep the attributes in `BandInvite` and `BandStage`: the band view measures them.

`playwright.config.ts`: webkit `testIgnore` becomes `/(holding|touch|soundtrack)\.spec\.ts/`.

`BandStage.tsx`:
- Delete the conductor layout effect, `conductorRef`, `useSweepTrigger(…)`, `<HorizonCanvas />`, the `phone` line and their imports.
- Set `const freezable = !reduce && (music !== "off" || frozen);`.
- Header comment:

```ts
// The band's live half: the waveform, the credit and the pill. One
// IntersectionObserver on the band (its top margin is the header bar) runs the
// band's wave while it shows and hands the controls to the pill, which fades
// in at its dock once the band's bottom edge is above the bar. Phones stack
// the wave under the copy and have no pill. The freeze toggle stays here until
// music is chosen (the player card carries it then on desktop) and goes inert
// once declined, since nothing moves, unless the wave is frozen.
```

- [ ] **Step 4: Run**

```bash
pnpm test && pnpm tsc --noEmit && pnpm lint && pnpm test:e2e e2e/soundtrack.spec.ts e2e/pixels.spec.ts --project=chromium
```
Expected: PASS. The idle stats test still reads `MAIN_PAINTED = 4720` and the extent 60 to 100. `band-still.png` passes with `maxDiffPixels: 0`. Neither is edited.

- [ ] **Step 5: Commit**

```bash
git add -A components lib app e2e playwright.config.ts
git commit -m "refactor(soundtrack): remove the horizon strip, the sweep, the duck and their probe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Full verification and the build log

**Files:** Modify `docs/waveform-build-log-2026-10-05.md`.

- [ ] **Step 1: Port preflight.** Run `lsof -nP -iTCP:3140 -sTCP:LISTEN; lsof -nP -iTCP:3141 -sTCP:LISTEN`. Expected: no output. If another worktree holds a port, wait; never kill it.
- [ ] **Step 2: Run** `pnpm test && pnpm tsc --noEmit && pnpm lint && CI=1 pnpm test:e2e`. Expected: all green. `CI=1` makes a busy port fail loud instead of reusing another build.
- [ ] **Step 3: Leftovers.** Run `rg -n "horizon|sweep|DUCK|wavedebug|data-wave-avoid-pad|usePillArrival|setDockSource|getDocked" components lib app e2e`. Expected: no matches.
- [ ] **Step 4: Build log.** Under "Status after Aaron's hardware pass", replace the last paragraph's final sentence with: "Removed from `main` on 2026-10-06 (`wave-band-only`): the horizon strip, the sweep, the duck, the `?wavedebug` probe and the pill's condense. The pill fades in at its dock (300ms) once the band's bottom edge passes the header bar. The guards for defects 2, 4 to 9, 14 and 17 to 19 left with the code they guarded. AGENTS.md Layer 2 is updated in `go-live`."
- [ ] **Step 5: Commit**

```bash
git add docs/waveform-build-log-2026-10-05.md
git commit -m "docs(waveform): the band-only cut in the build log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
