import { describe, expect, it } from "vitest";
import { DUCK, duckTargets, stepDuck } from "./duck";

describe("duck", () => {
  const xs = [10, 20, 30, 40];
  it("a rect over the strip ducks the columns it spans", () => {
    const out = new Float32Array(4);
    duckTargets([{ left: 15, right: 35, top: 1000, bottom: 1100 }], xs, { top: 1050, bottom: 1226 }, out);
    expect([...out]).toEqual([0, 1, 1, 0]);
  });
  it("a rect within the look-ahead below the strip ducks early", () => {
    const out = new Float32Array(4);
    duckTargets([{ left: 0, right: 50, top: 1226 + DUCK.lookAheadPx - 1, bottom: 1500 }], xs, { top: 1050, bottom: 1226 }, out);
    expect([...out]).toEqual([1, 1, 1, 1]);
    duckTargets([{ left: 0, right: 50, top: 1226 + DUCK.lookAheadPx + 1, bottom: 1500 }], xs, { top: 1050, bottom: 1226 }, out);
    expect([...out]).toEqual([0, 0, 0, 0]);
  });
  it("a rect wholly above the strip does not duck, and the scan goes on to the next", () => {
    const out = new Float32Array(4);
    duckTargets(
      [
        { left: 0, right: 50, top: 800, bottom: 1050 },
        { left: 25, right: 50, top: 1100, bottom: 1200 },
      ],
      xs,
      { top: 1050, bottom: 1226 },
      out,
    );
    expect([...out]).toEqual([0, 0, 1, 1]);
  });
  // The envelope is a Float32Array, so the step is pinned to the exact float32 value.
  it("one step pins the attack and release rates", () => {
    const env = new Float32Array([0]);
    expect(stepDuck(env, new Float32Array([1]), 1 / 120)).toBe(true);
    expect(env[0]).toBe(Math.fround(1 - 0.6 ** (45 / 120)));
    env[0] = 1;
    expect(stepDuck(env, new Float32Array([0]), 1 / 120)).toBe(true);
    expect(env[0]).toBe(Math.fround(0.94 ** (45 / 120)));
  });
  it("attack reaches 0.8 within 100ms and release falls to 1/e in about 350ms", () => {
    const env = new Float32Array([0]);
    let t = 0;
    while (env[0] < 0.8) { stepDuck(env, new Float32Array([1]), 1 / 120); t += 1 / 120; }
    expect(t).toBeLessThan(0.1);
    env[0] = 1;
    t = 0;
    while (env[0] > 0.37) { stepDuck(env, new Float32Array([0]), 1 / 120); t += 1 / 120; }
    expect(t).toBeGreaterThan(0.25);
    expect(t).toBeLessThan(0.6);
    expect(stepDuck(env, new Float32Array([0]), 5)).toBe(false);
  });
});
