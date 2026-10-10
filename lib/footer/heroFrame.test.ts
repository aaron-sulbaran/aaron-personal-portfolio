import { describe, expect, it } from "vitest";
import { FOOTER } from "./constants";
import { heroFrame, lockupHeight, posterBox, recolor } from "./heroFrame";
import { fieldTokens, nameTokens, parseToken } from "./tokens";

const EPS = 1e-9;

describe("the hero's frame", () => {
  it("frames the field as the hero does, the word's middle where the hero's name sits", () => {
    const f = heroFrame(1440, 400, 900, 300);
    expect(f.aspect).toBeCloseTo(1.6, 12);
    expect(f.frameY).toBeCloseTo(400 / 900, 12);
    // uv.y = frameY0 + v * frameY, v from the canvas's bottom: the word's middle (100px up) lands on 0.5.
    expect(f.frameY0 + (100 / 400) * f.frameY).toBeCloseTo(0.5, 12);
    expect(heroFrame(390, 300, 844).narrow).toBe(true);
    expect(heroFrame(1440, 300, 900).narrow).toBe(false);
  });

  it("measures the hero's lockup per px of its width, narrow under the hero's aspect", () => {
    expect(lockupHeight(1440, 900)).toBeCloseTo(1440 * FOOTER.heroLockup.wide, 9);
    expect(lockupHeight(390, 844)).toBeCloseTo(390 * FOOTER.heroLockup.narrow, 9);
  });

  it("frames the poster stand-in the way the live field is framed", () => {
    const box = posterBox(480, 128, 1440, 900, 404, 100);
    expect(box.y + box.h / 2).toBeCloseTo(100, 9);
    expect(box.x + box.w / 2).toBeCloseTo(240, 9);
    expect(box.w).toBeGreaterThanOrEqual(480);
    expect(box.h).toBeGreaterThanOrEqual(404 - EPS);
  });

  it("recolors the poster to a depth from the paper, and leaves it at 1", () => {
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    recolor(px, [1, 1, 1], 1);
    expect([...px]).toEqual([200, 100, 50, 255]);
    recolor(px, [1, 1, 1], 2);
    expect([...px]).toEqual([145, 0, 0, 255]);
  });
});

describe("the tokens", () => {
  it("parses hex and rgb, minified or not, and falls back to paper", () => {
    expect(parseToken("#FAFAF7")).toEqual([250 / 255, 250 / 255, 247 / 255]);
    expect(parseToken("#fff")).toEqual([1, 1, 1]);
    expect(parseToken("#c0d5e8ff")).toEqual([0xc0 / 255, 0xd5 / 255, 0xe8 / 255]);
    expect(parseToken("rgba(255, 0, 51, 0.5)")).toEqual([1, 0, 0.2]);
    expect(parseToken("var(--x)")).toBeNull();
    const t = fieldTokens((name) => (name === "--color-background" ? "#0E1419" : name === "--shader-top" ? "#0A0F13" : ""), true);
    expect(t.top).toEqual([10 / 255, 15 / 255, 19 / 255]);
    expect(t.glow).toEqual(t.paper);
  });

  it("reads the hero name's tokens, the ink a number, minified or not", () => {
    const tokens: Record<string, string> = { "--name-ink": " .14", "--name-surface-1": "#9CC0DC", "--name-surface-mean": "#80A2BF" };
    const n = nameTokens((name) => tokens[name] ?? "", [0, 0, 0]);
    expect(n.ink).toBe(0.14);
    expect(n.c1).toEqual([0x9c / 255, 0xc0 / 255, 0xdc / 255]);
    expect(n.c2).toEqual([0, 0, 0]);
    expect(nameTokens(() => "", [1, 1, 1]).ink).toBe(0.12);
  });
});
