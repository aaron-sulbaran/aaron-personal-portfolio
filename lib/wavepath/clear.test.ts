import { describe, expect, it } from "vitest";
import layout from "./fixtures/layout.json";
import { dotsOn, layLine, lineDots, type DotState } from "./line";
import type { Anchors, Rect } from "./spine";

// The line must never draw a dot on words, a link or a tap target. The fixture is the real page at three widths, measured after the
// deal and a walk down the page (every reveal played): the probe's anchors (what the line is laid on), each line of text and each
// link, button and control as the browser drew them, all in layer px. The cards section is left out, as it is on the page: its shader
// hides the line there. Only the page's own measurements and the lib's own line are used, so a copy change moves the fixture, not the rule.
type Size = keyof typeof layout;
const sizes = Object.keys(layout) as Size[];
const STATES: DotState[] = ["rest", "loud"];

function onPage(size: Size) {
  const page = layout[size];
  const outside = (r: Rect) => r.bottom <= page.cards.top || r.top >= page.cards.bottom;
  return { ...page, anchors: page.anchors as Anchors, lines: page.lines.filter(outside), targets: page.targets.filter(outside) };
}

describe("the line keeps off words and links", () => {
  for (const size of sizes) {
    const page = onPage(size);
    const laid = layLine(page.anchors, page.viewport);
    for (const state of STATES) {
      const dots = lineDots(laid, state);
      it(`puts no dot on a line of text at ${size}, ${state}`, () => {
        const hits = dotsOn(dots, page.lines).map(({ rect, dots: n }) => `${page.lines[rect].text} x${n}`);
        expect(hits).toEqual([]);
      });
      it(`puts no dot on a link, a button or a control at ${size}, ${state}`, () => {
        const hits = dotsOn(dots, page.targets).map(({ rect, dots: n }) => `${page.targets[rect].label} x${n}` );
        expect(hits).toEqual([]);
      });
    }

    // Keeping off the page must not mean drawing nothing: the line is still on screen, and still drawn across most of its length.
    it(`still draws the line at ${size}: dots on screen, and most of its arc`, () => {
      const dots = lineDots(laid, "rest");
      const onScreen = dots.filter((_, k) => k % 3 === 0).filter((x) => x >= 0 && x <= page.anchors.width).length;
      expect(onScreen).toBeGreaterThan(300);
      const drawn = new Set<number>();
      for (let k = 0; k < dots.length; k += 3) drawn.add(Math.round(dots[k + 1] / 40));
      const spanned = laid.samples.y[laid.samples.count - 1] - laid.samples.y[0];
      expect(drawn.size * 40, "the page's height the line is drawn across, px").toBeGreaterThan(spanned * 0.6);
    });
  }
});

describe("dotsOn", () => {
  const rect = { left: 10, right: 20, top: 10, bottom: 20 };
  it("counts the dots whose disc reaches the rect", () => {
    expect(dotsOn([15, 15, 2, 22, 15, 2, 23, 15, 2, 22.5, 22.5, 2], [rect])).toEqual([{ rect: 0, dots: 2 }]);
  });
  it("says nothing for a rect no dot reaches", () => expect(dotsOn([40, 40, 2], [rect])).toEqual([]));
});
