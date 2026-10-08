import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
describe("toggle timing", () => {
  it("plays over the entrance's pull: (1 - pullStart) of its 1800ms, 756ms", () => {
    expect(COIL.toggle.durationMs).toBe(Math.round((1 - COIL.entrance.pullStart) * COIL.entrance.durationMs));
    expect(COIL.toggle.durationMs).toBe(756);
  });
  it("trails the capsule's second edge by Aaron's 99ms", () => expect(COIL.toggle.trailingDelayMs).toBe(99));
});
