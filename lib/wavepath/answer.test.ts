import { describe, expect, it } from "vitest";
import type { SoundtrackState } from "@/lib/soundtrack";
import { pressOf, swells } from "./answer";
import { RIPPLE, SWELL } from "./constants";
import { createRipple, rippleAt, rippleHeight, rippleSwell, startRipple, stepRipple } from "./ripple";

const STATES: SoundtrackState[] = ["before", "on", "paused", "off"];

describe("which changes of the soundtrack are a press", () => {
  it("reads a live Not now as a decline, from an unanswered band or a stored yes that restored as paused", () => {
    expect(pressOf("before", "off", null)).toBe("decline");
    expect(pressOf("paused", "off", "paused")).toBe("decline");
    expect(pressOf("paused", "off", null)).toBe("decline");
    expect(pressOf("on", "off", null)).toBe("decline");
  });

  it("does not read a stored Not now restoring as a press: the band opens already answered", () => {
    expect(pressOf("before", "off", "off")).toBeNull();
  });

  it("reads Play it as a play, before an answer or after a Not now, and a restore as nothing", () => {
    expect(pressOf("before", "on", null)).toBe("play");
    expect(pressOf("off", "on", null)).toBe("play");
    expect(pressOf("off", "on", "off")).toBe("play");
    expect(pressOf("before", "paused", "paused")).toBeNull();
  });

  it("reads a pause and a resume as nothing", () => {
    expect(pressOf("on", "paused", null)).toBeNull();
    expect(pressOf("paused", "on", null)).toBeNull();
  });

  it("reads no change as nothing", () => {
    for (const s of STATES) expect(pressOf(s, s, null)).toBeNull();
  });

  it("only ever answers a move into off with a decline and a move into on with a play", () => {
    for (const from of STATES) for (const restored of [null, ...STATES] as const) {
      expect([null, "decline"]).toContain(pressOf(from, "off", restored));
      expect([null, "play"]).toContain(pressOf(from, "on", restored));
      expect(pressOf(from, "paused", restored)).toBeNull();
      expect(pressOf(from, "before", restored)).toBeNull();
    }
  });
});

describe("the swell trigger", () => {
  it("sends the swell for a Not now, and for nothing else", () => {
    expect(swells("decline", false, false)).toBe(true);
    expect(swells("play", false, false)).toBe(false);
    expect(swells(null, false, false)).toBe(false);
  });

  it("sends none under reduced motion, where the chosen state alone answers, or while the wave is frozen", () => {
    expect(swells("decline", true, false)).toBe(false);
    expect(swells("decline", false, true)).toBe(false);
  });
});

describe("the swell", () => {
  const run = (r: ReturnType<typeof createRipple>) => {
    let t = 0;
    while (stepRipple(r, 1 / 60)) t += 1 / 60;
    return t;
  };

  it("is a gentler shape of the answer's ripple: lower, lighter and broader", () => {
    expect(SWELL.amp).toBeLessThan(RIPPLE.amp);
    expect(SWELL.swell).toBeLessThan(RIPPLE.swell);
    expect(SWELL.width).toBeGreaterThan(RIPPLE.width);
    // The dots' room (lib/wavepath/fit) is sized for the ripple's crest: the swell's must fit inside it.
    expect(SWELL.amp * (1 + SWELL.swell)).toBeLessThan(RIPPLE.amp * (1 + RIPPLE.swell));
  });

  it("starts at the buttons at the swell's height, not the ripple's", () => {
    const r = createRipple();
    startRipple(r, 600, "swell");
    expect(rippleAt(r, 600)).toBeCloseTo(SWELL.amp, 9);
    expect(rippleSwell(r, 600)).toBeCloseTo(SWELL.swell, 9);
    expect(rippleHeight(r)).toBeCloseTo(SWELL.amp, 9);
    startRipple(r, 600);
    expect(rippleHeight(r)).toBeCloseTo(RIPPLE.amp, 9);
  });

  it("rolls out both ways at its speed and is gone in about a second", () => {
    const r = createRipple();
    startRipple(r, 1000, "swell");
    stepRipple(r, 0.25);
    const height = SWELL.amp * Math.exp(-SWELL.decay * 0.25);
    expect(rippleAt(r, 1000 + SWELL.speed * 0.25)).toBeCloseTo(height, 9);
    expect(rippleAt(r, 1000 - SWELL.speed * 0.25)).toBeCloseTo(height, 9);
    const seconds = 0.25 + run(r);
    expect(seconds).toBeGreaterThanOrEqual(0.8);
    expect(seconds).toBeLessThanOrEqual(1.5);
    expect(r.live).toBe(false);
    expect(rippleHeight(r)).toBe(0);
  });

  it("is one crest with no trough, like the ripple", () => {
    const r = createRipple();
    startRipple(r, 0, "swell");
    stepRipple(r, 0.3);
    for (let s = -1500; s <= 1500; s += 7) expect(rippleAt(r, s)).toBeGreaterThanOrEqual(0);
  });

  it("is a ripple by default, so a yes keeps its own", () => {
    expect(createRipple().kind).toBe("answer");
    const r = createRipple();
    startRipple(r, 0, "swell");
    startRipple(r, 0);
    expect(r.kind).toBe("answer");
  });
});
