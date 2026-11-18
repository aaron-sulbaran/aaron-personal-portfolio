import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import type { InputDriver } from "@/lib/coil/drivers";
import { siteContent } from "@/lib/content";
import { DEFAULT_KNOBS } from "@/lib/home/dealKnobs";
import { columnBand, fastForward, fastForwardsOnKey, fasterScale, litArea, openedCardCount, progressLine, promptDue, promptFrame, promptPlan, promptStartPx, titleInPlace } from "@/lib/home/clickPrompt";

describe("the big moment's plan, in ms from the click", () => {
  it("plans the one moment from the landing: in 200, alone 600, shrink 340, hand-off 140", () => {
    expect(promptPlan(DEFAULT_KNOBS)).toEqual({ startMs: 2640, shownMs: 2840, shrinkStartMs: 3440, shrinkEndMs: 3780, handoffStartMs: 3780, endMs: 3920, lockUntilMs: 3920, columnsAtMs: 3610, titleRatio: 1.5, dimStrength: 1 });
  });
  it("follows the deal's clock and its two time knobs", () => {
    // The landing is the later of the pull's end and the field's opening: a pull 200 ms longer lands 200 ms later.
    expect(promptPlan({ ...DEFAULT_KNOBS, pullMs: 1150 }).startMs).toBe(2840);
    expect(promptPlan({ ...DEFAULT_KNOBS, promptAloneMs: 300 }).columnsAtMs).toBe(3310);
    expect(promptPlan({ ...DEFAULT_KNOBS, promptShrinkMs: 680 }).columnsAtMs).toBe(3710);
  });
  it("brings the columns in half way through the line's travel: after it has been read, before it has landed", () => {
    const plan = promptPlan(DEFAULT_KNOBS);
    expect(plan.columnsAtMs).toBe((plan.shrinkStartMs + plan.shrinkEndMs) / 2);
    expect(plan.columnsAtMs).toBeGreaterThan(plan.shrinkStartMs);
    expect(plan.columnsAtMs).toBeLessThan(plan.shrinkEndMs);
  });
  it("lands the line before its hand-off, so the cross-fade into the resting line happens in place, and holds the lock to the end", () => {
    const plan = promptPlan({ ...DEFAULT_KNOBS, promptShrinkMs: 900 });
    expect(plan.shrinkEndMs).toBe(plan.endMs - COIL.deal.prompt.handoffMs);
    expect(plan.handoffStartMs).toBe(plan.shrinkEndMs);
    expect(plan.lockUntilMs).toBe(plan.endMs);
  });
  it("carries the start size and the dim's strength from their knobs", () => {
    expect(promptPlan({ ...DEFAULT_KNOBS, promptTitleRatio: 2, promptDimStrength: 0.4 })).toMatchObject({ titleRatio: 2, dimStrength: 0.4 });
  });
});

describe("the line under the Work column", () => {
  const line = (opened: number, openedBefore: boolean, input: InputDriver = "fine") => progressLine({ opened, total: 14, openedBefore, input });
  it("asks a first visitor to click a card, or tap one on touch", () => {
    expect(line(0, false)).toEqual({ kind: "prompt", text: "Click a card to open it" });
    expect(line(0, false, "coarse")).toEqual({ kind: "prompt", text: "Tap a card to open it" });
  });
  it("turns into 1 of 14 opened once a card has been opened in the tab", () => {
    expect(line(1, true)).toEqual({ kind: "count", text: "1 of 14 opened" });
    expect(line(1, false)).toEqual({ kind: "count", text: "1 of 14 opened" }); // blocked storage still counts the tab
  });
  it("shows a returning visitor nothing until they open a card, as today", () => {
    expect(line(0, true)).toEqual({ kind: "none", text: "0 of 14 opened" });
  });
  it("keeps the copy in sentence case, with no em dash and no full stop", () => {
    for (const text of Object.values(siteContent.columns.prompt)) expect(text).toMatch(/^[A-Z][a-z ]+[a-z]$/);
  });
});

describe("who is due the prompt", () => {
  it("is due only when no card is opened in this tab and none was opened before", () => {
    expect(promptDue({ opened: 0, openedBefore: false })).toBe(true);
    expect(promptDue({ opened: 1, openedBefore: false })).toBe(false);
    expect(promptDue({ opened: 0, openedBefore: true })).toBe(false);
    expect(promptDue({ opened: 3, openedBefore: true })).toBe(false);
  });
  it("counts only the cards' keys in the seen set", () => {
    const keys = siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => title.key)));
    expect(openedCardCount(new Set())).toBe(0);
    expect(openedCardCount(new Set([keys[0], keys[1], "not-a-card"]))).toBe(2);
  });
});

describe("the big line's start size", () => {
  it("is 1.5 page titles at 1440 (36.7 px), never bigger than its share of the viewport", () => {
    expect(promptStartPx({ vwPx: 57.6, titlePx: 24.48, titleRatio: 1.5 })).toBeCloseTo(36.72, 5);
    expect(promptStartPx({ vwPx: 27.3, titlePx: 21, titleRatio: 1.5 })).toBe(27.3);
  });
  it("falls back to the viewport's share when no page title is on screen to measure", () => {
    expect(promptStartPx({ vwPx: 57.6, titlePx: null, titleRatio: 1.5 })).toBe(57.6);
    expect(promptStartPx({ vwPx: 57.6, titlePx: 0, titleRatio: 1.5 })).toBe(57.6);
  });
});

describe("a frame of the move", () => {
  const from = { left: 320, top: 418, width: 800, height: 64 };
  const to = { left: 32, top: 700, width: 160, height: 16 };
  it("sits at its origin at full size before the shrink, the dim up, the line not yet there", () => {
    expect(promptFrame({ inP: 1, shrinkP: 0, handoffP: 0 }, from, to)).toEqual({ x: 320, y: 418, scale: 1, opacity: 1, lineOpacity: 0, dimOpacity: 1 });
  });
  it("ends on the resting line's box: its left edge, its vertical middle, its width", () => {
    const f = promptFrame({ inP: 1, shrinkP: 1, handoffP: 1 }, from, to);
    expect(f.x).toBe(32);
    expect(f.y + (from.height * f.scale) / 2).toBeCloseTo(708, 9);
    expect(from.width * f.scale).toBeCloseTo(160, 9);
    expect(f).toMatchObject({ opacity: 0, lineOpacity: 1, dimOpacity: 0 });
  });
  it("fades in on inP", () => {
    expect(promptFrame({ inP: 0.5, shrinkP: 0, handoffP: 0 }, from, to).opacity).toBe(0.5);
  });
  it("brings the dim in with the text and takes it out over the shrink: inP times one minus shrinkP", () => {
    expect(promptFrame({ inP: 0.5, shrinkP: 0, handoffP: 0 }, from, to).dimOpacity).toBe(0.5);
    expect(promptFrame({ inP: 1, shrinkP: 0.25, handoffP: 0 }, from, to).dimOpacity).toBe(0.75);
    expect(promptFrame({ inP: 1, shrinkP: 1, handoffP: 1 }, from, to).dimOpacity).toBe(0);
  });
});

describe("fast-forwarding the run", () => {
  const p = promptPlan(DEFAULT_KNOBS); // shrink 3440 to 3920
  it("before the shrink, jumps to its start and plays the rest in the fast time", () => {
    const ff = fastForward(p, 3000, 250);
    expect(ff).toEqual({ seekMs: p.shrinkStartMs, timeScale: (p.endMs - p.shrinkStartMs) / 250 });
    expect(fastForward(p, 0, 250)?.seekMs).toBe(p.shrinkStartMs);
  });
  it("during the shrink, keeps the place and plays what is left in the fast time", () => {
    const now = p.endMs - 400;
    expect(fastForward(p, now, 250)).toEqual({ seekMs: now, timeScale: 1.6 });
  });
  it("never plays slower than the plan", () => {
    expect(fastForward(p, p.endMs - 100, 250)).toEqual({ seekMs: p.endMs - 100, timeScale: 1 });
  });
  it("has nothing to do at or after the end", () => {
    expect(fastForward(p, p.endMs, 250)).toBeNull();
    expect(fastForward(p, p.endMs + 500, 250)).toBeNull();
  });
});

describe("fasterScale and repeated fast-forwards", () => {
  it("never lowers the scale", () => {
    expect(fasterScale(8, 3)).toBe(8);
    expect(fasterScale(2, 5)).toBe(5);
  });

  it("lands a stream of calls no later than fastMs after the first", () => {
    const plan = promptPlan(DEFAULT_KNOBS);
    const fastMs = COIL.deal.prompt.fastForwardMs;
    let local = 3000; // run time in ms
    let scale = 1;
    let realMs = 0;
    for (let i = 0; i < 40 && local < plan.endMs; i += 1) {
      const rule = fastForward(plan, local, fastMs);
      if (!rule) break;
      local = Math.max(local, rule.seekMs);
      scale = fasterScale(scale, rule.timeScale);
      local += 10 * scale; // 10 ms of real time between events
      realMs += 10;
    }
    expect(realMs).toBeLessThanOrEqual(fastMs + 10); // plus one event step of quantization
    expect(local).toBeGreaterThanOrEqual(plan.endMs);
  });
});

describe("the key rule under the dim", () => {
  it("lands the line on any key but a bare modifier", () => {
    for (const key of ["Escape", "Enter", " ", "a", "ArrowDown", "Tab"]) expect(fastForwardsOnKey(key)).toBe(true);
    for (const key of ["Shift", "Control", "Alt", "Meta"]) expect(fastForwardsOnKey(key)).toBe(false);
  });
});

describe("the oval of light over the Coil", () => {
  it("centres on the stage's part on screen, a narrow tall oval", () => {
    const area = litArea({ left: 0, top: 0, width: 1440, height: 900 }, 900)!;
    expect(area).toMatchObject({ cx: 720, cy: 450, clear: 0.6 });
    expect(area.rx).toBeCloseTo(619.2, 5);
    expect(area.ry).toBeCloseTo(720, 5);
  });
  it("follows the stage as it scrolls, measuring only what is on screen", () => {
    expect(litArea({ left: 0, top: -200, width: 1440, height: 1100 }, 900)?.cy).toBe(450);
    expect(litArea({ left: 0, top: 300, width: 1440, height: 900 }, 900)?.cy).toBe(600);
  });
  it("is nothing when the stage is off screen", () => {
    expect(litArea({ left: 0, top: 1000, width: 1440, height: 900 }, 900)).toBeNull();
  });
});

describe("the big line on a phone, in place under the page title", () => {
  const perPx = { width: 9.67, height: 1.1 };
  // The line's box is 16 px tall; the title ends 8 px above it and the columns begin 16 px below it.
  const line = { left: 20, top: 560, right: 143, bottom: 576 };
  const base = { line, aboveBottom: 552, belowTop: 592, rightEdge: 374, perPx, linePx: 12.72 };
  it("grows from the line's left edge on the line's middle when the band has room", () => {
    const at = titleInPlace({ ...base, wantPx: 20 });
    expect(at.px).toBe(20);
    expect(at.left).toBe(20);
    expect(at.top + (1.1 * 20) / 2).toBeCloseTo(568, 5);
  });
  it("keeps its air from the title above and the columns below, cut to the band between them", () => {
    const at = titleInPlace({ ...base, wantPx: 40 });
    expect(at.px).toBeCloseTo((592 - 552 - 2 * COIL.deal.prompt.textAirPx) / 1.1, 5);
    expect(at.top).toBeGreaterThanOrEqual(552 + 3);
    expect(at.top + 1.1 * at.px).toBeLessThanOrEqual(592 - 3 + 1e-9);
  });
  it("never reaches past the screen's gutter", () => {
    const at = titleInPlace({ ...base, rightEdge: 200, wantPx: 24 });
    expect(20 + 9.67 * at.px).toBeLessThanOrEqual(200 + 1e-9);
  });
  it("is never smaller than the line it grows from", () => {
    expect(titleInPlace({ ...base, aboveBottom: 560, belowTop: 576, wantPx: 24 }).px).toBe(12.72);
  });
  it("vouches for its place when the band and the screen have room for at least the line's own size", () => {
    expect(titleInPlace({ ...base, wantPx: 20 }).clear).toBe(true);
    expect(titleInPlace({ ...base, wantPx: 40 }).clear).toBe(true);
  });
  it("vouches for no place when the band is too shallow or the screen too narrow for even the line's own size", () => {
    expect(titleInPlace({ ...base, aboveBottom: 560, belowTop: 576, wantPx: 24 }).clear).toBe(false);
    expect(titleInPlace({ ...base, rightEdge: 120, wantPx: 24 }).clear).toBe(false);
  });
});

describe("the big line in the Work column, from 768 px wide", () => {
  const perPx = { width: 10.1, height: 1.1 };
  // The 1440 desktop: the line rests under the Work list at x 32; the screen's foot is 888 px down.
  const line = { left: 32, top: 630, right: 160, bottom: 646 };
  const base = { line, aboveBottom: 607, belowTop: 888, rightEdge: 1428, perPx, linePx: 12.72, wantPx: 36.72 };
  const card = (left: number, top: number, right: number, bottom: number) => [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  it("plays at its full size where the line rests when no card is near", () => {
    const at = titleInPlace({ ...base, quads: [card(525, 520, 700, 800)] });
    expect(at.px).toBe(36.72);
    expect(at.left).toBe(32);
    expect(at.top).toBeGreaterThanOrEqual(607 + 3);
  });
  it("is cut to the biggest size that keeps its air from a card beside it", () => {
    const at = titleInPlace({ ...base, quads: [card(300, 560, 500, 760)] });
    expect(at.px).toBeLessThan(36.72);
    expect(32 + 10.1 * at.px).toBeLessThanOrEqual(300 - COIL.deal.prompt.cardGapPx + 0.01);
    expect(32 + 10.1 * at.px).toBeGreaterThan(300 - COIL.deal.prompt.cardGapPx - 1);
  });
  it("keeps its air from a tilted card too", () => {
    const tilted = [
      { x: 300, y: 640 },
      { x: 420, y: 560 },
      { x: 520, y: 680 },
      { x: 400, y: 770 },
    ];
    const at = titleInPlace({ ...base, quads: [tilted] });
    const box = { left: at.left, top: at.top, right: at.left + 10.1 * at.px, bottom: at.top + 1.1 * at.px };
    // No point of the card's edges comes inside the line's box grown by a hair under its air.
    for (let side = 0; side < 4; side++) {
      const [from, to] = [tilted[side], tilted[(side + 1) % 4]];
      for (let step = 0; step <= 200; step++) {
        const x = from.x + ((to.x - from.x) * step) / 200;
        const y = from.y + ((to.y - from.y) * step) / 200;
        const air = COIL.deal.prompt.cardGapPx - 0.1;
        expect(x > box.left - air && x < box.right + air && y > box.top - air && y < box.bottom + air, `edge ${side} at ${x.toFixed(1)}, ${y.toFixed(1)}`).toBe(false);
      }
    }
    expect(at.px).toBeLessThan(36.72);
    expect(at.px).toBeGreaterThan(12.72);
  });
  it("keeps the line's own size when even that would meet a card, and vouches for no place", () => {
    const at = titleInPlace({ ...base, quads: [card(100, 600, 400, 700)] });
    expect(at.px).toBe(12.72);
    expect(at.clear).toBe(false);
  });
  it("vouches for no place when the cards were asked for and none could be measured (the scene is not drawing yet)", () => {
    const at = titleInPlace({ ...base, quads: [] });
    expect(at.clear).toBe(false);
    expect(at.px).toBe(12.72);
  });
  it("vouches for a place it cut to keep clear of a card", () => {
    expect(titleInPlace({ ...base, quads: [card(525, 520, 700, 800)] }).clear).toBe(true);
    expect(titleInPlace({ ...base, quads: [card(300, 560, 500, 760)] }).clear).toBe(true);
  });
});

describe("the band the big line may use in the Work column", () => {
  // 768 px wide: the Work list ends at 408, the line rests at 426 to 440, the screen's foot is `foot` px down.
  const line = { left: 32, top: 426, right: 160, bottom: 440 };
  const gap = COIL.deal.prompt.chromeGapPx;
  it("runs from the Work list's foot to the screen's foot when no Music pill is in the way", () => {
    expect(columnBand({ line, aboveBottom: 408, footTop: 584, pill: null })).toEqual({ aboveBottom: 408, belowTop: 584 });
  });
  it("stops its air above a Music pill that sits below the line", () => {
    expect(columnBand({ line, aboveBottom: 408, footTop: 584, pill: { left: 0, top: 510, right: 768, bottom: 546 } })).toEqual({ aboveBottom: 408, belowTop: 510 - gap });
  });
  it("starts its air below a Music pill that sits above the line (a phone on its side)", () => {
    const low = { left: 32, top: 371, right: 155, bottom: 385 };
    expect(columnBand({ line: low, aboveBottom: 353, footTop: 374, pill: { left: 0, top: 300, right: 844, bottom: 336 } })).toEqual({ aboveBottom: 353, belowTop: 374 });
    expect(columnBand({ line: low, aboveBottom: 320, footTop: 374, pill: { left: 0, top: 300, right: 844, bottom: 336 } })).toEqual({ aboveBottom: 336 + gap, belowTop: 374 });
  });
  it("vouches for no place when the resting line itself sits outside the band (a phone on its side: the line is in the screen's foot gutter)", () => {
    const low = { left: 32, top: 371, right: 155, bottom: 385 };
    const perPx = { width: 10.1, height: 1.1 };
    const at = titleInPlace({ line: low, aboveBottom: 353, belowTop: 374, rightEdge: 828, perPx, linePx: 12.72, wantPx: 36.72 });
    expect(at.clear).toBe(false);
    // With the same room and the line inside it, the place stands.
    expect(titleInPlace({ line: { ...low, top: 356, bottom: 370 }, aboveBottom: 353, belowTop: 374, rightEdge: 828, perPx, linePx: 12.72, wantPx: 36.72 }).clear).toBe(true);
  });
  it("is empty when the Music pill is over the line itself (a short window): no place for the big line", () => {
    const band = columnBand({ line, aboveBottom: 408, footTop: 484, pill: { left: 0, top: 410, right: 768, bottom: 446 } });
    expect(band.belowTop).toBeLessThanOrEqual(band.aboveBottom);
    const perPx = { width: 10.1, height: 1.1 };
    expect(titleInPlace({ line, ...band, rightEdge: 752, perPx, linePx: 12.72, wantPx: 36.72 }).clear).toBe(false);
  });
});
