import { describe, expect, it } from "vitest";
import layout from "./fixtures/layout.json";
import { dotReach } from "./columns";
import { arcAtY } from "./geometry";
import { layLine } from "./line";
import { marginDrop, pastRun, stretchEnds, stretchesInView, tightestInView } from "./rules";
import { routeKind, roundedPolyline } from "./serpentine";
import type { Anchors } from "./spine";

// The serpentine on the real page (the fixture: measureAnchors and the browser's own boxes at seven sizes, e2e/wavepath-fixture).
// Every rule is read off the line the page itself would draw (layLine), never off the route's own bookkeeping.
type Size = keyof typeof layout;
const sizes = Object.keys(layout) as Size[];
const pageAt = (size: Size) => {
  const page = layout[size];
  const anchors = page.anchors as Anchors;
  const laid = layLine(anchors, page.viewport);
  return { page, anchors, laid, W: anchors.width, reach: dotReach(laid.amp) };
};

describe("which line a window gets", () => {
  it("gives a phone's to a narrow window, and to a one-column window held portrait; every other window the wide one", () => {
    expect(routeKind(390, 844)).toBe("phone");
    expect(routeKind(375, 667)).toBe("phone");
    expect(routeKind(560, 400)).toBe("phone");
    expect(routeKind(700, 1000)).toBe("phone");
    expect(routeKind(700, 600)).toBe("wide");
    expect(routeKind(768, 1024)).toBe("wide");
    expect(routeKind(1280, 800)).toBe("wide");
    for (const size of sizes) expect(pageAt(size).laid.route.kind).toBe(Number(size.split("x")[0]) < 600 ? "phone" : "wide");
  });
});

describe("the serpentine on the page", () => {
  for (const size of sizes) {
    const { anchors, laid, W, reach } = pageAt(size);
    const s = laid.samples;
    const shown = stretchesInView(s, anchors, reach);

    it(`crosses at least twice, alternating sides, each crossing lower than the last at ${size}`, () => {
      const { crossings } = laid.route;
      expect(crossings.length).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < crossings.length; k++) expect(crossings[k].yIn).toBeGreaterThan(crossings[k - 1].yOut);
      for (let k = 1; k < crossings.length; k++) expect(crossings[k].from).not.toBe(crossings[k - 1].from);
    });

    it(`shows each stretch across the whole width: in from one edge and out past the other at ${size}`, () => {
      expect(shown.length).toBe(laid.route.crossings.length);
      for (const { first, last } of stretchEnds(s, anchors, reach)) {
        expect(Math.min(first, last), "enters or leaves at the left edge").toBeLessThan(-reach + 8);
        expect(Math.max(first, last), "enters or leaves at the right edge").toBeGreaterThan(W + reach - 8);
      }
    });

    it(`never turns tighter than 0.6 of the width while in view at ${size}`, () => {
      expect(tightestInView(s, anchors, reach), "the tightest radius in view, px").toBeGreaterThanOrEqual(0.6 * W);
    });

    it(`never runs down a margin at ${size}`, () => {
      // Within the outer 15 percent of either side, no stretch in view drops more than 120 px.
      expect(marginDrop(s, anchors, reach), "the most a stretch drops within a margin, px").toBeLessThan(120);
    });

    it(`never climbs: the arc length grows as the page goes down at ${size}`, () => {
      let last = 0;
      for (let y = 0; y < anchors.box.footer.bottom; y += 37) {
        const at = arcAtY(s, y);
        expect(at).toBeGreaterThanOrEqual(last);
        last = at;
      }
    });

    it(`keeps its return clear of the band and ends past an edge at ${size}`, () => {
      for (let i = pastRun(s, W, reach); i < s.count; i++) if (s.x[i] > -reach && s.x[i] < W + reach) expect(s.y[i]).toBeGreaterThan(anchors.box.band.bottom + reach);
      const end = s.count - 1;
      expect(s.x[end] < -reach || s.x[end] > W + reach).toBe(true);
    });
  }
});

describe("roundedPolyline", () => {
  it("keeps the legs straight and turns each corner on an arc of the radius asked for", () => {
    const pts = roundedPolyline([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }], 50, 2);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts.at(-1)).toEqual({ x: 200, y: 200 });
    // The corner is cut at 50 px along each leg, by a quarter circle centred at (150, 50).
    for (const p of pts) if (p.x > 150 && p.y < 50) expect(Math.abs(Math.hypot(p.x - 150, p.y - 50) - 50)).toBeLessThan(0.01);
    expect(pts.some((p) => p.x === 120 && p.y === 0)).toBe(true);
  });
  it("shrinks a corner's radius to fit short legs", () => {
    const pts = roundedPolyline([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }], 100, 1);
    for (const p of pts) {
      expect(p.x).toBeLessThanOrEqual(40 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
