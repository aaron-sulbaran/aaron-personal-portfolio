import { describe, expect, it } from "vitest";
import { anchorsFrom, emptyCheckpoints, lightAll, moveMark, readingDepth, syncLit } from "./checkpoints";

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

describe("the mark", () => {
  it("follows the reading line down and back up", () => {
    let state = emptyCheckpoints();
    let moved: boolean;
    ({ state, moved } = moveMark(state, 0.4));
    expect(state.mark).toBe(0.4);
    expect(moved).toBe(true);
    ({ state, moved } = moveMark(state, 0.1));
    expect(state.mark).toBe(0.1);
    expect(moved).toBe(true);
    ({ state, moved } = moveMark(state, 0.1));
    expect(moved).toBe(false);
  });

  it("stays within the track, and ignores a depth that is not a number", () => {
    const state = moveMark(emptyCheckpoints(), 0.4).state;
    expect(moveMark(state, 3).state.mark).toBe(1);
    expect(moveMark(state, -2).state.mark).toBe(0);
    expect(moveMark(state, Number.NaN).state.mark).toBe(0);
  });
});

describe("lighting checkpoints", () => {
  it("lights each checkpoint as the line reaches it, once", () => {
    let state = emptyCheckpoints();
    let lit: string[];
    ({ state, lit } = syncLit(state, anchors, 0.3));
    expect(lit).toEqual(["a", "b"]);
    ({ state, lit } = syncLit(state, anchors, 0.3));
    expect(lit).toEqual([]);
    ({ state, lit } = syncLit(state, anchors, 0.499));
    expect(lit).toEqual(["c"]);
  });

  it("un-lights the checkpoints below the line when the reader scrolls back up", () => {
    let { state } = syncLit(emptyCheckpoints(), anchors, 0.6);
    expect([...state.lit]).toEqual(["a", "b", "c"]);
    let unlit: string[];
    ({ state, unlit } = syncLit(state, anchors, 0.3));
    expect(unlit).toEqual(["c"]);
    expect([...state.lit]).toEqual(["a", "b"]);
    ({ state, unlit } = syncLit(state, anchors, 0));
    expect(unlit).toEqual(["b"]);
    expect([...state.lit]).toEqual(["a"]);
  });

  it("lights them again on the way back down", () => {
    let { state } = syncLit(emptyCheckpoints(), anchors, 0.6);
    ({ state } = syncLit(state, anchors, 0));
    const down = syncLit(state, anchors, 0.5);
    expect(down.lit).toEqual(["b", "c"]);
    expect(down.unlit).toEqual([]);
  });

  it("lights everything at once under reduced motion", () => {
    const state = lightAll(emptyCheckpoints(), anchors);
    expect(state.mark).toBe(1);
    expect([...state.lit]).toEqual(["a", "b", "c", "d"]);
  });
});

describe("a rail of years only", () => {
  const rail = anchorsFrom(
    [
      { key: "year-2026", y: 22 },
      { key: "year-2025", y: 500 },
      { key: "year-2021", y: 1200 },
    ],
    1400,
  );

  it("starts at 2026, which is the first to light and the last to go", () => {
    expect(rail[0].key).toBe("year-2026");
    expect(rail.every((anchor, i) => i === 0 || anchor.at > rail[0].at)).toBe(true);
    let { state } = syncLit(emptyCheckpoints(), rail, 0.05);
    expect([...state.lit]).toEqual(["year-2026"]);
    ({ state } = syncLit(state, rail, 0.9));
    expect([...state.lit]).toEqual(["year-2026", "year-2025", "year-2021"]);
    const back = syncLit(state, rail, 0.3);
    expect(back.unlit).toEqual(["year-2025", "year-2021"]);
    const top = syncLit(back.state, rail, 0);
    expect(top.unlit).toEqual(["year-2026"]);
  });

  it("lights every year when the reader is past the end of the track", () => {
    expect([...syncLit(emptyCheckpoints(), rail, 1).state.lit]).toEqual(["year-2026", "year-2025", "year-2021"]);
  });
});
