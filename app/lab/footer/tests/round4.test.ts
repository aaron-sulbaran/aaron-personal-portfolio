import { describe, expect, it } from "vitest";
import { COMPOSITE_FRAG, NAME_SURFACE, SURFACE_FRAG } from "@/lib/coil/field.glsl";
import { buildConstructed, glyphPose, glyphWidth } from "../constructed";
import {
  FIELD_RING_WIDTH,
  MAX_HOP_DELAY_MS,
  REDUCED_TURN_MS,
  REST_POSE,
  RIPPLE_WIDTH,
  SETTLE_MS,
  createEggState,
  eggPhases,
  eggPose,
  eggPoseAt,
  eggTotalMs,
  letterDip,
  maxHop,
  restAngle,
  rippleLifeMs,
  ringDip,
  stepEgg,
  triggerEgg,
  type EggContext,
} from "../egg";
import { fieldDepths } from "../fieldDepths";
import { FIT_SHARE } from "../FooterStage";
import { HERO_LOCKUP, adaptCompositeFrag, adaptSurfaceFrag, heroFrame, surfaceClock, surfaceExtent, surfaceTargetSize } from "../heroField";
import { pathInk, pathRow } from "../pathFace";
import { bounds } from "../primitives";
import { DEFAULT_SETTINGS, PRESETS } from "../settings";
import { POSTER_CROP, posterBox } from "../standIn";
import { nameTokens } from "../tokens";
import { eggTransform, letterTransform, periodBox } from "../wordFrame";

// Aaron's copied values of 2026-10-09 (his round 3 pick), less the export's
// own keys (drawnWith, theme, backdrop).
const AARON_PICK = {
  face: "constructed",
  weight: 0.2,
  heightVw: 14.5,
  tracking: 0,
  caps: "round",
  join: "round",
  corners: 0,
  constructed: { stem: 0.235, bar: 0.18, roundness: 0.45, gap: 0.095 },
  aperture: { on: false, blades: 4, scale: 1.3, gap: 0.08, ease: 0.12 },
  ink: "accent",
  inkFade: 0,
  floor: 0,
  gap: 0.35,
  swellRadius: 1.8,
  swellAmount: 0.06,
  swellEaseS: 0.14,
  reflow: true,
  pressDepth: 0.32,
  pressStiffness: 380,
  pressDamping: 0.42,
  riseMs: 1000,
  riseStaggerMs: 0,
  riseEase: "expo",
  response: "swell",
  leanDeg: 7,
  grow: 0.12,
  slice: { shift: 0.08, stiffness: 320, damping: 0.42 },
  field: { on: true, intensity: 1.2, letterIntensity: 1.8, ending: "clip", fade: 1.6, fadeIn: 0.3, drift: "calm", flip: false, letterTint: 0.2 },
  connect: "above",
  disc: { on: false, lean: 24 },
} as const;

const E = DEFAULT_SETTINGS.egg;
const EPS = 1e-9;

describe("the round 4 preset", () => {
  const round4 = PRESETS[0];

  it("is first, new and the default, with Aaron's values exactly", () => {
    expect(round4.id).toBe("round4");
    expect(round4.name).toBe("Round 4, Aaron's pick");
    expect(round4.tag).toBe("new");
    expect(round4.settings).toBe(DEFAULT_SETTINGS);
    expect(round4.settings).toMatchObject(AARON_PICK);
    expect(PRESETS.map((p) => p.id)).toEqual(["round4", "round3", "round2", "designer", "bare", "zephyr", "profa"]);
  });

  it("adds the hero's field with the name's surface in the letters, and the egg; every earlier preset keeps the footer field", () => {
    expect(round4.settings.field.backdrop).toBe("hero");
    expect(round4.settings.field.nameSurface).toBe(true);
    expect(round4.settings.egg).toEqual({
      trigger: "period",
      anticipationMs: 110,
      hop: 0.42,
      airMs: 520,
      turnDeg: 90,
      overshootDeg: 7,
      squash: 0.28,
      shadow: 0.34,
      rippleSpeed: 5,
      rippleLetters: 0.3,
      rippleField: 0.22,
      rippleDecay: 1.2,
    });
    for (const p of PRESETS.slice(1)) {
      expect(p.settings.field.backdrop, p.id).toBe("footer");
      expect(p.settings.field.nameSurface, p.id).toBe(false);
    }
  });

  it("keeps Aaron's face whole: every glyph inside its box, nothing under the baseline, at rest and at the heaviest swell and press", () => {
    const s = DEFAULT_SETTINGS;
    for (const [swell, squash] of [
      [0, 1],
      [1, 1],
      [1, 1 - s.pressDepth],
    ]) {
      const pose = glyphPose(s.constructed, s.swellAmount, swell, squash);
      for (const char of "build.stuf") {
        const b = bounds(buildConstructed(char, pose).contours);
        expect(b.x0, char).toBeGreaterThanOrEqual(-EPS);
        expect(b.x1, char).toBeLessThanOrEqual(glyphWidth(char, pose, null) + EPS);
        expect(b.y0, char).toBeGreaterThanOrEqual(-EPS);
      }
    }
    expect(pathInk("constructed", "build.stuff", s, true)).toEqual({ top: 1, bottom: 0 });
    // At 14.5 percent of the width the word would span 98 percent; the stage
    // holds it to FIT_SHARE, so no swell pushes a letter off the edge.
    expect(pathRow("constructed", "build.stuff", s.heightVw / 100, s).width).toBeGreaterThan(FIT_SHARE);
  });
});

describe("the period's hop", () => {
  it("lasts the anticipation, the airtime and the settle, and rests at both ends", () => {
    expect(eggTotalMs(E)).toBe(E.anticipationMs + E.airMs + SETTLE_MS);
    expect(eggTotalMs(E)).toBe(1050);
    expect(eggPose(0, E)).toBe(REST_POSE);
    expect(eggPose(-5, E)).toBe(REST_POSE);
    expect(eggPose(eggTotalMs(E), E)).toBe(REST_POSE);
    expect(eggPose(5000, E)).toBe(REST_POSE);
  });

  it("squashes before takeoff by the squash, flat on the ground", () => {
    const deepest = eggPose(0.7 * E.anticipationMs, E);
    expect(deepest.lift).toBe(0);
    expect(deepest.angle).toBe(0);
    expect(deepest.sy).toBeCloseTo(1 - E.squash, 9);
    expect(deepest.sx).toBeGreaterThan(1);
  });

  it("peaks at the apex, half turned there and turning fastest, the shadow smallest", () => {
    const { takeoff, landing } = eggPhases(E);
    const apexMs = (takeoff + landing) / 2;
    const apex = eggPose(apexMs, E);
    expect(apex.lift).toBeCloseTo(E.hop, 9);
    expect(apex.angle).toBeCloseTo((E.turnDeg + E.overshootDeg) / 2, 9);
    const rate = (t: number) => eggPose(t + 1, E).angle - eggPose(t - 1, E).angle;
    for (const t of [takeoff + 60, takeoff + 150, landing - 150, landing - 60]) expect(rate(apexMs)).toBeGreaterThan(rate(t));
    for (const t of [takeoff + 60, landing - 60]) {
      expect(eggPose(t, E).lift).toBeLessThan(apex.lift);
      expect(eggPose(t, E).shadowScale).toBeGreaterThan(apex.shadowScale);
    }
    expect(apex.shadow).toBeGreaterThan(0.3);
  });

  it("lands past the turn, squashes, and settles on the quarter turn", () => {
    const { landing, end } = eggPhases(E);
    expect(eggPose(landing - 1, E).angle).toBeGreaterThan(E.turnDeg + E.overshootDeg - 0.1);
    const impact = eggPose(landing + 50, E);
    expect(impact.sy).toBeCloseTo(1 - E.squash, 9);
    expect(impact.lift).toBe(0);
    const late = eggPose(end - 1, E);
    expect(Math.abs(late.angle - 90)).toBeLessThan(0.5);
    expect(Math.abs(late.sy - 1)).toBeLessThan(0.01);
    expect(restAngle(90)).toBe(90);
    expect(restAngle(40)).toBe(0);
    expect(restAngle(140)).toBe(180);
  });

  it("only turns in place under reduced motion", () => {
    for (let t = 1; t < REDUCED_TURN_MS; t += 20) {
      const p = eggPose(t, E, true);
      expect(p.lift).toBe(0);
      expect(p.sx).toBe(1);
      expect(p.sy).toBe(1);
      expect(p.shadow).toBe(0);
    }
    expect(eggPose(REDUCED_TURN_MS / 2, E, true).angle).toBeCloseTo(45, 9);
    expect(eggPose(REDUCED_TURN_MS, E, true)).toBe(REST_POSE);
  });

  it("holds the turned square under the word's top", () => {
    const side = 0.235 + 0.06;
    const cap = maxHop(1, side);
    expect(cap + side * Math.SQRT2).toBeLessThanOrEqual(1 - 0.02 + EPS);
    expect(E.hop).toBeLessThan(cap);
  });
});

describe("the period's transform", () => {
  const f = { lean: 0, grow: 1, squash: 1 };

  it("writes the rounds' own string at rest, so a period back at rest is exactly where it began", () => {
    expect(letterTransform(100, 200, 12, f)).toBe("translate(112.00 200.00) rotate(0.000) scale(1.0000 1.0000) translate(-12.00 0)");
  });

  it("turns about the period's center and lifts a turned square onto its corner", () => {
    const box = periodBox(185, 200, 15); // a 30px square sitting on the baseline at 200
    expect(box).toEqual({ cy: -15, bottomY: 0, side: 30 });
    const t = eggTransform({ ...REST_POSE, angle: 45 }, box, 100, DEFAULT_SETTINGS, 1, true);
    expect(t.liftPx).toBeCloseTo(15 * (Math.SQRT2 - 1), 9);
    expect(t.cy).toBe(-15);
    const square = eggTransform({ ...REST_POSE, angle: 90 }, box, 100, DEFAULT_SETTINGS, 1, true);
    expect(square.liftPx).toBeCloseTo(0, 9);
    expect(letterTransform(100, 200, 15, f, t)).toContain("rotate(45.000 0 -15.00)");
  });
});

describe("the ripple", () => {
  it("dents most at its wavefront, less as it fades", () => {
    const t = 0.4;
    const front = E.rippleSpeed * t;
    expect(ringDip(front, t, E)).toBeCloseTo(E.rippleLetters * Math.exp(-E.rippleDecay * t), 9);
    expect(ringDip(front + RIPPLE_WIDTH, t, E)).toBeLessThan(ringDip(front, t, E));
    expect(ringDip(front - RIPPLE_WIDTH, t, E)).toBeLessThan(ringDip(front, t, E));
    expect(ringDip(E.rippleSpeed * 0.8, 0.8, E)).toBeLessThan(ringDip(front, t, E));
    expect(ringDip(1, -0.1, E)).toBe(0);
    expect(FIELD_RING_WIDTH).toBeLessThan(RIPPLE_WIDTH);
  });

  it("reaches the nearest letters first", () => {
    const ripples = [{ x: 0, y: 0, t0: 0 }];
    const unit = 100;
    const at = (x: number, ms: number) => letterDip(x, 0, ripples, ms, unit, E);
    const firstDent = (x: number) => {
      for (let ms = 0; ms < 3000; ms += 5) if (at(x, ms) > 0.1) return ms;
      return Infinity;
    };
    expect(firstDent(50)).toBeLessThan(firstDent(150));
    expect(firstDent(150)).toBeLessThan(firstDent(300));
    expect(at(0, 0)).toBeLessThanOrEqual(0.9);
  });

  it("lives until it fades or has passed the far corner, the sooner", () => {
    expect(rippleLifeMs(E, 0.5)).toBeCloseTo((1000 * (0.5 + 2 * RIPPLE_WIDTH)) / E.rippleSpeed, 9);
    expect(rippleLifeMs({ ...E, rippleDecay: 6 }, 100)).toBeCloseTo((1000 * Math.log(200)) / 6, 9);
  });
});

describe("the queue", () => {
  const ctx: EggContext = { e: E, reduced: false, landing: { x: 500, y: 300 }, unitPx: 100 };
  const life = 5000;

  it("runs one egg, queues one more, drops the third, and starts the queued one when the first ends", () => {
    const s = createEggState();
    triggerEgg(s, { kind: "period" }, 0, ctx);
    triggerEgg(s, { kind: "period" }, 10, ctx);
    triggerEgg(s, { kind: "period" }, 20, ctx);
    expect(s.queued).toEqual({ kind: "period" });
    stepEgg(s, eggTotalMs(E), ctx, life);
    expect(s.run).not.toBeNull();
    expect(s.queued).toBeNull();
    stepEgg(s, 2 * eggTotalMs(E), ctx, life);
    expect(s.run).toBeNull();
    expect(eggPoseAt(s, 2 * eggTotalMs(E) + 300, E)).toBe(REST_POSE);
  });

  it("launches its ripple at the landing, from where the period lands", () => {
    const s = createEggState();
    s.pending.push({ kind: "period" });
    stepEgg(s, 1000, ctx, life);
    expect(s.ripples).toHaveLength(0);
    stepEgg(s, 1000 + eggPhases(E).landing + 5, ctx, life);
    expect(s.ripples).toEqual([{ x: 500, y: 300, t0: 1000 + eggPhases(E).landing }]);
    stepEgg(s, 1000 + eggPhases(E).landing + life + 1, ctx, life);
    expect(s.ripples).toHaveLength(0);
  });

  it("anywhere: ripples from the click at once, and hops when the ring reaches the period", () => {
    const s = createEggState();
    triggerEgg(s, { kind: "point", x: 300, y: 300 }, 0, ctx);
    expect(s.ripples).toEqual([{ x: 300, y: 300, t0: 0 }]);
    const delay = (1000 * 2) / E.rippleSpeed; // two units away
    expect(eggPoseAt(s, delay - 1, E)).toBe(REST_POSE);
    expect(eggPoseAt(s, delay + 30, E)).not.toBe(REST_POSE);
    const far = createEggState();
    triggerEgg(far, { kind: "point", x: -100000, y: 300 }, 0, ctx);
    expect(eggPoseAt(far, MAX_HOP_DELAY_MS + 30, E)).not.toBe(REST_POSE);
  });

  it("makes no ripple under reduced motion", () => {
    const s = createEggState();
    const still = { ...ctx, reduced: true };
    triggerEgg(s, { kind: "point", x: 300, y: 300 }, 0, still);
    stepEgg(s, 100, still, life);
    expect(s.ripples).toHaveLength(0);
    expect(eggPoseAt(s, 100, E).lift).toBe(0);
  });
});

describe("the hero's field and name, ported", () => {
  it("moves the hero's surface to GLSL ES 3.00 unchanged otherwise", () => {
    const src = adaptSurfaceFrag(SURFACE_FRAG);
    expect(src.startsWith("#version 300 es\n")).toBe(true);
    expect(src).toContain("#define texture2D texture");
    expect(src).toContain("in vec2 vUv;");
    expect(src).not.toMatch(/\bvarying\b|gl_FragColor/);
    expect(src).toContain(SURFACE_FRAG.slice(SURFACE_FRAG.indexOf("vec2 toPlane"), SURFACE_FRAG.indexOf("gl_FragColor")));
    expect(() => adaptSurfaceFrag("void main() {}")).toThrow();
  });

  it("keeps the hero's composite up to its main, the name's letters included, with the footer's main", () => {
    const src = adaptCompositeFrag(COMPOSITE_FRAG);
    expect(src).toContain(COMPOSITE_FRAG.slice(0, COMPOSITE_FRAG.indexOf("void main()")));
    expect(src.match(/void main\(\)/g)).toHaveLength(1);
    expect(src).toContain("nameLetters(deep, (px - uRect.xy) / uRect.zw, 0.0)");
    expect(src).toContain("(h12(gl_FragCoord.xy) - 0.5) / 255.0");
    expect(src).not.toContain("gl_FragColor");
    expect(() => adaptCompositeFrag("void main() {}")).toThrow();
  });

  it("frames the field as the hero does, the word's middle where the hero's name sits", () => {
    const f = heroFrame(1440, 400, 900, 300);
    expect(f.aspect).toBeCloseTo(1.6, 12);
    expect(f.frameY).toBeCloseTo(400 / 900, 12);
    // uv.y = frameY0 + v * frameY, v from the canvas's bottom: the word's middle (100px up) lands on 0.5.
    expect(f.frameY0 + (100 / 400) * f.frameY).toBeCloseTo(0.5, 12);
    expect(heroFrame(390, 300, 844).narrow).toBe(true);
  });

  it("keeps the hero's surface folds the hero's size in px", () => {
    const [, ey] = surfaceExtent(1000, 200, 1440, 900);
    expect((2 * ey) / 200).toBeCloseTo(NAME_SURFACE.viewHeight / (HERO_LOCKUP.heightPerWidth.wide * 1440), 12);
    const [, narrow] = surfaceExtent(380, 60, 390, 844);
    expect((2 * narrow) / 60).toBeCloseTo(NAME_SURFACE.viewHeight / (HERO_LOCKUP.heightPerWidth.narrow * 390), 12);
    expect(surfaceTargetSize(1000, 200, 1)).toEqual([500, 100]);
    expect(surfaceTargetSize(4000, 400, 2)[0]).toBe(NAME_SURFACE.rtMaxWidth);
    expect(surfaceClock(0).t).toBe(NAME_SURFACE.start);
    expect(surfaceClock(10).t).toBeCloseTo(NAME_SURFACE.start + 10 * NAME_SURFACE.speed, 12);
  });

  it("reads the hero name's tokens, the ink a number", () => {
    const tokens: Record<string, string> = { "--name-ink": " 0.14", "--name-surface-1": "#9CC0DC", "--name-surface-mean": "#80A2BF" };
    const n = nameTokens((name) => tokens[name] ?? "", [0, 0, 0]);
    expect(n.ink).toBe(0.14);
    expect(n.c1).toEqual([0x9c / 255, 0xc0 / 255, 0xdc / 255]);
    expect(n.c2).toEqual([0, 0, 0]);
    expect(nameTokens(() => "", [1, 1, 1]).ink).toBe(0.12);
  });

  it("draws each depth itself, so the stage neither holds a share of the canvas nor veils the letters", () => {
    expect(fieldDepths(DEFAULT_SETTINGS.field, true)).toEqual({ canvas: 1.2, backdropShare: 1, letterVeil: 0 });
    expect(fieldDepths(DEFAULT_SETTINGS.field).canvas).toBe(1.8);
  });

  it("frames the poster stand-in the way the live field is framed", () => {
    const hero = posterBox("hero", 480, 128, 1440, 900, 404, 100);
    expect(hero.y + hero.h / 2).toBeCloseTo(100, 9);
    expect(hero.crop).toBe(1);
    expect(hero.w).toBeGreaterThanOrEqual(480);
    expect(hero.h).toBeGreaterThanOrEqual(404 - EPS);
    expect(posterBox("footer", 480, 258, 1440, 900, 404, 100)).toEqual({ x: 0, y: 0, w: 480, h: 258, crop: POSTER_CROP });
  });
});
