import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { stageLeadPx, stageReachAbove } from "@/lib/home/stageLead";

describe("the stage's reach up page 1", () => {
  it("reaches above the slot far enough for the wheel's ring on a desktop stage", () => {
    const reach = stageReachAbove(800, 1280);
    const radius = 0.5 * 800 * COIL.deal.wheel.diameterOfHeight * COIL.deal.wheel.scale;
    expect(reach).toBeGreaterThan(radius);
    expect(reach).toBeLessThan(radius * 1.4);
  });

  it("never reaches less than the ribbon's own card needs, however small the stage", () => {
    expect(stageReachAbove(120, 1280)).toBeGreaterThanOrEqual(COIL.deal.ribbon.cardHeightPx / 2);
    expect(stageReachAbove(120, 390)).toBeGreaterThanOrEqual(COIL.deal.ribbon.cardHeightPhonePx / 2);
  });

  it("makes the lead the distance from the stage's top to the cards section's top", () => {
    const facts = { sectionTop: 1000, slotCenter: 800, frameHeight: 800, canvasWidth: 1280 };
    expect(stageLeadPx(facts)).toBeCloseTo(200 + stageReachAbove(800, 1280), 6);
  });

  it("has no lead when the slot is far below the section's top", () => {
    expect(stageLeadPx({ sectionTop: 100, slotCenter: 5000, frameHeight: 800, canvasWidth: 1280 })).toBe(0);
  });

  it("follows the slot: lower on the page, a shorter lead", () => {
    const base = { sectionTop: 1000, frameHeight: 800, canvasWidth: 1280 };
    expect(stageLeadPx({ ...base, slotCenter: 850 })).toBeLessThan(stageLeadPx({ ...base, slotCenter: 750 }));
  });
});
