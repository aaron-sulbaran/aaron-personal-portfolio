import { expect, it } from "vitest";
import { DEFAULT_LABELS } from "./labels";
import { MORPH, SKYLINE, TOKENS } from "./settings";

it("pins Aaron's Tokens pick: the official kits, no seam, starting on Commits", () => {
  expect(TOKENS).toEqual({
    colorSet: "official", heightCurve: "sqrt", heightCap: 1, minShare: 0.02, segmentGap: 0, switchMs: 1500, switchStagger: 0.42, first: "commits",
    waveGapMs: 120, waveOffsetMs: 150, maskMs: 360, labels: DEFAULT_LABELS,
  });
});

it("pins Aaron's round 4 pick", () => {
  expect(SKYLINE).toEqual({
    window: "6mo", lightestShare: 30, heightCurve: "power", levelCurve: "linear", heightCap: 1, durationMs: 1300, prismRadius: 0.17 / 0.78,
    depth: { mode: "bevel", lift: 1.5, edge: 0.08, hi: 100, paper: 3 },
  });
  expect(MORPH).toEqual({ triggerPct: 60, inViewShare: 0.6, settledMs: 120, settleSpeed: 300, durationMs: 1300 });
});
