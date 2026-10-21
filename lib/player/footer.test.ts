import { describe, expect, it } from "vitest";
import { BAR_BOTTOM_PX, FOOTER_GAP_PX, footerLift, footerReaches, ISLE_BOTTOM_PX } from "./footer";

describe("the isle riding up from the footer", () => {
  const viewport = 900;

  it("sits where the pill's capsule sits, 54px above the bottom", () => {
    expect(ISLE_BOTTOM_PX).toBe(54);
  });

  it("does not move while the footer is below the isle and its gap", () => {
    expect(footerLift(900, viewport, ISLE_BOTTOM_PX)).toBe(0);
    expect(footerLift(viewport - ISLE_BOTTOM_PX + FOOTER_GAP_PX, viewport, ISLE_BOTTOM_PX)).toBe(0);
    expect(footerReaches(0)).toBe(false);
  });

  it("rises one for one with the footer once it reaches the isle", () => {
    const at = (top: number) => footerLift(top, viewport, ISLE_BOTTOM_PX);
    expect(at(860)).toBe(0);
    expect(at(850)).toBe(10);
    expect(at(450)).toBe(410);
    expect(at(449) - at(450)).toBe(1);
    expect(footerReaches(at(450))).toBe(true);
  });

  it("keeps the isle's bottom edge a gap above the footer's top edge", () => {
    for (const top of [840, 700, 480, 300]) {
      const bottomEdge = viewport - ISLE_BOTTOM_PX - footerLift(top, viewport, ISLE_BOTTOM_PX);
      expect(bottomEdge).toBeLessThanOrEqual(top - FOOTER_GAP_PX);
    }
  });

  it("takes a lower bottom offset for the phone's bar, which sits closer to the edge", () => {
    expect(footerLift(850, viewport, BAR_BOTTOM_PX)).toBeLessThan(footerLift(850, viewport, 0));
    expect(footerLift(850, viewport, BAR_BOTTOM_PX)).toBeGreaterThan(footerLift(850, viewport, ISLE_BOTTOM_PX));
  });
});
