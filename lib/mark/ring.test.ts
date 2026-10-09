import { describe, expect, it } from "vitest";
import { MARK_HOLD_IDLE } from "@/lib/cursor/hover";
import { ringPaint } from "@/lib/mark/ring";

const width = 4 * (100 / 56);
const radius = 50 - width / 2;
const at = (fill: number, spent = 0) => ringPaint({ fill, spent, hidden: false }, width, radius);

describe("the ring's hold indicator", () => {
  it("rests empty", () => {
    expect(ringPaint(MARK_HOLD_IDLE, width, radius)).toMatchObject({ washTop: 100, washHeight: 0, arcDegrees: 0, arcVisible: false });
  });

  it("is the fill itself: half a hold is half the wash and half the border", () => {
    expect(at(0.5)).toMatchObject({ washTop: 50, washHeight: 50, arcDegrees: 180, arcVisible: true });
    for (const fill of [0.1, 0.25, 0.6, 0.9, 0.99]) {
      const frame = at(fill);
      expect(frame.arcDegrees / 360).toBeCloseTo(fill, 12);
      expect(1 - frame.washTop / 100).toBeCloseTo(fill, 12);
    }
  });

  it("closes the whole border at full hold, not before, and the wash leaves from the bottom in the discharge", () => {
    expect(at(0.999).arcDegrees).toBeLessThan(360);
    expect(at(1)).toMatchObject({ arcDegrees: 360, dashArray: "360 0", dashOffset: "0", washTop: 0, washHeight: 100 });
    expect(at(1, 0.5)).toMatchObject({ arcDegrees: 360, dashArray: "360 0", washTop: 0, washHeight: 50 });
  });
});
