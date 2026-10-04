import { describe, expect, it } from "vitest";
import { SWEEP, createSweep, junction, stepSweep, swell, trainX } from "./sweep";

const layout = { startX: 6.5, spacing: 13 };

describe("sweep", () => {
  it("eases toward the target with lambda 8 and a 1.5 per second cap", () => {
    const s = createSweep();
    s.target = 1;
    expect(stepSweep(s, 1 / 60)).toBe(true);
    expect(s.value).toBeCloseTo(Math.min(1 - Math.exp(-8 / 60), 1.5 / 60), 6);
    for (let k = 0; k < 300; k++) stepSweep(s, 1 / 60);
    expect(s.value).toBeCloseTo(1, 3);
    expect(stepSweep(s, 1 / 60)).toBe(false);
  });

  it("a full jump is 95 percent done in about 0.7s under the cap", () => {
    const s = createSweep();
    s.target = 1;
    let t = 0;
    while (s.value < 0.95) { stepSweep(s, 1 / 120); t += 1 / 120; }
    expect(t).toBeGreaterThan(0.6);
    expect(t).toBeLessThan(0.85);
  });

  it("the band's tail and the horizon's head meet at the same x for any width and sweep", () => {
    for (const width of [390, 1024, 1440, 2560]) {
      const columns = Math.floor(width / 13);
      for (const sweep of [0, 0.2, 0.5, 0.83, 1]) {
        const tail = trainX(columns, layout, width, sweep, "band");
        const head = trainX(0, layout, width, sweep, "horizon");
        expect(tail).toBeCloseTo(head, 6);
        expect(Number.isFinite(trainX(columns - 1, layout, width, sweep, "band"))).toBe(true);
      }
    }
  });

  it("the junction curls the band's last ten columns down and the horizon's first ten up, thinning to the tip", () => {
    const band = junction(109, 110, 0.5, "band", 60);
    expect(band.dy).toBeCloseTo(60 * (0.9 ** 2 * (3 - 1.8)), 6);
    expect(band.scale).toBeLessThan(0.4);
    expect(junction(50, 110, 0.5, "band", 60)).toEqual({ dy: 0, scale: 1 });
    const head = junction(0, 110, 0.5, "horizon", 60);
    expect(head.dy).toBeCloseTo(-60, 6);
    expect(head.scale).toBeCloseTo(0.3, 6);
    expect(junction(10, 110, 0.5, "horizon", 60)).toEqual({ dy: 0, scale: 1 });
  });

  it("at rest the junction is an identity, so the band at 0 and the horizon at 1 paint flat", () => {
    for (let i = 100; i < 110; i++) expect(junction(i, 110, 0, "band", 60)).toEqual({ dy: 0, scale: 1 });
    for (let i = 0; i < 10; i++) expect(junction(i, 110, 1, "horizon", 60)).toEqual({ dy: 0, scale: 1 });
  });

  it("the swell peaks mid sweep and is 1 at rest", () => {
    expect(swell(0)).toBeCloseTo(1, 9);
    expect(swell(0.5)).toBeCloseTo(1 + SWEEP.swell, 9);
    expect(swell(1)).toBeCloseTo(1, 9);
  });
});
