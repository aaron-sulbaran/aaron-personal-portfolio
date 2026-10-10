import { describe, expect, it } from "vitest";
import { AMPLITUDE, SPACING } from "./constants";
import { runColumns } from "./columns";
import { createMusic } from "./music";
import { buildPathDots, createSink, type DotFrame } from "./paint";
import { createPlucks } from "./pluck";

const cols = runColumns(1440, 100, SPACING);
const all = Int32Array.from({ length: cols.count }, (_, j) => j);
const frame = (over: Partial<DotFrame> = {}): DotFrame => ({ head: 1e9, tail: -Infinity, train: null, runLen: 0, gate: 0, breath: 0, shimmer: 0, music: createMusic(), plucks: createPlucks(), still: false, ...over });
const draw = (f: DotFrame, from = -Infinity, to = Infinity) => {
  const sink = createSink();
  buildPathDots(cols, all, 0, cols.count, f, AMPLITUDE, 0, from, to, null, sink);
  return sink;
};
const xs = (dots: number[]) => dots.filter((_, k) => k % 3 === 0);

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
