import { describe, expect, it } from "vitest";
import { seek, STING } from "./sting";

describe("seek", () => {
  it("rests at 12 o'clock: three sectors behind the lead edge, no contacts, nothing of the word", () => {
    const f = seek(0);
    expect(f.scope?.sectors[0]).toBe("M256 256L161.637 44.057A232 232 0 0 1 256 24Z");
    expect(f.scope?.contacts).toEqual([null, null, null]);
    expect(f.struck).toBe(false);
    expect(f.dieY).toBeNull();
    expect(f.coinScale).toBe(1);
    expect(f.wipeWidth).toBe(0);
    expect(f.wordDone).toBe(false);
  });
  it("lights each contact when the lead edge crosses its bearing, then dims it", () => {
    const at = (ms: number) => seek(ms).scope?.contacts ?? [];
    expect(at(184)[0]).toBeNull();
    expect(at(190)[0]?.opacity).toBeGreaterThan(0.98);
    expect(at(600)[0]?.opacity).toBeLessThan(at(190)[0]?.opacity ?? 0);
    expect(at(700)[1]).not.toBeNull();
    expect(at(1000)[2]).not.toBeNull();
  });
  it("relights only the first contact nearer the centre, 1335 ms in", () => {
    const early = seek(1000).scope?.contacts[0];
    const late = seek(1340).scope?.contacts[0];
    const centreDistance = (c?: { x: number; y: number } | null) => (c ? Math.hypot(c.x - 256, c.y - 256) : NaN);
    expect(centreDistance(early)).toBeCloseTo(196, 0);
    expect(centreDistance(late)).toBeCloseTo(64, 0);
    expect(centreDistance(seek(1500).scope?.contacts[1])).toBeCloseTo(190, 0);
  });
  it("drops the die from out of frame, accelerating, and lands it on the strike", () => {
    expect(seek(1300).dieY).toBeNull();
    expect(seek(1310).dieY).toBe(-STING.dieLift);
    const halfway = seek(1430).dieY ?? 0;
    expect(halfway).toBeLessThan(-STING.dieLift / 2);
    expect(halfway).toBeGreaterThan(-STING.dieLift);
    expect(seek(1549).dieY ?? 0).toBeGreaterThan(-20);
    expect(seek(1550).dieY).toBeNull();
  });
  it("strikes hard: the scope is gone, the coin at 96 percent for two frames, then settles", () => {
    const hit = seek(STING.strikeMs);
    expect(hit.struck).toBe(true);
    expect(hit.scope).toBeNull();
    expect(hit.coinScale).toBe(0.96);
    expect(seek(STING.strikeMs + 66).coinScale).toBe(0.96);
    expect(seek(STING.strikeMs + 167).coinScale).toBeGreaterThan(0.96);
    expect(seek(STING.strikeMs + 167).coinScale).toBeLessThan(1);
    expect(seek(STING.strikeMs + 268).coinScale).toBe(1);
  });
  it("fans the word out S first, never letting two letters touch", () => {
    const [start] = STING.wordMs;
    expect(seek(start - 1).wipeWidth).toBe(0);
    const mid = seek(start + 300);
    expect(mid.letterShift[3]).toBeGreaterThan(mid.letterShift[2]);
    expect(mid.letterShift[2]).toBeGreaterThan(mid.letterShift[1]);
    expect(mid.letterShift[1]).toBeGreaterThan(mid.letterShift[0]);
    expect(mid.wordDone).toBe(false);
    for (let t = start; t <= STING.wordMs[1]; t += 20) {
      const { letterShift: s } = seek(t);
      expect(s[1] - s[0]).toBeGreaterThanOrEqual(-12);
      expect(s[2] - s[1]).toBeGreaterThanOrEqual(-12);
      expect(s[3] - s[2]).toBeGreaterThanOrEqual(-12);
    }
    expect(seek(STING.wordMs[1]).wordDone).toBe(true);
  });
  it("is a pure function of time", () => {
    expect(seek(1234)).toEqual(seek(1234));
  });
});
