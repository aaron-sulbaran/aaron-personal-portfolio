import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOOTER_GAP_PX, HERO_CONTROLS, HERO_LIFT_PX, ISLE } from "./constants";
import { footerLift, heroLift } from "./lift";

describe("the isle riding up from the footer", () => {
  const viewport = 900;

  it("sits where the stock capsule sits, 54px above the bottom", () => {
    expect(ISLE.bottomPx).toBe(54);
  });

  it("stands 14px above the footer's top edge", () => {
    expect(FOOTER_GAP_PX).toBe(14);
  });

  it("does not move while the footer is below the isle and its gap", () => {
    expect(footerLift(900, viewport)).toBe(0);
    expect(footerLift(viewport - ISLE.bottomPx + FOOTER_GAP_PX, viewport)).toBe(0);
  });

  it("rises one for one with the footer once it reaches the isle", () => {
    const at = (top: number) => footerLift(top, viewport);
    expect(at(860)).toBe(0);
    expect(at(850)).toBe(10);
    expect(at(450)).toBe(410);
    expect(at(449) - at(450)).toBe(1);
  });

  it("keeps the isle's bottom edge a gap above the footer's top edge", () => {
    for (const top of [840, 700, 480, 300]) {
      const bottomEdge = viewport - ISLE.bottomPx - footerLift(top, viewport);
      expect(bottomEdge).toBeLessThanOrEqual(top - FOOTER_GAP_PX);
      expect(bottomEdge).toBeGreaterThan(top - FOOTER_GAP_PX - 1);
    }
  });
});

describe("the isle in the hero", () => {
  it("stands above its dock line only while the band is still ahead", () => {
    expect(heroLift(true)).toBe(HERO_LIFT_PX);
    expect(heroLift(false)).toBe(0);
  });

  it("then clears the Coil and Band toggle by at least a gap", () => {
    const toggleTop = HERO_CONTROLS.bottomPx + HERO_CONTROLS.heightPx;
    expect(ISLE.bottomPx + HERO_LIFT_PX).toBeGreaterThanOrEqual(toggleTop + FOOTER_GAP_PX);
  });

  it("uses the toggle's real seat", () => {
    const toggle = readFileSync("components/coil/ShapeToggle.tsx", "utf8");
    expect(toggle).toContain(`bottom-[${HERO_CONTROLS.bottomPx}px]`);
    expect(toggle).toContain("h-10");
    expect(HERO_CONTROLS.heightPx).toBe(40);
  });
});
