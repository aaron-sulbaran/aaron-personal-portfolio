import { describe, expect, it } from "vitest";
import { RIPPLE } from "./constants";
import { createRipple, rippleAt, rippleSwell, startRipple, stepRipple } from "./ripple";

const run = (r: ReturnType<typeof createRipple>, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) stepRipple(r, 1 / 60);
};

describe("the answer's ripple", () => {
  it("is nothing until started", () => {
    const r = createRipple();
    expect(rippleAt(r, 0)).toBe(0);
    expect(rippleSwell(r, 0)).toBe(0);
    expect(stepRipple(r, 0.1)).toBe(false);
  });
  it("the crest travels both ways at its speed", () => {
    const r = createRipple();
    startRipple(r, 1000);
    expect(rippleAt(r, 1000)).toBeCloseTo(RIPPLE.amp, 9);
    stepRipple(r, 0.25);
    const front = RIPPLE.speed * 0.25;
    const height = RIPPLE.amp * Math.exp(-RIPPLE.decay * 0.25);
    expect(rippleAt(r, 1000 + front)).toBeCloseTo(height, 9);
    expect(rippleAt(r, 1000 - front)).toBeCloseTo(height, 9);
    expect(rippleAt(r, 1000), "the origin has let go").toBeLessThan(height * 0.01);
  });
  it("is one Gaussian crest: no trough behind it", () => {
    const r = createRipple();
    startRipple(r, 0);
    stepRipple(r, 0.3);
    for (let s = -1500; s <= 1500; s += 7) expect(rippleAt(r, s)).toBeGreaterThanOrEqual(0);
  });
  it("its height decays at the footer egg's rate", () => {
    const r = createRipple();
    startRipple(r, 500);
    stepRipple(r, 0.5);
    const atHalf = rippleAt(r, 500 + RIPPLE.speed * 0.5);
    stepRipple(r, 1);
    const atOneAndHalf = rippleAt(r, 500 + RIPPLE.speed * 1.5);
    expect(atOneAndHalf / atHalf).toBeCloseTo(Math.exp(-RIPPLE.decay), 9);
  });
  it("the swell follows the same crest, at RIPPLE.swell for its full height", () => {
    const r = createRipple();
    startRipple(r, 0);
    expect(rippleSwell(r, 0)).toBeCloseTo(RIPPLE.swell, 9);
    stepRipple(r, 0.4);
    expect(rippleSwell(r, RIPPLE.speed * 0.4) / RIPPLE.swell).toBeCloseTo(rippleAt(r, RIPPLE.speed * 0.4) / RIPPLE.amp, 9);
    expect(rippleSwell(r, 1e6)).toBe(0);
  });
  it("ends within its life", () => {
    const r = createRipple();
    startRipple(r, 0);
    run(r, RIPPLE.lifeS + 0.05);
    expect(r.live).toBe(false);
    expect(rippleAt(r, 0)).toBe(0);
  });
  it("ends once it is too small to see, even before the cap", () => {
    const r = createRipple();
    startRipple(r, 0);
    let t = 0;
    while (stepRipple(r, 1 / 60)) t += 1 / 60;
    expect(t).toBeLessThanOrEqual(RIPPLE.lifeS + 1 / 60);
    expect(RIPPLE.amp * Math.exp(-RIPPLE.decay * r.age) < 0.005 || r.age >= RIPPLE.lifeS).toBe(true);
  });
  it("a new press restarts it: s0 moves and the age resets", () => {
    const r = createRipple();
    startRipple(r, 100);
    run(r, 1);
    startRipple(r, 900);
    expect(r.s0).toBe(900);
    expect(r.age).toBe(0);
    expect(r.live).toBe(true);
    expect(rippleAt(r, 900)).toBeCloseTo(RIPPLE.amp, 9);
  });
});
