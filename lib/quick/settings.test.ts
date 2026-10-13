import { describe, expect, it } from "vitest";
import { timings } from "./motion";
import { DEFAULT_SETTINGS, exportValues, parseSettings, sameSettings } from "./settings";

describe("parseSettings", () => {
  it("falls back to the defaults for nothing, junk or a wrong shape", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[1,2]")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ variant: "glance", order: "sideways", speed: "fast", reduced: 1 }))).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps every valid field and clamps the speed", () => {
    expect(parseSettings(JSON.stringify({ variant: "road", order: "oldest", speed: 9, reduced: true }))).toEqual({ variant: "road", order: "oldest", speed: 3, reduced: true });
    expect(parseSettings(JSON.stringify({ speed: 0 })).speed).toBe(0.25);
  });

  it("round-trips", () => {
    const settings = { variant: "rail" as const, order: "oldest" as const, speed: 1.5, reduced: false };
    expect(sameSettings(parseSettings(JSON.stringify(settings)), settings)).toBe(true);
  });

  it("exports the settings with the theme", () => {
    expect(exportValues(DEFAULT_SETTINGS, "dark")).toEqual({ lab: "quick", round: 2, ...DEFAULT_SETTINGS, theme: "dark" });
  });
});

describe("timings", () => {
  it("scales every duration by the speed", () => {
    const base = timings(1);
    const fast = timings(2);
    expect(fast.chaseS).toBeCloseTo(base.chaseS / 2);
    expect(fast.wipeS).toBeCloseTo(base.wipeS / 2);
    expect(timings(100).chaseS).toBeCloseTo(timings(3).chaseS);
  });
});
