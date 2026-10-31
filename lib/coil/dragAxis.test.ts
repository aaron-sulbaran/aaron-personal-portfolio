import { describe, expect, it } from "vitest";
import { DRAG_TRACK, moveDrag, pressDrag, releaseVelocity, type DragTrack } from "@/lib/coil/dragAxis";

// A press at (x, y) at t 0, then moves to each point a frame (16 ms) apart:
// the final track and the sideways steps the moves gave.
function drag(from: { x: number; y: number }, points: { x: number; y: number }[], frameMs = 16) {
  let track: DragTrack = pressDrag(from.x, from.y, 0);
  const steps: number[] = [];
  points.forEach((point, i) => {
    const next = moveDrag(track, point.x, point.y, (i + 1) * frameMs);
    track = next.track;
    steps.push(next.dx);
  });
  return { track, steps, endMs: points.length * frameMs };
}

const line = (from: { x: number; y: number }, to: { x: number; y: number }, n: number) =>
  Array.from({ length: n }, (_, i) => ({ x: from.x + ((to.x - from.x) * (i + 1)) / n, y: from.y + ((to.y - from.y) * (i + 1)) / n }));

describe("dragAxis", () => {
  it("moves nothing until the press has travelled the minimum, then locks to the larger travel", () => {
    const { track, steps } = drag({ x: 100, y: 100 }, [{ x: 98, y: 101 }, { x: 96, y: 101 }, { x: 90, y: 102 }]);
    expect(steps[0]).toBe(0);
    expect(track.axis).toBe("x");
    // The lock's own move gives its step from the last position, as later moves do.
    expect(steps[1]).toBe(-2);
    expect(steps[2]).toBe(-6);
  });

  it("a press that starts upright stays upright and gives no sideways step", () => {
    const { track, steps } = drag({ x: 100, y: 100 }, [{ x: 101, y: 92 }, { x: 140, y: 80 }, { x: 200, y: 70 }]);
    expect(track.axis).toBe("y");
    expect(steps.every((step) => step === 0)).toBe(true);
    expect(releaseVelocity(track, 64)).toBe(0);
  });

  it("the sideways steps add up to the travel after the lock", () => {
    const { steps } = drag({ x: 300, y: 400 }, line({ x: 300, y: 400 }, { x: 120, y: 404 }, 10));
    expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(-180, 6);
  });

  it("the release speed is the recent sideways travel over the time to the release", () => {
    // 180 px in 10 frames of 16 ms: about 1125 px/s; the window holds the last 100 ms.
    const { track, endMs } = drag({ x: 300, y: 400 }, line({ x: 300, y: 400 }, { x: 120, y: 400 }, 10));
    const v = releaseVelocity(track, endMs);
    expect(v).toBeLessThan(-1000);
    expect(v).toBeGreaterThan(-1200);
  });

  it("a finger that stopped before it let go throws less, and one held still throws nothing", () => {
    const { track, endMs } = drag({ x: 300, y: 400 }, line({ x: 300, y: 400 }, { x: 120, y: 400 }, 10));
    const atOnce = Math.abs(releaseVelocity(track, endMs));
    const after = Math.abs(releaseVelocity(track, endMs + 120));
    expect(after).toBeLessThan(atOnce * 0.6);
    expect(releaseVelocity(track, endMs + DRAG_TRACK.stillMs + 1)).toBe(0);
  });

  it("keeps only the recent moves", () => {
    const { track } = drag({ x: 0, y: 0 }, line({ x: 0, y: 0 }, { x: 600, y: 0 }, 60));
    expect(track.samples.length).toBeLessThanOrEqual(Math.ceil(DRAG_TRACK.windowMs / 16) + 1);
  });
});
