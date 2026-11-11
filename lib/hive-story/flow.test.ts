import { describe, expect, it } from "vitest";
import { hexHalfWidth, type Point } from "./dots";
import {
  CLOCK,
  FADE_OUT,
  GLOWS,
  GROUPS,
  LAYOUTS,
  LOOP_SECONDS,
  NEXT_NODES,
  NEXT_PATHS,
  beesFor,
  clockAt,
  envelope,
  staticDots,
  type Box,
  type FlowLayout,
  type NodeKey,
  type PathKey,
} from "./flow";
import { GLYPHS, GLYPH_BOX, GLYPH_DOT, SCENARIOS, SCENARIO_BOX } from "./glyphs";

const layouts = Object.values(LAYOUTS);
const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
const onBoxEdge = (p: Point, b: Box) =>
  ((near(p.x, b.x) || near(p.x, b.x + b.w)) && p.y >= b.y && p.y <= b.y + b.h) ||
  ((near(p.y, b.y) || near(p.y, b.y + b.h)) && p.x >= b.x && p.x <= b.x + b.w);
const onHiveEdge = (p: Point, l: FlowLayout) => near(Math.abs(p.x - l.hive.cx), hexHalfWidth(l.hive.R, p.y - l.hive.cy)) || near(Math.abs(p.y - l.hive.cy), l.hive.R);
const inside = (p: Point, b: Box, inset = 0) => p.x > b.x + inset && p.x < b.x + b.w - inset && p.y > b.y + inset && p.y < b.y + b.h - inset;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each(layouts)("the $name layout", (l) => {
  const boxes = Object.entries(l.nodes) as [NodeKey, Box][];

  it("keeps every part, the Hive and the question inside the drawing", () => {
    for (const [, b] of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(l.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.h).toBeLessThanOrEqual(l.height);
    }
    expect(l.hive.cy - l.hive.R).toBeGreaterThan(0);
    expect(l.hive.cy + l.hive.R).toBeLessThan(l.height);
    for (const p of staticDots(l).question) expect(p.y).toBeLessThan(l.height);
  });

  it("never stacks one part on another", () => {
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i][1], boxes[j][1]), `${boxes[i][0]} and ${boxes[j][0]}`).toBe(false);
  });

  it("starts and ends every trace on a part, the Hive, or the question", () => {
    for (const [key, pts] of Object.entries(l.paths) as [PathKey, Point[]][]) {
      for (const end of [pts[0], pts[pts.length - 1]]) {
        const onPart = boxes.some(([, b]) => onBoxEdge(end, b));
        const atQuestion = key === "cq" && end === pts[pts.length - 1];
        expect(onPart || onHiveEdge(end, l) || atQuestion, `${key} at ${end.x},${end.y}`).toBe(true);
      }
    }
  });

  it("runs no trace dot through a part", () => {
    for (const t of staticDots(l).traces) for (const [key, b] of boxes) expect(inside(t.p, b, 2), `${key} at ${t.p.x},${t.p.y}`).toBe(false);
  });

  it("fills the Hive with a full comb", () => {
    expect(staticDots(l).comb.length).toBeGreaterThan(l.name === "wide" ? 200 : 120);
  });

  it("gives every bee bound for the Hive or the question a seat there, the same on server and client", () => {
    const dots = staticDots(l);
    const bees = beesFor(l, dots);
    expect(beesFor(l, staticDots(l))).toEqual(bees);
    for (const b of bees.filter((bee) => bee.ending === "hive")) expect(dots.comb).toContainEqual(b.slot);
    for (const b of bees.filter((bee) => bee.ending === "question")) expect(dots.question).toContainEqual(b.slot);
  });
});

describe("what runs now and what is next", () => {
  it("draws the archive, the fact check and the sources in solid dots, and the planned parts in open ones", () => {
    expect([...NEXT_NODES].sort()).toEqual(["ai", "bee", "notes", "page"]);
    expect([...NEXT_PATHS].sort()).toEqual(["h2b", "h2i", "h2p", "n2h"]);
  });
});

describe("the timeline", () => {
  it("lands every bee before the loop fades", () => {
    for (const g of GROUPS) expect(g.start + (g.count - 1) * g.stagger + g.duration).toBeLessThan(FADE_OUT[0]);
    for (const [, at] of GLOWS) expect(at + 1.1).toBeLessThan(FADE_OUT[0]);
    expect(FADE_OUT[1]).toBeLessThanOrEqual(LOOP_SECONDS);
  });

  it("keeps the real schedule: :17 past each hour, then 2:30 at night, then minutes", () => {
    expect(CLOCK.map((c) => c.at)).toEqual([...CLOCK.map((c) => c.at)].sort((a, b) => a - b));
    expect(CLOCK.filter((c) => c.caption === 0).every((c) => c.time.endsWith(":17"))).toBe(true);
    expect(CLOCK.find((c) => c.caption === 1)?.time).toBe("02:30");
    expect(clockAt(0).time).toBe("13:17");
    expect(clockAt(9.6).time).toBe("21:05");
  });

  it("rises, holds and falls back to nothing", () => {
    expect(envelope(-0.1)).toBe(0);
    expect(envelope(0.3)).toBe(1);
    expect(envelope(1.2)).toBe(0);
  });
});

describe("the small drawings", () => {
  it("keeps every glyph's dots inside its honey disc", () => {
    for (const [key, pts] of Object.entries(GLYPHS)) {
      for (const p of pts) expect(Math.hypot(p.x - GLYPH_BOX / 2, p.y - GLYPH_BOX / 2) + GLYPH_DOT, key).toBeLessThanOrEqual(GLYPH_BOX / 2 - 4);
    }
  });

  it("keeps every scenario inside its box", () => {
    for (const [key, s] of Object.entries(SCENARIOS)) {
      for (const p of [...s.sessions, ...s.lanes, ...s.comb, ...s.notes, ...s.check]) {
        expect(p.x, key).toBeGreaterThan(2);
        expect(p.x, key).toBeLessThan(SCENARIO_BOX.width - 2);
        expect(p.y, key).toBeGreaterThan(2);
        expect(p.y, key).toBeLessThan(SCENARIO_BOX.height - 2);
      }
    }
  });
});
