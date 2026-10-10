import { describe, expect, it } from "vitest";
import { easeToward } from "@/lib/waveform/field";

describe("easeToward", () => {
  it("composes exactly: two half steps equal one whole step", () => {
    expect(easeToward(easeToward(0, 1, 0.1, 0.05), 1, 0.1, 0.05)).toBeCloseTo(easeToward(0, 1, 0.1, 0.1), 12);
  });
  it("covers its rate in one reference frame", () => {
    expect(easeToward(0, 1, 0.35, 1 / 45)).toBeCloseTo(0.35, 12);
  });
});
