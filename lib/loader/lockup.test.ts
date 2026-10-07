import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import type { NameTarget } from "@/lib/loader/handoff";
import { greetingInBox, landing, landingGradient, type NameBox } from "@/lib/loader/continuity";
import {
  CSS_ARITH,
  NUM_ARITH,
  PROFA_METRICS,
  lockupMetrics,
  lockupPose,
  lockupSpans,
  restLockupCss,
  type LockupMetrics,
} from "@/lib/loader/lockup";

const L = COIL.lockup;
const wide = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

// The canvas lockup's rules (components/coil/scene/name.ts), restated from
// the metrics: what the loader's resting lockup has to reproduce.
function canvasRules(view: { width: number; height: number }, m: LockupMetrics, narrow: boolean) {
  const size = (view.width * (narrow ? L.widthNarrow : L.widthWide)) / m.advW;
  const ascent = m.capR * size;
  const capTop = view.height / 2 - ascent / 2;
  const left = (view.width - m.inkW * size) / 2;
  const greetPx = (L.greetingCap * ascent) / m.capH;
  const pad = Math.ceil(size * L.pad);
  return {
    size,
    left,
    baseline: capTop + ascent,
    greetPx,
    greetLeft: left + size * L.greetingShift,
    greetBaseline: capTop - m.gDesc * greetPx - L.greetingGap * m.gAsc * greetPx,
    maskTop: capTop - pad,
    maskHeight: ascent + m.descR * size + 2 * pad,
  };
}

// The target the scene would report for that lockup, in the colors of the
// light theme's gradient.
function targetOf(view: { width: number; height: number }, narrow: boolean): NameTarget {
  const pose = lockupPose(NUM_ARITH, view, PROFA_METRICS, narrow);
  return {
    left: pose.name.left,
    baseline: pose.name.baseline,
    width: PROFA_METRICS.inkW * pose.name.fontPx,
    fontPx: pose.name.fontPx,
    greeting: pose.greeting,
    gradient: { top: pose.mask.top, height: pose.mask.height, from: [76, 112, 152], to: [22, 50, 79] },
    inkAlpha: 0.264,
  };
}

describe("the resting lockup", () => {
  it("follows the canvas lockup's rules, wide and narrow", () => {
    for (const [view, narrow] of [
      [wide, false],
      [phone, true],
    ] as const) {
      const rules = canvasRules(view, PROFA_METRICS, narrow);
      const pose = lockupPose(NUM_ARITH, view, PROFA_METRICS, narrow);
      expect(pose.name.fontPx).toBeCloseTo(rules.size, 9);
      expect(pose.name.left).toBeCloseTo(rules.left, 9);
      expect(pose.name.baseline).toBeCloseTo(rules.baseline, 9);
      expect(pose.greeting.fontPx).toBeCloseTo(rules.greetPx, 9);
      expect(pose.greeting.left).toBeCloseTo(rules.greetLeft, 9);
      expect(pose.greeting.baseline).toBeCloseTo(rules.greetBaseline, 9);
      expect(pose.mask.top).toBeCloseTo(rules.maskTop, 9);
      expect(pose.mask.height).toBeCloseTo(rules.maskHeight, 9);
    }
    // The desktop name the scene reported at 1440 by 900 (probe, 2026-10-06).
    const pose = lockupPose(NUM_ARITH, wide, PROFA_METRICS, false);
    expect(pose.name.left).toBeCloseTo(224.96, 1);
    expect(pose.name.baseline).toBeCloseTo(563.88, 1);
  });

  it("is the pose the continuity exit lands on (the fast path's pose is the landed pose)", () => {
    const target = targetOf(wide, false);
    const pose = lockupPose(NUM_ARITH, wide, PROFA_METRICS, false);
    const spans = lockupSpans(NUM_ARITH, pose, PROFA_METRICS);
    // The loader's big name, as on a 1440 by 900 pane, landed by the exit.
    const box: NameBox = { left: 16, top: 283, width: 1408, height: 509.2 * PROFA_METRICS.capR, rotationDeg: 0 };
    const l = landing(box, target);
    const cx = box.left + box.width / 2 + l.dx;
    const cy = box.top + box.height / 2 + l.dy;
    // The name's ink box.
    expect(cx - (box.width * l.scale) / 2).toBeCloseTo(spans.name.left - PROFA_METRICS.inkL * spans.name.fontPx, 6);
    expect(cy + (box.height * l.scale) / 2).toBeCloseTo(spans.name.top + PROFA_METRICS.base * spans.name.fontPx, 6);
    expect(box.width * l.scale).toBeCloseTo(PROFA_METRICS.inkW * spans.name.fontPx, 6);
    // The greeting.
    const g = greetingInBox(box, target);
    expect(cx + (g.left - box.width / 2) * l.scale).toBeCloseTo(
      spans.greeting.left - PROFA_METRICS.gInkL * spans.greeting.fontPx,
      6,
    );
    expect(cy + (g.baseline - box.height / 2) * l.scale).toBeCloseTo(
      spans.greeting.top + PROFA_METRICS.base * spans.greeting.fontPx,
      6,
    );
    expect(g.fontPx * l.scale).toBeCloseTo(spans.greeting.fontPx, 6);
    // The gradient's first stop sits on the same viewport row on both sides.
    const glyphTop = -(PROFA_METRICS.base - PROFA_METRICS.capR) * (box.height / PROFA_METRICS.capR);
    const exitStops = landingGradient([127, 168, 201], target, box, glyphTop, 1);
    const firstExit = Number(exitStops.match(/rgb\(76, 112, 152\) (-?[\d.]+)px/)?.[1]);
    const landedTop = target.baseline - box.height * l.scale;
    const exitRow = landedTop + (glyphTop + firstExit) * l.scale;
    expect(spans.name.top + spans.gradient.top).toBeCloseTo(exitRow, 1);
    expect(spans.gradient.height).toBeCloseTo(target.gradient.height, 6);
  });

  it("writes the same arithmetic as CSS calc", () => {
    for (const [view, narrow] of [
      [wide, false],
      [phone, true],
    ] as const) {
      const vars = Object.fromEntries(Object.entries(PROFA_METRICS).map(([k, v]) => [`var(--${k})`, String(v)]));
      const metrics = Object.fromEntries(Object.keys(PROFA_METRICS).map((k) => [k, `var(--${k})`])) as unknown as Record<
        keyof LockupMetrics,
        string
      >;
      const css = lockupSpans(CSS_ARITH, lockupPose(CSS_ARITH, { width: "100cqw", height: "100cqh" }, metrics, narrow), metrics);
      const num = lockupSpans(NUM_ARITH, lockupPose(NUM_ARITH, view, PROFA_METRICS, narrow), PROFA_METRICS);
      // Evaluate the calc text with the pane's size and the metrics put in.
      const evaluate = (expr: string) => {
        let js = expr.replace(/var\(--\w+\)/g, (v) => vars[v]).replace(/100cqw/g, String(view.width)).replace(/100cqh/g, String(view.height));
        js = js.replace(/round\(up, /g, "Math.ceil(").replace(/, 1px\)/g, ")");
        return Number(new Function(`return ${js};`)());
      };
      expect(evaluate(css.name.left)).toBeCloseTo(num.name.left, 6);
      expect(evaluate(css.name.top)).toBeCloseTo(num.name.top, 6);
      expect(evaluate(css.name.fontPx)).toBeCloseTo(num.name.fontPx, 6);
      expect(evaluate(css.greeting.left)).toBeCloseTo(num.greeting.left, 6);
      expect(evaluate(css.greeting.top)).toBeCloseTo(num.greeting.top, 6);
      expect(evaluate(css.greeting.fontPx)).toBeCloseTo(num.greeting.fontPx, 6);
      expect(evaluate(css.gradient.top)).toBeCloseTo(num.gradient.top, 6);
      expect(evaluate(css.gradient.height)).toBeCloseTo(num.gradient.height, 6);
    }
  });

  it("ships rules for both compositions and the theme's gradient", () => {
    const css = restLockupCss();
    expect(css).toContain("@container (aspect-ratio < 800/1000)");
    expect(css).toContain("var(--name-grad-top)");
    expect(css).toContain("var(--name-grad-bottom)");
    expect(css).toContain(`calc(var(--name-ink) * ${L.inkGain})`);
    expect(css).not.toMatch(/NaN|undefined/);
  });
});

describe("the lockup's metrics", () => {
  // Profa Black at 1000px in Chromium (probe, 2026-10-06).
  const name = { width: 2816.36, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 2766.36, actualBoundingBoxAscent: 636.36, actualBoundingBoxDescent: 10, fontBoundingBoxAscent: 818, fontBoundingBoxDescent: 318 };
  const greeting = { width: 2781.82, actualBoundingBoxLeft: -51.82, actualBoundingBoxRight: 2731.82, actualBoundingBoxAscent: 687.27, actualBoundingBoxDescent: 119.09, fontBoundingBoxAscent: 818, fontBoundingBoxDescent: 318 };
  const cap = { ...name, actualBoundingBoxAscent: 636.36 };

  it("reads a face's metrics per em, the baseline under a line-height 1 box included", () => {
    const m = lockupMetrics(name, greeting, cap, 1000)!;
    expect(m.advW).toBeCloseTo(2.81636, 4);
    expect(m.inkW).toBeCloseTo(2.76636, 4);
    expect(m.capR).toBeCloseTo(0.63636, 4);
    expect(m.base).toBeCloseTo(0.75, 6);
    expect(m.gInkL).toBeCloseTo(-0.05182, 4);
    expect(m.gDesc).toBeCloseTo(0.11909, 4);
    for (const key of Object.keys(PROFA_METRICS) as (keyof LockupMetrics)[]) expect(m[key]).toBeCloseTo(PROFA_METRICS[key], 3);
  });

  it("refuses a face that is not the display face yet", () => {
    expect(lockupMetrics({ ...name, actualBoundingBoxRight: 900 }, greeting, cap, 1000)).toBeNull();
    expect(lockupMetrics(name, greeting, { ...cap, actualBoundingBoxAscent: 0 }, 1000)).toBeNull();
  });
});
