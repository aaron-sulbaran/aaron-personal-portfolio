import { describe, expect, it } from "vitest";
import { anchorsFrom, emptyCheckpoints, lightAll, lightUpTo, raiseMark, readingDepth } from "./checkpoints";

const anchors = anchorsFrom(
  [
    { key: "a", y: 0 },
    { key: "b", y: 250 },
    { key: "c", y: 500 },
    { key: "d", y: 1200 },
  ],
  1000,
);

describe("anchorsFrom", () => {
  it("turns px from the top into shares of the track, clamped to its foot", () => {
    expect(anchors.map((anchor) => anchor.at)).toEqual([0, 0.25, 0.5, 1]);
    expect(anchorsFrom([{ key: "a", y: 40 }], 0)[0].at).toBe(0);
  });
});

describe("readingDepth", () => {
  const base = { trackHeight: 1000, viewportHeight: 800, line: 0.7, atEnd: false };
  it("is how far the reading line sits into the track", () => {
    expect(readingDepth({ ...base, trackTop: 560 })).toBe(0);
    expect(readingDepth({ ...base, trackTop: 60 })).toBe(0.5);
    expect(readingDepth({ ...base, trackTop: -2000 })).toBe(1);
    expect(readingDepth({ ...base, trackTop: 900 })).toBe(0);
  });
  it("counts the page's foot as the end of the track", () => {
    expect(readingDepth({ ...base, trackTop: 200, atEnd: true })).toBe(1);
  });
  it("is 0 for a track with no height", () => {
    expect(readingDepth({ ...base, trackTop: 0, trackHeight: 0 })).toBe(0);
  });
});

describe("the one-way mark", () => {
  it("only rises", () => {
    let state = emptyCheckpoints();
    ({ state } = raiseMark(state, 0.4));
    expect(state.mark).toBe(0.4);
    const back = raiseMark(state, 0.1);
    expect(back.moved).toBe(false);
    expect(back.state.mark).toBe(0.4);
    expect(raiseMark(state, Number.NaN).state.mark).toBe(0.4);
    expect(raiseMark(state, 3).state.mark).toBe(1);
  });
});

describe("lighting checkpoints", () => {
  it("lights each checkpoint once, as the line reaches it", () => {
    let state = emptyCheckpoints();
    let lit: string[];
    ({ state, lit } = lightUpTo(state, anchors, 0.3));
    expect(lit).toEqual(["a", "b"]);
    ({ state, lit } = lightUpTo(state, anchors, 0.3));
    expect(lit).toEqual([]);
    ({ state, lit } = lightUpTo(state, anchors, 0.499));
    expect(lit).toEqual(["c"]);
  });

  it("never un-lights when the line is asked about a shallower point", () => {
    let { state } = lightUpTo(emptyCheckpoints(), anchors, 0.6);
    ({ state } = lightUpTo(state, anchors, 0));
    expect([...state.lit]).toEqual(["a", "b", "c"]);
  });

  it("lights everything at once under reduced motion", () => {
    const state = lightAll(emptyCheckpoints(), anchors);
    expect(state.mark).toBe(1);
    expect([...state.lit]).toEqual(["a", "b", "c", "d"]);
  });
});
