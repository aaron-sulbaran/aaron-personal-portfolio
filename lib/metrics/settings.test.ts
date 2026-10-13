import { expect, it } from "vitest";
import { MORPH, SKYLINE, TOKENS } from "./settings";

it("starts the strip on Commits with the brand pair until Aaron picks in the lab", () => {
  expect(TOKENS).toEqual({ colorSet: "brand", heightCurve: "sqrt", heightCap: 1, minShare: 0, segmentGap: 1, switchMs: 900, switchStagger: 0.42, first: "commits" });
});

it("pins Aaron's round 4 pick", () => {
  expect(SKYLINE).toEqual({
    window: "6mo", lightestShare: 30, heightCurve: "power", levelCurve: "linear", heightCap: 1, durationMs: 1300, prismRadius: 0.17 / 0.78,
    depth: { mode: "bevel", lift: 1.5, edge: 0.08, hi: 100, paper: 3 },
  });
  expect(MORPH).toEqual({ triggerPct: 60, inViewShare: 0.6, settledMs: 120, settleSpeed: 300, durationMs: 1300 });
});
