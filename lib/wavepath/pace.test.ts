import { describe, expect, it } from "vitest";
import { dotReach } from "./columns";
import { CROSS_S, DRAW_SPEED } from "./constants";
import { sampleSpine, type Point } from "./geometry";
import { calmSpeed, headCap, inkOnScreen, type InkFrame } from "./pace";
import { SIZES, crossingTimes, pageAt, steadyScroll, type Size } from "./pace.sim";

// The wave's pace (Aaron, 2026-10-31: "so fast", and "a bit less springy"). The head draws at a calm speed while any ink of its train
// is on the screen, and runs fast only unseen. The steady-scroll simulation (lib/wavepath/pace.sim) scrolls each measured page at a
// steady speed and steps the head as the conductor does; `PACE_REPORT=1 pnpm test lib/wavepath/pace.test.ts` prints the crossing times
// per size and speed, for tuning the numbers in lib/wavepath/constants by hand.
const SPEEDS = [300, 800];
const narrow = (size: Size) => Number(size.split("x")[0]) < 600;

describe("the calm speed", () => {
  it("draws the screen's width in CROSS_S seconds, a phone's slower in seconds", () => {
    expect(calmSpeed("wide", 1280) * CROSS_S.wide).toBeCloseTo(1280, 9);
    expect(calmSpeed("phone", 390) * CROSS_S.phone).toBeCloseTo(390, 9);
  });
  it("sits in the band A64 leaves: a full width in 0.4 to 1.0 seconds, faster than the 1.0 to 1.6 of 2026-11-02 but never a wipe", () => {
    for (const s of [CROSS_S.wide, CROSS_S.phone]) {
      expect(s).toBeGreaterThanOrEqual(0.4);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe("where the train shows", () => {
  // A line across a 1000 px wide page at y 500 from x -400 to 1400, down the far side to y 900 and back along it: as dense points, so
  // the curve through them stays level. The viewport is 400 to 1200.
  const dense = (from: Point, to: Point): Point[] => Array.from({ length: 19 }, (_, k) => ({ x: from.x + ((to.x - from.x) * k) / 18, y: from.y + ((to.y - from.y) * k) / 18 }));
  const line = sampleSpine([...dense({ x: -400, y: 500 }, { x: 1400, y: 500 }), ...dense({ x: 1400, y: 500 }, { x: 1400, y: 900 }).slice(1), ...dense({ x: 1400, y: 900 }, { x: -400, y: 900 }).slice(1)], 4);
  const at = (head: number, tail: number, extra: Partial<InkFrame> = {}): InkFrame => ({
    samples: line, head, tail, train: 400, width: 1000, viewTop: 400, viewHeight: 800, amplitude: 80, cards: { top: 5000, bottom: 5100 }, dt: 0, ...extra,
  });
  it("sees a train with ink inside the width and the viewport, and none once it is wholly out", () => {
    expect(inkOnScreen(at(800, 400))).toBe(true);
    expect(inkOnScreen(at(350, -50))).toBe(true);
    expect(inkOnScreen(at(2000, 1650)), "past the right edge, round the turn").toBe(false);
    expect(inkOnScreen(at(800, 400, { viewTop: 2000 })), "the viewport is far below it").toBe(false);
  });
  it("keeps the whole line behind the head when the train is null", () => {
    expect(inkOnScreen(at(900, -Infinity, { train: null }))).toBe(true);
    expect(inkOnScreen(at(2600, -Infinity, { train: null }))).toBe(true);
  });
  it("does not count ink behind the cards section's field", () => {
    expect(inkOnScreen(at(800, 400, { cards: { top: 450, bottom: 560 } }))).toBe(false);
  });
  it("looks a frame's travel at the fastest ahead, so the head is calm before its first dot shows", () => {
    // The line starts 400 px before x 0; the head is 40 px of arc short of the first ink (x -reach).
    const head = 400 - dotReach(80) - 40;
    expect(inkOnScreen(at(head, head - 400))).toBe(false);
    expect(inkOnScreen(at(head, head - 400, { dt: 1 / 60 }))).toBe(true);
  });
  it("runs calm with ink in view, at the draw speed without", () => {
    expect(headCap(500, at(800, 400))).toBe(500);
    expect(headCap(500, at(2000, 1650))).toBe(DRAW_SPEED);
    expect(headCap(9000, at(800, 400)), "never past the draw speed").toBe(DRAW_SPEED);
  });
});

describe("a steady scroll", () => {
  for (const size of SIZES) {
    const page = pageAt(size);
    const calm = calmSpeed(page.laid.route.kind, page.width);
    for (const speed of SPEEDS) {
      const frames = steadyScroll(page, { speed });
      const times = crossingTimes(page, frames);

      it(`takes about CROSS_S (${narrow(size) ? CROSS_S.phone : CROSS_S.wide} s) or more to draw each crossing it is watched at, at ${size}, ${speed} px/s`, () => {
        for (const c of times) if (c.seconds !== null) expect(c.seconds, `crossing ${c.index}`).toBeGreaterThanOrEqual(0.95 * (narrow(size) ? CROSS_S.phone : CROSS_S.wide));
        if (speed === 300) expect(times.filter((c) => c.seconds !== null).length, "crossings watched at a slow scroll").toBeGreaterThanOrEqual(2);
      });

      it(`never draws faster than the calm speed while the head is on the screen at ${size}, ${speed} px/s`, () => {
        for (const f of frames) if (f.onScreen) expect(f.vel, `head speed at ${f.t.toFixed(2)}s`).toBeLessThanOrEqual(calm + 1e-6);
      });

      it(`ends on the line's end, the head at rest, at ${size}, ${speed} px/s`, () => {
        const last = frames[frames.length - 1];
        expect(last.head).toBe(last.target);
        expect(page.laid.samples.length - last.head).toBeLessThanOrEqual(1);
      });
    }
  }
});

// A64: after a quick scroll to the bottom the wave drew on for 12.8 s on a 390 by 844 phone (the browser's own clock). A faster pace
// brought it to 6.7 s there and 4.2 s at 1440 by 900; this simulation reads about half a second under the browser, 6.2 s and 3.6 s. The
// calm pace through the stretches in view and the line's own length keep a floor under it, so these bounds guard the gain rather than
// a goal.
describe("a quick scroll to the bottom", () => {
  const trailing = (size: Size) => {
    const page = pageAt(size);
    const frames = steadyScroll(page, { speed: 6000 });
    const landed = frames.findIndex((f) => f.scroll >= page.maxScroll);
    return frames[frames.length - 1].t - frames[landed].t;
  };
  it("stops drawing within 7 s on a 390 by 844 phone", () => expect(trailing("390x844")).toBeLessThan(7));
  it("stops drawing within 4.2 s at 1440 by 900", () => expect(trailing("1440x900")).toBeLessThan(4.2));
});

describe("the reader stops", () => {
  // Stopped part way down the page, the head still has line to draw. It settles at the calm speed or less: it never passes its
  // target, and nothing in view speeds up to catch up.
  for (const size of ["390x844", "1280x800"] as Size[]) {
    const page = pageAt(size);
    const calm = calmSpeed(page.laid.route.kind, page.width);
    for (const speed of SPEEDS) {
      for (const stopAt of [600, 1000, 1500, 2000]) {
        it(`neither overshoots nor surges after a stop at ${stopAt} px, from ${speed} px/s at ${size}`, () => {
          const frames = steadyScroll(page, { speed, stopAt });
          const stopped = frames.findIndex((f) => f.scroll >= stopAt);
          const after = frames.slice(stopped);
          for (const f of after) {
            expect(f.head, `head against its target at ${f.t.toFixed(2)}s`).toBeLessThanOrEqual(f.target + 1e-6);
            if (f.onScreen) expect(f.vel).toBeLessThanOrEqual(calm + 1e-6);
          }
          // Within a stretch in view the head only slows: no surge to catch up with a reader who has stopped. The head may still be
          // finishing its ease in toward the calm speed (a frame's step is a few px/s, in proportion to the calm speed); a jump
          // to the draw speed would be tens of times that.
          let before = Infinity;
          for (const f of after) {
            if (f.onScreen) expect(f.vel, `head speed at ${f.t.toFixed(2)}s`).toBeLessThanOrEqual(before + 1 + 0.005 * calm);
            before = f.onScreen ? f.vel : Infinity;
          }
          const last = after[after.length - 1];
          expect(last.head).toBe(last.target);
        });
      }
    }
  }
});

// Opt in: the crossing time per size and speed, in seconds, to tune the numbers by.
describe.runIf(process.env.PACE_REPORT === "1")("the pace report", () => {
  it("prints the crossing times", () => {
    const rows: string[] = ["size       scroll     crossings (seconds, * the seam, - unwatched; share of the line watched)"];
    for (const size of SIZES) {
      const page = pageAt(size);
      for (const speed of SPEEDS) {
        const cells = crossingTimes(page, steadyScroll(page, { speed })).map((c) => `${c.seconds === null ? "-" : c.seconds.toFixed(2)}${c.seam ? "*" : ""} (${c.seen.toFixed(2)})`);
        rows.push(`${size.padEnd(10)} ${String(speed).padStart(4)} px/s  ${cells.join("  ")}`);
      }
    }
    process.stdout.write(`${rows.join("\n")}\n`);
  });
});
