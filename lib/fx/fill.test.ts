import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CTA_CLASS, CTA_OVER_CLASS, FILL, FILL_PICK, arrowShift, farCorner, fillVars, iconOrigin, seedInsets } from "./fill";

const root = { left: 100, top: 50, width: 120, height: 40 };
const icon = { left: 196, top: 59, width: 16, height: 22 };
const seed = { left: 206, top: 67, width: 6, height: 6 };
const pad = { left: 8, right: 6 };

describe("fill geometry", () => {
  it("reaches the farthest corner, rounded up, plus one", () => {
    expect(farCorner(0, 20, 120, 40)).toBe(123);
    expect(farCorner(60, 20, 120, 40)).toBe(65);
  });
  it("grows from the icon's centre, or the start edge when there is no icon", () => {
    expect(iconOrigin(root, icon)).toEqual({ x: 104, y: 20 });
    expect(iconOrigin(root, null)).toEqual({ x: 0, y: 20 });
  });
  it("measures the circle's seed as insets from the root", () => {
    expect(seedInsets(root, seed)).toEqual({ top: 17, right: 8, bottom: 17, left: 106, radius: 3 });
  });
  it("writes only the custom properties each variant reads", () => {
    expect(fillVars("icon", root, { icon, seed: null, pad })).toEqual({ "--fx-ox": "104px", "--fx-oy": "20px", "--fx-r1": "107px" });
    expect(fillVars("circle", root, { icon: null, seed, pad })).toEqual({
      "--fx-st": "17px", "--fx-sr": "8px", "--fx-sb": "17px", "--fx-sl": "106px", "--fx-s0": "3px",
    });
    expect(fillVars("circle", root, { icon: null, seed: null, pad })).toEqual({});
    expect(fillVars("rise", root, { icon, seed, pad })).toEqual({ "--fx-line-l": "8px", "--fx-line-r": "6px" });
  });
  it("moves the arrows along their own direction", () => {
    expect(arrowShift("right")).toEqual({ x: "110%", y: "0%" });
    expect(arrowShift("up-right")).toEqual({ x: "80%", y: "-80%" });
  });
});

describe("Aaron's pick, 2026-10-06", () => {
  it("runs on the reference clock", () => {
    expect(FILL).toEqual({ durationMs: 450, ease: "cubic-bezier(0.785, 0.135, 0.15, 0.86)", rectRadiusPx: 10 });
  });
  it("gives every control its variant and colourway", () => {
    expect(FILL_PICK).toEqual({
      menu: { variant: "icon", colorway: "glass-accent" },
      capsule: { variant: "icon", colorway: "glass-accent" },
      nav: { variant: "rise", colorway: "quiet" },
      connect: { variant: "rise", colorway: "quiet" },
      band: { variant: "rise", colorway: "glass-accent" },
      hero: { variant: "circle", colorway: "glass-accent" },
      cta: { variant: "circle", colorway: "glass-accent" },
    });
  });
  it("sets the calls to action at 44px in the large label step", () => {
    expect(CTA_CLASS).toContain("h-11");
    expect(CTA_CLASS).toContain("text-label-lg");
    expect(CTA_OVER_CLASS).toBe("flex items-center gap-3 pl-5 pr-1.5");
  });
});

describe("globals.css carries the same clock", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  it("registers --fx-p and sets the pick's duration, curve and radius", () => {
    expect(css).toMatch(/@property --fx-p \{\s*syntax: "<number>";\s*inherits: true;\s*initial-value: 0;\s*\}/);
    expect(css).toContain(`--fx-ms: ${FILL.durationMs}ms;`);
    expect(css).toContain(`--fx-ease: ${FILL.ease};`);
    expect(css).toContain(`--fx-rect-radius: ${FILL.rectRadiusPx}px;`);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.fx \{\s*transition-duration: 0s !important;/);
  });
});
