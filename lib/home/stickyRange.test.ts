import { describe, expect, it } from "vitest";
import { stageGone, stickyProgress } from "@/lib/home/stickyRange";

describe("the sticky stage's range", () => {
  const frame = (railTop: number, range = 600) => ({ railTop, range, sectionTop: railTop + range, viewportHeight: 800 });

  it("is 0 where the stage sticks, 1 where it lets go, and below 0 before it has stuck", () => {
    expect(stickyProgress(frame(0))).toBe(-0);
    expect(stickyProgress(frame(-600))).toBe(1);
    expect(stickyProgress(frame(-108))).toBeCloseTo(0.18, 12);
    expect(stickyProgress(frame(300))).toBeCloseTo(-0.5, 12);
    expect(stickyProgress(frame(-900))).toBeCloseTo(1.5, 12);
  });

  it("is how far the section has come up the screen when there is no range", () => {
    expect(stickyProgress({ railTop: 100, range: 0, sectionTop: 800, viewportHeight: 800 })).toBe(0);
    expect(stickyProgress({ railTop: 100, range: 0, sectionTop: 656, viewportHeight: 800 })).toBeCloseTo(0.18, 12);
    expect(stickyProgress({ railTop: 100, range: 0, sectionTop: 0, viewportHeight: 800 })).toBe(1);
  });

  it("says the stage is gone when none of it is on screen", () => {
    expect(stageGone(-736, -1, 800)).toBe(true);
    expect(stageGone(800, 1536, 800)).toBe(true);
    expect(stageGone(-736, 1, 800)).toBe(false);
    expect(stageGone(799, 1535, 800)).toBe(false);
  });
});
