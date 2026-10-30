import { describe, expect, it } from "vitest";
import { COIL } from "./constants";
import { cameraFor, type Basis, type Vec3 } from "./geometry";
import { facing, frameSeparation, pairGap, screenGap, screenOutline, type SeparationPose } from "./separation";

const W = COIL.cardAspect;
const FLAT: Basis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const camera = cameraFor({ width: 1280, height: 800 });

function card(u: number, position: Vec3, basis: Basis = FLAT, bend = 0): SeparationPose {
  return { u, position, basis, scale: 1, bend, beta: 0, alpha: 1 };
}

describe("two cards' separation", () => {
  it("measures the gap between two flat cards side by side as a share of a card's width", () => {
    const { gap, intersect } = pairGap(card(0, [0, 0, 0]), card(1, [W * 1.1, 0, 0]));
    expect(intersect).toBe(false);
    expect(gap).toBeCloseTo(0.1, 3);
  });

  it("finds two cards that cut through each other", () => {
    // The second turned a quarter about the vertical and pushed half into the first.
    const turned: Basis = { x: [0, 0, -1], y: [0, 1, 0], z: [1, 0, 0] };
    const { gap, intersect } = pairGap(card(0, [0, 0, 0]), card(1, [W * 0.3, 0, 0], turned));
    expect(intersect).toBe(true);
    expect(gap).toBe(0);
  });

  it("finds a bent card's edge through its neighbor's face", () => {
    // Both bent onto a cylinder of radius 1 (their edges curl away from the camera); the second
    // turned about the vertical so its right half dips through the first's right edge.
    const tilt = 0.6;
    const tilted: Basis = { x: [Math.cos(tilt), 0, -Math.sin(tilt)], y: [0, 1, 0], z: [Math.sin(tilt), 0, Math.cos(tilt)] };
    expect(pairGap(card(0, [0, 0, 0], FLAT, 1), card(1, [0.2, 0, 0], tilted, 1)).intersect).toBe(true);
    expect(pairGap(card(0, [0, 0, 0], FLAT, 1), card(1, [W * 1.4, 0, 0.1], tilted, 1)).intersect).toBe(false);
  });

  it("reports two cards on one plane that overlap as no gap", () => {
    const { gap } = pairGap(card(0, [0, 0, 0]), card(1, [W * 0.5, 0, 0]));
    expect(gap).toBeLessThan(1e-9);
  });

  it("does not measure pairs far apart, and says how far they are at least", () => {
    expect(pairGap(card(0, [0, 0, 0]), card(1, [10, 0, 0])).gap).toBeGreaterThan(5);
  });
});

describe("on screen", () => {
  it("tells overlapping outlines from ones with a gap, in px", () => {
    const a = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const shift = (dx: number) => a.map((p) => ({ x: p.x + dx, y: p.y }));
    expect(screenGap(a, shift(5)).overlap).toBe(true);
    expect(screenGap(a, shift(14))).toEqual({ overlap: false, px: 4 });
    // One inside the other: no edges cross, still an overlap.
    expect(screenGap(a, [{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 }]).overlap).toBe(true);
  });

  it("reads how squarely a card faces the camera", () => {
    expect(facing(card(0, [0, 0, 0]), camera)).toBeCloseTo(1, 9);
    expect(facing(card(0, [0, 0, 0], { x: [0, 0, -1], y: [0, 1, 0], z: [1, 0, 0] }), camera)).toBeCloseTo(0, 9);
    expect(facing(card(0, [0, 0, 0], { x: [-1, 0, 0], y: [0, 1, 0], z: [0, 0, -1] }), camera)).toBeCloseTo(-1, 9);
  });

  it("projects a card's outline around its middle", () => {
    const outline = screenOutline(card(0, [0, 0, 0]), camera);
    const xs = outline.map((p) => p.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(640, 6);
  });
});

describe("a frame", () => {
  it("finds the least gap, the cards that cut through each other and the near neighbors that overlap", () => {
    const row = [0, 1, 2].map((u) => card(u, [u * W * 1.2, 0, 0]));
    const clear = frameSeparation(row, camera);
    expect(clear.minGap).toBeCloseTo(0.2, 3);
    expect(clear.intersections).toEqual([]);
    expect(clear.screenOverlaps).toEqual([]);
    expect(clear.shown).toBe(3);
    const pile = [0, 1, 2].map((u) => card(u, [u * W * 0.3, 0, u * 0.01]));
    const piled = frameSeparation(pile, camera);
    expect(piled.screenOverlaps.length).toBe(2);
    expect(piled.minGap).toBeLessThan(0.02);
  });

  it("leaves out the cards not shown", () => {
    const row = [card(0, [0, 0, 0]), { ...card(1, [W * 0.3, 0, 0]), alpha: 0 }];
    expect(frameSeparation(row, camera).shown).toBe(1);
  });
});
