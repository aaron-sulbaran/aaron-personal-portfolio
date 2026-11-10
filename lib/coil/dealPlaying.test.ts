import { describe, expect, it } from "vitest";
import { isDealPlaying } from "./dealPlaying";

describe("isDealPlaying", () => {
  it("is true while the cutscene runs and the stage is unfurled", () => {
    expect(isDealPlaying("dealing")).toBe(true);
    expect(isDealPlaying("unfurled")).toBe(true);
  });

  it("is false before the deal, after it, and when nothing is set", () => {
    for (const state of ["pending", "closed", "dealt", "", undefined]) {
      expect(isDealPlaying(state)).toBe(false);
    }
  });
});
