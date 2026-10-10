import { describe, expect, it } from "vitest";
import { AMPLITUDE, SPACING } from "./constants";
import { dotReach, runColumns } from "./columns";
import { rippleFit } from "./fit";

const cols = runColumns(1440, 100, SPACING);
const layout = (rects: { left: number; right: number; top: number; bottom: number }[]) => ({
  columns: cols.count, startX: cols.x[0], spacing: SPACING, baseline: 100, feather: 48, edgeTaper: 0, rects,
});
const at = (x: number) => Math.round((x - cols.x[0]) / SPACING);

describe("the ripple's fit to the band's copy", () => {
  it("is 1 everywhere when no copy is near", () => {
    expect([...rippleFit(layout([]), AMPLITUDE, null)].every((f) => f === 1)).toBe(true);
  });
  it("is 0 under copy that only clears the resting reach, and 1 far from it", () => {
    // A box whose nearest edge sits exactly dotReach above the midline: room for the resting shape, none for the crest.
    const box = { left: 600, right: 800, top: 0, bottom: 100 - dotReach(AMPLITUDE) };
    const fit = rippleFit(layout([box]), AMPLITUDE, null);
    expect(fit[at(700)]).toBe(0);
    expect(fit[at(100)]).toBe(1);
    expect(fit[at(580)], "eases in across the feather").toBeGreaterThanOrEqual(0);
    expect(fit[at(580)]).toBeLessThan(1);
  });
  it("reuses its array when the length matches", () => {
    const out = new Float32Array(cols.count);
    expect(rippleFit(layout([]), AMPLITUDE, out)).toBe(out);
  });
});
