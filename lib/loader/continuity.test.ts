import { describe, expect, it } from "vitest";
import type { NameTarget } from "@/lib/loader/handoff";
import {
  greetingColor,
  greetingInBox,
  landing,
  landingGradient,
  landingOpacity,
  landingTransform,
  parseRgb,
  type NameBox,
} from "@/lib/loader/continuity";

const target: NameTarget = {
  left: 216,
  baseline: 520,
  width: 1008,
  fontPx: 364,
  greeting: { left: 223.28, baseline: 230.5, fontPx: 65.52 },
  gradient: { top: 272, height: 262, from: [200, 210, 220], to: [40, 50, 60] },
  inkAlpha: 0.264,
};

// The desktop loader: 1440 wide, a 16px gutter, the name centered vertically.
const box: NameBox = { left: 16, top: 283, width: 1408, height: 334, rotationDeg: 0 };

// Where the box's corners land under a transform about its center.
function landed(b: NameBox, l: ReturnType<typeof landing>) {
  const cx = b.left + b.width / 2 + l.dx;
  const cy = b.top + b.height / 2 + l.dy;
  return {
    left: cx - (b.width * l.scale) / 2,
    right: cx + (b.width * l.scale) / 2,
    bottom: cy + (b.height * l.scale) / 2,
  };
}

describe("continuity landing", () => {
  it("puts the ink on the canvas ink: same width, same baseline", () => {
    const l = landing(box, target);
    const end = landed(box, l);
    expect(end.left).toBeCloseTo(target.left, 6);
    expect(end.right).toBeCloseTo(target.left + target.width, 6);
    expect(end.bottom).toBeCloseTo(target.baseline, 6);
  });

  it("unrotates the phone's name as it lands", () => {
    const phone: NameBox = { left: -300, top: 328, width: 812, height: 187, rotationDeg: -90 };
    const l = landing(phone, target);
    expect(landingTransform(l, 0)).toContain("rotate(-90.000deg)");
    expect(landingTransform(l, 1)).toContain("rotate(0.000deg)");
    expect(landed(phone, l).bottom).toBeCloseTo(target.baseline, 6);
  });

  it("starts at identity", () => {
    expect(landingTransform(landing(box, target), 0)).toBe("translate(0.00px, 0.00px) rotate(0.000deg) scale(1.00000)");
  });

  it("dims from solid to the composite's ink", () => {
    expect(landingOpacity(target, 0)).toBe(1);
    expect(landingOpacity(target, 1)).toBeCloseTo(0.264, 9);
  });

  it("wears the accent, then the canvas gradient across the mask rect", () => {
    const accent = [127, 168, 201] as const;
    const glyphTop = -0.11364 * 525;
    const start = landingGradient(accent, target, box, glyphTop, 0);
    expect(start.match(/rgb\(127, 168, 201\)/g)?.length).toBe(9);
    const end = landingGradient(accent, target, box, glyphTop, 1);
    expect(end).toContain("rgb(200, 210, 220)");
    expect(end).toContain("rgb(40, 50, 60)");
    // The first stop sits at the mask's top in glyph px.
    const scale = target.width / box.width;
    const landedTop = target.baseline - box.height * scale;
    const first = Number(end.match(/rgb\(200, 210, 220\) (-?[\d.]+)px/)?.[1]);
    expect(first).toBeCloseTo((target.gradient.top - landedTop) / scale - glyphTop, 1);
  });

  it("lands the greeting on the canvas greeting from the box's own px", () => {
    for (const b of [box, { left: -300, top: 328, width: 812, height: 187, rotationDeg: -90 }]) {
      const l = landing(b, target);
      const g = greetingInBox(b, target);
      // Box-local px through the landed transform (rotation spent, about the center).
      const cx = b.left + b.width / 2 + l.dx;
      const cy = b.top + b.height / 2 + l.dy;
      expect(cx + (g.left - b.width / 2) * l.scale).toBeCloseTo(target.greeting.left, 6);
      expect(cy + (g.baseline - b.height / 2) * l.scale).toBeCloseTo(target.greeting.baseline, 6);
      expect(g.fontPx * l.scale).toBeCloseTo(target.greeting.fontPx, 6);
    }
    // The greeting rides above the box: its baseline is above the cap line.
    expect(greetingInBox(box, target).baseline).toBeLessThan(0);
  });

  it("dresses the greeting in the accent, then the gradient's top color", () => {
    const accent = [127, 168, 201] as const;
    expect(greetingColor(accent, target, 0)).toBe("rgb(127, 168, 201)");
    expect(greetingColor(accent, target, 1)).toBe("rgb(200, 210, 220)");
    expect(greetingColor(accent, target, 0.5)).toBe("rgb(164, 189, 211)");
  });

  it("reads computed colors", () => {
    expect(parseRgb("rgb(127, 168, 201)")).toEqual([127, 168, 201]);
    expect(parseRgb("rgba(1, 2, 3, 0.5)")).toEqual([1, 2, 3]);
    expect(parseRgb("color(srgb 1 1 1)")).toBeNull();
  });
});
