import { describe, expect, it } from "vitest";
import { createRepaintQueue, parseColor, parseScalar, themeFromTokens, toCanvasColor } from "@/lib/coil/theme";
import { FIELD } from "@/lib/coil/field.glsl";

describe("parseColor", () => {
  it("reads 6-digit hex, either case", () => {
    expect(parseColor("#C0D5E8")).toEqual({ r: 0xc0 / 255, g: 0xd5 / 255, b: 0xe8 / 255, a: 1 });
    expect(parseColor(" #c0d5e8 ")).toEqual(parseColor("#C0D5E8"));
  });

  it("reads the minified 8-digit hex a production build emits for rgba tokens", () => {
    const c = parseColor("#0a0a0a2e");
    expect(c?.r).toBeCloseTo(10 / 255);
    expect(c?.a).toBeCloseTo(0x2e / 255);
  });

  it("reads rgba() as the dev server returns it", () => {
    const c = parseColor("rgba(10, 10, 10, 0.18)");
    expect(c?.r).toBeCloseTo(10 / 255);
    expect(c?.a).toBeCloseTo(0.18);
    expect(parseColor("rgb(250 250 247)")?.a).toBe(1);
  });

  it("reads 3-digit hex", () => {
    expect(parseColor("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("rejects var(), color-mix() and garbage", () => {
    expect(parseColor("var(--x)")).toBeNull();
    expect(parseColor("color-mix(in srgb, red, blue)")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("parseScalar", () => {
  it("reads minified scalars", () => {
    expect(parseScalar(".3", 0)).toBeCloseTo(0.3);
    expect(parseScalar(" 0.38", 0)).toBeCloseTo(0.38);
  });

  it("falls back on an empty or bad token", () => {
    expect(parseScalar("", 0.12)).toBe(0.12);
    expect(parseScalar("abc", 0.5)).toBe(0.5);
  });
});

describe("toCanvasColor", () => {
  it("round-trips a token into an rgba() fill", () => {
    expect(toCanvasColor(parseColor("#0a0a0a2e")!)).toBe("rgba(10, 10, 10, 0.1804)");
  });
});

describe("themeFromTokens", () => {
  const light: Record<string, string> = {
    "--color-background": "#fafaf7",
    "--color-foreground": "#0a0a0a",
    "--shader-second": "#dc9562",
    "--card-duo-light": "#e2e9f0",
    "--card-recede": ".3",
    "--name-ink": ".12",
  };
  const dark: Record<string, string> = { ...light, "--card-work-back-dark": "#40566a", "--card-recede": ".38" };

  it("paints plain work backs duo light in light, their own pane in dark", () => {
    const l = themeFromTokens((n) => light[n] ?? "", false);
    const d = themeFromTokens((n) => dark[n] ?? "", true);
    expect(l.card.workBack).toEqual(l.card.duoLight);
    expect(d.card.workBack).toEqual(parseColor("#40566a"));
  });

  it("carries the review's second-lobe strength per theme and the recede token", () => {
    expect(themeFromTokens((n) => light[n] ?? "", false).field.secondStrength).toBe(FIELD.second.light);
    const d = themeFromTokens((n) => dark[n] ?? "", true);
    expect(d.field.secondStrength).toBe(FIELD.second.dark);
    expect(d.card.recede).toBeCloseTo(0.38);
  });

  it("falls back to paper for a missing color, never throws", () => {
    const t = themeFromTokens((n) => light[n] ?? "", false);
    expect(t.card.pane).toEqual(t.paper);
  });
});

describe("createRepaintQueue", () => {
  it("paints at most perFrame items per drain, in order", () => {
    const q = createRepaintQueue<number>(4);
    q.enqueue([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const painted: number[] = [];
    expect(q.drain((i) => painted.push(i))).toBe(4);
    expect(painted).toEqual([0, 1, 2, 3]);
    expect(q.size).toBe(6);
    q.drain(() => {});
    q.drain(() => {});
    expect(q.size).toBe(0);
  });

  it("stops starting new paints once the frame budget is spent, but always paints one", () => {
    const q = createRepaintQueue<number>(4);
    q.enqueue([0, 1, 2, 3]);
    let clock = 0;
    const painted: number[] = [];
    const count = q.drain((i) => {
      painted.push(i);
      clock += 5;
    }, 6, () => clock);
    expect(count).toBe(2);
    expect(painted).toEqual([0, 1]);
    expect(q.drain(() => (clock += 50), 6, () => clock)).toBe(1);
  });

  it("keeps one entry per item when a second toggle lands mid-drain", () => {
    const q = createRepaintQueue<number>(4);
    q.enqueue([0, 1, 2]);
    q.enqueue([1, 2, 3]);
    expect(q.size).toBe(4);
  });
});
