import { describe, expect, it } from "vitest";
import { AMPLITUDE, SPACING } from "./constants";
import { runColumns } from "./columns";
import { createMusic } from "./music";
import { buildPathDots, createSink, type DotFrame } from "./paint";
import { createPlucks } from "./pluck";
import { createRipple, startRipple, stepRipple, type RippleState } from "./ripple";

const cols = runColumns(1440, 100, SPACING);
const all = Int32Array.from({ length: cols.count }, (_, j) => j);
const frame = (over: Partial<DotFrame> = {}): DotFrame => ({ head: 1e9, tail: -Infinity, train: null, runLen: 0, gate: 0, breath: 0, shimmer: 0, music: createMusic(), plucks: createPlucks(), ripple: createRipple(), still: false, ...over });
const draw = (f: DotFrame, from = -Infinity, to = Infinity) => {
  const sink = createSink();
  buildPathDots(cols, all, 0, cols.count, f, AMPLITUDE, 0, from, to, null, sink);
  return sink;
};
const xs = (dots: number[]) => dots.filter((_, k) => k % 3 === 0);
const ys = (dots: number[]) => dots.filter((_, k) => k % 3 === 1);

describe("dots along the curve", () => {
  it("draws nothing past the head or before the tail", () => {
    const seen = (({ muted, accent }) => [...xs(muted), ...xs(accent)])(draw(frame({ head: 500, tail: 200 })));
    expect(Math.min(...seen)).toBeGreaterThan(200 - 24 - 40);
    expect(Math.max(...seen)).toBeLessThan(500 - 24 + 40);
  });
  it("inside words: no accent dot", () => {
    const music = createMusic();
    music.share = 1;
    music.bins.fill(0.72);
    const sink = createSink();
    buildPathDots({ ...cols, inWords: new Uint8Array(cols.count).fill(1) }, all, 0, cols.count, frame({ music }), AMPLITUDE, 0, -Infinity, Infinity, null, sink);
    expect(sink.accent).toEqual([]);
  });
  it("Not now is the still shape: at share 0 the analyser changes nothing", () => {
    const loud = createMusic();
    loud.bins.fill(0.72);
    expect(draw(frame({ music: loud })).muted).toEqual(draw(frame()).muted);
  });
  it("Play it: at share 1 loud bins thicken the run", () => {
    const loud = createMusic();
    loud.share = 1;
    loud.bins.fill(0.72);
    const sink = draw(frame({ music: loud }));
    expect(sink.muted.length + sink.accent.length).toBeGreaterThan(draw(frame()).muted.length * 1.5);
  });
  it("splits one line at the run's end: the band and the path never both draw a column", () => {
    expect(Math.max(...xs(draw(frame(), -Infinity, 700).muted))).toBeLessThan(Math.min(...xs(draw(frame(), 700, Infinity).muted)) + 1);
  });
  it("the line's breath reaches past the run: far columns move with breath 1, and rest at breath 0", () => {
    const farFrom = 100 + 500;
    const resting = draw(frame({ runLen: 100, breath: 0 }), farFrom);
    const breathing = draw(frame({ runLen: 100, breath: 1 }), farFrom);
    expect(breathing.muted).not.toEqual(resting.muted);
    expect(draw(frame({ runLen: 100, breath: 0 }), farFrom).muted).toEqual(draw(frame({ runLen: 0, breath: 0 }), farFrom).muted);
  });
});

describe("the answer's ripple", () => {
  const crest = (at: number, age: number): RippleState => {
    const r = createRipple();
    startRipple(r, at);
    stepRipple(r, age);
    return r;
  };
  // Dot y per x, so one column's displacement can be read against the resting shape.
  const ys = (dots: number[]) => {
    const byX = new Map<number, number>();
    for (let k = 0; k < dots.length; k += 3) if (!byX.has(dots[k])) byX.set(dots[k], dots[k + 1]);
    return byX;
  };
  it("displaces columns near its crest and leaves far columns as the resting shape", () => {
    const rest = ys(draw(frame()).muted);
    const rippled = ys(draw(frame({ ripple: crest(600, 0.3) })).muted);
    const crestS = 600 + 650 * 0.3;
    const near = cols.x.findIndex((_, j) => Math.abs(cols.s[j] - crestS) < SPACING);
    let moved = 0, farMoved = 0;
    for (const [x, y] of rippled) {
      const base = rest.get(x);
      if (base === undefined) continue;
      if (Math.abs(x - cols.x[near]) < 20 && Math.abs(y - base) > 1) moved++;
      if (Math.abs(x - (cols.x[0] + 1400)) < 1 && y !== base) farMoved++;
    }
    expect(moved, "columns at the crest that moved").toBeGreaterThan(0);
    expect(farMoved, "columns far from the crest that moved").toBe(0);
  });
  it("swells the dots at its crest", () => {
    const count = (f: DotFrame) => { const d = draw(f); return d.muted.length + d.accent.length; };
    expect(count(frame({ ripple: crest(600, 0.3) }))).toBeGreaterThan(count(frame()));
  });
  it("with a fit of 0 a live ripple leaves every column as the resting frame", () => {
    const sink = createSink();
    buildPathDots(cols, all, 0, cols.count, frame({ ripple: crest(600, 0.3) }), AMPLITUDE, 0, -Infinity, Infinity, null, sink, new Float32Array(cols.count));
    expect(sink.muted).toEqual(draw(frame()).muted);
    expect(sink.accent).toEqual(draw(frame()).accent);
  });
  it("on the path, words take the displacement but not the swell", () => {
    const words = { ...cols, inWords: new Uint8Array(cols.count).fill(1) };
    const sinkOf = (f: DotFrame) => { const sink = createSink(); buildPathDots(words, all, 0, cols.count, f, AMPLITUDE, 0, -Infinity, Infinity, null, sink); return sink; };
    const rippled = sinkOf(frame({ ripple: crest(600, 0.3) }));
    const rest = sinkOf(frame());
    expect(rippled.muted.length, "no extra dots in words").toBe(rest.muted.length);
    expect(rippled.muted).not.toEqual(rest.muted);
  });
  it("still frames ignore it", () => {
    expect(draw(frame({ still: true, ripple: crest(600, 0.3) })).muted).toEqual(draw(frame({ still: true })).muted);
  });
});

describe("the idle ripple", () => {
  it("adds nothing without a gain, as in production", () => {
    expect(draw(frame({ idleGain: 0, idleClock: 3 })).muted).toEqual(draw(frame()).muted);
  });

  it("reshapes the line when it has a gain, and moves as its clock runs", () => {
    const rest = draw(frame()).muted;
    const a = draw(frame({ idleGain: 1, idleClock: 0 })).muted;
    const b = draw(frame({ idleGain: 1, idleClock: 1.5 })).muted;
    expect(a).not.toEqual(rest);
    expect(b).not.toEqual(a);
  });

  it("is stronger with more gain", () => {
    const spread = (gain: number) => {
      const dots = draw(frame({ idleGain: gain, idleClock: 0.7 })).muted;
      const rest = draw(frame()).muted;
      let sum = 0;
      for (let k = 1; k < Math.min(dots.length, rest.length); k += 3) sum += Math.abs(dots[k] - rest[k]);
      return sum;
    };
    expect(spread(2)).toBeGreaterThan(spread(1));
  });

  it("never reaches a line held still (reduced motion)", () => {
    expect(draw(frame({ still: true, idleGain: 1, idleClock: 2 })).muted).toEqual(draw(frame({ still: true })).muted);
  });
});

describe("the band's keep-out on the path", () => {
  const near = (keep: { edge: number; fade: number } | null) => {
    const sink = createSink();
    buildPathDots(cols, all, 0, cols.count, frame(), AMPLITUDE, 0, -Infinity, Infinity, null, sink, null, keep);
    return sink;
  };

  it("draws exactly as before with no keep-out", () => {
    expect(near(null).muted).toEqual(draw(frame()).muted);
  });

  it("draws no dot at or above the edge", () => {
    const sink = near({ edge: 100, fade: 56 });
    expect(Math.min(...ys(sink.muted), ...ys(sink.accent))).toBeGreaterThan(100);
  });

  it("thins the dots over the fade, down to none at the edge and all of them beyond it", () => {
    const edge = 60;
    const full = draw(frame()).muted;
    const keep = near({ edge, fade: 56 }).muted;
    const band = (dots: number[], lo: number, hi: number) => ys(dots).filter((y) => y > lo && y <= hi).length;
    expect(band(keep, edge, edge + 56)).toBeLessThan(band(full, edge, edge + 56));
    expect(band(keep, edge, edge + 56)).toBeGreaterThan(0);
    expect(band(keep, edge + 56, Infinity)).toBe(band(full, edge + 56, Infinity));
  });
});
