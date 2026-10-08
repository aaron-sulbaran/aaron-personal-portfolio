import { describe, expect, it } from "vitest";
import { MARK_HOLD_IDLE } from "@/lib/cursor/hover";
import { ringPaint } from "@/lib/mark/ring";

const width = 4 * (100 / 56);
const radius = 50 - width / 2;
const at = (fill: number, spent = 0, closed = false) => ringPaint({ fill, spent, closed, hidden: false }, width, radius);

describe("the ring's hold indicator", () => {
  it("rests empty", () => {
    expect(ringPaint(MARK_HOLD_IDLE, width, radius)).toMatchObject({ washTop: 100, washHeight: 0, arcDegrees: 0, arcVisible: false });
  });

  it("rises with the fill: half a hold is half the wash and 37.5 degrees", () => {
    expect(at(0.5)).toMatchObject({ washTop: 50, washHeight: 50, arcDegrees: 37.5, arcVisible: true });
  });

  it("reaches 75 degrees at full, closes the circle on the discharge, and the wash leaves from the bottom", () => {
    expect(at(1).arcDegrees).toBe(75);
    expect(at(1, 0.5, true)).toMatchObject({ arcDegrees: 360, dashArray: "360 0", washTop: 0, washHeight: 50 });
  });
});
