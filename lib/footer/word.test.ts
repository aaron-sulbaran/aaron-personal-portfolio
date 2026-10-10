import { describe, expect, it } from "vitest";
import { FOOTER } from "./constants";
import { REST_POSE, askEgg, createEggState, eggPhases, eggTotalMs } from "./egg";
import { footerGeometry, rippleReach, wordRest } from "./geometry";
import { createWordState, stepWord, type Pointer, type WordInput } from "./word";

const TEXT = "build.stuff";
const geo = footerGeometry(TEXT, 1440, 454, 180);
const rest = wordRest(TEXT, geo);
const PERIOD = 5;
const landing = { x: rest.xs[PERIOD] + rest.halfWidths[PERIOD], y: geo.baselineY };
const away: Pointer = { x: 0, y: 0, inside: false, pressed: false };

const input = (over: Partial<WordInput> = {}): WordInput => ({
  size: geo.size,
  centers: rest.centers,
  reduced: false,
  pointer: away,
  riseStart: 0,
  egg: null,
  ...over,
});

// Runs `ms` of frames at 60fps from `from`, returning the last result and the deepest squash seen per letter.
function run(state: ReturnType<typeof createWordState>, inp: WordInput, from: number, ms: number) {
  let last = stepWord(state, inp, from, 0);
  const deepest = state.frames.map(() => 1);
  for (let t = from + 1000 / 60; t <= from + ms; t += 1000 / 60) {
    last = stepWord(state, inp, t, 1 / 60);
    state.frames.forEach((f, i) => (deepest[i] = Math.min(deepest[i], f.squash)));
  }
  return { last, deepest };
}

describe("the wordmark's frame", () => {
  it("holds the word under its place until the footer is seen, asking for no frames", () => {
    const s = createWordState(11);
    const r = stepWord(s, input({ riseStart: null }), 0, 1 / 60);
    expect(s.frames.every((f) => f.rise === 0)).toBe(true);
    expect(r.busy).toBe(false);
  });

  it("rises as one over a second, then sleeps with every letter whole and at rest", () => {
    const s = createWordState(11);
    expect(stepWord(s, input(), 500, 1 / 60).busy).toBe(true);
    expect(s.frames.every((f) => f.rise === s.frames[0].rise && f.rise > 0.9 && f.rise < 1)).toBe(true);
    const { last } = run(s, input(), 500, 600);
    expect(last.busy).toBe(false);
    expect(last.pose).toBe(REST_POSE);
    expect(s.frames.every((f) => f.swell === 0 && f.squash === 1 && f.rise === 1)).toBe(true);
  });

  it("swells the letters near the pointer, then sleeps while it holds still", () => {
    const s = createWordState(11);
    const over: Pointer = { x: rest.centers[3].x, y: rest.centers[3].y, inside: true, pressed: false };
    const { last } = run(s, input({ pointer: over, riseStart: -2000 }), 0, 3000);
    expect(s.frames[3].swell).toBe(1);
    expect(s.frames[10].swell).toBe(0);
    expect(last.busy).toBe(false);
  });

  it("presses the letters near a held click and none far away", () => {
    const s = createWordState(11);
    const down: Pointer = { x: rest.centers[3].x, y: rest.centers[3].y, inside: true, pressed: true };
    run(s, input({ pointer: down, riseStart: -2000 }), 0, 2000);
    expect(s.frames[3].squash).toBeCloseTo(1 - FOOTER.press.depth, 3);
    expect(s.frames[10].squash).toBe(1);
  });

  it("runs the ripple through every letter but the period, which lands in its own squash", () => {
    const s = createWordState(11);
    const egg = createEggState();
    askEgg(egg);
    const inp = input({ riseStart: -2000, egg: { state: egg, index: PERIOD, landing, reach: rippleReach(geo, landing) } });
    const { last, deepest } = run(s, inp, 0, eggTotalMs(FOOTER.egg) + 2500);
    expect(deepest[PERIOD]).toBe(1);
    for (const i of [4, 6]) expect(deepest[i], `letter ${i}`).toBeLessThan(0.97);
    expect(last.busy).toBe(false);
    expect(last.pose).toBe(REST_POSE);
    expect(s.frames.every((f) => f.squash === 1)).toBe(true);
  });

  it("hops the period through its phases, lifting it at the apex", () => {
    const s = createWordState(11);
    const egg = createEggState();
    askEgg(egg);
    const inp = input({ riseStart: -2000, egg: { state: egg, index: PERIOD, landing, reach: 10 } });
    stepWord(s, inp, 0, 0);
    const { takeoff, landing: down } = eggPhases(FOOTER.egg);
    const apex = stepWord(s, inp, (takeoff + down) / 2, 1 / 60);
    expect(apex.pose.lift).toBeCloseTo(FOOTER.egg.hop, 6);
    expect(apex.busy).toBe(true);
  });

  it("holds everything at rest under reduced motion, the egg only turning", () => {
    const s = createWordState(11);
    const egg = createEggState();
    const down: Pointer = { x: rest.centers[3].x, y: rest.centers[3].y, inside: true, pressed: true };
    askEgg(egg);
    const inp = input({ reduced: true, riseStart: null, pointer: down, egg: { state: egg, index: PERIOD, landing, reach: 10 } });
    stepWord(s, inp, 0, 1 / 60);
    const mid = stepWord(s, inp, 160, 1 / 60);
    expect(s.frames.every((f) => f.swell === 0 && f.squash === 1 && f.rise === 1)).toBe(true);
    expect(mid.pose.lift).toBe(0);
    expect(mid.pose.angle).toBeCloseTo(45, 6);
    expect(egg.ripples).toHaveLength(0);
  });
});
