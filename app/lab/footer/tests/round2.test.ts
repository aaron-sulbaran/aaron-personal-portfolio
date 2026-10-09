import { describe, expect, it } from "vitest";
import { fieldDepths } from "../fieldDepths";
import { bowlPoint, glyphPaths } from "../glyphs";
import { DEFAULT_SETTINGS, PRESETS } from "../settings";
import { axesFrom, axesQuery, cssUrl, fontPose, fontQueryParams, fontsourceId, parseFamilyName, poseAt, variationSettings, type WebFontInfo } from "../webFont";
import { FIT_SHARE } from "../FooterStage";
import { BAND, croppedShare, layoutWord, proceduralInk, typesetInk, typesetRow, wordBand } from "../wordLayout";

const AARON_ROUND1 = {
  face: "procedural", weight: 0.2, heightVw: 12.5, tracking: 0, caps: "round", ink: "accent", inkFade: 0, gap: 0.35,
  swellRadius: 1.8, swellAmount: 0.06, swellEaseS: 0.14, reflow: true, pressDepth: 0.32, pressStiffness: 380, pressDamping: 0.42,
  riseMs: 1000, riseEase: "expo", leanDeg: 7, grow: 0.12, connect: "above",
} as const;

// Round 4 is the default now; round 2 stays, third.
const ROUND2 = PRESETS.find((p) => p.id === "round2")!.settings;

describe("the round 2 preset", () => {
  it("is third, and keeps his round 1 values where his notes kept them", () => {
    expect(PRESETS[2].settings).toBe(ROUND2);
    expect(PRESETS[2].name).toBe("Round 2, designer field with Zephyr weight");
    expect(PRESETS[2].tag).toBeUndefined();
    expect(ROUND2).toMatchObject(AARON_ROUND1);
  });

  it("rises as one, whole, with the letters deeper than the field behind them", () => {
    const s = ROUND2;
    expect(s.riseStaggerMs).toBe(0);
    expect(s.floor).toBe(0);
    expect(s.response).not.toBe("lean");
    expect(s.field.ending).toBe("clip");
    expect(s.field.letterIntensity).toBe(1.8);
    expect(s.field.intensity).toBeLessThanOrEqual(1.35);
  });

  it("fits under the wide-face cap at its own height, so the cap never moves it", () => {
    const s = ROUND2;
    const span = layoutWord("build.stuff", s.heightVw / 100, [s.weight], s.tracking).width;
    expect(span).toBeGreaterThan(0.85);
    expect(span).toBeLessThan(FIT_SHARE);
  });

  it("leaves no preset with a stagger or a crop, and keeps every round 1 preset selectable", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["round4", "round3", "round2", "designer", "bare", "zephyr", "profa"]);
    for (const p of PRESETS) {
      expect(p.settings.riseStaggerMs, p.id).toBe(0);
      expect(p.settings.floor, p.id).toBe(0);
    }
  });
});

describe("the ink and the band", () => {
  it("reaches half the swollen stroke past the skeleton for build.stuff", () => {
    const ink = proceduralInk("build.stuff", 0.2, 0.06);
    expect(ink.top).toBeCloseTo(1.13, 12);
    expect(ink.bottom).toBeCloseTo(0.13, 12);
  });

  it("rests the word whole at floor 0, its tallest swell a clearance above the edge", () => {
    const ink = proceduralInk("build.stuff", 0.2, 0.06);
    const band = wordBand(134, ink, proceduralInk("build.stuff", 0.2, 0), 0, 0.35);
    expect(band.baselineFromBottom - ink.bottom * 134).toBeCloseTo(BAND.bottomClear * 134, 9);
    expect(croppedShare(ink, proceduralInk("build.stuff", 0.2, 0), 0)).toBe(0);
  });

  it("crops exactly 30 percent of the resting ink's height at the floor's top, linearly and without a jump", () => {
    const ink = proceduralInk("build.stuff", 0.2, 0.06);
    const rest = proceduralInk("build.stuff", 0.2, 0);
    expect(croppedShare(ink, rest, BAND.floorMax)).toBeCloseTo(0.3, 12);
    // The edge sits 30 percent of the resting height above the resting ink's bottom.
    const band = wordBand(100, ink, rest, BAND.floorMax, 0.35);
    expect(rest.bottom * 100 - band.baselineFromBottom).toBeCloseTo(0.3 * (rest.top + rest.bottom) * 100, 9);
    const at = (f: number) => wordBand(100, ink, rest, f, 0.35).baselineFromBottom;
    expect(at(0) - at(0.01)).toBeCloseTo(at(0.2) - at(0.21), 9);
    let last = croppedShare(ink, rest, 0);
    for (let f = 0; f <= 0.3; f += 0.01) {
      const c = croppedShare(ink, rest, f);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });

  const m = { ascent: 0.7, starts: [0, 0.6, 1.1], advances: [0.62, 0.5, 0.4], heavyAdvances: [0.7, 0.58, 0.45], inkTops: [0.72, 0.7, 0.5], inkBottoms: [0.01, 0.0, 0.012] };

  it("measures a typeset face's ink in its ascent, with the lean's dip and the grow", () => {
    const still = typesetInk(m, { leanDeg: 0, grow: 0 });
    expect(still.top).toBeCloseTo(0.72 / 0.7, 12);
    expect(still.bottom).toBeCloseTo(0.012 / 0.7, 12);
    expect(typesetInk(m, { leanDeg: 7, grow: 0 }).bottom).toBeGreaterThan(still.bottom);
    expect(typesetInk(m, { leanDeg: 0, grow: 0.12 }).top).toBeCloseTo(still.top * 1.12, 12);
  });

  it("lays a typeset row on its kerned starts, and widens it by each letter's swell share", () => {
    const rest = typesetRow(m, 100, 2);
    // starts times the size, plus the tracking once per letter before it
    [0, 62, 114].forEach((x, i) => expect(rest.xs[i]).toBeCloseTo(x, 9));
    expect(rest.width).toBeCloseTo(114 + 40, 9);
    const swollen = typesetRow(m, 100, 2, [1, 0, 0]);
    expect(swollen.xs[1] - rest.xs[1]).toBeCloseTo(8, 9);
    expect(swollen.width - rest.width).toBeCloseTo(8, 9);
  });
});

describe("the procedural face's sharper options", () => {
  it("draws a round bowl at 0 and keeps the circle's extremes when squared", () => {
    expect(bowlPoint(0.3, 0.3, 0.3, 45, 0)).toEqual([0.3 + 0.3 * Math.cos(Math.PI / 4), 0.3 + 0.3 * Math.sin(Math.PI / 4)]);
    for (const deg of [0, 90, 180, 270]) {
      const [x, y] = bowlPoint(0, 0, 1, deg, 1);
      expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
    }
    const [x, y] = bowlPoint(0, 0, 1, 45, 1);
    expect(Math.hypot(x, y)).toBeGreaterThan(1.2);
  });

  it("writes squared bowls as finite polylines with no arcs", () => {
    for (const c of "build.stuff") {
      const { d } = glyphPaths(c, 120, 0.8);
      expect(d, c).not.toMatch(/NaN|Infinity|A/);
    }
  });
});

describe("the web font face", () => {
  const hubot: WebFontInfo = { family: '"Hubot Sans"', axes: { wght: [200, 900], wdth: [75, 125] }, weights: [] };

  it("asks Google for the axes in the API's order", () => {
    expect(axesQuery({ ROND: [0, 100], wght: [1, 1000], wdth: [25, 151] })).toBe("wdth,wght,ROND@25..151,1..1000,0..100");
    expect(cssUrl("Google Sans Flex", "wght@900")).toBe("https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@900&display=block");
    expect(fontsourceId("  Hubot   Sans ")).toBe("hubot-sans");
    expect(fontQueryParams("?font=Geist&font=Hubot+Sans&x=1")).toEqual(["Geist", "Hubot Sans"]);
    expect(parseFamilyName("@font-face {\n  font-family: 'Hubot Sans';\n")).toBe("Hubot Sans");
  });

  it("keeps only the axes it moves, each a real range", () => {
    const meta = { axes: { ital: { min: 0, max: 1 }, opsz: { min: 6, max: 144 }, wdth: { min: 25, max: 151 }, wght: { min: 1, max: 1000 }, ROND: { min: 0, max: 100 }, GRAD: { min: 0, max: 100 } } };
    expect(axesFrom(meta)).toEqual({ wdth: [25, 151], wght: [1, 1000], ROND: [0, 100] });
    expect(axesFrom(null)).toEqual({});
  });

  it("clamps the pose into the axes and swells through them, resting under a ceiling to keep the swell", () => {
    const capped = fontPose(hubot, { weight: 900, width: 100, round: 0, swell: 50, widthSwell: 0 });
    expect(capped.rest.wght).toBe(850);
    expect(capped.heavy.wght).toBe(900);
    const pose = fontPose(hubot, { weight: 840, width: 120, round: 0, swell: 50, widthSwell: 17 });
    expect(pose.rest).toEqual({ wght: 840, wdth: 120 });
    expect(pose.heavy).toEqual({ wght: 890, wdth: 125 });
    expect(pose.canSwell).toBe(true);
    expect(variationSettings(poseAt(pose.rest, pose.heavy, 0.5))).toBe('"wdth" 122.5, "wght" 865');
    expect(variationSettings({})).toBe("normal");
  });

  it("rests a static family at its nearest weight, unable to swell", () => {
    const pose = fontPose({ family: '"Archivo Black"', axes: {}, weights: [400] }, { weight: 850, width: 110, round: 0, swell: 50, widthSwell: 15 });
    expect(pose.cssWeight).toBe(400);
    expect(pose.canSwell).toBe(false);
  });

  it("holds the roundness axis where it is set, at both ends of the swell", () => {
    const flex: WebFontInfo = { family: '"Google Sans Flex"', axes: { wght: [1, 1000], ROND: [0, 100] }, weights: [] };
    const pose = fontPose(flex, { weight: 850, width: 100, round: 0, swell: 60, widthSwell: 0 });
    expect(pose.rest.ROND).toBe(0);
    expect(pose.heavy.ROND).toBe(0);
  });
});

describe("the field's two depths", () => {
  const base = DEFAULT_SETTINGS.field;

  it("renders the deeper depth and holds the footer's share of it", () => {
    const d = fieldDepths({ ...base, intensity: 1.2, letterIntensity: 1.8 });
    expect(d.canvas).toBe(1.8);
    expect(d.backdropShare).toBeCloseTo(1.2 / 1.8, 12);
    expect(d.letterVeil).toBe(0);
  });

  it("veils the letters when they are the shallower, and ignores them outside clip", () => {
    const veiled = fieldDepths({ ...base, intensity: 1.6, letterIntensity: 0.8 });
    expect(veiled.canvas).toBe(1.6);
    expect(veiled.letterVeil).toBeCloseTo(0.5, 12);
    const under = fieldDepths({ ...base, ending: "under", intensity: 1.35, letterIntensity: 2 });
    expect(under).toEqual({ canvas: 1.35, backdropShare: 1, letterVeil: 0 });
  });
});
