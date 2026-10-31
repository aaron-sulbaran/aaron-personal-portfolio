import { describe, expect, it } from "vitest";
import layout from "./fixtures/layout.json";
import { dotReach } from "./columns";
import { EXCURSION_MARGIN, TRAIN_PX } from "./constants";
import { arcAtY } from "./geometry";
import { layLine } from "./line";
import { excursionsBetween, legsInView, marginDrop, pastRun, radiusAt, seamCrossing, stretchEnds, stretchesInView, tightestInView, TURN_RADIUS, turnsInView } from "./rules";
import { excursionCorners, routeKind, roundedPolyline } from "./serpentine";
import type { Anchors } from "./spine";
import { trainAt, visibleOptions } from "./visible";

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
      // Sides alternate, but for one change behind the cards section.
      const behind = crossings.filter((c, k) => k > 0 && c.from === crossings[k - 1].from);
      expect(behind.length).toBeLessThanOrEqual(1);
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

// Aaron's note on the turns (A33): the wave may leave the screen, but it must leave whole before it comes back, so no scroll position
// shows two legs joined by one turn. Read off the line the page would draw, at every 50 px of scroll the visitor can rest at.
describe("the line leaves the screen before it comes back", () => {
  const STEP = 50;
  for (const size of sizes) {
    const { page, anchors, laid, W, reach } = pageAt(size);
    const s = laid.samples;
    const opts = visibleOptions(W, page.viewport);
    const legs = legsInView(s, anchors, reach);
    const maxScroll = anchors.box.footer.bottom - page.viewport;
    const scrolls = Array.from({ length: Math.ceil(maxScroll / STEP) + 1 }, (_, k) => Math.min(maxScroll, k * STEP));

    it(`takes the train's length and a margin to go out past an edge and back in, every time, at ${size}`, () => {
      // The band's run and each crossing are a leg; between two legs the line goes out, round a turn, and in again.
      expect(legs.length).toBe(laid.route.crossings.length + 1);
      const excursions = excursionsBetween(s, anchors, reach);
      expect(excursions.length).toBe(legs.length - 1);
      for (const px of excursions) expect(px, "arc of line between two legs in view, px").toBeGreaterThanOrEqual(TRAIN_PX + EXCURSION_MARGIN);
    });

    it(`shows at most one leg of the train at every 50 px of scroll at ${size}`, () => {
      for (const scroll of scrolls) {
        const { head, tail } = trainAt(s, anchors, opts, scroll);
        // The whole train counts, its faded end too: a leg shows when one of its samples is both drawn and on the screen.
        const shown = legs.filter((leg) => leg.some((i) => i * s.step >= tail && i * s.step <= head && s.y[i] > scroll && s.y[i] < scroll + page.viewport));
        expect(shown.length, `legs of the train on screen at scroll ${scroll}`).toBeLessThanOrEqual(1);
      }
    });

    it(`keeps every turn, amplitude and dot spread and all, off the screen at every 50 px of scroll at ${size}`, () => {
      for (const scroll of scrolls) expect(turnsInView(s, anchors, reach, scroll, page.viewport), `samples on a turn in view at scroll ${scroll}`).toEqual([]);
      // The turns exist, one pair for each excursion: the check is not passing for want of any.
      const tight = Array.from({ length: s.count - 8 }, (_, k) => k + 4).filter((i) => radiusAt(s, i) < TURN_RADIUS);
      expect(tight.length).toBeGreaterThan(laid.route.crossings.length);
    });
  }
});

describe("excursionCorners", () => {
  const out = { x: 100, y: 10, side: "right" } as const;
  it("is a plain drop with no arm, and carries both ends farther out along the level with one", () => {
    const into = { x: 100, y: 50, side: "right" } as const;
    expect(excursionCorners(out, into, 0, 30)).toEqual([{ x: 100, y: 10 }, { x: 100, y: 50 }]);
    expect(excursionCorners(out, into, 40, 30)).toEqual([{ x: 140, y: 10 }, { x: 140, y: 50 }]);
    expect(excursionCorners({ x: -100, y: 10, side: "left" }, { x: -100, y: 50, side: "left" }, 40, 30)).toEqual([{ x: -140, y: 10 }, { x: -140, y: 50 }]);
  });
  it("goes out farther from whichever corner is farther out", () => {
    expect(excursionCorners({ x: 170, y: 10, side: "right" }, { x: 135, y: 50, side: "right" }, 25, 30)).toEqual([{ x: 195, y: 10 }, { x: 195, y: 50 }]);
  });
  it("crosses behind the cards when the next leg comes in from the other side, each end carried out by the arm", () => {
    const into = { x: -100, y: 90, side: "left" } as const;
    expect(excursionCorners(out, into, 0, 30)).toEqual([{ x: 100, y: 10 }, { x: 100, y: 30 }, { x: -100, y: 30 }, { x: -100, y: 90 }]);
    expect(excursionCorners(out, into, 20, 30)).toEqual([{ x: 120, y: 10 }, { x: 120, y: 30 }, { x: -120, y: 30 }, { x: -120, y: 90 }]);
  });
});

describe("on a phone", () => {
  for (const size of sizes.filter((k) => Number(k.split("x")[0]) < 600)) {
    const { page, anchors, laid, reach } = pageAt(size);
    const s = laid.samples;
    // Page 4's heading ("wanna chat?"), the loose text of the connect section that sits highest (its number is above it).
    const heading = anchors.headings.filter((h) => h.top >= anchors.box.connect.top).sort((a, b) => b.bottom - b.top - (a.bottom - a.top))[0];
    // The contact links: the rows under the heading that run the page's width.
    const links = page.targets.filter((t) => t.top >= heading.bottom && t.right - t.left > 0.8 * anchors.width);

    it(`leaves page 3 off the left edge, never turning back on screen, at ${size}`, () => {
      const lastWords = Math.max(...anchors.blocks.filter((b) => b.bottom <= heading.top).map((b) => b.bottom));
      const between = Array.from({ length: s.count }, (_, i) => i).filter((i) => s.y[i] > lastWords && s.y[i] < heading.top);
      expect(Math.min(...between.map((i) => s.x[i])), "the line past the left edge between page 3 and page 4").toBeLessThan(-reach);
      // It got there travelling left: the crossing nearest page 4's top edge comes in from the right.
      expect(seamCrossing(laid.route.crossings, anchors)?.from).toBe("right");
    });

    it(`comes back from the left between page 4's heading and the footer, around its links, at ${size}`, () => {
      const back = laid.route.crossings.filter((c) => c.yIn > heading.bottom && c.yOut < anchors.box.footer.top);
      expect(back.length).toBeGreaterThanOrEqual(1);
      expect(back[0].from).toBe("left");
      // Around the links: one crossing above the first link row or between rows, one below the last.
      expect(back.some((c) => c.yOut < Math.min(...links.map((t) => t.top)))).toBe(true);
      expect(back.some((c) => c.yIn > Math.max(...links.map((t) => t.bottom)))).toBe(true);
    });
  }
});

describe("the route above a block that grows", () => {
  // The numbers strip's Tokens view mounts its toolkit band under the chart: the strip's block grows and everything under it moves
  // down. The line above the block's top must not move at all (the strip's chart is above the band).
  for (const size of ["1280x800", "390x844"] as Size[]) {
    it(`is the same to the px above the grown block at ${size}`, () => {
      const page = layout[size];
      const anchors = page.anchors as Anchors;
      const board = anchors.blocks.filter((b) => b.top > anchors.box.numbers.top && b.top < anchors.box.numbers.bottom).sort((a, b) => b.bottom - b.top - (a.bottom - a.top))[0];
      const grow = 320;
      const moved = (y: number) => (y >= board.bottom ? y + grow : y);
      const shift = <T extends { top: number; bottom: number }>(r: T): T => ({ ...r, top: r.top >= board.bottom ? r.top + grow : r.top, bottom: moved(r.bottom) });
      const grown: Anchors = {
        ...anchors,
        box: Object.fromEntries(Object.entries(anchors.box).map(([k, v]) => [k, shift(v)])) as Anchors["box"],
        words: Object.fromEntries(Object.entries(anchors.words).map(([k, v]) => [k, shift(v)])) as Anchors["words"],
        blocks: anchors.blocks.map(shift),
        links: anchors.links.map(shift),
        headings: anchors.headings.map(shift),
      };
      const a = layLine(anchors, page.viewport).samples;
      const b = layLine(grown, page.viewport).samples;
      let compared = 0;
      for (let i = 0; i < a.count && a.y[i] < board.top; i++, compared++) {
        expect(Math.abs(b.x[i] - a.x[i]) + Math.abs(b.y[i] - a.y[i]), `sample ${i} at y ${a.y[i]}`).toBeLessThan(0.01);
      }
      expect(compared).toBeGreaterThan(200);
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
