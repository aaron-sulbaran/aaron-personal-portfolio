import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import type { InputDriver } from "@/lib/coil/drivers";
import { siteContent } from "@/lib/content";
import { DEFAULT_KNOBS, PROMPT_MODES, type DealKnobs } from "@/lib/home/dealKnobs";
import { fastForward, fastForwardsOnKey, fasterScale, litArea, openedCardCount, progressLine, promptDue, promptFitPx, promptFrame, promptOrigin, promptOverride, promptPlan, promptStartPx, titleInPlace, titlePill, titlePlace, type PromptOverride } from "@/lib/home/clickPrompt";

const plan = (patch: Partial<DealKnobs> = {}, override?: PromptOverride) => promptPlan({ ...DEFAULT_KNOBS, ...patch }, override);

describe("the big moment's plan, in ms from the click", () => {
  it("Early comes in at the lift (1,690 ms at today's speed), holds 1,000 ms once shown, shrinks 480 ms", () => {
    expect(plan()).toMatchObject({ version: "plate", mode: "early", startMs: 1690, shownMs: 1890, shrinkStartMs: 2890, handoffStartMs: 3230, endMs: 3370, lockUntilMs: null });
  });
  it("Hold and After start as the Coil lands (2,640 ms); only Hold asks the lock to wait, until the shrink ends", () => {
    expect(plan({ promptMode: "hold" })).toMatchObject({ startMs: 2640, endMs: 4320, lockUntilMs: 4320 });
    expect(plan({ promptMode: "after" })).toMatchObject({ startMs: 2640, endMs: 4320, lockUntilMs: null });
  });
  it("moves each mode by its own start knob only", () => {
    expect(plan({ promptEarlyStartMs: -200 }).startMs).toBe(1490);
    expect(plan({ promptEarlyStartMs: -200, promptMode: "hold" }).startMs).toBe(2640);
  });
  it("never holds the big text readable for less than 900 ms", () => {
    const p = plan({ promptHoldMs: 100 });
    expect(p.shrinkStartMs - p.shownMs).toBe(900);
  });
  it("rides the deal's clock: a sooner lift brings Early in sooner, a sooner landing brings Hold in sooner", () => {
    expect(plan({ pullStartMs: 1050 }).startMs).toBe(1490);
    expect(plan({ promptMode: "hold", pullStartMs: 1050, pullMs: 850, openStartMs: 950, openMs: 950 }).startMs).toBe(2340);
  });
  it("plans D's Early as Hold: anchored on the landing, the lock waiting for the shrink", () => {
    expect(plan({}, { version: "spotlight", mode: "early" })).toMatchObject({ version: "spotlight", mode: "hold", startMs: 2640, endMs: 4320, lockUntilMs: 4320 });
    expect(plan({ promptVersion: "spotlight" })).toMatchObject({ mode: "hold", lockUntilMs: 4320 });
  });
  it("leaves D's Hold and After as they are", () => {
    expect(plan({ promptVersion: "spotlight", promptMode: "hold" })).toMatchObject({ mode: "hold", startMs: 2640, lockUntilMs: 4320 });
    expect(plan({ promptVersion: "spotlight", promptMode: "after" })).toMatchObject({ mode: "after", startMs: 2640, lockUntilMs: null });
  });
  it("never starts D before the landing, however early the start knob goes", () => {
    expect(plan({ promptVersion: "spotlight", promptMode: "hold", promptHoldStartMs: -800 }).startMs).toBe(2640);
    expect(plan({ promptVersion: "spotlight", promptMode: "after", promptAfterStartMs: -800 }).startMs).toBe(2640);
    expect(plan({ promptVersion: "spotlight", promptMode: "hold", promptHoldStartMs: 300 }).startMs).toBe(2940);
    expect(plan({ promptMode: "hold", promptHoldStartMs: -800 }).startMs).toBe(1840);
  });
  it("takes a debug override over the knobs", () => {
    expect(plan({}, { version: "calm", mode: "after" })).toMatchObject({ version: "calm", mode: "after" });
  });
});

describe("the debug override", () => {
  it("reads prompt= and timing= among the coildebug tokens and ignores the rest", () => {
    expect(promptOverride("?coildebug=flight,prompt=calm,timing=hold")).toEqual({ version: "calm", mode: "hold" });
    expect(promptOverride("?coildebug=prompt=neon,timing=soon")).toEqual({});
    expect(promptOverride("")).toEqual({});
    expect(promptOverride("?coildebug=prompt=spotlight")).toEqual({ version: "spotlight" });
    expect(promptOverride("?coildebug=prompt=title,place=column")).toEqual({ version: "title", place: "column" });
    expect(promptOverride("?coildebug=place=corner")).toEqual({});
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

describe("the big text's fit to the stage", () => {
  const room = 358; // a 390 px phone's stage minus the 32 px margin
  it("leaves a text that fits alone, plate or not", () => {
    expect(promptFitPx({ px: 27.3, textWidth: 270, room, version: "plate" })).toBe(27.3);
    expect(promptFitPx({ px: 27.3, textWidth: 270, room, version: "calm" })).toBe(27.3);
  });
  it("cuts a text wider than the room to the room, without a plate", () => {
    expect(promptFitPx({ px: 40, textWidth: 716, room, version: "calm" })).toBeCloseTo(20, 5);
  });
  it("keeps the plate's 0.75em a side inside the room when the text alone would fit", () => {
    // 350 px of text at 46.8 px (12vw): the plate adds 70.2 px, so 420 px wide.
    const px = promptFitPx({ px: 46.8, textWidth: 350, room, version: "plate" });
    const scale = px / 46.8;
    expect(350 * scale + 1.5 * px).toBeCloseTo(room, 5);
    expect(px).toBeLessThan(46.8);
  });
  it("does not fit a text that has no width", () => {
    expect(promptFitPx({ px: 20, textWidth: 0, room, version: "plate" })).toBe(20);
  });
});

describe("where the big text starts", () => {
  const stage = { left: 0, top: 0, width: 1440, height: 900 };
  const text = { width: 800, height: 64 };
  it("centers on the stage for the plate and the outline, whatever the moment", () => {
    expect(promptOrigin("plate", stage, text, false, "early")).toEqual({ left: 320, top: 418 });
    expect(promptOrigin("outline", stage, text, false, "hold")).toEqual({ left: 320, top: 418 });
  });
  it("centers D on the stage like the plate, with the same clamps, whatever the moment", () => {
    expect(promptOrigin("spotlight", stage, text, false, "hold")).toEqual({ left: 320, top: 418 });
    expect(promptOrigin("spotlight", stage, text, false, "early")).toEqual({ left: 320, top: 418 });
    expect(promptOrigin("spotlight", { left: 0, top: 0, width: 390, height: 490 }, { width: 360, height: 30 }, true, "hold").left).toBe(16);
    expect(promptOrigin("spotlight", { ...stage, height: 100 }, text, false, "hold").top).toBe(72);
  });
  it("puts the calm version's middle at its share of the stage's height, per moment", () => {
    expect(promptOrigin("calm", stage, text, false, "early").top).toBe(0.92 * 900 - 32);
    expect(promptOrigin("calm", stage, text, false, "hold").top).toBe(0.12 * 900 - 32);
    expect(promptOrigin("calm", stage, text, false, "after").top).toBe(0.12 * 900 - 32);
    expect(promptOrigin("calm", { ...stage, height: 844 }, text, true, "early").top).toBeCloseTo(0.87 * 844 - 32, 9);
    expect(promptOrigin("calm", { ...stage, height: 844 }, text, true, "hold").top).toBeCloseTo(0.93 * 844 - 32, 9);
  });
  it("puts the calm version in a different place at Early than at Hold", () => {
    expect(promptOrigin("calm", stage, text, false, "early").top).not.toBe(promptOrigin("calm", stage, text, false, "hold").top);
  });
  it("lets the plate ignore the moment", () => {
    const early = promptOrigin("plate", stage, text, false, "early");
    expect(promptOrigin("plate", stage, text, false, "hold")).toEqual(early);
    expect(promptOrigin("plate", stage, text, false, "after")).toEqual(early);
  });
  it("stays clear of the logo and the Menu pill, and inside the gutters", () => {
    expect(promptOrigin("calm", { ...stage, height: 300 }, text, false, "hold").top).toBe(72);
    expect(promptOrigin("plate", { left: 0, top: 0, width: 390, height: 490 }, { width: 360, height: 30 }, true, "early").left).toBe(16);
  });
  it("moves with the stage, never with the viewport", () => {
    expect(promptOrigin("plate", { ...stage, top: -300 }, text, false, "early").top).toBe(118);
  });
});

describe("a frame of the move", () => {
  const from = { left: 320, top: 418, width: 800, height: 64 };
  const to = { left: 32, top: 700, width: 160, height: 16 };
  it("sits at its origin at full size before the shrink, the plate whole, the line not yet there", () => {
    expect(promptFrame({ inP: 1, shrinkP: 0, handoffP: 0 }, from, to)).toEqual({ x: 320, y: 418, scale: 1, opacity: 1, plateOpacity: 1, lineOpacity: 0, scrimOpacity: 1 });
  });
  it("ends on the resting line's box: its left edge, its vertical middle, its width", () => {
    const f = promptFrame({ inP: 1, shrinkP: 1, handoffP: 1 }, from, to);
    expect(f.x).toBe(32);
    expect(f.y + (from.height * f.scale) / 2).toBeCloseTo(708, 9);
    expect(from.width * f.scale).toBeCloseTo(160, 9);
    expect(f).toMatchObject({ opacity: 0, lineOpacity: 1, plateOpacity: 0, scrimOpacity: 0 });
  });
  it("lets the plate go by the shrink's middle and fades in on inP", () => {
    expect(promptFrame({ inP: 1, shrinkP: 0.5, handoffP: 0 }, from, to).plateOpacity).toBe(0);
    expect(promptFrame({ inP: 0.5, shrinkP: 0, handoffP: 0 }, from, to).opacity).toBe(0.5);
  });
});

describe("D's scrim in a frame", () => {
  const from = { left: 320, top: 418, width: 800, height: 64 };
  const to = { left: 32, top: 700, width: 160, height: 16 };
  it("comes in with the text and goes out over the shrink: inP times one minus shrinkP", () => {
    expect(promptFrame({ inP: 0.5, shrinkP: 0, handoffP: 0 }, from, to).scrimOpacity).toBe(0.5);
    expect(promptFrame({ inP: 1, shrinkP: 0.25, handoffP: 0 }, from, to).scrimOpacity).toBe(0.75);
    expect(promptFrame({ inP: 1, shrinkP: 1, handoffP: 1 }, from, to).scrimOpacity).toBe(0);
  });
});

describe("fast-forwarding the run", () => {
  const p = plan({ promptVersion: "spotlight", promptMode: "hold" }); // shrink 3840 to 4320
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
    const plan = { endMs: 4320, shrinkStartMs: 3840 } as Parameters<typeof fastForward>[0];
    const fastMs = 250;
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

describe("D's key rule", () => {
  it("fast-forwards on any key but a bare modifier", () => {
    for (const key of ["Escape", "Enter", " ", "a", "ArrowDown", "Tab"]) expect(fastForwardsOnKey(key)).toBe(true);
    for (const key of ["Shift", "Control", "Alt", "Meta"]) expect(fastForwardsOnKey(key)).toBe(false);
  });
});

describe("versions E and F", () => {
  it("plans F like D: never before the landing, its Early played as Hold", () => {
    expect(plan({}, { version: "lit", mode: "early" })).toMatchObject({ version: "lit", mode: "hold", startMs: 2640, endMs: 4320, lockUntilMs: 4320 });
    expect(plan({ promptVersion: "lit", promptMode: "after", promptAfterStartMs: -800 }).startMs).toBe(2640);
  });
  it("plans E like A: every timing as chosen", () => {
    expect(plan({ promptVersion: "quiet" })).toMatchObject({ mode: "early", startMs: 1690 });
  });
  it("gives only E and F a start size in page titles", () => {
    expect(plan({ promptVersion: "quiet" }).titleRatio).toBe(1.5);
    expect(plan({ promptVersion: "lit", promptTitleRatio: 2 }).titleRatio).toBe(2);
    expect(plan({ promptVersion: "spotlight" }).titleRatio).toBeNull();
    expect(plan().titleRatio).toBeNull();
  });
  it("starts E and F at 1.5 page titles at 1440 (36.7 px, not D's 57.6) and never bigger than A to D at that width", () => {
    expect(promptStartPx({ vwPx: 57.6, titlePx: 24.48, titleRatio: 1.5 })).toBeCloseTo(36.72, 5);
    expect(promptStartPx({ vwPx: 27.3, titlePx: 21, titleRatio: 1.5 })).toBe(27.3);
    expect(promptStartPx({ vwPx: 57.6, titlePx: 24.48, titleRatio: null })).toBe(57.6);
    expect(promptStartPx({ vwPx: 57.6, titlePx: null, titleRatio: 1.5 })).toBe(57.6);
  });
  it("fits E's plate inside the stage as A's is", () => {
    expect(promptFitPx({ px: 46.8, textWidth: 350, room: 358, version: "quiet" })).toBe(promptFitPx({ px: 46.8, textWidth: 350, room: 358, version: "plate" }));
  });
  it("starts F in B's resting place", () => {
    const stage = { left: 0, top: 0, width: 1440, height: 900 };
    const text = { width: 800, height: 64 };
    expect(promptOrigin("lit", stage, text, false, "hold")).toEqual(promptOrigin("calm", stage, text, false, "hold"));
    expect(promptOrigin("lit", { ...stage, width: 390, height: 490 }, { width: 300, height: 34 }, true, "after")).toEqual(promptOrigin("calm", { ...stage, width: 390, height: 490 }, { width: 300, height: 34 }, true, "after"));
  });
});

describe("F's oval of light", () => {
  it("centres on the stage's part on screen, a narrow tall oval on a desktop", () => {
    const area = litArea({ left: 0, top: 0, width: 1440, height: 900 }, 900, false)!;
    expect(area).toMatchObject({ cx: 720, cy: 450, clear: 0.6 });
    expect(area.rx).toBeCloseTo(619.2, 5);
    expect(area.ry).toBeCloseTo(720, 5);
  });
  it("follows the stage as it scrolls, measuring only what is on screen", () => {
    const area = litArea({ left: 0, top: -200, width: 1440, height: 1100 }, 900, false);
    expect(area?.cy).toBe(450);
    expect(litArea({ left: 0, top: 300, width: 1440, height: 900 }, 900, false)?.cy).toBe(600);
  });
  it("on a phone reaches past both sides and clears to the band's foot", () => {
    const area = litArea({ left: 0, top: 0, width: 390, height: 480 }, 844, true);
    expect(area).toMatchObject({ cx: 195, cy: 240 });
    expect(area!.rx).toBeGreaterThan(390);
    expect(area!.ry * area!.clear).toBeGreaterThanOrEqual(240 * 0.99);
  });
  it("is nothing when the stage is off screen", () => {
    expect(litArea({ left: 0, top: 1000, width: 1440, height: 900 }, 900, false)).toBeNull();
  });
});

describe("version G, the lit title", () => {
  // "Click a card to open it" measures about 10.1 px wide and 1.25 px tall per px of font size.
  const perPx = { width: 10.1, height: 1.25 };
  const desktop = {
    viewportWidth: 1440,
    rowTop: 16,
    chrome: [
      { left: 32, top: 18, right: 64, bottom: 55 },
      { left: 1348, top: 16, right: 1420, bottom: 56 },
    ],
    perPx,
    wantPx: 36.72,
    floorPx: 14.6,
  };
  const phone = {
    viewportWidth: 390,
    rowTop: 12,
    chrome: [
      { left: 20, top: 16, right: 48, bottom: 48 },
      { left: 306, top: 12, right: 378, bottom: 52 },
    ],
    perPx: { width: 9.67, height: 1.25 },
    wantPx: 27.3,
    floorPx: 14.6,
  };
  const card = (left: number, top: number, right: number, bottom: number) => [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  const pillOf = (place: { px: number; left: number }, args: { rowTop: number; perPx: { width: number; height: number } }) =>
    titlePill(place.px, place.left + (args.perPx.width * place.px) / 2, args.rowTop, args.perPx);

  it("plans like F: from the landing, Early as Hold, sized in page titles", () => {
    expect(plan({}, { version: "title", mode: "early" })).toMatchObject({ version: "title", mode: "hold", startMs: 2640, lockUntilMs: 3920, titleRatio: 1.5 });
  });
  it("lands G before its hand-off, so the cross-fade into the resting line happens in place", () => {
    const g = plan({}, { version: "title" });
    expect(g.shrinkEndMs).toBe(g.handoffStartMs);
    expect(g.shrinkEndMs).toBe(g.endMs - 140);
    for (const version of ["plate", "calm", "outline", "spotlight", "quiet", "lit"] as const) {
      const other = plan({}, { version });
      expect(other.shrinkEndMs).toBe(other.endMs);
    }
  });
  it("carries the dim's strength from its knob, full by default", () => {
    expect(plan({}, { version: "title" }).dimStrength).toBe(1);
    expect(plan({ promptDimStrength: 0.4 }, { version: "lit" }).dimStrength).toBe(0.4);
  });
  it("hangs the full-size pill from the top row, centred on the screen, when nothing is in the way", () => {
    const place = titlePlace({ ...desktop, quads: [card(240, 0, 470, 160), card(600, 130, 900, 400)] });
    expect(place).toMatchObject({ px: 36.72, clear: true });
    const pill = pillOf(place, desktop);
    expect(pill.top).toBe(16);
    expect((pill.left + pill.right) / 2).toBeCloseTo(720, 5);
    expect(place.top).toBeCloseTo(16 + 0.3 * 36.72, 5);
  });
  it("shrinks until the pill keeps its air from the nearest card", () => {
    const quads = [card(100, 45, 300, 300)];
    const place = titlePlace({ ...phone, quads });
    const pill = pillOf(place, phone);
    expect(place.clear).toBe(true);
    expect(place.px).toBeLessThan(27.3);
    expect(place.px).toBeGreaterThanOrEqual(14.6);
    expect(pill.bottom).toBeLessThanOrEqual(45 - 4);
    expect(pill.bottom).toBeGreaterThan(45 - 4 - 0.5);
    expect(pill.left).toBeGreaterThanOrEqual(48 + 12);
    expect(pill.right).toBeLessThanOrEqual(306 - 12);
  });
  it("moves between the logo and the Menu pill when that holds a clearly bigger pill than the screen's centre", () => {
    const wideMenu = { ...phone, chrome: [phone.chrome[0], { left: 250, top: 12, right: 378, bottom: 52 }] };
    const place = titlePlace({ ...wideMenu, quads: [card(0, 400, 390, 600)] });
    const pill = pillOf(place, wideMenu);
    expect((pill.left + pill.right) / 2).toBeCloseTo((48 + 250) / 2, 5);
    expect(pill.right).toBeLessThanOrEqual(250 - 12);
  });
  it("stops at the floor between the chrome when nothing fits, and says so", () => {
    const place = titlePlace({ ...phone, quads: [card(0, 20, 390, 300)] });
    expect(place).toMatchObject({ px: 14.6, clear: false });
    expect(place.left + (phone.perPx.width * 14.6) / 2).toBeCloseTo(390 / 2, 5);
  });
  it("never lets a clear pill meet a card, tilted ones included", () => {
    const tilted = [
      [
        { x: 620, y: 150 },
        { x: 760, y: 60 },
        { x: 900, y: 200 },
        { x: 760, y: 320 },
      ],
    ];
    const place = titlePlace({ ...desktop, quads: tilted });
    const pill = pillOf(place, desktop);
    expect(place.clear).toBe(true);
    expect(place.px).toBeLessThan(36.72);
    // The card's top corner is at (760, 60): the pill, centred on 720, ends above it by its air.
    expect(pill.bottom).toBeLessThanOrEqual(60 - 4 + 20);
    const reaches = (x: number, y: number) => x > pill.left && x < pill.right && y > pill.top && y < pill.bottom;
    expect(tilted[0].some((corner) => reaches(corner.x, corner.y))).toBe(false);
  });
  it("vouches for no place when the scene has no cards to measure", () => {
    expect(titlePlace({ ...desktop, quads: [] }).clear).toBe(false);
  });
  it("keeps every point of a tilted card's edges out of the aired pill", () => {
    const quad = [
      { x: 620, y: 150 },
      { x: 760, y: 60 },
      { x: 900, y: 200 },
      { x: 760, y: 320 },
    ];
    const place = titlePlace({ ...desktop, quads: [quad] });
    const pill = pillOf(place, desktop);
    for (let side = 0; side < 4; side++) {
      const [from, to] = [quad[side], quad[(side + 1) % 4]];
      for (let step = 0; step <= 200; step++) {
        const x = from.x + ((to.x - from.x) * step) / 200;
        const y = from.y + ((to.y - from.y) * step) / 200;
        const inside = x > pill.left - 3.9 && x < pill.right + 3.9 && y > pill.top - 3.9 && y < pill.bottom + 3.9;
        expect(inside, `edge ${side} at ${x.toFixed(1)}, ${y.toFixed(1)}`).toBe(false);
      }
    }
  });
  it("takes the wanted size when the floor is above it", () => {
    expect(titlePlace({ ...phone, wantPx: 12, floorPx: 14.6, quads: [card(0, 400, 390, 600)] }).px).toBe(12);
  });
});

describe("version G on a phone, in place under the page title", () => {
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
    expect(at.px).toBeCloseTo((592 - 552 - 6) / 1.1, 5);
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
});

describe("version G in the column, from 768 px wide", () => {
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
    expect(32 + 10.1 * at.px).toBeLessThanOrEqual(300 - COIL.deal.prompt.title.cardGapPx + 0.01);
    expect(32 + 10.1 * at.px).toBeGreaterThan(300 - COIL.deal.prompt.title.cardGapPx - 1);
  });
  it("keeps the line's own size when even that would meet a card", () => {
    expect(titleInPlace({ ...base, quads: [card(100, 600, 400, 700)] }).px).toBe(12.72);
  });
});

describe("G's place in the plan", () => {
  it("comes from the knob, and the debug override wins", () => {
    expect(promptPlan({ ...DEFAULT_KNOBS, promptVersion: "title" }).titlePlace).toBe("column");
    expect(promptPlan({ ...DEFAULT_KNOBS, promptVersion: "title", promptTitlePlace: "bare" }).titlePlace).toBe("bare");
    expect(promptPlan({ ...DEFAULT_KNOBS, promptVersion: "title", promptTitlePlace: "bare" }, { place: "column" }).titlePlace).toBe("column");
  });
});

describe("G's columns wait for the line", () => {
  it("brings the columns in half way through the line's shrink when G holds (3,610 ms today, not the deal's own 2,140)", () => {
    const g = plan({ promptVersion: "title" });
    expect(g.mode).toBe("hold");
    expect(g.columnsAtMs).toBe(3610);
    expect(g.columnsAtMs).toBe((g.shrinkStartMs + g.shrinkEndMs) / 2);
    // After the line has been read, before it has landed.
    expect(g.columnsAtMs).toBeGreaterThan(g.shrinkStartMs);
    expect(g.columnsAtMs).toBeLessThan(g.shrinkEndMs);
  });
  it("follows the line: a longer time alone brings them later, a start knob moves them with it", () => {
    expect(plan({ promptVersion: "title", promptAloneMs: 1000 }).columnsAtMs).toBe(4010);
    expect(plan({ promptVersion: "title", promptHoldStartMs: 100 }).columnsAtMs).toBe(3710);
  });
  it("reads the line alone for 600 ms, on its own knob: the lists start 0.4 s sooner than on the 1,000 ms hold", () => {
    const g = plan({ promptVersion: "title" });
    expect(g).toMatchObject({ startMs: 2640, shownMs: 2840, shrinkStartMs: 3440, shrinkEndMs: 3780, endMs: 3920, lockUntilMs: 3920 });
    // The readable hold's slider and its 900 ms floor belong to a line read over the lists: they do not move line first.
    expect(plan({ promptVersion: "title", promptHoldMs: 2000 }).shrinkStartMs).toBe(3440);
    expect(plan({ promptVersion: "title", promptAloneMs: 300 }).shrinkStartMs).toBe(3140);
    // Columns first keeps the hold it had.
    expect(plan({ promptVersion: "title", promptMode: "after" })).toMatchObject({ shrinkStartMs: 3840, endMs: 4320 });
    expect(plan({ promptVersion: "title", promptMode: "after", promptAloneMs: 300 }).shrinkStartMs).toBe(3840);
  });
  it("leaves the columns to the deal's own time when G plays After, and for every other version", () => {
    expect(plan({ promptVersion: "title", promptMode: "after" }).columnsAtMs).toBeNull();
    for (const version of ["plate", "calm", "outline", "spotlight", "quiet", "lit"] as const) {
      for (const mode of PROMPT_MODES) expect(plan({ promptVersion: version, promptMode: mode }).columnsAtMs, `${version} ${mode}`).toBeNull();
    }
  });
});
