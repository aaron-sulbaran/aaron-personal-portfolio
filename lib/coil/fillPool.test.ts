import { describe, expect, it } from "vitest";
import { FILL_POOL, distanceToViewport, planPool, type PoolEntry } from "./fillPool";

const VH = 800;
const entry = (id: string, distance: number, alive = false, eligible = true): PoolEntry => ({ id, distance, alive, eligible });

describe("which titles hold a context", () => {
  it("never more than two, on top of the Coil's", () => {
    expect(FILL_POOL.cap).toBe(2);
    const plan = planPool([entry("name", 0), entry("work", 100), entry("numbers", 200), entry("connect", 300)], VH);
    expect(plan.acquire).toEqual(["name", "work"]);
    expect(plan.release).toEqual([]);
  });

  it("creates nothing for a title more than a viewport away", () => {
    expect(planPool([entry("numbers", VH + 1)], VH).acquire).toEqual([]);
    expect(planPool([entry("numbers", VH)], VH).acquire).toEqual(["numbers"]);
  });

  it("keeps one it has until it is far, then lets it go", () => {
    expect(planPool([entry("name", 1.5 * VH, true)], VH).release).toEqual([]);
    expect(planPool([entry("name", 2 * VH + 1, true)], VH).release).toEqual(["name"]);
  });

  it("gives a nearer title the slot of a farther one", () => {
    const plan = planPool([entry("name", 1.2 * VH, true), entry("work", 0, true), entry("numbers", 300)], VH);
    expect(plan.acquire).toEqual(["numbers"]);
    expect(plan.release).toEqual(["name"]);
  });

  it("lets a title go the moment it may not draw (page 2's during the deal), and never starts one that may not", () => {
    expect(planPool([entry("work", 0, true, false)], VH).release).toEqual(["work"]);
    expect(planPool([entry("work", 0, false, false)], VH).acquire).toEqual([]);
  });

  it("on a tie, the one already alive stays", () => {
    const plan = planPool([entry("a", 0, true), entry("b", 0, true), entry("c", 0)], VH);
    expect(plan).toEqual({ acquire: [], release: [] });
  });
});

describe("a title's distance to the viewport", () => {
  it("is 0 while any of it is on screen, else the gap", () => {
    expect(distanceToViewport({ top: -20, bottom: 10 }, VH)).toBe(0);
    expect(distanceToViewport({ top: 790, bottom: 900 }, VH)).toBe(0);
    expect(distanceToViewport({ top: 1000, bottom: 1100 }, VH)).toBe(200);
    expect(distanceToViewport({ top: -300, bottom: -100 }, VH)).toBe(100);
  });
});
