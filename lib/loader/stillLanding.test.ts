import { describe, expect, it } from "vitest";
import { PROFA_METRICS } from "@/lib/loader/lockup";
import { landingOrigin, restNameBox, stillLanding } from "@/lib/loader/stillLanding";
import type { NameBox } from "@/lib/loader/continuity";

// The resting name at 1440x1200 (the wide pose): a 357.91px name centered on 600.
const fontPx = 357.91;
const m = PROFA_METRICS;
const span = { left: 224.96 + m.inkL * fontPx, top: 600 + (m.capR * fontPx) / 2 - m.base * fontPx };

// Where the box's ink lands under the landing, about the box's center.
function landedInk(box: NameBox, l: NonNullable<ReturnType<typeof stillLanding>>) {
  const cx = box.left + box.width / 2 + l.dx;
  const cy = box.top + box.height / 2 + l.dy;
  return { left: cx - (box.width * l.scale) / 2, baseline: cy + (box.height * l.scale) / 2, width: box.width * l.scale };
}

describe("the still path's landing", () => {
  it("reads the resting name's ink box off its line-height 1 text box", () => {
    const box = restNameBox(span, fontPx, m);
    expect(box.left).toBeCloseTo(224.96, 6);
    expect(box.top + box.height, "the box's bottom is the baseline").toBeCloseTo(600 + (m.capR * fontPx) / 2, 6);
    expect(box.width).toBeCloseTo(m.inkW * fontPx, 6);
    expect(box.height).toBeCloseTo(m.capR * fontPx, 6);
    expect(box.rotationDeg).toBe(0);
  });

  it("is skipped when the landed name is within 1px of the resting one", () => {
    const box = restNameBox(span, fontPx, m);
    const at = { left: box.left, baseline: box.top + box.height, width: box.width };
    expect(stillLanding(box, at)).toBeNull();
    expect(stillLanding(box, { ...at, left: at.left + 0.9, baseline: at.baseline - 1, width: at.width + 1 })).toBeNull();
    expect(stillLanding(box, { ...at, left: at.left + 1.5 })).not.toBeNull();
    expect(stillLanding(box, { ...at, baseline: at.baseline + 1.5 })).not.toBeNull();
    expect(stillLanding(box, { ...at, width: at.width - 1.5 })).not.toBeNull();
  });

  it("lands the resting name's ink on the baked name's", () => {
    // The wide cut's name through cover at 1440x1200: s = 4/3, 240 cropped each side.
    const baked = { left: 224.96 * (4 / 3) - 240, baseline: 563.88 * (4 / 3), width: 990.08 * (4 / 3) };
    const box = restNameBox(span, fontPx, m);
    const l = stillLanding(box, baked)!;
    expect(l.scale).toBeCloseTo(baked.width / box.width, 6);
    const ink = landedInk(box, l);
    expect(ink.left).toBeCloseTo(baked.left, 6);
    expect(ink.baseline).toBeCloseTo(baked.baseline, 6);
    expect(ink.width).toBeCloseTo(baked.width, 6);
  });

  it("turns about the name's ink box center, in the layer's own px", () => {
    const box: NameBox = { left: 100, top: 300, width: 800, height: 200, rotationDeg: 0 };
    expect(landingOrigin(box, { left: 0, top: 0 })).toBe("500.00px 400.00px");
    expect(landingOrigin(box, { left: 20, top: -150 })).toBe("480.00px 550.00px");
  });
});
